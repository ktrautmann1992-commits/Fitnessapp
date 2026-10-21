-- Phase 8 · Etappe H2 · Smartwatch über Health Connect (docs/PLAN-PHASE-8.md 4, 5, 6; Gründer-Freigabe W8-1…W8-13).
-- Rein additiv:
-- 1. Einwilligungstext wearable_data Version 1 (consent_documents; CURRENT_CONSENT_VERSIONS in packages/core).
-- 2. Tabellen (RLS: nur eigene Zeilen lesen; Schreiben nur über die Funktionen unten, security definer):
--    - wearable_connections: Verbindung je Person und Quelle (Stand, freigegebene Datentypen, letzter Abgleich),
--    - wearable_sessions: Verknüpfung Tagebuch-Eintrag ↔ Health-Connect-Datensatz (external_id = metadata.id,
--      eindeutig je Person und Quelle → ein erneuter Abgleich ändert, legt nie neu an), Herkunft, kcal, ob die
--      Uhr-Einheit in einen eigenen Eintrag eingegangen ist (merged, App führend, W8-9) bzw. ein möglicher Doppel-Eintrag
--      (duplicate_of). Eigene Tabelle statt Spalten in session_logs: save_session_log bleibt unangetastet und eine
--      Änderung des Eintrags in der App verliert kcal/Verknüpfung nicht.
--    - heart_rate_summaries: nur Ø, Max und Sekunden je Pulszone je Einheit (W8-6, keine Pulsreihen),
--    - daily_metrics: Ruhepuls, Schlafdauer, Schritte je Tag (keine Schlafphasen, keine Einzelwerte).
-- 3. Funktionen connect_wearable, import_wearable_batch, resolve_wearable_duplicate, disconnect_wearable.
-- Grenzen = WEARABLE_SYNC, HEART_RATE_LIMITS, DAILY_METRIC_LIMITS (packages/core/src/constants.ts), Listen =
-- WEARABLE_DATA_TYPES, WEARABLE_ORIGINS, WEARABLE_SESSION_GROUPS, WEARABLE_NAME_PATTERN (packages/core/src/wearables);
-- Abgleich in db-sync.test.ts. Widerruf und Export folgen in 20261021120200_wearable_revoke_export.sql.
-- Datenschutz (DSGVO Art. 9): Fehlermeldungen ohne Werte; Puls und Tageswerte nie in Logs; kein Partner-Zugriff.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Einwilligungstext
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'wearable_data',
  1,
  'Einwilligung: Daten deiner Smartwatch übernehmen',
  $txt$ENTWURF – juristisch prüfen

Mit „Smartwatch verbinden“ übernimmt Alpha5 Daten deiner Smartwatch (z. B. Galaxy Watch) aus Health Connect auf deinem Android-Handy. Health Connect ist die Datensammelstelle von Android; die App deiner Uhr (z. B. Samsung Health) schreibt dort hinein. Alpha5 liest nur – wir schreiben nichts zurück und sprechen nie direkt mit deiner Uhr.

Welche Daten: nur die Arten, die du im Health-Connect-Dialog erlaubst:
- Trainingseinheiten (Art, Beginn, Ende, Distanz, verbrauchte kcal),
- Puls während deiner Einheiten – gespeichert wird nur eine Zusammenfassung je Einheit (Durchschnitt, Maximum, Minuten je Pulszone), keine Pulskurve,
- Ruhepuls je Tag, Schlafdauer je Nacht (ohne Schlafphasen) und Schritte je Tag.
Strecken (GPS) deiner Uhr übernehmen wir nicht.

Wofür: ausschließlich für dein Trainingstagebuch und deine eigenen Auswertungen (z. B. Puls und Pulszonen einer Einheit, Tageswerte). Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner, nicht im Partner-Modus und nie auf geteilten Bildern.

Speicherort und Dauer: auf Servern in der EU (Frankfurt am Main), solange dein Konto besteht oder bis du die Verbindung trennst bzw. diese Einwilligung widerrufst.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG). Voraussetzung ist zusätzlich deine Einwilligung in die Verarbeitung von Gesundheitsdaten.

