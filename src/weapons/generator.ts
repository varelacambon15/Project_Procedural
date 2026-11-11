// Generador de armas: decide piezas, rareza, estadísticas, efectos y nombre a partir de una semilla.
// Es lógica pura (sin Three.js), así que se puede probar sin navegador.
import { hashString, mulberry32, pick, type Rng } from "./rng";
import type { AssetEntry, Effect, Manifest, Paint, PartPick, Rarity, Stats, StatKey, WeaponSpec, WeaponType } from "./types";

export { PAINTS };
export const RARITIES: Rarity[] = [
  { id: "comun", name: "Común", weight: 40, mult: 1.0, effects: 0, color: "#c9c6bd" },
  { id: "poco", name: "Poco común", weight: 28, mult: 1.07, effects: 1, color: "#5fc25a" },
  { id: "rara", name: "Rara", weight: 18, mult: 1.14, effects: 1, color: "#4a9bf0" },
  { id: "epica", name: "Épica", weight: 10, mult: 1.22, effects: 2, color: "#a866f0" },
  { id: "legendaria", name: "Legendaria", weight: 4, mult: 1.32, effects: 2, color: "#f08a24" },
];

export const TYPE_INFO: Record<Exclude<WeaponType, "accessory">, { name: string; letter: string; base: Stats; calibers: string[] }> = {
  pistol: { name: "Pistola", letter: "P", base: { dano: 30, cadencia: 300, precision: 62, alcance: 25, manejo: 72, cargador: 12 }, calibers: ["9", "10", "38", "45", "50", "57"] },
  revolver: { name: "Revólver", letter: "R", base: { dano: 52, cadencia: 140, precision: 66, alcance: 30, manejo: 60, cargador: 6 }, calibers: ["38", "44", "357", "45", "500"] },
  smg: { name: "Subfusil", letter: "S", base: { dano: 18, cadencia: 820, precision: 50, alcance: 22, manejo: 76, cargador: 32 }, calibers: ["9", "10", "45", "46", "57"] },
  rifle: { name: "Fusil", letter: "A", base: { dano: 26, cadencia: 600, precision: 64, alcance: 45, manejo: 58, cargador: 30 }, calibers: ["556", "762", "68", "65", "300"] },
  bullpup: { name: "Bullpup", letter: "B", base: { dano: 24, cadencia: 680, precision: 66, alcance: 42, manejo: 64, cargador: 30 }, calibers: ["556", "58", "762"] },
  shotgun: { name: "Escopeta", letter: "E", base: { dano: 14, cadencia: 90, precision: 34, alcance: 14, manejo: 55, cargador: 6 }, calibers: ["12", "16", "20", "410"] },
  sniper: { name: "Francotirador", letter: "F", base: { dano: 120, cadencia: 50, precision: 88, alcance: 110, manejo: 38, cargador: 5 }, calibers: ["308", "338", "50", "762", "300"] },
  launcher: { name: "Lanzacohetes", letter: "L", base: { dano: 260, cadencia: 30, precision: 55, alcance: 70, manejo: 30, cargador: 1 }, calibers: ["40", "66", "84"] },
  lmg: { name: "Ametralladora", letter: "M", base: { dano: 24, cadencia: 750, precision: 46, alcance: 50, manejo: 34, cargador: 100 }, calibers: ["556", "762", "308"] },
  flamethrower: { name: "Lanzallamas", letter: "Q", base: { dano: 9, cadencia: 900, precision: 30, alcance: 9, manejo: 50, cargador: 100 }, calibers: ["1", "2"] },
};
/** Perdigones por disparo (solo escopetas). */
export const PELLETS: Partial<Record<WeaponType, number>> = { shotgun: 8 };

// Acabados de armas modernas (cerakote, polímero, fosfatado) y uno gastado, post-apocalíptico.
const PAINTS: Paint[] = [
  // Colores en sRGB (como se ven en pantalla).
  { name: "Original", color: null },
  { name: "Original", color: null },
  { name: "Negro mate", color: [0.1, 0.1, 0.11] },
  { name: "Tierra oscura (FDE)", color: [0.47, 0.39, 0.28] },
  { name: "Verde oliva", color: [0.3, 0.32, 0.22] },
  { name: "Gris tormenta", color: [0.33, 0.34, 0.36] },
  { name: "Óxido gastado", color: [0.4, 0.24, 0.15] },
];
/** Peso de cada pack al elegir el cuerpo: los modelos más realistas salen más a menudo. */
const PACK_WEIGHT: Record<string, number> = { modern: 4, asimov: 2.5, misc: 2.5, quaternius: 1.5, cosmo: 1 };
function weightedPick<T extends { pack: string }>(r: Rng, arr: T[]): T {
  const total = arr.reduce((s, x) => s + (PACK_WEIGHT[x.pack] ?? 1), 0);
  let roll = r() * total;
  for (const x of arr) { roll -= PACK_WEIGHT[x.pack] ?? 1; if (roll < 0) return x; }
  return arr[arr.length - 1];
}

