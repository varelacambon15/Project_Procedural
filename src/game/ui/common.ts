// Piezas comunes de la interfaz: ficha de arma, losetas, fotos de armas, visor 3D, cursor circular y navegación por
// direcciones (mando y teclado). Estética de terminal de la simulación (ver menus.css).
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TYPE_INFO } from "../../weapons/generator";
import type { WeaponAssembler } from "../../weapons/assembler";
import type { StatKey, WeaponSpec } from "../../weapons/types";
import { archName, calName, holdName, damageText, effectCost, effectDesc, effectName, modeName, rarityName, typeName } from "../../weapons/labels";
import { displayName } from "../../weapons/naming";
import { t } from "../../i18n";
import type { Item } from "../inventory";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Escapa texto del jugador (nombres elegidos) antes de meterlo en HTML. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const nameOf = (s: WeaponSpec) => esc(displayName(s));
export const eraName = (s: WeaponSpec) => t(`era.${s.era ?? "modern"}`);
export const kbd = (k: string) => `<kbd>${k}</kbd>`;
/** Atajo visible: tecla de teclado y botón de mando (según el dispositivo en uso). */
export const keyHint = (kb: string, pad: string, label: string) => `<span class="hint" data-kb="${esc(kb)}" data-pad="${esc(pad)}"><kbd class="kb">${kb}</kbd><kbd class="pad">${pad}</kbd>${label}</span>`;

const STATS: [StatKey, (v: number) => string][] = [
  ["cadencia", (v) => `${Math.round(v)}${t("unit.rpm")}`],
  ["precision", (v) => `${Math.round(v)}`],
  ["alcance", (v) => `${Math.round(v)} ${t("unit.m")}`],
  ["manejo", (v) => `${Math.round(v)}`],
  ["cargador", (v) => `${Math.round(v)}`],
];

/**
 * Ficha de arma legible en 5 segundos: nombre, rareza, clase y era; daño grande; barras de estadísticas con la
 * diferencia (verde/rojo) respecto a `cmp`; y los efectos en una línea cada uno.
 */
export function weaponCard(s: WeaponSpec, cmp?: WeaponSpec | null, title = "", opts: { wide?: boolean } = {}) {
  const base = TYPE_INFO[s.type as keyof typeof TYPE_INFO].base;
  const delta = (k: StatKey) => {
    if (!cmp) return `<span class="d"></span>`;
    const d = s.stats[k] - cmp.stats[k]; if (Math.abs(d) < 0.5) return `<span class="d">=</span>`;
    return `<span class="d ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${Math.round(d)}</span>`;
  };
  const dd = cmp ? s.stats.dano - cmp.stats.dano : 0;
  const renamed = s.customName ? `<span class="orig">${esc(s.name)}</span>` : "";
  return `<div class="card ${opts.wide ? "wide" : ""}" style="--c:${s.rarity.color}">
    ${title ? `<span class="vs">${title}</span>` : ""}
    <span class="rar">${rarityName(s)} · ${typeName(s.type)} · ${eraName(s)} · ${t("label.level")} ${s.level}</span>
    <span class="nm">${nameOf(s)}</span>${renamed}
    <span class="meta">${archName(s)} · ${modeName(s)}${calName(s) ? ` · ${calName(s)}` : ""}${s.hold ? ` · ${holdName(s)}` : ""}</span>
    <div class="big"><strong>${damageText(s)}</strong><span>${t("label.damage")}</span>${cmp && Math.abs(dd) >= 0.5 ? `<span class="${dd > 0 ? "up" : "down"}">${dd > 0 ? "+" : ""}${Math.round(dd)}</span>` : ""}</div>
    <div class="stats">${STATS.map(([k, f]) => {
      const pct = Math.max(4, Math.min(100, (s.stats[k] / (k === "precision" || k === "manejo" ? 100 : base[k] * 1.8)) * 100));
      const cpct = cmp ? Math.max(4, Math.min(100, (cmp.stats[k] / (k === "precision" || k === "manejo" ? 100 : base[k] * 1.8)) * 100)) : null;
      return `<span class="k">${t(`stat.${k}`)}</span><span class="meter"><i style="width:${pct}%"></i>${cpct !== null ? `<b style="left:${cpct}%"></b>` : ""}</span><span class="v">${f(s.stats[k])}</span>${delta(k)}`;
    }).join("")}</div>
    ${s.effects.length ? `<div class="fxs">${s.effects.map((e) => `<div class="fx tier-${e.tier}"><span class="ico" style="color:${e.color}">${e.icon}</span><div><b style="color:${e.color}">${esc(effectName(e))}</b><small><span class="bonus">${esc(effectDesc(e))}</span>${effectCost(e) ? ` <span class="cost">${esc(effectCost(e))}</span>` : ""}</small></div></div>`).join("")}</div>` : `<div class="fxs none">${t("ui.noEffects")}</div>`}
  </div>`;
}

