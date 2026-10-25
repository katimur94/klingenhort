# Chiptune-Soundtrack für TikTok-Clips: 150 BPM, A-Moll, synchron zu den Schnitten.
# Aufruf: python3 music.py <ausgabeordner>   (liest timeline.json von promolib.render, schreibt audio.wav)
# Schnitte bekommen Rauschen und Becken, die Szene „end“ einen großen Einschlag mit Fanfare,
# davor einen Takt Spannungsaufbau. Zusätzliche Geräusche: timeline.json "hits": [[bild, art], …]
import json, os, sys, wave
import numpy as np

D = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
SR = 44100
BPM = 150
BEAT = 60 / BPM            # 0,4 s = 12 Bilder
FPS = 30
TL = json.load(open(D + '/timeline.json'))
DUR = TL['total'] / FPS
N = int(DUR * SR) + SR
rng = np.random.default_rng(5)

mus = np.zeros(N)   # Musik (wird unter der Kick geduckt)
drm = np.zeros(N)   # Schlagzeug
fx = np.zeros(N)    # Effekte


def t_of_frame(f): return f / FPS


def add(buf, t, sig, gain=1.0):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), N - i)
    buf[i:i + n] += sig[:n] * gain


def env(n, a=.003, d=.2, s=0.0, curve=4.0):
    t = np.arange(n) / SR
    e = np.exp(-t / max(d, 1e-4) * (curve / 4)) * (1 - s) + s
    at = int(a * SR)
    if at: e[:at] *= np.linspace(0, 1, at)
    rel = int(.01 * SR)
    e[-rel:] *= np.linspace(1, 0, rel)
    return e


def LP(x, a):
    # einfacher Tiefpass gegen zu harte Rechteckwellen (a darf auch ein Verlauf sein)
    a = np.broadcast_to(np.asarray(a, float), x.shape)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y


def _blep(t, dt):
    r = np.zeros_like(t)
    a = t < dt; x = t[a] / dt[a]; r[a] = x + x - x * x - 1
    b = t > 1 - dt; x = (t[b] - 1) / dt[b]; r[b] = x * x + x + x + 1
    return r


def square(f, n, duty=.5):
    # bandbegrenzte Rechteckwelle (PolyBLEP), klingt weniger kratzig als die naive
    fr = np.full(n, f / SR) if np.isscalar(f) else np.asarray(f) / SR
    ph = np.cumsum(fr) % 1
    s = np.where(ph < duty, 1.0, -1.0)
    return s + _blep(ph, fr) - _blep((ph - duty) % 1, fr)


def tri(f, n):
    ph = np.cumsum(np.full(n, f / SR))
    return 4 * np.abs((ph % 1) - .5) - 1


def noise(n): return rng.uniform(-1, 1, n)


def hz(name):
    names = {'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] + (o - 4) * 12 - 9) / 12)


# ---------- Instrumente ----------
def kick(t, g=1.0):
    n = int(.32 * SR); tt = np.arange(n) / SR
    f = 45 + 120 * np.exp(-tt / .03)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .14)
    s += LP(noise(n), .3) * np.exp(-tt / .004) * .4
    add(drm, t, np.tanh(s * 1.6), .9 * g)


def snare(t, g=1.0):
    n = int(.22 * SR); tt = np.arange(n) / SR
    nz = LP(noise(n), .3) * 1.1
    s = nz * np.exp(-tt / .055) + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt / .05) * .8
    add(drm, t, s, .42 * g)


def hat(t, g=1.0, open_=False):
    n = int((.2 if open_ else .05) * SR); tt = np.arange(n) / SR
    s = np.diff(noise(n + 1)) * np.exp(-tt / (.05 if open_ else .01))
    add(drm, t, s, .07 * g)


def crash(t, g=1.0):
    n = int(1.4 * SR); tt = np.arange(n) / SR
    s = (LP(noise(n), .45) - LP(noise(n), .05)) * np.exp(-tt / .4)
    add(fx, t, s, .22 * g)


def impact(t, g=1.0):
    n = int(1.2 * SR); tt = np.arange(n) / SR
    f = 28 + 90 * np.exp(-tt / .08)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / .45)
    s += LP(noise(n), .08) * np.exp(-tt / .25) * 1.5
    add(fx, t, np.tanh(s * 2.2), .85 * g)
    crash(t, .9 * g)


def whoosh(t_hit, length=.35, g=1.0):
    n = int(length * SR); tt = np.arange(n) / SR
    e = (tt / length) ** 2.2
    s = LP(noise(n), .05 + .4 * (tt / length)) * e
    add(fx, t_hit - length, s, .55 * g)


