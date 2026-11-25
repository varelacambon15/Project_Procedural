import { KIT_ALIAS } from "./accessories";
// Textos visibles de las armas, traducidos según el idioma elegido.
import { getLang, t } from "../i18n";
import { effectDef } from "./effects";
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
/** Nombre de un efecto: los escritos a mano por su clave; las recetas por su nombre propio (B y L) o por plantilla (A). */
export function effectName(e: Effect): string {
  const d = effectDef(e.id); const r = d?.recipe;
  if (!r) return t(`fx.${e.id}`);
  if (d.names) return d.names[getLang() === "es" ? "es" : "en"];
  const cond = t(`rc.cond.${r.cond}`, { n: r.n ?? 4, c: r.chance ?? 30 });
  const name = t("rc.name", { S: t(`rc.Stat.${r.stat}`), c: cond }).trim();
  return r.risky ? t("rc.risky", { n: name }) : name;
}
const DOWN = new Set(["spread", "recoil", "reload"]);
/** Lo que da el efecto (en la ficha, en verde). */
export function effectDesc(e: Effect): string {
  const d = effectDef(e.id); const r = d?.recipe;
  if (!r) return t(`fx.${e.id}.d`, { v: e.value ?? "" });
  const pct = (x: number) => Math.round(x * 100);
  const cond = t(`rc.cond.${r.cond}`, { n: r.n ?? 4, c: r.chance ?? 30 });
  const statTxt = r.stat ? t(DOWN.has(r.stat) ? "rc.down" : "rc.up", { v: r.value, s: t(`rc.stat.${r.stat}`) }) : "";
  let main: string;
  if (r.action === "stat") main = `${statTxt}${cond ? ` ${cond}` : ""}`;
  else if (r.action === "buff") main = `${r.trigger === "onShot" ? "" : t(`rc.trig.${r.trigger}`) + ": "}${t("rc.buff", { b: statTxt, d: r.duration ?? 4 })}${r.cond === "afterkill" || r.cond === "afterreload" ? ` ${cond}` : ""}`;
  else {
    const act = t(`rc.act.${r.action}`, { p: pct(r.value), n: r.targets ?? 3, r: r.radius ?? 4, v: r.value });
    const when = r.cond === "nth" || r.cond === "chance" || r.cond === "killnth" || r.cond === "hitnth" ? cond : t(`rc.trig.${r.trigger}`);
    main = when ? `${when.charAt(0).toUpperCase()}${when.slice(1)}: ${act}` : act;
  }
  return d.element ? `${t(`rc.el.${d.element}`)} · ${main}` : main;
}
/** La contrapartida del efecto (en la ficha, en rojo), o "" si no tiene. */
export function effectCost(e: Effect): string {
  const d = effectDef(e.id); const tr = d?.recipe?.tradeoff;
  const parts: string[] = [];
  if (tr) parts.push(t(`rc.tr.${tr.kind}`, { v: tr.value }));
  if (d?.element === "electrico" || d?.element === "explosive") parts.push(t("rc.tr.element"));
  return parts.join(" · ");
}
export const paintName = (p: Paint) => t(`paint.${p.id}`);
export const slotName = (slot: string) => t(`slot.${slot}`);
export const roleName = (role: string) => t(`role.${role}`);

/**
 * Nombre de un accesorio para el jugador (sin nombres de los packs ni de modelos reales): el tipo traducido y, si hay
 * varias versiones del mismo, una marca de variante (A/B, I/II) y el calibre de los dispositivos de boca del kit.
 */
export function accName(id: string) {
  if (id.startsWith("acc:")) return t(`acc.${id.slice(4)}`);
  if (id.startsWith("pa-")) return t(`acc.${id}`);
  if (id.startsWith("iron:")) return t("acc.iron");
  const ALIAS: Record<string, string> = { reddot: "reddot", reflex: "reflex", holographic: "holo", magnified: "acog", scope: "scope6", suppressor: "suppressor-l", foregrip: "foregrip", flashlight: "flashlight", laser: "laser", laserlight: "laserlight" };
  const att = /^k-(?:att|device)-([a-z]+)-(east|west|\d+)$/.exec(id);
  if (att) return `${t(`acc.${ALIAS[att[1]] ?? att[1]}`)} ${att[2] === "east" ? "A" : att[2] === "west" ? "B" : att[2] === "01" ? "I" : "II"}`;
  const md = /^k-muzzledevice-(\w+)-0(\d)$/.exec(id);
  if (md) return `${t(`acc.${(KIT_ALIAS[id] ?? "acc:brake").slice(4)}`)} · ${md[1] === "556" ? "5.56" : md[1]}`;
  if (KIT_ALIAS[id]) return `${t(`acc.${KIT_ALIAS[id].slice(4)}`)} R`;
  // Piezas de la biblioteca y de los packs del usuario (k-att-<tipo>-l…, k-device-foregrip-l…, k-bipod-l…): el tipo
  const lib = /^k-(?:att|device|bipod)-?([a-z]*)-l/.exec(id);
  if (lib) return id.startsWith("k-bipod") ? t("acc.bipod") : t(`acc.${ALIAS[lib[1]] ?? lib[1]}`);
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
