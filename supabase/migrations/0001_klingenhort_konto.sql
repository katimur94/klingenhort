-- =========================================================
-- Klingenhort – Online, Schritt 1: Konto & Cloud-Speicher
-- Einmal im Supabase-Dashboard ausführen: SQL Editor → New query → alles einfügen → Run.
-- Darf mehrfach laufen (legt nichts doppelt an).
--
-- profiles  ein Eintrag je Konto: Anzeigename (2–20 Zeichen), angelegt am
-- saves     ein Spielstand je Konto: data = derselbe Spielstand wie im Browser (JSON), version = Spielversion,
--           rev = Zähler für jede Sicherung (gegen gegenseitiges Überschreiben), updated_at, device = Gerät (z. B. „Android · Chrome“)
-- Row Level Security: jeder sieht und ändert nur seine eigenen Zeilen. Das Spiel benutzt nur den öffentlichen anon-Schlüssel.
-- =========================================================

-- ---------- Tabellen ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  created_at  timestamptz not null default now(),
  -- Anzeigename: 2–20 Zeichen, Buchstaben (auch Umlaute/Akzente), Ziffern, Leerzeichen, - _ . – ohne Leerzeichen am Rand
  constraint profiles_name_len   check (name is null or char_length(name) between 2 and 20),
  constraint profiles_name_chars check (name is null or (name ~ '^[[:alnum:] _.\-]+$' and name = btrim(name)))
);

create table if not exists public.saves (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  data        jsonb not null,
  version     text not null default '' check (char_length(version) <= 20),
  rev         bigint not null default 1 check (rev >= 1),
  updated_at  timestamptz not null default now(),
  device      text not null default '' check (char_length(device) <= 60),
  -- Größe: höchstens 1,5 MB (ein großer Spielstand hat etwa 100–400 KB)
  constraint saves_size check (octet_length(data::text) < 1572864),
  -- Grobe Form: ein Klingenhort-Spielstand (v = 3, Heldenliste)
  constraint saves_shape check (jsonb_typeof(data) = 'object' and jsonb_typeof(data -> 'chars') = 'array')
);

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
alter table public.saves    enable row level security;

drop policy if exists "profil lesen"   on public.profiles;
drop policy if exists "profil anlegen" on public.profiles;
drop policy if exists "profil ändern"  on public.profiles;
drop policy if exists "profil löschen" on public.profiles;
create policy "profil lesen"   on public.profiles for select to authenticated using (id = auth.uid());
create policy "profil anlegen" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profil ändern"  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "profil löschen" on public.profiles for delete to authenticated using (id = auth.uid());

drop policy if exists "spielstand lesen"   on public.saves;
drop policy if exists "spielstand anlegen" on public.saves;
drop policy if exists "spielstand ändern"  on public.saves;
drop policy if exists "spielstand löschen" on public.saves;
create policy "spielstand lesen"   on public.saves for select to authenticated using (user_id = auth.uid());
create policy "spielstand anlegen" on public.saves for insert to authenticated with check (user_id = auth.uid());
create policy "spielstand ändern"  on public.saves for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "spielstand löschen" on public.saves for delete to authenticated using (user_id = auth.uid());

-- Anonyme Besucher (nur anon-Schlüssel, nicht angemeldet) dürfen nichts
revoke all on public.profiles, public.saves from anon;
grant select, insert, update, delete on public.profiles, public.saves to authenticated;

-- ---------- Sichern mit Revision (optimistische Sperre) ----------
-- kh_put_save(Spielstand, Version, Gerät, Basis-Revision):
--   p_base = 0 → nur anlegen, wenn es noch keinen Cloud-Spielstand gibt
--   p_base = n → nur überschreiben, wenn der Cloud-Spielstand noch Revision n hat (sonst hat ein anderes Gerät inzwischen gesichert)
-- Antwort: { ok: true, rev, updated_at } oder { ok: false, rev: aktuelle Revision } – das Spiel zeigt dann die Auswahl.
-- security invoker: läuft mit den Rechten des Spielers, Row Level Security gilt.
create or replace function public.kh_put_save(p_data jsonb, p_version text, p_device text, p_base bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  r   bigint;
  t   timestamptz;
  cur bigint;
begin
  if me is null then
    raise exception 'nicht angemeldet' using errcode = '28000';
  end if;
  if coalesce(p_base, 0) = 0 then
    insert into public.saves (user_id, data, version, device, rev, updated_at)
    values (me, p_data, left(coalesce(p_version, ''), 20), left(coalesce(p_device, ''), 60), 1, now())
    on conflict (user_id) do nothing
    returning saves.rev, saves.updated_at into r, t;
  else
    update public.saves s
       set data = p_data, version = left(coalesce(p_version, ''), 20), device = left(coalesce(p_device, ''), 60),
           rev = s.rev + 1, updated_at = now()
     where s.user_id = me and s.rev = p_base
    returning s.rev, s.updated_at into r, t;
  end if;
  if r is null then
    select s.rev into cur from public.saves s where s.user_id = me;
    return jsonb_build_object('ok', false, 'rev', coalesce(cur, 0));
  end if;
  return jsonb_build_object('ok', true, 'rev', r, 'updated_at', t);
end;
$$;
revoke all on function public.kh_put_save(jsonb, text, text, bigint) from public, anon;
grant execute on function public.kh_put_save(jsonb, text, text, bigint) to authenticated;

-- ---------- Konto löschen ----------
-- Löscht das eigene Konto samt Profil und Cloud-Spielstand (on delete cascade). Der Spielstand im Browser bleibt.
-- security definer: nur so darf ein Spieler seinen eigenen Eintrag in auth.users löschen – und nur diesen (auth.uid()).
create or replace function public.kh_delete_me()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'nicht angemeldet' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;
revoke all on function public.kh_delete_me() from public, anon;
grant execute on function public.kh_delete_me() to authenticated;
