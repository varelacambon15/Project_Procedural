// Generador de armas: decide variante, piezas, accesorios, rareza, habilidades y estadísticas a partir de una semilla.
// Lógica pura (sin Three.js): se puede probar sin navegador. Los textos se traducen fuera, a partir de los ids.
import { hashString, mulberry32, pick, type Rng } from "./rng";
import { ACCESSORIES, accessory } from "./accessories";
import type { AssetEntry, Effect, FireMode, Manifest, Paint, PartPick, Rarity, Stats, StatKey, WeaponSpec, WeaponType } from "./types";

export type BaseType = Exclude<WeaponType, "accessory">;

// ---------- Rarezas ----------
// Blancas: sin habilidades. Verdes: mejores estadísticas. Azules: +1 habilidad moderada.
// Moradas: +2 habilidades. Legendarias: +2 habilidades y 1 especial.
export const RARITIES: Rarity[] = [
  { id: "comun", weight: 40, mult: 1.0, perks: 0, special: false, color: "#c9c6bd" },
  { id: "poco", weight: 28, mult: 1.08, perks: 0, special: false, color: "#5fc25a" },
  { id: "rara", weight: 18, mult: 1.14, perks: 1, special: false, color: "#4a9bf0" },
  { id: "epica", weight: 10, mult: 1.2, perks: 2, special: false, color: "#a866f0" },
  { id: "legendaria", weight: 4, mult: 1.28, perks: 2, special: true, color: "#f08a24" },
];

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
 * Se aplican con un 28% de probabilidad sobre la variante elegida.
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
const MODEL_HINTS: Record<string, { arch?: string; mag?: number }> = {
  "w-glock17": { arch: "standard", mag: 17 }, "w-usp45": { arch: "standard", mag: 12 }, "w-m1911": { arch: "heavy", mag: 8 }, "w-luger": { arch: "standard", mag: 8 },
  "w-deagle": { arch: "heavy", mag: 7 }, "m-deagle": { arch: "heavy", mag: 7 }, "m-m1911": { arch: "heavy", mag: 8 }, "w-revolver": { arch: "heavy", mag: 6 },
  "w-uzi": { arch: "rapid", mag: 32 }, "w-vector": { arch: "rapid", mag: 25 }, "w-p90": { arch: "standard", mag: 50 }, "w-mp5k": { arch: "standard", mag: 30 },
  "w-sten": { arch: "tactical", mag: 32 }, "w-ppsh": { arch: "rapid", mag: 71 },
  "w-ak47": { arch: "heavy", mag: 30 }, "w-m16a4": { arch: "burst", mag: 30 }, "w-scarh": { arch: "heavy", mag: 20 }, "w-g36": { arch: "auto", mag: 30 },
  "w-xm8": { arch: "auto", mag: 30 }, "w-garand": { arch: "marksman", mag: 8 }, "w-f2000": { arch: "auto", mag: 30 }, "w-famas": { arch: "burst", mag: 25 },
  "w-aa12": { arch: "auto", mag: 20 }, "w-spas12": { arch: "pump", mag: 8 }, "w-sawedoff": { arch: "double", mag: 2 }, "q-shotgun-sawedoff": { arch: "double", mag: 2 },
  "w-l115": { arch: "bolt", mag: 5 }, "w-barrett": { arch: "antimateriel", mag: 10 }, "w-vss": { arch: "semi", mag: 10 },
  "w-m249": { arch: "standard", mag: 100 }, "w-m60": { arch: "heavy", mag: 100 }, "w-minigun": { arch: "minigun", mag: 300 },
};

/** Modelos que ya llevan silenciador u otro dispositivo integrado en el cañón. */
const INTEGRATED_MUZZLE = new Set(["w-usp45", "w-vss", "w-minigun"]);

// ---------- Acabados ----------
export const PAINTS: Paint[] = [
  { id: "original", color: null },
  { id: "black", color: [0.1, 0.1, 0.11] },
  { id: "fde", color: [0.36, 0.31, 0.24] },
  { id: "olive", color: [0.24, 0.26, 0.2] },
  { id: "gray", color: [0.3, 0.31, 0.33] },
  { id: "rust", color: [0.3, 0.2, 0.14] },
];
const PAINT_WEIGHTS = [3, 1.2, 1, 1, 1, 0.6];

