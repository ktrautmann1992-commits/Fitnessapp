-- Phase 4b · Etappe B · Wochen-Invarianten in SQL (docs/PLAN-PHASE-4B.md 4.6 Punkt 3 und 5, 5.2 „Tausch-Regel“ Punkt 6,
-- Wächter B2 und S-n1). Rein additiv, nur Hilfsfunktionen im Schema private (kein Recht für anon/authenticated):
-- 1. private.week_invariant_violations(sessions, options) = checkWeekInvariants() aus
--    packages/core/src/adjust/invariants.ts – gleiche Eingabe (Einheiten als JSON wie StoredSession, Optionen mit den
--    Namen von WeekInvariantOptions), gleiche Ausgabe (Liste der Verstöße mit denselben Schlüsseln). Dass Core und SQL
--    gleich entscheiden, beweisen die Fixtures (packages/core/src/adjust/fixtures/invariants.json →
--    supabase/tests/50_week_invariants.test.sql, aktuell gehalten von db-sync.test.ts).
-- 2. private.new_week_invariant_violations(vorher, nachher, …) = newInvariantViolations(): nur NEU entstandene bzw.
--    VERSCHLIMMERTE Verstöße (Multimenge je Schlüssel Regel | Messgröße | Block | Woche | Einheit | Stelle | Übung;
--    verschlimmert = Überschreitung value − limit wächst, auch wenn nur die Grenze sinkt).
-- 3. private.apply_plan_change_json(sessions, change) = applyPlanChange() (Nachher-Werte auf Einheiten anwenden).
-- 4. private.plan_sessions_json(plan_id): Einheiten eines Plans als JSON wie storedSessionFromRows() (sortiert wie die
--    Engine: Datum, dann id; training_phase nur bei Wettkampf-Einheiten).
-- 5. private.plan_load_weeks(plan_id) = loadWeeksBeforeDeload(Level, vorsichtig); vorsichtig = ohne Gesundheits-Check
--    bzw. ohne Einwilligung (uses_health_data = false) oder mit Auffälligkeiten (medical_notice), wie planSafetyRules().
-- Alle Konstanten mit „sync:“ gleicht db-sync.test.ts mit packages/core/src/constants.ts ab.

-- ---------------------------------------------------------------------------------------------------------
-- Hilfen
-- ---------------------------------------------------------------------------------------------------------
-- ISO-Wochentag einer Einheit (ursprünglicher Tag bei Verschiebung) wie weekdayOf() in invariants.ts.
create or replace function private.adjust_weekday(p_session jsonb)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(isodow from coalesce((p_session ->> 'original_date')::date, (p_session ->> 'scheduled_on')::date))::integer
$$;
revoke all on function private.adjust_weekday(jsonb) from public, anon, authenticated;

-- Ein Verstoß als JSON (Schlüssel wie InvariantViolation; fehlende optionale Felder entfallen).
create or replace function private.invariant_violation(
  p_code text, p_measure text, p_week jsonb, p_value numeric, p_limit numeric,
  p_exercise_id text default null, p_session_ref text default null, p_order_no jsonb default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'code', p_code,
    'blockNo', p_week -> 'block_no',
    'weekNo', p_week -> 'week_no',
    'monday', p_week -> 'monday',
    'value', trim_scale(p_value),
    'limit', trim_scale(p_limit),
    'exerciseId', p_exercise_id,
    'sessionRef', p_session_ref,
    'orderNo', case when jsonb_typeof(p_order_no) = 'number' then p_order_no end,
    'measure', p_measure
  ))
