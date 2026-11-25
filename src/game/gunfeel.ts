// Tiempos de manejo por clase (tarea 13, gunplay): apuntar, sacar y recargar. Solo lógica (sin Three.js).
//
// Referencias (valores base, sin mejoras): Apex Legends (wiki oficial, apexlegends.wiki.gg): P2020 recarga 1,25 s,
// apuntar 0,18 s, sacar 0,225 s; R-99 recarga 1,8 s táctica / 2,5 s en vacío, apuntar 0,22 s, sacar 0,35 s; fusiles
// R-301/Flatline 2,4 / 3,1–3,2 s; ametralladoras Devotion/Spitfire 2,9–3,4 / 3,7–4,2 s; francotiradores
// Longbow/Sentinel 2,5–2,7 / 3,6–3,7 s; y el rango de CoD (ADS de 0,15 s en pistolas a ~0,5 s en francotiradores).
// Antes todas las clases apuntaban en ~0,18 s y sacaban el arma igual de rápido (una ametralladora como una pistola),
// la recarga en vacío duraba lo mismo que la táctica y la de las ametralladoras ~5,5 s.

export interface ClassFeel {
  /** Tiempo de apuntar (s) con manejo 50: hasta el 90 % del gesto. */ ads: number;
  /** Tiempo de sacar el arma (s) con manejo 50. */ draw: number;
  /** Recarga táctica base (s; se escala con el manejo como antes). */ reload: number;
  /** Factor de la recarga en vacío (corredera o cerrojo que hay que soltar). */ emptyMult: number;
}

export const GUNFEEL: Record<string, ClassFeel> = {
  pistol: { ads: 0.16, draw: 0.3, reload: 1.4, emptyMult: 1.12 },
  revolver: { ads: 0.19, draw: 0.36, reload: 2.3, emptyMult: 1 },
  smg: { ads: 0.21, draw: 0.38, reload: 1.8, emptyMult: 1.3 },
  rifle: { ads: 0.26, draw: 0.48, reload: 2.2, emptyMult: 1.3 },
  bullpup: { ads: 0.27, draw: 0.5, reload: 2.4, emptyMult: 1.25 },
  shotgun: { ads: 0.27, draw: 0.52, reload: 2.6, emptyMult: 1.2 },
  sniper: { ads: 0.42, draw: 0.62, reload: 2.9, emptyMult: 1.3 },
  lmg: { ads: 0.45, draw: 0.72, reload: 3.4, emptyMult: 1.2 },
  launcher: { ads: 0.45, draw: 0.7, reload: 3.2, emptyMult: 1 },
  flamethrower: { ads: 0.32, draw: 0.6, reload: 2.8, emptyMult: 1 },
};
const feel = (type: string) => GUNFEEL[type] ?? GUNFEEL.rifle;
const handling = (manejo: number) => 1.25 - Math.min(100, Math.max(0, manejo)) / 200; // 1,25 (torpe) … 0,75 (ágil)

/** Tiempo de apuntar (s) de una clase con su manejo, acotado a 0,15–0,50 s (brief de la tarea 13). */
export function adsTime(type: string, manejo: number): number {
  return Math.min(0.5, Math.max(0.15, feel(type).ads * handling(manejo)));
}
/** Velocidad del suavizado exponencial del apuntado que llega al 90 % del gesto en `t` segundos. */
export const adsRate = (t: number) => Math.LN10 / Math.max(0.05, t);
/** Tiempo de sacar el arma (s). */
export function drawTime(type: string, manejo: number): number {
  return feel(type).draw * handling(manejo);
}
/** Recarga con cargador (s): la táctica, o la de vacío con su factor (cartucho a cartucho, basculantes y portilla
 *  calculan la suya aparte). Mismo escalado por manejo que antes (1,35 − manejo/200). */
export function reloadTime(type: string, manejo: number, empty: boolean): number {
  return feel(type).reload * (1.35 - manejo / 200) * (empty ? feel(type).emptyMult : 1);
}
