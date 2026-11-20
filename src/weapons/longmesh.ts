// Malla de las armas largas generadas por código (longgen.ts). Cada pieza del perfil se levanta por secciones
// (loft.ts) con cantos redondeados o biselados según la era, y lleva sus detalles: ventana de expulsión, palanca de
// carga, miras, tornillos, remaches, ranuras de refrigeración, eslabones de cinta, nervios de cargador, cantonera…
// Materiales por era (formas y materiales, no solo color):
//   clásica = acero pavonado y madera; moderna = polímero, raíles y ranuras; rústica = chapa, óxido, cinta y remiendos;
//   sci-fi = carcasas anguladas con juntas de panel y carenados (sin luces salvo en legendarias).
import * as THREE from "three";
import { longFrame, longPolys, type LongDesign, type LPoly, type Pt } from "./longgen";
import { cutPoly, loftPoly, sweep } from "./loft";
import type { PartRole } from "./types";

const mat = (name: string) => new THREE.MeshStandardMaterial({ name });
const box = (w: number, h: number, d: number, x: number, y: number, z: number, name: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name)); m.position.set(x, y, z); return m; };
const tube = (r: number, len: number, x0: number, y: number, name: string, seg = 12, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(name)); m.rotation.z = -Math.PI / 2; m.position.set(x0 + len / 2, y, z); return m; };
const disc = (r: number, d: number, x: number, y: number, z: number, name: string, seg = 10) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, seg), mat(name)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; };
const screws = (g: THREE.Object3D, x: number, y: number, zh: number, r = 0.0024) => { for (const z of [-1, 1]) g.add(disc(r, 0.0014, x, y, z * (zh + 0.0006), "procmetal", 8)); };
/** Pieza por secciones con el material y el redondeo dados. */
const loft = (p: LPoly, name: string, rTop: number, rBot: number, segs = 2, n = 26, o: Partial<Parameters<typeof loftPoly>[1]> = {}) =>
  new THREE.Mesh(loftPoly(p.poly, { half: () => p.depth / 2, rTop, rBot, segs, n, wear: 1.25, ...o }), mat(name));
/** Añade una malla ya girada (Object3D.add devuelve el padre: no encadenar el giro). */
const addRot = (g: THREE.Object3D, m: THREE.Object3D, x: number, y: number, z: number) => { m.rotation.set(x, y, z); g.add(m); return m; };
const downAxis = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a));

export interface BuiltLong { group: THREE.Group; parts: { object: THREE.Object3D; role: PartRole }[]; muzzle: THREE.Vector3; sightY: number; /** X del alza propia (para apuntar a través de ella), si la tiene. */ sightX: number | null; railAt: THREE.Vector3 | null; railLength: number; length: number }

