import { describe, expect, it } from "vitest";
import {
  HAND_PATH_CLASSES, ORIENT_MAX, gripAt, handPathAt, hasHandPath, hasSequence, poseSeed, sequenceOrientAt,
  sequencePathAt, sequencePhases, type HandAnchors, type HandSequence, type V3, type V4,
} from "../src/game/handpath";

const A: HandAnchors = { rest: [0.12, -0.04, 0], mag: [0.10, -0.24, 0] };
// Pistolas: `far` es la cartuchera (punto bajo) y `high` la corredera; el revólver mantiene el cargador como ancla.
const H: HandAnchors = { rest: [0.10, -0.05, 0], mag: [0.09, -0.14, 0], far: [0.08, -0.33, 0.02], high: [0.18, 0.08, 0] };
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const at = (f: number, id: string | number = 1) => handPathAt("rifle", f, A, id)!;
const seqAt = (clase: string, seq: HandSequence, f: number, id: string | number = 1, anclas: HandAnchors = H) =>
  sequencePathAt(clase, seq, f, anclas, id)!;

describe("poses reales de la recarga (fusil)", () => {
  it("solo las clases con datos usan recorrido real; el resto conserva el camino procedural", () => {
    expect(hasHandPath("rifle")).toBe(true);
    expect(HAND_PATH_CLASSES).toContain("rifle");
    for (const c of ["launcher", "flamethrower"]) expect(hasHandPath(c)).toBe(false);
    expect(handPathAt("launcher", 0.5, A, 1)).toBeNull();
  });

  it("empieza y termina en el agarre de reposo (la mano termina donde empezó)", () => {
    for (const id of [1, 2, 3, "arma-a", 123456]) {
      const a = at(0, id), b = at(1, id);
      expect(dist(a.pos, b.pos)).toBeLessThan(1e-6);
      expect(dist(a.pos, A.rest)).toBeLessThan(0.03); // solo el desplazamiento del agarre (±1,5 cm por eje)
      expect(dist(b.pos, A.rest)).toBeLessThan(0.03);
    }
  });

  it("pasa por el cargador (magwell) a mitad de la recarga", () => {
    for (const id of [1, 2, 3, 7, 42, "x"]) expect(dist(at(0.5, id).pos, A.mag)).toBeLessThan(1e-6);
  });

  it("la misma arma da siempre el mismo recorrido y dos armas distintas no", () => {
    for (const id of [1, 2, 555, "ak-1"]) {
      for (const f of [0, 0.2, 0.35, 0.6, 0.85, 1]) expect(at(f, id)).toEqual(at(f, id));
    }
    const pa = [0.2, 0.35, 0.6, 0.8].map((f) => at(f, 1).pos);
    const pb = [0.2, 0.35, 0.6, 0.8].map((f) => at(f, 2).pos);
    expect(pa.some((p, i) => dist(p, pb[i]) > 0.002)).toBe(true);
    expect(poseSeed("a")).not.toBe(poseSeed("b"));
  });

  it("la mano de apoyo se mueve de verdad y la función no toca nada fuera de ella", () => {
    const copia = JSON.parse(JSON.stringify(A));
    const p0 = at(0).pos, p5 = at(0.5).pos, p35 = at(0.35).pos;
    expect(dist(p0, p5)).toBeGreaterThan(0.1);
    expect(dist(p0, p35)).toBeGreaterThan(0.02);
    expect(A).toEqual(copia);
    const out = at(0.4);
    expect(Object.keys(out).sort()).toEqual(["curl", "pos"]); // solo la izquierda; la derecha no cambia
    expect(out.curl.fingers).toHaveLength(4);
    for (const c of [...out.curl.fingers, out.curl.thumb]) expect(c).toBeGreaterThanOrEqual(0);
    for (const c of [...out.curl.fingers, out.curl.thumb]) expect(c).toBeLessThanOrEqual(1.7);
  });

  it("si reposo y cargador coinciden no explota: devuelve el reposo", () => {
    const mismo: HandAnchors = { rest: [0.1, 0.1, 0.1], mag: [0.1, 0.1, 0.1] };
    const p = handPathAt("rifle", 0.5, mismo, 1)!;
    expect(dist(p.pos, mismo.rest)).toBeLessThan(0.03);
  });
});

