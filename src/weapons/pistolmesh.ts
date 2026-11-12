// Malla de una pistola o un revólver generado por código, a partir de su diseño (pistolgen.ts). Cada pieza es la
// extrusión de su polígono de perfil con chaflán (low poly con aristas biseladas, sin cel shading), más los detalles
// que hacen que parezca un arma de verdad: estrías, ventana de expulsión con el cañón a la vista, extractor, miras con
// muesca, gatillo dentro del guardamonte, martillo o percutor, palanca de retenida, pasadores y tornillos, brocal y base
// de cargador con relieve, textura de agarre, marcajes grabados y, por era, madera, remiendos, carenados o celdas.
// Las piezas se agrupan por rol para el acabado, la animación (la corredera retrocede, el cargador sale) y las manos.
//
// Nombres de material (los traduce finish.ts): "procmetal" metal, "procpad" acento oscuro (ranuras, huecos),
// "proctape" polímero/secundario, "procgrip" polímero con punteado de agarre, "proccheck" madera con rejilla,
// "procengrave" marcaje grabado, "procrust" óxido, "procdisplay" detalle (solo con color en legendarias).
import * as THREE from "three";
import { boreY, designPolys, guardDims, gripCorners, magFrame, muzzleOf, revFrame, type PistolDesign, type Pt } from "./pistolgen";
import type { PartRole } from "./types";
import { cutPoly, guardPath, loftPoly, sweep, type LoftOpts } from "./loft";

const mat = (name: string) => new THREE.MeshStandardMaterial({ name });
/** Pieza por secciones (loft.ts) con su material. */
const lofted = (poly: Pt[], name: string, o: LoftOpts) => new THREE.Mesh(loftPoly(poly, o), mat(name));
/** Ángulo del eje de una empuñadura o un cargador inclinado `a` (hacia abajo y atrás). */
const downAxis = (a: number) => Math.atan2(-Math.cos(a), -Math.sin(a));
/** Extrusión del perfil con chaflán que no agranda el contorno (bevelOffset negativo). */
function extrude(poly: Pt[], depth: number, name: string, holes: Pt[][] = [], bevel = 0.0012, segs = 1) {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const b = Math.min(bevel, depth * 0.3);
  const d = Math.max(0.0015, depth - b * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: segs, curveSegments: 6 });
  g.translate(0, 0, -d / 2);
  if (b > 0) edgeWear(g, name);
  return new THREE.Mesh(g, mat(name));
}
/**
 * Desgaste en aristas: los vértices de los chaflanes (normal entre el canto y la cara) se aclaran un poco, como el
 * pavonado o la pintura gastados en los bordes. Va en el color de vértice (la oclusión de contacto lo respeta).
 */
function edgeWear(g: THREE.BufferGeometry, name: string) {
  const nor = g.attributes.normal, n = nor.count, col = new Float32Array(n * 3).fill(1);
  const k = /wood|check/i.test(name) ? 1.08 : /tape|grip/i.test(name) ? 1.1 : 1.22;
  for (let i = 0; i < n; i++) { const z = Math.abs(nor.getZ(i)); if (z > 0.15 && z < 0.95) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
}
function box(w: number, h: number, d: number, x: number, y: number, z: number, name: string) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name)); m.position.set(x, y, z); return m;
}
/** Tubo a lo largo de X. */
function tube(r: number, len: number, x0: number, y: number, name: string, seg = 12, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(name)); m.rotation.z = -Math.PI / 2; m.position.set(x0 + len / 2, y, z); return m;
}
/** Disco a lo largo de Z (tornillos, pasadores, tambores de cargador). */
function disc(r: number, d: number, x: number, y: number, z: number, name: string, seg = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d, seg), mat(name)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m;
}
/** Tornillo con ranura, a ambos lados. */
function screws(g: THREE.Object3D, x: number, y: number, zHalf: number, r = 0.0022) {
  for (const z of [-1, 1]) { g.add(disc(r, 0.0012, x, y, z * (zHalf + 0.0005), "procmetal", 8)); g.add(box(r * 1.7, 0.0005, 0.0006, x, y, z * (zHalf + 0.0012), "procpad")); }
}
/** Encoge un polígono hacia su centro (cachas y paneles). */
const inset = (poly: Pt[], k: number): Pt[] => { const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cy = poly.reduce((a, p) => a + p[1], 0) / poly.length; return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]); };
/** Armazón de otro material que la corredera: polímero (moderna y sci-fi) o acero (clásica: igual que la corredera; rústica: otro metal). */
const frameMat = (d: PistolDesign) => (d.era === "modern" || d.era === "scifi" ? "proctape" : d.era === "rustic" ? "procmetal" : "frame");

