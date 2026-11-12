// Tienda (lógica sin dibujo). Arriba, la máquina con niveles anterior (sustituida en el 05-D por el escaparate y las
// cajas de abajo; se conserva por compatibilidad de partidas y sus tests): niveles con precio y suelo de rareza.
// Datos en src/data/shop.json (propuesta de economía). No sustituye al botín: el precio no depende de él.
import data from "../data/shop.json";
import { RARITIES } from "../weapons/generator";
import type { RarityId } from "../weapons/types";
import { mulberry32, type Rng } from "../weapons/rng";

export const SHOP = data;
export type TierId = string;
export interface ShopTier { id: TierId; price: number; floor: RarityId; unlock: number }
/** Compra del historial: `tier` = de dónde salió (nivel de la máquina antigua, "shop:<ranura>" o "crate:<caja>"). */
export interface Purchase { tier: TierId; rarity: RarityId; name: string; price: number; at: number }
export interface ShopState { spent: number; history: Purchase[]; showcase?: ShowcaseState; pity?: number }
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

// ---------- Escaparate y cajas (05-D): sustituyen a la máquina con niveles de arriba (que se conserva) ----------
export interface ShowcaseState { seed: number; round: number; refreshAt: number; sold: boolean[] }
export type CrateId = "common" | "advanced";
export const SHOWCASE = (data as unknown as { showcase: { refreshMinutes: number; slots: RarityId[][]; price: Record<string, number>; levelStep: number } }).showcase;
export const CRATES = (data as unknown as { crates: Record<CrateId, { price: number; odds: Partial<Record<RarityId, number>>; pity?: number }> }).crates;

/** Escaparate al día: lo crea si no hay y lo renueva cuando pasa su tiempo (tiempo de juego; se pausa con el juego). */
export function ensureShowcase(st: ShopState & { showcase?: ShowcaseState }, gameTime: number, seed = Math.floor(Math.random() * 2 ** 31)): ShowcaseState {
  const period = SHOWCASE.refreshMinutes * 60;
  if (!st.showcase) st.showcase = { seed, round: 0, refreshAt: gameTime + period, sold: SHOWCASE.slots.map(() => false) };
  const sc = st.showcase;
  if (gameTime >= sc.refreshAt) {
    // Si han pasado varios periodos, se salta a la ronda que toca (sin generar los intermedios)
    const k = Math.floor((gameTime - sc.refreshAt) / period) + 1;
    sc.round += k; sc.refreshAt += k * period; sc.sold = SHOWCASE.slots.map(() => false);
  }
  return sc;
}
/** Rareza de cada ranura en la ronda actual (composición por ranura; nunca legendaria). */
export function showcaseRarities(sc: ShowcaseState): RarityId[] {
  const r = mulberry32((sc.seed ^ Math.imul(sc.round + 1, 2654435761)) >>> 0);
  return SHOWCASE.slots.map((pair) => pair[Math.floor(r() * pair.length)]);
}
/** Semilla del arma de una ranura (la misma ronda da siempre las mismas armas: recargar no cambia el escaparate). */
export const showcaseSeed = (sc: ShowcaseState, i: number) => ((sc.seed + Math.imul(sc.round + 1, 7919) + i * 104729) >>> 0) % 2 ** 31;
/** Precio de un arma del escaparate: por rareza y nivel (redondeado a 5). */
export function showcasePrice(rarity: RarityId, level: number): number {
  const base = SHOWCASE.price[rarity] ?? 0;
  return Math.max(5, Math.round((base * (1 + (level - 8) * SHOWCASE.levelStep)) / 5) * 5);
}
export type ShowcaseBuy = { ok: true; price: number } | { ok: false; reason: "sold" | "credits" | "unknown" };
/** Compra la ranura `i` (al precio que se le pasa, el que se ve). Cada arma se vende una sola vez por ronda. */
export function buyShowcase(sc: ShowcaseState, credits: number, i: number, price: number): ShowcaseBuy {
  if (i < 0 || i >= sc.sold.length) return { ok: false, reason: "unknown" };
  if (sc.sold[i]) return { ok: false, reason: "sold" };
  if (credits < price) return { ok: false, reason: "credits" };
  sc.sold[i] = true;
  return { ok: true, price };
}

/** Probabilidades de una caja (y la garantía: cuántas avanzadas faltan para la legendaria segura). */
export function crateOdds(id: CrateId): Record<RarityId, number> {
  const o = CRATES[id].odds, out = {} as Record<RarityId, number>;
  const tot = Object.values(o).reduce((a, b) => a + (b ?? 0), 0);
  for (const r of RARITIES) out[r.id] = (o[r.id] ?? 0) / tot;
  return out;
}
export type CrateOpen = { ok: true; rarity: RarityId; price: number; pity: boolean } | { ok: false; reason: "credits" | "unknown" };
/** Abre una caja: cobra, sortea la rareza y aplica la garantía de la avanzada (legendaria tras `pity` sin salir). */
export function openCrate(st: ShopState & { pity?: number }, credits: number, id: CrateId, r: Rng): CrateOpen {
  const c = CRATES[id]; if (!c) return { ok: false, reason: "unknown" };
  if (credits < c.price) return { ok: false, reason: "credits" };
  const o = crateOdds(id); let x = r(), rarity: RarityId = "comun";
  for (const k of ORDER) { if (x < o[k]) { rarity = k; break; } x -= o[k]; rarity = k; }
  let pity = false;
  if (id === "advanced" && c.pity) {
    const since = (st.pity ?? 0) + 1;
    if (rarity !== "legendaria" && since >= c.pity) { rarity = "legendaria"; pity = true; }
    st.pity = rarity === "legendaria" ? 0 : since;
  }
  return { ok: true, rarity, price: c.price, pity };
}
/** Cajas avanzadas que faltan, como mucho, para la legendaria garantizada. */
export const pityLeft = (st: ShopState & { pity?: number }) => Math.max(1, (CRATES.advanced.pity ?? 0) - (st.pity ?? 0));
