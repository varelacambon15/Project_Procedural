// Muerte del jugador: la mano del protagonista aparece delante de la cara, tiembla y se desintegra en píxeles desde
// la punta de los dedos hasta el antebrazo (es una simulación: el cuerpo «se borra»). La cámara cae y se inclina, y la
// pantalla pierde el color (CSS `body.dying`). Dura `DURATION` s y luego llama a `done` (vuelta al hall, fin de la
// incursión…). Sin luces nuevas: los píxeles son aditivos y la mano se recorta con un plano.
import * as THREE from "three";

const DURATION = 2.6;
const GLOVE = 0x43392f, SLEEVE = 0x4b5462, PATCH = 0xd9822b;
const N = 520;

export class DeathFx {
  active = false;
  private t = 0;
  private hand = new THREE.Group();
  private clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private parts!: THREE.InstancedMesh;
  private seeds: { p: THREE.Vector3; v: THREE.Vector3; born: number; s: number; col: THREE.Color }[] = [];
  private done: (() => void) | null = null;
  private dummy = new THREE.Object3D();
  /** Altura (en el espacio de la mano) de la punta de los dedos y de la muñeca: el corte baja entre las dos. */
  private top = 0.13; private bottom = -0.34;

  constructor(camera: THREE.Camera) {
    const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, clippingPlanes: [this.clip] });
    const glove = mat(GLOVE), sleeve = mat(SLEEVE), patch = mat(PATCH);
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.z = rz; this.hand.add(o); return o; };
    // Palma vista de frente, dedos hacia arriba algo abiertos (cápsulas: falanges redondeadas), pulgar a un lado,
    // muñeca y manga con puño
    add(new THREE.BoxGeometry(0.086, 0.09, 0.03), glove, 0, 0, 0);
    add(new THREE.CapsuleGeometry(0.016, 0.06, 4, 8), glove, 0, -0.045, 0, Math.PI / 2); // canto inferior de la palma
    [[-0.031, 0.092, 0.05, 0.07], [-0.01, 0.1, 0.058, 0.02], [0.011, 0.098, 0.055, -0.02], [0.031, 0.086, 0.042, -0.09]].forEach(([x, y, l, rz]) => {
      add(new THREE.CapsuleGeometry(0.0095, l, 4, 8), glove, x, y, 0.002, rz);
    });
    add(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), glove, -0.055, 0.012, 0.008, 0.75);
    add(new THREE.BoxGeometry(0.028, 0.018, 0.004), patch, 0.018, -0.022, 0.016);
    add(new THREE.CylinderGeometry(0.036, 0.038, 0.05, 12), glove, 0, -0.07, 0);
    add(new THREE.CylinderGeometry(0.046, 0.05, 0.05, 12), sleeve, 0, -0.105, 0);
    add(new THREE.CylinderGeometry(0.045, 0.052, 0.22, 12), sleeve, 0, -0.23, 0);
    this.hand.visible = false;
    camera.add(this.hand);
    // Píxeles: cubitos aditivos (cian de la simulación, blanco y el color del guante)
    this.parts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), N);
    this.parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.parts.frustumCulled = false; this.parts.visible = false;
    this.hand.add(this.parts);
    const cols = [new THREE.Color(0x7fe6ff), new THREE.Color(0xffffff), new THREE.Color(0x9a8068), new THREE.Color(0x7fa0c8)];
    for (let i = 0; i < N; i++) {
      // Puntos repartidos por el volumen de la mano y el antebrazo (más densos en los dedos)
      const y = this.bottom + Math.pow(Math.random(), 0.7) * (this.top - this.bottom), w = y > 0.04 ? 0.05 : y > -0.1 ? 0.05 : 0.055;
      const p = new THREE.Vector3((Math.random() - 0.5) * 2 * w, y, (Math.random() - 0.5) * 0.05);
      this.seeds.push({ p, v: new THREE.Vector3(), born: -1, s: 0.004 + Math.random() * 0.006, col: cols[Math.floor(Math.random() * cols.length)] });
      this.parts.setColorAt(i, cols[i % cols.length]);
    }
  }

  start(done: () => void) {
    this.active = true; this.t = 0; this.done = done;
    this.hand.visible = true; this.parts.visible = true;
    for (const s of this.seeds) s.born = -1;
    document.body.classList.add("dying");
  }

  /** Avanza la animación; devuelve la inclinación de cámara (cabeceo hacia abajo y alabeo) que añadir este fotograma. */
  update(dt: number): { pitch: number; roll: number; drop: number } {
    if (!this.active) return { pitch: 0, roll: 0, drop: 0 };
    this.t += dt; const t = this.t, k = Math.min(1, t / DURATION);
    // La mano sube hasta delante de la cara (0–0,45 s) y tiembla; luego queda quieta mientras se borra
    const up = Math.min(1, t / 0.45), e = up * up * (3 - 2 * up), tremble = (1 - k) * 0.004;
    this.hand.position.set(0.05 + (Math.random() - 0.5) * tremble, -0.46 + 0.3 * e + (Math.random() - 0.5) * tremble, -0.52);
    this.hand.rotation.set(-0.12, 0.25 - 0.1 * e, -0.15 + 0.1 * e);
    this.hand.updateMatrixWorld(true);
    // Corte: baja de la punta de los dedos a la manga entre 0,6 s y 2,2 s
    const cut = THREE.MathUtils.lerp(this.top + 0.01, this.bottom - 0.02, THREE.MathUtils.clamp((t - 0.6) / 1.6, 0, 1));
    const n = new THREE.Vector3(0, -1, 0).transformDirection(this.hand.matrixWorld), at = new THREE.Vector3(0, cut, 0).applyMatrix4(this.hand.matrixWorld);
    this.clip.setFromNormalAndCoplanarPoint(n, at);
    // Cada píxel se suelta cuando el corte lo alcanza y sale flotando hacia arriba y a los lados, encogiéndose
    for (let i = 0; i < N; i++) {
      const s = this.seeds[i];
      if (s.born < 0 && s.p.y > cut && t > 0.6) { s.born = t; s.v.set((Math.random() - 0.5) * 0.12, 0.08 + Math.random() * 0.14, (Math.random() - 0.3) * 0.1); }
      const age = s.born < 0 ? -1 : t - s.born, life = 0.9;
      if (age < 0 || age > life) { this.dummy.scale.setScalar(0); this.dummy.position.copy(s.p); }
      else { const a = age / life; this.dummy.position.copy(s.p).addScaledVector(s.v, age).add(new THREE.Vector3(Math.sin(age * 9 + i) * 0.004, 0, 0)); this.dummy.scale.setScalar(s.s * (1.4 - a)); }
      this.dummy.updateMatrix(); this.parts.setMatrixAt(i, this.dummy.matrix);
    }
    this.parts.instanceMatrix.needsUpdate = true;
    if (t >= DURATION) this.finish();
    // Cámara: cae un poco (rodillas) y se inclina
    const fall = THREE.MathUtils.clamp((t - 0.2) / 1.6, 0, 1), f2 = fall * fall * (3 - 2 * fall);
    return { pitch: -0.25 * f2, roll: 0.35 * f2, drop: 0.9 * f2 };
  }
  private finish() {
    this.active = false; this.hand.visible = false; this.parts.visible = false;
    document.body.classList.remove("dying");
    const d = this.done; this.done = null; d?.();
  }
}
