-- Phase 10 · Etappe WP5 (docs/PLAN-PHASE-10.md Abschnitt 9, W-G2): Rad und Triathlon Sprint/Olympisch.
-- - Enums: competition_discipline um cycling/triathlon_sprint/triathlon_olympic, workout_type um brick/technique,
--   Mittel-/Langdistanz und Schwimmen haben KEINEN Wert (kein Wettkampfplan, Hinweis Trainer/Verein),
-- - save_competition: Rad nur mit distance_km 20–300 (ganze km, distance_m = km × 1000), sonst keine km; Rad/Triathlon
--   nur „Ankommen“ ohne Referenzzeit; Mindestvorlauf des Servers je Distanzklasse; ältere Eingabe ohne distance_km
--   bleibt gültig; unter 18 mit Plan-Bezug kein Triathlon Olympisch und kein Rad über 100 km (Countdown ohne Bezug geht),
-- - planned_sessions: Koppeltraining nur als Rad-Einheit, Schwimmtechnik nur beim Schwimmen, beide locker (≤ 4),
-- - private.insert_plan_sessions: Distanz-Deckel je Disziplin, unter 18 je Disziplin aus dem Wettkampf,
-- - RLS unverändert (fremde Wettkämpfe unsichtbar), Export enthält die Rad-Distanz.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A, B, C, T: 36 Jahre mit Check. Y, Z, W, R: 17 Jahre mit Check. Alle mit Einwilligung health_data.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-t@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-y@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'nutzer-z@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'nutzer-w@example.test'),
  ('88888888-8888-4888-8888-888888888888', 'nutzer-r@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u.id, t, 1, 'web'
from auth.users u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date)
select u.id, case when u.email in ('nutzer-y@example.test', 'nutzer-z@example.test', 'nutzer-w@example.test',
  'nutzer-r@example.test') then date '2009-06-01' else date '1990-01-01' end
from auth.users u;
insert into public.health_screening (user_id, medical_notice_acknowledged_at, answers)
select u.id, now(), jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
  'dizziness', false, 'blood_pressure', false, 'bone_joint', false, 'medication', false, 'other_reason', false,
  'pregnancy', false)
from auth.users u;

-- Eingabe wie toSaveCompetitionPayload() (packages/core), Rad 100 km am Sonntag, 10.01.2027, „Ankommen“.
create function pg_temp.comp(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', null, 'name', 'Radmarathon', 'discipline', 'cycling', 'distance_km', 100, 'race_date', '2027-01-10',
    'goal_kind', 'finish', 'target_time_s', null, 'reference_discipline', null, 'reference_time_s', null,
    'reference_date', null, 'long_run_weekday', null, 'own_start_weekly_minutes', null, 'start_reference_volume', null,
    'start_reference_session_cap', null, 'start_reference_start_group', null, 'effective_goal', null
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
create function pg_temp.planned_id(p_user uuid) returns uuid language sql security definer as $$
  select id from public.competitions where user_id = p_user and status = 'planned'
$$;
grant execute on function pg_temp.planned_id(uuid) to authenticated;
-- Plan-Bezug („Ankommen“) für den Wettkampfplan.
create function pg_temp.basis() returns jsonb language sql as $$
  select '{"effective_goal": "finish"}'::jsonb
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------------------------------------
-- Sportarten Stufe 1 (20261027100000) hängt hyrox bzw. hyrox_combo hinten an (Test 93).
select is(
  enum_range(null::public.competition_discipline)::text[],
  array['5k', '10k', 'half_marathon', 'marathon', 'cycling', 'triathlon_sprint', 'triathlon_olympic', 'hyrox'],
  'Disziplinen: Laufen, Rad, Triathlon Sprint/Olympisch (+ Hyrox) – keine Mittel-/Langdistanz, kein Schwimmen');
select is(
  enum_range(null::public.workout_type)::text[],
  array['easy', 'recovery', 'long', 'strides', 'fartlek', 'tempo', 'intervals', 'race_pace', 'brick', 'technique',
    'hyrox_combo'],
  'Arten: Koppeltraining und Schwimmtechnik dazu (+ Hyrox-Kombi)');

-- ---------------------------------------------------------------------------------------------------------
-- save_competition: Rad-Distanz
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.save(pg_temp.comp('{"distance_km": null}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad ohne Distanz abgelehnt');
select is(pg_temp.save(pg_temp.comp() - 'distance_km'), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad ohne Feld distance_km abgelehnt');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 19}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad 19 km abgelehnt');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 301}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad 301 km abgelehnt');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 100.5}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad nur ganze Kilometer');
select is(pg_temp.save(pg_temp.comp('{"distance_km": "100"}')), '22023: Ungültige Angaben zum Wettkampf.',
  'Rad-Distanz als Text abgelehnt');
