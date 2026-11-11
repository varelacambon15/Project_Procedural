// Monta en 3D un arma generada: carga los .glb de cada pieza y las coloca en sus puntos de anclaje.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetEntry, PartRole, WeaponSpec } from "./types";
import type { WeaponGenerator } from "./generator";

export interface AssembledPart { object: THREE.Object3D; role: PartRole; from: AssetEntry; explode: THREE.Vector3; base: THREE.Vector3 }
export interface AssembledWeapon { group: THREE.Group; parts: AssembledPart[]; length: number }

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export class WeaponAssembler {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<THREE.Group>>();

  constructor(private gen: WeaponGenerator, private baseUrl: string) {}

  private load(entry: AssetEntry): Promise<THREE.Group> {
    if (!this.cache.has(entry.id)) this.cache.set(entry.id, this.loader.loadAsync(this.baseUrl + entry.file).then((g) => g.scene));
    return this.cache.get(entry.id)!;
  }

  /** Copia las mallas de un rol de un arma (geometría compartida, material propio). */
  private async nodes(entry: AssetEntry, role: PartRole): Promise<THREE.Group> {
    const scene = await this.load(entry);
    const g = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && roleOf(m) === role) {
        const c = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone());
        c.castShadow = true; c.receiveShadow = true;
        g.add(c);
      }
    });
    return g;
  }

  async assemble(spec: WeaponSpec): Promise<AssembledWeapon> {
    const group = new THREE.Group();
    const parts: AssembledPart[] = [];
    const get = (id: string) => this.gen.byId.get(id)!;
    const add = (object: THREE.Object3D, role: PartRole, from: AssetEntry, explode: [number, number, number]) => {
      group.add(object); parts.push({ object, role, from, explode: new THREE.Vector3(...explode), base: object.position.clone() });
    };
    let muzzle: THREE.Vector3 | null = null;
    let muzzleDiameter = 0.03;
    let opticTarget: THREE.Vector3 | null = null;
    let opticLength = 0;

    if (spec.layout === "modular-pistol") {
      const frameE = get(spec.parts.find((p) => p.role === "frame")!.from);
      const slideE = get(spec.parts.find((p) => p.role === "slide")!.from);
      const barrelE = get(spec.parts.find((p) => p.role === "barrel")!.from);
      const frame = await this.nodes(frameE, "frame");
      add(frame, "frame", frameE, [0, 0, 0]);
      // La corredera se apoya en el socket "slide" del armazón (donde iba la corredera original).
      const slide = await this.nodes(slideE, "slide");
      const slideOff = v3(frameE.sockets.slide!.pos).sub(v3(slideE.sockets.slide!.pos));
      slide.position.copy(slideOff);
      add(slide, "slide", slideE, [0, 1, 0]);
      // El cañón va en el socket "barrel" de la corredera, con longitud procedural.
      const barrel = await this.nodes(barrelE, "barrel");
      const src = barrelE.sockets.barrel!, dst = slideE.sockets.barrel!;
      const L = spec.barrelLength;
      barrel.scale.set(L, 1, 1);
      barrel.position.set(dst.pos[0] - src.pos[0] * L, dst.pos[1] - src.pos[1], 0).add(slideOff);
      add(barrel, "barrel", barrelE, [0.8, 1.6, 0]);
      muzzle = new THREE.Vector3(dst.pos[0] + (src.length ?? 0.04) * L, dst.pos[1], 0).add(slideOff);
      muzzleDiameter = (frameE.sockets.muzzle?.diameter ?? 0.03) * 0.6;
      paint(slide, spec);
    } else {
      const bodyE = get(spec.parts[0].from);
      const body = await this.nodes(bodyE, "body");
      add(body, "body", bodyE, [0, 0, 0]);
      paint(body, spec);
      if (bodyE.sockets.muzzle) { muzzle = v3(bodyE.sockets.muzzle.pos); muzzleDiameter = bodyE.sockets.muzzle.diameter ?? 0.03; }
      // Cargador: su parte superior encaja en el pozo del cuerpo; se escala al ancho del pozo original.
      const magPick = spec.parts.find((p) => p.role === "magazine");
      if (magPick && bodyE.sockets.magazine) {
        const magE = get(magPick.from);
        const mag = await this.nodes(magE, "magazine");
        const want = bodyE.sockets.magazine, have = magE.sockets.magazine!;
        const k = THREE.MathUtils.clamp((want.size?.[0] ?? 1) / (have.size?.[0] ?? 1), 0.6, 1.6);
        mag.scale.setScalar(k);
        mag.position.copy(v3(want.pos).sub(v3(have.pos).multiplyScalar(k)));
        add(mag, "magazine", magE, [0, -1.2, 0]);
      }
      if (bodyE.sockets.optic) { opticTarget = v3(bodyE.sockets.optic.pos); opticLength = bodyE.sockets.optic.size?.[0] ?? 0; }
    }

    // Mira: la propia del arma o una de otra arma/accesorio, apoyada en el socket "optic" o en la parte superior.
    if (spec.optic && opticTarget) {
      const optE = get(spec.optic);
      const opt = await this.nodes(optE, "scope");
      if (optE.id !== spec.parts[0].from) {
        const src = optE.sockets.optic!;
        const k = THREE.MathUtils.clamp(opticLength / (src.size?.[0] ?? opticLength), 0.4, 2.5);
        opt.scale.setScalar(k);
        opt.position.copy(opticTarget.clone().sub(v3(src.pos).multiplyScalar(k)));
      }
      add(opt, "scope", optE, [0, 1.4, 0]);
    }

    // Accesorio de boca: su parte trasera en la boca del cañón, escalado al diámetro.
    if (spec.muzzle && muzzle) {
      const accE = get(spec.muzzle);
      const acc = await this.nodes(accE, "muzzle");
      const h = accE.bounds.max[1] - accE.bounds.min[1];
      const k = THREE.MathUtils.clamp((muzzleDiameter * 1.6) / h, 0.05, 4);
      acc.scale.setScalar(k);
      acc.position.set(muzzle.x - accE.bounds.min[0] * k, muzzle.y - ((accE.bounds.min[1] + accE.bounds.max[1]) / 2) * k, 0);
      add(acc, "muzzle", accE, [1.2, 0.3, 0]);
    }

    // Centrar y guardar posiciones base para el despiece.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const length = box.max.x - box.min.x;
    for (const p of parts) { p.object.position.sub(center); p.base.copy(p.object.position); p.explode.multiplyScalar(length * 0.18); }
    return { group, parts, length };
  }
}

/** Rol de una malla: el primer antecesor que lo declara (las mallas multimaterial se cargan como grupo + hijos). */
function roleOf(o: THREE.Object3D): string | null {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (typeof n.userData.role === "string") return n.userData.role;
    const m = /^(body|slide|frame|barrel|magazine|scope|muzzle)/.exec(n.name);
    if (m) return m[1];
  }
  return null;
}

/** Pinta las piezas principales con la pintura del arma (las texturas de paleta se tiñen). */
function paint(obj: THREE.Object3D, spec: WeaponSpec) {
  if (!spec.paint.color) return;
  const tint = new THREE.Color(...spec.paint.color);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (mat.map) mat.color.copy(new THREE.Color(1, 1, 1).lerp(tint, 0.3));
      else if (/Wood|Handle/i.test(mat.name)) continue;
      else mat.color.lerp(tint, 0.55);
    }
  });
}
