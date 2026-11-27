// Ragdoll de los humanoides al morir (tarea 1). Con la física activa, las partes visuales del muñeco (torso, cabeza,
// brazos, antebrazos, muslos y espinillas) pasan a cuerpos rígidos unidos por articulaciones: cuello, hombros y
// caderas esféricas con límite cónico; codos y rodillas, bisagras con límites. Heredan el impulso del impacto o de la
// explosión, caen y se funden (el fundido es el de siempre de `Dummy`, retrasado unos segundos).
// Las zonas arrancadas con el desmembramiento pixelado NO pasan a ragdoll (ni lo que cuelga de ellas).
import * as THREE from "three";
import { Physics as PhysicsClass, coneExcess, type Body, type Physics, type V3 } from "./physics";

export type SegId = "torso" | "head" | "armL" | "foreL" | "armR" | "foreR" | "thighL" | "shinL" | "thighR" | "shinR";
export interface JointPlan { child: SegId; parent: SegId; kind: "sphere" | "hinge"; /** cono (rad) o [min, max] de la bisagra */ cone?: number; limits?: [number, number] }
/** Esqueleto del humanoide: padre, tipo de articulación y límites. */
export const SKELETON: JointPlan[] = [
  { child: "head", parent: "torso", kind: "sphere", cone: 0.55 },
  { child: "armL", parent: "torso", kind: "sphere", cone: 1.7 },
  { child: "armR", parent: "torso", kind: "sphere", cone: 1.7 },
  { child: "foreL", parent: "armL", kind: "hinge", limits: [-2.4, 0] },
  { child: "foreR", parent: "armR", kind: "hinge", limits: [-2.4, 0] },
  { child: "thighL", parent: "torso", kind: "sphere", cone: 1.2 },
  { child: "thighR", parent: "torso", kind: "sphere", cone: 1.2 },
  { child: "shinL", parent: "thighL", kind: "hinge", limits: [0, 2.3] },
  { child: "shinR", parent: "thighR", kind: "hinge", limits: [0, 2.3] },
];

/**
 * Qué segmentos y articulaciones entran en el ragdoll: los presentes y no arrancados; un segmento arrancado se queda
 * fuera, y también lo que cuelga de él (un antebrazo sin brazo no puede quedar flotando). Sin torso, no hay ragdoll.
 */
export function planRagdoll(present: ReadonlySet<SegId>, severed: ReadonlySet<SegId>): { segs: SegId[]; joints: JointPlan[]; dropped: SegId[] } {
  if (!present.has("torso") || severed.has("torso")) return { segs: [], joints: [], dropped: [...present] };
  const keep = new Set<SegId>(["torso"]);
  // (el esqueleto está en orden de padres a hijos)
  for (const j of SKELETON) if (present.has(j.child) && !severed.has(j.child) && keep.has(j.parent)) keep.add(j.child);
  return { segs: [...keep], joints: SKELETON.filter((j) => keep.has(j.child)), dropped: [...present].filter((s) => !keep.has(s)) };
}

/** Partes visuales de un humanoide (las expone `Dummy.ragdollParts`). */
export interface HumanoidParts {
  body: THREE.Object3D; head: THREE.Object3D[];
  arms: [THREE.Object3D, THREE.Object3D][]; // [hombro, codo] izquierdo y derecho
  legs: [THREE.Object3D, THREE.Object3D][]; // [cadera, rodilla]
  isSevered: (o: THREE.Object3D) => boolean;
}

interface Seg { id: SegId; pivot: THREE.Group; body: Body; nodes: { o: THREE.Object3D; parent: THREE.Object3D; pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 }[]; axis: THREE.Vector3 }

const v = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);
const plain = (p: THREE.Vector3): V3 => ({ x: p.x, y: p.y, z: p.z });

