// Oleadas cortas de prueba (módulo de la sala de simulación). Datos en src/data/waves.json. Enemigos de solo vida
// que avanzan hacia el jugador, golpean al llegar y mueren (no reaparecen). Sin IA compleja.
import * as THREE from "three";
import data from "../data/waves.json";
import { Dummy, KINDS, randomLook } from "./dummies";

export interface WaveEvents {
  /** Se ha completado una oleada (para el botín de fin de oleada). */
  onWaveEnd(index: number, last: Dummy | null): void;
  onAllDone(): void;
  onPlayerHit(dmg: number): void;
}

/** Oleada generada n (1, 2, 3…) tras las de diseño: más pequeños y normales, y grandes cada vez más a menudo. */
function extraWave(n: number, wave: number): Record<string, number> {
  // Más variedad: lanzadores, resistentes y élites según avanza; cada `bossEvery` oleadas, el jefe con escolta corta
  if (wave % data.bossEvery === 0) return { warden: 1, basic: 2 + Math.floor(n / 2), caster: 1 + Math.floor(n / 3) };
  const w: Record<string, number> = { small: 3 + Math.floor(n * 0.8), basic: 3 + n, caster: 1 + Math.floor(n / 2), large: Math.floor(n / 2) };
  if (n >= 2) w.sturdy = 1 + Math.floor(n / 3);
  if (n >= 4) w.elite = Math.floor(n / 4);
  return w;
}

/** Esfera de energía lanzada por un enemigo: va en línea recta hacia donde estaba el jugador; se puede esquivar. */
interface Orb { mesh: THREE.Mesh; v: THREE.Vector3; t: number; dmg: number }
const orbGeo = new THREE.SphereGeometry(0.22, 12, 8), orbHalo = new THREE.SphereGeometry(0.38, 10, 6);

export class Waves {
  active = false;
  index = -1;
  private queue: (keyof typeof KINDS)[] = [];
  private spawnT = 0; private pauseT = 0;
  private alive: Dummy[] = [];
  private lastDead: Dummy | null = null;
  private ended = false;
  private orbs: Orb[] = [];
  private volleys: { d: Dummy; every: number; t: number; speed: number; dmg: number }[] = [];

  constructor(private scene: THREE.Scene, private dummies: Dummy[], private overlay: HTMLElement, private player: () => THREE.Vector3,
    private onDamage: ConstructorParameters<typeof Dummy>[4], private ev: WaveEvents) {}

  get remaining() { return this.queue.length + this.alive.filter((d) => d.alive).length; }
  /** Oleadas infinitas: después de las de diseño se generan más, cada vez con más enemigos y algo más duros. */
  get total() { return Infinity; }

  start() { if (this.active) return; this.active = true; this.index = -1; this.ended = false; this.next(); }
  stop() {
    this.active = false; this.queue = [];
    for (const d of this.alive) this.remove(d);
    this.alive = [];
    for (const o of this.orbs) this.scene.remove(o.mesh); this.orbs = [];
  }

  private next() {
    this.index++;
    const w = (this.index < data.waves.length ? data.waves[this.index] : extraWave(this.index - data.waves.length + 1, this.index + 1)) as Record<string, number>;
    this.queue = [];
    for (const [k, n] of Object.entries(w)) for (let i = 0; i < n; i++) this.queue.push(k as keyof typeof KINDS);
    for (let i = this.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; }
    this.spawnT = 0;
  }

  private spawn(kind: keyof typeof KINDS) {
    const k = KINDS[kind];
    const x = (Math.random() - 0.5) * data.spawnWidth;
    const hp = k.health * data.healthScale * (1 + Math.max(0, this.index - data.waves.length + 1) * 0.08);
    const d = new Dummy({ ...k, health: hp }, `wave-${kind}-${Math.random()}`, new THREE.Vector3(x, 0, data.spawnZ), this.overlay, this.onDamage, randomLook());
    d.respawn = false;
    const sp = (data.speed as Record<string, number>)[kind] ?? 2.4, dmg = (data.damage as Record<string, number>)[kind] ?? 8;
    const rg = (data.ranged as Record<string, { range: number; interval: number; orbSpeed: number; orbDamage: number; volleyEvery?: number }>)[kind];
    // (lanzador: se para lejos y dispara esferas; jefe: golpea de cerca y además lanza ráfagas de esferas cada pocos s)
    d.chase = { target: this.player, speed: sp, range: rg?.range ?? data.attackRange, interval: rg?.interval ?? data.attackInterval, damage: dmg, cd: 0.8,
      onAttack: (x) => (rg && !k.boss ? this.orb(d, rg.orbSpeed, rg.orbDamage) : this.ev.onPlayerHit(x)) };
    if (k.boss) { d.alwaysBar = true; if (rg?.volleyEvery) this.volleys.push({ d, every: rg.volleyEvery, t: 2, speed: rg.orbSpeed, dmg: rg.orbDamage }); }
    this.scene.add(d.group); this.dummies.push(d); this.alive.push(d);
  }

