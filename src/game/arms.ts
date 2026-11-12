// Brazos en primera persona (V0): bloques y cápsulas generados por código, con IK analítico de dos huesos.
// El resto del juego solo conoce la interfaz de manos: objetivo de la mano derecha, de la izquierda y su orientación.
// Convención: metros, en el espacio de la cámara (-Z hacia delante, +Y arriba). Más adelante se podrá cambiar la
// representación por un modelo con esqueleto sin tocar las poses ni la interfaz.
import * as THREE from "three";

/** Medidas del brazo (datos, no código): cambiar de modelo no obliga a rehacer el IK. */
export const ARM_DATA = {
  upper: 0.33, fore: 0.31,
  shoulderR: new THREE.Vector3(0.24, -0.4, 0.16),
  shoulderL: new THREE.Vector3(-0.22, -0.44, 0.14),
  poleR: new THREE.Vector3(0.7, -1, 0.1),   // el codo derecho apunta hacia abajo y afuera
  poleL: new THREE.Vector3(-0.6, -1, 0.2),
};

export interface HandTargets { right: THREE.Vector3; left: THREE.Vector3 | null; orient: THREE.Quaternion }

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

const sleeve = new THREE.MeshStandardMaterial({ color: 0x3b4033, roughness: 0.9 });
const cuff = new THREE.MeshStandardMaterial({ color: 0x2a2d26, roughness: 0.95 });
const glove = new THREE.MeshStandardMaterial({ color: 0x1d1e1f, roughness: 0.75, metalness: 0.05 });
const up = new THREE.Vector3(0, 1, 0);

class Arm {
  readonly upperM: THREE.Mesh; readonly foreM: THREE.Mesh; readonly hand: THREE.Group;
  constructor(parent: THREE.Object3D, readonly side: 1 | -1) {
    this.upperM = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, ARM_DATA.upper - 0.06, 4, 10), sleeve);
    this.foreM = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, ARM_DATA.fore - 0.06, 4, 10), sleeve);
    this.hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.03, 0.09), glove); this.hand.add(palm);
    const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.028, 0.05), glove); fingers.position.set(0, -0.022, -0.045); fingers.rotation.x = 0.9; this.hand.add(fingers);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.05), glove); thumb.position.set(-0.04 * side, 0.005, -0.02); thumb.rotation.y = 0.4 * side; this.hand.add(thumb);
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.045, 0.04, 10), cuff); wrist.rotation.x = Math.PI / 2; wrist.position.z = 0.06; this.hand.add(wrist);
    for (const m of [this.upperM, this.foreM, ...this.hand.children]) { m.renderOrder = 9; (m as THREE.Mesh).castShadow = false; }
    parent.add(this.upperM, this.foreM, this.hand);
  }
  set(shoulder: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, orient: THREE.Quaternion) {
    const elbow = solveTwoBone(shoulder, target, ARM_DATA.upper, ARM_DATA.fore, pole);
    const seg = (m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) => {
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
    };
    seg(this.upperM, shoulder, elbow);
    // El antebrazo termina en la muñeca, un poco antes del centro de la mano
    const wrist = target.clone().add(new THREE.Vector3(0, 0, 0.06).applyQuaternion(orient));
    seg(this.foreM, elbow, wrist);
    this.hand.position.copy(target); this.hand.quaternion.copy(orient);
  }
  visible(v: boolean) { this.upperM.visible = this.foreM.visible = this.hand.visible = v; }
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
    this.right.set(ARM_DATA.shoulderR, t.right, ARM_DATA.poleR, t.orient);
    const left = t.left ?? new THREE.Vector3(-0.22, -0.55, -0.1);
    this.left.set(ARM_DATA.shoulderL, left, ARM_DATA.poleL, t.orient);
  }
  set visible(v: boolean) { this.group.visible = v; }
}
