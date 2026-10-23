-- E-Bike beim Radfahren (Migration 20261023140000_e_bike.sql, Gründer-Wunsch 23.10.2026):
-- - Spalten cardio_logs.e_bike und tracked_routes.e_bike: not null, Standard false, CHECK „nur beim Rad“,
-- - save_session_log: optionales Feld cardio.e_bike (fehlt = false), nur beim Rad, nur boolesch; verknüpfte Strecke
--   folgt dem Eintrag,
-- - save_tracked_route: optionales Feld e_bike, nur beim Rad, nur boolesch; verknüpfter Rad-Eintrag folgt,
-- - update_tracked_route: e_bike optional (fehlt = unverändert), Eintrag folgt (Revision + 1),
-- - RLS unverändert (B sieht nichts von A), Export enthält e_bike, Fehlermeldungen ohne Werte.
-- Zeiten relativ zu now() (Strecken dürfen nicht in der Zukunft liegen).
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

-- Beginn der Test-Strecken: vor 3 Stunden (UTC, ISO wie toISOString()); Tag = Berliner Datum dieses Beginns.
create function pg_temp.start_iso() returns text language sql as $$
  select to_char((now() - interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"')
$$;
create function pg_temp.start_day() returns date language sql as $$
  select ((now() - interval '3 hours') at time zone 'Europe/Berlin')::date
$$;
-- Polyline mit 3 Punkten (Google-Format, wie 42_tracked_routes.test.sql).
create function pg_temp.enc(p_value bigint) returns text language plpgsql as $$
declare
  z bigint := case when p_value < 0 then -2 * p_value - 1 else 2 * p_value end;
  out text := '';
begin
  while z >= 32 loop
    out := out || chr(((z % 32) + 32 + 63)::integer);
    z := z / 32;
  end loop;
  return out || chr((z + 63)::integer);
end;
$$;
create function pg_temp.poly3() returns text language sql as $$
  select pg_temp.enc(5094130) || pg_temp.enc(695830) || pg_temp.enc(10) || pg_temp.enc(0) || pg_temp.enc(10)
    || pg_temp.enc(0)
$$;
-- Freie Radfahrt (wie freeSessionPayload): 30 min, 15 km; p_cardio ergänzt/ersetzt Felder des cardio-Teils.
create function pg_temp.ride(p_id text, p_cardio jsonb default '{}', p_changes jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null, 'planned_session_id', null,
    'planned_date', pg_temp.start_day(), 'kind', 'endurance', 'performed_on', pg_temp.start_day(),
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 3, 'notes', null,
    'name_de', 'Radfahrt', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-23T12:00:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('modality', 'bike', 'duration_s', 1800, 'distance_m', 15000, 'elevation_m', null)
      || p_cardio,
    'is_free', true
  ) || p_changes
$$;
-- Rad-Strecke (trackedRouteSchema): 15 km in 30 min.
create function pg_temp.route(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Feierabendrunde', 'sport', 'bike', 'started_at', pg_temp.start_iso(),
    'duration_s', 1800, 'moving_s', 1800, 'distance_m', 15000, 'elevation_gain_m', null,
    'polyline', pg_temp.poly3(), 'km_splits', (select jsonb_agg(110) from generate_series(1, 15)),
    'difficulty', null, 'is_favorite', false, 'base_route_id', null, 'note', null, 'session_log_id', null,
    'source', 'recorded'
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
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Spalten und CHECKs
-- ---------------------------------------------------------------------------------------------------------
select col_not_null('public', 'cardio_logs', 'e_bike', 'cardio_logs.e_bike not null');
select col_default_is('public', 'cardio_logs', 'e_bike', 'false', 'cardio_logs.e_bike: Standard false');
select col_not_null('public', 'tracked_routes', 'e_bike', 'tracked_routes.e_bike not null');
select col_default_is('public', 'tracked_routes', 'e_bike', 'false', 'tracked_routes.e_bike: Standard false');
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at,
  is_free)
values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'endurance',
  pg_temp.start_day(), 'completed', 'Lauf', gen_random_uuid(), now(), true);
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m, e_bike)
     values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'run', 1800, 5000,
             true) $$,
  '23514', null, 'CHECK: E-Bike nur beim Rad (auch für service_role/Eigentümer)');
delete from public.session_logs where id = 'a0000000-0000-4000-8000-0000000000f1';
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('save_session_log', 'update_tracked_route', 'save_tracked_route')),
  'Funktionen weiter security definer, search_path leer, nur authenticated');

-- ---------------------------------------------------------------------------------------------------------
-- save_session_log
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.save_session_log(pg_temp.ride('a0000000-0000-4000-8000-000000000001', '{"e_bike": true}'))
  ->> 'result', 'ok', 'Radfahrt mit E-Bike gespeichert');
