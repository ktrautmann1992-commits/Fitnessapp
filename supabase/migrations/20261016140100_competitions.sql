-- Phase 10 · Etappe WP3 · Datenmodell Wettkampf (docs/PLAN-PHASE-10.md Abschnitt 7). Nur additiv:
-- 1. Hilfsfunktionen für CHECK-Bedingungen (Distanz, Zeit-Plausibilität, Schritte einer Einheit),
-- 2. neue Tabelle competitions (Wettkampf + Plan-Bezug für Folgeblöcke), RLS nur eigene Zeilen, schreiben nur über
--    die Funktionen der nächsten Migration (save_competition, cancel_competition, complete_competition,
--    delete_competition),
-- 3. planned_sessions: neue Spalten workout_type, training_phase, target_distance_m, workout_steps (alle nullable,
--    alte Zeilen bleiben gültig); CHECK effort_target von 1–4 auf 1–8 GELOCKERT, „über 4 nur bei harter Art“ und
--    „harte Art in einer Erholungswoche nur im Tapering“ als neue Bedingung.
-- Grenzen = packages/core/src/constants.ts (COMPETITION_INPUT_LIMITS, COMPETITION_DISTANCE_M, COMPETITION_OWN_START,
-- COMPETITION_START_REFERENCE, COMPETITION_EFFORT_LIMITS, COMPETITION_PACE.distanceM, COMPETITION_RECORD_LIMITS,
-- WORKOUT_STEP_LIMITS), abgeglichen in db-sync.test.ts.
--
-- Gesundheitsbezug: Der Wettkampf selbst (Name, Disziplin, Datum, Ziel, Referenzzeit) ist KEIN Gesundheitsdatum
-- (Plan Abschnitt 7/13) und braucht keine Einwilligung. Der Plan-Bezug (effective_goal, eigener Startumfang,
-- Tagebuch-Bezug mit Startgruppe) ist aus dem Gesundheits-Check abgeleitet (vorsichtige Startgruppe bei Flag/Alter,
-- „nur Ankommen“) und gibt es nur zusammen mit einem Wettkampfplan, der den Check voraussetzt (Tabelle 3.3). Er wird
-- deshalb wie user_plans.uses_health_data behandelt: nur mit gültiger Einwilligung health_data (save_competition
-- sperrt sie FOR SHARE), beim Widerruf geleert (private.consents_after_revoke) – der Wettkampf selbst bleibt.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Hilfsfunktionen (immutable, ohne Fehler bei jeder Eingabe; authenticated braucht EXECUTE, weil CHECKs auch
--    beim Verschieben einer Einheit – Spalten-Recht scheduled_on/status – neu geprüft werden)
-- ---------------------------------------------------------------------------------------------------------

-- Distanz der Disziplin in Metern (COMPETITION_DISTANCE_M; Halbmarathon/Marathon laut World Athletics).
create or replace function private.competition_distance_m(p_discipline public.competition_discipline)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_discipline
    when '5k' then 5000
    when '10k' then 10000
    when 'half_marathon' then 21097.5
    when 'marathon' then 42195
  end::numeric
$$;

revoke all on function private.competition_distance_m(public.competition_discipline) from public;
grant execute on function private.competition_distance_m(public.competition_discipline) to authenticated, service_role;

-- Ziel- bzw. Referenzzeit plausibel je Distanz (COMPETITION_INPUT_LIMITS.timeS, Sekunden).
create or replace function private.competition_time_plausible(
  p_discipline public.competition_discipline,
  p_time_s integer
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case p_discipline
    when '5k' then p_time_s between 720 and 5400
    when '10k' then p_time_s between 1560 and 10800
    when 'half_marathon' then p_time_s between 3300 and 21600
    when 'marathon' then p_time_s between 7200 and 28800
  end, false)
$$;

revoke all on function private.competition_time_plausible(public.competition_discipline, integer) from public;
grant execute on function private.competition_time_plausible(public.competition_discipline, integer)
  to authenticated, service_role;

