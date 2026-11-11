// Interfaz con cursor: tarjetas de arma, inventario, banco de trabajo y cursor circular (ratón y mando).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TYPE_INFO, type WeaponGenerator } from "../weapons/generator";
import type { WeaponAssembler } from "../weapons/assembler";
import type { StatKey, WeaponSpec } from "../weapons/types";
import { fits, mounted, paints, removable, repaint, scrap, slotsOf, swap, type PartItem, type Slot } from "../weapons/workshop";
import { archName, damageText, effectDesc, effectName, modeName, paintName, partLabel, rarityName, slotName, typeName } from "../weapons/labels";
import { t } from "../i18n";
import type { Inventory, Item, Where } from "./inventory";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const STATS: [StatKey, (v: number) => string][] = [
  ["cadencia", (v) => `${Math.round(v)}${t("unit.rpm")}`],
  ["precision", (v) => `${Math.round(v)}`],
  ["alcance", (v) => `${Math.round(v)} ${t("unit.m")}`],
  ["manejo", (v) => `${Math.round(v)}`],
  ["cargador", (v) => `${Math.round(v)}`],
];

/** Tarjeta de arma con barras y, si se da `cmp`, diferencias respecto a otra arma. */
export function weaponCard(s: WeaponSpec, cmp?: WeaponSpec | null, title?: string) {
  const base = TYPE_INFO[s.type as keyof typeof TYPE_INFO].base;
  const delta = (k: StatKey) => {
    if (!cmp) return "<span></span>";
    const d = s.stats[k] - cmp.stats[k]; if (Math.abs(d) < 0.5) return `<span class="d"></span>`;
    return `<span class="d ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${Math.round(d)}</span>`;
  };
  const dd = cmp ? s.stats.dano - cmp.stats.dano : 0;
  return `<div class="card" style="--c:${s.rarity.color}">
    ${title ? `<span class="vs">${title}</span>` : ""}
    <span class="rar">${rarityName(s)} · ${typeName(s.type)} · ${t("label.level")} ${s.level}</span>
    <span class="nm">${s.name}</span>
    <span class="meta">${archName(s)} · ${modeName(s)}</span>
    <div class="big"><strong>${damageText(s)}</strong><span>${t("label.damage")}</span>${cmp && Math.abs(dd) >= 0.5 ? `<span class="${dd > 0 ? "up" : "down"}">${dd > 0 ? "+" : ""}${Math.round(dd)}</span>` : ""}</div>
    <div class="stats">${STATS.map(([k, f]) => {
      const pct = Math.max(4, Math.min(100, (s.stats[k] / (k === "precision" || k === "manejo" ? 100 : base[k] * 1.8)) * 100));
      return `<span class="k">${t(`stat.${k}`)}</span><span class="meter"><i style="width:${pct}%"></i></span><span class="v">${f(s.stats[k])}</span>${delta(k)}`;
    }).join("")}</div>
    ${s.effects.map((e) => `<div class="fx ${e.kind}"><span class="ico" style="color:${e.color}">${e.icon}</span><div><b style="color:${e.color}">${effectName(e)}</b><small>${effectDesc(e)}</small></div></div>`).join("")}
  </div>`;
}

function cellHTML(it: Item | null, where: Where, inHand: boolean, big = false, emptyText = t("ui.empty"), extraClass = "") {
  if (!it) return `<div class="cell empty ${big ? "big" : ""}" data-area="${where.area}" data-index="${where.index}">${emptyText}</div>`;
  const s = it.spec;
  return `<div class="cell ${big ? "big" : ""} ${inHand ? "active" : ""} ${extraClass}" style="--c:${s.rarity.color}" data-area="${where.area}" data-index="${where.index}" data-uid="${it.uid}" data-inhand="${t("ui.inHand")}">
    <img class="thumb" data-thumb="${it.uid}" alt="">
    <span class="lbl">${typeName(s.type)} · ${archName(s)}</span><span class="nm">${s.name}</span>
    <span class="dm">${damageText(s)} <span class="ty">· ${t("label.level")} ${s.level}</span></span><span class="glow"></span></div>`;
}

