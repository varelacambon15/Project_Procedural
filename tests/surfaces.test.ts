import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NoRepeat, impactKey, pickNoRepeat, pitchVar, stepKey, surfaceOf, type Surface } from "../src/game/surfaces";

const manifest = JSON.parse(readFileSync(new URL("../assets/sonidos/manifest.json", import.meta.url), "utf8")) as { efectos: Record<string, string[]> };
const ALL: Surface[] = ["carne", "hormigon", "metal", "madera", "cristal", "plastico", "baldosa", "arena", "rejilla"];

describe("sonidos por superficie (tarea 7)", () => {
  it("la etiqueta manda; si no, los rasgos del material", () => {
    expect(surfaceOf({ tag: "rejilla", metalness: 0.1 })).toBe("rejilla");
    expect(surfaceOf({ tag: "nada", metalness: 0.8 })).toBe("metal");
    expect(surfaceOf({ transparent: true, opacity: 0.7 })).toBe("cristal");
    expect(surfaceOf({ metalness: 0.75, roughness: 0.45 })).toBe("metal");
    expect(surfaceOf({ color: 0x8b5a2b, roughness: 0.8, metalness: 0 })).toBe("madera");
    expect(surfaceOf({ color: 0xe8e8e4, roughness: 0.4, metalness: 0 })).toBe("plastico");
    expect(surfaceOf({ color: 0x80868c, roughness: 0.95 })).toBe("hormigon");
    expect(surfaceOf({})).toBe("hormigon");
  });

  it("todas las superficies tienen impacto y paso con muestras en el manifiesto", () => {
    for (const s of ALL) {
      expect(manifest.efectos[impactKey(s)]?.length, impactKey(s)).toBeGreaterThan(0);
      expect(manifest.efectos[stepKey(s)]?.length, stepKey(s)).toBeGreaterThan(0);
    }
    expect(stepKey("rejilla")).toBe("paso_rejilla");
  });

  it("nunca repite la misma muestra dos veces seguidas (si hay más de una) y las usa todas", () => {
    let seed = 7; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const n of [2, 3, 4]) {
      let last = -1; const seen = new Set<number>();
      for (let k = 0; k < 500; k++) { const i = pickNoRepeat(n, last, rand); expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThan(n); expect(i).not.toBe(last); seen.add(i); last = i; }
      expect(seen.size).toBe(n);
    }
    expect(pickNoRepeat(1, 0)).toBe(0);
    expect(pickNoRepeat(0, -1)).toBe(-1);
    const nr = new NoRepeat(rand), l = manifest.efectos.paso_metal; let prev = "";
    for (let k = 0; k < 100; k++) { const f = nr.pick("paso_metal", l)!; expect(f).not.toBe(prev); prev = f; }
    expect(nr.pick("x", [])).toBeNull();
  });

  it("variación de tono acotada", () => {
    for (let k = 0; k < 200; k++) { const r = pitchVar(); expect(r).toBeGreaterThanOrEqual(0.94); expect(r).toBeLessThanOrEqual(1.06); }
  });
});
