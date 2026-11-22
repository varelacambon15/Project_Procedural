// Auditoría 22b: puertas de compatibilidad puras (sin escena, sin GPU).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { JOINT_RANGE, MAG_MAX_H, WeaponGenerator, jointOk, magScaleCap, partAllowed } from "../src/weapons/generator";
import type { Manifest } from "../src/weapons/types";

const manifest = JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest;

const entry = (id: string, front: number, rear = front, grip = front) => ({
  id,
  pack: "test",
  type: "rifle",
  parts: [],
  sockets: {},
  bounds: { min: [-0.4, -0.08, -0.02], max: [0.4, 0.08, 0.02] },
  triangles: 0,
  joints: {
    front: { pos: [0.1, 0, 0], size: [front, 0] },
    frontFace: { pos: [0.1, 0, 0], size: [front, 0] },
    rear: { pos: [-0.2, 0, 0], size: [rear, 0] },
    stockFace: { pos: [-0.2, 0, 0], size: [rear, 0] },
    grip: { pos: [-0.05, 0, 0], size: [grip, 0] },
    gripFace: { pos: [-0.05, 0, 0], size: [grip, 0] },
  },
} as any);

describe("puertas de compatibilidad por sección de unión", () => {
  it("el rango del guardamanos es más estrecho que el de la culata", () => {
    expect(JOINT_RANGE.front[1] - JOINT_RANGE.front[0]).toBeLessThan(JOINT_RANGE.rear[1] - JOINT_RANGE.rear[0]);
    expect(JOINT_RANGE.front[0]).toBeGreaterThan(0.7);
  });

  it("acepta secciones parecidas y rechaza un frente demasiado pequeño o grande", () => {
    const recv = entry("recv", 0.08);
    expect(jointOk(recv, entry("ok", 0.09), "front")).toBe(true);   // 0,89
    expect(jointOk(recv, entry("edge", 0.1), "front")).toBe(true);  // 0,80 (en el borde)
    expect(jointOk(recv, entry("small", 0.12), "front")).toBe(false); // 0,67 (w-xm8 sobre w-scarh)
    expect(jointOk(recv, entry("big", 0.055), "front")).toBe(false); // 1,45
  });

  it("la pieza propia siempre encaja", () => {
    const own = entry("recv", 0.08);
    expect(jointOk(own, own, "rear")).toBe(true);
    expect(jointOk(own, own, "front")).toBe(true);
  });
});

describe("donantes retirados", () => {
  it("solo se omiten las piezas problemáticas, no el arma entera", () => {
    expect(partAllowed("x-shotgun-1", "grip")).toBe(false); // guardamonte doble
    expect(partAllowed("x-shotgun-1", "front")).toBe(true);
    expect(partAllowed("x-subfusil-9", "front")).toBe(false); // bloques sueltos
    expect(partAllowed("x-subfusil-2", "stock")).toBe(false);
    expect(partAllowed("x-subfusil-5", "front")).toBe(false);
    expect(partAllowed("x-subfusil-4", "front")).toBe(true);
  });

  it("las bases irrecuperables no salen en el sorteo del subfusil", () => {
    const gen = new WeaponGenerator(manifest);
    const ids = gen.byType.get("smg")!.map((w) => w.id);
    for (const id of ["q-submachinegun-3", "p-submachine-gun-3", "x-subfusil-9", "x-smg-w"]) expect(ids).not.toContain(id);
    // ...y el tipo no se queda sin variedad (el filtro previo ya dejaba 27; se retira 1 = 3,7 %)
    expect(ids.length).toBeGreaterThan(20);
  });
});

describe("pistolas del kit", () => {
  const gen = new WeaponGenerator(manifest);
  it("siguen saliendo y ninguna es una copia de su base", () => {
    const kit = Array.from({ length: 120 }, (_, s) => gen.generate(s, "pistol")).filter((w) => w.layout === "kit");
    expect(kit.length).toBeGreaterThan(10);
    for (const w of kit) expect(w.lineage!.similarity).toBeLessThanOrEqual(0.92);
  });
});

describe("tope de alto del cargador (solo visual)", () => {
  it("recorta la escala cuando el cargador pasaría del máximo del tipo", () => {
    expect(MAG_MAX_H.pistol).toBe(0.155);
    expect(magScaleCap("pistol", 0.22, 1.18)).toBeCloseTo(0.155 / 0.22, 6);
    expect(magScaleCap("pistol", 0.1, 1.18)).toBe(1.18); // cabe holgado: no se toca
    expect(magScaleCap("smg", 0.25, 1.3)).toBe(1.3);      // sin tope: no se toca
    expect(magScaleCap("pistol", 0, 1.2)).toBe(1.2);      // sin medida: no se toca
  });
});
