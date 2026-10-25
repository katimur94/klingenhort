# Schnitt des Werbevideos zu Version 4. Aufruf: PROMO_OUT=/tmp/klingenhort-v4 python3 storyboard.py
import json, math, os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from promolib import *
from PIL import Image, ImageDraw

OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-v4')
RAW = os.path.join(OUT, 'raw') + '/'

# ---------- Daten ----------
A = json.load(open(RAW + 'assets/assets.json'))
S4 = json.load(open(RAW + 's4/info.json'))
S7 = json.load(open(RAW + 's7/info.json'))


def data_img(u):
    return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGBA')


# ---------- Szenen ----------
frames = []  # Liste von (szene, renderfunktion)


def s1(k):
    b = gameplay(RAW, 's1', k, k, punch=False, drift=.05)
    if k < 3: b = zoom(b, 1.18 - .06 * k)
    if k < 42:
        place(b, text_img('16-BIT', 132, GOLD), W / 2, 360)
        title(b, k, 'HACK & SLASH', 70, WHITE, 500, 5)
    else:
        title(b, k, 'GRATIS', 140, GOLD, 360, 42)
        title(b, k, 'IM BROWSER', 70, WHITE, 500, 47)
        title(b, k, 'KEIN DOWNLOAD', 40, '#bfefff', 600, 53)
    flash(b, k - 42, .5, 3)
    return b


CLS = [('s2a', 'RITTER', '#8ecbff'), ('s2b', 'MAGIER', '#ff8a3a'), ('s2c', 'ASSASSINE', '#b892f4'), ('s2d', 'BOGENSCHÜTZE', '#79c24e')]


def s2(k):
    j, kk = divmod(k, 18)
    sc, nm, col = CLS[j]
    b = gameplay(RAW, sc, kk + 2, kk)
    title(b, k, '4 KLASSEN', 92, GOLD, 340)
    title(b, kk, nm, 64, col, 470)
    flash(b, kk, .7 if j == 0 else .45, 3)
    return b


WSEQ = [4, 7, 11, 22, 20, 15, 10, 26]  # Zweihänder, Streitaxt, Hellebarde, Stab, Reflexbogen, Sicheln, Kriegshammer, Mondsichelstab
WALL = None