interface EffectDef { id: string; name: string; icon: string; color: string; element?: boolean; words: string[]; range?: [number, number]; text: (v: number) => string }
const EFFECTS: EffectDef[] = [
  { id: "fuego", element: true, icon: "▲", color: "#f07a2a", name: "Incendiaria", words: ["Ember", "Blaze", "Pyre"], range: [12, 26], text: (v) => `${v}% de probabilidad de prender fuego al objetivo.` },
  { id: "corrosivo", element: true, icon: "◆", color: "#9bd23c", name: "Corrosiva", words: ["Acid", "Rust", "Sludge"], range: [10, 22], text: (v) => `${v}% de corroer. +75% de daño contra armadura.` },
  { id: "electrico", element: true, icon: "ϟ", color: "#5cc8f0", name: "Eléctrica", words: ["Spark", "Volt", "Storm"], range: [14, 26], text: (v) => `${v}% de electrocutar. +75% de daño contra escudos.` },
  { id: "radiacion", element: true, icon: "☢", color: "#d8e04a", name: "Radiactiva", words: ["Isotope", "Fallout", "Ash"], range: [10, 20], text: (v) => `${v}% de irradiar: daño continuo que se contagia al morir.` },
  { id: "rebote", icon: "↯", color: "#e8e1d3", name: "Rebote", words: ["Ricochet", "Bounce"], text: () => "Las balas rebotan una vez hacia el enemigo más cercano." },
  { id: "doble", icon: "Ⅱ", color: "#e8e1d3", name: "Doble cañón improvisado", words: ["Twin", "Double"], text: () => "Dispara 2 proyectiles por disparo con un 40% más de retroceso." },
  { id: "vampiro", icon: "♥", color: "#e05a6a", name: "Sanguijuela", words: ["Leech", "Fang"], range: [2, 5], text: (v) => `Recupera ${v}% del daño infligido como vida.` },
  { id: "recarga", icon: "↻", color: "#e8e1d3", name: "Recarga de pánico", words: ["Panic", "Rush"], text: () => "Recargar con el cargador vacío es un 50% más rápido." },
];
const LEGENDARY_EFFECTS: Omit<EffectDef, "words">[] = [
  { id: "aliento", icon: "★", color: "#f08a24", name: "Último aliento", text: () => "Con menos del 25% de vida, cada disparo es un crítico garantizado." },
  { id: "carronero", icon: "★", color: "#f08a24", name: "Carroñero", text: () => "Cada baja devuelve 3 balas al cargador." },
  { id: "eco", icon: "★", color: "#f08a24", name: "Eco", text: () => "Cada 5.º disparo se repite gratis medio segundo después." },
];
const LEGEND_NAMES = ["Last Will", "Black Widow", "Old Dog", "Rust Requiem", "The Scavenger", "Final Verdict", "Dead Man's Hand", "Wasteland Prayer"];
const LEGEND_NOUNS = ["Bite", "Nail", "Widow", "Hound", "Whisper", "Scrapper", "Verdict", "Reaper", "Howler", "Vulture"];

/** Modificadores estables de una pieza: dependen solo de su procedencia y su rol. */
export function partMods(from: string, role: string): Partial<Stats> {
  const r = mulberry32(hashString(`${from}#${role}`));
  const keys: StatKey[] = ["dano", "cadencia", "precision", "alcance", "manejo", "cargador"];
  const relevant: Record<string, StatKey[]> = {
    body: keys, frame: ["manejo", "cargador", "precision"], slide: ["dano", "cadencia", "precision"], barrel: ["alcance", "precision"],
    magazine: ["cargador", "manejo"], scope: ["precision", "alcance", "manejo"], muzzle: ["precision", "alcance", "dano"],
  };
  const out: Partial<Stats> = {};
  for (const k of relevant[role] ?? []) if (r() < 0.6) out[k] = Math.round((r() * 2 - 1) * 8); // ±8 puntos (o %)
  return out;
}

