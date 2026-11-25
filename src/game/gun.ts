// Arma en mano: modos de disparo, habilidades, apuntado con mira y animaciones procedurales
// (inercia, balanceo, sprint táctico, salto, retroceso, recarga con cargador, corredera/cerrojo, inspección).
import * as THREE from "three";
import type { Support } from "../weapons/grip";
import { CAL_EFFECT } from "../weapons/pistolgen";
import type { WeaponAssembler, AssembledWeapon, AssembledPart } from "../weapons/assembler";
import type { WeaponType } from "../weapons/types";
import { PELLETS } from "../weapons/generator";
import { isLight, lightKind } from "../weapons/lights";
const FIT_ENABLED = false;
import { EffectRunner, type FxAction } from "../weapons/effects";
import { accessory, isIron } from "../weapons/accessories";
import type { Item } from "./inventory";
import type { Dummy, Element, Zone } from "./dummies";
import { mergeStatic } from "./merge";
import { Arms, handBasis, type Curl, type HandPose } from "./arms";
import { audio, fadeOut, loadSamples, out, out as masterOut, playSample, sample, soundManifest } from "./audio";
import { cycleKind, cycleSounds, filesOfType, pickReload, pickShot, type RecargaVariante } from "./sounds";
import { settings } from "./settings";
import { CYCLE_TIME, GadgetGesture, ViewAnimator, VM_FOV, animParams, boltCurve, ease, phaseAt, pumpCurve, tri, type AnimInput, type GestureCurve, type GestureKind, type MovingPart, type Phase, type Pose } from "./anim";
import { gripAt, hasSequence as hasSequenceRaw, sequenceOrientAt as sequenceOrientAtRaw, sequencePathAt as sequencePathAtRaw, type HandSequence, type V4 } from "./handpath";
// Interruptor del 24/11/2026: los recorridos reales de las tandas A, B y C del encargo 49 se ven antinaturales.
// true = se usa la animación procedural de antes en todas las clases menos el fusil; false = se reactivan los recorridos reales.
const REAL_PATHS_OFF = true;
const realOff = (c: string) => REAL_PATHS_OFF && c !== 'rifle';
const hasSequence = (c: string, s: HandSequence) => !realOff(c) && hasSequenceRaw(c, s);
const sequenceOrientAt: typeof sequenceOrientAtRaw = (c, ...r) => (realOff(c) ? null : sequenceOrientAtRaw(c, ...r));
const sequencePathAt: typeof sequencePathAtRaw = (c, ...r) => (realOff(c) ? null : sequencePathAtRaw(c, ...r));
import { solveHipFit, type HipSolution } from "./hipframe";
import { sampleLeft, sampleMag, sampleNum, sampleVec, type Gun6, type HandShape, type LeftKey, type MagMode, type Track } from "./vmpose";
import { shotgunShells, trackFor, type VmAction } from "./vmtracks";
import { adsRate, adsTime, drawTime, reloadTime } from "./gunfeel";
import { VM_BACK, HIP_H_MAX, HIP_H_TALL, HIP_W_MAX, HIP_W_MIN, VM_SCALE_MIN, VM_SCALE_FLOOR, aimScale, hipScale, projectPoint, projectedSize } from "./vmfit";

/** Clases cuyo cargador se cambia y que tienen `reload_empty` con recorrido propio en poses.json. */
const EMPTY_RELOAD: WeaponType[] = ["pistol", "revolver", "smg", "sniper", "lmg", "bullpup"];

const DECAL_GEO = new THREE.PlaneGeometry(0.045, 0.045);
const GLYPH_GEO = (() => { const g = new THREE.PlaneGeometry(0.16, 0.006); const v = new THREE.PlaneGeometry(0.006, 0.16); const p1 = g.attributes.position.array as Float32Array, p2 = v.attributes.position.array as Float32Array; const out = new THREE.BufferGeometry(); const pos = new Float32Array(p1.length + p2.length); pos.set(p1); pos.set(p2, p1.length); out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const i1 = Array.from(g.index!.array), i2 = Array.from(v.index!.array).map((x) => x + 4); out.setIndex([...i1, ...i2]); return out; })();
const SPARK_GEO = new THREE.BoxGeometry(0.012, 0.012, 0.012);
const SCORCH_GEO = new THREE.CircleGeometry(0.12, 7);

export interface ShotHooks {
  onHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, crit: boolean): number;
  onKill?(d: Dummy): void;
  /** Cada disparo (para las estadísticas de la sala: precisión). */
  onShot?(): void;
  dummies(): Dummy[];
  /** Daño al jugador (contrapartida de autodaño de algunos efectos). */
  hurt?(dmg: number): void;
  /** Embestida corta hacia el objetivo del cuerpo a cuerpo. */
  lunge?(dir: THREE.Vector3, dist: number): void;
}
export interface Control { fire: boolean; aim: boolean; moving: number; sprinting: boolean; lookX: number; lookY: number; vy: number; grounded: boolean; inspect: boolean; /** Patada (R3 / Z): cuerpo a cuerpo con o sin arma. */ kick?: boolean }

/**
 * Recarga como máquina de fases con nombre. Duraciones en fracción del tiempo total de recarga, que ya se escala con
 * el manejo y los efectos. Retocar una recarga es cambiar estos datos, no el código.
 */
export const RELOAD_PHASES: [string, number][] = animParams("rifle").reload.phases;
export { phaseAt };

/** Patrón de retroceso (vertical, horizontal) por disparo de una ráfaga, determinista por arma. */
const patterns = new Map<number, [number, number][]>();
export function recoilPattern(seed: number): [number, number][] {
  if (!patterns.has(seed)) {
    let x = seed >>> 0; const r = () => ((x = (Math.imul(x ^ (x >>> 15), 2246822519) + 0x9e3779b9) >>> 0) / 4294967296);
    const bias = (r() - 0.5) * 1.4, wobble = 0.4 + r() * 0.8, freq = 0.25 + r() * 0.35;
    const p: [number, number][] = [];
    for (let i = 0; i < 40; i++) p.push([1 + (i < 6 ? 0.25 : 0) + (r() - 0.5) * 0.2, bias * Math.min(1, i / 8) + Math.sin(i * freq) * wobble]);
    patterns.set(seed, p);
  }
  return patterns.get(seed)!;
}

const casingGeo = { small: new THREE.CylinderGeometry(0.0045, 0.0045, 0.02, 6), big: new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6), shell: new THREE.CylinderGeometry(0.0095, 0.0095, 0.065, 8) };
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc8a050, metalness: 0.85, roughness: 0.3 });
const shellMat = new THREE.MeshStandardMaterial({ color: 0xa02a1e, roughness: 0.6 });

