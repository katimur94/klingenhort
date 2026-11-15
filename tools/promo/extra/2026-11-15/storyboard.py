# Schnitt Tages-Clip „Falsches Element vs. richtiges Element“ (1080×1920, 30 fps, ~9,5 s) – Mini-Tutorial im Split-Screen + Frage
# split: oben Feuer-Klinge gegen Feuer-Gegner (RESISTENT), unten Frost-Klinge (SCHWÄCHE!), Schadens-Zähler aus dem Log · ergebnis · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-element python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-element')
RAW = os.path.join(OUT, 'raw')
A = json.load(open(os.path.join(RAW, 'feuer', 'log.json')))['log']; B = json.load(open(os.path.join(RAW, 'frost', 'log.json')))['log']
X = B[-1] / max(1, A[-1])
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
TOP = (150, 820); BOT = (840, 1510); FIRE = '#ff8a3a'; ICEC = '#8ad8ff'
def band(sc, f, y0, y1):
    h = y1 - y0; cw = 700; ch = int(cw * h / W)
    return load(os.path.join(RAW, sc, '%04d.jpg' % f)).crop((600 - cw // 2, 950 - ch // 2, 600 + cw // 2, 950 + ch // 2)).resize((W, h), Image.NEAREST)
N = 165
def split(k):
    f = min(109, k * 2 // 3)
    b = Image.new('RGBA', (W, H), (12, 9, 18, 255))
    b.paste(band('feuer', f, *TOP), (0, TOP[0])); b.paste(band('frost', f, *BOT), (0, BOT[0]))
    ImageDraw.Draw(b).rectangle((0, TOP[1], W, BOT[0]), fill=(232, 176, 74, 255))
    title(b, k + 12, 'GEGNER: FEUER', 50, WHITE, 80)
    title(b, k + 12, 'FEUER-KLINGE', 56, FIRE, TOP[0] + 60)
    title(b, k + 12, 'FROST-KLINGE', 56, ICEC, BOT[0] + 60)
    place(b, text_img('SCHADEN %d' % A[f], 48, WHITE, stroke=5), W / 2, TOP[1] - 60)
    place(b, text_img('SCHADEN %d' % B[f], 60, GOLD, stroke=5), W / 2, BOT[1] - 60)
    if k >= 30: react(b, k, 'RESISTENT …', 280, TOP[0] + 190, t0=30, size=40, fill=WHITE)
    if k >= 40: emoji_face(b, k, 'meh', 900, TOP[0] + 200, t0=40, r=56)
    if k >= 50: react(b, k, 'SCHWACHPUNKT!', 300, BOT[0] + 190, t0=50, size=44, fill=GOLD, shake=8)
    if k >= 60: emoji_face(b, k, 'cool', 900, BOT[0] + 200, t0=60, r=56)
    return b
def ergebnis(k):
    b = zoom(freeze(RAW, 'frost', 109, k, sat=.6), 1.5, 60, 0)
    title(b, k, 'FAST %d×' % round(X) if X < round(X) else '%d×' % round(X), 130, GOLD, 380)
    title(b, k, 'SO VIEL SCHADEN', 60, WHITE, 520, 4)
    if k >= 12: react(b, k, 'FROST GEGEN FEUER', 540, 1180, t0=12, size=56, fill=ICEC)
    if k >= 18: title(b, k, 'BLITZ GEGEN GIFT · LICHT GEGEN SCHATTEN', 30, WHITE, 1320, 18)
    flash(b, k, .6, 4)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'frost', '%04d.jpg' % f) for f in range(20, 110, 20)], tag='WUSSTEST DU DAS?', extra=badge('6 ELEMENTE · SCHWACHPUNKTE NUTZEN', 24))
SCENES = [('split', split, N), ('ergebnis', ergebnis, 60), ('end', lambda k: END(k + 34, 100), 66)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'impact'], [30, 'sad'], [50, 'frei:ding_02'], [52, 'sparkle'], [100, 'frei:boing_03'], [S0['ergebnis'], 'impact'], [S0['ergebnis'] + 2, 'frei:gong_01'], [S0['ergebnis'] + 12, 'frei:komisch_12'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=20))
