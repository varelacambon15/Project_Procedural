// Migración de la reclasificación de equipamiento a granadas (encargo 25).
import { describe, expect, it } from "vitest";
import { SAVE_VERSION, parseSave } from "../src/game/save";
import { GADGET_GRENADE_KINDS, GRENADE_KIND_LIST } from "../src/game/grenades";
import { GADGET_KIND_LIST } from "../src/game/gadgets";

describe("reclasificación de equipamiento a granadas", () => {
  it("migra una partida antigua: la mina rara pasa a granadas y la torreta sigue en equipamiento", () => {
    const old = {
      version: 2, savedAt: "", name: "Vieja", playSeconds: 10, credits: 0,
      weapons: [], active: 0, bank: [], shop: { spent: 0, history: [] }, settings: {}, lang: "es", pixelLevel: 64,
      grenades: [], grenadeActive: -1,
      gadgets: [
        { uid: 1, kind: "turret", rarity: "comun", seed: 11, power: 26, duration: 12, radius: 18, charges: 1, recharge: 22 },
        { uid: 2, kind: "mine", rarity: "rara", seed: 22, power: 500, duration: 30, radius: 3.5, charges: 2, recharge: 14 },
      ],
      gadgetActive: 1,
    };
    const r = parseSave(JSON.stringify(old));
    expect(r.ok).toBe(true); if (!r.ok) return;
    expect(r.data.version).toBe(SAVE_VERSION);
    expect(r.data.gadgets?.map((g) => g.kind)).toEqual(["turret"]);
    expect(r.data.grenades?.map((g) => g.kind)).toEqual(["mine"]);
    const mine = r.data.grenades![0];
    expect(mine.rarity).toBe("rara");
    expect(mine.seed).toBe(22);
    expect(mine.charges).toBe(2);
    expect(mine.damage).toBe(500);
    expect(mine.uid).toBeGreaterThan(2);
    expect(r.data.grenadeActive).toBe(0);
    expect(r.data.gadgetActive).toBe(-1);
  });

  it("el botín elige entre 11 granadas y el equipamiento generable son 15 tipos", () => {
    expect(GRENADE_KIND_LIST).toHaveLength(11);
    expect(GADGET_KIND_LIST).toHaveLength(15);
    for (const k of GADGET_GRENADE_KINDS) {
      expect(GRENADE_KIND_LIST).toContain(k);
      expect(GADGET_KIND_LIST).not.toContain(k);
    }
  });
});
