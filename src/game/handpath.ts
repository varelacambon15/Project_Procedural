// Recorridos reales de las manos en la recarga, sacar, inspección y reposo (fusil, pistolas, revólveres, escopetas,
// subfusiles, cerrojos, ametralladoras y bullpup; las clases sin dato conservan el piloto anterior). Solo lógica, sin
// Three.js ni DOM: recibe la clase de arma, la secuencia, el progreso (0..1) y las anclas del arma en su espacio local
// —reposo (guardamanos/empuñadura), cargador (magwell), punto bajo (cartuchera) y punto alto (corredera)—, y devuelve
// dónde va la mano izquierda, cuánto cierra los dedos y cómo gira la muñeca.
//
// `src/data/poses.json` (lo genera tools/build-poses.mjs desde los aportes) guarda cada recorrido en un marco
// canónico: el punto de referencia de la secuencia cae en [0,-1,0] y el reposo en [0,0,0] (distancia = 1), con los
// tiempos relativos 0..1. Aquí se gira -Y hacia el ancla correspondiente del arma, se escala por esa distancia y se
// aplica una VARIACIÓN determinista por arma (semilla del id): duración ±8 %, amplitud lateral ±10 %, punto de agarre
// ±1,5 cm y mezcla entre dos recorridos fuente. La misma arma da siempre el mismo recorrido; dos armas de la misma
// clase, recorridos distintos.
//
// La orientación de la muñeca se guarda como DIFERENCIA respecto al reposo de la secuencia: la orientación de reposo
// de cada esqueleto de los aportes no es comparable entre modelos, pero su giro sí es un giro rígido de la mano en el
// espacio del arma. `sequenceOrientAt` devuelve ese giro en el marco del arma (o null) y gun.ts lo compone sobre la
// orientación base de la mano.
import data from "../data/poses.json";

export type V3 = [number, number, number];
export type V4 = [number, number, number, number];
/** Anclas del arma en su espacio local (m; x hacia la boca, y arriba, z derecha). */
export interface HandAnchors { rest: V3; mag: V3; /** Punto bajo (cartuchera) para `draw`; si falta, se deriva bajo el reposo. */ far?: V3; /** Punto alto (corredera/tambor) para `inspect`. */ high?: V3 }
export interface HandPathCurl { fingers: [number, number, number, number]; thumb: number }
export interface HandPathPoint { pos: V3; curl: HandPathCurl }
/** Secuencias con recorrido propio guardado en poses.json. */
export type HandSequence = "reload" | "reload_empty" | "draw" | "inspect" | "idle";
/** Tramo de una secuencia con sus tiempos relativos (para audio y eventos). */
export interface HandPhase { id: string; t0: number; t1: number }

interface PathData { id: string; to: "mag" | "far" | "high" | "rest"; t: number[]; p: V3[]; c: number[][]; /** Giro de muñeca por muestra (delta respecto al reposo, marco canónico). */ o?: V4[] }
interface ClassData {
  paths?: PathData[];
  sequences?: Partial<Record<HandSequence, PathData[]>>;
  phases?: Partial<Record<HandSequence, HandPhase[]>>;
  grip?: { offset: V3; fingers: number[]; thumb: number; frame: "mag" | "far" };
}
const classes = (data as unknown as { classes: Record<string, ClassData> }).classes;

const pathsFor = (clase: string, seq: HandSequence): PathData[] => {
  const c = classes[clase];
  if (!c) return [];
  if (seq === "reload") return c.sequences?.reload ?? c.paths ?? [];
  return c.sequences?.[seq] ?? [];
};

/** Clases con recorrido real de recarga (las demás siguen con la recarga procedural). */
export const HAND_PATH_CLASSES = Object.keys(classes).filter((k) => pathsFor(k, "reload").length > 0);
export const hasHandPath = (clase: string) => pathsFor(clase, "reload").length > 0;
/** ¿Hay recorrido real para esta secuencia? */
export const hasSequence = (clase: string, seq: HandSequence) => pathsFor(clase, seq).length > 0;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Hash estable del id del arma (FNV-1a + avalancha): la misma semilla da siempre la misma variación. */
export function poseSeed(id: string | number): number {
  const s = typeof id === "string" ? id : String(id);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Muestra un recorrido en tiempo relativo 0..1 (lineal; los tiempos repetidos no dividen por cero). */
function samplePath(p: PathData, f: number) {
  const t = p.t;
  if (f <= t[0]) return { pos: p.p[0], c: p.c[0] };
  for (let i = 0; i < t.length - 1; i++) {
    if (f > t[i + 1]) continue;
    const dt = t[i + 1] - t[i];
    const u = dt > 1e-9 ? (f - t[i]) / dt : 0;
    const a = p.p[i], b = p.p[i + 1], ca = p.c[i], cb = p.c[i + 1];
    return {
      pos: [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)] as V3,
      c: ca.map((v, j) => lerp(v, cb[j], u)),
    };
  }
  return { pos: p.p[t.length - 1], c: p.c[t.length - 1] };
}

