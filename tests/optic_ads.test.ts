// Apuntar con óptica montada: el ojo se coloca por la lente trasera de la óptica (como con el alza), no por el largo del arma.
// Antes una óptica adelantada en el raíl dejaba el arma lejos y fina al apuntar (feedback de la sesión 1, 22/11/2026).
import { describe, expect, it } from "vitest";
import { ViewAnimator, type AnimInput } from "../src/game/anim";

const base = (o: Partial<AnimInput> = {}): AnimInput => ({ dt: 1 / 60, time: 0, ads: 1, moving: 0, sprinting: false, grounded: true, vy: 0, lookX: 0, lookY: 0, length: 0.7, sightY: 0.05, reload: null, draw: 0, holster: 0, inspect: null, cycle: null, empty: false, ...o });
const adsZ = (type: string, o: Partial<AnimInput>) => { const a = new ViewAnimator(); a.setClass(type); for (let i = 0; i < 60; i++) a.update(base(o)); return a.update(base(o)).pos[2]; };

describe("apuntar con óptica montada", () => {
  it("el ojo queda a 8,5 cm detrás de la lente trasera, sea cual sea el largo del arma", () => {
    const corto = adsZ("rifle", { length: 0.5, opticX: 0.02 }), largo = adsZ("rifle", { length: 1.1, opticX: 0.02 });
    expect(corto).toBeCloseTo(0.02 - 0.085, 2);
    expect(largo).toBeCloseTo(corto, 2);
  });

  it("una óptica más adelantada acerca el arma al ojo: la distancia ojo-óptica no cambia", () => {
    const a = adsZ("smg", { length: 0.6, opticX: 0.0 }), b = adsZ("smg", { length: 0.6, opticX: 0.12 });
    expect(b - a).toBeCloseTo(0.12, 2);
  });

  it("con miras de hierro sigue mandando el alza (a 6,5 cm detrás de ella)", () => {
    expect(adsZ("rifle", { length: 0.7, sightX: -0.05 })).toBeCloseTo(-0.05 - 0.065, 2);
  });

  it("sin datos de óptica ni de alza se conserva la colocación de siempre, que sí depende del largo", () => {
    expect(adsZ("rifle", { length: 0.5 })).not.toBeCloseTo(adsZ("rifle", { length: 1.1 }), 2);
  });
});
