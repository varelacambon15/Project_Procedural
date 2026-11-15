// Controles táctiles (móvil / APK): joystick virtual a la izquierda, arrastrar a la derecha para mirar y botones.
// Se activan solos al primer toque en la pantalla; el ratón y el mando siguen funcionando a la vez.
// Disparar también deja arrastrar para mirar (el pulgar derecho no tiene que soltar el botón para apuntar).

export interface TouchState {
  moveX: number; moveZ: number; lookDX: number; lookDY: number;
  fire: boolean; aim: boolean; sprint: boolean; crouch: boolean;
  /** Botones pulsados desde la última lectura: jump, reload, use, swap, inv, pause, inspect. */
  pressed: Set<string>;
}

const STICK_R = 56; // radio del joystick (px)

export class TouchControls implements TouchState {
  active = false;
  moveX = 0; moveZ = 0; lookDX = 0; lookDY = 0;
  fire = false; aim = false; sprint = false; crouch = false;
  pressed = new Set<string>();
  private el: HTMLDivElement;
  private knob!: HTMLDivElement; private base!: HTMLDivElement;
  private stickId: number | null = null; private stickO = { x: 0, y: 0 };
  /** Dedos que giran la cámara (zona derecha o arrastrando desde disparar), con su última posición. */
  private lookers = new Map<number, { x: number; y: number }>();
  private aimToggle = false;

  constructor() {
    this.el = document.createElement("div"); this.el.id = "touch"; this.el.hidden = true;
    this.el.innerHTML = `
      <div class="t-look" data-zone="look"></div>
      <div class="t-stickzone" data-zone="stick"><div class="t-base"><div class="t-knob"></div></div></div>
      <button class="t-btn t-fire" data-b="fire">●</button>
      <button class="t-btn t-aim" data-b="aim">◎</button>
      <button class="t-btn t-jump" data-b="jump">⤒</button>
      <button class="t-btn t-reload" data-b="reload">R</button>
      <button class="t-btn t-crouch" data-b="crouch">⤓</button>
      <button class="t-btn t-sm t-nade" data-b="nade">✹</button>
      <button class="t-btn t-use" data-b="use">E</button>
      <button class="t-btn t-swap" data-b="swap">⇄</button>
      <button class="t-btn t-sm t-inv" data-b="inv">☰</button>
      <button class="t-btn t-sm t-pause" data-b="pause">II</button>`;
    document.body.appendChild(this.el);
    this.base = this.el.querySelector(".t-base")!; this.knob = this.el.querySelector(".t-knob")!;
    this.el.addEventListener("pointerdown", (e) => this.down(e));
    this.el.addEventListener("pointermove", (e) => this.move(e));
    for (const ev of ["pointerup", "pointercancel"]) this.el.addEventListener(ev, (e) => this.up(e as PointerEvent));
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("touchstart", () => this.enable(), { passive: true });
  }

  enable() { if (this.active) return; this.active = true; this.el.hidden = false; document.body.classList.add("touch"); }

  private down(e: PointerEvent) {
    e.preventDefault();
    const t = e.target as HTMLElement;
    try { (t as Element).setPointerCapture?.(e.pointerId); } catch { /* sin captura: el dedo sigue funcionando dentro del elemento */ }
    const b = t.closest<HTMLElement>("[data-b]")?.dataset.b;
    if (b) {
      t.closest("[data-b]")!.classList.add("on");
      if (b === "fire") { this.fire = true; this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY }); }
      else if (b === "aim") { this.aimToggle = !this.aimToggle; this.aim = this.aimToggle; }
      else if (b === "crouch") this.crouch = true;
      else this.pressed.add(b);
      return;
    }
    const zone = t.closest<HTMLElement>("[data-zone]")?.dataset.zone;
    if (zone === "stick" && this.stickId === null) {
      this.stickId = e.pointerId; this.stickO = { x: e.clientX, y: e.clientY };
      this.base.style.left = `${e.clientX}px`; this.base.style.top = `${e.clientY}px`; this.base.classList.add("on");
      this.knob.style.transform = "translate(-50%, -50%)";
    } else if (zone === "look") this.lookers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  private move(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      let dx = e.clientX - this.stickO.x, dy = e.clientY - this.stickO.y;
      const len = Math.hypot(dx, dy); if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
      this.moveX = dx / STICK_R; this.moveZ = -dy / STICK_R;
      // Empujar a fondo hacia delante = correr
      this.sprint = len > STICK_R * 1.15 && this.moveZ > 0.6;
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const l = this.lookers.get(e.pointerId);
    if (l) { this.lookDX += e.clientX - l.x; this.lookDY += e.clientY - l.y; l.x = e.clientX; l.y = e.clientY; }
  }
  private up(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      this.stickId = null; this.moveX = this.moveZ = 0; this.sprint = false;
      this.base.classList.remove("on"); this.knob.style.transform = "translate(-50%, -50%)";
    }
    this.lookers.delete(e.pointerId);
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-b]");
    if (btn) {
      btn.classList.remove("on");
      if (btn.dataset.b === "fire") this.fire = false;
      if (btn.dataset.b === "crouch") this.crouch = false;
    }
  }
  /** Al abrir un menú: soltar todo (que no se quede disparando o andando). */
  release() {
    this.stickId = null; this.moveX = this.moveZ = 0; this.sprint = this.fire = this.crouch = this.aim = this.aimToggle = false; this.lookers.clear();
    this.lookDX = this.lookDY = 0; this.pressed.clear();
    this.el.querySelectorAll(".on").forEach((x) => x.classList.remove("on"));
  }
}
