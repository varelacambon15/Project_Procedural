// Encargo 21 — lógica pura del acabado (sin Three.js, sin DOM): identidad por era, desgaste por calidad,
// paleta sobria, marca de rareza y detalle de latón de las legendarias. Los datos viven en src/data/finishes.json.
import data from "../data/finishes.json";
import type { Era } from "./eras";
import type { RarityId } from "./types";

export type FinishQuality = "low" | "medium" | "high";
/** Tipos de grano compartidos con textures.ts (se mantienen aquí como texto para que este módulo sea puro). */
export type FinishKind = "metal" | "polymer" | "wood" | "fabric" | "rust" | "stipple" | "checker" | "engrave" | "cerakote" | "anodized" | "varnished" | "parkerized" | "brass";
export type FinishRole = "primary" | "secondary" | "metal" | "accent" | "wood" | "highlight" | "engrave";

interface Family { kind: string; roughness: number; metalness: number; edge: number }
interface EraProfile { receiver: string; furniture: string; metal: string; accent: string; wear: number }
interface QualityProfile { wear: number; edge: number; details: boolean; veinSegments: number }
const D = data as unknown as {
  families: Record<string, Family>; eras: Record<Era, EraProfile>;
  palettes: { cerakote: string[] }; quality: Record<FinishQuality, QualityProfile>;
  rarityTicks: Record<RarityId, number>;
};

export interface FinishStyle {
  family: string;
  kind: FinishKind;
  roughness: number;
  metalness: number;
  /** Peso del desgaste en bordes (0 = nada; 1 = máximo). */
  edge: number;
  /** Desgaste global 0..1 de esta arma. */
  wear: number;
}
export interface WeaponStyles {
  primary: FinishStyle; secondary: FinishStyle; metal: FinishStyle; accent: FinishStyle;
  wood: FinishStyle; highlight: FinishStyle; engrave: FinishStyle;
  wear: number; quality: FinishQuality; details: boolean; veinSegments: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/**settings.quality viene como cadena; cualquier valor desconocido cae a Medio (PC). */
export const finishQuality = (q?: string): FinishQuality => q === "low" || q === "high" ? q : "medium";
export const qualityProfile = (q: FinishQuality = "medium") => D.quality[q];
/** Desgaste de la era, atenuado en Bajo y apenas perceptible en moderna / sci-fi. */
export const wearForEra = (era: Era | undefined, quality: FinishQuality = "medium") =>
  clamp01((D.eras[era ?? "modern"] ?? D.eras.modern).wear * D.quality[quality].wear);

/** Estilos de TODAS las piezas de un arma: se calculan una vez por arma para que no aparezcan combinaciones sueltas. */
export function stylesFor(era: Era | undefined, quality: FinishQuality = "medium"): WeaponStyles {
  const e = D.eras[era ?? "modern"] ?? D.eras.modern, q = D.quality[quality];
  const wear = clamp01(e.wear * q.wear);
  const make = (family: string): FinishStyle => {
    const f = D.families[family] ?? D.families.blued;
    return { family, kind: f.kind as FinishKind, roughness: f.roughness, metalness: f.metalness, edge: clamp01(f.edge * q.edge), wear };
  };
  const varnished = e.furniture === "varnished";
  return {
    primary: make(e.receiver), secondary: make(e.furniture), metal: make(e.metal), accent: make(e.accent),
    wood: make(varnished ? "varnished" : e.furniture),
    highlight: make("brass"), engrave: make("engrave"),
    wear, quality, details: q.details, veinSegments: q.veinSegments,
  };
}

/** Plateados/cerámicos sobrios que se usan como paleta de cerakote/anodizado (6–8, sin arcoíris). */
export const CERAKOTE_PALETTE: readonly string[] = D.palettes.cerakote;
/** Marca de rareza:rayas finas en el cajón. Común no lleva; legendaria no lleva color propio de efecto. */
export const rarityTicks = (r: RarityId) => D.rarityTicks[r] ?? 0;
/** Una sola pieza de latón, en gatillo o palanca, solo en legendarias. */
export const brassDetail = (r: RarityId) => r === "legendaria";
