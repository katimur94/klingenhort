# Klingenhort – Wochenplan

Ziel: **Jede Woche ein spürbares Update**, damit Klingenhort nie „durchgespielt“ ist. Jedes Update bekommt eine Versionsnummer, einen Eintrag in den Neuigkeiten im Spiel und einen kurzen Clip für TikTok.

**Automatisch:** Ein geplanter Claude-Auftrag arbeitet diesen Plan jede Woche ab – nach der Anleitung in [`tools/WOCHENUPDATE.md`](tools/WOCHENUPDATE.md). Er nimmt die erste Woche mit Status „offen“, baut und testet sie, stellt sie live und schickt den TikTok-Clip. Reihenfolge ändern: einfach die Tabelle unten umsortieren oder Zeilen umschreiben.

---

## So läuft ein Wochen-Update

Ausführlich für den automatischen Lauf: [`tools/WOCHENUPDATE.md`](tools/WOCHENUPDATE.md). Kurzfassung:

1. **Auswählen:** ein großes Thema aus dem Plan unten plus ein bis zwei Handy-Verbesserungen aus der Liste weiter unten
2. **Bauen und auf dem Handy ansehen:** Hoch- und Querformat, kleines Handy (z. B. iPhone SE) und großes Handy
3. **Testen:** `bash tools/test/run.sh` muss grün sein
4. **Version anheben:** `VERSION` in `js/data.js` und `sw.js` (Feature: 4.4.0, kleine Korrektur: 4.4.1)
5. **Neuigkeiten schreiben:** oben in `CHANGELOG` (`js/news.js`) einen Eintrag mit `neu` / `besser` / `fix`, dann `COMING` um eine Woche weiterschieben. Alle neuen Texte in die fünf anderen Sprachen übersetzen (`tools/i18n/README.md`)
6. **Live stellen:** auf `main` und `gh-pages` pushen. Die installierte App holt sich das Update selbst, im Titelmenü erscheint „NEU“
7. **Zeigen:** 12–20 Sekunden Clip vom neuen Feature für TikTok (`tools/promo`, Vorlage `tools/promo/update`)

---

## Die fünf Säulen für „endlos“

| Säule | Was es bringt |
|---|---|
| **Wochen-Ereignisse** | Jede Woche andere Regeln – ein Grund, diese Woche zu spielen |
| **Aufträge** | Täglich und wöchentlich kleine Ziele mit Belohnung – ein Grund, *heute* zu spielen |
| **Saisons** | Alle 6 Wochen Neustart-Wettbewerb mit eigenen Belohnungen – ein Grund, *wieder von vorn* zu spielen |
| **Endlos-Modus (Abgrund)** | Keine Obergrenze, Bestwert schlagen – ein Grund, *weiter* zu spielen |
| **Neue Inhalte** | Gebiete, Bosse, Klassen, Gegenstände – ein Grund, *neugierig* zu bleiben |

---

## Plan für 12 Wochen

