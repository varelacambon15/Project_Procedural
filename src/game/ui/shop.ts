// Tienda (terminal de la simulación), prompt 05-D: escaparate de 5 armas (imagen fija de cada una, ficha completa
// con comparación al elegirla, se renueva cada cierto tiempo de juego con contador; cada arma se vende una vez) y dos
// cajas (común y avanzada) con probabilidades a la vista, garantía de la avanzada, confirmación suave, revelación
// corta y saltable con señal por rareza, e historial. Si te quedas sin armas, un arma básica gratis (nunca sin salida).
import { RARITIES, type WeaponGenerator } from "../../weapons/generator";
import type { WeaponSpec, RarityId } from "../../weapons/types";
import { t } from "../../i18n";
import { CRATES, SHOP, SHOWCASE, buyShowcase, crateOdds, ensureShowcase, openCrate, pityLeft, record, showcasePrice, showcaseRarities, showcaseSeed, type CrateId, type ShopState } from "../shop";
import type { Inventory, Item } from "../inventory";
import { $, esc, keyHint, softConfirm, weaponCard, type Thumbnails } from "./common";

const color = (r: RarityId) => RARITIES.find((x) => x.id === r)!.color;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface ShopHooks {
  close(): void; toast(m: string): void;
  /** Genera el arma de una caja (con la rareza que ha salido) y la entrega (mochila o bandeja). Devuelve dónde fue. */
  deliver(rarity: RarityId): { spec: WeaponSpec; where: "pack" | "equip" | "tray" };
  /** Entrega un arma ya hecha (escaparate, arma básica). */
  deliverSpec(spec: WeaponSpec): { spec: WeaponSpec; where: "pack" | "equip" | "tray" };
  chime(level: number): void;
  equipNow(spec: WeaponSpec): void;
  /** Reloj del escaparate: tiempo de juego (se pausa con el juego y se guarda). */
  gameTime(): number;
}

export class ShopScreen {
  private el = $("shop");
  isOpen = false;
  private reveal: { t: number; spec: WeaponSpec; where: string; done: boolean } | null = null;
  private sel = -1;
  private stock: { key: string; specs: WeaponSpec[] } | null = null;
  private timerAcc = 0;

  constructor(private inv: Inventory, private state: () => ShopState, private hooks: ShopHooks, private gen: WeaponGenerator, private thumbs: Thumbnails) {
    this.el.addEventListener("click", (e) => this.click(e));
  }
  open() { this.isOpen = true; this.el.hidden = false; this.reveal = null; this.render(); }
  close() { if (this.reveal && !this.reveal.done) this.skip(); this.isOpen = false; this.el.hidden = true; this.hooks.close(); }
  back() { if (this.reveal) { if (!this.reveal.done) this.skip(); else { this.reveal = null; this.render(); } return; } this.close(); }

  /** Armas del escaparate de la ronda actual (deterministas: misma semilla y ronda, mismas armas). */
  private showcase() {
    const sc = ensureShowcase(this.state(), this.hooks.gameTime());
    const key = `${sc.seed}:${sc.round}`;
    if (this.stock?.key !== key) {
      this.stock = { key, specs: showcaseRarities(sc).map((r, i) => this.gen.generate(showcaseSeed(sc, i), undefined, r)) };
      this.sel = -1;
    }
    return { sc, specs: this.stock.specs };
  }

