// Monta en 3D un arma generada: carga los .glb de cada pieza y las coloca en sus puntos de anclaje.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { NO_TWEAKS, type AssetEntry, type PartRole, type WeaponSpec } from "./types";
import { TYPE_LENGTH, pieceScale, type WeaponGenerator } from "./generator";
import { KIT_FLIP, isKit, kitLabel, kitPlacements, type KitPart } from "./kit";
import { accessory, buildMuzzle, buildOptic } from "./accessories";

export interface AssembledPart { object: THREE.Object3D; role: PartRole; from: AssetEntry; explode: THREE.Vector3; base: THREE.Vector3 }
export interface AssembledWeapon {
  group: THREE.Group; parts: AssembledPart[]; length: number;
  /** Punta del cañón (o del accesorio de boca), en coordenadas del grupo. */ muzzle: THREE.Vector3;
  /** Altura de la línea de mira (centro de la mira, si la lleva), en coordenadas del grupo. */ sightY: number | null;
  /** Aumentos de la mira (1 = sin mira). */ zoom: number;
  /** Puntos de agarre (coordenadas del grupo): mano derecha en la empuñadura, izquierda en el guardamanos,
   *  pozo del cargador y palanca de carga. Los usan los brazos (IK) y las animaciones de recarga. */
  handles: { grip: THREE.Vector3; support: THREE.Vector3; magwell: THREE.Vector3; charge: THREE.Vector3 };
}

const v3 = (a: readonly number[]) => new THREE.Vector3(a[0], a[1], a[2]);

export class WeaponAssembler {
  private loader = new GLTFLoader();
  private cache = new Map<string, Promise<THREE.Group>>();

  constructor(private gen: WeaponGenerator, private baseUrl: string) {}

  private load(entry: AssetEntry): Promise<THREE.Group> {
    if (!this.cache.has(entry.id)) this.cache.set(entry.id, this.fetchModel(this.baseUrl + entry.file));
    return this.cache.get(entry.id)!;
  }

