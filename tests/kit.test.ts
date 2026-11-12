import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { kitPlacements, KIT_ROLE } from "../src/weapons/kit";
import { fits, newPart, slotsOf, swap } from "../src/weapons/workshop";
import type { Manifest } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const kitGuns = (type: "rifle" | "pistol" | "shotgun", n = 300) => Array.from({ length: n }, (_, s) => gen.generate(s, type)).filter((w) => w.layout === "kit");

describe("kit modular por sockets", () => {
  it("sale en fusiles, pistolas y escopetas, y todas sus piezas se colocan", () => {
    for (const type of ["rifle", "pistol", "shotgun"] as const) {
      const guns = kitGuns(type);
      expect(guns.length).toBeGreaterThan(40);
      for (const w of guns) {
        const { placements, muzzle } = kitPlacements(gen.kit, w);
        for (const p of w.parts) expect(placements.some((pl) => pl.part.id === p.from)).toBe(true);
        // Mismo calibre o universal
        const cal = gen.kit.caliberOf(w);
        for (const pl of placements) expect([cal, "any"]).toContain(pl.part.caliber);
        expect(muzzle).not.toBeNull();
        if (!w.optic && type !== "pistol") expect(placements.some((pl) => pl.role === "sight")).toBe(true);
        if (w.optic) expect(placements.some((pl) => pl.role === "sight")).toBe(false);
      }
    }
  });

  it("muchas combinaciones distintas", () => {
    const keys = new Set(kitGuns("rifle", 600).map((w) => w.parts.map((p) => p.from).join("|")));
    expect(keys.size).toBeGreaterThan(100);
  });

  it("el alza delantera queda por delante del guardamanos", () => {
    for (const w of kitGuns("rifle")) {
      const { placements } = kitPlacements(gen.kit, w);
      const hg = placements.find((p) => p.role === "front")!;
      const fs = placements.find((p) => p.role === "sight" && p.part.id.includes("front"));
      if (fs) expect(fs.pos[0]).toBeGreaterThan(hg.pos[0] + hg.part.bounds.max[0] * hg.stretch);
    }
  });

  it("en el banco solo encajan piezas del mismo calibre", () => {
    const w = kitGuns("rifle")[0];
    expect(slotsOf(gen, w)).toEqual(expect.arrayContaining(["barrel", "stock", "grip", "magazine"]));
    expect(fits(gen, w, "magazine", newPart("magazine", "k-magazine-9-01"))).toBe(false);
    const other = ["k-magazine-556-01", "k-magazine-556-02"].find((m) => !w.parts.some((p) => p.from === m))!;
    const old = swap(gen, w, "magazine", newPart("magazine", other));
    expect(old?.from.startsWith("k-magazine-556")).toBe(true);
    expect(w.stats.cargador).toBeGreaterThan(5);
    expect(Object.values(KIT_ROLE)).toContain("magazine");
  });
});
