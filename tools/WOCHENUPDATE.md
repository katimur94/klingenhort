# Wöchentliches Update – Ablauf

Jede Woche entsteht ein neues, getestetes Update, geht live und bekommt einen TikTok-Clip. Diese Anleitung ist für den geplanten Claude-Auftrag geschrieben, gilt aber genauso für Menschen.

**Während des Laufs fragt niemand zurück.** Im Zweifel die kleinere, sichere Variante bauen und im Bericht erklären.

---

## 0. Vorbereitung

- Repo `katimur94/klingenhort`, Arbeitsverzeichnis ist die Repo-Wurzel. Mit dem neuesten Stand beginnen: `git fetch origin main gh-pages` und auf `origin/main` aufsetzen.
- Live-Seite: https://katimur94.github.io/klingenhort/ – GitHub Pages aus dem Branch `gh-pages`. `main` und `gh-pages` zeigen immer auf denselben Stand.
- Werkzeuge: `bash tools/promo/fonts.sh` einmal ausführen (Schriften für den Clip).

## 1. Thema der Woche

1. In `ROADMAP.md`, Tabelle „Plan“: die **erste Zeile mit Status „offen“** (oder „teilweise“) ist das Thema.
2. Dazu ein bis zwei Punkte aus „Handy-Feinschliff“ ohne ✅ – klein halten.
3. Passt das Thema nicht in einen Lauf: den Kern bauen, Status „teilweise“ setzen und notieren, was fehlt.
4. Sind alle Wochen erledigt: aus dem Ideenspeicher eine neue Woche planen, in die Tabelle schreiben und umsetzen.

## 2. Umsetzen

- Reines HTML und JavaScript, keine Abhängigkeiten, kein Build-Schritt. Inhalte sind Daten in `js/data.js`, Texte in `js/story.js`.
- Spieltexte auf Deutsch, im Ton des Spiels – im Code immer als `_t('Text')` bzw. `_t('Text mit {x}', { x })`, neue Datenfelder in `translateData()` (`js/i18n.js`) eintragen. Regeln: `tools/i18n/README.md`.
- **Jeder neue Text in alle Sprachen** (Englisch, Türkisch, Spanisch, Italienisch, Französisch): `node tools/i18n/check.js --todo /tmp/i18n`, die leeren Werte in `/tmp/i18n/<sprache>.json` übersetzen (Begriffe wie in der vorhandenen Sprachdatei), dann `node tools/i18n/merge.js <sprache> /tmp/i18n/<sprache>.json`. Das gilt auch für Neuigkeiten (`CHANGELOG`, `COMING`) und Wochen-Ereignisse.
- **Alte Spielstände müssen laden:** neue Felder immer mit Standardwert ergänzen (`fixMeta`, `activateChar`).
- **Handy zuerst:** Hoch- und Querformat, Touch-Ziele mindestens 44 px, Zurück/Hauptaktion in der Kopfleiste (`.head` mit `.hbtns`) oder Fußleiste (`.foot`), Listen mit Details nebeneinander (`.split` + `.side.sheet`).
- Größere neue Systeme in eine eigene Datei `js/<system>.js` und über `HOOK`/`ON` (siehe `js/core.js`) andocken, statt Kern-Dateien umzubauen. Vorhandene Systeme: Begleiter & Brutnest (`pets.js`), Elemente (`elements.js`), Schmiede (`forge.js`), Meisterschaft (`mastery.js`), Tauschen/Aussehen (`trade.js`), Aussehen der Beute & Auren (`auras.js`), Verlorene Lande (`lande.js`), Basar (`market.js`) – neue Inhalte dort ergänzen (z. B. neue Kreatur, neues Bauteil, neue Weltstufe oder Freiwelt-Gegend). Der Basar läuft offline über das Objekt `MARKET`; für den Online-Basar (7.0) wird nur diese Schnittstelle durch einen Server ersetzt.
- Neue Skripte in `index.html` laden und in `sw.js` (`SHELL`) eintragen.
- Für das neue System einen eigenen Test `tools/test/<system>.js` anlegen und in `tools/test/run.sh` eintragen.
- Code im Stil des umgebenden Codes: kompakt, kurze deutsche Kommentare.