$$;
revoke all on function private.invariant_violation(text, text, jsonb, numeric, numeric, text, text, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1. checkWeekInvariants()
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.week_invariant_violations(p_sessions jsonb, p_options jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- sync: DELOAD_DOSAGE.setsFactor, DELOAD_DOSAGE.rpeReduction, TEMPLATE_DOSAGE_LIMITS.rpe.min,
  -- ENDURANCE_SESSION_LIMITS.minSessionMinutes, MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION (in Prozent),
  -- ENDURANCE_DELOAD_VOLUME_FACTOR (in Prozent), COMPETITION_DELOAD_MAX_FACTOR (in Prozent) in packages/core
  deload_sets_factor constant numeric := 0.5;
  deload_rpe_reduction constant numeric := 2;
  rpe_min constant numeric := 5;
  min_session_minutes constant integer := 10;
  increase_percent constant integer := 110;
  deload_volume_percent constant integer := 60;
  competition_deload_percent constant integer := 75;
  -- Phasen des Wettkampfplans mit eigenem (größerem) Erholungs-Faktor (COMPETITION_OWN_FACTOR_PHASES).
  own_factor_phases constant text[] := array['taper', 'race_week', 'recovery'];
  max_load_weeks integer := (p_options ->> 'maxLoadWeeks')::integer;
  from_monday date := (p_options ->> 'fromMonday')::date;
  plan_start date := (p_options ->> 'planStart')::date;
  swapped jsonb := coalesce(p_options -> 'swappedWeeks', '[]'::jsonb);
  run integer := coalesce((p_options ->> 'carriedLoadWeeks')::integer, 0);
  reference numeric;
  weeks jsonb;
  w jsonb;
  prev jsonb;
  week_count integer;
  i integer;
  minutes numeric;
  prev_minutes numeric;
  lim numeric;
  monday date;
  partial_first boolean := false;
  first_start date;
  load_before jsonb := '[]'::jsonb;
  result jsonb := '[]'::jsonb;
  found_block jsonb;
  blk record;
begin
  -- Plan-Wochen (planWeeks): je (block_no, week_no), Einheiten nach Datum (bei gleichem Datum Eingabe-Reihenfolge),
  -- Wochen nach Block und Woche. Montag aus dem frühesten Datum; Erholungswoche = alle Einheiten is_deload; Phase = die
  -- erste Einheit mit dem Schlüssel training_phase.
  select coalesce(jsonb_agg(x.week order by x.block_no, x.week_no), '[]'::jsonb)
  into weeks
  from (
    select (s.x ->> 'block_no')::integer as block_no, (s.x ->> 'week_no')::integer as week_no,
      jsonb_build_object(
        'block_no', (s.x ->> 'block_no')::integer,
        'week_no', (s.x ->> 'week_no')::integer,
        'monday', to_jsonb(date_trunc('week', min((s.x ->> 'scheduled_on')::date))::date),
        'is_deload', bool_and((s.x ->> 'is_deload')::boolean),
        'is_week_zero', (s.x ->> 'week_no')::integer = 0,
        'phase', (array_agg(s.x -> 'training_phase' order by (s.x ->> 'scheduled_on')::date, s.ord)
                  filter (where s.x ? 'training_phase'))[1],
        'minutes', coalesce(sum((s.x ->> 'estimated_minutes')::numeric) filter (where s.x ->> 'kind' = 'endurance'), 0),
        'sets', coalesce(sum((select coalesce(sum((e ->> 'sets')::numeric), 0)
                              from jsonb_array_elements(coalesce(s.x -> 'exercises', '[]'::jsonb)) e)), 0),
        'sessions', jsonb_agg(s.x order by (s.x ->> 'scheduled_on')::date, s.ord)
      ) as week
    from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb)) with ordinality as s(x, ord)
    group by 1, 2
  ) x;
  week_count := jsonb_array_length(weeks);
  if week_count = 0 then
    return result;
  end if;

  -- Angebrochene erste Woche (Planstart nicht am Montag, keine Woche 0, Block 1) ist nie Ausdauer-Bezug.
  w := weeks -> 0;
  if not (w ->> 'is_week_zero')::boolean and (w ->> 'block_no')::integer = 1 then
    first_start := coalesce(plan_start, (w -> 'sessions' -> 0 ->> 'scheduled_on')::date);
    partial_first := first_start is not null and extract(isodow from first_start) <> 1
                     and (w ->> 'monday')::date <= first_start;
  end if;

  for i in 0 .. week_count - 1 loop
    w := weeks -> i;
    monday := (w ->> 'monday')::date;
    minutes := (w ->> 'minutes')::numeric;
    if (w ->> 'is_week_zero')::boolean then
      load_before := load_before || (w -> 'sessions');
      continue;
    end if;

    if (w ->> 'is_deload')::boolean then
      run := 0;
      if from_monday is null or monday >= from_monday then
        if reference is not null then
          lim := floor(floor(reference) * case when (w ->> 'phase') = any (own_factor_phases)
                                               then competition_deload_percent else deload_volume_percent end / 100);
          if minutes > lim then
            result := result || private.invariant_violation('deload_endurance', 'minutes', w, minutes, lim);
          end if;
        end if;
        -- Je Übung höchstens ceil(0,5 × größte Satzzahl) bzw. RPE ≤ max(5, größtes RPE − 2) einer Belastungswoche davor.
        result := result || coalesce((
          with ref as (
            select e ->> 'exercise_id' as exercise_id, max((e ->> 'sets')::numeric) as sets,
                   max((e ->> 'rpe_target')::numeric) as rpe
            from jsonb_array_elements(load_before) s, jsonb_array_elements(coalesce(s -> 'exercises', '[]'::jsonb)) e
            group by 1
          ),
          items as (
            select s.x as session, e.x as exercise, s.ord as so, e.ord as eo,
                   greatest(1, ceil(r.sets * deload_sets_factor)) as sets_limit,
                   greatest(rpe_min, r.rpe - deload_rpe_reduction) as rpe_limit
            from jsonb_array_elements(w -> 'sessions') with ordinality s(x, ord)
            cross join jsonb_array_elements(coalesce(s.x -> 'exercises', '[]'::jsonb)) with ordinality e(x, ord)
            join ref r on r.exercise_id = e.x ->> 'exercise_id'
          )
          select jsonb_agg(v order by so, eo, m)
          from (
            select private.invariant_violation('deload_sets', 'sets', w, (exercise ->> 'sets')::numeric, sets_limit,
                     exercise ->> 'exercise_id', coalesce(session ->> 'id', session ->> 'scheduled_on'),
                     exercise -> 'order_no') as v, so, eo, 1 as m
            from items where (exercise ->> 'sets')::numeric > sets_limit
            union all
            select private.invariant_violation('deload_rpe', 'rpe', w, (exercise ->> 'rpe_target')::numeric, rpe_limit,
                     exercise ->> 'exercise_id', coalesce(session ->> 'id', session ->> 'scheduled_on'),
                     exercise -> 'order_no'), so, eo, 2
            from items where (exercise ->> 'rpe_target')::numeric > rpe_limit
          ) x
        ), '[]'::jsonb);
      end if;
      continue;
    end if;

    -- Belastungswoche
    run := run + 1;
    if from_monday is null or monday >= from_monday then
      if run > max_load_weeks then
        result := result || private.invariant_violation('too_many_load_weeks', 'weeks', w, run, max_load_weeks);
      end if;
      if reference is not null then
        lim := floor(floor(reference) * increase_percent / 100);
        if minutes > lim then
          result := result || private.invariant_violation('endurance_increase', 'minutes', w, minutes, lim);
        end if;
      end if;
      -- Getauschte Woche D (deload_forward): nie über der Vorwoche D − 1, wenn diese eine Belastungswoche ist.
      prev := case when i > 0 then weeks -> (i - 1) end;
      if exists (
           select 1 from jsonb_array_elements(swapped) x
           where (x ->> 'blockNo')::integer = (w ->> 'block_no')::integer
             and (x ->> 'weekNo')::integer = (w ->> 'week_no')::integer)
         and prev is not null
         and not (prev ->> 'is_deload')::boolean and not (prev ->> 'is_week_zero')::boolean then
        prev_minutes := (prev ->> 'minutes')::numeric;
        if minutes > prev_minutes then
          result := result || private.invariant_violation('swapped_week_above_previous', 'minutes', w, minutes,
                                                          prev_minutes);
        end if;
        -- Je Einheit das Gegenstück in D − 1 (swappedCounterpart): gleiche Vorlagen-Einheit am selben Wochentag, sonst
        -- die erste gleiche Vorlagen-Einheit, sonst gleiche Art am selben Wochentag. Gleiche Übung an gleicher Stelle →
        -- deren Sätze/RPE, sonst die kleinsten Sätze und das kleinste RPE der Übung in D − 1.
        result := result || coalesce((
          with prevs as (
            select p.x, p.ord from jsonb_array_elements(prev -> 'sessions') with ordinality p(x, ord)
          ),
          pairs as (
            select c.x as session, c.ord as so,
              coalesce(
                (select p.x from prevs p
                 where p.x -> 'kind' is not distinct from c.x -> 'kind'
                   and p.x -> 'template_day_index' is distinct from 'null'::jsonb
                   and p.x -> 'template_day_index' is not distinct from c.x -> 'template_day_index'
                   and private.adjust_weekday(p.x) = private.adjust_weekday(c.x)
                 order by p.ord limit 1),
                (select p.x from prevs p
                 where p.x -> 'kind' is not distinct from c.x -> 'kind'
                   and p.x -> 'template_day_index' is distinct from 'null'::jsonb
                   and p.x -> 'template_day_index' is not distinct from c.x -> 'template_day_index'
                 order by p.ord limit 1),
                (select p.x from prevs p
                 where p.x -> 'kind' is not distinct from c.x -> 'kind'
                   and private.adjust_weekday(p.x) = private.adjust_weekday(c.x)
                 order by p.ord limit 1)
              ) as twin
            from jsonb_array_elements(w -> 'sessions') with ordinality c(x, ord)
          ),
          lims as (
            select pr.session, pr.so, e.x as exercise, e.ord as eo,
              coalesce(
                (select jsonb_build_object('sets', t.x -> 'sets', 'rpe', t.x -> 'rpe_target')
                 from jsonb_array_elements(coalesce(pr.twin -> 'exercises', '[]'::jsonb)) with ordinality t(x, ord)
                 where t.x -> 'order_no' is not distinct from e.x -> 'order_no'
                   and t.x -> 'exercise_id' is not distinct from e.x -> 'exercise_id'
                 order by t.ord limit 1),
                (select jsonb_build_object('sets', min((q ->> 'sets')::numeric), 'rpe', min((q ->> 'rpe_target')::numeric))
                 from prevs p2, jsonb_array_elements(coalesce(p2.x -> 'exercises', '[]'::jsonb)) q
                 where q -> 'exercise_id' is not distinct from e.x -> 'exercise_id'
                 having count(*) > 0)
              ) as lim_json
            from pairs pr
            cross join jsonb_array_elements(coalesce(pr.session -> 'exercises', '[]'::jsonb)) with ordinality e(x, ord)
          )
          select jsonb_agg(v order by so, eo, m)
          from (
            select private.invariant_violation('swapped_week_above_previous', 'sets', w, (exercise ->> 'sets')::numeric,
                     (lim_json ->> 'sets')::numeric, exercise ->> 'exercise_id',
                     coalesce(session ->> 'id', session ->> 'scheduled_on'), exercise -> 'order_no') as v, so, eo, 1 as m
            from lims where lim_json is not null and (exercise ->> 'sets')::numeric > (lim_json ->> 'sets')::numeric
            union all
            select private.invariant_violation('swapped_week_above_previous', 'rpe', w,
                     (exercise ->> 'rpe_target')::numeric, (lim_json ->> 'rpe')::numeric, exercise ->> 'exercise_id',
                     coalesce(session ->> 'id', session ->> 'scheduled_on'), exercise -> 'order_no'), so, eo, 2
            from lims where lim_json is not null and (exercise ->> 'rpe_target')::numeric > (lim_json ->> 'rpe')::numeric
          ) x
        ), '[]'::jsonb);
        if (w ->> 'sets')::numeric > (prev ->> 'sets')::numeric then
          result := result || private.invariant_violation('swapped_week_sets_total', 'sets', w,
                                                          (w ->> 'sets')::numeric, (prev ->> 'sets')::numeric);
        end if;
      end if;
    end if;
    load_before := load_before || (w -> 'sessions');
    if not (i = 0 and partial_first) then
      reference := case when minutes >= min_session_minutes then minutes end;
    end if;
  end loop;

  -- Höchstens ein deload_forward je Block (gemeldet an der ersten Woche des Blocks).
  for blk in
    select (x ->> 'blockNo')::integer as block_no, count(*) as n
    from jsonb_array_elements(swapped) x
    group by 1
    having count(*) > 1
  loop
    select v into found_block
    from jsonb_array_elements(weeks) v
    where (v ->> 'block_no')::integer = blk.block_no
    order by (v ->> 'week_no')::integer
    limit 1;
    if found_block is not null and (from_monday is null or (found_block ->> 'monday')::date >= from_monday) then
      result := result || private.invariant_violation('second_deload_forward_in_block', 'count', found_block,
                                                      blk.n, 1);
    end if;
    found_block := null;
  end loop;
  return result;
