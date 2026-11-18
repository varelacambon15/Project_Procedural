// Capa de entrada abstracta: el juego pregunta por acciones, no por teclas. Teclado/ratón, mando y táctil a la vez.
import { TouchControls } from "./touch";

export interface Frame {
  moveX: number; moveZ: number;          // -1..1 (Z positivo = adelante)
  lookX: number; lookY: number;          // radianes a girar este fotograma
  fire: boolean; aim: boolean;           // mantenidos
  jump: boolean; reload: boolean; interact: boolean; swap: boolean; inventory: boolean; pause: boolean; // pulsados este fotograma
  sprint: boolean;
  /** Agacharse (mantenido); agacharse corriendo = deslizarse. */
  crouch: boolean;
  slot1: boolean; slot2: boolean; inspect: boolean;
  /** Lanzar granada (G / RB / botón táctil). */ grenade: boolean;
  /** Invocar el súper (V / cruceta arriba / botón táctil). */ super: boolean;
  device: "kbm" | "pad";
  /** Botón Ⓧ del mando, como en Call of Duty: mantenido = recoger/usar lo que hay cerca. */
  holdUse?: boolean;
}

const DZ = 0.16;
const stick = (v: number, curve: number) => { const a = Math.abs(v); if (a < DZ) return 0; return Math.sign(v) * Math.pow((a - DZ) / (1 - DZ), curve); };

