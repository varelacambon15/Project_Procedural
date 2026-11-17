import { describe, expect, it } from "vitest";
import { SUPERS, SUPER_IDS, SuperMeter, sampleHand, track } from "../src/game/supers";

describe("súperes: datos", () => {
  it("hay quince y cada línea de tiempo es coherente", () => {
    expect(SUPER_IDS).toHaveLength(15);
    for (const id of SUPER_IDS) {
      const s = SUPERS[id];
      expect(s.hit).toBeGreaterThan(0); expect(s.hit).toBeLessThan(s.duration);
      for (const keys of [s.right, s.left]) {
        expect(keys[0].t).toBe(0); expect(keys[keys.length - 1].t).toBeCloseTo(s.duration, 5);
        for (let i = 1; i < keys.length; i++) expect(keys[i].t).toBeGreaterThan(keys[i - 1].t);
        for (const k of keys) { expect(k.curl).toBeGreaterThanOrEqual(0); expect(k.curl).toBeLessThanOrEqual(1); }
      }
      for (const tr of [s.fov, s.roll, s.lower]) expect(tr[tr.length - 1][0]).toBeCloseTo(s.duration, 5);
      expect(s.lower[0][1]).toBe(0); expect(s.lower[s.lower.length - 1][1]).toBe(0); // el arma vuelve a su sitio
    }
  });
  it("la manos empiezan y acaban en la misma pose (sin saltos al invocar)", () => {
    for (const id of SUPER_IDS) { const s = SUPERS[id], a = sampleHand(s.right, 0), b = sampleHand(s.right, s.duration); expect(a.pos).toEqual(b.pos); expect(a.curl).toBe(b.curl); }
  });
});

describe("súperes: muestreo y medidor", () => {
  it("interpola entre claves y se queda en los extremos", () => {
    const k = [{ t: 0, pos: [0, 0, 0], rot: [0, 0, 0], curl: 0, thumb: 0 }, { t: 1, pos: [2, 0, 0], rot: [90, 0, 0], curl: 1, thumb: 1 }] as Parameters<typeof sampleHand>[0];
    expect(sampleHand(k, -1).pos[0]).toBe(0); expect(sampleHand(k, 5).pos[0]).toBe(2);
    expect(sampleHand(k, 0.5).pos[0]).toBeCloseTo(1, 5); expect(sampleHand(k, 0.5).rot[0]).toBeCloseTo(45, 5);
    expect(track([[0, 0], [2, 4]], 1)).toBeCloseTo(2, 5);
  });
  it("el medidor sube con las bajas, el jefe da más, y solo se gasta lleno", () => {
    const m = new SuperMeter();
    expect(m.use()).toBe(false);
    for (let i = 0; i < 13; i++) m.kill(); expect(m.ready).toBe(true);
    expect(m.use()).toBe(true); expect(m.charge).toBe(0);
    m.kill(true); expect(m.charge).toBeCloseTo(SuperMeter.BOSS, 5);
    m.update(60); expect(m.charge).toBeGreaterThan(SuperMeter.BOSS);
  });
});

import { rollModule } from "../src/game/supers";
describe("súperes: módulos", () => {
  it("dan un súper que aún no tienes, y nada cuando ya están todos", () => {
    expect(rollModule([], 0)).toBe(SUPER_IDS[0]);
    const some = SUPER_IDS.slice(0, 14); expect(rollModule(some, 0.5)).toBe(SUPER_IDS[14]);
    expect(rollModule(SUPER_IDS, 0.3)).toBeNull();
  });
});
