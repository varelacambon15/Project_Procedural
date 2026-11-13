// Inicio y pausa en una sola pantalla con identidad: título, versión, menú (jugar/continuar, partidas, ajustes,
// controles, idioma, salir) y un panel que muestra el arma equipada girando, los ajustes, las ranuras o los controles.
import { LANGS, getLang, setLang, t, type Lang } from "../../i18n";
import { PIXEL_LEVELS, pixelLevel, setPixelLevel } from "../../weapons/textures";
import { settings, setSetting, type Settings } from "../settings";
import { AUTO, SLOTS, type SlotId, type SlotSummary } from "../save";
import { $, esc, keyHint, softConfirm, type ModelView } from "./common";
import type { WeaponSpec } from "../../weapons/types";

type Panel = "show" | "settings" | "saves" | "controls";
export interface StartHooks {
  /** "title" antes de empezar; "pause" con una partida en curso. */
  mode(): "title" | "pause";
  play(): void; newGame(): void;
  hasSaves(): boolean;
  continueLatest(): void;
  listSlots(): Promise<SlotSummary[]>;
  save(slot: SlotId): Promise<void>; load(slot: SlotId): Promise<void>; remove(slot: SlotId): Promise<void>;
  exportSlot(slot: SlotId): Promise<void>; importSlot(slot: SlotId): Promise<void>;
  quit(): void; canQuit(): boolean;
  current(): WeaponSpec | null;
}
export const VERSION = "0.5.0";

export class StartScreen {
  private el = $("start");
  private panel: Panel = "show";
  private slots: SlotSummary[] = [];
  constructor(private view: ModelView, private hooks: StartHooks) {
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("input", (e) => this.input(e));
  }
  get isOpen() { return !this.el.hidden; }
  open(panel: Panel = "show") { this.el.hidden = false; this.panel = panel; this.render(); if (panel === "saves") void this.refreshSlots(); }
  close() { this.el.hidden = true; }
  /** Ⓑ / Esc: vuelve al panel principal; si ya está ahí y hay partida, vuelve al juego. */
  back() { if (this.panel !== "show") { this.panel = "show"; this.render(); this.el.querySelector<HTMLElement>(".mainmenu button")?.focus(); return true; } if (this.hooks.mode() === "pause") { this.hooks.play(); return true; } return false; }

  render() {
    const pause = this.hooks.mode() === "pause";
    $("start-ver").textContent = `v${VERSION} · ${t("ui.simBuild")}`;
    $("start-mode").textContent = pause ? t("ui.pause") : t("ui.simReady");
    const items: [string, string, boolean][] = pause
      ? [["play", t("ui.resume"), true], ["saves", t("ui.saves"), true], ["settings", t("ui.settings"), true], ["controls", t("ui.controls"), true], ["lang", `${t("ui.language")}: ${LANGS.find((l) => l.id === getLang())!.name}`, true], ["title", t("ui.toTitle"), true]]
      : [["continue", t("ui.continue"), this.hooks.hasSaves()], ["new", t("ui.newGame"), true], ["saves", t("ui.load"), true], ["settings", t("ui.settings"), true], ["controls", t("ui.controls"), true], ["lang", `${t("ui.language")}: ${LANGS.find((l) => l.id === getLang())!.name}`, true], ["quit", t("ui.quit"), this.hooks.canQuit()]];
    $("start-menu").innerHTML = items.filter(([, , show]) => show).map(([id, label]) => `<button type="button" class="mi ${this.panel === id ? "on" : ""}" data-menu="${id}"><span class="caret">▸</span>${label}</button>`).join("");
    const sub = $("start-sub");
    sub.dataset.panel = this.panel;
    if (this.panel === "show") {
      const w = this.hooks.current();
      sub.innerHTML = `<div class="showcase"><div class="viewport" id="start-view"></div><div class="showcap">${w ? `<span class="rar" style="color:${w.rarity.color}">${t(`rarity.${w.rarity.id}`)}</span><b style="color:${w.rarity.color}">${esc(w.customName || w.name)}</b>` : ""}<p>${t(pause ? "ui.pauseIntro" : "ui.intro")}</p></div></div>`;
      this.view.attach($("start-view")); this.view.autoSpin = true; this.view.zoom = 1.35; void this.view.show(w);
    } else if (this.panel === "settings") sub.innerHTML = this.settingsHTML();
    else if (this.panel === "controls") sub.innerHTML = this.controlsHTML();
    else sub.innerHTML = this.savesHTML(pause);
    $("start-foot").innerHTML = keyHint("↑↓", "✚", t("ui.navigate")) + keyHint("Enter", "Ⓐ", t("ui.select")) + keyHint("Esc", "Ⓑ", t("ui.back"));
  }

