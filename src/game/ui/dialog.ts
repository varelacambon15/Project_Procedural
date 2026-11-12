// Diálogo de texto (renombrar arma, nombrar partida) con teclado en pantalla para el mando. Valida al escribir.
import { t } from "../../i18n";
import { NAME_MAX, cleanName } from "../../weapons/naming";
import { $, esc } from "./common";

const ROWS = ["1234567890", "QWERTYUIOP", "ASDFGHJKLÑ", "ZXCVBNM-'.", "ÁÉÍÓÚÜ"];

export class TextDialog {
  private el = $("dialog");
  private resolve: ((v: string | null) => void) | null = null;
  private lower = false;
  private original = "";
  constructor() {
    this.el.addEventListener("click", (e) => this.click(e));
    this.el.addEventListener("input", () => this.validate());
    this.el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); this.ok(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.cancel(); }
    });
  }
  get isOpen() { return !this.el.hidden; }
  private get input() { return this.el.querySelector<HTMLInputElement>("input")!; }

  /** Abre el diálogo. `original` = valor al que vuelve si se deja vacío (nombre generado). Devuelve el texto o null. */
  ask(title: string, value: string, original: string, hint = ""): Promise<string | null> {
    this.original = original;
    this.el.hidden = false;
    this.el.innerHTML = `<div class="dlg panel" role="dialog" aria-modal="true">
      <h2>${title}</h2>
      <label class="field"><input type="text" maxlength="${NAME_MAX + 8}" value="${esc(value)}" spellcheck="false" autocomplete="off"><span class="count"></span></label>
      <p class="hintline">${hint || t("dlg.emptyRestores", { n: esc(original) })}</p><p class="err"></p>
      <div class="osk">${ROWS.map((r) => `<div>${[...r].map((c) => `<button type="button" class="key" data-k="${c}">${c}</button>`).join("")}</div>`).join("")}
        <div><button type="button" class="key wide" data-k="shift">${t("dlg.shift")}</button><button type="button" class="key wide" data-k=" ">${t("dlg.space")}</button><button type="button" class="key wide" data-k="del">⌫</button><button type="button" class="key wide" data-k="orig">${t("dlg.original")}</button></div></div>
      <div class="actions"><button type="button" class="btn" data-act="ok">${t("ui.confirm")}</button><button type="button" class="btn ghost" data-act="cancel">${t("ui.cancel")}</button></div></div>`;
    this.validate();
    setTimeout(() => { this.input.focus(); this.input.select(); }, 0);
    return new Promise((r) => { this.resolve = r; });
  }
  private validate() {
    const v = this.input.value, r = cleanName(v);
    this.el.querySelector(".count")!.textContent = `${[...v.trim()].length}/${NAME_MAX}`;
    this.el.querySelector(".err")!.textContent = r.ok ? "" : t(`dlg.err.${r.error}`);
    this.el.querySelector<HTMLButtonElement>('[data-act="ok"]')!.disabled = !r.ok;
    return r;
  }
  private click(e: Event) {
    const target = e.target as HTMLElement;
    const k = target.closest<HTMLElement>("[data-k]")?.dataset.k;
    if (k) {
      const inp = this.input;
      if (k === "del") inp.value = inp.value.slice(0, -1);
      else if (k === "shift") { this.lower = !this.lower; this.el.querySelectorAll<HTMLElement>(".key[data-k]").forEach((b) => { const c = b.dataset.k!; if (c.length === 1) b.textContent = this.lower ? c.toLowerCase() : c; }); }
      else if (k === "orig") inp.value = this.original;
      else inp.value += this.lower ? k.toLowerCase() : k;
      this.validate(); return;
    }
    const act = target.closest<HTMLElement>("[data-act]")?.dataset.act;
    if (act === "ok") this.ok(); else if (act === "cancel") this.cancel();
  }
  private ok() { const r = this.validate(); if (!r.ok) return; this.finish(this.input.value); }
  cancel() { this.finish(null); }
  private finish(v: string | null) { this.el.hidden = true; this.el.innerHTML = ""; const r = this.resolve; this.resolve = null; r?.(v); }
}
