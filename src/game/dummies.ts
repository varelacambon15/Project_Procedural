// Muñecos de tiro con forma humana: vida, estados (quemadura, aturdimiento), barras de vida flotantes,
// números de daño y reaparición. De momento solo tienen vida; las capas están preparadas como lista
// para añadir escudo o armadura más adelante.
import * as THREE from "three";
import { t } from "../i18n";
import { enemyModelNow, isModelShape, loadEnemyModel, type EnemyModel } from "./enemymodels";
import { chargeLevel, flankPoint, pounceState, turnToward } from "./enemyai";

export type Element = "fuego" | "electrico" | "explosive" | null;
export type Zone = "head" | "body" | "limb" | "shield";
/** Capa de protección. Por ahora solo existe "health". */
export interface Layer { id: "health"; value: number; max: number }
/** Forma del enemigo: humanoide (por defecto) o robots de la simulación. */
export type Shape = "humanoid" | "drone" | "spider" | "roller" | "turret" | "hound" | "repairer" | "sentinel";
interface Kind {
  key: string; health: number; level: number; scale?: number; boss?: boolean;
  shape?: Shape; /** Altura a la que vuela (drones). */ fly?: number;
  /** Colores propios (médico, comandante, fallo). */ paint?: { suit: number; dark: number; vest: number };
  /** Fallo de código: se teletransporta a saltos y es intocable mientras salta. */ glitch?: boolean;
  /** Soldados: arma que llevan (fusil o fusil de francotirador). Guardián: escudo frontal. */ gun?: "rifle" | "sniper"; shield?: boolean;
  /** Altura del centro (para apuntar, súperes) y de la barra de vida, en m sin escalar. */ cy?: number; top?: number;
}
export const KINDS: Record<string, Kind> = {
  small: { key: "small", health: 150, level: 8, scale: 0.72 },
  basic: { key: "basic", health: 300, level: 10 },
  large: { key: "large", health: 1600, level: 14, scale: 1.4 },
  sturdy: { key: "sturdy", health: 750, level: 12, scale: 1.04 },
  elite: { key: "elite", health: 1400, level: 15, scale: 1.08 },
  boss: { key: "boss", health: 7000, level: 20, scale: 1.7, boss: true },
  // Oleadas: lanzador de esferas de energía (ataca a distancia) y jefe cada 5 oleadas
  caster: { key: "caster", health: 420, level: 12, scale: 0.95 },
  warden: { key: "warden", health: 9000, level: 25, scale: 2.0, boss: true },
  // Robots de la simulación
  drone: { key: "drone", health: 260, level: 11, shape: "drone", fly: 3.2, cy: 0, top: 0.7 },
  spider: { key: "spider", health: 380, level: 12, shape: "spider", cy: 0.55, top: 1.2 },
  roller: { key: "roller", health: 120, level: 9, shape: "roller", cy: 0.4, top: 1.0 },
  turret: { key: "turret", health: 600, level: 12, shape: "turret", cy: 1.15, top: 1.9 },
  // Robots nuevos con modelo de Blender (tarea 2, PLAN_ENEMIGOS.md): sabueso en jauría, dron que repara y centinela con escudo
  hound: { key: "hound", health: 340, level: 12, shape: "hound", cy: 0.75, top: 1.05 },
  repairer: { key: "repairer", health: 240, level: 12, shape: "repairer", fly: 2.4, cy: 0, top: 0.55 },
  sentinel: { key: "sentinel", health: 900, level: 14, shape: "sentinel", fly: 0.22, cy: 1.15, top: 1.75 },
  // Pesados y tiradores
  guardian: { key: "guardian", health: 1800, level: 14, scale: 1.25, shield: true },
  gunner: { key: "gunner", health: 360, level: 11, gun: "rifle" },
  sniper: { key: "sniper", health: 240, level: 12, scale: 0.97, gun: "sniper" },
  // Apoyo y anomalías
  medic: { key: "medic", health: 320, level: 11, paint: { suit: 0xe8ecef, dark: 0x2f6b4a, vest: 0x3fbf7a } },
  commander: { key: "commander", health: 1600, level: 15, scale: 1.12, paint: { suit: 0x2e3440, dark: 0x14171c, vest: 0xc99a2e } },
  glitch: { key: "glitch", health: 420, level: 13, glitch: true, paint: { suit: 0x1a2a3a, dark: 0x0a0f14, vest: 0x3fd0d8 } },
};

const ELEMENT_COLOR: Record<string, string> = { fuego: "#f07a2a", electrico: "#5cc8f0", explosive: "#ffb060" };
const BURN_DPS_CAP = 60;
/** Frontera entre el campo de tiro y la sala de oleadas (pared del fondo, ver world.ts). */
export const WAVES_ROOM_Z = 28.5; // tope de daño por segundo de la quemadura

// Maniquí de simulación: cuerpo oscuro con una rejilla de luz tenue (textura pixelada) y peana metálica
function gridTexture() {
  const c = document.createElement("canvas"); c.width = 16; c.height = 16; const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 16, 16); g.fillStyle = "#2a8a90"; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 6);
  return t;
}
const GRID = gridTexture();
const mat = (color: number, emissive = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.3, emissive: 0xffffff, emissiveMap: GRID, emissiveIntensity: emissive });
// Naranja de muñeco de pruebas: se distingue bien sobre el gris claro de la sala (y de noche, con su rejilla)
const skin = mat(0xd2702e, 0.18), skinDark = mat(0x3a3f45, 0.25), vest = mat(0x5c5e4a, 0.15);
const standMat = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.7 });
// Equipo de los soldados de la simulación (oleadas e incursiones)
const armorMat = new THREE.MeshStandardMaterial({ color: 0x3a414b, roughness: 0.45, metalness: 0.55 });
const pouchMat = new THREE.MeshStandardMaterial({ color: 0x2c3128, roughness: 0.85 });
const bootMat = new THREE.MeshStandardMaterial({ color: 0x23272d, roughness: 0.6, metalness: 0.3 }), soleMat = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.9 });
const emblemMat = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.6, side: THREE.DoubleSide });
/** Color del visor por tipo. */
const VISOR: Record<string, number> = { commander: 0xffb040, medic: 0x4aff9a, glitch: 0x3fd0ff, caster: 0x8fd8ff, elite: 0xff2a6a, sniper: 0xff2a1a };
/** Venas de luz (los «víricos» de la simulación): lanzadores, élites y fallos de código. */
function veinMat(kind: { key: string }) {
  const c = ({ caster: 0x5fd8ff, elite: 0xff3a8a, glitch: 0x3fd0ff, commander: 0xffb040 } as Record<string, number>)[kind.key];
  return c ? new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: c, emissiveIntensity: 1.6 }) : null;
}
// Robots: chapa clara, metal oscuro y piezas negras (las luces de cada uno van aparte)
const robotPlate = new THREE.MeshStandardMaterial({ color: 0xb4bcc6, roughness: 0.45, metalness: 0.55 }), robotMetal = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.4, metalness: 0.75 }), robotDark = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.5, metalness: 0.6 });
/** Variante de aspecto de un enemigo de oleada. */
export interface DummyLook { suit: number; dark: number; vest: number; bulk: number; extras: ("helmet" | "vest" | "pack" | "visor" | "pads")[] }
const SUITS = [0xd2702e, 0x4f7a5c, 0x5b6f8a, 0x8a4a4a, 0xb0a070, 0x6a5a86, 0x3c4a54];
/** Aspecto al azar para un enemigo de oleada (colores de traje y algunos accesorios). */
export function randomLook(rnd: () => number = Math.random): DummyLook {
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const extras = (["helmet", "vest", "pack", "visor", "pads"] as const).filter(() => rnd() < 0.4);
  return { suit: pick(SUITS), dark: pick([0x2c3036, 0x3a3f45, 0x24282c]), vest: pick([0x5c5e4a, 0x3d4a3a, 0x4a4f58, 0x6a5a40]), bulk: 0.92 + rnd() * 0.2, extras: [...extras] };
}
const BIT_GEO = new THREE.BoxGeometry(0.025, 0.025, 0.025);
/** Marca de impacto (cuadradito oscuro, pixelado) y su versión metálica (más clara). */
const MARK_GEO = new THREE.PlaneGeometry(0.035, 0.035);
const markMat = new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
const markMetal = new THREE.MeshBasicMaterial({ color: 0xc8c0b0, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });

export class Dummy {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly hitboxes: THREE.Mesh[] = [];
  readonly layers: Layer[];
  alive = true;
  private deadT = 0;
  private flash = 0;
  /** Quemadura: segundos restantes y daño por segundo (no se apila: se renueva). */
  private burnT = 0; private burnDps = 0; private burnTick = 0;
  /** Aturdimiento breve de la descarga eléctrica (no se apila). */
  private stunT = 0;
  /** Estasis (súper): congelado sin temblar y recibe más daño mientras dura. */
  holdT = 0; vulnT = 0; vuln = 1;
  /** Gravedad cero (súper): flota indefenso a cierta altura mientras dura. */ liftT = 0; liftH = 0;
  // ---------- Respuesta a los impactos ----------
  /** Inclinación del cuerpo por los impactos (muelle amortiguado): x = hacia atrás, z = de lado. */
  private flinch = new THREE.Vector2(); private flinchV = new THREE.Vector2();
  /** Cabezazo hacia atrás (impacto en la cabeza) y flexión de pierna (impacto en una pierna). */
  private headKick = 0; private headKickV = 0; private limpT = 0; private limpSide = 1;
  /** Empuje del cuerpo al morir, en la dirección del disparo, y caída hacia atrás. */
  private deathV = new THREE.Vector3(); private deathOff = new THREE.Vector3(); private deathTilt = 0; private deathDir = new THREE.Vector2(0, 1);
  /** Destello blanco de los materiales al recibir un impacto (más fuerte con críticos). */
  private hitGlow = 0; private glowColor = new THREE.Color(1, 1, 1); private mats: THREE.MeshStandardMaterial[] = [];
  /** Marcas de impacto pegadas al cuerpo mientras vive (se borran al morir). */
  private marks: THREE.Mesh[] = [];
  /** Daño reciente en la barra: la parte perdida se queda un momento en blanco y luego baja. */
  private lagW = 100; private lagHold = 0;
  private glowSkip = new Set<THREE.MeshStandardMaterial>(); private baseEm: THREE.Color[] = [];
  private home = new THREE.Vector3(); private heads: { m: THREE.Mesh; z: number }[] = [];
  /** ¿Lleva blindaje? (los impactos suenan y saltan chispas metálicas) */
  get armored() { return /^(sturdy|elite|large|boss|warden)$/.test(this.kind.key) || !!this.kind.shape || !!this.look?.extras.includes("vest"); }
  get helmeted() { return /^(boss|warden)$/.test(this.kind.key) || !!this.look?.extras.includes("helmet"); }