describe("tanda A: pistolas y revólveres (recarga, sacar, inspeccionar, agarre)", () => {
  it("las dos clases tienen recarga, recarga vacía, sacar, inspeccionar y reposo", () => {
    for (const clase of ["pistol", "revolver"]) {
      expect(hasHandPath(clase)).toBe(true);
      for (const s of ["reload", "reload_empty", "draw", "inspect", "idle"] as HandSequence[]) expect(hasSequence(clase, s), `${clase} ${s}`).toBe(true);
      expect(HAND_PATH_CLASSES).toContain(clase);
    }
  });

  it("la recarga vuelve al reposo y pasa por su ancla central (cargadera o cartuchera)", () => {
    for (const id of [1, 2, 3, "pistola-a"]) {
      const p0 = seqAt("pistol", "reload", 0, id), p1 = seqAt("pistol", "reload", 1, id);
      expect(dist(p0.pos, p1.pos)).toBeLessThan(1e-6);
      expect(dist(p0.pos, H.rest)).toBeLessThan(0.03);
      expect(dist(seqAt("pistol", "reload", 0.5, id).pos, H.far)).toBeLessThan(1e-6);
      expect(dist(seqAt("pistol", "reload_empty", 0.5, id).pos, H.far)).toBeLessThan(1e-6);
      expect(dist(seqAt("revolver", "reload", 0.5, id).pos, H.mag)).toBeLessThan(1e-6);
      expect(dist(seqAt("revolver", "reload", 0, id).pos, H.rest)).toBeLessThan(0.03);
    }
  });

  it("sacar entra desde abajo y termina en el reposo; inspeccionar sube y vuelve al reposo", () => {
    for (const clase of ["pistol", "revolver"]) {
      const d0 = seqAt(clase, "draw", 0), d1 = seqAt(clase, "draw", 1);
      expect(dist(d0.pos, H.far)).toBeLessThan(1e-6);
      expect(dist(d1.pos, H.rest)).toBeLessThan(0.03);
      const i0 = seqAt(clase, "inspect", 0), i1 = seqAt(clase, "inspect", 1);
      expect(dist(i0.pos, H.rest)).toBeLessThan(0.03);
      expect(dist(i1.pos, H.high!)).toBeLessThan(1e-6);
      expect(dist(i0.pos, i1.pos)).toBeGreaterThan(0.08);
    }
  });

  it("el reposo devuelve exactamente el ancla (agarre quieto)", () => {
    for (const clase of ["pistol", "revolver"]) expect(seqAt(clase, "idle", 0.5).pos).toEqual(H.rest);
  });

  it("es determinista por semilla y distinto entre armas, también en las secuencias nuevas", () => {
    for (const clase of ["pistol", "revolver"]) {
      for (const s of ["reload", "draw", "inspect"] as HandSequence[]) {
        for (const f of [0.15, 0.4, 0.7]) expect(seqAt(clase, s, f, "arma-1")).toEqual(seqAt(clase, s, f, "arma-1"));
        const a = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 1).pos);
        const b = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 2).pos);
        expect(a.some((p, i) => dist(p, b[i]) > 0.002), `${clase} ${s}`).toBe(true);
      }
    }
  });

  it("las fases guardadas son contiguas, monótonas y cubren 0..1", () => {
    for (const clase of ["pistol", "revolver"]) {
      for (const s of ["reload", "draw", "inspect"] as HandSequence[]) {
        const f = sequencePhases(clase, s)!;
        expect(f.length).toBeGreaterThan(1);
        expect(f[0].t0).toBe(0);
        expect(f[f.length - 1].t1).toBe(1);
        for (let i = 0; i < f.length; i++) {
          expect(f[i].t0).toBeLessThanOrEqual(f[i].t1);
          if (i) expect(f[i].t0).toBeCloseTo(f[i - 1].t1, 6);
        }
      }
    }
  });

  it("el agarre a dos manos sale del reposo de la referencia y no abre la mano", () => {
    for (const clase of ["pistol", "revolver"]) {
      const g = gripAt(clase, H, 7)!;
      expect(g).toBeTruthy();
      expect(Math.hypot(...g.offset)).toBeCloseTo(0.034, 5);
      expect(g.offset.every(Number.isFinite)).toBe(true);
      expect(g.curl.fingers).toHaveLength(4);
      for (const c of [...g.curl.fingers, g.curl.thumb]) { expect(c).toBeGreaterThanOrEqual(0.12); expect(c).toBeLessThanOrEqual(1.35); }
      expect(gripAt("smg", H, 7)).toBeNull();
    }
  });
});

