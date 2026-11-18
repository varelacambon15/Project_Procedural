// Inventario: rejilla por rareza con filtros y orden, ficha del arma elegida comparada con la equipada y acciones
// (equipar, a la mochila, renombrar, soltar, desguazar con confirmación suave). Teclado, ratón y mando.
import { type GrenadeSpec } from "../grenades";
import { SUPERS, SUPER_IDS, type SuperId } from "../supers";
import { BRANCHES, SKILLS, branchPoints, canRaise, pointsFree, raise, rank, respec, respecCost, xpToNext, MAX_LEVEL } from "../progress";
import { fillNadeThumbs } from "./shop";
import { armorCard, armorTile, grenadeCard, grenadeTile } from "./common";
import { ARMOR_RARITY } from "../armor";
import { fillArmorThumbs } from "../armormodel";
import type { ArmorSpec } from "../armor";
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
  /** Soltar una granada al suelo (delante del jugador). */ dropNade(g: GrenadeSpec): void;
  /** Ha cambiado el árbol de habilidades (aplicar sus efectos). */ perks?(): void;
  /** Armaduras: se ha puesto o quitado una pieza; soltar una al suelo. */ armorChanged?(): void; dropArmor?(a: ArmorSpec): void;
}

export class InventoryScreen {
  private el = $("inventory");
  isOpen = false;
  private sel: number | null = null;
  /** Granada elegida (uid), en lugar de un arma. */ private selNade: number | null = null;
  private filter = { rarity: "all", cls: "all", era: "all" };
  private sort: Sort = "rarity";
  /** Pestaña: equipo (armas y granadas) o habilidades (súper). */ private tab: "gear" | "armor" | "skills" | "tree" = "gear";

