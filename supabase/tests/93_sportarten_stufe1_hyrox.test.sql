-- Sportarten Stufe 1 · Hyrox (Migrationen 20261027100000_sportarten_stufe1_enums.sql, 20261027100100_sportarten_stufe1.sql,
-- 20261027100200_sportarten_stufe1_rpcs.sql; docs/PLAN-SPORTARTEN-STUFE-1.md 2.1 und 3):
-- - Enums: endurance_discipline/competition_discipline + hyrox, session_focus + hyrox_stations, workout_type +
--   hyrox_combo, neuer Typ hyrox_division,
-- - Wettkampf: Distanz 8 km (Lauf-Anteil), Server-Mindestvorlauf 8 Wochen, Division genau bei Hyrox, unter 18 nur
--   Open, nur „Ankommen“, Lauf-Referenz erlaubt,
-- - Einheiten: Schritt-Typ station (nur hyrox_combo und easy), Kombi nur als Lauf, harte Art, Fokus hyrox_stations nur
--   Kraft, langer Lauf höchstens 90 min,
-- - Ergebnis: session_logs.hyrox_splits (0–17 Teilzeiten) nur am freien „Hyrox-Rennen“ (Lauf), Summe ≤ Gesamtzeit,
-- - RLS unverändert, Export enthält die neuen Spalten.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A, B, T: 36 Jahre mit Check. Y: 17 Jahre mit Check. Alle mit Einwilligung health_data.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-t@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-y@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u.id, t, 1, 'web'
from auth.users u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date)
select u.id, case when u.email = 'nutzer-y@example.test' then date '2009-06-01' else date '1990-01-01' end
from auth.users u;
insert into public.health_screening (user_id, medical_notice_acknowledged_at, answers)
select u.id, now(), jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
  'dizziness', false, 'blood_pressure', false, 'bone_joint', false, 'medication', false, 'other_reason', false,
  'pregnancy', false)
from auth.users u;

-- Eingabe wie toSaveCompetitionPayload() (packages/core): Hyrox Open am Sonntag, 10.01.2027, „Ankommen“.
create function pg_temp.comp(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', null, 'name', 'Hyrox Köln', 'discipline', 'hyrox', 'race_date', '2027-01-10',
    'goal_kind', 'finish', 'target_time_s', null, 'reference_discipline', null, 'reference_time_s', null,
    'reference_date', null, 'long_run_weekday', null, 'own_start_weekly_minutes', null, 'start_reference_volume', null,
    'start_reference_session_cap', null, 'start_reference_start_group', null, 'effective_goal', null,
    'hyrox_division', 'open'
  ) || p_changes
$$;
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
declare
  code text;
  msg text;
begin
  execute p_sql;
  return 'kein Fehler';
exception when others then
  get stacked diagnostics code = returned_sqlstate, msg = message_text;
  return code || ': ' || msg;
end;
$$;
create function pg_temp.save(p_payload jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_competition(%L::jsonb)', p_payload))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
-- Schritte: 5 min locker, Hauptteil (Belastung `p_effort` bzw. Station), 5 min locker – Summe = Dauer.
create function pg_temp.steps(p_minutes integer, p_main jsonb) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('part', 'warmup', 'kind', 'easy', 'seconds', 300, 'effort', 2))
    || p_main
    || jsonb_build_array(jsonb_build_object('part', 'cooldown', 'kind', 'easy', 'seconds', 300, 'effort', 2))
$$;
-- Kombi „1 km + Station“: p_rounds × (5 min Lauf + 5 min Station), Belastung p_effort.
create function pg_temp.combo_main(p_rounds integer, p_effort integer) returns jsonb language sql as $$
  select coalesce(jsonb_agg(x order by n, k), '[]'::jsonb)
  from generate_series(1, p_rounds) n
  cross join lateral (values
    (1, jsonb_build_object('part', 'main', 'kind', 'work', 'seconds', 300, 'effort', p_effort)),
    (2, jsonb_build_object('part', 'main', 'kind', 'station', 'seconds', 300, 'effort', p_effort,
      'station', 'wall_balls'))
  ) as s(k, x)
$$;
create function pg_temp.session(p_type text, p_modality text, p_minutes integer, p_main jsonb,
  p_effort_target integer default 4, p_day integer default 0, p_focus text default null) returns jsonb
