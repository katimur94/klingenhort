# Konto & Cloud-Speicher einrichten (Supabase)

Klingenhort hat ab „Online, Schritt 1“ ein freiwilliges Konto: Spieler melden sich mit E-Mail (Link oder Code) oder Google an, und ihr Spielstand wird zwischen ihren Geräten abgeglichen. **Solange `js/online-config.js` `window.KH_ONLINE = null` setzt, ist alles aus** – kein Knopf, keine Verbindung, das Spiel läuft wie bisher.

Das Spiel spricht direkt mit Supabase (ohne SDK, nur `fetch`). Gebraucht werden ein Supabase-Projekt, die Tabellen aus `migrations/0001_klingenhort_konto.sql` und zwei Anmelde-Wege. Dauer: etwa 20 Minuten.

---

## 1. Projekt anlegen

1. Auf <https://supabase.com> anmelden → **New project**.
2. **Name:** `klingenhort` · **Database Password:** ein langes Passwort erzeugen und sicher aufbewahren (wird im Spiel nie gebraucht).
3. **Region:** eine **EU-Region**, z. B. *Central EU (Frankfurt)* – wichtig für den Datenschutz (siehe `docs/datenschutz-entwurf.md`).
4. **Create new project** – warten, bis das Projekt bereit ist (1–2 Minuten).

## 2. Tabellen anlegen (SQL)

1. Links **SQL Editor** → **New query**.
2. Den ganzen Inhalt von `supabase/migrations/0001_klingenhort_konto.sql` hineinkopieren → **Run**.
3. Erwartet: „Success. No rows returned“. Unter **Table Editor** gibt es jetzt `profiles` und `saves`, beide mit dem Schild **RLS enabled**.

Was das SQL anlegt:

| Teil | Inhalt |
|---|---|
| `profiles` | `id` (= Konto), `name` (Anzeigename, 2–20 Zeichen: Buchstaben, Ziffern, Leerzeichen, `- _ .`), `created_at` |
| `saves` | `user_id` (= Konto), `data` (Spielstand als JSON, höchstens 1,5 MB), `version`, `rev` (Zähler), `updated_at`, `device` |
| Row Level Security | jeder Spieler liest und schreibt nur seine eigenen Zeilen; nicht angemeldete Besucher gar nichts |
| `kh_put_save(...)` | sichert nur, wenn sich der Cloud-Spielstand seit dem letzten Abgleich nicht geändert hat (`rev`) – sonst zeigt das Spiel die Auswahl „Diesen Spielstand behalten“ |
| `kh_delete_me()` | „Konto löschen“ im Spiel: löscht Konto, Profil und Cloud-Spielstand |

Das SQL darf mehrfach laufen.

## 3. Anmelden per E-Mail einschalten

1. **Authentication → Sign In / Providers** (ältere Oberfläche: *Providers*) → **Email**: *Enable Email provider* an, *Confirm email* an. Speichern.
2. **Authentication → Emails → Templates → Magic Link**: damit auch der **Code** funktioniert (für Spieler, deren E-Mail-Link sich in einem anderen Browser öffnet), im Text zusätzlich den Code einfügen, z. B.:

   ```html
   <h2>Dein Zugang zu Klingenhort</h2>
   <p><a href="{{ .ConfirmationURL }}">Hier tippen, um dich anzumelden</a></p>
   <p>Oder gib im Spiel diesen Code ein: <b>{{ .Token }}</b></p>
   ```

   Dasselbe in der Vorlage **Confirm signup** (erste Anmeldung).
3. **E-Mail-Versand:** Der eingebaute Versand von Supabase ist nur für Tests (wenige E-Mails pro Stunde). Für echte Spieler unter **Authentication → Emails → SMTP Settings** einen eigenen Dienst eintragen (z. B. Brevo, Resend, Postmark – mit EU-Rechenzentrum) und im Datenschutz nennen.

## 4. Anmelden mit Google einschalten

