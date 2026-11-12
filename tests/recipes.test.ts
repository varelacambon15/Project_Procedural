// Efectos como recetas de datos (prompt 05-C): cifras de la tanda, coste calculado en banda, contrapartidas con suelos
// y como mucho dos por arma, textos en los dos idiomas, intérprete genérico y ficha con bonus y coste.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator, computeStats } from "../src/weapons/generator";
import { EFFECT_DEFS, EffectRunner, effectDef, tradeoffCount } from "../src/weapons/effects";
import { CONTROL_STATES, RECIPE_DEFS, TRADEOFF_MAX } from "../src/weapons/recipes";
import { effectCost, effectDesc, effectName } from "../src/weapons/labels";
import { setLang } from "../src/i18n";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const fx = (id: string) => { const d = effectDef(id)!; return { id, tier: d.tier, family: d.family, element: d.element, icon: d.icon, color: d.color }; };
const runner = (ids: string[]) => new EffectRunner<string, number>({ effects: ids.map(fx) } as unknown as WeaponSpec);
const shot = (r: EffectRunner<string, number>, o: Partial<Parameters<EffectRunner<string, number>["shot"]>[0]> = {}) => r.shot({ fullMag: false, ammoFrac: 0.6, aiming: false, nearCount: 0, pellets: 1, moving: 0, ...o });

