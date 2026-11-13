// Accesorios propios: dispositivos de boca y miras generados por código, a medida de cada arma.
// Así encajan siempre (diámetro de la boca, largo del raíl) y comparten el mismo estilo realista.
import * as THREE from "three";
import type { Stats } from "./types";

export interface AccessoryDef { id: string; kind: "muzzle" | "optic"; mods: Partial<Stats>; zoom?: number; quiet?: boolean; for?: string[] }

// Unos accesorios son mejora pura; otros tienen un pequeño compromiso (las miras de aumento pesan algo más).
export const ACCESSORIES: AccessoryDef[] = [
  { id: "acc:suppressor-s", kind: "muzzle", mods: { precision: 3, alcance: 3 }, quiet: true },
  { id: "acc:suppressor-l", kind: "muzzle", mods: { precision: 5, alcance: 8, manejo: -3 }, quiet: true },
  { id: "acc:compensator", kind: "muzzle", mods: { manejo: 6, precision: 2 } },
  { id: "acc:brake", kind: "muzzle", mods: { manejo: 8, precision: 1 } },
  { id: "acc:flashhider", kind: "muzzle", mods: { precision: 3, manejo: 2 } },
  { id: "acc:reddot", kind: "optic", mods: { precision: 4 }, zoom: 1.25 },
  { id: "acc:holo", kind: "optic", mods: { precision: 5, alcance: 3 }, zoom: 1.35, for: ["rifle", "bullpup", "lmg", "smg", "shotgun"] },
  { id: "acc:acog", kind: "optic", mods: { precision: 8, alcance: 12, manejo: -3 }, zoom: 3, for: ["rifle", "bullpup", "lmg", "smg"] },
  { id: "acc:scope6", kind: "optic", mods: { precision: 12, alcance: 20, manejo: -6 }, zoom: 5, for: ["rifle", "bullpup", "sniper"] },
];
/** Piezas del kit modular que hacen de accesorio: usan las estadísticas (y el sonido, el retículo) del equivalente. */
export const KIT_ALIAS: Record<string, string> = {
  "k-muzzledevice-556-01": "acc:suppressor-l", "k-muzzledevice-556-02": "acc:suppressor-s", "k-muzzledevice-556-03": "acc:brake",
  "k-muzzledevice-9-01": "acc:suppressor-l", "k-muzzledevice-9-02": "acc:suppressor-s", "k-muzzledevice-9-03": "acc:compensator",
  "k-muzzledevice-12ga-01": "acc:suppressor-l", "k-muzzledevice-12ga-02": "acc:brake", "k-muzzledevice-12ga-03": "acc:compensator",
  "k-optic-rear-rail-01": "acc:holo", "k-optic-rear-rail-02": "acc:reddot",
  "k-att-reddot-east": "acc:reddot", "k-att-reddot-west": "acc:reddot", "k-att-reflex-east": "acc:reddot", "k-att-reflex-west": "acc:reddot",
  "k-att-holographic-east": "acc:holo", "k-att-holographic-west": "acc:holo", "k-att-magnified-east": "acc:acog", "k-att-magnified-west": "acc:acog",
  "k-att-scope-east": "acc:scope6", "k-att-scope-west": "acc:scope6", "k-att-suppressor-east": "acc:suppressor-l", "k-att-suppressor-west": "acc:suppressor-s",
};
export const accessory = (id: string | null) => (id ? ACCESSORIES.find((a) => a.id === (KIT_ALIAS[id] ?? id)) ?? null : null);
export const isAccessory = (id: string | null) => !!id && id.startsWith("acc:");

const black = () => new THREE.MeshStandardMaterial({ name: "Steel", color: 0x1c1d1f, metalness: 0.75, roughness: 0.42 });
const polymer = () => new THREE.MeshStandardMaterial({ name: "Polymer", color: 0x232426, metalness: 0.15, roughness: 0.65 });
const glass = () => new THREE.MeshStandardMaterial({ name: "Glass", color: 0x2a4f6e, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.55 });
const redDot = () => new THREE.MeshBasicMaterial({ color: 0xff3020 });

