// Generador de armas: decide variante, piezas, accesorios, rareza, habilidades y estadísticas a partir de una semilla.
// Lógica pura (sin Three.js): se puede probar sin navegador. Los textos se traducen fuera, a partir de los ids.
import { hashString, mulberry32, pick, type Rng } from "./rng";
import { ACCESSORIES, accessory, isIron } from "./accessories";
import { FINISHES, FINISH_WEIGHTS } from "./finish";
import { EFFECTS_A, EFFECTS_B, EFFECTS_L, legalWith } from "./effects";
import { baseEra, eraFinishes, rollEra, rollModernization, type Era } from "./eras";
import { clipProfile, frontProfile, stockProfile, type FrontKind, type StockKind } from "./procparts";
import { BATCH_MAX_SIMILARITY, SIMILARITY_RANGE, midZone, similarity, spans, zoneLen, type Box2, type Placed, type Stretch } from "./variation";
import { LONG_ARCHES, LONG_HINTS, LONG_MUTATIONS, LONG_STRUCTURAL, longArchDesign, longArchesFor, longEntry, longKey, longMutationAllowed, longPolys, longSpans, type LEra, type LFamily, type LongDesign } from "./longgen";
import { CAL_EFFECT, PISTOL_ARCHES, PISTOL_MUTATIONS, STRUCTURAL, archDesign, archesFor, designEntry, designKey, designPolys, designSpans, gripCorners, mutationAllowed, upgradeDesign, type PEra, type PistolDesign } from "./pistolgen";
import { KIT_MODS, KIT_ROLE, KitIndex, isKit, kitLengths, realOptics, realSuppressors, kitMagazine, kitMuzzleOptions, kitOpticOptions, kitPlacements, rollKit } from "./kit";
import { ensureGrip } from "./grip";
import { recipeStatMods } from "./effects";
import { isLight, PROC_LIGHTS } from "./lights";
import { NO_TWEAKS, type AssetEntry, type IronSet, type Effect, type FireMode, type Manifest, type Paint, type PartPick, type PartRole, type Addon, type Rarity, type RarityId, type Stats, type StatKey, type Tweaks, type WeaponSpec, type WeaponType } from "./types";

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
    // De ráfaga: solo la llevan las pistolas generadas de ese arquetipo (peso 0 en el resto); valores del modo raro de ráfaga
    { id: "burst", mode: "burst", w: 0, dano: 0.85, cadencia: 1.6 },
    // De cerrojo (Welrod): solo por la acción real del modelo (peso 0); disparo a disparo, lento y preciso
    { id: "bolt", mode: "bolt", w: 0, dano: 1.9, cadencia: 0.3, cargador: 0.5, precision: 10 },
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

/**
 * Acción real del modelo (campo `accion` de los packs del usuario): elige la variante de modo que coincide (un
 * francotirador de cerrojo hace la animación del cerrojo; uno semiautomático, no).
 */
/**
 * Posición relativa (0..1) de un ancla del modelo a lo largo de su guardamanos, si el arma lleva el guardamanos propio
 * (con uno ajeno, el ancla no vale). Sirve tras estirar el guardamanos: se reparte igual a lo largo.
 */
function railT(base: AssetEntry | null | undefined, parts: PartPick[], anchor: string): number | null {
  const a = base?.anchors?.[anchor], fb = base?.partBounds?.front;
  if (!a || !fb || parts.find((p) => p.role === "front")?.from !== base!.id) return null;
  const t = (a[0] - fb.min[0]) / Math.max(1e-4, fb.max[0] - fb.min[0]);
  return t > 0.02 && t < 0.98 ? t : null;
}
/**
 * Alturas de los dos alzadores de un juego de miras de hierro para que la línea centro_lente → punta quede paralela al
 * cañón (LEEME de las miras); null si alguno pasa del máximo (no cabe en esa arma).
 */
export function ironRisers(j: IronSet, rsY: number, rfY: number): [number, number] | null {
  let ar = j.riser.min, af = j.riser.min;
  const d = (rsY + ar + j.rear.h) - (rfY + af + j.front.h);
  if (d > 0) af += d; else ar -= d;
  return ar > j.riser.max || af > j.riser.max ? null : [ar, af];
}
/** Pieza del kit convertida desde un accesorio del pool del pack 4 (id del pack → k-…-lp4<id>). */
function stockPart(kit: KitIndex, id: string): string | null {
  const slug = "-lp4" + id.replace(/[^a-z0-9]+/g, "");
  return kit.parts.find((p) => p.id.endsWith(slug))?.id ?? null;
}
const serie = (kit: KitIndex, base: AssetEntry | null | undefined, cat: string) => (base?.stockAcc ?? []).filter((a) => a.categoria === cat).map((a) => stockPart(kit, a.id)).filter((x): x is string => !!x);

function actionHint(body: AssetEntry): { arch: string; strict?: boolean } | undefined {
  const a = body.action; if (!a) return undefined;
  const A: Partial<Record<string, Record<string, string>>> = {
    pistol: { semiautomatica: "standard", automatica: "machine", cerrojo: "bolt" },
    revolver: { revolver_simple: "heavy", revolver_doble: "standard" }, // (simple: se amartilla a cada disparo, más lento)
    smg: { automatica: "standard", semiautomatica: "tactical" },
    rifle: { automatica: "auto", semiautomatica: "marksman" },
    lmg: { automatica: "standard" },
    sniper: { cerrojo: "bolt", semiautomatica: "semi" },
    shotgun: { bombeo: "pump", semiautomatica: "semi", automatica: "auto" },
  };
  const arch = A[body.type]?.[a];
  return arch ? { arch, strict: true } : undefined;
}

/** Modelos que ya llevan silenciador u otro dispositivo integrado en el cañón. */
const INTEGRATED_MUZZLE = new Set(["w-usp45", "w-vss", "w-minigun"]);

// ---------- Acabados ----------
/** Acabados: sistema único de materiales (ver finish.ts). */
export const PAINTS: Paint[] = FINISHES;
const PAINT_WEIGHTS = FINISH_WEIGHTS;

// ---------- Efectos ----------
// Definidos como módulos de datos en src/data/effects.json (lógica por eventos en effects.ts). Nivel A: mejora pequeña;
// B: se nota en combate (incluye fuego, eléctrico y explosivo); L: firma única de cada legendaria (le da nombre).
type EffectDef = import("./effects").EffectDef;
export { EFFECTS_A, EFFECTS_B, EFFECTS_L };
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
/** Proporción de armas del kit modular en cada tipo que lo admite. */
const KIT_SHARE: Partial<Record<WeaponType, number>> = { rifle: 0.3, pistol: 0.2, shotgun: 0.4 };
/** Parte de las pistolas que son modulares generadas por código (el resto: kit y modelos enteros). */
const PROC_PISTOL_SHARE = 0.65;
/** Parte de los revólveres generados por código (el resto: modelos enteros). */
const PROC_REVOLVER_SHARE = 0.65;
const ERA_W: Record<PEra, number> = { modern: 4, classic: 2, rustic: 2, scifi: 1.5 };
/** Peso de cada familia al elegir arquetipo (las de corredera son las más comunes). */
const FAMILY_W: Record<string, number> = { auto: 1, frontmag: 0.8, carbine: 1.2, revolver: 1 };
/** Culata de hombro en pistolas y revólveres generados: ~12 % (carbinas, más a menudo). */
const PISTOL_STOCK_P = 0.09, CARBINE_STOCK_P = 0.55;
/** Variante de estadísticas de cada arquetipo de pistola generada. */
/** Arquetipo (base) de una pistola generada a partir del id de su diseño: pp-<arquetipo>-<era>[-<huella>]. */
export const ppArchId = (id: string) => id.split("-").slice(0, 3).join("-");
const PP_HINTS: Record<string, { arch?: string; strict?: boolean }> = {
  machine: { arch: "machine", strict: true }, heavy: { arch: "heavy", strict: true }, vector: { arch: "heavy" }, burst: { arch: "burst", strict: true }, lancer: { arch: "machine" },
  rlight: { arch: "quick", strict: true }, rheavy: { arch: "heavy", strict: true }, rmagnum: { arch: "heavy", strict: true }, rmedium: { arch: "standard" },
};
/** Diseño base (arquetipo en su era) a partir del id de la pieza: pp-<arquetipo>-<era>[-<huella>]. */
const ppBaseDesign = (id: string) => { const [, a, e] = id.split("-"); return archDesign(a, e as PEra); };
/** Armas largas generadas por código (06-G): parte de bullpups, ametralladoras y escopetas (las bases de modelo de esos
 * tipos son muy pocas y se repetían). El resto sale de modelos y del kit. */