function rollRarity(r: Rng): Rarity {
  let roll = r() * RARITIES.reduce((s, x) => s + x.weight, 0);
  for (const x of RARITIES) { if (roll < x.weight) return x; roll -= x.weight; }
  return RARITIES[0];
}

export class WeaponGenerator {
  readonly byType = new Map<WeaponType, AssetEntry[]>();
  readonly byId = new Map<string, AssetEntry>();
  readonly muzzles: AssetEntry[];
  readonly scopes: AssetEntry[];

  constructor(readonly manifest: Manifest) {
    for (const w of manifest.weapons) {
      this.byId.set(w.id, w);
      if (!this.byType.has(w.type)) this.byType.set(w.type, []);
      this.byType.get(w.type)!.push(w);
    }
    const acc = this.byType.get("accessory") ?? [];
    this.muzzles = acc.filter((a) => a.parts[0].role === "muzzle");
    // Miras: las sueltas del pack Quaternius + las que vienen separadas en otras armas.
    this.scopes = [...acc.filter((a) => a.parts[0].role === "scope"), ...manifest.weapons.filter((w) => w.type !== "accessory" && w.parts.some((p) => p.role === "scope"))];
  }

  get types(): WeaponType[] { return [...this.byType.keys()].filter((t) => t !== "accessory"); }

  generate(seed: number, wanted?: WeaponType): WeaponSpec {
    const r = mulberry32(seed);
    const type = wanted ?? pick(r, this.types);
    const pool = this.byType.get(type);
    if (!pool?.length) throw new Error(`No hay armas de tipo ${type}`);

    // 1. Piezas
    const parts: PartPick[] = [];
    let layout: WeaponSpec["layout"] = "body";
    const modular = pool.filter((w) => w.parts.some((p) => p.role === "slide"));
    if (type === "pistol" && modular.length >= 2 && r() < 0.5) {
      layout = "modular-pistol";
      const slide = pick(r, modular);
      let frame = pick(r, modular);
      while (frame === slide) frame = pick(r, modular);
      parts.push({ role: "frame", from: frame.id }, { role: "slide", from: slide.id }, { role: "barrel", from: pick(r, modular).id });
    } else {
      // Las pistolas modulares (corredera/armazón) no tienen "body", así que aquí se usan las demás.
      const bodies = pool.filter((w) => w.parts.some((p) => p.role === "body"));
      if (!bodies.length) throw new Error(`No hay cuerpos de tipo ${type}`);
      const base = weightedPick(r, bodies);
      parts.push({ role: "body", from: base.id });
      if (base.sockets.magazine) {
        // Cargador de otra arma del mismo tipo y del mismo pack (para que el estilo encaje), o el suyo.
        const mags = pool.filter((w) => w.pack === base.pack && w.parts.some((p) => p.role === "magazine"));
        parts.push({ role: "magazine", from: (r() < 0.6 ? pick(r, mags) : base).id });
      }
    }
    const body = this.byId.get(parts[0].from)!;
    const barrelLength = layout === "modular-pistol" ? 0.85 + r() * 0.75 : 1;

    // 2. Accesorios
    const hasOwnScope = body.parts.some((p) => p.role === "scope");
    let optic: string | null = null;
    // Solo se cambia la mira en armas que la tienen como pieza separada (otras la llevan integrada en el cuerpo).
    if (hasOwnScope) { const same = this.scopes.filter((s) => s.pack === body.pack); optic = r() < 0.55 && same.length ? pick(r, same).id : body.id; }
    const muzzle = type !== "launcher" && type !== "flamethrower" && this.muzzles.length && r() < 0.3 ? pick(r, this.muzzles).id : null;

    // 3. Rareza, pintura y nivel
    const rarity = rollRarity(r);
    const paint = pick(r, PAINTS);
    const level = 8 + Math.floor(r() * 9);

    // 5. Efectos
    const effects: Effect[] = [];
    const pool2 = EFFECTS.slice();
    let hasElement = false;
    if (type === "flamethrower") { const f = EFFECTS[0]; effects.push({ id: f.id, name: f.name, icon: f.icon, color: f.color, element: true, value: 100, text: "Daño de fuego continuo." }); hasElement = true; pool2.splice(0, 1); }
    for (let i = 0; i < rarity.effects; i++) {
      const candidates = pool2.filter((e) => !(e.element && hasElement));
      const e = candidates[Math.floor(r() * candidates.length)];
      pool2.splice(pool2.indexOf(e), 1);
      if (e.element) hasElement = true;
      const value = e.range ? e.range[0] + Math.floor(r() * (e.range[1] - e.range[0] + 1)) : undefined;
      effects.push({ id: e.id, name: e.name, icon: e.icon, color: e.color, element: e.element, value, text: e.text(value ?? 0) });
    }
    if (rarity.id === "legendaria") { const l = pick(r, LEGENDARY_EFFECTS); effects.push({ id: l.id, name: l.name, icon: l.icon, color: l.color, text: l.text(0) }); }

    // 6. Nombre (las legendarias, nombre propio; el resto se recalcula si cambian las piezas)
    let name = "";
    if (rarity.id === "legendaria") {
      const lead = EFFECTS.find((e) => effects.some((f) => f.id === e.id));
      name = lead && r() < 0.5 ? `${pick(r, lead.words)} ${pick(r, LEGEND_NOUNS)}` : pick(r, LEGEND_NAMES);
    }
    const statSeed = Math.floor(r() * 2 ** 31);
    const spec: WeaponSpec = { seed, type, layout, parts, barrelLength, muzzle, optic, rarity, paint, level, stats: { ...TYPE_INFO[type as BaseType].base }, effects, name, statSeed };
    return this.refresh(spec);
  }