/** Cilindro tumbado a lo largo de +X, empezando en x=0. */
function tube(r: number, len: number, mat: THREE.Material, x0 = 0, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.z = -Math.PI / 2; m.position.x = x0 + len / 2; return m;
}

/**
 * Dispositivo de boca. Origen en la parte trasera, eje +X hacia delante.
 * `d` = diámetro de la boca del cañón; `L` = longitud del arma (para proporciones).
 */
export function buildMuzzle(id: string, d: number, L: number): { group: THREE.Group; length: number } {
  const g = new THREE.Group();
  const r = Math.max(0.006, d / 2);
  const steel = black();
  let len = 0;
  switch (id) {
    case "acc:suppressor-s":
    case "acc:suppressor-l": {
      const R = Math.max(r * 1.9, 0.014);
      len = Math.max(0.09, L * (id === "acc:suppressor-s" ? 0.14 : 0.24));
      g.add(tube(r * 1.15, len * 0.08, steel, 0));
      g.add(tube(R * 0.92, len * 0.06, steel, len * 0.06));
      g.add(tube(R, len * 0.82, steel, len * 0.1, 20));
      g.add(tube(R * 0.85, len * 0.08, steel, len * 0.92, 20));
      for (let i = 1; i < 4; i++) g.add(tube(R * 1.03, len * 0.012, steel, len * (0.1 + i * 0.2), 20));
      break;
    }
    case "acc:weight": { // contrapeso liso (revólveres clásicos)
      len = Math.max(0.03, L * 0.1);
      g.add(tube(r * 1.45, len, steel, 0)); g.add(tube(r * 1.55, len * 0.12, steel, len * 0.88));
      break;
    }
    case "acc:compensator": {
      len = Math.max(0.035, L * 0.06);
      g.add(tube(r * 1.5, len, steel, 0));
      for (let i = 0; i < 3; i++) { const slot = new THREE.Mesh(new THREE.BoxGeometry(len * 0.12, r * 0.8, r * 3.2), polymer()); slot.position.set(len * (0.3 + i * 0.22), r * 1.2, 0); g.add(slot); }
      break;
    }
    case "acc:brake": {
      len = Math.max(0.045, L * 0.07);
      g.add(tube(r * 1.4, len * 0.3, steel, 0));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(len * 0.7, r * 2.2, r * 3.6), steel)).position.set(len * 0.62, 0, 0);
      for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(len * 0.1, r * 2.3, r * 3.7), polymer()); s.position.set(len * (0.48 + i * 0.25), 0, 0); g.add(s); }
      break;
    }
    default: { // flash hider
      len = Math.max(0.035, L * 0.055);
      g.add(tube(r * 1.25, len * 0.35, steel, 0));
      // Jaula (tipo "birdcage"): cuerpo cerrado con ranuras largas y aro en la boca (las púas sueltas se leían como un tenedor)
      g.add(tube(r * 1.15, len * 0.62, steel, len * 0.35));
      g.add(tube(r * 1.22, len * 0.06, steel, len * 0.94));
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + Math.PI / 2; const sl = new THREE.Mesh(new THREE.BoxGeometry(len * 0.4, r * 0.32, r * 0.32), polymer()); sl.position.set(len * 0.64, Math.sin(a) * r * 1.1, Math.cos(a) * r * 1.1); g.add(sl); }
    }
  }
  return { group: g, length: len };
}