const PROC_LONG_SHARE: Partial<Record<WeaponType, number>> = { bullpup: 0.82, lmg: 0.85, shotgun: 0.6 };
/** Arquetipo de arma larga a partir del id: pl-<arquetipo>-<era>[-<huella>]. */
export const plArchId = (id: string) => id.split("-").slice(0, 2).join("-");
const plBaseDesign = (id: string) => { const [, a, e] = id.split("-"); return longArchDesign(a, e as LEra); };
/** Ancho del cargador respecto a su pozo (1 = recto; más = inclinado o curvo). */
function magSpread(w: AssetEntry) {
  const pb = w.partBounds?.magazine, sz = w.sockets.magazine?.size?.[0];
  return pb && sz ? (pb.max[0] - pb.min[0]) / sz : 1;
}
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
      if (w.excluded || w.donor || RETIRED.has(w.id) || WHOLE_OUT.has(w.id)) continue; // se puede leer (armas guardadas), pero no sale en el botín
      if (!this.byType.has(w.type)) this.byType.set(w.type, []);
      this.byType.get(w.type)!.push(w);
    }
    // Miras de modelo (las de cosmo vienen separadas). Los accesorios de Quaternius ya no se usan: hay accesorios propios.
    this.scopes = manifest.weapons.filter((w) => !w.excluded && !w.donor && w.type !== "accessory" && w.parts.some((p) => p.role === "scope"));
    // Pistolas modulares generadas por código: cada arquetipo en cada era es una "base" (recurso virtual)
    for (const a of PISTOL_ARCHES) for (const era of a.eras) { const id = `pp-${a.id}-${era}`; this.byId.set(id, designEntry(id, archDesign(a.id, era))); }
    for (const a of LONG_ARCHES) for (const era of a.eras) { const id = `pl-${a.id}-${era}`; this.byId.set(id, longEntry(id, longArchDesign(a.id, era))); }
  }

  /** Recurso virtual del diseño de un arma generada por código (se registra al generarla y al cargar una partida). */
  ensureDesign(spec: Pick<WeaponSpec, "tweaks" | "parts">) {
    if (spec.tweaks?.long) { const id = longKey(spec.tweaks.long); if (!this.byId.has(id)) this.byId.set(id, longEntry(id, spec.tweaks.long)); return; }
    if (!spec.tweaks?.pistol) return;
    const d = (spec.tweaks.pistol = upgradeDesign(spec.tweaks.pistol)); // partidas guardadas con el diseño antiguo
    const id = designKey(d); if (!this.byId.has(id)) this.byId.set(id, designEntry(id, d));
  }

  /** Tipos que salen en el botín. Lanzallamas y lanzacohetes quedan fuera por ahora (como la minigun). */
  get types(): BaseType[] { return [...this.byType.keys()].filter((t): t is BaseType => t !== "accessory" && t !== "flamethrower" && t !== "launcher"); }

  /** Miras (accesorio) que admite un arma. Las que llevan mira integrada en el cuerpo no admiten otra. */
  /**
   * Miras de hierro desmontables que caben en un arma de los packs del usuario: tipo compatible, con raíl_superior y
   * raíl_frontal, y alzadores dentro de su rango (cálculo del LEEME de las miras). Ids "iron:<juego>".
   */
  ironOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const body = this.byId.get(spec.parts[0].from), rs = body?.anchors?.["raíl_superior"], rf = body?.anchors?.["raíl_frontal"];
    if (!rs || !rf) return [];
    const type = spec.type === "bullpup" ? "rifle" : spec.type;
    return (this.manifest.iron ?? []).filter((j) => j.types.includes(type) && ironRisers(j, rs[1], rf[1]) !== null).map((j) => `iron:${j.id}`);
  }

  opticOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const procedural = () => ACCESSORIES.filter((a) => a.kind === "optic" && (!a.for || a.for.includes(spec.type))).map((a) => a.id);
    // Las miras reales (Flat Gun Attachments) sustituyen a las hechas por código; se conservan solo las de aumento sin equivalente
    if (isKit(spec.parts[0].from)) return kitOpticOptions(this.kit, spec, spec.type === "pistol" ? ["acc:reddot"] : procedural());
    const body = this.byId.get(spec.parts[0].from);
    // Mira de modelo (p. ej. el kit del usuario): se cambia por la de otro modelo del mismo pack, como al generar
    // Packs del usuario (kit39): solo miras del pool (su pieza "mira" es decorativa) y las de serie del modelo
    if (body?.pack === "kit39") return spec.type === "launcher" || spec.type === "flamethrower" ? [] : [...new Set([...serie(this.kit, body, "miras"), ...realOptics(this.kit, spec.type), ...procedural(), ...this.ironOptions(spec)])];
    if (body?.parts.some((p) => p.role === "scope")) return this.scopes.filter((x) => x.pack === body.pack && x.id !== body.id && !RETIRED.has(x.id)).map((x) => x.id);
    if (!body?.sockets.rail || spec.type === "sniper" || spec.type === "launcher" || spec.type === "flamethrower") return [];
    // Miras reales (preferidas al generar) y las hechas por código como alternativa
    return [...realOptics(this.kit, spec.type), ...procedural()];
  }
  muzzleOptions(spec: Pick<WeaponSpec, "type" | "parts">): string[] {
    const type = spec.type, bodyId = spec.parts[0]?.from;
    if (isKit(bodyId)) return kitMuzzleOptions(this.kit, spec);
    if (type === "launcher" || type === "flamethrower" || (bodyId && INTEGRATED_MUZZLE.has(bodyId))) return [];
    // Revólveres: solo compensador (frenos y apagallamas de fusil quedaban desproporcionados en un cañón corto)
    // Bocachas de serie del modelo del pack (supresor de la APB, freno de la QB327…): siempre valen en su propia arma
    const own = serie(this.kit, bodyId ? this.byId.get(bodyId) : undefined, "bocachas");
    if (type === "revolver") return [...own, "acc:compensator"];
    // (escopetas sin supresor: un tubo largo en la boca de una escopeta no quedaba natural)
    return [...own, ...ACCESSORIES.filter((a) => a.kind === "muzzle" && (!a.quiet || type === "pistol")).map((a) => a.id), ...(type === "shotgun" ? [] : realSuppressors(this.kit, type))];
  }

  /**
   * Arma nueva. Si una arma de modelo (entera o despiezada) sigue por encima de la banda de parecido con su base, se
   * descarta y se genera otra (hasta 5 intentos; si no, la más alejada).
   */
  generate(seed: number, wanted?: BaseType, forceRarity?: RarityId): WeaponSpec {
    let best: WeaponSpec | null = null;
    for (let k = 0; k < 5; k++) {
      const w = this.generateOne(seed + k * 104729, wanted, forceRarity);
      const sim = w.lineage?.similarity ?? 0;
      if ((w.layout !== "modular-long" && w.layout !== "body") || sim <= SIMILARITY_RANGE[1] || (w.type === "revolver" && w.layout === "body" && (w.tweaks.body ?? 1) < 0.8)) return k ? { ...w, seed } : w;
      if (!best || sim < (best.lineage?.similarity ?? 1)) best = w;
    }
    return { ...best!, seed };
  }

  private generateOne(seed: number, wanted?: BaseType, forceRarity?: RarityId): WeaponSpec {
    const r = mulberry32(seed);
    // El bullpup no es una categoría propia: es una variante de fusil (≈ 1 de cada 4 fusiles al azar).
    // Por dentro conserva su tipo (piezas, animación y estadísticas propias); se muestra y se filtra como fusil.
    let type = wanted ?? pick(r, this.types.filter((t) => t !== "bullpup"));
    if (!wanted && type === "rifle" && this.types.includes("bullpup") && r() < 0.25) type = "bullpup";
    const pool = this.byType.get(type);
    if (!pool?.length) throw new Error(`No weapons of type ${type}`);
    const info = TYPE_INFO[type];

    // 1. Piezas
    const parts: PartPick[] = [];
    let tweaks: Tweaks = { ...NO_TWEAKS };
    let layout: WeaponSpec["layout"] = "body";
    let kitBarrel = 1;
    let ppEra: PEra | null = null;
    const longShare = PROC_LONG_SHARE[type] ?? 0;
    if (this.plForce || (!this.ppForce && longShare > 0 && r() < longShare)) {
      // Arma larga generada por código: arquetipo de su familia en una era (la variación viene después, en varyLong)
      const fam = type as LFamily;
      const opts = longArchesFor(fam).flatMap((a) => a.eras.map((e) => ({ a, e })));
      const f = this.plForce;
      // Peso por arquetipo repartido entre sus eras: ningún arquetipo domina el lote
      const o = f ? { a: LONG_ARCHES.find((a) => a.id === f.arch)!, e: f.era } : weighted(r, opts, (x) => ERA_W[x.e] / x.a.eras.reduce((t, e) => t + ERA_W[e], 0));
      layout = "proc-long"; ppEra = o.e as PEra;
      parts.push({ role: "receiver", from: `pl-${o.a.id}-${o.e}` });
    } else if (!this.ppForce && this.kit.types().includes(type) && r() < KIT_SHARE[type]!) {
      // Arma del kit modular: plataforma y piezas por sockets
      layout = "kit";
      const k = rollKit(this.kit, r, type);
      parts.push(...k.parts); kitBarrel = k.barrelLength;
      tweaks = { ...NO_TWEAKS, front: k.front, stock: k.stock };
    } else if (this.ppForce || (type === "pistol" && r() < PROC_PISTOL_SHARE) || (type === "revolver" && r() < PROC_REVOLVER_SHARE)) {
      // Pistola o revólver generado por código: arquetipo y era (la variación de piezas viene después, en varyPistol)
      const opts = archesFor(type === "revolver" ? "revolver" : "pistol").flatMap((a) => a.eras.map((e) => ({ a, e })));
      const f = this.ppForce;
      const o = f ? { a: PISTOL_ARCHES.find((a) => a.id === f.arch)!, e: f.era } : weighted(r, opts, (x) => ERA_W[x.e] * FAMILY_W[x.a.family]);
      layout = "modular-pistol"; ppEra = o.e;
      parts.push({ role: "frame", from: `pp-${o.a.id}-${o.e}` });
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
        // Cargador de otra arma de la familia solo si aún no se han cambiado 2 piezas
        const swapped = parts.slice(1).filter((p) => p.from !== base.id).length;
        // Solo cargadores de forma parecida (curvatura e inclinación): uno curvo en un pozo recto queda torcido
        // (forma parecida y también alto parecido: un cargador de caja de ametralladora en un AK quedaba gigante)
        const magH = (w: AssetEntry) => { const pb = w.partBounds?.magazine; return pb ? pb.max[1] - pb.min[1] : 0; };
        const hRatio = (w: AssetEntry) => (magH(base) > 0 ? magH(w) / magH(base) : 1);
        const mags = this.manifest.weapons.filter((w) => w.type === base.type && !w.excluded && !RETIRED.has(w.id) && w.pack === base.pack && sameEra(w, base) && w.id !== base.id && w.parts.some((p) => p.role === "magazine") && ((Math.abs(magSpread(w) - magSpread(base)) < 0.25 && hRatio(w) > 0.75 && hRatio(w) < 1.3) || (/-drum$/.test(w.id) && base.type === "smg")));
        // (los cargadores de tambor de los subfusiles se conservan como pieza: van de frente, de su propio modelo)
        parts.push({ role: "magazine", from: (swapped < 2 && mags.length && r() < 0.35 ? pick(r, mags) : base).id });
      }
    }
    const body = this.byId.get(parts[0].from) ?? ({ id: parts[0].from, pack: "kit", parts: [], sockets: {} } as unknown as AssetEntry);
    let barrelLength = layout === "kit" ? kitBarrel : 1;
    // Era (solo aspecto): decide qué cambios encajan (una clásica no lleva raíles ni linternas, etc.)
    const era = ppEra ?? rollEra(r, parts[0].from, this.byId.get(parts[0].from)?.era);
    // 1b. Cambios obligatorios sobre piezas reales (estirados por zonas, detalles añadidos), medidos con la silueta:
    // "reconocible pero nuevo" = parecido con la base dentro de SIMILARITY_RANGE.
    const varied = layout === "modular-pistol" ? this.varyPistol(r, type, parts, era as PEra, this.ppForce?.target)
      : layout === "proc-long" ? this.varyLong(r, parts, this.plForce?.target)
      : this.vary(r, type, layout, parts, tweaks, barrelLength, era);
    // Despiezada demasiado parecida a su base (por encima de la banda): se vuelve a mezclar con más piezas ajenas
    let varied2 = varied;
    const recv = layout === "modular-long" ? this.byId.get(parts[0].from) : undefined;
    for (let k = 0; recv && k < 3 && varied2.similarity > SIMILARITY_RANGE[1]; k++) {
      const mix = this.mixLong(r, recv, type, tweaks, true); if (!mix) break;
      const p2 = parts.map((p) => (p.role === "stock" ? { ...p, from: mix.stock.id } : p.role === "grip" ? { ...p, from: mix.grip.id } : p.role === "front" ? { ...p, from: mix.front.id } : p.role === "magazine" ? { ...p, from: recv.id } : p)); // (como mucho 2 piezas ajenas)
      const v2 = this.vary(r, type, layout, p2, tweaks, barrelLength, era);
      if (Math.abs(v2.similarity - 0.8) < Math.abs(varied2.similarity - 0.8)) { varied2 = v2; parts.splice(0, parts.length, ...p2); }
    }
    tweaks = varied2.tweaks; barrelLength = varied2.barrelLength;
    if (tweaks.long) { parts[0] = { role: "receiver", from: longKey(tweaks.long) }; this.ensureDesign({ tweaks, parts }); }
    if (tweaks.pistol) {
      // La pieza principal pasa a ser el diseño concreto (recurso propio: miras, accesorios, montajes); la base del
      // linaje sigue siendo el arquetipo
      parts[0] = { role: "frame", from: designKey(tweaks.pistol) };
      this.ensureDesign({ tweaks, parts });
    }


    // 2. Variante: la propia del modelo (70%) o cualquiera del tipo
    // Revólveres generados: la variante sale del calibre (ligero → rápida, medio → estándar, pesado/mágnum → pesada)
    const cal = tweaks.pistol?.cyl?.cal;
    const hint = MODEL_HINTS[body.id] ?? actionHint(body) ?? (layout === "proc-long" ? LONG_HINTS[tweaks.long?.arch ?? ""] : layout === "modular-pistol" ? (cal ? { arch: CAL_EFFECT[cal].arch, strict: true } : PP_HINTS[parts[0].from.split("-")[1]]) : undefined);
    const regular = info.archetypes.filter((a) => a.w > 0);
    const arch = hint?.arch && (r() < 0.7 || hint.strict) ? info.archetypes.find((a) => a.id === hint.arch) ?? regular[0] : weighted(r, regular, (a) => a.w);
    // Rareza (antes que el modo: los modos raros son exclusivos de moradas y legendarias)
    // La tirada se hace siempre (misma secuencia aleatoria); el botín y la tienda pueden fijar la rareza.
    const rolled = rollRarity(r);
    const rarity = forceRarity ? RARITIES.find((x) => x.id === forceRarity) ?? rolled : rolled;
    // Kit de modernización (la era ya se decidió antes de las variaciones)
    const modLevel = rollModernization(r, era, rarity.id);
    // Modo de disparo: el de la variante o, en moradas y legendarias, a veces uno "raro" para su tipo
    const shifts = (MODE_SHIFTS[type] ?? []).filter((x) => x.mode !== arch.mode);
    const exotic = rarity.id === "epica" || rarity.id === "legendaria";
    const shift = exotic && shifts.length && r() < 0.45 ? weighted(r, shifts, (x) => x.w) : null;
    const fireMode: FireMode = shift?.mode ?? arch.mode;
    const burstRange = shift?.burst ?? [3, 3];
    const burst = fireMode === "burst" ? burstRange[0] + Math.floor(r() * (burstRange[1] - burstRange[0] + 1)) : 0;

    // 3. Accesorios ya montados según la rareza (una mira de modelo integrada no cuenta como accesorio)
    let optic: string | null = null, muzzle: string | null = null;
    // (en los packs del usuario, kit39, la pieza "mira" del modelo es decorativa: se apunta solo con miras del pool)
    const ownScope = body.pack !== "kit39" && body.parts.some((p) => p.role === "scope");
    if (ownScope) optic = parts[0].from; // (en las pistolas procedurales, el diseño concreto, no el arquetipo)
    let opticOpts = ownScope ? this.scopes.filter((x) => x.pack === body.pack && x.id !== body.id && !RETIRED.has(x.id)).map((x) => x.id) : this.opticOptions({ type, parts });
    // Una clásica solo lleva visores de época (de aumento sencillos); nada de puntos rojos ni holográficas
    // Miras de hierro: las de la era del arma, si las hay (si no, cualquiera compatible)
    const irons = opticOpts.filter(isIron), eraIrons = irons.filter((o) => this.manifest.iron?.find((j) => `iron:${j.id}` === o)?.eras.includes(era));
    if (eraIrons.length) opticOpts = opticOpts.filter((o) => !isIron(o) || eraIrons.includes(o));
    if (era === "classic") opticOpts = opticOpts.filter((o) => /scope/.test(o) || isIron(o));
    const muzzleOpts = this.muzzleOptions({ type, parts });
    const [amin, amax] = rarity.accessories;
    let nAcc = amin + Math.floor(r() * (amax - amin + 1));
    const slots = [opticOpts.length ? "optic" : "", muzzleOpts.length ? "muzzle" : ""].filter(Boolean);
    if (arch.id === "marksman" && slots.includes("optic")) slots.sort((x) => (x === "optic" ? -1 : 1)); else if (r() < 0.5) slots.reverse();
    for (const slot of slots) {
      if (nAcc <= 0) break;
      if (slot === "optic") { const real = opticOpts.filter(isKit), irons = opticOpts.filter(isIron); optic = irons.length && r() < 0.4 ? pick(r, irons) : real.length && r() < 0.75 ? pick(r, real) : pick(r, opticOpts); } else muzzle = pick(r, muzzleOpts);
      // Accesorio de serie del modelo (pack 4): en su hueco, más a menudo que uno cualquiera (el arma queda como el original)
      const own = serie(this.kit, body, slot === "optic" ? "miras" : "bocachas");
      if (own.length && r() < 0.6) { if (slot === "optic") optic = own[0]; else muzzle = own[0]; }
      nAcc--;
    }

    // 4. Acabado y nivel
    const eraPaints = PAINTS.filter((p) => eraFinishes(era).includes(p.id));
    // Peso del acabado × veces que aparece en la lista de la era (la rústica repite "rust" para que predomine)
    const paint = weighted(r, eraPaints.length ? eraPaints : PAINTS, (p) => PAINT_WEIGHTS[PAINTS.indexOf(p)] * Math.max(1, eraFinishes(era).filter((x) => x === p.id).length));
    const level = 8 + Math.floor(r() * 9);

    // 5. Efectos por nivel (A, B, L). Un A y un B no comparten familia; fuego, eléctrico y explosivo son B.
    const effects: Effect[] = [];
    const take = (def: EffectDef) => effects.push({ id: def.id, tier: def.tier, family: def.family, element: def.element, icon: def.icon, color: def.color, value: def.range ? def.range[0] + Math.floor(r() * (def.range[1] - def.range[0] + 1)) : undefined });
    for (const tier of rarity.tiers) {
      // Reglas de combinación: familias distintas, un solo efecto de racha, uno de multiplicar daño y un elemento
      const pool = (tier === "A" ? EFFECTS_A : tier === "B" ? EFFECTS_B : EFFECTS_L).filter((d) => legalWith(effects, d, type));
      if (pool.length) take(pick(r, pool));
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
    // Añadidos de era y de modernización (con adaptadores); el parecido se mide de nuevo con ellos
    // (tampoco añadidos de era en el kit del usuario: solo cinta y parches, que no cambian la forma)
    tweaks.eraAdds = layout === "modular-pistol" || layout === "proc-long" ? null : body.pack === "kit39" ? kit39Era(this.eraAddons(r, era, modLevel, type, layout, parts, tweaks, barrelLength)) : this.eraAddons(r, era, modLevel, type, layout, parts, tweaks, barrelLength);
    const changes = [...varied2.changes, ...eraChanges(tweaks.eraAdds)];
    const simNow = tweaks.eraAdds ? similarity(this.baseSilhouette(layout, parts), this.silhouette(layout, parts, tweaks, barrelLength)) : varied2.similarity;
    const lineage = { base: layout === "modular-pistol" ? ppArchId(parts[0].from) : parts[0].from, swaps: this.swapsOf(layout, parts), changes, ops: tweaks, similarity: +simNow.toFixed(3), era, modLevel };
    const spec: WeaponSpec = { seed, type, archetype: arch.id, fireMode, modeShift: shift?.mode ?? null, burst, layout, parts, barrelLength, muzzle, optic, rarity, paint, level, stats: { ...info.base }, effects, name, statSeed, bonus, tweaks, lineage, era, modLevel };
    return this.refresh(spec);
  }

  /**
   * Piezas de un arma larga despiezada: cajón de una, culata, empuñadura y guardamanos de otras armas (de su familia
   * o de otra), siempre que pasen la puerta de calidad. Al menos dos de las tres piezas son ajenas (o una, si no cabe);
   * si no hay ninguna combinación, null.
   */
  private mixLong(r: Rng, base: AssetEntry, type: BaseType, tweaks: Tweaks, more = false): { stock: AssetEntry; front: AssetEntry; grip: AssetEntry } | null {
        // Una base y poco más: 1-2 piezas de la misma familia (se adaptan a la junta: pieceScale)
        // (los modelos del usuario, u-…, prestan culata, empuñadura y cargador, pero no el guardamanos: en cuña quedaba
        // como un pico pegado en otros fusiles; sí reciben piezas de otros)
        const donors = (role: PartRole, ok: (w: AssetEntry) => boolean) => this.manifest.weapons.filter((w) => w.modular && !w.excluded && !RETIRED.has(w.id) && (!w.id.startsWith("u-") || role !== "front") && w.pack === base.pack && sameEra(w, base) && w.id !== base.id && ok(w) && w.parts.some((p) => p.role === role) && (!w.approved || w.approved.includes(role)) && !w.quarantine);
        const cls = (t: WeaponType) => (t === "smg" ? "compact" : "long");
        const fit = (joint: "rear" | "front" | "grip", lo: number, hi: number) => (w: AssetEntry) => within(jointScale(base, w, joint), lo, hi);
        const libOk = (joint: "rear" | "front" | "grip") => (w: AssetEntry) => !w.donor || within(jointScale(base, w, joint), 0.82, 1.22);
        // (las culatas sueltas son de fusil: en un subfusil quedaban como una placa)
        const stocks = donors("stock", (w) => (w.donor ? cls(type) === "long" : cls(w.type) === cls(type))).filter(fit("rear", 0.7, 1.4)).filter(libOk("rear"));
        const fronts = donors("front", (w) => (!!w.donor && type !== "sniper") || w.type === type || (cls(w.type) === cls(type) && type !== "sniper" && w.type !== "sniper")).filter(fit("front", 0.7, 1.4)).filter(libOk("front"));
        const grips = donors("grip", () => true).filter(fit("grip", 0.72, 1.35)).filter(libOk("grip"));
        // Piezas sueltas de la biblioteca: menos frecuentes que las de armas reales (son muchas y más sencillas) y solo
        // si la junta casi coincide (sin agrandarlas hasta parecer bloques)
        const choose = (list: AssetEntry[]) => {
          if (!list.length) return base;
          const real = list.filter((w) => !w.donor), lib = list.filter((w) => w.donor);
          return pick(r, lib.length && (!real.length || r() < 0.3) ? lib : real);
        };
        const max = more ? 2 : base.pack === "kit39" ? 2 : 1 + (r() < 0.5 ? 1 : 0), min = more ? 2 : 1;
        for (let tries = 0; tries < 40; tries++) {
          // (en el kit del usuario la variedad viene de sus piezas: se cambian más a menudo)
          const kp = base.pack === "kit39" ? 0.75 : 0.5;
          // (guardamanos y culata primero: son las que más cambian la silueta; la empuñadura, menos a menudo)
          const c = { stock: r() < kp + 0.1 ? choose(stocks) : base, front: r() < kp + 0.15 ? choose(fronts) : base, grip: r() < kp - 0.35 ? choose(grips) : base };
          const foreign = [c.stock, c.front, c.grip].filter((x) => x !== base).length;
          if (foreign >= min && foreign <= max && longGunOk(base, c.stock, c.front, c.grip, type, tweaks)) return c;
        }
        return null;
  }

  /** Configuración de serie de un arma del kit (primera variante de cada pieza): su "base". */
  kitDefault(parts: PartPick[]): PartPick[] {
    const cal = this.kit.byId.get(parts[0].from)!.caliber;
    return parts.map((p, i) => {
      if (i === 0) return p;
      const k = this.kit.byId.get(p.from); if (!k || k.slot === "Device") return p;
      const first = this.kit.options(k.slot, cal)[0]; // (las piezas retiradas no cuentan: la de serie pasa a ser la siguiente)
      return first && KIT_ROLE[k.slot] === p.role ? { role: p.role, from: first.id } : p;
    }).filter((p) => !(this.kit.byId.get(p.from)?.slot === "Device"));
  }

  /** Piezas colocadas (perfiles reales) de un arma, para medir su silueta. */
  placedParts(layout: WeaponSpec["layout"], parts: PartPick[], tw: Tweaks, barrelLength: number): { placed: Placed[]; boxes: Box2[]; byRole: Map<string, Placed> } {
    const placed: Placed[] = [], boxes: Box2[] = [], byRole = new Map<string, Placed>();
    const put = (role: string, p: Placed) => { placed.push(p); byRole.set(role, p); };
    if (layout === "proc-long") { put("body", { profile: longEntry("tmp", tw.long ?? plBaseDesign(parts[0].from)).profiles!.body!, isBody: true }); return { placed, boxes, byRole }; }
    if (layout === "modular-pistol") {
      // Sin diseño (sin cambios) = el arquetipo del que sale. (La silueta usa los tramos por pieza del diseño.)
      put("body", { profile: designEntry("tmp", tw.pistol ?? ppBaseDesign(parts[0].from)).profiles!.body!, isBody: true });
      if (tw.pstock && !tw.nostock) put("stock", { profile: stockProfile(tw.pstock) });
      const kdev = tw.device ? this.kit.byId.get(tw.device.id) : null;
      if (kdev && tw.device) boxes.push({ x0: tw.device.at[0] + kdev.bounds.min[0], x1: tw.device.at[0] + kdev.bounds.max[0], y0: tw.device.at[1] + kdev.bounds.min[1], y1: tw.device.at[1] + kdev.bounds.max[1] });
      return { placed, boxes, byRole };
    }
    if (layout === "kit") {
      const { placements } = kitPlacements(this.kit, { parts, optic: null, muzzle: null, barrelLength, tweaks: tw });
      for (const pl of placements) if (pl.part.profile) put(pl.role, { profile: pl.part.profile, offset: pl.pos, scale: [pl.stretch, pl.role === "magazine" ? tw.magLen ?? 1 : 1, 1] });
      if (tw.pstock) put("stock", { profile: stockProfile(tw.pstock) }); // (en el kit, la culata por código sustituye a la suya)
      if (tw.pfront) put("front", { profile: frontProfile(tw.pfront) });
      const kdev = tw.device ? this.kit.byId.get(tw.device.id) : null;
      if (kdev && tw.device) boxes.push({ x0: tw.device.at[0] + kdev.bounds.min[0], x1: tw.device.at[0] + kdev.bounds.max[0], y0: tw.device.at[1] + kdev.bounds.min[1], y1: tw.device.at[1] + kdev.bounds.max[1] });
      for (const a of tw.adds ?? []) boxes.push({ x0: a.x0, x1: a.x1, y0: a.y, y1: a.y + a.h });
      addEraBoxes(boxes, tw.eraAdds);
      return { placed, boxes, byRole };
    }
    const base = this.byId.get(parts[0].from)!;
    if (layout === "modular-long" && base.joints && base.profiles?.receiver) {
      put("receiver", { profile: base.profiles.receiver });
      if (tw.pstock && !tw.nostock) put("stock", { profile: stockProfile(tw.pstock) });
      if (tw.pfront) put("front", { profile: frontProfile(tw.pfront) });
      for (const role of ["stock", "front", "grip"] as const) {
        if (role === "stock" && (tw.nostock || tw.pstock)) continue;
        if (role === "front" && tw.pfront) continue;
        const d = this.byId.get(parts.find((p) => p.role === role)?.from ?? "");
        const prof = d?.profiles?.[role]; if (!d?.joints || !prof) continue;
        const sv = pieceScale(base, d, role, tw);
        const face = d.joints[role === "stock" ? "stockFace" : role === "front" ? "frontFace" : "gripFace"].pos;
        const at = base.joints[role === "stock" ? "rear" : role].pos;
        const stretch = role === "stock" ? midZone(prof.x0, face[0], tw.stock, 0.25, 0.2, true) : role === "front" ? midZone(face[0], prof.x1, tw.front, 0.15, 0.25) : null;
        // Las piezas propias de la base no se mueven (se escalan desde su junta); las ajenas se alinean por la cara de unión
        const own = d.id === base.id;
        const off: [number, number, number] = own ? [face[0] * (1 - sv[0]), at[1] * (1 - sv[1]), 0] : [at[0] - face[0] * sv[0], at[1] - face[1] * sv[1], 0];
        // Culata plegada: media vuelta sobre la junta (queda hacia delante, al costado)
        if (role === "stock" && tw.fold) put(role, { profile: prof, stretch, scale: [-sv[0], sv[1], sv[2]], offset: [2 * at[0] - off[0], off[1], 0] });
        else put(role, { profile: prof, stretch, scale: sv, offset: off });
      }
    } else {
      for (const [role, prof0] of Object.entries(base.profiles ?? {})) {
        if (role === "magazine" || !prof0) continue;
        let prof = prof0;
        if (role === "body" && tw.cutFront != null) prof = clipProfile(prof, tw.cutFront, "below");
        if (role === "body" && tw.cutRear != null) prof = clipProfile(prof, tw.cutRear, "above");
        put(role, { profile: prof, stretch: role === "body" ? bodyZones(prof0, tw) : null });
      }
      if (tw.pstock) put("stock", { profile: stockProfile(tw.pstock) });
      if (tw.pfront) put("front", { profile: frontProfile(tw.pfront) });
    }
    const magPick = parts.find((p) => p.role === "magazine");
    if (magPick && base.sockets.magazine) {
      if (tw.drum) { const d = drumOf(base); boxes.push({ x0: d.x - d.R, x1: d.x + d.R, y0: d.y - d.R, y1: d.y + d.R }); }
      else {
        const m = this.byId.get(magPick.from); const prof = m?.profiles?.magazine; const have = m?.sockets.magazine, want = base.sockets.magazine;
        if (prof && have) { const k = Math.min(1.6, Math.max(0.6, (want.size?.[0] ?? 1) / (have.size?.[0] ?? 1))); const ky = k * (tw.magLen ?? 1); put("magazine", { profile: prof, scale: [k, ky, k], offset: [want.pos[0] - have.pos[0] * k, want.pos[1] - have.pos[1] * ky, 0] }); }
      }
    }
    if (tw.rail) boxes.push({ x0: tw.rail[0], x1: tw.rail[1], y0: tw.rail[2] - 0.004, y1: tw.rail[2] + 0.012 });
    for (const a of tw.adds ?? []) boxes.push({ x0: a.x0, x1: a.x1, y0: a.y, y1: a.y + a.h });
    addEraBoxes(boxes, tw.eraAdds);
    const dev = tw.device ? this.kit.byId.get(tw.device.id) : null;
    if (dev && tw.device) boxes.push({ x0: tw.device.at[0] + dev.bounds.min[0], x1: tw.device.at[0] + dev.bounds.max[0], y0: tw.device.at[1] + dev.bounds.min[1], y1: tw.device.at[1] + dev.bounds.max[1] });
    return { placed, boxes, byRole };
  }
  silhouette(layout: WeaponSpec["layout"], parts: PartPick[], tw: Tweaks, barrelLength: number) {
    const { placed, boxes } = this.placedParts(layout, parts, tw, barrelLength);
    // Pistolas generadas: tramos por pieza (cuentan los huecos del guardamonte y entre cargador y empuñadura)
    if (layout === "modular-pistol") return [...designSpans(tw.pistol ?? ppBaseDesign(parts[0].from)), ...spans(placed.filter((p) => !p.isBody), boxes)];
    if (layout === "proc-long") return longSpans(tw.long ?? plBaseDesign(parts[0].from));
    return spans(placed, boxes);
  }
  /** Silueta de la base, tal cual viene (o la configuración de serie del kit). */
  baseSilhouette(layout: WeaponSpec["layout"], parts: PartPick[]) {
    if (layout === "kit") return this.silhouette("kit", this.kitDefault(parts), NO_TWEAKS, 1);
    if (layout === "modular-pistol") return designSpans(ppBaseDesign(parts[0].from));
    if (layout === "proc-long") return longSpans(plBaseDesign(parts[0].from));
    const base = this.byId.get(parts[0].from)!;
    // Despiezadas: solo las piezas que lleva el arma (si se le quitó la mira de serie, la base se mide sin ella)
    const roles = layout === "modular-long" ? new Set<string>(["receiver", ...parts.map((p) => p.role)]) : null;
    return spans(Object.entries(base.profiles ?? {}).filter(([role, pr]) => pr && (!roles || roles.has(role))).map(([, profile]) => ({ profile: profile! })));
  }
  /**
   * Arma para un lote (cofre, botín): no repite la base de las armas recientes y no se parece de perfil más de
   * BATCH_MAX_SIMILARITY a ninguna del mismo tipo. Determinista para la misma semilla y el mismo lote.
   */
  generateDistinct(seed: number, wanted: BaseType | undefined, recent: WeaponSpec[], forceRarity?: RarityId): WeaponSpec {
    for (let i = 0; i < 16; i++) {
      const w = this.generate(seed + i * 7919, wanted, forceRarity);
      const baseOf = (x: WeaponSpec) => x.lineage?.base ?? x.parts[0].from;
      if (recent.some((x) => baseOf(x) === baseOf(w))) continue;
      if (recent.some((x) => x.type === w.type && this.likeness(x, w) > BATCH_MAX_SIMILARITY)) continue;
      return w;
    }
    return this.generate(seed, wanted, forceRarity);
  }

  /** Parecido de silueta entre dos armas (1 = idénticas de perfil). */
  likeness(a: WeaponSpec, b: WeaponSpec) { return similarity(this.silhouette(a.layout, a.parts, a.tweaks, a.barrelLength), this.silhouette(b.layout, b.parts, b.tweaks, b.barrelLength)); }

  /** Cambios sobre piezas reales: varias tiradas y se queda con la que cae en el rango de parecido (o la más cercana). */
  /**
   * Pistola modular generada por código: se parte del diseño del arquetipo y se cambian 2-5 piezas (corredera, cañón,
   * compensador, armazón, guardamonte, empuñadura, cargador, parte superior, martillo), midiendo la silueta frente al
   * arquetipo hasta caer en la banda de parecido con al menos 3 cambios. Opcional: accesorio bajo el raíl del armazón.
   */
  /**
   * Variación de una pistola o revólver generado: mutaciones sobre el diseño del arquetipo hasta caer en la banda de
   * parecido (o cerca de `target`, para la hoja de decisión). Pesan más las estructurales: cada candidata lleva al
   * menos una, y las que se alejan por debajo de 0,8 deben llevar dos o más (no basta con alargar el cañón).
   */
  private varyPistol(r: Rng, _type: BaseType, parts: PartPick[], era: PEra, target?: number | null): { tweaks: Tweaks; similarity: number; barrelLength: number; changes: string[] } {
    const d0 = ppBaseDesign(parts[0].from);
    const ref = designSpans(d0);
    if (target === 1) return { tweaks: { ...NO_TWEAKS, pistol: d0 }, similarity: 1, barrelLength: 1, changes: [] };
    const [lo, hi] = target ? [target - 0.02, target + 0.02] : SIMILARITY_RANGE;
    const allowed = PISTOL_MUTATIONS.filter((m) => mutationAllowed(m.id, era, d0));
    const structural = allowed.filter((m) => m.structural), detail = allowed.filter((m) => !m.structural);
    const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; } return o; };
    type C = { tw: Tweaks; sim: number; dd: number; ch: string[] };
    let best: C | null = null; const cands: C[] = [];
    let amp = 1, nS = 1 + Math.floor(r() * 2);
    // Culata de hombro: se decide una vez por arma (~12 %; en carbinas, más), no por candidata
    const wantStock = r() < (d0.family === "carbine" ? CARBINE_STOCK_P : PISTOL_STOCK_P);
    const tries = target ? 120 : 40;
    for (let i = 0; i < tries; i++) {
      // Lejos de la banda por arriba: más cambios estructurales; por debajo: menos
      if (best && best.sim > hi && i % 3 === 2) { nS = Math.min(structural.length, nS + 1); amp = Math.min(target ? 2.6 : 1.8, amp * 1.2); }
      if (best && best.sim < lo && i % 4 === 3) { nS = Math.max(1, nS - 1); amp = Math.max(0.4, amp * 0.8); }
      const d: PistolDesign = structuredClone(d0);
      const ops = [...shuffle(structural).slice(0, nS), ...shuffle(detail).slice(0, 1 + Math.floor(r() * 3))];
      const ch: string[] = [];
      // Un cambio cuenta solo si se ve: altera el perfil de alguna pieza (o el estriado del cañón a la vista)
      const seen = (x: PistolDesign) => JSON.stringify(designPolys(x)) + (x.barrel.ext > 0 ? x.barrel.profile : "");
      for (const m of ops) { if (!mutationAllowed(m.id, era, d)) continue; const before = seen(d); m.run(d, r, amp); if (seen(d) !== before) ch.push(m.id); }
      const tw: Tweaks = { ...NO_TWEAKS, pistol: d };
      // Culata de hombro (~12 %; en carbinas, más): en el armazón (modernas) o en el talón de la empuñadura (clásicas)
      if (wantStock) { tw.pstock = pistolStock(r, d); ch.push(`stock-${tw.pstock.kind}`); }
      // Accesorio real bajo el raíl del armazón (linterna o láser), si lo hay y la era lo admite
      if (d.frame.rail && era !== "classic" && d.mag.kind !== "front" && (!d.frame.vgrip || d.frame.vgrip === "none") && r() < 0.3) {
        const fx = d.frame.full ? d.slide.len + d.barrel.ext : d.slide.len * d.frame.dust;
        const at: [number, number] = [fx - 0.03, -d.frame.h - 0.006];
        tw.light = { id: pick(r, this.lightPool()).id, at, side: false }; tw.lightZone = { at, side: false }; ch.push("device");
      }
      const sim = similarity(ref, this.silhouette("modular-pistol", parts, tw, 1));
      const nStruct = ch.filter((c) => STRUCTURAL.has(c) || c.startsWith("stock-")).length;
      const dd = (ch.length < 3 ? 1 : 0) + (sim < 0.8 && nStruct < 2 ? 1 : 0) + (sim < lo ? lo - sim : sim > hi ? sim - hi : 0);
      const c = { tw, sim, dd, ch }; cands.push(c);
      if (!best || dd < best.dd) best = c;
      if (cands.filter((x) => x.dd === 0).length >= (target ? 1 : 3)) break;
    }
    // Entre las que cumplen (o, si ninguna, entre las casi mejores), una al azar: más variedad dentro del arquetipo
    const good = best!.dd === 0 ? cands.filter((c) => c.dd === 0) : cands.filter((c) => c.dd <= best!.dd + 0.01); best = good[Math.floor(r() * good.length)];
    const d = best.tw.pistol!, L0 = d0.slide.len + d0.barrel.ext, L1 = d.slide.len + d.barrel.ext;
    return { tweaks: best.tw, similarity: best.sim, barrelLength: Math.min(1.5, Math.max(0.75, L1 / L0)), changes: best.ch };
  }

  /**
   * Variación de un arma larga generada: 3-5 cambios (al menos 2 estructurales: alimentación, culata, guardamanos,
   * parte superior, cajón, bípode o asa), medidos con la silueta frente al arquetipo hasta caer en la banda de parecido.
   */
  private varyLong(r: Rng, parts: PartPick[], target?: number | null): { tweaks: Tweaks; similarity: number; barrelLength: number; changes: string[] } {
    const d0 = plBaseDesign(parts[0].from), ref = longSpans(d0);
    if (target === 1) return { tweaks: { ...NO_TWEAKS, long: d0 }, similarity: 1, barrelLength: 1, changes: [] };
    const [lo, hi] = target ? [target - 0.02, target + 0.02] : SIMILARITY_RANGE;
    const structural = LONG_MUTATIONS.filter((m) => m.structural), detail = LONG_MUTATIONS.filter((m) => !m.structural);
    const shuffle = <T,>(a: T[]) => { const o = [...a]; for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; } return o; };
    type C = { tw: Tweaks; sim: number; dd: number; ch: string[] };
    let best: C | null = null; const cands: C[] = [];
    let amp = 1, nS = 2;
    const seen = (x: LongDesign) => JSON.stringify(longPolys(x).map((p) => p.poly.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)])));
    for (let i = 0; i < (target ? 120 : 70); i++) {
      if (best && best.sim > hi && i % 2 === 1) { nS = Math.min(4, nS + 1); amp = Math.min(target ? 2.6 : 2, amp * 1.25); }
      if (best && best.sim < lo && i % 4 === 3) { nS = Math.max(2, nS - 1); amp = Math.max(0.4, amp * 0.8); }
      const d: LongDesign = structuredClone(d0), ch: string[] = [];
      const ops = [...shuffle(structural).slice(0, nS), ...shuffle(detail).slice(0, 1 + Math.floor(r() * 2))];
      for (const m of ops) { if (ch.length >= 5 || !longMutationAllowed(m.id, d)) continue; const before = seen(d); m.run(d, r, amp); if (seen(d) !== before) ch.push(m.id); }
      const tw: Tweaks = { ...NO_TWEAKS, long: d };
      const sim = similarity(ref, longSpans(d));
      const nStruct = ch.filter((c) => LONG_STRUCTURAL.has(c)).length;
      const dd = (ch.length < 3 ? 1 : 0) + (nStruct < 2 ? 1 : 0) + (sim < lo ? lo - sim : sim > hi ? sim - hi : 0);
      const c = { tw, sim, dd, ch }; cands.push(c);
      if (!best || dd < best.dd) best = c;
      if (cands.filter((x) => x.dd === 0).length >= (target ? 1 : 3)) break;
    }
    const good = best!.dd === 0 ? cands.filter((c) => c.dd === 0) : cands.filter((c) => c.dd <= best!.dd + 0.01); best = good[Math.floor(r() * good.length)];
    const d = best.tw.long!, L0 = d0.recv.len + d0.barrel.len, L1 = d.recv.len + d.barrel.len;
    return { tweaks: best.tw, similarity: best.sim, barrelLength: Math.min(1.5, Math.max(0.75, L1 / L0)), changes: best.ch };
  }
  private plForce: { arch: string; era: LEra; target: number | null } | null = null;
  /** Arma larga generada de un arquetipo y era concretos, a un parecido objetivo (hoja de decisión). */
  generateLongAt(seed: number, arch: string, era: LEra, target: number | null, rarity?: RarityId): WeaponSpec {
    const a = LONG_ARCHES.find((x) => x.id === arch); if (!a) throw new Error(`No long archetype ${arch}`);
    this.plForce = { arch, era, target };
    try { return this.generate(seed, a.family, rarity); } finally { this.plForce = null; }
  }
  /** Fuerza el arquetipo, la era y el parecido objetivo de la próxima pistola generada (hoja de decisión del banco). */
  private ppForce: { arch: string; era: PEra; target: number | null } | null = null;
  /** Pistola o revólver de un arquetipo y era concretos, a un parecido objetivo (1 = el arquetipo tal cual). */
  generatePistolAt(seed: number, arch: string, era: PEra, target: number | null, rarity?: RarityId): WeaponSpec {
    const a = PISTOL_ARCHES.find((x) => x.id === arch); if (!a) throw new Error(`No pistol archetype ${arch}`);
    this.ppForce = { arch, era, target };
    try { return this.generate(seed, a.family === "revolver" ? "revolver" : "pistol", rarity); } finally { this.ppForce = null; }
  }
  /** Matriz de parecido entre las armas de un lote (silueta contra silueta, no solo contra su base). */
  lotMatrix(specs: WeaponSpec[]): number[][] {
    const sil = specs.map((w) => this.silhouette(w.layout, w.parts, w.tweaks ?? NO_TWEAKS, w.barrelLength));
    return sil.map((a, i) => sil.map((b, j) => (i === j ? 1 : similarity(a, b))));
  }

  private vary(r: Rng, type: BaseType, layout: WeaponSpec["layout"], parts: PartPick[], tw0: Tweaks, barrelLength: number, era: Era = "modern"): { tweaks: Tweaks; similarity: number; barrelLength: number; changes: string[] } {
    const base = this.byId.get(parts[0].from);
    const swaps = this.swapsOf(layout, parts);
    if (layout !== "kit" && !base?.profiles) return { tweaks: tw0, similarity: 1, barrelLength, changes: swaps.map((p) => `swap:${p.role}`) };
    const ref = this.baseSilhouette(layout, parts);
    const [lo, hi] = SIMILARITY_RANGE;
    let best: { tw: Tweaks; bl: number; sim: number; d: number; ch: string[] } | null = null;
    const cands: { tw: Tweaks; bl: number; sim: number; d: number; ch: string[] }[] = [];
    let amp = 1;
    // Cambios llamativos solo en una parte de las armas (si no, el generador los usaría siempre para alejarse de la base)
    const rare = { nostock: r() < 0.3, hgStock: r() < 0.4, front: r() < 0.4 }; const snubOk = r() < 0.4;
    for (let i = 0; i < 110; i++) {
      // Si la mejor tirada hasta ahora se aleja demasiado de la base, las siguientes cambian con menos amplitud
      if (best && best.sim < lo && i % 6 === 5) amp = Math.max(0.35, amp * 0.7);
      if (best && best.sim > hi && i % 4 === 3) amp = Math.min(2.8, amp * 1.3);
      // Si con los cambios normales no entra en la banda (amplitud alta), se permiten también culata y conjunto carabina
      const gate = amp > 1.4 ? { nostock: rare.nostock, hgStock: true, front: true } : rare;
      const { tw, barrelLength: bl } = this.rollOps(r, type, layout, parts, tw0, barrelLength, swaps.length, amp, gate, era);
      if (layout === "modular-long" && base) {
        const get = (role: string) => this.byId.get(parts.find((p) => p.role === role)!.from)!;
        if (!longGunOk(base, get("stock"), get("front"), get("grip"), type, tw)) continue;
      }
      if (tw.pstock || tw.pfront) {
        // Con piezas por código: largo total razonable para el tipo
        const sp = this.silhouette(layout, parts, tw, bl); const xs = sp.map((p) => p[0]);
        const L = Math.max(...xs) - Math.min(...xs), ref = TYPE_LENGTH[type] ?? 0.9;
        const handgun = type === "pistol" || type === "revolver";
        // (armas cortas con culata o conjunto carabina: más largas a propósito)
        const short = handgun || type === "smg" || type === "bullpup";
        if (L / ref < 0.75 || L / ref > (handgun && (tw.pstock || tw.pfront) ? 2.1 : short && tw.pfront && !tw.cutFront ? 1.6 : 1.3)) continue;
      }
      const ch = changesOf(layout, tw, bl, swaps);
      const sim = similarity(ref, this.silhouette(layout, parts, tw, bl));
      // Mínimo 3 cambios; dentro de eso, el parecido más cercano al rango buscado
      // (revólver entero recortado: el cañón corto cambia poco la silueta, pero es otra arma; con 3 cambios vale, si no el
      // filtro solo aceptaba cañones larguísimos y todos los de la misma base salían iguales)
      const snub = snubOk && layout === "body" && type === "revolver" && (tw.body ?? 1) < 0.8 && sim > hi;
      const d = (ch.length < 3 ? 1 : 0) + (snub ? 0 : sim < lo ? lo - sim : sim > hi ? sim - hi : 0);
      const c = { tw, bl, sim, d, ch }; cands.push(c);
      if (!best || d < best.d) best = c;
      if (d === 0) break;
    }
    // Si ninguna cae en la banda, se elige al azar entre las casi mejores (no siempre la más extrema): más variedad
    if (best && best.d > 0) { const near = cands.filter((c) => c.d <= best!.d + 0.05); best = near[Math.floor(r() * near.length)]; }
    return best ? { tweaks: best.tw, similarity: best.sim, barrelLength: best.bl, changes: best.ch } : { tweaks: tw0, similarity: 1, barrelLength, changes: [] };
  }

  /** Piezas cambiadas respecto a la base (en el kit, respecto a su configuración de serie). */
  swapsOf(layout: WeaponSpec["layout"], parts: PartPick[]): PartPick[] {
    const baseId = parts[0].from;
    const defaults = layout === "kit" ? this.kitDefault(parts) : [];
    return parts.slice(1).filter((p) => p.from !== baseId && !(layout === "kit" && defaults.some((d) => d.from === p.from)));
  }

  private rollOps(r: Rng, type: BaseType, layout: WeaponSpec["layout"], parts: PartPick[], tw0: Tweaks, barrelLength: number, swaps: number, amp = 1, rare: { nostock: boolean; hgStock: boolean; front?: boolean } = { nostock: true, hgStock: true, front: true }, era: Era = "modern"): { tw: Tweaks; barrelLength: number } {
    const long = type !== "pistol" && type !== "revolver";
    let wantBipod = false;
    const tw: Tweaks = { ...tw0, rail: null, drum: false, device: null, light: null, lightZone: null, nostock: false, magLen: 1, stockH: 1, fold: false, pstock: null, pfront: null, cutRear: null, cutFront: null, adds: null };
    let bl = barrelLength;
    // Valor al azar en [lo, hi] pero lejos de 1: cada cambio elegido se tiene que notar
    // `amp` < 1 acerca el rango a 1 (cambios más suaves) cuando el arma se aleja demasiado de su base
    const away = (lo0: number, hi0: number, min0 = 0.12) => {
      const lo = Math.max(0.5, 1 - (1 - lo0) * amp), hi = Math.min(1.9, 1 + (hi0 - 1) * amp), min = Math.max(0.06, Math.min(0.3, min0 * amp));
      for (let i = 0; i < 20; i++) { const f = lo + r() * (hi - lo); if (Math.abs(f - 1) >= min) return f; }
      return r() < 0.5 ? Math.max(lo, 1 - min) : Math.min(hi, 1 + min);
    };
    const base = layout === "kit" ? null : this.byId.get(parts[0].from)!;
    const ops: { id: string; run: () => void }[] = [];
    if (layout === "modular-long") {
      ops.push({ id: "front", run: () => (tw.front = away(0.72, 1.22)) }); // (hasta 1,45 salían cañones finísimos y larguísimos: «un palo con una mira»)
      ops.push({ id: "stock", run: () => (tw.stock = away(0.72, 1.32)) });
      ops.push({ id: "stockH", run: () => (tw.stockH = away(0.88, 1.12, 0.06)) });
      ops.push({ id: "grip", run: () => { tw.grip = away(0.9, 1.14, 0.06); tw.gripAngle = (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.06); } });
      // Sin culata solo en armas cortas (subfusiles y escopetas de menos de ~75 cm): en una larga se ve raro
      const len = base ? base.bounds.max[0] - base.bounds.min[0] : 1;
      if ((type === "smg" || type === "shotgun") && len < 0.75) if (rare.nostock) ops.push({ id: "nostock", run: () => (tw.nostock = true) });
      const J = base?.joints;
      const thick = base ? (base.bounds.max[2] - base.bounds.min[2]) * 0.7 : 0.03;
      if (J) {
        // Culata plegada (subfusiles, fusiles y escopetas), culata y guardamanos por código
        // Plegable solo en subfusiles con culata fina (las culatas macizas plegadas parecen una caja pegada)
        const st = this.byId.get(parts.find((p) => p.role === "stock")?.from ?? "")?.partBounds?.stock;
        // (no en el kit del usuario: sus culatas reales plegadas quedaban como una placa colgando delante)
        if (type === "smg" && st && st.max[1] - st.min[1] < 0.07 && base?.pack !== "kit39") ops.push({ id: "fold", run: () => (tw.fold = true) });
        ops.push({ id: "pstock", run: () => (tw.pstock = procStock(r, type, [J.rear.pos[0], J.rear.pos[1]], J.rear.size?.[0] ?? 0.05, thick)) });
        ops.push({ id: "pfront", run: () => (tw.pfront = procFront(r, type, [J.front.pos[0], J.front.pos[1]], J.front.size?.[0] ?? 0.05, thick)) });
      }
    } else if (layout === "body") {
      // Las recortadas no se alargan (dejarían de ser recortadas): solo se pueden acortar un poco
      const sawed = /sawed|sawoff|mini|shotgun-03/.test(parts[0].from);
      ops.push({ id: "barrel", run: () => { if (!tw.pfront) tw.body = sawed ? 0.82 + r() * 0.1 : long ? away(0.75, 1.4) : type === "revolver" && r() < 0.45 ? 0.58 + r() * 0.14 : away(0.82, 1.32); } });
      // Armas enteras largas: se corta el cuerpo y se pone culata o guardamanos por código (solo si la sección es fina)
      const prof = base?.profiles?.body;
      // Armas cortas: culata de hombro opcional (pistolas ametralladoras, carabinas de revólver)
      if (!long && prof && rare.hgStock) {
        const L = prof.x1 - prof.x0, n = prof.top.length;
        ops.push({ id: "pstock", run: () => {
          // Se engancha detrás de la empuñadura, a media altura de la parte trasera
          const k = Math.min(n - 1, Math.floor(n * 0.06)); const t = prof.top[k], b = prof.bot[k];
          if (t == null || b == null) return;
          const y = b + (t - b) * 0.35;
          // Tipos de culata (prompt 05-A): esqueleto, tubo, plegable, brace de polímero, de carabina; madera en las clásicas
          // Pistolas y revólveres: solo macizas (las de varilla quedaban finas y mal unidas en un arma corta)
          const short = type === "pistol" || type === "revolver";
          const kinds: StockKind[] = short ? (era === "classic" ? ["wood"] : era === "rustic" ? ["wood", "polymer"] : ["polymer", "carbine"])
            : era === "classic" ? ["wood", "folding"] : era === "rustic" ? ["wood", "tube", "skeleton", "folding"] : ["skeleton", "tube", "folding", "polymer", "carbine"];
          tw.pstock = { kind: kinds[Math.floor(r() * kinds.length)], at: [prof.x0 + L * 0.04, y], h: 0.032, w: 0.024, len: 0.15 + r() * 0.07, drop: 0.012 + r() * 0.02 };
          // Revólver: la culata solo como kit de carabina, con el cañón alargado (regla del usuario)
          if (type === "revolver") tw.body = Math.max(tw.body ?? 1, 1.3 + r() * 0.15);
        } });
      }
      // Conjunto carabina (armas cortas y bullpups): cañón largo con guardamanos montado en la boca, sin cortar el cuerpo
      const mz = base?.sockets.muzzle;
      // (pistolas y revólveres no: el conjunto en la boca les doblaba el largo y parecían un tubo pegado)
      if (mz && prof && ((rare.front ?? true) && (!long || type === "smg") || type === "bullpup") && !sawed && type !== "pistol" && type !== "revolver") {
        ops.push({ id: "pfront", run: () => {
          const k = Math.min(prof.top.length - 1, Math.floor(prof.top.length * 0.93)); const t = prof.top[k], b = prof.bot[k];
          const hBody = t != null && b != null ? t - b : 0.03;
          const h = type === "bullpup" ? Math.min(0.06, Math.max(0.036, hBody * 0.55)) : type === "smg" ? Math.min(0.05, Math.max(0.03, hBody * 0.7)) : Math.min(0.045, Math.max(0.024, Math.min(hBody, (mz.diameter ?? 0.012) * 2.6)));
          // Donde acaba de verdad la silueta del cuerpo (algunos modelos traen la boca desplazada): nada flotando
          let kEnd = prof.top.length - 1; while (kEnd > 0 && (prof.top[kEnd] == null || prof.bot[kEnd] == null)) kEnd--;
          const xEnd = Math.min(mz.pos[0], prof.x0 + ((prof.x1 - prof.x0) * (kEnd + 1)) / prof.top.length);
          // (subfusiles: conjunto corto; uno largo y fino parecía un tubo pegado en la boca)
          const len = type === "smg" ? ((BASE_SIZE[parts[0].from] ?? 1) < 1 ? 0.14 + r() * 0.09 : 0.07 + r() * 0.06) : (long ? 0.12 : 0.07) + r() * (long ? 0.12 : 0.07);
          tw.body = 1; tw.cutFront = null; // sin estirar ni cortar el cuerpo: el conjunto va en la boca de serie
          tw.pfront = { kind: era === "classic" ? (r(), "tube") : (["tube", "quad", "slot"] as const)[Math.floor(r() * 3)], at: [xEnd - 0.012, mz.pos[1]], h, w: Math.min(0.04, h * 0.9), len, barrel: type === "smg" ? 0.015 + r() * 0.035 : 0.02 + r() * 0.05, d: Math.min(0.02, Math.max(0.011, mz.diameter ?? 0.013)) };
        } });
      }
      if (long && prof && !sawed) {
        const col = (x: number) => { const n = prof.top.length, k = Math.min(n - 1, Math.max(0, Math.floor(((x - prof.x0) / (prof.x1 - prof.x0)) * n))); const t = prof.top[k], b = prof.bot[k]; return t == null || b == null ? null : { y: (t + b) / 2, h: t - b }; };
        const L = prof.x1 - prof.x0, thick = base ? (base.bounds.max[2] - base.bounds.min[2]) * 0.7 : 0.03;
        const maxH = type === "bullpup" ? 0.11 : 0.09;
        ops.push({ id: "pfront", run: () => { const x = prof.x0 + L * (0.6 + r() * 0.08); const c = col(x); if (c && c.h < maxH && c.h > 0.015) { tw.cutFront = x; tw.body = 1; tw.pfront = procFront(r, type, [x, c.y], c.h, thick); } } });
        if (type !== "sniper") ops.push({ id: "pstock", run: () => { const x = prof.x0 + L * (0.22 + r() * 0.08); const c = col(x); if (c && c.h < 0.09 && c.h > 0.015) { tw.cutRear = x; tw.stock = 1; tw.pstock = procStock(r, type, [x, c.y], c.h, thick); } } });
      }
      // (culata integrada en el cuerpo, como el P90: estirarla mucho dejaba un bloque trasero enorme; solo un poco)
      if (long) ops.push({ id: "stock", run: () => (tw.stock = INTEGRAL_STOCK.has(parts[0].from) ? away(0.84, 1.16, 0.07) : away(0.75, 1.3)) });
    } else {
      ops.push({ id: "barrel", run: () => { const k = kitLengths(r, type, parts); bl = k.barrelLength; tw.front = k.front; } });
      if (type !== "pistol") ops.push({ id: "stock", run: () => (tw.stock = away(0.8, 1.2, 0.08)) });
      // (sin culata solo en escopetas: en los fusiles del kit quedaba un cajón suelto con un cañón larguísimo)
      if (type === "shotgun") if (rare.nostock) ops.push({ id: "nostock", run: () => (tw.nostock = true) });
      if (type !== "shotgun") ops.push({ id: "mag", run: () => (tw.magLen = type === "pistol" ? 1.18 + r() * 0.2 : 1.2 + r() * 0.3) });
      // Culata y guardamanos por código sobre los sockets de la plataforma (el cañón real del kit se conserva)
      const plat = this.kit.byId.get(parts[0].from);
      const sStock = plat?.sockets.Stock?.[0], sHand = plat?.sockets.Handguard?.[0];
      void sHand; // (el guardamanos del kit se conserva siempre)
      // Fusiles: a veces culata por código en el socket de la culata (sustituye a la del kit; se marca nostock para que
      // la del kit no se coloque)
      if (type === "rifle" && sStock && era !== "classic") ops.push({ id: "pstock", run: () => {
        const st = procStock(r, type, [sStock[0], sStock[1]], 0.05, 0.03);
        const kinds = ["solid", "polymer", "carbine", "skeleton"] as const; // (sin tubo: nada de varillas finas)
        const h = 0.045 + r() * 0.03;
        tw.pstock = { ...st, kind: kinds[Math.floor(r() * kinds.length)], len: 0.17 + r() * 0.16, h, drop: h * (0.2 + r() * 0.9) }; tw.nostock = true;
      } });
      if (type === "pistol" && !parts.some((p) => this.kit.byId.get(p.from)?.slot === "Device")) ops.push({ id: "device", run: () => (tw.device = { id: "", at: [0, 0] }) });
    }
    // Añadidos estructurales clásicos (cambian la silueta con piezas, no deformándola): se colocan más abajo sobre la
    // silueta ya estirada. Valen en cualquier era, así las armas clásicas también llegan a sus 3 cambios.
    const wantAdd = (k: Addon["kind"]) => ops.push({ id: `add-${k}`, run: () => { tw.adds = [...(tw.adds ?? []), { kind: k, x0: 0, x1: 0, y: 0, h: 0 }]; } });
    const sawedGun = /sawed|sawoff|mini|shotgun-03/.test(parts[0].from);
    if (layout === "body") {
      // Revólveres enteros: banda, refuerzo y camisa como alternativas (antes salían siempre las dos primeras juntas)
      if (type === "revolver") { const pick = (["rib", "lug", "jacket"] as const).filter(() => r() < 0.6); for (const k of pick.length ? pick : (["lug"] as const)) wantAdd(k); }
      if (type === "pistol") wantAdd("lug");
      if (type === "shotgun") { if (!sawedGun) wantAdd("shield"); wantAdd("rib"); }
      // (sin cubrecañón en subfusiles: los que lo llevan ya lo traen de serie; añadido quedaba como una caja pegada).
      // En su lugar, alza de escalera: detalle pequeño y natural en un subfusil
      if (type === "smg") wantAdd("ladder");
      if (type === "rifle" || type === "sniper") wantAdd("ladder");
      if (type === "bullpup") wantAdd("bipod");
      // (kit del usuario: sin la varilla de bípode por código; se veía como un palo bajo el cañón)
      if ((type === "lmg" || type === "sniper") && this.byId.get(parts[0].from)?.pack !== "kit39") wantAdd("bipod");
    } else if (layout === "modular-long" && (type === "lmg" || type === "sniper")) {
      // Kit del usuario: su bípode real desplegado (no la varilla por código, que se veía como un palo bajo el cañón)
      if (this.byId.get(parts[0].from)?.pack === "kit39") wantBipod = era !== "classic" && r() < 0.6; else wantAdd("bipod");
    }
    // Kit modular (fusiles): bípode plegado (más variedad entre armas del kit). Sin lanzagranadas: descartado (05).
    if (layout === "kit" && type === "rifle") wantAdd("bipod");
    // Escopetas del kit: cubrecañón perforado y banda ventilada (sus cambios de serie apenas movían la silueta)
    if (layout === "kit" && type === "shotgun") { wantAdd("shield"); wantAdd("rib"); }
    // Añadidos grandes (cambian de verdad la silueta): asa, camisa y carrillera
    if (layout !== "kit") {
      if (type === "rifle" || type === "bullpup" || type === "lmg") wantAdd("handle");
      if (type === "lmg" || (type === "smg" && layout === "modular-long")) wantAdd("jacket");
      if ((type === "sniper" || type === "rifle") && layout === "modular-long") wantAdd("cheek");
    }
    // Cargador alargado o de tambor solo donde el cargador va por debajo (no en armas con cargador superior, como el P90)
    const magBelow = !!base?.sockets.magazine && base.sockets.magazine.pos[1] < (base.bounds.min[1] + base.bounds.max[1]) / 2;
    // (alargar solo los cargadores casi rectos: estirar en vertical uno inclinado o curvo lo deforma en diagonal)
    const magOf = base && base.sockets.magazine ? this.byId.get(parts.find((p) => p.role === "magazine")?.from ?? base.id) ?? base : null;
    const straight = !magOf || magSpread(magOf) < 1.35;
    if (magBelow && type !== "shotgun") ops.push({ id: "mag", run: () => { if (["smg", "rifle", "lmg", "bullpup"].includes(type) && (r() < 0.35 || !straight)) tw.drum = true; else tw.magLen = 1.22 + r() * 0.28; } });
    if (layout !== "kit") { ops.push({ id: "rail", run: () => (tw.rail = [0, 0, 0]) }); ops.push({ id: "device", run: () => (tw.device = { id: "", at: [0, 0] }) }); }
    // Escopetas del kit: linterna o láser (ahora en la ranura de accesorio, en el costado)
    else if (type === "shotgun") ops.push({ id: "device", run: () => (tw.device = { id: "", at: [0, 0] }) });
    // Ranura 4: linterna o láser en el costado del guardamanos (armas largas)
    if (long) ops.push({ id: "light", run: () => (tw.light = { id: "", at: [0, 0], side: true }) });
    const isKitPistol = layout === "kit" && type === "pistol";
    // Cada era admite sus cambios: la clásica no lleva raíles, accesorios tácticos, culatas de tubo ni guardamanos de raíles
    if (era === "classic") for (let i = ops.length - 1; i >= 0; i--) if (["rail", "device", "fold", "light"].includes(ops[i].id)) ops.splice(i, 1);
    // Mínimo 3 cambios en total (piezas cambiadas + cambios de forma), y siempre al menos 2 de forma
    for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; }
    // Con amplitud alta (el arma se parecía demasiado a su base) se aplican todos los cambios posibles
    // (pero se omiten 0-2 al azar: si no, todas las de una base muy reconocible salían con el mismo conjunto)
    const n = amp > 1.2 ? Math.max(3, ops.length - Math.floor(r() * 3)) : Math.min(ops.length, Math.max(2, 3 - swaps) + (r() < 0.5 ? 1 : 0) + (amp > 1 ? 1 : 0));
    // Tope de cambios (06-B): con pocos cambios las armas salen más coherentes; como mucho 5 contando las piezas cambiadas
    for (const op of ops.slice(0, Math.min(n, Math.max(4, 6 - swaps)))) op.run();
    if (era === "classic") {
      // Piezas por código de estilo clásico: culata maciza (madera) y camisa ventilada; nunca raíles
      if (tw.pstock && !["solid", "wood", "folding"].includes(tw.pstock.kind)) tw.pstock = { ...tw.pstock, kind: "wood" };
      if (tw.pfront && tw.pfront.kind !== "tube") tw.pfront = { ...tw.pfront, kind: "tube" };
    }
    // Raíl y accesorio: se colocan sobre la zona delantera ya variada (guardamanos o tramo del cañón)
    if (tw.rail || tw.device || wantBipod || long || tw.light) {
      const wantRail = !!tw.rail, wantDev = !!tw.device, wantLight = !!tw.light; tw.rail = null; tw.device = null; tw.light = null;
      const { byRole } = this.placedParts(layout, parts, tw, bl);
      const zone = byRole.get(layout === "modular-long" ? "front" : isKitPistol ? "receiver" : layout === "kit" ? "barrel" : "body");
      if (zone) {
        const sp = spans([zone]);
        const xs = sp.map((p) => p[0]); const xa = Math.min(...xs), xb = Math.max(...xs);
        const z0 = layout === "modular-long" ? xa : xa + (xb - xa) * (long ? 0.55 : 0.45), z1 = xb;
        const at = (x: number, w = 0.012) => sp.filter((p) => Math.abs(p[0] - x) < w);
        const colH = (x: number) => { const c = at(x); return c.length ? Math.max(...c.map((p) => p[2])) - Math.min(...c.map((p) => p[1])) : 0; };
        const hMax = Math.max(0, ...sp.filter((p) => p[0] >= z0 && p[0] <= z1).map((p) => colH(p[0])));
        const thick = (x: number) => colH(x) >= hMax * 0.55;
        if (wantRail) {
          const x0 = z0 + (z1 - z0) * 0.04, x1 = z0 + (z1 - z0) * (0.45 + r() * 0.2);
          const tops = sp.filter((p) => p[0] >= x0 && p[0] <= x1).map((p) => p[2]);
          if (tops.length && x1 - x0 > 0.03) tw.rail = [x0, x1, Math.max(...tops)];
        }
        if (wantDev) {
          // Bajo el cañón (ranura 3): empuñaduras y similares; las linternas y láseres van a la ranura 4. Las armas cortas
          // no llevan nada bajo el cañón: lo que se les montaba ahí (luz o láser bajo el armazón) es ahora su accesorio
          const devs = long && type !== "shotgun" ? this.kit.options("Device", "any").filter((d) => !isLight(d.id)) : [];
          const maxH = layout === "modular-long" ? 0.09 : long ? 0.06 : 0.06;
          const t0 = 0.3 + r() * 0.25;
          // Solo bajo el tramo grueso del guardamanos (no bajo el cañón fino: el agarre quedaba colgando del cañón o
          // separado del arma), en su cara inferior
          // raíl_inferior del modelo (si el guardamanos es el suyo): su posición relativa a lo largo del guardamanos
          const tRail = railT(base, parts, "raíl_inferior");
          for (const t of [...(tRail !== null ? [tRail] : []), t0, t0 + 0.12, t0 - 0.1, t0 + 0.22, 0.25, 0.15]) {
            const x = z0 + (z1 - z0) * t; const col = at(x);
            if (!col.length || (layout === "modular-long" && !thick(x))) continue;
            const lo = Math.min(...col.map((p) => p[1])), hiY = Math.max(...col.map((p) => p[2]));
            if (hiY - lo > maxH) continue;
            const ownDev = serie(this.kit, base, "agarres");
            if (devs.length) tw.device = { id: ownDev.length && r() < 0.7 ? ownDev[0] : pick(r, devs).id, at: [x, lo] };
            else if (!long) { tw.light = { id: pick(r, this.lightPool()).id, at: [x, lo], side: false }; tw.lightZone = { at: [x, lo], side: false }; }
            break;
          }
        }
        if (long) {
          // Ranura 4 (accesorio): punto de montaje en el costado izquierdo del tramo grueso delantero; la linterna o el
          // láser solo si salió el cambio (el punto queda libre para montar uno en el taller)
          for (const t of [0.62, 0.5, 0.72, 0.4, 0.8]) {
            const x = z0 + (z1 - z0) * t, col = at(x);
            if (!col.length || (layout === "modular-long" && !thick(x))) continue;
            const lo = Math.min(...col.map((p) => p[1])), hiY = Math.max(...col.map((p) => p[2]));
            const zone = { at: [x, (lo + hiY) / 2] as [number, number], side: true };
            tw.lightZone = zone; if (wantLight) tw.light = { id: pick(r, this.lightPool()).id, ...zone };
            break;
          }
        }
        if (wantBipod) {
          // Bípode: hacia la punta del tramo grueso del guardamanos, en su cara inferior
          const own = serie(this.kit, base, "bipodes"), bps = own.length ? own.map((id) => this.kit.byId.get(id)!) : this.kit.options("Bipod", "any");
          const tRail = railT(base, parts, "raíl_inferior");
          for (const t of [...(tRail !== null && tRail > 0.5 ? [tRail] : []), 0.9, 0.8, 0.7, 0.6]) {
            const x = z0 + (z1 - z0) * t, col = at(x);
            if (!col.length || !thick(x) || (tw.device && Math.abs(tw.device.at[0] - x) < 0.08)) continue;
            if (bps.length) tw.bipod = { id: pick(r, bps).id, at: [x, Math.min(...col.map((p) => p[1]))] };
            break;
          }
        }
      }
    }
    if (tw.adds?.length) tw.adds = this.placeAdds(layout, type, parts, tw, bl, [...new Set(tw.adds.map((a) => a.kind))]);
    // Kit del usuario (pack kit39): piezas reales con sus anclas; nada de culatas, guardamanos o añadidos por código
    // (quedaban pegotes); la variedad viene de cambiar piezas entre armas, los largos, el cargador y raíl/accesorio
    if (this.byId.get(parts[0].from)?.pack === "kit39") {
      tw.pstock = null; tw.pfront = null; tw.cutFront = null; tw.cutRear = null; tw.nostock = false;
      tw.adds = tw.adds?.filter((a) => a.kind !== "jacket" && a.kind !== "shield") ?? null; // (sin camisas ni cubrecañones)
    }
    return { tw, barrelLength: bl };
  }

  /**
   * Coloca los añadidos clásicos sobre la silueta ya estirada: el tramo del cañón es la parte delantera fina (desde la
   * boca hacia atrás mientras la sección sea baja); la empuñadura, las columnas más bajas de la mitad trasera. Cada
   * añadido toma su medida del arma (proporcional) y se apoya en un punto lógico (encima o debajo del cañón, bajo la
   * empuñadura, delante del cajón).
   */
  private placeAdds(layout: WeaponSpec["layout"], type: BaseType, parts: PartPick[], tw: Tweaks, bl: number, kinds: Addon["kind"][]): Addon[] | null {
    const save = tw.adds; tw.adds = null;
    const { byRole } = this.placedParts(layout, parts, tw, bl);
    tw.adds = save;
    // Zona de los añadidos: el cuerpo (arma entera), el guardamanos (despiezada) o el cañón (kit)
    const zone = byRole.get(layout === "body" ? "body" : layout === "kit" ? "barrel" : "front");
    if (!zone) return null;
    const bins = new Map<number, { x: number; lo: number; hi: number }>();
    for (const [x, lo, hi] of spans([zone])) {
      const k = Math.round(x / 0.006), b = bins.get(k);
      if (!b) bins.set(k, { x: k * 0.006, lo, hi }); else { b.lo = Math.min(b.lo, lo); b.hi = Math.max(b.hi, hi); }
    }
    const cols = [...bins.values()].sort((a, b) => a.x - b.x);
    if (cols.length < 5) return null;
    const xMin = cols[0].x, xMax = cols[cols.length - 1].x, L = xMax - xMin;
    const Hmax = Math.max(...cols.map((c) => c.hi - c.lo));
    let i = cols.length - 1;
    while (i > 0 && cols[i - 1].hi - cols[i - 1].lo <= Math.max(0.035, Hmax * 0.42) && cols[i - 1].x > xMin + L * 0.25) i--;
    let seg = layout === "body" ? cols.slice(i) : cols;
    if (xMax - seg[0].x < 0.04) seg = cols.filter((c) => c.x >= xMax - L * 0.3);
    const sx0 = seg[0].x, sL = xMax - sx0;
    const top = Math.max(...seg.map((c) => c.hi)), bot = Math.min(...seg.map((c) => c.lo));
    const hs = seg.map((c) => c.hi - c.lo).sort((a, b) => a - b), bh = Math.max(0.008, Math.min(0.03, hs[Math.floor(hs.length / 2)]));
    const out: Addon[] = [];
    // Medidas locales del tramo que ocupa cada añadido (si el contorno no es uniforme ahí, no se pone: flotaría)
    const local = (x0: number, x1: number) => {
      const cs = cols.filter((c) => c.x >= x0 && c.x <= x1); if (cs.length < 2) return null;
      const tops = cs.map((c) => c.hi), bots = cs.map((c) => c.lo);
      return { top: Math.max(...tops), bot: Math.min(...bots), flatTop: Math.max(...tops) - Math.min(...tops) < 0.012, flatBot: Math.max(...bots) - Math.min(...bots) < 0.012 };
    };
    for (const k of kinds) {
      if (k === "rib") { const x0 = sx0 + 0.004, x1 = xMax - 0.003, l = local(x0, x1); if (l?.flatTop) out.push({ kind: k, x0, x1, y: l.top - 0.001, h: 0.006 }); }
      else if (k === "lug") { const h = Math.min(0.02, Math.max(0.009, bh * 0.6)), x0 = type === "revolver" ? sx0 + 0.003 : xMax - sL * 0.55, x1 = xMax - 0.004, l = local(x0, x1); if (l?.flatBot) out.push({ kind: k, x0, x1, y: l.bot - h + 0.002, h }); }
      else if (k === "shield") { const h = Math.min(0.02, Math.max(0.01, bh * 0.75)), x0 = sx0 + sL * 0.12, x1 = sx0 + sL * 0.7, l = local(x0, x1); if (l?.flatTop) out.push({ kind: k, x0, x1, y: l.top - h * 0.55, h }); }
      else if (k === "bipod") { const x0 = sx0 + sL * 0.25, x1 = sx0 + sL * 0.8, l = local(x0, x1); if (l) out.push({ kind: k, x0, x1, y: l.bot - 0.013, h: 0.012 }); }
      else if (k === "jacket") {
        out.push({ kind: k, x0: sx0 + sL * 0.05, x1: xMax - sL * 0.08, y: bot - bh * 0.35, h: top - bot + bh * 0.7 });
      } else if (k === "handle" || k === "cheek") {
        // Asa sobre el centro del cajón; carrillera sobre la culata
        const role = k === "handle" ? (layout === "body" ? "body" : "receiver") : "stock";
        const pz = byRole.get(role); if (!pz) continue;
        const sp = spans([pz]); const xs = sp.map((p) => p[0]); const a = Math.min(...xs), b = Math.max(...xs), l = b - a;
        const x0 = k === "handle" ? (layout === "body" ? a + l * 0.32 : a + l * 0.25) : a + l * 0.35, x1 = k === "handle" ? (layout === "body" ? a + l * 0.5 : a + l * 0.7) : b - l * 0.12;
        const tops = sp.filter((p) => p[0] >= x0 && p[0] <= x1).map((p) => p[2]); if (!tops.length) continue;
        const H = Math.max(...cols.map((c) => c.hi)) - Math.min(...cols.map((c) => c.lo));
        if (k === "handle") {
          // Asa apoyada de verdad: las patas bajan hasta el cajón bajo cada una (antes salían del punto más alto del
          // tramo y quedaban flotando) y es baja, para no tapar la vista. Si el cajón es muy irregular ahí, no se pone.
          const near = (x: number) => { const c = sp.filter((p) => Math.abs(p[0] - x) < 0.012).map((p) => p[2]); return c.length ? Math.max(...c) : null; };
          const t0 = near(x0), t1 = near(x1), hi = Math.max(...tops);
          if (t0 == null || t1 == null || hi - Math.min(t0, t1) > 0.02) continue;
          const lo = Math.min(t0, t1) - 0.002;
          out.push({ kind: k, x0, x1, y: lo, h: hi - lo + Math.min(0.026, Math.max(0.018, H * 0.16)) });
        } else out.push({ kind: k, x0, x1, y: Math.max(...tops) - 0.002, h: 0.02 });
      } else if (k === "ladder") {
        const x0 = sx0 - 0.07, c = cols.filter((cc) => Math.abs(cc.x - x0) < 0.012);
        if (c.length) out.push({ kind: k, x0, x1: x0 + 0.034, y: Math.max(...c.map((cc) => cc.hi)) - 0.002, h: 0.028 });
      }
    }
    const ok = out.filter((a) => a.x1 - a.x0 > 0.012);
    return ok.length ? ok : null;
  }

  /**
   * Añadidos de era: sci-fi (cubierta angulosa, celda de energía, pantalla), rústica (cinta, parche de chapa) y kits de
   * modernización (1-3 piezas sci-fi sobre una base no sci-fi, siempre con adaptadores visibles).
   */
  private eraAddons(r: Rng, era: Era, modLevel: number, type: BaseType, layout: WeaponSpec["layout"], parts: PartPick[], tw: Tweaks, bl: number): Tweaks["eraAdds"] {
    const { byRole } = this.placedParts(layout, parts, tw, bl);
    const base = this.byId.get(parts[0].from);
    const kitPlat = this.kit.byId.get(parts[0].from);
    const thick = base ? Math.min(0.05, (base.bounds.max[2] - base.bounds.min[2]) * 0.75) : 0.03;
    const spanOf = (role: string) => { const p = byRole.get(role); return p ? spans([p]) : []; };
    const recv = spanOf(layout === "body" ? "body" : "receiver");
    const front = layout === "body" ? recv.filter((p) => { const xs = recv.map((q) => q[0]); const a = Math.min(...xs), b = Math.max(...xs); return p[0] > a + (b - a) * 0.58 && p[0] < b - (b - a) * 0.05; }) : spanOf("front");
    const stock = spanOf("stock");
    const out: NonNullable<Tweaks["eraAdds"]> = { adapters: [], tapes: [], patches: [] };
    let any = false;
    const sect = (sp: [number, number, number][], t0: number, t1: number) => {
      if (!sp.length) return null;
      const xs = sp.map((p) => p[0]); const a = Math.min(...xs), b = Math.max(...xs);
      const x0 = a + (b - a) * t0, x1 = a + (b - a) * t1, sel = sp.filter((p) => p[0] >= x0 && p[0] <= x1);
      if (!sel.length) return null;
      const lo = Math.min(...sel.map((p) => p[1])), hi = Math.max(...sel.map((p) => p[2]));
      return { x0, x1, y: (lo + hi) / 2, h: hi - lo };
    };
    const mag = base?.sockets.magazine ? { x: base.sockets.magazine.pos[0], y: base.sockets.magazine.pos[1], h: Math.min(0.12, base.sockets.magazine.size?.[1] ?? 0.1) } : kitPlat?.sockets.Magazine?.[0] ? { x: kitPlat.sockets.Magazine[0][0], y: kitPlat.sockets.Magazine[0][1], h: 0.09 } : null;
    const magBelow = !!mag && !!base && mag.y < (base.bounds.min[1] + base.bounds.max[1]) / 2 || !!kitPlat;
    const long = type !== "pistol" && type !== "revolver";
    // La cubierta solo envuelve un tramo regular (sin alza, punto de mira ni escalones): si el canto superior o el
    // inferior varían mucho en el tramo, quedaba como una caja suelta encima del arma
    const regular = (sp: [number, number, number][], t0: number, t1: number) => {
      const xs = sp.map((p) => p[0]); const a = Math.min(...xs), b = Math.max(...xs);
      const sel = sp.filter((p) => p[0] >= a + (b - a) * t0 && p[0] <= a + (b - a) * t1);
      if (!sel.length) return false;
      const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
      return spread(sel.map((p) => p[2])) < 0.018 && spread(sel.map((p) => p[1])) < 0.025;
    };
    const addCover = () => { const s = sect(front, 0.12, 0.7); if (s && s.h < (type === "rifle" ? 0.07 : 0.055) && s.x1 - s.x0 > 0.05 && regular(front, 0.12, 0.7)) { out.cover = [s.x0, s.x1, s.y, s.h * 1.12, thick * 1.2]; out.adapters!.push([s.x0 - 0.008, s.y, thick]); any = true; } }; // (adaptador solo detrás: el delantero quedaba colgando)
    const addCell = () => { if (mag && magBelow && !tw.drum && long) { out.cell = [mag.x, mag.y, mag.h * 0.85, Math.min(0.04, thick)]; any = true; } };
    const addDisplay = () => { const s = sect(recv, 0.45, 0.6); if (s) { out.display = [s.x0, s.y + s.h * 0.15, thick * 0.55 + 0.003]; any = true; } };
    if (era === "scifi") { if (r() < 0.7) addCover(); if (r() < 0.4) addCell(); if (r() < 0.6) addDisplay(); }
    if (modLevel > 0) {
      const pool = [addCover, addCell, addDisplay];
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      for (const f of pool.slice(0, modLevel)) f();
    }
    if (era === "rustic") {
      // Cinta en la culata y/o el guardamanos; parche de chapa en el cajón
      for (const [sp, p] of [[stock, 0.7], [front, 0.6]] as const) {
        if (r() > p) continue;
        if (sp === stock && tw.pstock && tw.pstock.kind !== "solid") continue; // no se venda un tubo fino
        const s = sect(sp, 0.3, 0.55); if (s && s.h < 0.1) { out.tapes!.push([s.x0, s.y, s.x1 - s.x0, s.h, thick]); any = true; }
      }
      if (r() < 0.5) { const s = sect(recv, 0.3, 0.42); if (s) { out.patches!.push([s.x0 + 0.02, s.y, thick * 0.55 + 0.002]); any = true; } }
    }
    return any ? out : null;
  }

  /** Recalcula estadísticas (tras generar o tras cambiar piezas en el banco). */
  /** Linternas y láseres posibles (del kit y por código). */
  lightPool(): { id: string }[] { return [...this.kit.options("Device", "any").filter((d) => isLight(d.id)), ...PROC_LIGHTS]; }
  refresh(spec: WeaponSpec): WeaponSpec {
    // Partidas antiguas: la linterna o el láser montados bajo el raíl pasan a la ranura de accesorio
    const tw = spec.tweaks;
    if (tw?.device && isLight(tw.device.id)) { tw.light = { id: tw.device.id, at: tw.device.at, side: false }; tw.lightZone = { at: tw.device.at, side: false }; tw.device = null; }
    if (spec.layout === "kit") { const i = spec.parts.findIndex((p) => p.role === "device" && isLight(p.from)); if (i >= 0) { spec.parts.splice(i, 1); } }
    this.ensureDesign(spec);
    ensureGrip(spec); // el agarre sigue a las piezas y accesorios (taller incluido)
    spec.stats = computeStats(spec);
    if (spec.rarity.id !== "legendaria") spec.name = technicalName(spec);
    return spec;
  }
}

