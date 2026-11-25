// Invocación y efectos de los súperes. Un único flujo para todos: `cast(id)` reproduce la línea de tiempo de supers.json
// (manos, cámara, arma baja) y en el instante "hit" dispara el efecto del súper. Sin luces nuevas (el número de luces es
// fijo): destellos, rayos, anillos y misiles son mallas aditivas.
import * as THREE from "three";
import type { Dummy, Element } from "./dummies";
import type { HandPose } from "./arms";
import { SUPERS, sampleHand, track, type SuperId } from "./supers";
import { falloff } from "./grenades";
import { buildSentryFallback, loadSentryModel, preloadSentryModel, sentryModelNow } from "./sentrymodel";

export interface SuperHooks {
  dummies(): Dummy[];
  onHit(d: Dummy, point: THREE.Vector3, dmg: number, element: Element): void;
  shake(n: number): void;
  sound(kind: "cast" | "boom" | "zap" | "shot"): void;
  /** Punto desde el que salen los cables de la Sanguijuela (la mano). */
  hand?(): THREE.Vector3;
  /** Punto del suelo al que mira el jugador (hasta `max` m). */
  aim?(max: number): THREE.Vector3;
  /** Cura al jugador: por completo sin cantidad (Égida) o esa cantidad (Sanguijuela). */
  heal?(n?: number): void;
  /** Sonido propio de cada súper en el instante en que se desata. */
  sig?(id: SuperId): void;
  /** Hace flotar al jugador (Gravedad cero). */
  levitate?(sec: number, h: number): void;
  /** Ojo y dirección de la vista (rayo del cañón de riel, abanico de cristal, lanzamiento de la bomba). */
  view?(): { o: THREE.Vector3; dir: THREE.Vector3 };
  /** Impulso: lanza al jugador `dist` m en la dirección pulsada; da el tramo recorrido. */
  dash?(dist: number): { from: THREE.Vector3; to: THREE.Vector3 };
}
type VfxKind = "ring" | "flash" | "bolt" | "mark" | "beam" | "spin";
interface Vfx { mesh: THREE.Mesh; t: number; dur: number; r: number; kind: VfxKind }
interface Missile { mesh: THREE.Mesh; v: THREE.Vector3; target: Dummy | null; t: number; delay: number }
/** Estado de animación de la torreta centinela (vive en `sentry.userData.sentry`). */
interface SentryState {
  /** Segundos desde que se plantó (despliegue de ~0,4 s). */ deploy: number;
  /** Altura del suelo donde se plantó (para la elevación breve del despliegue). */ groundY: number;
  barrels: THREE.Object3D[]; barrelBase: THREE.Vector3[]; barrelNext: number;
  antenna: THREE.Object3D | null; legs: THREE.Object3D | null; legsBase: number;
}

const add = (color: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side });
const ringGeo = new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2), sphereGeo = new THREE.SphereGeometry(1, 20, 14), boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
const discGeo = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), missileGeo = new THREE.SphereGeometry(0.12, 8, 6);
const shardGeo = new THREE.OctahedronGeometry(0.09, 0);
const COLOR: Record<SuperId, number> = {
  core: 0xffe070, torrent: 0xa8ecff,
  overload: 0xffd070, shockwave: 0xff9a50, storm: 0x8fd8ff, inferno: 0xff5a1e, stasis: 0x9fe8ff, orbital: 0xffe2a0,
  seekers: 0xff7ad0, aegis: 0x7affc8, deadeye: 0xff4050, vortex: 0xa070ff,
  sentry: 0x6ad8ff, zerog: 0xc0a0ff, timestop: 0xffe08a, leech: 0xd03060, decoy: 0x50f0ff,
  spirit: 0x8fe6ff, railgun: 0x7ab8ff, dash: 0x5affd8, dome: 0x7ad8ff, shards: 0xb8f4ff,
};
/** Súperes con efecto que dura (el medidor no carga y no se puede volver a invocar mientras). */
const LASTING = new Set<SuperId>(["overload", "storm", "stasis", "orbital", "aegis", "deadeye", "vortex", "sentry", "zerog", "timestop", "leech", "decoy", "dash", "dome"]);

export class SuperFx {
  private vfx: Vfx[] = [];
  private missiles: Missile[] = [];
  /** Torreta centinela y holograma señuelo (mientras dura su efecto). */ private sentry: THREE.Group | null = null; private holo: THREE.Group | null = null;
  /** Bomba espiritual: la esfera que crece sobre el jugador durante la invocación y, al lanzarla, su vuelo. */
  private orb: { core: THREE.Mesh; halo: THREE.Mesh; shell: THREE.Mesh; v: THREE.Vector3 | null; to: THREE.Vector3 | null; t: number } | null = null;
  /** Rastro del Impulso (tramo que quema). */ private trail: { from: THREE.Vector3; to: THREE.Vector3 } | null = null;

  /** Esquirlas de cristal en vuelo (atraviesan: cada una golpea una vez a cada enemigo). */
  private shardsFly: { m: THREE.Mesh; v: THREE.Vector3; left: number; hit: Set<Dummy>; dmg: number }[] = [];
  /** Invocación en curso (animación de manos) y efecto activo. */
  private cast_: { id: SuperId; t: number; hit: boolean } | null = null;
  private active: { id: SuperId; t: number; next: number; at: THREE.Vector3 } | null = null;
  /** Multiplicadores del árbol de habilidades: daño de los súperes y duración de los efectos. */
  power = 1; span = 1;
  constructor(private scene: THREE.Scene, private hooks: SuperHooks) {
    // La torreta de la super se carga en segundo plano al arrancar (si falla, queda la de cajas).
    preloadSentryModel();
  }

