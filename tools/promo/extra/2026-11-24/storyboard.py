# Schnitt Boss-Clip „Speedrun: Sturmkönig Aerok“ (1080×1920, 30 fps, ~9 s): echte Stoppuhr ab seinem Auftritt (Bilder aus raw/kampf/log.json),
# Standbild beim Sieg mit der Zeit, dann Endkarte mit Frage „Schaffst du es schneller?“
# Aufruf: PROMO_OUT=/tmp/klingenhort-aerok python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-aerok')
RAW = os.path.join(OUT, 'raw')
L = json.load(open(os.path.join(RAW, 'kampf', 'log.json')))
TOT = next(i for i, x in enumerate(L) if x['dead'])
ZEIT = TOT / 30
STURM = '#8ee6ff'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
def shot(f, z=1.55): return zoom(load(os.path.join(RAW, 'kampf', '%04d.jpg' % f)), z + .0008 * f, 0, -330)
def uhr(b, s, col=WHITE, sc=1.0):
    place(b, text_img('%.1f s' % s, 120, col, stroke=8), W / 2, 1420, sc)
def kampf(k):
    b = shot(k)
    title(b, 12, 'SPEEDRUN', 90, GOLD, 1150); title(b, 12, 'STURMKOENIG AEROK', 56, STURM, 1255)
    uhr(b, k / 30)
    if 60 <= k < 120: react(b, k, 'NUR LV 100 …', 540, 1620, t0=60, size=56, fill=WHITE)
    if k >= 120: emoji_face(b, k, 'shock', 900, 1600, t0=120, r=60)
    return b
FR = 24
def sieg(k):
    b = zoom(freeze(RAW, 'kampf', TOT + 2, k, sat=.6), 1.6 + .01 * k, 0, -330)
    title(b, k, 'BESIEGT IN', 80, WHITE, 1150)
    uhr(b, ZEIT, GOLD, pop(k) * 1.3)
    if k >= 6: react(b, k, 'BEGLEITER-EI GAB ES AUCH!', 540, 1620, t0=6, size=44, fill=MOSS)
    flash(b, k, .7, 5)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'kampf', '%04d.jpg' % f) for f in range(20, TOT, 30)], tag='SCHAFFST DU ES SCHNELLER?', extra=badge('AKT 9 · STURMGIPFEL · GRATIS', 26))
SCENES = [('kampf', kampf, TOT), ('sieg', sieg, 54), ('end', lambda k: END(k + 30, 114), 62)]
HITS = [[0, 'roar'], [60, 'frei:plopp_01'], [120, 'huh'], [TOT, 'impact'], [TOT + 2, 'frei:gong_01'], [TOT + 8, 'sparkle'], [TOT + 54, 'whoosh']]
if __name__ == '__main__':
    print('Zeit', round(ZEIT, 2), 'Tod bei Bild', TOT)
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=16))
