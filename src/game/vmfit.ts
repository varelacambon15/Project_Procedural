// Ajuste del arma en mano por su silueta proyectada en pantalla (encargo 46). Solo lógica pura: ni DOM ni Three.js.
// La cámara del viewmodel dibuja el arma con un FOV más estrecho (`VM_FOV`) y situada detrás de la cámara del mundo
// (`VM_BACK`); aquí se mide qué fracción de la pantalla ocupa su silueta (los puntos que proyecta gun.ts) y cuánto
// hay que encogerla en cadera.
//
// Convenio de coordenadas: cada esquina es [x, y, z] en el espacio de la cámara del arma (mira hacia -Z, +Y arriba,
// z negativo delante). Las esquinas no finitas o detrás del plano cercano se ignoran (no se ven).

export type VmCorner = readonly [number, number, number];
export interface ProjectedSize { w: number; h: number }

/** Distancia de la cámara del viewmodel detrás de la del mundo (m); main.ts la usa al crear `vmCam`. */
export const VM_BACK = 0.03;
/** Fracción máxima del ancho de pantalla que puede ocupar el arma en cadera (solo por encima se encoge). */
export const HIP_W_MAX = 0.55;
/** Fracción máxima del alto de pantalla que puede ocupar el arma en cadera (solo por encima se encoge). */
export const HIP_H_MAX = 0.5;
/** Suelo de la escala en cadera: por debajo, la mano y el antebrazo quedaban desproporcionados. */
export const VM_SCALE_MIN = 0.82;
/** Suelo duro de la escala en cadera (encargo 54: 0,78). Las atípicas que ni así caben ya no se miniaturizan más: el
 *  límite las aleja y converge primero (gun.ts, `planAtypicalFit`). */
export const VM_SCALE_FLOOR = 0.78;
/** Encargo 54: alto que se acepta en las atípicas antes de encogerlas por debajo de `VM_SCALE_MIN` (el objetivo del
 *  encargo es ≤ 0,56; se apunta a 0,55, el máximo de la tabla del 51, para no quedar fuera de ella). */
export const HIP_H_TALL = 0.55;
/** Encargo 54: ancho mínimo que debe conservar la silueta al alejar una atípica (el de las referencias, 0,40). */
export const HIP_W_MIN = 0.4;
/** Plano cercano de medida (m): lo que queda detrás no se ve y no cuenta. */
const NEAR = -0.02;

/** Punto en coordenadas de la cámara del arma (mira hacia -Z) a fracción de pantalla [x, y] (0 = esquina superior
 *  izquierda); null si está detrás del plano cercano o no es finito. Mismo convenio que `projectedSize`. */
export function projectPoint(p: VmCorner, fov: number, aspect: number): [number, number] | null {
  const [x, y, z] = p;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || z >= NEAR) return null;
  const t = Math.tan((fov * Math.PI) / 360), hw = t * Math.max(1e-4, aspect), hh = t;
  return [0.5 + x / (-z) / hw / 2, 0.5 - y / (-z) / hh / 2];
}

/**
 * Ancho y alto de la caja proyectada como fracción de la pantalla (1 = pantalla entera). Proyecta cada esquina con
 * perspectiva (FOV vertical en grados y aspecto) y devuelve la extensión en NDC/2. Con `clip`, recorta antes al
 * viewport: dos esquinas fuera por el mismo lado no cuentan como pantalla que el arma ocupa. Ignora esquinas detrás
 * del plano cercano o no finitas; sin esquinas válidas devuelve {0, 0}.
 */export function projectedSize(corners: readonly VmCorner[], fov: number, aspect: number, clip = false): ProjectedSize {
  const t = Math.tan((fov * Math.PI) / 360), hw = t * Math.max(1e-4, aspect), hh = t;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const c of corners) {
    const x = c[0], y = c[1], z = c[2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) || z >= NEAR) continue;
    const nx = x / (-z) / hw, ny = y / (-z) / hh;
    if (nx < x0) x0 = nx; if (nx > x1) x1 = nx;
    if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
  }
  if (!(x1 >= x0) || !(y1 >= y0)) return { w: 0, h: 0 };
  if (clip) {
    x0 = Math.max(-1, x0); x1 = Math.min(1, x1);
    y0 = Math.max(-1, y0); y1 = Math.min(1, y1);
    if (!(x1 > x0) || !(y1 > y0)) return { w: 0, h: 0 };
  }
  return { w: (x1 - x0) / 2, h: (y1 - y0) / 2 };
}

/**
 * Escala de cadera para una silueta de `w`×`h` (fracción de pantalla): exactamente 1 si cabe dentro de los límites (el
 * arma se ve igual que antes), y si no, la que los cumple, sin bajar de `min`. Nunca supera 1.
 */
export function hipScale(w: number, h: number, min = VM_SCALE_MIN, maxW = HIP_W_MAX, maxH = HIP_H_MAX): number {
  const need = Math.max(w / maxW, h / maxH);
  if (!Number.isFinite(need) || need <= 1) return 1;
  return Math.min(1, Math.max(min, 1 / need));
}

/**
 * Escala final con el apuntado: la de cadera se desvanece con `1 - aimT`, de modo que al apuntar (aimT = 1) vale 1 y
 * la mira no cambia de tamaño. `aimT` se acota a 0..1.
 */
export function aimScale(hip: number, aimT: number): number {
  const k = Math.min(1, Math.max(0, aimT));
  return 1 - (1 - hip) * (1 - k);
}