// ---------- Habilidades ----------
interface EffectDef { id: string; kind: Effect["kind"]; icon: string; color: string; range?: [number, number]; words: string[] }
const PERK_COLOR = "#d8d2c4", SPECIAL_COLOR = "#f08a24";
const PERKS: EffectDef[] = [
  { id: "fuego", kind: "element", icon: "▲", color: "#f07a2a", range: [8, 16], words: ["Ember", "Blaze", "Pyre"] },
  { id: "corrosivo", kind: "element", icon: "◆", color: "#9bd23c", range: [8, 16], words: ["Acid", "Rust", "Sludge"] },
  { id: "electrico", kind: "element", icon: "ϟ", color: "#5cc8f0", range: [8, 16], words: ["Spark", "Volt", "Storm"] },
  { id: "radiacion", kind: "element", icon: "☢", color: "#d8e04a", range: [6, 12], words: ["Isotope", "Fallout", "Ash"] },
  { id: "extmag", kind: "perk", icon: "▤", color: PERK_COLOR, range: [20, 35], words: ["Hoarder"] },
  { id: "quickdraw", kind: "perk", icon: "⇡", color: PERK_COLOR, words: ["Quick"] },
  { id: "steady", kind: "perk", icon: "≡", color: PERK_COLOR, range: [20, 35], words: ["Steady"] },
  { id: "headhunter", kind: "perk", icon: "◎", color: PERK_COLOR, range: [20, 40], words: ["Hunter"] },
  { id: "opening", kind: "perk", icon: "①", color: PERK_COLOR, range: [25, 50], words: ["Opener"] },
  { id: "reload", kind: "perk", icon: "↻", color: PERK_COLOR, range: [30, 50], words: ["Rush"] },
  { id: "range", kind: "perk", icon: "⟷", color: PERK_COLOR, range: [15, 30], words: ["Far"] },
];
const SPECIALS: EffectDef[] = [
  { id: "rebote", kind: "special", icon: "↯", color: SPECIAL_COLOR, words: ["Ricochet", "Bounce"] },
  { id: "doble", kind: "special", icon: "Ⅱ", color: SPECIAL_COLOR, words: ["Twin", "Double"] },
  { id: "eco", kind: "special", icon: "≋", color: SPECIAL_COLOR, words: ["Echo", "Reprise"] },
  { id: "carronero", kind: "special", icon: "✚", color: SPECIAL_COLOR, words: ["Scavenger", "Vulture"] },
  { id: "explosive", kind: "special", icon: "✸", color: SPECIAL_COLOR, words: ["Detonator", "Blast"] },
  { id: "chain", kind: "special", icon: "ϟ", color: SPECIAL_COLOR, words: ["Arc", "Tesla"] },
  { id: "frenzy", kind: "special", icon: "»", color: SPECIAL_COLOR, words: ["Frenzy", "Rampage"] },
  { id: "piercing", kind: "special", icon: "➶", color: SPECIAL_COLOR, words: ["Lance", "Needle"] },
];
const LEGEND_NAMES = ["Last Will", "Black Widow", "Old Dog", "Rust Requiem", "The Scavenger", "Final Verdict", "Dead Man's Hand", "Wasteland Prayer"];
const LEGEND_NOUNS = ["Bite", "Nail", "Widow", "Hound", "Whisper", "Verdict", "Reaper", "Howler", "Vulture", "Sermon"];
export const effectValue = (s: WeaponSpec, id: string) => s.effects.find((e) => e.id === id)?.value ?? 0;
export const hasEffect = (s: WeaponSpec, id: string) => s.effects.some((e) => e.id === id);

