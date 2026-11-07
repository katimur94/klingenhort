# Schnitt Tages-Clip „Welche Klasse bist du?“ (1080×1920, 30 fps, ~11 s) – Frage-Format, Klassen & Ultimative
# k0–k3: je eine Klasse mit Nummer, Name und Ultimativer · pick: alle vier Helden mit Nummer zum Kommentieren · end
# Aufruf: PROMO_OUT=/tmp/klingenhort-klassen python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-klassen')
RAW = os.path.join(OUT, 'raw')
INFO = {d['ci']: d for d in json.load(open(os.path.join(RAW, 'info.json')))}
COL = [GOLD, '#b892f4', '#ff6a8a', MOSS]
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

def klasse(ci):
    I = INFO[ci]
    def f(k):
        b = gameplay(RAW, 'k%d' % ci, k, k, drift=.05)
        title(b, k, 'WELCHE KLASSE', 64, WHITE, 300)
        title(b, k, 'BIST DU?', 64, WHITE, 380)
        place(b, badge(str(ci + 1), 64, bg=rgb(COL[ci])[:3]), 540, 520, pop(k))
        title(b, k, I['cls'].upper(), 84, COL[ci], 1240, 2)
        title(b, k, 'ULTI: ' + I['ult'].upper(), 44, WHITE, 1340, 6)
        if ci: flash(b, k, .5, 3)   # erstes Bild des Clips ohne Blitz – sofort scharf
        return b
    return f

A = json.load(open(os.path.join(RAW, 'assets', 'assets.json')))
HEROES = [load(os.path.join(RAW, 'assets', 'm_%d.png' % i)) for i in range(4)]
BG = darken(load(os.path.join(RAW, 'k1', '0030.jpg')), .3, 12)
def pick(k):
    b = BG.copy()
    title(b, k, 'SCHREIB DEINE', 64, WHITE, 380)
    title(b, k, 'ZAHL IN DIE', 64, WHITE, 460, 2)
    title(b, k, 'KOMMENTARE!', 76, GOLD, 550, 4)
    for i in range(4):
        t0 = 6 + i * 5
        if k < t0: continue
        x = 180 + i * 240; fr = (k // 4 + i) % 4
        place(b, glow_disc(130, COL[i], 120), x, 980)
        place(b, HEROES[i].crop((fr * 40, 0, fr * 40 + 40, 44)), x, 980 + (10 if k - t0 == 2 else 0), 6.5 * min(1, pop(k - t0)))
        place(b, badge(str(i + 1), 48, bg=rgb(COL[i])[:3]), x, 1210, pop(k - t0))
    if k >= 30: meme_bild(b, k, 'question', 540, 1400, t0=30, size=150)
    return b

raw0 = sorted(os.listdir(os.path.join(RAW, 'k0')))
END = EndCard(RAW, [os.path.join(RAW, 'k%d' % i, f) for i in range(4) for f in raw0[::16]], tag='WELCHE KLASSE BIST DU?', extra=badge('4 KLASSEN · 4 ULTIMATIVE', 26))
SCENES = [('k0', klasse(0), 48), ('k1', klasse(1), 48), ('k2', klasse(2), 48), ('k3', klasse(3), 48), ('pick', pick, 48), ('end', lambda k: END(k, 96), 96)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['k0'] + 2, 'bumm'], [S0['k1'] + 2, 'frei:gong_01'], [S0['k2'] + 2, 'frei:komisch_12'], [S0['k3'] + 2, 'frei:gong_02']] + \
       [[S0['pick'] + 6 + i * 5, 'frei:plopp_01' if i % 2 == 0 else 'frei:plopp_02'] for i in range(4)] + [[S0['pick'] + 30, 'frei:ding_02']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
