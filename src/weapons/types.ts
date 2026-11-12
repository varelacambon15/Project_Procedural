// Tipos compartidos del sistema de armas. Los textos visibles se obtienen con i18n a partir de los ids.

export type WeaponType = "pistol" | "revolver" | "smg" | "rifle" | "bullpup" | "shotgun" | "sniper" | "launcher" | "flamethrower" | "lmg" | "accessory";
export type PartRole = "body" | "slide" | "frame" | "barrel" | "magazine" | "scope" | "muzzle" | "receiver" | "stock" | "grip" | "front" | "trigger" | "charging" | "pump" | "device";
export type FireMode = "auto" | "semi" | "burst" | "pump" | "bolt";

/** Tipos estándar de unión: una pieza solo encaja en una unión del mismo tipo. */
export type ConnectorType = "barrel_thread" | "mag_well" | "optic_mount" | "rail_top" | "slide_rails" | "barrel_seat" | "top_surface" | "stock_mount" | "handguard_mount" | "grip_mount";
export interface Socket { pos: [number, number, number]; diameter?: number; size?: [number, number]; length?: number; type?: ConnectorType }

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
  /** Armas despiezadas: juntas de unión (cajón: rear/front/grip; piezas: stockFace/frontFace/gripFace). */
  joints?: Record<"rear" | "front" | "grip" | "stockFace" | "frontFace" | "gripFace", Socket>;
  modular?: boolean;
  /** Piezas aprobadas para usarse sueltas (revisión visual); el generador solo usa estas. */
  approved?: string[];
  /** Si está en cuarentena, el motivo. */
  quarantine?: string;
  /** Caja de cada pieza por rol, y roles que son de madera. */
  partBounds?: Partial<Record<PartRole, { min: [number, number, number]; max: [number, number, number] }>>;
  wood?: PartRole[];
  /** Fuera del botín (revisión visual), con el motivo. */
  excluded?: string;
}
export interface Manifest { convention: string; weapons: AssetEntry[]; kit?: import("./kit").KitPart[] }

export type StatKey = "dano" | "cadencia" | "precision" | "alcance" | "manejo" | "cargador";
export type Stats = Record<StatKey, number>;

export type RarityId = "comun" | "poco" | "rara" | "epica" | "legendaria";
/**
 * Rareza: `budget` = mejora total de estadísticas (presupuesto de poder) sobre la base; `tiers` = niveles de efecto que
 * recibe (A menor, B mayor, L legendario); `accessories` = accesorios ya montados [mín, máx].
 */
export interface Rarity { id: RarityId; weight: number; budget: number; tiers: ("A" | "B" | "L")[]; accessories: [number, number]; color: string }

/** Efecto: nivel A (menor), B (mayor; incluye fuego, eléctrico y explosivo) o L (firma de una legendaria). */
export interface Effect { id: string; tier: "A" | "B" | "L"; family: string; element?: "fuego" | "electrico" | "explosive"; icon: string; color: string; value?: number }

/** Acabado: color principal (cajón, guardamanos), secundario (culata, empuñadura) y el resto en acero. */
export interface Paint { id: string; color: [number, number, number] | null; secondary?: [number, number, number] | null }

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
  layout: "modular-pistol" | "modular-long" | "body" | "kit";
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
  /** Reparto del presupuesto de rareza entre estadísticas (fracciones que suman 1). */
  bonus: Partial<Record<StatKey, number>>;
  /** Variaciones leves de cada pieza: largo de culata y guardamanos, tamaño y ángulo de empuñadura, largo del cuerpo. */
  tweaks: Tweaks;
}

export interface Tweaks { stock: number; front: number; grip: number; gripAngle: number; body: number }
export const NO_TWEAKS: Tweaks = { stock: 1, front: 1, grip: 1, gripAngle: 0, body: 1 };