-- Schritte einer Einheit (workoutStepsSchema in packages/core/src/plan/intensity.ts, strikt): Liste mit 1–40
-- Objekten, je GENAU part (warmup|main|cooldown), kind (work|easy|rest), seconds (ganzzahlig 10–14400), effort
-- (ganzzahlig 0–10); Summe der Sekunden = geplante Minuten × 60; Größe als Text höchstens 4096 Bytes
-- (COMPETITION_RECORD_LIMITS.workoutStepsMaxBytes). Jede andere Eingabe → false (nie ein Fehler).
create or replace function private.workout_steps_valid(p_steps jsonb, p_minutes integer)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  step jsonb;
  total bigint := 0;
begin
  if p_steps is null or p_minutes is null
     or jsonb_typeof(p_steps) <> 'array'
     or jsonb_array_length(p_steps) not between 1 and 40
     or octet_length(p_steps::text) > 4096 then
    return false;
  end if;
  for step in select value from jsonb_array_elements(p_steps) loop
    if jsonb_typeof(step) <> 'object'
       or (select count(*) from jsonb_object_keys(step)) <> 4
       or not (step ?& array['part', 'kind', 'seconds', 'effort'])
       or jsonb_typeof(step -> 'part') <> 'string'
       or (step ->> 'part') not in ('warmup', 'main', 'cooldown')
       or jsonb_typeof(step -> 'kind') <> 'string'
       or (step ->> 'kind') not in ('work', 'easy', 'rest')
       or jsonb_typeof(step -> 'seconds') <> 'number'
       or (step -> 'seconds')::numeric not between 10 and 14400
       or (step -> 'seconds')::numeric <> trunc((step -> 'seconds')::numeric)
       or jsonb_typeof(step -> 'effort') <> 'number'
       or (step -> 'effort')::numeric not between 0 and 10
       or (step -> 'effort')::numeric <> trunc((step -> 'effort')::numeric) then
      return false;
    end if;
    total := total + (step -> 'seconds')::numeric::bigint;
  end loop;
  return total = p_minutes::bigint * 60;
end;
$$;

revoke all on function private.workout_steps_valid(jsonb, integer) from public;
grant execute on function private.workout_steps_valid(jsonb, integer) to authenticated, service_role;

