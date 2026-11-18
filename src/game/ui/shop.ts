// Tienda (terminal de la simulación), prompt 05-D: escaparate de 5 armas (imagen fija de cada una, ficha completa
// con comparación al elegirla, se renueva cada cierto tiempo de juego con contador; cada arma se vende una vez) y dos
// cajas (común y avanzada) con probabilidades a la vista, garantía de la avanzada, confirmación suave, revelación
// corta y saltable con señal por rareza, e historial. Compra con un clic (sin confirmación). Sin armas, los puños y los muñecos de práctica dan créditos.
import { RARITIES, type WeaponGenerator } from "../../weapons/generator";
import type { WeaponSpec, RarityId } from "../../weapons/types";
import { t } from "../../i18n";
import { displayName } from "../../weapons/naming";
import { GRENADE_RARITY, makeGrenade, type GrenadeKind, type GrenadeRarity } from "../grenades";
import { grenadeThumb } from "../grenademodel";
import { armorCard, grenadeCard } from "./common";
import { fillArmorThumbs } from "../armormodel";
import { ARMOR_RARITY, makeArmor, type ArmorSpec } from "../armor";
import { CRATES, SHOP, SHOWCASE, isFree, sellPrice, buyShowcase, crateOdds, ensureShowcase, openCrate, pityLeft, record, showcasePrice, showcaseRarities, showcaseSeed, type CrateId, type ShopState } from "../shop";
import type { Inventory, Item } from "../inventory";
import { $, esc, keyHint, weaponCard, type Thumbnails } from "./common";

