#!/usr/bin/env bash
# Lädt die beiden Pixel-Schriften (SIL Open Font License) von Google Fonts nach tools/promo/fonts
set -e
D="$(cd "$(dirname "$0")" && pwd)/fonts"; mkdir -p "$D"
UA='Mozilla/5.0 (Linux; U; Android 4.0.3; de-de) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30'
get() { # $1 Familie, $2 Datei
  [ -s "$D/$2" ] && return 0
  url=$(curl -s -A "$UA" "https://fonts.googleapis.com/css?family=$1" | grep -o 'https://[^)]*\.ttf' | head -1)
  [ -n "$url" ] || { echo "Schrift $1 nicht gefunden"; exit 1; }
  curl -s -o "$D/$2" "$url" && echo "Schrift $2 geladen"
}
get 'Press+Start+2P' PressStart2P.ttf
get 'VT323' VT323.ttf