  /**
   * Carga un .glb, o un .gltf en JSON con el buffer incrustado en base64. En este segundo caso el buffer se
   * descodifica aquí y se reconstruye un .glb en memoria: algunos visores bloquean que el cargador lea URIs data:.
   */
  private async fetchModel(url: string): Promise<THREE.Group> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    let buf = await res.arrayBuffer();
    if (new Uint32Array(buf, 0, 1)[0] !== 0x46546c67) buf = jsonToGlb(JSON.parse(new TextDecoder().decode(buf)));
    const gltf = await this.loader.parseAsync(buf, "");
    return gltf.scene;
  }

  /** Carga de antemano todas las piezas del kit (son pequeñas): así las armas del kit se montan al instante. */
  preloadKit() { for (const p of this.gen.kit.parts) if (!this.cache.has(p.id)) this.cache.set(p.id, this.fetchModel(this.baseUrl + p.file)); }

  /** Pieza del kit: sus mallas con el acabado común (el cristal de las miras se conserva). */
  private async kitNode(part: KitPart): Promise<THREE.Group> {
    if (!this.cache.has(part.id)) this.cache.set(part.id, this.fetchModel(this.baseUrl + part.file));
    const scene = await this.cache.get(part.id)!;
    const g = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const c = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map(finish) : finish(m.material));
      c.name = m.name; c.castShadow = true; c.receiveShadow = true;
      g.add(c);
    });
    return g;
  }

  /** Copia las mallas de un rol de un arma (geometría compartida, material propio). */
  private async nodes(entry: AssetEntry, role: PartRole): Promise<THREE.Group> {
    const scene = await this.load(entry);
    const g = new THREE.Group();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && roleOf(m) === role) {
        const c = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? m.material.map(finish) : finish(m.material));
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
    const first = this.gen.byId.get(spec.parts[0].from);
    const length0 = first ? first.bounds.max[0] - first.bounds.min[0] : TYPE_LENGTH[spec.type] ?? 0.9;
    let muzzleDiameter = 0.03;
    let opticTarget: THREE.Vector3 | null = null;
    let opticLength = 0;

    let sightKit: number | null = null;
    if (spec.layout === "kit") {
      // Kit modular: cada pieza en su socket, recorriendo el árbol desde la plataforma
      const { placements, muzzle: mz, opticAt } = kitPlacements(this.gen.kit, spec);
      let frontSightTop: number | null = null;
      // Todas las piezas se cargan a la vez (en paralelo), y luego se colocan en orden
      const nodes = await Promise.all(placements.map((pl) => this.kitNode(pl.part)));
      for (const [i, pl] of placements.entries()) {
        const node = nodes[i];
        node.position.set(...pl.pos); node.scale.x = pl.stretch;
        if (KIT_FLIP.has(pl.part.id)) node.rotation.y = Math.PI;
        const role: PartRole = pl.role === "sight" ? "scope" : pl.role;
        add(node, role, { id: pl.part.id, label: kitLabel(pl.part.id), pack: "kit" } as AssetEntry, KIT_EXPLODE[pl.role] ?? [0, 0.6, 0]);
        if (KIT_PRIMARY.has(pl.role)) paint(node, spec);
        else if (KIT_SECONDARY.has(pl.role)) paint(node, spec, "secondary");
        if (pl.role === "scope") {
          // Mira del kit: la línea de mira pasa por el centro del cristal
          node.updateMatrixWorld(true);
          const lens = node.children.find((c) => /lens/i.test(c.name)) ?? node;
          const b = new THREE.Box3().setFromObject(lens); sightKit = (b.min.y + b.max.y) / 2;
        }
        if (pl.role === "sight" && /front/.test(pl.part.id)) { node.updateMatrixWorld(true); frontSightTop = new THREE.Box3().setFromObject(node).max.y; }
      }
      if (!spec.optic) {
        // Alzas: la línea pasa por la punta del punto de mira (o por encima de la corredera, en pistola)
        const slide = parts.find((p) => p.role === "slide");
        sightKit = frontSightTop !== null ? frontSightTop - 0.002 : slide ? new THREE.Box3().setFromObject(slide.object).max.y + 0.002 : null;
      }
      if (mz) { muzzle = v3(mz); muzzleDiameter = spec.type === "shotgun" ? 0.026 : spec.type === "pistol" ? 0.014 : 0.018; }
      if (opticAt && spec.optic && !isKit(spec.optic)) { opticTarget = v3(opticAt); opticLength = spec.type === "pistol" ? 0.05 : 0.1; }
    } else if (spec.layout === "modular-pistol") {
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
      if (spec.layout === "modular-long") {
        // Cajón en el origen; culata, guardamanos y empuñadura (de otras armas de la familia) en sus juntas.
        const J = bodyE.joints!;
        const recv = await this.nodes(bodyE, "receiver");
        add(recv, "receiver", bodyE, [0, 0, 0]); paint(recv, spec);
        const tw = spec.tweaks ?? NO_TWEAKS;
        // Cada pieza se escala a la sección de su junta y recibe su variación leve (largo, tamaño, ángulo).
        const attach = async (role: "stock" | "front" | "grip", joint: "rear" | "front" | "grip", face: "stockFace" | "frontFace" | "gripFace", explode: [number, number, number]) => {
          const donor = get(spec.parts.find((p) => p.role === role)!.from);
          const node = await this.nodes(donor, role);
          const sv = new THREE.Vector3(...pieceScale(bodyE, donor, role, tw));
          const k = sv.y;
          node.scale.copy(sv);
          const anchor = v3(J[joint].pos);
          if (role === "grip") {
            // La empuñadura gira un poco sobre su junta
            const pivot = new THREE.Group(); pivot.position.copy(anchor); pivot.rotation.z = tw.gripAngle;
            node.position.copy(v3(donor.joints![face].pos).multiply(sv).negate());
            pivot.add(node); add(pivot, role, donor, explode); paint(node, spec, "secondary");
            return { donor, k, node: pivot, sv };
          }
          node.position.copy(anchor.sub(v3(donor.joints![face].pos).multiply(sv)));
          add(node, role, donor, explode); paint(node, spec, role === "stock" ? "secondary" : "primary");
          return { donor, k, node, sv };
        };
        await attach("stock", "rear", "stockFace", [-1.2, 0, 0]);
        const fr = await attach("front", "front", "frontFace", [1.1, 0.2, 0]);
        await attach("grip", "grip", "gripFace", [0, -1, 0]);
        // Acabado único: las piezas ajenas toman el color del metal/polímero del cajón (la madera conserva el suyo),
        // así el arma se lee como una sola pieza y no como un parche de colores.
        unifyFinish(recv, parts.filter((p) => p.from !== bodyE && ["stock", "front", "grip"].includes(p.role)).map((p) => p.object));
        if (fr.donor.sockets.muzzle) {
          const m = fr.donor.sockets.muzzle;
          muzzle = v3(m.pos).multiply(fr.sv).add(fr.node.position);
          muzzleDiameter = (m.diameter ?? 0.02) * fr.k;
        }
      } else {
        const body = await this.nodes(bodyE, "body");
        add(body, "body", bodyE, [0, 0, 0]);
        paint(body, spec);
        if (bodyE.sockets.muzzle) { muzzle = v3(bodyE.sockets.muzzle.pos); muzzleDiameter = bodyE.sockets.muzzle.diameter ?? 0.03; }
      }
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
      else if (bodyE.sockets.rail) { opticTarget = v3(bodyE.sockets.rail.pos); opticLength = bodyE.sockets.rail.length ?? 0.1; }
    }
    let sight: number | null = sightKit, zoom = isKit(spec.optic) ? accessory(spec.optic)?.zoom ?? 1 : 1;

    // Mira: la propia del arma o una de otra arma/accesorio, apoyada en el socket "optic" o en la parte superior.
    const optAcc = accessory(spec.optic);
    if (optAcc && opticTarget && !isKit(spec.optic)) {
      // Mira propia, generada a medida del raíl
      const { group: opt, sightHeight } = buildOptic(optAcc.id, opticLength, length0);
      // Si alguna parte del arma (cajón, culata, alzas) queda por encima de la línea de mira, la mira va sobre
      // un elevador, como en un arma real: así al apuntar siempre se ve por encima del arma.
      const top = new THREE.Box3().setFromObject(group).max.y;
      const riser = Math.max(0, top + 0.006 - (opticTarget.y + sightHeight));
      opt.position.copy(opticTarget).add(new THREE.Vector3(0, riser - 0.002, 0));
      if (riser > 0.002) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.05, riser + 0.004, 0.022), new THREE.MeshStandardMaterial({ name: "Steel", color: 0x1c1d1f, metalness: 0.75, roughness: 0.42 }));
        block.position.y = -riser / 2; opt.add(block);
      }
      opticTarget.y += riser;
      group.add(opt);
      parts.push({ object: opt, role: "scope", from: { id: optAcc.id, label: optAcc.id, pack: "acc" } as AssetEntry, explode: new THREE.Vector3(0, 1.4, 0), base: opt.position.clone() });
      sight = opticTarget.y + sightHeight; zoom = optAcc.zoom ?? 1;
    } else if (spec.optic && opticTarget && !isKit(spec.optic)) {
      const optE = get(spec.optic);
      const opt = await this.nodes(optE, "scope");
      if (optE.id !== spec.parts[0].from) {
        const src = optE.sockets.optic!;
        const k = THREE.MathUtils.clamp(opticLength / (src.size?.[0] ?? opticLength), 0.4, 2.5);
        opt.scale.setScalar(k);
        opt.position.copy(opticTarget.clone().sub(v3(src.pos).multiplyScalar(k)));
      }
      add(opt, "scope", optE, [0, 1.4, 0]);
      const ob = new THREE.Box3().setFromObject(opt); sight = (ob.min.y + ob.max.y) / 2; zoom = 2.5;
    }

    // Accesorio de boca: su parte trasera en la boca del cañón, escalado al diámetro.
    const muzAcc = accessory(spec.muzzle);
    if (muzAcc && muzzle && !isKit(spec.muzzle)) {
      // Dispositivo de boca propio, del diámetro exacto del cañón
      const { group: dev, length: dl } = buildMuzzle(muzAcc.id, muzzleDiameter, length0);
      dev.position.copy(muzzle).add(new THREE.Vector3(-0.002, 0, 0));
      group.add(dev);
      parts.push({ object: dev, role: "muzzle", from: { id: muzAcc.id, label: muzAcc.id, pack: "acc" } as AssetEntry, explode: new THREE.Vector3(1.2, 0.3, 0), base: dev.position.clone() });
      muzzle = muzzle.clone().add(new THREE.Vector3(dl, 0, 0));
    } else if (spec.muzzle && muzzle && this.gen.byId.has(spec.muzzle)) {
      const accE = get(spec.muzzle);
      const acc = await this.nodes(accE, "muzzle");
      const h = accE.bounds.max[1] - accE.bounds.min[1];
      const k = THREE.MathUtils.clamp(Math.max(muzzleDiameter * 2.2, length0 * 0.04) / h, 0.05, 4);
      acc.scale.setScalar(k);
      acc.position.set(muzzle.x - accE.bounds.min[0] * k, muzzle.y - ((accE.bounds.min[1] + accE.bounds.max[1]) / 2) * k, 0);
      add(acc, "muzzle", accE, [1.2, 0.3, 0]);
      muzzle = new THREE.Vector3(acc.position.x + (accE.bounds.max[0] - accE.bounds.min[0]) * k, muzzle.y, 0);
    }

    // Variación leve del largo de las armas enteras
    const bodyStretch = spec.layout === "body" ? spec.tweaks?.body ?? 1 : 1;
    if (bodyStretch !== 1) { group.scale.x = bodyStretch; if (muzzle) muzzle.x *= bodyStretch; }
    // Estilos igualados: los modelos más gruesos que un arma real se estrechan un poco.
    const raw = new THREE.Box3().setFromObject(group);
    const thick = raw.max.z - raw.min.z, long = raw.max.x - raw.min.x;
    const maxRatio = MAX_THICKNESS[spec.type] ?? 0.1;
    if (thick / long > maxRatio) group.scale.z = Math.max(0.6, (maxRatio * long) / thick);

    // Centrar y guardar posiciones base para el despiece.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    center.z = 0; // el eje del arma (cañón, mira) está en z = 0: así al apuntar la mira queda centrada
    const length = box.max.x - box.min.x;
    for (const p of parts) { p.object.position.sub(center); p.base.copy(p.object.position); p.explode.multiplyScalar(length * 0.18); }
    const muzzleOut = (muzzle ?? new THREE.Vector3(box.max.x, center.y, 0)).clone().sub(center);
    group.updateMatrixWorld(true);
    const handles = this.handles(spec, parts, new THREE.Box3().setFromObject(group));
    return { group, parts, length, muzzle: muzzleOut, sightY: sight === null ? null : sight - center.y, zoom, handles };
  }

  /** Estima dónde agarran las manos: empuñadura (junta o detrás del cargador), guardamanos, pozo y palanca. */
  private handles(spec: WeaponSpec, parts: AssembledPart[], box: THREE.Box3) {
    const center = box.getCenter(new THREE.Vector3());
    const L = box.max.x - box.min.x, H = box.max.y - box.min.y;
    const part = (role: PartRole) => parts.find((p) => p.role === role);
    const boxOf = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
    const handgun = spec.type === "pistol" || spec.type === "revolver";
    const mag = part("magazine"); const magBox = mag ? boxOf(mag.object) : null;
    let grip: THREE.Vector3;
    const gp = part("grip") ?? part("frame");
    if (gp) { const b = boxOf(gp.object); grip = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - (b.max.y - b.min.y) * 0.35, 0); }
    else if (handgun && magBox) grip = new THREE.Vector3((magBox.min.x + magBox.max.x) / 2, magBox.max.y - (magBox.max.y - magBox.min.y) * 0.3, 0);
    else if (magBox) grip = new THREE.Vector3(magBox.min.x - L * 0.09, box.min.y + H * 0.32, 0);
    else grip = new THREE.Vector3(box.min.x + L * (handgun ? 0.35 : 0.38), box.min.y + H * 0.3, 0);
    const fp = part("pump") ?? part("front");
    const fb = fp ? boxOf(fp.object) : null;
    const support = handgun ? grip.clone().add(new THREE.Vector3(0.01, -0.01, 0))
      : fb ? new THREE.Vector3(fb.min.x + (fb.max.x - fb.min.x) * 0.35, fb.min.y + (fb.max.y - fb.min.y) * 0.15, 0)
      : new THREE.Vector3(box.min.x + L * 0.68, center.y - H * 0.05, 0);
    const magwell = magBox ? new THREE.Vector3((magBox.min.x + magBox.max.x) / 2, magBox.min.y + (magBox.max.y - magBox.min.y) * 0.2, 0) : grip.clone().add(new THREE.Vector3(L * 0.1, -H * 0.1, 0));
    const charge = new THREE.Vector3(handgun ? box.min.x + L * 0.25 : box.min.x + L * 0.5, box.max.y - H * 0.15, 0);
    return { grip, support, magwell, charge };
  }
}

