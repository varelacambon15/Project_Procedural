// Armas largas generadas por código (prompt 06-G): bullpups, ametralladoras y escopetas. Igual que las pistolas
// (pistolgen.ts): un diseño de datos (arquetipo + era + mutaciones) → polígonos de perfil por pieza → malla en
// longmesh.ts. Cada arquetipo es un arma propia (no la copia de un modelo real): toma el esquema de su familia
// (bullpup = cargador detrás de la empuñadura; ametralladora = cajón largo con alimentación por cinta, tambor o caja;
// escopeta = depósito tubular, cañones gemelos, tambor o caja) y lo resuelve con sus proporciones.
// Coordenadas: metros, +X hacia la boca, +Y arriba; x = 0 es la parte trasera del cajón (en el bullpup, la cantonera).
import type { AssetEntry } from "./types";
import type { Profile } from "./variation";
import type { Rng } from "./rng";

export type LFamily = "bullpup" | "lmg" | "shotgun";
export type LEra = "classic" | "modern" | "rustic" | "scifi";
export type Pt = [number, number];
export type LRole = "body" | "stock" | "grip" | "guard" | "barrel" | "barrel2" | "front" | "pump" | "mag" | "tube" | "top" | "muzzle" | "bipod" | "carry" | "cheek" | "jacket";
export interface LPoly { role: LRole; depth: number; poly: Pt[]; z?: number }

export interface LongDesign {
  v: 1; arch: string; era: LEra; family: LFamily;
  /** Cajón: largo, alto (por encima y por debajo del ánima), ancho y forma de sus cantos. */
  recv: { len: number; up: number; down: number; w: number; style: "round" | "slab" | "angular" | "stepped"; rearSlope: number };
  /** Culata. "integral": la del bullpup (el propio cajón llega al hombro). */
  stock: { kind: "integral" | "solid" | "frame" | "folding" | "wood" | "tube" | "none"; len: number; drop: number; h: number };
  /** Empuñadura: distancia desde la trasera del cajón, inclinación (rad), largo; "wrist" = garganta de culata clásica. */
  grip: { x: number; angle: number; len: number; kind: "pistol" | "wrist" };
  barrel: { len: number; d: number; profile: "plain" | "heavy" | "fluted" | "finned" | "sbs" | "ou"; muzzle: "none" | "brake" | "flash" | "comp" | "choke" };
  /** Guardamanos (pump = corredera de la escopeta). x0 relativo a la boca del cajón. */
  fore: { kind: "none" | "tube" | "rail" | "slot" | "wood" | "pump" | "vented" | "heatshield" | "jacket"; len: number; h: number };
  /** Alimentación: caja recta o curva, tambor, cinta (caja colgada), tubo bajo el cañón, tambor giratorio, plato superior o nada. */
  feed: { kind: "box" | "curved" | "drum" | "belt" | "tube" | "cylinder" | "pan" | "topbox" | "none"; x: number; len: number; w: number };
  top: "rail" | "handle" | "rib" | "optic" | "iron" | "flat";
  extras: { bipod: boolean; carry: boolean; cheek: boolean; vgrip: boolean };
}

/** Rasgos que una era admite (formas propias, no solo color). */
export const ERA_RULES: Record<LEra, { rails: boolean; stocks: LongDesign["stock"]["kind"][]; fores: LongDesign["fore"]["kind"][]; tops: LongDesign["top"][]; styles: LongDesign["recv"]["style"][] }> = {
  classic: { rails: false, stocks: ["wood", "solid", "folding", "integral", "none"], fores: ["wood", "pump", "vented", "jacket", "heatshield", "none"], tops: ["iron", "rib", "handle", "flat"], styles: ["round", "stepped"] },
  modern: { rails: true, stocks: ["solid", "frame", "folding", "tube", "integral", "none"], fores: ["rail", "slot", "tube", "pump", "heatshield", "none"], tops: ["rail", "optic", "handle", "flat"], styles: ["slab", "stepped", "round"] },
  rustic: { rails: true, stocks: ["wood", "tube", "folding", "solid", "integral", "none"], fores: ["wood", "tube", "vented", "pump", "jacket", "heatshield", "none"], tops: ["iron", "rail", "handle", "rib", "flat"], styles: ["round", "slab", "stepped"] },
  scifi: { rails: true, stocks: ["solid", "frame", "integral", "none"], fores: ["slot", "rail", "heatshield", "pump", "none"], tops: ["rail", "optic", "flat"], styles: ["angular", "slab"] },
};

interface LArch { id: string; label: string; family: LFamily; eras: LEra[]; d: Omit<LongDesign, "v" | "arch" | "era" | "family"> }
const bp = (o: Partial<LArch["d"]> & { feed: LongDesign["feed"]; barrel: LongDesign["barrel"] }): LArch["d"] => ({
  recv: { len: 0.5, up: 0.045, down: 0.035, w: 0.052, style: "slab", rearSlope: 0.3 }, stock: { kind: "integral", len: 0, drop: 0, h: 0.12 },
  grip: { x: 0.36, angle: 0.28, len: 0.1, kind: "pistol" }, fore: { kind: "slot", len: 0.14, h: 0.06 }, top: "rail",
  extras: { bipod: false, carry: false, cheek: false, vgrip: false }, ...o,
});
const mg = (o: Partial<LArch["d"]> & { feed: LongDesign["feed"]; barrel: LongDesign["barrel"] }): LArch["d"] => ({
  recv: { len: 0.44, up: 0.055, down: 0.04, w: 0.06, style: "slab", rearSlope: 0.15 }, stock: { kind: "solid", len: 0.3, drop: 0.03, h: 0.09 },
  grip: { x: 0.16, angle: 0.3, len: 0.1, kind: "pistol" }, fore: { kind: "heatshield", len: 0.2, h: 0.06 }, top: "flat",
  extras: { bipod: true, carry: true, cheek: false, vgrip: false }, ...o,
});
const sg = (o: Partial<LArch["d"]> & { feed: LongDesign["feed"]; barrel: LongDesign["barrel"] }): LArch["d"] => ({
  recv: { len: 0.22, up: 0.035, down: 0.04, w: 0.044, style: "round", rearSlope: 0.25 }, stock: { kind: "wood", len: 0.34, drop: 0.05, h: 0.1 },
  grip: { x: 0.06, angle: 0.35, len: 0.1, kind: "pistol" }, fore: { kind: "pump", len: 0.2, h: 0.045 }, top: "rib",
  extras: { bipod: false, carry: false, cheek: false, vgrip: false }, ...o,
});

