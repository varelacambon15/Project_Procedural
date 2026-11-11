// Arma en mano: vista en primera persona, disparo hitscan, dispersión, retroceso, recarga,
// apuntado, trazadoras, impactos, efectos elementales y sonido sintetizado.
import * as THREE from "three";
import type { WeaponAssembler, AssembledWeapon } from "../weapons/assembler";
import type { WeaponType } from "../weapons/types";
import { PELLETS } from "../weapons/generator";
import type { Item } from "./inventory";
import type { Dummy, Element, Zone } from "./dummies";

const AUTO: WeaponType[] = ["smg", "rifle", "bullpup", "lmg", "flamethrower"];
const RELOAD: Partial<Record<WeaponType, number>> = { pistol: 1.3, revolver: 2.2, smg: 1.7, rifle: 2.1, bullpup: 2.3, shotgun: 2.6, sniper: 2.8, launcher: 3.2, lmg: 4.2, flamethrower: 2.8 };

export interface ShotHooks {
  onHit(d: Dummy, zone: Zone, point: THREE.Vector3, dmg: number, element: Element, statusChance: number): number;
  onKill?(d: Dummy): void;
  dummies(): Dummy[];
}

export class Gun {
  readonly viewmodel = new THREE.Group();
  private holder = new THREE.Group();
  private model: AssembledWeapon | null = null;
  private cache = new Map<number, Promise<AssembledWeapon>>();
  item: Item | null = null;
  private cooldown = 0;
  reloadT = 0;
  private triggerHeld = false;
  private switchT = 0;
  recoil = 0;             // pitch extra de la cámara
  private kick = 0;       // retroceso visual del arma
  aimT = 0;
  private shotCount = 0;
  private flashLight = new THREE.PointLight(0xffc27a, 0, 6, 2);
  private flash: THREE.Mesh;
  private tracers: { line: THREE.Line; t: number }[] = [];
  private decals: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();
  private audio: AudioContext | null = null;
  private pendingEcho = -1;
  hitmarker = 0; critmarker = 0;
  private sightY = 0.03;
  /** Mapa de entorno para los reflejos del arma en mano. */
  env: THREE.Texture | null = null;

