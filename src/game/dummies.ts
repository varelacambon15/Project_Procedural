// Muñecos de tiro con forma humana: vida, estados (quemadura, aturdimiento), barras de vida flotantes,
// números de daño y reaparición. De momento solo tienen vida; las capas están preparadas como lista
// para añadir escudo o armadura más adelante.
import * as THREE from "three";
import { t } from "../i18n";

export type Element = "fuego" | "electrico" | "explosive" | null;
export type Zone = "head" | "body" | "limb";
/** Capa de protección. Por ahora solo existe "health". */
export interface Layer { id: "health"; value: number; max: number }
interface Kind { key: string; health: number; level: number; scale?: number; boss?: boolean }
export const KINDS: Record<string, Kind> = {
  basic: { key: "basic", health: 300, level: 10 },
  sturdy: { key: "sturdy", health: 750, level: 12, scale: 1.04 },
  elite: { key: "elite", health: 1400, level: 15, scale: 1.08 },
  boss: { key: "boss", health: 7000, level: 20, scale: 1.7, boss: true },
};

const ELEMENT_COLOR: Record<string, string> = { fuego: "#f07a2a", electrico: "#5cc8f0", explosive: "#ffb060" };
const BURN_DPS_CAP = 60; // tope de daño por segundo de la quemadura

// Maniquí de simulación: cuerpo oscuro con una rejilla de luz tenue (textura pixelada) y peana metálica
function gridTexture() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 16; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 16, 16); g.fillStyle = "#2a8a90"; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 6);
  return t;
}
const GRID = gridTexture();
const mat = (color: number, emissive = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: GRID, emissiveIntensity: emissive });
const skin = mat(0x39424b), skinDark = mat(0x2c333a, 0.4), vest = mat(0x4a4436, 0.25);
const standMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.7 });

export class Dummy {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly hitboxes: THREE.Mesh[] = [];
  readonly layers: Layer[];
  alive = true;
  private deadT = 0;
  private flash = 0;
  /** Quemadura: segundos restantes y daño por segundo (no se apila: se renueva). */
  private burnT = 0; private burnDps = 0; private burnTick = 0;
  /** Aturdimiento breve de la descarga eléctrica (no se apila). */
  private stunT = 0;
  readonly bar: HTMLDivElement;
  private clip!: THREE.Plane; private scan!: THREE.Mesh; private top = 2.4;
  private path: { a: THREE.Vector3; b: THREE.Vector3; speed: number; t: number } | null = null;
  private onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void;

