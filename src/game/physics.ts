// Físicas con Rapier (tarea 1, prototipo). Carga perezosa: el WASM solo se descarga e inicializa si se activa la física
// (`settings.physics`); desactivada, el juego no lo importa y el coste es cero. Paso fijo de 1/60 s con acumulador.
// Las piezas puras (acumulador, fuerza radial de las explosiones y límite cónico) están separadas para probarlas sin
// WASM (tests/physics.test.ts).
import type * as RAPIER_NS from "@dimforge/rapier3d-compat";

export type V3 = { x: number; y: number; z: number };
export const STEP = 1 / 60;
/** Máximo de pasos por fotograma (si el juego va muy lento, la física se ralentiza en vez de dispararse). */
export const MAX_STEPS = 4;

/** Acumulador de paso fijo: cuántos pasos de `step` toca dar con un `dt` variable, y la fracción sobrante. */
export class FixedStep {
  acc = 0;
  constructor(readonly step = STEP, readonly maxSteps = MAX_STEPS) {}
  /** Suma `dt` y devuelve los pasos a dar (como mucho `maxSteps`; el exceso se descarta para no entrar en espiral). */
  advance(dt: number): number {
    this.acc += Math.max(0, dt);
    let n = Math.floor(this.acc / this.step + 1e-9);
    if (n > this.maxSteps) { n = this.maxSteps; this.acc = 0; } else this.acc -= n * this.step;
    return n;
  }
  /** Fracción del siguiente paso ya acumulada (0..1), para interpolar el dibujo. */
  get alpha() { return this.acc / this.step; }
}

/**
 * Impulso de una explosión sobre un cuerpo en `p` (centro `c`, radio `r`, fuerza `f` en N·s a distancia 0): radial
 * hacia fuera con caída lineal hasta 0 en el borde, y un poco hacia arriba para que los objetos salten. null fuera
 * del radio.
 */
export function explosionImpulse(c: V3, r: number, f: number, p: V3, lift = 0.35): V3 | null {
  const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d = Math.hypot(dx, dy, dz);
  if (d >= r || r <= 0) return null;
  const k = f * (1 - d / r);
  // (en el centro exacto, hacia arriba)
  const n = d > 1e-6 ? { x: dx / d, y: dy / d, z: dz / d } : { x: 0, y: 1, z: 0 };
  const up = n.y + lift, len = Math.hypot(n.x, up, n.z);
  return { x: (n.x / len) * k, y: (up / len) * k, z: (n.z / len) * k };
}

/**
 * Límite cónico de una articulación esférica (cuello, hombro, cadera): ángulo entre el eje del hueso padre y el del
 * hijo, y si pasa de `max`, el exceso (rad) y el eje de giro para devolverlo dentro del cono. Rapier 0.21 no limita
 * las esféricas: se corrige con un impulso angular proporcional al exceso.
 */
export function coneExcess(parent: V3, child: V3, max: number): { angle: number; excess: number; axis: V3 } {
  const lp = Math.hypot(parent.x, parent.y, parent.z) || 1, lc = Math.hypot(child.x, child.y, child.z) || 1;
  const cos = Math.min(1, Math.max(-1, (parent.x * child.x + parent.y * child.y + parent.z * child.z) / (lp * lc)));
  const angle = Math.acos(cos);
  // eje = hijo × padre (girar el hijo hacia el padre)
  const ax = child.y * parent.z - child.z * parent.y, ay = child.z * parent.x - child.x * parent.z, az = child.x * parent.y - child.y * parent.x;
  const la = Math.hypot(ax, ay, az) || 1;
  return { angle, excess: Math.max(0, angle - max), axis: { x: ax / la, y: ay / la, z: az / la } };
}

type R = typeof RAPIER_NS;
export type Body = RAPIER_NS.RigidBody;

/** Mundo físico. `Physics.load()` descarga e inicializa Rapier una sola vez. */
export class Physics {
  private static ready: Promise<R> | null = null;
  /** Tiempo (ms) que tardó en cargar e inicializar Rapier (para el informe). */
  static loadMs = 0;
  static load(): Promise<R> {
    this.ready ??= (async () => {
      const t0 = performance.now();
      const R = (await import("@dimforge/rapier3d-compat")).default as unknown as R;
      await R.init();
      Physics.loadMs = performance.now() - t0;
      return R;
    })();
    return this.ready;
  }