/** Culata por código a medida del tipo de arma y de la junta. */
/** Culata de pistola o revólver: modernas en la trasera del armazón; clásicas y rústicas en el talón de la empuñadura. */
function pistolStock(r: Rng, d: PistolDesign): import("./procparts").ProcStock {
  const heel = d.era === "classic" || d.era === "rustic" || d.family === "frontmag" || d.family === "revolver";
  // Solo culatas macizas: las de varilla (tubo, esqueleto, plegable) quedaban finas y mal unidas en un arma corta
  const kinds: StockKind[] = d.era === "classic" ? ["wood"] : d.era === "rustic" ? ["wood", "polymer"] : ["polymer", "carbine"];
  const kind = kinds[Math.floor(r() * kinds.length)];
  const len = (d.family === "carbine" ? 0.17 : 0.14) + r() * 0.045;
  if (heel) { const g = gripCorners(d); return { kind, at: [g.BB[0] + 0.004, g.BB[1] + 0.022], h: 0.034, w: 0.022, len, drop: -(0.03 + r() * 0.02) }; }
  return { kind, at: [0.004, -d.frame.h * 0.45], h: 0.032, w: 0.022, len, drop: 0.012 + r() * 0.018 };
}
function procStock(r: Rng, type: BaseType, at: [number, number], h: number, w: number) {
  const kinds: StockKind[] = type === "sniper" || type === "lmg" ? ["solid", "skeleton"] : type === "smg" ? ["tube", "skeleton", "solid"] : ["skeleton", "solid", "tube"];
  const len = ({ smg: [0.17, 0.25], rifle: [0.22, 0.3], shotgun: [0.26, 0.33], sniper: [0.28, 0.35], lmg: [0.24, 0.3], bullpup: [0.06, 0.1] } as Record<string, [number, number]>)[type] ?? [0.22, 0.3];
  const hh = Math.min(0.075, Math.max(0.032, h));
  return { kind: kinds[Math.floor(r() * kinds.length)], at, h: hh, w: Math.min(0.045, Math.max(0.022, w)), len: len[0] + r() * (len[1] - len[0]), drop: hh * (0.3 + r() * 0.6) };
}
/** Guardamanos por código con cañón que sobresale. */
function procFront(r: Rng, type: BaseType, at: [number, number], h: number, w: number) {
  const kinds: FrontKind[] = ["quad", "tube", "slot"];
  const len = ({ smg: [0.09, 0.16], rifle: [0.2, 0.32], shotgun: [0.22, 0.34], lmg: [0.24, 0.34], sniper: [0.26, 0.38], bullpup: [0.12, 0.2] } as Record<string, [number, number]>)[type] ?? [0.2, 0.3];
  const hh = Math.min(0.065, Math.max(0.028, h * 0.95));
  return { kind: kinds[Math.floor(r() * kinds.length)], at, h: hh, w: Math.min(0.05, Math.max(0.024, w)), len: len[0] + r() * (len[1] - len[0]), barrel: (type === "smg" ? 0.03 : 0.05) + r() * 0.1, d: type === "shotgun" ? 0.022 : Math.min(0.02, Math.max(0.012, hh * 0.3)) };
}

