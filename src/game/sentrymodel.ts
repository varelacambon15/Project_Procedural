// Modelo GLB de la torreta centinela (assets/equipo3d/sentry_super.glb, encargo 55): se carga una vez y se clona por
// uso (geometrías y materiales compartidos). El GLB mira a +X y el juego usa −Z: el grupo envoltorio lo gira 90° y deja
// `head` (yaw/pitch), `tip` (punto de disparo), los cañones, la antena y las patas accesibles por `getObjectByName`.
// Si el GLB falta o falla se devuelve null y superfx conserva la torreta de cajas (respaldo obligatorio).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** URL pública del GLB (los assets se sirven en la raíz). */
export const SENTRY_MODEL_URL = "./equipo3d/sentry_super.glb";

/** Altura (m) a la que se ajusta el modelo: la torreta plantada mide ~1,9 m, como la de cajas. */
export const SENTRY_MODEL_HEIGHT = 1.9;

let base: Promise<THREE.Group | null> | null = null;
let ready: THREE.Group | null = null;

/** Ajusta el modelo a 1,9 m, lo apoya en el suelo y lo gira para que el cañón (+X en el GLB) mire a −Z. */
function build(scene: THREE.Group): THREE.Group {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const k = THREE.MathUtils.clamp(SENTRY_MODEL_HEIGHT / Math.max(size.y, 1e-6), 0.01, 20);
  const inner = new THREE.Group();
  inner.scale.setScalar(k);
  // Base centrada en el origen y apoyada en y = 0 (el GLB tiene las patas por debajo del origen).
  inner.position.set(-center.x * k, -box.min.y * k, -center.z * k);
  inner.add(scene);
  const spin = new THREE.Group();
  spin.rotation.y = Math.PI / 2; // +X (cañón del GLB) → −Z (convención del juego)
  spin.add(inner);
  const root = new THREE.Group();
  root.name = "sentry_model";
  root.add(spin);
  root.userData.pitchAxis = "z"; // con el modelo girado, la inclinación se hace en el eje local Z
  return root;
}

function cloneSentry(b: THREE.Group): THREE.Group {
  const copy = b.clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) { mesh.castShadow = false; mesh.receiveShadow = false; }
  });
  return copy;
}

function loadBase(): Promise<THREE.Group | null> {
  base ??= new GLTFLoader().loadAsync(SENTRY_MODEL_URL).then((gltf) => {
    const b = build(gltf.scene);
    ready = b;
    return b;
  }).catch(() => null);
  return base;
}

/** Copia lista de la torreta; null si el GLB no carga (el que llama usa la primitiva de cajas). */
export async function loadSentryModel(): Promise<THREE.Group | null> {
  const b = await loadBase();
  return b ? cloneSentry(b) : null;
}

/** Copia inmediata si el modelo ya está cargado (si no, null: respaldo de cajas). */
export function sentryModelNow(): THREE.Group | null {
  return ready ? cloneSentry(ready) : null;
}

/** Lanza la carga en segundo plano (al crear el sistema de supers: el primer uso ya suele tenerla lista). */
export function preloadSentryModel(): void {
  void loadBase();
}

/** Torreta de cajas de respaldo: mismas anclas (`head`, `tip`) y un cañón animable (`mov_cañon_l`). */
export function buildSentryFallback(color: number): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.6, roughness: 0.45 }), dark = new THREE.MeshStandardMaterial({ color: 0x23272c, metalness: 0.5, roughness: 0.6 });
  const legs = new THREE.Group(); legs.name = "mov_patas";
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.7), dark), a = (i / 3) * Math.PI * 2;
    leg.position.set(Math.sin(a) * 0.25, 0.18, Math.cos(a) * 0.25); leg.rotation.y = a; leg.rotation.x = 0.5; legs.add(leg);
  }
  g.add(legs);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 10), metal); post.position.y = 0.55; g.add(post);
  const head = new THREE.Group(); head.name = "head"; head.position.y = 0.95; g.add(head);
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.44), metal));
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 8).rotateX(Math.PI / 2), dark);
  barrel.name = "mov_cañon_l"; barrel.position.set(0, 0.02, -0.42); head.add(barrel);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.02), new THREE.MeshBasicMaterial({ color })); eye.position.set(0, 0.06, -0.225); head.add(eye);
  const tip = new THREE.Object3D(); tip.name = "tip"; tip.position.set(0, 0.02, -0.7); head.add(tip);
  return g;
}
