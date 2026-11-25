// Rutas del registro de sesión: la validación que comparten el servidor de desarrollo (vite.config.ts) y el exe.
// Solo «carpeta/archivo» con caracteres seguros; sin rutas anidadas ni «..».
import { describe, expect, it } from "vitest";
import { sessionRelOk } from "../src/game/sessionpath";

describe("rutas del registro de sesión", () => {
  it("acepta carpeta/archivo con los nombres que genera el registro", () => {
    for (const ok of [
      "2026-11-22_20-10-05/eventos.jsonl",
      "2026-11-22_20-10-05/resumen.md",
      "2026-11-22_20-10-05/cap-001-01m00-auto.jpg",
    ]) expect(sessionRelOk(ok), ok).toBe(true);
  });

  it("rechaza escapes y rutas que no son carpeta/archivo", () => {
    for (const mal of ["../x/y.txt", "a.txt", "ok/../../fuera.txt", "a/b/c.txt", "a/b c.txt", "ok/..", "ok/.", "", "/eventos.jsonl", "carpeta/"]) {
      expect(sessionRelOk(mal), mal).toBe(false);
    }
  });

  it("rechaza valores que no son texto y nombres demasiado largos", () => {
    for (const mal of [null, undefined, 42, {}, "a".repeat(41) + "/x.txt", "dir/" + "x".repeat(81)]) expect(sessionRelOk(mal)).toBe(false);
  });
});
