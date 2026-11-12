// Pistolas y revólveres modulares generados por código (solo datos, sin Three.js): un diseño con parámetros por pieza
// —corredera o puente, armazón, cañón, empuñadura, cargador o tambor, guardamonte, martillo y detalles de era— del que
// salen sus polígonos de perfil, su silueta, sus medidas y sus puntos de montaje. La malla la construye pistolmesh.ts a
// partir de este mismo diseño.
// Coordenadas: metros; x = 0 en la trasera de la corredera (o del armazón del revólver), +X hacia la boca;
// y = 0 en la base de la corredera (encima del armazón).
import type { Rng } from "./rng";
import type { Profile } from "./variation";
import type { AssetEntry } from "./types";

export type PEra = "classic" | "modern" | "rustic" | "scifi";
/** Familia estructural: de corredera (semi, auto o ráfaga), cargador delante del guardamonte, carbina de pistola y revólver. */
export type PFamily = "auto" | "frontmag" | "carbine" | "revolver";
export type SlideStyle = "slab" | "round" | "stepped" | "open" | "tube" | "shroud";
export type MagKind = "flush" | "ext" | "stick" | "curved" | "drum" | "front" | "none";
export type GripShape = "straight" | "flared" | "hump" | "raked" | "bird";
export interface PistolDesign {
  v: 2;
  /** Arquetipo del que sale (su "base"), era y familia. */
  arch: string; era: PEra; family: PFamily;
  slide: { len: number; h: number; w: number; style: SlideStyle; nose: "flat" | "bevel" | "step" | "taper"; rear: "square" | "slant" | "round"; serr: 0 | 1 | 2; port: boolean; cuts: number; top: "iron" | "high" | "rail" | "rib" | "optic"; fins: boolean };
  barrel: { ext: number; d: number; comp: "none" | "block" | "ported"; shroud: boolean; profile: "round" | "bull" | "fluted"; guard?: boolean };
  frame: { dust: number; h: number; rail: boolean; guard: "round" | "square" | "hook"; full?: boolean; vgrip?: "none" | "vertical" | "angled" };
  grip: { angle: number; len: number; depth: number; shape: GripShape; panels: "none" | "wood" | "polymer" | "tape"; butt: "flat" | "lanyard" | "heel" };
  mag: { kind: MagKind; len: number };
  /** Revólver: tambor (radio y largo), tetón bajo el cañón, banda superior y calibre. */
  cyl?: { r: number; len: number; lug: "none" | "half" | "full"; rib: "none" | "solid" | "vent"; cal: RevolverCal };
  hammer: "none" | "spur" | "ring" | "bobbed";
  extra: { cell: boolean; rivets: boolean; wrap: boolean; patch?: boolean; fairing?: boolean };
}
export type RevolverCal = "light" | "medium" | "heavy" | "magnum";
/** Medidas por calibre de revólver (radio y largo del tambor, diámetro del cañón, alto del armazón). */
export const REVOLVER_CAL: Record<RevolverCal, { r: number; len: number; d: number; h: number }> = {
  light: { r: 0.0155, len: 0.034, d: 0.012, h: 0.017 },
  medium: { r: 0.0185, len: 0.04, d: 0.014, h: 0.019 },
  heavy: { r: 0.021, len: 0.045, d: 0.017, h: 0.021 },
  magnum: { r: 0.0245, len: 0.052, d: 0.02, h: 0.023 },
};

