// Efectos de rareza como módulos de datos (src/data/effects.json) con lógica por eventos. Sin dibujo ni Three.js:
// el arma pregunta "¿qué cambia este disparo / impacto / baja?" y recibe multiplicadores y ACCIONES (explotar,
// encadenar, prender…), que ejecuta la capa de juego. Así no hay lógica de efectos suelta en gun.ts.
import data from "../data/effects.json";
import type { Effect, WeaponSpec } from "./types";
import { RECIPE_DEFS, TRADEOFF_MAX, type Recipe, type RStat } from "./recipes";

export type Tier = "A" | "B" | "L";
export type El = "fuego" | "electrico" | "explosive";
export interface EffectDef {
  id: string; tier: Tier; family: string; tags: string[]; cost: number; events: string[];
  params?: Record<string, number>; element?: El; icon: string; color: string; name?: string; range?: [number, number]; overlap?: string; only?: string[];
  /** Efecto escrito como receta (05-C): lo interpreta el ejecutor genérico. */
  recipe?: Recipe; names?: { es: string; en: string };
}
const EL_COLOR: Record<El, string> = { fuego: "#f07a2a", electrico: "#5cc8f0", explosive: "#ffb060" };
const TIER_COLOR: Record<Tier, string> = { A: "#d8d2c4", B: "#e8b25a", L: "#f08a24" };
export const EFFECT_DEFS: EffectDef[] = [
  ...(data.effects as unknown as EffectDef[]).map((e) => ({ ...e, color: e.color ?? TIER_COLOR[e.tier], tags: e.tags ?? [] })),
  // Recetas (05-C): se suman al catálogo con el mismo formato
  ...RECIPE_DEFS.map((r) => ({ id: r.id, tier: r.tier, family: r.family, tags: r.tags, cost: r.cost, events: r.events, element: r.element, icon: r.icon, color: r.element ? EL_COLOR[r.element] : TIER_COLOR[r.tier], name: r.name, names: r.names, recipe: r.recipe })),
];
export const effectDef = (id: string) => EFFECT_DEFS.find((e) => e.id === id);
export const EFFECTS_A = EFFECT_DEFS.filter((e) => e.tier === "A");
export const EFFECTS_B = EFFECT_DEFS.filter((e) => e.tier === "B");
export const EFFECTS_L = EFFECT_DEFS.filter((e) => e.tier === "L");
const P = (id: string, k: string, d = 0) => effectDef(id)?.params?.[k] ?? d;

/**
 * Reglas de combinación: familias distintas; como mucho un efecto de racha ("streak") y uno que multiplica daño
 * ("multiply"); como mucho un elemento; efectos limitados a ciertos tipos ("only").
 */
export function legalWith(current: Pick<Effect, "id">[], cand: EffectDef, type: string): boolean {
  const defs = current.map((e) => effectDef(e.id)).filter(Boolean) as EffectDef[];
  if (defs.some((d) => d.family === cand.family)) return false;
  for (const tag of ["streak", "multiply", "element"]) if (cand.tags.includes(tag) && defs.some((d) => d.tags.includes(tag))) return false;
  if (cand.only && !cand.only.includes(type)) return false;
  // Contrapartidas: como mucho dos por arma, y la penalización de diseño del elemento (eléctrico, explosivo) cuenta
  if (tradeoffCount([...defs, cand]) > 2) return false;
  return true;
}
/** Número de contrapartidas de un conjunto de efectos (las de las recetas más la del elemento eléctrico o explosivo). */
export function tradeoffCount(defs: EffectDef[]) {
  return defs.filter((d) => d.recipe?.tradeoff).length + (defs.some((d) => d.element === "electrico" || d.element === "explosive") ? 1 : 0);
}
/** Coste de poder total de los efectos de un arma (en %). */
export const effectsCost = (effects: Pick<Effect, "id">[]) => effects.reduce((a, e) => a + (effectDef(e.id)?.cost ?? 0), 0);

