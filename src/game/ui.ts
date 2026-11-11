// Interfaz con cursor: tarjetas de arma, inventario, banco de trabajo y cursor virtual del mando.
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TYPE_INFO, PELLETS, type WeaponGenerator } from "../weapons/generator";
import type { WeaponAssembler } from "../weapons/assembler";
import type { StatKey, WeaponSpec } from "../weapons/types";
import { SLOT_NAME, fits, mounted, paints, removable, repaint, scrap, slotsOf, swap, type PartItem, type Slot } from "../weapons/workshop";
import type { Inventory, Item, Where } from "./inventory";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const typeName = (s: WeaponSpec) => TYPE_INFO[s.type as keyof typeof TYPE_INFO]?.name ?? s.type;
const label = (gen: WeaponGenerator, id: string) => (gen.byId.get(id)?.label ?? id).replace("Accessories/", "");

const STATS: [StatKey, string, (v: number) => string][] = [
  ["cadencia", "Cadencia", (v) => `${Math.round(v)}/min`],
  ["precision", "Precisión", (v) => `${Math.round(v)}`],
  ["alcance", "Alcance", (v) => `${Math.round(v)} m`],
  ["manejo", "Manejo", (v) => `${Math.round(v)}`],
  ["cargador", "Cargador", (v) => `${Math.round(v)}`],
];

export function damageText(s: WeaponSpec) {
  const pellets = (PELLETS[s.type] ?? 1) * (s.effects.some((e) => e.id === "doble") ? 2 : 1);
  return `${Math.round(s.stats.dano)}${pellets > 1 ? `<small> ×${pellets}</small>` : ""}`;
}

/** Tarjeta de arma con barras y, si se da `cmp`, diferencias respecto a otra arma. */
export function weaponCard(s: WeaponSpec, cmp?: WeaponSpec | null, title?: string) {
  const base = TYPE_INFO[s.type as keyof typeof TYPE_INFO].base;
  const delta = (k: StatKey) => {
    if (!cmp) return "";
    const d = s.stats[k] - cmp.stats[k]; if (Math.abs(d) < 0.5) return `<span class="d"></span>`;
    return `<span class="d ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${Math.round(d)}</span>`;
  };
  const dd = cmp ? s.stats.dano - cmp.stats.dano : 0;
  return `<div class="card" style="--c:${s.rarity.color}">
    ${title ? `<span class="vs">${title}</span>` : ""}
    <span class="rar">${s.rarity.name} · ${typeName(s)} · Nv ${s.level}</span>
    <span class="nm">${s.name}</span>
    <div class="big"><strong>${damageText(s)}</strong><span>daño</span>${cmp && Math.abs(dd) >= 0.5 ? `<span class="${dd > 0 ? "up" : "down"}">${dd > 0 ? "+" : ""}${Math.round(dd)}</span>` : ""}</div>
    <div class="stats">${STATS.map(([k, n, f]) => {
      const pct = Math.max(4, Math.min(100, (s.stats[k] / (k === "precision" || k === "manejo" ? 100 : base[k] * 1.6)) * 100));
      return `<span class="k">${n}</span><span class="meter"><i style="width:${pct}%"></i></span><span class="v">${f(s.stats[k])}</span>${cmp ? delta(k) : "<span></span>"}`;
    }).join("")}</div>
    ${s.effects.map((e) => `<div class="fx"><span class="ico" style="color:${e.color}">${e.icon}</span><div><b style="color:${e.color}">${e.name}</b><small>${e.text}</small></div></div>`).join("")}
  </div>`;
}

function cellHTML(it: Item | null, where: Where, active: boolean, big = false, emptyText = "Vacío") {
  if (!it) return `<div class="cell empty ${big ? "big" : ""}" data-area="${where.area}" data-index="${where.index}">${emptyText}</div>`;
  const s = it.spec;
  return `<div class="cell ${big ? "big" : ""} ${active ? "active" : ""}" style="--c:${s.rarity.color}" data-area="${where.area}" data-index="${where.index}" data-uid="${it.uid}">
    <span class="lbl">${typeName(s)}</span><span class="nm">${s.name}</span>
    <span class="dm">${damageText(s)} <span class="ty">· Nv ${s.level}</span></span><span class="glow"></span></div>`;
}

