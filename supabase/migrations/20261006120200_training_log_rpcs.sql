-- Phase 4 Etappe B · Server-Funktionen des Trainingstagebuchs (docs/PLAN-PHASE-4.md Abschnitte 3.6 und 3.7):
-- save_session_log, delete_session_log, close_missed_sessions, recent_exercise_logs, export_my_data,
-- revoke_health_data; private.neutralize_health_plan_logs; consents_after_revoke() erweitert; Phase-3-Nachtrag
-- save_training_plan (H-c).
--
-- Muster wie save_training_plan: security definer + search_path = '', user_id immer aus auth.uid(), nur bekannte
-- Felder (wie die strikten Zod-Schemas in packages/core/src/log/schemas.ts, Abgleich in db-sync.test.ts),
-- Grenzen über die CHECKs der Tabellen, alles in EINER Transaktion. Fehler ohne Zeileninhalt (W10): alle Fehler der
-- Klassen 22 (data_exception: Umwandlungen, Bereiche) und 23 (integrity_constraint_violation: CHECKs, Indizes,
-- Fremdschlüssel) werden abgefangen und ohne Detail neu ausgelöst – Notizen, Werte und Gesundheitsbezug landen nie
-- in Meldungen oder Logs.
-- Sperr-Reihenfolge überall: erst die geplante Einheit (planned_sessions), dann der Eintrag (session_logs).
-- Record-Variablen werden nur gelesen, wenn sie sicher zugewiesen sind (sonst 55000 je nach Verbindung).
-- „Heute“ = private.berlin_today() (Europe/Berlin, in Tests fest gesetzt).

-- ---------------------------------------------------------------------------------------------------------
-- Hilfsfunktionen (nicht über die API erreichbar, selbst KEIN security definer)
-- ---------------------------------------------------------------------------------------------------------

