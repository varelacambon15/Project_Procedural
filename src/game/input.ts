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
  device: "kbm" | "pad";
}

const DZ = 0.16;
const stick = (v: number, curve: number) => { const a = Math.abs(v); if (a < DZ) return 0; return Math.sign(v) * Math.pow((a - DZ) / (1 - DZ), curve); };

export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0 };
  private padPrev: boolean[] = [];
  device: "kbm" | "pad" = "kbm";
  sensitivity = 0.0022;
  padSensitivity = 3.2;
  /** Factor de asistencia de apuntado (lo pone el juego cuando la mira pasa por un objetivo). */
  assist = 1;
  /** Controles táctiles (se activan al primer toque). */
  readonly touch = new TouchControls();
  /** Radianes por píxel arrastrado en la pantalla táctil (se multiplica por la sensibilidad del ajuste). */
  touchSensitivity = 0.0052;

  constructor(private canvas: HTMLCanvasElement) {
    addEventListener("keydown", (e) => {
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
    if (now.some(Boolean) || p.axes.some((a) => Math.abs(a) > 0.3)) this.device = "pad";
    return edges;
  }

  read(dt: number, edges: boolean[]): Frame {
    const k = (c: string) => this.keys.has(c), kp = (c: string) => this.pressed.has(c);
    const f: Frame = {
      moveX: (k("KeyD") ? 1 : 0) - (k("KeyA") ? 1 : 0), moveZ: (k("KeyW") ? 1 : 0) - (k("KeyS") ? 1 : 0),
      lookX: this.mouse.dx * this.sensitivity, lookY: this.mouse.dy * this.sensitivity,
      fire: this.mouse.left, aim: this.mouse.right, sprint: k("ShiftLeft"), crouch: k("KeyC") || k("ControlLeft"),
      jump: kp("Space"), reload: kp("KeyR"), interact: kp("KeyE"), swap: this.mouse.wheel !== 0 || kp("KeyQ"),
      inventory: kp("Tab") || kp("KeyI"), pause: kp("Escape"), slot1: kp("Digit1"), slot2: kp("Digit2"), inspect: kp("KeyF"), device: this.device,
    };
    this.mouse.dx = this.mouse.dy = 0; this.mouse.wheel = 0; this.pressed.clear();
    const p = this.pad();
    if (p) {
      const b = (i: number) => !!p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.5);
      f.moveX += stick(p.axes[0] ?? 0, 1); f.moveZ -= stick(p.axes[1] ?? 0, 1);
      f.lookX += stick(p.axes[2] ?? 0, 2.2) * this.padSensitivity * this.assist * dt;
      f.lookY += stick(p.axes[3] ?? 0, 2.2) * this.padSensitivity * 0.75 * this.assist * dt;
      f.fire ||= b(7); f.aim ||= b(6); f.sprint ||= b(10); f.crouch ||= b(11);
      f.inventory ||= !!edges[8]; f.pause ||= !!edges[9];
      // Mando: Ⓐ saltar, Ⓑ interactuar, Ⓧ recargar, Ⓨ cambiar arma, View inventario, Start pausa
      f.interact ||= !!edges[1];
      f.inspect ||= !!edges[13]; // cruceta abajo
    }
    const t = this.touch;
    if (t.active) {
      const tk = this.touchSensitivity * (this.sensitivity / 0.0022);
      f.moveX += t.moveX; f.moveZ += t.moveZ; f.lookX += t.lookDX * tk; f.lookY += t.lookDY * tk; t.lookDX = t.lookDY = 0;
      f.fire ||= t.fire; f.aim ||= t.aim; f.sprint ||= t.sprint; f.crouch ||= t.crouch;
      const tp = (b: string) => t.pressed.has(b);
      f.jump ||= tp("jump"); f.reload ||= tp("reload"); f.interact ||= tp("use"); f.swap ||= tp("swap");
      f.inventory ||= tp("inv"); f.pause ||= tp("pause"); f.inspect ||= tp("inspect");
      t.pressed.clear();
    }
    const len = Math.hypot(f.moveX, f.moveZ); if (len > 1) { f.moveX /= len; f.moveZ /= len; }
    return f;
  }
}