export class Gun {
  readonly viewmodel = new THREE.Group();
  private sway = new THREE.Group();   // inercia y balanceo
  private holder = new THREE.Group(); // pose (cadera/mira/sprint) y animaciones
  /** Escala de la silueta anclada en la empuñadura: el arma se encoge sin que la mano se mueva de sitio. */
  private anchor = new THREE.Group();
  /** Empuñadura en coordenadas del holder (sin la transformación de la pose), pivote del encogido. */
  private gripOffset = new THREE.Vector3();
  /** Boca en coordenadas del holder (para que el fogonazo siga al encogido anclado en la empuñadura). */
  private muzzleOffset = new THREE.Vector3();
  private model: AssembledWeapon | null = null;
  /** Encuadre en cadera de esta arma (referencias: abajo a la derecha, 24–40 % del ancho, mira bajo la mitad). */
  private fit: [number, number, number, number] | null = null; private fitAspect = 0; private fitTune = 0;
  /** Linterna y láser del accesorio (se encienden con T / cruceta arriba). Sin luces nuevas: cono y haz emisivos. */
  deviceOn = false; private strobe = false; private strobeT = 0;
  private devFx: { kind: "light" | "laser" | "both"; root: THREE.Group; cone: THREE.Mesh | null; lens: THREE.Mesh; beam: THREE.Mesh | null; dot: THREE.Mesh | null; laserCol: number; lampCol: number } | null = null;
  private mag: AssembledPart | null = null;
  private cache = new Map<number, Promise<AssembledWeapon>>();
  item: Item | null = null;
  env: THREE.Texture | null = null;
  private cooldown = 0;
  /** Calor (0..1) y sobrecalentamiento (s): armas cuyo efecto se sobrecalienta. */
  heat = 0; overheatT = 0;
  /** Atracciones activas (Event Horizon). */
  private pulls: { at: THREE.Vector3; radius: number; t: number }[] = [];
  reloadT = 0; private reloadDur = 1;
  private triggerHeld = false;
  private equipT = 0; private equipDur = 0.45;
  recoil = 0; recoilYaw = 0;
  /** Capa de animación procedural (lógica pura, parámetros por clase en data/anim.json). */
  readonly anim = new ViewAnimator();
  /** Encargo 46: vértices muestreados del modelo (sin el FX de linterna/láser) para medir su silueta en pantalla. */
  private vmLocal: [number, number, number][] = [];
  private vmPts: [number, number, number][] = [];
  private vmScaled: [number, number, number][] = [];
  private vmScale = 1;
  private vmMat = new THREE.Matrix4();
  private vmMat2 = new THREE.Matrix4();
  private vmUnit = new THREE.Vector3(1, 1, 1);
  private vmOrigin = new THREE.Vector3();
  private vmVec = new THREE.Vector3();
  /** Encargo 54: encuadre de las atípicas (alejamiento + convergencia antes de encoger) y su medida provisional. */
  private fitAtypical = false; private fitAimed = false;
  private vmMatA = new THREE.Matrix4(); private vmMatB = new THREE.Matrix4(); private vmMatC = new THREE.Matrix4();
  private vmProbe: [number, number, number][] = [];
  private vmPosePos = new THREE.Vector3(); private vmPoseQ = new THREE.Quaternion(); private vmPoseE = new THREE.Euler();
  /** Última silueta medida (fracción de pantalla; `raw` sin el encogido) y escala aplicada; para capturas y pruebas. */
  readonly vmFit = { w: 0, h: 0, rawW: 0, rawH: 0, scale: 1 };
  /** Tarea 13: pose de cadera de esta arma resuelta por objetivos en pantalla (hipframe.ts) y el aspecto con que se
   *  resolvió (se rehace al cambiar el tamaño de la ventana). Sin objetivos en la clase, la cadera de siempre. */
  hipSol: HipSolution | null = null; private hipAspect = 0;
  /** Tarea 13: acción animada ahora por una pista de poses clave (vmtracks.ts), su progreso y la pista. */
  keyed: { action: VmAction; t: number; track: Track } | null = null;
  /** Estado del cargador en la pista del fotograma anterior (para soltar el viejo al pasar del brocal a «oculto»). */
  /** Pista de la recarga cartucho a cartucho de esta vez (depende de cuántos cartuchos faltan). */ private shellTrack: Track | null = null;
  private keyMagPrev: MagMode = "seat"; private keyMagOut = 0; private keyMagHand = false; private keyEjected = false;
  private moving: Partial<Record<MovingPart, AssembledPart>> = {};
  private holsterT = 0; private pending: { item: Item | null; rebuild: boolean } | null = null;
  /** Para capturas: coloca el arma en su pose al instante, sin suavizado. */
  snap = false;
  /** Oculta el arma y los brazos (menús). */
  hidden = false;
  /** Súper: pose de invocación (manda sobre las manos y baja el arma) y mejoras temporales de la sobrecarga. */
  superPose: { right: HandPose; left: HandPose; lower: number } | null = null;
  /** Gesto del casco (abrir el inventario): la izquierda sube al lateral del casco y pulsa un botón. -1 = inactivo. */
  private helmetT = -1;
  static readonly HELMET_DUR = 0.6;
  /** Momento del gesto en que el dedo pulsa el botón (ahí se abre el inventario). */
  static readonly HELMET_PRESS = 0.3;
  helmetTap() { if (this.helmetT < 0) this.helmetT = 0; }
  get helmetBusy() { return this.helmetT >= 0; }
  /** Gesto de manos al usar equipamiento (activar) o lanzar una granada (lanzar/lanzar suave): lógica pura en anim.ts. */
  readonly gesture = new GadgetGesture();
  /** Para capturas: fija el gesto (tipo y progreso 0..1) sin avanzarlo solo. */
  gestureHold: { kind: GestureKind; t: number } | null = null;
  /**
   * Arranca el gesto de la mano libre: la izquierda de apoyo; si se está recargando, la derecha (la recarga no se
   * cancela y la mano que actúa es la que queda libre).
   */
  gadgetGesture(kind: GestureKind) { this.gesture.start(kind, this.reloadT > 0 ? 1 : -1); }
  /** Mezcla la mano izquierda con el gesto del casco (si está en curso). */
  private helmetLeft(base: HandPose | null): HandPose | null {
    const t = this.helmetT; if (t < 0) return base;
    const ss = (a: number, b: number, x: number) => { const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const w = ss(0, 0.22, t) * (1 - ss(0.42, Gun.HELMET_DUR, t));
    const press = Math.sin(THREE.MathUtils.clamp((t - 0.22) / 0.16, 0, 1) * Math.PI); // empuje corto hacia el casco
    // (arriba a la izquierda, casi fuera de cuadro; el índice apunta atrás y arriba, hacia el lateral del casco)
    const pos = new THREE.Vector3(-0.17, 0.035, -0.2).lerp(new THREE.Vector3(-0.15, 0.06, -0.13), press);
    const orient = handBasis(new THREE.Vector3(-0.25, 0.55, 0.8), new THREE.Vector3(-0.45, 0.15, -0.88));
    const curl: Curl = { fingers: [0.05, 1.35, 1.45, 1.5], thumb: 0.9 }; // índice estirado, el resto recogidos
    const from = base ?? { pos: new THREE.Vector3(-0.3, -0.75, 0.2), orient, curl: { fingers: [0.4, 0.45, 0.5, 0.55], thumb: 0.2 } };
    return {
      // (sube por fuera, en arco hacia la izquierda: no cruza el centro de la pantalla)
      pos: from.pos.clone().lerp(pos, w).add(new THREE.Vector3(-0.14 * Math.sin(w * Math.PI), -0.04 * Math.sin(w * Math.PI), 0.05 * Math.sin(w * Math.PI))), orient: from.orient.clone().slerp(orient, w),
      curl: { fingers: from.curl.fingers.map((f, i) => f + (curl.fingers[i] - f) * w) as Curl["fingers"], thumb: from.curl.thumb + (curl.thumb - from.curl.thumb) * w },
    };
  }
  buff = { dmg: 1, rate: 1, freeAmmo: false, crit: false, critMult: 1 };
  /** Árbol de habilidades y nivel: daño, cadencia, daño crítico y probabilidad de no gastar bala. */
  perks = { dmg: 1, rate: 1, critMult: 1, ammoSave: 0, reload: 0 };
  /** Para capturas y pruebas: fuerza campos de la entrada de animación (p. ej. { reload: 0.4, dt: 0 }). */
  poseOverride: Partial<AnimInput> | null = null;
  aimT = 0;
  private shotCount = 0;
  private burstLeft = 0; private burstTimer = 0;
  private cycleT = 0; private cycleDur = 0.45;
  /** Escopeta basculante: piezas que giran con los cañones y punto de la bisagra (coordenadas del arma). */
  private breakParts: { p: AssembledPart; rz: number }[] = []; private hinge = new THREE.Vector3(); private breakEjected = false;
  /** Revólver de acción simple: amartillar tras cada disparo (gesto del pulgar). */ private cockT = 0;
  /** Acción real del modelo del arma (campo accion de los packs), para el sonido del ciclo. Lo fija main.ts. */
  actionOf: ((spec: NonNullable<Gun["spec"]>) => string | undefined) | null = null;
  /** Sonido del último disparo (se corta con un fundido si llega otro en cadencia alta) y pasos de recarga sonados. */
  private lastShot: ReturnType<typeof playSample> = null; private lastShotT = 0;
  private reloadSnd: RecargaVariante | null = null; private reloadDone = 0;
  /** Cierre de cada dedo de la mano derecha ajustado a la empuñadura de esta arma (se calcula al equiparla). */ private fitCurl: number[] | null = null; private fitWait = 0;
  /** Recarga táctica (quedaban balas en el cargador): sin montar el arma. */ private tacReload = false;
  private inspectT = 0;
  /** Progresos efectivos de esta capa (incluyen poseOverride, para capturas): recarga, sacar e inspeccionar. */
  private reloadProg = 1; private drawIn = 0; private inspectIn: number | null = null;
  /** Efectos de rareza del arma en mano (módulos de datos por eventos; ver weapons/effects.ts). */
  private fx: EffectRunner<Dummy, THREE.Vector3> | null = null;
  /** Último daño hecho por cada arma (para el efecto "relevo") y enemigos inestables (explotan al morir). */
  private lastDealt = new Map<number, number>();
  private unstable = new Map<Dummy, number>();
  private sightY = 0.03;
  zoom = 1;
  /** Tipo de mira para apuntar: alzas, punto rojo, holográfica o visor de aumento (vista a pantalla completa). */
  /** iron = sin mira (estilo Black); irons = miras de hierro desmontables (se apunta por su centro, zoom ×1,1). */
  sight: "iron" | "irons" | "dot" | "holo" | "scope" = "iron";
  private flashLight = new THREE.PointLight(0xffc27a, 0, 6, 2);
  private flash: THREE.Mesh;
  private tracers: { line: THREE.Line; t: number; max: number }[] = [];
  private decals: { mesh: THREE.Object3D; t: number; glyph: THREE.Mesh }[] = [];
  private sparks: { mesh: THREE.Mesh; v: THREE.Vector3; t: number }[] = [];
  private bursts: { mesh: THREE.Mesh; t: number }[] = [];
  private ray = new THREE.Raycaster();
  private audio: AudioContext | null = null;
  hitmarker = 0; critmarker = 0; killmarker = 0;
  private arms: Arms;
  /** Dedo del gatillo: 1 justo al disparar, vuelve solo. */
  private trigT = 0;
  /** Esprint suavizado (0..1): las manos se aflojan y el índice sale del gatillo. */
  private sprintT = 0;
  /** Dedo dentro del gatillo un rato tras disparar (si no, va estirado sobre el armazón). */
  private onTrigT = 0;
  private holdAvg: THREE.Vector3 | null = null;
  private leftLocal: THREE.Vector3 | null = null;
  // ---------- Puños (sin arma equipada) ----------
  /** Progreso del golpe en curso (0 = ninguno), mano que golpea, golpe fuerte (al esprintar), golpe ya resuelto. */
  /** ¿Lleva el arma linterna o láser? */
  get hasDevice() { return !!this.devFx; }
  /** Enciende o apaga la linterna/láser; devuelve el estado nuevo (null si el arma no lleva ninguno). */
  toggleDevice(): boolean | null { if (!this.devFx) return null; this.deviceOn = !this.deviceOn; this.applyDevice(); return this.deviceOn; }
  private applyDevice() {
    const d = this.devFx; if (!d) return;
    const on = this.deviceOn;
    if (d.cone) d.cone.visible = on;
    if (d.beam) d.beam.visible = on;
    if (d.dot) d.dot.visible = false;
    (d.lens.material as THREE.MeshBasicMaterial).color.set(on ? (d.kind === "laser" ? d.laserCol : d.lampCol) : 0x1a1a1a);
  }
  private buildDeviceFx(m: AssembledWeapon) {
    if (this.devFx?.dot) this.scene.remove(this.devFx.dot);
    this.devFx = null; this.counter = null;
    const part = m.parts.find((p) => (p.role === "accessory" || p.role === "device") && isLight(p.from.id));
    if (!part) return;
    if (part.from.id === "pa-killcounter") { this.buildCounter(m, part); return; }
    const id = part.from.id ?? "", lk = lightKind(id), kind: "light" | "laser" | "both" = lk === "strobe" ? "light" : lk;
    this.strobe = lk === "strobe";
    m.group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(part.object).applyMatrix4(m.group.matrixWorld.clone().invert());
    const c = b.getCenter(new THREE.Vector3()), r = Math.max(0.004, Math.min(b.max.y - b.min.y, b.max.z - b.min.z) * 0.32);
    const root = new THREE.Group(); root.position.set(b.max.x + 0.001, c.y, c.z); m.group.add(root);
    // Variedad por arma (semilla): color del láser y tono/apertura de la linterna
    let sd = ((this.item?.spec.seed ?? 1) * 2654435761) >>> 0; const rnd = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296);
    const LASER = [0xff2a2a, 0x2aff4a, 0x2a8cff, 0xb44aff, 0xff9a1a, 0x1affe4], laserCol = LASER[Math.floor(rnd() * LASER.length)];
    const LAMP = [0xfff0c8, 0xe8f2ff, 0xfff6e6, 0xd8ecff], lampCol = LAMP[Math.floor(rnd() * LAMP.length)], spread = 0.4 + rnd() * 0.35;
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r, 14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false }));
    lens.rotation.y = Math.PI / 2; root.add(lens);
    let cone: THREE.Mesh | null = null, beam: THREE.Mesh | null = null, dot: THREE.Mesh | null = null;
    if (kind !== "laser") {
      // Haz de la linterna: cono abierto, aditivo y muy tenue, que se desvanece hacia la punta
      const L = 3.2, g = new THREE.ConeGeometry(spread, L, 20, 1, true); g.translate(0, -L / 2, 0); g.rotateZ(Math.PI / 2);
      const cols: number[] = []; const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) { const k = 1 - Math.min(1, pos.getX(i) / L); cols.push(k, k, k); }
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      cone = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: lampCol, vertexColors: true, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
      cone.position.x = 0.002; root.add(cone);
    }
    if (kind !== "light") {
      // Láser: haz fino rojo hasta lo primero que toca y un punto en el impacto
      const g = new THREE.CylinderGeometry(0.0013, 0.0013, 1, 6, 1, true); g.translate(0, 0.5, 0); g.rotateZ(-Math.PI / 2);
      beam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: laserCol, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      beam.position.y = kind === "both" ? -r * 0.9 : 0; root.add(beam);
      dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: laserCol, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      dot.visible = false; this.scene.add(dot);
    }
    for (const o of [lens, cone, beam]) if (o) o.renderOrder = 11;
    this.devFx = { kind, root, cone, lens, beam, dot, laserCol, lampCol };
    this.applyDevice();
  }
  /** Contador de bajas (estilo pantalla de 7 segmentos): una pantallita en el lado visible del accesorio. */
  private counter: { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } | null = null;
  private buildCounter(m: AssembledWeapon, part: AssembledWeapon["parts"][number]) {
    m.group.updateMatrixWorld(true); part.object.visible = false;
    // (como en los shooters: la pantallita va en el costado del cajón, delante de la mano, donde se ve siempre)
    const inv = m.group.matrixWorld.clone().invert(), hx = m.handles.grip.x + 0.11, v = new THREE.Vector3(); let zMin = 0, yTop = -1, yBot = 1;
    for (const p of m.parts) { if (["magazine", "scope", "accessory", "device", "muzzle", "stock"].includes(p.role)) continue; p.object.traverse((o) => { const me = o as THREE.Mesh; if (!me.isMesh) return; const pos = me.geometry.attributes.position; for (let i = 0; i < pos.count; i += 2) { v.fromBufferAttribute(pos, i).applyMatrix4(me.matrixWorld).applyMatrix4(inv); if (Math.abs(v.x - hx) < 0.02) { zMin = Math.min(zMin, v.z); yTop = Math.max(yTop, v.y); yBot = Math.min(yBot, v.y); } } }); }
    const b = new THREE.Box3(new THREE.Vector3(hx - 0.025, yBot + (yTop - yBot) * 0.72 - 0.01, zMin), new THREE.Vector3(hx + 0.025, yBot + (yTop - yBot) * 0.72 + 0.01, zMin)), c = b.getCenter(new THREE.Vector3());
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.026, 0.006), new THREE.MeshStandardMaterial({ color: 0x1c1e21, roughness: 0.6, metalness: 0.4 })); bezel.position.set(c.x, c.y, zMin - 0.002); m.group.add(bezel);
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 48; const ctx = cv.getContext("2d")!, tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.019), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    // (el accesorio va en el costado izquierdo, que es el que se ve: la pantalla mira hacia ese lado)
    sc.position.set(c.x, c.y, zMin - 0.0055); sc.rotation.y = Math.PI; sc.renderOrder = 11; m.group.add(sc);
    this.counter = { ctx, tex }; this.refreshCounter();
  }
  /** Redibuja la cifra del contador (al cambiar de arma o al hacer una baja). */
  refreshCounter() {
    const c = this.counter; if (!c) return; const g = c.ctx, n = Math.min(999999, this.item?.spec.kills ?? 0);
    g.fillStyle = "#120802"; g.fillRect(0, 0, 128, 48);
    g.font = "bold 30px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(255,120,20,0.15)"; g.fillText("888888", 64, 26);
    g.fillStyle = "#ff8a1a"; g.fillText(String(n).padStart(6, "0"), 64, 26);
    c.tex.needsUpdate = true;
  }
  /** Largo del láser hasta el primer obstáculo (raycast cada fotograma) y punto de impacto. */
  private updateDevice(dt = 0) {
    const d0 = this.devFx;
    if (d0 && this.strobe && this.deviceOn && d0.cone) { this.strobeT += dt; d0.cone.visible = Math.sin(this.strobeT * 70) > 0; }
    const d = this.devFx; if (!d || !d.beam || !this.deviceOn) return;
    d.beam.visible = this.viewmodel.visible;
    const o = d.beam.getWorldPosition(new THREE.Vector3()), q = d.beam.getWorldQuaternion(new THREE.Quaternion());
    const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
    this.ray.set(o, dir); this.ray.far = 60;
    const hit = this.ray.intersectObjects(this.world, true)[0];
    const dist = hit ? hit.distance : 60, sc = d.beam.getWorldScale(new THREE.Vector3()).x || 1;
    d.beam.scale.x = dist / sc;
    if (d.dot) { d.dot.visible = !!hit; if (hit) d.dot.position.copy(hit.point).addScaledVector(dir, -0.01); }
  }
  /** Encuadre de cadera a partir de la geometría del arma: ancho en pantalla por tipo, mira en el cuadrante derecho
   *  bajo la mitad, boca girada unos grados hacia el centro sin cruzarlo, y una pequeña variación por arma. */
  private computeFit() {
    const m = this.model!, spec = this.item?.spec; this.fitAspect = this.camera.aspect;
    m.group.updateMatrix();
    const pts: THREE.Vector3[] = [];
    const lb = new THREE.Box3().setFromObject(m.group, true); lb.applyMatrix4(new THREE.Matrix4().copy(m.group.matrixWorld).invert());
    for (let c = 0; c < 8; c++) pts.push(new THREE.Vector3(c & 1 ? lb.max.x : lb.min.x, c & 2 ? lb.max.y : lb.min.y, c & 4 ? lb.max.z : lb.min.z).applyMatrix4(m.group.matrix));
    const sight = new THREE.Vector3(m.sightX ?? (m.handles.grip.x + 0.06), this.sightY, 0).applyMatrix4(m.group.matrix);
    const muzzle = new THREE.Vector3(m.muzzle.x, m.muzzle.y, 0).applyMatrix4(m.group.matrix);
    const base = this.anim.hipBase({ length: m.length, gripX: m.handles.grip.x, gripY: m.handles.grip.y, bulk: m.height });
    const t0 = spec?.type ?? "rifle", t = t0 === "revolver" ? "pistol" : t0, h = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2), w = h * this.camera.aspect;
    // Variación por arma (semilla): ±6 % de posición y ±2° de giro
    let sd = (spec?.seed ?? 7) >>> 0; const rnd = () => ((sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    const vx = rnd() * 0.012, vy = rnd() * 0.01, yaw = (t === "pistol" ? 0.035 : 0.07) + rnd() * 0.035;
    const proj = (p: THREE.Vector3, o: number[]) => {
      const c = Math.cos(yaw), s2 = Math.sin(yaw), x = p.x * c + p.z * s2, z = -p.x * s2 + p.z * c;
      const X = x + base[0] + o[0], Y = p.y + base[1] + o[1], Z = Math.min(-0.04, z + base[2] + o[2]);
      return [X / (-Z) / w, Y / (-Z) / h]; // NDC
    };
    // Más cerca de la cámara que antes (en las referencias el arma es grande): 6–9 cm según el largo
    // (subfusiles: algo más lejos; la mano de la empuñadura salía enorme delante de la cámara)
    const o = [0, 0, (t0 === "smg" ? 0.0 : t0 === "bullpup" ? -0.07 : THREE.MathUtils.clamp(0.06 + (m.length - 0.4) * 0.05, 0.05, 0.09)) + (t0 === "revolver" ? 0.025 : 0)];
    // La mira cae en el cuadrante derecho (x ≈ 62–68 %, y ≈ 53–56 %) y la mano de la empuñadura no sale por abajo
    const grip = new THREE.Vector3(m.handles.grip.x, m.handles.grip.y, 0).applyMatrix4(m.group.matrix);
    const tx = (t === "pistol" ? 0.22 : 0.3) + vx * 3, ty = (t === "pistol" ? -0.12 : -0.08) + vy * 3;
    for (let it = 0; it < 8; it++) {
      if (proj(grip, o)[1] < -0.72 && o[2] > -0.04) o[2] -= 0.012;
      const zz = -(base[2] + o[2]), [sx, sy] = proj(sight, o);
      o[0] = THREE.MathUtils.clamp(o[0] + (tx - sx) * w * zz * 0.8, -0.06, 0.09);
      o[1] = THREE.MathUtils.clamp(o[1] + (ty - sy) * h * zz * 0.8, -0.05, 0.07);
    }
    // La empuñadura siempre dentro de la pantalla (si no, el brazo no llega y la mano se queda flotando): en armas altas
    // (cargador largo, modelo grande) se sube el arma lo que haga falta, aunque la mira quede algo más alta
    for (let it = 0; it < 4; it++) { const gy = proj(grip, o)[1]; if (gy >= -0.78) break; o[1] += (-0.76 - gy) * h * -(base[2] + o[2] + grip.z) * 0.9; }
    o[1] = Math.min(o[1], 0.2);
    // La boca nunca cruza el centro
    const [mxn] = proj(muzzle, o); if (mxn < 0.06) o[0] += (0.06 - mxn) * w * -(base[2] + o[2] + muzzle.z);
    this.fit = [o[0], o[1], o[2], yaw];
  }
  /** Patada: pierna en primera persona que entra desde abajo; golpe fuerte con empuje (vale con puños o con arma). */
  private kickT = 0; private kickCd = 0; private kickDone = false; private leg: THREE.Group | null = null;
  private punchT = 0; private punchDur = 0.34; private punchSide: 1 | -1 = -1; private punchHeavy = false; private punchDone = false;
  private fistCd = 0; private fistTime = 0;
  private reloadPhase: Phase | null = null;
  private sprayIndex = 0; private sprayT = 0;
  private casings: { mesh: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; t: number }[] = [];
  /** Lo que la mano izquierda lleva durante la recarga: cargador rápido (revólver) y cartucho (escopeta). */
  private inHand: { loader: THREE.Group; shell: THREE.Mesh } | null = null;
  private lastPhaseId = "";

  constructor(private camera: THREE.PerspectiveCamera, private scene: THREE.Scene, private asm: WeaponAssembler, private world: THREE.Object3D[], readonly hooks: ShotHooks) {
    camera.add(this.viewmodel);
    this.viewmodel.add(this.sway); this.sway.add(this.holder); this.holder.add(this.anchor);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
    this.holder.add(this.flash, this.flashLight);
    this.arms = new Arms(camera);
  }

  get spec() { return this.item?.spec ?? null; }
  get reloading() { return this.reloadT > 0; }
  /** Apertura visual de la retícula al disparar (0 en reposo; se suma en ráfaga). */
  crossKick = 0;
  /** Dispersión actual en grados (la usa también la retícula). */
  spread(moving: number) {
    const s = this.spec; if (!s) return 1;
    const focus = this.fx?.spreadFocus(this.aimT) ?? 1;
    if (s.type === "shotgun") return 3.4 * (1 - this.aimT * 0.25) * focus;
    return ((100 - s.stats.precision) * 0.055 + 0.08) * (1 - this.aimT * 0.75) * (1 + moving * 0.6) * focus;
  }

  /** Compila los shaders de un objeto en segundo plano (lo pone main.ts con renderer.compileAsync). */
  prewarm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
  forget(uid: number) { this.cache.delete(uid); }
  modelFor(item: Item, rebuild = false): Promise<AssembledWeapon> {
    if (rebuild || !this.cache.has(item.uid)) this.cache.set(item.uid, this.asm.assemble(item.spec));
    return this.cache.get(item.uid)!;
  }

  /** Cambia de arma: primero guarda la actual (gesto inverso a sacarla) y luego saca la nueva. */
  async equip(item: Item | null, rebuild = false) {
    if (this.model && item !== this.item && !rebuild) {
      this.pending = { item, rebuild };
      if (this.holsterT <= 0) this.holsterT = this.anim.p.holster * (this.fx?.equipFast() ? 0.5 : 1);
      this.reloadT = 0; this.burstLeft = 0; this.inspectT = 0;
      return;
    }
    this.pending = null; this.holsterT = 0;
    return this.doEquip(item, rebuild);
  }
  /** Número de la última carga de modelo: solo la más reciente puede poner su modelo en la mano. */
  private equipSeq = 0;
  private async doEquip(item: Item | null, rebuild: boolean) {
    const seq = ++this.equipSeq;
    this.item = item; this.reloadT = 0; this.burstLeft = 0; this.inspectT = 0;
    this.fx = item ? new EffectRunner<Dummy, THREE.Vector3>(item.spec) : null;
    if (item && this.fx) { const now = performance.now() / 1000; this.fx.equip([...this.lastDealt].some(([uid, t]) => uid !== item.uid && now - t < 4)); }
    this.equipDur = item && this.fx?.equipFast() ? 0.22 : item ? drawTime(item.spec.type, item.spec.stats.manejo) : 0.4;
    this.equipT = this.equipDur;
    // Vaciar la mano del todo (no solo el modelo conocido): si dos cargas se cruzaban, quedaban dos armas apiladas
    for (const c of [...this.holder.children]) if (c !== this.flash && c !== this.flashLight && c !== this.anchor) this.holder.remove(c);
    this.model = null; this.mag = null; this.moving = {};
    for (const c of [...this.anchor.children]) this.anchor.remove(c);
    this.vmLocal = []; this.vmPts = []; this.vmScaled = []; this.vmScale = 1;
    if (!item) return;
    this.anim.setClass(item.spec.type, item.spec.hold?.stance);
    // Tipo de mira y aumentos (solo dependen del arma: se fijan ya, antes de cargar el modelo)
    const opt = accessory(item.spec.optic);
    const libZ = item.spec.optic ? this.asm.kitZoom(item.spec.optic) : undefined;
    // Pantalla de visor (con desenfoque alrededor) solo en miras de francotirador; ACOG, prismas y térmica se apuntan a
    // través del modelo con su aumento
    const sniperScope = !!item.spec.optic && (/^k-att-scope-|ltermica$/.test(item.spec.optic) || opt?.id === "acc:scope6");
    if (isIron(item.spec.optic)) { this.sight = "irons"; this.zoom = opt?.zoom ?? 1.1; }
    else if (libZ !== undefined) { this.sight = sniperScope ? "scope" : libZ <= 1.2 ? "dot" : "holo"; this.zoom = libZ <= 1.2 ? 1.3 : libZ; }
    else if (opt) { this.sight = sniperScope ? "scope" : opt.id === "acc:reddot" ? "dot" : "holo"; this.zoom = opt.zoom ?? 1; }
    else if (item.spec.optic) { this.sight = "scope"; this.zoom = 3; }                 // mira de modelo (cosmo)
    else { this.sight = "iron"; this.zoom = 1; } // (francotirador: visor solo si el modelo lo trae, ver abajo)
    const m = await this.modelFor(item, rebuild);
    // Sin mira montada: la de serie del modelo (alza → miras de hierro; punto rojo, holográfica, prisma, visor)
    if (!item.spec.optic && m.ownSight) {
      const k = m.ownSight.kind, z = m.ownSight.zoom;
      if (k === "alza") { this.sight = "irons"; this.zoom = 1.1; }
      else if (/^visor/.test(k)) { this.sight = "scope"; this.zoom = Math.max(2, z); }
      else { this.sight = k === "punto_rojo" ? "dot" : "holo"; this.zoom = k === "punto_rojo" || k === "holografica" ? 1.3 : Math.max(1.3, z); }
    }
    // (miras de hierro de serie montadas por el ensamblador: se apunta a través de ellas)
    // (también pistolas, revólveres y armas sin alza: el ensamblador les da una línea de mira por el lomo)
    if (!item.spec.optic && this.sight === "iron" && m.sightX !== undefined) { this.sight = "irons"; this.zoom = 1.1; }
    if (this.item !== item || seq !== this.equipSeq) return;
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.renderOrder = 10;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) if (this.env && "envMap" in mat) { mat.envMap = this.env; mat.needsUpdate = true; }
    });
    m.group.rotation.y = Math.PI / 2; // +X (boca) hacia -Z de la cámara
    m.group.updateMatrix();
    // Pivote del encogido de silueta: la empuñadura (la mano no se mueve al reducir el arma)
    // Tarea 13: armas sin pieza de empuñadura (culata recta, como muchas escopetas): el punto de agarre del ensamblador
    // quedaba bajo el arma, en el aire, y la mano derecha flotaba; se sube a la cara inferior real del arma en esa
    // columna (la garganta de la culata), un poco por dentro.
    if (!m.parts.some((p) => p.role === "grip") && !m.group.userData.gripFixed) {
      m.group.updateMatrixWorld(true);
      const inv = m.group.matrixWorld.clone().invert(), v = new THREE.Vector3(); let low = Infinity;
      for (const p of m.parts) { if (["magazine", "scope", "accessory", "device", "muzzle"].includes(p.role)) continue; p.object.traverse((o) => { const me = o as THREE.Mesh; if (!me.isMesh) return; const pos = me.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(me.matrixWorld).applyMatrix4(inv); if (Math.abs(v.x - m.handles.grip.x) < 0.025) low = Math.min(low, v.y); } }); }
      if (Number.isFinite(low) && low > m.handles.grip.y + 0.01) m.handles.grip.y = low + 0.012;
      m.group.userData.gripFixed = true;
    }
    this.gripOffset.set(m.handles.grip.x, m.handles.grip.y, m.handles.grip.z).applyMatrix4(m.group.matrix);
    this.muzzleOffset.set(m.muzzle.x, m.muzzle.y, m.muzzle.z).applyMatrix4(m.group.matrix);
    this.sightY = m.sightY ?? new THREE.Box3().setFromObject(m.group).max.y;
    // Visor integrado en el modelo (sin óptica añadida): solo si de verdad hay una pieza de mira con aumentos
    // (solo francotiradores: en otras armas esa pieza suele ser un asa con alza, que apunta como mira de hierro)
    if (!item.spec.optic && item.spec.type === "sniper" && m.parts.some((p) => p.role === "scope" && p.from.id !== "rail" && p.from.id !== "riser" && p.from.pack !== "kit39") && m.zoom > 1.5) {
      this.sight = "scope"; this.zoom = 4.5;
    }
    this.mag = m.parts.find((p) => p.role === "magazine") ?? null;
    this.moving = {};
    for (const role of ["slide", "pump", "charging"] as MovingPart[]) { const part = m.parts.find((p) => p.role === role); if (part) this.moving[role] = part; }
    // Escopeta de dos cañones: los cañones (y su guardamanos, banda y boca) giran sobre la bisagra del cajón
    this.breakParts = [];
    if (item.spec.archetype === "double") {
      const rp = m.parts.find((p) => p.role === "receiver" || p.role === "body");
      const bp = m.parts.filter((p) => ["barrel", "front", "top", "muzzle"].includes(p.role));
      if (rp && bp.length) {
        const rb = new THREE.Box3().setFromObject(rp.object), inv = m.group.matrixWorld.clone().invert(); rb.applyMatrix4(inv);
        this.hinge.set(rb.max.x - 0.005, rb.min.y + (rb.max.y - rb.min.y) * 0.25, 0);
        this.breakParts = bp.map((p) => ({ p, rz: p.object.rotation.z }));
      }
    }
    // Shaders del arma compilados en segundo plano mientras se saca (sin tirón al aparecer)
    if (this.prewarm) { await this.prewarm(m.group).catch(() => undefined); if (this.item !== item || seq !== this.equipSeq) return; }
    this.model = m; this.fitCurl = null; this.fit = null; this.fitTune = 0; this.fitAimed = false; this.fitAtypical = false; this.hipSol = null;
    this.buildDeviceFx(m);
    if (soundManifest) void loadSamples([...filesOfType(soundManifest, item.spec.type), ...(soundManifest.efectos.casquillo ?? [])]); this.fitWait = 12;
    // Rendimiento: dentro de cada pieza (que se anima entera) se fusionan sus mallas por material
    if (!m.group.userData.merged) { for (const p of m.parts) mergeStatic(p.object); m.group.userData.merged = true; }
    for (const c of [...this.holder.children]) if (c !== this.flash && c !== this.flashLight && c !== this.anchor) this.holder.remove(c);
    this.anchor.add(m.group);
    this.cacheVmPoints(m);
    this.flash.position.copy(this.muzzleOffset);
    this.flashLight.position.copy(this.flash.position);
  }

  /** Sonido de impacto según dónde y en qué: golpe seco en el cuerpo, chasquido agudo en la cabeza, tañido metálico en blindaje, crujido al matar. */
  private hitSound(kind: "body" | "head" | "metal" | "kill") {
    try {
      this.audio ??= audio();
      const a = this.audio, t = a.currentTime, g = a.createGain(); g.connect(out());
      const noise = (len: number, decay: number) => { const b = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay); const s = a.createBufferSource(); s.buffer = b; return s; };
      const tone = (type: OscillatorType, f0: number, f1: number, len: number, vol: number) => { const o = a.createOscillator(), og = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len); og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(0.0008, t + len); o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 0.02); };
      g.gain.value = 1;
      if (kind === "body") { const n = noise(0.07, 3), f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900; n.connect(f); const ng = a.createGain(); ng.gain.value = 0.22; f.connect(ng); ng.connect(g); n.start(t); tone("sine", 170, 70, 0.08, 0.16); }
      else if (kind === "head") { const n = noise(0.05, 4), f = a.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500; n.connect(f); const ng = a.createGain(); ng.gain.value = 0.16; f.connect(ng); ng.connect(g); n.start(t); tone("triangle", 2300, 1500, 0.12, 0.09); tone("sine", 240, 90, 0.07, 0.12); }
      else if (kind === "metal") { tone("sine", 980, 940, 0.18, 0.07); tone("sine", 1510, 1460, 0.14, 0.05); tone("square", 3100, 2600, 0.03, 0.02); const n = noise(0.03, 4); const ng = a.createGain(); ng.gain.value = 0.1; n.connect(ng); ng.connect(g); n.start(t); }
      else { const n = noise(0.16, 2), f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; n.connect(f); const ng = a.createGain(); ng.gain.value = 0.2; f.connect(ng); ng.connect(g); n.start(t); tone("sine", 140, 45, 0.2, 0.2); tone("square", 700, 1600, 0.1, 0.035); }
    } catch { /* sin audio */ }
  }
  private sfx(kind: "shot" | "reload" | "hit" | "crit" | "kill" | "empty" | "cycle" | "boom" | "sig", type?: WeaponType, quiet = false) {
    try {
      this.audio ??= audio();
      const a = this.audio, t = a.currentTime, g = a.createGain(); g.connect(out());
      if (kind === "shot" && type) { if (!this.sampleShot(type, quiet)) this.layeredShot(a, type, quiet); return; }
      if (kind === "empty" && soundManifest && type) { const f = soundManifest.tipos[type === "bullpup" ? "rifle" : type]?.seco?.[0]; if (f && playSample(sample(f), 0.5)) return; }
      if (kind === "boom" && soundManifest) { const l = soundManifest.efectos.explosion ?? [], f = l[Math.floor(Math.random() * l.length)]; if (playSample(sample(f), 0.7)) return; }
      if (kind === "shot" || kind === "boom") {
        const len = kind === "boom" ? 0.6 : type === "sniper" || type === "shotgun" || type === "revolver" ? 0.38 : 0.16;
        const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, kind === "boom" ? 1.5 : type === "sniper" ? 2 : 3.5);
        const src = a.createBufferSource(); src.buffer = buf;
        const f = a.createBiquadFilter(); f.type = "lowpass";
        f.frequency.value = kind === "boom" ? 500 : quiet ? 900 : ({ pistol: 2600, revolver: 1700, smg: 3000, sniper: 1400, shotgun: 1300, lmg: 2100, launcher: 600, flamethrower: 500 } as Record<string, number>)[type ?? "rifle"] ?? 2400;
        src.connect(f); f.connect(g); g.gain.value = kind === "boom" ? 0.4 : quiet ? 0.1 : 0.3; src.start(t);
      } else {
        const o = a.createOscillator();
        const c = { reload: [420, 700, 0.07, 0.05], hit: [1400, 1200, 0.03, 0.04], crit: [1900, 2400, 0.06, 0.06], kill: [700, 1600, 0.12, 0.06], empty: [220, 180, 0.04, 0.05], cycle: [300, 520, 0.06, 0.05], sig: [180, 90, 0.18, 0.05] }[kind];
        o.type = "square"; o.frequency.setValueAtTime(c[0], t); o.frequency.exponentialRampToValueAtTime(c[1], t + c[2]);
        g.gain.setValueAtTime(c[3], t); g.gain.exponentialRampToValueAtTime(0.001, t + c[2]);
        o.connect(g); o.start(t); o.stop(t + c[2] + 0.02);
      }
    } catch { /* sin audio */ }
  }

  /** Ruido blanco con envolvente, filtrado. */
  /** Barrido de aire de un puño o una patada que no da en nada: ruido grave filtrado, sin el silbido metálico. */
  private airWhoosh(k: number) {
    try { const a = audio(), t0 = a.currentTime; this.noise(a, 0.16 + 0.06 * k, 2.2, "bandpass", 380 + Math.random() * 120, 0.16 * k, t0, 0.9 + Math.random() * 0.1); this.noise(a, 0.1, 3, "lowpass", 250, 0.1 * k, t0 + 0.02); } catch { /* sin audio */ }
  }
  private noise(a: AudioContext, len: number, decay: number, filter: BiquadFilterType, freq: number, gain: number, when: number, rate = 1, dest: AudioNode = out()) {
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * len)), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const f = a.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(dest); src.start(when);
  }
  /**
   * Disparo por capas: ataque (chasquido), cuerpo (explosión filtrada por tipo), cola (eco, más larga bajo la
   * marquesina) y mecánica (cerrojo). Tono con variación aleatoria; el supresor apaga ataque y cuerpo.
   */
  /**
   * Disparo con muestras del pack: una al azar del tipo (silenciada si hay silenciador), más la capa grave a ~0,5, con
   * tono ±4 % y volumen ±10 %. En cadencia alta corta la cola del anterior. false si no hay muestras (→ síntesis).
   */
  private sampleShot(type: WeaponType, quiet: boolean): boolean {
    const m = soundManifest; if (!m) return false;
    const p = pickShot(m, type, quiet, Math.random, this.spec?.seed); if (!p) return false;
    // Revólver: siempre el disparo del Python (el del Judge sonaba a escopeta; el usuario pondrá otro más adelante)
    if (type === "revolver") { const py = m.tipos.revolver?.disparo.find((f) => /python/.test(f)); if (py) p.main = py; }
    // (si la suya aún no se ha cargado, otra ya cargada del mismo grupo: nunca la síntesis, que sonaba sin silenciador)
    let buf = sample(p.main);
    if (!buf) { const k = type === "bullpup" ? "rifle" : type, t = m.tipos[k], list = (p.quiet ? t?.silenciado : t?.disparo) ?? []; for (const f of list) { const b = sample(f); if (b) { buf = b; break; } } }
    if (!buf) return false;
    const a = audio(), now = a.currentTime;
    if (this.lastShot && now - this.lastShotT < 0.25) fadeOut(this.lastShot, 0.025);
    const rate = 0.96 + Math.random() * 0.08, vol = p.gain * (0.9 + Math.random() * 0.2) * (p.quiet ? 0.8 : 1);
    this.lastShot = playSample(buf, vol, rate); this.lastShotT = now;
    if (p.grave) playSample(sample(p.grave), vol * 0.5, rate);
    return true;
  }

  private layeredShot(a: AudioContext, type: WeaponType, quiet: boolean) {
    const t = a.currentTime, pitch = 0.94 + Math.random() * 0.12;
    const body: Record<string, [number, number, number]> = { pistol: [2400, 0.14, 0.32], revolver: [1500, 0.3, 0.42], smg: [2800, 0.12, 0.28], rifle: [2000, 0.18, 0.34], bullpup: [2100, 0.17, 0.33], shotgun: [1100, 0.34, 0.5], sniper: [1200, 0.42, 0.5], lmg: [1800, 0.2, 0.36] };
    const [freq, len, gain] = body[type] ?? body.rifle;
    const z = this.camera.position.z, indoor = z > 1.4 && z < 12.8;
    if (!quiet) this.noise(a, 0.02, 1, "highpass", 3500, gain * 0.6, t, pitch);              // ataque
    this.noise(a, len, 3, "lowpass", quiet ? 700 : freq, quiet ? gain * 0.3 : gain, t, pitch);  // cuerpo
    // cola: eco con retardo; bajo techo, más corta y más presente
    const delay = a.createDelay(); delay.delayTime.value = indoor ? 0.06 : 0.14;
    const fb = a.createGain(); fb.gain.value = indoor ? 0.35 : 0.25; delay.connect(fb); fb.connect(delay);
    const out = a.createGain(); out.gain.value = quiet ? 0.25 : 0.5; delay.connect(out); out.connect(masterOut());
    this.noise(a, len * (indoor ? 1.6 : 2.4), 2, "lowpass", indoor ? 900 : 600, gain * 0.35, t + 0.01, pitch, delay);
    setTimeout(() => { delay.disconnect(); fb.disconnect(); }, 2000);
    this.noise(a, 0.03, 2, "bandpass", 3200, 0.06, t + 0.035, pitch * 1.3);                // mecánica
  }

  /** ¿La escopeta equipada lleva cargador (cuelga bajo el cajón) en vez de tubo bajo el cañón? */
  private boxMagShotgun(): boolean {
    const mg = this.model?.parts.find((p) => p.role === "magazine"); if (!mg) return false;
    // (caja en ejes del arma: +X = boca; el arma en mano va girada)
    const g = this.model!.group; g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert(), b = new THREE.Box3(), v = new THREE.Vector3();
    mg.object.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; const pos = m.geometry.attributes.position; for (let i = 0; i < pos.count; i += 4) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv)); });
    const sz = b.getSize(new THREE.Vector3());
    return sz.y > sz.x * 0.8;
  }

  startReload() {
    const s = this.spec; if (!s || !this.item || this.reloadT > 0 || this.item.ammo >= s.stats.cargador || this.equipT > 0) return;
    // (tarea 13: tiempos por clase en gunfeel.ts; la de vacío dura algo más: hay que soltar la corredera o el cerrojo)
    let time = reloadTime(s.type, s.stats.manejo, this.item.ammo === 0);
    const missing = Math.max(1, s.stats.cargador - this.item.ammo);
    // Escopetas: con cargador (cuelga bajo el cajón), cambio de cargador; con tubo, cartucho a cartucho los que falten
    // (antes siempre 4) y solo se bombea si estaba vacía
    this.anim.reloadOverride = null;
    if (s.type === "shotgun" && this.model && s.archetype === "double") {
      // Basculante: abrir (los cañones caen sobre la bisagra), expulsar las vainas, meter uno o dos cartuchos y cerrar
      const n = Math.min(2, missing), ph: [string, number][] = [["tilt", 0.5], ["open", 0.55], ["eject", 0.45], ...Array.from({ length: n }, () => ["load", 1] as [string, number]), ["close", 0.5], ["settle", 0.45]];
      const tot = ph.reduce((a, x) => a + x[1], 0);
      this.anim.reloadOverride = { style: "break", phases: ph.map(([id, w]) => [id, w / tot] as [string, number]), tilt: [-0.12, 0.18, -0.3], drop: [0.02, 0.02, 0] };
      time = (0.95 + 0.4 * n) * (1.35 - s.stats.manejo / 200); this.breakEjected = false;
    } else if (s.type === "revolver" && this.actionOf?.(s) === "revolver_simple") {
      // Acción simple: se abre la portilla y se carga bala a bala, girando el tambor una recámara cada vez
      const ph: [string, number][] = [["tilt", 0.5], ["gate", 0.35], ...Array.from({ length: missing }, () => ["round", 1] as [string, number]), ["close", 0.35], ["settle", 0.45]];
      const tot = ph.reduce((a, x) => a + x[1], 0);
      this.anim.reloadOverride = { style: "gate", phases: ph.map(([id, w]) => [id, w / tot] as [string, number]), tilt: [-0.08, 0.35, 0.35], drop: [0.03, 0.04, 0] };
      time = (0.75 + 0.38 * missing) * (1.35 - s.stats.manejo / 200);
    } else if (s.type === "shotgun" && this.model) {
      if (this.boxMagShotgun()) {
        this.anim.reloadOverride = { style: "mag", phases: [["tilt", 0.14], ["grab", 0.12], ["out", 0.14], ["pouch", 0.16], ["in", 0.2], ["rack", 0.14], ["settle", 0.1]], mag: [-0.01, -0.2, 0], rackPart: "pump" };
      } else {
        const n = Math.max(1, s.stats.cargador - this.item.ammo), empty = this.item.ammo === 0;
        const ph: [string, number][] = [["tilt", 0.5], ...Array.from({ length: n }, () => ["shell", 1] as [string, number]), ...(empty ? [["rack", 0.7] as [string, number]] : []), ["settle", 0.4]];
        const tot = ph.reduce((a, x) => a + x[1], 0);
        this.anim.reloadOverride = { style: "shells", phases: ph.map(([id, w]) => [id, w / tot] as [string, number]) };
        time = (0.45 + 0.4 * n + (empty ? 0.35 : 0)) * (1.35 - s.stats.manejo / 200);
      }
    }
    time *= (this.fx?.reloadMult() ?? 1) * Math.max(0.5, 1 - this.perks.reload); // (armadura: recarga más rápida)
    this.reloadT = this.reloadDur = time; this.burstLeft = 0; this.inspectT = 0;
    this.tacReload = this.item.ammo > 0;
    // Variante de recarga fija del arma (por su semilla); cada paso suena en su fracción del tiempo de recarga
    this.reloadSnd = soundManifest ? pickReload(soundManifest, s.type, s.seed) : null; this.reloadDone = 0;
    // Revólver: cada paso del pack suena en su fase de la animación del tambor (abrir, vaciar, cargar, cerrar); con las
    // fracciones fijas del pack se oía el tambor cerrarse mientras la mano aún cargaba
    if (s.type === "revolver" && this.reloadSnd) {
      const phs = this.anim.p.reload.phases, at = (id: string, f: number) => { let acc = 0; for (const [p, w] of phs) { if (p === id) return acc + w * f; acc += w; } return null; };
      const PH: Record<string, [string, number]> = { abrir_tambor: ["open", 0.5], vaciar: ["eject", 0.4], cargar: ["load", 0.75], girar: ["close", 0.1], cerrar_tambor: ["close", 0.7] };
      const loads = this.reloadSnd.pasos.filter((p) => p.evento === "cargar").length; let k = 0;
      this.reloadSnd = { ...this.reloadSnd, pasos: this.reloadSnd.pasos.map((p) => {
        const m = PH[p.evento]; if (!m) return p;
        const f = p.evento === "cargar" && loads > 1 ? 0.5 + 0.4 * (k++ / (loads - 1)) : m[1];
        return { ...p, en: at(m[0], f) ?? p.en };
      }).sort((a, b) => a.en - b.en) };
    }
    if (s.type === "shotgun" && soundManifest) {
      const vs = soundManifest.tipos.shotgun?.recarga ?? [];
      const box = this.anim.reloadOverride?.style === "mag", v = vs.find((x) => x.id === (box ? "cargador" : "bombeo")) ?? null;
      // (cartucho a cartucho: un paso de carga por cada fase "shell" y el bombeo solo si se bombea)
      if (v && !box) {
        const phs = this.anim.reloadOverride!.phases!, loads = v.pasos.filter((p) => p.evento === "cargar_cartucho"), arm = v.pasos.filter((p) => p.evento === "armar");
        let acc = 0, k = 0; const pasos: RecargaVariante["pasos"] = [];
        for (const [id, w] of phs) { if (id === "shell") pasos.push({ ...loads[k++ % loads.length], en: acc + w * 0.55 }); if (id === "rack") arm.forEach((p, j) => pasos.push({ ...p, en: acc + w * (0.2 + 0.5 * j) })); acc += w; }
        this.reloadSnd = { id: v.id, pasos };
      } else this.reloadSnd = v;
    }
    if (!this.reloadSnd) this.sfx("reload");
  }

  update(dt: number, c: Control) {
    const s = this.spec, it = this.item;
    this.cooldown -= dt; this.equipT = Math.max(0, this.equipT - dt); this.cycleT = Math.max(0, this.cycleT - dt); this.cockT = Math.max(0, this.cockT - dt);
    if (this.holsterT > 0) { this.holsterT -= dt; if (this.holsterT <= 0 && this.pending) { const pnd = this.pending; this.pending = null; this.holsterT = 0; void this.doEquip(pnd.item, pnd.rebuild); } }
    this.fx?.tick(dt, { aiming: this.aimT > 0.6, firing: c.fire, sprinting: c.sprinting });
    this.sprintT += ((c.sprinting ? 1 : 0) - this.sprintT) * Math.min(1, dt * 8);
    this.crossKick = Math.max(0, this.crossKick - dt * (2.2 + (this.spec?.stats.manejo ?? 60) / 40));
    this.hitmarker = Math.max(0, this.hitmarker - dt); this.critmarker = Math.max(0, this.critmarker - dt); this.killmarker = Math.max(0, this.killmarker - dt);
    if (this.reloadT > 0 && this.reloadSnd) {
      const frac = 1 - (this.reloadT - dt) / this.reloadDur, steps = this.reloadSnd.pasos;
      while (this.reloadDone < steps.length && steps[this.reloadDone].en <= frac) { playSample(sample(steps[this.reloadDone].archivo), 0.55, 0.98 + Math.random() * 0.04); this.reloadDone++; }
    }
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && it && s) { it.ammo = s.stats.cargador; if (!this.reloadSnd) this.sfx("cycle"); this.fx?.reloadEnd(); } }
    if (c.inspect && s && this.reloadT <= 0 && this.aimT < 0.2) this.inspectT = 2.6;
    this.inspectT = Math.max(0, this.inspectT - dt);
    // Calor: se enfría solo; sobrecalentada no dispara hasta enfriarse
    if (this.overheatT > 0) { this.overheatT -= dt; if (this.overheatT <= 0) this.heat = 0.3; } else if (!c.fire) this.heat = Math.max(0, this.heat - dt * 0.3);
    // Atracción: los enemigos cercanos se acercan al centro (fuerza y duración con tope)
    for (const pl of this.pulls) { pl.t -= dt; for (const d of this.hooks.dummies()) { if (!d.alive) continue; const to = pl.at.clone().sub(d.group.position).setY(0), dist = to.length(); if (dist > 1.2 && dist < pl.radius) d.group.position.addScaledVector(to.normalize(), Math.min(dist - 1.2, 6 * dt)); } }
    this.pulls = this.pulls.filter((pl) => pl.t > 0);
    const busy = this.equipT > 0 || this.reloadT > 0 || c.sprinting || this.pending !== null || this.overheatT > 0;
    const canAim = !!s && !c.sprinting && this.reloadT <= 0;
    // (tarea 13: el tiempo de apuntar depende de la clase —0,15 s pistolas … 0,45 s ametralladoras— y del manejo)
    const adsSpeed = adsRate(adsTime(s?.type ?? "rifle", s?.stats.manejo ?? 50)) * (this.fx?.equipFast() ? 1.5 : 1) * (this.fx?.adsMult() ?? 1);
    this.aimT += ((c.aim && canAim ? 1 : 0) - this.aimT) * Math.min(1, dt * adsSpeed);
    if (c.aim || c.fire) this.inspectT = 0;

    // Disparo según el modo
    if (s && it && !busy) {
      const mode = this.fx?.autoFire() ? "auto" : s.fireMode; // modo furia: automático un rato
      const pressed = c.fire && !this.triggerHeld;
      if (this.burstLeft > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && it.ammo > 0) { this.fire(c.moving); this.burstLeft--; this.burstTimer = 60 / (s.stats.cadencia * 1.6); if (!this.burstLeft) this.cooldown = 0.28; }
        if (it.ammo <= 0) this.burstLeft = 0;
      } else if (this.cooldown <= 0 && this.cycleT <= 0 && (mode === "auto" ? c.fire : pressed)) {
        if (it.ammo > 0) {
          if (mode === "burst") { this.burstLeft = (s.burst || 3) - 1; this.burstTimer = 60 / (s.stats.cadencia * 1.6); }
          this.fire(c.moving);
        } else if (pressed) { this.sfx("empty", s?.type); this.startReload(); }
      }
    }
    if (!it && !this.pending) this.fistsInput(dt, c);
    this.kickInput(dt, c);
    this.triggerHeld = c.fire;
    this.sprayT += dt; if (this.sprayT > 0.35) this.sprayIndex = 0;
    this.updateCasings(dt);

    // Recuperación del retroceso
    const handling = s?.stats.manejo ?? 50;
    this.recoil += (0 - this.recoil) * Math.min(1, dt * (5 + handling / 12));
    this.recoilYaw += (0 - this.recoilYaw) * Math.min(1, dt * 8);

    // ---------- Animación (capa procedural: src/game/anim.ts) ----------
    // (encuadre por arma desactivado: empeoraba la mayoría; la pose de cadera es la de cada clase, como en la 0.16.0)
    if (FIT_ENABLED && this.model && (!this.fit || Math.abs(this.fitAspect - this.camera.aspect) > 0.01)) this.computeFit();
    // Progresos efectivos (con poseOverride) para las manos: así las capturas fijan la recarga/sacar sin tocar el reloj.
    const reloadIn = this.reloadT > 0 && s ? 1 - this.reloadT / this.reloadDur : null;
    this.reloadProg = this.poseOverride?.reload ?? reloadIn ?? 1;
    this.drawIn = this.poseOverride?.draw ?? (this.equipT > 0 ? this.equipT / this.equipDur : 0);
    this.inspectIn = this.poseOverride?.inspect !== undefined ? this.poseOverride.inspect : this.inspectT > 0 ? 1 - this.inspectT / 2.6 : null;
    this.keyed = this.keyState();
    const ks = this.keyed;
    const frame = this.anim.p.frame;
    if (this.model && frame && (!this.hipSol || Math.abs(this.hipAspect - this.camera.aspect) > 0.005)) {
      this.hipSol = solveHipFit(this.model.height ?? 0, this.gripOffset, this.muzzleOffset, frame, frame, VM_FOV, this.camera.aspect, VM_BACK); this.hipAspect = this.camera.aspect;
    }
    const pose = this.anim.update({
      dt, time: performance.now() / 1000, ads: this.aimT, moving: c.moving, sprinting: c.sprinting, grounded: c.grounded, vy: c.vy,
      lookX: c.lookX, lookY: c.lookY, length: this.model?.length ?? 0.3, bulk: this.model?.height, sightY: this.sightY, sightX: this.sight === "irons" ? this.model?.sightX : undefined, opticX: this.sight !== "irons" ? this.model?.opticX : undefined, gripX: this.model?.handles.grip.x, gripY: this.model?.handles.grip.y, fit: this.fit ?? undefined, hip: this.hipSol ?? undefined, iron: this.sight === "iron",
      reload: this.reloadT > 0 && s ? 1 - this.reloadT / this.reloadDur : null,
      draw: this.equipT > 0 ? this.equipT / this.equipDur : 0,
      holster: this.pending ? 1 - Math.max(0, this.holsterT) / Math.max(0.01, this.anim.p.holster) : 0,
      inspect: this.inspectT > 0 ? 1 - this.inspectT / 2.6 : null,
      cycle: this.cycleT > 0 ? 1 - this.cycleT / this.cycleDur : null, tactical: this.tacReload, cycleKind: this.spec?.fireMode === "bolt" ? "bolt" : this.spec?.fireMode === "pump" ? "pump" : undefined, cock: this.cockT > 0 ? 1 - this.cockT / 0.42 : null, empty: !!it && it.ammo <= 0,
      keyed: ks ? { reload: ks.action === "reload", inspect: ks.action === "inspect", draw: ks.action === "draw" } : undefined,
      ...this.poseOverride,
    });
    if (ks) this.applyKeyedGun(ks, pose);
    this.reloadPhase = pose.phase;
    if (this.mag) {
      this.mag.object.position.copy(this.mag.base).add(new THREE.Vector3(...pose.mag.offset)); this.mag.object.visible = pose.mag.visible;
      // Revólver: el tambor bascula hacia la izquierda (−Z del arma) mientras está abierto
      const ph = pose.phase, cyl = ks?.track.cyl ? sampleNum(ks.track.cyl, ks.t) : (this.anim.reloadOverride?.style ?? this.anim.p.reload.style) === "cylinder" && ph ? (ph.id === "open" ? ease(ph.t) : ph.id === "eject" || ph.id === "load" ? 1 : ph.id === "close" ? 1 - ease(ph.t) : 0) : 0;
      this.mag.object.position.add(new THREE.Vector3(0, -0.006 * cyl, -0.032 * cyl));
      this.mag.object.rotation.x = -0.45 * cyl;
      this.applyKeyedMag(ks);
    }
    // Revólver con pista: al vaciar (boca arriba) caen las vainas del tambor
    if (ks?.action === "reload" && this.spec?.type === "revolver") { if (ks.t >= 0.32 && !this.keyEjected) { this.keyEjected = true; this.ejectRounds(6); } }
    else this.keyEjected = false;
    // Basculante: los cañones giran sobre la bisagra; al abrir del todo salen las dos vainas
    if (this.breakParts.length) {
      const ph = pose.phase, st = this.anim.reloadOverride?.style;
      const ang = st === "break" && ph ? (ph.id === "open" ? ease(ph.t) : ph.id === "eject" || ph.id === "load" ? 1 : ph.id === "close" ? 1 - ease(Math.min(1, ph.t * 1.6)) : 0) : 0;
      const a = -0.55 * ang, c = Math.cos(a), sn = Math.sin(a);
      for (const { p, rz } of this.breakParts) {
        const d = p.base.clone().sub(this.hinge);
        p.object.position.set(this.hinge.x + d.x * c - d.y * sn, this.hinge.y + d.x * sn + d.y * c, p.base.z);
        p.object.rotation.z = rz + a;
      }
      if (st === "break" && ph?.id === "eject" && !this.breakEjected) { this.breakEjected = true; this.ejectShells(2); }
    }
    // Acción simple: el tambor gira una recámara (60°) por cada bala que entra
    if (this.mag && this.anim.reloadOverride?.style === "gate" && pose.phase) {
      const ph = pose.phase, k = ph.id === "round" ? ph.index - 2 + ease(Math.min(1, ph.t / 0.7)) : 0;
      this.mag.object.rotation.x = (k * Math.PI) / 3;
    }
    // Piezas móviles: la pieza retrocede a lo largo del arma (+X = boca)
    for (const [role, part] of Object.entries(this.moving) as [MovingPart, AssembledPart][]) part.object.position.copy(part.base).add(new THREE.Vector3(-pose.parts[role], 0, 0));
    const follow = this.snap ? 1 : 0;
    this.holder.position.lerp(new THREE.Vector3(...pose.pos), Math.max(follow, Math.min(1, dt * 22)));
    this.holder.rotation.set(
      THREE.MathUtils.lerp(this.holder.rotation.x, pose.rot[0], Math.max(follow, Math.min(1, dt * 18))),
      THREE.MathUtils.lerp(this.holder.rotation.y, pose.rot[1], Math.max(follow, Math.min(1, dt * 14))),
      THREE.MathUtils.lerp(this.holder.rotation.z, pose.rot[2], Math.max(follow, Math.min(1, dt * 16))));
    this.sway.rotation.set(...pose.swayRot); this.sway.position.set(...pose.swayPos);
    this.updateViewScale(dt);
    this.planAtypicalFit(pose);
    this.updateDevice(dt);
    // Ajuste fino del encuadre sobre la pose real (la estimación de computeFit no ve la inclinación de la pose): durante
    // el primer segundo y medio en cadera y quieto, se mide en pantalla la empuñadura y la mira y se corrige el desfase
    if (FIT_ENABLED && this.fit && this.model && this.fitTune < 1.5 && this.aimT < 0.02 && this.reloadT <= 0 && this.sprintT < 0.05 && this.equipT <= 0 && this.inspectT <= 0) {
      this.fitTune += dt;
      const m = this.model; m.group.updateMatrixWorld(true);
      const pr = (x: number, y: number) => new THREE.Vector3(x, y, 0).applyMatrix4(m.group.matrixWorld).project(this.camera);
      const g = pr(m.handles.grip.x, m.handles.grip.y), si = pr(m.sightX ?? m.handles.grip.x + 0.06, this.sightY);
      const handgun = this.spec?.type === "pistol" || this.spec?.type === "revolver";
      const ty = handgun ? -0.12 : -0.08;
      // Prioridad: la empuñadura dentro de la pantalla; después, la mira en su altura
      const ey = g.y < -0.78 ? -0.76 - g.y : g.y > -0.35 ? -0.37 - g.y : (ty - si.y) * 0.5;
      const ex = si.x < 0.12 ? 0.14 - si.x : si.x > 0.5 ? 0.48 - si.x : 0;
      const k = Math.min(1, dt * 6), d = -this.holder.position.z;
      this.fit[1] = THREE.MathUtils.clamp(this.fit[1] + ey * 0.35 * d * k, -0.08, 0.22);
      this.fit[0] = THREE.MathUtils.clamp(this.fit[0] + ex * 0.6 * d * k, -0.08, 0.12);
    }
    // Con visor de aumento, al apuntar del todo se ve a través del visor (el arma se oculta)
    this.viewmodel.visible = !this.hidden && !(this.sight === "scope" && this.aimT > 0.9);
    // Manos obligatorias (05-E): siempre que se ve el arma
    const fists = !this.item && !this.pending;
    this.arms.visible = !this.hidden && (fists || (this.viewmodel.visible && !!this.model));
    this.trigT = Math.max(0, this.trigT - dt * 9);
    this.onTrigT = Math.max(0, this.onTrigT - dt);
    if (c.fire) this.onTrigT = 1.2;
    if (this.helmetT >= 0 && (this.helmetT += dt) > Gun.HELMET_DUR) this.helmetT = -1;
    // Gesto de equipamiento/granada: solo avanza el tiempo (el daño no lo corta)
    if (this.gestureHold) this.gesture.set(this.gestureHold.kind, this.gestureHold.t);
    else this.gesture.update(dt);
    if (this.model) this.updateHands(dt); else if (fists) this.updateFists(dt);
    // Invocación de un súper: las manos siguen la línea de tiempo y el arma baja fuera de la vista
    this.arms.override = this.superPose ? { right: this.superPose.right, left: this.superPose.left } : null;
    if (this.superPose) { this.arms.update({ right: this.superPose.right, left: this.superPose.left, dt }); this.arms.visible = !this.hidden; }
    this.viewmodel.position.y = this.superPose ? -0.75 * this.superPose.lower : 0;

    // Efectos
    const fm = this.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = Math.max(0, fm.opacity - dt * 22); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 120);
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.t -= dt; (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.t / tr.max);
      if (tr.t <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    // Marcas de impacto: la rejilla destella un instante; el agujero se desvanece pasados ~15 s
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i]; d.t += dt;
      (d.glyph.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.9 - d.t * 1.2);
      if (d.t > 15) { const o = Math.max(0, 1 - (d.t - 15) / 3); d.mesh.traverse((x) => { const m = (x as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (m && x !== d.glyph) m.opacity = 0.85 * o; }); }
      if (d.t > 18) { this.scene.remove(d.mesh); this.decals.splice(i, 1); }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]; p.t -= dt; p.v.y -= 9 * dt; p.mesh.position.addScaledVector(p.v, dt);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p.t * 4);
      if (p.t <= 0) { this.scene.remove(p.mesh); this.sparks.splice(i, 1); }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.t -= dt; b.mesh.scale.setScalar(1 + (0.35 - b.t) * 9); (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.t / 0.35);
      if (b.t <= 0) { this.scene.remove(b.mesh); this.bursts.splice(i, 1); }
    }
  }

  /**
   * Recorte del arma en cadera por su silueta proyectada (encargo 46, recalibrado en el 50 y en el 54). Proyecta los
   * vértices muestreados del modelo con la cámara del viewmodel (`VM_FOV`, `VM_BACK`) y, solo si ocupa más de
   * `HIP_W_MAX`/`HIP_H_MAX` (o del alto de la clase) de la pantalla, encoge el modelo hasta esos límites (sin bajar de
   * `VM_SCALE_MIN`, sin alejarlo); el resto se ve exactamente igual que antes del 46. Las atípicas se alejan antes de
   * encoger (`planAtypicalFit`) y la clase puede pedir una silueta mayor (`hipScale`). El apuntado deshace todo ello
   * (1 en ADS) y el cambio va suavizado, sin saltos. Se usa la silueta real (vértices por pieza) y no las 8 esquinas
   * del AABB del conjunto: esa caja inventa esquinas que el modelo no tiene y en armas largas la culata queda junto a
   * la cámara, con lo que medía varias pantallas y encogía todas. La mano de apoyo sigue al arma (sus anclajes se
   * transforman con el grupo).
   */
  private updateViewScale(dt: number) {
    const m = this.model;
    let target = 1, rawW = 0, rawH = 0;
    if (m && this.vmPts.length) {
      this.viewmodel.updateMatrix(); this.sway.updateMatrix(); m.group.updateMatrix();
      this.vmMat2.multiplyMatrices(this.viewmodel.matrix, this.sway.matrix);
      this.vmOrigin.copy(this.gripOffset).applyQuaternion(this.holder.quaternion).add(this.holder.position).applyMatrix4(this.vmMat2);
      // Cadena hasta la cámara sin la escala del holder: se mide el arma a escala 1 (así el objetivo no depende del
      // encogido del fotograma anterior y el suavizado converge)
      this.vmMat.compose(this.holder.position, this.holder.quaternion, this.vmUnit);
      this.vmMat.premultiply(this.vmMat2).multiply(m.group.matrix);
      for (let i = 0; i < this.vmLocal.length; i++) {
        const l = this.vmLocal[i], p = this.vmPts[i];
        this.vmVec.set(l[0], l[1], l[2]).applyMatrix4(this.vmMat);
        p[2] = this.vmVec.z - VM_BACK;
        if (p[2] >= -0.02) { p[0] = NaN; p[1] = NaN; p[2] = NaN; } // (detrás del plano cercano: no se ve)
        else { p[0] = this.vmVec.x; p[1] = this.vmVec.y; }
      }
      const raw = projectedSize(this.vmPts, VM_FOV, this.camera.aspect, true);
      rawW = raw.w; rawH = raw.h;
      target = this.hipSol ? 1 : this.fitScale(raw); // (el encuadre por objetivos ya decide el tamaño: sin encoger)
    }
    this.vmScale = this.snap ? target : this.vmScale + (target - this.vmScale) * Math.min(1, dt * 8);
    // Encargo 54: la clase puede pedir una silueta mayor en cadera (subfusiles, que salían pequeños); `aimScale` la
    // deshace al apuntar, así que ADS no cambia.
    const s = aimScale(this.vmScale * (this.hipSol ? 1 : this.anim.p.hipScale ?? 1), this.aimT);
    // Encogido anclado en la empuñadura: escala `s` alrededor del pivote (la mano de la empuñadura no se mueve)
    this.anchor.scale.setScalar(s);
    this.anchor.position.copy(this.gripOffset).multiplyScalar(1 - s);
    // El fogonazo sigue a la boca con el mismo encogido anclado en la empuñadura
    this.flash.position.copy(this.gripOffset).multiplyScalar(1 - s).addScaledVector(this.muzzleOffset, s);
    this.flashLight.position.copy(this.flash.position);
    // Medida final (la que se ve): la misma silueta con la escala aplicada, para capturas y pruebas
    const fin = m && this.vmPts.length ? this.measureAt(s) : { w: 0, h: 0 };
    this.vmFit.w = fin.w; this.vmFit.h = fin.h; this.vmFit.rawW = rawW; this.vmFit.rawH = rawH; this.vmFit.scale = s;
  }

  /** Silueta proyectada (fracción de pantalla, recortada al viewport) con el arma escalada `s` sobre su empuñadura. */
  private measureAt(s: number): { w: number; h: number } {
    if (s === 1) return projectedSize(this.vmPts, VM_FOV, this.camera.aspect, true);
    const ox = this.vmOrigin.x, oy = this.vmOrigin.y, oz = this.vmOrigin.z - VM_BACK;
    while (this.vmScaled.length < this.vmPts.length) this.vmScaled.push([0, 0, 0]);
    for (let i = 0; i < this.vmPts.length; i++) {
      const p = this.vmPts[i], q = this.vmScaled[i];
      if (!Number.isFinite(p[0])) { q[0] = NaN; q[1] = NaN; q[2] = NaN; continue; }
      q[0] = ox + s * (p[0] - ox); q[1] = oy + s * (p[1] - oy); q[2] = oz + s * (p[2] - oz);
    }
    return projectedSize(this.vmScaled, VM_FOV, this.camera.aspect, true);
  }

  /**
   * Mayor escala de cadera que deja la silueta dentro de los límites (el alto puede venir de la clase: encargo 54).
   * `hipScale()` de vmfit da la estimación; el recorte de pantalla no es lineal con la escala (lo que sale de cuadro
   * deja de contar), así que se afina con una búsqueda alrededor de esa estimación; si ni con el suelo cabe, se queda
   * el suelo (normal o duro para las atípicas).
   */
  private fitScale(raw: { w: number; h: number }): number {
    const maxH = this.anim.p.hipMaxH ?? HIP_H_MAX;
    const cabe = (q: { w: number; h: number }) => q.w <= HIP_W_MAX + 1e-6 && q.h <= maxH + 1e-6;
    if (cabe(raw)) return 1;
    // Encargo 54: las atípicas ya se han alejado y convergido en `planAtypicalFit`; aquí solo queda el suelo duro.
    if (this.fitAtypical) return VM_SCALE_FLOOR;
    // Suelo normal (0,82) para todas (encargo 50); solo las atípicas que ya llenan la pantalla sin escalar (Partisan y
    // similares: silueta recortada de lado a lado) siguen encogiéndose hasta un suelo duro (encargo 51).
    const floor = raw.w >= 0.9 || raw.h >= 0.9 ? VM_SCALE_FLOOR : VM_SCALE_MIN;
    const est = Math.min(1, Math.max(floor, hipScale(raw.w, raw.h, floor, HIP_W_MAX, maxH)));
    let lo: number, hi: number;
    if (cabe(this.measureAt(est))) { lo = est; hi = 1; }
    else { lo = floor; hi = est; if (!cabe(this.measureAt(lo))) return floor; }
    for (let i = 0; i < 5; i++) { const mid = (lo + hi) / 2; if (cabe(this.measureAt(mid))) lo = mid; else hi = mid; }
    return lo;
  }

  /**
   * Encargo 54: silueta y anclas (empuñadura y boca) con un ajuste extra de cadera (`dx`, `dy`, `dz` en coordenadas de
   * la cámara, como `AnimInput.fit`) y la escala `s`, medidas con la cámara del arma: el mismo camino que el render,
   * sobre la pose de destino (sin el suavizado del fotograma).
   */
  private probeFit(s: number, dx: number, dy: number, dz: number, pos: THREE.Vector3, quat: THREE.Quaternion) {
    const m = this.model!;
    this.viewmodel.updateMatrix(); this.sway.updateMatrix(); m.group.updateMatrix();
    this.vmMat2.multiplyMatrices(this.viewmodel.matrix, this.sway.matrix);
    this.vmMatA.compose(this.vmVec.set(pos.x + dx, pos.y + dy, pos.z + dz), quat, this.vmUnit);
    // (encogido anclado en la empuñadura, como el render: T(g·(1−s)) · S(s))
    this.vmMatB.makeTranslation(this.gripOffset.x * (1 - s), this.gripOffset.y * (1 - s), this.gripOffset.z * (1 - s)).multiply(this.vmMatC.makeScale(s, s, s));
    this.vmMat.copy(this.vmMat2).multiply(this.vmMatA).multiply(this.vmMatB).multiply(m.group.matrix);
    while (this.vmProbe.length < this.vmLocal.length) this.vmProbe.push([0, 0, 0]);
    for (let i = 0; i < this.vmLocal.length; i++) {
      const l = this.vmLocal[i], p = this.vmProbe[i], v = this.vmVec.set(l[0], l[1], l[2]).applyMatrix4(this.vmMat);
      p[2] = v.z - VM_BACK;
      if (p[2] >= -0.02) { p[0] = NaN; p[1] = NaN; p[2] = NaN; } else { p[0] = v.x; p[1] = v.y; }
    }
    const size = projectedSize(this.vmProbe, VM_FOV, this.camera.aspect, true);
    const scr = (v: THREE.Vector3): [number, number] => {
      const q = this.vmVec.copy(v).applyMatrix4(this.vmMat), z = q.z - VM_BACK;
      if (z >= -0.02) return [NaN, NaN];
      const p = projectPoint([q.x, q.y, z], VM_FOV, this.camera.aspect);
      return p ?? [NaN, NaN];
    };
    const grip = scr(m.handles.grip), muzzle = scr(m.muzzle);
    const gripZ = this.vmVec.copy(m.handles.grip).applyMatrix4(this.vmMat).z - VM_BACK;
    return { w: size.w, h: size.h, grip, muzzle, gripZ };
  }

  /**
   * Encargo 54: las atípicas que aun con el suelo de escala no caben (la silueta se corta de lado a lado, como la
   * Partisan 233) se alejan y convergen antes de encogerlas. Se busca el menor alejamiento (z hacia delante de la
   * cámara) que, con la escala del suelo (0,78) y la convergencia de cadera de la clase, deja el alto en el objetivo
   * (≤ 0,56, se apunta a 0,55), conserva 0,40 de ancho y no saca la empuñadura ni la boca de su rango; el
   * desplazamiento lateral devuelve la empuñadura hacia su sitio (alejar la lleva al centro y encogía el cuadro).
   * Se calcula una vez por arma, en cadera, y se aplica con `AnimInput.fit` (se desvanece al apuntar: ADS no cambia).
   */
  private planAtypicalFit(pose: Pose) {
    if (!this.model || !this.vmLocal.length || this.hipSol) return; // (con encuadre por objetivos no hace falta)
    if (this.fitAimed) return;
    if (this.aimT > 0.02 || this.drawIn > 0.02 || this.reloadT > 0 || this.holsterT > 0 || this.sprintT >= 0.05 || this.inspectT > 0 || Math.abs(this.anim.kick) > 0.05) return;
    this.fitAimed = true;
    const raw = { w: this.vmFit.rawW, h: this.vmFit.rawH };
    // (solo las que llenan la pantalla sin escalar: el resto queda exactamente como está desde el encargo 51)
    if (raw.w < 0.9 && raw.h < 0.9) return;
    this.fitAtypical = true;
    const pos = this.vmPosePos.set(pose.pos[0], pose.pos[1], pose.pos[2]), quat = this.vmPoseQ.setFromEuler(this.vmPoseE.set(pose.rot[0], pose.rot[1], pose.rot[2]));
    const s = VM_SCALE_FLOOR, hMax = HIP_H_TALL - 0.002, wMin = HIP_W_MIN + 0.002;
    const base = this.probeFit(s, 0, 0, 0, pos, quat);
    const hh = Math.tan((VM_FOV * Math.PI) / 360), hw = hh * Math.max(1e-4, this.camera.aspect);
    const inR = (v: number, a: number, b: number) => v >= a - 1e-6 && v <= b + 1e-6;
    const gripOK = (p: { grip: [number, number] }) => inR(p.grip[0], 0.72, 0.92) && inR(p.grip[1], 0.78, 0.98);
    const muzzleOK = (p: { muzzle: [number, number] }) => inR(p.muzzle[0], 0.5, 0.62) && inR(p.muzzle[1], 0.45, 0.6);
    const cabe = (p: { w: number; h: number; grip: [number, number]; muzzle: [number, number] }) =>
      p.h <= hMax && p.w >= wMin && p.w <= HIP_W_MAX + 1e-6 && gripOK(p) && muzzleOK(p);
    let best: { d: [number, number, number]; score: number } | null = null;
    for (let dz = -0.02; dz >= -0.45 - 1e-9; dz -= 0.005) {
      // (compensación lateral: cuánto del desvío de la empuñadura se devuelve; 0 = ninguna, 1 = dejarla donde estaba)
      for (const c of [0.5, 0.65, 0.35, 0.8]) {
        let dx = 0, dy = 0, p = this.probeFit(s, 0, 0, dz, pos, quat);
        for (let it = 0; it < 3; it++) {
          const z = Math.max(0.1, -p.gripZ);
          dx += (base.grip[0] - p.grip[0]) * c * 2 * z * hw;
          dy -= (base.grip[1] - p.grip[1]) * c * 2 * z * hh;
          p = this.probeFit(s, dx, dy, dz, pos, quat);
        }
        const score = Math.max(0, p.h - hMax) * 20 + Math.max(0, wMin - p.w) * 20 + Math.max(0, p.w - HIP_W_MAX) * 5
          + (gripOK(p) ? 0 : 1) + (muzzleOK(p) ? 0 : 1);
        if (cabe(p)) { best = { d: [dx, dy, dz], score: 0 }; break; }
        if (!best || score < best.score - 1e-9) best = { d: [dx, dy, dz], score };
      }
      if (best && best.score <= 0) break;
    }
    if (best) this.fit = [best.d[0], best.d[1], best.d[2], 0];
  }

  /**
   * Vértices muestreados de la silueta del modelo en su espacio local (sin el FX del accesorio: su cono/haz mide
   * metros y no es el arma). Se muestrean hasta ~40 por malla: basta para la silueta y evita recorrer todas cada
   * fotograma (el encargo 46 permite medir al equipar y al cambiar de pose; aquí la pose solo mueve los puntos).
   */
  private cacheVmPoints(m: AssembledWeapon) {
    this.vmLocal = []; this.vmPts = []; this.vmScaled = []; this.vmScale = 1;
    m.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(m.group.matrixWorld).invert();
    const v = new THREE.Vector3();
    for (const p of m.parts) {
      if (!p.object.visible) continue;
      p.object.traverse((o) => {
        const me = o as THREE.Mesh;
        if (!me.isMesh || me.visible === false || !me.geometry) return;
        const mat = me.material as THREE.Material | THREE.Material[];
        if ((Array.isArray(mat) ? mat[0] : mat)?.visible === false) return;
        const pos = me.geometry.attributes.position;
        const step = Math.max(1, Math.ceil(pos.count / 40));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(me.matrixWorld).applyMatrix4(inv);
          this.vmLocal.push([v.x, v.y, v.z]);
        }
      });
    }
    for (let i = 0; i < this.vmLocal.length; i++) this.vmPts.push([0, 0, 0]);
  }

  /**
   * Puños: golpes alternos (izquierda, derecha) con un pequeño "imán" que acerca al jugador al blanco si está a pocos
   * metros, como el cuerpo a cuerpo de los shooters rápidos; al esprintar, golpe fuerte con más alcance y empuje.
   */
  private fistsInput(dt: number, c: Control) {
    this.fistCd -= dt;
    if (this.punchT > 0) { this.punchT += dt; if (this.punchT >= this.punchDur) this.punchT = 0; }
    const pressed = c.fire && !this.triggerHeld;
    if (pressed && this.fistCd <= 0 && this.equipT <= 0) {
      this.punchHeavy = c.sprinting; this.punchSide = this.punchHeavy ? 1 : (-this.punchSide as 1 | -1);
      this.punchDur = this.punchHeavy ? 0.5 : 0.34; this.punchT = 1e-4; this.punchDone = false;
      this.fistCd = this.punchHeavy ? 0.75 : 0.36;
      this.hooks.onShot?.();
      // Imán: si hay un blanco delante a menos de 4 m, embestida corta hacia él
      const eye = this.camera.getWorldPosition(new THREE.Vector3());
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
      let best: { d: number; dir: THREE.Vector3 } | null = null;
      for (const d of this.hooks.dummies()) {
        if (!d.alive) continue;
        const to = d.center.clone().sub(eye).setY(0); const dist = to.length(); to.normalize();
        if (dist < 4.2 && to.dot(fwd) > 0.82 && (!best || dist < best.d)) best = { d: dist, dir: to };
      }
      if (best && best.d > 1.3) this.hooks.lunge?.(best.dir, Math.min(best.d - 1.1, this.punchHeavy ? 3 : 2.2));
    }
    // El golpe se resuelve cuando el puño llega al final del recorrido
    if (this.punchT > 0 && !this.punchDone && this.punchT >= this.punchDur * 0.28) { this.punchDone = true; this.punchResolve(); }
  }
  private kickInput(dt: number, c: Control) {
    this.kickCd -= dt;
    if (c.kick && this.kickCd <= 0 && this.kickT <= 0 && this.equipT <= 0) {
      this.kickT = 1e-4; this.kickDone = false; this.kickCd = 0.85; this.hooks.onShot?.();
      this.airWhoosh(0.9);
    }
    const DUR = 0.55;
    if (this.kickT > 0) { this.kickT += dt; if (!this.kickDone && this.kickT >= DUR * 0.38) { this.kickDone = true; this.meleeHit(2.5, 55, 2.4, true); } if (this.kickT >= DUR) this.kickT = 0; }
    // Pierna: muslo y bota que suben desde abajo, se estiran al frente y vuelven
    if (!this.leg) {
      // (en el espacio de la pierna: el tobillo en el origen, la espinilla hacia +Z (hacia el jugador), la bota hacia −Z)
      const g = new THREE.Group(), pants = new THREE.MeshStandardMaterial({ color: 0x3e4652, roughness: 0.9 }), boot = new THREE.MeshStandardMaterial({ color: 0x2e2822, roughness: 0.7 });
      const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 12).rotateX(Math.PI / 2), pants); shin.position.set(0, 0.03, 0.32); g.add(shin);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.068, 0.07, 12).rotateX(Math.PI / 2), boot); cuff.position.set(0, 0.03, 0.06); g.add(cuff);
      const upper = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.2), boot); upper.position.set(0, 0, -0.06); g.add(upper);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 8), boot); toe.scale.set(1, 0.75, 1.1); toe.position.set(0, -0.012, -0.16); g.add(toe);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.3), new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.95 })); sole.position.set(0, -0.06, -0.08); g.add(sole);
      const lace = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.12), new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 })); lace.position.set(0, 0.052, -0.04); g.add(lace);
      g.traverse((o) => { o.renderOrder = 9; }); g.visible = false; this.camera.add(g); this.leg = g;
    }
    const k = this.kickT > 0 ? this.kickT / DUR : 0, ext = k <= 0 ? 0 : k < 0.38 ? ease(k / 0.38) : 1 - ease((k - 0.38) / 0.62);
    this.leg.visible = k > 0 && !this.hidden;
    // (la pierna apunta hacia abajo con la bota abajo; al patear gira hacia delante y sube hasta el centro de la vista)
    // (sube desde abajo y se estira al frente, con la puntera algo hacia arriba en el golpe)
    this.leg.position.set(0.12 - 0.07 * ext, -0.85 + 0.55 * ext, -0.35 - 0.4 * ext);
    this.leg.rotation.set(-0.9 + 1.05 * ext, -0.05, 0.1 - 0.08 * ext);
  }
  /** Golpe cuerpo a cuerpo genérico (patada): rayos en abanico delante de la cámara. */
  private meleeHit(reach: number, dmg: number, push: number, kick: boolean) {
    const eye = this.camera.getWorldPosition(new THREE.Vector3()), q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    this.meleeProp(eye, q, reach);
    const targets = this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes);
    for (const [ox, oy] of [[0, 0], [0.1, 0], [-0.1, 0], [0, -0.12], [0, 0.08]]) {
      const dir = new THREE.Vector3(ox, oy, -1).normalize().applyQuaternion(q);
      this.ray.set(eye, dir); this.ray.far = reach;
      const hit = this.ray.intersectObjects(targets, false)[0]; if (!hit) continue;
      const d = hit.object.userData.dummy as Dummy, zone = hit.object.userData.zone as Zone, alive = d.alive;
      this.hooks.onHit(d, zone, hit.point, dmg, null, false);
      d.push(dir.clone().setY(0).normalize(), push);
      this.spark(hit.point, dir.clone().negate(), 10, 0xcff6f8); this.hitmarker = 0.15;
      { const l = soundManifest?.efectos.melee_culatazo; if (l?.length) playSample(sample(l[0]), 0.7, kick ? 0.8 : 1); }
      if (alive && !d.alive) { this.killmarker = 0.35; this.hitSound("kill"); this.hooks.onKill?.(d); } else this.hitSound("body");
      this.recoil += 0.03; return;
    }
  }
  /** Golpes a objetos del escenario que reaccionan (saco de boxeo, asistente, drones): llevan `userData.onShot`. */
  private meleeProp(eye: THREE.Vector3, q: THREE.Quaternion, reach: number) {
    this.ray.set(eye, new THREE.Vector3(0, 0, -1).applyQuaternion(q)); this.ray.far = reach;
    const hit = this.ray.intersectObjects(this.world, true)[0];
    if (hit) (hit.object.userData.onShot as ((p: THREE.Vector3) => void) | undefined)?.(hit.point);
  }
  private punchResolve() {
    const eye = this.camera.getWorldPosition(new THREE.Vector3()), q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    this.meleeProp(eye, q, this.punchHeavy ? 2.6 : 2.2);
    const targets = this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes);
    const reach = this.punchHeavy ? 2.6 : 2.2;
    for (const [ox, oy] of [[0, 0], [0.08, 0], [-0.08, 0], [0, 0.08], [0, -0.08]]) {
      const dir = new THREE.Vector3(ox, oy, -1).normalize().applyQuaternion(q);
      this.ray.set(eye, dir); this.ray.far = reach;
      const hit = this.ray.intersectObjects(targets, false)[0]; if (!hit) continue;
      const d = hit.object.userData.dummy as Dummy, zone = hit.object.userData.zone as Zone, crit = zone === "head";
      // Cuerpo a cuerpo de emergencia (como en los shooters rápidos): no compite con un arma
      const dmg = (this.punchHeavy ? 40 : 20) * (crit ? 1.25 : 1);
      const alive = d.alive;
      this.hooks.onHit(d, zone, hit.point, dmg, null, crit);
      d.push(dir.clone().setY(0).normalize(), this.punchHeavy ? 1.4 : 0.5);
      this.spark(hit.point, dir.clone().negate(), this.punchHeavy ? 10 : 5, crit ? 0xffe08a : 0xcff6f8);
      if (crit) this.critmarker = 0.15; else this.hitmarker = 0.12;
      // (puñetazo: golpe sordo, no el de cuchillo; el fuerte, más grave)
      { const l = soundManifest?.efectos.melee_culatazo; if (l?.length) playSample(sample(l[0]), this.punchHeavy ? 0.65 : 0.5, this.punchHeavy ? 0.85 : 1.15 + Math.random() * 0.1); }
      if (alive && !d.alive) { this.killmarker = 0.35; this.hitSound("kill"); this.hooks.onKill?.(d); } else this.hitSound(zone === "head" ? "head" : "body");
      this.recoil += this.punchHeavy ? 0.03 : 0.014; this.recoilYaw += (Math.random() - 0.5) * 0.01; // sacudida de impacto
      return;
    }
    this.airWhoosh(this.punchHeavy ? 1 : 0.75); // golpe al aire: barrido de aire (no el filo de un cuchillo)
  }
  /** Pose de los puños en guardia (espacio de la cámara) y animación del golpe, del esprint y de sacarlos. */
  private updateFists(dt: number) {
    this.fistTime += dt;
    const tm = this.fistTime, sp = this.sprintT;
    const raise = this.equipDur > 0 ? ease(1 - this.equipT / this.equipDur) : 1;
    const breathe = Math.sin(tm * 1.7) * 0.006;
    const k = this.punchT > 0 ? this.punchT / this.punchDur : 0;
    const ext = k <= 0 ? 0 : k < 0.28 ? ease(k / 0.28) : 1 - ease((k - 0.28) / 0.72);
    const fist = (side: 1 | -1): HandPose => {
      // Guardia: puños cerrados a la altura del pecho, algo adelantados, hacia dentro y arriba; al esprintar bajan y
      // se balancean alternos. El dorso mira arriba, afuera y hacia la cámara (así se ven los nudillos, no la muñeca).
      // (tarea 13, referencia del usuario: guardia relajada estilo Apex/Source, puños bajos y separados, cerca de la
      //  cámara, con las palmas mirándose y el pulgar arriba; el antebrazo baja en diagonal a cada esquina)
      const base = new THREE.Vector3(side * 0.135, -0.105 + breathe - 0.3 * (1 - raise) + (side > 0 ? 0.006 : 0), -0.32);
      base.y -= 0.06 * sp; base.z += Math.sin(tm * 9 + (side > 0 ? 0 : Math.PI)) * 0.07 * sp;
      const hitting = this.punchT > 0 && side === this.punchSide;
      let pos = base, back = new THREE.Vector3(side * 0.45, 0.25, -0.86); // dorso al frente y afuera: se ven los dedos cerrados y el pulgar, como en la referencia
      if (hitting) {
        // Recto al centro de la pantalla con giro de muñeca; el fuerte, más largo
        // (tarea 13: más cerca y algo más bajo: al fondo del centro el antebrazo se veía de punta, como un tubo, y tapaba el puño)
        const target = new THREE.Vector3(side * 0.04, this.punchHeavy ? -0.07 : -0.09, this.punchHeavy ? -0.52 : -0.47);
        pos = base.clone().lerp(target, ext);
        back = back.lerp(new THREE.Vector3(side * 0.3, 0.45, -0.84), ext); // al golpear, la muñeca gira y el dorso queda arriba
      } else if (this.punchT > 0) pos = base.clone().add(new THREE.Vector3(0, 0.01 * ext, 0.05 * ext)); // la otra se recoge
      // Dedos en puño (falanges cerradas) y pulgar cruzado sobre ellos; nudillos arriba y al frente.
      // (nudillos hacia delante, algo arriba y hacia dentro; puño bien cerrado y muñeca casi recta)
      const fingersDir = new THREE.Vector3(-side * 0.3, 0.97, -0.05).lerp(new THREE.Vector3(-side * 0.72, 0.4, -0.57), hitting ? ext : 0); // (al golpear, el puño gira hacia el centro y se ven los dedos cerrados: de punta, la muñequera lo tapaba)
      return { pos, orient: handBasis(fingersDir, back), curl: { fingers: [1.75, 1.75, 1.75, 1.75], thumb: 1.25 }, thumbTurn: 1.35, fore: new THREE.Vector3(side * 0.5, -0.78, 0.38).lerp(new THREE.Vector3(side * 0.32, -0.94, 0.12), hitting ? ext : 0) };
    };
    // Gesto de equipamiento/granada sobre la mano libre (también sin arma equipada)
    const gk = this.gesture.kind, gc = this.gesture.curve(), fl = fist(-1), fr = fist(1);
    const left = gk && gc && this.gesture.side === -1 ? this.gestureHand(fl, -1, gc, gk) : fl;
    const right = gk && gc && this.gesture.side === 1 ? this.gestureHand(fr, 1, gc, gk) : fr;
    this.arms.update({ right, left: this.helmetLeft(left), dt, shoulder: new THREE.Vector3(0, 0, -0.06 * ext) });
  }
  /** El cargador vacío cae al suelo (copia del real, con física simple como los casquillos). */
  private dropMag() {
    const src = this.mag!.object; src.updateMatrixWorld(true);
    const c = src.clone(true); src.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.traverse((o) => { o.renderOrder = 0; });
    this.scene.add(c);
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    this.casings.push({ mesh: c, vel: new THREE.Vector3(-0.2, -0.6, 0.15).applyQuaternion(camQ), spin: new THREE.Vector3(2 + Math.random() * 3, Math.random(), 3 + Math.random() * 3), t: 4 });
  }
  /** Cargador rápido del revólver y cartucho de escopeta en la mano izquierda, en las fases en que se llevan. */
  private updateInHand(m: AssembledWeapon, ph: Phase | null, style: string) {
    if (!this.inHand) {
      const loader = new THREE.Group();
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.016, 8), new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.5 })); knob.position.y = -0.012; loader.add(knob);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0x2a2b2e, metalness: 0.5, roughness: 0.4 })); loader.add(disc);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const rd = new THREE.Mesh(casingGeo.small, brassMat); rd.position.set(Math.cos(a) * 0.011, 0.012, Math.sin(a) * 0.011); loader.add(rd); }
      loader.rotation.z = -Math.PI / 2; // las balas apuntan hacia la boca (+X del arma)
      const shell = new THREE.Mesh(casingGeo.shell, shellMat); shell.rotation.z = -Math.PI / 2;
      this.inHand = { loader, shell };
    }
    const { loader, shell } = this.inHand;
    if (loader.parent !== m.group) { m.group.add(loader, shell); }
    loader.visible = shell.visible = false;
    if (!ph) return;
    const h = m.handles;
    if (style === "cylinder" && ph.id === "load" && ph.t > 0.45) {
      const cyl = this.mag ? this.mag.object.position.clone().sub(this.mag.base) : new THREE.Vector3();
      const atCyl = h.magwell.clone().add(cyl), pouch = h.magwell.clone().add(new THREE.Vector3(-0.02, -0.25, 0.04));
      loader.position.copy(pouch.lerp(atCyl, ease(Math.min(1, (ph.t - 0.45) / 0.4)))).add(new THREE.Vector3(-0.012, 0, -0.03));
      loader.visible = true;
    } else if (style === "shells" && ph.id === "shell" && ph.t < 0.6) {
      const pouch = h.magwell.clone().add(new THREE.Vector3(-0.02, -0.25, 0.04));
      shell.position.copy(pouch.lerp(h.magwell, ease(Math.min(1, ph.t / 0.5)))).add(new THREE.Vector3(0.012, 0.004, -0.028));
      shell.visible = true;
    }
  }
  /** Basculante abierta: las vainas saltan hacia atrás desde la recámara. */
  private ejectShells(n: number) {
    const m = this.model; if (!m) return;
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(casingGeo.shell, shellMat); mesh.position.copy(m.group.localToWorld(this.hinge.clone().add(new THREE.Vector3(0.01, 0.015, (i - 0.5) * 0.02))));
      this.scene.add(mesh);
      this.casings.push({ mesh, vel: new THREE.Vector3(0.3 + (i - 0.5) * 0.4, 2.2 + Math.random() * 0.4, 1.4).applyQuaternion(camQ), spin: new THREE.Vector3(Math.random() * 12, Math.random() * 12, Math.random() * 12), t: 2.5 });
    }
    const l = soundManifest?.efectos.casquillo; if (l?.length) playSample(sample(l[0]), 0.3, 0.8, audio().currentTime + 0.4);
  }
  /** Casquillo expulsado por la ventana del cajón, con física simple. */
  private ejectCasing() {
    const s = this.spec!; const m = this.model; if (!m || s.type === "revolver" || s.archetype === "double") return; // (la basculante expulsa al abrirla)
    // Casquillo al caer al suelo (efectos del pack)
    { const l = soundManifest?.efectos.casquillo; if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), 0.25, 0.95 + Math.random() * 0.1, audio().currentTime + 0.35 + Math.random() * 0.15); }
    const big = s.type === "sniper" || s.type === "shotgun";
    const geo = s.type === "shotgun" ? casingGeo.shell : big ? casingGeo.big : casingGeo.small;
    const mesh = new THREE.Mesh(geo, s.type === "shotgun" ? shellMat : brassMat);
    const port = m.group.localToWorld(m.handles.charge.clone().add(new THREE.Vector3(0.02, -0.01, 0)));
    mesh.position.copy(port);
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const vel = new THREE.Vector3(1.6 + Math.random() * 0.6, 1.2 + Math.random() * 0.6, 0.4).applyQuaternion(camQ);
    this.scene.add(mesh);
    this.casings.push({ mesh, vel, spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20), t: 2.5 });
    if (this.casings.length > 40) { const old = this.casings.shift()!; this.scene.remove(old.mesh); }
  }
  private updateCasings(dt: number) {
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i]; c.t -= dt;
      c.vel.y -= 9.8 * dt; c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
      if (c.mesh.position.y < 0.01) { c.mesh.position.y = 0.01; c.vel.multiplyScalar(0.35); c.vel.y = Math.abs(c.vel.y) * 0.5; c.spin.multiplyScalar(0.5); }
      if (c.t <= 0) { this.scene.remove(c.mesh); this.casings.splice(i, 1); }
    }
  }

  /** Manos: la derecha en la empuñadura; la izquierda en el guardamanos o siguiendo la fase de recarga / corredera. */
  // ---------- Tarea 13: animación por poses clave (vmpose.ts + vmtracks.ts) ----------
  /** Acción que anima ahora una pista de poses clave, con su progreso (0..1); null = la animación procedural de antes. */
  private keyState(): Gun["keyed"] {
    const s = this.spec; if (!s || !this.model) return null;
    if (this.reloadT > 0 || this.poseOverride?.reload != null) {
      // (recargas especiales con su propio estilo —escopetas de cartuchos, basculantes, portilla— siguen como estaban)
      const st = this.anim.reloadOverride?.style;
      if (st === "shells") { this.shellTrack ??= shotgunShells(this.anim.reloadOverride!.phases!); return { action: "reload", t: this.reloadProg, track: this.shellTrack }; }
      if (st && st !== "mag") return null;
      const tr = (!this.tacReload ? trackFor(s.type, "reloadEmpty") : null) ?? trackFor(s.type, "reload");
      return tr ? { action: "reload", t: this.reloadProg, track: tr } : null;
    }
    this.shellTrack = null;
    if (this.inspectIn !== null) { const tr = trackFor(s.type, "inspect"); return tr ? { action: "inspect", t: this.inspectIn, track: tr } : null; }
    if (this.drawIn > 0) { const tr = trackFor(s.type, "draw"); return tr ? { action: "draw", t: 1 - this.drawIn, track: tr } : null; }
    return null;
  }
  /** Suma la pose del arma de la pista (desplazamiento en la cámara y giro con pivote en la empuñadura) y la corredera. */
  private applyKeyedGun(ks: NonNullable<Gun["keyed"]>, pose: Pose) {
    if (ks.track.gun) {
      const o = sampleVec(ks.track.gun, ks.t, [0, 0, 0, 0, 0, 0] as Gun6);
      const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rot[0], pose.rot[1], pose.rot[2]));
      pose.rot[0] += o[3]; pose.rot[1] += o[4]; pose.rot[2] += o[5];
      const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(pose.rot[0], pose.rot[1], pose.rot[2]));
      // (gira alrededor de la mano derecha: la muñeca mueve el arma, no el centro del modelo)
      const d = this.gripOffset.clone().applyQuaternion(q0).sub(this.gripOffset.clone().applyQuaternion(q1));
      pose.pos[0] += o[0] + d.x; pose.pos[1] += o[1] + d.y; pose.pos[2] += o[2] + d.z;
    }
    if (ks.track.slide) {
      const v = sampleNum(ks.track.slide, ks.t), p = this.anim.p;
      if ((this.spec?.type === "pistol" || p.cycle.part === "pump") && p.cycle.part) pose.parts[p.cycle.part] = p.cycle.travel * v;
      else if (p.reload.rackPart) pose.parts[p.reload.rackPart] = Math.max(pose.parts[p.reload.rackPart], p.reload.rackTravel * v);
    }
  }
  /** Cargador según la pista: en su sitio, en el brocal desplazado, en la mano (lo coloca `keyedLeft`) u oculto; al pasar
   *  del brocal a oculto (recarga en vacío) se suelta el viejo y cae. */
  private applyKeyedMag(ks: Gun["keyed"]) {
    const mg = this.mag;
    if (!mg || !ks?.track.mag || this.spec?.type === "revolver") { this.keyMagPrev = "seat"; this.keyMagOut = 0; this.keyMagHand = false; return; }
    const st = sampleMag(ks.track.mag, ks.t);
    if (this.keyMagPrev === "well" && st.mode === "hide" && this.keyMagOut > 0.02) this.dropMag();
    mg.object.visible = st.mode !== "hide";
    mg.object.position.copy(mg.base);
    if (st.mode === "well") mg.object.position.y -= st.out;
    this.keyMagPrev = st.mode; this.keyMagOut = st.out; this.keyMagHand = st.mode === "hand";
  }
  /** Vainas del tambor del revólver: caen del tambor abierto. */
  private ejectRounds(n: number) {
    const m = this.model; if (!m) return;
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const at = this.mag ? this.mag.object.position.clone() : m.handles.magwell.clone();
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(casingGeo.small, brassMat); mesh.position.copy(m.group.localToWorld(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02))));
      this.scene.add(mesh);
      this.casings.push({ mesh, vel: new THREE.Vector3(-0.3 + Math.random() * 0.4, -0.4 - Math.random() * 0.6, 0.2 + Math.random() * 0.3).applyQuaternion(camQ), spin: new THREE.Vector3(Math.random() * 14, Math.random() * 14, Math.random() * 14), t: 2.5 });
    }
    const l = soundManifest?.efectos.casquillo; if (l?.length) playSample(sample(l[0]), 0.35, 1.1, audio().currentTime + 0.35);
  }
  /** Mano izquierda de la pista: mezcla las dos poses clave del tramo (anclas del arma o de la cámara). */
  private keyedLeft(ks: NonNullable<Gun["keyed"]>, rest: HandPose | null, m: AssembledWeapon, toCam: (p: THREE.Vector3) => THREE.Vector3, hq: THREE.Quaternion, sup: THREE.Vector3): HandPose | null {
    const sl = sampleLeft(ks.track.left, ks.t); if (!sl) return rest;
    // (sin mano de apoyo en reposo —pistola a una mano—, su «reposo» es fuera de cuadro, abajo a la izquierda)
    const restP: HandPose = rest ?? { pos: V(-0.24, -0.5, -0.18), orient: hq.clone().multiply(GRIPS.grab.q), curl: SHAPES.relax };
    const h = m.handles;
    const magOff = this.mag ? this.mag.object.position.clone().sub(this.mag.base) : new THREE.Vector3();
    const anchor = (a: LeftKey["at"]): THREE.Vector3 | null => {
      switch (a) {
        case "magwell": return h.magwell.clone();
        case "mag": case "cyl": return h.magwell.clone().add(magOff);
        case "support": return sup.clone();
        case "charge": case "slide": return h.charge.clone();
        case "grip": return h.grip.clone();
        case "muzzle": return m.muzzle.clone();
        default: return null;
      }
    };
    const resolve = (L: LeftKey): HandPose => {
      let pos: THREE.Vector3;
      if (L.at === "rest") { pos = restP.pos.clone(); if (L.offW) pos.add(V(...L.offW).applyQuaternion(hq)); }
      else if (L.at === "cam") pos = new THREE.Vector3();
      else { const a = anchor(L.at)!; if (L.offW) a.add(V(...L.offW)); pos = toCam(a); }
      if (L.off) pos.add(V(...L.off));
      const orient = L.dir ? hq.clone().multiply(handBasis(V(...L.dir), V(...(L.up ?? [-0.3, 0.8, 0.5]))))
        : L.at === "rest" ? restP.orient.clone()
        : handBasis(toCam(h.grip).sub(pos).lengthSq() > 1e-6 ? toCam(h.grip).sub(pos) : V(1, 0, -0.5), V(-0.3, 0.8, 0.5));
      const curl = L.hand ? SHAPES[L.hand] : L.at === "rest" ? restP.curl : SHAPES.grab;
      return { pos, orient, curl };
    };
    const A = resolve(sl.a), B = resolve(sl.b), k = sl.k;
    const out: HandPose = {
      pos: A.pos.lerp(B.pos, k), orient: A.orient.slerp(B.orient, k),
      curl: { fingers: A.curl.fingers.map((f, i) => f + (B.curl.fingers[i] - f) * k) as Curl["fingers"], thumb: A.curl.thumb + (B.curl.thumb - A.curl.thumb) * k },
      straight: rest?.straight ?? 0.4,
    };
    // Cargador en la mano: va con ella (un poco por encima de la palma, hacia los dedos)
    if (this.keyMagHand && this.mag) {
      const p = out.pos.clone().add(V(0, 0.02, -0.03).applyQuaternion(out.orient));
      const local = m.group.worldToLocal(this.camera.localToWorld(p));
      this.mag.object.position.copy(this.mag.base).add(local.sub(h.magwell)); this.mag.object.visible = true;
    }
    // Escopeta: el cartucho va en los dedos mientras la mano lo lleva a la ventana
    if (this.inHand && this.anim.reloadOverride?.style === "shells" && ks.action === "reload") {
      const show = sl.b.hand === "pinch" && sl.b.at === "grip" && sl.a.hand === "pinch" && sl.k < 0.98 && !!sl.b.off && sl.b.off[1] > -0.05;
      this.inHand.shell.visible = show;
      if (show) this.inHand.shell.position.copy(m.group.worldToLocal(this.camera.localToWorld(out.pos.clone().add(V(0, 0.012, -0.04).applyQuaternion(out.orient)))));
    }
    // Revólver: el cargador rápido va en la mano izquierda mientras viene y se mete
    if (this.inHand && this.spec?.type === "revolver" && ks.action === "reload") {
      const show = ks.t > 0.5 && ks.t < 0.72;
      this.inHand.loader.visible = show;
      if (show) this.inHand.loader.position.copy(m.group.worldToLocal(this.camera.localToWorld(out.pos.clone().add(V(0, 0.015, -0.035).applyQuaternion(out.orient)))));
    }
    return out;
  }

  private updateHands(dt: number) {
    const m = this.model!; const h = m.handles;
    // La cámara primero: si no, el arma se calculaba con la rotación de la cámara del fotograma anterior y las manos
    // con la del actual, y al girar los brazos saltaban en proporción a la velocidad de giro
    this.camera.updateMatrixWorld(true);
    const toCam = (p: THREE.Vector3) => this.camera.worldToLocal(m.group.localToWorld(p.clone()));
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion()).invert();
    // (clone: multiply modifica camQ, y luego hq salía con la rotación del mundo dentro; las manos dependían de hacia
    // dónde se miraba y al girar los brazos se retorcían)
    const orient = camQ.clone().multiply(this.holder.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)));
    // Mano de apoyo según el perfil de agarre: su soporte en la cadera y al apuntar (con transición suave); sin soporte,
    // la mano baja fuera de la vista (pistola a una mano)
    const hold = this.spec?.hold, A = h.anchors, k = ease(Math.min(1, Math.max(0, this.poseOverride?.ads ?? this.aimT)));
    /** Punto válido (existe y no es NaN/Infinity): una pieza sin malla dejaba anclajes en NaN y la mano desaparecía. */
    const fin = (p: THREE.Vector3 | null | undefined): p is THREE.Vector3 => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
    // (una pistola sin culata se sujeta a una mano y su apoyo es la empuñadura; con culata, como un arma larga)
    const twoHanded = !hold ? true : hold.stance !== "hip";
    const at = (s: Support | undefined) => {
      if (!s || s === "none") return null;
      if (s === "custom") { // agarre libre: a lo largo del arma, entre la empuñadura y la boca, a la altura del guardamanos
        const f = Math.min(1, Math.max(0, hold?.at ?? 0.5)), x0 = h.grip.x + 0.07, x1 = Math.min(m.muzzle.x - 0.04, h.grip.x + 0.42);
        return new THREE.Vector3(x0 + (x1 - x0) * f, (A.front ?? h.support).y, 0);
      }
      // (anclaje que el arma no tiene o que salió inválido: en armas largas y pistolas con culata, al guardamanos; nunca
      // a la empuñadura, que era agarrarla como una pistola y la izquierda quedaba encima de la derecha)
      if (fin(A[s])) return A[s]!.clone();
      if (fin(h.support) && twoHanded) return h.support.clone();
      if (fin(A.grip) && !twoHanded) return A.grip!.clone();
      return fin(h.support) ? h.support.clone() : null;
    };
    const rest = h.grip.clone().add(new THREE.Vector3(-0.05, -0.24, -0.12));
    // Pistolas y revólveres: en la cadera a una mano (la otra entra al apuntar), como en los shooters de referencia;
    // si el jugador eligió otro agarre en el banco, se respeta
    const handgun = this.spec?.type === "pistol" || this.spec?.type === "revolver";
    // (variedad: cada pistola trae su agarre de serie, a una o a dos manos; ya no se fuerza a una mano)
    const hipS: Support | undefined = hold?.hip;
    const hipP = at(hipS ?? "front"), adsP = at(hold?.ads ?? "front");
    let base: THREE.Vector3 | null = hipP && adsP ? hipP.lerp(adsP, k) : adsP ? (k < 0.03 ? null : rest.clone().lerp(adsP, k)) : hipP ? (k > 0.97 ? null : hipP.lerp(rest, k)) : null;
    if (!hold && !base) base = h.support.clone();
    // La mano de apoyo no se estira más allá de un brazo cómodo (en armas largas se iba a la punta del guardamanos)
    // (y nunca más allá del 55 % del tramo empuñadura→boca: en armas cortas como la MP5K agarraba el cañón)
    const sReach = this.spec?.type === "bullpup" ? Math.min(0.17, Math.max(0.06, (m.muzzle.x - h.grip.x) * 0.4)) : this.spec?.type === "smg" ? Math.min(0.24, Math.max(0.06, (m.muzzle.x - h.grip.x) * 0.5)) : Math.min(this.spec?.type === "shotgun" ? 0.24 : 0.3, Math.max(0.06, (m.muzzle.x - h.grip.x) * 0.5)); // (escopetas: la mano se iba a la punta del tubo)
    // (tarea 13: salvo en la empuñadura vertical o el cargador, que son piezas concretas: recortarla dejaba la mano
    //  7 cm por detrás de la empuñadura vertical, agarrando el aire)
    const sNow = (k > 0.5 ? hold?.ads : hipS) ?? "front";
    if (base && sNow !== "vgrip" && sNow !== "mag" && base.x - h.grip.x > sReach) base.x = h.grip.x + sReach;
    // …y nunca pegada a la empuñadura cuando agarra el guardamanos (en armas por código el guardamanos empezaba junto a
    // la empuñadura y la mano izquierda quedaba encima de la derecha, como con una pistola)
    const sup0 = (k > 0.5 ? hold?.ads : hipS) ?? "front";
    if (base && (sup0 === "front" || sup0 === "pump" || sup0 === "frame") && this.spec?.type !== "pistol" && this.spec?.type !== "revolver") {
      const sMin = Math.min(sReach, this.spec?.type === "bullpup" ? 0.1 : this.spec?.type === "smg" ? Math.max(0.14, (m.muzzle.x - h.grip.x) * 0.35) : Math.max(0.2, (m.muzzle.x - h.grip.x) * 0.32));
      if (base.x - h.grip.x < sMin) base.x = h.grip.x + sMin;
    }
    const sup = base ?? (fin(A.grip) ? A.grip!.clone() : fin(h.support) ? h.support.clone() : h.grip.clone()); // a dónde vuelve la mano tras recargar
    // Anclas del recorrido real (src/data/poses.json): reposo, cargador, cartuchera (baja, para sacar) y punto alto
    // (corredera/tambor, para inspeccionar). En espacio del modelo, como `sup`.
    const pouch = h.magwell.clone().add(new THREE.Vector3(-0.02, -0.25, 0.04));
    const tipo = this.spec?.type;
    // Armas cortas: la cartuchera del recorrido real se ancla en un punto visible abajo a la izquierda de la vista
    // (en espacio de cámara y convertido al del modelo), no 25 cm bajo el arma, que la sacaba de cuadro.
    const handPouch = tipo === "pistol" || tipo === "revolver"
      ? m.group.worldToLocal(this.camera.localToWorld(new THREE.Vector3(-0.09, -0.13, -0.30)))
      : pouch;
    // Punto alto (corredera/tambor) de la inspección: en armas cortas se mantiene a una distancia mínima de la cámara
    // (la inspección salía «muy pegada» y la mano llenaba la pantalla); se empuja por el mismo rayo de vista, así el
    // encuadre no cambia de lado.
    // Punto alto de la inspección: corredera/tambor en armas cortas (separado de la cámara para que la mano no llene
    // la vista) y cerrojo/palanca de carga en las largas (subfusiles y escopetas con dato de inspección).
    let highP = handgun ? new THREE.Vector3(sup.x + 0.03, sup.y + 0.05, sup.z) : h.charge.clone();
    if (handgun) {
      const hc = toCam(highP); if (hc.z > -0.37) hc.z = -0.37;
      highP = m.group.worldToLocal(this.camera.localToWorld(hc));
    }
    const anchors = {
      rest: [sup.x, sup.y, sup.z] as [number, number, number],
      mag: [h.magwell.x, h.magwell.y, h.magwell.z] as [number, number, number],
      far: [handPouch.x, handPouch.y, handPouch.z] as [number, number, number],
      high: [highP.x, highP.y, highP.z] as [number, number, number],
    };
    let left: THREE.Vector3 | null = base;
    /** Curvatura de los dedos para esta mano de apoyo si el recorrido real la trae (si no, la del agarre). */
    let pathCurl: Curl | null = null;
    /** Giro de muñeca de la referencia y punto al que apuntan los dedos (marco del arma), si la secuencia lo trae. */
    let pathOrient: V4 | null = null, pathTarget: THREE.Vector3 | null = null;
    const ph = this.keyed ? null : this.reloadPhase, style = this.anim.reloadOverride?.style ?? this.anim.p.reload.style;
    const phId = ph ? `${ph.index}:${ph.id}` : "";
    if (phId !== this.lastPhaseId && ph?.id === "pouch" && style === "mag" && this.mag) this.dropMag();
    this.lastPhaseId = phId;
    this.updateInHand(m, ph, style);
    const pumpOff = new THREE.Vector3(-(this.moving.pump ? this.moving.pump.base.x - this.moving.pump.object.position.x : 0), 0, 0);
    if (ph && style === "shells") {
      // Cartucho a cartucho. Con recorrido real (poses.json): la mano viaja del guardamanos a la ventana de carga
      // durante el primer cartucho, alimenta ahí (con el empujón de cada uno) y vuelve al guardamanos en el último
      // para recoger el bombeo. Sin dato, el vaivén procedural de siempre.
      const phs = this.anim.reloadOverride?.phases ?? this.anim.p.reload.phases;
      let s0 = -1, s1 = -1;
      phs.forEach(([id], i) => { if (id === "shell") { if (s0 < 0) s0 = i; s1 = i; } });
      const f = ph.id !== "shell" ? -1 : ph.index === s0 ? ph.t * 0.5 : ph.index === s1 ? 0.5 + ph.t * 0.5 : 0.5;
      const real = f >= 0 ? sequencePathAt(tipo ?? "", "reload", f, anchors, this.spec!.seed) : null;
      const ori = f >= 0 ? sequenceOrientAt(tipo ?? "", "reload", f, anchors, this.spec!.seed) : null;
      if (ph.id === "rack") left = sup.clone().add(pumpOff);
      else if (real) {
        left = new THREE.Vector3(real.pos[0], real.pos[1], real.pos[2]);
        left.x += 0.02 * tri(ph.t, 0.5, 1); // (empujón de cada cartucho hacia la recámara)
        pathCurl = real.curl;
        if (ori) { pathOrient = ori; pathTarget = h.magwell.clone(); }
      } else if (ph.id === "shell") left = ph.t < 0.5 ? pouch.clone().lerp(h.magwell, ease(ph.t * 2)) : h.magwell.clone().add(new THREE.Vector3(0.02 * tri(ph.t, 0.5, 1), 0.01 * tri(ph.t, 0.5, 1), 0));
      else if (ph.id === "settle") left = h.magwell.clone().lerp(sup, ease(ph.t));
      else left = sup.clone().lerp(h.magwell, ease(ph.t));
    } else if (ph && style === "break") {
      // Basculante: la mano baja los cañones (empuja el guardamanos), va a la canana y mete los cartuchos en la
      // recámara, y sube los cañones para cerrar
      const ang = ph.id === "open" ? ease(ph.t) : ph.id === "eject" || ph.id === "load" ? 1 : ph.id === "close" ? 1 - ease(Math.min(1, ph.t * 1.6)) : 0;
      const a = -0.55 * ang, d = sup.clone().sub(this.hinge), onFore = new THREE.Vector3(this.hinge.x + d.x * Math.cos(a) - d.y * Math.sin(a), this.hinge.y + d.x * Math.sin(a) + d.y * Math.cos(a), sup.z);
      const breech = this.hinge.clone().add(new THREE.Vector3(0.02, 0.03, 0));
      if (ph.id === "load") left = ph.t < 0.5 ? onFore.clone().lerp(pouch, ease(ph.t * 2)) : pouch.clone().lerp(breech, ease((ph.t - 0.5) * 2));
      else if (ph.id === "close") left = breech.clone().lerp(onFore, ease(Math.min(1, ph.t * 2)));
      else if (ph.id === "settle") left = onFore.clone().lerp(sup, ease(ph.t));
      else left = onFore;
    } else if (ph && style === "gate") {
      // Portilla: la mano de apoyo va y viene de la cartuchera a la portilla (lado derecho del tambor) con cada bala
      const gate = h.magwell.clone().add(new THREE.Vector3(-0.005, 0.012, 0.03));
      if (ph.id === "round") left = ph.t < 0.5 ? gate.clone().lerp(pouch, ease(ph.t * 2)) : pouch.clone().lerp(gate, ease((ph.t - 0.5) * 2));
      else if (ph.id === "gate" || ph.id === "tilt") left = sup.clone().lerp(gate, ease(ph.t));
      else if (ph.id === "close") left = gate;
      else if (ph.id === "settle") left = gate.clone().lerp(sup, ease(ph.t));
    } else if (ph && style === "cylinder") {
      // Revólver: la mano bascula el tambor (sale a la izquierda), lo vacía, mete un cargador rápido y lo cierra.
      // Si hay recorrido real (poses.json), lo sigue con el tambor abierto como ancla central.
      const cyl = this.mag ? this.mag.object.position.clone().sub(this.mag.base) : new THREE.Vector3();
      const atCyl = h.magwell.clone().add(cyl);
      const real = sequencePathAt(tipo ?? "revolver", "reload", this.reloadProg,
        { ...anchors, mag: [atCyl.x, atCyl.y, atCyl.z] }, this.spec!.seed);
      const ori = sequenceOrientAt(tipo ?? "revolver", "reload", this.reloadProg,
        { ...anchors, mag: [atCyl.x, atCyl.y, atCyl.z] }, this.spec!.seed);
      if (real) {
        left = new THREE.Vector3(real.pos[0], real.pos[1], real.pos[2]);
        pathCurl = real.curl;
        if (ori) { pathOrient = ori; pathTarget = atCyl; }
      } else if (ph.id === "open") left = sup.clone().lerp(atCyl, ease(ph.t));
      else if (ph.id === "eject") left = atCyl;
      else if (ph.id === "load") left = ph.t < 0.45 ? atCyl.clone().lerp(pouch, ease(ph.t / 0.45)) : pouch.clone().lerp(atCyl, ease(Math.min(1, (ph.t - 0.45) / 0.4)));
      else if (ph.id === "close") left = atCyl.clone().add(new THREE.Vector3(0, 0, 0.02 * tri(ph.t, 0, 1)));
      else if (ph.id === "settle") left = atCyl.clone().lerp(sup, ease(ph.t));
    } else if (ph) {
      // Recarga real por clase (src/data/poses.json, generado desde los aportes). Fusiles/bullpups conservan su
      // recorrido; pistolas, revólveres, subfusiles, cerrojos y ametralladoras usan `reload_empty` cuando el cargador
      // estaba vacío. Sin dato, camino procedural.
      const seq: HandSequence = tipo && EMPTY_RELOAD.includes(tipo) && !this.tacReload && hasSequence(tipo, "reload_empty")
        ? "reload_empty" : "reload";
      const prog = this.reloadProg;
      const real = sequencePathAt(tipo ?? "", seq, prog, anchors, this.spec!.seed)
        ?? (seq !== "reload" ? sequencePathAt(tipo ?? "", "reload", prog, anchors, this.spec!.seed) : null);
      const ori = sequenceOrientAt(tipo ?? "", seq, prog, anchors, this.spec!.seed)
        ?? (seq !== "reload" ? sequenceOrientAt(tipo ?? "", "reload", prog, anchors, this.spec!.seed) : null);
      if (real) {
        left = new THREE.Vector3(real.pos[0], real.pos[1], real.pos[2]);
        pathCurl = real.curl;
        if (ori) { pathOrient = ori; pathTarget = h.magwell.clone(); }
      } else {
        const mag = this.mag ? this.mag.object.position.clone().sub(this.mag.base) : new THREE.Vector3();
        const atMag = h.magwell.clone().add(mag);
        if (ph.id === "grab") left = sup.clone().lerp(atMag, ease(ph.t));
        else if (ph.id === "out") left = atMag;
        else if (ph.id === "pouch") {
          // Ida a la cartuchera con la mano vacía (el cargador viejo cae al suelo) y vuelta con el nuevo en la mano
          // La cartuchera está abajo a la izquierda de la vista (en espacio de cámara; el arma va girada al recargar)
          const away = m.group.worldToLocal(this.camera.localToWorld(new THREE.Vector3(-0.16, -0.5, -0.22)));
          if (ph.t < 0.5) left = atMag.clone().lerp(away, ease(ph.t * 2));
          else {
            left = away.clone().lerp(atMag, ease((ph.t - 0.5) * 2));
            if (this.mag) { this.mag.object.visible = true; this.mag.object.position.copy(this.mag.base).add(left.clone().sub(h.magwell)); }
          }
        }
        else if (ph.id === "in") left = atMag;
        else if (ph.id === "rack" && !this.tacReload) left = h.charge.clone().add(new THREE.Vector3(-0.05 * tri(ph.t, 0, 1), 0.01, 0.03));
        else if (ph.id === "rack") left = atMag.clone().lerp(sup, ease(ph.t)); // táctica: la mano vuelve directa al guardamanos
        else if (ph.id === "settle") left = this.tacReload ? sup.clone() : h.charge.clone().lerp(sup, ease(ph.t));
      }
    } else if (this.cycleT > 0 && this.spec?.fireMode === "pump") {
      left = this.moving.pump ? sup.clone().add(pumpOff) : sup.clone().add(new THREE.Vector3(-0.08 * pumpCurve(1 - this.cycleT / this.cycleDur).pull, 0, 0));
    }
    // Cerrojo: lo acciona la mano derecha (va a la manilla, a la derecha del cajón, tira atrás y vuelve); la izquierda sujeta
    // (cuatro tiempos: a la manilla, arriba, atrás, adelante, abajo y de vuelta a la empuñadura)
    const bc = this.cycleT > 0 && this.spec?.fireMode === "bolt" ? boltCurve(1 - this.cycleT / this.cycleDur) : null;
    const reach = bc?.reach ?? 0;
    const rightAt = h.grip.clone().lerp(h.charge.clone().add(new THREE.Vector3(-0.02, -0.012, 0.045)), reach)
      .add(new THREE.Vector3(-0.075 * (bc?.pull ?? 0), 0.018 * (bc?.lift ?? 0), 0.012 * (bc?.lift ?? 0)));
    // Agarre de cada mano (marco del arma en primera persona: -Z boca, +Y arriba, +X derecha)
    const hq = camQ.clone().multiply(this.holder.getWorldQuaternion(new THREE.Quaternion())); void orient;
    const kind: HandKind = ph ? (style === "shells" ? (ph.id === "rack" ? "under" : "grab") : ph.id === "rack" || ph.id === "settle" ? "grab" : "grab")
      : supportKind(left && base && left.equals(base) ? (k > 0.5 ? hold?.ads : hold?.hip) : undefined, this.spec?.type);
    const pose = (at: THREE.Vector3, g: HandGrip, curl: Curl): HandPose => ({ pos: toCam(at).add(g.off.clone().applyQuaternion(hq)), orient: hq.clone().multiply(g.q), curl });
    // Índice siempre en el gatillo (sin disciplina de gatillo); al disparar aprieta un poco más
    const R = this.spec?.type === "pistol" || this.spec?.type === "revolver" ? GRIPS.rightHandgun : GRIPS.right, sp = this.sprintT;
    // Dedos que rodean la empuñadura de verdad: unos fotogramas después de equipar (la mano ya está en su sitio) se busca
    // el cierre de cada dedo que apoya sus falanges en la superficie de la empuñadura (antes era fijo y en armas de
    // empuñadura fina los dedos quedaban flotando)
    if (!this.fitCurl && this.fitWait > 0 && --this.fitWait === 0) {
      const pts: THREE.Vector3[] = [];
      m.group.updateMatrixWorld(true);
      for (const p of m.parts) if (p.role === "grip" || p.role === "frame" || p.role === "body" || p.role === "receiver") p.object.traverse((o) => {
        const mm = o as THREE.Mesh; if (!mm.isMesh) return; const pos = mm.geometry.attributes.position;
        // (vértices y puntos dentro de cada triángulo: en caras grandes, solo con los vértices el dedo parecía lejos)
        const idx = mm.geometry.index, n = idx ? idx.count : pos.count, at = (k: number) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(k) : k).applyMatrix4(mm.matrixWorld);
        for (let t = 0; t + 2 < n; t += 3) {
          const a = at(t), b = at(t + 1), c = at(t + 2); pts.push(a, b, c);
          for (const [u, w] of [[1 / 3, 1 / 3], [0.6, 0.2], [0.2, 0.6], [0.2, 0.2]]) pts.push(a.clone().multiplyScalar(1 - u - w).addScaledVector(b, u).addScaledVector(c, w));
        }
      });
      if (pts.length) this.fitCurl = this.arms.rightHand.fitCurls((q) => { let d = Infinity; for (const x of pts) { const e = x.distanceToSquared(q); if (e < d) d = e; } return Math.sqrt(d); });
    }
    const fc = this.fitCurl;
    const trig = 0.85 + 0.25 * this.trigT - 0.1 * sp;
    // (armas cortas: el índice va cerrado sobre el gatillo y el pulgar pegado al armazón; recto, el índice se veía
    //  larguísimo y el pulgar asomaba hacia arriba —«dedos deformes y demasiado largos»—)
    const shortGun = this.spec?.type === "pistol" || this.spec?.type === "revolver";
    let right = pose(rightAt, R, reach > 0.3 ? { fingers: [0.5, 0.55, 0.6, 0.65], thumb: 0.55 } : { fingers: [fc ? Math.max(shortGun ? 1.2 : 0.85, fc[0] - 0.12) + 0.15 * this.trigT - 0.1 * sp : trig, Math.max(1.7, fc?.[1] ?? 1.02) - 0.1 * sp, Math.max(1.7, fc?.[2] ?? 1.06) - 0.1 * sp, Math.max(1.7, fc?.[3] ?? 1.1) - 0.1 * sp], thumb: (shortGun ? 0.55 : fc ? Math.min(0.62, fc[4]) : 0.62) - 0.15 * sp });
    // (tarea 13: muñeca casi recta pero sin seguir del todo el eje de la mano: con 1 el antebrazo venía hacia la cámara y
    //  se veía como un bloque enorme abajo a la derecha)
    if (this.spec?.type === "pistol" || this.spec?.type === "revolver") right.straight = 0.35;
    // (el pulgar del modelo, aun cerrado, salía hacia fuera a 45°: con su giro pasa por delante y rodea la empuñadura)
    if (reach <= 0.3) right.thumbTurn = 0.75;
    const L = GRIPS[kind], lc = L.curl;
    const loose: Curl = { fingers: lc.fingers.map((f) => f - 0.2 * sp) as Curl["fingers"], thumb: lc.thumb - 0.15 * sp };
    // Hombros: siguen la mitad de los movimientos rápidos del arma (retroceso, balanceo) respecto a su media lenta
    const hc = this.camera.worldToLocal(this.holder.getWorldPosition(new THREE.Vector3()));
    if (!this.holdAvg) this.holdAvg = hc.clone(); else this.holdAvg.lerp(hc, Math.min(1, dt * 2.5));
    const shoulder = hc.clone().sub(this.holdAvg).multiplyScalar(0.5).clampLength(0, 0.08);
    // Agarre a dos manos derivado del reposo de la referencia (pistolas y revólveres)
    const gdat = tipo === "pistol" || tipo === "revolver" ? gripAt(tipo, anchors, this.spec?.seed ?? 0) : null;
    // Sacar e inspeccionar con el recorrido real: el apoyo llega desde abajo al sacar y sube a la corredera/tambor
    // (armas cortas) o al cerrojo/palanca (largas con dato) al inspeccionar. Su reposo es la pose de apoyo, para no
    // saltar al acabar.
    if (!this.keyed && left && base && (gdat || hasSequence(tipo ?? "", "draw") || hasSequence(tipo ?? "", "inspect"))) {
      // Armas cortas: reposo en el agarre a dos manos derivado de la referencia; largas: el propio apoyo del arma.
      let restL: [number, number, number] = anchors.rest;
      if (gdat) {
        const r = m.group.worldToLocal(this.camera.localToWorld(right.pos.clone()));
        restL = [r.x + gdat.offset[0], r.y + gdat.offset[1], r.z + gdat.offset[2]];
      }
      const ga = { ...anchors, rest: restL };
      const kDraw = this.drawIn > 0 ? 1 - this.drawIn : -1;
      const kInsp = this.inspectIn !== null ? tri(this.inspectIn, 0, 1) : -1;
      const k = kDraw >= 0 ? kDraw : kInsp;
      const seq = kDraw >= 0 ? "draw" : "inspect";
      const real = k >= 0 ? sequencePathAt(tipo ?? "", seq, k, ga, this.spec!.seed) : null;
      const ori = k >= 0 ? sequenceOrientAt(tipo ?? "", seq, k, ga, this.spec!.seed) : null;
      if (real) { left = new THREE.Vector3(real.pos[0], real.pos[1], real.pos[2]); pathCurl = real.curl; }
      if (ori) { pathOrient = ori; pathTarget = seq === "inspect" ? h.charge.clone() : h.grip.clone(); }
    }
    // La mano de apoyo viaja (en coordenadas del arma) solo en los saltos de agarre reales: cartuchera, cambio de soporte
    if (left) { if (!this.leftLocal || this.leftLocal.distanceTo(left) < 0.02) this.leftLocal = left.clone(); else this.leftLocal.lerp(left, Math.min(1, dt * 14)); }
    else this.leftLocal = null;
    // Pistola a dos manos: agarre en C. La izquierda se coloca respecto a la derecha según el reposo de la referencia
    // (`gripAt`: dirección y diferencia entre dedos), con la muñeca recta para que no parezca un palo cruzado
    let leftPose = left && this.leftLocal ? pose(this.leftLocal, L, loose) : null;
    if (leftPose && kind === "wrap" && (this.spec?.type === "pistol" || this.spec?.type === "revolver") && this.drawIn <= 0 && this.inspectIn === null) {
      const go = gdat ? gdat.offset : ([-0.034, -0.016, -0.006] as [number, number, number]);
      leftPose = {
        pos: right.pos.clone().add(new THREE.Vector3(go[0], go[1], go[2]).applyQuaternion(hq)),
        orient: hq.clone().multiply(rx(-0.2).multiply(handBasis(V(0.7, 0.2, -0.68), V(-0.55, 0.15, -0.82)))),
        curl: gdat ? gdat.curl : { fingers: [1.05, 1.15, 1.2, 1.25], thumb: 0.25 }, straight: 1,
      };
    }
    else if (leftPose) leftPose.straight = tipo === "sniper" ? 0.55 : tipo === "lmg" || tipo === "bullpup" ? 0.32 : 0.4; // (armas largas: el antebrazo de apoyo baja en diagonal desde el borde, sin cruzar la pantalla; francotirador: más recto de muñeca, en escorzo)
    // Orientación de muñeca de las referencias (giro respecto al reposo de la secuencia) sobre una base «que agarra»:
    // los dedos apuntan a lo que la mano manipula (cargador, empuñadura, corredera) y el dorso mira arriba/cámara, así
    // el puño del guante no queda de frente (el «disco» negro) y el antebrazo baja hacia el borde inferior de la vista.
    // (el fusil conserva su pose de mano actual hasta su tanda; escopetas, subfusiles, cerrojos, ametralladoras y
    // bullpup ya usan la orientación real)
    if (leftPose && pathOrient && (handgun || tipo === "shotgun" || tipo === "smg" || tipo === "sniper" || tipo === "lmg" || tipo === "bullpup")) {
      const fingers = (pathTarget ? toCam(pathTarget) : toCam(h.grip)).sub(leftPose.pos);
      if (fingers.length() < 0.03) fingers.copy(toCam(h.grip).sub(leftPose.pos));
      if (fingers.lengthSq() < 1e-8) fingers.set(1, 0, -0.6);
      fingers.normalize();
      // Dorso del guante hacia arriba y algo hacia la cámara (se ve el dorso, no la boca del puño). Si los dedos van
      // casi en esa dirección, se usa otro eje para que la base no degeneré.
      const back = Math.abs(fingers.dot(V(-0.3, 0.8, 0.5))) > 0.97 ? V(1, 0, 0) : V(-0.3, 0.8, 0.5);
      const base = handBasis(fingers, back);
      const dq = new THREE.Quaternion(pathOrient[0], pathOrient[1], pathOrient[2], pathOrient[3]);
      const qd = hq.clone().multiply(dq).multiply(hq.clone().invert());
      // Armas cortas: muñeca recta. Largas: el antebrazo de apoyo cae en diagonal hacia el borde inferior, sin quedar
      // como un poste rígido delante de la vista (cerrojos, ametralladoras y bullpup: algo más tumbado que escopetas y
      // subfusiles, que llevan la mano más adelantada).
      leftPose = { ...leftPose, orient: qd.multiply(base), straight: handgun ? 0.85 : tipo === "sniper" ? 0.55 : tipo === "lmg" || tipo === "bullpup" ? 0.34 : 0.45 };
    }
    if (leftPose && pathCurl) leftPose = { ...leftPose, curl: pathCurl }; // dedos de la mano de apoyo según el recorrido (recarga real)
    // Tarea 13: acción con pista de poses clave: la mano izquierda va de pose en pose (anclas del arma o puntos fijos de
    // la cámara); su reposo es la pose de agarre de siempre, así entra y sale sin saltos
    if (this.keyed?.track.left) leftPose = this.keyedLeft(this.keyed, leftPose, m, toCam, hq, sup);
    // Gesto de equipamiento/granada (encargo 34): capa sobre la mano libre. La recarga no se cancela ni se toca: si la
    // izquierda está recargando, el gesto lo hace la derecha; el arma y sus piezas no cambian.
    const gk = this.gesture.kind, gc = this.gesture.curve();
    if (gk && gc && !this.superPose) {
      if (this.gesture.side === 1) right = this.gestureHand(right, 1, gc, gk);
      else if (this.reloadT <= 0) {
        // (pistola a una mano: la izquierda está fuera de cuadro y no tiene pose; entra una mano desde abajo al gesto)
        const base = leftPose ?? { pos: new THREE.Vector3(-0.2, -0.5, -0.3), orient: hq.clone().multiply(GRIPS.grab.q), curl: GRIPS.grab.curl };
        leftPose = this.gestureHand(base, -1, gc, gk);
      }
    }
    // Cerrojos, ametralladoras y bullpup: la mano de apoyo suele quedar baja en cadera; el codo se abre hacia fuera para
    // que el antebrazo salga en diagonal por el borde inferior (como en las referencias), no como un poste vertical.
    // (francotirador: menos apertura; el antebrazo cae más hacia el borde inferior, no cruza la pantalla)
    if (leftPose && (tipo === "sniper" || tipo === "lmg" || tipo === "bullpup")) leftPose = { ...leftPose, flare: tipo === "sniper" ? 0.5 : 1, girth: tipo === "sniper" ? 0.78 : undefined };
    // Francotirador: la mano de apoyo recarga por el lado de la cámara; al ir al cargador y al volver se acerca por el
    // mismo rayo de vista (escala alrededor de la cámara: la posición en pantalla no cambia) para que no quede pequeña
    // y tapada por el cajón del arma (el modelo es grande y la mano iba muy atrás).
    if (leftPose && tipo === "sniper" && ph) {
      const near = ph.id === "grab" ? ease(ph.t) : ph.id === "settle" ? 1 - ease(ph.t)
        : ph.id === "out" || ph.id === "pouch" || ph.id === "in" || ph.id === "rack" ? 1 : 0;
      if (near > 0) {
        const dz = 0.12 * near, z = leftPose.pos.z, k = (z + dz) / z;
        leftPose = { ...leftPose, pos: new THREE.Vector3(leftPose.pos.x * k, leftPose.pos.y * k, z + dz) };
      }
    }
    // (tarea 13: armas largas en reposo/apuntando: el antebrazo de apoyo baja casi en vertical hacia el borde inferior
    //  izquierdo y algo más fino; si subía hacia la cámara, en línea con la vista, tapaba la propia mano y se veía como
    //  un tubo enorme)
    if (leftPose && !this.keyed && !leftPose.fore && tipo !== "pistol" && tipo !== "revolver") {
      leftPose = { ...leftPose, fore: kind === "vgrip" ? new THREE.Vector3(-0.42, -0.88, 0.2) : new THREE.Vector3(-0.55, -0.78, 0.3), girth: leftPose.girth ?? 0.86 };
    }
    // (mano izquierda: el pulgar rodea lo que agarra en proporción a lo cerrada que está la mano; abierta, no se mete)
    if (leftPose && leftPose.thumbTurn === undefined) {
      const avg = leftPose.curl.fingers.reduce((a, f) => a + f, 0) / 4;
      leftPose = { ...leftPose, thumbTurn: 0.7 * Math.min(1, Math.max(0, (avg - 0.4) / 0.6)) };
    }
    this.arms.update({ right, left: this.helmetLeft(leftPose), dt, shoulder });
  }

  /**
   * Mezcla el gesto de equipamiento/granada en la pose de una mano (espacio de la cámara): `out` la saca (a la cadera
   * al activar, atrás al lanzar) y `hit` la trae con el toque corto o el golpe hacia delante (la suave, por debajo).
   */
  private gestureHand(p: HandPose, side: 1 | -1, c: GestureCurve, kind: GestureKind): HandPose {
    const out = c.out, hit = c.hit, rot = new THREE.Euler();
    // Puntos de la mano en el espacio de la cámara (espejados para la derecha): no dependen de dónde esté el arma, así
    // el gesto se ve igual con cualquier arma. La cadera queda al borde inferior (la mano baja y vuelve a asomar).
    const hip = new THREE.Vector3(0.16 * side, -0.27, -0.55);
    const back = new THREE.Vector3(0.2 * side, 0, -0.42), fwd = new THREE.Vector3(0.04 * side, -0.1, -0.72);
    const softBack = new THREE.Vector3(0.2 * side, -0.14, -0.45), softFwd = new THREE.Vector3(0.03 * side, -0.26, -0.62);
    const pos = p.pos.clone();
    if (kind === "activate") {
      pos.lerp(hip, out); // (baja hasta la cadera)
      pos.add(new THREE.Vector3(0, -0.02 * hit, -0.05 * hit)); // (toque corto hacia delante y abajo)
      rot.set(-0.55 * out - 0.25 * hit, 0, 0.12 * side * out);
    } else if (kind === "throw") {
      pos.lerp(back, out).lerp(fwd, hit); // (brazo atrás y adelante)
      rot.set(0.5 * out - 0.95 * hit, 0.18 * side * out, 0);
    } else {
      pos.lerp(softBack, out).lerp(softFwd, hit); // (corto y por debajo)
      rot.set(0.3 * out - 0.45 * hit, 0.14 * side * out, 0);
    }
    const grip = c.grip;
    const curl: Curl = {
      fingers: p.curl.fingers.map((f) => f + (1.2 - f) * grip) as Curl["fingers"],
      thumb: p.curl.thumb + (0.85 - p.curl.thumb) * grip,
    };
    return { ...p, pos, orient: p.orient.clone().multiply(new THREE.Quaternion().setFromEuler(rot)), curl };
  }

  private fire(moving: number, echo = false) {
    const s = this.spec!, it = this.item!; this.trigT = 1;
    // Retícula: se abre con cada disparo y se acumula en ráfaga (solo visual: la dispersión real no cambia)
    this.crossKick = Math.min(1.8, this.crossKick + 0.35 + (100 - s.stats.precision) / 160 + (s.type === "shotgun" || s.type === "sniper" || s.type === "revolver" ? 0.4 : 0));
    const fx = this.fx!;
    const fullMag = it.ammo === s.stats.cargador;
    const ammoFrac = it.ammo / s.stats.cargador;
    if (!echo) {
      // Balas por disparo (racimo gasta varias; en furia, ninguna) y calor (armas que se sobrecalientan)
      if (!this.buff.freeAmmo && !(this.perks.ammoSave > 0 && Math.random() < this.perks.ammoSave)) it.ammo -= Math.min(it.ammo, fx.ammoPerShot());
      this.cooldown = 60 / (s.stats.cadencia * fx.rateMult() * this.buff.rate * this.perks.rate);
      const hp = fx.heatPerShot(); if (hp) { this.heat = Math.min(1, this.heat + hp); if (this.heat >= 1) { this.overheatT = 2.2; this.sfx("empty"); } }
    }
    this.shotCount++;
    if (!echo) this.hooks.onShot?.();
    if (s.fireMode === "pump" || s.fireMode === "bolt") {
      this.cycleT = this.cycleDur = CYCLE_TIME[s.fireMode];
      // Ciclo con las muestras del pack (cerrojo: atrás/adelante…; bombeo: atrás/adelante), repartidas por el gesto
      const kind = cycleKind(this.actionOf?.(s), s.fireMode, s.type), files = soundManifest && kind ? cycleSounds(soundManifest, s.type, kind) : [];
      if (files.length) { const a = audio(), t0 = a.currentTime + (s.fireMode === "bolt" ? 0.28 : 0.1), span = this.cycleDur * 0.6; files.forEach((f, k) => playSample(sample(f), 0.6, 1, t0 + (k / Math.max(1, files.length - 1)) * span * (files.length > 1 ? 1 : 0))); }
      setTimeout(() => { if (!files.length) this.sfx("cycle"); if (this.item === it) this.ejectCasing(); }, s.fireMode === "bolt" ? 380 : 170);
    } else if (soundManifest && cycleKind(this.actionOf?.(s), s.fireMode, s.type) === "martillo") {
      // Revólver de acción simple: se amartilla tras cada disparo
      const f = cycleSounds(soundManifest, s.type, "martillo")[0]; if (f) playSample(sample(f), 0.5, 1, audio().currentTime + 0.22);
      this.cockT = 0.42; // (gesto de amartillar: el pulgar tira del martillo y el arma se inclina un poco)
    }
    else if (!echo) this.ejectCasing();
    const quiet = !!accessory(s.muzzle)?.quiet;
    const sig = fx.sig;
    this.sfx("shot", s.type, quiet);
    if (sig) this.sfx("sig");
    (this.flash.material as THREE.MeshBasicMaterial).opacity = quiet ? 0.2 : 1; this.flashLight.intensity = quiet ? 0.6 : 4;
    // Lo que cambian los efectos en este disparo (multiplicadores, perdigones, perforación, elemento…)
    const origin0 = this.camera.getWorldPosition(new THREE.Vector3());
    const nearCount = this.hooks.dummies().filter((d) => d.alive && d.center.distanceTo(origin0) < 8).length;
    const mods = fx.shot({ fullMag, ammoFrac, aiming: this.aimT > 0.6, nearCount, pellets: PELLETS[s.type] ?? 1, moving });
    const rp = this.anim.p.recoil;
    // (el calibre del revólver cambia el retroceso: el mágnum patea, el ligero apenas)
    const calKick = s.tweaks?.pistol?.cyl ? CAL_EFFECT[s.tweaks.pistol.cyl.cal].recoil : 1;
    const kickPower = rp.power * (1.4 - s.stats.manejo / 100) * (1 - this.aimT * 0.35) * mods.recoil * calKick;
    // Patrón de retroceso propio del arma: subida dominante + deriva lateral determinista (con un poco de ruido)
    const pat = recoilPattern(s.statSeed), i = Math.min(this.sprayIndex++, pat.length - 1);
    const lateral = accessory(s.muzzle)?.id === "acc:compensator" || accessory(s.muzzle)?.id === "acc:brake" ? 0.55 : 1;
    this.recoil += rp.vertical * kickPower * pat[i][0];
    this.recoilYaw += rp.horizontal * kickPower * (pat[i][1] * lateral + (Math.random() - 0.5) * 0.3);
    this.sprayT = 0;
    this.anim.shot(Math.min(1.4, kickPower / rp.power));
    const element = mods.element as Element;
    const pellets = mods.pellets;
    const spreadDeg = this.spread(moving) * mods.spread;
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
    const q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const targets = [...this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes), ...this.world];
    const dmgMult = mods.dmg * this.buff.dmg * this.perks.dmg, forceCrit = mods.forceCrit || this.buff.crit, critMult = mods.critMult * this.buff.critMult * this.perks.critMult, pierceN = mods.pierce;
    const tracerColor = sig ? "#ffb347" : element === "fuego" ? "#ff7a2a" : element === "electrico" ? "#8fd8ff" : s.rarity.id === "comun" ? "#e9dcc0" : s.rarity.color;
    let firstHit: THREE.Vector3 | null = null, hitAny = false, firstTarget: Dummy | null = null;
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1);
      const a = THREE.MathUtils.degToRad(spreadDeg) * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      dir.x = Math.tan(a) * Math.cos(th); dir.y = Math.tan(a) * Math.sin(th); dir.normalize().applyQuaternion(q);
      this.ray.set(origin, dir); this.ray.far = 250;
      const hits = this.ray.intersectObjects(targets, false);
      let pierced = 0, end = origin.clone().addScaledVector(dir, 250);
      const seen = new Set<Dummy>();
      for (const hit of hits) {
        const dummy = hit.object.userData.dummy as Dummy | undefined;
        end = hit.point; firstHit ??= hit.point.clone();
        if (!dummy) { (hit.object.userData.onShot as ((p: THREE.Vector3) => void) | undefined)?.(hit.point); this.decal(hit, element === "fuego" || element === "explosive"); if (element === "explosive") this.explode(hit.point, s.stats.dano * 0.4 * dmgMult, element); break; }
        if (seen.has(dummy)) continue; seen.add(dummy); firstTarget ??= dummy;
        const zone = hit.object.userData.zone as Zone;
        const falloff = hit.distance <= s.stats.alcance ? 1 : Math.max(0.45, 1 - (hit.distance - s.stats.alcance) / (s.stats.alcance * 2));
        const crit = forceCrit || zone === "head";
        const big = (dummy.kind.scale ?? 1) > 1.2 || !!dummy.kind.boss;
        const dmg = s.stats.dano * falloff * dmgMult * fx.hitMult({ full: dummy.health >= dummy.layers[0].max, big, crit }) * (crit ? critMult : zone === "limb" ? 0.8 : 1) * (pierced > 0 ? 0.5 : 1);
        this.applyHit(dummy, zone, hit.point, dmg, element, crit, p === 0);
        hitAny = true;
        this.runFx(fx.afterHit({ target: dummy, point: hit.point.clone(), dmg, crit, baseDmg: s.stats.dano, now: performance.now() / 1000 }), moving);
        if (++pierced >= pierceN) break;
      }
      if (p < 3) this.tracer(muzzle, end, tracerColor);
    }
    this.runFx(fx.afterShot({ shotCount: this.shotCount, firstHit, echo, baseDmg: s.stats.dano, hitAny, firstTarget }), moving);
  }

  /** Ejecuta las acciones que piden los efectos (el módulo de efectos no sabe de rayos ni posiciones). */
  private runFx(actions: FxAction<Dummy, THREE.Vector3>[], moving: number) {
    const s = this.spec, it = this.item; if (!s || !it) return;
    for (const a of actions) {
      switch (a.type) {
        case "explode": this.explode(a.at, a.dmg, a.element, a.except, a.color); break;
        case "chain": this.chain(a.from, a.dmg, a.n); break;
        case "bounce": { const next = this.nearest(a.from, a.at, 15); if (next) { this.tracer(a.at, next.center, "#e8e1d3"); this.applyHit(next, "body", next.center, a.dmg, this.fx?.element() as Element ?? null, false, false); } break; }
        case "igniteNear": for (const o of this.hooks.dummies()) if (o !== a.except && o.alive && o.center.distanceTo(a.at) < a.radius) { this.tracer(a.at, o.center, "#ff9a4a", 0.15); this.applyHit(o, "body", o.center, a.dmg * 0.3, "fuego", false, false); } break;
        case "unstableNear": { const until = performance.now() / 1000 + a.seconds; for (const o of this.hooks.dummies()) if (o !== a.except && o.alive && o.center.distanceTo(a.at) < a.radius) this.unstable.set(o, until); break; }
        case "shards": { const near = this.hooks.dummies().filter((d) => d.alive && d.center.distanceTo(a.at) < 20).slice(0, a.n); for (const d of near) { this.tracer(a.at, d.center, "#ffb347", 0.12); this.applyHit(d, "body", d.center, a.dmg, null, false, false); } break; }
        case "strike": {
          const at = a.target.center;
          this.tracer(at.clone().add(new THREE.Vector3(0, 12, 0)), at, "#bfe8ff", 0.25); this.sfx("boom");
          for (const o of this.hooks.dummies()) if (o !== a.target && o.alive && o.center.distanceTo(at) < a.radius) { this.tracer(at, o.center, "#bfe8ff", 0.2); this.applyHit(o, "body", o.center, a.dmg, "electrico", false, false); }
          break;
        }
        case "shockwave": this.explode(a.at, a.dmg, null, undefined, 0xd8f4f6); break;
        case "later": { const item = it; setTimeout(() => { if (this.item === item) this.runFx([a.action], moving); }, a.delay * 1000); break; }
        case "ammo": it.ammo = Math.min(s.stats.cargador, it.ammo + a.n); break;
        case "refill": it.ammo = s.stats.cargador; break;
        case "echo": { const item = it; setTimeout(() => { if (this.item === item) this.fire(moving, true); }, a.delay * 1000); break; }
        case "strikeAt": {
          this.tracer(a.at.clone().add(new THREE.Vector3(0, 12, 0)), a.at, "#bfe8ff", 0.25); this.sfx("boom");
          for (const o of this.hooks.dummies()) if (o.alive && o.center.distanceTo(a.at) < a.radius) { this.tracer(a.at, o.center, "#bfe8ff", 0.2); this.applyHit(o, "body", o.center, a.dmg, "electrico", false, false); }
          break;
        }
        case "pull": {
          // Atracción (Event Horizon): tope de duración y de fuerza; al terminar, explota en el centro
          this.pulls.push({ at: a.at.clone(), radius: a.radius, t: a.seconds });
          const item = it; setTimeout(() => { if (this.item === item) this.explode(a.at, a.then, null, undefined, 0x8060ff); }, a.seconds * 1000);
          break;
        }
        case "selfBlast": {
          this.explode(a.at, a.dmg, "explosive");
          // Autodaño leve si la explosión es cerca del jugador (contrapartida de la carga inestable)
          if (a.at.distanceTo(this.camera.getWorldPosition(new THREE.Vector3())) < 4) this.hooks.hurt?.(a.self);
          break;
        }
      }
    }
  }

  private applyHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, crit: boolean, sound: boolean) {
    const alive = d.alive;
    if (this.item) this.lastDealt.set(this.item.uid, performance.now() / 1000);
    this.hooks.onHit(d, zone, point, dmg, element, crit);
    this.spark(point, this.camera.position.clone().sub(point).normalize(), crit ? 6 : 3, element === "fuego" ? 0xffa060 : element === "electrico" ? 0xbfe8ff : crit ? 0xffe08a : 0xcff6f8);
    if (crit) this.critmarker = 0.15; else this.hitmarker = 0.12;
    if (alive && !d.alive) {
      this.killmarker = 0.35; this.hitSound("kill");
      this.hooks.onKill?.(d);
      const s = this.spec!;
      // Enemigo inestable (cadáver inestable): explota al morir
      const un = this.unstable.get(d); this.unstable.delete(d);
      if (un != null && performance.now() / 1000 < un) this.explode(d.center, s.stats.dano * 1.2, "explosive", d);
      if (this.fx) this.runFx(this.fx.kill({ target: d, point: d.center, baseDmg: s.stats.dano, mag: s.stats.cargador }), 0);
    } else if (sound) this.hitSound(zone === "head" ? (d.helmeted ? "metal" : "head") : zone === "shield" || (zone === "body" && d.armored) ? "metal" : "body");
  }
  private nearest(from: Dummy, at: THREE.Vector3, max: number, skip: Dummy[] = []) {
    return this.hooks.dummies().filter((d) => d !== from && d.alive && !skip.includes(d) && d.center.distanceTo(at) < max)
      .sort((x, y) => x.center.distanceTo(at) - y.center.distanceTo(at))[0];
  }
  /** Descarga eléctrica: salta a 1-2 enemigos cercanos con un arco corto. */
  private chain(from: Dummy, dmg: number, range: number) {
    const done: Dummy[] = [];
    let src = from.center;
    for (let i = 0; i < 2; i++) {
      const n = this.nearest(from, src, range, done); if (!n) break;
      done.push(n); this.tracer(src, n.center, "#8fd8ff", 0.15);
      this.applyHit(n, "body", n.center, dmg, null, false, false); n.applyStatus("electrico", dmg); src = n.center;
    }
  }
  explode(at: THREE.Vector3, dmg: number, element: Element, except?: Dummy, color = 0xffb060) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }));
    m.position.copy(at); this.scene.add(m); this.bursts.push({ mesh: m, t: 0.35 });
    // Onda de choque: anillo que se abre a ras de suelo
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(at.x, 0.05, at.z); this.scene.add(ring); this.bursts.push({ mesh: ring, t: 0.35 });
    this.sfx("boom");
    for (const d of this.hooks.dummies()) if (d !== except && d.alive && d.center.distanceTo(at) < 2.2) {
      this.applyHit(d, "body", d.center, dmg, element === "explosive" ? null : element, false, false);
      d.push(d.center.clone().sub(at).setY(0).normalize(), 0.35); // empuje corto
    }
  }

  private tracer(a: THREE.Vector3, b: THREE.Vector3, color: string, life = 0.07) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.scene.add(line); this.tracers.push({ line, t: life, max: life });
  }
  /** Impacto en la sala: agujero cuadrado oscuro (se desvanece), marca de rejilla que destella y chispas de datos. */
  private decal(hit: THREE.Intersection, scorch = false) {
    if (!settings.impactFx) return; // ajuste: marcas y chispas de impacto
    if (!hit.face) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const g = new THREE.Group();
    const hole = new THREE.Mesh(scorch ? SCORCH_GEO : DECAL_GEO, new THREE.MeshBasicMaterial({ color: scorch ? 0x24140b : 0x0b0c0d, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    const glyph = new THREE.Mesh(GLYPH_GEO, new THREE.MeshBasicMaterial({ color: 0x8fe6ec, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 }));
    g.add(hole, glyph);
    g.position.copy(hit.point).addScaledVector(n, 0.003); g.lookAt(hit.point.clone().add(n)); g.rotateZ(Math.random() * 0.3);
    this.scene.add(g); this.decals.push({ mesh: g, t: 0, glyph });
    if (this.decals.length > 120) { const old = this.decals.shift()!; this.scene.remove(old.mesh); }
    this.spark(hit.point, n, 5);
  }
  /** Chispas de datos: cuadraditos claros que saltan del impacto y caen. */
  spark(at: THREE.Vector3, n: THREE.Vector3, count: number, color = 0xcff6f8) {
    if (!settings.impactFx) return;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(SPARK_GEO, new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(at);
      const v = n.clone().multiplyScalar(1.2 + Math.random() * 1.5).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2, (Math.random() - 0.5) * 1.6));
      this.scene.add(m); this.sparks.push({ mesh: m, v, t: 0.3 + Math.random() * 0.2 });
    }
    while (this.sparks.length > 80) { const o = this.sparks.shift()!; this.scene.remove(o.mesh); }
  }
}

