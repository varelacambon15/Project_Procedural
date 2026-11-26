// Variaciones sobre geometría real y medida de parecido de silueta (lógica pura, compartida por generador y ensamblador).
//
// Estirado por zonas: al alargar o acortar una pieza solo se deforma su tramo central liso; los extremos (boca,
// anillas, cantonera, juntas) quedan intactos. La silueta lateral se compara en una rejilla (IoU).

export type V3 = [number, number, number];
export interface Profile { x0: number; x1: number; top: (number | null)[]; bot: (number | null)[] }

/** Zona [a, b] que se estira por `f`: lo anterior a `a` queda igual y lo posterior a `b` se desplaza. */
export interface Stretch { a: number; b: number; f: number; /** si true, el extremo final (junta) queda fijo y se mueve el inicio */ end?: boolean }
export const stretchX = (x: number, s: Stretch | null) => {
  if (!s || s.f === 1) return x;
  if (s.end) return x >= s.b ? x : x <= s.a ? x - (s.b - s.a) * (s.f - 1) : s.b - (s.b - x) * s.f;
  return x <= s.a ? x : x >= s.b ? x + (s.b - s.a) * (s.f - 1) : s.a + (x - s.a) * s.f;
};
/** Varias zonas que no se solapan (p. ej. culata y cañón de un arma entera): se aplican en orden. */
export type Stretches = Stretch | Stretch[] | null | undefined;
export const stretchAll = (x: number, s: Stretches) => (!s ? x : Array.isArray(s) ? s.reduce((v, z) => stretchX(v, z), x) : stretchX(x, s));
/** Largo de una pieza estirada por zonas (zona central de fracción `mid`). */
export const zoneLen = (L: number, f: number, mid = 0.56) => L * (1 + mid * (f - 1));
/** Zona central de una pieza que va de `x0` a `x1`: deja rígidos los extremos (`keepA` y `keepB`, fracciones). */
export const midZone = (x0: number, x1: number, f: number, keepA = 0.22, keepB = 0.22, end = false): Stretch => {
  const L = x1 - x0; return { a: x0 + L * keepA, b: x1 - L * keepB, f, end };
};

/** Pieza en la silueta: su perfil y cómo se coloca (escala, desplazamiento y estirado por zonas en su propio marco). */
export interface Placed { profile: Profile; scale?: V3; offset?: V3; stretch?: Stretches; pivotY?: number; /** Cuerpo de una pistola generada (su silueta va por tramos aparte). */ isBody?: boolean }
/** Caja simple (accesorios añadidos: raíl, tambor, linterna, mira…). */
export interface Box2 { x0: number; x1: number; y0: number; y1: number }

const W = 160, H = 56; // (tolerancia de ±2 celdas: fija en `dilInto`)
/** Silueta en una rejilla común: lista de columnas [x, yLow, yHigh]. */
export function spans(parts: Placed[], boxes: Box2[] = []): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (const p of parts) {
    const { x0, x1, top, bot } = p.profile; const N = top.length; const sc = p.scale ?? [1, 1, 1], off = p.offset ?? [0, 0, 0];
    for (let k = 0; k < N; k++) {
      const t = top[k], b = bot[k]; if (t === null || b === null) continue;
      const xa = x0 + ((x1 - x0) * k) / N, xb = x0 + ((x1 - x0) * (k + 1)) / N;
      for (const x of [xa, (xa + xb) / 2, xb]) {
        const X = stretchAll(x, p.stretch) * sc[0] + off[0];
        out.push([X, b * sc[1] + off[1], t * sc[1] + off[1]]);
      }
    }
  }
  for (const b of boxes) for (let i = 0; i <= 4; i++) out.push([b.x0 + ((b.x1 - b.x0) * i) / 4, b.y0, b.y1]);
  return out;
}

