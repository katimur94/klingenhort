'use strict';
/* =========================================================
   KLINGENHORT – Online-Zugang (Konto & Cloud-Speicher, js/online.js)
   null = aus: kein Konto-Knopf, keine Verbindung ins Internet, das Spiel läuft wie immer.
   Einschalten (Anleitung: supabase/README.md): im Supabase-Dashboard unter Project Settings → API
   die Project URL und den PUBLIC „anon“-Schlüssel (anon public) kopieren und hier eintragen:
     window.KH_ONLINE = { url: 'https://abcdefghijkl.supabase.co', anon: 'eyJhbGciOi…' };
   Der anon-Schlüssel ist öffentlich und darf im Spiel stehen – Row Level Security schützt die Daten.
   NIEMALS den „service_role“-Schlüssel (secret) hier eintragen: der darf alles und wäre für jeden lesbar.
   (Das Spiel weigert sich, mit einem service_role-Schlüssel zu starten.)
   ========================================================= */
window.KH_ONLINE = null;
