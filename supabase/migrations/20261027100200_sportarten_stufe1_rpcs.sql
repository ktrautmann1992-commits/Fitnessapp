-- Sportarten Stufe 1 (Gründer-Freigabe 27.10.2026, docs/PLAN-SPORTARTEN-STUFE-1.md Abschnitt 3) · Etappe S – neue
-- Fassungen der Schreib-Funktionen. Jede Funktion ist die NEUESTE Fassung, Zeile für Zeile übernommen und nur um die
-- unten genannten, OPTIONALEN Felder erweitert (gleiche Signatur, gleiche Rechte; fehlende Felder = Verhalten wie
-- bisher, ältere App-Fassungen und wartende Einträge bleiben gültig). Grenzen prüft der Server selbst (CHECKs aus
-- 20261027100100_sportarten_stufe1.sql und Prüfungen hier), abgeglichen mit packages/core in db-sync.test.ts.
-- 1. private.insert_plan_sessions (aus 20261018120100_wp5_rad_triathlon.sql): harte Art hyrox_combo; Distanz-Deckel
--    Hyrox 90 min (COMPETITION_LONG_RUN.maxMinutes.hyrox).
-- 2. public.save_competition (aus 20261018120100_wp5_rad_triathlon.sql): optionales Feld hyrox_division (Pflicht genau
--    bei Disziplin hyrox); unter 18 nur Division Open (HYROX_SAFETY).
-- 3. public.save_session_log (aus 20261025160100_sportarten.sql): Hyrox-Rennen (Feld hyrox_splits, Name
--    „Hyrox-Rennen“, freie Lauf-Einheit, Summe der Teilzeiten ≤ Gesamtzeit), Rudern (avg_power_w, stroke_rate,
--    intervals; freier Name „Rudern“), Wandern (walk_kind; freier Name je Art, die verknüpfte eigene Geh-Strecke folgt
--    dem Eintrag), Sportarten yoga/pilates.
-- 4. public.save_tracked_route und public.update_tracked_route (aus 20261023140000_e_bike.sql): walk_kind,
--    elevation_loss_m, max_altitude_m, sac_grade (Ändern: walk_kind, sac_grade); der verknüpfte Geh-Eintrag folgt der
--    Strecke (wie e_bike).
-- 5. public.save_wearable_route (aus 20261023120100_wearable_routes.sql): Art der Geh-Einheit aus dem Eintrag, Name
--    je Art; optional elevation_loss_m, max_altitude_m.
-- 6. public.import_wearable_batch (aus 20261025120000_recovery_hrv.sql): Gruppe row (Rudergerät, Health Connect 54),
--    optionale Felder walk_kind (nur walk; Name je Art), avg_power_w und stroke_rate (nur row).
-- 7. public.save_app_layout (aus 20261026150000_app_layout_version.sql): optionales Feld recovery_routine (Einstellung
--    „Erholungs-Routine vorschlagen“; fehlt = unverändert).
-- Fehlermeldungen: feste deutsche Texte ohne Werte (keine Koordinaten, Höhen oder Teilzeiten in Logs).