/** Modificadores estables de una pieza: dependen solo de su procedencia y su rol. */
export function partMods(from: string, role: string): Partial<Stats> {
  const acc = accessory(from);
  if (acc) return acc.mods;
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
/** Peso de cada pack al elegir el cuerpo: los modelos más realistas salen más a menudo. */
const PACK_WEIGHT: Record<string, number> = { modern: 4, asimov: 2.5, misc: 2.5, quaternius: 1.5, cosmo: 1 };

export function archetypeOf(spec: Pick<WeaponSpec, "type" | "archetype">): Arch {
  const info = TYPE_INFO[spec.type as BaseType];
  return info.archetypes.find((a) => a.id === spec.archetype) ?? info.archetypes[0];
}

export class WeaponGenerator {
  readonly byType = new Map<WeaponType, AssetEntry[]>();
  readonly byId = new Map<string, AssetEntry>();
  readonly scopes: AssetEntry[];

  constructor(readonly manifest: Manifest) {
    for (const w of manifest.weapons) {
      this.byId.set(w.id, w);
      if (!this.byType.has(w.type)) this.byType.set(w.type, []);
      this.byType.get(w.type)!.push(w);
    }
    // Miras de modelo (las de cosmo vienen separadas). Los accesorios de Quaternius ya no se usan: hay accesorios propios.
    this.scopes = manifest.weapons.filter((w) => w.type !== "accessory" && w.parts.some((p) => p.role === "scope"));
  }

  get types(): BaseType[] { return [...this.byType.keys()].filter((t): t is BaseType => t !== "accessory"); }

  /** Miras (accesorio) que admite un arma. Las que llevan mira integrada en el cuerpo no admiten otra. */
  opticOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const body = this.byId.get(spec.parts[0].from);
    if (!body?.sockets.rail || spec.type === "sniper" || spec.type === "launcher" || spec.type === "flamethrower") return [];
    if (body.parts.some((p) => p.role === "scope")) return [];
    return ACCESSORIES.filter((a) => a.kind === "optic" && (!a.for || a.for.includes(spec.type))).map((a) => a.id);
  }
  muzzleOptions(type: WeaponType, bodyId?: string): string[] {
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
    let layout: WeaponSpec["layout"] = "body";
    const modular = pool.filter((w) => w.parts.some((p) => p.role === "slide"));
    if (type === "pistol" && modular.length >= 2 && r() < 0.35) {
      layout = "modular-pistol";
      const slide = pick(r, modular);
      let frame = pick(r, modular);
      while (frame === slide) frame = pick(r, modular);
      parts.push({ role: "frame", from: frame.id }, { role: "slide", from: slide.id }, { role: "barrel", from: pick(r, modular).id });
    } else {
      const bodies = pool.filter((w) => w.parts.some((p) => p.role === "body"));
      if (!bodies.length) throw new Error(`No bodies of type ${type}`);
      const base = weighted(r, bodies, (x) => PACK_WEIGHT[x.pack] ?? 1);
      parts.push({ role: "body", from: base.id });
      if (base.sockets.magazine) {
        const mags = pool.filter((w) => w.pack === base.pack && w.parts.some((p) => p.role === "magazine"));
        parts.push({ role: "magazine", from: (r() < 0.6 ? pick(r, mags) : base).id });
      }
    }
    const body = this.byId.get(parts[0].from)!;
    const barrelLength = layout === "modular-pistol" ? 0.85 + r() * 0.75 : 1;

    // 2. Variante: la propia del modelo (70%) o cualquiera del tipo
    const hint = MODEL_HINTS[body.id];
    const regular = info.archetypes.filter((a) => a.w > 0);
    const arch = hint?.arch && r() < 0.7 ? info.archetypes.find((a) => a.id === hint.arch) ?? regular[0] : weighted(r, regular, (a) => a.w);
    // Modo de disparo: el de la variante o, a veces, uno "raro" para su tipo
    const shifts = (MODE_SHIFTS[type] ?? []).filter((x) => x.mode !== arch.mode);
    const shift = shifts.length && r() < 0.28 ? weighted(r, shifts, (x) => x.w) : null;
    const fireMode: FireMode = shift?.mode ?? arch.mode;
    const burstRange = shift?.burst ?? [3, 3];
    const burst = fireMode === "burst" ? burstRange[0] + Math.floor(r() * (burstRange[1] - burstRange[0] + 1)) : 0;

    // 3. Accesorios
    let optic: string | null = null;
    if (body.parts.some((p) => p.role === "scope")) { const same = this.scopes.filter((s) => s.pack === body.pack); optic = r() < 0.55 && same.length ? pick(r, same).id : body.id; }
    else { const opts = this.opticOptions({ type, parts }); if (opts.length && r() < (arch.id === "marksman" ? 0.85 : 0.35)) optic = pick(r, opts); }
    const muzzles = this.muzzleOptions(type, body.id);
    const muzzle = muzzles.length && r() < 0.3 ? pick(r, muzzles) : null;

    // 4. Rareza, acabado y nivel
    const rarity = rollRarity(r);
    const paint = weighted(r, PAINTS, (p) => PAINT_WEIGHTS[PAINTS.indexOf(p)]);
    const level = 8 + Math.floor(r() * 9);

    // 5. Habilidades: moderadas desde azul, la especial solo en legendarias. Como mucho un elemento.
    const effects: Effect[] = [];
    if (type === "flamethrower") effects.push({ id: "fuego", kind: "element", icon: "▲", color: "#f07a2a", value: 100 });
    for (let i = 0; i < rarity.perks; i++) {
      const hasElement = effects.some((e) => e.kind === "element");
      const cands = PERKS.filter((e) => !(e.kind === "element" && hasElement) && !effects.some((x) => x.id === e.id));
      const e = pick(r, cands);
      effects.push({ id: e.id, kind: e.kind, icon: e.icon, color: e.color, value: e.range ? e.range[0] + Math.floor(r() * (e.range[1] - e.range[0] + 1)) : undefined });
    }
    if (rarity.special) { const s = pick(r, SPECIALS); effects.push({ id: s.id, kind: "special", icon: s.icon, color: s.color }); }

    // 6. Nombre propio (solo legendarias, en inglés)
    let name = "";
    if (rarity.special) {
      const sp = SPECIALS.find((x) => effects.some((e) => e.id === x.id))!;
      name = r() < 0.55 ? `${pick(r, sp.words)} ${pick(r, LEGEND_NOUNS)}` : pick(r, LEGEND_NAMES);
    }
    const statSeed = Math.floor(r() * 2 ** 31);
    const spec: WeaponSpec = { seed, type, archetype: arch.id, fireMode, modeShift: shift?.mode ?? null, burst, layout, parts, barrelLength, muzzle, optic, rarity, paint, level, stats: { ...info.base }, effects, name, statSeed };
    return this.refresh(spec);
  }

  /** Recalcula estadísticas y nombre técnico (tras generar o tras cambiar piezas en el banco). */
  refresh(spec: WeaponSpec): WeaponSpec {
    spec.stats = computeStats(spec);
    if (spec.rarity.id !== "legendaria") spec.name = technicalName(spec);
    return spec;
  }
}

