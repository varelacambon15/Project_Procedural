// Muñecos de tiro con forma humana: capas de escudo / armadura / vida, estados elementales,
// barras de vida flotantes, números de daño y reaparición.
import * as THREE from "three";
import { t } from "../i18n";

export type Element = "fuego" | "corrosivo" | "electrico" | "radiacion" | null;
export type Zone = "head" | "body" | "limb";
interface Kind { key: string; shield: number; armor: number; health: number; level: number; scale?: number; boss?: boolean }
export const KINDS: Record<string, Kind> = {
  basic: { key: "basic", shield: 0, armor: 0, health: 300, level: 10 },
  armored: { key: "armored", shield: 0, armor: 350, health: 300, level: 12 },
  shielded: { key: "shielded", shield: 350, armor: 0, health: 300, level: 12 },
  elite: { key: "elite", shield: 400, armor: 400, health: 500, level: 15, scale: 1.08 },
  boss: { key: "boss", shield: 1500, armor: 2500, health: 4000, level: 20, scale: 1.7, boss: true },
};

const ELEMENT_COLOR: Record<string, string> = { fuego: "#f07a2a", corrosivo: "#9bd23c", electrico: "#5cc8f0", radiacion: "#d8e04a" };
/** Multiplicador de daño según elemento y capa (escudo, armadura, carne). */
function layerMult(el: Element, layer: "shield" | "armor" | "health") {
  if (el === "electrico") return layer === "shield" ? 1.75 : layer === "armor" ? 0.8 : 1;
  if (el === "corrosivo") return layer === "armor" ? 1.75 : layer === "shield" ? 0.8 : 1;
  if (el === "fuego") return layer === "health" ? 1.5 : 0.75;
  if (el === "radiacion") return 1.1;
  return 1;
}

const skin = new THREE.MeshStandardMaterial({ color: 0xc98c55, roughness: 0.75 });
const skinDark = new THREE.MeshStandardMaterial({ color: 0xa96f3f, roughness: 0.8 });
const vest = new THREE.MeshStandardMaterial({ color: 0x4d5440, roughness: 0.7, metalness: 0.2 });
const plate = new THREE.MeshStandardMaterial({ color: 0x6e6f6a, roughness: 0.4, metalness: 0.7 });
const standMat = new THREE.MeshStandardMaterial({ color: 0x2b2d30, roughness: 0.5, metalness: 0.7 });
const shieldMat = new THREE.MeshStandardMaterial({ color: 0x59b8ff, emissive: 0x2a7fd4, emissiveIntensity: 0.8, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });

export class Dummy {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly hitboxes: THREE.Mesh[] = [];
  shield: number; armor: number; health: number;
  readonly max: { shield: number; armor: number; health: number };
  alive = true;
  private deadT = 0;
  private sinceHit = 99;
  private bubble: THREE.Mesh | null = null;
  private flash = 0;
  burning = 0; irradiated = 0; shocked = 0; corroded = 0;
  private dotTick = 0;
  readonly bar: HTMLDivElement;
  private path: { a: THREE.Vector3; b: THREE.Vector3; speed: number; t: number } | null = null;

  constructor(readonly kind: Kind, readonly id: string, pos: THREE.Vector3, overlay: HTMLElement, onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void) {
    this.onDamage = onDamage;
    this.max = { shield: kind.shield, armor: kind.armor, health: kind.health };
    this.shield = kind.shield; this.armor = kind.armor; this.health = kind.health;
    this.group.position.copy(pos);
    const s = kind.scale ?? 1;
    this.body.scale.setScalar(s);
    this.group.add(this.body);
    this.build(kind);
    this.bar = document.createElement("div");
    this.bar.className = "hpbar" + (kind.boss ? " boss" : "");
    this.bar.innerHTML = `<div class="hpname"><b>${kind.level}</b> <span class="nm">${t(`dummy.${kind.key}`)}</span></div><div class="hptrack">${kind.shield ? '<i class="sh"></i>' : ""}${kind.armor ? '<i class="ar"></i>' : ""}<i class="hp"></i></div>`;
    (kind.boss ? document.getElementById("bossbar")! : overlay).appendChild(this.bar);
  }
  private onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void;