// ---------------------------------------------------------------------------
/** Fotos de las armas: se renderizan una vez (vista lateral) y se guardan hasta que el arma cambia. */
export class Thumbnails {
  private renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
  private cache = new Map<number, Promise<string>>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private asm: WeaponAssembler) {
    this.renderer.setSize(320, 140, false);
    this.renderer.setPixelRatio(1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.6));
    const k = new THREE.DirectionalLight(0xfff0dd, 1.8); k.position.set(1, 2, 3); this.scene.add(k);
  }
  forget(uid: number) { this.cache.delete(uid); }
  get(it: Item): Promise<string> {
    if (!this.cache.has(it.uid)) {
      // En cola: un solo renderizador para todas las fotos
      const p = this.queue.then(async () => {
        const built = await this.asm.assemble(it.spec);
        const g = built.group; g.rotation.set(0.05, -0.32, 0);
        this.scene.add(g);
        const b = new THREE.Box3().setFromObject(g), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
        const aspect = 320 / 140, half = Math.max(size.x / 2 / aspect, size.y / 2) * 1.12;
        Object.assign(this.camera, { left: -half * aspect, right: half * aspect, top: half, bottom: -half });
        this.camera.position.set(c.x, c.y, c.z + 5); this.camera.lookAt(c); this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
        const url = this.renderer.domElement.toDataURL("image/png");
        this.scene.remove(g);
        return url;
      });
      this.queue = p.catch(() => undefined);
      this.cache.set(it.uid, p);
    }
    return this.cache.get(it.uid)!;
  }
  /** Rellena las imágenes <img data-thumb="uid"> de un contenedor. */
  fill(root: HTMLElement, items: Item[]) {
    root.querySelectorAll<HTMLImageElement>("img[data-thumb]").forEach((img) => {
      const it = items.find((x) => x.uid === Number(img.dataset.thumb)); if (!it) return;
      this.get(it).then((url) => { img.src = url; img.classList.add("ready"); }).catch(() => undefined);
    });
  }
}