  constructor(private inv: Inventory, private thumbs: Thumbnails, private hooks: InventoryHooks) {
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("mouseover", (e) => { const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-uid]"); if (tile && document.body.classList.contains("pad")) this.select(Number(tile.dataset.uid)); });
    this.el.addEventListener("focusin", (e) => { const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-uid]"); if (tile) this.select(Number(tile.dataset.uid), false); });
    this.el.addEventListener("contextmenu", (e) => { e.preventDefault(); const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-uid]"); if (tile) { this.select(Number(tile.dataset.uid)); this.quickEquip(); } });
    inv.onChange(() => { if (this.isOpen) this.render(); });
    this.dragAndDrop();
  }

  /** Arrastrar armas: entre las dos ranuras equipadas, a la mochila o a la zona de soltar (cae al suelo). */
  private dragAndDrop() {
    let dragged: number | null = null;
    let draggedNade: number | null = null;
    const target = (e: DragEvent) => (e.target as HTMLElement).closest<HTMLElement>(draggedNade != null ? "[data-nadeslot], [data-packzone], [data-dropzone]" : "[data-eqslot], [data-packzone], [data-dropzone], [data-storezone]");
    this.el.addEventListener("dragstart", (e) => {
      // Granadas: a su ranura (equipar), a la mochila (quitar) o a la zona de soltar
      const nt = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-nade]");
      if (nt) { draggedNade = Number(nt.dataset.nade); this.selNade = draggedNade; this.sel = null; // (sin redibujar: se cancelaría el arrastre)
        e.dataTransfer?.setData("text/plain", "nade"); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; this.el.classList.add("dragging"); return; }
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".tile[data-uid]"); if (!tile) return;
      dragged = Number(tile.dataset.uid); this.select(dragged, false);
      e.dataTransfer?.setData("text/plain", String(dragged)); if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
      this.el.classList.add("dragging");
    });
    this.el.addEventListener("dragend", () => { dragged = null; draggedNade = null; this.el.classList.remove("dragging"); this.el.querySelectorAll(".over").forEach((x) => x.classList.remove("over")); });
    this.el.addEventListener("dragover", (e) => {
      const t = target(e); if ((dragged == null && draggedNade == null) || !t) return;
      e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      this.el.querySelectorAll(".over").forEach((x) => x !== t && x.classList.remove("over")); t.classList.add("over");
    });
    this.el.addEventListener("dragleave", (e) => { const t = target(e); if (t && !t.contains(e.relatedTarget as Node)) t.classList.remove("over"); });
    this.el.addEventListener("drop", (e) => {
      const t = target(e);
      if (draggedNade != null && t) {
        e.preventDefault(); const uid = draggedNade; draggedNade = null; this.el.classList.remove("dragging");
        const k = this.inv.grenades.findIndex((g) => g.uid === uid); if (k < 0) return this.render();
        if (t.dataset.nadeslot != null) this.inv.grenadeActive = k;
        else if (t.dataset.dropzone != null) return this.nadeAction("drop");
        else if (t.dataset.packzone != null && this.inv.grenadeActive === k) this.inv.grenadeActive = -1;
        return this.render();
      }
      if (dragged == null || !t) return;
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
    this.storageMode = storage; this.isOpen = true; this.el.hidden = false; if (storage) this.tab = "gear";
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

  private static GLYPH: Record<SuperId, string> = { overload: "⟐", shockwave: "◎", storm: "ϟ", inferno: "♨", stasis: "❄", orbital: "⊕", seekers: "⁂", aegis: "⬡", deadeye: "◉", vortex: "@", sentry: "⊤", zerog: "⇡", chrono: "⧗", leech: "♥", decoy: "♙" };
  /** Parámetros de la descripción de un súper. */
  private static spArgs(id: SuperId) { const s = SUPERS[id]; return { s: Math.round((s.slow ?? 1) * 100), h: Math.round((s.heal ?? 0) * 100), a: s.active ?? 0, d: s.damage ?? 0, r: s.radius ?? 0, n: s.count ?? 0, g: Math.round((1 - (s.guard ?? 1)) * 100), v: Math.round(((s.vuln ?? 1) - 1) * 100), c: Math.round(((s.crit ?? 1) - 1) * 100) }; }
  /** Pestaña Progreso: nivel, experiencia y árbol de habilidades (tres ramas). */
  private renderTree() {
    const p = this.inv.progress, free = pointsFree(p), need = xpToNext(p.level), cost = respecCost(p);
    const node = (b: string, n: (typeof SKILLS)["gunner"][number]) => {
      const r = rank(p, n.id), ok = canRaise(p, n.id), locked = (n.req ?? 0) > branchPoints(p, b as "gunner");
      return `<button type="button" class="tile skillnode ${r >= n.max ? "maxed" : ""} ${locked ? "locked" : ""}" data-skill="${n.id}" data-nav ${ok ? "" : "aria-disabled=\"true\""}>
        <span class="nm">${t(`pg.s.${n.id}`)}</span><span class="lbl">${t(`pg.d.${n.id}`, { v: Math.round(n.per * 1000) / 10 })}</span>
        <span class="rk">${locked ? t("pg.req", { n: n.req ?? 0 }) : `${r} / ${n.max}`}</span></button>`;
    };
    $("inv-body").innerHTML = `
      <section class="panel tree"><h2>${t("pg.lv")} ${p.level}${p.level >= MAX_LEVEL ? ` · ${t("pg.max")}` : ` · ${p.xp} / ${need} XP`}</h2>
        <p class="note">${t("pg.points", { n: free })}</p>
        <div class="branches">${BRANCHES.map((b) => `<div class="branch"><h3>${t(`pg.b.${b}`)} <small>${branchPoints(p, b)}</small></h3>${SKILLS[b].map((n) => node(b, n)).join("")}</div>`).join("")}</div>
        <div class="actions"><button type="button" class="btn ghost sm" data-respec="1" ${cost && this.inv.credits >= cost ? "" : "disabled"}>${t("pg.respec", { c: cost })}</button></div>
        <p class="note">${t("pg.how")}</p></section>`;
    $("inv-credits").textContent = `${this.inv.credits} ${t("unit.cr")}`;
    $("inv-foot").innerHTML = keyHint("Enter", "Ⓐ", t("pg.raise")) + keyHint("Esc", "Ⓑ", t("ui.back"));
  }
  /** Súper que se está mirando (puede estar bloqueado). */ private spView: SuperId | null = null;
  /** Pestaña Habilidades: los súperes; elegir uno desbloqueado lo equipa (los bloqueados se ven, pero hace falta su módulo). */
  private renderSkills() {
    const eq = this.inv.superId, sel = this.spView ?? eq, have = this.inv.hasSuper(sel), n = SUPER_IDS.filter((id) => this.inv.hasSuper(id)).length;
    $("inv-body").innerHTML = `
      <section class="panel list"><h2>${t("sp.title")}</h2>
        <p class="note">${t("sp.owned", { n, of: SUPER_IDS.length })}</p>
        <div class="tiles skills">${SUPER_IDS.map((id) => { const own = this.inv.hasSuper(id); return `<button type="button" class="tile skill ${id === sel ? "sel" : ""} ${own ? "" : "locked"}" data-super="${id}" data-nav><span class="glyph">${own ? InventoryScreen.GLYPH[id] : "🔒"}</span><span class="lbl">${own && id === eq && this.inv.hasSuper(eq) ? "✓ " + t("sp.equipped") : own ? t("sp.super") : t("sp.locked")}</span><span class="nm">${t(`sp.${id}`)}</span></button>`; }).join("")}</div>
        <p class="note">${t("sp.how")}</p></section>
      <section class="panel detail"><div class="card"><div class="skillbig">${InventoryScreen.GLYPH[sel]}</div><span class="lbl">${t("sp.super")}</span><div class="nm">${t(`sp.${sel}`)}</div>
        <p class="note">${t(`sp.d.${sel}`, InventoryScreen.spArgs(sel))}</p>${have ? "" : `<p class="note warn">${t("sp.needModule")}</p>`}</div></section>`;
    $("inv-credits").textContent = `${this.inv.credits} ${t("unit.cr")}`;
    $("inv-foot").innerHTML = keyHint("Enter", "Ⓐ", t("sp.equip")) + keyHint("Esc", "Ⓑ", t("ui.back"));
  }
  private renderTabs() {
    const el = $("inv-tabs"); el.hidden = this.storageMode;
    el.innerHTML = (InventoryScreen.TABS).map((k) => `<button type="button" class="chip ${this.tab === k ? "on" : ""}" data-tab="${k}">${t(`sp.tab.${k}`)}</button>`).join("");
  }

  render() {
    this.renderTabs();
    if (this.tab === "skills" && !this.storageMode) return this.renderSkills();
    if (this.tab === "tree" && !this.storageMode) return this.renderTree();
    if (this.tab === "armor" && !this.storageMode) return this.renderArmor();
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
        <div class="tiles eq">${i.equip.map((x, k) => `<div class="slotwrap" data-eqslot="${k}">${x ? tileHTML(x, { sel: x.uid === this.sel, slot: k, inHand: k === i.active, dim: !this.visible([x]).length }) : `<div class="tile empty"><span class="slotno">${k + 1}</span>${t("ui.empty")}</div>`}</div>`).join("")}
          <div class="slotwrap" data-nadeslot>${i.grenade ? this.nadeTileHTML(i.grenade, true) : `<div class="tile empty"><span class="slotno">G</span>${t("gr.slot")}</div>`}</div></div>

        <h2>${t("ui.backpack")} <small>${18 - free}/18</small></h2>
        <div class="tiles" data-packzone>${packItems.map((x) => tileHTML(x, { sel: x.uid === this.sel })).join("")}${i.grenades.filter((g) => g !== i.grenade).map((g) => this.nadeTileHTML(g, false)).join("")}${packItems.length || i.grenades.length > (i.grenade ? 1 : 0) ? "" : `<div class="tile empty wide">${i.pack.some(Boolean) ? t("ui.noMatch") : t("ui.packEmpty")}</div>`}</div>
        <div class="dropzone" data-dropzone>${t("ui.dropZone")}</div>
        ${this.storageMode ? this.storageHTML() : ""}
      </section>
      <section class="panel detail">
        ${this.armorSel ? this.armorCardHTML(this.armorSel) : this.nadeSel ? this.nadeCard(this.nadeSel) : it ? weaponCard(it.spec, cur && cur !== it ? cur.spec : null, cur && cur !== it ? t("ui.vsEquipped") : t("ui.equippedNow"), { wide: true }) : `<div class="card empty">${t("ui.noWeapons")}</div>`}
        ${this.nadeSel || this.armorSel ? "" : it ? this.actions(it) : ""}
      </section>`;
    $("inv-credits").textContent = `${i.credits} ${t("unit.cr")}`;
    $("inv-foot").innerHTML = `<span>${t("ui.bankCount", { n: i.bank.length })}</span>` +
      keyHint("Enter", "Ⓐ", t("ui.select")) + keyHint("1 / 2", "LB / RB", t("ui.equipSlot")) + keyHint("R", "Ⓨ", t("ui.rename")) + keyHint("G", "RS", t("ui.drop")) + keyHint("X", "Ⓧ", t("ui.scrapAction")) + keyHint("Esc", "Ⓑ", t("ui.back"));
    this.el.querySelectorAll<HTMLElement>(".tile[data-uid]").forEach((x) => { x.draggable = true; });
    this.thumbs.fill(this.el, this.storageMode ? i.all : i.carried);
    fillNadeThumbs(this.el); fillArmorThumbs(this.el);
  }
  static readonly TABS = ["gear", "armor", "skills", "tree"] as const;
  /** Pestaña Armadura: silueta holográfica con las tres ranuras apiladas al lado; debajo, las piezas guardadas. */
  private renderArmor() {
    const i = this.inv, sel = this.armorSel, col = (sl: "head" | "torso" | "legs") => { const a = i.wornOf(sl); return a ? ARMOR_RARITY[a.rarity].color : "transparent"; };
    const holo = `<svg class="holo" viewBox="0 0 120 260" aria-hidden="true">
      <g class="hb">
        <circle cx="60" cy="30" r="20" style="--f:${col("head")}"/>
        <path d="M30 58 Q60 50 90 58 L96 128 Q60 138 24 128 Z" style="--f:${col("torso")}"/>
        <path d="M24 64 L10 126 L18 128 L32 80 Z M96 64 L110 126 L102 128 L88 80 Z" class="arm"/>
        <path d="M30 134 L56 136 L54 246 L36 246 Z M64 136 L90 134 L84 246 L66 246 Z" style="--f:${col("legs")}"/>
      </g><line class="scan" x1="0" x2="120" y1="0" y2="0"/></svg>`;
    const slot = (sl: "head" | "torso" | "legs") => { const a = i.wornOf(sl); return `<div class="slotwrap">${a ? armorTile(a, { sel: this.selArmor === a.uid, slot: t(`ar.key.${sl}`), attrs: `data-armor="${a.uid}"` }) : `<div class="tile empty"><span class="slotno">${t(`ar.key.${sl}`)}</span>${t(`ar.slot.${sl}`)}</div>`}</div>`; };
    const bag = i.armors.filter((a) => !i.wornList.includes(a));
    const tot = i.wornList.reduce((s2, a) => s2 + (a?.reduction ?? 0), 0);
    $("inv-body").innerHTML = `
      <section class="panel list armorpanel"><h2>${t("ar.title")} <small>${Math.round(Math.min(0.6, tot) * 1000) / 10} % ${t("ar.short")}</small></h2>
        <div class="armor-rig">${holo}<div class="armor-slots">${slot("head")}${slot("torso")}${slot("legs")}</div></div>
        <h2>${t("ar.stored")} <small>${i.armors.length}/12</small></h2>
        <div class="tiles">${bag.map((a) => armorTile(a, { sel: this.selArmor === a.uid, attrs: `data-armor="${a.uid}"` })).join("") || `<div class="tile empty wide">${t("ar.none")}</div>`}</div>
      </section>
      <section class="panel detail">${sel ? this.armorCardHTML(sel) : `<div class="card empty">${t("ar.pick")}</div>`}</section>`;
    fillArmorThumbs(this.el);
    $("inv-credits").textContent = `${i.credits} ${t("unit.cr")}`;
    $("inv-foot").innerHTML = keyHint("Enter", "Ⓐ", t("ui.select")) + keyHint("Q / E", "LB / RB", t("ui.tabs")) + keyHint("Esc", "Ⓑ", t("ui.back"));
  }
  /** Cambiar de pestaña (LB / RB en el mando). */
  cycleTab(d: number) {
    if (this.storageMode) return;
    const T = InventoryScreen.TABS, k = (T.indexOf(this.tab) + d + T.length) % T.length; this.tab = T[k]; this.render();
    this.el.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`)?.focus({ preventScroll: true });
  }
  /** Armadura elegida (uid). */ private selArmor: number | null = null;
  private get armorSel() { return this.selArmor == null ? null : this.inv.armors.find((a) => a.uid === this.selArmor) ?? null; }
  private armorCardHTML(a: ArmorSpec) {
    const worn = this.inv.worn[a.slot] === a.uid, other = this.inv.wornOf(a.slot);
    return `${armorCard(a, worn ? t("ui.equippedNow") : other ? t("ui.vsEquipped") : "", worn ? null : other)}
      <div class="actions"><button type="button" class="btn" data-aact="eq">${worn ? t("ar.unequip") : t("ar.equip")}</button><button type="button" class="btn ghost" data-aact="drop">${t("ui.drop")}</button></div>
      <p class="note">${t("ar.sellAtShop")}</p>`;
  }

  private get nadeSel() { return this.selNade == null ? null : this.inv.grenades.find((g) => g.uid === this.selNade) ?? null; }
  /** Ficha de granada con el estilo de las armas (foto, rareza, tipo, daño y datos). */
  private nadeTileHTML(g: GrenadeSpec, equipped: boolean) {
    return grenadeTile(g, { sel: this.selNade === g.uid, slot: equipped ? "G" : "", attrs: `data-nade="${g.uid}" draggable="true"` });
  }
  private nadeCard(g: GrenadeSpec) {
    const eq = this.inv.grenade === g;
    return `${grenadeCard(g, eq ? t("ui.equippedNow") : "", eq ? null : this.inv.grenade)}
      <div class="actions"><button type="button" class="btn" data-nact="eq">${eq ? t("gr.unequip") : t("gr.equip")}</button><button type="button" class="btn ghost" data-nact="drop">${t("ui.drop")}</button></div>
      <p class="note">${t("gr.sellAtShop")}</p>`;
  }
  private selectNade(uid: number) { this.selNade = uid; this.sel = null; this.selArmor = null; this.render(); }
  private nadeAction(a: string) {
    const g = this.nadeSel; if (!g) return;
    const k = this.inv.grenades.indexOf(g);
    if (a === "eq") this.inv.grenadeActive = this.inv.grenadeActive === k ? -1 : k;
    if (a === "drop") { this.inv.grenades.splice(k, 1); if (this.inv.grenadeActive === k) this.inv.grenadeActive = -1; else if (this.inv.grenadeActive > k) this.inv.grenadeActive--; this.selNade = null; this.hooks.dropNade(g); }
    this.render();
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
    if (this.selNade != null || this.selArmor != null) { this.selNade = null; this.selArmor = null; this.sel = null; }
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
    const tb = target.closest<HTMLElement>("[data-tab]");
    if (tb) { this.tab = tb.dataset.tab as InventoryScreen["tab"]; this.render(); return this.el.querySelector<HTMLElement>(`[data-tab="${this.tab}"]`)?.focus({ preventScroll: true }); }
    const sk = target.closest<HTMLElement>("[data-skill]");
    if (sk) { if (raise(this.inv.progress, sk.dataset.skill!)) this.hooks.perks?.(); this.render(); return this.el.querySelector<HTMLElement>(`[data-skill="${sk.dataset.skill}"]`)?.focus({ preventScroll: true }); }
    if (target.closest("[data-respec]")) { const c = respecCost(this.inv.progress); if (c && this.inv.credits >= c) { this.inv.credits -= c; respec(this.inv.progress); this.hooks.perks?.(); this.hooks.toast(t("pg.respecDone")); } return this.render(); }
    const sp = target.closest<HTMLElement>("[data-super]");
    if (sp) { const id = sp.dataset.super as SuperId; this.spView = id; if (this.inv.hasSuper(id)) { this.inv.superId = id; this.spView = null; } this.render(); return this.el.querySelector<HTMLElement>(`[data-super="${this.inv.superId}"]`)?.focus({ preventScroll: true }); }
    const at = target.closest<HTMLElement>(".tile[data-armor]");
    if (at) { this.selArmor = Number(at.dataset.armor); this.selNade = null; this.sel = null; this.render(); return; }
    const aa = target.closest<HTMLElement>("[data-aact]");
    if (aa && this.armorSel) {
      const a = this.armorSel;
      if (aa.dataset.aact === "eq") this.inv.worn[a.slot] = this.inv.worn[a.slot] === a.uid ? null : a.uid;
      else { if (this.inv.worn[a.slot] === a.uid) this.inv.worn[a.slot] = null; this.inv.armors.splice(this.inv.armors.indexOf(a), 1); this.selArmor = null; this.hooks.dropArmor?.(a); }
      this.hooks.armorChanged?.(); this.render(); return;
    }
    const nt = target.closest<HTMLElement>(".tile[data-nade]");
    if (nt) return this.selectNade(Number(nt.dataset.nade));
    const na = target.closest<HTMLElement>("[data-nact]");
    if (na) return this.nadeAction(na.dataset.nact!);
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
    if (code === "KeyQ" || code === "KeyE") { this.cycleTab(code === "KeyQ" ? -1 : 1); return true; }
    const map: Record<string, string> = { Digit1: "eq0", Digit2: "eq1", KeyR: "rename", KeyG: "drop", KeyX: "scrap" };
    if (map[code]) { this.action(map[code]); return true; }
    return false;
  }
  pad(b: number) {
    // LB / RB: pestaña anterior / siguiente (Equipo, Armadura, Habilidades, Progreso)
    if (b === 4 || b === 5) { this.cycleTab(b === 4 ? -1 : 1); return true; }
    const map: Record<number, string> = { 3: "rename", 11: "drop", 2: "scrap" };
    if (map[b]) { this.action(map[b]); return true; }
    return false;
  }
}