// Giro de muñeca de la referencia: llega como diferencia respecto al reposo de la secuencia (el disco negro del
// manguito era la mano girada con el puño de frente a la cámara; sin este dato solo se movía la posición).
describe("tanda A (corrección): orientación de muñeca de las referencias", () => {
  const angulo = (q: V4) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
  const q = (clase: string, seq: HandSequence, f: number, id: string | number = 1) => sequenceOrientAt(clase, seq, f, H, id);

  it("las secuencias con recorrido traen un giro unitario, determinista y limitado", () => {
    for (const clase of ["pistol", "revolver"]) {
      for (const s of ["reload", "reload_empty", "draw", "inspect"] as HandSequence[]) {
        for (const f of [0.15, 0.5, 0.85]) {
          const r = q(clase, s, f, 3)!;
          expect(r, `${clase} ${s} ${f}`).toBeTruthy();
          expect(Math.hypot(...r)).toBeCloseTo(1, 6);
          expect(angulo(r)).toBeLessThanOrEqual(ORIENT_MAX + 1e-6);
          expect(q(clase, s, f, 3)).toEqual(r);
        }
      }
    }
    expect(q("launcher", "reload", 0.5)).toBeNull(); // sin dato: la mano se queda con la orientación de siempre
    expect(q("pistol", "idle", 0.5)).toBeNull(); // el reposo no trae giro propio (lo pone el agarre)
  });

  it("en el reposo de la recarga no gira (la mano vuelve a su orientación neutra)", () => {
    for (const clase of ["pistol", "revolver"]) {
      for (const f of [0, 1]) expect(angulo(q(clase, "reload", f)), `${clase} ${f}`).toBeLessThan(0.02);
    }
  });

  it("distingue armas de la misma clase y no toca las posiciones del recorrido", () => {
    for (const clase of ["pistol", "revolver"]) {
      const a = [0.2, 0.45, 0.8].map((f) => q(clase, "reload", f, 1)!);
      const b = [0.2, 0.45, 0.8].map((f) => q(clase, "reload", f, 2)!);
      const d = (p: V4, r: V4) => Math.hypot(p[0] - r[0], p[1] - r[1], p[2] - r[2], p[3] - r[3]);
      expect(a.some((x, i) => d(x, b[i]) > 0.002), clase).toBe(true);
    }
    // El contrato de `sequencePathAt` no cambia: solo posición y curvatura (los tests de arriba ya lo comprueban).
    const out = seqAt("pistol", "reload", 0.4);
    expect(Object.keys(out).sort()).toEqual(["curl", "pos"]);
  });
});

