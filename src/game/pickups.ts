// Armas en el suelo: salen del cofre o se sueltan desde el inventario. Haz de luz del color de su rareza,
// giran despacio y se recogen mirándolas y pulsando el botón de interactuar.
import * as THREE from "three";
import type { WeaponAssembler } from "../weapons/assembler";
import type { Item } from "./inventory";

export interface Pickup { item: Item; root: THREE.Group; model: THREE.Group | null; vel: THREE.Vector3; resting: boolean; t: number }

const beamGeo = new THREE.CylinderGeometry(0.012, 0.035, 2.6, 10, 1, true);
const ringGeo = new THREE.RingGeometry(0.28, 0.34, 32);

export class Pickups {
  readonly list: Pickup[] = [];
  constructor(private scene: THREE.Scene, private asm: WeaponAssembler, private colliders: THREE.Box3[]) {}

  /** Suelta un arma en `pos`, con un impulso opcional (p. ej. al salir del cofre). */
  spawn(item: Item, pos: THREE.Vector3, vel = new THREE.Vector3()): Pickup {
    const root = new THREE.Group(); root.position.copy(pos);
    const color = new THREE.Color(item.spec.rarity.color);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 1.3; beam.name = "beam";
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.name = "ring";
    const light = new THREE.PointLight(color, 2.5, 3.5, 2); light.position.y = 0.4;
    root.add(beam, ring, light);
    this.scene.add(root);
    const p: Pickup = { item, root, model: null, vel: vel.clone(), resting: vel.lengthSq() === 0, t: Math.random() * 6 };
    this.list.push(p);
    this.asm.assemble(item.spec).then((built) => {
      if (!this.list.includes(p)) return;
      built.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      p.model = built.group; root.add(built.group);
    }).catch(() => undefined);
    return p;
  }

  remove(p: Pickup) {
    const i = this.list.indexOf(p); if (i < 0) return;
    this.list.splice(i, 1); this.scene.remove(p.root);
  }

  update(dt: number) {
    for (const p of this.list) {
      p.t += dt;
      if (!p.resting) {
        p.vel.y -= 14 * dt;
        const next = p.root.position.clone().addScaledVector(p.vel, dt);
        // Rebote simple contra el suelo y las cajas del escenario
        const hitBox = this.colliders.find((b) => b.containsPoint(new THREE.Vector3(next.x, Math.max(next.y, 0.05), next.z)));
        if (hitBox) { p.vel.x *= -0.3; p.vel.z *= -0.3; next.x = p.root.position.x; next.z = p.root.position.z; }
        if (next.y <= 0) { next.y = 0; p.vel.set(p.vel.x * 0.4, Math.abs(p.vel.y) * 0.25, p.vel.z * 0.4); if (p.vel.lengthSq() < 0.3) p.resting = true; }
        p.root.position.copy(next);
      }
      if (p.model) {
        p.model.rotation.y += dt * 0.8;
        p.model.position.y = 0.45 + Math.sin(p.t * 2) * 0.05;
      }
      const ring = p.root.getObjectByName("ring")!; ring.scale.setScalar(1 + Math.sin(p.t * 3) * 0.08);
    }
  }

  /** El arma a la que apunta el jugador (o la más cercana delante), a menos de 2,5 m. */
  target(eye: THREE.Vector3, dir: THREE.Vector3): Pickup | null {
    let best: Pickup | null = null, bestScore = Infinity;
    for (const p of this.list) {
      const c = p.root.position.clone().add(new THREE.Vector3(0, 0.45, 0));
      const to = c.sub(eye); const d = to.length();
      if (d > 2.6) continue;
      const ang = dir.angleTo(to.normalize());
      if (ang > 0.75) continue;
      const score = ang * 2 + d * 0.3;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return best;
  }
}
