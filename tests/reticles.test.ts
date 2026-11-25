// Catálogo de retículas: cada forma es un SVG válido y reticleFor() resuelve ópticas, procedimentales y el respaldo por mira.
import { describe, expect, it } from "vitest";
import { RETICLES, RETICLE_IDS, reticleFor } from "../src/game/reticles";

describe("catálogo de retículas", () => {
  it("cada id del catálogo existe y es un SVG válido", () => {
    for (const id of RETICLE_IDS) {
      const svg = RETICLES[id];
      expect(svg, id).toBeTypeOf("string");
      expect(svg.startsWith("<"), id).toBe(true);
      expect(svg.includes('viewBox="0 0 100 100"'), id).toBe(true);
      expect(svg.trimEnd().endsWith("</svg>"), id).toBe(true);
    }
  });

  it("el catálogo no tiene formas fuera de la lista", () => {
    expect(Object.keys(RETICLES).sort()).toEqual([...RETICLE_IDS].sort());
  });

  it("todas las formas usan el rojo del punto rojo", () => {
    for (const id of RETICLE_IDS) expect(RETICLES[id], id).toContain("#ff3b2a");
  });
});

describe("reticleFor: ópticas del kit", () => {
  const kit: [string, string][] = [
    ["k-att-reddot-east", "dot"],
    ["k-att-reddot-west", "dot"],
    ["k-att-reflex-east", "dot"],
    ["k-att-reflex-west", "dot"],
    ["k-att-holographic-east", "ring-dot"],
    ["k-att-holographic-west", "ring-dot"],
    ["k-att-magnified-east", "chevron"],
    ["k-att-magnified-west", "chevron"],
    ["k-att-scope-east", "mildot"],
    ["k-att-scope-west", "mildot"],
  ];

  it("cubre las 10 ópticas con retícula propia", () => {
    expect(kit).toHaveLength(10);
    for (const [optic, id] of kit) expect(reticleFor(optic, "holo"), optic).toBe(id);
  });

  it("el tipo de mira no altera la forma si la óptica ya la define", () => {
    expect(reticleFor("k-att-scope-east", "dot")).toBe("mildot");
    expect(reticleFor("k-att-reddot-east", "scope")).toBe("dot");
  });
});

describe("reticleFor: ópticas procedurales", () => {
  it("reddot, holo y visores sin modelo", () => {
    expect(reticleFor("acc:reddot", "dot")).toBe("dot");
    expect(reticleFor("acc:holo", "holo")).toBe("ring-dot");
    expect(reticleFor("acc:scope2", "holo")).toBe("cross");
    expect(reticleFor("acc:scope6", "scope")).toBe("cross");
  });
});

describe("reticleFor: respaldo por tipo de mira", () => {
  it("sin óptica usa el tipo de mira", () => {
    expect(reticleFor(null, "dot")).toBe("dot");
    expect(reticleFor(null, "holo")).toBe("ring-dot");
    expect(reticleFor(null, "scope")).toBe("cross");
  });

  it("una óptica sin forma propia cae al tipo de mira", () => {
    expect(reticleFor("k-optic-rear-rail-01", "holo")).toBe("ring-dot");
    expect(reticleFor("k-optic-rear-rail-02", "dot")).toBe("dot");
    expect(reticleFor("q-acc-scope-1", "scope")).toBe("cross");
  });

  it("las miras de hierro no dibujan retícula", () => {
    expect(reticleFor(null, "irons")).toBe("");
    expect(reticleFor(null, "iron")).toBe("");
    expect(reticleFor("k-ironsight-rear-rail-01", "irons")).toBe("");
  });
});
