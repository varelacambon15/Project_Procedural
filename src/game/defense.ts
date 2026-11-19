// Defensa del núcleo: catálogo de construibles (torretas, trampas, estructuras y apoyo), sus tres niveles y las
// oleadas del modo. Datos puros (sin three): el comportamiento lo pone defensefx.ts y el flujo main.ts.

export type BuildCat = "turret" | "trap" | "structure" | "support";
/** Cómo actúa un construible. */
export type Behavior =
  | "gun"      // disparo directo al enemigo más cercano en alcance
  | "splash"   // proyectil con daño en área
  | "beam"     // rayo continuo cuyo daño crece mientras sigue al mismo blanco
  | "chain"    // rayo que salta entre varios enemigos
  | "cone"     // cono corto de fuego que quema
  | "mortar"   // tiro parabólico lejano (no alcanza a los muy cercanos)
  | "missile"  // misiles que persiguen
  | "frost"    // ralentiza y acaba congelando
  | "pulse"    // pulso en área alrededor (aturde)
  | "floor"    // trampa de suelo: daña a quien la pisa
  | "blades"   // cuchillas giratorias: mucho daño de cerca
  | "mine"     // estalla al pasar alguien y se rearma
  | "slow"     // campo que ralentiza
  | "wall"     // barrera que bloquea el paso (y se puede romper)
  | "repair"   // repara el núcleo poco a poco
  | "income"   // da créditos al acabar cada oleada
  | "buff"     // potencia a las torretas cercanas
  | "decoy"    // atrae a los enemigos
  | "shield";  // escudo que absorbe daño al núcleo en cada oleada

export interface Build {
  id: string; cat: BuildCat; behavior: Behavior; color: number;
  /** Coste de construir y de cada mejora (nivel 2 y 3). */ cost: [number, number, number];
  /** Por nivel: daño, cadencia (s entre acciones), alcance (m) y un valor propio del tipo (radio, saltos, % de frenado…). */
  dmg: [number, number, number]; rate: [number, number, number]; range: [number, number, number]; extra: [number, number, number];
  /** Vida (estructuras que los enemigos pueden romper). */ hp?: [number, number, number];
}