export interface BuiltPistol { group: THREE.Group; parts: { object: THREE.Object3D; role: PartRole }[]; muzzle: THREE.Vector3; sightY: number; railAt: THREE.Vector3 | null; railLength: number }
export interface PistolLook { legendary?: boolean }

export function buildPistol(d: PistolDesign, look: PistolLook = {}): BuiltPistol {
  const group = new THREE.Group();
  const roles: Record<string, THREE.Group> = {};
  const G = (role: PartRole) => (roles[role] ??= (() => { const g = new THREE.Group(); g.name = role; group.add(g); return g; })());
  const L = d.slide.len, h = d.slide.h, w = d.slide.w, fh = d.frame.h, by = boreY(d), rev = d.family === "revolver";
  let railAt: THREE.Vector3 | null = null, railLength = 0, sightY = h + 0.006;
  const fm = frameMat(d);
  const gc = gripCorners(d);
  for (const p of designPolys(d)) {
    switch (p.role) {
      case "slide": {
        const s = G("slide");
        const round = d.slide.style === "round" || d.slide.style === "stepped";
        if (d.slide.style === "tube") {
          // Corredera de tubo: cilindro con la recámara en bloque detrás y un asa de montar soldada
          s.add(tube(h / 2, L - 0.03, 0.03, h / 2, "slide", 12));
          s.add(extrude([[0, 0], [0.034, 0], [0.034, h * 0.95], [0.004, h * 0.95], [0, h * 0.75]], w, "slide", [], 0.0015));
          s.add(box(0.012, 0.006, 0.006, 0.02, h + 0.002, 0, "procmetal"));
        } else {
          // Aligeramientos: ventanas en la mitad delantera
          // Por secciones: canto superior biselado (losa moderna), redondeado (clásica) o en cuña (carenado sci-fi);
          // la corredera se estrecha un poco en el morro
          const st = d.slide.style, hw = p.depth / 2;
          // Estrías talladas: la corredera se estrecha en cada ranura (atrás; delante también en las modernas)
          const grooves: [number, number][] = [];
          if (d.slide.serr >= 1) for (let k = 0; k < 7; k++) grooves.push([0.008 + k * 0.0042, 0.008 + k * 0.0042 + 0.0018]);
          if (d.slide.serr === 2) for (let k = 0; k < 5; k++) grooves.push([L - 0.042 + k * 0.0042, L - 0.042 + k * 0.0042 + 0.0018]);
          const taper = (x: number) => hw * (x > L * 0.82 ? 1 - 0.1 * Math.min(1, (x - L * 0.82) / (L * 0.18)) : 1);
          s.add(lofted(p.poly, "slide", {
            half: (x) => taper(x) - (grooves.some(([a, b]) => x > a && x < b) ? 0.0009 : 0),
            extraX: grooves.flatMap(([a, b]) => [a - 1e-5, a + 1e-5, b - 1e-5, b + 1e-5]),
            rTop: round ? 0.8 : st === "shroud" ? 0.55 : st === "open" ? 0.45 : 0.38, rBot: 0.1, segs: round ? 3 : st === "slab" ? 1 : 2, n: 30, wear: 1.3,
            // Ventana de expulsión hueca en el costado derecho
            notch: d.slide.port && st !== "open" ? { x0: L * 0.33, x1: L * 0.53, y: h * 0.52, depth: hw * 0.75 } : undefined,
          }));
          // Aligeramientos: ventanas oscuras en la mitad delantera
          for (let i = 0; i < d.slide.cuts; i++) for (const z of [-1, 1]) s.add(box(L * 0.09, h * 0.3, 0.001, L * (0.545 + i * 0.14), h * 0.7, z * (hw + 0.0002), "procpad"));
        }
        // Estrías: ranuras oscuras atrás (y delante en las modernas)
        const sw = p.depth / 2;
        const topAt = (x: number) => cutPoly(p.poly, Math.min(Math.max(x, 0.001), L - 0.001))?.[1] ?? h;
        const serr = (xa: number, n: number) => { for (let k = 0; k < n; k++) for (const z of [-1, 1]) s.add(box(0.0016, h * 0.6, 0.0008, xa + k * 0.0042, h * 0.5, z * (sw + 0.0001), "procpad")); };
        if (d.slide.style === "tube" && d.slide.serr >= 1) serr(0.007, 7); // (en la de tubo, sobre el bloque de recámara)
        // Ventana de expulsión (lado derecho): hueco oscuro con el capuchón del cañón a la vista y extractor detrás
        if (d.slide.port && d.slide.style !== "open") {
          // Dentro de la ventana: el fondo oscuro y el capuchón del cañón (acero) a la vista; extractor detrás
          if (d.slide.style === "tube") s.add(box(L * 0.2, h * 0.34, 0.001, L * 0.43, h * 0.7, sw + 0.0001, "procpad"));
          else {
            s.add(box(L * 0.19, h * 0.44, 0.001, L * 0.43, h * 0.75, sw * 0.25 + 0.0003, "procpad"));
            s.add(box(L * 0.17, h * 0.3, sw * 0.6, L * 0.43, h * 0.72, sw * 0.05, "procsteel"));
          }
          s.add(box(0.012, 0.0025, 0.001, L * 0.3, h * 0.72, sw + 0.0004, "procmetal"));
        }
        // Marcaje grabado (lado izquierdo)
        if (d.slide.style !== "tube") s.add(box(L * 0.32, h * 0.2, 0.0006, L * 0.58, h * 0.45, -(sw + 0.0002), "procengrave"));
        // Miras: muesca trasera (dos postes) y punto de mira; altas para silenciador
        if (d.slide.top === "iron" || d.slide.top === "rib" || d.slide.top === "high") {
          const tall = d.slide.top === "high" ? 0.011 : 0.005;
          // Apoyadas en la corredera donde de verdad está su lomo (morro inclinado o trasera en chaflán)
          const fx = L - 0.012 - (d.slide.nose === "step" ? 0.012 : 0), fy = topAt(fx) - 0.0006, ry = topAt(0.013) - 0.0006;
          s.add(box(0.004, tall, 0.0026, fx, fy + tall / 2, 0, "procmetal"));
          for (const z of [-1, 1]) s.add(box(0.007, tall, w * 0.22, 0.013, ry + tall / 2, z * w * 0.2, "procmetal"));
          s.add(box(0.007, tall * 0.4, w * 0.62, 0.013, ry + tall * 0.2, 0, "procmetal"));
          sightY = h + tall * 0.8;
        }
        // Aletas sci-fi en ángulo
        if (d.slide.fins) for (let k = 0; k < 3; k++) for (const z of [-1, 1]) { const f = box(0.004, h * 0.5, 0.002, L * (0.62 + k * 0.08), h * 0.55, z * (sw + 0.001), "slide"); f.rotation.z = 0.35; s.add(f); }
        // Remiendo soldado con remaches (rústica)
        if (d.extra.patch) { const px = L * 0.18; s.add(box(L * 0.22, h * 0.5, 0.0016, px + L * 0.11, h * 0.48, sw + 0.0008, "procrust")); for (const [dx, dy] of [[0.004, 0.3], [L * 0.22 - 0.004, 0.3], [0.004, 0.66], [L * 0.22 - 0.004, 0.66]]) s.add(disc(0.0014, 0.0016, px + dx, h * dy, sw + 0.0016, "procmetal", 6)); }
        // Junta corredera-armazón visible cuando son del mismo material (clásica)
        if (fm === "frame") for (const z of [-1, 1]) s.add(box(L * 0.95, 0.0009, 0.0006, L * 0.5, 0.0004, z * (sw + 0.0001), "procpad"));
        // Detalle de legendaria: filete de incrustación a lo largo de la corredera
        if (look.legendary) {
          for (const z of [-1, 1]) s.add(box(L * 0.82, 0.0014, 0.0006, L * 0.5, h * 0.82, z * (sw + 0.0003), "procdisplay"));
          // Grabado de volutas en todo el costado y punto de mira con inserto
          for (const z of [-1, 1]) s.add(box(L * 0.5, h * 0.42, 0.0005, L * 0.36, h * 0.42, z * (sw + 0.00025), "procengrave"));
          s.add(box(0.0026, 0.0026, 0.0028, L - 0.012, topAt(L - 0.012) + 0.004, 0, "procdisplay"));
        }
        break;
      }
      case "frame": {
        const f = G("frame");
        if (rev) { buildRevolverFrame(f, d, p.poly, p.depth); sightY = revFrame(d).top + 0.004; }
        else f.add(lofted(p.poly, fm, { half: () => p.depth / 2, rTop: 0.05, rBot: 0.5, segs: 2, n: 26 }));
        const fx = Math.max(...p.poly.map((q) => q[0]));
        const zh = p.depth / 2;
        // Pasadores del gatillo y del martillo, palanca de retenida (izquierda), botón del cargador y palanca de desarme
        f.add(disc(0.0016, p.depth + 0.002, gc.TF[0] + 0.012, -fh * 0.55, 0, "procmetal", 6));
        if (!rev) {
          f.add(disc(0.0016, p.depth + 0.002, 0.012, -fh * 0.35, 0, "procmetal", 6));
          const lever = extrude([[L * 0.36, -fh * 0.1], [L * 0.52, -fh * 0.1], [L * 0.52, -fh * 0.45], [L * 0.4, -fh * 0.45]], 0.0016, "procmetal", [], 0.0003);
          lever.position.z = -(zh + 0.0009); f.add(lever);
          f.add(disc(0.0022, 0.0015, L * 0.5, -fh * 0.28, -(zh + 0.0016), "procmetal", 8));
          f.add(disc(0.0026, p.depth + 0.0024, L * 0.58, -fh * 0.55, 0, "procmetal", 8));
          if (d.mag.kind !== "front") f.add(box(0.006, 0.006, 0.0018, gc.TF[0] + 0.002, -fh - 0.004, -(zh * 1.05 + 0.0006), "procpad"));
        } else {
          // Revólver: tornillos de la tapa lateral y retén del tambor
          const rf = revFrame(d);
          screws(f, rf.xc0 - 0.004, -fh * 0.45, zh); screws(f, rf.xc1 - 0.004, -fh * 0.55, zh);
          f.add(box(0.008, 0.004, 0.0018, rf.xc0 - 0.006, by - 0.004, -(zh + 0.0009), "procmetal"));
        }
        // Remaches (rústica)
        if (d.extra.rivets) for (const x of [0.03, (0.03 + fx) / 2, fx - 0.012]) for (const z of [-1, 1]) f.add(disc(0.0018, 0.0018, x, -fh * 0.5, z * (zh + 0.0008), "procmetal", 6));
        // Gatillo curvo dentro del guardamonte
        const tx = gc.TF[0] + 0.014;
        // Gatillo: hoja curva barrida (más ancha arriba), con la punta hacia delante
        G("trigger").add(new THREE.Mesh(sweep([[tx + 0.002, -fh + 0.002], [tx + 0.0005, -fh - 0.004], [tx + 0.0008, -fh - 0.009], [tx + 0.003, -fh - 0.013], [tx + 0.0065, -fh - 0.0155]], 0.0034, 0.0042, { segs: 2, r: 0.6 }), mat(look.legendary ? "procdisplay" : "procmetal")));
        break;
      }
      case "guard": {
        // Guardamonte con su hueco (el gatillo queda dentro)
        const gx = p.poly[0][0], { gl, gd } = guardDims(d);
        // Guardamonte de varilla barrida con su hueco real; redondo (clásico), de esquinas vivas o con gancho delantero
        const gt = 0.0045, rb = d.frame.guard === "round" ? 0.01 : 0.004, rf = d.frame.guard === "round" ? 0.013 : 0.005;
        const gm = rev ? "frame" : fm;
        G("frame").add(new THREE.Mesh(sweep(guardPath(gx + 0.004, gx + gl - gt / 2, -fh + 0.001, -fh - gd + gt / 2, rb, rf), gt, p.depth, { segs: 2, r: 0.55 }), mat(gm)));
        if (d.frame.guard === "hook") G("frame").add(new THREE.Mesh(sweep([[gx + gl - gt / 2, -fh - gd * 0.45], [gx + gl + 0.004, -fh - gd * 0.62], [gx + gl + 0.006, -fh - gd * 0.82], [gx + gl - 0.002, -fh - gd + gt / 2]], gt * 0.9, p.depth, { segs: 2, r: 0.55 }), mat(gm)));
        break;
      }
      case "grip": {
        const g = G("grip"), zh = p.depth / 2;
        const wood = d.grip.panels === "wood";
        // Polímero: la empuñadura misma con punteado; madera: armazón metálico con cachas de madera en rejilla
        // Por secciones a lo largo de su eje: sección casi elíptica (como una empuñadura de verdad)
        const gAx = { origin: gc.TB, angle: downAxis(d.grip.angle) };
        g.add(lofted(p.poly, wood ? (rev ? "frame" : fm) : d.grip.panels === "polymer" ? "procgrip" : "grip", { ...gAx, half: () => zh * (wood ? 0.86 : 1), rTop: 0.75, rBot: 0.8, segs: 3, n: 16 }));
        if (wood) {
          // Cachas de madera: ocupan los costados (más anchas que el armazón), con rejilla y tornillo
          const panel = inset(p.poly, 0.84);
          g.add(lofted(panel, "proccheck", { ...gAx, half: () => zh * 1.04, rTop: 0.55, rBot: 0.55, segs: 2, n: 12, wear: 1.06 }));
          const cx = panel.reduce((a, q) => a + q[0], 0) / panel.length, cy = panel.reduce((a, q) => a + q[1], 0) / panel.length;
          screws(g, cx, cy, zh * 1.04, 0.0024);
        }
        if (d.grip.panels === "tape" || d.extra.wrap) {
          // Vueltas de cinta que abrazan la forma de la empuñadura (un tramo de la misma pieza, algo más gruesa)
          for (const t of [0.22, 0.42, 0.62]) g.add(lofted(p.poly, "proctape", { ...gAx, half: () => zh * (wood ? 1.04 : 1), grow: 0.0011, range: [t, t + 0.09], rTop: 0.75, rBot: 0.8, segs: 3, n: 2, wear: 1.05 }));
        }
        // Brocal ensanchado en la base (abertura del cargador) en las de cargador en la empuñadura
        if (!rev && d.mag.kind !== "front" && d.mag.kind !== "none") {
          const a = d.grip.angle, ox = Math.sin(a) * 0.006, oy = Math.cos(a) * 0.006;
          const well: Pt[] = [[gc.BB[0] - 0.002 + ox, gc.BB[1] + oy], [gc.BB[0] - 0.002, gc.BB[1]], [gc.BF[0] + 0.002, gc.BF[1]], [gc.BF[0] + 0.002 + ox, gc.BF[1] + oy]];
          g.add(extrude(well, p.depth * 1.12, fm, [], 0.001));
        }
        if (look.legendary) { const cx = (gc.TB[0] + gc.BF[0]) / 2, cy = (gc.TB[1] + gc.BF[1]) / 2; for (const z of [-1, 1]) g.add(disc(0.0055, 0.0012, cx, cy, z * (zh + 0.0035), "procdisplay", 12)); }
        if (d.grip.butt === "lanyard" || (d.era === "classic" && !rev)) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0015, 4, 8), mat("procmetal")); ring.position.set(gc.BB[0] + 0.004, gc.BB[1] - 0.004, 0); g.add(ring); }
        break;
      }
      case "mag": {
        buildMag(G("magazine"), d, p.poly, p.depth);
        // Cargador delante del guardamonte: su brocal (caja del armazón donde entra)
        if (d.mag.kind === "front") { const x0 = Math.min(...p.poly.map((q) => q[0])), x1 = Math.max(...p.poly.map((q) => q[0])); G("frame").add(extrude([[x0 - 0.003, -fh + 0.001], [x1 + 0.003, -fh + 0.001], [x1 + 0.002, -fh - 0.016], [x0 - 0.002, -fh - 0.016]], p.depth * 1.3, fm, [], 0.0012, 2)); }
        break;
      }
      case "barrel": {
        const b = G("barrel"); const r = (p.poly[2][1] - p.poly[0][1]) / 2, x0 = p.poly[0][0], len = p.poly[1][0] - x0, y = (p.poly[0][1] + p.poly[2][1]) / 2;
        if (d.barrel.shroud) { b.add(tube(r, len, x0, y, "barrel", 8)); for (let k = 0; k < 3; k++) b.add(box(0.004, r * 2.05, r * 1.4, x0 + len * (0.25 + k * 0.25), y, 0, "procpad")); }
        else {
          b.add(tube(r, len, x0, y, "procsteel", 14));
          b.add(tube(r * 1.08, 0.003, x0 + len - 0.003, y, "procmetal", 14)); // corona de la boca
          if (d.barrel.profile === "fluted") for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.4; b.add(box(len * 0.7, 0.0012, 0.0012, x0 + len * 0.5, y + Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, "procpad")); }
          if (rev) { const yt = d.cyl!.rib !== "none" ? Math.max(revFrame(d).top, y + r + 0.003) : y + r; b.add(box(0.003, 0.006, 0.002, x0 + len - 0.008, yt + 0.003, 0, "procmetal")); } // punto de mira
        }
        if (d.extra.wrap && !rev) b.add(tube(r * 1.25, Math.min(0.02, len * 0.6), x0 + len * 0.25, y, "proctape"));
        break;
      }
      case "handguard": {
        // Guardamanos de carbina con ventilación y raíl inferior
        const x0 = p.poly[0][0], x1 = p.poly[1][0];
        const hg = G("front"); hg.add(lofted(p.poly, d.era === "rustic" ? "procmetal" : "proctape", { half: () => p.depth / 2, rTop: 0.55, rBot: 0.45, segs: 2, n: 12 }));
        for (let x = x0 + 0.012; x < x1 - 0.014; x += 0.018) for (const z of [-1, 1]) hg.add(box(0.01, (h * 0.45 + fh * 0.2) * 0.9, 0.0012, x + 0.005, (h * 0.45 - fh * 0.2) / 2, z * (p.depth / 2 + 0.0001), "procpad"));
        for (let x = x0 + 0.006; x < x1 - 0.004; x += 0.008) hg.add(box(0.004, 0.003, p.depth * 0.5, x, -fh * 0.8 - 0.002, 0, "procmetal"));
        break;
      }
      case "comp": {
        const c = G("barrel");
        if (rev) {
          // Revólver: compensador cilíndrico (como un cañón más grueso) con puertos arriba
          const x0 = p.poly[0][0], x1 = p.poly[1][0], yc = (p.poly[0][1] + p.poly[2][1]) / 2, rr = (p.poly[2][1] - p.poly[0][1]) / 2;
          c.add(tube(rr, x1 - x0, x0, yc, "procsteel", 12));
          for (let k = 0; k < 3; k++) c.add(box(0.004, 0.0025, rr * 1.2, x0 + 0.007 + k * 0.007, yc + rr - 0.0004, 0, "procpad"));
          break;
        }
        c.add(lofted(p.poly, "procsteel", { half: () => p.depth / 2, rTop: 0.45, rBot: 0.35, segs: 2, n: 8 }));
        const x0 = p.poly[0][0], top = Math.max(...p.poly.map((q) => q[1]));
        if (d.barrel.comp === "ported") for (let k = 0; k < 3; k++) c.add(box(0.004, 0.003, p.depth * 0.6, x0 + 0.008 + k * 0.008, top - 0.0005, 0, "procpad"));
        else for (const z of [-1, 1]) c.add(box(0.01, (top - p.poly[0][1]) * 0.5, 0.001, x0 + 0.014, (top + p.poly[0][1]) / 2, z * (p.depth / 2 + 0.0002), "procpad"));
        break;
      }
      case "hammer": {
        const hm = G("trigger"); hm.add(extrude(p.poly, p.depth, look.legendary ? "procdisplay" : "procsteel", [], 0.0006));
        // Estrías del pulgar en la espuela
        if (d.hammer === "spur") for (let k = 0; k < 3; k++) hm.add(box(0.0012, 0.0012, p.depth * 1.05, p.poly[0][0] + 0.003 + k * 0.003, p.poly[0][1] - 0.0004, 0, "procpad"));
        break;
      }
      case "top": {
        const s = G(rev ? "barrel" : "slide");
        if (rev) {
          // Banda del cañón del revólver: maciza o ventilada (postes)
          if (d.cyl!.rib === "vent") { const x0 = p.poly[0][0], x1 = p.poly[1][0], y0 = p.poly[0][1], y1 = p.poly[2][1]; s.add(box(x1 - x0, 0.002, p.depth, (x0 + x1) / 2, y1 - 0.001, 0, "procsteel")); for (let x = x0 + 0.008; x < x1 - 0.004; x += 0.02) s.add(box(0.003, y1 - y0, p.depth * 0.7, x, (y0 + y1) / 2, 0, "procsteel")); }
          else s.add(extrude(p.poly, p.depth, "procsteel", [], 0.0006));
          break;
        }
        if (d.slide.top === "rail") {
          const x0 = p.poly[0][0], x1 = p.poly[1][0], lenR = x1 - x0;
          s.add(box(lenR, 0.004, w * 0.6, (x0 + x1) / 2, h + 0.002, 0, "procmetal"));
          for (let x = x0 + 0.003; x < x1 - 0.002; x += 0.008) s.add(box(0.004, 0.003, w * 0.6, x, h + 0.0055, 0, "procmetal"));
          railAt = new THREE.Vector3((x0 + x1) / 2, h + 0.007, 0); railLength = lenR; sightY = h + 0.007;
        } else if (d.slide.top === "rib") s.add(extrude(p.poly, p.depth, "procmetal", [], 0.0005));
        else if (d.slide.top === "optic") {
          // Óptica integrada (sci-fi): bloque con lente
          s.add(extrude(p.poly, p.depth, "slide", [], 0.002, 2));
          const x0 = p.poly[3][0], x1 = p.poly[2][0];
          s.add(box(0.002, 0.016, w * 0.6, x0 - 0.0005, h + 0.014, 0, "procdisplay"));
          s.add(box(0.002, 0.016, w * 0.6, x1 + 0.0005, h + 0.014, 0, "procdisplay"));
          sightY = h + 0.014;
        }
        // ("high": las miras altas ya se ponen en la corredera)
        break;
      }
      case "rail": {
        const x0 = p.poly[0][0], x1 = p.poly[1][0];
        const f = G("frame"); f.add(box(x1 - x0, 0.004, w * 0.6, (x0 + x1) / 2, -fh - 0.003, 0, "procmetal"));
        for (let x = x0 + 0.003; x < x1 - 0.002; x += 0.008) f.add(box(0.004, 0.003, w * 0.6, x, -fh - 0.0055, 0, "procmetal"));
        break;
      }
      case "vgrip": G("device").add(lofted(p.poly, "procgrip", { origin: [p.poly[0][0], p.poly[0][1]], angle: -Math.PI / 2, half: () => p.depth / 2, rTop: 0.7, rBot: 0.7, segs: 2, n: 8 })); break;
      case "cell": {
        const f = G("frame"); f.add(extrude(p.poly, p.depth, "proctape", [], 0.0015));
        const x0 = p.poly[3][0], x1 = p.poly[1][0];
        for (const z of [-1, 1]) f.add(box((x1 - x0) * 0.7, 0.003, 0.0012, (x0 + x1) / 2, -fh - 0.009, z * (p.depth / 2 + 0.0006), "procdisplay"));
        break;
      }
      case "fairing": {
        // Carenado sci-fi: placas a los lados con una ranura de luz (apagada salvo en legendarias)
        const s = G(rev ? "frame" : "slide");
        for (const z of [-1, 1]) { const m = extrude(p.poly, 0.002, "slide", [], 0.0006); m.position.z = z * (p.depth / 2); s.add(m); }
        const y = (p.poly[0][1] + p.poly[2][1]) / 2;
        for (const z of [-1, 1]) s.add(box((p.poly[1][0] - p.poly[0][0]) * 0.7, 0.0018, 0.0008, (p.poly[0][0] + p.poly[1][0]) / 2, y, z * (p.depth / 2 + 0.0012), "procdisplay"));
        break;
      }
      case "cyl": buildCylinder(G("magazine"), d, p.poly); break;
      case "lug": G("barrel").add(lofted(p.poly, "procsteel", { half: () => p.depth / 2, rTop: 0.2, rBot: 0.6, segs: 2, n: 10 })); break;
    }
  }
  // Revólver sin tetón completo: varilla expulsora bajo el cañón
  if (rev && d.cyl!.lug !== "full") { const rf = revFrame(d); G("barrel").add(tube(0.0028, Math.min(d.barrel.ext * 0.8, 0.012 + d.barrel.ext * 0.7), rf.xc1, rf.cy, "procsteel", 8)); }
  for (const o of group.children) o.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
  const [mx, my] = muzzleOf(d);
  return { group, parts: Object.entries(roles).map(([role, object]) => ({ object, role: role as PartRole })), muzzle: new THREE.Vector3(mx, my, 0), sightY, railAt, railLength };
}

