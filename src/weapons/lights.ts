// Accesorios de la ranura 4 («accesorio»): linternas, láseres y combinados. Los del kit del usuario (k-att-* / k-device-*)
// y otros hechos por código (pa-*), con formas distintas. Todos se encienden y apagan con el botón de la linterna.
import * as THREE from "three";

export type LightKind = "light" | "laser" | "both" | "strobe";

/** Accesorios por código: id, tipo y una descripción corta de su forma (las mallas, en buildLight). */
export const PROC_LIGHTS: { id: string; kind: LightKind }[] = [
  { id: "pa-light-long", kind: "light" },     // linterna táctica larga con anilla de sujeción
  { id: "pa-light-compact", kind: "light" },  // linterna compacta, ancha y corta
  { id: "pa-laser-mini", kind: "laser" },     // láser compacto en caja
  { id: "pa-laser-module", kind: "laser" },   // módulo láser largo con dos ventanas
  { id: "pa-combo", kind: "both" },           // caja combinada: linterna y láser
  { id: "pa-strobe", kind: "strobe" },        // linterna estroboscópica (parpadea al encender)
  { id: "pa-killcounter", kind: "light" },    // contador de bajas (pantallita en el costado)
];

/** ¿Es una linterna o un láser (ranura de accesorio) y no algo de bajo el cañón? */
export const isLight = (id: string | null | undefined) => !!id && (/^pa-/.test(id) || /flashlight|laser/.test(id));
export function lightKind(id: string): LightKind {
  const p = PROC_LIGHTS.find((x) => x.id === id); if (p) return p.kind;
  return /laserlight/.test(id) ? "both" : /laser/.test(id) ? "laser" : "light";
}

/**
 * Malla de un accesorio por código. Se construye como los del kit: a lo largo de +X (hacia la boca), con la cara de
 * montaje arriba (y = 0) y el cuerpo colgando hacia -Y; el ensamblador lo gira para el costado.
 */
export function buildLight(id: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.55, metalness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121416, roughness: 0.7, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb4c8, roughness: 0.15, metalness: 0.2, emissive: new THREE.Color(0x111820) });
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const cyl = (r: number, l: number, m: THREE.Material, x: number, y: number, z = 0, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, seg), m); o.rotation.z = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
  const clamp = (x: number, w: number) => box(w, 0.008, 0.02, dark, x, -0.004);
  if (id === "pa-light-long") {
    clamp(0.0, 0.03); cyl(0.011, 0.1, body, 0.005, -0.019); cyl(0.0135, 0.02, body, 0.06, -0.019); cyl(0.012, 0.003, glass, 0.071, -0.019);
    for (const x of [-0.03, -0.02]) cyl(0.0115, 0.003, dark, x, -0.019);
  } else if (id === "pa-light-compact") {
    clamp(0, 0.026); box(0.045, 0.024, 0.022, body, 0.002, -0.02); cyl(0.0105, 0.012, body, 0.03, -0.021); cyl(0.0095, 0.002, glass, 0.037, -0.021);
  } else if (id === "pa-laser-mini") {
    clamp(0, 0.022); box(0.034, 0.016, 0.018, body, 0, -0.015); cyl(0.0035, 0.004, glass, 0.019, -0.016);
    box(0.006, 0.004, 0.004, dark, -0.008, -0.024);
  } else if (id === "pa-laser-module") {
    clamp(-0.01, 0.04); box(0.07, 0.018, 0.02, body, 0.004, -0.016); box(0.012, 0.02, 0.022, dark, 0.034, -0.016);
    cyl(0.0035, 0.003, glass, 0.041, -0.012); cyl(0.0035, 0.003, glass, 0.041, -0.021);
  } else if (id === "pa-combo") {
    clamp(0, 0.03); box(0.05, 0.03, 0.024, body, 0.002, -0.02); cyl(0.0095, 0.004, glass, 0.028, -0.016); cyl(0.0032, 0.004, glass, 0.028, -0.03);
    box(0.008, 0.006, 0.006, dark, -0.016, -0.036);
  } else if (id === "pa-killcounter") {
    // Contador de bajas: caja fina con una pantalla (la cifra la dibuja gun.ts)
    clamp(0, 0.03); box(0.06, 0.026, 0.012, body, 0, -0.017);
  } else {
    // Estroboscópica: cuerpo hexagonal con bisel dentado
    clamp(0, 0.028); cyl(0.012, 0.075, body, 0.004, -0.02, 0, 6); cyl(0.0145, 0.016, dark, 0.046, -0.02, 0, 12); cyl(0.0125, 0.003, glass, 0.055, -0.02);
  }
  return g;
}
