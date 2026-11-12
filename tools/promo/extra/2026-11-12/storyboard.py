# Schnitt Tages-Clip „Mein Versteck: Stufe 0 → Stufe 115“ (1080×1920, 30 fps, ~9 s) – Vorher/Nachher + Frage
# ruine: Ruine im Vollbild (Aufhänger) · split: dieselbe Strecke oben als Ruine, unten ausgebaut · fertig: ausgebaut im Vollbild · Endkarte 2 s
# Aufruf: PROMO_OUT=/tmp/klingenhort-versteck python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-versteck')
RAW = os.path.join(OUT, 'raw')
I = json.load(open(os.path.join(RAW, 'info.json'))); LV = I['nachher']['lv']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def full(sc, f, k): return zoom(load(os.path.join(RAW, sc, '%04d.jpg' % f)), 1.25 + .02 * k / 30, 0, -150)

def ruine(k):
    b = full('vorher', k, k)
    title(b, k + 12, 'MEIN VERSTECK', 72, WHITE, 330)
    title(b, k + 12, 'STUFE 0', 100, ICE, 450)
    if k >= 14: react(b, k, 'NUR GERUESTE …', 540, 1300, t0=14, size=52)
    if k >= 20: emoji_face(b, k, 'meh', 860, 900, t0=20, r=64)
    return b
TOP = (150, 830); BOT = (850, 1530)
def band(sc, f, y0, y1):
    im = load(os.path.join(RAW, sc, '%04d.jpg' % f)).crop((0, 270, W, 270 + y1 - y0))
    return im, 0
S1 = 40
def split(k):
    f = min(109, S1 + k)
    b = Image.new('RGBA', (W, H), (12, 9, 18, 255))
    for sc, (y0, y1) in (('vorher', TOP), ('nachher', BOT)):
        im, x = band(sc, f, y0, y1); b.paste(im, (x, y0))
    ImageDraw.Draw(b).rectangle((0, TOP[1], W, BOT[0]), fill=(232, 176, 74, 255))
    title(b, k + 12, 'STUFE 0', 56, ICE, TOP[0] + 60)
    title(b, k, 'STUFE %d' % LV, 64, GOLD, BOT[0] + 60, 6)
    flash(b, k, .5, 4)
    return b
def fertig(k):
    b = full('nachher', 20 + k, k)
    title(b, k, 'SCHMIEDE · LABOR', 50, WHITE, 330); title(b, k, 'BIBLIOTHEK · TEMPEL', 50, WHITE, 410, 4); title(b, k, 'ALLES SELBST GEBAUT', 50, GOLD, 500, 8)
    if k >= 20: meme_bild(b, k, 'hearts', 860, 900, t0=20, size=150)
    flash(b, k, .5, 4)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'nachher', '%04d.jpg' % f) for f in range(0, 110, 20)], tag='WIE WEIT IST DEINS?', extra=badge('SAMMELN · BAUEN · AUSBAUEN', 26))
SCENES = [('ruine', ruine, S1), ('split', split, 110 - S1), ('fertig', fertig, 75), ('end', lambda k: END(k + 34, 94), 60)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'frei:plopp_01'], [14, 'sad'], [S0['split'], 'impact'], [S0['split'] + 6, 'frei:ding_02'], [S0['fertig'], 'impact'], [S0['fertig'], 'sparkle'], [S0['fertig'] + 20, 'frei:komisch_12'], [S0['end'], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