/** Un ragdoll vivo: crea los cuerpos, copia su pose a las mallas cada fotograma y lo deshace al acabar. */
export class Ragdoll {
  private segs = new Map<SegId, Seg>();
  private joints: JointPlan[] = [];
  age = 0;
  constructor(private ph: Physics, private scene: THREE.Scene, parts: HumanoidParts, impulse: THREE.Vector3, hitPoint: THREE.Vector3 | null) {
    const objs = new Map<SegId, THREE.Object3D[]>();
    objs.set("torso", [parts.body]);
    if (parts.head.length) objs.set("head", parts.head);
    const [aL, aR] = parts.arms, [lL, lR] = parts.legs;
    if (aL) { objs.set("armL", [aL[0]]); objs.set("foreL", [aL[1]]); }
    if (aR) { objs.set("armR", [aR[0]]); objs.set("foreR", [aR[1]]); }
    if (lL) { objs.set("thighL", [lL[0]]); objs.set("shinL", [lL[1]]); }
    if (lR) { objs.set("thighR", [lR[0]]); objs.set("shinR", [lR[1]]); }
    // Arrancado = todas sus mallas propias ocultas
    const sev = new Set<SegId>();
    for (const [id, os] of objs) {
      const meshes: THREE.Mesh[] = [];
      for (const o of os) { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); else for (const c of o.children) if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh); }
      if (meshes.length && meshes.every((m) => parts.isSevered(m))) sev.add(id);
    }
    for (const os of objs.values()) for (const o of os) this.roots.add(o);
    const plan = planRagdoll(new Set(objs.keys()), sev);
    this.joints = plan.joints;
    for (const id of plan.dropped) for (const o of objs.get(id) ?? []) o.visible = false;
    // Orden: hijos antes que el torso (se sacan de su padre antes de mover el cuerpo entero)
    const order = [...plan.segs].sort((a, b) => (a === "torso" ? 1 : 0) - (b === "torso" ? 1 : 0));
    parts.body.updateMatrixWorld(true);
    for (const id of order) this.makeSeg(id, objs.get(id)!);
    for (const j of plan.joints) this.join(j);
    // Impulso inicial: el del impacto en el segmento más cercano, y una parte en el torso
    // (el torso se va en la dirección del disparo y los pies, un poco hacia el lado contrario: cae de espaldas como en
    //  los shooters, en vez de doblarse en vertical sobre las piernas)
    const t = this.segs.get("torso");
    // (en el pecho, por encima de su centro: empujar por debajo lo hacía girar y caer de cara hacia el tirador)
    if (t) { const c = t.body.translation(); this.ph.applyImpulse(t.body, plain(impulse), { x: c.x, y: c.y + 0.22, z: c.z }); }
    void hitPoint;
    const back = impulse.clone().setY(0).multiplyScalar(-0.12);
    for (const id of ["shinL", "shinR"] as const) { const s = this.segs.get(id); if (s) this.ph.applyImpulse(s.body, plain(back)); }
  }

  private makeSeg(id: SegId, os: THREE.Object3D[]) {
    // Caja de sus mallas propias (sin los segmentos hijos) en el mundo: da la posición, el tamaño y el eje del cuerpo
    const box = new THREE.Box3();
    for (const o of os) o.traverse((m) => { if ((m as THREE.Mesh).isMesh && m.visible && this.ownerOf(m, os)) box.expandByObject(m, true); });
    if (box.isEmpty()) for (const o of os) box.expandByObject(o);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const pivot = new THREE.Group(); pivot.position.copy(c); this.scene.add(pivot);
    const nodes = os.map((o) => ({ o, parent: o.parent!, pos: o.position.clone(), quat: o.quaternion.clone(), scale: o.scale.clone() }));
    for (const o of os) pivot.attach(o);
    const long = Math.max(size.y, 0.12), r = Math.max(0.05, Math.min(size.x, size.z) / 2);
    // (densidad del cuerpo humano, ~985 kg/m³: con 1 kg/m³ cada pieza pesaba gramos y cualquier impulso la lanzaba lejos)
    const body = id === "torso" ? this.ph.box(plain(c), { x: Math.max(0.12, size.x / 2), y: Math.max(0.15, size.y / 2 * 0.6), z: Math.max(0.08, size.z / 2) }, 985)
      : id === "head" ? this.ph.sphere(plain(c), Math.max(0.1, Math.max(size.x, size.y, size.z) / 2), 985)
      : this.ph.capsule(plain(c), Math.max(0.02, long / 2 - r), r, 985);
    // (las piezas se solapan al empezar: si chocaran entre sí, el muñeco estallaba)
    this.ph.setGroups(body, PhysicsClass.RAGDOLL_GROUPS);
    this.segs.set(id, { id, pivot, body, nodes, axis: new THREE.Vector3(0, 1, 0) });
  }
  /** ¿Pertenece la malla a este segmento y no a uno hijo (los grupos de codo y rodilla cuelgan del de hombro y cadera)? */
  private ownerOf(m: THREE.Object3D, os: THREE.Object3D[]) {
    for (let p: THREE.Object3D | null = m; p; p = p.parent) { if (os.includes(p)) return true; if (p !== m && this.isSegRoot(p)) return false; }
    return false;
  }
  private roots = new Set<THREE.Object3D>();
  private isSegRoot(o: THREE.Object3D) { return this.roots.has(o); }

  private join(j: JointPlan) {
    const a = this.segs.get(j.parent)!, b = this.segs.get(j.child)!;
    // Ancla: el origen del grupo hijo (hombro, codo, cadera, rodilla, base del cuello) en el mundo
    const anchorW = b.nodes[0].o.getWorldPosition(new THREE.Vector3());
    if (j.child === "head") anchorW.copy(b.pivot.position).add(new THREE.Vector3(0, -0.12, 0));
    const local = (s: Seg) => plain(anchorW.clone().sub(s.pivot.position).applyQuaternion(s.pivot.quaternion.clone().invert()));
    if (j.kind === "sphere") this.ph.spherical(a.body, b.body, local(a), local(b));
    else this.ph.hinge(a.body, b.body, local(a), local(b), { x: 1, y: 0, z: 0 }, j.limits![0], j.limits![1]);
  }

  /** Antes de cada paso: límite cónico de las esféricas (Rapier 0.21 no lo trae), con un impulso angular suave. */
  limitCones() {
    for (const j of this.joints) {
      if (j.kind !== "sphere" || j.cone === undefined) continue;
      const a = this.segs.get(j.parent)!.body, b = this.segs.get(j.child)!.body;
      const qa = a.rotation(), qb = b.rotation();
      const pa = v({ x: 0, y: 1, z: 0 }).applyQuaternion(new THREE.Quaternion(qa.x, qa.y, qa.z, qa.w));
      const pb = v({ x: 0, y: 1, z: 0 }).applyQuaternion(new THREE.Quaternion(qb.x, qb.y, qb.z, qb.w));
      const c = coneExcess(plain(pa), plain(pb), j.cone);
      if (c.excess > 0) { const k = c.excess * 0.6; b.applyTorqueImpulse({ x: c.axis.x * k, y: c.axis.y * k, z: c.axis.z * k }, true); a.applyTorqueImpulse({ x: -c.axis.x * k, y: -c.axis.y * k, z: -c.axis.z * k }, true); }
    }
  }
  /** Copia la pose de los cuerpos a las mallas. */
  sync(dt: number) {
    this.age += dt;
    for (const s of this.segs.values()) {
      const t = s.body.translation(), q = s.body.rotation();
      s.pivot.position.set(t.x, t.y, t.z); s.pivot.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }
  /** Deshace el ragdoll: quita los cuerpos y devuelve cada malla a su padre con su transformación original. */
  dispose() {
    for (const s of this.segs.values()) {
      for (const n of [...s.nodes].reverse()) { n.parent.add(n.o); n.o.position.copy(n.pos); n.o.quaternion.copy(n.quat); n.o.scale.copy(n.scale); n.o.visible = true; }
      this.scene.remove(s.pivot); this.ph.remove(s.body);
    }
    this.segs.clear();
  }
  get bodies() { return [...this.segs.values()].map((s) => s.body); }
}
