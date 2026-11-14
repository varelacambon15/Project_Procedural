// Kit modular (Modular Firearms Pack): armas montadas pieza a pieza por sockets con nombre.
// Cada pieza trae su origen en su punto de unión y, a veces, sockets propios (el cañón lleva el del alza delantera
// y el de la boca; el guardamanos, los de accesorios bajo el raíl). Una pieza encaja en el socket del mismo
// nombre si es del mismo calibre o de calibre universal. Todo es lógica pura: el ensamblador 3D solo coloca.
import type { PartPick, PartRole, Stats, WeaponSpec, WeaponType } from "./types";
import type { Rng } from "./rng";

export type Caliber = "556" | "9mm" | "12ga" | "any";
export type V3 = [number, number, number];
export interface KitPart {
  id: string; file: string; slot: string; caliber: Caliber;
  /** Sockets propios, en metros y relativos al origen de la pieza (puede haber varios del mismo nombre). */
  sockets: Record<string, V3[]>;
  bounds: { min: V3; max: V3 };
  triangles: number;
  profile?: import("./variation").Profile;
}

/** Rol (ranura del banco) de cada socket. Las alzas no son ranuras: se montan solas si no hay mira. */
export const KIT_ROLE: Record<string, PartRole> = {
  Platform: "receiver", Barrel: "barrel", Handguard: "front", Stock: "stock", Handle: "grip", Trigger: "trigger",
  ChargingHandle: "charging", Slide: "slide", PumpHandle: "pump", Magazine: "magazine", Muzzle: "muzzle", Sights_Rear: "scope", Device: "device",
};
/** Tipo de arma de cada plataforma. */
export const KIT_PLATFORM_TYPE: Record<string, WeaponType> = {
  "k-platform-556-01": "rifle", "k-platform-9-01": "pistol", "k-platform-9-02": "pistol", "k-platform-12ga-01": "shotgun",
};
/** Capacidad real de cada cargador. */
export const KIT_MAG: Record<string, number> = {
  "k-magazine-556-01": 30, "k-magazine-556-02": 20, "k-magazine-556-03": 25, "k-magazine-9-01": 15, "k-magazine-9-02": 21,
  "k-magazine-12ga-6shell": 6, "k-magazine-12ga-8shell": 8,
};
/** Piezas con efecto propio en las estadísticas (pequeño y con sentido: la empuñadura delantera estabiliza, etc.). */
export const KIT_MODS: Record<string, Partial<Stats>> = {
  "k-stock-rod-01": { precision: 3, manejo: 2 }, "k-stock-rod-02": { manejo: 6 }, "k-stock-rod-03": { precision: 6, manejo: -2 },
  "k-handle-01": { manejo: 3 }, "k-handle-02": { precision: 3 },
  "k-trigger-01": { precision: 2 }, "k-trigger-02": { cadencia: 4 },
  "k-charginghandle-556-01": { manejo: 2 }, "k-charginghandle-556-02": { manejo: 4 },
  "k-handguard-556-01": { manejo: 3 }, "k-handguard-556-02": { precision: 3 },
  "k-pumphandle-12ga-01": { cadencia: 4 }, "k-pumphandle-12ga-02": { manejo: 4 }, "k-pumphandle-12ga-03": { precision: 3 },
  "k-slide-9-01": { manejo: 3 }, "k-slide-9-02": { precision: 3 },
  "k-barrel-556-01": { alcance: 3 }, "k-barrel-556-02": { precision: 2 }, "k-barrel-9-45in-01": { manejo: 3 }, "k-barrel-9-45in-02": { alcance: 4 },
  "k-barrel-12ga-01": { alcance: 3 }, "k-barrel-12ga-02": { precision: 2 },
  "k-device-foregrip-01": { manejo: 5, precision: 2 }, "k-device-foregrip-02": { manejo: 7 },
  "k-device-flashlight-01": { manejo: 2 }, "k-device-laser-01": { precision: 5 }, "k-device-laserlight-01": { precision: 3, manejo: 2 },
};
/** Piezas que el pack trae orientadas al revés (la mira holográfica tiene la ventana delante): se giran 180°. */
export const KIT_FLIP = new Set(["k-optic-rear-rail-01"]);
/** Accesorios reales (Flat Gun Attachments) aptos para cada tipo de arma: miras y supresores. */
export function realOptics(kit: KitIndex, type: WeaponType): string[] {
  const ok: Record<string, WeaponType[] | null> = {
    reddot: null, reflex: null, holographic: ["rifle", "smg", "shotgun", "lmg", "bullpup"], magnified: ["rifle", "smg", "lmg", "bullpup"], scope: ["rifle", "sniper", "bullpup"],
  };
  return kit.parts.filter((p) => p.id.startsWith("k-att-") && p.slot === "Sights_Rear").filter((p) => { const k = p.id.split("-")[2]; const t = ok[k]; return t === null ? true : !!t?.includes(type); })
    .filter((p) => type !== "pistol" && type !== "revolver" || /reddot|reflex/.test(p.id)).map((p) => p.id);
}
export const realSuppressors = (kit: KitIndex, type: WeaponType) => (type === "pistol" || type === "revolver" ? [] : kit.parts.filter((p) => p.id.startsWith("k-att-suppressor")).map((p) => p.id));
export const isKit = (id: string | null | undefined): id is string => !!id && id.startsWith("k-");
const FOREGRIP = /foregrip/;

