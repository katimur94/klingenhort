# Schnitt Meme-Clip „Ich nach 5 Minuten vs. ich nach 50 Stunden“ (1080×1920, 30 fps, ~11 s)
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
    b = gameplay(RAW, 'a', k, k, punch=False, drift=.02)
    title(b, k, 'ICH NACH', 64, WHITE, 380)
    title(b, k, '5 MINUTEN', 96, ICE, 490, 3)
    if k >= 40: title(b, k - 40, 'LV 1 · 15 SCHADEN', 44, WHITE, 1300)
    return b

def bb(k):
    b = gameplay(RAW, 'b', k, k)
    title(b, k, 'ICH NACH', 64, WHITE, 380)
    title(b, k, '50 STUNDEN', 96, GOLD, 490, 3)
    if k >= 60: title(b, k - 60, 'LV 100 · 5000+', 64, GOLD, 1300)
    flash(b, k, .8, 4)
    return b

raw_b = sorted(os.listdir(os.path.join(RAW, 'b')))
END = EndCard(RAW, [os.path.join(RAW, 'b', f) for f in raw_b[::8]], extra=badge('BIS LEVEL 100', 26))
SCENES = [('a', a, 84), ('b', bb, 156), ('end', lambda k: END(k, 96), 96)]
HITS = [[84, 'impact'], [84 + 60, 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
