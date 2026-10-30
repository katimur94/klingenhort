# Schnitt für den TikTok-Clip zu 6.3 „Aufträge & Ruf“ (~17 s, 1080×1920, 30 fps):
# Aufhänger → quest (Auftrags-Karte mit echtem Zähler aus raw/quest/info.json, „ERFÜLLT!“) → hide (Weg zur Tafel)
# → board (Tafel-Ausschnitt, Antippen, Belohnung mit neuem Rang) → ruf (Fraktionen, Quartiermeister) → Was ist neu → Endkarte.
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.3 python3 storyboard.py [szene …]
import json, math, os, sys, textwrap
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
from PIL import Image, ImageDraw, ImageFilter

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.3')
RAW = os.path.join(OUT, 'raw')
NEWS = json.load(open(os.path.join(RAW, 'news.json')))
VER = '.'.join(NEWS['version'].split('.')[:2])
E = NEWS['entry']
T1, T2 = 380, 490                 # Überschriften (unter der Anzeige oben rechts)
_C = {}
_title = title


def title(b, k, s, size, fill, cy, t0=0, maxw=1000, path=PS):
    """wie promolib.title, aber nie breiter als ~830 px (rechts ab x 960 liegen die TikTok-Knöpfe)"""
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0, maxw, path)


def heads(b, k, top, big, col, t0=0):
    title(b, k - t0, top, 60, WHITE, T1)
    title(b, k - t0, big, 92, col, T2, 3)


def img(rel):
    if rel not in _C: _C[rel] = load(os.path.join(RAW, rel))
    return _C[rel]


def jload(rel):
    if rel not in _C: _C[rel] = json.load(open(os.path.join(RAW, rel)))
    return _C[rel]


def bgd(rel, f=.3, blur=12):
    key = ('bg', rel)
    if key not in _C: _C[key] = darken(img(rel), f, blur)
    return _C[key]


def bx(scene, key, pad=0):
    r = jload(scene + '/boxes.json')[key]
    return (r['x'] - pad, r['y'] - pad, r['x'] + r['w'] + pad, r['y'] + r['h'] + pad)


def ui(b, src, box, cx, cy, sc, k, col=(232, 176, 74)):
    """Ausschnitt eines Menü-Bilds als Karte (Schatten, Rahmen, kurzes Einschieben); gibt Umrechnung Bild → Video zurück"""
    x0, y0, x1, y1 = [round(v) for v in box]
    c = src.crop((x0, y0, x1, y1)); c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
    cx -= 16; dy = (4 - k) * 26 if 0 <= k < 4 else 0; a = min(1, (k + 1) / 3) if 0 <= k < 3 else 1
    sh = Image.new('RGBA', (c.width + 40, c.height + 40), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((20, 26, c.width + 20, c.height + 26), fill=(0, 0, 0, 150))
    place(b, sh.filter(ImageFilter.GaussianBlur(10)), cx, cy + dy + 6, 1, a)
    place(b, c, cx, cy + dy, 1, a)
    L, T = cx - c.width / 2, cy + dy - c.height / 2
    ImageDraw.Draw(b).rectangle((L - 5, T - 5, L + c.width + 4, T + c.height + 4), outline=col + (255,), width=5)
    return lambda x, y: (cx + (x - (x0 + x1) / 2) * sc, cy + dy + (y - (y0 + y1) / 2) * sc)


def tap(b, x, y, t):
    """Antipp-Kreis (t = Bilder seit dem Antippen)"""
    if t < 0 or t > 11: return
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    r = 22 + t * 8; a = int(240 * (1 - t / 11))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, a), width=8)
    if t < 5: rr = 30 - t * 3; d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 255, 255, 200 - t * 30))
    b.alpha_composite(o)


def vt(s, size, fill=WHITE): return text_img(s, size, fill, VT, stroke=4, shadow=4, maxw=740)


# ---------- Szenen ----------
def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.05)
    if k < 3: b = zoom(b, 1.18 - .06 * k)
    place(b, badge('UPDATE ' + VER), W / 2, 260, pop(k))
    title(b, k, 'NEUES UPDATE', 60, WHITE, T1, 3)
    title(b, k, 'AUFTRÄGE & RUF', 92, GOLD, T2, 7)
    return b


Q = jload('quest/info.json')
QDONE = next((i for i, c in enumerate(Q['c']) if c >= Q['n']), 99)


def quest(k):
    """Kampf mit der Auftrags-Karte: Zähler läuft mit den echten Kills, bei 60/60 „ERFÜLLT!“"""
    b = gameplay(RAW, 'quest', k, k)
    heads(b, k, 'JEDEN TAG', 'AUFTRÄGE', GOLD)
    c, n = Q['c'][min(k, len(Q['c']) - 1)], Q['n']
    done = c >= n; kd = k - QDONE
    x0, y0, x1, y1 = 110, 1170, 890, 1400
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    d.rectangle((x0 + 8, y0 + 10, x1 + 8, y1 + 10), fill=(0, 0, 0, 120))
    d.rectangle((x0, y0, x1, y1), fill=(24, 20, 34, 236), outline=rgb(GOLD)[:3] + (255,) if done else (90, 80, 110, 255), width=6)
    bx0, by0, bx1, by1 = x0 + 30, y0 + 150, x1 - 30, y0 + 200
    d.rectangle((bx0, by0, bx1, by1), fill=(10, 8, 16, 255), outline=(70, 62, 90, 255), width=3)
    d.rectangle((bx0 + 4, by0 + 4, bx0 + 4 + (bx1 - bx0 - 8) * c / n, by1 - 4), fill=rgb(GOLD)[:3] + (255,))
    b.alpha_composite(o)
    place(b, text_img(Q['f'].upper(), 22, GOLD), (x0 + x1) / 2, y0 + 112)
    place(b, vt(Q['t'], 72), (x0 + x1) / 2, y0 + 58)
    num = text_img('%d / %d' % (c, n), 30, WHITE)
    place(b, num, (x0 + x1) / 2, (by0 + by1) / 2, 1.3 if 0 <= kd < 2 or (k > 0 and c != Q['c'][k - 1]) else 1)
    if done:
        place(b, glow_disc(300, '#ffd24a', 110), W / 2, 1080, min(1, (kd + 1) / 4))
        im = text_img('ERFÜLLT!', 84, GOLD)
        place(b, im, W / 2, 1080, pop(kd))
        flash(b, kd, .6, 3)
    return b


