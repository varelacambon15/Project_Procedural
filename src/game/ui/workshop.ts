// Taller de armas: vista 3D grande (giro y zoom), zonas de accesorio del arma, banco de accesorios desmontados con
// compatibilidad clara, vista previa con estadísticas antes/después, confirmar/cancelar, deshacer y acabado.
// En modo inspección (banco de inspección de la sala) solo se ve el arma y su ficha comparada con la equipada.
import { ACC_KINDS, accZones, attach, canDetach, canMount, detach, mountedAcc, type AccItem, type AccKind } from "../../weapons/accbank";
import { accessory } from "../../weapons/accessories";
import type { WeaponGenerator } from "../../weapons/generator";
import { accName, holdName, paintName } from "../../weapons/labels";
import { gripChoices } from "../../weapons/grip";
import { paints, repaint } from "../../weapons/workshop";
import type { RarityId, WeaponSpec } from "../../weapons/types";
import { RARITIES } from "../../weapons/generator";
import { t } from "../../i18n";
import type { Inventory, Item } from "../inventory";
import { $, keyHint, tileHTML, weaponCard, type ModelView, type Thumbnails } from "./common";

const ORDER = RARITIES.map((r) => r.id);
const color = (r: RarityId) => RARITIES.find((x) => x.id === r)!.color;
interface Pending { spec: WeaponSpec; bank: AccItem[]; label: string }
interface Undo { uid: number; spec: WeaponSpec; bank: AccItem[]; label: string }

export interface WorkshopHooks { close(): void; changed(it: Item): void; rename(it: Item): void; toast(m: string): void }

export class WorkshopScreen {
  private el = $("workbench");
  isOpen = false;
  inspect = false;
  private sel: Item | null = null;
  private pending: Pending | null = null;
  private showBefore = false;
  private undo: Undo[] = [];
  private bankKind: AccKind | "all" = "all";
  private bankSort: "rarity" | "kind" = "rarity";

  constructor(private inv: Inventory, private gen: WeaponGenerator, private view: ModelView, private thumbs: Thumbnails, private hooks: WorkshopHooks) {
    this.el.addEventListener("click", (e) => this.click(e));
    // Agarre libre: la posición de la mano de apoyo se guarda al mover el deslizador
    this.el.addEventListener("input", (e) => {
      const r = e.target as HTMLInputElement; if (!r.dataset.holdat || !this.sel?.spec.hold) return;
      this.sel.spec.hold = { ...this.sel.spec.hold, at: Number(r.value) / 100 };
    });
    this.el.addEventListener("focusin", (e) => this.explain(e.target as HTMLElement));
    this.el.addEventListener("mouseover", (e) => this.explain(e.target as HTMLElement));
  }

  open() {
    this.isOpen = true; this.el.hidden = false; this.pending = null; this.showBefore = false;
    this.sel = this.inv.current ?? this.inv.carried[0] ?? null;
    this.view.attach($("ws-view")); this.view.zoom = 1;
    this.render();
  }
  close() {
    if (this.pending) { this.pending = null; }
    this.isOpen = false; this.el.hidden = true; this.hooks.close();
  }
  /** Ⓑ / Esc: primero cancela la vista previa; si no hay, cierra. */
  back() { if (this.pending) { this.pending = null; this.view.autoSpin = true; this.render(); return; } this.close(); }

  private get shown(): WeaponSpec | null { return this.pending && !this.showBefore ? this.pending.spec : this.sel?.spec ?? null; }