select is(pg_temp.save(pg_temp.comp('{"discipline": "10k", "distance_km": 10}')),
  '22023: Ungültige Angaben zum Wettkampf.', 'Laufen mit km abgelehnt (Distanz aus der Disziplin)');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_long", "distance_km": null}')),
  '22023: Ungültige Angaben zum Wettkampf.', 'Triathlon Langdistanz: kein Wettkampf mit Plan (W-G2)');
select is(pg_temp.save(pg_temp.comp('{"discipline": "swimming", "distance_km": null}')),
  '22023: Ungültige Angaben zum Wettkampf.', 'Schwimm-Wettkampf: kein Wettkampf mit Plan (W-G2)');
select is(pg_temp.save(pg_temp.comp('{"goal_kind": "time", "target_time_s": 14400, "reference_discipline": "10k",
  "reference_time_s": 3000, "reference_date": "2026-09-01"}')), '23514: Ungültige Angaben zum Wettkampf.',
  'Rad: keine Zielzeit (nur „Ankommen“)');
select is(pg_temp.save(pg_temp.comp('{"reference_discipline": "10k", "reference_time_s": 3000,
  "reference_date": "2026-09-01"}')), '23514: Ungültige Angaben zum Wettkampf.', 'Rad: keine Referenzzeit');
-- Server-Mindestvorlauf je Distanzklasse (lockerste Spalte): bis 60 km 6, bis 120 km 8, bis 200 km 14, bis 300 km 18.
select is(pg_temp.save(pg_temp.comp('{"distance_km": 60, "race_date": "2026-11-17"}')),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Rad 60 km: 6 Wochen − 1 Tag zu kurz');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 61, "race_date": "2026-11-18"}')),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Rad 61 km: nächste Klasse (8 Wochen)');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 300, "race_date": "2027-02-09"}')),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Rad 300 km: 18 Wochen − 1 Tag zu kurz');
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'Rad 100 km (8 Wochen Vorlauf erfüllt) gespeichert');
reset role;
select results_eq(
  $$ select discipline::text, distance_m, goal_kind::text from public.competitions
     where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('cycling', 100000.0::numeric, 'finish') $$,
  'distance_m = km × 1000');
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(
  pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.planned_id('11111111-1111-4111-8111-111111111111'),
    'distance_km', 200))),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Distanz ändern prüft den Renntag neu (200 km: 14 Wochen)');
select is(
  pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.planned_id('11111111-1111-4111-8111-111111111111'),
    'distance_km', 120, 'name', 'Neu'))),
  'kein Fehler', 'Ändern innerhalb der Klasse (120 km, 8 Wochen) geht');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 300, "race_date": "2027-02-10"}')),
  '23505: Es gibt schon einen geplanten Wettkampf.', 'weiterhin höchstens ein geplanter Wettkampf');

-- Triathlon
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_sprint", "distance_km": 20}')),
  '22023: Ungültige Angaben zum Wettkampf.', 'Triathlon ohne km');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_sprint", "distance_km": null,
  "reference_discipline": "5k", "reference_time_s": 1500, "reference_date": "2026-09-01"}')),
  '23514: Ungültige Angaben zum Wettkampf.', 'Triathlon: keine Referenzzeit');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_olympic", "distance_km": null,
  "race_date": "2027-01-24"}')), '22023: Bis zum Renntag ist zu wenig Zeit.', 'Olympisch: 16 Wochen − 3 Tage zu kurz');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_sprint", "distance_km": null}')
  || pg_temp.basis()), 'kein Fehler', 'Triathlon Sprint mit Plan-Bezug gespeichert');
