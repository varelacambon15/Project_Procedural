// Gestos de manos al usar equipamiento o lanzar granadas (encargo 34): duración ≤ 0,45 s, la mano vuelve a su reposo y
// el daño recibido no cancela ni reinicia el gesto. Solo se prueba la capa pura (src/game/anim.ts), sin escena.
import { describe, expect, it } from "vitest";
import { GESTURE_MAX, GadgetGesture, gestureCurve, gestureParams, type GestureKind } from "../src/game/anim";

const KINDS: GestureKind[] = ["activate", "throw", "soft"];

describe("gestos de equipamiento y granadas", () => {
  it("cada gesto dura 0,45 s como mucho", () => {
    for (const k of KINDS) {
      const p = gestureParams(k);
      expect(p.dur, k).toBeGreaterThan(0.1);
      expect(p.dur, k).toBeLessThanOrEqual(GESTURE_MAX);
      expect(GESTURE_MAX).toBe(0.45);
      // Los tramos de la curva son coherentes (salen antes de golpear y todo cabe en el gesto)
      expect(p.out[0]).toBeGreaterThanOrEqual(0); expect(p.out[1]).toBeGreaterThan(p.out[0]);
      expect(p.hit[1]).toBeGreaterThan(p.hit[0]); expect(p.hit[1]).toBeLessThanOrEqual(1);
      expect(p.curl).toBeGreaterThan(0);
    }
  });

  it("la mano sale a mitad del gesto y vuelve a su reposo al final", () => {
    for (const k of KINDS) {
      const a = gestureCurve(k, 0), b = gestureCurve(k, 1);
      expect(a.out, k).toBeCloseTo(0, 5); expect(a.hit, k).toBeCloseTo(0, 5); expect(a.grip, k).toBeCloseTo(0, 5);
      expect(b.out, k).toBeCloseTo(0, 5); expect(b.hit, k).toBeCloseTo(0, 5); expect(b.grip, k).toBeCloseTo(0, 5);
      const mid = gestureCurve(k, 0.5);
      expect(Math.max(mid.out, mid.hit), k).toBeGreaterThan(0.5); // (ya no está en reposo: en la cadera o en el golpe)
      expect(mid.grip, k).toBeGreaterThan(0.5); // (el objeto va cogido)
      // La mano llega a salir del todo (a la cadera al activar, atrás al lanzar) y el golpe llega entero
      let peakOut = 0, peakHit = 0;
      for (let t = 0; t <= 1; t += 0.01) { const c = gestureCurve(k, t); peakOut = Math.max(peakOut, c.out); peakHit = Math.max(peakHit, c.hit); }
      expect(peakOut, k).toBeGreaterThan(0.95);
      expect(peakHit, k).toBeGreaterThan(0.95);
    }
  });

  it("el estado avanza solo y acaba en reposo en 0,45 s o menos", () => {
    for (const k of KINDS) {
      const g = new GadgetGesture(); g.start(k);
      expect(g.active).toBe(true); expect(g.progress).toBe(0);
      let t = 0, last = -1;
      for (let i = 0; i < 200 && g.active; i++) { g.update(1 / 60); t += 1 / 60; expect(g.progress).toBeGreaterThanOrEqual(last); last = g.progress; }
      expect(g.active, k).toBe(false);
      expect(t, k).toBeLessThanOrEqual(GESTURE_MAX + 1 / 60);
      expect(g.progress).toBe(1);
      expect(g.curve()).toBeNull();
    }
  });

  it("el daño recibido no cancela ni reinicia el gesto", () => {
    const g = new GadgetGesture(); g.start("throw");
    for (let i = 0; i < 6; i++) g.update(1 / 60); // 0,1 s
    const before = g.progress, kind = g.kind;
    g.hurt(40); g.hurt(120); // dos golpes: el gesto no se corta ni vuelve a empezar
    expect(g.active).toBe(true); expect(g.kind).toBe(kind); expect(g.progress).toBeCloseTo(before, 5);
    let t = 0.1;
    while (g.active && t < 1) { g.hurt(5); g.update(1 / 60); t += 1 / 60; }
    expect(t).toBeLessThanOrEqual(GESTURE_MAX + 1 / 60);
    // Y con pasos grandes (un tirón de fotograma) tampoco se queda a medias
    const h = new GadgetGesture(); h.start("activate"); h.update(0.5); h.hurt(9);
    expect(h.active).toBe(false); expect(h.progress).toBe(1);
  });
});
