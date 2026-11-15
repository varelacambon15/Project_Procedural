// Modificadores de oleada (datos puros, sin DOM: los usa waves.ts y se prueban en tests/waves.test.ts).
/**
 * Modificadores de oleada: a partir de la 3.ª, algunas oleadas (no las de jefe) llevan uno al azar. Más difícil, más
 * recompensa (`reward` multiplica los créditos de fin de oleada).
 */
export type WaveModifier = "fast" | "tough" | "swarm" | "noregen" | "lethal";
export const WAVE_MODIFIERS: Record<WaveModifier, { speed: number; hp: number; dmg: number; extraSmall: number; reward: number }> = {
  fast: { speed: 1.5, hp: 1, dmg: 1, extraSmall: 0, reward: 1.3 },
  tough: { speed: 1, hp: 1.8, dmg: 1, extraSmall: 0, reward: 1.5 },
  swarm: { speed: 1, hp: 1, dmg: 1, extraSmall: 10, reward: 1.3 },
  noregen: { speed: 1, hp: 1, dmg: 1, extraSmall: 0, reward: 1.4 },
  lethal: { speed: 1, hp: 1, dmg: 1.7, extraSmall: 0, reward: 1.4 },
};
