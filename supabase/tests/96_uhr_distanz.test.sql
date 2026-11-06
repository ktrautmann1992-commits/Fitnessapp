-- Uhr gewinnt bei Distanz und Zeit (Gründer-Entscheidung 06.11.2026, 20261106120000_uhr_distanz.sql): GPS-Aufzeichnung
-- der App + dieselbe Einheit der Uhr → cardio_logs bekommt Distanz und Dauer der Uhr (automatisch zusammengeführt,
-- erneuter Abgleich, „Möglicher Doppel-Eintrag“ → Zusammenführen). Beginn/Ende, Name und Höhenmeter bleiben. Uhr ohne
-- bzw. mit unplausibler Distanz und Einträge anderer Herkunft (manuell) behalten ihre Werte.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, public.current_consent_version(t), 'android'
from unnest(array['terms', 'privacy', 'health_data', 'wearable_data']::public.consent_type[]) as t;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

create function pg_temp.iso(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
grant execute on function pg_temp.iso(timestamptz) to authenticated;

-- Uhr-Lauf, Beginn = jetzt minus p_days Tage; Dauer 2:42:41 (9761 s), Distanz p_distance.
create function pg_temp.sess(p_ext text, p_days integer, p_distance integer, p_extra jsonb default '{}')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'external_id', p_ext, 'origin', 'samsung_health', 'group', 'run', 'name_de', 'Lauf',
    'started_at', pg_temp.iso(date_trunc('second', now()) - make_interval(days => p_days)),
    'finished_at', pg_temp.iso(date_trunc('second', now()) - make_interval(days => p_days) + interval '9761 seconds'),
    'performed_on', ((date_trunc('second', now()) - make_interval(days => p_days)) at time zone 'Europe/Berlin')::date::text,
    'duration_s', 9761, 'distance_m', p_distance, 'kcal', 1800, 'heart_rate', null,
    'merge_into', null, 'possible_duplicate_of', null
  ) || p_extra
$$;
grant execute on function pg_temp.sess(text, integer, integer, jsonb) to authenticated;

create function pg_temp.batch(p_sessions jsonb) returns jsonb language sql as $$
  select jsonb_build_object('provider', 'health_connect', 'granted_types', '["exercise"]'::jsonb,
    'sessions', p_sessions, 'days', '[]'::jsonb)
$$;
grant execute on function pg_temp.batch(jsonb) to authenticated;

-- App-Läufe (23,88 km / 2:41:35 Bewegungszeit, 120 Höhenmeter): 1–4 per GPS, 5 manuell; je ein Tag zurück.
insert into public.session_logs (id, user_id, kind, performed_on, started_at, finished_at, status, name_de,
  is_free, last_write_id, client_updated_at, source)
select ('a0000000-0000-4000-8000-00000000000' || n)::uuid, '11111111-1111-4111-8111-111111111111', 'endurance',
  ((date_trunc('second', now()) - make_interval(days => n)) at time zone 'Europe/Berlin')::date,
  date_trunc('second', now()) - make_interval(days => n) + interval '30 seconds',
  date_trunc('second', now()) - make_interval(days => n) + interval '9761 seconds',
  'completed', 'Mein Sonntagslauf', true, gen_random_uuid(), now(),
  (case when n = 5 then 'manual' else 'gps' end)::public.log_source
from generate_series(1, 5) n;
insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m, elevation_m)
select ('a0000000-0000-4000-8000-00000000000' || n)::uuid, '11111111-1111-4111-8111-111111111111', 'run', 9695, 23880, 120
from generate_series(1, 5) n;

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

-- 1: automatisch zusammengeführt → Uhr gewinnt.
select is(
  (public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('w1', 1, 25260, '{"merge_into": "a0000000-0000-4000-8000-000000000001"}'))))) ->> 'merged',
  '1', 'GPS-Lauf zusammengeführt');
select results_eq(
  $$ select duration_s, distance_m, elevation_m from public.cardio_logs
     where session_log_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (9761, 25260, 120) $$,
  'Distanz und Dauer laut Uhr, Höhenmeter der App bleiben');
select results_eq(
  $$ select name_de, source::text, revision, started_at = date_trunc('second', now()) - interval '1 day' + interval '30 seconds'
     from public.session_logs where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values ('Mein Sonntagslauf'::text, 'gps'::text, 2, true) $$,
  'Name, Herkunft und Beginn bleiben; Revision + 1');

