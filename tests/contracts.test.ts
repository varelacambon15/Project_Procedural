import { describe, expect, it } from "vitest";
import { applyEvent, claimAll, periodKeys, refreshContracts } from "../src/game/contracts";

describe("contratos", () => {
  it("3 diarios y 2 semanales, iguales para la misma fecha y nuevos al cambiar de día", () => {
    const a = refreshContracts(null, new Date(2026, 10, 16, 10)), b = refreshContracts(null, new Date(2026, 10, 16, 22));
    expect(a.list.filter((c) => c.period === "day").length).toBe(3);
    expect(a.list.filter((c) => c.period === "week").length).toBe(2);
    expect(b.list.map((c) => c.id)).toEqual(a.list.map((c) => c.id));
    const next = refreshContracts(a, new Date(2026, 10, 17, 9));
    expect(next.list.filter((c) => c.period === "day")[0].id).not.toBe(a.list[0].id);
    expect(next.list.filter((c) => c.period === "week").map((c) => c.id)).toEqual(a.list.filter((c) => c.period === "week").map((c) => c.id));
  });
  it("la semana empieza en lunes", () => {
    expect(periodKeys(new Date(2026, 10, 15)).week).toBe("2026-11-09"); // domingo → lunes anterior
    expect(periodKeys(new Date(2026, 10, 16)).week).toBe("2026-11-16");
  });
  it("las bajas avanzan solo los contratos que cumplen, y se cobran una vez", () => {
    const s = refreshContracts(null, new Date(2026, 10, 16));
    const c = s.list[0]; c.kind = "kills"; c.weapon = "shotgun"; c.goal = 2;
    applyEvent(s, { type: "kill", weapon: "rifle", head: false, dist: 10, boss: false });
    expect(c.progress).toBe(0);
    applyEvent(s, { type: "kill", weapon: "shotgun", head: false, dist: 10, boss: false });
    const done = applyEvent(s, { type: "kill", weapon: "shotgun", head: true, dist: 10, boss: false });
    expect(done).toContain(c);
    expect(claimAll(s)).toBeGreaterThanOrEqual(c.reward);
    expect(claimAll(s)).toBe(0);
  });
});
