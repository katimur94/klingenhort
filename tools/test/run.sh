#!/usr/bin/env bash
# Alle automatischen Tests. Aufruf aus dem Repo: bash tools/test/run.sh
# Startet das Spiel lokal auf Port 8777, prüft Handy (hoch/quer), iPhone, TikTok-Browser,
# PC (Maus, Tastatur, Bildschirm-Erkennung, HD), alte Spielstände, Schmiede, Begleiter, Meisterschaft, Tausch, Auren, Basar, Verlorene Lande, Tausend Bosse, alle Sprachen und fotografiert alle Bildschirme nach /tmp/klingenhort-test/screens-*.
# Rückgabe 0 = alles grün, sonst 1.
cd "$(dirname "$0")/../.."
PORT=8777; export BASE="http://localhost:$PORT/"
python3 -m http.server $PORT >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 30); do curl -s -o /dev/null "$BASE" && break; sleep 0.2; done
for f in js/*.js sw.js; do node -e "new Function(require('fs').readFileSync('$f','utf8'))" || { echo "  FAIL Syntaxfehler in $f"; exit 1; }; done
echo "  ok   Syntax aller Skripte"
FAIL=0
run() { echo; echo "== $*"; "$@" || FAIL=1; }
run node tools/test/rules.js
run node tools/test/flows.js 390 844
run node tools/test/flows.js 844 390
run node tools/test/flows.js 667 375
run node tools/test/iphone.js "iPhone 13"
run node tools/test/iphone.js "iPhone 13" tiktok
run node tools/test/iphone.js "iPhone SE"
run node tools/test/iphone.js "iPhone 13 landscape"
run node tools/test/savecompat.js
run node tools/test/screens.js 390 844 /tmp/klingenhort-test/screens-hoch
run node tools/test/screens.js 844 390 /tmp/klingenhort-test/screens-quer
run node tools/test/screens.js 1280 720 /tmp/klingenhort-test/screens-pc pc
run node tools/test/pc.js /tmp/klingenhort-test/pc
run node tools/test/forge.js /tmp/klingenhort-test/forge
run node tools/test/mods.js /tmp/klingenhort-test/mods
run node tools/test/pets.js /tmp/klingenhort-test/pets
run node tools/test/mastery.js /tmp/klingenhort-test/mastery
run node tools/test/trade.js 390 844 /tmp/klingenhort-test/trade
run node tools/test/auras.js /tmp/klingenhort-test/auras
run node tools/test/market.js 390 844 /tmp/klingenhort-test/market
run node tools/test/lande.js /tmp/klingenhort-test/lande
run node tools/test/bosses.js /tmp/klingenhort-test/bosses
run node tools/test/artefakte.js /tmp/klingenhort-test/artefakte
run node tools/i18n/check.js
# jede Sprache im Hochformat (gleichzeitig): nichts fehlt, kein Deutsch, nichts abgeschnitten
echo; echo "== Sprachen"
mkdir -p /tmp/klingenhort-test; PIDS=""
for l in en tr es it fr; do KH_LANG=$l node tools/test/screens.js 390 844 /tmp/klingenhort-test/lang-$l > /tmp/klingenhort-test/lang-$l.log 2>&1 & PIDS="$PIDS $!"; done
for j in $PIDS; do wait $j || FAIL=1; done
for l in en tr es it fr; do cat /tmp/klingenhort-test/lang-$l.log; done
echo
if [ $FAIL = 0 ]; then echo "ALLE TESTS GRÜN"; else echo "TESTS FEHLGESCHLAGEN"; fi
exit $FAIL
