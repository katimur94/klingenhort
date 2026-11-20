# Schnitt Update-Clip 6.8 „Krieg der Kronen 2 – Fünf Kronen“ (1080×1920, 30 fps, ~15 s), mit Faxen
# hook (Nordmark gegen Sylvara, UPDATE 6.8) → bolzen (neue Balliste: Streifen, Rolle, Einschlag) → eryn (Waldmeisterin, Dornenring)
# → wahl (Seitenwahl, Frage) → akt (Chronik Akt 1: der Gast in Violett) → Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.8 python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.8')
RAW = os.path.join(OUT, 'raw')
NORD, SYL, VIO = '#8ec0f0', '#79d25e', '#c090ff'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
def shot(sc, f, z=1.0, oy=0): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), z, 0, oy)

def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.05)
    place(b, badge('UPDATE 6.8', 40, bg=(232, 176, 74)), W / 2, 290, 1 if k < 1 else pop(k))
    title(b, k + 12, 'ZWEI NEUE', 96, WHITE, 420)
    title(b, k + 12, 'REICHE IM KRIEG!', 80, GOLD, 530)
    if k >= 16: title(b, k, 'NORDMARK', 64, NORD, 1250, 16)
    if k >= 24: title(b, k, 'VS SYLVARA', 64, SYL, 1340, 24)
    return b
HIT = 35   # Einschlag des Bolzens (1,1 s nach Bild 2)
def bolzen(k):
    b = shot('bolzen', k, 1.25 + .002 * k)
    title(b, k, 'NEU: BALLISTE', 84, NORD, 330)
    if k < HIT: title(b, k, 'RAUS AUS DEM STREIFEN!', 50, WHITE, 440, 4)
    if 6 <= k < 17: emoji_face(b, k, 'shock', 860, 1250, t0=6, r=64)
    if k >= 17: react(b, k, 'ROLLE!', 300, 1300, t0=17, size=80, fill=GOLD)
    if k >= HIT:
        react(b, k, 'KNAPP!!!', 620, 1480, t0=HIT, size=92, fill=MOSS, shake=12)
        emoji_face(b, k, 'cool', 860, 1250, t0=HIT + 4, r=64); flash(b, k - HIT, .5, 4, (200, 230, 255))
    return b
def eryn(k):
    b = shot('eryn', k, 1.2 + .002 * k)
    title(b, k, 'WALDMEISTERIN ERYN', 64, SYL, 330)
    title(b, k, 'SYLVARA · DORNENKRONE', 40, WHITE, 420, 4)
    if 10 <= k < 34: react(b, k, 'DORNEN?!', 540, 1350, t0=10, size=80, fill=RED, shake=8)
    if k >= 34: meme_bild(b, k, 'laugh', 860, 1250, t0=34, size=140)
    return b
def wahl(k):
    b = shot('wahl', min(k, 29), 1.0)
    d = Image.new('RGBA', (W, 260), (12, 9, 18, 235)); b.paste(d, (0, 1430), d)
    title(b, k, 'WELCHE SEITE', 76, GOLD, 1510)
    title(b, k, 'WAEHLST DU?', 76, WHITE, 1610, 4)
    if k >= 12: meme_bild(b, k, 'question', 900, 1240, t0=12, size=150)
    return b
def akt(k):
    b = shot('akt', min(k, 39), 1.0)
    d = Image.new('RGBA', (W, 230), (12, 9, 18, 235)); b.paste(d, (0, 250), d)
    title(b, k, 'CHRONIK AKT 1', 72, GOLD, 320)
    title(b, k, 'WER IST DER GAST IN VIOLETT?', 40, VIO, 420, 4)
    if k >= 16: emoji_face(b, k, 'shock', 880, 1500, t0=16, r=64)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'hook', '%04d.jpg' % f) for f in range(10, 70, 12)], tag='NORDMARK ODER SYLVARA?', extra=badge('KRIEG DER KRONEN 2 · GRATIS', 26))
SCENES = [('hook', hook, 66), ('bolzen', bolzen, 76), ('eryn', eryn, 60), ('wahl', wahl, 48), ('akt', akt, 44), ('end', lambda k: END(k + 30, 114), 66)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'impact'], [4, 'roar'], [S0['bolzen'], 'whoosh'], [S0['bolzen'] + 6, 'huh'], [S0['bolzen'] + 17, 'frei:boing_03'], [S0['bolzen'] + HIT, 'impact'], [S0['bolzen'] + HIT + 2, 'frei:komisch_12'],
        [S0['eryn'], 'impact'], [S0['eryn'] + 10, 'frei:bruh_01'], [S0['eryn'] + 34, 'frei:ding_02'], [S0['wahl'], 'whoosh'], [S0['wahl'] + 12, 'frei:plopp_01'], [S0['akt'], 'dundun'], [S0['akt'] + 16, 'huh'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
