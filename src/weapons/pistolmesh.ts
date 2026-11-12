// Malla de una pistola modular generada por código, a partir de su diseño (pistolgen.ts): cada pieza es la extrusión de
// su polígono de perfil con un bisel pequeño (low poly con aristas suavizadas), más los detalles de era. Las piezas se
// agrupan por rol para el acabado, la animación (la corredera retrocede, el cargador sale) y las manos.
import * as THREE from "three";
import { boreY, designPolys, gripCorners, muzzleOf, type PistolDesign, type Pt } from "./pistolgen";
import type { PartRole } from "./types";

const mat = (name: string) => new THREE.MeshStandardMaterial({ name });
function extrude(poly: Pt[], depth: number, name: string, holes: Pt[][] = [], bevel = 0.0012) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const d = Math.max(0.002, depth - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat(name));
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, name: string) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name)); m.position.set(x, y, z); return m;
}
function tube(r: number, len: number, x0: number, y: number, name: string, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(name)); m.rotation.z = -Math.PI / 2; m.position.set(x0 + len / 2, y, 0); return m;
}
/** Encoge un polígono hacia su centro (para cachas y paneles). */
const inset = (poly: Pt[], k: number): Pt[] => { const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length; return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };

const frameMat = (d: PistolDesign) => (d.era === "modern" || d.era === "scifi" ? "proctape" : "procmetal");

export interface BuiltPistol { group: THREE.Group; parts: { object: THREE.Object3D; role: PartRole }[]; muzzle: THREE.Vector3; sightY: number; railAt: THREE.Vector3 | null; railLength: number }

