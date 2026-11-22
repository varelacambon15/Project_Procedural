import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { jointScale, longGunOk, magScaleCap, partAllowed, SNUB_MAX_SIMILARITY } from "../src/weapons/generator";
import { SIMILARITY_RANGE } from "../src/weapons/variation";
import { NO_TWEAKS, type AssetEntry, type Manifest } from "../src/weapons/types";

const manifest: Manifest = JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8"));
const entry = (id: string) => manifest.weapons.find((w) => w.id === id)!;

describe("puertas de compatibilidad por razón de secciones de unión", () => {
  it("una junta al borde de la escala no admite la pieza (frente del XM8 sobre el SCAR-H: 80 vs 186 mm)", () => {
    const recv = entry("w-scarh"), xm8 = entry("w-xm8");
    // La sección de unión del frente queda justo en el límite que antes se admitía (≈0,70) y la pieza escalada
    // desmerece junto al cajón: la puerta nueva la rechaza
    expect(jointScale(recv, xm8, "front")).toBeLessThan(0.78);
    expect(longGunOk(recv, recv, xm8, recv, "rifle", NO_TWEAKS)).toBe(false);
  });

  it("las combinaciones de su misma familia con juntas parecidas siguen pasando", () => {
    const scar = entry("w-scarh");
    expect(jointScale(scar, scar, "front")).toBeGreaterThan(0.95);
    expect(jointScale(scar, scar, "front")).toBeLessThan(1.05);
    expect(longGunOk(scar, scar, scar, scar, "rifle", NO_TWEAKS)).toBe(true);
    const recv = entry("x-subfusil-4"), front = entry("x-subfusil-1");
    expect(jointScale(recv, front, "front")).toBeGreaterThanOrEqual(0.78);
    expect(jointScale(recv, front, "front")).toBeLessThanOrEqual(1.3);
  });

  it("la culata de placa del pmw no encaja en el cajón de su familia (sección de junta 0,74)", () => {
    const recv = entry("p-submachine-gun-4"), donor = entry("p-submachine-gun-2");
    expect(jointScale(recv, donor, "rear")).toBeLessThan(0.75);
  });

  it("una pieza con guardamonte integrado no presta su empuñadura", () => {
    expect(partAllowed("x-shotgun-1", "grip")).toBe(false);
    expect(partAllowed("x-shotgun-1", "stock")).toBe(true);
  });

  it("el tope de cargador recorta los cargadores gigantes de pistolas y deja los de fusil", () => {
    // k-magazine-9-02 mide 208 mm: en una pistola se recorta; en un fusil no se toca
    expect(magScaleCap("pistol", 0.2076, 1)).toBeLessThan(1);
    expect(0.2076 * magScaleCap("pistol", 0.2076, 1)).toBeLessThanOrEqual(0.155 + 1e-9);
    expect(magScaleCap("pistol", 0.2076, 1.19)).toBeLessThan(1);
    expect(magScaleCap("rifle", 0.2076, 1.19)).toBe(1.19);
    // Un cargador normal de pistola (139 mm) solo se recorta si además se estira
    expect(magScaleCap("pistol", 0.1388, 1)).toBe(1);
  });

  it("el margen del revólver recortado está por encima de la banda, pero nunca deja copias", () => {
    expect(SNUB_MAX_SIMILARITY).toBeGreaterThan(SIMILARITY_RANGE[1]);
    expect(SNUB_MAX_SIMILARITY).toBeLessThan(0.955); // (umbral «casi copia» de la auditoría 22a)
  });
});
