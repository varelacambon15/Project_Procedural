import { describe, expect, it } from "vitest";
import { GUARDIAN_EVERY, hackChoices, hackEnemies, nodeData } from "../src/game/hackgen";

describe("modo Hack: red de nodos", () => {
  it("guardián cada 4 niveles; si no, 2-3 nodos distintos con al menos un combate", () => {
    for (let s = 1; s < 40; s++) for (let d = 1; d <= 12; d++) {
      const c = hackChoices(s, d);
      if (d % GUARDIAN_EVERY === 0) { expect(c.map((x) => x.kind)).toEqual(["guardian"]); continue; }
      expect(c.length).toBeGreaterThanOrEqual(2); expect(c.length).toBeLessThanOrEqual(3);
      expect(c.some((x) => x.kind === "fight" || x.kind === "elite")).toBe(true);
      expect(new Set(c.map((x) => x.kind)).size).toBe(c.length);
    }
  });
  it("es determinista y cuanto más hondo, más enemigos y más datos", () => {
    expect(hackChoices(7, 3)).toEqual(hackChoices(7, 3));
    const avg = (d: number) => { let n = 0; for (let s = 0; s < 50; s++) n += hackEnemies({ kind: "fight", depth: d, seed: s }).length; return n / 50; };
    expect(avg(9)).toBeGreaterThan(avg(1));
    expect(nodeData({ kind: "fight", depth: 8, seed: 1 })).toBeGreaterThan(nodeData({ kind: "fight", depth: 1, seed: 1 }));
    expect(hackEnemies({ kind: "guardian", depth: 4, seed: 1 })[0]).toBe("warden");
    expect(hackEnemies({ kind: "loot", depth: 2, seed: 1 })).toEqual([]);
  });
});
