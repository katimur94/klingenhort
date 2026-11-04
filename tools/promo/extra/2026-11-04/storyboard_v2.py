# Schnitt Meme-Clip (v2 mit Reaktionen: „HÄÄÄ?“, Totenkopf, „BRO???“, Comedy-Geräusche) „Ich nach 5 Minuten vs. ich nach 50 Stunden“ (1080×1920, 30 fps, ~11 s)
# Aufruf: PROMO_OUT=/tmp/klingenhort-meme-1 python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-meme-1')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

def a(k):
    if k < 60: b = gameplay(RAW, 'a', k, k, punch=False, drift=.02)
    else: b = freeze(RAW, 'a', 59, k - 60)            # Standbild: „…15 Schaden.“
    title(b, k, 'ICH NACH', 64, WHITE, 380)
    title(b, k, '5 MINUTEN', 96, ICE, 490, 3)
    if k >= 30: title(b, k - 30, 'LV 1 · 15 SCHADEN', 44, WHITE, 1300)
    if k >= 46: react(b, k, 'HÄÄÄ?', 700, 900, t0=46, size=80)
    if k >= 60: emoji_face(b, k, 'skull', 300, 960, t0=60, r=80)
    return b

def bb(k):
    b = gameplay(RAW, 'b', k, k)
    title(b, k, 'ICH NACH', 64, WHITE, 380)
    title(b, k, '50 STUNDEN', 96, GOLD, 490, 3)
    if k >= 60: title(b, k - 60, 'LV 100 · 5000+', 64, GOLD, 1300)
    if 96 <= k < 156: react(b, k, 'BRO???', 300, 1120, t0=96, size=76, fill=GOLD)
    if k >= 120: emoji_face(b, k, 'cool', 780, 1120, t0=120, r=75)
    flash(b, k, .8, 4)
    return b

raw_b = sorted(os.listdir(os.path.join(RAW, 'b')))
END = EndCard(RAW, [os.path.join(RAW, 'b', f) for f in raw_b[::8]], extra=badge('BIS LEVEL 100', 26))
SCENES = [('a', a, 84), ('b', bb, 156), ('end', lambda k: END(k, 96), 96)]
HITS = [[46, 'huh'], [60, 'thud'], [84, 'scratch'], [86, 'impact'], [84 + 60, 'sparkle'], [84 + 96, 'boing']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