// ---------- Arquetipos (bases) ----------
type Arch = { id: string; label: string; family: PFamily; eras: PEra[]; d: Omit<PistolDesign, "v" | "arch" | "era" | "family"> };
type Over = { slide?: Partial<PistolDesign["slide"]>; barrel?: Partial<PistolDesign["barrel"]>; frame?: Partial<PistolDesign["frame"]>; grip?: Partial<PistolDesign["grip"]>; mag?: Partial<PistolDesign["mag"]>; extra?: Partial<PistolDesign["extra"]>; hammer?: PistolDesign["hammer"]; cyl?: Partial<NonNullable<PistolDesign["cyl"]>> };
const base = (o: Over): Arch["d"] => ({
  // Proporciones de pistola real: corredera ~0,19 × 0,032, armazón 0,019, empuñadura ~0,1 a unos 17°
  slide: { len: 0.19, h: 0.032, w: 0.025, style: "slab", nose: "bevel", rear: "square", serr: 1, port: true, cuts: 0, top: "iron", fins: false, ...o.slide },
  barrel: { ext: 0, d: 0.013, comp: "none", shroud: false, profile: "round", ...o.barrel },
  frame: { dust: 0.8, h: 0.019, rail: false, guard: "square", ...o.frame },
  grip: { angle: 0.3, len: 0.1, depth: 0.045, shape: "straight", panels: "polymer", butt: "flat", ...o.grip },
  mag: { kind: "flush", len: 0, ...o.mag },
  hammer: o.hammer ?? "none",
  extra: { cell: false, rivets: false, wrap: false, ...o.extra },
});
const rev = (cal: RevolverCal, len: number, o: Over = {}): Arch["d"] => {
  const c = REVOLVER_CAL[cal];
  const d = base({ ...o, slide: { len: c.len + 0.045, h: c.r * 2 + 0.008, w: 0.02, style: "round", nose: "flat", rear: "round", serr: 0, port: false, top: "iron", ...o.slide },
    barrel: { ext: len, d: c.d, profile: "round", ...o.barrel }, frame: { dust: 1, h: c.h, guard: "round", ...o.frame },
    grip: { angle: 0.42, len: 0.088, depth: 0.036, shape: "bird", panels: "wood", ...o.grip }, mag: { kind: "none", len: 0 }, hammer: o.hammer ?? "spur" });
  d.cyl = { r: c.r, len: c.len, lug: "none", rib: "none", ...o.cyl, cal };
  return d;
};
export const PISTOL_ARCHES: Arch[] = [
  // Semiautomáticas, automáticas y de ráfaga, de corredera
  { id: "service", label: "Service", family: "auto", eras: ["modern", "rustic"], d: base({ frame: { rail: true } }) },
  { id: "compact", label: "Compact", family: "auto", eras: ["modern", "rustic", "classic"], d: base({ slide: { len: 0.16, h: 0.031 }, grip: { len: 0.082 }, frame: { dust: 0.8 } }) },
  { id: "target", label: "Target", family: "auto", eras: ["modern", "classic"], d: base({ slide: { len: 0.21, h: 0.029, nose: "flat", top: "rib" }, barrel: { ext: 0.035, profile: "bull" }, grip: { shape: "flared", angle: 0.24 } }) },
  { id: "heavy", label: "Heavy", family: "auto", eras: ["modern", "scifi"], d: base({ slide: { len: 0.235, h: 0.043, w: 0.033, nose: "step" }, barrel: { d: 0.02, profile: "bull", ext: 0.018, comp: "block" }, frame: { h: 0.024, rail: true, guard: "hook" }, grip: { len: 0.118, depth: 0.054, shape: "hump" }, mag: { kind: "ext", len: 0.016 } }) },
  { id: "machine", label: "Machine", family: "auto", eras: ["modern", "scifi", "rustic"], d: base({ slide: { len: 0.175, nose: "taper", rear: "slant" }, barrel: { comp: "ported", ext: 0.008 }, mag: { kind: "stick", len: 0.095 }, frame: { guard: "hook", rail: true, vgrip: "vertical", dust: 0.95 } }) },
  { id: "burst", label: "Burst", family: "auto", eras: ["modern", "scifi"], d: base({ slide: { len: 0.2, h: 0.034, nose: "bevel", top: "rail", serr: 2 }, barrel: { comp: "block", ext: 0.012 }, mag: { kind: "ext", len: 0.03 }, frame: { guard: "hook", rail: true, vgrip: "angled" } }) },
  { id: "officer", label: "Officer", family: "auto", eras: ["classic"], d: base({ slide: { len: 0.2, h: 0.03, style: "stepped", nose: "step", rear: "round" }, hammer: "spur", grip: { angle: 0.3, panels: "wood", shape: "hump" }, frame: { guard: "round", dust: 0.7 } }) },
  { id: "pocket", label: "Pocket", family: "auto", eras: ["classic", "rustic"], d: base({ slide: { len: 0.14, h: 0.027, style: "round", nose: "taper", rear: "round", serr: 2 }, grip: { len: 0.072, panels: "wood" }, hammer: "ring", frame: { guard: "round" } }) },
  { id: "pipe", label: "Pipe", family: "auto", eras: ["rustic"], d: base({ slide: { len: 0.17, h: 0.032, style: "tube", nose: "flat", serr: 0, port: false }, barrel: { ext: 0.04, d: 0.016 }, grip: { panels: "tape", angle: 0.22, shape: "raked" }, extra: { rivets: true, wrap: true, patch: true }, frame: { guard: "square" } }) },
  { id: "vector", label: "Vector", family: "auto", eras: ["scifi"], d: base({ slide: { len: 0.2, h: 0.036, style: "shroud", nose: "taper", rear: "slant", fins: true, top: "optic" }, barrel: { shroud: true, ext: 0.02 }, extra: { cell: true, fairing: true }, grip: { angle: 0.24, shape: "flared" } }) },
  // Cargador delante del guardamonte (empuñadura sin cargador, inclinada)
  { id: "broom", label: "Broom", family: "frontmag", eras: ["classic", "rustic"], d: base({ slide: { len: 0.2, h: 0.034, style: "round", nose: "step", rear: "round", top: "high", serr: 1 }, barrel: { ext: 0.06, d: 0.012 }, frame: { dust: 1, guard: "round" }, grip: { angle: 0.5, len: 0.095, shape: "raked", panels: "wood" }, mag: { kind: "front", len: 0.06 }, hammer: "ring" }) },
  { id: "lancer", label: "Lancer", family: "frontmag", eras: ["scifi", "modern"], d: base({ slide: { len: 0.21, h: 0.036, style: "shroud", nose: "bevel", rear: "slant", top: "rail" }, barrel: { ext: 0.03, shroud: true }, frame: { dust: 1, guard: "hook", rail: true }, grip: { angle: 0.36, shape: "flared" }, mag: { kind: "front", len: 0.075 } }) },
  // Carbina de pistola: cañón largo con guardamanos
  { id: "carbine", label: "Carbine", family: "carbine", eras: ["modern", "scifi", "rustic"], d: base({ slide: { len: 0.2, top: "rail" }, barrel: { ext: 0.13, d: 0.014, guard: true }, mag: { kind: "ext", len: 0.035 } }) },
  // Revólveres por calibre (ligero, medio, pesado y mágnum)
  { id: "rlight", label: "Snub", family: "revolver", eras: ["classic", "modern", "rustic"], d: rev("light", 0.05, { hammer: "bobbed" }) },
  { id: "rmedium", label: "Revolver", family: "revolver", eras: ["classic", "modern", "rustic"], d: rev("medium", 0.1, { cyl: { lug: "half", rib: "solid" } }) },
  { id: "rheavy", label: "Heavy Revolver", family: "revolver", eras: ["modern", "rustic", "scifi"], d: rev("heavy", 0.13, { cyl: { lug: "full", rib: "solid" }, grip: { shape: "flared", panels: "polymer", angle: 0.36 } }) },
  { id: "rmagnum", label: "Magnum", family: "revolver", eras: ["modern", "classic", "scifi"], d: rev("magnum", 0.165, { cyl: { lug: "full", rib: "vent" }, grip: { shape: "flared", panels: "polymer", angle: 0.36, len: 0.096 } }) },
];
export const archOf = (id: string) => PISTOL_ARCHES.find((a) => a.id === id) ?? PISTOL_ARCHES[0];
export const archIdOf = (assetId: string) => assetId.replace(/^pp-/, "").split("-")[0];
/** Arquetipos de un tipo de arma del juego (pistola o revólver). */
export const archesFor = (type: "pistol" | "revolver") => PISTOL_ARCHES.filter((a) => (a.family === "revolver") === (type === "revolver"));