/** Cajas en la silueta de los añadidos de era que cambian el perfil. */
function addEraBoxes(boxes: Box2[], a: Tweaks["eraAdds"]) {
  if (!a) return;
  if (a.cover) boxes.push({ x0: a.cover[0], x1: a.cover[1], y0: a.cover[2] - a.cover[3] / 2, y1: a.cover[2] + a.cover[3] / 2 });
  if (a.cell) boxes.push({ x0: a.cell[0] - 0.022, x1: a.cell[0] + 0.026, y0: a.cell[1] - a.cell[2], y1: a.cell[1] });
}
/** Cambios de era para la etiqueta de depuración. */
function eraChanges(a: Tweaks["eraAdds"]): string[] {
  if (!a) return [];
  const c: string[] = [];
  if (a.cover) c.push("cover"); if (a.cell) c.push("poly-mag"); if (a.display) c.push("side-rail");
  if (a.tapes?.length) c.push("tape"); if (a.patches?.length) c.push("patch");
  return c;
}

/** Lista legible de los cambios de un arma respecto a su base (piezas cambiadas y cambios de forma). */
export function changesOf(layout: WeaponSpec["layout"], t: Tweaks, barrelLength: number, swaps: PartPick[]): string[] {
  const c = swaps.map((p) => `swap:${p.role}`);
  const far = (f: number | undefined, th = 0.08) => f !== undefined && Math.abs(f - 1) >= th;
  if (layout === "modular-long") {
    if (far(t.front)) c.push("front-len");
    if (!t.nostock && !t.pstock && far(t.stock)) c.push("stock-len");
    if (!t.nostock && far(t.stockH, 0.06)) c.push("stock-height");
    if (far(t.grip, 0.05) || Math.abs(t.gripAngle) > 0.04) c.push("grip");
  }
  if (layout === "body" && far(t.body)) c.push("barrel-len");
  if (layout === "body" && far(t.stock) && !t.pstock) c.push("stock-len");
  if (layout === "kit") { if (far(barrelLength, 0.06) || far(t.front, 0.06)) c.push("barrel-len"); if (!t.nostock && t.stock !== undefined && far(t.stock, 0.06)) c.push("stock-len"); }
  if (t.rail) c.push("rail");
  if (t.drum) c.push("drum");
  if ((t.magLen ?? 1) > 1.05) c.push("mag-ext");
  if (t.nostock && !t.pstock) c.push("no-stock");
  if (t.fold && !t.nostock && !t.pstock) c.push("stock-fold");
  if (t.pstock) c.push(`stock-${t.pstock.kind}`);
  if (t.pfront) c.push(`front-${t.pfront.kind}`);
  if (t.device) c.push("device");
  for (const a of t.adds ?? []) if (!c.includes(a.kind)) c.push(a.kind);
  return c;
}

