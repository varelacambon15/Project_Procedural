// Registro de sesión (modo desarrollador): capturas automáticas y notas con marca de tiempo, más un registro de eventos y de
// rendimiento, para revisar una partida después sin haberla visto. Todo se guarda en local (en el exe, en Documentos/ProvingGrounds/sesiones).
// La lógica no toca el DOM: la captura y la escritura a disco se inyectan (así se prueba en Node).

export interface SessionIO { write(rel: string, base64: string): Promise<void> }
export interface PerfSample { calls: number; tris: number }

/** Eventos que además hacen una captura. */
const KEY_EVENTS = new Set(["muerte", "fin-oleada", "fin-incursion", "botin-legendario", "inicio", "nota", "marca", "error"]);
export const AUTO_EVERY = 60;   // segundos entre capturas automáticas
export const MAX_CAPTURES = 200;
const FLUSH_EVERY = 5, PERF_EVERY = 10;

const b64 = (s: string) => { const u = new TextEncoder().encode(s); let bin = ""; for (const c of u) bin += String.fromCharCode(c); return btoa(bin); };
const pad = (n: number, w = 2) => String(n).padStart(w, "0");
export const sessionName = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
const clock = (t: number) => `${pad(Math.floor(t / 60))}:${pad(Math.floor(t % 60))}`;

interface Row { t: number; e: string; [k: string]: unknown }
interface CapInfo { file: string; t: number; reason: string }

export class SessionRecorder {
  active = false; noteOpen = false;
  private dir = ""; private t = 0; private rows: Row[] = []; private caps: CapInfo[] = []; private pending: string | null = null;
  private counts = new Map<string, number>(); private fpsSamples: number[] = []; private callsMax = 0; private trisMax = 0;
  private autoT = 0; private flushT = 0; private perfT = 0; private frames = 0; private startedAt = new Date(); private errors: string[] = [];

  /** io: escritura a disco (null = no hay dónde guardar); grab: devuelve la captura actual en JPEG base64; perf/ctx: datos para el registro. */
  constructor(private io: SessionIO | null, private grab: () => Promise<string | null>, private perf: () => PerfSample, private ctx: () => Record<string, unknown>) {}

  start(now = new Date()) {
    if (this.active) return;
    this.active = true; this.startedAt = now; this.dir = sessionName(now); this.t = 0; this.rows = []; this.caps = []; this.pending = null;
    this.counts.clear(); this.fpsSamples = []; this.callsMax = this.trisMax = 0; this.autoT = this.flushT = this.perfT = 0; this.frames = 0; this.errors = [];
    this.event("sesion-inicio", this.ctx());
  }

  stop() {
    if (!this.active) return;
    this.event("sesion-fin", this.ctx());
    this.active = false; this.noteOpen = false;
    void this.flush(true);
  }

  /** Cada fotograma. */
  tick(dt: number) {
    if (!this.active) return;
    this.t += dt; this.frames++; this.autoT += dt; this.perfT += dt; this.flushT += dt;
    if (this.autoT >= AUTO_EVERY) { this.autoT = 0; this.request("auto"); }
    if (this.perfT >= PERF_EVERY) {
      const fps = this.frames / this.perfT, p = this.perf();
      this.fpsSamples.push(fps); this.callsMax = Math.max(this.callsMax, p.calls); this.trisMax = Math.max(this.trisMax, p.tris);
      this.rows.push({ t: +this.t.toFixed(1), e: "rendimiento", fps: +fps.toFixed(1), calls: p.calls, tris: p.tris, ...this.ctx() });
      this.perfT = 0; this.frames = 0;
    }
    if (this.flushT >= FLUSH_EVERY) { this.flushT = 0; void this.flush(false); }
  }

  event(name: string, data: Record<string, unknown> = {}) {
    if (!this.active) return;
    this.counts.set(name, (this.counts.get(name) ?? 0) + 1);
    this.rows.push({ t: +this.t.toFixed(1), e: name, ...data });
    if (KEY_EVENTS.has(name)) this.request(name);
  }
  note(text: string) { const s = text.trim().slice(0, 300); if (s) this.event("nota", { texto: s }); }
  mark() { this.event("marca"); }
  error(msg: string) { if (!this.active) return; if (this.errors.length < 50) this.errors.push(`${clock(this.t)} ${msg.slice(0, 200)}`); this.event("error", { mensaje: msg.slice(0, 200) }); }

  private request(reason: string) { if (this.caps.length < MAX_CAPTURES && !this.pending) this.pending = reason; }

  /** Se llama justo después de dibujar el fotograma: aquí se hace la captura pendiente. */
  afterRender() {
    if (!this.active || !this.pending) return;
    const reason = this.pending; this.pending = null;
    void this.grab().then((data) => {
      if (!data || !this.io) return;
      const file = `cap-${pad(this.caps.length + 1, 3)}-${clock(this.t).replace(":", "m")}-${reason.replace(/[^a-z0-9-]/gi, "")}.jpg`;
      this.caps.push({ file, t: +this.t.toFixed(1), reason });
      void this.io.write(`${this.dir}/${file}`, data).catch(() => undefined);
    }).catch(() => undefined);
  }

  /** Texto del resumen (se escribe al terminar). */
  summary(): string {
    const fps = this.fpsSamples, avg = fps.length ? fps.reduce((a, b) => a + b, 0) / fps.length : 0, min = fps.length ? Math.min(...fps) : 0;
    const notes = this.rows.filter((r) => r.e === "nota");
    const lines = [
      `# Sesión ${this.dir}`, "",
      `- Duración: ${clock(this.t)} (${Math.round(this.t)} s). Inicio: ${this.startedAt.toLocaleString("es-ES")}.`,
      `- Rendimiento: FPS medio ${avg.toFixed(1)}, mínimo ${min.toFixed(1)}; máx. llamadas de dibujo ${this.callsMax}, máx. triángulos ${this.trisMax}.`,
      `- Capturas: ${this.caps.length}. Errores: ${this.errors.length}.`, "",
      "## Eventos", ...[...this.counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`), "",
      "## Notas", ...(notes.length ? notes.map((r) => `- ${clock(r.t)} — ${String(r.texto)}`) : ["- (ninguna)"]), "",
      "## Errores", ...(this.errors.length ? this.errors.map((e) => `- ${e}`) : ["- (ninguno)"]), "",
      "## Capturas", ...this.caps.map((c) => `- ${clock(c.t)} ${c.reason}: ${c.file}`), "",
    ];
    return lines.join("\n");
  }

  async flush(final: boolean) {
    if (!this.io) return;
    try {
      await this.io.write(`${this.dir}/eventos.jsonl`, b64(this.rows.map((r) => JSON.stringify(r)).join("\n") + "\n"));
      if (final) await this.io.write(`${this.dir}/resumen.md`, b64(this.summary()));
    } catch { /* si el disco falla, el juego sigue */ }
  }
}