## 3. Version, Neuigkeiten, Doku

- `VERSION` in `js/data.js` **und** `sw.js` anheben: neues Feature = Minor (4.2.0 → 4.3.0), nur Korrekturen = Patch.
- `js/news.js`: neuen Eintrag **oben** in `CHANGELOG` (`v`, `d` = heutiges Datum, `t` = kurzer Titel, `items` mit `neu` / `besser` / `fix`). Aus Spielersicht schreiben, keine Technik. `COMING`: diese Woche entfernen, die übernächste aus der Roadmap hinten anfügen (immer vier Einträge, Form `['4.6', 'Text']`).
- `ROADMAP.md`: Status der Woche auf „✅ 4.x“, erledigte Handy-Punkte mit ✅ markieren.
- `README.md`: im Abschnitt „Neuigkeiten & Wochenplan“ den Block „Neu in …“ ersetzen, betroffene Abschnitte ergänzen (z. B. Gegner, Steuerung), Versionszeile oben anpassen.

## 4. Testen

- `bash tools/test/run.sh` muss **„ALLE TESTS GRÜN“** melden (prüft Handy hoch/quer, iPhone, TikTok-Browser, alte Spielstände aus der Live-Version, alle Bildschirme, jede Sprache: nichts fehlt, kein Deutsch auf dem Bildschirm).
- Für das neue Feature eigene Prüfungen ergänzen: Spielregeln in `tools/test/rules.js` (z. B. Belohnung stimmt, Wirkung greift), Bedienung mit Antippen in `tools/test/flows.js` (z. B. neues Menü öffnet sich, neue Station funktioniert).
- Die Screenshots in `/tmp/klingenhort-test/screens-hoch`, `-quer`, `-pc` und eigene Screenshots der neuen Bildschirme **ansehen**: abgeschnittener Text? Knöpfe erreichbar? Sieht es gut aus? Neue Bildschirme auch in einer zweiten Sprache ansehen (`/tmp/klingenhort-test/lang-tr` – Türkisch und Französisch sind oft am längsten).
- Bleibt ein Test rot und lässt sich nicht beheben: **nicht live stellen** (siehe Abschnitt 7).

## 5. Veröffentlichen

1. Commit mit deutscher Nachricht, auf den Arbeits-Branch pushen.
2. Live stellen – nur bei grünen Tests: `git fetch origin main gh-pages`; wenn `origin/main` und `origin/gh-pages` Vorfahren von `HEAD` sind: `git push origin HEAD:main HEAD:gh-pages`. Sonst zuerst `origin/main` hereinmergen und die Tests wiederholen.
3. Prüfen: `curl -s https://katimur94.github.io/klingenhort/js/data.js | grep VERSION` zeigt nach 1–3 Minuten die neue Version.

## 6. TikTok-Clip

- Ablauf in `tools/promo/README.md`. Vorlage nach `tools/promo/updates/<version>/` kopieren, die Szenen `feature1` und `feature2` auf das **neue Feature im echten Spiel** umbauen, Texte unter ANPASSEN schreiben.
- 12–20 Sekunden. Erstes Bild: Action und großer Text.
- Vor dem Kodieren `sheet.jpg` und einzelne Bilder ansehen.
- Das Video an den Nutzer schicken (SendUserFile, status „proactive“) – **nicht** ins Repo. Die Dateien unter `updates/<version>/` committen und mit veröffentlichen.

## 7. Bericht an den Nutzer

Kurz und auf Deutsch:
- Was ist neu (aus Spielersicht), Version, Link zur Live-Seite
- Das Video (angehängt) und ein Vorschlag für die TikTok-Beschreibung mit Hashtags
- Was nicht geklappt hat; falls nicht live: warum, und was als Nächstes passiert
- Was nächste Woche kommt

## Wenn etwas schiefgeht

- Fehler nach dem Live-Gang entdeckt: mit `git revert` zurücknehmen, wieder auf `main` und `gh-pages` pushen, im Bericht erklären.
- Live-Seite lädt nicht: genauso zurücknehmen.
