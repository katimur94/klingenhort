# Schnitt des ausführlichen Videos zu 5.0 „Meisterwerk“ (~67 s, 1080×1920, 30 fps).
# Kapitel: Aufhänger → 1 Begleiter → 2 Elemente → 3 Schmiede der Meister → 4 Meisterschaft → 5 Tauschen → 6 Aussehen → Endkarte.
# Jedes Kapitel ist eine Szene (Schnitt mit Becken auf dem Takt); darin Unterschnitte auf Vielfachen von 12 Bildern.
# Alles aus echten Aufnahmen (scenes.js): Kämpfe, Menü-Standbilder, Grafiken aus dem Spiel (Begleiter, Eier, Bauteile, Elemente).
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-5.0 python3 storyboard.py [szene …]
import colorsys, json, math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
from PIL import Image, ImageDraw

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-5.0')
RAW = os.path.join(OUT, 'raw')
ART = json.load(open(os.path.join(RAW, 'art', 'art.json')))
PURPLE = '#d0b0ff'

# ---------- Hilfen ----------
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
    """abgedunkelter, weicher Hintergrund aus einem Standbild"""
    key = ('bg', rel, f, blur)
    if key not in _C: _C[key] = darken(img(rel), f, blur)
    return _C[key]


def boxes(scene):
    p = os.path.join(RAW, scene, 'boxes.json')
    return json.load(open(p)) if os.path.exists(p) else {}


def frame(rel, i, n=4):
    im = img(rel); w = im.width // n
    return im.crop((i * w, 0, i * w + w, im.height))


def pet(sp, st, k, per=5):
    """Begleiter-Bild (Ruhe-Animation, 4 Bilder) wie im Spiel; st = Stufe 0–5 oder 'shiny'"""
    return frame('art/pet_%s_%s.png' % (sp, st), (k // per) % 4)


def hexrgb(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def hsl(h, s, l): return '#%02x%02x%02x' % tuple(round(v * 255) for v in colorsys.hls_to_rgb((h % 360) / 360, l, s))


def put(b, im, x, y, sc=1.0, alpha=1.0):
    """Pixelgrafik ganzzahlig-scharf vergrößern und mittig setzen"""
    place(b, im, x, y, sc, alpha)


def put_bottom(b, im, x, ybot, sc):
    place(b, im, x, ybot - im.height * sc / 2, sc)


def ui(b, rel, box, cx, cy, sc=1.0, k=99, frame_col=(232, 176, 74)):
    """Ausschnitt eines Menü-Standbilds als Karte (Rahmen, Schatten, kurzes Einschieben). Gibt Umrechnung Bild → Video zurück."""
    x0, y0, x1, y1 = box
    sc = sc * UIS; cx = cx - UIDX
    key = ('ui', rel, box, sc)
    if key not in _C:
        c = img(rel).crop(box)
        if abs(sc - 1) > .001: c = c.resize((round(c.width * sc), round(c.height * sc)), Image.LANCZOS)
        _C[key] = c
    c = _C[key]
    dy = (4 - k) * 26 if 0 <= k < 4 else 0
    a = min(1, (k + 1) / 3) if 0 <= k < 3 else 1
    sh = Image.new('RGBA', (c.width + 40, c.height + 40), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle((20, 26, c.width + 20, c.height + 26), fill=(0, 0, 0, 150))
    place(b, sh.filter(ImageFilter.GaussianBlur(10)), cx, cy + dy + 6, 1, a)
    place(b, c, cx, cy + dy, 1, a)
    d = ImageDraw.Draw(b); L, T = cx - c.width / 2, cy + dy - c.height / 2
    d.rectangle((L - 5, T - 5, L + c.width + 4, T + c.height + 4), outline=frame_col + (255,), width=5)
    return lambda x, y: (cx + (x - (x0 + x1) / 2) * sc, cy + dy + (y - (y0 + y1) / 2) * sc)


UIS, UIDX = .94, 16   # Menü-Ausschnitte etwas kleiner und nach links: rechter Rand bleibt vor den TikTok-Knöpfen


def tap(b, x, y, t):
    """Antipp-Kreis (t = Bilder seit dem Antippen)"""
    if t < 0 or t > 11: return
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    r = 22 + t * 8; a = int(240 * (1 - t / 11))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, a), width=8)
    if t < 5: rr = 30 - t * 3; d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 255, 255, 200 - t * 30))
    b.alpha_composite(o)