export function buildLong(d: LongDesign, look: { legendary?: boolean } = {}): BuiltLong {
  const group = new THREE.Group(), roles: Record<string, THREE.Group> = {};
  const G = (role: PartRole) => (roles[role] ??= (() => { const g = new THREE.Group(); g.name = role; group.add(g); return g; })());
  const f = longFrame(d), era = d.era, w = d.recv.w;
  // Materiales por era
  const M = {
    body: era === "classic" ? "procmetal" : era === "rustic" ? "procmetal" : "proc",
    furn: era === "classic" ? "procwood" : era === "rustic" ? "procwood" : "proctape",
    grip: era === "classic" ? "proccheck" : era === "rustic" ? "proctape" : "procgrip",
  };
  const round = d.recv.style === "round" ? 0.75 : d.recv.style === "angular" ? 0.12 : 0.35;
  let railAt: THREE.Vector3 | null = null, railLength = 0, sightY = f.top + 0.01, sightX: number | null = null;
  const polys = longPolys(d);
  for (const p of polys) {
    switch (p.role) {
      case "body": {
        const g = G("receiver");
        g.add(loft(p, M.body, round, round * 0.6, d.recv.style === "angular" ? 1 : 2, 34));
        // Ventana de expulsión (lado derecho) con el cerrojo a la vista y palanca de carga
        const ex = d.family === "bullpup" ? d.feed.x + 0.02 : f.x1 * 0.55;
        g.add(box(0.07, 0.02, 0.001, ex, 0.004, w / 2 + 0.0004, "procpad"));
        // Junta entre cajón superior e inferior, brocal del cargador, selector, retén y pasadores (se lee como un arma)
        if (d.family !== "bullpup") for (const z of [-1, 1]) g.add(box(f.x1 * 0.96, 0.0016, 0.0008, f.x1 * 0.5, -0.002, z * (w / 2 + 0.0003), "procpad"));
        if (["box", "curved"].includes(d.feed.kind)) { const mx = d.feed.x; g.add(box(0.052, 0.012, w * 1.06, mx + 0.004, f.bot - 0.002, 0, M.body)); for (const z of [-1, 1]) g.add(box(0.008, 0.006, 0.002, mx + 0.032, f.bot + 0.006, z * (w / 2 + 0.001), "procmetal")); }
        if (d.grip.kind === "pistol") { const sx = d.grip.x - 0.012; for (const z of [-1, 1]) { g.add(disc(0.0045, 0.0016, sx, f.bot + 0.012, z * (w / 2 + 0.0006), "procmetal", 10)); g.add(box(0.008, 0.0024, 0.001, sx + 0.004, f.bot + 0.014, z * (w / 2 + 0.0014), "procmetal")); } for (const px of [d.grip.x + 0.02, d.grip.x + 0.05]) screws(g, px, f.bot + 0.006, w / 2, 0.0016); }
        if (d.family !== "bullpup" && era !== "classic") for (const z of [-1, 1]) g.add(box(f.x1 * 0.3, (f.top - f.bot) * 0.32, 0.0014, f.x1 * 0.32, (f.top + f.bot) / 2 + 0.006, z * (w / 2 + 0.0005), M.body)); // panel en relieve
        if (d.family === "bullpup") { const c = (f.top + f.bot) / 2; for (const z of [-1, 1]) { g.add(box(d.grip.x - 0.16, (f.top - f.bot) * 0.5, 0.0014, (d.grip.x - 0.16) / 2 + 0.03, c - 0.01, z * (w / 2 + 0.0005), "proctape")); g.add(box(0.012, 0.03, 0.002, 0.02, c - 0.02, z * (w / 2 + 0.001), "procpad")); } }
        // Juntas de panel, tornillos y remaches según la era
        if (era === "scifi") for (const z of [-1, 1]) { g.add(box(f.x1 * 0.8, 0.0012, 0.0008, f.x1 * 0.5, f.top - 0.012, z * (w / 2 + 0.0003), "procpad")); g.add(box(0.0012, (f.top - f.bot) * 0.6, 0.0008, f.x1 * 0.3, 0, z * (w / 2 + 0.0003), "procpad")); }
        if (era === "rustic") { g.add(box(f.x1 * 0.22, (f.top - f.bot) * 0.45, 0.0016, f.x1 * 0.3, -0.004, -(w / 2 + 0.0008), "procrust")); for (let k = 0; k < 4; k++) g.add(disc(0.0018, 0.002, f.x1 * (0.2 + k * 0.06), f.bot + 0.008, w / 2 + 0.001, "procmetal", 6)); }
        if (era === "classic" || era === "modern") for (const x of [f.x1 * 0.12, f.x1 * 0.88]) screws(g, x, f.bot + 0.012, w / 2);
        if (era !== "scifi") g.add(box(f.x1 * 0.28, 0.01, 0.0006, f.x1 * 0.3, f.top - 0.016, -(w / 2 + 0.0003), "procengrave"));
        // Rasgos grandes que se leen de lejos (de cerca ya hay juntas y tornillos): cajón inferior de otro tono, muñón
        // delante del cajón donde entra el cañón y tapa trasera escalonada
        if (d.family !== "bullpup" && !(d.barrel.profile === "sbs" || d.barrel.profile === "ou")) {
          const H = f.top - f.bot;
          g.add(box(f.x1 * 0.9, H * 0.36, w * 1.035, f.x1 * 0.52, f.bot + H * 0.18, 0, era === "classic" || era === "rustic" ? "procmetal" : "proctape"));
          g.add(box(0.026, H * 0.62, w * 0.86, f.x1 + 0.011, (f.top + f.bot) / 2 + H * 0.06, 0, "procmetal"));
          g.add(box(0.012, H * 0.78, w * 0.92, 0.006, (f.top + f.bot) / 2 + H * 0.04, 0, "procmetal"));
        }
        // Tapa de alimentación de la ametralladora (cinta): bisagra y pestillo
        if (d.family === "lmg" && d.feed.kind === "belt") { { const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, w * 0.9, 8), mat("procmetal")); hinge.position.set(f.x1 * 0.2, f.top, 0); addRot(g, hinge, Math.PI / 2, 0, 0); } g.add(box(0.02, 0.006, w * 0.7, f.x1 * 0.62, f.top + 0.003, 0, "procmetal")); }
        // Palanca de carga: a la derecha en ametralladoras y escopetas semiautomáticas, arriba en bullpups
        const ch = G("charging");
        if (d.family === "bullpup") ch.add(box(0.016, 0.008, 0.012, f.x1 - 0.05, f.top + 0.004, -w * 0.3, "procmetal"));
        else if (!(d.barrel.profile === "sbs" || d.barrel.profile === "ou") && d.fore.kind !== "pump") { ch.add(box(0.012, 0.012, 0.016, f.x1 * 0.78, 0.004, w / 2 + 0.008, "procmetal")); ch.add(tube(0.004, 0.012, f.x1 * 0.78 - 0.006, 0.004, "procmetal", 8, w / 2 + 0.016)); }
        // Bisagra de las escopetas de cañones gemelos (la acción se abre aquí)
        if (d.barrel.profile === "sbs" || d.barrel.profile === "ou") { g.add(disc(0.007, w + 0.004, f.x1 - 0.004, f.bot + 0.008, 0, "procmetal", 12)); g.add(box(0.014, 0.008, 0.008, 0.02, f.top + 0.003, 0, "procmetal")); }
        // Cantonera del bullpup
        if (d.family === "bullpup") { const c = cutPoly(p.poly, 0.004); if (c) g.add(box(0.012, c[1] - c[0] + 0.004, w * 1.02, 0.004, (c[0] + c[1]) / 2, 0, "procpad")); }
        break;
      }
      case "stock": {
        const g = G("stock"); const wood = d.stock.kind === "wood";
        g.add(loft(p, wood ? M.furn : d.stock.kind === "tube" ? "procmetal" : M.furn === "procwood" ? "proctape" : M.furn, wood ? 0.85 : 0.45, wood ? 0.7 : 0.4, 2, 22));
        // Cantonera de goma y anilla de correa
        const xs = p.poly.map((q) => q[0]), x0 = Math.min(...xs);
        if (d.stock.kind !== "tube") { const c = cutPoly(p.poly, x0 + 0.003); if (c) g.add(box(0.012, c[1] - c[0] + 0.002, p.depth * 1.04, x0 + 0.004, (c[0] + c[1]) / 2, 0, "procpad")); }
        if (d.stock.kind === "folding") g.add(disc(0.007, w * 0.8, -0.01, f.top - 0.016, 0, "procmetal", 10));
        if (d.stock.kind === "wood" || d.stock.kind === "solid") { const c = cutPoly(p.poly, x0 * 0.7); if (c) g.add(box(0.012, 0.004, 0.006, x0 * 0.7, c[0] - 0.001, 0, "procmetal")); }
        break;
      }
      case "cheek": G("stock").add(loft(p, M.furn === "procwood" ? "procwood" : "proctape", 0.8, 0.3, 2, 10)); break;
      case "grip": {
        const g = G("grip"); const xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]);
        if (Math.max(...ys) < -0.03 && Math.min(...xs) > f.x1) {
          // Empuñadura vertical delantera (rol "device": las manos la distinguen de la empuñadura)
          G("device").add(loft(p, "proctape", 0.8, 0.8, 3, 10, { origin: [(xs[0] + xs[1]) / 2, ys[0]], angle: -Math.PI / 2 }));
        } else {
          const a = d.grip.angle, o: Pt = [(p.poly[0][0] + p.poly[1][0]) / 2, (p.poly[0][1] + p.poly[1][1]) / 2];
          g.add(loft(p, M.grip, 0.9, 0.9, 3, 14, { origin: o, angle: downAxis(a) }));
          // Base de la empuñadura
          const e0 = p.poly[2], e1 = p.poly[3]; g.add(box(0.036, 0.006, p.depth * 1.05, (e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 0, "procpad"));
        }
        break;
      }
      case "guard": {
        // Guardamonte de varilla con su hueco y el gatillo dentro
        const g = G("trigger"), xs = p.poly.map((q) => q[0]), y0 = f.bot, gx0 = Math.min(...xs), gx1 = Math.max(...xs);
        const bottom = Math.min(...p.poly.map((q) => q[1]));
        const path: [number, number][] = [[gx1 - 0.004, y0], [gx1, y0 - (y0 - bottom) * 0.55], [gx1 - 0.012, bottom], [gx0 + 0.014, bottom], [gx0 + 0.004, y0 - (y0 - bottom) * 0.4], [gx0 + 0.006, y0]];
        g.add(new THREE.Mesh(sweep(path, 0.004, p.depth, { closed: false }), mat("procmetal")));
        const tx = gx0 + (gx1 - gx0) * 0.45; const tr = box(0.006, (y0 - bottom) * 0.7, 0.006, tx, y0 - (y0 - bottom) * 0.38, 0, "procmetal"); tr.rotation.z = 0.25; g.add(tr);
        break;
      }
      case "barrel": case "barrel2": {
        const g = G("barrel"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y = (Math.min(...ys) + Math.max(...ys)) / 2, r = (Math.max(...ys) - Math.min(...ys)) / 2;
        if (d.barrel.profile === "sbs") for (const z of [-1, 1]) g.add(tube(r, x1 - x0, x0, y, "procsteel", 14, z * r * 1.02));
        else g.add(tube(r, x1 - x0, x0, y, "procsteel", 14));
        if (d.barrel.profile === "fluted") for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(box((x1 - x0) * 0.6, 0.0016, 0.0016, x0 + (x1 - x0) * 0.55, y + Math.cos(a) * r, Math.sin(a) * r, "procpad")); }
        if (d.barrel.profile === "finned") for (let x = x0 + 0.04; x < x0 + (x1 - x0) * 0.6; x += 0.012) { const fin = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.7, r * 1.7, 0.003, 12), mat("procmetal")); fin.position.set(x, y, 0); addRot(g, fin, 0, 0, Math.PI / 2); }
        if (d.barrel.profile === "heavy") g.add(tube(r * 1.08, 0.02, x0 + 0.01, y, "procmetal", 14));
        // Punto de mira y banda de los cañones gemelos
        if (p.role === "barrel") g.add(box(0.004, 0.008, 0.003, x1 - 0.01, y + r + 0.004, 0, "procmetal"));
        if (d.barrel.profile === "sbs") g.add(box(x1 - x0 - 0.02, 0.004, r * 1.2, (x0 + x1) / 2, y + r * 0.85, 0, "procmetal"));
        break;
      }
      case "muzzle": {
        const g = G("muzzle"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), r = (Math.max(...ys) - Math.min(...ys)) / 2;
        if (d.barrel.muzzle === "brake") { g.add(box(x1 - x0, r * 1.6, r * 2, (x0 + x1) / 2, 0, 0, "procmetal")); for (let k = 0; k < 3; k++) for (const z of [-1, 1]) g.add(box(0.006, r * 1.1, 0.001, x0 + 0.01 + k * 0.012, 0, z * (r + 0.0006), "procpad")); }
        else if (d.barrel.muzzle === "comp") { g.add(tube(r, x1 - x0, x0, 0, "procmetal", 12)); for (let k = 0; k < 3; k++) g.add(box(0.006, 0.002, r * 1.2, x0 + 0.012 + k * 0.012, r - 0.0005, 0, "procpad")); }
        else if (d.barrel.muzzle === "choke") g.add(tube(r, x1 - x0, x0, 0, "procmetal", 14));
        else { g.add(tube(r, x1 - x0, x0, 0, "procmetal", 10)); for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.add(box((x1 - x0) * 0.45, r * 0.3, r * 0.3, x0 + (x1 - x0) * 0.65, Math.sin(a) * r * 1.02, Math.cos(a) * r * 1.02, "procpad")); } }
        break;
      }
      case "front": {
        const g = G("front"), k = d.fore.kind, xs = p.poly.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), ys = p.poly.map((q) => q[1]), lo = Math.min(...ys), hi = Math.max(...ys);
        const wood = k === "wood" || (k === "vented" && era !== "scifi");
        g.add(loft(p, wood ? M.furn : k === "heatshield" ? "procmetal" : "proctape", k === "tube" ? 1 : k === "heatshield" ? 0.4 : 0.6, k === "tube" ? 1 : 0.55, k === "tube" ? 4 : 2, 22));
        const hw = p.depth / 2;
        if (k === "slot" || k === "heatshield" || k === "vented") for (let x = x0 + 0.02; x < x1 - 0.02; x += k === "heatshield" ? 0.018 : 0.03) for (const z of [-1, 1]) g.add(box(k === "heatshield" ? 0.008 : 0.016, (hi - lo) * (k === "heatshield" ? 0.3 : 0.18), 0.001, x + 0.006, k === "heatshield" ? hi - (hi - lo) * 0.3 : (lo + hi) / 2, z * (hw + 0.0003), "procpad"));
        if (k === "rail") for (const [yy, zz, rot] of [[hi, 0, 0], [lo, 0, 0], [(lo + hi) / 2, hw, 1], [(lo + hi) / 2, -hw, 1]] as [number, number, number][]) for (let x = x0 + 0.006; x < x1 - 0.004; x += 0.01) { const t = box(0.005, 0.004, 0.012, x, yy, zz, "procmetal"); if (rot) t.rotation.x = Math.PI / 2; g.add(t); }
        if (k === "slot" || k === "rail") { railAt ??= null; }
        if (era === "rustic") g.add(box((x1 - x0) * 0.3, (hi - lo) * 1.04, p.depth * 1.06, x0 + (x1 - x0) * 0.4, (lo + hi) / 2, 0, "proctape")); // vuelta de cinta
        break;
      }
      case "jacket": {
        // Camisa de refrigeración: tubo ancho perforado a lo largo del cañón
        const g = G("front"), xs = p.poly.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), r = p.depth / 2;
        g.add(tube(r, x1 - x0, x0, 0, "procmetal", 16));
        for (let x = x0 + 0.03; x < x1 - 0.03; x += 0.035) for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; addRot(g, box(0.012, 0.012, 0.002, x, Math.sin(a) * r, Math.cos(a) * r, "procpad"), a, 0, 0); }
        g.add(tube(r * 0.75, 0.03, x1 - 0.002, 0, "procmetal", 14));
        break;
      }
      case "pump": {
        const g = G("pump"), xs = p.poly.map((q) => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), ys = p.poly.map((q) => q[1]), lo = Math.min(...ys), hi = Math.max(...ys);
        g.add(loft(p, era === "classic" || era === "rustic" ? "procwood" : "proctape", 0.85, 0.85, 3, 18));
        for (let x = x0 + 0.015; x < x1 - 0.01; x += 0.012) for (const z of [-1, 1]) g.add(box(0.004, (hi - lo) * 0.6, 0.001, x, (lo + hi) / 2, z * (p.depth / 2 + 0.0003), "procpad")); // estrías de agarre
        break;
      }
      case "tube": { const g = G("magazine"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]), r = (Math.max(...ys) - Math.min(...ys)) / 2; g.add(tube(r, Math.max(...xs) - Math.min(...xs), Math.min(...xs), (Math.max(...ys) + Math.min(...ys)) / 2, "procmetal", 12)); g.add(tube(r * 1.15, 0.012, Math.max(...xs) - 0.012, (Math.max(...ys) + Math.min(...ys)) / 2, "procmetal", 12)); break; }
      case "mag": {
        const g = G("magazine"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]);
        if (p.poly.length >= 16) {
          // Tambor (cargador o tambor giratorio de escopeta): disco con tapa, nervios y llave
          const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length, R = (Math.max(...xs) - Math.min(...xs)) / 2;
          g.add(disc(R, p.depth, cx, cy, 0, "magazine", 20));
          for (const z of [-1, 1]) { g.add(disc(R * 0.82, 0.002, cx, cy, z * (p.depth / 2 + 0.0008), "procpad", 20)); g.add(disc(R * 0.18, 0.005, cx, cy, z * (p.depth / 2 + 0.002), "procmetal", 8)); }
          if (d.feed.kind === "cylinder") for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.add(disc(R * 0.14, 0.003, cx + Math.cos(a) * R * 0.6, cy + Math.sin(a) * R * 0.6, p.depth / 2 + 0.002, "procpad", 8)); }
        } else if (d.feed.kind === "belt" && p.poly.length === 5) {
          // Caja de cinta colgada: caja con tapa y la cinta de eslabones entrando en el cajón
          g.add(loft(p, "proctape", 0.25, 0.2, 1, 10));
          const x0 = Math.min(...xs), x1 = Math.max(...xs), top = Math.max(...ys);
          g.add(box(x1 - x0 + 0.004, 0.006, p.depth * 1.04, (x0 + x1) / 2, top - 0.003, 0, "procmetal"));
          for (let k = 0; k < 5; k++) { const lk = box(0.009, 0.014, 0.006, x0 + 0.02 + k * 0.011, top + 0.004, p.depth * 0.32, "procsteel"); lk.rotation.z = 0.3; g.add(lk); }
          g.add(box(0.016, 0.008, 0.003, (x0 + x1) / 2, top - 0.02, p.depth / 2 + 0.0015, "procmetal")); for (const z of [-1, 1]) g.add(box(x1 - x0 - 0.01, 0.002, 0.001, (x0 + x1) / 2, (top + Math.min(...ys)) / 2, z * (p.depth / 2 + 0.0004), "procpad"));
        } else if (d.feed.kind === "pan") {
          const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, R = (Math.max(...xs) - Math.min(...xs)) / 2;
          const pan = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Math.max(...ys) - Math.min(...ys), 22), mat("magazine")); pan.position.set(cx, cy, 0); g.add(pan);
          { const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.3, R * 0.3, 0.012, 10), mat("procmetal")); hub.position.set(cx, cy + 0.012, 0); g.add(hub); }
        } else {
          // Cargador de caja (recto, curvo o superior): nervios laterales y base con labio
          g.add(new THREE.Mesh(loftPoly(p.poly, { half: () => p.depth / 2, rTop: 0.25, rBot: 0.25, segs: 1, n: 10, wear: 1.2, origin: [(p.poly[0][0] + p.poly[1][0]) / 2, (p.poly[0][1] + p.poly[1][1]) / 2], angle: d.feed.kind === "topbox" ? Math.PI / 2 - 0.4 : -Math.PI / 2 }), mat("magazine")));
          if (p.poly.length === 4) { const e0 = p.poly[2], e1 = p.poly[3], bp = box(Math.hypot(e0[0] - e1[0], e0[1] - e1[1]) + 0.006, 0.007, p.depth * 1.1, (e0[0] + e1[0]) / 2, (e0[1] + e1[1]) / 2, 0, "procpad"); bp.rotation.z = Math.atan2(e0[1] - e1[1], e0[0] - e1[0]); g.add(bp); }
          for (let k = 0.2; k < 0.85; k += 0.16) for (const z of [-1, 1]) { const x = p.poly[0][0] + (p.poly[3][0] - p.poly[0][0]) * k, y = p.poly[0][1] + (p.poly[3][1] - p.poly[0][1]) * k; g.add(box(0.026, 0.0025, 0.001, x + 0.012, y, z * (p.depth / 2 + 0.0004), "procpad")); }
        }
        break;
      }
      case "top": {
        const g = G("front"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        if (d.top === "rail") {
          g.add(box(x1 - x0, 0.005, p.depth, (x0 + x1) / 2, y0 + 0.0025, 0, "procmetal"));
          for (let x = x0 + 0.004; x < x1 - 0.003; x += 0.01) g.add(box(0.0055, 0.005, p.depth * 1.15, x, y0 + 0.0075, 0, "procmetal"));
          railAt = new THREE.Vector3((x0 + x1) / 2, y1, 0); railLength = x1 - x0; sightY = y1 + 0.008; sightX = x0 + 0.01;
          // Miras abatibles en los extremos
          g.add(box(0.008, 0.014, 0.012, x0 + 0.01, y1 + 0.007, 0, "procmetal")); g.add(box(0.008, 0.016, 0.012, x1 - 0.01, y1 + 0.008, 0, "procmetal"));
        } else if (d.top === "optic") {
          // Mira integrada en carcasa (tipo óptica de bullpup): visor con su lente
          G("receiver").add(loft(p, "proctape", 0.7, 0.2, 2, 12));
          g.add(tube(0.016, x1 - x0 + 0.01, x0 - 0.005, y1 - 0.016, "procmetal", 14)); { const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.002, 14), mat("procpad")); lens.position.set(x1 + 0.006, y1 - 0.016, 0); addRot(g, lens, 0, 0, Math.PI / 2); }
          sightY = y1 - 0.016;
        } else if (d.top === "rib") {
          g.add(box(x1 - x0, y1 - y0, p.depth, (x0 + x1) / 2, (y0 + y1) / 2, 0, "procmetal"));
          for (let x = x0 + 0.02; x < x1 - 0.02; x += 0.03) g.add(box(0.012, (y1 - y0) * 0.6, p.depth * 1.04, x, (y0 + y1) / 2, 0, "procpad"));
          { const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), mat("procdisplay")); bead.position.set(x1 - 0.006, y1 + 0.002, 0); g.add(bead); }
          sightY = y1 + 0.002; sightX = x0 + (x1 - x0) * 0.2;
        } else if (d.top === "iron") {
          g.add(box(x1 - x0, 0.006, p.depth, (x0 + x1) / 2, y0 + 0.003, 0, "procmetal"));
          for (const z of [-1, 1]) g.add(box(0.006, y1 - y0, 0.003, x0 + (x1 - x0) * 0.6, (y0 + y1) / 2, z * 0.006, "procmetal"));
          sightY = y1; sightX = x0 + (x1 - x0) * 0.6;
        }
        break;
      }
      case "carry": {
        // Asa: arco barrido con su hueco
        const g = G(d.family === "lmg" && Math.min(...p.poly.map((q) => q[0])) > f.x1 ? "barrel" : "front"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const path: [number, number][] = [[x0 + 0.004, y0], [x0 + (x1 - x0) * 0.15, y1 - 0.004], [x1 - (x1 - x0) * 0.15, y1 - 0.004], [x1 - 0.004, y0]];
        g.add(new THREE.Mesh(sweep(path, d.family === "bullpup" ? 0.014 : 0.01, p.depth, { closed: false }), mat(d.family === "lmg" ? "proctape" : M.body)));
        if (d.family === "bullpup" || (d.top === "handle")) sightY = Math.max(sightY, y1 + 0.004);
        break;
      }
      case "bipod": {
        const g = G("front"), xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y = Math.min(...ys);
        g.add(box(0.02, 0.012, 0.03, x1 - 0.01, y + 0.006, 0, "procmetal"));
        for (const z of [-1, 1]) { const leg = tube(0.0035, x1 - x0, x0, y, "procmetal", 8, z * 0.011); g.add(leg); g.add(box(0.012, 0.006, 0.008, x0 + 0.004, y - 0.002, z * 0.011, "procpad")); }
        break;
      }
    }
  }
  // Legendarias: incrustación grabada y detalle de latón (pieza distintiva sutil)
  if (look.legendary) for (const z of [-1, 1]) { G("receiver").add(box(f.x1 * 0.6, 0.0016, 0.0006, f.x1 * 0.5, f.top - 0.006, z * (w / 2 + 0.0004), "procdisplay")); G("receiver").add(box(f.x1 * 0.4, (f.top - f.bot) * 0.35, 0.0006, f.x1 * 0.42, -0.004, z * (w / 2 + 0.00035), "procengrave")); }
  const mz = new THREE.Vector3(f.muzzleX, 0, 0);
  const all = new THREE.Box3().setFromObject(group);
  return { group, parts: Object.entries(roles).map(([role, object]) => ({ object, role: role as PartRole })), muzzle: mz, sightY, sightX, railAt, railLength, length: all.max.x - all.min.x };
}
