-- Sportarten Stufe 1 · Rudern, Wandern/Bergwandern, Yoga/Pilates (Migrationen 20261027100000–20261027100200,
-- docs/PLAN-SPORTARTEN-STUFE-1.md 2.2–2.4 und 3):
-- - Enums: endurance_modality + row, walk_kind, sport_type + yoga/pilates, caution_tag + inversion, workout_category +
--   yoga/pilates/rowing, workout_format + flow,
-- - cardio_logs: avg_power_w (1–1000), stroke_rate (10–60), intervals (1–30) nur bei row; walk_kind nur bei walk,
-- - save_session_log: Rudern („Rudern“), Wandern (Name je Art), Sportart Yoga; ältere Fassungen bleiben gültig,
-- - tracked_routes: walk_kind, elevation_loss_m, max_altitude_m, sac_grade (nur Wandern/Bergwandern); save_ und
--   update_tracked_route mit optionalen Feldern; verknüpfter Geh-Eintrag folgt der Strecke und umgekehrt,
-- - RLS unverändert, Export enthält die neuen Spalten, Fehlermeldungen ohne Werte.
-- Zeiten relativ zu now() (Strecken dürfen nicht in der Zukunft liegen).
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

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
-- Freie Ausdauer-Einheit (wie freeSessionPayload); p_cardio ergänzt/ersetzt Felder des cardio-Teils.
create function pg_temp.free(p_id text, p_name text, p_cardio jsonb, p_changes jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null, 'planned_session_id', null,
    'planned_date', pg_temp.start_day(), 'kind', 'endurance', 'performed_on', pg_temp.start_day(),
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 4, 'notes', null,
    'name_de', p_name, 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-27T12:00:00+01:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('duration_s', 3600, 'distance_m', 5000, 'elevation_m', null) || p_cardio,
    'is_free', true
  ) || p_changes
$$;
-- Rudern 30 min, 6 km, 180 W, Schlagzahl 24, zwei Intervalle.
create function pg_temp.rowing(p_id text, p_cardio jsonb default '{}', p_name text default 'Rudern') returns jsonb
language sql as $$
  select pg_temp.free(p_id, p_name, jsonb_build_object('modality', 'row', 'duration_s', 1800, 'distance_m', 6000,
    'avg_power_w', 180, 'stroke_rate', 24,
    'intervals', '[{"distance_m": 500, "duration_s": 110}, {"distance_m": 500, "duration_s": 108}]'::jsonb) || p_cardio)
$$;
-- Geh-Strecke (trackedRouteSchema): 5 km in 60 min.
create function pg_temp.route(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Hausberg', 'sport', 'walk', 'started_at', pg_temp.start_iso(),
    'duration_s', 3600, 'moving_s', 3500, 'distance_m', 5000, 'elevation_gain_m', 420,
    'polyline', pg_temp.poly3(), 'km_splits', '[700, 700, 700, 700, 700]'::jsonb,
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
create function pg_temp.log_error(p_log jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_session_log(%L::jsonb)', p_log))
$$;
create function pg_temp.route_error(p_route jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', p_route))
$$;
create function pg_temp.update_error(p_changes jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.update_tracked_route(%L::jsonb)', jsonb_build_object(
    'id', 'c0000000-0000-4000-8000-000000000001', 'name', 'Hausberg', 'difficulty', null, 'is_favorite', false,
    'note', null) || p_changes))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Enums und Spalten
-- ---------------------------------------------------------------------------------------------------------
select ok('row' = any (enum_range(null::public.endurance_modality)::text[]), 'endurance_modality kennt row');
select is(enum_range(null::public.walk_kind)::text[], array['walk', 'hike', 'mountain_hike'],
  'walk_kind: Gehen, Wandern, Bergwandern');
select ok(enum_range(null::public.sport_type)::text[] @> array['yoga', 'pilates'], 'sport_type kennt yoga, pilates');
select ok('inversion' = any (enum_range(null::public.caution_tag)::text[]), 'caution_tag kennt inversion');
select ok(enum_range(null::public.workout_category)::text[] @> array['yoga', 'pilates', 'rowing'],
  'workout_category kennt yoga, pilates, rowing');
select ok('flow' = any (enum_range(null::public.workout_format)::text[]), 'workout_format kennt flow');
select col_type_is('public', 'cardio_logs', 'avg_power_w', 'smallint', 'cardio_logs.avg_power_w smallint');
select col_type_is('public', 'tracked_routes', 'max_altitude_m', 'integer', 'tracked_routes.max_altitude_m integer');

-- CHECKs direkt (auch für Eigentümer/service_role)
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at,
  is_free)
values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'endurance',
  pg_temp.start_day(), 'completed', 'Lauf', gen_random_uuid(), now(), true);
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, avg_power_w)
     values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'run', 1800, 200) $$,
  '23514', null, 'CHECK: Watt nur beim Rudern');
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, stroke_rate)
     values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'row', 1800, 61) $$,
  '23514', null, 'CHECK: Schlagzahl höchstens 60');
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, intervals)
     values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'row', 1800,
       (select jsonb_agg(jsonb_build_object('distance_m', 250, 'duration_s', 50)) from generate_series(1, 31))) $$,
  '23514', null, 'CHECK: höchstens 30 Intervalle');
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, walk_kind)
     values ('a0000000-0000-4000-8000-0000000000f1', '11111111-1111-4111-8111-111111111111', 'run', 1800, 'hike') $$,
  '23514', null, 'CHECK: Art der Geh-Einheit nur beim Gehen');
