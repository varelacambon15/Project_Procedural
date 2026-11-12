// Generador de armas: decide variante, piezas, accesorios, rareza, habilidades y estadísticas a partir de una semilla.
// Lógica pura (sin Three.js): se puede probar sin navegador. Los textos se traducen fuera, a partir de los ids.
import { hashString, mulberry32, pick, type Rng } from "./rng";
import { ACCESSORIES, accessory } from "./accessories";
import { KIT_MODS, KitIndex, isKit, kitMagazine, kitMuzzleOptions, kitOpticOptions, rollKit } from "./kit";
import { NO_TWEAKS, type AssetEntry, type Effect, type FireMode, type Manifest, type Paint, type PartPick, type PartRole, type Rarity, type Stats, type StatKey, type Tweaks, type WeaponSpec, type WeaponType } from "./types";

export type BaseType = Exclude<WeaponType, "accessory">;

// ---------- Rarezas ----------
// Blanca: base, sin efectos ni accesorios. Verde: +5-10% y 1 accesorio. Azul: +10-18% y 1 efecto A.
// Morada: +15-25%, 1 efecto B y 1 A. Legendaria: banda propia, B + A + L (firma con nombre propio).
export const RARITIES: Rarity[] = [
  { id: "comun", weight: 40, budget: 0, tiers: [], accessories: [0, 0], color: "#c9c6bd" },
  { id: "poco", weight: 28, budget: 0.075, tiers: [], accessories: [1, 1], color: "#5fc25a" },
  { id: "rara", weight: 18, budget: 0.14, tiers: ["A"], accessories: [0, 1], color: "#4a9bf0" },
  { id: "epica", weight: 10, budget: 0.2, tiers: ["B", "A"], accessories: [1, 2], color: "#a866f0" },
  { id: "legendaria", weight: 4, budget: 0.32, tiers: ["B", "A", "L"], accessories: [1, 2], color: "#f08a24" },
];
/** Peso de cada estadística en la puntuación de poder (para repartir el presupuesto y comprobar las bandas). */
export const POWER_WEIGHTS: Record<StatKey, number> = { dano: 0.35, cadencia: 0.25, precision: 0.12, alcance: 0.1, manejo: 0.1, cargador: 0.08 };
/** Puntuación de poder: media ponderada de cada estadística respecto a la base de su tipo. */
export function powerScore(stats: Stats, type: WeaponType): number {
  const base = TYPE_INFO[type as BaseType].base;
  let p = 0; for (const k of Object.keys(POWER_WEIGHTS) as StatKey[]) p += POWER_WEIGHTS[k] * (stats[k] / base[k]);
  return p;
}

// ---------- Tipos y variantes ----------
/** Modificadores de una variante: multiplicadores para daño/cadencia/cargador/alcance y puntos para precisión/manejo. */
interface Arch { id: string; mode: FireMode; w: number; dano?: number; cadencia?: number; cargador?: number; alcance?: number; precision?: number; manejo?: number }
interface TypeInfo { letter: string; base: Stats; calibers: string[]; archetypes: Arch[] }

export const TYPE_INFO: Record<BaseType, TypeInfo> = {
  pistol: { letter: "P", base: { dano: 30, cadencia: 360, precision: 64, alcance: 24, manejo: 78, cargador: 12 }, calibers: ["9", "10", "40", "45", "50", "57"], archetypes: [
    { id: "standard", mode: "semi", w: 5 },
    { id: "machine", mode: "auto", w: 2, dano: 0.62, cadencia: 2.6, cargador: 1.6, precision: -12 },
    { id: "heavy", mode: "semi", w: 2, dano: 1.65, cadencia: 0.62, cargador: 0.6, manejo: -10, alcance: 1.2 },
  ] },
  revolver: { letter: "R", base: { dano: 62, cadencia: 150, precision: 70, alcance: 32, manejo: 62, cargador: 6 }, calibers: ["38", "44", "357", "454", "500"], archetypes: [
    { id: "standard", mode: "semi", w: 4 },
    { id: "heavy", mode: "semi", w: 3, dano: 1.4, cadencia: 0.75, manejo: -8 },
    { id: "quick", mode: "semi", w: 2, dano: 0.8, cadencia: 1.55, manejo: 8 },
  ] },
  smg: { letter: "S", base: { dano: 17, cadencia: 850, precision: 52, alcance: 20, manejo: 80, cargador: 30 }, calibers: ["9", "10", "45", "46", "57"], archetypes: [
    { id: "standard", mode: "auto", w: 4 },
    { id: "rapid", mode: "auto", w: 3, dano: 0.8, cadencia: 1.4, precision: -8 },
    { id: "tactical", mode: "auto", w: 2, dano: 1.3, cadencia: 0.7, precision: 8, alcance: 1.2 },
    { id: "burst", mode: "burst", w: 1, dano: 1.1, cadencia: 1.15, precision: 6 },
  ] },
  rifle: { letter: "A", base: { dano: 28, cadencia: 650, precision: 66, alcance: 45, manejo: 60, cargador: 30 }, calibers: ["556", "762", "68", "65", "300"], archetypes: [
    { id: "auto", mode: "auto", w: 4 },
    { id: "burst", mode: "burst", w: 2, dano: 1.1, cadencia: 1.2, precision: 6 },
    { id: "heavy", mode: "auto", w: 2, dano: 1.3, cadencia: 0.75, manejo: -8 },
    { id: "marksman", mode: "semi", w: 2, dano: 2.0, cadencia: 0.5, cargador: 0.67, precision: 15, alcance: 1.45, manejo: -6 },
  ] },
  bullpup: { letter: "B", base: { dano: 26, cadencia: 720, precision: 66, alcance: 42, manejo: 68, cargador: 30 }, calibers: ["556", "58", "762"], archetypes: [
    { id: "auto", mode: "auto", w: 3 },
    { id: "burst", mode: "burst", w: 2, dano: 1.1, cadencia: 1.2, precision: 6 },
  ] },
  shotgun: { letter: "E", base: { dano: 15, cadencia: 75, precision: 34, alcance: 14, manejo: 58, cargador: 6 }, calibers: ["12", "16", "20", "410"], archetypes: [
    { id: "pump", mode: "pump", w: 4, dano: 1.15 },
    { id: "semi", mode: "semi", w: 3, dano: 0.85, cadencia: 2.2 },
    { id: "auto", mode: "auto", w: 1, dano: 0.7, cadencia: 3.6, cargador: 1.4 },
    { id: "double", mode: "semi", w: 1, dano: 1.4, cadencia: 3, cargador: 0.34, manejo: 10 },
  ] },
  sniper: { letter: "F", base: { dano: 150, cadencia: 45, precision: 90, alcance: 110, manejo: 40, cargador: 5 }, calibers: ["308", "338", "50", "762", "300"], archetypes: [
    { id: "bolt", mode: "bolt", w: 4, dano: 1.2 },
    { id: "semi", mode: "semi", w: 3, dano: 0.7, cadencia: 2.6, cargador: 2, manejo: 6 },
    { id: "antimateriel", mode: "semi", w: 1, dano: 1.75, cadencia: 0.75, cargador: 2, manejo: -12 },
  ] },
  launcher: { letter: "L", base: { dano: 280, cadencia: 30, precision: 58, alcance: 70, manejo: 30, cargador: 1 }, calibers: ["40", "66", "84"], archetypes: [{ id: "standard", mode: "semi", w: 1 }] },
  flamethrower: { letter: "Q", base: { dano: 8, cadencia: 900, precision: 30, alcance: 9, manejo: 50, cargador: 100 }, calibers: ["1", "2"], archetypes: [{ id: "standard", mode: "auto", w: 1 }] },
  lmg: { letter: "M", base: { dano: 25, cadencia: 760, precision: 46, alcance: 50, manejo: 34, cargador: 100 }, calibers: ["556", "762", "308"], archetypes: [
    { id: "standard", mode: "auto", w: 3 },
    { id: "heavy", mode: "auto", w: 2, dano: 1.25, cadencia: 0.8, manejo: -6 },
    { id: "minigun", mode: "auto", w: 0, dano: 0.6, cadencia: 2.6, cargador: 2.5, precision: -10, manejo: -14 },
  ] },
};
/** Perdigones por disparo (solo escopetas). */
export const PELLETS: Partial<Record<WeaponType, number>> = { shotgun: 8 };
/**
 * Modos de disparo alternativos por tipo: dan variedad ("de todo") con su propio perfil de estadísticas.
 * Solo en armas moradas y legendarias (45% de ellas), sobre la variante elegida.
 */
