// Encuadre del arma en cadera por OBJETIVOS EN PANTALLA (tarea 13). En vez de constantes por clase que cada arma
// interpreta a su manera (largas «altísimas», pistolas con la mano en el borde), se resuelve para CADA arma real
// (con sus accesorios) la pose exacta que deja:
//   - la empuñadura (la mano derecha) en un punto de la pantalla y a una distancia dada de la cámara,
//   - la boca en otro punto de la pantalla (la dirección del cañón sale de ahí: converge hacia el centro como en las
//     referencias), con el alabeo que pida la clase.
// Solo matemáticas de Three.js (sin escena): se prueba en tests/hipframe.test.ts.
import * as THREE from "three";

/** Objetivos de encuadre de una clase: fracciones de pantalla (0,0 arriba a la izquierda). */
export interface FrameTarget {
  /** Empuñadura (centro de la mano derecha). */ grip: [number, number];
  /** Boca del arma (armas largas: la dirección del cañón sale de aquí). */ muzzle: [number, number];
  /** Armas cortas: dirección del cañón [cabeceo, guiñada] (rad; + = boca arriba / hacia la izquierda) en vez de la
   *  boca en pantalla (con un cañón tan corto, fijar la boca alta obligaba a ponerla «en vela», apuntando al techo). */ aim?: [number, number];
  /** Distancia (m) de la empuñadura a la cámara del arma, a lo largo de su rayo: decide el tamaño en pantalla. */ depth: number;
  /** Alabeo (rad) alrededor del cañón: + = el lomo cae hacia la izquierda. */ roll?: number;
}

export interface HipSolution { pos: [number, number, number]; rot: [number, number, number] }

/** Rayo (en la cámara del arma, mirando a −Z) que pasa por un punto de la pantalla. */
export function screenRay(sx: number, sy: number, fov: number, aspect: number): THREE.Vector3 {
  const t = Math.tan((fov * Math.PI) / 360);
  return new THREE.Vector3((sx - 0.5) * 2 * t * aspect, (0.5 - sy) * 2 * t, -1).normalize();
}

/** Proyección de un punto de la cámara del arma a fracción de pantalla. */
export function toScreen(p: THREE.Vector3, fov: number, aspect: number): [number, number] {
  const t = Math.tan((fov * Math.PI) / 360);
  return [0.5 + p.x / -p.z / (t * aspect) / 2, 0.5 - p.y / -p.z / t / 2];
}

/**
 * Pose del soporte del arma (posición y giro Euler XYZ, en el espacio de la cámara del mundo) que lleva `gripL` y
 * `muzzleL` (coordenadas del soporte, sin pose) a los objetivos. `back` = distancia de la cámara del arma detrás de
 * la del mundo (VM_BACK).
 */
