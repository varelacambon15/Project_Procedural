// Campaña «Hack» (tarea 3, fase b): la cadena de objetivos de UNA partida a un nivel (puro, sin three). La incursión
// (raid.ts) le cuenta lo que pasa (sala despejada, terminal hackeado, generador destruido, núcleo recogido, salida
// alcanzada) y esto decide si el objetivo en curso avanza, lleva el tiempo, el daño recibido y el cofre, y da el
// texto del HUD. Lo que no es el objetivo en curso se ignora: el orden de la cadena manda.
import type { CampaignLevel, LevelPlan, Objective, ObjectiveType, RunResult } from "./campaign";

export interface ObjectiveHud { key: string; p: Record<string, string | number>; /** avance 0..1 (hack, destroy, survive) */ frac: number | null }

export class CampaignRun {
  idx = 0; t = 0; damage = 0; chest = false;
  /** Progreso del objetivo en curso: segundos de hack, generadores destruidos, oleadas superadas. */ hackT = 0; destroyed = 0; waves = 0;
  /** Lleva el núcleo (retrieve superado): hay que sacarlo por la salida. */ carrying = false;
  failed = false;
  constructor(readonly level: CampaignLevel, readonly plan: LevelPlan) {}

  get current(): Objective | null { return this.level.objectives[this.idx] ?? null; }
  get done() { return this.idx >= this.level.objectives.length; }
  /** Objetivo que se juega en la sala de combate `n` (1..rooms), o null si es una sala de solo combate. */
  roomObjective(n: number): Objective | null { return this.plan.rooms.find((r) => r.room === n)?.objective ?? null; }

  /** Completa el objetivo en curso si es de ese tipo. Devuelve si avanzó. */
  complete(type: ObjectiveType): boolean {
    if (this.failed || this.current?.type !== type) return false;
    if (type === "retrieve") this.carrying = true;
    if (type === "extract") this.carrying = false;
    this.idx++; this.hackT = 0; this.destroyed = 0; this.waves = 0;
    return true;
  }
  tick(dt: number) { if (!this.done && !this.failed) this.t += dt; }
  hurt(dmg: number) { if (!this.done) this.damage += Math.max(0, dmg); }
  /** Hack: suma tiempo solo dentro de la zona del terminal (fuera se pierde despacio). Devuelve si acaba de terminar. */
  hackTick(dt: number, inside: boolean): boolean {
    const o = this.current; if (o?.type !== "hack") return false;
    this.hackT = inside ? this.hackT + dt : Math.max(0, this.hackT - dt * 0.25);
    return this.hackT >= (o.hold ?? 0) ? this.complete("hack") : false;
  }
  /** Destroy: un generador menos. Devuelve si era el último. */
  destroyedOne(): boolean {
    const o = this.current; if (o?.type !== "destroy") return false;
    this.destroyed++;
    return this.destroyed >= (o.count ?? 0) ? this.complete("destroy") : false;
  }
  /** Survive: una oleada superada. Devuelve si era la última. */
  waveDone(): boolean {
    const o = this.current; if (o?.type !== "survive") return false;
    this.waves++;
    return this.waves >= (o.waves ?? 0) ? this.complete("survive") : false;
  }
  /** ¿Se puede salir ya? (la salida solo cuenta cuando es el objetivo en curso) */
  get canExtract() { return this.current?.type === "extract"; }

  hud(): ObjectiveHud {
    const o = this.current;
    if (!o) return { key: "cp.obj.done", p: {}, frac: null };
    switch (o.type) {
      case "hack": return { key: "cp.obj.hack", p: { s: Math.max(0, Math.ceil((o.hold ?? 0) - this.hackT)) }, frac: this.hackT / (o.hold ?? 1) };
      case "destroy": return { key: "cp.obj.destroy", p: { n: this.destroyed, of: o.count ?? 0 }, frac: this.destroyed / (o.count ?? 1) };
      case "survive": return { key: "cp.obj.survive", p: { n: this.waves, of: o.waves ?? 0 }, frac: this.waves / (o.waves ?? 1) };
      case "eliminate": return { key: "cp.obj.eliminate", p: { k: o.target ?? "" }, frac: null };
      case "boss": return { key: "cp.obj.boss", p: { k: o.boss ?? "" }, frac: null };
      case "extract": return { key: this.carrying ? "cp.obj.extractCore" : "cp.obj.extract", p: {}, frac: null };
      default: return { key: `cp.obj.${o.type}`, p: {}, frac: null };
    }
  }
  result(): RunResult { return { completed: this.done && !this.failed, seconds: this.t, damageTaken: this.damage, chest: this.chest }; }
}
