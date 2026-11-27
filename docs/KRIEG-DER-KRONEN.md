# Krieg der Kronen – die große Erweiterung (Bauplan)

Wunsch des Besitzers (15.11.2026): ein Update wie ein DLC – Gebiete im Dauerkrieg (Pfeilhagel, Katapulte, Magiehagel), mehrere verfeindete Königreiche, eine Story, die man auch in 1000 Stunden nicht zu Ende bekommt, bessere Grafik, Premium-Anspruch, eigene Ideen. Arbeitsweise: jedes Kapitel kritisch prüfen, bevor es live geht.

Versionsregel bleibt: jede Woche +0.1. Die Erweiterung kommt deshalb in **Kapiteln** (6.6, dann 6.8 → 7.3; 6.7 ist „Saison 1“). Jedes Kapitel ist für sich spielbar und fertig.

## Die Welt
Fünf Kronen streiten um den **Splitterthron** (das Weltentor hat das alte Reich zerbrochen):

| Reich | Farbe | Stil | Kriegsmaschine | Besonderheit |
|---|---|---|---|---|
| **Aurelien** (Sonnenkrone) | Gold/Weiß | Ritter, Paladine | Katapulte, Schildwälle | starke Verteidigung, Heilung |
| **Nordmark** (Eisenkrone) | Blau/Stahl | Axtkämpfer, Wolfsreiter | Ballisten, Rammböcke | Wucht, Frost |
| **Sylvara** (Dornenkrone) | Grün | Waldläufer, Druiden | Pfeilhagel, Dornenranken | Fernkampf, Gift |
| **Karth** (Aschekrone) | Rot/Schwarz | Feuermagier, Söldner | Magiehagel (Meteore) | Flächenschaden |
| **Das Schattenkonzil** (Hohle Krone) | Violett | Assassinen, Beschwörer | Schattenrisse | Verrat, Hinterhalte – der heimliche Gegenspieler |

Der Spieler ist **Söldner ohne Krone**: Er kann jedem Reich dienen, wechseln, verraten – das hat Folgen (Ruf, Kopfgeld, wer ihn angreift, welche Händler ihn bedienen).

## Kernsysteme
1. **Kriegsgebiete** (neue Raumart und Biome in den Endlosen Landen): laufende Schlacht zweier Heere, die auch ohne den Spieler kämpfen. Angekündigter Beschuss: Pfeilhagel (Schatten am Boden, dann Einschlag), Katapultsteine (großer Kreis, Krater bleibt), Magiehagel (Meteore, brennender Boden), Ballistenbolzen (Linie). Deckung (Schildwälle, Wagen, Gräben) schützt wirklich. Ziele: Linie halten, Katapult erobern/zerstören, Bannerträger schützen, Hauptmann besiegen, Tor aufbrechen.
2. **Die Kriegskarte**: ~60 Provinzen, jede gehört einem Reich. Die Fronten verschieben sich in Echtzeit (auch offline, wie der Basar), abhängig von Stärke – und vom Spieler. Jede gewonnene Schlacht zählt. Kein Reich kann ganz verschwinden (Rückzugsfestung), damit der Krieg nie endet.
3. **Kriegsruf & Ränge** je Reich (Söldner → Hauptmann → Marschall → Kronfeldherr), eigene Ausrüstungs-Sets, Banner, Wappen, Reittier-Kosmetik, Titel. Baut auf den Fraktionen aus 6.3 auf.
4. **Die Chronik** (Story): geschriebene Hauptgeschichte in Akten je Reich + große Wendungen (Verrat des Konzils, der wahre Erbe, das Tor). Danach und dazwischen **Kriegsjahre**: endlose, aus der Kriegslage erzeugte Feldzüge (Belagerung, Entsatz, Überfall, Geleit, Duell der Feldherren) mit steigender Stufe. Ehrlich: 1000 Stunden *geschriebene* Geschichte gibt es nicht – die Dauer kommt aus dem lebendigen Krieg, den Entscheidungen und den fünf Blickwinkeln. Die geschriebene Chronik wächst mit jedem Kapitel.
5. **Entscheidungen mit Folgen**: Gefangene, Verrat, Bündnisse – gespeichert, später aufgegriffen (Figuren erinnern sich).
6. **Eigene Ideen**: Belagerungen in drei Phasen (Mauer, Hof, Thronsaal); **Feldherren** als wiederkehrende Rivalen, die aufsteigen, wenn sie dich besiegen; **Kriegsbeute** (Banner erobern → Trophäen im Versteck); **eigenes Banner** gestalten; **Söldnertrupp** (Begleiter + angeworbene Kämpfer); Wetter und Tageszeit auf dem Schlachtfeld.