/** Acciones que pide un efecto; las ejecuta el juego (que sabe de posiciones, rayos y enemigos). */
export type FxAction<T, V> =
  | { type: "explode"; at: V; dmg: number; element: El | null; except?: T; color?: number }
  | { type: "chain"; from: T; dmg: number; n: number }
  | { type: "bounce"; from: T; at: V; dmg: number }
  | { type: "igniteNear"; at: V; radius: number; dmg: number; except?: T }
  | { type: "unstableNear"; at: V; radius: number; seconds: number; except?: T }
  | { type: "shards"; at: V; n: number; dmg: number }
  | { type: "strike"; target: T; radius: number; dmg: number }
  | { type: "shockwave"; at: V; radius: number; dmg: number }
  | { type: "later"; delay: number; action: FxAction<T, V> }
  | { type: "ammo"; n: number }
  | { type: "refill" }
  | { type: "echo"; delay: number }
  // Recetas (05-C): rayo en un punto, atracción (único estado de control aprobado, con tope) y explosión con autodaño
  | { type: "strikeAt"; at: V; radius: number; dmg: number }
  | { type: "pull"; at: V; radius: number; seconds: number; then: number }
  | { type: "selfBlast"; at: V; dmg: number; self: number };

/**
 * Cambios de estadística de los efectos-receta (bonus pasivos y contrapartidas), para computeStats. Con suelos: el
 * cargador nunca baja de 1 bala (lo redondea computeStats), la cadencia y el alcance tienen tope de pérdida.
 */
export function recipeStatMods(effects: Pick<Effect, "id">[]) {
  // Multiplicadores (cargador, alcance, cadencia), puntos (precisión) y estadísticas recortadas por una contrapartida
  const m = { cargador: 1, alcance: 1, cadencia: 1, precision: 0, blocked: new Set<string>() };
  for (const e of effects) {
    const r = effectDef(e.id)?.recipe; if (!r) continue;
    if (r.action === "stat" && r.trigger === "passive") { if (r.stat === "mag") m.cargador *= 1 + r.value / 100; if (r.stat === "range") m.alcance *= 1 + r.value / 100; }
    const t = r.tradeoff; if (!t) continue;
    const v = Math.min(t.value, TRADEOFF_MAX[t.kind]) / 100;
    if (t.kind === "mag") { m.cargador *= 1 - v; m.blocked.add("cargador"); }
    if (t.kind === "rate") { m.cadencia *= 1 - v; m.blocked.add("cadencia"); }
    if (t.kind === "range") { m.alcance *= 1 - v; m.blocked.add("alcance"); }
    if (t.kind === "accuracy") { m.precision -= v * 100; m.blocked.add("precision"); }
  }
  m.cadencia = Math.max(0.6, m.cadencia); m.alcance = Math.max(0.55, m.alcance); m.precision = Math.max(-30, m.precision);
  return m;
}

/** Lo que cambia un disparo. */
export interface ShotMods { dmg: number; pellets: number; recoil: number; pierce: number; critMult: number; forceCrit: boolean; spread: number; element: El | null }

/**
 * Estado y lógica de los efectos de UN arma. `T` es el tipo de enemigo y `V` el de posición (opacos para este módulo).
 */
export class EffectRunner<T, V> {
  private has: (id: string) => boolean;
  private val: (id: string) => number;
  private killT = 0; private reloadAfterKill = false; private killclipT = 0;
  private rampage = 0; private rampageT = 0; private frenzyT = 0;
  private tally = 0; private tallyT = 0; private deadhand = false;
  private breath = 0; private relayT = 0; private sprintRun = 0; private kickT = 0; private volt = false; private voltT = 0;
  private spin = 0; private firingT = 0; private altFire = true;
  private marks = new Map<T, number>(); private tremor = new Map<T, number[]>();
  readonly sig: string | null;
  // Recetas: bonus temporales (con pilas), enfriamientos, contador de disparos, último contexto, furia y calor
  private recipes: { id: string; r: Recipe }[] = [];
  private buffs = new Map<string, { t: number; stacks: number }>(); private cds = new Map<string, number>();
  private shotN = 0; private ctx = { aiming: false, moving: 0, near: 0, ammoFrac: 1 };
  private furyT = 0; private furyAfter = false;

