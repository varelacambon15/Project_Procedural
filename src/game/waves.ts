// Oleadas cortas de prueba (módulo de la sala de simulación). Datos en src/data/waves.json. Enemigos de solo vida
// que avanzan hacia el jugador, golpean al llegar y mueren (no reaparecen). Sin IA compleja.
import * as THREE from "three";
import data from "../data/waves.json";
import { Dummy, KINDS } from "./dummies";

export interface WaveEvents {
  /** Se ha completado una oleada (para el botín de fin de oleada). */
  onWaveEnd(index: number, last: Dummy | null): void;
  onAllDone(): void;
  onPlayerHit(dmg: number): void;
}

export class Waves {
  active = false;
  index = -1;
  private queue: (keyof typeof KINDS)[] = [];
  private spawnT = 0; private pauseT = 0;
  private alive: Dummy[] = [];
  private lastDead: Dummy | null = null;
  private ended = false;

  constructor(private scene: THREE.Scene, private dummies: Dummy[], private overlay: HTMLElement, private player: () => THREE.Vector3,
    private onDamage: ConstructorParameters<typeof Dummy>[4], private ev: WaveEvents) {}

  get remaining() { return this.queue.length + this.alive.filter((d) => d.alive).length; }
  get total() { return data.waves.length; }

  start() { if (this.active) return; this.active = true; this.index = -1; this.ended = false; this.next(); }
  stop() {
    this.active = false; this.queue = [];
    for (const d of this.alive) this.remove(d);
    this.alive = [];
  }

  private next() {
    this.index++;
    if (this.index >= data.waves.length) { this.active = false; this.ev.onAllDone(); return; }
    const w = data.waves[this.index] as Record<string, number>;
    this.queue = [];
    for (const [k, n] of Object.entries(w)) for (let i = 0; i < n; i++) this.queue.push(k as keyof typeof KINDS);
    for (let i = this.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]]; }
    this.spawnT = 0;
  }

  private spawn(kind: keyof typeof KINDS) {
    const k = KINDS[kind];
    const x = (Math.random() - 0.5) * data.spawnWidth;
    const d = new Dummy({ ...k, health: k.health * data.healthScale }, `wave-${kind}-${Math.random()}`, new THREE.Vector3(x, 0, data.spawnZ), this.overlay, this.onDamage);
    d.respawn = false;
    const sp = (data.speed as Record<string, number>)[kind] ?? 2.4, dmg = (data.damage as Record<string, number>)[kind] ?? 8;
    d.chase = { target: this.player, speed: sp, range: data.attackRange, interval: data.attackInterval, damage: dmg, onAttack: (x) => this.ev.onPlayerHit(x), cd: 0.5 };
    this.scene.add(d.group); this.dummies.push(d); this.alive.push(d);
  }

  private remove(d: Dummy) {
    this.scene.remove(d.group); d.bar.remove();
    const i = this.dummies.indexOf(d); if (i >= 0) this.dummies.splice(i, 1);
  }

  update(dt: number) {
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
