import { describe, expect, it } from "vitest";
import { CELL, doorsOf, generateRaid } from "../src/game/raidgen";

describe("incursión: generador de mapas", () => {
  it("es determinista por semilla y respeta el número de salas", () => {
    const a = generateRaid(1234, { rooms: 6, difficulty: 0 }), b = generateRaid(1234, { rooms: 6, difficulty: 0 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    for (const n of [4, 6, 8]) {
      const m = generateRaid(99 + n, { rooms: n, difficulty: 1 });
      const main = m.rooms.filter((r) => r.kind !== "loot");
      expect(main).toHaveLength(n);
      expect(main[0].kind).toBe("start"); expect(main[n - 1].kind).toBe("boss");
    }
  });
  it("salas sin solaparse, unidas por pasillos rectos y con puertas a juego", () => {
    for (let seed = 1; seed < 60; seed++) {
      const m = generateRaid(seed, { rooms: 8, difficulty: 2 });
      const cells = new Set(m.rooms.map((r) => r.cell.join(",")));
      expect(cells.size).toBe(m.rooms.length);
      for (const r of m.rooms) { expect(r.w).toBeLessThan(CELL - 4); expect(r.d).toBeLessThan(CELL - 4); }
      for (const c of m.corridors) {
        const a = m.rooms[c.a], b = m.rooms[c.b];
        expect(Math.abs(a.cell[0] - b.cell[0]) + Math.abs(a.cell[1] - b.cell[1])).toBe(1);
      }
      const doors = m.rooms.reduce((n, r) => n + doorsOf(m, r).length, 0);
      expect(doors).toBe(m.corridors.length * 2);
      const boss = m.rooms.find((r) => r.kind === "boss")!;
      expect(boss.enemies[0]).toBe("warden");
      for (const r of m.rooms.filter((x) => x.kind === "fight")) expect(r.enemies.length).toBeGreaterThanOrEqual(5);
    }
  });
});

import { generateArena, mutateArena } from "../src/game/arenagen";
describe("arena de oleadas", () => {
  const B = { x0: -30, x1: 30, z0: 29, z1: 102 };
  it("coberturas dentro, sin solaparse y con el pasillo de entrada libre", () => {
    for (let s = 1; s < 30; s++) {
      const a = generateArena(s, B);
      expect(a.covers.length).toBeGreaterThan(12);
      for (const c of a.covers) {
        expect(c.x).toBeGreaterThan(B.x0); expect(c.x).toBeLessThan(B.x1); expect(c.z).toBeGreaterThan(B.z0 + 8); expect(c.z).toBeLessThan(B.z1 - 13);
        expect(Math.abs(c.x) < 3 && c.z < B.z0 + 14).toBe(false);
      }
    }
  });
  it("tras el jefe cambia un poco: conserva buena parte y cambia el color", () => {
    const a = generateArena(77, B), m = mutateArena(a, B);
    const kept = m.covers.filter((c) => a.covers.some((o) => o.id === c.id)).length;
    expect(kept).toBeGreaterThan(a.covers.length * 0.4); expect(kept).toBeLessThan(a.covers.length);
    expect(m.accent).not.toBe(a.accent); expect(m.stage).toBe(1);
  });
});