  /** Vuelve a escribir el nombre (al cambiar de idioma). */
  relabel() { this.bar.querySelector(".nm")!.textContent = t(`dummy.${this.kind.key}`); }

  /** Recorrido de ida y vuelta (blancos móviles). */
  setPath(a: THREE.Vector3, b: THREE.Vector3, speed: number) { this.path = { a, b, speed, t: Math.random() }; }

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, zone: Zone | null) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    this.body.add(m);
    if (zone) { m.userData = { dummy: this, zone }; this.hitboxes.push(m); }
    return m;
  }

  private build(kind: Kind) {
    // Soporte
    this.part(new THREE.CylinderGeometry(0.35, 0.42, 0.08, 16), standMat, 0, 0.04, 0, null);
    this.part(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), standMat, 0, 0.3, 0, null);
    // Cuerpo humano esquemático
    const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
    this.part(cap(0.085, 0.62), skin, -0.11, 0.98, 0, "limb");
    this.part(cap(0.085, 0.62), skin, 0.11, 0.98, 0, "limb");
    this.part(new THREE.BoxGeometry(0.36, 0.2, 0.2), skinDark, 0, 1.38, 0, "body");
    this.part(cap(0.19, 0.38), skin, 0, 1.68, 0, "body").scale.set(1.15, 1, 0.75);
    const armL = this.part(cap(0.065, 0.5), skin, -0.3, 1.58, 0, "limb"); armL.rotation.z = 0.18;
    const armR = this.part(cap(0.065, 0.5), skin, 0.3, 1.58, 0, "limb"); armR.rotation.z = -0.18;
    this.part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skinDark, 0, 1.98, 0, "body");
    this.part(new THREE.SphereGeometry(0.13, 16, 12), skin, 0, 2.13, 0, "head").scale.set(1, 1.12, 1.02);
    // Diana dibujada en el pecho
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.position.set(0, 1.7, 0.145); this.body.add(ring);
    if (kind.armor) {
      this.part(new THREE.BoxGeometry(0.46, 0.48, 0.34), vest, 0, 1.68, 0, "body");
      this.part(new THREE.BoxGeometry(0.32, 0.3, 0.04), plate, 0, 1.72, 0.18, "body");
      this.part(new THREE.SphereGeometry(0.15, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate, 0, 2.17, 0, "head");
    }
    if (kind.shield) {
      this.bubble = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 16), shieldMat.clone());
      this.bubble.position.y = 1.35; this.bubble.scale.set(0.85, 1.25, 0.7); this.body.add(this.bubble);
    }
  }

  get center() { return this.group.localToWorld(new THREE.Vector3(0, 1.5 * (this.kind.scale ?? 1), 0)); }

  /** Aplica daño atravesando capas. Devuelve el daño total infligido. */
  damage(amount: number, element: Element, crit: boolean, at: THREE.Vector3, silent = false): number {
    if (!this.alive) return 0;
    this.sinceHit = 0; this.flash = 0.08;
    let left = amount, dealt = 0, color = crit ? "#ffd84a" : "#ffffff";
    const take = (layer: "shield" | "armor" | "health") => {
      if (left <= 0 || this[layer] <= 0) return;
      const mult = layerMult(element, layer) * (layer === "armor" && this.corroded > 0 ? 1.25 : 1);
      const dmg = Math.min(this[layer], left * mult);
      this[layer] -= dmg; dealt += dmg; left -= dmg / mult;
      if (layer === "shield") color = crit ? "#9fdcff" : "#6cc4ff";
      else if (layer === "armor" && color !== "#9fdcff") color = crit ? "#ffe08a" : "#f0c24a";
    };
    take("shield"); take("armor"); take("health");
    if (element) color = ELEMENT_COLOR[element];
    if (!silent || dealt > 0) this.onDamage(this, dealt, color, crit, at);
    if (this.health <= 0) this.die();
    return dealt;
  }

  /** Aplica un estado elemental (daño continuo). */
  applyStatus(el: Element, power: number) {
    if (el === "fuego") this.burning = 3;
    if (el === "radiacion") this.irradiated = 4;
    if (el === "electrico") this.shocked = 2;
    if (el === "corrosivo") this.corroded = 4;
    this.statusPower = Math.max(this.statusPower, power);
  }
  private statusPower = 0;

  private die() {
    this.alive = false; this.deadT = 0;
    this.burning = this.irradiated = this.shocked = this.corroded = 0;
  }

  update(dt: number, camera: THREE.Camera, viewW: number, viewH: number) {
    // Movimiento de los blancos móviles
    if (this.path && this.alive) {
      this.path.t += dt * this.path.speed / this.path.a.distanceTo(this.path.b);
      const k = 0.5 - 0.5 * Math.cos(this.path.t * Math.PI);
      this.group.position.lerpVectors(this.path.a, this.path.b, k);
    }
    // Daño por estado (cada 0,5 s)
    this.dotTick += dt;
    if (this.alive && this.dotTick >= 0.5) {
      this.dotTick = 0;
      const dot = this.statusPower * 0.35;
      if (this.burning > 0) this.damage(dot, "fuego", false, this.center);
      if (this.irradiated > 0) this.damage(dot * 0.8, "radiacion", false, this.center);
      if (this.shocked > 0) this.damage(dot * 0.6, "electrico", false, this.center);
      if (this.corroded > 0) this.damage(dot * 0.5, "corrosivo", false, this.center);
    }
    this.burning = Math.max(0, this.burning - dt); this.irradiated = Math.max(0, this.irradiated - dt);
    this.shocked = Math.max(0, this.shocked - dt); this.corroded = Math.max(0, this.corroded - dt);
    if (this.burning + this.irradiated + this.shocked + this.corroded === 0) this.statusPower = 0;

    // Regeneración del escudo tras 3 s sin recibir daño
    this.sinceHit += dt;
    if (this.alive && this.max.shield && this.sinceHit > 3) this.shield = Math.min(this.max.shield, this.shield + this.max.shield * 0.3 * dt);
    if (this.bubble) { (this.bubble.material as THREE.MeshStandardMaterial).opacity = this.shield > 0 ? 0.1 + (this.flash > 0 ? 0.35 : 0) : 0; this.bubble.visible = this.shield > 0; }
    this.flash = Math.max(0, this.flash - dt);
    this.body.position.x = this.flash > 0 ? (Math.random() - 0.5) * 0.03 : 0;

    // Caída y reaparición
    if (!this.alive) {
      this.deadT += dt;
      if (this.deadT < 0.5) this.body.rotation.x = -(this.deadT / 0.5) * 1.45;
      else if (this.deadT > 3.2 && this.deadT < 4) this.body.rotation.x = -1.45 * (1 - (this.deadT - 3.2) / 0.8);
      else if (this.deadT >= 4) { this.alive = true; this.body.rotation.x = 0; this.shield = this.max.shield; this.armor = this.max.armor; this.health = this.max.health; }
    }

    // Barra de vida
    const b = this.bar;
    const total = (v: number, m: number) => (m ? `${Math.max(0, (v / m) * 100)}%` : "0");
    const [sh, ar, hp] = [b.querySelector<HTMLElement>(".sh"), b.querySelector<HTMLElement>(".ar"), b.querySelector<HTMLElement>(".hp")!];
    if (sh) sh.style.width = total(this.shield, this.max.shield);
    if (ar) ar.style.width = total(this.armor, this.max.armor);
    hp.style.width = total(this.health, this.max.health);
    b.classList.toggle("status-fire", this.burning > 0); b.classList.toggle("status-shock", this.shocked > 0);
    b.classList.toggle("status-acid", this.corroded > 0); b.classList.toggle("status-rad", this.irradiated > 0);
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
  add("basic", lanes[0], -10); add("basic", lanes[1], -15); add("armored", lanes[2], -25);
  add("shielded", lanes[3], -25); add("elite", lanes[4], -35); add("basic", lanes[5], -50);
  add("armored", lanes[0], -40); add("shielded", lanes[5], -18);
  add("basic", 0, -20).setPath(new THREE.Vector3(-14, 0, -20), new THREE.Vector3(14, 0, -20), 3);
  add("elite", 0, -42).setPath(new THREE.Vector3(12, 0, -42), new THREE.Vector3(-12, 0, -42), 2.2);
  add("boss", 0, -56);
  return list;
}
