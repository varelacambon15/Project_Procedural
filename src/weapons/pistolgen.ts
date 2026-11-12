// Pistolas modulares generadas por código (solo datos, sin Three.js): un diseño con parámetros por pieza —armazón,
// corredera, cañón, empuñadura, cargador, guardamonte, martillo y detalles de era— del que salen sus polígonos de perfil,
// su silueta, sus medidas y sus puntos de montaje. La malla la construye pistolmesh.ts a partir de este mismo diseño.
// Coordenadas: metros; x = 0 en la trasera de la corredera, +X hacia la boca; y = 0 en la base de la corredera.
import type { Rng } from "./rng";
import type { Profile } from "./variation";
import type { AssetEntry } from "./types";

export type PEra = "classic" | "modern" | "rustic" | "scifi";
export interface PistolDesign {
  v: 1;
  /** Arquetipo del que sale (su "base") y era. */
  arch: string; era: PEra;
  slide: { len: number; h: number; w: number; nose: "flat" | "bevel" | "step" | "taper"; rear?: "square" | "slant" | "round"; serr: 0 | 1 | 2; port: boolean; cuts: number; top: "iron" | "rail" | "rib" | "optic"; fins: boolean; open?: boolean };
  barrel: { ext: number; d: number; comp: "none" | "block" | "ported"; shroud: boolean };
  frame: { dust: number; h: number; rail: boolean; guard: "round" | "square" | "hook"; full?: boolean; vgrip?: "none" | "vertical" | "angled" };
  grip: { angle: number; len: number; depth: number; shape: "straight" | "flared" | "hump"; panels: "none" | "wood" | "polymer" | "tape"; butt: "flat" | "lanyard" | "heel" };
  mag: { kind: "flush" | "ext" | "stick" | "drum"; len: number };
  hammer: "none" | "spur" | "ring";
  extra: { cell: boolean; rivets: boolean; wrap: boolean };
}

