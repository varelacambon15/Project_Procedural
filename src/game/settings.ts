// Ajustes del jugador (se guardan). Sin dibujo: el resto del juego los lee y se suscribe a cambios.
export interface Settings {
  sensitivity: number;   // multiplicador de la sensibilidad del ratón/mando
  fov: number;           // campo de visión (grados)
  damageNumbers: boolean;
  screenShake: boolean;
  impactFx: boolean;     // marcas y chispas de impacto
  volume: number;        // 0..1
}
const KEY = "pp.settings";
const DEFAULTS: Settings = { sensitivity: 1, fov: 75, damageNumbers: true, screenShake: true, impactFx: true, volume: 0.8 };
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try { const raw = localStorage.getItem(KEY); if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }; } catch { /* sin almacenamiento */ }
  return { ...DEFAULTS };
}
export const settings: Settings = load();
export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings[k] = v;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento */ }
  for (const f of listeners) f(settings);
}
/** Sustituye todos los ajustes (al cargar una partida). */
export function replaceSettings(s: Partial<Settings>) { Object.assign(settings, DEFAULTS, s); try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* */ } for (const f of listeners) f(settings); }
export const onSettings = (f: (s: Settings) => void) => listeners.add(f);
