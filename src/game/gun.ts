// Arma en mano: modos de disparo, habilidades, apuntado con mira y animaciones procedurales
// (inercia, balanceo, sprint táctico, salto, retroceso, recarga con cargador, corredera/cerrojo, inspección).
import * as THREE from "three";
import type { WeaponAssembler, AssembledWeapon, AssembledPart } from "../weapons/assembler";
import type { WeaponType } from "../weapons/types";
import { PELLETS, effectValue, hasEffect, elementOf } from "../weapons/generator";
import { accessory } from "../weapons/accessories";
import type { Item } from "./inventory";
import type { Dummy, Element, Zone } from "./dummies";
import { Arms } from "./arms";

const RELOAD: Partial<Record<WeaponType, number>> = { pistol: 1.4, revolver: 2.3, smg: 1.8, rifle: 2.2, bullpup: 2.4, shotgun: 2.6, sniper: 2.9, launcher: 3.2, lmg: 4.4, flamethrower: 2.8 };

export interface ShotHooks {
  onHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, crit: boolean): number;
  onKill?(d: Dummy): void;
  dummies(): Dummy[];
}
export interface Control { fire: boolean; aim: boolean; moving: number; sprinting: boolean; lookX: number; lookY: number; vy: number; grounded: boolean; inspect: boolean }

/**
 * Recarga como máquina de fases con nombre. Duraciones en fracción del tiempo total de recarga, que ya se escala con
 * el manejo y los efectos. Retocar una recarga es cambiar estos datos, no el código.
 */
export const RELOAD_PHASES: [string, number][] = [["tilt", 0.14], ["grab", 0.12], ["out", 0.14], ["pouch", 0.16], ["in", 0.2], ["rack", 0.14], ["settle", 0.1]];
interface PhaseState { id: string; t: number }
export function phaseAt(phases: [string, number][], p: number): PhaseState {
  let acc = 0;
  for (const [id, d] of phases) { if (p <= acc + d) return { id, t: THREE.MathUtils.clamp((p - acc) / d, 0, 1) }; acc += d; }
  return { id: phases[phases.length - 1][0], t: 1 };
}

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
const ease = (x: number) => x * x * (3 - 2 * x);
const tri = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * Math.PI));

export class Gun {
  readonly viewmodel = new THREE.Group();
  private sway = new THREE.Group();   // inercia y balanceo
  private holder = new THREE.Group(); // pose (cadera/mira/sprint) y animaciones
  private model: AssembledWeapon | null = null;
  private mag: AssembledPart | null = null;
  private cache = new Map<number, Promise<AssembledWeapon>>();
  item: Item | null = null;
  env: THREE.Texture | null = null;
  private cooldown = 0;
  reloadT = 0; private reloadDur = 1;
  private triggerHeld = false;
  private equipT = 0; private equipDur = 0.45;
  recoil = 0; recoilYaw = 0;
  private kick = 0; private kickRoll = 0;
  aimT = 0;
  private shotCount = 0;
  private burstLeft = 0; private burstTimer = 0;
  private cycleT = 0;
  private inspectT = 0;
  private sprintBlend = 0;
  private swayV = new THREE.Vector2(); private landT = 0; private wasGrounded = true; private bobT = 0;
  private frenzyT = 0;
  private reloadAfterKill = false;
  private killT = 0; private killclipT = 0; private rampage = 0; private rampageT = 0; private deadhand = false;
  private marks = new Map<Dummy, number>();
  private sightY = 0.03;
  zoom = 1;
  /** Tipo de mira para apuntar: alzas, punto rojo, holográfica o visor de aumento (vista a pantalla completa). */
  sight: "iron" | "dot" | "holo" | "scope" = "iron";
  private flashLight = new THREE.PointLight(0xffc27a, 0, 6, 2);
  private flash: THREE.Mesh;
  private tracers: { line: THREE.Line; t: number; max: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private bursts: { mesh: THREE.Mesh; t: number }[] = [];
  private ray = new THREE.Raycaster();
  private audio: AudioContext | null = null;
  private pendingEcho = -1;
  hitmarker = 0; critmarker = 0; killmarker = 0;
  private arms: Arms;
  private reloadPhase: PhaseState | null = null;
  private sprayIndex = 0; private sprayT = 0;
  private casings: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: THREE.Vector3; t: number }[] = [];