// ---------- Arquetipos (bases) ----------
type Arch = { id: string; label: string; eras: PEra[]; d: Omit<PistolDesign, "v" | "arch" | "era"> };
type Over = { slide?: Partial<PistolDesign["slide"]>; barrel?: Partial<PistolDesign["barrel"]>; frame?: Partial<PistolDesign["frame"]>; grip?: Partial<PistolDesign["grip"]>; mag?: Partial<PistolDesign["mag"]>; extra?: Partial<PistolDesign["extra"]>; hammer?: PistolDesign["hammer"] };
const base = (o: Over): Arch["d"] => ({
  slide: { len: 0.185, h: 0.032, w: 0.025, nose: "bevel", serr: 1, port: true, cuts: 0, top: "iron", fins: false, ...o.slide },
  barrel: { ext: 0, d: 0.013, comp: "none", shroud: false, ...o.barrel },
  frame: { dust: 0.78, h: 0.019, rail: false, guard: "square", ...o.frame },
  grip: { angle: 0.3, len: 0.105, depth: 0.044, shape: "straight", panels: "polymer", butt: "flat", ...o.grip },
  mag: { kind: "flush", len: 0, ...o.mag },
  hammer: o.hammer ?? "none",
  extra: { cell: false, rivets: false, wrap: false, ...o.extra },
});
export const PISTOL_ARCHES: Arch[] = [
  { id: "service", label: "Service", eras: ["modern", "rustic"], d: base({ frame: { rail: true } }) },
  { id: "compact", label: "Compact", eras: ["modern", "rustic", "classic"], d: base({ slide: { len: 0.155, h: 0.03 }, grip: { len: 0.085 }, frame: { dust: 0.8 } }) },
  { id: "target", label: "Target", eras: ["modern", "classic"], d: base({ slide: { len: 0.225, h: 0.03, nose: "flat" }, barrel: { ext: 0.025 }, grip: { shape: "flared" } }) },
  { id: "heavy", label: "Heavy", eras: ["modern", "scifi"], d: base({ slide: { len: 0.21, h: 0.04, w: 0.032, nose: "step" }, barrel: { d: 0.018 }, frame: { h: 0.022, rail: true }, grip: { len: 0.115, depth: 0.05 } }) },
  { id: "machine", label: "Machine", eras: ["modern", "scifi", "rustic"], d: base({ slide: { len: 0.175, nose: "taper", rear: "slant" }, barrel: { comp: "ported", ext: 0.008 }, mag: { kind: "stick", len: 0.07 }, frame: { guard: "hook" } }) },
  { id: "officer", label: "Officer", eras: ["classic"], d: base({ slide: { len: 0.2, h: 0.031, nose: "step", rear: "round", port: true }, hammer: "spur", grip: { angle: 0.32, panels: "wood", shape: "hump" }, frame: { guard: "round", dust: 0.7 } }) },
  { id: "pocket", label: "Pocket", eras: ["classic", "rustic"], d: base({ slide: { len: 0.14, h: 0.027, nose: "taper", rear: "round", serr: 2 }, grip: { len: 0.075, panels: "wood" }, hammer: "ring", frame: { guard: "round" } }) },
  { id: "pipe", label: "Pipe", eras: ["rustic"], d: base({ slide: { len: 0.17, h: 0.034, nose: "flat", serr: 0, port: false }, barrel: { ext: 0.04, d: 0.016 }, grip: { panels: "tape", angle: 0.22 }, extra: { rivets: true, wrap: true }, frame: { guard: "square" } }) },
  { id: "vector", label: "Vector", eras: ["scifi"], d: base({ slide: { len: 0.19, h: 0.036, nose: "bevel", rear: "slant", fins: true, top: "optic" }, barrel: { shroud: true, ext: 0.02 }, extra: { cell: true }, grip: { angle: 0.24, shape: "flared" } }) },
];
export const archOf = (id: string) => PISTOL_ARCHES.find((a) => a.id === id) ?? PISTOL_ARCHES[0];
export const archIdOf = (assetId: string) => assetId.replace(/^pp-/, "").split("-")[0];

/** Diseño por defecto de un arquetipo en una era (la "base" con la que se mide el parecido). */
export function archDesign(archId: string, era: PEra): PistolDesign {
  const a = archOf(archId);
  const d: PistolDesign = { v: 1, arch: a.id, era, ...structuredClone(a.d) };
  // Acabado de era (solo aspecto): clásica con madera y remaches; rústica con cinta; sci-fi con celda y aletas
  if (era === "classic" && d.grip.panels === "polymer") d.grip.panels = "wood";
  if (era === "rustic") { d.extra.wrap = true; if (d.grip.panels === "polymer") d.grip.panels = "tape"; }
  if (era === "scifi") { d.extra.cell = true; d.slide.fins = true; }
  return d;
}

