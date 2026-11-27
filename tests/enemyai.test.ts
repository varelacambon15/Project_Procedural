import { describe, expect, it } from "vitest";
import { chargeLevel, flankPoint, pickHealTarget, pounceState, turnToward } from "../src/game/enemyai";
import { MODEL_SHAPES, zoneOf } from "../src/game/enemymodels";

describe("enemigos nuevos: lógica pura (tarea 2)", () => {
  it("sabueso: de lejos rodea por su flanco; cerca va directo", () => {
    const pl = { x: 0, z: 0 };
    const l = flankPoint({ x: 0, z: 20 }, pl, 1), r = flankPoint({ x: 0, z: 20 }, pl, -1);
    expect(Math.sign(l.x)).toBe(-Math.sign(r.x)); expect(Math.abs(l.x)).toBeGreaterThan(3); expect(Math.abs(l.x)).toBeLessThanOrEqual(4.5);
    expect(Math.sign(flankPoint({ x: 0, z: 4 }, pl, 1).x)).toBe(Math.sign(l.x)); // (y se queda de su lado)
    const near = flankPoint({ x: 0, z: 4 }, pl, 1); expect(Math.hypot(near.x, near.z)).toBeLessThanOrEqual(0.8 + 1e-9); // (cerca: casi directo)
    // cuanto más cerca, menos se abre
    expect(Math.abs(flankPoint({ x: 0, z: 7 }, pl, 1).x)).toBeLessThan(Math.abs(l.x));
  });
  it("salto del sabueso: se agacha (aviso), salta y termina", () => {
    expect(pounceState(-1).phase).toBe("none");
    expect(pounceState(0.1).phase).toBe("crouch");
    expect(pounceState(0.5).phase).toBe("leap");
    expect(pounceState(2).phase).toBe("none");
  });
  it("reparador: cura al aliado vivo más herido a su alcance, nunca a sí mismo", () => {
    const c = [
      { x: 1, z: 0, hurt: 0.9, alive: true, self: true },
      { x: 2, z: 0, hurt: 0.3, alive: true },
      { x: 3, z: 0, hurt: 0.6, alive: true },
      { x: 30, z: 0, hurt: 0.95, alive: true },
      { x: 2, z: 1, hurt: 0.99, alive: false },
      { x: 1, z: 1, hurt: 0.01, alive: true },
    ];
    expect(pickHealTarget({ x: 0, z: 0 }, c)).toBe(2);
    expect(pickHealTarget({ x: 0, z: 0 }, c, 40)).toBe(3);
    expect(pickHealTarget({ x: 0, z: 0 }, [c[0], c[5]])).toBe(-1);
  });
  it("centinela: gira despacio por el camino corto y avisa antes de disparar", () => {
    expect(turnToward(0, 1, 0.2)).toBeCloseTo(0.2, 6);
    expect(turnToward(0, 0.1, 0.2)).toBeCloseTo(0.1, 6);
    expect(turnToward(3, -3, 0.2)).toBeCloseTo(3.2, 6); // (cruza ±π por el lado corto)
    expect(chargeLevel(2, 0.75)).toBe(0); expect(chargeLevel(0.375, 0.75)).toBeCloseTo(0.5, 6); expect(chargeLevel(0, 0.75)).toBe(1);
  });
  it("zonas de impacto por nombre de pieza", () => {
    expect(MODEL_SHAPES).toHaveLength(3);
    expect(zoneOf("hound", "visor")).toBe("head"); expect(zoneOf("hound", "mov_pata_3")).toBe("limb"); expect(zoneOf("hound", "lomo")).toBe("body");
    expect(zoneOf("repairer", "camara_lente")).toBe("head"); expect(zoneOf("repairer", "mov_rotor_2")).toBe("limb");
    expect(zoneOf("sentinel", "escudo_panel_1")).toBe("shield"); expect(zoneOf("sentinel", "sensor_lente")).toBe("head"); expect(zoneOf("sentinel", "casco")).toBe("body");
  });
});