/** Nombre legible de una pieza del kit ("k-stock-rod-02" -> "Stock Rod II"). */
export function kitLabel(id: string): string {
  const roman = ["", "I", "II", "III", "IV"];
  const words = id.replace(/^k-/, "").split("-").map((w) => (/^0\d$/.test(w) ? roman[Number(w)] : w === "556" ? "5.56" : w === "9" ? "9mm" : w === "45in" ? "" : w === "rear" || w === "rail" ? "" : w === "muzzledevice" ? "muzzle" : w));
  return words.filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ").replace("Charginghandle", "Charging handle").replace("Pumphandle", "Pump").replace("Ironsight", "Iron sight").replace("6shell", "6-shell").replace("8shell", "8-shell");
}

export class KitIndex {
  readonly byId = new Map<string, KitPart>();
  constructor(readonly parts: KitPart[] = []) { for (const p of parts) this.byId.set(p.id, p); }
  get size() { return this.parts.length; }
  /** Tipos de arma que se pueden montar con el kit. */
  types(): WeaponType[] { return [...new Set(this.parts.filter((p) => p.slot === "Platform").map((p) => KIT_PLATFORM_TYPE[p.id]).filter(Boolean))]; }
  /** Piezas para un socket y calibre. */
  options(slot: string, caliber: Caliber, type?: WeaponType, all = false): KitPart[] {
    return this.parts.filter((p) => p.slot === slot && (p.caliber === caliber || p.caliber === "any") && !(slot === "Device" && type === "pistol" && FOREGRIP.test(p.id)) && (all || !KIT_RETIRED.has(p.id)));
  }
  platformOf(spec: Pick<WeaponSpec, "parts">): KitPart { return this.byId.get(spec.parts[0].from)!; }
  caliberOf(spec: Pick<WeaponSpec, "parts">): Caliber { return this.platformOf(spec).caliber; }
}

/** Piezas del kit que no se eligen al generar (siguen siendo la referencia "de serie" de la plataforma). */
// (el guardamanos liso k-handguard-556-01 ya no: se viste con raíl y ranuras al montarlo, ver assembler.ts)
const KIT_RETIRED = new Set<string>([]);

/** Pieza colocada: dónde va (metros, coordenadas del arma) y cuánto se estira a lo largo. */
export interface Placement { part: KitPart; role: PartRole | "sight"; pos: V3; stretch: number }

/**
 * Coloca todas las piezas de un arma del kit recorriendo el árbol de sockets desde la plataforma.
 * Sin mira, se montan las alzas (de raíl o soldadas). El cañón y el guardamanos se estiran según
 * `barrelLength` y `tweaks.front`, y sus sockets se mueven con ellos.
 */
