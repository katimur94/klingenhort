# Schnitt Tages-Clip „Dein Begleiter: LV 1 → LV 150“ (1080×1920, 30 fps, ~10,6 s) – Feature aus 6.4, Format Vorher/Nachher + Frage
# hook: LV 150 im Kampf · evo: echte Begleiter-Bilder Baby → Aufgestiegen, Schnitt auf jeden Schlag · fight: Aufgestiegen kämpft · end: Frage + Link
# Aufruf: PROMO_OUT=/tmp/klingenhort-pet python3 storyboard.py
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-pet')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

# Stufen wie im Spiel (PET_STN): Level, Name, Farbe des Etiketts
STAGES = [(1, 'BABY', WHITE), (10, 'JUNG', WHITE), (25, 'STARK', WHITE), (50, 'ERWACHSEN', ICE), (75, 'URALT', GOLD), (100, 'MYTHISCH', GOLD), (150, 'AUFGESTIEGEN', PINK)]
EVO = {lv: [load(os.path.join(RAW, 'evo', '%d_%d.png' % (lv, j))) for j in range(6)] for lv, _, _ in STAGES}
BG = darken(load(os.path.join(RAW, 'hook', '0020.jpg')), .25, 12)

def hook(k):
    b = gameplay(RAW, 'hook', k, k, drift=.05)
    title(b, k, 'DEIN BEGLEITER', 56, WHITE, 380)
    title(b, k, 'AUF LV 150', 92, GOLD, 480, 4)
    return b

STEP = 12
def evo(k):
    i = min(len(STAGES) - 1, k // STEP); kk = k - i * STEP; lv, nm, col = STAGES[i]; last = i == len(STAGES) - 1
    b = BG.copy()
    if last:
        place(b, rays(620, '#ff9af0', kk * .04, 14, 60), W / 2, 960)
        place(b, glow_disc(520, '#ffd24a', 120), W / 2, 960)
    im = EVO[lv][(kk // 3) % 6]
    sc = 960 / im.width * (1 + (.12 * (1 - kk / 5) ** 2 if kk < 5 else 0))
    place(b, im, W / 2, 960, sc)
    title(b, kk, 'LV %d' % lv, 120, col if last else WHITE, 400)
    title(b, kk, nm, 64, col, 1330, 2)
    if not last: title(b, 0, '7 ENTWICKLUNGSSTUFEN', 30, ICE, 530)
    if last and kk >= 10: react(b, kk, 'GLOW UP!', 540, 1440, t0=10, size=64, fill=GOLD)
    flash(b, kk, .7 if last else .35, 4)
    return b

def fight(k):
    b = gameplay(RAW, 'fight', k, k, drift=.04)
    title(b, k, 'AURA, HEILIGENSCHEIN', 40, PINK, 380)
    title(b, k, '& FEUERSTURM', 64, GOLD, 470, 4)
    if k >= 36: title(b, k, '150 LEVEL VOLLER BELOHNUNGEN', 30, WHITE, 1300, 36)
    return b

raw_f = sorted(os.listdir(os.path.join(RAW, 'fight')))
END = EndCard(RAW, [os.path.join(RAW, 'fight', f) for f in raw_f[::8]], tag='WELCHER IST DEINER?', extra=badge('BEGLEITER BIS LV 150', 26))
SCENES = [('hook', hook, 48), ('evo', evo, STEP * 6 + 36), ('fight', fight, 72), ('end', lambda k: END(k, 90), 90)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['hook'] + 4, 'roar']] + [[S0['evo'] + i * STEP, 'ting'] for i in range(6)] + \
       [[S0['evo'] + 6 * STEP, 'sparkle'], [S0['evo'] + 6 * STEP, 'impact']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
