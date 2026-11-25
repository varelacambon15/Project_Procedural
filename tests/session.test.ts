// Registro de sesión: capturas automáticas y por eventos, notas, errores, tope de capturas y resumen final. Lógica pura (E/S inyectada).
import { describe, expect, it } from "vitest";
import { AUTO_EVERY, MAX_CAPTURES, SessionRecorder, sessionName } from "../src/game/session";

const make = () => {
  const files = new Map<string, string>();
  const io = { write: async (rel: string, b64: string) => { files.set(rel, b64); } };
  const rec = new SessionRecorder(io, async () => "QUJD", () => ({ calls: 120, tris: 50000 }), () => ({ modo: "supervivencia", arma: "Test" }));
  const text = (name: string) => { const e = [...files.keys()].find((k) => k.endsWith(name)); return e ? new TextDecoder().decode(Uint8Array.from(atob(files.get(e)!), (c) => c.charCodeAt(0))) : ""; };
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { rec, files, text, flush };
};

describe("registro de sesión", () => {
  it("el nombre de la carpeta lleva fecha y hora", () => {
    expect(sessionName(new Date(2026, 10, 22, 9, 5, 7))).toBe("2026-11-22_09-05-07");
  });

  it("no hace nada si no está activo", async () => {
    const { rec, files, flush } = make();
    rec.tick(100); rec.event("muerte"); rec.afterRender(); await flush();
    expect(files.size).toBe(0);
  });

  it("captura sola cada 60 s y los eventos clave hacen captura", async () => {
    const { rec, files, flush } = make();
    rec.start(new Date(2026, 10, 22, 10, 0, 0));
    rec.tick(AUTO_EVERY + 1); rec.afterRender(); await flush();
    expect([...files.keys()].filter((k) => k.endsWith(".jpg")).length).toBe(1);
    rec.event("muerte"); rec.afterRender(); await flush();
    expect([...files.keys()].filter((k) => /muerte\.jpg$/.test(k)).length).toBe(1);
    rec.event("kill"); rec.afterRender(); await flush(); // un evento normal no captura
    expect([...files.keys()].filter((k) => k.endsWith(".jpg")).length).toBe(2);
  });

  it("las notas salen en el resumen con su hora y los errores se cuentan", async () => {
    const { rec, text, flush } = make();
    rec.start(); rec.tick(75); rec.note("  el arma se ve rara  "); rec.note("   "); rec.error("TypeError: x is undefined");
    rec.stop(); await flush();
    const md = text("resumen.md");
    expect(md).toContain("01:15 — el arma se ve rara");
    expect(md).toContain("TypeError: x is undefined");
    expect(md).toContain("Errores: 1");
    expect(text("eventos.jsonl").split("\n").filter(Boolean).every((l) => JSON.parse(l).t >= 0)).toBe(true);
  });

  it("el rendimiento se muestrea cada 10 s con FPS y datos del contexto", async () => {
    const { rec, text, flush } = make();
    rec.start();
    for (let i = 0; i < 20 * 60; i++) rec.tick(1 / 60); // 20 s a 60 fps
    rec.stop(); await flush();
    const perf = text("eventos.jsonl").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.e === "rendimiento");
    expect(perf.length).toBe(2);
    expect(perf[0].fps).toBeGreaterThan(55); expect(perf[0].modo).toBe("supervivencia");
    expect(text("resumen.md")).toContain("FPS medio");
  });

  it("no pasa del tope de capturas", async () => {
    const { rec, files, flush } = make();
    rec.start();
    for (let i = 0; i < MAX_CAPTURES + 30; i++) { rec.mark(); rec.afterRender(); await flush(); }
    expect([...files.keys()].filter((k) => k.endsWith(".jpg")).length).toBe(MAX_CAPTURES);
  });

  it("sin dónde guardar (navegador) no falla", async () => {
    const rec = new SessionRecorder(null, async () => "QUJD", () => ({ calls: 1, tris: 1 }), () => ({}));
    rec.start(); rec.mark(); rec.afterRender(); rec.stop();
    await new Promise((r) => setTimeout(r, 0));
    expect(rec.active).toBe(false);
  });
});