  // ---------- Ajustes ----------
  private settingsHTML() {
    const s = settings;
    const range = (k: keyof Settings, min: number, max: number, step: number, fmt: (v: number) => string) =>
      `<label class="row"><span>${t(`set.${k}`)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${s[k]}" data-set="${k}"><output>${fmt(s[k] as number)}</output></label>`;
    const toggle = (k: keyof Settings) => `<div class="row"><span>${t(`set.${k}`)}</span><button type="button" class="tog ${s[k] ? "on" : ""}" data-tog="${k}">${s[k] ? t("ui.on") : t("ui.off")}</button></div>`;
    return `<h2>${t("ui.settings")}</h2><div class="settings">
      ${range("sensitivity", 0.3, 2.5, 0.05, (v) => `${v.toFixed(2)}×`)}
      ${range("fov", 60, 100, 1, (v) => `${v}°`)}
      <div class="row"><span>${t("set.pixel")}</span><div class="seg">${PIXEL_LEVELS.map((p) => `<button type="button" class="chip ${p === pixelLevel() ? "on" : ""}" data-px="${p}">${p}</button>`).join("")}</div></div>
      ${range("volume", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      ${range("music", 0, 1, 0.05, (v) => `${Math.round(v * 100)}%`)}
      ${toggle("damageNumbers")}${toggle("impactFx")}${toggle("screenShake")}${toggle("arms")}${toggle("night")}${toggle("bloom")}
      <div class="row"><span>${t("ui.language")}</span><div class="seg">${LANGS.map((l) => `<button type="button" class="chip ${l.id === getLang() ? "on" : ""}" data-lang="${l.id}">${l.name}</button>`).join("")}</div></div>
      <p class="note">${t("set.saved")}</p></div>`;
  }
  private input(e: Event) {
    const el = e.target as HTMLInputElement; const k = el.dataset.set as keyof Settings | undefined; if (!k) return;
    setSetting(k, Number(el.value) as never);
    const out = el.parentElement?.querySelector("output"); if (out) out.textContent = k === "volume" || k === "music" ? `${Math.round(Number(el.value) * 100)}%` : k === "fov" ? `${el.value}°` : `${Number(el.value).toFixed(2)}×`;
  }

