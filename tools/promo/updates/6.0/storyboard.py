# Schnitt des ausführlichen Videos zu 6.0 „Die Verlorenen Lande“ (~75 s, 1080×1920, 30 fps).
# Kapitel: Aufhänger (Weltentor) → 1 Verlorene Lande (Risiko, Freiwelt, Truhen, Ungeheuer, Leute, Nacht, Entkommen, Tod)
# → 2 Brutnest → 3 Aussehen & Auren → 4 Basar → 5 Schmiede → Was ist neu → Endkarte.
# Jede Szene ist ein Schnitt mit Becken auf dem Takt; darin Unterschnitte auf Vielfachen von 12 Bildern.
# Alles aus echten Aufnahmen (scenes.js): Freiwelt Bild für Bild, Menü-Standbilder, Grafiken aus dem Spiel.
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.0 python3 storyboard.py [szene …]
import colorsys, json, math, os, random, sys, textwrap
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
from PIL import Image, ImageDraw

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.0')
RAW = os.path.join(OUT, 'raw')
ART = json.load(open(os.path.join(RAW, 'art', 'art.json')))
NEWS = json.load(open(os.path.join(RAW, 'news.json')))
PURPLE, MOSS2, ORANGE, BLOOD = '#d0b0ff', '#8ef0a8', '#ff8a3a', '#ff4a3a'
T1, T2, LY = 400, 510, 1440      # Überschriften (unter der Freiwelt-Anzeige oben rechts, die bis y 350 reicht) und Zeile unten

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


def jload(rel):
    if rel not in _C: _C[rel] = json.load(open(os.path.join(RAW, rel)))
    return _C[rel]


def bx(scene, key, pad=0):
    """Bereich aus raw/<szene>/boxes.json als (x0, y0, x1, y1)"""
    r = jload(scene + '/boxes.json')[key]
    return (r['x'] - pad, r['y'] - pad, r['x'] + r['w'] + pad, r['y'] + r['h'] + pad)


def frame(rel, i, n=4):
    im = img(rel); w = im.width // n
    return im.crop((i * w, 0, i * w + w, im.height))


def scaled(rel, sc):
    key = ('sc', rel, sc)
    if key not in _C: im = img(rel); _C[key] = im.resize((max(1, round(im.width * sc)), max(1, round(im.height * sc))), Image.NEAREST)
    return _C[key]


def hexrgb(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))


def put_bottom(b, im, x, ybot, sc):
    place(b, im, x, ybot - im.height * sc / 2, sc)


UIS, UIDX = .94, 16   # Menü-Ausschnitte etwas kleiner und nach links: rechter Rand bleibt vor den TikTok-Knöpfen


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


def mbox(m, box):
    """Bereich (Standbild-Pixel) über die Umrechnung m in Video-Pixel"""
    x0, y0 = m(box[0], box[1]); x1, y1 = m(box[2], box[3]); return x0, y0, x1, y1


def tap(b, x, y, t):
    """Antipp-Kreis (t = Bilder seit dem Antippen)"""
    if t < 0 or t > 11: return
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    r = 22 + t * 8; a = int(240 * (1 - t / 11))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, a), width=8)
    if t < 5: rr = 30 - t * 3; d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(255, 255, 255, 200 - t * 30))
    b.alpha_composite(o)


def tapbox(b, bb, t):
    tap(b, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, t)


