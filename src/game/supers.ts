// Súperes (habilidades): se elige una en la pestaña Habilidades del inventario y se carga matando enemigos.
// Este módulo es puro (sin DOM ni three): datos, medidor y muestreo de la línea de tiempo de la animación de
// invocación en primera persona. Los números de cada animación están en supers.json (ajustables sin tocar código).
import data from "./supers.json";

export type SuperId = "overload" | "shockwave" | "storm";
export const SUPER_IDS: SuperId[] = ["overload", "shockwave", "storm"];

export interface HandKey { t: number; pos: [number, number, number]; rot: [number, number, number]; curl: number; thumb: number }
export interface Timeline {
  duration: number; hit: number; cost: number;
  /** Segundos que dura el efecto tras invocar (sobrecarga, tormenta). */ active?: number;
  damage?: number; radius?: number; rate?: number; interval?: number; range?: number;
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
    return { pos: a.pos.map((v, i) => m(v, b.pos[i])) as HandKey["pos"], rot: a.rot.map((v, i) => m(v, b.rot[i])) as HandKey["rot"], curl: m(a.curl, b.curl), thumb: m(a.thumb, b.thumb) };
  };
  if (t <= keys[0].t) return pick(keys[0], keys[0], 0);
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].t) return pick(keys[i - 1], keys[i], ease((t - keys[i - 1].t) / (keys[i].t - keys[i - 1].t)));
  const l = keys[keys.length - 1]; return pick(l, l, 0);
}

/** Medidor del súper: sube con las bajas (y un poco con el tiempo) y se gasta al invocarlo. */
export class SuperMeter {
  charge = 0;
  static readonly PER_KILL = 0.08; static readonly BOSS = 0.35; static readonly PASSIVE = 1 / 240;
  get ready() { return this.charge >= 1; }
  kill(boss = false) { this.charge = Math.min(1, this.charge + (boss ? SuperMeter.BOSS : SuperMeter.PER_KILL)); }
  update(dt: number) { this.charge = Math.min(1, this.charge + dt * SuperMeter.PASSIVE); }
  /** Gasta el medidor; false si no está lleno. */
  use(): boolean { if (!this.ready) return false; this.charge = 0; return true; }
}
