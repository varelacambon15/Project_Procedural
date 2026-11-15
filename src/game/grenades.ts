// Granadas equipables (estilo looter shooter): cada una es un objeto con tipo, rareza y estadísticas propias. Solo se
// lanzan si hay una equipada; tienen cargas que se recargan solas con el tiempo (según tipo y rareza).
// Datos y generación puros (sin DOM ni three): los usa gun.ts (lanzamiento), la tienda y el inventario.

export type GrenadeKind = "frag" | "incendiary" | "shock" | "cluster" | "singularity" | "sticky";
export type GrenadeRarity = "comun" | "poco" | "rara" | "epica" | "legendaria";
export interface GrenadeSpec {
  uid: number; kind: GrenadeKind; rarity: GrenadeRarity; seed: number;
  /** Daño de la explosión (en el centro; cae con la distancia). */ damage: number;
  /** Radio en metros. */ radius: number;
  /** Cargas máximas y segundos por carga. */ charges: number; recharge: number;
  /** Mecha en segundos (las adhesivas explotan al pegarse). */ fuse: number;
}

interface KindDef { damage: number; radius: number; charges: number; recharge: number; fuse: number; element: "fuego" | "electrico" | "explosive" | null; color: number }
export const GRENADE_KINDS: Record<GrenadeKind, KindDef> = {
  // Fragmentación: el estándar
  frag: { damage: 260, radius: 6, charges: 2, recharge: 9, fuse: 1.6, element: "explosive", color: 0x6a7a50 },
  // Incendiaria: menos estallido, deja quemaduras
  incendiary: { damage: 150, radius: 5.5, charges: 2, recharge: 11, fuse: 1.5, element: "fuego", color: 0xd8602a },
  // Descarga: aturde a todos los de la zona
  shock: { damage: 120, radius: 7, charges: 3, recharge: 8, fuse: 1.3, element: "electrico", color: 0x4ad8ff },
  // Racimo: suelta 4 bombetas alrededor al explotar
  cluster: { damage: 180, radius: 4.5, charges: 1, recharge: 13, fuse: 1.7, element: "explosive", color: 0xc8a040 },
  // Singularidad: atrae a los enemigos al centro un instante y luego estalla
  singularity: { damage: 220, radius: 8, charges: 1, recharge: 16, fuse: 1.4, element: null, color: 0x9a6aff },
  // Adhesiva: se pega al primer enemigo que toca y estalla enseguida
  sticky: { damage: 300, radius: 4, charges: 2, recharge: 12, fuse: 0.6, element: "explosive", color: 0x48c070 },
};
export const GRENADE_KIND_LIST = Object.keys(GRENADE_KINDS) as GrenadeKind[];

/** Mejora por rareza: daño, radio, carga extra y recarga más rápida. */
export const GRENADE_RARITY: Record<GrenadeRarity, { mult: number; radius: number; charges: number; recharge: number; color: string; price: number }> = {
  comun: { mult: 1, radius: 1, charges: 0, recharge: 1, color: "#c9c9c9", price: 90 },
  poco: { mult: 1.15, radius: 1.05, charges: 0, recharge: 0.92, color: "#5fc26a", price: 160 },
  rara: { mult: 1.3, radius: 1.1, charges: 1, recharge: 0.85, color: "#4a90e8", price: 260 },
  epica: { mult: 1.5, radius: 1.18, charges: 1, recharge: 0.75, color: "#a35cf0", price: 420 },
  legendaria: { mult: 1.8, radius: 1.3, charges: 2, recharge: 0.65, color: "#f2a541", price: 700 },
};
export const GRENADE_RARITIES = Object.keys(GRENADE_RARITY) as GrenadeRarity[];

function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

let uid = 1;
export const setGrenadeUid = (n: number) => { uid = Math.max(uid, n); };

/** Granada nueva de un tipo y rareza, con una pequeña variación de estadísticas por semilla. */
export function makeGrenade(seed: number, kind?: GrenadeKind, rarity?: GrenadeRarity): GrenadeSpec {
  const r = rng(seed);
  const k = kind ?? GRENADE_KIND_LIST[Math.floor(r() * GRENADE_KIND_LIST.length)];
  const ra = rarity ?? (["comun", "comun", "comun", "poco", "poco", "rara", "epica", "legendaria"] as GrenadeRarity[])[Math.floor(r() * 8)];
  const d = GRENADE_KINDS[k], q = GRENADE_RARITY[ra], v = () => 0.92 + r() * 0.16;
  return {
    uid: uid++, kind: k, rarity: ra, seed,
    damage: Math.round(d.damage * q.mult * v()), radius: +(d.radius * q.radius * v()).toFixed(1),
    charges: d.charges + q.charges, recharge: +(d.recharge * q.recharge * v()).toFixed(1), fuse: d.fuse,
  };
}

/** Daño a una distancia del centro: entero en el núcleo (30 % del radio) y cae hasta el 25 % en el borde. */
export function falloff(g: Pick<GrenadeSpec, "damage" | "radius">, dist: number): number {
  if (dist > g.radius) return 0;
  const t = Math.max(0, (dist / g.radius - 0.3) / 0.7);
  return Math.round(g.damage * (1 - 0.75 * t));
}

/** Cargas y recarga: el contador avanza mientras falten cargas. */
export class GrenadePouch {
  charges = 0; private t = 0;
  constructor(public g: GrenadeSpec | null = null) { this.charges = g?.charges ?? 0; }
  equip(g: GrenadeSpec | null) { this.g = g; this.charges = g ? Math.min(this.charges, g.charges) : 0; this.t = 0; }
  update(dt: number) {
    if (!this.g || this.charges >= this.g.charges) { this.t = 0; return; }
    this.t += dt; if (this.t >= this.g.recharge) { this.t = 0; this.charges++; }
  }
  /** Gasta una carga; false si no hay granada o no quedan cargas. */
  use(): boolean { if (!this.g || this.charges <= 0) return false; this.charges--; return true; }
  /** Fracción de recarga de la siguiente carga (0..1). */
  get progress() { return this.g && this.charges < this.g.charges ? this.t / this.g.recharge : 1; }
}
