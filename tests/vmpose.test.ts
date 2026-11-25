import { describe, expect, it } from "vitest";
import { checkTrack, easeBy, maxAngularSpeed, sampleLeft, sampleMag, sampleNum, sampleVec, type Gun6 } from "../src/game/vmpose";
import { TRACKS, shotgunShells } from "../src/game/vmtracks";
import { GUNFEEL, adsRate, adsTime, drawTime, reloadTime } from "../src/game/gunfeel";

const Z6: Gun6 = [0, 0, 0, 0, 0, 0];

describe("poses clave (tarea 13)", () => {
  it("curvas: empiezan en 0 y acaban en 1; el rebote se pasa y vuelve", () => {
    for (const e of ["io", "o", "i", "l", "b", "s"] as const) { expect(easeBy(e, 0)).toBeCloseTo(0, 6); expect(easeBy(e, 1)).toBeCloseTo(1, 6); }
    let max = 0; for (let x = 0; x <= 1; x += 0.01) max = Math.max(max, easeBy("b", x));
    expect(max).toBeGreaterThan(1.02);
  });

  it("muestreo: valores en las claves y mezcla entre ellas", () => {
    const keys = [{ t: 0, v: 0 }, { t: 0.5, v: 1, e: "l" as const }, { t: 1, v: 0, e: "l" as const }];
    expect(sampleNum(keys, 0)).toBe(0); expect(sampleNum(keys, 0.5)).toBe(1); expect(sampleNum(keys, 0.25)).toBeCloseTo(0.5, 6);
    expect(sampleNum(keys, 2)).toBe(0);
    const mag = sampleMag([{ t: 0, v: { mode: "seat" } }, { t: 0.3, v: { mode: "well", out: 0.1 } }, { t: 0.5, v: { mode: "hide" } }, { t: 1, v: { mode: "seat" } }], 0.4);
    expect(mag.mode).toBe("well");
  });

  it("todas las pistas: claves ordenadas, empiezan (salvo sacar) y acaban en reposo, el cargador acaba en su sitio", () => {
    for (const [cls, acts] of Object.entries(TRACKS)) for (const [act, tr] of Object.entries(acts)) {
      expect(checkTrack(tr!, act !== "draw"), `${cls}/${act}`).toEqual([]);
      expect(sampleVec(tr!.gun, 1, Z6), `${cls}/${act}`).toEqual(Z6);
    }
  });

  it("sin «manos locas»: el arma nunca gira más rápido que un gesto humano rápido (≤ 14 rad/s) con la duración real", () => {
    for (const [cls, acts] of Object.entries(TRACKS)) for (const [act, tr] of Object.entries(acts)) {
      const dur = act === "draw" ? drawTime(cls, 60) : act === "inspect" ? 2.6 : reloadTime(cls, 60, act === "reloadEmpty");
      expect(maxAngularSpeed(tr!, dur), `${cls}/${act}`).toBeLessThan(14);
    }
  });

  it("la mano izquierda vuelve a su reposo al acabar cada acción", () => {
    for (const [cls, acts] of Object.entries(TRACKS)) for (const [act, tr] of Object.entries(acts)) {
      const l = sampleLeft(tr!.left, 1);
      if (l) expect(l.b.at, `${cls}/${act}`).toBe("rest");
    }
  });

  it("escopeta cartucho a cartucho: un empujón por cartucho, en la misma fase que su sonido", () => {
    for (const n of [1, 3, 6]) {
      const ph: [string, number][] = [["tilt", 0.5], ...Array.from({ length: n }, () => ["shell", 1] as [string, number]), ["rack", 0.7], ["settle", 0.4]];
      const tot = ph.reduce((a, x) => a + x[1], 0), phases = ph.map(([id, w]) => [id, w / tot] as [string, number]);
      const tr = shotgunShells(phases);
      expect(checkTrack(tr)).toEqual([]);
      expect(tr.left!.filter((k) => k.v.hand === "palm").length).toBe(n);
      expect(tr.slide!.some((k) => k.v === 1)).toBe(true); // (bombea al final)
    }
  });
});

describe("tiempos de manejo por clase (gunplay)", () => {
  it("apuntar: 0,15–0,50 s; las pistolas antes que los fusiles y estos antes que ametralladoras y francotiradores", () => {
    for (const c of Object.keys(GUNFEEL)) for (const m of [0, 50, 100]) { const t = adsTime(c, m); expect(t).toBeGreaterThanOrEqual(0.15); expect(t).toBeLessThanOrEqual(0.5); }
    expect(adsTime("pistol", 60)).toBeLessThan(adsTime("rifle", 60));
    expect(adsTime("rifle", 60)).toBeLessThan(adsTime("lmg", 60));
    expect(adsTime("smg", 60)).toBeLessThan(adsTime("sniper", 60));
    // el suavizado llega al 90 % en ese tiempo
    const t = adsTime("rifle", 60); expect(1 - Math.exp(-adsRate(t) * t)).toBeCloseTo(0.9, 6);
  });

  it("más manejo = más rápido (apuntar, sacar y recargar)", () => {
    for (const c of Object.keys(GUNFEEL)) {
      expect(adsTime(c, 90)).toBeLessThanOrEqual(adsTime(c, 20));
      expect(drawTime(c, 90)).toBeLessThan(drawTime(c, 20));
      expect(reloadTime(c, 90, false)).toBeLessThan(reloadTime(c, 20, false));
    }
  });

  it("recargas en la horquilla de los shooters de referencia (manejo 60) y la de vacío nunca más corta", () => {
    const R = (c: string, e = false) => reloadTime(c, 60, e);
    expect(R("pistol")).toBeGreaterThan(1.1); expect(R("pistol")).toBeLessThan(1.7);
    expect(R("smg")).toBeLessThan(R("rifle")); expect(R("rifle")).toBeLessThan(R("lmg"));
    expect(R("lmg", true)).toBeLessThan(4.5); // (antes ~5,5 s)
    for (const c of Object.keys(GUNFEEL)) expect(R(c, true)).toBeGreaterThanOrEqual(R(c));
  });
});
