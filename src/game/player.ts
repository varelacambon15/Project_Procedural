// Jugador en primera persona: movimiento con inercia, sprint, salto y colisión contra cajas.
import * as THREE from "three";
import type { Frame } from "./input";

export class Player {
  readonly pos = new THREE.Vector3(0, 0, 6);
  readonly vel = new THREE.Vector3();
  yaw = 0; pitch = 0;
  onGround = true;
  readonly radius = 0.35;
  readonly eye = 1.65;
  sprinting = false;
  bob = 0;
  /** Embestida corta del cuerpo a cuerpo: velocidad extra durante unas décimas (respeta las colisiones). */
  private lungeV = new THREE.Vector3(); private lungeT = 0;
  lunge(dir: THREE.Vector3, dist: number, time = 0.12) { this.lungeV.copy(dir).setY(0).normalize().multiplyScalar(dist / time); this.lungeT = time; }

  constructor(private colliders: THREE.Box3[]) {}

  update(dt: number, f: Frame, aiming: boolean, lookScale: number) {
    this.yaw -= f.lookX * lookScale;
    this.pitch = THREE.MathUtils.clamp(this.pitch - f.lookY * lookScale, -1.45, 1.45);
    this.sprinting = f.sprint && f.moveZ > 0.3 && !aiming;
    const speed = aiming ? 2.6 : this.sprinting ? 7.2 : 4.6;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = fwd.multiplyScalar(f.moveZ).add(right.multiplyScalar(f.moveX)).multiplyScalar(speed);
    const accel = this.onGround ? 14 : 3;
    this.vel.x += (wish.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wish.z - this.vel.z) * Math.min(1, accel * dt);
    if (f.jump && this.onGround) { this.vel.y = 5.2; this.onGround = false; }
    this.vel.y -= 16 * dt;
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
    cam.rotation.set(this.pitch + recoilPitch, this.yaw, 0, "YXZ");
  }
}
