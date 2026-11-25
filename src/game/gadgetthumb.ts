// Foto 2D del equipamiento (inventario, ranura de Gear): cada tipo se compone con formas sencillas, se dibuja una vez
// con luz de estudio y se guarda como imagen (como las granadas y las armas), así el motor no carga con nada en pantalla.
import * as THREE from "three";
import { GADGET_KINDS, type GadgetKind, type GadgetRarity } from "./gadgets";

const M = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4, ...o });
const glow = (c: number) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2 });
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, s = 20) => new THREE.CylinderGeometry(r, r, h, s);
const cone = (r: number, h: number) => new THREE.ConeGeometry(r, h, 18);
const sph = (r: number) => new THREE.SphereGeometry(r, 18, 14);
const rot = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T => { o.rotation.set(x, y, z); return o; };

/** Figura de cada tipo, de ~1 de lado, con el color del tipo. */
function figure(kind: GadgetKind): THREE.Object3D {
  const c = GADGET_KINDS[kind].color, dark = 0x2a2f38, mid = 0x5a626e, g = new THREE.Group();
  const add = (...o: THREE.Object3D[]) => o.forEach((x) => g.add(x));
  const ring = (r: number, col = c, rx = 0) => rot(mesh(new THREE.TorusGeometry(r, 0.025, 8, 40), glow(col)), Math.PI / 2 + rx);
  switch (kind) {
    case "turret": add(mesh(cyl(0.34, 0.12), M(mid), 0, -0.4), mesh(cyl(0.08, 0.5), M(dark), 0, -0.14), mesh(sph(0.26), M(c), 0, 0.12), rot(mesh(cyl(0.05, 0.7), M(dark), 0.3, 0.12), 0, 0, Math.PI / 2)); break;
    case "shield": add(mesh(box(0.08, 0.95, 0.75), M(0x3a5a8a, { transparent: true, opacity: 0.8 })), mesh(box(0.1, 0.1, 0.8), M(dark), 0, 0.5), mesh(box(0.1, 0.1, 0.8), M(dark), 0, -0.5), mesh(box(0.12, 0.9, 0.08), glow(c), 0, 0, 0.4)); g.rotation.y = -0.8; break;
    case "dome": add(mesh(new THREE.SphereGeometry(0.5, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), M(c, { transparent: true, opacity: 0.5, metalness: 0.1 }), 0, -0.1), mesh(cyl(0.52, 0.06), M(dark), 0, -0.13), ring(0.5)); break;
    case "orb": add(mesh(sph(0.34), glow(c)), ring(0.5, 0xffffff, 0.5), ring(0.44, c, -0.7)); break;
    case "hook": add(mesh(cyl(0.12, 0.5), M(mid), 0, -0.25), rot(mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20, Math.PI * 1.3), M(c), 0, 0.2), 0, 0, Math.PI * 0.85), rot(mesh(cone(0.09, 0.22), M(c), -0.28, 0.02), 0, 0, 0.6)); break;
    case "mine": add(mesh(cyl(0.45, 0.16, 28), M(0x3a3f48)), mesh(cyl(0.2, 0.1), M(mid), 0, 0.1), mesh(sph(0.07), glow(0xff3030), 0, 0.2)); g.rotation.x = 0.5; break;
    case "gravity": add(mesh(sph(0.16), glow(c)), ring(0.3, c, 0.3), ring(0.45, c, -0.5), ring(0.58, mid, 1)); break;
    case "slowfield": add(mesh(cyl(0.12, 0.3), M(mid), 0, -0.3), mesh(sph(0.5), M(c, { transparent: true, opacity: 0.3, metalness: 0 })), ring(0.5, c, 0.2)); break;
    case "jump": add(mesh(cyl(0.5, 0.14, 28), M(mid), 0, -0.25), mesh(cyl(0.38, 0.06, 28), glow(c), 0, -0.16), mesh(cone(0.18, 0.3), glow(c), 0, 0.12), mesh(cone(0.14, 0.24), glow(c), 0, 0.4)); break;
    case "beacon": add(mesh(cyl(0.05, 0.9), M(mid), 0, -0.05), mesh(sph(0.15), glow(c), 0, 0.5), mesh(cyl(0.2, 0.1), M(dark), 0, -0.5), ring(0.28, c)); break;
    case "knife": add(mesh(box(0.8, 0.18, 0.03), M(0xcfd6de, { metalness: 0.9, roughness: 0.2 }), 0.2, 0), mesh(box(0.34, 0.14, 0.12), M(0x2a2a2e), -0.4, 0), mesh(box(0.05, 0.28, 0.1), M(c), -0.22, 0)); g.rotation.z = 0.5; break;
    case "chain": for (let k = 0; k < 3; k++) add(rot(mesh(cyl(0.13, 0.34, 16), M(k === 1 ? c : 0xa84a20), -0.36 + k * 0.36, 0), 0, 0, Math.PI / 2), mesh(sph(0.05), glow(0xffd060), -0.36 + k * 0.36, 0.17)); break;
    case "harpoon": add(rot(mesh(cyl(0.03, 1.1), M(mid)), 0, 0, Math.PI / 2), rot(mesh(cone(0.12, 0.34), glow(c), 0.6, 0), 0, 0, -Math.PI / 2), mesh(box(0.1, 0.34, 0.03), M(c), -0.5, 0)); g.rotation.z = 0.4; break;
    case "decoy": add(mesh(cyl(0.3, 0.08), M(dark), 0, -0.4), mesh(new THREE.CapsuleGeometry(0.18, 0.5, 6, 12), M(c, { transparent: true, opacity: 0.6, metalness: 0 }), 0, 0.02), mesh(sph(0.14), M(c, { transparent: true, opacity: 0.65 }), 0, 0.42)); break;
    case "glitch": add(mesh(sph(0.34), M(dark)), mesh(box(0.9, 0.08, 0.08), glow(c), 0, 0.12, 0.34), mesh(box(0.6, 0.07, 0.08), glow(0xff40c0), 0.12, -0.08, 0.36), mesh(box(0.4, 0.07, 0.08), glow(c), -0.15, -0.26, 0.3)); break;
    case "ammo": add(mesh(box(0.86, 0.5, 0.5), M(0x4a5a3a)), mesh(box(0.88, 0.1, 0.52), M(c), 0, 0.12), mesh(box(0.3, 0.06, 0.52), M(0xf0f0f0), 0, -0.1)); g.rotation.set(0.35, 0.5, 0); break;
    case "inject": add(rot(mesh(cyl(0.1, 0.7), M(0xdfe8ee, { transparent: true, opacity: 0.8 })), 0, 0, 1.1), rot(mesh(cyl(0.07, 0.4), glow(c)), 0, 0, 1.1), rot(mesh(cyl(0.02, 0.4), M(0xcfd6de), -0.62, 0.31), 0, 0, 1.1), rot(mesh(cyl(0.12, 0.06), M(dark), 0.36, -0.18), 0, 0, 1.1)); break;
    case "thrust": add(mesh(cyl(0.16, 0.7), M(mid)), rot(mesh(cone(0.2, 0.3), M(dark), 0, -0.45), Math.PI), rot(mesh(cone(0.14, 0.45), glow(c), 0, -0.75), Math.PI), mesh(cyl(0.18, 0.06), M(c), 0, 0.18)); g.rotation.z = 0.5; break;
    case "teleport": add(mesh(new THREE.TorusGeometry(0.4, 0.07, 12, 32), glow(c)), mesh(new THREE.CircleGeometry(0.34, 28), M(c, { transparent: true, opacity: 0.4, side: THREE.DoubleSide })), mesh(sph(0.1), glow(0xffffff))); break;
    case "chrono": add(mesh(new THREE.TorusGeometry(0.4, 0.06, 12, 32), M(mid)), mesh(box(0.04, 0.3, 0.04), glow(c), 0, 0.12), mesh(box(0.22, 0.04, 0.04), glow(c), 0.1, 0), rot(mesh(cyl(0.44, 0.04, 32), M(c, { transparent: true, opacity: 0.25, metalness: 0 })), Math.PI / 2)); break;
  }
  return g;
}

