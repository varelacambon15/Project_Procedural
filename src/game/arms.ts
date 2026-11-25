// Brazos en primera persona (V1): manga de chaqueta con puño, codo y pliegues; guante táctico con nudillera y
// dedos articulados (3 falanges + pulgar) que se cierran según el agarre; reloj en la muñeca izquierda.
// Todo generado por código con texturas pixeladas (mismo estilo que las armas). IK analítico de dos huesos.
// Si el GLB del brazo (armmodel.ts) está disponible, la mano y las mallas de brazo/antebrazo son las del modelo y
// este código procedural queda como respaldo (el GLB puede no cargar: nada se borra).
// La interfaz es de manos: posición, orientación y cierre de cada mano, en el espacio de la cámara
// (-Z hacia delante, +Y arriba). Marco local de la mano: dedos hacia -Z, dorso hacia +Y, muñeca hacia +Z.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ARM_MODEL_LENGTHS, type ArmRig, armModelNow, armModelReady, preloadArmModel } from "./armmodel";

/** Falange redondeada: cápsula a lo largo de -Z que empieza en el nudillo y mide `len` en total. */
function phalanx(r: number, len: number, mat: THREE.Material, flat = 0.9) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 3, 8); g.rotateX(Math.PI / 2); g.scale(1, flat, 1);
  const m = new THREE.Mesh(g, mat); m.position.z = -len / 2; return m;
}

/** Medidas del brazo (datos, no código): cambiar de modelo no obliga a rehacer el IK. */
export const ARM_DATA = {
  // (brazo de unos 70 cm hasta la palma y hombro izquierdo algo más cerca del centro: con armas largas la mano de apoyo
  // no llegaba al guardamanos y el brazo quedaba recto, con el arma «sostenida» desde abajo)
  upper: 0.37, fore: 0.35,
  shoulderR: new THREE.Vector3(0.22, -0.38, 0.08),
  shoulderL: new THREE.Vector3(-0.2, -0.4, 0.04),
  poleR: new THREE.Vector3(0.7, -1, 0.1),   // el codo derecho apunta hacia abajo y afuera
  poleL: new THREE.Vector3(-0.6, -1, 0.2),
  /** 0 = el antebrazo va hacia el hombro (muñeca doblada); 1 = sigue la mano (muñeca recta). */
  wristStraight: 0.5,
};

/** Cierre de la mano: índice, corazón, anular, meñique (0 abierta … 1 puño) y pulgar. */
export interface Curl { fingers: [number, number, number, number]; thumb: number }
export interface HandPose { pos: THREE.Vector3; orient: THREE.Quaternion; curl: Curl; /** Muñeca recta: el antebrazo sigue el eje de la mano (0 = no, 1 = del todo; pistolas). */ straight?: number; /** Abre el codo de la mano de apoyo hacia fuera (0 = el de siempre): el antebrazo sale en diagonal por el borde inferior, sin quedar como un poste vertical (cerrojos, ametralladoras y bullpup). */ flare?: number; /** Grosor del antebrazo (1 = el de siempre; <1 lo afina): el francotirador lo lleva más fino para que el tubo de la manga no domine la vista. */ girth?: number; /** Giro del pulgar en el plano de la palma (rad; 0 = el del modelo): los puños lo cruzan sobre los dedos. */ thumbTurn?: number; /** Giro del pulgar hacia la palma (rad, eje Y de su base en el GLB): lo pliega sobre los dedos del puño. */ thumbSwing?: number; /** Escala de la mano (1 = la de siempre): los puños la llevan algo mayor. */ handScale?: number; /** Dirección del antebrazo desde la muñeca hacia el codo (cámara), si la pose la fija (puños en guardia: hacia la esquina de su lado). */ fore?: THREE.Vector3 }
export interface HandTargets { right: HandPose; left: HandPose | null; dt?: number; /** Desplazamiento de los hombros (movimientos rápidos del arma). */ shoulder?: THREE.Vector3 }

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
  g.fillStyle = "#4b5462"; g.fillRect(0, 0, 32, 32); // gris pizarra (antes verde oliva)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x + y) % 3 === 0) { g.fillStyle = "rgba(0,0,0,0.06)"; g.fillRect(x, y, 1, 1); }
  for (let i = 0; i < 120; i++) { const v = rnd() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${rnd() * 0.06})`; g.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1); }
  g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(15, 0, 1, 32); g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(16, 0, 1, 32);
});
fabricTex?.repeat.set(2, 3);
/** Guante: material sintético con relieve fino. */
const gloveTex = pixTex(16, 16, (g) => {
  g.fillStyle = "#43392f"; g.fillRect(0, 0, 16, 16); // coyote oscuro
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`; g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
  for (let y = 0; y < 16; y += 4) { g.fillStyle = "rgba(0,0,0,0.2)"; g.fillRect(0, y, 16, 1); }
});
const sleeve = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.92 });
const sleeveDark = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.95 });
const glove = new THREE.MeshStandardMaterial({ map: gloveTex, roughness: 0.7, metalness: 0.05 });
const gloveArmor = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.5, metalness: 0.25 });
const strap = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.6 });
const watchFace = new THREE.MeshStandardMaterial({ color: 0x101214, emissive: 0x6a4a2a, // (esfera ámbar: nada de verde en los brazos)
  emissiveIntensity: 0.25, roughness: 0.25, metalness: 0.4 });
