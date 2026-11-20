// Generador del mapa de una incursión (puro, sin three): una cadena de salas unidas por pasillos sobre una
// cuadrícula, con salas laterales de botín de vez en cuando, coberturas dentro de cada sala de combate y el
// jefe en la última. Todo sale de la semilla: la misma semilla da siempre el mismo mapa.

export type RoomKind = "start" | "fight" | "loot" | "boss";
/** Distribución de una sala: cajas sueltas, bosque de pilares, filas de servidores o un ruedo con barreras bajas. */
export type RoomStyle = "crates" | "pillars" | "racks" | "arena" | "halls" | "ring";
/** Objetivo de una sala de combate: limpiarla, aguantar dos oleadas o limpiarla a contrarreloj (premio extra). */
export type RoomGoal = "purge" | "waves" | "timed";
export interface RaidRoom { i: number; kind: RoomKind; goal: RoomGoal; limit: number; cx: number; cz: number; w: number; d: number; cell: [number, number]; covers: RaidBox[]; enemies: string[]; style: RoomStyle; h: number; shape: RoomShape }
/** Caja en el plano (centro, medidas) y altura. */
export interface RaidBox { x: number; z: number; w: number; d: number; h: number; kind?: "crate" | "pillar" | "rack" | "barrier" | "wall" | "notch" }
export interface RaidCorridor { a: number; b: number; x0: number; z0: number; x1: number; z1: number; width: number }
/**
 * Tema de la incursión: decide el carácter de todo el mapa (formas de sala, estilos de cobertura, tamaños, paleta y
 * densidad de detalle), para que cada incursión se sienta distinta aunque compartan piezas.
 */
export interface RaidTheme { id: string; styles: RoomStyle[]; shapes: number; size: [number, number]; palettes: number[]; columns: number; corridorW: [number, number] }
export const RAID_THEMES: RaidTheme[] = [
  { id: "datacore", styles: ["racks", "halls", "racks", "ring"], shapes: 0.5, size: [18, 34], palettes: [1, 0], columns: 1, corridorW: [5, 6] },     // centro de datos: filas de servidores, columnas de datos
  { id: "foundry", styles: ["crates", "pillars", "arena", "crates"], shapes: 0.7, size: [22, 40], palettes: [2, 4], columns: 0.3, corridorW: [6, 9] }, // fundición: naves grandes y oxidadas
  { id: "labyrinth", styles: ["halls", "halls", "ring", "pillars"], shapes: 0.9, size: [16, 28], palettes: [0, 3], columns: 0.5, corridorW: [5, 5] }, // laberinto: salas recortadas y estrechas
  { id: "arena", styles: ["arena", "ring", "pillars", "arena"], shapes: 0.2, size: [28, 40], palettes: [4, 0], columns: 0.6, corridorW: [7, 9] },      // circuito de combate: ruedos amplios
  { id: "biolab", styles: ["pillars", "crates", "halls", "ring"], shapes: 0.6, size: [18, 32], palettes: [3, 1], columns: 0.8, corridorW: [5, 7] },  // laboratorio: verde químico
];
/** Forma de la planta (recortes de suelo a techo en esquinas o lados). */
export type RoomShape = "box" | "L" | "T" | "cross" | "U";
export interface RaidMap { seed: number; rooms: RaidRoom[]; corridors: RaidCorridor[]; palette: number; theme: string }
export interface RaidOptions { rooms: number; difficulty: 0 | 1 | 2 }

export const CELL = 46;
export const DOOR_W = 5;

/** PRNG pequeño y estable (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const DIRS: [number, number][] = [[0, 1], [1, 0], [-1, 0], [0, -1]];

/** Enemigos de una sala de combate según su posición en la cadena y la dificultad. */
export function roomEnemies(r: () => number, step: number, total: number, difficulty: number): string[] {
  const n = 5 + step + difficulty * 2 + Math.floor(r() * 3);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = r(), late = step / Math.max(1, total);
    out.push(x < 0.2 ? "small" : x < 0.38 ? "basic" : x < 0.48 ? "drone" : x < 0.56 ? "spider" : x < 0.63 ? "roller" : x < 0.68 ? "turret" : x < 0.73 ? "gunner" : x < 0.76 ? "sniper" : x < 0.79 ? "medic" : x < 0.82 ? "glitch" : x < 0.84 ? "caster" : x < 0.89 ? "sturdy" : x < 0.93 ? "guardian" : x < 0.96 + late * 0.02 ? "large" : "elite");
  }
  return out;
}

