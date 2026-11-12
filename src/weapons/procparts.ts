// Piezas generadas por código para cambios estructurales de silueta: culatas (tubo, esqueleto, maciza) y
// guardamanos (tubo ventilado, caja con raíles) con cañón. Son formas geométricas sencillas, como las reales, y se
// montan en la junta del cajón (armas despiezadas) o en un corte del cuerpo (armas enteras).
// Coordenadas del arma: metros, +X hacia la boca, +Y arriba. `at` es el centro de la junta.
import * as THREE from "three";
import type { Profile } from "./variation";

/** Culatas: tubo, esqueleto, maciza; y (prompt 05-A) plegable de alambre, de madera, de polímero tipo brace y de carabina. */
export type StockKind = "tube" | "skeleton" | "solid" | "folding" | "wood" | "polymer" | "carbine";
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
    if (s.kind === "folding") return [yc - s.h * (0.15 + 0.45 * t), yc + s.h * 0.3];
    if (s.kind === "polymer") return [yc - s.h * (0.35 + 0.2 * t), yc + s.h * 0.3];
    if (s.kind === "carbine") return [yc - s.h * (0.5 + 0.35 * t), yc + s.h * (0.42 + 0.12 * Math.min(1, t * 2))];
    if (s.kind === "wood") return [yc - s.h * (0.4 + 0.4 * t), yc + s.h * 0.4];
    return [yc - s.h * (0.45 + 0.25 * t), yc + s.h * 0.42];
  });
}
/** Silueta del guardamanos y el cañón que sobresale. */
export function frontProfile(f: ProcFront): Profile {
  const [ax, ay] = f.at, x1 = ax + f.len + f.barrel;
  return profileFrom(ax, Math.max(x1, ax + f.len), (x) => (x <= ax + f.len ? [ay - f.h * 0.48, ay + f.h * 0.48] : f.barrel > 0 ? [ay - f.d / 2, ay + f.d / 2] : null));
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
    // Esqueleto: marco cerrado (varilla superior, inferior y travesaño) a cada lado, con la cantonera
    const rr = Math.max(0.004, s.h * 0.13);
    for (const z of [-1, 1]) {
      const zz = z * s.w * 0.32;
      const top = rod(new THREE.Vector3(ax, ay + s.h * 0.3, zz), new THREE.Vector3(bx + 0.01, by + s.h * 0.3, zz), rr, 6);
      const lo = rod(new THREE.Vector3(ax, ay - s.h * 0.35, zz), new THREE.Vector3(bx + 0.01, by - s.h * 0.55, zz), rr, 6);
      const mid = rod(new THREE.Vector3(ax - s.len * 0.45, ay - s.drop * 0.45 + s.h * 0.3, zz), new THREE.Vector3(ax - s.len * 0.62, ay - s.drop * 0.62 - s.h * 0.42, zz), rr * 0.85, 6);
      g.add(top, lo, mid);
    }
    g.add(box(0.02, s.h * 0.8, s.w * 0.8, ax - 0.01, ay - s.h * 0.02, "procmetal"));
  } else if (s.kind === "folding") {
    // Plegable de alambre: varilla superior, diagonal desde abajo de la junta y bisagra
    const rr = Math.max(0.0035, s.h * 0.11);
    for (const z of [-1, 1]) {
      const zz = z * s.w * 0.3;
      g.add(rod(new THREE.Vector3(ax, ay + s.h * 0.25, zz), new THREE.Vector3(bx + 0.006, by + s.h * 0.25, zz), rr, 6));
      g.add(rod(new THREE.Vector3(ax, ay - s.h * 0.15, zz), new THREE.Vector3(bx + 0.006, by - s.h * 0.55, zz), rr, 6));
    }
    // Cantonera de chapa curvada (más visible que la almohadilla sola)
    g.add(box(0.006, s.h * 1.15, s.w * 0.95, bx + 0.003, by - s.h * 0.15, "procmetal"));
    g.add(box(0.012, s.h * 0.6, s.w * 0.8, ax - 0.006, ay + s.h * 0.05, "procmetal"));
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, s.w * 0.85, 8), new THREE.MeshStandardMaterial({ name: "procmetal" })); hinge.rotation.x = Math.PI / 2; hinge.position.set(ax - 0.012, ay - s.h * 0.15, 0); g.add(hinge);
  } else if (s.kind === "wood" || s.kind === "polymer" || s.kind === "carbine") {
    // Maciza de madera (lomo recto y quilla), brace de polímero (fina, con ranura de correa) o de carabina (con carrillera)
    const sh = new THREE.Shape(), k = s.kind;
    const topY = (t: number) => ay - s.drop * t + s.h * (k === "carbine" ? 0.42 + 0.12 * Math.min(1, t * 2) : k === "polymer" ? 0.3 : 0.4);
    // (el brace de polímero se estrecha hacia la cantonera y lleva una ranura grande para la correa del antebrazo)
    const botY = (t: number) => ay - s.drop * t - s.h * (k === "carbine" ? 0.5 + 0.35 * t : k === "polymer" ? 0.3 + 0.12 * t : 0.4 + 0.4 * t);
    sh.moveTo(ax, topY(0)); for (const t of [0.3, 0.7, 1]) sh.lineTo(ax - s.len * t, topY(t));
    for (const t of [1, 0.6, 0.25, 0]) sh.lineTo(ax - s.len * t, botY(t)); sh.closePath();
    if (k === "polymer") { const hx = ax - s.len * 0.48, hy = ay - s.drop * 0.48, sw = s.len * 0.26, shh = s.h * 0.17; const sl = new THREE.Path(); sl.moveTo(hx - sw, hy - shh); sl.lineTo(hx + sw, hy - shh); sl.lineTo(hx + sw, hy + shh); sl.lineTo(hx - sw, hy + shh); sl.closePath(); sh.holes.push(sl); }
    const depth = s.w * (k === "polymer" ? 0.6 : 0.85);
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -depth / 2);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: k === "wood" ? "Wood" : k === "polymer" ? "proctape" : "proc" })));
    // Unión a la junta (adaptador de metal)
    g.add(box(0.016, s.h * 0.55, s.w * 0.7, ax - 0.006, ay - s.h * 0.02, "procmetal"));
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
  if (f.barrel <= 0) return { group: g, barrel, muzzle: new THREE.Vector3(ax + f.len, ay, 0) };
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

