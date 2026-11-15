// Pack de sonidos por tipo de arma (assets/sonidos, ver su LEEME.md y manifest.json). Aquí solo está la selección
// (qué muestra suena y cuándo): sin dependencias del navegador, para poder probarla. La reproducción está en audio.ts.

export interface RecargaPaso { evento: string; archivo: string; en: number }
export interface RecargaVariante { id: string; pasos: RecargaPaso[] }
export interface TipoSonidos {
  disparo: string[]; silenciado?: string[]; grave?: string[]; lejano?: string[]; seco?: string[];
  recarga?: RecargaVariante[]; accion?: Record<string, string[]>; volumen_sugerido?: number;
}
export interface SoundManifest { tipos: Record<string, TipoSonidos>; efectos: Record<string, string[]> }

/** Tipos del juego que usan el pack (launcher y flamethrower siguen con la síntesis). El bullpup suena como fusil. */
export function soundType(type: string): string | null {
  if (type === "launcher" || type === "flamethrower") return null;
  return type === "bullpup" ? "rifle" : type;
}

/** Hash entero estable de una cadena (para fijar la variante de recarga de cada arma). */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const pickOf = <T>(l: T[] | undefined, rand: () => number): T | null => (l && l.length ? l[Math.floor(rand() * l.length) % l.length] : null);

/**
 * Muestras de un disparo: la principal (silenciada si hay bocacha silenciadora y el tipo la tiene), la capa grave y
 * la ganancia del tipo. null si el tipo no está en el pack.
 */
export function pickShot(m: SoundManifest, type: string, quiet: boolean, rand: () => number = Math.random) {
  const k = soundType(type), t = k ? m.tipos[k] : undefined;
  if (!t) return null;
  const main = pickOf(quiet && t.silenciado?.length ? t.silenciado : t.disparo, rand);
  if (!main) return null;
  return { main, grave: quiet ? null : pickOf(t.grave, rand), gain: t.volumen_sugerido ?? 0.7, quiet: quiet && !!t.silenciado?.length };
}

/** Variante de recarga fija de un arma (por su semilla o id): siempre la misma para la misma arma. */
export function pickReload(m: SoundManifest, type: string, seed: number | string): RecargaVariante | null {
  const k = soundType(type), vs = k ? m.tipos[k]?.recarga : undefined;
  if (!vs?.length) return null;
  const h = typeof seed === "number" ? seed >>> 0 : hashStr(seed);
  return vs[h % vs.length];
}

/**
 * Sonidos del ciclo entre disparos según la acción del arma: cerrojo, bombeo, corredera o martillo. Se buscan en el
 * propio tipo y, si no los tiene (p. ej. una pistola de cerrojo), en cualquier tipo que sí los tenga.
 */
export function cycleKind(action: string | undefined, fireMode: string, type: string): string | null {
  if (action === "cerrojo" || fireMode === "bolt") return "cerrojo";
  if (action === "bombeo" || fireMode === "pump") return "bombeo";
  if (action === "revolver_simple") return "martillo";
  if (type === "revolver") return null; // (doble acción: el martillo va con el propio disparo)
  return null;
}
export function cycleSounds(m: SoundManifest, type: string, kind: string): string[] {
  const k = soundType(type), own = k ? m.tipos[k]?.accion?.[kind] : undefined;
  if (own?.length) return own;
  for (const t of Object.values(m.tipos)) if (t.accion?.[kind]?.length) return t.accion[kind];
  return [];
}

/** Todos los archivos de un tipo (para cargarlos de una vez, al equipar un arma de ese tipo). */
export function filesOfType(m: SoundManifest, type: string): string[] {
  const k = soundType(type), t = k ? m.tipos[k] : undefined;
  if (!t) return [];
  const out = [...t.disparo, ...(t.silenciado ?? []), ...(t.grave ?? []), ...(t.lejano ?? []), ...(t.seco ?? []),
    ...(t.recarga ?? []).flatMap((v) => v.pasos.map((p) => p.archivo)), ...Object.values(t.accion ?? {}).flat()];
  return [...new Set(out)];
}