// ---------------------------------------------------------------------------
export class InventoryScreen {
  private el = $("inventory");
  private held: Where | null = null;
  private hovered: Where | null = null;
  isOpen = false;
  constructor(private inv: Inventory, private onClose: () => void, private toast: (m: string) => void) {
    this.el.addEventListener("mouseover", (e) => this.hover(e));
    this.el.addEventListener("mouseleave", () => { this.hovered = null; $("tooltip").hidden = true; });
    this.el.addEventListener("mousemove", (e) => this.placeTip(e.clientX, e.clientY));
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("contextmenu", (e) => { e.preventDefault(); this.quick(e); });
    inv.onChange(() => { if (this.isOpen) this.render(); });
  }
  open() { this.isOpen = true; this.held = null; this.el.hidden = false; this.render(); }
  close() { this.isOpen = false; this.el.hidden = true; $("tooltip").hidden = true; this.onClose(); }
  private whereOf(t: EventTarget | null): Where | null {
    const c = (t as HTMLElement | null)?.closest?.(".cell") as HTMLElement | null;
    return c && c.dataset.area ? { area: c.dataset.area as Where["area"], index: Number(c.dataset.index) } : null;
  }
  render() {
    const i = this.inv;
    $("inv-equip").innerHTML = i.equip.map((it, k) => `<div><div class="lbl" style="margin-bottom:4px">Ranura ${k + 1}</div>${cellHTML(it, { area: "equip", index: k }, i.active === k && !!it, true, "Arrastra aquí un arma")}</div>`).join("");
    $("inv-pack").innerHTML = i.pack.map((it, k) => cellHTML(it, { area: "pack", index: k }, false)).join("");
    $("inv-foot").innerHTML = `<span>Mochila <b>${i.pack.filter(Boolean).length}/${i.pack.length}</b></span><span>Piezas sueltas <b>${i.parts.length}</b></span><span>Chatarra <b>${i.scrap}</b></span>`;
    if (this.held) this.el.querySelector(`.cell[data-area="${this.held.area}"][data-index="${this.held.index}"]`)?.classList.add("held");
  }
  private hover(e: Event) {
    const w = this.whereOf(e.target); this.hovered = w;
    const tip = $("tooltip");
    const it = w && this.inv.get(w);
    if (!it) { tip.hidden = true; return; }
    const cur = this.inv.current;
    tip.innerHTML = weaponCard(it.spec, cur && cur !== it ? cur.spec : null, cur && cur !== it ? "Comparado con el arma en mano" : "");
    tip.hidden = false;
  }
  placeTip(x: number, y: number) {
    const tip = $("tooltip"); if (tip.hidden) return;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(innerWidth - r.width - 12, x + 18)}px`;
    tip.style.top = `${Math.max(12, Math.min(innerHeight - r.height - 12, y - 20))}px`;
  }
  private click(e: Event) {
    const t = e.target as HTMLElement;
    if (t.closest("[data-close]")) return this.close();
    const w = this.whereOf(t); if (!w) return;
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
      if (free < 0) return this.toast("La mochila está llena");
      this.inv.move(w, { area: "pack", index: free });
    }
  }
  /** Desguaza el arma bajo el cursor (solo desde la mochila). */
  scrapHovered() {
    const w = this.hovered; if (!w || w.area !== "pack") return;
    const it = this.inv.get(w); if (!it) return;
    const r = scrap(it.spec);
    this.inv.parts.push(...r.parts); this.inv.scrap += r.scrap; this.inv.remove(w);
    $("tooltip").hidden = true;
    this.toast(`Desguazada: +${r.parts.length} piezas, +${r.scrap} de chatarra`);
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

  constructor(private inv: Inventory, private gen: WeaponGenerator, private asm: WeaponAssembler, private onClose: () => void, private onChanged: (it: Item) => void, private toast: (m: string) => void) {
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
    const host = $("wb-preview"); const r = host.getBoundingClientRect();
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
    const all = this.inv.all;
    $("wb-list").innerHTML = all.length ? all.map((it) => {
      const w = this.inv.find(it.uid)!;
      return cellHTML(it, w, false).replace('class="cell', `class="cell${it === this.sel ? " sel" : ""}`);
    }).join("") : `<div class="cell empty">No tienes armas. Abre el cofre.</div>`;
    this.renderCard(); this.renderSlots(); this.rebuild();
  }

  private renderCard() {
    const s = this.sel?.spec;
    $("wb-preview").style.setProperty("--c", s?.rarity.color ?? "#888");
    $("wb-card").innerHTML = s ? weaponCard(this.preview ?? s, this.preview ? s : null, this.preview ? "Vista previa del cambio" : "") : "";
  }

  private compatible(slot: Slot): PartItem[] {
    const s = this.sel!.spec;
    const seen = new Set<string>();
    return this.inv.parts.filter((p) => fits(this.gen, s, slot, p)).filter((p) => { const k = p.from + (p.barrelLength ?? ""); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  private renderSlots() {
    const it = this.sel; const box = $("wb-slots");
    if (!it) { box.innerHTML = ""; return; }
    const s = it.spec;
    const slots = slotsOf(this.gen, s);
    box.innerHTML = slots.map((slot) => {
      const cur = mounted(s, slot);
      const opts = this.compatible(slot);
      return `<div class="slot"><div class="head"><b>${SLOT_NAME[slot]}</b><span>${cur ? label(this.gen, cur.from) + (cur.barrelLength && cur.barrelLength !== 1 ? ` ×${cur.barrelLength.toFixed(2)}` : "") : "—"}</span></div>
        <div class="opts">${cur && removable(slot) ? `<button class="opt none" data-slot="${slot}" data-part="none">Quitar</button>` : ""}
        ${opts.map((p) => `<button class="opt" data-slot="${slot}" data-part="${p.uid}">${label(this.gen, p.from)}${p.barrelLength && p.barrelLength !== 1 ? ` ×${p.barrelLength.toFixed(2)}` : ""}</button>`).join("") || (cur && removable(slot) ? "" : `<span class="partsbox">Sin piezas compatibles en la caja</span>`)}</div></div>`;
    }).join("") + `<div class="slot"><div class="head"><b>Acabado</b><span>${s.paint.name}</span></div><div class="swatches">${paints().map((p, i) => `<button class="swatch ${p.name === s.paint.name ? "on" : ""}" title="${p.name}" data-paint="${i}" style="background:${p.color ? `rgb(${p.color.map((c) => Math.round(c * 255)).join(",")})` : "linear-gradient(135deg,#555,#222)"}"></button>`).join("")}</div></div>
      <div class="slot"><div class="head"><b>Caja de piezas</b><span>${this.inv.parts.length} piezas · ${this.inv.scrap} chatarra</span></div>
        <div class="partsbox">${this.partsSummary() || "Vacía. Desguaza armas para conseguir piezas."}</div>
        <button class="btn danger" data-scrap="1" ${this.inv.all.length <= 1 ? "disabled" : ""}>Desguazar esta arma</button></div>`;
  }

  private partsSummary() {
    const count = new Map<string, number>();
    for (const p of this.inv.parts) { const k = `${SLOT_NAME[p.role as Slot] ?? p.role}: ${label(this.gen, p.from)}`; count.set(k, (count.get(k) ?? 0) + 1); }
    return [...count].map(([k, n]) => `${k}${n > 1 ? ` ×${n}` : ""}`).join(" · ");
  }

  private hoverOpt(e: Event) {
    const t = (e.target as HTMLElement).closest(".opt,.swatch") as HTMLElement | null;
    if (!t || !this.sel) return;
    const clone: WeaponSpec = structuredClone(this.sel.spec);
    if (t.dataset.paint) repaint(this.gen, clone, paints()[Number(t.dataset.paint)]);
    else {
      const part = t.dataset.part === "none" ? null : this.inv.parts.find((p) => p.uid === Number(t.dataset.part)) ?? null;
      try { swap(this.gen, clone, t.dataset.slot as Slot, part); } catch { return; }
    }
    this.preview = clone; this.renderCard();
  }

  private click(e: Event) {
    const t = e.target as HTMLElement;
    if (t.closest("[data-close]")) return this.close();
    const cell = t.closest(".cell") as HTMLElement | null;
    if (cell?.dataset.uid) { this.sel = this.inv.all.find((x) => x.uid === Number(cell.dataset.uid)) ?? null; this.preview = null; return this.render(); }
    const it = this.sel; if (!it) return;
    const opt = t.closest(".opt") as HTMLElement | null;
    if (opt) {
      const slot = opt.dataset.slot as Slot;
      const part = opt.dataset.part === "none" ? null : this.inv.parts.find((p) => p.uid === Number(opt.dataset.part)) ?? null;
      const old = swap(this.gen, it.spec, slot, part);
      if (part) this.inv.parts.splice(this.inv.parts.indexOf(part), 1);
      if (old) this.inv.parts.push(old);
      it.ammo = Math.min(it.ammo, it.spec.stats.cargador);
      this.preview = null; this.onChanged(it); this.render(); this.inv.changed();
      return;
    }
    const sw = t.closest(".swatch") as HTMLElement | null;
    if (sw) { repaint(this.gen, it.spec, paints()[Number(sw.dataset.paint)]); this.preview = null; this.onChanged(it); this.render(); return; }
    if (t.closest("[data-scrap]")) {
      const where = this.inv.find(it.uid); if (!where) return;
      const r = scrap(it.spec);
      this.inv.parts.push(...r.parts); this.inv.scrap += r.scrap; this.inv.remove(where);
      this.toast(`Desguazada: +${r.parts.length} piezas, +${r.scrap} de chatarra`);
      this.sel = this.inv.current ?? this.inv.all[0] ?? null; this.render();
    }
  }
}

// ---------------------------------------------------------------------------
/** Cursor virtual: con el mando, el stick izquierdo mueve un puntero por los menús; Ⓐ hace clic. */
export class VirtualCursor {
  private el = $("vcursor");
  x = innerWidth / 2; y = innerHeight / 2;
  private last: Element | null = null;
  show(on: boolean) { this.el.hidden = !on; }
  update(dt: number, ax: number, ay: number) {
    const sp = 900 * dt, dz = 0.15;
    if (Math.abs(ax) > dz) this.x += Math.sign(ax) * Math.pow(Math.abs(ax), 1.6) * sp;
    if (Math.abs(ay) > dz) this.y += Math.sign(ay) * Math.pow(Math.abs(ay), 1.6) * sp;
    this.x = Math.max(0, Math.min(innerWidth - 4, this.x)); this.y = Math.max(0, Math.min(innerHeight - 4, this.y));
    this.el.style.transform = `translate(${this.x}px, ${this.y}px)`;
    const under = document.elementFromPoint(this.x, this.y);
    if (under !== this.last) {
      this.last?.closest(".btn,.cell,.opt,.swatch")?.classList.remove("vhover");
      under?.closest(".btn,.cell,.opt,.swatch")?.classList.add("vhover");
      under?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: this.x, clientY: this.y }));
      this.last = under;
    }
    under?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: this.x, clientY: this.y }));
  }
  click(right = false) {
    const under = document.elementFromPoint(this.x, this.y) as HTMLElement | null;
    if (!under) return;
    if (right) under.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: this.x, clientY: this.y }));
    else under.click();
  }
}
