// Legendarias con contador (22/11/2026): cada N bajas o cada N impactos. Pruebas de lógica pura del intérprete.
import { describe, expect, it } from "vitest";
import { EffectRunner, effectDef } from "../src/weapons/effects";
import type { WeaponSpec } from "../src/weapons/types";

const fx = (id: string) => { const d = effectDef(id)!; return { id, tier: d.tier, family: d.family, element: d.element, icon: d.icon, color: d.color }; };
const runner = (ids: string[]) => new EffectRunner<string, number>({ effects: ids.map(fx) } as unknown as WeaponSpec);
const kill = (r: EffectRunner<string, number>) => r.kill({ target: "a", point: 0, baseDmg: 30, mag: 10 });
const hit = (r: EffectRunner<string, number>) => r.afterHit({ target: "a", point: 0, dmg: 30, crit: false, baseDmg: 30, now: 0 });

describe("legendarias con contador", () => {
  it("existen y son de nivel L con su condición", () => {
    for (const [id, cond] of [["rc-l-orbital", "killnth"], ["rc-l-symphony", "killnth"], ["rc-l-resonance", "hitnth"]] as const) {
      const d = effectDef(id)!; expect(d.tier).toBe("L"); expect(d.recipe?.cond).toBe(cond);
    }
  });

  it("Ataque orbital: un ataque cada 25 bajas, ni antes ni después", () => {
    const r = runner(["rc-l-orbital"]); const at: number[] = [];
    for (let i = 1; i <= 60; i++) if (kill(r).some((a) => a.type === "strikeAt")) at.push(i);
    expect(at).toEqual([25, 50]);
  });

  it("Sinfonía de plomo: 10 esquirlas cada 5 bajas", () => {
    const r = runner(["rc-l-symphony"]); let bursts = 0;
    for (let i = 1; i <= 20; i++) { const a = kill(r).find((x) => x.type === "shards"); if (a) { bursts++; expect((a as { n: number }).n).toBe(10); } }
    expect(bursts).toBe(4);
  });

  it("Resonancia: una onda de choque cada 8 impactos", () => {
    const r = runner(["rc-l-resonance"]); let waves = 0;
    for (let i = 1; i <= 24; i++) if (hit(r).some((a) => a.type === "explode")) waves++;
    expect(waves).toBe(3);
  });

  it("los contadores son independientes por arma", () => {
    const a = runner(["rc-l-symphony"]), b = runner(["rc-l-symphony"]);
    for (let i = 0; i < 4; i++) kill(a);
    expect(kill(b).some((x) => x.type === "shards")).toBe(false); // la 1.ª baja de b no dispara
    expect(kill(a).some((x) => x.type === "shards")).toBe(true);  // la 5.ª de a sí
  });
});
