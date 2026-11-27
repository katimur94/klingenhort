# Schnitt Update-Clip 6.9 „Krieg der Kronen 3 – Die Kriegskarte“ (1080×1920, 30 fps, ~14 s), mit Faxen
# hook (Schlacht, UPDATE 6.9) → zeit (Kriegskarte im Zeitraffer: das Spiel rechnet Kriegstag um Kriegstag, Provinzen wechseln die Farbe)
# → wahl (Grenz-Provinz antippen, Feldzug für Sylvara) → kampf (die Schlacht) → sieg (echtes Ergebnis: Provinz erobert) → neu (Karte danach) → Endkarte
# UI-Szenen: Ausschnitt = Tafel des Spiels (raw/<szene>/box.json, CSS-Pixel × 2)
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.9 python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.9')
RAW = os.path.join(OUT, 'raw')
SYL, NORD = '#79d25e', '#8ec0f0'
BOX = {s: json.load(open(os.path.join(RAW, s, 'box.json'))) for s in ('zeit', 'wahl', 'sieg', 'neu')}
PROV = json.load(open(os.path.join(RAW, 'wahl', 'info.json')))['name']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
def tafel(sc, i, top=360, maxh=1250, glow=None):
    """Tafel des Spiels ausschneiden, auf Bildbreite bringen, oben bei top anlegen; glow = Schlüssel aus box.json zum Hervorheben"""
    im = load(os.path.join(RAW, sc, '%04d.jpg' % i)); bx = BOX[sc][min(i, len(BOX[sc]) - 1)]
    x, y, w, h = [v * 2 for v in bx['panel']]; s = min(1060 / w, maxh / h)
    b = darken(im, .25, 12)
    cut = im.crop((x, y, x + w, y + h)).resize((int(w * s), int(h * s)), Image.BILINEAR); x0 = (W - cut.width) // 2
    b.paste(cut, (x0, top), cut)
    if glow and bx.get(glow):
        gx, gy, gw, gh = [v * 2 for v in bx[glow]]; X0, Y0 = x0 + (gx - x) * s, top + (gy - y) * s
        d = ImageDraw.Draw(b); a = 6 + int(3 * math.sin(i * .5))
        d.rectangle((X0 - a, Y0 - a, X0 + gw * s + a, Y0 + gh * s + a), outline=(255, 210, 74, 255), width=6)
    return b
def hook(k):
    b = gameplay(RAW, 'kampf', k, k, punch=False, drift=.05)
    place(b, badge('UPDATE 6.9', 40), W / 2, 290, 1 if k < 1 else pop(k))
    title(b, k + 12, 'DIE KRIEGSKARTE', 84, GOLD, 420)
    if k >= 14: title(b, k, '40 PROVINZEN · 4 REICHE', 46, WHITE, 1450, 14)
    return b
NZ = 120
def zeit(k):
    i = min(k // 2, 59); b = tafel('zeit', i)
    title(b, k + 12, 'DIE FRONTEN WANDERN', 60, GOLD, 200); place(b, badge('ZEITRAFFER · ' + 'TAG %d' % (1 + (i + 1) // 3), 30), W / 2, 290)
    if k >= 50: react(b, k, 'AUCH WENN DU OFFLINE BIST!', 540, 1700, t0=50, size=46, fill=WHITE)
    if k >= 58: emoji_face(b, k, 'cool' if k < 90 else 'meh', 940, 1820, t0=58, r=56)
    return b
def wahl(k):
    b = tafel('wahl', min(k, 43), glow='fz' if k >= 25 else None)
    title(b, k + 12, 'FELDZUG STARTEN', 64, SYL, 200); title(b, k + 12, 'PROVINZ ANTIPPEN', 40, WHITE, 290, 4)
    if k >= 26: react(b, k, 'SYLVARA WILL %s!' % PROV.upper().replace('Ä', 'AE').replace('Ö', 'OE').replace('Ü', 'UE').replace('ß', 'SS'), 540, 1700, t0=26, size=44, fill=SYL)
    return b
NK = 60
def kampf(k):
    b = gameplay(RAW, 'kampf', 36 + k, k, drift=.05)
    title(b, k, '3 SIEGE = PROVINZ', 64, GOLD, 330)
    title(b, k + 12, 'FUER EINE SEITE', 44, WHITE, 430, 4)
    if 20 <= k: emoji_face(b, k, 'cool', 860, 1350, t0=20, r=60)
    return b
def sieg(k):
    b = tafel('sieg', min(k, 39), glow='lohn')
    title(b, k + 12, 'EROBERT!', 96, SYL, 220)
    flash(b, k, .8, 5)
    if k >= 10: meme_bild(b, k, 'stars', 930, 1700, t0=10, size=150)
    return b
def neu(k):
    b = tafel('neu', min(k, 35))
    title(b, k + 12, 'JETZT GRUEN!', 72, SYL, 220)
    if k >= 8: react(b, k, 'NORDMARK: …', 540, 1700, t0=8, size=56, fill=NORD); emoji_face(b, k, 'cry', 900, 1600, t0=14, r=58)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'kampf', '%04d.jpg' % f) for f in range(10, 96, 14)], tag='FUER WELCHES REICH EROBERST DU?', extra=badge('UPDATE 6.9 · KRIEGSKARTE', 28))
SCENES = [('hook', hook, 36), ('zeit', zeit, NZ), ('wahl', wahl, 44), ('kampf', kampf, NK), ('sieg', sieg, 40), ('neu', neu, 40), ('end', lambda k: END(k + 30, 90), 60)]
o = [0]
for _, _, n in SCENES: o.append(o[-1] + n)
HITS = [[0, 'roar'], [6, 'impact'], [o[1], 'whoosh']] + [[o[1] + j * 6, 'tick'] for j in range(1, 20)] + [[o[1] + 50, 'frei:plopp_01'],
        [o[2], 'whoosh'], [o[2] + 24, 'frei:ding_01'], [o[3], 'impact'], [o[3] + 20, 'sparkle'], [o[4], 'frei:gong_01'], [o[4] + 10, 'sparkle'],
        [o[5], 'whoosh'], [o[5] + 8, 'frei:komisch_03'], [o[6], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=20))