// ---------- Agarres de las manos (05-E / 08) ----------
type HandKind = "under" | "wrap" | "vgrip" | "grab";
/** Cierres de la mano izquierda que usan las pistas de poses clave. */
const SHAPES: Record<HandShape, Curl> = {
  grab: { fingers: [0.55, 0.6, 0.65, 0.7], thumb: 0.35 },
  palm: { fingers: [0.12, 0.12, 0.14, 0.18], thumb: 0.12 },
  pinch: { fingers: [0.75, 0.9, 1.15, 1.25], thumb: 0.65 },
  wrap: { fingers: [0.95, 0.99, 1.01, 1.03], thumb: 0.35 },
  open: { fingers: [0.3, 0.34, 0.38, 0.42], thumb: 0.22 },
  relax: { fingers: [0.62, 0.68, 0.74, 0.8], thumb: 0.35 },
  fist: { fingers: [1.5, 1.6, 1.6, 1.6], thumb: 1 },
};
interface HandGrip { q: THREE.Quaternion; off: THREE.Vector3; curl: Curl }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const rx = (a: number) => new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), a);
const C = (f: number, t: number): Curl => ({ fingers: [f, f + 0.04, f + 0.06, f + 0.08], thumb: t });
/** Orientación (dedos, dorso), desplazamiento de la palma respecto al anclaje y cierre de cada agarre. */
const GRIPS: Record<HandKind | "right" | "rightHandgun", HandGrip> = {
  // Empuñadura: dorso a la derecha, dedos rodeando el frente; la palma sigue la inclinación de la empuñadura
  right: { q: rx(-0.3).multiply(handBasis(V(-0.33, -0.1, -0.94), V(0.97, 0.24, 0))), off: V(0.019, 0.012, 0.012), curl: C(1.05, 0.7) },
  // Pistolas: la mano más baja en la empuñadura (la membrana entre pulgar e índice justo bajo la corredera, que asoma
  // por encima de la mano como en los shooters de referencia) y la muñeca algo menos inclinada
  rightHandgun: { q: rx(-0.22).multiply(handBasis(V(-0.1, -0.1, -0.99), V(0.99, 0.12, 0))), off: V(0.014, 0.002, 0.012), curl: C(1.1, 0.75) },
  // Bajo el guardamanos: palma arriba, dedos hacia la derecha envolviéndolo
  // (tarea 13: algo más abajo —la palma atravesaba el guardamanos— y los dedos más cerrados: agarraba «sin fuerza»)
  // (tarea 13: como en los tácticos modernos, la mano va en el COSTADO izquierdo del guardamanos, con los dedos
  //  rodeándolo por encima y el dorso hacia la cámara: debajo, palma arriba, solo se veía la manga)
  under: { q: handBasis(V(0.45, 0.78, -0.43), V(-0.88, 0.25, 0.4)), off: V(-0.03, -0.006, 0.006), curl: C(1.25, 0.6) },
  // Segunda mano en la empuñadura: por la izquierda, envolviendo los dedos de la derecha
  // (agarre en C: la izquierda queda debajo de la derecha y la envuelve, pulgares hacia delante)
  wrap: { q: rx(-0.25).multiply(handBasis(V(0.45, -0.25, -0.86), V(-0.9, -0.15, 0.1))), off: V(-0.026, -0.022, -0.004), curl: C(1.3, 0.5) },
  // Empuñadura vertical o cargador: mano cerrada alrededor, dorso a la izquierda
  // (tarea 13: dorso hacia la cámara y algo arriba: la mano se ve rodeando la empuñadura desde la izquierda)
  vgrip: { q: handBasis(V(0.75, -0.25, -0.62), V(-0.6, 0.45, 0.66)), off: V(-0.024, 0.004, 0.018), curl: C(1.5, 0.85) },
  // Coger el cargador o la palanca: mano semiabierta que llega desde la izquierda
  grab: { q: handBasis(V(0.45, -0.25, -0.85), V(-0.85, 0.3, 0.2)), off: V(-0.02, 0, 0), curl: C(0.55, 0.35) },
};
function supportKind(s: string | undefined, type: string | undefined): HandKind {
  if (s === "grip") return "wrap";
  if (s === "vgrip" || s === "mag") return "vgrip";
  if (s === "front" || s === "pump" || s === "frame") return "under";
  return type === "pistol" || type === "revolver" ? "wrap" : "under";
}
