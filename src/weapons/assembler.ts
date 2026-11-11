// Monta en 3D un arma generada: carga los .glb de cada pieza y las coloca en sus puntos de anclaje.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AssetEntry, PartRole, WeaponSpec } from "./types";
import { jointScale, type WeaponGenerator } from "./generator";
import { accessory, buildMuzzle, buildOptic } from "./accessories";

export interface AssembledPart { object: THREE.Object3D; role: PartRole; from: AssetEntry; explode: THREE.Vector3; base: THREE.Vector3 }
export interface AssembledWeapon {
  group: THREE.Group; parts: AssembledPart[]; length: number;
  /** Punta del cañón (o del accesorio de boca), en coordenadas del grupo. */ muzzle: THREE.Vector3;
  /** Altura de la línea de mira (centro de la mira, si la lleva), en coordenadas del grupo. */ sightY: number | null;
  /** Aumentos de la mira (1 = sin mira). */ zoom: number;
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
    const first = get(spec.parts[0].from);
    const length0 = first.bounds.max[0] - first.bounds.min[0];
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
      if (spec.layout === "modular-long") {
        // Cajón en el origen; culata, guardamanos y empuñadura (de otras armas de la familia) en sus juntas.
        const J = bodyE.joints!;
        const recv = await this.nodes(bodyE, "receiver");
        add(recv, "receiver", bodyE, [0, 0, 0]); paint(recv, spec);
        const thick = (bodyE.bounds.max[2] - bodyE.bounds.min[2]);
        const attach = async (role: "stock" | "front" | "grip", joint: "rear" | "front" | "grip", face: "stockFace" | "frontFace" | "gripFace", explode: [number, number, number]) => {
          const donor = get(spec.parts.find((p) => p.role === role)!.from);
          const node = await this.nodes(donor, role);
          const k = donor === bodyE ? 1 : THREE.MathUtils.clamp(jointScale(bodyE, donor, joint), 0.6, 1.6);
          node.scale.setScalar(k);
          node.position.copy(v3(J[joint].pos).sub(v3(donor.joints![face].pos).multiplyScalar(k)));
          add(node, role, donor, explode); paint(node, spec);
          return { donor, k, node };
        };
        await attach("stock", "rear", "stockFace", [-1.2, 0, 0]);
        const fr = await attach("front", "front", "frontFace", [1.1, 0.2, 0]);
        await attach("grip", "grip", "gripFace", [0, -1, 0]);
        // Remates de unión: un anillo de acero en el guardamanos y una placa en la culata, para que no se vea el corte
        for (const [j, w] of [["front", 0.012], ["rear", 0.008]] as const) {
          const h = J[j].size![0];
          const collar = new THREE.Mesh(new THREE.BoxGeometry(w, h * 1.06, thick * 0.92), new THREE.MeshStandardMaterial({ name: "Steel", color: 0x1e1f21, metalness: 0.75, roughness: 0.4 }));
          collar.position.set(J[j].pos[0], J[j].pos[1], 0);
          recv.add(collar);
        }
        if (fr.donor.sockets.muzzle) {
          const m = fr.donor.sockets.muzzle;
          muzzle = v3(m.pos).multiplyScalar(fr.k).add(fr.node.position);
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
    let sight: number | null = null, zoom = 1;

    // Mira: la propia del arma o una de otra arma/accesorio, apoyada en el socket "optic" o en la parte superior.
    const optAcc = accessory(spec.optic);
    if (optAcc && opticTarget) {
      // Mira propia, generada a medida del raíl
      const { group: opt, sightHeight } = buildOptic(optAcc.id, opticLength, length0);
      opt.position.copy(opticTarget).add(new THREE.Vector3(0, -0.002, 0));
      group.add(opt);
      parts.push({ object: opt, role: "scope", from: { id: optAcc.id, label: optAcc.id, pack: "acc" } as AssetEntry, explode: new THREE.Vector3(0, 1.4, 0), base: opt.position.clone() });
      sight = opticTarget.y + sightHeight; zoom = optAcc.zoom ?? 1;
    } else if (spec.optic && opticTarget) {
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
    if (muzAcc && muzzle) {
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

    // Estilos igualados: los modelos más gruesos que un arma real se estrechan un poco.
    const raw = new THREE.Box3().setFromObject(group);
    const thick = raw.max.z - raw.min.z, long = raw.max.x - raw.min.x;
    const maxRatio = MAX_THICKNESS[spec.type] ?? 0.1;
    if (thick / long > maxRatio) group.scale.z = Math.max(0.6, (maxRatio * long) / thick);

    // Centrar y guardar posiciones base para el despiece.
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const length = box.max.x - box.min.x;
    for (const p of parts) { p.object.position.sub(center); p.base.copy(p.object.position); p.explode.multiplyScalar(length * 0.18); }
    const muzzleOut = (muzzle ?? new THREE.Vector3(box.max.x, center.y, 0)).clone().sub(center);
    return { group, parts, length, muzzle: muzzleOut, sightY: sight === null ? null : sight - center.y, zoom };
  }
}

/** Grosor máximo (ancho / largo) según el tipo, como en armas reales. */
const MAX_THICKNESS: Partial<Record<string, number>> = { pistol: 0.17, revolver: 0.2, smg: 0.12, rifle: 0.08, bullpup: 0.1, shotgun: 0.075, sniper: 0.075, lmg: 0.11, launcher: 0.16, flamethrower: 0.16 };

/**
 * Acabado común a todos los packs, para que convivan: colores poco saturados y en el rango de tonos
 * de un arma real (acero, polímero, madera). El metal refleja el entorno; plásticos y madera, poco.
 */
function finish(src: THREE.Material): THREE.Material {
  const m = src.clone() as THREE.MeshStandardMaterial;
  if (!m.isMeshStandardMaterial) return m;
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

/** Pinta las piezas principales con la pintura del arma (las texturas de paleta se tiñen). */
function paint(obj: THREE.Object3D, spec: WeaponSpec) {
  if (!spec.paint.color) return;
  const tint = new THREE.Color().setRGB(...spec.paint.color, THREE.SRGBColorSpace);
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
