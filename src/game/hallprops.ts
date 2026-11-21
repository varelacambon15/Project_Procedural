// Objetos del hall que dan vida a la zona de inicio (sin luces nuevas: todo lo que brilla es emisivo o aditivo):
//  - Armero de pared: muestra en 3D las 6 primeras armas del almacén; usarlo abre el almacén para elegir cuáles.
//  - Drones de mantenimiento: tres robots pequeños que patrullan, se apartan de tu camino y huyen si les disparas
//    (el asistente sale en su defensa).
//  - Radio: cambia la música (emisoras generadas con Web Audio, la pista de ambiente o apagada).
//  - Máquina de bebidas (bebida energética de pago: más cadencia y velocidad un rato), fuente de agua, tablón de
//    anuncios con consejos y saco de boxeo que se balancea al golpearlo o dispararle.
//  - Decoración: bancos, macetas, cajas, carteles.
import * as THREE from "three";
import { t } from "../i18n";
import { audio, out, setMusicOn } from "./audio";
import { settings } from "./settings";
import type { Item } from "./inventory";
import type { WeaponSpec } from "../weapons/types";

export type HallPropId = "rack" | "radio" | "vending" | "cooler" | "board" | "coffee" | "arcade" | "furniture";
/** Objetos de la tienda de mobiliario (el armero es gratis y no se vende). */
export type FurnId = "rack" | "shop" | "vending" | "cooler" | "board" | "radio" | "bag" | "benches" | "plants" | "crates" | "posters" | "drones"
  | "aquarium" | "tv" | "dartboard" | "neon" | "rug" | "coffee" | "roomba" | "arcade";
export type FurnCat = "fun" | "util" | "life" | "decor";
/** Catálogo: precio, nivel mínimo y categoría (ocio, utilidad, vida, decoración). */
export const FURNITURE: { id: Exclude<FurnId, "rack" | "shop">; price: number; level: number; cat: FurnCat }[] = [
  { id: "plants", price: 150, level: 1, cat: "decor" }, { id: "crates", price: 120, level: 1, cat: "decor" }, { id: "posters", price: 180, level: 1, cat: "decor" },
  { id: "rug", price: 220, level: 1, cat: "decor" }, { id: "benches", price: 250, level: 1, cat: "decor" }, { id: "neon", price: 600, level: 4, cat: "decor" },
  { id: "cooler", price: 150, level: 1, cat: "util" }, { id: "board", price: 200, level: 1, cat: "util" }, { id: "vending", price: 600, level: 3, cat: "util" },
  { id: "coffee", price: 450, level: 2, cat: "util" },
  { id: "radio", price: 400, level: 1, cat: "fun" }, { id: "bag", price: 350, level: 1, cat: "fun" }, { id: "dartboard", price: 300, level: 2, cat: "fun" },
  { id: "tv", price: 700, level: 3, cat: "fun" }, { id: "arcade", price: 900, level: 5, cat: "fun" },
  { id: "drones", price: 900, level: 3, cat: "life" }, { id: "aquarium", price: 1200, level: 4, cat: "life" }, { id: "roomba", price: 1100, level: 4, cat: "life" },
];
interface FItem { group: THREE.Group; boxes: THREE.Box3[]; shoot: THREE.Object3D[]; props: HallProp[]; on: boolean }
export interface HallProp { id: HallPropId; position: THREE.Vector3; radius: number; label: string; object: THREE.Object3D }
export interface HallHooks {
  assemble(spec: WeaponSpec): Promise<{ group: THREE.Object3D }>;
  /** Las armas del armero (las 6 primeras del almacén). */ rackItems(): (Item | null)[];
  openStorage(): void;
  toast(s: string): void;
  /** Cobra `n` créditos (false si no llega). */ spend(n: number): boolean;
  /** Efecto de la bebida energética (segundos). */ drink(sec: number): void;
  /** Un dron ha recibido un tiro (el asistente protesta). */ droneShot(): void;
  /** Café: recarga las cargas del equipamiento. */ coffee(): void;
  /** Frase corta con voz (el robot aspirador). */ say(text: string): void;
  /** Sonido corto sintetizado. */ beep?(f: number, len: number): void;
}

const DRINK_PRICE = 15, DRINK_SEC = 60, COFFEE_PRICE = 10;
const STATIONS = ["ambient", "neon", "pulse", "off"] as const;
type Station = (typeof STATIONS)[number];

