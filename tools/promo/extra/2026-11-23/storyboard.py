# Schnitt Meme-Clip „Niemand: / Die Balliste der Nordmark:“ (1080×1920, 30 fps, ~8 s), mit Faxen
# ruhe (Niemand: – die Ritterin spaziert) → bolzen (Die Balliste: Streifen, BRO?!, Rolle, Einschlag, NICHT HEUTE) → zeitlupe (dieselben Bilder halb so schnell) → Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-niemand python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-niemand')
RAW = os.path.join(OUT, 'raw')
NORD = '#8ec0f0'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f, z=1.45): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), z, 0, 60)
def ruhe(k):
    b = shot('ruhe', k)
    title(b, 12, 'NIEMAND:', 110, WHITE, 330)
    if k >= 14: emoji_face(b, k, 'meh', 860, 1250, t0=14, r=62)
    if k >= 24: meme_bild(b, k, 'music', 220, 1250, t0=24, size=120)
    return b
HIT = 35
def bolzen(k):
    b = shot('bolzen', k)
    title(b, 8, 'DIE BALLISTE', 96, NORD, 300); title(b, 8, 'DER NORDMARK:', 80, NORD, 410)
    if 4 <= k < 13: react(b, k, 'BRO?!', 540, 1400, t0=4, size=110, fill=RED, shake=12); emoji_face(b, k, 'shock', 860, 1150, t0=4, r=64)
    elif 13 <= k < HIT: react(b, k, 'ROLLE!!!', 540, 1400, t0=13, size=100, fill=GOLD, shake=10)
    elif k >= HIT:
        react(b, k, 'NICHT HEUTE!', 540, 1400, t0=HIT, size=90, fill=MOSS, shake=8); emoji_face(b, k, 'cool', 860, 1150, t0=HIT + 3, r=64); flash(b, k - HIT, .5, 4, (200, 230, 255))
    return b
def zeitlupe(k):
    f = 10 + k // 2; b = shot('bolzen', f, 1.75)
    title(b, 0, 'NOCHMAL IN ZEITLUPE', 60, WHITE, 330)
    if f >= HIT: react(b, k, 'KNAPP!', 540, 1400, t0=(HIT - 10) * 2, size=100, fill=MOSS, shake=8)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'bolzen', '%04d.jpg' % f) for f in range(6, 60, 12)], tag='WAS HAETTEST DU GEMACHT?', extra=badge('KRIEG DER KRONEN · GRATIS', 26))
SCENES = [('ruhe', ruhe, 45), ('bolzen', bolzen, 75), ('zeitlupe', zeitlupe, 60), ('end', lambda k: END(k + 30, 114), 62)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'frei:plopp_01'], [14, 'huh'], [S0['bolzen'], 'dundun'], [S0['bolzen'] + 4, 'frei:bruh_01'], [S0['bolzen'] + 13, 'frei:boing_03'], [S0['bolzen'] + HIT, 'impact'], [S0['bolzen'] + HIT + 2, 'frei:komisch_12'],
        [S0['zeitlupe'], 'scratch'], [S0['zeitlupe'] + (HIT - 10) * 2, 'impact'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=16))