  constructor(readonly spec: WeaponSpec) {
    const ids = new Set(spec.effects.map((e) => e.id));
    this.has = (id) => ids.has(id);
    this.val = (id) => spec.effects.find((e) => e.id === id)?.value ?? 0;
    this.sig = spec.effects.find((e) => e.tier === "L")?.id ?? null;
    for (const e of spec.effects) { const r = effectDef(e.id)?.recipe; if (r) this.recipes.push({ id: e.id, r }); }
  }

  // ---------- Intérprete de recetas ----------
  private condOk(r: Recipe, big = false): boolean {
    const c = this.ctx;
    switch (r.cond) {
      case "always": return true;
      case "aiming": return c.aiming;
      case "hip": return !c.aiming;
      case "still": return c.moving < 0.1;
      case "moving": return c.moving > 0.3;
      case "near": return c.near >= 3;
      case "lowammo": return c.ammoFrac <= 0.3;
      case "big": return big;
      case "nth": return this.shotN % (r.n ?? 4) === 0;
      case "chance": return Math.random() * 100 < (r.chance ?? 30);
      case "afterkill": case "afterreload": return false; // son bonus temporales (buffs)
    }
  }
  private ready(id: string, r: Recipe) { if ((this.cds.get(id) ?? 0) > 0) return false; if (r.cooldown) this.cds.set(id, r.cooldown); return true; }
  private startBuff(id: string, r: Recipe) { const b = this.buffs.get(id); this.buffs.set(id, { t: r.duration ?? 4, stacks: Math.min(r.stacks ?? 1, (b?.stacks ?? 0) + 1) }); }
  /** Suma de bonus de una estadística (en %) por recetas activas ahora (condición cumplida o bonus temporal). */
  private statBonus(stat: RStat, big = false): number {
    let v = 0;
    for (const { id, r } of this.recipes) {
      if (r.stat !== stat) continue;
      if (r.action === "stat" && (r.trigger === "onShot" || r.trigger === "passive") && this.condOk(r, big)) v += r.value;
      const b = this.buffs.get(id); if (b && b.t > 0) v += r.value * b.stacks;
    }
    return v;
  }
  private tradeoff(kind: string) { let v = 0; for (const { r } of this.recipes) if (r.tradeoff?.kind === kind) v = Math.max(v, Math.min(r.tradeoff.value, TRADEOFF_MAX[r.tradeoff.kind])); return v; }
  /** Acciones de una receta disparada en un punto / sobre un objetivo. */
  private act(r: Recipe, at: V, target: T | null, baseDmg: number, except?: T): FxAction<T, V>[] {
    const el = this.element();
    switch (r.action) {
      case "explode": return r.tradeoff?.kind === "selfDamage" ? [{ type: "selfBlast", at, dmg: baseDmg * r.value, self: 6 }] : [{ type: "explode", at, dmg: baseDmg * r.value, element: el, except }];
      case "chain": return target ? [{ type: "chain", from: target, dmg: baseDmg * r.value, n: r.targets ?? 3 }] : [];
      case "ignite": return [{ type: "igniteNear", at, radius: r.radius ?? 4, dmg: baseDmg * r.value * 2, except }];
      case "shards": return [{ type: "shards", at, n: r.targets ?? 3, dmg: baseDmg * r.value }];
      case "strike": return [{ type: "strikeAt", at, radius: r.radius ?? 6, dmg: baseDmg * r.value }];
      case "pull": return [{ type: "pull", at, radius: r.radius ?? 8, seconds: Math.min(1.2, r.value), then: baseDmg * 1.5 }];
      default: return [];
    }
  }
  /** Balas que gasta cada disparo (racimo: varias; furia: ninguna). */
  ammoPerShot() { if (this.furyT > 0) return 0; return Math.max(1, Math.round(this.tradeoff("ammoPerShot")) || 1); }
  /** Velocidad al apuntar (contrapartida de algunos cargadores grandes). */
  adsMult() { return 1 - this.tradeoff("ads") / 100; }
  /** Calor por disparo (0 si el arma no se sobrecalienta). */
  heatPerShot() { return this.tradeoff("heat") ? 0.045 : 0; }
  /** Fuego automático forzado (modo furia). */
  autoFire() { return this.furyT > 0; }
  /** Estado de furia (para la interfaz). */
  get fury() { return this.furyT; }

