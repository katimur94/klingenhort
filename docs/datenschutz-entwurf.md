# ⚠ ENTWURF – Datenschutzerklärung für Klingenhort (Konto & Cloud)

> **Das ist ein Entwurf, keine Rechtsberatung.** Der Betreiber muss alle Stellen in `[[…]]` ausfüllen, den Text prüfen (lassen) und erst danach `js/online-config.js` einschalten. Die fertige Fassung gehört nach `datenschutz.html` (gleicher Aufbau, die Platzhalter sind dort rot markiert). Das Spiel verlinkt `datenschutz.html` nur, wenn Konto & Cloud eingeschaltet ist.

---

## 1. Verantwortlicher

[[Vor- und Nachname]]
[[Straße Hausnummer]]
[[PLZ Ort, Land]]
E-Mail: [[kontakt@beispiel.de]]

## 2. Spielen ohne Konto

- Klingenhort ist ohne Konto voll spielbar. Der Spielstand liegt dann nur im Browser auf dem Gerät (localStorage). Der Betreiber erhält davon nichts.
- **Hosting:** GitHub Pages (GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, USA). Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, angefragte Datei, Browser). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. [[prüfen: Datenübermittlung USA – EU-US Data Privacy Framework]]
- **Schriften:** Google Fonts (Google Ireland Ltd.). Beim Laden wird die IP-Adresse an Google übermittelt. [[prüfen – oder Schriften selbst hosten, dann diesen Absatz streichen]]

## 3. Konto & Cloud (freiwillig)

Zweck: Spielstand sichern und auf mehreren Geräten nutzen. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung des angeforderten Dienstes).

**Genau diese Daten werden gespeichert:**

| Daten | Wo | Wofür |
|---|---|---|
| E-Mail-Adresse | Supabase Auth (`auth.users`) | Anmelden per Link/Code; bei Google-Anmeldung von Google übermittelt |
| Kennung des Kontos (zufällige UUID) | Supabase | Zuordnung von Profil und Spielstand |
| Anzeigename (freiwillig, 2–20 Zeichen) | Tabelle `profiles` | Anzeige im Spiel |
| Spielstand (Helden, Ausrüstung, Versteck, Erfolge, Bestiarium, Spiel-Einstellungen) | Tabelle `saves` (`data`) | Sicherung und Abgleich |
| Spielversion, Gerätebezeichnung (z. B. „Android · Chrome“, aus dem Browser abgeleitet) | Tabelle `saves` | Auswahl, welcher Spielstand neuer ist |
| Zeitpunkte: Konto angelegt, letzte Anmeldung, letzte Sicherung | Supabase / `profiles.created_at` / `saves.updated_at` | Abgleich, Sicherheit |
| Technische Protokolle des Anbieters (IP-Adresse, Zeitpunkt, Anfrage) | Supabase | Betrieb und Missbrauchsschutz; Aufbewahrung laut Supabase [[Frist prüfen]] |

- **Nicht** gespeichert werden: Passwörter (es gibt keine), Zahlungsdaten, Standort, Kontakte, Werbe-IDs. Es gibt kein Tracking und keine Werbung.
- **Google-Anmeldung:** Google übermittelt E-Mail-Adresse und Kennung, ggf. Name und Profilbild [[prüfen, was tatsächlich in `auth.users.raw_user_meta_data` landet]]. Für die Anmeldung bei Google gilt zusätzlich die Datenschutzerklärung von Google.
- **E-Mail-Versand** der Anmelde-Links: [[Supabase oder eigener SMTP-Dienst, Name, Sitz, Region]].

## 4. Auftragsverarbeiter

- **Supabase Inc.**, 970 Toa Payoh North #07-04, Singapore 318992 – Datenbank und Anmeldung, Auftragsverarbeitung nach Art. 28 DSGVO.
- **Region:** [[EU – empfohlen: Central EU (Frankfurt), eu-central-1]]. Bei Wahl einer EU-Region bleiben die Daten in der EU; Unterauftragnehmer laut Supabase-DPA [[prüfen]].
- **Vertrag zur Auftragsverarbeitung (DPA):** im Supabase-Dashboard unter *Organization → Legal Documents* anfordern/abschließen. [[Datum eintragen]]
- [[ggf. SMTP-Dienst als weiterer Auftragsverarbeiter]]

## 5. Speicherdauer und Löschung

- **Im Spiel selbst:** Einstellungen → Konto & Cloud →
  - **Cloud-Spielstand löschen** – entfernt die Zeile in `saves` sofort.
  - **Konto löschen** – entfernt Konto, E-Mail-Adresse, Profil und Cloud-Spielstand sofort (`kh_delete_me`).
  - Der Spielstand im Browser des Geräts bleibt in beiden Fällen; der Spieler löscht ihn über die Websitedaten seines Browsers.
- **Per E-Mail:** Löschung auf Anfrage an [[kontakt@beispiel.de]] (Supabase → Authentication → Users → Delete user).
- **Inaktive Konten:** [[festlegen, z. B. nach 24 Monaten ohne Anmeldung löschen – oder streichen]]
- **Backups des Anbieters:** werden nach [[Frist laut Supabase-Tarif, z. B. 7 Tage]] überschrieben.

## 6. Kinder und Jugendliche

- Klingenhort spricht auch junge Spieler an. Ein Konto ist **freiwillig**; ohne Konto ist alles spielbar.
- Für Dienste der Informationsgesellschaft ist in Deutschland die Einwilligung erst ab **16 Jahren** wirksam (Art. 8 DSGVO; andere EU-Länder 13–16 [[für Zielländer prüfen]]). Rechtsgrundlage für das Konto ist zwar die Vertragserfüllung (lit. b), trotzdem empfohlen: im Spiel und hier den Hinweis „Unter 16 nur mit Zustimmung deiner Eltern“ und eine einfache Löschmöglichkeit für Eltern (per E-Mail).
- Der Anzeigename ist in Schritt 1 für niemanden außer den Spieler selbst sichtbar. **Sobald Namen für andere sichtbar werden** (Ranglisten, Tausch online): Namensfilter und Meldeweg ergänzen und diesen Abschnitt erweitern.

## 7. Rechte der Spieler

Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20 – der Spielstand lässt sich jederzeit im Spiel als Code exportieren), Widerspruch (Art. 21), Beschwerde bei einer Aufsichtsbehörde (Art. 77), z. B. [[zuständige Landesdatenschutzbehörde]].

## 8. Speicher im Browser (§ 25 TDDDG)

Das Spiel legt im localStorage ab: Spielstand (`klingenhort.v3`), Sprache (`klingenhort.lang`), mit Konto zusätzlich Sitzung (`klingenhort.konto` – Zugangs- und Erneuerungs-Token), Abgleich-Stand (`klingenhort.konto.sync`) und ein Backup (`klingenhort.konto.backup`). Das ist für den vom Spieler gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Cookies werden nicht gesetzt.

## 9. Änderungen

Stand: [[Datum]]. Bei neuen Online-Funktionen (z. B. Ranglisten) wird diese Erklärung angepasst.
