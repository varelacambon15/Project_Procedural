// Desguazar duplicados del banco de accesorios: se conserva uno de cada pieza y rareza y el resto se paga en créditos.
import { describe, expect, it } from "vitest";
import { ACC_SCRAP, newAcc, scrapDuplicates } from "../src/weapons/accbank";

describe("desguazar duplicados", () => {
  it("conserva uno de cada (pieza, rareza) y paga el resto según la rareza", () => {
    const bank = [
      newAcc("optic", "acc:reddot", "comun"), newAcc("optic", "acc:reddot", "comun"), newAcc("optic", "acc:reddot", "comun"),
      newAcc("optic", "acc:reddot", "rara"), // misma pieza, otra rareza: no es duplicado
      newAcc("muzzle", "acc:brake", "epica"), newAcc("muzzle", "acc:brake", "epica"),
    ];
    const r = scrapDuplicates(bank);
    expect(r.removed).toBe(3);
    expect(r.credits).toBe(2 * ACC_SCRAP.comun + ACC_SCRAP.epica);
    expect(r.bank.map((a) => `${a.id}|${a.rarity}`).sort()).toEqual(["acc:brake|epica", "acc:reddot|comun", "acc:reddot|rara"]);
  });

  it("conserva la pieza más antigua y el orden del banco", () => {
    const a = newAcc("optic", "acc:holo", "poco"), b = newAcc("optic", "acc:acog", "poco"), c = newAcc("optic", "acc:holo", "poco");
    const r = scrapDuplicates([c, b, a]); // c es más nuevo que a
    expect(r.bank.map((x) => x.uid)).toEqual([b.uid, a.uid]);
  });

  it("sin duplicados no cambia nada ni paga", () => {
    const bank = [newAcc("optic", "acc:holo", "poco"), newAcc("muzzle", "acc:brake", "poco")];
    const r = scrapDuplicates(bank);
    expect(r.removed).toBe(0); expect(r.credits).toBe(0); expect(r.bank).toEqual(bank);
  });

  it("paga poco: nunca más que vender un arma de la misma rareza (venta 12/25/50/100/200)", () => {
    const sell = { comun: 12, poco: 25, rara: 50, epica: 100, legendaria: 200 } as const;
    for (const k of Object.keys(sell) as (keyof typeof sell)[]) expect(ACC_SCRAP[k]).toBeLessThan(sell[k] / 2);
  });
});