/** Loseta de arma (rejilla de inventario, lista del taller). */
export function tileHTML(it: Item, o: { sel?: boolean; slot?: number | null; inHand?: boolean; dim?: boolean; small?: boolean } = {}) {
  const s = it.spec;
  return `<button type="button" class="tile ${o.small ? "small" : ""} ${o.sel ? "sel" : ""} ${o.dim ? "dim" : ""} r-${s.rarity.id}" style="--c:${s.rarity.color}" data-uid="${it.uid}" data-nav>
    ${o.slot != null ? `<span class="slotno">${o.slot + 1}</span>` : ""}${o.inHand ? `<span class="inhand">${t("ui.inHand")}</span>` : ""}
    <img class="thumb" data-thumb="${it.uid}" alt="">
    <span class="lbl">${typeName(s.type)} · ${eraName(s)}</span><span class="nm">${nameOf(s)}</span>
    <span class="dm">${damageText(s)} <span class="ty">${t("label.lv")} ${s.level}</span></span></button>`;
}

/** Botón que pide una segunda pulsación para confirmar (confirmación suave). Devuelve true en la segunda. */
export function softConfirm(btn: HTMLElement, label: string, ms = 3000): boolean {
  if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.classList.remove("armed"); return true; }
  const prev = btn.innerHTML; btn.dataset.armed = "1"; btn.classList.add("armed"); btn.innerHTML = label;
  setTimeout(() => { if (btn.dataset.armed === "1") { btn.dataset.armed = ""; btn.classList.remove("armed"); btn.innerHTML = prev; } }, ms);
  return false;
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
      const spec = structuredClone(it.spec);
      const p = this.queue.then(async () => {
        const built = await this.asm.assemble(spec);
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

// ---------------------------------------------------------------------------
/**
 * Visor 3D de un arma (taller, inspección, pantalla de inicio): un único renderizador que se mueve al contenedor
 * visible. Giro con arrastre o stick derecho, zoom con la rueda o los gatillos. Cachea los modelos montados.
 */
export class ModelView {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 30);
  private model: THREE.Object3D | null = null;
  private token = 0; private host: HTMLElement | null = null;
  yaw = -0.2; pitch = 0.18; private spinT = 0; zoom = 1; private dist = 1; private dragging = false; private last = [0, 0];
  autoSpin = true;
  /** Portada: balanceo suave en vez de giro amplio, y en las legendarias brillo naranja de borde y chispas eléctricas. */
  showcase = false;
  private legRim: THREE.DirectionalLight | null = null; private sparks: THREE.Points | null = null; private sparkT = 0; private box = new THREE.Box3();
  /** Volver al encuadre de 3/4 en el próximo modelo (al elegir otra arma). */
  resetYaw = false;
  constructor(private asm: WeaponAssembler) {}
  private ensure() {
    if (this.renderer) return this.renderer;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.toneMapping = THREE.ACESFilmicToneMapping; r.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.4));
    const k = new THREE.DirectionalLight(0xfff0dd, 1.6); k.position.set(2, 3, 3); this.scene.add(k);
    const rim = new THREE.DirectionalLight(0x9fe8ee, 0.8); rim.position.set(-3, 1, -2); this.scene.add(rim);
    // Borde naranja de las legendarias (luz a contraluz) y chispas: cuadraditos que saltan cerca del arma
    this.legRim = new THREE.DirectionalLight(0xff9a3a, 0); this.legRim.position.set(0.5, 1.2, -3); this.scene.add(this.legRim);
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(24 * 3), 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0x9fe0ff, size: 3, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(this.sparks);
    const c = r.domElement;
    c.addEventListener("pointerdown", (e) => { this.dragging = true; this.last = [e.clientX, e.clientY]; c.setPointerCapture(e.pointerId); });
    c.addEventListener("pointermove", (e) => { if (!this.dragging) return; this.rotate((e.clientX - this.last[0]) * 0.01, (e.clientY - this.last[1]) * 0.006); this.last = [e.clientX, e.clientY]; });
    c.addEventListener("pointerup", () => { this.dragging = false; });
    c.addEventListener("wheel", (e) => { e.preventDefault(); this.zoomBy(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });
    this.renderer = r; return r;
  }
  attach(host: HTMLElement) { const r = this.ensure(); if (this.host !== host) { this.host = host; host.prepend(r.domElement); } }
  rotate(dx: number, dy = 0) { this.yaw -= dx; this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.6, 0.9); }
  zoomBy(f: number) { this.zoom = THREE.MathUtils.clamp(this.zoom * f, 0.45, 1.6); }
  async show(spec: WeaponSpec | null) {
    const my = ++this.token;
    if (!spec) { if (this.model) this.scene.remove(this.model); this.model = null; return; }
    const built = await this.asm.assemble(structuredClone(spec));
    if (my !== this.token) return;
    if (this.model) this.scene.remove(this.model);
    this.model = built.group; this.scene.add(built.group); this.dist = built.length * 1.7 + 0.08;
    this.box.setFromObject(built.group);
    if (this.legRim) this.legRim.intensity = spec.rarity.id === "legendaria" ? 2.2 : 0;
    if (this.resetYaw) { this.yaw = -0.2; this.spinT = 0; this.resetYaw = false; }
  }
  update(dt: number) {
    if (!this.renderer || !this.host || !this.host.offsetParent) return;
    const r = this.host.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
    const c = this.renderer.domElement;
    if (c.width !== Math.round(r.width * this.renderer.getPixelRatio()) || c.height !== Math.round(r.height * this.renderer.getPixelRatio())) this.renderer.setSize(r.width, r.height, false);
    this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix();
    // Giro automático: vaivén alrededor de la vista de 3/4 (nunca de punta, que la haría parecer diminuta)
    if (!this.dragging && this.autoSpin) this.spinT += dt;
    const yaw = this.yaw + (this.showcase ? Math.sin(this.spinT * 0.35) * 0.28 : Math.sin(this.spinT * 0.45) * 0.8);
    if (this.model && this.showcase) { this.model.position.y = Math.sin(this.spinT * 0.9) * 0.006; this.model.rotation.z = Math.sin(this.spinT * 0.6) * 0.025; }
    // Chispas eléctricas ocasionales (solo portada y legendarias): una ráfaga corta cada pocos segundos
    if (this.sparks) {
      const on = this.showcase && (this.legRim?.intensity ?? 0) > 0; this.sparkT -= dt;
      const m = this.sparks.material as THREE.PointsMaterial;
      if (on && this.sparkT <= 0) {
        this.sparkT = 1.8 + Math.random() * 2.5;
        const p = this.sparks.geometry.attributes.position as THREE.BufferAttribute, b = this.box, c = b.getCenter(new THREE.Vector3());
        const at = new THREE.Vector3(b.min.x + Math.random() * (b.max.x - b.min.x), c.y + (Math.random() - 0.3) * (b.max.y - b.min.y) * 0.5, c.z);
        for (let i = 0; i < p.count; i++) p.setXYZ(i, at.x + (Math.random() - 0.5) * 0.06, at.y + (Math.random() - 0.5) * 0.04, at.z + (Math.random() - 0.5) * 0.05);
        p.needsUpdate = true; m.opacity = 1;
      }
      m.opacity = on ? Math.max(0, m.opacity - dt * 5) * (Math.random() < 0.7 ? 1 : 0.3) : 0;
    }
    const d = this.dist * this.zoom;
    this.camera.position.set(Math.sin(yaw) * Math.cos(this.pitch) * d, Math.sin(this.pitch) * d, Math.cos(yaw) * Math.cos(this.pitch) * d); this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
  }
}

