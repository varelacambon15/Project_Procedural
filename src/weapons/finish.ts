// Sistema único de materiales (encargo 21): una paleta sobria de 3-4 colores por acabado, con la familia física de
// material elegida por era (pavonado/madera barnizada en clásica, cerakote/polímero en moderna, óxido en rústica,
// anodizado en sci-fi). Desgaste, grabados y vetas comparten texturas procedurales cacheadas: no hay materiales ni
// texturas nuevas por arma. Se descartan colores y marcas de los modelos de origen (salvo cristales y luces).
import * as THREE from "three";
import type { Paint, PartRole, RarityId } from "./types";
import type { Era } from "./eras";
import { TILE, textureUniform, type TexKind } from "./textures";
import { finishQuality, stylesFor, type FinishQuality, type WeaponStyles } from "./finish-data";
import { settings } from "../game/settings";

type RGB = [number, number, number];
const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const WALNUT = hex(0x5a3e2a), DARK_WALNUT = hex(0x4a3426), BRASS = hex(0xa8844a);

/** Acabados: principal (cajón, guardamanos), mobiliario (culata, empuñadura), metal (cañón, piezas pequeñas) y acento.
 *  Los siete primeros sobrios son la paleta de cerakote/anodizado; se mantienen los ids y colores de siempre. */
export const FINISHES: Paint[] = [
  { id: "black", color: hex(0x1d1e20), secondary: hex(0x26272a), metal: hex(0x2f3134), accent: hex(0x151617) },
  { id: "olive", color: hex(0x47493c), secondary: hex(0x2b2c28), metal: hex(0x2f3134), accent: hex(0x1a1b19) },
  { id: "sand", color: hex(0x857a66), secondary: hex(0x7a705e), metal: hex(0x3a3a38), accent: hex(0x222220) },
  { id: "woodbrass", color: hex(0x25272b), secondary: hex(0x5a4031), metal: hex(0x2c2e31), accent: hex(0x2a2a2a), wood: true },
  { id: "rust", color: hex(0x4f3c31), secondary: hex(0x3a2f28), metal: hex(0x47392f), accent: hex(0x221c18) },
  { id: "gunmetal", color: hex(0x464a50), secondary: hex(0x222325), metal: hex(0x575b61), accent: hex(0x18191a) },
  { id: "twotone", color: hex(0x1e1f21), secondary: hex(0x7e7461), metal: hex(0x2f3134), accent: hex(0x151617) },
  { id: "parkerized", color: hex(0x35372f), secondary: hex(0x4a3a2e), metal: hex(0x3c3e37), accent: hex(0x1b1c19), wood: true },
  // Sci-fi (sobrios: sin colores vivos salvo la veta de las legendarias)
  { id: "graphite", color: hex(0x2c2f33), secondary: hex(0x45494f), metal: hex(0x3a3d42), accent: hex(0x1a1c1f) },
  { id: "arctic", color: hex(0x8e9296), secondary: hex(0x3a3d41), metal: hex(0x4a4e53), accent: hex(0x24262a) },
];
export const FINISH_WEIGHTS = [3, 1.6, 1.2, 1, 0.8, 1, 1, 0.8, 1.4, 1];

type Slot = keyof WeaponStyles & ("primary" | "secondary" | "metal" | "accent" | "wood" | "highlight" | "engrave");
const ROLE_SLOT: Partial<Record<PartRole | "sight", Slot>> = {
  receiver: "primary", body: "primary", frame: "primary", slide: "primary", front: "primary", pump: "primary",
  stock: "secondary", grip: "secondary", device: "accent",
  barrel: "metal", muzzle: "metal", charging: "metal", trigger: "metal",
  magazine: "metal", scope: "accent", sight: "accent",
};
export { finishQuality };
/** Calidad configurada en este momento (Medio en PC, Bajo en táctil/Android). */
export const currentFinishQuality = () => finishQuality(settings.quality);

/**
 * Textura compartida por familia y desgaste, proyectada en caja (sin UV): el canal R da el grano, el G los
 * desconchones y arañazos, el B la rugosidad. El borde gastado se calcula con la UV de cada cara (0..1 por cara),
 * así funciona también en las piezas fusionadas por `mergeStatic`. En Bajo no se instala el shader: color plano.
 */