Freiwillig: Ohne diese Einwilligung nutzt du die App wie bisher; Einheiten kannst du weiter selbst eintragen oder aufzeichnen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle Pulswerte, alle Tageswerte (Ruhepuls, Schlaf, Schritte) und die Verbindung. Übernommene Trainingseinheiten bleiben als normale Einträge ohne Puls in deinem Tagebuch – du kannst sie dort löschen. Beim Trennen der Uhr fragen wir dich, ob du die übernommenen Einheiten behalten oder löschen möchtest. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.$txt$,
  now()
)
on conflict (consent_type, version) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. Tabellen
-- ---------------------------------------------------------------------------------------------------------
create table public.wearable_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.wearable_provider not null,
  status public.wearable_connection_status not null,
  -- Freigegebene Datentypen (WEARABLE_DATA_TYPES); leer = alle Rechte in Health Connect entzogen.
  granted_types text[] not null default '{}'
    check (granted_types <@ array['exercise', 'distance', 'calories', 'heart_rate', 'resting_heart_rate', 'sleep', 'steps']::text[]
      and cardinality(granted_types) <= 7),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  -- Neu übernommene bzw. zusammengeführte Einheiten beim letzten Abgleich.
  last_sync_count integer check (last_sync_count between 0 and 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider),
  check ((status = 'connected') = (cardinality(granted_types) > 0))
);

comment on table public.wearable_connections is
  'Smartwatch-Verbindung je Person und Quelle (Phase 8, Health Connect): Stand, freigegebene Datentypen, letzter '
  'Abgleich – keine Messwerte. Beim Trennen und beim Widerruf wearable_data/health_data gelöscht. Schreiben nur über '
  'connect_wearable/import_wearable_batch/disconnect_wearable.';

create table public.wearable_sessions (
  session_log_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.wearable_provider not null,
  -- Health Connect metadata.id (WEARABLE_SYNC.externalIdMaxLength).
  external_id text not null check (char_length(external_id) between 1 and 200),
  -- App, die den Datensatz geschrieben hat (WEARABLE_ORIGINS) – nie der Paketname.
  origin text not null
    check (origin in ('samsung_health', 'google_fit', 'fitbit', 'garmin', 'polar', 'other')),
  -- Beginn/Ende der Uhr-Einheit (bei merged weicht der Eintrag ab).
  started_at timestamptz not null,
  finished_at timestamptz not null,
  -- TotalCaloriesBurned im Zeitraum der Einheit (WEARABLE_SYNC.kcal).
  kcal integer check (kcal between 0 and 10000),
  -- true = die Uhr-Einheit ist in einen eigenen Eintrag (App-Aufzeichnung/Eintrag) eingegangen; der Eintrag bleibt
  -- führend und wird beim Trennen mit „löschen“ NICHT gelöscht.
  merged boolean not null default false,
  -- Möglicher Doppel-Eintrag (20–50 % Überlappung bzw. ohne Uhrzeit): die Person entscheidet.
  duplicate_of uuid,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, external_id),
  foreign key (session_log_id, user_id) references public.session_logs (id, user_id) on delete cascade,
  foreign key (duplicate_of, user_id) references public.session_logs (id, user_id) on delete set null (duplicate_of),
  check (finished_at > started_at),
  check (not (merged and duplicate_of is not null)),
  check (duplicate_of is distinct from session_log_id)
);

comment on table public.wearable_sessions is
  'Übernommene Smartwatch-Einheiten (Phase 8): Verknüpfung Tagebuch-Eintrag ↔ Health-Connect-Datensatz, Herkunft, '
  'kcal, Zusammenführung/Doppel-Hinweis. Bleibt beim Widerruf (Einträge werden normale Einträge ohne Puls). '
  'Schreiben nur über import_wearable_batch/resolve_wearable_duplicate/disconnect_wearable.';

create index wearable_sessions_user_idx on public.wearable_sessions (user_id);
create index wearable_sessions_duplicate_idx on public.wearable_sessions (duplicate_of) where duplicate_of is not null;

create table public.heart_rate_summaries (
  session_log_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- HEART_RATE_LIMITS.sampleBpm
  avg_bpm smallint not null check (avg_bpm between 30 and 230),
  max_bpm smallint not null check (max_bpm between 30 and 230),
  -- Sekunden in Zone 1–5 (HR_ZONE_PERCENTS), je höchstens 12 h.
  zone_s integer[] not null
    check (cardinality(zone_s) = 5 and array_position(zone_s, null) is null and 0 <= all (zone_s)
      and 43200 >= all (zone_s)),
  -- Verwendeter HFmax (geschätzt nach Tanaka oder eigener Wert, HEART_RATE_LIMITS.maxOverrideBpm).
  hf_max_used smallint not null check (hf_max_used between 120 and 230),
  updated_at timestamptz not null default now(),
  foreign key (session_log_id, user_id) references public.session_logs (id, user_id) on delete cascade,
  check (max_bpm >= avg_bpm)
);

comment on table public.heart_rate_summaries is
  'SENSIBEL (Art. 9): Puls-Zusammenfassung je Einheit aus der Smartwatch (Ø, Max, Sekunden je Zone; keine '
  'Pulsreihen, W8-6). Nur mit Einwilligung wearable_data + health_data, beim Widerruf und beim Trennen IMMER '
  'gelöscht (W8-12), nie loggen, nie auf dem Story-Bild. Schreiben nur über import_wearable_batch.';

