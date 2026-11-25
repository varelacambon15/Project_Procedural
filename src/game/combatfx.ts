// Efectos de combate en Three.js: fogonazo, casquillos, trazadoras, impactos, humo y FX de elemento.
// Todo sale de pools acotados (fxpool.ts): ni una luz real nueva (las 8 de la escena son fijas),
// geometrías y materiales compartidos, una sola malla por efecto cuando es posible.
import * as THREE from "three";
import { settings, type Quality } from "./settings";
import { Pool, fxCaps, impactColor, type FxCaps, type ImpactMaterial } from "./fxpool";

export type FlashKind = "normal" | "suppressed" | "shotgun" | "fire" | "electric";
export type CasingKind = "small" | "big" | "shell";

// ---------- Texturas (se crean una sola vez, ya en el navegador) ----------
interface FxTextures { glow: THREE.Texture; star: THREE.Texture; smoke: THREE.Texture; mark: THREE.Texture }
let TEXTURES: FxTextures | null = null;
function textures(): FxTextures {
  if (TEXTURES) return TEXTURES;
  const make = (n: number, draw: (g: CanvasRenderingContext2D, n: number) => void) => {
    const c = document.createElement("canvas"); c.width = c.height = n;
    draw(c.getContext("2d")!, n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    return t;
  };
  TEXTURES = {
    glow: make(64, (g, n) => {
      const r = n / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
      grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.35, "rgba(255,255,255,0.7)"); grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd; g.fillRect(0, 0, n, n);
    }),
    star: make(64, (g, n) => {
      const r = n / 2, grd = g.createRadialGradient(r, r, 0, r, r, r * 0.85);
      grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.25, "rgba(255,244,210,0.95)"); grd.addColorStop(1, "rgba(255,180,80,0)");
      g.fillStyle = grd; g.fillRect(0, 0, n, n);
      g.fillStyle = "rgba(255,250,230,0.9)";
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.15, long = i % 2 ? r * 0.6 : r * 0.98, w = i % 2 ? 0.1 : 0.16;
        g.beginPath(); g.moveTo(r, r);
        g.lineTo(r + Math.cos(a - w) * long, r + Math.sin(a - w) * long);
        g.lineTo(r + Math.cos(a + w) * long, r + Math.sin(a + w) * long);
        g.closePath(); g.fill();
      }
    }),
    smoke: make(64, (g, n) => {
      const r = n / 2, grd = g.createRadialGradient(r, r, 0, r, r, r);
      grd.addColorStop(0, "rgba(210,214,218,0.55)"); grd.addColorStop(0.5, "rgba(170,176,182,0.28)"); grd.addColorStop(1, "rgba(150,156,162,0)");
      g.fillStyle = grd; g.fillRect(0, 0, n, n);
    }),
    mark: make(32, (g) => {
      g.fillStyle = "rgba(12,14,16,0.9)"; g.fillRect(7, 7, 18, 18);
      g.strokeStyle = "rgba(143,230,236,0.95)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(16, 3); g.lineTo(16, 13); g.moveTo(16, 19); g.lineTo(16, 29); g.moveTo(3, 16); g.lineTo(13, 16); g.moveTo(19, 16); g.lineTo(29, 16); g.stroke();
    }),
  };
  return TEXTURES;
}

