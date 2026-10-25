-- „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15): HRV (RMSSD) als Tageswert aus
-- Health Connect; die Erholung selbst (gut / mittel / niedrig) rechnet die App mit packages/core/src/wearables/recovery.ts
-- aus den vorhandenen Tageswerten – sie wird NICHT gespeichert (kein neuer Datensatz, nur Anzeige und Angebot).
-- Rein additiv:
-- 1. Einwilligungstext wearable_data Fassung 3 (nennt HRV und die Erholung; Fassung 2 kannte beides nicht). Wer
--    Fassung 2 erteilt hat, wird vor dem nächsten Abgleich erneut gefragt (has_valid_consent prüft die aktuelle
--    Fassung, CURRENT_CONSENT_VERSIONS in packages/core). Muster wie Fassung 2 (20261023120100_wearable_routes.sql).
-- 2. daily_metrics.hrv_rmssd_ms (5–300 ms, DAILY_METRIC_LIMITS.hrvRmssdMs); „mindestens ein Wert“ zählt HRV mit.
--    RLS unverändert (nur eigene Zeilen lesen, Schreiben nur über import_wearable_batch). Widerruf und Trennen löschen
--    ganze Zeilen (HRV automatisch dabei); Export nimmt to_jsonb(t) der ganzen Zeile (Spalte automatisch dabei);
--    Konto löschen per Kaskade.
-- 3. Datentyp „hrv“ (WEARABLE_DATA_TYPES): CHECK von wearable_connections.granted_types und
--    private.wearable_types_valid kennen ihn.
-- 4. import_wearable_batch: neue Fassung – Tage dürfen hrv_rmssd_ms tragen (fehlt das Feld, z. B. ältere App-Fassung,
--    bleibt der gespeicherte Wert). Alles andere unverändert wie in 20261021120100_wearables.sql.
-- Datenschutz (Art. 9): HRV nie in Logs/Fehlermeldungen, kein Partner-Zugriff.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Einwilligungstext Fassung 3
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at) values
(
  'wearable_data',
  3,
  'Einwilligung: Daten deiner Smartwatch übernehmen',
  $txt$ENTWURF – juristisch prüfen

Mit „Smartwatch verbinden“ übernimmt Alpha5 Daten deiner Smartwatch (z. B. Galaxy Watch) aus Health Connect auf deinem Android-Handy. Health Connect ist die Datensammelstelle von Android; die App deiner Uhr (z. B. Samsung Health) schreibt dort hinein. Alpha5 liest nur – wir schreiben nichts zurück und sprechen nie direkt mit deiner Uhr.

Welche Daten: nur die Arten, die du im Health-Connect-Dialog erlaubst:
- Trainingseinheiten (Art, Beginn, Ende, Distanz, verbrauchte kcal),
- Routen (GPS-Strecken) deiner Läufe, Rad- und Geh-Einheiten – nur wenn du in Health Connect „Trainingsrouten“ erlaubst oder eine Route einzeln freigibst. Daraus rechnen wir Distanz, Höhenmeter und Kilometerzeiten; gespeichert wird nur eine vereinfachte Linie, keine Zeit je Punkt,
- Puls während deiner Einheiten – gespeichert wird nur eine Zusammenfassung je Einheit (Durchschnitt, Maximum, Minuten je Pulszone), keine Pulskurve,
- Ruhepuls je Tag, Schlafdauer je Nacht (ohne Schlafphasen), Schritte je Tag und Herzfrequenzvariabilität (HRV) je Tag – gespeichert wird nur ein Tageswert, keine einzelnen Messungen.

Wofür: ausschließlich für dein Trainingstagebuch und deine eigenen Auswertungen (z. B. Karte, Distanz und Pulszonen einer Einheit, Tageswerte) und für die „Erholung“: Aus Schlaf, Ruhepuls und HRV ermittelt die App mit festen Regeln einen Tagesstatus (gut, mittel, niedrig) – nur im Vergleich mit deinen eigenen Werten der letzten 14 Tage – und kann dir an Tagen mit niedriger Erholung eine leichtere Einheit vorschlagen. Du entscheidest selbst; der Plan ändert sich nie von allein. Die Erholung ist eine Trainingshilfe, keine Bewertung deiner Gesundheit; der Status selbst wird nicht gespeichert. Keine Weitergabe an Analyse-, Werbe- oder Affiliate-Partner, nicht im Partner-Modus. Routen siehst nur du; eine Route erscheint nur dann auf einem Bild, wenn du selbst „Als Bild teilen“ wählst – ohne Anfang und Ende der Strecke und ohne Puls.

Speicherort und Dauer: auf Servern in der EU (Frankfurt am Main), solange dein Konto besteht oder bis du die Verbindung trennst bzw. diese Einwilligung widerrufst.

Rechtsgrundlage: deine ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO (Schweiz: revDSG). Voraussetzung ist zusätzlich deine Einwilligung in die Verarbeitung von Gesundheitsdaten.

Freiwillig: Ohne diese Einwilligung nutzt du die App wie bisher; Einheiten kannst du weiter selbst eintragen oder aufzeichnen.

Widerruf: Du kannst die Einwilligung jederzeit in den Einstellungen widerrufen. Dann löschen wir sofort alle Pulswerte, alle Tageswerte (Ruhepuls, Schlaf, Schritte, HRV), alle Routen deiner Uhr und die Verbindung. Übernommene Trainingseinheiten bleiben als normale Einträge ohne Puls und ohne Route in deinem Tagebuch – du kannst sie dort löschen. Beim Trennen der Uhr löschen wir Puls, Tageswerte und Routen ebenfalls und fragen dich, ob du die übernommenen Einheiten behalten oder löschen möchtest. Die Rechtmäßigkeit der Verarbeitung bis zum Widerruf bleibt unberührt.$txt$,
  now()
)
on conflict (consent_type, version) do nothing;