  get casting() { return this.cast_ != null; }
  /** Id de la invocación en curso (o null). */
  get castingId(): SuperId | null { return this.cast_?.id ?? null; }
  /** ¿Ya se ha desatado la invocación en curso? */
  get castHit() { return !!this.cast_?.hit; }
  private dur(id: SuperId) { const a = SUPERS[id].active ?? 0; return id === "orbital" || id === "vortex" || id === "zerog" || id === "timestop" ? a : a * this.span; }
  /** Velocidad del resto del mundo (Dilatación temporal: todo va más lento menos tú). */
  get timeScale() { return this.active?.id === "timestop" ? 0 : 1; }
  /** Dónde está el señuelo (los enemigos van a por él), o null. */
  get decoyPos(): THREE.Vector3 | null { return this.active?.id === "decoy" && this.holo ? this.holo.position : null; }
  /** Segundos que quedan de efecto activo (0 si no hay). */
  get activeLeft() { return this.active ? Math.max(0, this.dur(this.active.id) - this.active.t) : 0; }
  get activeTotal() { return this.active ? this.dur(this.active.id) : 1; }
  get activeId(): SuperId | null { return this.active?.id ?? null; }
  /** ¿Hay misiles en vuelo? (no se puede volver a invocar hasta que acaben). */
  get busy() { return this.active != null || this.missiles.length > 0 || this.orb != null || this.shardsFly.length > 0; }
  /** Modificadores del arma (Sobrecarga, Ojo letal). */
  get buff() {
    const id = this.active?.id;
    if (id === "overload") return { dmg: SUPERS.overload.damage ?? 1, rate: SUPERS.overload.rate ?? 1, freeAmmo: true, crit: false, critMult: 1 };
    if (id === "deadeye") return { dmg: SUPERS.deadeye.damage ?? 1, rate: 1, freeAmmo: false, crit: true, critMult: SUPERS.deadeye.crit ?? 1 };
    return { dmg: 1, rate: 1, freeAmmo: false, crit: false, critMult: 1 };
  }
  /** Fracción del daño que recibe el jugador (Égida). */
  get guard() { if (this.cast_?.id === "core" && !this.cast_.hit) return SUPERS.core.guard ?? 1; return this.active?.id === "aegis" ? SUPERS.aegis.guard ?? 1 : 1; }

