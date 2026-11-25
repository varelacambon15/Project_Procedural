// Los archivos de Electron (proceso principal y puente) no pasan por el compilador de TypeScript: un error de sintaxis solo
// se ve al abrir el exe. Este test los compila (sin ejecutarlos) y comprueba la validación de rutas del registro de sesión.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const src = (f: string) => readFileSync(new URL(`../desktop/${f}`, import.meta.url), "utf8");

describe("empaquetado de escritorio", () => {
  for (const f of ["main.cjs", "preload.cjs"]) {
    it(`${f} es JavaScript válido`, () => { expect(() => new Script(src(f), { filename: f })).not.toThrow(); });
  }

  it("el manejador del registro de sesión valida la ruta con una expresión escapada", () => {
    const m = /!(\/\^\[0-9A-Za-z_-\]\{1,40\}\\\/\[0-9A-Za-z\._-\]\{1,80\}\$\/)\.test\(rel\)/.exec(src("main.cjs"));
    expect(m, "no se encuentra la validación de rutas").not.toBeNull();
    const re = new Function(`return ${m![1]}`)() as RegExp;
    expect(re.test("2026-11-22_20-10-05/cap-001-01m00-auto.jpg")).toBe(true);
    for (const mal of ["../x/y.txt", "a.txt", "ok/../../fuera.txt", "a/b/c.txt", "a/b c.txt"]) expect(re.test(mal), mal).toBe(false);
  });
});