def ting(t, f, g=1.0):
    n = int(.25 * SR); tt = np.arange(n) / SR
    s = (np.sin(2 * np.pi * f * tt) + .4 * square(f * 2, n, .25)) * np.exp(-tt / .07)
    add(fx, t, s, .22 * g)


def tick(t, g=1.0):
    n = int(.03 * SR); tt = np.arange(n) / SR
    add(fx, t, square(1800, n, .5) * np.exp(-tt / .008), .18 * g)


def sparkle(t, g=1.0, base='A5'):
    seq = ['A5', 'C6', 'E6', 'A6', 'C7', 'E7', 'A7', 'E7', 'A7']
    for i, nm in enumerate(seq):
        ting(t + i * .035, hz(nm), .7 * g)


def clank(t, g=1.0):
    n = int(.4 * SR); tt = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * tt) for f in (523, 1230, 2210, 3150)) * np.exp(-tt / .08) * .35
    s += noise(n) * np.exp(-tt / .01) * .6
    add(fx, t, s, .45 * g)


def roar(t, g=1.0):
    n = int(.6 * SR); tt = np.arange(n) / SR
    f = 70 + 30 * np.sin(tt * 30)
    s = np.tanh(3 * (square(f, n, .3) * .6 + LP(noise(n), .06) * 1.2)) * np.exp(-tt / .22)
    add(fx, t, LP(s, .25), .4 * g)


def note(buf, t, f, dur, kind='sq', duty=.5, g=.2, d=None, cut=.3):
    n = int(dur * SR)
    if kind == 'sq': s = square(f, n, duty)
    elif kind == 'tri': s = tri(f, n)
    else: s = np.sin(2 * np.pi * f * np.arange(n) / SR)
    s = LP(s, cut) * env(n, .002, d if d else dur * .9, .0)
    add(buf, t, s, g)


# ---------- Arrangement ----------
CH = [('A', ['A3', 'C4', 'E4']), ('F', ['F3', 'A3', 'C4']), ('C', ['C4', 'E4', 'G4']), ('G', ['G3', 'B3', 'D4'])]
BASS = {'A': 'A1', 'F': 'F1', 'C': 'C2', 'G': 'G1'}
MEL = [['E5', None, 'A5', None, 'C6', 'B5', 'A5', 'E5'],
       ['F5', None, 'A5', None, 'C6', None, 'A5', 'G5'],
       ['G5', None, 'E5', None, 'C5', None, 'E5', 'G5'],
       ['D5', None, 'G5', None, 'B5', 'A5', 'G5', 'D5']]
MEL2 = [['A5', 'A5', 'C6', None, 'E6', None, 'D6', 'C6'],
        ['C6', None, 'A5', None, 'F5', None, 'A5', 'C6'],
        ['E6', None, 'D6', None, 'C6', None, 'G5', None],
        ['B5', None, 'D6', None, 'G6', 'F#6', 'D6', 'B5']]
START = dict(TL['starts'])
# Endkarte (Szene „end“); ohne Endkarte läuft die Musik bis zum Schluss durch
END_BEAT = START['end'] / 12 if 'end' in START else 10 ** 6
BUILD_FROM = END_BEAT - 4             # Ein Takt Spannungsaufbau davor
TOTAL_BEATS = int(DUR / BEAT + .5)
# Melodie setzt mit dem zweiten Schnitt ein
MEL_FROM = (TL['starts'][1][1] / 12) if len(TL['starts']) > 1 else 0

