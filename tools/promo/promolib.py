# Bausteine für TikTok-Clips (1080x1920, 30 fps): Texte, Effekte, Endkarte, Bilder rendern.
# Eine Storyboard-Datei definiert Szenen als (funktion(k) -> Bild, Anzahl Bilder) und ruft render() auf.
import json, math, os, random, base64, io
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
BEAT = 12  # Bilder pro Schlag bei 150 BPM – Schnitte auf Vielfache davon legen
GOLD, PINK, RED, WHITE, ICE, MOSS = '#ffd24a', '#ff4fd8', '#ff5a3a', '#fff6e0', '#bfefff', '#79c24e'
FONTS = os.environ.get('PROMO_FONTS', os.path.join(HERE, 'fonts'))
PS = os.path.join(FONTS, 'PressStart2P.ttf')   # Pixel-Überschriften
VT = os.path.join(FONTS, 'VT323.ttf')          # Fließtext und Adresse
URL = 'katimur94.github.io/klingenhort'
# Sichere Zone für TikTok: Überschriften bei y 300–560, unten ab ~1500 liegt die Beschreibung, rechts ab ~960 die Knöpfe
random.seed(7)
_fc, _tc = {}, {}


def font(path, size):
    k = (path, size)
    if k not in _fc: _fc[k] = ImageFont.truetype(path, size)
    return _fc[k]


def text_img(s, size, fill=WHITE, path=PS, stroke=None, shadow=None, maxw=1000):
    """Text mit dickem schwarzem Rand und Schlagschatten; wird verkleinert, bis er in maxw passt"""
    k = (s, size, fill, path, stroke, shadow, maxw)
    if k in _tc: return _tc[k]
    while True:
        f = font(path, size); bb = f.getbbox(s)
        if bb[2] - bb[0] <= maxw or size < 16: break
        size = int(size * .92)
    st = stroke if stroke is not None else max(4, size // 9)
    sh = shadow if shadow is not None else max(5, size // 8)
    im = Image.new('RGBA', (bb[2] - bb[0] + st * 2 + sh + 4, bb[3] - bb[1] + st * 2 + sh + 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(im); x, y = st + 2 - bb[0], st + 2 - bb[1]
    d.text((x + sh, y + sh), s, font=f, fill=(40, 6, 12, 255), stroke_width=st, stroke_fill=(40, 6, 12, 255))
    d.text((x, y), s, font=f, fill=fill, stroke_width=st, stroke_fill=(10, 6, 14, 255))
    _tc[k] = im
    return im


def place(base, im, cx, cy, sc=1.0, alpha=1.0, smooth=False):
    if im is None or alpha <= 0: return
    if abs(sc - 1) > .001: im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.BILINEAR if smooth else Image.NEAREST)
    if alpha < 1: im = im.copy(); im.putalpha(im.getchannel('A').point(lambda v: int(v * alpha)))
    base.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2)))


POP = [1.7, 1.35, 1.12, .96, 1.02, 1.0]
def pop(k): return 0 if k < 0 else POP[k] if k < len(POP) else 1.0


def title(base, k, s, size, fill, cy, t0=0, maxw=1000, path=PS):
    """Text, der bei Bild t0 der Szene aufploppt (und nie breiter als das Bild wird)"""
    if k - t0 < 0: return
    im = text_img(s, size, fill, path, maxw=maxw)
    place(base, im, W / 2, cy, min(pop(k - t0), max(1.0, 1070 / im.width)))


def load(p): return Image.open(p).convert('RGBA')


def zoom(im, s, ox=0, oy=0):
    if abs(s - 1) < .001 and not ox and not oy: return im.copy()
    w, h = int(W / s), int(H / s); x, y = int((W - w) / 2 + ox), int((H - h) / 2 + oy)
    return im.crop((x, y, x + w, y + h)).resize((W, H), Image.BILINEAR)


def flash(base, k, strength=.85, n=4, col=(255, 255, 255)):
    if 0 <= k < n: base.alpha_composite(Image.new('RGBA', (W, H), col + (int(255 * strength * (1 - k / n)),)))


def fade_out(base, k, total, n=12):
    if k > total - n: base.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, int(255 * (k - (total - n)) / n))))


