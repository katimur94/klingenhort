# Schnitt Tages-Clip „Von Grau bis Mythisch“ (1080×1920, 30 fps, ~11 s) – Fund-Clip + Frage
# je Seltenheit ein Schlag (echter Drop, Lichtsäule wie im Spiel), Leiste mit den Stufen oben, Mythisch mit Strahlen; Endkarte 2 s
# Umlaute im Pixel-Font werden klein – darum GEWOEHNLICH / LEGENDAER
# Aufruf: PROMO_OUT=/tmp/klingenhort-rar python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-rar')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

STUFEN = [(0, 'GEWOEHNLICH', '#c8c8c8'), (1, 'MAGISCH', '#57a7d6'), (2, 'SELTEN', '#e8d04a'), (3, 'EPISCH', '#b892f4'), (4, 'LEGENDAER', '#ff8a3a'), (6, 'MYTHISCH', '#ff4fd8')]
STEP = 36

def leiste(b, cur):
    for j, (_, _, col) in enumerate(STUFEN):
        x = W / 2 + (j - 2.5) * 110; s = 1.25 if j == cur else 1
        place(b, glow_disc(int(46 * s), col, 255 if j <= cur else 50), x, 560)

def stufe(i):
    r, nm, col = STUFEN[i]; last = i == len(STUFEN) - 1
    def f(k):
        b = zoom(load(os.path.join(RAW, 'r%d' % r, '%04d.jpg' % min(35, k))), 1.6 + .004 * k, 80, -170)
        if last: place(b, rays(640, col, k * .05, 14, 70), W / 2, 1000)
        title(b, k + 12, 'VON GRAU', 60, WHITE, 330)
        title(b, k + 12, 'BIS MYTHISCH', 60, PINK, 420)
        leiste(b, i)
        title(b, k, nm, 92 if last else 76, col, 1430)
        if last and k >= 22: react(b, k, 'JACKPOT!', 540, 760, t0=22, size=80, fill=GOLD, shake=10)
        if last and k >= 30: meme_bild(b, k, 'stars', 860, 1120, t0=30, size=150)
        if i: flash(b, k, .5 if last else .2, 4, (255, 255, 255))
        return b
    return f

END = EndCard(RAW, [os.path.join(RAW, 'r6', '%04d.jpg' % j) for j in range(10, 36, 6)], tag='WELCHE FARBE HATTEST DU ZULETZT?', extra=badge('7 SELTENHEITEN · GRATIS', 26))
SCENES = [('s%d' % i, stufe(i), STEP if i < 5 else 66) for i in range(6)] + [('end', lambda k: END(k + 34, 94), 60)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['s%d' % i], 'ting'] for i in range(5)] + [[S0['s5'], 'impact'], [S0['s5'], 'sparkle'], [S0['s5'] + 22, 'frei:gong_01'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
