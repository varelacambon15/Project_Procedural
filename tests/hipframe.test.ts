import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { screenRay, silhouette, solveHip, solveHipFit, toScreen, type FrameTarget } from "../src/game/hipframe";
import { animParams, ANIM_CLASSES } from "../src/game/anim";

const FOV = 62, BACK = 0.03;
/** Lleva un punto del soporte a la cámara del arma con la pose resuelta. */
const place = (p: THREE.Vector3, sol: { pos: number[]; rot: number[] }) => {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(sol.rot[0], sol.rot[1], sol.rot[2], "XYZ"));
  return p.clone().applyQuaternion(q).add(new THREE.Vector3(sol.pos[0], sol.pos[1], sol.pos[2] - BACK));
};

describe("encuadre en cadera por objetivos en pantalla (tarea 13)", () => {
  it("rayo y proyección son inversos", () => {
    for (const [x, y] of [[0.5, 0.5], [0.8, 0.9], [0.1, 0.2]]) {
      const s = toScreen(screenRay(x, y, FOV, 16 / 9).multiplyScalar(0.4), FOV, 16 / 9);
      expect(s[0]).toBeCloseTo(x, 6); expect(s[1]).toBeCloseTo(y, 6);
    }
  });

  it("armas largas: empuñadura y boca caen en sus objetivos, a la distancia pedida, en cualquier aspecto", () => {
    const tg: FrameTarget = { grip: [0.81, 0.91], muzzle: [0.56, 0.55], depth: 0.36 };
    for (const aspect of [960 / 470, 16 / 9, 4 / 3])
      for (const [g, m] of [[new THREE.Vector3(0, -0.04, 0.05), new THREE.Vector3(0, 0.02, -0.55)], [new THREE.Vector3(0.01, -0.06, 0.1), new THREE.Vector3(0, 0, -0.9)]]) {
        const sol = solveHip(g, m, tg, FOV, aspect, BACK);
        const gs = toScreen(place(g, sol), FOV, aspect), ms = toScreen(place(m, sol), FOV, aspect);
        expect(gs[0]).toBeCloseTo(0.81, 4); expect(gs[1]).toBeCloseTo(0.91, 4);
        expect(ms[0]).toBeCloseTo(0.56, 4); expect(ms[1]).toBeCloseTo(0.55, 4);
        expect(place(g, sol).length()).toBeCloseTo(0.36, 4);
        // el cañón va hacia delante (la boca más lejos que la empuñadura) y sin dar la vuelta (alabeo pequeño)
        expect(place(m, sol).z).toBeLessThan(place(g, sol).z);
        expect(Math.abs(sol.rot[2])).toBeLessThan(0.5);
      }
  });

  it("armas cortas: el eje del cañón sigue la dirección pedida (no el vector empuñadura→boca)", () => {
    const tg: FrameTarget = { grip: [0.66, 0.84], muzzle: [0.6, 0.56], aim: [0.33, 0.12], depth: 0.36 };
    const g = new THREE.Vector3(0, -0.06, 0.03), m = new THREE.Vector3(0, 0.02, -0.15);
    const sol = solveHip(g, m, tg, FOV, 16 / 9, BACK);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(sol.rot as [number, number, number]), "XYZ"));
    const bore = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    const want = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0.33, 0.12, 0, "YXZ"));
    expect(bore.angleTo(want)).toBeLessThan(1e-4);
    const gs = toScreen(place(g, sol), FOV, 16 / 9);
    expect(gs[0]).toBeCloseTo(0.66, 4); expect(gs[1]).toBeCloseTo(0.84, 4);
  });

  it("las voluminosas se alejan en proporción a su grosor, sin mover la mano de sitio en pantalla", () => {
    const tg: FrameTarget = { grip: [0.81, 0.92], muzzle: [0.56, 0.57], depth: 0.38 };
    const g = new THREE.Vector3(0, -0.05, 0.05), m = new THREE.Vector3(0, 0.02, -0.75);
    const lim = { bulk: 0.24, depthMax: 0.65 };
    expect(solveHipFit(0.2, g, m, tg, lim, FOV, 16 / 9, BACK).depth).toBeCloseTo(0.38, 6); // (normal: la de la clase)
    const fat = solveHipFit(0.36, g, m, tg, lim, FOV, 16 / 9, BACK);
    expect(fat.depth).toBeCloseTo(0.38 * 0.36 / 0.24, 6);
    expect(solveHipFit(0.9, g, m, tg, lim, FOV, 16 / 9, BACK).depth).toBe(0.65); // (con tope)
    const gs = toScreen(place(g, fat), FOV, 16 / 9), ms = toScreen(place(m, fat), FOV, 16 / 9);
    expect(gs[0]).toBeCloseTo(0.81, 4); expect(gs[1]).toBeCloseTo(0.92, 4);
    expect(ms[0]).toBeCloseTo(0.56, 4); expect(ms[1]).toBeCloseTo(0.57, 4);
  });

  it("la silueta se mide recortada a la pantalla", () => {
    const pts = [new THREE.Vector3(-0.05, -0.05, -0.3), new THREE.Vector3(0.05, 0.05, -0.3)];
    const s = silhouette(pts, { pos: [0, 0, 0], rot: [0, 0, 0] }, FOV, 1, 0);
    expect(s.w).toBeCloseTo(0.1 / 0.3 / Math.tan((FOV * Math.PI) / 360) / 2, 4);
  });

  it("todas las clases jugables tienen objetivos de encuadre coherentes con las referencias", () => {
    for (const c of ANIM_CLASSES) {
      const f = animParams(c).frame!;
      expect(f, c).toBeDefined();
      // mano derecha abajo a la derecha; boca en el centro-derecha (referencias: x 0,50–0,62, y 0,45–0,60)
      expect(f.grip[0]).toBeGreaterThan(0.6); expect(f.grip[1]).toBeGreaterThan(0.78);
      if (!f.aim) { expect(f.muzzle[0]).toBeGreaterThanOrEqual(0.5); expect(f.muzzle[0]).toBeLessThanOrEqual(0.62); expect(f.muzzle[1]).toBeGreaterThanOrEqual(0.45); expect(f.muzzle[1]).toBeLessThanOrEqual(0.6); }
      expect(f.depth).toBeGreaterThan(0.25); expect(f.depthMax).toBeGreaterThanOrEqual(f.depth);
    }
  });
});
