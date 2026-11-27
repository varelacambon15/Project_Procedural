// Animación del arma en primera persona por POSES CLAVE (tarea 13). Solo lógica (sin Three.js ni escena).
//
// Cada acción (sacar, recargar, inspeccionar…) es una lista corta de poses clave por canal, con su curva de llegada:
// anticipación → acción → pausa → asentado con micro-rebote. Nada de recorridos remapeados de otros juegos.
//
// Canales (todos opcionales; un canal sin claves no toca nada):
// - `gun`: desplazamiento del arma respecto a su pose de cadera, en el espacio de la cámara [x, y, z] (m; +X derecha,
//   +Y arriba, −Z delante) y giro [cabeceo, guiñada, alabeo] (rad; cabeceo + = boca arriba, guiñada + = boca a la
//   izquierda, alabeo + = el lomo cae a la izquierda).
// - `left`: mano izquierda. `at` es el ancla del arma a la que va (cargador, guardamanos, corredera…) o un punto fijo
//   de la cámara (`cam`), más un desplazamiento en el espacio de la cámara; `dir`/`up` orientan la mano (dirección de
//   los dedos y del dorso, en la cámara) y `hand` elige el cierre de los dedos.
// - `mag`: el cargador. `mode` es discreto (vale el de la última clave alcanzada): `seat` en su sitio, `well` en el
//   brocal desplazado `out` metros hacia abajo (sacarlo o meterlo), `hand` en la mano izquierda, `hide` oculto. Pasar
//   de `well` a `hide`/`hand` con el cargador fuera suelta el viejo (cae al suelo).
// - `slide`: recorrido de la corredera o de la palanca de carga (0..1).
// - `cyl`: tambor del revólver abierto (0..1).
// - `right`: corrección de la mano derecha respecto a la empuñadura (cámara, m) — casi nunca: la derecha no suelta.

export type Ease = "io" | "o" | "i" | "l" | "b" | "s";
export type V3 = [number, number, number];
export type Gun6 = [number, number, number, number, number, number];
export interface Key<T> { t: number; v: T; /** Curva del tramo que LLEGA a esta clave (por defecto `io`). */ e?: Ease }

export type Anchor = "rest" | "grip" | "magwell" | "mag" | "support" | "charge" | "slide" | "muzzle" | "cyl" | "cam";
export type HandShape = "grab" | "palm" | "pinch" | "wrap" | "open" | "relax" | "fist";
export interface LeftKey { at: Anchor; /** Desplazamiento en la cámara (m). */ off?: V3; /** Desplazamiento en el arma (m; +X boca, +Y arriba). */ offW?: V3; dir?: V3; up?: V3; hand?: HandShape }
export type MagMode = "seat" | "well" | "hand" | "hide";
export interface MagKey { mode: MagMode; out?: number }

export interface Track {
  /** Duración nominal (s), solo informativa: el juego escala la pista a la duración real de la acción. */
  dur: number;
  gun?: Key<Gun6>[];
  left?: Key<LeftKey>[];
  mag?: Key<MagKey>[];
  slide?: Key<number>[];
  cyl?: Key<number>[];
  right?: Key<V3>[];
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Curvas de llegada. `b` sobrepasa un 8 % y vuelve (asentado con rebote); `s` llega rápido y frena en seco. */
export function easeBy(e: Ease | undefined, x: number): number {
  x = clamp01(x);
  switch (e ?? "io") {
    case "l": return x;
    case "i": return x * x * x;
    case "o": return 1 - (1 - x) ** 3;
    case "s": return 1 - (1 - x) ** 5;
    case "b": { const c = 1.9, k = x - 1; return 1 + (c + 1) * k * k * k + c * k * k; }
    default: return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  }
}

/** Tramo de una pista en `t`: clave anterior, siguiente y fracción ya con su curva. */
export function segment<T>(keys: readonly Key<T>[], t: number): { a: Key<T>; b: Key<T>; k: number } {
  if (t <= keys[0].t) return { a: keys[0], b: keys[0], k: 0 };
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i];
    if (t <= b.t) { const a = keys[i - 1]; return { a, b, k: easeBy(b.e, (t - a.t) / Math.max(1e-6, b.t - a.t)) }; }
  }
  const last = keys[keys.length - 1];
  return { a: last, b: last, k: 0 };
}
const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpArr = <A extends number[]>(a: A, b: A, k: number) => a.map((x, i) => lerpN(x, b[i], k)) as A;

