// Brazos en primera persona (V1): manga de chaqueta con puño, codo y pliegues; guante táctico con nudillera y
// dedos articulados (3 falanges + pulgar) que se cierran según el agarre; reloj en la muñeca izquierda.
// Todo generado por código con texturas pixeladas (mismo estilo que las armas). IK analítico de dos huesos.
// La interfaz es de manos: posición, orientación y cierre de cada mano, en el espacio de la cámara
// (-Z hacia delante, +Y arriba). Marco local de la mano: dedos hacia -Z, dorso hacia +Y, muñeca hacia +Z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/** Medidas del brazo (datos, no código): cambiar de modelo no obliga a rehacer el IK. */
export const ARM_DATA = {
  upper: 0.33, fore: 0.3,
  shoulderR: new THREE.Vector3(0.24, -0.4, 0.16),
  shoulderL: new THREE.Vector3(-0.22, -0.44, 0.14),
  poleR: new THREE.Vector3(0.7, -1, 0.1),   // el codo derecho apunta hacia abajo y afuera
  poleL: new THREE.Vector3(-0.6, -1, 0.2),
};

/** Cierre de la mano: índice, corazón, anular, meñique (0 abierta … 1 puño) y pulgar. */
export interface Curl { fingers: [number, number, number, number]; thumb: number }
export interface HandPose { pos: THREE.Vector3; orient: THREE.Quaternion; curl: Curl }
export interface HandTargets { right: HandPose; left: HandPose | null; dt?: number }

/** IK de dos huesos: devuelve la posición del codo. */
export function solveTwoBone(shoulder: THREE.Vector3, target: THREE.Vector3, a: number, b: number, pole: THREE.Vector3): THREE.Vector3 {
  const toT = target.clone().sub(shoulder);
  const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - b) + 1e-4, (a + b) * 0.999);
  const dir = toT.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return shoulder.clone().addScaledVector(dir, cosA * a).addScaledVector(p, sinA * a);
}

/** Orientación de una mano a partir de hacia dónde apuntan los dedos y hacia dónde mira el dorso. */
export function handBasis(fingers: THREE.Vector3, back: THREE.Vector3): THREE.Quaternion {
  const z = fingers.clone().normalize().negate();
  const y = back.clone().sub(z.clone().multiplyScalar(back.dot(z))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// ---------- Materiales (texturas pixeladas por código) ----------
function pixTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.Texture | undefined {
  if (typeof document === "undefined") return undefined; // tests sin DOM
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
/** Tela de la chaqueta: sarga con ruido, costura longitudinal. */
const fabricTex = pixTex(32, 32, (g) => {
  g.fillStyle = "#454b3c"; g.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x + y) % 3 === 0) { g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 120; i++) { const v = rnd() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.06})`; g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1); }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(15, 0, 1, 32); g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(16, 0, 1, 32);
});
fabricTex?.repeat.set(2, 3);
/** Guante: material sintético con relieve fino. */
const gloveTex = pixTex(16, 16, (g) => {
  g.fillStyle = "#26282a"; g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`; g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
  for (let y = 0; y < 16; y += 4) { g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(0, y, 16, 1); }
});
const sleeve = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.92 });
const sleeveDark = new THREE.MeshStandardMaterial({ color: 0x2f3329, roughness: 0.95 });
const glove = new THREE.MeshStandardMaterial({ map: gloveTex, roughness: 0.7, metalness: 0.05 });
const gloveArmor = new THREE.MeshStandardMaterial({ color: 0x3a3e42, roughness: 0.5, metalness: 0.25 });
const strap = new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.6 });
const watchFace = new THREE.MeshStandardMaterial({ color: 0x0c1410, emissive: 0x2a6a4a, emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.4 });
const patchMat = new THREE.MeshStandardMaterial({ map: pixTex(8, 8, (g) => { g.fillStyle = "#3a3f33"; g.fillRect(0, 0, 8, 8); g.fillStyle = "#8a8f70"; g.fillRect(1, 1, 6, 1); g.fillRect(1, 3, 4, 1); g.fillRect(1, 5, 5, 1); g.strokeStyle = "#20231c"; g.strokeRect(0.5, 0.5, 7, 7); }), roughness: 0.9 });

const Y = new THREE.Vector3(0, 1, 0);
const cyl = (rTop: number, rBot: number, mat: THREE.Material, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1, seg, 1), mat);

