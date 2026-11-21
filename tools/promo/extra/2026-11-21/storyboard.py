# Schnitt Frage-Clip „Welches Reich bist du?“ (1080×1920, 30 fps, ~8,6 s): vier echte Schlachten, je Reich eine Zahl, Frage oben, Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-reiche python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-reiche')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
R = [('r1', '1', 'AURELIEN', 'SONNENKRONE', 'SCHILDWALL + KATAPULT', '#ffd24a'),
     ('r2', '2', 'NORDMARK', 'EISENKRONE', 'AXT + BALLISTE', '#8ec0f0'),
     ('r3', '3', 'SYLVARA', 'DORNENKRONE', 'PFEILHAGEL + DRUIDEN', '#79d25e'),
     ('r4', '4', 'KARTH', 'ASCHEKRONE', 'FEUER + METEORE', '#ff6a4a')]
def szene(sc, num, name, krone, art, col):
    def f(k):
        b = zoom(load(os.path.join(RAW, sc, '%04d.jpg' % k)), 1.3 + .003 * k, 0, -20)
        title(b, 12, 'WELCHES REICH BIST DU?', 60, WHITE, 250)
        place(b, text_img(num, 260, col, stroke=10), W / 2, 560, pop(k))
        title(b, k, name, 110, col, 800, 2)
        title(b, k, krone, 50, WHITE, 910, 4)
        if k >= 10: react(b, k, art, 540, 1420, t0=10, size=50, fill=col, shake=4)
        flash(b, k, .45, 3)
        return b
    return f
END = EndCard(RAW, [os.path.join(RAW, s[0], '%04d.jpg' % 30) for s in R], tag='SCHREIB DEINE ZAHL 1-4!', extra=badge('KRIEG DER KRONEN · GRATIS', 26))
SCENES = [(s[0], szene(*s), 48) for s in R] + [('end', lambda k: END(k + 30, 114), 66)]
HITS = [[0, 'impact'], [48, 'impact'], [96, 'impact'], [144, 'impact']] + [[i * 48 + 10, 'frei:plopp_01'] for i in range(4)] + [[192, 'sparkle'], [196, 'frei:ding_02']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=16))