-- Genau die Felder aus p_fields (Name → erlaubte JSON-Typen, mit „|“ getrennt), alle Pflicht (Zod: nullable, nicht
-- optional), keine weiteren. Meldung ohne Inhalte.
create or replace function private.assert_log_fields(p_value jsonb, p_fields jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object'
     or exists (select 1 from jsonb_object_keys(p_value) k where not p_fields ? k)
     or exists (
       select 1
       from jsonb_each_text(p_fields) f
       where not coalesce(jsonb_typeof(p_value -> f.key), 'missing') = any (string_to_array(f.value, '|'))
     ) then
    raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

revoke all on function private.assert_log_fields(jsonb, jsonb) from public;

-- Neutraler Name einer Einheit (S1, B4): verrät keine Varianten-Namen aus einem Gesundheits-Plan.
create or replace function private.neutral_session_name(p_kind public.planned_session_kind)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_kind = 'endurance' then 'Ausdauer-Einheit' else 'Kraft-Einheit' end
$$;

revoke all on function private.neutral_session_name(public.planned_session_kind) from public;

-- S1 (Wächter B1): Einträge aus Plänen mit Gesundheits-Check neutralisieren – alle target_* und state_* leer,
-- Name neutral, Kennzeichen false. Ist-Werte (Übung, Sätze, Gewicht, Wdh., Dauer, Distanz, RPE, Notiz), kind,
-- Datum, is_intro_week/is_deload bleiben. Aufgerufen vom Widerruf (consents_after_revoke) und von
-- save_training_plan ohne gültige Einwilligung (H-c). Idempotent; ändert die revision nicht (Geräte bereinigen
-- ihre Entwürfe selbst, 3.4 S1).
create or replace function private.neutralize_health_plan_logs(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.exercise_logs el
  set target_sets = null, reps_min = null, reps_max = null, target_reps = null, target_extra_set = null,
      target_weight_kg = null, target_duration_s = null, target_rpe = null,
      state_weight_kg = null, state_target_reps = null, state_extra_set = null, state_duration_s = null
  from public.session_logs sl
  where sl.id = el.session_log_id
    and sl.user_id = p_user_id
    and el.user_id = p_user_id
    and sl.from_health_plan;
  update public.session_logs sl
  set name_de = private.neutral_session_name(sl.kind), from_health_plan = false
  where sl.user_id = p_user_id and sl.from_health_plan;
end;
$$;

revoke all on function private.neutralize_health_plan_logs(uuid) from public;

-- Tageslimit (K1): Erstellungen je Person und Kalendertag (Europe/Berlin), auch später gelöschte Einträge zählen.
-- Nur Zählerstand, kein Tagebuch-Inhalt; nicht über die API erreichbar (Schema private), RLS ohne Regeln = nur
-- Eigentümer; gelöscht mit dem Konto. Ältere Tage räumt save_session_log selbst weg.
create table private.session_log_daily_counts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  created integer not null check (created >= 1),
  primary key (user_id, day)
);
alter table private.session_log_daily_counts enable row level security;
revoke all on table private.session_log_daily_counts from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1. save_session_log(p_log jsonb) – einziger Schreibweg für Einträge (3.6 Punkt 1)
-- Antwort: {"result": "ok" | "orphaned" | "conflict", "id": …, "revision": …}
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
    "client_updated_at": "string", "exercises": "array", "cardio": "object|null"
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
    if linked and planned_kind <> log_kind then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
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
          name_de = case when keep_targets then p_log ->> 'name_de' else private.neutral_session_name(log_kind) end,
          is_intro_week = intro_week,
          is_deload = deload,
          from_health_plan = from_health,
          revision = new_revision,
          last_write_id = write_id,
          source = (p_log ->> 'source')::public.log_source,
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
        name_de, is_intro_week, is_deload, from_health_plan, revision, last_write_id, source, client_updated_at
      )
      values (
        log_id, current_user_id, case when linked then planned_id end, log_kind, v_performed_on,
        (p_log ->> 'started_at')::timestamptz, (p_log ->> 'finished_at')::timestamptz,
        (p_log ->> 'status')::public.session_log_status, (p_log ->> 'session_rpe')::smallint, p_log ->> 'notes',
        case when keep_targets then p_log ->> 'name_de' else private.neutral_session_name(log_kind) end,
        intro_week, deload, from_health, new_revision, write_id, (p_log ->> 'source')::public.log_source,
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
        e ->> 'exercise_id', e ->> 'exercise_name_de', (e ->> 'load_type')::public.load_type,
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
-- 2. delete_session_log(p_id, p_base_revision) – nur auf Basis der gespeicherten revision (R4), nur online.
-- Die geplante Einheit wird wieder planned, wenn ihr Plan aktiv ist, ihre Woche läuft UND an ihrem Tag keine andere
-- geplante Einheit liegt (der Index „nie stapeln“ gilt nur für planned); sonst skipped (Wächter Etappe B, B1).
-- Antwort: {"result": "ok" | "conflict", "id": …, "revision": …}; schon gelöscht = ok (idempotent).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.delete_session_log(p_id uuid, p_base_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  planned_ref uuid;
  existing record;
  session record;
  session_found boolean := false;
  back_to_planned boolean;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Sperr-Reihenfolge wie save_session_log und revoke_health_data (Wächter Etappe B, N2): erst die Einheit, dann
  -- der Eintrag. Deshalb den Verweis zuerst ohne Sperre lesen.
  select sl.planned_session_id into planned_ref
  from public.session_logs sl
  where sl.id = p_id and sl.user_id = current_user_id;
  if not found then
    return jsonb_build_object('result', 'ok', 'id', p_id, 'revision', null);
  end if;
  if planned_ref is not null then
    select ps.id, ps.status, ps.scheduled_on, coalesce(ps.original_date, ps.scheduled_on) as reference_date,
           p.status as plan_status
    into session
    from public.planned_sessions ps
    join public.user_plans p on p.id = ps.plan_id
    where ps.id = planned_ref and ps.user_id = current_user_id
    for update of ps;
    session_found := found;
  end if;
  select * into existing
  from public.session_logs sl
  where sl.id = p_id and sl.user_id = current_user_id
  for update;
  if not found then
    return jsonb_build_object('result', 'ok', 'id', p_id, 'revision', null);
  end if;
  if p_base_revision is distinct from existing.revision then
    return jsonb_build_object('result', 'conflict', 'id', existing.id, 'revision', existing.revision);
  end if;
  delete from public.session_logs sl where sl.id = existing.id;
  -- Nur die gesperrte Einheit anfassen (Verweis inzwischen null = Plan gelöscht → nichts zu tun).
  -- Verschachtelt: „session“ nur lesen, wenn es zugewiesen ist (N1).
  if session_found and existing.planned_session_id is not distinct from planned_ref then
    if session.status = 'completed' then
      back_to_planned := session.plan_status = 'active'
        and date_trunc('week', session.reference_date)::date + 6 >= today
        and not exists (
          select 1 from public.planned_sessions o
          where o.user_id = current_user_id and o.scheduled_on = session.scheduled_on and o.status = 'planned'
            and o.id <> session.id
        );
      begin
        update public.planned_sessions ps
        set status = case when back_to_planned then 'planned'::public.planned_session_status
                          else 'skipped'::public.planned_session_status end
        where ps.id = session.id;
      exception
        -- Gleichzeitig verschobene Einheit: ohne Schlüsselwerte (W10).
        when unique_violation then
          raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'unique_violation';
      end;
    end if;
  end if;
  return jsonb_build_object('result', 'ok', 'id', existing.id, 'revision', null);
end;
$$;

revoke all on function public.delete_session_log(uuid, integer) from public, anon;
grant execute on function public.delete_session_log(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. close_missed_sessions() – eigene Einheiten des AKTIVEN Plans, die noch planned sind und deren ISO-Woche
-- (coalesce(original_date, scheduled_on)) vorbei ist → skipped. Idempotent; Anzahl geänderter Einheiten.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.close_missed_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  changed integer;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  update public.planned_sessions ps
  set status = 'skipped'
  from public.user_plans p
  where p.id = ps.plan_id
    and p.status = 'active'
    and p.user_id = current_user_id
    and ps.user_id = current_user_id
    and ps.status = 'planned'
    and date_trunc('week', coalesce(ps.original_date, ps.scheduled_on))::date + 6 < today;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.close_missed_sessions() from public, anon;
grant execute on function public.close_missed_sessions() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. recent_exercise_logs(p_per_exercise) – Grundlage der Progression (W4, R1), security invoker (RLS greift).
-- Je exercise_id (tatsächlich gemachte Übung, mit Sätzen): die p_per_exercise neuesten ZÄHLENDEN Einträge (ohne
-- Erholungs-, Einstiegswoche und Wiedereinstieg, wie isCountingEntry), den neuesten Eintrag überhaupt und – solange
-- es keinen zählenden gibt – den neuesten Einstiegswochen-Eintrag (Kalibrierungsquelle).
-- Antwort: {"session_logs": […], "exercise_logs": […], "set_logs": […]} in Tabellenform.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.recent_exercise_logs(p_per_exercise integer default 2)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with ranked as (
    select
      el.id,
      el.session_log_id,
      (not sl.is_deload and not sl.is_intro_week and not el.is_return) as counting,
      sl.is_intro_week,
      row_number() over (
        partition by el.exercise_id
        order by sl.performed_on desc, coalesce(sl.finished_at, sl.client_updated_at) desc, el.id
      ) as rn_all,
      row_number() over (
        partition by el.exercise_id, (not sl.is_deload and not sl.is_intro_week and not el.is_return)
        order by sl.performed_on desc, coalesce(sl.finished_at, sl.client_updated_at) desc, el.id
      ) as rn_kind,
      row_number() over (
        partition by el.exercise_id, sl.is_intro_week
        order by sl.performed_on desc, coalesce(sl.finished_at, sl.client_updated_at) desc, el.id
      ) as rn_intro,
      bool_or(not sl.is_deload and not sl.is_intro_week and not el.is_return)
        over (partition by el.exercise_id) as has_counting
    from public.exercise_logs el
    join public.session_logs sl on sl.id = el.session_log_id
    where el.user_id = (select auth.uid()) and el.status <> 'skipped'
  ),
  picked as (
    select r.id, r.session_log_id
    from ranked r
    where r.rn_all = 1
       or (r.counting and r.rn_kind <= least(greatest(coalesce(p_per_exercise, 2), 1), 10))
       or (not r.has_counting and r.is_intro_week and r.rn_intro = 1)
  )
  select jsonb_build_object(
    'session_logs', coalesce((
      select jsonb_agg(to_jsonb(sl) order by sl.performed_on desc, sl.id)
      from public.session_logs sl
      where sl.id in (select p.session_log_id from picked p)
    ), '[]'::jsonb),
    'exercise_logs', coalesce((
      select jsonb_agg(to_jsonb(el) order by el.session_log_id, el.order_no)
      from public.exercise_logs el
      where el.id in (select p.id from picked p)
    ), '[]'::jsonb),
    'set_logs', coalesce((
      select jsonb_agg(to_jsonb(st) order by st.exercise_log_id, st.set_no)
      from public.set_logs st
      where st.exercise_log_id in (select p.id from picked p)
    ), '[]'::jsonb)
  )
$$;

revoke all on function public.recent_exercise_logs(integer) from public, anon;
grant execute on function public.recent_exercise_logs(integer) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. export_my_data() – Recht auf Auskunft (Frage 8, W9): alle eigenen Zeilen ALLER Nutzertabellen, security
-- invoker (RLS greift; kein Leserecht auf auth.users nötig – die Konto-E-Mail ergänzt die App). pgTAP gleicht die
-- Schlüssel von "data" mit allen public-Tabellen mit Fremdschlüssel auf auth.users ab (H-f).
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
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6. revoke_health_data(p_delete_logs) – Widerruf health_data als EINE Transaktion (R3). Bei p_delete_logs zuerst
-- eigene Einträge mit from_health_plan löschen (Kaskade auf Übungen/Sätze/Ausdauer), dann alle aktiven
-- Einwilligungen health_data widerrufen → consents_after_revoke() neutralisiert die übrigen Einträge und löscht
-- Gesundheitsdaten und Pläne mit Gesundheitsbezug. Ersetzt das direkte `update consents` der App für health_data.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.revoke_health_data(p_delete_logs boolean)
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
  if p_delete_logs is null then
    raise exception 'Ungültige Eingabe.' using errcode = 'invalid_parameter_value';
  end if;
  -- Einheiten der Gesundheits-Pläne sperren: ein gleichzeitig laufendes save_session_log ist danach fertig und
  -- sein Eintrag für das folgende Löschen sichtbar (Wächter Etappe B, S2).
  perform 1
  from public.planned_sessions ps
  join public.user_plans p on p.id = ps.plan_id
  where ps.user_id = current_user_id and p.uses_health_data
  order by ps.id
  for update of ps;
  if p_delete_logs then
    delete from public.session_logs sl where sl.user_id = current_user_id and sl.from_health_plan;
  end if;
  update public.consents c
  set revoked_at = now()
  where c.user_id = current_user_id and c.consent_type = 'health_data' and c.revoked_at is null;
  -- Auch ohne aktive Einwilligung (z. B. schon widerrufen): keine Vorgaben aus Gesundheits-Plänen behalten.
  perform private.neutralize_health_plan_logs(current_user_id);
end;
$$;

revoke all on function public.revoke_health_data(boolean) from public, anon;
grant execute on function public.revoke_health_data(boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data (3.7): ZUERST Einträge aus Gesundheits-Plänen neutralisieren (S1), dann wie bisher
-- Gesundheitsdaten und alle Pläne mit uses_health_data löschen → Verweise der Einträge werden null (B2), danach
-- erneut neutralisieren (gleichzeitig gespeicherte Einträge, Wächter Etappe B, B2).
-- Einträge, Ist-Werte, Ausdauer, Notizen und Startgewichte bleiben.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.consents_after_revoke()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.consent_type = 'health_data' then
    perform private.neutralize_health_plan_logs(new.user_id);
    delete from public.body_metrics where user_id = new.user_id;
    delete from public.body_measurements where user_id = new.user_id;
    delete from public.health_screening where user_id = new.user_id;
    delete from public.food_preferences where user_id = new.user_id and kind = 'intolerance';
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;

-- ---------------------------------------------------------------------------------------------------------
-- Phase-3-Nachtrag (H-c): save_training_plan ohne gültige Einwilligung health_data (z. B. Neu-Einwilligung einer
-- neuen Textfassung abgelehnt) neutralisiert die Einträge aus Gesundheits-Plänen wie beim Widerruf. Sonst
-- unverändert gegenüber 20261005130100_plan_session_kinds.sql (gleiche Signatur).
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_training_plan(p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_keys constant text[] := array[
    'template_id', 'template_title_de', 'template_version', 'engine_version', 'match_quality', 'notes',
    'uses_health_data', 'medical_notice', 'inputs', 'start_date', 'sessions'
  ];
  -- sync: PLAN_SAVE_LIMITS in packages/core/src/constants.ts
  past_tolerance_days constant integer := 1;
  start_date_max_days_ahead constant integer := 7;
  schedule_max_days_ahead constant integer := 56;
  kept_replaced_plans constant integer := 20;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  basis record;
  start_on date;
  old_plan_id uuid;
  new_plan_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(p_plan, plan_keys, 'Plan');
  perform private.assert_plan_inputs(p_plan -> 'inputs');

  -- Vorlage: freigegeben in genau dieser Version – oder (nur reine Ausdauer-Pläne) gar keine; dann keine
  -- Kraft-Einheit (Erweiterungsplan 4.4 Punkt 4).
  if jsonb_typeof(p_plan -> 'template_id') = 'null' then
    if jsonb_typeof(p_plan -> 'template_title_de') <> 'null'
       or jsonb_typeof(p_plan -> 'template_version') <> 'null'
       or jsonb_typeof(p_plan -> 'sessions') is distinct from 'array'
       or exists (
         select 1 from jsonb_array_elements(p_plan -> 'sessions') s where s ->> 'kind' is distinct from 'endurance'
       ) then
      raise exception 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.' using errcode = 'invalid_parameter_value';
    end if;
  elsif not exists (
    select 1 from public.plan_templates t
    where t.id = p_plan ->> 'template_id'
      and t.status = 'published'
      and t.version::text = p_plan ->> 'template_version'
  ) then
    raise exception 'Vorlage nicht freigegeben oder veraltet.' using errcode = 'invalid_parameter_value';
  end if;

  select * into basis from private.plan_health_basis();
  if (p_plan -> 'uses_health_data') is distinct from to_jsonb(basis.uses_health_data)
     or (p_plan -> 'medical_notice') is distinct from to_jsonb(basis.medical_notice) then
    raise exception 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- H-c: ohne gültige Einwilligung keine Vorgaben aus Gesundheits-Plänen im Tagebuch.
  if not public.has_valid_consent('health_data') then
    perform private.neutralize_health_plan_logs(current_user_id);
  end if;

  -- Bisherigen aktiven Plan ersetzen; seine noch geplanten Einheiten ab GESTERN entfallen (der neue Plan darf
  -- ab gestern planen – sonst Kollision im Index „nie stapeln“). Ältere Einheiten bleiben als Verlauf.
  update public.user_plans
  set status = 'replaced', replaced_at = now()
  where user_id = current_user_id and status = 'active'
  returning id into old_plan_id;
  if old_plan_id is not null then
    delete from public.planned_sessions
    where plan_id = old_plan_id and status = 'planned' and scheduled_on >= today - past_tolerance_days;
  end if;

  begin
    start_on := (p_plan ->> 'start_date')::date;
    insert into public.user_plans (
      user_id, status, template_id, template_title_de, template_version, engine_version, match_quality, notes,
      uses_health_data, medical_notice, inputs, start_date
    )
    values (
      current_user_id, 'active', p_plan ->> 'template_id', p_plan ->> 'template_title_de',
      (p_plan ->> 'template_version')::integer, (p_plan ->> 'engine_version')::smallint,
      (p_plan ->> 'match_quality')::public.plan_match_quality,
      coalesce(
        (select array_agg(n::public.plan_note) from jsonb_array_elements_text(p_plan -> 'notes') n),
        '{}'
      ),
      basis.uses_health_data, basis.medical_notice, p_plan -> 'inputs', start_on
    )
    returning id into new_plan_id;
  exception
    -- Ohne „Failing row contains (…)“ (u. a. user_id, uses_health_data) nach außen.
    when check_violation or unique_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Werte im Plan.' using errcode = sqlstate;
  end;
  if start_on not between today - past_tolerance_days and today + start_date_max_days_ahead then
    raise exception 'Der Plan-Start liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
  end if;

  perform private.insert_plan_sessions(
    new_plan_id, current_user_id, p_plan -> 'sessions', 1,
    today - past_tolerance_days, today + schedule_max_days_ahead
  );
  if start_on > (select min(s.scheduled_on) from public.planned_sessions s where s.plan_id = new_plan_id) then
    raise exception 'Der Plan-Start liegt nach der ersten Einheit.' using errcode = 'invalid_parameter_value';
  end if;

  -- Aufräumen: ersetzte Pläne ohne Einheiten jenseits der neuesten 20 ersetzten. Tagebuch-Einträge bleiben
  -- (Verweise per on delete set null, B2).
  delete from public.user_plans p
  where p.user_id = current_user_id
    and p.status = 'replaced'
    and not exists (select 1 from public.planned_sessions s where s.plan_id = p.id)
    and p.id not in (
      select r.id
      from public.user_plans r
      where r.user_id = current_user_id and r.status = 'replaced'
      order by r.replaced_at desc, r.created_at desc
      limit kept_replaced_plans
    );

  return new_plan_id;
end;
$$;

revoke all on function public.save_training_plan(jsonb) from public, anon;
grant execute on function public.save_training_plan(jsonb) to authenticated;
