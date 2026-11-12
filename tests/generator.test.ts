import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator, RARITIES, TYPE_INFO, EFFECTS_L, powerScore, computeStats } from "../src/weapons/generator";
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
      for (const p of w.parts) expect(gen.byId.has(p.from) || gen.kit.byId.has(p.from)).toBe(true);
      for (const v of Object.values(w.stats)) expect(Number.isFinite(v)).toBe(true);
      expect(TYPE_INFO[t].archetypes.some((a) => a.id === w.archetype)).toBe(true);
    }
  });

  it("efectos por rareza: blanca 0, verde 0, azul A, morada B+A, legendaria B+A+L", () => {
    const expected = { comun: "", poco: "", rara: "A", epica: "BA", legendaria: "BAL" };
    for (const w of many(3000)) expect(w.effects.map((e) => e.tier).join("")).toBe(expected[w.rarity.id]);
  });

  it("verdes con 1 accesorio montado; blancas sin ninguno", () => {
    for (const w of many(3000)) {
      const own = w.optic === w.parts[0].from; // mira integrada del modelo: no es un accesorio
      const n = (w.optic && !own ? 1 : 0) + (w.muzzle ? 1 : 0);
      const can = gen.muzzleOptions(w).length > 0 || gen.opticOptions(w).length > 0;
      if (w.rarity.id === "comun") expect(n).toBe(0);
      if (w.rarity.id === "poco" && can) expect(n).toBe(1);
    }
  });

  it("fuego, eléctrico y explosivo solo en moradas y legendarias; ningún otro elemento", () => {
    for (const w of many(5000)) for (const e of w.effects) {
      if (e.element) { expect(["fuego", "electrico", "explosive"]).toContain(e.element); expect(["epica", "legendaria"]).toContain(w.rarity.id); expect(e.tier).toBe("B"); }
      expect(["corrosivo", "radiacion", "cryo", "chain"]).not.toContain(e.id);
    }
  });

  it("bandas de poder por rareza (±5%) y tope legendario", () => {
    for (const w of many(3000)) {
      const flat = { ...w, rarity: { ...w.rarity, budget: 0 } };
      const ratio = powerScore(w.stats, w.type) / powerScore(computeStats(flat), w.type);
      if (w.rarity.id === "legendaria") expect(ratio).toBeLessThanOrEqual(1 + w.rarity.budget + 0.05);
      else expect(Math.abs(ratio - (1 + w.rarity.budget))).toBeLessThanOrEqual(0.05);
    }
  });

  it("cada legendaria tiene una firma L con nombre propio, distinta de sus efectos A y B", () => {
    const names = new Map<string, string>();
    for (const w of many(4000).filter((x) => x.rarity.id === "legendaria")) {
      const L = w.effects.find((e) => e.tier === "L")!;
      expect(w.effects.filter((e) => e.id === L.id).length).toBe(1);
      if (names.has(L.id)) expect(names.get(L.id)).toBe(w.name); else names.set(L.id, w.name);
    }
    expect(new Set(names.values()).size).toBe(names.size); // nombre ↔ firma, uno a uno
  });

  it("un efecto A y uno B nunca son de la misma familia (10.000 armas)", () => {
    for (const w of many(10000)) { const fam = w.effects.map((e) => e.family); expect(new Set(fam).size).toBe(fam.length); }
  });

  it("las rarezas altas tienen mejores estadísticas", () => {
    const rifles = many(1500, "rifle");
    const by = (id: string) => rifles.filter((w) => w.rarity.id === id);
    const pw = (ws: WeaponSpec[]) => ws.reduce((a, w) => a + powerScore(w.stats, w.type), 0) / ws.length;
    expect(pw(by("poco")) / pw(by("comun"))).toBeGreaterThan(1.03);
    expect(pw(by("epica"))).toBeGreaterThan(pw(by("rara")));
  });

  it("los subfusiles disparan más rápido que los fusiles y los revólveres pegan más que las pistolas", () => {
    expect(avg(many(300, "smg"), "cadencia")).toBeGreaterThan(avg(many(300, "rifle"), "cadencia"));
    expect(avg(many(300, "revolver"), "dano")).toBeGreaterThan(avg(many(300, "pistol"), "dano"));
  });

  it("hay variantes: pistolas automáticas y subfusiles lentos", () => {
    expect(many(400, "pistol").some((w) => w.fireMode === "auto")).toBe(true);
    expect(many(400, "smg").some((w) => w.archetype === "tactical")).toBe(true);
  });

  it("modos raros (francotirador automático, revólver a ráfagas…) solo en moradas y legendarias", () => {
    expect(many(1500, "sniper").some((w) => w.fireMode === "auto")).toBe(true);
    expect(many(1500, "revolver").some((w) => w.fireMode === "burst")).toBe(true);
    expect(many(1500, "shotgun").some((w) => w.fireMode === "burst")).toBe(true);
    for (const w of many(2000)) if (w.modeShift) expect(["epica", "legendaria"]).toContain(w.rarity.id);
    for (const w of many(800)) if (w.fireMode === "burst") expect(w.burst).toBeGreaterThanOrEqual(2); else expect(w.burst).toBe(0);
  });

  it("el modelo manda: una AA-12 suele ser automática y una L115 de cerrojo", () => {
    const aa = many(3000, "shotgun").filter((w) => w.parts[0].from === "w-aa12");
    expect(aa.filter((w) => w.fireMode === "auto").length / aa.length).toBeGreaterThan(0.5);
    const l115 = many(3000, "sniper").filter((w) => w.parts[0].from === "w-l115");
    expect(l115.filter((w) => w.fireMode === "bolt").length / l115.length).toBeGreaterThan(0.5);
  });

  it("solo las legendarias tienen nombre propio; el resto, designación técnica", () => {
    for (const w of many(500)) {
      if (w.rarity.id === "legendaria") expect(EFFECTS_L.some((d) => d.name === w.name)).toBe(true);
      else expect(EFFECTS_L.some((d) => d.name === w.name)).toBe(false);
    }
  });

  it("los nombres son variados", () => {
    const names = many(400).filter((w) => w.rarity.id !== "legendaria").map((w) => w.name);
    expect(new Set(names).size / names.length).toBeGreaterThan(0.85);
  });

  it("las rarezas salen en proporciones razonables", () => {
    const count: Record<string, number> = {};
    for (const w of many(4000)) count[w.rarity.id] = (count[w.rarity.id] ?? 0) + 1;
    const total = RARITIES.reduce((a, r) => a + r.weight, 0);
    for (const r of RARITIES) expect(Math.abs(count[r.id] / 4000 - r.weight / total)).toBeLessThan(0.03);
  });
});

describe("armas largas despiezadas", () => {
  it("mezclan piezas de otras armas (también de otras familias), nunca son genéricas y pasan la puerta de calidad", async () => {
    const { longGunOk } = await import("../src/weapons/generator");
    let mixed = 0, total = 0, cross = 0;
    for (const t of ["rifle", "smg", "shotgun", "sniper", "lmg"] as const) for (const w of many(300, t)) {
      if (w.layout !== "modular-long") continue;
      total++;
      const get = (role: string) => gen.byId.get(w.parts.find((p) => p.role === role)!.from)!;
      const [r, s, g, f] = ["receiver", "stock", "grip", "front"].map(get);
      const foreign = [s, g, f].filter((x) => x !== r).length;
      expect(foreign).toBeGreaterThanOrEqual(1);
      if (foreign >= 2) mixed++;
      if ([s, g, f].some((x) => x.pack !== r.pack)) cross++;
      expect(longGunOk(r, s, f, g, w.type, w.tweaks)).toBe(true);
    }
    expect(total).toBeGreaterThan(100);
    expect(mixed / total).toBeGreaterThan(0.65);
    expect(cross / total).toBeGreaterThan(0.2);
  });
});
