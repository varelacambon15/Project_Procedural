// Texturas pequeñas pixeladas generadas por código (estética retro de simulación). Son en escala de grises: el color lo
// pone el acabado del arma (tinte por material) y la oclusión, el color de vértice. Todas se proyectan con el MISMO
// tamaño de píxel en el mundo (TILE metros por repetición), así ninguna pieza parece pegada de otra.
import * as THREE from "three";

/** Granos del acabado (encargo 21).cerakote/anodizado/varnished/parkerized/brass son variantes sobrias compartidas. */
export type TexKind = "metal" | "polymer" | "wood" | "fabric" | "rust" | "stipple" | "checker" | "engrave" | "cerakote" | "anodized" | "varnished" | "parkerized" | "brass";
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

const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
/** Glifos de 3×5 bits para el grabado procedural (marca y numeración diminuta del cajón/cañón). */
const GLYPHS = [[7, 5, 5, 5, 7], [6, 2, 2, 2, 7], [7, 1, 7, 4, 7], [7, 1, 3, 1, 7], [5, 5, 7, 1, 1], [7, 4, 7, 1, 7]];

/**
 * Pinta una textura en escala de grises. Canales (encargo 21):
 * R = grano de color (se multiplica por el acabado), G = desconchones/arañazos (lo modula el desgaste de la era),
 * B = variación de rugosidad, A = 255. Una sola textura compartida por tipo y desgaste: sin texturas nuevas por arma.
 */
