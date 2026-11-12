import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WeaponGenerator } from "../src/weapons/generator";
import { MAX_TRIES, findWeapon, starterWeapons } from "../src/game/loadout";
import type { Manifest } from "../src/weapons/types";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const gen = new WeaponGenerator(JSON.parse(readFileSync(join(ROOT, "assets/weapons/manifest.json"), "utf8")) as Manifest);

describe("búsquedas que no se cuelgan (causa del cuelgue al arrancar)", () => {
  it("el equipo inicial se genera siempre, rápido y con la rareza pedida", () => {
    const t0 = Date.now(); const ws = starterWeapons(gen);
    expect(ws.map((w) => w.type)).toEqual(["pistol", "rifle", "shotgun", "smg"]);
    for (const w of ws) expect(["comun", "poco"]).toContain(w.rarity.id);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("una búsqueda imposible termina en el tope y devuelve un arma (no se cuelga)", () => {
    let calls = 0;
    const w = findWeapon(gen, "pistol", 5, () => { calls++; return false; });
    expect(calls).toBe(MAX_TRIES); expect(w.type).toBe("pistol");
  });

  it("no quedan bucles sin límite en el código del juego", () => {
    const files: string[] = [];
    const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
    walk(join(ROOT, "src"));
    const bad = files.flatMap((f) => readFileSync(f, "utf8").split("\n").map((l, i) => [f, i + 1, l] as const)
      .filter(([, , l]) => /for\s*\(\s*let\s+\w+\s*=[^;]*;\s*;|while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(l)));
    expect(bad.map(([f, n]) => `${f.slice(ROOT.length)}:${n}`)).toEqual([]);
  });
});