function addTexture(m: THREE.MeshStandardMaterial, style: WeaponStyles[Slot], quality: FinishQuality, kind: TexKind, tile = TILE) {
  if (quality === "low") return;
  const u = textureUniform(kind, style.wear);
  // El metal expuesto del óxido o de la madera no debe parecer plata pulida: cada familia desgasta a su manera.
  const bareLight = style.family === "rust" ? 0.16 : style.family === "varnished" ? 0.32 : style.family === "parkerized" ? 0.5
    : style.family === "cerakote" || style.family === "anodized" || style.family === "polymer" ? 0.75 : 1;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = u; sh.uniforms.uTile = { value: tile };
    sh.uniforms.uWear = { value: style.wear }; sh.uniforms.uEdge = { value: style.edge }; sh.uniforms.uBare = { value: bareLight };
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObj;\nvarying vec3 vObjN;\nvarying vec2 vEdgeUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position; vObjN = normal; vEdgeUv = uv;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
varying vec3 vObj; varying vec3 vObjN; varying vec2 vEdgeUv;
uniform sampler2D uDetail; uniform float uTile; uniform float uWear; uniform float uEdge; uniform float uBare;
float f21Bare; float f21Edge;`)
      .replace("#include <color_fragment>", `#include <color_fragment>
{
  vec3 an = abs(vObjN);
  vec2 uvp = an.x > an.y && an.x > an.z ? vObj.zy : an.y > an.z ? vObj.xz : vObj.xy;
  vec4 det = texture2D(uDetail, uvp / uTile);
  diffuseColor.rgb *= det.r * 1.275;
  float eb = min(min(vEdgeUv.x, 1.0 - vEdgeUv.x), min(vEdgeUv.y, 1.0 - vEdgeUv.y));
  f21Edge = (1.0 - smoothstep(0.0, 0.09, eb)) * uEdge * uWear;
  f21Bare = clamp(f21Edge * 0.75 + det.g * uWear * 0.28, 0.0, 0.85);
  // Acero desnudo en bordes y arañazos: más claro, sin teñir con el color de effects del juego
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.25 + vec3(0.10, 0.10, 0.11), f21Bare * uBare);
}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
{
  vec3 ar = abs(vObjN);
  vec2 uvr = ar.x > ar.y && ar.x > ar.z ? vObj.zy : ar.y > ar.z ? vObj.xz : vObj.xy;
  vec4 dr = texture2D(uDetail, uvr / uTile);
  roughnessFactor = clamp(roughnessFactor * mix(1.18, 0.80, dr.b), 0.05, 1.0);
  roughnessFactor = mix(roughnessFactor, 0.34 + (1.0 - uBare) * 0.45, clamp(f21Edge * 0.55 + dr.g * uWear * 0.18, 0.0, 0.7));
}`)
      .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
metalnessFactor = clamp(metalnessFactor + f21Bare * 0.25, 0.0, 1.0);`);
  };
  m.customProgramCacheKey = () => `f21|${quality}|${tile === TILE ? "n" : "e"}`;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();
