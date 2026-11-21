// Asistente del hall: una pantalla con una cara (dibujada en un canvas, sin luces nuevas) que habla con la síntesis de
// voz del navegador (Web Speech API) y pone subtítulo. Tiene humor propio y reacciona a lo que pasa:
//  - al entrar en el hall te saluda por tu nombre (Ajustes → Tu nombre);
//  - si le disparas se enfada: cara roja, cejas fruncidas, interferencias y groserías (cuantos más tiros, peor);
//    con el tiempo se calma y te perdona (con retintín);
//  - al volver de una incursión (ganada o perdida), al subir de nivel, al acercarte, si lo ignoras mucho rato (se
//    aburre y se duerme) y al despertarle.
// Para que parezca vivo: respira (la cara sube y baja), parpadea a ritmo irregular (a veces doble), mueve los ojos a
// saltitos, te sigue con la mirada, ladea la cara y cambia de expresión poco a poco (las formas se interpolan); la voz
// cambia de tono y velocidad según el ánimo.
import * as THREE from "three";
import { getLang, t } from "../i18n";

export interface HallBotOpts {
  /** Dónde va la pantalla (centro) y hacia dónde mira (ángulo Y). */ pos: THREE.Vector3; rotY: number;
  /** Nombre del jugador (ajustes) y volumen 0..1. */ name: () => string; volume: () => number; voice: () => boolean;
}
/** Estados de ánimo (cada uno es una cara). */
export type Mood = "happy" | "neutral" | "angry" | "furious" | "hurt" | "sad" | "surprised" | "sleepy" | "excited" | "smug" | "curious";
export type BotEvent = "raidWon" | "raidLost" | "levelUp";

const W = 512, H = 300;
/** Cuántas frases hay de cada tipo (claves bot.<tipo>.0 … N-1 en i18n). */
export const BOT_LINES = { idle: 14, shot: 8, rage: 6, forgive: 4, near: 5, bored: 4, wake: 3, raidWon: 3, raidLost: 3, levelUp: 3, drone: 5 } as const;

