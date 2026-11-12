import { KIT_ALIAS } from "./accessories";
// Textos visibles de las armas, traducidos según el idioma elegido.
import { t } from "../i18n";
import { PELLETS } from "./generator";
import type { Effect, Paint, WeaponSpec } from "./types";
import { isKit, kitLabel } from "./kit";

export const rarityName = (s: WeaponSpec) => t(`rarity.${s.rarity.id}`);
export const typeName = (type: string) => t(`type.${type}`);
/** Calibre del revólver generado (ligero, medio, pesado o mágnum) o null. */
export const calName = (s: WeaponSpec) => (s.tweaks?.pistol?.cyl ? t(`cal.${s.tweaks.pistol.cyl.cal}`) : null);
/** Agarre del arma (perfil 05-E). */
export const holdName = (s: WeaponSpec) => (s.hold ? t(`hold.${s.hold.variant}`) : "");
export const archName = (s: WeaponSpec) => (s.modeShift ? t(`shift.${s.modeShift}`) : t(`arch.${s.archetype}`));
export const modeName = (s: WeaponSpec) => t(`mode.${s.fireMode}`) + (s.fireMode === "burst" ? ` ×${s.burst}` : "");
export const effectName = (e: Effect) => t(`fx.${e.id}`);
export const effectDesc = (e: Effect) => t(`fx.${e.id}.d`, { v: e.value ?? "" });
export const paintName = (p: Paint) => t(`paint.${p.id}`);
export const slotName = (slot: string) => t(`slot.${slot}`);
export const roleName = (role: string) => t(`role.${role}`);

/**
 * Nombre de un accesorio para el jugador (sin nombres de los packs ni de modelos reales): el tipo traducido y, si hay
 * varias versiones del mismo, una marca de variante (A/B, I/II) y el calibre de los dispositivos de boca del kit.
 */
export function accName(id: string) {
  if (id.startsWith("acc:")) return t(`acc.${id.slice(4)}`);
  const ALIAS: Record<string, string> = { reddot: "reddot", reflex: "reflex", holographic: "holo", magnified: "acog", scope: "scope6", suppressor: "suppressor-l", foregrip: "foregrip", flashlight: "flashlight", laser: "laser", laserlight: "laserlight" };
  const att = /^k-(?:att|device)-([a-z]+)-(east|west|\d+)$/.exec(id);
  if (att) return `${t(`acc.${ALIAS[att[1]] ?? att[1]}`)} ${att[2] === "east" ? "A" : att[2] === "west" ? "B" : att[2] === "01" ? "I" : "II"}`;
  const md = /^k-muzzledevice-(\w+)-0(\d)$/.exec(id);
  if (md) return `${t(`acc.${(KIT_ALIAS[id] ?? "acc:brake").slice(4)}`)} · ${md[1] === "556" ? "5.56" : md[1]}`;
  if (KIT_ALIAS[id]) return `${t(`acc.${KIT_ALIAS[id].slice(4)}`)} R`;
  return t("acc.factory");
}

/** Nombre de una pieza: accesorio propio (traducido) o modelo del pack. */
export function partLabel(byId: Map<string, { label: string }>, id: string) {
  if (id.startsWith("acc:")) return t(`acc.${id.slice(4)}`);
  if (isKit(id)) return kitLabel(id);
  return (byId.get(id)?.label ?? id).replace("Accessories/", "");
}

/** Daño por disparo con perdigones (×8) o doble cañón (×2). */
export function damageText(s: WeaponSpec) {
  const pellets = (PELLETS[s.type] ?? 1) * (s.effects.some((e) => e.id === "doble") ? 2 : 1);
  return `${Math.round(s.stats.dano)}${pellets > 1 ? `<small> ×${pellets}</small>` : ""}`;
}