  constructor(private camera: THREE.PerspectiveCamera, private scene: THREE.Scene, private asm: WeaponAssembler, private world: THREE.Object3D[], private hooks: ShotHooks) {
    camera.add(this.viewmodel);
    this.viewmodel.add(this.sway); this.sway.add(this.holder);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
    this.holder.add(this.flash, this.flashLight);
    this.arms = new Arms(camera);
  }

  get spec() { return this.item?.spec ?? null; }
  get reloading() { return this.reloadT > 0; }
  /** Dispersión actual en grados (la usa también la retícula). */
  spread(moving: number) {
    const s = this.spec; if (!s) return 1;
    const focus = 1 - (effectValue(s, "adsfocus") / 100) * this.aimT;
    if (s.type === "shotgun") return 3.4 * (1 - this.aimT * 0.25) * focus;
    return ((100 - s.stats.precision) * 0.055 + 0.08) * (1 - this.aimT * 0.75) * (1 + moving * 0.6) * focus;
  }

  forget(uid: number) { this.cache.delete(uid); }
  modelFor(item: Item, rebuild = false): Promise<AssembledWeapon> {
    if (rebuild || !this.cache.has(item.uid)) this.cache.set(item.uid, this.asm.assemble(item.spec));
    return this.cache.get(item.uid)!;
  }

