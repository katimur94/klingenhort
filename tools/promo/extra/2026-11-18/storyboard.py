# Schnitt Meme-Clip „Ich allein gegen ein ganzes Heer? … No way.“ (1080×1920, 30 fps, ~8,3 s) – Erwartung → Enthüllung („No way“-Reveal), mit Faxen
# allein: naher Ausschnitt um die Ritterin, Karths Heer kommt · moment: Standbild „…ODER?“ · reveal: dieselbe Aufnahme zoomt auf die Totale heraus –
# Aureliens Heer stürmt, das Katapult schlägt ein · Endkarte 2 s. Alles aus EINER durchgehenden Aufnahme (raw/schlacht).
# Aufruf: PROMO_OUT=/tmp/klingenhort-heer python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-heer')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def shot(f): return load(os.path.join(RAW, 'schlacht', '%04d.jpg' % f))
Z0, OX, OY = 2.6, -12, -80   # naher Ausschnitt: Ritterin knapp unter der Mitte, das eigene Heer liegt außerhalb
A0, WAIT = 4, 60

def allein(k):
    b = zoom(shot(A0 + k), Z0 + .004 * k, OX, OY)
    title(b, k + 12, 'ICH ALLEIN', 80, WHITE, 280)
    title(b, k + 12, 'GEGEN EIN', 72, RED, 390)
    title(b, k + 12, 'GANZES HEER?', 72, RED, 480)
    if k >= 18: react(b, k, 'BRO …', 540, 1560, t0=18, size=88, fill=WHITE, shake=8)
    if k >= 30: meme_bild(b, k, 'gesicht/worried', 860, 1300, t0=30, size=150, bob=False)
    return b
FR = 16
def moment(k):
    b = zoom(freeze(RAW, 'schlacht', WAIT, k, sat=.35), Z0 + .22 + .01 * k, OX, OY)
    title(b, k, '… ODER?', 120, GOLD, 420)
    if k >= 4: meme_bild(b, k, 'question', 820, 1300, t0=4, size=170)
    return b
ZT = 16; ZE, EY = 1.35, 40   # Ende des Herauszoomens: beide Heere im Bild
def reveal(k):
    u = min(1, k / ZT); e = 1 - (1 - u) ** 3; s = Z0 + .38 + (ZE - Z0 - .38) * e
    b = zoom(shot(WAIT + k), s, OX * (1 - e), OY + (EY - OY) * e)
    if k >= ZT - 2:
        title(b, k, 'MEIN HEER:', 76, GOLD, 300, ZT - 2)
        react(b, k, 'NO WAY!!!', 540, 430, t0=ZT + 4, size=100, fill=GOLD, shake=10)
    if k >= 40: emoji_face(b, k, 'cool', 880, 1150, t0=40, r=70)
    if k >= 72: react(b, k, 'ATTACKE!!!', 540, 1560, t0=72, size=96, fill=MOSS)
    flash(b, k, .7, 5)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'schlacht', '%04d.jpg' % f) for f in range(100, 200, 20)], tag='AURELIEN ODER KARTH?', extra=badge('KRIEG DER KRONEN · NEU', 26))
SCENES = [('allein', allein, WAIT - A0), ('moment', moment, FR), ('reveal', reveal, 120), ('end', lambda k: END(k + 34, 100), 62)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'dundun'], [18, 'frei:bruh_01'], [30, 'huh'], [S0['moment'], 'scratch'], [S0['moment'] + 4, 'frei:schraeg_01'],
        [S0['reveal'], 'whoosh'], [S0['reveal'] + ZT, 'impact'], [S0['reveal'] + ZT + 4, 'frei:gong_01'], [S0['reveal'] + 40, 'frei:komisch_12'], [S0['reveal'] + 72, 'horn'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