export class HallProps {
  readonly props: HallProp[] = [];
  private items = new Map<FurnId, FItem>();
  private shootables: THREE.Object3D[] = [];
  private fish: { m: THREE.Mesh; a: number; r: number; y: number; sp: number }[] = [];
  private tvCv = document.createElement("canvas"); private tvTex: THREE.CanvasTexture | null = null; private tvT = 0;
  private neonMats: THREE.MeshBasicMaterial[] = [];
  private arcadeCv = document.createElement("canvas"); private arcadeTex: THREE.CanvasTexture | null = null;
  private roomba: { g: THREE.Group; brushes: THREE.Object3D[]; led: THREE.MeshBasicMaterial; dir: number; turn: number; hurt: number; dust: { m: THREE.Mesh; t: number }[] } | null = null;
  private dartCenter = new THREE.Vector3();
  private rackSlots: { at: THREE.Vector3; uid: number | null; obj: THREE.Object3D | null }[] = [];
  private drones: { g: THREE.Group; eye: THREE.Mesh; target: THREE.Vector3; flee: number; vel: THREE.Vector3; phase: number }[] = [];
  private bag = { pivot: new THREE.Group(), ang: new THREE.Vector2(), vel: new THREE.Vector2() };
  private radioCv = document.createElement("canvas"); private radioTex: THREE.CanvasTexture; private speaker!: THREE.Mesh;
  private station: Station = "ambient"; private beatT = 0; private nextNote = 0; private step = 0; private radioGain: GainNode | null = null;
  private time = 0; private lastPlayer = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private colliders: THREE.Box3[], shootables: THREE.Object3D[], private hooks: HallHooks) {
    // Cada objeto se construye en su propio grupo (con sus colisiones, blancos y puntos de uso) y solo se añade al hall
    // si está comprado en la tienda de mobiliario (`apply`); el armero es gratis.
    let into: THREE.Object3D = scene, cBoxes: THREE.Box3[] = [], cShoot: THREE.Object3D[] = [], cProps: HallProp[] = this.props;
    const begin = (id: FurnId) => { const it: FItem = { group: new THREE.Group(), boxes: [], shoot: [], props: [], on: false }; this.items.set(id, it); into = it.group; cBoxes = it.boxes; cShoot = it.shoot; cProps = it.props; };
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.6, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23282e, metalness: 0.4, roughness: 0.55 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8 });
    const glowC = new THREE.MeshBasicMaterial({ color: 0x7fe6ff }), glowA = new THREE.MeshBasicMaterial({ color: 0xffb040 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D, collide = false) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; (parent ?? into).add(b);
      if (collide) { b.updateWorldMatrix(true, false); cBoxes.push(new THREE.Box3().setFromObject(b)); }
      return b;
    };
    const canvasPlane = (w: number, h: number, px: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void) => {
      const cv = document.createElement("canvas"); cv.width = px; cv.height = Math.round((px * h) / w); draw(cv.getContext("2d")!, cv.width, cv.height);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
    };
    const label = (text: string, color: string) => canvasPlane(2.2, 0.36, 512, (c, W, H) => { c.fillStyle = "#11161b"; c.fillRect(0, 0, W, H); c.fillStyle = color; c.fillRect(0, 0, W, 6); c.fillStyle = "#e8eef2"; c.font = "bold 44px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, W / 2, H / 2 + 3); });

    begin("rack");
    // ---------- Armero (pared izquierda, z ≈ 7,5): panel perforado con 6 huecos ----------
    {
      const g = new THREE.Group(); g.position.set(-23.95, 0, 7.5); g.rotation.y = Math.PI / 2; into.add(g); g.updateMatrixWorld(true);
      box(4.4, 2.6, 0.08, 0, 1.95, 0.04, dark, g);
      box(4.6, 0.1, 0.18, 0, 3.3, 0.09, steel, g); box(4.6, 0.1, 0.18, 0, 0.6, 0.09, steel, g);
      box(0.06, 2.6, 0.04, -2.25, 1.95, 0.1, glowC, g); box(0.06, 2.6, 0.04, 2.25, 1.95, 0.1, glowC, g);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const lx = (c - 1) * 1.42, ly = 2.6 - r * 1.15;
        box(0.9, 0.04, 0.12, lx, ly - 0.32, 0.12, steel, g); // repisa del hueco
        for (const s of [-0.38, 0.38]) box(0.04, 0.12, 0.14, lx + s, ly - 0.26, 0.16, steel, g); // ganchos
        const at = new THREE.Vector3(lx, ly, 0.22); g.localToWorld(at); this.rackSlots.push({ at, uid: null, obj: null });
      }
      const sg = label(t("hb.rack"), "#e0a030"); sg.position.set(0, 3.6, 0.1); g.add(sg);
      cProps.push({ id: "rack", position: new THREE.Vector3(-22.6, 0, 7.5), radius: 3, label: "rack", object: g });
    }

    // ---------- Pared frontal (z = 0): máquina de bebidas, fuente de agua, tablón y radio ----------
    {
      begin("vending");
      // Máquina de bebidas
      const v = new THREE.Group(); v.position.set(-8, 0, 0.5); into.add(v);
      box(1.3, 2.1, 0.9, 0, 1.05, 0, new THREE.MeshStandardMaterial({ color: 0xb8342e, metalness: 0.3, roughness: 0.5 }), v);
      const front = canvasPlane(1.0, 1.5, 256, (c, W, H) => {
        c.fillStyle = "#0b1218"; c.fillRect(0, 0, W, H); const cols = ["#ff5050", "#40d0ff", "#f2c040", "#7aff8a"];
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { c.fillStyle = cols[(r + k) % 4]; c.fillRect(22 + k * 56, 24 + r * 70, 34, 52); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(26 + k * 56, 28 + r * 70, 6, 44); }
        c.fillStyle = "#f2f2ee"; c.font = "bold 30px monospace"; c.textAlign = "center"; c.fillText(`${DRINK_PRICE} CR`, W / 2, H - 22);
      });
      front.position.set(-0.1, 1.25, 0.46); v.add(front);
      box(0.18, 0.5, 0.04, 0.5, 1.3, 0.46, glowA, v); box(0.8, 0.18, 0.06, -0.1, 0.32, 0.46, dark, v);
      cBoxes.push(new THREE.Box3(new THREE.Vector3(-8.7, 0, 0), new THREE.Vector3(-7.3, 2.1, 1)));
      cProps.push({ id: "vending", position: new THREE.Vector3(-8, 0, 1.4), radius: 2, label: "vending", object: v });
      begin("cooler");
      // Fuente de agua
      const w = new THREE.Group(); w.position.set(-5.8, 0, 0.35); into.add(w);
      box(0.5, 1.0, 0.45, 0, 0.5, 0, new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6 }), w);
      const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 18), new THREE.MeshStandardMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.55, roughness: 0.1 }));
      jug.position.y = 1.27; w.add(jug);
      cBoxes.push(new THREE.Box3(new THREE.Vector3(-6.1, 0, 0), new THREE.Vector3(-5.5, 1.5, 0.6)));
      cProps.push({ id: "cooler", position: new THREE.Vector3(-5.8, 0, 1.2), radius: 1.6, label: "cooler", object: w });
      begin("board");
      // Tablón de anuncios
      const b = new THREE.Group(); b.position.set(0, 0, 0.03); into.add(b);
      box(3.2, 1.7, 0.05, 0, 2.1, 0, wood, b);
      box(3.0, 1.5, 0.02, 0, 2.1, 0.035, new THREE.MeshStandardMaterial({ color: 0xb89466, roughness: 0.95 }), b);
      const notes: [number, number, number, string, string][] = [[-1.05, 2.45, -0.06, "#f8f0c8", t("hb.note.0")], [0, 2.4, 0.04, "#cfe8ff", t("hb.note.1")], [1.0, 2.5, -0.03, "#ffd6d6", t("hb.note.2")], [-0.6, 1.75, 0.05, "#e0ffd8", t("hb.note.3")], [0.7, 1.75, -0.05, "#f8f0c8", t("hb.note.4")]];
      for (const [x, y, rot, col, txt] of notes) {
        const n = canvasPlane(0.78, 0.55, 220, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = "#2a2a2a"; c.font = "bold 20px sans-serif"; c.textAlign = "center"; wrapText(c, txt, W / 2, 34, W - 18, 24); c.fillStyle = "#d33"; c.beginPath(); c.arc(W / 2, 8, 6, 0, Math.PI * 2); c.fill(); });
        n.position.set(x, y, 0.05); n.rotation.z = rot; b.add(n);
      }
      cProps.push({ id: "board", position: new THREE.Vector3(0, 0, 1.4), radius: 2.2, label: "board", object: b });
      begin("radio");
      // Radio sobre una mesita
      const r = new THREE.Group(); r.position.set(8, 0, 0.55); into.add(r);
      box(1.4, 0.06, 0.7, 0, 0.8, 0, wood, r); for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) box(0.05, 0.8, 0.05, x, 0.4, z, steel, r);
      box(0.8, 0.42, 0.3, 0, 1.04, 0, new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.5, roughness: 0.4 }), r);
      this.speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), dark); this.speaker.rotation.x = Math.PI / 2; this.speaker.position.set(-0.2, 1.04, 0.16); r.add(this.speaker);
      this.radioCv.width = 192; this.radioCv.height = 64; this.radioTex = new THREE.CanvasTexture(this.radioCv); this.radioTex.colorSpace = THREE.SRGBColorSpace;
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: this.radioTex, toneMapped: false })); disp.position.set(0.17, 1.1, 0.152); r.add(disp);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6), steel); ant.position.set(0.32, 1.5, -0.08); ant.rotation.z = -0.4; r.add(ant);
      cBoxes.push(new THREE.Box3(new THREE.Vector3(7.3, 0, 0.2), new THREE.Vector3(8.7, 1.25, 0.9)));
      cProps.push({ id: "radio", position: new THREE.Vector3(8, 0, 1.5), radius: 2, label: "radio", object: r });
      this.drawRadio();
    }

    begin("bag");
    // ---------- Saco de boxeo (colgado del techo, cerca de la puerta sellada) ----------
    {
      const p = this.bag.pivot; p.position.set(-18, 7.3, 24.5); into.add(p);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.6), steel); chain.position.y = -2.3; p.add(chain);
      const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 1.35, 20), new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }));
      sack.position.y = -5.3; sack.castShadow = true; p.add(sack);
      for (const y of [-4.75, -5.85]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 20), dark); band.position.y = y; p.add(band); }
      sack.userData.onShot = () => this.hitBag(1); cShoot.push(sack);
      cBoxes.push(new THREE.Box3(new THREE.Vector3(-18.35, 1.3, 24.15), new THREE.Vector3(-17.65, 2.7, 24.85)));
    }

    // ---------- Decoración: bancos, macetas, cajas y carteles ----------
    begin("benches");
    for (const x of [-4.5, 4.5]) {
      const g = new THREE.Group(); g.position.set(x, 0, 22.5); into.add(g);
      box(2.4, 0.08, 0.5, 0, 0.46, 0, wood, g); box(2.4, 0.4, 0.06, 0, 0.75, -0.24, wood, g);
      for (const s of [-1, 1]) box(0.06, 0.46, 0.45, s * 1.05, 0.23, 0, steel, g);
      cBoxes.push(new THREE.Box3(new THREE.Vector3(x - 1.2, 0, 22.2), new THREE.Vector3(x + 1.2, 0.5, 22.8)));
    }
    begin("plants");
    for (const [x, z] of [[-22.6, 1.6], [22.6, 1.6], [-22.6, 26.6], [22.6, 26.6], [-14, 1.2], [14, 1.2]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 14), new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.7 })); pot.position.set(x, 0.3, z); pot.castShadow = true; into.add(pot);
      const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a42, roughness: 0.8 });
      for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + (i % 3) * 0.25, 5), leaf); const a = (i / 7) * Math.PI * 2; l.position.set(x + Math.cos(a) * 0.1, 0.95, z + Math.sin(a) * 0.1); l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); into.add(l); }
      cBoxes.push(new THREE.Box3(new THREE.Vector3(x - 0.35, 0, z - 0.35), new THREE.Vector3(x + 0.35, 0.6, z + 0.35)));
    }
    {
      begin("crates");
      const crate = new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.75 }), strap = new THREE.MeshStandardMaterial({ color: 0xd08a2a, roughness: 0.6 });
      for (const [x, y, z, s] of [[19.6, 0.45, 25.4, 0.9], [20.6, 0.45, 25.6, 0.9], [20.1, 1.25, 25.5, 0.7], [18.6, 0.35, 26.2, 0.7]] as const) {
        box(s, s, s, x, y, z, crate); box(s + 0.01, 0.08, s + 0.01, x, y, z, strap);
        cBoxes.push(new THREE.Box3(new THREE.Vector3(x - s / 2, y - s / 2, z - s / 2), new THREE.Vector3(x + s / 2, y + s / 2, z + s / 2)));
      }
    }
    const poster = (title: string, sub: string, col: string, x: number, z: number, ry: number) => {
      const m = canvasPlane(1.4, 2.0, 280, (c, W, H) => {
        const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col); gr.addColorStop(1, "#10151a"); c.fillStyle = gr; c.fillRect(0, 0, W, H);
        c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(W / 2, H * 0.42, 30 + i * 18, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = "#fff"; c.font = "bold 34px monospace"; c.textAlign = "center"; wrapText(c, title, W / 2, H * 0.74, W - 20, 36);
        c.font = "18px monospace"; c.fillStyle = "rgba(255,255,255,.75)"; wrapText(c, sub, W / 2, H * 0.9, W - 20, 20);
      });
      m.position.set(x, 2.3, z); m.rotation.y = ry; into.add(m);
    };
    begin("posters");
    poster(t("hb.poster.0"), t("hb.poster.0s"), "#2a6a9a", -23.96, 14.5, Math.PI / 2);
    poster(t("hb.poster.1"), t("hb.poster.1s"), "#9a3a2a", 23.96, 24.5, -Math.PI / 2);
    poster(t("hb.poster.2"), t("hb.poster.2s"), "#3a7a4a", -16, 0.03, 0);
    poster(t("hb.poster.3"), t("hb.poster.3s"), "#6a3a9a", 16, 0.03, 0);

    begin("drones");
    // ---------- Drones de mantenimiento ----------
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.4, roughness: 0.35 }));
      body.scale.y = 0.75; g.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), dark); ring.rotation.x = Math.PI / 2; g.add(ring);
      for (let k = 0; k < 4; k++) { const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.4 })); const a = (k * Math.PI) / 2; rotor.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3); g.add(rotor); }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fe6ff })); eye.position.set(0, 0, 0.2); g.add(eye);
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4), steel); brush.position.set(0, -0.3, 0); g.add(brush);
      g.position.set(-10 + i * 10, 1.4, 18 - i * 4); into.add(g);
      body.userData.onShot = () => this.droneHit(d); cShoot.push(body);
      const d = { g, eye, target: this.randomSpot(), flee: 0, vel: new THREE.Vector3(), phase: Math.random() * 6 };
      this.drones.push(d);
    }
      this.buildExtras(begin, () => into, (b) => cBoxes.push(b), (o) => cShoot.push(o), (p) => cProps.push(p), { steel, dark, wood, box, canvasPlane });
    this.shootables = shootables;
    this.apply(new Set());
  }

  /** Pone en el hall lo comprado y quita lo demás (con sus colisiones, blancos y puntos de uso). */
  apply(owned: Set<string>) {
    for (const [id, it] of this.items) {
      const on = id === "rack" || id === "shop" || owned.has(id);
      if (on === it.on) continue; it.on = on;
      if (on) { this.scene.add(it.group); this.colliders.push(...it.boxes); this.shootables.push(...it.shoot); }
      else {
        this.scene.remove(it.group);
        for (const b of it.boxes) { const i = this.colliders.indexOf(b); if (i >= 0) this.colliders.splice(i, 1); }
        for (const o of it.shoot) { const i = this.shootables.indexOf(o); if (i >= 0) this.shootables.splice(i, 1); }
        if (id === "radio" && this.station !== "ambient") { this.station = "off"; this.nextStation(true); }
      }
    }
  }
  owned(id: FurnId) { return !!this.items.get(id)?.on; }
  /** Puntos de uso de lo que está en el hall. */
  activeProps() { const out: HallProp[] = []; for (const it of this.items.values()) if (it.on) out.push(...it.props); return out; }

  // ---------- Objetos nuevos de la tienda ----------
  private buildExtras(begin: (id: FurnId) => void, into: () => THREE.Object3D, addBox: (b: THREE.Box3) => void, addShoot: (o: THREE.Object3D) => void, addProp: (p: HallProp) => void,
    k: { steel: THREE.Material; dark: THREE.Material; wood: THREE.Material; box: (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D) => THREE.Mesh; canvasPlane: (w: number, h: number, px: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void) => THREE.Mesh }) {
    const { steel, dark, wood, box, canvasPlane } = k;
    // Terminal de la tienda de mobiliario (gratis; pared derecha, cerca de la entrada)
    begin("shop");
    {
      const g = new THREE.Group(); g.position.set(23.35, 0, 4.2); g.rotation.y = -Math.PI / 2; into().add(g);
      box(1.1, 1.0, 0.6, 0, 0.5, 0, new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 0.6 }), g);
      box(1.0, 0.7, 0.08, 0, 1.4, -0.18, dark, g);
      const sc = canvasPlane(0.9, 0.6, 256, (c, W, H) => { c.fillStyle = "#0e1a12"; c.fillRect(0, 0, W, H); c.fillStyle = "#7aff9a"; c.font = "bold 24px monospace"; c.textAlign = "center"; c.fillText(t("fs.screen1"), W / 2, 50); c.font = "18px monospace"; c.fillText(t("fs.screen2"), W / 2, 90); c.fillStyle = "#f2c040"; c.font = "54px sans-serif"; c.fillText("🛋", W / 2, 152); });
      sc.position.set(0, 1.4, -0.135); g.add(sc);
      const lab = canvasPlane(2.0, 0.34, 512, (c, W, H) => { c.fillStyle = "#11161b"; c.fillRect(0, 0, W, H); c.fillStyle = "#7aff9a"; c.fillRect(0, 0, W, 6); c.fillStyle = "#e8eef2"; c.font = "bold 44px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(t("fs.sign"), W / 2, H / 2 + 3); });
      lab.position.set(0, 2.2, -0.2); g.add(lab);
      addBox(new THREE.Box3(new THREE.Vector3(23, 0, 3.6), new THREE.Vector3(23.9, 1.8, 4.8)));
      addProp({ id: "furniture", position: new THREE.Vector3(22.2, 0, 4.2), radius: 2, label: "furniture", object: g });
    }
    // Acuario holográfico (pared del fondo, a la izquierda de la puerta del campo de tiro)
    begin("aquarium");
    {
      const g = new THREE.Group(); g.position.set(-10, 0, 27.4); into().add(g);
      box(2.6, 0.8, 0.8, 0, 0.4, 0, wood, g);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 0.7), new THREE.MeshBasicMaterial({ color: 0x2a8ad8, transparent: true, opacity: 0.22, depthWrite: false })); glass.position.y = 1.42; g.add(glass);
      box(2.6, 0.06, 0.8, 0, 2.05, 0, dark, g);
      const sand = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.08, 0.65), new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 1 })); sand.position.y = 0.86; g.add(sand);
      const cols = [0xff9a40, 0x7fe6ff, 0xff5aa0, 0xf2e040, 0x9aff7a];
      for (let i = 0; i < 9; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        f.rotation.z = Math.PI / 2; g.add(f); this.fish.push({ m: f, a: Math.random() * 6, r: 0.4 + Math.random() * 0.7, y: 1.05 + Math.random() * 0.75, sp: 0.4 + Math.random() * 0.6 });
      }
      for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4 + Math.random() * 0.3, 4), new THREE.MeshStandardMaterial({ color: 0x3f9a52 })); w.position.set(-1 + i * 0.5, 1.05, -0.15); g.add(w); }
      addBox(new THREE.Box3(new THREE.Vector3(-11.3, 0, 27), new THREE.Vector3(-8.7, 2.1, 27.9)));
    }
    // Televisor con noticias de la simulación (pared del fondo, a la derecha de la puerta)
    begin("tv");
    {
      const g = new THREE.Group(); g.position.set(10, 3.2, 27.9); g.rotation.y = Math.PI; into().add(g);
      box(3.0, 1.75, 0.1, 0, 0, -0.05, dark, g);
      this.tvCv.width = 512; this.tvCv.height = 288; this.tvTex = new THREE.CanvasTexture(this.tvCv); this.tvTex.colorSpace = THREE.SRGBColorSpace;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 1.6), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false })); sc.position.z = 0.01; g.add(sc);
    }
    // Diana de dardos (pared izquierda, z = 17): dispara o golpea y te da la puntuación
    begin("dartboard");
    {
      const g = new THREE.Group(); g.position.set(-23.93, 1.75, 17); g.rotation.y = Math.PI / 2; into().add(g);
      const face = canvasPlane(0.9, 0.9, 256, (c, W) => {
        const r = W / 2; const rings = ["#1a1a1a", "#e8dcc0", "#c8302a", "#e8dcc0", "#2a8a3a", "#c8302a"];
        for (let i = 0; i < 6; i++) { c.fillStyle = rings[i]; c.beginPath(); c.arc(r, r, r * (1 - i * 0.16), 0, Math.PI * 2); c.fill(); }
        c.strokeStyle = "rgba(0,0,0,.4)"; for (let a = 0; a < 20; a++) { c.beginPath(); c.moveTo(r, r); c.lineTo(r + Math.cos((a * Math.PI) / 10) * r, r + Math.sin((a * Math.PI) / 10) * r); c.stroke(); }
      });
      face.position.z = 0.03; g.add(face);
      const back = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), wood); back.rotation.x = Math.PI / 2; g.add(back);
      g.updateMatrixWorld(true); this.dartCenter.setFromMatrixPosition(g.matrixWorld);
      face.userData.onShot = (pt?: THREE.Vector3) => this.dart(pt); addShoot(face);
    }
    // Rótulo de neón (pared del fondo, encima del acuario): tubos emisivos que parpadean de vez en cuando
    begin("neon");
    {
      const g = new THREE.Group(); g.position.set(-10, 4.4, 27.92); g.rotation.y = Math.PI; into().add(g);
      const sign = canvasPlane(4, 1, 512, (c, W, H) => { c.clearRect(0, 0, W, H); c.font = "bold 84px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "#ff3aa0"; c.shadowBlur = 24; c.fillStyle = "#ffd0ec"; c.fillText("PROVING", W / 2, H * 0.32); c.shadowColor = "#3ad8ff"; c.fillStyle = "#d0f6ff"; c.fillText("GROUNDS", W / 2, H * 0.78); });
      const m = sign.material as THREE.MeshBasicMaterial; m.transparent = true; m.blending = THREE.AdditiveBlending; m.depthWrite = false; this.neonMats.push(m); g.add(sign);
    }
    // Alfombra grande en el centro del hall
    begin("rug");
    {
      const rug = canvasPlane(7, 4, 512, (c, W, H) => { c.fillStyle = "#3a2a4a"; c.fillRect(0, 0, W, H); c.strokeStyle = "#d8a84a"; c.lineWidth = 10; c.strokeRect(14, 14, W - 28, H - 28); c.lineWidth = 3; c.strokeRect(34, 34, W - 68, H - 68); c.fillStyle = "#7a4a8a"; for (let i = 0; i < 6; i++) { c.save(); c.translate(W / 2, H / 2); c.rotate((i * Math.PI) / 3); c.fillRect(-6, -90, 12, 180); c.restore(); } c.fillStyle = "#d8a84a"; c.beginPath(); c.arc(W / 2, H / 2, 30, 0, Math.PI * 2); c.fill(); });
      (rug.material as THREE.MeshBasicMaterial).toneMapped = true; rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.011, 18); into().add(rug);
    }
    // Cafetera (pared frontal, junto a la máquina de bebidas): el café recarga el equipamiento al momento
    begin("coffee");
    {
      const g = new THREE.Group(); g.position.set(-11, 0, 0.4); into().add(g);
      box(1.0, 0.95, 0.6, 0, 0.475, 0, wood, g);
      box(0.5, 0.6, 0.4, 0, 1.25, -0.02, new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.7, roughness: 0.3 }), g);
      box(0.08, 0.06, 0.04, 0.12, 1.42, 0.2, new THREE.MeshBasicMaterial({ color: 0x7aff8a }), g);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0xf2f2ee })); cup.position.set(0, 1.0, 0.1); g.add(cup);
      addBox(new THREE.Box3(new THREE.Vector3(-11.5, 0, 0.1), new THREE.Vector3(-10.5, 1.55, 0.7)));
      addProp({ id: "coffee", position: new THREE.Vector3(-11, 0, 1.4), radius: 1.6, label: "coffee", object: g });
    }
    // Máquina recreativa (pared derecha, al fondo): pantalla con demo animada
    begin("arcade");
    {
      const g = new THREE.Group(); g.position.set(23.4, 0, 21.5); g.rotation.y = -Math.PI / 2; into().add(g);
      box(0.9, 1.9, 0.8, 0, 0.95, 0, new THREE.MeshStandardMaterial({ color: 0x2a3a8a, roughness: 0.5 }), g);
      box(0.92, 0.25, 0.82, 0, 2.0, 0, new THREE.MeshBasicMaterial({ color: 0xff5aa0 }), g);
      box(0.8, 0.12, 0.35, 0, 1.05, 0.5, dark, g);
      this.arcadeCv.width = 160; this.arcadeCv.height = 128; this.arcadeTex = new THREE.CanvasTexture(this.arcadeCv); this.arcadeTex.magFilter = THREE.NearestFilter;
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.53), new THREE.MeshBasicMaterial({ map: this.arcadeTex, toneMapped: false })); sc.position.set(0, 1.5, 0.405); sc.rotation.x = -0.15; g.add(sc);
      addBox(new THREE.Box3(new THREE.Vector3(23, 0, 21), new THREE.Vector3(23.9, 2.1, 22)));
      addProp({ id: "arcade", position: new THREE.Vector3(22.3, 0, 21.5), radius: 1.8, label: "arcade", object: g });
    }
    // Robot aspirador: un disco que recorre el hall aspirando (rebota al tocar algo y cambia de rumbo); si le
    // disparas dice «¡Ay!», da vueltas sobre sí mismo y su luz se pone roja un momento
    begin("roomba");
    {
      const g = new THREE.Group(); g.position.set(-3, 0, 16); into().add(g);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.09, 28), new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.4, roughness: 0.35 })); shell.position.y = 0.06; g.add(shell);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.01, 28), new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.5, roughness: 0.3 })); top.position.y = 0.11; g.add(top);
      const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.015, 6, 28, Math.PI), new THREE.MeshStandardMaterial({ color: 0x15171a })); bumper.rotation.x = Math.PI / 2; bumper.position.y = 0.06; g.add(bumper);
      const led = new THREE.MeshBasicMaterial({ color: 0x7aff9a }); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 12), led); l.position.set(0, 0.118, 0.1); g.add(l);
      const brushes: THREE.Object3D[] = [];
      for (const s2 of [-1, 1]) { const br = new THREE.Group(); br.position.set(s2 * 0.15, 0.015, 0.15); for (let k2 = 0; k2 < 3; k2++) { const bristle = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.005, 0.01), steel); bristle.rotation.y = (k2 * Math.PI) / 3; br.add(bristle); } g.add(br); brushes.push(br); }
      this.roomba = { g, brushes, led, dir: Math.random() * Math.PI * 2, turn: 0, hurt: 0, dust: [] };
      shell.userData.onShot = () => this.roombaHit(); addShoot(shell); top.userData.onShot = () => this.roombaHit(); addShoot(top);
    }
  }
  private dart(pt?: THREE.Vector3) {
    if (!pt) return; const d = pt.distanceTo(this.dartCenter), r = 0.45;
    const score = d < r * 0.08 ? 50 : d < r * 0.2 ? 25 : d < r * 0.5 ? 15 : d < r * 0.75 ? 10 : d < r ? 5 : 0;
    this.hooks.toast(score >= 50 ? t("hb.dartBull") : score ? t("hb.dart", { n: score }) : t("hb.dartMiss")); this.hooks.beep?.(score >= 50 ? 1200 : 700, 0.08);
  }

  // ---------- Interacción ----------
  interact(id: HallPropId) {
    if (id === "rack") this.hooks.openStorage();
    else if (id === "radio") this.nextStation();
    else if (id === "vending") {
      if (!this.hooks.spend(DRINK_PRICE)) { this.hooks.toast(t("hb.noCredits", { c: DRINK_PRICE })); return; }
      this.hooks.drink(DRINK_SEC); this.hooks.toast(t("hb.drink", { s: DRINK_SEC })); this.hooks.beep?.(520, 0.12);
    } else if (id === "cooler") { this.hooks.toast(t(`hb.water.${Math.floor(Math.random() * 3)}`)); this.hooks.beep?.(300, 0.25); }
    else if (id === "board") this.hooks.toast(t(`hb.tip.${Math.floor(Math.random() * 6)}`));
    else if (id === "coffee") {
      if (!this.hooks.spend(COFFEE_PRICE)) { this.hooks.toast(t("hb.noCredits", { c: COFFEE_PRICE })); return; }
      this.hooks.coffee(); this.hooks.toast(t("hb.coffee")); this.hooks.beep?.(420, 0.2);
    } else if (id === "arcade") this.hooks.toast(t(`hb.arcade.${Math.floor(Math.random() * 3)}`, { n: 1000 + Math.floor(Math.random() * 90) * 100 }));
  }
  prompt(id: HallPropId) { return t(`hb.use.${id}`, { c: id === "coffee" ? COFFEE_PRICE : DRINK_PRICE, s: t(`hb.st.${this.station}`) }); }
  /** Golpe al saco (puñetazo o tiro): se balancea. */
  hitBag(force: number) {
    const p = this.bag.pivot.position, dir = new THREE.Vector2(p.x - this.lastPlayer.x, p.z - this.lastPlayer.z).normalize();
    this.bag.vel.addScaledVector(dir, 0.9 * force);
  }

  update(dt: number, player: THREE.Vector3, inHall: boolean) {
    this.time += dt; this.lastPlayer.copy(player);
    this.syncRack();
    // Saco: péndulo amortiguado (ángulos en x/z)
    const b = this.bag; b.vel.addScaledVector(b.ang, -dt * 4.2); b.vel.multiplyScalar(Math.exp(-dt * 0.7)); b.ang.addScaledVector(b.vel, dt);
    b.pivot.rotation.set(b.ang.y, 0, -b.ang.x);
    // Puñetazo al saco: si el jugador está pegado al saco y le golpea, lo hace main (hitBag)
    if (this.owned("drones")) for (const d of this.drones) this.droneTick(d, dt, player, inHall);
    if (this.owned("aquarium")) for (const f of this.fish) { f.a += dt * f.sp; f.m.position.set(Math.cos(f.a) * f.r, f.y + Math.sin(f.a * 2.3) * 0.05, Math.sin(f.a) * 0.22); f.m.rotation.y = -f.a; }
    if (this.owned("neon")) { const flick = Math.random() < 0.01 ? 0.25 : 1; for (const m of this.neonMats) m.opacity = flick * (0.85 + Math.sin(this.time * 3) * 0.05); }
    if (this.owned("tv")) this.drawTv(dt);
    if (this.owned("arcade")) this.drawArcade();
    if (this.owned("roomba") && this.roomba) this.roombaTick(dt);
    this.radioTick(dt);
  }
  /** ¿El jugador está junto al saco? (para que los puñetazos lo muevan). */
  nearBag(p: THREE.Vector3) { const q = this.bag.pivot.position; return Math.hypot(p.x - q.x, p.z - q.z) < 1.4; }

  // ---------- Televisor, recreativa y mascota ----------
  private drawTv(dt: number) {
    this.tvT += dt; if (!this.tvTex) return; if (Math.floor(this.tvT * 10) === Math.floor((this.tvT - dt) * 10)) return;
    const c = this.tvCv.getContext("2d")!, W = 512, H = 288;
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0a2a4a"); g.addColorStop(1, "#1a0a3a"); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = "#c8302a"; c.fillRect(20, 20, 150, 34); c.fillStyle = "#fff"; c.font = "bold 22px sans-serif"; c.fillText(t("hb.tvLive"), 32, 44);
    const k = Math.floor(this.tvT / 7) % 5; c.font = "bold 30px sans-serif"; c.fillStyle = "#fff"; wrapText(c, t(`hb.news.${k}`), 24, 110, W - 48, 36);
    c.fillStyle = "rgba(0,0,0,.6)"; c.fillRect(0, H - 40, W, 40); c.fillStyle = "#f2c040"; c.font = "bold 20px monospace";
    const tick = t("hb.ticker"), w = c.measureText(tick).width, x = W - ((this.tvT * 90) % (w + W)); c.fillText(tick, x, H - 14);
    this.tvTex.needsUpdate = true;
  }
  private drawArcade() {
    if (!this.arcadeTex || Math.floor(this.time * 12) === Math.floor((this.time - 1 / 60) * 12)) return;
    const c = this.arcadeCv.getContext("2d")!, W = 160, H = 128, tt = this.time;
    c.fillStyle = "#05050c"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#3ad8ff"; for (let i = 0; i < 20; i++) c.fillRect((i * 37 + tt * 40) % W, (i * 53) % H, 1, 1);
    const sx = W / 2 + Math.sin(tt * 1.5) * 50; c.fillStyle = "#7aff8a"; c.fillRect(sx - 6, H - 18, 12, 6); c.fillRect(sx - 2, H - 22, 4, 4);
    c.fillStyle = "#ff5aa0"; for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) c.fillRect(20 + k * 22 + Math.sin(tt * 2) * 8, 14 + r * 14, 10, 8);
    c.fillStyle = "#f2f2ee"; if (Math.floor(tt * 2) % 2) c.fillRect(sx, H - 40 - ((tt * 120) % 60), 1, 6);
    c.font = "8px monospace"; c.fillStyle = "#f2c040"; c.fillText("INSERT CR", W / 2 - 22, H - 2);
    this.arcadeTex.needsUpdate = true;
  }
  private roombaHit() {
    const r = this.roomba; if (!r) return;
    const first = r.hurt <= 0; r.hurt = 1.6; r.turn = 1.6; r.led.color.set(0xff3030); this.hooks.beep?.(1600, 0.06);
    if (first) this.hooks.say(t(`hb.ouch.${Math.floor(Math.random() * 4)}`));
  }
  private roombaTick(dt: number) {
    const r = this.roomba!, pos = r.g.position;
    r.hurt = Math.max(0, r.hurt - dt); if (r.hurt <= 0) r.led.color.set(0x7aff9a);
    for (const b of r.brushes) b.rotation.y += dt * 18;
    if (r.turn > 0) { r.turn -= dt; r.g.rotation.y += dt * (r.hurt > 0 ? 9 : 2.4); r.dir = r.g.rotation.y; }
    else {
      // Avanza recto; al chocar (mueble, pared) gira un ángulo al azar, como los de verdad
      const sp = 0.55, nx = pos.x + Math.sin(r.dir) * sp * dt, nz = pos.z + Math.cos(r.dir) * sp * dt;
      const blocked = nx < -23.2 || nx > 23.2 || nz < 0.8 || nz > 27.2 || this.colliders.some((b) => nx > b.min.x - 0.25 && nx < b.max.x + 0.25 && nz > b.min.z - 0.25 && nz < b.max.z + 0.25 && b.min.y < 0.15);
      if (blocked) { r.turn = 0.5 + Math.random() * 1.2; r.dir += Math.PI * (0.5 + Math.random()); } else { pos.x = nx; pos.z = nz; r.g.rotation.y = r.dir; }
    }
    // Rastro: marcas limpias en el suelo que se desvanecen (se ve por dónde ha aspirado)
    if (Math.random() < dt * 6) {
      const m = new THREE.Mesh(this.dustGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.013, pos.z); this.scene.add(m); r.dust.push({ m, t: 6 });
    }
    for (const d of [...r.dust]) { d.t -= dt; (d.m.material as THREE.MeshBasicMaterial).opacity = 0.12 * Math.max(0, d.t / 6); if (d.t <= 0) { this.scene.remove(d.m); (d.m.material as THREE.Material).dispose(); r.dust.splice(r.dust.indexOf(d), 1); } }
  }
  private dustGeo = new THREE.CircleGeometry(0.2, 16);

  // ---------- Armero ----------
  private syncRack() {
    const items = this.hooks.rackItems();
    this.rackSlots.forEach((s, i) => {
      const it = items[i] ?? null, uid = it?.uid ?? null;
      if (uid === s.uid) return;
      s.uid = uid; if (s.obj) { this.scene.remove(s.obj); s.obj = null; }
      if (!it) return;
      void this.hooks.assemble(it.spec).then(({ group }) => {
        if (s.uid !== uid) return;
        const g = new THREE.Group(); g.add(group);
        const bb = new THREE.Box3().setFromObject(group), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
        const k = 1.3 / Math.max(size.x, size.z, 0.01); group.scale.setScalar(k); group.position.copy(c).multiplyScalar(-k);
        // De lado contra la pared: el cañón a lo largo de la pared (z del mundo) y el costado mirando al hall (+x)
        if (size.x > size.z) g.rotation.y = Math.PI / 2;
        g.position.copy(s.at); this.scene.add(g); s.obj = g;
      }).catch(() => undefined);
    });
  }

  // ---------- Drones ----------
  private randomSpot() {
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Vector3(-20 + Math.random() * 40, 1.2 + Math.random() * 0.8, 2.5 + Math.random() * 23);
      if (!this.colliders.some((b) => p.x > b.min.x - 0.6 && p.x < b.max.x + 0.6 && p.z > b.min.z - 0.6 && p.z < b.max.z + 0.6 && b.max.y > 0.8)) return p;
    }
    return new THREE.Vector3(0, 1.5, 18);
  }
  private droneHit(d: (typeof this.drones)[number]) {
    d.flee = 3.5; d.target = this.randomSpot(); this.hooks.droneShot(); this.hooks.beep?.(1400, 0.08);
    (d.eye.material as THREE.MeshBasicMaterial).color.set(0xff4040);
  }
  private droneTick(d: (typeof this.drones)[number], dt: number, player: THREE.Vector3, inHall: boolean) {
    d.phase += dt; d.flee = Math.max(0, d.flee - dt);
    if (d.flee <= 0) (d.eye.material as THREE.MeshBasicMaterial).color.set(0x7fe6ff);
    const pos = d.g.position, toP = new THREE.Vector3(pos.x - player.x, 0, pos.z - player.z), dp = toP.length();
    // Se aparta si el jugador se le acerca mucho (o huye si le han disparado)
    if (inHall && (dp < 2.2 || d.flee > 0) && dp > 0.01) { const away = pos.clone().add(toP.normalize().multiplyScalar(d.flee > 0 ? 6 : 3)); away.x = THREE.MathUtils.clamp(away.x, -20, 20); away.z = THREE.MathUtils.clamp(away.z, 2.5, 25.5); d.target.set(away.x, d.target.y, away.z); }
    const to = d.target.clone().sub(pos), dist = to.length(), speed = d.flee > 0 ? 4.5 : dp < 2.2 ? 2.4 : 1.1;
    if (dist < 0.3) { if (Math.random() < dt * 0.8) d.target = this.randomSpot(); }
    else d.vel.lerp(to.normalize().multiplyScalar(speed), Math.min(1, dt * 2.5));
    if (dist < 0.3) d.vel.multiplyScalar(Math.exp(-dt * 3));
    // Evita meterse en muebles: si el siguiente paso entra en una caja, busca otro destino
    const next = pos.clone().addScaledVector(d.vel, dt);
    if (this.colliders.some((b) => next.x > b.min.x - 0.35 && next.x < b.max.x + 0.35 && next.z > b.min.z - 0.35 && next.z < b.max.z + 0.35 && next.y < b.max.y + 0.3 && next.y > b.min.y - 0.3)) { d.vel.multiplyScalar(-0.3); d.target = this.randomSpot(); }
    else pos.copy(next);
    pos.y += Math.sin(d.phase * 2.2) * 0.003; // flotar
    if (d.vel.lengthSq() > 0.02) d.g.rotation.y = Math.atan2(d.vel.x, d.vel.z);
    d.g.rotation.z = THREE.MathUtils.clamp(-d.vel.x * 0.08, -0.4, 0.4) + (d.flee > 0 ? Math.sin(d.phase * 30) * 0.15 : 0);
  }

  // ---------- Radio: emisoras generadas con Web Audio ----------
  private nextStation(silent = false) {
    this.station = STATIONS[(STATIONS.indexOf(this.station) + 1) % STATIONS.length];
    setMusicOn(this.station === "ambient");
    if (this.radioGain) { const g = this.radioGain; g.gain.setTargetAtTime(0, audio().currentTime, 0.05); this.radioGain = null; setTimeout(() => g.disconnect(), 400); }
    if (this.station === "neon" || this.station === "pulse") { try { const a = audio(); this.radioGain = a.createGain(); this.radioGain.gain.value = 0; this.radioGain.connect(out()); this.nextNote = a.currentTime + 0.1; this.step = 0; } catch { /* sin audio */ } }
    if (!silent) this.hooks.toast(t("hb.station", { s: t(`hb.st.${this.station}`) })); this.drawRadio();
  }
  private drawRadio() {
    const c = this.radioCv.getContext("2d")!, W = 192, H = 64;
    c.fillStyle = "#0a1410"; c.fillRect(0, 0, W, H); c.fillStyle = this.station === "off" ? "#2c4a3a" : "#7aff9a"; c.font = "bold 22px monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(t(`hb.st.${this.station}`).toUpperCase(), W / 2, H / 2); this.radioTex.needsUpdate = true;
  }
  private radioTick(dt: number) {
    this.beatT = Math.max(0, this.beatT - dt * 6);
    this.speaker.scale.set(1 + this.beatT * 0.25, 1, 1 + this.beatT * 0.25);
    const g = this.radioGain; if (!g) return;
    let a: AudioContext; try { a = audio(); } catch { return; }
    g.gain.setTargetAtTime(0.22 * settings.music, a.currentTime, 0.1);
    const pulse = this.station === "pulse", bpm = pulse ? 118 : 82, sixteenth = 60 / bpm / 4;
    // Progresiones: Neón (La m – Fa – Do – Sol, lenta y suave) y Pulso (Re m – Si♭ – Fa – Do, arpegio rápido)
    const prog = pulse ? [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]] : [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    while (this.nextNote < a.currentTime + 0.2) {
      const tt = this.nextNote, s = this.step, bar = Math.floor(s / 16) % 4, chord = prog[bar], beat = s % 4 === 0;
      if (s % 16 === 0) for (const m of chord) this.tone(a, g, pulse ? "sawtooth" : "triangle", hz(m), tt, sixteenth * 16, pulse ? 0.035 : 0.05, pulse ? 1400 : 900); // acorde
      if (beat) { this.tone(a, g, "sine", hz(chord[0] - 24), tt, sixteenth * (pulse ? 2 : 3.5), 0.16, 400); if (s % 8 === 0) this.beatT = 1; }
      if (pulse) { this.tone(a, g, "square", hz(chord[s % 3] + 12), tt, sixteenth * 0.8, 0.03, 2600); if (beat) this.kick(a, g, tt); }
      if (s % 2 === 1) this.hat(a, g, tt, pulse ? 0.05 : 0.025);
      this.nextNote += sixteenth; this.step++;
    }
  }
  private tone(a: AudioContext, dest: AudioNode, type: OscillatorType, f: number, t0: number, len: number, vol: number, lp: number) {
    const o = a.createOscillator(), gg = a.createGain(), fl = a.createBiquadFilter(); o.type = type; o.frequency.value = f; fl.type = "lowpass"; fl.frequency.value = lp;
    gg.gain.setValueAtTime(0.0001, t0); gg.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.05, len * 0.2)); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    o.connect(fl); fl.connect(gg); gg.connect(dest); o.start(t0); o.stop(t0 + len + 0.05);
  }
  private kick(a: AudioContext, dest: AudioNode, t0: number) {
    const o = a.createOscillator(), gg = a.createGain(); o.frequency.setValueAtTime(120, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.15);
    gg.gain.setValueAtTime(0.3, t0); gg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2); o.connect(gg); gg.connect(dest); o.start(t0); o.stop(t0 + 0.25);
  }
  private hatBuf: AudioBuffer | null = null;
  private hat(a: AudioContext, dest: AudioNode, t0: number, vol: number) {
    if (!this.hatBuf) { this.hatBuf = a.createBuffer(1, Math.ceil(a.sampleRate * 0.05), a.sampleRate); const d = this.hatBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
    const s = a.createBufferSource(), f = a.createBiquadFilter(), gg = a.createGain(); s.buffer = this.hatBuf; f.type = "highpass"; f.frequency.value = 7000; gg.gain.value = vol;
    s.connect(f); f.connect(gg); gg.connect(dest); s.start(t0);
  }
}

function wrapText(c: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  let line = "", yy = y;
  for (const w of text.split(" ")) { const s = line ? `${line} ${w}` : w; if (c.measureText(s).width > max && line) { c.fillText(line, x, yy); line = w; yy += lh; } else line = s; }
  if (line) c.fillText(line, x, yy);
}