// ---------- Biblioteca de añadidos por era (realistas o sci-fi), también usada por los kits de modernización ----------
/** Cubierta angulosa segmentada sobre el guardamanos (sci-fi). `y` centro, `h` alto, `w` ancho. */
export function buildCover(x0: number, x1: number, y: number, h: number, w: number): THREE.Group {
  const g = new THREE.Group(); const L = x1 - x0;
  const sh = new THREE.Shape();
  // Perfil lateral anguloso: frente en punta inclinada, quilla baja recortada y escalón trasero
  sh.moveTo(0, -h * 0.42); sh.lineTo(L * 0.3, -h / 2); sh.lineTo(L * 0.92, -h * 0.38); sh.lineTo(L, -h * 0.1); sh.lineTo(L * 0.78, h / 2);
  sh.lineTo(L * 0.12, h / 2); sh.lineTo(0, h * 0.32); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1 });
  geo.translate(x0, y, -w / 2);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: "proc" })));
  // Placa lateral rehundida (panel) para que se lea como carcasa segmentada
  for (const z of [-1, 1]) { const pn = box(L * 0.5, h * 0.42, 0.002, x0 + L * 0.45, y - h * 0.02, "procpad"); pn.position.z = z * (w / 2 + 0.004); g.add(pn); }
  // Juntas de los segmentos (ranuras oscuras)
  for (let x = x0 + L * 0.25; x < x1 - L * 0.1; x += L * 0.25) for (const z of [-1, 1]) {
    const s = box(0.003, h * 0.8, 0.003, x, y, "procpad"); s.position.z = z * (w / 2 + 0.002); g.add(s);
  }
  return g;
}
/** Celda de energía angulosa en el pozo del cargador (sci-fi), con su adaptador. `at` = parte alta del pozo. */
export function buildCell(at: [number, number], h: number, w: number): THREE.Group {
  const g = new THREE.Group(); const [x, y] = at;
  const sh = new THREE.Shape();
  sh.moveTo(-0.022, 0); sh.lineTo(0.022, 0); sh.lineTo(0.026, -h * 0.85); sh.lineTo(0.012, -h); sh.lineTo(-0.02, -h); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
  geo.translate(x, y - 0.006, -w / 2);
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: "proc" })));
  g.add(box(0.05, 0.008, w * 1.15, x, y - 0.004, "procmetal")); // brida de adaptación
  for (const k of [0.35, 0.6]) { const r = box(0.046, 0.004, w + 0.003, x + 0.002, y - h * k, "procpad"); g.add(r); }
  return g;
}
/** Pantalla pequeña de munición en el costado del cajón (apagada salvo en legendarias, que la tiñen). */
export function buildDisplay(at: [number, number], side: number): THREE.Group {
  const g = new THREE.Group();
  const frame = box(0.03, 0.018, 0.006, at[0], at[1], "procmetal"); frame.position.z = side; g.add(frame);
  const screen = box(0.024, 0.012, 0.002, at[0], at[1], "procdisplay"); screen.position.z = side + Math.sign(side) * 0.003; g.add(screen);
  return g;
}
/** Adaptador visible (brida con tornillos) donde un kit se une a la base. */
export function buildAdapter(x: number, y: number, w: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.016, 0.01, w * 1.1, x, y, "procmetal"));
  for (const z of [-1, 1]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 6), new THREE.MeshStandardMaterial({ name: "procpad" })); b.rotation.x = Math.PI / 2; b.position.set(x, y, z * (w * 0.55 + 0.001)); g.add(b); }
  return g;
}
/** Vendaje de cinta o tela alrededor de una pieza (rústica). */
export function buildTape(x: number, y: number, len: number, h: number, w: number): THREE.Group {
  const g = new THREE.Group();
  const t = box(len, h * 1.08, w * 1.12, x + len / 2, y, "proctape"); g.add(t);
  for (let k = 1; k < 4; k++) { const ridge = box(0.002, h * 1.12, w * 1.16, x + (len * k) / 4, y, "proctape"); g.add(ridge); }
  return g;
}
/** Parche de chapa remachado (rústica). */
export function buildPatch(x: number, y: number, side: number, s = 0.035): THREE.Group {
  const g = new THREE.Group();
  const p = box(s, s * 0.7, 0.002, x, y, "procmetal"); p.position.z = side; p.rotation.z = 0.08; g.add(p);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const r = box(0.003, 0.003, 0.002, x + dx * s * 0.4, y + dy * s * 0.25, "procpad"); r.position.z = side + Math.sign(side) * 0.0015; g.add(r); }
  return g;
}