export const LONG_ARCHES: LArch[] = [
  // ---- Bullpups: el cargador va detrás de la empuñadura; la culata es el propio cajón ----
  { id: "shell", label: "Shell", family: "bullpup", eras: ["modern", "scifi"], d: bp({ recv: { len: 0.5, up: 0.05, down: 0.04, w: 0.056, style: "round", rearSlope: 0.45 }, feed: { kind: "box", x: 0.25, len: 0.16, w: 0.03 }, barrel: { len: 0.1, d: 0.016, profile: "plain", muzzle: "flash" }, fore: { kind: "none", len: 0.1, h: 0.06 }, top: "optic" }) },
  { id: "bhandle", label: "Handle", family: "bullpup", eras: ["classic", "modern", "rustic"], d: bp({ recv: { len: 0.54, up: 0.035, down: 0.04, w: 0.05, style: "stepped", rearSlope: 0.2 }, feed: { kind: "curved", x: 0.27, len: 0.17, w: 0.03 }, barrel: { len: 0.16, d: 0.015, profile: "plain", muzzle: "flash" }, fore: { kind: "vented", len: 0.12, h: 0.05 }, top: "handle", extras: { bipod: true, carry: false, cheek: false, vgrip: false } }) },
  { id: "bcarbine", label: "Carbine", family: "bullpup", eras: ["modern", "rustic", "scifi"], d: bp({ recv: { len: 0.46, up: 0.04, down: 0.035, w: 0.05, style: "slab", rearSlope: 0.3 }, feed: { kind: "box", x: 0.22, len: 0.15, w: 0.028 }, barrel: { len: 0.22, d: 0.015, profile: "plain", muzzle: "comp" }, fore: { kind: "slot", len: 0.24, h: 0.05 }, extras: { bipod: false, carry: false, cheek: false, vgrip: true } }) },
  { id: "compact", label: "Compact", family: "bullpup", eras: ["modern", "rustic", "scifi"], d: bp({ recv: { len: 0.42, up: 0.042, down: 0.04, w: 0.054, style: "angular", rearSlope: 0.55 }, grip: { x: 0.3, angle: 0.22, len: 0.095, kind: "pistol" }, feed: { kind: "curved", x: 0.19, len: 0.15, w: 0.028 }, barrel: { len: 0.06, d: 0.016, profile: "plain", muzzle: "brake" }, fore: { kind: "none", len: 0.08, h: 0.06 } }) },
  { id: "bdmr", label: "Marksman", family: "bullpup", eras: ["classic", "modern", "scifi"], d: bp({ recv: { len: 0.56, up: 0.04, down: 0.035, w: 0.05, style: "stepped", rearSlope: 0.25 }, feed: { kind: "box", x: 0.27, len: 0.1, w: 0.03 }, barrel: { len: 0.3, d: 0.017, profile: "fluted", muzzle: "brake" }, fore: { kind: "tube", len: 0.18, h: 0.045 }, top: "rail", extras: { bipod: true, carry: false, cheek: true, vgrip: false } }) },
  { id: "slabpup", label: "Slab", family: "bullpup", eras: ["scifi", "modern", "rustic"], d: bp({ recv: { len: 0.52, up: 0.055, down: 0.05, w: 0.06, style: "angular", rearSlope: 0.1 }, feed: { kind: "box", x: 0.24, len: 0.12, w: 0.034 }, barrel: { len: 0.12, d: 0.018, profile: "heavy", muzzle: "comp" }, fore: { kind: "heatshield", len: 0.14, h: 0.07 }, top: "flat" }) },
  // ---- Ametralladoras: cajón largo con tapa de alimentación, cañón pesado, asa y bípode ----
  { id: "belt", label: "Belt", family: "lmg", eras: ["modern", "classic", "rustic"], d: mg({ feed: { kind: "belt", x: 0.2, len: 0.12, w: 0.07 }, barrel: { len: 0.5, d: 0.022, profile: "heavy", muzzle: "flash" }, top: "rail" }) },
  { id: "ldrum", label: "Drum", family: "lmg", eras: ["modern", "scifi", "rustic"], d: mg({ recv: { len: 0.36, up: 0.05, down: 0.035, w: 0.055, style: "slab", rearSlope: 0.2 }, stock: { kind: "frame", len: 0.28, drop: 0.035, h: 0.08 }, feed: { kind: "drum", x: 0.18, len: 0.07, w: 0.07 }, barrel: { len: 0.44, d: 0.02, profile: "fluted", muzzle: "brake" }, fore: { kind: "rail", len: 0.24, h: 0.055 }, top: "rail", extras: { bipod: true, carry: false, cheek: false, vgrip: false } }) },
  { id: "light", label: "Light", family: "lmg", eras: ["modern", "scifi"], d: mg({ recv: { len: 0.34, up: 0.045, down: 0.035, w: 0.05, style: "slab", rearSlope: 0.25 }, stock: { kind: "folding", len: 0.26, drop: 0.03, h: 0.075 }, feed: { kind: "box", x: 0.2, len: 0.2, w: 0.032 }, barrel: { len: 0.42, d: 0.019, profile: "plain", muzzle: "comp" }, fore: { kind: "slot", len: 0.3, h: 0.055 }, top: "optic", extras: { bipod: true, carry: false, cheek: false, vgrip: true } }) },
  { id: "topmag", label: "Topfeed", family: "lmg", eras: ["classic", "rustic"], d: mg({ recv: { len: 0.4, up: 0.04, down: 0.04, w: 0.05, style: "round", rearSlope: 0.3 }, stock: { kind: "wood", len: 0.3, drop: 0.045, h: 0.09 }, feed: { kind: "topbox", x: 0.2, len: 0.18, w: 0.03 }, barrel: { len: 0.5, d: 0.02, profile: "finned", muzzle: "flash" }, fore: { kind: "none", len: 0.2, h: 0.05 }, top: "iron", extras: { bipod: true, carry: true, cheek: false, vgrip: false } }) },
  { id: "jacket", label: "Jacket", family: "lmg", eras: ["classic", "rustic"], d: mg({ recv: { len: 0.32, up: 0.04, down: 0.045, w: 0.05, style: "round", rearSlope: 0.35 }, stock: { kind: "wood", len: 0.32, drop: 0.05, h: 0.1 }, feed: { kind: "pan", x: 0.16, len: 0.14, w: 0.03 }, barrel: { len: 0.52, d: 0.02, profile: "plain", muzzle: "none" }, fore: { kind: "jacket", len: 0.46, h: 0.085 }, top: "iron", extras: { bipod: true, carry: false, cheek: false, vgrip: false } }) },
  { id: "heavyslab", label: "Heavy", family: "lmg", eras: ["scifi", "modern"], d: mg({ recv: { len: 0.48, up: 0.07, down: 0.05, w: 0.07, style: "angular", rearSlope: 0.1 }, stock: { kind: "solid", len: 0.26, drop: 0.02, h: 0.11 }, feed: { kind: "belt", x: 0.22, len: 0.15, w: 0.08 }, barrel: { len: 0.4, d: 0.026, profile: "heavy", muzzle: "brake" }, fore: { kind: "heatshield", len: 0.22, h: 0.08 }, top: "rail" }) },
  // ---- Escopetas: corredera, semiautomática, cañones gemelos, tambor o caja ----
  { id: "pump", label: "Pump", family: "shotgun", eras: ["classic", "modern", "rustic"], d: sg({ feed: { kind: "tube", x: 0, len: 0.4, w: 0.02 }, barrel: { len: 0.5, d: 0.021, profile: "plain", muzzle: "none" } }) },
  { id: "semi", label: "Semi", family: "shotgun", eras: ["modern", "scifi", "classic"], d: sg({ recv: { len: 0.26, up: 0.04, down: 0.04, w: 0.044, style: "slab", rearSlope: 0.2 }, stock: { kind: "solid", len: 0.32, drop: 0.04, h: 0.09 }, feed: { kind: "tube", x: 0, len: 0.36, w: 0.02 }, barrel: { len: 0.46, d: 0.02, profile: "plain", muzzle: "choke" }, fore: { kind: "wood", len: 0.22, h: 0.05 }, top: "rail" }) },
  { id: "double", label: "Double", family: "shotgun", eras: ["classic", "rustic"], d: sg({ recv: { len: 0.1, up: 0.03, down: 0.04, w: 0.05, style: "round", rearSlope: 0.15 }, stock: { kind: "wood", len: 0.36, drop: 0.06, h: 0.1 }, grip: { x: 0.0, angle: 0.5, len: 0.08, kind: "wrist" }, feed: { kind: "none", x: 0, len: 0, w: 0 }, barrel: { len: 0.6, d: 0.02, profile: "sbs", muzzle: "none" }, fore: { kind: "wood", len: 0.18, h: 0.04 }, top: "rib" }) },
  { id: "coach", label: "Coach", family: "shotgun", eras: ["classic", "rustic", "modern"], d: sg({ recv: { len: 0.09, up: 0.03, down: 0.04, w: 0.045, style: "round", rearSlope: 0.15 }, stock: { kind: "wood", len: 0.26, drop: 0.06, h: 0.09 }, grip: { x: 0.0, angle: 0.55, len: 0.08, kind: "pistol" }, feed: { kind: "none", x: 0, len: 0, w: 0 }, barrel: { len: 0.34, d: 0.02, profile: "ou", muzzle: "none" }, fore: { kind: "wood", len: 0.14, h: 0.045 }, top: "rib" }) },
  { id: "sdrum", label: "Drum", family: "shotgun", eras: ["modern", "rustic", "scifi"], d: sg({ recv: { len: 0.24, up: 0.04, down: 0.04, w: 0.05, style: "slab", rearSlope: 0.3 }, stock: { kind: "folding", len: 0.28, drop: 0.03, h: 0.08 }, feed: { kind: "cylinder", x: 0.18, len: 0.07, w: 0.09 }, barrel: { len: 0.32, d: 0.021, profile: "plain", muzzle: "comp" }, fore: { kind: "heatshield", len: 0.2, h: 0.055 }, top: "rail", extras: { bipod: false, carry: false, cheek: false, vgrip: true } }) },
  { id: "sbox", label: "Box", family: "shotgun", eras: ["modern", "scifi", "rustic"], d: sg({ recv: { len: 0.34, up: 0.05, down: 0.04, w: 0.056, style: "angular", rearSlope: 0.15 }, stock: { kind: "solid", len: 0.26, drop: 0.015, h: 0.1 }, grip: { x: 0.12, angle: 0.3, len: 0.1, kind: "pistol" }, feed: { kind: "box", x: 0.22, len: 0.13, w: 0.05 }, barrel: { len: 0.3, d: 0.022, profile: "heavy", muzzle: "brake" }, fore: { kind: "slot", len: 0.22, h: 0.06 }, top: "rail", extras: { bipod: false, carry: true, cheek: false, vgrip: false } }) },
];
export const longArchOf = (id: string) => LONG_ARCHES.find((a) => a.id === id) ?? LONG_ARCHES[0];
export const longArchesFor = (f: LFamily) => LONG_ARCHES.filter((a) => a.family === f);
export const longArchIdOf = (assetId: string) => assetId.replace(/^pl-/, "").split("-")[0];

