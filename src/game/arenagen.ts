// Arena de oleadas generada (pura, sin three): coberturas al azar en la sala de oleadas, con un pasillo libre en la
// entrada y en la línea de aparición. Cada 5 oleadas (tras el jefe) la arena muta un poco: se mueven, quitan y
// añaden algunas coberturas y cambia el color de acento. La misma semilla da siempre la misma arena.
import { rng } from "./raidgen";

export type ArenaPiece = "crate" | "wall" | "pillar" | "barrier" | "pylon";
export interface ArenaCover { id: number; kind: ArenaPiece; x: number; z: number; w: number; d: number; h: number }
export interface ArenaLayout { seed: number; stage: number; accent: number; covers: ArenaCover[] }
/** Zona útil de la arena (en coordenadas del mundo; ver world.ts `wavesRoom`). */
export interface ArenaBounds { x0: number; x1: number; z0: number; z1: number }

export const ACCENTS = [0xe07a2a, 0x3fd0d8, 0xc99a2e, 0x7affc8, 0xff4a6a, 0xa070ff];

let nextId = 1;
function piece(r: () => number, b: ArenaBounds): ArenaCover {
  const x = r(), kind: ArenaPiece = x < 0.38 ? "crate" : x < 0.58 ? "wall" : x < 0.74 ? "pillar" : x < 0.9 ? "barrier" : "pylon";
  const rot = r() < 0.5;
  const [w, d, h] = kind === "crate" ? [1.4 + r() * 1.8, 1.2 + r() * 1.2, 1.0 + r() * 0.5]
    : kind === "wall" ? [3 + r() * 3, 0.6, 2.2 + r() * 1.2] : kind === "pillar" ? [1.2, 1.2, 5] : kind === "barrier" ? [2.4 + r() * 2, 0.5, 1.1] : [0.7, 0.7, 2.6];
  return { id: nextId++, kind, x: b.x0 + 3 + r() * (b.x1 - b.x0 - 6), z: b.z0 + 9 + r() * (b.z1 - b.z0 - 23), w: rot && kind !== "pillar" ? d : w, d: rot && kind !== "pillar" ? w : d, h };
}
const clash = (a: ArenaCover, list: ArenaCover[]) => list.some((c) => c !== a && Math.abs(c.x - a.x) < (c.w + a.w) / 2 + 2 && Math.abs(c.z - a.z) < (c.d + a.d) / 2 + 2);
/** Libre: pasillo central desde la entrada (los primeros metros) y sin pisarse con otras. */
const fits = (a: ArenaCover, list: ArenaCover[], b: ArenaBounds) => !clash(a, list) && !(Math.abs(a.x - (b.x0 + b.x1) / 2) < 3 && a.z < b.z0 + 14);

export function generateArena(seed: number, b: ArenaBounds, count = 22): ArenaLayout {
  const r = rng(seed), covers: ArenaCover[] = [];
  for (let tries = 0; covers.length < count && tries < 400; tries++) { const c = piece(r, b); if (fits(c, covers, b)) covers.push(c); }
  return { seed, stage: 0, accent: ACCENTS[Math.floor(r() * ACCENTS.length)], covers };
}

/** Cambio ligero tras el jefe: ~25 % fuera, otras tantas nuevas, ~30 % se desplazan un poco; otro color de acento. */
export function mutateArena(prev: ArenaLayout, b: ArenaBounds): ArenaLayout {
  const stage = prev.stage + 1, r = rng(prev.seed * 31 + stage * 7919);
  let covers = prev.covers.filter(() => r() > 0.25).map((c) => ({ ...c }));
  const removed = prev.covers.length - covers.length;
  for (const c of covers) if (r() < 0.3) { const old = { x: c.x, z: c.z }; c.x += (r() - 0.5) * 4; c.z += (r() - 0.5) * 4; if (!fits(c, covers, b) || c.x < b.x0 + 2 || c.x > b.x1 - 2) { c.x = old.x; c.z = old.z; } }
  for (let i = 0, tries = 0; i < removed && tries < 200; tries++) { const c = piece(r, b); if (fits(c, covers, b)) { covers.push(c); i++; } }
  covers = covers.slice(0, prev.covers.length + 2);
  let accent = prev.accent; while (accent === prev.accent) accent = ACCENTS[Math.floor(r() * ACCENTS.length)];
  return { seed: prev.seed, stage, accent, covers };
}