create index heart_rate_summaries_user_idx on public.heart_rate_summaries (user_id);

create table public.daily_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  provider public.wearable_provider not null,
  -- DAILY_METRIC_LIMITS (Ruhepuls wie body_metrics.resting_heart_rate_bpm)
  resting_hr_bpm smallint check (resting_hr_bpm between 30 and 120),
  sleep_min smallint check (sleep_min between 0 and 1440),
  steps integer check (steps between 0 and 100000),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, day),
  check (num_nonnulls(resting_hr_bpm, sleep_min, steps) >= 1)
);

comment on table public.daily_metrics is
  'SENSIBEL (Art. 9): Tageswerte aus der Smartwatch (Ruhepuls, Schlafdauer am Aufwachtag, Schritte; keine '
  'Schlafphasen, keine Einzelwerte). Nur mit Einwilligung wearable_data + health_data, beim Widerruf und beim Trennen '
  'gelöscht, nie loggen. Schreiben nur über import_wearable_batch.';

alter table public.wearable_connections enable row level security;
alter table public.wearable_sessions enable row level security;
alter table public.heart_rate_summaries enable row level security;
alter table public.daily_metrics enable row level security;

revoke all on table public.wearable_connections from public, anon, authenticated;
revoke all on table public.wearable_sessions from public, anon, authenticated;
revoke all on table public.heart_rate_summaries from public, anon, authenticated;
revoke all on table public.daily_metrics from public, anon, authenticated;
grant select on table public.wearable_connections to authenticated;
grant select on table public.wearable_sessions to authenticated;
grant select on table public.heart_rate_summaries to authenticated;
grant select on table public.daily_metrics to authenticated;
grant all on table public.wearable_connections to service_role;
grant all on table public.wearable_sessions to service_role;
grant all on table public.heart_rate_summaries to service_role;
grant all on table public.daily_metrics to service_role;

create policy "Nutzer sehen eigene Smartwatch-Verbindungen"
  on public.wearable_connections for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen eigene übernommene Einheiten"
  on public.wearable_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen eigene Puls-Zusammenfassungen"
  on public.heart_rate_summaries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer sehen eigene Tageswerte"
  on public.daily_metrics for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 3a. private.wearable_consents_locked(): Einwilligungen wearable_data UND health_data gültig? Sperrt sie vorher
