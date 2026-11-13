// Armas en el suelo: salen del cofre o se sueltan desde el inventario. Haz de luz del color de su rareza,
// giran despacio y se recogen mirándolas y pulsando el botón de interactuar.
import * as THREE from "three";
import type { WeaponAssembler } from "../weapons/assembler";
import type { Item } from "./inventory";

export interface Pickup {
  item: Item; root: THREE.Group; model: THREE.Group | null; vel: THREE.Vector3; resting: boolean; t: number;
  /** Efecto de simulación: se compila de abajo arriba al aparecer y se desintegra al caducar. */
  clip: THREE.Plane; scan: THREE.Mesh; compileT: number; age: number; expires: number | null; dissolveT: number;
  /** Partículas que suben por el haz (más cuanto más rara); null en blancas y verdes. */
  motes: THREE.Points | null;
}
const LEVEL: Record<string, number> = { comun: 0, poco: 1, rara: 2, epica: 3, legendaria: 4 };
const MOTES = [0, 0, 6, 10, 18];
export interface SpawnOptions { compile?: boolean; expires?: number | null }

const beamGeo = new THREE.CylinderGeometry(0.012, 0.035, 2.6, 10, 1, true);
const ringGeo = new THREE.RingGeometry(0.28, 0.34, 32);

export class Pickups {
  readonly list: Pickup[] = [];
  /** Compila los shaders de un objeto en segundo plano antes de mostrarlo (sin tirón). Lo pone main.ts. */
  prewarm: ((o: THREE.Object3D) => Promise<unknown>) | null = null;
  constructor(private scene: THREE.Scene, private asm: WeaponAssembler, private colliders: THREE.Box3[]) {}

  /** Suelta un arma en `pos`, con un impulso opcional (p. ej. al salir del cofre). */
  spawn(item: Item, pos: THREE.Vector3, vel = new THREE.Vector3(), opts: SpawnOptions = {}): Pickup {
    const root = new THREE.Group(); root.position.copy(pos);
    const color = new THREE.Color(item.spec.rarity.color);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 1.3; beam.name = "beam";
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.name = "ring";
    // Sin luz propia: añadir o quitar una luz cambia el número de luces y obliga a recompilar todos los shaders
    // (congelaba el juego unos segundos cada vez que caía un arma). El haz y el anillo ya marcan la rareza.
    const scan = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.36, 32), new THREE.MeshBasicMaterial({ color: 0x9fe8ee, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    scan.rotation.x = -Math.PI / 2;
    root.add(beam, ring, scan);
    // Cuanto más rara, más alto y más visible el haz, con partículas que suben (se distingue de lejos)
    const lvl = LEVEL[item.spec.rarity.id] ?? 0;
    beam.scale.set(1 + lvl * 0.15, 1 + lvl * 0.2, 1 + lvl * 0.15); beam.position.y = 1.3 * (1 + lvl * 0.2);
    (beam.material as THREE.MeshBasicMaterial).opacity = 0.16 + lvl * 0.05;
    let motes: THREE.Points | null = null;
    if (MOTES[lvl]) {
      const pos = new Float32Array(MOTES[lvl] * 3);
      for (let i = 0; i < MOTES[lvl]; i++) { const a = Math.random() * Math.PI * 2, r = 0.05 + Math.random() * 0.12; pos.set([Math.cos(a) * r, Math.random() * 2.4, Math.sin(a) * r], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      motes = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      root.add(motes);
    }
    this.scene.add(root);
    const p: Pickup = { motes, item, root, model: null, vel: vel.clone(), resting: vel.lengthSq() === 0, t: Math.random() * 6, clip: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6), scan, compileT: opts.compile ? 0 : -1, age: 0, expires: opts.expires ?? null, dissolveT: -1 };
    this.list.push(p);
    this.asm.assemble(item.spec).then((built) => {
      if (!this.list.includes(p)) return;
      // Materiales propios con plano de recorte (para compilar y desintegrar solo esta arma)
      const cache = new Map<THREE.Material, THREE.Material>();
      built.group.traverse((o) => {
        const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = true;
        const conv = (src: THREE.Material) => { if (!cache.has(src)) { const c = src.clone(); c.clippingPlanes = [p.clip]; cache.set(src, c); } return cache.get(src)!; };
        m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      });
      const show = () => { if (this.list.includes(p)) { p.model = built.group; root.add(built.group); } };
      if (this.prewarm) this.prewarm(built.group).then(show, show); else show();
    }).catch(() => undefined);
    return p;
  }

  remove(p: Pickup) {
    const i = this.list.indexOf(p); if (i < 0) return;
    this.list.splice(i, 1); this.scene.remove(p.root);
    // Libera lo propio de esta arma (materiales clonados con su plano de recorte, partículas)
    p.root.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh && !(o as THREE.Points).isPoints) return;
      if (o === p.motes) p.motes.geometry.dispose();
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const x of mats) if (x.clippingPlanes?.includes(p.clip) || o === p.motes || o === p.scan || o.name === "beam" || o.name === "ring") x.dispose();
    });
    if (p.scan.geometry) p.scan.geometry.dispose();
  }

  update(dt: number) {
    for (const p of [...this.list]) {
      p.t += dt; p.age += dt;
      // Compilar (0,9 s) y desintegrar (0,8 s) con línea de escaneo
      const y0 = p.root.position.y + (p.model ? p.model.position.y : 0.45) - 0.35, H = 0.8;
      const sm = p.scan.material as THREE.MeshBasicMaterial;
      if (p.expires != null && p.age > p.expires && p.dissolveT < 0) p.dissolveT = 0;
      if (p.dissolveT >= 0) {
        p.dissolveT += dt; const h = H * Math.max(0, 1 - p.dissolveT / 0.8);
        p.clip.constant = y0 + h; p.scan.position.y = y0 - p.root.position.y + h; sm.opacity = 0.9;
        if (p.dissolveT > 0.8) { this.remove(p); continue; }
      } else if (p.compileT >= 0 && p.model) {
        p.compileT += dt; const h = H * Math.min(1, p.compileT / 0.9);
        p.clip.constant = y0 + h; p.scan.position.y = y0 - p.root.position.y + h; sm.opacity = 0.9;
        if (p.compileT >= 0.9) { p.compileT = -1; p.clip.constant = 1e6; sm.opacity = 0; }
      } else if (p.compileT >= 0) p.clip.constant = -1e6; // aún cargando: oculta
      else { p.clip.constant = 1e6; sm.opacity = 0; }
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
      if (p.motes) {
        const a = p.motes.geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < a.count; i++) { let y = a.getY(i) + dt * (0.5 + (i % 3) * 0.2); if (y > 2.4) y = 0; a.setY(i, y); }
        a.needsUpdate = true;
      }
      // Aviso antes de caducar: en los últimos 10 s el haz y el anillo parpadean, cada vez más rápido
      if (p.expires != null && p.dissolveT < 0) {
        const left = p.expires - p.age;
        p.root.visible = left > 10 || Math.sin(p.t * (6 + (10 - left) * 1.6)) > -0.6;
      }
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
