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