  /**
   * Reacción a un impacto: el cuerpo se dobla hacia donde le das (cabeza atrás, torso encogido, pierna que flexiona),
   * escalado con la fuerza; partículas según el enemigo y una marca en el punto. `dir` = dirección del disparo.
   */
  react(zone: Zone, point: THREE.Vector3, dir: THREE.Vector3, dmg: number, crit: boolean, fx = true) {
    const sc = this.kind.scale ?? 1, mass = this.kind.boss ? 4 : sc * sc, s = Math.min(1, Math.max(0.15, dmg / 140)) / mass;
    // Dirección del disparo en el espacio del muñeco: inclina hacia atrás (x) y de lado (z)
    const local = dir.clone().applyQuaternion(this.group.quaternion.clone().invert());
    const k = (zone === "head" ? 2.4 : zone === "limb" ? 1.2 : 1.8) * s;
    this.flinchV.x += -local.z * k * 5; this.flinchV.y += local.x * k * 4;
    if (zone === "head") this.headKickV += 3.2 * s;
    if (zone === "limb" && point.y - this.group.position.y < 1.25 * sc) { this.limpT = 0.45; this.limpSide = this.group.worldToLocal(point.clone()).x < 0 ? -1 : 1; }
    this.hitGlow = crit ? 1 : 0.65; this.glowColor.set(crit ? 0xfff0a0 : 0xffffff);
    if (!this.alive && this.deadT === 0) { const f = local.clone().setY(0).normalize(); this.deathDir.set(f.x, f.z); this.deathV.copy(f).multiplyScalar(0.8 + 2.5 * Math.min(1, dmg / 200) / mass); this.deathTilt = 0.01; }
    if (!fx) return;
    // Partículas: chispas en blindados (o casco), fragmentos pixelados en la cabeza, polvo y trozos en el resto
    const metal = zone === "shield" || (zone === "head" && this.helmeted) || (zone === "body" && this.armored);
    const lp = this.group.worldToLocal(point.clone()), back = local.clone().negate();
    const n = Math.round((crit ? 10 : 6) * Math.min(1.6, 0.6 + s));
    for (let i = 0; i < n; i++) {
      const col = metal ? (Math.random() < 0.5 ? 0xffd27a : 0xfff4d0) : zone === "head" ? (Math.random() < 0.6 ? new THREE.Color(this.look?.suit ?? 0xd2702e).getHex() : 0xf0e6d8) : (Math.random() < 0.5 ? 0xb8b0a4 : new THREE.Color(this.look?.suit ?? 0xd2702e).getHex());
      const m = new THREE.Mesh(BIT_GEO, new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.position.copy(lp); m.scale.setScalar(metal ? 0.7 : zone === "head" ? 1.6 : 1.1);
      const v = back.clone().multiplyScalar(metal ? 2.5 : 1.4).add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * (metal ? 2 : 1.6), (Math.random() - 0.5) * 2));
      this.group.add(m); this.fxBits.push({ m, v, t: metal ? 0.22 : 0.5 + Math.random() * 0.3, g: !metal });
    }
    // Marca de impacto: pegada a la pieza más cercana (se mueve con ella), máximo 14
    if (this.alive) {
      let best: THREE.Mesh | null = null, bd = Infinity;
      for (const h of this.hitboxes) { if (!h.visible) continue; const d = h.getWorldPosition(new THREE.Vector3()).distanceToSquared(point); if (d < bd) { bd = d; best = h; } }
      if (best) {
        const mk = new THREE.Mesh(MARK_GEO, metal ? markMetal : markMat); best.add(mk);
        mk.position.copy(best.worldToLocal(point.clone().addScaledVector(dir, -0.012)));
        mk.lookAt(point.clone().addScaledVector(dir, -1)); // (la cara mira hacia el tirador)
        const ws = new THREE.Vector3(); best.getWorldScale(ws); mk.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z).multiplyScalar(crit ? 1.4 : 1);
        this.marks.push(mk); if (this.marks.length > 14) this.marks.shift()!.removeFromParent();
      }
    }
  }
  readonly bar: HTMLDivElement;
  private clip!: THREE.Plane; private scan!: THREE.Mesh; private top = 2.4;
  /** Reacciones visibles: brasas (fuego), chispas azules (eléctrico) y empuje (explosivo). */
  private fxBits: { m: THREE.Mesh; v: THREE.Vector3; t: number; g?: boolean; spin?: THREE.Vector3 }[] = [];
  /** Piezas arrancadas (se restauran al reaparecer). */
  private severed: THREE.Mesh[] = [];
  /**
   * Desmembramiento pixelado: la pieza alcanzada (cabeza o extremidad) desaparece y estalla en cubitos de su color
   * que caen al suelo. Para impactos de daño muy alto (francotirador, revólver, escopeta…).
   */
  dismember(zone: Zone, at: THREE.Vector3) {
    const cands = this.hitboxes.filter((m) => m.userData.zone === zone && m.visible);
    if (!cands.length || this.kind.boss) return;
    const wp = new THREE.Vector3();
    const hit = cands.reduce((a, b) => (a.getWorldPosition(wp).distanceTo(at) <= b.getWorldPosition(new THREE.Vector3()).distanceTo(at) ? a : b));
    hit.visible = false; this.severed.push(hit);
    // (y lo que lleva encima: casco o visor sobre la cabeza)
    if (zone === "head") for (const m of this.body.children as THREE.Mesh[]) if (m.isMesh && m.visible && m !== hit && m.position.y > 2.05) { m.visible = false; this.severed.push(m); }
    const color = ((hit.material as THREE.MeshStandardMaterial).color ?? new THREE.Color(0xd2702e)).getHex();
    const c = this.group.worldToLocal(hit.getWorldPosition(new THREE.Vector3()));
    // La pieza arrancada sale volando entera (girando, con gravedad) en la dirección del impacto
    const away = this.group.worldToLocal(at.clone()).sub(c).negate().setY(0).normalize();
    const chunk = new THREE.Mesh(hit.geometry, (hit.material as THREE.Material).clone()); (chunk.material as THREE.Material).transparent = true;
    hit.getWorldScale(chunk.scale); chunk.scale.divide(this.group.getWorldScale(new THREE.Vector3())); chunk.position.copy(c); this.group.add(chunk);
    this.fxBits.push({ m: chunk, g: true, t: 2.2, v: away.multiplyScalar(3 + Math.random() * 2).add(new THREE.Vector3(0, 3.5 + Math.random() * 2, 0)), spin: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18) });
    // Muñón de datos: un brillo cian donde estaba la pieza, y un fogonazo de cuadrados luminosos
    const stump = new THREE.Mesh(new THREE.SphereGeometry(zone === "head" ? 0.08 : 0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    stump.position.copy(c); this.group.add(stump); this.fxBits.push({ m: stump, v: new THREE.Vector3(), t: 1.0 });
    for (let i = 0; i < 18; i++) { const g = new THREE.Mesh(BIT_GEO, new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); g.scale.setScalar(2.2); g.position.copy(c); this.group.add(g); this.fxBits.push({ m: g, t: 0.35 + Math.random() * 0.3, v: new THREE.Vector3((Math.random() - 0.5) * 7, (Math.random() - 0.2) * 6, (Math.random() - 0.5) * 7) }); }
    const n = zone === "head" ? 60 : 44;
    for (let i = 0; i < n; i++) {
      const big = Math.random() < 0.35;
      const m = new THREE.Mesh(BIT_GEO, new THREE.MeshBasicMaterial({ color: Math.random() < 0.75 ? color : i % 2 ? 0x2c3036 : 0x9fe8ee, transparent: true }));
      m.scale.setScalar(big ? 2.6 : 1.4);
      m.position.copy(c).add(new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15));
      this.group.add(m);
      this.fxBits.push({ m, g: true, t: 1.8 + Math.random() * 1.0, v: new THREE.Vector3((Math.random() - 0.5) * 4.5, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 4.5), spin: big ? new THREE.Vector3(Math.random() * 10, Math.random() * 10, 0) : undefined });
    }
  }
  private emitT = 0; private pushV = new THREE.Vector3(); private pushOff = new THREE.Vector3();
  /** Empuje corto (onda de choque). */
  /** Congela al enemigo `sec` segundos; mientras, recibe `vuln` veces el daño. */
  freeze(sec: number, vuln = 1) { this.holdT = Math.max(this.holdT, sec); this.vulnT = Math.max(this.vulnT, sec); this.vuln = Math.max(vuln, 1); }
  /** Lo levanta en el aire `sec` segundos a `h` m (luego cae de golpe). */
  lift(sec: number, h: number) { this.liftT = Math.max(this.liftT, sec); this.liftH = h * (0.85 + Math.random() * 0.3); }
  /** Arrastra al enemigo por el suelo hacia un punto (vórtice), sin pasarse. */
  drag(to: THREE.Vector3, dist: number) { const v = to.clone().setY(0).sub(this.group.position.clone().setY(0)); const l = v.length(); if (l > 0.6) this.group.position.addScaledVector(v.normalize(), Math.min(dist, l - 0.6)); }
  push(dir: THREE.Vector3, amount: number) { this.pushV.addScaledVector(dir, amount * 6); }
  private path: { a: THREE.Vector3; b: THREE.Vector3; speed: number; t: number } | null = null;
  private onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void;

  /** Aspecto: sin peana (camina con piernas completas) y variante de color y accesorios (enemigos de las oleadas). */
  private look: DummyLook | null = null;
  /** Tarea 1: el cuerpo ha pasado a ragdoll (física): no se anima la caída ni se tocan sus piezas desde aquí. */
  ragdolled = false;
  /** Partes visuales para el ragdoll (solo humanoides con piernas articuladas). */
  ragdollParts() {
    if (this.kind.shape || !this.legs.length || !this.armsH.length) return null;
    const head = (this.body.children as THREE.Object3D[]).filter((m) => (m as THREE.Mesh).isMesh && m.position.y > 2.05);
    const elbow = (sh: THREE.Object3D) => sh.children.find((c) => !(c as THREE.Mesh).isMesh) ?? sh;
    const sev = new Set(this.severed);
    return {
      body: this.body, head,
      arms: this.armsH.map((sh) => [sh, elbow(sh)] as [THREE.Object3D, THREE.Object3D]),
      legs: this.legs.map((h, i) => [h, this.knees[i]] as [THREE.Object3D, THREE.Object3D]),
      isSevered: (o: THREE.Object3D) => sev.has(o as THREE.Mesh) || !o.visible,
      /** Empuje de la muerte en el mundo (dirección del disparo y fuerza), para el impulso inicial. */
      push: new THREE.Vector3(this.deathDir.x, 0, this.deathDir.y).applyQuaternion(this.group.quaternion).multiplyScalar(this.deathV.length()),
    };
  }
  private legs: THREE.Object3D[] = []; private knees: THREE.Object3D[] = []; private bobY = 0; private walkT = Math.random() * 6;
  constructor(readonly kind: Kind, readonly id: string, pos: THREE.Vector3, overlay: HTMLElement, onDamage: (d: Dummy, amount: number, color: string, crit: boolean, at: THREE.Vector3) => void, look?: DummyLook) {
    this.look = look ? (kind.paint ? { ...look, ...kind.paint, extras: kind.key === "commander" ? ["helmet", "vest", "pads"] : kind.key === "medic" ? ["pack"] : look.extras } : look) : null;
    this.onDamage = onDamage;
    this.layers = [{ id: "health", value: kind.health, max: kind.health }];
    this.group.position.copy(pos); this.home.copy(pos);
    this.body.scale.setScalar(kind.scale ?? 1);
    this.group.add(this.body);
    if (kind.shape && kind.shape !== "humanoid") this.buildRobot(kind.shape); else this.build(kind);
    if (kind.fly) this.group.position.y = kind.fly;
    // Cada muñeco usa sus propias copias de material con un plano de recorte: así se materializa y se desintegra
    // de arriba abajo con una línea de escaneo, sin afectar a los demás.
    this.top = (kind.top ?? 2.4) * (kind.scale ?? 1);
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), this.top);
    const cache = new Map<THREE.Material, THREE.Material>();
    this.body.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      const src = m.material as THREE.Material;
      if (!cache.has(src)) {
        const c = src.clone() as THREE.MeshStandardMaterial; c.clippingPlanes = [this.clip]; cache.set(src, c);
        // Colores de la variante (traje, piezas oscuras y chaleco)
        if (this.look) { if (src === skin) c.color.set(this.look.suit); else if (src === skinDark) c.color.set(this.look.dark); else if (src === vest) c.color.set(this.look.vest); }
      }
      m.material = cache.get(src)!;
    });
    for (const m of cache.values()) if ((m as THREE.MeshStandardMaterial).emissive) this.mats.push(m as THREE.MeshStandardMaterial);
    if (this.blink) this.blink = (cache.get(this.blink) as THREE.MeshStandardMaterial) ?? this.blink;
    this.glowSkip = new Set(this.mats.filter((m) => m.emissiveIntensity > 1)); this.baseEm = this.mats.map((m) => m.emissive.clone());
    if (!this.model) this.body.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.zone === "head") this.heads.push({ m, z: m.position.z }); });
    // (modelo procedural de respaldo: cuando llegue el GLB, se cambia por él)
    if (this.model && !this.model.fromGlb && isModelShape(kind.shape)) void loadEnemyModel(kind.shape).then((m) => { if (m && !this.gone) this.useModel(m, true); });
    this.scan = new THREE.Mesh(new THREE.RingGeometry(0.36 * (kind.scale ?? 1), 0.42 * (kind.scale ?? 1), 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ee, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    this.scan.rotation.x = -Math.PI / 2; this.group.add(this.scan);
    this.bar = document.createElement("div");
    this.bar.className = "hpbar" + (kind.boss ? " boss" : "");
    this.bar.innerHTML = `<div class="hpname"><b>${kind.level}</b> <span class="nm">${t(`dummy.${kind.key}`)}</span></div><div class="hptrack"><i class="lag"></i><i class="hp"></i></div>`;
    (kind.boss ? document.getElementById("bossbar")! : overlay).appendChild(this.bar);
  }

  /** Segundos que quedan de "combate" (el jefe solo enseña su barra mientras se le está atacando). */
  engagedT = 0;
  /** Jefe de oleada: su barra se ve siempre mientras vive (estilo jefe de shooter de botín). */ alwaysBar = false;
  get health() { return this.layers[this.layers.length - 1].value; }
  relabel() { this.bar.querySelector(".nm")!.textContent = t(`dummy.${this.kind.key}`); }
  setPath(a: THREE.Vector3, b: THREE.Vector3, speed: number) { this.path = { a, b, speed, t: Math.random() }; }
  /** Enemigo de oleada: no reaparece; avanza hacia el jugador y le golpea al llegar. */
  respawn = true;
  /** Ha terminado de desintegrarse (se puede quitar de la escena). */
  gone = false;
  chase: { target: () => THREE.Vector3; speed: number; range: number; interval: number; damage: number; onAttack: (dmg: number) => void; cd: number } | null = null;

  private part(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, zone: Zone | null) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    this.body.add(m);
    if (zone) { m.userData = { dummy: this, zone }; this.hitboxes.push(m); }
    return m;
  }

  private build(kind: Kind) {
    const cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 4, 10);
    const L = this.look;
    if (!L) {
      // (la peana va fuera del cuerpo: no se inclina con los impactos ni se desintegra)
      for (const [geo, y] of [[new THREE.CylinderGeometry(0.35, 0.42, 0.08, 16), 0.04], [new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), 0.3]] as const) { const m = new THREE.Mesh(geo, standMat); m.position.y = y * (kind.scale ?? 1); m.scale.setScalar(kind.scale ?? 1); m.castShadow = m.receiveShadow = true; this.group.add(m); }
      this.part(cap(0.085, 0.62), skin, -0.11, 0.98, 0, "limb");
      this.part(cap(0.085, 0.62), skin, 0.11, 0.98, 0, "limb");
    } else {
      // Sin peana: piernas completas hasta el suelo, con pies; cada pierna gira desde la cadera al andar
      for (const x of [-0.11, 0.11]) {
        const hip = new THREE.Group(); hip.position.set(x, 1.27, 0); this.body.add(hip); this.legs.push(hip);
        // Rodilla: la mitad baja de la pierna cuelga de ella y se dobla al dar el paso (antes la pierna era rígida)
        const knee = new THREE.Group(); knee.position.y = -0.6; hip.add(knee); this.knees.push(knee);
        const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number, z = 0, zone: Zone | null = "limb") => { const m = new THREE.Mesh(geo, mat); const low = y < -0.6; m.position.set(0, low ? y + 0.6 : y, z); m.castShadow = true; (low ? knee : hip).add(m); if (zone) { m.userData = { dummy: this, zone }; this.hitboxes.push(m); } return m; };
        add(cap(0.09, 0.5), skin, -0.33); add(cap(0.075, 0.5), skin, -0.92);
        add(new THREE.BoxGeometry(0.13, 0.08, 0.24), skinDark, -1.23, 0.04);
        // Soldado de la simulación (referencias de Coded Arms): rodillera, espinillera y bota gruesa con suela
        add(new THREE.BoxGeometry(0.13, 0.12, 0.1), armorMat, -0.62, 0.07, null);
        add(new THREE.BoxGeometry(0.11, 0.3, 0.06), armorMat, -0.9, 0.065, null);
        add(new THREE.BoxGeometry(0.15, 0.12, 0.28), bootMat, -1.2, 0.05, null);
        add(new THREE.BoxGeometry(0.16, 0.035, 0.3), soleMat, -1.26, 0.05, null);
        const vein = veinMat(kind); if (vein) { add(new THREE.BoxGeometry(0.012, 0.42, 0.012), vein, -0.4, 0.088, null); add(new THREE.BoxGeometry(0.012, 0.36, 0.012), vein, -0.9, 0.1, null); }
      }
    }
    this.part(new THREE.BoxGeometry(0.36, 0.2, 0.2), skinDark, 0, 1.38, 0, "body");
    this.part(cap(0.19, 0.38), skin, 0, 1.68, 0, "body").scale.set(1.15, 1, 0.75);
    // Brazos colgando del hombro (giran desde ahí al andar y al golpear, no desde el centro)
    // (brazo con codo: brazo, antebrazo algo doblado hacia delante y guante; antes era un solo «palo»)
    const arm = (x: number) => {
      const sh = new THREE.Group(); sh.position.set(x, 1.86, 0); sh.rotation.z = x < 0 ? 0.18 : -0.18; this.body.add(sh);
      const hit = (m: THREE.Mesh, parent: THREE.Object3D) => { m.castShadow = true; parent.add(m); m.userData = { dummy: this, zone: "limb" }; this.hitboxes.push(m); return m; };
      hit(new THREE.Mesh(cap(0.075, 0.2), skin), sh).position.y = -0.15;
      const el = new THREE.Group(); el.position.y = -0.31; el.rotation.x = -0.35; sh.add(el);
      hit(new THREE.Mesh(cap(0.062, 0.2), skin), el).position.y = -0.14;
      const hand = hit(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.07), skinDark), el); hand.position.y = -0.31;
      return sh;
    };
    const armL = arm(-0.3), armR = arm(0.3);
    if (L) this.armsH = [armL, armR];
    this.part(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 10), skinDark, 0, 1.98, 0, "body");
    this.part(new THREE.SphereGeometry(0.13, 16, 12), skin, 0, 2.13, 0, "head").scale.set(1, 1.12, 1.02);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0xe8a040 }));
    ring.position.set(0, 1.7, 0.145); this.body.add(ring);
    // Los muñecos más duros llevan chaleco (solo estética: no es una capa de armadura)
    if (kind.key !== "basic" || L?.vest !== undefined && L.extras.includes("vest")) this.part(new THREE.BoxGeometry(0.46, 0.48, 0.34), vest, 0, 1.68, 0, "body");
    if (L) {
      if (L.extras.includes("helmet")) { const h = this.part(new THREE.SphereGeometry(0.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), vest, 0, 2.17, 0, "head"); h.scale.set(1.05, 0.9, 1.1); }
      if (L.extras.includes("pack")) this.part(new THREE.BoxGeometry(0.34, 0.4, 0.16), skinDark, 0, 1.66, -0.26, "body");
      if (L.extras.includes("visor")) this.part(new THREE.BoxGeometry(0.2, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.3, metalness: 0.5 }), 0, 2.16, 0.12, null);
      if (L.extras.includes("pads")) for (const x of [-0.3, 0.3]) this.part(new THREE.BoxGeometry(0.16, 0.08, 0.2), vest, x, 1.86, 0, "limb");
      if (L.bulk !== 1) this.body.scale.x *= L.bulk;
      // Armadura: casco con visor luminoso, hombreras con emblema, chaleco con bolsas, cinturón y mochila de energía
      const visor = new THREE.MeshStandardMaterial({ color: 0x220806, emissive: VISOR[kind.key] ?? 0xff3a1e, emissiveIntensity: 1.8 });
      this.part(new THREE.SphereGeometry(0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), armorMat, 0, 2.15, 0, "head").scale.set(1.04, 1, 1.1);
      // Visor: una banda curva continua por delante del casco (antes una caja que el casco tapaba en el centro y parecían dos ojos)
      { const v = this.part(new THREE.CylinderGeometry(0.168, 0.168, 0.065, 20, 1, true, -0.85, 1.7), visor, 0, 2.15, 0, null); v.scale.set(1.04, 1, 1.1); (visor as THREE.MeshStandardMaterial).side = THREE.DoubleSide; }
      this.part(new THREE.BoxGeometry(0.2, 0.06, 0.08), armorMat, 0, 2.06, 0.1, null); // (protector de la mandíbula)
      for (const x of [-0.3, 0.3]) {
        this.part(new THREE.BoxGeometry(0.2, 0.09, 0.24), armorMat, x, 1.9, 0, "limb").rotation.z = -Math.sign(x) * 0.25;
        this.part(new THREE.CircleGeometry(0.045, 12), emblemMat, x * 1.12, 1.9, 0.0, null).rotation.y = Math.sign(x) * Math.PI / 2;
      }
      this.part(new THREE.BoxGeometry(0.44, 0.36, 0.08), armorMat, 0, 1.68, 0.16, "body");
      for (const x of [-0.12, 0, 0.12]) this.part(new THREE.BoxGeometry(0.1, 0.11, 0.07), pouchMat, x, 1.48, 0.2, null);
      this.part(new THREE.BoxGeometry(0.42, 0.06, 0.3), pouchMat, 0, 1.33, 0, null);
      this.part(new THREE.BoxGeometry(0.32, 0.36, 0.14), armorMat, 0, 1.72, -0.22, "body");
      this.part(new THREE.BoxGeometry(0.2, 0.04, 0.02), visor, 0, 1.8, -0.295, null); // (luz de la mochila)
      const vein = veinMat(kind);
      if (vein) { for (const x of [-0.31, 0.31]) this.part(new THREE.BoxGeometry(0.012, 0.4, 0.012), vein, x, 1.55, 0.07, null); this.part(new THREE.BoxGeometry(0.014, 0.3, 0.012), vein, 0.06, 1.66, 0.205, null); }
    }
    if (L) { this.bulkUp(kind); this.dressKind(kind); }
    // Soldados: arma en las manos, apuntando al frente (fusil corto o fusil largo con mira)
    if (kind.gun) {
      const g = new THREE.Group(); g.position.set(0.12, 1.55, 0.26); this.body.add(g);
      const long = kind.gun === "sniper";
      const pieces: [number, number, number, number, number, number][] = [[0.07, 0.11, 0.42, 0, 0, 0], [0.035, 0.035, long ? 0.62 : 0.32, 0, 0.02, long ? 0.5 : 0.36], [0.06, 0.12, 0.2, 0, -0.01, -0.28], [0.05, 0.13, 0.06, 0, -0.1, 0.05]];
      if (long) pieces.push([0.05, 0.05, 0.24, 0, 0.09, 0.02]); else pieces.push([0.05, 0.16, 0.07, 0, -0.12, 0.14]);
      for (const [w, h, d, x, y, z] of pieces) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), robotDark); m.position.set(x, y, z); m.castShadow = true; g.add(m); }
      for (const [x, rz] of [[-0.3, 0.18], [0.3, -0.18]] as const) { const arm = this.body.children.find((o) => o.position.x === x && o.position.y === 1.86); if (arm) { arm.rotation.set(-1.25, 0, rz * 0.4); arm.position.set(x * 0.75, 1.84, 0.04); } }
    }
    // Guardián: placas de armadura y un escudo frontal grande (las balas rebotan; hay que rodearlo o darle en las piernas)
    if (kind.shield) {
      for (const [w, h, d, x, y, z] of [[0.52, 0.5, 0.36, 0, 1.68, 0], [0.24, 0.12, 0.3, -0.3, 1.88, 0], [0.24, 0.12, 0.3, 0.3, 1.88, 0]] as const) this.part(new THREE.BoxGeometry(w, h, d), robotMetal, x, y, z, "body");
      const sh = this.part(new THREE.BoxGeometry(0.9, 1.3, 0.08), robotPlate, -0.05, 1.3, 0.42, "shield");
      this.part(new THREE.BoxGeometry(0.6, 0.06, 0.02), new THREE.MeshStandardMaterial({ color: 0x220806, emissive: 0xff7a2a, emissiveIntensity: 1.4 }), -0.05, 1.75, 0.47, null);
      sh.rotation.x = -0.06;
    }
  }

  get center() { return this.group.localToWorld(new THREE.Vector3(0, (this.kind.cy ?? 1.5) * (this.kind.scale ?? 1), 0)); }

  // ---------- Robots ----------
  /** Piezas animadas de los robots: rotores, patas de araña, bola rodante, cabeza de torreta y luz que parpadea. */
  private rotors: THREE.Object3D[] = []; private spiderLegs: { g: THREE.Group; ph: number; side: number }[] = [];
  private rollBall: THREE.Object3D | null = null; private turretHead: THREE.Object3D | null = null; private blink: THREE.MeshStandardMaterial | null = null;
  /** Salto de la araña (se abalanza al acercarse). */ private pounceT = 0; private pounceCd = 2;
  /** Aura del comandante: más velocidad y daño mientras dura. */ buffT = 0;
  /** Ralentizado (torreta criogénica, brea): fracción de su velocidad mientras dura. */ slowT = 0; slowF = 1;
  slow(sec: number, f: number) { this.slowT = Math.max(this.slowT, sec); this.slowF = Math.min(this.slowT > sec ? this.slowF : 1, f); }
  /** Brazos de los humanoides (balanceo al andar y zarpazo al atacar). */ private armsH: THREE.Object3D[] = []; private attackT = 0;
  /** Fallo de código: tiempo hasta el siguiente salto y salto en curso (intocable). */ private glitchT = 2 + Math.random() * 2; private phaseT = 0;
  /** Cura (médico): no pasa de la vida máxima. Devuelve lo curado. */
  heal(n: number) { if (!this.alive) return 0; const l = this.layers[this.layers.length - 1], h = Math.min(n, l.max - l.value); l.value += h; return h; }
  get hurt() { const l = this.layers[this.layers.length - 1]; return 1 - l.value / l.max; }
  private add(o: THREE.Object3D, parent: THREE.Object3D, zone: Zone | null) {
    parent.add(o); o.traverse((x) => { const m = x as THREE.Mesh; if (m.isMesh) { m.castShadow = true; if (zone) { m.userData = { dummy: this, zone }; this.hitboxes.push(m); } } }); return o;
  }
  // ---------- Robots con modelo (sabueso, dron reparador, centinela) ----------
  /** Modelo GLB (o su respaldo procedural) y sus pivotes `mov_*`. */ private model: EnemyModel | null = null;
  /** Materiales que brillan (ojos, luces): se avivan para avisar de un ataque. */ private lights: { m: THREE.MeshStandardMaterial; base: number }[] | null = null;
  /** Lado por el que rodea el sabueso (±1) y reloj de su salto (-1: sin saltar). */ private flankSide = Math.random() < 0.5 ? -1 : 1; private leapClock = -1;
  /** Rayo de reparación en curso (lo pone `Waves` al curar) y hacia dónde. */ beamT = 0; readonly beamTo = new THREE.Vector3();
  /** Carga del disparo del centinela (0..1, aviso). */ charge = 0;
  /**
   * Pone el modelo: sus mallas son las cajas de impacto (zona según el nombre de la pieza). `late` = después del
   * constructor (el GLB ha llegado tarde): clona aquí los materiales con el plano de recorte.
   */
  private useModel(m: EnemyModel, late: boolean) {
    if (this.model) {
      const old = new Set<THREE.Object3D>(); this.model.root.traverse((o) => old.add(o));
      for (let i = this.hitboxes.length - 1; i >= 0; i--) if (old.has(this.hitboxes[i])) this.hitboxes.splice(i, 1);
      this.body.remove(this.model.root);
    }
    this.model = m; this.lights = null; this.body.add(m.root);
    const cache = new Map<THREE.Material, THREE.Material>();
    m.root.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.userData = { dummy: this, zone: mesh.userData.zone ?? "body" }; this.hitboxes.push(mesh);
      if (!late) return;
      const src = mesh.material as THREE.Material;
      if (!cache.has(src)) { const c = src.clone(); c.clippingPlanes = [this.clip]; cache.set(src, c); }
      mesh.material = cache.get(src)!;
    });
    for (const c of cache.values()) { const sm = c as THREE.MeshStandardMaterial; if (!sm.emissive) continue; this.mats.push(sm); this.baseEm.push(sm.emissive.clone()); if (sm.emissiveIntensity > 1) this.glowSkip.add(sm); }
  }
  /** Animación de los robots con modelo: patas al galope y mordisco, rotores y brazo soldador, anillo y cañón. */
  private animModel(dt: number, moving: number) {
    const m = this.model!, rig = m.rig, P = this.pose, a = this.attackT > 0 ? Math.sin((1 - this.attackT / 0.4) * Math.PI) : 0;
    const rest = (o: THREE.Object3D) => o.userData.rest as { p: THREE.Vector3; r: THREE.Euler };
    if (!this.lights) {
      const ls: { m: THREE.MeshStandardMaterial; base: number }[] = [], seen = new Set<THREE.Material>();
      // (ojos, focos y franjas de luz: los materiales con nombre de luz o que ya brillan)
      m.root.traverse((o) => { const mt = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (mt?.emissive && !seen.has(mt) && (/luz|lente/.test(mt.name) || mt.emissiveIntensity > 1)) { seen.add(mt); ls.push({ m: mt, base: mt.emissiveIntensity }); } });
      this.lights = ls;
    }
    const glow = (k: number) => { for (const l of this.lights!) l.m.emissiveIntensity = this.alive ? l.base * (1 + k) : 0; };
    const sh = this.kind.shape;
    if (sh === "hound") {
      // Galope: las patas de delante van juntas (algo desfasadas) y las de detrás, en contra; el lomo cabecea
      const ps = pounceState(this.leapClock), w = this.walkT * 3.1, A = 0.6 * moving;
      const legs = [0, 0.35, Math.PI, Math.PI + 0.35];
      for (let i = 0; i < 4; i++) {
        const leg = rig.get(`mov_pata_${i + 1}`); if (!leg) continue;
        let r = Math.sin(w + legs[i]) * A;
        if (ps.phase === "crouch") r = (i < 2 ? -0.35 : 0.45) * ps.k; // (agachado: patas recogidas)
        else if (ps.phase === "leap") r = i < 2 ? 0.9 : -0.8; // (en el aire: estirado, delante y detrás)
        leg.rotation.z = rest(leg).r.z + r;
      }
      const jaw = rig.get("mov_mandibula");
      if (jaw) jaw.rotation.z = rest(jaw).r.z - (ps.phase !== "none" ? 0.55 : 0.6 * a + 0.05 * Math.sin(this.walkT * 7) * moving);
      P.lean = Math.sin(w * 2) * 0.05 * moving;
      if (ps.phase === "crouch") { P.dip = 0.12 * ps.k; P.lean = 0.12 * ps.k; }
      else if (ps.phase === "leap") { P.dip = -Math.sin(ps.k * Math.PI) * 0.45; P.lean = -0.25 + 0.5 * ps.k; }
      glow(ps.phase === "crouch" ? 2.5 * ps.k : ps.phase === "leap" ? 2 : 0);
    } else if (sh === "repairer") {
      for (let i = 1; i <= 4; i++) { const r = rig.get(`mov_rotor_${i}`); if (r) r.rotation.y += dt * (i % 2 ? 46 : -46); }
      this.beamT = Math.max(0, this.beamT - dt);
      const arm = rig.get("mov_brazo"), on = this.beamT > 0 && this.alive;
      // (curando: el brazo baja hacia el aliado y tiembla al soldar)
      if (arm) { const R = rest(arm).r; arm.rotation.z += ((on ? -0.55 + Math.sin(this.walkT * 30) * 0.05 : R.z) - arm.rotation.z) * Math.min(1, dt * 8); arm.rotation.y = R.y + (on ? Math.sin(this.walkT * 9) * 0.12 : 0); }
      for (const n of ["haz_soldadura", "halo_soldadura", "chispa_haz"]) { const o = rig.get(n); if (o) o.visible = on && (n !== "chispa_haz" || Math.random() < 0.7); }
      P.lean = 0.2 * moving + (on ? 0.12 : 0);
      glow(on ? 0.6 + Math.random() * 0.4 : 0);
    } else if (sh === "sentinel") {
      const ring = rig.get("mov_anillo"); if (ring) ring.rotation.y += dt * (1.6 + 6 * this.charge);
      const can = rig.get("mov_canon"); if (can) can.position.x = rest(can).p.x - 0.06 * a + 0.01 * this.charge * Math.sin(this.walkT * 40);
      glow(this.charge * 3);
    }
  }
  private buildRobot(shape: Shape) {
    if (isModelShape(shape)) { this.useModel(enemyModelNow(shape), false); return; }
    const B = this.body, box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const cyl = (r0: number, r1: number, h: number, m: THREE.Material, n = 12) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, n), m);
    const at = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x220806, emissive: shape === "drone" ? 0x3fd0ff : 0xff3a1e, emissiveIntensity: 1.6 });
    if (shape === "drone") {
      // Dron: cuerpo achatado, cuatro brazos con rotores y un ojo-cámara (punto débil) delante; cañón debajo
      const hull = this.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), robotPlate), 0, 0, 0), B, "body"); hull.scale.set(1, 0.5, 1.1);
      this.add(at(box(0.5, 0.08, 0.5, robotMetal), 0, -0.06, 0), B, "body");
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2, arm = box(0.5, 0.05, 0.07, robotMetal); arm.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36); arm.rotation.y = -a; this.add(arm, B, "limb");
        const hub = at(new THREE.Group(), Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6); B.add(hub);
        this.add(cyl(0.05, 0.05, 0.08, robotMetal), hub, "limb");
        const blade = box(0.42, 0.012, 0.05, robotDark); blade.position.y = 0.05; hub.add(blade); const b2 = blade.clone(); b2.rotation.y = Math.PI / 2; hub.add(b2); this.rotors.push(hub);
      }
      this.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), eyeMat), 0, -0.02, 0.33), B, "head");
      this.add(at(cyl(0.035, 0.035, 0.3, robotDark).rotateX(Math.PI / 2), 0, -0.16, 0.18), B, "body");
    } else if (shape === "spider") {
      // Araña robot: abdomen y cabeza con dos ojos rojos (punto débil), seis patas articuladas que dan pasos
      this.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), robotPlate), 0, 0.58, -0.18), B, "body").scale.set(1, 0.7, 1.2);
      this.add(at(box(0.34, 0.2, 0.34, robotMetal), 0, 0.56, 0.2), B, "body");
      const head = this.add(at(box(0.22, 0.15, 0.18, robotDark), 0, 0.58, 0.44), B, "head");
      // (visor continuo en lugar de dos ojos)
      this.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), eyeMat), 0, 0.02, 0.095), head, "head");
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1, k = i % 3, g = at(new THREE.Group(), side * 0.2, 0.58, 0.28 - k * 0.24); g.rotation.y = side * (0.5 - k * 0.5) * -1; B.add(g);
        const upper = new THREE.Group(); upper.rotation.z = side * 0.6; g.add(upper); // (muslo hacia arriba y afuera)
        const seg1 = box(0.42, 0.075, 0.075, robotMetal); seg1.position.x = side * 0.21; this.add(seg1, upper, "limb");
        const knee = at(new THREE.Group(), side * 0.42, 0, 0); upper.add(knee); knee.rotation.z = -side * 1.85; // (y la tibia baja hasta el suelo)
        this.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), robotMetal), 0, 0, 0), knee, "limb");
        const seg2 = box(0.86, 0.06, 0.06, robotDark); seg2.position.x = side * 0.43; this.add(seg2, knee, "limb");
        const foot = at(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 6), robotMetal), side * 0.88, 0, 0); foot.rotation.z = side * Math.PI / 2; this.add(foot, knee, "limb");
        g.userData.y0 = g.rotation.y; this.spiderLegs.push({ g, ph: (k + (side > 0 ? 1 : 0)) % 2 ? Math.PI : 0, side });
      }
      this.blink = eyeMat;
    } else if (shape === "roller") {
      // Kamikaze: bola rodante con una banda de luz que parpadea más rápido al acercarse y explota
      const ball = at(new THREE.Group(), 0, 0.4, 0); B.add(ball); this.rollBall = ball;
      this.add(new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), robotPlate), ball, "body");
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.385, 0.04, 6, 24), eyeMat); this.add(band, ball, "head");
      const band2 = new THREE.Mesh(band.geometry, eyeMat); band2.rotation.y = Math.PI / 2; this.add(band2, ball, "head");
      this.blink = eyeMat;
    } else {
      // Torreta: trípode, cabeza giratoria con dos cañones y un núcleo trasero brillante (punto débil, triple daño)
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2, leg = box(0.08, 0.08, 0.9, robotDark); leg.position.set(Math.sin(a) * 0.32, 0.3, Math.cos(a) * 0.32); leg.rotation.y = a; leg.rotation.x = 0.65; this.add(leg, B, "limb"); }
      this.add(at(cyl(0.12, 0.16, 0.6, robotMetal), 0, 0.75, 0), B, "body");
      const head = at(new THREE.Group(), 0, 1.15, 0); B.add(head); this.turretHead = head;
      this.add(box(0.55, 0.36, 0.6, robotPlate), head, "body");
      for (const x of [-0.12, 0.12]) this.add(at(cyl(0.04, 0.045, 0.6, robotDark).rotateX(Math.PI / 2), x, 0, 0.55), head, "body");
      this.add(at(box(0.36, 0.06, 0.04, eyeMat), 0, 0.1, 0.31), head, null);
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x062026, emissive: 0x3fd0d8, emissiveIntensity: 1.8 });
      this.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), coreMat), 0, 0, -0.32), head, "head");
    }
  }
  /** Postura extra de este fotograma (inclinación, agachado, alabeo) que suma cada estilo de animación. */
  private pose = { lean: 0, dip: 0, roll: 0 }; private cmdT = 3 + Math.random() * 4;
  /**
   * Animación propia de cada tipo: cómo anda y cómo ataca (attackT se pone a 0,4 s en cada ataque).
   * Pequeños: corren encorvados y lanzan dos golpes rápidos. Grandes, resistentes y jefes: andar pesado de lado a lado
   * y golpe con los dos brazos por encima de la cabeza. Élite: guardia alta, se mueve de lado y gancho. Lanzador: los
   * dos brazos al frente al lanzar. Médico: se agacha y extiende el brazo al curar. Comandante: señala al frente de vez
   * en cuando. Fallo: brazos con tics. Tirador: retroceso del arma. Francotirador: agachado al apuntar. Guardián: carga
   * con el escudo. Robots: el dron se inclina y retrocede al disparar, la bola bota, la torreta retrocede, la araña salta.
   */
  private animStyle(dt: number, moving: number) {
    const P = this.pose; P.lean = P.dip = P.roll = 0; P.lean = this.huntch;
    this.orbsK.forEach((o, i) => { o.position.y += Math.sin(this.walkT * 1.5 + i) * 0.002; o.rotation.y += dt * 2; });
    this.attackT = Math.max(0, this.attackT - dt);
    const k = this.attackT > 0 ? 1 - this.attackT / 0.4 : 0, a = this.attackT > 0 ? Math.sin(k * Math.PI) : 0, key = this.kind.key;
    if (!this.alive) return;
    const arms = this.armsH, ease = (m: THREE.Object3D, x: number, z: number | null, r: number) => { m.rotation.x += (x - m.rotation.x) * Math.min(1, dt * r); if (z != null) m.rotation.z += (z - m.rotation.z) * Math.min(1, dt * r); };
    const w = this.walkT;
    if (this.kind.shape === "drone") { P.lean = 0.22 * moving - 0.25 * a; }
    else if (this.kind.shape === "roller" && this.rollBall) this.rollBall.position.y = 0.4 + Math.abs(Math.sin(w * 3)) * 0.06 * moving;
    else if (this.kind.shape === "turret" && this.turretHead) this.turretHead.position.y = 1.15 - 0.03 * a, this.turretHead.children.forEach((c) => { if (c.position.z > 0.4) c.position.z = 0.55 - 0.12 * a; });
    else if (this.kind.shape === "spider") { if (this.pounceT > 0) P.dip = -Math.sin((1 - this.pounceT / 0.35) * Math.PI) * 0.5; P.lean = -0.15 * a; }
    if (!arms.length) return;
    const [L, R] = arms;
    if (this.kind.gun) {
      // Soldados con arma: retroceso al disparar; el francotirador se agacha cuando está parado apuntando
      P.lean = -0.06 * a;
      if (this.kind.gun === "sniper" && !moving) { P.dip = 0.28; P.lean += 0.12; this.legs.forEach((l, i) => (l.rotation.x = i ? 0.9 : -0.3)); }
      return;
    }
    if (this.kind.shield) { P.lean = 0.05 + 0.2 * a; if (a > 0) this.pushOff.z += a * 0.01; P.roll = Math.sin(w) * 0.05 * moving; return; } // (carga con el escudo)
    switch (key) {
      case "small": {
        P.lean = 0.12 * moving + 0.05;
        const jab = this.attackT > 0 ? Math.max(0, Math.sin(k * Math.PI * 2)) : 0, jab2 = this.attackT > 0 ? Math.max(0, -Math.sin(k * Math.PI * 2)) : 0;
        ease(L, Math.sin(w) * 0.45 * moving - 1.6 * jab2 - 0.15, null, 16); ease(R, -Math.sin(w) * 0.45 * moving - 1.6 * jab - 0.15, null, 16);
        break;
      }
      case "large": case "sturdy": case "boss": case "warden": {
        P.roll = Math.sin(w) * 0.08 * moving; P.lean = 0.06;
        // Golpe a dos manos: sube (60 %) y baja de golpe (agachándose al caer)
        const up = this.attackT > 0 ? (k < 0.6 ? k / 0.6 : 1 - (k - 0.6) / 0.4) : 0;
        if (this.attackT > 0 && k > 0.6) P.dip = 0.1 * (1 - (k - 0.6) / 0.4);
        ease(L, Math.sin(w) * 0.3 * moving - 2.8 * up, 0.18, 10); ease(R, -Math.sin(w) * 0.3 * moving - 2.8 * up, -0.18, 10);
        break;
      }
      case "elite": {
        P.lean = 0.12; this.pushOff.x += Math.sin(w * 0.45) * 0.003 * moving; // (se mueve de lado mientras avanza)
        ease(L, -0.7 + Math.sin(w) * 0.2 * moving, 0.4, 12); ease(R, -0.7 - 2.0 * a, -0.4 + 0.5 * a, 16); P.roll = -0.12 * a;
        break;
      }
      case "caster": {
        P.dip = Math.sin(w * 0.8) * 0.03; // (balanceo de canalización)
        ease(L, -0.3 - 1.3 * a, 0.25 - 0.2 * a, 12); ease(R, -0.3 - 1.3 * a, -0.25 + 0.2 * a, 12);
        break;
      }
      case "medic": {
        const healing = this.attackT > 0 ? 1 : 0;
        P.dip = 0.18 * healing; P.lean = 0.15 * healing;
        ease(L, Math.sin(w) * 0.4 * moving, null, 10); ease(R, healing ? -1.5 : -Math.sin(w) * 0.4 * moving, null, 12);
        break;
      }
      case "commander": {
        this.cmdT -= dt; const point = this.cmdT < 1 ? Math.sin(Math.max(0, this.cmdT) * Math.PI) : 0; if (this.cmdT <= 0) this.cmdT = 5 + Math.random() * 4;
        P.lean = 0.04; P.roll = Math.sin(w) * 0.04 * moving;
        ease(L, Math.sin(w) * 0.35 * moving, null, 10); ease(R, -Math.sin(w) * 0.35 * moving - 1.6 * point - 1.9 * a, null, 12);
        break;
      }
      case "glitch": {
        const tic = () => (Math.random() < 0.08 ? (Math.random() - 0.5) * 2 : 0);
        ease(L, Math.sin(w) * 0.5 * moving + tic() - 1.5 * a, null, 20); ease(R, -Math.sin(w) * 0.5 * moving + tic() - 1.5 * a, null, 20); P.roll = (Math.random() < 0.05 ? (Math.random() - 0.5) * 0.3 : 0);
        break;
      }
      default: {
        ease(L, Math.sin(w) * 0.45 * moving, null, 10); ease(R, -Math.sin(w) * 0.45 * moving - 1.7 * a, null, 14);
        if (a > 0) this.pushOff.z += a * 0.004; // (se echa hacia delante al golpear)
      }
    }
  }
  /**
   * Volumen de soldado de la simulación (como las referencias): casco grande con visor estrecho, hombreras
   * redondeadas, peto y espaldar gruesos, mochila grande con cables, muslos y antebrazos acolchados. Solo estética.
   */
  private bulkUp(kind: Kind) {
    // (armadura del color de cada enemigo, algo más oscura: así no se pierde lo que distingue a cada uno)
    const tone = new THREE.Color(this.look?.suit ?? 0x5a6470);
    const B = this.body, arm = new THREE.MeshStandardMaterial({ color: tone.clone().multiplyScalar(0.75), roughness: 0.55, metalness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x16191d, roughness: 0.7 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = B) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; parent.add(o); return o; };
    // Casco grande que envuelve la cabeza (el visor del casco base queda delante)
    add(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), arm, 0, 2.12, -0.02, 1, 0.95, 1.1);
    add(new THREE.BoxGeometry(0.34, 0.08, 0.3), dark, 0, 2.02, -0.02);
    // Visor estrecho y luminoso delante del casco grande
    { const v = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 20, 1, true, -0.8, 1.6), new THREE.MeshStandardMaterial({ color: 0x220806, emissive: VISOR[kind.key] ?? 0xff3a1e, emissiveIntensity: 2, side: THREE.DoubleSide })); v.position.set(0, 2.14, -0.02); v.scale.set(1, 1, 1.1); B.add(v); }
    // Hombreras redondeadas
    for (const x of [-0.34, 0.34]) add(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), arm, x, 1.86, 0, 1.15, 0.9, 1.2);
    // Peto y espaldar gruesos, con faja
    add(new THREE.BoxGeometry(0.52, 0.42, 0.12), arm, 0, 1.7, 0.17); add(new THREE.BoxGeometry(0.5, 0.42, 0.1), arm, 0, 1.72, -0.18);
    add(new THREE.CylinderGeometry(0.22, 0.24, 0.16, 12), dark, 0, 1.36, 0, 1.15, 1, 0.85);
    // Mochila grande con cables que bajan a la cintura
    add(new THREE.BoxGeometry(0.42, 0.5, 0.22), dark, 0, 1.74, -0.34);
    for (const x of [-0.14, 0.14]) { const c = add(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), dark, x, 1.44, -0.3); c.rotation.x = 0.25; }
    // Muslos acolchados (cuelgan de la cadera de cada pierna)
    for (const hip of this.legs) add(new THREE.BoxGeometry(0.17, 0.3, 0.19), arm, 0, -0.22, 0.01, 1, 1, 1, hip);
    // Leve encorvamiento de combate
    this.huntch = 0.08;
  }
  /** Inclinación base hacia delante (soldados acorazados). */ private huntch = 0;
  /** Rasgos propios de cada tipo de humanoide, para reconocerlo de lejos por su silueta (solo estética). */
  private dressKind(kind: Kind) {
    const k = kind.key, B = this.body;
    const M = (c: number, e = 0, ei = 1.4) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0.3, emissive: e, emissiveIntensity: e ? ei : 0 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; B.add(o); return o; };
    const cyl = (r0: number, r1: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 12) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y, z); o.castShadow = true; B.add(o); return o; };
    const glow = (c: number) => M(0x101010, c, 2);
    switch (k) {
      case "small": { // explorador: antenas y visor amarillo
        for (const x of [-0.07, 0.07]) { cyl(0.008, 0.008, 0.28, x, 2.4, -0.04, M(0x30343a)); cyl(0.022, 0.022, 0.03, x, 2.55, -0.04, glow(0xffd040)); }
        box(0.24, 0.05, 0.05, 0, 2.16, 0.15, glow(0xffd040));
        break;
      }
      case "large": case "sturdy": { // pesado: hombreras enormes y peto grueso
        const pm = M(0x4a4e56);
        for (const x of [-0.36, 0.36]) { box(0.3, 0.16, 0.36, x, 1.98, 0, pm, 0, -Math.sign(x) * 0.3); box(0.26, 0.04, 0.32, x, 2.07, 0, glow(0xff7a2a), 0, -Math.sign(x) * 0.3); }
        box(0.56, 0.44, 0.14, 0, 1.68, 0.2, pm); box(0.3, 0.05, 0.02, 0, 1.78, 0.275, glow(0xff7a2a));
        break;
      }
      case "elite": { // élite: cresta y capa
        box(0.03, 0.14, 0.26, 0, 2.33, -0.02, glow(0xff2a6a));
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.95), new THREE.MeshStandardMaterial({ color: 0x5a0f22, side: THREE.DoubleSide, roughness: 0.9 })); cape.position.set(0, 1.45, -0.31); cape.rotation.x = 0.12; B.add(cape);
        break;
      }
      case "caster": { // lanzador: capucha, túnica y esferas flotando junto a las manos
        const robe = M(0x23304a);
        cyl(0.17, 0.11, 0.3, 0, 2.27, -0.03, robe, 10).rotation.x = -0.25;
        cyl(0.22, 0.34, 0.55, 0, 1.08, 0, robe, 12);
        for (const x of [-0.42, 0.42]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), glow(0x8fd8ff)); o.position.set(x, 1.3, 0.2); B.add(o); this.orbsK.push(o); }
        break;
      }
      case "medic": { // médico: cruces verdes y botiquín
        const g = glow(0x4aff9a);
        for (const z of [0.205, -0.3]) { box(0.16, 0.05, 0.02, 0, 1.7, z, g); box(0.05, 0.16, 0.02, 0, 1.7, z, g); }
        box(0.18, 0.14, 0.12, 0.26, 1.34, 0.06, M(0xe8e8e8)); box(0.08, 0.025, 0.125, 0.26, 1.34, 0.06, M(0xd02a2a));
        break;
      }
      case "commander": { // comandante: penacho, estandarte y banda roja
        box(0.04, 0.22, 0.12, 0, 2.38, 0, glow(0xffb040));
        cyl(0.012, 0.012, 1.0, 0.12, 2.2, -0.3, M(0x30343a), 6);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({ color: 0xc8402e, side: THREE.DoubleSide, emissive: 0x401008 })); flag.position.set(0.3, 2.55, -0.3); B.add(flag);
        box(0.08, 0.6, 0.02, 0, 1.6, 0.215, M(0xc8402e), 0, 0.6);
        break;
      }
      case "gunner": { // artillero: cinta de munición cruzada
        box(0.07, 0.62, 0.025, 0, 1.64, 0.215, M(0xb08a3a, 0x201000, 0.5), 0, -0.65);
        break;
      }
      case "sniper": { // francotirador: capa de camuflaje y antena larga
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.8), new THREE.MeshStandardMaterial({ color: 0x3a4a2a, side: THREE.DoubleSide, roughness: 1 })); cape.position.set(0, 1.62, -0.33); cape.rotation.x = 0.2; B.add(cape);
        cyl(0.006, 0.006, 0.7, -0.12, 2.15, -0.3, M(0x202020), 5);
        break;
      }
      case "glitch": { // fallo de código: fragmentos luminosos alrededor
        const g = glow(0x3fd0ff);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const o = box(0.06, 0.06, 0.06, Math.cos(a) * 0.45, 1.3 + (i % 3) * 0.35, Math.sin(a) * 0.45, g); this.orbsK.push(o); }
        break;
      }
      case "boss": case "warden": { // jefes: corona de pinchos
        const g = glow(0xff4a3a);
        for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const o = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 6), g); o.position.set(Math.sin(a) * 0.14, 2.32, Math.cos(a) * 0.15); B.add(o); }
        break;
      }
    }
  }
  /** Esferas y fragmentos que orbitan (lanzador y fallo de código). */ private orbsK: THREE.Object3D[] = [];
  /** Animación de los robots: rotores, pasos de la araña, bola que rueda, torreta que apunta, luz que parpadea. */
  private animRobot(dt: number, moving: number, toTarget: number) {
    for (const r of this.rotors) r.rotation.y += dt * 40;
    if (this.kind.fly && this.alive && this.liftT <= 0) this.group.position.y = this.kind.fly + Math.sin(this.walkT * 0.7) * 0.18;
    // Patas en trípode alterno: cada pata avanza levantada y apoya hacia atrás; el cuerpo se balancea un poco
    for (const l of this.spiderLegs) { const p = this.walkT * 2.6 + l.ph; l.g.rotation.y = l.g.userData.y0 + Math.sin(p) * 0.4 * moving; l.g.rotation.z = Math.max(0, Math.cos(p)) * 0.25 * moving * l.side; }
    if (this.spiderLegs.length) this.body.position.y += Math.abs(Math.sin(this.walkT * 2.6)) * 0.03 * moving;
    if (this.rollBall) this.rollBall.rotation.x += dt * moving * 9;
    if (this.blink) { const rate = this.kind.shape === "roller" ? 2 + 14 * Math.max(0, 1 - toTarget / 14) : 1.5; this.blink.emissiveIntensity = this.alive ? 0.8 + 1.4 * (0.5 + 0.5 * Math.sin(this.walkT * rate)) : 0; }
  }

  /** Aplica daño a las capas, de fuera adentro (hoy, solo vida). Devuelve el daño infligido. */
  damage(amount: number, element: Element, crit: boolean, at: THREE.Vector3): number {
    if (!this.alive) return 0;
    if (this.phaseT > 0) return 0; // (fallo de código saltando: las balas lo atraviesan)
    this.flash = 0.08;
    // Barra visible tras el daño: jefe 12 s; élites, resistentes y grandes 9 s; el resto 5 s (luego se desvanece)
    this.engagedT = this.kind.boss ? 12 : /^(elite|sturdy|large)$/.test(this.kind.key) ? 9 : 5;
    let left = amount * (this.vulnT > 0 ? this.vuln : 1), dealt = 0; this.lagHold = 0.4;
    for (const layer of this.layers) { if (left <= 0) break; const d = Math.min(layer.value, left); layer.value -= d; left -= d; dealt += d; }
    const color = element ? ELEMENT_COLOR[element] : crit ? "#ffd84a" : "#ffffff";
    this.onDamage(this, dealt, color, crit, at);
    if (this.health <= 0) this.die();
    return dealt;
  }

  /** Estados: el fuego quema unos segundos (se renueva, no se apila); la descarga aturde un instante. */
  applyStatus(el: Element, hitDamage: number) {
    if (el === "fuego") { this.burnT = 3; this.burnDps = Math.min(BURN_DPS_CAP, Math.max(this.burnDps, hitDamage * 0.25)); }
    if (el === "electrico") this.stunT = Math.max(this.stunT, 0.3);
  }

  private die() { for (const m of this.marks) m.removeFromParent(); this.marks = []; this.alive = false; this.deadT = 0; this.burnT = 0; this.stunT = 0; this.holdT = 0; this.vulnT = 0; this.liftT = 0; }

  update(dt: number, camera: THREE.Camera, viewW: number, viewH: number) {
    this.stunT = Math.max(0, this.stunT - dt); this.holdT = Math.max(0, this.holdT - dt); this.vulnT = Math.max(0, this.vulnT - dt);
    if (this.liftT > 0 && this.alive) { this.liftT -= dt; const y = this.group.position.y; this.group.position.y = y + (this.liftH - y) * Math.min(1, dt * 3); this.group.rotation.z = Math.sin(this.liftT * 2) * 0.25; }
    else if (this.group.position.y > 0 && !(this.kind.fly && this.alive)) { this.group.position.y = Math.max(0, this.group.position.y - dt * (this.kind.fly ? 6 : 16)); if (this.group.position.y === 0) this.group.rotation.z = 0; }
    const held = this.stunT > 0 || this.holdT > 0 || this.liftT > 0 || (this.group.position.y > 0.05 && !this.kind.fly);
    let moving = 0, toTarget = 99;
    if (this.chase && this.alive && !held) {
      // Avanza hacia el jugador por el suelo; al llegar, golpea cada cierto tiempo
      const c = this.chase, to = c.target().clone().setY(0).sub(this.group.position.clone().setY(0));
      const d = to.length(); c.cd = Math.max(0, c.cd - dt);
      toTarget = d;
      // Araña: se abalanza cuando está cerca (salto rápido)
      this.pounceCd -= dt; if (this.kind.shape === "spider" && d < 7 && d > c.range && this.pounceCd <= 0) { this.pounceT = 0.35; this.pounceCd = 3 + Math.random() * 2; }
      this.pounceT = Math.max(0, this.pounceT - dt);
      // Sabueso: de lejos corre abierto hacia un flanco; cerca se agacha (aviso: ojos encendidos) y salta
      let goal = to, leapK = 1;
      if (this.kind.shape === "hound") {
        const p = this.group.position, tg = c.target(), f = flankPoint({ x: p.x, z: p.z }, { x: tg.x, z: tg.z }, this.flankSide);
        goal = new THREE.Vector3(f.x - p.x, 0, f.z - p.z);
        if (this.leapClock < 0 && d < 7.5 && d > c.range + 1.5 && this.pounceCd <= 0) { this.leapClock = 0; this.pounceCd = 3.2 + Math.random() * 1.6; }
        if (this.leapClock >= 0) { this.leapClock += dt; const ps = pounceState(this.leapClock); leapK = ps.phase === "crouch" ? 0.1 : ps.phase === "leap" ? 4.2 : 1; if (ps.phase === "none") this.leapClock = -1; }
      }
      const sp = c.speed * (this.pounceT > 0 ? 4 : 1) * leapK * (this.buffT > 0 ? 1.25 : 1) * (this.slowT > 0 ? this.slowF : 1);
      if (d > c.range) { this.group.position.addScaledVector(goal.clone().normalize(), Math.min(d - c.range, sp * dt)); moving = this.leapClock >= 0 && leapK < 1 ? 0.2 : 1; }
      else {
        // A distancia (dron): se mueve de lado mientras dispara, para no ser un blanco fijo
        if (this.kind.shape === "drone" || this.kind.gun === "rifle") { const side = new THREE.Vector3(to.z, 0, -to.x).normalize(); this.group.position.addScaledVector(side, Math.sin(this.walkT * 0.6) * c.speed * 0.6 * dt); moving = 0.5; }
        // (el centinela solo dispara cuando ya mira al jugador: gira despacio y se le puede rodear)
        const aimed = this.kind.shape !== "sentinel" || Math.abs(Math.atan2(Math.sin(Math.atan2(to.x, to.z) - this.group.rotation.y), Math.cos(Math.atan2(to.x, to.z) - this.group.rotation.y))) < 0.3;
        if (c.cd <= 0 && aimed) { c.cd = c.interval; c.onAttack(c.damage * (this.buffT > 0 ? 1.3 : 1)); this.flash = 0.1; this.attackT = 0.4; }
      }
      if (this.kind.shape === "sentinel") this.charge = d <= c.range ? chargeLevel(c.cd, 0.75) : 0;
      if (this.turretHead) this.turretHead.rotation.y = Math.atan2(to.x, to.z) - this.group.rotation.y;
      else if (this.kind.shape === "sentinel") this.group.rotation.y = turnToward(this.group.rotation.y, Math.atan2(to.x, to.z), dt * 0.9);
      else this.group.rotation.y = Math.atan2(goal.x, goal.z);
      // Andar: las piernas se balancean (más rápido cuanto más rápido avanza)
      if (this.legs.length && d > c.range) {
        // Paso: la cadera adelanta y atrasa la pierna; la rodilla se dobla mientras la pierna va hacia delante (el pie
        // no arrastra) y el cuerpo sube y baja dos veces por ciclo
        // (zancada corta y cadencia ligada a la velocidad: los pies no resbalan; la cadera baja lo justo para que
        // los pies sigan en el suelo con las piernas abiertas, en vez de quedarse flotando)
        const A = 0.36, sc = this.kind.scale ?? 1;
        this.walkT += dt * c.speed * 3.4 / sc;
        let drop = 0;
        this.legs.forEach((l, i) => { const ph = this.walkT + i * Math.PI, a = Math.sin(ph) * A; l.rotation.x = a; drop = Math.max(drop, 1.27 * (1 - Math.cos(a))); if (this.knees[i]) this.knees[i].rotation.x = 0.05 + Math.max(0, Math.cos(ph)) * Math.max(0, Math.sin(ph + 0.6)) * 0.75; });
        this.bobY = -drop * 0.85;
      } else if (!this.ragdolled) { this.legs.forEach((l) => (l.rotation.x *= 0.85)); this.knees.forEach((k) => (k.rotation.x *= 0.85)); this.bobY *= 0.85; }
    }
    if (this.kind.shape && this.kind.shape !== "humanoid") { this.walkT += dt * (1 + moving * 4); this.animRobot(dt, moving, toTarget); }
    this.buffT = Math.max(0, this.buffT - dt); this.slowT = Math.max(0, this.slowT - dt);
    this.animStyle(dt, moving);
    if (this.model && this.alive) this.animModel(dt, moving);
    // Fallo de código: parpadea y cada pocos segundos salta a otro sitio cerca del jugador (intocable durante el salto)
    if (this.kind.glitch && this.alive) {
      this.glitchT -= dt; this.phaseT = Math.max(0, this.phaseT - dt);
      if (this.glitchT <= 0 && this.chase && !held) {
        this.glitchT = 2.2 + Math.random() * 1.6; this.phaseT = 0.35;
        const to = this.chase.target().clone().setY(0).sub(this.group.position.clone().setY(0)), side = new THREE.Vector3(to.z, 0, -to.x).normalize();
        this.group.position.addScaledVector(to.normalize(), Math.min(6, to.length() * 0.4)).addScaledVector(side, (Math.random() - 0.5) * 8);
      }
      this.body.visible = this.phaseT <= 0 && !(Math.random() < 0.06);
      for (const m of this.mats) if (!this.glowSkip.has(m)) m.emissive.setRGB(0.1, 0.6 + Math.random() * 0.4, 0.7).multiplyScalar(Math.random() < 0.15 ? 1.6 : 0.4);
    }
    if (this.path && this.alive && !held) {
      this.path.t += dt * this.path.speed / this.path.a.distanceTo(this.path.b);
      const k = 0.5 - 0.5 * Math.cos(this.path.t * Math.PI);
      this.group.position.lerpVectors(this.path.a, this.path.b, k);
    }
    if (this.alive && this.burnT > 0) {
      this.burnT -= dt; this.burnTick += dt;
      if (this.burnTick >= 0.5) { this.burnTick = 0; this.damage(this.burnDps * 0.5, "fuego", false, this.center); }
      if (this.burnT <= 0) this.burnDps = 0;
    }
    // Brasas (quemado) y chispas (aturdido): partículas pixeladas que suben y se apagan
    this.emitT -= dt;
    if (this.alive && (this.burnT > 0 || this.stunT > 0) && this.emitT <= 0) {
      this.emitT = 0.05;
      const fire = this.burnT > 0;
      const m = new THREE.Mesh(BIT_GEO, new THREE.MeshBasicMaterial({ color: fire ? (Math.random() < 0.5 ? 0xff8a2a : 0xffc04a) : 0x9fe0ff, transparent: true }));
      const sc = this.kind.scale ?? 1;
      m.position.set((Math.random() - 0.5) * 0.45 * sc, (0.7 + Math.random() * 1.3) * sc, (Math.random() - 0.5) * 0.3 * sc);
      this.group.add(m); this.fxBits.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 0.4, fire ? 0.9 + Math.random() * 0.6 : (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 0.4), t: fire ? 0.7 : 0.18 });
    }
    for (let i = this.fxBits.length - 1; i >= 0; i--) {
      const b = this.fxBits[i]; b.t -= dt; b.m.position.addScaledVector(b.v, dt); (b.m.material as THREE.MeshBasicMaterial).opacity = Math.min(1, b.t * 3);
      if (b.spin) { b.m.rotation.x += b.spin.x * dt; b.m.rotation.y += b.spin.y * dt; b.m.rotation.z += b.spin.z * dt; if (b.m.position.y <= 0.03) b.spin.multiplyScalar(0.9); }
      if (b.g) { b.v.y -= 9.8 * dt; if (b.m.position.y < 0.02) { b.m.position.y = 0.02; b.v.y *= -0.3; b.v.x *= 0.6; b.v.z *= 0.6; } }
      if (b.t <= 0) { this.group.remove(b.m); this.fxBits.splice(i, 1); }
    }
    // Empuje: muelle amortiguado que devuelve el cuerpo a su sitio
    this.pushOff.addScaledVector(this.pushV, dt); this.pushV.multiplyScalar(Math.max(0, 1 - dt * 6)); this.pushOff.multiplyScalar(Math.max(0, 1 - dt * 3));
    this.flash = Math.max(0, this.flash - dt);
    // Reacción a los impactos: muelles de inclinación y cabeza, flexión de pierna, empuje y caída al morir
    this.flinchV.addScaledVector(this.flinch, -110 * dt); this.flinchV.multiplyScalar(Math.max(0, 1 - 14 * dt)); this.flinch.addScaledVector(this.flinchV, dt);
    this.flinch.clampScalar(-0.45, 0.45);
    this.headKickV += -140 * this.headKick * dt; this.headKickV *= Math.max(0, 1 - 16 * dt); this.headKick = Math.min(0.12, this.headKick + this.headKickV * dt);
    if (!this.ragdolled) for (const h of this.heads) h.m.position.z = h.z - this.headKick;
    this.limpT = Math.max(0, this.limpT - dt); const limp = Math.sin(Math.min(1, this.limpT / 0.45) * Math.PI);
    // Muerte: cae hacia donde le dispararon (rodillas que ceden, golpe contra el suelo con un pequeño rebote)
    if (!this.alive && this.deathTilt === 0 && !this.kind.shape) this.deathTilt = 0.01; // (muertes sin disparo: fuego, súper…)
    if (!this.alive && this.deathTilt > 0 && !this.ragdolled) {
      const k = Math.min(1, this.deadT / 0.62), fall = k < 0.85 ? Math.pow(k / 0.85, 1.8) : 1 - Math.sin((k - 0.85) / 0.15 * Math.PI) * 0.06;
      this.deathTilt = 0.01 + fall * (this.kind.shape ? 0.5 : 1.42);
      this.deathOff.addScaledVector(this.deathV, dt); this.deathV.multiplyScalar(Math.max(0, 1 - 4 * dt));
      this.legs.forEach((l) => (l.rotation.x = -Math.min(0.9, k * 1.6) * 0.6));
    }
    const dt2 = this.deathTilt > 0.02 ? this.deathTilt : 0;
    if (!this.ragdolled) { this.body.rotation.x = this.flinch.x + dt2 * this.deathDir.y + (this.alive ? this.pose.lean : 0); this.body.rotation.z = this.flinch.y + limp * 0.08 * this.limpSide - dt2 * this.deathDir.x + (this.alive ? this.pose.roll : 0); }
    this.hitGlow = Math.max(0, this.hitGlow - dt * 9);
    for (let i = 0; i < this.mats.length; i++) { const m = this.mats[i]; if (this.glowSkip.has(m)) continue; m.emissive.copy(this.baseEm[i]).lerp(this.glowColor, this.hitGlow * 0.55); }
    if (!this.ragdolled) this.body.position.set((this.stunT > 0 ? (Math.random() - 0.5) * 0.03 : 0) + this.pushOff.x + this.deathOff.x, -limp * 0.06 - (this.alive ? this.pose.dip : 0) + this.bobY, this.pushOff.z + this.deathOff.z);
    // Escaneo: al morir se desintegra de arriba abajo; al reaparecer se compila de abajo arriba
    const wy = this.group.getWorldPosition(new THREE.Vector3()).y;
    const sm = this.scan.material as THREE.MeshBasicMaterial;
    if (!this.alive) {
      this.deadT += dt;
      let h = this.top;
      // (primero cae; luego se desintegra de arriba abajo)
      // (con ragdoll, el cuerpo cae con física y se funde más tarde, a los 4–5 s)
      const late = this.ragdolled ? 3.4 : 0;
      if (this.deadT < 0.85 + late) h = this.top + 1;
      else if (this.deadT < 1.55 + late) h = this.top * (1 - (this.deadT - 0.85 - late) / 0.7);
      else if (this.deadT < 4.0) h = 0;
      else if (this.deadT < 4.8) h = this.top * ((this.deadT - 4.0) / 0.8);
      else if (!this.respawn) { this.gone = true; h = 0; }
      else { this.alive = true; this.ragdolled = false; for (const l of this.layers) l.value = l.max; for (const m of this.severed) m.visible = true; this.severed = []; this.deathTilt = 0; this.deathV.set(0, 0, 0); this.deathOff.set(0, 0, 0); }
      this.clip.constant = wy + h;
      this.scan.position.y = h; sm.opacity = h > 0.02 && h < this.top - 0.02 ? 0.9 : 0;
    } else { this.clip.constant = wy + this.top + 1; sm.opacity = 0; }
    const b = this.bar;
    const hp = this.layers[this.layers.length - 1];
    const hpW = Math.max(0, (hp.value / hp.max) * 100);
    b.querySelector<HTMLElement>(".hp")!.style.width = `${hpW}%`;
    // Daño reciente: se queda en blanco ~0,4 s y luego baja hasta la vida actual
    if (hpW > this.lagW || !this.alive && this.deadT > 1) this.lagW = hpW;
    if (this.lagHold > 0) this.lagHold -= dt; else this.lagW += (hpW - this.lagW) * Math.min(1, dt * 6);
    b.querySelector<HTMLElement>(".lag")!.style.width = `${Math.max(hpW, this.lagW)}%`;
    b.classList.toggle("status-fire", this.burnT > 0); b.classList.toggle("status-shock", this.stunT > 0); b.classList.toggle("status-frozen", this.holdT > 0);
    if (this.kind.boss) {
      // Barra del jefe arriba, solo durante el combate con él (se oculta 12 s después del último golpe)
      this.engagedT = Math.max(0, this.engagedT - dt);
      b.style.display = this.engagedT > 0 || this.alwaysBar || (!this.alive && this.deadT < 2) ? "" : "none"; b.style.opacity = this.alive ? "1" : "0.4"; return;
    }
    const top = this.group.localToWorld(new THREE.Vector3(0, (this.kind.top ?? 2.45) * (this.kind.scale ?? 1), 0));
    const dist = top.distanceTo(camera.position);
    top.project(camera);
    // La sala de oleadas está detrás de la pared del fondo: solo se ven las barras de la sala en la que está el jugador
    const sameRoom = (camera.position.z > WAVES_ROOM_Z) === (this.group.position.z > WAVES_ROOM_Z);
    // Como en Borderlands o Destiny: la barra solo se ve al mirar al enemigo o tras dañarlo, y se desvanece al acabar
    this.engagedT = Math.max(0, this.engagedT - dt);
    const aim = this.alive && sameRoom && dist < 70 && Math.hypot(top.x * viewW / viewH, top.y) < 0.05 && top.z < 1; // cerca del centro de la mira
    if (aim) this.engagedT = Math.max(this.engagedT, 1.5);
    const visible = top.z < 1 && dist < 70 && this.alive && sameRoom && this.engagedT > 0;
    b.style.opacity = String(Math.min(1, this.engagedT / 0.8));
    b.style.display = visible ? "" : "none";
    if (visible) b.style.transform = `translate(${(top.x * 0.5 + 0.5) * viewW}px, ${(-top.y * 0.5 + 0.5) * viewH}px) translate(-50%, -100%) scale(${THREE.MathUtils.clamp(14 / dist, 0.55, 1)})`;
  }
}

