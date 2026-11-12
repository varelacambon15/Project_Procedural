// Banco de trabajo: piezas sueltas, compatibilidad, montaje/desmontaje y desguace (lógica pura).
import { PAINTS, jointScale, longGunOk, type WeaponGenerator } from "./generator";
import { accessory } from "./accessories";
import type { Paint, PartRole, WeaponSpec } from "./types";

/** Pieza suelta guardada en la caja de piezas. `from` es un arma del manifest o un accesorio ("acc:…"). */
export interface PartItem { uid: number; role: PartRole; from: string; barrelLength?: number }
/** Ranuras personalizables en el banco. */
export type Slot = "magazine" | "scope" | "muzzle" | "slide" | "frame" | "barrel" | "stock" | "grip" | "front";

let nextUid = 1;
export const newPart = (role: PartRole, from: string, barrelLength?: number): PartItem => ({ uid: nextUid++, role, from, barrelLength });

/** Ranuras que tiene un arma concreta. */
export function slotsOf(gen: WeaponGenerator, w: WeaponSpec): Slot[] {
  if (w.layout === "modular-pistol") return ["slide", "frame", "barrel", "muzzle"];
  if (w.layout === "modular-long") {
    const out: Slot[] = ["stock", "grip", "front", "magazine"];
    if (gen.opticOptions(w).length) out.push("scope");
    if (gen.muzzleOptions(w.type, w.parts[0].from).length) out.push("muzzle");
    return out;
  }
  const body = gen.byId.get(w.parts[0].from)!;
  const out: Slot[] = [];
  if (body.sockets.magazine) out.push("magazine");
  if (body.parts.some((p) => p.role === "scope") || gen.opticOptions(w).length) out.push("scope");
  if (gen.muzzleOptions(w.type, w.parts[0].from).length) out.push("muzzle");
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
  const acc = accessory(part.from);
  if (slot === "muzzle") return !!acc && acc.kind === "muzzle" && gen.muzzleOptions(w.type, w.parts[0].from).includes(part.from);
  if (slot === "scope") {
    if (acc) return acc.kind === "optic" && gen.opticOptions(w).includes(part.from);
    const body = gen.byId.get(w.parts[0].from)!;
    const src = gen.byId.get(part.from);
    return !!src?.sockets.optic && body.parts.some((p) => p.role === "scope");
  }
  const src = gen.byId.get(part.from);
  if (!src) return false;
  if (slot === "magazine") return src.type === w.type && !!src.sockets.magazine;
  if (slot === "stock" || slot === "grip" || slot === "front") {
    // Misma familia, junta compatible y la puerta de calidad del conjunto
    const recv = gen.byId.get(w.parts[0].from)!;
    if (w.layout !== "modular-long" || !src.modular || src.pack !== recv.pack) return false;
    const cur = (role: string) => gen.byId.get(w.parts.find((p) => p.role === role)!.from)!;
    const next = { stock: cur("stock"), grip: cur("grip"), front: cur("front"), [slot]: src };
    const joint = slot === "stock" ? "rear" : slot;
    const k = jointScale(recv, src, joint);
    return k > 0.75 && k < 1.35 && longGunOk(recv, next.stock, next.front, next.grip, w.type, w.tweaks);
  }
  return w.layout === "modular-pistol" && src.parts.some((p) => p.role === slot);
}

/** Mira y boca se pueden dejar vacías; el resto solo se intercambia. */
export const removable = (slot: Slot) => slot === "scope" || slot === "muzzle";

/** Monta `part` en la ranura (o la vacía si es null). Devuelve la pieza retirada, que va a la caja. */
export function swap(gen: WeaponGenerator, w: WeaponSpec, slot: Slot, part: PartItem | null): PartItem | null {
  if (part && !fits(gen, w, slot, part)) throw new Error("Part does not fit");
  if (!part && !removable(slot)) throw new Error("This part cannot be removed");
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
  // La mira integrada de un cuerpo no es una pieza suelta: al quitarla no va a la caja.
  if (old && slot === "scope" && old.from === w.parts[0].from) return null;
  return old ? newPart(old.role, old.from, old.barrelLength) : null;
}

export function repaint(gen: WeaponGenerator, w: WeaponSpec, paint: Paint) { w.paint = paint; gen.refresh(w); }
export const paints = (): Paint[] => PAINTS;

/** Desguaza un arma: devuelve sus piezas reutilizables y la chatarra que se obtiene del cuerpo. */
export function scrap(w: WeaponSpec): { parts: PartItem[]; scrap: number } {
  const parts: PartItem[] = [];
  for (const p of w.parts) if (p.role !== "body" && p.role !== "receiver") parts.push(newPart(p.role, p.from, p.role === "barrel" ? w.barrelLength : undefined));
  if (w.optic && w.optic !== w.parts[0].from) parts.push(newPart("scope", w.optic));
  if (w.muzzle) parts.push(newPart("muzzle", w.muzzle));
  const scrapValue = { comun: 5, poco: 10, rara: 20, epica: 40, legendaria: 80 }[w.rarity.id];
  return { parts, scrap: scrapValue };
}