| Woche | Version | Thema | Inhalt | Aufwand | Status |
|---|---|---|---|---|---|
| 1 | 4.2 | **Wochen-Ereignisse** | Automatisch nach Kalenderwoche: *Goldrausch*, *Blutmond*, *Drachenwoche*, *Glückswoche*, *Schmiedewoche*. Banner im Titelmenü und auf der Karte | klein | ✅ 4.2 |
| – | 4.3 | **Sechs Sprachen** | Deutsch, Englisch, Türkisch, Spanisch, Italienisch, Französisch. Sprache des Geräts beim Start, Auswahl im Titelmenü und in den Einstellungen | mittel | ✅ 4.3 |
| – | 5.0 | **Meisterwerk** | Begleiter (6 Arten, Level 1–100, 6 Entwicklungsstufen), Elemente (Schwächen und Resistenzen), Schmiede der Meister (Bauteile Stufe 1–10, Zerlegen, Meisterwerke, Schmiedemeisterschaft 1–100), Fähigkeiten-Meisterschaft (Level 1–50, 6 Ränge mit neuem Aussehen), Tauschen per Code/Link, Tauschhändler, Aussehen tauschen (Sammlung) | sehr groß | in Arbeit |
| 2 | 5.1 | **Aufträge** | 3 Tagesaufträge und 1 Wochenauftrag, auch für Begleiter, Meisterschaft und Schmiede („Zerlege 20 Gegenstände“, „Besiege 30 Gegner mit Schwäche-Treffern“). Auftragstafel im Versteck. Belohnung: Bauteile, Eier, Glücksmünzen | mittel | offen |
| 3 | 5.2 | **Neues Gebiet: Sturmgipfel** | Gebiet 9 mit Blitz-Gegnern (Harpyie, Sturmgolem, Donnerschamane, Greif), Boss *Sturmkönig Aerok* mit Blitz-Phasen, neues Material *Sturmsilber*, Blitz-Elementkerne | groß | offen |
| 4 | 6.0 | **Saison 1** | Saison-Helden ab Level 1, Saison-Rangliste (lokal), **kostenloser Saison-Pass** mit 30 Stufen (Kosmetik, Titel, Eier, Bauteile). Nach 6 Wochen wandern Saison-Helden zu den normalen | groß | offen |
| 5 | 6.1 | **Begleiter-Expeditionen & Zucht** | Begleiter auf Expedition schicken (läuft auch, wenn das Spiel zu ist), zwei Begleiter kreuzen → neue Farben und seltene Mischformen, Begleiter-Rangliste | mittel | offen |
| 6 | 6.2 | **Der Abgrund** | Endlos-Turm: Ebene für Ebene stärker, 3 Minuten pro Ebene, Bestwert pro Klasse in der Ruhmeshalle | mittel | offen |
| 7 | 6.3 | **Neue Klasse: Nekromant** | Beschwört Skelette, Knochenspeer, Leichenexplosion, Ultimative *Armee der Toten*, eigener Talentbaum, eigene Waffen, Meisterschaft für alle neuen Fähigkeiten | groß | offen |
| 8 | 6.4 | **Runenwörter & Legendäre Kräfte 2.0** | Runen in Sockeln ergeben in der richtigen Reihenfolge Runenwörter mit starken Effekten. 12 neue legendäre Kräfte, die Fähigkeiten verändern | mittel | offen |
| 9 | 6.5 | **Verzaubern & Element-Reaktionen** | Einen Zusatzwert gezielt neu würfeln. Elemente kombinieren: Feuer auf gefrorene Gegner = Dampfexplosion, Blitz auf vergiftete = Giftwolke | mittel | offen |
| 10 | 6.6 | **Weltboss der Woche** | Riesiger Boss mit 3 Phasen, nur diese Woche, Schaden-Bestwert, Trophäe fürs Versteck | mittel | offen |
| 11 | 6.7 | **Versteck 2.0** | Dekorieren mit Trophäen, Bannern, Pflanzen; Begleiter-Nest; Versteck als Code teilen | mittel | offen |
| 12 | 7.0 | **Saison 2 + Online** | Neue Saison-Regel. Echte Online-Rangliste und Marktplatz zum Handeln (braucht einen kleinen Server, z. B. Supabase) | groß | offen |

> Faustregel: Wochen mit „groß“ wechseln sich mit kleinen und mittleren ab. Fällt eine Woche aus, lieber ein kleines Update als gar keins – Ereignisse und Aufträge laufen ab Woche 2 auch ohne neue Inhalte weiter.

---

## Handy-Feinschliff (jede Woche ein bis zwei davon)

Schon erledigt in 4.1: Hochformat, klebende Kopf- und Fußleisten, Liste neben Details, größere Ziele, Neuigkeiten-Seite.

