// Piezas generadas por código para cambios estructurales de silueta: culatas (tubo, esqueleto, maciza) y
// guardamanos (tubo ventilado, caja con raíles) con cañón. Son formas geométricas sencillas, como las reales, y se
// montan en la junta del cajón (armas despiezadas) o en un corte del cuerpo (armas enteras).
// Coordenadas del arma: metros, +X hacia la boca, +Y arriba. `at` es el centro de la junta.
import * as THREE from "three";
import type { Profile } from "./variation";

export type StockKind = "tube" | "skeleton" | "solid";
export type FrontKind = "tube" | "quad";
export interface ProcStock { kind: StockKind; at: [number, number]; h: number; w: number; len: number; drop: number }
export interface ProcFront { kind: FrontKind; at: [number, number]; h: number; w: number; len: number; barrel: number; d: number }

const N = 20;
/** Perfil a partir de una función que da [abajo, arriba] en cada x (o null si no hay pieza). */
function profileFrom(x0: number, x1: number, f: (x: number) => [number, number] | null): Profile {
  const top: (number | null)[] = [], bot: (number | null)[] = [];
  for (let k = 0; k < N; k++) { const x = x0 + ((x1 - x0) * (k + 0.5)) / N; const v = f(x); bot.push(v ? v[0] : null); top.push(v ? v[1] : null); }
  return { x0, x1, top, bot };
}

/** Silueta de la culata: va desde la junta hacia atrás, con caída hacia la cantonera. */
export function stockProfile(s: ProcStock): Profile {
  const [ax, ay] = s.at, x0 = ax - s.len;
  return profileFrom(x0, ax, (x) => {
    const t = (ax - x) / s.len; // 0 en la junta, 1 en la cantonera
    const yc = ay - s.drop * t;
    if (t > 0.94) return [yc - s.h * 0.65, yc + s.h * 0.45]; // cantonera
    if (s.kind === "tube") return [yc - s.h * 0.12, yc + s.h * 0.12];
    if (s.kind === "skeleton") return [yc - s.h * (0.4 + 0.2 * t), yc + s.h * 0.35];
    return [yc - s.h * (0.45 + 0.25 * t), yc + s.h * 0.42];
  });
}
/** Silueta del guardamanos y el cañón que sobresale. */
export function frontProfile(f: ProcFront): Profile {
  const [ax, ay] = f.at, x1 = ax + f.len + f.barrel;
  return profileFrom(ax, x1, (x) => (x <= ax + f.len ? [ay - f.h * 0.48, ay + f.h * 0.48] : [ay - f.d / 2, ay + f.d / 2]));
}

const box = (w: number, h: number, d: number, x: number, y: number, name = "proc") => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ name })); m.position.set(x, y, 0); return m; };
const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 10) => {
  const len = a.distanceTo(b); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), new THREE.MeshStandardMaterial({ name: "procmetal" }));
  m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
};

/** Culata por código (coordenadas del arma). */
export function buildStock(s: ProcStock): THREE.Group {
  const g = new THREE.Group(); const [ax, ay] = s.at; const bx = ax - s.len, by = ay - s.drop;
  const pad = box(0.014, s.h * 1.1, s.w * 1.05, bx + 0.007, by - s.h * 0.1, "procpad"); g.add(pad);
  if (s.kind === "tube") {
    g.add(rod(new THREE.Vector3(ax, ay + s.h * 0.05, 0), new THREE.Vector3(bx + 0.01, by + s.h * 0.05, 0), Math.max(0.006, s.h * 0.12)));
    g.add(box(0.03, s.h * 0.7, s.w * 0.9, ax - 0.015, ay, "procmetal"));
  } else if (s.kind === "skeleton") {
    for (const z of [-1, 1]) {
      const zz = z * s.w * 0.32;
      const top = rod(new THREE.Vector3(ax, ay + s.h * 0.3, zz), new THREE.Vector3(bx + 0.01, by + s.h * 0.3, zz), 0.0055, 6);
      const lo = rod(new THREE.Vector3(ax, ay - s.h * 0.35, zz), new THREE.Vector3(bx + 0.01, by - s.h * 0.55, zz), 0.0055, 6);
      g.add(top, lo);
    }
    g.add(box(0.02, s.h * 0.8, s.w * 0.8, ax - 0.01, ay - s.h * 0.02, "procmetal"));
  } else {
    // Maciza: perfil extruido (lomo recto, quilla que baja hacia la cantonera)
    // Maciza con agujero para el pulgar y quilla que se estrecha hacia la junta
    const sh = new THREE.Shape();
    sh.moveTo(ax, ay + s.h * 0.4); sh.lineTo(ax - s.len * 0.35, ay - s.drop * 0.35 + s.h * 0.36); sh.lineTo(bx, by + s.h * 0.42); sh.lineTo(bx, by - s.h * 0.7);
    sh.lineTo(ax - s.len * 0.55, ay - s.drop * 0.55 - s.h * 0.4); sh.lineTo(ax - s.len * 0.18, ay - s.h * 0.3); sh.lineTo(ax, ay - s.h * 0.42); sh.closePath();
    const hole = new THREE.Path();
    const hx = ax - s.len * 0.42, hy = ay - s.drop * 0.42 - s.h * 0.02, hw = s.len * 0.16, hh = s.h * 0.32;
    hole.moveTo(hx + hw, hy); hole.quadraticCurveTo(hx + hw, hy + hh, hx, hy + hh); hole.lineTo(hx - hw * 0.6, hy + hh * 0.6); hole.quadraticCurveTo(hx - hw, hy - hh * 0.2, hx, hy - hh * 0.5); hole.closePath();
    sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: s.w * 0.85, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -s.w * 0.425);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: "proc" })));
  }
  return g;
}