/** Muestra el giro de muñeca de un recorrido en tiempo relativo 0..1 (o null si no trae orientación). */
function sampleOrient(p: PathData, f: number): Q4 | null {
  const o = p.o;
  if (!o?.length) return null;
  const t = p.t;
  if (f <= t[0]) return qnorm4([o[0][0], o[0][1], o[0][2], o[0][3]]);
  for (let i = 0; i < t.length - 1; i++) {
    if (f > t[i + 1]) continue;
    const dt = t[i + 1] - t[i];
    const u = dt > 1e-9 ? (f - t[i]) / dt : 0;
    const a = o[i], b = o[Math.min(i + 1, o.length - 1)];
    return qslerp([a[0], a[1], a[2], a[3]], [b[0], b[1], b[2], b[3]], u);
  }
  const l = o[o.length - 1];
  return qnorm4([l[0], l[1], l[2], l[3]]);
}

/** Cuaternión del arco mínimo que lleva el vector unitario `a` al `b`. */
function qFromTo(a: V3, b: V3): [number, number, number, number] {
  const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
  if (d > 0.999999) return [0, 0, 0, 1];
  if (d < -0.999999) return [1, 0, 0, 0]; // 180° alrededor de X
  const c: V3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const l = Math.hypot(c[0], c[1], c[2], 1 + d);
  return [c[0] / l, c[1] / l, c[2] / l, (1 + d) / l];
}
function rotate(q: [number, number, number, number], v: V3): V3 {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [
    ix * w + iw * -x + iy * -z - iz * -y,
    iy * w + iw * -y + iz * -x - ix * -z,
    iz * w + iw * -z + ix * -y - iy * -x,
  ];
}

