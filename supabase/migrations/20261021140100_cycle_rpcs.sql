-- Phase 9 · Zyklus-Modul, Etappe ZY2 – Server-Funktionen (docs/PLAN-PHASE-9.md 6.3, 6.3a, 7.2a, 7.3, 7.5).
--
-- Alle Funktionen `security definer`, `search_path = ''`. Rechte: zuerst `revoke all … from public, anon,
-- authenticated, service_role`, danach `grant execute … to authenticated` nur für die public-Funktionen der App bzw.
-- `to service_role` nur für cycle_module_admin (Workflow beta-grant). Kein Server-Weg in apps/web liest Zyklusdaten.
--
-- Eingaben ohne Klartext in Fehlermeldungen (B3): Jeder Wert wird VOR einem Cast mit jsonb_typeof und Bereich geprüft;
-- jede Funktion steckt in einem äußeren Block, der jeden anderen Fehler als `cycle_payload_invalid` meldet (ohne
-- detail, hint oder Wert). Fehler nur als feste Codes: cycle_consent_missing, cycle_consent_outdated,
-- cycle_payload_invalid, cycle_rate_limited, cycle_module_closed. Aufruf nur per POST (supabase-js rpc ohne get).
--
-- Lesen, Export und Löschen gehen immer – auch ohne (gültige) Einwilligung und ohne Freischaltung (Art. 15/17).
-- Schreiben nur mit Freischaltung (N3) und gültiger Einwilligung, gesperrt FOR SHARE (gleichzeitiger Widerruf).
--
-- sync: CYCLE_RULES (backfillDays 60, writesPerDay 200, maxRangeDays 400, retentionMonths 24) und die Listen in
-- packages/core/src/cycle/schemas.ts (cycle/db-sync.test.ts).

-- ---------------------------------------------------------------------------------------------------------
-- Hilfsfunktionen (keine API-Rolle)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.cycle_key(p_version smallint)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'cycle_data_key_v' || p_version::text;
$$;
revoke all on function private.cycle_key(smallint) from public, anon, authenticated, service_role;

-- Aktuelle Schlüssel-Version für neue Schreibvorgänge (Rotation: Workflow cycle-key-rotate, später).
create or replace function private.cycle_current_key_version()
returns smallint
language sql
stable
set search_path = ''
as $$
  select 1::smallint;
$$;
revoke all on function private.cycle_current_key_version() from public, anon, authenticated, service_role;

create or replace function private.cycle_encrypt(p_payload jsonb, p_version smallint)
returns bytea
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  key text := private.cycle_key(p_version);
begin
  if key is null then
    raise exception 'cycle_key_missing';
  end if;
  -- AES-256, ohne Kompression (K5). Der Schlüssel ist bereits 256 Bit zufällig – S2K ohne Iterationen (s2k-mode=1,
  -- mit Salz) spart Rechenzeit ohne Sicherheitsverlust (Messung in docs/SETUP.md Teil Z).
  return extensions.pgp_sym_encrypt(p_payload::text, key, 'cipher-algo=aes256, compress-algo=0, s2k-mode=1');
end;
$$;
revoke all on function private.cycle_encrypt(jsonb, smallint) from public, anon, authenticated, service_role;