interface Shift { mode: FireMode; w: number; burst?: [number, number]; dano?: number; cadencia?: number; cargador?: number; precision?: number; manejo?: number }
export const MODE_SHIFTS: Partial<Record<BaseType, Shift[]>> = {
  pistol: [{ mode: "auto", w: 2, dano: 0.6, cadencia: 2.4, cargador: 1.5, precision: -10 }, { mode: "burst", w: 2, burst: [2, 3], dano: 0.85, cadencia: 1.6 }],
  revolver: [{ mode: "burst", w: 2, burst: [2, 3], dano: 0.8, cadencia: 2.2, precision: -6 }, { mode: "auto", w: 1, dano: 0.55, cadencia: 3.5, cargador: 1.34, precision: -14 }],
  smg: [{ mode: "semi", w: 1, dano: 1.5, cadencia: 0.5, precision: 10 }, { mode: "burst", w: 2, burst: [3, 4], cadencia: 1.15 }],
  rifle: [{ mode: "semi", w: 2, dano: 1.6, cadencia: 0.55, precision: 8 }, { mode: "burst", w: 2, burst: [2, 4], dano: 1.05, cadencia: 1.2 }, { mode: "auto", w: 1, dano: 0.75, cadencia: 1.6 }],
  bullpup: [{ mode: "semi", w: 1, dano: 1.6, cadencia: 0.55, precision: 8 }, { mode: "burst", w: 2, burst: [2, 4], dano: 1.05, cadencia: 1.2 }],
  shotgun: [{ mode: "burst", w: 2, burst: [2, 3], dano: 0.8, cadencia: 2.4 }, { mode: "auto", w: 1, dano: 0.65, cadencia: 3.4 }, { mode: "semi", w: 1, dano: 0.85, cadencia: 2 }],
  sniper: [{ mode: "auto", w: 2, dano: 0.42, cadencia: 6, cargador: 2.5, precision: -10, manejo: 6 }, { mode: "burst", w: 2, burst: [2, 3], dano: 0.6, cadencia: 3.5, cargador: 1.6 }, { mode: "semi", w: 1, dano: 0.75, cadencia: 2.4, cargador: 2 }],
  lmg: [{ mode: "burst", w: 1, burst: [4, 5], dano: 1.1, cadencia: 1.1, precision: 8 }],
  launcher: [{ mode: "burst", w: 1, burst: [2, 3], dano: 0.7, cadencia: 2, cargador: 3 }],
};
export const shiftOf = (spec: Pick<WeaponSpec, "type" | "modeShift">) => (spec.modeShift ? MODE_SHIFTS[spec.type as BaseType]?.find((x) => x.mode === spec.modeShift) ?? null : null);

/**
 * El arma se comporta según el modelo: variante habitual y capacidad real del cargador.
 * Con un 30% de probabilidad sale otra variante del mismo tipo ("de todo": pistolas automáticas, subfusiles lentos…).
 */