/** Une geometrías (posición + uv + índice) en una sola malla: dos planos cruzados = una llamada de dibujo. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let off = 0;
  for (const g of parts) {
    const p = g.attributes.position.array as ArrayLike<number>, u = g.attributes.uv.array as ArrayLike<number>, ix = g.index!.array;
    for (let i = 0; i < p.length; i++) pos.push(p[i]);
    for (let i = 0; i < u.length; i++) uv.push(u[i]);
    for (let i = 0; i < ix.length; i++) idx.push(ix[i] + off);
    off += g.attributes.position.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

const FLASH_GEO = (() => { const a = new THREE.PlaneGeometry(1, 1), b = new THREE.PlaneGeometry(1, 1); b.rotateY(Math.PI / 2); return merge([a, b]); })();
const PLANE_GEO = new THREE.PlaneGeometry(1, 1);
const SPARK_GEO = new THREE.BoxGeometry(0.012, 0.012, 0.012);
const ROD_GEO = new THREE.CylinderGeometry(0.008, 0.008, 1, 6, 1, true);
const BEAM_GEO = new THREE.CylinderGeometry(0.022, 0.022, 1, 8, 1, true);
const CASING_GEO: Record<CasingKind, THREE.CylinderGeometry> = {
  small: new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 6),
  big: new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6),
  shell: new THREE.CylinderGeometry(0.0095, 0.0095, 0.065, 8),
};
const BRASS = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.85, roughness: 0.3 });
const SHELL = new THREE.MeshStandardMaterial({ color: 0xa02a1e, roughness: 0.6 });
const FLASH_COLOR: Record<FlashKind, number> = { normal: 0xffd9a0, suppressed: 0x93a9a6, shotgun: 0xffb268, fire: 0xff8a3a, electric: 0xa6eaff };
const FLASH_SIZE: Record<FlashKind, number> = { normal: 0.13, suppressed: 0.055, shotgun: 0.22, fire: 0.16, electric: 0.14 };

export interface Timed { t: number; max: number }
interface FlashItem extends Timed { mesh: THREE.Mesh; base: number }
interface CasingItem extends Timed { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3 }
interface RodItem extends Timed { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; from: THREE.Vector3; to: THREE.Vector3 }
interface PartItem extends Timed { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; vel: THREE.Vector3; base: number; grow: number; spin: number }
interface MarkItem extends Timed { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }

const YAXIS = new THREE.Vector3(0, 1, 0);

/** Ajusta una malla tipo varilla entre dos puntos (trazadora o haz). */
function rod(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  const d = to.clone().sub(from), len = Math.max(0.001, d.length());
  mesh.position.copy(from).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(YAXIS, d.normalize());
  mesh.scale.y = len;
}

export class CombatFx {
  caps: FxCaps;
  private quality: Quality;
  private scene: THREE.Scene;
  private flashPool!: Pool<FlashItem>;
  private casingPool!: Pool<CasingItem>;
  private tracerPool!: Pool<RodItem>;
  private beamPool!: Pool<RodItem>;
  private sparkPool!: Pool<PartItem>;
  private emberPool!: Pool<PartItem>;
  private flamePool!: Pool<PartItem>;
  private smokePool!: Pool<PartItem>;
  private chargePool!: Pool<PartItem>;
  private decalPool!: Pool<MarkItem>;
  private flashMats: Record<FlashKind, THREE.MeshBasicMaterial>;