const cache = new Map<string, Promise<string>>();
let rr: THREE.WebGLRenderer | null = null;
/** Foto del tipo (PNG con fondo transparente), dibujada una sola vez. La rareza solo se ve en el borde del botón. */
export function gadgetThumb(kind: GadgetKind, _rarity?: GadgetRarity): Promise<string> {
  if (!cache.has(kind)) cache.set(kind, loadPhoto(kind).catch(() => null).then((url) => url ?? drawFigure(kind)));
  return cache.get(kind)!;
}

/** Foto renderizada en Blender (assets/equipo/<tipo>.png); si no está, se usa la figura procedural. */
function loadPhoto(kind: GadgetKind): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { img.decode().then(() => resolve(img.src), () => resolve(img.src)); };
    img.onerror = () => reject(new Error("sin foto"));
    img.src = `./equipo/${kind}.png`;
  });
}

function drawFigure(kind: GadgetKind): Promise<string> {
  return Promise.resolve().then(() => {
    rr ??=new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    rr.setSize(320, 160); rr.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x404858, 2.4)); const d = new THREE.DirectionalLight(0xffffff, 2.4); d.position.set(2, 3, 4); sc.add(d);
    const o = figure(kind); o.rotation.y -= 0.5; o.rotation.x += 0.15; sc.add(o);
    const cam = new THREE.PerspectiveCamera(28, 2, 0.1, 20); cam.position.set(0, 0.1, 3.3); cam.lookAt(0, 0, 0);
    rr.render(sc, cam); return rr.domElement.toDataURL("image/png");
  });
}

/** Pone la foto en cada <img data-gadgetthumb="tipo">. */
export function fillGadgetThumbs(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img[data-gadgetthumb]").forEach((img) => {
    void gadgetThumb(img.dataset.gadgetthumb as GadgetKind).then((url) => { img.src = url; img.classList.add("ready"); }).catch(() => undefined);
  });
}