// ---------- Mutaciones (los cambios del arma respecto a su arquetipo) ----------
export interface Mutation { id: string; run: (d: PistolDesign, r: Rng, amp: number) => void }
const away = (r: Rng, lo: number, hi: number, min: number) => { for (let i = 0; i < 12; i++) { const f = lo + r() * (hi - lo); if (Math.abs(f - 1) >= min) return f; } return r() < 0.5 ? lo : hi; };
export const PISTOL_MUTATIONS: Mutation[] = [
  { id: "slide-len", run: (d, r, a) => (d.slide.len = Math.min(0.27, Math.max(0.13, d.slide.len * away(r, 1 - 0.2 * a, 1 + 0.3 * a, 0.1)))) },
  { id: "slide-h", run: (d, r, a) => (d.slide.h = Math.min(0.045, Math.max(0.025, d.slide.h * away(r, 1 - 0.12 * a, 1 + 0.2 * a, 0.07)))) },
  { id: "barrel-ext", run: (d, r, a) => (d.barrel.ext = d.barrel.ext > 0.012 ? 0 : 0.015 + r() * 0.04 * a) },
  { id: "comp", run: (d, r) => (d.barrel.comp = d.barrel.comp === "none" ? (r() < 0.5 ? "block" : "ported") : "none") },
  { id: "dust", run: (d, r) => (d.frame.dust = d.frame.dust > 0.8 ? 0.62 + r() * 0.1 : 0.86 + r() * 0.1) },
  { id: "guard", run: (d, r) => (d.frame.guard = (["round", "square", "hook"] as const).filter((g) => g !== d.frame.guard)[Math.floor(r() * 2)]) },
  { id: "grip-angle", run: (d, r) => (d.grip.angle = Math.min(0.42, Math.max(0.14, d.grip.angle + (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.06)))) },
  { id: "grip-len", run: (d, r) => (d.grip.len = Math.min(0.14, Math.max(0.07, d.grip.len * away(r, 0.78, 1.28, 0.12)))) },
  { id: "grip-shape", run: (d, r) => (d.grip.shape = (["straight", "flared", "hump"] as const).filter((g) => g !== d.grip.shape)[Math.floor(r() * 2)]) },
  { id: "mag", run: (d, r) => { const k = (["ext", "stick", "drum"] as const)[Math.floor(r() * 3)]; d.mag = { kind: k === d.mag.kind ? "ext" : k, len: k === "stick" ? 0.06 + r() * 0.05 : 0.02 + r() * 0.02 }; } },
  { id: "top", run: (d, r) => (d.slide.top = (["rail", "rib", "optic"] as const).filter((t) => t !== d.slide.top)[Math.floor(r() * 2)]) },
  { id: "hammer", run: (d, r) => (d.hammer = d.hammer === "none" ? (r() < 0.5 ? "spur" : "ring") : "none") },
  { id: "nose", run: (d, r) => (d.slide.nose = (["flat", "bevel", "step", "taper"] as const).filter((n) => n !== d.slide.nose)[Math.floor(r() * 3)]) },
  { id: "rear", run: (d, r) => (d.slide.rear = (["square", "slant", "round"] as const).filter((n) => n !== (d.slide.rear ?? "square"))[Math.floor(r() * 2)]) },
  // Estructurales: corredera abierta (cañón a la vista), armazón hasta la boca y empuñadura delantera en el raíl
  { id: "open-slide", run: (d) => (d.slide.open = !d.slide.open) },
  { id: "frame-full", run: (d) => { d.frame.full = !d.frame.full; if (d.frame.full) d.frame.dust = 1; } },
  { id: "vgrip", run: (d, r) => { d.frame.rail = true; d.frame.vgrip = d.frame.vgrip && d.frame.vgrip !== "none" ? "none" : r() < 0.6 ? "vertical" : "angled"; } },
];
/** Mutaciones que no pegan con una era (sci-fi sin martillo de anilla; clásica sin raíl ni óptica, ni cargador de petaca). */
export function mutationAllowed(id: string, era: PEra, d: PistolDesign) {
  if (era === "classic" && (id === "top" || id === "mag")) return false;
  if (era === "scifi" && id === "hammer") return false;
  if (id === "mag" && d.mag.kind === "stick" && era === "classic") return false;
  if (era === "classic" && id === "vgrip") return false;
  if (id === "open-slide" && (d.slide.top === "optic" || d.slide.fins)) return false;
  return true;
}

