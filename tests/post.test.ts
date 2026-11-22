// Plan de postprocesado por nivel de calidad y la aberración cromática del daño (lógica pura).
import { describe, expect, it } from "vitest";
import { ABER_MAX, decayAberration, hitAberration, postPlan } from "../src/game/post";

describe("plan de postprocesado por calidad", () => {
  it("Bajo va sin cadena ni efectos (render directo, como hasta ahora)", () => {
    const p = postPlan("low");
    expect(p).toEqual({ chain: false, bloomScale: 0, vignette: false, grain: false, aberration: false, fxaa: false });
  });
  it("Medio añade tono, bloom a media resolución, viñeta y FXAA, sin grano ni aberración", () => {
    const p = postPlan("medium");
    expect(p.chain).toBe(true);
    expect(p.bloomScale).toBe(0.5);
    expect(p.vignette).toBe(true);
    expect(p.fxaa).toBe(true);
    expect(p.grain).toBe(false);
    expect(p.aberration).toBe(false);
  });
  it("Alto añade grano y aberración, con el bloom a mayor resolución que Medio", () => {
    const p = postPlan("high");
    expect(p.chain).toBe(true);
    expect(p.grain).toBe(true);
    expect(p.aberration).toBe(true);
    expect(p.vignette).toBe(true);
    expect(p.fxaa).toBe(true);
    expect(p.bloomScale).toBeGreaterThan(postPlan("medium").bloomScale);
  });
});

describe("aberración cromática al recibir daño", () => {
  it("se acumula con los golpes y no pasa del tope", () => {
    let v = 0;
    for (let i = 0; i < 50; i++) v = hitAberration(v, 40);
    expect(v).toBe(ABER_MAX);
    expect(hitAberration(0, 10)).toBeGreaterThan(hitAberration(0, 5));
    expect(hitAberration(0, 10)).toBeLessThanOrEqual(ABER_MAX);
  });
  it("el daño negativo o nulo no la sube", () => {
    expect(hitAberration(0, 0)).toBeGreaterThanOrEqual(0);
    expect(hitAberration(0, -5)).toBeLessThanOrEqual(hitAberration(0, 0));
  });
  it("cae exponencialmente hacia 0 con el tiempo", () => {
    let v = hitAberration(0, 60);
    for (let i = 0; i < 30; i++) v = decayAberration(v, 0.05);
    expect(v).toBeLessThan(ABER_MAX * 0.01);
    expect(decayAberration(0, 0.1)).toBe(0);
    expect(decayAberration(-1, 0.1)).toBe(0);
    // un paso largo la acerca más a 0 que uno corto
    expect(decayAberration(0.01, 1)).toBeLessThan(decayAberration(0.01, 0.01));
  });
});
