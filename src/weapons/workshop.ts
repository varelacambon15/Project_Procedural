// Banco de trabajo: piezas sueltas, compatibilidad, montaje/desmontaje y desguace (lógica pura).
import { PAINTS, type WeaponGenerator } from "./generator";
import type { Paint, PartRole, WeaponSpec } from "./types";

/** Pieza suelta guardada en la caja de piezas. */
export interface PartItem { uid: number; role: PartRole; from: string; barrelLength?: number }
/** Ranuras personalizables en el banco. */
export type Slot = "magazine" | "scope" | "muzzle" | "slide" | "frame" | "barrel";

export const SLOT_NAME: Record<Slot, string> = { magazine: "Cargador", scope: "Mira", muzzle: "Boca", slide: "Corredera", frame: "Armazón", barrel: "Cañón" };

let nextUid = 1;
export const newPart = (role: PartRole, from: string, barrelLength?: number): PartItem => ({ uid: nextUid++, role, from, barrelLength });

/** Ranuras que tiene un arma concreta. */
export function slotsOf(gen: WeaponGenerator, w: WeaponSpec): Slot[] {
  if (w.layout === "modular-pistol") return ["slide", "frame", "barrel", "muzzle"];
  const body = gen.byId.get(w.parts[0].from)!;
  const out: Slot[] = [];
  if (body.sockets.magazine) out.push("magazine");
  if (body.sockets.optic) out.push("scope");
  if (w.type !== "launcher" && w.type !== "flamethrower") out.push("muzzle");
  return out;
}

/** Pieza montada ahora en una ranura (o null si está vacía). */
export function mounted(w: WeaponSpec, slot: Slot): PartItem | null {
  if (slot === "scope") return w.optic ? { uid: 0, role: "scope", from: w.optic } : null;
  if (slot === "muzzle") return w.muzzle ? { uid: 0, role: "muzzle", from: w.muzzle } : null;
  const p = w.parts.find((x) => x.role === slot);
  return p ? { uid: 0, role: p.role, from: p.from, barrelLength: slot === "barrel" ? w.barrelLength : undefined } : null;
}

/** ¿Encaja esta pieza en esta ranura de esta arma? */
export function fits(gen: WeaponGenerator, w: WeaponSpec, slot: Slot, part: PartItem): boolean {
  if (part.role !== slot) return false;
  const src = gen.byId.get(part.from);
  if (!src) return false;
  switch (slot) {
    case "magazine": return src.type === w.type && !!src.sockets.magazine;
    case "scope": return !!src.sockets.optic;
    case "muzzle": return src.type === "accessory";
    default: return w.layout === "modular-pistol" && src.parts.some((p) => p.role === slot);
  }
}

/** Una ranura se puede dejar vacía (mira y boca) o solo intercambiar (el resto es imprescindible). */
export const removable = (slot: Slot) => slot === "scope" || slot === "muzzle";

/**
 * Monta `part` en la ranura (o la vacía si es null). Devuelve la pieza que se quitó, que va a la caja.
 * Modifica `w` y recalcula sus estadísticas.
 */
export function swap(gen: WeaponGenerator, w: WeaponSpec, slot: Slot, part: PartItem | null): PartItem | null {
  if (part && !fits(gen, w, slot, part)) throw new Error("La pieza no encaja");
  if (!part && !removable(slot)) throw new Error("Esta pieza no se puede quitar");
  const old = mounted(w, slot);
  if (slot === "scope") w.optic = part?.from ?? null;
  else if (slot === "muzzle") w.muzzle = part?.from ?? null;
  else {
    const i = w.parts.findIndex((x) => x.role === slot);
    if (i >= 0 && part) w.parts[i] = { role: slot, from: part.from };
    else if (part) w.parts.push({ role: slot, from: part.from });
    if (slot === "barrel" && part) w.barrelLength = part.barrelLength ?? 1;
  }
  gen.refresh(w);
  return old ? newPart(old.role, old.from, old.barrelLength) : null;
}

export function repaint(gen: WeaponGenerator, w: WeaponSpec, paint: Paint) { w.paint = paint; gen.refresh(w); }
export const paints = (): Paint[] => PAINTS.filter((p, i, a) => a.findIndex((q) => q.name === p.name) === i);

/** Desguaza un arma: devuelve sus piezas reutilizables y la chatarra que se obtiene del cuerpo. */
export function scrap(w: WeaponSpec): { parts: PartItem[]; scrap: number } {
  const parts: PartItem[] = [];
  for (const p of w.parts) if (p.role !== "body") parts.push(newPart(p.role, p.from, p.role === "barrel" ? w.barrelLength : undefined));
  if (w.optic) parts.push(newPart("scope", w.optic));
  if (w.muzzle) parts.push(newPart("muzzle", w.muzzle));
  const scrapValue = { comun: 5, poco: 10, rara: 20, epica: 40, legendaria: 80 }[w.rarity.id];
  return { parts, scrap: scrapValue };
}
