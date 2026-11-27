// Partidas guardadas: formato con versión y migraciones, validación, resumen de ranura y gestor de ranuras sobre un
// almacenamiento abstracto (storage.ts). Las armas se guardan como datos (su descripción completa), nunca como mallas.
// Lo temporal (armas en el suelo, oleada en curso) no se guarda.
import { RARITIES } from "../weapons/generator";
import type { AccItem } from "../weapons/accbank";
import type { RarityId, WeaponSpec } from "../weapons/types";
import type { Purchase, ShopState } from "./shop";
import type { SaveStorage } from "./storage";
import { GRENADE_KINDS, isGadgetGrenade, setGrenadeUid, type GrenadeKind, type GrenadeRarity, type GrenadeSpec } from "./grenades";
import type { GadgetSpec } from "./gadgets";

export const SAVE_VERSION = 3;
export const SLOTS = ["slot1", "slot2", "slot3"] as const;
export const AUTO = "auto";
export type SlotId = (typeof SLOTS)[number] | typeof AUTO;

export interface SavedWeapon { spec: WeaponSpec; ammo: number; area: "equip" | "pack" | "storage"; index: number }
export interface SaveData {
  version: number;
  savedAt: string;          // ISO
  name: string;             // nombre de la partida
  playSeconds: number;
  credits: number;
  weapons: SavedWeapon[];
  active: number;
  bank: AccItem[];
  shop: ShopState;
  settings: Record<string, unknown>;
  lang: string;
  pixelLevel: number;
  /** Contratos diarios y semanales (opcional: partidas antiguas no lo tienen). */
  contracts?: import("./contracts").ContractState;
  /** Granadas y la equipada (opcional). */
  grenades?: import("./grenades").GrenadeSpec[]; grenadeActive?: number; gadgets?: import("./gadgets").GadgetSpec[]; gadgetActive?: number; furniture?: string[]; superId?: string;
  /** Nivel, experiencia y habilidades (opcional: las partidas antiguas empiezan al nivel de su mejor arma). */
  progress?: import("./progress").ProgressState;
  /** Súperes desbloqueados con módulos e incursiones completadas (opcional). */ supersOwned?: string[]; raidsDone?: number;
  /** Tarea 5: progreso de retículas (bajas por familia de óptica y formas desbloqueadas; opcional). */ reticles?: unknown;
  /** Armaduras guardadas y las puestas por ranura (opcional). */ armors?: import("./armor").ArmorSpec[]; worn?: Partial<Record<import("./armor").ArmorSlot, number | null>>;
}

// ---------- Migraciones: una función por versión, de N a N+1 ----------
type Raw = Record<string, unknown>;
const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  /**
   * v1 (primer borrador): inventario como dos listas de especificaciones, "chatarra" como moneda y caja de piezas
   * estructurales. v2: lista de armas con su sitio, créditos, banco de accesorios y estado de la máquina.
   * Las piezas estructurales sueltas ya no existen (solo se desmontan accesorios): se descartan.
   */
  1: (d) => {
    const inv = (d.inventory ?? {}) as { equip?: (WeaponSpec | null)[]; pack?: (WeaponSpec | null)[] };
    const weapons: SavedWeapon[] = [];
    (inv.equip ?? []).forEach((s, i) => { if (s) weapons.push({ spec: s, ammo: s.stats?.cargador ?? 0, area: "equip", index: i }); });
    (inv.pack ?? []).forEach((s, i) => { if (s) weapons.push({ spec: s, ammo: s.stats?.cargador ?? 0, area: "pack", index: i }); });
    return {
      version: 2, savedAt: d.savedAt ?? new Date(0).toISOString(), name: d.name ?? "", playSeconds: 0,
      credits: typeof d.scrap === "number" ? d.scrap : 0, weapons, active: d.active ?? 0, bank: [],
      shop: { spent: 0, history: [] }, settings: d.settings ?? {}, lang: d.lang ?? "en", pixelLevel: d.pixelLevel ?? 64,
    };
  },
  /**
   * v2: orb, knife, mine, chain y harpoon eran equipamiento. Pasan a granadas: se mueven de `gadgets` a `grenades`
   * con uid nuevo (setGrenadeUid), conservando rareza, semilla, potencia, radio y cargas; se reasignan los activos.
   */
  2: (d) => {
    const gadgets = (Array.isArray(d.gadgets) ? d.gadgets : []) as GadgetSpec[];
    const moved = gadgets.filter((g) => isObj(g) && isGadgetGrenade(g.kind));
    if (!moved.length) return { ...d, version: 3 };
    const kept = gadgets.filter((g) => !(isObj(g) && isGadgetGrenade(g.kind)));
    const grenades = (Array.isArray(d.grenades) ? [...(d.grenades as GrenadeSpec[])] : []) as GrenadeSpec[];
    const activeBefore = typeof d.gadgetActive === "number" ? gadgets[d.gadgetActive] : null;
    let uid = Math.max(0, ...grenades.map((g) => Number(g?.uid) || 0), ...gadgets.map((g) => Number(g?.uid) || 0)) + 1;
    const movedTo = new Map<GadgetSpec, GrenadeSpec>();
    for (const g of moved) {
      const kind = g.kind as GrenadeKind;
      const ng: GrenadeSpec = {
        uid: uid++, kind, rarity: (g.rarity as GrenadeRarity) ?? "comun", seed: Number(g.seed) || 1,
        damage: Number(g.power) || 1, radius: Number(g.radius) || 1,
        charges: Number(g.charges) || 1, recharge: Number(g.recharge) || 1, fuse: GRENADE_KINDS[kind].fuse,
      };
      grenades.push(ng); movedTo.set(g, ng);
    }
    setGrenadeUid(uid);
    const movedActive = activeBefore ? movedTo.get(activeBefore) : undefined;
    const gadgetActive = activeBefore ? kept.indexOf(activeBefore) : -1;
    let grenadeActive = typeof d.grenadeActive === "number" ? d.grenadeActive : -1;
    if (movedActive && grenadeActive < 0) grenadeActive = grenades.indexOf(movedActive);
    return { ...d, version: 3, gadgets: kept, grenades, gadgetActive, grenadeActive };
  },
};

