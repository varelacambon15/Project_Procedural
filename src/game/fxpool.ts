// Lógica pura de los efectos de combate: pools acotados y topes por calidad.
// SIN Three.js ni DOM: se prueba en Node con Vitest (tests/fxpool.test.ts).
import type { Quality } from "./settings";

export type FxResource =
  | "muzzle" | "casing" | "tracer" | "spark" | "decal"
  | "smoke" | "ember" | "flame" | "beam" | "charge";

/** Topes de referencia (calidad Media). Alto los usa tal cual; Bajo los reduce a la mitad. */
export const FX_CAPS_MEDIUM: Record<FxResource, number> = {
  muzzle: 6,
  casing: 40,
  tracer: 16,
  spark: 120,
  decal: 60,
  smoke: 12,
  ember: 60,
  flame: 24,
  beam: 16,
  charge: 8,
};

export type FxCaps = Record<FxResource, number>;

/** Bajo = mitad de cada tope (mínimo 1); Medio y Alto = referencia. */
export function fxCaps(quality: Quality): FxCaps {
  const caps = { ...FX_CAPS_MEDIUM };
  if (quality === "low") for (const k of Object.keys(caps) as FxResource[]) caps[k] = Math.max(1, Math.floor(caps[k] / 2));
  return caps;
}

/** Cada cuántas balas se dibuja una trazadora corta (más corta en Bajo). */
export const TRACER_EVERY: Record<Quality, number> = { low: 8, medium: 4, high: 3 };

/**
 * Pool acotado y reciclable. Nunca mantiene más de `cap` objetos «en uso»: si no queda
 * sitio, `acquire()` devuelve null y el llamador degrada el efecto (no crea nada nuevo).
 * Los objetos liberados se reutilizan, así que el coste de creación es una sola vez por ranura.
 */
export class Pool<T> {
  private readonly free: T[] = [];
  private readonly used = new Set<T>();
  constructor(readonly cap: number, private readonly make: () => T, private readonly reset?: (t: T) => void) {}

  /** Devuelve un objeto del pool, o null si se ha alcanzado el tope. */
  acquire(): T | null {
    if (this.used.size >= this.cap) return null;
    const v = this.free.pop() ?? this.make();
    this.reset?.(v);
    this.used.add(v);
    return v;
  }

  /** Devuelve un objeto al pool. Ignora objetos que no pertenecen a él. */
  release(v: T): void {
    if (!this.used.delete(v)) return;
    this.free.push(v);
  }

  has(v: T): boolean { return this.used.has(v); }
  get size(): number { return this.used.size; }
  get capacity(): number { return this.cap; }
  get freeCount(): number { return this.free.length; }

  /** Itera una copia de los objetos en uso (permite liberar dentro del bucle). */
  forEach(fn: (v: T) => void): void { for (const v of [...this.used]) fn(v); }
  releaseAll(): void { for (const v of [...this.used]) this.release(v); }
}

/** Material de impacto: chispas en metal, polvo en hormigón, píxeles en carne. */
export type ImpactMaterial = "metal" | "concrete" | "flesh";

/** Clasifica un impacto a partir de la zona y de si el objetivo lleva blindaje/casco. */
export function impactMaterial(kind: { metal?: boolean; zone?: string }): ImpactMaterial {
  if (kind.metal) return "metal";
  if (kind.zone === "head" || kind.zone === "body" || kind.zone === "limb") return "flesh";
  return "concrete";
}

/** Paleta compartida por los impactos del mundo y los de los muñecos. */
export const IMPACT_COLORS: Record<ImpactMaterial, number[]> = {
  metal: [0xffd27a, 0xfff4d0, 0xffa83a],
  concrete: [0xb8b0a4, 0x8f8a80, 0xd8d0c0],
  flesh: [0xf0e6d8, 0xc0b4a4, 0xd2702e],
};

/** Elige un color de la paleta del material (rng inyectable para pruebas deterministas). */
export function impactColor(material: ImpactMaterial, rnd: () => number = Math.random): number {
  const p = IMPACT_COLORS[material];
  return p[Math.min(p.length - 1, Math.floor(rnd() * p.length))];
}