language sql as $$
  select jsonb_build_object(
    'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Hyrox-Kombi',
    'focus', p_focus, 'endurance_modality', p_modality, 'effort_target', p_effort_target,
    'estimated_minutes', p_minutes, 'warmup_de', '5 Minuten locker einlaufen.', 'cooldown_de', '5 Minuten locker.',
    'exercises', '[]'::jsonb, 'workout_type', p_type, 'training_phase', 'build',
    'workout_steps', pg_temp.steps(p_minutes, p_main), 'target_distance_m', null)
$$;
create function pg_temp.easy_main(p_minutes integer, p_kind text default 'easy') returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('part', 'main', 'kind', p_kind, 'seconds', p_minutes * 60 - 600,
    'effort', 4) || case when p_kind = 'station' then '{"station": "sled_push"}'::jsonb else '{}'::jsonb end)
$$;
create function pg_temp.plan(p_sessions jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '[]'::jsonb,
    'uses_health_data', true, 'medical_notice', false,
    'inputs', jsonb_build_object('goalType', 'endurance', 'discipline', 'hyrox', 'experienceLevel', 'advanced',
      'schedule', '{"mode": "flex", "slots": [{"kind": "endurance", "minutes": 60}, {"kind": "endurance", "minutes": 60}, {"kind": "endurance", "minutes": 90}]}'::jsonb,
      'trainingLocation', null, 'homeEquipment', '[]'::jsonb),
    'start_date', '2026-10-07', 'sessions', p_sessions)
$$;
create function pg_temp.save_plan(p_payload jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_training_plan(%L::jsonb)', p_payload))
$$;
-- Ergebnis „Hyrox-Rennen“ (freie Lauf-Einheit, Gesamtzeit 90 min, 8 km) mit Teilzeiten p_splits.
create function pg_temp.race(p_id text, p_splits jsonb, p_changes jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null, 'planned_session_id', null,
    'planned_date', '2026-10-07', 'kind', 'endurance', 'performed_on', '2026-10-07',
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 8, 'notes', null,
    'name_de', 'Hyrox-Rennen', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-07T12:00:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('modality', 'run', 'duration_s', 5400, 'distance_m', 8000, 'elevation_m', null),
    'is_free', true, 'hyrox_splits', p_splits
  ) || p_changes
$$;
create function pg_temp.log_error(p_log jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_session_log(%L::jsonb)', p_log))
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Enums und Hilfsfunktionen
-- ---------------------------------------------------------------------------------------------------------
select ok('hyrox' = any (enum_range(null::public.competition_discipline)::text[]), 'competition_discipline kennt hyrox');
select ok('hyrox' = any (enum_range(null::public.endurance_discipline)::text[]), 'endurance_discipline kennt hyrox');
select ok('hyrox_combo' = any (enum_range(null::public.workout_type)::text[]), 'workout_type kennt hyrox_combo');
select ok('hyrox_stations' = any (enum_range(null::public.session_focus)::text[]),
  'session_focus kennt hyrox_stations');
select is(enum_range(null::public.hyrox_division)::text[], array['open', 'pro', 'doubles', 'relay'],
  'hyrox_division: Open, Pro, Doubles, Staffel');
select is(private.competition_distance_m('hyrox'), 8000::numeric, 'Hyrox: Lauf-Anteil 8 km');
select is(private.competition_server_lead_weeks('hyrox', 8000), 8, 'Hyrox: Server-Mindestvorlauf 8 Wochen');
select ok(private.competition_minor_allowed('hyrox', 8000), 'Hyrox unter 18 erlaubt (Division prüft save_competition)');

-- ---------------------------------------------------------------------------------------------------------
-- save_competition
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.save(pg_temp.comp() - 'hyrox_division'), '22023: Ungültige Angaben zum Wettkampf.',
  'Hyrox ohne Division abgelehnt');
select is(pg_temp.save(pg_temp.comp('{"discipline": "10k"}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Division nur bei Hyrox');
select is(pg_temp.save(pg_temp.comp('{"hyrox_division": "elite"}')), '22023: Ungültige Angaben zum Wettkampf.',
  'unbekannte Division abgelehnt (ohne Werte)');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 8}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Hyrox ohne km (Distanz aus der Disziplin)');
select is(pg_temp.save(pg_temp.comp('{"goal_kind": "time", "target_time_s": 5400, "reference_discipline": "10k",
  "reference_time_s": 3000, "reference_date": "2026-09-01"}')), '23514: Ungültige Angaben zum Wettkampf.',
  'Hyrox: keine Zielzeit (nur „Ankommen“)');
select is(pg_temp.save(pg_temp.comp('{"race_date": "2026-12-01"}')), '22023: Bis zum Renntag ist zu wenig Zeit.',
  'Hyrox: 8 Wochen − 1 Tag zu kurz');
select is(pg_temp.save(pg_temp.comp('{"reference_discipline": "10k", "reference_time_s": 3000,
  "reference_date": "2026-09-01"}')), 'kein Fehler', 'Hyrox mit Lauf-Referenzzeit (Distanz-Richtwert) gespeichert');
select results_eq(
  $$ select discipline::text, distance_m, hyrox_division::text, reference_discipline::text from public.competitions
     where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('hyrox', 8000.0::numeric, 'open', '10k') $$,
  'Hyrox gespeichert: 8 km, Open, Referenz 10 km');
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select is(pg_temp.save(pg_temp.comp('{"hyrox_division": "pro"}')),
  '22023: Unter 18 ist nur die Division Open möglich.', 'unter 18: Pro abgelehnt');
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'unter 18: Open gespeichert');
reset role;

select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date, hyrox_division)
  values ('44444444-4444-4444-8444-444444444444', '10 km', '10k', 10000, '2027-03-07', 'open') $$,
  '23514', null, 'CHECK: Division nur bei Hyrox');
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date)
  values ('44444444-4444-4444-8444-444444444444', 'Hyrox', 'hyrox', 8000, '2027-03-07') $$,
  '23514', null, 'CHECK: Hyrox braucht eine Division');

