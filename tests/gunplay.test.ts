import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { solveTwoBone, ARM_DATA } from "../src/game/arms";
import { RELOAD_PHASES, phaseAt, recoilPattern } from "../src/game/gun";

describe("brazos (IK de dos huesos)", () => {
  it("el codo respeta las longitudes y la mano llega al objetivo alcanzable", () => {
    const S = ARM_DATA.shoulderR, a = ARM_DATA.upper, b = ARM_DATA.fore;
    for (let i = 0; i < 200; i++) {
      const T = S.clone().add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, -Math.random()).normalize().multiplyScalar(0.1 + Math.random() * 0.45));
      const E = solveTwoBone(S, T, a, b, ARM_DATA.poleR);
      expect(E.distanceTo(S)).toBeCloseTo(a, 4);
      if (T.distanceTo(S) < a + b && T.distanceTo(S) > Math.abs(a - b)) expect(E.distanceTo(T)).toBeCloseTo(b, 3);
    }
  });
});

describe("recarga por fases", () => {
  it("las fases cubren toda la recarga en orden y con nombre", () => {
    expect(RELOAD_PHASES.reduce((s, [, d]) => s + d, 0)).toBeCloseTo(1, 5);
    const seen: string[] = [];
    for (let p = 0; p <= 1; p += 0.01) { const { id } = phaseAt(RELOAD_PHASES, p); if (seen[seen.length - 1] !== id) seen.push(id); }
    expect(seen).toEqual(RELOAD_PHASES.map(([id]) => id));
  });
});

describe("retroceso", () => {
  it("cada arma tiene su patrón, determinista y con subida dominante", () => {
    const a = recoilPattern(123), b = recoilPattern(123), c = recoilPattern(456);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    for (const [v] of a) expect(v).toBeGreaterThan(0.7);
  });
});
