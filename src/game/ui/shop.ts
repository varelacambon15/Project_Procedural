// Máquina expendedora (terminal de la simulación): niveles con precio y suelo de rareza, saldo siempre visible,
// confirmación suave, cápsula sellada con revelación corta (saltable) y señal por rareza, e historial reciente.
import { RARITIES } from "../../weapons/generator";
import type { WeaponSpec, RarityId } from "../../weapons/types";
import { t } from "../../i18n";
import { SHOP, buy, machineLevel, odds, record, tiers, type ShopState } from "../shop";
import type { Inventory } from "../inventory";
import { $, esc, keyHint, softConfirm, weaponCard } from "./common";

const color = (r: RarityId) => RARITIES.find((x) => x.id === r)!.color;

export interface ShopHooks {
  close(): void; toast(m: string): void;
  /** Genera el arma comprada (con la rareza que ha salido) y la entrega (mochila o bandeja). Devuelve dónde fue. */
  deliver(rarity: RarityId): { spec: WeaponSpec; where: "pack" | "equip" | "tray" };
  chime(level: number): void;
  equipNow(spec: WeaponSpec): void;
}

export class ShopScreen {
  private el = $("shop");
  isOpen = false;
  private reveal: { t: number; spec: WeaponSpec; where: string; done: boolean } | null = null;

  constructor(private inv: Inventory, private state: () => ShopState, private hooks: ShopHooks) {
    this.el.addEventListener("click", (e) => this.click(e));
  }
  open() { this.isOpen = true; this.el.hidden = false; this.reveal = null; this.render(); }
  close() { if (this.reveal && !this.reveal.done) this.skip(); this.isOpen = false; this.el.hidden = true; this.hooks.close(); }
  back() { if (this.reveal) { if (!this.reveal.done) this.skip(); else { this.reveal = null; this.render(); } return; } this.close(); }

  render() {
    const st = this.state(), cr = this.inv.credits, lv = machineLevel(st);
    $("shop-credits").textContent = `${cr} ${t("unit.cr")}`;
    $("shop-level").textContent = lv.next != null ? t("shop.levelNext", { n: lv.level, c: lv.next }) : t("shop.levelMax", { n: lv.level });
    $("shop-tiers").innerHTML = tiers(st, cr).map((x, i) => {
      const o = odds(x.floor);
      const bars = RARITIES.filter((r) => o[r.id] > 0).map((r) => `<div class="odd"><span style="color:${r.color}">${t(`rarity.${r.id}`)}</span><i style="--w:${(o[r.id] * 100).toFixed(1)}%;--c:${r.color}"></i><b>${(o[r.id] * 100).toFixed(o[r.id] < 0.1 ? 1 : 0)}%</b></div>`).join("");
      const btn = !x.unlocked ? `<button type="button" class="btn ghost" disabled>${t("shop.locked", { c: x.unlock - st.spent })}</button>`
        : !x.affordable ? `<button type="button" class="btn ghost" disabled>${t("shop.short", { c: x.price - cr })}</button>`
        : `<button type="button" class="btn" data-buy="${x.id}" data-confirm="${t("shop.confirm", { c: x.price })}">${t("shop.buy", { c: x.price })}</button>`;
      return `<div class="tier ${x.unlocked ? "" : "locked"}" style="--c:${color(x.floor)}">
        <div class="th"><span class="tn">${t("shop.tier", { n: i + 1 })}</span><span class="tname">${t(`shop.tname.${x.id}`)}</span></div>
        <div class="price"><strong>${x.price}</strong> ${t("unit.cr")}</div>
        <div class="floor">${t("shop.floor")} <b style="color:${color(x.floor)}">${t(`rarity.${x.floor}`)}</b></div>
        <div class="odds">${bars}</div>${btn}</div>`;
    }).join("");
    $("shop-history").innerHTML = st.history.length ? st.history.map((h) => `<li style="--c:${color(h.rarity)}"><b>${esc(h.name)}</b><span>${t(`rarity.${h.rarity}`)} · ${t("shop.tier", { n: SHOP.tiers.findIndex((x) => x.id === h.tier) + 1 })}</span><span>−${h.price} ${t("unit.cr")}</span></li>`).join("") : `<li class="none">${t("shop.noHistory")}</li>`;
    $("shop-reveal").hidden = !this.reveal;
    $("shop-foot").innerHTML = keyHint("Enter", "Ⓐ", t("shop.buyKey")) + keyHint("Esc", "Ⓑ", this.reveal ? t("shop.skip") : t("ui.back"));
  }

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
    const b = target.closest<HTMLElement>("[data-buy]"); if (!b) return;
    if (!softConfirm(b, b.dataset.confirm!)) return;
    const r = buy(this.state(), this.inv.credits, b.dataset.buy!, Math.random);
    if (!r.ok) { this.hooks.toast(t(`shop.err.${r.reason}`)); return; }
    this.inv.credits -= r.price;
    const got = this.hooks.deliver(r.rarity);
    record(this.state(), { tier: b.dataset.buy!, rarity: r.rarity, name: got.spec.customName || got.spec.name, price: r.price, at: Date.now() });
    this.reveal = { t: 0, spec: got.spec, where: got.where, done: false };
    this.render(); this.drawReveal(0);
  }

  /** Avanza la revelación (cápsula sellada → luz de la rareza → ficha). */
  update(dt: number) {
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
    // Durante la revelación la luz pasa por los colores de rareza hasta quedarse en la suya
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