/** Zona del cuerpo de un arma entera que se estira: el tramo delantero (cañón), sin tocar la boca. */
export const bodyZone = (prof: { x0: number; x1: number }, f: number) => midZone(prof.x0, prof.x1, f, 0.58, 0.08);
/** Zonas de un arma entera: cañón (delante) y culata (detrás, con la cantonera intacta; solo armas largas). */
export const bodyZones = (prof: { x0: number; x1: number }, t: Tweaks): Stretch[] => {
  const out = [bodyZone(prof, t.body ?? 1)];
  const L = prof.x1 - prof.x0;
  if ((t.stock ?? 1) !== 1) out.push(midZone(prof.x0, prof.x0 + L * 0.34, t.stock, 0.12, 0.25, true));
  return out;
};
/** Cargador de tambor en el pozo del cargador: centro y radio. */
export function drumOf(base: AssetEntry) {
  const m = base.sockets.magazine!; const h = m.size?.[1] ?? 0.1;
  const R = Math.min(0.07, Math.max(0.045, h * 0.42));
  return { x: m.pos[0], y: m.pos[1] - R - 0.006, R, w: Math.min(0.05, Math.max(0.035, (base.bounds.max[2] - base.bounds.min[2]) * 0.8)) };
}

/** Longitud de referencia de cada tipo (m), la misma que usa el conversor. */
/**
 * Escala propia de algunos modelos: el conversor lleva todos los de un tipo al mismo largo (subfusil 0,5 m), y los
 * compactos (MP5K, MP7…) quedaban casi el doble de grandes que los reales. Se aplica al arma montada entera.
 */
