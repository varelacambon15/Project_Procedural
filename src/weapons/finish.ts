// Sistema único de materiales: todas las armas se repintan por rol con una paleta de 3-4 colores, sacada de 8 acabados
// realistas y sobrios. Se descartan los colores, texturas y marcas de los modelos de origen (salvo cristales y luces).
import * as THREE from "three";
import type { Paint, PartRole } from "./types";

type RGB = [number, number, number];
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

/** Acabados: principal (cajón, guardamanos), mobiliario (culata, empuñadura), metal (cañón, piezas pequeñas) y acento. */
export const FINISHES: Paint[] = [
  { id: "black", color: hex(0x1d1e20), secondary: hex(0x26272a), metal: hex(0x2f3134), accent: hex(0x151617) },
  { id: "olive", color: hex(0x47493c), secondary: hex(0x2b2c28), metal: hex(0x2f3134), accent: hex(0x1a1b19) },
  { id: "sand", color: hex(0x857a66), secondary: hex(0x7a705e), metal: hex(0x3a3a38), accent: hex(0x222220) },
  { id: "woodbrass", color: hex(0x25272b), secondary: hex(0x5a4031), metal: hex(0x2c2e31), accent: hex(0x2a2a2a), wood: true },
  { id: "rust", color: hex(0x4f3c31), secondary: hex(0x3a2f28), metal: hex(0x47392f), accent: hex(0x221c18) },
  { id: "gunmetal", color: hex(0x464a50), secondary: hex(0x222325), metal: hex(0x575b61), accent: hex(0x18191a) },
  { id: "twotone", color: hex(0x1e1f21), secondary: hex(0x7e7461), metal: hex(0x2f3134), accent: hex(0x151617) },
  { id: "parkerized", color: hex(0x35372f), secondary: hex(0x4a3a2e), metal: hex(0x3c3e37), accent: hex(0x1b1c19), wood: true },
];
export const FINISH_WEIGHTS = [3, 1.6, 1.2, 1, 0.8, 1, 1, 0.8];

/** Clase de material según el rol de la pieza. */
type Slot = "primary" | "secondary" | "metal" | "accent" | "wood" | "highlight";
const ROLE_SLOT: Partial<Record<PartRole | "sight", Slot>> = {
  receiver: "primary", body: "primary", frame: "primary", slide: "primary", front: "primary", pump: "primary",
  stock: "secondary", grip: "secondary", device: "secondary",
  barrel: "metal", muzzle: "metal", charging: "metal", trigger: "metal",
  magazine: "metal", scope: "accent", sight: "accent",
};
// Metal satinado, polímero mate, madera con veta suave
const PROPS: Record<Slot, { roughness: number; metalness: number }> = {
  primary: { roughness: 0.46, metalness: 0.55 }, secondary: { roughness: 0.82, metalness: 0.03 },
  metal: { roughness: 0.3, metalness: 0.85 }, accent: { roughness: 0.62, metalness: 0.25 }, wood: { roughness: 0.62, metalness: 0 },
  highlight: { roughness: 0.4, metalness: 0.6 },
};
/** Detalle de superficie según el material (en el espacio del objeto, sin UV): veta, cepillado o graneado. */
const DETAIL: Record<Slot, number> = { primary: 1, secondary: 2, metal: 3, accent: 2, wood: 4, highlight: 3 };
function addDetail(m: THREE.MeshStandardMaterial, kind: number) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vObj;
float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  float k = 1.0;
  ${kind === 4 ? "float g = sin(vObj.y * 420.0 + vObj.z * 300.0 + vn(vObj * vec3(6.0, 90.0, 90.0)) * 5.0); k = 0.9 + 0.1 * g + 0.05 * (vn(vObj * 40.0) - 0.5);" : ""}
  ${kind === 3 ? "k = 0.94 + 0.08 * vn(vObj * vec3(8.0, 900.0, 900.0));" : ""}
  ${kind === 2 ? "k = 0.95 + 0.07 * vn(vObj * 700.0);" : ""}
  ${kind === 1 ? "k = 0.96 + 0.06 * vn(vObj * vec3(60.0, 300.0, 300.0));" : ""}
  diffuseColor.rgb *= k;
}`);
  };
  m.customProgramCacheKey = () => "detail" + kind;
}
const cache = new Map<string, THREE.MeshStandardMaterial>();
function material(f: Paint, slot: Slot): THREE.MeshStandardMaterial {
  const key = `${f.id}|${slot}`;
  let m = cache.get(key);
  if (!m) {
    const c = slot === "primary" ? f.color : slot === "secondary" ? f.secondary : slot === "metal" ? f.metal : slot === "accent" ? f.accent : slot === "highlight" ? hex(0xb8692a) : f.secondary;
    m = new THREE.MeshStandardMaterial({ name: slot === "wood" ? "Wood" : slot, color: new THREE.Color().setRGB(...(c ?? [0.15, 0.15, 0.15]), THREE.SRGBColorSpace), flatShading: true, ...PROPS[slot] });
    addDetail(m, DETAIL[slot]);
    cache.set(key, m);
  }
  return m;
}
const keep = (m: THREE.Material) => /Lens|Glass/i.test(m.name) || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial;
const isWoodSrc = (m: THREE.Material) => /Wood|Handle|Brown/i.test(m.name);
const lum = (m: THREE.Material) => { const c = (m as THREE.MeshStandardMaterial).color; return c ? 0.3 * c.r + 0.59 * c.g + 0.11 * c.b : 0.5; };

/**
 * Repinta una pieza. Las piezas enteras de varios materiales (cuerpos de una pieza) conservan su contraste interno:
 * el material más oscuro pasa a "acento" o "metal", la madera de origen a mobiliario (o madera, si el acabado la usa).
 */
export function applyFinish(obj: THREE.Object3D, role: PartRole | "sight", f: Paint, _legendary = false, highlight = false) {
  // Solo las legendarias llevan un color vivo, y solo en un detalle pequeño (`highlight`)
  const slot: Slot = highlight ? "highlight" : ROLE_SLOT[role] ?? "primary";
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const all = meshes.flatMap((m) => ([] as THREE.Material[]).concat(m.material)).filter((m) => !keep(m));
  const lums = [...new Set(all.map(lum))].sort((a, b) => a - b);
  const darkest = lums.length > 1 ? lums[0] : -1;
  const pick = (m: THREE.Material): THREE.Material => {
    if (keep(m)) return m;
    let s: Slot = slot;
    if (isWoodSrc(m) && (slot === "primary" || slot === "secondary")) s = f.wood ? "wood" : "secondary";
    else if (slot === "secondary" && f.wood) s = "wood";
    else if ((slot === "primary") && lums.length > 1 && lum(m) === darkest) s = "metal";
    return material(f, s);
  };
  for (const m of meshes) m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material);
}