## Grafik (Premium-Schliff, über alle Kapitel)
Dynamisches Licht (Fackeln, Feuer, Zauber werfen Licht), weiche Schatten unter allem, Wetter (Regen, Schnee, Asche, Nebel), Rauch und Glut, Kamera-Wucht bei Einschlägen, Schlachtfeld-Kulissen (Banner im Wind, Zelte, Palisaden, Krater, liegende Schilde), größere Figuren-Vielfalt je Reich (eigene Farben/Wappen), Porträts in Dialogen, neue Titel- und Kartenbilder. Muss auf dem Handy flüssig bleiben – Stufen über die Grafik-Einstellung.

## Kapitel (je eine Woche, Reihenfolge = ROADMAP)
- ✅ **6.6 Kapitel 1 – Die Front**: Kriegsgebiete als Raumart + 3 Kriegs-Biome in den Landen, Beschuss (Pfeil, Katapult, Magie), Deckung, zwei kämpfende Heere (Aurelien vs. Karth), 4 Schlacht-Ziele, Prolog der Chronik, Grafik: Licht, Rauch, Krater, Banner.
- ✅ **6.8 Kapitel 2 – Fünf Kronen**: Nordmark und Sylvara an der Front (Einheiten, Hauptleute Ragna und Eryn, Balliste als neuer Beschuss 'bolzen'), Fronten je Kriegsgebiet (`KR_FRONT`, `krFront`), Seite wählen und wechseln (Kriegsruf-Verlust beim Gegner, `KR_VERRAT`), Rang-Vorteile (`KR_VORTEIL`), Chronik Akt 1 je Reich (`KR_AKT1`, gelesen in `ch`). Noch offen aus dem Plan: Reichs-Sets (Ausrüstung je Reich) – kommen mit Kapitel 6 „Dein Banner“; das Schattenkonzil kämpft ab 7.1.
- **6.9 Kapitel 3 – Die Kriegskarte** ✅: Provinzen, wandernde Fronten (auch offline), Feldzüge, Kriegsjahre (endlos).
- **7.0 Kapitel 4 – Belagerung**: Burgen in drei Phasen, Rammbock, Mauern, Feldherren als Rivalen.
- **7.1 Kapitel 5 – Verrat**: das Schattenkonzil, Entscheidungen mit Folgen, Chronik Akt 2, Wetter/Tageszeit.
- **7.2 Kapitel 6 – Dein Banner**: Söldnertrupp, eigenes Banner, Trophäen, Chronik Akt 3.
- **7.3 Kapitel 7 – Der Splitterthron**: großes Finale der geschriebenen Chronik (mehrere Enden), danach Kriegsjahre+.
Die bisher geplanten Themen (Saison, Begleiter-Expeditionen, Abgrund, Nekromant …) rücken dahinter.

## Qualitätsregeln (kritisch bleiben)
- Vor jedem Kapitel: unabhängige Prüfung durch einen zweiten Agenten (spielt es durch, sucht Schwächen: Lesbarkeit des Beschusses auf dem Handy, Fairness, Leistung, Langeweile nach 30 Minuten) – Mängel werden vor dem Live-Stellen behoben oder ehrlich im Bericht genannt.
- Beschuss muss fair sein: immer angekündigt, immer ausweichbar, nie Treffer ohne Vorwarnung.
- Leistung: 60 Bilder/s auf dem Handy mit zwei Heeren (Obergrenze der Einheiten, einfache KI für Statisten).
- Alte Spielstände laden weiter; alle Texte in 6 Sprachen; Handbuch und Tests je Kapitel.

