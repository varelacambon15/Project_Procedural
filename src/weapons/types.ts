// Tipos compartidos del sistema de armas. Los textos visibles se obtienen con i18n a partir de los ids.

export type WeaponType = "pistol" | "revolver" | "smg" | "rifle" | "bullpup" | "shotgun" | "sniper" | "launcher" | "flamethrower" | "lmg" | "accessory";
export type PartRole = "body" | "slide" | "frame" | "barrel" | "magazine" | "scope" | "muzzle";
export type FireMode = "auto" | "semi" | "burst" | "pump" | "bolt";

export interface Socket { pos: [number, number, number]; diameter?: number; size?: [number, number]; length?: number }

/** Una entrada del manifest generado por tools/build-assets.mjs */
export interface AssetEntry {
  id: string;
  label: string;
  pack: string;
  type: WeaponType;
  file: string;
  parts: { role: PartRole; node: string; source: string }[];
  sockets: Partial<Record<"muzzle" | "magazine" | "optic" | "slide" | "barrel" | "top" | "rail", Socket>>;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  triangles: number;
}
export interface Manifest { convention: string; weapons: AssetEntry[] }

export type StatKey = "dano" | "cadencia" | "precision" | "alcance" | "manejo" | "cargador";
export type Stats = Record<StatKey, number>;

export type RarityId = "comun" | "poco" | "rara" | "epica" | "legendaria";
export interface Rarity { id: RarityId; weight: number; mult: number; perks: number; special: boolean; color: string }

/** Habilidad: "perk" o "element" (moderadas, desde azul) o "special" (solo legendarias). */
export interface Effect { id: string; kind: "perk" | "element" | "special"; icon: string; color: string; value?: number }

export interface Paint { id: string; color: [number, number, number] | null }

/** Pieza elegida: rol y arma (o accesorio) de la que sale. */
export interface PartPick { role: PartRole; from: string }

/** Descripción completa de un arma generada (todo lo necesario para montarla y mostrarla). */
export interface WeaponSpec {
  seed: number;
  type: WeaponType;
  /** Variante del tipo (p. ej. pistola automática, subfusil táctico). */
  archetype: string;
  fireMode: FireMode;
  /** Modo de disparo "raro" para su tipo (francotirador automático, revólver a ráfagas…), o null. */
  modeShift: FireMode | null;
  /** Disparos por ráfaga (solo en modo ráfaga). */
  burst: number;
  layout: "modular-pistol" | "body";
  parts: PartPick[];
  barrelLength: number;
  muzzle: string | null;
  optic: string | null;
  rarity: Rarity;
  paint: Paint;
  level: number;
  stats: Stats;
  effects: Effect[];
  /** Nombre propio (solo legendarias); el resto usa la designación técnica. */
  name: string;
  /** Semilla de las pequeñas variaciones de estadísticas (estable al cambiar piezas). */
  statSeed: number;
}
