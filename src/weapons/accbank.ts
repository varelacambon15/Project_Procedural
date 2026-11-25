// Accesorios desmontables (solo accesorios, nunca piezas estructurales): mira, dispositivo de boca y accesorio bajo
// el raíl (láser, linterna, empuñadura). Lógica pura sobre la descripción del arma (WeaponSpec): desmontar, comprobar
// si encaja (con el motivo si no) y montar, sin salir nunca de la banda de poder de la rareza del arma.
// El aspecto (punto lógico de montaje, color y escala de la nueva base) lo resuelve el ensamblador al construir.
import { computeStats, powerScore, type WeaponGenerator } from "./generator";
import { accessory } from "./accessories";
import { fits, swap, type PartItem } from "./workshop";
import type { RarityId, WeaponSpec } from "./types";
import { isLight } from "./lights";

/** Zonas: 1 mira, 2 boca, 3 bajo el cañón (empuñaduras, bípodes…), 4 accesorio (linternas y láseres). */
export type AccKind = "optic" | "muzzle" | "device" | "light";
export const ACC_KINDS: AccKind[] = ["optic", "muzzle", "device", "light"];
/** Accesorio del banco: su identificador de pieza y la rareza del arma de la que salió. */
export interface AccItem { uid: number; kind: AccKind; id: string; rarity: RarityId }

let nextUid = 1;
export const newAcc = (kind: AccKind, id: string, rarity: RarityId): AccItem => ({ uid: nextUid++, kind, id, rarity });
export const setAccUid = (n: number) => { nextUid = Math.max(nextUid, n); };

/** Margen de la banda de poder (el mismo ±5% que comprueban los tests del generador). */
export const BAND = 0.05;
const flatPower = (w: WeaponSpec) => powerScore(computeStats({ ...w, rarity: { ...w.rarity, budget: 0 } }), w.type);
/** Fija la referencia de la banda (poder sin rareza del arma tal como es ahora) si aún no la tiene. */
export function ensureBandRef(_gen: WeaponGenerator, w: WeaponSpec) { if (w.bandRef == null) w.bandRef = flatPower(w); return w.bandRef; }
/** Relación de poder del arma respecto a su referencia (1 + presupuesto de su rareza, ±5%). */
export function bandRatio(gen: WeaponGenerator, w: WeaponSpec) { return powerScore(w.stats, w.type) / ensureBandRef(gen, w); }
export function inBand(gen: WeaponGenerator, w: WeaponSpec) {
  const r = bandRatio(gen, w), target = 1 + w.rarity.budget;
  return r <= target + BAND + 1e-9 && r >= target - BAND - 1e-9;
}

/** Accesorio montado ahora en una zona (null si está vacía). Las miras integradas en el cuerpo no cuentan. */
export function mountedAcc(w: WeaponSpec, kind: AccKind): string | null {
  if (kind === "optic") return w.optic && w.optic !== w.parts[0].from ? w.optic : null;
  if (kind === "muzzle") return w.muzzle;
  if (kind === "light") return w.tweaks.light?.id || null;
  if (w.layout === "kit") return w.parts.find((p) => p.role === "device")?.from ?? null;
  return w.tweaks.device?.id || null;
}

/** Zonas de accesorio que tiene el arma (aunque estén vacías). */
export function accZones(gen: WeaponGenerator, w: WeaponSpec): AccKind[] {
  const out: AccKind[] = [];
  const integrated = !!w.optic && w.optic === w.parts[0].from;
  if (!integrated && (gen.opticOptions(w).length || w.optic)) out.push("optic");
  if (gen.muzzleOptions(w).length || w.muzzle) out.push("muzzle");
  if (deviceHost(gen, w)) out.push("device");
  if (w.tweaks.light || w.tweaks.lightZone) out.push("light");
  return out;
}
function deviceHost(gen: WeaponGenerator, w: WeaponSpec) {
  // (las armas cortas ya no tienen bajo el cañón: lo que llevaban ahí era su linterna o láser, ahora en la ranura 4)
  if (w.type === "pistol" || w.type === "revolver") return false;
  if (w.layout === "kit") return w.parts.some((p) => gen.kit.byId.get(p.from)?.sockets.Device);
  return !!(w.tweaks.device?.id || w.tweaks.deviceZone);
}

export interface Fit { ok: boolean; reason?: string; params?: Record<string, string | number> }

/** ¿Se puede montar este accesorio? Si no, el motivo (clave de i18n) para avisar con claridad. */
export function canMount(gen: WeaponGenerator, w: WeaponSpec, a: Pick<AccItem, "kind" | "id">): Fit {
  if (!accZones(gen, w).includes(a.kind)) {
    if (a.kind === "optic" && w.optic === w.parts[0].from) return { ok: false, reason: "acc.noIntegrated" };
    return { ok: false, reason: `acc.noZone.${a.kind}` };
  }
  if (mountedAcc(w, a.kind) === a.id) return { ok: false, reason: "acc.same" };
  if (!fitsZone(gen, w, a)) {
    const def = accessory(a.id);
    if (a.kind === "optic" && def?.for && !def.for.includes(w.type)) return { ok: false, reason: "acc.wrongType" };
    if (a.kind === "muzzle" && (w.type === "pistol" || w.type === "revolver") && a.id.startsWith("k-att-")) return { ok: false, reason: "acc.wrongType" };
    if (a.id.startsWith("k-") && !a.id.startsWith("k-att-") && a.kind !== "device") return { ok: false, reason: "acc.caliber" };
    if (a.kind === "device" && /foregrip/.test(a.id)) return { ok: false, reason: "acc.noForegrip" };
    return { ok: false, reason: "acc.noFit" };
  }
  // Banda de poder: se prueba sobre una copia
  const trial = structuredClone(w); ensureBandRef(gen, trial); w.bandRef = trial.bandRef;
  mountRaw(gen, trial, a);
  if (!inBand(gen, trial)) return { ok: false, reason: "acc.band" };
  return { ok: true };
}

