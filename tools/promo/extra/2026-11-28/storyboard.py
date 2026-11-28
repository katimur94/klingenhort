# Schnitt Meme-Clip „POV: Du gehst schlafen … und am Morgen“ (1080×1920, 30 fps, ~11 s) – Kriegskarte aus 6.9, Fronten wandern offline
# abend (Aurelien 9 Provinzen, „alles sicher“) → nacht (3 Kriegstage = 9 Stunden) → morgen (echter Kriegsbericht: Lichtenau Aurelien → Karth → Nordmark,
# Ährental an Karth) → Endkarte mit Frage. UI-Ausschnitt aus raw/<szene>/box.json (CSS-Pixel × 2)
# Aufruf: PROMO_OUT=/tmp/klingenhort-pov python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-pov')
RAW = os.path.join(OUT, 'raw')
BOX = {s: json.load(open(os.path.join(RAW, s, 'box.json'))) for s in ('abend', 'morgen')}
AUR, KAR, NORD = '#ffd24a', '#ff6a4a', '#8ec0f0'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(860 / max(1, len(s)))), fill, cy, t0)
def tafel(sc, i, top=430, glow=None):
    im = load(os.path.join(RAW, sc, '%04d.jpg' % i)); bx = BOX[sc][i]
    x, y, w, h = [v * 2 for v in bx['panel']]; s = 1060 / w
    b = darken(im, .25, 12); cut = im.crop((x, y, x + w, y + h)).resize((int(w * s), int(h * s)), Image.BILINEAR); x0 = (W - cut.width) // 2
    b.paste(cut, (x0, top), cut)
    if glow and bx.get(glow):
        gx, gy, gw, gh = [v * 2 for v in bx[glow]]; X0, Y0 = x0 + (gx - x) * s, top + (gy - y) * s; a = 6 + int(3 * math.sin(i * .5))
        ImageDraw.Draw(b).rectangle((X0 - a, Y0 - a, X0 + gw * s + a, Y0 + gh * s + a), outline=(255, 90, 58, 255), width=6)
    return b
NA, NN, NM = 84, 30, 150
def abend(k):
    b = tafel('abend', min(k, 29))
    title(b, k, 'POV:', 110, WHITE, 190); title(b, k + 12, 'DU GEHST SCHLAFEN', 60, GOLD, 320, 6)
    if k >= 30: react(b, k, 'AURELIEN: 9 PROVINZEN. SICHER.', 540, 1500, t0=30, size=40, fill=AUR); emoji_face(b, k, 'cool', 900, 1640, t0=38, r=60)
    if k > NA - 14: b = Image.blend(b.convert('RGB'), Image.new('RGB', (W, H), (8, 6, 14)), min(1, (k - (NA - 14)) / 14)).convert('RGBA')
    return b
def nacht(k):
    b = Image.new('RGBA', (W, H), (8, 6, 14, 255))
    meme_bild(b, k, 'sleeps', W / 2, 780, size=220)
    title(b, k, '3 KRIEGSTAGE SPAETER', 56, WHITE, 1000, 4); title(b, k, '(9 STUNDEN OFFLINE)', 36, ICE, 1090, 10)
    return b
def morgen(k):
    i = min(k, 59); b = tafel('morgen', i, glow='log' if k >= 24 else None)
    title(b, k + 12, '… UND AM MORGEN:', 64, GOLD, 250)
    if 40 <= k < 95: react(b, k, 'WO IST MEIN AEHRENTAL?!', 540, 1640, t0=40, size=50, fill=KAR); emoji_face(b, k, 'cry', 930, 1500, t0=48, r=60)
    if k >= 95:
        react(b, k, 'LICHTENAU: KARTH NIMMT ES,', 540, 1560, t0=95, size=40, fill=KAR, tilt=4)
        if k >= 108: react(b, k, 'DANN NORDMARK!', 540, 1680, t0=108, size=56, fill=NORD); emoji_face(b, k, 'skull', 930, 1440, t0=112, r=60)
    return b
END = EndCard(RAW, [os.path.join(RAW, 'morgen', '%04d.jpg' % f) for f in (0, 20, 40)], tag='WAS MACHT DEIN REICH, WENN DU SCHLAEFST?', extra=badge('NEU IN 6.9 · KRIEGSKARTE', 28))
SCENES = [('abend', abend, NA), ('nacht', nacht, NN), ('morgen', morgen, NM), ('end', lambda k: END(k + 30, 84), 54)]
o = [0, NA, NA + NN, NA + NN + NM]
HITS = [[0, 'whoosh'], [30, 'frei:ding_01'], [38, 'sparkle'], [o[1], 'frei:komisch_07'], [o[2], 'impact'], [o[2] + 24, 'frei:glas_02'], [o[2] + 40, 'huh'], [o[2] + 48, 'frei:komisch_12'],
        [o[2] + 95, 'frei:plopp_01'], [o[2] + 108, 'frei:bruh_01'], [o[3], 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
