// Modelos de los enemigos nuevos (tarea 2): GLB hechos en Blender (`assets/enemigos/`, del pack 13) con respaldo
// procedural si el GLB no carga. Ambos se construyen en el espacio del GLB (+X al frente, +Y arriba, metros, origen en
// el suelo o en el centro del cuerpo en los drones) y con los mismos pivotes `mov_*`, así la animación es la misma.
// El envoltorio gira el modelo para que mire a +Z, como el resto de enemigos del juego, y lo escala.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Zone } from "./dummies";

export type ModelShape = "hound" | "repairer" | "sentinel";
export const MODEL_SHAPES: readonly ModelShape[] = ["hound", "repairer", "sentinel"];
export const isModelShape = (s: unknown): s is ModelShape => typeof s === "string" && (MODEL_SHAPES as readonly string[]).includes(s);

const FILE: Record<ModelShape, string> = { hound: "enemigo_sabueso", repairer: "enemigo_dron_reparador", sentinel: "enemigo_centinela_flotante" };
/** Escala del modelo en el juego (el centinela del pack mide 0,76 m: se agranda para que imponga). */
export const MODEL_SCALE: Record<ModelShape, number> = { hound: 1.2, repairer: 1.15, sentinel: 2.1 };
export const enemyModelUrl = (s: ModelShape) => `./enemigos/${FILE[s]}.glb`;

/**
 * Zona de impacto de cada pieza por su nombre: la cabeza (punto débil: ojos, cráneo, cámara, sensor), las patas y
 * rotores (extremidades), el escudo del centinela (casi no hace daño) y el resto, cuerpo.
 */
export function zoneOf(shape: ModelShape, name: string): Zone {
  const n = name.toLowerCase();
  if (shape === "hound") {
    if (/^mov_pata/.test(n)) return "limb";
    if (/craneo|mascara|visor|ojo_|boca|nariz|oreja|mandibula|diente|escape_boca/.test(n)) return "head";
    return "body";
  }
  if (shape === "repairer") {
    if (/camara|proa/.test(n)) return "head";
    if (/rotor|guarda|tirante|mov_brazo|haz_|halo_|chispa|electrodo/.test(n)) return "limb";
    return "body";
  }
  if (/^escudo_/.test(n)) return "shield";
  if (/sensor|domo/.test(n)) return "head";
  return "body";
}

/** Modelo listo para un enemigo: el envoltorio (mira a +Z, escalado) y sus pivotes por nombre. */
export interface EnemyModel { root: THREE.Group; rig: Map<string, THREE.Object3D>; fromGlb: boolean }

function wrap(inner: THREE.Object3D, shape: ModelShape, fromGlb: boolean): EnemyModel {
  const root = new THREE.Group(); root.name = `modelo_${shape}`;
  inner.rotation.y = -Math.PI / 2; // (+X del GLB → +Z del juego)
  root.add(inner); root.scale.setScalar(MODEL_SCALE[shape]);
  const rig = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if (/^mov_|^haz_|^halo_|^chispa|^cian_|^columna_/.test(o.name)) rig.set(o.name, o);
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.userData.zone = zoneOf(shape, m.name || m.parent?.name || ""); }
  });
  for (const o of rig.values()) o.userData.rest = { p: o.position.clone(), r: o.rotation.clone() };
  return { root, rig, fromGlb };
}

const bases = new Map<ModelShape, Promise<THREE.Group | null>>();
const ready = new Map<ModelShape, THREE.Group>();
function loadBase(s: ModelShape): Promise<THREE.Group | null> {
  let p = bases.get(s);
  if (!p) {
    p = new GLTFLoader().loadAsync(enemyModelUrl(s)).then((g) => { ready.set(s, g.scene); return g.scene; }).catch(() => null);
    bases.set(s, p);
  }
  return p;
}
/** Copia del GLB (materiales compartidos: `Dummy` los clona luego con su plano de recorte). */
function cloneBase(b: THREE.Group) { const c = b.clone(true); c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.name === "" && o.parent) m.name = o.parent.name; }); return c; }

/** Precarga de los tres modelos (al arrancar el juego). */
export function preloadEnemyModels() { for (const s of MODEL_SHAPES) void loadBase(s); }
/** Modelo ya cargado o, si aún no ha llegado (o no hay GLB), el procedural. */
export function enemyModelNow(s: ModelShape): EnemyModel {
  const b = ready.get(s);
  return b ? wrap(cloneBase(b), s, true) : wrap(buildProcedural(s), s, false);
}
/** Promesa del modelo GLB (null si no carga). */
export async function loadEnemyModel(s: ModelShape): Promise<EnemyModel | null> {
  const b = await loadBase(s); return b ? wrap(cloneBase(b), s, true) : null;
}

