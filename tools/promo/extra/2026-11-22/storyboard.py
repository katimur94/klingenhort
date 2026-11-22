# Schnitt Biom-Clip „3 Orte, wo es vom Himmel regnet“ (1080×1920, 30 fps, ~8 s): Schildgraben (Pfeile), Verbrannte Mark (Steine), Aschefront (Feuer)
# je Biom: Ankündigung am Boden, „LAUF!“, Einschlag hinter dem Helden · Endkarte 2 s mit Frage
# Aufruf: PROMO_OUT=/tmp/klingenhort-front python3 storyboard.py
import os, sys, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
from promolib import *
OUT = os.environ.get('PROMO_OUT', '/tmp/klingenhort-front')
RAW = os.path.join(OUT, 'raw')
I = json.load(open(os.path.join(RAW, 'info.json')))
_title = title
def title(b, k, s, size, fill, cy, t0=0):
    return _title(b, k, s, min(size, int(820 / max(1, len(s)))), fill, cy, t0)
# Einschlag = Bild 3 + Vorwarnung (Pfeil 1,3 s, Katapult 1,7 s, Meteor 1,2 s)
TXT = {'pfeil': ('PFEILE', '#fff3c0', 42), 'katapult': ('STEINE', '#ffc24a', 54), 'magie': ('FEUER', '#ff8a5a', 39)}
UP = lambda s: s.upper().replace('Ä', 'AE').replace('Ö', 'OE').replace('Ü', 'UE')
def szene(x, nr):
    was, col, hit = TXT[x['art']]
    def f(k):
        b = zoom(load(os.path.join(RAW, x['b'], '%04d.jpg' % k)), 1.25 + .002 * k, 0, 40)
        title(b, 12, 'WO ES VOM HIMMEL REGNET', 50, WHITE, 230)
        title(b, k, '%d. %s' % (nr, UP(x['n'])), 76, GOLD, 340)
        title(b, k, 'HIER REGNET ES ' + was, 54, col, 440, 3)
        if 9 <= k < hit: react(b, k, 'LAUF!!!', 540, 1420, t0=9, size=96, fill=RED, shake=10)
        if k >= hit:
            react(b, k, 'KNAPP!', 540, 1420, t0=hit, size=96, fill=MOSS, shake=8); flash(b, k - hit, .5, 4, (255, 230, 190))
            emoji_face(b, k, 'cool', 880, 1220, t0=hit + 3, r=60)
        elif k >= 4: emoji_face(b, k, 'shock', 880, 1220, t0=4, r=60)
        return b
    return f, hit
END = EndCard(RAW, [os.path.join(RAW, x['b'], '%04d.jpg' % 30) for x in I], tag='WO TRAUST DU DICH HIN?', extra=badge('ENDLOSE LANDE · KRIEG DER KRONEN', 24))
SCENES, HITS, s0 = [], [], 0
for n, x in enumerate(I):
    f, hit = szene(x, n + 1); SCENES.append((x['b'], f, 60))
    HITS += [[s0, 'impact'], [s0 + 9, 'frei:boing_03'], [s0 + hit, 'impact'], [s0 + hit + 2, 'frei:komisch_12' if n % 2 else 'frei:ding_02']]; s0 += 60
SCENES.append(('end', lambda k: END(k + 30, 114), 62)); HITS.append([s0, 'sparkle'])
if __name__ == '__main__':
    render(SCENES, OUT, HITS, only=sys.argv[1:] or None)
    print('Übersicht:', contact_sheet(OUT, every=15))