  constructor(readonly kind: Kind, readonly id: string, pos: THREE.Vector3, overlay: HTMLElement, onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void) {
    this.onDamage = onDamage;
    this.layers = [{ id: "health", value: kind.health, max: kind.health }];
    this.group.position.copy(pos);
    this.body.scale.setScalar(kind.scale ?? 1);
    this.group.add(this.body);
    this.build(kind);
    // Cada muñeco usa sus propias copias de material con un plano de recorte: así se materializa y se desintegra
    // de arriba abajo con una línea de escaneo, sin afectar a los demás.
    this.top = 2.4 * (kind.scale ?? 1);
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.top);
    const cache = new Map<THREE.Material, THREE.Material>();
    this.body.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const src = m.material as THREE.Material;
      if (!cache.has(src)) { const c = src.clone(); c.clippingPlanes = [this.clip]; cache.set(src, c); }
      m.material = cache.get(src)!;
    });
    this.scan = new THREE.Mesh(new THREE.RingGeometry(0.36 * (kind.scale ?? 1), 0.42 * (kind.scale ?? 1), 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ee, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.scan.rotation.x = -Math.PI / 2; this.group.add(this.scan);
    this.bar = document.createElement("div");
    this.bar.className = "hpbar" + (kind.boss ? " boss" : "");
    this.bar.innerHTML = `<div class="hpname"><b>${kind.level}</b> <span class="nm">${t(`dummy.${kind.key}`)}</span></div><div class="hptrack"><i class="hp"></i></div>`;
    (kind.boss ? document.getElementById("bossbar")! : overlay).appendChild(this.bar);
  }

  get health() { return this.layers[this.layers.length - 1].value; }
  relabel() { this.bar.querySelector(".nm")!.textContent = t(`dummy.${this.kind.key}`); }
  setPath(a: THREE.Vector3, b: THREE.Vector3, speed: number) { this.path = { a, b, speed, t: Math.random() }; }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, zone: Zone | null) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    this.body.add(m);
    if (zone) { m.userData = { dummy: this, zone }; this.hitboxes.push(m); }
    return m;
  }

  private build(kind: Kind) {
    this.part(new THREE.CylinderGeometry(0.35, 0.42, 0.08, 16), standMat, 0, 0.04, 0, null);
    this.part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), standMat, 0, 0.3, 0, null);
    const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
    this.part(cap(0.085, 0.62), skin, -0.11, 0.98, 0, "limb");
    this.part(cap(0.085, 0.62), skin, 0.11, 0.98, 0, "limb");
    this.part(new THREE.BoxGeometry(0.36, 0.2, 0.2), skinDark, 0, 1.38, 0, "body");
    this.part(cap(0.19, 0.38), skin, 0, 1.68, 0, "body").scale.set(1.15, 1, 0.75);
    const armL = this.part(cap(0.065, 0.5), skin, -0.3, 1.58, 0, "limb"); armL.rotation.z = 0.18;
    const armR = this.part(cap(0.065, 0.5), skin, 0.3, 1.58, 0, "limb"); armR.rotation.z = -0.18;
    this.part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skinDark, 0, 1.98, 0, "body");
    this.part(new THREE.SphereGeometry(0.13, 16, 12), skin, 0, 2.13, 0, "head").scale.set(1, 1.12, 1.02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0xe8a040 }));
    ring.position.set(0, 1.7, 0.145); this.body.add(ring);
    // Los muñecos más duros llevan chaleco (solo estética: no es una capa de armadura)
    if (kind.key !== "basic") this.part(new THREE.BoxGeometry(0.46, 0.48, 0.34), vest, 0, 1.68, 0, "body");
  }

  get center() { return this.group.localToWorld(new THREE.Vector3(0, 1.5 * (this.kind.scale ?? 1), 0)); }

  /** Aplica daño a las capas, de fuera adentro (hoy, solo vida). Devuelve el daño infligido. */
  damage(amount: number, element: Element, crit: boolean, at: THREE.Vector3): number {
    if (!this.alive) return 0;
    this.flash = 0.08;
    let left = amount, dealt = 0;
    for (const layer of this.layers) { if (left <= 0) break; const d = Math.min(layer.value, left); layer.value -= d; left -= d; dealt += d; }
    const color = element ? ELEMENT_COLOR[element] : crit ? "#ffd84a" : "#ffffff";
    this.onDamage(this, dealt, color, crit, at);
    if (this.health <= 0) this.die();
    return dealt;
  }

  /** Estados: el fuego quema unos segundos (se renueva, no se apila); la descarga aturde un instante. */
  applyStatus(el: Element, hitDamage: number) {
    if (el === "fuego") { this.burnT = 3; this.burnDps = Math.min(BURN_DPS_CAP, Math.max(this.burnDps, hitDamage * 0.25)); }
    if (el === "electrico") this.stunT = Math.max(this.stunT, 0.3);
  }

  private die() { this.alive = false; this.deadT = 0; this.burnT = 0; this.stunT = 0; }

  update(dt: number, camera: THREE.Camera, viewW: number, viewH: number) {
    this.stunT = Math.max(0, this.stunT - dt);
    if (this.path && this.alive && this.stunT <= 0) {
      this.path.t += dt * this.path.speed / this.path.a.distanceTo(this.path.b);
      const k = 0.5 - 0.5 * Math.cos(this.path.t * Math.PI);
      this.group.position.lerpVectors(this.path.a, this.path.b, k);
    }
    if (this.alive && this.burnT > 0) {
      this.burnT -= dt; this.burnTick += dt;
      if (this.burnTick >= 0.5) { this.burnTick = 0; this.damage(this.burnDps * 0.5, "fuego", false, this.center); }
      if (this.burnT <= 0) this.burnDps = 0;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.body.position.x = this.flash > 0 || this.stunT > 0 ? (Math.random() - 0.5) * 0.03 : 0;
    // Escaneo: al morir se desintegra de arriba abajo; al reaparecer se compila de abajo arriba
    const wy = this.group.getWorldPosition(new THREE.Vector3()).y;
    const sm = this.scan.material as THREE.MeshBasicMaterial;
    if (!this.alive) {
      this.deadT += dt;
      let h = this.top;
      if (this.deadT < 0.7) h = this.top * (1 - this.deadT / 0.7);
      else if (this.deadT < 3.2) h = 0;
      else if (this.deadT < 4) h = this.top * ((this.deadT - 3.2) / 0.8);
      else { this.alive = true; for (const l of this.layers) l.value = l.max; }
      this.clip.constant = wy + h;
      this.scan.position.y = h; sm.opacity = h > 0.02 && h < this.top - 0.02 ? 0.9 : 0;
    } else { this.clip.constant = wy + this.top + 1; sm.opacity = 0; }
    const b = this.bar;
    const hp = this.layers[this.layers.length - 1];
    b.querySelector<HTMLElement>(".hp")!.style.width = `${Math.max(0, (hp.value / hp.max) * 100)}%`;
    b.classList.toggle("status-fire", this.burnT > 0); b.classList.toggle("status-shock", this.stunT > 0);
    if (this.kind.boss) { b.style.opacity = this.alive ? "1" : "0.4"; return; }
    const top = this.group.localToWorld(new THREE.Vector3(0, 2.45 * (this.kind.scale ?? 1), 0));
    const dist = top.distanceTo(camera.position);
    top.project(camera);
    const visible = top.z < 1 && dist < 70 && this.alive;
    b.style.display = visible ? "" : "none";
    if (visible) b.style.transform = `translate(${(top.x * 0.5 + 0.5) * viewW}px, ${(-top.y * 0.5 + 0.5) * viewH}px) translate(-50%, -100%) scale(${THREE.MathUtils.clamp(14 / dist, 0.55, 1)})`;
  }
}