-- Schritte passen zur Art (Wächter WP3 H1): Lockere Arten (easy, long, recovery) nur mit Abschnitten bis Anstrengung 4
-- (ENDURANCE_EFFORT_LIMITS.max); Steigerungen (strides) nur mit Belastungs-Abschnitten (kind work) von höchstens 20 s,
-- höchstens 6 Stück (COMPETITION_WORKOUTS.strides.workS/count), alle übrigen Abschnitte bis 4. Harte Arten: frei
-- (Deckel je Person in private.insert_plan_sessions). Erwartet gültige Schritte (workout_steps_valid); sonst false.
create or replace function private.workout_steps_fit_type(p_type public.workout_type, p_steps jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_type is null or p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    return false;
  end if;
  if p_type in ('fartlek', 'tempo', 'intervals', 'race_pace') then
    return true;
  end if;
  if p_type = 'strides' then
    return not exists (
      select 1 from jsonb_array_elements(p_steps) st
      where (st ->> 'effort')::numeric > 4
        and (st ->> 'kind' is distinct from 'work' or (st ->> 'seconds')::numeric > 20)
    )
    and (select count(*) from jsonb_array_elements(p_steps) st where (st ->> 'effort')::numeric > 4) <= 6;
  end if;
  return not exists (select 1 from jsonb_array_elements(p_steps) st where (st ->> 'effort')::numeric > 4);
exception
  when others then
    return false;
end;
$$;

revoke all on function private.workout_steps_fit_type(public.workout_type, jsonb) from public;
grant execute on function private.workout_steps_fit_type(public.workout_type, jsonb) to authenticated, service_role;

-- Zählt eine Einheit als hart (Wochenzahl, Erholungswoche nur im Tapering)? Harte Art ODER – robust, unabhängig von der
-- Art – ein Abschnitt ab Anstrengung 6 (COMPETITION_INTENSITY.hardEffortMin), der länger als 20 s dauert
-- (Steigerungen bleiben locker). Nie ein Fehler.
create or replace function private.workout_is_hard(p_type public.workout_type, p_steps jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_type in ('fartlek', 'tempo', 'intervals', 'race_pace') then
    return true;
  end if;
  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    return false;
  end if;
  return exists (
    select 1 from jsonb_array_elements(p_steps) st
    where (st ->> 'effort')::numeric >= 6 and (st ->> 'seconds')::numeric > 20
  );
exception
  when others then
    return false;
end;
$$;

revoke all on function private.workout_is_hard(public.workout_type, jsonb) from public;
grant execute on function private.workout_is_hard(public.workout_type, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- 2. competitions
-- ---------------------------------------------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Name nur Anzeige: 1–80 Zeichen, ohne Leerraum am Rand – genau die Zeichen, die String.prototype.trim() entfernt
  -- (competitionInputSchema trimmt; COMPETITION_NAME_TRIM_CLASS, unabhängig von der Locale, Wächter WP3 N4).
  name text not null check (
    char_length(name) between 1 and 80
    and name !~ '^[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'
    and name !~ '[\u0009-\u000d \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]$'
  ),
  discipline public.competition_discipline not null,
  -- Aus der Disziplin (setzt save_competition); Rad mit freier Distanz folgt mit WP5.
  distance_m numeric(8, 1) not null,
  race_date date not null check (race_date >= date '2000-01-01'),
  goal_kind public.competition_goal not null default 'finish',
  target_time_s integer,
  -- Referenzzeit (letzter Wettkampf oder Testlauf, kein Maximaltest): ganz oder gar nicht.
  reference_discipline public.competition_discipline,
  reference_time_s integer,
  reference_date date,
  -- Wunsch-Tag des langen Laufs (ISO 1 = Montag … 7 = Sonntag), null = automatisch (WP2, longRunWeekday).
  long_run_weekday smallint check (long_run_weekday between 1 and 7),
  status public.competition_status not null default 'planned',
  -- Ergebnis = eigener Tagebuch-Eintrag (freie Einheit, A1b); Löschen des Eintrags lässt den Wettkampf stehen.
  result_session_log_id uuid,
  -- Plan-Bezug (nur mit Wettkampfplan, COMPETITION_PLAN_BASIS_COLUMNS): eigener Startumfang so wie bestätigt
  -- eingegeben (W-G5, Core deckelt), Tagebuch-Bezug beim Erstellen samt Startgruppe (Wächter H1/H2), wirksames Ziel.
  own_start_weekly_minutes smallint check (own_start_weekly_minutes between 10 and 1680),
  start_reference_volume smallint check (start_reference_volume = 0 or start_reference_volume between 10 and 1680),
  start_reference_session_cap smallint check (start_reference_session_cap between 10 and 240),
  start_reference_start_group public.endurance_start_group,
  effective_goal public.competition_goal,
  -- Bestimmt save_competition selbst (nie der Client): true genau dann, wenn ein Plan-Bezug gespeichert ist.
  uses_health_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Nur eigene Einträge; beim Löschen des Eintrags bleibt der Wettkampf (nur der Verweis wird leer).
  foreign key (result_session_log_id, user_id) references public.session_logs (id, user_id)
    on delete set null (result_session_log_id),
  constraint competitions_distance check (distance_m = private.competition_distance_m(discipline)),
  constraint competitions_goal_time check (
    (goal_kind = 'time') = (target_time_s is not null)
    and (target_time_s is null or private.competition_time_plausible(discipline, target_time_s))
    -- Zielzeit nur mit eigener Referenzzeit (W-G6).
    and (goal_kind <> 'time' or reference_time_s is not null)
  ),
  constraint competitions_reference check (
    (reference_discipline is null) = (reference_time_s is null)
    and (reference_discipline is null) = (reference_date is null)
    and (reference_time_s is null or private.competition_time_plausible(reference_discipline, reference_time_s))
    and (reference_date is null or reference_date < race_date)
  ),
  constraint competitions_start_reference check (
    (start_reference_volume is null) = (start_reference_start_group is null)
    and (start_reference_session_cap is null
      or (start_reference_volume is not null and start_reference_session_cap <= start_reference_volume))
  ),
  -- Plan-Bezug nur mit wirksamem Ziel; Zielzeit wirkt nur beim Ziel „Zielzeit“; Gesundheitsbezug = Plan-Bezug.
  constraint competitions_plan_basis check (
    (effective_goal is not null or (own_start_weekly_minutes is null and start_reference_volume is null))
    and (effective_goal is distinct from 'time' or goal_kind = 'time')
    and uses_health_data = (effective_goal is not null)
  ),
  constraint competitions_result check (result_session_log_id is null or status = 'done')
);

comment on table public.competitions is
  'Wettkämpfe (Phase 10 WP3). Kein Gesundheitsdatum; der Plan-Bezug (uses_health_data = true) nur mit Einwilligung '
  'health_data und beim Widerruf geleert. Schreiben nur über save_competition/cancel_competition/'
  'complete_competition/delete_competition (docs/PLAN-PHASE-10.md Abschnitt 7).';

-- Höchstens EIN geplanter Hauptwettkampf je Person (W-G9).
create unique index competitions_one_planned_idx on public.competitions (user_id) where status = 'planned';
create index competitions_user_id_idx on public.competitions (user_id, race_date);
create index competitions_result_session_log_id_idx on public.competitions (result_session_log_id)
  where result_session_log_id is not null;

create trigger competitions_set_updated_at
  before update on public.competitions
  for each row execute function private.set_updated_at();

alter table public.competitions enable row level security;
revoke all on table public.competitions from anon, authenticated;
grant select on table public.competitions to authenticated;
grant all on table public.competitions to service_role;

create policy "Nutzer sehen eigene Wettkämpfe"
  on public.competitions for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- 3. planned_sessions: Felder des Wettkampfplans (WP2, nur Wettkampfplan – sonst null)
-- ---------------------------------------------------------------------------------------------------------
alter table public.planned_sessions
  add column workout_type public.workout_type,
  add column training_phase public.training_phase,
  -- Distanz-Richtwert (nur mit Referenzzeit, durchgehende Läufe; COMPETITION_PACE.distanceM).
  add column target_distance_m integer check (target_distance_m between 100 and 60000),
  -- Schritte für den Intervall-Timer (WP4), Struktur über private.workout_steps_valid.
  add column workout_steps jsonb,
  -- Lockerung: Wettkampf-Einheiten bis 8 (COMPETITION_EFFORT_LIMITS, „nie alles geben“); alte Zeilen bleiben gültig.
  drop constraint planned_sessions_effort_target_check,
  add constraint planned_sessions_effort_target_range check (effort_target between 1 and 8),
  add constraint planned_sessions_workout_fields check (
    -- Ohne Art (Pläne ohne Wettkampf): unverändert nur locker, Anstrengung höchstens 4.
    (workout_type is null and training_phase is null and workout_steps is null and target_distance_m is null
      and (effort_target is null or effort_target <= 4))
    -- Mit Art: nur Ausdauer, Art + Phase + Schritte zusammen; über 4 nur bei harter Art; harte Art in einer
    -- Erholungswoche (is_deload) nur im Tapering („Intensität bleibt“, Plan 3.1).
    or (kind = 'endurance' and workout_type is not null and training_phase is not null and workout_steps is not null
      and (effort_target <= 4 or workout_type in ('fartlek', 'tempo', 'intervals', 'race_pace'))
      and (not is_deload
        or workout_type not in ('fartlek', 'tempo', 'intervals', 'race_pace')
        or training_phase = 'taper')
      and private.workout_steps_valid(workout_steps, estimated_minutes)
      -- Wächter WP3 H1: Schritte passen zur Art; „hart“ auch über die Schritte erkannt (Erholungswoche).
      and private.workout_steps_fit_type(workout_type, workout_steps)
      and (not is_deload or training_phase = 'taper' or not private.workout_is_hard(workout_type, workout_steps)))
  );

comment on column public.planned_sessions.workout_type is
  'Wettkampfplan (Phase 10): Art der Ausdauer-Einheit; null = Plan ohne Wettkampf (nur locker, Anstrengung ≤ 4).';