-- ---------------------------------------------------------------------------------------------------------
-- 2. HRV je Tag
-- ---------------------------------------------------------------------------------------------------------
alter table public.daily_metrics
  -- sync: DAILY_METRIC_LIMITS.hrvRmssdMs
  add column hrv_rmssd_ms smallint check (hrv_rmssd_ms between 5 and 300);

alter table public.daily_metrics drop constraint daily_metrics_check;
alter table public.daily_metrics
  add constraint daily_metrics_check check (num_nonnulls(resting_hr_bpm, sleep_min, steps, hrv_rmssd_ms) >= 1);

comment on column public.daily_metrics.hrv_rmssd_ms is
  'SENSIBEL (Art. 9): Herzfrequenzvariabilität (RMSSD, ms) als Median des Tages aus Health Connect – keine '
  'Einzelmessungen. Grundlage der „Erholung“ (die selbst nicht gespeichert wird). Nie loggen.';

-- ---------------------------------------------------------------------------------------------------------
-- 3. Datentyp „hrv“
-- ---------------------------------------------------------------------------------------------------------
alter table public.wearable_connections drop constraint wearable_connections_granted_types_check;
alter table public.wearable_connections
  add constraint wearable_connections_granted_types_check
  check (granted_types <@ array['exercise', 'distance', 'calories', 'heart_rate', 'resting_heart_rate', 'sleep', 'steps', 'hrv']::text[]
    and cardinality(granted_types) <= 8);

-- Freigegebene Datentypen prüfen (Liste wie WEARABLE_DATA_TYPES, ohne Doppel). Nie ein Fehler.
create or replace function private.wearable_types_valid(p_types jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(p_types) = 'array'
    and jsonb_array_length(p_types) <= 8
    and not exists (
      select 1 from jsonb_array_elements(p_types) t
      where jsonb_typeof(t) <> 'string'
        or t #>> '{}' not in ('exercise', 'distance', 'calories', 'heart_rate', 'resting_heart_rate', 'sleep', 'steps', 'hrv')
    )
    and (select count(distinct t #>> '{}') from jsonb_array_elements(p_types) t) = jsonb_array_length(p_types),
    false)
$$;

revoke all on function private.wearable_types_valid(jsonb) from public;

-- ---------------------------------------------------------------------------------------------------------
-- 4. import_wearable_batch(p_batch jsonb) – neue Fassung mit HRV je Tag (sonst unverändert; Ablauf siehe
-- 20261021120100_wearables.sql, Abschnitt 3c).
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
  day_keys constant text[] := array['day', 'resting_hr_bpm', 'sleep_min', 'steps', 'hrv_rmssd_ms'];
  -- Pflichtfelder je Tag: hrv_rmssd_ms darf FEHLEN (ältere App-Fassungen ohne HRV, 25.10.2026).
  day_required_keys constant text[] := array['day', 'resting_hr_bpm', 'sleep_min', 'steps'];
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
       or not (d ?& day_required_keys)
       or jsonb_typeof(d -> 'day') <> 'string' or (d ->> 'day') !~ iso_date_pattern
       -- sync: DAILY_METRIC_LIMITS
       or not (jsonb_typeof(d -> 'resting_hr_bpm') = 'null' or private.jsonb_number_between(d -> 'resting_hr_bpm', 30, 120, 0))
       or not (jsonb_typeof(d -> 'sleep_min') = 'null' or private.jsonb_number_between(d -> 'sleep_min', 0, 1440, 0))
       or not (jsonb_typeof(d -> 'steps') = 'null' or private.jsonb_number_between(d -> 'steps', 0, 100000, 0))
       or not (coalesce(jsonb_typeof(d -> 'hrv_rmssd_ms'), 'null') = 'null'
         or private.jsonb_number_between(d -> 'hrv_rmssd_ms', 5, 300, 0))
       or (jsonb_typeof(d -> 'resting_hr_bpm') = 'null' and jsonb_typeof(d -> 'sleep_min') = 'null'
         and jsonb_typeof(d -> 'steps') = 'null' and coalesce(jsonb_typeof(d -> 'hrv_rmssd_ms'), 'null') = 'null') then
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
    insert into public.daily_metrics as m (user_id, day, provider, resting_hr_bpm, sleep_min, steps, hrv_rmssd_ms)
    values (
      current_user_id, v_day, v_provider, (d ->> 'resting_hr_bpm')::smallint, (d ->> 'sleep_min')::smallint,
      (d ->> 'steps')::integer, (d ->> 'hrv_rmssd_ms')::smallint
    )
    on conflict (user_id, provider, day) do update
    set resting_hr_bpm = coalesce(excluded.resting_hr_bpm, m.resting_hr_bpm),
        sleep_min = coalesce(excluded.sleep_min, m.sleep_min),
        steps = coalesce(excluded.steps, m.steps),
        hrv_rmssd_ms = coalesce(excluded.hrv_rmssd_ms, m.hrv_rmssd_ms),
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
