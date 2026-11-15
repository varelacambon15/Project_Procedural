import { describe, expect, it } from "vitest";
import { WAVE_MODIFIERS } from "../src/game/wavemods";

describe("modificadores de oleada", () => {
  it("todos son más difíciles que lo normal y pagan más", () => {
    for (const [k, m] of Object.entries(WAVE_MODIFIERS)) {
      expect(m.reward).toBeGreaterThan(1);
      if (k !== "noregen") expect(m.speed * m.hp * m.dmg + m.extraSmall).toBeGreaterThan(1); // (sin regeneración: la dificultad está en el jugador)
    }
  });
});
