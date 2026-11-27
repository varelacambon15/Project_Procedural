// Lógica pura de los enemigos nuevos (tarea 2): sin three ni DOM, para probarla con Vitest (tests/enemyai.test.ts).
// Sabueso: rodea al jugador por un flanco y se abalanza con aviso. Dron reparador: elige al aliado más herido.
// Centinela: gira despacio (se le puede rodear para esquivar su escudo) y carga cada disparo con aviso.

export type P2 = { x: number; z: number };

/**
 * Punto al que corre un sabueso: lejos, no va en línea recta sino abierto hacia un flanco (`side` = ±1), tanto más
 * cuanto más lejos está; a menos de `close` m va casi directo (solo 0,8 m de lado).
 */
export function flankPoint(self: P2, target: P2, side: number, close = 5): P2 {
  const dx = target.x - self.x, dz = target.z - self.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return { x: target.x, z: target.z };
  // perpendicular a la línea que les une, del lado elegido (cerca, solo un poco: dos sabuesos no acaban en el mismo
  // sitio, cada uno muerde por su lado)
  const px = -dz / d * side, pz = dx / d * side, off = d <= close ? Math.min(0.8, d * 0.2) : Math.min(4.5, 0.8 + (d - close) * 0.45);
  return { x: target.x + px * off, z: target.z + pz * off };
}

/** Candidato a curar: posición, vida perdida (0..1), si vive y si es el propio curador. */
export interface HealCand { x: number; z: number; hurt: number; alive: boolean; self?: boolean }
/** Índice del aliado que cura un reparador (o un médico): vivo, herido (> 2 %), a menos de `reach` m; el más herido. -1 si no hay. */
export function pickHealTarget(from: P2, cands: readonly HealCand[], reach = 11): number {
  let best = -1, worst = 0.02;
  cands.forEach((c, i) => {
    if (c.self || !c.alive || c.hurt <= worst) return;
    if (Math.hypot(c.x - from.x, c.z - from.z) >= reach) return;
    best = i; worst = c.hurt;
  });
  return best;
}

/** Ángulo `cur` girado hacia `want` como mucho `maxStep` rad (por el camino corto). */
export function turnToward(cur: number, want: number, maxStep: number): number {
  let d = want - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return cur + Math.max(-maxStep, Math.min(maxStep, d));
}

/**
 * Carga del disparo del centinela, 0..1: sube en los `wind` s previos al disparo (la luz y el cañón avisan) y vale 0
 * el resto del tiempo. `cd` = segundos que faltan para disparar.
 */
export function chargeLevel(cd: number, wind: number): number {
  if (wind <= 0 || cd >= wind) return 0;
  return Math.max(0, Math.min(1, 1 - cd / wind));
}

/**
 * Salto del sabueso: fases según el tiempo desde que lo decide. Primero se agacha (`wind` s, aviso), luego salta
 * (`leap` s, 4× velocidad) y después nada. Devuelve la fase y su avance 0..1.
 */
export function pounceState(t: number, wind = 0.32, leap = 0.38): { phase: "crouch" | "leap" | "none"; k: number } {
  if (t < 0) return { phase: "none", k: 0 };
  if (t < wind) return { phase: "crouch", k: t / wind };
  if (t < wind + leap) return { phase: "leap", k: (t - wind) / leap };
  return { phase: "none", k: 0 };
}


/**
 * Puntos de impacto de una andanada (misiles del mech, bombas): el primero en `center` y el resto repartidos en un
 * anillo de radio `spread` (con un giro al azar), para que quedarse quieto no sirva y moverse sí.
 */
export function strikePattern(center: P2, n: number, spread: number, rnd: () => number = Math.random): P2[] {
  const out: P2[] = [{ x: center.x, z: center.z }], a0 = rnd() * Math.PI * 2;
  for (let i = 1; i < n; i++) { const a = a0 + (i / (n - 1)) * Math.PI * 2, r = spread * (0.75 + 0.25 * rnd()); out.push({ x: center.x + Math.cos(a) * r, z: center.z + Math.sin(a) * r }); }
  return out;
}

/** Daño de una explosión a `d` m de su centro (radio `r`): entero en el tercio central y luego cae hasta el 30 % en el borde; 0 fuera. */
export function blastDamage(d: number, r: number, dmg: number): number {
  if (d >= r || r <= 0) return 0;
  const k = d / r;
  return k <= 1 / 3 ? dmg : dmg * (1 - 0.7 * (k - 1 / 3) / (2 / 3));
}
