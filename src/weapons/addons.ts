// Geometría de los añadidos estructurales (low poly, por código). Cada uno ocupa exactamente la caja que el generador
// usó en la silueta (de x0 a x1, de y a y + h) y toma el color del arma por su rol (acabado del arma: anti-parche).
// Roles neutros: ni las manos ni las animaciones los confunden con la empuñadura, el guardamanos o la palanca.
import * as THREE from "three";
import type { Addon, PartRole } from "./types";

const mat = (name: string) => new THREE.MeshStandardMaterial({ name });
function box(w: number, h: number, d: number, x: number, y: number, z = 0, name = "add") {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(name)); m.position.set(x, y, z); return m;
}
function tube(r: number, len: number, x: number, y: number, name = "add", seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat(name)); m.rotation.z = -Math.PI / 2; m.position.set(x, y, 0); return m;
}

export const ADDON_ROLE: Record<Addon["kind"], PartRole> = {
  rib: "barrel", lug: "barrel", shield: "barrel", jacket: "barrel", ladder: "barrel", bipod: "barrel", handle: "barrel",
  cheek: "stock",
};

/** Construye un añadido. `thick` = grosor del cajón del arma (para que encaje de ancho). */
export function buildAddon(a: Addon, thick: number): THREE.Group {
  const g = new THREE.Group();
  const L = a.x1 - a.x0, cx = (a.x0 + a.x1) / 2, cy = a.y + a.h / 2;
  const t = Math.max(0.012, Math.min(0.05, thick));
  switch (a.kind) {
    case "rib": {
      // Banda ventilada: tira superior sobre postes
      g.add(box(L, a.h * 0.45, t * 0.42, cx, a.y + a.h * 0.78));
      for (let x = a.x0 + 0.006; x < a.x1 - 0.004; x += 0.018) g.add(box(0.005, a.h * 0.6, t * 0.3, x, a.y + a.h * 0.32));
      break;
    }
    case "lug": {
      // Tetón bajo el cañón, con el frente achaflanado
      g.add(box(L - 0.006, a.h, t * 0.62, cx - 0.003, cy));
      const nose = box(0.008, a.h * 0.8, t * 0.6, a.x1 - 0.004, cy + a.h * 0.08); nose.rotation.z = 0.35; g.add(nose);
      break;
    }
    case "shield": {
      // Cubrecañón perforado: chapa con filas de respiraderos en relieve
      g.add(box(L, a.h, t * 0.98, cx, cy));
      for (let x = a.x0 + 0.012; x < a.x1 - 0.01; x += 0.016) for (const z of [-1, 1]) g.add(box(0.008, a.h * 0.42, 0.0015, x, cy, z * (t * 0.49 + 0.0008), "vent"));
      break;
    }
    case "jacket": {
      // Camisa de refrigeración: cilindro con aletas
      const r = Math.min(a.h / 2, t * 0.75);
      g.add(tube(r * 0.9, L, cx, cy, "add", 14));
      for (let x = a.x0 + 0.01; x < a.x1 - 0.006; x += 0.016) g.add(tube(r, 0.005, x, cy, "fin", 14));
      break;
    }
    case "bipod": {
      // Bípode plegado bajo el cañón: dos patas y la abrazadera delante
      for (const z of [-1, 1]) g.add(box(L, 0.005, 0.005, cx, a.y + a.h * 0.45, z * t * 0.32));
      g.add(box(0.02, a.h, t * 0.85, a.x1 - 0.01, cy));
      for (const z of [-1, 1]) g.add(box(0.008, 0.008, 0.012, a.x0 + 0.004, a.y + a.h * 0.35, z * t * 0.32));
      break;
    }
    case "ladder": {
      // Alza de escalera: base y hoja levantada con su ranura
      g.add(box(L, a.h * 0.3, t * 0.6, cx, a.y + a.h * 0.15));
      g.add(box(0.004, a.h * 0.85, t * 0.5, a.x0 + L * 0.35, a.y + a.h * 0.55));
      g.add(box(0.004, a.h * 0.85, t * 0.5, a.x0 + L * 0.55, a.y + a.h * 0.55));
      break;
    }
    case "handle": {
      // Asa de transporte: dos postes y la barra superior
      // (patas desde la base hasta la barra; barra de altura fija, no proporcional a toda el asa)
      const bar = Math.min(0.009, a.h * 0.4);
      g.add(box(0.011, a.h, t * 0.55, a.x0 + 0.0055, cy));
      g.add(box(0.011, a.h, t * 0.55, a.x1 - 0.0055, cy));
      g.add(box(L, bar, t * 0.6, cx, a.y + a.h - bar / 2));
      break;
    }
    case "cheek": {
      // Carrillera: cuña baja y biselada que sube hacia atrás, apoyada en el lomo de la culata (antes era una caja)
      const sh = new THREE.Shape();
      sh.moveTo(a.x1, a.y); sh.lineTo(a.x1 - L * 0.12, a.y + a.h * 0.35);
      sh.quadraticCurveTo(a.x0 + L * 0.55, a.y + a.h * 0.85, a.x0 + L * 0.08, a.y + a.h * 0.9);
      sh.quadraticCurveTo(a.x0, a.y + a.h * 0.9, a.x0, a.y + a.h * 0.6); sh.lineTo(a.x0, a.y); sh.closePath();
      const depth = t * 0.72;
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.0025, bevelSegments: 2, curveSegments: 6 });
      geo.translate(0, 0, -depth / 2);
      g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: "add" })));
      break;
    }
  }
  for (const m of g.children) (m as THREE.Mesh).castShadow = true;
  return g;
}
