# Schnitt Tages-Clip „Pfeilhagel: stehen bleiben oder Deckung?“ (1080×1920, 30 fps, ~9 s) – Mini-Tutorial mit Faxen zu Krieg der Kronen (6.6)
# falsch: im roten Kreis stehen bleiben → Treffer (Standbild) · richtig: hinter den Schildwall rollen → „GEDECKT“ · zeitlupe: die Rolle noch einmal · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-deckung python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-deckung')
RAW = os.path.join(OUT, 'raw')
L = json.load(open(os.path.join(RAW, 'falsch', 'log.json')))['log']
HIT = next(i for i in range(1, len(L)) if L[i] < L[i - 1] - .005)
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f, k): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), 1.4 + .02 * k / 30, 30, -110)
FR = 16
def falsch(k):
    f = k if k <= HIT + 2 else max(HIT + 2, k - FR)
    b = shot('falsch', min(95, f), k) if not (HIT + 2 < k <= HIT + 2 + FR) else zoom(freeze(RAW, 'falsch', HIT + 2, k - HIT - 2, sat=.4), 1.4, 30, -110)
    place(b, badge('NEU: KRIEG DER KRONEN', 30, bg=(255, 90, 58), fg=(255, 246, 224)), W / 2, 290, 1 if k < 1 else pop(k))
    title(b, k + 12, 'PFEILHAGEL!', 96, RED, 390)
    title(b, k + 12, 'ICH: BLEIB STEHEN', 46, WHITE, 500)
    if 10 <= k < HIT: emoji_face(b, k, 'cool', 860, 700, t0=10, r=64)
    if k >= HIT:
        react(b, k, 'AUA.', 540, 1330, t0=HIT, size=110, fill=RED, shake=12)
        emoji_face(b, k, 'skull', 860, 700, t0=HIT + 5, r=70)
        flash(b, k - HIT, .6, 4, (255, 120, 120))
    return b
def richtig(k):
    b = shot('richtig', k, k)
    title(b, k, 'BESSER:', 60, WHITE, 330); title(b, k, 'HINTER DEN', 64, GOLD, 430, 3); title(b, k, 'SCHILDWALL!', 84, GOLD, 530, 6)
    if k >= 50: react(b, k, 'GEDECKT = 0 SCHADEN', 540, 1330, t0=50, size=46, fill=MOSS)
    if k >= 56: meme_bild(b, k, 'laugh', 860, 700, t0=56, size=150)
    flash(b, k, .4, 4)
    return b
def zeitlupe(k):
    b = shot('richtig', 9 + k // 2, k)
    title(b, k, 'ROTER KREIS?', 72, RED, 350); title(b, k, 'ROLLEN + DECKUNG', 56, WHITE, 460, 4)
    place(b, badge('ZEITLUPE', 26), 170, 620)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'richtig', '%04d.jpg' % f) for f in range(40, 96, 12)], tag='AURELIEN ODER KARTH?', extra=badge('NEU: ZWEI HEERE · ECHTE SCHLACHT', 24))
SCENES = [('falsch', falsch, HIT + 20 + FR), ('richtig', richtig, 96), ('zeitlupe', zeitlupe, 44), ('end', lambda k: END(k + 34, 100), 66)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'roar'], [10, 'frei:boing_03'], [HIT, 'impact'], [HIT + 1, 'frei:bruh_01'], [HIT + 4, 'scratch'], [HIT + 10, 'failhorn'], [S0['richtig'], 'whoosh'], [S0['richtig'] + 13, 'whoosh'],
        [S0['richtig'] + 50, 'frei:ding_02'], [S0['richtig'] + 53, 'sparkle'], [S0['richtig'] + 58, 'frei:komisch_12'], [S0['zeitlupe'], 'dundun'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
