// Modelos GLB del equipamiento (assets/equipo3d/<tipo>.glb, pack 9 de Blender): se cargan una vez, se clonan por uso
// (materiales incluidos) y se ajustan al tamaño de la figura procedural que sustituyen. Si un GLB falta o falla se
// devuelve null y gadgetfx conserva la primitiva (respaldo obligatorio).
// También vive aquí el despliegue: una función pura `deployScale` que decide escala y altura según el tipo y el tiempo.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GADGET_KINDS, type GadgetKind } from "./gadgets";

/** Mayor lado (metros) al que se ajusta cada modelo: el de la figura a la que sustituye. */
export const GADGET_MODEL_SIZE: Record<GadgetKind, number> = {
  turret: 1.15, shield: 1.9, dome: 1.8, orb: 0.5, hook: 0.7, mine: 0.8, gravity: 1.2, slowfield: 1.2,
  jump: 2.2, beacon: 0.9, knife: 0.7, chain: 0.6, harpoon: 0.7, decoy: 1.7, glitch: 0.7, ammo: 0.95,
  inject: 0.75, thrust: 0.7, teleport: 1.4, chrono: 1.0,
};

/** URL pública del GLB del tipo (los assets se sirven en la raíz). */
export const gadgetModelUrl = (kind: GadgetKind) => `./equipo3d/${kind}.glb`;

/** Escala segura para pasar de un tamaño medido a `target`: nunca 0, NaN ni infinita. */
export function fitScale(size: Pick<THREE.Vector3, "x" | "y" | "z">, target: number): number {
  const big = Math.max(Math.abs(size.x), Math.abs(size.y), Math.abs(size.z));
  const aim = Number.isFinite(target) ? THREE.MathUtils.clamp(target, 0.01, 20) : 1;
  if (!Number.isFinite(big) || big <= 1e-6) return 1;
  return aim / big;
}

/** Base cargada (sin escalar respecto del original, solo ajustada) y copias listas para usar. */
const bases = new Map<GadgetKind, Promise<THREE.Group | null>>();
const ready = new Map<GadgetKind, THREE.Group>();

function loadBase(kind: GadgetKind): Promise<THREE.Group | null> {
  let p = bases.get(kind);
  if (!p) {
    p = new GLTFLoader().loadAsync(gadgetModelUrl(kind)).then((gltf) => {
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
      // El origen del GLB ya está en la base (o en el centro, en los proyectiles): se escala sin moverlo.
      const wrap = new THREE.Group();
      scene.scale.multiplyScalar(fitScale(size, GADGET_MODEL_SIZE[kind]));
      wrap.add(scene);
      ready.set(kind, wrap);
      return wrap;
    }).catch(() => null);
    bases.set(kind, p);
  }
  return p;
}

/** Copia del modelo con sus materiales clonados (cada instancia puede animarse sin tocar a las demás). */
function cloneGadget(base: THREE.Group): THREE.Group {
  const copy = base.clone(true), mats = new Map<THREE.Material, THREE.Material>();
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false; mesh.receiveShadow = false;
    const clone = (m: THREE.Material) => {
      let c = mats.get(m);
      if (!c) { c = m.clone(); mats.set(m, c); }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  return copy;
}

/** Copia lista del modelo del tipo; null si no hay GLB (el que llama usa la primitiva). */
export async function loadGadgetModel(kind: GadgetKind): Promise<THREE.Group | null> {
  if (typeof kind !== "string" || !(kind in GADGET_KINDS)) return null;
  const base = await loadBase(kind);
  return base ? cloneGadget(base) : null;
}

/** Copia inmediata si el modelo ya está cargado (si no, null: primitiva de respaldo). */
export function gadgetModelNow(kind: GadgetKind): THREE.Group | null {
  const base = ready.get(kind);
  return base ? cloneGadget(base) : null;
}

/** Lanza la carga en segundo plano (primer fotograma, antes de que se use el equipamiento). */
export function preloadGadgetModel(kind: GadgetKind): void {
  if (kind in GADGET_KINDS) void loadBase(kind);
}

/** Segundos que dura el despliegue de cada tipo (0,3–0,6 s). */
export const DEPLOY_TIME: Partial<Record<GadgetKind, number>> = { turret: 0.5, shield: 0.45, dome: 0.6, mine: 0.45 };

export const deployTime = (kind: GadgetKind) => DEPLOY_TIME[kind] ?? 0.35;

export interface DeployState {
  /** Escala por eje (1 = tamaño final). */ sx: number; sy: number; sz: number;
  /** Desplazamiento vertical respecto del suelo (metros); negativo no se usa. */ y: number;
  /** Ya terminó (escala 1 y sin desplazamiento). */ done: boolean;
}

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
/** Rebote leve al final (se pasa un poco y vuelve): pico ~1,04. */
const pop = (k: number) => {
  const c1 = 1, c3 = c1 + 1, x = k - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
};

/**
 * Despliegue puro de cada tipo a los `t` segundos de usarlo:
 * turret sube con escala Y 0→1, shield se abre en X/Y, dome crece en onda, mine cae 10 cm y se asienta y el resto
 * escala 0→1 con un sobreimpulso leve. Al acabar devuelve exactamente 1 (sin desplazamiento).
 */
export function deployScale(kind: GadgetKind, t: number): DeployState {
  const dur = deployTime(kind), tt = Number.isFinite(t) ? Math.max(0, t) : 0;
  if (tt >= dur) return { sx: 1, sy: 1, sz: 1, y: 0, done: true };
  const k = tt / dur;
  switch (kind) {
    case "turret": return { sx: 1, sy: easeOut(k), sz: 1, y: 0, done: false };
    case "shield": {
      const s = easeOut(k);
      return { sx: s, sy: s, sz: 1, y: 0, done: false };
    }
    case "dome": {
      const s = pop(k);
      return { sx: s, sy: s, sz: s, y: 0, done: false };
    }
    case "mine": return { sx: 1, sy: 1, sz: 1, y: 0.1 * (1 - k) * (1 - k), done: false };
    default: {
      const s = pop(k);
      return { sx: s, sy: s, sz: s, y: 0, done: false };
    }
  }
}
