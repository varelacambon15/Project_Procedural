// Ajustes del jugador (se guardan). Sin dibujo: el resto del juego los lee y se suscribe a cambios.
export interface Settings {
  sensitivity: number;   // multiplicador de la sensibilidad del ratón/mando
  fov: number;           // campo de visión (grados)
  damageNumbers: boolean;
  screenShake: boolean;
  impactFx: boolean;     // marcas y chispas de impacto
  volume: number;        // 0..1
  music: number;         // 0..1, sobre el volumen general
  arms: boolean;         // brazos low-poly en primera persona
  night: boolean;        // campo de tiro de noche con neón (si no, de día)
  bloom: boolean;        // resplandor del neón y de los fogonazos (postproceso)
  mapV: number;          // versión del mapa (migración de ajustes)
}
const KEY = "pp.settings";
const DEFAULTS: Settings = { sensitivity: 1, fov: 75, damageNumbers: true, screenShake: true, impactFx: true, volume: 0.8, music: 0.5, arms: true, night: false, bloom: true, mapV: 2 };
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // Mapa 2 (claro): la noche deja de ser lo predeterminado; quien la tenía guardada pasa una vez al día
      if (s.mapV !== 2) { s.night = false; s.mapV = 2; try { localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...s })); } catch { /* */ } }
      return { ...DEFAULTS, ...s };
    }
  } catch { /* sin almacenamiento */ }
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