/** Tramo de brazo: un grupo orientado de A a B; el cuerpo se escala al largo y los adornos van en metros. */
class Segment {
  readonly g = new THREE.Group(); private body: THREE.Mesh; private ends: { m: THREE.Object3D; at: number }[] = [];
  constructor(parent: THREE.Object3D, rA: number, rB: number, mat: THREE.Material) {
    this.body = cyl(rB, rA, mat, 12); this.g.add(this.body); parent.add(this.g);
  }
  /** Adorno a `at` metros del inicio (negativo = desde el final). */
  deco(m: THREE.Object3D, at: number) { this.g.add(m); this.ends.push({ m, at }); return m; }
  set(a: THREE.Vector3, b: THREE.Vector3) {
    const len = a.distanceTo(b);
    this.g.position.copy(a); this.g.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
    this.body.scale.y = len; this.body.position.y = len / 2;
    for (const e of this.ends) e.m.position.y = e.at >= 0 ? e.at : len + e.at;
  }
}

/** Mano con dedos articulados. */
class Hand {
  readonly g = new THREE.Group();
  private fingers: THREE.Group[][] = []; private thumb: THREE.Group[] = [];
  private cur: Curl = { fingers: [0.5, 0.5, 0.5, 0.5], thumb: 0.3 };
  constructor(parent: THREE.Object3D, readonly side: 1 | -1, withWatch: boolean) {
    const s = side;
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.03, 0.088, 2, 0.009), glove); this.g.add(palm);
    // Nudillera y refuerzo del dorso
    const knuckle = new THREE.Mesh(new RoundedBoxGeometry(0.072, 0.01, 0.026, 1, 0.003), gloveArmor); knuckle.position.set(0, 0.017, -0.032); this.g.add(knuckle);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.034), gloveArmor); back.position.set(0.004 * s, 0.016, 0.006); this.g.add(back);
    // Puño del guante con su cierre de velcro y la tira
    const gauntlet = cyl(0.037, 0.041, glove, 10); gauntlet.rotation.x = Math.PI / 2; gauntlet.scale.y = 0.05; gauntlet.position.z = 0.066; gauntlet.scale.x = 1.08; this.g.add(gauntlet);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.022), strap); tab.position.set(0.012 * s, 0.038, 0.066); this.g.add(tab);
    if (withWatch) {
      const band = cyl(0.039, 0.039, strap, 12); band.rotation.x = Math.PI / 2; band.scale.y = 0.016; band.position.z = 0.1; this.g.add(band);
      const face = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.008, 0.026, 1, 0.003), watchFace); face.position.set(0, 0.04, 0.1); this.g.add(face);
    }
    // Dedos: índice (junto al pulgar) … meñique; 3 falanges con pivote en cada nudillo
    const lens = [[0.04, 0.025, 0.02], [0.044, 0.027, 0.021], [0.041, 0.025, 0.02], [0.032, 0.021, 0.018]];
    const xs = [-0.028, -0.0095, 0.0095, 0.027], ws = [0.0185, 0.019, 0.018, 0.016];
    for (let f = 0; f < 4; f++) {
      const chain: THREE.Group[] = []; let parentG: THREE.Object3D = this.g;
      for (let k = 0; k < 3; k++) {
        const piv = new THREE.Group(); piv.position.set(k === 0 ? xs[f] * s : 0, k === 0 ? -0.002 : 0, k === 0 ? -0.04 : -lens[f][k - 1]);
        const w = ws[f] * (1 - k * 0.08);
        const ph = new THREE.Mesh(new RoundedBoxGeometry(w, w * 0.95, lens[f][k] + 0.004, 1, w * 0.3), glove); ph.position.z = -lens[f][k] / 2; piv.add(ph);
        if (k === 0) { const pad = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.003, lens[f][0] * 0.6), gloveArmor); pad.position.set(0, w * 0.5, -lens[f][0] * 0.5); piv.add(pad); }
        parentG.add(piv); chain.push(piv); parentG = piv;
      }
      this.fingers.push(chain);
    }
    // Pulgar: sale del lateral de la palma, hacia delante y hacia dentro
    const tb = new THREE.Group(); tb.position.set(-0.036 * s, -0.008, -0.004); tb.rotation.set(-0.35, 0.75 * s, 0.6 * s); this.g.add(tb);
    let par: THREE.Object3D = tb;
    for (const [k, len] of [0.036, 0.03].entries()) {
      const piv = new THREE.Group(); piv.position.z = k === 0 ? 0 : -0.036;
      const ph = new THREE.Mesh(new RoundedBoxGeometry(0.021 - k * 0.002, 0.019, len + 0.004, 1, 0.006), glove); ph.position.z = -len / 2; piv.add(ph);
      par.add(piv); this.thumb.push(piv); par = piv;
    }
    for (const o of this.g.children) o.traverse((m) => { (m as THREE.Mesh).renderOrder = 9; });
    parent.add(this.g);
  }
  set(p: HandPose, k: number) {
    this.g.position.copy(p.pos);
    this.g.quaternion.slerp(p.orient, k);
    for (let f = 0; f < 4; f++) this.cur.fingers[f] += (p.curl.fingers[f] - this.cur.fingers[f]) * k;
    this.cur.thumb += (p.curl.thumb - this.cur.thumb) * k;
    // Cerrar = girar cada falange hacia la palma (-Y); la distal algo menos
    for (let f = 0; f < 4; f++) { const c = this.cur.fingers[f]; this.fingers[f][0].rotation.x = -c * 1.25; this.fingers[f][1].rotation.x = -c * 1.45; this.fingers[f][2].rotation.x = -c * 0.95; }
    this.thumb[0].rotation.x = -this.cur.thumb * 0.5; this.thumb[1].rotation.x = -this.cur.thumb * 0.9;
  }
  snap(p: HandPose) { this.g.quaternion.copy(p.orient); this.set(p, 1); }
}