/** Armazón superior del revólver: ventana del tambor, puente con muesca de mira y marcaje. */
function buildRevolverFrame(g: THREE.Object3D, d: PistolDesign, poly: Pt[], depth: number) {
  const rf = revFrame(d), c = d.cyl!;
  // Por secciones, redondeado arriba (puente) y abajo, con la ventana del tambor abierta
  g.add(lofted(poly, "frame", { half: () => depth / 2, rTop: 0.65, rBot: 0.45, segs: 2, n: 24, wear: 1.22, hole: { x0: rf.xc0 - 0.0005, x1: rf.xc1 + 0.0005, y0: rf.cy - c.r - 0.0008, y1: rf.cy + c.r + 0.0008 } }));
  g.add(box(0.008, 0.0016, 0.004, 0.012, rf.top + 0.0004, 0, "procpad")); // muesca de mira en el puente
  g.add(box(rf.xf - 0.01, 0.0008, 0.0006, rf.xf / 2, rf.top - 0.003, -(depth / 2 + 0.0002), "procengrave"));
}
/** Tambor del revólver: cilindro con acanaladuras, recámaras en la cara delantera y estrella detrás. */
function buildCylinder(g: THREE.Object3D, d: PistolDesign, poly: Pt[]) {
  const c = d.cyl!, x0 = poly[0][0], x1 = poly[1][0], y = (poly[0][1] + poly[2][1]) / 2;
  g.add(tube(c.r, x1 - x0, x0, y, "procsteel", 18));
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    const fl = box((x1 - x0) * 0.6, 0.0035, 0.0035, (x0 + x1) / 2 + 0.002, y + Math.cos(a) * c.r * 0.96, Math.sin(a) * c.r * 0.96, "procpad"); fl.rotation.x = a; g.add(fl);
    const ch = new THREE.Mesh(new THREE.CylinderGeometry(c.r * 0.22, c.r * 0.22, 0.0012, 8), mat("procpad"));
    ch.rotation.z = -Math.PI / 2; ch.position.set(x1 + 0.0004, y + Math.cos(a + Math.PI / 6) * c.r * 0.58, Math.sin(a + Math.PI / 6) * c.r * 0.58); g.add(ch);
  }
  g.add(tube(c.r * 0.35, 0.004, x0 - 0.003, y, "procmetal", 6));
}
/** Cargador con su base en relieve (y, en el de tambor, el disco con anillo y llave de carga). */
function buildMag(g: THREE.Object3D, d: PistolDesign, poly: Pt[], depth: number) {
  if (d.mag.kind === "drum" && poly.length > 10) {
    const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
    const R = Math.hypot(poly[0][0] - cx, poly[0][1] - cy);
    g.add(disc(R, depth, cx, cy, 0, "magazine", 18));
    for (const z of [-1, 1]) { g.add(disc(R * 0.8, 0.0015, cx, cy, z * (depth / 2 + 0.0006), "procpad", 18)); g.add(disc(R * 0.14, 0.003, cx, cy, z * (depth / 2 + 0.0018), "procmetal", 8)); g.add(box(R * 0.5, 0.004, 0.0025, cx, cy, z * (depth / 2 + 0.003), "procmetal")); }
    return;
  }
  const quad = poly.length === 4;
  // Cuerpo del cargador por secciones a lo largo de su eje (cantos redondeados); el curvo, extruido
  g.add(quad ? lofted(poly, "magazine", { origin: [(poly[0][0] + poly[1][0]) / 2, (poly[0][1] + poly[1][1]) / 2], angle: downAxis(magFrame(d).a), half: () => depth / 2, rTop: 0.3, rBot: 0.3, segs: 1, n: 6 }) : extrude(poly, depth, "magazine", [], 0.0008));
  if (quad && d.mag.kind !== "flush" && d.mag.kind !== "drum") {
    // Orificios testigo en un lado
    const n = d.mag.kind === "stick" || d.mag.kind === "front" ? 4 : 2;
    for (let k = 0; k < n; k++) { const t = 0.25 + (k / n) * 0.6; const x = poly[0][0] + (poly[3][0] - poly[0][0]) * t + (poly[1][0] - poly[0][0]) * 0.4, y = poly[0][1] + (poly[3][1] - poly[0][1]) * t + (poly[1][1] - poly[0][1]) * 0.4; g.add(disc(0.0014, 0.0008, x, y, -(depth / 2 + 0.0002), "procpad", 6)); }
  }
  // Base del cargador: más ancha, con labio (el cuello del tambor no la lleva: encaja en el brocal)
  if (d.mag.kind === "drum") return;
  const half = Math.floor(poly.length / 2);
  const p0 = quad ? poly[3] : poly[half], p1 = quad ? poly[2] : poly[half - 1];
  const ang = d.mag.kind === "curved" ? magFrame(d).a - 0.6 : magFrame(d).a, ox = Math.sin(ang) * 0.0045, oy = Math.cos(ang) * 0.0045;
  const ex = 0.0015 * Math.cos(ang), ey = -0.0015 * Math.sin(ang);
  // Orden del contorno: el que sigue a p0→p1 en el polígono (antihorario) y bajando
  const plate: Pt[] = [[p1[0] + ex, p1[1] + ey], [p0[0] - ex, p0[1] - ey], [p0[0] - ex - ox, p0[1] - ey - oy], [p1[0] + ex - ox, p1[1] + ey - oy]];
  g.add(extrude(plate, depth * 1.25, "procpad", [], 0.0008));
}