-- ---------------------------------------------------------------------------------------------------------
-- 1. private.insert_plan_sessions
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
  -- Sportarten Stufe 1: hyrox_combo ist eine harte Art (HARD_WORKOUT_TYPES).
  hard_types constant public.workout_type[] :=
    array['fartlek', 'tempo', 'intervals', 'race_pace', 'hyrox_combo']::public.workout_type[];
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
    select c.discipline, c.distance_m, c.uses_health_data into competition_row
    from public.competitions c
    where c.user_id = p_user_id and c.status = 'planned'
    for share;
    if not found or competition_row.uses_health_data is not true then
      raise exception 'Für den Wettkampfplan fehlt der geplante Wettkampf.' using errcode = 'check_violation';
    end if;
    -- Unter 18 höchstens Halbmarathon (W-G4); WP5: Triathlon nur Sprint, Rad höchstens 100 km.
    if age_years < minor_below_age
       and not private.competition_minor_allowed(competition_row.discipline, competition_row.distance_m) then
      raise exception 'Für diese Distanz gibt es noch keinen Wettkampfplan.' using errcode = 'check_violation';
    end if;
    -- Disziplin des Plans = Disziplin des Wettkampfs (wie generateCompetitionPlan).
    if plan_row.discipline is distinct from competition_row.discipline::text then
      raise exception 'Der Plan passt nicht zum geplanten Wettkampf.' using errcode = 'check_violation';
    end if;
    -- Keine Einheit über dem Distanz-Deckel des langen Laufs bzw. der langen Ausfahrt (COMPETITION_LONG_RUN.maxMinutes).
    if exists (
      select 1 from public.planned_sessions ps
      where ps.plan_id = p_plan_id and ps.block_no = p_block_no and ps.workout_type is not null
        and ps.estimated_minutes > case competition_row.discipline
          when '5k' then 75 when '10k' then 90 when 'half_marathon' then 120 when 'marathon' then 180 when 'cycling' then 300 when 'triathlon_sprint' then 120 when 'triathlon_olympic' then 180 when 'hyrox' then 90 end
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
-- 2. public.save_competition
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_competition(p_competition jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- WP5: `distance_km` (Rad, 20–300 km) ist erlaubt, aber nicht Pflicht – ältere App-Stände senden sie nicht (fehlt =
  -- null). Alle übrigen Felder bleiben Pflicht (required_keys).
  -- Sportarten Stufe 1: `hyrox_division` ebenso optional (fehlt = null); Pflicht genau bei Disziplin hyrox.
  competition_keys constant text[] := array[
    'id', 'name', 'discipline', 'distance_km', 'race_date', 'goal_kind', 'target_time_s', 'reference_discipline',
    'reference_time_s', 'reference_date', 'long_run_weekday', 'own_start_weekly_minutes', 'start_reference_volume',
    'start_reference_session_cap', 'start_reference_start_group', 'effective_goal', 'hyrox_division'
  ];
  required_keys constant text[] := array[
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
  v_distance_m numeric;
  v_race_date date;
  v_reference_discipline public.competition_discipline;
  v_reference_time_s integer;
  v_reference_date date;
  v_effective_goal public.competition_goal;
  v_hyrox_division public.hyrox_division;
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
  if not (c ?& required_keys)
     or jsonb_typeof(c -> 'id') not in ('string', 'null')
     or not (coalesce(jsonb_typeof(c -> 'distance_km'), 'null') = 'null'
       or private.jsonb_number_between(c -> 'distance_km', 20, 300, 0))
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
     or jsonb_typeof(c -> 'effective_goal') not in ('string', 'null')
     or coalesce(jsonb_typeof(c -> 'hyrox_division'), 'null') not in ('string', 'null') then
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
    v_hyrox_division := (c ->> 'hyrox_division')::public.hyrox_division;
    perform (c ->> 'goal_kind')::public.competition_goal, (c ->> 'start_reference_start_group')::public.endurance_start_group;
  exception
    when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
      raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end;
  -- Distanz: Rad = eingegebene km × 1000 (Pflicht), sonst aus der Disziplin (dann keine km). CHECK competitions_distance.
  if (v_discipline = 'cycling') <> (coalesce(jsonb_typeof(c -> 'distance_km'), 'null') <> 'null') then
    raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end if;
  -- Hyrox (Sportarten Stufe 1): Division genau bei Disziplin hyrox (CHECK competitions_hyrox_division); unter 18 nur
  -- Division Open (HYROX_SAFETY) – auch ohne Plan-Bezug.
  if (v_discipline = 'hyrox') <> (v_hyrox_division is not null) then
    raise exception 'Ungültige Angaben zum Wettkampf.' using errcode = 'invalid_parameter_value';
  end if;
  if v_discipline = 'hyrox' and age_years < minor_below_age and v_hyrox_division <> 'open' then
    raise exception 'Unter 18 ist nur die Division Open möglich.' using errcode = 'invalid_parameter_value';
  end if;
  v_distance_m := case when v_discipline = 'cycling'
    then (c ->> 'distance_km')::numeric * 1000
    else private.competition_distance_m(v_discipline) end;
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
    -- Unter 18 höchstens Halbmarathon (W-G4); WP5: Triathlon nur Sprint, Rad höchstens 100 km.
    if age_years < minor_below_age and not private.competition_minor_allowed(v_discipline, v_distance_m) then
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
    dates_changed := existing.race_date is distinct from v_race_date or existing.discipline is distinct from v_discipline
      or existing.distance_m is distinct from v_distance_m;
    reference_changed := (existing.reference_discipline, existing.reference_time_s, existing.reference_date)
      is distinct from (v_reference_discipline, v_reference_time_s, v_reference_date);
  else
    dates_changed := true;
    reference_changed := true;
  end if;

  if dates_changed then
    -- sync: COMPETITION_LEAD_WEEKS.minimum[*].competitive bzw. COMPETITION_CYCLING.classes[*].lead.competitive
    -- (lockerste Spalte)
    min_lead_weeks := private.competition_server_lead_weeks(v_discipline, v_distance_m);
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
        start_reference_session_cap, start_reference_start_group, effective_goal, uses_health_data, hyrox_division
      )
      values (
        current_user_id, c ->> 'name', v_discipline, v_distance_m, v_race_date,
        (c ->> 'goal_kind')::public.competition_goal, (c ->> 'target_time_s')::integer, v_reference_discipline,
        v_reference_time_s, v_reference_date, (c ->> 'long_run_weekday')::smallint,
        (c ->> 'own_start_weekly_minutes')::smallint, (c ->> 'start_reference_volume')::smallint,
        (c ->> 'start_reference_session_cap')::smallint,
        (c ->> 'start_reference_start_group')::public.endurance_start_group, v_effective_goal,
        v_effective_goal is not null, v_hyrox_division
      )
      returning id into saved_id;
    else
      update public.competitions t
      set name = c ->> 'name',
          discipline = v_discipline,
          distance_m = v_distance_m,
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
          uses_health_data = v_effective_goal is not null,
          hyrox_division = v_hyrox_division
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

-- ---------------------------------------------------------------------------------------------------------
-- 3. public.save_session_log
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
    "client_updated_at": "string", "exercises": "array", "cardio": "object|null", "is_free": "boolean|missing",
    "sport": "object|null|missing", "hyrox_splits": "array|null|missing"
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
  -- Sportarten Stufe 1 (20261027100200): Rudern (avg_power_w, stroke_rate, intervals) und Wandern (walk_kind) dürfen
  -- fehlen (= null); die CHECKs der Spalten erlauben sie nur bei row bzw. walk.
  cardio_fields constant jsonb := '{
    "modality": "string", "duration_s": "number", "distance_m": "number|null", "elevation_m": "number|null",
    "e_bike": "boolean|missing", "avg_power_w": "number|null|missing", "stroke_rate": "number|null|missing",
    "intervals": "array|null|missing", "walk_kind": "string|null|missing"
  }';
  -- Freie Einheit (A1b): Name aus fester Liste je Art. sync: FREE_SESSION.names in packages/core/src/constants.ts
  free_names constant jsonb := '{
    "strength": "Freie Kraft-Einheit", "run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt", "swim": "Schwimmen",
    "row": "Rudern"
  }';
  -- Sportarten Stufe 1: Name einer freien Geh-Einheit je Art (FREE_SESSION.names.walkKinds; null = walk) und des
  -- Hyrox-Ergebnisses (FREE_SESSION.names.hyroxRace).
  walk_kind_names constant jsonb := '{"walk": "Spaziergang", "hike": "Wanderung", "mountain_hike": "Bergwanderung"}';
  hyrox_race_name constant text := 'Hyrox-Rennen';
  -- Sportarten Stufe 2 (20261025130100): Sportart-Eintrag = freie Einheit „strength“ ohne Übungen und ohne Ausdauer.
  -- sync: sportLogSchema und SPORT_CATALOGUE (Namen, gps) in packages/core (db-sync.test.ts).
  sport_fields constant jsonb := '{
    "sport": "string", "duration_s": "number", "distance_m": "number|null"
  }';
  sport_names constant jsonb := '{
    "bouldering": "Bouldern", "climbing": "Klettern", "football": "Fußball", "padel": "Padel", "tennis": "Tennis",
    "badminton": "Badminton", "table_tennis": "Tischtennis", "basketball": "Basketball",
    "volleyball": "Volleyball", "handball": "Handball", "cross_trainer": "Crosstrainer",
    "indoor_cycling": "Spinning", "hiit": "HIIT/Zirkel", "boxing": "Boxen", "kickboxing": "Kickboxen",
    "judo_bjj": "Judo/BJJ", "karate": "Karate", "martial_arts": "Kampfsport",
    "cross_country_skiing": "Skilanglauf", "ski_touring": "Skitour", "alpine_skiing": "Ski alpin",
    "snowboarding": "Snowboard", "inline_skating": "Inline-Skaten", "sup": "SUP", "kayaking": "Kajak/Kanu",
    "dancing": "Tanzen", "other": "Sonstige Sportart", "yoga": "Yoga", "pilates": "Pilates"
  }';
  gps_sports constant text[] :=
    array['cross_country_skiing', 'ski_touring', 'inline_skating', 'sup', 'kayaking'];
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
  -- Sportart (Stufe 2): Feld `sport` als Objekt; fehlt/null = keine Sportart.
  v_has_sport boolean;
  -- Hyrox-Rennen (Stufe 1): Feld `hyrox_splits` als Liste (auch leer); fehlt/null = kein Hyrox-Rennen.
  v_has_hyrox boolean;
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
    v_has_sport := coalesce(jsonb_typeof(p_log -> 'sport') = 'object', false);
    v_has_hyrox := coalesce(jsonb_typeof(p_log -> 'hyrox_splits') = 'array', false);
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
      -- Sportart bleibt Sportart, Kraft/Ausdauer bleibt Kraft/Ausdauer (Stufe 2).
      if (existing.sport is not null) <> v_has_sport then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      -- Hyrox-Rennen bleibt Hyrox-Rennen (Stufe 1).
      if (existing.hyrox_splits is not null) <> v_has_hyrox then
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
           case when v_has_sport then sport_names ->> coalesce(p_log -> 'sport' ->> 'sport', '')
           when v_has_hyrox then hyrox_race_name
           when log_kind = 'endurance' and (p_log -> 'cardio' ->> 'modality') = 'walk'
             then walk_kind_names ->> coalesce(p_log -> 'cardio' ->> 'walk_kind', 'walk')
           else
           free_names ->> case when log_kind = 'strength' then 'strength'
                               else coalesce(p_log -> 'cardio' ->> 'modality', '') end
           end
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

    -- Sportart (Stufe 2): nur als freie, erledigte Einheit „strength“ von Hand, ohne Übungen und ohne Ausdauer;
    -- Distanz nur bei GPS-Sportarten. Die Grenzen prüfen die CHECKs der Spalten (→ „Ungültige Werte im Tagebuch.“).
    if v_has_sport then
      perform private.assert_log_fields(p_log -> 'sport', sport_fields);
      if not v_is_free
         or log_kind <> 'strength'
         or v_source <> 'manual'
         or (p_log ->> 'status') is distinct from 'completed'
         or jsonb_array_length(p_log -> 'exercises') <> 0
         or jsonb_typeof(p_log -> 'cardio') <> 'null'
         or not (sport_names ? (p_log -> 'sport' ->> 'sport'))
         or (jsonb_typeof(p_log -> 'sport' -> 'distance_m') = 'number'
             and not ((p_log -> 'sport' ->> 'sport') = any (gps_sports))) then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;

    -- Hyrox-Rennen (Stufe 1): nur als freie Lauf-Einheit (Ausdauer „run“, Gesamtzeit = Dauer) ohne Sportart; Teilzeiten
    -- gültig (private.hyrox_splits_valid, HYROX_RESULT_LIMITS) und zusammen höchstens die Gesamtzeit.
    if v_has_hyrox then
      if not v_is_free
         or v_has_sport
         or log_kind <> 'endurance'
         or jsonb_typeof(p_log -> 'cardio') is distinct from 'object'
         or (p_log -> 'cardio' ->> 'modality') is distinct from 'run'
         or not private.hyrox_splits_valid(p_log -> 'hyrox_splits') then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
      if jsonb_typeof(p_log -> 'cardio' -> 'duration_s') is distinct from 'number'
         or (select coalesce(sum((x ->> 'duration_s')::numeric), 0) from jsonb_array_elements(p_log -> 'hyrox_splits') x)
           > (p_log -> 'cardio' ->> 'duration_s')::numeric then
        raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
      end if;
    end if;

    -- Art passt (ohne Sportart): Kraft ⇒ 1–12 Übungen ohne Ausdauer; Ausdauer ⇒ Ausdauer ohne Übungen.
    if not v_has_sport then
    -- Art passt: Kraft ⇒ 1–12 Übungen ohne Ausdauer; Ausdauer ⇒ Ausdauer ohne Übungen.
    if (log_kind = 'strength' and (jsonb_array_length(p_log -> 'exercises') not between 1 and exercises_per_session_max
                                   or jsonb_typeof(p_log -> 'cardio') <> 'null'))
       or (log_kind = 'endurance' and (jsonb_array_length(p_log -> 'exercises') <> 0
                                       or jsonb_typeof(p_log -> 'cardio') <> 'object')) then
      raise exception 'Ungültige Werte im Tagebuch.' using errcode = 'invalid_parameter_value';
    end if;
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
          client_updated_at = least((p_log ->> 'client_updated_at')::timestamptz, now()),
          sport = case when v_has_sport then (p_log -> 'sport' ->> 'sport')::public.sport_type end,
          sport_duration_s = case when v_has_sport then (p_log -> 'sport' ->> 'duration_s')::integer end,
          sport_distance_m = case when v_has_sport then (p_log -> 'sport' ->> 'distance_m')::integer end,
          hyrox_splits = case when v_has_hyrox then p_log -> 'hyrox_splits' end
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
        client_updated_at,
        sport, sport_duration_s, sport_distance_m,
        hyrox_splits
      )
      values (
        log_id, current_user_id, case when linked then planned_id end, log_kind, v_performed_on,
        (p_log ->> 'started_at')::timestamptz, (p_log ->> 'finished_at')::timestamptz,
        (p_log ->> 'status')::public.session_log_status, (p_log ->> 'session_rpe')::smallint, p_log ->> 'notes',
        case when keep_targets or v_is_free then p_log ->> 'name_de' else private.neutral_session_name(log_kind) end,
        intro_week, deload, from_health, v_is_free, new_revision, write_id, v_source,
        least((p_log ->> 'client_updated_at')::timestamptz, now()),
        case when v_has_sport then (p_log -> 'sport' ->> 'sport')::public.sport_type end,
        case when v_has_sport then (p_log -> 'sport' ->> 'duration_s')::integer end,
        case when v_has_sport then (p_log -> 'sport' ->> 'distance_m')::integer end,
        case when v_has_hyrox then p_log -> 'hyrox_splits' end
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
        session_log_id, user_id, modality, duration_s, distance_m, elevation_m, e_bike,
        avg_power_w, stroke_rate, intervals, walk_kind
      )
      values (
        log_id, current_user_id, (p_log -> 'cardio' ->> 'modality')::public.endurance_modality,
        (p_log -> 'cardio' ->> 'duration_s')::integer, (p_log -> 'cardio' ->> 'distance_m')::integer,
        (p_log -> 'cardio' ->> 'elevation_m')::integer,
        -- E-Bike nur beim Rad (CHECK cardio_logs_e_bike_only_bike → „Ungültige Werte im Tagebuch.“).
        coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false),
        -- Stufe 1: Rudern-Werte nur bei row, Art der Geh-Einheit nur bei walk (CHECKs cardio_logs_row_only_row,
        -- cardio_logs_walk_kind_only_walk, Grenzen der Spalten → „Ungültige Werte im Tagebuch.“).
        (p_log -> 'cardio' ->> 'avg_power_w')::smallint, (p_log -> 'cardio' ->> 'stroke_rate')::smallint,
        nullif(p_log -> 'cardio' -> 'intervals', 'null'::jsonb),
        (p_log -> 'cardio' ->> 'walk_kind')::public.walk_kind
      );
      -- E-Bike: die verknüpfte eigene Rad-Strecke folgt dem Eintrag (eine Angabe je Fahrt).
      update public.tracked_routes t
      set e_bike = coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false)
      where t.session_log_id = log_id and t.user_id = current_user_id and t.sport = 'bike'
        and t.e_bike is distinct from coalesce((p_log -> 'cardio' ->> 'e_bike')::boolean, false);
      -- Wandern (Stufe 1): die verknüpfte eigene Geh-Strecke folgt dem Eintrag; die SAC-Stufe bleibt nur bei Wandern/
      -- Bergwandern (CHECK tracked_routes_sac_grade_hike).
      update public.tracked_routes t
      set walk_kind = (p_log -> 'cardio' ->> 'walk_kind')::public.walk_kind,
          sac_grade = case when (p_log -> 'cardio' ->> 'walk_kind') in ('hike', 'mountain_hike') then t.sac_grade end
      where t.session_log_id = log_id and t.user_id = current_user_id and t.sport = 'walk'
        and t.walk_kind is distinct from (p_log -> 'cardio' ->> 'walk_kind')::public.walk_kind;
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
-- 4. public.save_tracked_route
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
  -- Sportarten Stufe 1 (20261027100200): walk_kind, elevation_loss_m, max_altitude_m, sac_grade dürfen fehlen (= null).
  optional_keys constant text[] := array[
    'elevation_profile', 'e_bike', 'walk_kind', 'elevation_loss_m', 'max_altitude_m', 'sac_grade'
  ];
  -- sync: FREE_SESSION.names.walkKinds (Name einer freien Geh-Einheit, die der Strecke folgt)
  walk_kind_names constant jsonb := '{"walk": "Spaziergang", "hike": "Wanderung", "mountain_hike": "Bergwanderung"}';
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
     -- sync: TRACKED_ROUTE_LIMITS.elevationLossM, maxAltitudeM, sacGrade (Rest prüfen die CHECKs der Tabelle)
     or (r ? 'walk_kind' and jsonb_typeof(r -> 'walk_kind') not in ('string', 'null'))
     or (r ? 'elevation_loss_m' and not (jsonb_typeof(r -> 'elevation_loss_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_loss_m', 0, 10000, 0)))
     or (r ? 'max_altitude_m' and not (jsonb_typeof(r -> 'max_altitude_m') = 'null'
       or private.jsonb_number_between(r -> 'max_altitude_m', -500, 9000, 0)))
     or (r ? 'sac_grade' and not (jsonb_typeof(r -> 'sac_grade') = 'null'
       or private.jsonb_number_between(r -> 'sac_grade', 1, 3, 0)))
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
    perform (r ->> 'difficulty')::public.route_difficulty, (r ->> 'walk_kind')::public.walk_kind;
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
      elevation_profile, e_bike,
      walk_kind, elevation_loss_m, max_altitude_m, sac_grade
    )
    values (
      v_id, current_user_id, r ->> 'name', v_sport, v_started_at, v_duration_s, (r ->> 'moving_s')::integer,
      (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer, r ->> 'polyline',
      v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', (r ->> 'difficulty')::public.route_difficulty,
      (r ->> 'is_favorite')::boolean, v_base_route_id, r ->> 'note', v_session_log_id, v_source,
      case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
      -- Nur beim Rad (CHECK tracked_routes_e_bike_only_bike → „Ungültige Angaben zur Strecke.“).
      coalesce((r ->> 'e_bike')::boolean, false),
      -- Stufe 1: nur bei Gehen bzw. Wandern/Bergwandern (CHECKs tracked_routes_walk_kind_only_walk,
      -- tracked_routes_sac_grade_hike → „Ungültige Angaben zur Strecke.“).
      (r ->> 'walk_kind')::public.walk_kind, (r ->> 'elevation_loss_m')::integer, (r ->> 'max_altitude_m')::integer,
      (r ->> 'sac_grade')::smallint
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
    -- Wandern (Stufe 1): ebenso die Art der Geh-Einheit; eine freie Geh-Einheit heißt danach wie ihre Art.
    update public.cardio_logs cl
    set walk_kind = (r ->> 'walk_kind')::public.walk_kind
    where cl.session_log_id = v_session_log_id and cl.modality = 'walk';
    update public.session_logs sl
    set name_de = walk_kind_names ->> coalesce(r ->> 'walk_kind', 'walk')
    where sl.id = v_session_log_id and sl.is_free and v_sport = 'walk' and sl.hyrox_splits is null;
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
-- 4b. public.update_tracked_route
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
  -- Sportarten Stufe 1 (20261027100200): walk_kind und sac_grade ebenso (fehlt = unverändert).
  update_optional_keys constant text[] := array['e_bike', 'walk_kind', 'sac_grade'];
  -- sync: FREE_SESSION.names.walkKinds
  walk_kind_names constant jsonb := '{"walk": "Spaziergang", "hike": "Wanderung", "mountain_hike": "Bergwanderung"}';
  current_user_id uuid := auth.uid();
  r jsonb := p_route;
  v_id uuid;
  v_log_id uuid;
  v_e_bike boolean;
  v_walk_kind public.walk_kind;
  v_sport public.endurance_modality;
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
     or (r ? 'e_bike' and jsonb_typeof(r -> 'e_bike') <> 'boolean')
     or (r ? 'walk_kind' and jsonb_typeof(r -> 'walk_kind') not in ('string', 'null'))
     or (r ? 'sac_grade' and not (jsonb_typeof(r -> 'sac_grade') = 'null'
       or private.jsonb_number_between(r -> 'sac_grade', 1, 3, 0))) then
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
        e_bike = coalesce((r ->> 'e_bike')::boolean, t.e_bike),
        -- Stufe 1: fehlt = unverändert; walk_kind nur bei Gehen (CHECK). Wechselt die Art weg von Wandern/Bergwandern
        -- ohne Angabe zur SAC-Stufe, fällt diese weg (CHECK tracked_routes_sac_grade_hike).
        walk_kind = case when r ? 'walk_kind' then (r ->> 'walk_kind')::public.walk_kind else t.walk_kind end,
        sac_grade = case
          when r ? 'sac_grade' then (r ->> 'sac_grade')::smallint
          when r ? 'walk_kind' and coalesce(r ->> 'walk_kind', 'walk') not in ('hike', 'mountain_hike') then null
          else t.sac_grade
        end
    where t.id = v_id and t.user_id = current_user_id
    returning t.session_log_id, t.e_bike, t.walk_kind, t.sport into v_log_id, v_e_bike, v_walk_kind, v_sport;
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
  -- Wandern (Stufe 1): der verknüpfte eigene Geh-Eintrag folgt der Strecke; ein freier Eintrag heißt wie seine Art
  -- (FREE_SESSION.names.walkKinds). Revision + 1 wie beim E-Bike.
  if v_log_id is not null and r ? 'walk_kind' and v_sport = 'walk' then
    update public.cardio_logs cl
    set walk_kind = v_walk_kind
    where cl.session_log_id = v_log_id and cl.user_id = current_user_id and cl.modality = 'walk'
      and cl.walk_kind is distinct from v_walk_kind;
    if found then
      update public.session_logs sl
      set revision = sl.revision + 1, last_write_id = gen_random_uuid(), client_updated_at = now(),
          name_de = case when sl.is_free and sl.hyrox_splits is null
                         then walk_kind_names ->> coalesce(v_walk_kind::text, 'walk') else sl.name_de end
      where sl.id = v_log_id and sl.user_id = current_user_id;
    end if;
  end if;
end;
$$;
revoke all on function public.update_tracked_route(jsonb) from public, anon;
grant execute on function public.update_tracked_route(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. public.save_wearable_route
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_wearable_route(p_route jsonb, p_explicit boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  route_keys constant text[] := array[
    'external_id', 'distance_m', 'moving_s', 'elevation_gain_m', 'polyline', 'km_splits', 'elevation_profile'
  ];
  -- Sportarten Stufe 1 (20261027100200): Abstieg und höchster Punkt dürfen fehlen (= null).
  optional_keys constant text[] := array['elevation_loss_m', 'max_altitude_m'];
  -- sync: FREE_SESSION.names.endurance (ohne Schwimmen – keine Strecke im Wasser)
  route_names constant jsonb := '{"run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt"}';
  -- sync: FREE_SESSION.names.walkKinds (Geh-Route: Name je Art der Geh-Einheit)
  walk_kind_names constant jsonb := '{"walk": "Spaziergang", "hike": "Wanderung", "mountain_hike": "Bergwanderung"}';
  -- sync: WEARABLE_SYNC.externalIdMaxLength, TRACKED_ROUTE_LIMITS (CARDIO_LOG_LIMITS)
  payload_max_bytes constant integer := 200000;
  current_user_id uuid := auth.uid();
  r jsonb := p_route;
  ws_row record;
  v_duration integer;
  v_summary numeric[];
  v_route_id uuid;
  v_has_route boolean;
  v_changed integer;
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
  if r is null or p_explicit is null or jsonb_typeof(r) <> 'object' or octet_length(r::text) > payload_max_bytes then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;
  perform private.assert_json_keys(r, route_keys || optional_keys, 'Strecke');
  if not (r ?& route_keys)
     or jsonb_typeof(r -> 'external_id') <> 'string'
     or char_length(r ->> 'external_id') not between 1 and 200
     or not private.jsonb_number_between(r -> 'distance_m', 0, 500000, 0)
     or not private.jsonb_number_between(r -> 'moving_s', 0, 43200, 0)
     or not (jsonb_typeof(r -> 'elevation_gain_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_gain_m', 0, 10000, 0))
     or jsonb_typeof(r -> 'polyline') <> 'string'
     or jsonb_typeof(r -> 'km_splits') <> 'array'
     or jsonb_typeof(r -> 'elevation_profile') not in ('array', 'null')
     -- sync: TRACKED_ROUTE_LIMITS.elevationLossM, maxAltitudeM
     or (r ? 'elevation_loss_m' and not (jsonb_typeof(r -> 'elevation_loss_m') = 'null'
       or private.jsonb_number_between(r -> 'elevation_loss_m', 0, 10000, 0)))
     or (r ? 'max_altitude_m' and not (jsonb_typeof(r -> 'max_altitude_m') = 'null'
       or private.jsonb_number_between(r -> 'max_altitude_m', -500, 9000, 0))) then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  perform pg_advisory_xact_lock(hashtext('wearables|' || current_user_id::text));

  select ws.session_log_id, ws.merged, ws.started_at, ws.finished_at, cl.modality, cl.walk_kind into ws_row
  from public.wearable_sessions ws
  left join public.cardio_logs cl on cl.session_log_id = ws.session_log_id
  where ws.user_id = current_user_id and ws.provider = 'health_connect' and ws.external_id = (r ->> 'external_id')
  for update of ws;
  if not found then
    raise exception 'Diese Einheit von der Uhr wurde nicht gefunden.' using errcode = 'invalid_parameter_value';
  end if;
  if ws_row.modality is null or ws_row.modality not in ('run', 'bike', 'walk') then
    return 'skipped';
  end if;
  -- Eigene Strecke am Eintrag ist führend (W8-9).
  if exists (
    select 1 from public.tracked_routes t
    where t.session_log_id = ws_row.session_log_id and t.source <> 'watch'
  ) then
    delete from public.tracked_routes t
    where t.user_id = current_user_id and t.wearable_session_log_id = ws_row.session_log_id;
    return 'skipped';
  end if;
  -- Von der Person gelöscht: nur „Route freigeben“ legt sie wieder an.
  if exists (select 1 from private.wearable_route_dismissals d where d.session_log_id = ws_row.session_log_id) then
    if not p_explicit then
      return 'skipped';
    end if;
    delete from private.wearable_route_dismissals d where d.session_log_id = ws_row.session_log_id;
  end if;

  v_duration := round(extract(epoch from (ws_row.finished_at - ws_row.started_at)))::integer;
  v_summary := private.polyline_summary(r ->> 'polyline');
  if v_summary is null or v_summary[1] not between 2 and 5000 then
    raise exception 'Ungültige Angaben zur Strecke.' using errcode = 'invalid_parameter_value';
  end if;

  select t.id into v_route_id
  from public.tracked_routes t
  where t.user_id = current_user_id and t.wearable_session_log_id = ws_row.session_log_id
  for update;
  v_has_route := found;
  begin
    if v_has_route then
      update public.tracked_routes t
      set sport = ws_row.modality, started_at = ws_row.started_at, duration_s = v_duration,
          moving_s = (r ->> 'moving_s')::integer, distance_m = (r ->> 'distance_m')::integer,
          elevation_gain_m = (r ->> 'elevation_gain_m')::integer, polyline = r ->> 'polyline',
          point_count = v_summary[1]::integer, bbox = v_summary[2:5], km_splits = r -> 'km_splits',
          elevation_profile = case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
          session_log_id = ws_row.session_log_id,
          -- Stufe 1: Art der Geh-Einheit aus dem Eintrag; SAC-Stufe nur bei Wandern/Bergwandern.
          walk_kind = case when ws_row.modality = 'walk' then ws_row.walk_kind end,
          sac_grade = case when ws_row.modality = 'walk' and ws_row.walk_kind in ('hike', 'mountain_hike')
                           then t.sac_grade end,
          elevation_loss_m = (r ->> 'elevation_loss_m')::integer, max_altitude_m = (r ->> 'max_altitude_m')::integer
      where t.id = v_route_id;
    else
      insert into public.tracked_routes (
        user_id, name, sport, started_at, duration_s, moving_s, distance_m, elevation_gain_m, polyline, point_count,
        bbox, km_splits, difficulty, is_favorite, base_route_id, note, session_log_id, source, elevation_profile,
        wearable_session_log_id,
        walk_kind, elevation_loss_m, max_altitude_m
      )
      values (
        current_user_id,
        case when ws_row.modality = 'walk' then walk_kind_names ->> coalesce(ws_row.walk_kind::text, 'walk')
             else route_names ->> ws_row.modality::text end,
        ws_row.modality, ws_row.started_at, v_duration,
        (r ->> 'moving_s')::integer, (r ->> 'distance_m')::integer, (r ->> 'elevation_gain_m')::integer,
        r ->> 'polyline', v_summary[1]::integer, v_summary[2:5], r -> 'km_splits', null, false, null, null,
        ws_row.session_log_id, 'watch',
        case when jsonb_typeof(r -> 'elevation_profile') = 'array' then r -> 'elevation_profile' end,
        ws_row.session_log_id,
        case when ws_row.modality = 'walk' then ws_row.walk_kind end,
        (r ->> 'elevation_loss_m')::integer, (r ->> 'max_altitude_m')::integer
      );
    end if;
  exception
    when unique_violation then
      raise exception 'Dieser Eintrag hat schon eine Strecke.' using errcode = 'unique_violation';
    -- Ohne „Failing row contains (…)“ nach außen (keine Koordinaten).
    when check_violation or not_null_violation or foreign_key_violation or invalid_text_representation
      or numeric_value_out_of_range then
      raise exception 'Ungültige Angaben zur Strecke.' using errcode = sqlstate;
  end;

  -- Eigene Uhr-Einheit: Distanz und Höhenmeter des Eintrags folgen der Route (Abgleich mit der Strecke,
  -- private.session_log_fits_route). Zusammengeführt: der eigene Eintrag bleibt führend.
  if not ws_row.merged then
    update public.cardio_logs cl
    set distance_m = (r ->> 'distance_m')::integer,
        elevation_m = coalesce((r ->> 'elevation_gain_m')::integer, cl.elevation_m)
    where cl.session_log_id = ws_row.session_log_id
      and (cl.distance_m, cl.elevation_m) is distinct from
        ((r ->> 'distance_m')::integer, coalesce((r ->> 'elevation_gain_m')::integer, cl.elevation_m));
    get diagnostics v_changed = row_count;
    if v_changed > 0 then
      update public.session_logs sl
      set revision = sl.revision + 1, last_write_id = gen_random_uuid(), client_updated_at = now()
      where sl.id = ws_row.session_log_id and sl.user_id = current_user_id;
    end if;
  end if;
  return 'saved';
end;
$$;

revoke all on function public.save_wearable_route(jsonb, boolean) from public, anon;
grant execute on function public.save_wearable_route(jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 6. public.import_wearable_batch
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
  -- Sportarten Stufe 1 (20261027100200): dürfen FEHLEN (ältere App-Fassungen) = null. walk_kind nur bei walk,
  -- avg_power_w und stroke_rate nur bei row.
  session_optional_keys constant text[] := array['walk_kind', 'avg_power_w', 'stroke_rate'];
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
    "run": "Lauf", "walk": "Spaziergang", "bike": "Radfahrt", "swim": "Schwimmen", "row": "Rudern",
    "strength": "Freie Kraft-Einheit"
  }';
  -- sync: FREE_SESSION.names.walkKinds (Gruppe walk: Name je Art; fehlt die Art = Spaziergang)
  walk_kind_names constant jsonb := '{"walk": "Spaziergang", "hike": "Wanderung", "mountain_hike": "Bergwanderung"}';
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
  v_walk_kind public.walk_kind;
  v_power integer;
  v_stroke integer;
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
       or exists (select 1 from jsonb_object_keys(s) k where not (k = any (session_keys) or k = any (session_optional_keys)))
       or not (s ?& session_keys)
       or jsonb_typeof(s -> 'external_id') <> 'string'
       or char_length(s ->> 'external_id') not between 1 and 200
       or jsonb_typeof(s -> 'origin') <> 'string' or not ((s ->> 'origin') = any (origins))
       or jsonb_typeof(s -> 'group') <> 'string'
       or (s ->> 'group') not in ('run', 'walk', 'bike', 'swim', 'row', 'strength', 'other')
       or jsonb_typeof(s -> 'name_de') <> 'string' or (s ->> 'name_de') !~ name_pattern
       or ((s ->> 'group') <> 'other' and (s ->> 'name_de') is distinct from (
         case when (s ->> 'group') = 'walk' then walk_kind_names ->> coalesce(s ->> 'walk_kind', 'walk')
              else group_names ->> (s ->> 'group') end))
       -- Stufe 1: Art der Geh-Einheit nur bei walk; Leistung (sync: CARDIO_LOG_LIMITS.avgPowerW) und Schlagzahl
       -- (strokeRate) nur bei row.
       or not (coalesce(jsonb_typeof(s -> 'walk_kind'), 'null') = 'null'
         or ((s ->> 'group') = 'walk' and jsonb_typeof(s -> 'walk_kind') = 'string'
           and (s ->> 'walk_kind') in ('walk', 'hike', 'mountain_hike')))
       or not (coalesce(jsonb_typeof(s -> 'avg_power_w'), 'null') = 'null'
         or ((s ->> 'group') = 'row' and private.jsonb_number_between(s -> 'avg_power_w', 1, 1000, 0)))
       or not (coalesce(jsonb_typeof(s -> 'stroke_rate'), 'null') = 'null'
         or ((s ->> 'group') = 'row' and private.jsonb_number_between(s -> 'stroke_rate', 10, 60, 0)))
       or jsonb_typeof(s -> 'started_at') <> 'string' or (s ->> 'started_at') !~ iso_timestamp_pattern
       or jsonb_typeof(s -> 'finished_at') <> 'string' or (s ->> 'finished_at') !~ iso_timestamp_pattern
       or jsonb_typeof(s -> 'performed_on') <> 'string' or (s ->> 'performed_on') !~ iso_date_pattern
       or not private.jsonb_number_between(s -> 'duration_s', 60, 43200, 0)
       or not (jsonb_typeof(s -> 'distance_m') = 'null'
         or ((s ->> 'group') in ('run', 'walk', 'bike', 'swim', 'row')
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
    v_modality := case when v_group in ('run', 'walk', 'bike', 'swim', 'row') then v_group::public.endurance_modality end;
    v_walk_kind := (s ->> 'walk_kind')::public.walk_kind;
    v_power := (s ->> 'avg_power_w')::integer;
    v_stroke := (s ->> 'stroke_rate')::integer;
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
        -- Stufe 1: Leistung und Schlagzahl füllen nur Lücken; die Art der Geh-Einheit bleibt (die Person kann sie im
        -- Eintrag geändert haben).
        update public.cardio_logs cl
        set duration_s = v_duration, distance_m = coalesce(v_distance, cl.distance_m),
            avg_power_w = coalesce(cl.avg_power_w, v_power), stroke_rate = coalesce(cl.stroke_rate, v_stroke)
        where cl.session_log_id = existing.session_log_id and cl.modality = v_modality
          and (cl.duration_s, cl.distance_m, cl.avg_power_w, cl.stroke_rate) is distinct from
            (v_duration, coalesce(v_distance, cl.distance_m), coalesce(cl.avg_power_w, v_power),
             coalesce(cl.stroke_rate, v_stroke));
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
        insert into public.cardio_logs (
          session_log_id, user_id, modality, duration_s, distance_m, elevation_m, walk_kind, avg_power_w, stroke_rate
        )
        values (v_log_id, current_user_id, v_modality, v_duration, v_distance, null, v_walk_kind, v_power, v_stroke);
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

-- ---------------------------------------------------------------------------------------------------------
-- 7. public.save_app_layout
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_app_layout(p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: DASHBOARD_TILES, NAV_AREAS, APP_LAYOUT (auch version/versionMax), STEP_GOAL in packages/core (db-sync.test.ts)
  tile_ids constant text[] := array[
    'training', 'competition', 'workouts', 'nutrition', 'body', 'progress', 'endurance', 'steps', 'recovery',
    'shortcuts'
  ];
  area_ids constant text[] := array[
    'uebersicht', 'today', 'workouts', 'ernaehrung', 'einkaufsliste', 'wettkampf', 'fortschritt', 'mehr'
  ];
  tabs_min constant integer := 3;
  tabs_max constant integer := 6;
  tiles_max constant integer := 20;
  step_goal_min constant integer := 1000;
  step_goal_max constant integer := 30000;
  step_goal_step constant integer := 500;
  layout_version_max constant integer := 99;
  current_user_id uuid := auth.uid();
  tiles jsonb;
  tabs jsonb;
  entry jsonb;
  has_goal boolean;
  goal_value jsonb;
  new_goal integer;
  version_value jsonb;
  new_version integer;
  -- Sportarten Stufe 1 (20261027100200): Einstellung „Erholungs-Routine vorschlagen“ (optional).
  has_recovery boolean;
  new_recovery boolean;
  allowed_keys constant text[] := array[
    'dashboard_tiles', 'layout_version', 'recovery_routine', 'step_goal', 'tab_bar'
  ];
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'object' then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  -- Pflicht: dashboard_tiles, tab_bar; optional: step_goal, layout_version (seit 26.10.2026), recovery_routine (seit
  -- 27.10.2026). Sonst nichts.
  if not (p_layout ? 'dashboard_tiles' and p_layout ? 'tab_bar')
     or exists (select 1 from jsonb_object_keys(p_layout) k where not (k = any (allowed_keys))) then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  tiles := p_layout -> 'dashboard_tiles';
  tabs := p_layout -> 'tab_bar';
  if jsonb_typeof(tiles) is distinct from 'array' or jsonb_array_length(tiles) > tiles_max
     or jsonb_typeof(tabs) is distinct from 'array'
     or jsonb_array_length(tabs) not between tabs_min and tabs_max then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tiles) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(entry) k) is distinct from array['id', 'visible']
       or jsonb_typeof(entry -> 'id') is distinct from 'string'
       or jsonb_typeof(entry -> 'visible') is distinct from 'boolean'
       or not ((entry ->> 'id') = any (tile_ids)) then
      raise exception 'Ungültige Kachel.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(tiles) e) <> jsonb_array_length(tiles) then
    raise exception 'Kachel doppelt.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tabs) loop
    if jsonb_typeof(entry) is distinct from 'string' or not ((entry #>> '{}') = any (area_ids)) then
      raise exception 'Ungültiger Bereich.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(tabs) e) <> jsonb_array_length(tabs)
     or tabs ->> 0 is distinct from 'uebersicht'
     or tabs ->> (jsonb_array_length(tabs) - 1) is distinct from 'mehr' then
    raise exception 'Ungültige Menüleiste.' using errcode = 'invalid_parameter_value';
  end if;
  -- Schrittziel (optional): ganze Zahl im Raster, null = Standard; fehlt das Feld, bleibt das gespeicherte Ziel.
  has_goal := p_layout ? 'step_goal';
  new_goal := null;
  if has_goal then
    goal_value := p_layout -> 'step_goal';
    if jsonb_typeof(goal_value) = 'number' then
      if (goal_value #>> '{}')::numeric not between step_goal_min and step_goal_max
         or (goal_value #>> '{}')::numeric % step_goal_step <> 0 then
        raise exception 'Ungültiges Schrittziel.' using errcode = 'invalid_parameter_value';
      end if;
      new_goal := (goal_value #>> '{}')::integer;
    elsif jsonb_typeof(goal_value) is distinct from 'null' then
      raise exception 'Ungültiges Schrittziel.' using errcode = 'invalid_parameter_value';
    end if;
  end if;
  -- Fassung der Anordnung (optional): ganze Zahl 1–99; fehlt das Feld (ältere App-Fassung), gilt die Anordnung als
  -- alte Fassung (null) – die App stellt dann einen unveränderten alten Standard um (normalizeLayout).
  new_version := null;
  if p_layout ? 'layout_version' then
    version_value := p_layout -> 'layout_version';
    if jsonb_typeof(version_value) = 'number' then
      if (version_value #>> '{}')::numeric not between 1 and layout_version_max
         or (version_value #>> '{}')::numeric % 1 <> 0 then
        raise exception 'Ungültige Fassung.' using errcode = 'invalid_parameter_value';
      end if;
      new_version := (version_value #>> '{}')::integer;
    elsif jsonb_typeof(version_value) is distinct from 'null' then
      raise exception 'Ungültige Fassung.' using errcode = 'invalid_parameter_value';
    end if;
  end if;
  -- Erholungs-Routine vorschlagen (optional): true/false; fehlt das Feld (ältere App-Fassung), bleibt die gespeicherte
  -- Einstellung (neu: Standard true).
  has_recovery := p_layout ? 'recovery_routine';
  new_recovery := true;
  if has_recovery then
    if jsonb_typeof(p_layout -> 'recovery_routine') is distinct from 'boolean' then
      raise exception 'Ungültige Einstellung.' using errcode = 'invalid_parameter_value';
    end if;
    new_recovery := (p_layout ->> 'recovery_routine')::boolean;
  end if;
  insert into public.app_layout_settings as s
    (user_id, dashboard_tiles, tab_bar, step_goal, layout_version, recovery_routine, updated_at)
  values (current_user_id, tiles, tabs, new_goal, new_version, new_recovery, now())
  on conflict (user_id) do update
    set dashboard_tiles = excluded.dashboard_tiles, tab_bar = excluded.tab_bar,
        step_goal = case when has_goal then excluded.step_goal else s.step_goal end,
        layout_version = excluded.layout_version,
        recovery_routine = case when has_recovery then excluded.recovery_routine else s.recovery_routine end,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_app_layout(jsonb) from public, anon;
grant execute on function public.save_app_layout(jsonb) to authenticated;