  render() {
    if (!this.isOpen) return;
    const it = this.sel, s = it?.spec;
    this.el.classList.toggle("inspect", this.inspect);
    $("ws-title").textContent = t(this.inspect ? "ui.inspect" : "ui.workbench");
    $("ws-credits").textContent = `${this.inv.credits} ${t("unit.cr")}`;
    $("ws-list").innerHTML = this.inv.carried.map((x) => tileHTML(x, { sel: x === it, small: true, slot: this.inv.find(x.uid)?.area === "equip" ? this.inv.find(x.uid)!.index : null })).join("");
    this.thumbs.fill($("ws-list"), this.inv.carried);
    // Vista y ficha
    const eq = this.inv.current;
    const p = this.pending;
    $("ws-tags").innerHTML = `<span>${t("ui.dragZoom")}</span>${p ? `<span class="pv">${t("ui.preview")}: ${p.label}</span><button type="button" class="chip on" data-act="ab">${this.showBefore ? t("ui.before") : t("ui.after")}</button>` : ""}`;
    $("ws-card").innerHTML = !s ? "" : this.inspect
      ? weaponCard(s, eq && eq !== it ? eq.spec : null, eq && eq !== it ? t("ui.vsEquipped") : t("ui.equippedNow"), { wide: true })
      : p ? weaponCard(p.spec, s, t("ui.afterVsBefore"), { wide: true }) : weaponCard(s, null, "", { wide: true });
    void this.view.show(this.shown);
    // Lado derecho: zonas, banco, acciones
    $("ws-side").innerHTML = !s ? "" : this.inspect ? `${weaponCard(s, eq && eq !== it ? eq.spec : null, eq && eq !== it ? t("ui.vsEquipped") : t("ui.equippedNow"), { wide: true })}<div class="actions"><button type="button" class="btn ghost" data-act="rename">${t("ui.rename")}</button></div>` : this.side(s);
    $("ws-foot").innerHTML = this.inspect ? keyHint("Esc", "Ⓑ", t("ui.back")) + keyHint("R", "Ⓨ", t("ui.rename")) :
      keyHint("Enter", "Ⓐ", t("ui.select")) + keyHint("X", "Ⓧ", t("ui.detach")) + keyHint("Z", "LB", t("ui.undo")) + keyHint("R", "Ⓨ", t("ui.rename")) + keyHint("Tab", "RB", t("ui.beforeAfter")) + keyHint("Esc", "Ⓑ", this.pending ? t("ui.cancel") : t("ui.back"));
  }

