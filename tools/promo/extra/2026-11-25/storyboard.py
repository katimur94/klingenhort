# Schnitt Fund-Clip „3 Glücksmünzen – was kommt raus?“ (1080×1920, 30 fps, ~14,5 s): drei echte Drehs an der Glücksrolle,
# Dreh 1 in Echtzeit, Dreh 2 und 3 doppelt so schnell (im Bild als „2X“ markiert). Ergebnisse sind die echten (Gold, Erz, Erz).
# Aufruf: PROMO_OUT=/tmp/klingenhort-rolle python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-rolle')
RAW = os.path.join(OUT, 'raw')
L = json.load(open(os.path.join(RAW, 'spins.json')))
SP = [[e for e in L if e['s'] == s] for s in range(3)]
T = 5.2
def at(s, t):   # Rohbild des Drehs s zur Spielzeit t (Sekunden ab Drehstart)
    x = SP[s]; return next((e['n'] for e in x if e['t'] >= t), x[-1]['n'])
_bg = {}
def shot(n):
    im = load(os.path.join(RAW, 'rolle', '%04d.jpg' % n))
    b = darken(im, .25, 12)
    band = im.crop((160, 405, 920, 870)).resize((W, int(465 * W / 760)), Image.BILINEAR)   # Rolle, echte Chancen, Ergebnis
    b.paste(band, (0, 980 - band.height // 2), band)
    return b
def kopf(b, k, s):
    title(b, k, '3 GLUECKSMUENZEN', 62, GOLD, 440); title(b, k, 'WAS KOMMT RAUS?', 52, WHITE, 530)
    place(b, badge('DREH %d/3' % (s + 1) + ('  ·  2X' if s else ''), 34), W / 2, 1390)
R1, R2, R3 = 21, 24, 30
def dreh1(k):
    t = k / 30; b = shot(at(0, min(t, T + R1 / 30)))
    kopf(b, k, 0)
    if t > T: kk = k - int(T * 30); react(b, kk, '+1020 GOLD. OKAY!', 540, 1530, size=54, fill=GOLD); flash(b, kk, .5, 4)
    return b
def dreh(s, rest, txt, col, face):
    def f(k):
        n = int(T * 15); t = min(k * 2 / 30, T) if k < n else T + (k - n) / 30
        b = shot(at(s, t)); kopf(b, k + 200, s)
        if k >= n:
            kk = k - n; react(b, kk, txt, 540, 1530, size=54, fill=col); flash(b, kk, .45, 4)
            if face: meme_bild(b, kk, face, 900, 1660, t0=6, size=170)
        return b
    return f
END = EndCard(RAW, [os.path.join(RAW, 'rolle', '%04d.jpg' % at(0, t)) for t in (1, 2, 3, 4)], tag='WAS HAETTEST DU GEZOGEN?', extra=badge('GLUECKSTEMPEL · ECHTE DREHS · GRATIS', 26))
N1 = int(T * 30) + R1; N2 = int(T * 15) + R2; N3 = int(T * 15) + R3
SCENES = [('dreh1', dreh1, N1), ('dreh2', dreh(1, R2, 'ERZ … NA GUT.', ICE, None), N2),
          ('dreh3', dreh(2, R3, 'SCHON WIEDER ERZ?!', RED, 'gesicht/doh'), N3), ('end', lambda k: END(k + 30, 78), 48)]
def ticks(f0, dur):   # ein Klick je vorbeirollendem Feld (Rolle bremst ab: kubisch)
    out, last = [], -9
    for i in range(1, 39):
        f = f0 + int(dur * 30 * (1 - (1 - i / 38) ** (1 / 3)))
        if f - last >= 2: out.append([f, 'tick']); last = f
    return out
HITS = [[0, 'whoosh']] + ticks(0, T) + [[int(T * 30), 'frei:ding_01'],
        [N1, 'whoosh']] + ticks(N1, T / 2) + [[N1 + int(T * 15), 'frei:komisch_03'],
        [N1 + N2, 'whoosh']] + ticks(N1 + N2, T / 2) + [[N1 + N2 + int(T * 15), 'frei:bruh_01'], [N1 + N2 + N3, 'whoosh']]
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=20))
