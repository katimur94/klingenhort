#!/usr/bin/env bash
# Bilder + Ton zu einem TikTok-tauglichen MP4: ./encode.sh <ausgabeordner> <ziel.mp4>
set -e
OUT="$1"; DEST="$2"
[ -f "$OUT/audio.wav" ] || { echo "Erst music.py ausführen"; exit 1; }
ffmpeg -y -loglevel error -framerate 30 -i "$OUT/frames/%04d.jpg" -i "$OUT/audio.wav" \
  -c:v libx264 -preset slow -profile:v high -pix_fmt yuv420p -crf 20 -r 30 \
  -c:a aac -b:a 192k -ar 44100 -shortest -movflags +faststart "$DEST"
ffprobe -v error -show_entries format=duration,size -of compact=p=0 "$DEST"