  private side(s: WeaponSpec) {
    const zones = accZones(this.gen, s), p = this.pending;
    const zoneRows = ACC_KINDS.map((k) => {
      const has = zones.includes(k), id = mountedAcc(s, k);
      const det = id ? canDetach(this.gen, s, k) : null;
      return `<div class="zone ${has ? "" : "off"}">
        <div class="zh"><b>${t(`zone.${k}`)}</b><small>${t(`socket.${k}`)}</small></div>
        <div class="zv">${!has ? `<span class="why">${t(k === "optic" && s.optic === s.parts[0].from ? "acc.noIntegrated" : `acc.noZone.${k}`)}</span>` : id ? `<span class="acc">${accName(id)}</span><span class="mods">${mods(id)}</span>` : `<span class="empty">${t("ui.emptyZone")}</span>`}</div>
        ${id ? `<button type="button" class="btn ghost sm" data-detach="${k}" ${det!.ok && !p ? "" : "disabled"} title="${det!.ok ? "" : t(det!.reason!)}">${t("ui.detach")}</button>` : ""}
      </div>`;
    }).join("");
    const list = this.inv.bank.filter((a) => this.bankKind === "all" || a.kind === this.bankKind)
      .sort((a, b) => this.bankSort === "rarity" ? ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity) || a.kind.localeCompare(b.kind) : a.kind.localeCompare(b.kind) || ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity));
    const bank = list.map((a) => {
      const f = canMount(this.gen, s, a);
      return `<button type="button" class="bankitem ${f.ok ? "fit" : "nofit"}" data-acc="${a.uid}" data-why="${f.ok ? "" : t(f.reason!)}" style="--c:${color(a.rarity)}" ${p ? "disabled" : ""}>
        <span class="dot"></span><span class="an">${accName(a.id)}</span><span class="ak">${t(`zone.${a.kind}`)}</span>
        <span class="mods">${mods(a.id)}</span><span class="ok">${f.ok ? "✓" : "✕"}</span></button>`;
    }).join("") || `<p class="note">${t(this.inv.bank.length ? "ui.bankNoMatch" : "ui.bankEmpty")}</p>`;
    return `
      <h2>${t("ui.accessories")}</h2>
      <div class="zones">${zoneRows}</div>
      <div class="bankhead"><h2>${t("ui.bank")} <small>${this.inv.bank.length}</small></h2>
        <div class="chips">${(["all", ...ACC_KINDS] as const).map((k) => `<button type="button" class="chip ${this.bankKind === k ? "on" : ""}" data-bk="${k}">${k === "all" ? t("ui.all") : t(`zone.${k}`)}</button>`).join("")}
        <button type="button" class="cyc" data-act="bsort"><span>${t("ui.sortBy")}</span><b>${t(this.bankSort === "rarity" ? "sort.rarity" : "sort.zone")}</b></button></div></div>
      <div class="bank">${bank}</div>
      <p class="why" id="ws-why">${p ? "" : t("ui.bankHelp")}</p>
      <div class="actions">
        ${p ? `<button type="button" class="btn" data-act="confirm">${t("ui.confirm")}</button><button type="button" class="btn ghost" data-act="cancel">${t("ui.cancel")}</button>` : ""}
        <button type="button" class="btn ghost" data-act="undo" ${this.undo.some((u) => u.uid === this.sel?.uid) && !p ? "" : "disabled"}>${t("ui.undo")}</button>
        <button type="button" class="btn ghost" data-act="rename" ${p ? "disabled" : ""}>${t("ui.rename")}</button>
      </div>
      <h2>${t("ui.hold")} <small>${holdName(s)}</small></h2>
      <div class="chips">${gripChoices(s).map((g) => `<button type="button" class="chip ${s.hold?.variant === g.variant ? "on" : ""}" data-hold="${g.variant}" ${p ? "disabled" : ""}>${t(`hold.${g.variant}`)}</button>`).join("")}</div>
      ${s.hold?.variant === "custom" ? `<label class="holdat">${t("ui.holdAt")} <input type="range" min="0" max="100" step="5" value="${Math.round((s.hold.at ?? 0.5) * 100)}" data-holdat="1" ${p ? "disabled" : ""}></label>` : ""}
      <h2>${t("ui.finish")} <small>${paintName(s.paint)}</small></h2>
      <div class="swatches">${paints().map((pt, i) => `<button type="button" class="swatch ${pt.id === s.paint.id ? "on" : ""}" title="${paintName(pt)}" data-paint="${i}" ${p ? "disabled" : ""} style="background:${pt.color ? `rgb(${pt.color.map((c) => Math.round(c * 255)).join(",")})` : "linear-gradient(135deg,#555,#222)"}"></button>`).join("")}</div>`;
  }

  /** Muestra en la línea de ayuda por qué un accesorio no encaja (al pasar por encima o con el foco). */
  private explain(el: HTMLElement) {
    const b = el.closest<HTMLElement>(".bankitem, [data-detach]"); const why = document.getElementById("ws-why"); if (!why || this.pending) return;
    if (!b) return;
    if (b.dataset.why) why.innerHTML = `<span class="down">✕ ${b.dataset.why}</span>`;
    else if (b.classList.contains("bankitem")) why.innerHTML = `<span class="up">✓ ${t("ui.fitsHint")}</span>`;
    else if (b.title) why.innerHTML = `<span class="down">✕ ${b.title}</span>`;
    else why.textContent = t("ui.detachHint");
  }

  private stage(label: string, mutate: (spec: WeaponSpec, bank: AccItem[]) => void) {
    if (!this.sel) return;
    const spec = structuredClone(this.sel.spec), bank = structuredClone(this.inv.bank);
    try { mutate(spec, bank); } catch (e) { this.hooks.toast(t((e as Error).message)); return; }
    this.pending = { spec, bank, label }; this.showBefore = false; this.view.autoSpin = false; this.render();
    this.el.querySelector<HTMLElement>('[data-act="confirm"]')?.focus({ preventScroll: true });
  }
  private commit() {
    const p = this.pending, it = this.sel; if (!p || !it) return;
    this.undo.push({ uid: it.uid, spec: structuredClone(it.spec), bank: structuredClone(this.inv.bank), label: p.label });
    if (this.undo.length > 20) this.undo.shift();
    it.spec = p.spec; this.inv.bank = p.bank; it.ammo = Math.min(it.ammo, it.spec.stats.cargador);
    this.pending = null; this.view.autoSpin = true; this.thumbs.forget(it.uid); this.hooks.changed(it); this.hooks.toast(t("ui.applied", { n: p.label })); this.render();
  }
  private doUndo() {
    const it = this.sel; if (!it) return;
    for (let i = this.undo.length - 1; i >= 0; i--) {
      const u = this.undo[i]; if (u.uid !== it.uid) continue;
      it.spec = u.spec; this.inv.bank = u.bank; this.undo.splice(i, 1);
      this.thumbs.forget(it.uid); this.hooks.changed(it); this.hooks.toast(t("ui.undone", { n: u.label })); this.render(); return;
    }
  }

  private click(e: Event) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-close]")) return this.back();
    const tile = target.closest<HTMLElement>(".tile[data-uid]");
    if (tile) { if (this.pending) return; this.sel = this.inv.byUid(Number(tile.dataset.uid)); this.view.resetYaw = true; return this.render(); }
    const s = this.sel?.spec; if (!s) return;
    const det = target.closest<HTMLElement>("[data-detach]");
    if (det && !this.pending) { const k = det.dataset.detach as AccKind; return this.stage(t("ui.detachLabel", { a: accName(mountedAcc(s, k)!) }), (spec, bank) => { const a = detach(this.gen, spec, k); if (!a) throw new Error("acc.bandLow"); bank.push(a); }); }
    const acc = target.closest<HTMLElement>("[data-acc]");
    if (acc && !this.pending) {
      const a = this.inv.bank.find((x) => x.uid === Number(acc.dataset.acc)); if (!a) return;
      const f = canMount(this.gen, s, a); if (!f.ok) { this.hooks.toast(t(f.reason!)); return; }
      return this.stage(t("ui.mountLabel", { a: accName(a.id) }), (spec, bank) => {
        const i = bank.findIndex((x) => x.uid === a.uid); const [mine] = bank.splice(i, 1);
        const old = attach(this.gen, spec, mine); if (old) bank.push(old);
      });
    }
    const bk = target.closest<HTMLElement>("[data-bk]"); if (bk) { this.bankKind = bk.dataset.bk as AccKind | "all"; this.render(); this.el.querySelector<HTMLElement>(`[data-bk="${this.bankKind}"]`)?.focus({ preventScroll: true }); return; }
    const sw = target.closest<HTMLElement>("[data-paint]");
    if (sw && !this.pending) return this.stage(t("ui.paintLabel", { p: paintName(paints()[Number(sw.dataset.paint)]) }), (spec) => repaint(this.gen, spec, paints()[Number(sw.dataset.paint)]));
    const hb = target.closest<HTMLElement>("[data-hold]");
    if (hb && this.sel && !this.pending) {
      const g = gripChoices(this.sel.spec).find((x) => x.variant === hb.dataset.hold);
      if (g) { this.sel.spec.hold = { ...g, chosen: true, at: g.variant === "custom" ? this.sel.spec.hold?.at ?? 0.5 : undefined }; this.hooks.changed(this.sel); this.render(); this.el.querySelector<HTMLElement>(`[data-hold="${g.variant}"]`)?.focus({ preventScroll: true }); }
      return;
    }
    const act = target.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act) this.action(act);
  }

  action(a: string) {
    if (a === "confirm") this.commit();
    else if (a === "cancel") { this.pending = null; this.view.autoSpin = true; this.render(); }
    else if (a === "undo") this.doUndo();
    else if (a === "ab" && this.pending) { this.showBefore = !this.showBefore; this.render(); }
    else if (a === "bsort") { this.bankSort = this.bankSort === "rarity" ? "kind" : "rarity"; this.render(); }
    else if (a === "rename" && this.sel && !this.pending) this.hooks.rename(this.sel);
  }
  key(code: string) {
    if (code === "KeyZ") { this.action("undo"); return true; }
    if (code === "KeyR") { this.action("rename"); return true; }
    if (code === "Tab") { this.action("ab"); return true; }
    if (code === "KeyX") { const f = document.activeElement?.closest<HTMLElement>("[data-detach]"); f?.click(); return !!f; }
    return false;
  }
  pad(b: number) {
    if (b === 4) { this.action("undo"); return true; }
    if (b === 3) { this.action("rename"); return true; }
    if (b === 5) { this.action("ab"); return true; }
    if (b === 2) { const z = this.el.querySelector<HTMLElement>("[data-detach]:not([disabled])"); z?.click(); return !!z; }
    return false;
  }
}

/** Resumen corto de lo que hace un accesorio (PRE +4 · ALC +3). */
function mods(id: string) {
  const def = accessory(id); if (!def) return "";
  const ab: Record<string, string> = { precision: "stat.short.precision", alcance: "stat.short.alcance", manejo: "stat.short.manejo", cadencia: "stat.short.cadencia", dano: "stat.short.dano", cargador: "stat.short.cargador" };
  const parts = Object.entries(def.mods).map(([k, v]) => `<span class="${(v as number) > 0 ? "up" : "down"}">${t(ab[k])} ${(v as number) > 0 ? "+" : ""}${v}${k === "alcance" || k === "cadencia" || k === "dano" || k === "cargador" ? "%" : ""}</span>`);
  if (def.quiet) parts.push(`<span>${t("acc.quiet")}</span>`);
  if (def.zoom && def.zoom > 1) parts.push(`<span>${def.zoom}×</span>`);
  return parts.join(" ");
}