const MODEL_HINTS: Record<string, { arch?: string; mag?: number; strict?: boolean }> = {
  "w-glock17": { arch: "standard", mag: 17 }, "w-usp45": { arch: "standard", mag: 12 }, "w-m1911": { arch: "heavy", mag: 8 }, "w-luger": { arch: "standard", mag: 8 },
  "w-deagle": { arch: "heavy", mag: 7 }, "m-deagle": { arch: "heavy", mag: 7 }, "m-m1911": { arch: "heavy", mag: 8 }, "w-revolver": { arch: "heavy", mag: 6 },
  "w-uzi": { arch: "rapid", mag: 32 }, "w-vector": { arch: "rapid", mag: 25 }, "w-p90": { arch: "standard", mag: 50 }, "w-mp5k": { arch: "standard", mag: 30 },
  "w-sten": { arch: "tactical", mag: 32 }, "w-ppsh": { arch: "rapid", mag: 71 },
  "w-ak47": { arch: "heavy", mag: 30 }, "w-m16a4": { arch: "burst", mag: 30 }, "w-scarh": { arch: "heavy", mag: 20 }, "w-g36": { arch: "auto", mag: 30 },
  "w-xm8": { arch: "auto", mag: 30 }, "w-garand": { arch: "marksman", mag: 8 }, "w-f2000": { arch: "auto", mag: 30 }, "w-famas": { arch: "burst", mag: 25 },
  "w-aa12": { arch: "auto", mag: 20 }, "w-spas12": { arch: "pump", mag: 8 }, "w-sawedoff": { arch: "double", mag: 2 }, "q-shotgun-sawedoff": { arch: "double", mag: 2 },
  "w-l115": { arch: "bolt", mag: 5 }, "w-barrett": { arch: "antimateriel", mag: 10 }, "w-vss": { arch: "semi", mag: 10 },
  // Armas antiguas (Wp-Pack-2): su mecanismo manda (un fusil de palanca nunca dispara en automático)
  ...Object.fromEntries(["v-boltaction-rifles-a-short", "v-boltaction-rifles-b-short", "v-lever-rifles-long", "v-lever-rifles-medium", "v-lever-rifles-short", "v-revolver-rifles-long", "v-revolver-rifles-medium", "v-revolver-rifles-short"].map((id) => [id, { arch: "marksman", mag: id.includes("revolver") ? 6 : id.includes("lever") ? 8 : 5, strict: true }])),
  ...Object.fromEntries(["a-long", "a-medium", "b-long", "b-medium"].map((v) => [`v-boltaction-rifles-${v}`, { arch: "bolt", mag: 5, strict: true }])),
  "v-pump-shotgun-long": { arch: "pump", mag: 7, strict: true }, "v-pump-shotgun-short": { arch: "pump", mag: 5, strict: true }, "v-lever-shotgun": { arch: "pump", mag: 5, strict: true },
  "v-carabine-shotgun-long": { arch: "pump", mag: 6, strict: true }, "v-carabine-shotgun-short": { arch: "pump", mag: 4, strict: true },
  "v-hunter-shotgun-complete": { arch: "double", mag: 2, strict: true }, "v-hunter-shotgun-mini": { arch: "double", mag: 2, strict: true }, "v-hunter-shotgun-sawoff": { arch: "double", mag: 2, strict: true },
  "v-ppsh": { arch: "rapid", mag: 35 }, "v-ppsh-drum": { arch: "rapid", mag: 71 }, "v-m3gg": { arch: "standard", mag: 30 }, "v-m3gg-drum": { arch: "standard", mag: 50 },
  "z-assaultrifle-01": { arch: "heavy", mag: 30 }, "z-shotgun-01": { arch: "pump", mag: 6 }, "z-shotgun-02": { arch: "pump", mag: 6 }, "z-shotgun-03": { arch: "double", mag: 2, strict: true },
  "z-sniperrifle-01": { arch: "bolt", mag: 5 }, "z-sniperrifle-02": { arch: "bolt", mag: 5 },
  "w-m249": { arch: "standard", mag: 100 }, "w-m60": { arch: "heavy", mag: 100 }, "w-minigun": { arch: "minigun", mag: 300 },
};

/** Modelos que ya llevan silenciador u otro dispositivo integrado en el cañón. */
const INTEGRATED_MUZZLE = new Set(["w-usp45", "w-vss", "w-minigun"]);

// ---------- Acabados ----------
export const PAINTS: Paint[] = [
  { id: "original", color: null },
  { id: "black", color: [0.1, 0.1, 0.11], secondary: [0.16, 0.16, 0.17] },
  { id: "fde", color: [0.47, 0.39, 0.28], secondary: [0.42, 0.35, 0.25] },
  { id: "olive", color: [0.3, 0.32, 0.22], secondary: [0.26, 0.28, 0.2] },
  { id: "gray", color: [0.33, 0.34, 0.36], secondary: [0.14, 0.14, 0.15] },
  { id: "rust", color: [0.4, 0.24, 0.15], secondary: [0.2, 0.15, 0.11] },
  { id: "fdeblack", color: [0.12, 0.12, 0.13], secondary: [0.47, 0.39, 0.28] },
  { id: "olivefde", color: [0.3, 0.32, 0.22], secondary: [0.47, 0.39, 0.28] },
  { id: "grayblack", color: [0.33, 0.34, 0.36], secondary: [0.1, 0.1, 0.11] },
];
const PAINT_WEIGHTS = [3, 1.2, 1, 1, 1, 0.6, 0.9, 0.7, 0.8];