export class InventoryScreen {
  private el = $("inventory");
  private held: Where | null = null;
  private hovered: Where | null = null;
  isOpen = false;
  constructor(private inv: Inventory, private thumbs: Thumbnails, private onClose: () => void, private toast: (m: string) => void, private onDrop: (it: Item) => void) {
    this.el.addEventListener("mouseover", (e) => this.hover(e));
    this.el.addEventListener("mouseleave", () => { this.hovered = null; $("tooltip").hidden = true; });
    this.el.addEventListener("mousemove", (e) => this.placeTip(e.clientX, e.clientY));
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.quick(e); });
    this.el.addEventListener("pointerdown", (e) => this.dragStart(e));
    addEventListener("pointermove", (e) => this.dragMove(e));
    addEventListener("pointerup", (e) => this.dragEnd(e));
    inv.onChange(() => { if (this.isOpen) this.render(); });
  }

  // ---------- Arrastrar y soltar ----------
  private drag: { from: Where; x: number; y: number; ghost: HTMLElement | null } | null = null;
  private justDragged = false;
  private dragStart(e: PointerEvent) {
    if (e.button !== 0) return;
    const w = this.whereOf(e.target); if (!w || !this.inv.get(w)) return;
    this.drag = { from: w, x: e.clientX, y: e.clientY, ghost: null };
  }
  private dragMove(e: PointerEvent) {
    const d = this.drag; if (!d) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
      const src = this.el.querySelector<HTMLElement>(`.cell[data-area="${d.from.area}"][data-index="${d.from.index}"]`);
      if (!src) return;
      d.ghost = src.cloneNode(true) as HTMLElement;
      d.ghost.classList.add("drag-ghost"); d.ghost.style.width = `${src.offsetWidth}px`;
      document.body.appendChild(d.ghost);
      src.classList.add("held"); this.held = null; $("tooltip").hidden = true;
      this.el.classList.add("dragging");
    }
    d.ghost.style.transform = `translate(${e.clientX - 30}px, ${e.clientY - 24}px)`;
    const over = document.elementFromPoint(e.clientX, e.clientY);
    this.el.querySelectorAll(".drop-over").forEach((x) => x.classList.remove("drop-over"));
    (over?.closest(".cell") ?? over?.closest("#inv-dropzone"))?.classList.add("drop-over");
  }
  private dragEnd(e: PointerEvent) {
    const d = this.drag; this.drag = null; if (!d || !d.ghost) return;
    d.ghost.remove(); this.el.classList.remove("dragging");
    this.el.querySelectorAll(".drop-over").forEach((x) => x.classList.remove("drop-over"));
    this.justDragged = true; setTimeout(() => (this.justDragged = false), 0);
    const over = document.elementFromPoint(e.clientX, e.clientY);
    if (over?.closest("#inv-dropzone")) { const it = this.inv.remove(d.from); if (it) this.onDrop(it); return; }
    const to = this.whereOf(over);
    if (to && (to.area !== d.from.area || to.index !== d.from.index)) this.inv.move(d.from, to);
    else this.render();
  }
  open() { this.isOpen = true; this.held = null; this.el.hidden = false; this.render(); }
  close() { this.isOpen = false; this.el.hidden = true; $("tooltip").hidden = true; this.onClose(); }
  private whereOf(target: EventTarget | null): Where | null {
    const c = (target as HTMLElement | null)?.closest?.(".cell") as HTMLElement | null;
    return c && c.dataset.area ? { area: c.dataset.area as Where["area"], index: Number(c.dataset.index) } : null;
  }
  render() {
    const i = this.inv;
    $("inv-equip").innerHTML = i.equip.map((it, k) => `<div><div class="lbl" style="margin-bottom:4px">${t("ui.slot", { n: k + 1 })}</div>${cellHTML(it, { area: "equip", index: k }, i.active === k && !!it, true, t("ui.dropHere"))}</div>`).join("");
    $("inv-pack").innerHTML = i.pack.map((it, k) => cellHTML(it, { area: "pack", index: k }, false)).join("");
    $("inv-foot").innerHTML = `<span>${t("ui.packCount")} <b>${i.pack.filter(Boolean).length}/${i.pack.length}</b></span><span>${t("ui.looseParts")} <b>${i.parts.length}</b></span><span>${t("ui.scrap")} <b>${i.scrap}</b></span>`;
    if (this.held) this.el.querySelector(`.cell[data-area="${this.held.area}"][data-index="${this.held.index}"]`)?.classList.add("held");
    this.thumbs.fill(this.el, i.all);
  }
  private hover(e: Event) {
    if (this.drag?.ghost) return;
    const w = this.whereOf(e.target); this.hovered = w;
    const tip = $("tooltip");
    const it = w && this.inv.get(w);
    if (!it) { tip.hidden = true; return; }
    const cur = this.inv.current;
    tip.innerHTML = weaponCard(it.spec, cur && cur !== it ? cur.spec : null, cur && cur !== it ? t("ui.compared") : "");
    tip.hidden = false;
  }
  placeTip(x: number, y: number) {
    const tip = $("tooltip"); if (tip.hidden) return;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - r.width - 12, x + 22)}px`;
    tip.style.top = `${Math.max(12, Math.min(innerHeight - r.height - 12, y - 20))}px`;
  }
  private click(e: Event) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-close]")) return this.close();
    if (this.justDragged) return;
    if (target.closest("#inv-dropzone") && this.held) { const it = this.inv.remove(this.held); this.held = null; if (it) this.onDrop(it); return; }
    const w = this.whereOf(target); if (!w) return;
    if (!this.held) { if (this.inv.get(w)) { this.held = w; this.render(); } return; }
    this.inv.move(this.held, w); this.held = null; this.render();
  }
  /** Clic derecho: equipar / guardar en la mochila. */
  private quick(e: Event) {
    const w = this.whereOf(e.target); if (!w || !this.inv.get(w)) return;
    if (w.area === "pack") {
      const slot = this.inv.equip.indexOf(null);
      this.inv.move(w, { area: "equip", index: slot >= 0 ? slot : this.inv.active });
    } else {
      const free = this.inv.pack.indexOf(null);
      if (free < 0) return this.toast(t("ui.packFull"));
      this.inv.move(w, { area: "pack", index: free });
    }
  }
  /** Suelta al suelo el arma bajo el cursor. */
  dropHovered() {
    const w = this.hovered; if (!w) return;
    const it = this.inv.get(w); if (!it) return;
    this.inv.remove(w); $("tooltip").hidden = true;
    this.onDrop(it);
  }

  /** Desguaza el arma bajo el cursor (solo desde la mochila). */
  scrapHovered() {
    const w = this.hovered; if (!w || w.area !== "pack") return;
    const it = this.inv.get(w); if (!it) return;
    const r = scrap(it.spec);
    this.inv.parts.push(...r.parts); this.inv.scrap += r.scrap; this.inv.remove(w);
    $("tooltip").hidden = true;
    this.toast(t("ui.scrapped", { p: r.parts.length, s: r.scrap }));
  }
}

// ---------------------------------------------------------------------------
export class WorkbenchScreen {
  private el = $("workbench");
  isOpen = false;
  private sel: Item | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 30);
  private model: THREE.Object3D | null = null;
  private yaw = -0.5; private dragging = false; private lastX = 0; private dist = 1;
  private preview: WeaponSpec | null = null;
  private token = 0;

  constructor(private inv: Inventory, private gen: WeaponGenerator, private asm: WeaponAssembler, private thumbs: Thumbnails, private onClose: () => void, private onChanged: (it: Item) => void, private toast: (m: string) => void) {
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("mouseover", (e) => this.hoverOpt(e));
    this.el.addEventListener("mouseout", (e) => { if ((e.target as HTMLElement).closest(".opt,.swatch")) { this.preview = null; this.renderCard(); } });
  }

  private ensureRenderer() {
    if (this.renderer) return;
    const host = $("wb-preview");
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.prepend(this.renderer.domElement);
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.4));
    const k = new THREE.DirectionalLight(0xfff0dd, 1.6); k.position.set(2, 3, 3); this.scene.add(k);
    const c = this.renderer.domElement;
    c.addEventListener("pointerdown", (e) => { this.dragging = true; this.lastX = e.clientX; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => { if (this.dragging) { this.yaw -= (e.clientX - this.lastX) * 0.01; this.lastX = e.clientX; } });
    c.addEventListener("pointerup", () => { this.dragging = false; });
  }

  open() {
    this.isOpen = true; this.el.hidden = false; this.ensureRenderer();
    this.sel = this.inv.current ?? this.inv.all[0] ?? null;
    this.render();
  }
  close() { this.isOpen = false; this.el.hidden = true; this.onClose(); }
  /** Gira el arma con el stick derecho del mando. */
  rotate(dx: number) { this.yaw -= dx; }

  update(dt: number) {
    if (!this.isOpen || !this.renderer) return;
    const r = $("wb-preview").getBoundingClientRect();
    this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / Math.max(1, r.height); this.camera.updateProjectionMatrix();
    if (!this.dragging) this.yaw += dt * 0.2;
    this.camera.position.set(Math.sin(this.yaw) * this.dist, this.dist * 0.18, Math.cos(this.yaw) * this.dist); this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }

  private async rebuild() {
    const it = this.sel; const my = ++this.token;
    if (this.model) { this.scene.remove(this.model); this.model = null; }
    if (!it) return;
    const built = await this.asm.assemble(it.spec);
    if (my !== this.token) return;
    this.model = built.group; this.scene.add(built.group); this.dist = built.length * 2.4 + 0.1;
  }

  render() {
    if (!this.isOpen) return;
    const all = this.inv.all;
    $("wb-list").innerHTML = all.length ? all.map((it) => cellHTML(it, this.inv.find(it.uid)!, false, false, "", it === this.sel ? "sel" : "")).join("") : `<div class="cell empty">${t("ui.noWeapons")}</div>`;
    this.renderCard(); this.renderSlots(); this.rebuild();
    this.thumbs.fill($("wb-list"), all);
  }

  private renderCard() {
    const s = this.sel?.spec;
    $("wb-preview").style.setProperty("--c", s?.rarity.color ?? "#888");
    $("wb-card").innerHTML = s ? weaponCard(this.preview ?? s, this.preview ? s : null, this.preview ? t("ui.preview") : "") : "";
  }

  private compatible(slot: Slot): PartItem[] {
    const s = this.sel!.spec; const seen = new Set<string>();
    return this.inv.parts.filter((p) => fits(this.gen, s, slot, p)).filter((p) => { const k = p.from + (p.barrelLength ?? ""); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  private label(id: string, len?: number) { return partLabel(this.gen.byId, id) + (len && len !== 1 ? ` ×${len.toFixed(2)}` : ""); }

  private renderSlots() {
    const it = this.sel; const box = $("wb-slots");
    if (!it) { box.innerHTML = ""; return; }
    const s = it.spec;
    box.innerHTML = slotsOf(this.gen, s).map((slot) => {
      const cur = mounted(s, slot);
      const opts = this.compatible(slot);
      return `<div class="slot"><div class="head"><b>${slotName(slot)}</b><span>${cur ? this.label(cur.from, cur.barrelLength) : "—"}</span></div>
        <div class="opts">${cur && removable(slot) ? `<button class="opt none" data-slot="${slot}" data-part="none">${t("ui.remove")}</button>` : ""}
        ${opts.map((p) => `<button class="opt" data-slot="${slot}" data-part="${p.uid}">${this.label(p.from, p.barrelLength)}</button>`).join("") || (cur && removable(slot) ? "" : `<span class="partsbox">${t("ui.noParts")}</span>`)}</div></div>`;
    }).join("") + `<div class="slot"><div class="head"><b>${t("ui.finish")}</b><span>${paintName(s.paint)}</span></div><div class="swatches">${paints().map((p, i) => `<button class="swatch ${p.id === s.paint.id ? "on" : ""}" title="${paintName(p)}" data-paint="${i}" style="background:${p.color ? `rgb(${p.color.map((c) => Math.round(c * 255)).join(",")})` : "linear-gradient(135deg,#555,#222)"}"></button>`).join("")}</div></div>
      <div class="slot"><div class="head"><b>${t("ui.partsBox")}</b><span>${t("ui.partsBoxInfo", { n: this.inv.parts.length, s: this.inv.scrap })}</span></div>
        <div class="partsbox">${this.partsSummary() || t("ui.partsEmpty")}</div>
        <button class="btn danger" data-scrap="1" ${this.inv.all.length <= 1 ? "disabled" : ""}>${t("ui.scrapWeapon")}</button></div>`;
  }

  private partsSummary() {
    const count = new Map<string, number>();
    for (const p of this.inv.parts) { const k = `${slotName(p.role)}: ${this.label(p.from)}`; count.set(k, (count.get(k) ?? 0) + 1); }
    return [...count].map(([k, n]) => `${k}${n > 1 ? ` ×${n}` : ""}`).join(" · ");
  }

  private hoverOpt(e: Event) {
    const el = (e.target as HTMLElement).closest(".opt,.swatch") as HTMLElement | null;
    if (!el || !this.sel) return;
    const clone: WeaponSpec = structuredClone(this.sel.spec);
    if (el.dataset.paint) repaint(this.gen, clone, paints()[Number(el.dataset.paint)]);
    else {
      const part = el.dataset.part === "none" ? null : this.inv.parts.find((p) => p.uid === Number(el.dataset.part)) ?? null;
      try { swap(this.gen, clone, el.dataset.slot as Slot, part); } catch { return; }
    }
    this.preview = clone; this.renderCard();
  }

  private click(e: Event) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-close]")) return this.close();
    const cell = target.closest(".cell") as HTMLElement | null;
    if (cell?.dataset.uid) { this.sel = this.inv.all.find((x) => x.uid === Number(cell.dataset.uid)) ?? null; this.preview = null; return this.render(); }
    const it = this.sel; if (!it) return;
    const opt = target.closest(".opt") as HTMLElement | null;
    if (opt) {
      const slot = opt.dataset.slot as Slot;
      const part = opt.dataset.part === "none" ? null : this.inv.parts.find((p) => p.uid === Number(opt.dataset.part)) ?? null;
      const old = swap(this.gen, it.spec, slot, part);
      if (part) this.inv.parts.splice(this.inv.parts.indexOf(part), 1);
      if (old) this.inv.parts.push(old);
      it.ammo = Math.min(it.ammo, it.spec.stats.cargador);
      this.thumbs.forget(it.uid);
      this.preview = null; this.onChanged(it); this.render(); this.inv.changed();
      return;
    }
    const sw = target.closest(".swatch") as HTMLElement | null;
    if (sw) { repaint(this.gen, it.spec, paints()[Number(sw.dataset.paint)]); this.thumbs.forget(it.uid); this.preview = null; this.onChanged(it); this.render(); return; }
    if (target.closest("[data-scrap]")) {
      const where = this.inv.find(it.uid); if (!where) return;
      const r = scrap(it.spec);
      this.inv.parts.push(...r.parts); this.inv.scrap += r.scrap; this.inv.remove(where);
      this.toast(t("ui.scrapped", { p: r.parts.length, s: r.scrap }));
      this.sel = this.inv.current ?? this.inv.all[0] ?? null; this.render();
    }
  }
}

// ---------------------------------------------------------------------------
/**
 * Cursor circular de los menús (estilo Destiny / No Man's Sky). Lo mueven el ratón o el stick
 * izquierdo del mando; con el mando va más despacio sobre los elementos interactivos y Ⓐ hace clic.
 */
export class MenuCursor {
  private el = $("vcursor");
  x = innerWidth / 2; y = innerHeight / 2;
  private last: Element | null = null;
  constructor() {
    addEventListener("mousemove", (e) => { this.x = e.clientX; this.y = e.clientY; this.place(); this.track(false); });
    addEventListener("mousedown", () => this.el.classList.add("press"));
    addEventListener("mouseup", () => this.el.classList.remove("press"));
  }
  show(on: boolean) { this.el.hidden = !on; document.body.classList.toggle("menu-cursor", on); }
  private place() { this.el.style.transform = `translate(${this.x}px, ${this.y}px)`; }
  private track(synthetic: boolean) {
    const under = document.elementFromPoint(this.x, this.y);
    const target = under?.closest(".btn,.cell,.opt,.swatch,select") ?? null;
    this.el.classList.toggle("over", !!target);
    if (under !== this.last) {
      this.last?.closest(".btn,.cell,.opt,.swatch")?.classList.remove("vhover");
      if (synthetic) { target?.classList.add("vhover"); under?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: this.x, clientY: this.y })); }
      this.last = under;
    }
    if (synthetic) under?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: this.x, clientY: this.y }));
  }
  /** Stick izquierdo: movimiento con aceleración y "fricción" sobre los botones. */
  update(dt: number, ax: number, ay: number) {
    const dz = 0.15, over = this.el.classList.contains("over");
    const sp = (over ? 520 : 1000) * dt;
    if (Math.abs(ax) > dz) this.x += Math.sign(ax) * Math.pow(Math.abs(ax), 1.7) * sp;
    if (Math.abs(ay) > dz) this.y += Math.sign(ay) * Math.pow(Math.abs(ay), 1.7) * sp;
    this.x = Math.max(0, Math.min(innerWidth - 2, this.x)); this.y = Math.max(0, Math.min(innerHeight - 2, this.y));
    this.place();
    if (Math.abs(ax) > dz || Math.abs(ay) > dz) this.track(true);
  }
  click(right = false) {
    const under = document.elementFromPoint(this.x, this.y) as HTMLElement | null;
    if (!under) return;
    this.el.classList.add("press"); setTimeout(() => this.el.classList.remove("press"), 120);
    if (right) under.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: this.x, clientY: this.y }));
    else under.click();
  }
}