// ---------------------------------------------------------------------------
/**
 * Cursor circular de los menús (ratón o stick izquierdo). Con el mando va más despacio sobre los elementos
 * interactivos y Ⓐ hace clic. La navegación por direcciones (MenuNav) lo lleva al elemento con foco.
 */
export class MenuCursor {
  private el = $("vcursor");
  x = innerWidth / 2; y = innerHeight / 2;
  private last: Element | null = null;
  constructor() {
    this.place(); this.el.classList.add("idle"); // invisible hasta que se mueva (no se queda en el centro tapando el arma)
    addEventListener("mousemove", (e) => { this.el.classList.remove("idle"); this.x = e.clientX; this.y = e.clientY; this.place(); this.track(false); });
    addEventListener("mousedown", () => this.el.classList.add("press"));
    addEventListener("mouseup", () => this.el.classList.remove("press"));
  }
  show(on: boolean) { this.el.hidden = !on; document.body.classList.toggle("menu-cursor", on); }
  private place() { this.el.style.transform = `translate(${this.x}px, ${this.y}px)`; }
  private track(synthetic: boolean) {
    const under = document.elementFromPoint(this.x, this.y);
    const target = under?.closest("button,select,input,[data-nav]") ?? null;
    this.el.classList.toggle("over", !!target);
    if (under !== this.last) {
      if (synthetic) under?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: this.x, clientY: this.y }));
      this.last = under;
    }
    if (synthetic) under?.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: this.x, clientY: this.y }));
  }
  moveTo(el: HTMLElement) { const r = el.getBoundingClientRect(); this.x = r.left + r.width / 2; this.y = r.top + r.height / 2; this.place(); this.track(true); }
  update(dt: number, ax: number, ay: number) {
    const dz = 0.2, over = this.el.classList.contains("over");
    if (Math.abs(ax) > dz || Math.abs(ay) > dz) this.el.classList.remove("idle");
    const sp = (over ? 520 : 1000) * dt;
    if (Math.abs(ax) > dz) this.x += Math.sign(ax) * Math.pow(Math.abs(ax), 1.7) * sp;
    if (Math.abs(ay) > dz) this.y += Math.sign(ay) * Math.pow(Math.abs(ay), 1.7) * sp;
    this.x = Math.max(0, Math.min(innerWidth - 2, this.x)); this.y = Math.max(0, Math.min(innerHeight - 2, this.y));
    this.place();
    if (Math.abs(ax) > dz || Math.abs(ay) > dz) { this.track(true); return true; }
    return false;
  }
  click(right = false) {
    const under = document.elementFromPoint(this.x, this.y) as HTMLElement | null;
    if (!under) return;
    this.el.classList.add("press"); setTimeout(() => this.el.classList.remove("press"), 120);
    if (right) under.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: this.x, clientY: this.y }));
    else (under.closest("button,select,input,[data-nav]") as HTMLElement | null ?? under).click();
  }
}