export const BASE_SIZE: Record<string, number> = {
  "w-mp5k": 0.62, "m-mp7": 0.72, "z-submachinegun-01": 0.65, "z-submachinegun-05": 0.8,
  "p-submachine-gun-3": 0.82, "p-submachine-gun-4": 0.82,
};
/** Añadidos de era permitidos en el kit del usuario: solo los que no cambian la forma (cinta, parches). */
function kit39Era(a: Tweaks["eraAdds"]): Tweaks["eraAdds"] { return a ? { ...a, cover: undefined, cell: undefined, display: undefined, adapters: [] } : a; }
/** Cuerpos con la culata integrada (no se estira el tramo trasero). */
const INTEGRAL_STOCK = new Set(["w-p90", "z-submachinegun-03", "u-bullpup-b"]);
/** Bases retiradas del sorteo (se siguen pudiendo cargar en partidas guardadas), con el motivo. */
/** Era de estilo de un modelo (la del pack del usuario o la de su prefijo): las piezas solo se cambian dentro de pack + era. */
const eraOfEntry = (w: AssetEntry) => w.era ?? baseEra(w.id);
const sameEra = (a: AssetEntry, b: AssetEntry) => eraOfEntry(a) === eraOfEntry(b);
/**
 * Criba del usuario: ya no salen como arma completa, pero sus piezas (culatas, guardamanos, empuñaduras, cargadores,
 * tambores…) siguen en la biblioteca para otras armas de su familia. Se pueden leer en partidas guardadas.
 */
