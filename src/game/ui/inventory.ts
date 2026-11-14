// Inventario: rejilla por rareza con filtros y orden, ficha del arma elegida comparada con la equipada y acciones
// (equipar, a la mochila, renombrar, soltar, desguazar con confirmación suave). Teclado, ratón y mando.
import { RARITIES } from "../../weapons/generator";
import { typeName } from "../../weapons/labels";
/** Clase para filtrar: el bullpup va con los fusiles. */
const cls = (t: string) => (t === "bullpup" ? "rifle" : t);
import { accessoriesOf } from "../../weapons/accbank";
import { scrap } from "../../weapons/workshop";
import { t } from "../../i18n";
import type { Inventory, Item } from "../inventory";
import { $, keyHint, softConfirm, tileHTML, weaponCard, type Thumbnails } from "./common";

type Sort = "rarity" | "level" | "damage" | "class" | "era";
const SORTS: Sort[] = ["rarity", "level", "damage", "class", "era"];
const ORDER = RARITIES.map((r) => r.id);
const ERAS = ["all", "classic", "modern", "rustic", "scifi"];

export interface InventoryHooks {
  close(): void; drop(it: Item): void; rename(it: Item): void; toast(m: string): void; changed(it: Item | null): void;
}

export class InventoryScreen {
  private el = $("inventory");
  isOpen = false;
  private sel: number | null = null;
  private filter = { rarity: "all", cls: "all", era: "all" };
  private sort: Sort = "rarity";