// ---------- Geometría de perfil (polígonos por pieza) ----------
export type Pt = [number, number];
export interface PartPoly { role: "slide" | "frame" | "grip" | "guard" | "barrel" | "comp" | "mag" | "hammer" | "top" | "rail" | "cell" | "vgrip"; poly: Pt[]; depth: number }
export const boreY = (d: PistolDesign) => d.slide.h * 0.42;
/** Esquinas de la empuñadura (arriba atrás, arriba delante, abajo delante, abajo atrás). */
export function gripCorners(d: PistolDesign) {
  const fh = d.frame.h, a = d.grip.angle, L = d.grip.len, dx = -Math.sin(a) * L, dy = -Math.cos(a) * L;
  const x0 = 0.008, fl = d.grip.shape === "flared" ? 0.005 : 0;
  const TB: Pt = [x0, -fh], TF: Pt = [x0 + d.grip.depth, -fh], BF: Pt = [TF[0] + dx + fl, TF[1] + dy], BB: Pt = [TB[0] + dx - fl, TB[1] + dy];
  return { TB, TF, BF, BB };
}
export function designPolys(d: PistolDesign): PartPoly[] {
  const L = d.slide.len, h = d.slide.h, w = d.slide.w, fh = d.frame.h, by = boreY(d);
  const out: PartPoly[] = [];
  // Corredera (con chaflán delantero según el morro)
  const nose: Pt[] = d.slide.nose === "bevel" ? [[L, h * 0.62], [L - 0.012, h]] : d.slide.nose === "step" ? [[L, h * 0.55], [L - 0.018, h * 0.55], [L - 0.018, h]]
    : d.slide.nose === "taper" ? [[L, h * 0.72], [L * 0.45, h]] : [[L, h]];
  // Trasera: recta, inclinada o redondeada (estilo clásico)
  const rear: Pt[] = d.slide.rear === "slant" ? [[0.012, h], [0, h * 0.35]] : d.slide.rear === "round" ? [[0.008, h], [0.002, h * 0.85], [0, h * 0.6]] : [[0.004, h], [0, h * 0.8]];
  if (d.slide.open) {
    // Corredera abierta: el tramo delantero se rebaja hasta el cañón (que queda a la vista)
    const xa = L * 0.38, xb = L - 0.018;
    out.push({ role: "slide", depth: w, poly: [[0, 0], [L, 0], [L, h * 0.58], [xb, h * 0.58], [xb - 0.006, h * 0.36], [xa + 0.01, h * 0.36], [xa, h], ...rear] });
    out.push({ role: "barrel", depth: d.barrel.d, poly: [[xa, by - d.barrel.d / 2], [L, by - d.barrel.d / 2], [L, by + d.barrel.d / 2], [xa, by + d.barrel.d / 2]] });
  } else out.push({ role: "slide", depth: w, poly: [[0, 0], [L, 0], ...nose, ...rear] });
  // Armazón bajo la corredera (cubrepolvo hasta `dust`)
  const fx = d.frame.full ? L + Math.max(0, d.barrel.ext) : L * d.frame.dust;
  out.push({ role: "frame", depth: w * 0.88, poly: [[0.004, 0], [fx, 0], [fx, -fh * 0.55], [fx - 0.006, -fh], [0.004, -fh]] });
  // Empuñadura
  const g = gripCorners(d);
  const grip: Pt[] = [g.TB, g.TF, g.BF, g.BB];
  if (d.grip.shape === "hump") grip.splice(0, 0, [g.TB[0] - 0.014, -fh * 0.15]);
  out.push({ role: "grip", depth: w * 1.02, poly: grip });
  // Guardamonte
  const gx = g.TF[0], gl = 0.05, gd = 0.023;
  out.push({ role: "guard", depth: w * 0.45, poly: d.frame.guard === "round" ? [[gx, -fh], [gx + gl, -fh], [gx + gl, -fh - gd * 0.5], [gx + gl * 0.8, -fh - gd], [gx + 0.006, -fh - gd]]
    : d.frame.guard === "hook" ? [[gx, -fh], [gx + gl, -fh], [gx + gl + 0.006, -fh - gd * 0.75], [gx + gl - 0.004, -fh - gd], [gx + 0.006, -fh - gd]]
    : [[gx, -fh], [gx + gl, -fh], [gx + gl, -fh - gd], [gx + 0.006, -fh - gd]] });
  // Cargador por debajo de la empuñadura
  const bottom = (g.BF[1] + g.BB[1]) / 2, mx = (g.BF[0] + g.BB[0]) / 2 + 0.002, mw = d.grip.depth * 0.72, a = d.grip.angle;
  const down = (t: number): Pt => [mx - Math.sin(a) * t, bottom - Math.cos(a) * t];
  if (d.mag.kind === "drum") {
    const c = down(0.028), R = 0.027, poly: Pt[] = [];
    for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; poly.push([c[0] + Math.cos(t) * R, c[1] + Math.sin(t) * R]); }
    out.push({ role: "mag", depth: w * 1.15, poly });
  } else {
    const len = d.mag.kind === "flush" ? 0.006 : d.mag.len;
    const p0 = down(-0.004), p1 = down(len);
    const ox = (mw / 2) * Math.cos(a), oy = -(mw / 2) * Math.sin(a);
    out.push({ role: "mag", depth: w * 0.62, poly: [[p0[0] - ox, p0[1] - oy], [p0[0] + ox, p0[1] + oy], [p1[0] + ox, p1[1] + oy], [p1[0] - ox, p1[1] - oy]] });
  }
  // Cañón que sobresale, compensador y camisa
  let mz = L;
  if (d.barrel.ext > 0) { const r = d.barrel.d / 2 * (d.barrel.shroud ? 1.9 : 1); out.push({ role: "barrel", depth: r * 2, poly: [[L - 0.002, by - r], [L + d.barrel.ext, by - r], [L + d.barrel.ext, by + r], [L - 0.002, by + r]] }); mz = L + d.barrel.ext; }
  if (d.barrel.comp !== "none") { const cl = d.barrel.comp === "ported" ? 0.032 : 0.024; out.push({ role: "comp", depth: w * 0.9, poly: [[mz - 0.002, by - h * 0.38], [mz + cl, by - h * 0.38], [mz + cl, by + h * 0.42], [mz - 0.002, by + h * 0.5]] }); }
  // Martillo
  if (d.hammer !== "none") out.push({ role: "hammer", depth: w * 0.3, poly: d.hammer === "spur" ? [[-0.013, h * 0.62], [0.002, h * 0.62], [0.002, h * 0.25], [-0.006, h * 0.2]] : [[-0.01, h * 0.72], [0.002, h * 0.72], [0.002, h * 0.25], [-0.008, h * 0.3]] });
  // Parte superior de la corredera
  if (d.slide.top === "rail") out.push({ role: "top", depth: w * 0.6, poly: [[L * 0.22, h - 0.001], [L * 0.72, h - 0.001], [L * 0.72, h + 0.007], [L * 0.22, h + 0.007]] });
  if (d.slide.top === "rib") out.push({ role: "top", depth: w * 0.3, poly: [[L * 0.08, h - 0.001], [L * 0.96, h - 0.001], [L * 0.96, h + 0.004], [L * 0.08, h + 0.004]] });
  if (d.slide.top === "optic") out.push({ role: "top", depth: w * 0.85, poly: [[L * 0.22, h - 0.001], [L * 0.52, h - 0.001], [L * 0.5, h + 0.026], [L * 0.26, h + 0.026]] });
  // Raíl bajo el cubrepolvo
  if (d.frame.rail) out.push({ role: "rail", depth: w * 0.7, poly: [[fx - 0.052, -fh - 0.006], [fx - 0.006, -fh - 0.006], [fx - 0.006, -fh + 0.001], [fx - 0.052, -fh + 0.001]] });
  // Empuñadura delantera en el raíl del armazón: vertical o angulada
  if (d.frame.vgrip && d.frame.vgrip !== "none") {
    const x = fx - 0.03, top = -fh - 0.005;
    out.push({ role: "vgrip", depth: w * 0.9, poly: d.frame.vgrip === "vertical" ? [[x - 0.012, top], [x + 0.012, top], [x + 0.01, top - 0.055], [x - 0.012, top - 0.055]] : [[x - 0.03, top], [x + 0.012, top], [x - 0.004, top - 0.028], [x - 0.03, top - 0.012]] });
  }
  // Celda de energía (sci-fi): bajo el cubrepolvo, delante del guardamonte
  if (d.extra.cell) out.push({ role: "cell", depth: w * 0.8, poly: [[gx + gl + 0.004, -fh - 0.002], [fx - 0.004, -fh - 0.002], [fx - 0.004, -fh - 0.016], [gx + gl + 0.008, -fh - 0.016]] });
  return out;
}