  render() {
    const st = this.state(), cr = this.inv.credits;
    const { sc, specs } = this.showcase();
    $("shop-credits").textContent = `${cr} ${t("unit.cr")}`;
    $("shop-level").textContent = "";
    const tiles = specs.map((s, i) => {
      const price = showcasePrice(s.rarity.id, s.level), sold = sc.sold[i];
      const btn = sold ? `<span class="soldtag">${t("shop.soldOut")}</span>`
        : cr < price ? `<button type="button" class="btn ghost sm" disabled>${t("shop.short", { c: price - cr })}</button>`
        : `<button type="button" class="btn sm" data-buyslot="${i}" data-confirm="${t("shop.confirm", { c: price })}">${t("shop.buy", { c: price })}</button>`;
      return `<div class="sc-tile ${sold ? "sold" : ""} ${this.sel === i ? "sel" : ""}" data-slot="${i}" style="--c:${s.rarity.color}">
        <div class="img"><img data-thumb="${i}" alt=""></div>
        <b class="nm">${esc(s.name)}</b><span class="meta">${t(`rarity.${s.rarity.id}`)} · ${t(`type.${s.type}`)} · ${t("label.level")} ${s.level}</span>
        <div class="price"><strong>${price}</strong> ${t("unit.cr")}</div>${btn}</div>`;
    }).join("");
    const crates = (["common", "advanced"] as CrateId[]).map((id) => {
      const c = CRATES[id], o = crateOdds(id);
      const bars = RARITIES.filter((r) => o[r.id] > 0).map((r) => `<div class="odd"><span style="color:${r.color}">${t(`rarity.${r.id}`)}</span><i style="--w:${(o[r.id] * 100).toFixed(1)}%;--c:${r.color}"></i><b>${(o[r.id] * 100).toFixed(o[r.id] < 0.1 ? 1 : 0)}%</b></div>`).join("");
      const btn = cr < c.price ? `<button type="button" class="btn ghost" disabled>${t("shop.short", { c: c.price - cr })}</button>`
        : `<button type="button" class="btn" data-crate="${id}" data-confirm="${t("shop.confirm", { c: c.price })}">${t("shop.open", { c: c.price })}</button>`;
      const top = id === "common" ? "poco" : "rara";
      return `<div class="tier crate" style="--c:${color(top)}">
        <div class="th"><span class="tn">${t("shop.crate")}</span><span class="tname">${t(`shop.crate.${id}`)}</span></div>
        <div class="price"><strong>${c.price}</strong> ${t("unit.cr")}</div>
        <div class="floor">${t("shop.floor")} <b style="color:${color(top)}">${t(`rarity.${top}`)}</b>${id === "advanced" ? ` · ${t("shop.pity", { n: pityLeft(st) })}` : ""}</div>
        <div class="odds">${bars}</div>${btn}</div>`;
    }).join("");
    const basic = this.inv.all.length === 0 ? `<button type="button" class="btn" data-basic="1">${t("shop.basic")}</button>` : "";
    const detail = this.sel >= 0 ? weaponCard(specs[this.sel], this.inv.current?.spec ?? null, this.inv.current ? t("ui.compared") : "") : `<p class="hint-sel">${t("shop.pick")}</p>`;
    $("shop-tiers").innerHTML = `<div class="sc-head"><h2>${t("shop.showcase")}</h2><span class="timer">${t("shop.refreshIn", { t: mmss(Math.max(0, sc.refreshAt - this.hooks.gameTime())) })}</span>${basic}</div>
      <div class="sc-row">${tiles}</div><div class="crates">${crates}</div>`;
    $("shop-detail").innerHTML = detail;
    // Imagen fija de cada arma del escaparate (miniatura; se cachea por semilla, ronda y ranura)
    specs.forEach((s, i) => {
      const it = { uid: -((sc.seed % 100000) * 1000 + (sc.round % 100) * 10 + i + 1), spec: s } as unknown as Item;
      void this.thumbs.get(it).then((url) => { const img = this.el.querySelector<HTMLImageElement>(`img[data-thumb="${i}"]`); if (img && this.stock?.specs[i] === s) img.src = url; }).catch(() => undefined);
    });
    $("shop-history").innerHTML = st.history.length ? st.history.map((h) => `<li style="--c:${color(h.rarity)}"><b>${esc(h.name)}</b><span>${t(`rarity.${h.rarity}`)} · ${this.source(h.tier)}</span><span>−${h.price} ${t("unit.cr")}</span></li>`).join("") : `<li class="none">${t("shop.noHistory")}</li>`;
    $("shop-reveal").hidden = !this.reveal;
    $("shop-foot").innerHTML = keyHint("Enter", "Ⓐ", t("shop.buyKey")) + keyHint("Esc", "Ⓑ", this.reveal ? t("shop.skip") : t("ui.back"));
  }
  private source(tier: string) { return tier.startsWith("crate:") ? t(`shop.crate.${tier.slice(6)}`) : tier.startsWith("shop:") ? t("shop.showcase") : t("shop.tier", { n: SHOP.tiers.findIndex((x) => x.id === tier) + 1 }); }