1. In der **Google Cloud Console** (<https://console.cloud.google.com>) ein Projekt anlegen → **APIs & Services → OAuth consent screen**: App-Name „Klingenhort“, Support-E-Mail, als autorisierte Domain `supabase.co` und `katimur94.github.io`, Link zur Datenschutzerklärung (`https://katimur94.github.io/klingenhort/datenschutz.html`). Bereiche: nur `email`, `profile`, `openid`.
2. **Credentials → Create credentials → OAuth client ID** → *Web application*.
   - **Authorized JavaScript origins:** `https://katimur94.github.io`
   - **Authorized redirect URIs:** die *Callback URL*, die Supabase unter **Authentication → Sign In / Providers → Google** anzeigt (sieht aus wie `https://<projekt>.supabase.co/auth/v1/callback`).
3. Client-ID und Client-Secret bei Supabase unter **Google** eintragen, *Enable* an, speichern. (Das Secret bleibt bei Supabase – es kommt nie ins Spiel.)

## 5. Adressen für die Rückkehr ins Spiel

**Authentication → URL Configuration**:

- **Site URL:** `https://katimur94.github.io/klingenhort/`
- **Redirect URLs** (→ *Add URL*), alle drei:
  - `https://katimur94.github.io/klingenhort/`
  - `https://katimur94.github.io/klingenhort/**`
  - für Tests am eigenen Rechner (optional): `http://localhost:8777/**`

Ohne diese Einträge landet der Link aus der E-Mail bzw. Google auf der falschen Seite.

## 6. Zugang ins Spiel eintragen

1. **Project Settings → API** (bzw. **API Keys**):
   - **Project URL** kopieren, z. B. `https://abcdefghijkl.supabase.co`
   - den **öffentlichen** Schlüssel kopieren: **`anon` `public`** (alte Schlüssel, beginnt mit `eyJ…`) **oder** den **Publishable key** (`sb_publishable_…`).
   - **NIEMALS** den `service_role`-Schlüssel bzw. **Secret key** (`sb_secret_…`) nehmen – der umgeht jeden Schutz und wäre für jeden lesbar. Das Spiel weigert sich, damit zu starten.
2. In `js/online-config.js` die Zeile `window.KH_ONLINE = null;` ersetzen durch:

   ```js
   window.KH_ONLINE = { url: 'https://abcdefghijkl.supabase.co', anon: 'eyJhbGciOi…' };
   ```

3. **Vorher** `datenschutz.html` und das Impressum fertig machen (Vorlagen: `docs/datenschutz-entwurf.md`, `docs/impressum-vorlage.md`) – mit Konto verarbeitet das Spiel personenbezogene Daten.
4. Version erhöhen (`VERSION` in `js/data.js` und `sw.js`), Neuigkeiten schreiben, alle Tests laufen lassen (`bash tools/test/run.sh`), veröffentlichen.

## 7. Ausprobieren

1. Spiel öffnen → im Hauptmenü erscheint **☁ Konto** (und unter Einstellungen **☁ Konto & Cloud**).
2. E-Mail eingeben → **Link schicken** → Link in der E-Mail antippen (oder Code eingeben). Status: „Zuletzt gesichert: …“.
3. Im **Table Editor → saves** steht eine Zeile mit deinem Spielstand.
4. Auf einem zweiten Gerät anmelden → der Spielstand kommt mit.
5. Etwas spielen auf beiden Geräten ohne Abgleich (eins im Flugmodus) → beim nächsten Start erscheint die Auswahl „Diesen Spielstand behalten“.

## Wartung

- **Kontingent:** Im kostenlosen Tarif 500 MB Datenbank – ein Spielstand ist etwa 100–400 KB groß, also grob 1.500–5.000 Spieler. Unter **Reports** die Größe beobachten.
- **Pausieren:** Kostenlose Projekte pausieren nach einer Woche ohne Zugriff. Das Spiel merkt davon nichts Schlimmes: es meldet „Offline – wird gesichert, sobald du wieder online bist“, gespielt wird lokal weiter.
- **Abschalten:** `window.KH_ONLINE = null` – sofort wieder ohne Konto (die Spielstände der Spieler im Browser bleiben).
- **Konto eines Spielers löschen** (Anfrage per E-Mail): **Authentication → Users** → Spieler suchen → *Delete user* (Profil und Cloud-Spielstand werden mitgelöscht).