const patchMat = new THREE.MeshStandardMaterial({ map: pixTex(8, 8, (g) => { g.fillStyle = "#2b3038"; g.fillRect(0, 0, 8, 8); g.fillStyle = "#e07a2a"; g.fillRect(1, 1, 6, 1); g.fillRect(1, 3, 4, 1); g.fillRect(1, 5, 5, 1); g.strokeStyle = "#1a1d22"; g.strokeRect(0.5, 0.5, 7, 7); }), roughness: 0.9 });

const Y = new THREE.Vector3(0, 1, 0);
const cyl = (rTop: number, rBot: number, mat: THREE.Material, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, 1, seg, 1), mat);

/** Tramo de brazo: un grupo orientado de A a B; el cuerpo se escala al largo y los adornos van en metros. */
class Segment {
  readonly g = new THREE.Group(); private body: THREE.Object3D; private ends: { m: THREE.Object3D; at: number }[] = [];
  /** Longitud natural del cuerpo en su eje (1 = el cilindro de altura 1; con malla del GLB, la de sus articulaciones). */
  private nat = 1; private centered = true;
  constructor(parent: THREE.Object3D, rA: number, rB: number, mat: THREE.Material) {
    this.body = cyl(rB, rA, mat, 12); this.g.add(this.body); parent.add(this.g);
  }
  /** Cambia el cilindro por una malla del GLB: nace en el origen y crece hacia +Y hasta `nat` (más su solape). */
  useModel(model: THREE.Object3D, nat: number) {
    this.g.remove(this.body); this.body = model; this.nat = nat; this.centered = false; this.g.add(model);
  }
  /** Adorno a `at` metros del inicio (negativo = desde el final). */
  deco(m: THREE.Object3D, at: number) { this.g.add(m); this.ends.push({ m, at }); return m; }
  set(a: THREE.Vector3, b: THREE.Vector3) {
    const len = a.distanceTo(b);
    this.g.position.copy(a); this.g.quaternion.setFromUnitVectors(Y, b.clone().sub(a).normalize());
    // El cilindro se estira al largo; la malla del GLB solo se escala en su eje (nunca en el radio)
    this.body.scale.y = this.centered ? len : len / this.nat;
    this.body.position.y = this.centered ? len / 2 : 0;
    for (const e of this.ends) e.m.position.y = e.at >= 0 ? e.at : len + e.at;
  }
}

