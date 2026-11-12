// Agarres y recargas según el arma (prompt 05-E): perfil válido, guardado, cambios en el taller, calibres de revólver
// y manos ancladas sobre el arma.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { WeaponGenerator, computeStats, powerScore } from "../src/weapons/generator";
import { WeaponAssembler } from "../src/weapons/assembler";
import { gripOptions, gripValid } from "../src/weapons/grip";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const many = Array.from({ length: 1500 }, (_, s) => gen.generate(s * 5 + 1));

describe("agarres (05-E)", () => {
  it("toda arma generada tiene un perfil de agarre válido y compatible con sus piezas", () => {
    for (const w of many) { expect(w.hold).toBeTruthy(); expect(gripValid(w, w.hold)).toBe(true); }
    // Variedad: en pistolas salen varias variantes
    const v = new Set(many.filter((w) => w.type === "pistol").map((w) => w.hold!.variant));
    for (const k of ["one", "two", "switch"]) expect(v).toContain(k);
  });

  it("el agarre se guarda y se carga igual (y no cambia al recalcular)", () => {
    for (const w of many.slice(0, 200)) {
      const back = JSON.parse(JSON.stringify(w)) as WeaponSpec;
      gen.refresh(back);
      expect(back.hold).toEqual(w.hold);
    }
  });

  it("en el taller: con empuñadura delantera se apoya en ella; al quitarla se reasigna otra compatible", () => {
    const w = Array.from({ length: 400 }, (_, s) => gen.generatePistolAt(s, "service", "modern", 0.85, "rara")).find((x) => !x.tweaks.pstock && (!x.tweaks.pistol!.frame.vgrip || x.tweaks.pistol!.frame.vgrip === "none"))!;
    w.tweaks.pistol!.frame.vgrip = "vertical"; gen.refresh(w);
    expect(w.hold!.variant).toBe("vgrip"); expect(w.hold!.hip).toBe("vgrip");
    w.tweaks.pistol!.frame.vgrip = "none"; gen.refresh(w);
    expect(w.hold!.variant).not.toBe("vgrip"); expect(gripValid(w, w.hold)).toBe(true);
    // Culata de hombro: postura al hombro con dos manos
    w.tweaks.pstock = { kind: "skeleton", at: [0, -0.01], h: 0.03, w: 0.02, len: 0.15, drop: 0.01 }; gen.refresh(w);
    expect(w.hold!.stance).toBe("shoulder"); expect(w.hold!.ads).not.toBe("none");
  });

  it("los revólveres pesados y mágnum nunca van a una mano; los ligeros prefieren una", () => {
    const revs = Array.from({ length: 600 }, (_, s) => gen.generate(s * 3 + 2, "revolver")).filter((w) => w.tweaks.pistol?.cyl);
    for (const w of revs) {
      const cal = w.tweaks.pistol!.cyl!.cal;
      if (cal === "heavy" || cal === "magnum") expect(w.hold!.variant).not.toBe("one");
      if (cal === "light" && !w.tweaks.pstock && w.hold!.variant !== "vgrip") expect(gripOptions(w)[0].variant).toBe("one");
    }
  });

  it("calibres de revólver: más daño = menos cadencia; el ajuste del calibre no cambia el poder base (±5 %)", () => {
    const by: Record<string, { dano: number; cad: number; pow: number; n: number }> = {};
    for (let s = 0; s < 3000; s++) {
      const w = gen.generate(s, "revolver", "comun"); const cal = w.tweaks.pistol?.cyl?.cal; if (!cal) continue;
      const b = (by[cal] ??= { dano: 0, cad: 0, pow: 0, n: 0 }); b.dano += w.stats.dano; b.cad += w.stats.cadencia; b.pow += powerScore(w.stats, "revolver"); b.n++;
    }
    const avg = (c: string, k: "dano" | "cad" | "pow") => by[c][k] / by[c].n;
    expect(avg("light", "dano")).toBeLessThan(avg("medium", "dano"));
    expect(avg("medium", "dano")).toBeLessThan(avg("heavy", "dano"));
    expect(avg("heavy", "dano")).toBeLessThan(avg("magnum", "dano"));
    expect(avg("light", "cad")).toBeGreaterThan(avg("medium", "cad"));
    expect(avg("magnum", "cad")).toBeLessThan(avg("medium", "cad"));
    // Lo que añade el calibre por sí solo (sobre su variante, que es balance base) casi no cambia el poder: ±5 %
    for (let s = 0; s < 600; s++) {
      const w = gen.generate(s * 3 + 1, "revolver", "comun"); const cyl = w.tweaks.pistol?.cyl; if (!cyl || cyl.cal === "medium") continue;
      const p1 = powerScore(computeStats(w), "revolver");
      const plain = JSON.parse(JSON.stringify(w)) as WeaponSpec; plain.tweaks.pistol!.cyl!.cal = "medium";
      const p0 = powerScore(computeStats(plain), "revolver");
      expect(Math.abs(p1 / p0 - 1), cyl.cal).toBeLessThan(0.05);
    }
  });

  it("manos ancladas: el soporte de cada agarre cae sobre el arma (pistolas y revólveres generados)", async () => {
    const asm = new WeaponAssembler(gen, "");
    let checked = 0;
    for (let s = 0; s < 300 && checked < 30; s++) {
      const w = gen.generate(s * 7 + 1, s % 2 ? "revolver" : "pistol", "comun");
      if (w.layout !== "modular-pistol" || w.tweaks.device) continue;
      const a = await asm.assemble(w);
      const box = new THREE.Box3().setFromObject(a.group).expandByScalar(0.015);
      for (const sup of [w.hold!.hip, w.hold!.ads]) {
        if (sup === "none") continue;
        const p = a.handles.anchors[sup] ?? a.handles.anchors.grip;
        expect(p, `${w.hold!.variant} ${sup}`).toBeTruthy();
        expect(box.containsPoint(p!), `${w.tweaks.pistol!.arch} ${sup}`).toBe(true);
      }
      expect(box.containsPoint(a.handles.grip)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(15);
  });
});
