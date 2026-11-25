import { describe, expect, it } from "vitest";
import { Pool, fxCaps, FX_CAPS_MEDIUM, TRACER_EVERY, impactMaterial, impactColor, type FxResource } from "../src/game/fxpool";

describe("pools de efectos: topes y reciclaje", () => {
  it("nunca superan el tope: acquire devuelve null al llenarse", () => {
    let made = 0;
    const p = new Pool<string>(3, () => `obj-${made++}`);
    expect(p.capacity).toBe(3);
    const got = [p.acquire(), p.acquire(), p.acquire()];
    expect(got).toEqual(["obj-0", "obj-1", "obj-2"]);
    expect(p.size).toBe(3);
    expect(p.acquire()).toBeNull();
    expect(made).toBe(3); // no crea la cuarta ranura al estar llena
  });

  it("reciclan: al liberar, la siguiente adquisición reutiliza el objeto", () => {
    let made = 0;
    const p = new Pool<number>(2, () => made++);
    const a = p.acquire()!, b = p.acquire()!;
    expect([a, b]).toEqual([0, 1]);
    p.release(a);
    expect(p.size).toBe(1);
    expect(p.freeCount).toBe(1);
    const c = p.acquire()!;
    expect(c).toBe(a);
    expect(made).toBe(2);
    expect(p.size).toBe(2);
  });

  it("ignoran liberaciones ajenas y flames repetidos no duplican ranuras", () => {
    const p = new Pool<string>(2, () => "x");
    const a = p.acquire()!;
    p.release("forastero");
    expect(p.size).toBe(1);
    expect(p.freeCount).toBe(0);
    p.release(a); p.release(a);
    expect(p.freeCount).toBe(1);
  });

  it("el reset se aplica en cada adquisición", () => {
    let n = 0;
    const p = new Pool<number>(1, () => 0, (v) => { void v; n++; });
    const v = p.acquire()!; p.release(v); p.acquire();
    expect(n).toBe(2);
  });
});

describe("topes por calidad", () => {
  it("Bajo reduce todos los topes a la mitad (mínimo 1) y Medio/Alto son la referencia", () => {
    const low = fxCaps("low"), medium = fxCaps("medium"), high = fxCaps("high");
    const keys = Object.keys(FX_CAPS_MEDIUM) as FxResource[];
    for (const k of keys) {
      expect(medium[k]).toBe(FX_CAPS_MEDIUM[k]);
      expect(high[k]).toBe(FX_CAPS_MEDIUM[k]);
      expect(low[k]).toBe(Math.max(1, Math.floor(FX_CAPS_MEDIUM[k] / 2)));
      expect(low[k]).toBeLessThanOrEqual(medium[k]);
    }
  });

  it("un pool construido con el tope de Bajo respeta ese tope", () => {
    const cap = fxCaps("low").casing, p = new Pool<object>(cap, () => ({}));
    for (let i = 0; i < cap; i++) expect(p.acquire()).not.toBeNull();
    expect(p.acquire()).toBeNull();
    expect(p.size).toBe(cap);
  });

  it("las trazadoras son más frecuentes según sube la calidad", () => {
    expect(TRACER_EVERY.high).toBeLessThan(TRACER_EVERY.medium);
    expect(TRACER_EVERY.medium).toBeLessThan(TRACER_EVERY.low);
  });
});

describe("impactos por material", () => {
  it("clasifica metal, hormigón y carne", () => {
    expect(impactMaterial({ metal: true })).toBe("metal");
    expect(impactMaterial({ zone: "shield" })).toBe("concrete");
    expect(impactMaterial({ zone: "head" })).toBe("flesh");
    expect(impactMaterial({ zone: "body" })).toBe("flesh");
    expect(impactMaterial({ zone: "limb" })).toBe("flesh");
    expect(impactMaterial({})).toBe("concrete");
  });

  it("elige colores de la paleta de forma determinista con un rng inyectado", () => {
    expect(impactColor("metal", () => 0)).toBe(0xffd27a);
    expect(impactColor("concrete", () => 0.999)).toBe(0xd8d0c0);
    expect(impactColor("flesh", () => 0)).toBe(0xf0e6d8);
    expect(impactColor("flesh", () => 0.4)).toBe(0xc0b4a4);
  });
});