  constructor(private inv: Inventory, private thumbs: Thumbnails, private hooks: InventoryHooks) {
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("mouseover", (e) => { const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile"); if (tile && document.body.classList.contains("pad")) this.select(Number(tile.dataset.uid)); });
    this.el.addEventListener("focusin", (e) => { const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile"); if (tile) this.select(Number(tile.dataset.uid), false); });
    this.el.addEventListener("contextmenu", (e) => { e.preventDefault(); const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile"); if (tile) { this.select(Number(tile.dataset.uid)); this.quickEquip(); } });
    inv.onChange(() => { if (this.isOpen) this.render(); });
    this.dragAndDrop();
  }

  /** Arrastrar armas: entre las dos ranuras equipadas, a la mochila o a la zona de soltar (cae al suelo). */
  private dragAndDrop() {
    let dragged: number | null = null;
    const target = (e: DragEvent) => (e.target as HTMLElement).closest<HTMLElement>("[data-eqslot], [data-packzone], [data-dropzone], [data-storezone]");
    this.el.addEventListener("dragstart", (e) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-uid]"); if (!tile) return;
      dragged = Number(tile.dataset.uid); this.select(dragged, false);
      e.dataTransfer?.setData("text/plain", String(dragged)); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      this.el.classList.add("dragging");
    });
    this.el.addEventListener("dragend", () => { dragged = null; this.el.classList.remove("dragging"); this.el.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); });
    this.el.addEventListener("dragover", (e) => {
      const t = target(e); if (dragged == null || !t) return;
      e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      this.el.querySelectorAll(".over").forEach((x) => x !== t && x.classList.remove("over")); t.classList.add("over");
    });
    this.el.addEventListener("dragleave", (e) => { const t = target(e); if (t && !t.contains(e.relatedTarget as Node)) t.classList.remove("over"); });
    this.el.addEventListener("drop", (e) => {
      const t = target(e); if (dragged == null || !t) return;
      e.preventDefault();
      const it = this.inv.byUid(dragged), from = it && this.inv.find(it.uid); dragged = null;
      this.el.classList.remove("dragging");
      if (!it || !from) return;
      if (t.dataset.dropzone != null) return this.action("drop");
      if (t.dataset.eqslot != null) {
        const slot = Number(t.dataset.eqslot);
        if (from.area === "equip" && from.index === slot) return this.render();
        this.inv.move(from, { area: "equip", index: slot }); this.hooks.changed(it); return;
      }
      if (t.dataset.storezone != null && from.area !== "storage") this.action("tostore");
      else if (t.dataset.packzone != null && from.area === "equip") this.action("store");
      else if (t.dataset.packzone != null && from.area === "storage") this.action("fromstore");
      else this.render();
    });
  }

  /** En el puesto de almacén se ve también el almacén (el inventario normal solo enseña lo que llevas encima). */
  storageMode = false;
  open(storage = false) {
    this.storageMode = storage; this.isOpen = true; this.el.hidden = false;
    this.el.classList.toggle("storage-mode", storage);
    this.el.querySelector("h1")!.textContent = t(storage ? "ui.storage" : "ui.inventory");
    const w = this.selected && this.inv.find(this.selected.uid);
    if (!this.selected || (!storage && w?.area === "storage")) this.sel = this.inv.current?.uid ?? this.inv.carried[0]?.uid ?? (storage ? this.inv.all[0]?.uid : null) ?? null;
    this.render();
  }
  close() { this.isOpen = false; this.el.hidden = true; this.el.classList.remove("storage-mode"); this.el.querySelector("h1")!.textContent = t("ui.inventory"); this.hooks.close(); }
  /** Tras quitar el arma elegida: la equipada, o la primera que se vea. */
  private reselect() { this.sel = this.inv.current?.uid ?? (this.storageMode ? this.inv.all : this.inv.carried)[0]?.uid ?? null; }
  get selected() { return this.sel != null ? this.inv.byUid(this.sel) : null; }

  private visible(list: Item[]) {
    const f = this.filter;
    const ok = (it: Item) => (f.rarity === "all" || it.spec.rarity.id === f.rarity) && (f.cls === "all" || cls(it.spec.type) === f.cls) && (f.era === "all" || (it.spec.era ?? "modern") === f.era);
    const key = (it: Item): number | string => {
      const s = it.spec;
      switch (this.sort) {
        case "rarity": return -ORDER.indexOf(s.rarity.id) * 1000 - s.level;
        case "level": return -s.level;
        case "damage": return -s.stats.dano;
        case "class": return s.type;
        case "era": return s.era ?? "modern";
      }
    };
    return list.filter(ok).sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  }

  render() {
    const i = this.inv, it = this.selected, cur = i.current;
    const chips = ["all", ...ORDER].map((r) => `<button type="button" class="chip ${this.filter.rarity === r ? "on" : ""} ${r !== "all" ? `r-${r}` : ""}" data-rar="${r}" style="${r !== "all" ? `--c:${RARITIES.find((x) => x.id === r)!.color}` : ""}">${r === "all" ? t("ui.all") : t(`rarity.${r}`)}</button>`).join("");
    const packItems = this.visible(i.pack.filter((x): x is Item => !!x));
    const free = i.pack.filter((x) => !x).length;
    $("inv-body").innerHTML = `
      <section class="panel list">
        <div class="filters">
          <div class="chips">${chips}</div>
          <div class="cycles">
            <button type="button" class="cyc" data-cyc="cls"><span>${t("ui.class")}</span><b>${this.filter.cls === "all" ? t("ui.all") : typeName(this.filter.cls)}</b></button>
            <button type="button" class="cyc" data-cyc="era"><span>${t("ui.era")}</span><b>${this.filter.era === "all" ? t("ui.all") : t(`era.${this.filter.era}`)}</b></button>
            <button type="button" class="cyc" data-cyc="sort"><span>${t("ui.sortBy")}</span><b>${t(`sort.${this.sort}`)}</b></button>
          </div>
        </div>
        <h2>${t("ui.equipped")}</h2>
        <div class="tiles eq">${i.equip.map((x, k) => `<div class="slotwrap" data-eqslot="${k}">${x ? tileHTML(x, { sel: x.uid === this.sel, slot: k, inHand: k === i.active, dim: !this.visible([x]).length }) : `<div class="tile empty"><span class="slotno">${k + 1}</span>${t("ui.empty")}</div>`}</div>`).join("")}</div>
        <h2>${t("ui.backpack")} <small>${18 - free}/18</small></h2>
        <div class="tiles" data-packzone>${packItems.map((x) => tileHTML(x, { sel: x.uid === this.sel })).join("")}${packItems.length ? "" : `<div class="tile empty wide">${i.pack.some(Boolean) ? t("ui.noMatch") : t("ui.packEmpty")}</div>`}</div>
        <div class="dropzone" data-dropzone>${t("ui.dropZone")}</div>
        ${this.storageMode ? this.storageHTML() : ""}
      </section>
      <section class="panel detail">
        ${it ? weaponCard(it.spec, cur && cur !== it ? cur.spec : null, cur && cur !== it ? t("ui.vsEquipped") : t("ui.equippedNow"), { wide: true }) : `<div class="card empty">${t("ui.noWeapons")}</div>`}
        ${it ? this.actions(it) : ""}
      </section>`;
    $("inv-credits").textContent = `${i.credits} ${t("unit.cr")}`;
    $("inv-foot").innerHTML = `<span>${t("ui.bankCount", { n: i.bank.length })}</span>` +
      keyHint("Enter", "Ⓐ", t("ui.select")) + keyHint("1 / 2", "LB / RB", t("ui.equipSlot")) + keyHint("R", "Ⓨ", t("ui.rename")) + keyHint("G", "RS", t("ui.drop")) + keyHint("X", "Ⓧ", t("ui.scrapAction")) + keyHint("Esc", "Ⓑ", t("ui.back"));
    this.el.querySelectorAll<HTMLElement>(".tile[data-uid]").forEach((x) => { x.draggable = true; });
    this.thumbs.fill(this.el, this.storageMode ? i.all : i.carried);
  }

  private storageHTML() {
    const items = this.visible(this.inv.storage.filter((x): x is Item => !!x)), used = this.inv.storage.filter(Boolean).length;
    return `<h2>${t("ui.storage")} <small>${used}/${this.inv.storage.length}</small></h2>
      <div class="tiles store" data-storezone>${items.map((x) => tileHTML(x, { sel: x.uid === this.sel })).join("")}${items.length ? "" : `<div class="tile empty wide">${used ? t("ui.noMatch") : t("ui.storageEmpty")}</div>`}</div>`;
  }

  private actions(it: Item) {
    const where = this.inv.find(it.uid)!, inPack = where.area === "pack";
    if (where.area === "storage") return `<div class="actions">
      <button type="button" class="btn" data-act="fromstore" ${this.inv.pack.includes(null) ? "" : "disabled"}>${t("ui.toPack")}</button>
      <button type="button" class="btn" data-act="eq0">${t("ui.equipTo", { n: 1 })}</button><button type="button" class="btn" data-act="eq1">${t("ui.equipTo", { n: 2 })}</button>
      <button type="button" class="btn ghost" data-act="rename">${t("ui.rename")}</button>
    </div>`;
    const value = scrap(it.spec).scrap, acc = accessoriesOf(it.spec).length;
    const lastWeapon = this.inv.all.length <= 1;
    return `<div class="actions">
      ${inPack ? `<button type="button" class="btn" data-act="eq0">${t("ui.equipTo", { n: 1 })}</button><button type="button" class="btn" data-act="eq1">${t("ui.equipTo", { n: 2 })}</button>`
        : `<button type="button" class="btn" data-act="use" ${where.index === this.inv.active ? "disabled" : ""}>${t("ui.useNow")}</button><button type="button" class="btn ghost" data-act="store" ${this.inv.pack.includes(null) ? "" : "disabled"}>${t("ui.toPack")}</button>`}
      ${this.storageMode ? `<button type="button" class="btn" data-act="tostore" ${this.inv.storage.includes(null) ? "" : "disabled"}>${t("ui.toStorage")}</button>` : ""}
      <button type="button" class="btn ghost" data-act="rename">${t("ui.rename")}</button>
      <button type="button" class="btn ghost" data-act="drop">${t("ui.drop")}</button>
      <button type="button" class="btn danger" data-act="scrap" ${lastWeapon ? "disabled" : ""} data-confirm="${t("ui.scrapConfirm", { s: value, a: acc })}">${t("ui.scrapFor", { s: value })}</button>
    </div>${acc ? `<p class="note">${t("ui.scrapKeepsAcc", { n: acc })}</p>` : ""}`;
  }

  private select(uid: number, rerender = true) {
    if (this.sel === uid) return;
    this.sel = uid;
    if (rerender) { const f = document.activeElement as HTMLElement | null; const keep = f?.closest<HTMLElement>(".tile")?.dataset.uid; this.render(); if (keep) this.el.querySelector<HTMLElement>(`.tile[data-uid="${keep}"]`)?.focus({ preventScroll: true }); }
    else this.renderDetail();
  }
  private renderDetail() {
    const it = this.selected, cur = this.inv.current;
    this.el.querySelectorAll(".tile.sel").forEach((x) => x.classList.remove("sel"));
    if (it) this.el.querySelector(`.tile[data-uid="${it.uid}"]`)?.classList.add("sel");
    const d = this.el.querySelector(".detail"); if (!d) return;
    d.innerHTML = it ? weaponCard(it.spec, cur && cur !== it ? cur.spec : null, cur && cur !== it ? t("ui.vsEquipped") : t("ui.equippedNow"), { wide: true }) + this.actions(it) : "";
  }

  private click(e: Event) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-close]")) return this.close();
    const tile = target.closest<HTMLElement>(".tile[data-uid]");
    if (tile) return this.select(Number(tile.dataset.uid));
    const chip = target.closest<HTMLElement>("[data-rar]");
    if (chip) { this.filter.rarity = chip.dataset.rar!; return this.renderKeep(chip); }
    const cyc = target.closest<HTMLElement>("[data-cyc]");
    if (cyc) {
      const k = cyc.dataset.cyc!;
      if (k === "sort") this.sort = SORTS[(SORTS.indexOf(this.sort) + 1) % SORTS.length];
      else if (k === "cls") { const cl = ["all", ...new Set(this.inv.all.map((x) => cls(x.spec.type)))]; this.filter.cls = cl[(cl.indexOf(this.filter.cls) + 1) % cl.length]; }
      else this.filter.era = ERAS[(ERAS.indexOf(this.filter.era) + 1) % ERAS.length];
      return this.renderKeep(cyc);
    }
    const act = target.closest<HTMLElement>("[data-act]");
    if (act) this.action(act.dataset.act!, act);
  }
  private renderKeep(el: HTMLElement) {
    const sel = el.dataset.rar ? `[data-rar="${el.dataset.rar}"]` : `[data-cyc="${el.dataset.cyc}"]`;
    this.render(); this.el.querySelector<HTMLElement>(sel)?.focus({ preventScroll: true });
  }

  /** Acción sobre el arma elegida (también desde atajos de teclado y mando). */
  action(a: string, btn?: HTMLElement) {
    const it = this.selected; if (!it) return;
    const where = this.inv.find(it.uid); if (!where) return;
    if (a === "eq0" || a === "eq1") { const slot = a === "eq0" ? 0 : 1; this.inv.move(where, { area: "equip", index: slot }); this.inv.active = slot; this.inv.changed(); this.hooks.changed(it); return; }
    if (a === "use" && where.area === "equip") { this.inv.active = where.index; this.inv.changed(); return; }
    if (a === "store" && where.area === "equip") { const free = this.inv.pack.indexOf(null); if (free < 0) return this.hooks.toast(t("ui.packFull")); this.inv.move(where, { area: "pack", index: free }); return; }
    if (a === "tostore" && where.area !== "storage") { if (!this.storageMode) return; const free = this.inv.storage.indexOf(null); if (free < 0) return this.hooks.toast(t("ui.storageFull")); this.inv.move(where, { area: "storage", index: free }); if (where.area === "equip") this.hooks.changed(null); return; }
    if (a === "fromstore" && where.area === "storage") { const free = this.inv.pack.indexOf(null); if (free < 0) return this.hooks.toast(t("ui.packFull")); this.inv.move(where, { area: "pack", index: free }); return; }
    if (where.area === "storage" && (a === "drop" || a === "scrap" || a === "use" || a === "store")) return;
    if (a === "rename") return this.hooks.rename(it);
    if (a === "drop") { this.inv.remove(where); this.hooks.drop(it); this.reselect(); this.render(); return; }
    if (a === "scrap") {
      if (this.inv.all.length <= 1) return;
      const b = btn ?? this.el.querySelector<HTMLElement>('[data-act="scrap"]');
      if (b && !softConfirm(b, b.dataset.confirm!)) return;
      const r = scrap(it.spec), acc = accessoriesOf(it.spec);
      this.inv.credits += r.scrap; this.inv.bank.push(...acc); this.inv.remove(where);
      this.hooks.toast(t(acc.length ? "ui.scrappedAcc" : "ui.scrappedCr", { s: r.scrap, a: acc.length }));
      this.reselect(); this.hooks.changed(null); this.render();
    }
  }
  /** Clic derecho / atajo: equipar en la ranura activa o guardar en la mochila. */
  quickEquip() {
    const it = this.selected; if (!it) return; const w = this.inv.find(it.uid)!;
    this.action(w.area === "storage" ? "fromstore" : w.area === "pack" ? (this.storageMode ? "tostore" : this.inv.active === 0 ? "eq0" : "eq1") : "store");
  }
  key(code: string) {
    const map: Record<string, string> = { Digit1: "eq0", Digit2: "eq1", KeyR: "rename", KeyG: "drop", KeyX: "scrap" };
    if (map[code]) { this.action(map[code]); return true; }
    return false;
  }
  pad(b: number) {
    const map: Record<number, string> = { 4: "eq0", 5: "eq1", 3: "rename", 11: "drop", 2: "scrap" };
    if (map[b]) { this.action(map[b]); return true; }
    return false;
  }
}