  /** Elemento actual (el "alternador" cambia entre fuego y eléctrico en cada cargador). */
  element(): El | null {
    if (this.sig === "alternator") return this.altFire ? "fuego" : "electrico";
    return (this.spec.effects.find((e) => e.element)?.element as El | undefined) ?? null;
  }

  /** Paso de tiempo: temporizadores y efectos que dependen de apuntar, disparar o esprintar. */
  tick(dt: number, c: { aiming: boolean; firing: boolean; sprinting: boolean }) {
    const dec = (x: number) => Math.max(0, x - dt);
    this.killT = dec(this.killT); this.killclipT = dec(this.killclipT); this.frenzyT = dec(this.frenzyT);
    this.rampageT = dec(this.rampageT); if (this.rampageT <= 0) this.rampage = 0;
    this.tallyT = dec(this.tallyT); if (this.tallyT <= 0) this.tally = 0;
    this.relayT = dec(this.relayT); this.kickT = dec(this.kickT); this.voltT = dec(this.voltT); if (this.voltT <= 0) this.volt = false;
    for (const [k, b] of this.buffs) { b.t -= dt; if (b.t <= 0) this.buffs.delete(k); }
    for (const [k, t] of this.cds) this.cds.set(k, Math.max(0, t - dt));
    if (this.furyT > 0) { this.furyT = dec(this.furyT); if (this.furyT <= 0) this.furyAfter = true; }
    this.ctx.aiming = c.aiming;
    // Pulso firme: apuntar sin disparar acumula
    this.breath = c.aiming && !c.firing ? this.breath + dt : 0;
    // Sprint y fuego: tras esprintar un rato, bonus breve al dejar de esprintar
    if (c.sprinting) this.sprintRun += dt; else { if (this.sprintRun >= P("kickstart", "sprint", 1) && this.has("kickstart")) this.kickT = P("kickstart", "seconds", 2); this.sprintRun = 0; }
    // Cadencia creciente: sube mientras se dispara y baja al soltar
    this.firingT = c.firing ? this.firingT + dt : 0;
    this.spin = c.firing ? Math.min(P("spinup", "max", 80), this.spin + P("spinup", "perSecond", 40) * dt) : Math.max(0, this.spin - 120 * dt);
  }

  /** Al sacar el arma: relevo (bonus si la otra arma acaba de hacer daño); la racha se pierde al guardarla. */
  equip(otherDealtRecently: boolean) {
    if (this.has("relay") && otherDealtRecently) this.relayT = P("relay", "seconds", 4);
    this.tally = 0;
  }

  /** Multiplicador de cadencia (frenesí, ritmo, cadencia creciente). */
  rateMult(): number {
    let m = 1;
    if (this.frenzyT > 0) m *= 1 + P("frenzy", "rate", 50) / 100;
    if (this.sig === "spinup") m *= 1 + this.spin / 100;
    const rb = this.statBonus("rate"); if (rb) m *= 1 + rb / 100;
    return m;
  }

