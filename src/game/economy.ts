// Simulación de la economía (05-D): una hora de juego con suposiciones explícitas (bajas por minuto y su mezcla,
// duración de las oleadas) usando la MISMA lógica que el juego: botín (LootDirector), escaparate y cajas (shop.ts).
// Jugador simulado sencillo: mejora su mejor arma por la vía más barata que tenga a mano y desguaza la anterior.
// Sirve para la tabla de economía y para los tests de bandas objetivo; los números se ajustan en shop.json.
import data from "../data/shop.json";
import { LootDirector, type LootSource } from "../weapons/loot";
import { mulberry32 } from "../weapons/rng";
import type { RarityId } from "../weapons/types";
import { CRATES, SHOWCASE, ensureShowcase, openCrate, showcasePrice, showcaseRarities, type ShopState } from "./shop";

const ORDER: RarityId[] = ["comun", "poco", "rara", "epica", "legendaria"];
const rank = (r: RarityId) => ORDER.indexOf(r);
type Src = "shop" | "crate" | "loot";
export interface SimResult {
  /** Minuto de la primera compra (escaparate o caja). */
  firstBuy: number | null;
  /** Minuto en que se consigue la primera arma de cada rareza, en total y por vía. */
  first: Record<"rara" | "epica" | "legendaria", Record<Src | "any", number | null>>;
  bought: number; crates: { common: number; advanced: number }; pickups: number;
  earned: number; spent: number; credits: number;
}
const SIM = (data as unknown as { simulation: { minutes: number; killsPerMinute: number; mix: Record<"small" | "normal" | "big", number>; waveSeconds: number; runs: number }; income: Record<string, number>; scrap: Record<RarityId, number>; startCredits: number }).simulation;

export function simulate(minutes = SIM.minutes, seed = 1, o: { killsPerMinute?: number } = {}): SimResult {
  const r = mulberry32(seed), loot = new LootDirector(mulberry32(seed * 31 + 7));
  const D = data as unknown as { income: Record<string, number>; scrap: Record<RarityId, number>; startCredits: number };
  const kpm = o.killsPerMinute ?? SIM.killsPerMinute;
  const st: ShopState = { spent: 0, history: [] };
  let credits = D.startCredits, best: RarityId = "comun", earned = 0, spent = 0, bought = 0, pickups = 0, firstBuy: number | null = null;
  const crates = { common: 0, advanced: 0 };
  const first: SimResult["first"] = { rara: { any: null, shop: null, crate: null, loot: null }, epica: { any: null, shop: null, crate: null, loot: null }, legendaria: { any: null, shop: null, crate: null, loot: null } };
  const got = (rar: RarityId, src: Src, t: number) => {
    const m = +(t / 60).toFixed(2);
    for (const k of ["rara", "epica", "legendaria"] as const) if (rank(rar) >= rank(k)) { first[k][src] ??= m; first[k].any ??= m; }
    if (rank(rar) > rank(best)) { credits += D.scrap[best]; earned += D.scrap[best]; best = rar; } // la vieja se desguaza
    else { credits += D.scrap[rar]; earned += D.scrap[rar]; } // lo que no mejora, se desguaza
  };
  const pay = (c: number, t: number) => { credits -= c; spent += c; bought++; firstBuy ??= +(t / 60).toFixed(2); };
  const earn = (c: number) => { credits += c; earned += c; };
  const mix = Object.entries(SIM.mix) as [LootSource, number][];
  for (let t = 0; t < minutes * 60; t++) {
    loot.tick(1, t);
    // Bajas (Poisson aproximado por segundo) y fin de oleada
    if (r() < kpm / 60) {
      let x = r(), src: LootSource = "normal"; for (const [k, w] of mix) { if (x < w) { src = k; break; } x -= w; }
      earn(D.income[src] ?? 5);
      const drop = loot.kill(src, t, 0); if (drop) { pickups++; got(drop, "loot", t); }
    }
    if (t > 0 && t % SIM.waveSeconds === 0) { earn(D.income.waveEnd ?? 25); const drop = loot.kill("waveEnd", t, 0); if (drop) { pickups++; got(drop, "loot", t); } }
    if (t % 10 !== 0) continue;
    // Tienda: escaparate (la ranura más alta que mejore y se pueda pagar) y, si no, caja según lo que falte
    const sc = ensureShowcase(st, t, seed * 7 + 3);
    const rar = showcaseRarities(sc);
    const opts = rar.map((x, i) => ({ x, i, p: showcasePrice(x, 8) })).filter((v) => !sc.sold[v.i] && rank(v.x) > rank(best) && v.p <= credits).sort((a, b) => rank(b.x) - rank(a.x));
    if (opts.length) { sc.sold[opts[0].i] = true; pay(opts[0].p, t); got(opts[0].x, "shop", t); continue; }
    const upcoming = rar.some((x, i) => !sc.sold[i] && rank(x) > rank(best)); // ahorra si en el escaparate hay algo mejor
    if (rank(best) <= rank("poco") && !upcoming && credits >= CRATES.common.price) {
      const c = openCrate(st, credits, "common", r); if (c.ok) { crates.common++; pay(c.price, t); got(c.rarity, "crate", t); }
    } else if (rank(best) >= rank("rara") && !upcoming && credits >= CRATES.advanced.price) {
      const c = openCrate(st, credits, "advanced", r); if (c.ok) { crates.advanced++; pay(c.price, t); got(c.rarity, "crate", t); }
    }
  }
  return { firstBuy, first, bought, crates, pickups, earned, spent, credits };
}

/** Resumen de muchas partidas simuladas: medianas (null = no llega en el tiempo simulado) y probabilidades. */
export function summary(runs = SIM.runs, minutes = SIM.minutes) {
  const res = Array.from({ length: runs }, (_, i) => simulate(minutes, i * 97 + 13));
  const med = (xs: (number | null)[]) => { const v = xs.map((x) => x ?? Infinity).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const pct = (xs: (number | null)[]) => xs.filter((x) => x !== null).length / xs.length;
  const out = {
    firstBuy: med(res.map((x) => x.firstBuy)),
    first: Object.fromEntries((["rara", "epica", "legendaria"] as const).map((k) => [k, Object.fromEntries((["any", "shop", "crate", "loot"] as const).map((s) => [s, med(res.map((x) => x.first[k][s]))]))])) as Record<"rara" | "epica" | "legendaria", Record<Src | "any", number>>,
    within: Object.fromEntries((["rara", "epica", "legendaria"] as const).map((k) => [k, pct(res.map((x) => x.first[k].any))])) as Record<"rara" | "epica" | "legendaria", number>,
    bought: med(res.map((x) => x.bought)), cratesCommon: med(res.map((x) => x.crates.common)), cratesAdvanced: med(res.map((x) => x.crates.advanced)),
    pickups: med(res.map((x) => x.pickups)), earned: med(res.map((x) => x.earned)), spent: med(res.map((x) => x.spent)), credits: med(res.map((x) => x.credits)),
  };
  return out;
}
export const SIM_ASSUMPTIONS = SIM;
export const SHOWCASE_SLOTS = SHOWCASE.slots;