/** Guardamanos y cañón por código. Devuelve también la boca (punta del cañón). */
export function buildFront(f: ProcFront): { group: THREE.Group; barrel: THREE.Group; muzzle: THREE.Vector3 } {
  const g = new THREE.Group(); const [ax, ay] = f.at;
  if (f.kind === "quad") {
    g.add(box(f.len, f.h * 0.86, f.w * 0.9, ax + f.len / 2, ay));
    // Raíles en los cuatro lados (arriba, abajo y laterales), con sus dientes
    for (let x = ax + 0.006; x < ax + f.len - 0.006; x += 0.011) {
      g.add(box(0.005, 0.005, f.w * 0.5, x, ay + f.h * 0.46, "rail"), box(0.005, 0.005, f.w * 0.5, x, ay - f.h * 0.46, "rail"));
    }
    for (const z of [-1, 1]) { const side = box(f.len * 0.9, f.h * 0.3, 0.004, ax + f.len / 2, ay, "rail"); side.position.z = z * f.w * 0.47; g.add(side); }
  } else {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(f.h * 0.44, f.h * 0.46, f.len, 12), new THREE.MeshStandardMaterial({ name: "proc" }));
    tube.rotation.z = -Math.PI / 2; tube.position.set(ax + f.len / 2, ay, 0); g.add(tube);
    // Ranuras de ventilación a los lados
    for (let x = ax + f.len * 0.12; x < ax + f.len * 0.9; x += f.len * 0.14) for (const z of [-1, 1]) {
      const v = box(f.len * 0.08, f.h * 0.22, 0.004, x, ay + f.h * 0.08, "vent"); v.position.z = z * f.h * 0.44; g.add(v);
    }
    g.add(box(0.012, f.h * 0.95, f.h * 0.95, ax + f.len - 0.006, ay, "cap"));
  }
  const barrel = new THREE.Group();
  const bl = f.barrel + 0.02;
  const b = new THREE.Mesh(new THREE.CylinderGeometry(f.d / 2, f.d / 2, bl, 12), new THREE.MeshStandardMaterial({ name: "barrel" }));
  b.rotation.z = -Math.PI / 2; b.position.set(ax + f.len + bl / 2 - 0.02, ay, 0); barrel.add(b);
  return { group: g, barrel, muzzle: new THREE.Vector3(ax + f.len + f.barrel, ay, 0) };
}

/** Recorta una geometría (no indexada) por un plano x = c, quedándose con la parte `keep` ("below" = x < c). */
export function clipX(geo: THREE.BufferGeometry, c: number, keep: "below" | "above"): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position.array as ArrayLike<number>;
  const col = g.attributes.color?.array as ArrayLike<number> | undefined;
  const outP: number[] = [], outC: number[] = [];
  const inside = (x: number) => (keep === "below" ? x <= c : x >= c);
  const groups = g.groups.length ? g.groups : [{ start: 0, count: p.length / 3, materialIndex: 0 }];
  const ng = new THREE.BufferGeometry();
  for (const gr of groups) {
    const start = outP.length / 3;
    for (let v = gr.start; v < gr.start + gr.count; v += 3) {
      const P = [0, 1, 2].map((k) => [p[(v + k) * 3], p[(v + k) * 3 + 1], p[(v + k) * 3 + 2]]);
      const Cc = [0, 1, 2].map((k) => (col ? [col[(v + k) * 3], col[(v + k) * 3 + 1], col[(v + k) * 3 + 2]] : [1, 1, 1]));
      const ins = P.map((q) => inside(q[0]));
      const n = ins.filter(Boolean).length;
      if (n === 3) { for (let k = 0; k < 3; k++) { outP.push(...P[k]); outC.push(...Cc[k]); } continue; }
      if (n === 0) continue;
      // Polígono recortado (Sutherland–Hodgman con un plano) y abanico de triángulos
      const poly: number[][] = [], pc: number[][] = [];
      for (let k = 0; k < 3; k++) {
        const a = P[k], b = P[(k + 1) % 3], ia = ins[k], ib = ins[(k + 1) % 3];
        if (ia) { poly.push(a); pc.push(Cc[k]); }
        if (ia !== ib) { const t = (c - a[0]) / (b[0] - a[0]); poly.push([c, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); pc.push(Cc[k].map((x, i) => x + (Cc[(k + 1) % 3][i] - x) * t)); }
      }
      for (let k = 1; k + 1 < poly.length; k++) for (const i of [0, k, k + 1]) { outP.push(...poly[i]); outC.push(...pc[i]); }
    }
    if (g.groups.length) ng.addGroup(start, outP.length / 3 - start, gr.materialIndex);
  }
  ng.setAttribute("position", new THREE.Float32BufferAttribute(outP, 3));
  if (col) ng.setAttribute("color", new THREE.Float32BufferAttribute(outC, 3));
  ng.computeVertexNormals(); ng.computeBoundingBox(); ng.computeBoundingSphere();
  return ng;
}

/** Recorta un perfil (silueta) por x = c. */
export function clipProfile(p: Profile, c: number, keep: "below" | "above"): Profile {
  const n = p.top.length, out = { ...p, top: [...p.top], bot: [...p.bot] };
  for (let k = 0; k < n; k++) { const x = p.x0 + ((p.x1 - p.x0) * (k + 0.5)) / n; if (keep === "below" ? x > c : x < c) { out.top[k] = null; out.bot[k] = null; } }
  return out;
}
