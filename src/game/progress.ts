// Progresión del jugador a lo Borderlands: nivel (1–100) con experiencia, nivel de las armas respecto al jugador,
// nivel de los enemigos de oleada y árbol de habilidades. Módulo puro (sin DOM ni three); números en progress.json.
import data from "../data/progress.json";

export const PROGRESS = data;
export const MAX_LEVEL = data.maxLevel;
export type Branch = keyof typeof data.skills;
export const BRANCHES = Object.keys(data.skills) as Branch[];
export interface SkillNode { id: string; max: number; stat: string; per: number; req?: number }
export const SKILLS = data.skills as Record<Branch, SkillNode[]>;
const NODE = new Map<string, { node: SkillNode; branch: Branch }>();
for (const b of BRANCHES) for (const n of SKILLS[b]) NODE.set(n.id, { node: n, branch: b });

export interface ProgressState { level: number; xp: number; skills: Record<string, number> }
export const newProgress = (): ProgressState => ({ level: 1, xp: 0, skills: {} });

/** Experiencia para pasar del nivel `l` al siguiente. */
export function xpToNext(l: number): number { return Math.round(data.xp.base + data.xp.mult * Math.pow(Math.max(0, l - 1), data.xp.exp)); }

/** Suma experiencia; devuelve cuántos niveles se han subido. En el nivel máximo la barra se queda llena. */
export function addXp(p: ProgressState, n: number): number {
  if (p.level >= MAX_LEVEL || n <= 0) return 0;
  p.xp += Math.round(n); let up = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) { p.xp -= xpToNext(p.level); p.level++; up++; }
  if (p.level >= MAX_LEVEL) p.xp = 0;
  return up;
}

/** Multiplicador de daño de un arma por su nivel (el mismo que usa el generador: +6 % por nivel desde el 8). */
export const levelDamage = (l: number) => 1 + (l - 8) * 0.06;
/** Vida de un enemigo de nivel `l` respecto a la de diseño (pensada para armas de nivel `refLevel`). */
export const enemyHealthMult = (l: number) => levelDamage(l) / levelDamage(data.weapon.refLevel);
/** Daño que hacen los enemigos de nivel `l` (y vida del jugador de ese nivel) respecto al nivel 1. */
export const enemyDamageMult = (l: number) => 1 + (l - 1) * data.player.enemyDamagePerLevel;
export const playerHealthMult = (l: number) => 1 + (l - 1) * data.player.healthPerLevel;

/** Nivel de un arma nueva para un jugador de nivel `pl` (rnd en [0,1)). */
export function rollWeaponLevel(pl: number, rnd: number): number {
  const [a, b] = data.weapon.spread;
  return Math.max(1, Math.min(MAX_LEVEL, pl + a + Math.floor(rnd * (b - a + 1))));
}
/** Penalización de daño por llevar un arma de nivel superior al tuyo (1 = ninguna). */
export function overPenalty(weaponLevel: number, playerLevel: number): number {
  const d = weaponLevel - playerLevel;
  return d <= 0 ? 1 : Math.max(data.weapon.minMult, 1 - d * data.weapon.overPenalty);
}

/** Nivel de un enemigo de oleada: el del jugador, ajustado por tipo y +1 cada `waveStep` oleadas. */
export function enemyLevel(pl: number, kind: string, wave: number): number {
  const off = (data.enemy.offset as Record<string, number>)[kind] ?? 0;
  return Math.max(1, Math.min(MAX_LEVEL + 5, pl + off + Math.floor(wave / data.enemy.waveStep)));
}
/** Experiencia por baja de oleada. */
export function killXp(kind: string, level: number): number {
  const base = (data.kill as Record<string, number>)[kind] ?? 0;
  return Math.round(base * (1 + data.kill.perLevel * (level - 1)));
}
/** Experiencia al superar la oleada `n` (1, 2, 3…). */
export const waveXp = (n: number, level: number) => Math.round((data.wave.base + data.wave.perWave * n) * (1 + data.kill.perLevel * (level - 1)));

// ---------- Árbol de habilidades ----------
export const pointsEarned = (p: ProgressState) => p.level - 1;
export const pointsSpent = (p: ProgressState) => Object.values(p.skills).reduce((a, b) => a + b, 0);
export const pointsFree = (p: ProgressState) => Math.max(0, pointsEarned(p) - pointsSpent(p));
export const branchPoints = (p: ProgressState, b: Branch) => SKILLS[b].reduce((a, n) => a + (p.skills[n.id] ?? 0), 0);
export const rank = (p: ProgressState, id: string) => p.skills[id] ?? 0;

/** ¿Se puede subir un rango? (hay puntos, no está al máximo y la rama tiene los puntos que pide). */
export function canRaise(p: ProgressState, id: string): boolean {
  const e = NODE.get(id); if (!e) return false;
  return pointsFree(p) > 0 && rank(p, id) < e.node.max && branchPoints(p, e.branch) >= (e.node.req ?? 0);
}
export function raise(p: ProgressState, id: string): boolean { if (!canRaise(p, id)) return false; p.skills[id] = rank(p, id) + 1; return true; }
/** Precio de reiniciar el árbol. */
export const respecCost = (p: ProgressState) => (pointsSpent(p) ? p.level * data.respecPerLevel : 0);
export function respec(p: ProgressState) { p.skills = {}; }

export interface Perks {
  dmg: number; rate: number; critMult: number; ammoSave: number;
  health: number; regen: number; guard: number; regenDelay: number; secondWind: boolean;
  superGain: number; superPower: number; superSpan: number; nadeRecharge: number; speed: number; fortune: number;
}
/** Efecto conjunto del árbol. Multiplicadores (1 = nada); guard = fracción del daño que se recibe. */
export function perks(p: ProgressState): Perks {
  const v = (stat: string) => { let s = 0; for (const [id, r] of Object.entries(p.skills)) { const e = NODE.get(id); if (e && e.node.stat === stat) s += e.node.per * Math.min(r, e.node.max); } return s; };
  const master = v("master") > 0;
  return {
    dmg: 1 + v("dmg") + (master ? 0.1 : 0), rate: 1 + v("rate"), critMult: 1 + v("critMult") + (master ? 0.1 : 0), ammoSave: v("ammoSave"),
    health: 1 + v("health"), regen: 1 + v("regen"), guard: 1 - v("guard"), regenDelay: 1 - v("regenDelay"), secondWind: v("secondWind") > 0,
    superGain: 1 + v("superGain"), superPower: 1 + v("superPower"), superSpan: 1 + v("superSpan"), nadeRecharge: 1 + v("nadeRecharge"),
    speed: 1 + v("speed"), fortune: v("fortune") > 0 ? 1.15 : 1,
  };
}

/** Partidas sin progreso guardado: el jugador empieza al nivel de su mejor arma (sin penalizaciones de golpe). */
export function migrateProgress(saved: Partial<ProgressState> | undefined, weaponLevels: number[]): ProgressState {
  if (saved && typeof saved.level === "number") return { level: Math.max(1, Math.min(MAX_LEVEL, Math.floor(saved.level))), xp: Math.max(0, saved.xp ?? 0), skills: { ...(saved.skills ?? {}) } };
  return { level: Math.max(1, Math.min(MAX_LEVEL, ...(weaponLevels.length ? [Math.max(...weaponLevels)] : [1]))), xp: 0, skills: {} };
}
