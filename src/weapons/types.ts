// Tipos compartidos del sistema de armas.

export type WeaponType = "pistol" | "revolver" | "smg" | "rifle" | "bullpup" | "shotgun" | "sniper" | "launcher" | "flamethrower" | "accessory";
export type PartRole = "body" | "slide" | "frame" | "barrel" | "magazine" | "scope" | "muzzle";

export interface Socket { pos: [number, number, number]; diameter?: number; size?: [number, number]; length?: number }

/** Una entrada del manifest generado por tools/build-assets.mjs */
export interface AssetEntry {
  id: string;
  label: string;
  pack: string;
  type: WeaponType;
  file: string;
  parts: { role: PartRole; node: string; source: string }[];
  sockets: Partial<Record<"muzzle" | "magazine" | "optic" | "slide" | "barrel" | "top", Socket>>;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  triangles: number;
}
export interface Manifest { convention: string; weapons: AssetEntry[] }

export type StatKey = "dano" | "cadencia" | "precision" | "alcance" | "manejo" | "cargador";
export type Stats = Record<StatKey, number>;

export interface Rarity { id: "comun" | "poco" | "rara" | "epica" | "legendaria"; name: string; weight: number; mult: number; effects: number; color: string }

export interface Effect { id: string; name: string; icon: string; color: string; text: string; element?: boolean }

/** Pieza elegida: rol y arma de la que se extrae. */
export interface PartPick { role: PartRole; from: string }

export interface Paint { name: string; color: [number, number, number] | null }

/** Descripción completa de un arma generada (todo lo necesario para montarla y mostrarla). */
export interface WeaponSpec {
  seed: number;
  type: WeaponType;
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
  name: string;
}