/** Diseño por defecto de un arquetipo en una era (la "base" con la que se mide el parecido). */
export function archDesign(archId: string, era: PEra): PistolDesign {
  const a = archOf(archId);
  const d: PistolDesign = { v: 2, arch: a.id, era, family: a.family, ...structuredClone(a.d) };
  // Formas propias de cada era (no solo paleta):
  // clásica: acero pavonado redondeado, madera, martillo; moderna: polímero, raíles, losa con estrías delante;
  // rústica: tubo, remiendos, remaches, cinta; sci-fi: perfiles angulares, carenados, celda.
  if (era === "classic") {
    if (d.grip.panels === "polymer") d.grip.panels = "wood";
    if (d.slide.style === "slab") d.slide.style = "round";
    if (d.hammer === "none") d.hammer = "spur";
    d.frame.rail = false; d.frame.vgrip = "none"; d.frame.guard = "round";
    if (d.slide.top === "rail" || d.slide.top === "optic") d.slide.top = "iron";
  }
  if (era === "modern" && d.family !== "revolver" && d.slide.serr === 1) d.slide.serr = 2;
  if (era === "rustic") { d.extra.wrap = true; d.extra.patch = true; d.extra.rivets = true; if (d.grip.panels === "polymer") d.grip.panels = "tape"; }
  if (era === "scifi") {
    d.extra.cell = d.family !== "revolver"; d.extra.fairing = true; d.slide.fins = d.family !== "revolver";
    if (d.slide.nose === "flat" || d.slide.nose === "step") d.slide.nose = "taper";
    d.slide.rear = "slant"; if (d.hammer !== "none" && d.family !== "revolver") d.hammer = "none";
  }
  return d;
}

