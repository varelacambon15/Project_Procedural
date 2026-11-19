// Jugador en primera persona: movimiento con inercia, sprint, salto y colisión contra cajas.
import * as THREE from "three";
import type { Frame } from "./input";

const SLIDE = 0.9; // duración del deslizamiento (s)

export class Player {
  /** Velocidad extra (árbol de habilidades). */ speedMult = 1;
  readonly pos = new THREE.Vector3(0, 0, 6);
  readonly vel = new THREE.Vector3();
  yaw = Math.PI; pitch = 0; // (de cara al interior del hall)
  onGround = true;
  readonly radius = 0.35;
  /** Altura de los ojos: baja al agacharse o deslizarse. */
  get eye() { return 1.65 - 0.55 * this.crouchK; }
  /** 0 de pie … 1 agachado (suavizado). */
  crouchK = 0;
  /** Deslizamiento: tiempo restante, dirección y velocidad inicial; slideK (0..1) para la cámara. */
  private slideT = 0; private slideDir = new THREE.Vector3(); private slideV = 0; private prevCrouch = false; private wasSprinting = false;
  slideK = 0;
  get sliding() { return this.slideT > 0; }
  sprinting = false;
  bob = 0;
  /** Embestida corta del cuerpo a cuerpo: velocidad extra durante unas décimas (respeta las colisiones). */
  private lungeV = new THREE.Vector3(); private lungeT = 0;
  lunge(dir: THREE.Vector3, dist: number, time = 0.12) { this.lungeV.copy(dir).setY(0).normalize().multiplyScalar(dist / time); this.lungeT = time; }

  /** Levitación (súper Gravedad cero): flota a `floatH` m mientras dura; luego cae con la gravedad normal. */
  floatT = 0; floatH = 2.2;
  levitate(sec: number, h: number) { this.floatT = Math.max(this.floatT, sec); this.floatH = h; }
  constructor(private colliders: THREE.Box3[]) {}

  update(dt: number, f: Frame, aiming: boolean, lookScale: number) {
    this.yaw -= f.lookX * lookScale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - f.lookY * lookScale, -1.45, 1.45);
    const hsNow = Math.hypot(this.vel.x, this.vel.z);
    // Deslizamiento: agacharse mientras se esprinta (en el suelo y con velocidad) lanza un deslizamiento con impulso
    if (f.crouch && !this.prevCrouch && this.wasSprinting && this.onGround && hsNow > 5) {
      this.slideT = SLIDE; this.slideDir.set(this.vel.x, 0, this.vel.z).normalize(); this.slideV = Math.min(10.5, hsNow + 2.6);
    }
    this.prevCrouch = f.crouch;
    if (this.slideT > 0 && (!f.crouch || (!this.onGround && this.vel.y > 0))) this.slideT = 0; // soltar o saltar termina el deslizamiento (con su inercia)
    this.crouchK += ((f.crouch || this.slideT > 0 ? 1 : 0) - this.crouchK) * Math.min(1, dt * 12);
    this.slideK += ((this.slideT > 0 ? 1 : 0) - this.slideK) * Math.min(1, dt * 10);
    this.sprinting = f.sprint && f.moveZ > 0.3 && !aiming && !f.crouch && this.slideT <= 0;
    this.wasSprinting = this.sprinting;
    const speed = (aiming ? 2.6 : this.sprinting ? 7.2 : this.crouchK > 0.5 ? 2.4 : 4.6) * this.speedMult;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f.moveZ).add(right.multiplyScalar(f.moveX)).multiplyScalar(speed);
    if (this.slideT > 0) {
      // Durante el deslizamiento la velocidad cae poco a poco hacia la de ir agachado; se puede corregir un poco
      this.slideT -= dt;
      const k = Math.max(0, this.slideT / SLIDE), v = 2.4 + (this.slideV - 2.4) * Math.pow(k, 0.7);
      this.slideDir.addScaledVector(wish.clone().setY(0).normalize(), dt * 0.9).setY(0).normalize();
      this.vel.x = this.slideDir.x * v; this.vel.z = this.slideDir.z * v;
    } else {
      const accel = this.onGround ? 14 : 3;
      this.vel.x += (wish.x - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (wish.z - this.vel.z) * Math.min(1, accel * dt);
    }
    if (f.jump && this.onGround) { this.vel.y = 5.2; this.onGround = false; }
    if (this.floatT > 0) { this.floatT -= dt; this.vel.y = (this.floatH - this.pos.y) * 2.5; this.onGround = false; }
    else this.vel.y -= 16 * dt;
    this.move(this.vel.x * dt, 0); this.move(0, this.vel.z * dt);
    if (this.lungeT > 0) { const k = Math.min(dt, this.lungeT); this.lungeT -= dt; this.move(this.lungeV.x * k, 0); this.move(0, this.lungeV.z * k); }
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 0) { this.pos.y = 0; this.vel.y = 0; this.onGround = true; }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround) this.bob += dt * hs * 1.9;
  }

  private move(dx: number, dz: number) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    for (const b of this.colliders) {
      if (this.pos.y > b.max.y - 0.05 || this.pos.y + 1.8 < b.min.y) continue;
      if (nx + this.radius > b.min.x && nx - this.radius < b.max.x && nz + this.radius > b.min.z && nz - this.radius < b.max.z) return;
    }
    this.pos.x = nx; this.pos.z = nz;
  }

  applyCamera(cam: THREE.PerspectiveCamera, recoilPitch: number) {
    const bobY = Math.sin(this.bob * 2) * 0.025, bobX = Math.cos(this.bob) * 0.015;
    cam.position.set(this.pos.x + bobX, this.pos.y + this.eye + bobY, this.pos.z);
    cam.rotation.set(this.pitch + recoilPitch, this.yaw, -0.06 * this.slideK, "YXZ"); // leve inclinación al deslizarse
  }
}
