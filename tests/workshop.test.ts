import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { fits, scrap, slotsOf, swap, newPart } from "../src/weapons/workshop";
import type { Manifest } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);

describe("banco de trabajo", () => {
  it("cambiar el cargador recalcula las estadísticas y devuelve el viejo a la caja", () => {
    const w = Array.from({ length: 200 }, (_, s) => gen.generate(s, "rifle")).find((x) => slotsOf(gen, x).includes("magazine"))!;
    const old = w.parts.find((p) => p.role === "magazine")!.from;
    const donor = gen.byType.get("rifle")!.find((a) => a.id !== old && a.sockets.magazine)!;
    const before = w.stats.cargador;
    const removed = swap(gen, w, "magazine", newPart("magazine", donor.id));
    expect(removed?.from).toBe(old);
    expect(w.parts.find((p) => p.role === "magazine")!.from).toBe(donor.id);
    expect(Number.isFinite(w.stats.cargador)).toBe(true);
    expect(typeof before).toBe("number");
  });

  it("un cargador de subfusil no encaja en un fusil", () => {
    const w = gen.generate(3, "rifle");
    const smg = gen.byType.get("smg")!.find((a) => a.sockets.magazine)!;
    expect(fits(gen, w, "magazine", newPart("magazine", smg.id))).toBe(false);
  });

  it("quitar el silenciador cambia el nombre técnico", () => {
    const w = Array.from({ length: 400 }, (_, s) => gen.generate(s)).find((x) => x.muzzle && x.rarity.id !== "legendaria")!;
    expect(w.name).toContain("SD");
    swap(gen, w, "muzzle", null);
    expect(w.name).not.toContain("SD");
  });

  it("desguazar devuelve las piezas reutilizables y chatarra", () => {
    const w = gen.generate(42, "pistol");
    const r = scrap(w);
    expect(r.scrap).toBeGreaterThan(0);
    for (const p of r.parts) expect(gen.byId.has(p.from)).toBe(true);
  });
});
