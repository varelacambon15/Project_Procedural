// Inventario: 2 ranuras equipadas + mochila, caja de piezas sueltas y chatarra.
import type { WeaponSpec } from "../weapons/types";
import type { PartItem } from "../weapons/workshop";

export interface Item { uid: number; spec: WeaponSpec; ammo: number }
export type Where = { area: "equip" | "pack"; index: number };

let uid = 1;
export const makeItem = (spec: WeaponSpec): Item => ({ uid: uid++, spec, ammo: spec.stats.cargador });

export class Inventory {
  readonly equip: (Item | null)[] = [null, null];
  readonly pack: (Item | null)[] = Array(18).fill(null);
  parts: PartItem[] = [];
  scrap = 0;
  active = 0;
  private listeners: (() => void)[] = [];

  onChange(fn: () => void) { this.listeners.push(fn); }
  changed() { for (const f of this.listeners) f(); }

  get(w: Where) { return w.area === "equip" ? this.equip[w.index] : this.pack[w.index]; }
  set(w: Where, it: Item | null) { (w.area === "equip" ? this.equip : this.pack)[w.index] = it; }
  get current(): Item | null { return this.equip[this.active]; }

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
  remove(w: Where): Item | null { const it = this.get(w); this.set(w, null); this.changed(); return it; }
  find(uidToFind: number): Where | null {
    const e = this.equip.findIndex((x) => x?.uid === uidToFind); if (e >= 0) return { area: "equip", index: e };
    const p = this.pack.findIndex((x) => x?.uid === uidToFind); if (p >= 0) return { area: "pack", index: p };
    return null;
  }
  get all(): Item[] { return [...this.equip, ...this.pack].filter((x): x is Item => !!x); }
}
