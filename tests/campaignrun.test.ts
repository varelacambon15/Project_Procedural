import { describe, expect, it } from "vitest";
import { LEVELS, planLevel } from "../src/game/campaign";
import { CampaignRun } from "../src/game/campaignrun";

const run = (i: number) => new CampaignRun(LEVELS[i], planLevel(LEVELS[i], 7));

describe("campaña Hack: cadena de objetivos de una partida (tarea 3, fase b)", () => {
  it("solo avanza el objetivo en curso, en orden", () => {
    const r = run(0); // clear → hack → extract
    expect(r.complete("hack")).toBe(false); expect(r.canExtract).toBe(false);
    expect(r.complete("clear")).toBe(true); expect(r.current?.type).toBe("hack");
    expect(r.complete("extract")).toBe(false);
  });
  it("hack: cuenta dentro de la zona, se pierde despacio fuera", () => {
    const r = run(0); r.complete("clear");
    for (let i = 0; i < 10; i++) r.hackTick(1, true);
    expect(r.hackT).toBe(10); r.hackTick(4, false); expect(r.hackT).toBe(9);
    expect(r.hud().key).toBe("cp.obj.hack"); expect(r.hud().p.s).toBe(11);
    let fin = false; for (let i = 0; i < 11 && !fin; i++) fin = r.hackTick(1, true);
    expect(fin).toBe(true); expect(r.canExtract).toBe(true);
    expect(r.complete("extract")).toBe(true); expect(r.done).toBe(true);
    expect(r.result().completed).toBe(true);
  });
  it("destroy y survive cuentan hasta su número", () => {
    const r = run(1); // clear → destroy 3 → survive 2 → extract
    r.complete("clear");
    expect(r.destroyedOne()).toBe(false); expect(r.hud().p).toEqual({ n: 1, of: 3 });
    r.destroyedOne(); expect(r.destroyedOne()).toBe(true); expect(r.current?.type).toBe("survive");
    expect(r.waveDone()).toBe(false); expect(r.waveDone()).toBe(true); expect(r.canExtract).toBe(true);
  });
  it("retrieve: lleva el núcleo hasta la salida", () => {
    const r = run(2); // eliminate → retrieve → extract
    r.complete("eliminate"); r.complete("retrieve");
    expect(r.carrying).toBe(true); expect(r.hud().key).toBe("cp.obj.extractCore");
    r.complete("extract"); expect(r.carrying).toBe(false); expect(r.done).toBe(true);
  });
  it("tiempo y daño para las estrellas; una partida fallida no cuenta", () => {
    const r = run(4);
    r.tick(5); r.hurt(12); r.hurt(-3); r.chest = true;
    expect(r.result()).toEqual({ completed: false, seconds: 5, damageTaken: 12, chest: true });
    r.failed = true; expect(r.complete("clear")).toBe(false);
  });
  it("cada objetivo de sala tiene su sala en el plan", () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const r = run(i), types = Array.from({ length: LEVELS[i].rooms }, (_, k) => r.roomObjective(k + 1)?.type).filter(Boolean);
      expect(types).toEqual(LEVELS[i].objectives.filter((o) => o.type !== "extract").map((o) => o.type));
    }
  });
});