// ---------- Mutaciones (los cambios del arma respecto a su arquetipo) ----------
/** `structural`: cambia la silueta de verdad (no solo un largo); las variantes lejanas deben llevar al menos 2. */
export interface Mutation { id: string; structural: boolean; run: (d: PistolDesign, r: Rng, amp: number) => void }
const away = (r: Rng, lo: number, hi: number, min: number) => { for (let i = 0; i < 12; i++) { const f = lo + r() * (hi - lo); if (Math.abs(f - 1) >= min) return f; } return r() < 0.5 ? lo : hi; };
const other = <T,>(r: Rng, list: readonly T[], cur: T) => { const l = list.filter((x) => x !== cur); return l[Math.floor(r() * l.length)]; };
export const PISTOL_MUTATIONS: Mutation[] = [
  // --- Estructurales ---
  { id: "slide-style", structural: true, run: (d, r) => (d.slide.style = other(r, ["slab", "round", "stepped", "open", "tube", "shroud"] as const, d.slide.style)) },
  { id: "mag", structural: true, run: (d, r) => {
    // Clásica: solo cargadores de la época (al ras, largo o delante del guardamonte)
    const k = other(r, d.era === "classic" ? (["flush", "ext", "front"] as const) : (["flush", "ext", "stick", "curved", "drum", "front"] as const), d.mag.kind);
    d.mag = { kind: k, len: k === "stick" ? 0.06 + r() * 0.05 : k === "curved" ? 0.07 + r() * 0.04 : k === "front" ? 0.05 + r() * 0.04 : k === "ext" ? 0.02 + r() * 0.025 : 0 };
    if (k === "front") { d.frame.dust = Math.max(d.frame.dust, 1); d.frame.vgrip = "none"; }
  } },
  { id: "grip-shape", structural: true, run: (d, r) => { d.grip.shape = other(r, ["straight", "flared", "hump", "raked", "bird"] as const, d.grip.shape); if (d.grip.shape === "raked") d.grip.angle = Math.max(d.grip.angle, 0.42); } },
  { id: "guard", structural: true, run: (d, r) => (d.frame.guard = other(r, d.family === "revolver" ? (["round", "square"] as const) : (["round", "square", "hook"] as const), d.frame.guard)) },
  { id: "top", structural: true, run: (d, r) => (d.slide.top = other(r, d.era === "classic" ? (["iron", "high", "rib"] as const) : (["iron", "high", "rail", "rib", "optic"] as const), d.slide.top)) },
  { id: "compact", structural: true, run: (d, _r, a) => { const k = Math.max(0.62, 1 - 0.2 * a); d.slide.len = Math.max(0.12, d.slide.len * k); d.grip.len = Math.max(0.064, d.grip.len * k); d.barrel.ext *= 0.5; } },
  { id: "frame-full", structural: true, run: (d) => { d.frame.full = !d.frame.full; if (d.frame.full) d.frame.dust = 1; } },
  { id: "vgrip", structural: true, run: (d, r) => { d.frame.rail = true; d.frame.vgrip = d.frame.vgrip && d.frame.vgrip !== "none" ? "none" : r() < 0.6 ? "vertical" : "angled"; } },
  { id: "barrel-guard", structural: true, run: (d, r, a) => { d.barrel.guard = !d.barrel.guard; if (d.barrel.guard) d.barrel.ext = Math.max(d.barrel.ext, (0.07 + r() * 0.06) * Math.min(1.6, a)); } },
  { id: "nose", structural: true, run: (d, r) => (d.slide.nose = other(r, ["flat", "bevel", "step", "taper"] as const, d.slide.nose)) },
  { id: "lug", structural: true, run: (d, r) => { if (d.cyl) d.cyl.lug = other(r, ["none", "half", "full"] as const, d.cyl.lug); } },
  // Revólver: cañón con camisa gruesa (tetón completo y banda) o fino de origen
  { id: "rshroud", structural: true, run: (d) => { if (!d.cyl) return; const on = d.barrel.profile !== "bull"; d.barrel.profile = on ? "bull" : "round"; d.cyl.lug = on ? "full" : "none"; d.cyl.rib = on ? "vent" : "none"; } },
  { id: "cyl", structural: true, run: (d, r) => { if (!d.cyl) return; const k = other(r, ["light", "medium", "heavy", "magnum"] as const, d.cyl.cal); const c = REVOLVER_CAL[k]; d.cyl = { ...d.cyl, cal: k, r: c.r, len: c.len }; d.barrel.d = c.d; d.frame.h = c.h; d.slide.h = c.r * 2 + 0.008; d.slide.len = c.len + 0.045; } },
  // --- De medida o detalle ---
  { id: "slide-len", structural: false, run: (d, r, a) => (d.slide.len = Math.min(0.27, Math.max(0.13, d.slide.len * away(r, 1 - 0.2 * a, 1 + 0.3 * a, 0.1)))) },
  { id: "slide-h", structural: false, run: (d, r, a) => (d.slide.h = Math.min(0.045, Math.max(0.025, d.slide.h * away(r, 1 - 0.12 * a, 1 + 0.2 * a, 0.07)))) },
  { id: "barrel-ext", structural: false, run: (d, r, a) => (d.barrel.ext = d.family === "revolver" ? Math.min(0.22, Math.max(0.04, d.barrel.ext * away(r, Math.max(0.3, 1 - 0.45 * a), 1 + 0.6 * a, 0.25))) : d.barrel.ext > 0.012 ? 0 : 0.015 + r() * 0.04 * a) },
  { id: "comp", structural: false, run: (d, r) => (d.barrel.comp = d.barrel.comp === "none" ? (r() < 0.5 ? "block" : "ported") : "none") },
  { id: "dust", structural: false, run: (d, r) => (d.frame.dust = d.frame.dust > 0.8 ? 0.62 + r() * 0.1 : 0.86 + r() * 0.1) },
  { id: "grip-angle", structural: false, run: (d, r) => (d.grip.angle = Math.min(0.55, Math.max(0.14, d.grip.angle + (r() < 0.5 ? -1 : 1) * (0.06 + r() * 0.06)))) },
  { id: "grip-len", structural: false, run: (d, r) => (d.grip.len = Math.min(0.13, Math.max(0.068, d.grip.len * away(r, 0.8, 1.22, 0.1)))) },
  { id: "hammer", structural: false, run: (d, r) => (d.hammer = other(r, ["none", "spur", "ring", "bobbed"] as const, d.hammer)) },
  { id: "barrel-profile", structural: false, run: (d, r) => (d.barrel.profile = other(r, ["round", "bull", "fluted"] as const, d.barrel.profile)) },
  { id: "rear", structural: false, run: (d, r) => (d.slide.rear = other(r, ["square", "slant", "round"] as const, d.slide.rear)) },
  { id: "rib", structural: false, run: (d, r) => { if (d.cyl) d.cyl.rib = other(r, ["none", "solid", "vent"] as const, d.cyl.rib); } },
];
export const STRUCTURAL = new Set(PISTOL_MUTATIONS.filter((m) => m.structural).map((m) => m.id));
const REV_ONLY = new Set(["lug", "cyl", "rib", "rshroud"]);
const AUTO_ONLY = new Set(["slide-style", "mag", "compact", "frame-full", "vgrip", "nose", "dust", "slide-h", "rear", "slide-len", "top", "barrel-guard"]);
/** Mutaciones que no pegan con una era o una familia (clásica sin raíl ni óptica ni petaca; revólver sin cargador…). */
export function mutationAllowed(id: string, era: PEra, d: PistolDesign) {
  const revolver = d.family === "revolver";
  if (revolver ? AUTO_ONLY.has(id) : REV_ONLY.has(id)) return false;
  if (era === "classic" && (id === "vgrip" || id === "frame-full")) return false;
  if (era === "scifi" && id === "hammer") return false;
  if (id === "mag" && d.family === "frontmag") return false; // el cargador frontal es su seña
  if (id === "slide-style" && (d.slide.top === "optic" || d.family === "frontmag")) return false;
  if (id === "barrel-guard" && (d.family === "carbine" || d.slide.style === "open")) return false;
  return true;
}