export function buildPistol(d: PistolDesign): BuiltPistol {
  const group = new THREE.Group();
  const roles: Record<string, THREE.Group> = {};
  const G = (role: PartRole) => (roles[role] ??= (() => { const g = new THREE.Group(); g.name = role; group.add(g); return g; })());
  const L = d.slide.len, h = d.slide.h, w = d.slide.w, fh = d.frame.h, by = boreY(d);
  let railAt: THREE.Vector3 | null = null, railLength = 0, sightY = h + 0.006;
  for (const p of designPolys(d)) {
    switch (p.role) {
      case "slide": {
        // Aligeramientos: ventanas en la mitad delantera de la corredera
        const holes: Pt[][] = [];
        for (let i = 0; i < d.slide.cuts; i++) { const x0 = L * (0.5 + i * 0.14), x1 = x0 + L * 0.09; holes.push([[x0, h * 0.55], [x1, h * 0.55], [x1, h * 0.85], [x0, h * 0.85]]); }
        const s = G("slide");
        s.add(extrude(p.poly, p.depth, "slide", holes));
        // Estrías (atrás, o atrás y delante)
        const serr = (xa: number) => { for (let k = 0; k < 6; k++) for (const z of [-1, 1]) s.add(box(0.0018, h * 0.62, 0.0012, xa + k * 0.0045, h * 0.5, z * (p.depth / 2 + 0.0004), "procmetal")); };
        if (d.slide.serr >= 1) serr(0.008); if (d.slide.serr === 2) serr(L - 0.04);
        // Ventana de expulsión (lado derecho) y cañón visible en ella
        if (d.slide.port) s.add(box(L * 0.2, h * 0.32, 0.0015, L * 0.42, h * 0.68, p.depth / 2 + 0.0005, "procmetal"));
        // Miras de hierro (si no hay raíl ni óptica encima)
        if (d.slide.top === "iron" || d.slide.top === "rib") { s.add(box(0.006, 0.006, 0.006, L - 0.012, h + 0.003, 0, "procmetal")); s.add(box(0.008, 0.006, w * 0.6, 0.012, h + 0.003, 0, "procmetal")); }
        // Aletas sci-fi en la parte delantera
        if (d.slide.fins) for (let k = 0; k < 3; k++) { const f = box(0.004, h * 0.5, 0.002, L * (0.62 + k * 0.08), h * 0.55, 0, "slide"); f.position.z = p.depth / 2 + 0.001; s.add(f); const g2 = f.clone(); g2.position.z = -f.position.z; s.add(g2); }
        break;
      }
      case "frame": {
        // Armazón de otro material que la corredera: polímero (moderna y sci-fi) o acero (clásica y rústica)
        const f = G("frame"); f.add(extrude(p.poly, p.depth, frameMat(d)));
        // Remaches (rústica) y gatillo
        if (d.extra.rivets) for (const x of [0.03, L * d.frame.dust * 0.5, L * d.frame.dust - 0.015]) for (const z of [-1, 1]) { const rv = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.002, 6), mat("procmetal")); rv.rotation.x = Math.PI / 2; rv.position.set(x, -fh * 0.5, z * (p.depth / 2 + 0.0008)); f.add(rv); }
        const g = gripCorners(d);
        f.add(extrude([[g.TF[0] + 0.016, -fh], [g.TF[0] + 0.024, -fh], [g.TF[0] + 0.02, -fh - 0.016], [g.TF[0] + 0.014, -fh - 0.017]], w * 0.18, "procmetal", [], 0));
        break;
      }
      case "guard": {
        // Guardamonte con su hueco
        const gx = p.poly[0][0], gl = 0.05, gd = 0.023;
        const hole: Pt[] = [[gx + 0.004, -fh - 0.002], [gx + gl - 0.006, -fh - 0.002], [gx + gl - 0.007, -fh - gd + 0.006], [gx + 0.004, -fh - gd + 0.006]];
        G("frame").add(extrude(p.poly, p.depth, frameMat(d), [hole], 0.0008));
        break;
      }
      case "grip": {
        const g = G("grip");
        g.add(extrude(p.poly, p.depth, "grip"));
        // Cachas de madera; el polímero es la propia empuñadura, con estrías en el frente
        if (d.grip.panels === "wood") {
          const panel = inset(p.poly, 0.78);
          for (const z of [-1, 1]) { const m = extrude(panel, 0.003, "wood", [], 0.0006); m.position.z = z * (p.depth / 2 + 0.0008); g.add(m); }
        } else if (d.grip.panels === "polymer") {
          const c = gripCorners(d);
          for (const t of [0.3, 0.48, 0.66]) { const x = c.TF[0] + (c.BF[0] - c.TF[0]) * t, y = c.TF[1] + (c.BF[1] - c.TF[1]) * t; const n = box(0.004, 0.006, p.depth * 1.02, x - 0.001, y, 0, "grip"); n.rotation.z = -d.grip.angle; g.add(n); }
        }
        if (d.grip.panels === "tape" || d.extra.wrap) {
          // Cinta: bandas que rodean la empuñadura
          const c = gripCorners(d);
          for (const t of [0.3, 0.5, 0.7]) {
            const x = c.TB[0] + (c.BB[0] - c.TB[0]) * t + d.grip.depth / 2, y = c.TB[1] + (c.BB[1] - c.TB[1]) * t;
            const band = box(d.grip.depth * 1.06, 0.008, p.depth * 1.08, x, y, 0, "proctape"); band.rotation.z = -d.grip.angle; g.add(band);
          }
        }
        if (d.grip.butt === "lanyard") { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 4, 8), mat("procmetal")); const c = gripCorners(d); ring.position.set(c.BB[0] + 0.006, c.BB[1] - 0.004, 0); g.add(ring); }
        break;
      }
      case "mag": {
        const m = G("magazine");
        m.add(extrude(p.poly, p.depth, "magazine", [], d.mag.kind === "drum" ? 0.002 : 0.0008));
        break;
      }
      case "barrel": {
        const b = G("barrel"); const ext = d.barrel.ext, r = d.barrel.d / 2;
        if (d.barrel.shroud) { b.add(tube(r * 1.9, ext, L - 0.002, by, "barrel", 8)); for (let k = 0; k < 3; k++) b.add(box(0.004, r * 3.9, r * 1.2, L + ext * (0.25 + k * 0.25), by, 0, "procmetal")); }
        else b.add(tube(r, ext + 0.002, L - 0.002, by, "barrel"));
        if (d.extra.wrap) b.add(tube(r * 1.25, Math.min(0.02, ext * 0.6), L + ext * 0.2, by, "proctape"));
        break;
      }
      case "comp": {
        const c = G("barrel"); c.add(extrude(p.poly, p.depth, "barrel"));
        if (d.barrel.comp === "ported") { const x0 = p.poly[0][0]; for (let k = 0; k < 3; k++) c.add(box(0.004, 0.003, p.depth * 0.6, x0 + 0.008 + k * 0.008, by + h * 0.47, 0, "procmetal")); }
        break;
      }
      case "hammer": G("trigger").add(extrude(p.poly, p.depth, "trigger", [], 0.0006)); break;
      case "top": {
        const s = G("slide");
        if (d.slide.top === "rail") {
          const x0 = p.poly[0][0], x1 = p.poly[1][0], lenR = x1 - x0;
          s.add(box(lenR, 0.004, w * 0.6, (x0 + x1) / 2, h + 0.002, 0, "procmetal"));
          for (let x = x0 + 0.003; x < x1 - 0.002; x += 0.008) s.add(box(0.004, 0.003, w * 0.6, x, h + 0.0055, 0, "procmetal"));
          railAt = new THREE.Vector3((x0 + x1) / 2, h + 0.007, 0); railLength = lenR; sightY = h + 0.007;
        } else if (d.slide.top === "rib") s.add(extrude(p.poly, p.depth, "procmetal", [], 0.0005));
        else {
          // Óptica integrada (sci-fi): bloque con lente
          s.add(extrude(p.poly, p.depth, "slide"));
          const x0 = p.poly[3][0], x1 = p.poly[2][0];
          s.add(box(0.002, 0.016, w * 0.6, x0 - 0.0005, h + 0.014, 0, "procdisplay"));
          s.add(box(0.002, 0.016, w * 0.6, x1 + 0.0005, h + 0.014, 0, "procdisplay"));
          sightY = h + 0.014;
        }
        break;
      }
      case "rail": {
        const x0 = p.poly[0][0], x1 = p.poly[1][0];
        const f = G("frame"); f.add(box(x1 - x0, 0.004, w * 0.6, (x0 + x1) / 2, -fh - 0.003, 0, "procmetal"));
        for (let x = x0 + 0.003; x < x1 - 0.002; x += 0.008) f.add(box(0.004, 0.003, w * 0.6, x, -fh - 0.0055, 0, "procmetal"));
        break;
      }
      case "vgrip": G("grip").add(extrude(p.poly, p.depth, "grip", [], 0.0015)); break;
      case "cell": {
        // Armazón de otro material que la corredera: polímero (moderna y sci-fi) o acero (clásica y rústica)
        const f = G("frame"); f.add(extrude(p.poly, p.depth, frameMat(d)));
        const x0 = p.poly[3][0], x1 = p.poly[1][0];
        for (const z of [-1, 1]) f.add(box((x1 - x0) * 0.7, 0.003, 0.0012, (x0 + x1) / 2, -fh - 0.009, z * (p.depth / 2 + 0.0006), "procdisplay"));
        break;
      }
    }
  }
  for (const o of group.children) o.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
  const [mx, my] = muzzleOf(d);
  return { group, parts: Object.entries(roles).map(([role, object]) => ({ object, role: role as PartRole })), muzzle: new THREE.Vector3(mx, my, 0), sightY, railAt, railLength };
}
