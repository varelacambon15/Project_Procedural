// Efectos como recetas de datos (prompt 05-C): disparador + condición + acción + modificador + límites + aspecto +
// contrapartida. Las recetas se expanden aquí a definiciones de efecto (las mismas que usa el resto del juego:
// sorteo por rareza, reglas de combinación, coste, ficha) y el ejecutor de efectos (effects.ts) las interpreta de forma
// genérica: no hace falta código nuevo por efecto. El coste de poder se CALCULA desde la receta (bonus × peso de la
// estadística × tiempo que está activa − alivio de la contrapartida) y los tests comprueban que cae en su banda.
import data from "../data/recipes.json";

export type RStat = "dmg" | "rate" | "crit" | "spread" | "recoil" | "reload" | "mag" | "range";
export type RCond = "always" | "aiming" | "hip" | "still" | "moving" | "near" | "lowammo" | "afterkill" | "afterreload" | "big" | "nth" | "killnth" | "hitnth" | "chance";
export type RTrigger = "passive" | "onShot" | "onHit" | "onCrit" | "onKill" | "onReloadEnd";
export type RAction = "stat" | "buff" | "explode" | "chain" | "ignite" | "shards" | "strike" | "pellets" | "pull" | "fury";
export type TradeoffKind = "accuracy" | "recoil" | "rate" | "mag" | "ads" | "reload" | "range" | "ammoPerShot" | "selfDamage" | "heat" | "cooldown";
export interface Tradeoff { kind: TradeoffKind; value: number }
export interface Recipe {
  trigger: RTrigger; cond: RCond; action: RAction; stat?: RStat; value: number;
  /** Límites: cada cuánto (s), cuántas pilas y cuánto dura un bonus temporal. */
  cooldown?: number; stacks?: number; duration?: number;
  /** Parámetros de la condición o la acción: cada n disparos, probabilidad (%), objetivos de la cadena, radio. */
  n?: number; chance?: number; targets?: number; radius?: number;
  tradeoff?: Tradeoff;
  /** Versión "arriesgada" (con contrapartida) de una receta generada. */
  risky?: boolean;
}

const D = data as unknown as {
  statWeight: Record<string, number>; statMax: Record<string, number>; riskyMax: Record<string, number>; uptime: Record<string, number>;
  tradeoffWeight: Record<TradeoffKind, number>; tradeoffMax: Record<TradeoffKind, number>;
  pairs: [RStat, RCond, TradeoffKind][];
  special: ({ id: string; tier: "A" | "B" | "L"; family: string; tags?: string[]; element?: string; trigger: RTrigger; cond: RCond; action: RAction; stat?: RStat; value: number; n?: number; n2?: number; chance?: number; radius?: number; duration?: number; cooldown?: number; tradeoff?: Tradeoff; cost: number; name?: { es: string; en: string }; icon: string })[];
};
/** Estados de control pendientes de decidir (no implementados) y aprobados. */
export const CONTROL_STATES = (data as unknown as { controlStates: { pending: string[]; approved: string[]; discarded: string[] } }).controlStates;

/** Suelos de las contrapartidas: el arma nunca queda inutilizable (cargador ≥ 1 bala, retroceso y precisión con tope). */
export const TRADEOFF_MAX = D.tradeoffMax;
const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);

/** Alivio de coste de una contrapartida (en puntos de poder). */
export const tradeoffRelief = (t: Tradeoff | undefined) => (t ? Math.min(t.value, D.tradeoffMax[t.kind]) * D.tradeoffWeight[t.kind] : 0);
/** Coste bruto del bonus de una receta de estadística (en puntos de poder, ≈ %). */
export const statCost = (stat: RStat, value: number, cond: RCond) => value * (D.statWeight[stat] ?? 0.1) * (D.uptime[cond] ?? 1);

/** Definición de efecto generada desde una receta (mismo formato que los efectos escritos a mano). */
export interface RecipeDef {
  id: string; tier: "A" | "B" | "L"; family: string; tags: string[]; cost: number; events: string[];
  element?: "fuego" | "electrico" | "explosive"; icon: string; name?: string; names?: { es: string; en: string };
  recipe: Recipe; gross: number;
}

