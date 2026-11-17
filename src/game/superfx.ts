// Invocación y efectos de los súperes. Un único flujo para todos: `cast(id)` reproduce la línea de tiempo de supers.json
// (manos, cámara, arma baja) y en el instante "hit" dispara el efecto del súper. Sin luces nuevas (el número de luces es
// fijo): destellos, rayos, anillos y misiles son mallas aditivas.
import * as THREE from "three";
import type { Dummy, Element } from "./dummies";
import type { HandPose } from "./arms";
import { SUPERS, sampleHand, track, type SuperId } from "./supers";
import { falloff } from "./grenades";

export interface SuperHooks {
  dummies(): Dummy[];
  onHit(d: Dummy, point: THREE.Vector3, dmg: number, element: Element): void;
  shake(n: number): void;
  sound(kind: "cast" | "boom" | "zap"): void;
  /** Punto del suelo al que mira el jugador (hasta `max` m). */
  aim?(max: number): THREE.Vector3;
  /** Cura al jugador por completo (Égida). */
  heal?(): void;
}
type VfxKind = "ring" | "flash" | "bolt" | "mark" | "beam" | "spin";
interface Vfx { mesh: THREE.Mesh; t: number; dur: number; r: number; kind: VfxKind }
interface Missile { mesh: THREE.Mesh; v: THREE.Vector3; target: Dummy | null; t: number; delay: number }

const add = (color: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side });
const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), sphereGeo = new THREE.SphereGeometry(1, 20, 14), boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), missileGeo = new THREE.SphereGeometry(0.12, 8, 6);
const COLOR: Record<SuperId, number> = {
  overload: 0xffd070, shockwave: 0xff9a50, storm: 0x8fd8ff, inferno: 0xff5a1e, stasis: 0x9fe8ff, orbital: 0xffe2a0,
  seekers: 0xff7ad0, aegis: 0x7affc8, deadeye: 0xff4050, vortex: 0xa070ff,
};
/** Súperes con efecto que dura (el medidor no carga y no se puede volver a invocar mientras). */
const LASTING = new Set<SuperId>(["overload", "storm", "stasis", "orbital", "aegis", "deadeye", "vortex"]);

export class SuperFx {
  private vfx: Vfx[] = [];
  private missiles: Missile[] = [];
  /** Invocación en curso (animación de manos) y efecto activo. */
  private cast_: { id: SuperId; t: number; hit: boolean } | null = null;
  private active: { id: SuperId; t: number; next: number; at: THREE.Vector3 } | null = null;
  /** Multiplicadores del árbol de habilidades: daño de los súperes y duración de los efectos. */
  power = 1; span = 1;
  constructor(private scene: THREE.Scene, private hooks: SuperHooks) {}

  get casting() { return this.cast_ != null; }
  private dur(id: SuperId) { const a = SUPERS[id].active ?? 0; return id === "orbital" || id === "vortex" ? a : a * this.span; }
  /** Segundos que quedan de efecto activo (0 si no hay). */
  get activeLeft() { return this.active ? Math.max(0, this.dur(this.active.id) - this.active.t) : 0; }
  get activeTotal() { return this.active ? this.dur(this.active.id) : 1; }
  get activeId(): SuperId | null { return this.active?.id ?? null; }
  /** ¿Hay misiles en vuelo? (no se puede volver a invocar hasta que acaben). */
  get busy() { return this.active != null || this.missiles.length > 0; }
  /** Modificadores del arma (Sobrecarga, Ojo letal). */
  get buff() {
    const id = this.active?.id;
    if (id === "overload") return { dmg: SUPERS.overload.damage ?? 1, rate: SUPERS.overload.rate ?? 1, freeAmmo: true, crit: false, critMult: 1 };
    if (id === "deadeye") return { dmg: SUPERS.deadeye.damage ?? 1, rate: 1, freeAmmo: false, crit: true, critMult: SUPERS.deadeye.crit ?? 1 };
    return { dmg: 1, rate: 1, freeAmmo: false, crit: false, critMult: 1 };
  }
  /** Fracción del daño que recibe el jugador (Égida). */
  get guard() { return this.active?.id === "aegis" ? SUPERS.aegis.guard ?? 1 : 1; }

  cast(id: SuperId) { if (this.cast_ || this.busy) return false; this.cast_ = { id, t: 0, hit: false }; this.hooks.sound("cast"); return true; }
  /** Corta la invocación (muerte, cambio de pantalla). */
  cancel() { this.cast_ = null; }

