// Oleadas cortas de prueba (módulo de la sala de simulación). Datos en src/data/waves.json. Enemigos de solo vida
// que avanzan hacia el jugador, golpean al llegar y mueren (no reaparecen). Sin IA compleja.
import * as THREE from "three";
import data from "../data/waves.json";
import { Dummy, KINDS, randomLook } from "./dummies";
import { enemyDamageMult, enemyHealthMult, enemyLevel } from "./progress";

export interface WaveEvents {
  /** Se ha completado una oleada (para el botín de fin de oleada). */
  onWaveEnd(index: number, last: Dummy | null, reward: number): void;
  /** Empieza una oleada (con su modificador, si lo lleva). */
  onWaveStart?(index: number, mod: WaveModifier | null): void;
  onAllDone(): void;
  onPlayerHit(dmg: number): void;
  /** Un kamikaze ha llegado al jugador y explota (efecto y daño a los de alrededor). */
  onSelfDestruct?(d: Dummy): void;
}

import { WAVE_MODIFIERS, type WaveModifier } from "./wavemods";
const MOD_LIST = Object.keys(WAVE_MODIFIERS) as WaveModifier[];
export type { WaveModifier };

/** Oleada generada n (1, 2, 3…) tras las de diseño: más pequeños y normales, y grandes cada vez más a menudo. */
function extraWave(n: number, wave: number): Record<string, number> {
  // Más variedad: lanzadores, resistentes y élites según avanza; cada `bossEvery` oleadas, el jefe con escolta corta
  if (wave % data.bossEvery === 0) return { warden: 1, basic: 2 + Math.floor(n / 2), caster: 1 + Math.floor(n / 3) };
  const w: Record<string, number> = { small: 3 + Math.floor(n * 0.8), basic: 3 + n, caster: 1 + Math.floor(n / 2), large: Math.floor(n / 2), drone: 1 + Math.floor(n / 2), roller: Math.floor((n + 1) / 2) };
  if (n >= 2) w.spider = 1 + Math.floor(n / 3);
  if (n >= 3) w.turret = Math.floor(n / 3);
  w.gunner = 1 + Math.floor(n / 2);
  if (n >= 2) w.sniper = Math.floor(n / 3) + 1;
  if (n >= 4) w.guardian = Math.floor(n / 4);
  if (n >= 2) w.medic = 1 + Math.floor(n / 4);
  if (n >= 3) w.glitch = Math.floor(n / 3);
  if (n >= 5) w.commander = 1;
  if (n >= 2) w.sturdy = 1 + Math.floor(n / 3);
  if (n >= 4) w.elite = Math.floor(n / 4);
  return w;
}

/** Esfera de energía lanzada por un enemigo: va en línea recta hacia donde estaba el jugador; se puede esquivar. */
interface Orb { mesh: THREE.Mesh; v: THREE.Vector3; t: number; dmg: number }
const orbGeo = new THREE.SphereGeometry(0.22, 12, 8), orbHalo = new THREE.SphereGeometry(0.38, 10, 6);
const bulletGeo = new THREE.BoxGeometry(0.04, 0.04, 0.5), laserGeo = new THREE.BoxGeometry(0.012, 0.012, 1);

