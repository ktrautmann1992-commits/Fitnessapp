-- Sportarten Stufe 2 (Migrationen 20261025130000_sport_enums.sql und 20261025130100_sportarten.sql,
-- docs/PLAN-SPORTARTEN.md):
-- - Typ sport_type, Spalten session_logs.sport / sport_duration_s / sport_distance_m (alle null bei Kraft/Ausdauer),
--   CHECKs (Dauer 1 min–12 h, Distanz 0–500 km nur bei GPS-Sportarten, nur freie Einheit „strength“),
-- - save_session_log: optionales Feld `sport` (fehlt/null = wie bisher), Name aus der festen Liste, keine Übungen,
--   keine Ausdauer, nur Herkunft „manual“, Art wechselt nie; Fehlermeldungen ohne Werte,
-- - RLS unverändert (B sieht nichts von A), Export enthält die Spalten.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;

create function pg_temp.today() returns date language sql as $$
  select (now() at time zone 'Europe/Berlin')::date
$$;
-- Sportart-Eintrag wie sportSessionLogFromInput: Padel 60 min, Anstrengung 6. p_sport ergänzt/ersetzt Felder des
-- sport-Teils, p_changes Felder des Eintrags.
create function pg_temp.sport(p_id text, p_sport jsonb default '{}', p_changes jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null, 'planned_session_id', null,
    'planned_date', pg_temp.today(), 'kind', 'strength', 'performed_on', pg_temp.today(),
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 6, 'notes', null,
    'name_de', 'Padel', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-25T12:00:00+02:00', 'exercises', '[]'::jsonb, 'cardio', null,
    'is_free', true,
    'sport', jsonb_build_object('sport', 'padel', 'duration_s', 3600, 'distance_m', null) || p_sport
  ) || p_changes
$$;
-- Freier Lauf (ältere Fassung OHNE Feld sport).
create function pg_temp.run(p_id text) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null, 'planned_session_id', null,
    'planned_date', pg_temp.today(), 'kind', 'endurance', 'performed_on', pg_temp.today(),
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 3, 'notes', null,
    'name_de', 'Lauf', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-25T12:00:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('modality', 'run', 'duration_s', 1800, 'distance_m', 5000, 'elevation_m', null),
    'is_free', true
  )
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
create function pg_temp.save_error(p_log jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_session_log(%L::jsonb)', p_log))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Typ, Spalten und CHECKs
-- ---------------------------------------------------------------------------------------------------------
select is(array_length(enum_range(null::public.sport_type), 1), 27, 'sport_type: 27 Sportarten (inkl. other)');
select col_is_null('public', 'session_logs', 'sport', 'session_logs.sport darf null sein');
select col_type_is('public', 'session_logs', 'sport_duration_s', 'integer', 'sport_duration_s integer');
select col_type_is('public', 'session_logs', 'sport_distance_m', 'integer', 'sport_distance_m integer');
select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, sport, sport_duration_s)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'endurance', pg_temp.today(), 'completed',
       'Padel', gen_random_uuid(), now(), true, 'padel', 3600) $$,
  '23514', null, 'CHECK: Sportart nur bei Art strength (auch für Eigentümer)');
select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, sport, sport_duration_s, sport_distance_m)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', pg_temp.today(), 'completed',
       'Padel', gen_random_uuid(), now(), true, 'padel', 3600, 1000) $$,
  '23514', null, 'CHECK: Distanz nur bei GPS-Sportarten');
select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, sport, sport_duration_s)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', pg_temp.today(), 'completed',
       'Padel', gen_random_uuid(), now(), false, 'padel', 3600) $$,
  '23514', null, 'CHECK: Sportart nur als freie Einheit');
select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, sport, sport_duration_s)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', pg_temp.today(), 'completed',
       'Padel', gen_random_uuid(), now(), true, 'padel', 59) $$,
  '23514', null, 'CHECK: Dauer mindestens 1 Minute');
select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free, sport)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', pg_temp.today(), 'completed',
       'Padel', gen_random_uuid(), now(), true, 'padel') $$,
  '23514', null, 'CHECK: Sportart ohne Dauer abgelehnt');
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute')
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'save_session_log'),
  'save_session_log weiter security definer, search_path leer, nur authenticated');

-- ---------------------------------------------------------------------------------------------------------
-- save_session_log
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.save_session_log(pg_temp.sport('a0000000-0000-4000-8000-000000000001')) ->> 'result', 'ok',
  'Padel 60 min gespeichert');
