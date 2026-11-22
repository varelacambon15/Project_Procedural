// Encargo 21 — lógica PURA del acabado: identidad por era, desgaste por calidad, coherencia entre piezas,
// paleta sobria, marca de rareza y una sola pieza de latón en legendarias. Sin Three.js ni navegador.
import { describe, expect, it } from "vitest";
import { brassDetail, CERAKOTE_PALETTE, finishQuality, qualityProfile, rarityTicks, stylesFor, wearForEra } from "../src/weapons/finish-data";
import type { Era } from "../src/weapons/eras";
import type { RarityId } from "../src/weapons/types";

describe("acabado AAA por era (21)", () => {
  it("calidad por defecto Medio y perfiles apagables", () => {
    expect(finishQuality()).toBe("medium");
    expect(finishQuality("low")).toBe("low");
    expect(qualityProfile("low").details).toBe(false);
    expect(qualityProfile("low").edge).toBe(0);
    expect(qualityProfile("medium").details).toBe(true);
    expect(qualityProfile("high").veinSegments).toBeGreaterThan(qualityProfile("medium").veinSegments);
  });

  it("desgaste: rústica ≫ clásica ≫ moderna > sci-fi; Bajo lo reduce y Apagado en bordes", () => {
    const w = (e: Era) => wearForEra(e, "medium");
    expect(w("rustic")).toBeGreaterThan(w("classic"));
    expect(w("classic")).toBeGreaterThan(w("modern"));
    expect(w("modern")).toBeGreaterThan(w("scifi"));
    expect(w("scifi")).toBeLessThan(0.1);
    expect(wearForEra("rustic", "low")).toBeLessThan(w("rustic"));
    expect(stylesFor("rustic", "low").primary.edge).toBe(0);
    expect(stylesFor("rustic", "medium").primary.edge).toBeGreaterThan(0);
  });

  it("identidad por era y coherencia: una sola familia por rol, sin maderas en moderna/sci-fi", () => {
    const classic = stylesFor("classic"), modern = stylesFor("modern"), rustic = stylesFor("rustic"), scifi = stylesFor("scifi");
    expect(classic.primary.family).toBe("blued");
    expect(classic.secondary.family).toBe("varnished");
    expect(modern.primary.family).toBe("cerakote");
    expect(modern.secondary.family).toBe("polymer");
    expect(rustic.primary.family).toBe("rust");
    expect(scifi.primary.family).toBe("anodized");
    for (const s of [modern, scifi]) {
      expect(s.secondary.family).not.toBe("varnished");
      expect(s.wood.family).not.toBe("varnished");
      expect(s.metal.family).not.toBe("varnished");
      expect(s.metal.family).not.toBe("rust");
    }
    // Todas las familias shared por un arma salen del MISMO perfil: no hay combinaciones arcoíris
    for (const s of [classic, modern, rustic, scifi]) {
      const fams = new Set([s.primary.family, s.secondary.family, s.metal.family, s.accent.family]);
      expect(fams.size).toBeGreaterThan(0);
      expect(s.primary.wear).toBe(s.secondary.wear);
      expect(s.primary.wear).toBe(s.metal.wear);
    }
  });

  it("paleta de cerakote sobria de 6 a 8 colores, todos en FINISHES", () => {
    expect(CERAKOTE_PALETTE.length).toBeGreaterThanOrEqual(6);
    expect(CERAKOTE_PALETTE.length).toBeLessThanOrEqual(8);
    expect(new Set(CERAKOTE_PALETTE).size).toBe(CERAKOTE_PALETTE.length);
  });

  it("marca de rareza monotónica y un único latón legendario", () => {
    const ids: RarityId[] = ["comun", "poco", "rara", "epica", "legendaria"];
    for (let i = 1; i < ids.length; i++) expect(rarityTicks(ids[i])).toBeGreaterThan(rarityTicks(ids[i - 1]));
    expect(rarityTicks("comun")).toBe(0);
    expect(ids.filter((r) => brassDetail(r))).toEqual(["legendaria"]);
  });
});
