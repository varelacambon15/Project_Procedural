// Sonidos según la superficie (tarea 7): impactos de bala por material, pasos por suelo, y elección de muestra sin
// repetir la misma dos veces seguidas y con un poco de variación de tono. Solo lógica (sin Three.js ni audio): la
// reproducción está en main.ts/gun.ts con `playSample`.

/** Materiales con sonido propio en el pack (`assets/sonidos/manifest.json` → efectos `bala_*` y `paso_*`). */
export type Surface = "carne" | "hormigon" | "metal" | "madera" | "cristal" | "plastico" | "baldosa" | "arena" | "rejilla";

/** Lo que se sabe de una superficie sin depender de Three.js: etiqueta explícita y rasgos de su material. */
export interface SurfaceHint {
  /** Etiqueta puesta en la malla (`userData.surface`): manda sobre todo lo demás. */ tag?: string;
  metalness?: number; roughness?: number; transparent?: boolean; opacity?: number;
  /** Color base 0xRRGGBB. */ color?: number;
}

const SURFACES: readonly Surface[] = ["carne", "hormigon", "metal", "madera", "cristal", "plastico", "baldosa", "arena", "rejilla"];
export const isSurface = (s: unknown): s is Surface => typeof s === "string" && (SURFACES as readonly string[]).includes(s);

/** Tono (0..360) y saturación (0..1) de un color 0xRRGGBB. */
function hueSat(c: number): [number, number, number] {
  const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx > 0 ? d / mx : 0, mx];
}

/**
 * Material de sonido de una superficie. Con etiqueta, la etiqueta; si no, por sus rasgos: transparente → cristal,
 * metálico → metal, marrón mate → madera, liso y no metálico → plástico, y el resto, hormigón (paredes y suelos).
 */
export function surfaceOf(h: SurfaceHint): Surface {
  if (isSurface(h.tag)) return h.tag;
  if (h.transparent && (h.opacity ?? 1) < 0.9) return "cristal";
  const metal = h.metalness ?? 0, rough = h.roughness ?? 1;
  if (metal >= 0.5) return "metal";
  if (h.color !== undefined) {
    const [hue, sat, val] = hueSat(h.color);
    if (hue >= 15 && hue <= 45 && sat >= 0.35 && val >= 0.2 && val <= 0.85 && metal < 0.3) return "madera";
  }
  if (rough < 0.45 && metal < 0.3) return "plastico";
  return "hormigon";
}

/** Clave del efecto de impacto y de paso para una superficie (los pasos sin muestra propia usan hormigón). */
export const impactKey = (s: Surface) => `bala_${s === "rejilla" ? "metal" : s}`;
const STEP_HAS = new Set<Surface>(["hormigon", "metal", "rejilla", "baldosa", "madera"]);
export const stepKey = (s: Surface) => `paso_${STEP_HAS.has(s) ? s : s === "arena" ? "hormigon" : s === "cristal" || s === "plastico" ? "baldosa" : "hormigon"}`;

/**
 * Elige una muestra de la lista sin repetir la última que sonó para esa misma clave (si hay más de una). Devuelve el
 * índice elegido; `last` es el índice anterior (o -1).
 */
export function pickNoRepeat(n: number, last: number, rand: () => number = Math.random): number {
  if (n <= 0) return -1;
  if (n === 1) return 0;
  let i = Math.floor(rand() * (n - 1)) % (n - 1);
  if (i >= last && last >= 0) i++; // (salta la anterior: reparto uniforme entre las demás)
  return Math.min(n - 1, i);
}

/** Variación de tono (velocidad de reproducción) alrededor de 1: ±`spread` (por defecto ±6 %). */
export const pitchVar = (rand: () => number = Math.random, spread = 0.06) => 1 - spread + rand() * spread * 2;

/** Recuerda la última muestra de cada clave para no repetirla. */
export class NoRepeat {
  private last = new Map<string, number>();
  constructor(private rand: () => number = Math.random) {}
  /** Archivo a sonar de `list` para la clave `key` (null si la lista está vacía). */
  pick(key: string, list: readonly string[] | undefined): string | null {
    if (!list?.length) return null;
    const i = pickNoRepeat(list.length, this.last.get(key) ?? -1, this.rand);
    this.last.set(key, i);
    return list[i];
  }
}

/**
 * Pasos: distancia recorrida entre dos pisadas (m). Andando ~0,75 m; esprintando las zancadas son más largas pero
 * más rápidas; agachado, más cortas. Lo usa el contador de pasos de main.ts.
 */
export function strideLength(sprinting: boolean, crouched: boolean): number {
  return crouched ? 0.55 : sprinting ? 1.05 : 0.75;
}