/** Despiece del kit (dirección en la que se separa cada pieza) y qué piezas llevan el color principal o el secundario. */
const KIT_EXPLODE: Partial<Record<string, [number, number, number]>> = {
  receiver: [0, 0, 0], barrel: [1.5, 0, 0], front: [1, 0.25, 0], stock: [-1.2, 0, 0], grip: [-0.2, -1, 0], magazine: [0, -1.2, 0], muzzle: [2, 0.3, 0],
  scope: [0, 1.4, 0], sight: [0, 1, 0], trigger: [0, -0.7, 0], charging: [-0.5, 0.8, 0], slide: [0, 1, 0], pump: [0.8, -0.7, 0], device: [0.6, -1.1, 0],
};
const KIT_PRIMARY = new Set(["receiver", "front", "slide", "pump"]);
const KIT_SECONDARY = new Set(["stock", "grip", "device"]);

/** Grosor máximo (ancho / largo) según el tipo, como en armas reales. */
const MAX_THICKNESS: Partial<Record<string, number>> = { pistol: 0.17, revolver: 0.2, smg: 0.12, rifle: 0.08, bullpup: 0.1, shotgun: 0.075, sniper: 0.075, lmg: 0.11, launcher: 0.16, flamethrower: 0.16 };

/**
 * Acabado común a todos los packs, para que convivan: colores poco saturados y en el rango de tonos
 * de un arma real (acero, polímero, madera). El metal refleja el entorno; plásticos y madera, poco.
 */