  async equip(item: Item | null, rebuild = false) {
    this.item = item; this.reloadT = 0; this.burstLeft = 0; this.inspectT = 0;
    this.equipDur = item && hasEffect(item.spec, "quickdraw") ? 0.22 : 0.3 + (1 - (item?.spec.stats.manejo ?? 60) / 100) * 0.35;
    this.equipT = this.equipDur;
    if (this.model) { this.holder.remove(this.model.group); this.model = null; this.mag = null; }
    if (!item) return;
    // Tipo de mira y aumentos (solo dependen del arma: se fijan ya, antes de cargar el modelo)
    const opt = accessory(item.spec.optic);
    if (opt) { this.sight = opt.id === "acc:reddot" ? "dot" : opt.id === "acc:holo" ? "holo" : "scope"; this.zoom = opt.zoom ?? 1; }
    else if (item.spec.optic) { this.sight = "scope"; this.zoom = 3; }                 // mira de modelo (cosmo)
    else if (item.spec.type === "sniper") { this.sight = "scope"; this.zoom = 4.5; }  // francotirador con visor integrado
    else { this.sight = "iron"; this.zoom = 1; }
    const m = await this.modelFor(item, rebuild);
    if (this.item !== item) return;
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.renderOrder = 10;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) if (this.env && "envMap" in mat) { mat.envMap = this.env; mat.needsUpdate = true; }
    });
    m.group.rotation.y = Math.PI / 2; // +X (boca) hacia -Z de la cámara
    this.sightY = m.sightY ?? new THREE.Box3().setFromObject(m.group).max.y;
    this.mag = m.parts.find((p) => p.role === "magazine") ?? null;
    this.model = m;
    this.holder.add(m.group);
    this.flash.position.set(0, m.muzzle.y, -m.muzzle.x);
    this.flashLight.position.copy(this.flash.position);
  }

  private sfx(kind: "shot" | "reload" | "hit" | "crit" | "kill" | "empty" | "cycle" | "boom" | "sig", type?: WeaponType, quiet = false) {
    try {
      this.audio ??= new AudioContext();
      const a = this.audio, t = a.currentTime, g = a.createGain(); g.connect(a.destination);
      if (kind === "shot" && type) { this.layeredShot(a, type, quiet); return; }
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
  private noise(a: AudioContext, len: number, decay: number, filter: BiquadFilterType, freq: number, gain: number, when: number, rate = 1, out: AudioNode = a.destination) {
    const buf = a.createBuffer(1, Math.max(1, Math.floor(a.sampleRate * len)), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, decay);
    const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
    const f = a.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(out); src.start(when);
  }
  /**
   * Disparo por capas: ataque (chasquido), cuerpo (explosión filtrada por tipo), cola (eco, más larga bajo la
   * marquesina) y mecánica (cerrojo). Tono con variación aleatoria; el supresor apaga ataque y cuerpo.
   */
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
    const out = a.createGain(); out.gain.value = quiet ? 0.25 : 0.5; delay.connect(out); out.connect(a.destination);
    this.noise(a, len * (indoor ? 1.6 : 2.4), 2, "lowpass", indoor ? 900 : 600, gain * 0.35, t + 0.01, pitch, delay);
    setTimeout(() => { delay.disconnect(); fb.disconnect(); }, 2000);
    this.noise(a, 0.03, 2, "bandpass", 3200, 0.06, t + 0.035, pitch * 1.3);                // mecánica
  }

  startReload() {
    const s = this.spec; if (!s || !this.item || this.reloadT > 0 || this.item.ammo >= s.stats.cargador || this.equipT > 0) return;
    let time = (RELOAD[s.type] ?? 2) * (1.35 - s.stats.manejo / 200);
    if (this.killT > 0 && hasEffect(s, "killreload")) time *= 1 - effectValue(s, "killreload") / 100;
    this.reloadAfterKill = this.killT > 0;
    this.reloadT = this.reloadDur = time; this.burstLeft = 0; this.inspectT = 0;
    this.sfx("reload");
  }

  update(dt: number, c: Control) {
    const s = this.spec, it = this.item;
    this.cooldown -= dt; this.equipT = Math.max(0, this.equipT - dt); this.cycleT = Math.max(0, this.cycleT - dt); this.frenzyT = Math.max(0, this.frenzyT - dt);
    this.hitmarker = Math.max(0, this.hitmarker - dt); this.critmarker = Math.max(0, this.critmarker - dt); this.killmarker = Math.max(0, this.killmarker - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && it && s) { it.ammo = s.stats.cargador; this.sfx("cycle"); if (this.reloadAfterKill && hasEffect(s, "killclip")) this.killclipT = 4; } }
    this.killT = Math.max(0, this.killT - dt); this.killclipT = Math.max(0, this.killclipT - dt);
    this.rampageT = Math.max(0, this.rampageT - dt); if (this.rampageT <= 0) this.rampage = 0;
    if (c.inspect && s && this.reloadT <= 0 && this.aimT < 0.2) this.inspectT = 2.6;
    this.inspectT = Math.max(0, this.inspectT - dt);
    const busy = this.equipT > 0 || this.reloadT > 0 || c.sprinting;
    const canAim = !!s && !c.sprinting && this.reloadT <= 0;
    const adsSpeed = 6 + (s?.stats.manejo ?? 50) / 9 + (s && hasEffect(s, "quickdraw") ? 6 : 0);
    this.aimT += ((c.aim && canAim ? 1 : 0) - this.aimT) * Math.min(1, dt * adsSpeed);
    if (c.aim || c.fire) this.inspectT = 0;

    // Disparo según el modo
    if (s && it && !busy) {
      const mode = s.fireMode;
      const pressed = c.fire && !this.triggerHeld;
      if (this.burstLeft > 0) {
        this.burstTimer -= dt;
        if (this.burstTimer <= 0 && it.ammo > 0) { this.fire(c.moving); this.burstLeft--; this.burstTimer = 60 / (s.stats.cadencia * 1.6); if (!this.burstLeft) this.cooldown = 0.28; }
        if (it.ammo <= 0) this.burstLeft = 0;
      } else if (this.cooldown <= 0 && this.cycleT <= 0 && (mode === "auto" ? c.fire : pressed)) {
        if (it.ammo > 0) {
          if (mode === "burst") { this.burstLeft = (s.burst || 3) - 1; this.burstTimer = 60 / (s.stats.cadencia * 1.6); }
          this.fire(c.moving);
        } else if (pressed) { this.sfx("empty"); this.startReload(); }
      }
    }
    this.triggerHeld = c.fire;
    this.sprayT += dt; if (this.sprayT > 0.35) this.sprayIndex = 0;
    this.updateCasings(dt);
    if (this.pendingEcho >= 0) { this.pendingEcho -= dt; if (this.pendingEcho < 0) { this.pendingEcho = -1; this.fire(c.moving, true); } }

    // Recuperación del retroceso
    const handling = s?.stats.manejo ?? 50;
    this.recoil += (0 - this.recoil) * Math.min(1, dt * (5 + handling / 12));
    this.recoilYaw += (0 - this.recoilYaw) * Math.min(1, dt * 8);
    this.kick += (0 - this.kick) * Math.min(1, dt * 13); this.kickRoll += (0 - this.kickRoll) * Math.min(1, dt * 10);

    // ---------- Animación ----------
    const len = this.model?.length ?? 0.3;
    const handgun = s?.type === "pistol" || s?.type === "revolver";
    const ads = this.aimT;
    const hip = new THREE.Vector3(0.15, -0.155, -(len * 0.5 + (handgun ? 0.2 : 0.08)));
    const aim = new THREE.Vector3(0, -this.sightY, -(len * 0.5 + (handgun ? 0.24 : 0.07)));
    const pos = hip.lerp(aim, ease(ads));
    const rot = new THREE.Euler(0, 0, 0);
    // Sprint táctico (estilo MW): el arma se gira y baja; las pistolas se levantan
    this.sprintBlend = THREE.MathUtils.lerp(this.sprintBlend, c.sprinting && this.reloadT <= 0 ? 1 : 0, Math.min(1, dt * 9));
    const sk = this.sprintBlend;
    if (handgun) { pos.add(new THREE.Vector3(-0.05 * sk, 0.06 * sk, 0.05 * sk)); rot.x += 0.9 * sk; }
    else { pos.add(new THREE.Vector3(-0.07 * sk, -0.02 * sk, 0.06 * sk)); rot.y += 0.75 * sk; rot.z += 0.35 * sk; rot.x += 0.12 * sk; }
    // Balanceo al andar (en ocho), menor apuntando
    this.bobT += dt * (c.sprinting ? 13 : 8.5) * Math.min(1, c.moving);
    const bobAmp = (1 - ads * 0.85) * Math.min(1, c.moving) * (c.sprinting ? 1.8 : 1) * (c.grounded ? 1 : 0.2);
    pos.x += Math.sin(this.bobT) * 0.008 * bobAmp; pos.y += Math.abs(Math.cos(this.bobT)) * 0.007 * bobAmp;
    rot.z += Math.sin(this.bobT) * 0.012 * bobAmp;
    // Respiración en reposo
    const tNow = performance.now() / 1000;
    pos.y += Math.sin(tNow * 1.6) * 0.0016 * (1 - ads * 0.8); rot.x += Math.sin(tNow * 1.3) * 0.004 * (1 - ads * 0.8);
    // Salto y aterrizaje
    if (c.grounded && !this.wasGrounded) this.landT = 0.25;
    this.wasGrounded = c.grounded; this.landT = Math.max(0, this.landT - dt);
    pos.y += THREE.MathUtils.clamp(-c.vy * 0.004, -0.02, 0.02) - (this.landT > 0 ? tri(1 - this.landT / 0.25, 0, 1) * 0.025 : 0);
    // Retroceso visual: atrás, arriba y algo de giro
    pos.z += this.kick * (handgun ? 0.035 : 0.05) * (1 - ads * 0.4); pos.y += this.kick * 0.008;
    rot.x += this.kick * (handgun ? 0.2 : 0.07); rot.z += this.kickRoll;
    // Corredera / cerrojo tras disparar
    if (this.cycleT > 0) { const k = tri(1 - this.cycleT / 0.45, 0.1, 0.9); rot.z += 0.25 * k; rot.x += 0.12 * k; pos.y -= 0.02 * k; }
    // Recarga por fases con nombre (datos en RELOAD_PHASES). Las fases mueven el arma, el cargador y la mano izquierda.
    let reloadPhase: PhaseState | null = null;
    if (this.reloadT > 0 && s) {
      reloadPhase = phaseAt(RELOAD_PHASES, 1 - this.reloadT / this.reloadDur);
      const { id, t } = reloadPhase;
      const tilt = id === "tilt" ? ease(t) : id === "settle" ? 1 - ease(t) : 1;
      rot.z += 0.5 * tilt; rot.x += 0.22 * tilt; pos.y -= 0.045 * tilt; pos.x -= 0.025 * tilt;
      if (id === "rack") { const k = tri(t, 0, 1); pos.z += 0.035 * k; rot.x -= 0.12 * k; }
      if (this.mag) {
        const drop = id === "out" ? ease(t) : id === "pouch" ? 1 : id === "in" ? 1 - ease(t) : 0;
        this.mag.object.position.copy(this.mag.base).add(new THREE.Vector3(-0.01, -0.2 * drop, 0));
        this.mag.object.visible = id !== "pouch";
      }
    } else if (this.mag) { this.mag.object.position.copy(this.mag.base); this.mag.object.visible = true; }
    this.reloadPhase = reloadPhase;
    // Inspección: mostrar el lateral del arma
    if (this.inspectT > 0) { const k = tri(1 - this.inspectT / 2.6, 0, 1); rot.y += -1.1 * ease(Math.min(1, k * 1.4)); rot.z += 0.45 * k; pos.x -= 0.06 * k; pos.z += 0.05 * k; pos.y += 0.03 * k; }
    // Sacar el arma
    if (this.equipT > 0) { const k = this.equipT / this.equipDur; pos.y -= 0.3 * ease(k); rot.x -= 0.9 * ease(k); rot.z += 0.3 * k; }

    this.holder.position.lerp(pos, Math.min(1, dt * 22));
    this.holder.rotation.set(
      THREE.MathUtils.lerp(this.holder.rotation.x, rot.x, Math.min(1, dt * 18)),
      THREE.MathUtils.lerp(this.holder.rotation.y, rot.y, Math.min(1, dt * 14)),
      THREE.MathUtils.lerp(this.holder.rotation.z, rot.z, Math.min(1, dt * 16)));
    // Inercia al girar la cámara: el arma se queda un poco atrás
    const swayK = 1 - ads * 0.75;
    this.swayV.x += (THREE.MathUtils.clamp(c.lookX * 2.2, -0.08, 0.08) - this.swayV.x) * Math.min(1, dt * 10);
    this.swayV.y += (THREE.MathUtils.clamp(c.lookY * 2.2, -0.06, 0.06) - this.swayV.y) * Math.min(1, dt * 10);
    this.sway.rotation.set(-this.swayV.y * swayK, this.swayV.x * swayK, this.swayV.x * 1.4 * swayK);
    this.sway.position.set(-this.swayV.x * 0.15 * swayK, this.swayV.y * 0.1 * swayK, 0);
    // Con visor de aumento, al apuntar del todo se ve a través del visor (el arma se oculta)
    this.viewmodel.visible = !(this.sight === "scope" && this.aimT > 0.9);
    this.arms.visible = this.viewmodel.visible && !!this.model;
    if (this.model) this.updateHands();

    // Efectos
    const fm = this.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = Math.max(0, fm.opacity - dt * 22); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 120);
    this.flash.scale.setScalar(0.7 + Math.random() * 0.6);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.t -= dt; (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.t / tr.max);
      if (tr.t <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i]; b.t -= dt; b.mesh.scale.setScalar(1 + (0.35 - b.t) * 9); (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, b.t / 0.35);
      if (b.t <= 0) { this.scene.remove(b.mesh); this.bursts.splice(i, 1); }
    }
  }

  /** Casquillo expulsado por la ventana del cajón, con física simple. */
  private ejectCasing() {
    const s = this.spec!; const m = this.model; if (!m || s.type === "revolver") return;
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
  private updateHands() {
    const m = this.model!; const h = m.handles;
    this.viewmodel.updateMatrixWorld(true);
    const toCam = (p: THREE.Vector3) => this.camera.worldToLocal(m.group.localToWorld(p.clone()));
    const camQ = this.camera.getWorldQuaternion(new THREE.Quaternion()).invert();
    const orient = camQ.multiply(this.holder.getWorldQuaternion(new THREE.Quaternion())).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, 0, 0)));
    let left: THREE.Vector3 | null = h.support.clone();
    const ph = this.reloadPhase;
    if (ph) {
      const mag = this.mag ? this.mag.object.position.clone().sub(this.mag.base) : new THREE.Vector3();
      const atMag = h.magwell.clone().add(mag);
      if (ph.id === "grab") left = h.support.clone().lerp(atMag, ease(ph.t));
      else if (ph.id === "out") left = atMag;
      else if (ph.id === "pouch") left = ph.t < 0.5 ? atMag.add(new THREE.Vector3(0, -0.25 * ph.t, 0)) : null;
      else if (ph.id === "in") left = atMag;
      else if (ph.id === "rack") left = h.charge.clone().add(new THREE.Vector3(-0.05 * tri(ph.t, 0, 1), 0.01, 0.03));
      else if (ph.id === "settle") left = h.charge.clone().lerp(h.support, ease(ph.t));
    } else if (this.cycleT > 0 && this.spec?.fireMode === "pump") {
      left = h.support.clone().add(new THREE.Vector3(-0.07 * tri(1 - this.cycleT / 0.45, 0, 1), 0, 0));
    } else if (this.cycleT > 0 && this.spec?.fireMode === "bolt") {
      left = h.charge.clone().add(new THREE.Vector3(-0.04 * tri(1 - this.cycleT / 0.45, 0, 1), 0.02, 0.04));
    }
    this.arms.update({ right: toCam(h.grip), left: left ? toCam(left) : null, orient });
  }

  private fire(moving: number, echo = false) {
    const s = this.spec!, it = this.item!;
    const fullMag = it.ammo === s.stats.cargador;
    const lowAmmo = it.ammo <= Math.ceil(s.stats.cargador * 0.25);
    if (!echo) { it.ammo--; this.cooldown = 60 / (s.stats.cadencia * (this.frenzyT > 0 ? 1.5 : 1)); }
    this.shotCount++;
    if (s.fireMode === "pump" || s.fireMode === "bolt") { this.cycleT = 0.45; setTimeout(() => { this.sfx("cycle"); if (this.item === it) this.ejectCasing(); }, 220); }
    else if (!echo) this.ejectCasing();
    const quiet = !!accessory(s.muzzle)?.quiet;
    const sig = s.effects.find((e) => e.tier === "L")?.id ?? null;
    this.sfx("shot", s.type, quiet);
    if (sig) this.sfx("sig");
    (this.flash.material as THREE.MeshBasicMaterial).opacity = quiet ? 0.2 : 1; this.flashLight.intensity = quiet ? 0.6 : 4;
    const steady = 1 - effectValue(s, "steady") / 100;
    const kickPower = (s.type === "sniper" || s.type === "shotgun" ? 2.2 : s.type === "revolver" ? 2 : s.type === "pistol" ? 1.2 : 0.7) * (1.4 - s.stats.manejo / 100) * (1 - this.aimT * 0.35) * steady * (hasEffect(s, "doble") ? 1.4 : 1);
    // Patrón de retroceso propio del arma: subida dominante + deriva lateral determinista (con un poco de ruido)
    const pat = recoilPattern(s.statSeed), i = Math.min(this.sprayIndex++, pat.length - 1);
    const lateral = accessory(s.muzzle)?.id === "acc:compensator" || accessory(s.muzzle)?.id === "acc:brake" ? 0.55 : 1;
    this.recoil += 0.011 * kickPower * pat[i][0];
    this.recoilYaw += 0.006 * kickPower * (pat[i][1] * lateral + (Math.random() - 0.5) * 0.3);
    this.sprayT = 0;
    this.kick = Math.min(1, this.kick + 0.65); this.kickRoll += (Math.random() - 0.5) * 0.08 * kickPower;
    const element = elementOf(s) as Element;
    const pellets = (PELLETS[s.type] ?? 1) * (hasEffect(s, "doble") ? 2 : 1);
    const spreadDeg = this.spread(moving);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
    const q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const targets = [...this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes), ...this.world];
    // Multiplicadores de daño de efectos y firmas
    let dmgMult = 1;
    if (fullMag && hasEffect(s, "opening")) dmgMult *= 1 + effectValue(s, "opening") / 100;
    if (this.killclipT > 0) dmgMult *= 1.35;
    if (this.rampage > 0) dmgMult *= 1 + 0.1 * this.rampage;
    if (sig === "lastrounds" && lowAmmo) dmgMult *= 2;
    const forceCrit = sig === "deadhand" && this.deadhand;
    if (forceCrit) { dmgMult *= 3; this.deadhand = false; }
    const critMult = 2 * (1 + effectValue(s, "headhunter") / 100);
    const pierceN = hasEffect(s, "piercing") ? 3 : hasEffect(s, "pierce") ? 2 : 1;
    const tracerColor = sig ? "#ffb347" : element === "fuego" ? "#ff7a2a" : element === "electrico" ? "#8fd8ff" : s.rarity.id === "comun" ? "#e9dcc0" : s.rarity.color;
    let firstHit: THREE.Vector3 | null = null;
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
        if (!dummy) { this.decal(hit); if (element === "explosive") this.explode(hit.point, s.stats.dano * 0.4 * dmgMult, element); break; }
        if (seen.has(dummy)) continue; seen.add(dummy);
        const zone = hit.object.userData.zone as Zone;
        const falloff = hit.distance <= s.stats.alcance ? 1 : Math.max(0.45, 1 - (hit.distance - s.stats.alcance) / (s.stats.alcance * 2));
        const crit = forceCrit || zone === "head";
        const dmg = s.stats.dano * falloff * dmgMult * (crit ? critMult : zone === "limb" ? 0.8 : 1) * (pierced > 0 ? 0.5 : 1);
        this.applyHit(dummy, zone, hit.point, dmg, element, crit, p === 0);
        if (element === "explosive") this.explode(hit.point, dmg * 0.4, element, dummy);
        if (element === "electrico") this.chain(dummy, dmg * 0.4, 6);
        if (hasEffect(s, "rebote")) {
          const next = this.nearest(dummy, hit.point, 15);
          if (next) { this.tracer(hit.point, next.center, "#e8e1d3"); this.applyHit(next, "body", next.center, dmg * 0.5, element, false, false); }
        }
        if (sig === "widowmark") {
          const n = (this.marks.get(dummy) ?? 0) + 1;
          if (n >= 5) { this.marks.delete(dummy); this.explode(dummy.center, s.stats.dano * 1.5, null, undefined, 0xc040ff); } else this.marks.set(dummy, n);
        }
        if (sig === "verdict" && crit) this.explode(hit.point, dmg * 0.8, null, dummy, 0xffd060);
        if (++pierced >= pierceN) break;
      }
      if (p < 3) this.tracer(muzzle, end, tracerColor);
    }
    // Firma "requiem": cada 6.º disparo lanza 6 esquirlas a los enemigos cercanos al impacto
    if (sig === "requiem" && this.shotCount % 6 === 0 && firstHit) {
      const near = this.hooks.dummies().filter((d) => d.alive && d.center.distanceTo(firstHit!) < 20).slice(0, 6);
      for (const d of near) { this.tracer(firstHit, d.center, "#ffb347", 0.12); this.applyHit(d, "body", d.center, s.stats.dano * 0.4, null, false, false); }
    }
    if (!echo && hasEffect(s, "eco") && this.shotCount % 5 === 0) this.pendingEcho = 0.5;
    if (!echo && sig === "echochamber" && this.shotCount % 4 === 0) { this.pendingEcho = 0.25; setTimeout(() => { if (this.item === it) this.fire(moving, true); }, 500); }
  }

  private applyHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, crit: boolean, sound: boolean) {
    const alive = d.alive;
    this.hooks.onHit(d, zone, point, dmg, element, crit);
    if (crit) this.critmarker = 0.15; else this.hitmarker = 0.12;
    if (alive && !d.alive) {
      this.killmarker = 0.35; this.sfx("kill");
      this.hooks.onKill?.(d);
      const s = this.spec!, it = this.item!;
      const sig = s.effects.find((e) => e.tier === "L")?.id;
      this.killT = 3;
      if (hasEffect(s, "scavenger")) it.ammo = Math.min(s.stats.cargador, it.ammo + 1);
      if (hasEffect(s, "frenzy")) this.frenzyT = 5;
      if (hasEffect(s, "rampage")) { this.rampage = Math.min(3, this.rampage + 1); this.rampageT = 4; }
      if (sig === "olddog") it.ammo = s.stats.cargador;
      if (sig === "deadhand") this.deadhand = true;
      if (sig === "stormcaller") {
        const at = d.center;
        this.tracer(at.clone().add(new THREE.Vector3(0, 12, 0)), at, "#bfe8ff", 0.25);
        this.sfx("boom");
        for (const o of this.hooks.dummies()) if (o !== d && o.alive && o.center.distanceTo(at) < 8) { this.tracer(at, o.center, "#bfe8ff", 0.2); this.applyHit(o, "body", o.center, s.stats.dano * 1.2, "electrico", false, false); }
      }
    } else if (sound) this.sfx(crit ? "crit" : "hit");
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
  private explode(at: THREE.Vector3, dmg: number, element: Element, except?: Dummy, color = 0xffb060) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }));
    m.position.copy(at); this.scene.add(m); this.bursts.push({ mesh: m, t: 0.35 });
    this.sfx("boom");
    for (const d of this.hooks.dummies()) if (d !== except && d.alive && d.center.distanceTo(at) < 2.2) this.applyHit(d, "body", d.center, dmg, element === "explosive" ? null : element, false, false);
  }

  private tracer(a: THREE.Vector3, b: THREE.Vector3, color: string, life = 0.07) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.scene.add(line); this.tracers.push({ line, t: life, max: life });
  }
  private decal(hit: THREE.Intersection) {
    if (!hit.face) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(hit.point).addScaledVector(n, 0.003); m.lookAt(hit.point.clone().add(n));
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > 120) { const old = this.decals.shift()!; this.scene.remove(old); old.geometry.dispose(); }
  }
}
