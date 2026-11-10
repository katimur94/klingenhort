# Schnitt Tages-Clip „Wie viel Holz in 10 Sekunden?“ (1080×1920, 30 fps, ~12,7 s) – Challenge + oddly satisfying
# chop: Ritterin fällt im Nadelforst der Endlosen Lande Baum um Baum, Holz-Zähler aus dem Spiel (raw/log.json), Klang bei jedem Baum
# result: Standbild mit Ergebnis + Frage · end: 2 s Endkarte
# Aufruf: PROMO_OUT=/tmp/klingenhort-holz python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-holz')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

LOG = json.load(open(os.path.join(RAW, 'log.json')))['log']
N = len(LOG); LAST = LOG[-1]
FALL = [x['i'] for a, x in zip([{'n': 0}] + LOG, LOG) if x['n'] > a['n']]
WOOD = '#e8a858'

def chop(k):
    b = zoom(load(os.path.join(RAW, 'chop', '%04d.jpg' % k)), 1.55 + .1 * k / N, 0, 20)
    title(b, k + 12, 'WIE VIEL HOLZ', 60, WHITE, 330)
    title(b, k + 12, 'IN 10 SEKUNDEN?', 60, GOLD, 420)
    sec = max(0, 10 - k // 30)
    place(b, text_img('NOCH %d S' % sec, 40, ICE, stroke=4), W / 2, 1420)
    h = LOG[k]['holz']; last = max([f for f in FALL if f <= k], default=-99)
    pk = 1.25 if k - last < 4 else 1
    place(b, text_img('HOLZ: %d' % h, 64, WOOD), W / 2, 1320, pk)
    if k - last < 10 and last >= 0: react(b, k, '+1 BAUM', 760, 1180, t0=last, size=40, fill=MOSS, bubble=False)
    return b

RES = 66
def result(k):
    b = freeze(RAW, 'chop', N - 1, k, sat=.5)
    title(b, k, '%d HOLZ!' % LAST['holz'], 110, WOOD, 560)
    title(b, k, 'IN 10 SEKUNDEN', 48, WHITE, 690, 3)
    if k >= 14: react(b, k, 'SCHAFFST DU MEHR?', 540, 1250, t0=14, size=56, fill=GOLD)
    if k >= 20: meme_bild(b, k, 'exclamations', 860, 980, t0=20, size=150)
    return b

raw_c = sorted(f for f in os.listdir(os.path.join(RAW, 'chop')))
END = EndCard(RAW, [os.path.join(RAW, 'chop', f) for f in raw_c[::10]], tag='SAMMELN · BAUEN · KÄMPFEN', extra=badge('ENDLOSE LANDE', 26))
def end(k): return END(k + 24, 84)
SCENES = [('chop', chop, N), ('result', result, RES), ('end', end, 60)]
HITS = [[0, 'whoosh']] + [[f, 'frei:rums_0%d' % (1 + j % 7)] for j, f in enumerate(FALL)] + [[N, 'frei:gong_01'], [N + 14, 'frei:ding_02'], [N + RES, 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=24))