const color = (r: RarityId) => RARITIES.find((x) => x.id === r)!.color;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface ShopHooks {
  close(): void; toast(m: string): void;
  /** Genera el arma de una caja (con la rareza que ha salido) y la entrega (mochila o bandeja). Devuelve dónde fue. */
  deliver(rarity: RarityId): { spec: WeaponSpec; where: "pack" | "equip" | "tray" };
  /** Entrega un arma ya hecha (escaparate, arma básica). */
  deliverSpec(spec: WeaponSpec): { spec: WeaponSpec; where: "pack" | "equip" | "tray" };
  chime(level: number): void;
  /** Se ha vendido un arma (para soltarla de la mano si estaba equipada). */
  sold(it: Item): void;
  equipNow(spec: WeaponSpec): void;
  /** Reloj del escaparate: tiempo de juego (se pausa con el juego y se guarda). */
  gameTime(): number;
  /** Se ha puesto o quitado armadura (recalcular protección y ventajas). */ armorChanged?(): void;
  /** Nivel de un arma del escaparate (por su semilla, ajustado al nivel del jugador) y nivel del jugador. */
  weaponLevel?(seed: number): number; playerLevel?(): number;
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
    const key = `${sc.seed}:${sc.round}:${this.hooks.playerLevel?.() ?? 0}`;
    if (this.stock?.key !== key) {
      this.stock = { key, specs: showcaseRarities(sc).map((r, i) => {
        const seed = showcaseSeed(sc, i), w = this.gen.generate(seed, undefined, r);
        if (this.hooks.weaponLevel) { w.level = this.hooks.weaponLevel(seed); this.gen.refresh(w); }
        return w;
      }) };
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
      if (this.nadeAt(i)) return this.nadeTile(i, sc.sold[i]);
      if (this.armorAt(i)) return this.armorTileShop(i, sc.sold[i]);
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
      const btn = isFree(st, id) ? `<button type="button" class="btn" data-crate="${id}">${t("shop.openFree")}</button>`
        : cr < c.price ? `<button type="button" class="btn ghost" disabled>${t("shop.short", { c: c.price - cr })}</button>`
        : `<button type="button" class="btn" data-crate="${id}" data-confirm="${t("shop.confirm", { c: c.price })}">${t("shop.open", { c: c.price })}</button>`;
      const top = id === "common" ? "poco" : "rara";
      return `<div class="tier crate" style="--c:${color(top)}">
        <div class="th"><span class="tn">${t("shop.crate")}</span><span class="tname">${t(`shop.crate.${id}`)}</span></div>
        <div class="price"><strong>${c.price}</strong> ${t("unit.cr")}</div>
        <div class="floor">${t("shop.floor")} <b style="color:${color(top)}">${t(`rarity.${top}`)}</b>${id === "advanced" ? ` · ${t("shop.pity", { n: pityLeft(st) })}` : ""}</div>
        <div class="odds">${bars}</div>${btn}</div>`;
    }).join("");
    const ng = this.sel >= 0 ? this.nadeAt(this.sel) : null, na = this.sel >= 0 && !ng ? this.armorAt(this.sel) : null;
    const detail = na ? armorCard(na, this.inv.wornOf(na.slot) ? t("ui.compared") : "", this.inv.wornOf(na.slot)) : ng ? grenadeCard(ng, this.inv.grenade ? t("ui.compared") : "", this.inv.grenade) : this.sel >= 0 ? weaponCard(specs[this.sel], this.inv.current?.spec ?? null, this.inv.current ? t("ui.compared") : "") : `<p class="hint-sel">${t("shop.pick")}</p>`;
    $("shop-tiers").innerHTML = `<div class="sc-head"><h2>${t("shop.showcase")}</h2><span class="timer">${t("shop.refreshIn", { t: mmss(Math.max(0, sc.refreshAt - this.hooks.gameTime())) })}</span></div>
      <div class="sc-row">${tiles}</div><div class="crates">${crates}</div>${this.sellHTML()}`;
    $("shop-detail").innerHTML = detail;
    fillNadeThumbs(this.el); fillArmorThumbs(this.el);
    // Imagen fija de cada arma del escaparate (miniatura; se cachea por semilla, ronda y ranura)
    specs.forEach((s, i) => {
      const it = { uid: -((sc.seed % 100000) * 1000 + (sc.round % 100) * 10 + i + 1), spec: s } as unknown as Item;
      void this.thumbs.get(it).then((url) => { const img = this.el.querySelector<HTMLImageElement>(`img[data-thumb="${i}"]`); if (img && this.stock?.specs[i] === s) img.src = url; }).catch(() => undefined);
    });
    $("shop-history").innerHTML = st.history.length ? st.history.map((h) => `<li style="--c:${color(h.rarity)}"><b>${esc(h.name)}</b><span>${t(`rarity.${h.rarity}`)} · ${this.source(h.tier)}</span><span>${h.price < 0 ? `+${-h.price}` : `−${h.price}`} ${t("unit.cr")}</span></li>`).join("") : `<li class="none">${t("shop.noHistory")}</li>`;
    $("shop-reveal").hidden = !this.reveal;
    $("shop-foot").innerHTML = keyHint("Enter", "Ⓐ", t("shop.buyKey")) + keyHint("Esc", "Ⓑ", this.reveal ? t("shop.skip") : t("ui.back"));
  }
  /** Huecos del escaparate que esta ronda ofrecen una granada en lugar de un arma (≈ 1 de cada 6, deterministas). */
  private nadeAt(i: number) {
    const { sc } = this.showcase(), h = Math.imul((sc.seed * 7 + sc.round * 131 + i * 17) | 0, 2654435761) >>> 0;
    return h % 6 === 0 ? makeGrenade(sc.seed * 7 + sc.round * 131 + i * 17 + 5) : null;
  }
  /** Huecos que ofrecen una pieza de armadura (≈ 1 de cada 6, sin coincidir con las granadas; la misma pieza toda la ronda). */
  private armorCache = new Map<string, ArmorSpec>();
  private armorAt(i: number) {
    const { sc } = this.showcase(), h = Math.imul((sc.seed * 7 + sc.round * 131 + i * 17) | 0, 2654435761) >>> 0;
    if (h % 6 !== 3) return null;
    const key = `${sc.seed}:${sc.round}:${i}`; let a = this.armorCache.get(key);
    if (!a) { a = makeArmor(sc.seed * 13 + sc.round * 97 + i * 31 + 7); this.armorCache.set(key, a); }
    return a;
  }
  private armorTileShop(i: number, sold: boolean) {
    const a = this.armorAt(i)!, cr = this.inv.credits, price = ARMOR_RARITY[a.rarity].price;
    const btn = sold ? `<span class="soldtag">${t("shop.soldOut")}</span>` : cr < price ? `<button type="button" class="btn ghost sm" disabled>${t("shop.short", { c: price - cr })}</button>`
      : `<button type="button" class="btn sm" data-buyarmor="${i}">${t("shop.buy", { c: price })}</button>`;
    return `<div class="sc-tile ${sold ? "sold" : ""} ${this.sel === i ? "sel" : ""}" data-slot="${i}" style="--c:${ARMOR_RARITY[a.rarity].color}"><div class="img"><img data-armorthumb="${a.slot}:${a.variant}:${a.rarity}" alt=""></div>
      <b class="nm">${t(`ar.name.${a.slot}.${a.variant}`)}</b><span class="meta">${t(`rarity.${a.rarity}`)} · ${t(`ar.slot.${a.slot}`)} · ${Math.round(a.reduction * 1000) / 10} % ${t("ar.short")}</span>
      <div class="price"><strong>${price}</strong> ${t("unit.cr")}</div>${btn}</div>`;
  }
  private nadeTile(i: number, sold: boolean) {
    const g = this.nadeAt(i)!, cr = this.inv.credits, price = GRENADE_RARITY[g.rarity].price;
    const btn = sold ? `<span class="soldtag">${t("shop.soldOut")}</span>` : cr < price ? `<button type="button" class="btn ghost sm" disabled>${t("shop.short", { c: price - cr })}</button>`
      : `<button type="button" class="btn sm" data-buynade="${i}">${t("shop.buy", { c: price })}</button>`;
    // (mismo formato que las armas: foto, nombre en el color de la rareza, rareza y tipo, precio; la ficha a la derecha)
    return `<div class="sc-tile ${sold ? "sold" : ""} ${this.sel === i ? "sel" : ""}" data-slot="${i}" style="--c:${GRENADE_RARITY[g.rarity].color}"><div class="img"><img data-nadethumb="${g.kind}:${g.rarity}" alt=""></div>
      <b class="nm">${t(`gr.${g.kind}`)}</b><span class="meta">${t(`rarity.${g.rarity}`)} · ${t("gr.title1")} · ${g.damage} ${t("label.damage").toLowerCase()}</span>
      <div class="price"><strong>${price}</strong> ${t("unit.cr")}</div>${btn}</div>`;
  }
  /** Vender: las armas que llevas encima (equipadas y mochila), con su precio; un clic vende. */
  private sellHTML() {
    const list = this.inv.carried;
    const rows = list.map((it) => {
      const w = this.inv.find(it.uid)!;
      return `<div class="sell-row" style="--c:${it.spec.rarity.color}"><span class="nm">${esc(displayName(it.spec))}</span>
        <span class="meta">${t(`rarity.${it.spec.rarity.id}`)} · ${t(`type.${it.spec.type}`)}${w.area === "equip" ? ` · ${t("ui.equipped")} ${w.index + 1}` : ""}</span>
        <button type="button" class="btn sm" data-sell="${it.uid}">${t("shop.sellFor", { c: sellPrice(it.spec) })}</button></div>`;
    }).join("") + this.inv.grenades.map((g) => `<div class="sell-row" style="--c:${GRENADE_RARITY[g.rarity].color}"><span class="nm">${t("gr.title1")}: ${t(`gr.${g.kind}`)}</span>
        <span class="meta">${t(`rarity.${g.rarity}`)}${g === this.inv.grenade ? ` · ${t("ui.equipped")}` : ""}</span>
        <button type="button" class="btn sm" data-sellnade="${g.uid}">${t("shop.sellFor", { c: nadeSellPrice(g) })}</button></div>`).join("")
      + this.inv.armors.map((a) => `<div class="sell-row" style="--c:${ARMOR_RARITY[a.rarity].color}"><span class="nm">${t(`ar.name.${a.slot}.${a.variant}`)}</span>
        <span class="meta">${t(`rarity.${a.rarity}`)} · ${t(`ar.slot.${a.slot}`)}${this.inv.worn[a.slot] === a.uid ? ` · ${t("ui.equipped")}` : ""}</span>
        <button type="button" class="btn sm" data-sellarmor="${a.uid}">${t("shop.sellFor", { c: Math.round(ARMOR_RARITY[a.rarity].price / 3) })}</button></div>`).join("");
    return `<div class="sell"><h2>${t("shop.sell")}</h2>${rows || `<p class="hint-sel">${t("shop.nothingToSell")}</p>`}</div>`;
  }
  private source(tier: string) { if (tier === "sell") return t("shop.sold"); return tier.startsWith("crate:") ? t(`shop.crate.${tier.slice(6)}`) : tier.startsWith("shop:") ? t("shop.showcase") : t("shop.tier", { n: SHOP.tiers.findIndex((x) => x.id === tier) + 1 }); }

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
    const sellNade = target.closest<HTMLElement>("[data-sellnade]");
    if (sellNade) {
      const k = this.inv.grenades.findIndex((g) => g.uid === Number(sellNade.dataset.sellnade)); if (k < 0) return;
      const g = this.inv.grenades[k], price = nadeSellPrice(g);
      this.inv.grenades.splice(k, 1); if (this.inv.grenadeActive === k) this.inv.grenadeActive = -1; else if (this.inv.grenadeActive > k) this.inv.grenadeActive--;
      this.inv.credits += price; record(this.state(), { tier: "sell", rarity: g.rarity, name: t(`gr.${g.kind}`), price: -price, at: Date.now() });
      this.hooks.toast(t("shop.soldMsg", { c: price })); this.render(); return;
    }
    const sellArmor = target.closest<HTMLElement>("[data-sellarmor]");
    if (sellArmor) {
      const a = this.inv.armors.find((x) => x.uid === Number(sellArmor.dataset.sellarmor)); if (!a) return;
      const price = Math.round(ARMOR_RARITY[a.rarity].price / 3);
      if (this.inv.worn[a.slot] === a.uid) this.inv.worn[a.slot] = null;
      this.inv.armors.splice(this.inv.armors.indexOf(a), 1); this.inv.credits += price;
      record(this.state(), { tier: "sell", rarity: a.rarity, name: t(`ar.name.${a.slot}.${a.variant}`), price: -price, at: Date.now() });
      this.hooks.armorChanged?.(); this.hooks.toast(t("shop.soldMsg", { c: price })); this.render(); return;
    }
    const armorBtn = target.closest<HTMLElement>("[data-buyarmor]");
    if (armorBtn) {
      const i = Number(armorBtn.dataset.buyarmor), { sc } = this.showcase(), a = this.armorAt(i); if (!a) return;
      const price = ARMOR_RARITY[a.rarity].price;
      if (sc.sold[i] || this.inv.credits < price) return;
      if (this.inv.armors.length >= 12) { this.hooks.toast(t("ar.full")); return; }
      this.inv.credits -= price; sc.sold[i] = true; this.inv.armors.push(a);
      if (this.inv.worn[a.slot] == null) { this.inv.worn[a.slot] = a.uid; this.hooks.armorChanged?.(); }
      this.hooks.toast(t("ar.bought", { n: t(`ar.name.${a.slot}.${a.variant}`) })); this.render(); return;
    }
    const nadeBtn = target.closest<HTMLElement>("[data-buynade]");
    if (nadeBtn) {
      const i = Number(nadeBtn.dataset.buynade), { sc } = this.showcase(), g = this.nadeAt(i); if (!g) return;
      const price = GRENADE_RARITY[g.rarity].price;
      if (sc.sold[i] || this.inv.credits < price) return;
      if (this.inv.grenades.length >= 8) { this.hooks.toast(t("gr.full")); return; }
      this.inv.credits -= price; sc.sold[i] = true; this.inv.grenades.push(g);
      if (this.inv.grenadeActive < 0) this.inv.grenadeActive = this.inv.grenades.length - 1;
      this.hooks.toast(t("gr.bought", { n: t(`gr.${g.kind}`) })); this.render(); return;
    }
    const sellBtn = target.closest<HTMLElement>("[data-sell]");
    if (sellBtn) {
      const it = this.inv.byUid(Number(sellBtn.dataset.sell)), w = it && this.inv.find(it.uid);
      if (!it || !w || w.area === "storage") return;
      // (vender = el arma se va con sus accesorios montados; al banco solo pasan los que se desmontan antes, o al desguazar)
      const price = sellPrice(it.spec);
      this.inv.credits += price; this.inv.remove(w);
      record(this.state(), { tier: "sell", rarity: it.spec.rarity.id, name: it.spec.customName || it.spec.name, price: -price, at: Date.now() });
      this.hooks.toast(t("shop.soldMsg", { c: price }));
      this.hooks.sold(it); this.render(); return;
    }
    const slotBtn = target.closest<HTMLElement>("[data-buyslot]");
    if (slotBtn) {
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

/** Pone la foto de cada granada en sus <img data-nadethumb="tipo:rareza"> (se dibujan una vez y se guardan). */
export function fillNadeThumbs(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img[data-nadethumb]").forEach((img) => {
    const [k, r] = img.dataset.nadethumb!.split(":") as [GrenadeKind, GrenadeRarity];
    void grenadeThumb(k, r).then((url) => { img.src = url; img.classList.add("ready"); }).catch(() => undefined);
  });
}

/** Precio de venta de una granada: un tercio de lo que cuesta en el escaparate. */
const nadeSellPrice = (g: { rarity: keyof typeof GRENADE_RARITY }) => Math.round(GRENADE_RARITY[g.rarity].price / 3);
