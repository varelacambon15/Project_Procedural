// Asistente del hall: una pantalla con una cara amigable (dibujada en un canvas, sin luces nuevas) que habla con la
// síntesis de voz del navegador (Web Speech API). Saluda por tu nombre al entrar en el hall y, de vez en cuando,
// suelta un comentario. Lo que dice también aparece escrito bajo la cara (subtítulo). Sin voz disponible, solo texto.
import * as THREE from "three";
import { getLang, t } from "../i18n";

export interface HallBotOpts {
  /** Dónde va la pantalla (centro) y hacia dónde mira (ángulo Y). */ pos: THREE.Vector3; rotY: number;
  /** Nombre del jugador (ajustes) y volumen 0..1. */ name: () => string; volume: () => number; voice: () => boolean;
}

const W = 512, H = 300;
/** Cuántas frases de relleno hay (bot.idle.0 … bot.idle.N-1 en i18n). */
export const BOT_IDLE_LINES = 14;

export class HallBot {
  readonly mesh: THREE.Group;
  private cv = document.createElement("canvas");
  private ctx = this.cv.getContext("2d")!;
  private tex: THREE.CanvasTexture;
  private time = 0; private blinkT = 2.5; private blink = 0;
  private talkT = 0; private sub = ""; private subT = 0;
  private idleT = 25; private lastIdle = -1; private greetCd = 0; private wasIn = false;
  private look = new THREE.Vector2();