/** Corte vertical de un polígono en x: [abajo, arriba] o null. */
function cutAt(poly: Pt[], x: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    if ((x < Math.min(x1, x2)) || (x > Math.max(x1, x2))) continue;
    const y = x1 === x2 ? null : y1 + ((x - x1) / (x2 - x1)) * (y2 - y1);
    for (const v of y === null ? [y1, y2] : [y]) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  return lo <= hi ? [lo, hi] : null;
}
export function designBounds(d: PistolDesign) {
  const pts = designPolys(d).flatMap((p) => p.poly);
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
}
/** Perfil lateral (silueta) del diseño, en el mismo formato que los perfiles de los modelos. */
export function designProfile(d: PistolDesign, N = 40): Profile {
  const polys = designPolys(d), b = designBounds(d);
  const top: (number | null)[] = [], bot: (number | null)[] = [];
  for (let k = 0; k < N; k++) {
    const x = b.x0 + ((b.x1 - b.x0) * (k + 0.5)) / N;
    let lo = Infinity, hi = -Infinity;
    for (const p of polys) { const c = cutAt(p.poly, x); if (c) { lo = Math.min(lo, c[0]); hi = Math.max(hi, c[1]); } }
    top.push(hi > -Infinity ? hi : null); bot.push(lo < Infinity ? lo : null);
  }
  return { x0: b.x0, x1: b.x1, top, bot };
}
export function muzzleOf(d: PistolDesign): [number, number] {
  return [d.slide.len + d.barrel.ext + (d.barrel.comp === "none" ? 0 : d.barrel.comp === "ported" ? 0.032 : 0.024), boreY(d)];
}

