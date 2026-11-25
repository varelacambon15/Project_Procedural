// Encargo 51: encuadre del arma en cadera como en los FPS de referencia. Parámetros por clase (guiñada y cabeceo de
// cadera, que se anulan al apuntar) y proyección pura de puntos con la cámara del viewmodel.
import { describe, expect, it } from "vitest";
import { ANIM_CLASSES, ViewAnimator, VM_FOV, animParams, hipAngles, type AnimInput } from "../src/game/anim";
import { projectPoint, projectedSize, type VmCorner } from "../src/game/vmfit";

const idle = (o: Partial<AnimInput> = {}): AnimInput => ({ dt: 1 / 60, time: 0, ads: 0, moving: 0, sprinting: false, grounded: true, vy: 0, lookX: 0, lookY: 0, length: 0.9, sightY: 0.05, reload: null, draw: 0, holster: 0, inspect: null, cycle: null, empty: false, ...o });
const DEG = Math.PI / 180;
const ASPECT = 16 / 9;

describe("parámetros de encuadre en cadera (encargo 51)", () => {
  it("todas las clases convergen 8–12° hacia el centro y cabecean 2–4° hacia arriba", () => {
    for (const c of ANIM_CLASSES) {
      const p = animParams(c);
      expect(p.hipYaw!, c).toBeGreaterThanOrEqual(8 * DEG - 1e-9);
      expect(p.hipYaw!, c).toBeLessThanOrEqual(12 * DEG + 1e-9);
      expect(p.hipPitch!, c).toBeGreaterThanOrEqual(2 * DEG - 1e-9);
      expect(p.hipPitch!, c).toBeLessThanOrEqual(4 * DEG + 1e-9);
      expect(p.hipRoll ?? 0, c).toBeLessThan(0.15); // (alabeo suave, nunca una barrena)
    }
  });

  it("el giro de cadera se desvanece al apuntar: ADS no cambia", () => {
    const p = animParams("rifle");
    const hip = hipAngles(p, 0), ads = hipAngles(p, 1);
    expect(hip[1]).toBeCloseTo(p.hipYaw!, 12);
    expect(hip[0]).toBeCloseTo(p.hipPitch!, 12);
    for (const a of ads) expect(a).toBeCloseTo(0, 12);
  });

  it("la pose en cadera lleva la guiñada y el cabeceo; al apuntar, cero", () => {
    const a = new ViewAnimator(); a.setClass("rifle");
    const hip = a.update(idle());
    expect(hip.rot[1]).toBeCloseTo(animParams("rifle").hipYaw!, 6);
    expect(hip.rot[0]).toBeCloseTo(animParams("rifle").hipPitch!, 6);
    for (let i = 0; i < 120; i++) a.update(idle({ ads: 1 }));
    const ads = a.update(idle({ ads: 1 }));
    expect(Math.abs(ads.rot[1])).toBeLessThan(1e-6);
    expect(Math.abs(ads.rot[0])).toBeLessThan(1e-6);
  });

  it("la empuñadura arranca abajo a la derecha (x > 0, y < 0) en todas las clases", () => {
    for (const c of ANIM_CLASSES) {
      const a = new ViewAnimator(); a.setClass(c);
      const p = a.hipBase({ length: 0.9, gripX: -0.1, gripY: -0.05, bulk: 0.25 });
      expect(p[0], c).toBeGreaterThan(0.1);
      expect(p[1], c).toBeLessThan(0);
    }
  });
});

describe("proyección pura del encuadre (encargo 51)", () => {
  it("un punto en el centro de la vista cae en el centro de la pantalla", () => {
    expect(projectPoint([0, 0, -1], VM_FOV, ASPECT)).toEqual([0.5, 0.5]);
    expect(projectPoint([0, 0, 1], VM_FOV, ASPECT)).toBeNull(); // (detrás de la cámara)
    expect(projectPoint([NaN, 0, -1], VM_FOV, ASPECT)).toBeNull();
  });

  it("coincide con projectedSize: las 8 esquinas de una caja dan el mismo ancho y alto", () => {
    const corners: VmCorner[] = [];
    for (let c = 0; c < 8; c++) corners.push([c & 1 ? 0.3 : -0.2, c & 2 ? 0.24 : -0.1, c & 4 ? -0.9 : -0.4]);
    const pts = corners.map((p) => projectPoint(p, VM_FOV, ASPECT)!);
    const w = (Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0])));
    const h = (Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])));
    const size = projectedSize(corners, VM_FOV, ASPECT);
    expect(w).toBeCloseTo(size.w, 9);
    expect(h).toBeCloseTo(size.h, 9);
  });

  it("con guiñada y cabeceo de cadera la boca queda a la izquierda y por encima de la empuñadura", () => {
    for (const c of ANIM_CLASSES) {
      const p = animParams(c), yaw = p.hipYaw!, pitch = p.hipPitch!;
      const grip: VmCorner = [0.12, -0.1, -0.3];
      // Dirección de la boca (modelo +X → -Z de la cámara) girada por el cabeceo y la guiñada de cadera.
      const L = 0.45;
      const dir: VmCorner = [-Math.sin(yaw), Math.cos(yaw) * Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
      const muzzle: VmCorner = [grip[0] + L * dir[0], grip[1] + L * dir[1], grip[2] + L * dir[2]];
      const g = projectPoint(grip, VM_FOV, ASPECT)!, m = projectPoint(muzzle, VM_FOV, ASPECT)!;
      expect(m[0], c).toBeLessThan(g[0]); // (converge hacia el centro, desde la derecha)
      expect(m[1], c).toBeLessThan(g[1]); // (cabecea hacia arriba)
    }
  });
});
