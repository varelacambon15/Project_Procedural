// Efectos del equipamiento en juego (LB / X): mini torreta, escudo y cúpula desplegables, bola de energía, gancho,
// mina, pozo de gravedad, campo de estasis, plataforma de salto, baliza, cuchillo, cargas en cadena, arpón, señuelo,
// granada de fallo, caja de munición, inyector, propulsor y teleportador.
// Sin luces nuevas: todo emisivo o aditivo.
import * as THREE from "three";
import type { Dummy } from "./dummies";
import type { GadgetSpec } from "./gadgets";
import { GADGET_KINDS } from "./gadgets";

export interface GadgetHooks {
  enemies(): Dummy[];
  onHit(d: Dummy, point: THREE.Vector3, dmg: number, element: "fuego" | "electrico" | "explosive" | null): void;
  colliders: THREE.Box3[]; shootables: THREE.Object3D[];
  /** Ojo del jugador y hacia dónde mira. */ view(): { eye: THREE.Vector3; dir: THREE.Vector3 };
  /** Pies del jugador. */ feet(): THREE.Vector3;
  lunge(dir: THREE.Vector3, dist: number, time: number): void;
  launch(vy: number): void;
  /** Recarga el arma al momento (caja de munición). */ refill(): void;
  /** Mejora temporal de velocidad y cadencia (inyector). */ boost(sec: number, k: number): void;
  /** Inyección temporal: todo menos tú va a `k` de velocidad durante `sec` s. */ slowTime(sec: number, k: number): void;
  /** Dirección en la que se mueve el jugador (propulsor); null si está quieto. */ moveDir(): THREE.Vector3 | null;
  teleport(p: THREE.Vector3): void;
  sound(kind: "boom" | "zap" | "shot" | "swing"): void;
}
interface Live { kind: GadgetSpec["kind"]; g: GadgetSpec; root: THREE.Object3D; t: number; cd: number; pos: THREE.Vector3; box?: THREE.Box3; vel?: THREE.Vector3 }

const add = (c: number, op = 0.5) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const solid = (c: number, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.4, emissive: e || 0x000000, emissiveIntensity: e ? 1.4 : 0 });

export class GadgetFx {
  private live: Live[] = [];
  private fx: { m: THREE.Object3D; t: number; life: number }[] = [];
  /** Enemigos con fallo (se atacan entre ellos) y segundos que les quedan. */ readonly glitched = new Map<Dummy, number>();
  /** Señuelo activo: los enemigos van a por él en vez de a por ti. */ get decoyPos() { const l = this.live.find((x) => x.kind === "decoy"); return l ? l.pos : null; }
  /** Baliza del teleportador colocada: la siguiente pulsación lleva al jugador a ella (sin gastar carga). */
  tryTeleport() { const i = this.live.findIndex((x) => x.kind === "teleport"); if (i < 0) return false; const L = this.live[i]; this.hooks.teleport(L.pos.clone()); this.burst(L.pos.clone().setY(1), 1.5, GADGET_KINDS.teleport.color); this.scene.remove(L.root); this.live.splice(i, 1); return true; }
  /** Enemigos marcados por la baliza (reciben más daño) hasta el instante dado. */ readonly marked = new Map<Dummy, number>();
  private time = 0;
  constructor(private scene: THREE.Scene, private hooks: GadgetHooks) {}

  /** Reducción del daño que recibe el jugador (cúpula): 1 = ninguna. */
  guardAt(p: THREE.Vector3) { let k = 1; for (const l of this.live) if (l.kind === "dome" && l.pos.distanceTo(p) < l.g.radius) k = Math.min(k, 1 - l.g.power); return k; }
  /** Daño extra a un enemigo marcado. */ markMult(d: Dummy) { return (this.marked.get(d) ?? 0) > this.time ? 1.25 : 1; }

