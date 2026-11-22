// Asistente del hall: los eventos de contexto deben tener sus frases en los dos idiomas.
// (No se instancia HallBot: el constructor necesita un canvas del DOM; aquí se comprueba la tabla de frases.)
import { describe, expect, it } from "vitest";
import { BOT_LINES } from "../src/game/hallbot";
import { hasKey } from "../src/i18n";

const CONTEXT_EVENTS = ["lowCredits", "newSuper", "newGadget", "furnitureFull"] as const;

describe("asistente del hall: frases según el contexto", () => {
  it("cada evento de contexto tiene 3 frases", () => {
    for (const e of CONTEXT_EVENTS) expect(BOT_LINES[e], e).toBe(3);
  });
  it("esas frases existen en inglés y en español", () => {
    const missing: string[] = [];
    for (const e of CONTEXT_EVENTS) for (let i = 0; i < BOT_LINES[e]; i++) for (const lang of ["en", "es"] as const) { const key = `bot.${e}.${i}`; if (!hasKey(lang, key)) missing.push(`${lang}:${key}`); }
    expect(missing).toEqual([]);
  });
});