/** Acciones del teclado y su tecla por defecto (el ratón dispara y apunta). */
export const DEFAULT_BINDS: Record<string, string> = {
  forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", jump: "Space", sprint: "ShiftLeft", crouch: "KeyC",
  reload: "KeyR", use: "KeyE", swap: "KeyQ", slot1: "Digit1", slot2: "Digit2", inspect: "KeyF", grenade: "KeyG", super: "KeyV", inventory: "KeyI",
};
export const BIND_ORDER = Object.keys(DEFAULT_BINDS);
/** Botones del mando por acción (índices del mando estándar). Por defecto, al estilo Call of Duty. */
export const DEFAULT_PAD: Record<string, number> = { fire: 7, aim: 6, jump: 0, useReload: 2, crouch: 1, swap: 3, grenade: 5, super: 4, sprint: 10, inspect: 13 };
export const PAD_ORDER = Object.keys(DEFAULT_PAD);
/** Nombre de un botón del mando estándar. */
export const PAD_NAMES = ["Ⓐ", "Ⓑ", "Ⓧ", "Ⓨ", "LB", "RB", "LT", "RT", "View", "Start", "L3", "R3", "✚↑", "✚↓", "✚←", "✚→"];

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0 };
  private padPrev: boolean[] = [];
  device: "kbm" | "pad" = "kbm";
  sensitivity = 0.0022;
  /** Modos de alternar (pulsar para activar/desactivar) e inversión del eje vertical (ajustes). */
  toggles = { sprint: false, aim: false, crouch: false }; invertY = false;
  private held = { sprint: false, aim: false, crouch: false }; private on = { sprint: false, aim: false, crouch: false };
  /** Teclas por acción (se pueden cambiar en Controles). */
  binds: Record<string, string> = { ...DEFAULT_BINDS };
  /** Acción a la espera de tecla nueva (menú de controles). */
  private capture: ((code: string) => void) | null = null;
  captureKey(f: (code: string) => void) { this.capture = f; }
  /** Botones del mando por acción y captura de un botón nuevo (menú de controles). */
  padBinds: Record<string, number> = { ...DEFAULT_PAD };
  private padCapture: ((btn: number) => void) | null = null;
  /** Ⓧ: tiempo mantenido (pulsar y soltar = recargar; mantener 0,35 s = recoger/usar) y progreso para el aviso (0..1). */
  private useT = -1; private useDone = false; useHold = 0;
  capturePad(f: (btn: number) => void) { this.padCapture = f; }
  padSensitivity = 3.2;
  /** Factor de asistencia de apuntado (lo pone el juego cuando la mira pasa por un objetivo). */
  assist = 1;
  /** Controles táctiles (se activan al primer toque). */
  readonly touch = new TouchControls();
  /** Radianes por píxel arrastrado en la pantalla táctil (se multiplica por la sensibilidad del ajuste). */
  touchSensitivity = 0.0052;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener("keydown", (e) => {
      if (this.capture) { e.preventDefault(); const f = this.capture; this.capture = null; if (e.code !== "Escape") f(e.code); else f(""); return; }
      if (e.repeat) return;
      this.keys.add(e.code); this.pressed.add(e.code); this.device = "kbm";
      if (["Tab", "Space"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });
    addEventListener("mousemove", (e) => { if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; } });
    canvas.addEventListener("mousedown", (e) => { if (!this.locked) return; if (e.button === 0) this.mouse.left = true; if (e.button === 2) this.mouse.right = true; this.device = "kbm"; });
    addEventListener("mouseup", (e) => { if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    addEventListener("wheel", (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => { if (this.locked && !this.wantLock) document.exitPointerLock(); });
  }

  /** Olvida las teclas pulsadas (al volver de un menú, para que Esc o E no actúen dos veces). */
  flush() { this.pressed.clear(); this.mouse.wheel = 0; this.touch.release(); }
  get locked() { return document.pointerLockElement === this.canvas; }
  /** Si el juego quiere el ratón capturado. Una captura que llega tarde (ya en un menú) se suelta enseguida. */
  private wantLock = false;
  lock() { this.wantLock = true; try { const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* el navegador puede negarse */ } }
  unlock() { this.wantLock = false; if (this.locked) document.exitPointerLock(); }

  pad(): Gamepad | null { for (const p of navigator.getGamepads?.() ?? []) if (p?.connected) return p; return null; }

  /** Botones del mando pulsados este fotograma (flanco de subida). */
  padEdges(): boolean[] {
    const p = this.pad(); if (!p) return [];
    const now = p.buttons.map((b) => b.pressed || b.value > 0.5);
    const edges = now.map((v, i) => v && !this.padPrev[i]);
    this.padPrev = now;
    if (this.padCapture) { const i = edges.findIndex(Boolean); if (i >= 0 && i !== 9) { const f = this.padCapture; this.padCapture = null; f(i); return []; } if (edges[9]) { const f = this.padCapture; this.padCapture = null; f(-1); return []; } }
    if (now.some(Boolean) || p.axes.some((a) => Math.abs(a) > 0.3)) this.device = "pad";
    return edges;
  }

  read(dt: number, edges: boolean[]): Frame {
    const B = this.binds, k = (a: string) => this.keys.has(B[a]) || (a === "crouch" && this.keys.has("ControlLeft")), kp = (a: string) => this.pressed.has(B[a]);
    const f: Frame = {
      moveX: (k("right") ? 1 : 0) - (k("left") ? 1 : 0), moveZ: (k("forward") ? 1 : 0) - (k("back") ? 1 : 0),
      lookX: this.mouse.dx * this.sensitivity, lookY: this.mouse.dy * this.sensitivity,
      fire: this.mouse.left, aim: this.mouse.right, sprint: k("sprint"), crouch: k("crouch"),
      jump: kp("jump"), reload: kp("reload"), interact: kp("use"), swap: this.mouse.wheel !== 0 || kp("swap"),
      inventory: kp("inventory") || this.pressed.has("Tab"), pause: this.pressed.has("Escape"), slot1: kp("slot1"), slot2: kp("slot2"), inspect: kp("inspect"), grenade: kp("grenade"), super: kp("super"), device: this.device,
    };
    this.mouse.dx = this.mouse.dy = 0; this.mouse.wheel = 0; this.pressed.clear();
    const p = this.pad();
    if (p) {
      const b = (i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      f.moveX += stick(p.axes[0] ?? 0, 1); f.moveZ -= stick(p.axes[1] ?? 0, 1);
      f.lookX += stick(p.axes[2] ?? 0, 2.2) * this.padSensitivity * this.assist * dt;
      f.lookY += stick(p.axes[3] ?? 0, 2.2) * this.padSensitivity * 0.75 * this.assist * dt;
      // Mando (configurable; por defecto como Call of Duty): RT disparar, LT apuntar, Ⓐ saltar, Ⓧ usar/recargar,
      // Ⓑ agacharse, Ⓨ cambiar arma, RB granada, LB súper, L3 correr, ✚↓ inspeccionar, View inventario, Start pausa
      const P = this.padBinds, e = (a: string) => !!edges[P[a]];
      f.fire ||= b(P.fire); f.aim ||= b(P.aim); f.sprint ||= b(P.sprint); f.crouch ||= b(P.crouch);
      f.jump ||= e("jump"); f.swap ||= e("swap"); f.inspect ||= e("inspect"); f.grenade ||= e("grenade"); f.super ||= e("super");
      const uh = b(P.useReload);
      if (uh) {
        if (this.useT < 0) { this.useT = 0; this.useDone = false; }
        this.useT += dt; this.useHold = Math.min(1, this.useT / 0.35);
        if (!this.useDone && this.useT >= 0.35) { this.useDone = true; f.holdUse = true; }
      } else if (this.useT >= 0) { if (!this.useDone) f.reload = true; this.useT = -1; this.useHold = 0; }
      f.inventory ||= !!edges[8]; f.pause ||= !!edges[9];
    }
    const t = this.touch;
    if (t.active) {
      const tk = this.touchSensitivity * (this.sensitivity / 0.0022);
      f.moveX += t.moveX; f.moveZ += t.moveZ; f.lookX += t.lookDX * tk; f.lookY += t.lookDY * tk; t.lookDX = t.lookDY = 0;
      f.fire ||= t.fire; f.aim ||= t.aim; f.sprint ||= t.sprint; f.crouch ||= t.crouch;
      const tp = (b: string) => t.pressed.has(b);
      f.jump ||= tp("jump"); f.reload ||= tp("reload"); f.interact ||= tp("use"); f.swap ||= tp("swap");
      f.inventory ||= tp("inv"); f.pause ||= tp("pause"); f.inspect ||= tp("inspect"); f.grenade ||= tp("nade"); f.super ||= tp("super");
      t.pressed.clear();
    }
    const len = Math.hypot(f.moveX, f.moveZ); if (len > 1) { f.moveX /= len; f.moveZ /= len; }
    // Alternar: cada pulsación (flanco) cambia el estado; correr se apaga al dejar de avanzar
    for (const a of ["sprint", "aim", "crouch"] as const) {
      const now = f[a], edge = now && !this.held[a]; this.held[a] = now;
      if (!this.toggles[a] || (a === "aim" && t.active)) continue; // (el táctil ya alterna el apuntado)
      if (edge) this.on[a] = !this.on[a];
      if (a === "sprint" && f.moveZ < 0.3) this.on.sprint = false;
      f[a] = this.on[a];
    }
    if (this.invertY) f.lookY = -f.lookY;
    return f;
  }
}
