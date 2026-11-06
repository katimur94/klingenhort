# TikTok @klingenhort – Betrieb (selbstständig, mit Timurs Freigabe)

Account: TikTok **@klingenhort**, gepostet über Zernio (Account-ID `6aeb1272fb08a821ad7822c8`). Ziel: Spieler für das Gratis-Spiel https://katimur94.github.io/klingenhort/ gewinnen.

## Rhythmus (geplante Aufgaben)
| Wann | Was |
|---|---|
| Freitag (Wochen-Update) | Update-Clip nach dem Live-Stellen – nur wenn das Update wirklich live ist |
| Sa–Do 18:12 | Tages-Clip 10–15 s aus echtem Gameplay, Szenen unter `tools/promo/extra/<datum>/` |
| täglich 12:42 | Kommentare beantworten, Zahlen auswerten, `log.md` und `feedback.md` pflegen |

## Inhalte
- **Nur Echtes:** nur zeigen und versprechen, was es im Spiel gibt (keine erfundenen Features, keine falschen Zahlen).
- **Erstes Bild zählt:** sofort Action, großer kurzer Text (max. 14 Zeichen/Zeile), sichere Zonen (unten ab y≈1500 und rechts ab x≈960 frei), Schnitte auf den Takt – siehe `tools/promo/README.md`.
- **Themen wechseln:** Bosse, Mythisch/seltene Funde, Biome der Endlosen Lande, Begleiter, Meister-Talente, Level-Belohnungen, Versteck/Bauen, Basar, Auftragstafel, Klassen & Ultimative, „Wusstest du?“-Tipps. Ein Thema frühestens nach zwei Wochen wieder.
- **Formate testen:** Aufhänger-Frage („Welche Klasse bist du?“), Vorher/Nachher (LV 1 → LV 100), Challenge („Schaffst du Rang 1200?“), Mini-Tutorial. Was in `log.md` gut lief, öfter machen.
- **Humor & Memes (1–2× pro Woche):** lustige Szenen aus dem Spiel im Stil bekannter Meme-Formate – z. B. „POV: du findest endlich ein Mythisch … und es ist für die falsche Klasse“, „Ich nach 5 Minuten vs. nach 5 Stunden“, „Niemand: / Der Schatzgoblin:“, „Erwartung vs. Realität“ (Boss-Kodex Rang 1200), Begleiter-Fails, Gegnerhorde vs. Ultimative, Tod direkt vor dem Ausgang der Lande. Aktuelle Trends vorher mit einer Websuche prüfen (welche Gaming-Meme-Formate gerade laufen) und ins Spiel übertragen.
  - **Nur Formate nachbauen, nichts übernehmen:** keine fremden Bilder, Videoausschnitte, Figuren oder Lieder (Urheberrecht), keine echten Personen oder Marken, kein Ton aus anderen Videos, keine heruntergeladenen „viralen“ Töne oder Meme-Clips – Text-Overlay + unser Gameplay + eigene Chiptune.
  - **Erlaubt (Timurs Wunsch, 06.11.2026):** freie CC0-Töne und Meme-Grafiken aus `tools/promo/frei/` (Liste mit Quellen in `frei/LIZENZEN.md`) – für mehr Abwechslung mischen: `'frei:<name>'` in den Hits, `meme_bild()` für Emotes. Neues nur mit nachgewiesener CC0-Lizenz und eingetragen in die Liste.
  - **Trend-Sounds:** echte TikTok-Trend-Töne gehen nur in der App (Timur legt sie selbst drüber, aus der für Business-Accounts freigegebenen Bibliothek) – nie einen Song ins Video einbauen.
  - Kein Spott über Gruppen, nichts Gemeines, nichts Anzügliches, nichts Gruseliges für Kinder; Humor über das Spiel und Gamer-Alltag.
- **Faxen machen (Timurs Wunsch – in jedem lustigen Clip, gern auch sonst):** Reaktions-Texte mit `react()` aus promolib („HÄÄÄ?“, „BRUHHH“, „BRO???“, „NEIN NEIN NEIN“, „WARUM?!“, „ICH:“ / „DER SCHLEIM:“, „…okay“), gezeichnete Gesichter mit `emoji_face()` (Totenkopf, 😐, 😎, 😭), Standbild mit `freeze()` für „…und dann:“-Momente, Zoom auf den Moment. Dazu die eigenen Comedy-Geräusche aus music.py als `hits`: `huh` (Kazoo-„Häää?“), `thud` (Bruh-Schlag), `boing`, `scratch` (Plattenkratzer), `sad` (Wah-wah-waaah), `dundun` (Dramatik), `bumm` (Meme-Bumm), `wirbel` (Trommelwirbel), `failhorn` – und die freien CC0-Töne (`frei:bruh_01`, `frei:gong_01`, `frei:boing_03`, `frei:komisch_12` …) sowie Pixel-Emotes mit `meme_bild()` (HA HA, Herz, Wut, ?, !!, Schweißtropfen, ZZ …). Jeden Clip etwas anders mischen. Timing: Reaktion 6–15 Bilder nach dem Gag, nie mehr als zwei Reaktionen gleichzeitig, Texte groß und kurz. Ziel bleibt: am Ende Lust aufs Selberspielen (Endkarte mit Link, Frage an die Zuschauer).
- **Aktuell bleiben:** jedes neue Feature in der Woche nach dem Update mindestens einmal zeigen; Wochen-Ereignis (Goldrausch, Blutmond …) und Jahreszeit/Feiertage aufgreifen, wenn sie im Spiel vorkommen.
- **Beschreibung:** Deutsch, kurz: Aufhänger · ein Satz zum Inhalt · „Gratis im Browser – Handy & PC, ohne Download 👉 katimur94.github.io/klingenhort“ · 8–10 Hashtags (#klingenhort #pixelart #indiegame #rpg #hackandslash #browsergame #gamedev #mobilegame + 1–2 themenbezogene).
- Musik: nur unsere eigene Chiptune (tools/promo/music.py) – keine fremden Lieder.

## Kommentare
- Öffentlich, freundlich, kurz, auf Deutsch (oder in der Sprache des Kommentars), per du. Fragen zum Spiel beantworten (gern mit Verweis auf das Handbuch „?“ im Spiel).
- **Keine Direktnachrichten.** Keine persönlichen Daten erfragen oder wiederholen (viele Zuschauer sind jung). Keine Versprechen zu Terminen außer dem, was im Wochenplan (ROADMAP.md) steht.
- Spam, Beleidigungen, Werbung: nicht antworten (im Bericht erwähnen).
- **Bug-Meldungen und Wünsche** → in `tools/promo/feedback.md` eintragen (Datum, Kurzfassung, Link/Post-ID). Das Wochen-Update schaut dort nach; echte Bugs werden mit dem nächsten Update behoben.
- An Timur weitergeben (im Bericht, nicht selbst entscheiden): Kooperations- und Geldanfragen, Beschwerden über Rechte/Inhalte, alles Rechtliche, Presse.

## Auswertung
- Täglich Aufrufe, Likes, Kommentare, Shares, Follower je Post in `tools/promo/log.md` (eine Zeile je Post).
- Einmal pro Woche (Freitag im Bericht): was am besten lief, was nicht, was wir nächste Woche anders machen.

## Grenzen
- Zernio-Gratis-/Planlimits beachten (`usage_get_usage`); bei Fehlern nicht wiederholt posten, sondern im Bericht melden.
- Profil (Bild, Bio, Name) kann nur Timur in der App ändern.
- „Stopp“ oder „nur Entwürfe“ von Timur gilt sofort für alle Aufgaben.
