-- Phase 10 · Etappe WP3 · Funktionen zum Wettkampf (docs/PLAN-PHASE-10.md Abschnitt 7). Nur additiv bzw. per
-- `create or replace` mit GLEICHER Signatur:
-- 1. private.insert_plan_sessions (neueste Fassung 20261005130100_plan_session_kinds.sql unverändert übernommen und
--    nur erweitert): nimmt die Felder des Wettkampfplans an (workout_type, training_phase, workout_steps,
--    target_distance_m – fehlen sie, ist alles wie bisher) und prüft die Regeln je Person, die kein CHECK sieht
--    (Tabelle 3.3, Wächter N2 zu WP2). save_training_plan und append_plan_block bleiben unverändert – sie rufen diese
--    Funktion. Pläne ohne Wettkampf: gleicher Weg, gleiche Fehler.
-- 2. save_competition, cancel_competition, complete_competition, delete_competition (neu, security definer,
--    search_path = '', user_id immer aus auth.uid(), Prüfungen wie saveCompetitionPayloadSchema/competitionSchema).
-- 3. private.consents_after_revoke() und export_my_data() in der NEUESTEN Fassung (20261015160100_custom_meal_rpcs.sql)
--    unverändert übernommen und nur erweitert (Plan-Bezug der Wettkämpfe leeren; Export mit competitions).
-- Fehlermeldungen: feste deutsche Texte ohne Werte (kein „Failing row contains“).
--
-- Sperr-Reihenfolge (Wächter N7 S2): save_competition MIT Plan-Bezug sperrt die Einwilligung health_data FOR SHARE
-- (private.plan_health_basis) VOR der Wettkampf-Zeile; der Widerruf sperrt die Einwilligung zuerst (FOR UPDATE) und
-- leert danach im Trigger den Plan-Bezug – gleiche Reihenfolge, kein Deadlock; ein Speichern nach dem Widerruf wird
-- abgelehnt, eines davor wird danach geleert.

