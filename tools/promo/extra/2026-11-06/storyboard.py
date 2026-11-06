# Schnitt Meme-Clip „200 IQ vs. Realität“ (1080×1920, 30 fps, ~10 s) – Faxen mit freien CC0-Tönen und Pixel-Emotes (tools/promo/frei)
# brain: Blitz-Taktik klappt (BIG BRAIN) · dumb: Held steht selbst im Kreis – Standbild mit Trommelwirbel, dann Einschlag, Bruh, Fail-Horn
# Aufruf: PROMO_OUT=/tmp/klingenhort-iq python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-iq')
RAW = os.path.join(OUT, 'raw')
STORM = '#8ee6ff'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

HIT1 = 41   # Einschlag in raw/brain
def brain(k):
    b = gameplay(RAW, 'brain', min(k, 71), k, drift=.05) if k < 72 else freeze(RAW, 'brain', 71, k - 72, sat=.9)
    title(b, k, 'POV:', 64, WHITE, 330)
    title(b, k, 'DU ENTDECKST', 60, WHITE, 430, 2)
    title(b, k, 'DIE BLITZ-TAKTIK', 68, STORM, 520, 4)
    meme_bild(b, k, 'idea', 300, 980, t0=12, size=170)
    if k >= HIT1:
        react(b, k, 'BIG BRAIN', 540, 1260, t0=HIT1, size=96, fill=GOLD, shake=10)
        meme_bild(b, k, 'laugh', 820, 960, t0=HIT1 + 6, size=170)
    return b

FR = 33     # Standbild kurz vor dem Einschlag (raw/dumb)
HOLD = 36   # so lange steht das Bild
HIT2 = 37   # Einschlag in raw/dumb
def dumb(k):
    if k < FR: b = gameplay(RAW, 'dumb', k, k, drift=.04)
    elif k < FR + HOLD: b = freeze(RAW, 'dumb', FR, k - FR, sat=.35); b = zoom(b, 1 + .25 * min(1, (k - FR) / 20))
    else: i = min(83, FR + (k - FR - HOLD)); b = gameplay(RAW, 'dumb', i, k - FR - HOLD, drift=.02)
    title(b, k, 'ICH, 200 IQ,', 64, WHITE, 340)
    title(b, k, 'BEIM 2. MAL:', 64, GOLD, 440, 3)
    if 6 <= k < FR: react(b, k, 'EZ', 540, 1250, t0=6, size=110, fill=MOSS, bubble=False)
    if 10 <= k < FR: emoji_face(b, k, 'cool', 820, 1040, t0=10, r=70)
    if FR <= k < FR + HOLD:
        react(b, k, '…MOMENT.', 540, 1250, t0=FR + 4, size=80)
        meme_bild(b, k, 'question', 300, 980, t0=FR + 10, size=170)
        meme_bild(b, k, 'gesicht/confused', 790, 980, t0=FR + 18, size=150, bob=False)
    hit = FR + HOLD + (HIT2 - FR)
    if k >= hit:
        react(b, k, 'BRUHHH', 540, 1250, t0=hit, size=110, fill=RED, shake=14)
        meme_bild(b, k, 'drops', 300, 960, t0=hit + 6, size=170)
        emoji_face(b, k, 'skull', 800, 960, t0=hit + 10, r=78)
        flash(b, k - hit, .8, 4, (210, 235, 255))
    return b

raw_d = sorted(os.listdir(os.path.join(RAW, 'dumb')))
END = EndCard(RAW, [os.path.join(RAW, 'dumb', f) for f in raw_d[::8]], tag='WER WAR AUCH SCHON SO?', extra=badge('NEU: AKT 9 STURMGIPFEL', 26))
SCENES = [('brain', brain, 84), ('dumb', dumb, 120), ('end', lambda k: END(k, 96), 96)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
H2 = S0['dumb'] + FR + HOLD + (HIT2 - FR)
HITS = [[S0['brain'] + 12, 'frei:ding_02'], [S0['brain'] + HIT1, 'bumm'], [S0['brain'] + HIT1 + 2, 'frei:gong_01'], [S0['brain'] + HIT1 + 8, 'frei:komisch_12'],
        [S0['dumb'] + 6, 'frei:boing_03'], [S0['dumb'] + FR, 'scratch'], [S0['dumb'] + FR + 2, 'wirbel'], [S0['dumb'] + FR + 12, 'huh'],
        [H2, 'impact'], [H2 + 1, 'frei:bruh_01'], [H2 + 8, 'frei:glas_02'], [H2 + 14, 'failhorn']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
