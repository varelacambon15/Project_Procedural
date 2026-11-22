// Texturas de la estética de simulación (referencias de Coded Arms): baldosas hexagonales con juntas luminosas y
// paneles holográficos con datos. Todo pixelado y dibujado por código; el brillo va en un mapa emisivo aparte.
import * as THREE from "three";

const tex = (c: HTMLCanvasElement, rep: [number, number], srgb = true) => {
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
};
/** Hexágonos de punta arriba: ancho de baldosa W = √3·R y alto 3R (dos filas desplazadas), así se repite sin cortes. */
const HW = 64, HR = HW / Math.sqrt(3), HH = Math.round(3 * HR);
const roughCache = new Map<string, THREE.CanvasTexture>();
/**
 * Variación de rugosidad de la baldosa hexagonal (misma parrilla que el color): junta rugosa, baldosa pulida.
 * Textura pequeña de lienzo, cacheada y compartida por repetición (arena y mazmorras usan la misma).
 */
function hexRough(rep: [number, number]) {
  const key = rep.join(",");
  let t = roughCache.get(key);
  if (!t) {
    const c = document.createElement("canvas"); c.width = HW; c.height = HH;
    const g = c.getContext("2d")!;
    g.fillStyle = "#b4b4b4"; g.fillRect(0, 0, HW, HH); // baldosa: algo pulida
    for (let i = 0; i < 170; i++) { const v = 168 + Math.floor(Math.random() * 34); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(Math.random() * HW), Math.floor(Math.random() * HH), 1, 1); }
    g.strokeStyle = "#f2f2f2"; g.lineWidth = 3; hexGrid(g); // junta: más rugosa
    t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapNearestFilter;
    roughCache.set(key, t);
  }
  return t;
}
function hexGrid(g: CanvasRenderingContext2D) {
  for (let row = -1; row <= 3; row++) for (let col = -1; col <= 2; col++) {
    const cx = col * HW + (row % 2 ? HW / 2 : 0), cy = row * 1.5 * HR;
    g.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 2 + (k * Math.PI) / 3, x = cx + Math.cos(a) * HR, y = cy + Math.sin(a) * HR; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
    g.closePath(); g.stroke();
  }
}
/** Suelo de baldosas hexagonales: mapa de color (con algo de ruido), mapa emisivo con las juntas y mapa de rugosidad (baldosa pulida, junta rugosa). */
export function hexFloor(base: string, joint: string, rep: [number, number]) {
  const c = document.createElement("canvas"); c.width = HW; c.height = HH;
  const g = c.getContext("2d")!; g.fillStyle = base; g.fillRect(0, 0, HW, HH);
  for (let i = 0; i < 260; i++) { const v = Math.random() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.07})`; g.fillRect(Math.floor(Math.random() * HW), Math.floor(Math.random() * HH), 1, 1); }
  g.strokeStyle = joint; g.lineWidth = 3; hexGrid(g);
  const e = document.createElement("canvas"); e.width = HW; e.height = HH; const ge = e.getContext("2d")!;
  ge.fillStyle = "#000"; ge.fillRect(0, 0, HW, HH); ge.strokeStyle = "#fff"; ge.lineWidth = 1; hexGrid(ge);
  return { map: tex(c, rep), emissive: tex(e, rep), rough: hexRough(rep) };
}
/** Panel holográfico con columnas de números y una cabecera (se usa como mapa emisivo, sobre un plano oscuro). */
export function dataPanel(color = "#5fe0ff", seed = 1) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 96; const g = c.getContext("2d")!;
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 96); g.fillStyle = color; g.fillRect(0, 0, 128, 3); g.font = "8px monospace";
  for (let y = 12; y < 92; y += 9) for (let x = 3; x < 124; x += 15) { g.globalAlpha = 0.35 + r() * 0.65; g.fillText(String(Math.floor(r() * 9000 + 1000)), x, y); }
  g.globalAlpha = 1; g.strokeStyle = color; g.strokeRect(1, 1, 126, 94);
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