-- ---------------------------------------------------------------------------------------------------------
-- Schritte und Arten (Hilfsfunktionen der CHECKs, nie ein Fehler)
-- ---------------------------------------------------------------------------------------------------------
select ok(private.workout_steps_valid(pg_temp.steps(30, pg_temp.combo_main(2, 7)), 30),
  'Schritte mit Station (Feld station) gültig');
select ok(not private.workout_steps_valid(
    '[{"part": "main", "kind": "station", "seconds": 600, "effort": 4}]', 10),
  'Station ohne Feld station ungültig');
select ok(not private.workout_steps_valid(
    '[{"part": "main", "kind": "work", "seconds": 600, "effort": 4, "station": "rowing"}]', 10),
  'Feld station nur beim Schritt-Typ station');
select ok(not private.workout_steps_valid(
    '[{"part": "main", "kind": "station", "seconds": 600, "effort": 4, "station": "tyre_flip"}]', 10),
  'unbekannte Station ungültig');
select ok(private.workout_steps_fit_type('easy', pg_temp.steps(20, pg_temp.easy_main(20, 'station'))),
  'Technik-Kombi: locker mit Station passt zu easy');
select ok(not private.workout_steps_fit_type('long', pg_temp.steps(20, pg_temp.easy_main(20, 'station'))),
  'Station nicht in anderen Arten (long)');
select ok(private.workout_steps_fit_type('hyrox_combo', pg_temp.steps(30, pg_temp.combo_main(2, 7))),
  'hyrox_combo: harte Abschnitte erlaubt');
select ok(private.workout_is_hard('hyrox_combo', pg_temp.steps(20, pg_temp.easy_main(20))),
  'hyrox_combo zählt immer als hart');

-- ---------------------------------------------------------------------------------------------------------
-- Einheiten (save_training_plan → private.insert_plan_sessions); T mit geplantem Hyrox samt Plan-Bezug
-- ---------------------------------------------------------------------------------------------------------
insert into public.competitions (user_id, name, discipline, distance_m, race_date, effective_goal, uses_health_data,
  hyrox_division)
values ('44444444-4444-4444-8444-444444444444', 'Hyrox', 'hyrox', 8000, '2027-04-11', 'finish', true, 'open');
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(
    pg_temp.session('hyrox_combo', 'bike', 30, pg_temp.combo_main(2, 7), 7)))),
  '23514: Ungültige Werte im Plan.', 'Kombi nur als Lauf-Einheit');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(
    pg_temp.session('easy', 'run', 40, pg_temp.easy_main(40), 4, 0, 'hyrox_stations')))),
  '23514: Ungültige Werte im Plan.', 'Fokus hyrox_stations nur bei Kraft-Einheiten');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(
    pg_temp.session('long', 'run', 40, pg_temp.easy_main(40, 'station'))))),
  '23514: Ungültige Werte im Plan.', 'Station nicht im langen Lauf');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(
    pg_temp.session('long', 'run', 91, pg_temp.easy_main(91), 4, 5)))),
  '23514: Die Einheit ist für diese Distanz zu lang.', 'Hyrox: langer Lauf höchstens 90 min');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(
    pg_temp.session('hyrox_combo', 'run', 30, pg_temp.combo_main(2, 7), 7),
    pg_temp.session('easy', 'run', 30, pg_temp.easy_main(30, 'station'), 4, 2),
    pg_temp.session('long', 'run', 90, pg_temp.easy_main(90), 4, 5)))),
  'kein Fehler', 'Hyrox-Woche: Kombi (hart), Technik-Kombi (locker), langer Lauf 90 min gespeichert');