delete from public.session_logs where id = 'a0000000-0000-4000-8000-0000000000f1';
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('save_session_log', 'save_tracked_route', 'update_tracked_route', 'save_wearable_route',
       'import_wearable_batch', 'save_competition', 'save_app_layout')),
  'neue Fassungen: security definer, search_path leer, nur authenticated');

-- ---------------------------------------------------------------------------------------------------------
-- save_session_log: Rudern, Wandern, Yoga
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(public.save_session_log(pg_temp.rowing('a0000000-0000-4000-8000-000000000001')) ->> 'result', 'ok',
  'Rudern mit Watt, Schlagzahl und Intervallen gespeichert');
select results_eq(
  $$ select modality::text, avg_power_w::integer, stroke_rate::integer, jsonb_array_length(intervals), walk_kind
     from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('row', 180, 24, 2, null::public.walk_kind) $$,
  '… Werte in cardio_logs');
select is(pg_temp.log_error(pg_temp.rowing('a0000000-0000-4000-8000-000000000002', '{}', 'Lauf')),
  '22023: Ungültige Werte im Tagebuch.', 'freier Name beim Rudern fest „Rudern“');
select is(pg_temp.log_error(pg_temp.rowing('a0000000-0000-4000-8000-000000000002', '{"avg_power_w": 0}')),
  '23514: Ungültige Werte im Tagebuch.', 'Watt 0 abgelehnt (ohne Werte)');
select is(pg_temp.log_error(pg_temp.rowing('a0000000-0000-4000-8000-000000000002', '{"avg_power_w": 150.5}')),
  '22P02: Ungültige Werte im Tagebuch.', 'Watt nur ganzzahlig');
select is(pg_temp.log_error(pg_temp.free('a0000000-0000-4000-8000-000000000002', 'Lauf',
    '{"modality": "run", "stroke_rate": 30}')),
  '23514: Ungültige Werte im Tagebuch.', 'Schlagzahl beim Laufen abgelehnt');
select is(pg_temp.log_error(pg_temp.rowing('a0000000-0000-4000-8000-000000000002',
    '{"intervals": [{"distance_m": 500, "duration_s": 110, "split_s": 110}]}')),
  '23514: Ungültige Werte im Tagebuch.', 'Intervall mit fremdem Feld abgelehnt');
select is(public.save_session_log(pg_temp.free('a0000000-0000-4000-8000-000000000003', 'Wanderung',
    '{"modality": "walk", "walk_kind": "hike", "elevation_m": 420}')) ->> 'result', 'ok',
  'Wanderung gespeichert (Name je Art)');
select is(pg_temp.log_error(pg_temp.free('a0000000-0000-4000-8000-000000000004', 'Spaziergang',
    '{"modality": "walk", "walk_kind": "mountain_hike"}')),
  '22023: Ungültige Werte im Tagebuch.', 'Bergwanderung heißt „Bergwanderung“');
select is(public.save_session_log(pg_temp.free('a0000000-0000-4000-8000-000000000005', 'Spaziergang',
    '{"modality": "walk"}')) ->> 'result', 'ok', 'ältere Fassung ohne walk_kind: Spaziergang wie bisher');
select is(pg_temp.log_error(pg_temp.free('a0000000-0000-4000-8000-000000000006', 'Lauf',
    '{"modality": "run", "walk_kind": "hike"}')),
  '23514: Ungültige Werte im Tagebuch.', 'walk_kind beim Laufen abgelehnt');
select is(pg_temp.log_error(pg_temp.free('a0000000-0000-4000-8000-000000000006', 'Spaziergang',
    '{"modality": "walk", "walk_kind": "klettersteig"}')),
  '22023: Ungültige Werte im Tagebuch.', 'unbekannte Art der Geh-Einheit abgelehnt (kein fester Name)');
select is(public.save_session_log(jsonb_build_object(
    'id', 'a0000000-0000-4000-8000-000000000007', 'write_id', gen_random_uuid(), 'base_revision', null,
    'planned_session_id', null, 'planned_date', pg_temp.start_day(), 'kind', 'strength',
    'performed_on', pg_temp.start_day(), 'started_at', null, 'finished_at', null, 'status', 'completed',
    'session_rpe', 3, 'notes', null, 'name_de', 'Yoga', 'is_intro_week', false, 'is_deload', false,
    'source', 'manual', 'client_updated_at', '2026-10-27T12:00:00+01:00', 'exercises', '[]'::jsonb,
    'cardio', null, 'is_free', true,
    'sport', jsonb_build_object('sport', 'yoga', 'duration_s', 3600, 'distance_m', null))) ->> 'result', 'ok',
  'Sportart-Eintrag Yoga gespeichert');