  constructor(private o: HallBotOpts) {
    this.cv.width = W; this.cv.height = H;
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.9, 1.8, 0.16), new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.5, roughness: 0.45 }));
    frame.position.z = -0.06; g.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.6), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false }));
    screen.position.z = 0.03; g.add(screen);
    // Soporte: dos brazos cortos hacia la pared
    for (const x of [-0.9, 0.9]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), frame.material); arm.position.set(x, 0, -0.25); g.add(arm); }
    g.position.copy(o.pos); g.rotation.y = o.rotY; g.scale.setScalar(1.3); this.mesh = g;
    this.draw();
  }

  /** Cada fotograma: `inHall` = el jugador está en el hall; `player` para que los ojos le sigan. */
  update(dt: number, inHall: boolean, player: THREE.Vector3) {
    this.time += dt; this.greetCd = Math.max(0, this.greetCd - dt);
    if (inHall && !this.wasIn && this.greetCd <= 0) { this.greet(); this.greetCd = 90; this.idleT = 35 + Math.random() * 25; }
    this.wasIn = inHall;
    if (inHall && this.talkT <= 0 && (this.idleT -= dt) <= 0) { this.idle(); this.idleT = 45 + Math.random() * 40; }
    // Parpadeo y mirada hacia el jugador (en el plano de la pantalla)
    if ((this.blinkT -= dt) <= 0) { this.blink = 0.16; this.blinkT = 2 + Math.random() * 3.5; }
    this.blink = Math.max(0, this.blink - dt);
    const local = this.mesh.worldToLocal(player.clone().setY(player.y + 1.6));
    this.look.set(THREE.MathUtils.clamp(local.x / 8, -1, 1), THREE.MathUtils.clamp(local.y / 6, -1, 1));
    this.talkT = Math.max(0, this.talkT - dt); this.subT = Math.max(0, this.subT - dt);
    this.draw();
  }

  /** Saludo con tu nombre (o uno genérico si no hay nombre). */
  greet() {
    const n = this.o.name().trim(), k = Math.floor(Math.random() * 3);
    this.say(n ? t(`bot.hello.${k}`, { n }) : t(`bot.helloAnon.${k}`));
  }
  private idle() {
    let k = Math.floor(Math.random() * BOT_IDLE_LINES); if (k === this.lastIdle) k = (k + 1) % BOT_IDLE_LINES; this.lastIdle = k;
    this.say(t(`bot.idle.${k}`, { n: this.o.name().trim() || t("bot.friend") }));
  }

  /** Dice una frase: voz (si hay y está activada) + subtítulo; la boca se mueve mientras habla. */
  say(text: string) {
    this.sub = text; const est = 0.9 + text.length * 0.06; this.talkT = est; this.subT = est + 2.5;
    const ss = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!ss || !this.o.voice()) return;
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text), lang = getLang() === "es" ? "es-ES" : "en-US";
      u.lang = lang; u.pitch = 1.35; u.rate = 1.04; u.volume = Math.max(0, Math.min(1, this.o.volume()));
      const v = ss.getVoices().find((x) => x.lang === lang) ?? ss.getVoices().find((x) => x.lang.startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      u.onstart = () => { this.talkT = Math.max(this.talkT, 0.5); };
      u.onend = () => { this.talkT = 0; this.subT = 2; };
      ss.speak(u);
    } catch { /* sin voz: queda el subtítulo */ }
  }
  /** Calla (al salir del hall a una incursión, pausar…). */
  hush() { try { window.speechSynthesis?.cancel(); } catch { /* */ } this.talkT = 0; }

  private draw() {
    const c = this.ctx, talk = this.talkT > 0;
    // Fondo: azul oscuro con líneas de barrido
    c.fillStyle = "#06121c"; c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(90,200,255,0.05)"; for (let y = (this.time * 40) % 6; y < H; y += 6) c.fillRect(0, y, W, 2);
    const cx = W / 2 + this.look.x * 14, cy = 120 - this.look.y * 8, glow = "#7fe6ff";
    c.shadowColor = glow; c.shadowBlur = 18; c.fillStyle = glow; c.strokeStyle = glow; c.lineCap = "round";
    // Ojos: redondos, con parpadeo (se aplastan) y un brillo
    const eh = this.blink > 0 ? 6 : 44 + Math.sin(this.time * 1.3) * 2;
    for (const s of [-1, 1]) {
      const ex = cx + s * 80;
      c.beginPath(); c.ellipse(ex, cy, 30, eh / 2, 0, 0, Math.PI * 2); c.fill();
      if (this.blink <= 0) { c.save(); c.shadowBlur = 0; c.fillStyle = "#06121c"; c.beginPath(); c.arc(ex + 8, cy - 9, 7, 0, Math.PI * 2); c.fill(); c.restore(); }
    }
    // Mejillas
    c.save(); c.shadowBlur = 0; c.fillStyle = "rgba(255,140,170,0.35)"; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(cx + s * 125, cy + 42, 22, 11, 0, 0, Math.PI * 2); c.fill(); } c.restore();
    // Boca: sonrisa en reposo; al hablar se abre y cierra
    c.lineWidth = 9; c.beginPath();
    if (talk) { const open = 8 + Math.abs(Math.sin(this.time * 17)) * 18 + Math.abs(Math.sin(this.time * 7.3)) * 8; c.ellipse(cx, cy + 66, 30, open / 2, 0, 0, Math.PI * 2); c.fill(); }
    else { c.arc(cx, cy + 40, 40, Math.PI * 0.18, Math.PI * 0.82); c.stroke(); }
    c.shadowBlur = 0;
    // Subtítulo
    if (this.subT > 0 && this.sub) {
      c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(0, H - 74, W, 74);
      c.fillStyle = "#e8f8ff"; c.font = "700 25px system-ui, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
      const lines = wrap(c, this.sub, W - 40).slice(0, 2);
      lines.forEach((l, i) => c.fillText(l, W / 2, H - 54 + i * 29 + (lines.length === 1 ? 13 : 0)));
    }
    this.tex.needsUpdate = true;
  }
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = []; let cur = "";
  for (const w of text.split(" ")) { const s = cur ? `${cur} ${w}` : w; if (c.measureText(s).width > max && cur) { out.push(cur); cur = w; } else cur = s; }
  if (cur) out.push(cur); return out;
}
