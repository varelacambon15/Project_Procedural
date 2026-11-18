// Inventario: 2 ranuras equipadas + mochila + almacén (solo se usa en su puesto), créditos y banco de accesorios desmontados (sin límite de ranuras).
import type { WeaponSpec } from "../weapons/types";
import type { AccItem } from "../weapons/accbank";

export interface Item { uid: number; spec: WeaponSpec; ammo: number }
export type Area = "equip" | "pack" | "storage";
export type Where = { area: Area; index: number };

let uid = 1;
export const makeItem = (spec: WeaponSpec, ammo = spec.stats.cargador): Item => ({ uid: uid++, spec, ammo });

export class Inventory {
  readonly equip: (Item | null)[] = [null, null];
  readonly pack: (Item | null)[] = Array(18).fill(null);
  /** Almacén: armas guardadas en el puesto del vestíbulo (no se llevan encima). */
  readonly storage: (Item | null)[] = Array(40).fill(null);
  /** Accesorios desmontados (solo se consiguen desmontándolos de tus armas). */
  bank: AccItem[] = [];
  /** Granadas que tienes (hasta 8) y la equipada (−1: ninguna; sin granada equipada no se lanza nada). */
  grenades: import("./grenades").GrenadeSpec[] = [];
  grenadeActive = -1;
  /** Súper elegido en la pestaña Habilidades. */ superId: import("./supers").SuperId = "shockwave";
  /** Súperes desbloqueados con módulos (y modo desarrollador: todos). */ supersOwned: import("./supers").SuperId[] = []; devUnlock = false;
  /** Incursiones completadas (la primera da un módulo seguro). */ raidsDone = 0;
  hasSuper(id: import("./supers").SuperId) { return this.devUnlock || this.supersOwned.includes(id); }
  /** Nivel, experiencia y árbol de habilidades del jugador. */ progress: import("./progress").ProgressState = { level: 1, xp: 0, skills: {} };
  get grenade() { return this.grenades[this.grenadeActive] ?? null; }
  /** Armaduras guardadas (hasta 12) y las que lleva puestas (por ranura, uid). */
  armors: import("./armor").ArmorSpec[] = [];
  worn: Record<import("./armor").ArmorSlot, number | null> = { head: null, torso: null, legs: null };
  wornOf(slot: import("./armor").ArmorSlot) { const u = this.worn[slot]; return u == null ? null : this.armors.find((a) => a.uid === u) ?? null; }
  get wornList() { return (["head", "torso", "legs"] as const).map((s) => this.wornOf(s)); }
  credits = 0;
  active = 0;
  private listeners: (() => void)[] = [];

  onChange(fn: () => void) { this.listeners.push(fn); }
  changed() { for (const f of this.listeners) f(); }

  list(a: Area) { return a === "equip" ? this.equip : a === "pack" ? this.pack : this.storage; }
  get(w: Where) { return this.list(w.area)[w.index]; }
  set(w: Where, it: Item | null) { this.list(w.area)[w.index] = it; }
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
    const s = this.storage.findIndex((x) => x?.uid === uidToFind); if (s >= 0) return { area: "storage", index: s };
    return null;
  }
  byUid(u: number) { return this.all.find((x) => x.uid === u) ?? null; }
  /** Armas que lleva encima (equipadas y mochila). */
  get carried(): Item[] { return [...this.equip, ...this.pack].filter((x): x is Item => !!x); }
  /** Todas, también las del almacén. */
  get all(): Item[] { return [...this.equip, ...this.pack, ...this.storage].filter((x): x is Item => !!x); }
  /** Vacía todo (nueva partida o carga). */
  clear() { this.equip.fill(null); this.pack.fill(null); this.storage.fill(null); this.bank = []; this.credits = 0; this.active = 0; this.grenades = []; this.grenadeActive = -1; this.progress = { level: 1, xp: 0, skills: {} }; this.supersOwned = []; this.raidsDone = 0; this.armors = []; this.worn = { head: null, torso: null, legs: null }; }
}
