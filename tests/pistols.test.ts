// Pistolas y revólveres generados por código (prompts 05-B y 06): familias, rasgos estructurales, culatas, variedad
// del lote, piezas unidas y partidas antiguas.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { STRUCTURAL, designPolys, upgradeDesign, type PistolDesign } from "../src/weapons/pistolgen";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const proc = (type: "pistol" | "revolver", n: number, k = 7) => Array.from({ length: n }, (_, s) => gen.generate(s * k + 3, type)).filter((w) => w.layout === "modular-pistol");
const pistols = proc("pistol", 500), revolvers = proc("revolver", 300);
const all = [...pistols, ...revolvers];

describe("pistolas y revólveres generados", () => {
  it("salen todas las familias, calibres de revólver, cargadores y modos de fuego", () => {
    const fam = new Set(all.map((w) => w.tweaks.pistol!.family));
    for (const f of ["auto", "frontmag", "carbine", "revolver"]) expect(fam).toContain(f);
    const cals = new Set(revolvers.map((w) => w.tweaks.pistol!.cyl!.cal));
    for (const c of ["light", "medium", "heavy", "magnum"]) expect(cals).toContain(c);
    const mags = new Set(pistols.map((w) => w.tweaks.pistol!.mag.kind));
    for (const m of ["flush", "ext", "stick", "curved", "drum", "front"]) expect(mags).toContain(m);
    const modes = new Set(pistols.map((w) => w.fireMode));
    for (const m of ["semi", "auto", "burst"]) expect(modes).toContain(m);
  });

  it("en la banda de parecido con su base (≥ 97 % entre 70 y 90 %, ninguna por encima del 95 %) y con 3+ cambios", () => {
    const inBand = all.filter((w) => w.lineage!.similarity >= 0.7 && w.lineage!.similarity <= 0.9).length;
    expect(inBand / all.length).toBeGreaterThanOrEqual(0.97);
    for (const w of all) { expect(w.lineage!.similarity).toBeLessThanOrEqual(0.95); expect(w.lineage!.changes.length).toBeGreaterThanOrEqual(3); }
  });

  it("las que se alejan por debajo del 80 % cambian al menos 2 rasgos estructurales (no solo largos)", () => {
    const far = all.filter((w) => w.lineage!.similarity < 0.8);
    expect(far.length).toBeGreaterThan(10);
    for (const w of far) expect(w.lineage!.changes.filter((c) => STRUCTURAL.has(c) || c.startsWith("stock-")).length).toBeGreaterThanOrEqual(2);
  });

  it("culata de hombro en ~10–15 % (entre 6 y 20 %)", () => {
    const share = all.filter((w) => w.tweaks.pstock).length / all.length;
    expect(share).toBeGreaterThan(0.06); expect(share).toBeLessThan(0.2);
  });

  it("un lote como el del botín no tiene casi-copias: ≤ 10 % de armas con otra a más del 92 %", () => {
    const lot: WeaponSpec[] = []; let s = 11;
    while (lot.length < 20 && s < 2000) { const w = gen.generateDistinct(s++ * 104729, lot.length % 3 === 2 ? "revolver" : "pistol", lot); if (w.layout === "modular-pistol") lot.push(w); }
    const m = gen.lotMatrix(lot);
    const near = m.filter((row, i) => Math.max(...row.filter((_, j) => j !== i)) > 0.92).length;
    expect(near / lot.length).toBeLessThanOrEqual(0.1);
  });

  it("ninguna pieza flota: cada pieza del perfil toca a otra", () => {
    const bb = (p: [number, number][]) => ({ x0: Math.min(...p.map((q) => q[0])), x1: Math.max(...p.map((q) => q[0])), y0: Math.min(...p.map((q) => q[1])), y1: Math.max(...p.map((q) => q[1])) });
    const E = 0.0015;
    for (const w of all.slice(0, 300)) {
      const polys = designPolys(w.tweaks.pistol!).map((p) => ({ role: p.role, b: bb(p.poly) }));
      for (const [i, p] of polys.entries()) {
        const touches = polys.some((q, j) => j !== i && p.b.x0 <= q.b.x1 + E && q.b.x0 <= p.b.x1 + E && p.b.y0 <= q.b.y1 + E && q.b.y0 <= p.b.y1 + E);
        expect(touches, `${w.tweaks.pistol!.arch} ${p.role}`).toBe(true);
      }
    }
  });

  it("variantes a un parecido fijo para la hoja de decisión (base, ~90, ~80)", () => {
    for (const [arch, era] of [["service", "modern"], ["officer", "classic"], ["rmedium", "classic"], ["carbine", "modern"]] as const) {
      expect(gen.generatePistolAt(5, arch, era, 1).lineage!.similarity).toBe(1);
      for (const t of [0.9, 0.8]) expect(Math.abs(gen.generatePistolAt(5, arch, era, t).lineage!.similarity - t)).toBeLessThan(0.04);
    }
  });

  it("partidas antiguas: un diseño del formato anterior se actualiza y se registra", () => {
    const old = { v: 1, arch: "service", era: "modern", slide: { len: 0.185, h: 0.032, w: 0.025, nose: "bevel", serr: 1, port: true, cuts: 0, top: "iron", fins: false, open: true }, barrel: { ext: 0, d: 0.013, comp: "none", shroud: false }, frame: { dust: 0.78, h: 0.019, rail: true, guard: "square" }, grip: { angle: 0.3, len: 0.105, depth: 0.044, shape: "straight", panels: "polymer", butt: "flat" }, mag: { kind: "flush", len: 0 }, hammer: "none", extra: { cell: false, rivets: false, wrap: false } } as unknown as PistolDesign;
    const d = upgradeDesign(old);
    expect(d.v).toBe(2); expect(d.family).toBe("auto"); expect(d.slide.style).toBe("open");
    expect(designPolys(d).length).toBeGreaterThan(3);
  });
});
