import { describe, expect, it } from "vitest";
import { ANIM_CLASSES, ViewAnimator, animParams, phaseAt, type AnimInput } from "../src/game/anim";

const idle = (o: Partial<AnimInput> = {}): AnimInput => ({ dt: 1 / 60, time: 0, ads: 0, moving: 0, sprinting: false, grounded: true, vy: 0, lookX: 0, lookY: 0, length: 0.7, sightY: 0.05, reload: null, draw: 0, holster: 0, inspect: null, cycle: null, empty: false, ...o });

describe("capa de animación procedural", () => {
  it("cada clase tiene fases de recarga que suman 1 y un muelle estable", () => {
    for (const c of ANIM_CLASSES) {
      const p = animParams(c);
      expect(p.reload.phases.reduce((s, [, d]) => s + d, 0)).toBeCloseTo(1, 5);
      expect(p.kick.k).toBeGreaterThan(0); expect(p.kick.zeta).toBeGreaterThan(0.3);
      expect(p.holster).toBeGreaterThan(0); expect(p.holster).toBeLessThanOrEqual(0.3);
    }
  });

  it("el retroceso visual sube con el disparo y vuelve a reposo (también con pasos de tiempo grandes)", () => {
    for (const c of ANIM_CLASSES) {
      const a = new ViewAnimator(); a.setClass(c); a.shot(1);
      let peak = 0;
      for (let i = 0; i < 30; i++) { a.update(idle({ dt: 0.05 })); peak = Math.max(peak, a.kick); }
      expect(peak).toBeGreaterThan(0.2 * animParams(c).kick.peak);
      expect(peak).toBeLessThanOrEqual(1.4);
      expect(Math.abs(a.kick)).toBeLessThan(0.02);
    }
  });

  it("la curva depende de la clase: la pistola se recupera antes que el francotirador", () => {
    const settle = (c: string) => { const a = new ViewAnimator(); a.setClass(c); a.shot(1); let t = 0; for (let i = 0; i < 600; i++) { a.update(idle({ dt: 1 / 240 })); t += 1 / 240; if (i > 10 && Math.abs(a.kick) < 0.05) break; } return t; };
    expect(settle("pistol")).toBeLessThan(settle("sniper"));
  });

  it("la recarga por cargador saca el cargador, lo esconde en la bolsa y lo vuelve a meter; el amartillado mueve la pieza", () => {
    const a = new ViewAnimator(); a.setClass("rifle");
    const at = (p: number) => a.update(idle({ reload: p }));
    const phases = animParams("rifle").reload.phases;
    const mid = (id: string) => { let acc = 0; for (const [x, d] of phases) { if (x === id) return acc + d / 2; acc += d; } return 0; };
    expect(at(mid("out")).mag.offset[1]).toBeLessThan(-0.05);
    expect(at(mid("pouch")).mag.visible).toBe(false);
    expect(Math.abs(at(mid("settle")).mag.offset[1])).toBe(0);
    expect(at(mid("rack")).parts.charging).toBeGreaterThan(0.02);
    expect(phaseAt(phases, mid("rack")).id).toBe("rack");
  });

  it("la pistola deja la corredera atrás con el cargador vacío y la escopeta recarga cartucho a cartucho", () => {
    const a = new ViewAnimator(); a.setClass("pistol");
    expect(a.update(idle({ empty: true })).parts.slide).toBeCloseTo(animParams("pistol").cycle.travel);
    expect(a.update(idle({ empty: false })).parts.slide).toBe(0);
    const ids = new Set<string>(); for (let p = 0; p <= 1; p += 0.01) ids.add(phaseAt(animParams("shotgun").reload.phases, p).id);
    expect(ids.has("shell")).toBe(true);
    expect(animParams("shotgun").reload.phases.filter(([x]) => x === "shell").length).toBeGreaterThanOrEqual(3);
  });

  it("sacar y guardar bajan el arma; esprintar la cambia de pose; apuntar la centra", () => {
    const a = new ViewAnimator(); a.setClass("rifle");
    const rest = a.update(idle());
    expect(a.update(idle({ draw: 1 })).pos[1]).toBeLessThan(rest.pos[1] - 0.1);
    expect(a.update(idle({ holster: 1 })).pos[1]).toBeLessThan(rest.pos[1] - 0.1);
    for (let i = 0; i < 60; i++) a.update(idle({ sprinting: true }));
    expect(a.update(idle({ sprinting: true })).rot[1]).toBeGreaterThan(0.5);
    const b = new ViewAnimator(); b.setClass("rifle");
    expect(Math.abs(b.update(idle({ ads: 1 })).pos[0])).toBeLessThan(0.01);
  });
});