/** Punto de mira delantero de fusil (abrazadera al cañón, poste y orejas de protección). Origen en el eje del cañón. */
export function buildFrontSight(): THREE.Group {
  const g = new THREE.Group(); const steel = black();
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.02), steel); clamp.position.y = 0.002; g.add(clamp);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.022, 0.012), steel); tower.position.y = 0.023; g.add(tower);
  for (const z of [-1, 1]) { const ear = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.016, 0.003), steel); ear.position.set(0, 0.041, z * 0.006); g.add(ear); }
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.003), steel); post.position.y = 0.039; g.add(post);
  return g;
}

/** Mira. Origen en la base (centro inferior), eje +X hacia delante. `rail` = largo disponible del raíl. */
export function buildOptic(id: string, rail: number, L: number): { group: THREE.Group; sightHeight: number } {
  const g = new THREE.Group();
  const steel = black(), poly = polymer();
  const base = (w: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, 0.022), steel); b.position.y = 0.004; g.add(b); };
  let h = 0.03;
  if (id === "acc:reddot") {
    base(0.05);
    // Cuerpo bajo y capuchón hueco: se mira a través de él
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.016, 0.026), poly); body.position.set(0, 0.016, 0); g.add(body);
    const hoodGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.03, 20, 1, true);
    const hoodMat = steel.clone(); hoodMat.side = THREE.DoubleSide;
    const hood = new THREE.Mesh(hoodGeo, hoodMat); hood.rotation.z = -Math.PI / 2; hood.position.set(0, 0.04, 0); g.add(hood);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.013, 20), glass()); lens.rotation.y = Math.PI / 2; lens.position.set(0.016, 0.04, 0); g.add(lens);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 6, 4), redDot()); dot.position.set(0.01, 0.04, 0); g.add(dot);
    h = 0.04;
  } else if (id === "acc:holo") {
    // Holográfica tipo caja: cuerpo macizo delante (batería), capucha con paredes gruesas detrás y cristal tintado
    base(0.08);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.026, 0.032), poly); body.position.set(0.016, 0.021, 0); g.add(body);
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.012), steel); btn.position.set(0.02, 0.036, 0); g.add(btn);
    for (const z of [-1, 1]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.03, 0.006), poly); wall.position.set(-0.018, 0.047, z * 0.016); g.add(wall); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.007, 0.038), poly); roof.position.set(-0.018, 0.064, 0); g.add(roof);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.032), poly); floor.position.set(-0.018, 0.031, 0); g.add(floor);
    for (const x of [-0.034, -0.002]) { const win = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.026), glass()); win.rotation.y = Math.PI / 2; win.position.set(x, 0.047, 0); g.add(win); }
    const dot = new THREE.Mesh(new THREE.RingGeometry(0.0025, 0.0035, 16), redDot()); dot.rotation.y = Math.PI / 2; dot.position.set(-0.003, 0.047, 0); g.add(dot);
    h = 0.047;
  } else {
    const long = id === "acc:scope6";
    const len = Math.min(Math.max(0.14, L * (long ? 0.36 : 0.18)), rail * 1.6 + 0.08);
    const R = long ? 0.017 : 0.016;
    for (const x of [-len * 0.25, len * 0.22]) { const ring = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.026), steel); ring.position.set(x, 0.015, 0); g.add(ring); }
    const main = tube(R, len * 0.62, steel, -len * 0.31, 20); main.position.y = 0.03 + R; g.add(main);
    const obj = tube(R * (long ? 1.55 : 1.3), len * 0.24, steel, len * 0.26, 24); obj.position.y = 0.03 + R; g.add(obj);
    const eye = tube(R * 1.25, len * 0.16, steel, -len * 0.48, 24); eye.position.y = 0.03 + R; g.add(eye);
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, R * 1.1, 12), steel); turret.position.set(0, 0.03 + R * 2, 0); g.add(turret);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(R * (long ? 1.45 : 1.2), 24), glass()); lens.rotation.y = Math.PI / 2; lens.position.set(len * 0.5 + 0.001, 0.03 + R, 0); g.add(lens);
    h = 0.03 + R;
  }
  return { group: g, sightHeight: h };
}