export function solveHip(gripL: THREE.Vector3, muzzleL: THREE.Vector3, tg: FrameTarget, fov: number, aspect: number, back: number): HipSolution {
  // Empuñadura: en su rayo, a `depth`
  const G = screenRay(tg.grip[0], tg.grip[1], fov, aspect).multiplyScalar(tg.depth);
  // Boca: el punto de su rayo que está a la distancia empuñadura→boca (la solución lejana: el cañón va hacia delante)
  const v = muzzleL.clone().sub(gripL), L = v.length();
  let u: THREE.Vector3;
  if (tg.aim) u = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(tg.aim[0], tg.aim[1], 0, "YXZ"));
  else {
    const d = screenRay(tg.muzzle[0], tg.muzzle[1], fov, aspect);
    const b = d.dot(G), c = G.lengthSq() - L * L, disc = b * b - c;
    const s = disc > 0 ? b + Math.sqrt(disc) : Math.max(b, 0.05);
    u = d.clone().multiplyScalar(s).sub(G).normalize();
  }
  // Marco de destino: cañón `u`, «arriba» el de la cámara ortogonalizado, y alabeo alrededor del cañón
  const upT = new THREE.Vector3(0, 1, 0).addScaledVector(u, -u.y).normalize();
  if (tg.roll) upT.applyAxisAngle(u, tg.roll);
  // (con `aim` se alinea el EJE DEL CAÑÓN —−Z del soporte—, no el vector empuñadura→boca: en un revólver la culata
  //  queda muy por debajo del cañón y ese vector sube mucho, con lo que el arma salía ladeada y cabeceada)
  const vn = tg.aim ? new THREE.Vector3(0, 0, -1) : v.clone().normalize();
  const upS = new THREE.Vector3(0, 1, 0).addScaledVector(vn, -vn.y).normalize();
  const frame = (f: THREE.Vector3, up: THREE.Vector3) => { const r = new THREE.Vector3().crossVectors(up, f).normalize(); return new THREE.Matrix4().makeBasis(r, up, f); };
  const R = frame(u, upT).multiply(frame(vn, upS).invert());
  const q = new THREE.Quaternion().setFromRotationMatrix(R);
  const e = new THREE.Euler().setFromQuaternion(q, "XYZ");
  // Posición del soporte: la empuñadura girada cae en G (pasado a la cámara del mundo: la del arma está `back` detrás)
  const pos = G.clone().add(new THREE.Vector3(0, 0, back)).sub(gripL.clone().applyQuaternion(q));
  return { pos: [pos.x, pos.y, pos.z], rot: [e.x, e.y, e.z] };
}

/** Grosor de referencia de la clase (m, alto del modelo) y distancia máxima a la que se puede alejar un arma. */
export interface FrameLimits { bulk: number; depthMax: number }

/** Silueta (ancho y alto recortados a la pantalla) de los puntos `pts` (coordenadas del soporte) con la pose `sol`. */
export function silhouette(pts: readonly THREE.Vector3[], sol: HipSolution, fov: number, aspect: number, back: number): { w: number; h: number } {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(sol.rot[0], sol.rot[1], sol.rot[2], "XYZ"));
  const t = Math.tan((fov * Math.PI) / 360), hw = t * aspect;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; const v = new THREE.Vector3();
  for (const p of pts) {
    v.copy(p).applyQuaternion(q); v.x += sol.pos[0]; v.y += sol.pos[1]; v.z += sol.pos[2] - back;
    if (v.z > -0.02) continue;
    const nx = v.x / -v.z / hw, ny = v.y / -v.z / t;
    if (nx < x0) x0 = nx; if (nx > x1) x1 = nx; if (ny < y0) y0 = ny; if (ny > y1) y1 = ny;
  }
  if (!(x1 >= x0)) return { w: 0, h: 0 };
  return { w: (Math.min(1, x1) - Math.max(-1, x0)) / 2, h: (Math.min(1, y1) - Math.max(-1, y0)) / 2 };
}

/**
 * Como `solveHip`, pero aleja el arma por el mismo rayo de la empuñadura (la mano no cambia de sitio en pantalla) en
 * proporción a su grosor real (`bulk`, alto del modelo en m) respecto al de referencia de la clase: el grosor en
 * pantalla queda acotado y las voluminosas (ametralladoras con tambor, bullpups, escopetas gruesas) ya no llenan media
 * pantalla; las normales quedan a la distancia de la clase. (La silueta recortada no sirve de criterio: con la mano
 * abajo y la boca en el centro, su alto apenas depende de la distancia.)
 */
export function solveHipFit(bulk: number, gripL: THREE.Vector3, muzzleL: THREE.Vector3, tg: FrameTarget, lim: FrameLimits, fov: number, aspect: number, back: number): HipSolution & { depth: number } {
  const k = Number.isFinite(bulk) && bulk > 0 ? Math.max(1, bulk / lim.bulk) : 1;
  const depth = Math.min(Math.max(tg.depth, lim.depthMax), tg.depth * k);
  return { ...solveHip(gripL, muzzleL, { ...tg, depth }, fov, aspect, back), depth };
}
