// Sala de simulación (campo de pruebas): sala modular oscura de paneles, líneas de distancia, luces cálidas de
// mantenimiento con parpadeo, pequeños acentos de neón, niebla, cuadros de datos en pared con tipografía de terminal
// y mensajes del sistema. El terminal de la simulación sustituye al cofre. Estética propia, solo inspirada en el
// planteamiento de una simulación militar (nada copiado de ningún juego).
// Coordenadas: la línea de tiro está en z = 0, hacia -z queda la sala de tiro; detrás (z > 0) la zona de equipo.
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


export interface Interactable { id: "chest" | "workbench" | "waves" | "storage" | "contracts" | "raid"; position: THREE.Vector3; radius: number; label: string; object: THREE.Object3D }
export interface RangeData { dps: number; ttk: number | null; accuracy: number | null; distance: number | null; message: string }
export interface World {
  colliders: THREE.Box3[]; interactables: Interactable[]; chestLid: THREE.Object3D; chestGlow: THREE.PointLight; wavesRoom: { z0: number; z1: number }; shootables: THREE.Object3D[]; lanes: number[];
  /** Animación de la sala (parpadeos) y refresco de los cuadros de datos. */
  update(dt: number, data: RangeData): void;
  /** Noche (sala a oscuras con neón) o día (luz de mantenimiento). */
  setNight(on: boolean): void;
  readonly night: boolean;
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
  const W = 48, FRONT = -82, BACK = 28, H = 7.5;
  const lanes = [-12.5, -7.5, -2.5, 2.5, 7.5, 12.5];

