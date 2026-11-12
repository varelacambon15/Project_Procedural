// Sistema único de materiales: todas las armas se repintan por rol con una paleta de 3-4 colores, sacada de 8 acabados
// realistas y sobrios. Se descartan los colores, texturas y marcas de los modelos de origen (salvo cristales y luces).
import * as THREE from "three";
import type { Paint, PartRole } from "./types";
import { TILE, textureUniform, type TexKind } from "./textures";

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
  // Sci-fi (sobrios: sin colores vivos salvo el detalle de las legendarias)
  { id: "graphite", color: hex(0x2c2f33), secondary: hex(0x45494f), metal: hex(0x3a3d42), accent: hex(0x1a1c1f) },
  { id: "arctic", color: hex(0x8e9296), secondary: hex(0x3a3d41), metal: hex(0x4a4e53), accent: hex(0x24262a) },
];
export const FINISH_WEIGHTS = [3, 1.6, 1.2, 1, 0.8, 1, 1, 0.8, 1.4, 1];

/** Clase de material según el rol de la pieza. */
type Slot = "primary" | "secondary" | "metal" | "accent" | "wood" | "highlight";
const ROLE_SLOT: Partial<Record<PartRole | "sight", Slot>> = {
  receiver: "primary", body: "primary", frame: "primary", slide: "primary", front: "primary", pump: "primary",
  stock: "secondary", grip: "secondary", device: "accent",
  barrel: "metal", muzzle: "metal", charging: "metal", trigger: "metal",
  magazine: "metal", scope: "accent", sight: "accent",
};
// Metal satinado, polímero mate, madera con veta suave
const PROPS: Record<Slot, { roughness: number; metalness: number }> = {
  primary: { roughness: 0.46, metalness: 0.55 }, secondary: { roughness: 0.82, metalness: 0.03 },
  metal: { roughness: 0.3, metalness: 0.85 }, accent: { roughness: 0.62, metalness: 0.25 }, wood: { roughness: 0.62, metalness: 0 },
  highlight: { roughness: 0.4, metalness: 0.6 },
};
/** Textura por código de cada clase de material (la madera lleva veta; el resto, metal o polímero). */
const TEX: Record<Slot, TexKind> = { primary: "metal", secondary: "polymer", metal: "metal", accent: "polymer", wood: "wood", highlight: "metal" };
/**
 * Textura pequeña pixelada proyectada en caja (sin UV): para cada cara se usa el plano del eje dominante de su normal,
 * en el espacio del objeto, con el mismo tamaño de píxel (TILE) en todas las piezas.
 */
function addTexture(m: THREE.MeshStandardMaterial, kind: TexKind, wear: number) {
  const u = textureUniform(kind, wear);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = u; sh.uniforms.uTile = { value: TILE };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vObjN = normal;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nuniform sampler2D uDetail;\nuniform float uTile;")
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec3 an = abs(vObjN);
  vec2 uv = an.x > an.y && an.x > an.z ? vObj.zy : an.y > an.z ? vObj.xz : vObj.xy;
  float k = texture2D(uDetail, uv / uTile).r * 1.275;
  diffuseColor.rgb *= k;
}`);
  };
  m.customProgramCacheKey = () => "tex";
}
const cache = new Map<string, THREE.MeshStandardMaterial>();
/** Luminancia mínima (sRGB) de cualquier color de acabado [propuesta, ajustable]. */
export const MIN_LUM = 0.16;
function material(f: Paint, slot: Slot): THREE.MeshStandardMaterial {
  const key = `${f.id}|${slot}`;
  let m = cache.get(key);
  if (!m) {
    const c = slot === "primary" ? f.color : slot === "secondary" ? f.secondary : slot === "metal" ? f.metal : slot === "accent" ? f.accent : slot === "highlight" ? hex(0xb8692a) : f.secondary;
    // Brillo mínimo: ninguna superficie baja de ~0,16 de luminancia (en sRGB), para que las armas oscuras no se pierdan
    const rgb = (c ?? [0.15, 0.15, 0.15]).slice() as RGB;
    const lumS = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    if (lumS < MIN_LUM) { const k = MIN_LUM / Math.max(0.01, lumS); for (let i = 0; i < 3; i++) rgb[i] = Math.min(1, rgb[i] * k); }
    m = new THREE.MeshStandardMaterial({ name: slot === "wood" ? "Wood" : slot, vertexColors: true, color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), flatShading: true, ...PROPS[slot] });
    // Desgaste: más en los acabados oxidados (armas rústicas)
    addTexture(m, f.id === "rust" && slot !== "wood" ? "rust" : TEX[slot], f.id === "rust" ? 0.8 : f.id === "parkerized" ? 0.4 : 0.2);
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
    // Piezas de metal hechas por código (tubos, esqueletos, abrazaderas) y cantoneras
    if (/procmetal/.test(m.name)) return material(f, "metal");
    if (/procpad/.test(m.name)) return material(f, "accent");
    if (/proctape/.test(m.name)) return material(f, "secondary");
    // Pantallas y marca de simulación: apagadas (acento) salvo en legendarias, que llevan el detalle de color
    if (/procdisplay|simmark/.test(m.name)) return material(f, _legendary ? "highlight" : "accent");
    // Tiras de color de origen (rojo, azul…): en el tono sobrio del arma; solo las legendarias las llevan en color
    if (/Red|Blue|Cerulean|Green|Orange|Emiss/i.test(m.name)) return material(f, _legendary ? "highlight" : "accent");
    if (isWoodSrc(m) && (slot === "primary" || slot === "secondary")) s = f.wood ? "wood" : "secondary";
    else if (slot === "secondary" && f.wood) s = "wood";
    else if ((slot === "primary") && lums.length > 1 && lum(m) === darkest) s = "metal";
    return material(f, s);
  };
  for (const m of meshes) {
    m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material);
    // Oclusión horneada en los vértices; las piezas hechas por código (sin hornear) van sin oscurecer
    const g = m.geometry;
    if (!g.attributes.color) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  }
}