  private click(e: Event) {
    const target = e.target as HTMLElement;
    if (this.reveal) {
      if (!this.reveal.done) { this.skip(); return; }
      const a = target.closest<HTMLElement>("[data-act]")?.dataset.act;
      if (a === "equip") { this.hooks.equipNow(this.reveal.spec); this.reveal = null; this.render(); }
      else if (a === "ok") { this.reveal = null; this.render(); }
      return;
    }
    if (target.closest("[data-close]")) return this.close();
    if (target.closest("[data-basic]")) {
      // Sin armas: una básica gratis (el juego nunca se queda sin salida)
      const got = this.hooks.deliverSpec(this.gen.generate(Math.floor(Math.random() * 1e9), undefined, "comun"));
      this.show(got, true); return;
    }
    const slotBtn = target.closest<HTMLElement>("[data-buyslot]");
    if (slotBtn) {
      if (!softConfirm(slotBtn, slotBtn.dataset.confirm!)) return;
      const i = Number(slotBtn.dataset.buyslot), { sc, specs } = this.showcase(), spec = specs[i];
      const r = buyShowcase(sc, this.inv.credits, i, showcasePrice(spec.rarity.id, spec.level));
      if (!r.ok) { this.hooks.toast(t(`shop.err.${r.reason}`)); return; }
      this.inv.credits -= r.price;
      const got = this.hooks.deliverSpec(structuredClone(spec));
      record(this.state(), { tier: `shop:${i}`, rarity: spec.rarity.id, name: spec.name, price: r.price, at: Date.now() });
      this.show(got, true); return;
    }
    const crateBtn = target.closest<HTMLElement>("[data-crate]");
    if (crateBtn) {
      if (!softConfirm(crateBtn, crateBtn.dataset.confirm!)) return;
      const id = crateBtn.dataset.crate as CrateId;
      const r = openCrate(this.state(), this.inv.credits, id, Math.random);
      if (!r.ok) { this.hooks.toast(t(`shop.err.${r.reason}`)); return; }
      this.inv.credits -= r.price; this.state().spent += r.price;
      const got = this.hooks.deliver(r.rarity);
      record(this.state(), { tier: `crate:${id}`, rarity: r.rarity, name: got.spec.customName || got.spec.name, price: r.price, at: Date.now() });
      this.show(got, false); return;
    }
    const tile = target.closest<HTMLElement>("[data-slot]");
    if (tile) { this.sel = Number(tile.dataset.slot); this.render(); }
  }
  /** Muestra lo conseguido: las cajas con revelación corta (saltable); el escaparate, directo. */
  private show(got: { spec: WeaponSpec; where: string }, direct: boolean) {
    this.reveal = { t: 0, spec: got.spec, where: got.where, done: false };
    this.render();
    if (direct) this.finish(); else this.drawReveal(0);
  }

  /** Avanza la revelación (cápsula sellada → luz de la rareza → ficha) y el contador del escaparate. */
  update(dt: number) {
    this.timerAcc += dt;
    if (this.timerAcc >= 1 && !this.reveal) { this.timerAcc = 0; this.render(); }
    const r = this.reveal; if (!r || r.done) return;
    r.t += dt; this.drawReveal(r.t);
    if (r.t >= SHOP.revealSeconds) this.finish();
  }
  skip() { if (this.reveal && !this.reveal.done) this.finish(); }
  private finish() {
    const r = this.reveal!; r.done = true;
    const lvl = RARITIES.findIndex((x) => x.id === r.spec.rarity.id); this.hooks.chime(lvl);
    this.drawReveal(SHOP.revealSeconds);
  }
  private drawReveal(time: number) {
    const r = this.reveal; if (!r) return;
    const k = Math.min(1, time / SHOP.revealSeconds), el = $("shop-reveal");
    const c = r.spec.rarity.color;
    const cycle = RARITIES[Math.min(RARITIES.length - 1, Math.floor((time * 9) % RARITIES.length))].color;
    el.style.setProperty("--c", r.done ? c : k > 0.75 ? c : cycle);
    el.classList.toggle("open", r.done);
    el.innerHTML = r.done
      ? `<div class="capsule open"><i></i></div><div class="result">${weaponCard(r.spec, this.inv.current?.spec ?? null, t("shop.got"), { wide: true })}
          <p class="note">${t(`shop.where.${r.where}`)}</p>
          <div class="actions">${r.where !== "tray" ? `<button type="button" class="btn" data-act="equip">${t("shop.equipNow")}</button>` : ""}<button type="button" class="btn ghost" data-act="ok">${t("ui.continue")}</button></div></div>`
      : `<div class="capsule" style="--k:${k.toFixed(3)}"><i></i><span>${t("shop.sealed")}</span></div><p class="skip">${t("shop.skipHint")}</p>`;
    if (r.done) el.querySelector<HTMLElement>("[data-act]")?.focus({ preventScroll: true });
  }
}
export const SHOWCASE_SIZE = SHOWCASE.slots.length;
