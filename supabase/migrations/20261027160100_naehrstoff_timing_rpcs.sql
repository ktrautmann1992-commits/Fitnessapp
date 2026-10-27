-- Nährstoff-Timing 2 – Essen rund ums Training (docs/PLAN-NAEHRSTOFF-TIMING.md, freigegeben 27.10.2026) · Etappe T0 –
-- neue Fassungen der Schreib-Funktionen. Jede Funktion ist die NEUESTE vorhandene Fassung, Zeile für Zeile übernommen
-- und nur um das unten genannte, OPTIONALE Feld erweitert (gleiche Signatur, gleiche Rechte; fehlt das Feld = Verhalten
-- wie bisher, ältere App-Fassungen bleiben gültig). Abgleich mit packages/core in db-sync.test.ts.
-- 1. private.insert_plan_sessions (aus 20261027100200_sportarten_stufe1_rpcs.sql): optionales Feld start_time
--    („HH:MM“, ganze Minuten; Bereich prüft zusätzlich der CHECK planned_sessions_start_time_check). Damit kann die App
--    beim Erstellen eines Plans bzw. Folgeblocks die Uhrzeiten der bisherigen Einheiten übernehmen
--    (carryOverSessionStartTimes in packages/core).
-- 2. public.save_meal_plan (aus 20261016120000_n7_teil2_retention_kcal_check.sql): optionales Feld user_chosen je
--    Mahlzeit (Boolean, fehlt = false) – „selbst gewählt“, wird beim Verschieben des Trainings nie automatisch getauscht.
-- Verschieben geplanter Einheiten (Update von scheduled_on/start_time, public.swap_planned_sessions) braucht keine neue
-- Fassung: Die Uhrzeit bleibt an der Zeile und wandert so mit.
-- Fehlermeldungen: feste deutsche Texte ohne Werte.

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
    'workout_type', 'training_phase', 'workout_steps', 'target_distance_m', 'start_time'
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

      -- Nährstoff-Timing (T0): Uhrzeit optional, nur als Text „HH:MM“ (JSON null oder fehlend = ohne Uhrzeit);
      -- Bereich prüft der CHECK planned_sessions_start_time_check.
      if coalesce(jsonb_typeof(s -> 'start_time'), 'null') not in ('string', 'null')
         or (jsonb_typeof(s -> 'start_time') = 'string' and (s ->> 'start_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
        raise exception 'Ungültige Werte im Plan.' using errcode = 'check_violation';
      end if;
      -- Schritte: nur eine Liste (JSON null oder fehlend = keine Schritte); Struktur prüft der CHECK.
      if jsonb_typeof(s -> 'workout_steps') not in ('array', 'null') then
        raise exception 'Ungültige Werte im Plan.' using errcode = 'check_violation';
      end if;
      insert into public.planned_sessions (
        plan_id, user_id, block_no, week_no, is_intro_week, is_deload, kind, template_day_index, scheduled_on,
        name_de, focus, endurance_modality, effort_target, estimated_minutes, warmup_de, cooldown_de,
        workout_type, training_phase, workout_steps, target_distance_m, start_time
      )
      values (
        p_plan_id, p_user_id, p_block_no, (s ->> 'week_no')::smallint, (s ->> 'is_intro_week')::boolean,
        (s ->> 'is_deload')::boolean, (s ->> 'kind')::public.planned_session_kind,
        (s ->> 'template_day_index')::smallint, scheduled,
        s ->> 'name_de', (s ->> 'focus')::public.session_focus,
        (s ->> 'endurance_modality')::public.endurance_modality, (s ->> 'effort_target')::smallint,
        (s ->> 'estimated_minutes')::smallint, s ->> 'warmup_de', s ->> 'cooldown_de',
        (s ->> 'workout_type')::public.workout_type, (s ->> 'training_phase')::public.training_phase,
        nullif(s -> 'workout_steps', 'null'::jsonb), (s ->> 'target_distance_m')::integer,
        (s ->> 'start_time')::time
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
-- 2. public.save_meal_plan
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_meal_plan(
  p_plan jsonb,
  p_auto_adjusted boolean default false,
  p_recipes_changed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_keys constant text[] := array[
    'week_start', 'engine_version', 'variant', 'meal_prep_plan_id', 'inputs', 'items'
  ];
  input_keys constant text[] := array[
    'diet', 'meals_per_day', 'cooking_mode', 'mealprep_days', 'mealprep_slots'
  ];
  item_keys constant text[] := array[
    'date', 'slot', 'role', 'recipe_id', 'recipe_version', 'title_de', 'factor', 'kcal', 'protein_g', 'carbs_g',
    'fat_g', 'substitutions', 'omitted_optional', 'ingredient_swaps', 'is_fill', 'prep_kind', 'cook_date',
    'storage', 'meal_prep_plan_id', 'day_status', 'user_chosen'
  ];
  pair_keys constant text[] := array['index', 'food_id', 'substitute_food_id'];
  omit_keys constant text[] := array['index', 'food_id'];
  -- sync: MEAL_PLAN_ENGINE_VERSION
  engine_version_max constant integer := 1;
  -- sync: 7 × (NUTRITION_LIMITS.mealsPerDay.max + EXTRA_SLOTS) in mealPlanPayloadSchema
  items_max constant integer := 70;
  -- sync: RECIPE_SCHEMA_LIMITS.ingredients.max – höchstens eine Änderung je Zutat (Wächter N7 H1)
  changes_max constant integer := 20;
  -- sync: MEAL_PLAN_PAYLOAD_MAX_BYTES (Wächter N7 H1)
  payload_max_bytes constant integer := 262144;
  -- sync: MEAL_PLAN_DAY_KCAL_CHECK in packages/core/src/constants.ts (G-W3)
  checked_day_statuses constant text[] := array['complete', 'no_targets'];
  kcal_tolerance constant numeric := 1;
  -- sync: MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE in packages/core/src/constants.ts (H1)
  item_kcal_tolerance constant numeric := 1;
  item_macro_tolerance_g constant numeric := 0.1;
  current_user_id uuid := auth.uid();
  today date := private.berlin_today();
  prefs record;
  basis record;
  week date;
  excluded_groups text[];
  uses boolean;
  old_plan record;
  new_plan_id uuid;
  item jsonb;
  pair jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  -- Größe zuerst (Wächter N7 H1): billig, klare Meldung, bevor Schleifen über die Eingabe laufen.
  if octet_length(p_plan::text) > payload_max_bytes then
    raise exception 'Essensplan zu groß.' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  select np.diet_type, np.eats_pork into prefs
  from public.nutrition_prefs np where np.user_id = current_user_id;
  if not found then
    raise exception 'Ernährungsangaben fehlen.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    -- -----------------------------------------------------------------------------------------------------
    -- Form (wie mealPlanPayloadSchema, strikt)
    -- -----------------------------------------------------------------------------------------------------
    perform private.assert_json_keys(p_plan, plan_keys, 'Essensplan');
    perform private.assert_json_keys(p_plan -> 'inputs', input_keys, 'Angaben');
    if jsonb_typeof(p_plan -> 'week_start') is distinct from 'string'
       or not private.jsonb_number_between(p_plan -> 'engine_version', 1, engine_version_max, 0)
       or not private.jsonb_number_between(p_plan -> 'variant', 0, 10000, 0)
       or coalesce(jsonb_typeof(p_plan -> 'meal_prep_plan_id'), 'fehlt') not in ('string', 'null')
       or jsonb_typeof(p_plan -> 'items') is distinct from 'array' then
      raise exception 'Ungültiger Essensplan.' using errcode = 'invalid_parameter_value';
    end if;
    -- Angaben (ohne Gesundheitsdaten, K8): alle Felder, Werte wie mealPlanPayloadSchema.inputs.
    if jsonb_typeof(p_plan -> 'inputs' -> 'diet') is distinct from 'string'
       or not private.jsonb_number_between(p_plan -> 'inputs' -> 'meals_per_day', 1, 8, 0)
       or jsonb_typeof(p_plan -> 'inputs' -> 'cooking_mode') is distinct from 'string'
       or (jsonb_typeof(p_plan -> 'inputs' -> 'mealprep_days') is distinct from 'null'
           and not private.jsonb_number_between(p_plan -> 'inputs' -> 'mealprep_days', 1, 7, 0))
       or jsonb_typeof(p_plan -> 'inputs' -> 'mealprep_slots') is distinct from 'string' then
      raise exception 'Ungültige Angaben im Essensplan.' using errcode = 'invalid_parameter_value';
    end if;
    perform (p_plan -> 'inputs' ->> 'diet')::public.diet_type,
      (p_plan -> 'inputs' ->> 'cooking_mode')::public.cooking_mode,
      (p_plan -> 'inputs' ->> 'mealprep_slots')::public.mealprep_slot_mode;

    week := (p_plan ->> 'week_start')::date;
    if extract(isodow from week) <> 1
       or week < date_trunc('week', today - 1)::date
       or week > date_trunc('week', today + 1)::date + 7 then
      raise exception 'Woche außerhalb des Rahmens.' using errcode = 'invalid_parameter_value';
    end if;

    if jsonb_array_length(p_plan -> 'items') > items_max then
      raise exception 'Zu viele Mahlzeiten.' using errcode = 'invalid_parameter_value';
    end if;
    for item in select value from jsonb_array_elements(p_plan -> 'items') loop
      perform private.assert_json_keys(item, item_keys, 'Mahlzeit');
      if jsonb_typeof(item -> 'date') is distinct from 'string'
         or jsonb_typeof(item -> 'slot') is distinct from 'string'
         or coalesce(jsonb_typeof(item -> 'role'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(item -> 'recipe_id') is distinct from 'string'
         or not private.jsonb_number_between(item -> 'recipe_version', 1, 1000, 0)
         or jsonb_typeof(item -> 'title_de') is distinct from 'string'
         or jsonb_typeof(item -> 'factor') is distinct from 'number'
         or jsonb_typeof(item -> 'kcal') is distinct from 'number'
         or jsonb_typeof(item -> 'protein_g') is distinct from 'number'
         or jsonb_typeof(item -> 'carbs_g') is distinct from 'number'
         or jsonb_typeof(item -> 'fat_g') is distinct from 'number'
         or jsonb_typeof(item -> 'substitutions') is distinct from 'array'
         or jsonb_typeof(item -> 'omitted_optional') is distinct from 'array'
         or jsonb_typeof(item -> 'ingredient_swaps') is distinct from 'array'
         or jsonb_typeof(item -> 'is_fill') is distinct from 'boolean'
         or jsonb_typeof(item -> 'prep_kind') is distinct from 'string'
         or jsonb_typeof(item -> 'cook_date') is distinct from 'string'
         or coalesce(jsonb_typeof(item -> 'storage'), 'fehlt') not in ('string', 'null')
         or coalesce(jsonb_typeof(item -> 'meal_prep_plan_id'), 'fehlt') not in ('string', 'null')
         or jsonb_typeof(item -> 'day_status') is distinct from 'string'
         -- Nährstoff-Timing (T0): optional, fehlt = false (ältere App-Fassungen).
         or coalesce(jsonb_typeof(item -> 'user_chosen'), 'boolean') <> 'boolean' then
        raise exception 'Ungültige Mahlzeit.' using errcode = 'invalid_parameter_value';
      end if;
      -- Höchstens eine Änderung je Zutat, also zusammen höchstens so viele wie Zutaten (H1).
      if jsonb_array_length(item -> 'substitutions') + jsonb_array_length(item -> 'omitted_optional')
           + jsonb_array_length(item -> 'ingredient_swaps') > changes_max then
        raise exception 'Zu viele Zutaten-Änderungen.' using errcode = 'invalid_parameter_value';
      end if;
      for pair in
        select value from jsonb_array_elements(item -> 'substitutions')
        union all
        select value from jsonb_array_elements(item -> 'ingredient_swaps')
      loop
        perform private.assert_json_keys(pair, pair_keys, 'Ersatz');
        if not private.jsonb_number_between(pair -> 'index', 0, changes_max - 1, 0)
           or jsonb_typeof(pair -> 'food_id') is distinct from 'string'
           or jsonb_typeof(pair -> 'substitute_food_id') is distinct from 'string' then
          raise exception 'Ungültiger Ersatz.' using errcode = 'invalid_parameter_value';
        end if;
      end loop;
      for pair in select value from jsonb_array_elements(item -> 'omitted_optional') loop
        perform private.assert_json_keys(pair, omit_keys, 'Weglassen');
        if not private.jsonb_number_between(pair -> 'index', 0, changes_max - 1, 0)
           or jsonb_typeof(pair -> 'food_id') is distinct from 'string' then
          raise exception 'Ungültige Mahlzeit.' using errcode = 'invalid_parameter_value';
        end if;
      end loop;
    end loop;

    -- -----------------------------------------------------------------------------------------------------
    -- Mahlzeiten und Zutaten-Änderungen als Zeilen (Werte prüfen danach die CHECKs der Tabelle)
    -- -----------------------------------------------------------------------------------------------------
    create temporary table if not exists pg_temp.meal_plan_rows (
      ord integer,
      date date,
      slot text,
      recipe_id text,
      recipe_version integer,
      factor numeric,
      substitutions jsonb,
      omitted jsonb,
      swaps jsonb,
      cook_date date,
      day_status text,
      -- H1 (N7 Teil 2): Nährwerte, die der SERVER speichert (nachgerechnet bzw. vom alten Plan übernommen).
      s_kcal numeric,
      s_protein numeric,
      s_carbs numeric,
      s_fat numeric,
      s_checked boolean
    ) on commit drop;
    truncate pg_temp.meal_plan_rows;
    insert into pg_temp.meal_plan_rows
    select i.ord::integer, (i.v ->> 'date')::date, i.v ->> 'slot', i.v ->> 'recipe_id',
      (i.v ->> 'recipe_version')::integer, (i.v ->> 'factor')::numeric, i.v -> 'substitutions',
      i.v -> 'omitted_optional', i.v -> 'ingredient_swaps', (i.v ->> 'cook_date')::date, i.v ->> 'day_status'
    from jsonb_array_elements(p_plan -> 'items') with ordinality as i(v, ord);

    -- Eine Zeile je Zutaten-Änderung: Art, Stelle, Lebensmittel der Zutat, Ersatz.
    create temporary table if not exists pg_temp.meal_plan_changes (
      ord integer,
      date date,
      recipe_id text,
      kind text,
      idx integer,
      food_id text,
      substitute_food_id text
    ) on commit drop;
    truncate pg_temp.meal_plan_changes;
    insert into pg_temp.meal_plan_changes
    select r.ord, r.date, r.recipe_id, c.kind, (c.v ->> 'index')::integer, c.v ->> 'food_id',
      c.v ->> 'substitute_food_id'
    from pg_temp.meal_plan_rows r
    cross join lateral (
      select 'sub' as kind, v from jsonb_array_elements(r.substitutions) as v
      union all
      select 'omit', v from jsonb_array_elements(r.omitted) as v
      union all
      select 'swap', v from jsonb_array_elements(r.swaps) as v
    ) as c;

    if exists (
      select 1 from pg_temp.meal_plan_rows r
      where r.date < week or r.date > week + 6
        -- Gekocht wird höchstens am Sonntag vor der Woche und nie nach dem Tag selbst.
        or r.cook_date < week - 1 or r.cook_date > r.date
    ) then
      raise exception 'Datum passt nicht zur Woche.' using errcode = 'invalid_parameter_value';
    end if;

    -- Rezepte: ab heute freigegeben in genau dieser Version; vergangene Tage bleiben, wie sie waren (Version höchstens
    -- die aktuelle, Rezept existiert).
    if exists (
      select 1 from pg_temp.meal_plan_rows r
      left join public.recipes rc on rc.id = r.recipe_id
      where rc.id is null
        or (r.date >= today and (rc.status <> 'published' or rc.version <> r.recipe_version))
        or (r.date < today and r.recipe_version > rc.version)
    ) then
      raise exception 'Rezept nicht freigegeben oder veraltet.' using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Zutaten-Änderungen (ab heute): je Stelle höchstens eine, die Stelle gibt es und trägt dieses Lebensmittel
    -- -----------------------------------------------------------------------------------------------------
    if exists (
      select 1 from pg_temp.meal_plan_changes c group by c.ord, c.idx having count(*) > 1
    ) then
      raise exception 'Zutat mehrfach geändert.' using errcode = 'invalid_parameter_value';
    end if;
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today
        and not exists (
          select 1 from public.recipe_ingredients ri
          where ri.recipe_id = c.recipe_id and ri.position = c.idx and ri.food_id = c.food_id
        )
    ) then
      raise exception 'Zutat passt nicht zum Rezept.' using errcode = 'invalid_parameter_value';
    end if;
    -- Weglassen nur bei optionalen Zutaten (S3).
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      join public.recipe_ingredients ri on ri.recipe_id = c.recipe_id and ri.position = c.idx
      where c.date >= today and c.kind = 'omit' and not ri.optional
    ) then
      raise exception 'Nur optionale Zutaten können weggelassen werden.' using errcode = 'invalid_parameter_value';
    end if;
    -- Ersatzprodukt (S4): steht in der Ersatzliste des Lebensmittels und ist freigegeben.
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today and c.kind = 'sub'
        and (
          not exists (
            select 1 from public.foods f, jsonb_array_elements(coalesce(f.data -> 'substitutes', '[]')) as fs(v)
            where f.id = c.food_id and fs.v ->> 'food_id' = c.substitute_food_id
          )
          or not exists (
            select 1 from public.foods f2 where f2.id = c.substitute_food_id and f2.status = 'published'
          )
        )
    ) then
      raise exception 'Ersatzprodukt nicht erlaubt.' using errcode = 'invalid_parameter_value';
    end if;
    -- Zutaten-Tausch (N9, S7): freigegebener Eintrag der Austausch-Tabelle.
    if exists (
      select 1 from pg_temp.meal_plan_changes c
      where c.date >= today and c.kind = 'swap'
        and not exists (
          select 1 from public.ingredient_substitutions x
          where x.food_id = c.food_id and x.substitute_food_id = c.substitute_food_id and x.status = 'published'
        )
    ) then
      raise exception 'Zutaten-Tausch nicht erlaubt.' using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Harte Regeln je Zutat erneut prüfen (7.3): Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“
    -- (Gruppen und je Lebensmittel), Alkohol; Lebensmittel freigegeben. Optionale Zutaten zählen, solange sie nicht
    -- weggelassen sind (S3). Wirksam ist je Stelle: Tausch, sonst Ersatz, sonst die Zutat selbst.
    -- -----------------------------------------------------------------------------------------------------
    excluded_groups := array(
      select fp.food_group from public.food_preferences fp
      where fp.user_id = current_user_id and fp.kind in ('intolerance', 'dislike')
    );
    if exists (
      select 1
      from pg_temp.meal_plan_rows r
      join public.recipe_ingredients ri on ri.recipe_id = r.recipe_id
      left join pg_temp.meal_plan_changes c on c.ord = r.ord and c.idx = ri.position
      left join public.foods f
        on f.id = case when c.kind in ('sub', 'swap') then c.substitute_food_id else ri.food_id end
      where r.date >= today
        and c.kind is distinct from 'omit'
        and (
          f.id is null
          or f.status <> 'published'
          or f.alcohol
          or not private.diet_allows(prefs.diet_type, private.food_diet(f.animal))
          or (prefs.eats_pork is distinct from true
              and private.food_contains_pork(f.meat_kind, f.animal, f.gelatin_origin))
          or f.groups && excluded_groups
          or exists (
            select 1 from public.food_dislikes d where d.user_id = current_user_id and d.food_id = f.id
          )
        )
    ) then
      raise exception 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Sperren (Wächter N7 S2, H15): erst die Woche dieser Person (gleichzeitiges erstes Speichern derselben Woche
    -- wartet und ersetzt dann, statt mit „Ungültige Werte“ abzubrechen; derselbe Schlüssel wie in
    -- replace_shopping_list), dann die Einwilligung (FOR SHARE in nutrition_health_basis).
    -- -----------------------------------------------------------------------------------------------------
    perform pg_advisory_xact_lock(hashtext('nutrition_week|' || current_user_id::text || '|' || week::text));
    select * into basis from private.nutrition_health_basis();
    select mp.id, mp.uses_health_data, mp.meal_prep_plan_id, mp.cook_day_started_at into old_plan
    from public.meal_plans mp
    where mp.user_id = current_user_id and mp.week_start = week
    for update;
    -- Gesundheitsbezug (7.1) und Einwilligung (S9)
    uses := basis.targets_basis
      or basis.has_intolerances
      or exists (
        select 1 from pg_temp.meal_plan_rows r
        where r.factor <> 1
          or r.day_status <> 'no_targets'
          or jsonb_array_length(r.swaps) > 0
          -- Ersatz und Weglassen lassen mit Einwilligung auf Unverträglichkeiten schließen (Wächter N3 K5).
          or (basis.consent_ok and (jsonb_array_length(r.substitutions) > 0 or jsonb_array_length(r.omitted) > 0))
      )
      -- Übernommene vergangene Tage tragen den Gesundheitsbezug des alten Plans weiter (Wächter N5a S1).
      or (coalesce(old_plan.uses_health_data, false)
          and exists (select 1 from pg_temp.meal_plan_rows r where r.date < today));
    if uses and not basis.consent_ok then
      raise exception 'Für diesen Essensplan fehlt die Einwilligung.' using errcode = 'insufficient_privilege';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Nährwerte rechnet der SERVER (Wächter N7 Teil 2 H1, wie E1-G4/E2-G2): Gespeichert werden NIE die Werte des
    -- Geräts, sondern
    --   a) vergangene Tage: die Werte derselben Mahlzeit aus dem bisherigen Plan dieser Woche (gleicher Tag, Platz,
    --      Rezept, Version, Faktor und gleiche Zutaten-Änderungen – vom Server damals gerechnet), sonst
    --   b) aus Rezept (aktuelle Fassung, Version muss passen) × Faktor mit Ersatz, Weglassen und Tausch
    --      (private.meal_plan_item_nutrients = scalePortion), gerundet wie toMealPlanPayload (round1).
    -- Bei b) muss die Angabe des Geräts dazu passen (MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE): sonst Ablehnung – eine
    -- ehrliche App rechnet genauso (db-sync.test.ts, pgTAP 33), eine Abweichung heißt veränderte App oder anderer
    -- Bestand. Nicht berechenbar → Ablehnung. Meldungen ohne Werte.
    -- -----------------------------------------------------------------------------------------------------
    if old_plan.id is not null then
      update pg_temp.meal_plan_rows r
      set s_kcal = o.kcal, s_protein = o.protein_g, s_carbs = o.carbs_g, s_fat = o.fat_g, s_checked = false
      from public.meal_plan_items o
      where o.plan_id = old_plan.id
        and r.date < today
        and o.date = r.date and o.slot = r.slot
        and o.recipe_id = r.recipe_id and o.recipe_version = r.recipe_version and o.factor = r.factor
        and o.substitutions = r.substitutions and o.omitted_optional = r.omitted and o.ingredient_swaps = r.swaps;
    end if;
    update pg_temp.meal_plan_rows r
    set s_kcal = private.js_round1(n[1])::numeric, s_protein = private.js_round1(n[2])::numeric,
      s_carbs = private.js_round1(n[3])::numeric, s_fat = private.js_round1(n[4])::numeric, s_checked = true
    from (
      select r2.ord, private.meal_plan_item_nutrients(
        r2.recipe_id, r2.factor::double precision, r2.substitutions, r2.omitted, r2.swaps) as n
      from pg_temp.meal_plan_rows r2
      join public.recipes rc on rc.id = r2.recipe_id and rc.version = r2.recipe_version
      where r2.s_kcal is null
    ) as c
    where c.ord = r.ord and c.n is not null;
    if exists (select 1 from pg_temp.meal_plan_rows r where r.s_kcal is null) then
      raise exception 'Nährwerte des Essensplans lassen sich nicht nachrechnen – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;
    if exists (
      select 1
      from pg_temp.meal_plan_rows r
      join lateral (
        select v from jsonb_array_elements(p_plan -> 'items') with ordinality as x(v, ord) where x.ord = r.ord
      ) as d on true
      where r.s_checked
        and (abs((d.v ->> 'kcal')::numeric - r.s_kcal) > item_kcal_tolerance
          or abs((d.v ->> 'protein_g')::numeric - r.s_protein) > item_macro_tolerance_g
          or abs((d.v ->> 'carbs_g')::numeric - r.s_carbs) > item_macro_tolerance_g
          or abs((d.v ->> 'fat_g')::numeric - r.s_fat) > item_macro_tolerance_g)
    ) then
      raise exception 'Die Nährwerte im Essensplan passen nicht zu den Rezepten – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Mindest-Plausibilität der Tageskalorien (Etappe N7 Teil 2, G-W3, mealPlanDaysBelowFloor in packages/core):
    -- ab heute kein Tag mit Status complete/no_targets unter dem Grundumsatz aus den GESPEICHERTEN Körperdaten
    -- (private.meal_plan_day_kcal_floor). Ohne Einwilligung, ohne Größe/Gewicht oder bei Schwangerschaft gibt es
    -- keinen Grundumsatz (null → keine Prüfung, wie Modus no_targets im Core). Meldung ohne Werte.
    -- -----------------------------------------------------------------------------------------------------
    if basis.consent_ok and exists (
      select 1
      from (
        -- Mit den Werten des SERVERS (H1), nicht mit denen des Geräts.
        select r.date as day, sum(r.s_kcal) as kcal, bool_or(r.day_status = any (checked_day_statuses)) as checked
        from pg_temp.meal_plan_rows r
        where r.date >= today
        group by 1
      ) as d
      where d.checked
        and d.kcal + kcal_tolerance < private.meal_plan_day_kcal_floor(current_user_id, d.day, today)
    ) then
      raise exception 'Der Essensplan liegt an einem Tag unter deinem Grundumsatz – bitte neu erstellen.'
        using errcode = 'invalid_parameter_value';
    end if;

    -- -----------------------------------------------------------------------------------------------------
    -- Speichern: Plan der Woche ersetzen (höchstens einer je Woche); Kochtag-Start bleibt nur beim selben
    -- Meal-Prep-Plan.
    -- -----------------------------------------------------------------------------------------------------
    if old_plan.id is not null then
      delete from public.meal_plans where id = old_plan.id;
    end if;
    insert into public.meal_plans (
      user_id, week_start, status, engine_version, variant, meal_prep_plan_id, inputs, uses_health_data,
      auto_adjusted, recipes_changed, cook_day_started_at
    )
    values (
      current_user_id, week, 'active', (p_plan ->> 'engine_version')::smallint, (p_plan ->> 'variant')::integer,
      p_plan ->> 'meal_prep_plan_id', p_plan -> 'inputs', uses, coalesce(p_auto_adjusted, false),
      coalesce(p_recipes_changed, false),
      case
        when old_plan.id is not null and old_plan.meal_prep_plan_id is not null
          and old_plan.meal_prep_plan_id = p_plan ->> 'meal_prep_plan_id'
          then old_plan.cook_day_started_at
      end
    )
    returning id into new_plan_id;

    insert into public.meal_plan_items (
      plan_id, user_id, date, slot, role, recipe_id, recipe_version, title_de, factor, kcal, protein_g, carbs_g,
      fat_g, substitutions, omitted_optional, ingredient_swaps, is_fill, prep_kind, cook_date, storage,
      meal_prep_plan_id, day_status, user_chosen
    )
    select new_plan_id, current_user_id, (x.v ->> 'date')::date, x.v ->> 'slot', x.v ->> 'role', x.v ->> 'recipe_id',
      (x.v ->> 'recipe_version')::integer, x.v ->> 'title_de', (x.v ->> 'factor')::numeric,
      -- Nährwerte vom Server (H1), nie die Angabe des Geräts.
      r.s_kcal, r.s_protein, r.s_carbs, r.s_fat, x.v -> 'substitutions',
      x.v -> 'omitted_optional', x.v -> 'ingredient_swaps', (x.v ->> 'is_fill')::boolean,
      x.v ->> 'prep_kind', (x.v ->> 'cook_date')::date, x.v ->> 'storage', x.v ->> 'meal_prep_plan_id',
      x.v ->> 'day_status', coalesce((x.v ->> 'user_chosen')::boolean, false)
    from jsonb_array_elements(p_plan -> 'items') with ordinality as x(v, ord)
    join pg_temp.meal_plan_rows r on r.ord = x.ord;
  exception
    when data_exception or integrity_constraint_violation then
      -- Keine Werte in der Meldung (Fehler der Umwandlungen/CHECKs nennen sonst die Zeile).
      if sqlstate = '22023' then
        raise exception using errcode = sqlstate, message = sqlerrm;
      end if;
      raise exception 'Ungültige Werte im Essensplan.' using errcode = sqlstate;
  end;

  -- Einkaufsliste der Woche zeigt auf den neuen Plan (der alte ist ersetzt).
  update public.shopping_lists set meal_plan_id = new_plan_id
  where user_id = current_user_id and week_start = week;
  -- Löschfrist (G-N7-2): ältere Wochen dieser Person löschen – unabhängig von pg_cron.
  perform private.purge_expired_nutrition_weeks(current_user_id);
  return new_plan_id;
end;
$$;

revoke all on function public.save_meal_plan(jsonb, boolean, boolean) from public, anon;
grant execute on function public.save_meal_plan(jsonb, boolean, boolean) to authenticated;