/** Números de daño flotantes. */
export class DamageNumbers {
  private items: { el: HTMLDivElement; pos: THREE.Vector3; t: number; vx: number; key?: object; crit: boolean; sum: number; color: string }[] = [];
  constructor(private overlay: HTMLElement) {}
  /** Número de daño. Los impactos seguidos al mismo enemigo (mismo tipo, crítico o no) se suman en un solo número que sube. */
  spawn(amount: number, color: string, crit: boolean, at: THREE.Vector3, key?: object) {
    if (amount < 0.5) return;
    const prev = key ? this.items.find((x) => x.key === key && x.crit === crit && x.t < 0.45 && x.color === color) : null;
    if (prev) { prev.sum += amount; prev.el.textContent = String(Math.round(prev.sum)); prev.t = Math.min(prev.t, 0.12); prev.el.classList.remove("bump"); void prev.el.offsetWidth; prev.el.classList.add("bump"); return; }
    const el = document.createElement("div");
    el.className = "dmg" + (crit ? " crit" : "");
    el.textContent = String(Math.round(amount));
    el.style.color = color;
    this.overlay.appendChild(el);
    this.items.push({ el, pos: at.clone(), t: 0, vx: (Math.random() - 0.5) * 0.6, key, crit, sum: amount, color });
    if (this.items.length > 60) this.items.shift()!.el.remove();
  }
  update(dt: number, camera: THREE.Camera, w: number, h: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.t += dt;
      it.pos.y += dt * 0.9; it.pos.x += it.vx * dt;
      const p = it.pos.clone().project(camera);
      it.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * w}px, ${(-p.y * 0.5 + 0.5) * h}px) translate(-50%, -50%) scale(${it.t < 0.1 ? 1 + (0.1 - it.t) * 6 : 1})`;
      it.el.style.opacity = String(Math.max(0, 1 - Math.max(0, it.t - 0.6) / 0.4));
      it.el.style.display = p.z < 1 ? "" : "none";
      if (it.t > 1) { it.el.remove(); this.items.splice(i, 1); }
    }
  }
}

/** Coloca los muñecos del campo de tiro. */
export function spawnDummies(scene: THREE.Scene, lanes: number[], overlay: HTMLElement, onDamage: ConstructorParameters<typeof Dummy>[4], pt: (x: number, z: number) => THREE.Vector3 = (x, z) => new THREE.Vector3(x, 0, z)): Dummy[] {
  const list: Dummy[] = [];
  const at = (kind: keyof typeof KINDS, p: THREE.Vector3) => { const d = new Dummy(KINDS[kind], `${kind}-${list.length}`, p, overlay, onDamage); scene.add(d.group); list.push(d); return d; };
  // (los del campo de tiro: coordenadas locales del campo, línea de tiro en z = 0; `pt` los lleva a su sala y miran a la línea)
  const face = pt(0, 0).sub(pt(0, -1)), yaw = Math.atan2(face.x, face.z);
  const add = (kind: keyof typeof KINDS, x: number, z: number) => { const d = at(kind, pt(x, z)); d.group.rotation.y = yaw; return d; };
  // Tamaños distintos (pequeño, normal, grande), todos solo con vida
  add("small", lanes[0], -10); add("basic", lanes[1], -15); add("sturdy", lanes[2], -25);
  add("basic", lanes[3], -25); add("large", lanes[4], -35); add("small", lanes[5], -50);
  add("large", lanes[0], -40); add("basic", lanes[5], -18); add("small", lanes[2], -12);
  add("basic", 0, -20).setPath(pt(-14, -20), pt(14, -20), 3);
  add("elite", 0, -42).setPath(pt(12, -42), pt(-12, -42), 2.2);
  add("boss", 0, -64);
  // Zona de entrenamiento (puños y pruebas): tres muñecos en el pasillo lateral del campo de tiro, junto a la pared,
  // mirando hacia el círculo de pruebas (en coordenadas del campo: x = -21,5; el campo va girado, así que miran a -x)
  for (const z of [-6, -8.5, -11]) at(z === -8.5 ? "basic" : "small", pt(-21.5, z)).group.rotation.y = -Math.PI / 2;
  return list;
}
