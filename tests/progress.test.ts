import { describe, expect, it } from "vitest";
import { MAX_LEVEL, addXp, canRaise, enemyLevel, killXp, migrateProgress, newProgress, overPenalty, perks, pointsFree, raise, respec, rollWeaponLevel, xpToNext } from "../src/game/progress";

describe("progresión: niveles", () => {
  it("la experiencia necesaria crece y el tope es 100", () => {
    expect(MAX_LEVEL).toBe(100);
    for (let l = 2; l < MAX_LEVEL; l++) expect(xpToNext(l)).toBeGreaterThan(xpToNext(l - 1));
    const p = newProgress(); addXp(p, 1e9); expect(p.level).toBe(100); expect(p.xp).toBe(0);
    expect(addXp(p, 500)).toBe(0);
  });
  it("sube varios niveles de golpe y guarda el sobrante", () => {
    const p = newProgress(), n = xpToNext(1) + xpToNext(2) + 7;
    expect(addXp(p, n)).toBe(2); expect(p.level).toBe(3); expect(p.xp).toBe(7);
  });
  it("armas en torno al nivel del jugador y penalización por encima", () => {
    for (let i = 0; i < 50; i++) { const l = rollWeaponLevel(20, i / 50); expect(l).toBeGreaterThanOrEqual(18); expect(l).toBeLessThanOrEqual(21); }
    expect(rollWeaponLevel(1, 0)).toBe(1);
    expect(overPenalty(10, 10)).toBe(1); expect(overPenalty(9, 10)).toBe(1);
    expect(overPenalty(12, 10)).toBeLessThan(1); expect(overPenalty(40, 10)).toBeGreaterThan(0.39);
  });
  it("enemigos al nivel del jugador y más experiencia cuanto más nivel", () => {
    expect(enemyLevel(10, "basic", 0)).toBe(10); expect(enemyLevel(10, "warden", 4)).toBe(12);
    expect(killXp("basic", 30)).toBeGreaterThan(killXp("basic", 1)); expect(killXp("warden", 1)).toBeGreaterThan(killXp("basic", 1));
  });
  it("partidas antiguas: el jugador empieza al nivel de su mejor arma", () => {
    expect(migrateProgress(undefined, [9, 14, 11]).level).toBe(14);
    expect(migrateProgress(undefined, []).level).toBe(1);
    expect(migrateProgress({ level: 7, xp: 30, skills: { g_dmg: 2 } }, [40]).level).toBe(7);
  });
});

describe("progresión: árbol de habilidades", () => {
  it("un punto por nivel, rangos máximos y requisitos de rama", () => {
    const p = newProgress(); expect(pointsFree(p)).toBe(0); expect(raise(p, "g_dmg")).toBe(false);
    p.level = 30; expect(pointsFree(p)).toBe(29);
    expect(canRaise(p, "g_master")).toBe(false); // pide 15 puntos en la rama
    for (let i = 0; i < 8; i++) expect(raise(p, "g_dmg")).toBe(true);
    expect(raise(p, "g_dmg")).toBe(false);
    for (let i = 0; i < 7; i++) raise(p, "g_rate");
    expect(raise(p, "g_master")).toBe(true);
    const k = perks(p); expect(k.dmg).toBeCloseTo(1 + 0.16 + 0.1, 5); expect(k.rate).toBeCloseTo(1 + 0.105, 5);
    respec(p); expect(pointsFree(p)).toBe(29); expect(perks(p).dmg).toBe(1);
  });
});
