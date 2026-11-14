// Capa de animación procedural del arma en primera persona. Solo lógica (sin Three.js ni escena): recibe el estado
// del jugador y del arma y devuelve una pose (posición/giro del arma, desplazamiento del cargador, recorrido de las
// piezas móviles y fase de recarga). Los parámetros de cada clase están en src/data/anim.json.
import data from "../data/anim.json";

export type V3 = [number, number, number];
export type MovingPart = "slide" | "pump" | "charging";
export interface Phase { id: string; t: number; index: number }

export interface AnimParams {
  hip: V3; aimZ: number; adsRoll: number; gripZ?: number;
  kick: { k: number; zeta: number; peak: number; back: number; up: number; pitch: number; roll: number };
  recoil: { power: number; vertical: number; horizontal: number };
  sway: { gain: number; maxX: number; maxY: number; lag: number; adsKeep: number };
  bob: { walk: number; sprint: number; x: number; y: number; roll: number };
  breath: { y: number; pitch: number };
  sprint: { pos: V3; rot: V3; speed: number };
  draw: { drop: number; pitch: number; roll: number };
  holster: number;
  reload: { style: "mag" | "shells" | "cylinder"; phases: [string, number][]; tilt: V3; drop: V3; mag: V3; rackPart: MovingPart | ""; rackTravel: number };
  cycle: { part: MovingPart | ""; travel: number; time: number; lockEmpty: boolean };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
function merge<T>(base: T, over: unknown): T {
  if (!isObj(over)) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : v;
  return out as T;
}
const cache = new Map<string, AnimParams>();
/** Parámetros de una clase de arma (los de por defecto mezclados con los de la clase). */
export function animParams(type: string): AnimParams {
  if (!cache.has(type)) cache.set(type, merge(data.default as unknown as AnimParams, (data.classes as Record<string, unknown>)[type]));
  return cache.get(type)!;
}
export const ANIM_CLASSES = Object.keys(data.classes);

export function phaseAt(phases: [string, number][], p: number): Phase {
  let acc = 0;
  for (let i = 0; i < phases.length; i++) { const [id, d] = phases[i]; if (p <= acc + d) return { id, t: clamp((p - acc) / d, 0, 1), index: i }; acc += d; }
  return { id: phases[phases.length - 1][0], t: 1, index: phases.length - 1 };
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const ease = (x: number) => x * x * (3 - 2 * x);
const seg = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const outCubic = (x: number) => 1 - (1 - x) ** 3;
/** Duración del gesto manual (s): cerrojo en cuatro tiempos y bombeo seco. */
export const CYCLE_TIME = { bolt: 0.8, pump: 0.55 } as const;
/**
 * Cerrojo (0..1): la mano va a la manilla (reach), la levanta (lift), tira atrás y empuja (pull), la baja y vuelve.
 * `slam` es el golpe al cerrar.
 */
export function boltCurve(t: number) {
  const reach = ease(seg(t, 0, 0.16)) * (1 - ease(seg(t, 0.84, 1)));
  const lift = ease(seg(t, 0.14, 0.26)) * (1 - ease(seg(t, 0.7, 0.82)));
  const pull = outCubic(seg(t, 0.28, 0.46)) * (1 - ease(seg(t, 0.52, 0.66)));
  return { reach, lift, pull, slam: tri(t, 0.64, 0.8) };
}
/** Bombeo (0..1): tirón atrás rápido, una pausa mínima y golpe adelante. */
export function pumpCurve(t: number) {
  const pull = outCubic(seg(t, 0.04, 0.32)) * (1 - ease(seg(t, 0.42, 0.66)));
  return { pull, slam: tri(t, 0.6, 0.85) };
}
export const tri = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export interface AnimInput {
  dt: number; time: number;
  /** 0 cadera … 1 apuntando. */ ads: number;
  moving: number; sprinting: boolean; grounded: boolean; vy: number;
  lookX: number; lookY: number;
  /** Largo del modelo y altura de la línea de mira (para la posición de apuntado). */ length: number; sightY: number;
  /** X local de la empuñadura respecto al centro del modelo (la boca está en +X). */ gripX?: number;
  /** Sin óptica: al apuntar no se alinea la mira de hierro; el arma se acerca y se centra un poco (estilo Black). */ iron?: boolean;
  /** Progreso de la recarga 0..1, o null. */ reload: number | null;
  /** Progreso de sacar el arma (1 al empezar … 0 lista), de guardarla (0 … 1 guardada) y de la inspección (0..1 o null). */
  draw: number; holster: number; inspect: number | null;
  /** Progreso del ciclo manual (corredera/bombeo/cerrojo) 0..1 o null; cargador vacío (corredera abierta). */
  cycle: number | null; empty: boolean;
  /** Acción manual en curso (cerrojo o bombeo): elige la curva del gesto. */ cycleKind?: "bolt" | "pump";
  /** Recarga táctica (quedaban balas): sin montar la palanca o la corredera. */ tactical?: boolean;
}
export interface Pose {
  pos: V3; rot: V3;
  /** Inercia al girar la cámara (se aplica en un grupo aparte). */ swayPos: V3; swayRot: V3;
  mag: { offset: V3; visible: boolean };
  /** Recorrido hacia atrás (m) de cada pieza móvil. */ parts: Record<MovingPart, number>;
  phase: Phase | null;
}

/**
 * Estado de la animación de un arma. El retroceso visual es un muelle amortiguado por clase (rigidez y amortiguación
 * dan la curva: seco con un pequeño rebote en pistolas, lento y pesado en escopetas y francotiradores).
 */
export class ViewAnimator {
  p: AnimParams = animParams("rifle");
  private kx = 0; private kv = 0; private roll = 0;
  private sprint = 0; private bobT = 0; private landT = 0; private wasGrounded = true;
  private swayX = 0; private swayY = 0; private lookVX = 0; private lookVY = 0;
  private shotT = 1;

  /** Clase del arma y postura del perfil de agarre (las cortas con culata van al hombro). */
  setClass(type: string, stance?: string) {
    const st = (data as unknown as { stances?: Record<string, unknown> }).stances?.[stance ?? ""];
    this.p = st && stance === "shoulder" && (type === "pistol" || type === "revolver") ? merge(animParams(type), st) : animParams(type);
    this.kx = this.kv = this.roll = 0; this.shotT = 1;
  }

  /** Un disparo: impulso al muelle (para que el pico sea ≈ peak · fuerza) y algo de giro aleatorio. */
  shot(strength = 1, rand = Math.random) {
    const w = Math.sqrt(this.p.kick.k);
    this.kv += this.p.kick.peak * strength * w * Math.E;
    this.roll += (rand() - 0.5) * this.p.kick.roll * 2 * strength;
    this.shotT = 0;
  }

  update(i: AnimInput): Pose {
    const p = this.p, dt = i.dt;
    // Muelle del retroceso (semi-implícito en subpasos: estable con dt grandes)
    const k = p.kick.k, c = 2 * p.kick.zeta * Math.sqrt(k);
    for (let s = 0, n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n; s < n; s++) { this.kv += (-k * this.kx - c * this.kv) * h; this.kx += this.kv * h; }
    this.kx = clamp(this.kx, -0.4, 1.4);
    this.roll *= Math.exp(-dt * 10);
    this.shotT = Math.min(1, this.shotT + dt / Math.max(0.01, p.cycle.time));

    const ads = i.ads, e = ease(ads);
    // Cadera → mira (con un leve giro a mitad del gesto, como al subir el arma a la cara)
    // En cadera, la empuñadura queda a `gripZ` de la cámara (sin que la culata pase de 34 cm detrás del ojo: más, en armas muy largas, las alejaba); al
    // apuntar, la culata a `aimZ` delante, como antes
    const adsZ = -(i.length * 0.5 + p.aimZ);
    const hipZ = i.gripX !== undefined && p.gripZ !== undefined ? Math.min(-p.gripZ + i.gripX, 0.34 - i.length * 0.5) : -(i.length * 0.5 + p.hip[2]);
    // Mira de hierro: se acerca el arma hacia el centro, por debajo de la vista (la cámara hace zoom); con óptica, la
    // línea de mira pasa por el centro de la óptica
    const ironPos: V3 = [p.hip[0] * 0.45, p.hip[1] * 0.78, hipZ + 0.05];
    const tgt: V3 = i.iron ? ironPos : [0, -i.sightY, adsZ];
    const pos: V3 = [lerp(p.hip[0], tgt[0], e), lerp(p.hip[1], tgt[1], e), lerp(hipZ, tgt[2], e)];
    const rot: V3 = [0, 0, -p.adsRoll * tri(ads, 0, 1)];
    // Sprint
    this.sprint = lerp(this.sprint, i.sprinting && i.reload === null ? 1 : 0, Math.min(1, dt * p.sprint.speed));
    for (let a = 0; a < 3; a++) { pos[a] += p.sprint.pos[a] * this.sprint; rot[a] += p.sprint.rot[a] * this.sprint; }
    // Balanceo al andar (en ocho), menor apuntando
    this.bobT += dt * (i.sprinting ? p.bob.sprint : p.bob.walk) * Math.min(1, i.moving);
    const bob = (1 - ads * 0.85) * Math.min(1, i.moving) * (i.sprinting ? 1.8 : 1) * (i.grounded ? 1 : 0.2);
    pos[0] += Math.sin(this.bobT) * p.bob.x * bob; pos[1] += Math.abs(Math.cos(this.bobT)) * p.bob.y * bob; rot[2] += Math.sin(this.bobT) * p.bob.roll * bob;
    // Respiración en reposo
    pos[1] += Math.sin(i.time * 1.6) * p.breath.y * (1 - ads * 0.8); rot[0] += Math.sin(i.time * 1.3) * p.breath.pitch * (1 - ads * 0.8);
    // Salto y aterrizaje
    if (i.grounded && !this.wasGrounded) this.landT = 0.25;
    this.wasGrounded = i.grounded; this.landT = Math.max(0, this.landT - dt);
    pos[1] += clamp(-i.vy * 0.004, -0.02, 0.02) - (this.landT > 0 ? tri(1 - this.landT / 0.25, 0, 1) * 0.025 : 0);
    // Retroceso visual (curva del muelle): atrás, arriba, cabeceo y giro
    const kick = this.kx;
    pos[2] += kick * p.kick.back * (1 - ads * 0.4); pos[1] += kick * p.kick.up; rot[0] += kick * p.kick.pitch; rot[2] += this.roll;

    // Piezas móviles
    const parts: Record<MovingPart, number> = { slide: 0, pump: 0, charging: 0 };
    if (p.cycle.part) {
      // Automáticas/semiautomáticas: golpe atrás y vuelta en cycle.time; manuales (bombeo/cerrojo): recorrido largo
      const manual = i.cycle !== null ? (i.cycleKind === "bolt" ? boltCurve(i.cycle).pull : i.cycleKind === "pump" ? pumpCurve(i.cycle).pull : tri(i.cycle, 0.1, 0.9)) : 0;
      const auto = p.cycle.time < 0.2 ? tri(this.shotT, 0, 1) : 0;
      parts[p.cycle.part] = p.cycle.travel * Math.max(manual, auto);
      if (p.cycle.lockEmpty && i.empty && i.reload === null) parts[p.cycle.part] = p.cycle.travel;
    }
    // Cerrojo/bombeo manual: el arma se gira un poco
    // Cerrojo: el arma se tumba hacia la mano, baja un poco y acompaña el tirón; al cerrar, un golpe seco
    // Bombeo: la boca sube al tirar y el arma retrocede con la mano; al cerrar, sacudida adelante
    if (i.cycle !== null && i.cycleKind === "bolt") {
      const b = boltCurve(i.cycle);
      rot[2] += 0.32 * b.reach + 0.06 * b.lift; rot[0] += 0.07 * b.reach - 0.03 * b.slam; rot[1] -= 0.08 * b.reach;
      pos[1] -= 0.028 * b.reach; pos[0] -= 0.012 * b.reach; pos[2] += 0.018 * b.pull - 0.008 * b.slam;
    } else if (i.cycle !== null && i.cycleKind === "pump") {
      const q = pumpCurve(i.cycle);
      rot[0] += 0.07 * q.pull - 0.03 * q.slam; rot[2] += 0.06 * q.pull; pos[2] += 0.028 * q.pull - 0.012 * q.slam; pos[1] -= 0.01 * q.pull;
    } else if (i.cycle !== null) { const kc = tri(i.cycle, 0.1, 0.9); rot[2] += 0.25 * kc; rot[0] += 0.12 * kc; pos[1] -= 0.02 * kc; }

    // Recarga por fases (datos por clase)
    let phase: Phase | null = null;
    const mag = { offset: [0, 0, 0] as V3, visible: true };
    if (i.reload !== null) {
      const r = p.reload;
      phase = phaseAt(r.phases, i.reload);
      const { id, t } = phase;
      const first = r.phases[0][0], last = r.phases[r.phases.length - 1][0];
      const tilt = id === first ? ease(t) : id === last ? 1 - ease(t) : 1;
      for (let a = 0; a < 3; a++) { rot[a] += r.tilt[a] * tilt; pos[a] += r.drop[a] * tilt; }
      if (r.style === "mag") {
        const out = id === "out" ? ease(t) : id === "pouch" ? 1 : id === "in" ? 1 - ease(t) : 0;
        mag.offset = [r.mag[0] * out, r.mag[1] * out, r.mag[2] * out];
        mag.visible = id !== "pouch";
        // Al encajar el cargador nuevo, un golpe seco hacia arriba (la palma lo asienta)
        if (id === "in") { const sk = tri(t, 0.72, 1); pos[1] += 0.014 * sk; rot[0] += 0.05 * sk; }
      } else if (r.style === "shells" && id === "shell") {
        // Cada cartucho: empujón hacia arriba al meterlo
        const kk = tri(t, 0.55, 1); pos[1] += 0.01 * kk; rot[0] -= 0.03 * kk;
      } else if (r.style === "cylinder") {
        // Tambor fuera: el arma se gira de lado; expulsar = boca arriba con una sacudida
        if (id === "eject") { const kk = tri(t, 0, 1); rot[0] += 0.5 * kk; pos[1] += 0.03 * kk; }
        if (id === "open" || id === "close") rot[2] += 0.12 * tri(t, 0, 1);
      }
      // Recarga táctica (quedaban balas): no hace falta montar; solo en la vacía se tira de la palanca o la corredera
      if (id === "rack" && r.rackPart && (!i.tactical || r.style !== "mag")) {
        const kk = tri(t, 0, 1); parts[r.rackPart] = Math.max(parts[r.rackPart], r.rackTravel * kk);
        pos[2] += 0.035 * kk; rot[0] -= 0.12 * kk;
      }
    }
    // Inspección: mostrar el lateral del arma
    if (i.inspect !== null) { const kk = tri(i.inspect, 0, 1); rot[1] += -1.1 * ease(Math.min(1, kk * 1.4)); rot[2] += 0.45 * kk; pos[0] -= 0.06 * kk; pos[2] += 0.05 * kk; pos[1] += 0.03 * kk; }
    // Sacar (de abajo, girada) y guardar (el gesto inverso, más rápido)
    const away = Math.max(ease(i.draw), ease(i.holster));
    if (away > 0) { pos[1] -= p.draw.drop * away; rot[0] -= p.draw.pitch * away; rot[2] += p.draw.roll * Math.max(i.draw, i.holster); }

    // Inercia al girar la cámara: el arma se queda un poco atrás
    const keep = lerp(1, p.sway.adsKeep, ads);
    // Se usa la velocidad de giro (rad/s) filtrada, no el giro de este fotograma: el ratón entrega movimientos a
    // trompicones (fotogramas con 0 y otros con el doble) y con tirones de fotograma el arma daba bandazos de lado
    // a lado arrastrando los brazos. `gain` sigue expresado como a 60 fps.
    const idt = 1 / Math.max(dt, 1 / 240);
    this.lookVX += (i.lookX * idt - this.lookVX) * Math.min(1, dt * 14);
    this.lookVY += (i.lookY * idt - this.lookVY) * Math.min(1, dt * 14);
    this.swayX += (clamp(this.lookVX / 60 * p.sway.gain, -p.sway.maxX, p.sway.maxX) - this.swayX) * Math.min(1, dt * p.sway.lag);
    this.swayY += (clamp(this.lookVY / 60 * p.sway.gain, -p.sway.maxY, p.sway.maxY) - this.swayY) * Math.min(1, dt * p.sway.lag);
    return {
      pos, rot,
      swayRot: [-this.swayY * keep, this.swayX * keep, this.swayX * 0.8 * keep],
      swayPos: [-this.swayX * 0.15 * keep, this.swayY * 0.1 * keep, 0],
      mag, parts, phase,
    };
  }

  /** Valor actual del muelle (para pruebas y para la cámara). */
  get kick() { return this.kx; }
}