  private ahead(dist: number, onGround = true) {
    const { eye, dir } = this.hooks.view(); const f = dir.clone().setY(0).normalize();
    const p = this.hooks.feet().clone().addScaledVector(f, dist); if (!onGround) p.y = eye.y; return { p, f, eye, dir };
  }
  private nearest(from: THREE.Vector3, r: number) { let best: Dummy | null = null, bd = r; for (const d of this.hooks.enemies()) { if (!d.alive) continue; const dd = d.center.distanceTo(from); if (dd < bd) { bd = dd; best = d; } } return best; }
  private beam(a: THREE.Vector3, b: THREE.Vector3, c: number) { const g = new THREE.BufferGeometry().setFromPoints([a, b]); const m = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9 })); this.scene.add(m); this.fx.push({ m, t: 0, life: 0.08 }); }
  private burst(at: THREE.Vector3, r: number, c: number) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), add(c, 0.6)); m.position.copy(at); m.scale.setScalar(r * 0.3); m.userData.r = r; this.scene.add(m); this.fx.push({ m, t: 0, life: 0.35 }); }
  private explode(at: THREE.Vector3, r: number, dmg: number, c: number) {
    this.burst(at, r, c); this.hooks.sound("boom");
    for (const d of this.hooks.enemies()) { if (!d.alive) continue; const dd = d.center.distanceTo(at); if (dd < r) this.hooks.onHit(d, d.center, dmg * (1 - 0.6 * dd / r), "explosive"); }
  }

  /** Usa el equipamiento; devuelve false si no se pudo (p. ej. el gancho sin nada a lo que engancharse). */
  use(g: GadgetSpec): boolean {
    const c = GADGET_KINDS[g.kind].color, root = new THREE.Group();
    const L: Live = { kind: g.kind, g, root, t: 0, cd: 0, pos: new THREE.Vector3() };
    switch (g.kind) {
      case "hook": {
        const { eye, dir } = this.hooks.view(), ray = new THREE.Raycaster(eye, dir, 0.5, g.radius);
        const hit = ray.intersectObjects(this.hooks.shootables, false)[0]; if (!hit) return false;
        this.beam(eye.clone().add(new THREE.Vector3(0, -0.2, 0)), hit.point, c);
        this.hooks.lunge(dir.clone().setY(0), Math.max(0, hit.distance - 1.2), 0.32); if (dir.y > 0.15) this.hooks.launch(Math.min(9, 4 + dir.y * 8));
        return true;
      }
      case "orb": {
        const { eye, dir } = this.hooks.view();
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), add(c, 0.9)); root.add(m);
        const halo = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), add(c, 0.3)); root.add(halo);
        L.pos.copy(eye).addScaledVector(dir, 0.8); L.vel = dir.clone().multiplyScalar(22); break;
      }
      case "turret": {
        const { p } = this.ahead(1.6); L.pos.copy(p);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 0.5, 10), solid(0x3a4048)); b.position.y = 0.25; root.add(b); const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), solid(0x4a5058, c)); h.position.y = 0.62; h.name = "head"; root.add(h);
        break;
      }
      case "knife": case "harpoon": {
        // Instantáneo: lo que hay en la mira (enemigo más cercano a la línea de tiro, hasta su alcance)
        const { eye, dir } = this.hooks.view(); let best: Dummy | null = null, bd = 1e9;
        for (const d of this.hooks.enemies()) { if (!d.alive) continue; const to = d.center.clone().sub(eye), along = to.dot(dir); if (along < 0 || along > (g.kind === "knife" ? g.radius : 22)) continue; const off = to.clone().addScaledVector(dir, -along).length(); if (off < 0.9 && along < bd) { bd = along; best = d; } }
        const end = best ? best.center.clone() : eye.clone().addScaledVector(dir, 12);
        this.beam(eye.clone().add(new THREE.Vector3(0, -0.2, 0)), end, c); this.hooks.sound(g.kind === "knife" ? "swing" : "zap");
        if (!best) return true;
        if (g.kind === "knife") { this.hooks.onHit(best, best.center, g.power, null); return true; }
        this.hooks.onHit(best, best.center, g.power, "electrico");
        for (const d of this.hooks.enemies()) if (d !== best && d.alive && d.center.distanceTo(best.center) < g.radius) { this.beam(best.center, d.center, c); this.hooks.onHit(d, d.center, g.power * 0.5, "electrico"); d.slow(g.duration, 0.3); }
        best.slow(g.duration, 0.1); return true;
      }
      case "chain": {
        const { p, f } = this.ahead(4); for (let k = 0; k < 3; k++) setTimeout(() => this.explode(p.clone().addScaledVector(f, k * 2.2).setY(0.6), g.radius, g.power, c), 250 + k * 280);
        this.hooks.sound("zap"); return true;
      }
      case "ammo": this.hooks.refill(); this.burst(this.hooks.feet().clone().setY(1), 1.2, c); return true;
      case "chrono": this.hooks.slowTime(g.duration, g.power); this.burst(this.hooks.feet().clone().setY(1.2), 1, c); return true;
      case "inject": this.hooks.boost(g.duration, g.power); this.burst(this.hooks.feet().clone().setY(1.2), 1, c); return true;
      case "thrust": { const md = this.hooks.moveDir() ?? this.hooks.view().dir.clone().setY(0).normalize(); this.hooks.lunge(md, g.power, 0.22); this.burst(this.hooks.feet().clone().setY(0.8), 1, c); return true; }
      case "teleport": {
        // Primera pulsación: se lanza la baliza (unos metros por delante); la segunda (sin gastar carga) te lleva a ella
        const { p } = this.ahead(9); L.pos.copy(p);
        const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), add(c, 0.9)); m.position.y = 0.6; root.add(m);
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.7, 32), add(c, 0.8)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; root.add(ring); break;
      }
      case "decoy": case "glitch": {
        const at = g.kind === "decoy" ? this.ahead(3).p : this.ahead(7).p; L.pos.copy(at);
        if (g.kind === "decoy") { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 4, 10), add(c, 0.45)); body.position.y = 0.85; root.add(body); }
        else { this.burst(at.clone().setY(1), g.radius, c); for (const d of this.hooks.enemies()) if (d.alive && d.center.distanceTo(at) < g.radius) this.glitched.set(d, g.duration); }
        break;
      }
      case "shield": {
        const { p, f } = this.ahead(2.2); L.pos.copy(p);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.3, 0.18), add(c, 0.35)); wall.position.y = 1.15; root.add(wall);
        const edge = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.22), add(c, 0.9)); edge.position.y = 2.3; root.add(edge);
        root.rotation.y = Math.atan2(f.x, f.z);
        root.position.copy(p); root.updateMatrixWorld(true); L.box = new THREE.Box3().setFromObject(wall); this.hooks.colliders.push(L.box); break;
      }
      case "dome": case "slowfield": case "gravity": case "beacon": {
        const at = g.kind === "dome" || g.kind === "beacon" ? this.hooks.feet().clone() : this.ahead(Math.min(10, g.radius + 2)).p;
        L.pos.copy(at);
        const sph = new THREE.Mesh(new THREE.SphereGeometry(g.kind === "beacon" ? 0.4 : g.radius, 28, 18, 0, Math.PI * 2, 0, g.kind === "gravity" ? Math.PI : Math.PI / 2), add(c, g.kind === "dome" ? 0.18 : 0.12)); sph.material.side = THREE.DoubleSide; root.add(sph);
        const ring = new THREE.Mesh(new THREE.RingGeometry(g.radius - 0.08, g.radius, 48), add(c, 0.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; if (g.kind !== "beacon") root.add(ring);
        if (g.kind === "beacon") { for (const d of this.hooks.enemies()) if (d.alive && d.center.distanceTo(at) < g.radius) this.marked.set(d, this.time + g.duration); this.burst(at.clone().setY(1), g.radius * 0.5, c); }
        break;
      }
      case "mine": case "jump": {
        const { p } = this.ahead(g.kind === "mine" ? 2 : 1.8); L.pos.copy(p);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(g.kind === "jump" ? g.radius : 0.3, g.kind === "jump" ? g.radius : 0.34, 0.1, 18), solid(0x2c3036, c)); disc.position.y = 0.05; root.add(disc);
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(g.kind === "jump" ? g.radius * 0.8 : 0.12, 18), add(c, 0.9)); lamp.rotation.x = -Math.PI / 2; lamp.position.y = 0.11; root.add(lamp);
        break;
      }
    }
    root.position.copy(L.pos); this.scene.add(root); this.live.push(L); this.hooks.sound("zap");
    return true;
  }

  update(dt: number) {
    this.time += dt;
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; const k = f.t / f.life; if (f.m.userData.r) f.m.scale.setScalar(f.m.userData.r * (0.3 + 0.7 * k)); ((f.m as THREE.Mesh).material as THREE.Material & { opacity: number }).opacity = Math.max(0, 0.7 * (1 - k)); if (k >= 1) { this.scene.remove(f.m); this.fx.splice(i, 1); } }
    const feet = this.hooks.feet();
    for (let i = this.live.length - 1; i >= 0; i--) {
      const L = this.live[i], g = L.g; L.t += dt; L.cd -= dt; let done = g.duration > 0 && L.t >= g.duration;
      switch (L.kind) {
        case "orb": {
          L.pos.addScaledVector(L.vel!, dt); L.root.position.copy(L.pos);
          const hitE = this.hooks.enemies().some((d) => d.alive && d.center.distanceTo(L.pos) < 0.9);
          const hitW = this.hooks.colliders.some((b) => b.containsPoint(L.pos)) || L.pos.y < 0.1;
          if (hitE || hitW || L.t > 2) { this.explode(L.pos.clone(), g.radius, g.power, GADGET_KINDS.orb.color); done = true; }
          break;
        }
        case "turret": {
          const from = L.root.position.clone().add(new THREE.Vector3(0, 0.62, 0)), d = this.nearest(from, g.radius);
          if (d) { const head = L.root.getObjectByName("head"); if (head) head.rotation.y = Math.atan2(d.center.x - from.x, d.center.z - from.z) - L.root.rotation.y;
            if (L.cd <= 0) { L.cd = 0.22; this.beam(from, d.center, GADGET_KINDS[L.kind].color); this.hooks.onHit(d, d.center, g.power, null); this.hooks.sound("shot"); } }
          break;
        }
        case "mine": {
          const d = this.nearest(L.pos.clone().setY(1), 2.2);
          if (d && L.t > 0.6) { this.explode(L.pos.clone().setY(0.6), g.radius, g.power, GADGET_KINDS.mine.color); done = true; }
          break;
        }
        case "gravity": case "slowfield": {
          for (const d of this.hooks.enemies()) {
            if (!d.alive || d.group.position.distanceTo(L.pos) > g.radius) continue;
            if (L.kind === "slowfield") d.slow(0.3, g.power);
            else { const to = L.pos.clone().sub(d.group.position).setY(0); if (to.length() > 0.6) d.group.position.addScaledVector(to.normalize(), dt * 4); d.slow(0.3, 0.2); }
          }
          if (L.kind === "gravity" && done) this.explode(L.pos.clone().setY(1), g.radius * 0.6, g.power * 3, GADGET_KINDS.gravity.color);
          L.root.rotation.y += dt * (L.kind === "gravity" ? 3 : 0.5);
          break;
        }
        case "decoy": L.root.rotation.y += dt * 1.5; L.root.visible = Math.random() > 0.06; break;
        case "teleport": L.root.rotation.y += dt * 3; break;
        case "jump": if (feet.distanceTo(L.pos) < g.radius && feet.y < 0.3 && L.cd <= 0) { L.cd = 0.6; this.hooks.launch(g.power); this.burst(L.pos.clone().setY(0.3), 1.5, GADGET_KINDS.jump.color); } break;
        case "beacon": L.root.position.y = 1 + Math.sin(L.t * 4) * 0.1; break;
      }
      // Al acabar se desvanece (el escudo libera su colisión)
      if (done) {
        this.scene.remove(L.root); if (L.box) { const k = this.hooks.colliders.indexOf(L.box); if (k >= 0) this.hooks.colliders.splice(k, 1); }
        this.live.splice(i, 1);
      } else if (g.duration > 0 && g.duration - L.t < 1) L.root.visible = Math.floor(L.t * 10) % 2 === 0;
    }
    for (const [d, t] of this.marked) if (t <= this.time || !d.alive) this.marked.delete(d);
    // Fallo: cada afectado golpea al enemigo más cercano cada 0,8 s y se queda casi quieto
    for (const [d, left] of this.glitched) {
      if (!d.alive || left <= 0) { this.glitched.delete(d); continue; }
      const nl = left - dt; this.glitched.set(d, nl); d.slow(0.3, 0.15);
      if (Math.floor(nl / 0.8) !== Math.floor(left / 0.8)) { let o: Dummy | null = null, od = 6; for (const e of this.hooks.enemies()) if (e !== d && e.alive) { const dd = e.center.distanceTo(d.center); if (dd < od) { od = dd; o = e; } } if (o) { this.beam(d.center, o.center, GADGET_KINDS.glitch.color); this.hooks.onHit(o, o.center, 45, "electrico"); } }
    }
  }
  /** Quita todo (al cambiar de zona o de partida). */
  clear() { for (const L of this.live) { this.scene.remove(L.root); if (L.box) { const k = this.hooks.colliders.indexOf(L.box); if (k >= 0) this.hooks.colliders.splice(k, 1); } } this.live = []; for (const f of this.fx) this.scene.remove(f.m); this.fx = []; this.marked.clear(); this.glitched.clear(); }
}