def hl(b, x0, y0, x1, y1, k, col=GOLD):
    """pulsierender Rahmen um einen Knopf oder Bereich"""
    a = int(150 + 100 * math.sin(k * .5)); o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    c = rgb(col)[:3]
    for i, w in enumerate((14, 7)):
        d.rectangle((x0 - 8 - i * 4, y0 - 8 - i * 4, x1 + 8 + i * 4, y1 + 8 + i * 4), outline=c + (a // (i + 1),), width=w)
    b.alpha_composite(o)


def vt(s, size, fill=WHITE): return text_img(s, size, fill, VT, stroke=4, shadow=4)


def label(b, k, s, size, fill, cy, t0=0, path=VT):
    """kleinere Zeile (VT323) mit kurzem Einblenden"""
    if k < t0: return
    im = vt(s, size, fill) if path == VT else text_img(s, size, fill)
    place(b, im, W / 2, cy, 1.15 if k - t0 == 0 else 1.05 if k - t0 == 1 else 1, min(1, (k - t0 + 1) / 2))


def row(b, parts, cy, gap=14):
    """Bilder nebeneinander mittig auf einer Zeile"""
    w = sum(p.width for p in parts) + gap * (len(parts) - 1); x = W / 2 - w / 2
    for p in parts: place(b, p, x + p.width / 2, cy); x += p.width + gap


def elicon(el, sc=8):
    key = ('el', el, sc)
    if key not in _C: im = img('art/el_%s.png' % el); _C[key] = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
    return _C[key]


def arrow(w=90, h=44, col=WHITE, both=False):
    """Pfeil (die Pixelschriften haben kein →)"""
    im = Image.new('RGBA', (w + 12, h + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = rgb(col)
    m = h / 2 + 6; t = h * .22; hw = h * .55
    pts = [(6 + (hw if both else 0), m - t), (6 + w - hw, m - t), (6 + w - hw, 6), (6 + w, m), (6 + w - hw, 6 + h), (6 + w - hw, m + t), (6 + (hw if both else 0), m + t)]
    if both: pts += [(6 + hw, 6 + h), (6, m), (6 + hw, 6)]
    d.polygon(pts, fill=c, outline=(10, 6, 14, 255)); d.line(pts + [pts[0]], fill=(10, 6, 14, 255), width=4)
    return im


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
    place(b, glow_disc(620, col, glow), W / 2, 1000)
    return b


CHAP = ['BEGLEITER', 'ELEMENTE', 'SCHMIEDE DER MEISTER', 'MEISTERSCHAFT', 'TAUSCHEN', 'AUSSEHEN']


def chapter(b, k, n):
    """Kapitel-Etikett oben mit Fortschritt (6 Kapitel)"""
    place(b, badge('%d/6 · %s' % (n, CHAP[n - 1]), 26), W / 2, 206, pop(k))
    d = ImageDraw.Draw(b)
    for i in range(6):
        x = W / 2 + (i - 2.5) * 66
        c = (255, 210, 74, 255) if i == n - 1 else (150, 112, 50, 255) if i < n - 1 else (40, 30, 52, 230)
        d.rectangle((x - 28, 254, x + 28, 263), fill=c, outline=(10, 6, 14, 255), width=2)


# Farben der Meisterschafts-Ränge des Feuerballs (wie js/mastery.js: Rang I Grundfarbe, II–V Farbton, VI Gold)
RANKC = ['#ff8a2a', hsl(357, .85, .62), hsl(312, .85, .62), hsl(210, .85, .62), hsl(268, .85, .62), '#ffd24a']

# ---------- Aufhänger (96) ----------
LOGO = logo()


def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.05)
    if k < 3: b = zoom(b, 1.16 - .05 * k)
    place(b, badge('UPDATE 5.0'), W / 2, 206, pop(k))
    s = .8 * min([1.22, 1.1, 1.03, .99, 1.0][k] if k < 5 else 1, 1070 / (LOGO.width * .8))
    place(b, LOGO, W / 2, 330, s)
    title(b, k, 'MEISTERWERK', 84, WHITE, 462, 2)
    if k >= 54: title(b, k, '6 NEUE SYSTEME', 46, ICE, 556, 54)
    if 6 <= k < 48: label(b, k, 'MYTHISCHER GLUTDRACHE', 58, '#ffb03a', 1330, 6)
    if k >= 48: label(b, k, 'FEUERBALL · RANG VI', 58, GOLD, 1330, 48)
    return b


# ---------- 1 Begleiter (480) ----------
def p_start(kk):
    sp = ['drache', 'katze', 'kaefer'][min(2, kk // 24)]
    b = bgd('p_start/drache.jpg').copy()
    B = boxes('p_start'); p = B['panel']; box = (round(p['x']), round(p['y']), round(p['x'] + p['w']), round(p['y'] + p['h']))
    m = ui(b, 'p_start/%s.jpg' % sp, box, W / 2, 1030, 1.0, kk)
    c = B['cards']
    for j, t0 in ((1, 22), (2, 46)):
        x, y = m(c['x'] + c['w'] * (j + .5) / 3, c['y'] + 150); tap(b, x, y, kk - t0)
    title(b, kk, 'DEIN', 64, WHITE, 340)
    title(b, kk, 'BEGLEITER', 96, GOLD, 460, 3)
    return b


STN = [s.upper() for s in ART['stn']]
STLV = [1, 10, 25, 50, 75, 100]
STCOL = [WHITE, '#ffe0b0', '#ffc070', '#ff9a3a', '#ff6a2a', GOLD]


def p_evo(kk):
    sp = 'drache'; col = ART['pets'][sp]['elC']
    b = stage_bg(col, kk, 90 if kk < 60 else 150)
    if kk < 84:
        s = min(5, kk // 12); ks = kk - s * 12 if kk < 72 else kk - 60
        im = pet(sp, s, kk, 4); sc = 13 * (POP[ks] if ks < len(POP) else 1) ** .5
        bob = math.sin(kk * .3) * 10
        d = ImageDraw.Draw(b); w = im.width * 13 * .5
        d.ellipse((W / 2 - w, 1212, W / 2 + w, 1236), fill=(0, 0, 0, 110))
        if s >= 4: place(b, glow_disc(int(im.width * 9), GOLD if s == 5 else col, 120), W / 2, 1030)
        put_bottom(b, im, W / 2, 1190 + bob, sc)
        if s == 5: sparkles(b, W / 2, 1000, kk, 5, 16, 380, GOLD)
        title(b, ks, STN[s], 76, STCOL[s], 1330)
        place(b, vt('LEVEL %d' % STLV[s], 60, ICE), W / 2, 1420)
        for j in range(6):   # Fortschritt: sechs Punkte
            x = W / 2 + (j - 2.5) * 46; c = rgb(STCOL[j] if j <= s else '#3a2e4a')
            ImageDraw.Draw(b).rectangle((x - 14, 1480 - 14, x + 14, 1480 + 14), fill=c, outline=(10, 6, 14, 255), width=3)
        if kk < 72 and ks < 4 and kk: flash(b, ks, .75, 4)
        if kk >= 60: flash(b, kk - 60, .9, 5, (255, 220, 120))
    else:
        j0 = kk - 84; sc = 4.2; ws = [img('art/pet_%s_%d.png' % (sp, s)).width / 4 * sc for s in range(6)]
        tw = sum(ws) + 22 * 5; x = W / 2 - tw / 2
        for s in range(6):
            if j0 >= s * 3:
                im = pet(sp, s, kk + s, 4); put_bottom(b, im, x + ws[s] / 2, 1150 + math.sin(kk * .3 + s) * 5, sc * (1.25 if j0 - s * 3 == 0 else 1))
                place(b, vt(ART['stn'][s], 34, STCOL[s]), x + ws[s] / 2, 1195)
            x += ws[s] + 22
        if j0 >= 18:
            row(b, [text_img('BABY', 52, WHITE), arrow(80, 40, GOLD), text_img('MYTHISCH', 52, GOLD)], 1330, 22)
        flash(b, j0, .6, 3)
    title(b, kk, 'LEVEL 1-100', 84, GOLD, 340)
    title(b, kk, '6 ENTWICKLUNGEN', 50, WHITE, 460, 3)
    return b


SIX = ['drache', 'katze', 'kaefer', 'eule', 'natter', 'funke']


def p_six(kk):
    b = stage_bg('#7a48c0', kk, 80)
    for i, sp in enumerate(SIX):
        t0 = i * 5
        if kk < t0: continue
        P_ = ART['pets'][sp]; x = [210, 540, 870][i % 3]; yb = [1010, 1350][i // 3]
        place(b, glow_disc(170, P_['elC'], 120), x, yb - 80)
        put_bottom(b, pet(sp, 5, kk + i * 2, 5 if P_['fly'] else 6), x, yb + (math.sin(kk * .3 + i) * 6 if P_['fly'] else 0), 6.4 * (POP[kk - t0] ** .5 if kk - t0 < len(POP) else 1))
        place(b, text_img(P_['n'].upper(), 25, P_['elC']), x, yb + 40)
        place(b, badge(P_['elN'].upper(), 20, bg=hexrgb(P_['elC'])), x, yb + 92)
    title(b, kk, '6 ARTEN', 96, GOLD, 340)
    title(b, kk, 'MYTHISCHE FORM', 52, WHITE, 460, 3)
    flash(b, kk, .6, 3)
    return b


def p_fight(kk):
    j, sc = divmod(kk, 48)
    scene, nm, col = [('p_fight1', 'GEISTERKATZE', '#b892f4'), ('p_fight2', 'STURMFUNKE', '#9ad0ff')][j]
    b = gameplay(RAW, scene, sc + 4, sc, drift=.05)
    title(b, kk, 'KÄMPFT MIT DIR', 70, GOLD, 340)
    title(b, sc, nm, 60, col, 460, 2)
    label(b, kk, 'AB LEVEL 50: SPEZIALANGRIFF', 54, ICE, 1420, 10)
    flash(b, sc, .55, 3)
    return b


def p_egg(kk):
    if kk < 18:
        b = bgd('p_tab/eggs.jpg').copy()
        m = ui(b, 'p_tab/eggs.jpg', (40, 640, 1040, 1180), W / 2, 1000, 1.0, kk)
        e = boxes('p_tab')['eggrow']; x, y = m(e['x'] + e['w'] / 2, e['y'] + e['h'] / 2)
        if kk >= 4: hl(b, x - e['w'] / 2, y - e['h'] / 2, x + e['w'] / 2, y + e['h'] / 2, kk)
        tap(b, x, y, kk - 11)
        label(b, kk, 'SCHLÜPFT NACH 150 SIEGEN', 54, ICE, 1420, 2)
    else:
        j = kk - 18; hatched = j >= 30
        b = stage_bg(PINK if hatched else '#8ee6ff', kk, 150 if hatched else 90)
        if not hatched:
            cr = 0 if j < 12 else 1 if j < 24 else 2
            amp = [5, 9, 14][cr]; ang = math.sin(j * (1.1 + cr * .4)) * amp
            sh = (random.Random(j).randint(-10, 10), random.Random(j + 50).randint(-6, 6)) if cr == 2 else (0, 0)
            egg = img('art/egg_eule_%d.png' % cr); egg = egg.resize((egg.width * 15, egg.height * 15), Image.NEAREST).rotate(ang, resample=Image.NEAREST, expand=True)
            d = ImageDraw.Draw(b); d.ellipse((W / 2 - 120, 1110, W / 2 + 120, 1140), fill=(0, 0, 0, 120))
            place(b, egg, W / 2 + sh[0], 980 + sh[1])
            label(b, kk, 'ES WACKELT UND KNACKT!', 56, ICE, 1330, 30)
        else:
            h = j - 30
            place(b, rays(820, PINK, h * .05, 16, 70), W / 2, 980)
            im = pet('eule', 'shiny', kk, 4); put_bottom(b, im, W / 2, 1130 + math.sin(kk * .3) * 8, 16 * (POP[h] if h < len(POP) else 1))
            sparkles(b, W / 2, 960, kk, 9, 18, 360, WHITE)
            title(b, h, 'SCHILLERND!', 72, PINK, 1300)
            label(b, h, 'FROSTEULE · 1 ZU 100', 60, WHITE, 1400, 3)
            flash(b, h, 1, 6, (255, 230, 250))
    title(b, kk, 'NEUE BEGLEITER', 56, WHITE, 340)
    title(b, kk, 'AUS EIERN', 84, GOLD, 460, 3)
    return b


def p_tab(kk):
    b = bgd('p_tab/top.jpg').copy()
    ui(b, 'p_tab/top.jpg', (40, 250, 1040, 1010), W / 2, 1020, 1.0 + kk * .0012, kk)
    title(b, kk, 'PFLEGE IHN', 84, GOLD, 340)
    title(b, kk, 'FÜTTERN · NAME', 52, WHITE, 460, 3)
    return b


def pets(k):
    if k < 72: b = p_start(k)
    elif k < 192: b = p_evo(k - 72)
    elif k < 264: b = p_six(k - 192)
    elif k < 360: b = p_fight(k - 264)
    elif k < 432: b = p_egg(k - 360)
    else: b = p_tab(k - 432)
    chapter(b, k, 1)
    flash(b, k, .7, 3)
    return b


# ---------- 2 Elemente (240) ----------
def el_vs(a, an, b_, bn):
    return [elicon(a), vt(an, 64, ART['el'][a]['c'][2]), vt('GEGEN', 50, WHITE), elicon(b_), vt(bn, 64, ART['el'][b_]['c'][2])]


PAIRS = [('feuer', 'frost'), ('blitz', 'gift'), ('licht', 'schatten')]


def elem(k):
    if k < 84:
        b = gameplay(RAW, 'e_fight1', k, k, drift=.05)
        title(b, k, '6 ELEMENTE', 96, GOLD, 340)
        title(b, k, 'SCHWÄCHE = ×1,5', 52, WHITE, 460, 3)
        if k >= 8: row(b, el_vs('feuer', 'FEUER', 'frost', 'FROST'), 1420, 16)
    elif k < 132:
        kk = k - 84
        b = bgd('e_fight1/0083.jpg', .25, 16).copy()
        for i, (a, c) in enumerate(PAIRS):
            t0 = i * 8
            if kk < t0: continue
            y = 740 + i * 200; s = pop(kk - t0) ** .5
            A_, C_ = ART['el'][a], ART['el'][c]
            parts = [elicon(a, 11), vt(A_['n'].upper(), 84, A_['c'][2]), arrow(120, 56, WHITE, True), vt(C_['n'].upper(), 84, C_['c'][2]), elicon(c, 11)]
            pw = sum(p.width for p in parts) + 18 * 4; x = W / 2 - pw / 2 * s
            for p in parts: place(b, p, x + p.width * s / 2, y, s); x += (p.width + 18) * s
        if kk >= 26:
            label(b, kk, 'GEGENSÄTZE: ×1,5 SCHADEN', 56, GOLD, 1340, 26)
            label(b, kk, 'GLEICHES ELEMENT: ×0,5', 56, '#c8c4d4', 1420, 32)
        title(b, k, '6 ELEMENTE', 96, GOLD, 340)
        title(b, k, 'SCHWÄCHE = ×1,5', 52, WHITE, 460, 3)
        flash(b, kk, .5, 3)
    elif k < 192:
        kk = k - 132
        b = gameplay(RAW, 'e_fight2', kk, kk, drift=.05)
        title(b, kk, 'TRIFF DIE', 64, WHITE, 340)
        title(b, kk, 'SCHWÄCHE!', 96, GOLD, 460, 3)
        if kk >= 6: row(b, el_vs('licht', 'LICHT', 'schatten', 'SCHATTEN'), 1420, 16)
        flash(b, kk, .6, 3)
    else:
        kk = k - 192
        b = bgd('e_best/best.jpg').copy()
        ui(b, 'e_best/best.jpg', (40, 150, 1040, 1080), W / 2, 1020, .95 + kk * .001, kk)
        title(b, kk, 'BESTIARIUM', 84, GOLD, 340)
        title(b, kk, 'KENN DEN FEIND', 52, WHITE, 460, 3)
        flash(b, kk, .5, 3)
    chapter(b, k, 2)
    flash(b, k, .7, 3)
    return b


# ---------- 3 Schmiede der Meister (360) ----------
GRADES = ART['grade']


def part_icon(name, sc):
    key = ('part', name, sc)
    if key not in _C: im = img('art/part_%s.png' % name); _C[key] = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
    return _C[key]


ITEM = json.load(open(os.path.join(RAW, 'f_mw', 'item.json')))
ITEM_N = ''.join(ch for ch in ITEM['n'] if ch.isalnum() or ch in ' -').strip().upper()


def forge(k):
    if k < 72:
        kk = k
        b = bgd('f_parts/list.jpg').copy()
        ui(b, 'f_parts/list.jpg', (40, 290, 1040, 1010), W / 2, 905, 1.0, kk)
        if kk >= 10:
            label(b, kk, 'ROH BIS GÖTTLICH', 54, ICE, 1300, 10)
            for g in range(10):
                t0 = 12 + g * 2
                if kk < t0: continue
                x = W / 2 + (g - 4.5) * 88; s = POP[kk - t0] ** .6 if kk - t0 < len(POP) else 1
                place(b, part_icon('klinge%d' % (g + 1), 4), x, 1380, s)
                place(b, text_img(GRADES[g]['r'], 16, GRADES[g]['c'], stroke=3, shadow=3), x, 1442)
        title(b, kk, 'BAUTEILE', 96, GOLD, 340)
        title(b, kk, 'STUFE 1-10', 56, WHITE, 460, 3)
    elif k < 144:
        kk = k - 72
        merged = kk >= 32
        b = bgd('f_parts/combined.jpg', .26).copy()
        if not merged:
            p = ease(min(1, max(0, (kk - 16) / 14)))
            col4 = GRADES[3]['c']; place(b, glow_disc(340, col4, 70 + int(p * 90)), W / 2, 950)
            for i in range(3):
                x0 = [260, 540, 820][i]; x = x0 + (W / 2 - x0) * p
                sh = (random.Random(kk * 3 + i).randint(-7, 7), random.Random(kk * 5 + i).randint(-7, 7)) if kk >= 22 else (0, 0)
                place(b, part_icon('klinge4', 10), x + sh[0], 950 + sh[1] + math.sin(kk * .4 + i * 2) * 10 * (1 - p))
            label(b, kk, '3× KLINGE (FEIN)', 60, col4, 1200, 2)
        else:
            h = kk - 32; col5 = GRADES[4]['c']
            place(b, rays(700, col5, h * .05, 16, 60), W / 2, 950)
            place(b, glow_disc(380, col5, 190), W / 2, 950)
            place(b, part_icon('klinge5', 14), W / 2, 950 + math.sin(h * .3) * 8, POP[h] if h < len(POP) else 1)
            title(b, h, 'KLINGE (EDEL)', 56, col5, 1200)
            label(b, h, 'SCHADEN +30 %', 56, WHITE, 1290, 3)
            flash(b, h, 1, 5)
        title(b, kk, 'KOMBINIEREN', 80, GOLD, 340)
        title(b, kk, 'AUS 3 MACH 1', 56, WHITE, 460, 3)
    elif k < 288:
        kk = k - 144
        if kk < 48:
            b = bgd('f_mw/picks.jpg').copy()
            t = ease(min(1, kk / 36)); y0 = round(140 + t * 330)
            m = ui(b, 'f_mw/picks.jpg', (40, y0, 1040, y0 + 880), W / 2, 1012, 1.0, kk)
            mk = boxes('f_mw')['make']; x0, y0_ = m(mk['x'], mk['y']); x1, y1 = m(mk['x'] + mk['w'], mk['y'] + mk['h'])
            if kk >= 34: hl(b, x0, y0_, x1, y1, kk)
            tap(b, (x0 + x1) / 2, (y0_ + y1) / 2, kk - 42)
        elif kk < 96:
            h = kk - 48; col = ITEM['c']
            b = stage_bg(col, kk, 150)
            place(b, rays(820, col, h * .04, 16, 64), W / 2, 960)
            ic = img('f_mw/item.png'); sc = 300 / max(ic.width, ic.height)
            place(b, ic, W / 2, 960 + math.sin(h * .25) * 10, sc * (POP[h] if h < len(POP) else 1))
            sparkles(b, W / 2, 960, h, 3, 14, 330, GOLD)
            title(b, h, ITEM_N, 64, col, 1230)
            label(b, h, '%s · %s' % (ITEM['rar'].upper(), ITEM['mat'].upper()), 56, WHITE, 1320, 3)
            label(b, h, 'KLINGE IX · GRIFF VI · FEUERKERN V', 46, GOLD, 1400, 6)
            flash(b, h, 1, 6, (255, 220, 160))
        else:
            h = kk - 96
            b = bgd('f_mw/done.jpg').copy()
            ui(b, 'f_mw/done.jpg', (40, 730, 1040, 1450), W / 2, 1020, 1.0 + h * .0015, h)
            flash(b, h, .5, 3)
        title(b, kk, 'DEIN', 64, WHITE, 340)
        title(b, kk, 'MEISTERWERK', 84, GOLD, 460, 3)
    else:
        kk = k - 288
        if kk < 24: rel, box, cy = 'f_salv/sel.jpg', (40, 990, 1040, 1460), 1010
        elif kk < 42: rel, box, cy = 'f_salv/ask.jpg', (40, 990, 1040, 1460), 1010
        else: rel, box, cy = 'f_salv/done.jpg', (40, 640, 1040, 1240), 1010
        b = bgd(rel).copy()
        m = ui(b, rel, box, W / 2, cy, 1.0, kk if kk < 24 else kk - 42 if kk >= 42 else 99)
        if kk < 42:
            x, y = m(916, 1298); tap(b, x, y, kk - (14 if kk < 24 else 32))
        else:
            L = boxes('f_salv')['last']; x0, y0 = m(L['x'], L['y']); x1, y1 = m(L['x'] + L['w'], L['y'] + L['h']); hl(b, x0, y0, x1, y1, kk)
            label(b, kk, 'BAUTEILE UND MATERIAL ZURÜCK', 52, ICE, 1420, 46)
        title(b, kk, 'ZERLEGEN', 84, GOLD, 340)
        title(b, kk, '= NEUE BAUTEILE', 48, WHITE, 460, 3)
    chapter(b, k, 3)
    flash(b, k, .7, 3)
    return b


# ---------- 4 Meisterschaft (336) ----------
RANKS = [('m_r1', 'RANG I', 'LEHRLING · STUFE 1', 0), ('m_r3', 'RANG III', 'EXPERTE · STUFE 20', 2), ('m_r6', 'RANG VI', 'LEGENDE · STUFE 50', 5)]


def mast(k):
    if k < 180:
        j, kk = divmod(k, 60)
        scene, rn, sub, r = RANKS[j]
        b = gameplay(RAW, scene, kk, kk, drift=.04)
        title(b, k, 'FÄHIGKEITEN', 72, WHITE, 340)
        title(b, k, 'WACHSEN MIT', 72, GOLD, 460, 3)
        label(b, kk, 'FEUERBALL', 52, WHITE, 1250, 1)
        title(b, kk, rn, 84, RANKC[r], 1335)
        label(b, kk, sub, 56, RANKC[r], 1425, 2)
        if j: flash(b, kk, .35, 4, hexrgb(RANKC[r]))
    elif k < 264:
        kk = k - 180
        b = gameplay(RAW, 'm_ult', kk, kk, drift=.05)
        title(b, kk, 'ULTIMATIVE', 84, GOLD, 340)
        title(b, kk, 'IN GOLD', 64, WHITE, 460, 3)
        label(b, kk, 'METEORHAGEL · RANG VI', 58, GOLD, 1420, 6)
    else:
        kk = k - 264
        b = bgd('m_tal/tal.jpg').copy()
        ui(b, 'm_tal/tal.jpg', (40, 300, 1040, 940), W / 2, 1000, 1.0 + kk * .0015, kk)
        title(b, kk, '6 RÄNGE', 96, GOLD, 340)
        title(b, kk, 'BIS STUFE 50', 56, WHITE, 460, 3)
        label(b, kk, 'JEDER RANG: NEUE FARBE + EXTRA', 50, ICE, 1420, 8)
        flash(b, kk, .5, 3)
    chapter(b, k, 4)
    flash(b, k, .7, 3)
    return b


# ---------- 5 Tauschen (240) ----------
def trade(k):
    if k < 48:
        kk = k
        b = bgd('t_send/bag.jpg').copy()
        m = ui(b, 't_send/bag.jpg', (40, 880, 1040, 1640), W / 2, 1015, 1.0, kk)
        B = boxes('t_send')['btn']; x0, y0 = m(B['x'], B['y']); x1, y1 = m(B['x'] + B['w'], B['y'] + B['h'])
        if kk >= 10: hl(b, x0, y0, x1, y1, kk)
        tap(b, (x0 + x1) / 2, (y0 + y1) / 2, kk - 36)
        t1, t2 = ('SCHENK DEINEN', 'FREUNDEN WAS'), 0
    elif k < 72:
        kk = k - 48
        b = bgd('t_send/ask.jpg').copy()
        m = ui(b, 't_send/ask.jpg', (40, 490, 1040, 1420), W / 2, 1020, .95, kk)
        x, y = m(540, 1206); tap(b, x, y, kk - 15)
        t1, t2 = ('SCHENK DEINEN', 'FREUNDEN WAS'), 0
    elif k < 108:
        kk = k - 72
        b = bgd('t_send/code.jpg').copy()
        ui(b, 't_send/code.jpg', (40, 560, 1040, 1165), W / 2, 970, 1.0, kk)
        label(b, kk, 'LINK PER WHATSAPP & CO.', 56, ICE, 1400, 4)
        t1, t2 = ('SCHENK DEINEN', 'FREUNDEN WAS'), 0
    elif k < 180:
        kk = k - 108
        if kk < 36:
            b = bgd('t_recv/preview.jpg').copy()
            m = ui(b, 't_recv/preview.jpg', (40, 470, 1040, 1440), W / 2, 1035, .93, kk)
            x, y = m(540, 1333); tap(b, x, y, kk - 26)
        else:
            b = bgd('t_recv/done.jpg').copy()
            ui(b, 't_recv/done.jpg', (40, 620, 1040, 1300), W / 2, 990, 1.0, kk - 36)
            sparkles(b, W / 2, 900, kk, 4, 10, 420, GOLD)
            label(b, kk - 36, 'JEDER CODE GILT EINMAL', 54, ICE, 1420, 6)
        t1, t2 = ('DEIN FREUND', 'NIMMT ES AN'), 108
    else:
        kk = k - 180
        b = bgd('t_deal/deal.jpg').copy()
        ui(b, 't_deal/deal.jpg', (40, 560, 1040, 1430), W / 2, 1020, 1.0 + kk * .001, kk)
        t1, t2 = ('HÄNDLERIN', '3 ANGEBOTE/TAG'), 180
    kt = k - t2
    if t1[0] == 'HÄNDLERIN':
        title(b, kt, t1[0], 84, GOLD, 340); title(b, kt, t1[1], 52, WHITE, 460, 3)
    else:
        title(b, kt, t1[0], 64, WHITE, 340); title(b, kt, t1[1], 72, GOLD, 460, 3)
    for s0 in (48, 72, 108, 144, 180): flash(b, k - s0, .45, 3)
    chapter(b, k, 5)
    flash(b, k, .7, 3)
    return b


# ---------- 6 Aussehen (144) ----------
LOOKS = json.load(open(os.path.join(RAW, 'look', 'info.json')))


def look(k):
    if k < 24:
        b = bgd('look/l0.jpg').copy()
        ui(b, 'look/l0.jpg', (40, 140, 1040, 1580), W / 2, 1000, .6, k)
    else:
        i = min(4, (k - 24) // 24 + 1); kk = (k - 24) % 24 if k < 120 else k - 96
        b = bgd('look/l%d.jpg' % i, .28).copy()
        place(b, glow_disc(360, '#7a48c0', 170), W / 2, 820)
        hero = frame('look/hero%d.png' % i, (k // 5) % 4)
        d = ImageDraw.Draw(b); d.ellipse((W / 2 - 150, 990, W / 2 + 150, 1030), fill=(0, 0, 0, 120))
        put_bottom(b, hero, W / 2, 1012, 8.4 * (POP[kk] ** .4 if kk < len(POP) else 1))
        title(b, kk, LOOKS[i]['name'].upper(), 36, PURPLE, 1080)
        ui(b, 'look/l%d.jpg' % i, (40, 290, 1040, 590), W / 2, 1290, 1.0, 99, (208, 176, 255))
        flash(b, kk, .7, 4, (230, 210, 255))
    title(b, k, 'DEIN STYLE', 88, GOLD, 340)
    title(b, k, '234 LOOKS', 56, WHITE, 460, 3)
    chapter(b, k, 6)
    flash(b, k, .7, 3)
    return b


# ---------- Endkarte (120) ----------
END = None


def end(k):
    global END
    if END is None:
        END = EndCard(RAW, [os.path.join(RAW, 'hook', '%04d.jpg' % i) for i in range(0, 96, 8)], extra=badge('UPDATE 5.0 · MEISTERWERK', 26),
                      cta=['JETZT KOSTENLOS', 'SPIELEN!'], foot='6 SPRACHEN · HANDY & PC')
    return END(k, 120)


SCENES = [('hook', hook, 96), ('pets', pets, 480), ('elem', elem, 240), ('forge', forge, 360), ('mast', mast, 336),
          ('trade', trade, 240), ('look', look, 144), ('end', end, 120)]


def hits():
    st = {}; n = 0
    for name, _, ln in SCENES: st[name] = n; n += ln
    h = [[st['hook'] + f, 'kick'] for f in (16, 40, 64, 88)]
    P0 = st['pets']
    h += [[P0 + 22, 'tick'], [P0 + 46, 'tick'], [P0 + 72, 'whoosh']]
    h += [[P0 + 72 + s * 12, 'ting'] for s in range(1, 6)] + [[P0 + 132, 'sparkle'], [P0 + 156, 'whoosh']]
    h += [[P0 + 192 + i * 5, 'tick'] for i in range(6)] + [[P0 + 264, 'whoosh'], [P0 + 312, 'whoosh']]
    h += [[P0 + 371, 'tick'], [P0 + 378, 'whoosh'], [P0 + 390, 'clank'], [P0 + 402, 'clank'], [P0 + 408, 'impact'], [P0 + 408, 'sparkle'], [P0 + 432, 'whoosh']]
    E0 = st['elem']
    h += [[E0 + 84, 'whoosh']] + [[E0 + 84 + i * 8, 'ting'] for i in range(3)] + [[E0 + 132, 'whoosh'], [E0 + 192, 'whoosh']]
    F0 = st['forge']
    h += [[F0 + 12 + g * 2, 'tick'] for g in range(0, 10, 2)] + [[F0 + 72, 'whoosh'], [F0 + 72 + 22, 'clank'], [F0 + 72 + 28, 'clank'], [F0 + 104, 'impact'], [F0 + 104, 'sparkle']]
    h += [[F0 + 144, 'whoosh'], [F0 + 186, 'tick'], [F0 + 192, 'impact'], [F0 + 192, 'sparkle'], [F0 + 240, 'whoosh'], [F0 + 288, 'whoosh'], [F0 + 302, 'tick'], [F0 + 320, 'tick'], [F0 + 330, 'clank']]
    M0 = st['mast']
    h += [[M0 + 60, 'whoosh'], [M0 + 60, 'ting'], [M0 + 120, 'whoosh'], [M0 + 120, 'sparkle'], [M0 + 180, 'whoosh'], [M0 + 190, 'roar'], [M0 + 264, 'whoosh']]
    T0 = st['trade']
    h += [[T0 + 36, 'tick'], [T0 + 48, 'whoosh'], [T0 + 63, 'tick'], [T0 + 72, 'sparkle'], [T0 + 108, 'whoosh'], [T0 + 134, 'tick'], [T0 + 144, 'sparkle'], [T0 + 180, 'whoosh']]
    L0 = st['look']
    h += [[L0 + 24 * i, 'ting'] for i in range(1, 5)]
    h += [[st['end'] + 8 + i * 4, 'ting'] for i in range(4)] + [[st['end'] + 26, 'sparkle']]
    return h


if __name__ == '__main__':
    render(SCENES, OUT, hits(), only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
