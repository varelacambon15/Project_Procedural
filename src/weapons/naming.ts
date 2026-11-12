// Renombrar armas: solo cosmético (no toca balance, rareza ni efectos). Se conserva el nombre generado.
import type { WeaponSpec } from "./types";

export const NAME_MAX = 24;
/** Nombre que ve el jugador: el elegido o, si no hay, el generado. */
export const displayName = (w: Pick<WeaponSpec, "name" | "customName">) => w.customName || w.name;

/**
 * Valida un nombre escrito por el jugador. Vacío (o solo espacios) = volver al nombre generado.
 * Quita saltos de línea y caracteres de control, junta espacios y limita la longitud.
 */
export function cleanName(input: string): { ok: true; value: string | null } | { ok: false; error: "tooLong" | "invalid" } {
  const s = input.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return { ok: true, value: null };
  if ([...s].length > NAME_MAX) return { ok: false, error: "tooLong" };
  if (!/^[\p{L}\p{N} .,'’\-_#&!?¡¿()+/:]+$/u.test(s)) return { ok: false, error: "invalid" };
  return { ok: true, value: s };
}
export function rename(w: WeaponSpec, input: string) {
  const r = cleanName(input); if (!r.ok) return r;
  w.customName = r.value && r.value !== w.name ? r.value : null;
  return r;
}
