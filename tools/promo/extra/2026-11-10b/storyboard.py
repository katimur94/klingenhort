# Schnitt „Boss mit 1 % Leben besiegt“ (1080×1920, 30 fps, ~14 s) – Ausschnitte aus EINEM echten Kampf (raw/fight, raw/log.json aus scenes.js)
# hook: Flammenmeer trifft, Leben fällt · kampf: Boss Rang 375 · bond: Begleiter rettet (Lebensbund) · finale: 45 % → 1 %, Boss fällt · sieg · Endkarte
# Die Zahlen „LEBEN x %“ / „BOSS x %“ kommen je Bild aus dem Kampf-Log.
# Aufruf: PROMO_OUT=/tmp/klingenhort-boss python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-boss')
RAW = os.path.join(OUT, 'raw')
D = json.load(open(os.path.join(RAW, 'log.json'))); LOG = D['log']; WIN = D['win']; BOND = D['bond']; INFO = D['info']
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(800 / max(1, len(s)))), fill, cy, t0)
def pct(v): return max(1, round(v * 100)) if v > 0 else 0

def shot(f, k, z=1.12):
    b = zoom(load(os.path.join(RAW, 'fight', '%04d.jpg' % f)), z + .02 * k / 30, 0, 100 if z < 1.2 else 200)
    L = LOG[min(f, len(LOG) - 1)]; hp = pct(L['hp']); bo = pct(L['b'])
    place(b, text_img('LEBEN %d %%' % hp, 54, RED if hp < 25 else WHITE, stroke=5, maxw=480), 290, 640, 1.15 if hp < 12 and k % 10 < 5 else 1)
    place(b, text_img('BOSS %d %%' % bo, 54, GOLD, stroke=5, maxw=440), 800, 640)
    return b

def hook(k):
    b = shot(2000 + k, k)
    title(b, k + 12, 'BOSS RANG %d' % INFO['rank'], 66, GOLD, 330)
    title(b, k + 12, 'FAST TOT.', 96, RED, 440)
    return b
def kampf(k):
    b = shot(1100 + k, k)
    title(b, k, 'STUFE: ' + INFO['band'].upper(), 60, WHITE, 330)
    title(b, k, 'FLAMMENMEER', 56, RED, 430, 4); title(b, k, '+ BLITZSCHLAG', 56, ICE, 510, 8)
    return b
B0 = BOND - 30
def bond(k):
    f = B0 + k; b = shot(f, k)
    if f < BOND: title(b, k, 'DAS WARS …', 72, WHITE, 380)
    else:
        kk = f - BOND
        title(b, kk, 'MEIN DRACHE:', 60, WHITE, 330); title(b, kk, 'NEIN.', 110, MOSS, 450, 4)
        if kk >= 14: react(b, kk, 'LEBENSBUND +35 %', 540, 900, t0=14, size=44, fill=MOSS)
        if kk >= 20: meme_bild(b, kk, 'heart', 880, 780, t0=20, size=150)
        flash(b, kk, .5, 4, (150, 255, 150))
    return b
F0 = 2054
def finale(k):
    f = F0 + k; b = shot(f, k, 1.35)
    hp = pct(LOG[f]['hp'])
    title(b, k, 'BOSS: FAST TOT', 56, GOLD, 340); title(b, k, 'ICH: AUCH', 80, RED, 450, 4)
    if hp <= 2: react(b, k, '1 % LEBEN!!', 540, 900, t0=2120 - F0, size=72, fill=RED, shake=12)
    return b
def sieg(k):
    f = WIN + 4 + k; b = shot(min(f, D['n'] - 1), k, 1.35)
    title(b, k, 'GESCHAFFT!', 96, GOLD, 360); title(b, k, 'MIT 1 % LEBEN', 60, WHITE, 480, 5)
    if k >= 12: meme_bild(b, k, 'drops', 200, 800, t0=12, size=150)
    if k >= 18: react(b, k, 'DANKE, DRACHE', 540, 920, t0=18, size=52, fill=MOSS)
    flash(b, k, .7, 5)
    return b

END = EndCard(RAW, [os.path.join(RAW, 'fight', '%04d.jpg' % f) for f in range(1100, 1160, 12)], tag='SCHAFFST DU RANG %d?' % INFO['rank'], extra=badge('1200 BOSSE IM BOSS-KODEX', 26))
NF = WIN + 2 - F0
SCENES = [('hook', hook, 54), ('kampf', kampf, 60), ('bond', bond, 78), ('finale', finale, NF), ('sieg', sieg, 56), ('end', lambda k: END(k + 34, 94), 60)]
S0 = {}; _s = 0
for nm, _, n in SCENES: S0[nm] = _s; _s += n
hits = [L['i'] for a, L in zip(LOG, LOG[1:]) if L['hp'] < a['hp'] - .02]
HITS = [[0, 'impact'], [S0['kampf'], 'whoosh'], [S0['bond'], 'dundun'], [S0['bond'] + 30, 'sparkle'], [S0['bond'] + 34, 'frei:ding_02'], [S0['finale'], 'wirbel']] + \
       [[S0['finale'] + h - F0, 'thud'] for h in hits if F0 <= h < F0 + NF] + [[S0['hook'] + h - 2000, 'thud'] for h in hits if 2000 <= h < 2054] + \
       [[S0['sieg'], 'impact'], [S0['sieg'] + 2, 'frei:gong_01'], [S0['sieg'] + 18, 'frei:komisch_12'], [S0['end'], 'sparkle']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=18))
