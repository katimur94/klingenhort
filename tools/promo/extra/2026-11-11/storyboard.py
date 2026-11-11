# Schnitt Tages-Clip „Wusstest du? Rolle durch die Schockwelle“ (1080×1920, 30 fps, ~9,5 s) – Mini-Tutorial mit Faxen
# falsch: stehen bleiben → Treffer (Standbild, Bruh) · richtig: durch die Welle rollen · zeitlupe: die Rolle noch einmal halb so schnell · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-rolle python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-rolle')
RAW = os.path.join(OUT, 'raw')
I = json.load(open(os.path.join(RAW, 'info.json'))); HIT = I['falsch']['hit']; ROLL = I['richtig']['roll']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f, k, oy=-60): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), 1.12 + .02 * k / 30, 0, oy)

FR = 16   # Standbild nach dem Treffer
def falsch(k):
    f = k if k <= HIT + 3 else max(HIT + 3, k - FR)
    b = shot('falsch', min(79, f), k) if not (HIT + 3 < k <= HIT + 3 + FR) else zoom(freeze(RAW, 'falsch', HIT + 3, k - HIT - 3, sat=.4), 1.1, 0, -60)
    title(b, k + 12, 'WUSSTEST DU?', 72, GOLD, 330)
    title(b, k + 12, 'SCHOCKWELLE KOMMT', 46, WHITE, 430)
    if k < HIT: title(b, k, 'ICH: BLEIB STEHEN', 46, ICE, 1330, 8)
    if k >= 10 and k < HIT: emoji_face(b, k, 'cool', 860, 760, t0=10, r=64)
    if k >= HIT:
        react(b, k, 'AUA.', 540, 1300, t0=HIT, size=110, fill=RED, shake=12)
        emoji_face(b, k, 'skull', 860, 760, t0=HIT + 6, r=70)
        flash(b, k - HIT, .6, 4, (255, 120, 120))
    return b
def richtig(k):
    b = shot('richtig', k, k)
    title(b, k, 'BESSER:', 60, WHITE, 330); title(b, k, 'DURCHROLLEN!', 84, MOSS, 440, 4)
    if k >= ROLL: react(b, k, '0 SCHADEN', 540, 1300, t0=ROLL + 2, size=84, fill=MOSS)
    if k >= ROLL + 8: meme_bild(b, k, 'laugh', 860, 760, t0=ROLL + 8, size=150)
    flash(b, k, .4, 4)
    return b
Z0 = ROLL - 6
def zeitlupe(k):
    b = shot('richtig', min(79, Z0 + k // 2), k)
    title(b, k, 'BEIM ROLLEN', 60, WHITE, 330); title(b, k, 'TRIFFT DICH NICHTS', 54, GOLD, 430, 4)
    place(b, badge('ZEITLUPE', 26), 170, 620)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'richtig', '%04d.jpg' % f) for f in range(30, 80, 10)], tag='KANNTEST DU DEN TRICK?', extra=badge('TIPP AUS DEM BOSS-KODEX', 26))
SCENES = [('falsch', falsch, 80 + FR - 14), ('richtig', richtig, 80), ('zeitlupe', zeitlupe, 44), ('end', lambda k: END(k + 34, 94), 60)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'frei:ding_02'], [10, 'frei:boing_03'], [HIT, 'impact'], [HIT + 1, 'frei:bruh_01'], [HIT + 4, 'scratch'], [HIT + 10, 'failhorn'],
        [S0['richtig'], 'whoosh'], [S0['richtig'] + ROLL, 'whoosh'], [S0['richtig'] + ROLL + 3, 'sparkle'], [S0['richtig'] + ROLL + 9, 'frei:komisch_12'], [S0['zeitlupe'], 'dundun'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=16))