def darken(im, f=.45, blur=0):
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    return ImageEnhance.Brightness(im).enhance(f)


def rgb(col): return Image.new('RGBA', (1, 1), col).getpixel((0, 0))


def glow_disc(r, col, a=180):
    g = Image.new('RGBA', (r * 2, r * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(g); c = rgb(col)
    for i in range(24, 0, -1):
        rr = int(r * i / 24); d.ellipse((r - rr, r - rr, r + rr, r + rr), fill=c[:3] + (int(a * (1 - i / 24) ** 1.6),))
    return g


def rays(r, col, ang, n=12, a=70):
    g = Image.new('RGBA', (r * 2, r * 2), (0, 0, 0, 0)); d = ImageDraw.Draw(g); c = rgb(col)
    for i in range(n):
        a0 = ang + i * 2 * math.pi / n
        d.polygon([(r, r), (r + math.cos(a0 - .09) * r, r + math.sin(a0 - .09) * r), (r + math.cos(a0 + .09) * r, r + math.sin(a0 + .09) * r)], fill=c[:3] + (a,))
    return g.filter(ImageFilter.GaussianBlur(6))


def ease(t): return t * t * (3 - 2 * t)


def gameplay(raw, scene, i, k, punch=True, drift=.04):
    """Aufnahme raw/<scene>/<i>.jpg mit leichtem Zoom und Ruck beim Schnitt"""
    im = load(os.path.join(raw, scene, '%04d.jpg' % i))
    s = 1 + drift * k / 60
    if punch and k < 5: s += .14 * (1 - k / 5) ** 2
    return zoom(im, s)


def data_img(u): return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGBA')


def badge(text, size=34, bg=(232, 176, 74), fg=(17, 14, 23)):
    """Goldenes Etikett, z. B. „UPDATE 4.2“"""
    f = font(PS, size); bb = f.getbbox(text); pw, ph = bb[2] - bb[0] + 36, bb[3] - bb[1] + 28
    im = Image.new('RGBA', (pw + 8, ph + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle((6, 6, pw + 7, ph + 7), fill=(40, 6, 12, 255)); d.rectangle((0, 0, pw, ph), fill=bg + (255,), outline=(17, 14, 23, 255), width=4)
    d.text((18 - bb[0], 14 - bb[1]), text, font=f, fill=fg)
    return im


def logo():
    """KLINGENHORT in Gold mit dunkelroter Kante"""
    f = font(PS, 88); s = 'KLINGENHORT'; bb = f.getbbox(s)
    w, h = bb[2] - bb[0] + 60, bb[3] - bb[1] + 70
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im); x, y = 20 - bb[0], 20 - bb[1]
    for o in range(14, 0, -2): d.text((x + o * .5, y + o), s, font=f, fill=(90, 12, 18, 255), stroke_width=8, stroke_fill=(30, 4, 8, 255))
    d.text((x, y), s, font=f, fill=(0, 0, 0, 255), stroke_width=9, stroke_fill=(16, 6, 10, 255))
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).text((x, y), s, font=f, fill=255)
    grad = Image.new('RGBA', (w, h)); gd = ImageDraw.Draw(grad)
    for yy in range(h):
        t = (yy - y) / max(1, bb[3] - bb[1]); gd.line((0, yy, w, yy), fill=((255, 243, 192) if t < .35 else (255, 210, 74) if t < .7 else (232, 140, 40)) + (255,))
    im.paste(grad, (0, 0), mask)
    return im


class EndCard:
    """Schluss: Logo, die vier Helden, Aufruf und Adresse. Braucht raw/assets (harness.assets()) und Hintergrundbilder.
    cta: Aufruf als Liste von Zeilen (Standard eine Zeile „JETZT GRATIS SPIELEN“), foot: Zeile unter der Adresse."""
    def __init__(self, raw, bg_frames, tag='DAS PIXEL-ACTION-RPG', extra=None, cta=None, foot=None):
        A = json.load(open(os.path.join(raw, 'assets', 'assets.json')))
        self.meta = A['main']; self.heroes = [load(os.path.join(raw, 'assets', 'm_%d.png' % i)) for i in range(len(self.meta))]
        self.bg = [darken(load(p), .3, 14) for p in bg_frames]; self.logo = logo(); self.tag = tag; self.extra = extra
        self.cta = cta or ['JETZT GRATIS SPIELEN']; self.foot = foot or 'HANDY & PC · OHNE DOWNLOAD'

    def __call__(self, k, total=144):
        b = self.bg[(k // 6) % len(self.bg)].copy()
        place(b, glow_disc(560, '#e8b04a', 90), W / 2, 980)
        sh = (random.randint(-10, 10), random.randint(-10, 10)) if k < 6 else (0, 0)
        place(b, self.logo, W / 2 + sh[0], 470 + sh[1], min(pop(k) * (1 + .02 * math.sin(k * .25)), 1070 / self.logo.width))
        title(b, k, self.tag, 36, WHITE, 590, 6)
        if self.extra and k >= 10: place(b, self.extra, W / 2, 680, pop(k - 10))
        n = len(self.heroes)
        for i in range(n):
            t0 = 8 + i * 4
            if k < t0: continue
            kk = k - t0; yb = 980 - max(0, 120 - kk * 40) + (12 if kk == 3 else 0); x = W / 2 + (i - (n - 1) / 2) * 235
            if self.meta[i]['aura']: place(b, glow_disc(170, self.meta[i]['aura'][0], 130), x, yb + 30)
            fr = (k // 4 + i) % 4
            place(b, self.heroes[i].crop((fr * 40, 0, fr * 40 + 40, 44)), x, yb, 8)
        n = len(self.cta)   # eine Zeile wie bisher bei y 1270, zwei Zeilen bei 1215/1285
        for j, line in enumerate(self.cta):
            if k >= 26 + j * 3: place(b, text_img(line, 50, GOLD), W / 2, 1270 - (n - 1) * 35 + j * 70, pop(k - 26 - j * 3) * (1 + .05 * math.sin((k - 26) * .35)))
        uy = 1385 if n == 1 else 1393
        if k >= 32:
            kk = k - 32; box = Image.new('RGBA', (900, 104), (16, 10, 24, 235))
            ImageDraw.Draw(box).rectangle((0, 0, 899, 103), outline=(255, 210, 74, 255), width=6)
            place(b, box, W / 2 - 20, uy, pop(kk))
            if kk >= 2: place(b, text_img(URL, 62, WHITE, VT, stroke=3, shadow=3, maxw=840), W / 2 - 20, uy - 3)
        if k >= 40: title(b, k, self.foot, 30, ICE, 1490 if n == 1 else 1482, 40)
        flash(b, k, 1, 6); fade_out(b, k, total)
        return b


def render(scenes, out_dir, hits=None, only=None):
    """scenes: Liste (name, funktion(k), bilder). Schreibt out_dir/frames/0000.jpg … und out_dir/timeline.json.
    hits: zusätzliche Geräusche [(bild, art)], art aus impact, sparkle, tick, roar, clank, ting, whoosh."""
    fr = os.path.join(out_dir, 'frames'); os.makedirs(fr, exist_ok=True)
    n, starts = 0, []
    for name, fn, ln in scenes:
        starts.append((name, n))
        if only and name not in only: n += ln; continue
        for k in range(ln): fn(k).convert('RGB').save(os.path.join(fr, '%04d.jpg' % (n + k)), quality=93)
        n += ln; print('Szene', name, 'fertig', flush=True)
    json.dump({'total': n, 'starts': starts, 'hits': hits or []}, open(os.path.join(out_dir, 'timeline.json'), 'w'))
    print('Bilder', n, '=', round(n / FPS, 1), 's')
    return n


def contact_sheet(out_dir, every=24, cols=6, w=180):
    """Übersicht jedes n-ten Bildes zum Prüfen vor dem Kodieren: out_dir/sheet.jpg"""
    fr = os.path.join(out_dir, 'frames'); files = sorted(f for f in os.listdir(fr) if f.endswith('.jpg'))[::every]
    h = int(w * H / W); rows = (len(files) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * (w + 6), rows * (h + 6)), 'white')
    for i, f in enumerate(files): sheet.paste(Image.open(os.path.join(fr, f)).resize((w, h)), ((i % cols) * (w + 6), (i // cols) * (h + 6)))
    sheet.save(os.path.join(out_dir, 'sheet.jpg'), quality=85); return os.path.join(out_dir, 'sheet.jpg')
