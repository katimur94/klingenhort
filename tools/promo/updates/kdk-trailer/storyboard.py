# Schnitt des Trailers „Krieg der Kronen“ (1080×1920, 30 fps, 40,8 s) – episch statt Meme: keine Reaktions-Texte, Schnitte auf dem Takt.
# 1 Kaltstart (4 s): Schwarz → Magiehagel schlägt ein → „DER THRON IST ZERBROCHEN“
# 2 Der Krieg (16 s, echte Aufnahmen): Zwei Heere · Pfeilhagel · Katapulte · Magiehagel · Deckung · Kriegsmaschine erobert · Duell · Seite wählen
# 3 Fünf Kronen (8 s): je Reich ein Banner mit dem echten Wappen und den Farben aus REICHE; drei Reiche als Schattenriss mit „BALD“
# 4 Vorgeschmack (8 s): Kapitel 2–5 und der Splitterthron als Textkarten über abgedunkelten echten Aufnahmen – kein erfundenes Gameplay
# 5 Endkarte (4,8 s)
# Musik: tools/promo/music.py im Stil „krieg“ (timeline.json: style, sections).
# Aufruf: PROMO_OUT=/tmp/klingenhort-kdk-trailer python3 storyboard.py [szene …]
import json, math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-kdk-trailer')
RAW = os.path.join(OUT, 'raw')
RD = json.load(open(os.path.join(RAW, 'wappen', 'reiche.json')))
REICH = {r['k']: r for r in RD['reiche']}
ORDER = ['aurelien', 'karth', 'nordmark', 'sylvara', 'konzil']     # erst die zwei Reiche an der Front, dann die drei kommenden
ASH, EMBER = '#c9c2d6', '#ff8a3a'
SAFE = 840          # Textbreite: rechts ab x 960 liegen die TikTok-Knöpfe
CX = 520            # Mitte für Text und Karten (leicht nach links, weg von den Knöpfen)
_C = {}


def memo(key, fn):
    if key not in _C: _C[key] = fn()
    return _C[key]


def raw(scene, i):
    """Aufnahme, etwas aufgehellt (die Schlachtfelder sind im Spiel dunkel, auf dem Handy-Video säuft das ab)"""
    im = load(os.path.join(RAW, scene, '%04d.jpg' % int(i))).convert('RGB')
    im = ImageEnhance.Brightness(im).enhance(1.32); im = ImageEnhance.Contrast(im).enhance(1.08); im = ImageEnhance.Color(im).enhance(1.12)
    return im.convert('RGBA')


def crop(im, s, cx, cy):
    """Ausschnitt um (cx, cy) im Bild, s-fach vergrößert (scharfe Pixel)"""
    w, h = W / s, H / s; x = min(max(cx - w / 2, 0), W - w); y = min(max(cy - h / 2, 0), H - h)
    return im.crop((int(x), int(y), int(x + w), int(y + h))).resize((W, H), Image.NEAREST)


