// Arma en mano: modos de disparo, habilidades, apuntado con mira y animaciones procedurales
// (inercia, balanceo, sprint táctico, salto, retroceso, recarga con cargador, corredera/cerrojo, inspección).
import * as THREE from "three";
import type { WeaponAssembler, AssembledWeapon, AssembledPart } from "../weapons/assembler";
import type { WeaponType } from "../weapons/types";
import { PELLETS, effectValue, hasEffect } from "../weapons/generator";
import { accessory } from "../weapons/accessories";
import type { Item } from "./inventory";
import type { Dummy, Element, Zone } from "./dummies";

const RELOAD: Partial<Record<WeaponType, number>> = { pistol: 1.4, revolver: 2.3, smg: 1.8, rifle: 2.2, bullpup: 2.4, shotgun: 2.6, sniper: 2.9, launcher: 3.2, lmg: 4.4, flamethrower: 2.8 };

export interface ShotHooks {
  onHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, statusChance: number, crit: boolean): number;
  onKill?(d: Dummy): void;
  dummies(): Dummy[];
}
export interface Control { fire: boolean; aim: boolean; moving: number; sprinting: boolean; lookX: number; lookY: number; vy: number; grounded: boolean; inspect: boolean }

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
  private sightY = 0.03;
  zoom = 1;
  private flashLight = new THREE.PointLight(0xffc27a, 0, 6, 2);
  private flash: THREE.Mesh;
  private tracers: { line: THREE.Line; t: number; max: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private bursts: { mesh: THREE.Mesh; t: number }[] = [];
  private ray = new THREE.Raycaster();
  private audio: AudioContext | null = null;
  private pendingEcho = -1;
  hitmarker = 0; critmarker = 0; killmarker = 0;

  constructor(private camera: THREE.PerspectiveCamera, private scene: THREE.Scene, private asm: WeaponAssembler, private world: THREE.Object3D[], private hooks: ShotHooks) {
    camera.add(this.viewmodel);
    this.viewmodel.add(this.sway); this.sway.add(this.holder);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
    this.holder.add(this.flash, this.flashLight);
  }

  get spec() { return this.item?.spec ?? null; }
  get reloading() { return this.reloadT > 0; }
  /** Dispersión actual en grados (la usa también la retícula). */
  spread(moving: number) {
    const s = this.spec; if (!s) return 1;
    if (s.type === "shotgun") return 3.4 * (1 - this.aimT * 0.25);
    return ((100 - s.stats.precision) * 0.055 + 0.08) * (1 - this.aimT * 0.75) * (1 + moving * 0.6);
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
    const m = await this.modelFor(item, rebuild);
    if (this.item !== item) return;
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.renderOrder = 10;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) if (this.env && "envMap" in mat) { mat.envMap = this.env; mat.needsUpdate = true; }
    });
    m.group.rotation.y = Math.PI / 2; // +X (boca) hacia -Z de la cámara
    this.sightY = m.sightY ?? new THREE.Box3().setFromObject(m.group).max.y;
    this.zoom = m.zoom;
    this.mag = m.parts.find((p) => p.role === "magazine") ?? null;
    this.model = m;
    this.holder.add(m.group);
    this.flash.position.set(0, m.muzzle.y, -m.muzzle.x);
    this.flashLight.position.copy(this.flash.position);
  }

  private sfx(kind: "shot" | "reload" | "hit" | "crit" | "kill" | "empty" | "cycle" | "boom", type?: WeaponType, quiet = false) {
    try {
      this.audio ??= new AudioContext();
      const a = this.audio, t = a.currentTime, g = a.createGain(); g.connect(a.destination);
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
        const c = { reload: [420, 700, 0.07, 0.05], hit: [1400, 1200, 0.03, 0.04], crit: [1900, 2400, 0.06, 0.06], kill: [700, 1600, 0.12, 0.06], empty: [220, 180, 0.04, 0.05], cycle: [300, 520, 0.06, 0.05] }[kind];
        o.type = "square"; o.frequency.setValueAtTime(c[0], t); o.frequency.exponentialRampToValueAtTime(c[1], t + c[2]);
        g.gain.setValueAtTime(c[3], t); g.gain.exponentialRampToValueAtTime(0.001, t + c[2]);
        o.connect(g); o.start(t); o.stop(t + c[2] + 0.02);
      }
    } catch { /* sin audio */ }
  }

  startReload() {
    const s = this.spec; if (!s || !this.item || this.reloadT > 0 || this.item.ammo >= s.stats.cargador || this.equipT > 0) return;
    let time = (RELOAD[s.type] ?? 2) * (1.35 - s.stats.manejo / 200);
    if (this.item.ammo === 0 && hasEffect(s, "reload")) time *= 1 - effectValue(s, "reload") / 100;
    this.reloadT = this.reloadDur = time; this.burstLeft = 0; this.inspectT = 0;
    this.sfx("reload");
  }

  update(dt: number, c: Control) {
    const s = this.spec, it = this.item;
    this.cooldown -= dt; this.equipT = Math.max(0, this.equipT - dt); this.cycleT = Math.max(0, this.cycleT - dt); this.frenzyT = Math.max(0, this.frenzyT - dt);
    this.hitmarker = Math.max(0, this.hitmarker - dt); this.critmarker = Math.max(0, this.critmarker - dt); this.killmarker = Math.max(0, this.killmarker - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && it && s) { it.ammo = s.stats.cargador; this.sfx("cycle"); } }
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
    // Recarga: inclinar, sacar cargador, meter cargador, montar
    if (this.reloadT > 0 && s) {
      const p = 1 - this.reloadT / this.reloadDur;
      const tilt = tri(p, 0, 1);
      rot.z += 0.55 * tilt; rot.x += 0.25 * tilt; pos.y -= 0.05 * tilt; pos.x -= 0.03 * tilt;
      pos.z += 0.04 * tri(p, 0.82, 0.97); rot.x -= 0.15 * tri(p, 0.82, 0.97);
      if (this.mag) {
        const out = p < 0.5 ? ease(THREE.MathUtils.clamp((p - 0.15) / 0.2, 0, 1)) : 1 - ease(THREE.MathUtils.clamp((p - 0.5) / 0.22, 0, 1));
        this.mag.object.position.copy(this.mag.base).add(new THREE.Vector3(-0.01, -0.2 * out, 0));
        this.mag.object.visible = !(p > 0.38 && p < 0.47);
      }
    } else if (this.mag) { this.mag.object.position.copy(this.mag.base); this.mag.object.visible = true; }
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

  private fire(moving: number, echo = false) {
    const s = this.spec!, it = this.item!;
    const fullMag = it.ammo === s.stats.cargador;
    if (!echo) { it.ammo--; this.cooldown = 60 / (s.stats.cadencia * (this.frenzyT > 0 ? 1.5 : 1)); }
    this.shotCount++;
    if (s.fireMode === "pump" || s.fireMode === "bolt") { this.cycleT = 0.45; setTimeout(() => this.sfx("cycle"), 200); }
    const quiet = !!accessory(s.muzzle)?.quiet;
    this.sfx("shot", s.type, quiet);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = quiet ? 0.2 : 1; this.flashLight.intensity = quiet ? 0.6 : 4;
    const steady = 1 - effectValue(s, "steady") / 100;
    const kickPower = (s.type === "sniper" || s.type === "shotgun" ? 2.2 : s.type === "revolver" ? 2 : s.type === "pistol" ? 1.2 : 0.7) * (1.4 - s.stats.manejo / 100) * (1 - this.aimT * 0.35) * steady * (hasEffect(s, "doble") ? 1.4 : 1);
    this.recoil += 0.011 * kickPower; this.recoilYaw += (Math.random() - 0.5) * 0.006 * kickPower;
    this.kick = Math.min(1, this.kick + 0.65); this.kickRoll += (Math.random() - 0.5) * 0.08 * kickPower;
    const elementFx = s.effects.find((e) => e.kind === "element");
    const element = (elementFx?.id ?? null) as Element;
    const chance = elementFx?.value ?? 0;
    const pellets = (PELLETS[s.type] ?? 1) * (hasEffect(s, "doble") ? 2 : 1);
    const spreadDeg = this.spread(moving);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
    const q = this.camera.getWorldQuaternion(new THREE.Quaternion());
    const targets = [...this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes), ...this.world];
    const dmgMult = fullMag && hasEffect(s, "opening") ? 1 + effectValue(s, "opening") / 100 : 1;
    const critMult = 2 * (1 + effectValue(s, "headhunter") / 100);
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1);
      const a = THREE.MathUtils.degToRad(spreadDeg) * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      dir.x = Math.tan(a) * Math.cos(th); dir.y = Math.tan(a) * Math.sin(th); dir.normalize().applyQuaternion(q);
      this.ray.set(origin, dir); this.ray.far = 250;
      const hits = this.ray.intersectObjects(targets, false);
      const pierce = hasEffect(s, "piercing") ? 3 : 1;
      let pierced = 0, end = origin.clone().addScaledVector(dir, 250);
      const seen = new Set<Dummy>();
      for (const hit of hits) {
        const dummy = hit.object.userData.dummy as Dummy | undefined;
        end = hit.point;
        if (!dummy) { this.decal(hit); if (hasEffect(s, "explosive")) this.explode(hit.point, s.stats.dano * 0.35 * dmgMult, element); break; }
        if (seen.has(dummy)) continue; seen.add(dummy);
        const zone = hit.object.userData.zone as Zone;
        const falloff = hit.distance <= s.stats.alcance ? 1 : Math.max(0.45, 1 - (hit.distance - s.stats.alcance) / (s.stats.alcance * 2));
        const crit = zone === "head";
        const dmg = s.stats.dano * falloff * dmgMult * (crit ? critMult : zone === "limb" ? 0.8 : 1);
        this.applyHit(dummy, zone, hit.point, dmg, element, chance, crit, p === 0);
        if (hasEffect(s, "explosive")) this.explode(hit.point, dmg * 0.35, element, dummy);
        if (hasEffect(s, "chain")) this.chain(dummy, dmg * 0.4);
        if (hasEffect(s, "rebote")) {
          const next = this.nearest(dummy, hit.point, 15);
          if (next) { this.tracer(hit.point, next.center, "#e8e1d3"); this.applyHit(next, "body", next.center, dmg * 0.5, element, chance, false, false); }
        }
        if (++pierced >= pierce) break;
      }
      if (p < 3) this.tracer(muzzle, end, s.rarity.id === "comun" ? "#e9dcc0" : s.rarity.color);
    }
    if (!echo && hasEffect(s, "eco") && this.shotCount % 5 === 0) this.pendingEcho = 0.5;
  }

  private applyHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, chance: number, crit: boolean, sound: boolean) {
    const alive = d.alive;
    this.hooks.onHit(d, zone, point, dmg, element, chance, crit);
    if (crit) this.critmarker = 0.15; else this.hitmarker = 0.12;
    if (alive && !d.alive) {
      this.killmarker = 0.35; this.sfx("kill");
      this.hooks.onKill?.(d);
      const s = this.spec!;
      if (hasEffect(s, "carronero") && this.item) this.item.ammo = Math.min(s.stats.cargador, this.item.ammo + 3);
      if (hasEffect(s, "frenzy")) this.frenzyT = 5;
    } else if (sound) this.sfx(crit ? "crit" : "hit");
  }
  private nearest(from: Dummy, at: THREE.Vector3, max: number, skip: Dummy[] = []) {
    return this.hooks.dummies().filter((d) => d !== from && d.alive && !skip.includes(d) && d.center.distanceTo(at) < max)
      .sort((x, y) => x.center.distanceTo(at) - y.center.distanceTo(at))[0];
  }
  private chain(from: Dummy, dmg: number) {
    const done: Dummy[] = [];
    let src = from.center;
    for (let i = 0; i < 2; i++) {
      const n = this.nearest(from, src, 10, done); if (!n) break;
      done.push(n); this.tracer(src, n.center, "#8fd8ff", 0.15);
      this.applyHit(n, "body", n.center, dmg, "electrico", 0, false, false); src = n.center;
    }
  }
  private explode(at: THREE.Vector3, dmg: number, element: Element, except?: Dummy) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 1, depthWrite: false }));
    m.position.copy(at); this.scene.add(m); this.bursts.push({ mesh: m, t: 0.35 });
    this.sfx("boom");
    for (const d of this.hooks.dummies()) if (d !== except && d.alive && d.center.distanceTo(at) < 2.5) this.applyHit(d, "body", d.center, dmg, element, 0, false, false);
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
