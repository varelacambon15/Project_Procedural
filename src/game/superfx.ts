// Invocación y efectos de los súperes. Un único flujo para todos: `cast(id)` reproduce la línea de tiempo de supers.json
// (manos, cámara, arma baja) y en el instante "hit" dispara el efecto del súper. Sin luces nuevas (el número de luces es
// fijo): destellos y rayos son mallas aditivas.
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
}
interface Vfx { mesh: THREE.Mesh; t: number; dur: number; r: number; kind: "ring" | "flash" | "bolt" }

const add = (color: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side });
const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), sphereGeo = new THREE.SphereGeometry(1, 20, 14), boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const COLOR: Record<SuperId, number> = { overload: 0xffd070, shockwave: 0xff9a50, storm: 0x8fd8ff };

export class SuperFx {
  private vfx: Vfx[] = [];
  /** Invocación en curso (animación de manos) y efecto activo (sobrecarga, tormenta). */
  private cast_: { id: SuperId; t: number; hit: boolean } | null = null;
  private active: { id: SuperId; t: number; next: number } | null = null;
  constructor(private scene: THREE.Scene, private hooks: SuperHooks) {}

  get casting() { return this.cast_ != null; }
  /** Segundos que quedan de efecto activo (0 si no hay). */
  get activeLeft() { return this.active ? Math.max(0, (SUPERS[this.active.id].active ?? 0) - this.active.t) : 0; }
  get activeId(): SuperId | null { return this.active?.id ?? null; }
  /** Modificadores del arma mientras la sobrecarga está activa. */
  get buff() { const o = this.active?.id === "overload" ? SUPERS.overload : null; return { dmg: o?.damage ?? 1, rate: o?.rate ?? 1, freeAmmo: !!o }; }

  cast(id: SuperId) { if (this.cast_) return false; this.cast_ = { id, t: 0, hit: false }; this.hooks.sound("cast"); return true; }
  /** Corta la invocación (muerte, cambio de pantalla). */
  cancel() { this.cast_ = null; }

  /** Manos, cámara y arma de este fotograma, o null si no se está invocando. */
  pose(): { right: HandPose; left: HandPose; lower: number; fov: number; roll: number } | null {
    const c = this.cast_; if (!c) return null; const tl = SUPERS[c.id];
    const hp = (k: ReturnType<typeof sampleHand>): HandPose => {
      const e = new THREE.Euler(THREE.MathUtils.degToRad(k.rot[0]), THREE.MathUtils.degToRad(k.rot[1]), THREE.MathUtils.degToRad(k.rot[2]), "YXZ");
      return { pos: new THREE.Vector3(...k.pos), orient: new THREE.Quaternion().setFromEuler(e), curl: { fingers: [k.curl, k.curl, k.curl * 1.03, k.curl * 1.08], thumb: k.thumb } };
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
      if (a.id === "storm" && a.t >= a.next) { a.next += tl.interval ?? 0.3; this.strike(origin, tl.damage ?? 150, tl.range ?? 40); }
      if (a.t >= (tl.active ?? 0)) this.active = null;
    }
    for (const v of [...this.vfx]) {
      v.t += dt; const k = v.t / v.dur;
      if (v.kind === "ring") v.mesh.scale.setScalar(v.r * Math.min(1, k * 1.6));
      else if (v.kind === "flash") v.mesh.scale.setScalar(v.r * (0.4 + 0.6 * Math.min(1, k * 2)));
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k) * (v.kind === "bolt" ? (Math.random() > 0.3 ? 1 : 0.4) : 1);
      if (k >= 1) { this.scene.remove(v.mesh); (v.mesh.material as THREE.Material).dispose(); this.vfx.splice(this.vfx.indexOf(v), 1); }
    }
  }

  private spawn(mesh: THREE.Mesh, at: THREE.Vector3, dur: number, r: number, kind: Vfx["kind"]) { mesh.position.copy(at); this.scene.add(mesh); this.vfx.push({ mesh, t: 0, dur, r, kind }); }

  private trigger(id: SuperId, o: THREE.Vector3) {
    const tl = SUPERS[id], at = o.clone().setY(0.05);
    if (id === "shockwave") {
      const r = tl.radius ?? 14;
      this.spawn(new THREE.Mesh(ringGeo, add(COLOR[id])), at, 0.6, r, "ring");
      this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), at, 0.45, r * 0.7, "ring");
      this.spawn(new THREE.Mesh(sphereGeo, add(COLOR[id])), o.clone().setY(0.6), 0.35, r * 0.35, "flash");
      for (const d of this.hooks.dummies()) {
        if (!d.alive) continue;
        const c = d.center, dist = Math.max(0, Math.hypot(c.x - o.x, c.z - o.z) - 0.3 * (d.kind.scale ?? 1)), dmg = falloff({ damage: tl.damage ?? 400, radius: r }, dist);
        if (dmg > 0) { this.hooks.onHit(d, c, dmg, "explosive"); d.push(c.clone().sub(o).setY(0).normalize(), 2.2 * (1 - dist / r) + 0.6); }
      }
      this.hooks.shake(0.5); this.hooks.sound("boom");
    } else if (id === "overload") {
      this.spawn(new THREE.Mesh(sphereGeo, add(COLOR[id], THREE.BackSide)), o.clone().setY(1.4), 0.45, 3.2, "flash");
      this.active = { id, t: 0, next: 0 }; this.hooks.shake(0.25); this.hooks.sound("boom");
    } else {
      this.active = { id, t: 0, next: 0 }; this.hooks.shake(0.2);
    }
  }

  /** Rayo del cielo sobre un enemigo al azar (de los cercanos); daño eléctrico. */
  private strike(o: THREE.Vector3, dmg: number, range: number) {
    const list = this.hooks.dummies().filter((d) => d.alive && d.center.distanceTo(o) < range);
    if (!list.length) return;
    const d = list[Math.floor(Math.random() * list.length)], p = d.group.position.clone(), top = p.clone().setY(34);
    const mid = top.clone().lerp(p, 0.5), len = top.distanceTo(p);
    const m = new THREE.Mesh(boltGeo, add(COLOR.storm)); m.scale.set(0.09, len, 0.09); this.spawn(m, mid, 0.18, 1, "bolt");
    this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), p.clone().setY(0.4), 0.2, 1.6, "flash");
    this.hooks.onHit(d, d.center, dmg, "electrico"); this.hooks.sound("zap");
    for (const e of this.hooks.dummies()) if (e !== d && e.alive && e.center.distanceTo(d.center) < 3.5) this.hooks.onHit(e, e.center, dmg * 0.5, "electrico"); // salta a los vecinos
  }
}