create or replace function private.cycle_decrypt(p_data bytea, p_version smallint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  key text := private.cycle_key(p_version);
begin
  if key is null then
    raise exception 'cycle_key_missing';
  end if;
  return extensions.pgp_sym_decrypt(p_data, key)::jsonb;
end;
$$;
revoke all on function private.cycle_decrypt(bytea, smallint) from public, anon, authenticated, service_role;

-- Kalendertag Europe/Berlin (DACH; gleicher Stichtag wie die Altersprüfung).
create or replace function private.cycle_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Berlin')::date;
$$;
revoke all on function private.cycle_today() from public, anon, authenticated, service_role;

-- Ist `p` ein Datum im Format JJJJ-MM-TT (als JSON-Text)? Ohne Cast-Fehler.
create or replace function private.cycle_is_date_text(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p) <> 'string' or (p #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then
    return false;
  end if;
  perform to_date(p #>> '{}', 'YYYY-MM-DD');
  return to_char(to_date(p #>> '{}', 'YYYY-MM-DD'), 'YYYY-MM-DD') = (p #>> '{}');
exception
  when others then
    return false;
end;
$$;
revoke all on function private.cycle_is_date_text(jsonb) from public, anon, authenticated, service_role;

-- Datum aus Text (Parameter der App) – Text statt `date`, damit ein ungültiger Wert nie schon beim Cast in PostgREST
-- samt Wert im Log landet (B3). Ungültig → null.
create or replace function private.cycle_parse_date(p text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  d date;
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  d := p::date;
  return case when to_char(d, 'YYYY-MM-DD') = p then d end;
exception
  when others then
    return null;
end;
$$;
revoke all on function private.cycle_parse_date(text) from public, anon, authenticated, service_role;

-- Zeitstempel aus Text (Einwilligungszeitpunkt der Warteschlange, S5). Ungültig → null (→ cycle_consent_outdated).
create or replace function private.cycle_parse_timestamp(p text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
begin
  if p is null or length(p) > 40 or p !~ '^\d{4}-\d{2}-\d{2}[T ][0-9:.]+(Z|[+-]\d{2}(:?\d{2})?)$' then
    return null;
  end if;
  return p::timestamptz;
exception
  when others then
    return null;
end;
$$;
revoke all on function private.cycle_parse_timestamp(text) from public, anon, authenticated, service_role;

-- Ganzzahl 1–5 (Energie, Schlaf) oder JSON-null.
create or replace function private.cycle_is_scale(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p is null
    or jsonb_typeof(p) = 'null'
    or (jsonb_typeof(p) = 'number' and (p #>> '{}') ~ '^[1-5]$');
$$;
revoke all on function private.cycle_is_scale(jsonb) from public, anon, authenticated, service_role;

-- Tages-Check (sync: cycleEntryPayloadSchema). Gibt nur true/false zurück – nie den Wert.
create or replace function private.cycle_valid_entry(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  k text;
  v jsonb;
  filled boolean := false;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 2000 then
    return false;
  end if;
  for k, v in select * from jsonb_each(p) loop
    if k = 'bleeding' then
      if jsonb_typeof(v) = 'null' then continue; end if;
      -- sync: CYCLE_BLEEDING_LEVELS
      if jsonb_typeof(v) <> 'string'
         or (v #>> '{}') not in ('none', 'spotting', 'light', 'medium', 'heavy') then
        return false;
      end if;
      filled := true;
    elsif k in ('energy', 'sleep') then
      if not private.cycle_is_scale(v) then return false; end if;
      if jsonb_typeof(v) <> 'null' then filled := true; end if;
    elsif k = 'symptoms' then
      if jsonb_typeof(v) <> 'object' then return false; end if;
      if exists (
        select 1 from jsonb_each(v) s
        -- sync: CYCLE_SYMPTOMS und CYCLE_SYMPTOM_INTENSITIES
        where s.key not in ('cramps', 'headache', 'back_pain', 'breast_tenderness', 'digestion', 'nausea',
                            'fatigue', 'low_mood', 'hot_flushes', 'sleep_problems')
           or jsonb_typeof(s.value) <> 'string'
           or (s.value #>> '{}') not in ('mild', 'strong')
      ) then
        return false;
      end if;
      if exists (select 1 from jsonb_object_keys(v)) then filled := true; end if;
    else
      return false;
    end if;
  end loop;
  return filled;
end;
$$;
revoke all on function private.cycle_valid_entry(jsonb) from public, anon, authenticated, service_role;

-- Einstellungen (sync: cycleSettingsSchema, strict – alle Schlüssel Pflicht, keine weiteren).
create or replace function private.cycle_valid_settings(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  reminder jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 4000 then
    return false;
  end if;
  if (select array_agg(k order by k) from jsonb_object_keys(p) k)
     <> array['dismissed', 'enabledOn', 'lastPeriodAtStart', 'noBleedingConfirmedUntil', 'paused', 'reminder',
              'sleepTracking', 'status'] then
    return false;
  end if;
  -- sync: CYCLE_STATUSES
  if jsonb_typeof(p -> 'status') <> 'null' and (
       jsonb_typeof(p -> 'status') <> 'string'
       or (p ->> 'status') not in ('natural', 'hormonal_contraception', 'perimenopause', 'postmenopause',
                                   'breastfeeding', 'pregnant', 'unspecified')) then
    return false;
  end if;
  -- sync: CYCLE_LAST_PERIOD_ANSWERS
  if jsonb_typeof(p -> 'lastPeriodAtStart') <> 'null' and (
       jsonb_typeof(p -> 'lastPeriodAtStart') <> 'string'
       or (p ->> 'lastPeriodAtStart') not in ('under_1_month', '1_to_3_months', 'over_3_months', 'unknown')) then
    return false;
  end if;
  if jsonb_typeof(p -> 'enabledOn') <> 'null' and not private.cycle_is_date_text(p -> 'enabledOn') then
    return false;
  end if;
  if jsonb_typeof(p -> 'noBleedingConfirmedUntil') <> 'null'
     and not private.cycle_is_date_text(p -> 'noBleedingConfirmedUntil') then
    return false;
  end if;
  if jsonb_typeof(p -> 'paused') <> 'boolean' or jsonb_typeof(p -> 'sleepTracking') <> 'boolean' then
    return false;
  end if;
  reminder := p -> 'reminder';
  if jsonb_typeof(reminder) <> 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(reminder) k) <> array['enabled', 'time']
     or jsonb_typeof(reminder -> 'enabled') <> 'boolean'
     or jsonb_typeof(reminder -> 'time') <> 'string'
     or (reminder ->> 'time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    return false;
  end if;
  if jsonb_typeof(p -> 'dismissed') <> 'object' or exists (
    select 1 from jsonb_each(p -> 'dismissed') d
    -- sync: CYCLE_DISMISSIBLE_CODES
    where d.key not in ('W1', 'W1b', 'W1c', 'W2', 'W3', 'W3_hormonal', 'W4', 'W4_hormonal', 'W5', 'W6', 'W8',
                        'mood_support', 'lighter_often', 'iron')
       or not private.cycle_is_date_text(d.value)
  ) then
    return false;
  end if;
  return true;
end;
$$;
revoke all on function private.cycle_valid_settings(jsonb) from public, anon, authenticated, service_role;

-- Gemeinsame Schreib-Prüfung: angemeldet, freigeschaltet, gültige Einwilligung (FOR SHARE), nicht veraltet,
-- Ratenbegrenzung. Wirft nur feste Codes.
create or replace function private.cycle_check_write(p_user_id uuid, p_consent_granted_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: CYCLE_RULES.writesPerDay
  max_writes constant integer := 200;
  granted timestamptz;
  writes integer;
begin
  if p_user_id is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  if not private.cycle_module_open_for(p_user_id) then
    raise exception 'cycle_module_closed' using errcode = '42501';
  end if;
  select c.granted_at into granted
  from public.consents c
  where c.user_id = p_user_id
    and c.consent_type = 'cycle_data'
    and c.revoked_at is null
    and c.version = public.current_consent_version('cycle_data')
  order by c.granted_at desc
  limit 1
  for share;
  if granted is null then
    raise exception 'cycle_consent_missing' using errcode = '42501';
  end if;
  -- S5: Einträge aus einer früheren Einwilligung (z. B. offline auf einem zweiten Gerät erfasst) werden abgelehnt.
  -- Millisekunden reichen (die App kennt den Zeitpunkt aus JavaScript).
  if p_consent_granted_at is null or p_consent_granted_at < date_trunc('milliseconds', granted) then
    raise exception 'cycle_consent_outdated' using errcode = '42501';
  end if;
  insert into private.cycle_write_counts as w (user_id, day, writes)
  values (p_user_id, private.cycle_today(), 1)
  on conflict (user_id, day) do update set writes = w.writes + 1
  returning w.writes into writes;
  if writes > max_writes then
    raise exception 'cycle_rate_limited' using errcode = '54000';
  end if;
  delete from private.cycle_write_counts w where w.user_id = p_user_id and w.day < private.cycle_today() - 2;
end;
$$;
revoke all on function private.cycle_check_write(uuid, timestamptz) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- App-Funktionen (nur authenticated)
-- ---------------------------------------------------------------------------------------------------------

-- Anzeige in der App: Modul offen (Freischaltung) und Flag cycle_warnings. Die Wahrheit prüft jede Schreibfunktion.
create or replace function public.cycle_module_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'open', auth.uid() is not null and private.cycle_module_open_for(auth.uid()),
    'warnings', coalesce((select c.warnings_enabled from private.cycle_module_config c where c.id), true)
  );
$$;

create or replace function public.save_cycle_entry(
  p_date text,
  p_payload jsonb,
  p_consent_granted_at text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  -- sync: CYCLE_RULES.backfillDays
  backfill_days constant integer := 60;
  version smallint := private.cycle_current_key_version();
  d date := private.cycle_parse_date(p_date);
begin
  begin
    perform private.cycle_check_write(uid, private.cycle_parse_timestamp(p_consent_granted_at));
    if d is null or d > private.cycle_today() or d < private.cycle_today() - backfill_days
       or not private.cycle_valid_entry(p_payload) then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
    end if;
    insert into private.cycle_entries as e (user_id, entry_date, payload_enc, key_version)
    values (uid, d, private.cycle_encrypt(p_payload, version), version)
    on conflict (user_id, entry_date) do update
      set payload_enc = excluded.payload_enc, key_version = excluded.key_version, updated_at = now();
  exception
    when raise_exception or insufficient_privilege or invalid_parameter_value or program_limit_exceeded then
      raise;
    when others then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
  end;
  return jsonb_build_object('saved', d);
end;
$$;

create or replace function public.delete_cycle_entry(p_date text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  delete from private.cycle_entries e
  where e.user_id = uid and e.entry_date = private.cycle_parse_date(p_date);
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- „Alle Einträge löschen“ ohne Widerruf (Einstellungen bleiben).
create or replace function public.delete_all_cycle_entries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  removed integer;
begin
  if uid is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  delete from private.cycle_entries e where e.user_id = uid;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- Einträge im Zeitraum (höchstens 400 Tage), entschlüsselt über TLS an die App. Nur eigene (auth.uid()).
create or replace function public.get_cycle_entries(p_from text, p_to text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  -- sync: CYCLE_RULES.maxRangeDays
  max_range constant integer := 400;
  d_from date := private.cycle_parse_date(p_from);
  d_to date := private.cycle_parse_date(p_to);
  result jsonb;
begin
  if uid is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  if d_from is null or d_to is null or d_to < d_from or d_to - d_from > max_range then
    raise exception 'cycle_payload_invalid' using errcode = '22023';
  end if;
  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'entry_date', e.entry_date,
             'payload', private.cycle_decrypt(e.payload_enc, e.key_version),
             'updated_at', e.updated_at) order by e.entry_date), '[]'::jsonb)
      into result
    from private.cycle_entries e
    where e.user_id = uid and e.entry_date between d_from and d_to;
  exception
    when others then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
  end;
  return result;
end;
$$;

create or replace function public.save_cycle_settings(p_payload jsonb, p_consent_granted_at text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  version smallint := private.cycle_current_key_version();
begin
  begin
    perform private.cycle_check_write(uid, private.cycle_parse_timestamp(p_consent_granted_at));
    if not private.cycle_valid_settings(p_payload) then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
    end if;
    insert into private.cycle_settings as s (user_id, payload_enc, key_version)
    values (uid, private.cycle_encrypt(p_payload, version), version)
    on conflict (user_id) do update
      set payload_enc = excluded.payload_enc, key_version = excluded.key_version, updated_at = now();
  exception
    when raise_exception or insufficient_privilege or invalid_parameter_value or program_limit_exceeded then
      raise;
    when others then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
  end;
  return jsonb_build_object('saved', true);
end;
$$;

create or replace function public.get_cycle_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  begin
    select jsonb_build_object(
             'payload', private.cycle_decrypt(s.payload_enc, s.key_version),
             'updated_at', s.updated_at)
      into result
    from private.cycle_settings s
    where s.user_id = uid;
  exception
    when others then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
  end;
  return result;
end;
$$;

-- Datenexport (Art. 15/20): Einstellungen und alle Einträge entschlüsselt, ohne key_version. Eigene Funktion statt
-- eines Blocks in export_my_data() (parallele Fassungen dürfen ihn nicht überschreiben); die App hängt das Ergebnis
-- als cycle_settings/cycle_entries an die Export-Datei.
create or replace function public.export_my_cycle_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  settings jsonb;
  entries jsonb;
begin
  if uid is null then
    raise exception 'cycle_not_signed_in' using errcode = '42501';
  end if;
  begin
    select jsonb_build_object(
             'payload', private.cycle_decrypt(s.payload_enc, s.key_version),
             'updated_at', s.updated_at)
      into settings
    from private.cycle_settings s
    where s.user_id = uid;
    select coalesce(jsonb_agg(jsonb_build_object(
             'entry_date', e.entry_date,
             'payload', private.cycle_decrypt(e.payload_enc, e.key_version),
             'updated_at', e.updated_at) order by e.entry_date), '[]'::jsonb)
      into entries
    from private.cycle_entries e
    where e.user_id = uid;
  exception
    when others then
      raise exception 'cycle_payload_invalid' using errcode = '22023';
  end;
  return jsonb_build_object('settings', settings, 'entries', entries);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Aufbewahrung 24 Monate (ZY-G8) – täglich per pg_cron (Muster N7)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.cycle_retention()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  -- sync: CYCLE_RULES.retentionMonths
  delete from private.cycle_entries e
  where e.entry_date < (private.cycle_today() - interval '24 months')::date;
  get diagnostics removed = row_count;
  delete from private.cycle_write_counts w where w.day < private.cycle_today() - 2;
  return removed;
end;
$$;

do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    begin
      create extension if not exists pg_cron with schema pg_catalog;
      perform cron.schedule('cycle-retention', '17 3 * * *', 'select private.cycle_retention()');
    exception
      when others then
        raise notice 'pg_cron nicht eingerichtet (SQLSTATE %) – Aufbewahrung bitte per Hand prüfen.', sqlstate;
    end;
  else
    raise notice 'pg_cron nicht verfügbar – Aufbewahrung läuft nur in der echten Datenbank.';
  end if;
end;
$cron$;

-- ---------------------------------------------------------------------------------------------------------
-- Workflow beta-grant (nur service_role): Flags cycle_module / cycle_warnings und Freischaltung je Konto.
-- Antworten ohne Personenbezug (nur Zahlen), jede Aktion in private.admin_actions.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.cycle_module_admin(
  p_action text,
  p_actor text,
  p_email text default null,
  p_days integer default 90,
  p_flag text default 'cycle_module'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_pattern constant text := '^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,}$';
  target uuid;
  expires timestamptz;
begin
  if p_actor is null or p_actor !~ '^[A-Za-z0-9-]{1,39}$'
     or p_action is null or p_action not in ('grant', 'revoke', 'flag_on', 'flag_off', 'status')
     or p_flag is null or p_flag not in ('cycle_module', 'cycle_warnings') then
    return jsonb_build_object('result', 'invalid_input');
  end if;
  if p_action in ('grant', 'revoke') then
    if p_flag <> 'cycle_module' or p_email is null or p_email !~ email_pattern or p_email ~ '[\r\n]' then
      return jsonb_build_object('result', 'invalid_input');
    end if;
    select u.id into target from auth.users u where lower(u.email) = lower(p_email);
    if target is null then
      return jsonb_build_object('result', 'not_found');
    end if;
    if p_action = 'grant' then
      if p_days is null or p_days not between 1 and 180 then
        return jsonb_build_object('result', 'invalid_input');
      end if;
      expires := now() + make_interval(days => p_days);
      insert into private.cycle_module_grants (user_id, granted_at, granted_by, expires_at)
      values (target, now(), p_actor, expires)
      on conflict (user_id) do update
        set granted_at = excluded.granted_at, granted_by = excluded.granted_by, expires_at = excluded.expires_at;
      insert into private.admin_actions (action, actor, target_user_id, flag_key, expires_at)
      values ('beta_grant', p_actor, target, 'cycle_module', expires);
      return jsonb_build_object('result', 'granted',
        'expires_on', to_char((expires at time zone 'Europe/Berlin')::date, 'DD.MM.YYYY'));
    end if;
    -- Entziehen: Schreiben endet; Lesen, Export, Löschen und Widerruf bleiben (Art. 15/17).
    delete from private.cycle_module_grants g where g.user_id = target;
    insert into private.admin_actions (action, actor, target_user_id, flag_key)
    values ('beta_revoke', p_actor, target, 'cycle_module');
    return jsonb_build_object('result', 'revoked');
  end if;
  if p_action in ('flag_on', 'flag_off') then
    if p_flag = 'cycle_module' then
      update private.cycle_module_config
      set enabled = p_action = 'flag_on', updated_at = now(), updated_by = p_actor
      where id;
    else
      update private.cycle_module_config
      set warnings_enabled = p_action = 'flag_on', updated_at = now(), updated_by = p_actor
      where id;
    end if;
    insert into private.admin_actions (action, actor, flag_key) values (p_action, p_actor, p_flag);
    return jsonb_build_object('result', p_action);
  end if;
  return jsonb_build_object(
    'result', 'status',
    'flag', p_flag,
    'flag_enabled', (select case when p_flag = 'cycle_module' then c.enabled else c.warnings_enabled end
                     from private.cycle_module_config c where c.id),
    'open_for_all', (select c.open_for_all from private.cycle_module_config c where c.id),
    'active_grants', (select count(*) from private.cycle_module_grants g where g.expires_at > now()));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte (S4): erst allen alles nehmen, dann gezielt geben.
-- ---------------------------------------------------------------------------------------------------------
revoke all on function private.cycle_retention() from public, anon, authenticated, service_role;
revoke all on function public.cycle_module_access() from public, anon, authenticated, service_role;
revoke all on function public.save_cycle_entry(text, jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.delete_cycle_entry(text) from public, anon, authenticated, service_role;
revoke all on function public.delete_all_cycle_entries() from public, anon, authenticated, service_role;
revoke all on function public.get_cycle_entries(text, text) from public, anon, authenticated, service_role;
revoke all on function public.save_cycle_settings(jsonb, text) from public, anon, authenticated, service_role;
revoke all on function public.get_cycle_settings() from public, anon, authenticated, service_role;
revoke all on function public.export_my_cycle_data() from public, anon, authenticated, service_role;
revoke all on function public.cycle_module_admin(text, text, text, integer, text)
  from public, anon, authenticated, service_role;

grant execute on function public.cycle_module_access() to authenticated;
grant execute on function public.save_cycle_entry(text, jsonb, text) to authenticated;
grant execute on function public.delete_cycle_entry(text) to authenticated;
grant execute on function public.delete_all_cycle_entries() to authenticated;
grant execute on function public.get_cycle_entries(text, text) to authenticated;
grant execute on function public.save_cycle_settings(jsonb, text) to authenticated;
grant execute on function public.get_cycle_settings() to authenticated;
grant execute on function public.export_my_cycle_data() to authenticated;
grant execute on function public.cycle_module_admin(text, text, text, integer, text) to service_role;
