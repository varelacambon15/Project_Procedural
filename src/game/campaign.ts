// Campaña «Hack» (tarea 3, fase a): modelo de datos puro (sin three ni DOM). Los niveles salen de una TABLA
// (`src/data/campaign.json`), no de código por nivel. Aquí: validación de la tabla, plan de un nivel a partir de su
// semilla (en qué sala va cada objetivo, dónde está el cofre), estado guardado (desbloqueos, estrellas, mejores
// tiempos), cierre de un nivel con sus recompensas, y migración suave de partidas antiguas.
// La campaña SUSTITUYE al modo hack por sectores (hackgen.ts); defensa, arena e incursión no cambian.
import data from "../data/campaign.json";
import { rng } from "./raidgen";
import { WAVE_MODIFIERS, type WaveModifier } from "./wavemods";
import type { RarityId } from "../weapons/types";

export type ObjectiveType = "clear" | "eliminate" | "hack" | "destroy" | "retrieve" | "survive" | "boss" | "extract";
export const OBJECTIVE_TYPES: readonly ObjectiveType[] = ["clear", "eliminate", "hack", "destroy", "retrieve", "survive", "boss", "extract"];
export interface Objective { type: ObjectiveType; /** hack: segundos */ hold?: number; /** destroy */ count?: number; hp?: number; /** survive */ waves?: number; /** eliminate */ target?: string; /** boss */ boss?: string }
export type OptionalType = "chest" | "time" | "nodamage";
export interface Optional { type: OptionalType; /** time: s */ limit?: number; /** nodamage: daño máximo */ max?: number }
export interface CampaignLevel {
  id: string; theme: string; rooms: number; difficulty: 0 | 1 | 2; mod: WaveModifier | null;
  objectives: Objective[]; optionals: Optional[];
  reward: { credits: number; rarity: RarityId; firstBonus: number };
}

const RARITY_IDS: readonly RarityId[] = ["comun", "poco", "rara", "epica", "legendaria"];
/** Objetivos que van ligados a una sala (los demás, extract, van en la salida). */
const IN_ROOM: readonly ObjectiveType[] = ["clear", "eliminate", "hack", "destroy", "retrieve", "survive", "boss"];

/** Errores de una tabla de niveles (vacío = válida). Se comprueba en los tests y al arrancar en modo desarrollador. */
export function validateLevels(levels: readonly CampaignLevel[]): string[] {
  const err: string[] = [], ids = new Set<string>();
  levels.forEach((l, i) => {
    const at = `${l.id ?? "?"} (#${i + 1})`;
    if (!l.id || ids.has(l.id)) err.push(`${at}: id vacío o repetido`); ids.add(l.id);
    if (!(l.rooms >= 3 && l.rooms <= 6)) err.push(`${at}: salas fuera de 3–6`);
    if (![0, 1, 2].includes(l.difficulty)) err.push(`${at}: dificultad`);
    if (l.mod !== null && !(l.mod in WAVE_MODIFIERS)) err.push(`${at}: modificador ${l.mod}`);
    if (!l.objectives.length) err.push(`${at}: sin objetivos`);
    for (const o of l.objectives) {
      if (!OBJECTIVE_TYPES.includes(o.type)) err.push(`${at}: objetivo ${o.type}`);
      if (o.type === "hack" && !((o.hold ?? 0) > 0)) err.push(`${at}: hack sin segundos`);
      if (o.type === "destroy" && !((o.count ?? 0) > 0 && (o.hp ?? 0) > 0)) err.push(`${at}: destroy sin número o vida`);
      if (o.type === "survive" && !((o.waves ?? 0) > 0)) err.push(`${at}: survive sin oleadas`);
      if (o.type === "eliminate" && !o.target) err.push(`${at}: eliminate sin objetivo`);
      if (o.type === "boss" && !o.boss) err.push(`${at}: boss sin jefe`);
    }
    // Cada objetivo de sala necesita su sala de combate
    const inRoom = l.objectives.filter((o) => IN_ROOM.includes(o.type)).length;
    if (inRoom > l.rooms) err.push(`${at}: ${inRoom} objetivos de sala y solo ${l.rooms} salas`);
    const last = l.objectives[l.objectives.length - 1]?.type;
    if (last !== "extract" && last !== "boss") err.push(`${at}: debe acabar en extract o boss`);
    if (!RARITY_IDS.includes(l.reward.rarity)) err.push(`${at}: rareza ${l.reward.rarity}`);
    if (!(l.reward.credits > 0)) err.push(`${at}: créditos`);
    for (const o of l.optionals) {
      if (o.type === "time" && !((o.limit ?? 0) > 0)) err.push(`${at}: opcional time sin límite`);
      if (o.type === "nodamage" && !((o.max ?? -1) >= 0)) err.push(`${at}: opcional nodamage sin máximo`);
    }
  });
  return err;
}

