# Klingenhort – Wochenplan

Ziel: **Jede Woche ein spürbares Update**, damit Klingenhort nie „durchgespielt“ ist. Jedes Update bekommt eine Versionsnummer, einen Eintrag in den Neuigkeiten im Spiel und einen kurzen Clip für TikTok.

**Automatisch:** Ein geplanter Claude-Auftrag arbeitet diesen Plan jede Woche ab – nach der Anleitung in [`tools/WOCHENUPDATE.md`](tools/WOCHENUPDATE.md). Er nimmt die erste Woche mit Status „offen“, baut und testet sie, stellt sie live und schickt den TikTok-Clip. Reihenfolge ändern: einfach die Tabelle unten umsortieren oder Zeilen umschreiben.

---

## So läuft ein Wochen-Update

Ausführlich für den automatischen Lauf: [`tools/WOCHENUPDATE.md`](tools/WOCHENUPDATE.md). Kurzfassung:

1. **Auswählen:** ein großes Thema aus dem Plan unten plus ein bis zwei Handy-Verbesserungen aus der Liste weiter unten
2. **Bauen und auf dem Handy ansehen:** Hoch- und Querformat, kleines Handy (z. B. iPhone SE) und großes Handy
3. **Testen:** `bash tools/test/run.sh` muss grün sein
4. **Version anheben:** `VERSION` in `js/data.js` und `sw.js` (Feature: 4.2.0, kleine Korrektur: 4.2.1)
5. **Neuigkeiten schreiben:** oben in `CHANGELOG` (`js/news.js`) einen Eintrag mit `neu` / `besser` / `fix`, dann `COMING` um eine Woche weiterschieben
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
| 1 | 4.2 | **Wochen-Ereignisse** | Automatisch nach Kalenderwoche: *Goldrausch* (+50 % Gold), *Blutmond* (doppelt so viele Elite-Gegner, bessere Beute), *Drachenwoche* (mehr Schuppen, Jungdrachen überall), *Glückswoche* (Glücksrad ein Gratis-Dreh pro Tag), *Schmiedewoche* (Aufwerten günstiger). Banner im Titelmenü und auf der Karte | klein | ✅ 4.2 |
| 2 | 4.3 | **Aufträge** | 3 Tagesaufträge (z. B. „Besiege 40 Untote“, „Verschmelze einen Gegenstand“) und 1 Wochenauftrag. Auftragstafel als neue Station im Versteck. Belohnung: Gold, Materialien, Glücksmünzen | mittel | offen |
| 3 | 4.4 | **Neues Gebiet: Sturmgipfel** | Gebiet 9 mit Blitz-Effekten, 4 neue Gegner (Harpyie, Sturmgolem, Donnerschamane, Greif), Boss *Sturmkönig Aerok* mit Blitz-Phasen, neues Material *Sturmsilber* | groß | offen |
| 4 | 5.0 | **Saison 1** | Saison-Helden starten bei Level 1, eigene Saison-Rangliste (lokal: bester Akt, höchste Qual, schnellster Boss), **kostenloser Saison-Pass** mit 30 Stufen (Kosmetik, Titel, Glücksmünzen). Nach 6 Wochen wandern Saison-Helden zu den normalen Helden | groß | offen |
| 5 | 5.1 | **Begleiter** | Haustiere aus Eiern (Truhen, Bosse): Mini-Drache, Geisterkatze, Goldkäfer. Sie sammeln Beute ein, leveln mit und haben je einen kleinen Effekt | mittel | offen |
| 6 | 5.2 | **Der Abgrund** | Endlos-Turm: Ebene für Ebene stärker, 3 Minuten pro Ebene, Bestwert pro Klasse in der Ruhmeshalle. Belohnung steigt mit der Ebene | mittel | offen |
| 7 | 5.3 | **Neue Klasse: Nekromant** | Beschwört Skelette, Knochenspeer, Leichenexplosion, Ultimative *Armee der Toten*. Eigener Talentbaum, eigene Waffen (Sense, Knochenstab) | groß | offen |
| 8 | 5.4 | **Legendäre Kräfte 2.0** | 12 neue legendäre Effekte, die Fähigkeiten verändern (z. B. Feuerball teilt sich, Wirbelklinge zieht Gegner an). Sets mit 4 Teilen und Ring/Amulett als neue Plätze | mittel | offen |
| 9 | 5.5 | **Verzaubern & Waffen-Skins** | Einen Zusatzwert gezielt neu würfeln (Verzauberer im Versteck). Waffen-Aussehen übertragen (Transmog) | mittel | offen |
| 10 | 5.6 | **Weltboss der Woche** | Ein riesiger Boss mit 3 Phasen, nur diese Woche. Schaden-Bestwert, eigene Belohnung (Trophäe fürs Versteck) | mittel | offen |
| 11 | 5.7 | **Versteck 2.0** | Dekorieren: Trophäen von Bossen, Banner, Teppiche, Pflanzen. Gästebuch-Code: Versteck als Code teilen und das von Freunden ansehen | mittel | offen |
| 12 | 6.0 | **Saison 2 + Online-Rangliste** | Neue Saison-Regel (z. B. „nur Hardcore“ oder „doppelte Geschwindigkeit“). Optional eine echte Online-Rangliste (braucht einen kleinen Server, z. B. Supabase) | groß | offen |

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
- **Englische Sprache** – vervielfacht die Reichweite auf TikTok

---

## Ideenspeicher

**Kämpfe:** Gegner-Affixe der Woche · Mini-Bosse in normalen Räumen · Fallenräume · Escort-Räume (Gefangenen beschützen) · Kopfgeldjagd auf benannte Gegner · Combo-Finisher mit Zeitlupe

**Beute:** Runen, die Fähigkeiten verändern · Uralte Gegenstände (noch seltener als Mythisch, nur in hohen Qual-Stufen) · Gegenstand der Woche beim Händler

**Versteck:** Kartograph (Karten-Modifikatoren kaufen) · Arena mit Wellen-Herausforderungen · Haustierstall · Brunnen der Wünsche (Münzen opfern)

**Geschichte:** Nebenquests von NPCs im Versteck · Tagebuch-Seiten pro Gebiet · Geheime Räume auf der Karte · Zweites Kapitel nach Pyraxis

**Gemeinschaft:** Wochen-Code: alle spielen dieselbe Karte · Bestwerte als Bild teilen (für TikTok) · Fan-Wünsche aus den Kommentaren als „Community-Update“ des Monats

---

## Erfolg messen (ohne Daten zu sammeln)

- **TikTok-Kommentare und Aufrufe** pro Update-Clip – welches Feature kommt am besten an?
- **Kurzumfrage im Spiel** (ein Knopf in den Neuigkeiten: „Was wünschst du dir?“ öffnet eine Vorlage für einen Kommentar)
- Optional später: datensparsame Besucherzählung der Seite, ohne Cookies