e8 = BEAT / 2
for beat in range(TOTAL_BEATS):
    t = beat * BEAT
    bar = beat // 4
    ch, tones = CH[bar % 4]
    in_end = beat >= END_BEAT
    in_build = BUILD_FROM <= beat < END_BEAT
    # Schlagzeug
    if not in_end:
        if not (in_build and beat >= END_BEAT - 1): kick(t)
        if beat % 2 == 1 and not in_build: snare(t)
        hat(t + e8, .9 if beat % 2 else .7, open_=(beat % 4 == 3))
        if not in_build: hat(t, .4)
    else:
        if (beat - END_BEAT) % 4 == 0 and beat < TOTAL_BEATS - 4: kick(t)
        if (beat - END_BEAT) % 4 == 2 and beat < TOTAL_BEATS - 4: snare(t)
        if beat < TOTAL_BEATS - 4: hat(t + e8, .5)
    # Bass: pumpende Achtel
    if not in_end and not (in_build and beat >= END_BEAT - 1):
        b = hz(BASS[ch])
        note(mus, t, b, e8 * .9, 'tri', g=.5, d=.2)
        note(mus, t + e8, b * 2, e8 * .9, 'tri', g=.42, d=.15)
        note(mus, t, b * 2, e8 * .9, 'sq', .25, g=.06, cut=.15)
    # Arpeggio in Sechzehnteln
    if not in_end:
        for i in range(4):
            f = hz(tones[i % 3]) * 2
            note(mus, t + i * BEAT / 4, f, BEAT / 4 * .8, 'sq', .25, g=.055, d=.06, cut=.25)
    # Melodie ab der zweiten Szene
    if MEL_FROM <= beat < END_BEAT - 1:
        mel = (MEL if (bar // 4) % 2 == 0 else MEL2)[bar % 4]
        for i in range(2):
            nm = mel[(beat % 4) * 2 + i]
            if nm: note(mus, t + i * e8, hz(nm), e8 * .95, 'sq', .5, g=.085, d=.22, cut=.2)

# Spannungsaufbau vor der Endkarte: Snare-Wirbel und Riser
t0 = BUILD_FROM * BEAT if 'end' in START else -100
steps = 32
for i in range(steps):
    p = i / steps
    snare(t0 + p * 4 * BEAT * (1 - .25 * p), .35 + .8 * p)
n = int(4 * BEAT * SR); tt = np.arange(n) / SR
rise = LP(noise(n), .02 + .5 * (tt / tt[-1]) ** 2) * (tt / tt[-1]) ** 2
add(fx, t0, rise, .5)
f = 220 * 2 ** (tt / tt[-1] * 2)
add(fx, t0, LP(square(f, n, .5), .2) * (tt / tt[-1]) ** 2, .07)

# Endkarte: Fanfare und Akkordflächen
te = END_BEAT * BEAT if 'end' in START else 10 ** 4
FAN = [('A4', 0, 1), ('C5', 1, 1), ('E5', 2, 1), ('A5', 3, 1), ('C6', 4, 2), ('B5', 6, 2), ('A5', 8, 4)]
for nm, b0, ln in FAN:
    note(mus, te + b0 * BEAT, hz(nm), ln * BEAT * .95, 'sq', .5, g=.11, d=ln * BEAT * .8, cut=.2)
    note(mus, te + b0 * BEAT, hz(nm) / 2, ln * BEAT * .95, 'sq', .25, g=.05, d=ln * BEAT * .8, cut=.15)
for b0, (ch, tones) in [(0, CH[0]), (4, CH[1]), (6, CH[3]), (8, CH[0])]:
    ln = 4 if b0 in (0, 8) else 2
    for nm in tones:
        note(mus, te + b0 * BEAT, hz(nm), ln * BEAT, 'sq', .5, g=.035, d=ln * BEAT, cut=.08)
    note(mus, te + b0 * BEAT, hz(BASS[ch]), ln * BEAT, 'tri', g=.45, d=ln * BEAT * .7)

# ---------- Effekte an den Schnitten ----------
cuts = [st for nm, st in TL['starts'] if st > 0]
impact(0, .9)
for f_ in cuts:
    whoosh(t_of_frame(f_), .3, .8)
    crash(t_of_frame(f_), .7)
if 'end' in START: impact(t_of_frame(START['end']), 1.1)
KINDS = {'impact': lambda t: impact(t, .6), 'sparkle': lambda t: sparkle(t, 1.0), 'tick': lambda t: tick(t, 1.2), 'roar': lambda t: roar(t, 1.0),
         'clank': lambda t: clank(t, 1.0), 'ting': lambda t: ting(t, hz('E6'), 1.0), 'whoosh': lambda t: whoosh(t + .3, .3, .8), 'kick': lambda t: kick(t, .7)}
for f_, kind in TL.get('hits', []):
    if kind in KINDS: KINDS[kind](t_of_frame(f_))

# ---------- Mischen ----------
# Pumpen: Musik weicht der Kick kurz aus
duck = np.ones(N)
for beat in range(TOTAL_BEATS):
    if beat >= END_BEAT: break
    i = int(beat * BEAT * SR); n = int(.22 * SR)
    tt = np.arange(min(n, N - i)) / SR
    duck[i:i + len(tt)] = np.minimum(duck[i:i + len(tt)], 1 - .45 * np.exp(-tt / .07))
mix = mus * duck * 1.0 + drm * .85 + fx * .9
mix = mix[:int(DUR * SR)]
fade = int(.6 * SR); mix[-fade:] *= np.linspace(1, 0, fade)
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= .89 / np.max(np.abs(mix))
st = np.stack([mix, mix], 1)
# leichte Stereobreite: Effekte minimal versetzt
d = int(.012 * SR); st[d:, 1] = .85 * st[d:, 1] + .15 * mix[:-d]
pcm = (st * 32767).astype(np.int16)
with wave.open(D + '/audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio', DUR, 's')