export const LEVELS: readonly CampaignLevel[] = data.levels as CampaignLevel[];
export const levelIndex = (id: string) => LEVELS.findIndex((l) => l.id === id);

// ---------- Plan de un nivel (sale de la semilla: rejugable con variación) ----------
export interface RoomPlan { room: number; objective: Objective | null }
export interface LevelPlan { level: CampaignLevel; seed: number; rooms: RoomPlan[]; chestRoom: number; exit: Objective | null }
/**
 * Reparte los objetivos de sala por las salas de combate (1..rooms) en su orden, con huecos al azar entre ellos (salas
 * de solo combate), y elige la sala del cofre oculto (si es opcional del nivel). El jefe va siempre en la última.
 */
export function planLevel(level: CampaignLevel, seed: number): LevelPlan {
  const r = rng((seed ^ 0x51ed27) >>> 0);
  const inRoom = level.objectives.filter((o) => IN_ROOM.includes(o.type));
  const free = level.rooms - inRoom.length;
  // huecos: cuántas salas de solo combate van antes de cada objetivo (repartiendo las libres al azar)
  const gaps = inRoom.map(() => 0);
  for (let i = 0; i < free; i++) gaps[Math.floor(r() * inRoom.length)]++;
  // (el jefe en la última sala: sus huecos pasan al objetivo anterior)
  const bossAt = inRoom.findIndex((o) => o.type === "boss");
  const rooms: RoomPlan[] = [];
  inRoom.forEach((o, i) => {
    for (let g = 0; g < gaps[i]; g++) rooms.push({ room: rooms.length + 1, objective: null });
    rooms.push({ room: rooms.length + 1, objective: o });
  });
  if (bossAt >= 0) { const b = rooms.findIndex((x) => x.objective?.type === "boss"); const [boss] = rooms.splice(b, 1); rooms.push(boss); rooms.forEach((x, i) => (x.room = i + 1)); }
  const chest = level.optionals.some((o) => o.type === "chest") ? 1 + Math.floor(r() * level.rooms) : -1;
  const exit = level.objectives.find((o) => o.type === "extract") ?? null;
  return { level, seed, rooms, chestRoom: chest, exit };
}

// ---------- Estado guardado ----------
export interface LevelRecord { done: boolean; stars: OptionalType[]; bestTime: number | null; runs: number }
export interface CampaignState { levels: Record<string, LevelRecord>; /** Legendaria del jefe final ya entregada la primera vez. */ finalReward: boolean }
export const newCampaign = (): CampaignState => ({ levels: {}, finalReward: false });
const rec = (s: CampaignState, id: string): LevelRecord => s.levels[id] ?? { done: false, stars: [], bestTime: null, runs: 0 };

/** El nivel 1 está abierto; cada uno se abre al completar el anterior. */
export function isUnlocked(s: CampaignState, id: string): boolean {
  const i = levelIndex(id); if (i < 0) return false;
  return i === 0 || rec(s, LEVELS[i - 1].id).done;
}
export const starsOf = (s: CampaignState, id: string) => rec(s, id).stars.length;
export const maxStars = (id: string) => LEVELS[levelIndex(id)]?.optionals.length ?? 0;
export const totalStars = (s: CampaignState) => LEVELS.reduce((a, l) => a + starsOf(s, l.id), 0);
/** ¿Campaña completa (los 5 niveles, jefe incluido)? Es una de las condiciones de la súper secreta. */
export const campaignDone = (s: CampaignState) => LEVELS.every((l) => rec(s, l.id).done);

