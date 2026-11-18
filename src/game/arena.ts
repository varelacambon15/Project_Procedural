// Arena de oleadas: construye las coberturas de arenagen.ts en la sala de oleadas y las cambia con una animación de
// simulación (las nuevas suben del suelo, las que sobran se hunden, las que se mueven se deslizan). Sin luces nuevas:
// el acento de color es emisivo y se cambia en un solo material compartido.
import * as THREE from "three";
import type { ArenaBounds, ArenaCover, ArenaLayout } from "./arenagen";

interface Piece { c: ArenaCover; g: THREE.Group; box: THREE.Box3; state: "rise" | "idle" | "sink" | "move"; t: number; from: THREE.Vector3; to: THREE.Vector3 }

export class WaveArena {
  layout: ArenaLayout | null = null;
  private pieces = new Map<number, Piece>();
  private accent = new THREE.MeshStandardMaterial({ color: 0xe07a2a, emissive: 0xe07a2a, emissiveIntensity: 0.9 });
  private mats = {
    crate: new THREE.MeshStandardMaterial({ color: 0x4a525c, metalness: 0.5, roughness: 0.55 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xb4b9bf, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1f2329, metalness: 0.5, roughness: 0.5 }),
  };
  constructor(private scene: THREE.Scene, private colliders: THREE.Box3[], private shootables: THREE.Object3D[], readonly bounds: ArenaBounds) {}

  /** Pone una disposición: con `animate`, las piezas aparecen, se hunden o se deslizan; si no, de golpe. `avoid` = jugador. */
  set(layout: ArenaLayout, animate: boolean, avoid?: THREE.Vector3) {
    this.layout = layout;
    const col = new THREE.Color(layout.accent); this.accent.color.copy(col); this.accent.emissive.copy(col);
    const keep = new Set<number>();
    for (const c of layout.covers) {
      if (avoid && Math.abs(avoid.x - c.x) < c.w / 2 + 1 && Math.abs(avoid.z - c.z) < c.d / 2 + 1) continue; // (no encerrar al jugador)
      keep.add(c.id);
      const p = this.pieces.get(c.id);
      if (p) { if (p.c.x !== c.x || p.c.z !== c.z) { p.from.copy(p.g.position); p.to.set(c.x, 0, c.z); p.state = animate ? "move" : "idle"; p.t = 0; if (!animate) { p.g.position.copy(p.to); this.fit(p); } } p.c = c; continue; }
      const g = this.build(c); g.position.set(c.x, animate ? -c.h - 0.1 : 0, c.z); this.scene.add(g);
      const box = new THREE.Box3(new THREE.Vector3(c.x - c.w / 2, 0, c.z - c.d / 2), new THREE.Vector3(c.x + c.w / 2, c.h, c.z + c.d / 2));
      this.colliders.push(box); g.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.shootables.push(o); });
      this.pieces.set(c.id, { c, g, box, state: animate ? "rise" : "idle", t: 0, from: g.position.clone(), to: new THREE.Vector3(c.x, 0, c.z) });
    }
    for (const [id, p] of this.pieces) if (!keep.has(id)) { if (animate) { p.state = "sink"; p.t = 0; this.drop(p); } else this.remove(p); }
  }

  update(dt: number) {
    for (const p of [...this.pieces.values()]) {
      if (p.state === "idle") continue;
      p.t += dt; const k = Math.min(1, p.t / 1.1), e = k * k * (3 - 2 * k);
      if (p.state === "rise") p.g.position.y = (-p.c.h - 0.1) * (1 - e);
      else if (p.state === "sink") { p.g.position.y = (-p.c.h - 0.1) * e; if (k >= 1) this.remove(p); continue; }
      else { p.g.position.lerpVectors(p.from, p.to, e); this.fit(p); }
      // Destello del acento mientras la pieza se mueve (la simulación «recompila» la arena)
      this.accent.emissiveIntensity = 0.9 + 1.2 * Math.sin(k * Math.PI);
      if (k >= 1) { p.state = "idle"; p.g.position.y = 0; }
    }
  }

  private fit(p: Piece) { const c = p.c, x = p.g.position.x, z = p.g.position.z; p.box.min.set(x - c.w / 2, 0, z - c.d / 2); p.box.max.set(x + c.w / 2, c.h, z + c.d / 2); }
  /** Quita la colisión enseguida (la pieza que se hunde ya no estorba). */
  private drop(p: Piece) { const i = this.colliders.indexOf(p.box); if (i >= 0) this.colliders.splice(i, 1); }
  private remove(p: Piece) {
    this.drop(p); this.scene.remove(p.g); this.pieces.delete(p.c.id);
    p.g.traverse((o) => { const i = this.shootables.indexOf(o); if (i >= 0) this.shootables.splice(i, 1); if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
  }

  /** Malla de cada tipo de cobertura (estilo de simulación: volúmenes limpios y franjas de acento). */
  private build(c: ArenaCover) {
    const g = new THREE.Group(), M = this.mats;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };
    const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
    if (c.kind === "crate") { add(B(c.w, c.h, c.d), M.crate, 0, c.h / 2, 0); add(B(c.w + 0.03, 0.08, c.d + 0.03), this.accent, 0, c.h * 0.72, 0); add(B(c.w * 0.8, 0.04, c.d * 0.8), M.dark, 0, c.h + 0.02, 0); }
    else if (c.kind === "wall") { add(B(c.w, c.h, c.d), M.wall, 0, c.h / 2, 0); add(B(c.w + 0.03, 0.1, c.d + 0.03), this.accent, 0, c.h - 0.05, 0); add(B(c.w + 0.02, 0.18, c.d + 0.02), M.dark, 0, 0.09, 0); }
    else if (c.kind === "pillar") { add(new THREE.CylinderGeometry(c.w / 2, c.w / 2 + 0.05, c.h, 14), M.wall, 0, c.h / 2, 0); add(new THREE.CylinderGeometry(c.w / 2 + 0.06, c.w / 2 + 0.06, 0.12, 14), this.accent, 0, 1.2, 0); add(B(c.w + 0.3, 0.22, c.d + 0.3), M.dark, 0, 0.11, 0); }
    else if (c.kind === "barrier") { add(B(c.w, c.h, c.d), M.crate, 0, c.h / 2, 0); add(B(c.w + 0.03, 0.06, c.d + 0.03), this.accent, 0, c.h + 0.01, 0); }
    else { add(B(c.w, c.h, c.d), M.dark, 0, c.h / 2, 0); add(B(c.w * 0.5, c.h * 0.7, c.d + 0.02), this.accent, 0, c.h * 0.45, 0); add(B(c.w + 0.1, 0.1, c.d + 0.1), this.accent, 0, c.h + 0.05, 0); }
    return g;
  }
}
