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
- **Beschreibung:** Deutsch, kurz: Aufhänger · ein Satz zum Inhalt · „Gratis im Browser – Handy & PC, ohne Download 👉 katimur94.github.io/klingenhort“ · 4–5 Hashtags (#klingenhort #indiegame #pixelart + 1–2 themenbezogene, z. B. #gamingmemes, #bossfight) – Hashtags sortieren nur das Publikum, mehr bringt keine Reichweite. Die Frage aus dem Video steht als erster Satz oben.
- Musik: nur unsere eigene Chiptune (tools/promo/music.py) – keine fremden Lieder.

## Gelernt von anderen Indie-Spielen (Recherche 09.11.2026)
Quellen: Fallstudien von Indie-Entwicklern (gamedeveloper.com „400 → 20 000 Wunschlisten mit 1 Video“, howtomarketagame.com, acorngames.gg 2025, presskit.gg). Alles Erfahrungsberichte, keine Garantie – darum testen und in `log.md` vergleichen.
- **1 Sekunde entscheidet:** Das erste Bild muss schon die Pointe oder die Frage zeigen – kein Logo, kein Menü, kein langsamer Aufbau. Gute Einstiege: Challenge-Frage („Schaffst DU das?“), schneller Witz-Aufbau, mitten in der Action, „das kaputte/peinliche zuerst“.
- **Kurz und als Schleife:** 8–12 s bleibt unser Standard; das letzte Bild so schneiden, dass es nahtlos in das erste übergeht (Wiederholungen zählen wie neue Aufrufe). Die Endkarte kurz halten (≤ 2 s) und groß, Link und Name 3 s lesbar.
- **Weniger Hochglanz, mehr echt:** Bei anderen liefen schlichte Bildschirmaufnahmen mit klarem Text besser als aufwendige Trailer. Lieber ein lustiger echter Moment (Fail, Glitch-artiger Zufall, knapper Sieg) als ein Feature-Überblick.
- **Was bei uns lief (Stand 09.11.):** die „Ich nach 5 Minuten vs. 50 Stunden“-, „POV: Mythisch!“- und Update-Clips (8–11 Aufrufe) – nachvollziehbare Spieler-Momente mit POV/Vorher-Nachher. Davon mehr.
- **Serien statt Einzelclips:** wiederkehrende Formate mit Wiedererkennung, z. B. „Der Schatzgoblin, Folge n“, „Boss-Kodex Rang x“, „Jede Klasse in 10 s“, eine Figur als Gesicht des Kanals (Ritterin + Jungdrache).
- **Kommentare als Motor:** offene Fragen stellen, die man gern beantwortet („Welche Klasse?“, „Welcher Boss soll als Nächstes?“). Jede Antwort schnell geben. Wenn ein Kommentar eine gute Idee/Frage hat, am nächsten Tag ein Antwort-Video dazu machen (nur mit echtem Gameplay).
- **Nachlegen, wenn etwas läuft:** Bekommt ein Clip deutlich mehr Aufrufe als die anderen, am nächsten Tag einen Folge-Clip im selben Format; ein leicht neu geschnittener Clip desselben Moments kann ein zweites Mal laufen.
- **Gleiche Uhrzeit:** feste Postzeit beibehalten (18:12 Berlin), damit Vergleiche fair sind; Uhrzeit erst nach 2 Wochen Daten ändern.
- **Nichts löschen:** schwache Videos stehen lassen – wer das Profil findet, schaut die alten mit.
- **Keine Trend-Jagd um jeden Preis:** Trend-Formate nur, wenn das Spiel selbst die Pointe ist; Trend-Zuschauer interessieren sich sonst nur für den Trend.

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