/** Mano con dedos articulados: con el GLB usa sus mallas y pivotes; si no, la procedural de siempre. */
class Hand {
  readonly g = new THREE.Group();
  /** Pivotes de falanges [dedo][falange]: `rotation.x` negativo cierra hacia la palma (índice … meñique). */
  readonly fingers: THREE.Object3D[][] = [];
  /** Pivotes del pulgar. */
  readonly thumb: THREE.Object3D[] = [];
  /** Centro de cada falange (lo mide `fitCurls`): la propia falange en el procedural, una sonda en el GLB. */
  private fp: THREE.Object3D[][] = []; private tp: THREE.Object3D[] = [];
  /** Cierre por falange: la distal algo menos. */
  private readonly fk = [1.15, 1.3, 1.0];
  /** Cierre del pulgar por tramo (3 falanges con el GLB, 2 en el procedural). */
  private readonly tk: number[];
  /** Mano del GLB (el giro del pulgar solo tiene sentido con sus ejes: el procedural ya nace cruzado). */
  private readonly fromModel: boolean;
  private cur: Curl = { fingers: [0.5, 0.5, 0.5, 0.5], thumb: 0.3 };
  constructor(parent: THREE.Object3D, readonly side: 1 | -1, withWatch: boolean, rig: ArmRig | null = null) {
    const s = side;
    this.fromModel = !!rig;
    if (rig) {
      // Mano del GLB: la palma del modelo con sus dedos, al tamaño de siempre. La izquierda es el espejo en X
      // (escala negativa: three.js le da la vuelta a la orientación de las caras con el determinante, así que no se
      // ve del revés ni sin iluminar y las geometrías/materiales siguen compartidos con la derecha).
      this.g.add(rig.hand);
      for (let f = 0; f < 4; f++) { this.fingers.push(rig.fingers[f]); this.fp.push(rig.fingerProbes[f]); }
      this.thumb.push(...rig.thumb); this.tp.push(...rig.thumbProbes);
      this.tk = [0.5, 0.55, 0.55];
      this.g.scale.set(0.76 * s, 0.8, 0.84);
      if (withWatch) {
        // Reloj en la muñeca izquierda, encima de la muñequera (esfera ámbar: nada de verde en los brazos)
        // (correa como aro fino y no un cilindro con tapas: de frente era el disco negro que tapaba la muñeca)
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.006, 4, 16), strap); band.position.z = 0.075; this.g.add(band); // (ceñida a la muñeca: más ancha sobresalía como un aro)
        const face = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.01, 0.034, 1, 0.003), watchFace); face.position.set(0, 0.045, 0.075); this.g.add(face);
      }
    } else {
      this.tk = [0.6, 1.0];
      // Palma más redondeada y algo más estrecha hacia la muñeca (antes una caja que en primer plano se veía como un bloque)
      const palm = new THREE.Mesh(new RoundedBoxGeometry(0.076, 0.026, 0.084, 3, 0.012), glove); this.g.add(palm);
      const heel = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), glove); heel.scale.set(1.15, 0.45, 0.9); heel.position.set(0, -0.002, 0.03); this.g.add(heel);
      // Eminencia del pulgar (la base carnosa junto a la palma)
      const thenar = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), glove); thenar.scale.set(1, 0.8, 1.5); thenar.position.set(-0.03 * s, -0.006, 0.006); this.g.add(thenar);
      // Nudillos: cuatro bultos redondeados con refuerzo encima (en lugar de una barra plana)
      for (let f = 0; f < 4; f++) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.0092, 8, 6), gloveArmor); kn.scale.set(1, 0.7, 1); kn.position.set([-0.0255, -0.0085, 0.0085, 0.0245][f] * s, 0.012, -0.037); this.g.add(kn); }
      const knuckle = new THREE.Mesh(new RoundedBoxGeometry(0.066, 0.006, 0.02, 1, 0.0025), gloveArmor); knuckle.position.set(0, 0.016, -0.028); this.g.add(knuckle);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.034), gloveArmor); back.position.set(0.004 * s, 0.016, 0.006); this.g.add(back);
      // Puño del guante con su cierre de velcro y la tira (extremos redondeados: un cilindro con tapa plana de frente a
      // la cámara se veía como un disco negro enorme en las recargas)
      const gauntlet = new THREE.Mesh(new THREE.CapsuleGeometry(0.029, 0.026, 4, 12), glove);
      gauntlet.rotation.x = Math.PI / 2; gauntlet.position.z = 0.064; gauntlet.scale.x = 1.08; this.g.add(gauntlet);
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.006, 0.022), strap); tab.position.set(0.012 * s, 0.038, 0.066); this.g.add(tab);
      if (withWatch) {
        const band = cyl(0.031, 0.031, strap, 12); band.rotation.x = Math.PI / 2; band.scale.y = 0.016; band.position.z = 0.1; this.g.add(band);
        const face = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.008, 0.026, 1, 0.003), watchFace); face.position.set(0, 0.04, 0.1); this.g.add(face);
      }
      // Dedos: índice (junto al pulgar) … meñique; 3 falanges con pivote en cada nudillo
      const lens = [[0.04, 0.025, 0.02], [0.044, 0.027, 0.021], [0.041, 0.025, 0.02], [0.032, 0.021, 0.018]];
      const xs = [-0.0255, -0.0085, 0.0085, 0.0245], ws = [0.0158, 0.0162, 0.0154, 0.0138];
      for (let f = 0; f < 4; f++) {
        const chain: THREE.Group[] = []; let parentG: THREE.Object3D = this.g;
        for (let k = 0; k < 3; k++) {
          const piv = new THREE.Group(); piv.position.set(k === 0 ? xs[f] * s : 0, k === 0 ? -0.002 : 0, k === 0 ? -0.04 : -lens[f][k - 1]);
          const w = ws[f] * (1 - k * 0.1) * 0.9;
          piv.add(phalanx(w / 2, lens[f][k] + 0.004, glove));
          if (k === 0) { const pad = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.003, lens[f][0] * 0.6), gloveArmor); pad.position.set(0, w * 0.5, -lens[f][0] * 0.5); piv.add(pad); }
          parentG.add(piv); chain.push(piv); parentG = piv;
        }
        this.fingers.push(chain); this.fp.push(chain.map((p) => p.children[0]));
      }
      // Pulgar: sale del lateral de la palma, hacia delante y hacia dentro
      const tb = new THREE.Group(); tb.position.set(-0.036 * s, -0.008, -0.004); tb.rotation.set(-0.35, 0.75 * s, 0.6 * s); this.g.add(tb);
      let par: THREE.Object3D = tb;
      for (const [k, len] of [0.036, 0.03].entries()) {
        const piv = new THREE.Group(); piv.position.z = k === 0 ? 0 : -0.036;
        piv.add(phalanx(0.0095 - k * 0.001, len + 0.005, glove, 0.95));
        par.add(piv); this.thumb.push(piv); par = piv;
      }
      this.tp.push(...this.thumb.map((p) => p.children[0]));
      // Mano algo más pequeña y fina que el primer modelo (se veía enorme en primera persona)
      this.g.scale.set(0.76, 0.8, 0.84);
    }
    for (const o of this.g.children) o.traverse((m) => { (m as THREE.Mesh).renderOrder = 9; });
    parent.add(this.g);
  }
  private baseScale: THREE.Vector3 | null = null;
  set(p: HandPose, k: number) {
    this.baseScale ??= this.g.scale.clone();
    this.g.scale.copy(this.baseScale).multiplyScalar(p.handScale ?? 1);
    this.g.position.copy(p.pos);
    this.g.quaternion.copy(p.orient);
    for (let f = 0; f < 4; f++) this.cur.fingers[f] += (p.curl.fingers[f] - this.cur.fingers[f]) * k;
    this.cur.thumb += (p.curl.thumb - this.cur.thumb) * k;
    // Cerrar = girar cada falange hacia la palma (-Y); la distal algo menos
    for (let f = 0; f < 4; f++) {
      const c = this.cur.fingers[f], ch = this.fingers[f];
      for (let k = 0; k < ch.length; k++) ch[k].rotation.x = -c * this.fk[k];
    }
    // (giro del pulgar sobre los dedos: los puños del modelo lo cruzan por delante; el resto de poses lo dejan en 0)
    if (this.fromModel && this.thumb[0]) { this.thumb[0].rotation.z = p.thumbTurn ?? 0; this.thumb[0].rotation.y = p.thumbSwing ?? 0; }
    for (let k = 0; k < this.thumb.length; k++) this.thumb[k].rotation.x = -this.cur.thumb * this.tk[k];
  }
  snap(p: HandPose) { this.g.quaternion.copy(p.orient); this.set(p, 1); }
  /**
   * Cierre de cada dedo que deja sus falanges media y distal apoyadas en una superficie (`dist`: distancia en metros
   * desde un punto del mundo a la empuñadura). Prueba cierres y se queda con el que las deja a ~8 mm (sin atravesar).
   * Devuelve el cierre por dedo (índice incluido, aunque el gatillo lo sobrescribe).
   */
  fitCurls(dist: (p: THREE.Vector3) => number): number[] {
    const out: number[] = [], v = new THREE.Vector3();
    for (let f = 0; f < 4; f++) {
      const ch = this.fingers[f]; let best = this.cur.fingers[f], bestCost = Infinity;
      for (let c = 0.3; c <= 1.75; c += 0.05) {
        for (let k = 0; k < ch.length; k++) ch[k].rotation.x = -c * this.fk[k];
        this.g.updateMatrixWorld(true);
        const dm = dist(this.fp[f][1].getWorldPosition(v)), dd = dist(this.fp[f][2].getWorldPosition(v));
        const cost = Math.abs(dm - 0.008) + Math.abs(dd - 0.008) * 1.3 + (dd < 0.004 ? 0.02 : 0);
        if (cost < bestCost) { bestCost = cost; best = c; }
      }
      out.push(best);
      const c = this.cur.fingers[f]; for (let k = 0; k < ch.length; k++) ch[k].rotation.x = -c * this.fk[k];
    }
    // Pulgar: el mayor cierre con el que ninguna de sus dos falanges entra en la empuñadura (antes la atravesaba)
    let tBest = 0;
    for (let c = 0; c <= 1.2; c += 0.05) {
      for (let k = 0; k < this.thumb.length; k++) this.thumb[k].rotation.x = -c * this.tk[k];
      this.g.updateMatrixWorld(true);
      const d0 = dist(this.tp[0].getWorldPosition(v)), d1 = dist(this.tp[1].getWorldPosition(v));
      if (Math.min(d0, d1) < 0.009) break;
      tBest = c;
    }
    out.push(tBest);
    for (let k = 0; k < this.thumb.length; k++) this.thumb[k].rotation.x = -this.cur.thumb * this.tk[k];
    return out;
  }
}