export type Dir = "up" | "down" | "left" | "right";
/**
 * Navegación por direcciones (cruceta, flechas): mueve el foco al elemento más cercano en esa dirección dentro de la
 * pantalla activa, con foco visible. En un deslizador, izquierda/derecha cambian su valor.
 */
export class MenuNav {
  private root: HTMLElement | null = null;
  constructor(private cursor: MenuCursor) {}
  setRoot(el: HTMLElement | null) { this.root = el; }
  private items(): HTMLElement[] {
    if (!this.root) return [];
    return [...this.root.querySelectorAll<HTMLElement>("button:not([disabled]),select,input,[data-nav]")].filter((e) => e.offsetParent !== null && !e.closest("[hidden]") && !(e as HTMLButtonElement).disabled);
  }
  get current(): HTMLElement | null { const a = document.activeElement as HTMLElement | null; return a && this.root?.contains(a) ? a : null; }
  focus(el: HTMLElement | null) {
    if (!el) return;
    el.focus({ preventScroll: true }); el.scrollIntoView({ block: "nearest", inline: "nearest" });
    document.body.classList.add("nav-keys");
    this.cursor.moveTo(el);
  }
  /** Primer elemento del contenido (no el botón de volver de la barra). */
  first() { const it = this.items(); this.focus(it.find((e) => !e.closest("[data-close], .termbar")) ?? it[0] ?? null); }
  move(dir: Dir) {
    const cur = this.current;
    if (cur instanceof HTMLInputElement && cur.type === "range" && (dir === "left" || dir === "right")) {
      if (dir === "left") cur.stepDown(); else cur.stepUp();
      cur.dispatchEvent(new Event("input", { bubbles: true })); return;
    }
    const items = this.items(); if (!items.length) return;
    if (!cur) { this.focus(items[0]); return; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best: HTMLElement | null = null, bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const dx = bx - ax, dy = by - ay;
      const along = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
      const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) this.focus(best);
  }
  activate() { const c = this.current; if (c) c.click(); else this.first(); }
}