def hl(b, x0, y0, x1, y1, k, col=GOLD):
    """pulsierender Rahmen um einen Knopf oder Bereich"""
    a = int(150 + 100 * math.sin(k * .5)); o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(o)
    c = rgb(col)[:3]
    for i, w in enumerate((14, 7)):
        d.rectangle((x0 - 8 - i * 4, y0 - 8 - i * 4, x1 + 8 + i * 4, y1 + 8 + i * 4), outline=c + (a // (i + 1),), width=w)
    b.alpha_composite(o)


def vt(s, size, fill=WHITE): return text_img(s, size, fill, VT, stroke=4, shadow=4, maxw=900)


def label(b, k, s, size, fill, cy, t0=0, path=VT):
    """kleinere Zeile (VT323) mit kurzem Einblenden"""
    if k < t0: return
    im = vt(s, size, fill) if path == VT else text_img(s, size, fill)
    place(b, im, W / 2 - 10, cy, 1.15 if k - t0 == 0 else 1.05 if k - t0 == 1 else 1, min(1, (k - t0 + 1) / 2))


def heads(b, k, a, bcol, t0=0, s1=64, s2=92, c1=WHITE):
    """zwei Überschriften: kleine weiße Zeile, große farbige Zeile"""
    if a[0]: title(b, k - t0, a[0], s1, c1, T1)
    if a[1]: title(b, k - t0, a[1], s2, bcol, T2, 3 if a[0] else 0)


def row(b, parts, cy, gap=14):
    """Bilder nebeneinander mittig auf einer Zeile"""
    w = sum(p.width for p in parts) + gap * (len(parts) - 1); x = W / 2 - w / 2
    for p in parts: place(b, p, x + p.width / 2, cy); x += p.width + gap


def arrow(w=90, h=44, col=WHITE):
    """Pfeil (die Pixelschriften haben kein →)"""
    im = Image.new('RGBA', (w + 12, h + 12), (0, 0, 0, 0)); d = ImageDraw.Draw(im); c = rgb(col)
    m = h / 2 + 6; t = h * .22; hw = h * .55
    pts = [(6, m - t), (6 + w - hw, m - t), (6 + w - hw, 6), (6 + w, m), (6 + w - hw, 6 + h), (6 + w - hw, m + t), (6, m + t)]
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
    place(b, glow_disc(620, col, glow), W / 2, 980)
    return b


def gp(scene, i, k, punch=True, drift=.04):
    """Freiwelt-Aufnahme wie promolib.gameplay, dazu die Umrechnung Aufnahme → Video (leichter Zoom)"""
    i = max(0, min(i, len(os.listdir(os.path.join(RAW, scene))) - 1))
    while not os.path.exists(os.path.join(RAW, scene, '%04d.jpg' % i)): i -= 1
    b = gameplay(RAW, scene, i, k, punch, drift)
    s = 1 + drift * k / 60 + (.14 * (1 - k / 5) ** 2 if punch and k < 5 else 0)
    return b, (lambda x, y: ((x - W / 2) * s + W / 2, (y - H / 2) * s + H / 2))


def dots(n): return '{:,}'.format(n).replace(',', '.')


CHAP = ['VERLORENE LANDE', 'BRUTNEST', 'AUSSEHEN & AUREN', 'BASAR', 'SCHMIEDE']


def chapter(b, k, n):
    """Kapitel-Etikett oben mit Fortschritt (5 Kapitel); schmal genug für die Freiwelt-Anzeige oben rechts"""
    place(b, badge('%d/5 · %s' % (n, CHAP[n - 1]), 20), W / 2 - 16, 236, pop(k))
    d = ImageDraw.Draw(b)
    for i in range(5):
        x = W / 2 - 16 + (i - 2) * 66
        c = (255, 210, 74, 255) if i == n - 1 else (150, 112, 50, 255) if i < n - 1 else (40, 30, 52, 230)
        d.rectangle((x - 28, 278, x + 28, 287), fill=c, outline=(10, 6, 14, 255), width=2)


# ---------- Aufhänger (96): Brunhild geht durchs Weltentor – Ankunft in der Freiwelt ----------
LOGO = logo()


def hook(k):
    if k < 42:
        b = gameplay(RAW, 'hook_a', k + 6, k, punch=False, drift=.05)
        if k < 3: b = zoom(b, 1.16 - .05 * k)
    elif k < 48:
        j = k - 42; b = zoom(gameplay(RAW, 'hook_a', 47, 41, punch=False, drift=.05), 1 + j * .14, 0, -60 * j / 6)
        b.alpha_composite(Image.new('RGBA', (W, H), (190, 255, 210, int(255 * min(1, (j + 1) / 6)))))
    else:
        b = gameplay(RAW, 'hook_b', k - 48 + 6, k - 48, punch=False, drift=.05)
        flash(b, k - 48, 1, 8, (200, 255, 215))
    place(b, badge('UPDATE 6.0'), W / 2, 236, pop(k))
    place(b, LOGO, W / 2 - 24, 352, .54 * min([1.22, 1.1, 1.03, .99, 1.0][k] if k < 5 else 1, 1))
    title(b, k, 'DIE VERLORENEN', 60, WHITE, 462, 2)
    title(b, k, 'LANDE', 110, GOLD, 566, 4)
    if 6 <= k < 42: label(b, k, 'DURCHS WELTENTOR IM VERSTECK …', 56, MOSS2, LY, 6)
    if k >= 54: label(b, k, '… IN EINE RIESIGE FREIWELT', 56, ICE, LY, 54)
    return b


# ---------- 1 Verlorene Lande ----------
# Was du riskierst (72)
RISK = jload('risk/info.json')


def risk(k):
    b = bgd('risk/top.jpg').copy()
    t = ease(min(1, max(0, (k - 34) / 22))); y0 = round(484 + t * 150)
    m = ui(b, 'risk/top.jpg', (40, y0, 1040, y0 + 830), W / 2, 990, .95, k)
    rk, sv, ru = bx('risk', 'risk'), bx('risk', 'surv'), bx('risk', 'rules')
    if 8 <= k < 34: hl(b, *mbox(m, (56, rk[1] - 4, 1024, sv[1] - 12)), k, RED)
    if k >= 44: hl(b, *mbox(m, (56, sv[1] - 4, 1024, ru[1] - 6)), k, MOSS)
    heads(b, k, ('WAS DU', 'RISKIERST'), GOLD)
    if k < 40: label(b, k, 'DEINE AUSRÜSTUNG: %s GOLD' % dots(RISK['gv']), 56, '#ff9a8a', LY, 6)
    else: label(b, k, 'DEIN BEGLEITER TRÄGT EINE TASCHE', 56, MOSS2, LY, 44)
    chapter(b, k, 1)
    flash(b, k, .7, 3)
    return b


# Freiwelt (168): Lauf durch Schnee und Wald, drei Weltstufen, Karte mit Nebel
BANDS = [('w_run1', 'WILDNIS', '#e8b04a'), ('w_run2', 'ABGRUND', '#ff6a5a'), ('w_run3', 'GRENZLAND', '#79c24e')]


def world(k):
    if k < 60:
        b, _ = gp('w_run1', k, k)
        heads(b, k, ('JEDES MAL', 'NEUE WELT'), GOLD)
        label(b, k, 'DER GOLDENE PFEIL ZEIGT ZUM AUSGANG', 52, GOLD, LY, 10)
    elif k < 108:
        kk = k - 60
        b = bgd('w_run2/0030.jpg', .22, 16).copy()
        for j, (sc, nm, col) in enumerate(BANDS):
            t0 = j * 5
            if kk < t0: continue
            fr = load(os.path.join(RAW, sc, '%04d.jpg' % min(59, 6 + kk)))
            band = fr.crop((40, 990 - 135, 1040, 990 + 135))
            cy = 750 + j * 290; sl = max(0, 5 - (kk - t0)) * (60 if j % 2 else -60)
            sh = Image.new('RGBA', (1020, 290), (0, 0, 0, 0)); ImageDraw.Draw(sh).rectangle((10, 14, 1010, 284), fill=(0, 0, 0, 160))
            place(b, sh.filter(ImageFilter.GaussianBlur(8)), W / 2 - 16 + sl, cy + 6)
            place(b, band, W / 2 - 16 + sl, cy)
            d = ImageDraw.Draw(b); L = W / 2 - 16 + sl - 500
            d.rectangle((L - 4, cy - 139, L + 1003, cy + 138), outline=rgb(col)[:3] + (255,), width=5)
            tag = badge(nm, 22, bg=hexrgb(col)); place(b, tag, L + 16 + tag.width / 2, cy - 100)
        heads(b, kk, ('VON WIESE BIS', 'LAVA'), ORANGE, s2=110)
        flash(b, kk, .5, 3)
    else:
        kk = k - 108
        b = bgd('w_map/map.jpg').copy()
        ui(b, 'w_map/map.jpg', (60, 228, 1020, 1190), W / 2, 985, .87 + kk * .001, kk)
        heads(b, kk, ('KARTE MIT', 'NEBEL'), GOLD, s2=110)
        label(b, kk, 'TRUHEN · LAGER · AUSGÄNGE · BOSSE', 52, ICE, LY, 6)
        flash(b, kk, .5, 3)
    chapter(b, k, 1)
    return b


# Zeitpunkte aus raw/<szene>/log.json (Eintrag i = Stand vor Bild i, also zu sehen in Bild i-1)
def ev_at(scene, pred):
    L = jload(scene + '/log.json')
    return max(0, next(i for i, v in enumerate(L) if pred(v)) - 1)


C_OPEN = ev_at('l_chest', lambda v: v[0] == 1) - 4         # Truhe offen (Teil zeigt Bild kk + 4)
C_ITEM = ev_at('l_chest', lambda v: v[2] > 0) - 4          # Legendär liegt am Boden
C_PACK = max(ev_at('l_chest', lambda v: v[1] > 0) - 4, C_ITEM + 16)   # erstes Teil im Rucksack („LEGENDÄR!“ bleibt mindestens 16 Bilder)
D_OPEN = ev_at('l_dig', lambda v: v[0] == 1)
D_OFF = max(0, min(23, D_OPEN - 38))                       # Schatz öffnet sich bei kk = D_OPEN - D_OFF
R_DEAD = ev_at('n_rival', lambda v: v[0] == 'dead') - 4
DIE = ev_at('d_die', lambda v: v == 'dead') - 4
H_BURST = ev_at('e_hatch', lambda v: v[0] == 1)
H_SHOW = ev_at('e_hatch', lambda v: v[1] == 1)

# Truhen und Beute (192): Goldtruhe → Rucksack, vergrabener Schatz mit Ei, Rucksack und Begleiter-Tasche
PACK = bx('l_chest', 'pack')


def loot(k):
    if k < 84:
        kk = k; b, m = gp('l_chest', kk + 4, kk)
        heads(b, kk, ('ÖFFNE', 'TRUHEN'), GOLD, s2=110)
        if kk < C_ITEM: label(b, kk, 'GOLDTRUHE AM WEGESRAND', 54, GOLD, LY, 4)
        elif kk < C_PACK: label(b, kk, 'LEGENDÄR!', 72, ORANGE, LY, C_ITEM)
        else:
            x0, y0, x1, y1 = mbox(m, PACK); hl(b, x0, y0, x1, y1, kk, MOSS)
            label(b, kk, 'ALLES LANDET IM RUCKSACK', 56, MOSS2, LY, C_PACK)
        if C_ITEM <= kk < C_ITEM + 6: flash(b, kk - C_ITEM, .45, 5, (255, 200, 120))
    elif k < 144:
        kk = k - 84; b, m = gp('l_dig', kk + D_OFF, kk); o = D_OPEN - D_OFF
        heads(b, kk, ('VERGRABENE', 'SCHÄTZE'), GOLD)
        if kk < o: label(b, kk, 'STEHEN BLEIBEN = GRABEN', 56, '#ffe08a', LY, 4)
        else: label(b, kk, 'EIN BEGLEITER-EI!', 72, GOLD, LY, o)
        if o <= kk < o + 6: flash(b, kk - o, .55, 5, (255, 230, 150))
    else:
        kk = k - 144
        if kk < 16:
            b = bgd('l_inv/inv0.jpg').copy(); m = ui(b, 'l_inv/inv0.jpg', (40, 640, 1040, 1450), W / 2, 985, .98, kk)
            tapbox(b, mbox(m, bx('l_inv', 'slot0')), kk - 9)
        elif kk < 36:
            b = bgd('l_inv/inv1.jpg').copy(); m = ui(b, 'l_inv/inv1.jpg', (40, 1100, 1040, 1730), W / 2, 985, 1.0, kk - 16)
            if kk >= 20: hl(b, *mbox(m, bx('l_inv', 'tobag')), kk, MOSS)
            tapbox(b, mbox(m, bx('l_inv', 'tobag')), kk - 31)
        else:
            b = bgd('l_inv/inv2.jpg').copy(); m = ui(b, 'l_inv/inv2.jpg', (40, 640, 1040, 1450), W / 2, 985, .98, kk - 36)
            hl(b, *mbox(m, bx('l_inv', 'bag2')), kk, MOSS)
        heads(b, kk, ('DEIN', 'RUCKSACK'), GOLD, s2=100)
        if kk < 22: label(b, kk, 'GEHT BEIM TOD VERLOREN', 58, '#ff8a7a', LY, 2)
        else: label(b, kk, 'BEGLEITER-TASCHE IST SICHER', 58, MOSS2, LY, 22)
        flash(b, kk, .5, 3)
    chapter(b, k, 1)
    return b


# Ungeheuer (120): Todesritter Varkas erwacht, kurzer Kampf, dann: LAUF!
def boss(k):
    b, _ = gp('b_boss', k, k, drift=.03)
    if k < 46:
        heads(b, k, ('EIN UNGEHEUER', 'ERWACHT'), RED, s1=56)
        label(b, k, 'BOSSE ZIEHEN DURCH DIE LANDE', 56, '#ff9a8a', LY, 8)
    else:
        kk = k - 46; sh = (random.Random(k).randint(-12, 12), random.Random(k + 7).randint(-8, 8)) if kk < 10 else (0, 0)
        im = text_img('LAUF!', 150, RED); place(b, im, W / 2 + sh[0], 470 + sh[1], pop(kk))
        label(b, kk, 'WEGLAUFEN IST ERLAUBT', 60, WHITE, LY, 4)
        flash(b, kk, .55, 4, (255, 80, 60))
    chapter(b, k, 1)
    return b


# Leute (168): Kundschafterin Elwa (Aufträge), Händler Bodo (Tausch), Rivale
def npcs(k):
    if k < 36:
        kk = k; b, _ = gp('n_camp', kk + 4, kk)
        label(b, kk, 'KUNDSCHAFTERIN ELWA', 58, '#57c7e6', LY, 4)
    elif k < 72:
        kk = k - 36; b = bgd('n_mis/mis.jpg').copy()
        ui(b, 'n_mis/mis.jpg', (40, 580, 1040, 1440), W / 2, 985, .92, kk)
        label(b, kk, 'AUFTRÄGE BRINGEN RUF + BEUTE', 56, '#9ad8ee', LY, 4)
    elif k < 108:
        kk = k - 72; b = bgd('n_trade/trade.jpg').copy()
        ui(b, 'n_trade/trade.jpg', (40, 410, 1040, 1300), W / 2, 985, .9, kk)
        label(b, kk, 'BODO TAUSCHT · MIRJA HEILT', 56, MOSS2, LY, 4)
    else:
        kk = k - 108; b, _ = gp('n_rival', kk + 4, kk)
        heads(b, kk, ('RIVALEN WOLLEN', 'DEINE BEUTE'), ORANGE, s1=56)
        if kk < R_DEAD: label(b, kk, 'ULF STURMBART GREIFT AN', 58, ORANGE, LY, 6)
        else: label(b, kk, 'BESIEGT: SEINE BEUTE FÄLLT RAUS', 54, GOLD, LY, R_DEAD)
        if R_DEAD <= kk < R_DEAD + 5: flash(b, kk - R_DEAD, .4, 5)
        chapter(b, k, 1); flash(b, kk, .5, 3)
        return b
    heads(b, k if k < 36 else k - 36 if k < 72 else k - 72, ('HELFER IN', 'DER WILDNIS'), '#57c7e6')
    chapter(b, k, 1)
    if k >= 36: flash(b, (k - 36) % 36, .5, 3)
    return b


# Die Nacht bricht an (108): Zeitraffer – dunkler, Verderbnis wächst, Jäger der Leere
DANGER = (775, 200, 956, 238)   # Uhr und Gefahr in der Freiwelt-Anzeige oben rechts


def night(k):
    b, m = gp('t_night', k, k, drift=.02)
    if k < 52: heads(b, k, ('JE LÄNGER DU', 'BLEIBST …'), GOLD)
    else: heads(b, k - 52, ('DIE NACHT', 'BRICHT AN'), '#c060ff', s2=100)
    if k >= 16: hl(b, *mbox(m, DANGER), k, '#ff8a3a' if k < 88 else '#c060ff')
    if k < 52: label(b, k, 'ZEITRAFFER: DIE GEFAHR STEIGT', 56, '#ffd08a', LY, 6)
    elif k < 86: label(b, k, 'JÄGER DER LEERE KOMMEN', 58, '#ff9a6a', LY, 52)
    else: label(b, k, 'DIE VERDERBNIS WÄCHST', 60, '#d090ff', LY, 86)
    if k == 52: flash(b, 0, .5, 4, (120, 60, 200))
    chapter(b, k, 1)
    return b


# Entkommen (168): im Ausgang stehen bleiben, Zähler, dann die Beuteliste
CH = jload('x_exit/chlog.json')
# Bild i zeigt den Stand, der vor Bild i+1 notiert wurde; letztes Bild vor der Ergebnis-Tafel
CHS = [v[0] for v in CH['log'][1:]]
LAST = max(i for i, v in enumerate(CHS) if v >= 0)


def ch_n(i):
    return max(1, math.ceil(CH['need'] - CHS[i] - 1e-6)) if 0 <= i <= LAST and CHS[i] > 0 else None


XDONE = jload('x_done/info.json')


def extract(k):
    if k < 72:
        kk = k; i = min(kk, LAST); b, _ = gp('x_exit', i, kk, drift=.03)
        heads(b, kk, ('RAUS DURCH', 'DEN AUSGANG'), MOSS2, s2=84)
        n = ch_n(i)
        if n:
            first = next(j for j in range(LAST + 1) if ch_n(j) == n)
            place(b, text_img(str(n), 130, MOSS2), W / 2, 690, pop(i - first))
        label(b, kk, 'HINEINSTELLEN UND WARTEN', 58, MOSS2, LY, 4)
        if kk > LAST: b.alpha_composite(Image.new('RGBA', (W, H), (210, 255, 220, int(255 * min(1, (kk - LAST) / max(1, 71 - LAST))))))
    else:
        kk = k - 72; b = bgd('x_done/done.jpg').copy()
        t = ease(min(1, max(0, (kk - 40) / 40))); y0 = round(24 + t * 480)
        m = ui(b, 'x_done/done.jpg', (40, y0, 1040, y0 + 900), W / 2, 990, .9, kk)
        if 6 <= kk < 40: hl(b, *mbox(m, bx('x_done', 'pill', 4)), kk, GOLD)
        title(b, kk, 'ENTKOMMEN!', 96, MOSS2, T1 + 40)
        kv = XDONE['kv'][0].replace('BEUTEWERT ', '').replace('k GOLD', 'K GOLD')
        label(b, kk, 'BEUTEWERT %s · NEUER BESTWERT' % kv, 54, GOLD, LY, 8)
        flash(b, kk, .8, 5, (210, 255, 220))
    chapter(b, k, 1)
    return b


# Tod (168): Varkas erwischt den Helden – alles weg, nur die Tasche des Begleiters überlebt
def death(k):
    if k < 60:
        kk = k; b, _ = gp('d_die', kk + 4, kk, drift=.03)
        heads(b, kk, ('ABER WER HIER', 'FÄLLT …'), BLOOD, s1=56, s2=100)
        if kk < DIE: label(b, kk, 'MITTEN IM KAMPF MIT VARKAS', 56, '#ff9a8a', LY, 4)
        else: label(b, kk, 'GEFALLEN!', 72, BLOOD, LY, DIE)
        if DIE <= kk < DIE + 6: flash(b, kk - DIE, .7, 6, (255, 40, 30))
    else:
        kk = k - 60; b = bgd('d_screen/screen.jpg').copy()
        m = ui(b, 'd_screen/screen.jpg', (40, 556, 1040, 1250), W / 2, 985, 1.0, kk if kk < 60 else 99, (255, 90, 70))
        if kk < 60:
            hl(b, *mbox(m, bx('d_screen', 'lost', 2)), kk, BLOOD)
            heads(b, kk, ('', 'ALLES WEG …'), BLOOD, s2=100)
            label(b, kk, 'AUSRÜSTUNG UND RUCKSACK', 58, '#ff8a7a', LY - 30, 6)
            label(b, kk, 'SIND VERLOREN', 58, '#ff8a7a', LY + 30, 9)
        else:
            j = kk - 60; s0 = bx('d_screen', 'saved')
            hl(b, *mbox(m, (56, s0[1] - 6, 1024, s0[1] + 168)), j, MOSS)
            heads(b, j, ('NUR DIE TASCHE', 'ÜBERLEBT!'), MOSS2, s1=56)
            label(b, j, 'DEIN BEGLEITER BRINGT SIE HEIM', 56, MOSS2, LY - 30, 4)
            label(b, j, 'DANACH IST ER VERLETZT', 46, '#ffb08a', LY + 32, 12)
            flash(b, j, .45, 4, (160, 255, 180))
        flash(b, kk, .7, 5, (255, 60, 40))
    chapter(b, k, 1)
    return b


# ---------- 2 Brutnest (252): pflegen, schlüpfen, 24 Kreaturen ----------
NBOX = (40, 140, 1040, 1020)


def nest(k):
    if k < 84:
        kk = k; st = 0 if kk < 18 else 1 if kk < 36 else 2 if kk < 54 else 3
        b = bgd('e_nest/n0.jpg').copy()
        m = ui(b, 'e_nest/n%d.jpg' % st, NBOX, W / 2, 985, .9, kk)
        for key, t0 in (('warm', 14), ('feed', 32), ('pet', 50), ('pet', 56), ('pet', 62)): tapbox(b, mbox(m, bx('e_nest', key)), kk - t0)
        if kk >= 70: hl(b, *mbox(m, bx('e_nest', 'card', 2)), kk, '#ff4fd8')
        heads(b, kk, ('BEGLEITER AUS', 'EIERN'), GOLD, s1=56, s2=110)
        label(b, kk, 'WÄRMEN · FÜTTERN · STREICHELN', 56, '#ffb0d0', LY, 4)
    elif k < 192:
        kk = k - 84; shown = kk >= H_SHOW
        b = stage_bg(ORANGE, kk, 110 if kk < H_BURST else 170)
        fr = load(os.path.join(RAW, 'e_hatch', '%04d.jpg' % min(kk, 107)))
        cv = fr.crop(bx('e_hatch', 'cv')); cv = cv.resize((round(cv.width * 1.1), round(cv.height * 1.1)), Image.LANCZOS)
        d = ImageDraw.Draw(b); place(b, cv, W / 2, 900); d.rectangle((W / 2 - cv.width / 2 - 5, 900 - cv.height / 2 - 5, W / 2 + cv.width / 2 + 4, 900 + cv.height / 2 + 4), outline=hexrgb(ORANGE) + (255,), width=5)
        if shown:
            rs = fr.crop(bx('e_hatch', 'res')); rs = rs.resize((round(rs.width * .8), round(rs.height * .8)), Image.LANCZOS)
            place(b, rs, W / 2 - 8, 1360, 1, min(1, (kk - H_SHOW + 1) / 3))
            sparkles(b, W / 2, 880, kk, 9, 16, 420, GOLD)
        if kk < H_BURST: heads(b, kk, ('LEGENDÄRES EI', 'SCHLÜPFT!'), GOLD, s1=56)
        else: title(b, kk, 'LEGENDÄRES EI', 56, WHITE, T1); title(b, kk - H_BURST, 'PHÖNIX!', 92, ORANGE, T2)
        if H_BURST <= kk < H_BURST + 6: flash(b, kk - H_BURST, .9, 6, (255, 240, 200))
        if kk < H_BURST: label(b, kk, 'ES WACKELT UND KNACKT …', 56, '#ffd08a', LY, 6)
    else:
        kk = k - 192; b = stage_bg('#7a48c0', kk, 80)
        # Eier in sieben Seltenheiten
        eggs = [scaled('art/egg_%d_0.png' % t, 4) for t in range(7)]
        for t, e in enumerate(eggs):
            if kk < t * 2: continue
            x = W / 2 - 16 + (t - 3) * 128; s = POP[kk - t * 2] ** .5 if kk - t * 2 < len(POP) else 1
            place(b, glow_disc(70, ART['tiers'][t]['c'], 110), x, 690); place(b, e, x, 690 + math.sin(kk * .3 + t) * 4, s)
        if kk >= 14: row(b, [vt('PLUNDER', 40, ART['tiers'][0]['c']), arrow(70, 32, WHITE), vt('MYTHISCH', 40, ART['tiers'][6]['c'])], 790, 18)
        # 24 Kreaturen (Stufe Erwachsen), nach Seltenheit
        for i, p in enumerate(ART['pets']):
            t0 = 6 + i
            if kk < t0: continue
            cx = W / 2 - 16 + (i % 6 - 2.5) * 154; cy = 896 + (i // 6) * 140
            im = frame('art/pet_%s_3.png' % p['sp'], (kk // 5 + i) % 4); sc = min(3.4, 104 / im.height, 140 / im.width)
            put_bottom(b, im, cx, cy + 40 + (math.sin(kk * .3 + i) * 4 if p['fly'] else 0), sc * (POP[kk - t0] ** .5 if kk - t0 < len(POP) else 1))
            place(b, text_img(p['n'].upper(), 26, ART['tiers'][p['t']]['c'], VT, stroke=3, shadow=3, maxw=146), cx, cy + 60)
        heads(b, kk, ('24 KREATUREN', '7 SELTENHEITEN'), GOLD, s2=60)
        label(b, kk, 'VON FELDMAUS BIS WELTENSCHLANGE', 52, ICE, LY, 20)
        flash(b, kk, .6, 3)
    chapter(b, k, 2)
    flash(b, k, .7, 3)
    return b


# ---------- 3 Aussehen & Auren (192) ----------
SET_A = [('a_krone', 'HEILIGENSCHEIN'), ('a_phoenix', 'FEUERFLÜGEL'), ('a_klinge', 'KETTENBLITZE'), ('a_eisherz', 'FROSTNEBEL')]
SET_B = [('a_zorn', 'LODERNDE FLAMMEN'), ('a_ernter', 'SEELENLICHTER'), ('a_midas', 'GOLDGLANZ'), ('a_lion', 'LÖWENMÄHNE · SET')]


def aura_tile(b, scene, nm, f, cx, cy, k, size=440):
    inf = jload(scene + '/info.json')['pos']; fr = load(os.path.join(RAW, scene, '%04d.jpg' % f))
    c = 480; x, y = inf['x'], inf['y'] - 150
    t = fr.crop((round(x - c / 2), round(y - c / 2), round(x + c / 2), round(y + c / 2))).resize((size, size), Image.LANCZOS)
    s = POP[k] ** .4 if k < len(POP) else 1
    place(b, t, cx, cy, s)
    d = ImageDraw.Draw(b); h = size * s / 2
    d.rectangle((cx - h - 4, cy - h - 4, cx + h + 3, cy + h + 3), outline=(208, 176, 255, 255), width=4)
    place(b, vt(nm, 40, PURPLE), cx, cy + h - 30)


def auras(k):
    if k < 60:
        kk = k; b = stage_bg('#e8b04a', kk, 70)
        A = ART['items']
        for t in range(A['mat']):
            if kk < t: continue
            place(b, scaled('art/item_mat_%d.png' % t, 4), W / 2 - 16 + (t - 3.5) * 116, 730, POP[kk - t] ** .5 if kk - t < len(POP) else 1)
        if kk >= 8: row(b, [vt(ART['mat'][0].upper(), 40, '#c8c4d4'), arrow(70, 32, WHITE), vt(ART['mat'][-1].upper(), 40, '#bfefff')], 860, 18)
        for j, key in enumerate(('rarW', 'rarA', 'rarH')):
            for r in range(7):
                t0 = 10 + j * 4 + r
                if kk < t0: continue
                rel = 'art/item_%s_%d.png' % (key, r)
                if key == 'rarW' and r == 6: rel = 'art/item_mythFr_%d.png' % ((kk // 3) % A['mythFr'])
                im = scaled(rel, 4 if key == 'rarW' else 5)
                x = W / 2 - 16 + (r - 3) * 134; y = 990 + j * 140
                place(b, glow_disc(64, ART['rar'][r]['c'], 90 if r >= 4 else 40), x, y)
                place(b, im, x, y, POP[kk - t0] ** .5 if kk - t0 < len(POP) else 1)
        if kk >= 30: row(b, [vt(ART['rar'][0]['n'].upper(), 40, ART['rar'][0]['c']), arrow(70, 32, WHITE), vt(ART['rar'][6]['n'].upper(), 40, ART['rar'][6]['c'])], 1400, 18)
        heads(b, kk, ('JEDES TEIL', 'SIEHT ANDERS AUS'), GOLD, s2=56)
        flash(b, kk, .5, 3)
    else:
        kk = k - 60; S = SET_A if kk < 66 else SET_B; j = kk if kk < 66 else kk - 66
        b = Image.new('RGBA', (W, H), (14, 10, 22, 255)); place(b, glow_disc(700, '#7a48c0', 90), W / 2, 1040)
        for i, (sc, nm) in enumerate(S):
            if j < i * 3: continue
            f = (j * 2 // 3) % 96; f = f if f < 48 else 95 - f
            aura_tile(b, sc, nm, f, W / 2 - 16 + (-1 if i % 2 == 0 else 1) * 230, 795 + (i // 2) * 450, j - i * 3, 420)
        heads(b, kk, ('LEGENDEN GEBEN', 'DIR EINE AURA'), PURPLE, s1=56, s2=60)
        flash(b, j, .6, 3, (230, 210, 255))
    chapter(b, k, 3)
    flash(b, k, .7, 3)
    return b


# ---------- 4 Basar (168): kaufen, bieten gegen Händler, Marktwert ----------
# Gebots-Ausschnitt: von der gewählten Versteigerung (Zeile) bis zum Bieten-Knopf – je nach Aufnahme an anderer Stelle
_r2, _bb = bx('m_bas', 'row2'), bx('m_bas', 'bidbtn')
BIDBOX = (40, round(_r2[1] - 24), 1040, round(min(_bb[3] + 30, _r2[1] - 24 + 900)))


def basar(k):
    if k < 36:
        kk = k; b = bgd('m_bas/buy.jpg').copy()
        ui(b, 'm_bas/buy.jpg', (40, 140, 1040, 1010), W / 2, 985, .92, kk)
        heads(b, kk, ('DER', 'BASAR'), GOLD, s2=120)
        label(b, kk, 'KAUFEN · VERKAUFEN · BIETEN', 56, ICE, LY, 4)
    elif k < 132:
        kk = k - 36; st = 0 if kk < 24 else 1 if kk < 60 else 2
        b = bgd('m_bas/bid%d.jpg' % st).copy()
        m = ui(b, 'm_bas/bid%d.jpg' % st, BIDBOX, W / 2, 985, 1.0, kk if kk < 24 else kk - 24 if kk < 60 else kk - 60)
        if st == 0: tapbox(b, mbox(m, bx('m_bas', 'bidbtn')), kk - 16)
        if st == 1: hl(b, *mbox(m, bx('m_bas', 'lead')), kk, MOSS)
        if st == 2: hl(b, *mbox(m, bx('m_bas', 'now2', 4)), kk, BLOOD); hl(b, *mbox(m, bx('m_bas', 'row2')), kk, BLOOD)
        heads(b, kk, ('AUKTIONEN', 'MIT BIETERN'), GOLD, s2=84)
        if st == 0: label(b, kk, 'BIETE MIT!', 64, WHITE, LY, 4)
        elif st == 1: label(b, kk - 24, 'DU FÜHRST …', 64, MOSS2, LY, 0)
        else: label(b, kk - 60, 'KASPAR ÜBERBIETET DICH!', 62, '#ff8a7a', LY, 0)
        if kk in (24, 60): flash(b, 0, .4, 3)
    else:
        kk = k - 132; b = bgd('m_bas/sell.jpg').copy()
        m = ui(b, 'm_bas/sell.jpg', (40, 760, 1040, 1700), W / 2, 985, .86, kk)
        if kk >= 6: hl(b, *mbox(m, bx('m_bas', 'mw', 4)), kk, GOLD)
        heads(b, kk, ('JEDES TEIL HAT', 'MARKTWERT'), GOLD, s1=56, s2=88)
        label(b, kk, 'SOFORT AN HEDDA – ODER VERSTEIGERN', 50, ICE, LY, 4)
    chapter(b, k, 4)
    flash(b, k, .7, 3)
    for s0 in (36, 132): flash(b, k - s0, .5, 3)
    return b


# ---------- 5 Schmiede (144): vier Bereiche, Meisterwerk in fünf Schritten ----------
FWB = jload('f_wb/info.json')
FWB_N = ''.join(ch for ch in FWB['n'] if ch.isalnum() or ch in ' -').strip().upper()
STEPS = [('f_wb/s1.jpg', (40, 520, 1040, 1420), 'SCHRITT 1: WAS?'), ('f_wb/s3.jpg', (40, 470, 1040, 1370), 'SCHRITT 3: BAUTEILE'),
         ('f_wb/s4.jpg', (40, 470, 1040, 1370), 'SCHRITT 4: VORSCHAU'), ('f_wb/s5.jpg', (40, 530, 1040, 1430), 'FERTIG: %s · %s' % (FWB_N, FWB['rar'].upper()))]


def forge(k):
    if k < 36:
        kk = k; b = bgd('f_wb/ver.jpg').copy()
        m = ui(b, 'f_wb/ver.jpg', (40, 140, 1040, 1010), W / 2, 985, .92, kk)
        if kk >= 6: hl(b, *mbox(m, bx('f_wb', 'secs')), kk, GOLD)
        heads(b, kk, ('DIE SCHMIEDE', 'AUFGERÄUMT'), GOLD, s2=84)
        label(b, kk, 'VERBESSERN · SCHMIEDEN · ZERLEGEN · WERKSTATT', 40, ICE, LY, 4)
    else:
        kk = k - 36; j = min(3, kk // 24); jj = kk - j * 24
        rel, box, txt = STEPS[j]
        b = bgd(rel).copy(); m = ui(b, rel, box, W / 2, 985, .92, jj)
        if j < 3: hl(b, *mbox(m, bx('f_wb', 'steps')), kk, GOLD)
        if j == 3:
            hl(b, *mbox(m, (56, 650, 1024, 1360)), kk, ORANGE)
            sparkles(b, W / 2, 950, kk, 3, 14, 420, GOLD)
        heads(b, kk, ('MEISTERWERK', 'IN 5 SCHRITTEN'), GOLD, s1=64, s2=64)
        label(b, jj, txt, 52 if j < 3 else 46, GOLD if j == 3 else WHITE, LY, 0)
        flash(b, jj, .45 if j < 3 else .8, 3 if j < 3 else 5)
    chapter(b, k, 5)
    flash(b, k, .7, 3)
    return b


# ---------- Was ist neu (120) ----------
KIND = {'neu': ('NEU', '#79c24e'), 'besser': ('BESSER', '#57c7e6')}
ITEMS = [('neu', 'Die Verlorenen Lande: riesige Freiwelt, jedes Mal neu'), ('neu', 'Tod = Verlust – nur die Tasche des Begleiters überlebt'),
         ('neu', 'Wandernde Bosse, Händler, Aufträge und Rivalen'), ('neu', 'Brutnest: Begleiter schlüpfen aus Eiern – 24 Kreaturen'),
         ('neu', 'Basar: kaufen, verkaufen, Auktionen mit Bietern'), ('neu', 'Neues Aussehen der Beute, Auren für Legenden'), ('besser', 'Schmiede: vier Bereiche, Meisterwerk in 5 Schritten')]
BGN = None


def news(k):
    global BGN
    if BGN is None: BGN = darken(load(os.path.join(RAW, 'w_run1', '0030.jpg')), .25, 12)
    b = BGN.copy()
    title(b, k, 'WAS IST NEU', 76, GOLD, T1 - 40)
    title(b, k, 'VERSION ' + NEWS['version'], 34, WHITE, T1 + 60, 3)
    y = 590
    for i, (kind, text) in enumerate(ITEMS):
        t0 = 6 + i * 8; lines = textwrap.wrap(text, 30)
        if k >= t0:
            tag = badge(KIND[kind][0], 20, bg=hexrgb(KIND[kind][1]))
            place(b, tag, 64 + tag.width / 2, y + 22, pop(k - t0))
            for j, ln in enumerate(lines):
                im = text_img(ln, 50, WHITE, VT, stroke=3, shadow=3, maxw=700)
                place(b, im, 236 + im.width / 2, y + 22 + j * 44, 1.0, min(1, (k - t0 + 1) / 3))
        y += 28 + 44 * len(lines)
    flash(b, k, .6, 3)
    return b


# ---------- Endkarte (120) ----------
END = None


def end(k):
    global END
    if END is None:
        END = EndCard(RAW, [os.path.join(RAW, 'hook_b', '%04d.jpg' % i) for i in range(0, 60, 6)], extra=badge('UPDATE 6.0 · DIE VERLORENEN LANDE', 22),
                      cta=['JETZT KOSTENLOS', 'SPIELEN!'], foot='6 SPRACHEN · HANDY & PC')
    return END(k, 120)


SCENES = [('hook', hook, 96), ('risk', risk, 72), ('world', world, 168), ('loot', loot, 192),
          ('boss', boss, 120), ('npcs', npcs, 168), ('night', night, 108), ('extract', extract, 168), ('death', death, 168),
          ('nest', nest, 252), ('auras', auras, 192), ('basar', basar, 168), ('forge', forge, 144), ('news', news, 120), ('end', end, 120)]


def hits():
    st = {}; n = 0
    for name, _, ln in SCENES: st[name] = n; n += ln
    h = [[st['hook'] + f, 'kick'] for f in (16, 40, 64, 88)] + [[st['hook'] + 42, 'whoosh'], [st['hook'] + 48, 'impact'], [st['hook'] + 48, 'sparkle']]
    R0 = st['risk']; h += [[R0 + 8, 'tick'], [R0 + 44, 'ting']]
    W0 = st['world']; h += [[W0 + 60 + j * 5, 'whoosh'] for j in range(3)] + [[W0 + 108, 'whoosh']]
    L0 = st['loot']; h += [[L0 + C_OPEN, 'clank'], [L0 + C_ITEM, 'sparkle'], [L0 + C_PACK, 'ting'], [L0 + C_PACK + 6, 'ting'], [L0 + C_PACK + 12, 'ting'], [L0 + 84, 'whoosh'], [L0 + 84 + D_OPEN - D_OFF, 'impact'], [L0 + 84 + D_OPEN - D_OFF, 'sparkle'], [L0 + 144, 'whoosh'], [L0 + 161, 'tick'], [L0 + 175, 'tick'], [L0 + 180, 'ting']]
    B0 = st['boss']; h += [[B0 + 4, 'roar'], [B0 + 46, 'impact'], [B0 + 46, 'roar']]
    N0 = st['npcs']; h += [[N0 + 36, 'whoosh'], [N0 + 72, 'whoosh'], [N0 + 108, 'whoosh'], [N0 + 108 + R_DEAD, 'impact']]
    G0 = st['night']; h += [[G0 + 52, 'roar'], [G0 + 86, 'whoosh']]
    X0 = st['extract']; h += [[X0 + i, 'tick'] for i in range(LAST + 1) if ch_n(i) and (i == 0 or ch_n(i - 1) != ch_n(i))]
    h += [[X0 + LAST + 1, 'impact'], [X0 + 72, 'sparkle']]
    D0 = st['death']; h += [[D0 + DIE, 'impact'], [D0 + 60, 'roar'], [D0 + 120, 'sparkle']]
    E0 = st['nest']; h += [[E0 + t, 'tick'] for t in (14, 32, 50, 56, 62)] + [[E0 + 84, 'whoosh']] + [[E0 + 84 + f, 'clank'] for f in (17, 33, 48)] + [[E0 + 84 + H_BURST, 'impact'], [E0 + 84 + H_BURST, 'sparkle'], [E0 + 84 + H_SHOW, 'ting'], [E0 + 192, 'whoosh']]
    A0 = st['auras']; h += [[A0 + 60, 'whoosh'], [A0 + 60, 'sparkle'], [A0 + 126, 'whoosh'], [A0 + 126, 'sparkle']]
    M0 = st['basar']; h += [[M0 + 36, 'whoosh'], [M0 + 52, 'tick'], [M0 + 60, 'ting'], [M0 + 96, 'clank'], [M0 + 132, 'whoosh']]
    F0 = st['forge']; h += [[F0 + 36 + j * 24, 'whoosh'] for j in range(3)] + [[F0 + 108, 'impact'], [F0 + 108, 'sparkle']]
    S0 = st['news']; h += [[S0 + 6 + i * 8, 'ting'] for i in range(len(ITEMS))]
    h += [[st['end'] + 8 + i * 4, 'ting'] for i in range(4)] + [[st['end'] + 26, 'sparkle']]
    return h


if __name__ == '__main__':
    render(SCENES, OUT, hits(), only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
