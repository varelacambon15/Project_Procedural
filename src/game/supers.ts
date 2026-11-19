// Súperes (habilidades): se elige una en la pestaña Habilidades del inventario y se carga matando enemigos.
// Este módulo es puro (sin DOM ni three): datos, medidor y muestreo de la línea de tiempo de la animación de
// invocación en primera persona. Los números de cada animación están en supers.json (ajustables sin tocar código).
import data from "./supers.json";

export type SuperId = "overload" | "shockwave" | "storm" | "inferno" | "stasis" | "orbital" | "seekers" | "aegis" | "deadeye" | "vortex" | "sentry" | "zerog" | "chrono" | "leech" | "decoy" | "spirit" | "railgun" | "dash" | "rewind" | "shards";
export const SUPER_IDS: SuperId[] = ["overload", "shockwave", "storm", "inferno", "stasis", "orbital", "seekers", "aegis", "deadeye", "vortex", "sentry", "zerog", "chrono", "leech", "decoy", "spirit", "railgun", "dash", "rewind", "shards"];

/** Clave de mano. `index` = cierre del índice (si falta, el de los demás dedos; sirve para señalar). */
export interface HandKey { t: number; pos: [number, number, number]; rot: [number, number, number]; curl: number; thumb: number; index?: number }
export interface Timeline {
  duration: number; hit: number; cost: number;
  /** Segundos que dura el efecto tras invocar (sobrecarga, tormenta). */ active?: number;
  damage?: number; radius?: number; rate?: number; interval?: number; range?: number;
  /** Estasis: daño extra que reciben los congelados. Égida: fracción del daño que se recibe. Ojo letal: daño crítico. */
  vuln?: number; guard?: number; crit?: number;
  /** Enjambre: misiles. Vórtice: radio de atracción y daño de cada tic. */
  count?: number; pull?: number; tick?: number;
  /** Sanguijuela: fracción del daño drenado que cura. Gravedad cero: altura. Dilatación: velocidad del resto. */ heal?: number; lift?: number; slow?: number;
  /** Gravedad cero: daño de la caída como fracción de la vida máxima (jefes aparte) y altura a la que flotas tú. */ frac?: number; bossFrac?: number; float?: number;
  right: HandKey[]; left: HandKey[]; fov: [number, number][]; roll: [number, number][]; lower: [number, number][];
}
export const SUPERS = data as unknown as Record<SuperId, Timeline>;

const ease = (x: number) => x * x * (3 - 2 * x);

/** Valor de una pista de pares [t, v] en el instante t (suavizado entre claves; fuera de rango, el extremo). */
export function track(k: [number, number][], t: number): number {
  if (t <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) { const a = k[i - 1], b = k[i]; return a[1] + (b[1] - a[1]) * ease((t - a[0]) / (b[0] - a[0])); }
  return k[k.length - 1][1];
}

/** Pose de una mano en el instante t: interpola posición, giro (grados) y cierre entre las dos claves vecinas. */
export function sampleHand(keys: HandKey[], t: number): Omit<HandKey, "t"> {
  const pick = (a: HandKey, b: HandKey, u: number) => {
    const m = (x: number, y: number) => x + (y - x) * u;
    return { pos: a.pos.map((v, i) => m(v, b.pos[i])) as HandKey["pos"], rot: a.rot.map((v, i) => m(v, b.rot[i])) as HandKey["rot"], curl: m(a.curl, b.curl), thumb: m(a.thumb, b.thumb), index: m(a.index ?? a.curl, b.index ?? b.curl) };
  };
  if (t <= keys[0].t) return pick(keys[0], keys[0], 0);
  const last = keys[keys.length - 1]; if (t >= last.t) return pick(last, last, 0); // (exacto al final: sin error de redondeo)
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) return pick(keys[i - 1], keys[i], ease((t - keys[i - 1].t) / (keys[i].t - keys[i - 1].t)));
  const l = keys[keys.length - 1]; return pick(l, l, 0);
}

/** Medidor del súper: sube con las bajas (y un poco con el tiempo) y se gasta al invocarlo. */
export class SuperMeter {
  charge = 0;
  /** Multiplicador de carga (habilidades del árbol). */ gain = 1;
  static readonly PER_KILL = 0.08; static readonly BOSS = 0.35; static readonly PASSIVE = 1 / 240;
  get ready() { return this.charge >= 1; }
  kill(boss = false) { this.charge = Math.min(1, this.charge + (boss ? SuperMeter.BOSS : SuperMeter.PER_KILL) * this.gain); }
  update(dt: number) { this.charge = Math.min(1, this.charge + dt * SuperMeter.PASSIVE * this.gain); }
  /** Gasta el medidor; false si no está lleno. */
  use(): boolean { if (!this.ready) return false; this.charge = 0; return true; }
}

/** Probabilidad de que caiga un módulo de súper (los súperes se desbloquean con módulos; no son fáciles de conseguir). */
export const MODULE_CHANCE = { kill: 0.003, big: 0.012, boss: 0.06, raidChest: 0.06, raidBoss: 0.25, raidBossPerDifficulty: 0.1 };
/** Súper al azar de los que faltan (null si ya los tienes todos). */
export function rollModule(owned: readonly SuperId[], rnd: number): SuperId | null {
  const left = SUPER_IDS.filter((id) => !owned.includes(id));
  return left.length ? left[Math.floor(rnd * left.length)] : null;
}
