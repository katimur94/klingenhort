# Schnitt des ausführlichen Videos zu 6.1 „Die Endlosen Lande“ (~78 s, 1080×1920, 30 fps).
# Kapitel: Aufhänger (Biome im Schnitt) → 1 Endlose Lande (48 Biome, Regionen, Karte bis zum Rand, Barriere + Werkzeug,
# Leuchtfeuer, Nacht, Tor der Alten) → 2 1200 Bosse (Kodex, Rang 1 / Rang 1200, Trophäe) → 3 Artefakte (Elwa, Fund, Lesen,
# Suchkreis, Siegel, Schatz, Begegnungen) → 4 Kreaturen (77 Arten, Zucht, Mutationen, Ausrüstung, Zauber) → 5 Mods
# (Plätze, Resonanz, Glyphen, Umschmieden/Veredeln/Extrahieren) → Was ist neu → Endkarte.
# Jede Szene ist ein Schnitt mit Becken auf dem Takt; darin Unterschnitte auf Vielfachen von 12 Bildern.
# Meldungen des Spiels (Banner, Hinweise) kommen aus raw/<szene>/msgs.json – im Bild sind sie ausgeblendet und
# werden hier mit genau ihrem Text groß gezeigt (gbanner, gtoast).
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.1 python3 storyboard.py [szene …]
import json, math, os, random, sys, textwrap
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
from PIL import Image, ImageDraw, ImageFilter

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.1')
RAW = os.path.join(OUT, 'raw')
NEWS = json.load(open(os.path.join(RAW, 'news.json')))
PURPLE, MOSS2, ORANGE, BLOOD, NIGHTC, TEAL = '#d0b0ff', '#8ef0a8', '#ff8a3a', '#ff4a3a', '#c79cff', '#57c7e6'
T1, T2, LY = 400, 510, 1440      # Überschriften (unter der Anzeige oben rechts, die bis y 350 reicht) und Zeile unten

# ---------- Hilfen (wie 6.0) ----------
_C = {}
_glow = glow_disc
_title = title


def title(b, k, s, size, fill, cy, t0=0, maxw=1000, path=PS):
    """wie promolib.title, aber nie breiter als ~830 px (rechts ab x 960 liegen die TikTok-Knöpfe)"""
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0, maxw, path)


def glow_disc(r, col, a=180):
    key = ('glow', r, col, a)
    if key not in _C: _C[key] = _glow(r, col, a)
    return _C[key]


def img(rel):
    if rel not in _C: _C[rel] = load(os.path.join(RAW, rel))
    return _C[rel]


def bgd(rel, f=.3, blur=12):
    key = ('bg', rel, f, blur)
    if key not in _C: _C[key] = darken(img(rel), f, blur)
    return _C[key]


def jload(rel):
    if rel not in _C: _C[rel] = json.load(open(os.path.join(RAW, rel)))
    return _C[rel]


def bx(scene, key, pad=0):
    r = jload(scene + '/boxes.json')[key]
    return (r['x'] - pad, r['y'] - pad, r['x'] + r['w'] + pad, r['y'] + r['h'] + pad)


def hexrgb(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


UIS, UIDX = .94, 16   # Menü-Ausschnitte etwas kleiner und nach links: rechter Rand bleibt vor den TikTok-Knöpfen


def ui(b, rel, box, cx, cy, sc=1.0, k=99, frame_col=(232, 176, 74), src=None):
    """Ausschnitt eines Standbilds als Karte (Rahmen, Schatten, kurzes Einschieben). Gibt Umrechnung Bild → Video zurück."""
    x0, y0, x1, y1 = box
    sc = sc * UIS; cx = cx - UIDX
    key = ('ui', rel, box, sc)
    if src is not None or key not in _C:
        c = (src if src is not None else img(rel)).crop(box)
        if abs(sc - 1) > .001: c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
        if src is not None: _C.pop(key, None)
        else: _C[key] = c
    else: c = _C[key]
    dy = (4 - k) * 26 if 0 <= k < 4 else 0
    a = min(1, (k + 1) / 3) if 0 <= k < 3 else 1
    sh = Image.new('RGBA', (c.width + 40, c.height + 40), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((20, 26, c.width + 20, c.height + 26), fill=(0, 0, 0, 150))
    place(b, sh.filter(ImageFilter.GaussianBlur(10)), cx, cy + dy + 6, 1, a)
    place(b, c, cx, cy + dy, 1, a)
    d = ImageDraw.Draw(b); L, T = cx - c.width / 2, cy + dy - c.height / 2
    d.rectangle((L - 5, T - 5, L + c.width + 4, T + c.height + 4), outline=frame_col + (255,), width=5)
    return lambda x, y: (cx + (x - (x0 + x1) / 2) * sc, cy + dy + (y - (y0 + y1) / 2) * sc)


def mbox(m, box):
    x0, y0 = m(box[0], box[1]); x1, y1 = m(box[2], box[3]); return x0, y0, x1, y1


def tap(b, x, y, t):
    """Antipp-Kreis (t = Bilder seit dem Antippen)"""
    if t < 0 or t > 11: return
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    r = 22 + t * 8; a = int(240 * (1 - t / 11))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, a), width=8)
    if t < 5: rr = 30 - t * 3; d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 255, 255, 200 - t * 30))
    b.alpha_composite(o)


def tapbox(b, bb, t): tap(b, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, t)