## Stand nach Kapitel 1 (6.6) – woran die nächsten Kapitel andocken
Alles in `js/krieg.js` (Kopfkommentar = Schnittstelle), Test `tools/test/krieg.js`.
- `REICHE` enthält alle fünf Reiche (Farben, Wappen `['pa', 'kr_w_<reich>']`, `raenge`, `masch`, `einh`); `aktiv: 0` = noch nicht an der Front. Kapitel 2: Einheiten in `EN` (`ai: 'krieg'`, `kr: [reich, rolle]`, `body`/`dye`), `einh`/`hpt`/`masch` füllen, `aktiv: 1` – Seitenwahl, Chronik und Handbuch lesen aus den Daten.
- Soldaten-KI `krAI` kennt die Rollen `nah`, `fern`, `magier`, `hauptmann`, `banner`; neue Rollen (Reiter, Heiler) dort ergänzen. Sonderangriffe der Hauptleute: `krSonderStart`.
- Beschuss: `krShot(art, x, y, { team })` mit `pfeil`, `katapult`, `magie`, `ring`, `bahn`; neue Arten (Ballistenbolzen = `bahn` ohne Läufer, Schattenriss) in `krShot`, `krImpact`, `krDrawShot`. Regel bleibt: nie unter `KR_WARN_MIN`, Treffer nur in der gezeichneten Fläche (`krIn`).
- Spielstand `SAVE.meta.krieg` (`krFix`): `r[reich] = { ruf, mk, sg, nl }`, `ch` ist frei für Chronik-Entscheidungen, `seite` = zuletzt gewählt. Ränge: `KR_RAENGE` (Schwellen stehen, Vorteile fehlen noch).
- Schlacht-Ziele: `KR_ZIELE`/`KR_ZIEL`, Ablauf in `krStart`/`krUpd`/`krEnd`. Feld-Geometrie `krPos(u, v)` (u = eigenes Ende … Feind).
- Lande: `KR_LANDE` (Biom → Beschuss-Arten), Kulissen `krLandeDeko`.

Ehrlich offen nach Kapitel 1: ein einziges Feld-Layout (nur leicht gewürfelt) und vier Ziele – nach vielen Schlachten wiederholt es sich; das Schlachtfeld steckt noch im Mauer-Rahmen der Kampagnen-Räume; Verbündete kennen keine Formation; Kriegskasse mit nur drei Angeboten; keine eigenen Klänge für Katapult und Meteor; HD-Grafik auf Geräten ohne Grafikkarte teuer (Pixel-Modus ist auf Handys Standard).

## Stand nach Kapitel 2 (6.8)
- `REICHE`: vier aktiv (aurelien, nordmark, sylvara, karth), `konzil` bleibt `aktiv: 0` bis 7.1 (Schattenriss = neue Beschuss-Art dort).
- Gegner einer Schlacht: `G.extra.krFeind` (aus der Front), sonst Erzfeind `KR_RIVAL`. Die Kriegskarte (6.9) ersetzt `krFront` durch echte Provinzen.
- Chronik: `KR_AKT1[reich] = [{ ab: Siege, t, L }]`; Akt 2 (7.1) hängt sich genauso an, Entscheidungen in `krM().ch`.
- Ehrlich offen: Lager in den Kriegs-Biomen der Lande zeigen weiter nur Aurelien und Karth; Druiden werfen Feuer (eigene Giftgeschosse fehlen noch).

## Stand nach Kapitel 3 (6.9)
Alles in `js/kriegskarte.js` (Kopfkommentar = Schnittstelle), Test `tools/test/kriegskarte.js`.
- Karte: 40 Provinzen (Wabenfeld 8 × 5, `KK_NB` Nachbarn, `KK_NAMEN`), Start `KK_START`, Festungen `KK_FEST` fallen nie, zwei Provinzen Nebel (`''`) – dort setzt das Schattenkonzil in 7.1 an (Provinzen dem Konzil geben, `KK_START` nur hinten erweitern).
- Kriegstag alle 3 Stunden (`KK_TICK`), fester Zufall je absolutem Tag (`kkTag`), Nachrechnen höchstens eine Woche (`kkTick`). Kleinere Reiche wehren sich besser (Gummiband), deshalb verschwindet keins.
- Feldzug `krM().karte.fz` = { p, s, f, n, auf }: Fortschritt aus `krEnd` (`kkSchlacht`), Schlachten mit `startRoom('krieg', 3, { …, fz: 1 })` verbrauchen keinen Ort der Weltkarte. Belagerungen (7.0) können als neue Feldzug-Art an Festungs-Nachbarn andocken.
- `krFront` nimmt jetzt echte Grenzen (`kkFront`); `KR_FRONT` bleibt nur als Rückfall.
- Ehrlich offen: Provinzen haben noch keine eigenen Schlachtfelder (alle Feldzug-Schlachten nutzen das Feld der Kriegsgebiete); die Wahl der Provinz ändert nur Front und Lohn. Kriegsjahre zählen, bringen aber noch keine eigenen Ereignisse – das kommt mit den Feldherren (7.0).