// Tanda B: escopetas (bombeo y cartuchos) y subfusiles. Misma técnica que la tanda A: recorrido y orientación de la
// referencia, ancla central a mitad de la recarga y variación determinista por arma.
describe("tanda B: escopetas y subfusiles (recarga, sacar, inspeccionar, agarre)", () => {
  it("las dos clases tienen recarga, recarga vacía, sacar, inspeccionar y reposo", () => {
    for (const clase of ["shotgun", "smg"]) {
      expect(hasHandPath(clase)).toBe(true);
      for (const s of ["reload", "reload_empty", "draw", "inspect", "idle"] as HandSequence[]) expect(hasSequence(clase, s), `${clase} ${s}`).toBe(true);
      expect(HAND_PATH_CLASSES).toContain(clase);
    }
  });

  it("la recarga vuelve al reposo y pasa por el cargador/ventana de carga a mitad", () => {
    for (const clase of ["shotgun", "smg"]) {
      for (const id of [1, 2, 3, `${clase}-a`]) {
        const p0 = seqAt(clase, "reload", 0, id), p1 = seqAt(clase, "reload", 1, id);
        expect(dist(p0.pos, p1.pos), `${clase} ${id}`).toBeLessThan(1e-6);
        expect(dist(p0.pos, H.rest)).toBeLessThan(0.03);
        expect(dist(seqAt(clase, "reload", 0.5, id).pos, H.mag), `${clase} ${id}`).toBeLessThan(1e-6);
        // La recarga vacía también termina en el reposo (es la que reengancha el cargador o monta el arma).
        expect(dist(seqAt(clase, "reload_empty", 1, id).pos, H.rest)).toBeLessThan(0.03);
      }
    }
  });

  it("sacar entra desde abajo y termina en el reposo; inspeccionar sube al cerrojo y vuelve", () => {
    for (const clase of ["shotgun", "smg"]) {
      const d0 = seqAt(clase, "draw", 0), d1 = seqAt(clase, "draw", 1);
      expect(dist(d0.pos, H.far!)).toBeLessThan(1e-6);
      expect(dist(d1.pos, H.rest)).toBeLessThan(0.03);
      const i0 = seqAt(clase, "inspect", 0), i1 = seqAt(clase, "inspect", 1);
      expect(dist(i0.pos, H.rest)).toBeLessThan(0.03);
      expect(dist(i1.pos, H.high!)).toBeLessThan(1e-6);
    }
  });

  it("es determinista por semilla, distinto entre armas y con giro de muñeca de la referencia", () => {
    const angulo = (q: V4) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
    for (const clase of ["shotgun", "smg"]) {
      for (const s of ["reload", "reload_empty", "draw", "inspect"] as HandSequence[]) {
        for (const f of [0.2, 0.45, 0.8]) {
          expect(seqAt(clase, s, f, "arma-1")).toEqual(seqAt(clase, s, f, "arma-1"));
          const r = sequenceOrientAt(clase, s, f, H, 3)!;
          expect(r, `${clase} ${s}`).toBeTruthy();
          expect(Math.hypot(...r)).toBeCloseTo(1, 6);
          expect(angulo(r)).toBeLessThanOrEqual(ORIENT_MAX + 1e-6);
        }
        const a = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 1).pos);
        const b = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 2).pos);
        expect(a.some((p, i) => dist(p, b[i]) > 0.002), `${clase} ${s}`).toBe(true);
      }
      // En los extremos de la recarga la muñeca vuelve a su orientación neutra.
      expect(angulo(sequenceOrientAt(clase, "reload", 0, H, 1)!)).toBeLessThan(0.02);
      expect(angulo(sequenceOrientAt(clase, "reload", 1, H, 1)!)).toBeLessThan(0.02);
      // El reposo devuelve exactamente el ancla.
      expect(seqAt(clase, "idle", 0.5).pos).toEqual(H.rest);
    }
  });

  it("las fases guardadas son contiguas, monótonas y cubren 0..1", () => {
    for (const clase of ["shotgun", "smg"]) {
      for (const s of ["reload", "reload_empty", "draw", "inspect"] as HandSequence[]) {
        const f = sequencePhases(clase, s)!;
        expect(f.length).toBeGreaterThan(1);
        expect(f[0].t0).toBe(0);
        expect(f[f.length - 1].t1).toBe(1);
        for (let i = 0; i < f.length; i++) {
          expect(f[i].t0).toBeLessThanOrEqual(f[i].t1);
          if (i) expect(f[i].t0).toBeCloseTo(f[i - 1].t1, 6);
        }
      }
    }
  });

  it("las armas largas no derivan el agarre a dos manos de las cortas", () => {
    expect(gripAt("shotgun", H, 7)).toBeNull();
    expect(gripAt("smg", H, 7)).toBeNull();
  });
});