// ---------- Efectos ----------
// Nivel A: mejora pequeña de un aspecto. Nivel B: se nota en combate (incluye fuego, eléctrico y explosivo).
// Nivel L: firma única de cada legendaria; da nombre al arma. Un A y un B nunca son de la misma familia.
interface EffectDef { id: string; tier: Effect["tier"]; family: string; element?: Effect["element"]; icon: string; color: string; range?: [number, number]; name?: string }
const A_COLOR = "#d8d2c4", B_COLOR = "#e8b25a", L_COLOR = "#f08a24";
export const EFFECTS_A: EffectDef[] = [
  { id: "steady", tier: "A", family: "recoil", icon: "≡", color: A_COLOR, range: [15, 25] },
  { id: "quickdraw", tier: "A", family: "draw", icon: "⇡", color: A_COLOR },
  { id: "headhunter", tier: "A", family: "crit", icon: "◎", color: A_COLOR, range: [15, 25] },
  { id: "extmag", tier: "A", family: "mag", icon: "▤", color: A_COLOR, range: [15, 25] },
  { id: "range", tier: "A", family: "range", icon: "⟷", color: A_COLOR, range: [10, 20] },
  { id: "opening", tier: "A", family: "dmg", icon: "①", color: A_COLOR, range: [15, 30] },
  { id: "killreload", tier: "A", family: "reload", icon: "↻", color: A_COLOR, range: [25, 40] },
  { id: "scavenger", tier: "A", family: "ammo", icon: "✚", color: A_COLOR },
  { id: "adsfocus", tier: "A", family: "accuracy", icon: "⌖", color: A_COLOR, range: [20, 35] },
  { id: "pierce", tier: "A", family: "pierce", icon: "➝", color: A_COLOR },
];
export const EFFECTS_B: EffectDef[] = [
  { id: "fuego", tier: "B", family: "element", element: "fuego", icon: "▲", color: "#f07a2a" },
  { id: "electrico", tier: "B", family: "element", element: "electrico", icon: "ϟ", color: "#5cc8f0" },
  { id: "explosive", tier: "B", family: "element", element: "explosive", icon: "✸", color: "#ffb060" },
  { id: "doble", tier: "B", family: "proj", icon: "Ⅱ", color: B_COLOR },
  { id: "rebote", tier: "B", family: "proj", icon: "↯", color: B_COLOR },
  { id: "eco", tier: "B", family: "proj", icon: "≋", color: B_COLOR },
  { id: "piercing", tier: "B", family: "pierce", icon: "➶", color: B_COLOR },
  { id: "killclip", tier: "B", family: "reload", icon: "⚡", color: B_COLOR },
  { id: "rampage", tier: "B", family: "dmg", icon: "»", color: B_COLOR },
  { id: "frenzy", tier: "B", family: "rate", icon: "≫", color: B_COLOR },
];
/** Firmas legendarias: cada una tiene nombre propio, comportamiento, color y sonido propios. */
export const EFFECTS_L: EffectDef[] = [
  { id: "lastrounds", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Last Will" },
  { id: "widowmark", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Black Widow" },
  { id: "olddog", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Old Dog" },
  { id: "requiem", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Rust Requiem" },
  { id: "deadhand", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Dead Man's Hand" },
  { id: "stormcaller", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Storm Caller" },
  { id: "verdict", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "Final Verdict" },
  { id: "echochamber", tier: "L", family: "sig", icon: "★", color: L_COLOR, name: "The Echo" },
];
export const effectValue = (s: WeaponSpec, id: string) => s.effects.find((e) => e.id === id)?.value ?? 0;
export const hasEffect = (s: WeaponSpec, id: string) => s.effects.some((e) => e.id === id);
export const elementOf = (s: WeaponSpec) => s.effects.find((e) => e.element)?.element ?? null;

/** Modificadores estables de una pieza: dependen solo de su procedencia y su rol. */
export function partMods(from: string, role: string): Partial<Stats> {
  const acc = accessory(from);
  if (acc) return acc.mods;
  if (isKit(from)) return KIT_MODS[from] ?? {};
  const r = mulberry32(hashString(`${from}#${role}`));
  const keys: StatKey[] = ["dano", "cadencia", "precision", "alcance", "manejo", "cargador"];
  const relevant: Record<string, StatKey[]> = {
    body: keys, frame: ["manejo", "cargador", "precision"], slide: ["dano", "cadencia", "precision"], barrel: ["alcance", "precision"],
    magazine: ["cargador", "manejo"], scope: ["precision", "alcance", "manejo"], muzzle: ["precision", "alcance", "dano"],
  };
  const out: Partial<Stats> = {};
  for (const k of relevant[role] ?? []) if (r() < 0.6) out[k] = Math.round((r() * 2 - 1) * 7);
  return out;
}

function rollRarity(r: Rng): Rarity {
  let roll = r() * RARITIES.reduce((s, x) => s + x.weight, 0);
  for (const x of RARITIES) { if (roll < x.weight) return x; roll -= x.weight; }
  return RARITIES[0];
}
function weighted<T>(r: Rng, arr: T[], w: (x: T) => number): T {
  const total = arr.reduce((s, x) => s + w(x), 0); let roll = r() * total;
  for (const x of arr) { roll -= w(x); if (roll < 0) return x; }
  return arr[arr.length - 1];
}
/** Estilo de cada familia: las piezas se mezclan sobre todo dentro del mismo estilo. */
const STYLE: Record<string, string> = { modern: "modern", zsky: "modern", asimov: "modern", misc: "modern", kit: "modern", wp2: "vintage", quaternius: "toon" };
/** Proporción de armas del kit modular en cada tipo que lo admite. */
const KIT_SHARE: Partial<Record<WeaponType, number>> = { rifle: 0.4, pistol: 0.3, shotgun: 0.4 };
/** Peso de cada pack al elegir el cuerpo: los modelos más realistas salen más a menudo. */
const PACK_WEIGHT: Record<string, number> = { modern: 4, asimov: 2.5, misc: 2.5, wp2: 2.5, zsky: 2, quaternius: 1.5, cosmo: 1 };

export function archetypeOf(spec: Pick<WeaponSpec, "type" | "archetype">): Arch {
  const info = TYPE_INFO[spec.type as BaseType];
  return info.archetypes.find((a) => a.id === spec.archetype) ?? info.archetypes[0];
}

export class WeaponGenerator {
  readonly byType = new Map<WeaponType, AssetEntry[]>();
  readonly byId = new Map<string, AssetEntry>();
  readonly scopes: AssetEntry[];
  /** Piezas del kit modular (armas montadas por sockets). */
  readonly kit: KitIndex;

  constructor(readonly manifest: Manifest) {
    this.kit = new KitIndex(manifest.kit ?? []);
    for (const w of manifest.weapons) {
      this.byId.set(w.id, w);
      if (w.excluded) continue; // se puede leer (armas guardadas), pero no sale en el botín
      if (!this.byType.has(w.type)) this.byType.set(w.type, []);
      this.byType.get(w.type)!.push(w);
    }
    // Miras de modelo (las de cosmo vienen separadas). Los accesorios de Quaternius ya no se usan: hay accesorios propios.
    this.scopes = manifest.weapons.filter((w) => !w.excluded && w.type !== "accessory" && w.parts.some((p) => p.role === "scope"));
  }

  /** Tipos que salen en el botín. Lanzallamas y lanzacohetes quedan fuera por ahora (como la minigun). */
  get types(): BaseType[] { return [...this.byType.keys()].filter((t): t is BaseType => t !== "accessory" && t !== "flamethrower" && t !== "launcher"); }

  /** Miras (accesorio) que admite un arma. Las que llevan mira integrada en el cuerpo no admiten otra. */
  opticOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const procedural = () => ACCESSORIES.filter((a) => a.kind === "optic" && (!a.for || a.for.includes(spec.type))).map((a) => a.id);
    if (isKit(spec.parts[0].from)) return kitOpticOptions(this.kit, spec, spec.type === "pistol" ? ["acc:reddot"] : procedural());
    const body = this.byId.get(spec.parts[0].from);
    if (!body?.sockets.rail || spec.type === "sniper" || spec.type === "launcher" || spec.type === "flamethrower") return [];
    if (body.parts.some((p) => p.role === "scope")) return [];
    return ACCESSORIES.filter((a) => a.kind === "optic" && (!a.for || a.for.includes(spec.type))).map((a) => a.id);
  }
  muzzleOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const type = spec.type, bodyId = spec.parts[0]?.from;
    if (isKit(bodyId)) return kitMuzzleOptions(this.kit, spec);
    if (type === "launcher" || type === "flamethrower" || (bodyId && INTEGRATED_MUZZLE.has(bodyId))) return [];
    return ACCESSORIES.filter((a) => a.kind === "muzzle").map((a) => a.id);
  }

  generate(seed: number, wanted?: BaseType): WeaponSpec {
    const r = mulberry32(seed);
    const type = wanted ?? pick(r, this.types);
    const pool = this.byType.get(type);
    if (!pool?.length) throw new Error(`No weapons of type ${type}`);
    const info = TYPE_INFO[type];

    // 1. Piezas
    const parts: PartPick[] = [];
    let tweaks: Tweaks = { ...NO_TWEAKS };
    let layout: WeaponSpec["layout"] = "body";
    let kitBarrel = 1;
    const modular = pool.filter((w) => w.parts.some((p) => p.role === "slide"));
    if (this.kit.types().includes(type) && r() < KIT_SHARE[type]!) {
      // Arma del kit modular: plataforma y piezas por sockets
      layout = "kit";
      const k = rollKit(this.kit, r, type);
      parts.push(...k.parts); kitBarrel = k.barrelLength;
      tweaks = { ...NO_TWEAKS, front: k.front, stock: k.stock };
    } else if (type === "pistol" && modular.length >= 2 && r() < 0.35) {
      layout = "modular-pistol";
      const slide = pick(r, modular);
      let frame = pick(r, modular);
      while (frame === slide) frame = pick(r, modular);
      parts.push({ role: "frame", from: frame.id }, { role: "slide", from: slide.id }, { role: "barrel", from: pick(r, modular).id });
    } else {
      const bodies = pool.filter((w) => w.parts.some((p) => p.role === "body" || p.role === "receiver"));
      if (!bodies.length) throw new Error(`No bodies of type ${type}`);
      let candidates = bodies;
      let base = weighted(r, candidates, (x) => (PACK_WEIGHT[x.pack] ?? 1) * (x.modular ? 2 : 1));
      let chosen: { stock: AssetEntry; front: AssetEntry; grip: AssetEntry } | null = null;
      // Arma larga despiezada: si el cajón no admite ninguna pieza ajena (arma genérica), se elige otro
      while (base.modular) {
        tweaks = rollTweaks(r);
        chosen = this.mixLong(r, base, type, tweaks);
        if (chosen) break;
        const rest = candidates.filter((x) => x !== base);
        if (!rest.length) { chosen = { stock: base, front: base, grip: base }; break; } // sin alternativa: el arma tal cual
        candidates = rest;
        base = weighted(r, candidates, (x) => (PACK_WEIGHT[x.pack] ?? 1) * (x.modular ? 2 : 1));
      }
      if (base.modular && chosen) {
        layout = "modular-long";
        parts.push({ role: "receiver", from: base.id });
        parts.push({ role: "stock", from: chosen.stock.id }, { role: "grip", from: chosen.grip.id }, { role: "front", from: chosen.front.id });
      } else { parts.push({ role: "body", from: base.id }); tweaks = { ...NO_TWEAKS, body: 0.97 + r() * 0.06 }; }
      if (base.sockets.magazine) {
        const mags = pool.filter((w) => w.pack === base.pack && w.parts.some((p) => p.role === "magazine"));
        parts.push({ role: "magazine", from: (r() < 0.6 ? pick(r, mags) : base).id });
      }
    }
    const body = this.byId.get(parts[0].from) ?? ({ id: parts[0].from, pack: "kit", parts: [], sockets: {} } as unknown as AssetEntry);
    const barrelLength = layout === "modular-pistol" ? 0.85 + r() * 0.75 : layout === "kit" ? kitBarrel : 1;

    // 2. Variante: la propia del modelo (70%) o cualquiera del tipo
    const hint = MODEL_HINTS[body.id];
    const regular = info.archetypes.filter((a) => a.w > 0);
    const arch = hint?.arch && (r() < 0.7 || hint.strict) ? info.archetypes.find((a) => a.id === hint.arch) ?? regular[0] : weighted(r, regular, (a) => a.w);
    // Rareza (antes que el modo: los modos raros son exclusivos de moradas y legendarias)
    const rarity = rollRarity(r);
    // Modo de disparo: el de la variante o, en moradas y legendarias, a veces uno "raro" para su tipo
    const shifts = (MODE_SHIFTS[type] ?? []).filter((x) => x.mode !== arch.mode);
    const exotic = rarity.id === "epica" || rarity.id === "legendaria";
    const shift = exotic && shifts.length && r() < 0.45 ? weighted(r, shifts, (x) => x.w) : null;
    const fireMode: FireMode = shift?.mode ?? arch.mode;
    const burstRange = shift?.burst ?? [3, 3];
    const burst = fireMode === "burst" ? burstRange[0] + Math.floor(r() * (burstRange[1] - burstRange[0] + 1)) : 0;

    // 3. Accesorios ya montados según la rareza (una mira de modelo integrada no cuenta como accesorio)
    let optic: string | null = null, muzzle: string | null = null;
    const ownScope = body.parts.some((p) => p.role === "scope");
    if (ownScope) optic = body.id;
    const opticOpts = ownScope ? this.scopes.filter((x) => x.pack === body.pack && x.id !== body.id).map((x) => x.id) : this.opticOptions({ type, parts });
    const muzzleOpts = this.muzzleOptions({ type, parts });
    const [amin, amax] = rarity.accessories;
    let nAcc = amin + Math.floor(r() * (amax - amin + 1));
    const slots = [opticOpts.length ? "optic" : "", muzzleOpts.length ? "muzzle" : ""].filter(Boolean);
    if (arch.id === "marksman" && slots.includes("optic")) slots.sort((x) => (x === "optic" ? -1 : 1)); else if (r() < 0.5) slots.reverse();
    for (const slot of slots) {
      if (nAcc <= 0) break;
      if (slot === "optic") optic = pick(r, opticOpts); else muzzle = pick(r, muzzleOpts);
      nAcc--;
    }

    // 4. Acabado y nivel
    const paint = weighted(r, PAINTS, (p) => PAINT_WEIGHTS[PAINTS.indexOf(p)]);
    const level = 8 + Math.floor(r() * 9);

    // 5. Efectos por nivel (A, B, L). Un A y un B no comparten familia; fuego, eléctrico y explosivo son B.
    const effects: Effect[] = [];
    const take = (def: EffectDef) => effects.push({ id: def.id, tier: def.tier, family: def.family, element: def.element, icon: def.icon, color: def.color, value: def.range ? def.range[0] + Math.floor(r() * (def.range[1] - def.range[0] + 1)) : undefined });
    for (const tier of rarity.tiers) {
      const pool = (tier === "A" ? EFFECTS_A : tier === "B" ? EFFECTS_B : EFFECTS_L).filter((d) => !effects.some((e) => e.family === d.family));
      take(pick(r, pool));
    }

    // 6. Reparto del presupuesto de rareza entre 1-3 estadísticas
    const bonus: Partial<Record<StatKey, number>> = {};
    if (rarity.budget > 0) {
      const keys: StatKey[] = ["dano", "cadencia", "precision", "alcance", "manejo", "cargador"];
      const n = 1 + Math.floor(r() * 3);
      const chosen: StatKey[] = [];
      while (chosen.length < n) { const k = pick(r, keys); if (!chosen.includes(k)) chosen.push(k); }
      const shares = chosen.map(() => 0.5 + r()); const sum = shares.reduce((x, y) => x + y, 0);
      chosen.forEach((k, i) => (bonus[k] = shares[i] / sum));
    }

    // 7. Nombre propio (solo legendarias, en inglés): el de su firma L
    const sig = EFFECTS_L.find((d) => effects.some((e) => e.id === d.id));
    const name = sig?.name ?? "";
    const statSeed = Math.floor(r() * 2 ** 31);
    const spec: WeaponSpec = { seed, type, archetype: arch.id, fireMode, modeShift: shift?.mode ?? null, burst, layout, parts, barrelLength, muzzle, optic, rarity, paint, level, stats: { ...info.base }, effects, name, statSeed, bonus, tweaks };
    return this.refresh(spec);
  }

  /**
   * Piezas de un arma larga despiezada: cajón de una, culata, empuñadura y guardamanos de otras armas (de su familia
   * o de otra), siempre que pasen la puerta de calidad. Al menos dos de las tres piezas son ajenas (o una, si no cabe);
   * si no hay ninguna combinación, null.
   */
  private mixLong(r: Rng, base: AssetEntry, type: BaseType, tweaks: Tweaks): { stock: AssetEntry; front: AssetEntry; grip: AssetEntry } | null {
        // Piezas aprobadas con una unión del mismo tipo, de su familia o de otra (se adaptan a la junta: pieceScale)
        const donors = (role: PartRole, ok: (w: AssetEntry) => boolean) => this.manifest.weapons.filter((w) => w.modular && !w.excluded && w.id !== base.id && ok(w) && w.parts.some((p) => p.role === role) && (!w.approved || w.approved.includes(role)) && !w.quarantine);
        const cls = (t: WeaponType) => (t === "smg" ? "compact" : "long");
        const fit = (joint: "rear" | "front" | "grip", lo: number, hi: number) => (w: AssetEntry) => within(jointScale(base, w, joint), lo, hi);
        const stocks = donors("stock", (w) => cls(w.type) === cls(type)).filter(fit("rear", 0.7, 1.4));
        const fronts = donors("front", (w) => w.type === type || (cls(w.type) === cls(type) && type !== "sniper" && w.type !== "sniper")).filter(fit("front", 0.7, 1.4));
        const grips = donors("grip", () => true).filter(fit("grip", 0.72, 1.35));
        // Familia propia (45%), otra familia del mismo estilo (35%) u otro estilo (20%): flexible, pero con predominio coherente
        const style = (w: AssetEntry) => STYLE[w.pack] ?? "modern";
        const choose = (list: AssetEntry[]) => {
          if (!list.length) return base;
          const own = list.filter((w) => w.pack === base.pack), same = list.filter((w) => w.pack !== base.pack && style(w) === style(base)), other = list.filter((w) => style(w) !== style(base));
          const x = r(); const order = x < 0.45 ? [own, same, other] : x < 0.8 ? [same, own, other] : [other, same, own];
          return pick(r, order.find((l) => l.length)!);
        };
        // Nada de armas genéricas: al menos dos de las tres piezas vienen de otras armas (si no cabe, al menos una)
        for (const need of [2, 1]) {
          for (let tries = 0; tries < 30; tries++) {
            const c = { stock: r() < 0.85 ? choose(stocks) : base, front: r() < 0.85 ? choose(fronts) : base, grip: r() < 0.85 ? choose(grips) : base };
            const foreign = [c.stock, c.front, c.grip].filter((x) => x !== base).length;
            if (foreign >= need && longGunOk(base, c.stock, c.front, c.grip, type, tweaks)) return c;
          }
        }
        return null;
  }

  /** Recalcula estadísticas y nombre técnico (tras generar o tras cambiar piezas en el banco). */
  refresh(spec: WeaponSpec): WeaponSpec {
    spec.stats = computeStats(spec);
    if (spec.rarity.id !== "legendaria") spec.name = technicalName(spec);
    return spec;
  }
}

/** Longitud de referencia de cada tipo (m), la misma que usa el conversor. */
export const TYPE_LENGTH: Partial<Record<WeaponType, number>> = { pistol: 0.22, revolver: 0.26, smg: 0.5, rifle: 0.9, bullpup: 0.75, shotgun: 1.0, sniper: 1.2, lmg: 1.15, launcher: 1.1, flamethrower: 0.95 };
const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
/** Escala con la que una pieza encaja en la junta del cajón (relación de secciones). */
export function jointScale(recv: AssetEntry, donor: AssetEntry, joint: "rear" | "front" | "grip"): number {
  const face = { rear: "stockFace", front: "frontFace", grip: "gripFace" }[joint] as "stockFace" | "frontFace" | "gripFace";
  const a = recv.joints![joint].size![0], b = donor.joints![face].size![0];
  return b > 1e-4 ? a / b : 0;
}
/**
 * Puerta de calidad de un arma larga montada con piezas de varias: las secciones de cada junta deben ser parecidas
 * (para no deformar las piezas) y la longitud total debe quedar dentro del rango del tipo.
 */
/**
 * Escala de una pieza donada para que encaje en la junta del cajón. La sección de la junta se iguala exactamente
 * (alto en culata y guardamanos, largo en la empuñadura) y el grosor se ajusta al del cajón; el largo de la pieza
 * apenas cambia, así una pieza de otra familia se adapta sin deformarse. Incluye las variaciones leves (tweaks).
 */
export function pieceScale(recv: AssetEntry, donor: AssetEntry, role: "stock" | "front" | "grip", tw: Tweaks = NO_TWEAKS): [number, number, number] {
  const len = role === "stock" ? tw.stock : role === "front" ? tw.front : tw.grip;
  if (donor.id === recv.id) return role === "grip" ? [tw.grip, tw.grip, 1] : [len, 1, 1];
  const k = jointScale(recv, donor, role === "stock" ? "rear" : role);
  const thick = (recv.bounds.max[2] - recv.bounds.min[2]) / Math.max(1e-4, donor.bounds.max[2] - donor.bounds.min[2]);
  const sz = THREE_clamp(thick, 0.75, 1.35);
  const mild = THREE_clamp(k, 0.88, 1.14);
  return role === "grip" ? [k * tw.grip, mild * tw.grip, sz] : [mild * len, k, sz];
}
const THREE_clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Silueta vertical (y la anchura de la empuñadura) de una pieza ajena colocada en el cajón, comparada con la original. */
function shapeOk(recv: AssetEntry, donor: AssetEntry, role: "stock" | "front" | "grip", tw: Tweaks): boolean {
  if (donor.id === recv.id) return true;
  const own = recv.partBounds?.[role], db = donor.partBounds?.[role];
  if (!own || !db || !recv.joints || !donor.joints) return true;
  const [sx, sy] = pieceScale(recv, donor, role, tw);
  const face = role === "stock" ? donor.joints.stockFace : role === "front" ? donor.joints.frontFace : donor.joints.gripFace;
  const at = role === "stock" ? recv.joints.rear : role === "front" ? recv.joints.front : recv.joints.grip;
  const top = at.pos[1] + (db.max[1] - face.pos[1]) * sy, bottom = at.pos[1] + (db.min[1] - face.pos[1]) * sy;
  const H = own.max[1] - own.min[1];
  if (role === "grip") {
    // Empuñadura: largo y ancho parecidos a la original
    const len = (db.max[1] - db.min[1]) * sy, wid = (db.max[0] - db.min[0]) * sx;
    return len < H * 1.25 && len > H * 0.7 && wid < (own.max[0] - own.min[0]) * 1.35;
  }
  // Culata y guardamanos: ni por encima ni por debajo de la original más de un 25-35% de su alto
  return top <= own.max[1] + H * 0.25 && bottom >= own.min[1] - H * (role === "stock" ? 0.35 : 0.3);
}

export function longGunOk(recv: AssetEntry, stock: AssetEntry, front: AssetEntry, grip: AssetEntry, type: WeaponType, tw: Tweaks = NO_TWEAKS): boolean {
  if (!recv.joints || !stock.joints || !front.joints || !grip.joints) return false;
  const own = (x: AssetEntry) => x.id === recv.id;
  const kS = own(stock) ? 1 : jointScale(recv, stock, "rear"), kF = own(front) ? 1 : jointScale(recv, front, "front"), kG = own(grip) ? 1 : jointScale(recv, grip, "grip");
  // La sección se adapta (solo en un eje), así que se admite más diferencia; aun así nada desproporcionado
  if (!within(kS, 0.7, 1.4) || !within(kF, 0.7, 1.4) || !within(kG, 0.72, 1.35)) return false;
  // Puerta de forma: cada pieza ajena, ya escalada y colocada en su junta, debe quedar dentro de la silueta de la
  // pieza original del cajón (con margen). Evita guardamanos a la altura de la mira, empuñaduras enormes o culatas
  // desproporcionadas.
  if (!shapeOk(recv, stock, "stock", tw) || !shapeOk(recv, front, "front", tw) || !shapeOk(recv, grip, "grip", tw)) return false;
  const J = recv.joints;
  const stockLen = (stock.joints.stockFace.pos[0] - stock.bounds.min[0]) * pieceScale(recv, stock, "stock", tw)[0];
  const frontLen = (front.bounds.max[0] - front.joints.frontFace.pos[0]) * pieceScale(recv, front, "front", tw)[0];
  const len = (J.front.pos[0] - J.rear.pos[0]) + stockLen + frontLen;
  const target = TYPE_LENGTH[type] ?? 0.9;
  // Longitud total del tipo y proporciones: ni culatas enanas ni guardamanos desmesurados
  return within(len / target, 0.85, 1.18) && within(stockLen / len, 0.14, 0.42) && within(frontLen / len, 0.18, 0.55);
}

/** Variaciones leves de las piezas (deterministas por semilla). */
function rollTweaks(r: Rng): Tweaks {
  return { stock: 0.86 + r() * 0.3, front: 0.85 + r() * 0.33, grip: 0.92 + r() * 0.18, gripAngle: -0.1 + r() * 0.18, body: 1 };
}

export function computeStats(spec: WeaponSpec): Stats {
  const info = TYPE_INFO[spec.type as BaseType];
  const a = archetypeOf(spec);
  const s: Stats = { ...info.base };
  const hint = MODEL_HINTS[spec.parts[0].from];
  // Variante (si es la propia del modelo, se usa la capacidad real de su cargador)
  s.dano *= a.dano ?? 1; s.cadencia *= a.cadencia ?? 1; s.alcance *= a.alcance ?? 1;
  const kitMag = spec.layout === "kit" ? kitMagazine(spec) : null;
  s.cargador = kitMag ? kitMag * (a.cargador ?? 1) : hint?.mag && hint.arch === a.id ? hint.mag : (hint?.mag ?? s.cargador) * (a.cargador ?? 1);
  s.precision += a.precision ?? 0; s.manejo += a.manejo ?? 0;
  // Modo de disparo raro
  const sh = shiftOf(spec);
  if (sh) { s.dano *= sh.dano ?? 1; s.cadencia *= sh.cadencia ?? 1; s.cargador *= sh.cargador ?? 1; s.precision += sh.precision ?? 0; s.manejo += sh.manejo ?? 0; }
  // Nivel
  s.dano *= 1 + (spec.level - 8) * 0.06;
  // Piezas y accesorios
  const apply = (mods: Partial<Stats>) => {
    for (const [key, v] of Object.entries(mods) as [StatKey, number][]) {
      if (key === "precision" || key === "manejo") s[key] += v; // en puntos
      else s[key] *= 1 + v / 100;                                // en %
    }
  };
  for (const p of spec.parts) apply(partMods(p.from, p.role));
  if (spec.optic) apply(partMods(spec.optic, "scope"));
  if (spec.muzzle) apply(partMods(spec.muzzle, "muzzle"));
  // Variaciones de pieza: guardamanos más largo = más alcance y precisión, menos manejo; culata más larga = más estable
  const tw = spec.tweaks ?? NO_TWEAKS;
  s.alcance *= 1 + (tw.front - 1) * 0.8; s.precision += (tw.front - 1) * 15; s.manejo -= (tw.front - 1) * 15;
  s.precision += (tw.stock - 1) * 15; s.manejo -= (tw.stock - 1) * 10;
  const L = spec.barrelLength;
  if (spec.layout === "kit") { s.alcance *= 1 + (L - 1) * 0.7; s.precision += (L - 1) * 10; s.manejo -= (L - 1) * 12; }
  if (spec.layout === "modular-pistol") { s.alcance *= 1 + (L - 1) * 0.9; s.precision += (L - 1) * 14; s.manejo -= (L - 1) * 16; }
  // Habilidades que cambian números (y penalizaciones de los elementos)
  const ev = (id: string) => spec.effects.find((e) => e.id === id)?.value ?? 0;
  if (ev("extmag")) s.cargador *= 1 + ev("extmag") / 100;
  if (ev("range")) s.alcance *= 1 + ev("range") / 100;
  if (spec.effects.some((e) => e.id === "quickdraw")) s.manejo += 10;
  if (spec.effects.some((e) => e.id === "doble")) s.dano *= 0.62;
  if (spec.effects.some((e) => e.id === "electrico")) s.dano *= 0.9;   // menos daño directo
  if (spec.effects.some((e) => e.id === "explosive")) s.dano *= 0.85;  // menos daño directo
  // Pequeña variación estable
  const v = mulberry32(spec.statSeed);
  for (const k of Object.keys(s) as StatKey[]) s[k] *= 0.97 + v() * 0.06;
  s.precision = Math.min(95, Math.max(5, s.precision));
  s.manejo = Math.min(95, Math.max(5, s.manejo));
  // Rareza: el presupuesto se reparte entre las estadísticas elegidas para que el poder suba exactamente `budget`
  applyBudget(s, spec);
  s.precision = Math.min(100, s.precision); s.manejo = Math.min(100, s.manejo);
  s.cargador = Math.max(1, Math.round(s.cargador));
  return s;
}

/** Aplica el presupuesto de la rareza: sube las estadísticas elegidas hasta que el poder crece un `budget`. */
function applyBudget(s: Stats, spec: WeaponSpec) {
  const budget = spec.rarity.budget; if (!budget) return;
  const base = TYPE_INFO[spec.type as BaseType].base;
  const total = powerScore(s, spec.type);
  let leftover = 0; // poder que no cabe por el tope de 100 en precisión o manejo: pasa al daño
  for (const [k, share] of Object.entries(spec.bonus ?? {}) as [StatKey, number][]) {
    const want = budget * share * total;
    const contrib = POWER_WEIGHTS[k] * (s[k] / base[k]);
    let next = s[k] * (1 + want / Math.max(1e-6, contrib));
    if ((k === "precision" || k === "manejo") && next > 100) { leftover += (POWER_WEIGHTS[k] * (next - 100)) / base[k]; next = 100; }
    s[k] = next;
  }
  if (leftover > 0) s.dano *= 1 + leftover / (POWER_WEIGHTS.dano * (s.dano / base.dano));
}

/** Palabras para los nombres de modelo (posapocalíptico, en inglés como las legendarias). */
const NAME_WORDS = ["Jackal", "Hornet", "Drifter", "Scrapper", "Vulture", "Coyote", "Badger", "Marauder", "Nomad", "Warden", "Harrier", "Mongrel",
  "Bulldog", "Ferret", "Viper", "Kestrel", "Raven", "Ironside", "Outrider", "Rustback", "Dustrunner", "Hellcat", "Magpie", "Wolverine",
  "Prowler", "Longhorn", "Sidewinder", "Gravedigger", "Tinker", "Brigand", "Lynx", "Mule", "Hound", "Scorpion", "Tumbleweed", "Ember",
  "Bastion", "Sparrow", "Rattler", "Bandit", "Grizzly", "Wraith", "Pike", "Hammerhead", "Junker", "Sawtooth", "Gunsmoke", "Patriot"];

/**
 * Designación de las armas no legendarias. Varios estilos (código de serie, nombre de modelo, modelo con número…)
 * elegidos de forma estable según las piezas, así dos armas parecidas rara vez se llaman igual.
 */
export function technicalName(spec: WeaponSpec): string {
  const info = TYPE_INFO[spec.type as BaseType];
  const body = spec.parts[0].from;
  const h = hashString(spec.parts.map((p) => p.from).join("|") + spec.archetype + spec.statSeed);
  const series = info.letter + "KRVMCLDTX"[hashString(body + spec.archetype) % 9];
  const cal = info.calibers[hashString(spec.parts[1]?.from ?? body) % info.calibers.length];
  const L = spec.barrelLength;
  const mode = spec.fireMode === "burst" ? `B${spec.burst}` : spec.modeShift === "auto" || spec.archetype === "machine" ? "A" : spec.modeShift === "semi" ? "S" : spec.archetype === "marksman" ? "DMR" : "";
  const acc = accessory(spec.muzzle);
  const tags = (L > 1.3 ? "L" : L < 0.95 ? "C" : "") + mode;
  const extra = (acc?.quiet ? " SD" : "") + (spec.optic && spec.optic !== body ? " O" : "");
  const mark = spec.rarity.id === "rara" ? " Mk II" : spec.rarity.id === "epica" ? " Mk III" : "";
  // Generador estable por arma: letras (1-4), números de largo variable, mezclas, o un nombre
  const q = mulberry32(h);
  const LET = "ABCDEFGHJKLMNPRSTVWXZ";
  const letters = (n: number) => Array.from({ length: n }, () => LET[Math.floor(q() * LET.length)]).join("");
  const digits = (n: number) => String(Math.floor(q() * 9) + 1) + Array.from({ length: n - 1 }, () => Math.floor(q() * 10)).join("");
  const nL = () => 1 + Math.floor(q() * 4), nD = () => 1 + Math.floor(q() * 4);
  const word = NAME_WORDS[Math.floor(q() * NAME_WORDS.length)];
  const sfx = (tags ? (q() < 0.5 ? "-" : "") + tags : "") + extra + mark;
  const styles = [
    () => `${series}-${cal}${tags}${extra}${mark}`,                          // AR-556B3 SD
    () => `${letters(nL())}${digits(nD())}${sfx}`,                           // K7, XRT4410
    () => `${letters(nL())}-${digits(nD())}${sfx}`,                          // MK-33
    () => `${letters(nL())}-${digits(nD())}${letters(1)}${extra}${mark}`,     // VS-121C
    () => `${digits(nD())}${letters(1 + Math.floor(q() * 2))}${extra}${mark}`,// 770R
    () => `${letters(1)}${digits(nD())}-${letters(nL())}${extra}${mark}`,     // T85-PRK
    () => `${word} ${digits(1 + Math.floor(q() * 3))}${extra}${mark}`,       // Vulture 22
    () => `${word}${extra}${mark}`,                                          // Coyote
    () => `${letters(1 + Math.floor(q() * 2))}${digits(1 + Math.floor(q() * 2))} ${word}${extra}${mark}`, // M14 Drifter
    () => `${word} ${cal}${tags ? "-" + tags : ""}${extra}${mark}`,          // Jackal 762-DMR
  ];
  return styles[Math.floor(q() * styles.length)]();
}
