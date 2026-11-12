// Tienda del 05-D: escaparate (composición, renovación por tiempo de juego, se guarda y no cambia al recargar, cada
// arma se vende una vez), cajas (suelos y garantía de la avanzada), precios leídos de los datos y simulación de una
// hora dentro de las bandas objetivo.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import data from "../src/data/shop.json";
import { WeaponGenerator } from "../src/weapons/generator";
import { CRATES, SHOWCASE, buyShowcase, crateOdds, ensureShowcase, openCrate, pityLeft, showcasePrice, showcaseRarities, showcaseSeed, type ShopState } from "../src/game/shop";
import { simulate, summary } from "../src/game/economy";
import { parseSave, SAVE_VERSION } from "../src/game/save";
import { mulberry32 } from "../src/weapons/rng";
import type { Manifest } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);

describe("escaparate (05-D)", () => {
  it("5 ranuras con la composición por ranura; nunca legendaria", () => {
    const st: ShopState = { spent: 0, history: [] };
    for (let k = 0; k < 200; k++) {
      const sc = ensureShowcase(st, k * 15 * 60 + 1, 42);
      const rar = showcaseRarities(sc);
      expect(rar.length).toBe(5);
      rar.forEach((r, i) => { expect(SHOWCASE.slots[i]).toContain(r); expect(r).not.toBe("legendaria"); });
    }
  });

  it("se renueva cada 15 min de tiempo de juego; la ranura vendida queda vacía hasta entonces", () => {
    const st: ShopState = { spent: 0, history: [] };
    const sc = ensureShowcase(st, 0, 7); const r0 = sc.round;
    expect(buyShowcase(sc, 10000, 2, 100)).toEqual({ ok: true, price: 100 });
    expect(buyShowcase(sc, 10000, 2, 100)).toEqual({ ok: false, reason: "sold" });
    expect(buyShowcase(sc, 10, 3, 100)).toEqual({ ok: false, reason: "credits" });
    ensureShowcase(st, 14 * 60, 7); expect(sc.round).toBe(r0); expect(sc.sold[2]).toBe(true);
    ensureShowcase(st, SHOWCASE.refreshMinutes * 60 + 1, 7); expect(sc.round).toBe(r0 + 1); expect(sc.sold.every((x) => !x)).toBe(true);
  });

  it("el escaparate se guarda y no cambia al recargar (mismas armas y mismo contador)", () => {
    const st: ShopState = { spent: 0, history: [] };
    const sc = ensureShowcase(st, 120, 1234); sc.sold[1] = true;
    const specs = showcaseRarities(sc).map((r, i) => gen.generate(showcaseSeed(sc, i), undefined, r));
    const save = { version: SAVE_VERSION, savedAt: "", name: "x", playSeconds: 120, credits: 10, weapons: [], active: 0, bank: [], shop: st, settings: {}, lang: "es", pixelLevel: 64 };
    const back = parseSave(JSON.stringify(save));
    expect(back.ok).toBe(true); if (!back.ok) return;
    const sc2 = ensureShowcase(back.data.shop, 120);
    expect(sc2).toEqual(sc);
    expect(showcaseRarities(sc2).map((r, i) => gen.generate(showcaseSeed(sc2, i), undefined, r))).toEqual(specs);
  });

  it("precios leídos de los datos (por rareza y nivel) y cajas con su precio", () => {
    expect(showcasePrice("rara", 8)).toBe(data.showcase.price.rara);
    expect(showcasePrice("epica", 10)).toBeGreaterThan(data.showcase.price.epica);
    expect(CRATES.common.price).toBe(data.crates.common.price);
    expect(CRATES.advanced.price).toBe(data.crates.advanced.price);
  });
});

describe("cajas (05-D)", () => {
  it("común: suelo verde, sin legendaria; avanzada: suelo azul; probabilidades que suman 1", () => {
    const st: ShopState = { spent: 0, history: [] }, r = mulberry32(3);
    for (let i = 0; i < 3000; i++) { const c = openCrate(st, 1e9, "common", r); expect(c.ok && ["poco", "rara", "epica"].includes(c.rarity)).toBe(true); }
    for (let i = 0; i < 3000; i++) { const c = openCrate(st, 1e9, "advanced", r); expect(c.ok && ["rara", "epica", "legendaria"].includes(c.rarity)).toBe(true); }
    for (const id of ["common", "advanced"] as const) expect(Object.values(crateOdds(id)).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    expect(openCrate(st, 10, "advanced", r)).toEqual({ ok: false, reason: "credits" });
  });

  it("garantía de suelo: una legendaria como mucho tras N cajas avanzadas sin salir", () => {
    const st: ShopState = { spent: 0, history: [] }, never = () => 0.5; // nunca sale legendaria por azar
    const N = CRATES.advanced.pity!;
    for (let i = 1; i < N; i++) { const c = openCrate(st, 1e9, "advanced", never); expect(c.ok && c.rarity).not.toBe("legendaria"); expect(pityLeft(st)).toBe(N - i); }
    const last = openCrate(st, 1e9, "advanced", never);
    expect(last.ok && last.rarity).toBe("legendaria"); expect(last.ok && last.pity).toBe(true);
    expect(st.pity).toBe(0);
  });
});

describe("economía: simulación de una hora (05-D)", () => {
  const s1 = summary(150, 60);
  it("primera compra en pocos minutos, azul hacia los 10, morada en ~20–50 y la legendaria es meta de horas", () => {
    expect(s1.firstBuy).toBeLessThanOrEqual(5);
    expect(s1.first.rara.any).toBeGreaterThanOrEqual(4); expect(s1.first.rara.any).toBeLessThanOrEqual(15);
    expect(s1.first.epica.any).toBeGreaterThanOrEqual(20); expect(s1.first.epica.any).toBeLessThanOrEqual(50);
    expect(s1.within.legendaria).toBeLessThanOrEqual(0.35);
    const s6 = summary(60, 360);
    expect(s6.first.legendaria.any).toBeGreaterThanOrEqual(90);
  });
  it("ni escasez ni lluvia: se compra, se abren cajas y se recoge del suelo; no se acumulan créditos sin uso", () => {
    expect(s1.bought).toBeGreaterThanOrEqual(3);
    expect(s1.pickups).toBeGreaterThanOrEqual(15); expect(s1.pickups).toBeLessThanOrEqual(60);
    expect(s1.credits).toBeLessThan(1500);
    const one = simulate(60, 5); expect(one.earned).toBeGreaterThan(1000);
  });
});
