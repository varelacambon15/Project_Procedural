// Encargo 50 (corrige el 35): en cadera el arma vuelve a la distancia de antes; solo las muy altas se apartan un poco
// (fórmula original, tope de 12 cm), y al apuntar nada de eso interviene: ADS queda igual sea cual sea el tamaño.
import { describe, expect, it } from "vitest";
import { ViewAnimator, type AnimInput } from "../src/game/anim";

const idle = (o: Partial<AnimInput> = {}): AnimInput => ({ dt: 1 / 60, time: 0, ads: 0, moving: 0, sprinting: false, grounded: true, vy: 0, lookX: 0, lookY: 0, length: 0.9, sightY: 0.05, reload: null, draw: 0, holster: 0, inspect: null, cycle: null, empty: false, ...o });
/** Cadera por la empuñadura de antes del encargo 35: la culata no pasa de 34 cm detrás del ojo y las altas se apartan ≤12 cm. */
const antes = (gripZ: number, length: number, gripX: number, bulk: number) =>
  Math.min(-gripZ + gripX, 0.34 - length * 0.5) - Math.min(0.12, Math.max(0, bulk - 0.28) * 1.6);

describe("tamaño del arma en cadera (encargo 50)", () => {
  it("un arma de bulk normal queda exactamente donde estaba antes del encargo 35", () => {
    // [clase, alto, largo, x de la empuñadura, gripZ de la clase]
    const cases: [string, number, number, number, number][] = [["rifle", 0.241, 0.844, -0.076, 0.2], ["rifle", 0.283, 0.949, -0.076, 0.2], ["lmg", 0.216, 1.316, -0.188, 0.24], ["sniper", 0.263, 1.32, -0.158, 0.22]];
    for (const [c, H, L, gripX, gripZ] of cases) {
      const a = new ViewAnimator(); a.setClass(c);
      const z = a.hipBase({ length: L, gripX, gripY: -0.05, bulk: H })[2];
      expect(z).toBeCloseTo(antes(gripZ, L, gripX, H), 9);
    }
    // (hasta 0,28 m no hay apartado ninguno: mismo z que un arma aún más baja)
    const a = new ViewAnimator(); a.setClass("rifle");
    expect(a.hipBase({ length: 0.844, gripX: -0.076, gripY: -0.05, bulk: 0.28 })[2])
      .toBe(a.hipBase({ length: 0.844, gripX: -0.076, gripY: -0.05, bulk: 0.1 })[2]);
  });

  it("solo las muy altas se apartan, con un tope de 12 cm (no aleja de forma general)", () => {
    const a = new ViewAnimator(); a.setClass("rifle");
    const z = (bulk: number) => a.hipBase({ length: 1.033, gripX: -0.207, gripY: -0.05, bulk })[2];
    const low = z(0.241), tall = z(0.391);
    expect(low - tall).toBeCloseTo(0.12, 9); // (la Partisan: (0,391-0,28)·1,6 = 0,178 → tope 0,12)
    expect(z(0.28) - z(0.3)).toBeCloseTo(0.032, 9); // (por tramos, sin saltos)
    // El x/y de cadera no depende del tamaño; las cortas (`gripAnchor`) tampoco se alejan por alto
    const p = new ViewAnimator(); p.setClass("pistol");
    expect(p.hipBase({ length: 0.24, gripX: 0.03, gripY: -0.02, bulk: 0.4 })[2]).toBe(p.hipBase({ length: 0.24, gripX: 0.03, gripY: -0.02, bulk: 0.1 })[2]);
  });

  it("al apuntar no cambia nada (el apartado por tamaño no interviene)", () => {
    const aim = (bulk: number, extra: Partial<AnimInput> = {}) => { const a = new ViewAnimator(); a.setClass("rifle"); return a.update(idle({ ads: 1, length: 1.03, gripX: -0.2, gripY: -0.05, sightX: -0.32, bulk, ...extra })); };
    // (con óptica, la posición sale de la lente y no de la cadera: idéntica con cualquier tamaño)
    const tall = aim(0.4), low = aim(0.24);
    for (let i = 0; i < 3; i++) expect(tall.pos[i]).toBeCloseTo(low.pos[i], 9);
    // (con mira de hierro, dos alturas también dan la misma pose de apuntado)
    const a = aim(0.4, { iron: true }), b = aim(0.36, { iron: true });
    for (let i = 0; i < 3; i++) expect(a.pos[i]).toBeCloseTo(b.pos[i], 9);
  });
});
