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
  /** Perfil lateral (silueta) de cada pieza por rol. */
  profiles?: Partial<Record<PartRole, import("./variation").Profile>>;
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
export interface Paint { id: string; color: [number, number, number] | null; secondary?: [number, number, number] | null; metal?: [number, number, number]; accent?: [number, number, number]; wood?: boolean }

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
  layout: "modular-pistol" | "modular-long" | "body" | "kit" | "proc-long";
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
  lineage?: Lineage;
  /** Era (solo aspecto) y nivel de modernización 0-3. */
  era?: "classic" | "modern" | "rustic" | "scifi";
  modLevel?: number;
  /** Nombre elegido por el jugador (solo cosmético). Si falta, se muestra `name` (el generado, que se conserva). */
  customName?: string | null;
  /** Perfil de agarre (05-E): mano de apoyo en cadera y al apuntar, y postura. Se guarda con el arma. */
  hold?: import("./grip").GripProfile | null;
  /** Poder sin rareza del arma tal como salió (referencia de su banda de poder al montar y desmontar accesorios). */
  bandRef?: number;
}

/**
 * Variaciones sobre las piezas reales. `stock`, `front` y `body` estiran por zonas (solo el tramo central; los extremos
 * con detalle quedan intactos); `stockH` cambia el alto de la culata; `rail`, `drum` y `device` añaden detalles
 * (raíl superior, cargador de tambor, accesorio real del pack modular bajo el guardamanos) en la posición indicada.
 */
export interface Tweaks {
  stock: number; front: number; grip: number; gripAngle: number; body: number;
  stockH?: number;
  rail?: [number, number, number] | null;   // x0, x1, y (antes de centrar)
  drum?: boolean;
  /** Sin culata (subfusiles y escopetas "de empuñadura", como en el armero de MW2019). */
  nostock?: boolean;
  /** Cargador alargado (factor de largo; 1 = de serie). */
  magLen?: number;
  /** Culata plegada hacia delante, al costado del cajón (la propia o la cambiada). */
  fold?: boolean;
  /** Culata y guardamanos hechos por código (sustituyen a los del modelo). */
  pstock?: import("./procparts").ProcStock | null;
  pfront?: import("./procparts").ProcFront | null;
  /** Arma larga generada por código (bullpup, ametralladora, escopeta): su diseño completo. */
  long?: import("./longgen").LongDesign;
  /** Armas enteras: cortes del cuerpo (x local) donde empiezan la culata o el guardamanos por código. */
  cutRear?: number | null;
  cutFront?: number | null;
  /** Añadidos de era y de kit de modernización (posiciones antes de centrar). */
  eraAdds?: EraAdds | null;
  device?: { id: string; at: [number, number] } | null;
  /** Punto de montaje bajo el raíl que queda libre al desmontar el accesorio (se puede volver a montar uno). */
  deviceZone?: [number, number] | null;
  adds?: Addon[] | null;
  /** Pistola modular generada por código: su diseño completo (piezas y parámetros). */
  pistol?: import("./pistolgen").PistolDesign | null;
}
/**
 * Añadidos estructurales clásicos (valen en cualquier era): banda ventilada sobre el cañón, tetón o contrapeso bajo el
 * cañón, cubrecañón perforado, bípode plegado y alza de escalera. Caja en coordenadas del
 * arma antes de centrar: de x0 a x1, de y a y + h.
 */
export interface Addon { kind: "rib" | "lug" | "shield" | "bipod" | "ladder" | "handle" | "jacket" | "cheek"; x0: number; x1: number; y: number; h: number }
export interface EraAdds {
  cover?: [number, number, number, number, number] | null;    // x0, x1, y, alto, ancho
  cell?: [number, number, number, number] | null;             // x, y (alto del pozo), alto, ancho
  display?: [number, number, number] | null;                  // x, y, z (costado)
  adapters?: [number, number, number][];                      // x, y, ancho
  tapes?: [number, number, number, number, number][];         // x, y, largo, alto, ancho
  patches?: [number, number, number][];                       // x, y, z
}
/** Linaje: de qué sale el arma y qué se le ha hecho, para poder reproducirla. */
export interface Lineage { base: string; swaps: PartPick[]; changes: string[]; ops: Tweaks; similarity: number; era?: string; modLevel?: number }
export const NO_TWEAKS: Tweaks = { stock: 1, front: 1, grip: 1, gripAngle: 0, body: 1 };