const WHOLE_OUT = new Set<string>([
  "q-pistol-2", "q-pistol-5", "q-revolver-2", "q-submachinegun-5", "q-assaultrifle-3", "q-assaultrifle-4", "q-assaultrifle2-2", "q-shotgun-3", "q-sniperrifle-2", "q-sniperrifle-5",
  "a-launcher",
  "w-barrett", "w-m249", "w-ppsh", "w-m1911", "w-m16a4", "w-g36", "w-ak47", "w-mp5k", "w-vector", "w-deagle",
  "v-boltaction-rifles-a-medium", "v-boltaction-rifles-a-short", "v-boltaction-rifles-b-medium", "v-boltaction-rifles-b-short", "v-lever-rifles-medium", "v-lever-rifles-short",
  "v-revolver-rifles-medium", "v-revolver-rifles-short", "v-carabine-shotgun-short", "v-pump-shotgun-short", "v-semiautomati-schotgun", "v-hunter-shotgun-sawoff",
  "v-m3gg-drum", "v-ppsh-drum", "v-msr-c96-medium", "v-msr-c96-short", "v-revolver-a-medium", "v-revolver-a-short", "v-revolver-b-medium", "v-revolver-b-short",
  "z-assaultrifle-01", "z-assaultrifle-02", "z-submachinegun-01", "z-submachinegun-02", "z-submachinegun-03", "z-sniperrifle-02",
  "p-machine-gun-4", "p-submachine-gun-2", "p-submachine-gun-5",
  "x-pistol-3",
]);
const RETIRED = new Set<string>([
  "p-machine-gun-2", // como fusil quedaba un cajón de ametralladora tosco con culata de caja
  "u-fusil-a", "u-bullpup-b", // ARX y TAR-21 antiguos: sustituidos por las versiones limpias del kit (x-arx-160, x-tar-21)
  "x-subfusil-10", // subfusil del kit de bloques: con cualquier pieza quedaba deforme (decisión del usuario, "Hound")
  "z-submachinegun-03", "p-submachine-gun-1", // P90 que venían del revés: fuera del todo, también sus piezas (decisión del usuario)
  "w-f2000", // demasiado parecidas entre sí (decisión del usuario); los bullpups por código y u-bullpup-b cubren el tipo
]);
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
  // El largo de culata y guardamanos no se escala aquí: se estira por zonas (variation.ts) para no deformar detalles
  const hk = role === "stock" ? tw.stockH ?? 1 : 1;
  if (donor.id === recv.id) return role === "grip" ? [tw.grip, tw.grip, 1] : [1, hk, 1];
  const k = jointScale(recv, donor, role === "stock" ? "rear" : role);
  const thick = (recv.bounds.max[2] - recv.bounds.min[2]) / Math.max(1e-4, donor.bounds.max[2] - donor.bounds.min[2]);
  const sz = THREE_clamp(thick, 0.75, 1.35);
  const mild = THREE_clamp(k, 0.88, 1.14);
  return role === "grip" ? [k * tw.grip, mild * tw.grip, sz] : [mild, k * hk, sz];
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