// Tanda C: cerrojos (sniper), ametralladoras (lmg) y bullpup. Misma técnica: recorrido y orientación de la referencia,
// ancla del cargador a mitad de la recarga y variación determinista por arma.
describe("tanda C: cerrojos, ametralladoras y bullpup (recarga, sacar, inspeccionar, agarre)", () => {
  const CLASES_C: HandSequence[] = ["reload", "reload_empty", "draw", "inspect", "idle"];

  it("las tres clases tienen recarga, recarga vacía, sacar, inspeccionar y reposo", () => {
    for (const clase of ["sniper", "lmg", "bullpup"]) {
      expect(hasHandPath(clase)).toBe(true);
      for (const s of CLASES_C) expect(hasSequence(clase, s), `${clase} ${s}`).toBe(true);
      expect(HAND_PATH_CLASSES).toContain(clase);
    }
  });

  it("la recarga vuelve al reposo y pasa por el cargador a mitad", () => {
    for (const clase of ["sniper", "lmg", "bullpup"]) {
      for (const id of [1, 2, 3, `${clase}-a`]) {
        const p0 = seqAt(clase, "reload", 0, id), p1 = seqAt(clase, "reload", 1, id);
        expect(dist(p0.pos, p1.pos), `${clase} ${id}`).toBeLessThan(1e-6);
        expect(dist(p0.pos, H.rest)).toBeLessThan(0.03);
        expect(dist(seqAt(clase, "reload", 0.5, id).pos, H.mag), `${clase} ${id}`).toBeLessThan(1e-6);
        expect(dist(seqAt(clase, "reload_empty", 0.5, id).pos, H.mag), `${clase} empty ${id}`).toBeLessThan(1e-6);
        expect(dist(seqAt(clase, "reload_empty", 1, id).pos, H.rest), `${clase} empty ${id}`).toBeLessThan(0.03);
      }
    }
  });

  it("sacar entra desde abajo y termina en el reposo; inspeccionar sube al cerrojo y vuelve", () => {
    for (const clase of ["sniper", "lmg", "bullpup"]) {
      const d0 = seqAt(clase, "draw", 0), d1 = seqAt(clase, "draw", 1);
      expect(dist(d0.pos, H.far!), `${clase} draw`).toBeLessThan(1e-6);
      expect(dist(d1.pos, H.rest), `${clase} draw`).toBeLessThan(0.03);
      const i0 = seqAt(clase, "inspect", 0), i1 = seqAt(clase, "inspect", 1);
      expect(dist(i0.pos, H.rest), `${clase} inspect`).toBeLessThan(0.03);
      expect(dist(i1.pos, H.high!), `${clase} inspect`).toBeLessThan(1e-6);
    }
  });

  it("es determinista por semilla, distinto entre armas y con giro de muñeca de la referencia", () => {
    const angulo = (q: V4) => 2 * Math.acos(Math.min(1, Math.abs(q[3])));
    for (const clase of ["sniper", "lmg", "bullpup"]) {
      for (const s of ["reload", "reload_empty", "draw", "inspect"] as HandSequence[]) {
        for (const f of [0.2, 0.45, 0.8]) {
          expect(seqAt(clase, s, f, "arma-1")).toEqual(seqAt(clase, s, f, "arma-1"));
          const r = sequenceOrientAt(clase, s, f, H, 3)!;
          expect(r, `${clase} ${s}`).toBeTruthy();
          expect(Math.hypot(...r)).toBeCloseTo(1, 6);
          expect(angulo(r)).toBeLessThanOrEqual(ORIENT_MAX + 1e-6);
        }
        const a = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 1).pos);
        const b = [0.2, 0.45, 0.8].map((f) => seqAt(clase, s, f, 2).pos);
        expect(a.some((p, i) => dist(p, b[i]) > 0.002), `${clase} ${s}`).toBe(true);
      }
      // En los extremos de la recarga la muñeca vuelve a su orientación neutra y el reposo al ancla exacta.
      expect(angulo(sequenceOrientAt(clase, "reload", 0, H, 1)!)).toBeLessThan(0.02);
      expect(angulo(sequenceOrientAt(clase, "reload", 1, H, 1)!)).toBeLessThan(0.02);
      expect(seqAt(clase, "idle", 0.5).pos).toEqual(H.rest);
    }
  });

  it("las fases guardadas son contiguas, monótonas y cubren 0..1", () => {
    for (const clase of ["sniper", "lmg", "bullpup"]) {
      for (const s of ["reload", "reload_empty", "draw", "inspect"] as HandSequence[]) {
        const f = sequencePhases(clase, s)!;
        expect(f.length).toBeGreaterThan(1);
        expect(f[0].t0).toBe(0);
        expect(f[f.length - 1].t1).toBe(1);
        for (let i = 0; i < f.length; i++) {
          expect(f[i].t0).toBeLessThanOrEqual(f[i].t1);
          if (i) expect(f[i].t0).toBeCloseTo(f[i - 1].t1, 6);
        }
      }
    }
  });

  it("cerrojos, ametralladoras y bullpup no derivan el agarre a dos manos de las cortas", () => {
    for (const clase of ["sniper", "lmg", "bullpup"]) expect(gripAt(clase, H, 7)).toBeNull();
  });
});