export function kitPlacements(kit: KitIndex, spec: Pick<WeaponSpec, "parts" | "optic" | "muzzle" | "barrelLength" | "tweaks">): { placements: Placement[]; muzzle: V3 | null; opticAt: V3 | null } {
  const byRole = new Map<string, KitPart>();
  for (const p of spec.parts) { const k = kit.byId.get(p.from); if (k) byRole.set(p.role, k); }
  const platform = kit.byId.get(spec.parts[0].from)!;
  const optic = isKit(spec.optic) ? kit.byId.get(spec.optic) ?? null : null;
  const muzzleDev = isKit(spec.muzzle) ? kit.byId.get(spec.muzzle) ?? null : null;
  const hasOptic = !!spec.optic;
  const irons = (slot: string) => kit.parts.find((p) => p.slot === slot && (p.id.includes("ironsight")) && (p.caliber === platform.caliber || p.caliber === "any")) ?? null;
  const out: Placement[] = [];
  let muzzle: V3 | null = null, opticAt: V3 | null = null;
  let deviceUsed = false;

  const place = (part: KitPart, role: Placement["role"], at: V3, stretch: number) => {
    out.push({ part, role, pos: at, stretch });
    for (const [key, list] of Object.entries(part.sockets)) {
      for (const s of list) {
        const p: V3 = [at[0] + s[0] * stretch, at[1] + s[1], at[2] + s[2]];
        let child: KitPart | null = null, childRole: Placement["role"] = "sight", k = 1;
        if (key === "Sights_Rear") {
          opticAt = p;
          child = optic ?? (hasOptic ? null : irons("Sights_Rear")); childRole = optic ? "scope" : "sight";
        } else if (key === "Sights_Front" || key === "Sights_Front_Welded" || key === "Sights_Rear_Welded") {
          child = hasOptic ? null : irons(key);
        } else if (key === "Muzzle") {
          muzzle = p; child = muzzleDev; childRole = "muzzle";
        } else if (key === "Device") {
          // Un solo accesorio bajo el raíl, en el primer socket libre (el delantero en el guardamanos)
          if (!deviceUsed && byRole.has("device")) { child = byRole.get("device")!; childRole = "device"; deviceUsed = true; }
        } else if (key !== "Ammunition") {
          const role = KIT_ROLE[key];
          child = role ? byRole.get(role) ?? null : null; childRole = role ?? "sight";
          if (key === "Barrel") k = spec.barrelLength || 1;
          if (key === "Handguard") k = spec.tweaks?.front ?? 1;
          if (key === "Stock") { if (spec.tweaks?.nostock || spec.tweaks?.pstock) continue; k = spec.tweaks?.stock ?? 1; }
          if (key === "Handguard" && spec.tweaks?.pfront) continue;
        }
        if (child) place(child, childRole, p, k);
      }
    }
    // Cañón sin socket de boca: la boca está en su extremo
    if (role === "barrel" && !part.sockets.Muzzle) muzzle = [at[0] + part.bounds.max[0] * stretch, at[1], at[2]];
  };
  place(platform, "receiver", [0, 0, 0], 1);
  // El dispositivo de boca va en la boca aunque el cañón no tenga socket (cañón de 5.56 de extremo liso)
  if (muzzleDev && !out.some((p) => p.role === "muzzle") && muzzle) out.push({ part: muzzleDev, role: "muzzle", pos: muzzle, stretch: 1 });
  if (muzzleDev && muzzle) muzzle = [muzzle[0] + muzzleDev.bounds.max[0], muzzle[1], muzzle[2]];
  return { placements: out, muzzle, opticAt };
}

/** ¿Admite el arma un dispositivo de boca? (cañón con socket de boca, o el de 5.56 de extremo liso). */
export function kitMuzzleOptions(kit: KitIndex, spec: Pick<WeaponSpec, "parts">): string[] {
  const barrel = kit.byId.get(spec.parts.find((p) => p.role === "barrel")?.from ?? "");
  if (!barrel) return [];
  if (!barrel.sockets.Muzzle && barrel.caliber !== "556") return [];
  // Escopeta con tubo de 8 cartuchos: el tubo llega a la boca y no deja sitio
  if (spec.parts.some((p) => p.from === "k-magazine-12ga-8shell")) return [];
  return [...kit.options("Muzzle", barrel.caliber).filter((p) => !p.id.startsWith("k-att-")).map((p) => p.id), ...(barrel.caliber === "9mm" ? [] : realSuppressors(kit, "rifle"))];
}
/** Miras: del kit o propias, si la plataforma o la corredera tienen raíl. */
export function kitOpticOptions(kit: KitIndex, spec: Pick<WeaponSpec, "parts" | "type">, procedural: string[]): string[] {
  const rail = spec.parts.some((p) => kit.byId.get(p.from)?.sockets.Sights_Rear);
  if (!rail) return [];
  const own = kit.options("Sights_Rear", "any").filter((p) => !p.id.includes("ironsight") && !p.id.startsWith("k-att-")).filter((p) => spec.type !== "pistol" || p.id === "k-optic-rear-rail-02");
  return [...own.map((p) => p.id), ...realOptics(kit, spec.type), ...procedural];
}