/** Diseño de un arquetipo en una era: la era cambia formas (no solo color). */
export function longArchDesign(archId: string, era: LEra): LongDesign {
  const a = longArchOf(archId), d: LongDesign = { v: 1, arch: a.id, era, family: a.family, ...structuredClone(a.d) };
  const R = ERA_RULES[era];
  if (!R.styles.includes(d.recv.style)) d.recv.style = R.styles[0];
  if (!R.tops.includes(d.top)) d.top = era === "classic" ? (d.family === "lmg" ? "iron" : "rib") : "flat";
  if (!R.fores.includes(d.fore.kind)) d.fore.kind = era === "classic" ? (d.family === "shotgun" ? "wood" : "vented") : "none";
  if (!R.stocks.includes(d.stock.kind)) d.stock.kind = era === "classic" || era === "rustic" ? "wood" : "solid";
  if (era === "classic") { d.extras.vgrip = false; if (d.feed.kind === "box" && d.family === "bullpup") d.feed.kind = "curved"; }
  if (era === "scifi") { d.recv.style = d.recv.style === "round" ? "angular" : d.recv.style; d.recv.rearSlope = Math.max(d.recv.rearSlope, 0.35); }
  if (era === "rustic" && d.fore.kind === "rail") d.fore.kind = "tube";
  return d;
}

