# Schnitt Tages-Clip „6 Welten in 10 Sekunden“ (1080×1920, 30 fps, ~10 s) – Biome der Endlosen Lande, Schnitt auf jeden 3. Schlag
# Aufruf: PROMO_OUT=/tmp/klingenhort-biome python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-biome')
RAW = os.path.join(OUT, 'raw')
D = json.load(open(os.path.join(RAW, 'info.json')))
COL = [MOSS, ICE, '#ff8a3a', '#b892f4', '#9aa2ff', '#c8d0e0']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

def biom(i):
    b0, I = D['list'][i], D['info'][i]
    def f(k):
        b = gameplay(RAW, b0, k, k, drift=.05)
        title(b, k, '6 WELTEN', 84, WHITE, 300)
        title(b, k, 'IN 10 SEKUNDEN', 56, GOLD, 390)
        place(b, badge('%d/6' % (i + 1), 40, bg=rgb(COL[i])[:3]), 540, 510, pop(k))
        title(b, k, I['n'].upper(), 88, COL[i], 1250, 2)
        title(b, k, 'STUFE %d' % I['st'], 36, WHITE, 1350, 5)
        if i == len(D['list']) - 1 and k >= 18: react(b, k, '+70 WEITERE!', 540, 900, t0=18, size=58, fill=GOLD)
        if i: flash(b, k, .45, 3)
        return b
    return f

raw_l = [os.path.join(RAW, b, '%04d.jpg' % 20) for b in D['list']]
END = EndCard(RAW, raw_l, tag='WELCHE WELT WÄHLST DU?', extra=badge('70+ BIOME · EINE WELT FÜR ALLE', 24))
SCENES = [(b, biom(i), 36) for i, b in enumerate(D['list'])] + [('end', lambda k: END(k, 96), 96)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
SND = ['frei:ding_01', 'frei:glas_04', 'bumm', 'frei:komisch_06', 'frei:gong_02', 'frei:boing_05']
HITS = [[S0[b] + 1, SND[i % len(SND)]] for i, b in enumerate(D['list'])] + [[S0[D['list'][-1]] + 18, 'frei:ding_02']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
