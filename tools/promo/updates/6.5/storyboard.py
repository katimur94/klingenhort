# Schnitt Premieren-Trailer 6.5 „Sturmgipfel“ (1080×1920, 30 fps, ~16 s)
# hook (Blitz + PREMIERE) → Akt 9 im Gewitter → „Lock sie rein“ → vier neue Gegner → Boss Aerok mit Faxen → Was ist neu → Endkarte
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.5 python3 storyboard.py
import json, os, sys, textwrap, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.5')
RAW = os.path.join(OUT, 'raw')
NEWS = json.load(open(os.path.join(RAW, 'news.json')))
VER = '.'.join(NEWS['version'].split('.')[:2])
E = NEWS['entry']
STORM = '#8ee6ff'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

def bolt_flash(b, k, n=5, a=.9):
    # Blitz-Weiß beim Schnitt (wie im Spiel: kaltes Licht)
    flash(b, k, a, n, (210, 235, 255))

def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.06)
    if k < 4: b = zoom(b, 1.22 - .05 * k)
    bolt_flash(b, k - 5, 4, .55); bolt_flash(b, k - 19, 4, .6)
    place(b, badge('PREMIERE', 44, bg=(140, 220, 255)), W / 2, 300, 1 if k < 1 else pop(k))
    title(b, k, 'UPDATE ' + VER, 64, WHITE, 410)
    title(b, k, 'STURMGIPFEL', 104, STORM, 520)
    return b

def act9(k):
    b = gameplay(RAW, 'act9', k, k)
    title(b, k, 'AKT 9', 120, WHITE, 360)
    title(b, k, 'EIN GEWITTER,', 54, STORM, 480, 4)
    title(b, k, 'DAS NIE ENDET', 54, STORM, 550, 8)
    bolt_flash(b, k, 4, .6)
    return b

def lure(k):
    b = gameplay(RAW, 'lure', k, k)
    title(b, k, 'BLITZ-WARNUNG', 80, GOLD, 360)
    title(b, k, 'LOCK SIE REIN!', 64, WHITE, 470, 6)
    if k >= 40: react(b, k, 'BZZZT!', 540, 1250, t0=40, size=84, fill=STORM)
    if k >= 48: emoji_face(b, k, 'cool', 840, 1080, t0=48, r=64)
    return b

NAMES = ['STURMHARPYIE', 'STURMRUFER', 'DONNERZWERG', 'BLITZGOLEM']
def foes(k):
    b = gameplay(RAW, 'foes', k, k, punch=False, drift=.03)
    title(b, k, '4 NEUE GEGNER', 76, STORM, 360)
    for i, n in enumerate(NAMES):
        if k >= 6 + i * 8: place(b, badge(n, 36, bg=(40, 70, 120), fg=(220, 240, 255)), 380, 1020 + i * 100, pop(k - 6 - i * 8))
    return b

FR = 74   # ab hier Standbild: „…und er ist noch nicht fertig“
def boss(k):
    b = gameplay(RAW, 'boss', k, k, drift=.04) if k < FR else freeze(RAW, 'boss', FR - 1, k - FR)
    title(b, k, 'BOSS:', 60, WHITE, 340)
    title(b, k, 'AEROK', 120, STORM, 450, 2)
    title(b, k, 'HERR DER BLITZE', 48, WHITE, 560, 6)
    if 14 <= k < 34: react(b, k, 'NEIN NEIN NEIN', 540, 1240, t0=14, size=64, fill=RED)
    if 34 <= k < FR: react(b, k, 'ROLLE!!!', 540, 1240, t0=34, size=96, fill=GOLD, tilt=6, shake=12)
    if k >= FR:
        react(b, k, '…UND JETZT DU.', 540, 1240, t0=FR, size=72, fill=WHITE)
        emoji_face(b, k, 'skull', 820, 1050, t0=FR + 4, r=70)
    bolt_flash(b, k, 4, .7)
    return b

ITEMS = [it for it in E['items'] if it[0] == 'neu'][:3] + [it for it in E['items'] if it[0] != 'neu'][:1]
KIND = {'neu': ('NEU', MOSS), 'besser': ('BESSER', '#57a7d6'), 'fix': ('BEHOBEN', GOLD)}
BG = None
def news(k):
    global BG
    if BG is None: BG = darken(load(os.path.join(RAW, 'boss', '%04d.jpg' % 45)), .26, 12)
    b = BG.copy()
    title(b, k, 'WAS IST NEU', 76, GOLD, 330)
    title(b, k, 'VERSION ' + NEWS['version'], 34, WHITE, 430, 3)
    y = 540
    for i, (kind, text) in enumerate(ITEMS):
        t0 = 8 + i * 12
        lines = textwrap.wrap(text, 30)
        if len(lines) > 3: lines = lines[:3]; lines[2] = lines[2].rstrip(' .,–-') + ' …'
        if k >= t0:
            tag = badge(KIND[kind][0], 20, bg=rgb(KIND[kind][1])[:3])
            place(b, tag, 80 + tag.width / 2, y + 24, pop(k - t0))
            for j, ln in enumerate(lines):
                im = text_img(ln, 46, WHITE, VT, stroke=3, shadow=3, maxw=640)
                place(b, im, 270 + im.width / 2, y + 22 + j * 50, 1.0, min(1, (k - t0 + 1) / 3))
        y += 56 + 50 * len(lines)
    flash(b, k, .6, 3)
    return b

raw_a = sorted(os.listdir(os.path.join(RAW, 'act9')))
END = EndCard(RAW, [os.path.join(RAW, 'act9', f) for f in raw_a[::6]], extra=badge('UPDATE ' + VER + ' IST LIVE', 26))
SCENES = [('hook', hook, 36), ('act9', act9, 72), ('lure', lure, 72), ('foes', foes, 48), ('boss', boss, 96), ('news', news, 72), ('end', lambda k: END(k, 96), 96)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[S0['hook'], 'impact'], [S0['hook'] + 6, 'roar'], [S0['hook'] + 19, 'impact'], [S0['lure'] + 40, 'boing']] + \
       [[S0['foes'] + 6 + i * 8, 'tick'] for i in range(4)] + \
       [[S0['boss'], 'roar'], [S0['boss'] + 14, 'scratch'], [S0['boss'] + 34, 'whoosh'], [S0['boss'] + FR, 'thud']] + \
       [[S0['news'] + 8 + i * 12, 'ting'] for i in range(len(ITEMS))]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