class Arm {
  readonly upper: Segment; readonly fore: Segment; readonly hand: Hand; private elbowM: THREE.Object3D;
  private first = true;
  constructor(parent: THREE.Object3D, readonly side: 1 | -1, rig: ArmRig | null = null) {
    this.upper = new Segment(parent, 0.038, 0.032, sleeve);
    this.fore = new Segment(parent, 0.031, 0.024, sleeve);
    if (rig) {
      // Mallas del GLB: se escalan solo en su eje hasta el largo del segmento (Segment.set); el codo es el del modelo
      // y la muñequera, al final del antebrazo, solapa manga y guante (sin disco plano de frente a la cámara).
      this.upper.useModel(rig.upper, ARM_MODEL_LENGTHS.upper);
      this.fore.useModel(rig.fore, ARM_MODEL_LENGTHS.fore);
      this.fore.deco(rig.cuff, -0.001); // (0 = el inicio del segmento; la muñequera vive en la articulación, al final)
      this.elbowM = rig.elbow;
      parent.add(this.elbowM);
    } else {
      this.elbowM = new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 8), sleeve); parent.add(this.elbowM);
      // Parche en el hombro, pliegues en el antebrazo y puño de la chaqueta (más oscuro) que tapa el guante
      const patch = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.006), patchMat); patch.position.set(0.042 * side, 0, 0); patch.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; this.upper.deco(patch, 0.09);
      for (const at of [0.08, 0.15]) { const fold = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.003, 5, 12), sleeve); fold.rotation.x = Math.PI / 2; fold.scale.set(1, 1.1, 1); this.fore.deco(fold, at); }
      const cuffM = cyl(0.028, 0.03, sleeveDark, 12); cuffM.scale.y = 0.04; this.fore.deco(cuffM, -0.02);
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.029, 0.0025, 4, 12), sleeveDark); hem.rotation.x = Math.PI / 2; this.fore.deco(hem, -0.002);
    }
    this.hand = new Hand(parent, side, side < 0, rig);
    for (const g of [this.upper.g, this.fore.g, this.elbowM]) g.traverse((m) => { (m as THREE.Mesh).renderOrder = 9; (m as THREE.Mesh).castShadow = false; });
  }
  /** Quita sus piezas del padre (al sustituir el brazo procedural por el modelo GLB). */
  dispose() {
    for (const o of [this.upper.g, this.fore.g, this.elbowM, this.hand.g]) o.parent?.remove(o);
  }
  private cur = new THREE.Vector3();
  set(shoulder: THREE.Vector3, p: HandPose, pole: THREE.Vector3, dt: number) {
    const k = this.first ? 1 : Math.min(1, dt * 16);
    // Posición: sigue al objetivo exacta (las curvas ya son suaves) salvo en saltos grandes (ir a la cartuchera,
    // cambiar de agarre), donde la mano viaja en vez de teletransportarse
    // Posición exacta (el suavizado de los saltos de agarre se hace en coordenadas del arma, en gun.ts): si se suavizara
    // aquí, al moverse deprisa la mano se quedaba atrás del arma y "se volvía loca"
    this.cur.copy(p.pos);
    this.first = false;
    this.hand.set({ ...p, pos: this.cur.clone() }, k);
    p = { ...p, pos: this.cur.clone() };
    // La muñeca está detrás de la palma (en +Z de la mano); el IK llega a la muñeca
    const wrist = p.pos.clone().add(new THREE.Vector3(0, 0.003, 0.062).applyQuaternion(this.hand.g.quaternion));
    // Muñeca recta: el antebrazo sigue la dirección de la mano (su eje +Z, hacia la muñeca) en vez de venir de un
    // hombro fijo, que doblaba la muñeca hacia abajo. El hombro queda fuera de cuadro y se estira lo que haga falta.
    const ik = solveTwoBone(shoulder, wrist, ARM_DATA.upper, ARM_DATA.fore, pole);
    // (dirección natural del antebrazo en primera persona: hacia abajo, hacia atrás y por fuera, como en los shooters;
    //  el brazo de apoyo sale del borde inferior y se mete por debajo del guardamanos, no por delante del arma)
    // `flare` abre el codo de la mano izquierda hacia fuera: el antebrazo baja en diagonal (referencias) en vez de caer
    // como un poste vertical cuando la mano queda baja en el encuadre.
    const fl = this.side < 0 ? (p.flare ?? 0) : 0;
    // (tarea 13: los dos antebrazos entran en DIAGONAL por el borde inferior, como en las referencias: el izquierdo
    //  desde abajo a la izquierda, sin quedar como un poste vertical; el derecho desde abajo a la derecha, más hacia
    //  abajo que hacia atrás, porque hacia atrás pasaba junto a la cámara y se veía como una caja horizontal)
    const natural = this.side < 0 ? new THREE.Vector3(-0.62 - 0.2 * fl, -0.66 + 0.1 * fl, 0.34).normalize() : new THREE.Vector3(0.3, -0.9, 0.3).normalize();
    // (con `straight`, el antebrazo continúa el eje de la mano, un poco hacia abajo: muñeca sin quebrar)
    const handAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(this.hand.g.quaternion).multiply(new THREE.Vector3(0.25, 1, 1)).add(new THREE.Vector3(0, -1.8, 0)).normalize();
    const along = p.straight ? natural.clone().lerp(handAxis, p.straight).normalize() : natural;
    const dIk = ik.clone().sub(wrist).normalize(), dir = p.fore ? p.fore.clone().normalize() : dIk.clone().lerp(along, p.straight ? 0.92 : ARM_DATA.wristStraight).normalize();
    const elbow = wrist.clone().addScaledVector(dir, ARM_DATA.fore);
    // (pistolas: el brazo superior sigue hacia abajo, fuera de cuadro; desde el hombro fijo pasaba pegado a la cámara
    // y en perspectiva se veía como un tubo enorme hacia el lado)
    // (tarea 13: el brazo derecho siempre cuelga del codo hacia abajo y fuera de cuadro; desde el hombro fijo el brazo
    //  superior pasaba junto a la cámara y se veía como un bloque enorme abajo a la derecha)
    const sh = p.straight || p.fore || this.side > 0 ? elbow.clone().addScaledVector(dir.clone().add(new THREE.Vector3(0.1 * this.side, -0.6, 0)).normalize(), ARM_DATA.upper) : shoulder;
    this.upper.set(sh, elbow); this.elbowM.position.copy(elbow);
    this.fore.set(elbow, wrist);
    // (grosor del antebrazo: el francotirador lo lleva más fino; el resto, el de siempre)
    const g = p.girth ?? 1; this.fore.g.scale.set(g, 1, g); this.elbowM.scale.setScalar(g); this.upper.g.scale.set(g, 1, g); // (también el brazo: si no, al afinar el antebrazo el codo quedaba como un escalón)
  }
}