select is((select e_bike from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000001'),
  true, '… cardio_logs.e_bike = true');
select is(public.save_session_log(pg_temp.ride('a0000000-0000-4000-8000-000000000002')) ->> 'result', 'ok',
  'ältere Fassung ohne e_bike bleibt gültig');
select is((select e_bike from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000002'),
  false, '… fehlt = normales Rad');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.ride('a0000000-0000-4000-8000-000000000003', '{"modality": "run", "distance_m": 5000, "e_bike": true}',
      '{"name_de": "Lauf"}'))),
  '23514: Ungültige Werte im Tagebuch.', 'E-Bike beim Laufen abgelehnt (ohne Werte)');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.ride('a0000000-0000-4000-8000-000000000004', '{"e_bike": "ja"}'))),
  '22023: Ungültige Werte im Tagebuch.', 'e_bike nicht boolesch abgelehnt');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.ride('a0000000-0000-4000-8000-000000000005', '{"e_bike": null}'))),
  '22023: Ungültige Werte im Tagebuch.', 'e_bike null abgelehnt (fehlen ja, null nein – wie Zod)');
select is(public.save_session_log(pg_temp.ride('a0000000-0000-4000-8000-000000000003',
    '{"modality": "run", "distance_m": 5000, "e_bike": false}', '{"name_de": "Lauf"}')) ->> 'result', 'ok',
  'Laufen mit e_bike false ok');

-- ---------------------------------------------------------------------------------------------------------
-- save_tracked_route
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', pg_temp.route(
    '{"id": "c0000000-0000-4000-8000-000000000001", "e_bike": true,
      "session_log_id": "a0000000-0000-4000-8000-000000000002"}'))),
  'kein Fehler', 'E-Bike-Strecke mit Verknüpfung zum (Fahrrad-)Eintrag gespeichert');
select is((select e_bike from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'), true,
  '… tracked_routes.e_bike = true');
select is((select e_bike from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000002'),
  true, '… verknüpfter Rad-Eintrag folgt der Strecke');
select is(pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', pg_temp.route(
    '{"id": "c0000000-0000-4000-8000-000000000002"}'))),
  'kein Fehler', 'Strecke ohne e_bike (ältere Fassung) gespeichert');
select is((select e_bike from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000002'), false,
  '… fehlt = normales Rad');
select is(pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', pg_temp.route(
    '{"sport": "run", "distance_m": 5000, "km_splits": [300, 300, 300, 300, 300], "e_bike": true}'))),
  '23514: Ungültige Angaben zur Strecke.', 'E-Bike beim Laufen abgelehnt (ohne Werte)');
select is(pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', pg_temp.route(
    '{"e_bike": "ja"}'))),
  '22023: Ungültige Angaben zur Strecke.', 'e_bike nicht boolesch abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- update_tracked_route und Bearbeiten des Eintrags
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.update_tracked_route(jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000001',
    'name', 'Neu', 'difficulty', null, 'is_favorite', false, 'note', null)) $$,
  'Ändern ohne e_bike (ältere Fassung)');
select is((select e_bike from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'), true,
  '… e_bike unverändert');
create temp table rev_before as
  select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000002';
select lives_ok($$ select public.update_tracked_route(jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000001',
    'name', 'Neu', 'difficulty', null, 'is_favorite', false, 'note', null, 'e_bike', false)) $$,
  'auf Fahrrad umstellen');
select results_eq(
  $$ select t.e_bike, cl.e_bike, sl.revision = (select revision + 1 from rev_before)
     from public.tracked_routes t
     join public.cardio_logs cl on cl.session_log_id = t.session_log_id
     join public.session_logs sl on sl.id = t.session_log_id
     where t.id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values (false, false, true) $$, '… Strecke und Eintrag Fahrrad, Revision + 1');
select is(public.save_session_log(pg_temp.ride('a0000000-0000-4000-8000-000000000002', '{"e_bike": true}',
    jsonb_build_object('base_revision',
      (select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000002'),
      'source', 'gps'))) ->> 'result', 'ok',
  'Eintrag bearbeiten: auf E-Bike umstellen');
select is((select e_bike from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'), true,
  '… verknüpfte Strecke folgt dem Eintrag');
select is(pg_temp.error_of($$ select public.update_tracked_route(jsonb_build_object('id',
    'c0000000-0000-4000-8000-000000000001', 'name', 'Neu', 'difficulty', null, 'is_favorite', false, 'note', null,
    'e_bike', 'ja')) $$),
  '22023: Ungültige Angaben zur Strecke.', 'update: e_bike nicht boolesch abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Fremde Nutzer, Export
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.cardio_logs) + (select count(*)::integer from public.tracked_routes),
  0, 'B sieht keine Einträge/Strecken von A (RLS unverändert)');
select is(pg_temp.error_of($$ select public.update_tracked_route(jsonb_build_object('id',
    'c0000000-0000-4000-8000-000000000001', 'name', 'Fremd', 'difficulty', null, 'is_favorite', false, 'note', null,
    'e_bike', false)) $$),
  '42501: Strecke nicht gefunden.', 'fremde Strecke umstellen abgelehnt');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select e_bike from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'), true,
  '… A unverändert E-Bike');
select ok(
  (select bool_and(c ? 'e_bike') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'cardio_logs') c)
  and (select bool_and(t ? 'e_bike') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') t),
  'Export: e_bike in cardio_logs und tracked_routes');
select is(
  (select count(*)::integer from jsonb_array_elements(public.export_my_data() -> 'data' -> 'cardio_logs') c
   where (c ->> 'e_bike')::boolean),
  2, 'Export: zwei E-Bike-Einträge');

reset role;
select * from finish();
rollback;