  constructor(private camera: THREE.PerspectiveCamera, private scene: THREE.Scene, private asm: WeaponAssembler, private world: THREE.Object3D[], private hooks: ShotHooks) {
    camera.add(this.viewmodel);
    this.viewmodel.add(this.holder);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0 }));
    this.holder.add(this.flash, this.flashLight);
  }

  get spec() { return this.item?.spec ?? null; }
  get reloading() { return this.reloadT > 0; }

  /** Olvida el modelo guardado de un arma (tras cambiarle piezas en el banco). */
  forget(uid: number) { this.cache.delete(uid); }

  /** Construye (o reutiliza) el modelo 3D de un objeto del inventario. */
  modelFor(item: Item, rebuild = false): Promise<AssembledWeapon> {
    if (rebuild || !this.cache.has(item.uid)) this.cache.set(item.uid, this.asm.assemble(item.spec));
    return this.cache.get(item.uid)!;
  }

  async equip(item: Item | null, rebuild = false) {
    this.item = item; this.reloadT = 0; this.switchT = 0.35;
    if (this.model) { this.holder.remove(this.model.group); this.model = null; }
    if (!item) return;
    const m = await this.modelFor(item, rebuild);
    if (this.item !== item) return;
    m.group.traverse((o) => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return;
      mesh.castShadow = false; mesh.renderOrder = 10;
      for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) if (this.env) { mat.envMap = this.env; mat.needsUpdate = true; }
    });
    m.group.rotation.y = Math.PI / 2; // +X (boca) mira hacia -Z de la cámara
    // Línea de mira: el centro de la mira si la lleva; si no, la parte superior del arma.
    const scope = m.parts.find((p) => p.role === "scope");
    const box = new THREE.Box3().setFromObject(scope ? scope.object : m.group);
    this.sightY = scope ? (box.min.y + box.max.y) / 2 : box.max.y;
    this.model = m;
    this.holder.add(m.group);
    this.flash.position.set(0, m.muzzle.y, -m.muzzle.x).add(m.group.position);
    this.flashLight.position.copy(this.flash.position);
  }

  private sfx(kind: "shot" | "reload" | "hit" | "crit" | "empty", type?: WeaponType, suppressed = false) {
    try {
      this.audio ??= new AudioContext();
      const a = this.audio, t = a.currentTime, g = a.createGain(); g.connect(a.destination);
      if (kind === "shot") {
        const len = type === "sniper" || type === "shotgun" ? 0.35 : 0.16;
        const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, type === "sniper" ? 2 : 3.5);
        const src = a.createBufferSource(); src.buffer = buf;
        const f = a.createBiquadFilter(); f.type = "lowpass";
        f.frequency.value = suppressed ? 900 : ({ pistol: 2600, revolver: 2000, smg: 3000, sniper: 1500, shotgun: 1400, lmg: 2200, launcher: 600, flamethrower: 500 } as Record<string, number>)[type ?? "rifle"] ?? 2400;
        src.connect(f); f.connect(g); g.gain.value = suppressed ? 0.12 : 0.32; src.start(t);
      } else {
        const o = a.createOscillator();
        const c = { reload: [420, 700, 0.07, 0.06], hit: [1400, 1200, 0.03, 0.05], crit: [1900, 2400, 0.06, 0.07], empty: [220, 180, 0.04, 0.06] }[kind];
        o.type = "square"; o.frequency.setValueAtTime(c[0], t); o.frequency.exponentialRampToValueAtTime(c[1], t + c[2]);
        g.gain.setValueAtTime(c[3], t); g.gain.exponentialRampToValueAtTime(0.001, t + c[2]);
        o.connect(g); o.start(t); o.stop(t + c[2] + 0.02);
      }
    } catch { /* sin audio */ }
  }

  startReload() {
    const s = this.spec; if (!s || !this.item || this.reloadT > 0 || this.item.ammo >= s.stats.cargador) return;
    let time = (RELOAD[s.type] ?? 2) * (1.35 - s.stats.manejo / 200);
    if (this.item.ammo === 0 && s.effects.some((e) => e.id === "recarga")) time *= 0.5;
    this.reloadT = time;
    this.sfx("reload");
  }

  update(dt: number, fire: boolean, aim: boolean, moving: number, sprinting: boolean) {
    const s = this.spec, it = this.item;
    this.cooldown -= dt; this.switchT = Math.max(0, this.switchT - dt);
    this.hitmarker = Math.max(0, this.hitmarker - dt); this.critmarker = Math.max(0, this.critmarker - dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0 && it && s) { it.ammo = s.stats.cargador; this.sfx("reload"); } }
    const canAim = !!s && !sprinting && this.reloadT <= 0;
    this.aimT += ((aim && canAim ? 1 : 0) - this.aimT) * Math.min(1, dt * (8 + (s?.stats.manejo ?? 50) / 10));
    if (s && it && fire && this.switchT <= 0 && this.reloadT <= 0 && !sprinting) {
      const auto = AUTO.includes(s.type);
      if (this.cooldown <= 0 && (auto || !this.triggerHeld)) {
        if (it.ammo > 0) this.fire(moving);
        else if (!this.triggerHeld) { this.sfx("empty"); this.startReload(); }
      }
    }
    this.triggerHeld = fire;
    if (this.pendingEcho >= 0) { this.pendingEcho -= dt; if (this.pendingEcho < 0) { this.pendingEcho = -1; this.fire(moving, true); } }
    // Recuperación del retroceso
    this.recoil += (0 - this.recoil) * Math.min(1, dt * (6 + (s?.stats.manejo ?? 50) / 12));
    this.kick += (0 - this.kick) * Math.min(1, dt * 14);
    // Posición del arma: cadera / apuntando / corriendo / recargando / cambiando
    const len = this.model?.length ?? 0.3;
    const handgun = s?.type === "pistol" || s?.type === "revolver";
    const hip = new THREE.Vector3(0.16, -0.16, -(len * 0.5 + (handgun ? 0.22 : 0.1)));
    const ads = new THREE.Vector3(0, -this.sightY - 0.012, -(len * 0.5 + (handgun ? 0.24 : 0.06)));
    const p = hip.lerp(ads, this.aimT);
    if (sprinting) p.add(new THREE.Vector3(-0.05, -0.05, 0.05));
    if (this.reloadT > 0) p.y -= 0.12;
    p.y -= this.switchT * 0.8;
    p.z += this.kick * 0.05;
    this.holder.position.lerp(p, Math.min(1, dt * 18));
    this.holder.rotation.x = this.kick * 0.12 + (this.reloadT > 0 ? 0.5 : 0) * Math.min(1, this.reloadT * 3);
    this.holder.rotation.z = sprinting ? 0.35 : 0;
    // Efectos
    const fm = this.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = Math.max(0, fm.opacity - dt * 22); this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 120);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]; tr.t -= dt; (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, tr.t / 0.08);
      if (tr.t <= 0) { this.scene.remove(tr.line); tr.line.geometry.dispose(); this.tracers.splice(i, 1); }
    }
  }

  private fire(moving: number, echo = false) {
    const s = this.spec!, it = this.item!;
    if (!echo) { it.ammo--; this.cooldown = 60 / s.stats.cadencia; }
    this.shotCount++;
    const suppressed = !!s.muzzle;
    this.sfx("shot", s.type, suppressed);
    (this.flash.material as THREE.MeshBasicMaterial).opacity = suppressed ? 0.25 : 1; this.flashLight.intensity = suppressed ? 0.8 : 4;
    const kickPower = (s.type === "sniper" || s.type === "shotgun" ? 2.2 : s.type === "pistol" || s.type === "revolver" ? 1.3 : 0.7) * (1.4 - s.stats.manejo / 100) * (1 - this.aimT * 0.35);
    this.recoil += 0.012 * kickPower * (s.effects.some((e) => e.id === "doble") ? 1.4 : 1);
    this.kick = Math.min(1, this.kick + 0.6);
    const element = (s.effects.find((e) => e.element)?.id ?? null) as Element;
    const chance = s.effects.find((e) => e.element)?.value ?? 0;
    const pellets = (PELLETS[s.type] ?? 1) * (s.effects.some((e) => e.id === "doble") ? 2 : 1);
    const spreadDeg = s.type === "shotgun" ? 3.2 : ((100 - s.stats.precision) * 0.055 + 0.08) * (1 - this.aimT * 0.75) * (1 + moving * 0.6);
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const muzzle = this.flash.getWorldPosition(new THREE.Vector3());
    const targets = [...this.hooks.dummies().filter((d) => d.alive).flatMap((d) => d.hitboxes), ...this.world];
    for (let p = 0; p < pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1);
      const a = THREE.MathUtils.degToRad(spreadDeg) * Math.sqrt(Math.random()), th = Math.random() * Math.PI * 2;
      dir.x = Math.tan(a) * Math.cos(th); dir.y = Math.tan(a) * Math.sin(th); dir.normalize().applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
      this.ray.set(origin, dir); this.ray.far = 250;
      const hit = this.ray.intersectObjects(targets, false)[0];
      const end = hit ? hit.point : origin.clone().addScaledVector(dir, 250);
      if (p < 3) this.tracer(muzzle, end, s.rarity.color);
      if (!hit) continue;
      const dummy = hit.object.userData.dummy as Dummy | undefined;
      if (dummy) {
        const zone = hit.object.userData.zone as Zone;
        const dist = hit.distance;
        const falloff = dist <= s.stats.alcance ? 1 : Math.max(0.45, 1 - (dist - s.stats.alcance) / (s.stats.alcance * 2));
        const dmg = s.stats.dano * falloff * (zone === "head" ? 2 : zone === "limb" ? 0.8 : 1);
        const before = dummy.alive;
        this.hooks.onHit(dummy, zone, hit.point, dmg, element, chance);
        if (zone === "head") this.critmarker = 0.15; else this.hitmarker = 0.12;
        if (p === 0) this.sfx(zone === "head" ? "crit" : "hit");
        if (before && !dummy.alive) {
          this.hooks.onKill?.(dummy);
          if (s.effects.some((e) => e.id === "carronero")) it.ammo = Math.min(s.stats.cargador, it.ammo + 3);
        }
        if (s.effects.some((e) => e.id === "rebote")) {
          const next = this.hooks.dummies().filter((d) => d !== dummy && d.alive).sort((x, y) => x.center.distanceTo(hit.point) - y.center.distanceTo(hit.point))[0];
          if (next && next.center.distanceTo(hit.point) < 15) { this.tracer(hit.point, next.center, "#e8e1d3"); this.hooks.onHit(next, "body", next.center, dmg * 0.5, element, chance); }
        }
      } else this.decal(hit);
    }
    if (!echo && s.effects.some((e) => e.id === "eco") && this.shotCount % 5 === 0) this.pendingEcho = 0.5;
  }

  private tracer(a: THREE.Vector3, b: THREE.Vector3, color: string) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.scene.add(line); this.tracers.push({ line, t: 0.08 });
  }
  private decal(hit: THREE.Intersection) {
    if (!hit.face) return;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.035, 8), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    m.position.copy(hit.point).addScaledVector(n, 0.003); m.lookAt(hit.point.clone().add(n));
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > 120) { const old = this.decals.shift()!; this.scene.remove(old); old.geometry.dispose(); }
  }
}
