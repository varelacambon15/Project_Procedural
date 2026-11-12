// Inventario: 2 ranuras equipadas + mochila, créditos y banco de accesorios desmontados (sin límite de ranuras).
import type { WeaponSpec } from "../weapons/types";
import type { AccItem } from "../weapons/accbank";

export interface Item { uid: number; spec: WeaponSpec; ammo: number }
export type Where = { area: "equip" | "pack"; index: number };

let uid = 1;
export const makeItem = (spec: WeaponSpec, ammo = spec.stats.cargador): Item => ({ uid: uid++, spec, ammo });

export class Inventory {
  readonly equip: (Item | null)[] = [null, null];
  readonly pack: (Item | null)[] = Array(18).fill(null);
  /** Accesorios desmontados (solo se consiguen desmontándolos de tus armas). */
  bank: AccItem[] = [];
  credits = 0;
  active = 0;
  private listeners: (() => void)[] = [];

  onChange(fn: () => void) { this.listeners.push(fn); }
  changed() { for (const f of this.listeners) f(); }

  get(w: Where) { return w.area === "equip" ? this.equip[w.index] : this.pack[w.index]; }
  set(w: Where, it: Item | null) { (w.area === "equip" ? this.equip : this.pack)[w.index] = it; }
  get current(): Item | null { return this.equip[this.active]; }
  get full() { return !this.equip.includes(null) && !this.pack.includes(null); }

  /** Añade a la primera ranura libre (equipo primero). Devuelve false si no cabe. */
  add(it: Item): boolean {
    const e = this.equip.indexOf(null);
    if (e >= 0) { this.equip[e] = it; if (!this.equip[this.active]) this.active = e; this.changed(); return true; }
    const p = this.pack.indexOf(null);
    if (p >= 0) { this.pack[p] = it; this.changed(); return true; }
    return false;
  }
  move(from: Where, to: Where) {
    const a = this.get(from), b = this.get(to);
    this.set(to, a); this.set(from, b);
    if (!this.current) { const other = this.equip.findIndex(Boolean); if (other >= 0) this.active = other; }
    this.changed();
  }
  remove(w: Where): Item | null {
    const it = this.get(w); this.set(w, null);
    if (!this.current) { const other = this.equip.findIndex(Boolean); if (other >= 0) this.active = other; }
    this.changed(); return it;
  }
  find(uidToFind: number): Where | null {
    const e = this.equip.findIndex((x) => x?.uid === uidToFind); if (e >= 0) return { area: "equip", index: e };
    const p = this.pack.findIndex((x) => x?.uid === uidToFind); if (p >= 0) return { area: "pack", index: p };
    return null;
  }
  byUid(u: number) { return this.all.find((x) => x.uid === u) ?? null; }
  get all(): Item[] { return [...this.equip, ...this.pack].filter((x): x is Item => !!x); }
  /** Vacía todo (nueva partida o carga). */
  clear() { this.equip.fill(null); this.pack.fill(null); this.bank = []; this.credits = 0; this.active = 0; }
}
