-- Phase 10 · Etappe S1 · Funktionen zu Strecken (docs/PLAN-PHASE-10.md Abschnitt 12). Nur additiv bzw. per
-- `create or replace` mit GLEICHER Signatur:
-- 1. save_tracked_route, update_tracked_route, delete_tracked_route, delete_all_tracked_routes (neu, security definer,
--    search_path = '', user_id immer aus auth.uid(), Prüfungen wie trackedRouteSchema/updateTrackedRouteSchema in
--    packages/core/src/routes/schema.ts, Tageslimit TRACKED_ROUTE_LIMITS.maxSavesPerDay).
-- 2. save_session_log: NEUESTE Fassung (20261015140000_free_session_logs.sql) unverändert übernommen und nur um die
--    Herkunft erweitert (WP3 Präzisierung 8): gps/gpx_import nur mit verknüpfter eigener Strecke – die Herkunft setzt
--    allein save_tracked_route, die App sendet weiter „manual“ (kein App-Bruch).
-- 3. export_my_data(): NEUESTE Fassung (20261016160300_ai_food_photo_export.sql) Zeile für Zeile übernommen und nur um
--    `tracked_routes` ergänzt (echte Obermenge, db-sync.test.ts).
-- private.consents_after_revoke bleibt unverändert: Strecken sind kein Gesundheitsdatum und bleiben beim Widerruf
-- (W-G15); verknüpfte Tagebuch-Einträge werden wie bisher neutralisiert (der Verweis bleibt).
-- Fehlermeldungen: feste deutsche Texte ohne Werte (keine Koordinaten, kein „Failing row contains“).

