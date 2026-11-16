# Schnitt Update-Clip 6.6 „Saison 1“ (1080×1920, 30 fps, ~13 s)
# hook (Saison-Heldin im Kampf, PREMIERE-Stil) → punkte (Kills = Saison-Punkte, Balken aus dem Spiel-Log, echte Stufen-Meldung)
# → pass (Saison-Pass, „Alle abholen“) → kosm (Sturmmantel + Aura, nur in Saison 1) → Endkarte
# Aufruf: PROMO_OUT=/tmp/klingenhort-clip-6.6 python3 storyboard.py
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-clip-6.6')
RAW = os.path.join(OUT, 'raw')
LOG = json.load(open(os.path.join(RAW, 'punkte', 'log.json')))
INFO = json.load(open(os.path.join(RAW, 'pass', 'info.json')))
UP = next(i for i, x in enumerate(LOG) if x['st'] > LOG[0]['st'])
SZ = '#8ee6ff'
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)

def hook(k):
    b = gameplay(RAW, 'hook', k, k, punch=False, drift=.06)
    place(b, badge('UPDATE 6.6', 40, bg=(140, 220, 255)), W / 2, 300, 1 if k < 1 else pop(k))
    title(b, k + 12, 'SAISON 1', 120, SZ, 430)
    title(b, k + 12, 'IST DA!', 80, WHITE, 550)
    if k >= 20: react(b, k, '6 WOCHEN · 30 BELOHNUNGEN', 540, 1300, t0=20, size=34, fill=GOLD)
    return b

def bar(b, L, k, up):
    x0, x1, y = 140, 940, 1330; d = ImageDraw.Draw(b)
    d.rectangle((x0 - 6, y - 6, x1 + 6, y + 46), fill=(17, 14, 23, 255), outline=(255, 246, 224, 255), width=4)
    f = L['in'] / L['need'] if L['need'] else 1
    d.rectangle((x0, y, x0 + int((x1 - x0) * f), y + 40), fill=(142, 230, 255, 255))
    place(b, text_img('STUFE %d' % L['st'], 44, GOLD if up else WHITE, stroke=4), W / 2, y - 50, 1.3 if up and k < 6 else 1)
def punkte(k):
    b = gameplay(RAW, 'punkte', k, k, drift=.04)
    title(b, k, 'JEDER KILL', 72, WHITE, 340)
    title(b, k, '= SAISON-PUNKTE', 60, SZ, 440, 4)
    bar(b, LOG[k], k - UP, k >= UP)
    if k >= UP:
        react(b, k, 'STUFE %d!' % LOG[k]['st'], 540, 1130, t0=UP, size=84, fill=GOLD, shake=10)
        meme_bild(b, k, 'stars', 860, 980, t0=UP + 6, size=150)
        flash(b, k - UP, .6, 4, (200, 240, 255))
    return b

CL = 34   # „Alle abholen“ in raw/pass
def pas(k):
    b = zoom(load(os.path.join(RAW, 'pass', '%04d.jpg' % k)), 1.35 + .0006 * k, 0, -250)
    d = Image.new('RGBA', (W, 330), (12, 9, 18, 235)); b.paste(d, (0, 250), d)
    title(b, k, 'SAISON-PASS', 84, GOLD, 340)
    title(b, k, '30 STUFEN · GRATIS', 50, WHITE, 450, 4)
    if k >= CL:
        react(b, k, 'ALLES MEINS!', 540, 1340, t0=CL, size=72, fill=MOSS, shake=8)
        meme_bild(b, k, 'laugh', 860, 1180, t0=CL + 6, size=150)
        flash(b, k - CL, .5, 4)
    else: title(b, k, 'GOLD · EIER · LEGENDAER · MYTHISCH', 30, SZ, 530, 8)
    return b

def kosm(k):
    b = gameplay(RAW, 'kosm', k, k, drift=.05)
    title(b, k, 'NUR IN SAISON 1:', 56, WHITE, 340)
    title(b, k, 'STURMMANTEL', 80, SZ, 440, 4)
    title(b, k, '+ AURA', 80, GOLD, 540, 8)
    if k >= 24: react(b, k, 'NOCH %d TAGE' % INFO['days'], 540, 1300, t0=24, size=64, fill=RED)
    flash(b, k, .5, 4, (200, 240, 255))
    return b

END = EndCard(RAW, [os.path.join(RAW, 'hook', '%04d.jpg' % f) for f in range(8, 48, 8)], tag='WELCHE STUFE SCHAFFST DU?', extra=badge('SAISON 1 · KOSTENLOS', 26))
SCENES = [('hook', hook, 48), ('punkte', punkte, 84), ('pass', pas, 84), ('kosm', kosm, 60), ('end', lambda k: END(k + 30, 114), 84)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
HITS = [[0, 'impact'], [4, 'roar'], [S0['punkte'], 'whoosh'], [S0['punkte'] + UP, 'sparkle'], [S0['punkte'] + UP + 1, 'frei:gong_01'], [S0['pass'], 'impact'],
        [S0['pass'] + CL, 'frei:ding_02'], [S0['pass'] + CL + 3, 'sparkle'], [S0['pass'] + CL + 8, 'frei:komisch_12'], [S0['kosm'], 'impact'], [S0['kosm'] + 24, 'dundun'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