  /** Lo que cambia el siguiente disparo. `ammoFrac` = balas que quedan / cargador (antes de disparar). */
  shot(c: { fullMag: boolean; ammoFrac: number; aiming: boolean; nearCount: number; pellets: number; moving?: number }): ShotMods {
    this.shotN++; this.ctx = { aiming: c.aiming, moving: c.moving ?? 0, near: c.nearCount, ammoFrac: c.ammoFrac };
    const m: ShotMods = { dmg: 1, pellets: c.pellets, recoil: 1 - this.val("steady") / 100, pierce: 1, critMult: 2 * (1 + this.val("headhunter") / 100), forceCrit: false, spread: 1, element: this.element() };
    if (this.has("doble")) { m.pellets *= 2; m.recoil *= 1.4; }
    if (c.fullMag && this.has("opening")) m.dmg *= 1 + this.val("opening") / 100;
    if (this.killclipT > 0) m.dmg *= 1 + P("killclip", "bonus", 35) / 100;
    if (this.rampage > 0) m.dmg *= 1 + (P("rampage", "perKill", 10) / 100) * this.rampage;
    if (this.tally > 0) m.dmg *= 1 + Math.min(P("tally", "max", 10), this.tally * P("tally", "perKill", 2.5)) / 100;
    if (this.has("breath") && this.breath >= P("breath", "hold", 1.5)) { m.dmg *= 1 + P("breath", "bonus", 15) / 100; this.breath = 0; }
    if (this.has("lastbullets") && c.ammoFrac <= P("lastbullets", "fraction", 0.2)) m.dmg *= 1 + P("lastbullets", "bonus", 15) / 100;
    if (this.relayT > 0) m.dmg *= 1 + P("relay", "bonus", 15) / 100;
    if (this.has("surrounded") && c.nearCount >= P("surrounded", "count", 3)) m.dmg *= 1 + P("surrounded", "bonus", 12) / 100;
    if (this.kickT > 0) m.dmg *= 1 + P("kickstart", "bonus", 15) / 100;
    if (this.has("choke") && c.aiming) { m.spread *= 1 - P("choke", "spread", 50) / 100; m.dmg *= 1 + P("choke", "bonus", 10) / 100; }
    if (this.sig === "lastrounds" && c.ammoFrac <= 0.25) m.dmg *= 2;
    if (this.sig === "deadhand" && this.deadhand) { m.dmg *= 3; m.forceCrit = true; this.deadhand = false; }
    m.pierce = this.has("piercing") ? 3 : this.has("pierce") ? 2 : 1;
    // Recetas: daño, crítico, dispersión y retroceso (con su condición o bonus temporal), proyectiles y contrapartidas
    if (this.recipes.length) {
      const d = this.statBonus("dmg"); if (d) m.dmg *= 1 + d / 100;
      const cr = this.statBonus("crit"); if (cr) m.critMult *= 1 + cr / 100;
      const sp = this.statBonus("spread"); if (sp) m.spread *= Math.max(0.15, 1 - sp / 100);
      const rc = this.statBonus("recoil"); if (rc) m.recoil *= Math.max(0.15, 1 - rc / 100);
      const rk = this.tradeoff("recoil"); if (rk) m.recoil *= 1 + rk / 100;
      for (const { r } of this.recipes) if (r.action === "pellets") m.pellets = Math.min(24, m.pellets * r.value);
    }
    return m;
  }
  /** Dispersión al apuntar (concentración). */
  spreadFocus(aimT: number) { return 1 - (this.val("adsfocus") / 100) * aimT; }

  /** Multiplicador del impacto sobre un objetivo concreto (primer golpe, cazatanques). */
  hitMult(t: { full: boolean; big: boolean; crit?: boolean }): number {
    let m = 1;
    if (this.has("instigator") && t.full) m *= 1 + P("instigator", "bonus", 20) / 100;
    if (this.has("giantslayer") && t.big) m *= 1 + P("giantslayer", "bonus", 25) / 100;
    // Recetas "contra objetivos grandes" (daño; el crítico se aplica si el impacto es crítico)
    if (t.big) for (const { r } of this.recipes) if (r.cond === "big" && r.action === "stat") { if (r.stat === "dmg") m *= 1 + r.value / 100; if (r.stat === "crit" && t.crit) m *= 1 + r.value / 200; }
    return m;
  }

