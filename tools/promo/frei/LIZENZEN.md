# Freie Töne und Meme-Grafiken (alle CC0)

Alles in diesem Ordner steht unter **CC0 1.0 (Public Domain)**: frei nutzbar, auch für Werbung, ohne Namensnennung. Geprüft am 06.11.2026 auf der jeweiligen Seite (Lizenzfeld „CC0“, bei Kenney zusätzlich die mitgelieferte `License.txt`). Danke an die Urheber – eine Nennung ist nicht nötig, aber nett.

**Regel:** Hier kommt nur rein, was nachweisbar CC0 ist und selbst gemacht wurde (keine Mitschnitte bekannter Memes, Filme, Lieder). Neue Funde mit Quelle, Urheber und Datum in die Tabelle eintragen.

## Töne (`ton/`, WAV 22,05 kHz mono, auf gleiche Lautstärke gebracht)

| Dateien | Quelle | Urheber | Hinweis |
|---|---|---|---|
| `boing_01–09`, `gong_01–02`, `plopp_01–02`, `rums_01–07`, `treffer_01–04`, `explosion_01`, `glas_01–05`, `ding_01–03`, `platsch_01–02`, `schraeg_01–05` | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) (spring, gong, plop, slam, hit, explosion, glass, bell, splash, weird) | rubberduck | selbst aufgenommen |
| `komisch_01–30` | [30 weird CC0 SFX](https://opengameart.org/content/30-weird-cc0-sfx) | rubberduck | selbst aufgenommen und erzeugt |
| `bruh_01` | [Bruh Sound effect](https://opengameart.org/content/bruh-sound-effect) | komodoking | laut Beschreibung von einem Freund eingesprochen (kein Mitschnitt des Originals) |
| `dynamit_01` | [Dynamite sound effect](https://opengameart.org/content/dynamite-sound-effect) | listener | Lunte und Knall |

Nicht übernommen: „Accordion Sound“ (Beschreibung schränkt die Nutzung ein), „Au yeah!“ (Herkunft unklar).

## Meme-Grafiken (`bild/`)

| Dateien | Quelle | Urheber |
|---|---|---|
| `emote/*.png` (30 Sprechblasen: laugh „HA HA“, heart, heartBroken, anger, question, exclamation(s), drops, sleep(s), idea, star(s), cash, music, faceHappy/Sad/Angry, swirl, cross …) | [Emotes Pack](https://opengameart.org/content/emotes-pack), Pixel-Stil 3 | Kenney (kenney.nl) |
| `gesicht/*.png` (14 Pixel-Gesichter: doh, confused, worried, bored, veryHappy …) | [16x16 Emotes for RPGs and Digital Pets](https://opengameart.org/content/16x16-emotes-for-rpgs-and-digital-pets) | tomcat94 |
| `smileys_100.png` (100 Smileys 15×15, ein Bogen) | [100 Smiley Faces](https://opengameart.org/content/100-smiley-faces) | angrycheese |
| `daumen.png` (Daumen hoch/runter) | [Thumbs Up and Thumbs Down Sprite](https://opengameart.org/content/thumbs-up-and-thumbs-down-sprite) | waluigifan03 |

## Benutzung

- Ton im Schnitt: in `HITS` eines Storyboards `[bild, 'frei:boing_03']` (siehe `music.py`).
- Bild im Schnitt: `meme_bild(b, k, 'laugh', 540, 900, t0=20)` oder `meme_bild(b, k, 'gesicht/doh', …)` (siehe `promolib.py`).
