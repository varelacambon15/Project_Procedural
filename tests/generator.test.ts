import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator, RARITIES } from "../src/weapons/generator";
import type { Manifest } from "../src/weapons/types";

const manifest: Manifest = JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8"));
const gen = new WeaponGenerator(manifest);

describe("WeaponGenerator", () => {
  it("la misma semilla produce la misma arma", () => {
    expect(gen.generate(1234)).toEqual(gen.generate(1234));
  });

  it("genera armas de todos los tipos con piezas que existen", () => {
    for (const t of gen.types) for (let s = 0; s < 60; s++) {
      const w = gen.generate(s, t);
      expect(w.type).toBe(t);
      for (const p of w.parts) expect(gen.byId.has(p.from)).toBe(true);
      if (w.optic) expect(gen.byId.has(w.optic)).toBe(true);
      if (w.muzzle) expect(gen.byId.has(w.muzzle)).toBe(true);
      for (const v of Object.values(w.stats)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it("las pistolas modulares combinan corredera y armazón de pistolas distintas", () => {
    const mods = Array.from({ length: 300 }, (_, s) => gen.generate(s, "pistol")).filter((w) => w.layout === "modular-pistol");
    expect(mods.length).toBeGreaterThan(0);
    for (const w of mods) expect(w.parts.find((p) => p.role === "frame")!.from).not.toBe(w.parts.find((p) => p.role === "slide")!.from);
  });

  it("solo las legendarias tienen nombre propio; el resto, designación técnica", () => {
    for (let s = 0; s < 500; s++) {
      const w = gen.generate(s);
      if (w.rarity.id === "legendaria") expect(w.name).not.toMatch(/^[A-Z]{2}-\d/);
      else expect(w.name).toMatch(/^[A-Z]{2}-\d+/);
    }
  });

  it("las rarezas salen en proporciones razonables", () => {
    const count: Record<string, number> = {};
    for (let s = 0; s < 4000; s++) { const r = gen.generate(s).rarity.id; count[r] = (count[r] ?? 0) + 1; }
    const total = RARITIES.reduce((a, r) => a + r.weight, 0);
    for (const r of RARITIES) expect(Math.abs(count[r.id] / 4000 - r.weight / total)).toBeLessThan(0.03);
  });
});