  /** Manos, cámara y arma de este fotograma, o null si no se está invocando. */
  pose(): { right: HandPose; left: HandPose; lower: number; fov: number; roll: number } | null {
    const c = this.cast_; if (!c) return null; const tl = SUPERS[c.id];
    const hp = (k: ReturnType<typeof sampleHand>): HandPose => {
      const e = new THREE.Euler(THREE.MathUtils.degToRad(k.rot[0]), THREE.MathUtils.degToRad(k.rot[1]), THREE.MathUtils.degToRad(k.rot[2]), "YXZ");
      return { pos: new THREE.Vector3(...k.pos), orient: new THREE.Quaternion().setFromEuler(e), curl: { fingers: [k.index ?? k.curl, k.curl, k.curl * 1.03, k.curl * 1.08], thumb: k.thumb } };
    };
    return { right: hp(sampleHand(tl.right, c.t)), left: hp(sampleHand(tl.left, c.t)), lower: track(tl.lower, c.t), fov: track(tl.fov, c.t), roll: track(tl.roll, c.t) };
  }

  update(dt: number, origin: THREE.Vector3) {
    const c = this.cast_;
    if (c) {
      c.t += dt; const tl = SUPERS[c.id];
      if (!c.hit && c.t >= tl.hit) { c.hit = true; this.trigger(c.id, origin); }
      if (c.t >= tl.duration) this.cast_ = null;
    }
    const a = this.active;
    if (a) {
      a.t += dt; const tl = SUPERS[a.id];
      if (a.id === "storm" && a.t >= a.next) { a.next += tl.interval ?? 0.3; this.strike(origin, (tl.damage ?? 150) * this.power, tl.range ?? 40); }
      if (a.id === "vortex") this.vortexTick(a, dt);
      if (a.id === "aegis" && a.t >= a.next) { a.next += 0.5; this.spawn(new THREE.Mesh(ringGeo, add(COLOR.aegis)), origin.clone().setY(0.05), 0.5, 1.6, "ring"); }
      if (a.t >= this.dur(a.id)) {
        if (a.id === "orbital") this.orbitalBlast(a.at);
        if (a.id === "vortex") this.vortexCollapse(a.at);
        this.active = null;
      }
    }
    this.updateMissiles(dt);
    for (const v of [...this.vfx]) {
      v.t += dt; const k = v.t / v.dur;
      if (v.kind === "ring") v.mesh.scale.setScalar(v.r * Math.min(1, k * 1.6));
      else if (v.kind === "flash") v.mesh.scale.setScalar(v.r * (0.4 + 0.6 * Math.min(1, k * 2)));
      else if (v.kind === "spin") { v.mesh.rotation.y += dt * 5; v.mesh.scale.setScalar(v.r * (0.85 + 0.15 * Math.sin(v.t * 9))); }
      else if (v.kind === "beam") v.mesh.scale.x = v.mesh.scale.z = v.r * (1 - k * 0.7);
      const fade = v.kind === "mark" || v.kind === "spin" ? Math.min(1, (1 - k) * 5) : 1 - k;
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * fade * (v.kind === "bolt" ? (Math.random() > 0.3 ? 1 : 0.4) : 1);
      if (k >= 1) { this.scene.remove(v.mesh); (v.mesh.material as THREE.Material).dispose(); this.vfx.splice(this.vfx.indexOf(v), 1); }
    }
  }

  private spawn(mesh: THREE.Mesh, at: THREE.Vector3, dur: number, r: number, kind: VfxKind) {
    mesh.position.copy(at); if (kind === "mark" || kind === "spin") mesh.scale.setScalar(r);
    this.scene.add(mesh); this.vfx.push({ mesh, t: 0, dur, r, kind }); return mesh;
  }
  private alive() { return this.hooks.dummies().filter((d) => d.alive); }
  /** Explosión en el suelo: daño con caída por distancia y empuje hacia fuera. */
  private blast(o: THREE.Vector3, dmg: number, r: number, element: Element, push = 1) {
    for (const d of this.alive()) {
      const c = d.center, dist = Math.max(0, Math.hypot(c.x - o.x, c.z - o.z) - 0.3 * (d.kind.scale ?? 1)), hit = falloff({ damage: dmg, radius: r }, dist);
      if (hit > 0) { this.hooks.onHit(d, c, hit, element); if (push) d.push(c.clone().sub(o).setY(0).normalize(), (2.2 * (1 - dist / r) + 0.6) * push); }
    }
  }
  private aimAt(max: number, o: THREE.Vector3) { return this.hooks.aim?.(max) ?? o.clone(); }