type Q4 = [number, number, number, number];
const qdot = (a: Q4, b: Q4) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
function qmul(a: Q4, b: Q4): Q4 {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
const qconj = (q: Q4): Q4 => [-q[0], -q[1], -q[2], q[3]];
const qlen4 = (q: Q4) => Math.hypot(q[0], q[1], q[2], q[3]);
function qnorm4(q: Q4): Q4 {
  const l = qlen4(q);
  return l < 1e-9 ? [0, 0, 0, 1] : [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}
/** Interpolación esférica por el camino corto (el cuaternión y su negativo son la misma rotación). */
function qslerp(a: Q4, b: Q4, t: number): Q4 {
  let bb = b, d = qdot(a, b);
  if (d < 0) { bb = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
  if (d > 0.9995) return qnorm4([lerp(a[0], bb[0], t), lerp(a[1], bb[1], t), lerp(a[2], bb[2], t), lerp(a[3], bb[3], t)]);
  const th = Math.acos(clamp(d, -1, 1)), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return qnorm4([a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb]);
}
/** Ángulo del giro (rad) que representa un cuaternión normalizado. */
const qangle = (q: Q4) => 2 * Math.acos(clamp(Math.abs(q[3]), 0, 1));
/** Limita el giro a `max` rad (los aportes traen muñecas giradas 160°: en nuestra mano equivaldría a voltearla). */
function qlimit(q: Q4, max: number): Q4 {
  let r = qnorm4(q);
  if (r[3] < 0) r = [-r[0], -r[1], -r[2], -r[3]];
  const ang = qangle(r);
  if (ang <= max || ang < 1e-6) return r;
  return qslerp([0, 0, 0, 1], r, max / ang);
}
/** Giro máximo que se toma de la referencia (≈ 55°): cubre el giro de muñeca real sin invertir la mano. */
export const ORIENT_MAX = 0.96;

const num = (h: number, shift: number) => ((h >>> shift) & 1023) / 1023; // 0..1 determinista

/** Dirección rest→ancla y su longitud, o null si no hay ancla válida. */
function anchorDir(anclas: HandAnchors, to: PathData["to"], base: V3 = anclas.rest): { dir: V3; L: number } | null {
  const rest = base;
  let target: V3 | null = null;
  if (to === "mag") target = anclas.mag;
  else if (to === "far") target = anclas.far ?? null;
  else if (to === "high") target = anclas.high ?? null;
  else return { dir: [0, -1, 0], L: 1 };
  if (!target) {
    // Sin ancla propia: la cartuchera se deriva bajo el reposo (nunca se inventa hacia arriba).
    if (to === "far") {
      const dx = rest[0] - anclas.mag[0], dy = rest[1] - anclas.mag[1], dz = rest[2] - anclas.mag[2];
      const l = Math.hypot(dx, dy, dz);
      target = l > 1e-3 ? [rest[0] + (dx / l) * 0.24, rest[1] + (dy / l) * 0.24, rest[2] + (dz / l) * 0.24] : [rest[0], rest[1] - 0.24, rest[2]];
    } else return null;
  }
  const d: V3 = [target[0] - rest[0], target[1] - rest[1], target[2] - rest[2]];
  const L = Math.hypot(d[0], d[1], d[2]);
  if (L < 1e-4) return null;
  return { dir: [d[0] / L, d[1] / L, d[2] / L], L };
}

/**
 * Posición y curvatura de la mano izquierda en una secuencia, o `null` si la clase o la secuencia no tienen dato.
 * `fase` es el progreso de la secuencia (0..1); `id` es el id/semilla del arma (la variación es estable por arma).
 */
export function sequencePathAt(clase: string, seq: HandSequence, fase: number, anclas: HandAnchors, id: string | number = 0): HandPathPoint | null {
  const paths = pathsFor(clase, seq);
  if (!paths.length) return null;
  const h = poseSeed(id), n = paths.length;
  // Dos recorridos fuente distintos, mezclados con un peso que sale de la semilla.
  const i = (h >>> 10) % n;
  const j = n > 1 ? (i + 1 + ((h >>> 20) % (n - 1))) % n : i;
  const w = n > 1 ? (h & 1023) / 1023 : 0;
  // Variación: duración ±8 % (pivotada en el punto de referencia), amplitud lateral ±10 %, agarre ±1,5 cm.
  const dur = 0.92 + num(h, 4) * 0.16;
  const amp = 0.9 + num(h, 14) * 0.2;
  const grip: V3 = [(num(h, 6) - 0.5) * 0.03, (num(h, 16) - 0.5) * 0.03, (num(h, 24) - 0.5) * 0.03];
  const ff = clamp(fase, 0, 1);
  // Ritmo ±8 % por tramos, con reposo y referencia fijos: 0 y 1 siguen en sus extremos y 0,5 en la referencia.
  const f = ff <= 0.5 ? 0.5 * Math.pow(2 * ff, 1 / dur) : 1 - 0.5 * Math.pow(2 * (1 - ff), 1 / dur);
  const a = samplePath(paths[i], f), b = samplePath(paths[j], f);
  const rest: V3 = [anclas.rest[0] + grip[0], anclas.rest[1] + grip[1], anclas.rest[2] + grip[2]];
  const to = paths[i].to;
  const ad = anchorDir(anclas, to, rest);
  const curl = curlAt(a.c, b.c, w);
  if (to === "rest" || !ad) return { pos: to === "rest" ? anclas.rest.slice() as V3 : rest, curl };
  const q = qFromTo([0, -1, 0], ad.dir);
  // (la amplitud solo toca el desvío lateral: reposo y ancla quedan donde toca)
  const v = rotate(q, [(lerp(a.pos[0], b.pos[0], w) * amp) * ad.L, lerp(a.pos[1], b.pos[1], w) * ad.L, (lerp(a.pos[2], b.pos[2], w) * amp) * ad.L]);
  return { pos: [rest[0] + v[0], rest[1] + v[1], rest[2] + v[2]], curl };
}

/** Compatibilidad: la recarga de siempre (una mano, ancla del cargador). */
export function handPathAt(clase: string, fase: number, anclas: HandAnchors, id: string | number = 0): HandPathPoint | null {
  return sequencePathAt(clase, "reload", fase, anclas, id);
}

/**
 * Giro de muñeca de la referencia en una secuencia, en el marco del arma (o `null` si no hay dato). Es la DIFERENCIA
 * respecto al reposo de la secuencia, así que en los extremos (reposo) es ~identidad: la mano vuelve a su orientación
 * neutra. Se mezcla entre los dos recorridos fuente y se transforma al ancla igual que las posiciones; el giro se
 * limita a `ORIENT_MAX` para no invertir la mano. El consumidor lo compone sobre su orientación base.
 */
export function sequenceOrientAt(clase: string, seq: HandSequence, fase: number, anclas: HandAnchors, id: string | number = 0): V4 | null {
  const paths = pathsFor(clase, seq);
  if (!paths.length) return null;
  const h = poseSeed(id), n = paths.length;
  const i = (h >>> 10) % n;
  const j = n > 1 ? (i + 1 + ((h >>> 20) % (n - 1))) % n : i;
  const w = n > 1 ? (h & 1023) / 1023 : 0;
  const dur = 0.92 + num(h, 4) * 0.16;
  const grip: V3 = [(num(h, 6) - 0.5) * 0.03, (num(h, 16) - 0.5) * 0.03, (num(h, 24) - 0.5) * 0.03];
  const ff = clamp(fase, 0, 1);
  // El mismo ritmo que la posición: el giro y el recorrido están sincronizados.
  const f = ff <= 0.5 ? 0.5 * Math.pow(2 * ff, 1 / dur) : 1 - 0.5 * Math.pow(2 * (1 - ff), 1 / dur);
  const a = sampleOrient(paths[i], f), b = sampleOrient(paths[j], f);
  const dq = a && b ? qslerp(a, b, w) : a ?? b;
  if (!dq || paths[i].to === "rest") return null;
  const rest: V3 = [anclas.rest[0] + grip[0], anclas.rest[1] + grip[1], anclas.rest[2] + grip[2]];
  const ad = anchorDir(anclas, paths[i].to, rest);
  if (!ad) return null;
  const qa = qFromTo([0, -1, 0], ad.dir);
  return qlimit(qmul(qa, qmul(dq, qconj(qa))), ORIENT_MAX);
}

/** Fases relativas de una secuencia (copia: el consumidor no puede alterar los datos). */
export function sequencePhases(clase: string, seq: HandSequence): HandPhase[] | null {
  const p = classes[clase]?.phases?.[seq] as unknown as ([string, number, number] | HandPhase)[] | undefined;
  if (!p?.length) return null;
  return p.map((f) => (Array.isArray(f) ? { id: f[0], t0: f[1], t1: f[2] } : { ...f }));
}

/**
 * Agarre a dos manos para armas cortas: dirección y curvatura del apoyo derivadas del reposo (`idle`) de la
 * referencia. `offset` va del puño derecho al apoyo (m, espacio del arma); `curl` mantiene el cierre de la mano y usa
 * la referencia solo para la diferencia entre dedos (los datos de reposo pueden venir con la mano abierta).
 */
export function gripAt(clase: string, anclas: HandAnchors, id: string | number = 0): { offset: V3; curl: HandPathCurl } | null {
  const g = classes[clase]?.grip;
  if (!g) return null;
  void id;
  const ad = anchorDir(anclas, g.frame);
  if (!ad) return null;
  const q = qFromTo([0, -1, 0], ad.dir);
  const v = rotate(q, g.offset);
  // Solo el plano perpendicular al eje del agarre: la altura la manda la pose del arma, no una referencia ruidosa.
  const l = Math.hypot(v[0], v[2]);
  const k = l > 1e-3 ? 0.034 / l : 0;
  const fingers = g.fingers.slice(0, 4);
  const mean = fingers.reduce((a, b) => a + b, 0) / Math.max(1, fingers.length);
  const f = fingers.map((x) => clamp(1.08 + (x - mean) * 0.5, 0.85, 1.35)) as HandPathCurl["fingers"];
  return {
    offset: [v[0] * k, 0, v[2] * k],
    curl: { fingers: f, thumb: clamp(0.3 + (g.thumb - mean) * 0.35, 0.12, 0.62) },
  };
}

function curlAt(a: number[], b: number[], w: number): HandPathCurl {
  const c = a.map((v, i) => clamp(lerp(v, b[i], w), 0, 1.7));
  return { fingers: [c[0], c[1], c[2], c[3]], thumb: c[4] };
}
