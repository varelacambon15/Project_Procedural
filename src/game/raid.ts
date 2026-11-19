// Incursión: mapa generado (raidgen.ts) que se construye lejos del complejo, salas que se cierran al entrar hasta
// acabar con sus enemigos, salas de botín y un jefe al final. Al ganar o morir se vuelve al vestíbulo (main.ts).
// Sin luces nuevas (el número de luces es fijo): paneles emisivos en el techo y barreras aditivas en las puertas.
import * as THREE from "three";
import { dataPanel, hexFloor } from "./simtex";
import { CELL, DOOR_W, doorsOf, generateRaid, rng, type RaidMap, type RaidOptions, type RaidRoom } from "./raidgen";
import type { Waves } from "./waves";
import type { KINDS } from "./dummies";

/** Origen del mapa de la incursión (lejos del complejo; la niebla lo separa). */
export const RAID_ORIGIN = new THREE.Vector3(700, 0, 0);
const CH = 4.2;

export interface RaidHooks {
  mobs: Waves; colliders: THREE.Box3[]; shootables: THREE.Object3D[];
  toast(msg: string): void;
  /** Sala despejada (índice entre las de combate, total). */ onClear(n: number, of: number): void;
  onWin(): void;
  /** Cofre de una sala de botín abierto. */ onChest(at: THREE.Vector3): void;
  /** Aviso del objetivo de la sala o de una fase del jefe (clave de texto y parámetros). */ announce(key: string, p?: Record<string, string | number>): void;
  /** Fase nueva del jefe (2 o 3): golpe de efecto en main. */ onBossPhase?(n: number): void;
}
interface RoomState { room: RaidRoom; started: boolean; cleared: boolean; queue: string[]; spawnT: number; second: string[]; t: number; barriers: { mesh: THREE.Mesh; box: THREE.Box3 }[]; chest?: THREE.Group }

