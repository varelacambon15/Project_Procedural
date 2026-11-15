// Contratos diarios y semanales: retos con recompensa en créditos. Se generan de forma determinista por la fecha
// (3 diarios que cambian cada día y 2 semanales que cambian cada lunes) y avanzan con los eventos del juego.
// Lógica pura (sin DOM): la usa main.ts y se prueba en tests/contracts.test.ts.

export type ContractKind = "kills" | "headshots" | "longKills" | "fistKills" | "wave" | "waveClean" | "bossKills";
export interface Contract {
  id: string; kind: ContractKind; goal: number; progress: number; reward: number;
  /** Tipo de arma exigido (kills, headshots) o null si vale cualquiera. */ weapon: string | null;
  /** Distancia mínima en metros (longKills). */ dist?: number;
  done: boolean; claimed: boolean; period: "day" | "week";
}
export interface ContractState { day: string; week: string; list: Contract[] }

export const WEAPON_TYPES = ["pistol", "revolver", "smg", "rifle", "shotgun", "sniper", "lmg"];

/** Día (AAAA-MM-DD) y semana (lunes de esa semana) de una fecha, en hora local. */
export function periodKeys(now: Date): { day: string; week: string } {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const monday = new Date(d); monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return { day: iso(d), week: iso(monday) };
}

function rng(seedStr: string) {
  let h = 2166136261; for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0; return h / 4294967296; };
}
const pick = <T>(r: () => number, l: T[]) => l[Math.floor(r() * l.length)];

function daily(r: () => number, i: number, key: string): Contract {
  const base = { id: `d-${key}-${i}`, progress: 0, done: false, claimed: false, period: "day" as const, weapon: null as string | null };
  switch (i) {
    case 0: { const w = pick(r, WEAPON_TYPES); return { ...base, kind: "kills", weapon: w, goal: w === "sniper" || w === "lmg" ? 15 : 25, reward: 120 }; }
    case 1: return pick(r, [
      { ...base, kind: "headshots" as const, goal: 20, reward: 140 },
      { ...base, kind: "longKills" as const, goal: 10, dist: 35, reward: 150 },
      { ...base, kind: "fistKills" as const, goal: 5, reward: 110 },
    ]);
    default: return pick(r, [
      { ...base, kind: "wave" as const, goal: 5, reward: 180 },
      { ...base, kind: "waveClean" as const, goal: 2, reward: 200 },
      { ...base, kind: "kills" as const, goal: 60, reward: 160 },
    ]);
  }
}
function weekly(r: () => number, i: number, key: string): Contract {
  const base = { id: `w-${key}-${i}`, progress: 0, done: false, claimed: false, period: "week" as const, weapon: null as string | null };
  if (i === 0) return pick(r, [{ ...base, kind: "wave" as const, goal: 15, reward: 900 }, { ...base, kind: "bossKills" as const, goal: 3, reward: 1000 }]);
  const w = pick(r, WEAPON_TYPES);
  return pick(r, [{ ...base, kind: "headshots" as const, weapon: w, goal: 60, reward: 800 }, { ...base, kind: "longKills" as const, goal: 40, dist: 50, reward: 850 }, { ...base, kind: "kills" as const, weapon: w, goal: 150, reward: 750 }]);
}

/** Estado al día: conserva los contratos del día/semana en curso y genera los que tocan. */
export function refreshContracts(s: ContractState | null | undefined, now: Date): ContractState {
  const { day, week } = periodKeys(now);
  const keepD = s && s.day === day ? s.list.filter((c) => c.period === "day") : Array.from({ length: 3 }, (_, i) => daily(rng(`day:${day}:${i}`), i, day));
  const keepW = s && s.week === week ? s.list.filter((c) => c.period === "week") : Array.from({ length: 2 }, (_, i) => weekly(rng(`week:${week}:${i}`), i, week));
  return { day, week, list: [...keepD, ...keepW] };
}

export type ContractEvent =
  | { type: "kill"; weapon: string | null; head: boolean; dist: number; boss: boolean }
  | { type: "wave"; reached: number; clean: boolean };

/** Aplica un evento; devuelve los contratos que se acaban de completar. */
export function applyEvent(s: ContractState, e: ContractEvent): Contract[] {
  const out: Contract[] = [];
  for (const c of s.list) {
    if (c.done) continue;
    let add = 0;
    if (e.type === "kill") {
      const wOk = !c.weapon || c.weapon === e.weapon;
      if (c.kind === "kills" && wOk && e.weapon) add = 1;
      else if (c.kind === "headshots" && wOk && e.head && e.weapon) add = 1;
      else if (c.kind === "longKills" && e.weapon && e.dist >= (c.dist ?? 35)) add = 1;
      else if (c.kind === "fistKills" && !e.weapon) add = 1;
      else if (c.kind === "bossKills" && e.boss) add = 1;
    } else {
      if (c.kind === "wave") { c.progress = Math.max(c.progress, e.reached); }
      else if (c.kind === "waveClean" && e.clean) add = 1;
    }
    c.progress = Math.min(c.goal, c.progress + add);
    if (c.progress >= c.goal) { c.done = true; out.push(c); }
  }
  return out;
}

/** Cobra los contratos completados y no cobrados; devuelve los créditos. */
export function claimAll(s: ContractState): number {
  let n = 0; for (const c of s.list) if (c.done && !c.claimed) { c.claimed = true; n += c.reward; }
  return n;
}
