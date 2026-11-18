import { describe, expect, it } from "vitest";
import { ARMOR_PERKS, ARMOR_RARITIES, ARMOR_SLOTS, MAX_REDUCTION, armorTotals, damageTaken, makeArmor } from "../src/game/armor";

describe("armaduras", () => {
  it("cada pieza tiene ranura, reducción y ventajas de su ranura; más rareza, más protección", () => {
    for (const slot of ARMOR_SLOTS) {
      const reds = ARMOR_RARITIES.map((r) => makeArmor(42, slot, r, "standard").reduction);
      for (let i = 1; i < reds.length; i++) expect(reds[i]).toBeGreaterThan(reds[i - 1]);
      const a = makeArmor(7, slot, "legendaria");
      expect(a.perks.length).toBe(2); for (const p of a.perks) expect(ARMOR_PERKS[slot]).toContain(p.id);
    }
  });
  it("la pesada protege más que la ligera y frena un poco", () => {
    const l = makeArmor(3, "torso", "rara", "light"), h = makeArmor(3, "torso", "rara", "heavy");
    expect(h.reduction).toBeGreaterThan(l.reduction); expect(h.slow).toBeGreaterThan(0); expect(l.slow).toBe(0);
  });
  it("las tres piezas se suman con tope y nunca dejan al jugador invulnerable", () => {
    const set = ARMOR_SLOTS.map((s) => makeArmor(9, s, "legendaria", "heavy"));
    const t = armorTotals(set);
    expect(t.reduction).toBeLessThanOrEqual(MAX_REDUCTION);
    for (const k of ["melee", "orb", "explosive", "fire", "shock"] as const) expect(damageTaken(t, k, true)).toBeGreaterThanOrEqual(0.25);
    expect(damageTaken(armorTotals([]))).toBe(1);
  });
});