-- Erneuter Abgleich derselben Uhr-Einheit mit korrigierter Distanz → folgt der Uhr; unverändert → keine Revision.
select is(
  (public.import_wearable_batch(pg_temp.batch(jsonb_build_array(pg_temp.sess('w1', 1, 25300))))) ->> 'updated',
  '1', 'erneuter Abgleich');
select is(
  (select distance_m from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000001'),
  25300, 'erneuter Abgleich: Distanz folgt der Uhr');
select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(pg_temp.sess('w1', 1, 25300))));
select is(
  (select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000001'),
  3, 'unverändert → keine weitere Revision');

-- 2: Uhr ohne Distanz → App-Werte bleiben (beide).
select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
  pg_temp.sess('w2', 2, null, '{"merge_into": "a0000000-0000-4000-8000-000000000002"}'))));
select results_eq(
  $$ select duration_s, distance_m from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000002' $$,
  $$ values (9695, 23880) $$, 'Uhr ohne Distanz: App-Werte bleiben');
select is(
  (select revision from public.session_logs where id = 'a0000000-0000-4000-8000-000000000002'),
  1, 'Uhr ohne Distanz: keine Revision');

-- 3: unplausible Distanz der Uhr (über 37,5 km/h) → App-Werte bleiben.
select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
  pg_temp.sess('w3', 3, 110000, '{"merge_into": "a0000000-0000-4000-8000-000000000003"}'))));
select results_eq(
  $$ select duration_s, distance_m from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000003' $$,
  $$ values (9695, 23880) $$, 'unplausible Distanz: App-Werte bleiben');

-- 5: manueller Eintrag → bleibt führend wie bisher.
select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
  pg_temp.sess('w5', 5, 25260, '{"merge_into": "a0000000-0000-4000-8000-000000000005"}'))));
select results_eq(
  $$ select duration_s, distance_m from public.cardio_logs where session_log_id = 'a0000000-0000-4000-8000-000000000005' $$,
  $$ values (9695, 23880) $$, 'manueller Eintrag: bleibt führend');

-- 4: „Möglicher Doppel-Eintrag“ → Zusammenführen übernimmt Distanz und Dauer der Uhr.
select is(
  (public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('w4', 4, 25260, '{"possible_duplicate_of": "a0000000-0000-4000-8000-000000000004"}'))))) ->> 'created',
  '1', 'Doppel-Hinweis angelegt');
select lives_ok(
  $$ select public.resolve_wearable_duplicate(
       (select ws.session_log_id from public.wearable_sessions ws where ws.external_id = 'w4'), true) $$,
  'zusammenführen');
select results_eq(
  $$ select duration_s, distance_m, elevation_m from public.cardio_logs
     where session_log_id = 'a0000000-0000-4000-8000-000000000004' $$,
  $$ values (9761, 25260, 120) $$,
  'Doppel-Hinweis zusammengeführt: Distanz und Dauer laut Uhr');
select is(
  (select count(*)::integer from public.session_logs where source = 'health_connect'), 0,
  'übernommener Eintrag gelöscht');
select is(
  (select ws.session_log_id from public.wearable_sessions ws where ws.external_id = 'w4'),
  'a0000000-0000-4000-8000-000000000004'::uuid, 'Uhr-Einheit hängt am GPS-Eintrag');

reset role;
select ok(
  private.watch_cardio_wins('gps', 'run', 37500, 3600) and not private.watch_cardio_wins('gps', 'run', 37501, 3600)
  and private.watch_cardio_wins('gps', 'walk', 15000, 3600) and not private.watch_cardio_wins('gps', 'walk', 15001, 3600)
  and private.watch_cardio_wins('gps', 'bike', 105000, 3600)
  and not private.watch_cardio_wins('gps', 'run', 0, 3600) and not private.watch_cardio_wins('gps', 'run', null, 3600)
  and not private.watch_cardio_wins('gps', 'run', 5000, 59) and not private.watch_cardio_wins('gps', 'swim', 1500, 1800)
  and not private.watch_cardio_wins('manual', 'run', 5000, 1800)
  and not private.watch_cardio_wins('gpx_import', 'run', 5000, 1800),
  'Regel = mergedCardioValues (Grenzen wie trackedRouteDistancePlausible, nur gps, nur run/bike/walk)');
select ok(
  not has_function_privilege('authenticated', 'private.take_watch_cardio(uuid, uuid, public.endurance_modality, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.watch_cardio_wins(public.log_source, public.endurance_modality, integer, integer)', 'execute'),
  'Hilfsfunktionen nicht direkt aufrufbar');

select * from finish();
rollback;
