-- Fit im Alter · Etappe FA1 · Server-Prüfungen für das Ziel `active_aging` (docs/PLAN-FIT-IM-ALTER.md 8.3, Wächter B3).
-- Die Enum-Werte stehen in 20261021150000_active_aging_enums.sql (eigene Datei). Nur additiv bzw. `create or replace`
-- mit GLEICHER Signatur; keine Tabelle, keine Daten, kein neues Gesundheitsdatum. Abgleich mit packages/core in
-- db-sync.test.ts, Gegenproben in supabase/tests/80_active_aging.test.sql.
--  1. private.goal_pair_allowed: neues Paar Fit im Alter → Abnehmen (FA-G6, = GOAL_PAIR_RULES). Der Autoclear-Trigger
--     goals_clear_stale_secondary und der Paar-CHECK auf goals nutzen die Funktion und gelten damit sofort mit.
--  2. private.plan_load_weeks: Pläne mit dem Ziel haben die Erholungswoche nach 4 Belastungswochen
--     (= loadWeeksBeforeDeload(Level, cautiousProgression(rules)), ACTIVE_AGING_RULES.deloadLoadWeeks, Wächter N1).
--  3. private.fast_increase_exclusion: neuer Grund 'active_aging' (= FAST_INCREASE_EXCLUSIONS) – R1 „schneller
--     steigern“ nie bei dem Ziel (Plan 8.1 Nr. 8). Neueste Fassung aus 20261019130000_live_adjust_r1_exclusions.sql
--     unverändert übernommen und nur ergänzt; apply_plan_adjustments ruft sie schon auf (bleibt unverändert).
--  4. Schutz-Trigger auf planned_exercises und planned_sessions (statt Neufassung von insert_plan_sessions /
--     append_plan_block): Sie gelten für JEDEN Schreibweg – Plan speichern, Folgeblock, Live-Anpassung, Tausch – und
--     prüfen bei Plänen mit dem Ziel `active_aging` (user_plans.inputs.goalType):
--       - Übungen: RPE-Ziel höchstens 6, Haltezeit höchstens 30 s, keine Übung mit ausgeschlossenem Merkmal
--         (ACTIVE_AGING_RULES.excludedCautionTags),
--       - Einheiten: Ausdauer höchstens Anstrengung 3, nur Gehen/Rad/Schwimmen (kein Laufen), keine Wettkampf-Art.
--     Fehler: fester deutscher Text ohne Werte, errcode check_violation (insert_plan_sessions macht daraus wie bisher
--     „Ungültige Werte im Plan.“).
-- Abweichung vom Plan 8.3 Nr. 1: Mindestzahl Gleichgewicht/Beweglichkeit je Einheit und `support` prüft der Server
-- erst mit den Vorlagen-Feldern aus Etappe FA2/FA3 (heute gibt es weder Gleichgewichtsübungen noch das Feld).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Erlaubte Paare Hauptziel → Nebenziel (= GOAL_PAIR_RULES / GOAL_COMBINATIONS in packages/core)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.goal_pair_allowed(p_primary public.goal_type, p_secondary public.goal_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_primary::text, p_secondary::text) in (
    ('fat_loss', 'muscle_gain'),
    ('fat_loss', 'endurance'),
    ('definition', 'endurance'),
    ('muscle_gain', 'fat_loss'),
    ('muscle_gain', 'endurance'),
    ('general_fitness', 'fat_loss'),
    ('general_fitness', 'endurance'),
    ('endurance', 'fat_loss'),
    ('endurance', 'definition'),
    ('endurance', 'muscle_gain'),
    ('active_aging', 'fat_loss')
  )
$$;

revoke all on function private.goal_pair_allowed(public.goal_type, public.goal_type) from public;
grant execute on function private.goal_pair_allowed(public.goal_type, public.goal_type) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. loadWeeksBeforeDeload(Level, vorsichtig oder Fit im Alter) eines gespeicherten Plans
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
    when p.inputs ->> 'goalType' = 'active_aging' then 4
    when p.inputs ->> 'experienceLevel' = 'beginner' then 5
    else 4
  end
  from public.user_plans p
  where p.id = p_plan_id