describe("efectos como recetas (05-C)", () => {
  it("primera tanda: ≥40 de nivel A, ≥30 de B (≥10 por elemento) y ≥15 legendarios", () => {
    expect(EFFECT_DEFS.filter((e) => e.tier === "A").length).toBeGreaterThanOrEqual(40);
    expect(EFFECT_DEFS.filter((e) => e.tier === "B").length).toBeGreaterThanOrEqual(30);
    for (const el of ["fuego", "electrico", "explosive"]) expect(EFFECT_DEFS.filter((e) => e.tier === "B" && e.element === el).length).toBeGreaterThanOrEqual(10);
    expect(EFFECT_DEFS.filter((e) => e.tier === "L").length).toBeGreaterThanOrEqual(15);
  });

  it("coste calculado por la receta, en la banda de su nivel; la versión arriesgada pesa más que la limpia", () => {
    const band = { A: [5, 10], B: [12, 20], L: [20, 30] } as const;
    for (const d of RECIPE_DEFS) { expect(d.cost, d.id).toBeGreaterThanOrEqual(band[d.tier][0]); expect(d.cost, d.id).toBeLessThanOrEqual(band[d.tier][1]); expect(d.gross).toBeGreaterThanOrEqual(d.cost - 0.06); }
    for (const d of RECIPE_DEFS.filter((x) => x.recipe.risky)) {
      const clean = RECIPE_DEFS.find((x) => x.id === d.id.replace(/-x$/, ""))!;
      expect(d.recipe.value).toBeGreaterThan(clean.recipe.value);
      expect(d.gross).toBeGreaterThan(clean.gross);
      expect(d.cost).toBeGreaterThanOrEqual(clean.cost);
    }
    // Ambos tipos existen para muchos efectos de nivel A
    expect(RECIPE_DEFS.filter((d) => d.recipe.risky).length).toBeGreaterThanOrEqual(15);
  });

  it("contrapartidas con suelos: nunca pasan de su tope y el cargador no baja de 1 bala", () => {
    for (const d of RECIPE_DEFS) if (d.recipe.tradeoff) expect(d.recipe.tradeoff.value).toBeLessThanOrEqual(TRADEOFF_MAX[d.recipe.tradeoff.kind]);
    // Event Horizon: −90 % de cargador, mínimo 1 bala, en cualquier arma
    for (let s = 0; s < 400; s++) {
      const w = gen.generate(s, undefined, "legendaria");
      const rest = w.effects.filter((e) => e.tier !== "L");
      const base = computeStats({ ...w, effects: rest } as WeaponSpec).cargador;
      const st = computeStats({ ...w, effects: [...rest, fx("rc-l-horizon")] } as WeaponSpec);
      expect(st.cargador).toBeGreaterThanOrEqual(1);
      expect(st.cargador).toBeLessThanOrEqual(Math.max(1, Math.ceil(base * 0.2)));
    }
  });

  it("lotes aleatorios: combinaciones legales y nunca más de 2 contrapartidas por arma (10.000 armas)", () => {
    let withTr = 0;
    for (let s = 0; s < 10000; s++) {
      const w = gen.generate(s * 3 + 11);
      const defs = w.effects.map((e) => effectDef(e.id)!);
      expect(tradeoffCount(defs)).toBeLessThanOrEqual(2);
      if (defs.some((d) => d.recipe?.tradeoff)) withTr++;
    }
    expect(withTr).toBeGreaterThan(300); // las contrapartidas salen de verdad
  });

  it("textos en español y en inglés para todas las recetas (nombre, bonus y coste), sin claves sin traducir", () => {
    for (const lang of ["es", "en"] as const) {
      setLang(lang);
      for (const d of RECIPE_DEFS) {
        const e = fx(d.id) as never;
        for (const txt of [effectName(e), effectDesc(e), effectCost(e)]) { expect(txt, d.id).not.toMatch(/rc\.|fx\./); expect(txt, d.id).not.toMatch(/\{\w+\}/); }
        expect(effectName(e).length).toBeGreaterThan(2);
        if (d.recipe.tradeoff) expect(effectCost(e).length).toBeGreaterThan(3);
      }
    }
    setLang("es");
  });

  it("intérprete: bonus con condición, bonus tras una baja, cada N disparos, atracción con enfriamiento, racimo y furia", () => {
    const aim = runner(["rc-dmg-aiming-x"]);
    expect(shot(aim, { aiming: true }).dmg).toBeCloseTo(1 + effectDef("rc-dmg-aiming-x")!.recipe!.value / 100);
    expect(shot(aim, { aiming: false }).dmg).toBe(1);
    const k = runner(["rc-rate-afterkill"]);
    expect(k.rateMult()).toBe(1);
    k.kill({ target: "a", point: 0, baseDmg: 30, mag: 30 });
    expect(k.rateMult()).toBeGreaterThan(1);
    k.tick(5, { aiming: false, firing: false, sprinting: false });
    expect(k.rateMult()).toBe(1);
    const nth = runner(["rc-f-tongue"]);
    let blasts = 0;
    for (let i = 1; i <= 10; i++) { shot(nth); if (nth.afterShot({ shotCount: i, firstHit: 0, echo: false, baseDmg: 30, hitAny: true, firstTarget: "a" }).some((a) => a.type === "explode")) blasts++; }
    expect(blasts).toBe(2);
    const hz = runner(["rc-l-horizon"]);
    expect(hz.afterHit({ target: "a", point: 0, dmg: 30, crit: false, baseDmg: 30, now: 0 }).some((a) => a.type === "pull")).toBe(true);
    expect(hz.afterHit({ target: "a", point: 0, dmg: 30, crit: false, baseDmg: 30, now: 0 }).some((a) => a.type === "pull")).toBe(false); // enfriamiento
    const hail = runner(["rc-l-hailstorm"]);
    expect(hail.ammoPerShot()).toBe(3); expect(shot(hail).pellets).toBe(3);
    const rage = runner(["rc-l-rage"]);
    rage.kill({ target: "a", point: 0, baseDmg: 30, mag: 30 });
    expect(rage.autoFire()).toBe(true); expect(rage.ammoPerShot()).toBe(0);
    rage.tick(6, { aiming: false, firing: true, sprinting: false });
    expect(rage.autoFire()).toBe(false);
    expect(rage.reloadMult()).toBeGreaterThanOrEqual(1.9); // la resaca: recarga muy lenta
  });

  it("estados de control: solo la atracción aprobada (un legendario); el resto listado aparte y sin implementar", () => {
    const pulls = RECIPE_DEFS.filter((d) => d.recipe.action === "pull");
    expect(pulls.map((d) => d.id)).toEqual(["rc-l-horizon"]);
    expect(CONTROL_STATES.pending.length).toBeGreaterThan(3);
    for (const d of RECIPE_DEFS) expect(["stat", "buff", "explode", "chain", "ignite", "shards", "strike", "pellets", "pull", "fury"]).toContain(d.recipe.action);
  });

  it("sin duplicados: ids únicos y ninguna receta repite disparador, condición, acción y estadística", () => {
    const ids = EFFECT_DEFS.map((e) => e.id); expect(new Set(ids).size).toBe(ids.length);
    const sig = RECIPE_DEFS.filter((d) => !d.recipe.risky).map((d) => `${d.tier}|${d.recipe.trigger}|${d.recipe.cond}|${d.recipe.action}|${d.recipe.stat}|${d.element ?? ""}|${d.recipe.n ?? ""}`);
    expect(sig.filter((x, i) => sig.indexOf(x) !== i)).toEqual([]);
  });
});