-- ---------------------------------------------------------------------------------------------------------
-- Strecken: save_tracked_route / update_tracked_route
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.route_error(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000002", "walk_kind": "hike",
    "elevation_loss_m": 410, "max_altitude_m": 1650, "sac_grade": 2}')), 'kein Fehler',
  'Wanderung mit Abstieg, höchstem Punkt und SAC-Stufe gespeichert');
select results_eq(
  $$ select walk_kind::text, elevation_loss_m, max_altitude_m, sac_grade::integer from public.tracked_routes
     where id = 'c0000000-0000-4000-8000-000000000002' $$,
  $$ values ('hike', 410, 1650, 2) $$, '… Werte gespeichert');
select is(pg_temp.route_error(pg_temp.route('{"sac_grade": 2}')), '23514: Ungültige Angaben zur Strecke.',
  'SAC-Stufe nur bei Wandern/Bergwandern');
select is(pg_temp.route_error(pg_temp.route('{"sport": "bike", "walk_kind": "hike", "distance_m": 15000,
    "km_splits": [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]}')),
  '23514: Ungültige Angaben zur Strecke.', 'Art der Geh-Einheit nicht beim Rad');
select is(pg_temp.route_error(pg_temp.route('{"max_altitude_m": 9001}')), '22023: Ungültige Angaben zur Strecke.',
  'höchster Punkt über 9.000 m abgelehnt');
select is(pg_temp.route_error(pg_temp.route('{"elevation_loss_m": 10001}')),
  '22023: Ungültige Angaben zur Strecke.', 'Abstieg über 10.000 m abgelehnt');
-- Strecke an den Spaziergang (…005) hängen: Eintrag folgt (Art Wandern, Name „Wanderung“).
select is(pg_temp.route_error(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000001", "walk_kind": "hike",
    "session_log_id": "a0000000-0000-4000-8000-000000000005"}')), 'kein Fehler',
  'Wander-Strecke mit Verknüpfung zum Spaziergang gespeichert');
select results_eq(
  $$ select cl.walk_kind::text, sl.name_de, sl.source::text from public.session_logs sl
     join public.cardio_logs cl on cl.session_log_id = sl.id
     where sl.id = 'a0000000-0000-4000-8000-000000000005' $$,
  $$ values ('hike', 'Wanderung', 'gps') $$, '… Eintrag folgt: Wanderung, Herkunft GPS');
create temp table rev_before as
  select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000005';
select is(pg_temp.update_error('{"walk_kind": "mountain_hike", "sac_grade": 3}'), 'kein Fehler',
  'Strecke auf Bergwandern T3 umstellen');
select results_eq(
  $$ select t.walk_kind::text, t.sac_grade::integer, cl.walk_kind::text, sl.name_de,
       sl.revision = (select revision + 1 from rev_before)
     from public.tracked_routes t
     join public.cardio_logs cl on cl.session_log_id = t.session_log_id
     join public.session_logs sl on sl.id = t.session_log_id
     where t.id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values ('mountain_hike', 3, 'mountain_hike', 'Bergwanderung', true) $$,
  '… Strecke und Eintrag Bergwandern, Revision + 1');
select is(pg_temp.update_error('{"walk_kind": "walk", "sac_grade": 2}'), '22023: Ungültige Angaben zur Strecke.',
  'SAC-Stufe beim Gehen abgelehnt');
select is(pg_temp.update_error('{"walk_kind": "walk"}'), 'kein Fehler',
  'auf Gehen umstellen ohne Angabe zur SAC-Stufe');
select results_eq(
  $$ select t.walk_kind::text, t.sac_grade, sl.name_de from public.tracked_routes t
     join public.session_logs sl on sl.id = t.session_log_id
     where t.id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values ('walk', null::smallint, 'Spaziergang') $$, '… SAC-Stufe entfällt, Name „Spaziergang“');
select is(public.save_session_log(pg_temp.free('a0000000-0000-4000-8000-000000000005', 'Wanderung',
    '{"modality": "walk", "walk_kind": "hike"}', jsonb_build_object('source', 'gps', 'base_revision',
      (select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000005'))))
    ->> 'result', 'ok', 'Eintrag bearbeiten: wieder Wanderung');
select is((select walk_kind::text from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'),
  'hike', '… verknüpfte Strecke folgt dem Eintrag');

-- ---------------------------------------------------------------------------------------------------------
-- Fremde Nutzer, Export
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.cardio_logs) + (select count(*)::integer from public.tracked_routes),
  0, 'B sieht keine Einträge/Strecken von A (RLS unverändert)');
select is(pg_temp.update_error('{"walk_kind": "hike"}'), '42501: Strecke nicht gefunden.',
  'fremde Strecke umstellen abgelehnt');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select ok(
  (select bool_and(c ?& array['avg_power_w', 'stroke_rate', 'intervals', 'walk_kind'])
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'cardio_logs') c)
  and (select bool_and(t ?& array['walk_kind', 'elevation_loss_m', 'max_altitude_m', 'sac_grade'])
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') t),
  'Export: neue Spalten in cardio_logs und tracked_routes');

reset role;
select * from finish();
rollback;