-- ---------------------------------------------------------------------------------------------------------
-- 1. private.insert_plan_sessions
-- Zusätzlich zu den CHECKs der Tabelle (Art ↔ Anstrengung, Erholungswoche ohne harte Art außer Tapering, Schritte):
-- - Einheiten mit Art nur in Plänen mit Gesundheits-Check (uses_health_data), nie in der Schwangerschaft (neuester
--   Check), unter 18 kein Marathon,
-- - Anstrengung (Ziel und Schritte) höchstens 8, unter 18 höchstens 7, ab 65 höchstens 6 (Alter heute, Europe/Berlin),
-- - mit Arzt-Hinweis (medical_notice) keine harte Art und kein Abschnitt ab Anstrengung 6,
-- - harte Einheiten je Kalenderwoche des Plans: Einsteiger/vorsichtige Startgruppe 1, sonst 2.
-- Level aus user_plans.inputs (experienceLevel), unbekannt → strenger Wert.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.insert_plan_sessions(
  p_plan_id uuid,
  p_user_id uuid,
  p_sessions jsonb,
  p_block_no integer,
  p_earliest date,
  p_latest date
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  session_keys constant text[] := array[
    'block_no', 'week_no', 'is_intro_week', 'is_deload', 'kind', 'template_day_index', 'scheduled_on', 'name_de',
    'focus', 'endurance_modality', 'effort_target', 'estimated_minutes', 'warmup_de', 'cooldown_de', 'exercises',
    'workout_type', 'training_phase', 'workout_steps', 'target_distance_m'
  ];
  exercise_keys constant text[] := array[
    'order_no', 'exercise_id', 'source_exercise_id', 'exercise_name_de', 'sets', 'reps_min', 'reps_max',
    'duration_s', 'rest_s', 'rpe_target', 'superset_group', 'notes_de', 'target_weight_kg'
  ];
  -- sync: COMPETITION_INTENSITY in packages/core/src/constants.ts (hardEffortCap, hardEffortMin, hardSessionsPerWeek)
  -- und AGE_PLAN_RULES (unter 18 / ab 65).
  hard_effort_cap_general constant integer := 8;
  hard_effort_cap_minor constant integer := 7;
  hard_effort_cap_senior constant integer := 6;
  hard_effort_min constant integer := 6;
  hard_sessions_per_week_strict constant integer := 1;
  hard_sessions_per_week_general constant integer := 2;
  minor_below_age constant integer := 18;
  senior_from_age constant integer := 65;
  hard_types constant public.workout_type[] := array['fartlek', 'tempo', 'intervals', 'race_pace']::public.workout_type[];
  s jsonb;
  e jsonb;
  scheduled date;
  new_session_id uuid;
  plan_row record;
  competition_row record;
  profile_level public.experience_level;
  age_years integer;
  latest_flags text[];
  effort_cap integer;
  hard_per_week integer;
begin
  if jsonb_typeof(p_sessions) is distinct from 'array'
     or jsonb_array_length(p_sessions) not between 1 and 49 then
    raise exception 'Ungültige Einheiten.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    for s in select value from jsonb_array_elements(p_sessions) loop
      perform private.assert_json_keys(s, session_keys, 'Einheit');
      if (s ->> 'block_no')::integer is distinct from p_block_no then
        raise exception 'Falsche Block-Nummer.' using errcode = 'invalid_parameter_value';
      end if;
      scheduled := (s ->> 'scheduled_on')::date;
      if scheduled is null or scheduled < p_earliest or scheduled > p_latest then
        raise exception 'Einheiten liegen außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
      end if;
      if p_block_no > 1
         and ((s ->> 'week_no')::integer < 1 or (s ->> 'is_intro_week')::boolean) is not false then
        raise exception 'Ein Folgeblock hat keine Woche 0 und keine Einstiegswoche.'
          using errcode = 'invalid_parameter_value';
      end if;
      -- Kraft: 1–8 Übungen; Ausdauer: keine Übungen (Dauer + Anstrengung, Erweiterungsplan 4.4 Punkt 3).
      if jsonb_typeof(s -> 'exercises') is distinct from 'array'
         or (s ->> 'kind') is null
         or (case when s ->> 'kind' = 'endurance'
               then jsonb_array_length(s -> 'exercises') <> 0
               else jsonb_array_length(s -> 'exercises') not between 1 and 8
             end) then
        raise exception 'Ungültige Übungen.' using errcode = 'invalid_parameter_value';
      end if;

      -- Schritte: nur eine Liste (JSON null oder fehlend = keine Schritte); Struktur prüft der CHECK.
      if jsonb_typeof(s -> 'workout_steps') not in ('array', 'null') then
        raise exception 'Ungültige Werte im Plan.' using errcode = 'check_violation';
      end if;
      insert into public.planned_sessions (
        plan_id, user_id, block_no, week_no, is_intro_week, is_deload, kind, template_day_index, scheduled_on,
        name_de, focus, endurance_modality, effort_target, estimated_minutes, warmup_de, cooldown_de,
        workout_type, training_phase, workout_steps, target_distance_m
      )
      values (
        p_plan_id, p_user_id, p_block_no, (s ->> 'week_no')::smallint, (s ->> 'is_intro_week')::boolean,
        (s ->> 'is_deload')::boolean, (s ->> 'kind')::public.planned_session_kind,
        (s ->> 'template_day_index')::smallint, scheduled,
        s ->> 'name_de', (s ->> 'focus')::public.session_focus,
        (s ->> 'endurance_modality')::public.endurance_modality, (s ->> 'effort_target')::smallint,
        (s ->> 'estimated_minutes')::smallint, s ->> 'warmup_de', s ->> 'cooldown_de',
        (s ->> 'workout_type')::public.workout_type, (s ->> 'training_phase')::public.training_phase,
        nullif(s -> 'workout_steps', 'null'::jsonb), (s ->> 'target_distance_m')::integer
      )
      returning id into new_session_id;

      for e in select value from jsonb_array_elements(s -> 'exercises') loop
        perform private.assert_json_keys(e, exercise_keys, 'Übung');
        if not exists (
          select 1 from public.exercises x where x.id = e ->> 'exercise_id' and x.status = 'published'
        ) or not exists (
          select 1 from public.exercises x where x.id = e ->> 'source_exercise_id' and x.status = 'published'
        ) then
          raise exception 'Übung nicht freigegeben.' using errcode = 'invalid_parameter_value';
        end if;
        -- RPE in 0,5er-Schritten und Zielgewicht mit höchstens 2 Nachkommastellen – VOR der Spaltenrundung.
        if (e ->> 'rpe_target')::numeric * 2 <> trunc((e ->> 'rpe_target')::numeric * 2)
           or (e ->> 'target_weight_kg')::numeric <> round((e ->> 'target_weight_kg')::numeric, 2) then
          raise exception 'Ungültige Werte im Plan.' using errcode = 'check_violation';
        end if;
        insert into public.planned_exercises (
          session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min,
          reps_max, duration_s, rest_s, rpe_target, superset_group, notes_de, target_weight_kg
        )
        values (
          new_session_id, p_user_id, (e ->> 'order_no')::smallint, e ->> 'exercise_id', e ->> 'source_exercise_id',
          e ->> 'exercise_name_de', (e ->> 'sets')::smallint, (e ->> 'reps_min')::smallint,
          (e ->> 'reps_max')::smallint, (e ->> 'duration_s')::smallint, (e ->> 'rest_s')::smallint,
          (e ->> 'rpe_target')::numeric, e ->> 'superset_group', e ->> 'notes_de', (e ->> 'target_weight_kg')::numeric
        );
      end loop;
    end loop;
  exception
    -- Ohne „Failing row contains (…)“/Schlüsselwerte nach außen (kein Gesundheitsbezug in Client und Log).
    when check_violation or unique_violation or not_null_violation or invalid_text_representation
      or numeric_value_out_of_range or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Werte im Plan.' using errcode = sqlstate;
  end;

  -- Wettkampfplan (Phase 10 WP3): Regeln je Person, die ein CHECK nicht sehen kann (Tabelle 3.3, Wächter N2 zu WP2).
  -- Nur wenn der neue Block Einheiten mit Art enthält – Pläne ohne Wettkampf sind davon nicht betroffen.
  if exists (
    select 1 from public.planned_sessions ps
    where ps.plan_id = p_plan_id and ps.block_no = p_block_no and ps.workout_type is not null
  ) then
    select p.uses_health_data, p.medical_notice, p.inputs ->> 'experienceLevel' as level,
           p.inputs ->> 'discipline' as discipline
      into plan_row
    from public.user_plans p
    where p.id = p_plan_id;
    -- Wettkampfplan nur nach dem Gesundheits-Check (Tabelle 3.3: „ohne Check erst nach dem Check“).
    if plan_row.uses_health_data is not true then
      raise exception 'Ein Wettkampfplan braucht den Gesundheits-Check.' using errcode = 'check_violation';
    end if;
    select h.flags into latest_flags
    from public.health_screening h
    where h.user_id = p_user_id
    order by h.created_at desc
    limit 1;
    if 'pregnancy' = any (coalesce(latest_flags, '{}')) then
      raise exception 'In der Schwangerschaft gibt es keinen Wettkampfplan.' using errcode = 'check_violation';
    end if;
    select extract(year from age(private.berlin_today(), pr.birth_date))::integer into age_years
    from public.profiles pr
    where pr.user_id = p_user_id;
    if age_years is null then
      raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
    end if;
    -- Wächter WP3 M2: nur mit eigenem GEPLANTEN Wettkampf samt Plan-Bezug (save_competition vor save_training_plan).
    -- Zeile FOR SHARE – nach der Einwilligung (save_training_plan über plan_health_basis, append_plan_block selbst),
    -- dieselbe Reihenfolge wie der Widerruf (Einwilligung → competitions). Disziplin aus dem Wettkampf, nicht aus den
    -- Angaben des Clients.
    select c.discipline, c.uses_health_data into competition_row
    from public.competitions c
    where c.user_id = p_user_id and c.status = 'planned'
    for share;
    if not found or competition_row.uses_health_data is not true then
      raise exception 'Für den Wettkampfplan fehlt der geplante Wettkampf.' using errcode = 'check_violation';
    end if;
    -- Unter 18 höchstens Halbmarathon (W-G4).
    if age_years < minor_below_age and competition_row.discipline = 'marathon' then
      raise exception 'Für diese Distanz gibt es noch keinen Wettkampfplan.' using errcode = 'check_violation';
    end if;
    -- Disziplin des Plans = Disziplin des Wettkampfs (wie generateCompetitionPlan).
    if plan_row.discipline is distinct from competition_row.discipline::text then
      raise exception 'Der Plan passt nicht zum geplanten Wettkampf.' using errcode = 'check_violation';
    end if;
    -- Keine Einheit über dem Distanz-Deckel des langen Laufs (COMPETITION_LONG_RUN.maxMinutes).
    if exists (
      select 1 from public.planned_sessions ps
      where ps.plan_id = p_plan_id and ps.block_no = p_block_no and ps.workout_type is not null
        and ps.estimated_minutes > case competition_row.discipline
          when '5k' then 75 when '10k' then 90 when 'half_marathon' then 120 when 'marathon' then 180 end
    ) then
      raise exception 'Die Einheit ist für diese Distanz zu lang.' using errcode = 'check_violation';
    end if;
    -- Höchste Anstrengung (Ziel und jeder Schritt): allgemein 8, unter 18 höchstens 7, ab 65 höchstens 6.
    effort_cap := case
      when age_years < minor_below_age then hard_effort_cap_minor
      when age_years >= senior_from_age then hard_effort_cap_senior
      else hard_effort_cap_general
    end;
    if exists (
      select 1 from public.planned_sessions ps
      where ps.plan_id = p_plan_id and ps.block_no = p_block_no and ps.workout_type is not null
        and (ps.effort_target > effort_cap
          or exists (
            select 1 from jsonb_array_elements(ps.workout_steps) st where (st ->> 'effort')::integer > effort_cap
          ))
    ) then
      raise exception 'Die geplante Anstrengung ist zu hoch.' using errcode = 'check_violation';
    end if;
    -- Gesundheits-Flag (Arzt-Hinweis): nur locker – keine harte Art, kein Abschnitt ab Anstrengung 6.
    if plan_row.medical_notice and exists (
      select 1 from public.planned_sessions ps
      where ps.plan_id = p_plan_id and ps.block_no = p_block_no and ps.workout_type is not null
        and (ps.workout_type = any (hard_types)
          or exists (
            select 1 from jsonb_array_elements(ps.workout_steps) st
            where (st ->> 'effort')::integer >= hard_effort_min
          ))
    ) then
      raise exception 'Mit dem Hinweis aus dem Gesundheits-Check sind keine harten Einheiten möglich.'
        using errcode = 'check_violation';
    end if;
    -- Harte Einheiten je Kalenderwoche (ganzer Plan, ohne gestrichene): Einsteiger und vorsichtige Startgruppe
    -- (Flag, unter 18, ab 65) höchstens 1, sonst 2. Level = das strengere aus Profil und Angaben des Plans (Wächter WP3
    -- M1); „hart“ = harte Art oder Abschnitt ab 6 länger als 20 s (private.workout_is_hard, Wächter H1).
    select pr.experience_level into profile_level from public.profiles pr where pr.user_id = p_user_id;
    hard_per_week := case
      when plan_row.level is distinct from 'advanced' and plan_row.level is distinct from 'competitive'
        then hard_sessions_per_week_strict
      when profile_level = 'beginner'
        then hard_sessions_per_week_strict
      when plan_row.medical_notice or age_years < minor_below_age or age_years >= senior_from_age
        then hard_sessions_per_week_strict
      else hard_sessions_per_week_general
    end;
    if exists (
      select 1 from public.planned_sessions ps
      where ps.plan_id = p_plan_id and ps.status <> 'skipped' and ps.workout_type is not null
        and private.workout_is_hard(ps.workout_type, ps.workout_steps)
      group by date_trunc('week', ps.scheduled_on)
      having count(*) > hard_per_week
    ) then
      raise exception 'Zu viele harte Einheiten in einer Woche.' using errcode = 'check_violation';
    end if;
  end if;
end;
$$;

revoke all on function private.insert_plan_sessions(uuid, uuid, jsonb, integer, date, date) from public;


-- ---------------------------------------------------------------------------------------------------------
-- 2. Wettkampf speichern, absagen, abschließen, löschen
-- ---------------------------------------------------------------------------------------------------------

-- save_competition(p_competition): legt den (einen) geplanten Wettkampf an (id = null) oder ändert den eigenen
-- GEPLANTEN Wettkampf (id gesetzt) – immer als ganzer Datensatz (fehlender Plan-Bezug = keiner). Eingabe =
-- saveCompetitionPayloadSchema (packages/core/src/plan/competition-record.ts): alle Felder Pflicht, unbekannte
-- abgelehnt. Datumsregeln gegen „heute“ (Europe/Berlin) nur beim Anlegen bzw. wenn sich Renntag, Disziplin oder
-- Referenz ändern (ein gespeicherter Wettkampf darf älter werden):
-- - Renntag nach heute, höchstens heute + 52 Wochen, frühestens heute + Mindestvorlauf der LOCKERSTEN Spalte
--   (Leistungssport, COMPETITION_RECORD_LIMITS.leadWeeksServerColumn) – die genaue Spalte prüft Core,
-- - Referenzzeit nicht in der Zukunft und höchstens 183 Tage alt.
-- Plan-Bezug (effective_goal gesetzt): nur mit gültiger Einwilligung health_data und vorhandenem Gesundheits-Check
-- (private.plan_health_basis, Einwilligung FOR SHARE), nicht in der Schwangerschaft, unter 18 kein Marathon,
-- wirksame Zielzeit nicht mit Arzt-Hinweis, unter 18 oder ab 65 (Tabelle 3.3). uses_health_data setzt die Funktion.
-- goals.target_date wird beim Ziel Ausdauer mitgeführt (Abwärtskompatibilität, Plan Abschnitt 7).
create or replace function public.save_competition(p_competition jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  competition_keys constant text[] := array[
    'id', 'name', 'discipline', 'race_date', 'goal_kind', 'target_time_s', 'reference_discipline',
    'reference_time_s', 'reference_date', 'long_run_weekday', 'own_start_weekly_minutes', 'start_reference_volume',
    'start_reference_session_cap', 'start_reference_start_group', 'effective_goal'
  ];
  -- sync: COMPETITION_LEAD_WEEKS (maxLeadWeeks × 7) und COMPETITION_INPUT_LIMITS.referenceMaxAgeDays
  max_lead_days constant integer := 364;
  reference_max_age_days constant integer := 183;
  -- sync: AGE_PLAN_RULES (unter 18 / ab 65)
  minor_below_age constant integer := 18;
  senior_from_age constant integer := 65;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  c jsonb := p_competition;
  existing public.competitions%rowtype;
  v_id uuid;
  v_discipline public.competition_discipline;
  v_race_date date;
  v_reference_discipline public.competition_discipline;
  v_reference_time_s integer;
  v_reference_date date;
  v_effective_goal public.competition_goal;
  min_lead_weeks integer;
  basis record;
  latest_flags text[];
  age_years integer;
  dates_changed boolean;
  reference_changed boolean;
  saved_id uuid;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select extract(year from age(today, pr.birth_date))::integer into age_years
  from public.profiles pr
  where pr.user_id = current_user_id;
  if age_years is null then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  perform private.assert_json_keys(c, competition_keys, 'Wettkampf');
  -- Alle Felder vorhanden und vom richtigen JSON-Typ (Werte prüfen danach die CHECKs der Tabelle).
  if not (c ?& competition_keys)
     or jsonb_typeof(c -> 'id') not in ('string', 'null')
     or jsonb_typeof(c -> 'name') <> 'string'
     or jsonb_typeof(c -> 'discipline') <> 'string'
     or jsonb_typeof(c -> 'race_date') <> 'string'
     or jsonb_typeof(c -> 'goal_kind') <> 'string'
     or not (jsonb_typeof(c -> 'target_time_s') = 'null'
       or private.jsonb_number_between(c -> 'target_time_s', 1, 2147483647, 0))
     or jsonb_typeof(c -> 'reference_discipline') not in ('string', 'null')
     or not (jsonb_typeof(c -> 'reference_time_s') = 'null'
       or private.jsonb_number_between(c -> 'reference_time_s', 1, 2147483647, 0))
     or jsonb_typeof(c -> 'reference_date') not in ('string', 'null')
     or not (jsonb_typeof(c -> 'long_run_weekday') = 'null'
       or private.jsonb_number_between(c -> 'long_run_weekday', 1, 7, 0))
     or not (jsonb_typeof(c -> 'own_start_weekly_minutes') = 'null'
       or private.jsonb_number_between(c -> 'own_start_weekly_minutes', 0, 32767, 0))
     or not (jsonb_typeof(c -> 'start_reference_volume') = 'null'
       or private.jsonb_number_between(c -> 'start_reference_volume', 0, 32767, 0))
     or not (jsonb_typeof(c -> 'start_reference_session_cap') = 'null'
       or private.jsonb_number_between(c -> 'start_reference_session_cap', 0, 32767, 0))
     or jsonb_typeof(c -> 'start_reference_start_group') not in ('string', 'null')
     or jsonb_typeof(c -> 'effective_goal') not in ('string', 'null') then
    raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    v_id := (c ->> 'id')::uuid;
    v_discipline := (c ->> 'discipline')::public.competition_discipline;
    v_race_date := (c ->> 'race_date')::date;
    v_reference_discipline := (c ->> 'reference_discipline')::public.competition_discipline;
    v_reference_time_s := (c ->> 'reference_time_s')::integer;
    v_reference_date := (c ->> 'reference_date')::date;
    v_effective_goal := (c ->> 'effective_goal')::public.competition_goal;
    perform (c ->> 'goal_kind')::public.competition_goal, (c ->> 'start_reference_start_group')::public.endurance_start_group;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end;
  -- Datum als Text genau JJJJ-MM-TT (wie isoDateSchema), nicht „2026-1-5“ oder mit Uhrzeit.
  if (c ->> 'race_date') !~ '^\d{4}-\d{2}-\d{2}$'
     or (v_reference_date is not null and (c ->> 'reference_date') !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end if;

  -- Plan-Bezug: zuerst die Einwilligung (FOR SHARE, gleiche Reihenfolge wie revoke_health_data), dann die Zeile.
  if v_effective_goal is not null then
    select * into basis from private.plan_health_basis();
    if not basis.uses_health_data then
      raise exception 'Ein Wettkampfplan braucht den Gesundheits-Check.' using errcode = 'insufficient_privilege';
    end if;
    select h.flags into latest_flags
    from public.health_screening h
    where h.user_id = current_user_id
    order by h.created_at desc
    limit 1;
    if 'pregnancy' = any (coalesce(latest_flags, '{}')) then
      raise exception 'In der Schwangerschaft gibt es keinen Wettkampfplan.' using errcode = 'invalid_parameter_value';
    end if;
    if age_years < minor_below_age and v_discipline = 'marathon' then
      raise exception 'Für diese Distanz gibt es noch keinen Wettkampfplan.' using errcode = 'invalid_parameter_value';
    end if;
    if v_effective_goal = 'time'
       and (basis.medical_notice or age_years < minor_below_age or age_years >= senior_from_age) then
      raise exception 'Eine Zielzeit ist hier nicht möglich.' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  if v_id is not null then
    select * into existing
    from public.competitions t
    where t.id = v_id and t.user_id = current_user_id
    for update;
    if not found then
      raise exception 'Wettkampf nicht gefunden.' using errcode = 'insufficient_privilege';
    end if;
    if existing.status <> 'planned' then
      raise exception 'Nur geplante Wettkämpfe lassen sich ändern.' using errcode = 'invalid_parameter_value';
    end if;
    dates_changed := existing.race_date is distinct from v_race_date or existing.discipline is distinct from v_discipline;
    reference_changed := (existing.reference_discipline, existing.reference_time_s, existing.reference_date)
      is distinct from (v_reference_discipline, v_reference_time_s, v_reference_date);
  else
    dates_changed := true;
    reference_changed := true;
  end if;

  if dates_changed then
    -- sync: COMPETITION_LEAD_WEEKS.minimum[*].competitive (lockerste Spalte)
    min_lead_weeks := case v_discipline when '5k' then 4 when '10k' then 6 when 'half_marathon' then 10 when 'marathon' then 14 end;
    if v_race_date <= today or v_race_date > today + max_lead_days then
      raise exception 'Der Renntag liegt außerhalb des erlaubten Zeitraums.' using errcode = 'invalid_parameter_value';
    end if;
    if v_race_date < today + min_lead_weeks * 7 then
      raise exception 'Bis zum Renntag ist zu wenig Zeit.' using errcode = 'invalid_parameter_value';
    end if;
  end if;
  if reference_changed and v_reference_date is not null
     and (v_reference_date > today or v_reference_date < today - reference_max_age_days) then
    raise exception 'Die Referenzzeit ist zu alt oder liegt in der Zukunft.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    if v_id is null then
      insert into public.competitions (
        user_id, name, discipline, distance_m, race_date, goal_kind, target_time_s, reference_discipline,
        reference_time_s, reference_date, long_run_weekday, own_start_weekly_minutes, start_reference_volume,
        start_reference_session_cap, start_reference_start_group, effective_goal, uses_health_data
      )
      values (
        current_user_id, c ->> 'name', v_discipline, private.competition_distance_m(v_discipline), v_race_date,
        (c ->> 'goal_kind')::public.competition_goal, (c ->> 'target_time_s')::integer, v_reference_discipline,
        v_reference_time_s, v_reference_date, (c ->> 'long_run_weekday')::smallint,
        (c ->> 'own_start_weekly_minutes')::smallint, (c ->> 'start_reference_volume')::smallint,
        (c ->> 'start_reference_session_cap')::smallint,
        (c ->> 'start_reference_start_group')::public.endurance_start_group, v_effective_goal,
        v_effective_goal is not null
      )
      returning id into saved_id;
    else
      update public.competitions t
      set name = c ->> 'name',
          discipline = v_discipline,
          distance_m = private.competition_distance_m(v_discipline),
          race_date = v_race_date,
          goal_kind = (c ->> 'goal_kind')::public.competition_goal,
          target_time_s = (c ->> 'target_time_s')::integer,
          reference_discipline = v_reference_discipline,
          reference_time_s = v_reference_time_s,
          reference_date = v_reference_date,
          long_run_weekday = (c ->> 'long_run_weekday')::smallint,
          own_start_weekly_minutes = (c ->> 'own_start_weekly_minutes')::smallint,
          start_reference_volume = (c ->> 'start_reference_volume')::smallint,
          start_reference_session_cap = (c ->> 'start_reference_session_cap')::smallint,
          start_reference_start_group = (c ->> 'start_reference_start_group')::public.endurance_start_group,
          effective_goal = v_effective_goal,
          uses_health_data = v_effective_goal is not null
      where t.id = v_id
      returning t.id into saved_id;
    end if;
  exception
    when unique_violation then
      raise exception 'Es gibt schon einen geplanten Wettkampf.' using errcode = 'unique_violation';
    -- Ohne „Failing row contains (…)“ nach außen.
    when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = sqlstate;
  end;

  -- Abwärtskompatibilität: Zieldatum des Ausdauer-Ziels = Renntag.
  update public.goals g
  set target_date = v_race_date
  where g.user_id = current_user_id and g.goal_type = 'endurance'
    and g.target_date is distinct from v_race_date;
  return saved_id;
end;
$$;

revoke all on function public.save_competition(jsonb) from public, anon;
grant execute on function public.save_competition(jsonb) to authenticated;

-- cancel_competition(p_id): eigenen GEPLANTEN Wettkampf absagen (Stand cancelled, bleibt im Verlauf/Export).
-- Das Zieldatum des Ausdauer-Ziels wird geleert, wenn es der Renntag war. Der Trainingsplan bleibt (WP4: „Plan neu
-- erstellen“ mit Bestätigung).
create or replace function public.cancel_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing public.competitions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select * into existing
  from public.competitions t
  where t.id = p_id and t.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Wettkampf nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
  if existing.status <> 'planned' then
    raise exception 'Nur geplante Wettkämpfe lassen sich absagen.' using errcode = 'invalid_parameter_value';
  end if;
  update public.competitions t set status = 'cancelled' where t.id = existing.id;
  update public.goals g
  set target_date = null
  where g.user_id = current_user_id and g.goal_type = 'endurance' and g.target_date = existing.race_date;
end;
$$;

revoke all on function public.cancel_competition(uuid) from public, anon;
grant execute on function public.cancel_competition(uuid) to authenticated;

-- complete_competition(p_id, p_session_log_id): Wettkampf erledigt (ab dem Renntag), optional mit dem Ergebnis als
-- eigenem Ausdauer-Eintrag VOM RENNTAG (freie Einheit, A1b). Erneut aufrufbar, um den Eintrag zu setzen/ändern;
-- abgesagte Wettkämpfe nicht.
create or replace function public.complete_competition(p_id uuid, p_session_log_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  existing public.competitions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  select * into existing
  from public.competitions t
  where t.id = p_id and t.user_id = current_user_id
  for update;
  if not found then
    raise exception 'Wettkampf nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
  if existing.status = 'cancelled' then
    raise exception 'Ein abgesagter Wettkampf lässt sich nicht abschließen.' using errcode = 'invalid_parameter_value';
  end if;
  if existing.race_date > today then
    raise exception 'Der Wettkampf liegt noch in der Zukunft.' using errcode = 'invalid_parameter_value';
  end if;
  if p_session_log_id is not null and not exists (
    select 1 from public.session_logs sl
    where sl.id = p_session_log_id and sl.user_id = current_user_id
      and sl.kind = 'endurance' and sl.performed_on = existing.race_date
  ) then
    raise exception 'Dieser Eintrag passt nicht zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end if;
  update public.competitions t
  set status = 'done', result_session_log_id = p_session_log_id
  where t.id = existing.id;
end;
$$;

revoke all on function public.complete_competition(uuid, uuid) from public, anon;
grant execute on function public.complete_competition(uuid, uuid) to authenticated;

-- delete_competition(p_id): eigenen Wettkampf endgültig löschen (Recht auf Löschung, jeder Stand). Der
-- Ergebnis-Eintrag im Tagebuch bleibt (eigene Löschung über delete_session_log).
create or replace function public.delete_competition(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  removed public.competitions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  delete from public.competitions t
  where t.id = p_id and t.user_id = current_user_id
  returning * into removed;
  if not found then
    raise exception 'Wettkampf nicht gefunden.' using errcode = 'insufficient_privilege';
  end if;
  if removed.status = 'planned' then
    update public.goals g
    set target_date = null
    where g.user_id = current_user_id and g.goal_type = 'endurance' and g.target_date = removed.race_date;
  end if;
end;
$$;

revoke all on function public.delete_competition(uuid) from public, anon;
grant execute on function public.delete_competition(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. Widerruf health_data – neueste Fassung (20261015160100_custom_meal_rpcs.sql) unverändert übernommen und nur
-- erweitert: Plan-Bezug der Wettkämpfe leeren (Wettkampf selbst bleibt – kein Gesundheitsdatum, wie Strecken
-- W-G15), am Anfang und in der Wiederholung am Ende.
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
    -- Wettkämpfe (Phase 10 WP3): nur den aus dem Gesundheits-Check abgeleiteten Plan-Bezug leeren.
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    -- Ernährungstagebuch (E1, A-G12): alle Einträge. Favoriten: Schnell-Favoriten enthalten Bezeichnung + kcal
    -- („Süßes 250 kcal“) und gehen mit (Wächter E1 G1, sichere Voreinstellung); Katalog-/Rezept-Favoriten speichern
    -- keine Werte (S1) und bleiben (A-G14).
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.food_log_favorites where user_id = new.user_id and source = 'quick';
    -- Eigene Gerichte (E2): Name ist Freitext, Werte selbst eingegeben – sichere Voreinstellung wie die
    -- Schnell-Favoriten (Wächter E1 G1): gelöscht, Zutaten per Kaskade (Gründer-Frage E2-G1 im Plan).
    delete from public.custom_meals where user_id = new.user_id;
    -- Noch einmal NACH dem Löschen (Wächter Etappe B, B2): Ein Eintrag, den ein gleichzeitiges save_session_log
    -- gespeichert hat, während das Löschen auf dessen Sperre wartete, ist erst jetzt sichtbar.
    perform private.neutralize_health_plan_logs(new.user_id);
    -- Ebenso Pläne, Listen und Tagebuch (Wächter N7 S2): Die speichernden Funktionen sperren die Einwilligung FOR
    -- SHARE, der Widerruf wartet also auf sie; jede Anweisung sieht danach den neuesten Stand. Die Wiederholung fängt
    -- zusätzlich ab, was während der Lösch-Anweisungen oben fertig geworden ist.
    delete from public.user_plans where user_id = new.user_id and uses_health_data;
    delete from public.meal_plans where user_id = new.user_id and uses_health_data;
    delete from public.shopping_lists where user_id = new.user_id and uses_health_data;
    delete from public.food_log_entries where user_id = new.user_id;
    delete from public.custom_meals where user_id = new.user_id;
    update public.competitions
    set own_start_weekly_minutes = null, start_reference_volume = null, start_reference_session_cap = null,
        start_reference_start_group = null, effective_goal = null, uses_health_data = false
    where user_id = new.user_id and uses_health_data;
  end if;
  -- cycle_data: Zyklusdaten gibt es erst ab Phase 9; die Löschung wird dann hier ergänzt.
  return null;
end;
$$;

revoke all on function private.consents_after_revoke() from public;


-- ---------------------------------------------------------------------------------------------------------
-- 4. export_my_data() – neueste Fassung (20261015160100_custom_meal_rpcs.sql) unverändert übernommen und nur erweitert:
-- competitions (inkl. Plan-Bezug). Schlüssel von „data“ = DATA_EXPORT_TABLES (db-sync.test.ts); pgTAP prüft, dass jede
-- public-Tabelle mit user_id enthalten ist. Die neuen planned_sessions-Spalten kommen über to_jsonb automatisch mit.
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
      'competitions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.race_date, t.created_at), '[]'::jsonb) from public.competitions t where t.user_id = current_user_id)
    )
  );
end;
$$;

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
