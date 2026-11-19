// Modo Hack: red de nodos por niveles de profundidad (puro, sin three). En cada nivel se elige uno de 2–3 nodos;
// cada 4 niveles hay un nodo guardián (minijefe) y, tras vencerlo, se puede extraer (quedarse con lo ganado) o
// seguir bajando. Todo sale de la semilla.
import { rng } from "./raidgen";

export type HackNodeKind = "fight" | "elite" | "loot" | "cipher" | "guardian";
export interface HackNode { kind: HackNodeKind; depth: number; seed: number }
/** Mejoras temporales de la partida (las da un nodo cifrado superado). */
export type HackBuff = "damage" | "rate" | "health" | "speed" | "crit";
export const HACK_BUFFS: HackBuff[] = ["damage", "rate", "health", "speed", "crit"];
/** Valor de cada mejora (se acumulan). */
export const HACK_BUFF_VALUE: Record<HackBuff, number> = { damage: 0.15, rate: 0.12, health: 0.2, speed: 0.06, crit: 0.2 };
export const GUARDIAN_EVERY = 4;

/** Opciones del nivel `depth` (1, 2, 3…): el guardián va solo; el resto, 2–3 nodos distintos. */
export function hackChoices(seed: number, depth: number): HackNode[] {
  if (depth % GUARDIAN_EVERY === 0) return [{ kind: "guardian", depth, seed: (seed ^ (depth * 7919)) >>> 0 }];
  const r = rng((seed ^ (depth * 2654435761)) >>> 0), n = r() < 0.45 ? 3 : 2;
  const pool: [HackNodeKind, number][] = [["fight", 5], ["elite", depth > 2 ? 2.2 : 0.8], ["loot", 1.2], ["cipher", 1.4]];
  const out: HackNode[] = [];
  for (let i = 0; i < 20 && out.length < n; i++) {
    let k = r() * pool.reduce((a, p) => a + p[1], 0), pick: HackNodeKind = "fight";
    for (const [id, w] of pool) { k -= w; if (k <= 0) { pick = id; break; } }
    if (out.some((o) => o.kind === pick) && pick !== "fight") continue;
    if (out.filter((o) => o.kind === "fight").length >= 1 && pick === "fight") continue;
    out.push({ kind: pick, depth, seed: Math.floor(r() * 2 ** 31) });
  }
  if (!out.some((o) => o.kind === "fight" || o.kind === "elite")) out[0] = { kind: "fight", depth, seed: out[0].seed };
  return out;
}

/** Enemigos de un nodo: más y más duros cuanto más hondo. */
export function hackEnemies(node: HackNode): string[] {
  const r = rng(node.seed), d = node.depth;
  if (node.kind === "loot") return [];
  if (node.kind === "guardian") return ["warden", ...Array.from({ length: 2 + Math.floor(d / 4) }, () => (r() < 0.5 ? "elite" : "guardian"))];
  if (node.kind === "elite") return ["elite", ...(d > 5 ? ["elite"] : []), ...Array.from({ length: 2 + Math.floor(d / 3) }, () => (r() < 0.5 ? "gunner" : "sturdy"))];
  const n = 4 + Math.floor(d * 1.2) + Math.floor(r() * 3), kinds = ["small", "basic", "basic", "drone", "spider", "roller", "gunner", "sniper", "caster", "sturdy", "glitch", "guardian"];
  return Array.from({ length: n }, () => kinds[Math.floor(r() * Math.min(kinds.length, 6 + d))]);
}

/** Tiempo del nodo cifrado (contrarreloj) para sus enemigos. */
export const cipherLimit = (n: number) => Math.round(14 + n * 2.6);
/** Datos (créditos) que se ganan al superar un nodo; se cobran al extraer. */
export const nodeData = (node: HackNode) => Math.round((40 + node.depth * 18) * (node.kind === "elite" ? 1.8 : node.kind === "guardian" ? 3.5 : node.kind === "cipher" ? 1.4 : 1));
/** Fracción de los datos que se pierden al caer. */
export const DEATH_LOSS = 0.6;
