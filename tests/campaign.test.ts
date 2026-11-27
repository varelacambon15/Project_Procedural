import { describe, expect, it } from "vitest";
import { LEVELS, campaignDone, finishLevel, isUnlocked, migrateCampaign, newCampaign, optionalsMet, planLevel, starsOf, totalStars, validateLevels, type CampaignLevel } from "../src/game/campaign";
import { SAVE_VERSION, parseSave } from "../src/game/save";

const win = { completed: true, seconds: 100, damageTaken: 0, chest: true };

describe("campaña Hack: tabla de niveles (tarea 3, fase a)", () => {
  it("la tabla del juego es válida: 5 niveles, el último con jefe y legendaria", () => {
    expect(validateLevels(LEVELS)).toEqual([]);
    expect(LEVELS).toHaveLength(5);
    const last = LEVELS[4];
    expect(last.objectives.at(-1)?.type).toBe("boss"); expect(last.reward.rarity).toBe("legendaria");
    // al menos 5 tipos de objetivo distintos en la campaña
    expect(new Set(LEVELS.flatMap((l) => l.objectives.map((o) => o.type))).size).toBeGreaterThanOrEqual(5);
  });
  it("la validación detecta tablas rotas", () => {
    const bad = { ...LEVELS[0], id: "x", rooms: 2, objectives: [{ type: "hack" }, { type: "clear" }], reward: { credits: 0, rarity: "mítica", firstBonus: 1 } } as unknown as CampaignLevel;
    const e = validateLevels([bad, { ...LEVELS[0], id: "x" }]);
    expect(e.some((m) => /salas fuera/.test(m))).toBe(true);
    expect(e.some((m) => /hack sin segundos/.test(m))).toBe(true);
    expect(e.some((m) => /acabar en extract o boss/.test(m))).toBe(true);
    expect(e.some((m) => /rareza/.test(m))).toBe(true);
    expect(e.some((m) => /repetido/.test(m))).toBe(true);
  });
});

describe("campaña Hack: plan de un nivel", () => {
  it("todos los objetivos de sala en orden, el jefe en la última sala, mismo plan con la misma semilla", () => {
    for (const l of LEVELS) for (const seed of [1, 2, 99, 12345]) {
      const p = planLevel(l, seed);
      expect(p.rooms).toHaveLength(l.rooms);
      const got = p.rooms.filter((r) => r.objective).map((r) => r.objective!.type);
      expect(got).toEqual(l.objectives.filter((o) => o.type !== "extract").map((o) => o.type));
      if (l.objectives.some((o) => o.type === "boss")) expect(p.rooms.at(-1)!.objective!.type).toBe("boss");
      expect(p.chestRoom).toBeGreaterThanOrEqual(1); expect(p.chestRoom).toBeLessThanOrEqual(l.rooms);
      expect(planLevel(l, seed)).toEqual(p);
    }
    // y cambia con la semilla (rejugable)
    const l = LEVELS[3], plans = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(planLevel(l, s).rooms.map((r) => r.objective?.type ?? "-")) + planLevel(l, s).chestRoom));
    expect(plans.size).toBeGreaterThan(1);
  });
});

describe("campaña Hack: progreso, estrellas y recompensas", () => {
  it("se desbloquea en orden y la primera vez paga más", () => {
    let s = newCampaign();
    expect(isUnlocked(s, "h1")).toBe(true); expect(isUnlocked(s, "h2")).toBe(false);
    const fail = finishLevel(s, "h1", { ...win, completed: false });
    expect(fail.rewards.credits).toBe(0); expect(fail.state.levels.h1.runs).toBe(1); expect(isUnlocked(fail.state, "h2")).toBe(false);
    const a = finishLevel(fail.state, "h1", { ...win, chest: false, seconds: 999, damageTaken: 999 });
    expect(a.rewards.firstClear).toBe(true); expect(a.rewards.unlocked).toBe("h2"); expect(a.rewards.credits).toBe(300 * 2);
    s = a.state; expect(isUnlocked(s, "h2")).toBe(true); expect(starsOf(s, "h1")).toBe(0);
    // segunda vez con las tres estrellas: sin bonus de primera vez, +25 % por cada estrella nueva
    const b = finishLevel(s, "h1", win);
    expect(b.rewards.firstClear).toBe(false); expect(b.rewards.newStars.sort()).toEqual(["chest", "nodamage", "time"]);
    expect(b.rewards.credits).toBe(Math.round(300 * 1.75)); expect(starsOf(b.state, "h1")).toBe(3);
    // las estrellas ya ganadas no se vuelven a pagar
    expect(finishLevel(b.state, "h1", win).rewards.newStars).toEqual([]);
    expect(b.state.levels.h1.bestTime).toBe(100);
    expect(s).not.toBe(b.state); expect(s.levels.h1.stars).toEqual([]); // (no muta el estado de entrada)
  });
  it("opcionales: tiempo y daño con su límite", () => {
    const l = LEVELS[0];
    expect(optionalsMet(l, { completed: true, seconds: 240, damageTaken: 60, chest: false }).sort()).toEqual(["nodamage", "time"]);
    expect(optionalsMet(l, { completed: true, seconds: 241, damageTaken: 61, chest: false })).toEqual([]);
    expect(optionalsMet(l, { ...win, completed: false })).toEqual([]);
  });
  it("jefe final: legendaria garantizada solo la primera vez; campaña completa", () => {
    let s = newCampaign();
    for (const l of LEVELS.slice(0, 4)) s = finishLevel(s, l.id, win).state;
    expect(campaignDone(s)).toBe(false);
    const f = finishLevel(s, "h5", win);
    expect(f.rewards.guaranteed).toBe(true); expect(f.rewards.rarity).toBe("legendaria"); expect(f.rewards.unlocked).toBeNull();
    expect(campaignDone(f.state)).toBe(true); expect(totalStars(f.state)).toBe(15);
    expect(finishLevel(f.state, "h5", win).rewards.guaranteed).toBe(false);
  });
  it("migración suave: partidas sin campaña o con datos raros", () => {
    expect(migrateCampaign(undefined)).toEqual(newCampaign());
    expect(migrateCampaign("x")).toEqual(newCampaign());
    const m = migrateCampaign({ finalReward: 1, levels: { h1: { done: true, stars: ["chest", "chest", "oro"], bestTime: -3, runs: 2.6 }, h2: { done: false, stars: ["time"] }, zz: { done: true } } });
    expect(m.finalReward).toBe(false);
    expect(m.levels.h1).toEqual({ done: true, stars: ["chest"], bestTime: null, runs: 2 });
    expect(m.levels.h2.stars).toEqual([]); // (sin completar no hay estrellas)
    expect(m.levels.zz).toBeUndefined();
  });
  it("el guardado conserva la campaña", () => {
    const st = finishLevel(newCampaign(), "h1", win).state;
    const r = parseSave(JSON.stringify({ version: SAVE_VERSION, weapons: [], campaign: st }));
    expect(r.ok && migrateCampaign(r.data.campaign)).toEqual(st);
  });
});
