import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/** Verificación del lote de piezas donantes modificadas (encargo 26). */
interface Pieza {
  id: string;
  categoria: string;
  pieza: string;
  ancla: string;
  largo_m: number;
  archivo: string;
  triangulos: number;
  bbox_min: number[];
  bbox_max: number[];
  material: string;
  origen: string;
  modificaciones: number[];
  volumen_original_m3?: number;
  volumen_final_m3?: number;
  variacion_volumen_pct?: number;
  comparacion?: string;
}

type GlbJson = {
  meshes?: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
  accessors?: { count: number; min?: number[]; max?: number[] }[];
};

function leerGlb(ruta: URL) {
  expect(existsSync(ruta)).toBe(true);
  const buf = readFileSync(ruta);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // glTF
  expect(dv.getUint32(4, true)).toBe(2);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // chunk JSON
  const json = JSON.parse(buf.subarray(20, 20 + dv.getUint32(12, true)).toString("utf8")) as GlbJson;
  let triangulos = 0;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    triangulos += (p.indices !== undefined
      ? json.accessors![p.indices].count
      : json.accessors![p.attributes.POSITION].count) / 3;
    const pos = json.accessors![p.attributes.POSITION];
    expect(pos.min).toBeDefined();
    expect(pos.max).toBeDefined();
    for (let i = 0; i < 3; i++) {
      lo[i] = Math.min(lo[i], pos.min![i]);
      hi[i] = Math.max(hi[i], pos.max![i]);
    }
  }
  expect(triangulos).toBeGreaterThan(0);
  return { triangulos, lo, hi };
}

// raw/pack7 no se sube al repositorio (piezas donantes): si falta, el bloque se omite limpiamente.
const PIEZAS_JSON = new URL("../raw/pack7/piezas_sueltas/piezas.json", import.meta.url);
const ACCESORIOS_JSON = new URL("../raw/pack7/accesorios/accesorios.json", import.meta.url);
const HAY_PACK7 = existsSync(PIEZAS_JSON) && existsSync(ACCESORIOS_JSON);
const PIEZAS: Pieza[] = HAY_PACK7 ? JSON.parse(readFileSync(PIEZAS_JSON, "utf8")) : [];
const ACCESORIOS: Pieza[] = HAY_PACK7 ? JSON.parse(readFileSync(ACCESORIOS_JSON, "utf8")) : [];
const TODAS = [...PIEZAS, ...ACCESORIOS];

describe.skipIf(!HAY_PACK7)("pack7 — piezas donantes low poly e Infinite Warfare", () => {
  it("hay piezas de las dos fases", () => {
    expect(PIEZAS.length + ACCESORIOS.length).toBeGreaterThanOrEqual(50);
    expect(TODAS.filter((p) => p.id.startsWith("lp_")).length).toBeGreaterThan(0);
    expect(TODAS.filter((p) => p.id.startsWith("iw_")).length).toBeGreaterThanOrEqual(10);
  });

  it("ids únicos", () => {
    const ids = TODAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of TODAS) expect(p.id).toMatch(/^(lp|iw)_[a-z]{2}_\d{2}$/);
  });

  for (const [grupo, base, lista] of [
    ["piezas_sueltas", "../raw/pack7/piezas_sueltas/", PIEZAS],
    ["accesorios", "../raw/pack7/", ACCESORIOS],
  ] as const) {
    describe(grupo, () => {
      for (const p of lista) {
        it(`${p.id}: GLB, triángulos, caja, ancla, modificaciones`, () => {
          const g = leerGlb(new URL(base + p.archivo, import.meta.url));
          expect(g.triangulos).toBe(p.triangulos);
          expect(g.triangulos).toBeLessThanOrEqual(1500);
          // bbox del GLB (Y-up) coherente con el registro
          for (let i = 0; i < 3; i++) {
            expect(g.lo[i]).toBeCloseTo(p.bbox_min[i], 3);
            expect(g.hi[i]).toBeCloseTo(p.bbox_max[i], 3);
          }
          expect(p.largo_m).toBeCloseTo(g.hi[0] - g.lo[0], 3);
          expect(p.largo_m).toBeGreaterThan(0);
          expect(p.ancla.length).toBeGreaterThan(0);
          expect(p.material).toBe("mat_" + p.pieza);
          expect(p.origen).toMatch(/^(lowpoly|iw):[A-Za-z0-9_-]+$/);
          expect(p.modificaciones.length).toBeGreaterThanOrEqual(2);
          for (const m of p.modificaciones) expect(m).toBeGreaterThanOrEqual(1);
          expect(Math.abs(p.variacion_volumen_pct ?? 0)).toBeGreaterThanOrEqual(12);
          expect(p.comparacion).toMatch(/^comparaciones\//);
          expect(existsSync(new URL("../raw/pack7/" + p.comparacion, import.meta.url))).toBe(true);
        });
      }
    });
  }
});
