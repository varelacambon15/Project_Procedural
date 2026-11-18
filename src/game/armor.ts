// Armaduras equipables (casco, torso y parte inferior): cada pieza tiene rareza, variante, reducción de daño y una o
// dos ventajas. Datos y generación puros (sin DOM ni three): los usan main.ts (daño y ventajas), la tienda, el botín y
// el inventario. Los modelos los diseñará el usuario; de momento cada variante tiene su forma básica por código.

export type ArmorSlot = "head" | "torso" | "legs";
export type ArmorRarity = "comun" | "poco" | "rara" | "epica" | "legendaria";
export const ARMOR_SLOTS: ArmorSlot[] = ["head", "torso", "legs"];

/** Variantes por ranura: ligera (más ventajas, menos protección), estándar y pesada (más protección, algo de lentitud). */
export type ArmorVariant = "light" | "standard" | "heavy";
export const ARMOR_VARIANTS: ArmorVariant[] = ["light", "standard", "heavy"];

/** Ventajas posibles (valor por rango de rareza). Cada pieza saca una (dos desde épica) de las de su ranura. */
export type ArmorPerk =
  | "health" | "regen" | "regenDelay" | "speed" | "superGain" | "nadeRecharge" | "reload" | "critDmg"
  | "headshotGuard" | "explosiveGuard" | "fireGuard" | "shockGuard" | "meleeGuard" | "orbGuard";
export const ARMOR_PERKS: Record<ArmorSlot, ArmorPerk[]> = {
  head: ["headshotGuard", "superGain", "critDmg", "shockGuard", "orbGuard"],
  torso: ["health", "regen", "explosiveGuard", "fireGuard", "meleeGuard"],
  legs: ["speed", "regenDelay", "nadeRecharge", "reload", "explosiveGuard"],
};
/** Valor de cada ventaja por punto (se multiplica por la rareza). */
export const PERK_VALUE: Record<ArmorPerk, number> = {
  health: 0.05, regen: 0.1, regenDelay: 0.08, speed: 0.025, superGain: 0.06, nadeRecharge: 0.07, reload: 0.05, critDmg: 0.06,
  headshotGuard: 0.08, explosiveGuard: 0.1, fireGuard: 0.12, shockGuard: 0.12, meleeGuard: 0.08, orbGuard: 0.08,
};

export interface ArmorSpec {
  uid: number; slot: ArmorSlot; variant: ArmorVariant; rarity: ArmorRarity; seed: number;
  /** Reducción del daño recibido (0..1) que aporta la pieza. */ reduction: number;
  perks: { id: ArmorPerk; value: number }[];
  /** Penalización de velocidad de las pesadas (fracción). */ slow: number;
}

/** Reducción base por ranura y variante (el torso protege más; las pesadas, más). */
const BASE: Record<ArmorSlot, number> = { head: 0.04, torso: 0.08, legs: 0.05 };
const VAR: Record<ArmorVariant, { red: number; slow: number; perkMul: number }> = {
  light: { red: 0.7, slow: 0, perkMul: 1.3 }, standard: { red: 1, slow: 0, perkMul: 1 }, heavy: { red: 1.45, slow: 0.03, perkMul: 0.8 },
};
export const ARMOR_RARITY: Record<ArmorRarity, { mult: number; perks: number; color: string; price: number }> = {
  comun: { mult: 1, perks: 1, color: "#c9c9c9", price: 120 },
  poco: { mult: 1.2, perks: 1, color: "#5fc26a", price: 200 },
  rara: { mult: 1.45, perks: 1, color: "#4a90e8", price: 330 },
  epica: { mult: 1.75, perks: 2, color: "#a35cf0", price: 520 },
  legendaria: { mult: 2.1, perks: 2, color: "#f2a541", price: 860 },
};
export const ARMOR_RARITIES = Object.keys(ARMOR_RARITY) as ArmorRarity[];
/** Tope de reducción total con las tres piezas (que nunca se vuelva invulnerable). */
export const MAX_REDUCTION = 0.6;

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
let uid = 1;
export const setArmorUid = (n: number) => { uid = Math.max(uid, n); };

/** Pieza nueva (ranura, variante y rareza al azar si no se dan), con algo de variación por semilla. */
export function makeArmor(seed: number, slot?: ArmorSlot, rarity?: ArmorRarity, variant?: ArmorVariant): ArmorSpec {
  const r = rng(seed);
  const sl = slot ?? ARMOR_SLOTS[Math.floor(r() * 3)], va = variant ?? ARMOR_VARIANTS[Math.floor(r() * 3)];
  const ra = rarity ?? (["comun", "comun", "comun", "poco", "poco", "rara", "epica", "legendaria"] as ArmorRarity[])[Math.floor(r() * 8)];
  const q = ARMOR_RARITY[ra], v = VAR[va];
  const pool = [...ARMOR_PERKS[sl]], perks: ArmorSpec["perks"] = [];
  for (let i = 0; i < q.perks && pool.length; i++) {
    const id = pool.splice(Math.floor(r() * pool.length), 1)[0];
    perks.push({ id, value: +(PERK_VALUE[id] * q.mult * v.perkMul * (0.9 + r() * 0.2)).toFixed(3) });
  }
  return { uid: uid++, slot: sl, variant: va, rarity: ra, seed, reduction: +(BASE[sl] * v.red * q.mult * (0.92 + r() * 0.16)).toFixed(3), perks, slow: v.slow };
}

/** Efecto conjunto de lo que se lleva puesto. */
export interface ArmorTotals { reduction: number; slow: number; perk: Record<ArmorPerk, number> }
export function armorTotals(worn: (ArmorSpec | null)[]): ArmorTotals {
  const perk = Object.fromEntries(Object.keys(PERK_VALUE).map((k) => [k, 0])) as Record<ArmorPerk, number>;
  let red = 0, slow = 0;
  for (const a of worn) { if (!a) continue; red += a.reduction; slow += a.slow; for (const p of a.perks) perk[p.id] += p.value; }
  return { reduction: Math.min(MAX_REDUCTION, red), slow, perk };
}

/** Fracción del daño que llega al jugador según el tipo de golpe (cuerpo a cuerpo, esfera, explosión, fuego…). */
export function damageTaken(t: ArmorTotals, kind: "melee" | "orb" | "explosive" | "fire" | "shock" | "bullet" = "melee", head = false): number {
  const extra = kind === "melee" ? t.perk.meleeGuard : kind === "orb" ? t.perk.orbGuard : kind === "explosive" ? t.perk.explosiveGuard : kind === "fire" ? t.perk.fireGuard : kind === "shock" ? t.perk.shockGuard : 0;
  const hs = head ? t.perk.headshotGuard : 0;
  return Math.max(0.25, (1 - t.reduction) * (1 - Math.min(0.5, extra)) * (1 - Math.min(0.4, hs)));
}