function paint(kind: TexKind, n: number, wear: number): Uint8Array {
  const d = new Uint8Array(n * n * 4);
  const big = noise(n, 4, 11), mid = noise(n, 8, 23), fine = noise(n, Math.max(8, n / 4), 37), grime = noise(n, 6, 51);
  const r = rng(kind.length * 101 + n);
  const scratches = Array.from({ length: Math.round(n / 10) }, () => ({ x: r() * n, y: r() * n, len: 4 + r() * n * 0.3, a: (r() - 0.5) * 0.5 }));
  const woodish = kind === "wood" || kind === "varnished" || kind === "checker";
  const bare = kind === "metal" || kind === "rust" || kind === "parkerized" || kind === "brass";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let v = 1, rough = 0.8, scuff = 0;
    if (kind === "metal") {
      v = 0.9 + 0.08 * fine(x * 0.25, y * 2) + 0.05 * (mid(x, y) - 0.5);
      rough = 0.55 + 0.4 * fine(x * 0.25, y * 2);
    } else if (kind === "cerakote") {
      // Cerámica: grano finísimo y parejo, mate; sin vetas ni reflejos de acero desnudo
      v = 0.95 + 0.04 * fine(x, y) + 0.02 * (mid(x, y) - 0.5); rough = 0.84 + 0.14 * fine(x, y);
    } else if (kind === "anodized") {
      // Anodizado: microestrías verticales muy sutiles, casi sin desgaste
      v = 0.94 + 0.05 * fine(x * 2, y * 0.3) + 0.02 * (mid(x, y) - 0.5); rough = 0.5 + 0.22 * fine(x * 2, y * 0.3);
    } else if (kind === "parkerized") {
      const m = big(x, y) * 0.6 + mid(x, y) * 0.4;
      v = 0.68 + 0.3 * m + 0.06 * (fine(x, y) - 0.5); rough = 0.82 + 0.16 * mid(x, y);
    } else if (kind === "polymer") {
      v = 0.93 + 0.07 * (fine(x, y) > 0.55 ? 1 : 0) + 0.03 * (mid(x, y) - 0.5); rough = 0.86 + 0.12 * fine(x, y);
    } else if (kind === "wood" || kind === "varnished") {
      const w = y + 6 * (big(x, y) - 0.5) + 2 * Math.sin(x * 0.15);
      v = kind === "varnished" ? 0.88 + 0.1 * (0.5 + 0.5 * Math.sin(w * 0.9)) + 0.03 * (fine(x, y) - 0.5)
        : 0.82 + 0.16 * (0.5 + 0.5 * Math.sin(w * 0.9)) + 0.06 * (fine(x, y) - 0.5);
      rough = 0.58 + 0.3 * (0.5 + 0.5 * Math.sin(w * 0.9));
    } else if (kind === "stipple") {
      const cx = x % 3, cy = (y + (x >> 2)) % 3;
      v = 0.95 + 0.04 * (mid(x, y) - 0.5) - (cx === 1 && cy === 1 ? 0.28 : 0); rough = 0.9;
    } else if (kind === "checker") {
      const w = y + 6 * (big(x, y) - 0.5);
      const grain = 0.86 + 0.1 * (0.5 + 0.5 * Math.sin(w * 0.9));
      const a = (x + y) % 4, b = (x - y + n * 4) % 4;
      v = grain - (a === 0 || b === 0 ? 0.22 : 0); rough = 0.6 + 0.3 * (a === 0 || b === 0 ? 1 : 0);
    } else if (kind === "engrave") {
      // Filas de caracteres 3×5 (antes se sobreescribían con la trama de tela y no se veían)
      const row = Math.floor(y / 9), ry = y % 9 - 2, col = Math.floor(x / 4), rx = x % 4;
      const g = GLYPHS[Math.abs(Math.imul(col * 73856093 ^ row * 19349663, 0x5bd1e995)) % GLYPHS.length];
      const on = ry >= 0 && ry < 5 && rx < 3 && ((g[ry] >> (2 - rx)) & 1) === 1;
      v = on ? 0.58 : 0.98 + 0.02 * fine(x, y); rough = on ? 0.72 : 0.5;
    } else if (kind === "brass") {
      v = 0.92 + 0.07 * fine(x * 0.3, y * 2) + 0.02 * (mid(x, y) - 0.5); rough = 0.4 + 0.24 * fine(x * 0.3, y * 2);
    } else if (kind === "fabric") {
      v = 0.85 + 0.15 * (((x >> 1) + (y >> 1)) % 2 === 0 ? (x % 2) : (y % 2)) + 0.05 * (mid(x, y) - 0.5); rough = 0.92;
    } else {
      // Óxido: manchas y picaduras
      const m = big(x, y) * 0.6 + mid(x, y) * 0.4;
      v = 0.7 + 0.35 * m + (fine(x, y) > 0.78 ? -0.15 : 0); rough = 0.8 + 0.18 * mid(x, y);
    }
    if (bare || woodish) {
      for (const s of scratches) { const dx = x - s.x, dy = y - s.y - dx * s.a; if (dx > 0 && dx < s.len && Math.abs(dy) < 0.7) scuff = Math.max(scuff, 0.75); }
      if (mid(x * 2, y * 2) > (woodish ? 0.9 : 0.86)) scuff = Math.max(scuff, 0.5);
    } else if (kind === "engrave") {
      scuff = 0;
    } else {
      scuff = fine(x, y) > 0.94 ? 0.35 : 0; // cerakote/anodizado/polímero: marcas mínimas
    }
    const dirt = grime(x, y);
    if (dirt > 1 - wear * 0.6) v *= 0.82;
    if (wear > 0.4 && mid(x * 2, y * 2) > 0.86) v *= 1.12;
    d.set([byte(v * 200), byte(scuff * 255), byte(rough * 255), 255], (y * n + x) * 4);
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

// ---------- Variación de rugosidad: mapas pequeños de lienzo, cacheados y compartidos ----------
/** Clases de variación de rugosidad: acero cepillado, polímero graneado, madera con veta, suelo pulido y panel técnico. */
export type RoughKind = "steel" | "polymer" | "wood" | "floor" | "panel";
const roughs = new Map<string, THREE.CanvasTexture>();

/** Dibuja un mapa de rugosidad de 64×64 (grises 184–255: claro = rugoso). Determinista (mismo dibujo siempre). */
function makeRoughness(kind: RoughKind): THREE.CanvasTexture {
  const n = 64, c = document.createElement("canvas"); c.width = c.height = n;
  const g = c.getContext("2d")!, r = rng(kind.length * 613 + n);
  const noise = (base: number, amp: number, count: number) => {
    g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, n, n);
    for (let i = 0; i < count; i++) { const v = Math.max(0, Math.min(255, base + Math.round((r() - 0.5) * 2 * amp))); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1); }
  };
  if (kind === "steel") {
    // Cepillado: estrías horizontales finas (la luz barre el acero en bandas)
    noise(232, 14, 260);
    for (let y = 0; y < n; y += 2) { const v = 220 + Math.floor(r() * 30); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, n, 1); }
  } else if (kind === "polymer") {
    // Graneado del molde: puntitos finos y parejos
    noise(242, 10, 420);
    for (let i = 0; i < 140; i++) { const v = 200 + Math.floor(r() * 30); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1); }
  } else if (kind === "wood") {
    // Veta: bandas a lo largo de X (la laca desgasta en las vetas)
    noise(228, 12, 180);
    for (let y = 0; y < n; y++) { const v = 218 + Math.round(22 * Math.sin(y * 0.55 + Math.sin(y * 0.13) * 3)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, n, 1); }
  } else if (kind === "floor") {
    // Suelo pulido: la junta de borde (misma posición que en el mapa de color) queda más rugosa que la baldosa
    noise(212, 12, 320);
    g.fillStyle = "rgb(250,250,250)";
    g.fillRect(0, 0, n, 2); g.fillRect(0, 0, 2, n);
  } else {
    // Panel: filas de chapa con juntas y algo de suciedad
    noise(236, 12, 220);
    for (let y = 0; y < n; y += 16) { g.fillStyle = "rgb(250,250,250)"; g.fillRect(0, y, n, 1); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
  return t;
}

/**
 * Mapa de rugosidad compartido por clase y repetición (cacheado): la variación de brillo de acero, polímero, madera,
 * suelos y paneles sin texturas pesadas — una sola textura de 64×64 por combinación para toda la escena.
 */
export function roughnessTexture(kind: RoughKind, repeat?: [number, number]): THREE.CanvasTexture {
  const key = `${kind}|${repeat ? repeat.join(",") : ""}`;
  let t = roughs.get(key);
  if (!t) {
    t = makeRoughness(kind);
    if (repeat) t.repeat.set(...repeat);
    roughs.set(key, t);
  }
  return t;
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