reset role;
select results_eq(
  $$ select discipline::text, distance_m, uses_health_data from public.competitions
     where user_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values ('triathlon_sprint', 25750.0::numeric, true) $$,
  'Sprint: 750 m + 20 km + 5 km');

-- Ältere Eingabe ohne distance_km (Laufen) bleibt gültig.
set local role authenticated;
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is(pg_temp.save(pg_temp.comp('{"discipline": "10k"}') - 'distance_km'), 'kein Fehler',
  'Laufen ohne Feld distance_km (ältere App) gespeichert');
select is(pg_temp.save(pg_temp.comp('{"unbekannt": 1}')),
  '22023: Unbekanntes Feld in der Eingabe (Wettkampf).', 'unbekannte Felder weiter abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Unter 18 (Tabelle 3.3 sinngemäß): mit Plan-Bezug Triathlon nur Sprint, Rad höchstens 100 km
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_olympic", "distance_km": null,
  "race_date": "2027-02-14"}') || pg_temp.basis()), '22023: Für diese Distanz gibt es noch keinen Wettkampfplan.',
  'unter 18: kein Wettkampfplan Triathlon Olympisch');
select is(pg_temp.save(pg_temp.comp('{"distance_km": 101}') || pg_temp.basis()),
  '22023: Für diese Distanz gibt es noch keinen Wettkampfplan.', 'unter 18: kein Wettkampfplan Rad über 100 km');
select is(pg_temp.save(pg_temp.comp() || pg_temp.basis()), 'kein Fehler', 'unter 18: Rad 100 km mit Plan-Bezug');
select pg_temp.as_user('66666666-6666-4666-8666-666666666666');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_sprint", "distance_km": null}') || pg_temp.basis()),
  'kein Fehler', 'unter 18: Triathlon Sprint mit Plan-Bezug');
select pg_temp.as_user('77777777-7777-4777-8777-777777777777');
select is(pg_temp.save(pg_temp.comp('{"discipline": "triathlon_olympic", "distance_km": null,
  "race_date": "2027-02-14"}')), 'kein Fehler', 'unter 18: Olympisch nur als Countdown (ohne Plan-Bezug) speicherbar');

-- RLS unverändert: fremde Wettkämpfe unsichtbar.
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.competitions), 1, 'A sieht nur den eigenen Wettkampf');
select is((select (public.export_my_data() -> 'data' -> 'competitions' -> 0 ->> 'distance_m')::numeric), 120000.0,
  'Export enthält die Rad-Distanz');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- CHECKs direkt (Service-Rolle)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date)
  values ('44444444-4444-4444-8444-444444444444', 'Rad', 'cycling', 250500, '2027-03-07') $$,
  '23514', null, 'Rad-Distanz nur in ganzen km');
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date)
  values ('44444444-4444-4444-8444-444444444444', 'Rad', 'cycling', 310000, '2027-03-07') $$,
  '23514', null, 'Rad höchstens 300 km');
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date)
  values ('44444444-4444-4444-8444-444444444444', 'Tri', 'triathlon_olympic', 25750, '2027-03-07') $$,
  '23514', null, 'Triathlon-Distanz aus der Disziplin');

-- Geplante Wettkämpfe mit Plan-Bezug für die Einheiten-Tests: T Triathlon Sprint (36 J.), R Olympisch (17 J., nur
-- direkt eingefügt – save_competition hätte das abgelehnt).
insert into public.competitions (user_id, name, discipline, distance_m, race_date, effective_goal, uses_health_data)
values ('44444444-4444-4444-8444-444444444444', 'Sprint', 'triathlon_sprint', 25750, '2027-04-11', 'finish', true),
  ('88888888-8888-4888-8888-888888888888', 'Olympisch', 'triathlon_olympic', 51500, '2027-04-11', 'finish', true);