// ---------- Mutaciones ----------
type Mut = { id: string; structural: boolean; run: (d: LongDesign, r: Rng, a: number) => void };
const pickOther = <T,>(r: Rng, list: readonly T[], cur: T) => { const l = list.filter((x) => x !== cur); return l.length ? l[Math.floor(r() * l.length)] : cur; };
const scale = (r: Rng, a: number, lo = 0.75, hi = 1.3) => { const k = lo + r() * (hi - lo); return 1 + (k - 1) * a; };
export const LONG_MUTATIONS: Mut[] = [
  { id: "stock", structural: true, run: (d, r) => { if (d.family === "bullpup") return; d.stock.kind = pickOther(r, ERA_RULES[d.era].stocks.filter((k) => k !== "integral"), d.stock.kind); } },
  { id: "fore", structural: true, run: (d, r) => { const l = ERA_RULES[d.era].fores.filter((k) => (d.family === "shotgun" ? true : k !== "pump") && (d.feed.kind === "tube" ? k !== "jacket" && k !== "none" : true) && (k !== "none" || (d.family === "bullpup" && d.barrel.len < 0.16))); d.fore.kind = pickOther(r, l, d.fore.kind); if (d.fore.kind === "pump" && d.feed.kind !== "tube") d.fore.kind = "wood"; } },
  { id: "top", structural: true, run: (d, r) => { d.top = pickOther(r, ERA_RULES[d.era].tops, d.top); } },
  { id: "recv-style", structural: true, run: (d, r) => { d.recv.style = pickOther(r, ERA_RULES[d.era].styles, d.recv.style); d.recv.rearSlope = 0.1 + r() * 0.45; } },
  { id: "feed", structural: true, run: (d, r) => {
    const by: Record<LFamily, LongDesign["feed"]["kind"][]> = { bullpup: ["box", "curved"], lmg: d.era === "classic" ? ["belt", "topbox", "pan", "drum"] : ["belt", "drum", "box"], shotgun: d.barrel.profile === "sbs" || d.barrel.profile === "ou" ? ["none"] : ["tube", "box", "cylinder"] };
    const k = pickOther(r, by[d.family], d.feed.kind); d.feed.kind = k;
    if (k === "tube") { d.feed.len = d.barrel.len * (0.65 + r() * 0.2); d.feed.w = 0.02; if (d.fore.kind !== "pump" && d.fore.kind !== "wood") d.fore.kind = "pump"; }
    else if (k === "drum" || k === "cylinder") { d.feed.len = 0.065 + r() * 0.015; d.feed.w = k === "cylinder" ? 0.09 : 0.07; d.feed.x = Math.min(d.recv.len * 0.6, d.feed.x || 0.18); if (d.fore.kind === "pump") d.fore.kind = "heatshield"; }
    else if (k === "box" || k === "curved" || k === "topbox") { d.feed.len = d.family === "shotgun" ? 0.12 : 0.14 + r() * 0.06; d.feed.w = d.family === "shotgun" ? 0.05 : 0.03; d.feed.x = d.family === "bullpup" ? d.grip.x - 0.1 : Math.max(d.feed.x, d.grip.x + 0.08); if (d.fore.kind === "pump") d.fore.kind = "slot"; }
    else if (k === "belt") { d.feed.len = 0.12; d.feed.w = 0.07; }
    else if (k === "pan") { d.feed.len = 0.14; d.feed.w = 0.03; }
  } },
  { id: "muzzle", structural: false, run: (d, r) => { d.barrel.muzzle = pickOther(r, d.family === "shotgun" ? ["none", "choke", "brake", "comp"] as const : ["none", "flash", "brake", "comp"] as const, d.barrel.muzzle); } },
  { id: "barrel-profile", structural: false, run: (d, r) => { if (d.barrel.profile === "sbs" || d.barrel.profile === "ou") { d.barrel.profile = d.barrel.profile === "sbs" ? "ou" : "sbs"; return; } d.barrel.profile = pickOther(r, d.era === "classic" ? ["plain", "heavy", "finned"] as const : ["plain", "heavy", "fluted"] as const, d.barrel.profile); } },
  { id: "bipod", structural: true, run: (d) => { if (d.family === "shotgun") return; d.extras.bipod = !d.extras.bipod; } },
  { id: "carry", structural: true, run: (d) => { if (d.family === "shotgun" && !["box", "cylinder"].includes(d.feed.kind)) return; if (d.family === "bullpup") { d.top = d.top === "handle" ? (ERA_RULES[d.era].rails ? "rail" : "iron") : "handle"; return; } d.extras.carry = !d.extras.carry; } },
  { id: "vgrip", structural: false, run: (d) => { if (d.era === "classic" || d.fore.kind === "pump" || d.fore.kind === "none" || d.fore.kind === "jacket") return; d.extras.vgrip = !d.extras.vgrip; } },
  { id: "cheek", structural: false, run: (d) => { if (d.stock.kind === "none" || d.stock.kind === "tube") return; d.extras.cheek = !d.extras.cheek; } },
  { id: "barrel-len", structural: false, run: (d, r, a) => { d.barrel.len = Math.min(d.family === "bullpup" ? 0.34 : 0.65, Math.max(0.05, d.barrel.len * scale(r, a, 0.7, 1.35))); if (d.feed.kind === "tube") d.feed.len = Math.min(d.feed.len, d.barrel.len * 0.85); } },
  { id: "fore-len", structural: false, run: (d, r, a) => { d.fore.len = Math.min(d.barrel.len + (d.family === "bullpup" ? 0.1 : 0), Math.max(0.06, d.fore.len * scale(r, a, 0.7, 1.35))); } },
  { id: "recv-len", structural: false, run: (d, r, a) => { const k = scale(r, a * 0.6, 0.85, 1.18); d.recv.len *= k; d.grip.x *= k; d.feed.x *= k; } },
  { id: "stock-len", structural: false, run: (d, r, a) => { if (d.stock.kind === "integral" || d.stock.kind === "none") return; d.stock.len = Math.min(0.38, Math.max(0.18, d.stock.len * scale(r, a, 0.8, 1.2))); d.stock.drop = Math.max(0, d.stock.drop + (r() - 0.5) * 0.03 * a); } },
  { id: "recv-h", structural: false, run: (d, r, a) => { const k = scale(r, a * 0.6, 0.85, 1.2); d.recv.up *= k; d.recv.down *= k; } },
];
export const LONG_STRUCTURAL = new Set(LONG_MUTATIONS.filter((m) => m.structural).map((m) => m.id));
export function longMutationAllowed(id: string, d: LongDesign) {
  if (d.family === "bullpup" && (id === "stock" || id === "stock-len" || id === "cheek")) return id === "cheek";
  if (d.family === "shotgun" && (id === "bipod")) return false;
  if ((d.barrel.profile === "sbs" || d.barrel.profile === "ou") && id === "feed") return false;
  if (d.era === "classic" && (id === "vgrip")) return false;
  return true;
}

