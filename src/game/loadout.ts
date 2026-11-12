// Equipo inicial de una partida nueva (lógica pura, sin dibujo).
// Antes se buscaba "la primera semilla que diera un arma blanca o verde" con un bucle sin límite: si un cambio del
// generador hacía que no saliera nunca (pasó con las pistolas modulares), el juego se colgaba al arrancar. Ahora la
// rareza se fija directamente y cualquier búsqueda lleva un tope de reintentos.
import type { BaseType, WeaponGenerator } from "../weapons/generator";
import type { WeaponSpec } from "../weapons/types";

/** Tope de reintentos de cualquier búsqueda de este tipo. */
export const MAX_TRIES = 200;

/** Primera semilla desde `seed0` cuya arma cumple `ok`, con tope; si no aparece, la de `seed0` (nunca se cuelga). */
export function findWeapon(gen: WeaponGenerator, type: BaseType, seed0: number, ok: (w: WeaponSpec) => boolean, max = MAX_TRIES): WeaponSpec {
  for (let s = seed0; s < seed0 + max; s++) { const w = gen.generate(s, type); if (ok(w)) return w; }
  return gen.generate(seed0, type);
}

/** Pistola y fusil equipados; escopeta y subfusil en la mochila. Blancas y verdes, sin accesorios sueltos. */
export function starterWeapons(gen: WeaponGenerator): WeaponSpec[] {
  return ([["pistol", 11, "comun"], ["rifle", 40, "poco"], ["shotgun", 70, "comun"], ["smg", 90, "poco"]] as [BaseType, number, "comun" | "poco"][])
    .map(([type, seed, rar]) => gen.generate(seed, type, rar));
}
