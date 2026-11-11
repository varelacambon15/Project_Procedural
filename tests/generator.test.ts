import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator, RARITIES, TYPE_INFO } from "../src/weapons/generator";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const manifest: Manifest = JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8"));
const gen = new WeaponGenerator(manifest);
const many = (n: number, type?: Parameters<typeof gen.generate>[1]) => Array.from({ length: n }, (_, s) => gen.generate(s, type));
const avg = (ws: WeaponSpec[], k: keyof WeaponSpec["stats"]) => ws.reduce((a, w) => a + w.stats[k], 0) / ws.length;

describe("WeaponGenerator", () => {
  it("la misma semilla produce la misma arma", () => {
    expect(gen.generate(1234)).toEqual(gen.generate(1234));
  });

  it("genera armas de todos los tipos con piezas que existen", () => {
    for (const t of gen.types) for (const w of many(40, t)) {
      expect(w.type).toBe(t);
      for (const p of w.parts) expect(gen.byId.has(p.from)).toBe(true);
      for (const v of Object.values(w.stats)) expect(Number.isFinite(v)).toBe(true);
      expect(TYPE_INFO[t].archetypes.some((a) => a.id === w.archetype)).toBe(true);
    }
  });

  it("habilidades según la rareza: blancas y verdes ninguna, azul 1, morada 2, legendaria 2 + 1 especial", () => {
    for (const w of many(800)) {
      const own = w.effects.filter((e) => !(w.type === "flamethrower" && e.id === "fuego"));
      const specials = own.filter((e) => e.kind === "special").length;
      const expected = { comun: 0, poco: 0, rara: 1, epica: 2, legendaria: 3 }[w.rarity.id];
      expect(own.length).toBe(expected);
      expect(specials).toBe(w.rarity.id === "legendaria" ? 1 : 0);
      expect(w.effects.filter((e) => e.kind === "element").length).toBeLessThanOrEqual(1);
    }
  });

  it("las rarezas altas tienen mejores estadísticas", () => {
    const rifles = many(1500, "rifle");
    const by = (id: string) => rifles.filter((w) => w.rarity.id === id);
    expect(avg(by("poco"), "dano") / avg(by("comun"), "dano")).toBeGreaterThan(1.02);
    expect(avg(by("epica"), "precision")).toBeGreaterThan(avg(by("comun"), "precision"));
  });

  it("los subfusiles disparan más rápido que los fusiles y los revólveres pegan más que las pistolas", () => {
    expect(avg(many(300, "smg"), "cadencia")).toBeGreaterThan(avg(many(300, "rifle"), "cadencia"));
    expect(avg(many(300, "revolver"), "dano")).toBeGreaterThan(avg(many(300, "pistol"), "dano"));
  });

  it("hay variantes: pistolas automáticas y subfusiles lentos", () => {
    expect(many(400, "pistol").some((w) => w.fireMode === "auto")).toBe(true);
    expect(many(400, "smg").some((w) => w.archetype === "tactical")).toBe(true);
  });

  it("el modelo manda: una AA-12 suele ser automática y una L115 de cerrojo", () => {
    const aa = many(3000, "shotgun").filter((w) => w.parts[0].from === "w-aa12");
    expect(aa.filter((w) => w.fireMode === "auto").length / aa.length).toBeGreaterThan(0.6);
    const l115 = many(3000, "sniper").filter((w) => w.parts[0].from === "w-l115");
    expect(l115.filter((w) => w.fireMode === "bolt").length / l115.length).toBeGreaterThan(0.6);
  });

  it("solo las legendarias tienen nombre propio; el resto, designación técnica", () => {
    for (const w of many(500)) {
      if (w.rarity.id === "legendaria") expect(w.name).not.toMatch(/^[A-Z]{2}-\d/);
      else expect(w.name).toMatch(/^[A-Z]{2}-\d+/);
    }
  });

  it("las rarezas salen en proporciones razonables", () => {
    const count: Record<string, number> = {};
    for (const w of many(4000)) count[w.rarity.id] = (count[w.rarity.id] ?? 0) + 1;
    const total = RARITIES.reduce((a, r) => a + r.weight, 0);
    for (const r of RARITIES) expect(Math.abs(count[r.id] / 4000 - r.weight / total)).toBeLessThan(0.03);
  });
});
