// Retículas personalizables y coleccionables (tarea 5). Solo lógica (sin DOM): familia de cada óptica, progreso de
// bajas por familia, formas desbloqueadas y avisos de desbloqueo. Datos en src/data/reticles.json.
import data from "../data/reticles.json";
import { RETICLE_IDS, isReticleColor, isReticleId, type ReticleColor, type ReticleId } from "./reticles";

export type OpticFamily = "punto" | "holo" | "aumentos" | "visor";
export interface ReticleUnlock { id: ReticleId; family: OpticFamily; kills: number }
export interface ReticleProgress { kills: Partial<Record<OpticFamily, number>>; unlocked: ReticleId[] }

export const START_RETICLES = (data.start as string[]).filter(isReticleId);
export const RETICLE_UNLOCKS: ReticleUnlock[] = (data.unlocks as { id: string; family: string; kills: number }[])
  .filter((u) => isReticleId(u.id)).map((u) => ({ id: u.id as ReticleId, family: u.family as OpticFamily, kills: u.kills }));

/** Familia de la óptica montada (null: sin óptica que pinte retícula, p. ej. miras de hierro). Mismo criterio que
 *  `reticleFor`: primero el id de la óptica y, si no se conoce, el tipo de mira. */
export function opticFamily(optic: string | null, sight: string): OpticFamily | null {
  if (optic) {
    if (optic.startsWith("k-att-reddot") || optic.startsWith("k-att-reflex") || optic === "acc:reddot") return "punto";
    if (optic.startsWith("k-att-holographic") || optic === "acc:holo") return "holo";
    if (optic.startsWith("k-att-magnified")) return "aumentos";
    if (optic.startsWith("k-att-scope") || optic === "acc:scope2" || optic === "acc:scope6") return "visor";
  }
  return sight === "dot" ? "punto" : sight === "holo" ? "holo" : sight === "scope" ? "visor" : null;
}

/** Progreso nuevo (partida nueva): solo las formas de inicio. */
export const newReticleProgress = (): ReticleProgress => ({ kills: {}, unlocked: [...START_RETICLES] });

/** Migración suave desde una partida guardada (sin el campo, o con datos raros): nunca quita nada ya desbloqueado. */
export function migrateReticles(raw: unknown): ReticleProgress {
  const p = newReticleProgress();
  if (!raw || typeof raw !== "object") return p;
  const r = raw as { kills?: Record<string, unknown>; unlocked?: unknown[] };
  for (const f of ["punto", "holo", "aumentos", "visor"] as OpticFamily[]) {
    const v = Number(r.kills?.[f]); if (Number.isFinite(v) && v > 0) p.kills[f] = Math.floor(v);
  }
  for (const id of r.unlocked ?? []) if (isReticleId(id) && !p.unlocked.includes(id)) p.unlocked.push(id);
  // (si los hitos cambian, lo ya ganado por bajas se reconoce)
  for (const u of RETICLE_UNLOCKS) if ((p.kills[u.family] ?? 0) >= u.kills && !p.unlocked.includes(u.id)) p.unlocked.push(u.id);
  return p;
}

/** Una baja con una óptica de `family`: suma al contador y devuelve las formas que se acaban de desbloquear. */
export function addReticleKill(p: ReticleProgress, family: OpticFamily | null): ReticleId[] {
  if (!family) return [];
  const n = (p.kills[family] ?? 0) + 1; p.kills[family] = n;
  const fresh: ReticleId[] = [];
  for (const u of RETICLE_UNLOCKS) if (u.family === family && n >= u.kills && !p.unlocked.includes(u.id)) { p.unlocked.push(u.id); fresh.push(u.id); }
  return fresh;
}

/** Siguiente hito de una familia (para el contador del menú): forma, bajas que lleva y las que pide; null si no quedan. */
export function nextUnlock(p: ReticleProgress, family: OpticFamily): { id: ReticleId; have: number; need: number } | null {
  const have = p.kills[family] ?? 0;
  const u = RETICLE_UNLOCKS.filter((x) => x.family === family && !p.unlocked.includes(x.id)).sort((a, b) => a.kills - b.kills)[0];
  return u ? { id: u.id, have, need: u.kills } : null;
}

/** Elección de retícula guardada en el arma: id y color válidos (si no, se ignoran y vale la de su óptica). */
export function cleanChoice(spec: { reticle?: unknown; reticleColor?: unknown }): { reticle?: ReticleId; reticleColor?: ReticleColor } {
  return { reticle: isReticleId(spec.reticle) ? spec.reticle : undefined, reticleColor: isReticleColor(spec.reticleColor) ? spec.reticleColor : undefined };
}

/** Todas las formas, desbloqueadas primero (para el selector del taller). */
export function selectorOrder(p: ReticleProgress): { id: ReticleId; locked: boolean }[] {
  const un = new Set(p.unlocked);
  return [...RETICLE_IDS].map((id) => ({ id, locked: !un.has(id) })).sort((a, b) => Number(a.locked) - Number(b.locked));
}
