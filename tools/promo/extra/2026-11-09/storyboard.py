# Schnitt Meme-Clip „5 Minuten vs. 50 Stunden – Folge 2“ (1080×1920, 30 fps, ~8,7 s) – Folge zum bisher besten Clip
# Neu nach der Recherche (TIKTOK.md): Kontrast schon im ersten Bild (Split-Screen), kein Aufbau, kurze Endkarte, Frage für Kommentare.
# split: oben LV 1 kratzt am Schleim · unten LV 100 Meteorhagel gegen Pyraxis und Horde · end: 2 s Endkarte
# Aufruf: PROMO_OUT=/tmp/klingenhort-folge2 python3 storyboard.py
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-folge2')
RAW = os.path.join(OUT, 'raw')
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)

TOP = (150, 800)     # Band oben (y von–bis)
BOT = (830, 1490)    # Band unten, endet vor der Beschreibung
def band(scene, i, y0, y1, cy, s):
    im = load(os.path.join(RAW, scene, '%04d.jpg' % i)); h = y1 - y0
    ch = h / s; c = im.crop((0, int(cy - ch / 2), W, int(cy + ch / 2))).resize((W, h))
    return c

N = 200
BRO = 120
def split(k):
    b = Image.new('RGBA', (W, H), (12, 9, 18, 255))
    b.paste(band('a', k, *TOP, 880, 1.15), (0, TOP[0]))
    b.paste(band('b', k, *BOT, 980, .78), (0, BOT[0]))
    d = ImageDraw.Draw(b); d.rectangle((0, TOP[1], W, BOT[0]), fill=(232, 176, 74, 255))
    place(b, text_img('VS', 40, (17, 14, 23)), W / 2, (TOP[1] + BOT[0]) / 2)
    # Etiketten sofort sichtbar (Haken in der 1. Sekunde)
    title(b, k + 12, 'ICH NACH 5 MIN', 52, ICE, TOP[0] + 60)
    title(b, k + 12, 'ICH NACH 50 STD', 52, GOLD, BOT[0] + 60)
    place(b, badge('FOLGE 2', 26), 140, TOP[0] + 135)
    if k >= 30: title(b, k, 'LV 1 · STARTSCHWERT', 34, WHITE, TOP[1] - 50, 30)
    if k >= 44: emoji_face(b, k, 'meh', 880, TOP[0] + 300, t0=44, r=56)
    if k >= 20: title(b, k, 'LV 100 · METEORHAGEL', 34, GOLD, BOT[1] - 50, 20)
    if k >= BRO:
        react(b, k, 'BRO, STOPP', 540, TOP[0] + 430, t0=BRO, size=56, fill=RED, shake=10)
        meme_bild(b, k, 'drops', 170, TOP[0] + 300, t0=BRO + 6, size=130)
    if k >= 160: meme_bild(b, k, 'laugh', 900, BOT[0] + 420, t0=160, size=140)
    return b

raw_b = sorted(os.listdir(os.path.join(RAW, 'b')))
END = EndCard(RAW, [os.path.join(RAW, 'b', f) for f in raw_b[::8]], tag='WO BIST DU GERADE?', extra=badge('LEVEL 1 BIS 100 · GRATIS', 26))
def end(k):   # verkürzt: springt gleich in die fertige Karte (2 s)
    return END(k + 24, 84)
SCENES = [('split', split, N), ('end', end, 60)]
HITS = [[0, 'impact'], [30, 'frei:plopp_01'], [44, 'huh'], [84, 'impact'], [BRO, 'frei:bruh_01'], [BRO + 2, 'scratch'], [160, 'impact'], [162, 'frei:komisch_12'], [N, 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=20))
