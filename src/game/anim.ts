// Capa de animación procedural del arma en primera persona. Solo lógica (sin Three.js ni escena): recibe el estado
// del jugador y del arma y devuelve una pose (posición/giro del arma, desplazamiento del cargador, recorrido de las
// piezas móviles y fase de recarga). Los parámetros de cada clase están en src/data/anim.json.
import data from "../data/anim.json";

export type V3 = [number, number, number];
export type MovingPart = "slide" | "pump" | "charging";
export interface Phase { id: string; t: number; index: number }

export interface AnimParams {
  hip: V3; /** Tarea 13: objetivos de encuadre en cadera (hipframe.ts): empuñadura y boca en pantalla, distancia y alabeo. */ frame?: { grip: [number, number]; muzzle: [number, number]; aim?: [number, number]; depth: number; roll?: number; bulk: number; depthMax: number }; /** Giro de cadera de la clase (rad): cabeceo hacia arriba, guiñada hacia el centro y alabeo; al apuntar se anula. */ hipYaw?: number; hipPitch?: number; hipRoll?: number; /** Encargo 54: escala de la silueta en cadera para la clase (1 = sin cambiar; los subfusiles salían pequeños). Se desvanece al apuntar. */ hipScale?: number; /** Encargo 54: alto máximo de la silueta en cadera para la clase (subfusiles: 0,55; por defecto el de vmfit). */ hipMaxH?: number; /** Base de la pose al apuntar con armas sin mira (`iron`): se fija aparte para que reencuadrar la cadera no la mueva. */ adsHip?: [number, number]; aimZ: number; adsRoll: number; gripZ?: number; /** Al apuntar, distancia mínima del ojo por detrás de la empuñadura (m; pistolas: brazo extendido). */ adsGrip?: number; /** Hasta dónde puede quedar la culata detrás del ojo (m; bullpups: el cuerpo va detrás de la empuñadura). */ rearMax?: number;
  kick: { k: number; zeta: number; peak: number; back: number; up: number; pitch: number; roll: number };
  recoil: { power: number; vertical: number; horizontal: number };
  sway: { gain: number; maxX: number; maxY: number; lag: number; adsKeep: number };
  bob: { walk: number; sprint: number; x: number; y: number; roll: number };
  breath: { y: number; pitch: number };
  sprint: { pos: V3; rot: V3; speed: number };
  draw: { drop: number; pitch: number; roll: number };
  holster: number;
  /** Colocar el arma en cadera por la empuñadura (altura de la mano igual en todas), no por el centro del modelo. */ gripAnchor?: boolean;
  /** Giro en reposo a la cadera (cabeceo, guiñada, alabeo): las armas cortas, con la boca algo abajo y hacia dentro; al apuntar se anula. */ rest?: V3;
  reload: { style: "mag" | "shells" | "cylinder" | "break" | "gate"; phases: [string, number][]; tilt: V3; drop: V3; mag: V3; rackPart: MovingPart | ""; rackTravel: number };
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
/** Giro de cadera de la clase (radianes): cabeceo (arriba), guiñada (hacia el centro) y alabeo. Se aplica solo en
 *  cadera y se desvanece al apuntar, así que ADS no cambia. */
export function hipAngles(p: AnimParams, ads = 0): V3 {
  const k = 1 - ease(clamp(ads, 0, 1));
  return [(p.hipPitch ?? 0) * k, (p.hipYaw ?? 0) * k, (p.hipRoll ?? 0) * k];
}
const seg = (x: number, a: number, b: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const outCubic = (x: number) => 1 - (1 - x) ** 3;
/** Duración del gesto manual (s): cerrojo en cuatro tiempos y bombeo seco. */
export const CYCLE_TIME = { bolt: 0.8, pump: 0.55 } as const;
/** Campo de visión con el que se dibuja el arma (main.ts: el viewmodel usa uno más estrecho que el mundo). */
export const VM_FOV = 62;
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
/** Cadera por la empuñadura (z local) y apartado de las muy altas, como antes del encargo 35 (sin alejamiento general). */
const hipRawZ = (p: AnimParams, i: Pick<AnimInput, "length" | "gripX">) => i.gripX !== undefined && p.gripZ !== undefined ? Math.min(-p.gripZ + i.gripX, (p.rearMax ?? 0.34) - i.length * 0.5) : -(i.length * 0.5 + p.hip[2]);
const hipBulkZ = (p: AnimParams, i: Pick<AnimInput, "length" | "gripX" | "bulk">) => hipRawZ(p, i) - (p.gripAnchor ? 0 : Math.min(0.12, Math.max(0, (i.bulk ?? 0) - 0.28) * 1.6));

export interface AnimInput {
  dt: number; time: number;
  /** 0 cadera … 1 apuntando. */ ads: number;
  moving: number; sprinting: boolean; grounded: boolean; vy: number;
  lookX: number; lookY: number;
  /** Alto del arma (m), para alejar las muy voluminosas. */ bulk?: number;
  /** Largo del modelo y altura de la línea de mira (para la posición de apuntado). */ length: number; sightY: number;
  /** X local de la empuñadura respecto al centro del modelo (la boca está en +X). */ gripX?: number;
  /** Ajuste de encuadre en cadera propio de cada arma (dx, dy, dz, giro hacia el centro); se desvanece al apuntar. */ fit?: [number, number, number, number];
  /** Tarea 13: pose de cadera resuelta para esta arma por objetivos en pantalla (hipframe.ts). Sustituye a la cadera
   *  de la clase (posición, giro en reposo y convergencia); se desvanece al apuntar igual que ella. */ hip?: { pos: V3; rot: V3 };
  /** Y local de la empuñadura (las armas cortas se colocan por ella: igual altura de mano en todas). */ gripY?: number;
  /** Sin óptica: al apuntar no se alinea la mira de hierro; el arma se acerca y se centra un poco (estilo Black). */ iron?: boolean;
  /** Miras de hierro montadas: X del alza respecto al centro del arma (el ojo queda a 2,5 cm detrás de ella (los cuerpos de las alzas no pasan de 1,5 cm detrás de su lente), como en un shooter moderno: la mirilla llena la vista). */ sightX?: number;
  /** Con óptica montada (no mira de hierro): X local de su lente trasera. El ojo se coloca a `OPTIC_EYE` detrás de ella, igual que con el alza, y no según el largo del arma. */ opticX?: number;
  /** Progreso de la recarga 0..1, o null. */ reload: number | null;
  /** Progreso de sacar el arma (1 al empezar … 0 lista), de guardarla (0 … 1 guardada) y de la inspección (0..1 o null). */
  draw: number; holster: number; inspect: number | null;
  /** Progreso del ciclo manual (corredera/bombeo/cerrojo) 0..1 o null; cargador vacío (corredera abierta). */
  cycle: number | null; empty: boolean;
  /** Acción manual en curso (cerrojo o bombeo): elige la curva del gesto. */ cycleKind?: "bolt" | "pump";
  /** Amartillar (revólver de acción simple), 0..1, o null. */ cock?: number | null;
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
  /** Recarga de esta vez (escopetas: cartucho a cartucho los que falten, o con cargador): sustituye a la de la clase. */
  reloadOverride: Partial<AnimParams["reload"]> | null = null;

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

  /** Posición de cadera sin balanceo ni ajuste (para calcular el encuadre de cada arma). */
  hipBase(i: Pick<AnimInput, "length" | "gripX" | "gripY" | "bulk">): V3 {
    const p = this.p;
    return [p.hip[0], p.gripAnchor && i.gripY !== undefined ? p.hip[1] - i.gripY : p.hip[1], hipBulkZ(p, i)];
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
    // (con miras de hierro, el ojo justo detrás del alza: si no, la culata quedaba delante de una línea de mira tan baja)
    // (si con eso la mano de la empuñadura quedaba casi en el plano de la cámara, tapaba toda la vista: el ojo se
    // retrasa hasta 6 cm por detrás de la empuñadura)
    const OPTIC_EYE = 0.085; // (ojo a 8,5 cm detrás de la lente trasera de una óptica montada)
    const EYE = 0.065; // (ojo a 6,5 cm detrás del alza: a 2,5 cm cualquier milímetro de desajuste se veía enorme)
    // Con óptica montada el ojo va detrás de su lente trasera (antes se colocaba por el largo del arma y una constante por clase, y una
    // óptica adelantada en el raíl dejaba el arma lejos y fina al apuntar)
    const rearX = i.sightX ?? i.opticX, eye = i.sightX !== undefined ? EYE : OPTIC_EYE;
    const eyeX = rearX === undefined ? 0 : i.gripX !== undefined && rearX - eye < i.gripX + (p.adsGrip ?? 0.06) - 0.015 ? Math.min(rearX - eye, i.gripX - (p.adsGrip ?? 0.06)) : rearX - eye;
    const adsZ = rearX !== undefined ? eyeX : -(i.length * 0.5 + p.aimZ);
    // (las muy altas —miras grandes, tambores, cuerpos voluminosos— un poco más lejos: no tapan la vista; las normales,
    // exactamente en la cadera de antes del encargo 35)
    const hipZ = hipBulkZ(p, i);
    // Mira de hierro: se acerca el arma hacia el centro, por debajo de la vista (la cámara hace zoom); con óptica, la
    // línea de mira pasa por el centro de la óptica. Al apuntar se mantiene la cadera de siempre, así ADS no cambia.
    const adsH = p.adsHip ?? [p.hip[0], p.hip[1]]; // (encuadre de cadera original: al apuntar no cambia)
    const adsHipZ = hipBulkZ(p, i);
    const ironPos: V3 = [adsH[0] * 0.45, adsH[1] * 0.78, adsHipZ + 0.05 - (p.adsGrip ? p.adsGrip * 0.6 : 0)]; // (pistolas: al apuntar, el brazo se extiende)
    const tgt: V3 = i.iron ? ironPos : [0, -i.sightY, adsZ];
    // (armas cortas: la empuñadura siempre a la misma altura; un cargador largo o un tambor ya no suben el arma entera)
    const hipY = p.gripAnchor && i.gripY !== undefined ? p.hip[1] - i.gripY : p.hip[1];
    const h0: V3 = i.hip ? i.hip.pos : [p.hip[0], hipY, hipZ];
    const pos: V3 = [lerp(h0[0], tgt[0], e), lerp(h0[1], tgt[1], e), lerp(h0[2], tgt[2], e)];
    if (i.fit && !i.hip) { const f = 1 - e; pos[0] += i.fit[0] * f; pos[1] += i.fit[1] * f; pos[2] += i.fit[2] * f; }
    const rest = p.rest ?? [0, 0, 0];
    // Convergencia de cadera de la clase (encargo 51): la boca gira hacia el centro y el arma cabecea un poco, con el
    // perfil y la cara superior a la vista. Se suma al giro en reposo y se desvanece al apuntar (ADS no cambia).
    const ha = hipAngles(p, ads);
    const rot: V3 = i.hip
      ? [i.hip.rot[0] * (1 - e), i.hip.rot[1] * (1 - e), i.hip.rot[2] * (1 - e) - p.adsRoll * tri(ads, 0, 1)]
      : [rest[0] * (1 - e) + ha[0], (rest[1] + (i.fit?.[3] ?? 0)) * (1 - e) + ha[1], rest[2] * (1 - e) + ha[2] - p.adsRoll * tri(ads, 0, 1)];
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
    // Amartillar: el arma se ladea un poco hacia el pulgar y vuelve
    if (i.cock != null) { const kc = tri(i.cock, 0.15, 0.85); rot[2] -= 0.14 * kc; rot[0] += 0.05 * kc; pos[1] += 0.006 * kc; }

    // Recarga por fases (datos por clase)
    let phase: Phase | null = null;
    const mag = { offset: [0, 0, 0] as V3, visible: true };
    if (i.reload !== null) {
      const r = this.reloadOverride ? { ...p.reload, ...this.reloadOverride } : p.reload;
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
      } else if (r.style === "break") {
        // Basculante: al abrir, la boca baja de golpe; al cerrar, un tirón hacia arriba
        if (id === "open") { const kk = tri(t, 0.3, 1); rot[0] -= 0.12 * kk; }
        if (id === "load") { const kk = tri(t, 0.55, 1); pos[2] -= 0.01 * kk; }
        if (id === "close") { const kk = tri(t, 0, 0.6); rot[0] += 0.2 * kk; pos[1] += 0.015 * kk; }
      } else if (r.style === "gate") {
        // Portilla: cada bala, un empujón corto con el pulgar
        if (id === "round") { const kk = tri(t, 0.5, 0.85); pos[2] -= 0.006 * kk; rot[2] += 0.04 * kk; }
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
    // Inspección: mostrar el lateral del arma. La mano se mantenía «muy pegada» a la cámara: en vez de acercarla, se
    // separa un poco (el giro es lo que enseña el lateral).
    if (i.inspect !== null) { const kk = tri(i.inspect, 0, 1); rot[1] += -1.1 * ease(Math.min(1, kk * 1.4)); rot[2] += 0.45 * kk; pos[0] -= 0.06 * kk; pos[2] -= 0.015 * kk; pos[1] += 0.03 * kk; }
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

// ---------- Gestos de mano con equipamiento y granadas (encargo 34) ----------
// Solo lógica (sin Three.js): qué hace la mano libre al activar o lanzar, con las duraciones y curvas de
// src/data/anim.json. La pose concreta (posiciones en el espacio de la cámara) la pone gun.ts; aquí solo va el tiempo y
// la curva, para poder probar las reglas sin escena: ≤ 0,45 s, la mano empieza y acaba en reposo y el daño no corta.
export type GestureKind = "activate" | "throw" | "soft";
/** Duración máxima de un gesto de mano (s): no debe tapar la recarga ni la animación del arma. */
export const GESTURE_MAX = 0.45;
export interface GestureParams {
  /** Duración total (s); nunca pasa de `GESTURE_MAX`. */
  dur: number;
  /** Tramo en el que la mano sale (a la cadera al activar; atrás al lanzar), en fracción del gesto. */
  out: [number, number];
  /** Tramo del toque corto (activar) o del golpe hacia delante (lanzar). */
  hit: [number, number];
  /** Cierre de los dedos mientras el objeto va en la mano (0..1). */
  curl: number;
}
/** Desplazamientos normalizados del gesto: `out` saca la mano, `hit` la trae con el toque/golpe y `grip` cierra los dedos. */
export interface GestureCurve { out: number; hit: number; grip: number }

const gestureData = (data as unknown as { gadget?: Record<GestureKind, GestureParams> }).gadget
  ?? ({} as Record<GestureKind, GestureParams>);
const gestureCache = new Map<GestureKind, GestureParams>();
/** Parámetros de un gesto (con la duración acotada a `GESTURE_MAX`). */
export function gestureParams(kind: GestureKind): GestureParams {
  if (!gestureCache.has(kind)) {
    const p = gestureData[kind] ?? { dur: GESTURE_MAX, out: [0, 0.35] as [number, number], hit: [0.35, 0.85] as [number, number], curl: 0.9 };
    gestureCache.set(kind, { ...p, dur: Math.min(GESTURE_MAX, Math.max(0.05, p.dur)) });
  }
  return gestureCache.get(kind)!;
}
/**
 * Curva de un gesto (progreso 0..1 → desplazamientos normalizados). Empieza y acaba en cero: al terminar, la mano
 * vuelve sola a su reposo. No depende del daño ni de ninguna otra acción; solo del tiempo transcurrido.
 */
export function gestureCurve(kind: GestureKind, t: number): GestureCurve {
  const p = gestureParams(kind), x = clamp(t, 0, 1);
  const out = ease(seg(x, p.out[0], p.out[1])) * (1 - ease(seg(x, p.hit[0], p.hit[1])));
  const hit = outCubic(seg(x, p.hit[0], p.hit[1])) * (1 - ease(seg(x, 0.92, 1)));
  // (los dedos cierran al coger el objeto y se abren al soltarlo)
  const grip = p.curl * ease(seg(x, 0, 0.18)) * (1 - ease(seg(x, 0.7, 0.95)));
  return { out, hit, grip };
}
/**
 * Estado de un gesto de mano: solo tiempo. Avanza con `update(dt)` y no atiende a nada más, así que el daño recibido
 * nunca lo cancela ni lo reinicia; al acabarse, la curva queda en reposo (la mano vuelve a su sitio).
 */
export class GadgetGesture {
  kind: GestureKind | null = null;
  /** Segundos transcurridos del gesto en curso. */
  t = 0;
  /** Mano que actúa: -1 izquierda (apoyo), 1 derecha (cuando la izquierda está ocupada recargando). */
  side: 1 | -1 = -1;
  get dur() { return this.kind ? gestureParams(this.kind).dur : 0; }
  /** Empieza un gesto; si ya había uno, lo sustituye (manda el más reciente). */
  start(kind: GestureKind, side: 1 | -1 = -1) { this.kind = kind; this.side = side; this.t = 0; }
  /** Daño recibido: nunca cancela ni reinicia el gesto (regla del encargo 34; ver tests). */
  hurt(_amount = 0) { /* deliberadamente vacío: el gesto sigue */ }
  /** Para capturas: fija el gesto y su progreso (0..1) sin avanzar solo. */
  set(kind: GestureKind, t: number, side: 1 | -1 = -1) { this.kind = kind; this.side = side; this.t = clamp(t, 0, 1) * gestureParams(kind).dur; }
  update(dt: number) {
    if (!this.kind) return;
    this.t += Math.max(0, dt);
    if (this.t >= this.dur) { this.kind = null; this.t = 0; }
  }
  get active() { return this.kind !== null; }
  /** Progreso del gesto (1 cuando no hay ninguno: la mano está en reposo). */
  get progress() { return this.kind ? clamp(this.t / this.dur, 0, 1) : 1; }
  curve(): GestureCurve | null { return this.kind ? gestureCurve(this.kind, this.progress) : null; }
}
