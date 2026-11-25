// Modelo GLB del brazo FPS (assets/equipo3d/brazo_fps.glb, pack 16 de Blender): se carga una vez y cada brazo clona
// sus nodos compartiendo geometrías y materiales (Object3D.clone no duplica ni una ni otros). El GLB viene en glTF
// Y-up con el brazo estirado hacia +Y (dedos −Y, dorso −Z, muñeca +Y): `HAND_SPIN` lleva la mano al marco del código
// (dedos −Z, dorso +Y, muñeca +Z) y las mallas de brazo/antebrazo/muñequera se dan la vuelta para crecer desde su
// articulación hacia +Y, el eje de `Segment`. Si el GLB falta, falla o le faltan nodos se devuelve null y arms.ts
// conserva el brazo procedural (respaldo obligatorio).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/** URL pública del GLB del brazo (los assets se sirven en la raíz). */
export const ARM_MODEL_URL = "./equipo3d/brazo_fps.glb";

/** Giro de la mano exportada al marco del código: muñeca +Y→+Z, dedos −Y→−Z, dorso −Z→+Y (pulgar −X se queda). */
export const HAND_SPIN = Math.PI / 2;

/** Longitudes del modelo entre articulaciones (m): las mismas que usa el IK (ARM_DATA.upper/fore). */
export const ARM_MODEL_LENGTHS = { fore: 0.35, upper: 0.37 } as const;

/** Un brazo listo para animar: pivotes de falanges y mallas con el origen en su articulación. */
export interface ArmRig {
  /** Raíz de la mano: palma en el origen, marco del código. La escala (y el espejo de la izquierda) los pone arms.ts. */
  hand: THREE.Group;
  /** Pivotes [dedo 0-3][falange 0-2] (índice … meñique); `rotation.x` negativo cierra hacia la palma. */
  fingers: THREE.Object3D[][];
  /** Pivotes del pulgar (3 falanges). */
  thumb: THREE.Object3D[];
  /** Centro de cada falange (lo mide `fitCurls`, como el `children[0]` de la falange procedural). */
  fingerProbes: THREE.Object3D[][];
  thumbProbes: THREE.Object3D[];
  /** Brazo: nace en el hombro y crece +Y hasta el codo (`ARM_MODEL_LENGTHS.upper`). */
  upper: THREE.Object3D;
  /** Antebrazo: nace en el codo y crece +Y hasta la muñeca (`ARM_MODEL_LENGTHS.fore`, con su solape hacia la mano). */
  fore: THREE.Object3D;
  /** Codo (la articulación). */
  elbow: THREE.Object3D;
  /** Muñequera dada la vuelta: su lado largo cubre el guante y el corto queda bajo la manga. */
  cuff: THREE.Object3D;
}

/** Centros de falange en el marco de su pivote (para las sondas de `fitCurls`). */
const probePos = new Map<string, THREE.Vector3>();

/** Muñequera del modelo: aro en el coyote claro del guante y tira de cierre en gris pizarra (antes eran casi negros y
 * de frente la muñeca se veía como un disco oscuro). Compartidos entre los dos brazos, como el resto de materiales. */
const cuffRingMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.62, metalness: 0.04 });
const cuffStrapMat = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.7, metalness: 0.08 });

let base: Promise<THREE.Group | null> | null = null;
let ready: THREE.Group | null = null;

/** Copia de una malla del GLB: geometría y materiales compartidos, sin los hijos de su nodo. */
function meshOf(m: THREE.Mesh): THREE.Mesh {
  return new THREE.Mesh(m.geometry, m.material);
}