/** Recurso virtual para el generador y el ensamblador: perfil, medidas y puntos de montaje del diseño. */
export function designEntry(id: string, d: PistolDesign): AssetEntry {
  const b = designBounds(d), w = d.slide.w;
  const [mx, my] = muzzleOf(d);
  const g = gripCorners(d);
  const magTop: [number, number, number] = [(g.BF[0] + g.BB[0]) / 2, (g.BF[1] + g.BB[1]) / 2, 0];
  return {
    id, label: archOf(d.arch).label, pack: "proc-pistol", type: "pistol", file: "", triangles: 0,
    parts: [{ role: "slide", node: "slide", source: "proc" }, { role: "frame", node: "frame", source: "proc" }, { role: "grip", node: "grip", source: "proc" }, { role: "magazine", node: "mag", source: "proc" },
      ...(d.slide.top === "optic" ? [{ role: "scope" as const, node: "top", source: "proc" }] : [])],
    sockets: {
      muzzle: { pos: [mx, my, 0], diameter: d.barrel.d },
      magazine: { pos: magTop, size: [d.grip.depth * 0.72, 0.1] },
      top: { pos: [d.slide.len * 0.45, d.slide.h, 0] },
      ...(d.slide.top === "rail" ? { rail: { pos: [d.slide.len * 0.47, d.slide.h + 0.007, 0], length: d.slide.len * 0.5 } } : {}),
    } as AssetEntry["sockets"],
    bounds: { min: [b.x0, b.y0, -w / 2], max: [b.x1, b.y1, w / 2] },
    profiles: { body: designProfile(d) },
  };
}

/** Clave estable de un diseño (para registrar su recurso virtual y comparar armas). */
export function designKey(d: PistolDesign) {
  const s = JSON.stringify(d); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `pp-${d.arch}-${d.era}-${(h >>> 0).toString(36)}`;
}
