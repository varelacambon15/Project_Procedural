// Texturas pequeñas pixeladas generadas por código (estética retro de simulación). Son en escala de grises: el color lo
// pone el acabado del arma (tinte por material) y la oclusión, el color de vértice. Todas se proyectan con el MISMO
// tamaño de píxel en el mundo (TILE metros por repetición), así ninguna pieza parece pegada de otra.
import * as THREE from "three";

/** stipple: punteado de agarre; checker: rejilla de las cachas; engrave: marcaje grabado (filas de signos). */
export type TexKind = "metal" | "polymer" | "wood" | "fabric" | "rust" | "stipple" | "checker" | "engrave";
/** Metros que cubre una repetición de la textura: el tamaño de píxel es TILE / tamaño. */
export const TILE = 0.1;
/** Tamaños permitidos del nivel de pixelado (px por lado). */
export const PIXEL_LEVELS = [32, 48, 64, 96, 128];
const KEY = "pp.pixel";

let size = (() => { try { const v = Number(localStorage.getItem(KEY)); return PIXEL_LEVELS.includes(v) ? v : 64; } catch { return 64; } })();
const uniforms = new Map<string, { value: THREE.DataTexture }>();
const listeners = new Set<() => void>();

/** Generador pseudoaleatorio con semilla (determinista: misma textura siempre). */
function rng(seed: number) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Ruido de valor periódico (para que la textura repita sin costuras). */
function noise(n: number, cells: number, seed: number) {
  const r = rng(seed), g = Array.from({ length: cells * cells }, () => r());
  return (x: number, y: number) => {
    const fx = (x / n) * cells, fy = (y / n) * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const at = (i: number, j: number) => g[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
  };
}

/** Pinta una textura (valores 0..1, se guardan multiplicados) con su desgaste. `wear` 0..1. */
function paint(kind: TexKind, n: number, wear: number): Uint8Array {
  const d = new Uint8Array(n * n * 4);
  const big = noise(n, 4, 11), mid = noise(n, 8, 23), fine = noise(n, Math.max(8, n / 4), 37), grime = noise(n, 6, 51);
  const r = rng(kind.length * 101 + n);
  // Arañazos (metal) y nudos (madera) en posiciones fijas
  const scratches = Array.from({ length: Math.round(n / 10) }, () => ({ x: r() * n, y: r() * n, len: 4 + r() * n * 0.3, a: (r() - 0.5) * 0.5 }));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 1;
    if (kind === "metal") {
      // Cepillado horizontal fino y manchas suaves
      v = 0.9 + 0.08 * fine(x * 0.25, y * 2) + 0.05 * (mid(x, y) - 0.5);
      for (const s of scratches) { const dx = x - s.x, dy = y - s.y - dx * s.a; if (dx > 0 && dx < s.len && Math.abs(dy) < 0.6) v += 0.12; }
    } else if (kind === "polymer") {
      // Graneado: puntos finos
      v = 0.93 + 0.07 * (fine(x, y) > 0.55 ? 1 : 0) + 0.03 * (mid(x, y) - 0.5);
    } else if (kind === "wood") {
      // Veta: bandas a lo largo de X con ondulación y algún nudo
      const w = y + 6 * (big(x, y) - 0.5) + 2 * Math.sin(x * 0.15);
      v = 0.82 + 0.16 * (0.5 + 0.5 * Math.sin(w * 0.9)) + 0.06 * (fine(x, y) - 0.5);
    } else if (kind === "stipple") {
      // Punteado de agarre: puntos oscuros en retícula desordenada
      const cx = x % 3, cy = (y + (x >> 2)) % 3;
      v = 0.95 + 0.04 * (mid(x, y) - 0.5) - (cx === 1 && cy === 1 ? 0.28 : 0);
    } else if (kind === "checker") {
      // Rejilla en diamante (cachas de madera): surcos diagonales cruzados sobre la veta
      const w = y + 6 * (big(x, y) - 0.5);
      const grain = 0.86 + 0.1 * (0.5 + 0.5 * Math.sin(w * 0.9));
      const a = (x + y) % 4, b = (x - y + n * 4) % 4;
      v = grain - (a === 0 || b === 0 ? 0.22 : 0);
    } else if (kind === "engrave") {
      // Marcaje: filas de "letras" (bloques de 3×5 px con huecos), como un texto grabado visto de lejos
      const row = Math.floor(y / 8), ry = y % 8, col = Math.floor(x / 4), rx = x % 4;
      const on = ry >= 1 && ry <= 5 && rx < 3 && ((Math.imul(col * 73856093 ^ row * 19349663, 0x5bd1e995) >>> (rx * 5 + ry)) & 1) === 1 && (col % 7 !== 6);
      v = on ? 0.55 : 1.0;
      // Trama cruzada (cinta o tela)
      v = 0.85 + 0.15 * (((x >> 1) + (y >> 1)) % 2 === 0 ? (x % 2) : (y % 2)) + 0.05 * (mid(x, y) - 0.5);
    } else {
      // Óxido: manchas y picaduras
      const m = big(x, y) * 0.6 + mid(x, y) * 0.4;
      v = 0.7 + 0.35 * m + (fine(x, y) > 0.78 ? -0.15 : 0);
    }
    // Suciedad y desgaste pintados con ruido (más en armas rústicas)
    const dirt = grime(x, y);
    if (dirt > 1 - wear * 0.6) v *= 0.82;
    if (wear > 0.4 && mid(x * 2, y * 2) > 0.86) v *= 1.12; // pequeños desconchones claros
    const b = Math.max(0, Math.min(255, Math.round(v * 200)));
    d.set([b, b, b, 255], (y * n + x) * 4);
  }
  return d;
}

function make(kind: TexKind, w: number) {
  const t = new THREE.DataTexture(paint(kind, size, w), size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.needsUpdate = true; t.userData = { kind, wear: w };
  return t;
}
/**
 * Uniforme compartido con la textura de un tipo y un nivel de desgaste (cacheado). Los materiales guardan el uniforme:
 * al cambiar el nivel de pixelado se cambia la textura dentro de él y todos se actualizan.
 */
export function textureUniform(kind: TexKind, wear = 0): { value: THREE.DataTexture } {
  const w = Math.round(wear * 4) / 4;
  const key = `${kind}|${w}`;
  let u = uniforms.get(key);
  if (!u) { u = { value: make(kind, w) }; uniforms.set(key, u); }
  return u;
}

export const pixelLevel = () => size;
/** Cambia el nivel de pixelado (lado de la textura en px) y lo guarda; todas las texturas se rehacen. */
export function setPixelLevel(px: number) {
  if (!PIXEL_LEVELS.includes(px) || px === size) return;
  size = px;
  try { localStorage.setItem(KEY, String(px)); } catch { /* sin almacenamiento */ }
  for (const u of uniforms.values()) { const old = u.value; u.value = make(old.userData.kind, old.userData.wear); old.dispose(); }
  for (const f of listeners) f();
}
export const onPixelLevel = (f: () => void) => listeners.add(f);