// ---------- Geometría de perfil (polígonos por pieza) ----------
export type Pt = [number, number];
export type PolyRole = "slide" | "frame" | "grip" | "guard" | "barrel" | "comp" | "mag" | "hammer" | "top" | "rail" | "cell" | "vgrip" | "cyl" | "lug" | "handguard" | "fairing";
export interface PartPoly { role: PolyRole; poly: Pt[]; depth: number }
export const boreY = (d: PistolDesign) => (d.cyl ? d.cyl.r + 0.003 : d.slide.h * 0.42);
/** Esquinas de la empuñadura (arriba atrás, arriba delante, abajo delante, abajo atrás). */
export function gripCorners(d: PistolDesign) {
  const fh = d.frame.h, a = d.grip.angle, L = d.grip.len, dx = -Math.sin(a) * L, dy = -Math.cos(a) * L;
  const x0 = d.family === "revolver" ? -0.004 : 0.008, fl = d.grip.shape === "flared" ? 0.006 : 0;
  // Como en una empuñadura real, el fondo es perpendicular a su eje (no horizontal): el cargador y su base quedan a escuadra
  const TB: Pt = [x0, -fh], TF: Pt = [x0 + d.grip.depth, -fh];
  const BB: Pt = [TB[0] + dx - fl * Math.cos(a), TB[1] + dy + fl * Math.sin(a)];
  const wd = d.grip.depth * Math.cos(a) + fl * 2, BF: Pt = [BB[0] + Math.cos(a) * wd, BB[1] - Math.sin(a) * wd];
  return { TB, TF, BF, BB };
}
/** Contorno de la empuñadura según su forma (lomo curvo, pico de pájaro, cola de castor…). */
export function gripPoly(d: PistolDesign): Pt[] {
  const g = gripCorners(d), fh = d.frame.h;
  const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const back = (t: number, bulge: number): Pt => { const p = lerp(g.TB, g.BB, t); return [p[0] - bulge * Math.cos(d.grip.angle), p[1] + bulge * Math.sin(d.grip.angle)]; };
  // Contorno en sentido antihorario: arriba atrás → arriba delante → abajo delante → abajo atrás → lomo
  switch (d.grip.shape) {
    case "hump": // cola de castor arriba y abultamiento de palma
      return [[g.TB[0] - 0.016, -fh * 0.1], g.TF, g.BF, g.BB, back(0.55, 0.005), back(0.15, 0.002)];
    case "raked": // de escoba: redondeada abajo y atrás
      return [g.TB, g.TF, lerp(g.TF, g.BF, 0.85), [g.BF[0] - 0.006, g.BF[1] - 0.004], lerp(g.BB, g.BF, 0.3), [g.BB[0] - 0.004, g.BB[1] + 0.012], back(0.5, 0.006)];
    case "bird": // pico de pájaro: lomo muy curvo y talón que se cierra hacia delante
      return [g.TB, g.TF, lerp(g.TF, g.BF, 0.45), lerp(g.TF, g.BF, 0.8), [g.BF[0] - 0.006, g.BF[1] + 0.002], lerp(g.BB, g.BF, 0.4), [g.BB[0] - 0.009, g.BB[1] + 0.012], back(0.72, 0.013), back(0.45, 0.012), back(0.2, 0.006)];
    case "flared": return [g.TB, g.TF, g.BF, g.BB, back(0.5, 0.004)];
    default: {
      // Recta de polímero moderna: estrías para los dedos en el frente
      if (d.grip.panels !== "polymer" || d.family === "revolver") return [g.TB, g.TF, g.BF, g.BB];
      const ca = Math.cos(d.grip.angle), sa = Math.sin(d.grip.angle), front = (t: number, o: number): Pt => { const p = lerp(g.TF, g.BF, t); return [p[0] + o * ca, p[1] - o * sa]; };
      return [g.TB, g.TF, front(0.2, 0), front(0.3, 0.0025), front(0.42, 0), front(0.52, 0.0025), front(0.64, 0), front(0.74, 0.0025), front(0.86, 0), g.BF, g.BB];
    }
  }
}
const guardX = (d: PistolDesign) => gripCorners(d).TF[0];
/** Lugar del cargador: base de la empuñadura (o delante del guardamonte), ángulo y ancho. */
export function magFrame(d: PistolDesign) {
  const g = gripCorners(d), fh = d.frame.h, a = d.grip.angle;
  if (d.mag.kind === "front") return { top: [guardX(d) + 0.064, -fh] as Pt, a: 0.06, w: 0.026 };
  return { top: [(g.BF[0] + g.BB[0]) / 2 + 0.002, (g.BF[1] + g.BB[1]) / 2] as Pt, a, w: d.grip.depth * 0.7 };
}
/** Rectángulo a lo largo de un eje inclinado (cargadores). */
function quadAlong(p0: Pt, p1: Pt, w: number, a: number): Pt[] {
  const ox = (w / 2) * Math.cos(a), oy = -(w / 2) * Math.sin(a);
  return [[p0[0] - ox, p0[1] - oy], [p0[0] + ox, p0[1] + oy], [p1[0] + ox, p1[1] + oy], [p1[0] - ox, p1[1] - oy]];
}
/** Revólver: medidas del armazón (inicio y fin del tambor, frente del armazón, alto del puente). */
export function revFrame(d: PistolDesign) {
  const c = d.cyl!, by = boreY(d), xc0 = 0.014, xc1 = xc0 + c.len;
  return { xc0, xc1, xf: xc1 + 0.012, top: by + c.r + 0.005, by };
}
export function designPolys(d: PistolDesign): PartPoly[] {
  const L = d.slide.len, h = d.slide.h, w = d.slide.w, fh = d.frame.h, by = boreY(d);
  const out: PartPoly[] = [];
  const nose: Pt[] = d.slide.nose === "bevel" ? [[L, h * 0.62], [L - 0.012, h]] : d.slide.nose === "step" ? [[L, h * 0.55], [L - 0.018, h * 0.55], [L - 0.018, h]]
    : d.slide.nose === "taper" ? [[L, h * 0.7], [L * 0.5, h]] : [[L, h]];
  const rear: Pt[] = d.slide.rear === "slant" ? [[0.012, h], [0, h * 0.35]] : d.slide.rear === "round" ? [[0.008, h], [0.002, h * 0.85], [0, h * 0.6]] : [[0.004, h], [0, h * 0.8]];
  if (d.family === "revolver") {
    // Revólver: armazón con ventana para el tambor y puente superior; el tambor sobresale a los lados
    const c = d.cyl!, f = revFrame(d), bl = d.barrel.ext, r = d.barrel.d / 2 * (d.barrel.profile === "bull" ? 1.25 : 1);
    // Armazón en una pieza: caja del gatillo, subida bajo el tambor, frente estrecho bajo el cañón, puente fino arriba
    // y escudo trasero redondeado detrás del martillo (la ventana del tambor la abre la malla)
    const gfront = gripCorners(d).TF[0] + 0.05;
    out.push({ role: "frame", depth: w, poly: [[-0.004, -fh], [Math.min(gfront, f.xc1 - 0.006), -fh], [f.xc1 - 0.002, by - c.r - 0.003], [f.xf, by - r * 1.9], [f.xf, f.top - 0.002], [f.xf - 0.004, f.top], [0.012, f.top], [0.003, f.top - 0.006], [-0.005, by + c.r * 0.2], [-0.007, by - c.r * 0.6], [-0.006, 0]] });
    out.push({ role: "cyl", depth: c.r * 2, poly: [[f.xc0, by - c.r], [f.xc1, by - c.r], [f.xc1, by + c.r], [f.xc0, by + c.r]] });
    out.push({ role: "barrel", depth: r * 2, poly: [[f.xf - 0.002, by - r], [f.xf + bl, by - r], [f.xf + bl, by + r], [f.xf - 0.002, by + r]] });
    if (c.lug !== "none") { const lx1 = c.lug === "full" ? f.xf + bl : f.xf + bl * 0.55; out.push({ role: "lug", depth: r * 1.7, poly: [[f.xf - 0.002, by - r * 2.3], [lx1 - 0.004, by - r * 2.3], [lx1, by - r * 1.6], [lx1, by], [f.xf - 0.002, by]] }); }
    if (c.rib !== "none") { const t = c.rib === "vent" ? 0.006 : 0.004; out.push({ role: "top", depth: w * 0.35, poly: [[f.xf - 0.004, by + r - 0.001], [f.xf + bl, by + r - 0.001], [f.xf + bl, by + r + t], [f.xf - 0.004, by + r + t]] }); }
    if (d.barrel.comp !== "none") { const mz = f.xf + bl, cl = d.barrel.comp === "ported" ? 0.032 : 0.024; out.push({ role: "comp", depth: r * 2.4, poly: [[mz - 0.002, by - r * 1.3], [mz + cl, by - r * 1.3], [mz + cl, by + r * 1.4], [mz - 0.002, by + r * 1.5]] }); }
    out.push({ role: "grip", depth: w * 1.15, poly: gripPoly(d) });
  } else {
    const st = d.slide.style;
    if (st === "open") {
      const xa = L * 0.38, xb = L - 0.018;
      out.push({ role: "slide", depth: w, poly: [[0, 0], [L, 0], [L, h * 0.58], [xb, h * 0.58], [xb - 0.006, h * 0.36], [xa + 0.01, h * 0.36], [xa, h], ...rear] });
      out.push({ role: "barrel", depth: d.barrel.d, poly: [[xa, by - d.barrel.d / 2], [L, by - d.barrel.d / 2], [L, by + d.barrel.d / 2], [xa, by + d.barrel.d / 2]] });
    } else if (st === "stepped") {
      // Escalonada: el tramo delantero más bajo (estilo clásico)
      const xs = L * 0.58;
      out.push({ role: "slide", depth: w, poly: [[0, 0], [L, 0], [L, h * 0.8], [xs + 0.008, h * 0.8], [xs, h], ...rear] });
    } else if (st === "shroud") {
      // Carenado sci-fi: la corredera baja por delante y tapa el cubrepolvo, con el frente en cuña
      out.push({ role: "slide", depth: w * 1.05, poly: [[0, 0], [L * 0.55, 0], [L * 0.62, -fh * 0.85], [L, -fh * 0.6], [L, h * 0.62], [L - 0.02, h], ...rear] });
    } else if (st === "tube") {
      // Tubo (rústica): corredera cilíndrica
      out.push({ role: "slide", depth: h, poly: [[0, 0], [L, 0], [L, h], [0.004, h], [0, h * 0.8]] });
    } else out.push({ role: "slide", depth: w, poly: [[0, 0], [L, 0], ...nose, ...rear] });
    const fx = d.frame.full ? L + Math.max(0, d.barrel.ext) : L * d.frame.dust;
    out.push({ role: "frame", depth: w * 0.88, poly: [[0.004, 0], [fx, 0], [fx, -fh * 0.55], [fx - 0.006, -fh], [0.004, -fh]] });
    out.push({ role: "grip", depth: w * 1.02, poly: gripPoly(d) });
    // Cañón que sobresale, guardamanos de carbina y compensador
    let mz = L;
    if (d.barrel.ext > 0) {
      const r = d.barrel.d / 2 * (d.barrel.shroud ? 1.9 : d.barrel.profile === "bull" ? 1.3 : 1);
      out.push({ role: "barrel", depth: r * 2, poly: [[L - 0.002, by - r], [L + d.barrel.ext, by - r], [L + d.barrel.ext, by + r], [L - 0.002, by + r]] });
      if (d.barrel.guard) { const gl = d.barrel.ext * 0.78; out.push({ role: "handguard", depth: w * 0.95, poly: [[L - 0.004, -fh * 0.9], [L + gl, -fh * 0.7], [L + gl, h * 0.85], [L - 0.004, h * 0.9]] }); }
      mz = L + d.barrel.ext;
    }
    if (d.barrel.comp !== "none") { const cl = d.barrel.comp === "ported" ? 0.032 : 0.024; out.push({ role: "comp", depth: w * 0.9, poly: [[mz - 0.002, by - h * 0.38], [mz + cl, by - h * 0.38], [mz + cl, by + h * 0.42], [mz - 0.002, by + h * 0.5]] }); }
    if (d.slide.top === "rail") out.push({ role: "top", depth: w * 0.6, poly: [[L * 0.22, h - 0.001], [L * 0.72, h - 0.001], [L * 0.72, h + 0.007], [L * 0.22, h + 0.007]] });
    if (d.slide.top === "rib") out.push({ role: "top", depth: w * 0.3, poly: [[L * 0.08, h - 0.001], [L * 0.96, h - 0.001], [L * 0.96, h + 0.004], [L * 0.08, h + 0.004]] });
    if (d.slide.top === "optic") out.push({ role: "top", depth: w * 0.85, poly: [[L * 0.22, h - 0.001], [L * 0.52, h - 0.001], [L * 0.5, h + 0.026], [L * 0.26, h + 0.026]] });
    if (d.slide.top === "high") out.push({ role: "top", depth: w * 0.3, poly: [[L * 0.06, h - 0.001], [L * 0.16, h - 0.001], [L * 0.15, h + 0.011], [L * 0.07, h + 0.011]] });
    if (d.frame.rail) out.push({ role: "rail", depth: w * 0.7, poly: [[fx - 0.052, -fh - 0.006], [fx - 0.006, -fh - 0.006], [fx - 0.006, -fh + 0.001], [fx - 0.052, -fh + 0.001]] });
    if (d.frame.vgrip && d.frame.vgrip !== "none" && d.mag.kind !== "front") {
      const x = fx - 0.03, top = -fh - 0.005;
      out.push({ role: "vgrip", depth: w * 0.9, poly: d.frame.vgrip === "vertical" ? [[x - 0.012, top], [x + 0.012, top], [x + 0.01, top - 0.055], [x - 0.012, top - 0.055]] : [[x - 0.03, top], [x + 0.012, top], [x - 0.004, top - 0.028], [x - 0.03, top - 0.012]] });
    }
    if (d.extra.cell && d.mag.kind !== "front") { const gx = guardX(d); if (fx - 0.004 > gx + 0.064) out.push({ role: "cell", depth: w * 0.8, poly: [[gx + 0.054, -fh + 0.001], [fx - 0.004, -fh + 0.001], [fx - 0.004, -fh - 0.016], [gx + 0.058, -fh - 0.016]] }); }
    if (d.extra.fairing) out.push({ role: "fairing", depth: w * 1.12, poly: [[L * 0.12, h * 0.15], [L * 0.45, h * 0.15], [L * 0.5, h * 0.75], [L * 0.16, h * 0.75]] });
  }
  // Guardamonte
  const gx = guardX(d), gl = 0.05, gd = 0.023;
  out.push({ role: "guard", depth: w * 0.45, poly: d.frame.guard === "round" ? [[gx, -fh], [gx + gl, -fh], [gx + gl, -fh - gd * 0.5], [gx + gl * 0.8, -fh - gd], [gx + 0.006, -fh - gd]]
    : d.frame.guard === "hook" ? [[gx, -fh], [gx + gl, -fh], [gx + gl + 0.006, -fh - gd * 0.75], [gx + gl - 0.004, -fh - gd], [gx + 0.006, -fh - gd]]
    : [[gx, -fh], [gx + gl, -fh], [gx + gl, -fh - gd], [gx + 0.006, -fh - gd]] });
  // Cargador (ninguno en el revólver)
  const mf = magFrame(d), mw = mf.w, a = mf.a;
  const down = (t: number): Pt => [mf.top[0] - Math.sin(a) * t, mf.top[1] - Math.cos(a) * t];
  if (d.mag.kind === "drum") {
    // Tambor unido por un cuello a la base de la empuñadura (nada flotando)
    const R = 0.026, neck = 0.012, c = down(neck + R * 0.75), poly: Pt[] = [];
    out.push({ role: "mag", depth: w * 0.62, poly: quadAlong(down(-0.004), down(neck + 0.006), mw * 0.85, a) });
    for (let i = 0; i < 14; i++) { const t = (i / 14) * Math.PI * 2; poly.push([c[0] + Math.cos(t) * R, c[1] + Math.sin(t) * R]); }
    out.push({ role: "mag", depth: w * 1.1, poly });
  } else if (d.mag.kind === "curved") {
    // Petaca curva que se dobla hacia delante
    const n = 6, len = d.mag.len, fr: Pt[] = [], bk: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, ang = a - 0.6 * t * t, p: Pt = [mf.top[0] - Math.sin(a) * len * t + 0.03 * t * t, mf.top[1] + 0.004 - Math.cos(a) * len * t];
      const ox = (mw / 2) * Math.cos(ang), oy = -(mw / 2) * Math.sin(ang); fr.push([p[0] + ox, p[1] + oy]); bk.push([p[0] - ox, p[1] - oy]);
    }
    out.push({ role: "mag", depth: w * 0.62, poly: [...fr, ...bk.reverse()] });
  } else if (d.mag.kind !== "none") {
    const len = d.mag.kind === "flush" ? 0.006 : d.mag.len;
    out.push({ role: "mag", depth: w * 0.62, poly: quadAlong(down(d.mag.kind === "front" ? 0.002 : -0.004), down(len), mw, a) });
  }
  // Martillo
  const hy = d.family === "revolver" ? revFrame(d).top - 0.004 : h * 0.62, hh = d.family === "revolver" ? 0.016 : h * 0.4;
  if (d.hammer === "spur") out.push({ role: "hammer", depth: w * 0.3, poly: [[-0.013, hy], [0.002, hy], [0.002, hy - hh * 0.92], [-0.006, hy - hh]] });
  if (d.hammer === "ring") out.push({ role: "hammer", depth: w * 0.3, poly: [[-0.01, hy + hh * 0.25], [0.002, hy + hh * 0.25], [0.002, hy - hh * 0.92], [-0.008, hy - hh * 0.8]] });
  if (d.hammer === "bobbed") out.push({ role: "hammer", depth: w * 0.3, poly: [[-0.005, hy - hh * 0.1], [0.002, hy - hh * 0.1], [0.002, hy - hh * 0.92], [-0.005, hy - hh * 0.85]] });
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
/** Perfil lateral (silueta exterior) del diseño, en el mismo formato que los perfiles de los modelos. */
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
/** Tramos de silueta [x, y0, y1] por pieza: los huecos entre piezas (guardamonte, cargador frontal…) cuentan. */
export function designSpans(d: PistolDesign, N = 80): [number, number, number][] {
  const polys = designPolys(d).filter((p) => p.role !== "fairing"), b = designBounds(d), out: [number, number, number][] = [];
  for (let k = 0; k < N; k++) {
    const x = b.x0 + ((b.x1 - b.x0) * (k + 0.5)) / N;
    for (const p of polys) { const c = cutAt(p.poly, x); if (c) out.push([x, c[0], c[1]]); }
  }
  return out;
}
export function muzzleOf(d: PistolDesign): [number, number] {
  const front = d.family === "revolver" ? revFrame(d).xf : d.slide.len;
  return [front + d.barrel.ext + (d.barrel.comp === "none" ? 0 : d.barrel.comp === "ported" ? 0.032 : 0.024), boreY(d)];
}