reset role;
select results_eq(
  $$ select workout_type::text, endurance_modality::text, effort_target::integer from public.planned_sessions
     where user_id = '44444444-4444-4444-8444-444444444444' order by scheduled_on $$,
  $$ values ('hyrox_combo', 'run', 7), ('easy', 'run', 4), ('long', 'run', 4) $$,
  'gespeicherte Arten, Lauf-Einheiten, Kombi mit Anstrengung 7');

-- ---------------------------------------------------------------------------------------------------------
-- Ergebnis „Hyrox-Rennen“ (save_session_log)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.save_session_log(pg_temp.race('b0000000-0000-4000-8000-000000000001',
    '[{"segment": "run_1", "duration_s": 300}, {"segment": "ski_erg", "duration_s": 280}]')) ->> 'result', 'ok',
  'Hyrox-Rennen mit zwei Teilzeiten gespeichert');
select results_eq(
  $$ select name_de, jsonb_array_length(hyrox_splits), is_free, kind::text from public.session_logs
     where id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Hyrox-Rennen', 2, true, 'endurance') $$,
  '… freie Ausdauer-Einheit mit Teilzeiten');
select is(public.save_session_log(pg_temp.race('b0000000-0000-4000-8000-000000000002', '[]')) ->> 'result', 'ok',
  'Hyrox-Rennen ohne Teilzeiten (leere Liste) gespeichert');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003',
    '[{"segment": "run_1", "duration_s": 5000}, {"segment": "roxzone", "duration_s": 401}]')),
  '22023: Ungültige Werte im Tagebuch.', 'Teilzeiten zusammen über der Gesamtzeit abgelehnt');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003',
    '[{"segment": "run_1", "duration_s": 300}, {"segment": "run_1", "duration_s": 300}]')),
  '22023: Ungültige Werte im Tagebuch.', 'Abschnitt doppelt abgelehnt');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003',
    '[{"segment": "run_9", "duration_s": 300}]')),
  '22023: Ungültige Werte im Tagebuch.', 'unbekannter Abschnitt abgelehnt');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003',
    (select jsonb_agg(jsonb_build_object('segment', 'run_1', 'duration_s', 10)) from generate_series(1, 18)))),
  '22023: Ungültige Werte im Tagebuch.', 'mehr als 17 Teilzeiten abgelehnt');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003', '[]', '{"name_de": "Lauf"}')),
  '22023: Ungültige Werte im Tagebuch.', 'Name fest „Hyrox-Rennen“');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003', '[]',
    '{"cardio": {"modality": "bike", "duration_s": 5400, "distance_m": 8000, "elevation_m": null}}')),
  '22023: Ungültige Werte im Tagebuch.', 'Hyrox-Rennen nur als Lauf-Einheit');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000003', '[]', '{"is_free": false}')),
  '22023: Ungültige Werte im Tagebuch.', 'Hyrox-Rennen nur als freie Einheit');
select is(pg_temp.log_error(pg_temp.race('b0000000-0000-4000-8000-000000000001', null,
    '{"name_de": "Lauf", "base_revision": 1}')),
  '22023: Ungültige Werte im Tagebuch.', 'Hyrox-Rennen wird nie zum normalen Lauf (Art bleibt)');
select is(public.save_session_log(pg_temp.race('b0000000-0000-4000-8000-000000000004', null,
    '{"name_de": "Lauf"}') - 'hyrox_splits') ->> 'result', 'ok',
  'ältere Fassung ohne Feld hyrox_splits: normaler Lauf wie bisher');
select ok(
  (select bool_and(s ? 'hyrox_splits') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'session_logs') s)
  and (select bool_and(c ? 'hyrox_division') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'competitions') c),
  'Export: hyrox_splits und hyrox_division (ganze Zeilen)');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.session_logs) + (select count(*)::integer from public.competitions), 0,
  'B sieht keine Hyrox-Einträge oder Wettkämpfe von A (RLS unverändert)');
reset role;

select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, hyrox_splits)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', '2026-10-07', 'completed',
       'Hyrox-Rennen', gen_random_uuid(), now(), true, '[]') $$,
  '23514', null, 'CHECK: Teilzeiten nur an einer freien Ausdauer-Einheit');

select * from finish();
rollback;
