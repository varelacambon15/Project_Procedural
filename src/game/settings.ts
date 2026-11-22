// Ajustes del jugador (se guardan). Sin dibujo: el resto del juego los lee y se suscribe a cambios.
/** Calidad gráfica: Bajo (sin postprocesado), Medio (tono, bloom a media resolución y viñeta) o Alto (todo). */
export type Quality = "low" | "medium" | "high";
export const QUALITIES: Quality[] = ["low", "medium", "high"];
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
  bloom: boolean;
  /** Escala de resolución del render (1 = nativa; menos = más rápido en equipos flojos). */ renderScale: number;
  /** Calidad gráfica del postprocesado (Bajo/Medio/Alto), ver `Quality`. */ quality: Quality;
  /** Contador de fotogramas por segundo en pantalla. */ showFps: boolean;        // resplandor del neón y de los fogonazos (postproceso)
  mapV: number;          // versión del mapa (migración de ajustes)
  dev: boolean;          // modo desarrollador: todos los súperes y su carga, y atajos para probar
  sprintToggle: boolean; // correr: pulsar para activar/desactivar (si no, mantener)
  aimToggle: boolean;    // apuntar: pulsar para activar/desactivar
  crouchToggle: boolean; // agacharse: pulsar para activar/desactivar
  invertY: boolean;      // invertir el eje vertical de la cámara
  adsSens: number;       // sensibilidad al apuntar (multiplicador)
  padSens: number;       // sensibilidad del mando (multiplicador, sobre la general)
  /** Nombre del jugador (el asistente del hall te saluda con él). */ playerName: string;
  /** Voz del asistente del hall (síntesis de voz del navegador). */ botVoice: boolean;
  binds: Record<string, string>; // teclas del teclado por acción (código de tecla)
  padBinds: Record<string, number>; // botones del mando por acción
}
const KEY = "pp.settings";
/** Defecto: Medio en PC, Bajo en táctil (body.touch; si aún no se ha tocado la pantalla, por puntero grueso). */
function defaultQuality(): Quality {
  try {
    const bodyTouch = typeof document !== "undefined" && !!document.body?.classList?.contains("touch");
    const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches && typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 0;
    return bodyTouch || coarse ? "low" : "medium";
  } catch { return "medium"; }
}
const DEFAULTS: Settings = { sensitivity: 1, fov: 75, damageNumbers: true, screenShake: true, impactFx: true, volume: 0.8, music: 0.5, arms: true, night: false, bloom: true, renderScale: 1, quality: defaultQuality(), showFps: false, mapV: 2, dev: false, sprintToggle: false, aimToggle: false, crouchToggle: false, invertY: false, adsSens: 1, padSens: 1, playerName: "", botVoice: true, binds: {}, padBinds: {} };
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
