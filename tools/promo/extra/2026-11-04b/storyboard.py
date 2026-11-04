# Schnitt Meme-Clip „Mythisch gefunden … LAUF!“ (1080×1920, 30 fps, ~12 s) – mit Faxen (Reaktionen, Gesichter, Comedy-Geräusche)
# Aufruf: PROMO_OUT=/tmp/klingenhort-meme-2 python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-meme-2')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

def see(k):
    b = gameplay(RAW, 'see', k, k, punch=False, drift=.06)
    title(b, k, 'POV:', 64, WHITE, 380)
    title(b, k, 'MYTHISCH!', 100, PINK, 490, 3)
    if k >= 30: react(b, k, 'OMG OMG OMG', 540, 1250, t0=30, size=60)
    if k >= 44: emoji_face(b, k, 'cool', 860, 1060, t0=44, r=62)
    return b

def boss(k):
    b = gameplay(RAW, 'boss', k, k)
    title(b, k, 'ABER DANN:', 84, WHITE, 400)
    if k >= 10: react(b, k, 'NEIN NEIN NEIN', 540, 1260, t0=10, size=64, fill=RED)
    if k >= 18: emoji_face(b, k, 'cry', 230, 1060, t0=18, r=70)
    flash(b, k, .9, 4, (255, 60, 40))
    return b

def run(k):
    b = gameplay(RAW, 'run', k, k, drift=.03)
    react(b, k, 'LAUF!!!', 540, 430, size=110, fill=GOLD, bubble=False, tilt=6, shake=14)
    if k >= 30: react(b, k, 'ICH BIN RAUS', 540, 1280, t0=30, size=58)
    return b

GOT = 32   # Bild, in dem das Schwert eingesammelt wird (raw/back)
def back(k):
    if k < 46: b = gameplay(RAW, 'back', k, k, punch=False, drift=.02)
    else: b = freeze(RAW, 'back', 45, k - 46)
    title(b, k, '3 SEK SPÄTER:', 76, WHITE, 400)
    if GOT <= k < 46: react(b, k, 'MEINS!', 540, 1250, t0=GOT, size=80, fill=GOLD)
    if k >= 46:
        react(b, k, 'BRUHHH', 540, 1250, t0=46, size=90, fill=RED)
        emoji_face(b, k, 'skull', 540, 980, t0=50, r=90)
    return b

raw_r = sorted(os.listdir(os.path.join(RAW, 'run')))
END = EndCard(RAW, [os.path.join(RAW, 'run', f) for f in raw_r[::8]], extra=badge('1200 BOSSE WARTEN', 26))
SCENES = [('see', see, 66), ('boss', boss, 42), ('run', run, 96), ('back', back, 66), ('end', lambda k: END(k, 90), 90)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['see'] + 30, 'sparkle'], [S0['boss'], 'scratch'], [S0['boss'] + 4, 'roar'], [S0['boss'] + 10, 'thud'],
        [S0['run'] + 10, 'boing'], [S0['run'] + 50, 'boing'], [S0['run'] + 30, 'huh'],
        [S0['back'] + GOT, 'ting'], [S0['back'] + 46, 'thud'], [S0['back'] + 52, 'sad']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
