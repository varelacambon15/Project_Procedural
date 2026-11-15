import { describe, expect, it } from "vitest";
import { GRENADE_RARITY, GrenadePouch, falloff, makeGrenade } from "../src/game/grenades";

describe("granadas", () => {
  it("misma semilla, misma granada; mejor rareza, mejores números", () => {
    const a = makeGrenade(42, "frag", "comun"), b = makeGrenade(42, "frag", "comun"), l = makeGrenade(42, "frag", "legendaria");
    expect({ ...a, uid: 0 }).toEqual({ ...b, uid: 0 });
    expect(l.damage).toBeGreaterThan(a.damage); expect(l.charges).toBeGreaterThan(a.charges); expect(l.recharge).toBeLessThan(a.recharge);
    expect(GRENADE_RARITY.legendaria.price).toBeGreaterThan(GRENADE_RARITY.comun.price);
  });
  it("el daño cae con la distancia y es 0 fuera del radio", () => {
    const g = { damage: 200, radius: 6 };
    expect(falloff(g, 0)).toBe(200); expect(falloff(g, 5)).toBeLessThan(200); expect(falloff(g, 6.1)).toBe(0);
  });
  it("sin granada no se lanza nada; las cargas se gastan y se recargan con el tiempo", () => {
    const p = new GrenadePouch(null); expect(p.use()).toBe(false);
    const g = makeGrenade(1, "shock", "comun"); p.equip(g); p.charges = g.charges;
    for (let i = 0; i < g.charges; i++) expect(p.use()).toBe(true);
    expect(p.use()).toBe(false);
    p.update(g.recharge + 0.01); expect(p.charges).toBe(1);
  });
});
