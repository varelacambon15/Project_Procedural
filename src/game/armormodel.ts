// Modelos provisionales de las armaduras (por código, al estilo de los soldados de la simulación) hasta que lleguen
// los diseños del usuario: casco con visor, peto con hombreras y grebas con rodilleras; la variante cambia el volumen
// (ligera, estándar, pesada) y la rareza el color del visor y las franjas. También las fotos para tienda e inventario.
import * as THREE from "three";
import { ARMOR_RARITY, type ArmorRarity, type ArmorSlot, type ArmorVariant } from "./armor";

const plate = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.55 });
const glow = (c: string) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: new THREE.Color(c), emissiveIntensity: 1.6 });

export function armorObject(slot: ArmorSlot, variant: ArmorVariant, rarity: ArmorRarity): THREE.Group {
  const g = new THREE.Group(), col = ARMOR_RARITY[rarity].color, k = variant === "light" ? 0.88 : variant === "heavy" ? 1.15 : 1;
  const base = plate(variant === "heavy" ? 0x3a414b : variant === "light" ? 0x5a6470 : 0x48505a), dark = plate(0x23272d), lit = glow(col);
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (slot === "head") {
    add(new THREE.SphereGeometry(0.16 * k, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), base, 0, 0, 0).scale.set(1, 1, 1.1);
    add(new THREE.CylinderGeometry(0.168 * k, 0.168 * k, 0.06, 20, 1, true, -0.85, 1.7), lit, 0, -0.01, 0).scale.set(1.04, 1, 1.1);
    add(new THREE.BoxGeometry(0.2 * k, 0.07, 0.09), dark, 0, -0.08, 0.1);
    if (variant === "heavy") add(new THREE.BoxGeometry(0.06, 0.08, 0.26), base, 0, 0.15, 0);
    if (variant === "light") add(new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), dark, 0.11, 0.12, -0.06);
  } else if (slot === "torso") {
    add(new THREE.BoxGeometry(0.46 * k, 0.4, 0.26 * k), base, 0, 0, 0);
    add(new THREE.BoxGeometry(0.44 * k, 0.32, 0.06), dark, 0, 0, 0.15 * k);
    for (const x of [-1, 1]) add(new THREE.BoxGeometry(0.2 * k, 0.09, 0.26), base, x * 0.31 * k, 0.2, 0).rotation.z = -x * 0.25;
    for (const x of [-0.12, 0, 0.12]) add(new THREE.BoxGeometry(0.1, 0.11, 0.07), plate(0x2c3128), x * k, -0.16, 0.17 * k);
    add(new THREE.BoxGeometry(0.3 * k, 0.03, 0.02), lit, 0, 0.12, 0.185 * k);
  } else {
    for (const x of [-1, 1]) {
      add(new THREE.BoxGeometry(0.15 * k, 0.42, 0.16 * k), base, x * 0.11, 0, 0);
      add(new THREE.BoxGeometry(0.14 * k, 0.12, 0.08), dark, x * 0.11, -0.12, 0.1);
      add(new THREE.BoxGeometry(0.02, 0.3, 0.02), lit, x * 0.11 + x * 0.06 * k, 0.02, 0.08);
    }
    add(new THREE.BoxGeometry(0.4 * k, 0.08, 0.22), dark, 0, 0.24, 0);
  }
  return g;
}

/** Foto de una pieza (tienda, inventario, suelo): se dibuja una vez por ranura, variante y rareza y se guarda. */
const thumbs = new Map<string, string>();
let rr: THREE.WebGLRenderer | null = null;
export function armorThumb(slot: ArmorSlot, variant: ArmorVariant, rarity: ArmorRarity): string {
  const key = `${slot}:${variant}:${rarity}`;
  const done = thumbs.get(key); if (done) return done;
  rr ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  rr.setSize(320, 140); rr.setClearColor(0x000000, 0);
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); sc.add(d);
  const o = armorObject(slot, variant, rarity); o.rotation.set(0.2, -0.6, 0); sc.add(o);
  const cam = new THREE.PerspectiveCamera(24, 320 / 140, 0.1, 10); cam.position.set(0, 0.03, slot === "torso" ? 1.45 : slot === "head" ? 1.0 : 1.5); cam.lookAt(0, 0, 0);
  rr.render(sc, cam); const url = rr.domElement.toDataURL("image/png"); thumbs.set(key, url); return url;
}
/** Pone la foto en sus <img data-armorthumb="ranura:variante:rareza">. */
export function fillArmorThumbs(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img[data-armorthumb]").forEach((img) => { const [s, v, r] = img.dataset.armorthumb!.split(":") as [ArmorSlot, ArmorVariant, ArmorRarity]; try { img.src = armorThumb(s, v, r); img.classList.add("ready"); } catch { /* sin WebGL */ } });
}
