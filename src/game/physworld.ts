// Capa de física del juego (tarea 1, prototipo). Solo existe si la física está activa (`settings.physics`; sin fijar,
// sigue al modo desarrollador): carga Rapier en segundo plano, convierte en ragdoll a los humanoides que mueren,
// empuja con las explosiones y pone unos objetos sueltos de prueba en el campo de tiro. Desactivada no se crea y el
// juego no descarga Rapier.
import * as THREE from "three";
import { Physics, type Body } from "./physics";
import { Ragdoll } from "./ragdoll";
import type { Dummy } from "./dummies";

export const physicsEnabled = (s: { physics?: boolean; dev: boolean }) => s.physics ?? s.dev;

interface Prop { mesh: THREE.Mesh; body: Body }

export class PhysicsLayer {
  ph: Physics | null = null;
  private rags = new Map<Dummy, Ragdoll>();
  private props: Prop[] = [];
  /** Medidas para el informe: ms por paso, cuerpos y ragdolls activos. */
  readonly stats = { stepMs: 0, bodies: 0, ragdolls: 0, loadMs: 0 };
  constructor(private scene: THREE.Scene, private shootables: THREE.Object3D[], private camera: THREE.Camera) {
    void Physics.load().then((R) => {
      this.ph = new Physics(R); this.ph.addGround(0); this.stats.loadMs = Physics.loadMs;
      this.spawnProps();
    });
  }

  /** 6 cajas y 3 barriles junto al campo de tiro: reaccionan a las balas y a las explosiones. */
  private spawnProps() {
    const ph = this.ph!;
    const crate = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.85 });
    const barrel = new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: 0.45, metalness: 0.55 });
    const add = (mesh: THREE.Mesh, body: Body) => {
      mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh); this.shootables.push(mesh);
      // (los disparos los empujan: impulso en el punto, en la dirección de la vista)
      mesh.userData.onShot = (p: THREE.Vector3) => {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.getWorldQuaternion(new THREE.Quaternion()));
        const m = body.mass(), k = Math.min(12, 2.5 * m); // (un balazo: ~2,5 m/s en una caja, menos en lo pesado)
        ph.applyImpulse(body, { x: dir.x * k, y: dir.y * k + 0.15 * k, z: dir.z * k }, { x: p.x, y: p.y, z: p.z });
      };
      this.props.push({ mesh, body });
    };
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? 0.5 : 0.36, x = 2.4 + (i % 3) * 0.7, y = s / 2 + (i < 3 ? 0 : 0.52), z = 11.5;
      add(new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crate), ph.box({ x, y, z }, { x: s / 2, y: s / 2, z: s / 2 }, 60)); // (caja vacía de madera, ~60 kg/m³)
    }
    for (let i = 0; i < 3; i++) {
      const x = -2.6 - i * 0.75, z = 11.8;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 16), barrel), ph.cylinder({ x, y: 0.45, z }, 0.45, 0.28, 150)); // (barril metálico casi vacío)
    }
  }

  /** Explosión: empuja objetos y ragdolls (y, con `fresh`, a los que acaban de morir por ella). */
  explode(at: THREE.Vector3, radius: number, force = 9) { this.ph?.applyExplosion({ x: at.x, y: at.y, z: at.z }, radius, force); }

  update(dt: number, all: Dummy[]) {
    const ph = this.ph; if (!ph) return;
    // Nuevos muertos humanoides → ragdoll (con el empuje del disparo o la explosión que los mató)
    for (const d of all) {
      if (d.alive || d.ragdolled || this.rags.has(d)) continue;
      const parts = d.ragdollParts(); if (!parts) continue;
      d.ragdolled = true;
      // (el empuje de la muerte es una velocidad, ~1–3 m/s: se reparte en impulso sobre los ~35 kg del muñeco)
      const imp = parts.push.clone().setLength(Math.max(1.2, parts.push.length())).multiplyScalar(55).add(new THREE.Vector3(0, 6, 0));
      this.rags.set(d, new Ragdoll(ph, this.scene, parts, imp, d.center));
    }
    const n = ph.update(dt, () => { for (const r of this.rags.values()) r.limitCones(); });
    for (const [d, r] of this.rags) {
      r.sync(dt);
      // Fin: el muñeco se ha fundido (5 s), ha desaparecido o reaparece (blancos de práctica)
      if (r.age > 5.2 || d.gone || d.alive) { r.dispose(); this.rags.delete(d); if (!d.alive) d.ragdolled = d.gone; }
    }
    for (const p of this.props) { const t = p.body.translation(), q = p.body.rotation(); p.mesh.position.set(t.x, t.y, t.z); p.mesh.quaternion.set(q.x, q.y, q.z, q.w); }
    if (n) { this.stats.stepMs = ph.lastStepMs; this.stats.bodies = ph.world.bodies.len(); this.stats.ragdolls = this.rags.size; }
  }
}