/** Comprueba que el GLB trae todos los nodos que necesita el brazo y monta la plantilla (o null si falta alguno). */
function build(scene: THREE.Group): THREE.Group | null {
  scene.updateMatrixWorld(true);
  const need = (name: string) => {
    const o = scene.getObjectByName(name) as THREE.Mesh | null;
    return o?.isMesh ? o : null;
  };
  const palm = need("palma"), upperM = need("brazo"), elbowM = need("codo");
  const foreA = need("antebrazo_1"), foreB = need("antebrazo_2");
  const cuffA = need("munequera_1"), cuffB = need("munequera_2");
  const chains: THREE.Mesh[][] = [];
  for (let f = 1; f <= 4; f++) {
    const ch: THREE.Mesh[] = [];
    for (let k = 1; k <= 3; k++) {
      const n = need(`dedo_${f}_f${k}`);
      if (!n) return null;
      ch.push(n);
    }
    chains.push(ch);
  }
  const thumbM: THREE.Mesh[] = [];
  for (let k = 1; k <= 3; k++) {
    const n = need(`pulgar_f${k}`);
    if (!n) return null;
    thumbM.push(n);
  }
  if (!palm || !upperM || !elbowM || !foreA || !foreB || !cuffA || !cuffB) return null;
  // Sondas: el centro de cada falange en su propio marco (la geometría nace en el nudillo)
  for (const n of [...chains.flat(), ...thumbM]) {
    n.geometry.computeBoundingBox();
    probePos.set(n.name, n.geometry.boundingBox!.getCenter(new THREE.Vector3()));
  }
  const tpl = new THREE.Group();
  // Mano: la palma del modelo con sus hijos (dorso/almohadilla/costuras, dedos y pulgar), girada al marco del código
  const hand = new THREE.Group();
  hand.name = "mano";
  hand.rotation.x = HAND_SPIN;
  const palmC = palm.clone(true);
  palmC.position.set(0, 0, 0); // la geometría de la palma ya está centrada en su nodo: el origen es el centro de palma
  hand.add(palmC);
  tpl.add(hand);
  // Brazo y antebrazo: girados 180° para crecer hacia +Y desde su articulación (el eje del Segment)
  const flip = (name: string, parts: THREE.Mesh[]) => {
    const g = new THREE.Group();
    g.name = name;
    g.rotation.x = Math.PI;
    for (const p of parts) g.add(meshOf(p));
    tpl.add(g);
  };
  flip("brazo_m", [upperM]);
  flip("antebrazo_m", [foreA, foreB]);
  // Muñequera: aro del color del guante (más claro) y tira de cierre pequeña; el aro baja de radio para que no
  // sobresalga de la manga y deja de verse como un disco oscuro desde arriba.
  const cuffG = new THREE.Group();
  cuffG.name = "muneca_m";
  cuffG.rotation.x = Math.PI;
  for (const m of [cuffA, cuffB]) {
    const isStrap = (m.material as THREE.Material).name === "tira";
    const part = new THREE.Mesh(m.geometry, isStrap ? cuffStrapMat : cuffRingMat);
    if (isStrap) part.scale.setScalar(0.55); // (la tira queda recogida dentro del aro: antes eran dos placas negras grandes)
    cuffG.add(part);
  }
  cuffG.scale.set(0.85, 0.9, 0.85); // radio −15 % (y algo más corta)
  tpl.add(cuffG);
  const elbow = new THREE.Group();
  elbow.name = "codo_m";
  elbow.add(meshOf(elbowM));
  tpl.add(elbow);
  return tpl;
}

function loadBase(): Promise<THREE.Group | null> {
  base ??= new GLTFLoader().loadAsync(ARM_MODEL_URL).then((gltf) => {
    const tpl = build(gltf.scene);
    if (tpl) ready = tpl;
    return tpl;
  }).catch(() => null);
  return base;
}

/** Brazo nuevo listo para animar: un rig por llamada (y por brazo), con nodos propios; geometrías y materiales
 * los comparte con los demás (Object3D.clone no los duplica). */
export function makeArmRig(): ArmRig | null {
  const tpl = ready;
  if (!tpl) return null;
  const copy = tpl.clone(true);
  const hand = copy.getObjectByName("mano") as THREE.Group | null;
  const palm = hand?.getObjectByName("palma") ?? null;
  const upper = copy.getObjectByName("brazo_m"), fore = copy.getObjectByName("antebrazo_m");
  const elbow = copy.getObjectByName("codo_m"), cuff = copy.getObjectByName("muneca_m");
  if (!hand || !palm || !upper || !fore || !elbow || !cuff) return null;
  const fingers: THREE.Object3D[][] = [], fingerProbes: THREE.Object3D[][] = [];
  const thumb: THREE.Object3D[] = [], thumbProbes: THREE.Object3D[] = [];
  const chain = (parent: THREE.Object3D, names: string[], into: THREE.Object3D[], probes: THREE.Object3D[]) => {
    for (const n of names) {
      const node = parent.getObjectByName(n);
      const at = probePos.get(n);
      if (!node || !at) return false;
      const probe = new THREE.Object3D();
      probe.position.copy(at);
      node.add(probe);
      into.push(node);
      probes.push(probe);
    }
    return true;
  };
  for (let f = 1; f <= 4; f++) {
    const ch: THREE.Object3D[] = [], pr: THREE.Object3D[] = [];
    if (!chain(palm, [`dedo_${f}_f1`, `dedo_${f}_f2`, `dedo_${f}_f3`], ch, pr)) return null;
    fingers.push(ch);
    fingerProbes.push(pr);
  }
  if (!chain(palm, ["pulgar_f1", "pulgar_f2", "pulgar_f3"], thumb, thumbProbes)) return null;
  return { hand, fingers, thumb, fingerProbes, thumbProbes, upper, fore, elbow, cuff };
}

/** Brazo del modelo si ya está cargado (si no, null: el brazo procedural de respaldo). */
export function armModelNow(): ArmRig | null {
  return makeArmRig();
}

/** Brazo del modelo cuando esté cargado (null si el GLB falla: se queda el respaldo procedural). */
export async function armModelReady(): Promise<ArmRig | null> {
  await loadBase();
  return makeArmRig();
}

/** Lanza la carga en segundo plano (al crear los brazos: el primer fotograma ya suele tenerla lista). */
export function preloadArmModel(): void {
  void loadBase();
}