const PALETTES = [
  // (más oscuras y con neón, como las salas de las referencias de Coded Arms)
  { floor: "#4e545c", wall: "#5e646d", trim: 0xff4a8a, accent: 0x3fd0d8 },  // instalación
  { floor: "#3e4856", wall: "#4e5b6b", trim: 0x3a9ad8, accent: 0x7affc8 },  // laboratorio azul
  { floor: "#4e4842", wall: "#625a50", trim: 0xc99a2e, accent: 0xff7a4a },  // almacén oxidado
];
function grid(base: string, line: string, rep: [number, number]) {
  const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!;
  g.fillStyle = base; g.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) { const v = Math.random() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${Math.random() * 0.08})`; g.fillRect(Math.floor(Math.random() * 32), Math.floor(Math.random() * 32), 1, 1); }
  g.fillStyle = line; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Raid {
  active = false;
  map: RaidMap | null = null;
  opt: RaidOptions = { rooms: 6, difficulty: 0 };
  private group = new THREE.Group();
  private boxes: THREE.Box3[] = [];
  private states: RoomState[] = [];
  private fightsDone = 0;
  /** Fases del jefe ya desatadas (al 66 % y al 33 % de vida). */ private bossPhase = 1;
  private won = false;
  current: RoomState | null = null;
  constructor(private scene: THREE.Scene, private hooks: RaidHooks) {}

  get fights() { return this.states.filter((s) => s.room.kind === "fight" || s.room.kind === "boss").length; }
  get cleared() { return this.fightsDone; }
  get enemiesLeft() { return this.current && this.current.started && !this.current.cleared ? this.current.queue.length + this.hooks.mobs.living : 0; }
  /** Segundos que quedan del contrarreloj de la sala actual (null si no lo hay). */
  get timeLeft() { const c = this.current; return c && c.started && !c.cleared && c.room.goal === "timed" ? Math.max(0, c.room.limit - c.t) : null; }
  get inBoss() { return this.current?.room.kind === "boss" && this.current.started; }

  /** Construye el mapa y devuelve dónde aparece el jugador (y hacia dónde mira). */
  start(seed: number, opt: RaidOptions): { pos: THREE.Vector3; yaw: number } {
    this.end();
    this.opt = opt; this.map = generateRaid(seed, opt); this.active = true; this.won = false; this.fightsDone = 0; this.bossPhase = 1;
    this.build(this.map);
    const s = this.map.rooms[0], nx = this.map.rooms[1];
    const dir = new THREE.Vector3(nx.cx - s.cx, 0, nx.cz - s.cz).normalize();
    // (yaw 0 mira a −Z)
    return { pos: new THREE.Vector3(s.cx, 0, s.cz).add(RAID_ORIGIN), yaw: Math.atan2(-dir.x, -dir.z) };
  }

  /** Modo Hack: ¿la última sala de contrarreloj se superó a tiempo? */
  lastTimedOk = false;
  /** Modo Hack: construye una sola sala de nodo (con su entrada) y devuelve dónde aparece el jugador. */
  startNode(seed: number, kind: "fight" | "loot", enemies: string[], timed: number, palette: number) {
    this.end();
    const base = generateRaid(seed, { rooms: 3, difficulty: 0 }), start = base.rooms[0], room = { ...base.rooms[1], kind, enemies, goal: (timed > 0 ? "timed" : "purge") as RaidRoom["goal"], limit: timed };
    if (kind === "loot") room.covers = [];
    this.map = { seed, rooms: [start, room], corridors: base.corridors.filter((c) => c.a < 2 && c.b < 2), palette };
    this.opt = { rooms: 2, difficulty: 0 }; this.active = true; this.won = false; this.fightsDone = 0; this.bossPhase = 1; this.lastTimedOk = false;
    this.build(this.map);
    const dir = new THREE.Vector3(room.cx - start.cx, 0, room.cz - start.cz).normalize();
    return { pos: new THREE.Vector3(start.cx, 0, start.cz).add(RAID_ORIGIN), yaw: Math.atan2(-dir.x, -dir.z) };
  }

  /** Desmonta el mapa (al ganar, morir o salir). */
  end() {
    this.hooks.mobs.stop();
    for (const b of this.boxes) { const i = this.hooks.colliders.indexOf(b); if (i >= 0) this.hooks.colliders.splice(i, 1); }
    for (const st of this.states) for (const b of st.barriers) { const i = this.hooks.colliders.indexOf(b.box); if (i >= 0) this.hooks.colliders.splice(i, 1); }
    this.group.traverse((o) => { const i = this.hooks.shootables.indexOf(o); if (i >= 0) this.hooks.shootables.splice(i, 1); if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material as THREE.MeshStandardMaterial; m.map?.dispose(); m.dispose(); } });
    this.scene.remove(this.group); this.group = new THREE.Group();
    this.boxes = []; this.states = []; this.current = null; this.active = false; this.map = null;
  }

  /** ¿Está este punto dentro del mapa de la incursión? */
  contains(p: THREE.Vector3) { return p.x > RAID_ORIGIN.x - CELL * 12; }

  private build(map: RaidMap) {
    const pal = PALETTES[map.palette];
    const floorTex = grid(pal.floor, "#00000030", [1, 1]);
    // Rejilla luminosa del color de acento de la incursión (estética de simulación)
    const gridTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d")!; g.fillStyle = "#000"; g.fillRect(0, 0, 32, 32); g.fillStyle = "#fff"; g.fillRect(0, 0, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(0, 0, 2, 2); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t; })();
    // (baldosas hexagonales con juntas del color de acento, como en las referencias)
    const hx = hexFloor(pal.floor, "#25292f", [1, 1]); void floorTex; void gridTex;
    const floorFor = (w: number, d: number) => { const t = hx.map.clone(), e = hx.emissive.clone(); t.repeat.set(w / 3.2, d / 5.5); e.repeat.set(w / 3.2, d / 5.5); t.needsUpdate = e.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.3, emissive: pal.accent, emissiveMap: e, emissiveIntensity: 0.5 }); };
    const core = new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff9a40, emissiveIntensity: 1.6 }), shell = new THREE.MeshStandardMaterial({ color: 0x9ab0c0, transparent: true, opacity: 0.25, roughness: 0.2 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0x401018, emissive: pal.trim, emissiveIntensity: 1.1 });
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pal.wall), roughness: 0.9 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x3c4046, roughness: 1 });
    const coverMat = new THREE.MeshStandardMaterial({ color: 0x5d636a, metalness: 0.4, roughness: 0.6 });
    const trimMat = new THREE.MeshStandardMaterial({ color: pal.trim, emissive: pal.trim, emissiveIntensity: 0.5 });
    const panel = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f6ff, emissiveIntensity: 1.1 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x5a6068, metalness: 0.6, roughness: 0.5 });
    const accentMat = new THREE.MeshStandardMaterial({ color: pal.accent, emissive: pal.accent, emissiveIntensity: 0.9 });
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, metalness: 0.5, roughness: 0.5 });
    const ledA = new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x3aff8a, emissiveIntensity: 1.2 }), ledB = new THREE.MeshStandardMaterial({ color: 0x0a2233, emissive: pal.accent, emissiveIntensity: 1.2 });
    const O = RAID_ORIGIN, g = this.group;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, collide = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(O.x + x, y, O.z + z); m.receiveShadow = true; g.add(m);
      if (collide) { const b = new THREE.Box3().setFromObject(m); this.boxes.push(b); this.hooks.colliders.push(b); }
      this.hooks.shootables.push(m); return m;
    };
    const plane = (w: number, d: number, x: number, y: number, z: number, mat: THREE.Material, up = true) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat); m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; m.position.set(O.x + x, y, O.z + z); m.receiveShadow = true; g.add(m); this.hooks.shootables.push(m); return m;
    };
    for (const room of map.rooms) {
      const { cx, cz, w, d } = room, doors = doorsOf(map, room);
      plane(w, d, cx, 0, cz, floorFor(w, d));
      const H = room.h; // (cada sala con su altura)
      plane(w, d, cx, H, cz, ceilMat, false);
      for (let z = cz - d / 2 + 4; z < cz + d / 2; z += 8) for (let x = cx - w / 2 + 5; x < cx + w / 2; x += 10) box(4, 0.06, 1.2, x, H - 0.05, z, panel, false);
      // Decoración de paredes: tuberías a lo largo y tiras de luz verticales (sin colisión)
      for (const [s, alongX] of [[1, true], [-1, true], [1, false], [-1, false]] as const) {
        const len = alongX ? w : d, off = (alongX ? d : w) / 2 - 0.25;
        if (alongX) box(len - 1, 0.18, 0.18, cx, H - 0.9, cz + s * off, pipeMat, false); else box(0.18, 0.18, len - 1, cx + s * off, H - 0.9, cz, pipeMat, false);
        for (let t = -len / 2 + 3; t < len / 2 - 2; t += 7) { if (Math.abs(t) < DOOR_W) continue; if (alongX) box(0.25, H - 2.2, 0.05, cx + t, (H - 2.2) / 2 + 0.6, cz + s * (off + 0.2), accentMat, false); else box(0.05, H - 2.2, 0.25, cx + s * (off + 0.2), (H - 2.2) / 2 + 0.6, cz + t, accentMat, false); }
      }
      // Paredes: con hueco de puerta donde llega un pasillo
      const side = (s: "n" | "s" | "e" | "w") => {
        const alongX = s === "n" || s === "s", len = alongX ? w : d, pos = s === "n" ? cz + d / 2 + 0.5 : s === "s" ? cz - d / 2 - 0.5 : s === "e" ? cx + w / 2 + 0.5 : cx - w / 2 - 0.5;
        const put = (a: number, b: number, y0: number, y1: number, collide = true) => {
          const c = (a + b) / 2, l = b - a; if (l <= 0.01) return;
          if (alongX) box(l, y1 - y0, 1, cx + c, (y0 + y1) / 2, pos, wallMat, collide); else box(1, y1 - y0, l, pos, (y0 + y1) / 2, cz + c, wallMat, collide);
        };
        const half = len / 2 + 1;
        if (doors.includes(s)) { put(-half, -DOOR_W / 2, 0, H); put(DOOR_W / 2, half, 0, H); put(-DOOR_W / 2, DOOR_W / 2, CH, H, false); }
        else put(-half, half, 0, H);
        // franja de color a media altura
        if (alongX) box(len, 0.2, 0.05, cx, 1.1, pos + (s === "n" ? -0.53 : 0.53), trimMat, false); else box(0.05, 0.2, len, pos + (s === "e" ? -0.53 : 0.53), 1.1, cz, trimMat, false);
      };
      (["n", "s", "e", "w"] as const).forEach(side);
      // Columnas de luz en dos esquinas y un panel holográfico de datos en una pared (salas de combate y jefe)
      if (room.kind === "fight" || room.kind === "boss") {
        for (const [sx, sz] of [[-1, -1], [1, 1]] as const) {
          const x = cx + sx * (w / 2 - 1.3), z = cz + sz * (d / 2 - 1.3);
          const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, H - 1.6, 10), core); c1.position.set(O.x + x, H / 2, O.z + z); g.add(c1);
          const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, H - 1.6, 6), shell); c2.position.copy(c1.position); g.add(c2);
          for (const y of [0.4, H - 0.4]) box(1.1, 0.8, 1.1, x, y, z, capMat, false);
          const bx = new THREE.Box3(new THREE.Vector3(O.x + x - 0.6, 0, O.z + z - 0.6), new THREE.Vector3(O.x + x + 0.6, H, O.z + z + 0.6)); this.boxes.push(bx); this.hooks.colliders.push(bx);
        }
        const pn = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.4), new THREE.MeshBasicMaterial({ map: dataPanel(`#${new THREE.Color(pal.accent).getHexString()}`, room.i * 13 + 5), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
        pn.position.set(O.x + cx - w / 2 + 0.06, Math.min(H - 2, 3.4), O.z + cz + d / 4); pn.rotation.y = Math.PI / 2; g.add(pn);
      }
      for (const c of room.covers) {
        if (c.kind === "pillar") {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(c.w / 2, c.w / 2 + 0.08, c.h, 14), wallMat); m.position.set(O.x + c.x, c.h / 2, O.z + c.z); m.receiveShadow = true; g.add(m); this.hooks.shootables.push(m);
          const b = new THREE.Box3().setFromObject(m); this.boxes.push(b); this.hooks.colliders.push(b);
          box(c.w + 0.25, 0.25, c.d + 0.25, c.x, 0.12, c.z, coverMat, false); box(c.w + 0.06, 0.12, c.d + 0.06, c.x, 1.1, c.z, trimMat, false);
        } else if (c.kind === "rack") {
          box(c.w, c.h, c.d, c.x, c.h / 2, c.z, rackMat);
          for (let y = 0.45; y < c.h - 0.2; y += 0.42) for (const s of [-1, 1]) box(c.w * 0.86, 0.04, 0.02, c.x, y, c.z + s * (c.d / 2 + 0.005), y % 0.84 < 0.42 ? ledA : ledB, false);
        } else if (c.kind === "barrier") {
          box(c.w, c.h, c.d, c.x, c.h / 2, c.z, wallMat); box(c.w + 0.04, 0.08, c.d + 0.04, c.x, c.h + 0.02, c.z, trimMat, false);
        } else { box(c.w, c.h, c.d, c.x, c.h / 2, c.z, coverMat); box(c.w + 0.02, 0.1, c.d + 0.02, c.x, c.h * 0.7, c.z, trimMat, false); }
      }
      const st: RoomState = { room, started: false, cleared: room.kind === "start" || room.kind === "loot", queue: [], spawnT: 0, barriers: [], second: [], t: 0 };
      if (room.kind === "loot") st.chest = this.chest(new THREE.Vector3(O.x + cx, 0, O.z + cz), pal.accent);
      if (room.kind === "boss") { const m = new THREE.Mesh(new THREE.RingGeometry(6, 6.4, 48), new THREE.MeshBasicMaterial({ color: 0xff4a3a, transparent: true, opacity: 0.6 })); m.rotation.x = -Math.PI / 2; m.position.set(O.x + cx, 0.02, O.z + cz); g.add(m); }
      this.states.push(st);
    }
    // Pasillos: suelo, paredes y techo entre los bordes de las dos salas
    for (const c of map.corridors) {
      const a = map.rooms[c.a], b = map.rooms[c.b], alongZ = a.cell[0] === b.cell[0];
      if (alongZ) {
        const [lo, hi] = a.cz < b.cz ? [a, b] : [b, a], z0 = lo.cz + lo.d / 2 + 1, z1 = hi.cz - hi.d / 2 - 1, L = z1 - z0, zc = (z0 + z1) / 2;
        plane(c.width, L + 2, a.cx, 0, zc, floorFor(c.width, L + 2));
        plane(c.width + 2, L + 2, a.cx, CH, zc, ceilMat, false);
        for (const sx of [-1, 1]) box(1, CH, L + 2, a.cx + sx * (c.width / 2 + 0.5), CH / 2, zc, wallMat);
        for (let z = z0 + 2; z < z1; z += 6) box(1.2, 0.05, 2.5, a.cx, CH - 0.04, z, panel, false);
      } else {
        const [lo, hi] = a.cx < b.cx ? [a, b] : [b, a], x0 = lo.cx + lo.w / 2 + 1, x1 = hi.cx - hi.w / 2 - 1, L = x1 - x0, xc = (x0 + x1) / 2;
        plane(L + 2, c.width, xc, 0, a.cz, floorFor(L + 2, c.width));
        plane(L + 2, c.width + 2, xc, CH, a.cz, ceilMat, false);
        for (const sz of [-1, 1]) box(L + 2, CH, 1, xc, CH / 2, a.cz + sz * (c.width / 2 + 0.5), wallMat);
        for (let x = x0 + 2; x < x1; x += 6) box(2.5, 0.05, 1.2, x, CH - 0.04, a.cz, panel, false);
      }
    }
    this.scene.add(g);
  }

  /** Cofre de una sala de botín: se abre al pasar cerca. */
  private chest(at: THREE.Vector3, accent: number) {
    const c = new THREE.Group(); c.position.copy(at);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.5, roughness: 0.5 })); body.position.y = 0.35; c.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.16, 0.85), new THREE.MeshStandardMaterial({ color: 0x5d636a, metalness: 0.5, roughness: 0.5 })); lid.position.y = 0.78; lid.name = "lid"; c.add(lid);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.04, 0.86), new THREE.MeshBasicMaterial({ color: accent })); glow.position.y = 0.7; c.add(glow);
    this.group.add(c); return c;
  }

  /** Sala en la que está el jugador (por dentro de sus paredes). */
  private roomAt(p: THREE.Vector3): RoomState | null {
    const x = p.x - RAID_ORIGIN.x, z = p.z - RAID_ORIGIN.z;
    return this.states.find((s) => Math.abs(x - s.room.cx) < s.room.w / 2 - 1.2 && Math.abs(z - s.room.cz) < s.room.d / 2 - 1.2) ?? null;
  }

  update(dt: number, player: THREE.Vector3) {
    if (!this.active || !this.map) return;
    const here = this.roomAt(player);
    if (here) this.current = here;
    const st = this.current;
    // Cofres: se abren al acercarse
    for (const s of this.states) if (s.chest && !s.chest.userData.open && s.chest.position.distanceTo(player) < 2.2) {
      s.chest.userData.open = true; s.chest.getObjectByName("lid")!.rotation.x = -1.2; s.chest.getObjectByName("lid")!.position.z = -0.3; this.hooks.onChest(s.chest.position.clone().setY(1));
    }
    if (!st || st.cleared) return;
    if (!st.started && here === st) this.begin(st, player);
    if (!st.started) return;
    st.t += dt;
    if (st.queue.length) { st.spawnT -= dt; if (st.spawnT <= 0) { st.spawnT = 0.5; this.spawnIn(st, player, st.queue.shift()!); } }
    if (st.room.kind === "boss" || st.room.enemies.includes("warden")) this.bossPhases(st, player);
    if (!st.queue.length && this.hooks.mobs.living === 0) {
      // Dos oleadas: al acabar la primera, respiro corto y llega la segunda
      if (st.second.length) { st.queue = st.second; st.second = []; st.spawnT = 2; this.hooks.announce("rd.wave2"); return; }
      this.clear(st);
    }
  }

  private begin(st: RoomState, player: THREE.Vector3) {
    st.started = true; st.queue = [...st.room.enemies]; st.spawnT = 0.6; st.t = 0;
    const g = st.room.goal;
    if (g === "waves") { const k = Math.ceil(st.queue.length * 0.55); st.second = st.queue.slice(k); st.queue = st.queue.slice(0, k); }
    if (st.room.kind === "boss") this.hooks.announce("rd.goal.boss");
    else this.hooks.announce(`rd.goal.${g}`, { s: st.room.limit });
    // Barreras de energía en las puertas (no se sale hasta acabar)
    const r = st.room, O = RAID_ORIGIN, mat = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const s of doorsOf(this.map!, r)) {
      const alongX = s === "n" || s === "s", pos = s === "n" ? r.cz + r.d / 2 + 0.5 : s === "s" ? r.cz - r.d / 2 - 0.5 : s === "e" ? r.cx + r.w / 2 + 0.5 : r.cx - r.w / 2 - 0.5;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_W, CH), mat);
      if (alongX) m.position.set(O.x + r.cx, CH / 2, O.z + pos); else { m.position.set(O.x + pos, CH / 2, O.z + r.cz); m.rotation.y = Math.PI / 2; }
      this.group.add(m);
      const box = new THREE.Box3().setFromCenterAndSize(m.position, alongX ? new THREE.Vector3(DOOR_W, CH, 1.2) : new THREE.Vector3(1.2, CH, DOOR_W));
      this.hooks.colliders.push(box); st.barriers.push({ mesh: m, box });
    }
    void player;
  }

  /** Aparece un enemigo dentro de la sala, lejos del jugador y fuera de las coberturas. */
  private spawnIn(st: RoomState, player: THREE.Vector3, kind: string) {
    const r = st.room, rnd = rng((Math.random() * 1e9) | 0);
    let best = new THREE.Vector3(), bestD = -1;
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Vector3(RAID_ORIGIN.x + r.cx + (rnd() - 0.5) * (r.w - 4), 0, RAID_ORIGIN.z + r.cz + (rnd() - 0.5) * (r.d - 4));
      if (r.covers.some((c) => Math.abs(p.x - RAID_ORIGIN.x - c.x) < c.w / 2 + 1 && Math.abs(p.z - RAID_ORIGIN.z - c.z) < c.d / 2 + 1)) continue;
      const dd = p.distanceTo(player); if (dd > bestD) { bestD = dd; best = p; }
    }
    if (kind === "warden") best.set(RAID_ORIGIN.x + r.cx, 0, RAID_ORIGIN.z + r.cz);
    this.hooks.mobs.spawnAt(kind as keyof typeof KINDS, best);
  }

  /** Jefe: al bajar al 66 % y al 33 % de vida entra en una fase nueva con refuerzos (más en dificultades altas). */
  private bossPhases(st: RoomState, player: THREE.Vector3) {
    const w = this.hooks.mobs.list.find((d) => d.alive && d.kind.boss); if (!w) return;
    const max = w.layers.reduce((a, l) => a + l.max, 0), cur = w.layers.reduce((a, l) => a + l.value, 0), f = cur / Math.max(1, max);
    const want = f < 0.33 ? 3 : f < 0.66 ? 2 : 1;
    if (want <= this.bossPhase) return;
    this.bossPhase = want; this.hooks.onBossPhase?.(want); this.hooks.announce(`rd.phase${want}`);
    const adds = ["guardian", "gunner", "drone", "spider", "caster", "elite"], n = 2 + this.opt.difficulty + (want === 3 ? 2 : 0);
    for (let i = 0; i < n; i++) st.queue.push(adds[Math.floor(Math.random() * adds.length)]);
    void player;
  }

  private clear(st: RoomState) {
    st.cleared = true; this.fightsDone++;
    for (const b of st.barriers) { this.group.remove(b.mesh); const i = this.hooks.colliders.indexOf(b.box); if (i >= 0) this.hooks.colliders.splice(i, 1); }
    st.barriers = [];
    if (st.room.kind === "boss") { if (!this.won) { this.won = true; this.hooks.onWin(); } return; }
    this.hooks.onClear(this.fightsDone, this.fights);
    // Contrarreloj superado: cofre de premio en el centro de la sala
    if (st.room.goal === "timed") {
      this.lastTimedOk = st.t <= st.room.limit;
      if (this.lastTimedOk && this.opt.rooms !== 2) { st.chest = this.chest(new THREE.Vector3(RAID_ORIGIN.x + st.room.cx, 0, RAID_ORIGIN.z + st.room.cz), 0xffd040); this.hooks.announce("rd.timedOk", { s: Math.round(st.t) }); }
      else if (!this.lastTimedOk) this.hooks.announce("rd.timedFail");
    }
  }
}