export const BUILDS: Build[] = [
  // ---- Torretas ----
  { id: "gatling", cat: "turret", behavior: "gun", color: 0xffd060, cost: [150, 160, 260], dmg: [12, 18, 28], rate: [0.12, 0.1, 0.08], range: [18, 20, 23], extra: [0, 0, 0] },
  { id: "cannon", cat: "turret", behavior: "splash", color: 0xff9a40, cost: [220, 220, 340], dmg: [110, 170, 260], rate: [1.6, 1.4, 1.2], range: [20, 22, 25], extra: [2.5, 3, 3.6] },
  { id: "laser", cat: "turret", behavior: "beam", color: 0xff3a5a, cost: [260, 260, 400], dmg: [30, 46, 70], rate: [0.1, 0.1, 0.1], range: [16, 18, 20], extra: [3, 3.5, 4] },
  { id: "tesla", cat: "turret", behavior: "chain", color: 0x8fd8ff, cost: [240, 240, 380], dmg: [60, 90, 140], rate: [1.1, 0.95, 0.8], range: [14, 15, 17], extra: [3, 4, 6] },
  { id: "flamer", cat: "turret", behavior: "cone", color: 0xff5a1e, cost: [200, 200, 320], dmg: [22, 34, 50], rate: [0.15, 0.15, 0.15], range: [8, 9, 10], extra: [0.6, 0.65, 0.7] },
  { id: "mortar", cat: "turret", behavior: "mortar", color: 0xc0a060, cost: [280, 280, 420], dmg: [180, 260, 380], rate: [3, 2.7, 2.3], range: [38, 42, 46], extra: [4, 4.6, 5.4] },
  { id: "railgun", cat: "turret", behavior: "gun", color: 0x7ab8ff, cost: [320, 320, 480], dmg: [380, 560, 820], rate: [2.6, 2.3, 2], range: [45, 50, 55], extra: [0, 0, 0] },
  { id: "rockets", cat: "turret", behavior: "missile", color: 0xff7ad0, cost: [300, 300, 460], dmg: [70, 100, 150], rate: [2, 1.8, 1.5], range: [26, 29, 32], extra: [3, 4, 6] },
  { id: "cryo", cat: "turret", behavior: "frost", color: 0x9fe8ff, cost: [210, 210, 330], dmg: [8, 12, 18], rate: [0.25, 0.22, 0.2], range: [14, 15, 17], extra: [0.45, 0.55, 0.65] },
  { id: "emp", cat: "turret", behavior: "pulse", color: 0xa070ff, cost: [260, 260, 400], dmg: [40, 60, 90], rate: [4, 3.5, 3], range: [7, 8, 9.5], extra: [1, 1.4, 1.8] },
  // ---- Trampas ----
  { id: "shockfloor", cat: "trap", behavior: "floor", color: 0x6ad8ff, cost: [120, 120, 200], dmg: [18, 28, 42], rate: [0.3, 0.3, 0.3], range: [2.2, 2.6, 3], extra: [0, 0, 0] },
  { id: "blades", cat: "trap", behavior: "blades", color: 0xd0d8e0, cost: [180, 180, 280], dmg: [45, 70, 105], rate: [0.35, 0.3, 0.25], range: [2, 2.3, 2.6], extra: [0, 0, 0] },
  { id: "mine", cat: "trap", behavior: "mine", color: 0xff3040, cost: [100, 100, 180], dmg: [260, 380, 560], rate: [6, 5, 4], range: [2.2, 2.4, 2.6], extra: [4, 4.5, 5] },
  { id: "tar", cat: "trap", behavior: "slow", color: 0x60a040, cost: [110, 110, 180], dmg: [0, 0, 0], rate: [0.2, 0.2, 0.2], range: [3.5, 4.2, 5], extra: [0.4, 0.55, 0.7] },
  // ---- Estructuras ----
  { id: "barrier", cat: "structure", behavior: "wall", color: 0x8a96a8, cost: [80, 100, 160], dmg: [0, 0, 0], rate: [1, 1, 1], range: [0, 0, 0], extra: [0, 0, 0], hp: [900, 1600, 2600] },
  { id: "decoytower", cat: "structure", behavior: "decoy", color: 0x50f0ff, cost: [160, 160, 260], dmg: [0, 0, 0], rate: [1, 1, 1], range: [12, 14, 16], extra: [0, 0, 0], hp: [700, 1200, 1900] },
  // ---- Apoyo ----
  { id: "repairer", cat: "support", behavior: "repair", color: 0x7affc8, cost: [200, 200, 320], dmg: [0, 0, 0], rate: [1, 1, 1], range: [0, 0, 0], extra: [8, 14, 22] },
  { id: "generator", cat: "support", behavior: "income", color: 0xf2c040, cost: [180, 220, 300], dmg: [0, 0, 0], rate: [1, 1, 1], range: [0, 0, 0], extra: [70, 130, 210] },
  { id: "beacon", cat: "support", behavior: "buff", color: 0xffe2a0, cost: [240, 240, 360], dmg: [0, 0, 0], rate: [1, 1, 1], range: [8, 9, 10], extra: [0.2, 0.3, 0.45] },
  { id: "coreshield", cat: "support", behavior: "shield", color: 0x4a90e8, cost: [260, 260, 380], dmg: [0, 0, 0], rate: [1, 1, 1], range: [0, 0, 0], extra: [300, 550, 900] },
];
export const BUILD = Object.fromEntries(BUILDS.map((b) => [b.id, b])) as Record<string, Build>;

/** Lo que se recupera al vender (la mitad de lo invertido). */
export const sellValue = (b: Build, level: number) => Math.floor(b.cost.slice(0, level).reduce((a, c) => a + c, 0) * 0.5);

export const CORE_HP = 2500;
export const START_CREDITS = 450;
/** Créditos por baja según el enemigo y premio al acabar cada oleada. */
export const killReward = (kind: string, boss: boolean) => (boss ? 300 : ["large", "elite", "sturdy", "guardian"].includes(kind) ? 40 : ["small", "roller"].includes(kind) ? 10 : 20);
export const waveReward = (w: number) => 120 + w * 25;
/** Segundos para construir entre oleadas. */
export const BUILD_TIME = 25;

/** Enemigos que no van a por el núcleo sino a por ti (te obligan a moverte). */
export const HUNTERS = new Set(["drone", "glitch", "sniper"]);

/** Oleada `w` (1, 2, 3…): cada 5, un jefe. */
export function coreWave(w: number, rnd: () => number): string[] {
  const n = 6 + Math.floor(w * 2.2);
  const pool = ["small", "basic", "basic", "spider", "roller", "sturdy", "gunner", "drone", "guardian", "caster", "glitch", "large", "elite", "sniper"];
  const out = Array.from({ length: n }, () => pool[Math.floor(rnd() * Math.min(pool.length, 5 + w))]);
  if (w % 5 === 0) out.push("warden");
  return out;
}