export function computeStats(spec: WeaponSpec): Stats {
  const info = TYPE_INFO[spec.type as BaseType];
  const a = archetypeOf(spec);
  const s: Stats = { ...info.base };
  const hint = MODEL_HINTS[spec.parts[0].from];
  // Variante (si es la propia del modelo, se usa la capacidad real de su cargador)
  s.dano *= a.dano ?? 1; s.cadencia *= a.cadencia ?? 1; s.alcance *= a.alcance ?? 1;
  s.cargador = hint?.mag && hint.arch === a.id ? hint.mag : (hint?.mag ?? s.cargador) * (a.cargador ?? 1);
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
  const L = spec.barrelLength;
  if (spec.layout === "modular-pistol") { s.alcance *= 1 + (L - 1) * 0.9; s.precision += (L - 1) * 14; s.manejo -= (L - 1) * 16; }
  // Rareza: todo mejora un poco
  const m = spec.rarity.mult - 1;
  s.dano *= 1 + m; s.alcance *= 1 + m * 0.8; s.precision += m * 40; s.manejo += m * 30; s.cadencia *= 1 + m * 0.3;
  // Habilidades que cambian números
  const ev = (id: string) => spec.effects.find((e) => e.id === id)?.value ?? 0;
  if (ev("extmag")) s.cargador *= 1 + ev("extmag") / 100;
  if (ev("range")) s.alcance *= 1 + ev("range") / 100;
  if (spec.effects.some((e) => e.id === "quickdraw")) s.manejo += 15;
  if (spec.effects.some((e) => e.id === "doble")) s.dano *= 0.62;
  // Pequeña variación estable
  const v = mulberry32(spec.statSeed);
  for (const k of Object.keys(s) as StatKey[]) s[k] *= 0.97 + v() * 0.06;
  s.precision = Math.min(100, Math.max(5, s.precision));
  s.manejo = Math.min(100, Math.max(5, s.manejo));
  s.cargador = Math.max(1, Math.round(s.cargador));
  return s;
}

export function technicalName(spec: WeaponSpec): string {
  const info = TYPE_INFO[spec.type as BaseType];
  const body = spec.parts[0].from;
  const series = info.letter + "KRVMCLDTX"[hashString(body + spec.archetype) % 9];
  const cal = info.calibers[hashString(spec.parts[1]?.from ?? body) % info.calibers.length];
  const L = spec.barrelLength;
  const mode = spec.fireMode === "burst" ? `B${spec.burst}` : spec.modeShift === "auto" || spec.archetype === "machine" ? "A" : spec.modeShift === "semi" ? "S" : spec.archetype === "marksman" ? "DMR" : "";
  const acc = accessory(spec.muzzle);
  const suffix = (L > 1.3 ? "L" : L < 0.95 ? "C" : "") + mode + (acc?.quiet ? " SD" : "") + (spec.optic && spec.optic !== body ? " O" : "");
  const mark = spec.rarity.id === "rara" ? " Mk II" : spec.rarity.id === "epica" ? " Mk III" : "";
  return `${series}-${cal}${suffix}${mark}`;
}
