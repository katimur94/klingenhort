# Schnitt für den wöchentlichen Update-Clip (~13 s): Aufhänger → Feature → „Was ist neu“ → Endkarte.
# Pro Update: zusammen mit scenes.js nach tools/promo/updates/<version>/ kopieren und die Texte
# unter ANPASSEN auf das neue Feature schreiben. Kurz, laut, in Großbuchstaben – höchstens 14 Zeichen pro Zeile.
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip python3 storyboard.py
import json, os, sys, textwrap
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip')
RAW = os.path.join(OUT, 'raw')
NEWS = json.load(open(os.path.join(RAW, 'news.json')))
VER = '.'.join(NEWS['version'].split('.')[:2])
E = NEWS['entry']

# ---------- ANPASSEN ----------
HOOK_TOP = 'NEUES UPDATE'               # erste Zeile im Aufhänger
HOOK_BIG = E['t'].upper()               # große Zeile, z. B. „WOCHEN-EVENTS“
FEATURES = [                            # (Szene, Überschrift, Unterzeile, Farbe)
    ('feature1', 'NEU IM SPIEL', E['t'].upper(), GOLD),
    ('feature2', 'JEDE WOCHE', 'MEHR INHALT', ICE),
]
# ------------------------------


def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.05)
    if k < 3: b = zoom(b, 1.18 - .06 * k)
    place(b, badge('UPDATE ' + VER), W / 2, 260, pop(k))
    title(b, k, HOOK_TOP, 64, WHITE, 380, 3)
    title(b, k, HOOK_BIG, 96, GOLD, 500, 7)
    return b


def feature(scene, top, sub, col):
    def fn(k):
        b = gameplay(RAW, scene, k, k)
        title(b, k, top, 84, col, 340)
        title(b, k, sub, 52, WHITE, 460, 4)
        flash(b, k, .7, 3)
        return b
    return fn


# „Was ist neu“: die wichtigsten Punkte aus dem Changelog nacheinander einblenden
ITEMS = [it for it in E['items'] if it[0] == 'neu'][:3] + [it for it in E['items'] if it[0] != 'neu'][:1]
KIND = {'neu': ('NEU', MOSS), 'besser': ('BESSER', '#57a7d6'), 'fix': ('BEHOBEN', GOLD)}
BG = None


def news(k):
    global BG
    if BG is None: BG = darken(load(os.path.join(RAW, 'hook', '%04d.jpg' % 20)), .28, 12)
    b = BG.copy()
    title(b, k, 'WAS IST NEU', 76, GOLD, 330)
    title(b, k, 'VERSION ' + NEWS['version'], 34, WHITE, 430, 3)
    y = 560
    for i, (kind, text) in enumerate(ITEMS):
        t0 = 8 + i * 12
        lines = textwrap.wrap(text, 30)
        if len(lines) > 3: lines = lines[:3]; lines[2] = lines[2].rstrip(' .,–-') + ' …'
        if k >= t0:
            tag = badge(KIND[kind][0], 20, bg=rgb(KIND[kind][1])[:3])
            place(b, tag, 80 + tag.width / 2, y + 24, pop(k - t0))      # Etiketten-Spalte links
            for j, ln in enumerate(lines):
                im = text_img(ln, 46, WHITE, VT, stroke=3, shadow=3, maxw=700)
                place(b, im, 290 + im.width / 2, y + 22 + j * 50, 1.0, min(1, (k - t0 + 1) / 3))
        y += 56 + 50 * len(lines)
    flash(b, k, .6, 3)
    return b


raw_hook = sorted(os.listdir(os.path.join(RAW, 'hook')))
END = EndCard(RAW, [os.path.join(RAW, 'hook', f) for f in raw_hook[::6]], extra=badge('UPDATE ' + VER + ' IST LIVE', 26))
SCENES = [('hook', hook, 48)] + [(s, feature(s, t, u, c), 72) for s, t, u, c in FEATURES] + [('news', news, 72), ('end', lambda k: END(k, 120), 120)]
# Geräusche: Glitzern bei jedem Punkt in „Was ist neu“
start_news = sum(n for _, _, n in SCENES[:-2])
HITS = [[start_news + 8 + i * 12, 'ting'] for i in range(len(ITEMS))]

if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