  // Materiales de panel: losas oscuras con juntas y remaches, pixeladas
  // Instalación de pruebas clara y legible: hormigón claro, paneles gris claro con franja de seguridad, techo con
  // paneles de luz. El color fuerte se reserva para lo que importa (muñecos, terminales, carteles).
  const floorTex = pixelTexture(64, 64, (g) => { speckle(g, 64, 64, "#9a9ea3", 500, 0.08); g.fillStyle = "#7d8186"; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64); g.fillStyle = "#a6aaaf"; g.fillRect(1, 1, 62, 1); }, [W / 2, (BACK - FRONT) / 2]);
  const floor = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 });
  const wallTex = pixelTexture(64, 64, (g) => { speckle(g, 64, 64, "#b9bdc2", 300, 0.06); g.fillStyle = "#8e9297"; g.fillRect(0, 0, 64, 1); g.fillRect(0, 0, 1, 64); g.fillStyle = "#c6cacf"; g.fillRect(1, 1, 62, 1); }, [24, 2]);
  const wall = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, metalness: 0.05 });
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

  const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, collide = true, shoot = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
    if (collide) colliders.push(new THREE.Box3().setFromObject(m));
    if (shoot) shootables.push(m);
    return m;
  };

  // Suelo, paredes, techo y fondo de la sala
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(W, BACK - FRONT), floor);
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, (BACK + FRONT) / 2); fl.receiveShadow = true; scene.add(fl); shootables.push(fl);
  box(1, H, BACK - FRONT, -W / 2 - 0.5, H / 2, (BACK + FRONT) / 2, wall);
  // Pared derecha con puerta (4 m) hacia la sala nueva, a la altura del vestíbulo
  const SD0 = 16, SD1 = 20;
  box(1, H, SD0 - FRONT, W / 2 + 0.5, H / 2, (SD0 + FRONT) / 2, wall);
  box(1, H, BACK - SD1, W / 2 + 0.5, H / 2, (BACK + SD1) / 2, wall);
  box(1, H - 3.4, SD1 - SD0, W / 2 + 0.5, (H + 3.4) / 2, (SD0 + SD1) / 2, wall, false);
  // Pared del fondo con puerta (4 m) hacia la sala de oleadas
  const DOOR = 2, DOOR_H = 3.2;
  box(W / 2 + 1 - DOOR, H, 1, -(W / 2 + 1 + DOOR) / 2, H / 2, BACK + 0.5, wall);
  box(W / 2 + 1 - DOOR, H, 1, (W / 2 + 1 + DOOR) / 2, H / 2, BACK + 0.5, wall);
  box(DOOR * 2, H - DOOR_H, 1, 0, (H + DOOR_H) / 2, BACK + 0.5, wall, false); // dintel: sin colisión (el jugador choca por planta)
  box(W + 2, H, 1, 0, H / 2, FRONT - 0.5, wall);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W + 2, BACK - FRONT + 2), dark); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, H, (BACK + FRONT) / 2); scene.add(ceil);
  // Vigas del techo y zócalos de neón (acento pequeño, cian a un lado y ámbar al otro)
  // (techo, vigas y zócalos solo de día: de noche la sala queda al aire libre, entre edificios)
  const dayOnly: THREE.Object3D[] = [ceil];
  for (let z = BACK - 4; z > FRONT; z -= 8) {
    dayOnly.push(box(W, 0.3, 0.3, 0, H - 0.15, z, steel, false, false));
    for (const x of [-18, -9, 0, 9, 18]) dayOnly.push(box(5, 0.06, 1.4, x, H - 0.05, z - 4, panelLight, false, false));
  }
  // Franja de seguridad a media altura en las paredes laterales (de día)
  dayOnly.push(box(0.04, 0.25, BACK - FRONT, -W / 2 + 0.03, 1.1, (BACK + FRONT) / 2, safety, false, false));
  dayOnly.push(box(0.04, 0.25, BACK - FRONT, W / 2 - 0.03, 1.1, (BACK + FRONT) / 2, safety, false, false));

  // Líneas de distancia en el suelo (finas y claras) con su rótulo de terminal en las paredes
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf4f4f0, transparent: true, opacity: 0.85 });
  for (const d of [5, 10, 15, 25, 35, 50, 75]) {
    const ln = new THREE.Mesh(new THREE.PlaneGeometry(W, d % 25 === 0 || d === 10 ? 0.14 : 0.08), lineMat); ln.rotation.x = -Math.PI / 2; ln.position.set(0, 0.012, -d); scene.add(decal(ln));
    const tex = pixelTexture(64, 24, (g) => { g.fillStyle = "#f2f2ee"; g.fillRect(0, 0, 64, 24); g.fillStyle = "#1c1f22"; g.font = "bold 18px monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`${d}M`, 32, 14); g.fillStyle = "#e07a2a"; g.fillRect(0, 0, 64, 3); });
    for (const x of [-W / 2 + 0.02, W / 2 - 0.02]) {
      const bm = new THREE.MeshBasicMaterial({ map: tex }); boardMats.push(bm);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), bm);
      s.position.set(x, 2.4, -d); s.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; scene.add(decal(s));
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
  colliders.push(new THREE.Box3(new THREE.Vector3(-15.2, 0, -0.3), new THREE.Vector3(15.2, 1.05, 0.7)));
  for (const x of [-15, -10, -5, 0, 5, 10, 15]) box(0.1, 2.4, 1.6, x, 1.2, 0.6, new THREE.MeshStandardMaterial({ color: 0x3a4248, transparent: true, opacity: 0.7, roughness: 0.3, metalness: 0.3 }));
  const stripe = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.25), hazard); stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.006, 1.2); scene.add(decal(stripe));

  // Cobertura de prueba: bloques de simulación (cajas de paneles)
  for (const [x, z, w, h] of [[-17, -18, 1.4, 1.1], [-15.6, -18.4, 1, 1.6], [17, -36, 1.4, 1.2], [-4.8, -40, 1.6, 1], [4.9, -22, 1.2, 1.3], [-19, -58, 2, 1.4], [18, -62, 1.6, 2], [-8, -68, 2.4, 1.2], [9, -74, 1.4, 1.6], [0, -60, 1, 2.2]]) box(w, h, w, x, h / 2, z, wall);

  // ---------- Cuadros de datos y mensajes del sistema ----------
  const dataCanvas = document.createElement("canvas"); dataCanvas.width = 160; dataCanvas.height = 96;
  const dataTex = new THREE.CanvasTexture(dataCanvas); dataTex.colorSpace = THREE.SRGBColorSpace; dataTex.magFilter = THREE.NearestFilter; dataTex.minFilter = THREE.NearestFilter;
  const dataPanel = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshBasicMaterial({ map: dataTex }));
  dataPanel.position.set(-W / 2 + 0.03, 3.8, -6); dataPanel.rotation.y = Math.PI / 2; scene.add(decal(dataPanel));
  const msgCanvas = document.createElement("canvas"); msgCanvas.width = 256; msgCanvas.height = 32;
  const msgTex = new THREE.CanvasTexture(msgCanvas); msgTex.colorSpace = THREE.SRGBColorSpace; msgTex.magFilter = THREE.NearestFilter; msgTex.minFilter = THREE.NearestFilter;
  const msgPanel = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshBasicMaterial({ map: msgTex, transparent: true }));
  msgPanel.position.set(0, H - 1.6, FRONT + 0.05); scene.add(decal(msgPanel));
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
  const chest = new THREE.Group(); chest.position.set(-12, 0, 13);
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
  const bench = new THREE.Group(); bench.position.set(12, 0, 13);
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
  // ---------- Almacén: taquillas de armas (sustituye al pedestal de inspección; el banco ya enseña el arma) ----------
  const storage = new THREE.Group(); storage.position.set(4, 0, 13.2);
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

  // ---------- Zona de entrenamiento cuerpo a cuerpo (muñecos en dummies.ts, junto a la pared izquierda) ----------
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(4, 9), new THREE.MeshStandardMaterial({ color: 0x3f5a46, roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(-W / 2 + 2.6, 0.008, 7.5); scene.add(decal(mat));
  { const m = sign(t("sign.training"), "#e07a2a", 4, 1); m.position.set(-W / 2 + 0.04, 3.2, 7.5); m.rotation.y = Math.PI / 2; scene.add(m); }

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
    box(0.04, 0.25, NZ1 - NZ0, NX0 + NW - 0.03, 1.1, (NZ0 + NZ1) / 2, safety, false, false);
    const m = sign(t("sign.newroom"), "#7a8a9a", 3.2, 0.8); m.position.set(W / 2 - 0.04, 4.2, (SD0 + SD1) / 2); m.rotation.y = -Math.PI / 2; scene.add(m); }
  // Ordenador de incursiones (sala B, frente a la puerta): elige las opciones y lanza la incursión
  const raidPc = new THREE.Group(); raidPc.position.set(NX0 + 9, 0, 18); raidPc.rotation.y = -Math.PI / 2;
  { const add = (w: number, h: number, d: number, x: number, y: number, z: number, mm: THREE.Material) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; raidPc.add(b); return b; };
    add(1.6, 0.95, 0.8, 0, 0.475, 0, steel); add(1.7, 0.06, 0.9, 0, 0.98, 0.02, dark);
    add(0.12, 0.6, 0.12, 0, 1.3, -0.25, steel); add(1.5, 0.9, 0.08, 0, 1.75, -0.22, dark);
    const c = document.createElement("canvas"); c.width = 128; c.height = 80; const g = c.getContext("2d")!;
    g.fillStyle = "#081014"; g.fillRect(0, 0, 128, 80); g.fillStyle = "#3fd0d8"; g.fillRect(0, 0, 128, 4); g.font = "bold 13px monospace"; g.fillText(t("sign.raid"), 8, 22);
    g.strokeStyle = "#3fd0d8"; for (let i = 0; i < 6; i++) { const x = 10 + i * 19; g.strokeRect(x, 36 + (i % 2) * 14, 14, 10); if (i) { g.beginPath(); g.moveTo(x - 5, 41 + ((i - 1) % 2) * 14); g.lineTo(x, 41 + (i % 2) * 14); g.stroke(); } }
    g.fillStyle = "#e8a040"; g.fillRect(105, 50, 14, 10);
    const tx = new THREE.CanvasTexture(c); tx.magFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 0.8), new THREE.MeshBasicMaterial({ map: tx })); scr.position.set(0, 1.75, -0.175); raidPc.add(decal(scr));
    add(1.5, 0.03, 0.03, 0, 1.0, 0.43, neonC); }
  scene.add(raidPc); colliders.push(new THREE.Box3(new THREE.Vector3(NX0 + 8.5, 0, 17.1), new THREE.Vector3(NX0 + 9.5, 2.3, 18.9)));
  { const m = sign(t("sign.raid"), "#3fd0d8", 3.2, 0.8); m.position.set(NX0 + 9.6, 3.4, 18); m.rotation.y = -Math.PI / 2; scene.add(m); }

  // ---------- Tablero de contratos (vestíbulo, entre la terminal y el almacén) ----------
  const ctBoard = new THREE.Group(); ctBoard.position.set(-4, 0, 13.2);
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

  // ---------- Sala de oleadas (detrás de la pared del fondo, entrando por la puerta) ----------
  const RW = 60, R0 = BACK + 1, R1 = BACK + 74, RH = 9; // (más grande: antes 46 × 56 m)
  const roomFloor = new THREE.Mesh(new THREE.PlaneGeometry(RW, R1 - R0), floor);
  roomFloor.rotation.x = -Math.PI / 2; roomFloor.position.set(0, 0, (R0 + R1) / 2); roomFloor.receiveShadow = true; scene.add(roomFloor); shootables.push(roomFloor);
  box(1, RH, R1 - R0, -RW / 2 - 0.5, RH / 2, (R0 + R1) / 2, wall);
  box(1, RH, R1 - R0, RW / 2 + 0.5, RH / 2, (R0 + R1) / 2, wall);
  box(RW + 2, RH, 1, 0, RH / 2, R1 + 0.5, wall);
  // (la sala es más ancha y alta que el vestíbulo: se cierran los costados y la franja de encima de su pared)
  for (const sd of [-1, 1]) box((RW - W) / 2 + 1, RH, 1, sd * (W / 2 + 1 + (RW - W) / 4), RH / 2, BACK + 0.5, wall);
  if (RH > H) box(W + 2, RH - H, 1, 0, H + (RH - H) / 2, BACK + 0.5, wall, false);
  const roomCeil = new THREE.Mesh(new THREE.PlaneGeometry(RW + 2, R1 - R0 + 1), dark); roomCeil.rotation.x = Math.PI / 2; roomCeil.position.set(0, RH, (R0 + R1) / 2); scene.add(roomCeil);
  const roomPanel = panelLight.clone(); // propio: de noche se atenúa (si no, con la niebla y el resplandor quema la sala)
  for (let z = R0 + 4; z < R1; z += 8) for (const x of [-25, -15, -5, 5, 15, 25]) box(4, 0.06, 1.2, x, RH - 0.04, z, roomPanel, false, false);
  // Franja roja a media altura: aquí se recibe daño
  const danger = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.7 });
  box(0.04, 0.25, R1 - R0, -RW / 2 + 0.03, 1.1, (R0 + R1) / 2, danger, false, false);
  box(0.04, 0.25, R1 - R0, RW / 2 - 0.03, 1.1, (R0 + R1) / 2, danger, false, false);
  box(RW, 0.25, 0.04, 0, 1.1, R1 - 0.03, danger, false, false);
  // Coberturas bajas
  for (const [x, z, w] of [[-7, R0 + 12, 2.4], [7, R0 + 12, 2.4], [0, R0 + 20, 3.2], [-14, R0 + 22, 1.8], [14, R0 + 22, 1.8], [-6, R0 + 32, 2.6], [8, R0 + 34, 2.2], [-17, R0 + 40, 1.6], [16, R0 + 42, 2.4], [0, R0 + 44, 3.4], [-22, R0 + 30, 2], [22, R0 + 28, 2.2], [-12, R0 + 54, 2.6], [12, R0 + 58, 2.4], [-24, R0 + 60, 1.8], [24, R0 + 50, 1.8]]) {
    box(w, 1.0, 1.0, x, 0.5, z, wall); box(w + 0.04, 0.12, 1.04, x, 0.95, z, danger, false, false);
  }
  // Cartel del fondo: por ahí entran los enemigos
  { const m = sign(t("sign.spawn"), "#c8402e", 6, 1.2); m.position.set(0, 3.6, R1 - 0.02); m.rotation.y = Math.PI; scene.add(m); }
  // Marco de la puerta y cartel encima (por los dos lados)
  const frame = new THREE.MeshStandardMaterial({ color: 0xc8402e, roughness: 0.6 });
  box(0.2, DOOR_H, 1.1, -DOOR - 0.1, DOOR_H / 2, BACK + 0.5, frame, false, false); box(0.2, DOOR_H, 1.1, DOOR + 0.1, DOOR_H / 2, BACK + 0.5, frame, false, false);
  box(DOOR * 2 + 0.4, 0.2, 1.1, 0, DOOR_H + 0.1, BACK + 0.5, frame, false, false);
  { const m = sign(t("sign.waves"), "#c8402e", 4, 1); m.position.set(0, DOOR_H + 0.9, BACK - 0.02); m.rotation.y = Math.PI; scene.add(m); }
  const wavesConsole = consoleAt(-4, "WAVES", neonA, R0 + 2.5, Math.PI);
  const WAVES_AT = new THREE.Vector3(-4, 0, R0 + 2.5);

  // ---------- Luz: cálida de mantenimiento con parpadeo, ambiente oscuro y niebla ligera ----------
  scene.add(new THREE.HemisphereLight(0x8a9aa8, 0x2a241c, 1.1));
  const key = new THREE.DirectionalLight(0xd8e2ec, 1.5);
  key.position.set(-10, 20, 12); key.target.position.set(0, 0, -20);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -60, right: 95, top: 80, bottom: -80, near: 1, far: 200 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; // (sin acné de sombra que parpadee al moverse)
  scene.add(key, key.target);
  const lamps: { light: THREE.PointLight; mesh: THREE.Mesh; base: number; phase: number }[] = [];
  const lampMat = () => new THREE.MeshStandardMaterial({ color: WARM, emissive: WARM, emissiveIntensity: 1.6 });
  // 8 luces en total (el número de luces no cambia nunca: cambiarlo recompila todos los shaders)
  for (const [x, z, y] of [[-14, 12, H], [14, 12, H], [0, -8, H], [0, -30, H], [0, -52, H], [0, -72, H], [-10, BACK + 20, RH], [10, BACK + 52, RH]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.3), lampMat()); mesh.position.set(x, y - 0.55, z); scene.add(mesh);
    const light = new THREE.PointLight(WARM, 34, 24, 1.4); light.position.set(x, y - 0.8, z); scene.add(light);
    lamps.push({ light, mesh, base: 34, phase: Math.random() * 10 });
  }
  scene.background = new THREE.Color(0xb9c0c7);
  scene.fog = new THREE.Fog(0xb9c0c7, 90, 200);

  // ---------- Noche: callejón urbano (ver nightcity.ts) ----------
  const city = buildNightCity(scene, { W, FRONT, BACK, H });
  const wallDay = wall.map, floorDay = floor.map;

  // ---------- Día y noche ----------
  const hemi = scene.children.find((o) => o instanceof THREE.HemisphereLight) as THREE.HemisphereLight;
  const lampHome = lamps.map((l) => l.light.position.clone());
  let night = false;
  const setNight = (on: boolean) => {
    night = on;
    city.group.visible = on; for (const o of dayOnly) o.visible = !on;
    wall.map = on ? city.wallMap : wallDay; floor.map = on ? city.floorMap : floorDay;
    // Suelo mojado de noche: más liso (recoge los brillos del neón)
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
    lamps.forEach((l, i) => {
      const sp = city.keyLights[i];
      l.mesh.visible = !on;
      if (on && sp && i < 6) { l.light.position.copy(sp.pos); l.light.color.set(sp.color); l.base = sp.power; l.light.distance = 18; l.light.decay = 1.5; }
      else { l.light.position.copy(lampHome[i]); l.light.color.set(0xfff4e6); l.base = 22; l.light.distance = 24; l.light.decay = 1.4; }
    });
    const bg = on ? 0x1a1430 : 0xb9c0c7; (scene.background as THREE.Color).set(bg);
    scene.fog = new THREE.Fog(on ? 0x2a1f40 : bg, on ? 35 : 70, on ? 130 : 160);
  };
  // Rendimiento: lo estático se fusiona por material (cientos de mallas → unas decenas de llamadas de dibujo). Quedan
  // fuera lo que cambia de visibilidad (noche/día, lámparas) y lo animado (la bandeja del terminal); la ciudad se
  // fusiona dentro de su propio grupo, que se enciende y apaga entero
  const camObj = scene.children.find((o) => (o as THREE.Camera).isCamera);
  mergeStatic(scene, new Set<THREE.Object3D>([city.group, lidPivot, ...dayOnly, ...lamps.map((l) => l.mesh), ...(camObj ? [camObj] : [])]));
  mergeStatic(city.group);
  setNight(true);

  let lastMsg = "";
  return {
    setNight, get night() { return night; },
    colliders, shootables, lanes, chestLid: lidPivot, chestGlow, wavesRoom: { z0: R0 - 0.5, z1: R1 },
    interactables: [
      { id: "chest", position: new THREE.Vector3(-12, 0, 13), radius: 2.2, label: "Terminal", object: chest },
      { id: "workbench", position: new THREE.Vector3(12, 0, 13), radius: 2.4, label: "Banco", object: bench },
      { id: "waves", position: WAVES_AT, radius: 1.8, label: "Oleadas", object: wavesConsole },
      { id: "storage", position: new THREE.Vector3(4, 0, 12.6), radius: 2.0, label: "Almacén", object: storage },
      { id: "contracts", position: new THREE.Vector3(-4, 0, 12.6), radius: 2.0, label: "Contratos", object: ctBoard },
      { id: "raid", position: new THREE.Vector3(W / 2 + 1 + 8, 0, 18), radius: 2.2, label: "Incursión", object: raidPc },
    ],
    update(dt: number, data: RangeData) {
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
