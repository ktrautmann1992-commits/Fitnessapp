-- E-Bike beim Radfahren (Gründer-Wunsch 23.10.2026 „Beim Fahrrad fahren sollte der Nutzer auch auswählen können, ob
-- er mit dem E-Bike fährt.“). NUR ADDITIV:
-- 1. Spalten cardio_logs.e_bike und tracked_routes.e_bike (boolean not null default false) mit CHECK „nur beim Rad“.
--    Bestehende Zeilen = normales Rad. Sportart bleibt 'bike' (kein neuer Enum-Wert): Summen zählen E-Bike-Fahrten
--    beim Rad mit und weisen „davon E-Bike“ aus; die kcal-Schätzung nutzt TRAINING_MET.eBike (packages/core).
-- 2. save_session_log: NEUESTE Fassung (20261018200400_live_adjust_outbox.sql) Zeile für Zeile übernommen, nur
--    cardio_fields um das OPTIONALE Feld e_bike erweitert (fehlt = false; ältere App-Fassungen und wartende Einträge
--    bleiben gültig), Einfügen in cardio_logs mit e_bike, und die verknüpfte eigene Rad-Strecke folgt dem Eintrag.
-- 3. save_tracked_route: NEUESTE Fassung (20261020210000_tracked_route_elevation_profile.sql) übernommen, nur das
--    OPTIONALE Feld e_bike ergänzt; ein verknüpfter Rad-Eintrag übernimmt die Angabe.
-- 4. update_tracked_route: Fassung aus 20261016220200_tracked_route_rpcs.sql übernommen, nur das OPTIONALE Feld e_bike
--    ergänzt (fehlt = unverändert); der verknüpfte Rad-Eintrag folgt (Revision + 1).
-- Uhr-Abgleich (save_wearable_sessions, save_wearable_route) bleibt unverändert: Health Connect kennt keine
-- E-Bike-Art (EXERCISE_TYPE_BIKING = 8, BIKING_STATIONARY = 9) → neue Uhr-Einheiten sind normales Rad (Standard
-- false); die Person kann im Eintrag bzw. an der Strecke auf E-Bike wechseln. Diese Funktionen ändern modality/sport
-- nie, die CHECKs bleiben dort erfüllt.
-- Export: export_my_data nimmt to_jsonb der ganzen Zeilen (cardio_logs, tracked_routes) – die Spalten sind automatisch
-- dabei. Kein Gesundheitsdatum, RLS und Rechte der Tabellen unverändert (Schreiben weiter nur über die Funktionen).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Spalten
-- ---------------------------------------------------------------------------------------------------------
alter table public.cardio_logs add column e_bike boolean not null default false;
alter table public.cardio_logs
  add constraint cardio_logs_e_bike_only_bike check (not e_bike or modality = 'bike');
comment on column public.cardio_logs.e_bike is
  'Rad mit elektrischer Unterstützung (nur bei modality = bike). Standard false = normales Rad.';

alter table public.tracked_routes add column e_bike boolean not null default false;
alter table public.tracked_routes
  add constraint tracked_routes_e_bike_only_bike check (not e_bike or sport = 'bike');
comment on column public.tracked_routes.e_bike is
  'Rad mit elektrischer Unterstützung (nur bei sport = bike). Standard false = normales Rad.';