/** Resultado de una partida a un nivel: si se completó, tiempo, daño recibido y cofre encontrado. */
export interface RunResult { completed: boolean; seconds: number; damageTaken: number; chest: boolean }
/** Opcionales cumplidos en una partida (solo cuentan si se completa el nivel). */
export function optionalsMet(level: CampaignLevel, r: RunResult): OptionalType[] {
  if (!r.completed) return [];
  return level.optionals.filter((o) => o.type === "chest" ? r.chest : o.type === "time" ? r.seconds <= (o.limit ?? 0) : r.damageTaken <= (o.max ?? 0)).map((o) => o.type);
}
export interface Rewards { credits: number; rarity: RarityId | null; guaranteed: boolean; newStars: OptionalType[]; firstClear: boolean; unlocked: string | null }
/**
 * Cierra una partida: actualiza el estado (sin mutar el de entrada) y calcula las recompensas. Sin completar no hay
 * botín pero sí se cuenta el intento. Completado: créditos (×firstBonus la primera vez), botín de la rareza del nivel
 * (la legendaria del jefe final está GARANTIZADA la primera vez y luego sale con la rareza normal del nivel), +25 % de
 * créditos por cada estrella nueva, y se abre el siguiente nivel.
 */
export function finishLevel(s: CampaignState, id: string, r: RunResult): { state: CampaignState; rewards: Rewards } {
  const level = LEVELS[levelIndex(id)];
  const old = rec(s, id), state: CampaignState = { ...s, levels: { ...s.levels } };
  const none: Rewards = { credits: 0, rarity: null, guaranteed: false, newStars: [], firstClear: false, unlocked: null };
  if (!level) return { state: s, rewards: none };
  if (!r.completed) { state.levels[id] = { ...old, runs: old.runs + 1 }; return { state, rewards: none }; }
  const met = optionalsMet(level, r), newStars = met.filter((m) => !old.stars.includes(m));
  const firstClear = !old.done, isFinal = levelIndex(id) === LEVELS.length - 1;
  state.levels[id] = { done: true, stars: [...old.stars, ...newStars], bestTime: old.bestTime === null ? r.seconds : Math.min(old.bestTime, r.seconds), runs: old.runs + 1 };
  const guaranteed = isFinal && !s.finalReward;
  if (guaranteed) state.finalReward = true;
  const credits = Math.round(level.reward.credits * (firstClear ? level.reward.firstBonus : 1) * (1 + 0.25 * newStars.length));
  const next = LEVELS[levelIndex(id) + 1];
  return { state, rewards: { credits, rarity: level.reward.rarity, guaranteed, newStars, firstClear, unlocked: firstClear && next ? next.id : null } };
}

/** Migración suave: acepta cualquier cosa del guardado y devuelve un estado válido (lo que no se entiende se descarta). */
export function migrateCampaign(raw: unknown): CampaignState {
  const s = newCampaign();
  if (!raw || typeof raw !== "object") return s;
  const o = raw as Record<string, unknown>;
  s.finalReward = o.finalReward === true;
  const lv = o.levels && typeof o.levels === "object" ? (o.levels as Record<string, unknown>) : {};
  for (const l of LEVELS) {
    const x = lv[l.id]; if (!x || typeof x !== "object") continue;
    const y = x as Record<string, unknown>;
    const stars = Array.isArray(y.stars) ? [...new Set((y.stars as unknown[]).filter((t): t is OptionalType => t === "chest" || t === "time" || t === "nodamage"))] : [];
    const bt = typeof y.bestTime === "number" && Number.isFinite(y.bestTime) && y.bestTime > 0 ? y.bestTime : null;
    s.levels[l.id] = { done: y.done === true, stars: y.done === true ? stars : [], bestTime: y.done === true ? bt : null, runs: typeof y.runs === "number" && y.runs >= 0 ? Math.floor(y.runs) : 0 };
  }
  // (un nivel completado sin el anterior completado no puede existir: se respeta lo hecho, no se quita progreso)
  return s;
}
