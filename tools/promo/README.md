# TikTok-Clips aus echten Spielszenen

Hochformat 1080×1920, 30 fps, Chiptune-Musik passend zu den Schnitten. Alles läuft lokal: Playwright (Chromium) nimmt das Spiel bildgenau auf, Python (Pillow, NumPy) schneidet, ffmpeg kodiert.

## Ablauf für einen Update-Clip

```bash
cd <repo>
python3 -m http.server 8765 &                       # Spiel lokal starten
bash tools/promo/fonts.sh                           # Pixel-Schriften laden (einmalig)
V=4.2                                               # Version des Updates
mkdir -p tools/promo/updates/$V && cp tools/promo/update/* tools/promo/updates/$V/
# scenes.js und storyboard.py in tools/promo/updates/$V an das neue Feature anpassen (Stellen mit ANPASSEN)
export PROMO_OUT=/tmp/klingenhort-clip-$V
node tools/promo/updates/$V/scenes.js               # Aufnahmen nach $PROMO_OUT/raw
python3 tools/promo/updates/$V/storyboard.py        # Bilder nach $PROMO_OUT/frames + Übersicht sheet.jpg
python3 tools/promo/music.py $PROMO_OUT             # Musik nach $PROMO_OUT/audio.wav
bash tools/promo/encode.sh $PROMO_OUT $PROMO_OUT/klingenhort-update-$V.mp4
```

Einzelne Szenen neu aufnehmen oder schneiden: Szenennamen als Argument anhängen, z. B. `node scenes.js feature1` oder `python3 storyboard.py feature1 news`.

Die fertigen Videos kommen **nicht** ins Repo (zu groß für jede Woche). Nur die Szenen- und Schnitt-Dateien unter `updates/<version>/` werden eingecheckt.

## Bausteine

| Datei | Inhalt |
|---|---|
| `harness.js` | Übernimmt das Spiel: vier Vorzeige-Helden (0 Ritterin, 1 Magier, 2 Assassine, 3 Bogenschützin), feste Zeitschritte, `__fight`, `__keep`, `__holdBoss`, `__vp` (Zoom), `cap()` nimmt Bilder auf, `assets()` exportiert Grafiken, `news()` den neuesten Changelog-Eintrag |
| `promolib.py` | Texte mit Rand (`title`, `text_img`), `badge`, Effekte (`flash`, `zoom`, `glow_disc`, `rays`), `gameplay()` für Aufnahmen, `EndCard`, `render()`, `contact_sheet()` |
| `music.py` | Soundtrack aus `timeline.json`: Rauschen und Becken an jedem Schnitt, Einschlag und Fanfare bei der Szene `end`, zusätzliche Geräusche über `hits` |
| `encode.sh` | MP4 (H.264 + AAC, faststart) |
| `update/` | Vorlage für den wöchentlichen Clip (~13 s): Aufhänger → Feature → „Was ist neu“ → Endkarte |
| `v4/` | Werbevideo zu Version 4 (22 s) – Beispiele für Waffen-Animation, Verschmelzen, Glücksrad, Helden-Editor, Bosse, Horde |

## Regeln für gute Clips

- **Erstes Bild zählt:** sofort Action und ein großer Text, kein Fade-in
- **Texte kurz:** höchstens 14 Zeichen pro Zeile, Großbuchstaben, Überschriften zwischen y 300 und 560
- **Sichere Zone:** unten ab y ≈ 1500 liegt die TikTok-Beschreibung, rechts ab x ≈ 960 die Knöpfe – dort nichts Wichtiges
- **Schnitte auf den Takt:** Szenenlängen in Vielfachen von 12 Bildern (150 BPM)
- **Echt bleiben:** nur zeigen, was es im Spiel wirklich gibt
- Vor dem Kodieren die Übersicht `sheet.jpg` ansehen
- Funktionen, die pro Bild im Browser laufen (`R.cap(name, n, per)`), dürfen keine Node-Variablen benutzen – Werte als Text einsetzen