export type LoadError = "missing" | "corrupt" | "newer" | "invalid";
export type LoadResult = { ok: true; data: SaveData; dropped: number } | { ok: false; error: LoadError };

const isObj = (x: unknown): x is Raw => !!x && typeof x === "object" && !Array.isArray(x);
const RARITY_IDS = new Set(RARITIES.map((r) => r.id));

/** ¿Es una descripción de arma utilizable? (las que no lo son se descartan al cargar, sin perder el resto) */
function validWeapon(w: unknown): w is SavedWeapon {
  if (!isObj(w) || !isObj(w.spec)) return false;
  const s = w.spec as Raw;
  return typeof s.type === "string" && Array.isArray(s.parts) && s.parts.length > 0 && isObj(s.rarity) && RARITY_IDS.has((s.rarity as Raw).id as RarityId)
    && isObj(s.stats) && isObj(s.paint) && typeof s.name === "string" && (w.area === "equip" || w.area === "pack" || w.area === "storage") && Number.isInteger(w.index);
}

/** Lee el texto de un guardado: migra versiones antiguas, valida y repara lo que se puede. Nunca lanza. */
export function parseSave(text: string | null): LoadResult {
  if (text == null) return { ok: false, error: "missing" };
  let d: unknown;
  try { d = JSON.parse(text); } catch { return { ok: false, error: "corrupt" }; }
  if (!isObj(d) || typeof d.version !== "number") return { ok: false, error: "corrupt" };
  if (d.version > SAVE_VERSION) return { ok: false, error: "newer" };
  let raw: Raw = d;
  try {
    while ((raw.version as number) < SAVE_VERSION) {
      const m = MIGRATIONS[raw.version as number]; if (!m) return { ok: false, error: "invalid" };
      raw = m(raw);
    }
  } catch { return { ok: false, error: "invalid" }; }
  if (!Array.isArray(raw.weapons)) return { ok: false, error: "invalid" };
  const weapons = raw.weapons.filter(validWeapon);
  const bank = Array.isArray(raw.bank) ? (raw.bank as unknown[]).filter((a): a is AccItem => isObj(a) && typeof a.id === "string" && ["optic", "muzzle", "device"].includes(a.kind as string)) : [];
  const shop: ShopState = isObj(raw.shop) ? { spent: Number(raw.shop.spent) || 0, history: Array.isArray(raw.shop.history) ? (raw.shop.history as Purchase[]).slice(0, 20) : [] } : { spent: 0, history: [] };
  // Escaparate (semilla, ronda, contador y vendidas) y garantía de la caja avanzada: solo si vienen y son válidos
  if (isObj(raw.shop) && isObj(raw.shop.showcase)) {
    const sc = raw.shop.showcase as Record<string, unknown>;
    if ([sc.seed, sc.round, sc.refreshAt].every((x) => Number.isFinite(Number(x))) && Array.isArray(sc.sold))
      shop.showcase = { seed: Number(sc.seed), round: Number(sc.round), refreshAt: Number(sc.refreshAt), sold: (sc.sold as unknown[]).map(Boolean) };
  }
  if (isObj(raw.shop) && Number.isFinite(Number(raw.shop.pity))) shop.pity = Math.max(0, Math.floor(Number(raw.shop.pity)));
  const num = (x: unknown, def: number) => (typeof x === "number" && Number.isFinite(x) ? x : def);
  const data: SaveData = {
    version: SAVE_VERSION, savedAt: typeof raw.savedAt === "string" ? raw.savedAt : new Date(0).toISOString(), name: typeof raw.name === "string" ? raw.name.slice(0, 32) : "",
    playSeconds: num(raw.playSeconds, 0), credits: Math.max(0, Math.floor(num(raw.credits, 0))), weapons, active: raw.active === 1 ? 1 : 0, bank, shop,
    settings: isObj(raw.settings) ? raw.settings : {}, lang: typeof raw.lang === "string" ? raw.lang : "en", pixelLevel: num(raw.pixelLevel, 64),
    grenades: Array.isArray(raw.grenades) ? (raw.grenades as SaveData["grenades"])!.filter((g) => isObj(g) && typeof (g as Raw).kind === "string").slice(0, 8) : undefined,
    grenadeActive: typeof raw.grenadeActive === "number" ? raw.grenadeActive : -1,
    gadgets: Array.isArray(raw.gadgets) ? (raw.gadgets as SaveData["gadgets"])!.filter((g) => isObj(g) && typeof (g as Raw).kind === "string").slice(0, 8) : undefined,
    gadgetActive: typeof raw.gadgetActive === "number" ? raw.gadgetActive : -1,
    furniture: Array.isArray(raw.furniture) ? (raw.furniture as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
    superId: typeof raw.superId === "string" ? raw.superId : undefined,
    contracts: isObj(raw.contracts) && Array.isArray((raw.contracts as Raw).list) ? (raw.contracts as unknown as SaveData["contracts"]) : undefined,
  };
  return { ok: true, data, dropped: raw.weapons.length - weapons.length + ((raw.bank as unknown[] | undefined)?.length ?? 0) - bank.length };
}

const ORDER = RARITIES.map((r) => r.id);
export interface SlotSummary { slot: SlotId; empty: boolean; error?: LoadError; name?: string; savedAt?: string; credits?: number; weapons?: number; best?: RarityId; playSeconds?: number }
export function summarize(slot: SlotId, d: SaveData): SlotSummary {
  const best = d.weapons.reduce<RarityId | undefined>((b, w) => (!b || ORDER.indexOf(w.spec.rarity.id) > ORDER.indexOf(b) ? w.spec.rarity.id : b), undefined);
  return { slot, empty: false, name: d.name, savedAt: d.savedAt, credits: d.credits, weapons: d.weapons.length, best, playSeconds: d.playSeconds };
}

/** Gestor de ranuras: 3 manuales + autoguardado, sobre cualquier almacenamiento. Un fallo en una ranura no afecta al resto. */
export class SaveManager {
  constructor(private store: SaveStorage) {}
  async save(slot: SlotId, data: SaveData) {
    const d = { ...data, version: SAVE_VERSION, savedAt: new Date().toISOString() };
    await this.store.write(slot, JSON.stringify(d));
    return d;
  }
  async load(slot: SlotId): Promise<LoadResult> {
    try { return parseSave(await this.store.read(slot)); } catch { return { ok: false, error: "corrupt" }; }
  }
  async list(): Promise<SlotSummary[]> {
    const out: SlotSummary[] = [];
    for (const slot of [AUTO, ...SLOTS] as SlotId[]) {
      const r = await this.load(slot);
      out.push(r.ok ? summarize(slot, r.data) : r.error === "missing" ? { slot, empty: true } : { slot, empty: false, error: r.error });
    }
    return out;
  }
  remove(slot: SlotId) { return this.store.delete(slot); }
  /** Exporta una ranura como texto JSON (para copiarlo a otro equipo). */
  async exportSlot(slot: SlotId): Promise<string | null> { const r = await this.load(slot); return r.ok ? JSON.stringify(r.data, null, 1) : null; }
  /** Importa un JSON a una ranura (se valida antes de escribir; si no es válido no se toca la ranura). */
  async importSlot(slot: SlotId, text: string): Promise<LoadResult> {
    const r = parseSave(text); if (!r.ok) return r;
    await this.store.write(slot, JSON.stringify(r.data));
    return r;
  }
}