/** Luminancia mínima (sRGB) de cualquier color de acabado. */
export const MIN_LUM = 0.16;
function slotColor(f: Paint, slot: Slot, styles: WeaponStyles): RGB {
  if (slot === "primary") return (f.color ?? [0.18, 0.19, 0.2]) as RGB;
  if (slot === "metal") {
    // El parkerizado moderno refleja menos y muestra más difuso: se oscurece para que no parezca acero sin pintar
    const m = (f.metal ?? [0.2, 0.2, 0.22]) as RGB, k = styles.metal.family === "parkerized" ? 0.62 : 1;
    return [m[0] * k, m[1] * k, m[2] * k];
  }
  if (slot === "accent") return (f.accent ?? [0.12, 0.12, 0.13]) as RGB;
  if (slot === "highlight") return BRASS;
  if (slot === "engrave") {
    const m = f.metal ?? [0.2, 0.2, 0.22], a = f.accent ?? [0.12, 0.12, 0.13];
    return [m[0] * 0.65 + a[0] * 0.35, m[1] * 0.65 + a[1] * 0.35, m[2] * 0.65 + a[2] * 0.35];
  }
  if (slot === "wood") return styles.wood.family === "varnished" ? (f.wood && f.secondary ? f.secondary as RGB : styles.wear > 0.7 ? DARK_WALNUT : WALNUT) : (f.secondary ?? [0.2, 0.2, 0.2]) as RGB;
  return (f.secondary ?? [0.2, 0.2, 0.2]) as RGB;
}
function material(f: Paint, slot: Slot, styles: WeaponStyles, bright = 1, tex?: TexKind): THREE.MeshStandardMaterial {
  const kind = tex ?? styles[slot]?.kind ?? styles.primary.kind;
  const key = `${f.id}|${slot}|${styles.primary.family}|${styles.quality}|${styles.wear.toFixed(2)}|${kind}|${bright}`;
  let m = cache.get(key);
  if (!m) {
    const style = styles[slot] ?? styles.primary;
    const rgb = slotColor(f, slot, styles).slice() as RGB;
    const lumS = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
    if (lumS < MIN_LUM) { const k = MIN_LUM / Math.max(0.01, lumS); for (let i = 0; i < 3; i++) rgb[i] = Math.min(1, rgb[i] * k); }
    if (bright !== 1) for (let i = 0; i < 3; i++) rgb[i] = Math.min(1, rgb[i] * bright);
    m = new THREE.MeshStandardMaterial({
      name: slot === "wood" ? "Wood" : slot === "engrave" ? "Engrave" : slot,
      vertexColors: true, color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), flatShading: true,
      roughness: style.roughness, metalness: style.metalness,
    });
    m.userData.envBoost = 1.5; // armas en primera persona: reflejan algo más que el mundo
    addTexture(m, style, styles.quality, kind, slot === "engrave" ? TILE * 0.45 : TILE);
    cache.set(key, m);
  }
  return m;
}
const keep = (m: THREE.Material) => /Lens|Glass|legendvein/i.test(m.name) || (m as THREE.MeshBasicMaterial).isMeshBasicMaterial;
const isWoodSrc = (m: THREE.Material) => /Wood|Handle|Brown/i.test(m.name);
const lum = (m: THREE.Material) => { const c = (m as THREE.MeshStandardMaterial).color; return c ? 0.3 * c.r + 0.59 * c.g + 0.11 * c.b : 0.5; };

/**
 * Repinta una pieza con el estilo común del arma. Las piezas multicolor conservan su contraste interno: el material
 * más oscuro pasa a acento o metal, la madera de origen a mobiliario (o madera barnizada, solo en eras que la usan).
 */
export function applyFinish(
  obj: THREE.Object3D, role: PartRole | "sight", f: Paint, legendary = false, highlight = false,
  era?: Era, _rarity?: RarityId,
) {
  const styles = stylesFor(era, finishQuality(settings.quality));
  const wooden = styles.wood.family === "varnished" || !!f.wood;
  const slot: Slot = legendary && highlight ? "highlight" : ROLE_SLOT[role] ?? "primary";
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  const all = meshes.flatMap((m) => ([] as THREE.Material[]).concat(m.material)).filter((m) => !keep(m));
  const lums = [...new Set(all.map(lum))].sort((a, b) => a - b);
  const darkest = lums.length > 1 ? lums[0] : -1;
  const pick = (m: THREE.Material): THREE.Material => {
    if (keep(m)) return m;
    let s: Slot = slot;
    if (/procmetal/.test(m.name)) s = "metal";
    else if (/procpad/.test(m.name)) s = "accent";
    else if (/proctape/.test(m.name)) s = "secondary";
    else if (/procgrip/.test(m.name)) return material(f, "secondary", styles, 1, "stipple");
    else if (/procsteel/.test(m.name)) return material(f, "metal", styles, 2.2);
    else if (/proccheck/.test(m.name)) return material(f, wooden ? "wood" : "secondary", styles, 1, "checker");
    else if (/procwood/.test(m.name)) s = wooden ? "wood" : "secondary";
    else if (/procengrave/.test(m.name)) return material(f, "engrave", styles);
    else if (/procrust/.test(m.name)) return material(f, "metal", styles, 1, "rust");
    else if (/procdisplay|simmark/.test(m.name)) s = "accent";
    // Colores del modelo de origen se apagan: una legendaria solo tiene latón + su veta, nunca arcoíris
    else if (/Red|Blue|Cerulean|Green|Orange|Emiss/i.test(m.name)) s = "accent";
    else if (isWoodSrc(m) && (s === "primary" || s === "secondary")) s = wooden ? "wood" : "secondary";
    else if (s === "secondary" && wooden) s = "wood";
    else if (s === "primary" && lums.length > 1 && lum(m) === darkest) s = "metal";
    return material(f, s, styles);
  };
  for (const m of meshes) {
    m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material);
    const g = m.geometry;
    if (!g.attributes.color) g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
    // El shader de bordes necesita UV aunque la malla original no las tuviera; 0.5 = "sin borde"
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(0.5), 2));
  }
}
