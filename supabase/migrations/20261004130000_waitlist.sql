-- Alpha5 · Warteliste der Landingpage mit Double-Opt-in (docs/ALPHA5-PAKET.md Aufgabe 6, docs/SETUP.md Teil I).
--
-- STRENGER als im Paket („öffentlich nur Einfügen“): anon und authenticated haben KEINE Rechte – weder Lesen
-- noch Einfügen. Grund: Mit direktem Einfügen über die öffentliche API ließen sich Rate-Limit, Honeypot und
-- Double-Opt-in umgehen (fremde Adressen eintragen, Tabelle fluten). Geschrieben wird nur über die Next-API-Route
-- /api/warteliste (Server, service_role) und nur über die drei Funktionen unten.
--
-- Gespeichert wird so wenig wie möglich:
-- - E-Mail (klein geschrieben, ohne Leerzeichen), Version des Einwilligungstexts, Zeitpunkte.
-- - Bestätigungs- und Abmelde-Token NUR als HMAC-Hash (der Klartext steht nur in der Mail).
-- - Rate-Limit: nur HMAC-Hashes von IP-Adresse und E-Mail, nach 24 Stunden gelöscht. Keine IP im Klartext.
-- - Nicht bestätigte Einträge werden nach Ablauf des Tokens (48 h) gelöscht; Abmelden löscht den Eintrag ganz.
--   Aufräumen: waitlist_cleanup() – bei jedem Eintragen/Bestätigen/Abmelden und täglich per GitHub Action
--   (Workflow waitlist-cleanup), damit die Fristen auch ohne Besucher eingehalten werden.
-- - Erneutes Eintragen einer noch unbestätigten Adresse ersetzt das Token (der alte Link wird ungültig, eine neue
--   Mail geht raus). Bewusst so: Das alte Token liegt nur als Hash vor und kann nicht erneut verschickt werden;
--   das E-Mail-Limit (3 pro 24 h) begrenzt, wie oft jemand Fremdes einen offenen Link so ungültig machen kann.
-- Keine Gesundheitsdaten.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique
    check (email = lower(btrim(email)) and char_length(email) between 3 and 254 and email like '_%@_%'),
  consent_text_version integer not null check (consent_text_version > 0),
  consent_given_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  token_hash text unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz,
  unsubscribe_token_hash text not null unique check (unsubscribe_token_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.waitlist is
  'Warteliste der Landingpage (Double-Opt-in). Nur service_role, Zugriff über waitlist_signup/-confirm/-unsubscribe.';

create table public.waitlist_attempts (
  id bigint generated always as identity primary key,
  key_hash text not null check (key_hash ~ '^(ip|email):[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index waitlist_attempts_key_time on public.waitlist_attempts (key_hash, created_at);

comment on table public.waitlist_attempts is
  'Rate-Limit der Warteliste: nur HMAC-Hashes von IP/E-Mail, werden nach 24 Stunden gelöscht.';

alter table public.waitlist enable row level security;
alter table public.waitlist_attempts enable row level security;

-- Keine Policies: Für anon/authenticated ist nichts erlaubt (RLS + fehlende Rechte). service_role umgeht RLS.
revoke all on table public.waitlist, public.waitlist_attempts from public, anon, authenticated;
grant all on table public.waitlist, public.waitlist_attempts to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen (Löschfristen): Versuche älter als 24 h, nie bestätigte Einträge mit abgelaufenem Token.
-- Ergebnis: Anzahl gelöschter Zeilen (beide Tabellen zusammen).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_cleanup()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_attempts integer;
  v_entries integer;
begin
  delete from public.waitlist_attempts where created_at < now() - interval '24 hours';
  get diagnostics v_attempts = row_count;
  delete from public.waitlist where confirmed_at is null and token_expires_at < now();
  get diagnostics v_entries = row_count;
  return v_attempts + v_entries;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Eintragen: Rate-Limit prüfen, Eintrag anlegen oder (noch nicht bestätigt) neues Token setzen.
-- Ergebnis: 'send' (Bestätigungs-Mail schicken), 'confirmed' (schon bestätigt – keine Mail),
-- 'rate_limited' (zu viele Versuche). Grenzen: je IP höchstens 10 Versuche pro Stunde, je E-Mail höchstens
-- 3 pro 24 Stunden (schützt fremde Postfächer vor Mail-Flut).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_signup(
  p_email text,
  p_consent_text_version integer,
  p_ip_hash text,
  p_email_hash text,
  p_token_hash text,
  p_unsubscribe_token_hash text,
  p_token_expires_at timestamptz
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ip_count integer;
  v_email_count integer;
  v_confirmed timestamptz;
begin
  perform public.waitlist_cleanup();

  insert into public.waitlist_attempts (key_hash)
  values ('ip:' || p_ip_hash), ('email:' || p_email_hash);

  select count(*) into v_ip_count from public.waitlist_attempts
  where key_hash = 'ip:' || p_ip_hash and created_at > now() - interval '1 hour';
  select count(*) into v_email_count from public.waitlist_attempts
  where key_hash = 'email:' || p_email_hash and created_at > now() - interval '24 hours';
  if v_ip_count > 10 or v_email_count > 3 then
    return 'rate_limited';
  end if;

  select confirmed_at into v_confirmed from public.waitlist where email = p_email for update;
  if v_confirmed is not null then
    return 'confirmed';
  end if;

  insert into public.waitlist (
    email, consent_text_version, token_hash, token_expires_at, unsubscribe_token_hash
  ) values (
    p_email, p_consent_text_version, p_token_hash, p_token_expires_at, p_unsubscribe_token_hash
  )
  on conflict (email) do update set
    consent_text_version = excluded.consent_text_version,
    consent_given_at = now(),
    token_hash = excluded.token_hash,
    token_expires_at = excluded.token_expires_at,
    unsubscribe_token_hash = excluded.unsubscribe_token_hash
  where public.waitlist.confirmed_at is null;

  return 'send';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Bestätigen (Link aus der Mail). Ergebnis: 'confirmed' (jetzt oder schon vorher bestätigt), 'expired', 'invalid'.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_confirm(p_token_hash text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_row public.waitlist;
  v_result text;
begin
  select * into v_row from public.waitlist where token_hash = p_token_hash for update;
  if not found then
    v_result := 'invalid';
  elsif v_row.confirmed_at is not null then
    v_result := 'confirmed';
  elsif v_row.token_expires_at is null or v_row.token_expires_at < now() then
    v_result := 'expired';
  else
    update public.waitlist set confirmed_at = now() where id = v_row.id;
    v_result := 'confirmed';
  end if;
  -- Erst nach der Prüfung aufräumen, damit ein abgelaufener Link „abgelaufen“ statt „ungültig“ meldet.
  perform public.waitlist_cleanup();
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Abmelden (Link aus der Mail): löscht den Eintrag vollständig. true = gelöscht, false = nichts gefunden.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.waitlist_unsubscribe(p_unsubscribe_token_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_deleted boolean;
begin
  delete from public.waitlist where unsubscribe_token_hash = p_unsubscribe_token_hash;
  v_deleted := found;
  perform public.waitlist_cleanup();
  return v_deleted;
end;
$$;

revoke all on function public.waitlist_signup(text, integer, text, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.waitlist_confirm(text) from public, anon, authenticated;
revoke all on function public.waitlist_cleanup() from public, anon, authenticated;
grant execute on function public.waitlist_cleanup() to service_role;
revoke all on function public.waitlist_unsubscribe(text) from public, anon, authenticated;
grant execute on function public.waitlist_signup(text, integer, text, text, text, text, timestamptz) to service_role;
grant execute on function public.waitlist_confirm(text) to service_role;
grant execute on function public.waitlist_unsubscribe(text) to service_role;