  constructor(scene: THREE.Scene, quality: Quality = settings.quality) {
    this.scene = scene; this.quality = quality; this.caps = fxCaps(quality);
    const T = textures(); void T;
    this.flashMats = {} as Record<FlashKind, THREE.MeshBasicMaterial>;
    for (const k of Object.keys(FLASH_COLOR) as FlashKind[]) this.flashMats[k] = new THREE.MeshBasicMaterial({ map: T.star, color: FLASH_COLOR[k], transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.buildPools();
  }

  private basic(color: number, additive = true, map: THREE.Texture | null = null) {
    return new THREE.MeshBasicMaterial({ color, map, transparent: true, opacity: 1, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  }
  /** Crea una malla oculta en la escena (las ranuras se reutilizan; nunca se añaden luces). */
  private add(geo: THREE.BufferGeometry, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat); m.visible = false; m.renderOrder = 12; this.scene.add(m); return m;
  }

  private buildPools() {
    const C = this.caps, T = textures();
    this.flashPool = new Pool(C.muzzle, () => {
      const mesh = this.add(FLASH_GEO, this.flashMats.normal);
      return { mesh, t: 0, max: 0.04, base: FLASH_SIZE.normal };
    });
    this.casingPool = new Pool(C.casing, () => {
      const mesh = this.add(CASING_GEO.small, BRASS);
      return { mesh, t: 0, max: 2.5, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    });
    this.tracerPool = new Pool(C.tracer, () => {
      const mat = this.basic(0xffffff), mesh = this.add(ROD_GEO, mat);
      return { mesh, mat, t: 0, max: 0.06, from: new THREE.Vector3(), to: new THREE.Vector3() };
    });
    this.beamPool = new Pool(C.beam, () => {
      const mat = this.basic(0x8fd8ff), mesh = this.add(BEAM_GEO, mat);
      return { mesh, mat, t: 0, max: 0.12, from: new THREE.Vector3(), to: new THREE.Vector3() };
    });
    const partPool = (cap: number, geo: THREE.BufferGeometry, color: number, map: THREE.Texture | null, additive: boolean) => new Pool<PartItem>(cap, () => {
      const mat = this.basic(color, additive, map), mesh = this.add(geo, mat);
      return { mesh, mat, t: 0, max: 0.4, vel: new THREE.Vector3(), base: 1, grow: 0, spin: 0 };
    });
    this.sparkPool = partPool(C.spark, SPARK_GEO, 0xcff6f8, null, true);
    this.emberPool = partPool(C.ember, SPARK_GEO, 0xffa04a, null, true);
    this.flamePool = partPool(C.flame, PLANE_GEO, 0xff8a3a, T.glow, true);
    this.smokePool = partPool(C.smoke, PLANE_GEO, 0xffffff, T.smoke, false);
    this.chargePool = partPool(C.charge, PLANE_GEO, 0x8fd8ff, T.glow, true);
    this.decalPool = new Pool(C.decal, () => {
      const mat = this.basic(0xffffff, false, T.mark), mesh = this.add(PLANE_GEO, mat);
      return { mesh, mat, t: 0, max: 15 };
    });
  }

  /** Cambia la calidad en caliente (menú de ajustes): se rehacen los pools con los nuevos topes. */
  setQuality(q: Quality) {
    if (q === this.quality) return;
    this.clearPools();
    this.quality = q; this.caps = fxCaps(q); this.buildPools();
  }
  private clearPools() {
    for (const p of this.allPools()) p.forEach((v) => {
      const item = v as { mesh?: THREE.Mesh; mat?: THREE.Material };
      if (item.mesh) this.scene.remove(item.mesh);
      if (item.mat) item.mat.dispose(); // materiales por ranura; las geometrías son compartidas
    });
    for (const p of this.allPools()) p.releaseAll();
  }
  private allPools(): Pool<unknown>[] {
    return [this.flashPool, this.casingPool, this.tracerPool, this.beamPool, this.sparkPool, this.emberPool, this.flamePool, this.smokePool, this.chargePool, this.decalPool] as unknown as Pool<unknown>[];
  }

  // ---------- Fogón de boca ----------
  muzzleFlash(at: THREE.Vector3, kind: FlashKind = "normal", life = 0.04) {
    const it = this.flashPool.acquire(); if (!it) return;
    it.max = life; it.t = life; it.base = FLASH_SIZE[kind];
    it.mesh.material = this.flashMats[kind];
    it.mesh.position.copy(at);
    it.mesh.rotation.set(0, 0, Math.random() * Math.PI * 2);
    it.mesh.scale.setScalar(it.base);
    it.mesh.visible = true;
  }

  // ---------- Casquillos (rebote y desaparición) ----------
  casing(at: THREE.Vector3, vel: THREE.Vector3, kind: CasingKind = "small", spin = 18) {
    const it = this.casingPool.acquire(); if (!it) return;
    it.mesh.geometry = CASING_GEO[kind]; it.mesh.material = kind === "shell" ? SHELL : BRASS;
    it.mesh.position.copy(at); it.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    it.vel.copy(vel); it.spin.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
    it.t = it.max = 2.5; it.mesh.visible = true;
  }

  // ---------- Trazadora corta ----------
  tracer(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation = 0xffe9c0, life = 0.045) {
    const it = this.tracerPool.acquire(); if (!it) return;
    it.from.copy(from); it.to.copy(to); it.t = it.max = life;
    it.mat.color.set(color); it.mat.opacity = 1; rod(it.mesh, from, to); it.mesh.visible = true;
  }

  /** Haz continuo de energía: se refresca cada fotograma mientras se dispara (varias ranuras se solapan). */
  beam(from: THREE.Vector3, to: THREE.Vector3, color = 0x8fd8ff, life = 0.12) {
    const it = this.beamPool.acquire(); if (!it) return;
    it.from.copy(from); it.to.copy(to); it.t = it.max = life;
    it.mat.color.setHex(color); it.mat.opacity = 0.9; rod(it.mesh, from, to); it.mesh.visible = true;
  }

  /** Carga previa al disparo de energía: un núcleo que crece y brilla en la boca. */
  charge(at: THREE.Vector3, color = 0x8fd8ff, life = 0.14) {
    const it = this.chargePool.acquire(); if (!it) return;
    it.mesh.position.copy(at); it.mat.color.setHex(color); it.mat.opacity = 0.85;
    it.base = 0.03; it.grow = 0.34; it.t = it.max = life; it.mesh.scale.setScalar(it.base); it.mesh.visible = true;
  }

  // ---------- Impactos por material ----------
  /** Chispas (metal) / polvo (hormigón) / píxeles (carne) + marca pegada con tope. */
  impact(at: THREE.Vector3, normal: THREE.Vector3, material: ImpactMaterial, opts: { count?: number; crit?: boolean; decal?: boolean; color?: number } = {}) {
    const n = opts.count ?? (material === "metal" ? 7 : material === "flesh" ? 6 : 5);
    for (let i = 0; i < n; i++) {
      const it = this.sparkPool.acquire(); if (!it) break;
      const col = opts.color ?? impactColor(material);
      it.mat.color.setHex(col); it.mat.opacity = 1;
      it.mesh.position.copy(at);
      const speed = material === "metal" ? 2.5 : 1.5;
      it.vel.copy(normal).multiplyScalar(0.7 + Math.random() * speed).add(new THREE.Vector3((Math.random() - 0.5) * 1.8, Math.random() * (material === "metal" ? 1.8 : 1.1), (Math.random() - 0.5) * 1.8));
      it.base = material === "flesh" ? 1.6 : material === "metal" ? 0.8 : 1.1;
      it.grow = 0; it.spin = 0; it.t = it.max = 0.3 + Math.random() * 0.25;
      it.mesh.scale.setScalar(it.base); it.mesh.visible = true;
    }
    if (opts.decal !== false) this.mark(at, normal, opts.crit ? 1.4 : 1);
  }

  /** Marca de impacto pegada a la superficie (pool con tope; se desvanece a los 15 s). */
  mark(at: THREE.Vector3, normal: THREE.Vector3, scale = 1) {
    const it = this.decalPool.acquire(); if (!it) return;
    it.mesh.position.copy(at).addScaledVector(normal, 0.004);
    it.mesh.lookAt(at.clone().add(normal)); it.mesh.rotateZ(Math.random() * 0.5);
    it.mesh.scale.setScalar(0.075 * scale);
    it.mat.opacity = 0.9; it.t = it.max = 15; it.mesh.visible = true;
  }

  /** Humo fino que sale de la boca tras una ráfaga larga. */
  smoke(at: THREE.Vector3) {
    const it = this.smokePool.acquire(); if (!it) return;
    it.mesh.position.copy(at); it.mat.opacity = 0.4;
    it.vel.set((Math.random() - 0.5) * 0.12, 0.22 + Math.random() * 0.18, (Math.random() - 0.5) * 0.12);
    it.base = 0.05; it.grow = 0.42; it.spin = 0.5; it.t = it.max = 0.8 + Math.random() * 0.5;
    it.mesh.scale.setScalar(it.base); it.mesh.visible = true;
  }

  /** Fuego: llamas aditivas que suben y brasas que se apagan (elemento fuego ya existente). */
  fire(at: THREE.Vector3, dir: THREE.Vector3, count = 5) {
    for (let i = 0; i < count; i++) {
      const it = this.flamePool.acquire(); if (!it) break;
      it.mesh.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12));
      it.mat.color.setHex(Math.random() < 0.5 ? 0xff7a2a : 0xffc25a); it.mat.opacity = 0.9;
      it.vel.copy(dir).multiplyScalar(0.6 + Math.random()).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, 1.2 + Math.random() * 1.4, (Math.random() - 0.5) * 0.7));
      it.base = 0.12 + Math.random() * 0.14; it.grow = 0.35; it.spin = 2; it.t = it.max = 0.28 + Math.random() * 0.3;
      it.mesh.scale.setScalar(it.base); it.mesh.visible = true;
      const em = this.emberPool.acquire(); if (!em) continue;
      em.mat.color.setHex(0xffb050); em.mat.opacity = 1; em.mesh.position.copy(it.mesh.position);
      em.vel.copy(it.vel).multiplyScalar(1.4); em.base = 0.7 + Math.random(); em.grow = 0; em.spin = 0;
      em.t = em.max = 0.35 + Math.random() * 0.4; em.mesh.scale.setScalar(em.base); em.mesh.visible = true;
    }
  }