def vignette():
    def mk():
        v = Image.new('L', (W // 8, H // 8), 0); d = ImageDraw.Draw(v)
        d.ellipse((-30, -20, W // 8 + 30, H // 8 + 20), fill=255)
        v = v.filter(ImageFilter.GaussianBlur(26)).resize((W, H))
        a = v.point(lambda p: int((255 - p) * .78))
        g = Image.new('L', (1, H), 0)
        for y in range(H): g.putpixel((0, y), int(150 * max(0, 1 - y / 520) ** 1.5 + 170 * max(0, (y - 1500) / 420) ** 1.3))
        a = ImageChops.lighter(a, g.resize((W, H)))
        o = Image.new('RGBA', (W, H), (8, 4, 10, 255)); o.putalpha(a); return o
    return memo('vig', mk)


def caption(b, k, s, cy, size=96, fill=WHITE, t0=0, cx=CX):
    if k < t0: return
    size = min(size, int(SAFE / max(1, len(s))))
    im = text_img(s, size, fill, PS, maxw=SAFE)
    place(b, im, cx, cy, pop(k - t0))


def small(b, k, s, cy, size=52, fill=ASH, t0=0, cx=CX, a=1.0):
    if k < t0: return
    place(b, text_img(s, size, fill, VT, stroke=4, shadow=3, maxw=SAFE), cx, cy, 1, min(1, (k - t0 + 1) / 4) * a, smooth=True)


def rule(b, k, cy, t0=0, col=GOLD, w=520):
    """goldene Linie, die sich von der Mitte aus öffnet"""
    if k < t0: return
    ww = int(w * min(1, (k - t0 + 1) / 6)); d = ImageDraw.Draw(b)
    d.rectangle((CX - ww // 2, cy - 3, CX + ww // 2, cy + 3), fill=(10, 6, 14, 255)); d.rectangle((CX - ww // 2 + 2, cy - 1, CX + ww // 2 - 2, cy + 1), fill=rgb(col))


def shake(k, n=8, amp=18):
    if k >= n: return 0, 0
    a = amp * (1 - k / n); return random.randint(-int(a), int(a)), random.randint(-int(a), int(a))


def shot(scene, i, k, s=1.2, cx=540, cy=960, punch=.12, drift=.03, sh=(0, 0)):
    """Spielszene: Ausschnitt mit Ruck beim Schnitt und ganz leichtem Vorwärts-Zoom"""
    z = s + drift * k / 60 + (punch * (1 - k / 5) ** 2 if k < 5 else 0)
    b = crop(raw(scene, i), z, cx + sh[0], cy + sh[1])
    b.alpha_composite(vignette())
    return b


def hud(b, scene, i, k):
    """Schlacht-Anzeige des Spiels (Ziel, Moral) aus der Aufnahme groß und scharf über den Ausschnitt legen"""
    im = load(os.path.join(RAW, scene, '%04d.jpg' % int(i))).crop((300, 130, 820, 226))
    im = ImageEnhance.Brightness(im).enhance(1.15).resize((780, 144), Image.NEAREST)
    box = Image.new('RGBA', (796, 160), (10, 6, 14, 255)); box.alpha_composite(im, (8, 8))
    ImageDraw.Draw(box).rectangle((0, 0, 795, 159), outline=(232, 176, 74, 255), width=3)
    place(b, box, CX, 208, 1, min(1, (k + 1) / 4))


# ---------- 1 Kaltstart ----------
def offen(k):
    if k < 24:
        b = Image.new('RGBA', (W, H), (4, 2, 6, 255))
        small(b, k, 'EIN THRON.', 860, 120, WHITE, 1)
        small(b, k, 'EINE KRONE.', 990, 120, WHITE, 10)
        if k >= 19: b.alpha_composite(Image.new('RGBA', (W, H), (255, 140, 60, int(60 * (k - 18)))))
        return b
    kk = k - 24
    i = 36 + kk if kk < 36 else min(119, 72 + (kk - 36) * .55)        # ab dem Titel Zeitlupe
    hit = min((kk - t for t in (0, 9, 18, 27) if kk >= t), default=99)   # Bilder seit dem letzten Meteor
    b = shot('offen', i, kk, 1.28, 560, 1030, punch=.25, drift=.05, sh=shake(hit, 7, 22))
    flash(b, kk, .95, 6, (255, 220, 170))
    for t in (9, 18, 27): flash(b, kk - t, .4, 4, (255, 170, 90))
    if kk >= 34: b.alpha_composite(Image.new('RGBA', (W, H), (8, 2, 4, min(120, (kk - 34) * 14))))
    if kk >= 36:
        t = kk - 36; sx, sy = shake(t, 6, 14)
        place(b, glow_disc(520, '#ff5a2a', 110), CX, 470)
        caption(b, kk, 'DER THRON', 400 + sy, 104, GOLD, 36, CX + sx)
        caption(b, kk, 'IST ZERBROCHEN', 540, 96, WHITE, 42)
        rule(b, kk, 640, 48, EMBER, 700)
        small(b, kk, 'Fünf Kronen. Ein Krieg ohne Ende.', 710, 56, ASH, 54)
        flash(b, t, .7, 5, (255, 230, 200))
    return b


# ---------- 2 Der Krieg ----------
def heere(k):
    i = 20 + k
    b = shot('heere', i, k, 1.16, 540, 800, drift=.05)
    hud(b, 'heere', i, k)
    caption(b, k, 'ZWEI HEERE', 400, 96, GOLD, 2)
    small(b, k, 'Aurelien gegen Karth – sie kämpfen wirklich', 500, 50, WHITE, 14)
    flash(b, k, .8, 5)
    return b


def pfeil(k):
    i = 2 + k
    hit = k - 39
    b = shot('pfeil', i, k, 1.3, 560, 1010, sh=shake(hit, 5, 10) if hit >= 0 else (0, 0))
    caption(b, k, 'PFEILHAGEL', 380, 96, WHITE, 2)
    if k < 38: small(b, k, 'Schatten am Boden = raus da!', 478, 54, GOLD, 12)
    flash(b, k, .7, 4); flash(b, hit, .35, 3, (255, 240, 200))
    return b


def katapult(k):
    i = 16 + k
    hit = k - 35
    b = shot('katapult', i, k, 1.26, 600, 990, sh=shake(hit, 8, 26) if hit >= 0 else (0, 0))
    caption(b, k, 'KATAPULTE', 380, 100, EMBER, 2)
    flash(b, k, .7, 4); flash(b, hit, .8, 6, (255, 225, 180))
    return b


def magie(k):
    i = 8 + k
    hit = min((k - t for t in (28, 37, 46, 55) if k >= t), default=99)
    b = shot('magie', i, k, 1.3, 550, 990, sh=shake(hit, 6, 18))
    caption(b, k, 'MAGIEHAGEL', 380, 96, '#ff6a4a', 2)
    if k >= 30: small(b, k, 'Der Boden brennt weiter', 478, 54, GOLD, 30)
    flash(b, k, .7, 4)
    for t in (28, 37, 46, 55): flash(b, k - t, .45, 4, (255, 170, 90))
    return b


def deckung(k):
    i = k
    hit = k - 39
    b = shot('deckung', i, k, 1.42, 600, 930, drift=.06, sh=shake(hit, 4, 8) if hit >= 0 else (0, 0))
    caption(b, k, 'GEH IN', 360, 92, WHITE, 2)
    caption(b, k, 'DECKUNG', 470, 110, ICE, 6)
    if k >= 40: small(b, k, 'Hinter dem Schildwall trifft dich kein Pfeil', 1330, 50, ICE, 40)
    flash(b, k, .7, 4)
    return b


def maschine(k):
    i = 22 + k if k < 12 else 110 + (k - 12)
    b = shot('maschine', i, k if k < 12 else k - 12, 1.3, 520, 990, punch=.1)
    flip = k - 45
    hud(b, 'maschine', i, k)
    caption(b, k, 'KRIEGSMASCHINE', 1180, 60, WHITE, 2)
    if flip >= 0:
        place(b, glow_disc(420, '#ffd24a', 90), CX, 1300)
        caption(b, k, 'EROBERT!', 1300, 110, GOLD, 45)
        flash(b, flip, .75, 5, (255, 235, 170))
    flash(b, k, .7, 4); flash(b, k - 12, .5, 3)
    return b


def duell(k):
    i = 4 + k
    hit = k - 36
    b = shot('duell', i, k, 1.15, 540, 1090, sh=shake(hit, 7, 20) if hit >= 0 else (0, 0))
    hud(b, 'duell', i, k)
    caption(b, k, 'DAS DUELL', 356, 92, '#ff6a4a', 2)
    flash(b, k, .7, 4); flash(b, hit, .6, 5, (255, 170, 90))
    return b


def wahl(k):
    def mk():
        im = load(os.path.join(RAW, 'wahl.png')).crop((20, 388, 1060, 1532))
        return im.resize((int(im.width * .86), int(im.height * .86)), Image.LANCZOS)
    card = memo('wahl', mk)
    bg = memo('wahlbg', lambda: darken(raw('heere', 60), .34, 12))
    b = bg.copy(); b.alpha_composite(vignette())
    caption(b, k, 'WÄHLE DEINE', 300, 76, WHITE, 2)
    caption(b, k, 'SEITE', 410, 120, GOLD, 6)
    yy = 1010 + max(0, 5 - k) ** 2 * 8
    place(b, card, CX, yy, 1, min(1, (k + 1) / 4), smooth=True)
    # die beiden Angebote abwechselnd hervorheben (Rahmen in der Farbe des Reichs)
    x0, y0 = CX - card.width / 2, yy - card.height / 2
    boxes = json.load(open(os.path.join(RAW, 'wahl.json')))
    if k >= 14:
        j = (k - 14) // 12 % 2; bx = boxes[j]; col = rgb(REICH[('aurelien', 'karth')[j]]['c'])
        r = [x0 + (bx[0] * 2 - 20) * .86 - 6, y0 + (bx[1] * 2 - 388) * .86 - 6, x0 + ((bx[0] + bx[2]) * 2 - 20) * .86 + 6, y0 + ((bx[1] + bx[3]) * 2 - 388) * .86 + 6]
        d = ImageDraw.Draw(b); d.rectangle(r, outline=(10, 6, 14, 255), width=14); d.rectangle(r, outline=col, width=8)
    flash(b, k, .7, 4)
    return b


# ---------- 3 Fünf Kronen ----------
def wappen(k, sc, sil=False):
    def mk():
        im = load(os.path.join(RAW, 'wappen', k + '.png'))
        if sil:   # Schattenriss: Form bleibt, Farbe fast weg, heller Rand in der Farbe des Reichs
            c = rgb(REICH[k]['c']); dk = rgb(REICH[k]['dk'])
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    r, g, bb, a = px[x, y]
                    if a: l = (r * 3 + g * 6 + bb) / 2550; px[x, y] = (int(14 + dk[0] * .30 * l), int(12 + dk[1] * .30 * l), int(20 + dk[2] * .30 * l), 255)
        im = im.resize((16 * sc, 16 * sc), Image.NEAREST)
        # Rand
        m = im.getchannel('A'); o = Image.new('RGBA', (im.width + 4 * sc // 2, im.height + 4 * sc // 2), (0, 0, 0, 0)); off = sc
        edge = rgb(REICH[k]['c']) if sil else (10, 6, 14, 255)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, 1), (-1, 1), (1, -1)): o.paste(Image.new('RGBA', im.size, edge[:3] + (255,)), (off + dx * sc // 2, off + dy * sc // 2), m)
        o.alpha_composite(im, (off, off)); return o
    return memo(('wp', k, sc, sil), mk)


def krone(col, sc=8):
    """kleine Pixel-Krone als Schmuck über dem Namen (eigene Zeichnung)"""
    def mk():
        P = ['1...1...1', '11.111.11', '111111111', '122121221', '111111111']
        im = Image.new('RGBA', (9, 5), (0, 0, 0, 0)); c = rgb(col)
        for y, row in enumerate(P):
            for x, ch in enumerate(row):
                if ch == '1': im.putpixel((x, y), c)
                elif ch == '2': im.putpixel((x, y), (255, 255, 255, 255))
        im = im.resize((9 * sc, 5 * sc), Image.NEAREST)
        o = Image.new('RGBA', (im.width + 12, im.height + 12), (0, 0, 0, 0)); m = im.getchannel('A')
        for dx in (0, 6, 12):
            for dy in (0, 6, 12): o.paste(Image.new('RGBA', im.size, (10, 6, 14, 255)), (dx, dy), m)
        o.alpha_composite(im, (6, 6)); return o
    return memo(('kr', col, sc), mk)


def fahne(R, bald):
    """Banner in den Farben des Reichs (wie die Fahnen im Spiel: Tuch c2, Streifen c, Rand dk), unten gezackt"""
    def mk():
        w, h = 600, 760; c, c2, dk = rgb(R['c']), rgb(R['c2']), rgb(R['dk'])
        if bald: c2 = tuple(int(v * .22 + 10) for v in c2[:3]) + (255,); c = tuple(int(v * .45) for v in c[:3]) + (255,); dk = tuple(int(v * .5) for v in dk[:3]) + (255,)
        elif sum(c2[:3]) < 200: c2 = tuple(min(255, v + 26) for v in c2[:3]) + (255,)
        im = Image.new('RGBA', (w + 40, h + 60), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        pts = [(20, 30), (w + 20, 30), (w + 20, h - 90), (20 + w * 3 // 4, h), (20 + w // 2, h - 90), (20 + w // 4, h), (20, h - 90)]
        d.polygon([(x + 14, y + 16) for x, y in pts], fill=(0, 0, 0, 150))
        d.polygon(pts, fill=c2); d.rectangle((20, 30, w + 20, 96), fill=c); d.rectangle((20, 96, w + 20, 108), fill=dk)
        d.rectangle((60, 130, 72, h - 130), fill=dk[:3] + (120,)); d.rectangle((w - 32, 130, w - 20, h - 130), fill=dk[:3] + (120,))
        d.line(pts + [pts[0]], fill=(10, 6, 14, 255), width=10)
        d.rectangle((0, 8, w + 40, 34), fill=(58, 44, 30, 255), outline=(10, 6, 14, 255), width=6)     # Stange
        for x in (0, w + 16): d.rectangle((x, 0, x + 24, 42), fill=(232, 176, 74, 255), outline=(10, 6, 14, 255), width=5)
        return im
    return memo(('fahne', R['k'], bald), mk)


def einheit(k, j, sc=8):
    def mk():
        e = REICH[k]['einh'][j]; st = load(os.path.join(RAW, 'wappen', '%s_e%d.png' % (k, j)))
        return [st.crop((f * e['fw'], 0, (f + 1) * e['fw'], e['fh'])).resize((e['fw'] * sc, e['fh'] * sc), Image.NEAREST) for f in range(4)]
    return memo(('einh', k, j, sc), mk)


KBG = {'aurelien': ('deckung', 44), 'karth': ('duell', 44), 'nordmark': ('katapult', 70), 'sylvara': ('pfeil', 50), 'konzil': ('maschine', 30)}


def kronen(n):
    key = ORDER[n]; R = REICH[key]; bald = not R['aktiv']; col = R['c']

    def bgmk():
        im = darken(raw(*KBG[key]), .3, 14); t = Image.new('RGBA', (W, H), rgb(R['dk'] if not bald else '#1a1626')[:3] + (120 if not bald else 150,))
        im.alpha_composite(t); im.alpha_composite(vignette()); return im

    def fn(k):
        b = memo(('kbg', key), bgmk).copy()
        # Kopfzeile: Zähler
        small(b, 9, 'FÜNF KRONEN', 190, 64, WHITE)
        for j in range(5):
            c = rgb(REICH[ORDER[j]]['c']); x = CX + (j - 2) * 64; d = ImageDraw.Draw(b)
            d.rectangle((x - 22, 240, x + 22, 262), fill=(10, 6, 14, 255)); d.rectangle((x - 17, 245, x + 17, 257), fill=c if j <= n else (60, 54, 70, 255))
        place(b, rays(620, col, k * .02, 14, 26 if not bald else 12), CX, 720)
        place(b, glow_disc(520, col, 120 if not bald else 60), CX, 700)
        fy = 690 - max(0, 5 - k) ** 2 * 26 + (10 if k == 6 else 0)
        f = fahne(R, bald); place(b, f, CX, fy)
        if k >= 4:
            wy = fy + 10 + math.sin(k * .16) * 4
            place(b, wappen(key, 26, bald), CX, wy, pop(k - 4))
        if k >= 8:
            place(b, krone(col if not bald else R['dk'], 7), CX, 1118, pop(k - 8))
            caption(b, k, R['n'].upper().replace('DAS ', ''), 1210, 92, col, 8)
            small(b, k, R['krone'].upper(), 1296, 58, WHITE if not bald else ASH, 11)
        if bald:
            if k >= 14:
                st = memo('bald', lambda: badge('BALD', 72, (30, 24, 44), (255, 246, 224))).rotate(-8, resample=Image.BICUBIC, expand=True)
                place(b, st, CX + 150, fy + 190, pop(k - 14), smooth=True)
            st = R['stil'].split(', '); z = [st[0] + ','] + [', '.join(st[1:])] if len(st) > 1 else st
            for j, t in enumerate(z): small(b, k, t, 1384 + j * 58, 54, ASH, 18 + j * 3)
        else:
            if k >= 14: place(b, memo('spielbar', lambda: badge('JETZT SPIELBAR', 34)), CX, 1390, pop(k - 14))
            m = len(R['einh'])
            for j in range(m):
                t0 = 16 + j * 2
                if k < t0: continue
                fr = einheit(key, j)[(k // 5 + j) % 4]; x = CX + (j - (m - 1) / 2) * 150; side = -1 if j < m / 2 else 1
                x = CX + side * (210 + (abs(j - (m - 1) / 2) - .5) * 120)
                if side > 0: fr = fr.transpose(Image.FLIP_LEFT_RIGHT)
                place(b, fr, x, 990 - fr.height / 2 + 60 - max(0, 3 - (k - t0)) * 14)
        flash(b, k, .85, 5, rgb(col)[:3])
        return b
    return fn


# ---------- 4 Vorgeschmack ----------
KAPITEL = [  # (Nummer, Titelzeilen, Unterzeilen, Farbe, Hintergrund)
    (2, ['FÜNF KRONEN'], ['Alle fünf Reiche ziehen in den Krieg', 'Kriegsruf, Ränge, Seite wechseln'], GOLD, ('heere', 40)),
    (3, ['DIE', 'KRIEGSKARTE'], ['60 Provinzen – die Fronten wandern,', 'auch wenn du schläfst'], '#6aa0d8', ('offen', 100)),
    (4, ['BELAGERUNG'], ['Burgen in drei Phasen:', 'Mauer, Hof, Thronsaal'], EMBER, ('katapult', 56)),
    (5, ['VERRAT'], ['Das Schattenkonzil greift ein –', 'deine Entscheidungen haben Folgen'], '#a070f0', ('duell', 20)),
    (7, ['…UND DER', 'SPLITTERTHRON'], ['Das Finale der Chronik'], GOLD, ('magie', 80)),
]


def spur(b, k, akt):
    """Kapitel-Leiste 1–7: 1 ist da, das gezeigte leuchtet"""
    d = ImageDraw.Draw(b); y = 1380
    for j in range(1, 8):
        x = CX + (j - 4) * 104; on = j == akt; done = j == 1
        d.rectangle((x - 40, y - 40, x + 40, y + 40), fill=(10, 6, 14, 255))
        d.rectangle((x - 34, y - 34, x + 34, y + 34), fill=(232, 176, 74, 255) if done else (255, 246, 224, 255) if on and (k // 6) % 2 == 0 else (120, 100, 150, 255) if on else (44, 38, 56, 255))
        f = font(PS, 30); s = str(j); bb = f.getbbox(s)
        d.text((x - (bb[2] - bb[0]) / 2 - bb[0], y - (bb[3] - bb[1]) / 2 - bb[1]), s, font=f, fill=(17, 14, 23, 255) if done or on else (130, 120, 150, 255))
    small(b, 9, 'KAPITEL 1 IST DA', 1470, 52, GOLD, cx=CX)


def bald(n):
    nr, lines, sub, col, bgs = KAPITEL[n]

    def bgmk():
        im = darken(raw(*bgs), .46, 5); im = ImageEnhance.Color(im.convert('RGB')).enhance(.7).convert('RGBA')
        im.alpha_composite(Image.new('RGBA', (W, H), rgb(col)[:3] + (34,))); im.alpha_composite(vignette()); return im

    def fn(k):
        b = crop(memo(('bbg', n), bgmk), 1.04 + k * .0012, 540, 960)
        place(b, memo('vor', lambda: badge('VORGESCHMACK', 40, (30, 24, 44), (255, 246, 224))), CX, 250)
        small(b, 9, 'KOMMT BALD', 336, 60, GOLD)
        place(b, glow_disc(520, col, 70), CX, 800)
        last = n == len(KAPITEL) - 1
        if not last: caption(b, k, 'KAPITEL %d' % nr, 590, 56, col, 2)
        rule(b, k, 650, 4, col, 620)
        y = 770 if len(lines) == 1 else 730
        for j, s in enumerate(lines): caption(b, k, s, y + j * 124, 100 if not last or j else 76, WHITE if not last or j == 0 else GOLD, 5 + j * 4)
        y += len(lines) * 124 + 10
        for j, s in enumerate(sub): small(b, k, s, y + j * 62, 54, ASH, 14 + j * 4)
        if n == 0 and k >= 18:
            for j, kk in enumerate(ORDER): place(b, wappen(kk, 8, not REICH[kk]['aktiv']), CX + (j - 2) * 150, 1180, pop(k - 18 - j))
        if n == 3 and k >= 18: place(b, wappen('konzil', 13, True), CX, 1170, pop(k - 18))
        if n == 1 and k >= 18: place(b, memo('ban', lambda: load(os.path.join(RAW, 'wappen', 'banner.png')).resize((208, 208), Image.NEAREST)), CX, 1222, pop(k - 18))
        if n == 2 and k >= 18:
            for j, kk in enumerate(('aurelien', 'karth')): place(b, memo(('ms', kk), lambda: load(os.path.join(RAW, 'wappen', kk + '_masch.png')).resize((224, 196), Image.NEAREST)), CX + (j * 2 - 1) * 150, 1218, pop(k - 18 - j * 3))
        if last:
            if k >= 16:
                for j, kk in enumerate(ORDER): place(b, wappen(kk, 8), CX + (j - 2) * 150, 1150 - (2 - abs(j - 2)) * 14, pop(k - 16 - j * 2))
            if k >= 26: place(b, memo('woche', lambda: badge('JEDE WOCHE EIN KAPITEL', 34)), CX, 1280, pop(k - 26))
        spur(b, k, nr)
        flash(b, k, .7, 4)
        return b
    return fn


# ---------- 5 Endkarte ----------
def ende(k, total=144):
    bgs = memo('endbg', lambda: [darken(raw('offen', f), .3, 14) for f in (70, 80, 90, 100)])
    b = bgs[(k // 6) % 4].copy(); b.alpha_composite(vignette())
    place(b, rays(700, '#e8b04a', k * .012, 16, 22), CX, 700)
    place(b, glow_disc(560, '#e8b04a', 100), CX, 760)
    lg = memo('logo', logo); sx, sy = shake(k, 6, 12)
    place(b, lg, CX + sx, 400 + sy, min(pop(k), 1) * 880 / lg.width if k < 3 else 880 / lg.width * (1 + .012 * math.sin(k * .2)), smooth=True)
    rule(b, k, 500, 6, GOLD, 760)
    caption(b, k, 'KRIEG DER KRONEN', 580, 54, '#ff6a4a', 8)
    for j, kk in enumerate(ORDER):
        if k >= 14 + j * 3: place(b, wappen(kk, 9, not REICH[kk]['aktiv']), CX + (j - 2) * 166, 780 - max(0, 3 - (k - 14 - j * 3)) * 20)
    if k >= 30: place(b, text_img('KAPITEL 1', 64, WHITE), CX, 990, pop(k - 30))
    if k >= 34: place(b, text_img('JETZT SPIELEN', 62, GOLD), CX, 1080, pop(k - 34) * (1 + .04 * math.sin((k - 34) * .3)))
    if k >= 40:
        kk = k - 40; box = Image.new('RGBA', (860, 104), (16, 10, 24, 235))
        ImageDraw.Draw(box).rectangle((0, 0, 859, 103), outline=(255, 210, 74, 255), width=6)
        place(b, box, CX, 1230, pop(kk))
        if kk >= 2: place(b, text_img(URL, 60, WHITE, VT, stroke=3, shadow=3, maxw=800), CX, 1227)
    if k >= 46: caption(b, k, 'GRATIS · HANDY & PC', 1350, 40, ICE, 46)
    if k >= 52: small(b, k, 'Im Browser, ohne Download', 1420, 46, ASH, 52)
    flash(b, k, 1, 6); fade_out(b, k, total, 14)
    return b


SCENES = [('offen', offen, 120),
          ('heere', heere, 60), ('pfeil', pfeil, 60), ('katapult', katapult, 48), ('magie', magie, 60), ('deckung', deckung, 72), ('maschine', maschine, 60), ('duell', duell, 60), ('wahl', wahl, 60)]
SCENES += [('krone%d' % n, kronen(n), 48) for n in range(5)]
SCENES += [('bald%d' % n, bald(n), 48) for n in range(5)]
SCENES += [('end', ende, 144)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[24, 'meteor'], [33, 'meteor'], [42, 'meteor'], [51, 'meteor'], [60, 'bumm'],
        [S0['pfeil'] + 39, 'pfeile'], [S0['katapult'] + 35, 'bumm'], [S0['katapult'] + 35, 'impact'],
        [S0['magie'] + 28, 'meteor'], [S0['magie'] + 37, 'meteor'], [S0['magie'] + 46, 'meteor'], [S0['magie'] + 55, 'meteor'],
        [S0['deckung'] + 39, 'pfeile'], [S0['deckung'] + 40, 'clank'], [S0['maschine'] + 45, 'horn'], [S0['maschine'] + 45, 'sparkle'],
        [S0['duell'] + 6, 'roar'], [S0['duell'] + 36, 'meteor'], [S0['wahl'], 'horn']]
HITS += [[S0['krone%d' % n], 'pauke'] for n in range(5)] + [[S0['krone%d' % n] + 14, 'thud'] for n in range(2, 5)]
HITS += [[S0['bald%d' % n], 'pauke'] for n in range(5)]

if __name__ == '__main__':
    random.seed(66)
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    # Musik im Kriegs-Stil: Abschnitte für music.py
    tl = json.load(open(os.path.join(OUT, 'timeline.json')))
    tl['style'] = 'krieg'; tl['sections'] = {'krieg': S0['heere'], 'kronen': S0['krone0'], 'bald': S0['bald0'], 'end': S0['end'], 'titel': 60}
    json.dump(tl, open(os.path.join(OUT, 'timeline.json'), 'w'))
    print('Übersicht:', contact_sheet(OUT, every=12, cols=10, w=150))