function finish(src: THREE.Material): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial || /Lens|Glass/i.test(m.name)) return m;
  const wood = /Wood|Handle/i.test(m.name);
  if (!m.map) {
    const hsl = { h: 0, s: 0, l: 0 }; m.color.getHSL(hsl);
    m.color.setHSL(hsl.h, hsl.s * (wood ? 0.6 : 0.3), THREE.MathUtils.clamp(hsl.l, 0.02, wood ? 0.3 : 0.24));
  }
  if (/Wood|Handle/i.test(m.name)) { m.metalness = 0.0; m.roughness = 0.75; }
  else if (/Polymer|Plastic|Black2/i.test(m.name)) { m.metalness = 0.15; m.roughness = 0.6; }
  else { m.metalness = Math.max(m.metalness, 0.6); m.roughness = Math.min(m.roughness, 0.45); }
  m.envMapIntensity = 0.9;
  return m;
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

const isWood = (m: THREE.Material) => /Wood|Handle|Brown/i.test(m.name);
/** Iguala el color de los materiales no de madera de `objs` al color medio de los de `ref`. */
function unifyFinish(ref: THREE.Object3D, objs: THREE.Object3D[]) {
  const mats = (o: THREE.Object3D) => { const out: THREE.MeshStandardMaterial[] = []; o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) out.push(...([] as THREE.Material[]).concat(m.material) as THREE.MeshStandardMaterial[]); }); return out; };
  const base = mats(ref).filter((m) => !isWood(m) && m.color);
  if (!base.length) return;
  const avg = new THREE.Color(0, 0, 0); for (const m of base) avg.add(m.color); avg.multiplyScalar(1 / base.length);
  for (const o of objs) for (const m of mats(o)) if (!isWood(m) && m.color && !m.map) {
    // Conserva un poco el contraste propio (metal más claro o más oscuro) pero en el tono del cajón
    const l = m.color.getHSL({ h: 0, s: 0, l: 0 }).l, la = avg.getHSL({ h: 0, s: 0, l: 0 }).l;
    m.color.copy(avg).multiplyScalar(THREE.MathUtils.clamp(0.75 + (l - la) * 1.5, 0.6, 1.4));
  }
}