// ---------- Geometría de perfil ----------
/** Altura del ánima (y = 0 en el eje del cañón). */
const BORE = 0;
const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function quadAlong(p0: Pt, p1: Pt, w: number, a: number): Pt[] {
  const ox = (w / 2) * Math.cos(a), oy = -(w / 2) * Math.sin(a);
  return [[p0[0] - ox, p0[1] - oy], [p0[0] + ox, p0[1] + oy], [p1[0] + ox, p1[1] + oy], [p1[0] - ox, p1[1] - oy]];
}
/** Puntos clave del diseño (los usan la malla, las manos y los montajes). */
export function longFrame(d: LongDesign) {
  const R = d.recv, top = BORE + R.up, bot = BORE - R.down;
  const x1 = R.len, bx = x1 + 0.004;
  const twin = d.barrel.profile === "sbs" || d.barrel.profile === "ou";
  const muzzleX = bx + d.barrel.len + (d.barrel.muzzle === "none" ? 0 : d.barrel.muzzle === "choke" ? 0.03 : 0.05);
  const gx = d.grip.x, gy = bot;
  return { top, bot, x1, bx, muzzleX, gx, gy, twin };
}

export function longPolys(d: LongDesign): LPoly[] {
  const out: LPoly[] = [];
  const R = d.recv, f = longFrame(d), w = R.w;
  const { top, bot, x1 } = f;
  // Cajón: trasera inclinada (rearSlope), lomo y quilla; en el bullpup la trasera baja hasta la cantonera
  const s = R.rearSlope * (top - bot);
  let body: Pt[];
  if (d.family === "bullpup") {
    const butt = bot - 0.045 - (R.style === "angular" ? 0.01 : 0);
    body = [[0, butt], [0.012, butt - 0.004], [d.grip.x - 0.13, bot - 0.012], [d.grip.x - 0.04, bot], [x1, bot], [x1, top - (R.style === "angular" ? 0.012 : 0.004)], [x1 - 0.02, top], [0.06, top], [0, top - s]];
  } else if (R.style === "stepped") {
    body = [[0, bot], [x1, bot], [x1, top - 0.012], [x1 * 0.55, top - 0.012], [x1 * 0.5, top], [0.02, top], [0, top - s]];
  } else if (R.style === "angular") {
    body = [[0, bot + 0.008], [0.02, bot], [x1 - 0.03, bot], [x1, bot + 0.012], [x1, top - 0.01], [x1 - 0.02, top], [0.03, top], [0, top - s]];
  } else body = [[0, bot], [x1, bot], [x1, top], [0.02, top], [0, top - s]];
  out.push({ role: "body", depth: w, poly: body });

  // Empuñadura (o garganta de culata): inclinada hacia atrás
  if (d.grip.kind === "pistol") {
    const a = d.grip.angle, gx = d.grip.x, g0: Pt = [gx, bot + 0.004], len = d.grip.len;
    const g1: Pt = [gx - Math.sin(a) * len, bot - Math.cos(a) * len];
    out.push({ role: "grip", depth: w * 0.62, poly: quadAlong(g0, g1, 0.034, a) });
  }
  // Guardamonte: del cajón por delante del gatillo, baja y vuelve a la empuñadura (contorno cerrado)
  if (d.grip.kind === "pistol") {
    const gx = d.grip.x;
    out.push({ role: "guard", depth: w * 0.3, poly: [[gx + 0.005, bot], [gx + 0.06, bot], [gx + 0.062, bot - 0.012], [gx + 0.05, bot - 0.026], [gx + 0.008, bot - 0.026], [gx - 0.004, bot - 0.016]] });
  } else {
    out.push({ role: "guard", depth: w * 0.3, poly: [[0.004, bot], [0.06, bot], [0.06, bot - 0.012], [0.05, bot - 0.022], [0.012, bot - 0.022]] });
  }

  // Culata
  const S = d.stock;
  if (S.kind !== "integral" && S.kind !== "none") {
    const sx0 = -S.len, by = bot - S.drop, sh = S.h;
    if (S.kind === "wood" || S.kind === "solid") {
      const wrist = d.grip.kind === "wrist";
      const poly: Pt[] = wrist
        ? [[0, top - 0.004], [sx0 * 0.3, top - S.drop * 0.3 - 0.004], [sx0, top - S.drop - 0.006], [sx0, by - sh * 0.55], [sx0 * 0.6, by - sh * 0.35], [sx0 * 0.25, bot - 0.03], [0, bot - 0.012]]
        : S.kind === "solid"
          ? [[0, top - 0.008], [sx0 * 0.35, top - S.drop * 0.35 - 0.006], [sx0 * 0.4, top - S.drop * 0.4 + 0.006], [sx0, top - S.drop + 0.004], [sx0, by - sh * 0.5], [sx0 * 0.55, by - sh * 0.38], [sx0 * 0.42, by - sh * 0.2], [-0.03, bot - 0.004], [0, bot]]
          : [[0, top - 0.008], [sx0, top - S.drop - 0.008], [sx0, by - sh * 0.5], [sx0 * 0.5, by - sh * 0.3], [-0.03, bot - 0.008], [0, bot]];
      out.push({ role: "stock", depth: w * (S.kind === "wood" ? 0.9 : 0.85), poly });
    } else if (S.kind === "frame") {
      // Marco de pletina con su hueco (una sola pieza, con volumen)
      out.push({ role: "stock", depth: w * 0.55, poly: [[0, top - 0.006], [sx0, top - S.drop - 0.004], [sx0, by - sh * 0.45], [0, bot + 0.004], [-0.025, bot + 0.012], [sx0 + 0.04, by - sh * 0.3], [sx0 + 0.035, top - S.drop - 0.02], [-0.02, top - 0.02]] });
    } else if (S.kind === "folding") {
      // Plegable: brazo de pletina gruesa (barra superior + cantonera) con su bisagra; una sola pieza con volumen
      const t = 0.016, yT = top - 0.006, yB = by - sh * 0.4;
      out.push({ role: "stock", depth: w * 0.5, poly: [[0, yT], [sx0, yT - S.drop], [sx0, yB], [sx0 + 0.018, yB], [sx0 + 0.018, yT - S.drop - t], [0, yT - t]] });
    } else if (S.kind === "tube") {
      out.push({ role: "stock", depth: 0.026, poly: rect(sx0 + 0.02, BORE - 0.012, 0, BORE + 0.012) });
      out.push({ role: "stock", depth: w * 0.7, poly: rect(sx0, by - sh * 0.45, sx0 + 0.02, top - S.drop * 0.8) });
    }
  }
  if (d.extras.cheek && (S.kind !== "none" && S.kind !== "tube")) {
    const cx0 = d.family === "bullpup" ? 0.02 : -S.len * 0.75, cx1 = d.family === "bullpup" ? d.grip.x - 0.12 : -S.len * 0.25, cy = d.family === "bullpup" ? top : top - S.drop * 0.5;
    out.push({ role: "cheek", depth: w * 0.6, poly: [[cx0, cy - 0.004], [cx1, cy - 0.004], [cx1 - 0.01, cy + 0.016], [cx0 + 0.01, cy + 0.016]] });
  }

  // Cañón(es)
  const B = d.barrel, bx = f.bx, br = B.d / 2 * (B.profile === "heavy" ? 1.25 : 1);
  if (f.twin && B.profile === "ou") {
    out.push({ role: "barrel", depth: B.d, poly: rect(bx - 0.01, BORE + 0.002, bx + B.len, BORE + 0.002 + B.d) });
    out.push({ role: "barrel2", depth: B.d, poly: rect(bx - 0.01, BORE - B.d - 0.002, bx + B.len, BORE - 0.002) });
  } else out.push({ role: "barrel", depth: br * 2, poly: rect(bx - 0.01, BORE - br, bx + B.len, BORE + br) });
  if (B.muzzle !== "none") {
    const ml = B.muzzle === "choke" ? 0.03 : 0.05, mr = br * (B.muzzle === "brake" ? 1.8 : B.muzzle === "comp" ? 1.6 : B.muzzle === "choke" ? 1.15 : 1.4);
    out.push({ role: "muzzle", depth: mr * 2, poly: rect(bx + B.len, BORE - mr, bx + B.len + ml, BORE + mr) });
  }

  // Guardamanos (y corredera de la escopeta)
  const F = d.fore;
  if (F.kind !== "none") {
    const fx0 = x1, fx1 = Math.min(bx + B.len - 0.01, x1 + F.len), fh = F.h;
    if (F.kind === "pump") {
      const ty = BORE - br - (d.feed.kind === "tube" ? d.feed.w : 0);
      const px0 = x1 + 0.03, px1 = Math.min(px0 + F.len * 0.75, bx + B.len - 0.02);
      out.push({ role: "pump", depth: w * 0.95, poly: [[px0, ty - 0.012], [px1, ty - 0.012], [px1 + 0.006, ty + 0.002], [px1, BORE + br * 0.3], [px0, BORE + br * 0.3], [px0 - 0.006, ty]] });
    } else if (F.kind === "jacket") {
      out.push({ role: "jacket", depth: fh, poly: rect(fx0, BORE - fh / 2, fx1, BORE + fh / 2) });
    } else {
      const lo = BORE - fh * (F.kind === "heatshield" ? 0.25 : 0.55), hi = BORE + fh * (F.kind === "heatshield" ? 0.6 : 0.45);
      out.push({ role: "front", depth: w * (F.kind === "tube" ? 0.8 : 0.92), poly: [[fx0, lo], [fx1 - 0.01, lo], [fx1, lo + 0.008], [fx1, hi], [fx0, hi]] });
    }
  }

  // Alimentación
  const A = d.feed;
  if (A.kind === "tube") {
    const ty = BORE - br - A.w / 2 - 0.002;
    out.push({ role: "tube", depth: A.w, poly: rect(x1 - 0.004, ty - A.w / 2, x1 + A.len, ty + A.w / 2) });
  } else if (A.kind === "box" || A.kind === "curved") {
    const a = d.family === "bullpup" ? 0.12 : 0.08, p0: Pt = [A.x, bot + 0.004];
    if (A.kind === "curved") {
      const n = 6, fr: Pt[] = [], bk: Pt[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, ang = a + 0.5 * t, p: Pt = [p0[0] + A.len * (0.12 * t + 0.25 * t * t), p0[1] - A.len * t];
        const ox = (A.w * 1.3 / 2) * Math.cos(ang), oy = -(A.w * 1.3 / 2) * Math.sin(ang); fr.push([p[0] + ox, p[1] + oy]); bk.push([p[0] - ox, p[1] - oy]);
      }
      out.push({ role: "mag", depth: A.w, poly: [...fr, ...bk.reverse()] });
    } else {
      const p1: Pt = [p0[0] - Math.sin(-a * 0.3) * A.len, p0[1] - A.len];
      out.push({ role: "mag", depth: A.w * (d.family === "shotgun" ? 0.8 : 1), poly: quadAlong(p0, p1, d.family === "shotgun" ? 0.07 : 0.042, 0) });
    }
  } else if (A.kind === "topbox") {
    const p0: Pt = [A.x, top - 0.004];
    out.push({ role: "mag", depth: A.w, poly: [[p0[0] - 0.03, p0[1]], [p0[0] + 0.03, p0[1]], [p0[0] + 0.05, p0[1] + A.len * 0.5], [p0[0] + 0.075, p0[1] + A.len], [p0[0] + 0.02, p0[1] + A.len + 0.006], [p0[0] - 0.008, p0[1] + A.len * 0.5]] });
  } else if (A.kind === "drum" || A.kind === "cylinder") {
    const R0 = A.len, cx = A.x, cy = bot - R0 * 0.85 - 0.01, poly: Pt[] = [];
    for (let i = 0; i < 16; i++) { const t = (i / 16) * Math.PI * 2; poly.push([cx + Math.cos(t) * R0, cy + Math.sin(t) * R0]); }
    out.push({ role: "mag", depth: A.w, poly });
    out.push({ role: "mag", depth: A.w * 0.5, poly: rect(cx - 0.022, cy + R0 * 0.6, cx + 0.022, bot + 0.004) });
  } else if (A.kind === "belt") {
    const bx0 = A.x - 0.06, by1 = bot - 0.004;
    out.push({ role: "mag", depth: A.w, poly: [[bx0, by1], [bx0 + A.len, by1], [bx0 + A.len, by1 - A.len * 0.9], [bx0 + 0.01, by1 - A.len * 0.95], [bx0, by1 - A.len * 0.85]] });
  } else if (A.kind === "pan") {
    out.push({ role: "mag", depth: A.w, poly: rect(A.x - A.len * 0.75, top + 0.004, A.x + A.len * 0.75, top + 0.004 + A.w) });
  }

  // Parte superior
  if (d.top === "rail") out.push({ role: "top", depth: 0.024, poly: rect(x1 * 0.08, top - 0.001, x1 * 0.96 + (d.fore.kind === "rail" || d.fore.kind === "slot" ? d.fore.len * 0.9 : 0), top + 0.009) });
  if (d.top === "rib") out.push({ role: "top", depth: 0.012, poly: rect(x1 - 0.01, BORE + br - 0.001, f.bx + B.len - 0.005, BORE + br + (f.twin && B.profile === "ou" ? B.d + 0.006 : 0.005)) });
  if (d.top === "handle") out.push({ role: "carry", depth: 0.026, poly: [[x1 * 0.18, top - 0.001], [x1 * 0.85, top - 0.001], [x1 * 0.8, top + 0.04], [x1 * 0.24, top + 0.04]] });
  if (d.top === "optic") out.push({ role: "top", depth: 0.04, poly: [[x1 * 0.3, top - 0.001], [x1 * 0.78, top - 0.001], [x1 * 0.74, top + 0.045], [x1 * 0.36, top + 0.042]] });
  if (d.top === "iron") out.push({ role: "top", depth: 0.012, poly: rect(x1 * 0.1, top - 0.001, x1 * 0.2, top + 0.014) });
  // Asa de transporte del cañón (ametralladoras y escopetas de caja)
  if (d.extras.carry) { const cx = d.family === "lmg" ? f.bx + B.len * 0.28 : x1 * 0.5, cy = d.family === "lmg" ? BORE + br : top; out.push({ role: "carry", depth: 0.016, poly: [[cx - 0.05, cy - 0.001], [cx + 0.05, cy - 0.001], [cx + 0.035, cy + 0.045], [cx - 0.035, cy + 0.045]] }); }
  // Empuñadura delantera
  if (d.extras.vgrip && F.kind !== "none" && F.kind !== "pump" && F.kind !== "jacket" && Math.min(F.len, B.len) > 0.09) { const vx = x1 + Math.min(F.len, B.len) * 0.55, vy = BORE - F.h * (F.kind === "heatshield" ? 0.25 : 0.55) + 0.002; out.push({ role: "grip", depth: 0.026, poly: [[vx - 0.014, vy], [vx + 0.014, vy], [vx + 0.012, vy - 0.07], [vx - 0.012, vy - 0.07]] }); }
  // Bípode plegado bajo el guardamanos (dos patas a lo largo del cañón)
  if (d.extras.bipod) { const px = f.bx + Math.min(B.len, F.len + 0.02) * 0.95, py = BORE - br - 0.004; out.push({ role: "bipod", depth: 0.03, poly: [[px - 0.18, py - 0.012], [px, py - 0.004], [px, py], [px - 0.18, py - 0.006]] }); }
  return out;
}

