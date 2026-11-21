// Sala de simulación (campo de pruebas): sala modular oscura de paneles, líneas de distancia, luces cálidas de
// mantenimiento con parpadeo, pequeños acentos de neón, niebla, cuadros de datos en pared con tipografía de terminal
// y mensajes del sistema. El terminal de la simulación sustituye al cofre. Estética propia, solo inspirada en el
// planteamiento de una simulación militar (nada copiado de ningún juego).
// Coordenadas: la línea de tiro está en z = 0, hacia -z queda la sala de tiro; detrás (z > 0) la zona de equipo.
import { dataPanel as holoData, hexFloor } from "./simtex";
import * as THREE from "three";
import { t } from "../i18n";
import { buildNightCity } from "./nightcity";
import { mergeStatic } from "./merge";

/**
 * Calcomanía: un plano pegado a otra superficie (marcas del suelo, carteles, pantallas). Se adelanta en profundidad
 * con polygonOffset para que no parpadee contra su superficie (z-fighting) a media distancia.
 */
export function decal<T extends THREE.Mesh>(m: T): T {
  for (const mat of ([] as THREE.Material[]).concat(m.material)) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -4; }
  return m;
}


export interface Interactable { id: "chest" | "workbench" | "waves" | "storage" | "contracts" | "raid" | "survival" | "defense" | "hack" | "rack" | "radio" | "vending" | "cooler" | "board" | "coffee" | "arcade" | "furniture"; position: THREE.Vector3; radius: number; label: string; object: THREE.Object3D }
export interface RangeData { dps: number; ttk: number | null; accuracy: number | null; distance: number | null; message: string }
export interface World {
  colliders: THREE.Box3[]; interactables: Interactable[]; chestLid: THREE.Object3D; chestGlow: THREE.PointLight; wavesRoom: { z0: number; z1: number; x0: number; x1: number }; shootables: THREE.Object3D[]; lanes: number[];
  /** Animación de la sala (parpadeos) y refresco de los cuadros de datos. */
  update(dt: number, data: RangeData): void;
  /** Noche (sala a oscuras con neón) o día (luz de mantenimiento). */
  setNight(on: boolean): void;
  readonly night: boolean;
  /** Del sistema local del campo de tiro (línea de tiro en z = 0, blancos hacia -z) al mundo (sala de detrás del hall). */
  rangePt(x: number, z: number): THREE.Vector3;
  /** Centro del círculo de pruebas (súper cargada y equipamiento sin coste mientras estás dentro). */ testZone: THREE.Vector3;
  /** Llegada a la arena de supervivencia (se entra desde el ordenador de modos). */
  survivalAt: { pos: THREE.Vector3; yaw: number };
}

