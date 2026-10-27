-- Live-Begleitung / Notfallkontakt (CLAUDE.md „Ausnahme … Live-Begleitung“, Gründer-Entscheidung 25.10.2026,
-- Freigabe der Umsetzung 27.10.2026; docs/PLAN-PHASE-10.md Abschnitt 21, Etappe LB2). NUR ADDITIV.
--
-- Wer läuft/Rad fährt/geht, kann während einer laufenden Aufzeichnung auf eigenen Tipp einer Vertrauensperson die
-- AKTUELLE Position zeigen. Die Vertrauensperson braucht kein Konto: Sie bekommt einen geheimen Link
-- (/begleitung#t=<Token>) und sieht im Browser nur Anzeigename, Sportart, Startzeit, „zuletzt aktualisiert vor …“ und
-- die letzte Position.
--
-- Pflicht-Regeln (CLAUDE.md), so umgesetzt:
-- - Notfallkontakte liegen NUR auf dem Gerät – hier gibt es bewusst KEINE Kontakte-Tabelle.
-- - Token: 32 zufällige Bytes (256 Bit) aus gen_random_bytes, im Klartext nur EINMAL als Antwort von
--   start_live_session/rotate_live_token; gespeichert wird nur SHA-256 (token_hash). Der Link trägt das Token im
--   Fragment (#t=), das Browser nie an Server schicken.
-- - Höchstdauer 12 h (expires_at ≤ started_at + 12 h, CHECK). Nach „Angekommen“/Ende wird die Position SOFORT
--   gelöscht; die Seite zeigt höchstens 2 h nur noch den Status ohne Karte (expires_at = Ende + 2 h, nie nach
--   Start + 12 h), danach ist der Link ungültig.
-- - Nur die LETZTE Position (live_positions: genau eine Zeile je Sitzung, Upsert) – keine Spur, keine Historie.
-- - RLS: Besitzer liest die eigene Sitzung (ohne token_hash, Spaltenrechte) und Position; geschrieben wird nur über
--   die Funktionen unten (security definer, fester search_path). anon: nichts.
-- - Lesen für die Vertrauensperson NUR über get_live_view (nur service_role, Aufruf aus der Next.js-Route
--   /api/begleitung): Token-Hash geprüft, Ratenbremse je IP (HMAC-Hash) 10/min und je Sitzung 30/min; falsches,
--   abgelaufenes und unbekanntes Token geben DIESELBE Antwort {"state":"invalid"}. Keine Gesundheitsdaten (die
--   Funktion liest nur live_sessions/live_positions), keine Pace, keine Distanz.
-- - Automatisch löschen: private.purge_live_sessions() – abgelaufene offene Sitzungen schließen (Position weg),
--   Sitzungen 24 h nach Ablauf löschen (nur Metadaten ohne Ort, für „Diese Live-Begleitung ist beendet.“),
--   Prüfwerte der Ratenbremse nach 1 h. Lauf per pg_cron alle 5 min (falls verfügbar), bei jedem Start einer
--   Begleitung und stündlich per GitHub Action live-cleanup (public.live_cleanup()). Jede Funktion filtert
--   Abgelaufenes zusätzlich selbst.
-- - Keine Koordinaten in Logs: Fehlermeldungen nennen nie Werte; log_parameter_max_length_on_error bleibt 0
--   (Postgres-Standard).
-- - Export: export_my_data nimmt live_sessions OHNE token_hash auf (eigene Migration *_live_export_my_data.sql).
--   Konto löschen → Kaskade. Kein Gesundheitsdatum (Standort ist kein Art.-9-Datum, Plan 21.9).
-- Gratis (F2): keine Premium-Prüfung.

-- pgcrypto (gen_random_bytes) liegt auf Supabase im Schema extensions (wie das Zyklus-Modul).
create extension if not exists pgcrypto with schema extensions;

create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SHA-256 des 32-Byte-Tokens; der Klartext wird nie gespeichert.
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  display_name text not null
    check (char_length(display_name) between 1 and 30 and display_name = btrim(display_name)
           and display_name !~ '[[:cntrl:]]'),
  -- Laufen, Rad (inkl. E-Bike), Gehen (inkl. Wandern) – mehr verrät die Begleit-Seite nicht.
  sport text not null check (sport in ('run', 'bike', 'walk')),
  status text not null default 'active' check (status in ('active', 'paused', 'arrived', 'ended')),
  started_at timestamptz not null default now(),
  planned_end_at timestamptz not null,
  ended_at timestamptz,
  expires_at timestamptz not null,
  update_interval_s smallint not null default 30 check (update_interval_s between 15 and 60),
  constraint live_sessions_planned_end check (
    planned_end_at > started_at and planned_end_at <= started_at + interval '12 hours'),
  constraint live_sessions_max_12h check (expires_at <= started_at + interval '12 hours'),
  constraint live_sessions_ended_at check ((status in ('active', 'paused')) = (ended_at is null))
);

comment on table public.live_sessions is
  'Live-Begleitung (PLAN-PHASE-10 21): eine Sitzung je Aufzeichnung, höchstens 12 h. Token nur als SHA-256. '
  'Lesen: Besitzer (ohne token_hash); Schreiben nur über start_live_session/set_live_status/rotate_live_token.';

-- Höchstens EINE offene Sitzung je Person.
create unique index live_sessions_one_open on public.live_sessions (user_id) where status in ('active', 'paused');
create index live_sessions_expires_at on public.live_sessions (expires_at);

-- Genau EINE Zeile je Sitzung (überschreiben, keine Historie, kein Trail).
create table public.live_positions (
  session_id uuid primary key references public.live_sessions (id) on delete cascade,
  lat numeric(8, 5) not null check (lat between -90 and 90),
  lon numeric(8, 5) not null check (lon between -180 and 180),
  accuracy_m smallint check (accuracy_m between 0 and 5000),
  recorded_at timestamptz not null,
  -- Eingang beim Server (Ratenbremse: höchstens 1 Update je 10 s).
  received_at timestamptz not null default now()
);

comment on table public.live_positions is
  'Live-Begleitung: NUR die letzte Position je Sitzung (Upsert), gelöscht bei Angekommen/Ende/Ablauf. Keine Spur.';

-- Ratenbremse der Lese-Funktion: nur HMAC-Hashes der IP bzw. Sitzungs-ids, nach 1 h gelöscht.
create table private.live_view_attempts (
  id bigint generated always as identity primary key,
  key text not null check (key ~ '^(ip:[0-9a-f]{64}|s:[0-9a-f-]{36})$'),
  created_at timestamptz not null default now()
);
create index live_view_attempts_key_time on private.live_view_attempts (key, created_at);

alter table public.live_sessions enable row level security;
alter table public.live_positions enable row level security;
alter table private.live_view_attempts enable row level security;

revoke all on table public.live_sessions, public.live_positions from public, anon, authenticated;
revoke all on table private.live_view_attempts from public, anon, authenticated;
grant all on table public.live_sessions, public.live_positions, private.live_view_attempts to service_role;

-- Besitzer liest die eigene Sitzung – OHNE token_hash (Spaltenrechte) – und die eigene letzte Position.
grant select (id, user_id, display_name, sport, status, started_at, planned_end_at, ended_at, expires_at,
              update_interval_s)
  on public.live_sessions to authenticated;
grant select on public.live_positions to authenticated;

create policy live_sessions_select_own on public.live_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy live_positions_select_own on public.live_positions
  for select to authenticated
  using (exists (select 1 from public.live_sessions s
                 where s.id = live_positions.session_id and s.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen: abgelaufene offene Sitzungen schließen (Position weg), Positionen abgeschlossener/abgelaufener Sitzungen
-- löschen, Sitzungen 24 h nach Ablauf löschen, Prüfwerte der Ratenbremse nach 1 h. Ergebnis: Anzahl gelöschter bzw.
-- geschlossener Zeilen.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.purge_live_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_closed integer;
  v_positions integer;
  v_sessions integer;
  v_attempts integer;
begin
  update public.live_sessions
     set status = 'ended', ended_at = expires_at
   where status in ('active', 'paused') and expires_at <= now();
  get diagnostics v_closed = row_count;

  delete from public.live_positions p
   using public.live_sessions s
   where p.session_id = s.id
     and (s.status in ('arrived', 'ended') or s.expires_at <= now());
  get diagnostics v_positions = row_count;

  delete from public.live_sessions where expires_at < now() - interval '24 hours';
  get diagnostics v_sessions = row_count;

  delete from private.live_view_attempts where created_at < now() - interval '1 hour';
  get diagnostics v_attempts = row_count;

  return v_closed + v_positions + v_sessions + v_attempts;
end;
$$;
revoke all on function private.purge_live_sessions() from public, anon, authenticated;
grant execute on function private.purge_live_sessions() to service_role;

-- Für die GitHub Action live-cleanup (REST /rpc, nur service_role).
create or replace function public.live_cleanup()
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.purge_live_sessions();
$$;
revoke all on function public.live_cleanup() from public, anon, authenticated;
grant execute on function public.live_cleanup() to service_role;

-- Token → Text (base64url ohne Auffüllung, 43 Zeichen).
create or replace function private.live_token_text(p_token bytea)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(encode(p_token, 'base64'), E'+/=\n', '-_');
$$;
revoke all on function private.live_token_text(bytea) from public, anon, authenticated;

-- Antwort mit dem Token im Klartext (nur einmal, für den Link der Person).
create or replace function private.live_start_json(p_row public.live_sessions, p_token bytea)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'token', private.live_token_text(p_token),
    'started_at', p_row.started_at,
    'planned_end_at', p_row.planned_end_at,
    'expires_at', p_row.expires_at);
$$;
revoke all on function private.live_start_json(public.live_sessions, bytea) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Start (nur angemeldet, nur auf ausdrücklichen Tipp in der App während bzw. vor einer Aufzeichnung). Ergebnis:
-- {id, token, started_at, planned_end_at, expires_at}. Läuft schon eine offene Sitzung: Fehler 55000, außer
-- p_replace = true (die Person hat „Alte Begleitung beenden und neu starten“ bestätigt) – dann wird die alte beendet
-- (Position gelöscht).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.start_live_session(
  p_display_name text,
  p_sport text,
  p_planned_minutes integer,
  p_update_interval_s integer default 30,
  p_replace boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_token bytea;
  v_row public.live_sessions;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 30 or v_name ~ '[[:cntrl:]]' then
    raise exception 'Ungültiger Anzeigename (1–30 Zeichen).' using errcode = '22023';
  end if;
  if p_sport is null or p_sport not in ('run', 'bike', 'walk') then
    raise exception 'Ungültige Sportart.' using errcode = '22023';
  end if;
  if p_planned_minutes is null or p_planned_minutes not between 5 and 720 then
    raise exception 'Ungültige geplante Dauer (5–720 Minuten).' using errcode = '22023';
  end if;
  if p_update_interval_s is null or p_update_interval_s not between 15 and 60 then
    raise exception 'Ungültiges Intervall (15–60 Sekunden).' using errcode = '22023';
  end if;

  perform private.purge_live_sessions();

  perform 1 from public.live_sessions
   where user_id = v_user and status in ('active', 'paused')
   for update;
  if found then
    if not coalesce(p_replace, false) then
      raise exception 'Es läuft schon eine Live-Begleitung.' using errcode = '55000';
    end if;
    delete from public.live_positions p
     using public.live_sessions s
     where p.session_id = s.id and s.user_id = v_user and s.status in ('active', 'paused');
    update public.live_sessions
       set status = 'ended', ended_at = now(),
           expires_at = least(now() + interval '2 hours', started_at + interval '12 hours')
     where user_id = v_user and status in ('active', 'paused');
  end if;

  v_token := extensions.gen_random_bytes(32);
  insert into public.live_sessions (
    user_id, token_hash, display_name, sport, started_at, planned_end_at, expires_at, update_interval_s
  ) values (
    v_user, pg_catalog.sha256(v_token), v_name, p_sport, now(),
    now() + make_interval(mins => p_planned_minutes), now() + interval '12 hours', p_update_interval_s
  )
  returning * into v_row;

  return private.live_start_json(v_row, v_token);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Position senden (nur Besitzer, nur offene, nicht abgelaufene Sitzung). Ergebnis: 'ok', 'throttled' (letztes Update
-- vor < 10 s – ignoriert), 'older' (nicht neuer als die gespeicherte – nach Funkloch zählt nur die NEUESTE),
-- 'closed' (beendet/abgelaufen). Ungültige Werte → Fehler 22023 OHNE die Werte in der Meldung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.push_live_position(
  p_session_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_accuracy_m integer,
  p_recorded_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.live_sessions;
  v_last public.live_positions;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  -- NaN/Unendlich liegen in Postgres außerhalb jedes between-Bereichs.
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    raise exception 'Ungültige Position.' using errcode = '22023';
  end if;
  if p_accuracy_m is not null and p_accuracy_m < 0 then
    raise exception 'Ungültige Genauigkeit.' using errcode = '22023';
  end if;

  select * into v_session from public.live_sessions
   where id = p_session_id and user_id = v_user
   for update;
  if not found then
    raise exception 'Live-Begleitung nicht gefunden.' using errcode = '42501';
  end if;
  if v_session.status not in ('active', 'paused') or v_session.expires_at <= now() then
    return 'closed';
  end if;
  if p_recorded_at is null or p_recorded_at > now() + interval '2 minutes'
     or p_recorded_at < v_session.started_at - interval '5 minutes' then
    raise exception 'Ungültiger Zeitpunkt.' using errcode = '22023';
  end if;

  select * into v_last from public.live_positions where session_id = v_session.id;
  if found then
    if v_last.recorded_at >= least(p_recorded_at, now()) then
      return 'older';
    end if;
    if v_last.received_at > now() - interval '10 seconds' then
      return 'throttled';
    end if;
  end if;

  insert into public.live_positions (session_id, lat, lon, accuracy_m, recorded_at, received_at)
  values (v_session.id, round(p_lat::numeric, 5), round(p_lon::numeric, 5),
          case when p_accuracy_m is null then null else least(p_accuracy_m, 5000) end,
          least(p_recorded_at, now()), now())
  on conflict (session_id) do update
    set lat = excluded.lat, lon = excluded.lon, accuracy_m = excluded.accuracy_m,
        recorded_at = excluded.recorded_at, received_at = excluded.received_at;
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Status setzen (nur Besitzer): 'active' ↔ 'paused'; 'arrived'/'ended' löschen die Position SOFORT und setzen den
-- Ablauf auf Ende + 2 h (nie nach Start + 12 h). Abgeschlossen bleibt abgeschlossen (arrived/ended erneut = ohne
-- Wirkung). Ergebnis: {id, status, expires_at}.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.set_live_status(p_session_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_session public.live_sessions;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('active', 'paused', 'arrived', 'ended') then
    raise exception 'Ungültiger Status.' using errcode = '22023';
  end if;
  select * into v_session from public.live_sessions
   where id = p_session_id and user_id = v_user
   for update;
  if not found then
    raise exception 'Live-Begleitung nicht gefunden.' using errcode = '42501';
  end if;

  if v_session.status in ('active', 'paused') and v_session.expires_at <= now() then
    -- Abgelaufen, aber noch offen (Aufräumen lief noch nicht): jetzt schließen.
    delete from public.live_positions where session_id = v_session.id;
    update public.live_sessions set status = 'ended', ended_at = expires_at
     where id = v_session.id
     returning * into v_session;
  end if;

  if v_session.status in ('arrived', 'ended') then
    if p_status in ('active', 'paused') then
      raise exception 'Diese Live-Begleitung ist beendet.' using errcode = '55000';
    end if;
    delete from public.live_positions where session_id = v_session.id;
  elsif p_status in ('active', 'paused') then
    update public.live_sessions set status = p_status where id = v_session.id
     returning * into v_session;
  else
    delete from public.live_positions where session_id = v_session.id;
    update public.live_sessions
       set status = p_status, ended_at = now(),
           expires_at = least(now() + interval '2 hours', started_at + interval '12 hours')
     where id = v_session.id
     returning * into v_session;
  end if;

  return jsonb_build_object('id', v_session.id, 'status', v_session.status, 'expires_at', v_session.expires_at);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- „Link neu erzeugen“ (nur Besitzer, nur offene Sitzung): neues Token, das alte ist sofort ungültig.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.rotate_live_token(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_token bytea := extensions.gen_random_bytes(32);
  v_row public.live_sessions;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet.' using errcode = '42501';
  end if;
  update public.live_sessions
     set token_hash = pg_catalog.sha256(v_token)
   where id = p_session_id and user_id = v_user
     and status in ('active', 'paused') and expires_at > now()
  returning * into v_row;
  if not found then
    raise exception 'Keine laufende Live-Begleitung.' using errcode = '55000';
  end if;
  return private.live_start_json(v_row, v_token);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Ansicht der Vertrauensperson (NUR service_role, über /api/begleitung). p_token_hash = SHA-256 des Tokens (64 Hex),
-- p_ip_hash = HMAC der IP (64 Hex, nie die IP selbst). Antwort (liveViewSchema in packages/core):
--   offen:          {state: active|paused, display_name, sport, started_at, server_time, position: {…}|null}
--   abgeschlossen:  {state: arrived|ended, display_name, sport, started_at, server_time, ended_at} – OHNE Ort
--   sonst:          {state: invalid} (falsch, unbekannt, abgelaufen – gleiche Antwort) bzw. {state: rate_limited}
-- Keine Gesundheitsdaten, keine Pace, keine Distanz, keine Spur.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.get_live_view(p_token_hash text, p_ip_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.live_sessions;
  v_position public.live_positions;
  v_count integer;
  v_base jsonb;
begin
  if p_ip_hash is null or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Ungültige Anfrage.' using errcode = '22023';
  end if;

  insert into private.live_view_attempts (key) values ('ip:' || p_ip_hash);
  select count(*) into v_count from private.live_view_attempts
   where key = 'ip:' || p_ip_hash and created_at > now() - interval '1 minute';
  if v_count > 10 then
    return jsonb_build_object('state', 'rate_limited');
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('state', 'invalid');
  end if;
  select * into v_session from public.live_sessions where token_hash = decode(p_token_hash, 'hex');
  if not found or v_session.expires_at <= now() then
    return jsonb_build_object('state', 'invalid');
  end if;

  insert into private.live_view_attempts (key) values ('s:' || v_session.id::text);
  select count(*) into v_count from private.live_view_attempts
   where key = 's:' || v_session.id::text and created_at > now() - interval '1 minute';
  if v_count > 30 then
    return jsonb_build_object('state', 'rate_limited');
  end if;

  v_base := jsonb_build_object(
    'state', v_session.status,
    'display_name', v_session.display_name,
    'sport', v_session.sport,
    'started_at', v_session.started_at,
    'server_time', now());

  if v_session.status in ('arrived', 'ended') then
    return v_base || jsonb_build_object('ended_at', v_session.ended_at);
  end if;

  select * into v_position from public.live_positions where session_id = v_session.id;
  return v_base || jsonb_build_object(
    'position',
    case when v_position.session_id is null then null
         else jsonb_build_object('lat', v_position.lat, 'lon', v_position.lon,
                                 'accuracy_m', v_position.accuracy_m, 'recorded_at', v_position.recorded_at)
    end);
end;
$$;

revoke all on function public.start_live_session(text, text, integer, integer, boolean) from public, anon;
revoke all on function public.push_live_position(uuid, double precision, double precision, integer, timestamptz)
  from public, anon;
revoke all on function public.set_live_status(uuid, text) from public, anon;
revoke all on function public.rotate_live_token(uuid) from public, anon;
revoke all on function public.get_live_view(text, text) from public, anon, authenticated;

grant execute on function public.start_live_session(text, text, integer, integer, boolean) to authenticated;
grant execute on function public.push_live_position(uuid, double precision, double precision, integer, timestamptz)
  to authenticated;
grant execute on function public.set_live_status(uuid, text) to authenticated;
grant execute on function public.rotate_live_token(uuid) to authenticated;
grant execute on function public.get_live_view(text, text) to service_role;

-- Aufräumen alle 5 min per pg_cron – nur, wenn die Erweiterung verfügbar ist (Supabase: ja; lokales Postgres ohne
-- pg_cron: übersprungen, dann Start/GitHub Action). Muster wie 20261018200300_live_adjust_rpcs.sql.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule('live-companion-purge', '*/5 * * * *', 'select private.purge_live_sessions()');
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet (SQLSTATE %) – Aufräumen über Start und GitHub Action.', sqlstate;
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Aufräumen über Start und GitHub Action live-cleanup.';
  end if;
end;
$cron$;
