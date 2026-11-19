// Defensa del núcleo: el núcleo, las plataformas de construcción y lo que se construye en ellas (mallas por código y
// su comportamiento cada fotograma). Sin luces nuevas: brillos, rayos y proyectiles son mallas aditivas.
import * as THREE from "three";
import type { Dummy, Element } from "./dummies";
import { BUILD, CORE_HP, type Build } from "./defense";

export interface DefenseHooks {
  enemies(): Dummy[];
  onHit(d: Dummy, point: THREE.Vector3, dmg: number, element: Element): void;
  sound(kind: "shot" | "boom" | "zap"): void;
}
export interface Placed { b: Build; level: number; hp: number; t: number; aim: THREE.Group | null; root: THREE.Group; beamOn: Dummy | null; beamT: number; armed: number }
export interface Pad { pos: THREE.Vector3; marker: THREE.Mesh; placed: Placed | null }

const add = (c: number, op = 0.85) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
const metal = (c = 0x4a5058) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.6, roughness: 0.45 });
const sphereGeo = new THREE.SphereGeometry(1, 12, 8), boltGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), ringGeo = new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2), discGeo = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2);
interface Fx { m: THREE.Mesh; t: number; dur: number; kind: "flash" | "bolt" | "ring" }
interface Shot { m: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; target: Dummy | null; dmg: number; splash: number; color: number; homing: boolean }

export class DefenseFx {
  readonly group = new THREE.Group();
  pads: Pad[] = [];
  core = { pos: new THREE.Vector3(), hp: CORE_HP, max: CORE_HP, shield: 0, mesh: null as THREE.Group | null };
  private fx: Fx[] = []; private shots: Shot[] = [];
  private time = 0;
  constructor(private scene: THREE.Scene, private hooks: DefenseHooks) { scene.add(this.group); }