  private trigger(id: SuperId, o: THREE.Vector3) {
    const tl = SUPERS[id], at = o.clone().setY(0.05), col = COLOR[id];
    if (LASTING.has(id)) this.active = { id, t: 0, next: 0, at: at.clone() };
    switch (id) {
      case "shockwave": {
        const r = tl.radius ?? 14;
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.6, r, "ring");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), at, 0.45, r * 0.7, "ring");
        this.spawn(new THREE.Mesh(sphereGeo, add(col)), o.clone().setY(0.6), 0.35, r * 0.35, "flash");
        this.blast(o, (tl.damage ?? 400) * this.power, r, "explosive", 1);
        this.hooks.shake(0.5); this.hooks.sound("boom"); break;
      }
      case "overload":
        this.spawn(new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)), o.clone().setY(1.4), 0.45, 3.2, "flash");
        this.hooks.shake(0.25); this.hooks.sound("boom"); break;
      case "storm": this.hooks.shake(0.2); break;
      case "inferno": {
        // Anillo de fuego que se abre desde el jugador: daño de fuego (las víctimas arden unos segundos)
        const r = tl.radius ?? 12;
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.75, r, "ring");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffb040)), at, 0.55, r * 0.8, "ring");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffe080)), at, 0.4, r * 0.55, "ring");
        this.spawn(new THREE.Mesh(sphereGeo, add(col)), o.clone().setY(0.5), 0.4, 2.4, "flash");
        this.blast(o, (tl.damage ?? 350) * this.power, r, "fuego", 0.5);
        this.hooks.shake(0.35); this.hooks.sound("boom"); break;
      }
      case "stasis": {
        // Onda helada: congela a los enemigos cercanos y los deja vulnerables
        const r = tl.radius ?? 22, sec = this.dur(id);
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.8, r, "ring");
        this.spawn(new THREE.Mesh(sphereGeo, add(0xdff8ff, THREE.BackSide)), o.clone().setY(1.2), 0.5, 2.6, "flash");
        for (const d of this.alive()) {
          if (d.center.distanceTo(o) > r) continue;
          d.freeze(sec, tl.vuln ?? 1.3);
          this.spawn(new THREE.Mesh(discGeo, add(col)), d.group.position.clone().setY(0.04), sec, 0.9 * (d.kind.scale ?? 1), "mark");
          this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), d.center, 0.25, 0.7 * (d.kind.scale ?? 1), "flash");
        }
        this.hooks.shake(0.2); this.hooks.sound("zap"); break;
      }
      case "orbital": {
        // Marca en el suelo donde se mira; al acabar la cuenta atrás cae el rayo
        const p = this.aimAt(tl.range ?? 60, o).setY(0.05); this.active!.at = p;
        const r = tl.radius ?? 7;
        this.spawn(new THREE.Mesh(discGeo, add(col)), p, this.dur(id), r, "mark");
        this.spawn(new THREE.Mesh(ringGeo, add(0xff6040)), p.clone().setY(0.07), this.dur(id), r, "mark");
        this.spawn(new THREE.Mesh(boltGeo, add(col)), p.clone().setY(30), this.dur(id), 0.08, "mark").scale.set(0.08, 60, 0.08);
        break;
      }
      case "seekers": {
        // Misiles que salen hacia arriba y buscan a los enemigos más cercanos (repartidos entre ellos)
        const list = this.alive().filter((d) => d.center.distanceTo(o) < (tl.range ?? 60)).sort((x, y) => x.center.distanceTo(o) - y.center.distanceTo(o)).slice(0, 6);
        const n = tl.count ?? 10;
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(missileGeo, add(col)); m.add(new THREE.Mesh(missileGeo, add(0xffffff))); m.children[0].scale.setScalar(0.5);
          m.position.copy(o).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.6, (Math.random() - 0.5) * 0.8)); this.scene.add(m);
          const a = (i / n) * Math.PI * 2;
          this.missiles.push({ mesh: m, v: new THREE.Vector3(Math.cos(a) * 3, 9 + Math.random() * 3, Math.sin(a) * 3), target: list.length ? list[i % list.length] : null, t: 0, delay: i * 0.06 });
        }
        this.hooks.sound("cast"); break;
      }
      case "aegis":
        this.hooks.heal?.();
        this.spawn(new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)), o.clone().setY(1.3), 0.55, 3, "flash");
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.6, 5, "ring");
        this.hooks.shake(0.15); this.hooks.sound("zap"); break;
      case "deadeye":
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.45, 4, "ring");
        this.hooks.sound("zap"); break;
      case "vortex": {
        const p = this.aimAt(tl.range ?? 24, o).setY(1.2); this.active!.at = p;
        this.spawn(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x080210, transparent: true, opacity: 0.9 })), p, this.dur(id), 1.1, "spin");
        this.spawn(new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)), p, this.dur(id), 1.7, "spin");
        this.spawn(new THREE.Mesh(discGeo, add(col)), p.clone().setY(0.05), this.dur(id), tl.pull ?? 16, "mark");
        this.hooks.sound("zap"); break;
      }
    }
  }

  private vortexTick(a: NonNullable<SuperFx["active"]>, dt: number) {
    const tl = SUPERS.vortex, pull = tl.pull ?? 16;
    for (const d of this.alive()) {
      const dist = Math.hypot(d.group.position.x - a.at.x, d.group.position.z - a.at.z);
      if (dist < pull) d.drag(a.at, dt * (2 + 8 * (1 - dist / pull)) * (d.kind.boss ? 0.3 : 1));
    }
    if (a.t >= a.next) {
      a.next += tl.interval ?? 0.25;
      for (const d of this.alive()) if (d.center.distanceTo(a.at) < 5) this.hooks.onHit(d, d.center, (tl.tick ?? 40) * this.power, null);
      if (Math.random() < 0.6) this.spawn(new THREE.Mesh(ringGeo, add(COLOR.vortex)), a.at.clone().setY(0.06), 0.3, (tl.pull ?? 16) * 0.5, "ring");
    }
  }
  private vortexCollapse(p: THREE.Vector3) {
    const tl = SUPERS.vortex, r = tl.radius ?? 8;
    this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), p, 0.3, r * 0.5, "flash");
    this.spawn(new THREE.Mesh(ringGeo, add(COLOR.vortex)), p.clone().setY(0.06), 0.5, r, "ring");
    this.blast(p, (tl.damage ?? 700) * this.power, r, "explosive", 1.2);
    this.hooks.shake(0.4); this.hooks.sound("boom");
  }
  private orbitalBlast(p: THREE.Vector3) {
    const tl = SUPERS.orbital, r = tl.radius ?? 7;
    this.spawn(new THREE.Mesh(boltGeo, add(COLOR.orbital)), p.clone().setY(30), 0.7, r * 0.45, "beam").scale.y = 60;
    this.spawn(new THREE.Mesh(boltGeo, add(0xffffff)), p.clone().setY(30), 0.45, r * 0.2, "beam").scale.y = 60;
    this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.orbital)), p.clone().setY(0.5), 0.5, r * 0.7, "flash");
    this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), p, 0.7, r * 1.4, "ring");
    this.blast(p, (tl.damage ?? 1100) * this.power, r, "explosive", 1.5);
    this.hooks.shake(0.7); this.hooks.sound("boom");
  }
  private updateMissiles(dt: number) {
    const tl = SUPERS.seekers;
    for (const m of [...this.missiles]) {
      if (m.delay > 0) { m.delay -= dt; continue; }
      m.t += dt;
      if (!m.target?.alive) m.target = this.alive().sort((x, y) => x.center.distanceToSquared(m.mesh.position) - y.center.distanceToSquared(m.mesh.position))[0] ?? null;
      if (m.t > 0.35 && m.target) { const want = m.target.center.sub(m.mesh.position).normalize().multiplyScalar(26); m.v.lerp(want, Math.min(1, dt * 5)); }
      else m.v.y -= 6 * dt;
      m.mesh.position.addScaledVector(m.v, dt);
      if (Math.random() < 0.5) this.spawn(new THREE.Mesh(missileGeo, add(COLOR.seekers)), m.mesh.position.clone(), 0.25, 0.8, "flash");
      const hit = m.target && m.target.center.distanceTo(m.mesh.position) < 0.7 * (m.target.kind.scale ?? 1);
      if (hit || m.mesh.position.y < 0.05 || m.t > 4) {
        const p = m.mesh.position.clone();
        this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.seekers)), p, 0.3, (tl.radius ?? 3) * 0.5, "flash");
        this.blast(p, (tl.damage ?? 240) * this.power, tl.radius ?? 3, "explosive", 0.4);
        this.scene.remove(m.mesh); this.missiles.splice(this.missiles.indexOf(m), 1);
        this.hooks.shake(0.08); this.hooks.sound("boom");
      }
    }
  }

  /** Rayo del cielo sobre un enemigo al azar (de los cercanos); daño eléctrico. */
  private strike(o: THREE.Vector3, dmg: number, range: number) {
    const list = this.alive().filter((d) => d.center.distanceTo(o) < range);
    if (!list.length) return;
    const d = list[Math.floor(Math.random() * list.length)], p = d.group.position.clone(), top = p.clone().setY(34);
    const mid = top.clone().lerp(p, 0.5), len = top.distanceTo(p);
    const m = new THREE.Mesh(boltGeo, add(COLOR.storm)); m.scale.set(0.09, len, 0.09); this.spawn(m, mid, 0.18, 1, "bolt");
    this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), p.clone().setY(0.4), 0.2, 1.6, "flash");
    this.hooks.onHit(d, d.center, dmg, "electrico"); this.hooks.sound("zap");
    for (const e of this.alive()) if (e !== d && e.center.distanceTo(d.center) < 3.5) this.hooks.onHit(e, e.center, dmg * 0.5, "electrico"); // salta a los vecinos
  }
}
