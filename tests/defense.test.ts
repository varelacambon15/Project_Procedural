import { describe, expect, it } from "vitest";
import { BUILDS, coreWave, sellValue } from "../src/game/defense";
import { rng } from "../src/game/raidgen";

describe("defensa del núcleo", () => {
  it("20 construibles de las cuatro categorías, con niveles que mejoran", () => {
    expect(BUILDS).toHaveLength(20);
    expect(new Set(BUILDS.map((b) => b.cat))).toEqual(new Set(["turret", "trap", "structure", "support"]));
    for (const b of BUILDS) { expect(b.dmg[2]).toBeGreaterThanOrEqual(b.dmg[0]); expect(b.rate[2]).toBeLessThanOrEqual(b.rate[0]); expect(sellValue(b, 3)).toBeLessThan(b.cost.reduce((a, c) => a + c, 0)); }
  });
  it("las oleadas crecen y cada 5 hay jefe", () => {
    const r = rng(3); expect(coreWave(10, r).length).toBeGreaterThan(coreWave(1, r).length);
    expect(coreWave(5, r)).toContain("warden"); expect(coreWave(4, r)).not.toContain("warden");
  });
});
