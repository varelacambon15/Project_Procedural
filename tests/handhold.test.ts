// Mano de apoyo (encargo 30): un arma larga o una pistola/revólver con culata se sujeta a dos manos, y ningún anclaje de
// la mano izquierda puede salir con coordenadas no finitas (la mano desaparecía o quedaba encima de la derecha).
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WeaponGenerator } from "../src/weapons/generator";
import { WeaponAssembler } from "../src/weapons/assembler";
import { gripChoices } from "../src/weapons/grip";
import type { Manifest, WeaponType } from "../src/weapons/types";
import type { Support } from "../src/weapons/grip";

// La oclusión de contacto (rayos por vértice) no interviene en las manos y cuesta ~0,5 s por arma: fuera de este test.
vi.mock("../src/weapons/ao", () => ({ contactAO: () => {}, contactAOAsync: async () => {} }));

const root = resolve(__dirname, "..");
/** El ensamblador carga los .glb con `fetch` y dibuja mapas de rugosidad con canvas: en Node se sirven del disco. */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:/.test(url)) return realFetch(input as RequestInfo, init);
  const buf = await readFile(resolve(root, "assets", url.replace(/^\.?\//, "")));
  return new Response(buf, { status: 200, headers: { "content-type": "application/octet-stream" } });
}) as typeof fetch;
const ctx = new Proxy({}, { get: () => () => ({ data: new Uint8ClampedArray(4) }), set: () => true });
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  createElementNS: () => ({ style: {}, setAttribute: () => {}, addEventListener: () => {} }),
};
(globalThis as unknown as { self: unknown }).self = { ...(globalThis as object) };

const gen = new WeaponGenerator(JSON.parse(readFileSync(new URL("../assets/weapons/manifest.json", import.meta.url), "utf8")) as Manifest);
const fin = (v: { x: number; y: number; z: number } | null | undefined) => !!v && [v.x, v.y, v.z].every(Number.isFinite);

const CLASSES: WeaponType[] = ["pistol", "revolver", "smg", "rifle", "bullpup", "shotgun", "sniper", "lmg"];

describe("mano de apoyo (encargo 30)", () => {
  it("ninguna pistola o revólver con culata de hombro se ofrece (ni se elige) a una mano", () => {
    let withStock = 0;
    for (let s = 0; s < 1500; s++) {
      const w = gen.generate(s * 7 + 3, s % 3 === 0 ? "revolver" : "pistol");
      if (!w.tweaks.pstock || w.tweaks.nostock) continue;
      withStock++;
      // La variante guardada y la preferida sujetan a dos manos (nunca `none`, que era a una mano)
      expect(w.hold, w.id).toBeTruthy();
      expect(w.hold!.hip, w.id).not.toBe("none");
      expect(w.hold!.ads, w.id).not.toBe("none");
      // Y el banco no ofrece la de una mano ni la que alterna
      for (const g of gripChoices(w)) expect(["one", "switch"], `${w.id} ${g.variant}`).not.toContain(g.variant);
    }
    expect(withStock).toBeGreaterThan(30);
  });

  it("300 armas de cada clase: los anclajes de la mano de apoyo existen y son finitos", async () => {
    const asm = new WeaponAssembler(gen, "./weapons/");
    let bad = 0, assembled = 0, failed = 0, missing = 0;
    for (const type of CLASSES) {
      for (let s = 0; s < 300; s++) {
        const w = gen.generate(s * 11 + 1, type);
        let a;
        try { a = await asm.assemble(w); } catch { failed++; continue; }
        assembled++;
        const h = a.handles;
        if (!fin(h.grip) || !fin(h.support)) { bad++; continue; }
        // Ningún anclaje puede salir con NaN/Infinity (la mano desaparecía)
        for (const k of Object.keys(h.anchors) as Support[]) {
          const p = h.anchors[k];
          if (p && !fin(p)) { bad++; break; }
        }
        // En armas largas y cortas con culata el anclaje del perfil de agarre siempre existe: si la pieza no lo da, se
        // usa el guardamanos (nunca la empuñadura, que dejaba la mano izquierda encima de la derecha)
        const twoHanded = w.type !== "pistol" && w.type !== "revolver" || w.hold?.stance !== "hip";
        if (twoHanded) {
          for (const sup of [w.hold?.hip, w.hold?.ads]) {
            if (!sup || sup === "none" || sup === "custom") continue;
            if (!h.anchors[sup]) { missing++; if (missing < 6) console.log("SIN ANCLAJE", type, w.id, sup); }
          }
        }
      }
    }
    expect(assembled).toBeGreaterThan(CLASSES.length * 250);
    expect(failed).toBeLessThan(CLASSES.length * 20);
    expect(bad).toBe(0);
    expect(missing).toBe(0);
  }, 900000);
});