  /** Explosión corta (sin luz): bola aditiva que se expande muy rápido. */
  blast(at: THREE.Vector3, color = 0xffb060, size = 0.5) {
    const it = this.flamePool.acquire(); if (!it) return;
    it.mat.color.setHex(color); it.mat.opacity = 1; it.mesh.position.copy(at);
    it.vel.set(0, 0, 0); it.base = size * 0.4; it.grow = size * 2.4; it.spin = 0;
    it.t = it.max = 0.28; it.mesh.scale.setScalar(it.base); it.mesh.visible = true;
  }

  /** Avance de todos los efectos. Devuelve al pool lo que ha terminado (sin recolocar geometrías). */
  update(dt: number) {
    this.flashPool.forEach((it) => {
      it.t -= dt; if (it.t <= 0) { it.mesh.visible = false; this.flashPool.release(it); return; }
      it.mesh.rotation.z += dt * 26; it.mesh.scale.setScalar(it.base * (0.85 + (1 - it.t / it.max) * 0.4));
    });
    this.casingPool.forEach((it) => {
      it.t -= dt; it.vel.y -= 9.8 * dt; it.mesh.position.addScaledVector(it.vel, dt);
      it.mesh.rotation.x += it.spin.x * dt; it.mesh.rotation.y += it.spin.y * dt; it.mesh.rotation.z += it.spin.z * dt;
      if (it.mesh.position.y < 0.012) { it.mesh.position.y = 0.012; it.vel.multiplyScalar(0.35); it.vel.y = Math.abs(it.vel.y) * 0.5; it.spin.multiplyScalar(0.5); }
      if (it.t <= 0) { it.mesh.visible = false; this.casingPool.release(it); }
    });
    const rodTick = (pool: Pool<RodItem>, peak: number) => pool.forEach((it) => {
      it.t -= dt; if (it.t <= 0) { it.mesh.visible = false; pool.release(it); return; }
      const k = it.t / it.max; it.mat.opacity = peak * k; rod(it.mesh, it.from, it.to);
    });
    rodTick(this.tracerPool, 1); rodTick(this.beamPool, 0.9);
    const partTick = (pool: Pool<PartItem>, gravity: number, billboard: boolean) => pool.forEach((it) => {
      it.t -= dt; if (it.t <= 0) { it.mesh.visible = false; pool.release(it); return; }
      const k = it.t / it.max;
      it.vel.y -= gravity * dt; it.mesh.position.addScaledVector(it.vel, dt);
      it.mesh.scale.setScalar(it.base + it.grow * (1 - k));
      it.mat.opacity = k;
      if (it.spin) it.mesh.rotation.z += it.spin * dt;
      if (billboard) it.mesh.quaternion.copy(this.billboardQ);
    });
    partTick(this.sparkPool, 6, false);
    partTick(this.emberPool, 3, false);
    partTick(this.flamePool, -1.2, true);
    partTick(this.smokePool, -0.3, true);
    partTick(this.chargePool, 0, true);
    this.decalPool.forEach((it) => {
      it.t -= dt; if (it.t <= 0) { it.mesh.visible = false; this.decalPool.release(it); return; }
      if (it.t < 3) it.mat.opacity = 0.9 * (it.t / 3);
    });
  }

  private billboardQ = new THREE.Quaternion();
  /** La cámara se entrega desde gun.ts para orientar las sprites (sin coste por efecto). */
  setCameraQuaternion(q: THREE.Quaternion) { this.billboardQ.copy(q); }

  /** Coste aproximado: ranuras creadas (máximo de mallas vivas) y objetos ahora mismo activos. */
  stats() {
    const pools = this.allPools();
    return { quality: this.quality, slots: pools.reduce((s, p) => s + p.capacity, 0), active: pools.reduce((s, p) => s + p.size, 0) };
  }

  dispose() { this.clearPools(); }
}
