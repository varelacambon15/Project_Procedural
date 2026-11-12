// Máquina expendedora (lógica sin dibujo): niveles con precio y suelo de rareza, progreso de la máquina e historial.
// Datos en src/data/shop.json (propuesta de economía). No sustituye al botín: el precio no depende de él.
import data from "../data/shop.json";
import { RARITIES } from "../weapons/generator";
import type { RarityId } from "../weapons/types";
import type { Rng } from "../weapons/rng";

export const SHOP = data;
export type TierId = string;
export interface ShopTier { id: TierId; price: number; floor: RarityId; unlock: number }
export interface Purchase { tier: TierId; rarity: RarityId; name: string; price: number; at: number }
export interface ShopState { spent: number; history: Purchase[] }
export const newShopState = (): ShopState => ({ spent: 0, history: [] });

export const TIERS = data.tiers as ShopTier[];
const ORDER = RARITIES.map((r) => r.id);

/** Niveles con su estado (desbloqueado según lo gastado, y si te lo puedes permitir). */
export function tiers(state: ShopState, credits: number) {
  return TIERS.map((t) => ({ ...t, unlocked: state.spent >= t.unlock, affordable: credits >= t.price }));
}
/** Nivel de la máquina (cuántos niveles hay desbloqueados) y lo que falta para el siguiente. */
export function machineLevel(state: ShopState) {
  const n = TIERS.filter((t) => state.spent >= t.unlock).length;
  const next = TIERS[n]; return { level: n, next: next ? next.unlock - state.spent : null };
}

/** Probabilidad de cada rareza en un nivel: los pesos normales, solo desde el suelo hacia arriba. */
export function odds(floor: RarityId): Record<RarityId, number> {
  const from = ORDER.indexOf(floor);
  const pool = RARITIES.filter((_, i) => i >= from), total = pool.reduce((a, r) => a + r.weight, 0);
  const out = {} as Record<RarityId, number>;
  for (const r of RARITIES) out[r.id] = ORDER.indexOf(r.id) >= from ? r.weight / total : 0;
  return out;
}
export function rollTier(r: Rng, floor: RarityId): RarityId {
  const o = odds(floor); let x = r();
  for (const id of ORDER) { if (x < o[id]) return id; x -= o[id]; }
  return ORDER[ORDER.length - 1];
}

export type BuyResult = { ok: true; rarity: RarityId; price: number } | { ok: false; reason: "locked" | "credits" | "unknown" };
/** Comprueba y cobra una compra (la rareza sale aquí; el arma la genera quien llama, con esa rareza forzada). */
export function buy(state: ShopState, credits: number, tierId: TierId, r: Rng): BuyResult {
  const t = TIERS.find((x) => x.id === tierId); if (!t) return { ok: false, reason: "unknown" };
  if (state.spent < t.unlock) return { ok: false, reason: "locked" };
  if (credits < t.price) return { ok: false, reason: "credits" };
  state.spent += t.price;
  return { ok: true, rarity: rollTier(r, t.floor), price: t.price };
}
export function record(state: ShopState, p: Purchase) {
  state.history.unshift(p); state.history.length = Math.min(state.history.length, data.historySize);
}