  /** Acciones tras un impacto a un enemigo. */
  afterHit(h: { target: T; point: V; dmg: number; crit: boolean; baseDmg: number; now: number }): FxAction<T, V>[] {
    const out: FxAction<T, V>[] = [];
    const el = this.element();
    if (el === "explosive" && !this.has("timedpayload") && !this.has("unstable")) out.push({ type: "explode", at: h.point, dmg: h.dmg * 0.4, element: "explosive", except: h.target });
    if (this.has("timedpayload")) out.push({ type: "later", delay: P("timedpayload", "delay", 0.6), action: { type: "explode", at: h.point, dmg: h.dmg * 0.55, element: "explosive" } });
    if (el === "electrico") out.push({ type: "chain", from: h.target, dmg: h.dmg * 0.4, n: 2 });
    if (this.volt) { out.push({ type: "chain", from: h.target, dmg: h.baseDmg * 0.8, n: P("voltshot", "targets", 3) }); this.volt = false; }
    if (this.has("rebote")) out.push({ type: "bounce", from: h.target, at: h.point, dmg: h.dmg * 0.5 });
    if (this.has("tremors")) {
      const list = (this.tremor.get(h.target) ?? []).filter((x) => h.now - x < P("tremors", "window", 1)); list.push(h.now);
      if (list.length >= P("tremors", "hits", 3)) { out.push({ type: "shockwave", at: h.point, radius: P("tremors", "radius", 3), dmg: P("tremors", "damage", 60) + h.baseDmg * 0.5 }); list.length = 0; }
      this.tremor.set(h.target, list);
    }
    if (this.sig === "widowmark") {
      const n = (this.marks.get(h.target) ?? 0) + 1;
      if (n >= 5) { this.marks.delete(h.target); out.push({ type: "explode", at: h.point, dmg: h.baseDmg * 1.5, element: null, color: 0xc040ff }); } else this.marks.set(h.target, n);
    }
    if (this.sig === "verdict" && h.crit) out.push({ type: "explode", at: h.point, dmg: h.dmg * 0.8, element: null, except: h.target, color: 0xffd060 });
    for (const { id, r } of this.recipes) {
      if (!(r.trigger === "onHit" || (r.trigger === "onCrit" && h.crit))) continue;
      if (r.action === "stat" || r.action === "buff") continue;
      if (!this.condOk(r) || !this.ready(id, r)) continue;
      out.push(...this.act(r, h.point, h.target, h.baseDmg, r.action === "explode" ? h.target : undefined));
    }
    return out;
  }

  /** Acciones al matar. */
  kill(k: { target: T; point: V; baseDmg: number; mag: number }): FxAction<T, V>[] {
    const out: FxAction<T, V>[] = [];
    this.killT = 3;
    if (this.has("scavenger")) out.push({ type: "ammo", n: 1 });
    if (this.has("frenzy")) this.frenzyT = P("frenzy", "seconds", 5);
    if (this.has("rampage")) { this.rampage = Math.min(P("rampage", "max", 3), this.rampage + 1); this.rampageT = P("rampage", "seconds", 4); }
    if (this.has("tally")) { this.tally++; this.tallyT = P("tally", "seconds", 6); }
    if (this.has("spreadfire")) out.push({ type: "igniteNear", at: k.point, radius: P("spreadfire", "radius", 5), dmg: k.baseDmg, except: k.target });
    if (this.has("unstable")) out.push({ type: "unstableNear", at: k.point, radius: P("unstable", "radius", 6), seconds: P("unstable", "seconds", 4), except: k.target });
    if (this.sig === "olddog") out.push({ type: "refill" });
    if (this.sig === "deadhand") this.deadhand = true;
    if (this.sig === "stormcaller") out.push({ type: "strike", target: k.target, radius: 8, dmg: k.baseDmg * 1.2 });
    for (const { id, r } of this.recipes) {
      if (r.cond === "afterkill") { this.startBuff(id, r); continue; }
      if (r.trigger !== "onKill") continue;
      if (r.action === "buff") { this.startBuff(id, r); continue; }
      if (r.action === "fury") { if (this.ready(id, r)) this.furyT = r.value; continue; }
      if (!this.ready(id, r)) continue;
      out.push(...this.act(r, k.point, k.target, k.baseDmg, k.target));
    }
    return out;
  }