// ---------- Silueta y recurso virtual ----------
function cutAt(poly: Pt[], x: number): [number, number] | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    if (x < Math.min(x1, x2) || x > Math.max(x1, x2)) continue;
    const vals = x1 === x2 ? [y1, y2] : [y1 + ((x - x1) / (x2 - x1)) * (y2 - y1)];
    for (const v of vals) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  return lo <= hi ? [lo, hi] : null;
}
export function longBounds(d: LongDesign) {
  const pts = longPolys(d).flatMap((p) => p.poly);
  return { x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), y0: Math.min(...pts.map((p) => p[1])), y1: Math.max(...pts.map((p) => p[1])) };
}
export function longProfile(d: LongDesign, N = 60): Profile {
  const polys = longPolys(d), b = longBounds(d), top: (number | null)[] = [], bot: (number | null)[] = [];
  for (let k = 0; k < N; k++) {
    const x = b.x0 + ((b.x1 - b.x0) * (k + 0.5)) / N; let lo = Infinity, hi = -Infinity;
    for (const p of polys) { const c = cutAt(p.poly, x); if (c) { lo = Math.min(lo, c[0]); hi = Math.max(hi, c[1]); } }
    top.push(hi > -Infinity ? hi : null); bot.push(lo < Infinity ? lo : null);
  }
  return { x0: b.x0, x1: b.x1, top, bot };
}
/** Tramos de silueta por pieza [x, y0, y1] (cuentan los huecos entre piezas). */
export function longSpans(d: LongDesign, N = 120): [number, number, number][] {
  const polys = longPolys(d), b = longBounds(d), out: [number, number, number][] = [];
  for (let k = 0; k < N; k++) { const x = b.x0 + ((b.x1 - b.x0) * (k + 0.5)) / N; for (const p of polys) { const c = cutAt(p.poly, x); if (c) out.push([x, c[0], c[1]]); } }
  return out;
}
export function longEntry(id: string, d: LongDesign): AssetEntry {
  const b = longBounds(d), f = longFrame(d), w = d.recv.w;
  const magBelow = ["box", "curved", "drum", "belt", "cylinder"].includes(d.feed.kind);
  return {
    id, label: longArchOf(d.arch).label, pack: "proc-long", type: d.family, file: "", triangles: 0,
    parts: [{ role: "receiver", node: "body", source: "proc" }, ...(d.top === "optic" ? [{ role: "scope" as const, node: "top", source: "proc" }] : [])],
    sockets: {
      muzzle: { pos: [f.muzzleX, BORE, 0], diameter: d.barrel.d },
      ...(magBelow ? { magazine: { pos: [d.feed.x, f.bot, 0], size: [d.feed.w, d.feed.len] } } : {}),
      top: { pos: [d.recv.len * 0.5, f.top, 0] },
      ...(d.top === "rail" ? { rail: { pos: [d.recv.len * 0.5, f.top + 0.009, 0], length: d.recv.len * 0.8 } } : {}),
    } as AssetEntry["sockets"],
    bounds: { min: [b.x0, b.y0, -w / 2], max: [b.x1, b.y1, w / 2] },
    profiles: { body: longProfile(d) },
  };
}
export function longKey(d: LongDesign) {
  const s = JSON.stringify(d); let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `pl-${d.arch}-${d.era}-${(h >>> 0).toString(36)}`;
}
/** Modo de disparo y variante de stats de cada arquetipo (los TYPE_INFO de su tipo). */
export const LONG_HINTS: Record<string, { arch: string; strict?: boolean }> = {
  pump: { arch: "pump", strict: true }, semi: { arch: "semi", strict: true }, double: { arch: "double", strict: true }, coach: { arch: "double", strict: true },
  sdrum: { arch: "semi" }, sbox: { arch: "auto", strict: true }, heavyslab: { arch: "heavy" }, jacket: { arch: "heavy" },
  bdmr: { arch: "burst" },
};