/** Pinta una pieza con el color principal o el secundario del acabado (las texturas de paleta se tiñen). */
function paint(obj: THREE.Object3D, spec: WeaponSpec, which: "primary" | "secondary" = "primary") {
  const c = which === "secondary" ? spec.paint.secondary ?? spec.paint.color : spec.paint.color;
  if (!c) return;
  const tint = new THREE.Color().setRGB(...c, THREE.SRGBColorSpace);
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (mat.map) mat.color.copy(new THREE.Color(1, 1, 1).lerp(tint, 0.3));
      else if (/Wood|Handle/i.test(mat.name)) continue;
      else mat.color.lerp(tint, 0.7);
    }
  });
}

/** Convierte un glTF JSON con buffer en base64 en un .glb binario. */
function jsonToGlb(json: { buffers?: { uri?: string; byteLength: number }[] }): ArrayBuffer {
  let bin = new Uint8Array(0);
  const uri = json.buffers?.[0]?.uri;
  if (uri?.startsWith("data:")) {
    const raw = atob(uri.slice(uri.indexOf(",") + 1));
    bin = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bin[i] = raw.charCodeAt(i);
    delete json.buffers![0].uri;
  }
  const pad = (n: number) => (n + 3) & ~3;
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jLen = pad(jsonBytes.length), bLen = pad(bin.length);
  const out = new Uint8Array(12 + 8 + jLen + (bin.length ? 8 + bLen : 0));
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jLen, true); dv.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20, 20 + jLen); out.set(jsonBytes, 20);
  if (bin.length) { const o = 20 + jLen; dv.setUint32(o, bLen, true); dv.setUint32(o + 4, 0x004e4942, true); out.set(bin, o + 8); }
  jsonBytes = new Uint8Array(0);
  return out.buffer;
}