-- ---------------------------------------------------------------------------------------------------------
-- 2. save_session_log
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
  -- E-Bike (20261023140000): e_bike darf fehlen (ältere App-Fassungen, wartende Einträge) = false.
  cardio_fields constant jsonb := '{
    "modality": "string", "duration_s": "number", "distance_m": "number|null", "elevation_m": "number|null",
    "e_bike": "boolean|missing"
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
  -- Verknüpfte Strecke (Wächter S1 M3).
  route_row record;
  route_found boolean := false;
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
    -- Verknüpfte Strecke (Wächter S1 M3, sichere Variante a): Art, Tag, Distanz und Dauer müssen weiter zur Strecke
    -- passen (private.session_log_fits_route) – sonst klare Ablehnung ohne Werte. Sperr-Reihenfolge wie
    -- save_tracked_route: erst der Eintrag (oben FOR UPDATE), dann die Strecke.
    if has_existing then
      select t.sport, t.started_at, t.duration_s, t.moving_s, t.distance_m into route_row
      from public.tracked_routes t
      where t.session_log_id = existing.id
      for share;
      route_found := found;
      if route_found then
        if not private.session_log_fits_route(
             route_row.sport, route_row.started_at, route_row.duration_s, route_row.moving_s, route_row.distance_m,
             log_kind, (p_log -> 'cardio' ->> 'modality')::public.endurance_modality, v_performed_on,
             (p_log -> 'cardio' ->> 'duration_s')::integer, (p_log -> 'cardio' ->> 'distance_m')::integer) then
          raise exception 'Der Eintrag passt nicht mehr zur verknüpften Strecke.'
            using errcode = 'invalid_parameter_value';
        end if;
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
      insert into public.cardio_logs (
        session_log_id, user_id, modality, duration_s, distance_m, elevation_m, e_bike
      )
      values (
        log_id, current_user_id, (p_log -> 'cardio' ->> 'modality')::public.endurance_modality,
        (p_log -> 'cardio' ->> 'duration_s')::integer, (p_log -> 'cardio' ->> 'distance_m')::integer,
        (p_log -> 'cardio' ->> 'elevation_m')::integer,
        -- E-Bike nur beim Rad (CHECK cardio_logs_e_bike_only_bike → „Ungültige Werte im Tagebuch.“).
        coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false)
      );
      -- E-Bike: die verknüpfte eigene Rad-Strecke folgt dem Eintrag (eine Angabe je Fahrt).
      update public.tracked_routes t
      set e_bike = coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false)
      where t.session_log_id = log_id and t.user_id = current_user_id and t.sport = 'bike'
        and t.e_bike is distinct from coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false);
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
      elsif err_message = 'Der Eintrag passt nicht mehr zur verknüpften Strecke.' then
        raise exception 'Der Eintrag passt nicht mehr zur verknüpften Strecke.' using errcode = 'invalid_parameter_value';
      end if;
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = sqlstate;
  end;

  -- 4b (PLAN-PHASE-4B 4.6 Punkt 6): Ereignis für die Live-Anpassung – nur Premium (Flag und Freischaltung, Wächter S2);
  -- Fehler der Hilfsfunktion brechen das Speichern nie ab.
  perform private.enqueue_adjustment_event(current_user_id, 'session_logged', log_id);

  -- Vom Server neu vergebene Übungs-ids (S5) nur, wenn es welche gibt: {"<id vom Gerät>": "<gespeicherte id>"}.
  return jsonb_build_object('result', result_kind, 'id', log_id, 'revision', new_revision)
    || case when exercise_id_map = '{}'::jsonb then '{}'::jsonb
            else jsonb_build_object('exercise_ids', exercise_id_map) end;