$$;
revoke all on function private.plan_load_weeks(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 3. R1-Ausschluss je Person und Plan – neuer Grund 'active_aging'
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.fast_increase_exclusion(p_user uuid, p_plan_id uuid, p_today date)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  -- sync: AGE_PLAN_RULES.minor.belowAge, AGE_PLAN_RULES.senior.fromAge in packages/core/src/constants.ts
  minor_below_age constant integer := 18;
  senior_from_age constant integer := 65;
  -- sync: EXPERIENCE_LEVELS ohne 'beginner' (packages/core/src/enums.ts); unbekannte Stufe zählt als Einsteiger.
  non_beginner_levels constant text[] := array['advanced', 'competitive'];
  v_plan record;
  latest_flags text[];
  age_years integer;
  current_on date;
  current_block integer;
begin
  select p.uses_health_data, p.medical_notice, p.inputs ->> 'experienceLevel' as level,
         p.inputs ->> 'goalType' as goal
  into v_plan
  from public.user_plans p
  where p.id = p_plan_id and p.user_id = p_user;
  if not found then
    return 'cautious_plan';
  end if;

  -- Vorsichtiger Plan (Gesundheits-Flag oder kein Check).
  if not v_plan.uses_health_data or v_plan.medical_notice then
    return 'cautious_plan';
  end if;
  select h.flags into latest_flags
  from public.health_screening h
  where h.user_id = p_user
  order by h.created_at desc
  limit 1;
  if not found or cardinality(latest_flags) > 0
     or not private.has_valid_consent_for(p_user, 'health_data') then
    return 'cautious_plan';
  end if;

  -- Fit im Alter (FA1, ACTIVE_AGING_RULES.fastIncrease = false): Ziel des Plans ODER aktuelles Hauptziel.
  if v_plan.goal = 'active_aging'
     or exists (select 1 from public.goals g where g.user_id = p_user and g.goal_type = 'active_aging') then
    return 'active_aging';
  end if;

  -- Alter am Stichtag (kein Profil → wie unter 18 behandelt, sicher).
  select extract(year from age(p_today, pr.birth_date))::integer into age_years
  from public.profiles pr
  where pr.user_id = p_user;
  if age_years is null or age_years < minor_below_age then
    return 'minor';
  end if;
  if age_years >= senior_from_age then
    return 'senior';
  end if;

  -- Einsteiger im ersten Block.
  if v_plan.level is null or not v_plan.level = any (non_beginner_levels) then
    select coalesce(min(s.scheduled_on) filter (where s.scheduled_on >= p_today), max(s.scheduled_on))
    into current_on
    from public.planned_sessions s
    where s.plan_id = p_plan_id;
    select min(s.block_no) into current_block
    from public.planned_sessions s
    where s.plan_id = p_plan_id and s.scheduled_on = current_on;
    if current_block is null or current_block <= 1 then
      return 'beginner_first_block';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.fast_increase_exclusion(uuid, uuid, date) from public, anon, authenticated;


-- ---------------------------------------------------------------------------------------------------------
-- 4. Schutz-Trigger für Pläne mit dem Ziel „Fit im Alter“
-- ---------------------------------------------------------------------------------------------------------
-- Ist der Plan ein „Fit im Alter“-Plan? (Ziel aus den gespeicherten Angaben; kein Plan → false)
create or replace function private.is_active_aging_plan(p_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.inputs ->> 'goalType' = 'active_aging' from public.user_plans p where p.id = p_plan_id),
    false
  )
$$;
revoke all on function private.is_active_aging_plan(uuid) from public, anon, authenticated;

create or replace function private.planned_exercise_active_aging_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: ACTIVE_AGING_RULES in packages/core/src/constants.ts (rpeMax, strengthHoldMaxS, excludedCautionTags)
  active_aging_rpe_max constant numeric := 6;
  active_aging_hold_max_s constant integer := 30;
  active_aging_excluded_tags constant public.caution_tag[] := array[
    'high_impact', 'spinal_loading', 'overhead', 'long_supine', 'high_skill', 'floor_transfer', 'spinal_flexion',
    'trunk_rotation'
  ]::public.caution_tag[];
  v_plan_id uuid;
begin
  select s.plan_id into v_plan_id from public.planned_sessions s where s.id = new.session_id;
  if v_plan_id is null or not private.is_active_aging_plan(v_plan_id) then
    return new;
  end if;
  if new.rpe_target > active_aging_rpe_max
     or coalesce(new.duration_s, 0) > active_aging_hold_max_s
     or exists (
       select 1 from public.exercises x
       where x.id = new.exercise_id and x.caution_tags && active_aging_excluded_tags
     ) then
    raise exception 'Diese Übung passt nicht zum Ziel „Fit im Alter“.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.planned_exercise_active_aging_guard() from public, anon, authenticated;

create trigger planned_exercises_active_aging_guard
  before insert or update of exercise_id, rpe_target, duration_s, session_id on public.planned_exercises
  for each row execute function private.planned_exercise_active_aging_guard();

create or replace function private.planned_session_active_aging_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: ACTIVE_AGING_RULES.enduranceEffortMax (= ENDURANCE_EFFORT.cautiousMax) in packages/core/src/constants.ts
  active_aging_effort_max constant integer := 3;
begin
  if not private.is_active_aging_plan(new.plan_id) then
    return new;
  end if;
  if new.workout_type is not null
     or (new.kind = 'endurance'
         and (new.effort_target > active_aging_effort_max or new.endurance_modality = 'run')) then
    raise exception 'Diese Einheit passt nicht zum Ziel „Fit im Alter“.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.planned_session_active_aging_guard() from public, anon, authenticated;

create trigger planned_sessions_active_aging_guard
  before insert or update of kind, effort_target, endurance_modality, workout_type, plan_id on public.planned_sessions
  for each row execute function private.planned_session_active_aging_guard();
