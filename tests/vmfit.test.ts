// Encargo 46, recalibrado en el 50: la silueta proyectada del arma en mano. `projectedSize` mide la caja en fracción de
// pantalla y `hipScale`/`aimScale` dan el encogido de cadera (1 mientras el arma cabe; solo baja para las atípicas) sin
// tocar el apuntado.
import { describe, expect, it } from "vitest";
import { HIP_H_MAX, HIP_W_MAX, VM_SCALE_MIN, aimScale, hipScale, projectedSize, type VmCorner } from "../src/game/vmfit";

/** 8 esquinas de una caja alineada con la cámara (x0..x1, y0..y1, z0..z1). */
const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): VmCorner[] => {
  const out: VmCorner[] = [];
  for (let c = 0; c < 8; c++) out.push([c & 1 ? x1 : x0, c & 2 ? y1 : y0, c & 4 ? z1 : z0]);
  return out;
};

describe("silueta proyectada del arma (encargos 46 y 50)", () => {
  it("proyecta una caja conocida como fracción de la pantalla", () => {
    // FOV 90 y aspecto 1: una caja de 2 × 2 m a 2 m ocupa la mitad del ancho y del alto (NDC ±0,5 → 1 de 2)
    const s = projectedSize(box(-1, -1, -2, 1, 1, -2), 90, 1);
    expect(s.w).toBeCloseTo(0.5, 6);
    expect(s.h).toBeCloseTo(0.5, 6);
    // Al doble de distancia ocupa la mitad
    const lejos = projectedSize(box(-1, -1, -4, 1, 1, -4), 90, 1);
    expect(lejos.w).toBeCloseTo(0.25, 6);
    expect(lejos.h).toBeCloseTo(0.25, 6);
  });

  it("respeta el aspecto de la pantalla y las esquinas no visibles", () => {
    // Con aspecto 2: el mismo ancho ocupa la mitad en horizontal, pero el alto no cambia
    const ancho = projectedSize(box(-1, -1, -2, 1, 1, -2), 90, 2);
    expect(ancho.w).toBeCloseTo(0.25, 6);
    expect(ancho.h).toBeCloseTo(0.5, 6);
    // Esquinas detrás de la cámara (z ≥ 0), a NaN o no finitas no cuentan
    const detras: VmCorner[] = [[0, 0, 1], [0.5, 0.5, -2], [NaN, 0, -1], [0, 0, -1]];
    const s = projectedSize(detras, 90, 1);
    expect(Number.isFinite(s.w) && Number.isFinite(s.h)).toBe(true);
    expect(s.w).toBeGreaterThan(0);
    // Sin esquinas válidas, cero
    expect(projectedSize([[0, 0, 1], [1, 1, 2]], 90, 1)).toEqual({ w: 0, h: 0 });
  });

  it("recorta al viewport cuando se pide (lo que sale de cuadro no ocupa pantalla)", () => {
    // Caja que desborda por los cuatro lados: sin recorte mide más que la pantalla; con recorte, 1 × 1
    const fuera = projectedSize(box(-4, -4, -1, 4, 4, -1), 90, 1);
    expect(fuera.w).toBeGreaterThan(1); expect(fuera.h).toBeGreaterThan(1);
    const dentro = projectedSize(box(-4, -4, -1, 4, 4, -1), 90, 1, true);
    expect(dentro.w).toBeCloseTo(1, 6); expect(dentro.h).toBeCloseTo(1, 6);
    // Solo la mitad izquierda dentro: recortada ocupa media pantalla
    const media = projectedSize(box(-2, 0.1, -2, 0, 0.3, -2), 90, 1, true);
    expect(media.w).toBeCloseTo(0.5, 6);
  });

  it("por debajo de los límites (0,55 × 0,50) la escala es exactamente 1: el arma no cambia", () => {
    expect(HIP_W_MAX).toBe(0.55);
    expect(HIP_H_MAX).toBe(0.5);
    expect(hipScale(0.3, 0.3)).toBe(1);
    expect(hipScale(HIP_W_MAX, HIP_H_MAX)).toBe(1);
    expect(hipScale(0.54, 0.49)).toBe(1);
    expect(hipScale(0.1, 0.49)).toBe(1);
  });

  it("solo las atípicas se encogen: decrece con la silueta y nunca baja de 0,82", () => {
    expect(VM_SCALE_MIN).toBe(0.82);
    const a = hipScale(0.6, 0.3), b = hipScale(0.9, 0.3), c = hipScale(3, 0.3);
    expect(a).toBeLessThan(1);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThanOrEqual(c);
    for (const h of [0.6, 0.8, 2, 10]) {
      const s = hipScale(0.2, h);
      expect(s).toBeGreaterThanOrEqual(VM_SCALE_MIN);
      expect(s).toBeLessThanOrEqual(1);
    }
    for (const w of [0.6, 0.9, 2, 10]) {
      const s = hipScale(w, 0.1);
      expect(s).toBeGreaterThanOrEqual(VM_SCALE_MIN);
      expect(s).toBeLessThanOrEqual(1);
    }
    expect(hipScale(3, 0.1)).toBe(VM_SCALE_MIN);
    expect(hipScale(0.62, 0.1)).toBeCloseTo(HIP_W_MAX / 0.62, 6);
    expect(hipScale(0.3, 0.6)).toBeCloseTo(HIP_H_MAX / 0.6, 6);
  });

  it("al apuntar la escala vuelve a 1 y en cadera es la calculada", () => {
    expect(aimScale(VM_SCALE_MIN, 1)).toBe(1);
    expect(aimScale(VM_SCALE_MIN, 0)).toBe(VM_SCALE_MIN);
    expect(aimScale(1, 0.5)).toBe(1);
    expect(aimScale(0.85, 0.5)).toBeCloseTo(0.925, 9);
    // Acota el apuntado fuera de 0..1
    expect(aimScale(0.85, 2)).toBe(1);
    expect(aimScale(0.85, -1)).toBe(0.85);
  });
});