/** Valor numérico (escalar o vector) de una pista en `t`. */
export function sampleNum(keys: readonly Key<number>[] | undefined, t: number, rest = 0): number {
  if (!keys?.length) return rest;
  const { a, b, k } = segment(keys, t); return lerpN(a.v, b.v, k);
}
export function sampleVec<A extends number[]>(keys: readonly Key<A>[] | undefined, t: number, rest: A): A {
  if (!keys?.length) return rest;
  const { a, b, k } = segment(keys, t); return lerpArr(a.v, b.v, k);
}

/** Estado de la mano izquierda en `t`: las dos claves del tramo (el juego resuelve sus anclas) y la mezcla. */
export function sampleLeft(keys: readonly Key<LeftKey>[] | undefined, t: number): { a: LeftKey; b: LeftKey; k: number } | null {
  if (!keys?.length) return null;
  const { a, b, k } = segment(keys, t); return { a: a.v, b: b.v, k };
}

/** Estado del cargador en `t`: modo discreto (el de la última clave alcanzada) y salida interpolada (m). */
export function sampleMag(keys: readonly Key<MagKey>[] | undefined, t: number): { mode: MagMode; out: number } {
  if (!keys?.length) return { mode: "seat", out: 0 };
  let mode: MagMode = keys[0].v.mode;
  for (const kk of keys) if (kk.t <= t) mode = kk.v.mode;
  const { a, b, k } = segment(keys, t);
  return { mode, out: lerpN(a.v.out ?? 0, b.v.out ?? 0, k) };
}

/** Comprobaciones de una pista (para tests): claves ordenadas en 0..1, que empiecen y acaben en reposo. */
export function checkTrack(tr: Track, fromRest = true): string[] {
  const errs: string[] = [];
  const chans: [string, Key<unknown>[] | undefined][] = [["gun", tr.gun], ["left", tr.left], ["mag", tr.mag], ["slide", tr.slide], ["cyl", tr.cyl], ["right", tr.right]];
  for (const [name, keys] of chans) {
    if (!keys) continue;
    if (!keys.length) { errs.push(`${name}: sin claves`); continue; }
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].t < 0 || keys[i].t > 1) errs.push(`${name}[${i}]: t fuera de 0..1`);
      if (i && keys[i].t < keys[i - 1].t) errs.push(`${name}[${i}]: claves desordenadas`);
    }
  }
  const zero = (v: number[]) => v.every((x) => Math.abs(x) < 1e-9);
  if (tr.gun?.length) {
    if (tr.gun[0].t !== 0 || (fromRest && !zero(tr.gun[0].v))) errs.push("gun: no empieza en reposo");
    if (tr.gun[tr.gun.length - 1].t !== 1 || !zero(tr.gun[tr.gun.length - 1].v)) errs.push("gun: no acaba en reposo");
  }
  if (tr.left?.length) {
    const f = tr.left[0], l = tr.left[tr.left.length - 1];
    if (f.t !== 0 || l.t !== 1) errs.push("left: debe tener claves en 0 y en 1");
  }
  if (tr.mag?.length && tr.mag[tr.mag.length - 1].v.mode !== "seat") errs.push("mag: debe acabar en su sitio");
  return errs;
}

/** Velocidad angular máxima (rad/s) del arma en una pista dada su duración: detecta «manos locas» y saltos. */
export function maxAngularSpeed(tr: Track, dur: number, steps = 240): number {
  if (!tr.gun?.length) return 0;
  let prev = sampleVec(tr.gun, 0, [0, 0, 0, 0, 0, 0] as Gun6), max = 0;
  for (let i = 1; i <= steps; i++) {
    const v = sampleVec(tr.gun, i / steps, [0, 0, 0, 0, 0, 0] as Gun6);
    const d = Math.hypot(v[3] - prev[3], v[4] - prev[4], v[5] - prev[5]) / (dur / steps);
    if (d > max) max = d; prev = v;
  }
  return max;
}