/** Culatas de caja muy altas (de francotirador): solo en francotiradores. */
const STOCK_TALL = new Set(["x-sniper-0"]);
export function longGunOk(recv: AssetEntry, stock: AssetEntry, front: AssetEntry, grip: AssetEntry, type: WeaponType, tw: Tweaks = NO_TWEAKS): boolean {
  if (!recv.joints || !stock.joints || !front.joints || !grip.joints) return false;
  const own = (x: AssetEntry) => x.id === recv.id;
  const kS = own(stock) ? 1 : jointScale(recv, stock, "rear"), kF = own(front) ? 1 : jointScale(recv, front, "front"), kG = own(grip) ? 1 : jointScale(recv, grip, "grip");
  // La sección se adapta (solo en un eje), así que se admite más diferencia; aun así nada desproporcionado
  if (!within(kS, 0.7, 1.4) || !within(kF, 0.7, 1.4) || !within(kG, 0.72, 1.35)) return false;
  // Puerta de forma: cada pieza ajena, ya escalada y colocada en su junta, debe quedar dentro de la silueta de la
  // pieza original del cajón (con margen). Evita guardamanos a la altura de la mira, empuñaduras enormes o culatas
  // desproporcionadas.
  // Una culata o un guardamanos por código sustituye a la pieza del modelo: se mide la pieza por código, no la sustituida
  const pS = tw.pstock ?? null, pF = tw.pfront ?? null;
  if (tw.nostock) return (pF ? true : shapeOk(recv, front, "front", tw)) && shapeOk(recv, grip, "grip", tw);
  if ((!pS && !shapeOk(recv, stock, "stock", tw)) || (!pF && !shapeOk(recv, front, "front", tw)) || !shapeOk(recv, grip, "grip", tw)) return false;
  // Culata ajena mucho más alta que el cajón (p. ej. la culata de caja de un francotirador en un fusil compacto): en
  // primera persona era un bloque que tapaba media pantalla
  if (!pS && !own(stock) && STOCK_TALL.has(stock.id) && type !== "sniper") return false;
  const J = recv.joints;
  const stockLen = pS ? pS.len : zoneLen((stock.joints.stockFace.pos[0] - stock.bounds.min[0]) * pieceScale(recv, stock, "stock", tw)[0], tw.stock);
  const frontLen = pF ? pF.len + pF.barrel : zoneLen((front.bounds.max[0] - front.joints.frontFace.pos[0]) * pieceScale(recv, front, "front", tw)[0], tw.front, 0.6);
  const len = (J.front.pos[0] - J.rear.pos[0]) + stockLen + frontLen;
  const target = TYPE_LENGTH[type] ?? 0.9;
  // Longitud total del tipo y proporciones: ni culatas enanas ni guardamanos desmesurados
  return within(len / target, 0.85, 1.18) && within(stockLen / len, 0.14, 0.42) && within(frontLen / len, 0.18, 0.55);
}

/** Variaciones leves de las piezas (deterministas por semilla). */
function rollTweaks(r: Rng): Tweaks {
  // (más amplitud de largo en culata y guardamanos: las armas despiezadas se quedaban demasiado cerca de su base)
  return { stock: 0.8 + r() * 0.42, front: 0.78 + r() * 0.47, grip: 0.92 + r() * 0.18, gripAngle: -0.1 + r() * 0.18, body: 1 };
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
  // Calibre del revólver generado (ajuste fino sobre su variante)
  const calFx = spec.tweaks?.pistol?.cyl ? CAL_EFFECT[spec.tweaks.pistol.cyl.cal] : null;
  if (calFx) { const m = calFx.mods; s.dano *= m.dano ?? 1; s.cadencia *= m.cadencia ?? 1; s.cargador *= m.cargador ?? 1; s.manejo += m.manejo ?? 0; }
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
  // Opciones del armero: tambor y cargador alargado (más balas, más peso), sin culata (más manejable, menos estable)
  if (tw.drum) { s.cargador *= 2; s.manejo -= 8; }
  else if (tw.magLen && tw.magLen > 1) { s.cargador *= 1 + (tw.magLen - 1) * 1.6; s.manejo -= (tw.magLen - 1) * 12; }
  if (tw.nostock) { s.manejo += 14; s.precision -= 12; }
  if (spec.layout === "body") { s.alcance *= 1 + ((tw.body ?? 1) - 1) * 0.6; s.precision += ((tw.body ?? 1) - 1) * 10; s.manejo -= ((tw.body ?? 1) - 1) * 12; }
  const L = spec.barrelLength;
  if (spec.layout === "kit") { s.alcance *= 1 + (L - 1) * 0.7; s.precision += (L - 1) * 10; s.manejo -= (L - 1) * 12; }
  if (spec.layout === "modular-pistol") { s.alcance *= 1 + (L - 1) * 0.9; s.precision += (L - 1) * 14; s.manejo -= (L - 1) * 16; }
  // Habilidades que cambian números (y penalizaciones de los elementos)
  const ev = (id: string) => spec.effects.find((e) => e.id === id)?.value ?? 0;
  if (ev("extmag")) s.cargador *= 1 + ev("extmag") / 100;
  if (ev("range")) s.alcance *= 1 + ev("range") / 100;
  if (spec.effects.some((e) => e.id === "quickdraw")) s.manejo += 10;
  if (spec.effects.some((e) => e.id === "doble")) s.dano *= 0.62;
  // Penalizaciones de diseño de los elementos (cualquier efecto de ese elemento) y ritmo ágil
  if (spec.effects.some((e) => e.element === "electrico")) s.dano *= 0.9;   // menos daño directo
  if (spec.effects.some((e) => e.element === "explosive")) s.dano *= 0.85;  // menos daño directo
  if (spec.effects.some((e) => e.id === "rapid")) s.cadencia *= 1.08;
  // Recetas (05-C): bonus pasivos y contrapartidas (multiplicativos). Suelos: el cargador nunca baja de 1 bala (se
  // redondea al final), precisión y cadencia con tope de pérdida. El presupuesto de rareza no reparte a lo recortado.
  const rm = recipeStatMods(spec.effects);
  s.cargador *= rm.cargador; s.alcance *= rm.alcance; s.cadencia *= rm.cadencia; s.precision = Math.max(5, s.precision + rm.precision);
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
  // Lo que recorta una contrapartida no lo devuelve la rareza: su parte del presupuesto pasa a las demás (o al daño)
  const blocked = recipeStatMods(spec.effects).blocked;
  let shares = (Object.entries(spec.bonus ?? {}) as [StatKey, number][]).filter(([k]) => !blocked.has(k));
  if (!shares.length && Object.keys(spec.bonus ?? {}).length) shares = [["dano", 1]];
  const sum = shares.reduce((a, [, v]) => a + v, 0) || 1; shares = shares.map(([k, v]) => [k, v / sum]);
  for (const [k, share] of shares) {
    const want = budget * share * total;
    const contrib = POWER_WEIGHTS[k] * (s[k] / base[k]);
    let next = s[k] * (1 + want / Math.max(1e-6, contrib));
    if ((k === "precision" || k === "manejo") && next > 100) { leftover += (POWER_WEIGHTS[k] * (next - 100)) / base[k]; next = 100; }
    s[k] = next;
  }
  if (leftover > 0) s.dano *= 1 + leftover / (POWER_WEIGHTS.dano * (s.dano / base.dano));
}

/** Palabras para los nombres de modelo, una lista propia por tipo (ningún nombre se repite entre tipos). */
const NAME_WORDS: Record<string, string[]> = {
  pistol: ["Hornet", "Ferret", "Magpie", "Sparrow", "Wasp", "Stinger", "Kestrel", "Needle", "Ratchet", "Weasel", "Finch", "Pipit"],
  revolver: ["Gravedigger", "Rattler", "Sidewinder", "Gunsmoke", "Outlaw", "Deadeye", "Tombstone", "Drover", "Sheriff", "Mesquite", "Bushwhack", "Sundown"],
  smg: ["Mongrel", "Hellcat", "Hound", "Jackal", "Ripsaw", "Buzzer", "Gnat", "Chatter", "Skitter", "Weevil", "Locust", "Mite"],
  rifle: ["Marauder", "Warden", "Nomad", "Outrider", "Patriot", "Ironside", "Vanguard", "Ranger", "Sentry", "Halberd", "Trooper", "Partisan"],
  bullpup: ["Lynx", "Scorpion", "Viper", "Wraith", "Mantis", "Cobra", "Shrike", "Adder", "Krait", "Gecko", "Asp", "Basilisk"],
  shotgun: ["Bulldog", "Grizzly", "Junker", "Scrapper", "Brigand", "Mule", "Boar", "Bruiser", "Thresher", "Rustback", "Hogleg", "Ironjaw"],
  sniper: ["Raven", "Vulture", "Harrier", "Longshot", "Kite", "Condor", "Osprey", "Heron", "Spindle", "Farsight", "Lark", "Albatross"],
  lmg: ["Longhorn", "Bastion", "Rhino", "Juggernaut", "Mastodon", "Behemoth", "Bison", "Ox", "Rampart", "Sawtooth", "Thunderhide", "Bulwark"],
  launcher: ["Ember", "Tinker", "Hammerhead", "Bandit", "Pike", "Dustrunner"],
  flamethrower: ["Coyote", "Badger", "Wolverine", "Prowler", "Tumbleweed", "Drifter"],
};

/**
 * Designación de las armas no legendarias. Varios estilos (código de serie, nombre de modelo, modelo con número…)
 * elegidos de forma estable según las piezas, así dos armas parecidas rara vez se llaman igual.
 */
export function technicalName(spec: WeaponSpec): string {
  const info = TYPE_INFO[spec.type as BaseType];
  const body = spec.parts[0].from;
  const h = hashString(spec.parts.map((p) => p.from).join("|") + spec.archetype + spec.statSeed);
  const series = info.letter + "KRVMCLDTX"[hashString(body + spec.archetype) % 9];
  const cyl = spec.tweaks?.pistol?.cyl;
  const cal = cyl ? CAL_EFFECT[cyl.cal].label : info.calibers[hashString(spec.parts[1]?.from ?? body) % info.calibers.length];
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
  const pool = NAME_WORDS[spec.type] ?? NAME_WORDS.rifle;
  const word = pool[Math.floor(q() * pool.length)];
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