- ✅ **Schriftgröße** in den Einstellungen (normal / groß) – 4.2
- **Leistungs-Modus:** weniger Partikel, kein Licht-Effekt, 30 fps – für ältere Handys und Akku
- **Einhand-Modus** im Hochformat: Auto-Angriff, wenn ein Gegner in Reichweite ist; nur Joystick und Fähigkeiten
- **Schnell-Ausrüsten:** „Bestes anlegen“-Knopf im Charakter und „Alles Schlechtere verkaufen“
- **Beute-Filter:** Gewöhnliche Gegenstände automatisch verkaufen oder liegen lassen
- **Lange drücken für Infos** auf Fähigkeiten, Materialien und Talente statt Text zu suchen
- **Wisch-Gesten** zwischen den Reitern (Ausrüstung → Talente → Vorrat)
- **Farbenblind-Modus** für Seltenheitsfarben (zusätzliche Symbole)
- ✅ **Bildschirm-Wackeln und Blitzen** abschaltbar – 4.2
- **Haptik-Stärke** einstellbar
- **Spielstand in der Cloud** (Code per Link teilen statt kopieren)
- ✅ **Sechs Sprachen** (Englisch, Türkisch, Spanisch, Italienisch, Französisch, Deutsch) – 4.3
- **Auto-Zerlegen:** Gewöhnliche und magische Beute automatisch in Bauteile zerlegen

---

## Langzeitziele – warum Klingenhort Tausende Stunden trägt

| Ziel | Umfang | grob |
|---|---|---|
| Helden-Level 1–50, dann Paragon ohne Obergrenze | 4 Klassen, Wiedergeburt | Hunderte Stunden je Klasse |
| Qual-Stufen | ohne Obergrenze | endlos |
| Begleiter Level 1–100 | 6 Arten × 6 Entwicklungsstufen × Farben, schillernde Varianten | Hunderte Stunden je Begleiter |
| Fähigkeiten-Meisterschaft 1–50 | 16 Fähigkeiten (bald 20), 6 Ränge | Hunderte Stunden je Klasse |
| Schmiedemeisterschaft 1–100 | Bauteile bis Stufe 10 (3 → 1, eine göttliche Klinge = 19 683 rohe) | Tausend Stunden und mehr |
| Sammlung: Aussehen, Bestiarium, Chronik, Erfolge, Kosmetik | Hunderte Einträge | lang |

Jedes System zeigt immer das nächste Ziel und einen Fortschrittsbalken – der Spieler weiß jederzeit, wofür er spielt.

## Ideenspeicher

**Kämpfe:** Gegner-Affixe der Woche · Mini-Bosse in normalen Räumen · Fallenräume · Escort-Räume (Gefangenen beschützen) · Kopfgeldjagd auf benannte Gegner · Combo-Finisher mit Zeitlupe

**Beute:** Runen, die Fähigkeiten verändern · Uralte Gegenstände (noch seltener als Mythisch, nur in hohen Qual-Stufen) · Gegenstand der Woche beim Händler

**Versteck:** Kartograph (Karten-Modifikatoren kaufen) · Arena mit Wellen-Herausforderungen · Haustierstall · Brunnen der Wünsche (Münzen opfern)

**Geschichte:** Nebenquests von NPCs im Versteck · Tagebuch-Seiten pro Gebiet · Geheime Räume auf der Karte · Zweites Kapitel nach Pyraxis

**Begleiter:** Expeditionen (offline) · Zucht und Mischformen · Begleiter-Arena · Begleiter-Kostüme · zweiter Begleiter-Platz ab Paragon 100

**Berufe:** Bergbau, Kräuterkunde und Angeln im Versteck · Kochen (Mahlzeiten als Buffs) · Erbstücke, die mit dem Helden mitwachsen

**Gemeinschaft:** Wochen-Code: alle spielen dieselbe Karte · Bestwerte als Bild teilen (für TikTok) · Fan-Wünsche aus den Kommentaren als „Community-Update“ des Monats

---

## Erfolg messen (ohne Daten zu sammeln)

- **TikTok-Kommentare und Aufrufe** pro Update-Clip – welches Feature kommt am besten an?
- **Kurzumfrage im Spiel** (ein Knopf in den Neuigkeiten: „Was wünschst du dir?“ öffnet eine Vorlage für einen Kommentar)
- Optional später: datensparsame Besucherzählung der Seite, ohne Cookies