end;
$$;
revoke all on function private.week_invariant_violations(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 2. newInvariantViolations()
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.new_week_invariant_violations(
  p_before jsonb, p_after jsonb, p_options jsonb, p_options_before jsonb default null
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with b as (
    select concat_ws('|', v ->> 'code', v ->> 'measure', v ->> 'blockNo', v ->> 'weekNo',
                     coalesce(v ->> 'sessionRef', ''), coalesce(v ->> 'orderNo', ''), coalesce(v ->> 'exerciseId', '')) as k,
           (v ->> 'value')::numeric - (v ->> 'limit')::numeric as x
    from jsonb_array_elements(private.week_invariant_violations(p_before, coalesce(p_options_before, p_options))) v
  ),
  a as (
    select v,
           concat_ws('|', v ->> 'code', v ->> 'measure', v ->> 'blockNo', v ->> 'weekNo',
                     coalesce(v ->> 'sessionRef', ''), coalesce(v ->> 'orderNo', ''), coalesce(v ->> 'exerciseId', '')) as k,
           (v ->> 'value')::numeric - (v ->> 'limit')::numeric as x
    from jsonb_array_elements(private.week_invariant_violations(p_after, p_options)) v
  ),
  bn as (select k, x, row_number() over (partition by k order by x desc) as rn from b),
  an as (select v, k, x, row_number() over (partition by k order by x desc) as rn from a)
  select coalesce(jsonb_agg(an.v order by an.k, an.rn), '[]'::jsonb)
  from an
  left join bn on bn.k = an.k and bn.rn = an.rn
  where bn.k is null or an.x > bn.x
$$;
revoke all on function private.new_week_invariant_violations(jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. applyPlanChange(): Nachher-Werte (change.sessions) auf Einheiten anwenden; unbekannte ids ohne Wirkung.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.apply_plan_change_json(p_sessions jsonb, p_change jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    case
      when c.x is null then s.x
      else (s.x || (c.x - 'id' - 'exercises'))
        || case when c.x ? 'exercises' then jsonb_build_object('exercises', (
             select coalesce(jsonb_agg(case when ec.y is null then e.x else e.x || (ec.y - 'order_no') end
                                       order by e.ord), '[]'::jsonb)
             from jsonb_array_elements(coalesce(s.x -> 'exercises', '[]'::jsonb)) with ordinality e(x, ord)
             left join lateral (
               select y from jsonb_array_elements(c.x -> 'exercises') with ordinality q(y, ord)
               where q.y -> 'order_no' = e.x -> 'order_no'
               order by q.ord limit 1
             ) ec on true))
           else '{}'::jsonb end
    end
    order by s.ord), '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_sessions, '[]'::jsonb)) with ordinality s(x, ord)
  left join lateral (
    select y as x from jsonb_array_elements(coalesce(p_change -> 'sessions', '[]'::jsonb)) with ordinality q(y, ord)
    where q.y ->> 'id' = s.x ->> 'id'
    order by q.ord desc limit 1
  ) c on true
$$;
revoke all on function private.apply_plan_change_json(jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 4. Einheiten eines Plans als JSON (storedSessionFromRows), sortiert wie computeLiveAdjustments (Datum, dann id).
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.plan_sessions_json(p_plan_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'status', s.status,
      'block_no', s.block_no,
      'week_no', s.week_no,
      'scheduled_on', s.scheduled_on,
      'original_date', s.original_date,
      'is_deload', s.is_deload,
      'is_intro_week', s.is_intro_week,
      'kind', s.kind,
      'template_day_index', s.template_day_index,
      'estimated_minutes', s.estimated_minutes,
      'workout_steps', s.workout_steps,
      'target_distance_m', s.target_distance_m,
      -- Art der Wettkampf-Einheit (nur für die Prüfung „Schritte nur bei lockeren Arten“; die Invarianten lesen sie nicht).
      'workout_type', s.workout_type,
      'exercises', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'order_no', e.order_no, 'exercise_id', e.exercise_id, 'exercise_name_de', e.exercise_name_de,
                 'sets', e.sets, 'rpe_target', trim_scale(e.rpe_target)) order by e.order_no), '[]'::jsonb)
        from public.planned_exercises e
        where e.session_id = s.id
      )
    )
    -- Felder des Wettkampfplans nur bei Art und Phase (competitionFieldsFromRow).
    || case when s.workout_type is not null and s.training_phase is not null
            then jsonb_build_object('training_phase', s.training_phase) else '{}'::jsonb end
    order by s.scheduled_on, s.id), '[]'::jsonb)
  from public.planned_sessions s
  where s.plan_id = p_plan_id
$$;
revoke all on function private.plan_sessions_json(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 5. loadWeeksBeforeDeload(Level, vorsichtig) eines gespeicherten Plans.
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.plan_load_weeks(p_plan_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  -- sync: DELOAD_SCHEDULE in packages/core/src/constants.ts
  select case
    when not p.uses_health_data or p.medical_notice then 4
    when p.inputs ->> 'experienceLevel' = 'beginner' then 5
    else 4
  end
  from public.user_plans p
  where p.id = p_plan_id
$$;
revoke all on function private.plan_load_weeks(uuid) from public, anon, authenticated;
