// Textos visibles de las armas, traducidos según el idioma elegido.
import { t } from "../i18n";
import { PELLETS } from "./generator";
import type { Effect, Paint, WeaponSpec } from "./types";

export const rarityName = (s: WeaponSpec) => t(`rarity.${s.rarity.id}`);
export const typeName = (type: string) => t(`type.${type}`);
export const archName = (s: WeaponSpec) => (s.modeShift ? t(`shift.${s.modeShift}`) : t(`arch.${s.archetype}`));
export const modeName = (s: WeaponSpec) => t(`mode.${s.fireMode}`) + (s.fireMode === "burst" ? ` ×${s.burst}` : "");
export const effectName = (e: Effect) => t(`fx.${e.id}`);
export const effectDesc = (e: Effect) => t(`fx.${e.id}.d`, { v: e.value ?? "" });
export const paintName = (p: Paint) => t(`paint.${p.id}`);
export const slotName = (slot: string) => t(`slot.${slot}`);
export const roleName = (role: string) => t(`role.${role}`);

/** Nombre de una pieza: accesorio propio (traducido) o modelo del pack. */
export function partLabel(byId: Map<string, { label: string }>, id: string) {
  if (id.startsWith("acc:")) return t(`acc.${id.slice(4)}`);
  return (byId.get(id)?.label ?? id).replace("Accessories/", "");
}

/** Daño por disparo con perdigones (×8) o doble cañón (×2). */
export function damageText(s: WeaponSpec) {
  const pellets = (PELLETS[s.type] ?? 1) * (s.effects.some((e) => e.id === "doble") ? 2 : 1);
  return `${Math.round(s.stats.dano)}${pellets > 1 ? `<small> ×${pellets}</small>` : ""}`;
}
