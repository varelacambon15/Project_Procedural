import { describe, expect, it } from "vitest";
import { RETICLES, RETICLE_IDS, RETICLE_COLORS, reticleShown, reticleSvg } from "../src/game/reticles";
import { RETICLE_UNLOCKS, START_RETICLES, addReticleKill, cleanChoice, migrateReticles, newReticleProgress, nextUnlock, opticFamily, selectorOrder } from "../src/game/reticlecustom";

describe("catálogo ampliado (tarea 5)", () => {
  it("20 formas, todas SVG válidos con viewBox 100×100 y algún trazo o relleno", () => {
    expect(RETICLE_IDS).toHaveLength(20);
    for (const id of RETICLE_IDS) {
      const s = RETICLES[id];
      expect(s.startsWith("<svg"), id).toBe(true);
      expect(s).toContain('viewBox="0 0 100 100"');
      expect(s.trimEnd().endsWith("</svg>")).toBe(true);
      expect(/<(path|circle)\b/.test(s), id).toBe(true);
      // etiquetas equilibradas
      expect((s.match(/<svg/g) ?? []).length).toBe((s.match(/<\/svg>/g) ?? []).length);
    }
  });
  it("cada color se aplica a toda la forma (no queda rojo en los demás colores)", () => {
    for (const id of RETICLE_IDS) for (const c of Object.keys(RETICLE_COLORS) as (keyof typeof RETICLE_COLORS)[]) {
      const s = reticleSvg(id, c);
      expect(s).toContain(RETICLE_COLORS[c]);
      if (c !== "rojo") expect(s).not.toContain(RETICLE_COLORS.rojo);
    }
  });
});

describe("desbloqueo por hitos", () => {
  it("datos: hitos válidos, sin repetir y sin incluir las de inicio", () => {
    expect(START_RETICLES).toEqual(["dot", "ring-dot", "cross"]);
    const ids = RETICLE_UNLOCKS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of RETICLE_UNLOCKS) { expect(START_RETICLES).not.toContain(u.id); expect(u.kills).toBeGreaterThan(0); }
    // toda forma del catálogo se puede conseguir
    for (const id of RETICLE_IDS) expect([...START_RETICLES, ...ids]).toContain(id);
    // hitos del brief
    expect(RETICLE_UNLOCKS.find((u) => u.id === "ring")).toMatchObject({ family: "punto", kills: 50 });
    expect(RETICLE_UNLOCKS.find((u) => u.id === "chevron-bdc")).toMatchObject({ family: "aumentos", kills: 100 });
    expect(RETICLE_UNLOCKS.find((u) => u.id === "mildot")).toMatchObject({ family: "visor", kills: 100 });
  });

  it("familia de cada óptica", () => {
    expect(opticFamily("k-att-reflex-east", "holo")).toBe("punto");
    expect(opticFamily("acc:holo", "dot")).toBe("holo");
    expect(opticFamily("k-att-magnified-west", "holo")).toBe("aumentos");
    expect(opticFamily("acc:scope6", "scope")).toBe("visor");
    expect(opticFamily(null, "irons")).toBeNull();
    expect(opticFamily(null, "dot")).toBe("punto");
  });

  it("las bajas desbloquean en su hito, una sola vez, y avisan", () => {
    const p = newReticleProgress();
    let fresh: string[] = [];
    for (let i = 0; i < 49; i++) fresh.push(...addReticleKill(p, "punto"));
    expect(fresh).toEqual([]); expect(p.unlocked).not.toContain("ring");
    expect(addReticleKill(p, "punto")).toEqual(["ring"]);
    expect(addReticleKill(p, "punto")).toEqual([]);
    expect(p.unlocked.filter((x) => x === "ring")).toHaveLength(1);
    expect(addReticleKill(p, null)).toEqual([]);
    expect(nextUnlock(p, "punto")).toEqual({ id: "crosshair-gap", have: 51, need: 120 });
  });

  it("migración suave: partidas sin el campo, con basura o con hitos ya cumplidos; nunca quita nada", () => {
    expect(migrateReticles(undefined)).toEqual(newReticleProgress());
    expect(migrateReticles({ kills: { punto: "x", visor: -3 }, unlocked: ["nada", 4] })).toEqual(newReticleProgress());
    const m = migrateReticles({ kills: { visor: 120 }, unlocked: ["diamond"] });
    expect(m.unlocked).toEqual(expect.arrayContaining(["dot", "ring-dot", "cross", "diamond", "cross-dot", "mildot"]));
  });

  it("lo que se ve: la elegida si está desbloqueada; si no, la de la óptica; sin óptica, ninguna", () => {
    const un = new Set(["dot", "ring-dot", "cross", "diamond"]);
    expect(reticleShown("k-att-reddot-east", "dot", "diamond", un)).toBe("diamond");
    expect(reticleShown("k-att-reddot-east", "dot", "mildot", un)).toBe("dot");
    expect(reticleShown(null, "irons", "diamond", un)).toBe("");
    expect(cleanChoice({ reticle: "nope", reticleColor: "rosa" })).toEqual({ reticle: undefined, reticleColor: undefined });
    expect(selectorOrder(newReticleProgress()).slice(0, 3).every((x) => !x.locked)).toBe(true);
  });
});