def s5(k):
    global WALL
    if WALL is None:
        WALL = Image.new('RGBA', (W, H * 2), (20, 14, 30, 255))
        rnd = random.Random(3)
        for y in range(0, H * 2, 190):
            for x in range(-40, W + 40, 120):
                wi, t = rnd.randrange(27), rnd.randrange(8)
                im = load(RAW + 'assets/w_%d_%d.png' % (wi, t))
                im = im.resize((im.width * 5, im.height * 5), Image.NEAREST)
                WALL.alpha_composite(im, (x + (y // 190 % 2) * 60 - im.width // 2 + 40, y + 20))
        WALL = darken(WALL, .32)
    off = int((k * 9) % H)
    b = WALL.crop((0, off, W, off + H)).copy()
    t, kk = divmod(k, 6)
    t = min(t, 7)
    mat = A['mats'][t]
    place(b, glow_disc(470, mat[1], 170), W / 2, 960)
    place(b, rays(620, mat[1], k * .03, 14, 40), W / 2, 960)
    wi = WSEQ[t]
    im = load(RAW + 'assets/w_%d_%d.png' % (wi, t))
    sc = 720 / im.height
    s = sc * (1.25 if kk == 0 else 1.08 if kk == 1 else 1)
    place(b, im, W / 2, 960 + math.sin(k * .3) * 8, s)
    title(b, k, '27 WAFFEN', 92, GOLD, 330)
    title(b, k, '8 MATERIALIEN', 54, WHITE, 450, 3)
    place(b, text_img(mat[0].upper(), 84, mat[1]), W / 2, 1400, pop(kk))
    place(b, text_img(A['weap'][wi]['n'].upper(), 40, WHITE), W / 2, 1500)
    flash(b, k, .8, 4)
    if kk == 0 and k: flash(b, 0, .25, 2, tuple(int(mat[1][i:i + 2], 16) for i in (1, 3, 5)))
    return b


S4BG = None


def s4(k):
    global S4BG
    if S4BG is None: S4BG = darken(load(RAW + 's4/ui_before.jpg'), .35, 10)
    b = S4BG.copy()
    ia, ib, ir = data_img(S4['info']['a']), data_img(S4['info']['b']), data_img(S4['res']['ic'])
    na = S4['info']['an'].split(' +')[0].upper()
    nb = S4['info']['bn'].split(' +')[0].upper()
    if k < 22:
        p = ease(min(1, max(0, (k - 10) / 12)))
        xa, xb = 290 + (W / 2 - 290) * p, 790 - (790 - W / 2) * p
        sh = (random.randint(-8, 8), random.randint(-8, 8)) if k >= 14 else (0, 0)
        place(b, glow_disc(260, S4['info']['ac'], 120), xa, 960)
        place(b, glow_disc(260, S4['info']['bc'], 120), xb, 960)
        place(b, ia, xa + sh[0], 960 + sh[1] + math.sin(k * .4) * 10, 13)
        place(b, ib, xb - sh[0], 960 - sh[1] + math.cos(k * .4) * 10, 13)
        if k < 12:
            place(b, text_img(na, 32, S4['info']['ac']), 290, 1210)
            place(b, text_img(nb, 32, S4['info']['bc']), 790, 1210)
            title(b, k, '+', 120, WHITE, 960, 2)
        title(b, k, 'VERSCHMELZE', 84, GOLD, 330)
        title(b, k, 'DEINE WAFFEN', 56, WHITE, 450, 3)
    else:
        kk = k - 22
        place(b, rays(700, PINK, kk * .05, 16, 60), W / 2, 960)
        place(b, glow_disc(420, PINK, 200 + int(40 * math.sin(kk * .5))), W / 2, 960)
        place(b, ir, W / 2, 960 + math.sin(kk * .3) * 10, 15 * (1.3 if kk == 0 else 1.1 if kk == 1 else 1))
        title(b, kk, 'MYTHISCH!', 116, PINK, 360)
        title(b, kk, S4['res']['n'].split(' ★')[0].upper(), 40, WHITE, 1330, 4)
        title(b, kk, S4['res']['d'], 40, '#bfefff', 1420, 8, path=VT)
        flash(b, kk, 1, 5)
    flash(b, k, .7, 3)
    return b


S7BG = None
TOTAL_STEPS = 11 * 2 + 10


def wheel_idx(k):
    """Feld, das bei Bild k leuchtet: kubisch abbremsend wie im Spiel"""
    T = 36
    if k >= T: return 10
    p = 1 - (1 - k / T) ** 2.4
    return int(p * TOTAL_STEPS) % 11


def s7(k):
    global S7BG
    if S7BG is None: S7BG = darken(load(RAW + 's7/ui.jpg'), .3, 10)
    b = S7BG.copy()
    title(b, k, 'GLÜCKSRAD', 92, GOLD, 330)
    title(b, k, '0,4 % MYTHISCH', 56, PINK, 450, 3)
    if k < 38:
        wi = load(RAW + 's7/wheel_%d.png' % wheel_idx(k))
        place(b, wi, W / 2, 960, 1.1)
    else:
        kk = k - 38
        place(b, rays(640, PINK, kk * .06, 16, 60), W / 2, 980)
        place(b, glow_disc(380, PINK, 210), W / 2, 980)
        place(b, load(RAW + 's7/item.png'), W / 2, 980, 20 * (1.3 if kk == 0 else 1))
        title(b, kk, 'JACKPOT!', 96, PINK, 1360)
        flash(b, kk, 1, 5)
    flash(b, k, .7, 3)
    return b


HEROES = None


def s6(k):
    global HEROES
    if HEROES is None:
        HEROES = [load(RAW + 'assets/h_%d.png' % i) for i in range(60)]
    b = Image.new('RGBA', (W, H), (24, 16, 36, 255))
    place(b, glow_disc(560, '#7a48c0', 150), W / 2, 980)
    d = ImageDraw.Draw(b)
    d.ellipse((W / 2 - 300, 1300, W / 2 + 300, 1400), fill=(10, 6, 16, 200))
    j = k // 3
    hs = HEROES[(j * 7) % 60]
    meta = A['heroes'][(j * 7) % 60]
    if meta['aura']: place(b, glow_disc(330, meta['aura'][0], 160), W / 2, 1050)
    fr = (k // 4) % 4
    hero = hs.crop((fr * 40, 0, fr * 40 + 40, 44))
    place(b, hero, W / 2, 1000, 18 * (1.08 if k % 3 == 0 else 1))
    title(b, k, 'DESIGNE', 92, GOLD, 330)
    title(b, k, 'DEINEN HELDEN', 56, WHITE, 450, 3)
    title(b, k, 'FLÜGEL · AUREN · UMHÄNGE', 30, '#bfefff', 1480, 8)
    flash(b, k, .8, 3)
    return b


def s3(k):
    b = gameplay(RAW, 's3', k + 18, k, drift=.03)
    title(b, k, 'BAU DEIN', 80, WHITE, 340)
    title(b, k, 'VERSTECK AUS', 80, GOLD, 460, 3)
    if k >= 22:
        title(b, k, 'ALCHEMIELABOR STUFE 2!', 36, '#79c24e', 1360, 22)
    flash(b, k, .7, 3)
    flash(b, k - 22, .35, 3, (255, 210, 74))
    return b


def s9(k):
    b = gameplay(RAW, 's9', k + 14, k, drift=.06)
    title(b, k, '46 MONSTER', 92, RED, 340)
    title(b, k, 'ENDLOSE HORDEN', 52, WHITE, 460, 3)
    flash(b, k, .7, 3)
    return b


BOSS = [('s8a', 'EISKÖNIGIN FROSTRA', '#bfefff'), ('s8b', 'SEUCHENFÜRST MORBUS', '#79c24e'), ('s8c', 'TODESRITTER VARKAS', '#ff5a7a'), ('s8d', 'DRACHE PYRAXIS', '#ff8a3a')]


def s8(k):
    j, kk = divmod(k, 24)
    sc, nm, col = BOSS[j]
    b = gameplay(RAW, sc, kk + 2, kk, drift=.08)
    # Anspannung: leichter Rotstich und Wackeln beim Drachen
    if j == 3: b = zoom(b, 1.0, random.randint(-6, 6), random.randint(-6, 6))
    title(b, k, '8 BOSSE', 104, RED, 340)
    title(b, kk, nm, 46, col, 470)
    flash(b, kk, .8 if j == 0 else .55, 3)
    return b


END = None


def end(k):
    global END
    if END is None: END = EndCard(RAW, [RAW + 's1/%04d.jpg' % i for i in range(0, 84, 6)])
    return END(k, 144)


SCENES = [('s1', s1, 84), ('s2', s2, 72), ('s5', s5, 48), ('s4', s4, 48), ('s7', s7, 48), ('s6', s6, 36), ('s3', s3, 48), ('s9', s9, 48), ('s8', s8, 96), ('end', end, 144)]


def hits():
    st = {}; n = 0
    for name, _, ln in SCENES: st[name] = n; n += ln
    h = [[st['s2'] + j * 18, 'kick'] for j in range(1, 4)] + [[st['s8'] + j * 24, 'roar'] for j in range(4)]
    h += [[st['s5'] + j * 6, 'ting'] for j in range(8)] + [[st['s4'] + 22, 'impact'], [st['s4'] + 22, 'sparkle']]
    prev = None
    for k in range(38):
        w = wheel_idx(k)
        if w != prev: h.append([st['s7'] + k, 'tick'])
        prev = w
    h += [[st['s7'] + 38, 'impact'], [st['s7'] + 38, 'sparkle'], [st['s3'] + 22, 'clank'], [st['s3'] + 26, 'clank']]
    h += [[st['end'] + 8 + i * 4, 'ting'] for i in range(4)] + [[st['end'] + 26, 'sparkle']]
    return h


if __name__ == '__main__':
    render(SCENES, OUT, hits(), only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT))
