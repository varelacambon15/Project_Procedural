# Ambiente v2 (original): dron subgrave que respira, pads anchos de tonos largos, notas que se deslizan, cascadas
# descendentes con eco, texturas mecánicas sin ritmo fijo y barridos de ruido. Si menor con color frigio.
# Perfil tomado del análisis de la referencia del usuario (sin pulso, oscura, muy ancha, mucho medio-grave);
# notas, melodías y estructura son propias.
# Uso: python3 tools/music/compose2.py <carpeta_salida>
import sys, os, wave
import numpy as np
SR = 44100; LEN = 240.0; N = int(LEN * SR)
rng = np.random.default_rng(11)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
t_all = np.arange(N) / SR

def osc(freqs_t, nh=10, tilt=1.4, odd=False):
    """Diente de sierra (o cuadrada si odd) con frecuencia variable en el tiempo (array)."""
    ph = 2 * np.pi * np.cumsum(freqs_t) / SR; s = np.zeros_like(ph); fmax = float(np.max(freqs_t))
    for n in range(1, nh + 1, 2 if odd else 1):
        if fmax * n > SR / 2.3: break
        s += np.sin(n * ph) / n ** tilt
    return s
def adsr(n, a, r):
    e = np.ones(n); ai = min(n, max(1, int(a * SR))); ri = min(n, max(1, int(r * SR)))
    e[:ai] = np.linspace(0, 1, ai); e[n - ri:] *= np.linspace(1, 0, ri); return e
def put(buf, start, sig, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(sig)); s = sig[: j - i] * gain
    buf[i:j, 0] += s * np.sqrt((1 - pan) / 2) * 1.414; buf[i:j, 1] += s * np.sqrt((1 + pan) / 2) * 1.414
def wide(sig, det=0.004, delay=0.011):
    """Estéreo ancho: canal derecho algo desafinado (re-muestreo) y retrasado (efecto Haas)."""
    L = sig; idx = np.arange(len(sig)) * (1 + det); R = np.interp(idx, np.arange(len(sig)), sig, right=0)
    d = int(delay * SR); R = np.concatenate([np.zeros(d), R[:-d]]); return np.stack([L, R], 1)
