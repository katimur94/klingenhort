# Schnitt Tipp-Clip „Normaler Held vs. Saison-Held“ (1080×1920, 30 fps, ~10 s) – Split-Screen, +1 / +2 bei jedem echten Kill, Zähler aus dem Spiel-Log
# split: oben normaler Held, unten Saison-Held (gleiche Ritterin, gleiche Gegner, zwei echte Kämpfe) · Auflösung „×1,5“ · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-szheld python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-szheld')
RAW = os.path.join(OUT, 'raw')
L = {s: json.load(open(os.path.join(RAW, s, 'log.json'))) for s in 'ab'}
# je Kill ein eigenes „+n“ (fallen zwei Kills in dasselbe Bild, werden die Punkte aufgeteilt und zwei Zahlen gezeigt)
KILLS = {}
for s_ in 'ab':
    KILLS[s_] = []
    for i in range(1, len(L[s_])):
        n = L[s_][i]['k'] - L[s_][i - 1]['k']
        for j in range(n): KILLS[s_].append((i, (L[s_][i]['xp'] - L[s_][i - 1]['xp']) // n, j))
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
TOP = (150, 840); BOT = (870, 1560)
def band(scene, i, y0, y1, cy=960, s=1.05):
    im = load(os.path.join(RAW, scene, '%04d.jpg' % min(i, 249))); h = y1 - y0; ch = h / s
    return im.crop((0, int(cy - ch / 2), W, int(cy + ch / 2))).resize((W, h))
def pops(b, scene, k, y0, col):
    for (f, d, j) in KILLS[scene]:
        a = k - f
        if 0 <= a < 18: place(b, text_img('+%d' % d, 76 + (6 if a < 3 else 0), col), 760 + j * 130 + (a % 2) * 4, y0 + 300 - a * 9 + j * 40, alpha=1 - max(0, a - 10) / 8)
def counter(b, scene, k, y, col):
    x = L[scene][min(k, 249)]
    place(b, text_img('PUNKTE %d' % x['xp'], 50, col), 790, y); place(b, text_img('KILLS %d' % x['k'], 30, WHITE), 860, y + 52)
N = 240; REV = 196
def split(k):
    b = Image.new('RGBA', (W, H), (12, 9, 18, 255))
    b.paste(band('a', k, *TOP), (0, TOP[0])); b.paste(band('b', k, *BOT), (0, BOT[0]))
    d = ImageDraw.Draw(b); d.rectangle((0, TOP[1], W, BOT[0]), fill=(142, 230, 255, 255))
    title(b, k + 12, 'NORMALER HELD', 50, WHITE, TOP[0] + 60); title(b, k + 12, 'SAISON-HELD', 54, ICE, BOT[0] + 60)
    counter(b, 'a', k, TOP[1] - 110, WHITE); counter(b, 'b', k, BOT[1] - 110, ICE)
    pops(b, 'a', k, TOP[0], WHITE); pops(b, 'b', k, BOT[0], ICE)
    if k < 70: title(b, k, 'WER BEKOMMT MEHR?', 54, GOLD, 90)
    else: title(b, k, '+2 STATT +1?!', 70, GOLD, 90, 70)
    if k >= 70: emoji_face(b, k, 'shock', 150, BOT[0] + 200, t0=70, r=56)
    if k >= REV:
        place(b, badge('SAISON-HELD = ×1,5 PUNKTE', 34), W / 2, (TOP[1] + BOT[0]) / 2)
        react(b, k, 'WUSSTEST DU DAS?', 540, BOT[0] + 330, t0=REV + 6, size=60, fill=GOLD)
    else: place(b, text_img('VS', 40, (17, 14, 23)), W / 2, (TOP[1] + BOT[0]) / 2)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'b', '%04d.jpg' % f) for f in range(40, 240, 40)], tag='SPIELST DU SCHON SAISON 1?', extra=badge('SAISON-HELD BEIM ERSTELLEN WAEHLEN', 24))
SCENES = [('split', split, N), ('end', lambda k: END(k + 34, 100), 62)]
HITS = [[0, 'impact'], [70, 'huh'], [REV, 'frei:ding_02'], [REV + 6, 'sparkle'], [N, 'whoosh']] + [[f, 'frei:plopp_01'] for f, _, j in KILLS['b'] if f < N and not j][::2]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=20))