/** Forma de la cara por ánimo: apertura de ojos, cejas (+ fruncidas, − de pena), sonrisa (−1..1), boca abierta, ojos felices (^ ^), color. */
interface Face { eye: number; brow: number; browY: number; smile: number; open: number; happyEyes: number; color: [number, number, number]; cheeks: number }
const FACES: Record<Mood, Face> = {
  happy: { eye: 1, brow: 0, browY: 0, smile: 1, open: 0, happyEyes: 0, color: [127, 230, 255], cheeks: 0.35 },
  neutral: { eye: 0.9, brow: 0, browY: 0, smile: 0.25, open: 0, happyEyes: 0, color: [127, 230, 255], cheeks: 0.1 },
  excited: { eye: 1, brow: -0.2, browY: 6, smile: 1, open: 0.6, happyEyes: 1, color: [140, 255, 200], cheeks: 0.55 },
  smug: { eye: 0.55, brow: 0.2, browY: 0, smile: 0.7, open: 0, happyEyes: 0, color: [150, 220, 255], cheeks: 0.25 },
  curious: { eye: 1.15, brow: -0.25, browY: 8, smile: 0.2, open: 0.15, happyEyes: 0, color: [150, 210, 255], cheeks: 0.1 },
  surprised: { eye: 1.35, brow: -0.1, browY: 14, smile: 0, open: 0.8, happyEyes: 0, color: [190, 230, 255], cheeks: 0 },
  sad: { eye: 0.75, brow: -0.7, browY: 2, smile: -0.7, open: 0, happyEyes: 0, color: [110, 150, 255], cheeks: 0 },
  hurt: { eye: 0.45, brow: -0.7, browY: 0, smile: -0.5, open: 0.35, happyEyes: 0, color: [255, 190, 120], cheeks: 0 },
  angry: { eye: 0.7, brow: 0.8, browY: -4, smile: -0.6, open: 0.2, happyEyes: 0, color: [255, 110, 80], cheeks: 0 },
  furious: { eye: 0.55, brow: 1, browY: -8, smile: -1, open: 0.7, happyEyes: 0, color: [255, 50, 40], cheeks: 0 },
  sleepy: { eye: 0.1, brow: -0.15, browY: -2, smile: 0.1, open: 0, happyEyes: 0, color: [90, 140, 200], cheeks: 0 },
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export class HallBot {
  readonly mesh: THREE.Group;
  /** Mallas a las que se puede disparar (la pantalla y el marco): llevan `userData.onShot`. */
  readonly hitMeshes: THREE.Mesh[] = [];
  private cv = document.createElement("canvas");
  private ctx = this.cv.getContext("2d")!;
  private tex: THREE.CanvasTexture;
  private time = 0; private blinkT = 2.5; private blink = 0; private doubleBlink = false;
  private talkT = 0; private sub = ""; private subT = 0;
  private idleT = 25; private lastLine: Record<string, number> = {}; private greetCd = 0; private wasIn = false;
  private look = new THREE.Vector2(); private gaze = new THREE.Vector2(); private saccade = new THREE.Vector2(); private saccT = 1;
  /** Ánimo actual (con su duración), ánimo al que vuelve y cara interpolada. */
  private mood: Mood = "happy"; private moodT = 0; private base: Mood = "happy";
  private face: Face = { ...FACES.happy, color: [...FACES.happy.color] as [number, number, number] };
  /** Enfado acumulado por disparos (baja con el tiempo) y momento del último insulto. */
  private anger = 0; private lastInsult = -9; private shake = 0; private glitch = 0;
  /** Tiempo ignorándole en el hall (se aburre y se duerme) y si el jugador estaba cerca. */
  private ignored = 0; private asleep = false; private wasNear = false; private nearCd = 0;
  private tilt = 0; private tiltTo = 0; private tiltT = 3;
  private pending: { text: string; mood: Mood } | null = null;

  constructor(private o: HallBotOpts) {
    this.cv.width = W; this.cv.height = H;
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.8, 0.16), new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.5, roughness: 0.45 }));
    frame.position.z = -0.06; g.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.6), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    screen.position.z = 0.03; g.add(screen);
    for (const x of [-0.9, 0.9]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), frame.material); arm.position.set(x, 0, -0.25); g.add(arm); }
    for (const m of [screen, frame]) { m.userData.onShot = () => this.shot(); this.hitMeshes.push(m); }
    g.position.copy(o.pos); g.rotation.y = o.rotY; g.scale.setScalar(1.15); this.mesh = g;
    this.draw();
  }

  // ---------- Reacciones ----------
  /** Le han disparado: se enfada (más con cada tiro) y suelta una grosería (no a cada bala: como mucho cada 1,3 s). */
  shot() {
    this.anger = Math.min(10, this.anger + 1); this.shake = 0.35; this.glitch = 0.25; this.ignored = 0;
    this.asleep = false;
    const furious = this.anger >= 5;
    if (this.time - this.lastInsult > 1.3) { this.lastInsult = this.time; this.line(furious ? "rage" : "shot", furious ? "furious" : "angry", true); }
    else this.setMood(furious ? "furious" : this.anger >= 2 ? "angry" : "hurt", 2);
  }
  /** Han disparado a un dron de mantenimiento: sale en su defensa (enfado leve). */
  defendDrone() {
    this.anger = Math.min(10, this.anger + 0.6);
    if (this.time - this.lastInsult > 2.5) { this.lastInsult = this.time; this.line("drone", "angry", true); }
  }
  /** Algo ha pasado fuera del hall: lo comenta la próxima vez que entres. */
  event(e: BotEvent) { this.pending = { text: this.pick(e), mood: e === "raidLost" ? "sad" : "excited" }; }

  /** Cada fotograma: `inHall` = el jugador está en el hall; `player` y `camDir` (dirección de la cámara) para mirarle. */
  update(dt: number, inHall: boolean, player: THREE.Vector3, camDir?: THREE.Vector3) {
    this.time += dt; this.greetCd = Math.max(0, this.greetCd - dt); this.nearCd = Math.max(0, this.nearCd - dt);
    this.shake = Math.max(0, this.shake - dt); this.glitch = Math.max(0, this.glitch - dt);
    // El enfado se pasa poco a poco; al calmarse del todo, te perdona (con retintín)
    if (this.anger > 0) { const was = this.anger; this.anger = Math.max(0, this.anger - dt * 0.3); if (was > 0 && this.anger === 0) this.line("forgive", "smug"); }
    if (inHall && !this.wasIn) {
      this.ignored = 0;
      if (this.pending) { this.say(this.pending.text, this.pending.mood); this.pending = null; this.greetCd = 90; }
      else if (this.greetCd <= 0) { this.greet(); this.greetCd = 90; }
      this.idleT = 35 + Math.random() * 25;
    }
    this.wasIn = inHall;
    const head = this.mesh.position, d = Math.hypot(player.x - head.x, player.z - head.z);
    // ¿Le está mirando el jugador? (cámara apuntando a la pantalla)
    const toBot = new THREE.Vector3(head.x - player.x, head.y - player.y - 1.6, head.z - player.z).normalize();
    const watched = inHall && !!camDir && camDir.dot(toBot) > 0.95 && d < 22;
    if (inHall) {
      this.ignored = Math.max(0, this.ignored + (watched || d < 5 ? -dt * 4 : dt));
      // Se duerme si lo ignoras mucho rato; se despierta sobresaltado si te acercas o le miras
      if (!this.asleep && this.ignored > 70 && this.anger === 0 && this.talkT <= 0) { this.asleep = true; this.line("bored", "sleepy"); }
      else if (this.asleep && this.talkT <= 0 && (d < 6 || watched)) { this.asleep = false; this.ignored = 0; this.line("wake", "surprised"); }
      // Te acercas: curiosidad (no siempre habla)
      const near = d < 5;
      if (near && !this.wasNear && this.nearCd <= 0 && this.anger < 1 && !this.asleep && this.talkT <= 0) { this.nearCd = 40; if (Math.random() < 0.6) this.line("near", "curious"); else this.setMood("curious", 3); }
      this.wasNear = near;
      if (!this.asleep && this.anger < 1 && this.talkT <= 0 && (this.idleT -= dt) <= 0) { this.line("idle", Math.random() < 0.3 ? "smug" : "happy"); this.idleT = 45 + Math.random() * 40; }
    }
    this.base = this.asleep ? "sleepy" : this.anger > 3 ? "angry" : this.anger > 0.5 ? "neutral" : "happy";
    if ((this.moodT -= dt) <= 0) this.mood = this.base;
    // Parpadeo irregular (a veces doble); dormido no parpadea
    if ((this.blinkT -= dt) <= 0 && !this.asleep) { this.blink = 0.14; this.blinkT = this.doubleBlink ? 0.22 : 1.6 + Math.random() * 4; this.doubleBlink = !this.doubleBlink && Math.random() < 0.2; }
    this.blink = Math.max(0, this.blink - dt);
    // Mirada: hacia el jugador, con saltitos de vez en cuando; enfadado te clava la vista
    const local = this.mesh.worldToLocal(player.clone().setY(player.y + 1.6));
    this.look.set(THREE.MathUtils.clamp(local.x / 7, -1, 1), THREE.MathUtils.clamp(local.y / 5, -1, 1));
    if ((this.saccT -= dt) <= 0) { this.saccT = 0.6 + Math.random() * 2.2; this.saccade.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3); if (this.anger > 1) this.saccade.multiplyScalar(0.1); }
    const tgt = inHall ? this.look.clone().add(this.saccade) : this.saccade.clone().multiplyScalar(2);
    this.gaze.lerp(tgt, Math.min(1, dt * 12));
    // Ladeo de la cara de vez en cuando (más con curiosidad)
    if ((this.tiltT -= dt) <= 0) { this.tiltT = 2 + Math.random() * 4; this.tiltTo = (Math.random() - 0.5) * (this.mood === "curious" ? 0.35 : 0.14); }
    this.tilt = lerp(this.tilt, this.tiltTo, Math.min(1, dt * 3));
    // La cara se transforma hacia la del ánimo actual
    const f = FACES[this.mood], k = Math.min(1, dt * 6);
    for (const key of ["eye", "brow", "browY", "smile", "open", "happyEyes", "cheeks"] as const) this.face[key] = lerp(this.face[key], f[key], k);
    for (let i = 0; i < 3; i++) this.face.color[i] = lerp(this.face.color[i], f.color[i], k);
    this.talkT = Math.max(0, this.talkT - dt); this.subT = Math.max(0, this.subT - dt);
    this.draw();
  }

  /** Saludo con tu nombre (o uno genérico si no hay nombre). */
  greet() {
    const n = this.o.name().trim(), k = Math.floor(Math.random() * 3);
    this.say(n ? t(`bot.hello.${k}`, { n }) : t(`bot.helloAnon.${k}`), "happy");
  }
  private pick(kind: keyof typeof BOT_LINES) {
    const n = BOT_LINES[kind]; let k = Math.floor(Math.random() * n); if (n > 1 && k === this.lastLine[kind]) k = (k + 1) % n; this.lastLine[kind] = k;
    return t(`bot.${kind}.${k}`, { n: this.o.name().trim() || t("bot.friend") });
  }
  private line(kind: keyof typeof BOT_LINES, mood: Mood, interrupt = false) { this.say(this.pick(kind), mood, interrupt); }
  private setMood(m: Mood, sec: number) { this.mood = m; this.moodT = sec; }

  /** Dice una frase: voz (si hay y está activada) + subtítulo; la boca se mueve mientras habla. */
  say(text: string, mood: Mood = "happy", interrupt = true) {
    if (!interrupt && this.talkT > 0) return;
    this.sub = text; const est = 0.9 + text.length * 0.06; this.talkT = est; this.subT = est + 2.5;
    this.setMood(mood, est + 1.5);
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || !this.o.voice()) return;
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text), lang = getLang() === "es" ? "es-ES" : "en-US";
      u.lang = lang; u.volume = Math.max(0, Math.min(1, this.o.volume()));
      // La voz cambia con el ánimo: enfadado más grave y rápido; triste, lento; dormido, muy lento
      const angry = mood === "angry" || mood === "furious";
      u.pitch = angry ? 0.85 : mood === "sad" ? 1.05 : mood === "excited" ? 1.6 : mood === "sleepy" ? 0.9 : 1.35;
      u.rate = angry ? 1.2 : mood === "sad" ? 0.9 : mood === "sleepy" ? 0.8 : mood === "excited" ? 1.12 : 1.04;
      const v = ss.getVoices().find((x) => x.lang === lang) ?? ss.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      u.onend = () => { this.talkT = 0; this.subT = 2; };
      ss.speak(u);
    } catch { /* sin voz: queda el subtítulo */ }
  }
  /** Calla. */
  hush() { try { window.speechSynthesis?.cancel(); } catch { /* */ } this.talkT = 0; }

  // ---------- Dibujo ----------
  private draw() {
    const c = this.ctx, talk = this.talkT > 0, f = this.face;
    const col = `rgb(${f.color.map((x) => Math.round(x)).join(",")})`, bg = this.anger > 0.5 ? `rgb(${14 + Math.round(this.anger * 4)},8,10)` : "#06121c";
    // Fondo con líneas de barrido; enfadado, tinte rojo
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(90,200,255,0.05)"; for (let y = (this.time * 40) % 6; y < H; y += 6) c.fillRect(0, y, W, 2);
    // Respiración, temblor (al recibir un tiro o furioso) y ladeo
    const breathe = Math.sin(this.time * 1.6) * 3, sh = this.shake > 0 || this.mood === "furious" ? (Math.random() - 0.5) * (6 + this.shake * 30) : 0;
    c.translate(W / 2 + sh, 126 + breathe + sh * 0.5); c.rotate(this.tilt);
    const cx = this.gaze.x * 16, cy = -this.gaze.y * 9;
    c.shadowColor = col; c.shadowBlur = 18; c.fillStyle = col; c.strokeStyle = col; c.lineCap = "round"; c.lineJoin = "round";
    // Ojos (o arcos ^ ^ si está contentísimo) con su brillo
    const open = (this.blink > 0 ? 0.08 : 1) * f.eye, eh = Math.max(3, 46 * open);
    for (const s of [-1, 1]) {
      const ex = cx + s * 80;
      if (f.happyEyes > 0.5 && this.blink <= 0) { c.lineWidth = 9; c.beginPath(); c.arc(ex, cy + 8, 24, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
      else {
        c.beginPath(); c.ellipse(ex, cy, 30, eh / 2, 0, 0, Math.PI * 2); c.fill();
        if (this.blink <= 0 && open > 0.3) { c.save(); c.shadowBlur = 0; c.fillStyle = bg; c.beginPath(); c.arc(ex + 8, cy - 9 * open, 7 * Math.min(1, open), 0, Math.PI * 2); c.fill(); c.restore(); }
      }
      // Cejas: el extremo interior baja con el enfado (brow > 0) y sube con la pena (brow < 0)
      if (Math.abs(f.brow) > 0.08) {
        const by = cy - 40 - f.browY, inner = ex - s * 30, outer = ex + s * 30;
        c.lineWidth = 8; c.beginPath(); c.moveTo(inner, by + f.brow * 14); c.lineTo(outer, by - f.brow * 6); c.stroke();
      }
    }
    // Mejillas
    if (f.cheeks > 0.05) { c.save(); c.shadowBlur = 0; c.fillStyle = `rgba(255,140,170,${f.cheeks})`; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 125, cy + 42, 22, 11, 0, 0, Math.PI * 2); c.fill(); } c.restore(); }
    // Boca: curva (sonrisa o mueca) que se abre al hablar o con la sorpresa; furioso enseña los dientes
    const mo = talk ? 0.25 + Math.abs(Math.sin(this.time * 17)) * 0.55 + Math.abs(Math.sin(this.time * 7.3)) * 0.25 : f.open;
    const my = cy + 62, mw = this.mood === "furious" ? 46 : 38, curve = f.smile * 22;
    c.lineWidth = 9;
    if (this.mood === "sleepy" && !talk) { c.beginPath(); c.ellipse(cx, my, 10, 7, 0, 0, Math.PI * 2); c.stroke(); }
    else if (mo > 0.12) {
      c.beginPath(); c.moveTo(cx - mw, my - curve * 0.4); c.quadraticCurveTo(cx, my + curve * 0.6, cx + mw, my - curve * 0.4);
      c.quadraticCurveTo(cx, my + curve * 0.6 + 10 + mo * 40, cx - mw, my - curve * 0.4); c.fill();
      if (this.mood === "furious") { c.save(); c.shadowBlur = 0; c.fillStyle = bg; for (let i = -2; i <= 2; i++) c.fillRect(cx + i * 15 - 2, my - 6, 4, 14 + mo * 12); c.restore(); }
    } else { c.beginPath(); c.moveTo(cx - mw, my - curve * 0.5); c.quadraticCurveTo(cx, my + curve, cx + mw, my - curve * 0.5); c.stroke(); }
    c.setTransform(1, 0, 0, 1, 0, 0); c.shadowBlur = 0;
    // Dormido: zetas que suben
    if (this.mood === "sleepy" && !talk) { c.fillStyle = col; c.font = "700 34px system-ui, sans-serif"; for (let i = 0; i < 3; i++) { const p = (this.time * 0.4 + i / 3) % 1; c.globalAlpha = 1 - p; c.fillText("z", W / 2 + 120 + p * 40, 90 - p * 70); } c.globalAlpha = 1; }
    // Muy enfadado: vena palpitante en la esquina
    if (this.anger > 3) { c.strokeStyle = "#ff4030"; c.lineWidth = 6; const x = W - 70, y = 50, r = 14 + Math.sin(this.time * 12) * 2; for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; c.beginPath(); c.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, a + Math.PI * 0.75, a + Math.PI * 1.25); c.stroke(); } }
    // Interferencias al recibir un tiro: franjas desplazadas y destello rojo
    if (this.glitch > 0) { for (let i = 0; i < 6; i++) { const y = Math.random() * H, h = 6 + Math.random() * 18; c.drawImage(this.cv, 0, y, W, h, (Math.random() - 0.5) * 60, y, W, h); } c.fillStyle = "rgba(255,40,40,0.14)"; c.fillRect(0, 0, W, H); }
    // Subtítulo
    if (this.subT > 0 && this.sub) {
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(0, H - 74, W, 74);
      c.fillStyle = this.anger > 0.5 ? "#ffd0c8" : "#e8f8ff"; c.font = "700 25px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      const lines = wrap(c, this.sub, W - 40).slice(0, 2);
      lines.forEach((l, i) => c.fillText(l, W / 2, H - 54 + i * 29 + (lines.length === 1 ? 14 : 0)));
      c.textAlign = "start"; c.textBaseline = "alphabetic";
    }
    this.tex.needsUpdate = true;
  }
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []; let cur = "";
  for (const w of text.split(" ")) { const s = cur ? `${cur} ${w}` : w; if (c.measureText(s).width > max && cur) { out.push(cur); cur = w; } else cur = s; }
  if (cur) out.push(cur); return out;
}
