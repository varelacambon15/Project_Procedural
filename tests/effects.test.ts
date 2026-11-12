import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { EFFECT_DEFS, EffectRunner, effectDef, effectsCost, legalWith } from "../src/weapons/effects";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const many = (n: number) => Array.from({ length: n }, (_, s) => gen.generate(s * 13 + 7));
const EVENTS = ["onEquip", "onShot", "onHit", "onCrit", "onKill", "onReload", "onReloadEnd", "onADS", "onSprint", "passive"];

describe("efectos como módulos de datos", () => {
  it("cada efecto tiene nivel, familia, eventos válidos y un coste dentro de la banda de su nivel", () => {
    const band = { A: [5, 10], B: [12, 20], L: [20, 30] } as const;
    const ids = new Set<string>();
    for (const e of EFFECT_DEFS) {
      expect(ids.has(e.id)).toBe(false); ids.add(e.id);
      expect(["A", "B", "L"]).toContain(e.tier);
      expect(e.family.length).toBeGreaterThan(0);
      for (const ev of e.events) expect(EVENTS).toContain(ev);
      expect(e.cost).toBeGreaterThanOrEqual(band[e.tier][0]);
      expect(e.cost).toBeLessThanOrEqual(band[e.tier][1]);
      if (e.tier === "L") expect(e.name).toBeTruthy();
      if (e.element) expect(e.tier).not.toBe("A");
    }
    // Primer lote pedido: al menos 8 de nivel A, 6 de B (2 por elemento) y 4 de L
    expect(EFFECT_DEFS.filter((e) => e.tier === "A").length).toBeGreaterThanOrEqual(8);
    expect(EFFECT_DEFS.filter((e) => e.tier === "B").length).toBeGreaterThanOrEqual(6);
    for (const el of ["fuego", "electrico", "explosive"]) expect(EFFECT_DEFS.filter((e) => e.element === el).length).toBeGreaterThanOrEqual(2);
    expect(EFFECT_DEFS.filter((e) => e.tier === "L").length).toBeGreaterThanOrEqual(4);
  });

  it("combinaciones legales: familias distintas, máx. 1 de racha, 1 de multiplicar daño y 1 elemento", () => {
    for (const w of many(3000)) {
      const defs = w.effects.map((e) => effectDef(e.id)!);
      expect(new Set(defs.map((d) => d.family)).size).toBe(defs.length);
      for (const tag of ["streak", "multiply", "element"]) expect(defs.filter((d) => d.tags.includes(tag)).length).toBeLessThanOrEqual(1);
      for (const d of defs) if (d.only) expect(d.only).toContain(w.type);
    }
    // La regla rechaza una segunda racha
    const streak = EFFECT_DEFS.filter((e) => e.tags.includes("streak"));
    expect(legalWith([{ id: streak[0].id }], streak[1], "rifle")).toBe(false);
  });

  it("el coste de los efectos queda en la banda de poder de cada rareza", () => {
    const band: Record<string, [number, number]> = { comun: [0, 0], poco: [0, 0], rara: [5, 10], epica: [17, 30], legendaria: [37, 60] };
    for (const w of many(3000)) {
      const c = effectsCost(w.effects), [lo, hi] = band[w.rarity.id];
      expect(c).toBeGreaterThanOrEqual(lo); expect(c).toBeLessThanOrEqual(hi);
    }
  });

  const runner = (ids: string[], vals: Record<string, number> = {}) => {
    const spec = { effects: ids.map((id) => ({ id, tier: effectDef(id)!.tier, family: effectDef(id)!.family, element: effectDef(id)!.element, icon: "", color: "", value: vals[id] })) } as unknown as WeaponSpec;
    return new EffectRunner<string, number>(spec);
  };
  const shot = (r: EffectRunner<string, number>, o: Partial<Parameters<EffectRunner<string, number>["shot"]>[0]> = {}) => r.shot({ fullMag: false, ammoFrac: 0.6, aiming: false, nearCount: 0, pellets: 1, ...o });

  it("racha: sube con cada baja hasta el tope y se pierde al recargar", () => {
    const r = runner(["tally"]);
    for (let i = 0; i < 6; i++) r.kill({ target: "a", point: 0, baseDmg: 30, mag: 30 });
    expect(shot(r).dmg).toBeCloseTo(1.1);
    r.reloadMult();
    expect(shot(r).dmg).toBeCloseTo(1);
  });

  it("primer golpe y cazagigantes multiplican según el objetivo", () => {
    expect(runner(["instigator"]).hitMult({ full: true, big: false })).toBeCloseTo(1.2);
    expect(runner(["instigator"]).hitMult({ full: false, big: false })).toBe(1);
    expect(runner(["giantslayer"]).hitMult({ full: false, big: true })).toBeCloseTo(1.25);
  });

  it("descarga: recargar tras una baja hace que el siguiente impacto encadene un rayo", () => {
    const r = runner(["voltshot"]);
    r.kill({ target: "a", point: 0, baseDmg: 30, mag: 30 }); r.reloadMult(); r.reloadEnd();
    const acts = r.afterHit({ target: "b", point: 0, dmg: 30, crit: false, baseDmg: 30, now: 0 });
    expect(acts.some((a) => a.type === "chain" && a.n === 3)).toBe(true);
    expect(r.afterHit({ target: "b", point: 0, dmg: 30, crit: false, baseDmg: 30, now: 0 }).some((a) => a.type === "chain" && a.n === 3)).toBe(false);
  });

  it("dos mentes alterna fuego y eléctrico en cada cargador; sobrevelocidad sube la cadencia al mantener el gatillo", () => {
    const a = runner(["alternator"]);
    const e1 = a.element(); a.reloadEnd(); const e2 = a.element();
    expect(new Set([e1, e2])).toEqual(new Set(["fuego", "electrico"]));
    const s = runner(["spinup"]);
    for (let i = 0; i < 30; i++) s.tick(0.1, { aiming: false, firing: true, sprinting: false });
    expect(s.rateMult()).toBeCloseTo(1.8);
    for (let i = 0; i < 30; i++) s.tick(0.1, { aiming: false, firing: false, sprinting: false });
    expect(s.rateMult()).toBe(1);
  });

  it("pulso firme: tras 1,5 s apuntando sin disparar, el siguiente disparo hace más daño (solo uno)", () => {
    const r = runner(["breath"]);
    for (let i = 0; i < 16; i++) r.tick(0.1, { aiming: true, firing: false, sprinting: false });
    expect(shot(r).dmg).toBeCloseTo(1.15);
    expect(shot(r).dmg).toBe(1);
  });
});
