// Salida de audio compartida: un solo contexto y un volumen general ligado a los ajustes.
import { onSettings, settings } from "./settings";

let ctx: AudioContext | null = null, master: GainNode | null = null;
export function audio(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = settings.volume; master.connect(ctx.destination);
    onSettings((s) => { if (master) master.gain.value = s.volume; });
  }
  return ctx;
}
export function out(): AudioNode { audio(); return master!; }

/**
 * Aviso de botín: un acorde breve cuyo número de notas y brillo sube con la rareza (0 = blanca … 4 = legendaria).
 * La legendaria añade un barrido largo para reconocerla sin mirar.
 */
export function lootChime(level: number) {
  try {
    const a = audio(), t = a.currentTime, base = 392;
    const steps = [0, 4, 7, 12, 16].slice(0, Math.max(1, level + 1));
    steps.forEach((s, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = level >= 3 ? "triangle" : "square";
      o.frequency.value = base * Math.pow(2, s / 12);
      const at = t + i * 0.07, len = 0.18 + level * 0.05;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g); g.connect(out()); o.start(at); o.stop(at + len + 0.02);
    });
    if (level >= 4) {
      const o = a.createOscillator(), g = a.createGain(); o.type = "sine";
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1760, t + 0.9);
      g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(g); g.connect(out()); o.start(t); o.stop(t + 1.15);
    }
  } catch { /* sin audio */ }
}

/**
 * Música de ambiente (pista pregrabada en bucle, assets/music). Arranca con el primer gesto del jugador (los
 * navegadores no dejan reproducir sonido antes) y sigue el volumen general × el de la música.
 */
let music: HTMLAudioElement | null = null;
export function startMusic(url: string) {
  if (music || typeof Audio === "undefined") return;
  music = new Audio(url); music.loop = true; music.preload = "auto";
  const vol = () => { if (music) music.volume = Math.max(0, Math.min(1, settings.volume * settings.music)); };
  vol(); onSettings(vol);
  const go = () => { void music?.play().catch(() => { /* aún sin permiso: se reintenta en el siguiente gesto */ }); };
  for (const ev of ["pointerdown", "keydown", "gamepadconnected"]) addEventListener(ev, go);
  go();
}

// ---------------------------------------------------------------------------------------------------------------
// Muestras del pack de sonidos (assets/sonidos): AudioBuffer cargados bajo demanda (por tipo de arma al equiparla).
// Si algo falla (sin red, sin decodificador), `sample()` devuelve null y quien llama usa la síntesis de siempre.
import type { SoundManifest } from "./sounds";

let soundBase = "";
let manifestP: Promise<SoundManifest | null> | null = null;
export let soundManifest: SoundManifest | null = null;
const buffers = new Map<string, AudioBuffer | null>();
const loading = new Map<string, Promise<AudioBuffer | null>>();

/** Fija la carpeta del pack y carga su manifest (una vez). */
export function initSounds(base: string): Promise<SoundManifest | null> {
  soundBase = base.endsWith("/") ? base : base + "/";
  manifestP ??= fetch(soundBase + "manifest.json").then((r) => (r.ok ? r.json() : null)).then((m) => (soundManifest = m)).catch(() => null);
  return manifestP;
}
/** Carga (una vez) los archivos indicados; los fallidos quedan como null. */
export function loadSamples(files: string[]): Promise<unknown> {
  return Promise.all(files.map((f) => {
    if (buffers.has(f)) return buffers.get(f);
    let p = loading.get(f);
    if (!p) {
      p = fetch(soundBase + f).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(f)))).then((b) => audio().decodeAudioData(b))
        .then((b) => { buffers.set(f, b); return b; }, () => { buffers.set(f, null); return null; });
      loading.set(f, p);
    }
    return p;
  }));
}
/** Muestra ya cargada (si no lo está, se pide para la próxima vez y devuelve null). */
export function sample(file: string | null | undefined): AudioBuffer | null {
  if (!file) return null;
  if (!buffers.has(file)) { void loadSamples([file]); return null; }
  return buffers.get(file) ?? null;
}
/**
 * Reproduce una muestra con ganancia y tono, al momento `when` (segundos del contexto; 0 = ya). Devuelve su nodo de
 * ganancia (para cortarla con un fundido) o null.
 */
export function playSample(buf: AudioBuffer | null, gain: number, rate = 1, when = 0): { g: GainNode; src: AudioBufferSourceNode } | null {
  if (!buf) return null;
  try {
    const a = audio(), src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g); g.connect(out()); src.start(Math.max(a.currentTime, when));
    return { g, src };
  } catch { return null; }
}
/** Corta un sonido con un fundido corto (disparos automáticos: no se solapan las colas). */
export function fadeOut(h: { g: GainNode; src: AudioBufferSourceNode } | null, time = 0.03) {
  if (!h) return;
  try { const a = audio(), t = a.currentTime; h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.linearRampToValueAtTime(0, t + time); h.src.stop(t + time + 0.01); } catch { /* ya parado */ }
}