  /** Recalcula estadísticas y nombre técnico (tras generar o tras cambiar piezas en el banco). */
  refresh(spec: WeaponSpec): WeaponSpec {
    spec.stats = computeStats(spec);
    if (spec.rarity.id !== "legendaria") spec.name = technicalName(spec);
    return spec;
  }
}

type BaseType = Exclude<WeaponType, "accessory">;

export function computeStats(spec: WeaponSpec): Stats {
  const info = TYPE_INFO[spec.type as BaseType];
  const stats: Stats = { ...info.base };
  stats.dano *= 1 + (spec.level - 8) * 0.06;
  const apply = (mods: Partial<Stats>) => {
    for (const [key, v] of Object.entries(mods) as [StatKey, number][]) {
      // dano/cadencia/cargador en %, el resto en puntos
      if (key === "dano" || key === "cadencia" || key === "cargador") stats[key] *= 1 + v / 100;
      else stats[key] += v;
    }
  };
  for (const p of spec.parts) apply(partMods(p.from, p.role));
  if (spec.optic) apply(partMods(spec.optic, "scope"));
  if (spec.muzzle) { apply(partMods(spec.muzzle, "muzzle")); stats.precision += 5; stats.dano *= 0.95; }
  const L = spec.barrelLength;
  if (spec.layout === "modular-pistol") { stats.alcance += (L - 1) * 22; stats.precision += (L - 1) * 14; stats.manejo -= (L - 1) * 16; }
  stats.dano *= spec.rarity.mult;
  stats.precision += (spec.rarity.mult - 1) * 30;
  const v = mulberry32(spec.statSeed);
  for (const k of Object.keys(stats) as StatKey[]) stats[k] *= 0.96 + v() * 0.08;
  if (spec.effects.some((f) => f.id === "doble")) stats.dano *= 0.62;
  stats.precision = Math.min(100, Math.max(5, stats.precision));
  stats.manejo = Math.min(100, Math.max(5, stats.manejo));
  stats.cargador = Math.max(1, Math.round(stats.cargador));
  return stats;
}

export function technicalName(spec: WeaponSpec): string {
  const info = TYPE_INFO[spec.type as BaseType];
  const body = spec.parts[0].from;
  const series = info.letter + "KRVMCLDTX"[hashString(body) % 9];
  const cal = info.calibers[hashString(spec.parts[1]?.from ?? body) % info.calibers.length];
  const L = spec.barrelLength;
  const suffix = (L > 1.3 ? "L" : L < 0.95 ? "C" : "") + (spec.muzzle ? " SD" : "") + (spec.optic && spec.optic !== body ? " O" : "");
  const mark = spec.rarity.id === "rara" ? " Mk II" : spec.rarity.id === "epica" ? " Mk III" : "";
  return `${series}-${cal}${suffix}${mark}`;
}