def hide(k):
    b = gameplay(RAW, 'hide', k, k)
    heads(b, k, 'AB ZUR', 'AUFTRAGSTAFEL', GOLD)
    return b


BCLAIM = 30   # Bild, in dem „Belohnung abholen“ gedrückt wird (scenes.js)


def board(k):
    b = bgd('hide/0059.jpg').copy()
    if k < BCLAIM:
        heads(b, k, '3 PRO TAG', '3 PRO WOCHE', GOLD)
        h3, card = bx('board', 'h3'), bx('board', 'card')
        m = ui(b, img('board/%04d.jpg' % k), (card[0] - 8, h3[1] - 8, card[2] + 8, card[3] + 10), W / 2, 1060, .92, k)
        cl = bx('board', 'claim'); x, y = m((cl[0] + cl[2]) / 2, (cl[1] + cl[3]) / 2)
        tap(b, x, y, k - (BCLAIM - 6))
    else:
        kk = k - BCLAIM
        heads(b, kk, 'BELOHNUNG', 'NEUER RANG!', GOLD)
        rv = bx('board', 'rev', 6)
        sc = min(.9, 860 / (rv[2] - rv[0]), 840 / (rv[3] - rv[1]))
        m = ui(b, img('board/%04d.jpg' % k), rv, W / 2, 1080, sc, kk)
        up = bx('board', 'up')
        if kk >= 14:
            x0, y0 = m(up[0], up[1]); x1, y1 = m(up[2], up[3])
            a = int(150 + 100 * math.sin(kk * .5)); o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
            d.rectangle((x0 - 10, y0 - 10, x1 + 10, y1 + 10), outline=rgb(GOLD)[:3] + (a,), width=10)
            b.alpha_composite(o)
        flash(b, kk, .7, 3)
    return b


RSPLIT = 30


def ruf(k):
    b = bgd('hide/0059.jpg').copy()
    if k < RSPLIT:
        heads(b, k, '4 FRAKTIONEN', 'RÄNGE & BONI', GOLD)
        r0, r3 = bx('ruf', 'r0'), bx('ruf', 'r3')
        ui(b, img('ruf/list.jpg'), (r0[0] - 8, r0[1] - 8, r0[2] + 8, r3[3] + 8), W / 2, 1060, .88, k)
    else:
        kk = k - RSPLIT
        heads(b, kk, 'RUF-MARKEN', 'TAUSCHWAREN', '#ffb03a')
        s, q3 = bx('ruf', 'say'), bx('ruf', 'q3')
        ui(b, img('ruf/qm.jpg'), (s[0] - 8, s[1] - 8, s[2] + 8, q3[3] + 8), W / 2, 1080, .86, kk, (255, 176, 58))
    return b


# „Was ist neu“: kurze Fassung der Changelog-Punkte (die echten sind für 30 Zeichen × 3 Zeilen zu lang)
ITEMS = [('neu', 'Auftragstafel: 3 Aufträge am Tag, 3 in der Woche'), ('neu', '4 Fraktionen mit Rängen und echten Vorteilen'),
         ('neu', 'Ruf-Marken beim Quartiermeister eintauschen'), ('besser', 'Bestes anlegen und Beute-Filter')]
KIND = {'neu': ('NEU', MOSS), 'besser': ('BESSER', '#57a7d6'), 'fix': ('BEHOBEN', GOLD)}


def news(k):
    b = bgd('hook/0020.jpg', .28).copy()
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
                place(b, im, 290 + im.width / 2, y + 22 + j * 50, 1.0, min(1, (k - t0 + 1) / 3))
        y += 56 + 50 * len(lines)
    flash(b, k, .6, 3)
    return b


raw_hook = sorted(os.listdir(os.path.join(RAW, 'hook')))
END = EndCard(RAW, [os.path.join(RAW, 'hook', f) for f in raw_hook[::6]], extra=badge('UPDATE ' + VER + ' IST LIVE', 26))
SCENES = [('hook', hook, 48), ('quest', quest, 72), ('hide', hide, 60), ('board', board, 72), ('ruf', ruf, 60), ('news', news, 72), ('end', lambda k: END(k, 120), 120)]
START = {}
_s = 0
for nm, _, n in SCENES: START[nm] = _s; _s += n
# Geräusche: Glitzern bei „ERFÜLLT!“, beim Antippen, beim neuen Rang und bei jedem Punkt in „Was ist neu“
HITS = [[START['quest'] + QDONE, 'sparkle'], [START['board'] + BCLAIM - 6, 'tick'], [START['board'] + BCLAIM, 'impact'], [START['board'] + BCLAIM + 14, 'sparkle'], [START['ruf'] + RSPLIT, 'whoosh']] + [[START['news'] + 8 + i * 12, 'ting'] for i in range(len(ITEMS))]

if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