/** Números de daño flotantes. */
export class DamageNumbers {
  private items: { el: HTMLDivElement; pos: THREE.Vector3; t: number; vx: number }[] = [];
  constructor(private overlay: HTMLElement) {}
  spawn(amount: number, color: string, crit: boolean, at: THREE.Vector3) {
    if (amount < 0.5) return;
    const el = document.createElement("div");
    el.className = "dmg" + (crit ? " crit" : "");
    el.textContent = String(Math.round(amount));
    el.style.color = color;
    this.overlay.appendChild(el);
    this.items.push({ el, pos: at.clone(), t: 0, vx: (Math.random() - 0.5) * 0.6 });
    if (this.items.length > 60) this.items.shift()!.el.remove();
  }
  update(dt: number, camera: THREE.Camera, w: number, h: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      it.pos.y += dt * 0.9; it.pos.x += it.vx * dt;
      const p = it.pos.clone().project(camera);
      it.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${it.t < 0.1 ? 1 + (0.1 - it.t) * 6 : 1})`;
      it.el.style.opacity = String(Math.max(0, 1 - Math.max(0, it.t - 0.6) / 0.4));
      it.el.style.display = p.z < 1 ? "" : "none";
      if (it.t > 1) { it.el.remove(); this.items.splice(i, 1); }
    }
  }
}

/** Coloca los muñecos del campo de tiro. */
export function spawnDummies(scene: THREE.Scene, lanes: number[], overlay: HTMLElement, onDamage: ConstructorParameters<typeof Dummy>[4]): Dummy[] {
  const list: Dummy[] = [];
  const add = (kind: keyof typeof KINDS, x: number, z: number) => { const d = new Dummy(KINDS[kind], `${kind}-${list.length}`, new THREE.Vector3(x, 0, z), overlay, onDamage); scene.add(d.group); list.push(d); return d; };
  add("basic", lanes[0], -10); add("basic", lanes[1], -15); add("sturdy", lanes[2], -25);
  add("basic", lanes[3], -25); add("elite", lanes[4], -35); add("basic", lanes[5], -50);
  add("sturdy", lanes[0], -40); add("basic", lanes[5], -18);
  add("basic", 0, -20).setPath(new THREE.Vector3(-14, 0, -20), new THREE.Vector3(14, 0, -20), 3);
  add("elite", 0, -42).setPath(new THREE.Vector3(12, 0, -42), new THREE.Vector3(-12, 0, -42), 2.2);
  add("boss", 0, -56);
  return list;
}