/**
 * Elige las piezas de un arma del kit para un tipo: plataforma y una pieza para cada socket obligatorio,
 * con variaciones de largo (cañón y guardamanos) que mantienen el alza delantera por delante del guardamanos.
 */
export function rollKit(kit: KitIndex, r: Rng, type: WeaponType): { parts: PartPick[]; barrelLength: number; front: number; stock: number } {
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const platforms = kit.parts.filter((p) => p.slot === "Platform" && KIT_PLATFORM_TYPE[p.id] === type);
  const platform = pick(platforms);
  const parts: PartPick[] = [{ role: "receiver", from: platform.id }];
  const cal = platform.caliber;
  const want = (slot: string, first = false) => { const o = kit.options(slot, cal, type).filter((p) => slot !== "Device" || p.id.startsWith("k-device")); if (o.length) parts.push({ role: KIT_ROLE[slot], from: (first ? o[0] : pick(o)).id }); };
  // Una base y poco más: la configuración de serie (primera variante de cada pieza) y 1-2 piezas cambiadas
  const slots = Object.keys(platform.sockets).filter((slot) => KIT_ROLE[slot] && slot !== "Sights_Rear" && slot !== "Device");
  for (const slot of slots) want(slot, true);
  // (gatillo y palanca de carga apenas se ven: los cambios van a piezas que cambian la silueta)
  const changeable = slots.filter((slot) => kit.options(slot, cal, type).length > 1 && slot !== "Trigger" && slot !== "ChargingHandle");
  const n = Math.min(changeable.length, 1 + (r() < 0.5 ? 1 : 0));
  for (let i = 0; i < n; i++) {
    const slot = changeable.splice(Math.floor(r() * changeable.length), 1)[0];
    const o = kit.options(slot, cal, type).slice(1);
    const idx = parts.findIndex((p) => p.role === KIT_ROLE[slot]);
    parts[idx] = { role: KIT_ROLE[slot], from: pick(o).id };
  }
  // Accesorio bajo el raíl: a veces (en el guardamanos, el guardamanos del corredero o la plataforma)
  const hosts = parts.map((p) => kit.byId.get(p.from)!).filter((p) => p.sockets.Device);
  if (hosts.length && r() < 0.6) want("Device");
  const { barrelLength, front } = kitLengths(r, type, parts);
  const stock = type !== "pistol" ? 0.92 + r() * 0.16 : 1;
  return { parts, barrelLength, front, stock };
}

/** Largo de cañón y guardamanos del kit (cañón corto o largo; el alza delantera siempre por delante del guardamanos). */
export function kitLengths(r: Rng, type: WeaponType, parts: PartPick[]): { barrelLength: number; front: number } {
  let barrelLength = 1, front = 1;
  if (type === "rifle") {
    barrelLength = r() < 0.5 ? 0.78 + r() * 0.14 : 1.08 + r() * 0.2;
    // El alza delantera (en el cañón, a 35,8 cm) debe quedar por delante del guardamanos
    const maxFront = Math.min(1.05, (0.0426 + 0.3577 * barrelLength - 0.0668) / 0.318);
    front = Math.min(maxFront, 0.62 + r() * 0.45);
  } else if (type === "shotgun") {
    const long = parts.some((p) => p.from === "k-magazine-12ga-8shell");
    barrelLength = long ? 1.05 + r() * 0.08 : r() < 0.5 ? 0.72 + r() * 0.12 : 0.92 + r() * 0.08;
  }
  return { barrelLength, front };
}

/** Cargador real del arma del kit (si lo tiene). */
export const kitMagazine = (spec: Pick<WeaponSpec, "parts">) => KIT_MAG[spec.parts.find((p) => p.role === "magazine")?.from ?? ""] ?? null;