  /** Lanza una esfera desde el pecho del enemigo hacia el jugador (con un poco de dispersión). */
  private orb(from: Dummy, speed: number, dmg: number, spread = 0) {
    const at = from.center.clone(), target = this.player().clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = target.sub(at).normalize(); if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread).normalize();
    // (sin luz: el número de luces de la escena es fijo; brillo con material básico y un halo aditivo)
    const m = new THREE.Mesh(orbGeo, new THREE.MeshBasicMaterial({ color: 0xc8f4ff }));
    m.add(new THREE.Mesh(orbHalo, new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.position.copy(at).addScaledVector(dir, 0.6 * (from.kind.scale ?? 1));
    this.scene.add(m); this.orbs.push({ mesh: m, v: dir.multiplyScalar(speed), t: 5, dmg });
  }

  private remove(d: Dummy) {
    this.scene.remove(d.group); d.bar.remove();
    const i = this.dummies.indexOf(d); if (i >= 0) this.dummies.splice(i, 1);
  }

  update(dt: number) {
    // Esferas en vuelo (siguen aunque se pare la oleada un instante)
    const eye = this.player().clone().add(new THREE.Vector3(0, 1.3, 0));
    for (const o of [...this.orbs]) {
      o.t -= dt; o.mesh.position.addScaledVector(o.v, dt); o.mesh.rotation.y += dt * 6;
      const p = o.mesh.position, hit = Math.abs(p.x - eye.x) < 0.55 && Math.abs(p.z - eye.z) < 0.55 && p.y > eye.y - 1.2 && p.y < eye.y + 0.6;
      if (hit) this.ev.onPlayerHit(o.dmg);
      if (hit || o.t <= 0 || p.y < 0) { this.scene.remove(o.mesh); this.orbs.splice(this.orbs.indexOf(o), 1); }
    }
    for (const v of [...this.volleys]) {
      if (!v.d.alive) { this.volleys.splice(this.volleys.indexOf(v), 1); continue; }
      v.t -= dt; if (v.t <= 0) { v.t = v.every; for (const a of [-0.22, -0.11, 0, 0.11, 0.22]) this.orb(v.d, v.speed, v.dmg, a); }
    }
    if (!this.active) return;
    if (this.queue.length) { this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = data.spawnInterval; this.spawn(this.queue.shift()!); } }
    for (const d of [...this.alive]) {
      if (!d.alive) this.lastDead = d;
      if (d.gone) { this.remove(d); this.alive.splice(this.alive.indexOf(d), 1); }
    }
    if (!this.queue.length && !this.alive.some((d) => d.alive)) {
      if (!this.ended) { this.ended = true; this.ev.onWaveEnd(this.index, this.lastDead); this.pauseT = data.pauseBetween; this.lastDead = null; }
      this.pauseT -= dt;
      if (this.pauseT <= 0 && this.active) { this.ended = false; this.next(); }
    }
  }
}

/** Vida del jugador en la sala (solo para las oleadas): regenera tras unos segundos sin recibir daño. */
export class PlayerHealth {
  max = data.player.health; value = data.player.health; private since = 99;
  hit(dmg: number) { this.value = Math.max(0, this.value - dmg); this.since = 0; return this.value <= 0; }
  update(dt: number) { this.since += dt; if (this.since > data.player.regenDelay) this.value = Math.min(this.max, this.value + data.player.regenPerSecond * dt); }
  reset() { this.value = this.max; this.since = 99; }
}