def hl(b, x0, y0, x1, y1, k, col=GOLD):
    """pulsierender Rahmen um einen Knopf oder Bereich"""
    a = int(150 + 100 * math.sin(k * .5)); o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    c = rgb(col)[:3]
    for i, w in enumerate((14, 7)):
        d.rectangle((x0 - 8 - i * 4, y0 - 8 - i * 4, x1 + 8 + i * 4, y1 + 8 + i * 4), outline=c + (a // (i + 1),), width=w)
    b.alpha_composite(o)


def vt(s, size, fill=WHITE, maxw=900): return text_img(s, size, fill, VT, stroke=4, shadow=4, maxw=maxw)


def label(b, k, s, size, fill, cy, t0=0, path=VT):
    """kleinere Zeile (VT323) mit kurzem Einblenden"""
    if k < t0: return
    im = vt(s, round(size * 1.1), fill) if path == VT else text_img(s, size, fill)
    place(b, im, W / 2 - 10, cy, 1.15 if k - t0 == 0 else 1.05 if k - t0 == 1 else 1, min(1, (k - t0 + 1) / 2))


def heads(b, k, a, bcol, t0=0, s1=64, s2=92, c1=WHITE):
    """zwei Überschriften: kleine weiße Zeile, große farbige Zeile"""
    if a[0]: title(b, k - t0, a[0], s1, c1, T1)
    if a[1]: title(b, k - t0, a[1], s2, bcol, T2, 3 if a[0] else 0)


def row(b, parts, cy, gap=14):
    w = sum(p.width for p in parts) + gap * (len(parts) - 1); x = W / 2 - w / 2
    for p in parts: place(b, p, x + p.width / 2, cy); x += p.width + gap


def sparkles(b, cx, cy, k, seed, n=14, rad=330, col=WHITE):
    R = random.Random(seed); d = ImageDraw.Draw(b)
    for i in range(n):
        a = R.uniform(0, 6.283); r = R.uniform(.35, 1) * rad; ph = R.uniform(0, 6.283); s = R.choice((6, 8, 10))
        tw = math.sin(k * .45 + ph)
        if tw < .1: continue
        x, y = cx + math.cos(a) * r, cy + math.sin(a) * r * .8; z = s * tw
        c = rgb(col)[:3] + (255,)
        d.rectangle((x - z / 2, y - z * 1.5, x + z / 2, y + z * 1.5), fill=c); d.rectangle((x - z * 1.5, y - z / 2, x + z * 1.5, y + z / 2), fill=c)


def stage_bg(col, k, glow=120):
    b = Image.new('RGBA', (W, H), (22, 15, 32, 255))
    place(b, rays(760, col, k * .02, 14, 34), W / 2, 980)
    place(b, glow_disc(620, col, glow), W / 2, 980)
    return b


def gp(scene, i, k, punch=True, drift=.04):
    """Aufnahme wie promolib.gameplay (Bildnummer wird auf die Aufnahme begrenzt)"""
    n = len([f for f in os.listdir(os.path.join(RAW, scene)) if f.endswith('.jpg')])
    return gameplay(RAW, scene, max(0, min(i, n - 1)), k, punch, drift)


def info(scene): return jload(scene + '/info.json')


def msgs(scene): return jload(scene + '/msgs.json')['msg']


def mfirst(scene, pat, kind=None):
    """Bild, in dem eine Meldung des Spiels kam (erstes Vorkommen), und die Meldung"""
    for m in msgs(scene):
        if (kind is None or m['k'] == kind) and pat in m['t']: return m['f'], m
    raise KeyError(scene + ': ' + pat)


def lines14(s, n=14):
    """Überschrift in Zeilen zu höchstens n Zeichen (an Leerzeichen)"""
    out, cur = [], ''
    for w in s.split():
        if cur and len(cur) + 1 + len(w) > n: out.append(cur); cur = w
        else: cur = (cur + ' ' + w).strip()
    if cur: out.append(cur)
    return out


def gbanner(b, k, t, col=GOLD, y0=None, first=None):
    """Banner des Spiels (sein Text, groß gesetzt): dunkles Band, Zeilen ≤ 14 Zeichen in Pixelschrift.
    first: erste Zeile klein und weiß (z. B. „NEUE REGION:“), Rest groß in col."""
    if k < 0: return
    ls = ([first] if first else []) + lines14(t)
    n = len(ls); y0 = y0 if y0 is not None else (T1 + T2) / 2 - (n - 1) * 52
    a = min(1, (k + 1) / 3)
    band = Image.new('RGBA', (W, int(n * 104 + 70)), (10, 6, 14, int(150 * a)))
    d = ImageDraw.Draw(band); d.line((0, 4, W, 4), fill=rgb(col)[:3] + (int(200 * a),), width=4); d.line((0, band.height - 5, W, band.height - 5), fill=rgb(col)[:3] + (int(200 * a),), width=4)
    place(b, band, W / 2, y0 + (n - 1) * 52)
    for j, ln in enumerate(ls):
        small = first and j == 0
        title(b, k - j, ln, 54 if small else 86, WHITE if small else col, y0 + j * 104)


def gtoast(b, k, s, col='#ffd24a', cy=1300, size=62):
    """Hinweis des Spiels (sein Text): Kasten wie im Spiel, Text in VT323, umgebrochen (zuerst am Gedankenstrich)"""
    if k < 0: return
    ps = s.split(' – '); ls = []
    for j, p_ in enumerate(ps): ls += textwrap.wrap(p_ + (' –' if j < len(ps) - 1 else ''), 24)
    ims = [text_img(l, size, col, VT, stroke=3, shadow=3, maxw=820) for l in ls]
    w = max(i.width for i in ims) + 60; h = sum(i.height for i in ims) + 40
    box = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0)); d = ImageDraw.Draw(box)
    d.rectangle((0, 0, w + 15, h + 15), fill=(12, 8, 16, 255)); d.rectangle((6, 6, w + 9, h + 9), fill=(46, 38, 56, 245), outline=(168, 150, 120, 255), width=4)
    y = 28
    for im in ims: box.alpha_composite(im, ((box.width - im.width) // 2, y)); y += im.height
    place(b, box, W / 2 - 16, cy, POP[k] ** .4 if k < len(POP) else 1)


def dots(n): return '{:,}'.format(n).replace(',', '.')


def arrow(w=70, h=34, col=WHITE):
    """Pfeil (die Pixelschriften haben kein →)"""
    im = Image.new('RGBA', (w + 12, h + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = rgb(col)
    m = h / 2 + 6; t = h * .22; hw = h * .55
    pts = [(6, m - t), (6 + w - hw, m - t), (6 + w - hw, 6), (6 + w, m), (6 + w - hw, 6 + h), (6 + w - hw, m + t), (6, m + t)]
    d.polygon(pts, fill=c, outline=(10, 6, 14, 255)); d.line(pts + [pts[0]], fill=(10, 6, 14, 255), width=4)
    return im


def label_ab(b, k, a, c, size, fill, cy, t0=0):
    """Zeile „a → c“ mit gezeichnetem Pfeil"""
    if k < t0: return
    parts = [vt(a, round(size * 1.1), fill), arrow(64, 32, fill), vt(c, round(size * 1.1), fill)]
    w = sum(p.width for p in parts) + 28; x = W / 2 - 10 - w / 2; al = min(1, (k - t0 + 1) / 2)
    for p in parts: place(b, p, x + p.width / 2, cy, 1, al); x += p.width + 14


def segs(k, cuts):
    """Unterschnitte: cuts = [(von, bis), …] (Bilder der Aufnahme) → (Bildnummer, Bild im Unterschnitt, Nummer des Unterschnitts)"""
    for j, (a, e) in enumerate(cuts):
        if k < e - a: return a + k, k, j
        k -= e - a
    a, e = cuts[-1]; return e - 1, e - a - 1, len(cuts) - 1


CHAP = ['ENDLOSE LANDE', '1200 BOSSE', 'ARTEFAKTE', 'KREATUREN', 'MODS']


def chapter(b, k, n):
    """Kapitel-Etikett oben mit Fortschritt (5 Kapitel); schmal genug für die Anzeige oben rechts"""
    place(b, badge('%d/5 · %s' % (n, CHAP[n - 1]), 20), W / 2 - 16, 236, pop(k))
    d = ImageDraw.Draw(b)
    for i in range(5):
        x = W / 2 - 16 + (i - 2) * 66
        c = (255, 210, 74, 255) if i == n - 1 else (150, 112, 50, 255) if i < n - 1 else (40, 30, 52, 230)
        d.rectangle((x - 28, 278, x + 28, 287), fill=c, outline=(10, 6, 14, 255), width=2)


def note(b, s, cy=LY + 56, col=ICE):
    """kleiner Vermerk: was fürs Video gestellt ist"""
    place(b, text_img(s, 34, col, VT, stroke=3, shadow=3, maxw=860), W / 2 - 10, cy)


# ---------- Aufhänger (96): Kampf am Vulkanhang, dann Biome im Takt ----------
LOGO = logo()
HOOKB = ['gletscher', 'wueste', 'pilz', 'kristall', 'schattenwald', 'sternenfeld']


def hook(k):
    if k < 24:
        b = gp('h_fight', k + 14, k, punch=False, drift=.05); I = info('h_fight')
        if k < 3: b = zoom(b, 1.16 - .05 * k)
    else:
        j, kk = (k - 24) // 12, (k - 24) % 12; sc = 'w_' + HOOKB[j]; I = info(sc)
        b = gp(sc, kk + 6, kk, punch=True, drift=.05); flash(b, kk, .55, 3)
    place(b, badge('UPDATE 6.1'), W / 2, 236, pop(k))
    place(b, LOGO, W / 2 - 24, 352, .54 * min([1.22, 1.1, 1.03, .99, 1.0][k] if k < 5 else 1, 1))
    title(b, k, 'DIE ENDLOSEN', 60, WHITE, 462)
    title(b, k, 'LANDE', 110, GOLD, 566, 2)
    tag = badge('%s · STUFE %d' % (I['n'].upper(), I['st']), 24, bg=(40, 30, 52), fg=(255, 246, 224))
    place(b, tag, W / 2 - 16, 1290, pop(k if k < 24 else (k - 24) % 12))
    label(b, k, 'EINE FESTE WELT – FÜR ALLE GLEICH', 54, ICE, LY, 6)
    return b


# ---------- 1 Endlose Lande ----------
# 48 Biome (96): zwölf Aufnahmen im Raster, nach Stufe sortiert
GRID = sorted(['gletscher', 'wueste', 'pilz', 'kristall', 'schattenwald', 'riff', 'sternenfeld', 'dschungel', 'herbst', 'traumwiese', 'chaos', 'goetterhain'], key=lambda b_: info('w_' + b_)['st'])


def biomes(k):
    b = bgd('w_dschungel/0018.jpg', .22, 16).copy()
    for i, bio in enumerate(GRID):
        t0 = i * 2
        if k < t0: continue
        sc = 'w_' + bio; I = info(sc); fr = min(35, 3 + int(k * 31 / 96))
        im = load(os.path.join(RAW, sc, '%04d.jpg' % fr)).crop((540 - 270, 960 - 190, 540 + 270, 960 + 190)).resize((290, 204), Image.LANCZOS)
        cx = W / 2 - 16 + (i % 3 - 1) * 302; cy = 676 + (i // 3) * 212
        s = POP[k - t0] ** .4 if k - t0 < len(POP) else 1
        tile = im.copy(); d = ImageDraw.Draw(tile); d.rectangle((0, 160, 290, 204), fill=(10, 6, 14, 190))
        t = text_img('%s · ST. %d' % (I['n'].upper(), I['st']), 28, WHITE, VT, stroke=2, shadow=2, maxw=280); tile.alpha_composite(t, ((290 - t.width) // 2, 168))
        d.rectangle((0, 0, 289, 203), outline=(232, 176, 74, 255), width=4)
        place(b, tile, cx, cy, s)
    title(b, k, '48 BIOME', 110, GOLD, T1 + 50)
    label(b, k, 'JE WEITER VOM TOR, DESTO HÄRTER', 54, ICE, LY + 44, 24)
    chapter(b, k, 1); flash(b, k, .6, 3)
    return b


# Neue Region (72): über die Grenze vom Felsland ins Schneefeld – Banner des Spiels
RG_F, RG_M = mfirst('region', 'NEUE REGION')
RG_OFF = RG_F - 34


def region(k):
    i = k + RG_OFF; b = gp('region', i, k, drift=.03)
    if i < RG_F:
        heads(b, k, ('REGIONEN', 'MIT NAMEN'), GOLD)
        label(b, k, 'NOCH: ' + info('region')['from'].upper(), 52, ICE, LY, 4)
    else:
        t = RG_M['t'].split(':', 1)
        gbanner(b, i - RG_F, t[1].strip(), GOLD, first=t[0] + ':')
        label(b, i - RG_F, RG_M['s'], 50, WHITE, LY, 2)
        if i - RG_F < 5: flash(b, i - RG_F, .35, 5, (230, 245, 255))
    chapter(b, k, 1)
    return b


# Karte (132): vom Tor bis an den Rand der Welt – stufenloser Zoom aus 13 echten Kartenbildern
MAPI = info('map'); ZS = [z['z'] for z in MAPI['zs']]; MAPS = 840


def mapimg(z):
    key = ('map', z)
    if key not in _C: _C[key] = load(os.path.join(RAW, 'map', 'z_%d.png' % z))
    return _C[key]


def mapview(lz):
    """Ansicht bei log2(z) = lz: gröberes Bild hinten, feineres darüber eingeblendet"""
    S = MAPS; zv = 2 ** lz; ia = max(0, min(len(ZS) - 2, int(math.floor(lz - 4))))
    zA, zB = ZS[ia], ZS[ia + 1]; fr = max(0, min(1, lz - 4 - ia))
    out = Image.new('RGBA', (S, S), (12, 10, 16, 255))
    sB = round(S * zB / zv); B = mapimg(zB).resize((sB, sB), Image.NEAREST); out.alpha_composite(B, ((S - sB) // 2, (S - sB) // 2)) if sB <= S else out.alpha_composite(B.crop(((sB - S) // 2, (sB - S) // 2, (sB - S) // 2 + S, (sB - S) // 2 + S)))
    if fr < 1:
        sA = round(S * zA / zv); A = mapimg(zA).resize((sA, sA), Image.NEAREST); A.putalpha(int(255 * (1 - fr)))
        out.alpha_composite(A, ((S - sA) // 2, (S - sA) // 2))
    return out, MAPI['zs'][max(0, min(len(ZS) - 1, round(lz - 4)))]['w']


def world(k):
    b = bgd('map/screen.jpg', .25, 10).copy()
    t = 0 if k < 14 else min(1, (k - 14) / 92)
    lz = 4 + 12 * ease(t); mv, wtxt = mapview(lz)
    cx, cy = W / 2 - 16, 1000; dy = (4 - k) * 26 if k < 4 else 0
    sh = Image.new('RGBA', (MAPS + 40, MAPS + 40), (0, 0, 0, 0)); ImageDraw.Draw(sh).rectangle((20, 26, MAPS + 20, MAPS + 26), fill=(0, 0, 0, 150))
    place(b, sh.filter(ImageFilter.GaussianBlur(10)), cx, cy + dy + 6); place(b, mv, cx, cy + dy)
    d = ImageDraw.Draw(b); L, T = cx - MAPS / 2, cy + dy - MAPS / 2
    d.rectangle((L - 5, T - 5, L + MAPS + 4, T + MAPS + 4), outline=(232, 176, 74, 255), width=5)
    # Breite der Ansicht, wie das Spiel sie unter die Karte schreibt
    wt = vt(wtxt.upper(), 46, WHITE); place(b, wt, L + 20 + wt.width / 2, T + MAPS - 34)
    nt = text_img('KARTE FÜRS VIDEO AUFGEDECKT', 28, ICE, VT, stroke=3, shadow=3); place(b, nt, L + 16 + nt.width / 2, T + 26)
    if k >= 106:   # Rand der Welt: 9000 Chunks vom Tor
        r = 9000 * 768 / ZS[-1] / 240 * MAPS; o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); a = int(160 + 90 * math.sin(k * .4))
        ImageDraw.Draw(o).ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 210, 74, a), width=6); b.alpha_composite(o)
    heads(b, k, ('24 STUNDEN', 'BIS ZUM RAND'), GOLD, s2=84)
    if k < 60: label(b, k, 'VOM WELTENTOR AUS GESEHEN', 52, ICE, LY + 20, 6)
    else: label(b, k - 60, 'STUFE %d AM TOR · STUFE %d AM RAND' % (MAPI['edge']['st0'], MAPI['edge']['st1']), 50, ORANGE, LY + 20, 0)
    chapter(b, k, 1); flash(b, k, .5, 3)
    return b


# Barriere (180): ohne Seil kein Weg über die Schlucht → Werkzeug-Hort mit Runenrätsel → mit Seil hinüber
BA_F, BA_M = mfirst('bar_a', 'Du brauchst')
HORT = [(14, 38), (86, 98), (110, 122), (134, 146), (176, 188)]   # Stein I (Wächter erwachen), Stein III, Stein IV (Hort öffnet), Sockel, Banner
HO_F, HO_M = mfirst('bar_hort', 'DER HORT')
HT_F, HT_M = mfirst('bar_hort', 'NEUES WERKZEUG')
HLOG = jload('bar_hort/msgs.json')['log']
BB_F, BB_M = mfirst('bar_b', 'Mit Seil')
TOOLC = '#c8a070'


def barrier(k):
    if k < 60:
        i = k + BA_F - 44; b = gp('bar_a', i, k, drift=.03)
        heads(b, k, ('NICHT JEDER', 'WEG IST OFFEN'), ORANGE, s2=70)
        if i < BA_F: label(b, k, 'SCHLUCHTEN · FLÜSSE · LAVA · EIS ...', 52, '#ffb08a', LY, 4)
        else: gtoast(b, i - BA_F, BA_M['t'], '#ff8a5a', 1330)
    elif k < 132:
        kk = k - 60; i, j, n = segs(kk, HORT); b = gp('bar_hort', i, j, punch=n > 0, drift=.03)
        if i >= HT_F:
            gbanner(b, i - HT_F, HT_M['t'].split(':', 1)[1].strip(), TOOLC, first=HT_M['t'].split(':', 1)[0] + ':')
            label(b, i - HT_F, 'DAMIT GEHT ES ÜBER SCHLUCHTEN', 50, WHITE, LY, 2)
        else:
            heads(b, kk, ('DAS WERKZEUG', 'LIEGT IM HORT'), TOOLC, s2=74)
            lit = HLOG[min(i, len(HLOG) - 1)][0]
            if i >= HO_F: label(b, 0, HO_M['t'], 60, GOLD, LY)
            else: label(b, 0, 'RUNENSTEINE BERÜHREN: %d / 4' % lit, 52, '#9ad8ee', LY)
        if j == 0 and n > 0: flash(b, 0, .35, 3)
    else:
        kk = k - 132; i = kk + BB_F - 36; b = gp('bar_b', i, kk, drift=.03)
        heads(b, kk, ('MIT DEM SEIL', 'HINÜBER!'), TOOLC)
        if i < BB_F: label(b, kk, 'SPÄTER AM ÜBERGANG', 52, ICE, LY, 2)
        else: gtoast(b, i - BB_F, BB_M['t'], TOOLC, 1330)
        flash(b, kk, .5, 3)
    chapter(b, k, 1)
    return b


# Leuchtfeuer (144): Bildschirm → Entzünden → das Feuer brennt → nächstes Mal hier starten
CL_M = msgs('cp_light')[0]


def beacon(k):
    if k < 36:
        kk = k; b = bgd('cp_screen/screen.jpg').copy(); p = bx('cp_screen', 'panel')
        m = ui(b, 'cp_screen/screen.jpg', (40, p[1] - 6, 1040, p[3] + 6), W / 2, 1000, 1.0, kk)
        if 6 <= kk < 24: hl(b, *mbox(m, bx('cp_screen', 'rules')), kk, GOLD)
        if kk >= 22: hl(b, *mbox(m, bx('cp_screen', 'ok')), kk, ORANGE)
        tapbox(b, mbox(m, bx('cp_screen', 'ok')), kk - 28)
        heads(b, kk, ('LEUCHTFEUER', 'SETZEN'), ORANGE)
        label(b, kk, 'KARTE SICHERN · STARTPUNKT · AUSGANG', 48, ICE, LY + 40, 4)
    elif k < 84:
        kk = k - 36; b = gp('cp_light', kk, kk, drift=.03)
        flash(b, kk, .8, 6, (255, 220, 150))
        gbanner(b, kk, CL_M['t'], ORANGE)
        label(b, kk, CL_M['s'].split('.')[0] + '.', 48, WHITE, LY, 3)
    else:
        kk = k - 84; st = 'g0' if kk < 24 else 'g1'; b = bgd('cp_gate/%s.jpg' % st).copy(); s0 = bx('cp_gate', 'head')
        m = ui(b, 'cp_gate/%s.jpg' % st, (60, s0[1] - 30, 1020, s0[1] + 380), W / 2, 1000, 1.04, kk if kk < 24 else 99)
        tapbox(b, mbox(m, bx('cp_gate', 'opt1')), kk - 18)
        if kk >= 24: hl(b, *mbox(m, bx('cp_gate', 'opt1')), kk, GOLD)
        heads(b, kk, ('NÄCHSTES MAL', 'HIER STARTEN'), GOLD, s2=74)
        label(b, kk, 'BIS ZU 12 LEUCHTFEUER', 54, ORANGE, LY, 4)
        if kk == 24: flash(b, 0, .35, 3)
    chapter(b, k, 1); flash(b, k, .6, 3)
    for s0 in (36, 84): flash(b, k - s0, .5, 3)
    return b


# Die Nacht bricht an (96): Zeitraffer – dunkler, Jäger der Nacht
NI_F, NI_M = mfirst('night', 'NACHT BRICHT')
NI_OFF = NI_F - 52


def night(k):
    i = k + NI_OFF; b = gp('night', i, k, drift=.02)
    if i < NI_F:
        heads(b, k, ('TAG UND', 'NACHT'), NIGHTC, s2=110)
        label(b, k, 'ZEITRAFFER: DIE SONNE SINKT', 54, '#ffd08a', LY, 4)
    else:
        gbanner(b, i - NI_F, NI_M['t'], NIGHTC)
        label(b, i - NI_F, NI_M['s'].split('.')[0].upper(), 52, '#ff9a6a', LY, 3)
        if i == NI_F: flash(b, 0, .5, 4, (120, 60, 200))
    chapter(b, k, 1)
    return b


# Tor der Alten (72): hineinlaufen, Zähler, entkommen
XLOG = jload('exit/msgs.json')['log']
XEND = max(i for i, v in enumerate(XLOG) if v[0] >= 0)
EXC = [(10, 34), (XEND - 23, XEND + 1)]


def exit_(k):
    if k < 48:
        i, j, n = segs(k, EXC); b = gp('exit', i, j, punch=n == 0, drift=.03)
        heads(b, k, ('RAUS DURCH', 'TORE DER ALTEN'), MOSS2)
        ob = XLOG[min(i + 1, len(XLOG) - 1)][1] or ''
        if ob: place(b, text_img(ob, 54, MOSS2), W / 2 - 16, 720)
        label(b, k, 'HINEINSTELLEN UND WARTEN', 54, MOSS2, LY, 4)
        if n == 1 and j == 0: flash(b, 0, .35, 3)
        if k > 41: b.alpha_composite(Image.new('RGBA', (W, H), (210, 255, 220, int(255 * (k - 41) / 7))))
    else:
        kk = k - 48; b = bgd('exit_done/done.jpg').copy(); p = bx('exit_done', 'panel')
        ui(b, 'exit_done/done.jpg', (40, p[1] - 6, 1040, p[1] + 1000), W / 2, 1010, .95, kk)
        title(b, kk, 'ENTKOMMEN!', 96, MOSS2, T1 + 40)
        flash(b, kk, .8, 5, (210, 255, 220))
    chapter(b, k, 1)
    return b


# ---------- 2 1200 Bosse ----------
def kodex(k):
    if k < 36:
        kk = k; b = bgd('kodex/k0.jpg').copy(); t0 = bx('kodex', 'top'); bd = bx('kodex', 'bands')
        m = ui(b, 'kodex/k0.jpg', (60, t0[1] - 16, 1020, bd[3] + 16), W / 2, 1010, 1.06, kk)
        if 6 <= kk < 20: hl(b, *mbox(m, bx('kodex', 'n')), kk, GOLD)
        if kk >= 18: hl(b, *mbox(m, bx('kodex', 'b0')), kk, '#79c24e'); hl(b, *mbox(m, bx('kodex', 'b11')), kk, '#c8342c')
        label(b, kk, 'VON „LEICHT“ BIS „FAST UNMÖGLICH“', 50, ICE, LY + 30, 4)
    else:
        kk = k - 36; b = bgd('kodex/k1.jpg').copy(); bd = bx('kodex', 'bands')
        m = ui(b, 'kodex/k1.jpg', (40, bd[1] - 16, 1040, bd[1] + 920), W / 2, 1020, 1.0, kk)
        hl(b, *mbox(m, bx('kodex', 'b11')), kk, '#c8342c')
        label(b, kk, 'TROPHÄEN MACHEN DICH STÄRKER', 52, GOLD, LY + 30, 2)
        flash(b, kk, .45, 3)
    heads(b, k, ('BOSS-KODEX', '1200 BOSSE'), GOLD, s2=96)
    chapter(b, k, 2); flash(b, k, .7, 3)
    return b


BL, BH = info('b_low'), info('b_high')


def fights(k):
    if k < 84:
        kk = k; b = gp('b_low', kk + 10, kk, drift=.03)
        heads(b, kk, ('RANG %d' % BL['rank'], BL['band'].upper()), '#79e04a', s2=110)
        label(b, kk, '%s · %s' % (BL['name'].upper(), ' · '.join(BL['mech']).upper()), 52, '#ffb08a', LY, 4)
    else:
        kk = k - 84; b = gp('b_high', kk + 12, kk, drift=.03)
        heads(b, kk, ('RANG %d' % BH['rank'], BH['band'].upper()), BLOOD, s2=84)
        label(b, kk, '%d MECHANIKEN – JEDE KÜNDIGT SICH AN' % len(BH['mech']), 48, '#ffb08a', LY, 4)
        flash(b, kk, .55, 4, (255, 80, 60))
    note(b, 'GESTELLT: HELD UNVERWUNDBAR', LY + 56)
    return b


TK_F, TK_M = mfirst('b_kill', 'TROPHÄE')
BK_F, BK_M = mfirst('b_kill', 'BOSS BESIEGT')


def trophy(k):
    b = gp('b_kill', k, k, drift=.03)
    if k < BK_F: heads(b, k, ('ERSTER SIEG', ''), GOLD); label(b, k, 'DER LETZTE TREFFER ...', 54, WHITE, LY, 2)
    elif k < TK_F:
        gbanner(b, k - BK_F, BK_M['t'], GOLD); label(b, k - BK_F, 'BEUTE · EI · MODS · GLÜCKSMÜNZEN', 50, WHITE, LY, 4)
        if k - BK_F < 6: flash(b, k - BK_F, .7, 6, (255, 230, 160))
    else:
        t = TK_M['t'].split(':', 1); gbanner(b, k - TK_F, t[1].strip(), GOLD, first=t[0] + ':')
        label(b, k - TK_F, TK_M['s'].upper(), 56, GOLD, LY, 2)
        sparkles(b, W / 2, 1000, k, 4, 16, 380, GOLD)
    if k < BK_F: note(b, 'KAMPF GEKÜRZT', LY + 56)
    return b


# ---------- 3 Artefakte & Begegnungen (228 + 96) ----------
ARW = jload('a_walk/msgs.json')['log']; AR_F = next(i for i, v in enumerate(ARW) if v[0] == 1)
AR2 = jload('a_walk2/msgs.json')['log']; AR2_F = next(i for i, v in enumerate(AR2) if v[0] == 1)
AMAP = info('a_map'); AREAD = info('a_read')


def arte(k):
    if k < 36:
        kk = k
        if kk < 12: b = gp('elwa_walk', 26 + kk, kk, drift=.03)
        else:
            b = bgd('elwa/mis.jpg').copy(); sy = bx('elwa', 'say'); ru = bx('elwa', 'rumor')
            m = ui(b, 'elwa/mis.jpg', (40, sy[1] - 10, 1040, ru[3] + 14), W / 2, 1020, 1.08, kk - 12)
            if kk >= 18: hl(b, *mbox(m, ru), kk, PURPLE)
            if kk == 12: flash(b, 0, .4, 3)
        heads(b, kk, ('ELWA KENNT', 'GERÜCHTE'), TEAL)
        label(b, kk, 'AUSSENPOSTEN: AUFTRÄGE UND SPUREN', 50, '#9ad8ee', LY, 4)
    elif k < 108:
        kk = k - 36
        if kk < 24: b = gp('a_walk', AR_F - 24 + kk, kk, drift=.03); label(b, kk, 'EIN FUND AM WEGESRAND ...', 54, GOLD, LY, 2)
        else:
            j = kk - 24; i = AR_F + j; hd = bx('a_read', 'new'); ap = bx('a_read', 'arp'); box = (40, hd[1] - 12, 1040, ap[3] + 14)
            rel = 'a_walk/%04d.jpg' % min(i, 53); b = bgd('a_read/read.jpg').copy()
            if i <= 53: m = ui(b, rel, box, W / 2, 1010, 1.0, j, src=load(os.path.join(RAW, rel)))
            else: m = ui(b, 'a_read/read.jpg', box, W / 2, 1010, 1.0, 99)
            if j >= 26: hl(b, *mbox(m, bx('a_read', 'hint')), j, GOLD)
            label(b, j, 'JEDER FUND VERRÄT DEN NÄCHSTEN', 52, GOLD, LY + 30, 26) if j >= 26 else label(b, j, AREAD['new'].upper(), 50, WHITE, LY + 30, 2)
            if j == 0: flash(b, 0, .5, 4, (255, 240, 200))
        heads(b, kk, ('ÜBER 5000', 'ARTEFAKTE'), GOLD)
    elif k < 144:
        kk = k - 108; b = bgd('a_map/map.jpg').copy(); cv = bx('a_map', 'cv')
        m = ui(b, 'a_map/map.jpg', cv, W / 2, 1010, .98, kk)
        cx, cy = m(cv[0] + AMAP['hx'] / 240 * (cv[2] - cv[0]), cv[1] + AMAP['hy'] / 240 * (cv[3] - cv[1])); r = AMAP['hr'] / 240 * (cv[2] - cv[0]) * .98 * UIS
        o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); a = int(150 + 100 * math.sin(kk * .5)); rr = r + 10 + 4 * math.sin(kk * .5)
        ImageDraw.Draw(o).ellipse((cx - rr, cy - rr, cx + rr, cy + rr), outline=(255, 224, 138, a), width=8); b.alpha_composite(o)
        heads(b, kk, ('SUCHKREIS', 'AUF DER KARTE'), GOLD, s2=74)
        label(b, kk, 'HIER IRGENDWO LIEGT DAS NÄCHSTE', 52, ICE, LY + 20, 4)
        flash(b, kk, .45, 3)
    elif k < 180:
        kk = k - 144; b = bgd('a_seal/seal.jpg').copy(); bb = bx('a_seal', 'box')
        ui(b, 'a_seal/seal.jpg', (40, bb[1] - 10, 1040, bb[3] + 120), W / 2, 1010, 1.15, kk, frame_col=(255, 90, 70))
        heads(b, kk, ('DER SCHATZ IST', 'VERSIEGELT'), BLOOD, s1=56)
        label(b, kk, 'ERST ALLE TEILE – DANN BRICHT DAS SIEGEL', 46, '#ffb08a', LY + 20, 4)
        flash(b, kk, .45, 3)
    else:
        kk = k - 180
        if kk < 12:
            b = gp('a_walk2', AR2_F - 12 + kk, kk, drift=.03); heads(b, kk, ('ZURÜCK', 'ZUM SCHATZ'), GOLD)
            label(b, kk, 'SPÄTER: ALLE 3 TEILE GEFUNDEN', 52, ICE, LY, 0)
        else:
            j = kk - 12; b = bgd('a_open/open.jpg').copy(); p = bx('a_open', 'panel')
            ui(b, 'a_open/open.jpg', (40, p[1] - 6, 1040, p[1] + 1000), W / 2, 1010, .95, j)
            heads(b, j, ('SCHATZ', 'GEBORGEN!'), GOLD, s2=100)
            label(b, j, 'DER LOHN DER GANZEN GESCHICHTE', 50, GOLD, LY + 40, 4)
            sparkles(b, W / 2, 1000, j, 5, 14, 420, GOLD)
            flash(b, j, .8, 5, (255, 230, 160))
    chapter(b, k, 3); flash(b, k, .7, 3)
    for s0 in (36, 108, 144, 180): flash(b, k - s0, .5, 3)
    return b


ENC = ['sphinx', 'spiegelhexe', 'feenring', 'drache']


def enc(k):
    j, kk = k // 24, k % 24; key = ENC[j]; b = bgd('enc/%s.jpg' % key).copy(); p = bx('enc', key)
    h = min(980, p[3] - p[1] + 12); y0 = p[1] - 6
    ui(b, 'enc/%s.jpg' % key, (40, y0, 1040, y0 + h), W / 2, 1000, min(.98, 940 / h), kk, frame_col=(184, 146, 244))
    heads(b, k, ('35 MYSTISCHE', 'BEGEGNUNGEN'), PURPLE, s2=78)
    label(b, k, 'DU ENTSCHEIDEST, WAS PASSIERT', 54, PURPLE, LY + 30, 6)
    chapter(b, k, 3); flash(b, kk, .45, 3)
    return b


# ---------- 4 Kreaturen (264) ----------
PA = info('p_art')


def petframe(rel, i, n=4):
    im = img(rel); w = im.width // n
    return im.crop((i * w, 0, i * w + w, im.height))


def scaled_im(im, sc): return im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.NEAREST)


PBR = msgs('p_breed')[0]
PFC = [(m['f'], m['t']) for m in msgs('p_fight') if m['k'] == 'c']
SPELLC = []
for want, ln in (('meteor', 24), ('blitz', 24), ('schild', 12)):
    f = next(f for f, t in PFC if t == want); SPELLC.append((max(0, f - 6), max(0, f - 6) + ln, want))
SPN = {'meteor': 'METEOR', 'blitz': 'BLITZ', 'schild': 'SCHILD'}


def creatures(k):
    if k < 60:
        kk = k; b = stage_bg('#3a6a9a', kk, 70)
        for i, p in enumerate(PA['pets']):
            t0 = i // 2
            if kk < t0: continue
            cx = W / 2 - 16 + (i % 10 - 4.5) * 88; cy = 690 + (i // 10) * 96
            im = petframe('p_art/pet_%s.png' % p['sp'], (kk // 5 + i) % 4); sc = min(3.4, 74 / im.height, 84 / im.width)
            if p['hy']: place(b, glow_disc(46, '#ff4fd8', 110), cx, cy)
            place(b, scaled_im(im, sc), cx, cy, POP[kk - t0] ** .5 if kk - t0 < len(POP) else 1)
        heads(b, kk, ('', '77 KREATUREN'), GOLD, s2=84)
        label(b, kk, '16 MISCHFORMEN NUR AUS DER ZUCHT', 50, '#ff9ae8', LY + 30, 20)
    elif k < 120:
        kk = k - 60; b = bgd('p_breed/sel.jpg', .25, 12).copy()
        # Eltern × Eltern → Mischform (Bilder aus dem Spiel)
        parts = []
        for key in ('br_eule', 'br_baer', 'br_eulenbaer'):
            im = petframe('p_art/%s.png' % key, (kk // 5) % 4); parts.append(scaled_im(im, min(6, 150 / im.height, 220 / im.width)))
        xs = [W / 2 - 16 - 300, W / 2 - 16 - 30, W / 2 - 16 + 280]
        place(b, glow_disc(120, '#ff4fd8', 120 if kk >= 30 else 40), xs[2], 700)
        for j, im in enumerate(parts):
            if j == 2 and kk < 30: place(b, text_img('?', 110, '#ff9ae8'), xs[2], 690); continue
            place(b, im, xs[j], 690, POP[kk - 30] ** .5 if j == 2 and kk - 30 < len(POP) else 1)
            place(b, vt(PA[('br_eule', 'br_baer', 'br_eulenbaer')[j]]['n'].upper(), 36, '#ff9ae8' if j == 2 else WHITE), xs[j], 790)
        place(b, text_img('×', 70, WHITE), (xs[0] + xs[1]) / 2, 690); place(b, text_img('=', 70, WHITE), (xs[1] + xs[2]) / 2 + 10, 690)
        if kk >= 30: sparkles(b, xs[2], 690, kk, 8, 10, 120, '#ff9ae8')
        st = 'sel' if kk < 44 else 'done'
        m = ui(b, 'p_breed/%s.jpg' % st, (40, 100, 1040, 660) if st == 'sel' else (40, 250, 1040, 810), W / 2, 1180, .95, kk if kk < 44 else kk - 44)
        if st == 'sel': tapbox(b, mbox(m, bx('p_breed', 'go')), kk - 38)
        else: gtoast(b, kk - 46, PBR['t'], PBR['c'] or TEAL, 1440, 44)
        heads(b, kk, ('ZUCHT', 'MIT GENEN'), '#ff9ae8')
        if kk == 30: flash(b, 0, .5, 4, (255, 200, 240))
    elif k < 168:
        kk = k - 120; b = stage_bg('#7a48c0', kk, 90)
        for j, mu in enumerate(PA['mut']):
            t0 = j * 4
            if kk < t0: continue
            im = petframe('p_art/mut_%s.png' % (mu['mu'] or 'normal'), (kk // 5 + j) % 4); im = scaled_im(im, 6)
            cx = W / 2 - 16 + (j % 3 - 1) * 300 if j < 3 else W / 2 - 16 + (j - 3.5) * 300; cy = 760 if j < 3 else 1150
            if mu['mu']: place(b, glow_disc(120, {'kristall': '#8ee6ff', 'schatten': '#8a48ff', 'gold': '#ffd24a', 'sternen': '#5a6aff'}[mu['mu']], 120), cx, cy)
            place(b, im, cx, cy, POP[kk - t0] ** .5 if kk - t0 < len(POP) else 1)
            place(b, vt(mu['n'].upper(), 36, WHITE if not mu['mu'] else '#ff9ae8'), cx, cy + 92)
        heads(b, kk, ('SELTENE', 'MUTATIONEN'), '#ff9ae8')
        label(b, kk, '10 MUTATIONEN – SICHTBAR AM KÖRPER', 50, '#ff9ae8', LY + 10, 10)
        flash(b, kk, .5, 3)
    elif k < 204:
        kk = k - 168; st = 'eq' if kk < 18 else 'tal'; b = bgd('p_tab/%s.jpg' % st).copy(); ps = bx('p_tab', st + '_psub')
        ui(b, 'p_tab/%s.jpg' % st, (40, ps[3] + 6, 1040, ps[3] + 1000), W / 2, 990, .9, kk if kk < 18 else kk - 18)
        heads(b, kk, ('AUSRÜSTUNG', '& TALENTE'), '#ff9ae8')
        label(b, kk, 'HALSBAND · PANZER · TALISMAN' if kk < 18 else 'DREI ZWEIGE: ANGRIFF · SCHUTZ · SAMMLER', 46, WHITE, LY + 30, 2 if kk < 18 else 18)
        if kk == 18: flash(b, 0, .4, 3)
    else:
        kk = k - 204; i, j, n = segs(kk, [(a, e) for a, e, _ in SPELLC]); b = gp('p_fight', i, j, punch=True, drift=.03)
        heads(b, kk, ('ZAUBER', 'IM KAMPF'), '#ff9ae8', s2=100)
        label(b, j, 'DEIN BEGLEITER ZAUBERT: ' + SPN[SPELLC[n][2]], 50, '#ffd08a', LY, 2)
        flash(b, j, .45, 3)
    chapter(b, k, 4); flash(b, k, .7, 3)
    for s0 in (60, 120, 168): flash(b, k - s0, .5, 3)
    return b


# ---------- 5 Mods (228) ----------
MWB = info('m_wb'); MFG = info('m_forge')
MFL = jload('m_fight/msgs.json')['log']
_kf = [i for i in range(1, len(MFL)) if MFL[i].get('kette', 0) > MFL[i - 1].get('kette', 0)]
_mf = [i for i in range(1, len(MFL)) if MFL[i].get('meteor', 0) > MFL[i - 1].get('meteor', 0)]
MFC = [(_kf[0] - 6, _kf[0] + 18), (_mf[0] - 6, _mf[0] + 30)]
RES_T = next(m['t'] for m in MWB['msg'] if 'Resonanz' in m['t'])


def mods(k):
    if k < 48:
        kk = k; st = 'w0' if kk < 12 else 'w1' if kk < 36 else 'w2'; b = bgd('m_wb/%s.jpg' % st).copy()
        m = ui(b, 'm_wb/%s.jpg' % st, (40, 440, 1040, 1452), W / 2, 990, .9, kk if kk < 12 else 99)
        if st == 'w0': tapbox(b, mbox(m, bx('m_wb', 'pick0')), kk - 7)
        if st == 'w2': tapbox(b, mbox(m, bx('m_wb', 'pick2')), kk - 43)
        if st == 'w1': tapbox(b, mbox(m, bx('m_wb', 'in1')), kk - 31); hl(b, *mbox(m, bx('m_wb', 'cmp1')), kk, MOSS)
        if st == 'w2': hl(b, *mbox(m, bx('m_wb', 'slots2')), kk, PURPLE)
        heads(b, kk, ('MODS FÜR', 'DEINE BEUTE'), PURPLE, s2=84)
        label(b, kk, 'RUNEN · GLYPHEN · ESSENZEN · KERNE · PRÄGUNGEN', 40, WHITE, LY + 40, 4)
        if kk in (12, 36): flash(b, 0, .35, 3)
    elif k < 96:
        kk = k - 48
        if kk < 12:
            b = bgd('m_wb/w3.jpg').copy(); m = ui(b, 'm_wb/w3.jpg', (40, 820, 1040, 1830), W / 2, 990, .9, kk)
            hl(b, *mbox(m, bx('m_wb', 'resn')), kk, GOLD); tapbox(b, mbox(m, bx('m_wb', 'in3')), kk - 7)
            heads(b, kk, ('ESSENZ', 'DAZU ...'), PURPLE)
        elif kk < 36:
            j = kk - 12; b = bgd('m_wb/w4.jpg').copy(); m = ui(b, 'm_wb/w4.jpg', (40, 440, 1040, 1452), W / 2, 990, .9, 99)
            hl(b, *mbox(m, bx('m_wb', 'slots4')), j, GOLD); gtoast(b, j, RES_T, '#ffd24a', 1330)
            heads(b, j, ('RESONANZ', 'ENTDECKT!'), GOLD); sparkles(b, W / 2, 900, j, 6, 14, 420, GOLD)
            if j < 5: flash(b, j, .6, 5, (255, 230, 160))
        else:
            j = kk - 36; b = bgd('m_wb/book.jpg').copy(); bh = bx('m_wb', 'bookhead')
            m = ui(b, 'm_wb/book.jpg', (40, bh[1] - 6, 1040, bh[1] + 760), W / 2, 1010, 1.05, j)
            hl(b, *mbox(m, bx('m_wb', 'res0')), j, GOLD); heads(b, j, ('RESONANZ', 'ENTDECKT!'), GOLD)
        label(b, kk, '36 GEHEIME RESONANZEN', 54, GOLD, LY + 40, 12)
    elif k < 156:
        kk = k - 96; i, j, n = segs(kk, MFC); b = gp('m_fight', i, j, punch=True, drift=.03)
        heads(b, kk, ('GLYPHEN', 'IM KAMPF'), PURPLE, s2=100)
        rec = MFL[min(i, len(MFL) - 1)]; prev = MFL[max(0, min(i, len(MFL) - 1) - 14)]
        txt = 'STERNGLYPHE: METEOR' if n == 1 and rec.get('meteor', 0) > prev.get('meteor', 0) else 'KETTENGLYPHE: KETTENBLITZ'
        label(b, kk, txt, 54, '#ffd08a' if 'METEOR' in txt else '#9ad8ff', LY, 2)
        flash(b, j, .45, 3)
    else:
        kk = k - 156
        if kk < 24:
            st = 'rr0' if kk < 12 else 'rr1'; b = bgd('m_forge/%s.jpg' % st).copy()
            m = ui(b, 'm_forge/%s.jpg' % st, (40, 440, 1040, 1450), W / 2, 990, .9, kk if kk < 12 else 99)
            if st == 'rr0': hl(b, *mbox(m, bx('m_forge', 'rrsel0')), kk, ORANGE)
            heads(b, kk, ('', 'UMSCHMIEDEN'), GOLD, s2=84)
            if kk >= 12: label_ab(b, kk - 12, MFG['a0']['s'], MFG['a1']['s'], 52, MOSS2, LY + 40)
            else: label(b, kk, 'EIN WERT WIRD NEU GEWÜRFELT', 52, WHITE, LY + 40, 0)
        elif kk < 48:
            j = kk - 24; st = 'vd0' if j < 12 else 'vd1'; b = bgd('m_forge/%s.jpg' % st).copy()
            ui(b, 'm_forge/%s.jpg' % st, (40, 600, 1040, 1600), W / 2, 990, .9, j if j < 12 else 99)
            heads(b, j, ('', 'VEREDELN'), GOLD, s2=100)
            if j >= 12: label_ab(b, j - 12, '%s · St. %d' % (MFG['v0']['s'], MFG['v0']['st']), '%s · St. %d' % (MFG['v1']['s'], MFG['v1']['st']), 42, MOSS2, LY + 40)
            else: label(b, j, 'WERT-STUFE +1', 50, WHITE, LY + 40, 0)
        else:
            j = kk - 48; b = bgd('m_forge/ex0.jpg').copy()
            ui(b, 'm_forge/ex0.jpg', (40, 440, 1040, 1450), W / 2, 990, .9, j)
            heads(b, j, ('', 'EXTRAHIEREN'), GOLD, s2=84)
            label(b, j, 'WERT ALS AFFIX-ESSENZ MITNEHMEN', 52, '#9affd8', LY + 40, 2)
        if kk in (12, 36): flash(b, 0, .5, 4, (200, 255, 210))
        for s0 in (24, 48): flash(b, kk - s0, .45, 3)
    chapter(b, k, 5); flash(b, k, .7, 3)
    for s0 in (48, 96, 156): flash(b, k - s0, .5, 3)
    return b


# ---------- Was ist neu (144) ----------
KIND = {'neu': ('NEU', '#79c24e'), 'besser': ('BESSER', '#57c7e6')}
ITEMS = [('neu', 'Die Endlosen Lande: eine feste Welt für alle – 24 h bis zum Rand'), ('neu', '48 Biome, Regionen, Barrieren und Wegwerkzeuge'),
         ('neu', 'Leuchtfeuer: Checkpoint, Startpunkt und Ausgang'), ('neu', '1200 Bosse mit 29 angekündigten Mechaniken'),
         ('neu', 'Über 5000 Artefakte in 830 Geschichten, 35 Begegnungen'), ('neu', '77 Kreaturen: Zucht, Mutationen, Ausrüstung, Zauber'),
         ('neu', 'Mods: Runen, Glyphen, Essenzen, 36 Resonanzen'), ('besser', 'Tag und Nacht statt Zeitdruck')]
BGN = None


def news(k):
    global BGN
    if BGN is None: BGN = darken(load(os.path.join(RAW, 'w_sternenfeld', '0020.jpg')), .25, 12)
    b = BGN.copy()
    title(b, k, 'WAS IST NEU', 76, GOLD, T1 - 40)
    title(b, k, 'VERSION ' + NEWS['version'], 34, WHITE, T1 + 60, 3)
    y = 560
    for i, (kind, text) in enumerate(ITEMS):
        t0 = 6 + i * 8; lines = textwrap.wrap(text, 27)
        if k >= t0:
            tag = badge(KIND[kind][0], 20, bg=hexrgb(KIND[kind][1]))
            place(b, tag, 64 + tag.width / 2, y + 22, pop(k - t0))
            for j, ln in enumerate(lines):
                im = text_img(ln, 56, WHITE, VT, stroke=3, shadow=3, maxw=700)
                place(b, im, 236 + im.width / 2, y + 22 + j * 48, 1.0, min(1, (k - t0 + 1) / 3))
        y += 28 + 48 * len(lines)
    flash(b, k, .6, 3)
    return b


# ---------- Endkarte (120) ----------
END = None


def end(k):
    global END
    if END is None:
        END = EndCard(RAW, [os.path.join(RAW, 'w_' + b_, '%04d.jpg' % 18) for b_ in ('gletscher', 'wueste', 'pilz', 'kristall', 'schattenwald', 'riff', 'sternenfeld', 'traumwiese')],
                      extra=badge('UPDATE 6.1 · DIE ENDLOSEN LANDE', 22), cta=['JETZT KOSTENLOS', 'SPIELEN!'], foot='6 SPRACHEN · HANDY & PC')
    return END(k, 120)


SCENES = [('hook', hook, 96), ('biomes', biomes, 96), ('region', region, 72), ('world', world, 132), ('barrier', barrier, 180),
          ('beacon', beacon, 144), ('night', night, 96), ('exit', exit_, 72), ('kodex', kodex, 72), ('fights', fights, 192),
          ('trophy', trophy, 84), ('arte', arte, 228), ('enc', enc, 96), ('creatures', creatures, 264), ('mods', mods, 228),
          ('news', news, 144), ('end', end, 120)]


def hits():
    st = {}; n = 0
    for name, _, ln in SCENES: st[name] = n; n += ln
    h = [[st['hook'] + f, 'kick'] for f in (12, 36, 60, 84)] + [[st['hook'] + 24 + j * 12, 'whoosh'] for j in range(6)]
    B0 = st['biomes']; h += [[B0 + i * 2, 'tick'] for i in range(0, 12, 2)]
    h += [[st['region'] + RG_F - RG_OFF, 'sparkle']]
    W0 = st['world']; h += [[W0 + 14, 'whoosh'], [W0 + 106, 'impact'], [W0 + 106, 'sparkle']]
    A0 = st['barrier']; h += [[A0 + BA_F - (BA_F - 44), 'clank'], [A0 + 60, 'whoosh']]
    hs, acc = [], 60
    for a, e in HORT: hs.append(acc); acc += e - a
    h += [[A0 + hs[0] + 7, 'tick'], [A0 + hs[1] + 6, 'tick'], [A0 + hs[2] + (HO_F - HORT[2][0]), 'sparkle'], [A0 + hs[4] + (HT_F - HORT[4][0]), 'impact'], [A0 + hs[4] + (HT_F - HORT[4][0]), 'sparkle']]
    h += [[A0 + 132 + 36, 'ting']]
    C0 = st['beacon']; h += [[C0 + 28, 'tick'], [C0 + 36, 'impact'], [C0 + 36, 'sparkle'], [C0 + 102, 'tick'], [C0 + 108, 'ting']]
    h += [[st['night'] + 52, 'roar']]
    X0 = st['exit']; h += [[X0 + 24, 'tick'], [X0 + 36, 'tick'], [X0 + 48, 'impact'], [X0 + 48, 'sparkle']]
    K0 = st['kodex']; h += [[K0 + 6, 'ting'], [K0 + 18, 'tick'], [K0 + 36, 'whoosh']]
    F0 = st['fights']; h += [[F0 + 4, 'roar'], [F0 + 84, 'roar'], [F0 + 84, 'impact']]
    T0 = st['trophy']; h += [[T0 + BK_F, 'impact'], [T0 + TK_F, 'sparkle'], [T0 + TK_F, 'ting']]
    R0 = st['arte']; h += [[R0 + 12, 'whoosh'], [R0 + 60, 'sparkle'], [R0 + 108, 'whoosh'], [R0 + 144, 'clank'], [R0 + 192, 'impact'], [R0 + 192, 'sparkle']]
    E0 = st['enc']; h += [[E0 + j * 24, 'whoosh'] for j in range(1, 4)]
    Q0 = st['creatures']; h += [[Q0 + i * 4, 'tick'] for i in range(0, 10)] + [[Q0 + 90, 'sparkle'], [Q0 + 98, 'tick'], [Q0 + 120, 'whoosh']] + [[Q0 + 120 + j * 4, 'ting'] for j in range(5)] + [[Q0 + 204 + f, 'impact'] for f in (6, 30, 54)]
    M0 = st['mods']; h += [[M0 + 7, 'tick'], [M0 + 31, 'tick'], [M0 + 36, 'clank'], [M0 + 43, 'tick'], [M0 + 48 + 7, 'tick'], [M0 + 48 + 12, 'impact'], [M0 + 48 + 12, 'sparkle']]
    h += [[M0 + 96 + 6, 'impact'], [M0 + 96 + 24 + 6, 'impact'], [M0 + 156 + 12, 'clank'], [M0 + 156 + 36, 'clank'], [M0 + 156 + 48, 'whoosh']]
    S0 = st['news']; h += [[S0 + 6 + i * 8, 'ting'] for i in range(len(ITEMS))]
    h += [[st['end'] + 8 + i * 4, 'ting'] for i in range(4)] + [[st['end'] + 26, 'sparkle']]
    return h


if __name__ == '__main__':
    render(SCENES, OUT, hits(), only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