/** Parecido de dos siluetas en una rejilla que cubre ambas (coincidencia con tolerancia). 1 = idénticas. */
// (tarea 8: mismo cálculo que antes, celda a celda, pero con búferes reutilizados y sin listas por columna: era la
//  mitad del tiempo de generar un arma —~22 ms— y lo que hacía lentísimos los tests del generador)
const RA = new Uint8Array(W * H), RB = new Uint8Array(W * H), DA = new Uint8Array(W * H), DB = new Uint8Array(W * H), DH = new Uint8Array(W * H);
const HAS = new Uint8Array(W);
function rasterInto(g: Uint8Array, sp: [number, number, number][], xmin: number, xmax: number, ymin: number, ymax: number) {
  g.fill(0); HAS.fill(0);
  const dx = xmax - xmin || 1, dy = ymax - ymin || 1;
  for (let i = 0; i < sp.length; i++) {
    const s = sp[i];
    const c = Math.min(W - 1, Math.max(0, Math.floor(((s[0] - xmin) / dx) * W)));
    HAS[c] = 1;
    const r0 = Math.max(0, Math.floor(((s[1] - ymin) / dy) * H)), r1 = Math.min(H - 1, Math.floor(((s[2] - ymin) / dy) * H));
    for (let r = r0; r <= r1; r++) g[r * W + c] = 1;
  }
  // Rellena huecos entre columnas con datos (las piezas son continuas a lo largo de X)
  for (let c = 1; c < W - 1; c++) if (!HAS[c]) for (let r = 0; r < H; r++) if (g[r * W + c - 1] && g[r * W + c + 1]) g[r * W + c] = 1;
}
// Dilatación cuadrada (±TOL = 2) en dos pasadas separables: cada celda es el OR de sus vecinas en la fila y luego en
// la columna (lo mismo que recorrer la ventana, sin bucles internos)
function dilInto(o: Uint8Array, g: Uint8Array) {
  const h = DH;
  for (let r = 0; r < H; r++) {
    const row = r * W;
    for (let c = 0; c < W; c++) {
      const i = row + c;
      h[i] = g[i] | (c > 0 ? g[i - 1] : 0) | (c > 1 ? g[i - 2] : 0) | (c < W - 1 ? g[i + 1] : 0) | (c < W - 2 ? g[i + 2] : 0);
    }
  }
  for (let r = 0; r < H; r++) {
    const i0 = r * W;
    for (let c = 0; c < W; c++) {
      const i = i0 + c;
      o[i] = h[i] | (r > 0 ? h[i - W] : 0) | (r > 1 ? h[i - 2 * W] : 0) | (r < H - 1 ? h[i + W] : 0) | (r < H - 2 ? h[i + 2 * W] : 0);
    }
  }
}
export function similarity(a: [number, number, number][], b: [number, number, number][]): number {
  if (!a.length || !b.length) return 0;
  let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
  for (const sp of [a, b]) for (const s of sp) { if (s[0] < xmin) xmin = s[0]; if (s[0] > xmax) xmax = s[0]; if (s[1] < ymin) ymin = s[1]; if (s[2] > ymax) ymax = s[2]; }
  rasterInto(RA, a, xmin, xmax, ymin, ymax); rasterInto(RB, b, xmin, xmax, ymin, ymax);
  // Coincidencia con tolerancia (±TOL celdas): cuenta qué parte de cada silueta cae cerca de la otra. Es más fiel a lo
  // que ve el ojo que la intersección exacta, que castiga mucho los desplazamientos pequeños en piezas finas.
  dilInto(DA, RA); dilInto(DB, RB);
  let na = 0, nb = 0, ab = 0, ba = 0;
  for (let i = 0; i < RA.length; i++) { if (RA[i]) { na++; if (DB[i]) ab++; } if (RB[i]) { nb++; if (DA[i]) ba++; } }
  return na + nb ? (ab + ba) / (na + nb) : 0;
}

/** Rango buscado de parecido con la base ("reconocible pero nuevo"); ajustable mirando resultados. */
// Decisión del usuario (prompt 03, parte A, confirmada en el 05): la mayoría entre 70 y 90 %.
export const SIMILARITY_RANGE: [number, number] = [0.7, 0.9];
/** Por encima de esto, dos armas de un mismo lote se consideran casi iguales. */
export const BATCH_MAX_SIMILARITY = 0.9;
