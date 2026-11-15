import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { cycleKind, cycleSounds, filesOfType, pickReload, pickShot, soundType, type SoundManifest } from "../src/game/sounds";

const DIR = new URL("../assets/sonidos/", import.meta.url);
const m: SoundManifest = JSON.parse(readFileSync(new URL("manifest.json", DIR), "utf8"));
const GAME = ["pistol", "revolver", "smg", "rifle", "bullpup", "shotgun", "sniper", "lmg"];

describe("pack de sonidos: carga", () => {
  it("todos los archivos del manifest existen", () => {
    const all = [...Object.keys(m.tipos).flatMap((t) => filesOfType(m, t)), ...Object.values(m.efectos).flat()];
    expect(all.length).toBeGreaterThan(50);
    for (const f of all) expect(existsSync(new URL(f, DIR)), f).toBe(true);
  });
  it("cada tipo del juego carga sus disparos, su seco y su recarga", () => {
    for (const t of GAME) {
      const files = filesOfType(m, t);
      expect(files.length, t).toBeGreaterThan(3);
      expect(new Set(files).size).toBe(files.length);
    }
  });
  it("lanzagranadas y lanzallamas quedan fuera (síntesis)", () => {
    expect(soundType("launcher")).toBeNull(); expect(soundType("flamethrower")).toBeNull();
    expect(filesOfType(m, "launcher")).toEqual([]);
  });
});

describe("pack de sonidos: selección por tipo", () => {
  it("el disparo sale de su tipo, con su ganancia y la capa grave", () => {
    for (const t of GAME) {
      const k = soundType(t)!, p = pickShot(m, t, false, () => 0.5)!;
      expect(m.tipos[k].disparo).toContain(p.main);
      expect(p.gain).toBe(m.tipos[k].volumen_sugerido);
      if (m.tipos[k].grave?.length) expect(m.tipos[k].grave).toContain(p.grave);
    }
  });
  it("con silenciador usa la muestra silenciada (sin grave) si el tipo la tiene", () => {
    const p = pickShot(m, "rifle", true)!;
    expect(m.tipos.rifle.silenciado).toContain(p.main); expect(p.grave).toBeNull();
    expect(m.tipos.revolver.disparo).toContain(pickShot(m, "revolver", true)!.main); // (el revólver no tiene silenciada)
  });
  it("la variante de recarga es fija por arma y es una de las de su tipo", () => {
    for (const t of GAME) for (const seed of [1, 77, 123456, "x-p4-m24"]) {
      const a = pickReload(m, t, seed)!, b = pickReload(m, t, seed)!;
      expect(a.id).toBe(b.id);
      expect(m.tipos[soundType(t)!].recarga!.map((v) => v.id)).toContain(a.id);
      for (const p of a.pasos) { expect(p.en).toBeGreaterThanOrEqual(0); expect(p.en).toBeLessThanOrEqual(1); }
    }
  });
  it("el ciclo sigue la acción del arma", () => {
    expect(cycleKind("cerrojo", "semi", "pistol")).toBe("cerrojo"); // Welrod
    expect(cycleKind(undefined, "pump", "shotgun")).toBe("bombeo");
    expect(cycleKind("revolver_simple", "semi", "revolver")).toBe("martillo");
    expect(cycleKind("semiautomatica", "semi", "rifle")).toBeNull();
    expect(cycleSounds(m, "sniper", "cerrojo").length).toBeGreaterThan(0);
    expect(cycleSounds(m, "pistol", "cerrojo").length).toBeGreaterThan(0); // (de otro tipo si el suyo no lo tiene)
  });
});