export class Arms {
  readonly group = new THREE.Group();
  private right!: Arm; private left!: Arm;
  constructor(camera: THREE.Object3D) {
    camera.add(this.group);
    // El GLB del brazo se carga en segundo plano: si llega tarde (menú de inicio), al estar listo se sustituyen los
    // brazos procedurales por el modelo. Cada brazo pide su propio rig (los nodos solo pueden tener un padre; las
    // geometrías y los materiales van compartidos entre los dos brazos).
    preloadArmModel();
    this.build();
    void armModelReady().then((m) => { if (m) this.build(); });
  }
  private build() {
    this.right?.dispose(); this.left?.dispose();
    this.right = new Arm(this.group, 1, armModelNow());
    this.left = new Arm(this.group, -1, armModelNow());
  }
  /** Coloca las manos (coordenadas de la cámara). Si `left` es null, el brazo izquierdo baja fuera de la vista. */
  /** Si está, manda sobre las manos del arma (animación de invocación de un súper). */
  override: { right: HandPose; left: HandPose } | null = null;
  update(t: HandTargets) {
    const dt = t.dt ?? 1;
    if (this.override) t = { ...t, right: this.override.right, left: this.override.left };
    const sh = t.shoulder ?? new THREE.Vector3();
    this.right.set(ARM_DATA.shoulderR.clone().add(sh), t.right, ARM_DATA.poleR, dt);
    const left = t.left ?? { pos: new THREE.Vector3(-0.3, -0.75, 0.75), orient: t.right.orient, curl: { fingers: [0.4, 0.45, 0.5, 0.55], thumb: 0.2 } };
    this.left.set(ARM_DATA.shoulderL.clone().add(sh), left, ARM_DATA.poleL, dt);
  }
  set visible(v: boolean) { this.group.visible = v; }
  /** Mano derecha (para ajustar el cierre de los dedos a la empuñadura de cada arma). */
  get rightHand() { return this.right.hand; }
}