-- ---------------------------------------------------------------------------------------------------------
-- Einheiten (save_training_plan → private.insert_plan_sessions)
-- ---------------------------------------------------------------------------------------------------------
-- Locker: 5 min (2), Hauptteil (4), 5 min (2) – wie easySteps(); Summe = Dauer.
create function pg_temp.easy_steps(p_minutes integer, p_effort integer default 4) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('part', 'warmup', 'kind', 'easy', 'seconds', 300, 'effort', 2),
    jsonb_build_object('part', 'main', 'kind', 'easy', 'seconds', p_minutes * 60 - 600, 'effort', p_effort),
    jsonb_build_object('part', 'cooldown', 'kind', 'easy', 'seconds', 300, 'effort', 2))
$$;
create function pg_temp.session(p_type text, p_modality text, p_minutes integer default 40,
  p_effort integer default 4, p_day integer default 0) returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Koppeltraining Rad → Lauf',
    'focus', null, 'endurance_modality', p_modality, 'effort_target', least(p_effort, 4),
    'estimated_minutes', p_minutes, 'warmup_de', '5 Minuten locker einrollen.', 'cooldown_de', '5 Minuten locker.',
    'exercises', '[]'::jsonb, 'workout_type', p_type, 'training_phase', 'build',
    'workout_steps', pg_temp.easy_steps(p_minutes, p_effort), 'target_distance_m', null)
$$;
create function pg_temp.plan(p_sessions jsonb, p_discipline text default 'triathlon_sprint') returns jsonb
language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '[]'::jsonb,
    'uses_health_data', true, 'medical_notice', false,
    'inputs', jsonb_build_object('goalType', 'endurance', 'discipline', p_discipline, 'experienceLevel', 'advanced',
      'schedule', '{"mode": "flex", "slots": [{"kind": "endurance", "minutes": 60}, {"kind": "endurance", "minutes": 60}, {"kind": "endurance", "minutes": 120}]}'::jsonb,
      'trainingLocation', null, 'homeEquipment', '[]'::jsonb),
    'start_date', '2026-10-07', 'sessions', p_sessions)
$$;
create function pg_temp.save_plan(p_payload jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_training_plan(%L::jsonb)', p_payload))
$$;

set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('brick', 'run')))),
  '23514: Ungültige Werte im Plan.', 'Koppeltraining nur als Rad-Einheit');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('technique', 'bike')))),
  '23514: Ungültige Werte im Plan.', 'Schwimmtechnik nur beim Schwimmen');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('brick', 'bike', 40, 6)))),
  '23514: Ungültige Werte im Plan.', 'Koppeltraining ist locker (kein Abschnitt über 4)');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('technique', 'swim', 40, 5)))),
  '23514: Ungültige Werte im Plan.', 'Schwimmtechnik ist locker (kein Abschnitt über 4)');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('long', 'bike', 121, 4, 6)))),
  '23514: Die Einheit ist für diese Distanz zu lang.', 'Sprint: lange Ausfahrt höchstens 120 min');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('brick', 'bike', 40),
  pg_temp.session('technique', 'swim', 30, 4, 1), pg_temp.session('long', 'bike', 120, 4, 6)))),
  'kein Fehler', 'Triathlon-Woche mit Koppeltraining, Schwimmtechnik und langer Ausfahrt gespeichert');
select is(
  pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('easy', 'bike', 40)), 'triathlon_olympic')),
  '23514: Der Plan passt nicht zum geplanten Wettkampf.', 'Disziplin des Plans = Disziplin des Wettkampfs');
reset role;
select results_eq(
  $$ select workout_type::text, endurance_modality::text from public.planned_sessions
     where user_id = '44444444-4444-4444-8444-444444444444' order by scheduled_on $$,
  $$ values ('brick', 'bike'), ('technique', 'swim'), ('long', 'bike') $$,
  'gespeicherte Arten und Modalitäten');

set local role authenticated;
select pg_temp.as_user('88888888-8888-4888-8888-888888888888');
select is(pg_temp.save_plan(pg_temp.plan(jsonb_build_array(pg_temp.session('easy', 'bike', 40)),
  'triathlon_olympic')), '23514: Für diese Distanz gibt es noch keinen Wettkampfplan.',
  'unter 18: keine Wettkampf-Einheiten für Triathlon Olympisch');
reset role;

select * from finish();
rollback;
