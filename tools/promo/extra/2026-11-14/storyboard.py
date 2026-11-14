# Schnitt Meme-Clip „Endlich eine Truhe … und sie beißt“ (1080×1920, 30 fps, ~8 s) – Erwartung → Reinfall → Happy End, mit Faxen
# truhe: hinlaufen, zuschlagen · Standbild beim Auftauchen der Goldmimik · Biss · rache: Mimik besiegt, Gold springt heraus (Betrag aus dem Log) · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-mimik python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-mimik')
RAW = os.path.join(OUT, 'raw')
L = json.load(open(os.path.join(RAW, 'truhe', 'log.json'))); M = json.load(open(os.path.join(RAW, 'rache', 'log.json')))
MIM = next(i for i, x in enumerate(L) if x['m']) + 2
BISS = next(i for i in range(1, len(L)) if L[i]['hp'] < L[i - 1]['hp'] - .01)
GOLD_N = M[-1]['g'] - M[0]['g']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f, k, z=1.5): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), z + .03 * k / 30, 60, -90)

def truhe(k):
    b = shot('truhe', k, k)
    title(b, k + 12, 'POV:', 64, WHITE, 330)
    title(b, k + 12, 'ENDLICH EINE TRUHE', 60, GOLD, 430)
    if k >= 8: react(b, k, 'MEINS!!!', 540, 1300, t0=8, size=84, fill=GOLD)
    if k >= 14: meme_bild(b, k, 'hearts', 860, 800, t0=14, size=150)
    return b
FR = 22
def moment(k):
    b = zoom(freeze(RAW, 'truhe', MIM, k, sat=.35), 1.5 + .012 * k, 60, -90)
    title(b, k, 'SIE HAT …', 72, WHITE, 340); title(b, k, 'ZAEHNE?!', 110, RED, 460, 6)
    if k >= 4: meme_bild(b, k, 'question', 260, 800, t0=4, size=160)
    if k >= 10: meme_bild(b, k, 'gesicht/worried', 840, 800, t0=10, size=150, bob=False)
    return b
def biss(k):
    f = MIM + k; b = shot('truhe', min(99, f), k)
    title(b, k, 'GOLDMIMIK!', 96, RED, 380)
    if f >= BISS:
        react(b, k, 'AUA!!!', 540, 1300, t0=BISS - MIM, size=110, fill=RED, shake=14)
        emoji_face(b, k, 'skull', 860, 800, t0=BISS - MIM + 5, r=70)
        flash(b, f - BISS, .6, 4, (255, 120, 120))
    else: react(b, k, 'NEIN NEIN NEIN', 540, 1300, t0=2, size=60, fill=WHITE)
    return b
def rache(k):
    b = shot('rache', k, k, 1.35)
    title(b, k, 'RACHE!', 110, GOLD, 360)
    if k >= 10: title(b, k, '+%d GOLD' % GOLD_N, 84, GOLD, 500, 10)
    if k >= 16: emoji_face(b, k, 'cool', 860, 800, t0=16, r=70)
    if k >= 22: react(b, k, 'HAT SICH GELOHNT', 540, 1300, t0=22, size=52, fill=MOSS)
    flash(b, k, .6, 4)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'rache', '%04d.jpg' % f) for f in range(0, 50, 10)], tag='TRUHE ODER MIMIK?', extra=badge('ERST HAUEN, DANN FREUEN', 26))
SCENES = [('truhe', truhe, MIM), ('moment', moment, FR), ('biss', biss, 100 - MIM), ('rache', rache, 56), ('end', lambda k: END(k + 34, 100), 66)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'frei:ding_02'], [8, 'frei:boing_03'], [S0['moment'], 'scratch'], [S0['moment'] + 4, 'huh'], [S0['biss'], 'dundun'], [S0['biss'] + BISS - MIM, 'impact'], [S0['biss'] + BISS - MIM + 1, 'frei:bruh_01'],
        [S0['rache'], 'impact'], [S0['rache'] + 10, 'sparkle'], [S0['rache'] + 16, 'frei:komisch_12'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
