// Eras de las armas (solo aspecto: no cambian estadísticas, rarezas ni efectos). Datos en src/data/eras.json.
// clásica / moderna / sci-fi salen de la base; la rústica se deriva de bases clásicas o modernas; los kits de
// modernización (nivel 0-3) añaden piezas sci-fi a una base no sci-fi, con adaptadores visibles.
import data from "../data/eras.json";
import type { RarityId } from "./types";
import type { Rng } from "./rng";

export type Era = "classic" | "modern" | "rustic" | "scifi";
export const ERAS: Era[] = ["classic", "modern", "rustic", "scifi"];
interface EraData { finishes: string[]; wear: number; bases: string[] }
const E = data.eras as Record<Era, EraData>;

/** Era propia de una base (por prefijo de id en los datos); por defecto, moderna. */
export function baseEra(baseId: string): Era {
  if (E.scifi.bases.some((p) => baseId.startsWith(p))) return "scifi";
  if (E.classic.bases.some((p) => baseId.startsWith(p))) return "classic";
  return "modern";
}
/** Era final del arma: la de su base o, a veces, rústica (degradada) si la base es clásica o moderna. */
export function rollEra(r: Rng, baseId: string, own?: Era): Era {
  const e = own ?? baseEra(baseId); // (own: era sugerida por el pack del usuario)
  return e !== "scifi" && r() < data.rusticChance ? "rustic" : e;
}
export const eraFinishes = (era: Era) => E[era].finishes;
export const eraWear = (era: Era) => E[era].wear;
/** Nivel de modernización (0-3): más probable en rarezas altas; nunca en armas sci-fi (ya lo son). */
export function rollModernization(r: Rng, era: Era, rarity: RarityId): number {
  if (era === "scifi") return 0;
  const p = (data.modernize as Record<string, number>)[rarity] ?? 0;
  return r() < p ? 1 + Math.floor(r() * 3) : 0;
}
export const BATCH_MIN_ERAS = data.batchMinEras;
