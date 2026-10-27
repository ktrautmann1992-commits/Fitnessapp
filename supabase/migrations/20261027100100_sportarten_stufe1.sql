-- Sportarten Stufe 1 (Gründer-Freigabe 27.10.2026, docs/PLAN-SPORTARTEN-STUFE-1.md Abschnitt 3) · Etappe S –
-- Datenbank-Grundlage für Hyrox, Wandern/Bergwandern, Indoor-Rudern und Yoga/Pilates/Mobility: Spalten, CHECKs und
-- Prüf-Hilfsfunktionen. Die neuen Fassungen der Schreib-Funktionen folgen in 20261027100200_sportarten_stufe1_rpcs.sql.
-- NUR ADDITIV bzw. per `create or replace` mit GLEICHER Signatur (keine bestehende Migration geändert, RLS unverändert):
-- 1. Hyrox · Wettkampf: private.competition_distance_m (+ hyrox 8.000 m Lauf-Anteil), competition_server_lead_weeks
--    (+ hyrox 8 Wochen), competition_minor_allowed (+ hyrox – unter 18 nur Division Open, Prüfung in save_competition);
--    Spalte competitions.hyrox_division (gesetzt genau bei Disziplin hyrox); CHECK competitions_multisport neu: Hyrox nur
--    „Ankommen“, darf aber eine Lauf-Referenzzeit tragen (Distanz-Richtwert der Lauf-Einheiten, Plan 2.1).
-- 2. Hyrox · Einheiten: Schritt-Typ `station` (mit Feld `station`, HYROX_STATIONS) in private.workout_steps_valid;
--    harte Art `hyrox_combo` in private.workout_steps_fit_type, private.workout_is_hard und im CHECK
--    planned_sessions_workout_fields (neu angelegt, gleiche Bedingungen + hyrox_combo); Stations-Schritte nur in
--    hyrox_combo und easy (Technik-Kombi); neuer CHECK planned_sessions_hyrox (Kombi nur als Lauf-Einheit, Fokus
--    hyrox_stations nur bei Kraft).
-- 3. Hyrox · Ergebnis: session_logs.hyrox_splits jsonb (Liste mit 0–17 Teilzeiten, private.hyrox_splits_valid) – nur an
--    einer freien Ausdauer-Einheit ohne Sportart; null = kein Hyrox-Rennen.
-- 4. Rudern: cardio_logs.avg_power_w (1–1000 W), stroke_rate (10–60 /min), intervals jsonb (1–30 Wiederholungen,
--    private.cardio_intervals_valid) – nur bei Ausdauer-Art row.
-- 5. Wandern: cardio_logs.walk_kind und tracked_routes.walk_kind (nur bei walk; null = Gehen),
--    tracked_routes.elevation_loss_m (0–10.000 m), max_altitude_m (−500–9.000 m), sac_grade (1–3, nur Wandern/
--    Bergwandern).
-- 6. Einstellung „Erholungs-Routine vorschlagen“ (Plan 2.4/3, Entscheidung 13): app_layout_settings.recovery_routine
--    boolean, Standard true (je Konto, Schreiben nur über save_app_layout).
-- Yoga/Pilates/Mobility brauchen sonst keine Spalte: Kategorien/Format sind Enum-Werte (Tabelle workouts), das
-- Item-Feld `side` steht in workouts.data (Datei unverändert, Prüfung über das Zod-Schema der Inhalte).
-- Grenzen = packages/core/src/constants.ts (COMPETITION_DISTANCE_M, COMPETITION_LEAD_WEEKS, COMPETITION_LONG_RUN,
-- HYROX_RESULT_LIMITS, CARDIO_LOG_LIMITS, TRACKED_ROUTE_LIMITS) und Listen (HYROX_STATIONS, HYROX_SPLIT_SEGMENTS,
-- HARD_WORKOUT_TYPES, STATION_STEP_WORKOUT_TYPES), abgeglichen in db-sync.test.ts.
-- Kein Gesundheitsdatum (Plan 3): Leistung, Schlagzahl, Höhe, Teilzeiten sind Trainingswerte wie Distanz und Dauer –
-- keine Koordinaten oder Höhen in Logs/Fehlermeldungen. Export: export_my_data nimmt to_jsonb der ganzen Zeilen
-- (competitions, session_logs, cardio_logs, tracked_routes, app_layout_settings) – die Spalten sind automatisch dabei;
-- Löschen mit dem Konto per Kaskade.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Hyrox · Wettkampf
-- ---------------------------------------------------------------------------------------------------------