  /** Acciones tras un disparo completo (todas las balas). */
  afterShot(c: { shotCount: number; firstHit: V | null; echo: boolean; baseDmg: number; hitAny: boolean; firstTarget?: T | null }): FxAction<T, V>[] {
    const out: FxAction<T, V>[] = [];
    // Recetas "cada N disparos" con acción (explosión, cadena, rayo) en el primer impacto
    if (!c.echo && c.firstHit != null) for (const { id, r } of this.recipes) {
      if (r.trigger !== "onShot" || r.cond !== "nth" || r.action === "stat" || r.action === "pellets") continue;
      if (this.shotN % (r.n ?? 4) !== 0 || !this.ready(id, r)) continue;
      out.push(...this.act(r, c.firstHit, c.firstTarget ?? null, c.baseDmg));
    }
    if (this.sig === "requiem" && c.shotCount % 6 === 0 && c.firstHit) out.push({ type: "shards", at: c.firstHit, n: 6, dmg: c.baseDmg * 0.4 });
    if (!c.echo && this.has("eco") && c.shotCount % 5 === 0) out.push({ type: "echo", delay: 0.5 });
    if (!c.echo && this.sig === "echochamber" && c.shotCount % 4 === 0) out.push({ type: "echo", delay: 0.25 }, { type: "echo", delay: 0.5 });
    if (!c.echo && !c.hitAny && this.has("refund") && Math.random() * 100 < P("refund", "chance", 15)) out.push({ type: "ammo", n: 1 });
    return out;
  }

  /** Multiplicador del tiempo de recarga. */
  reloadMult(): number {
    let m = 1;
    if (this.killT > 0 && this.has("killreload")) m *= 1 - this.val("killreload") / 100;
    if (this.has("rapid")) m *= 1 - P("rapid", "reload", 10) / 100;
    // Recetas: recarga más rápida (con su condición o tras una baja), contrapartida de recarga lenta y resaca de la furia
    const rb = this.statBonus("reload"); if (rb) m *= Math.max(0.2, 1 - rb / 100);
    const rt = this.tradeoff("reload"); if (rt && !this.recipes.some((x) => x.r.action === "fury")) m *= 1 + rt / 100;
    if (this.furyAfter) { m *= 1 + (rt || 100) / 100; this.furyAfter = false; }
    this.reloadAfterKill = this.killT > 0;
    this.tally = 0; // la racha se pierde al recargar
    return m;
  }
  /** Fin de la recarga. */
  reloadEnd() {
    if (this.reloadAfterKill && this.has("killclip")) this.killclipT = P("killclip", "seconds", 4);
    if (this.reloadAfterKill && this.has("voltshot")) { this.volt = true; this.voltT = P("voltshot", "seconds", 5); }
    if (this.sig === "alternator") this.altFire = !this.altFire;
    for (const { id, r } of this.recipes) if (r.cond === "afterreload" || (r.trigger === "onReloadEnd" && r.action === "buff")) this.startBuff(id, r);
  }
  /** Sacar el arma más rápido (quickdraw). */
  equipFast() { return this.has("quickdraw"); }
}