-- ---------------------------------------------------------------------------------------------------------
-- 1a. save_tracked_route(p_route jsonb) → id
-- Eingabe = trackedRouteSchema (alle 16 Felder Pflicht, unbekannte abgelehnt). Die id erzeugt das Gerät (Warteschlange):
-- Gibt es schon eine EIGENE Strecke mit dieser id, kommt sie unverändert zurück (kein Doppel, kein Zähler); gehört die
-- id einer anderen Person, vergibt der Server eine neue (ohne unterscheidbare Meldung).
-- - Beginn nicht in der Zukunft und Ende höchstens clock_skew_s nach jetzt (Uhr des Geräts),
-- - base_route_id: eigene FAVORITEN-Strecke derselben Sportart,
-- - session_log_id: eigener Ausdauer-Eintrag derselben Art, Tag = Tag des Beginns (Europe/Berlin) bis 1 Tag danach,
--   noch ohne Strecke; die Herkunft des Eintrags wird gps (aufgezeichnet) bzw. gpx_import,
-- - Anzahl der Punkte und Begrenzungsrahmen aus der Polyline (private.polyline_summary),
-- - höchstens max_saves_per_day NEUE Strecken je Kalendertag (Europe/Berlin).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_tracked_route(p_route jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_keys constant text[] := array[
    'id', 'name', 'sport', 'started_at', 'duration_s', 'moving_s', 'distance_m', 'elevation_gain_m', 'polyline',
    'km_splits', 'difficulty', 'is_favorite', 'base_route_id', 'note', 'session_log_id', 'source'
  ];
  -- sync: TRACKED_ROUTE_LIMITS in packages/core/src/constants.ts
  max_saves_per_day constant integer := 20;
  clock_skew_s constant integer := 300;
  session_log_day_tolerance constant integer := 1;
  iso_timestamp_pattern constant text :=
    '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  r jsonb := p_route;
  v_id uuid;
  v_sport public.endurance_modality;
  v_started_at timestamptz;
  v_duration_s integer;
  v_base_route_id uuid;
  v_session_log_id uuid;
  v_source public.tracked_route_source;
  v_summary numeric[];
  log_day date;
  start_day date;
  created_today integer;
  saved_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(r, route_keys, 'Strecke');
  -- Alle Felder vorhanden und vom richtigen JSON-Typ; Zahlen ganz und im Bereich (Rest prüfen die CHECKs).
  if not (r ?& route_keys)
     or jsonb_typeof(r -> 'id') <> 'string'
     or jsonb_typeof(r -> 'name') <> 'string'
     or jsonb_typeof(r -> 'sport') <> 'string'
     or jsonb_typeof(r -> 'started_at') <> 'string'
     or not private.jsonb_number_between(r -> 'duration_s', 60, 43200, 0)
     or not private.jsonb_number_between(r -> 'moving_s', 0, 43200, 0)
     or not private.jsonb_number_between(r -> 'distance_m', 0, 500000, 0)
     or not (jsonb_typeof(r -> 'elevation_gain_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_gain_m', 0, 10000, 0))
     or jsonb_typeof(r -> 'polyline') <> 'string'
     or jsonb_typeof(r -> 'km_splits') <> 'array'
     or jsonb_typeof(r -> 'difficulty') not in ('string', 'null')
     or jsonb_typeof(r -> 'is_favorite') <> 'boolean'
     or jsonb_typeof(r -> 'base_route_id') not in ('string', 'null')
     or jsonb_typeof(r -> 'note') not in ('string', 'null')
     or jsonb_typeof(r -> 'session_log_id') not in ('string', 'null')
     or jsonb_typeof(r -> 'source') <> 'string'
     or (r ->> 'started_at') !~ iso_timestamp_pattern then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (r ->> 'id')::uuid;
    v_sport := (r ->> 'sport')::public.endurance_modality;
    v_started_at := (r ->> 'started_at')::timestamptz;
    v_duration_s := (r ->> 'duration_s')::integer;
    v_base_route_id := (r ->> 'base_route_id')::uuid;
    v_session_log_id := (r ->> 'session_log_id')::uuid;
    v_source := (r ->> 'source')::public.tracked_route_source;
    perform (r ->> 'difficulty')::public.route_difficulty;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end;
  -- Nicht in der Zukunft (Spielraum für die Uhr des Geräts).
  if v_started_at + make_interval(secs => v_duration_s) > now() + make_interval(secs => clock_skew_s) then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  -- Warteschlange: dieselbe eigene Strecke erneut gesendet → nichts ändern.
  if exists (select 1 from public.tracked_routes t where t.id = v_id and t.user_id = current_user_id) then
    return v_id;
  end if;
  if exists (select 1 from public.tracked_routes t where t.id = v_id) then
    v_id := gen_random_uuid();
  end if;

  -- Wiederholung: nur eine eigene Favoriten-Strecke derselben Sportart.
  if v_base_route_id is not null and not exists (
    select 1 from public.tracked_routes t
    where t.id = v_base_route_id and t.user_id = current_user_id and t.is_favorite and t.sport = v_sport
    for share
  ) then
    raise exception 'Die Favoriten-Strecke wurde nicht gefunden.' using errcode = 'invalid_parameter_value';
  end if;

  -- Tagebuch-Eintrag: eigener Ausdauer-Eintrag derselben Art vom Tag des Beginns (oder 1 Tag danach), noch ohne
  -- Strecke. Gesperrt, damit gleichzeitiges Löschen/Ändern nicht dazwischenkommt.
  if v_session_log_id is not null then
    select sl.performed_on into log_day
    from public.session_logs sl
    join public.cardio_logs cl on cl.session_log_id = sl.id
    where sl.id = v_session_log_id and sl.user_id = current_user_id and sl.kind = 'endurance'
      and cl.modality = v_sport
    for update of sl;
    start_day := (v_started_at at time zone 'Europe/Berlin')::date;
    if log_day is null
       or log_day not between start_day and start_day + session_log_day_tolerance
       or exists (select 1 from public.tracked_routes t where t.session_log_id = v_session_log_id) then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  v_summary := private.polyline_summary(r ->> 'polyline');
  if v_summary is null or v_summary[1] not between 2 and 5000 then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  -- Schutz gegen Missbrauch: höchstens max_saves_per_day NEUE Strecken je Kalendertag; die Zeile des Zählers sperrt
  -- gleichzeitige Aufrufe derselben Person.
  insert into private.tracked_route_daily_counts as c (user_id, day, created)
  values (current_user_id, today, 1)
  on conflict (user_id, day) do update set created = c.created + 1
  returning c.created into created_today;
  if created_today > max_saves_per_day then
    raise exception 'Heute wurden schon zu viele Strecken gespeichert.' using errcode = 'program_limit_exceeded';
  end if;
  delete from private.tracked_route_daily_counts c where c.user_id = current_user_id and c.day < today;

  begin
    insert into public.tracked_routes (
      id, user_id, name, sport, started_at, duration_s, moving_s, distance_m, elevation_gain_m, polyline, point_count,
      bbox, km_splits, difficulty, is_favorite, base_route_id, note, session_log_id, source
    )
    values (
      v_id, current_user_id, r ->> 'name', v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer,
      (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer, r ->> 'polyline',
      v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', (r ->> 'difficulty')::public.route_difficulty,
      (r ->> 'is_favorite')::boolean, v_base_route_id, r ->> 'note', v_session_log_id, v_source
    )
    returning id into saved_id;
  exception
    when unique_violation then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'unique_violation';
    -- Ohne „Failing row contains (…)“ nach außen (keine Koordinaten, keine Notiz).
    when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
      or numeric_value_out_of_range then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = sqlstate;
  end;

  -- Herkunft des Tagebuch-Eintrags (WP3 Präzisierung 8): nur hier gesetzt, nie vom Gerät.
  if v_session_log_id is not null then
    update public.session_logs sl
    set source = case v_source when 'recorded' then 'gps' else 'gpx_import' end::public.log_source
    where sl.id = v_session_log_id;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_tracked_route(jsonb) from public, anon;
grant execute on function public.save_tracked_route(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1b. update_tracked_route(p_route jsonb): Name, Schwierigkeit, Favorit, Notiz einer EIGENEN Strecke ändern
-- (= updateTrackedRouteSchema; alle 5 Felder Pflicht). Linie, Zeiten, Herkunft und Verweise sind nicht änderbar.
-- Wird ein Favorit zurückgenommen, bleiben die Wiederholungen mit ihrem Verweis (Vergleich nur für Favoriten).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.update_tracked_route(p_route jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  update_keys constant text[] := array['id', 'name', 'difficulty', 'is_favorite', 'note'];
  current_user_id uuid := auth.uid();
  r jsonb := p_route;
  v_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(r, update_keys, 'Strecke');
  if not (r ?& update_keys)
     or jsonb_typeof(r -> 'id') <> 'string'
     or jsonb_typeof(r -> 'name') <> 'string'
     or jsonb_typeof(r -> 'difficulty') not in ('string', 'null')
     or jsonb_typeof(r -> 'is_favorite') <> 'boolean'
     or jsonb_typeof(r -> 'note') not in ('string', 'null') then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (r ->> 'id')::uuid;
    update public.tracked_routes t
    set name = r ->> 'name',
        difficulty = (r ->> 'difficulty')::public.route_difficulty,
        is_favorite = (r ->> 'is_favorite')::boolean,
        note = r ->> 'note'
    where t.id = v_id and t.user_id = current_user_id;
  exception
    when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.update_tracked_route(jsonb) from public, anon;
grant execute on function public.update_tracked_route(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1c. delete_tracked_route(p_id): eigene Strecke endgültig löschen (Recht auf Löschung). Wiederholungen behalten ihre
-- Zeiten (Verweis leer), der Tagebuch-Eintrag bleibt (eigene Löschung über delete_session_log).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_tracked_route(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tracked_routes t where t.id = p_id and t.user_id = current_user_id;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

revoke all on function public.delete_tracked_route(uuid) from public, anon;
grant execute on function public.delete_tracked_route(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1d. delete_all_tracked_routes() → Anzahl: ALLE eigenen Strecken löschen („Alle Strecken löschen“).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_all_tracked_routes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.tracked_routes t where t.user_id = current_user_id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.delete_all_tracked_routes() from public, anon;
grant execute on function public.delete_all_tracked_routes() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_session_log(p_log jsonb) – neueste Fassung (A1b) + Herkunft nur über save_tracked_route (S1)
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_session_log(p_log jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Felder = sessionLogPayloadSchema / exerciseLogSchema / setLogSchema / cardioLogSchema (db-sync.test.ts).
  -- NICHT erlaubt: user_id (auth.uid()), from_health_plan (Server, S1), revision (Server), Gründe (S3).
  log_fields constant jsonb := '{
    "id": "string", "write_id": "string", "base_revision": "number|null", "planned_session_id": "string|null",
    "planned_date": "string", "kind": "string", "performed_on": "string", "started_at": "string|null",
    "finished_at": "string|null", "status": "string", "session_rpe": "number|null", "notes": "string|null",
    "name_de": "string", "is_intro_week": "boolean", "is_deload": "boolean", "source": "string",
    "client_updated_at": "string", "exercises": "array", "cardio": "object|null", "is_free": "boolean|missing"
  }';
  exercise_fields constant jsonb := '{
    "id": "string", "order_no": "number", "planned_exercise_id": "string|null", "exercise_id": "string",
    "exercise_name_de": "string", "load_type": "string", "status": "string", "target_sets": "number|null",
    "reps_min": "number|null", "reps_max": "number|null", "target_reps": "number|null",
    "target_extra_set": "boolean|null", "target_weight_kg": "number|null", "target_duration_s": "number|null",
    "target_rpe": "number|null", "state_weight_kg": "number|null", "state_target_reps": "number|null",
    "state_extra_set": "boolean|null", "state_duration_s": "number|null", "weight_confirmed": "boolean",
    "is_return": "boolean", "sets": "array"
  }';
  set_fields constant jsonb := '{
    "set_no": "number", "reps": "number|null", "weight_kg": "number|null", "duration_s": "number|null",
    "rpe": "number|null", "done": "boolean"
  }';
  cardio_fields constant jsonb := '{
    "modality": "string", "duration_s": "number", "distance_m": "number|null", "elevation_m": "number|null"
  }';
  -- Freie Einheit (A1b): Name aus fester Liste je Art. sync: FREE_SESSION.names in packages/core/src/constants.ts
  free_names constant jsonb := '{
    "strength": "Freie Kraft-Einheit", "run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt", "swim": "Schwimmen"
  }';
  free_target_keys constant text[] := array[
    'target_sets', 'reps_min', 'reps_max', 'target_reps', 'target_extra_set', 'target_weight_kg', 'target_duration_s',
    'target_rpe', 'state_weight_kg', 'state_target_reps', 'state_extra_set', 'state_duration_s'
  ];
  -- sync: SESSION_LOG_LIMITS in packages/core/src/constants.ts
  backdate_days constant integer := 14;
  future_days constant integer := 1;
  week_tolerance_days constant integer := 1;
  max_logs_per_day constant integer := 10;
  exercises_per_session_max constant integer := 12;
  sets_per_exercise_max constant integer := 10;
  iso_date_pattern constant text := '^\d{4}-\d{2}-\d{2}$';
  iso_timestamp_pattern constant text :=
    '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$';
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  created_today integer;
  exercise_id_map jsonb := '{}'::jsonb;
  log_id uuid;
  write_id uuid;
  base_revision integer;
  planned_id uuid;
  log_kind public.planned_session_kind;
  -- Art der geplanten Einheit – eigene Variable, damit „planned“ nur innerhalb von `if linked` gelesen wird (N1).
  planned_kind public.planned_session_kind;
  v_performed_on date;
  reference_date date;
  -- Freie Einheit ohne geplante Einheit (A1b); fehlt das Feld (ältere Fassungen), gilt false.
  v_is_free boolean;
  -- Herkunft (Phase 10 S1): gps/gpx_import setzt nur save_tracked_route.
  v_source public.log_source;
  week_start date;
  planned record;
  linked boolean := false;
  keep_targets boolean;
  from_health boolean;
  intro_week boolean;
  deload boolean;
  existing record;
  has_existing boolean := false;
  result_kind text;
  new_revision integer;
  e jsonb;
  s jsonb;
  ex_id uuid;
  ex_load public.load_type;
  ex_status public.exercise_log_status;
  ex_planned_id uuid;
  planned_exercise_id_of text;
  err_constraint text;
  err_message text;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;

  begin
    perform private.assert_log_fields(p_log, log_fields);
    -- Datum und Zeitstempel wie Zod (z.iso.date, z.iso.datetime mit Offset): kein infinity/epoch, keine Zeit ohne
    -- Zeitzone (K2).
    if (p_log ->> 'performed_on') !~ iso_date_pattern
       or (p_log ->> 'planned_date') !~ iso_date_pattern
       or (p_log ->> 'client_updated_at') !~ iso_timestamp_pattern
       or coalesce(p_log ->> 'started_at', '2000-01-01T00:00:00Z') !~ iso_timestamp_pattern
       or coalesce(p_log ->> 'finished_at', '2000-01-01T00:00:00Z') !~ iso_timestamp_pattern then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;
    log_id := (p_log ->> 'id')::uuid;
    write_id := (p_log ->> 'write_id')::uuid;
    base_revision := (p_log ->> 'base_revision')::integer;
    planned_id := (p_log ->> 'planned_session_id')::uuid;
    log_kind := (p_log ->> 'kind')::public.planned_session_kind;
    v_performed_on := (p_log ->> 'performed_on')::date;
    reference_date := (p_log ->> 'planned_date')::date;
    v_is_free := coalesce((p_log ->> 'is_free')::boolean, false);
    v_source := (p_log ->> 'source')::public.log_source;
    -- Freie Einheit (A1b): nie mit geplanter Einheit (sonst wäre sie von einem verwaisten Eintrag nicht zu trennen).
    if v_is_free and planned_id is not null then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;

    -- Geplante Einheit der Person? Erfunden, fremd oder gelöscht → gleich behandelt: verwaist (B4, H-a).
    if planned_id is not null then
      select ps.id, ps.kind, coalesce(ps.original_date, ps.scheduled_on) as reference_date, ps.is_intro_week,
             ps.is_deload, p.uses_health_data
      into planned
      from public.planned_sessions ps
      join public.user_plans p on p.id = ps.plan_id
      where ps.id = planned_id and ps.user_id = current_user_id
      for update of ps;
      linked := found;
    end if;
    if linked then
      planned_kind := planned.kind;
      reference_date := planned.reference_date;
      intro_week := planned.is_intro_week;
      deload := planned.is_deload;
    else
      intro_week := (p_log ->> 'is_intro_week')::boolean;
      deload := (p_log ->> 'is_deload')::boolean;
    end if;
    -- Vorgaben und Zustand nur aus einer noch bekannten Einheit; aus einem Gesundheits-Plan nur mit gültiger
    -- Einwilligung health_data (S1/H-c: ohne Einwilligung wie beim Widerruf neutral gespeichert).
    if linked then
      keep_targets := not planned.uses_health_data or public.has_valid_consent('health_data');
      from_health := keep_targets and planned.uses_health_data;
    else
      keep_targets := false;
      from_health := false;
    end if;
    result_kind := case when planned_id is not null and not linked then 'orphaned' else 'ok' end;

    -- Bestehender Eintrag: Schlüssel planned_session_id, sonst id (W3).
    if linked then
      select * into existing from public.session_logs sl where sl.planned_session_id = planned_id for update;
      has_existing := found;
    else
      select * into existing
      from public.session_logs sl
      where sl.id = log_id and sl.user_id = current_user_id
      for update;
      has_existing := found;
      if has_existing and existing.planned_session_id is not null then
        -- Die id gehört zu einem Eintrag einer anderen, noch bestehenden Einheit.
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;

    -- Idempotenz (R4): dieselbe Fassung erneut gesendet → ok mit aktueller revision, nichts ersetzen.
    if has_existing and existing.last_write_id = write_id then
      return jsonb_build_object(
        'result', case when planned_id is not null and existing.planned_session_id is null then 'orphaned' else 'ok' end,
        'id', existing.id, 'revision', existing.revision
      );
    end if;
    -- Optimistische Sperre (W3): nur auf Basis der gespeicherten revision; neu nur ohne Zeile.
    if has_existing and base_revision is distinct from existing.revision then
      return jsonb_build_object('result', 'conflict', 'id', existing.id, 'revision', existing.revision);
    elsif not has_existing and base_revision is not null then
      return jsonb_build_object('result', 'conflict', 'id', null, 'revision', null);
    end if;

    -- Erst für echte Schreibvorgänge (S3: dieselbe write_id ist auch nach Ablauf des Fensters noch „ok“):
    -- Frei bleibt frei, verwaist bleibt verwaist (A1b) – ein Eintrag wechselt nie die Art.
    if has_existing then
      if existing.is_free <> v_is_free then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;
    -- Herkunft (Phase 10 S1, WP3-Frage 8): gps/gpx_import nur mit verknüpfter eigener Strecke – die Herkunft setzt
    -- ausschließlich save_tracked_route. Die App sendet „manual“ (oder beim Ändern die gespeicherte Herkunft); ein neuer
    -- Eintrag mit gps/gpx_import oder ein Wechsel der Herkunft wird abgelehnt, eine gespeicherte Herkunft bleibt.
    if v_source <> 'manual' then
      if not has_existing then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      if existing.source is distinct from v_source then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;
    if linked and planned_kind <> log_kind then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;
    -- Freie Einheit (A1b): planned_date = performed_on; nur heute bis 14 Tage zurück, nie in der Zukunft; keine
    -- Einstiegs-/Erholungswoche; Name aus der festen Liste (passend zu Art bzw. Ausdauer-Art).
    if v_is_free then
      if reference_date <> v_performed_on then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      if v_performed_on > today or v_performed_on < today - backdate_days then
        raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;
      -- Wie freeSessionLogFromInput (H1): nur abgehakte Sätze, Einheit daher immer „completed“.
      if intro_week or deload
         or (p_log ->> 'status') is distinct from 'completed'
         or (p_log ->> 'name_de') is distinct from (
           free_names ->> case when log_kind = 'strength' then 'strength'
                               else coalesce(p_log -> 'cardio' ->> 'modality', '') end
         ) then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;
    -- Datumsfenster (W2): gleiche ISO-Woche wie der ursprüngliche Termin ± 1 Tag, höchstens 1 Tag voraus,
    -- höchstens 14 Tage zurück.
    week_start := date_trunc('week', reference_date)::date;
    if v_performed_on < week_start - week_tolerance_days
       or v_performed_on > week_start + 6 + week_tolerance_days
       or v_performed_on > today + future_days
       or v_performed_on < today - backdate_days then
      raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
    end if;

    -- Schutz gegen Missbrauch (K1): höchstens 10 NEUE Einträge je Kalendertag – gezählt werden Erstellungen, auch
    -- später gelöschte; die Zeile des Zählers sperrt gleichzeitige Aufrufe derselben Person.
    if not has_existing then
      insert into private.session_log_daily_counts as c (user_id, day, created)
      values (current_user_id, today, 1)
      on conflict (user_id, day) do update set created = c.created + 1
      returning c.created into created_today;
      if created_today > max_logs_per_day then
        raise exception 'Heute wurden schon zu viele Trainings gespeichert.' using errcode = 'program_limit_exceeded';
      end if;
      delete from private.session_log_daily_counts c where c.user_id = current_user_id and c.day < today;
    end if;

    -- Nie stapeln: an diesem Tag keine andere geplante Einheit eingetragen.
    if linked and exists (
      select 1 from public.session_logs sl
      where sl.user_id = current_user_id
        and sl.performed_on = v_performed_on
        and sl.planned_session_id is not null
        and sl.planned_session_id <> planned_id
    ) then
      raise exception 'An diesem Tag ist schon eine Einheit eingetragen.'
        using errcode = 'unique_violation', constraint = 'session_logs_one_per_day_idx';
    end if;

    -- Art passt: Kraft ⇒ 1–12 Übungen ohne Ausdauer; Ausdauer ⇒ Ausdauer ohne Übungen.
    if (log_kind = 'strength' and (jsonb_array_length(p_log -> 'exercises') not between 1 and exercises_per_session_max
                                   or jsonb_typeof(p_log -> 'cardio') <> 'null'))
       or (log_kind = 'endurance' and (jsonb_array_length(p_log -> 'exercises') <> 0
                                       or jsonb_typeof(p_log -> 'cardio') <> 'object')) then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;

    -- Keine doppelten Übungs-ids und keine geplante Übung zweimal (K5, wie Zod).
    if (select count(distinct x ->> 'id') <> count(*) from jsonb_array_elements(p_log -> 'exercises') x)
       or (select count(distinct x ->> 'planned_exercise_id') <> count(x ->> 'planned_exercise_id')
           from jsonb_array_elements(p_log -> 'exercises') x) then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;

    -- Übungen und Sätze prüfen (VOR dem Ersetzen: archivierte Übungen sind über den bisherigen Eintrag lesbar).
    for e in select value from jsonb_array_elements(p_log -> 'exercises') loop
      perform private.assert_log_fields(e, exercise_fields);
      ex_load := (e ->> 'load_type')::public.load_type;
      ex_status := (e ->> 'status')::public.exercise_log_status;
      ex_planned_id := (e ->> 'planned_exercise_id')::uuid;
      -- Übung existiert mit dieser Belastungsart: freigegeben oder archiviert und über eigenen Plan/Eintrag lesbar.
      if not exists (
        select 1 from public.exercises x
        where x.id = e ->> 'exercise_id'
          and x.load_type = ex_load
          and (x.status = 'published'
               or (x.status = 'archived'
                   and (exists (select 1 from public.planned_exercises pe
                                where pe.user_id = current_user_id
                                  and (pe.exercise_id = x.id or pe.source_exercise_id = x.id))
                        or exists (select 1 from public.exercise_logs el
                                   where el.user_id = current_user_id and el.exercise_id = x.id))))
      ) then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      -- Freie Einheit (A1b): freigegebene Übung aus der Bibliothek, ohne Planbezug, „done“, nur abgehakte Sätze (H1),
      -- ohne Vorgaben und Zustand, kein Wiedereinstieg. Den Übungsnamen übernimmt der Server aus der Bibliothek
      -- (unten beim Einfügen) – so bleibt ein Entwurf nach einer Umbenennung sendbar (Wächter S1), und es gibt keinen
      -- Freitext außer der Notiz.
      if v_is_free then
        if ex_planned_id is not null
           or ex_status <> 'done'
           or (e ->> 'is_return')::boolean
           or exists (select 1 from unnest(free_target_keys) k where jsonb_typeof(e -> k) <> 'null')
           or exists (select 1 from jsonb_array_elements(e -> 'sets') x where x -> 'done' is distinct from 'true'::jsonb)
           or not exists (
             select 1 from public.exercises x where x.id = e ->> 'exercise_id' and x.status = 'published'
           ) then
          raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      end if;
      -- Geplante Übung gehört zu DIESER Einheit; „alternative“ = andere Übung, sonst dieselbe.
      if linked and ex_planned_id is not null then
        select pe.exercise_id into planned_exercise_id_of
        from public.planned_exercises pe
        where pe.id = ex_planned_id and pe.user_id = current_user_id and pe.session_id = planned_id;
        if not found
           or (ex_status = 'alternative') = (planned_exercise_id_of = e ->> 'exercise_id') then
          raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
        end if;
      elsif linked and ex_status = 'alternative' then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      -- Höchstens 2 Nachkommastellen bzw. 0,5er-Schritte VOR der Rundung der Spalten.
      if (jsonb_typeof(e -> 'target_weight_kg') = 'number'
          and (e ->> 'target_weight_kg')::numeric <> round((e ->> 'target_weight_kg')::numeric, 2))
         or (jsonb_typeof(e -> 'state_weight_kg') = 'number'
             and (e ->> 'state_weight_kg')::numeric <> round((e ->> 'state_weight_kg')::numeric, 2))
         or (jsonb_typeof(e -> 'target_rpe') = 'number'
             and (e ->> 'target_rpe')::numeric * 2 <> trunc((e ->> 'target_rpe')::numeric * 2)) then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'check_violation';
      end if;
      -- „Nicht gemacht“ ohne Sätze, sonst 1–10 Sätze.
      if (ex_status = 'skipped' and jsonb_array_length(e -> 'sets') <> 0)
         or (ex_status <> 'skipped' and jsonb_array_length(e -> 'sets') not between 1 and sets_per_exercise_max) then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      for s in select value from jsonb_array_elements(e -> 'sets') loop
        perform private.assert_log_fields(s, set_fields);
        -- Gewicht nur bei Gewichtsübungen (abgehakt mit Wdh.), Dauer nur bei Halteübungen (abgehakt mit Dauer).
        if (ex_load = 'weight' and (jsonb_typeof(s -> 'duration_s') <> 'null'
                                    or (s -> 'done' = 'true' and jsonb_typeof(s -> 'reps') = 'null')))
           or (ex_load = 'time' and (jsonb_typeof(s -> 'weight_kg') <> 'null'
                                     or (s -> 'done' = 'true' and jsonb_typeof(s -> 'duration_s') = 'null')))
           or (ex_load in ('bodyweight', 'band') and (jsonb_typeof(s -> 'weight_kg') <> 'null'
                                                     or jsonb_typeof(s -> 'duration_s') <> 'null')) then
          raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
        end if;
        if (jsonb_typeof(s -> 'weight_kg') = 'number'
            and (s ->> 'weight_kg')::numeric <> round((s ->> 'weight_kg')::numeric, 2))
           or (jsonb_typeof(s -> 'rpe') = 'number'
               and (s ->> 'rpe')::numeric * 2 <> trunc((s ->> 'rpe')::numeric * 2)) then
          raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'check_violation';
        end if;
      end loop;
    end loop;
    if log_kind = 'endurance' then
      perform private.assert_log_fields(p_log -> 'cardio', cardio_fields);
    end if;

    -- Einheit speichern (neu oder ganz ersetzen).
    if has_existing then
      log_id := existing.id;
      new_revision := existing.revision + 1;
      delete from public.exercise_logs el where el.session_log_id = log_id;
      delete from public.cardio_logs cl where cl.session_log_id = log_id;
      update public.session_logs sl
      set planned_session_id = case when linked then planned_id end,
          kind = log_kind,
          performed_on = v_performed_on,
          started_at = (p_log ->> 'started_at')::timestamptz,
          finished_at = (p_log ->> 'finished_at')::timestamptz,
          status = (p_log ->> 'status')::public.session_log_status,
          session_rpe = (p_log ->> 'session_rpe')::smallint,
          notes = p_log ->> 'notes',
          name_de = case when keep_targets or v_is_free then p_log ->> 'name_de'
                         else private.neutral_session_name(log_kind) end,
          is_intro_week = intro_week,
          is_deload = deload,
          from_health_plan = from_health,
          is_free = v_is_free,
          revision = new_revision,
          last_write_id = write_id,
          source = existing.source,
          client_updated_at = least((p_log ->> 'client_updated_at')::timestamptz, now())
      where sl.id = log_id;
    else
      -- Die id erzeugt das Gerät; ist sie schon vergeben (fremder Eintrag), vergibt der Server eine neue –
      -- ohne unterscheidbare Meldung (die App übernimmt die id aus der Antwort).
      if exists (select 1 from public.session_logs sl where sl.id = log_id) then
        log_id := gen_random_uuid();
      end if;
      new_revision := 1;
      insert into public.session_logs (
        id, user_id, planned_session_id, kind, performed_on, started_at, finished_at, status, session_rpe, notes,
        name_de, is_intro_week, is_deload, from_health_plan, is_free, revision, last_write_id, source,
        client_updated_at
      )
      values (
        log_id, current_user_id, case when linked then planned_id end, log_kind, v_performed_on,
        (p_log ->> 'started_at')::timestamptz, (p_log ->> 'finished_at')::timestamptz,
        (p_log ->> 'status')::public.session_log_status, (p_log ->> 'session_rpe')::smallint, p_log ->> 'notes',
        case when keep_targets or v_is_free then p_log ->> 'name_de' else private.neutral_session_name(log_kind) end,
        intro_week, deload, from_health, v_is_free, new_revision, write_id, v_source,
        least((p_log ->> 'client_updated_at')::timestamptz, now())
      );
    end if;

    for e in select value from jsonb_array_elements(p_log -> 'exercises') loop
      ex_id := (e ->> 'id')::uuid;
      if exists (select 1 from public.exercise_logs el where el.id = ex_id) then
        ex_id := gen_random_uuid();
        exercise_id_map := exercise_id_map || jsonb_build_object(e ->> 'id', ex_id);
      end if;
      insert into public.exercise_logs (
        id, session_log_id, user_id, order_no, planned_exercise_id, exercise_id, exercise_name_de, load_type, status,
        target_sets, reps_min, reps_max, target_reps, target_extra_set, target_weight_kg, target_duration_s,
        target_rpe, state_weight_kg, state_target_reps, state_extra_set, state_duration_s, weight_confirmed, is_return
      )
      select
        ex_id, log_id, current_user_id, (e ->> 'order_no')::smallint,
        case when linked then (e ->> 'planned_exercise_id')::uuid end,
        e ->> 'exercise_id',
        case when v_is_free
             then (select x.name_de from public.exercises x where x.id = e ->> 'exercise_id')
             else e ->> 'exercise_name_de' end,
        (e ->> 'load_type')::public.load_type,
        (e ->> 'status')::public.exercise_log_status,
        t.target_sets, t.reps_min, t.reps_max, t.target_reps, t.target_extra_set, t.target_weight_kg,
        t.target_duration_s, t.target_rpe, t.state_weight_kg, t.state_target_reps, t.state_extra_set,
        t.state_duration_s,
        (e ->> 'weight_confirmed')::boolean, (e ->> 'is_return')::boolean
      from (
        select
          (e ->> 'target_sets')::smallint as target_sets, (e ->> 'reps_min')::smallint as reps_min,
          (e ->> 'reps_max')::smallint as reps_max, (e ->> 'target_reps')::smallint as target_reps,
          (e ->> 'target_extra_set')::boolean as target_extra_set,
          (e ->> 'target_weight_kg')::numeric as target_weight_kg,
          (e ->> 'target_duration_s')::smallint as target_duration_s, (e ->> 'target_rpe')::numeric as target_rpe,
          (e ->> 'state_weight_kg')::numeric as state_weight_kg,
          (e ->> 'state_target_reps')::smallint as state_target_reps,
          (e ->> 'state_extra_set')::boolean as state_extra_set,
          (e ->> 'state_duration_s')::smallint as state_duration_s
        where keep_targets
        union all
        select null, null, null, null, null, null, null, null, null, null, null, null
        where not keep_targets
      ) t;
      insert into public.set_logs (exercise_log_id, user_id, set_no, reps, weight_kg, duration_s, rpe, done)
      select ex_id, current_user_id, (x ->> 'set_no')::smallint, (x ->> 'reps')::smallint,
             (x ->> 'weight_kg')::numeric, (x ->> 'duration_s')::smallint, (x ->> 'rpe')::numeric,
             (x ->> 'done')::boolean
      from jsonb_array_elements(e -> 'sets') x;
    end loop;

    if log_kind = 'endurance' then
      insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m, elevation_m)
      values (
        log_id, current_user_id, (p_log -> 'cardio' ->> 'modality')::public.endurance_modality,
        (p_log -> 'cardio' ->> 'duration_s')::integer, (p_log -> 'cardio' ->> 'distance_m')::integer,
        (p_log -> 'cardio' ->> 'elevation_m')::integer
      );
    end if;

    -- Geplante Einheit erledigt (als Eigentümer am Verschiebe-Trigger vorbei, W1); auch skipped → completed (W8).
    if linked then
      update public.planned_sessions ps set status = 'completed' where ps.id = planned_id and ps.status <> 'completed';
    end if;
  exception
    -- Ohne „Failing row contains (…)“/Schlüsselwerte nach außen (W10): keine Notiz, keine Werte.
    -- Ganze Fehlerklassen 22 (data_exception) und 23 (integrity_constraint_violation), S1.
    when data_exception or integrity_constraint_violation then
      get stacked diagnostics err_constraint = constraint_name, err_message = message_text;
      if sqlstate = '23505' and err_constraint = 'session_logs_one_per_day_idx' then
        raise exception 'An diesem Tag ist schon eine Einheit eingetragen.' using errcode = 'unique_violation';
      elsif err_message = 'Das Datum liegt außerhalb des erlaubten Zeitraums.' then
        raise exception 'Das Datum liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = sqlstate;
  end;

  -- Vom Server neu vergebene Übungs-ids (S5) nur, wenn es welche gibt: {"<id vom Gerät>": "<gespeicherte id>"}.
  return jsonb_build_object('result', result_kind, 'id', log_id, 'revision', new_revision)
    || case when exercise_id_map = '{}'::jsonb then '{}'::jsonb
            else jsonb_build_object('exercise_ids', exercise_id_map) end;
end;
$$;

revoke all on function public.save_session_log(jsonb) from public, anon;
grant execute on function public.save_session_log(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. export_my_data() – neueste Fassung (E3) + tracked_routes
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'format_version', 1,
    'exported_at', now(),
    'user_id', current_user_id,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id = current_user_id),
      'consents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.granted_at), '[]'::jsonb) from public.consents t where t.user_id = current_user_id),
      'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t where t.user_id = current_user_id),
      'body_measurements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_measurements t where t.user_id = current_user_id),
      'measurement_reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measurement_reminders t where t.user_id = current_user_id),
      'health_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.health_screening t where t.user_id = current_user_id),
      'goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id = current_user_id),
      'user_equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_equipment t where t.user_id = current_user_id),
      'training_slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_slots t where t.user_id = current_user_id),
      'nutrition_prefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.nutrition_prefs t where t.user_id = current_user_id),
      'food_preferences', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_preferences t where t.user_id = current_user_id),
      'admin_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_users t where t.user_id = current_user_id),
      'user_plans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_plans t where t.user_id = current_user_id),
      'planned_sessions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_sessions t where t.user_id = current_user_id),
      'planned_exercises', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_exercises t where t.user_id = current_user_id),
      'session_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.performed_on), '[]'::jsonb) from public.session_logs t where t.user_id = current_user_id),
      'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_logs t where t.user_id = current_user_id),
      'set_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.set_logs t where t.user_id = current_user_id),
      'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cardio_logs t where t.user_id = current_user_id),
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id),
      'meal_plans', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.meal_plans t where t.user_id = current_user_id),
      'meal_plan_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.date, t.slot), '[]'::jsonb) from public.meal_plan_items t where t.user_id = current_user_id),
      'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.shopping_lists t where t.user_id = current_user_id),
      'shopping_list_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shopping_list_items t where t.user_id = current_user_id),
      'recipe_ratings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.recipe_ratings t where t.user_id = current_user_id),
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id),
      'food_log_entries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.eaten_on, t.created_at), '[]'::jsonb) from public.food_log_entries t where t.user_id = current_user_id),
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id),
      'custom_meals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.custom_meals t where t.user_id = current_user_id),
      'custom_meal_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.meal_id, t.order_no), '[]'::jsonb) from public.custom_meal_items t where t.user_id = current_user_id),
      'competitions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.race_date, t.created_at), '[]'::jsonb) from public.competitions t where t.user_id = current_user_id),
      -- Etappe E3: KI-Nutzung (nur Metadaten) und die eigene Beta-Freischaltung (private Tabelle, ohne granted_by).
      'ai_usage', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.ai_usage t where t.user_id = current_user_id),
      'beta_entitlements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from private.my_beta_entitlements() t),
      -- Wächter E3 N4: Protokoll der eigenen Freischaltungen/Entzüge (ohne Admin-Identität `actor`).
      'admin_actions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_admin_actions() t),
      -- Phase 10 S1: eigene Strecken (vereinfachte Linie, Kilometerzeiten; GPX je Strecke erzeugt die App).
      'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb) from public.tracked_routes t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