const EVENT_OF: Record<RTrigger, string> = { passive: "passive", onShot: "onShot", onHit: "onHit", onCrit: "onCrit", onKill: "onKill", onReloadEnd: "onReloadEnd" };
function eventsOf(r: Recipe): string[] {
  const ev = new Set<string>([EVENT_OF[r.trigger]]);
  if (r.cond === "aiming") ev.add("onADS");
  if (r.cond === "afterkill") { ev.add("onKill"); ev.add("onShot"); }
  if (r.cond === "afterreload") { ev.add("onReloadEnd"); ev.add("onShot"); }
  if (r.action === "buff") ev.add("onShot");
  return [...ev];
}
const FAMILY_OF: Record<RStat, string> = { dmg: "dmg", rate: "rate", crit: "crit", spread: "accuracy", recoil: "recoil", reload: "reload", mag: "mag", range: "range" };
const ICON_OF: Record<RStat, string> = { dmg: "✦", rate: "⇉", crit: "◈", spread: "⌖", recoil: "≡", reload: "↺", mag: "▤", range: "⟷" };

/** Recetas de nivel A generadas: cada par (estadística · condición) en versión sin coste y versión arriesgada. */
function generatedA(): RecipeDef[] {
  const out: RecipeDef[] = [];
  for (const [stat, cond, tk] of D.pairs) {
    const trigger: RTrigger = cond === "always" ? "passive" : "onShot";
    const action: RAction = cond === "afterkill" || cond === "afterreload" ? "buff" : "stat";
    const duration = cond === "afterkill" ? 4 : cond === "afterreload" ? 3 : undefined;
    const n = cond === "nth" ? 4 : undefined;
    const cap = D.statMax[stat] ?? 50;
    // Sin coste: el bonus que cuesta ~7 puntos
    const v = Math.min(cap, round5(7 / ((D.statWeight[stat] ?? 0.1) * (D.uptime[cond] ?? 1))));
    const tags = [...(stat === "dmg" ? ["multiply"] : []), ...(cond === "afterkill" ? ["streak"] : [])];
    const base: Recipe = { trigger, cond, action, stat, value: v, duration, n };
    const g0 = statCost(stat, v, cond);
    const id = `rc-${stat}-${cond}`;
    out.push({ id, tier: "A", family: FAMILY_OF[stat], tags, cost: +g0.toFixed(1), gross: g0, events: eventsOf(base), icon: ICON_OF[stat], recipe: base });
    // Arriesgada: casi el doble de bonus y una contrapartida que lo compensa en parte (pesa más en el presupuesto)
    const v2 = Math.min(D.riskyMax[stat] ?? cap * 1.6, round5(v * 1.9));
    const g1 = statCost(stat, v2, cond);
    const tw = D.tradeoffWeight[tk], tmax = D.tradeoffMax[tk];
    // Una contrapartida de verdad (al menos 10) y suficiente para que el neto no pase de la banda
    const tv = Math.min(tmax, Math.ceil(Math.max(10, (g1 - 9.5) / tw) / 5) * 5);
    const tr: Tradeoff = { kind: tk, value: tv };
    // La versión con coste pesa al menos lo mismo que la limpia: si la contrapartida la deja por debajo, más bonus
    let vR = v2, gR = g1;
    while (gR - tradeoffRelief(tr) < g0 && vR + 5 <= (D.riskyMax[stat] ?? cap * 1.6)) { vR += 5; gR = statCost(stat, vR, cond); }
    const net = gR - tradeoffRelief(tr);
    const risky: Recipe = { ...base, value: vR, tradeoff: tr, risky: true };
    out.push({ id: `${id}-x`, tier: "A", family: FAMILY_OF[stat], tags, cost: +net.toFixed(1), gross: gR, events: eventsOf(risky), icon: ICON_OF[stat], recipe: risky });
  }
  return out;
}

function special(): RecipeDef[] {
  return D.special.map((s) => {
    const r: Recipe = { trigger: s.trigger, cond: s.cond, action: s.action, stat: s.stat, value: s.value, n: s.n, chance: s.chance, targets: s.n2 ?? s.n, radius: s.radius, duration: s.duration, cooldown: s.cooldown, tradeoff: s.tradeoff };
    if (s.action === "chain") { r.targets = s.n ?? 3; r.n = s.cond === "nth" ? s.n : undefined; if (s.cond === "nth") r.targets = s.n2 ?? 2; }
    const tags = [...(s.tags ?? []), ...(s.element ? ["element"] : []), ...(s.action === "stat" && s.stat === "dmg" && s.tier !== "B" ? ["multiply"] : [])];
    return { id: s.id, tier: s.tier, family: s.family, tags, cost: s.cost, gross: s.cost + tradeoffRelief(s.tradeoff), events: eventsOf(r), element: s.element as RecipeDef["element"], icon: s.icon, name: s.tier === "L" ? s.name?.en : undefined, names: s.name, recipe: r };
  });
}

export const RECIPE_DEFS: RecipeDef[] = [...generatedA(), ...special()];
export const recipeOf = (id: string) => RECIPE_DEFS.find((d) => d.id === id)?.recipe ?? null;
