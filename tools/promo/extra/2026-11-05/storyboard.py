# Schnitt Tages-Clip „Rang 1 vs. Rang 1200“ (1080×1920, 30 fps, ~10 s) – Challenge-Format, Thema Tausend Bosse
# r1 / r600 / r1200: echte Übungskämpfe aus dem Boss-Kodex, Rang und Stufe wie im Spiel, Mechaniken aus raw/info.json
# Aufruf: PROMO_OUT=/tmp/klingenhort-boss python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-boss')
RAW = os.path.join(OUT, 'raw')
INFO = json.load(open(os.path.join(RAW, 'info.json')))
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

def rank(nm, sub, col, tag):
    I = INFO[nm]
    def f(k):
        b = gameplay(RAW, nm, k, k, drift=.05)
        title(b, k, tag, 44, WHITE, 330)
        title(b, k, 'RANG %d' % I['rank'], 110, col, 440, 2)
        title(b, k, I['band'].upper(), 52, col, 555, 5)
        if sub: title(b, k, sub(I), 34, ICE, 1330, 10)
        return b
    return f

r1 = rank('r1', lambda I: '1 MECHANIK', MOSS, 'BOSS-KODEX')
r600 = rank('r600', lambda I: '%d MECHANIKEN' % len(I['mech']), '#ff6a3a', 'ETWAS SPÄTER')

def r1200(k):
    I = INFO['r1200']; b = rank('r1200', None, PINK, 'UND DANN:')(k)
    for j, m in enumerate(I['mech']):
        if k >= 14 + j * 10: place(b, badge(m.upper(), 28, bg=(40, 20, 60), fg=(255, 230, 255)), 300, 1020 + j * 80, pop(k - 14 - j * 10))
    if k >= 78: react(b, k, 'BRO???', 540, 760, t0=78, size=84, fill=GOLD)
    if k >= 84: emoji_face(b, k, 'skull', 840, 640, t0=84, r=60)
    flash(b, k, .8, 4, (180, 60, 255))
    return b

raw_e = sorted(os.listdir(os.path.join(RAW, 'r1200')))
END = EndCard(RAW, [os.path.join(RAW, 'r1200', f) for f in raw_e[::8]], tag='SCHAFFST DU RANG 1200?', extra=badge('1200 BOSSE · FÜR ALLE GLEICH', 24))
SCENES = [('r1', r1, 60), ('r600', r600, 48), ('r1200', r1200, 108), ('end', lambda k: END(k, 90), 90)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['r1'] + 2, 'impact'], [S0['r600'] + 2, 'impact'], [S0['r1200'], 'roar']] + \
       [[S0['r1200'] + 14 + j * 10, 'tick'] for j in range(len(INFO['r1200']['mech']))] + [[S0['r1200'] + 78, 'huh'], [S0['r1200'] + 84, 'thud']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