  // ---------- Controles ----------
  private controlsHTML() {
    const kb: [string, string][] = [["WASD", "c.move"], ["Mouse", "c.look"], ["LMB / RMB", "c.fire"], ["R", "c.reload"], ["1 · 2 · Q · wheel", "c.swap"], ["Shift · Space", "c.sprint"], ["C · Ctrl", "c.crouch"], ["F", "c.inspect"], ["E", "c.use"], ["Tab", "c.inv"], ["Esc", "c.pause"], ["N · P · L", "c.toggles"]];
    const pad: [string, string][] = [["Sticks", "c.sticks"], ["RT / LT", "c.fire"], ["Ⓧ", "c.reload"], ["Ⓨ", "c.swap"], ["Ⓐ · L3", "c.sprint"], ["R3", "c.crouch"], ["✚ ↓", "c.inspect"], ["Ⓑ", "c.use"], ["View", "c.inv"], ["Start", "c.pause"], ["✚ · Ⓐ · Ⓑ", "c.menus.d"]];
    const dl = (rows: [string, string][]) => `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${t(v)}</dd>`).join("")}</dl>`;
    return `<h2>${t("ui.controls")}</h2><div class="ctrl"><div><h3>${t("ui.kbm")}</h3>${dl(kb)}</div><div><h3>${t("ui.pad")}</h3>${dl(pad)}</div></div>`;
  }

  // ---------- Partidas ----------
  async refreshSlots() { this.slots = await this.hooks.listSlots(); if (this.panel === "saves") { const f = (document.activeElement as HTMLElement | null)?.dataset; $("start-sub").innerHTML = this.savesHTML(this.hooks.mode() === "pause"); if (f?.slotAct) this.el.querySelector<HTMLElement>(`[data-slot-act="${f.slotAct}"][data-slot="${f.slot}"]`)?.focus(); } }
  private savesHTML(pause: boolean) {
    const fmt = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return d.toLocaleString(getLang() === "es" ? "es-ES" : "en-GB", { dateStyle: "short", timeStyle: "short" }); };
    const rows = [AUTO, ...SLOTS].map((slot) => {
      const s: SlotSummary = this.slots.find((x) => x.slot === slot) ?? { slot: slot as SlotId, empty: true };
      const title = slot === AUTO ? t("save.auto") : t("save.slot", { n: SLOTS.indexOf(slot as never) + 1 });
      const info = s.error ? `<span class="down">${t(`save.err.${s.error}`)}</span>` : s.empty ? `<span class="dim">${t("save.empty")}</span>`
        : `<b>${esc(s.name || title)}</b><span>${fmt(s.savedAt)}</span><span>${s.credits} ${t("unit.cr")} · ${t("save.weapons", { n: s.weapons ?? 0 })}${s.best ? ` · <i style="color:var(--r-${s.best})">${t(`rarity.${s.best}`)}</i>` : ""}</span>`;
      const can = { load: !s.empty && !s.error, save: pause && slot !== AUTO, del: !s.empty, exp: !s.empty && !s.error, imp: slot !== AUTO };
      const b = (act: string, label: string, ok: boolean, cls = "ghost") => ok ? `<button type="button" class="btn ${cls} sm" data-slot-act="${act}" data-slot="${slot}" ${act === "save" && !s.empty ? `data-confirm="${t("save.overwrite")}"` : act === "del" ? `data-confirm="${t("save.confirmDel")}"` : ""}>${label}</button>` : "";
      return `<div class="slotrow ${s.error ? "bad" : ""}"><div class="sn">${title}</div><div class="si">${info}</div><div class="sa">
        ${b("load", t("save.load"), can.load, "")}${b("save", s.empty ? t("save.save") : t("save.overwriteShort"), can.save)}${b("exp", t("save.export"), can.exp)}${b("imp", t("save.import"), can.imp)}${b("del", t("save.delete"), can.del, "danger")}
        ${s.error && slot !== AUTO ? `<span class="note">${t("save.tryAuto")}</span>` : ""}</div></div>`;
    }).join("");
    return `<h2>${pause ? t("ui.saves") : t("ui.load")}</h2><div class="slots">${rows}</div><p class="note">${t("save.help")}</p>`;
  }

  private async click(e: Event) {
    const target = e.target as HTMLElement;
    const m = target.closest<HTMLElement>("[data-menu]")?.dataset.menu;
    if (m) {
      if (m === "play") return this.hooks.play();
      if (m === "continue") return this.hooks.continueLatest();
      if (m === "new") return this.hooks.newGame();
      if (m === "quit") return this.hooks.quit();
      if (m === "title") { const b = target.closest<HTMLElement>("[data-menu]")!; if (!softConfirm(b, t("ui.toTitleConfirm"))) return; return this.hooks.quit(); }
      if (m === "lang") { const i = LANGS.findIndex((l) => l.id === getLang()); setLang(LANGS[(i + 1) % LANGS.length].id); this.render(); this.el.querySelector<HTMLElement>('[data-menu="lang"]')?.focus(); return; }
      this.panel = this.panel === m ? "show" : (m as Panel); this.render();
      if (this.panel === "saves") void this.refreshSlots();
      this.el.querySelector<HTMLElement>(`[data-menu="${m}"]`)?.focus();
      return;
    }
    const tog = target.closest<HTMLElement>("[data-tog]")?.dataset.tog as keyof Settings | undefined;
    if (tog) { setSetting(tog, !settings[tog] as never); this.render(); this.el.querySelector<HTMLElement>(`[data-tog="${tog}"]`)?.focus(); return; }
    const px = target.closest<HTMLElement>("[data-px]")?.dataset.px;
    if (px) { setPixelLevel(Number(px)); this.render(); this.el.querySelector<HTMLElement>(`[data-px="${px}"]`)?.focus(); return; }
    const lang = target.closest<HTMLElement>("[data-lang]")?.dataset.lang;
    if (lang) { setLang(lang as Lang); this.render(); this.el.querySelector<HTMLElement>(`[data-lang="${lang}"]`)?.focus(); return; }
    const sb = target.closest<HTMLElement>("[data-slot-act]");
    if (sb) {
      const slot = sb.dataset.slot as SlotId, act = sb.dataset.slotAct!;
      if (sb.dataset.confirm && !softConfirm(sb, sb.dataset.confirm)) return;
      if (act === "load") await this.hooks.load(slot);
      else if (act === "save") await this.hooks.save(slot);
      else if (act === "del") await this.hooks.remove(slot);
      else if (act === "exp") await this.hooks.exportSlot(slot);
      else if (act === "imp") await this.hooks.importSlot(slot);
      await this.refreshSlots();
    }
  }
}