end;
$$;
revoke all on function public.save_session_log(jsonb) from public, anon;
grant execute on function public.save_session_log(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. save_tracked_route
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
  -- Etappe E4: darf fehlen (ältere App-Fassungen). sync: TRACKED_ROUTE_OPTIONAL_KEYS in packages/core
  -- E-Bike (20261023140000): e_bike darf ebenfalls fehlen (= false).
  optional_keys constant text[] := array['elevation_profile', 'e_bike'];
  -- sync: TRACKED_ROUTE_LIMITS in packages/core/src/constants.ts
  max_saves_per_day constant integer := 20;
  clock_skew_s constant integer := 300;
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
  log_row record;
  log_found boolean := false;
  created_today integer;
  saved_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(r, route_keys || optional_keys, 'Strecke');
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
     or (r ? 'elevation_profile' and jsonb_typeof(r -> 'elevation_profile') not in ('array', 'null'))
     or (r ? 'e_bike' and jsonb_typeof(r -> 'e_bike') <> 'boolean')
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
    select sl.kind, sl.performed_on, cl.modality, cl.duration_s, cl.distance_m into log_row
    from public.session_logs sl
    join public.cardio_logs cl on cl.session_log_id = sl.id
    where sl.id = v_session_log_id and sl.user_id = current_user_id and sl.kind = 'endurance'
      and cl.modality = v_sport
    for update of sl;
    log_found := found;
    if not log_found then
      raise exception 'Dieser Eintrag passt nicht zur Strecke.' using errcode = 'invalid_parameter_value';
    end if;
    if not private.session_log_fits_route(
         v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer, (r ->> 'distance_m')::integer,
         log_row.kind, log_row.modality, log_row.performed_on, log_row.duration_s, log_row.distance_m)
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
      bbox, km_splits, difficulty, is_favorite, base_route_id, note, session_log_id, source,
      elevation_profile, e_bike
    )
    values (
      v_id, current_user_id, r ->> 'name', v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer,
      (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer, r ->> 'polyline',
      v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', (r ->> 'difficulty')::public.route_difficulty,
      (r ->> 'is_favorite')::boolean, v_base_route_id, r ->> 'note', v_session_log_id, v_source,
      case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
      -- Nur beim Rad (CHECK tracked_routes_e_bike_only_bike → „Ungültige Angaben zur Strecke.“).
      coalesce((r ->> 'e_bike')::boolean, false)
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
    -- E-Bike: Strecke und verknüpfter Eintrag tragen dieselbe Angabe (an der Strecke zuletzt gewählt). Die Revision
    -- steigt ohnehin gleich darunter.
    update public.cardio_logs cl
    set e_bike = coalesce((r ->> 'e_bike')::boolean, false)
    where cl.session_log_id = v_session_log_id and cl.modality = 'bike';
    update public.session_logs sl
    set source = case v_source when 'recorded' then 'gps' else 'gpx_import' end::public.log_source,
        revision = sl.revision + 1
    where sl.id = v_session_log_id;
  end if;
  return saved_id;
end;
$$;
revoke all on function public.save_tracked_route(jsonb) from public, anon;
grant execute on function public.save_tracked_route(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. update_tracked_route
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.update_tracked_route(p_route jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  update_keys constant text[] := array['id', 'name', 'difficulty', 'is_favorite', 'note'];
  -- E-Bike (20261023140000): darf fehlen (ältere App-Fassungen) = unverändert.
  update_optional_keys constant text[] := array['e_bike'];
  current_user_id uuid := auth.uid();
  r jsonb := p_route;
  v_id uuid;
  v_log_id uuid;
  v_e_bike boolean;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(r, update_keys || update_optional_keys, 'Strecke');
  if not (r ?& update_keys)
     or jsonb_typeof(r -> 'id') <> 'string'
     or jsonb_typeof(r -> 'name') <> 'string'
     or jsonb_typeof(r -> 'difficulty') not in ('string', 'null')
     or jsonb_typeof(r -> 'is_favorite') <> 'boolean'
     or jsonb_typeof(r -> 'note') not in ('string', 'null')
     or (r ? 'e_bike' and jsonb_typeof(r -> 'e_bike') <> 'boolean') then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (r ->> 'id')::uuid;
    update public.tracked_routes t
    set name = r ->> 'name',
        difficulty = (r ->> 'difficulty')::public.route_difficulty,
        is_favorite = (r ->> 'is_favorite')::boolean,
        note = r ->> 'note',
        -- Fehlt = unverändert; true nur beim Rad (CHECK tracked_routes_e_bike_only_bike).
        e_bike = coalesce((r ->> 'e_bike')::boolean, t.e_bike)
    where t.id = v_id and t.user_id = current_user_id
    returning t.session_log_id, t.e_bike into v_log_id, v_e_bike;
  exception
    when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end;
  if not found then
    raise exception 'Strecke nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
  -- E-Bike: der verknüpfte eigene Rad-Eintrag folgt der Strecke (Revision + 1 wie beim Abgleich der Uhr, damit das
  -- Gerät neu lädt; kcal-Schätzung und Summen nutzen die neue Angabe).
  if v_log_id is not null and r ? 'e_bike' then
    update public.cardio_logs cl
    set e_bike = v_e_bike
    where cl.session_log_id = v_log_id and cl.user_id = current_user_id and cl.modality = 'bike'
      and cl.e_bike is distinct from v_e_bike;
    if found then
      update public.session_logs sl
      set revision = sl.revision + 1, last_write_id = gen_random_uuid(), client_updated_at = now()
      where sl.id = v_log_id and sl.user_id = current_user_id;
    end if;
  end if;
end;
$$;
revoke all on function public.update_tracked_route(jsonb) from public, anon;
grant execute on function public.update_tracked_route(jsonb) to authenticated;