  cast(id: SuperId) {
    if (this.cast_ || this.busy) return false; this.cast_ = { id, t: 0, hit: false };
    this.hooks.sound("cast"); return true; }
  /** Corta la invocación (muerte, cambio de pantalla). */
  cancel() { this.beamTick(-1); if (this.cast_?.id === "spirit" && this.orb && !this.orb.v) this.dropOrb(); this.cast_ = null; }
  /** Quita todo lo que haya activo (torreta, señuelo, misiles…): al volver de una incursión o cargar partida. */
  reset() {
    this.cast_ = null; this.active = null; this.beamTick(-1);
    for (const o of [this.sentry, this.holo]) if (o) this.scene.remove(o);
    this.sentry = this.holo = null;
    for (const m of this.missiles) this.scene.remove(m.mesh);
    this.missiles = [];
    this.dropOrb();
    for (const x of this.shardsFly) this.scene.remove(x.m); this.shardsFly = [];
  }

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
      if (c.id === "spirit" && !c.hit) this.chargeOrb(c.t, tl, origin);
      // Torrente de cristal: chorro continuo desde la palma; cristales finos que atraviesan, con dispersión del ancho de un rayo
      if (c.id === "torrent" && c.hit && c.t < tl.hit + (tl.active ?? 3)) { this.torrentAcc += dt * (tl.rate ?? 70); while (this.torrentAcc >= 1) { this.torrentAcc--; this.torrentShard(tl); } this.hooks.shake(0.05); }
      // Detonación de núcleo: la energía del entorno converge en ti mientras el traje se sobrecarga
      if (c.id === "core" && !c.hit && c.t > 0.3) {
        const k = Math.min(1, (c.t - 0.3) / (tl.hit - 0.3)), a = Math.random() * Math.PI * 2, r = 2.5 + Math.random() * 4 * (1 - k * 0.6);
        const sp = new THREE.Vector3(origin.x + Math.cos(a) * r, 0.2 + Math.random() * 2.2, origin.z + Math.sin(a) * r);
        this.spawn(new THREE.Mesh(sphereGeo, add(Math.random() < 0.6 ? COLOR.core : 0xffffff)), sp.lerp(origin.clone().setY(1.1), k * 0.7), 0.15, 0.05 + 0.08 * k, "flash");
        if (Math.random() < dt * 4) this.spawn(new THREE.Mesh(ringGeo, add(COLOR.core)), origin.clone().setY(0.05), 0.35, 1.2 + 1.5 * k, "ring");
        this.hooks.shake(0.04 + 0.1 * k);
      }
      // Cañón de riel: la carga brilla entre las manos y crece hasta el disparo
      if (c.id === "railgun" && !c.hit && c.t > 0.35 && this.hooks.hand) { const k = (c.t - 0.35) / (tl.hit - 0.35); this.spawn(new THREE.Mesh(sphereGeo, add(Math.random() < 0.5 ? COLOR.railgun : 0xffffff)), this.hooks.hand().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04)), 0.12, 0.02 + 0.06 * k, "flash"); }
      if (!c.hit && c.t >= tl.hit) { c.hit = true; this.trigger(c.id, origin); }
      if (c.id === "torrent") this.beamTick(c.hit && c.t < tl.hit + (tl.active ?? 3) ? c.t - tl.hit : -1);
      if (c.t >= tl.duration) { this.cast_ = null; this.beamTick(-1); }
    }
    const a = this.active;
    if (a) {
      a.t += dt; const tl = SUPERS[a.id];
      if (a.id === "storm" && a.t >= a.next) { a.next += tl.interval ?? 0.3; this.strike(origin, (tl.damage ?? 150) * this.power, tl.range ?? 40); }
      if (a.id === "vortex") this.vortexTick(a, dt);
      if (a.id === "aegis" && a.t >= a.next) { a.next += 0.5; this.spawn(new THREE.Mesh(ringGeo, add(COLOR.aegis)), origin.clone().setY(0.05), 0.5, 1.6, "ring"); }
      if (a.id === "sentry") this.sentryTick(a, dt);
      if (a.id === "dome") this.domeTick(a, dt);
      if (a.id === "dash" && a.t >= a.next && this.trail) { a.next += tl.interval ?? 0.25; this.trailTick(); }
      if (a.id === "leech" && a.t >= a.next) { a.next += tl.interval ?? 0.25; this.drain(origin); }
      if (a.id === "decoy" && this.holo) { this.holo.rotation.y += dt * 1.5; this.holo.children.forEach((c, i) => (((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.25 * Math.sin(a.t * 12 + i))); }
      if (a.t >= this.dur(a.id)) {
        if (a.id === "orbital") this.orbitalBlast(a.at);
        if (a.id === "vortex") this.vortexCollapse(a.at);
        if (a.id === "zerog") this.slam();
        if (a.id === "dash") this.trail = null;
        if (a.id === "sentry" && this.sentry) { this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.sentry)), this.sentry.position.clone().setY(0.8), 0.35, 1.4, "flash"); this.scene.remove(this.sentry); this.sentry = null; }
        if (a.id === "decoy" && this.holo) {
          const p = this.holo.position.clone(), r = SUPERS.decoy.radius ?? 6;
          this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.decoy)), p.clone().setY(1), 0.4, r * 0.5, "flash"); this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), p.clone().setY(0.05), 0.5, r, "ring");
          this.blast(p, (SUPERS.decoy.damage ?? 400) * this.power, r, "electrico", 1); this.scene.remove(this.holo); this.holo = null; this.hooks.sound("boom"); this.hooks.shake(0.3);
        }
        this.active = null;
      }
    }
    this.updateMissiles(dt); this.updateOrb(dt); this.updateShards(dt);
    for (const v of [...this.vfx]) {
      v.t += dt; const k = v.t / v.dur;
      if (v.kind === "ring") v.mesh.scale.setScalar(v.r * Math.min(1, k * 1.6));
      else if (v.kind === "flash") v.mesh.scale.setScalar(v.r * (0.4 + 0.6 * Math.min(1, k * 2)));
      else if (v.kind === "spin") { v.mesh.rotation.y += dt * 5; v.mesh.scale.setScalar(v.r * (0.85 + 0.15 * Math.sin(v.t * 9))); }
      else if (v.kind === "beam") v.mesh.scale.x = v.mesh.scale.z = v.r * (1 - k * 0.7);
      const fade = v.kind === "mark" || v.kind === "spin" ? Math.min(1, (1 - k) * 5) : 1 - k;
      (v.mesh.material as THREE.MeshBasicMaterial).opacity = (v.mesh.userData.op ?? 0.8) * fade * (v.kind === "bolt" ? (Math.random() > 0.3 ? 1 : 0.4) : 1);
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
    this.hooks.sig?.(id);
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
      case "sentry": {
        // Torreta centinela: se planta delante y dispara sola al enemigo más cercano (GLB si está; si no, cajas)
        const p = this.aimAt(6, o).setY(0); const g = new THREE.Group(); g.position.copy(p);
        this.plantSentry(g, col);
        this.scene.add(g); this.sentry = g; this.spawn(new THREE.Mesh(ringGeo, add(col)), p.clone().setY(0.05), 0.5, 2, "ring");
        this.hooks.sound("zap"); break;
      }
      case "zerog": {
        // Gravedad cero: tú flotas, eliges la zona donde miras y todos los enemigos de dentro suben indefensos;
        // al acabar se estrellan contra el suelo (daño según su vida máxima)
        const r = tl.radius ?? 8, sec = this.dur(id), p = this.aimAt(tl.range ?? 32, o).setY(0.05); this.active!.at = p;
        this.spawn(new THREE.Mesh(discGeo, add(col)), p.clone(), sec, r, "mark");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), p.clone().setY(0.06), sec, r, "mark");
        for (let i = 0; i < 3; i++) this.spawn(new THREE.Mesh(ringGeo, add(col)), p.clone().setY(0.5 + i * 1.6), 0.9 + i * 0.25, r * (1 - i * 0.15), "ring");
        for (const d of this.alive()) if (Math.hypot(d.group.position.x - p.x, d.group.position.z - p.z) < r + 0.4 * (d.kind.scale ?? 1)) {
          d.lift(sec, (tl.lift ?? 4) * (d.kind.boss ? 0.5 : 1)); this.spawn(new THREE.Mesh(sphereGeo, add(col)), d.center, 0.35, 0.8 * (d.kind.scale ?? 1), "flash");
        }
        this.hooks.shake(0.25); this.hooks.sound("zap"); break;
      }
      case "timestop": { // esfera que se expande desde ti y se recoge: el mundo se detiene
        const s = new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)); this.spawn(s, o.clone().setY(1.2), 0.9, 60, "flash");
        this.spawn(new THREE.Mesh(sphereGeo, add(0x6040ff, THREE.BackSide)), o.clone().setY(1.2), 0.6, 35, "flash");
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.9, 40, "ring"); this.hooks.shake(0.3); break;
      }
      case "leech": this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.5, 6, "ring"); this.hooks.sound("zap"); break;
      case "decoy": {
        const p = this.aimAt(tl.range ?? 12, o).setY(0); const g = new THREE.Group(); g.position.copy(p);
        const m = () => new THREE.MeshBasicMaterial({ color: 0x2ad8f0, transparent: true, opacity: 0.6, depthWrite: false });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 10), m()); body.position.y = 1.05; g.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), m()); head.position.y = 1.78; g.add(head);
        for (const sx of [-0.13, 0.13]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.55, 8), m()); leg.position.set(sx, 0.28, 0); g.add(leg); }
        const ring = new THREE.Mesh(ringGeo, m()); ring.scale.setScalar(0.8); ring.position.y = 0.03; g.add(ring);
        this.scene.add(g); this.holo = g; this.spawn(new THREE.Mesh(sphereGeo, add(col)), p.clone().setY(1), 0.3, 1.2, "flash");
        this.hooks.sound("zap"); break;
      }
      case "spirit": this.launchOrb(o); break;
      case "railgun": this.railShot(o); break;
      case "dash": this.doDash(at); break;
      case "dome": {
        const r = tl.radius ?? 8; this.active!.at = o.clone().setY(0);
        const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), add(col, THREE.DoubleSide)); m.userData.op = 0.1;
        this.spawn(m, this.active!.at.clone(), this.dur(id), r, "mark");
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, this.dur(id), r, "mark");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), at, 0.6, r, "ring");
        this.hooks.sound("zap"); break;
      }
      case "shards": this.fireShards(); break;
      case "torrent": this.torrentAcc = 0; this.hooks.sound("zap"); break;
      case "core": { // la esfera crece desde el cuerpo y arrasa todo el radio
        const r = tl.radius ?? 13, c = o.clone().setY(1);
        this.spawn(new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)), c, 0.7, r, "flash");
        this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), c, 0.3, r * 0.4, "flash");
        this.spawn(new THREE.Mesh(ringGeo, add(col)), at, 0.8, r * 1.15, "ring");
        this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), at, 0.5, r * 0.8, "ring");
        this.blast(o, (tl.damage ?? 900) * this.power, r, "explosive", 1);
        this.hooks.shake(0.8); this.hooks.sound("boom"); break;
      }
      case "vortex": {
        const p = this.aimAt(tl.range ?? 24, o).setY(1.2); this.active!.at = p;
        this.spawn(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0x080210, transparent: true, opacity: 0.9 })), p, this.dur(id), 1.1, "spin");
        this.spawn(new THREE.Mesh(sphereGeo, add(col, THREE.BackSide)), p, this.dur(id), 1.7, "spin");
        this.spawn(new THREE.Mesh(discGeo, add(col)), p.clone().setY(0.05), this.dur(id), tl.pull ?? 16, "mark");
        this.hooks.sound("zap"); break;
      }
    }
  }

  // ---------- Bomba espiritual ----------
  /** Mientras se invoca (10 s): la esfera crece sobre la cabeza y la energía del entorno llega hasta ella en hilos. */
  private chargeOrb(t: number, tl: (typeof SUPERS)["spirit"], o: THREE.Vector3) {
    if (!this.orb) {
      const core = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xf2fcff, transparent: true, opacity: 0.95, toneMapped: false }));
      const halo = new THREE.Mesh(sphereGeo, add(COLOR.spirit, THREE.BackSide)), shell = new THREE.Mesh(sphereGeo, add(0x4aa8ff));
      for (const m of [core, halo, shell]) this.scene.add(m);
      this.orb = { core, halo, shell, v: null, to: null, t: 0 };
    }
    const k = Math.min(1, t / tl.hit), size = 0.15 + 3.2 * Math.pow(k, 0.8), ob = this.orb;
    // Delante y por encima del jugador (se ve crecer en la parte alta de la pantalla, sobre las manos alzadas)
    const v = this.hooks.view?.(), fwd = v ? v.dir.clone().setY(0).normalize() : new THREE.Vector3(0, 0, -1);
    const at = o.clone().addScaledVector(fwd, 5 + size * 0.8).setY(o.y + 3.2 + size * 0.75);
    ob.core.position.copy(at); ob.halo.position.copy(at); ob.shell.position.copy(at);
    ob.core.scale.setScalar(size * 0.72); ob.halo.scale.setScalar(size * (1.25 + 0.06 * Math.sin(t * 9))); ob.shell.scale.setScalar(size);
    (ob.shell.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.15 * Math.sin(t * 5);
    // Hilos de energía que llegan desde lejos (más a medida que crece)
    if (Math.random() < 0.35 + k * 0.6) {
      const a = Math.random() * Math.PI * 2, from = at.clone().add(new THREE.Vector3(Math.cos(a) * (14 + Math.random() * 12), -3 + Math.random() * 10, Math.sin(a) * (14 + Math.random() * 12)));
      this.zap(from, at, Math.random() < 0.5 ? COLOR.spirit : 0xffffff, 0.22);
    }
    if (Math.random() < 0.08) this.spawn(new THREE.Mesh(ringGeo, add(COLOR.spirit)), o.clone().setY(0.05), 0.6, 3 + k * 4, "ring");
    if (Math.random() < 0.05 + k * 0.1) this.hooks.shake(0.02 + k * 0.05);
  }
  /** Lanza la bomba hacia donde se mira: vuela despacio, dejando estela, y estalla al llegar. */
  private launchOrb(o: THREE.Vector3) {
    const tl = SUPERS.spirit; if (!this.orb) this.chargeOrb(tl.hit, tl, o);
    const ob = this.orb!, to = this.aimAt(tl.range ?? 60, o).setY(0.3), from = ob.core.position.clone();
    ob.to = to; ob.v = to.clone().sub(from).normalize().multiplyScalar(tl.rate ?? 16); ob.t = 0;
    this.hooks.shake(0.4); this.hooks.sound("boom");
  }
  private updateOrb(dt: number) {
    const ob = this.orb; if (!ob || !ob.v || !ob.to) return;
    ob.t += dt; const p = ob.core.position.addScaledVector(ob.v, dt); ob.halo.position.copy(p); ob.shell.position.copy(p);
    ob.halo.scale.setScalar(ob.shell.scale.x * (1.25 + 0.1 * Math.sin(ob.t * 20)));
    if (Math.random() < 0.7) this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.spirit)), p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2)), 0.5, 0.9, "flash");
    const near = this.alive().some((d) => d.center.distanceTo(p) < ob.shell.scale.x * 0.8);
    if (p.y <= ob.shell.scale.x * 0.6 || p.distanceTo(ob.to) < 1 || near || ob.t > 6) {
      const tl = SUPERS.spirit, r = tl.radius ?? 22, g = p.clone().setY(0.05);
      this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), p.clone(), 0.9, r * 0.55, "flash");
      this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.spirit, THREE.BackSide)), p.clone(), 1.4, r * 0.85, "flash");
      for (let i = 0; i < 4; i++) this.spawn(new THREE.Mesh(ringGeo, add(i % 2 ? 0xffffff : COLOR.spirit)), g.clone().setY(0.05 + i * 0.4), 0.9 + i * 0.35, r * (1.1 - i * 0.12), "ring");
      this.spawn(new THREE.Mesh(boltGeo, add(COLOR.spirit)), g.clone().setY(20), 1.1, r * 0.3, "beam").scale.y = 40;
      this.blast(g, (tl.damage ?? 3000) * this.power, r, "explosive", 2.2);
      this.hooks.shake(0.8); this.hooks.sound("boom"); this.hooks.sound("boom");
      this.dropOrb();
    }
  }
  private dropOrb() { if (!this.orb) return; for (const m of [this.orb.core, this.orb.halo, this.orb.shell]) this.scene.remove(m); this.orb = null; }

  // ---------- Cañón de riel ----------
  /** Haz que atraviesa todo lo que hay en la línea de la vista (daño completo a cada uno). */
  private railShot(o: THREE.Vector3) {
    const tl = SUPERS.railgun, v = this.hooks.view?.() ?? { o: o.clone().setY(1.6), dir: new THREE.Vector3(0, 0, -1) };
    const range = tl.range ?? 90, w = tl.radius ?? 1.3, from = (this.hooks.hand?.() ?? v.o.clone().addScaledVector(v.dir, 0.6)), to = v.o.clone().addScaledVector(v.dir, range);
    // (sale de las manos, algo abajo a la derecha, hacia el centro: desde la cámara se ve como un haz y no como un punto)
    const len = from.distanceTo(to), mid = from.clone().lerp(to, 0.5), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    for (const [r, c, dur] of [[0.16, COLOR.railgun, 0.7], [0.06, 0xffffff, 0.5], [0.4, 0x2050ff, 0.4]] as [number, number, number][]) {
      const m = this.spawn(new THREE.Mesh(boltGeo, add(c)), mid, dur, r, "beam"); m.scale.y = len; m.quaternion.copy(q);
    }
    for (let i = 1; i < 10; i++) { const ring = this.spawn(new THREE.Mesh(ringGeo, add(COLOR.railgun)), from.clone().lerp(to, i / 10), 0.5, 1.2 + i * 0.08, "ring"); ring.quaternion.copy(q); }
    for (const d of this.alive()) {
      const c = d.center, t = c.clone().sub(v.o).dot(v.dir); if (t < 0 || t > range) continue;
      if (v.o.clone().addScaledVector(v.dir, t).distanceTo(c) < w + 0.3 * (d.kind.scale ?? 1)) { this.hooks.onHit(d, c, (tl.damage ?? 1500) * this.power, "electrico"); d.push(v.dir.clone().setY(0).normalize(), 2.5); this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), c, 0.25, 0.9, "flash"); }
    }
    this.hooks.shake(0.5); this.hooks.sound("zap"); this.hooks.sound("boom");
  }

  // ---------- Impulso de fase ----------
  private segDist(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) { const ab = b.clone().sub(a).setY(0), ap = p.clone().sub(a).setY(0), t = Math.max(0, Math.min(1, ap.dot(ab) / Math.max(1e-6, ab.lengthSq()))); return ap.sub(ab.multiplyScalar(t)).length(); }
  private doDash(at: THREE.Vector3) {
    const tl = SUPERS.dash, seg = this.hooks.dash?.(tl.range ?? 10); if (!seg) return;
    const { from, to } = seg; this.trail = { from: from.clone().setY(0.05), to: to.clone().setY(0.05) }; void at;
    const w = tl.radius ?? 1.6, n = 12, life = this.dur("dash");
    for (let i = 0; i <= n; i++) { const p = from.clone().lerp(to, i / n).setY(0.05); this.spawn(new THREE.Mesh(discGeo, add(COLOR.dash)), p, life, 0.75, "mark"); if (i % 3 === 0) this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), p.clone().setY(0.9), 0.25, 0.6, "flash"); }
    for (const d of this.alive()) if (this.segDist(d.group.position, from, to) < w + 0.3 * (d.kind.scale ?? 1)) { this.hooks.onHit(d, d.center, (tl.damage ?? 650) * this.power, "electrico"); d.push(to.clone().sub(from).setY(0).normalize(), 2); }
    this.hooks.shake(0.25); this.hooks.sound("zap");
  }
  private trailTick() {
    const t = this.trail!, tl = SUPERS.dash;
    for (const d of this.alive()) if (this.segDist(d.group.position, t.from, t.to) < 0.9 + 0.3 * (d.kind.scale ?? 1)) this.hooks.onHit(d, d.center, (tl.tick ?? 70) * this.power, "fuego");
    if (Math.random() < 0.7) { const p = t.from.clone().lerp(t.to, Math.random()); this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.dash)), p.setY(0.3), 0.35, 0.35, "flash"); }
  }

  // ---------- Cúpula de contención ----------
  /** ¿El jugador está dentro de la cúpula activa? (los golpes de fuera no le llegan) */
  shieldsPlayer(p: THREE.Vector3) { const a = this.active; return a?.id === "dome" && Math.hypot(p.x - a.at.x, p.z - a.at.z) < (SUPERS.dome.radius ?? 8); }
  private domeTick(a: NonNullable<SuperFx["active"]>, dt: number) {
    const r = SUPERS.dome.radius ?? 8, slow = SUPERS.dome.slow ?? 0.45;
    for (const d of this.alive()) { const dist = Math.hypot(d.group.position.x - a.at.x, d.group.position.z - a.at.z); if (Math.abs(dist - r) < 1.2) d.drag(d.group.position.clone().add(d.group.position.clone().sub(a.at).setY(0).normalize()), dt * (1 - slow) * 3); }
  }

  // ---------- Torrente de cristal ----------
  private torrentAcc = 0;
  /** Rayo amarillo que envuelve el chorro: un cono abierto que se ensancha desde la palma, con núcleo blanco y bola en la mano. */
  private beam: THREE.Group | null = null;
  private beamTick(t: number) {
    if (t < 0) { if (this.beam) { this.scene.remove(this.beam); this.beam.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); this.beam = null; } return; }
    const v = this.hooks.view?.(); if (!v) return; const tl = SUPERS.torrent, len = tl.range ?? 40, rad = (tl.radius ?? 1.6) * 1.9;
    if (!this.beam) {
      const g = new THREE.Group(), cone = (r0: number, r1: number) => new THREE.CylinderGeometry(r1, r0, len, 28, 1, true).rotateX(Math.PI / 2).translate(0, 0, len / 2);
      const shell = new THREE.Mesh(cone(0.28, rad), add(0xffd23a, THREE.DoubleSide)); shell.name = "shell";
      const rim = new THREE.Mesh(cone(0.34, rad * 1.12), add(0xffb000, THREE.BackSide)); rim.name = "rim";
      const core = new THREE.Mesh(cone(0.1, rad * 0.35), add(0xfff6c0)); core.name = "core";
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), add(0xfff0a0)); ball.name = "ball";
      g.add(shell, rim, core, ball); g.renderOrder = 5; this.scene.add(g); this.beam = g;
    }
    const right = new THREE.Vector3().crossVectors(v.dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, v.dir);
    const from = v.o.clone().addScaledVector(v.dir, 0.72).addScaledVector(right, 0.13).addScaledVector(up, -0.1);
    this.beam.position.copy(from); this.beam.lookAt(from.clone().add(v.dir));
    const grow = Math.min(1, t / 0.18), fade = Math.min(1, ((tl.active ?? 3) - t) / 0.3), k = grow * fade, pulse = 0.85 + 0.15 * Math.sin(t * 40);
    this.beam.scale.set(k * pulse, k * pulse, grow);
    const op = (n: string, o: number) => (((this.beam!.getObjectByName(n) as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = o * k);
    op("shell", 0.22); op("rim", 0.35 * pulse); op("core", 0.55); op("ball", 0.6);
  }
  private torrentShard(tl: (typeof SUPERS)["torrent"]) {
    const v = this.hooks.view?.(); if (!v) return; const range = tl.range ?? 40, rad = tl.radius ?? 1.6, sp = 46;
    const right = new THREE.Vector3().crossVectors(v.dir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, v.dir);
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * rad; // punto al azar del disco de dispersión al final del alcance
    const from = v.o.clone().addScaledVector(v.dir, 0.75).addScaledVector(right, 0.13).addScaledVector(up, -0.1);
    const to = v.o.clone().addScaledVector(v.dir, range * 0.6).addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
    const dir = to.sub(from).normalize();
    const m = new THREE.Mesh(shardGeo, add(Math.random() < 0.7 ? COLOR.torrent : 0xffffff)); m.scale.set(0.5, 0.5, 2.6 + Math.random());
    m.position.copy(from); m.lookAt(from.clone().add(dir));
    this.scene.add(m); this.shardsFly.push({ m, v: dir.multiplyScalar(sp), left: range / sp, hit: new Set(), dmg: tl.damage ?? 24 });
  }

  // ---------- Abanico de cristal ----------
  private fireShards() {
    const tl = SUPERS.shards, v = this.hooks.view?.(); if (!v) return; const n = tl.count ?? 26;
    const right = new THREE.Vector3().crossVectors(v.dir, new THREE.Vector3(0, 1, 0)).normalize();
    for (let i = 0; i < n; i++) {
      const spread = ((i / (n - 1)) - 0.5) * 0.9, dir = v.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -spread).addScaledVector(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * 0.12).normalize();
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), add(i % 3 ? COLOR.shards : 0xffffff)); m.scale.set(0.6, 0.6, 2.6);
      m.position.copy(v.o).addScaledVector(v.dir, 0.7).addScaledVector(right, spread * 0.4).add(new THREE.Vector3(0, -0.15, 0)); m.lookAt(m.position.clone().add(dir));
      this.scene.add(m); this.shardsFly.push({ m, v: dir.multiplyScalar(tl.rate ?? 50), left: (tl.range ?? 38) / (tl.rate ?? 50), hit: new Set(), dmg: tl.damage ?? 130 });
    }
    this.hooks.shake(0.2); this.hooks.sound("zap");
  }
  private updateShards(dt: number) {
    for (const s of [...this.shardsFly]) {
      s.left -= dt; s.m.position.addScaledVector(s.v, dt); s.m.rotation.z += dt * 12;
      for (const d of this.alive()) if (!s.hit.has(d) && d.center.distanceTo(s.m.position) < 0.7 * (d.kind.scale ?? 1)) {
        s.hit.add(d); this.hooks.onHit(d, s.m.position.clone(), s.dmg * this.power, null); this.spawn(new THREE.Mesh(sphereGeo, add(COLOR.shards)), s.m.position.clone(), 0.12, s.dmg < 60 ? 0.18 : 0.35, "flash");
      }
      if (s.left <= 0 || s.m.position.y < 0) { this.scene.remove(s.m); this.shardsFly.splice(this.shardsFly.indexOf(s), 1); }
    }
  }

  private plantSentry(g: THREE.Group, col: number) {
    const model = sentryModelNow();
    if (model) { g.add(model); this.armSentry(g, true); return; }
    g.add(buildSentryFallback(col));
    this.armSentry(g, false);
    // El GLB puede llegar un poco tarde: se cambia la primitiva sin mover la torreta ni reiniciar el despliegue.
    void loadSentryModel().then((m) => { if (!m || this.sentry !== g) return; g.clear(); g.add(m); this.armSentry(g, true); });
  }
  /** Guarda las anclas y el estado de animación de la torreta (head, tip, cañones, antena y patas). */
  private armSentry(g: THREE.Group, glb: boolean) {
    const barrels = [g.getObjectByName("mov_cañon_l"), g.getObjectByName("mov_cañon_r")].filter((b): b is THREE.Object3D => !!b);
    const antenna = g.getObjectByName("mov_antena") ?? null, legs = g.getObjectByName("mov_patas") ?? null;
    const prev = g.userData.sentry as SentryState | undefined;
    g.userData.pitchAxis = glb ? "z" : "x";
    g.userData.sentry = { deploy: prev?.deploy ?? 0, groundY: g.position.y, barrels, barrelBase: barrels.map((b) => b.position.clone()), barrelNext: prev?.barrelNext ?? 0, antenna, legs, legsBase: legs?.position.y ?? 0 } satisfies SentryState;
  }
  private sentryTick(a: NonNullable<SuperFx["active"]>, dt: number) {
    const g = this.sentry; if (!g) return;
    const tl = SUPERS.sentry, head = g.getObjectByName("head"), tip = g.getObjectByName("tip");
    const st = g.userData.sentry as SentryState | undefined;
    if (!head || !tip || !st) return;
    // Despliegue (~0,4 s): la torreta se estira desde el suelo y las patas se asientan.
    if (st.deploy < 0.4) {
      st.deploy = Math.min(0.4, st.deploy + dt);
      const k = st.deploy / 0.4, e = 1 - Math.pow(1 - k, 3);
      g.scale.set(1, 0.78 + 0.22 * e, 1);
      g.position.y = st.groundY + 0.1 * (1 - e);
      if (st.legs) st.legs.position.y = st.legsBase + 0.08 * (1 - e);
    } else if (g.scale.y !== 1) { g.scale.set(1, 1, 1); g.position.y = st.groundY; if (st.legs) st.legs.position.y = st.legsBase; }
    // Antena: vaivén leve.
    if (st.antenna) st.antenna.rotation.z = 0.06 * Math.sin(a.t * 2.1) + 0.025 * Math.sin(a.t * 5.3);
    // Retroceso de los cañones: se alternan y vuelven solos a su sitio.
    for (let i = 0; i < st.barrels.length; i++) {
      const b = st.barrels[i], r = (b.userData.recoil as number) ?? 0;
      if (r <= 0) continue;
      const n = Math.max(0, r - dt * 9);
      b.userData.recoil = n; b.position.x = st.barrelBase[i].x - 0.055 * n;
    }
    const from = g.position.clone().setY(0.95);
    const target = this.alive().filter((d) => d.center.distanceTo(from) < (tl.range ?? 35)).sort((x, y) => x.center.distanceToSquared(from) - y.center.distanceToSquared(from))[0];
    const pitchAxis = g.userData.pitchAxis === "z" ? "z" : "x";
    if (!target) {
      head.rotation.y += dt * 0.8;
      head.rotation[pitchAxis] += (0 - head.rotation[pitchAxis]) * Math.min(1, dt * 6);
      return;
    }
    const to = target.center.clone().sub(from), want = Math.atan2(-to.x, -to.z);
    let dy = want - head.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); head.rotation.y += dy * Math.min(1, dt * 10);
    // Inclinación suave hacia el objetivo (el eje depende de si el modelo está girado: GLB Z, cajas X).
    const pitch = THREE.MathUtils.clamp(Math.atan2(to.y, Math.max(0.001, Math.hypot(to.x, to.z))), -0.35, 0.45);
    head.rotation[pitchAxis] += (pitch - head.rotation[pitchAxis]) * Math.min(1, dt * 6);
    if (a.t >= a.next && st.deploy >= 0.4 && Math.abs(dy) < 0.25) {
      a.next = a.t + (tl.interval ?? 0.14);
      if (st.barrels.length) st.barrels[st.barrelNext++ % st.barrels.length].userData.recoil = 1;
      const m0 = tip.getWorldPosition(new THREE.Vector3()), c = target.center, len = m0.distanceTo(c);
      const b = new THREE.Mesh(boltGeo, add(COLOR.sentry)); b.scale.set(0.025, len, 0.025); b.position.copy(m0).lerp(c, 0.5); b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.clone().sub(m0).normalize());
      this.scene.add(b); this.vfx.push({ mesh: b, t: 0, dur: 0.06, r: 1, kind: "bolt" });
      this.spawn(new THREE.Mesh(sphereGeo, add(0xffffff)), m0, 0.05, 0.12, "flash");
      this.hooks.onHit(target, target.center, (tl.damage ?? 40) * this.power, null); this.hooks.sound("shot");
    }
  }
  /** Sanguijuela: cables de energía a los enemigos más cercanos; les quitan vida y te curan. */
  private drain(o: THREE.Vector3) {
    const tl = SUPERS.leech, from = this.hooks.hand?.() ?? o.clone().setY(1.3);
    const list = this.alive().filter((d) => d.center.distanceTo(from) < (tl.range ?? 16)).sort((x, y) => x.center.distanceToSquared(from) - y.center.distanceToSquared(from)).slice(0, tl.count ?? 5);
    let got = 0;
    for (const d of list) { const dmg = (tl.tick ?? 30) * this.power; this.zap(from, d.center, COLOR.leech, 0.24); this.hooks.onHit(d, d.center, dmg, null); got += dmg; }
    if (got) this.hooks.heal?.(got * (tl.heal ?? 0.3));
  }
  /** Fin de la gravedad cero: todos los que flotaban caen y se estrellan (daño según su vida máxima). */
  private slam() {
    const tl = SUPERS.zerog, at = this.active?.at;
    for (const d of this.alive()) if (d.group.position.y > 0.5) {
      d.liftT = 0; const p = d.group.position.clone().setY(0.05), max = d.layers.reduce((a, l) => a + l.max, 0);
      this.spawn(new THREE.Mesh(ringGeo, add(COLOR.zerog)), p, 0.45, 2.2, "ring");
      this.hooks.onHit(d, d.center, Math.max((tl.damage ?? 350) * this.power, max * (d.kind.boss ? tl.bossFrac ?? 0.12 : tl.frac ?? 0.5)), "explosive");
    }
    if (at) this.spawn(new THREE.Mesh(ringGeo, add(0xffffff)), at, 0.5, (tl.radius ?? 8) * 1.3, "ring");
    this.hooks.shake(0.45); this.hooks.sound("boom");
  }
  /** Rayo quebrado entre dos puntos (tres tramos). */
  private zap(a: THREE.Vector3, b: THREE.Vector3, color = 0xb8e8ff, dur = 0.12) {
    const pts = [a.clone()];
    for (let i = 1; i < 3; i++) pts.push(a.clone().lerp(b, i / 3).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6)));
    pts.push(b.clone());
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1], len = p.distanceTo(q), m = new THREE.Mesh(boltGeo, add(color));
      m.scale.set(0.035, len, 0.035); m.position.copy(p).lerp(q, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
      this.scene.add(m); this.vfx.push({ mesh: m, t: 0, dur, r: 1, kind: "bolt" });
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