function fitsZone(gen: WeaponGenerator, w: WeaponSpec, a: Pick<AccItem, "kind" | "id">) {
  // Mira y boca: las mismas listas que usa el generador (accesorios propios, del kit y reales del pack de accesorios)
  if (a.kind === "optic") return gen.opticOptions(w).includes(a.id) || fits(gen, w, "scope", { uid: 0, role: "scope", from: a.id });
  if (a.kind === "muzzle") return gen.muzzleOptions(w).includes(a.id);
  if (a.kind === "light") return isLight(a.id) && gen.lightPool().some((x) => x.id === a.id);
  if (isLight(a.id)) return false;
  const part = gen.kit.byId.get(a.id); if (!part || part.slot !== "Device") return false;
  if (w.layout === "kit") return fits(gen, w, "device", { uid: 0, role: "device", from: a.id });
  const long = w.type !== "pistol" && w.type !== "revolver"; // la misma regla que el generador
  return gen.kit.options("Device", "any").some((d) => d.id === a.id) && ((long && w.type !== "shotgun") || !/foregrip/.test(a.id));
}

function mountRaw(gen: WeaponGenerator, w: WeaponSpec, a: Pick<AccItem, "kind" | "id"> | null, kind: AccKind = a!.kind) {
  if (kind === "light") {
    const z = w.tweaks.light ? { at: w.tweaks.light.at, side: w.tweaks.light.side } : w.tweaks.lightZone!;
    w.tweaks = { ...w.tweaks, light: a ? { id: a.id, ...z } : null, lightZone: z };
    gen.refresh(w); return;
  }
  if (kind === "device" && w.layout !== "kit") {
    const at = w.tweaks.device?.at ?? w.tweaks.deviceZone!;
    w.tweaks = { ...w.tweaks, device: a ? { id: a.id, at } : null, deviceZone: at };
    gen.refresh(w); return;
  }
  if (kind === "optic") { w.optic = a?.id ?? null; gen.refresh(w); return; }
  if (kind === "muzzle") { w.muzzle = a?.id ?? null; gen.refresh(w); return; }
  // Accesorio bajo el raíl del kit: es una pieza del kit en su socket
  const part: PartItem | null = a ? { uid: 0, role: "device", from: a.id } : null;
  swap(gen, w, "device", part);
}

/** ¿Se puede desmontar? (no si no hay nada o si el arma quedaría por debajo de su banda de poder). */
export function canDetach(gen: WeaponGenerator, w: WeaponSpec, kind: AccKind): Fit {
  if (!mountedAcc(w, kind)) return { ok: false, reason: "acc.empty" };
  const trial = structuredClone(w); ensureBandRef(gen, trial); w.bandRef = trial.bandRef;
  mountRaw(gen, trial, null, kind);
  return inBand(gen, trial) ? { ok: true } : { ok: false, reason: "acc.bandLow" };
}

/** Desmonta el accesorio de una zona y lo devuelve para el banco (null si no se puede: ver canDetach). */
export function detach(gen: WeaponGenerator, w: WeaponSpec, kind: AccKind): AccItem | null {
  const id = mountedAcc(w, kind); if (!id || !canDetach(gen, w, kind).ok) return null;
  mountRaw(gen, w, null, kind);
  return newAcc(kind, id, w.rarity.id);
}

/**
 * Monta un accesorio del banco. Un accesorio por zona: si ya había uno, se desmonta y se devuelve (va al banco).
 * Lanza un error si no encaja (usa canMount antes para mostrar el motivo).
 */
export function attach(gen: WeaponGenerator, w: WeaponSpec, a: AccItem): AccItem | null {
  const f = canMount(gen, w, a); if (!f.ok) throw new Error(f.reason);
  const old = mountedAcc(w, a.kind);
  mountRaw(gen, w, a);
  return old ? newAcc(a.kind, old, w.rarity.id) : null;
}

/** Al desguazar un arma, sus accesorios pasan al banco. */
export function accessoriesOf(w: WeaponSpec): AccItem[] {
  return ACC_KINDS.map((k) => mountedAcc(w, k)).flatMap((id, i) => (id ? [newAcc(ACC_KINDS[i], id, w.rarity.id)] : []));
}

/** Créditos por accesorio al desguazar duplicados (pocos, pero algo): por rareza. */
export const ACC_SCRAP: Record<RarityId, number> = { comun: 2, poco: 4, rara: 10, epica: 25, legendaria: 60 };

/** Desguaza los duplicados del banco: de cada pieza y rareza se conserva una (la más antigua) y el resto se paga en créditos. */
export function scrapDuplicates(bank: AccItem[]): { bank: AccItem[]; removed: number; credits: number } {
  const seen = new Set<string>(); const keep: AccItem[] = []; let credits = 0, removed = 0;
  for (const a of [...bank].sort((x, y) => x.uid - y.uid)) {
    const k = `${a.id}|${a.rarity}`;
    if (seen.has(k)) { credits += ACC_SCRAP[a.rarity] ?? 0; removed++; } else { seen.add(k); keep.push(a); }
  }
  // (se respeta el orden original del banco)
  const kept = new Set(keep.map((a) => a.uid));
  return { bank: bank.filter((a) => kept.has(a.uid)), removed, credits };
}