/** Recurso virtual para el generador y el ensamblador: perfil, medidas y puntos de montaje del diseño. */
export function designEntry(id: string, d: PistolDesign): AssetEntry {
  const b = designBounds(d), w = d.slide.w;
  const [mx, my] = muzzleOf(d);
  const mf = magFrame(d);
  const revolver = d.family === "revolver";
  const topY = revolver ? revFrame(d).top : d.slide.h;
  return {
    id, label: archOf(d.arch).label, pack: "proc-pistol", type: revolver ? "revolver" : "pistol", file: "", triangles: 0,
    parts: [...(revolver ? [] : [{ role: "slide" as const, node: "slide", source: "proc" }]), { role: "frame", node: "frame", source: "proc" }, { role: "grip", node: "grip", source: "proc" },
      ...(revolver ? [] : [{ role: "magazine" as const, node: "mag", source: "proc" }]),
      ...(d.slide.top === "optic" ? [{ role: "scope" as const, node: "top", source: "proc" }] : [])],
    sockets: {
      muzzle: { pos: [mx, my, 0], diameter: d.barrel.d },
      ...(revolver ? {} : { magazine: { pos: [mf.top[0], mf.top[1], 0], size: [mf.w, 0.1] } }),
      top: { pos: [revolver ? revFrame(d).xc1 : d.slide.len * 0.45, topY, 0] },
      ...(d.slide.top === "rail" ? { rail: { pos: [d.slide.len * 0.47, d.slide.h + 0.007, 0], length: d.slide.len * 0.5 } } : {}),
    } as AssetEntry["sockets"],
    bounds: { min: [b.x0, b.y0, -w / 2], max: [b.x1, b.y1, w / 2] },
    profiles: { body: designProfile(d) },
  };
}

/** Diseños guardados con el formato antiguo (v1, sin familia ni estilos) → formato actual. */
export function upgradeDesign(d: PistolDesign): PistolDesign {
  if (d.v === 2) return d;
  const o = d as unknown as { slide: Record<string, unknown>; barrel: Record<string, unknown>; mag: { kind: string } };
  const style = o.slide.open ? "open" : "slab";
  return { ...d, v: 2, family: "auto", slide: { rear: "square", ...(d.slide as object), style } as PistolDesign["slide"], barrel: { profile: "round", ...(d.barrel as object) } as PistolDesign["barrel"], hammer: d.hammer ?? "none" };
}

/** Clave estable de un diseño (para registrar su recurso virtual y comparar armas). */
export function designKey(d: PistolDesign) {
  const s = JSON.stringify(d); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `pp-${d.arch}-${d.era}-${(h >>> 0).toString(36)}`;
}