-- Distanz der Disziplin in Metern (COMPETITION_DISTANCE_M). Hyrox: Lauf-Anteil 8 × 1 km (Stationen ohne Distanz).
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
    when 'triathlon_sprint' then 25750
    when 'triathlon_olympic' then 51500
    when 'hyrox' then 8000
  end::numeric
$$;

revoke all on function private.competition_distance_m(public.competition_discipline) from public;
grant execute on function private.competition_distance_m(public.competition_discipline) to authenticated, service_role;

-- Mindestvorlauf des SERVERS (lockerste Spalte, COMPETITION_LEAD_WEEKS bzw. COMPETITION_CYCLING.classes). Hyrox:
-- 8 Wochen (Entscheidung 4; Einsteiger 12 prüft Core in der Ampel).
create or replace function private.competition_server_lead_weeks(
  p_discipline public.competition_discipline,
  p_distance_m numeric
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_discipline
    when '5k' then 4 when '10k' then 6 when 'half_marathon' then 10 when 'marathon' then 14
    when 'triathlon_sprint' then 7 when 'triathlon_olympic' then 16
    when 'cycling' then case
      when p_distance_m <= 60000 then 6 when p_distance_m <= 120000 then 8 when p_distance_m <= 200000 then 14 else 18 end
    when 'hyrox' then 8
  end
$$;

revoke all on function private.competition_server_lead_weeks(public.competition_discipline, numeric) from public;
grant execute on function private.competition_server_lead_weeks(public.competition_discipline, numeric)
  to authenticated, service_role;

-- Wettkampfplan unter 18 erlaubt (COMPETITION_GROUP_RULES): Laufen höchstens Halbmarathon, Triathlon nur Sprint, Rad
-- höchstens 100 km; Hyrox ja – aber nur Division Open (HYROX_SAFETY; prüft save_competition, die Division steht nicht
-- in dieser Funktion).
create or replace function private.competition_minor_allowed(
  p_discipline public.competition_discipline,
  p_distance_m numeric
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case
    when p_discipline in ('5k', '10k', 'half_marathon') then true
    when p_discipline in ('triathlon_sprint') then true
    when p_discipline = 'cycling' then p_distance_m <= 100000
    when p_discipline = 'hyrox' then true
    else false
  end, false)
$$;

revoke all on function private.competition_minor_allowed(public.competition_discipline, numeric) from public;
grant execute on function private.competition_minor_allowed(public.competition_discipline, numeric)
  to authenticated, service_role;

-- Bestehende Zeilen haben keine Hyrox-Disziplin und erfüllen beide Bedingungen.
alter table public.competitions
  add column hyrox_division public.hyrox_division,
  add constraint competitions_hyrox_division check ((discipline = 'hyrox') = (hyrox_division is not null)),
  drop constraint competitions_multisport,
  -- Rad, Triathlon und Hyrox: nur „Ankommen“ (Riegel/Zielzeit nur Laufen); eine Referenzzeit nur als Lauf-Distanz –
  -- bei Hyrox erlaubt (Distanz-Richtwert der Lauf-Einheiten, Plan 2.1), bei Rad und Triathlon nicht (WP5).
  add constraint competitions_multisport check (
    (discipline in ('5k', '10k', 'half_marathon', 'marathon')
      or (goal_kind = 'finish' and effective_goal is distinct from 'time'
        and (reference_discipline is null or discipline = 'hyrox')))
    and (reference_discipline is null or reference_discipline in ('5k', '10k', 'half_marathon', 'marathon'))
  );

comment on column public.competitions.hyrox_division is
  'Hyrox-Division (Sportarten Stufe 1): open/pro mit eigenen Gewichten, doubles/relay nur Angabe. Gesetzt genau bei '
  'Disziplin hyrox; unter 18 nur open (save_competition). Kein Gesundheitsdatum.';

-- ---------------------------------------------------------------------------------------------------------
-- 2. Hyrox · Einheiten (planned_sessions)
-- ---------------------------------------------------------------------------------------------------------

-- Schritte einer Einheit (workoutStepSchema in packages/core/src/plan/intensity.ts, strikt): Liste mit 1–40 Objekten,
-- je GENAU part (warmup|main|cooldown), kind (work|easy|rest|station), seconds (ganzzahlig 10–14400), effort
-- (ganzzahlig 0–10); bei kind = station zusätzlich GENAU das Feld station (HYROX_STATIONS). Summe der Sekunden =
-- geplante Minuten × 60; Größe als Text höchstens 4096 Bytes. Jede andere Eingabe → false (nie ein Fehler).
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
       or (select count(*) from jsonb_object_keys(step))
         <> (case when (step ->> 'kind') = 'station' then 5 else 4 end)
       or not (step ?& array['part', 'kind', 'seconds', 'effort'])
       or jsonb_typeof(step -> 'part') <> 'string'
       or (step ->> 'part') not in ('warmup', 'main', 'cooldown')
       or jsonb_typeof(step -> 'kind') <> 'string'
       or (step ->> 'kind') not in ('work', 'easy', 'rest', 'station')
       or jsonb_typeof(step -> 'seconds') <> 'number'
       or (step -> 'seconds')::numeric not between 10 and 14400
       or (step -> 'seconds')::numeric <> trunc((step -> 'seconds')::numeric)
       or jsonb_typeof(step -> 'effort') <> 'number'
       or (step -> 'effort')::numeric not between 0 and 10
       or (step -> 'effort')::numeric <> trunc((step -> 'effort')::numeric) then
      return false;
    end if;
    -- Stations-Schritt: welche Station (feste Liste, Rennreihenfolge).
    if (step ->> 'kind') = 'station'
       and (jsonb_typeof(step -> 'station') is distinct from 'string'
         or (step ->> 'station') not in (
           'ski_erg', 'sled_push', 'sled_pull', 'burpee_broad_jumps', 'rowing', 'farmers_carry', 'sandbag_lunges',
           'wall_balls'
         )) then
      return false;
    end if;
    total := total + (step -> 'seconds')::numeric::bigint;
  end loop;
  return total = p_minutes::bigint * 60;
end;
$$;

revoke all on function private.workout_steps_valid(jsonb, integer) from public;
grant execute on function private.workout_steps_valid(jsonb, integer) to authenticated, service_role;

-- Schritte passen zur Art (Wächter WP3 H1): Stations-Schritte nur in den Arten hyrox_combo und easy
-- (STATION_STEP_WORKOUT_TYPES; easy = lockere Technik-Kombi bei Arzt-Hinweis). Harte Arten (HARD_WORKOUT_TYPES, seit
-- Stufe 1 mit hyrox_combo): frei. Steigerungen und lockere Arten wie bisher. Erwartet gültige Schritte; sonst false.
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
  if p_type not in ('hyrox_combo', 'easy')
     and exists (select 1 from jsonb_array_elements(p_steps) st where st ->> 'kind' = 'station') then
    return false;
  end if;
  if p_type in ('fartlek', 'tempo', 'intervals', 'race_pace', 'hyrox_combo') then
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

-- Zählt eine Einheit als hart? Harte Art (seit Stufe 1 mit hyrox_combo) ODER ein Abschnitt ab Anstrengung 6, der
-- länger als 20 s dauert. Nie ein Fehler.
create or replace function private.workout_is_hard(p_type public.workout_type, p_steps jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_type in ('fartlek', 'tempo', 'intervals', 'race_pace', 'hyrox_combo') then
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

-- CHECK der Wettkampf-Felder neu: gleiche Bedingungen wie 20261016140100_competitions.sql, harte Arten + hyrox_combo.
-- Bestehende Zeilen kennen hyrox_combo nicht und bleiben gültig.
alter table public.planned_sessions
  drop constraint planned_sessions_workout_fields,
  add constraint planned_sessions_workout_fields check (
    -- Ohne Art (Pläne ohne Wettkampf): unverändert nur locker, Anstrengung höchstens 4.
    (workout_type is null and training_phase is null and workout_steps is null and target_distance_m is null
      and (effort_target is null or effort_target <= 4))
    -- Mit Art: nur Ausdauer, Art + Phase + Schritte zusammen; über 4 nur bei harter Art; harte Art in einer
    -- Erholungswoche (is_deload) nur im Tapering („Intensität bleibt“, Plan 3.1).
    or (kind = 'endurance' and workout_type is not null and training_phase is not null and workout_steps is not null
      and (effort_target <= 4 or workout_type in ('fartlek', 'tempo', 'intervals', 'race_pace', 'hyrox_combo'))
      and (not is_deload
        or workout_type not in ('fartlek', 'tempo', 'intervals', 'race_pace', 'hyrox_combo')
        or training_phase = 'taper')
      and private.workout_steps_valid(workout_steps, estimated_minutes)
      -- Wächter WP3 H1: Schritte passen zur Art; „hart“ auch über die Schritte erkannt (Erholungswoche).
      and private.workout_steps_fit_type(workout_type, workout_steps)
      and (not is_deload or training_phase = 'taper' or not private.workout_is_hard(workout_type, workout_steps)))
  ),
  -- Hyrox: Kombi-Einheit nur als Lauf-Einheit (der Stations-Teil steckt in den Schritten, wie das Koppeltraining beim
  -- Rad); Stations-Einheit (Fokus hyrox_stations) nur als Kraft-Einheit.
  add constraint planned_sessions_hyrox check (
    (workout_type is distinct from 'hyrox_combo' or endurance_modality is not distinct from 'run')
    and (focus is distinct from 'hyrox_stations' or kind = 'strength')
  );

-- ---------------------------------------------------------------------------------------------------------
-- 3. Hyrox · Ergebnis (session_logs.hyrox_splits)
-- ---------------------------------------------------------------------------------------------------------

-- Teilzeiten eines Hyrox-Rennens (HYROX_RESULT_LIMITS, HYROX_SPLIT_SEGMENTS): Liste mit 0–17 Objekten, je GENAU
-- segment (feste Liste: 8 × Laufen, 8 Stationen, Roxzone; jedes höchstens einmal) und duration_s (ganzzahlig 1–7200).
-- Leere Liste = Hyrox-Rennen ohne Teilzeiten. Jede andere Eingabe → false (nie ein Fehler).
create or replace function private.hyrox_splits_valid(p_splits jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  split jsonb;
begin
  if p_splits is null or jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) > 17 then
    return false;
  end if;
  for split in select value from jsonb_array_elements(p_splits) loop
    if jsonb_typeof(split) <> 'object'
       or (select count(*) from jsonb_object_keys(split)) <> 2
       or not (split ?& array['segment', 'duration_s'])
       or jsonb_typeof(split -> 'segment') <> 'string'
       or (split ->> 'segment') not in (
         'run_1', 'ski_erg', 'run_2', 'sled_push', 'run_3', 'sled_pull', 'run_4', 'burpee_broad_jumps', 'run_5',
         'rowing', 'run_6', 'farmers_carry', 'run_7', 'sandbag_lunges', 'run_8', 'wall_balls', 'roxzone'
       )
       or jsonb_typeof(split -> 'duration_s') <> 'number'
       or (split -> 'duration_s')::numeric not between 1 and 7200
       or (split -> 'duration_s')::numeric <> trunc((split -> 'duration_s')::numeric) then
      return false;
    end if;
  end loop;
  return (select count(distinct x ->> 'segment') from jsonb_array_elements(p_splits) x) = jsonb_array_length(p_splits);
end;
$$;

revoke all on function private.hyrox_splits_valid(jsonb) from public;
grant execute on function private.hyrox_splits_valid(jsonb) to authenticated, service_role;

alter table public.session_logs add column hyrox_splits jsonb;
-- Nur an einer freien Ausdauer-Einheit ohne Sportart (Ergebnis „Hyrox-Rennen“); Art „run“ und Summe ≤ Gesamtzeit prüft
-- save_session_log (cardio_logs ist eine eigene Tabelle).
alter table public.session_logs
  add constraint session_logs_hyrox_check check (
    hyrox_splits is null
    or (private.hyrox_splits_valid(hyrox_splits) and is_free and kind = 'endurance' and planned_session_id is null
        and sport is null)
  );

comment on column public.session_logs.hyrox_splits is
  'Hyrox-Rennen (Sportarten Stufe 1): Teilzeiten [{segment, duration_s}] (0–17, leer = ohne Teilzeiten); gesetzt '
  'genau beim Ergebnis „Hyrox-Rennen“ (freie Ausdauer-Einheit run), sonst null. Setzt nur save_session_log. Privat, '
  'kein Vergleich mit anderen.';

-- ---------------------------------------------------------------------------------------------------------
-- 4. Indoor-Rudern (cardio_logs)
-- ---------------------------------------------------------------------------------------------------------

-- Intervall-Ergebnis (CARDIO_LOG_LIMITS.intervalsMax, intervalDistanceM, intervalDurationS): Liste mit 1–30 Objekten,
-- je GENAU distance_m (ganzzahlig 1–10.000) und duration_s (ganzzahlig 1–3.600). Jede andere Eingabe → false.
create or replace function private.cardio_intervals_valid(p_intervals jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  rep jsonb;
begin
  if p_intervals is null or jsonb_typeof(p_intervals) <> 'array'
     or jsonb_array_length(p_intervals) not between 1 and 30 then
    return false;
  end if;
  for rep in select value from jsonb_array_elements(p_intervals) loop
    if jsonb_typeof(rep) <> 'object'
       or (select count(*) from jsonb_object_keys(rep)) <> 2
       or not (rep ?& array['distance_m', 'duration_s'])
       or jsonb_typeof(rep -> 'distance_m') <> 'number'
       or (rep -> 'distance_m')::numeric not between 1 and 10000
       or (rep -> 'distance_m')::numeric <> trunc((rep -> 'distance_m')::numeric)
       or jsonb_typeof(rep -> 'duration_s') <> 'number'
       or (rep -> 'duration_s')::numeric not between 1 and 3600
       or (rep -> 'duration_s')::numeric <> trunc((rep -> 'duration_s')::numeric) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.cardio_intervals_valid(jsonb) from public;
grant execute on function private.cardio_intervals_valid(jsonb) to authenticated, service_role;

alter table public.cardio_logs
  add column avg_power_w smallint check (avg_power_w between 1 and 1000),
  add column stroke_rate smallint check (stroke_rate between 10 and 60),
  add column intervals jsonb check (intervals is null or private.cardio_intervals_valid(intervals)),
  add column walk_kind public.walk_kind,
  add constraint cardio_logs_row_only_row check (
    (avg_power_w is null and stroke_rate is null and intervals is null) or modality = 'row'
  ),
  add constraint cardio_logs_walk_kind_only_walk check (walk_kind is null or modality = 'walk');

comment on column public.cardio_logs.avg_power_w is
  'Rudern (Sportarten Stufe 1): Durchschnittsleistung in Watt (1–1000), nur bei modality = row; sonst null.';
comment on column public.cardio_logs.stroke_rate is
  'Rudern: durchschnittliche Schlagzahl je Minute (10–60), nur bei modality = row; sonst null.';
comment on column public.cardio_logs.intervals is
  'Rudern: Intervall-Ergebnis [{distance_m, duration_s}] (1–30 Wiederholungen), nur bei modality = row; sonst null.';
comment on column public.cardio_logs.walk_kind is
  'Wandern (Sportarten Stufe 1): Gehen/Wandern/Bergwandern, nur bei modality = walk; null = Gehen wie bisher.';

-- ---------------------------------------------------------------------------------------------------------
-- 5. Wandern/Bergwandern (tracked_routes)
-- ---------------------------------------------------------------------------------------------------------
alter table public.tracked_routes
  add column walk_kind public.walk_kind,
  -- sync: TRACKED_ROUTE_LIMITS.elevationLossM, maxAltitudeM, sacGrade
  add column elevation_loss_m integer check (elevation_loss_m between 0 and 10000),
  add column max_altitude_m integer check (max_altitude_m between -500 and 9000),
  add column sac_grade smallint check (sac_grade between 1 and 3),
  add constraint tracked_routes_walk_kind_only_walk check (walk_kind is null or sport = 'walk'),
  -- SAC-Stufe nur bei Wandern/Bergwandern (walk_kind null zählt NICHT – coalesce, sonst wäre die Bedingung „unbekannt“).
  add constraint tracked_routes_sac_grade_hike check (
    sac_grade is null or coalesce(walk_kind in ('hike', 'mountain_hike'), false)
  );

comment on column public.tracked_routes.walk_kind is
  'Wandern (Sportarten Stufe 1): Gehen/Wandern/Bergwandern, nur bei sport = walk; null = Gehen wie bisher.';
comment on column public.tracked_routes.elevation_loss_m is
  'Abstieg in Metern (geglättet, „ca.“), null = unbekannt. Privat wie die Strecke.';
comment on column public.tracked_routes.max_altitude_m is
  'Höchster Punkt in Metern über dem Meer (GPS, „ca.“), null = unbekannt. Privat wie die Strecke.';
comment on column public.tracked_routes.sac_grade is
  'Schwierigkeit nach SAC-Wanderskala T1–T3 (1–3), nur bei Wandern/Bergwandern; T4+ begleitet die App nicht.';

-- ---------------------------------------------------------------------------------------------------------
-- 6. Einstellung „Erholungs-Routine vorschlagen“
-- ---------------------------------------------------------------------------------------------------------
alter table public.app_layout_settings add column recovery_routine boolean not null default true;

comment on column public.app_layout_settings.recovery_routine is
  'Karte „Erholungstag: Mobility“ auf „Heute“ vorschlagen (Sportarten Stufe 1, Entscheidung 13; Standard an). '
  'Einstellung, kein Gesundheitsdatum.';
