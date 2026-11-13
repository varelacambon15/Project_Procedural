# Pista de ambiente original para el campo de pruebas: electrónica oscura y fría (dron grave, pads lentos, bajo en
# semicorcheas, arpegio escaso con eco, tic metálico). Composición propia; no reproduce ninguna obra existente.
# Uso: python3 tools/music/compose.py <carpeta_salida>   → stems .wav (luego tools/music/render.sh los mezcla)
import sys, wave, math, os
import numpy as np

SR = 44100
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 64
LEN = BARS * BAR
N = int(LEN * SR)
rng = np.random.default_rng(7)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
# Progresión (La menor): i – VI – iv – V(sus) cada 4 compases; la sección C cambia a i – iv – VI – VII
A, F, D, E, G = 45, 41, 38, 40, 43  # raíces graves (MIDI)
PROG = [A, F, D, E] * 4 + [A, F, D, E] * 4 + [A, D, F, G] * 4 + [A, F, D, E] * 4
CHORDS = {A: [0, 3, 7, 10], F: [0, 4, 7, 11], D: [0, 3, 7, 10], E: [0, 5, 7, 10], G: [0, 4, 7, 9]}

def saw(f, t, nh=24, tilt=1.0, phase=0.0):
    s = np.zeros_like(t)
    for n in range(1, nh + 1):
        if f * n > SR / 2.2: break
        s += np.sin(2 * np.pi * f * n * t + phase * n) / (n ** tilt)
    return s
def square(f, t, nh=15):
    s = np.zeros_like(t)
    for n in range(1, nh + 1, 2):
        if f * n > SR / 2.2: break
        s += np.sin(2 * np.pi * f * n * t) / n
    return s
def env(n, a, r, sus=1.0):
    e = np.ones(n) * sus
    ai = max(1, int(a * SR)); ri = max(1, int(r * SR))
    e[:ai] = np.linspace(0, sus, ai)[:n] if ai <= n else np.linspace(0, sus, n)
    if ri < n: e[-ri:] *= np.linspace(1, 0, ri)
    return e
def put(buf, start, sig, gain=1.0):
    i = int(start * SR); j = min(len(buf), i + len(sig))
    if i < len(buf): buf[i:j] += sig[: j - i] * gain
def sec(bar): return 0 if bar < 16 else 1 if bar < 32 else 2 if bar < 48 else 3
def write(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.9
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    with wave.open(os.path.join(out, name + ".wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype(np.int16).tobytes())

t_all = np.arange(N) / SR
# ---------- Dron: quinta grave desafinada que respira (abre y cierra armónicos muy despacio) ----------
drone = np.zeros(N)
for b, root in enumerate(PROG[::4]):  # cada 4 compases
    st = b * 4 * BAR; n = int(4 * BAR * SR) + int(1.5 * SR)
    t = np.arange(n) / SR
    f = hz(root - 12)
    bright = 0.6 + 0.4 * np.sin(2 * np.pi * t / (4 * BAR))
    s = (saw(f, t, 10, 1.6) + saw(f * 1.004, t, 10, 1.6, 0.3) + 0.6 * saw(f * 1.5, t, 6, 1.8)) * (0.7 + 0.3 * bright)
    put(drone, st, s * env(n, 1.5, 1.5), 0.5)
drone *= 0.8 + 0.2 * np.sin(2 * np.pi * t_all / 11.0)
write("drone", drone)
# ---------- Pad: acordes lentos, fundido largo, coro por desafinado ----------
pad = np.zeros((N, 2))
for b, root in enumerate(PROG):
    if b % 2: continue  # un acorde cada 2 compases (se solapan)
    st = b * BAR; n = int(2 * BAR * SR) + int(2 * SR); t = np.arange(n) / SR
    for k, iv in enumerate(CHORDS[root]):
        f = hz(root + 12 + iv)
        for ch, det in ((0, 0.997), (1, 1.003)):
            s = saw(f * det, t, 8, 1.9) * env(n, 1.8, 2.2, 0.8)
            put(pad[:, ch], st, s, 0.22 if k < 3 else 0.12)
write("pad", pad)
# ---------- Bajo pulsante en semicorcheas (secciones B y C), con acento y filtro que se abre ----------
bass = np.zeros(N)
for bar, root in enumerate(PROG):
    if sec(bar) not in (1, 2): continue
    for s16 in range(16):
        st = bar * BAR + s16 * BEAT / 4; n = int(BEAT / 4 * SR * 0.9); t = np.arange(n) / SR
        acc = 1.0 if s16 % 4 == 0 else 0.6
        nh = int(4 + 10 * (bar % 16) / 16)  # el filtro se abre a lo largo de la sección
        note = root - 12 + (12 if s16 in (6, 14) else 0)
        put(bass, st, saw(hz(note), t, nh, 1.2) * env(n, 0.003, 0.06) * np.exp(-t * 9), 0.5 * acc)
write("bass", bass)
# ---------- Arpegio escaso (C y D): notas del acorde en corcheas, con huecos ----------
arp = np.zeros(N)
pat = [0, 2, 1, 3, 2, None, 1, None]
for bar, root in enumerate(PROG):
    if sec(bar) not in (2, 3): continue
    for e8 in range(8):
        if pat[e8] is None or (sec(bar) == 3 and e8 % 2): continue
        if rng.random() < 0.15: continue
        st = bar * BAR + e8 * BEAT / 2; n = int(BEAT / 2 * SR); t = np.arange(n) / SR
        f = hz(root + 24 + CHORDS[root][pat[e8]])
        put(arp, st, square(f, t, 9) * env(n, 0.004, 0.18) * np.exp(-t * 6), 0.35)
write("arp", arp)
# ---------- Percusión: tic metálico en contratiempo, golpe sordo en C, chasquidos industriales ----------
perc = np.zeros(N)
def tick(n):
    x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))  # paso alto sencillo
    return x * np.exp(-np.arange(n) / SR * 90)
def kick(n):
    t = np.arange(n) / SR; f = 45 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7)
def clank(n):
    t = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * fr * t) * np.exp(-t * dc) for fr, dc in ((523, 6), (1187, 9), (1733, 12), (2711, 16))) * 0.3
for bar in range(BARS):
    sc = sec(bar)
    for b4 in range(4):
        st = bar * BAR + b4 * BEAT
        if sc in (1, 2): put(perc, st + BEAT / 2, tick(int(0.06 * SR)), 0.25)
        if sc == 2 and b4 in (0, 2): put(perc, st, kick(int(0.5 * SR)), 0.8)
    if sc in (1, 2, 3) and bar % 4 == 3: put(perc, bar * BAR + 3.5 * BEAT, clank(int(1.2 * SR)), 0.5)
write("perc", perc)
print("ok", LEN)