def write(name, x, peak=0.9):
    x = x / (np.max(np.abs(x)) + 1e-9) * peak
    with wave.open(os.path.join(out, name + ".wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())

# Mapa de raíces (MIDI) por tramos: Si – Sol – Mi – Do (frigio) – Si
ROOTS = [(0, 47), (60, 43), (100, 40), (150, 36), (185, 47)]
def root_at(t): return [r for s, r in ROOTS if s <= t][-1]

# ---------- Subgrave: Si/Sol/Mi muy grave, respiración lenta y portamento entre tramos ----------
f = np.array([hz(root_at(tt) - 24) if hz(root_at(tt) - 24) >= 29 else hz(root_at(tt) - 12) for tt in t_all[::441]]); f = np.interp(t_all, t_all[::441], np.convolve(f, np.ones(300) / 300, "same"))
breath = 0.55 + 0.45 * np.sin(2 * np.pi * t_all / 13.0) ** 2
# (fundamental moderada; el peso va a la octava y la quinta, que dan el cuerpo en 60-250 Hz)
sub = 0.6 * osc(f, 3, 2.4) * breath + 0.9 * osc(f * 2.0, 6, 1.5) * (0.4 + 0.6 * np.sin(2 * np.pi * t_all / 21.0 + 1) ** 2) + 0.45 * osc(f * 3.0, 5, 1.6) * breath
write("sub", wide(sub, 0.0015, 0.004))

# ---------- Pad medio: acordes largos (raíz, tercera menor, quinta, novena) muy anchos ----------
pad = np.zeros((N, 2))
for (s0, r), (s1, _) in zip(ROOTS, ROOTS[1:] + [(LEN + 6, 0)]):
    n = int((s1 - s0 + 8) * SR); tt = np.arange(n) / SR
    for k, iv in enumerate([0, 3, 7, 14]):
        fr = hz(r + 12 + iv) * (1 + 0.002 * np.sin(2 * np.pi * tt / (7 + k)))
        s = osc(fr, 9, 1.7) * adsr(n, 6, 7) * (0.6 + 0.4 * np.sin(2 * np.pi * tt / (17 + 3 * k)) ** 2)
        put(pad, max(0, s0 - 4), s, 0.28 if k < 3 else 0.14, (-0.5, 0.5, -0.2, 0.3)[k])
pad = pad + wide(pad[:, 0], 0.003, 0.017) * 0.5
write("pad", pad)

# ---------- Notas que se deslizan (voz principal lenta, sin ritmo) ----------
glide = np.zeros((N, 2))
for s0, notes in [(40, [66, 64, 62, 61]), (110, [71, 69, 66, 67, 66]), (190, [66, 64, 62, 59])]:
    pts_t, pts_f, t = [], [], 0.0
    for nt in notes: pts_t += [t, t + 3.0]; pts_f += [hz(nt), hz(nt)]; t += 3.0 + 1.8 + rng.random() * 1.5  # mantiene y se desliza
    n = int((t + 4) * SR); tt = np.arange(n) / SR
    fr = np.interp(tt, pts_t, pts_f) * (1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.clip(tt / 4, 0, 1))  # vibrato lento
    s = osc(fr, 7, 1.5) * adsr(n, 3, 4)
    put(glide, s0, s, 0.5, -0.15)
glide = glide + np.roll(glide, int(0.38 * SR), 0) * 0.35 + np.roll(glide, int(0.83 * SR), 0) * 0.2
write("glide", glide)

# ---------- Cascadas descendentes: notas cortas y brillantes que bajan, con eco (tramo central) ----------
steps = np.zeros((N, 2))
casc = [[83, 81, 78, 76, 74, 71], [81, 78, 76, 74, 71, 69], [79, 78, 74, 72, 71, 67]]
for i, s0 in enumerate(np.arange(100, 175, 8.5)):
    seq = casc[i % 3]; gap = 0.16 + rng.random() * 0.08
    for j, nt in enumerate(seq):
        n = int(0.9 * SR); tt = np.arange(n) / SR
        s = osc(np.full(n, hz(nt)), 11, 1.1, odd=True) * adsr(n, 0.005, 0.7) * np.exp(-tt * 4)
        put(steps, s0 + j * gap, s, 0.3 * (1 - j * 0.08), np.sin(j * 1.3) * 0.7)
steps = steps + np.roll(steps, int(0.29 * SR), 0) * 0.45 + np.roll(steps[:, ::-1], int(0.61 * SR), 0) * 0.3
write("steps", steps)

# ---------- Texturas mecánicas sin pulso fijo: racimos de chasquidos y golpes metálicos lejanos ----------
mech = np.zeros((N, 2))
def clank(n, base):
    tt = np.arange(n) / SR
    return sum(np.sin(2 * np.pi * base * r * tt) * np.exp(-tt * d) for r, d in ((1, 3), (2.76, 5), (5.4, 8), (8.93, 11))) * 0.25
t = 6.0
while t < LEN - 5:
    if 125 < t < 185 or rng.random() < 0.5:   # racimo de chasquidos (más denso en el tramo central)
        k = int(6 + rng.random() * 14); tc = t
        for _ in range(k):
            n = int(0.03 * SR); x = np.diff(np.concatenate([[0], rng.standard_normal(n)])) * np.exp(-np.arange(n) / SR * 160)
            put(mech, tc, x, 0.12 + rng.random() * 0.1, rng.random() * 1.6 - 0.8); tc += 0.05 + rng.random() * 0.22
    if rng.random() < 0.45: put(mech, t + rng.random() * 3, clank(int(3 * SR), 90 + rng.random() * 140), 0.45, rng.random() - 0.5)
    t += 5 + rng.random() * 9
write("mech", mech)

# ---------- Vaivenes de dos notas (medio tono / tercera menor), irregulares, con leves deslizamientos ----------
# Motivo obsesivo en la zona media: aparece, alterna unas cuantas veces y se desvanece; cambia de altura con la raíz.
PAIRS = [(7, 8), (3, 6), (12, 11), (10, 7), (8, 7), (6, 3)]   # intervalos sobre la raíz (semitonos)
osc2 = np.zeros((N, 2))
t = 12.0; k = 0
while t < LEN - 14:
    r = root_at(t) + 12 if root_at(t) < 45 else root_at(t)
    lo, hi = PAIRS[k % len(PAIRS)]; k += 1
    dur = 9 + rng.random() * 8
    # puntos de la línea: alterna cada 0,7-1,4 s; a veces se desliza (0,15-0,4 s), si no, cambia limpio
    pts_t, pts_f, tt0, cur = [0.0], [hz(r + 12 + lo)], 0.0, 0
    while tt0 < dur:
        hold = 0.45 + rng.random() * 0.6; slide = 0.12 + rng.random() * 0.25 if rng.random() < 0.5 else 0.02
        tt0 += hold; pts_t.append(tt0); pts_f.append(pts_f[-1])
        cur ^= 1; tt0 += slide; pts_t.append(tt0); pts_f.append(hz(r + 12 + (hi if cur else lo)))
    n = int(dur * SR); tt = np.arange(n) / SR
    fr = np.interp(tt, pts_t, pts_f) * (1 + 0.003 * np.sin(2 * np.pi * 0.7 * tt))   # leve inestabilidad
    sig = osc(fr, 8, 1.5) * adsr(n, 2.5, 3.5)
    put(osc2, t, sig, 0.45, (rng.random() - 0.5) * 0.8)
    t += dur + 3 + rng.random() * 9
osc2 = osc2 + np.roll(osc2[:, ::-1], int(0.47 * SR), 0) * 0.3
write("osc2", osc2)

# ---------- Latido lento (~55 BPM): golpe doble grave y apagado, a ratos, con alguna ausencia ----------
heart = np.zeros((N, 2)); P = 60 / 55
def thump(n, f0):
    tt = np.arange(n) / SR; fr = f0 * (1 + 0.6 * np.exp(-tt * 25))
    click = np.sin(2 * np.pi * 380 * tt) * np.exp(-tt * 70) * 0.35  # ataque apagado (como un golpe en una caja)
    return (np.sin(2 * np.pi * np.cumsum(fr) / SR) + click) * np.exp(-tt * 9)
for a0, a1 in [(28, 92), (118, 182)]:
    t = a0
    while t < a1:
        if rng.random() > 0.12:
            amp = np.sin(np.pi * (t - a0) / (a1 - a0)) ** 0.7   # entra y sale suavemente
            put(heart, t, thump(int(0.4 * SR), 64), 0.55 * amp); put(heart, t + 0.21, thump(int(0.35 * SR), 58), 0.35 * amp)
        t += P
write("heart", heart)

# ---------- Barridos de ruido (subidas que se abren y se cierran) ----------
swp = np.zeros((N, 2))
for s0, dur in [(88, 9), (143, 7), (178, 10), (226, 8)]:
    n = int(dur * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n)
    # filtro "que se abre": mezcla de ruido suavizado (grave) y ruido crudo (brillante) según la envolvente
    sm = np.convolve(x, np.ones(40) / 40, "same"); e = np.sin(np.pi * tt / dur) ** 2
    y = (sm * (1 - e) + x * e * 0.35) * e
    put(swp, s0, y, 0.5, 0.0)
swp = swp + wide(swp[:, 0], 0.0, 0.023) * 0.6
write("sweep", swp)
print("ok", LEN)
