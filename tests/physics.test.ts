import { describe, expect, it } from "vitest";
import { FixedStep, MAX_STEPS, Physics, STEP, coneExcess, explosionImpulse } from "../src/game/physics";
import { SKELETON, planRagdoll, type SegId } from "../src/game/ragdoll";
import { physicsEnabled } from "../src/game/physworld";

describe("física: piezas puras (tarea 1)", () => {
  it("acumulador de paso fijo: pasos enteros, resto guardado y tope sin espiral", () => {
    const c = new FixedStep();
    expect(c.advance(STEP * 0.5)).toBe(0);
    expect(c.advance(STEP * 0.5)).toBe(1);
    expect(c.advance(STEP * 2.25)).toBe(2); expect(c.alpha).toBeCloseTo(0.25, 6);
    expect(c.advance(1)).toBe(MAX_STEPS); expect(c.acc).toBe(0); // (fotograma larguísimo: tope y se descarta el resto)
    expect(c.advance(-1)).toBe(0);
    // 1 s a 60 fps = 60 pasos
    const d = new FixedStep(); let n = 0; for (let i = 0; i < 60; i++) n += d.advance(1 / 60); expect(n).toBe(60);
  });

  it("explosión: radial hacia fuera, cae linealmente con la distancia y nada fuera del radio", () => {
    const c = { x: 0, y: 0, z: 0 };
    const near = explosionImpulse(c, 5, 10, { x: 1, y: 0, z: 0 })!, far = explosionImpulse(c, 5, 10, { x: 4, y: 0, z: 0 })!;
    expect(near.x).toBeGreaterThan(0); expect(near.y).toBeGreaterThan(0); // (hacia fuera y algo hacia arriba)
    const mag = (v: { x: number; y: number; z: number }) => Math.hypot(v.x, v.y, v.z);
    expect(mag(near)).toBeCloseTo(10 * (1 - 1 / 5), 6); expect(mag(far)).toBeCloseTo(10 * (1 - 4 / 5), 6);
    expect(explosionImpulse(c, 5, 10, { x: 6, y: 0, z: 0 })).toBeNull();
    expect(mag(explosionImpulse(c, 5, 10, c)!)).toBeCloseTo(10, 6); // (en el centro: hacia arriba)
  });

  it("límite cónico: dentro no hay exceso; fuera, el exceso y el eje que lo corrige", () => {
    expect(coneExcess({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 0.5).excess).toBe(0);
    const c = coneExcess({ x: 0, y: 1, z: 0 }, { x: 1, y: 0, z: 0 }, 0.5);
    expect(c.angle).toBeCloseTo(Math.PI / 2, 6); expect(c.excess).toBeCloseTo(Math.PI / 2 - 0.5, 6);
    // girar el hijo (x) alrededor del eje lo acerca al padre (y)
    expect(c.axis.z).toBeCloseTo(1, 6);
  });

  it("ragdoll: los segmentos arrancados (y lo que cuelga de ellos) se quedan fuera", () => {
    const all = new Set<SegId>(["torso", "head", "armL", "foreL", "armR", "foreR", "thighL", "shinL", "thighR", "shinR"]);
    const full = planRagdoll(all, new Set());
    expect(full.segs).toHaveLength(10); expect(full.joints).toHaveLength(9); expect(full.dropped).toEqual([]);
    const noHead = planRagdoll(all, new Set<SegId>(["head"]));
    expect(noHead.segs).not.toContain("head"); expect(noHead.joints.some((j) => j.child === "head")).toBe(false);
    const noArm = planRagdoll(all, new Set<SegId>(["armR"]));
    expect(noArm.segs).not.toContain("armR"); expect(noArm.segs).not.toContain("foreR"); expect(noArm.dropped.sort()).toEqual(["armR", "foreR"]);
    expect(planRagdoll(all, new Set<SegId>(["torso"])).segs).toEqual([]);
    // codos y rodillas son bisagras; cuello, hombros y caderas, esféricas con cono
    for (const j of SKELETON) { if (/fore|shin/.test(j.child)) expect(j.kind).toBe("hinge"); else { expect(j.kind).toBe("sphere"); expect(j.cone).toBeGreaterThan(0); } }
  });

  it("interruptor: sin fijar sigue al modo desarrollador", () => {
    expect(physicsEnabled({ dev: false })).toBe(false); expect(physicsEnabled({ dev: true })).toBe(true);
    expect(physicsEnabled({ dev: true, physics: false })).toBe(false); expect(physicsEnabled({ dev: false, physics: true })).toBe(true);
  });
});

describe("física: Rapier de verdad", () => {
  it("la bisagra respeta sus límites y la explosión empuja hacia fuera", async () => {
    const ph = new Physics(await Physics.load()); ph.addGround(0);
    // Brazo fijo en el aire y antebrazo con codo limitado a [-0,5, 0]: cae por gravedad y no pasa del límite
    const upper = ph.world.createRigidBody(ph.R.RigidBodyDesc.fixed().setTranslation(0, 2, 0));
    ph.world.createCollider(ph.R.ColliderDesc.capsule(0.15, 0.05), upper);
    const fore = ph.capsule({ x: 0, y: 1.6, z: 0 }, 0.15, 0.05);
    ph.hinge(upper, fore, { x: 0, y: -0.2, z: 0 }, { x: 0, y: 0.2, z: 0 }, { x: 1, y: 0, z: 0 }, -0.5, 0);
    ph.applyImpulse(fore, { x: 0, y: 0, z: 2 });
    for (let i = 0; i < 120; i++) ph.update(STEP);
    const q = fore.rotation(), ang = 2 * Math.atan2(q.x, q.w);
    expect(ang).toBeGreaterThan(-0.5 - 0.08); expect(ang).toBeLessThan(0 + 0.08);
    const box = ph.box({ x: 2, y: 0.25, z: 0 }, { x: 0.25, y: 0.25, z: 0.25 });
    ph.applyExplosion({ x: 0, y: 0.1, z: 0 }, 5, 9);
    for (let i = 0; i < 10; i++) ph.update(STEP);
    expect(box.linvel().x).toBeGreaterThan(0.3);
    expect(Physics.loadMs).toBeGreaterThan(0);
  });
});
