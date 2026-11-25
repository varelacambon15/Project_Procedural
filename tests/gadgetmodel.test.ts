import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { GADGET_MODEL_SIZE, deployScale, deployTime, fitScale, loadGadgetModel } from "../src/game/gadgetmodel";
import { GADGET_KINDS, type GadgetKind } from "../src/game/gadgets";

const KINDS = Object.keys(GADGET_KINDS) as GadgetKind[];
const finite = (v: number) => Number.isFinite(v);

describe("modelos GLB del equipamiento", () => {
  it("deployScale está acotada, termina en 1 exacto y no produce NaN", () => {
    for (const kind of KINDS) {
      const dur = deployTime(kind);
      expect(dur).toBeGreaterThanOrEqual(0.3);
      expect(dur).toBeLessThanOrEqual(0.6);
      for (let i = 0; i <= 40; i++) {
        const st = deployScale(kind, (dur * i) / 40);
        for (const v of [st.sx, st.sy, st.sz, st.y]) expect(finite(v)).toBe(true);
        for (const v of [st.sx, st.sy, st.sz]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1.2); }
        expect(st.y).toBeGreaterThanOrEqual(0); expect(st.y).toBeLessThanOrEqual(0.1);
      }
      expect(deployScale(kind, dur)).toEqual({ sx: 1, sy: 1, sz: 1, y: 0, done: true });
      expect(deployScale(kind, dur * 10)).toEqual({ sx: 1, sy: 1, sz: 1, y: 0, done: true });
    }
    // Entradas raras: negativas o NaN no rompen (arrancan en el estado inicial).
    expect(deployScale("turret", -2).sy).toBe(0);
    expect(finite(deployScale("mine", NaN).y)).toBe(true);
  });

  it("cada despliegue crece en su eje (turret Y, shield X/Y) y la mina cae de forma monótona", () => {
    const dur = deployTime("turret");
    for (let i = 1; i <= 30; i++) expect(deployScale("turret", (dur * i) / 30).sy).toBeGreaterThanOrEqual(deployScale("turret", (dur * (i - 1)) / 30).sy);
    const sd = deployTime("shield");
    for (let i = 1; i <= 30; i++) {
      const a = deployScale("shield", (sd * (i - 1)) / 30), b = deployScale("shield", (sd * i) / 30);
      expect(b.sx).toBeGreaterThanOrEqual(a.sx); expect(b.sy).toBeGreaterThanOrEqual(a.sy);
    }
    const md = deployTime("mine");
    for (let i = 1; i <= 30; i++) expect(deployScale("mine", (md * i) / 30).y).toBeLessThanOrEqual(deployScale("mine", (md * (i - 1)) / 30).y);
  });

  it("la cúpula crece en onda (sobreimpulso leve) y vuelve al tamaño exacto", () => {
    const dur = deployTime("dome");
    let peak = 0;
    for (let i = 0; i <= 50; i++) peak = Math.max(peak, deployScale("dome", (dur * i) / 50).sx);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(1.1);
  });

  it("un id inexistente no rompe la carga: devuelve null", async () => {
    await expect(loadGadgetModel("no-existe" as GadgetKind)).resolves.toBeNull();
    await expect(loadGadgetModel("" as GadgetKind)).resolves.toBeNull();
  });

  it("fitScale es segura: ni 0, ni NaN, ni infinito", () => {
    const sizes = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1e-9, 0, 0), new THREE.Vector3(0.5, 2, 1), new THREE.Vector3(NaN, 1, 1)];
    for (const size of sizes) for (const target of [0, -3, NaN, Infinity, 0.5, 5]) {
      const k = fitScale(size, target);
      expect(finite(k)).toBe(true); expect(k).toBeGreaterThan(0);
    }
    expect(fitScale(new THREE.Vector3(0.5, 2, 1), 4)).toBeCloseTo(2);
    expect(fitScale(new THREE.Vector3(0, 0, 0), 2)).toBe(1);
    for (const kind of KINDS) { expect(finite(GADGET_MODEL_SIZE[kind])).toBe(true); expect(GADGET_MODEL_SIZE[kind]).toBeGreaterThan(0); }
  });
});