/** Textura pixelada (filtro "nearest"), dibujada en un lienzo pequeño. */
function pixelTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestMipmapNearestFilter;
  if (repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...repeat); }
  return tx;
}
function speckle(g: CanvasRenderingContext2D, w: number, h: number, base: string, n: number, a: number) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { const v = Math.random() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`; g.fillRect(Math.floor(Math.random() * w), Math.floor(Math.random() * h), 1, 1); }
}
const NEON_CYAN = 0x3fd0d8, NEON_AMBER = 0xe8a040, WARM = 0xffc58a;

export function buildRange(scene: THREE.Scene): World {
  const colliders: THREE.Box3[] = [];
  const shootables: THREE.Object3D[] = [];
  // (ampliado: antes 40 × 86 m; ahora 48 m de ancho, campo de tiro hasta 80 m y vestíbulo más hondo)
  // Hall (zona de inicio) z ∈ [0, BACK]; el campo de tiro va detrás (grupo `rg`, girado 180°): en su sistema local la
  // línea de tiro está en z = 0 y los blancos hacia -z, como antes; en el mundo, la línea queda en z = RF.
  const W = 48, FRONT = -82, BACK = 28, H = 7.5, RF = BACK + 5.5;
  const rg = new THREE.Group(); rg.position.set(0, 0, RF); rg.rotation.y = Math.PI; scene.add(rg);
  const rangePt = (x: number, z: number) => new THREE.Vector3(-x, 0, RF - z);
  const rgMeshes: THREE.Mesh[] = [];
  const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];

  // Materiales de panel: losas oscuras con juntas y remaches, pixeladas
  // Instalación de pruebas clara y legible: hormigón claro, paneles gris claro con franja de seguridad, techo con
  // paneles de luz. El color fuerte se reserva para lo que importa (muñecos, terminales, carteles).
  const floorTex = pixelTexture(64, 64, (g) => { speckle(g, 64, 64, "#9a9ea3", 500, 0.08); g.fillStyle = "#7d8186"; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64); g.fillStyle = "#a6aaaf"; g.fillRect(1, 1, 62, 1); }, [W / 2, (BACK - FRONT) / 2]);
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 });
  const wallTex = pixelTexture(64, 64, (g) => { speckle(g, 64, 64, "#b9bdc2", 300, 0.06); g.fillStyle = "#8e9297"; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64); g.fillStyle = "#c6cacf"; g.fillRect(1, 1, 62, 1); }, [24, 2]);
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.05 });
  // Estética de simulación (Coded Arms): rejilla luminosa fina en el suelo con nodos en los cruces y pistas de
  // circuito en las paredes. Solo brillo (emisivo): no añade luces. De noche se apaga (la ciudad tiene sus neones).
  const floorGrid = pixelTexture(64, 64, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#7fe8f0"; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64);
    g.fillStyle = "#c8fbff"; g.fillRect(0, 0, 3, 3); g.fillStyle = "#2a7a80"; g.fillRect(31, 0, 1, 64); g.fillRect(0, 31, 64, 1);
  }, [W / 2, (BACK - FRONT) / 2]);
  floor.emissive.set(0x3fd0d8); floor.emissiveMap = floorGrid; floor.emissiveIntensity = 0.32;
  const wallCircuit = pixelTexture(64, 64, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#5fd8e0";
    g.fillRect(0, 44, 64, 1); g.fillRect(10, 44, 1, 10); g.fillRect(10, 54, 22, 1); g.fillRect(32, 54, 1, 10); g.fillRect(46, 30, 1, 14); g.fillRect(46, 30, 18, 1);
    for (const [x, y] of [[10, 44], [32, 54], [46, 44], [46, 30]]) { g.fillStyle = "#c8fbff"; g.fillRect(x - 1, y - 1, 3, 3); g.fillStyle = "#5fd8e0"; }
  }, [24, 2]);
  wall.emissive.set(0x3fd0d8); wall.emissiveMap = wallCircuit; wall.emissiveIntensity = 0.28;
  const steel = new THREE.MeshStandardMaterial({ color: 0x5d636a, metalness: 0.45, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x80868c, roughness: 0.95 });
  const safety = new THREE.MeshStandardMaterial({ color: 0xe07a2a, roughness: 0.7 });
  const signMats: THREE.MeshStandardMaterial[] = [], boardMats: THREE.MeshBasicMaterial[] = [];
  const panelLight = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.1 });
  /** Cartel legible: fondo claro, texto oscuro grande y una barra de color. */
  const sign = (text: string, color: string, w: number, h: number) => {
    const c = document.createElement("canvas"); c.width = 128; c.height = Math.round(128 * h / w);
    const g = c.getContext("2d")!; g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = color; g.fillRect(0, 0, c.width, Math.max(4, c.height * 0.14));
    g.fillStyle = "#1c1f22"; g.font = `bold ${Math.round(c.height * 0.5)}px monospace`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, c.width / 2, c.height * 0.58, c.width - 8);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.magFilter = THREE.NearestFilter;
    const m = new THREE.MeshStandardMaterial({ map: tx, roughness: 0.8, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.25 }); signMats.push(m);
    return decal(new THREE.Mesh(new THREE.PlaneGeometry(w, h), m));
  };
  const neonC = new THREE.MeshStandardMaterial({ color: NEON_CYAN, emissive: NEON_CYAN, emissiveIntensity: 1.6 });
  const neonA = new THREE.MeshStandardMaterial({ color: NEON_AMBER, emissive: NEON_AMBER, emissiveIntensity: 1.4 });
  const hazard = new THREE.MeshStandardMaterial({ map: pixelTexture(16, 4, (g) => { for (let x = 0; x < 16; x++) { g.fillStyle = Math.floor(x / 2) % 2 ? "#c99a2e" : "#1c1c1c"; g.fillRect(x, 0, 1, 4); } }, [W, 1]), roughness: 0.7 });

  let into: THREE.Object3D = scene;
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, collide = true, shoot = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; into.add(m);
    if (collide) { if (into === rg) rgMeshes.push(m); else colliders.push(new THREE.Box3().setFromObject(m)); }
    if (shoot) shootables.push(m);
    return m;
  };

  // ---------- Hall (zona de inicio): sala cerrada; detrás, la puerta al campo de tiro ----------
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, BACK), floor);
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, BACK / 2); fl.receiveShadow = true; scene.add(fl); shootables.push(fl);
  // Pared izquierda con la puerta sellada (4 m, de z = 20 a 24): se abrirá con 4 piezas
  const LD0 = 20, LD1 = 24;
  box(1, H, LD0, -W / 2 - 0.5, H / 2, LD0 / 2, wall);
  box(1, H, BACK - LD1, -W / 2 - 0.5, H / 2, (BACK + LD1) / 2, wall);
  box(1, H - 3.4, LD1 - LD0, -W / 2 - 0.5, (H + 3.4) / 2, (LD0 + LD1) / 2, wall, false);
  // Pared derecha con puerta (4 m) hacia la sala de modos
  const SD0 = 16, SD1 = 20;
  box(1, H, SD0, W / 2 + 0.5, H / 2, SD0 / 2, wall);
  box(1, H, BACK - SD1, W / 2 + 0.5, H / 2, (BACK + SD1) / 2, wall);
  box(1, H - 3.4, SD1 - SD0, W / 2 + 0.5, (H + 3.4) / 2, (SD0 + SD1) / 2, wall, false);
  // Pared del fondo con puerta (4 m) hacia el campo de tiro; delante, pared cerrada
  const DOOR = 2, DOOR_H = 3.2;
  box(W / 2 + 1 - DOOR, H, 1, -(W / 2 + 1 + DOOR) / 2, H / 2, BACK + 0.5, wall);
  box(W / 2 + 1 - DOOR, H, 1, (W / 2 + 1 + DOOR) / 2, H / 2, BACK + 0.5, wall);
  box(DOOR * 2, H - DOOR_H, 1, 0, (H + DOOR_H) / 2, BACK + 0.5, wall, false); // dintel: sin colisión (el jugador choca por planta)
  box(W + 2, H, 1, 0, H / 2, -0.5, wall);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, BACK + 2), dark); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, BACK / 2); scene.add(ceil);
  const dayOnly: THREE.Object3D[] = [];
  for (let z = BACK - 4; z > 0; z -= 8) {
    box(W, 0.3, 0.3, 0, H - 0.15, z, steel, false, false);
    for (const x of [-18, -9, 0, 9, 18]) box(5, 0.06, 1.4, x, H - 0.05, z - 4, panelLight, false, false);
  }
  const cams: { head: THREE.Object3D; base: number; phase: number; rec: THREE.Mesh }[] = [];
  const clockCv = document.createElement("canvas"), clockTex = new THREE.CanvasTexture(clockCv);
  let clockMin = -1;
  const drawClock = () => {
    const d = new Date(), c = clockCv.getContext("2d")!, R = 64; clockMin = d.getMinutes();
    c.fillStyle = "#f2f2ee"; c.fillRect(0, 0, 128, 128); c.strokeStyle = "#222"; c.lineCap = "round";
    for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6; c.lineWidth = i % 3 ? 2 : 4; c.beginPath(); c.moveTo(R + Math.sin(a) * 50, R - Math.cos(a) * 50); c.lineTo(R + Math.sin(a) * 58, R - Math.cos(a) * 58); c.stroke(); }
    const hand = (a: number, l: number, w: number) => { c.lineWidth = w; c.beginPath(); c.moveTo(R, R); c.lineTo(R + Math.sin(a) * l, R - Math.cos(a) * l); c.stroke(); };
    hand(((d.getHours() % 12) + d.getMinutes() / 60) * (Math.PI / 6), 30, 5); hand(d.getMinutes() * (Math.PI / 30), 46, 3);
    clockTex.needsUpdate = true;
  };
  // ---------- Acabado arquitectónico del hall (sustituye a la franja naranja que cruzaba las puertas) ----------
  // Zócalo, friso inferior con remate metálico, pilastras con tira de luz, moldura en el techo, marcos de puerta y una
  // banda oscura en el suelo junto a las paredes. Todo se corta en los huecos de las puertas. Sin luces nuevas.
  {
    const skirt = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.2 });
    const wains = new THREE.MeshStandardMaterial({ color: 0x5d6671, roughness: 0.75, metalness: 0.1 });
    const cap = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.35, metalness: 0.7 });
    const pil = new THREE.MeshStandardMaterial({ color: 0x8f98a2, roughness: 0.55, metalness: 0.25 });
    const cornice = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.6, metalness: 0.3 });
    const strip = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.85 });
    // Tramos de una pared, sin los huecos `gaps` ([a, b] a lo largo de la pared)
    const spans = (a0: number, a1: number, gaps: [number, number][]) => { const out: [number, number][] = []; let s0 = a0; for (const [g0, g1] of [...gaps].sort((x, y) => x[0] - y[0])) { if (g0 > s0) out.push([s0, g0]); s0 = Math.max(s0, g1); } if (a1 > s0) out.push([s0, a1]); return out; };
    // Pared a lo largo de z (x fija; `n` = hacia dónde mira el interior) o a lo largo de x (z fija)
    const alongZ = (x: number, n: number, gaps: [number, number][]) => {
      for (const [z0, z1] of spans(0, BACK, gaps)) {
        const L = z1 - z0, zc = (z0 + z1) / 2;
        box(0.06, 0.16, L, x + n * 0.03, 0.08, zc, skirt, false, false);
        box(0.05, 1.1, L, x + n * 0.025, 0.55 + 0.16, zc, wains, false, false);
        box(0.09, 0.05, L, x + n * 0.045, 1.28, zc, cap, false, false);
      }
      box(0.25, 0.3, BACK, x + n * 0.125, H - 0.35, BACK / 2, cornice, false, false);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(0.9, BACK), bandMat); band.rotation.x = -Math.PI / 2; band.position.set(x + n * 0.45, 0.006, BACK / 2); band.receiveShadow = true; scene.add(band);
    };
    const alongX = (z: number, n: number, gaps: [number, number][]) => {
      for (const [x0, x1] of spans(-W / 2, W / 2, gaps)) {
        const L = x1 - x0, xc = (x0 + x1) / 2;
        box(L, 0.16, 0.06, xc, 0.08, z + n * 0.03, skirt, false, false);
        box(L, 1.1, 0.05, xc, 0.55 + 0.16, z + n * 0.025, wains, false, false);
        box(L, 0.05, 0.09, xc, 1.28, z + n * 0.045, cap, false, false);
      }
      box(W, 0.3, 0.25, 0, H - 0.35, z + n * 0.125, cornice, false, false);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.9), bandMat); band.rotation.x = -Math.PI / 2; band.position.set(0, 0.006, z + n * 0.45); band.receiveShadow = true; scene.add(band);
    };
    alongZ(-W / 2, 1, [[LD0 - 0.3, LD1 + 0.3]]); alongZ(W / 2, -1, [[SD0, SD1]]);
    alongX(0, 1, []); alongX(BACK, -1, [[-DOOR, DOOR]]);
    // Pilastras con una tira de luz vertical (huecos elegidos para no tapar lo que va colgado en las paredes)
    const pilaster = (x: number, z: number, alongWallX: boolean, n: number) => {
      const w = 0.55, d = 0.32;
      if (alongWallX) { box(w, H - 0.5, d, x, (H - 0.5) / 2, z + n * d / 2, pil, false, false); box(0.05, H - 1.6, 0.02, x, 0.9 + (H - 1.6) / 2, z + n * (d + 0.01), strip, false, false); }
      else { box(d, H - 0.5, w, x + n * d / 2, (H - 0.5) / 2, z, pil, false, false); box(0.02, H - 1.6, 0.05, x + n * (d + 0.01), 0.9 + (H - 1.6) / 2, z, strip, false, false); }
    };
    for (const z of [2.6, 12.0, 26.2]) pilaster(-W / 2, z, false, 1);
    for (const z of [6.0, 13.0, 26.2]) pilaster(W / 2, z, false, -1);
    for (const x of [-16, -7, 7, 16]) pilaster(x, BACK, true, -1);
    for (const x of [-19.5, -4, 4, 19.5]) pilaster(x, 0, true, 1);
    // Marcos de las puertas: jambas y dintel gruesos con una franja luminosa
    const frame = (cx: number, cz: number, width: number, alongX: boolean, n: number) => {
      const jw = 0.35, jd = 0.45, hh = DOOR_H;
      for (const s of [-1, 1]) {
        if (alongX) box(jw, hh + 0.35, jd, cx + s * (width / 2 + jw / 2), (hh + 0.35) / 2, cz + n * 0.05, pil, false, false);
        else box(jd, hh + 0.35, jw, cx + n * 0.05, (hh + 0.35) / 2, cz + s * (width / 2 + jw / 2), pil, false, false);
      }
      if (alongX) { box(width + jw * 2, 0.35, jd, cx, hh + 0.175, cz + n * 0.05, pil, false, false); box(width, 0.04, 0.02, cx, hh + 0.02, cz + n * 0.28, strip, false, false); }
      else { box(jd, 0.35, width + jw * 2, cx + n * 0.05, hh + 0.175, cz, pil, false, false); box(0.02, 0.04, width, cx + n * 0.28, hh + 0.02, cz, strip, false, false); }
    };
    frame(0, BACK, DOOR * 2, true, -1);
    frame(W / 2, (SD0 + SD1) / 2, SD1 - SD0, false, -1);

    // ---------- Techo: casetones (vigas longitudinales que cruzan las transversales), conductos y bandejas de cables ----------
    const duct = new THREE.MeshStandardMaterial({ color: 0xa8b0b8, roughness: 0.45, metalness: 0.6 });
    for (const x of [-16, -8, 8, 16]) box(0.25, 0.32, BACK, x, H - 0.16, BACK / 2, steel, false, false);
    for (const x of [-20.5, 20.5]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, BACK - 0.6, 18), duct); c.rotation.x = Math.PI / 2; c.position.set(x, H - 0.75, BACK / 2); scene.add(c);
      for (let z = 2; z < BACK; z += 4) { box(0.05, 0.4, 0.05, x, H - 0.2, z, steel, false, false); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.03, 6, 18), steel); ring.position.set(x, H - 0.75, z); scene.add(ring); }
    }
    { const tray = box(0.5, 0.05, BACK - 1, 12, H - 0.55, BACK / 2, dark, false, false); void tray;
      const cabCols = [0x2a2a2a, 0xc8402e, 0x2a6ad8, 0xe0a030];
      cabCols.forEach((col, i) => { const cb = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, BACK - 1.2, 6), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); cb.rotation.x = Math.PI / 2; cb.position.set(11.82 + i * 0.12, H - 0.5, BACK / 2); scene.add(cb); });
      for (let z = 3; z < BACK; z += 5) box(0.04, 0.5, 0.04, 12, H - 0.28, z, steel, false, false); }

    // ---------- Suelo: pasarela de rejilla metálica desde la entrada hasta la puerta del campo de tiro ----------
    {
      const grate = pixelTexture(64, 64, (g) => { g.fillStyle = "#4a5058"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#2a2e34"; for (let i = 0; i < 64; i += 8) { g.fillRect(i, 0, 3, 64); g.fillRect(0, i, 64, 3); } g.fillStyle = "#6a727c"; for (let i = 0; i < 64; i += 8) g.fillRect(i + 3, 0, 1, 64); }, [4, 28]);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(3.6, BACK - 4), new THREE.MeshStandardMaterial({ map: grate, roughness: 0.5, metalness: 0.6 }));
      walk.rotation.x = -Math.PI / 2; walk.position.set(0, 0.007, 4 + (BACK - 4) / 2); walk.receiveShadow = true; scene.add(walk);
      for (const sx of [-1.85, 1.85]) box(0.1, 0.02, BACK - 4, sx, 0.01, 4 + (BACK - 4) / 2, strip, false, false);
    }

    // ---------- Paredes: tuberías con abrazaderas y válvulas, rejillas de ventilación y extintores ----------
    const pipeMats = [new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.7, roughness: 0.35 }), new THREE.MeshStandardMaterial({ color: 0x3a6a8a, metalness: 0.5, roughness: 0.4 }), new THREE.MeshStandardMaterial({ color: 0xa8402e, metalness: 0.4, roughness: 0.5 })];
    pipeMats.forEach((m, i) => {
      const r = 0.07 + i * 0.015, y = H - 1.35 - i * 0.24;
      const pp = new THREE.Mesh(new THREE.CylinderGeometry(r, r, W - 1, 12), m); pp.rotation.z = Math.PI / 2; pp.position.set(0, y, 0.46 + i * 0.03); scene.add(pp);
      for (let x = -21; x <= 21; x += 6) box(0.06, 0.06, 0.5, x + i, y, 0.25, steel, false, false);
    });
    for (const x of [-12.5, 9.5]) { const v = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: 0xc8302a })); v.position.set(x, H - 1.35, 0.62); scene.add(v); }
    const vent = pixelTexture(32, 20, (g) => { g.fillStyle = "#3a4048"; g.fillRect(0, 0, 32, 20); g.fillStyle = "#14171a"; for (let y = 3; y < 18; y += 3) g.fillRect(2, y, 28, 2); });
    const ventMat = new THREE.MeshStandardMaterial({ map: vent, roughness: 0.6, metalness: 0.4 });
    for (const [x, z, ry] of [[-W / 2 + 0.03, 5, Math.PI / 2], [-W / 2 + 0.03, 15.5, Math.PI / 2], [W / 2 - 0.03, 11, -Math.PI / 2], [W / 2 - 0.03, 23, -Math.PI / 2], [-12, BACK - 0.03, Math.PI], [13, BACK - 0.03, Math.PI]] as const) {
      const vm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.85), ventMat); vm.position.set(x, 5.4, z); vm.rotation.y = ry; scene.add(vm);
    }
    const ext = new THREE.MeshStandardMaterial({ color: 0xc8241e, roughness: 0.4, metalness: 0.2 });
    for (const [x, z] of [[-W / 2 + 0.42, 12.0], [W / 2 - 0.42, 13.0], [16, 0.45], [-7, BACK - 0.45]] as const) {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12), ext); e.position.set(x, 0.55, z); e.castShadow = true; scene.add(e);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.1, 8), dark); head.position.set(x, 0.85, z); scene.add(head);
      box(0.3, 0.3, 0.02, x, 1.35, z + (z < 1 ? -0.4 : z > BACK - 1 ? 0.4 : 0), new THREE.MeshBasicMaterial({ color: 0xc8241e }), false, false);
    }

    // ---------- Cámaras de seguridad en las esquinas (giran despacio) y reloj de pared ----------
    for (const [x, z, base] of [[-W / 2 + 0.4, 0.4, Math.PI * 0.75], [W / 2 - 0.4, 0.4, -Math.PI * 0.75], [-W / 2 + 0.4, BACK - 0.4, Math.PI * 0.25], [W / 2 - 0.4, BACK - 0.4, -Math.PI * 0.25]] as const) {
      const g = new THREE.Group(); g.position.set(x, H - 0.9, z); scene.add(g);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.06), dark); arm.position.y = 0.2; g.add(arm);
      const head = new THREE.Group(); g.add(head);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.4 })); body.position.z = 0.12; head.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), dark); lens.rotation.x = Math.PI / 2; lens.position.z = 0.32; head.add(lens);
      const rec = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); rec.position.set(0.06, 0.06, 0.3); head.add(rec);
      head.rotation.set(0.35, base, 0); cams.push({ head, base, phase: Math.random() * 6, rec });
    }
    {
      clockCv.width = 128; clockCv.height = 128; clockTex.colorSpace = THREE.SRGBColorSpace;
      const ck = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false })); ck.position.set(0, 4.15, 0.04); scene.add(ck);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 8, 32), steel); rim.position.set(0, 4.15, 0.05); scene.add(rim);
      drawClock();
    }
  }
  // Puerta sellada: hoja de acero con 4 huecos para las piezas (vacíos por ahora) y su rótulo
  const sealed = new THREE.Group(); sealed.position.set(-W / 2 - 0.5, 0, (LD0 + LD1) / 2); scene.add(sealed);
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; sealed.add(o); return o; };
    add(0.5, 3.4, LD1 - LD0, 0, 1.7, 0, steel);
    add(0.6, 0.25, LD1 - LD0 + 0.4, 0.05, 3.5, 0, safety); for (const s of [-1, 1]) add(0.6, 3.4, 0.2, 0.05, 1.7, s * ((LD1 - LD0) / 2 + 0.1), safety);
    add(0.52, 0.06, LD1 - LD0 - 0.4, 0.02, 1.7, 0, dark);
    const slotOff = new THREE.MeshStandardMaterial({ color: 0x20262c, emissive: 0x3a1010, emissiveIntensity: 0.6, roughness: 0.5 });
    for (let i = 0; i < 4; i++) { add(0.56, 0.42, 0.42, 0.03, 2.3, -1.2 + i * 0.8, dark); add(0.58, 0.26, 0.26, 0.03, 2.3, -1.2 + i * 0.8, slotOff); }
    add(0.56, 0.05, 3.2, 0.03, 2.72, 0, neonA); }
  colliders.push(new THREE.Box3(new THREE.Vector3(-W / 2 - 1, 0, LD0), new THREE.Vector3(-W / 2 + 0.1, 3.4, LD1)));
  { const m = sign(t("sign.sealed"), "#c8402e", 3.2, 0.8); m.position.set(-W / 2 + 0.04, 4.2, (LD0 + LD1) / 2); m.rotation.y = Math.PI / 2; scene.add(m); }

  // ---------- Campo de tiro (sala de detrás, en el grupo `rg`; coordenadas locales como el campo original) ----------
  into = rg;
  { const rf = new THREE.Mesh(new THREE.PlaneGeometry(W, 4.5 - FRONT), floor); rf.rotation.x = -Math.PI / 2; rf.position.set(0, 0, (4.5 + FRONT) / 2); rf.receiveShadow = true; rg.add(rf); shootables.push(rf); }
  box(1, H, 4.5 - FRONT, -W / 2 - 0.5, H / 2, (4.5 + FRONT) / 2, wall);
  box(1, H, 4.5 - FRONT, W / 2 + 0.5, H / 2, (4.5 + FRONT) / 2, wall);
  box(W + 2, H, 1, 0, H / 2, FRONT - 0.5, wall);
  { const rc = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, 4.5 - FRONT + 2), dark); rc.rotation.x = Math.PI / 2; rc.position.set(0, H, (4.5 + FRONT) / 2); rg.add(rc); dayOnly.push(rc); }
  for (let z = 0; z > FRONT; z -= 8) {
    dayOnly.push(box(W, 0.3, 0.3, 0, H - 0.15, z, steel, false, false));
    for (const x of [-18, -9, 0, 9, 18]) dayOnly.push(box(5, 0.06, 1.4, x, H - 0.05, z - 4, panelLight, false, false));
  }

  // Líneas de distancia en el suelo (finas y claras) con su rótulo de terminal en las paredes
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f0, transparent: true, opacity: 0.85 });
  for (const d of [5, 10, 15, 25, 35, 50, 75]) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(W, d % 25 === 0 || d === 10 ? 0.14 : 0.08), lineMat); ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.012, -d); rg.add(decal(ln));
    const tex = pixelTexture(64, 24, (g) => { g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, 64, 24); g.fillStyle = "#1c1f22"; g.font = "bold 18px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${d}M`, 32, 14); g.fillStyle = "#e07a2a"; g.fillRect(0, 0, 64, 3); });
    for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) {
      const bm = new THREE.MeshBasicMaterial({ map: tex }); boardMats.push(bm);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), bm);
      s.position.set(x, 2.4, -d); s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; rg.add(decal(s));
    }
  }

  const pilot = new THREE.MeshStandardMaterial({ color: NEON_CYAN, emissive: NEON_CYAN, emissiveIntensity: 0.7 });
  // Línea de tiro: consolas por calle, separadores y franja de seguridad
  for (const x of lanes) {
    box(4.2, 0.08, 0.9, x, 1.0, 0.2, steel);
    box(4.2, 0.95, 0.12, x, 0.48, -0.2, wall);
    box(0.08, 0.9, 0.7, x - 1.7, 0.48, 0.25, steel, false);
    box(0.08, 0.9, 0.7, x + 1.7, 0.48, 0.25, steel, false);
    box(0.36, 0.015, 0.04, x + 1.2, 1.05, 0.55, pilot, false, false); // piloto de la calle
  }
  colliders.push(new THREE.Box3().setFromPoints([rangePt(-15.2, -0.3), rangePt(15.2, 0.7).setY(1.05)]));
  for (const x of [-15, -10, -5, 0, 5, 10, 15]) box(0.1, 2.4, 1.6, x, 1.2, 0.6, new THREE.MeshStandardMaterial({ color: 0x3a4248, transparent: true, opacity: 0.7, roughness: 0.3, metalness: 0.3 }));
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.25), hazard); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.006, 1.2); rg.add(decal(stripe));

  // Cobertura de prueba: bloques de simulación (cajas de paneles)
  for (const [x, z, w, h] of [[-17, -18, 1.4, 1.1], [-15.6, -18.4, 1, 1.6], [17, -36, 1.4, 1.2], [-4.8, -40, 1.6, 1], [4.9, -22, 1.2, 1.3], [-19, -58, 2, 1.4], [18, -62, 1.6, 2], [-8, -68, 2.4, 1.2], [9, -74, 1.4, 1.6], [0, -60, 1, 2.2]]) box(w, h, w, x, h / 2, z, wall);
  { const m = sign(t("sign.range"), "#3a9ad8", 4, 1); m.position.set(0, DOOR_H + 0.9, BACK - 0.02); m.rotation.y = Math.PI; scene.add(m); }

  into = scene;
  // ---------- Cuadros de datos y mensajes del sistema (en el campo de tiro) ----------
  const dataCanvas = document.createElement("canvas"); dataCanvas.width = 160; dataCanvas.height = 96;
  const dataTex = new THREE.CanvasTexture(dataCanvas); dataTex.colorSpace = THREE.SRGBColorSpace; dataTex.magFilter = THREE.NearestFilter; dataTex.minFilter = THREE.NearestFilter;
  const dataPanel = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ map: dataTex }));
  dataPanel.position.set(-W / 2 + 0.03, 3.8, -6); dataPanel.rotation.y = Math.PI / 2; rg.add(decal(dataPanel));
  const msgCanvas = document.createElement("canvas"); msgCanvas.width = 256; msgCanvas.height = 32;
  const msgTex = new THREE.CanvasTexture(msgCanvas); msgTex.colorSpace = THREE.SRGBColorSpace; msgTex.magFilter = THREE.NearestFilter; msgTex.minFilter = THREE.NearestFilter;
  const msgPanel = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshBasicMaterial({ map: msgTex, transparent: true }));
  msgPanel.position.set(0, H - 1.6, FRONT + 0.05); rg.add(decal(msgPanel));
  let dataT = 0, blink = 0;
  const drawData = (d: RangeData) => {
    const g = dataCanvas.getContext("2d")!;
    g.fillStyle = "#0b0e10"; g.fillRect(0, 0, 160, 96);
    g.strokeStyle = "#2a5a60"; g.strokeRect(1.5, 1.5, 157, 93);
    g.fillStyle = "#3fd0d8"; g.fillRect(0, 0, 160, 3);
    g.font = "bold 11px monospace"; g.textBaseline = "top";
    const row = (y: number, k: string, v: string) => { g.fillStyle = "#6f8f93"; g.fillText(k, 8, y); g.fillStyle = "#d8f4f6"; g.textAlign = "right"; g.fillText(v, 152, y); g.textAlign = "left"; };
    g.fillStyle = "#9fe3e8"; g.fillText(t("sim.data"), 8, 8);
    row(26, "DPS", d.dps ? Math.round(d.dps).toString() : "—");
    row(42, t("sim.ttk"), d.ttk != null ? `${d.ttk.toFixed(2)} s` : "—");
    row(58, t("sim.acc"), d.accuracy != null ? `${Math.round(d.accuracy * 100)} %` : "—");
    row(74, t("sim.dist"), d.distance != null ? `${d.distance.toFixed(1)} m` : "—");
    dataTex.needsUpdate = true;
  };
  const drawMsg = (m: string, on: boolean) => {
    const g = msgCanvas.getContext("2d")!; g.clearRect(0, 0, 256, 32);
    g.fillStyle = "rgba(10,14,16,0.85)"; g.fillRect(0, 4, 256, 24);
    g.font = "bold 14px monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = on ? "#e8a040" : "#9a6a2c"; g.fillText(`> ${m}${on ? "_" : " "}`, 128, 17);
    msgTex.needsUpdate = true;
  };

  // ---------- Terminal de la simulación (sustituye al cofre) ----------
  const chest = new THREE.Group(); chest.position.set(-12, 0, 13); chest.rotation.y = Math.PI; // (de cara a la entrada del hall)
  const term = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.8), wall); term.position.y = 0.8; term.castShadow = true; chest.add(term);
  const screenCanvas = document.createElement("canvas"); screenCanvas.width = 64; screenCanvas.height = 40;
  { const g = screenCanvas.getContext("2d")!; g.fillStyle = "#081013"; g.fillRect(0, 0, 64, 40); g.fillStyle = "#3fd0d8"; g.font = "bold 9px monospace"; g.fillText("ARMORY", 6, 14); g.fillText("MODULE", 6, 26); g.fillRect(6, 31, 52, 2); }
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.magFilter = THREE.NearestFilter; screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62), new THREE.MeshBasicMaterial({ map: screenTex })); screen.position.set(0, 1.25, 0.41); chest.add(screen);
  // "Tapa": la bandeja de salida, que se abre al compilar un arma
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.62, 0.4); chest.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.3), steel); lid.position.set(0, 0, 0.15); lidPivot.add(lid);
  const glowStrip = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.03), neonA); glowStrip.position.set(0, 0.58, 0.42); chest.add(glowStrip);
  const chestGlow = new THREE.PointLight(NEON_AMBER, 0, 4); chestGlow.position.set(0, 1.1, 0.6); chest.add(chestGlow);
  // Detalle del terminal: zócalo, columnas laterales con franjas, marco de pantalla, teclado inclinado y copete con rótulo
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = true; chest.add(b); return b; };
    add(1.7, 0.12, 1.0, 0, 0.06, 0, steel);
    for (const sx of [-0.78, 0.78]) { add(0.16, 2.3, 0.9, sx, 1.15, 0, steel); add(0.02, 1.9, 0.02, sx, 1.15, 0.46, neonA); }
    add(1.16, 0.78, 0.06, 0, 1.25, 0.39, dark);
    add(1.0, 0.05, 0.32, 0, 0.98, 0.52, steel, 0.35);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) add(0.14, 0.02, 0.07, -0.33 + i * 0.22, 1.01 + j * 0.03, 0.47 + j * 0.09, wall, 0.35);
    add(1.72, 0.32, 0.5, 0, 2.38, 0.05, steel);
    add(1.5, 0.04, 0.02, 0, 2.24, 0.31, neonA); }
  scene.add(chest);
  colliders.push(new THREE.Box3(new THREE.Vector3(-12.75, 0, 12.55), new THREE.Vector3(-11.25, 1.6, 13.45)));

  // ---------- Banco de trabajo ----------
  const bench = new THREE.Group(); bench.position.set(12, 0, 13); bench.rotation.y = Math.PI;
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 1.1), steel); top.position.y = 0.95; top.castShadow = true; top.receiveShadow = true; bench.add(top);
  for (const [x, z] of [[-1.2, -0.48], [1.2, -0.48], [-1.2, 0.48], [1.2, 0.48]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.08), steel); leg.position.set(x, 0.47, z); bench.add(leg); }
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 0.05), wall); board.position.set(0, 1.75, -0.53); bench.add(board);
  const benchLine = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.02), neonC); benchLine.position.set(0, 1.0, 0.56); bench.add(benchLine);
  const lamp = new THREE.PointLight(WARM, 3, 4); lamp.position.set(0, 2.2, 0.2); bench.add(lamp);
  // Detalle del banco: tablero perforado con herramientas, monitor de diagnóstico, tornillo de banco, cajonera y flexo
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.y = ry; b.castShadow = true; bench.add(b); return b; };
    for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) add(0.03, 0.03, 0.01, -1.1 + i * 0.27, 1.3 + j * 0.25, -0.5, dark);
    add(0.5, 0.06, 0.03, -0.8, 1.9, -0.49, steel); add(0.06, 0.4, 0.03, -0.45, 1.75, -0.49, steel); add(0.3, 0.3, 0.03, 0.75, 1.7, -0.49, steel);
    add(0.7, 0.42, 0.05, 0.6, 1.3, -0.3, dark, -0.2); add(0.6, 0.32, 0.01, 0.6, 1.3, -0.27, neonC, -0.2); add(0.06, 0.25, 0.06, 0.6, 1.05, -0.36, steel);
    add(0.22, 0.14, 0.2, -1.0, 1.06, 0.2, steel); add(0.3, 0.06, 0.06, -1.0, 1.06, 0.34, steel);
    add(0.7, 0.75, 0.9, 0.85, 0.4, 0, wall); for (const y of [0.2, 0.45, 0.7]) add(0.3, 0.03, 0.02, 0.85, y, 0.46, steel);
    add(0.04, 0.9, 0.04, -1.25, 1.45, -0.3, steel); add(0.35, 0.05, 0.18, -1.08, 1.9, -0.15, steel); add(0.3, 0.02, 0.12, -1.08, 1.87, -0.15, neonC); }
  scene.add(bench);
  colliders.push(new THREE.Box3(new THREE.Vector3(10.6, 0, 12.4), new THREE.Vector3(13.4, 1.0, 13.6)));

  // ---------- Consola de oleadas y pedestal de inspección ----------
  // (consola con anillo holográfico: ya no se usa en el hall, se deja para salas futuras)
  const consoleAt = (x: number, label: string, color: THREE.Material, z = 13.2, rotY = 0) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.6), wall); ped.position.y = 0.52; g.add(ped);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.7), steel); top.position.y = 1.08; top.rotation.x = -0.25; g.add(top);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.025, 0.025), color); strip.position.set(0, 1.0, 0.33); g.add(strip);
    const c = document.createElement("canvas"); c.width = 64; c.height = 16; const gg = c.getContext("2d")!; gg.fillStyle = "#0b0e10"; gg.fillRect(0, 0, 64, 16); gg.fillStyle = "#9fe3e8"; gg.font = "bold 10px monospace"; gg.textAlign = "center"; gg.fillText(label, 32, 12);
    const tx = new THREE.CanvasTexture(c); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: tx })); sign.position.set(0, 1.4, 0.0); g.add(sign);
    // Anillo y columna de la consola (holograma fijo, sin luz)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 24), color); ring.rotation.x = Math.PI / 2; ring.position.y = 1.7; g.add(ring);
    const ring2 = ring.clone(); ring2.scale.setScalar(0.65); ring2.position.y = 1.85; g.add(ring2);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.8), steel); base.position.y = 0.05; g.add(base);
    scene.add(g); colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.45, 0, z - 0.35), new THREE.Vector3(x + 0.45, 1.1, z + 0.35)));
    return g;
  };
  void consoleAt;
  // ---------- Almacén: taquillas de armas (sustituye al pedestal de inspección; el banco ya enseña el arma) ----------
  const storage = new THREE.Group(); storage.position.set(4, 0, 13.2); storage.rotation.y = Math.PI;
  const locker = new THREE.MeshStandardMaterial({ color: 0x4f7a5c, roughness: 0.6, metalness: 0.35 });
  for (const x of [-0.82, 0, 0.82]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.1, 0.6), locker); door.position.set(x, 1.05, 0); door.castShadow = door.receiveShadow = true; storage.add(door);
    for (const y of [1.75, 1.6]) { const vent = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.01), steel); vent.position.set(x, y, 0.305); storage.add(vent); }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.04), steel); handle.position.set(x + 0.28, 1.05, 0.32); storage.add(handle);
  }
  const lockerStrip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.02), neonC); lockerStrip.position.set(0, 2.12, 0.31); storage.add(lockerStrip);
  // Detalle del almacén: marco, zócalo, copete, placas numeradas y panel de acceso
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; storage.add(b); return b; };
    for (const sx of [-1.25, 1.25]) add(0.08, 2.3, 0.7, sx, 1.15, 0, steel);
    add(2.58, 0.12, 0.7, 0, 0.06, 0, steel); add(2.58, 0.2, 0.7, 0, 2.25, 0, steel);
    for (const x of [-0.82, 0, 0.82]) { add(0.22, 0.08, 0.01, x, 1.92, 0.31, wall); add(0.1, 0.1, 0.01, x + 0.28, 1.3, 0.31, neonC); }
    add(0.3, 0.45, 0.08, 1.48, 1.3, 0.1, dark); add(0.2, 0.15, 0.01, 1.48, 1.4, 0.15, neonC); }
  scene.add(storage); colliders.push(new THREE.Box3(new THREE.Vector3(2.75, 0, 12.85), new THREE.Vector3(5.25, 2.1, 13.55)));

  // ---------- Carteles de cada puesto (colgados, legibles desde lejos) ----------
  // (dos caras: se leen al llegar desde la línea de tiro y desde el fondo del vestíbulo)
  const hang = (text: string, color: string, x: number, z: number, w = 3.2) => {
    for (const back of [false, true]) { const m = sign(text, color, w, 0.8); m.position.set(x, 3.4, z + (back ? 0.02 : -0.02)); m.rotation.y = back ? 0 : Math.PI; scene.add(m); }
  };
  hang(t("sign.shop"), "#e0a030", -12, 12.2); hang(t("sign.workshop"), "#3a9ad8", 12, 12.2); hang(t("sign.storage"), "#4f9a6c", 4, 12.6, 2.8);

  // ---------- Zona de entrenamiento y de pruebas (en el campo de tiro, pasillo lateral pasada la línea de tiro) ----------
  // Tres muñecos (dummies.ts) junto a la pared; delante, un círculo donde la súper se carga sola y el equipamiento no
  // gasta cargas (main.ts: `world.testZone`), para probarlos sin salir a una misión.
  const testZone = rangePt(-18.6, -8.5).setY(0);
  {
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({ color: 0x3f5a46, roughness: 0.95 }));
    mat.rotation.x = -Math.PI / 2; mat.position.copy(rangePt(-19.6, -8.5)).setY(0.008); scene.add(decal(mat));
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 48), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2; ring.position.copy(testZone).setY(0.014); scene.add(decal(ring));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.35, 48), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.copy(testZone).setY(0.012); scene.add(disc);
    // Carteles colgados del techo sobre la entrada de la zona (de cara a quien llega desde la línea de tiro)
    const hp = rangePt(-19.6, -3.4);
    for (const back of [false, true]) {
      const m = sign(t("sign.training"), "#e07a2a", 3.6, 0.9); m.position.set(hp.x, 4.3, hp.z + (back ? 0.02 : -0.02)); m.rotation.y = back ? 0 : Math.PI; scene.add(m);
      const n = sign(t("sign.testzone"), "#3fb8d8", 4.4, 0.6); n.position.set(hp.x, 3.55, hp.z + (back ? 0.02 : -0.02)); n.rotation.y = back ? 0 : Math.PI; scene.add(n);
    }
    for (const dx of [-1.6, 1.6]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, H - 4.75), new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.6, roughness: 0.4 })); rod.position.set(hp.x + dx, (H + 4.75) / 2, hp.z); scene.add(rod); }
  }

  // ---------- Sala nueva (amplia y vacía, a la derecha del vestíbulo; se llenará más adelante) ----------
  const NX0 = W / 2 + 1, NW = 60, NZ0 = -12, NZ1 = 48, NH = 9;
  { const nf = new THREE.Mesh(new THREE.PlaneGeometry(NW, NZ1 - NZ0), floor); nf.rotation.x = -Math.PI / 2; nf.position.set(NX0 + NW / 2, 0, (NZ0 + NZ1) / 2); nf.receiveShadow = true; scene.add(nf); shootables.push(nf);
    box(NW + 2, NH, 1, NX0 + NW / 2, NH / 2, NZ0 - 0.5, wall); box(NW + 2, NH, 1, NX0 + NW / 2, NH / 2, NZ1 + 0.5, wall);
    box(1, NH, NZ1 - NZ0, NX0 + NW + 0.5, NH / 2, (NZ0 + NZ1) / 2, wall);
    // (pared común con el vestíbulo: lo que sobresale por encima y a los lados del vestíbulo)
    if (NH > H) box(1, NH - H, NZ1 - NZ0, NX0 - 0.5, H + (NH - H) / 2, (NZ0 + NZ1) / 2, wall, false);
    if (NZ1 > BACK + 1) box(1, NH, NZ1 - BACK - 1, NX0 - 0.5, NH / 2, (NZ1 + BACK + 1) / 2, wall);
    const nc = new THREE.Mesh(new THREE.PlaneGeometry(NW + 2, NZ1 - NZ0 + 2), dark); nc.rotation.x = Math.PI / 2; nc.position.set(NX0 + NW / 2, NH, (NZ0 + NZ1) / 2); scene.add(nc);
    for (let z = NZ0 + 5; z < NZ1; z += 9) for (let x = NX0 + 6; x < NX0 + NW; x += 12) box(5, 0.06, 1.4, x, NH - 0.05, z, panelLight, false, false);
    const m = sign(t("sign.newroom"), "#7a8a9a", 3.2, 0.8); m.position.set(W / 2 - 0.04, 4.2, (SD0 + SD1) / 2); m.rotation.y = -Math.PI / 2; scene.add(m); }
  // ---------- Sala de mando (sala B): mesa holográfica, consolas, pantalla de misión, columnas y techo ----------
  const holo: THREE.Object3D[] = [];
  {
    const HX = NX0 + 32, HZ = 18; // centro de la mesa holográfica
    const plate = new THREE.MeshStandardMaterial({ color: 0x3a424c, roughness: 0.6, metalness: 0.4 });
    const glowB = new THREE.MeshBasicMaterial({ color: 0x7fe6ff });
    // Estrado circular con escalón y mesa
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.2, 0.3, 48), plate); dais.position.set(HX, 0.15, HZ); dais.receiveShadow = true; scene.add(dais);
    colliders.push(new THREE.Box3(new THREE.Vector3(HX - 4.2, 0, HZ - 4.2), new THREE.Vector3(HX + 4.2, 0.3, HZ + 4.2)));
    const edge = new THREE.Mesh(new THREE.TorusGeometry(6.05, 0.03, 6, 64), glowB); edge.rotation.x = Math.PI / 2; edge.position.set(HX, 0.31, HZ); scene.add(edge);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.0, 1.0, 40), new THREE.MeshStandardMaterial({ color: 0x23282e, roughness: 0.4, metalness: 0.6 })); table.position.set(HX, 0.8, HZ); table.castShadow = true; scene.add(table);
    colliders.push(new THREE.Box3(new THREE.Vector3(HX - 2.4, 0, HZ - 2.4), new THREE.Vector3(HX + 2.4, 1.3, HZ + 2.4)));
    const top = new THREE.Mesh(new THREE.CircleGeometry(2.3, 48), new THREE.MeshBasicMaterial({ color: 0x0e3a4a })); top.rotation.x = -Math.PI / 2; top.position.set(HX, 1.31, HZ); scene.add(top);
    // Holograma: planeta de malla con anillos y puntos de misión que giran
    const add = (o: THREE.Object3D) => { scene.add(o); holo.push(o); return o; };
    const hmat = (c: number, op: number) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 2), hmat(0x7fe6ff, 0.55))).position.set(HX, 2.9, HZ);
    for (const [r, tilt, c] of [[1.8, 0.4, 0xf2c040], [2.1, -0.6, 0xa070ff]] as const) { const ring = add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 64), hmat(c, 0.8))); ring.position.set(HX, 2.9, HZ); ring.rotation.set(Math.PI / 2 + tilt, 0, 0); }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 1.6, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); beam.position.set(HX, 2.1, HZ); scene.add(beam);
    // Pantalla de misión gigante en la pared del fondo (x = NX0 + NW)
    const mc = document.createElement("canvas"); mc.width = 512; mc.height = 256; const g = mc.getContext("2d")!;
    g.fillStyle = "#04121a"; g.fillRect(0, 0, 512, 256); g.strokeStyle = "rgba(127,230,255,.25)"; for (let x = 0; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); } for (let y = 0; y < 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
    g.fillStyle = "#7fe6ff"; g.font = "bold 20px monospace"; g.fillText(t("sign.control"), 20, 36, 472);
    const pts = [[110, 160, "#ff4a6a"], [220, 90, "#3fd0d8"], [330, 180, "#f2c040"], [420, 110, "#a070ff"]] as const;
    g.strokeStyle = "rgba(255,255,255,.4)"; g.setLineDash([6, 6]); g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
    for (const [x, y, c] of pts) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.strokeStyle = c; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.stroke(); }
    const mtx = new THREE.CanvasTexture(mc); mtx.colorSpace = THREE.SRGBColorSpace;
    const big = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: mtx, toneMapped: false })); big.position.set(NX0 + NW - 0.4, 5, HZ); big.rotation.y = -Math.PI / 2; scene.add(big);
    box(0.3, 8.6, 16.6, NX0 + NW - 0.2, 5, HZ, dark, false, false);
    // Bancos de consolas a lo largo de la pared del fondo, con pantallas de datos
    for (const z of [-6, 0, 36, 42]) {
      const cv = document.createElement("canvas"); cv.width = 128; cv.height = 64; const cg = cv.getContext("2d")!;
      cg.fillStyle = "#06100c"; cg.fillRect(0, 0, 128, 64); cg.fillStyle = "#7aff9a"; cg.font = "9px monospace"; for (let i = 0; i < 6; i++) cg.fillText(Array.from({ length: 18 }, () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)]).join(""), 4, 12 + i * 9);
      const tx = new THREE.CanvasTexture(cv); tx.magFilter = THREE.NearestFilter;
      box(1.0, 0.95, 4.4, NX0 + NW - 0.8, 0.475, z, steel);
      box(0.1, 1.1, 4.2, NX0 + NW - 1.2, 1.75, z, dark, false, false);
      for (const dz of [-1.4, 0, 1.4]) { const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); sc.position.set(NX0 + NW - 1.26, 1.75, z + dz); sc.rotation.y = -Math.PI / 2; scene.add(sc); }
      box(0.5, 0.03, 4.2, NX0 + NW - 1.3, 0.97, z, glowB, false, false);
    }
    // Columnas y techo con casetones
    for (const x of [NX0 + 16, NX0 + 48]) for (const z of [NZ0 + 6, NZ0 + 21, NZ0 + 39, NZ0 + 54]) {
      box(1.1, NH, 1.1, x, NH / 2, z, new THREE.MeshStandardMaterial({ color: 0x8f98a2, roughness: 0.55, metalness: 0.25 }));
      for (const [dx, dz] of [[0.56, 0], [-0.56, 0], [0, 0.56], [0, -0.56]]) box(dx ? 0.02 : 0.06, NH - 2, dx ? 0.06 : 0.02, x + dx, NH / 2, z + dz, glowB, false, false);
    }
    for (let x = NX0 + 8; x < NX0 + NW; x += 12) box(0.3, 0.35, NZ1 - NZ0, x, NH - 0.17, (NZ0 + NZ1) / 2, steel, false, false);
    for (let z = NZ0 + 9; z < NZ1; z += 9) box(NW, 0.35, 0.3, NX0 + NW / 2, NH - 0.17, z, steel, false, false);
    // Pasarela de rejilla desde la puerta hasta el estrado
    const grate = pixelTexture(64, 64, (gg) => { gg.fillStyle = "#4a5058"; gg.fillRect(0, 0, 64, 64); gg.fillStyle = "#2a2e34"; for (let i = 0; i < 64; i += 8) { gg.fillRect(i, 0, 3, 64); gg.fillRect(0, i, 64, 3); } }, [26, 4]);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(HX - 6 - NX0, 4), new THREE.MeshStandardMaterial({ map: grate, roughness: 0.5, metalness: 0.6 })); walk.rotation.x = -Math.PI / 2; walk.position.set(NX0 + (HX - 6 - NX0) / 2, 0.007, HZ); walk.receiveShadow = true; scene.add(walk);
  }
  // Ordenadores de modos (sala B, frente a la puerta): uno por modo, cada uno con su pantalla y su rótulo
  const modePcs: { id: Interactable["id"]; z: number; label: string; color: string; icon: (g: CanvasRenderingContext2D, c: string) => void }[] = [
    { id: "raid", z: 8, label: t("sign.raid"), color: "#3fd0d8", icon: (g, c) => { g.strokeStyle = c; for (let i = 0; i < 6; i++) { const x = 10 + i * 19; g.strokeRect(x, 36 + (i % 2) * 14, 14, 10); if (i) { g.beginPath(); g.moveTo(x - 5, 41 + ((i - 1) % 2) * 14); g.lineTo(x, 41 + (i % 2) * 14); g.stroke(); } } g.fillStyle = "#e8a040"; g.fillRect(105, 50, 14, 10); } },
    { id: "survival", z: 13, label: t("sign.survival"), color: "#ff4a6a", icon: (g, c) => { g.strokeStyle = c; for (let r = 6; r <= 22; r += 8) { g.beginPath(); g.arc(64, 54, r, 0, Math.PI * 2); g.stroke(); } g.fillStyle = c; g.fillRect(62, 52, 4, 4); } },
    { id: "defense", z: 23, label: t("sign.defense"), color: "#f2c040", icon: (g, c) => { g.strokeStyle = c; g.beginPath(); g.moveTo(64, 36); g.lineTo(76, 54); g.lineTo(64, 72); g.lineTo(52, 54); g.closePath(); g.stroke(); g.fillStyle = c; for (const [x, y] of [[30, 44], [98, 44], [30, 64], [98, 64]]) g.fillRect(x, y, 6, 6); } },
    { id: "hack", z: 28, label: t("sign.hack"), color: "#a070ff", icon: (g, c) => { g.strokeStyle = c; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.strokeRect(22 + i * 22, 34 + j * 13, 16, 8); g.fillStyle = c; g.fillRect(66, 47, 16, 8); } },
  ];
  const modeObjs = new Map<string, THREE.Group>();
  for (const pc of modePcs) {
    const grp = new THREE.Group(); grp.position.set(NX0 + 9, 0, pc.z); grp.rotation.y = -Math.PI / 2;
    const glow = new THREE.MeshStandardMaterial({ color: pc.color, emissive: pc.color, emissiveIntensity: 1.4 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, mm: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; grp.add(o); return o; };
    add(1.6, 0.95, 0.8, 0, 0.475, 0, steel); add(1.7, 0.06, 0.9, 0, 0.98, 0.02, dark);
    add(0.12, 0.6, 0.12, 0, 1.3, -0.25, steel); add(1.5, 0.9, 0.08, 0, 1.75, -0.22, dark);
    const c = document.createElement("canvas"); c.width = 128; c.height = 80; const g = c.getContext("2d")!;
    g.fillStyle = "#081014"; g.fillRect(0, 0, 128, 80); g.fillStyle = pc.color; g.fillRect(0, 0, 128, 4); g.font = "bold 13px monospace"; g.fillText(pc.label, 8, 22, 112); pc.icon(g, pc.color);
    const tx = new THREE.CanvasTexture(c); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.8), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(0, 1.75, -0.175); grp.add(decal(scr));
    add(1.5, 0.03, 0.03, 0, 1.0, 0.43, glow);
    scene.add(grp); colliders.push(new THREE.Box3(new THREE.Vector3(NX0 + 8.5, 0, pc.z - 0.9), new THREE.Vector3(NX0 + 9.5, 2.3, pc.z + 0.9)));
    { const m = sign(pc.label, pc.color, 3.2, 0.8); m.position.set(NX0 + 9.6, 3.4, pc.z); m.rotation.y = -Math.PI / 2; scene.add(m); }
    modeObjs.set(pc.id, grp);
  }

  // ---------- Tablero de contratos (vestíbulo, entre la terminal y el almacén) ----------
  const ctBoard = new THREE.Group(); ctBoard.position.set(-4, 0, 13.2); ctBoard.rotation.y = Math.PI;
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, mm: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); b.position.set(x, y, z); b.castShadow = true; ctBoard.add(b); return b; };
    for (const sx of [-1.05, 1.05]) add(0.1, 2.4, 0.12, sx, 1.2, 0, steel);
    add(2.2, 1.3, 0.08, 0, 1.6, 0, dark); add(2.3, 0.1, 0.3, 0, 0.05, 0, steel);
    const c = document.createElement("canvas"); c.width = 128; c.height = 72; const g = c.getContext("2d")!;
    g.fillStyle = "#0b0e10"; g.fillRect(0, 0, 128, 72); g.fillStyle = "#e8a040"; g.fillRect(0, 0, 128, 4); g.font = "bold 12px monospace"; g.fillText(t("sign.contracts"), 8, 20);
    for (let i = 0; i < 4; i++) { g.fillStyle = "#2a5a60"; g.fillRect(8, 30 + i * 10, 112, 5); g.fillStyle = "#3fd0d8"; g.fillRect(8, 30 + i * 10, 20 + i * 22, 5); }
    const tx = new THREE.CanvasTexture(c); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.12), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(0, 1.6, 0.05); ctBoard.add(decal(scr));
    add(2.0, 0.03, 0.03, 0, 0.92, 0.06, neonA); }
  scene.add(ctBoard); colliders.push(new THREE.Box3(new THREE.Vector3(-5.2, 0, 13.0), new THREE.Vector3(-2.8, 2.4, 13.4)));
  hang(t("sign.contracts"), "#e8a040", -4, 12.6, 3);

  // ---------- Toques de simulación en el vestíbulo y el campo de tiro (más suaves: siguen siendo claros) ----------
  {
    const core = new THREE.MeshStandardMaterial({ color: 0xbff6ff, emissive: 0x5fe0ff, emissiveIntensity: 1.3 }), shell = new THREE.MeshStandardMaterial({ color: 0xc8d4dc, transparent: true, opacity: 0.3, roughness: 0.2 });
    const cap = new THREE.MeshStandardMaterial({ color: 0x3a414b, metalness: 0.5, roughness: 0.4 });
    for (const [x, z] of [[-W / 2 + 1.2, 1.5], [W / 2 - 1.2, 1.5], [-W / 2 + 1.2, BACK - 1.5], [W / 2 - 1.2, BACK - 1.5]]) {
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, H - 1.4, 10), core); c1.position.set(x, H / 2, z); scene.add(c1);
      const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, H - 1.4, 6), shell); c2.position.set(x, H / 2, z); scene.add(c2);
      for (const y of [0.35, H - 0.35]) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 6), cap); k.position.set(x, y, z); scene.add(k); }
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.55, 0, z - 0.55), new THREE.Vector3(x + 0.55, H, z + 0.55)));
    }
    for (const [i, z] of [-20, -45, -68].entries()) for (const sx of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ map: holoData("#3fc0d0", 40 + i * 5 + sx), transparent: true, opacity: 0.55, depthWrite: false }));
      m.position.set(sx * (W / 2 - 0.04), 4.6, z); m.rotation.y = -sx * Math.PI / 2; rg.add(m); dayOnly.push(m);
    }
  }

  // ---------- Arena de supervivencia (delante del hall, cerrada: se entra desde el ordenador de modos) ----------
  // La entrada (R0) queda al fondo y los enemigos aparecen junto a la pared del hall (R1)
  const RW = 60, R0 = -75.5, R1 = -1.5, RH = 9;
  // Arena con la estética de las referencias (Coded Arms): baldosas hexagonales oscuras con juntas luminosas,
  // paredes de paneles con molduras de neón, columnas de luz y paneles holográficos de datos (todo emisivo: sin luces)
  const hx = hexFloor("#4a505a", "#2a2e35", [RW / 3.2, (R1 - R0) / 5.5]);
  const arenaFloor = new THREE.MeshStandardMaterial({ map: hx.map, emissiveMap: hx.emissive, emissive: 0x3fd0d8, emissiveIntensity: 0.45, roughness: 0.55, metalness: 0.35 });
  const arenaWall = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x8a909a, roughness: 0.8, metalness: 0.2, emissive: 0xff4a8a, emissiveMap: wallCircuit, emissiveIntensity: 0.35 });
  const neonPink = new THREE.MeshStandardMaterial({ color: 0xff4a8a, emissive: 0xff4a8a, emissiveIntensity: 1.3 });
  const neonCyan = new THREE.MeshStandardMaterial({ color: 0x5fe0ff, emissive: 0x5fe0ff, emissiveIntensity: 1.2 });
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(RW, R1 - R0), arenaFloor);
  roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.set(0, 0, (R0 + R1) / 2); roomFloor.receiveShadow = true; scene.add(roomFloor); shootables.push(roomFloor);
  box(1, RH, R1 - R0, -RW / 2 - 0.5, RH / 2, (R0 + R1) / 2, arenaWall);
  box(1, RH, R1 - R0, RW / 2 + 0.5, RH / 2, (R0 + R1) / 2, arenaWall);
  box(RW + 2, RH, 1, 0, RH / 2, R1 + 0.5, arenaWall);
  box(RW + 2, RH, 1, 0, RH / 2, R0 - 0.5, arenaWall);
  // Molduras de neón (rosa abajo, cian arriba) a lo largo de las paredes
  for (const sx of [-1, 1]) { box(0.06, 0.08, R1 - R0, sx * (RW / 2 - 0.02), 0.45, (R0 + R1) / 2, neonPink, false, false); box(0.06, 0.06, R1 - R0, sx * (RW / 2 - 0.02), RH - 1.4, (R0 + R1) / 2, neonCyan, false, false); }
  box(RW, 0.08, 0.06, 0, 0.45, R1 - 0.02, neonPink, false, false); box(RW, 0.06, 0.06, 0, RH - 1.4, R1 - 0.02, neonCyan, false, false);
  box(RW, 0.08, 0.06, 0, 0.45, R0 + 0.02, neonPink, false, false);
  // Columnas de luz: núcleo naranja brillante en una funda translúcida, con remates hexagonales rojos
  const core = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff9a40, emissiveIntensity: 1.6 });
  const shell = new THREE.MeshStandardMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.25, roughness: 0.2, metalness: 0.3 });
  const capRed = new THREE.MeshStandardMaterial({ color: 0x401018, emissive: 0xff2a3a, emissiveIntensity: 1.1 });
  for (const z of [R0 + 12, R0 + 36, R0 + 60]) for (const sx of [-1, 1]) {
    const x = sx * (RW / 2 - 1.2);
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, RH - 2.2, 12), core); c1.position.set(x, RH / 2, z); scene.add(c1);
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, RH - 2.2, 6), shell); c2.position.set(x, RH / 2, z); scene.add(c2);
    for (const y of [0.55, RH - 0.55]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.1, 6), capRed); cap.position.set(x, y, z); scene.add(cap); }
    colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.7, 0, z - 0.7), new THREE.Vector3(x + 0.7, RH, z + 0.7)));
  }
  // Paneles holográficos de datos en las paredes (como las pantallas de números de la simulación)
  for (const [i, z] of [R0 + 24, R0 + 48].entries()) for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.2), new THREE.MeshBasicMaterial({ map: holoData(i % 2 ? "#ff6aa8" : "#5fe0ff", 7 + i * 3 + sx), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.set(sx * (RW / 2 - 0.05), 4.2, z); m.rotation.y = -sx * Math.PI / 2; scene.add(m);
  }
  const roomCeil = new THREE.Mesh(new THREE.PlaneGeometry(RW + 2, R1 - R0 + 1), dark); roomCeil.rotation.x = Math.PI / 2; roomCeil.position.set(0, RH, (R0 + R1) / 2); scene.add(roomCeil);
  const roomPanel = panelLight.clone(); // propio: de noche se atenúa (si no, con la niebla y el resplandor quema la sala)
  for (let z = R0 + 4; z < R1; z += 8) for (const x of [-25, -15, -5, 5, 15, 25]) box(4, 0.06, 1.2, x, RH - 0.04, z, roomPanel, false, false);
  // Franja roja a media altura: aquí se recibe daño
  const danger = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.7 });
  box(0.04, 0.25, R1 - R0, -RW / 2 + 0.03, 1.1, (R0 + R1) / 2, danger, false, false);
  box(0.04, 0.25, R1 - R0, RW / 2 - 0.03, 1.1, (R0 + R1) / 2, danger, false, false);
  box(RW, 0.25, 0.04, 0, 1.1, R1 - 0.03, danger, false, false);
  // (las coberturas de la arena se generan al azar: arena.ts / arenagen.ts)
  // Cartel del fondo: por ahí entran los enemigos
  { const m = sign(t("sign.spawn"), "#c8402e", 6, 1.2); m.position.set(0, 3.6, R1 - 0.02); m.rotation.y = Math.PI; scene.add(m); }
  // ---------- Luz: cálida de mantenimiento con parpadeo, ambiente oscuro y niebla ligera ----------
  scene.add(new THREE.HemisphereLight(0x8a9aa8, 0x2a241c, 1.1));
  const key = new THREE.DirectionalLight(0xd8e2ec, 1.5);
  key.position.set(-10, 20, 40); key.target.position.set(0, 0, 20);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -90, right: 110, top: 120, bottom: -120, near: 1, far: 260 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; // (sin acné de sombra que parpadee al moverse)
  scene.add(key, key.target);
  const lamps: { light: THREE.PointLight; mesh: THREE.Mesh; base: number; phase: number }[] = [];
  const lampMat = () => new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 1.6 });
  // 8 luces en total (el número de luces no cambia nunca: cambiarlo recompila todos los shaders)
  for (const [x, z, y] of [[-14, 8, H], [14, 8, H], ...[-8, -30, -52, -72].map((rz) => [0, rangePt(0, rz).z, H]), [-10, -55, RH], [10, -22, RH]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.3), lampMat()); mesh.position.set(x, y - 0.55, z); scene.add(mesh);
    const light = new THREE.PointLight(WARM, 34, 24, 1.4); light.position.set(x, y - 0.8, z); scene.add(light);
    lamps.push({ light, mesh, base: 34, phase: Math.random() * 10 });
  }
  scene.background = new THREE.Color(0xb9c0c7);
  scene.fog = new THREE.Fog(0xb9c0c7, 90, 200);

  // ---------- Noche: callejón urbano (ver nightcity.ts) ----------
  const city = buildNightCity(rg as unknown as THREE.Scene, { W, FRONT, BACK: 4.5, H });
  const wallDay = wall.map, floorDay = floor.map;

  // ---------- Partículas de datos: cuadraditos que suben despacio por las salas (la simulación «respira») ----------
  const N = 700, mp = new Float32Array(N * 3);
  const zones: [number, number, number, number][] = [[-W / 2, W / 2, 0, RF - FRONT], [-30, 30, R0, R1], [W / 2 + 1, W / 2 + 61, -12, 48]];
  for (let i = 0; i < N; i++) { const z = zones[i % 3]; mp[i * 3] = z[0] + Math.random() * (z[1] - z[0]); mp[i * 3 + 1] = Math.random() * 7; mp[i * 3 + 2] = z[2] + Math.random() * (z[3] - z[2]); }
  const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0x5fd8e0, size: 0.05, transparent: true, opacity: 0.7, depthWrite: false }));
  motes.frustumCulled = false; scene.add(motes);
  // ---------- Día y noche ----------
  const hemi = scene.children.find((o) => o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
  const lampHome = lamps.map((l) => l.light.position.clone());
  let night = false;
  const setNight = (on: boolean) => {
    night = on;
    city.group.visible = on; for (const o of dayOnly) o.visible = !on;
    wall.map = on ? city.wallMap : wallDay; floor.map = on ? city.floorMap : floorDay;
    // Suelo mojado de noche: más liso (recoge los brillos del neón)
    floor.emissiveIntensity = on ? 0 : 0.32; wall.emissiveIntensity = on ? 0 : 0.28;
    motes.visible = !on;
    floor.roughness = on ? 0.55 : 0.8; floor.metalness = on ? 0.3 : 0.35; wall.needsUpdate = floor.needsUpdate = true;
    // Ambiente: luna fría y neblina violeta de noche; luz de día clara
    hemi.color.set(on ? 0x8a7ab8 : 0xe8eef4); hemi.groundColor.set(on ? 0x3a2a48 : 0x8a8478); hemi.intensity = on ? 1.5 : 2.2;
    // Noche legible: carteles atenuados (no deslumbran con el resplandor) y sala de oleadas con luz más suave
    for (const m of signMats) { m.emissiveIntensity = on ? 0.06 : 0.25; m.color.setScalar(on ? 0.75 : 1); }
    for (const m of boardMats) m.color.setScalar(on ? 0.55 : 1);
    roomPanel.emissiveIntensity = on ? 0.45 : 1.1;
    key.color.set(on ? 0xa0a0e0 : 0xfff6ea); key.intensity = on ? 0.8 : 1.6;
    key.position.set(on ? 20 : -10, on ? 40 : 20, on ? -60 : 12);
    // Las lámparas de la sala pasan a ser la luz de los rótulos y farolas (mismo número de luces: sin coste extra)
    // (de noche, las cuatro del campo de tiro pasan a ser las luces de la calle; las del hall y la arena siguen)
    lamps.forEach((l, i) => {
      const sp = i >= 2 && i < 6 ? city.keyLights[i - 2] : undefined;
      l.mesh.visible = !on || !sp;
      if (on && sp) { l.light.position.copy(rg.localToWorld(sp.pos.clone())); l.light.color.set(sp.color); l.base = sp.power; l.light.distance = 18; l.light.decay = 1.5; }
      else { l.light.position.copy(lampHome[i]); l.light.color.set(0xfff4e6); l.base = 22; l.light.distance = 24; l.light.decay = 1.4; }
    });
    const bg = on ? 0x1a1430 : 0xb9c0c7; (scene.background as THREE.Color).set(bg);
    scene.fog = new THREE.Fog(on ? 0x2a1f40 : bg, on ? 35 : 70, on ? 130 : 160);
  };
  rg.updateMatrixWorld(true); for (const m of rgMeshes) colliders.push(new THREE.Box3().setFromObject(m));
  // Rendimiento: lo estático se fusiona por material (cientos de mallas → unas decenas de llamadas de dibujo). Quedan
  // fuera lo que cambia de visibilidad (noche/día, lámparas) y lo animado (la bandeja del terminal); la ciudad se
  // fusiona dentro de su propio grupo, que se enciende y apaga entero
  const camObj = scene.children.find((o) => (o as THREE.Camera).isCamera);
  mergeStatic(scene, new Set<THREE.Object3D>([motes, city.group, lidPivot, ...dayOnly, ...lamps.map((l) => l.mesh), ...(camObj ? [camObj] : [])]));
  mergeStatic(city.group);
  setNight(true);

  let lastMsg = "";
  return {
    setNight, get night() { return night; },
    colliders, shootables, lanes, chestLid: lidPivot, chestGlow, wavesRoom: { z0: R0 - 0.5, z1: R1, x0: -RW / 2, x1: RW / 2 }, rangePt, testZone,
    survivalAt: { pos: new THREE.Vector3(0, 0, R0 + 3), yaw: Math.PI },
    interactables: [
      { id: "chest", position: new THREE.Vector3(-12, 0, 13), radius: 2.2, label: "Terminal", object: chest },
      { id: "workbench", position: new THREE.Vector3(12, 0, 13), radius: 2.4, label: "Banco", object: bench },
      { id: "storage", position: new THREE.Vector3(4, 0, 12.6), radius: 2.0, label: "Almacén", object: storage },
      { id: "contracts", position: new THREE.Vector3(-4, 0, 12.6), radius: 2.0, label: "Contratos", object: ctBoard },
      ...modePcs.map((pc) => ({ id: pc.id, position: new THREE.Vector3(NX0 + 8, 0, pc.z), radius: 2.0, label: pc.label, object: modeObjs.get(pc.id)! })),
    ],
    update(dt: number, data: RangeData) {
      holo.forEach((o, i) => { o.rotation.y += dt * (i === 0 ? 0.25 : 0.12 * (i % 2 ? 1 : -1)); });
      for (const cm of cams) { cm.phase += dt * 0.35; cm.head.rotation.y = cm.base + Math.sin(cm.phase) * 0.6; cm.rec.visible = Math.sin(cm.phase * 6) > -0.2; }
      if (new Date().getMinutes() !== clockMin) drawClock();
      { const p = motes.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * (0.15 + (i % 7) * 0.03); if (y > 7) y = 0; p.setY(i, y); } p.needsUpdate = true; }
      // Parpadeo: la mayoría estables; de vez en cuando una lámpara titila un instante
      for (const l of lamps) {
        l.phase += dt;
        const flick = Math.sin(l.phase * 0.7) > 0.985 ? (Math.random() < 0.5 ? 0.25 : 1) : 1;
        l.light.intensity = l.base * flick; (l.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 * flick;
      }
      if (night) city.update(dt);
      dataT -= dt; blink += dt;
      if (dataT <= 0) { dataT = 0.25; drawData(data); }
      const on = Math.floor(blink * 2) % 2 === 0;
      if (data.message + on !== lastMsg) { lastMsg = data.message + on; drawMsg(data.message, on); }
    },
  };
}