  /** Monta el núcleo en `center` y las plataformas alrededor (en dos anillos). */
  setup(center: THREE.Vector3, radius: number, rnd: () => number = Math.random, avoid: { x: number; z: number; r: number }[] = []) {
    this.clear(); this.core.pos.copy(center); this.core.hp = this.core.max = CORE_HP; this.core.shield = 0;
    const g = new THREE.Group(); g.position.copy(center);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.7, 0.5, 8), metal(0x2c3036)); base.position.y = 0.25; g.add(base);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), new THREE.MeshBasicMaterial({ color: 0x5affe0, toneMapped: false })); crystal.position.y = 1.6; crystal.name = "crystal"; g.add(crystal);
    const halo = new THREE.Mesh(sphereGeo, add(0x3ad8c0, 0.25)); halo.scale.setScalar(1.2); halo.position.y = 1.6; g.add(halo);
    for (let i = 0; i < 4; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.6, 0.18), metal(0x3a4048)); const a = (i / 4) * Math.PI * 2; p.position.set(Math.cos(a) * 1.15, 1, Math.sin(a) * 1.15); g.add(p); }
    this.group.add(g); this.core.mesh = g;
    // Anillos de plataformas con número y giro al azar (y sin pisar los obstáculos de la sala)
    const rings: [number, number, number][] = [[radius * (0.28 + rnd() * 0.06), 5 + Math.floor(rnd() * 3), rnd() * Math.PI], [radius * (0.6 + rnd() * 0.06), 8 + Math.floor(rnd() * 4), rnd() * Math.PI]];
    for (const [r, n, off] of rings) for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + off, pos = center.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      if (avoid.some((c) => Math.hypot(c.x - pos.x, c.z - pos.z) < c.r + 1.6)) continue;
      const marker = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 6).rotateX(-Math.PI / 2), add(0x3fd0d8, 0.6)); marker.position.copy(pos).setY(0.04); this.group.add(marker);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 6), metal(0x24282d)); plate.position.copy(pos).setY(0.03); this.group.add(plate);
      this.pads.push({ pos, marker, placed: null });
    }
  }
  clear() {
    for (const c of [...this.group.children]) this.group.remove(c);
    for (const s of this.shots) this.scene.remove(s.m); for (const f of this.fx) this.scene.remove(f.m);
    this.pads = []; this.shots = []; this.fx = []; this.core.mesh = null;
  }
  /** Plataforma más cercana a `p` (a menos de 1,8 m). */
  padNear(p: THREE.Vector3) { return this.pads.find((x) => Math.hypot(x.pos.x - p.x, x.pos.z - p.z) < 1.8) ?? null; }
  /** Torre señuelo en pie (los enemigos van a por ella). */
  get decoyPos(): THREE.Vector3 | null { const d = this.pads.find((p) => p.placed?.b.behavior === "decoy" && p.placed.hp > 0); return d ? d.pos.clone() : null; }

  build(pad: Pad, id: string) {
    const b = BUILD[id]; pad.placed = { b, level: 1, hp: b.hp?.[0] ?? 1, t: 0, aim: null, root: new THREE.Group(), beamOn: null, beamT: 0, armed: 0 };
    this.mesh(pad); this.ring(pad.pos, b.color, 2.2);
  }
  upgrade(pad: Pad) { const p = pad.placed!; p.level = Math.min(3, p.level + 1); if (p.b.hp) p.hp = p.b.hp[p.level - 1]; this.mesh(pad); this.ring(pad.pos, 0xffffff, 2.6); }
  sell(pad: Pad) { if (pad.placed) this.group.remove(pad.placed.root); pad.placed = null; }

  /** Malla de cada construible (más alta y con más detalle por nivel). */
  private mesh(pad: Pad) {
    const p = pad.placed!; this.group.remove(p.root); const g = new THREE.Group(); g.position.copy(pad.pos); p.root = g; p.aim = null;
    const L = p.level, col = p.b.color, glow = new THREE.MeshBasicMaterial({ color: col, toneMapped: false }), m = metal(), dk = metal(0x23272c);
    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z = 0, par: THREE.Object3D = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); o.position.set(x, y, z); par.add(o); return o; };
    const cyl = (r: number, h: number, mat: THREE.Material, x: number, y: number, z = 0, par: THREE.Object3D = g, rx = 0) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 10), mat); o.position.set(x, y, z); o.rotation.x = rx; par.add(o); return o; };
    const beh = p.b.behavior;
    if (p.b.cat === "turret") {
      cyl(0.5, 0.35, dk, 0, 0.18); cyl(0.18, 0.7 + L * 0.1, m, 0, 0.7);
      const head = new THREE.Group(); head.position.y = 1.15 + L * 0.1; g.add(head); p.aim = head;
      box(0.55, 0.36, 0.6, m, 0, 0, 0, head); box(0.4, 0.06, 0.02, glow, 0, 0.08, -0.31, head);
      const bar = (r: number, len: number, x = 0, y = 0) => cyl(r, len, dk, x, y, -0.3 - len / 2, head, Math.PI / 2);
      if (beh === "gun" && p.b.id === "gatling") for (let i = 0; i < 2 + L; i++) bar(0.035, 0.7, Math.cos(i * 2.1) * 0.07, Math.sin(i * 2.1) * 0.07);
      else if (beh === "gun") bar(0.05, 1.4 + L * 0.15);
      else if (beh === "splash") bar(0.13, 0.7);
      else if (beh === "beam") { bar(0.06, 0.6); const lens = cyl(0.09, 0.04, glow, 0, 0, -0.92, head, Math.PI / 2); void lens; }
      else if (beh === "chain") { cyl(0.04, 0.6, m, 0, 0.45, 0, head); for (let i = 0; i < L + 1; i++) cyl(0.16 - i * 0.03, 0.04, glow, 0, 0.3 + i * 0.13, 0, head); }
      else if (beh === "cone") { bar(0.09, 0.5); box(0.2, 0.2, 0.12, glow, 0, -0.25, 0.2, head); }
      else if (beh === "mortar") { const t = cyl(0.16, 0.7, dk, 0, 0.3, -0.15, head, Math.PI / 4); void t; }
      else if (beh === "missile") for (let i = 0; i < 2 + L; i++) cyl(0.06, 0.5, glow, -0.18 + (i % 3) * 0.18, 0.05 + Math.floor(i / 3) * 0.14, -0.35, head, Math.PI / 2);
      else if (beh === "frost") { bar(0.07, 0.55); cyl(0.14, 0.3, glow, 0, 0.26, 0.1, head); }
      else if (beh === "pulse") { cyl(0.32, 0.08, glow, 0, 0.25, 0, head); cyl(0.22, 0.08, glow, 0, 0.4, 0, head); }
    } else if (beh === "floor") { const d = new THREE.Mesh(discGeo, add(col, 0.35)); d.scale.setScalar(p.b.range[L - 1]); d.position.y = 0.06; g.add(d); for (let i = 0; i < 4; i++) box(0.12, 0.05, p.b.range[L - 1] * 1.6, glow, 0, 0.07, 0).rotation.y = (i / 4) * Math.PI; }
    else if (beh === "blades") { const rot = new THREE.Group(); rot.position.y = 0.45; rot.name = "spin"; g.add(rot); cyl(0.2, 0.6, m, 0, 0.3); for (let i = 0; i < 2 + L; i++) { const bl = box(p.b.range[L - 1] * 1.8, 0.04, 0.16, metal(0xc8d0d8), 0, 0, 0, rot); bl.rotation.y = (i / (2 + L)) * Math.PI; } }
    else if (beh === "mine") { cyl(0.34, 0.12, dk, 0, 0.06); const led = cyl(0.07, 0.05, glow, 0, 0.14); led.name = "led"; }
    else if (beh === "slow") { const d = new THREE.Mesh(discGeo, new THREE.MeshStandardMaterial({ color: 0x1c2a16, roughness: 0.9 })); d.scale.setScalar(p.b.range[L - 1]); d.position.y = 0.05; g.add(d); const r = new THREE.Mesh(ringGeo, add(col, 0.5)); r.scale.setScalar(p.b.range[L - 1]); r.position.y = 0.07; g.add(r); }
    else if (beh === "wall") { for (let i = -1; i <= 1; i++) box(0.9, 1.2 + L * 0.35, 0.35, metal(0x6a7686), i * 0.92, (1.2 + L * 0.35) / 2); box(2.8, 0.06, 0.37, glow, 0, 1.2 + L * 0.35); }
    else if (beh === "decoy") { cyl(0.25, 0.3, dk, 0, 0.15); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 1.5, 10), add(col, 0.45)); h.position.y = 1.05; g.add(h); const hd = new THREE.Mesh(sphereGeo, add(col, 0.5)); hd.scale.setScalar(0.24); hd.position.y = 2.05; g.add(hd); }
    else if (beh === "repair") { cyl(0.4, 0.4, dk, 0, 0.2); box(0.12, 0.6 + L * 0.15, 0.12, glow, 0, 0.7); const c = cyl(0.3, 0.05, glow, 0, 1.1 + L * 0.1); c.name = "spin"; }
    else if (beh === "income") { box(0.9, 0.9 + L * 0.2, 0.9, m, 0, (0.9 + L * 0.2) / 2); for (let i = 0; i < L + 1; i++) box(0.92, 0.05, 0.92, glow, 0, 0.2 + i * 0.25); }
    else if (beh === "buff") { cyl(0.12, 1.6 + L * 0.3, m, 0, (1.6 + L * 0.3) / 2); const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glow); o.position.y = 1.8 + L * 0.3; o.name = "spin"; g.add(o); }
    else if (beh === "shield") { cyl(0.45, 0.3, dk, 0, 0.15); for (let i = 0; i < 3; i++) { const pl = box(0.5, 0.8 + L * 0.15, 0.06, add(col, 0.55), 0, 0.75, 0); pl.rotation.y = (i / 3) * Math.PI * 2; pl.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.35, 0.75, Math.cos((i / 3) * Math.PI * 2) * 0.35); } }
    // Marcas de nivel (rombos en la base)
    for (let i = 0; i < L; i++) box(0.12, 0.12, 0.12, glow, -0.3 + i * 0.3, 0.12, 0.72).rotation.y = Math.PI / 4;
    this.group.add(g);
  }

  private ring(p: THREE.Vector3, c: number, r: number) { const m = new THREE.Mesh(ringGeo, add(c)); m.position.copy(p).setY(0.08); m.scale.setScalar(r * 0.3); this.scene.add(m); this.fx.push({ m, t: 0, dur: 0.5, kind: "ring" }); (m.userData.r = r); }
  private flash(p: THREE.Vector3, c: number, r: number, dur = 0.18) { const m = new THREE.Mesh(sphereGeo, add(c)); m.position.copy(p); m.scale.setScalar(r); this.scene.add(m); this.fx.push({ m, t: 0, dur, kind: "flash" }); }
  private bolt(a: THREE.Vector3, b: THREE.Vector3, c: number, w = 0.03, dur = 0.08) {
    const m = new THREE.Mesh(boltGeo, add(c)); m.scale.set(w, a.distanceTo(b), w); m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.scene.add(m); this.fx.push({ m, t: 0, dur, kind: "bolt" });
  }

  /** Daño al núcleo (primero al escudo y a la torre señuelo si la hay); true si cae. */
  hitCore(dmg: number) {
    const dec = this.pads.find((p) => p.placed?.b.behavior === "decoy" && p.placed.hp > 0);
    if (dec) { dec.placed!.hp -= dmg; if (dec.placed!.hp <= 0) { this.flash(dec.pos.clone().setY(1), dec.placed!.b.color, 1.2, 0.4); this.sell(dec); } return false; }
    const s = Math.min(this.core.shield, dmg); this.core.shield -= s; dmg -= s;
    this.core.hp = Math.max(0, this.core.hp - dmg); return this.core.hp <= 0;
  }
  /** Al empezar cada oleada: escudos del núcleo cargados y minas armadas. */
  waveStart() { this.core.shield = this.pads.reduce((a, p) => a + (p.placed?.b.behavior === "shield" ? p.placed.b.extra[p.placed.level - 1] : 0), 0); }
  /** Créditos de los generadores al acabar una oleada. */
  income() { return this.pads.reduce((a, p) => a + (p.placed?.b.behavior === "income" ? p.placed.b.extra[p.placed.level - 1] : 0), 0); }

  update(dt: number, waveOn: boolean) {
    this.time += dt;
    const cr = this.core.mesh?.getObjectByName("crystal"); if (cr) { cr.rotation.y += dt * 1.2; cr.position.y = 1.6 + Math.sin(this.time * 2) * 0.08; }
    const foes = this.hooks.enemies().filter((d) => d.alive);
    for (const pad of this.pads) {
      const p = pad.placed; pad.marker.visible = !p;
      if (!p) continue;
      p.root.getObjectByName("spin")?.rotateY(dt * (p.b.behavior === "blades" ? 14 : 2));
      if (!waveOn && p.b.behavior !== "repair") continue;
      const L = p.level - 1, b = p.b, buff = 1 + this.buffAt(pad.pos), range = b.range[L], dmg = b.dmg[L] * buff;
      p.t -= dt;
      const inRange = (r: number) => foes.filter((d) => d.group.position.distanceTo(pad.pos) < r);
      const nearest = (r: number, min = 0) => inRange(r).filter((d) => d.group.position.distanceTo(pad.pos) >= min).sort((x, y) => x.group.position.distanceToSquared(pad.pos) - y.group.position.distanceToSquared(pad.pos))[0];
      const muzzle = () => (p.aim ? p.aim.localToWorld(new THREE.Vector3(0, 0, -0.9)) : pad.pos.clone().setY(1.2));
      const face = (d: Dummy) => { if (p.aim) { const v = d.center.sub(pad.pos); p.aim.rotation.y = Math.atan2(-v.x, -v.z); } };
      switch (b.behavior) {
        case "gun": { const d = nearest(range); if (!d) break; face(d); if (p.t > 0) break; p.t = b.rate[L]; const m = muzzle(); this.bolt(m, d.center, b.color, b.id === "railgun" ? 0.08 : 0.025, b.id === "railgun" ? 0.25 : 0.05); this.hooks.onHit(d, d.center, dmg, b.id === "railgun" ? "electrico" : null); this.hooks.sound("shot"); break; }
        case "splash": case "mortar": case "missile": {
          const d = nearest(range, b.behavior === "mortar" ? 8 : 0); if (!d) break; face(d); if (p.t > 0) break; p.t = b.rate[L];
          const n = b.behavior === "missile" ? b.extra[L] : 1;
          for (let i = 0; i < n; i++) { const m = new THREE.Mesh(sphereGeo, add(b.color)); m.scale.setScalar(b.behavior === "mortar" ? 0.22 : 0.14); const from = muzzle(); m.position.copy(from); this.scene.add(m);
            const tgt = b.behavior === "missile" ? (inRange(range)[i % Math.max(1, inRange(range).length)] ?? d) : d;
            this.shots.push({ m, from, to: tgt.center.clone(), t: 0, dur: b.behavior === "mortar" ? 1.4 : b.behavior === "missile" ? 0.8 + i * 0.08 : 0.35, arc: b.behavior === "mortar" ? 9 : b.behavior === "missile" ? 2.5 : 0.3, target: tgt, dmg, splash: b.behavior === "missile" ? 1.6 : b.extra[L], color: b.color, homing: b.behavior === "missile" }); }
          this.hooks.sound("shot"); break;
        }
        case "beam": {
          const d = p.beamOn?.alive && p.beamOn.group.position.distanceTo(pad.pos) < range ? p.beamOn : nearest(range);
          if (!d) { p.beamOn = null; break; } if (d !== p.beamOn) { p.beamOn = d; p.beamT = 0; } face(d); p.beamT += dt;
          if (p.t <= 0) { p.t = b.rate[L]; const ramp = 1 + Math.min(b.extra[L], p.beamT); this.bolt(muzzle(), d.center, b.color, 0.03 + 0.01 * ramp, b.rate[L] + 0.02); this.hooks.onHit(d, d.center, dmg * ramp * 0.35, "fuego"); }
          break;
        }
        case "chain": { const d = nearest(range); if (!d || p.t > 0) break; p.t = b.rate[L]; let from = muzzle(), cur: Dummy | undefined = d; const hit = new Set<Dummy>();
          for (let k = 0; k < b.extra[L] && cur; k++) { hit.add(cur); this.bolt(from, cur.center, b.color, 0.04, 0.12); this.hooks.onHit(cur, cur.center, dmg * Math.pow(0.85, k), "electrico"); from = cur.center; const c0: Dummy = cur; cur = foes.filter((x) => !hit.has(x) && x.center.distanceTo(c0.center) < 6).sort((x, y) => x.center.distanceToSquared(c0.center) - y.center.distanceToSquared(c0.center))[0]; }
          this.hooks.sound("zap"); break; }
        case "cone": { const d = nearest(range); if (!d) break; face(d); if (p.t > 0) break; p.t = b.rate[L]; const m = muzzle(), dir = d.center.sub(m).normalize();
          for (const e of inRange(range)) { const v = e.center.sub(m); if (v.clone().normalize().dot(dir) > 0.82) { this.hooks.onHit(e, e.center, dmg, "fuego"); } }
          for (let i = 0; i < 3; i++) this.flash(m.clone().addScaledVector(dir, 1 + i * (range / 3)), b.color, 0.35 + i * 0.25, 0.2); break; }
        case "frost": { const d = nearest(range); if (!d) break; face(d); if (p.t > 0) break; p.t = b.rate[L]; this.bolt(muzzle(), d.center, b.color, 0.05, 0.1); this.hooks.onHit(d, d.center, dmg, null); d.slow(1.2, 1 - b.extra[L]); if (Math.random() < 0.06 * (L + 1)) d.freeze(1.2, 1.2); break; }
        case "pulse": if (p.t <= 0 && inRange(range).length) { p.t = b.rate[L]; for (const e of inRange(range)) { this.hooks.onHit(e, e.center, dmg, "electrico"); e.freeze(b.extra[L], 1); } this.ring(pad.pos, b.color, range); this.hooks.sound("zap"); } break;
        case "floor": if (p.t <= 0) { p.t = b.rate[L]; for (const e of inRange(range)) this.hooks.onHit(e, e.center, dmg, "electrico"); } break;
        case "blades": if (p.t <= 0) { p.t = b.rate[L]; for (const e of inRange(range + 0.4)) { this.hooks.onHit(e, e.center, dmg, null); e.push(e.group.position.clone().sub(pad.pos).setY(0).normalize(), 0.6); } } break;
        case "mine": { p.armed -= dt; const led = p.root.getObjectByName("led"); if (led) led.visible = p.armed > 0 ? false : Math.sin(this.time * 8) > 0;
          if (p.armed <= 0 && inRange(range).length) { p.armed = b.rate[L]; for (const e of inRange(b.extra[L])) this.hooks.onHit(e, e.center, dmg, "explosive"); this.flash(pad.pos.clone().setY(0.6), 0xffa040, b.extra[L] * 0.45, 0.35); this.ring(pad.pos, b.color, b.extra[L]); this.hooks.sound("boom"); } break; }
        case "slow": for (const e of inRange(range)) e.slow(0.4, 1 - b.extra[L]); break;
        case "wall": for (const e of inRange(1.8)) { const v = e.group.position.clone().sub(pad.pos).setY(0); e.group.position.addScaledVector(v.normalize(), dt * 3); p.hp -= dt * 40; } if (p.hp <= 0) { this.flash(pad.pos.clone().setY(1), b.color, 1.5, 0.4); this.sell(pad); this.hooks.sound("boom"); } break;
        case "repair": if (waveOn && p.t <= 0) { p.t = 1; this.core.hp = Math.min(this.core.max, this.core.hp + b.extra[L]); this.bolt(pad.pos.clone().setY(1.2), this.core.pos.clone().setY(1.6), b.color, 0.025, 0.3); } break;
        default: break;
      }
    }
    // Proyectiles
    for (const s of [...this.shots]) {
      s.t += dt; if (s.homing && s.target?.alive) s.to.copy(s.target.center);
      const k = Math.min(1, s.t / s.dur), p = s.from.clone().lerp(s.to, k); p.y += Math.sin(k * Math.PI) * s.arc; s.m.position.copy(p);
      if (Math.random() < 0.4) this.flash(p.clone(), s.color, 0.12, 0.15);
      if (k >= 1) {
        for (const e of foes) if (e.alive && e.center.distanceTo(s.to) < s.splash) this.hooks.onHit(e, e.center, s.dmg * (1 - 0.5 * e.center.distanceTo(s.to) / s.splash), "explosive");
        this.flash(s.to.clone(), s.color, s.splash * 0.45, 0.3); this.scene.remove(s.m); this.shots.splice(this.shots.indexOf(s), 1); this.hooks.sound("boom");
      }
    }
    for (const f of [...this.fx]) {
      f.t += dt; const k = f.t / f.dur, mat = f.m.material as THREE.MeshBasicMaterial;
      if (f.kind === "ring") f.m.scale.setScalar((f.m.userData.r ?? 2) * Math.min(1, 0.3 + k));
      mat.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(f.m); mat.dispose(); this.fx.splice(this.fx.indexOf(f), 1); }
    }
  }
  /** Potencia de las balizas que alcanzan este punto. */
  private buffAt(p: THREE.Vector3) { let s = 0; for (const x of this.pads) if (x.placed?.b.behavior === "buff" && x.pos.distanceTo(p) < x.placed.b.range[x.placed.level - 1] && x.pos !== p) s += x.placed.b.extra[x.placed.level - 1]; return s; }
}
