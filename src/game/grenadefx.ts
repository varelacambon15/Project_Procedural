// Lanzamiento y explosión de las granadas: parábola con gravedad, rebote en el suelo, mecha y efecto según el tipo
// (fragmentación, incendiaria, descarga, racimo, singularidad, adhesiva). Sin luces (el número de luces es fijo):
// el destello es una esfera emisiva aditiva que crece y se apaga.
import * as THREE from "three";
import type { Dummy, Element } from "./dummies";
import { GRENADE_KINDS, falloff, type GrenadeSpec } from "./grenades";
import { audio, playSample, sample, soundManifest } from "./audio";
import { grenadeObject, loadGrenadeModel } from "./grenademodel";

interface Flying { mesh: THREE.Object3D; v: THREE.Vector3; t: number; g: GrenadeSpec; stuck: Dummy | null; stuckOff: THREE.Vector3; mini?: boolean }
interface Blast { mesh: THREE.Mesh; t: number; dur: number; r: number }
interface Pull { at: THREE.Vector3; t: number; g: GrenadeSpec }

export interface GrenadeHooks {
  dummies(): Dummy[];
  onHit(d: Dummy, point: THREE.Vector3, dmg: number, element: Element): void;
}

const geo = new THREE.SphereGeometry(0.07, 10, 8), blastGeo = new THREE.SphereGeometry(1, 16, 12);

export class GrenadeFx {
  private flying: Flying[] = []; private blasts: Blast[] = []; private pulls: Pull[] = [];
  private model: THREE.Group | null = null;
  constructor(private scene: THREE.Scene, private hooks: GrenadeHooks) { void loadGrenadeModel().then((m) => (this.model = m)); }

  /** Lanza desde `from` en la dirección de la mirada (algo hacia arriba), a unos 13 m/s. */
  throw(g: GrenadeSpec, from: THREE.Vector3, dir: THREE.Vector3) {
    const m = grenadeObject(this.model, g.kind, g.rarity, 0.13);
    m.position.copy(from); this.scene.add(m);
    const v = dir.clone().normalize().multiplyScalar(13).add(new THREE.Vector3(0, 3.5, 0));
    this.flying.push({ mesh: m, v, t: g.fuse, g, stuck: null, stuckOff: new THREE.Vector3() });
    const l = soundManifest?.efectos.lanzar_granada; if (l?.length) playSample(sample(l[0]), 0.5);
  }

  update(dt: number) {
    for (const f of [...this.flying]) {
      f.t -= dt;
      if (f.stuck) f.mesh.position.copy(f.stuck.group.position).add(f.stuckOff);
      else {
        f.v.y -= 18 * dt; f.mesh.position.addScaledVector(f.v, dt); f.mesh.rotation.x += dt * 12;
        if (f.mesh.position.y < 0.07) {
          f.mesh.position.y = 0.07;
          if (Math.abs(f.v.y) > 1.5) {
            // (tarea 7: el rebote suena según la fuerza del golpe: duro, medio o suave, con algo de variación de tono)
            const sp = Math.abs(f.v.y), key = sp > 6 ? "rebote_duro" : sp > 3 ? "rebote_medio" : "rebote_granada";
            const l = soundManifest?.efectos[key] ?? soundManifest?.efectos.rebote_granada;
            if (l?.length) playSample(sample(l[Math.floor(Math.random() * l.length)]), Math.min(0.45, 0.12 + sp * 0.04), 0.94 + Math.random() * 0.12);
            f.v.y *= -0.35; f.v.x *= 0.6; f.v.z *= 0.6;
          }
          else { f.v.set(f.v.x * 0.9, 0, f.v.z * 0.9); }
        }
        // Adhesiva: se pega al primer enemigo que toca
        if (f.g.kind === "sticky" && !f.mini) for (const d of this.hooks.dummies()) {
          if (!d.alive) continue;
          const c = d.center; if (c.distanceTo(f.mesh.position) < 0.7 * (d.kind.scale ?? 1)) { f.stuck = d; f.stuckOff.copy(f.mesh.position).sub(d.group.position); f.t = Math.min(f.t, f.g.fuse); break; }
        }
      }
      if (f.t <= 0) { this.scene.remove(f.mesh); this.flying.splice(this.flying.indexOf(f), 1); this.detonate(f.g, f.mesh.position.clone(), f.mini); }
    }
    // Singularidad: atrae durante 1 s y estalla
    for (const p of [...this.pulls]) {
      p.t -= dt;
      for (const d of this.hooks.dummies()) {
        if (!d.alive) continue;
        const to = p.at.clone().sub(d.group.position); to.y = 0; const dist = to.length();
        if (dist < p.g.radius * 1.5 && dist > 0.4) d.group.position.addScaledVector(to.normalize(), Math.min(dist - 0.4, 9 * dt));
      }
      if (p.t <= 0) { this.pulls.splice(this.pulls.indexOf(p), 1); this.explode(p.g, p.at, 1); }
    }
    for (const b of [...this.blasts]) {
      b.t += dt; const k = b.t / b.dur;
      b.mesh.scale.setScalar(b.r * (0.3 + 0.7 * Math.min(1, k * 2)));
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      if (k >= 1) { this.scene.remove(b.mesh); this.blasts.splice(this.blasts.indexOf(b), 1); }
    }
  }

  private detonate(g: GrenadeSpec, at: THREE.Vector3, mini = false) {
    if (g.kind === "singularity" && !mini) { this.pulls.push({ at, t: 1, g }); this.flash(at, g.radius * 0.6, 0x9a6aff, 1); return; }
    this.explode(g, at, mini ? 0.45 : 1);
    if (g.kind === "cluster" && !mini) {
      // Racimo: 4 bombetas que saltan alrededor y estallan algo después
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.random() * 0.5, m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc8a040 }));
        m.position.copy(at).setY(0.3); this.scene.add(m);
        this.flying.push({ mesh: m, v: new THREE.Vector3(Math.cos(a) * 4, 5, Math.sin(a) * 4), t: 0.7 + i * 0.12, g, stuck: null, stuckOff: new THREE.Vector3(), mini: true });
      }
    }
  }

  private explode(g: GrenadeSpec, at: THREE.Vector3, scale: number) {
    const def = GRENADE_KINDS[g.kind], r = g.radius * (scale < 1 ? 0.6 : 1), dmgG = { damage: g.damage * scale, radius: r };
    for (const d of this.hooks.dummies()) {
      if (!d.alive) continue;
      const c = d.center, dist = Math.max(0, c.distanceTo(at) - 0.3 * (d.kind.scale ?? 1)), dmg = falloff(dmgG, dist);
      if (dmg > 0) { this.hooks.onHit(d, c, dmg, def.element); d.push(c.clone().sub(at).setY(0).normalize(), (def.element === "explosive" ? 1.2 : 0.5) * scale); }
    }
    this.flash(at, r, def.color, 0.45);
    const l = soundManifest?.efectos.explosion ?? [], f = l[Math.floor(Math.random() * l.length)];
    if (f) playSample(sample(f), 0.7 * (scale < 1 ? 0.6 : 1), scale < 1 ? 1.15 : 1);
    const gr = soundManifest?.efectos.explosion_grave; if (gr?.length && scale >= 1) playSample(sample(gr[0]), 0.5);
    void audio;
  }

  private flash(at: THREE.Vector3, r: number, color: number, dur: number) {
    const m = new THREE.Mesh(blastGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(at); m.scale.setScalar(0.1); this.scene.add(m); this.blasts.push({ mesh: m, t: 0, dur, r });
  }
}
