# Schnitt Vorher/Nachher „Meisterschaft: Stufe 1 vs. Stufe 50“ (1080×1920, 30 fps, ~11 s): derselbe Meteorhagel, erst als Lehrling, dann als Legende (golden)
# a (Stufe 1) · Zwischentitel · b (Stufe 50) · Vergleich oben/unten mit der echten Meteorzahl aus dem Spiel · Endkarte mit Frage
# Aufruf: PROMO_OUT=/tmp/klingenhort-meister python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-meister')
RAW = os.path.join(OUT, 'raw')
I = {s: json.load(open(os.path.join(RAW, s, 'log.json')))['info'] for s in 'ab'}
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(840 / max(1, len(s)))), fill, cy, t0)
def shot(s, i, z=1.2): return zoom(load(os.path.join(RAW, s, '%04d.jpg' % min(i, 119))), z + .0007 * i, 0, -90)
def kopf(b, k, stufe, rang, col, met):
    title(b, k, 'METEORHAGEL', 56, WHITE, 250); title(b, k, stufe, 84, col, 350)
    place(b, badge(rang, 34), W / 2, 450)
    if k >= 14: place(b, text_img('%d METEORE' % met, 60, col, stroke=6), W / 2, 1560, pop(k - 14))
NA, NZ, NB, NV = 96, 20, 120, 42
def a(k):
    b = shot('a', k); kopf(b, k, 'STUFE 1', 'MEISTERSCHAFT · LEHRLING', WHITE, I['a']['meteore'])
    if k < 30: react(b, k, 'MEINE ULTIMATIVE …', 540, 1720, size=46, fill=WHITE)
    fade_out(b, k, NA, 8); return b
def z(k):
    b = darken(load(os.path.join(RAW, 'b', '0000.jpg')), .2, 10)
    title(b, k, 'HUNDERTE STUNDEN', 60, WHITE, 860); title(b, k, 'SPAETER …', 60, WHITE, 950, 4)
    return b
def bb(k):
    b = shot('b', k); kopf(b, k, 'STUFE 50', 'MEISTERSCHAFT · LEGENDE', GOLD, I['b']['meteore'])
    if k >= 34: react(b, k, 'GOLDEN?!', 540, 1720, t0=34, size=70, fill=GOLD); meme_bild(b, k, 'exclamations', 910, 1690, t0=40, size=150)
    flash(b, k, .8, 5); return b
def vs(k):
    b = Image.new('RGBA', (W, H), (12, 9, 18, 255))
    for s, y0, col in (('a', 120, WHITE), ('b', 1000, GOLD)):
        im = load(os.path.join(RAW, s, '%04d.jpg' % 52)); band = im.crop((0, 960 - 450 / 1.15, W, 960 + 450 / 1.15)).resize((W, 800))
        b.paste(band, (0, y0)); place(b, text_img(('STUFE 1' if s == 'a' else 'STUFE 50') + ' · %d METEORE' % I[s]['meteore'], 46, col, stroke=6), W / 2, y0 + 730)
    ImageDraw.Draw(b).rectangle((0, 920, W, 1000), fill=(255, 210, 74, 255)); place(b, text_img('VS', 44, (17, 14, 23)), W / 2, 960)
    title(b, k, 'MEISTERSCHAFT', 54, GOLD, 60); return b
END = EndCard(RAW, [os.path.join(RAW, 'b', '%04d.jpg' % f) for f in range(30, 120, 20)], tag='WELCHE FAEHIGKEIT LEVELST DU?', extra=badge('JEDE FAEHIGKEIT BIS STUFE 50', 26))
SCENES = [('a', a, NA), ('z', z, NZ), ('b', bb, NB), ('vs', vs, NV), ('end', lambda k: END(k + 30, 90), 60)]
o = NA + NZ
HITS = [[6, 'whoosh'], [24, 'meteor'], [NA, 'frei:komisch_05'], [o, 'impact'], [o + 6, 'roar'], [o + 24, 'meteor'], [o + 34, 'frei:ding_02'], [o + 40, 'huh'], [o + NB, 'whoosh'], [o + NB + NV, 'whoosh']]
if __name__ == '__main__':
    print(I)
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
