# Schnitt Meme-Clip „Der Schatzgoblin“ (1080×1920, 30 fps, ~10 s) – Erwartung → Reinfall, mit übertriebenen Faxen
# see: POV Schatzgoblin · chase: 20 Sekunden hinterher – ohne ein einziges Mal zuzuschlagen · gone: er verpufft (echtes Entkommen)
# Aufruf: PROMO_OUT=/tmp/klingenhort-gob python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-gob')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
Z = 1.12   # etwas näher ran (Goblin bleibt im Bild)
def gp(sc, i, k, z=Z, **o): return zoom(gameplay(RAW, sc, i, k, **o), z)

def see(k):
    b = gp('see', k, k, drift=.08)
    title(b, k, 'POV:', 64, WHITE, 360)
    title(b, k, 'SCHATZGOBLIN!!!', 100, GOLD, 470, 3)
    if k >= 16: react(b, k, 'MEINS!!!', 540, 1250, t0=16, size=96, fill=GOLD, shake=10)
    if k >= 26: emoji_face(b, k, 'cool', 860, 1060, t0=26, r=70)
    return b

FR = 76   # ab hier Standbild: „Moment mal …“
def chase(k):
    b = gp('chase', k, k, drift=.03) if k < FR else zoom(freeze(RAW, 'chase', FR - 1, k - FR), Z)
    title(b, k, 'ICH,', 60, WHITE, 340)
    title(b, k, '20 SEK. LANG:', 70, WHITE, 430, 2)
    if 8 <= k < 36: react(b, k, 'KOMM HER!!!', 540, 1230, t0=8, size=88, fill=RED, shake=12)
    if 36 <= k < 60: react(b, k, 'BRO IST SCHNELL', 540, 1230, t0=36, size=70)
    if 60 <= k < FR: react(b, k, 'FAST!!!', 540, 1230, t0=60, size=100, fill=GOLD, shake=14)
    if k >= FR:
        react(b, k, 'MOMENT…', 540, 1080, t0=FR, size=70, bubble=False)
        react(b, k, 'ICH HAB NIE', 540, 1220, t0=FR + 4, size=64, fill=GOLD)
        react(b, k, 'ZUGESCHLAGEN?!', 540, 1370, t0=FR + 6, size=64, fill=GOLD)
        emoji_face(b, k, 'meh', 860, 940, t0=FR + 8, r=66)
    return b

GONE = 20   # ab hier Standbild nach dem Verpuffen
def gone(k):
    b = gp('gone', k, k, z=1, punch=False, drift=.02) if k < GONE else freeze(RAW, 'gone', GONE - 1, k - GONE)
    title(b, k, 'UND DANN:', 80, WHITE, 400)
    if 12 <= k < 16: flash(b, k - 12, .8, 4, (184, 146, 244))
    if k >= GONE:
        react(b, k, 'ER IST WEG.', 540, 1200, t0=GONE, size=92, fill=RED, shake=10)
        emoji_face(b, k, 'cry', 300, 960, t0=GONE + 6, r=74)
        emoji_face(b, k, 'skull', 780, 960, t0=GONE + 12, r=74)
        if k >= GONE + 22: react(b, k, 'NEIN NEIN NEIN', 540, 1330, t0=GONE + 22, size=60)
    return b

raw_c = sorted(os.listdir(os.path.join(RAW, 'chase')))
END = EndCard(RAW, [os.path.join(RAW, 'chase', f) for f in raw_c[::8]], tag='SCHON MAL EINEN ERWISCHT?', extra=badge('TIPP: ZUSCHLAGEN HILFT', 26))
SCENES = [('see', see, 48), ('chase', chase, 96), ('gone', gone, 60), ('end', lambda k: END(k, 96), 96)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['see'] + 3, 'sparkle'], [S0['see'] + 16, 'ting'], [S0['chase'] + 8, 'boing'], [S0['chase'] + 36, 'boing'], [S0['chase'] + 60, 'boing'],
        [S0['chase'] + FR, 'scratch'], [S0['chase'] + FR + 4, 'huh'], [S0['gone'] + 12, 'whoosh'], [S0['gone'] + GONE, 'thud'], [S0['gone'] + GONE + 8, 'sad']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