select results_eq(
  $$ select kind::text, sport::text, sport_duration_s, sport_distance_m, session_rpe::integer, is_free, name_de
     from public.session_logs where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('strength', 'padel', 3600, null::integer, 6, true, 'Padel') $$,
  '… als freie Einheit strength mit Sportart, Dauer und Anstrengung');
select is((select count(*)::integer from public.exercise_logs where session_log_id = 'a0000000-0000-4000-8000-000000000001')
  + (select count(*)::integer from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000001'),
  0, '… ohne Übungen und ohne Ausdauer');
select is(public.save_session_log(pg_temp.sport('a0000000-0000-4000-8000-000000000002',
    '{"sport": "kayaking", "distance_m": 8000}', '{"name_de": "Kajak/Kanu"}')) ->> 'result', 'ok',
  'Kajak/Kanu (GPS-Sportart) mit Distanz gespeichert');
select is((select sport_distance_m from public.session_logs where id = 'a0000000-0000-4000-8000-000000000002'),
  8000, '… Distanz gespeichert');
select is(public.save_session_log(pg_temp.run('a0000000-0000-4000-8000-000000000003')) ->> 'result', 'ok',
  'ältere Fassung ohne Feld sport bleibt gültig');
select is((select sport from public.session_logs where id = 'a0000000-0000-4000-8000-000000000003'), null,
  '… sport null');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{}',
    '{"name_de": "Tennis"}')),
  '22023: Ungültige Werte im Tagebuch.', 'falscher Name abgelehnt (feste Liste)');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{"distance_m": 1000}')),
  '22023: Ungültige Werte im Tagebuch.', 'Distanz bei Padel abgelehnt');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{"sport": "curling"}',
    '{"name_de": "Curling"}')),
  '22023: Ungültige Werte im Tagebuch.', 'unbekannte Sportart abgelehnt (ohne Werte)');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{"duration_s": 30}')),
  '23514: Ungültige Werte im Tagebuch.', 'Dauer unter 1 Minute abgelehnt');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{"extra": 1}')),
  '22023: Ungültige Werte im Tagebuch.', 'unbekanntes Feld im sport-Teil abgelehnt');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{}', '{"kind": "endurance",
    "cardio": {"modality": "run", "duration_s": 3600, "distance_m": null, "elevation_m": null}}')),
  '22023: Ungültige Werte im Tagebuch.', 'Sportart mit Ausdauer abgelehnt');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{}', '{"is_free": false}')),
  '22023: Ungültige Werte im Tagebuch.', 'Sportart nur als freie Einheit');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{}', '{"status": "partial"}')),
  '22023: Ungültige Werte im Tagebuch.', 'Sportart nur „completed“');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000004', '{}',
    jsonb_build_object('performed_on', pg_temp.today() + 1, 'planned_date', pg_temp.today() + 1))),
  '22023: Das Datum liegt außerhalb des erlaubten Zeitraums.', 'nie in der Zukunft');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000003', '{}',
    jsonb_build_object('base_revision', 1))),
  '22023: Ungültige Werte im Tagebuch.', 'Lauf wird nie zur Sportart (Art wechselt nie)');
select is(public.save_session_log(pg_temp.sport('a0000000-0000-4000-8000-000000000001', '{"duration_s": 5400}',
    '{"base_revision": 1, "session_rpe": 8}')) ->> 'result', 'ok', 'Sportart-Eintrag ändern (90 min, Anstrengung 8)');
select results_eq(
  $$ select sport_duration_s, session_rpe::integer, revision from public.session_logs
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (5400, 8, 2) $$, '… Dauer, Anstrengung, Revision + 1');

-- ---------------------------------------------------------------------------------------------------------
-- Fremde Nutzer, Export
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.session_logs), 0, 'B sieht keine Einträge von A (RLS unverändert)');
select is(pg_temp.save_error(pg_temp.sport('a0000000-0000-4000-8000-000000000001', '{}',
    '{"base_revision": 2}')),
  'kein Fehler', 'B mit fremder id: kein Fehler, kein Zugriff auf A');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select sport_duration_s from public.session_logs where id = 'a0000000-0000-4000-8000-000000000001'),
  5400, '… A unverändert');
select ok(
  (select bool_and(s ? 'sport' and s ? 'sport_duration_s' and s ? 'sport_distance_m')
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'session_logs') s),
  'Export: Sportart-Spalten in session_logs');

reset role;
select * from finish();
rollback;
