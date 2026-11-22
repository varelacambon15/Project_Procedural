// Intensidad del mapa de entorno (ENV_INTENSITY): crece con la calidad gráfica, baja de noche y escala por material.
import { describe, expect, it } from "vitest";
import { ENV_INTENSITY, envIntensityFor } from "../src/game/envmap";

describe("envmap: intensidad del entorno", () => {
  it("crece con la calidad gráfica (Bajo < Medio < Alto)", () => {
    expect(ENV_INTENSITY.low).toBeLessThan(ENV_INTENSITY.medium);
    expect(ENV_INTENSITY.medium).toBeLessThan(ENV_INTENSITY.high);
    for (const v of Object.values(ENV_INTENSITY)) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThan(0); }
  });

  it("de noche el entorno de interior cede (intensidad menor que de día)", () => {
    for (const q of ["low", "medium", "high"] as const) {
      expect(envIntensityFor(q, true)).toBeLessThan(envIntensityFor(q, false));
      expect(envIntensityFor(q, true)).toBeCloseTo(envIntensityFor(q, false) * 0.7);
    }
  });

  it("el boost escala por material y todo queda en rango sin NaN", () => {
    for (const q of ["low", "medium", "high"] as const) {
      for (const night of [false, true]) {
        for (const boost of [0, 0.5, 1, 1.5, 3]) {
          const v = envIntensityFor(q, night, boost);
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(ENV_INTENSITY.high * 3);
        }
      }
      expect(envIntensityFor(q, false, 1)).toBeCloseTo(ENV_INTENSITY[q]);
    }
    expect(envIntensityFor("high", false, 2)).toBeCloseTo(ENV_INTENSITY.high * 2);
  });
});