-- FOR SHARE (Wächter N7 S2: ein gleichzeitiger Widerruf wartet, bis der Abgleich fertig ist, und löscht danach).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.wearable_consents_locked(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.consents c
  where c.user_id = p_user_id and c.consent_type in ('health_data', 'wearable_data') and c.revoked_at is null
  order by c.id
  for share;
  return public.has_valid_consent('wearable_data') and public.has_valid_consent('health_data');
end;
$$;

revoke all on function private.wearable_consents_locked(uuid) from public, anon;
grant execute on function private.wearable_consents_locked(uuid) to authenticated;

-- Freigegebene Datentypen prüfen (Liste wie WEARABLE_DATA_TYPES, ohne Doppel). Nie ein Fehler.
create or replace function private.wearable_types_valid(p_types jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_types) = 'array'
    and jsonb_array_length(p_types) <= 7
    and not exists (
      select 1 from jsonb_array_elements(p_types) t
      where jsonb_typeof(t) <> 'string'
        or t #>> '{}' not in ('exercise', 'distance', 'calories', 'heart_rate', 'resting_heart_rate', 'sleep', 'steps')
    )
    and (select count(distinct t #>> '{}') from jsonb_array_elements(p_types) t) = jsonb_array_length(p_types),
    false)
$$;

revoke all on function private.wearable_types_valid(jsonb) from public;

-- ---------------------------------------------------------------------------------------------------------
-- 3b. connect_wearable(p_provider, p_granted_types) – Verbindung anlegen bzw. Rechte aktualisieren (nach dem
-- Systemdialog). Erst Einwilligung (wearable_data + health_data), dann Systemdialog, dann diese Funktion.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.connect_wearable(p_provider public.wearable_provider, p_granted_types jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_types text[];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if not private.wearable_consents_locked(current_user_id) then
    raise exception 'Einwilligung Smartwatch-Daten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if p_provider is null or not private.wearable_types_valid(p_granted_types) then
    raise exception 'Ungültige Angaben zur Verbindung.' using errcode = 'invalid_parameter_value';
  end if;
  select coalesce(array_agg(t #>> '{}' order by t #>> '{}'), '{}') into v_types
  from jsonb_array_elements(p_granted_types) t;
  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));
  insert into public.wearable_connections as w (user_id, provider, status, granted_types)
  values (
    current_user_id, p_provider,
    case when cardinality(v_types) > 0 then 'connected' else 'permission_missing' end::public.wearable_connection_status,
    v_types
  )
  on conflict (user_id, provider) do update
  set status = excluded.status, granted_types = excluded.granted_types, updated_at = now();
end;
$$;

revoke all on function public.connect_wearable(public.wearable_provider, jsonb) from public, anon;
grant execute on function public.connect_wearable(public.wearable_provider, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3c. import_wearable_batch(p_batch jsonb) → {"created", "updated", "merged", "skipped", "days"}
-- Eingabe = wearableImportBatchSchema (packages/core/src/wearables/schema.ts). Ablauf:
-- - Einwilligung wearable_data + health_data (FOR SHARE gesperrt) → sonst Ablehnung ohne Werte,
-- - Aufbau falsch (Felder, Größe, mehr als 500 Einheiten/62 Tage) → Ablehnung; EINZELNE ungültige Einheiten bzw.
--   Tage werden übersprungen und gezählt (die Warteschlange bleibt nie hängen),
-- - Einheit schon bekannt (gleiche external_id) → ändern, nie neu anlegen (idempotent),
-- - merge_into: eigener Eintrag derselben Gruppe, noch ohne Uhr-Einheit, zeitlich überlappend (bzw. ohne Uhrzeit am
--   selben Tag) → Uhr ergänzt Puls und kcal, der Eintrag bleibt führend; sonst als neue Einheit,
-- - neue Einheit → freier Tagebuch-Eintrag mit Herkunft health_connect (Ausdauer mit cardio_logs), possible_duplicate_of
--   nur auf einen eigenen Eintrag,
-- - Tageswerte: je Tag ersetzen; fehlende Werte (null) behalten den gespeicherten Wert.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.import_wearable_batch(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  batch_keys constant text[] := array['provider', 'granted_types', 'sessions', 'days'];
  session_keys constant text[] := array[
    'external_id', 'origin', 'group', 'name_de', 'started_at', 'finished_at', 'performed_on', 'duration_s',
    'distance_m', 'kcal', 'heart_rate', 'merge_into', 'possible_duplicate_of'
  ];
  heart_rate_keys constant text[] := array['avg_bpm', 'max_bpm', 'zone_s', 'hf_max_used'];
  day_keys constant text[] := array['day', 'resting_hr_bpm', 'sleep_min', 'steps'];
  -- sync: WEARABLE_SYNC in packages/core/src/constants.ts
  max_sessions constant integer := 500;
  max_days constant integer := 62;
  import_max_age_days constant integer := 60;
  clock_skew_s constant integer := 300;
  payload_max_bytes constant integer := 1000000;
  -- sync: WEARABLE_SESSION_GROUPS, WEARABLE_ORIGINS, WEARABLE_NAME_PATTERN, FREE_SESSION.names
  group_names constant jsonb := '{
    "run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt", "swim": "Schwimmen", "strength": "Freie Kraft-Einheit"
  }';
  origins constant text[] := array['samsung_health', 'google_fit', 'fitbit', 'garmin', 'polar', 'other'];
  name_pattern constant text := '^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß -]{0,59}$';
  iso_timestamp_pattern constant text :=
    '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$';
  iso_date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  v_provider public.wearable_provider;
  v_types text[];
  s jsonb;
  hr jsonb;
  d jsonb;
  v_group text;
  v_modality public.endurance_modality;
  v_kind public.planned_session_kind;
  v_started timestamptz;
  v_finished timestamptz;
  v_day date;
  v_duration integer;
  v_distance integer;
  v_kcal integer;
  v_merge uuid;
  v_dup uuid;
  v_log_id uuid;
  existing record;
  target record;
  merged_ok boolean;
  n_created integer := 0;
  n_updated integer := 0;
  n_merged integer := 0;
  n_skipped integer := 0;
  n_days integer := 0;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if not private.wearable_consents_locked(current_user_id) then
    raise exception 'Einwilligung Smartwatch-Daten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if p_batch is null or octet_length(p_batch::text) > payload_max_bytes then
    raise exception 'Ungültiger Abgleich.' using errcode = 'invalid_parameter_value';
  end if;
  perform private.assert_json_keys(p_batch, batch_keys, 'Abgleich');
  if not (p_batch ?& batch_keys)
     or jsonb_typeof(p_batch -> 'provider') <> 'string'
     or jsonb_typeof(p_batch -> 'sessions') <> 'array'
     or jsonb_typeof(p_batch -> 'days') <> 'array'
     or jsonb_array_length(p_batch -> 'sessions') > max_sessions
     or jsonb_array_length(p_batch -> 'days') > max_days
     or not private.wearable_types_valid(p_batch -> 'granted_types')
     or (p_batch ->> 'provider') not in ('health_connect') then
    raise exception 'Ungültiger Abgleich.' using errcode = 'invalid_parameter_value';
  end if;
  v_provider := (p_batch ->> 'provider')::public.wearable_provider;
  select coalesce(array_agg(t #>> '{}' order by t #>> '{}'), '{}') into v_types
  from jsonb_array_elements(p_batch -> 'granted_types') t;

  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));

  -- -------------------------------------------------------------------------------------------------------
  -- Einheiten
  -- -------------------------------------------------------------------------------------------------------
  for s in select value from jsonb_array_elements(p_batch -> 'sessions') loop
    -- Aufbau und Werte prüfen; Ungültiges überspringen (zählen, ohne Werte).
    if jsonb_typeof(s) <> 'object'
       or exists (select 1 from jsonb_object_keys(s) k where not k = any (session_keys))
       or not (s ?& session_keys)
       or jsonb_typeof(s -> 'external_id') <> 'string'
       or char_length(s ->> 'external_id') not between 1 and 200
       or jsonb_typeof(s -> 'origin') <> 'string' or not ((s ->> 'origin') = any (origins))
       or jsonb_typeof(s -> 'group') <> 'string'
       or (s ->> 'group') not in ('run', 'walk', 'bike', 'swim', 'strength', 'other')
       or jsonb_typeof(s -> 'name_de') <> 'string' or (s ->> 'name_de') !~ name_pattern
       or ((s ->> 'group') <> 'other' and (s ->> 'name_de') is distinct from (group_names ->> (s ->> 'group')))
       or jsonb_typeof(s -> 'started_at') <> 'string' or (s ->> 'started_at') !~ iso_timestamp_pattern
       or jsonb_typeof(s -> 'finished_at') <> 'string' or (s ->> 'finished_at') !~ iso_timestamp_pattern
       or jsonb_typeof(s -> 'performed_on') <> 'string' or (s ->> 'performed_on') !~ iso_date_pattern
       or not private.jsonb_number_between(s -> 'duration_s', 60, 43200, 0)
       or not (jsonb_typeof(s -> 'distance_m') = 'null'
         or ((s ->> 'group') in ('run', 'walk', 'bike', 'swim')
           and private.jsonb_number_between(s -> 'distance_m', 0, 500000, 0)))
       or not (jsonb_typeof(s -> 'kcal') = 'null' or private.jsonb_number_between(s -> 'kcal', 0, 10000, 0))
       or jsonb_typeof(s -> 'heart_rate') not in ('object', 'null')
       or not (jsonb_typeof(s -> 'merge_into') = 'null'
         or (jsonb_typeof(s -> 'merge_into') = 'string' and (s ->> 'merge_into') ~ uuid_pattern))
       or not (jsonb_typeof(s -> 'possible_duplicate_of') = 'null'
         or (jsonb_typeof(s -> 'possible_duplicate_of') = 'string' and (s ->> 'possible_duplicate_of') ~ uuid_pattern))
       or (jsonb_typeof(s -> 'merge_into') = 'string' and jsonb_typeof(s -> 'possible_duplicate_of') = 'string') then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    begin
      v_started := (s ->> 'started_at')::timestamptz;
      v_finished := (s ->> 'finished_at')::timestamptz;
      v_day := (s ->> 'performed_on')::date;
    exception
      when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
        n_skipped := n_skipped + 1;
        continue;
    end;
    v_duration := (s ->> 'duration_s')::integer;
    if v_finished <= v_started
       or round(extract(epoch from (v_finished - v_started))) <> v_duration
       or v_day <> (v_started at time zone 'Europe/Berlin')::date
       or v_started < now() - make_interval(days => import_max_age_days)
       or v_finished > now() + make_interval(secs => clock_skew_s) then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    hr := s -> 'heart_rate';
    if jsonb_typeof(hr) = 'object' and (
         exists (select 1 from jsonb_object_keys(hr) k where not k = any (heart_rate_keys))
         or not (hr ?& heart_rate_keys)
         -- sync: HEART_RATE_LIMITS (sampleBpm 30–230, maxOverrideBpm 120–230)
         or not private.jsonb_number_between(hr -> 'avg_bpm', 30, 230, 0)
         or not private.jsonb_number_between(hr -> 'max_bpm', 30, 230, 0)
         or (hr ->> 'max_bpm')::integer < (hr ->> 'avg_bpm')::integer
         or not private.jsonb_number_between(hr -> 'hf_max_used', 120, 230, 0)
         or jsonb_typeof(hr -> 'zone_s') <> 'array'
         or jsonb_array_length(hr -> 'zone_s') <> 5
         or exists (
           select 1 from jsonb_array_elements(hr -> 'zone_s') z
           where not private.jsonb_number_between(z, 0, 43200, 0))
         or (select sum((z #>> '{}')::integer) from jsonb_array_elements(hr -> 'zone_s') z) > v_duration) then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    v_group := s ->> 'group';
    v_modality := case when v_group in ('run', 'walk', 'bike', 'swim') then v_group::public.endurance_modality end;
    v_kind := case when v_modality is null then 'strength' else 'endurance' end;
    v_distance := (s ->> 'distance_m')::integer;
    v_kcal := (s ->> 'kcal')::integer;
    v_merge := (s ->> 'merge_into')::uuid;
    v_dup := (s ->> 'possible_duplicate_of')::uuid;

    -- Schon übernommen (gleiche external_id) → ändern.
    select ws.session_log_id, ws.merged into existing
    from public.wearable_sessions ws
    where ws.user_id = current_user_id and ws.provider = v_provider and ws.external_id = (s ->> 'external_id')
    for update;
    if found then
      update public.wearable_sessions ws
      set origin = s ->> 'origin', started_at = v_started, finished_at = v_finished,
          kcal = coalesce(v_kcal, ws.kcal), updated_at = now()
      where ws.session_log_id = existing.session_log_id
        and (ws.origin, ws.started_at, ws.finished_at, ws.kcal)
          is distinct from (s ->> 'origin', v_started, v_finished, coalesce(v_kcal, ws.kcal));
      if not existing.merged then
        -- Eigene Uhr-Einheit: Zeiten und Ausdauer-Werte folgen der Uhr (gleiche Gruppe vorausgesetzt).
        update public.session_logs sl
        set started_at = v_started, finished_at = v_finished, performed_on = v_day,
            revision = sl.revision + 1, last_write_id = gen_random_uuid(), client_updated_at = now()
        where sl.id = existing.session_log_id and sl.user_id = current_user_id
          and (sl.started_at, sl.finished_at, sl.performed_on) is distinct from (v_started, v_finished, v_day);
        update public.cardio_logs cl
        set duration_s = v_duration, distance_m = coalesce(v_distance, cl.distance_m)
        where cl.session_log_id = existing.session_log_id and cl.modality = v_modality
          and (cl.duration_s, cl.distance_m) is distinct from (v_duration, coalesce(v_distance, cl.distance_m));
      end if;
      if jsonb_typeof(hr) = 'object' then
        insert into public.heart_rate_summaries as h (session_log_id, user_id, avg_bpm, max_bpm, zone_s, hf_max_used)
        values (
          existing.session_log_id, current_user_id, (hr ->> 'avg_bpm')::smallint, (hr ->> 'max_bpm')::smallint,
          (select array_agg((z #>> '{}')::integer order by o) from jsonb_array_elements(hr -> 'zone_s') with ordinality as x(z, o)),
          (hr ->> 'hf_max_used')::smallint
        )
        on conflict (session_log_id) do update
        set avg_bpm = excluded.avg_bpm, max_bpm = excluded.max_bpm, zone_s = excluded.zone_s,
            hf_max_used = excluded.hf_max_used, updated_at = now()
        where (h.avg_bpm, h.max_bpm, h.zone_s, h.hf_max_used)
          is distinct from (excluded.avg_bpm, excluded.max_bpm, excluded.zone_s, excluded.hf_max_used);
      end if;
      n_updated := n_updated + 1;
      continue;
    end if;

    -- Zusammenführen (W8-9): eigener Eintrag derselben Gruppe, noch ohne Uhr-Einheit, zeitlich passend.
    merged_ok := false;
    if v_merge is not null then
      select sl.id, sl.kind, sl.performed_on, sl.started_at, sl.finished_at, cl.modality into target
      from public.session_logs sl
      left join public.cardio_logs cl on cl.session_log_id = sl.id
      where sl.id = v_merge and sl.user_id = current_user_id
      for update of sl;
      if found
         and not exists (select 1 from public.wearable_sessions ws where ws.session_log_id = target.id)
         and target.kind = v_kind
         and target.modality is not distinct from v_modality
         and (
           (target.started_at is not null and target.finished_at is not null
             and target.started_at < v_finished and target.finished_at > v_started)
           or ((target.started_at is null or target.finished_at is null) and target.performed_on = v_day)
         ) then
        insert into public.wearable_sessions (
          session_log_id, user_id, provider, external_id, origin, started_at, finished_at, kcal, merged
        )
        values (
          target.id, current_user_id, v_provider, s ->> 'external_id', s ->> 'origin', v_started, v_finished,
          v_kcal, true
        );
        v_log_id := target.id;
        merged_ok := true;
        n_merged := n_merged + 1;
      end if;
    end if;

    if not merged_ok then
      -- Neue Uhr-Einheit = freier Eintrag (A1b) mit Herkunft health_connect; Ausdauer mit cardio_logs.
      v_log_id := gen_random_uuid();
      insert into public.session_logs (
        id, user_id, planned_session_id, kind, performed_on, started_at, finished_at, status, session_rpe, notes,
        name_de, is_intro_week, is_deload, from_health_plan, is_free, revision, last_write_id, source,
        client_updated_at
      )
      values (
        v_log_id, current_user_id, null, v_kind, v_day, v_started, v_finished, 'completed', null, null,
        s ->> 'name_de', false, false, false, true, 1, gen_random_uuid(), 'health_connect', now()
      );
      if v_modality is not null then
        insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m, elevation_m)
        values (v_log_id, current_user_id, v_modality, v_duration, v_distance, null);
      end if;
      -- Möglicher Doppel-Eintrag nur auf einen eigenen, anderen Eintrag.
      if v_dup is not null and not exists (
        select 1 from public.session_logs sl where sl.id = v_dup and sl.user_id = current_user_id
      ) then
        v_dup := null;
      end if;
      insert into public.wearable_sessions (
        session_log_id, user_id, provider, external_id, origin, started_at, finished_at, kcal, merged, duplicate_of
      )
      values (
        v_log_id, current_user_id, v_provider, s ->> 'external_id', s ->> 'origin', v_started, v_finished, v_kcal,
        false, v_dup
      );
      n_created := n_created + 1;
    end if;

    if jsonb_typeof(hr) = 'object' then
      insert into public.heart_rate_summaries as h (session_log_id, user_id, avg_bpm, max_bpm, zone_s, hf_max_used)
      values (
        v_log_id, current_user_id, (hr ->> 'avg_bpm')::smallint, (hr ->> 'max_bpm')::smallint,
        (select array_agg((z #>> '{}')::integer order by o) from jsonb_array_elements(hr -> 'zone_s') with ordinality as x(z, o)),
        (hr ->> 'hf_max_used')::smallint
      )
      on conflict (session_log_id) do update
      set avg_bpm = excluded.avg_bpm, max_bpm = excluded.max_bpm, zone_s = excluded.zone_s,
          hf_max_used = excluded.hf_max_used, updated_at = now();
    end if;
  end loop;

  -- -------------------------------------------------------------------------------------------------------
  -- Tageswerte (fehlende Werte behalten den gespeicherten Wert)
  -- -------------------------------------------------------------------------------------------------------
  for d in select value from jsonb_array_elements(p_batch -> 'days') loop
    if jsonb_typeof(d) <> 'object'
       or exists (select 1 from jsonb_object_keys(d) k where not k = any (day_keys))
       or not (d ?& day_keys)
       or jsonb_typeof(d -> 'day') <> 'string' or (d ->> 'day') !~ iso_date_pattern
       -- sync: DAILY_METRIC_LIMITS
       or not (jsonb_typeof(d -> 'resting_hr_bpm') = 'null' or private.jsonb_number_between(d -> 'resting_hr_bpm', 30, 120, 0))
       or not (jsonb_typeof(d -> 'sleep_min') = 'null' or private.jsonb_number_between(d -> 'sleep_min', 0, 1440, 0))
       or not (jsonb_typeof(d -> 'steps') = 'null' or private.jsonb_number_between(d -> 'steps', 0, 100000, 0))
       or (jsonb_typeof(d -> 'resting_hr_bpm') = 'null' and jsonb_typeof(d -> 'sleep_min') = 'null'
         and jsonb_typeof(d -> 'steps') = 'null') then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    begin
      v_day := (d ->> 'day')::date;
    exception
      when invalid_datetime_format or datetime_field_overflow then
        n_skipped := n_skipped + 1;
        continue;
    end;
    if v_day < today - import_max_age_days or v_day > today + 1 then
      n_skipped := n_skipped + 1;
      continue;
    end if;
    insert into public.daily_metrics as m (user_id, day, provider, resting_hr_bpm, sleep_min, steps)
    values (
      current_user_id, v_day, v_provider, (d ->> 'resting_hr_bpm')::smallint, (d ->> 'sleep_min')::smallint,
      (d ->> 'steps')::integer
    )
    on conflict (user_id, provider, day) do update
    set resting_hr_bpm = coalesce(excluded.resting_hr_bpm, m.resting_hr_bpm),
        sleep_min = coalesce(excluded.sleep_min, m.sleep_min),
        steps = coalesce(excluded.steps, m.steps),
        updated_at = now();
    n_days := n_days + 1;
  end loop;

  insert into public.wearable_connections as w (
    user_id, provider, status, granted_types, last_sync_at, last_sync_count
  )
  values (
    current_user_id, v_provider,
    case when cardinality(v_types) > 0 then 'connected' else 'permission_missing' end::public.wearable_connection_status,
    v_types, now(), least(n_created + n_merged, 500)
  )
  on conflict (user_id, provider) do update
  set status = excluded.status, granted_types = excluded.granted_types, last_sync_at = excluded.last_sync_at,
      last_sync_count = excluded.last_sync_count, updated_at = now();

  return jsonb_build_object(
    'created', n_created, 'updated', n_updated, 'merged', n_merged, 'skipped', n_skipped, 'days', n_days
  );
end;
$$;

revoke all on function public.import_wearable_batch(jsonb) from public, anon;
grant execute on function public.import_wearable_batch(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3d. resolve_wearable_duplicate(p_session_log_id, p_merge) – „Möglicher Doppel-Eintrag“ entscheiden:
-- - p_merge = false: beide behalten (Hinweis verschwindet) – geht immer,
-- - p_merge = true: die Uhr-Einheit geht in den anderen Eintrag ein (der bleibt führend, bekommt Puls und kcal), der
--   übernommene Eintrag wird gelöscht. Braucht die Einwilligung (Puls wird verschoben). Anderer Eintrag schon mit
--   einer Uhr-Einheit verknüpft → Ablehnung ohne Werte.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.resolve_wearable_duplicate(p_session_log_id uuid, p_merge boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_target uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_merge is null then
    raise exception 'Ungültige Angaben.' using errcode = 'invalid_parameter_value';
  end if;
  if p_merge and not private.wearable_consents_locked(current_user_id) then
    raise exception 'Einwilligung Smartwatch-Daten fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));
  select ws.duplicate_of into v_target
  from public.wearable_sessions ws
  where ws.session_log_id = p_session_log_id and ws.user_id = current_user_id and not ws.merged
    and ws.duplicate_of is not null
  for update;
  if not found then
    raise exception 'Kein möglicher Doppel-Eintrag.' using errcode = 'invalid_parameter_value';
  end if;
  if not p_merge then
    update public.wearable_sessions ws
    set duplicate_of = null, updated_at = now()
    where ws.session_log_id = p_session_log_id;
    return;
  end if;
  perform 1 from public.session_logs sl
  where sl.id = v_target and sl.user_id = current_user_id
  for update;
  if not found or exists (select 1 from public.wearable_sessions ws where ws.session_log_id = v_target) then
    raise exception 'Zusammenführen nicht möglich.' using errcode = 'invalid_parameter_value';
  end if;
  update public.heart_rate_summaries h
  set session_log_id = v_target, updated_at = now()
  where h.session_log_id = p_session_log_id and h.user_id = current_user_id;
  update public.wearable_sessions ws
  set session_log_id = v_target, merged = true, duplicate_of = null, updated_at = now()
  where ws.session_log_id = p_session_log_id;
  delete from public.session_logs sl where sl.id = p_session_log_id and sl.user_id = current_user_id;
end;
$$;

revoke all on function public.resolve_wearable_duplicate(uuid, boolean) from public, anon;
grant execute on function public.resolve_wearable_duplicate(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3e. disconnect_wearable(p_provider, p_delete_imported) → Anzahl gelöschter Einträge (W8-12).
-- Pulsdaten und Tageswerte werden IMMER gelöscht, dazu die Verbindung. p_delete_imported = true löscht zusätzlich die
-- eigenen Uhr-Einträge; in eigene Einträge eingegangene Einheiten (merged) verlieren nur die Verknüpfung – der
-- Eintrag bleibt. Geht immer (Recht auf Löschung, auch ohne Einwilligung).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.disconnect_wearable(p_provider public.wearable_provider, p_delete_imported boolean)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deleted integer := 0;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if p_provider is null or p_delete_imported is null then
    raise exception 'Ungültige Angaben.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));
  delete from public.heart_rate_summaries h
  where h.user_id = current_user_id
    and h.session_log_id in (
      select ws.session_log_id from public.wearable_sessions ws
      where ws.user_id = current_user_id and ws.provider = p_provider
    );
  delete from public.daily_metrics m where m.user_id = current_user_id and m.provider = p_provider;
  if p_delete_imported then
    with gone as (
      delete from public.session_logs sl
      where sl.user_id = current_user_id
        and sl.id in (
          select ws.session_log_id from public.wearable_sessions ws
          where ws.user_id = current_user_id and ws.provider = p_provider and not ws.merged
        )
      returning 1
    )
    select count(*) into deleted from gone;
    delete from public.wearable_sessions ws where ws.user_id = current_user_id and ws.provider = p_provider;
  end if;
  delete from public.wearable_connections w where w.user_id = current_user_id and w.provider = p_provider;
  return deleted;
end;
$$;

revoke all on function public.disconnect_wearable(public.wearable_provider, boolean) from public, anon;
grant execute on function public.disconnect_wearable(public.wearable_provider, boolean) to authenticated;