// ---------- Respaldo procedural (mismas piezas y pivotes que el GLB, sin el detalle) ----------
const M = (color: number, metal = 0.6, rough = 0.45, emissive = 0, ei = 0) => new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: ei });
function buildProcedural(s: ModelShape): THREE.Group {
  const g = new THREE.Group();
  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, parent: THREE.Object3D = g) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
  };
  const pivot = (name: string, x: number, y: number, z: number) => { const p = new THREE.Group(); p.name = name; p.position.set(x, y, z); g.add(p); return p; };
  if (s === "hound") {
    const paint = M(0x161211, 0.4, 0.55), steel = M(0x525e6e, 0.8, 0.35), eye = M(0x200404, 0.2, 0.4, 0xff1a0a, 3);
    box("lomo", 0.8, 0.26, 0.34, -0.02, 0.58, 0, paint); box("peto", 0.28, 0.3, 0.3, 0.32, 0.62, 0, steel);
    box("craneo", 0.3, 0.2, 0.24, 0.52, 0.74, 0, paint); box("visor", 0.04, 0.05, 0.2, 0.67, 0.76, 0, eye);
    const jaw = pivot("mov_mandibula", 0.48, 0.6, 0); box("mov_mandibula_m", 0.26, 0.06, 0.18, 0.12, 0.02, 0, steel, jaw);
    [[0.245, 0.521, 0.13], [0.245, 0.521, -0.13], [-0.286, 0.505, 0.124], [-0.286, 0.505, -0.124]].forEach(([x, y, z], i) => {
      const p = pivot(`mov_pata_${i + 1}`, x, y, z); box(`mov_pata_${i + 1}_m`, 0.08, 0.5, 0.08, 0, -0.25, 0, steel, p);
    });
  } else if (s === "repairer") {
    const paint = M(0x0c0f13, 0.5, 0.5), steel = M(0x525e6e, 0.8, 0.35), green = M(0x0a2a10, 0.2, 0.4, 0x1aff4a, 2.5);
    box("casco", 0.46, 0.22, 0.4, 0, 0, 0, paint); box("franja_verde_1", 0.47, 0.03, 0.41, 0, 0.05, 0, green);
    box("camara_lente", 0.06, 0.1, 0.1, 0.25, -0.02, 0, green);
    [[0.26, 0.15, -0.28], [-0.31, 0.15, -0.28], [-0.31, 0.15, 0.28], [0.26, 0.15, 0.28]].forEach(([x, y, z], i) => {
      box(`brazo_rotor_${i + 1}`, Math.abs(x), 0.04, 0.05, x / 2, 0.1, z / 2, steel).rotation.y = Math.atan2(-z, x);
      const p = pivot(`mov_rotor_${i + 1}`, x, y, z); box(`mov_rotor_${i + 1}_m`, 0.34, 0.012, 0.04, 0, 0, 0, M(0x111111, 0.3, 0.6), p);
    });
    const arm = pivot("mov_brazo", 0.088, 0.076, 0.17); box("mov_brazo_m", 0.3, 0.04, 0.04, 0.15, 0, 0, steel, arm);
  } else {
    const paint = M(0x0b1015, 0.5, 0.5), steel = M(0x525e6e, 0.8, 0.35), cyan = M(0x042a34, 0.2, 0.4, 0x2ad8ff, 2.5);
    const shield = new THREE.MeshStandardMaterial({ color: 0x46b8ff, emissive: 0x1a80e6, emissiveIntensity: 1, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    box("casco", 0.42, 0.34, 0.42, 0, 0.42, 0, paint); box("domo_sensor", 0.16, 0.12, 0.16, 0.02, 0.66, 0, cyan);
    const ring = pivot("mov_anillo", 0, 0.126, 0); ring.add(Object.assign(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 20), steel), { name: "mov_anillo_m", rotation: new THREE.Euler(Math.PI / 2, 0, 0) }));
    const can = pivot("mov_canon", 0.19, 0.54, 0); box("mov_canon_m", 0.34, 0.07, 0.07, 0.17, 0, 0, steel, can);
    box("escudo_panel_1", 0.03, 0.5, 0.62, 0.5, 0.4, 0, shield);
  }
  return g;
}