export function generateRaid(seed: number, opt: RaidOptions): RaidMap {
  const r = rng(seed), total = Math.max(3, Math.min(10, opt.rooms));
  const theme = RAID_THEMES[Math.floor(r() * RAID_THEMES.length)];
  // Camino principal: paseo aleatorio por la cuadrícula sin repetir celdas (preferencia por avanzar en +Z)
  let path: [number, number][] = [];
  for (let tries = 0; tries < 200 && path.length < total; tries++) {
    path = [[0, 0]]; const used = new Set(["0,0"]);
    while (path.length < total) {
      const [x, z] = path[path.length - 1];
      const opts = DIRS.filter(([dx, dz]) => !used.has(`${x + dx},${z + dz}`)).map((d) => ({ d, w: d[1] === 1 ? 3 : d[1] === -1 ? 0.4 : 1.4 }));
      if (!opts.length) break;
      let k = r() * opts.reduce((a, o) => a + o.w, 0), pick = opts[0].d;
      for (const o of opts) { k -= o.w; if (k <= 0) { pick = o.d; break; } }
      const c: [number, number] = [x + pick[0], z + pick[1]]; path.push(c); used.add(`${c[0]},${c[1]}`);
    }
  }
  const used = new Set(path.map(([x, z]) => `${x},${z}`));
  const rooms: RaidRoom[] = [], corridors: RaidCorridor[] = [];
  const mk = (cell: [number, number], kind: RoomKind): RaidRoom => {
    // (variedad: cada lado por separado, salas alargadas o anchas, de pasillo largo a nave grande)
    const [lo, hi] = kind === "boss" ? [32, 40] : kind === "start" ? [16, 22] : kind === "loot" ? [12, 20] : theme.size;
    const w = lo + Math.floor(r() * (hi - lo + 1)), d = lo + Math.floor(r() * (hi - lo + 1));
    return { i: rooms.length, kind, goal: "purge", limit: 0, cx: cell[0] * CELL, cz: cell[1] * CELL, w, d, cell, covers: [], enemies: [], style: "crates", h: 6, shape: "box" };
  };
  path.forEach((c, i) => rooms.push(mk(c, i === 0 ? "start" : i === path.length - 1 ? "boss" : "fight")));
  const link = (a: RaidRoom, b: RaidRoom) => corridors.push({ a: a.i, b: b.i, x0: a.cx, z0: a.cz, x1: b.cx, z1: b.cz, width: theme.corridorW[0] + Math.floor(r() * (theme.corridorW[1] - theme.corridorW[0] + 1)) });
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
  // Salas laterales de botín (callejones sin salida) colgando de alguna sala de combate
  const fights = rooms.filter((x) => x.kind === "fight");
  for (const f of fights) {
    if (r() > 0.35) continue;
    const free = DIRS.map(([dx, dz]) => [f.cell[0] + dx, f.cell[1] + dz] as [number, number]).filter(([x, z]) => !used.has(`${x},${z}`));
    if (!free.length) continue;
    const c = free[Math.floor(r() * free.length)]; used.add(`${c[0]},${c[1]}`);
    const lr = mk(c, "loot"); rooms.push(lr); link(f, lr);
  }
  // Coberturas según el estilo de cada sala, lejos de las puertas y del centro de paso
  const STYLES: RoomStyle[] = ["crates", "pillars", "racks", "arena", "halls", "ring"];
  for (const room of rooms) {
    room.h = room.kind === "boss" ? 9 + Math.floor(r() * 3) : room.kind === "loot" || room.kind === "start" ? 5 : 5 + Math.floor(r() * 7) * 0.8;
    if (room.kind === "start" || room.kind === "loot") continue;
    room.style = room.kind === "boss" ? "pillars" : theme.styles[Math.floor(r() * theme.styles.length)]; void STYLES;
    // Planta recortada (L, T, U o cruz): bloques de suelo a techo en las esquinas o lados, sin tapar las puertas
    if (room.kind === "fight" && room.w >= 20 && room.d >= 20 && r() < theme.shapes) {
      const shapes: RoomShape[] = ["L", "T", "cross", "U"]; room.shape = shapes[Math.floor(r() * shapes.length)];
      const nw = room.w * (0.26 + r() * 0.08), nd = room.d * (0.26 + r() * 0.08), H = room.h;
      const corner = (sx: number, sz: number) => room.covers.push({ x: room.cx + sx * (room.w - nw) / 2, z: room.cz + sz * (room.d - nd) / 2, w: nw, d: nd, h: H, kind: "notch" });
      const pick = Math.floor(r() * 4), C: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      if (room.shape === "L") corner(...C[pick]);
      else if (room.shape === "T") { corner(...C[pick]); corner(...C[(pick + 1) % 4]); }
      else if (room.shape === "cross") for (const c of C) corner(...c);
      else if ((() => { const dz = pick < 2 ? (pick % 2 ? 1 : -1) : 0, dx = pick < 2 ? 0 : (pick % 2 ? 1 : -1); const s2 = pick < 2 ? (dz > 0 ? "n" : "s") : (dx > 0 ? "e" : "w"); return doorsOf({ seed, rooms, corridors, palette: 0, theme: theme.id }, room).includes(s2 as never); })()) room.shape = "box";
      else { const side = pick % 2 ? [1, -1] : [-1, 1]; room.covers.push(pick < 2 ? { x: room.cx, z: room.cz + side[0] * (room.d / 2 - nd / 2), w: room.w * 0.34, d: nd, h: H, kind: "notch" } : { x: room.cx + side[0] * (room.w / 2 - nw / 2), z: room.cz, w: nw, d: room.d * 0.34, h: H, kind: "notch" }); }
      // (las esquinas recortadas nunca tapan una puerta: las puertas van en el centro de cada lado; la U deja libre su lado)
    }
    const doorFree = (x: number, z: number, m = 5) => !(Math.abs(x - room.cx) < DOOR_W && Math.abs(z - room.cz) > room.d / 2 - m || Math.abs(z - room.cz) < DOOR_W && Math.abs(x - room.cx) > room.w / 2 - m);
    if (room.style === "pillars") {
      const step = 6 + Math.floor(r() * 2);
      for (let x = room.cx - room.w / 2 + step / 2 + 1; x < room.cx + room.w / 2 - 2; x += step) for (let z = room.cz - room.d / 2 + step / 2 + 1; z < room.cz + room.d / 2 - 2; z += step) {
        if (Math.hypot(x - room.cx, z - room.cz) < (room.kind === "boss" ? 8 : 3) || !doorFree(x, z) || r() < 0.2) continue;
        room.covers.push({ x, z, w: 1.2, d: 1.2, h: room.h, kind: "pillar" });
      }
      continue;
    }
    if (room.style === "racks") {
      // Filas de servidores con huecos para pasar (y por la mitad, un pasillo)
      for (let z = room.cz - room.d / 2 + 4; z < room.cz + room.d / 2 - 3; z += 4.5) for (let x = room.cx - room.w / 2 + 3.5; x < room.cx + room.w / 2 - 3; x += 5) {
        if (Math.abs(x - room.cx) < 2.5 || !doorFree(x, z, 6) || r() < 0.25) continue;
        room.covers.push({ x, z, w: 3.6, d: 0.9, h: 2.6, kind: "rack" });
      }
      continue;
    }
    if (room.style === "halls") {
      // Galerías: muros interiores de suelo a techo, con un hueco en medio para cruzar (el eje central queda libre)
      const alongZ = room.d >= room.w, L = alongZ ? room.d : room.w, W = alongZ ? room.w : room.d;
      for (const s of W > 22 ? [-1, 1] : [r() < 0.5 ? -1 : 1]) {
        const off = s * W * (0.22 + r() * 0.06), gap = 2.6 + r() * 1.2, a0 = -L / 2 + 3, a1 = L / 2 - 3;
        for (const [p0, p1] of [[a0, -gap], [gap, a1]] as const) {
          const len = p1 - p0, c = (p0 + p1) / 2; if (len < 2) continue;
          room.covers.push(alongZ ? { x: room.cx + off, z: room.cz + c, w: 0.6, d: len, h: room.h, kind: "wall" } : { x: room.cx + c, z: room.cz + off, w: len, d: 0.6, h: room.h, kind: "wall" });
        }
      }
    } else if (room.style === "ring") {
      // Anillo: un gran bloque en el centro (hay que rodearlo) y columnas en las esquinas
      const bw = room.w * (0.22 + r() * 0.1), bd = room.d * (0.22 + r() * 0.1);
      room.covers.push({ x: room.cx, z: room.cz, w: bw, d: bd, h: room.h, kind: "wall" });
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) if (r() < 0.6) room.covers.push({ x: room.cx + sx * room.w * 0.32, z: room.cz + sz * room.d * 0.32, w: 1.2, d: 1.2, h: room.h, kind: "pillar" });
      continue;
    }
    if (room.style === "arena") {
      // Ruedo: un anillo de barreras bajas alrededor del centro con cuatro entradas, y alguna caja fuera
      const R = Math.min(room.w, room.d) * 0.3;
      for (const [dx, dz, w, d] of [[-1, 0, 0.6, R * 0.8], [1, 0, 0.6, R * 0.8], [0, -1, R * 0.8, 0.6], [0, 1, R * 0.8, 0.6]] as const) {
        for (const s of [-1, 1]) room.covers.push(dx ? { x: room.cx + dx * R, z: room.cz + s * R * 0.55, w, d: d * 0.6, h: 1.15, kind: "barrier" } : { x: room.cx + s * R * 0.55, z: room.cz + dz * R, w: w * 0.6, d, h: 1.15, kind: "barrier" });
      }
    }
    const n = room.style === "arena" ? 2 : room.kind === "boss" ? 6 : 3 + Math.floor(r() * 5);
    for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const pillar = r() < 0.3, w = pillar ? 1.2 : 1.4 + r() * 2.6, d = pillar ? 1.2 : 1 + r() * 1.6, h = pillar ? 4 : 1.1 + r() * 0.5;
      const x = room.cx + (r() - 0.5) * (room.w - 6), z = room.cz + (r() - 0.5) * (room.d - 6);
      const nearDoor = Math.abs(x - room.cx) < DOOR_W && Math.abs(z - room.cz) > room.d / 2 - 5 || Math.abs(z - room.cz) < DOOR_W && Math.abs(x - room.cx) > room.w / 2 - 5;
      const clash = room.covers.some((c) => Math.abs(c.x - x) < (c.w + w) / 2 + 1.5 && Math.abs(c.z - z) < (c.d + d) / 2 + 1.5);
      if (nearDoor || clash || (room.style !== "halls" && Math.hypot(x - room.cx, z - room.cz) < 3)) continue;
      room.covers.push({ x, z, w, d, h, kind: pillar ? "pillar" : "crate" }); k++;
    }
  }
  const nFights = fights.length;
  fights.forEach((f, k) => (f.enemies = roomEnemies(r, k, nFights, opt.difficulty)));
  // Objetivos: la primera sala siempre «limpiar»; luego, alguna a contrarreloj
  fights.forEach((f, k) => {
    if (k === 0) return; const x = r();
    if (x < 0.3) { f.goal = "timed"; f.limit = Math.round(18 + f.enemies.length * 3.2); }
  });
  const boss = rooms.find((x) => x.kind === "boss")!;
  for (const f of fights) if (f.enemies.length >= 9 && r() < 0.4) f.enemies[0] = "commander";
  boss.enemies = ["warden", ...roomEnemies(r, nFights, nFights, opt.difficulty).slice(0, 3 + opt.difficulty * 2)];
  return { seed, rooms, corridors, palette: theme.palettes[Math.floor(r() * theme.palettes.length)], theme: theme.id };
}

/** Lados de una sala por los que entra un pasillo ("n" = +Z, "s" = −Z, "e" = +X, "w" = −X). */
export function doorsOf(map: RaidMap, room: RaidRoom): ("n" | "s" | "e" | "w")[] {
  const out: ("n" | "s" | "e" | "w")[] = [];
  for (const c of map.corridors) {
    if (c.a !== room.i && c.b !== room.i) continue;
    const o = map.rooms[c.a === room.i ? c.b : c.a], dx = o.cell[0] - room.cell[0], dz = o.cell[1] - room.cell[1];
    out.push(dz > 0 ? "n" : dz < 0 ? "s" : dx > 0 ? "e" : "w");
  }
  return out;
}