  readonly world: RAPIER_NS.World;
  private clock = new FixedStep();
  /** Duración (ms) del último paso (para medir el coste). */
  lastStepMs = 0;
  constructor(readonly R: R) {
    this.world = new R.World({ x: 0, y: -9.8, z: 0 });
    this.world.timestep = STEP;
  }
  /** Suelo infinito (plano en y = 0) y cajas estáticas de la escena. */
  addGround(y = 0) { const b = this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(0, y - 0.5, 0)); this.world.createCollider(this.R.ColliderDesc.cuboid(500, 0.5, 500).setFriction(0.9), b); }
  addStaticBox(center: V3, half: V3) { const b = this.world.createRigidBody(this.R.RigidBodyDesc.fixed().setTranslation(center.x, center.y, center.z)); this.world.createCollider(this.R.ColliderDesc.cuboid(half.x, half.y, half.z), b); }

  private dyn(p: V3, q?: { x: number; y: number; z: number; w: number }, damp = 0.05) {
    const d = this.R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinearDamping(damp).setAngularDamping(0.6).setCcdEnabled(true);
    if (q) d.setRotation(q);
    return this.world.createRigidBody(d);
  }
  box(p: V3, half: V3, density = 1, q?: { x: number; y: number; z: number; w: number }) { const b = this.dyn(p, q); this.world.createCollider(this.R.ColliderDesc.cuboid(half.x, half.y, half.z).setDensity(density).setFriction(0.8), b); return b; }
  sphere(p: V3, r: number, density = 1) { const b = this.dyn(p); this.world.createCollider(this.R.ColliderDesc.ball(r).setDensity(density), b); return b; }
  /** Cápsula a lo largo del eje Y local (semialtura del tramo recto y radio). */
  capsule(p: V3, halfH: number, r: number, density = 1, q?: { x: number; y: number; z: number; w: number }) { const b = this.dyn(p, q, 0.1); this.world.createCollider(this.R.ColliderDesc.capsule(halfH, r).setDensity(density).setFriction(0.9), b); return b; }
  /** Cilindro (barriles). */
  cylinder(p: V3, halfH: number, r: number, density = 1) { const b = this.dyn(p); this.world.createCollider(this.R.ColliderDesc.cylinder(halfH, r).setDensity(density).setFriction(0.7), b); return b; }

  /** Articulación esférica (anclas en el marco local de cada cuerpo). */
  spherical(a: Body, b: Body, aa: V3, ab: V3) { const j = this.world.createImpulseJoint(this.R.JointData.spherical(aa, ab), a, b, true); j.setContactsEnabled(false); return j; }
  /** Grupos de colisión: los cuerpos de un ragdoll (grupo 2) chocan con el mundo (grupo 1) pero no entre sí. */
  static readonly RAGDOLL_GROUPS = (0x0002 << 16) | 0x0001;
  setGroups(b: Body, groups: number) { for (let i = 0; i < b.numColliders(); i++) b.collider(i).setCollisionGroups(groups); }
  /** Bisagra con límites (rad) alrededor de `axis` (en el marco de cada cuerpo). */
  hinge(a: Body, b: Body, aa: V3, ab: V3, axis: V3, min: number, max: number) {
    const j = this.world.createImpulseJoint(this.R.JointData.revolute(aa, ab, axis), a, b, true) as RAPIER_NS.RevoluteImpulseJoint;
    j.setLimits(min, max); j.setContactsEnabled(false); return j;
  }
  remove(b: Body) { this.world.removeRigidBody(b); }

  /** Impulso en un punto (disparo). */
  applyImpulse(b: Body, imp: V3, at?: V3) { if (at) b.applyImpulseAtPoint(imp, at, true); else b.applyImpulse(imp, true); }
  /** Explosión: a todos los cuerpos dinámicos dentro del radio, un cambio de velocidad radial (`f` m/s en el centro)
   *  con caída lineal: igual de vistoso en una caja que en un cuerpo (el impulso es la masa por la velocidad). */
  applyExplosion(c: V3, r: number, f: number) {
    this.world.forEachRigidBody((b) => {
      if (!b.isDynamic()) return;
      const imp = explosionImpulse(c, r, f * b.mass(), b.translation()); if (imp) b.applyImpulse(imp, true);
    });
  }
  /** Rayo: primer cuerpo alcanzado, distancia y punto. */
  raycast(o: V3, dir: V3, max: number): { body: Body; toi: number; point: V3 } | null {
    const h = this.world.castRay(new this.R.Ray(o, dir), max, true); if (!h) return null;
    const body = h.collider.parent(); if (!body) return null;
    return { body, toi: h.timeOfImpact, point: { x: o.x + dir.x * h.timeOfImpact, y: o.y + dir.y * h.timeOfImpact, z: o.z + dir.z * h.timeOfImpact } };
  }
  /** Avanza con paso fijo; `beforeStep` se llama antes de cada paso (límites cónicos de los ragdolls). */
  update(dt: number, beforeStep?: () => void) {
    const n = this.clock.advance(dt); if (!n) return 0;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { beforeStep?.(); this.world.step(); }
    this.lastStepMs = (performance.now() - t0) / n;
    return n;
  }
}
