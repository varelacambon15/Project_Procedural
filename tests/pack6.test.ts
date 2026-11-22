import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { WeaponGenerator } from "../src/weapons/generator";
import { slotsOf } from "../src/weapons/workshop";
import type { Manifest, WeaponSpec } from "../src/weapons/types";

const manifest: Manifest = JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8"));
const gen = new WeaponGenerator(manifest);
const IDS = manifest.weapons.map((w) => w.id).filter((id) => id.startsWith("x-p6-"));

/** Anclas del estándar de packs (raw/pack4/LEEME_pack4.md) que debe traer todo arma de raw/pack6. */
const ANCLAS = ["boca", "cara_guardamanos", "cara_empunadura", "pozo_cargador", "raíl_frontal", "linea_mira", "raíl_superior", "cara_culata"];
/** Anclas que la conversión deja en el manifest del juego (convertKit39: /^(raíl_|boca|linea_mira|pozo_cargador)/). */
const ANCLAS_JUEGO = ["boca", "pozo_cargador", "linea_mira", "raíl_frontal", "raíl_superior"];

/** Carga un GLB con el parser de contenedor (cabeza + chunk JSON): triángulos y nodos sin malla (anclas). */
function glb(file: string) {
  const buf = readFileSync(new URL(file, import.meta.url));
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  expect(dv.getUint32(0, true)).toBe(0x46546c67); // 'glTF'
  expect(dv.getUint32(4, true)).toBe(2);
  expect(dv.getUint32(16, true)).toBe(0x4e4f534a); // primer chunk: JSON
  const json = JSON.parse(buf.subarray(20, 20 + dv.getUint32(12, true)).toString("utf8")) as {
    nodes?: { name?: string; mesh?: number }[];
    meshes?: { primitives: { indices?: number; attributes: Record<string, number> }[] }[];
    accessors?: { count: number }[];
  };
  let triangles = 0;
  for (const m of json.meshes ?? []) for (const p of m.primitives)
    triangles += (p.indices !== undefined ? json.accessors![p.indices].count : json.accessors![p.attributes.POSITION].count) / 3;
  return { triangles, anclas: (json.nodes ?? []).filter((n) => n.mesh === undefined).map((n) => n.name ?? "") };
}

describe("pack 6 (x-p6-*)", () => {
  it("hay armas del pack 6 en el manifest del juego", () => {
    expect(IDS.length).toBeGreaterThan(0);
  });

  for (const id of IDS) {
    it(`${id}: carga, anclas y menos de 6000 triángulos`, () => {
      const e = manifest.weapons.find((w) => w.id === id)!;
      // Carga: la entrada del manifest apunta a un GLB convertido válido y los triángulos (antes de la subdivisión de AO) cuadran
      expect(e.file).toMatch(/^kit39\/x-p6-/);
      const conv = glb(`../assets/weapons/${e.file}`);
      expect(conv.triangles).toBeGreaterThanOrEqual(e.triangles);
      expect(e.triangles).toBeLessThan(6000);
      // El pack fuente sigue las convenciones: manifest con las 8 anclas y ensamblada con nodos vacío por ancla
      const raw: { anclas: Record<string, number[]>; triangulos_total: number; accesorios_de_serie: unknown[] } =
        JSON.parse(readFileSync(new URL(`../raw/pack6/${e.label}/manifest.json`, import.meta.url), "utf8"));
      expect(raw.triangulos_total).toBeLessThan(6000);
      const anclasArma = ANCLAS.map((a) => (a === "pozo_cargador" && e.type === "revolver" ? "eje_tambor" : a)); // el revólver carga por el tambor
      for (const a of anclasArma) expect(raw.anclas[a]).toBeDefined();
      const src = glb(`../raw/pack6/${e.label}/${e.label}_ensamblada.glb`);
      for (const a of anclasArma) expect(src.anclas).toContain(a);
      // Las anclas que usa el juego llegan al manifest convertido
      for (const a of ANCLAS_JUEGO.filter((x) => !(x === "pozo_cargador" && e.type === "revolver"))) expect(e.anchors?.[a]).toBeDefined(); // el revólver carga por el tambor: sin pozo
    });

    it(`${id}: el generador la ve (tipo, era, accion, accesorios de serie)`, () => {
      const e = manifest.weapons.find((w) => w.id === id)!;
      expect(gen.byId.get(id)).toBe(e);
      expect(gen.types).toContain(e.type); // sale en el sorteo (byType sin excluidas, donantes ni retiradas)
      expect(gen.byType.get(e.type)).toContain(e);
      expect(e.era).toBe("modern");
      const raw = JSON.parse(readFileSync(new URL(`../raw/pack6/${e.label}/manifest.json`, import.meta.url), "utf8")) as { accion?: string; accesorios_de_serie?: unknown[] };
      expect(e.action).toBe(raw.accion); // la acción del juego es la del manifest de cada arma
      expect((e.stockAcc ?? []).length).toBe((raw.accesorios_de_serie ?? []).length);
    });
  }

  it("generate() puede producirlas como base y salen en el banco", () => {
    // Búsqueda de semillas (como la hoja de contacto del banco): generate() devuelve un arma con esa base.
    // Bucle síncrono acotado: los timeouts de vitest no interrumpen código síncrono.
    const missing = new Set(IDS), found = new Map<string, WeaponSpec>();
    for (let s = 1; s <= 15000 && missing.size; s++) {
      for (const t of new Set([...missing].map((id) => gen.byId.get(id)!.type))) {
        const w = gen.generate(s, t as never);
        if (missing.has(w.parts[0].from)) { missing.delete(w.parts[0].from); found.set(w.parts[0].from, w); }
      }
    }
    expect([...missing]).toEqual([]); // todas producidas
    for (const w of found.values()) {
      // El banco le da sus ranuras (cargador, mira y boca)
      expect(slotsOf(gen, w)).toEqual(expect.arrayContaining(["magazine", "scope", "muzzle"]));
    }
  }, 900000);
});