export class Waves {
  active = false;
  index = -1;
  private queue: (keyof typeof KINDS)[] = [];
  private spawnT = 0; private pauseT = 0;
  private alive: Dummy[] = [];
  private lastDead: Dummy | null = null;
  private ended = false;
  private orbs: Orb[] = [];
  /** Modificador de la oleada en curso. */ mod: WaveModifier | null = null;
  private volleys: { d: Dummy; every: number; t: number; speed: number; dmg: number }[] = [];
  /** Ráfagas de los soldados (balas que quedan) y punterías del francotirador (láser antes de disparar). */
  private bursts: { d: Dummy; n: number; t: number; speed: number; dmg: number }[] = [];
  private aims: { d: Dummy; t: number; line: THREE.Mesh; speed: number; dmg: number }[] = [];
  /** Nivel del jugador (los enemigos se ajustan a él). Sin asignar, los de diseño (sin escalar). */
  playerLevel: (() => number) | null = null;
  /** Señuelo (súper): si hay uno, los enemigos van a por él en lugar de a por el jugador. */
  decoy: (() => THREE.Vector3 | null) | null = null;

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
    this.volleys = []; // (si no, el jefe ya retirado seguía lanzando ráfagas)
    this.bursts = []; for (const a of this.aims) this.scene.remove(a.line); this.aims = [];
    for (const b of this.beams) this.scene.remove(b.m); this.beams = [];
  }

  private next() {
    this.index++;
    const w = (this.index < data.waves.length ? data.waves[this.index] : extraWave(this.index - data.waves.length + 1, this.index + 1)) as Record<string, number>;
    this.queue = [];
    for (const [k, n] of Object.entries(w)) for (let i = 0; i < n; i++) this.queue.push(k as keyof typeof KINDS);
    for (let i = this.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; }
    // Modificador: 40 % de las oleadas desde la 3.ª, nunca con jefe
    const boss = "warden" in w;
    this.mod = this.index >= 2 && !boss && Math.random() < 0.4 ? MOD_LIST[Math.floor(Math.random() * MOD_LIST.length)] : null;
    if (this.mod) for (let i = 0; i < WAVE_MODIFIERS[this.mod].extraSmall; i++) this.queue.push("small");
    this.spawnT = 0;
    this.ev.onWaveStart?.(this.index, this.mod);
  }

  private spawn(kind: keyof typeof KINDS) { this.spawnAt(kind, new THREE.Vector3((Math.random() - 0.5) * data.spawnWidth, 0, data.spawnZ)); }
  /** Crea un enemigo de oleada en un punto (también lo usan las incursiones). */
  spawnAt(kind: keyof typeof KINDS, pos: THREE.Vector3): Dummy {
    const k = KINDS[kind];
    const M = this.mod ? WAVE_MODIFIERS[this.mod] : null;
    const lv = this.playerLevel ? enemyLevel(this.playerLevel(), kind, this.index) : k.level;
    const lm = this.playerLevel ? enemyHealthMult(lv) : 1, dm = this.playerLevel ? enemyDamageMult(lv) : 1;
    const hp = k.health * lm * data.healthScale * (1 + Math.max(0, this.index - data.waves.length + 1) * 0.08) * (M && !k.boss ? M.hp : 1);
    const d = new Dummy({ ...k, health: hp, level: lv }, `wave-${kind}-${Math.random()}`, pos, this.overlay, this.onDamage, randomLook());
    d.respawn = false;
    const sp = ((data.speed as Record<string, number>)[kind] ?? 2.4) * (M && !k.boss ? M.speed : 1), dmg = ((data.damage as Record<string, number>)[kind] ?? 8) * (M ? M.dmg : 1) * dm;
    const rg = (data.ranged as Record<string, { range: number; interval: number; orbSpeed: number; orbDamage: number; volleyEvery?: number }>)[kind];
    // (lanzador: se para lejos y dispara esferas; jefe: golpea de cerca y además lanza ráfagas de esferas cada pocos s)
    d.chase = { target: () => this.decoy?.() ?? this.player(), speed: sp, range: rg?.range ?? (k.shape === "roller" ? 1.4 : data.attackRange), interval: rg?.interval ?? data.attackInterval, damage: dmg, cd: 0.8,
      onAttack: (x) => {
        if (k.shape === "roller") { this.ev.onPlayerHit(x); this.ev.onSelfDestruct?.(d); return; } // (el kamikaze explota al llegar)
        const od = (rg?.orbDamage ?? 0) * (M ? M.dmg : 1) * dm;
        if (kind === "medic") { this.healBeam(d); return; }
        if (k.gun === "rifle" && rg) { this.bursts.push({ d, n: 3, t: 0, speed: rg.orbSpeed, dmg: od }); return; }
        if (k.gun === "sniper" && rg) { this.aimAt(d, rg.orbSpeed, od); return; }
        if (rg && !k.boss) this.orb(d, rg.orbSpeed, od); else this.ev.onPlayerHit(x);
      } };
    if (kind === "commander") { const ring = new THREE.Mesh(new THREE.RingGeometry(9.6, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; d.group.add(ring); }
    if (k.boss) { d.alwaysBar = true; if (rg?.volleyEvery) this.volleys.push({ d, every: rg.volleyEvery, t: 2, speed: rg.orbSpeed, dmg: rg.orbDamage * dm }); }
    this.scene.add(d.group); this.dummies.push(d); this.alive.push(d);
    return d;
  }
  /** Enemigos vivos de este gestor. */
  get living() { return this.alive.filter((d) => d.alive).length; }

  /** Lanza una esfera desde el pecho del enemigo hacia el jugador (con un poco de dispersión). */
  private orb(from: Dummy, speed: number, dmg: number, spread = 0, bullet = false) {
    if (!from.alive) return;
    const at = from.center.clone(), target = (this.decoy?.() ?? this.player()).clone().add(new THREE.Vector3(0, 1.4, 0));
    if (bullet) at.y += 0.05 * (from.kind.scale ?? 1); // (las balas salen del arma, a la altura del pecho)
    const dir = target.sub(at).normalize(); if (spread) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spread).normalize();
    // (sin luz: el número de luces de la escena es fijo; brillo con material básico y un halo aditivo)
    const m = new THREE.Mesh(bullet ? bulletGeo : orbGeo, new THREE.MeshBasicMaterial({ color: bullet ? 0xffe2a0 : 0xc8f4ff }));
    if (bullet) m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    else m.add(new THREE.Mesh(orbHalo, new THREE.MeshBasicMaterial({ color: 0x4ad8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.position.copy(at).addScaledVector(dir, 0.6 * (from.kind.scale ?? 1));
    this.scene.add(m); this.orbs.push({ mesh: m, v: dir.multiplyScalar(speed), t: 5, dmg });
  }

  /** Médico: cura al aliado más herido cerca (rayo verde visible). */
  private healBeam(d: Dummy) {
    const t = this.alive.filter((x) => x !== d && x.alive && x.hurt > 0.02 && x.center.distanceTo(d.center) < 11).sort((a, b) => b.hurt - a.hurt)[0];
    if (!t) return;
    t.heal(t.layers[t.layers.length - 1].max * 0.06);
    const line = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: 0x4aff9a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    const a = d.center, b = t.center; line.scale.set(4, 4, a.distanceTo(b)); line.position.copy(a).lerp(b, 0.5); line.lookAt(b);
    this.scene.add(line); this.beams.push({ m: line, t: 0.3 });
  }
  private beams: { m: THREE.Mesh; t: number }[] = [];
  /** Francotirador: un láser rojo te sigue 1,2 s y luego dispara una bala muy rápida (moverse la esquiva). */
  private aimAt(d: Dummy, speed: number, dmg: number) {
    if (this.aims.some((a) => a.d === d)) return;
    const line = new THREE.Mesh(laserGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.scene.add(line); this.aims.push({ d, t: 1.2, line, speed, dmg });
  }
  /** Quita los cuerpos que ya han desaparecido (con las oleadas paradas, p. ej. en una incursión). */
  private tidy() { for (const d of [...this.alive]) if (d.gone) { this.remove(d); this.alive.splice(this.alive.indexOf(d), 1); } }
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
    for (const b of [...this.beams]) { b.t -= dt; (b.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.t / 0.3) * 0.8; if (b.t <= 0) { this.scene.remove(b.m); this.beams.splice(this.beams.indexOf(b), 1); } }
    // Comandante: los suyos a menos de 10 m van más rápido y pegan más fuerte (anillo bajo él)
    for (const c of this.alive) if (c.alive && c.kind.key === "commander") { for (const o of this.alive) if (o !== c && o.alive && o.group.position.distanceTo(c.group.position) < 10) o.buffT = 0.3; }
    for (const b of [...this.bursts]) {
      b.t -= dt; if (b.t > 0) continue;
      if (!b.d.alive || b.n <= 0) { this.bursts.splice(this.bursts.indexOf(b), 1); continue; }
      b.n--; b.t = 0.13; this.orb(b.d, b.speed, b.dmg, (Math.random() - 0.5) * 0.06, true);
    }
    for (const a of [...this.aims]) {
      a.t -= dt; const from = a.d.center.add(new THREE.Vector3(0, 0.05, 0)), to = (this.decoy?.() ?? this.player()).clone().add(new THREE.Vector3(0, 1.4, 0)), len = from.distanceTo(to);
      a.line.scale.set(1, 1, len); a.line.position.copy(from).lerp(to, 0.5); a.line.lookAt(to);
      (a.line.material as THREE.MeshBasicMaterial).opacity = 0.25 + 0.5 * (1 - a.t / 1.2) * (Math.sin(a.t * 40) > -0.3 ? 1 : 0.4);
      if (a.t <= 0 || !a.d.alive) { this.scene.remove(a.line); this.aims.splice(this.aims.indexOf(a), 1); if (a.d.alive) this.orb(a.d, a.speed, a.dmg, 0, true); }
    }
    for (const v of [...this.volleys]) {
      if (!v.d.alive || !this.alive.includes(v.d)) { this.volleys.splice(this.volleys.indexOf(v), 1); continue; }
      v.t -= dt; if (v.t <= 0) { v.t = v.every; for (const a of [-0.22, -0.11, 0, 0.11, 0.22]) this.orb(v.d, v.speed, v.dmg, a); }
    }
    if (!this.active) { this.tidy(); return; }
    if (this.queue.length) { this.spawnT -= dt; if (this.spawnT <= 0) { this.spawnT = data.spawnInterval; this.spawn(this.queue.shift()!); } }
    for (const d of [...this.alive]) {
      if (!d.alive) this.lastDead = d;
      if (d.gone) { this.remove(d); this.alive.splice(this.alive.indexOf(d), 1); }
    }
    if (!this.queue.length && !this.alive.some((d) => d.alive)) {
      if (!this.ended) { this.ended = true; this.ev.onWaveEnd(this.index, this.lastDead, this.mod ? WAVE_MODIFIERS[this.mod].reward : 1); this.pauseT = data.pauseBetween; this.lastDead = null; }
      this.pauseT -= dt;
      if (this.pauseT <= 0 && this.active) { this.ended = false; this.next(); }
    }
  }
}

/** Vida del jugador en la sala (solo para las oleadas): regenera tras unos segundos sin recibir daño. */
export class PlayerHealth {
  static readonly BASE = data.player.health;
  max = data.player.health; value = data.player.health; private since = 99;
  /** Sin regeneración (modificador de oleada). */ noRegen = false;
  /** Nivel y habilidades: regeneración más rápida y espera más corta. */ regenMult = 1; delayMult = 1;
  /** Cambia la vida máxima (nivel, habilidades) manteniendo la proporción de vida actual. */
  setMax(m: number) { m = Math.round(m); if (m === this.max) return; this.value = (this.value / this.max) * m; this.max = m; }
  hit(dmg: number) { this.value = Math.max(0, this.value - dmg); this.since = 0; return this.value <= 0; }
  update(dt: number) { this.since += dt; if (!this.noRegen && this.since > data.player.regenDelay * this.delayMult) this.value = Math.min(this.max, this.value + data.player.regenPerSecond * this.regenMult * (this.max / data.player.health) * dt); }
  reset() { this.value = this.max; this.since = 99; }
}
