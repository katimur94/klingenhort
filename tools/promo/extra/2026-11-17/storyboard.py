# Schnitt Begleiter-Clip „60 Stunden gepflegt – was kommt raus?“ (1080×1920, 30 fps, ~9 s) – Spannung/Frage, echte Schlüpf-Animation
# nest: Brutnest, mythisches Ei bereit · ei: Wackeln und Risse · da: Schale platzt, Sternenwal + Ergebnis-Karte · kampf: der Kleine kämpft mit · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-ei python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-ei')
RAW = os.path.join(OUT, 'raw')
I = json.load(open(os.path.join(RAW, 'info.json'))); P = json.load(open(os.path.join(RAW, 'hatch', 'info.json')))
STD = I['care'] // 3600; NAME = P['n'].upper(); MYTH = (255, 79, 216)
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f): return load(os.path.join(RAW, sc, '%04d.jpg' % f))

def nest(k):
    b = shot('nest', k).convert('RGBA')
    ImageDraw.Draw(b).rectangle((0, 826, W, 1090), fill=(17, 14, 23, 255))
    title(b, k + 12, '%d STUNDEN GEPFLEGT' % STD, 64, WHITE, 905)
    title(b, k + 12, 'WAS KOMMT RAUS?', 84, MYTH, 1015)
    if k >= 10: meme_bild(b, k, 'question', 860, 1250, t0=10, size=150)
    return b
BURST = 63
def ei(k):
    b = zoom(shot('hatch', k), 1.12 + .0015 * k, 0, 0)
    title(b, k, 'MYTHISCHES EI', 72, MYTH, 240)
    if k >= 16: react(b, k, 'KNACK', 250, 1560, t0=16, size=64, fill=WHITE)
    if k >= 33: react(b, k, 'KNACK!!', 800, 1560, t0=33, size=76, fill=GOLD)
    if k >= 48: emoji_face(b, k, 'shock', 900, 560, t0=48, r=64)
    return b
def da(k):
    b = zoom(shot('hatch', BURST + k), 1.2, 0, 0)
    flash(b, k, .8, 5)
    if k >= 12:
        title(b, k, 'EIN', 60, WHITE, 250, 12); title(b, k, NAME + '!', 104, MYTH, 360, 14)
    if k >= 22: react(b, k, 'OHA!!!', 540, 1620, t0=22, size=96, fill=GOLD)
    if k >= 28: meme_bild(b, k, 'hearts', 900, 560, t0=28, size=150)
    return b
def kampf(k):
    b = zoom(shot('kampf', 14 + k), 1.25 + .002 * k, 0, -40)
    title(b, k, 'FRISCH GESCHLUEPFT', 60, WHITE, 330); title(b, k, 'UND SCHON IM KAMPF', 76, GOLD, 440, 5)
    if k >= 24: emoji_face(b, k, 'cool', 880, 1380, t0=24, r=66)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'kampf', '%04d.jpg' % f) for f in range(10, 70, 12)], tag='DEIN BESTES EI?', extra=badge('7 SELTENHEITEN · 77 ARTEN', 26))
SCENES = [('nest', nest, 36), ('ei', ei, BURST), ('da', da, 58), ('kampf', kampf, 56), ('end', lambda k: END(k + 34, 100), 62)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'frei:ding_02'], [10, 'huh'], [S0['ei'], 'whoosh'], [S0['ei'] + 16, 'frei:glas_01'], [S0['ei'] + 33, 'frei:glas_03'], [S0['ei'] + 48, 'frei:glas_05'], [S0['ei'] + 50, 'dundun'],
        [S0['da'], 'impact'], [S0['da'] + 2, 'sparkle'], [S0['da'] + 22, 'frei:boing_03'], [S0['kampf'], 'impact'], [S0['kampf'] + 24, 'frei:komisch_12'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
