# Sprachen

Klingenhort gibt es auf **Deutsch, Englisch, Türkisch, Spanisch, Italienisch und Französisch**. Deutsch ist der Ausgangstext und zugleich der Schlüssel: Jeder sichtbare Text steht im Code als `_t('Deutscher Text')`, die Übersetzungen liegen in `js/lang/<sprache>.js`. Fehlt eine Übersetzung, erscheint der deutsche Text.

Die Sprache kommt aus der gespeicherten Wahl (Titelmenü und Einstellungen: 🌐), sonst aus der Sprache des Geräts, sonst Englisch.

## Texte im Code

```js
_t('Zurück')                                   // einfacher Text
_t('Du hast {n} Gold gefunden', { n })         // Platzhalter statt zusammengesetzter Teile
n === 1 ? _t('1 Gegenstand') : _t('{n} Gegenstände', { n })
```

- Das erste Argument ist **immer ein fester Text in einfachen Anführungszeichen** – keine Template-Strings, kein `+`. Nur so findet das Werkzeug den Text.
- Ganze Sätze bleiben zusammen (Satzbau ist in jeder Sprache anders). HTML möglichst außerhalb: `` `<h2>${_t('EINSTELLUNGEN')}</h2>` ``.
- Nicht `T` verwenden – `T` ist die Spielzeit.
- Spieldaten in `js/data.js`, `js/story.js`, `js/news.js`, `js/weekly.js` (Namen, Beschreibungen, Changelog …) übersetzt `translateData()` in `js/i18n.js` beim Start – dort neue Felder eintragen.
- Namen, die im Spielstand landen (Legenden, Set-Teile, Mythisch, Zusätze wie „der Präzision“), bleiben deutsch gespeichert und werden beim Anzeigen übersetzt (`itemName()`, `savedNames()`).
- Feste Texte in `index.html`: `data-t="…"` (Inhalt) oder `data-ta="…"` (aria-label).

## Werkzeuge

```bash
node tools/i18n/check.js                       # Bericht: was fehlt, was ist fehlerhaft
node tools/i18n/check.js --todo /tmp/i18n      # fehlende Texte je Sprache als JSON (+ orte.json: wo sie stehen)
node tools/i18n/merge.js en /tmp/i18n/en.json  # ausgefüllte Übersetzungen übernehmen
node tools/i18n/merge.js en --prune            # nicht mehr benutzte Texte entfernen
```

`merge.js` lehnt Übersetzungen ab, deren Platzhalter `{x}` oder HTML-Tags nicht zum Original passen.

## Jede Woche

1. Neue Texte mit `_t()` schreiben.
2. `node tools/i18n/check.js --todo /tmp/i18n` – für jede Sprache die leeren Werte in `/tmp/i18n/<sprache>.json` ausfüllen (Ton des Spiels, Begriffe wie in der vorhandenen Sprachdatei, kurz bei Knöpfen), dann `merge.js` je Sprache.
3. `bash tools/test/run.sh` prüft jede Sprache: nichts fehlt, kein Deutsch auf dem Bildschirm (`/tmp/klingenhort-test/lang-<sprache>/deutsch.txt`), Screenshots zum Ansehen in `/tmp/klingenhort-test/lang-<sprache>/`.

## Übersetzen – Regeln

- Platzhalter `{x}`, HTML-Tags, Symbole (★ ◇ ✦ ◆ ›) und Zahlen unverändert übernehmen.
- Eigennamen (Klingenhort, Pyraxis, Varkas …) behalten; Umlaute in Namen für andere Sprachen auflösen (Ätherium → Aetherium).
- Großschreibung wie im Original (Überschriften und Knöpfe oft in GROSSBUCHSTABEN; Türkisch mit İ/I richtig).
- Den Spieler duzen (tú, tu, sen).
- Knöpfe und kurze Bezeichnungen höchstens so lang wie das Deutsche – die Pixelschrift ist breit.