class Arm {
  readonly upper: Segment; readonly fore: Segment; readonly hand: Hand; private elbowM: THREE.Mesh;
  private first = true;
  constructor(parent: THREE.Object3D, readonly side: 1 | -1) {
    this.upper = new Segment(parent, 0.056, 0.047, sleeve);
    this.fore = new Segment(parent, 0.046, 0.04, sleeve);
    this.elbowM = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), sleeve); parent.add(this.elbowM);
    // Parche en el hombro, pliegues en el antebrazo y puño de la chaqueta (más oscuro) que tapa el guante
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.006), patchMat); patch.position.set(0.054 * side, 0, 0); patch.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; this.upper.deco(patch, 0.09);
    for (const at of [0.08, 0.15]) { const fold = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.006, 5, 12), sleeve); fold.rotation.x = Math.PI / 2; fold.scale.set(1, 1.1, 1); this.fore.deco(fold, at); }
    const cuffM = cyl(0.045, 0.047, sleeveDark, 12); cuffM.scale.y = 0.04; this.fore.deco(cuffM, -0.02);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 4, 12), sleeveDark); hem.rotation.x = Math.PI / 2; this.fore.deco(hem, -0.002);
    this.hand = new Hand(parent, side, side < 0);
    for (const g of [this.upper.g, this.fore.g, this.elbowM]) g.traverse((m) => { (m as THREE.Mesh).renderOrder = 9; (m as THREE.Mesh).castShadow = false; });
  }
  set(shoulder: THREE.Vector3, p: HandPose, pole: THREE.Vector3, dt: number) {
    const k = this.first ? 1 : Math.min(1, dt * 16); this.first = false;
    this.hand.set(p, k);
    // La muñeca está detrás de la palma (en +Z de la mano); el IK llega a la muñeca
    const wrist = p.pos.clone().add(new THREE.Vector3(0, 0.004, 0.072).applyQuaternion(this.hand.g.quaternion));
    const elbow = solveTwoBone(shoulder, wrist, ARM_DATA.upper, ARM_DATA.fore, pole);
    this.upper.set(shoulder, elbow); this.elbowM.position.copy(elbow);
    this.fore.set(elbow, wrist);
  }
}

export class Arms {
  readonly group = new THREE.Group();
  private right: Arm; private left: Arm;
  constructor(camera: THREE.Object3D) {
    camera.add(this.group);
    this.right = new Arm(this.group, 1); this.left = new Arm(this.group, -1);
  }
  /** Coloca las manos (coordenadas de la cámara). Si `left` es null, el brazo izquierdo baja fuera de la vista. */
  update(t: HandTargets) {
    const dt = t.dt ?? 1;
    this.right.set(ARM_DATA.shoulderR, t.right, ARM_DATA.poleR, dt);
    const left = t.left ?? { pos: new THREE.Vector3(-0.24, -0.62, -0.08), orient: t.right.orient, curl: { fingers: [0.4, 0.45, 0.5, 0.55], thumb: 0.2 } };
    this.left.set(ARM_DATA.shoulderL, left, ARM_DATA.poleL, dt);
  }
  set visible(v: boolean) { this.group.visible = v; }
}
