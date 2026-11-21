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

export type HallPropId = "rack" | "radio" | "vending" | "cooler" | "board";
export interface HallProp { id: HallPropId; position: THREE.Vector3; radius: number; label: string; object: THREE.Object3D }
export interface HallHooks {
  assemble(spec: WeaponSpec): Promise<{ group: THREE.Object3D }>;
  /** Las armas del armero (las 6 primeras del almacén). */ rackItems(): (Item | null)[];
  openStorage(): void;
  toast(s: string): void;
  /** Cobra `n` créditos (false si no llega). */ spend(n: number): boolean;
  /** Efecto de la bebida energética (segundos). */ drink(sec: number): void;
  /** Un dron ha recibido un tiro (el asistente protesta). */ droneShot(): void;
  /** Sonido corto sintetizado. */ beep?(f: number, len: number): void;
}

const DRINK_PRICE = 15, DRINK_SEC = 60;
const STATIONS = ["ambient", "neon", "pulse", "off"] as const;
type Station = (typeof STATIONS)[number];

export class HallProps {
  readonly props: HallProp[] = [];
  private rackSlots: { at: THREE.Vector3; uid: number | null; obj: THREE.Object3D | null }[] = [];
  private drones: { g: THREE.Group; eye: THREE.Mesh; target: THREE.Vector3; flee: number; vel: THREE.Vector3; phase: number }[] = [];
  private bag = { pivot: new THREE.Group(), ang: new THREE.Vector2(), vel: new THREE.Vector2() };
  private radioCv = document.createElement("canvas"); private radioTex: THREE.CanvasTexture; private speaker!: THREE.Mesh;
  private station: Station = "ambient"; private beatT = 0; private nextNote = 0; private step = 0; private radioGain: GainNode | null = null;
  private time = 0; private lastPlayer = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private colliders: THREE.Box3[], shootables: THREE.Object3D[], private hooks: HallHooks) {
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a939c, metalness: 0.6, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x23282e, metalness: 0.4, roughness: 0.55 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.8 });
    const glowC = new THREE.MeshBasicMaterial({ color: 0x7fe6ff }), glowA = new THREE.MeshBasicMaterial({ color: 0xffb040 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent: THREE.Object3D = scene, collide = false) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; parent.add(b);
      if (collide) { b.updateWorldMatrix(true, false); colliders.push(new THREE.Box3().setFromObject(b)); }
      return b;
    };
    const canvasPlane = (w: number, h: number, px: number, draw: (c: CanvasRenderingContext2D, W: number, H: number) => void) => {
      const cv = document.createElement("canvas"); cv.width = px; cv.height = Math.round((px * h) / w); draw(cv.getContext("2d")!, cv.width, cv.height);
      const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
      return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false }));
    };
    const label = (text: string, color: string) => canvasPlane(2.2, 0.36, 512, (c, W, H) => { c.fillStyle = "#11161b"; c.fillRect(0, 0, W, H); c.fillStyle = color; c.fillRect(0, 0, W, 6); c.fillStyle = "#e8eef2"; c.font = "bold 44px monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(text, W / 2, H / 2 + 3); });

    // ---------- Armero (pared izquierda, z ≈ 7,5): panel perforado con 6 huecos ----------
    {
      const g = new THREE.Group(); g.position.set(-23.95, 0, 7.5); g.rotation.y = Math.PI / 2; scene.add(g); g.updateMatrixWorld(true);
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
      this.props.push({ id: "rack", position: new THREE.Vector3(-22.6, 0, 7.5), radius: 3, label: "rack", object: g });
    }

    // ---------- Pared frontal (z = 0): máquina de bebidas, fuente de agua, tablón y radio ----------
    {
      // Máquina de bebidas
      const v = new THREE.Group(); v.position.set(-8, 0, 0.5); scene.add(v);
      box(1.3, 2.1, 0.9, 0, 1.05, 0, new THREE.MeshStandardMaterial({ color: 0xb8342e, metalness: 0.3, roughness: 0.5 }), v);
      const front = canvasPlane(1.0, 1.5, 256, (c, W, H) => {
        c.fillStyle = "#0b1218"; c.fillRect(0, 0, W, H); const cols = ["#ff5050", "#40d0ff", "#f2c040", "#7aff8a"];
        for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { c.fillStyle = cols[(r + k) % 4]; c.fillRect(22 + k * 56, 24 + r * 70, 34, 52); c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(26 + k * 56, 28 + r * 70, 6, 44); }
        c.fillStyle = "#f2f2ee"; c.font = "bold 30px monospace"; c.textAlign = "center"; c.fillText(`${DRINK_PRICE} CR`, W / 2, H - 22);
      });
      front.position.set(-0.1, 1.25, 0.46); v.add(front);
      box(0.18, 0.5, 0.04, 0.5, 1.3, 0.46, glowA, v); box(0.8, 0.18, 0.06, -0.1, 0.32, 0.46, dark, v);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(-8.7, 0, 0), new THREE.Vector3(-7.3, 2.1, 1)));
      this.props.push({ id: "vending", position: new THREE.Vector3(-8, 0, 1.4), radius: 2, label: "vending", object: v });
      // Fuente de agua
      const w = new THREE.Group(); w.position.set(-5.8, 0, 0.35); scene.add(w);
      box(0.5, 1.0, 0.45, 0, 0.5, 0, new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.6 }), w);
      const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 18), new THREE.MeshStandardMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0.55, roughness: 0.1 }));
      jug.position.y = 1.27; w.add(jug);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(-6.1, 0, 0), new THREE.Vector3(-5.5, 1.5, 0.6)));
      this.props.push({ id: "cooler", position: new THREE.Vector3(-5.8, 0, 1.2), radius: 1.6, label: "cooler", object: w });
      // Tablón de anuncios
      const b = new THREE.Group(); b.position.set(0, 0, 0.03); scene.add(b);
      box(3.2, 1.7, 0.05, 0, 2.1, 0, wood, b);
      box(3.0, 1.5, 0.02, 0, 2.1, 0.035, new THREE.MeshStandardMaterial({ color: 0xb89466, roughness: 0.95 }), b);
      const notes: [number, number, number, string, string][] = [[-1.05, 2.45, -0.06, "#f8f0c8", t("hb.note.0")], [0, 2.4, 0.04, "#cfe8ff", t("hb.note.1")], [1.0, 2.5, -0.03, "#ffd6d6", t("hb.note.2")], [-0.6, 1.75, 0.05, "#e0ffd8", t("hb.note.3")], [0.7, 1.75, -0.05, "#f8f0c8", t("hb.note.4")]];
      for (const [x, y, rot, col, txt] of notes) {
        const n = canvasPlane(0.78, 0.55, 220, (c, W, H) => { c.fillStyle = col; c.fillRect(0, 0, W, H); c.fillStyle = "#2a2a2a"; c.font = "bold 20px sans-serif"; c.textAlign = "center"; wrapText(c, txt, W / 2, 34, W - 18, 24); c.fillStyle = "#d33"; c.beginPath(); c.arc(W / 2, 8, 6, 0, Math.PI * 2); c.fill(); });
        n.position.set(x, y, 0.05); n.rotation.z = rot; b.add(n);
      }
      this.props.push({ id: "board", position: new THREE.Vector3(0, 0, 1.4), radius: 2.2, label: "board", object: b });
      // Radio sobre una mesita
      const r = new THREE.Group(); r.position.set(8, 0, 0.55); scene.add(r);
      box(1.4, 0.06, 0.7, 0, 0.8, 0, wood, r); for (const [x, z] of [[-0.62, -0.28], [0.62, -0.28], [-0.62, 0.28], [0.62, 0.28]]) box(0.05, 0.8, 0.05, x, 0.4, z, steel, r);
      box(0.8, 0.42, 0.3, 0, 1.04, 0, new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.5, roughness: 0.4 }), r);
      this.speaker = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), dark); this.speaker.rotation.x = Math.PI / 2; this.speaker.position.set(-0.2, 1.04, 0.16); r.add(this.speaker);
      this.radioCv.width = 192; this.radioCv.height = 64; this.radioTex = new THREE.CanvasTexture(this.radioCv); this.radioTex.colorSpace = THREE.SRGBColorSpace;
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.1), new THREE.MeshBasicMaterial({ map: this.radioTex, toneMapped: false })); disp.position.set(0.17, 1.1, 0.152); r.add(disp);
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6), steel); ant.position.set(0.32, 1.5, -0.08); ant.rotation.z = -0.4; r.add(ant);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(7.3, 0, 0.2), new THREE.Vector3(8.7, 1.25, 0.9)));
      this.props.push({ id: "radio", position: new THREE.Vector3(8, 0, 1.5), radius: 2, label: "radio", object: r });
      this.drawRadio();
    }

    // ---------- Saco de boxeo (colgado del techo, cerca de la puerta sellada) ----------
    {
      const p = this.bag.pivot; p.position.set(-18, 7.3, 24.5); scene.add(p);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.6), steel); chain.position.y = -2.3; p.add(chain);
      const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.33, 1.35, 20), new THREE.MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }));
      sack.position.y = -5.3; sack.castShadow = true; p.add(sack);
      for (const y of [-4.75, -5.85]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.08, 20), dark); band.position.y = y; p.add(band); }
      sack.userData.onShot = () => this.hitBag(1); shootables.push(sack);
      this.colliders.push(new THREE.Box3(new THREE.Vector3(-18.35, 1.3, 24.15), new THREE.Vector3(-17.65, 2.7, 24.85)));
    }

    // ---------- Decoración: bancos, macetas, cajas y carteles ----------
    for (const x of [-4.5, 4.5]) {
      const g = new THREE.Group(); g.position.set(x, 0, 22.5); scene.add(g);
      box(2.4, 0.08, 0.5, 0, 0.46, 0, wood, g); box(2.4, 0.4, 0.06, 0, 0.75, -0.24, wood, g);
      for (const s of [-1, 1]) box(0.06, 0.46, 0.45, s * 1.05, 0.23, 0, steel, g);
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 1.2, 0, 22.2), new THREE.Vector3(x + 1.2, 0.5, 22.8)));
    }
    for (const [x, z] of [[-22.6, 1.6], [22.6, 1.6], [-22.6, 26.6], [22.6, 26.6], [-14, 1.2], [14, 1.2]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 14), new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.7 })); pot.position.set(x, 0.3, z); pot.castShadow = true; scene.add(pot);
      const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a42, roughness: 0.8 });
      for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.9 + (i % 3) * 0.25, 5), leaf); const a = (i / 7) * Math.PI * 2; l.position.set(x + Math.cos(a) * 0.1, 0.95, z + Math.sin(a) * 0.1); l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); scene.add(l); }
      colliders.push(new THREE.Box3(new THREE.Vector3(x - 0.35, 0, z - 0.35), new THREE.Vector3(x + 0.35, 0.6, z + 0.35)));
    }
    {
      const crate = new THREE.MeshStandardMaterial({ color: 0x55606a, roughness: 0.75 }), strap = new THREE.MeshStandardMaterial({ color: 0xd08a2a, roughness: 0.6 });
      for (const [x, y, z, s] of [[19.6, 0.45, 25.4, 0.9], [20.6, 0.45, 25.6, 0.9], [20.1, 1.25, 25.5, 0.7], [18.6, 0.35, 26.2, 0.7]] as const) {
        box(s, s, s, x, y, z, crate); box(s + 0.01, 0.08, s + 0.01, x, y, z, strap);
        colliders.push(new THREE.Box3(new THREE.Vector3(x - s / 2, y - s / 2, z - s / 2), new THREE.Vector3(x + s / 2, y + s / 2, z + s / 2)));
      }
    }
    const poster = (title: string, sub: string, col: string, x: number, z: number, ry: number) => {
      const m = canvasPlane(1.4, 2.0, 280, (c, W, H) => {
        const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, col); gr.addColorStop(1, "#10151a"); c.fillStyle = gr; c.fillRect(0, 0, W, H);
        c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 3; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(W / 2, H * 0.42, 30 + i * 18, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = "#fff"; c.font = "bold 34px monospace"; c.textAlign = "center"; wrapText(c, title, W / 2, H * 0.74, W - 20, 36);
        c.font = "18px monospace"; c.fillStyle = "rgba(255,255,255,.75)"; wrapText(c, sub, W / 2, H * 0.9, W - 20, 20);
      });
      m.position.set(x, 2.3, z); m.rotation.y = ry; scene.add(m);
    };
    poster(t("hb.poster.0"), t("hb.poster.0s"), "#2a6a9a", -23.96, 14.5, Math.PI / 2);
    poster(t("hb.poster.1"), t("hb.poster.1s"), "#9a3a2a", 23.96, 24.5, -Math.PI / 2);
    poster(t("hb.poster.2"), t("hb.poster.2s"), "#3a7a4a", -16, 0.03, 0);
    poster(t("hb.poster.3"), t("hb.poster.3s"), "#6a3a9a", 16, 0.03, 0);

    // ---------- Drones de mantenimiento ----------
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.4, roughness: 0.35 }));
      body.scale.y = 0.75; g.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 24), dark); ring.rotation.x = Math.PI / 2; g.add(ring);
      for (let k = 0; k < 4; k++) { const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 10), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.4 })); const a = (k * Math.PI) / 2; rotor.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3); g.add(rotor); }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fe6ff })); eye.position.set(0, 0, 0.2); g.add(eye);
      const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.4), steel); brush.position.set(0, -0.3, 0); g.add(brush);
      g.position.set(-10 + i * 10, 1.4, 18 - i * 4); scene.add(g);
      body.userData.onShot = () => this.droneHit(d); shootables.push(body);
      const d = { g, eye, target: this.randomSpot(), flee: 0, vel: new THREE.Vector3(), phase: Math.random() * 6 };
      this.drones.push(d);
    }
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
  }
  prompt(id: HallPropId) { return t(`hb.use.${id}`, { c: DRINK_PRICE, s: t(`hb.st.${this.station}`) }); }
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
    for (const d of this.drones) this.droneTick(d, dt, player, inHall);
    this.radioTick(dt);
  }
  /** ¿El jugador está junto al saco? (para que los puñetazos lo muevan). */
  nearBag(p: THREE.Vector3) { const q = this.bag.pivot.position; return Math.hypot(p.x - q.x, p.z - q.z) < 1.4; }

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
  private nextStation() {
    this.station = STATIONS[(STATIONS.indexOf(this.station) + 1) % STATIONS.length];
    setMusicOn(this.station === "ambient");
    if (this.radioGain) { const g = this.radioGain; g.gain.setTargetAtTime(0, audio().currentTime, 0.05); this.radioGain = null; setTimeout(() => g.disconnect(), 400); }
    if (this.station === "neon" || this.station === "pulse") { try { const a = audio(); this.radioGain = a.createGain(); this.radioGain.gain.value = 0; this.radioGain.connect(out()); this.nextNote = a.currentTime + 0.1; this.step = 0; } catch { /* sin audio */ } }
    this.hooks.toast(t("hb.station", { s: t(`hb.st.${this.station}`) })); this.drawRadio();
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
