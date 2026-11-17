// Generador del mapa de una incursión (puro, sin three): una cadena de salas unidas por pasillos sobre una
// cuadrícula, con salas laterales de botín de vez en cuando, coberturas dentro de cada sala de combate y el
// jefe en la última. Todo sale de la semilla: la misma semilla da siempre el mismo mapa.

export type RoomKind = "start" | "fight" | "loot" | "boss";
export interface RaidRoom { i: number; kind: RoomKind; cx: number; cz: number; w: number; d: number; cell: [number, number]; covers: RaidBox[]; enemies: string[] }
/** Caja en el plano (centro, medidas) y altura. */
export interface RaidBox { x: number; z: number; w: number; d: number; h: number }
export interface RaidCorridor { a: number; b: number; x0: number; z0: number; x1: number; z1: number; width: number }
export interface RaidMap { seed: number; rooms: RaidRoom[]; corridors: RaidCorridor[]; palette: number }
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
    const big = kind === "boss" ? 38 : kind === "start" ? 18 : kind === "loot" ? 14 : 22 + Math.floor(r() * 10);
    const w = kind === "boss" ? big : Math.min(CELL - 10, big + Math.floor(r() * 6)), d = kind === "boss" ? big : Math.min(CELL - 10, big + Math.floor(r() * 6));
    return { i: rooms.length, kind, cx: cell[0] * CELL, cz: cell[1] * CELL, w, d, cell, covers: [], enemies: [] };
  };
  path.forEach((c, i) => rooms.push(mk(c, i === 0 ? "start" : i === path.length - 1 ? "boss" : "fight")));
  const link = (a: RaidRoom, b: RaidRoom) => corridors.push({ a: a.i, b: b.i, x0: a.cx, z0: a.cz, x1: b.cx, z1: b.cz, width: DOOR_W });
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
  // Coberturas: cajas y pilares, lejos de las puertas y del centro de paso
  for (const room of rooms) {
    if (room.kind === "start" || room.kind === "loot") continue;
    const n = room.kind === "boss" ? 6 : 3 + Math.floor(r() * 5);
    for (let k = 0, tries = 0; k < n && tries < 60; tries++) {
      const pillar = r() < 0.3, w = pillar ? 1.2 : 1.4 + r() * 2.6, d = pillar ? 1.2 : 1 + r() * 1.6, h = pillar ? 4 : 1.1 + r() * 0.5;
      const x = room.cx + (r() - 0.5) * (room.w - 6), z = room.cz + (r() - 0.5) * (room.d - 6);
      const nearDoor = Math.abs(x - room.cx) < DOOR_W && Math.abs(z - room.cz) > room.d / 2 - 5 || Math.abs(z - room.cz) < DOOR_W && Math.abs(x - room.cx) > room.w / 2 - 5;
      const clash = room.covers.some((c) => Math.abs(c.x - x) < (c.w + w) / 2 + 1.5 && Math.abs(c.z - z) < (c.d + d) / 2 + 1.5);
      if (nearDoor || clash || Math.hypot(x - room.cx, z - room.cz) < 3) continue;
      room.covers.push({ x, z, w, d, h }); k++;
    }
  }
  const nFights = fights.length;
  fights.forEach((f, k) => (f.enemies = roomEnemies(r, k, nFights, opt.difficulty)));
  const boss = rooms.find((x) => x.kind === "boss")!;
  for (const f of fights) if (f.enemies.length >= 9 && r() < 0.4) f.enemies[0] = "commander";
  boss.enemies = ["warden", ...roomEnemies(r, nFights, nFights, opt.difficulty).slice(0, 3 + opt.difficulty * 2)];
  return { seed, rooms, corridors, palette: Math.floor(r() * 3) };
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
