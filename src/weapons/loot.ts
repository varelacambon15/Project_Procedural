// Botín de enemigos (lógica pura; parámetros en src/data/loot.json). Ritmo intermedio: algo cae de vez en cuando
// y el resto se compra. Suelo anti-escasez, tope anti-lluvia y pesos de rareza por origen.
import data from "../data/loot.json";
import type { RarityId } from "./types";
import type { Rng } from "./rng";

export type LootSource = "small" | "normal" | "big" | "waveEnd";
export const LOOT = data;
const RARITY_ORDER: RarityId[] = ["comun", "poco", "rara", "epica", "legendaria"];

/** Decide si una baja suelta arma y de qué rareza. El estado (contadores y tiempos) vive aquí. */
export class LootDirector {
  private killsSince = 0;
  private combatSince = 0;
  private lastDrop = -Infinity;
  private lastCombat = -Infinity;
  constructor(private r: Rng, private cfg = data) {}

  /** Paso de tiempo: los segundos solo cuentan para el suelo mientras hay combate reciente. */
  tick(dt: number, now: number) { if (now - this.lastCombat <= this.cfg.combatWindow) this.combatSince += dt; }
  /** Hubo combate (daño a un enemigo). */
  combat(now: number) { this.lastCombat = now; }

  /**
   * Una baja. Devuelve la rareza del arma que suelta, o null. `onGround` = armas de botín que ya hay en el suelo.
   * Orden: tope por tiempo y en suelo (descarta) > suelo mínimo (fuerza) > probabilidad del origen.
   */
  kill(source: LootSource, now: number, onGround: number): RarityId | null {
    this.killsSince++; this.lastCombat = now;
    const capped = now - this.lastDrop < this.cfg.cap.minInterval || onGround >= this.cfg.cap.maxOnGround;
    const floor = this.killsSince >= this.cfg.floor.kills || this.combatSince >= this.cfg.floor.seconds;
    const chance = (this.cfg.chance as Record<LootSource, number>)[source] ?? 0;
    if (capped || !(floor || this.r() < chance)) return null;
    this.killsSince = 0; this.combatSince = 0; this.lastDrop = now;
    return this.rarity(source);
  }

  rarity(source: LootSource): RarityId {
    const w = (this.cfg.rarity as Record<LootSource, Record<RarityId, number>>)[source];
    const total = RARITY_ORDER.reduce((a, k) => a + w[k], 0);
    let x = this.r() * total;
    for (const k of RARITY_ORDER) { x -= w[k]; if (x < 0) return k; }
    return "comun";
  }
}
