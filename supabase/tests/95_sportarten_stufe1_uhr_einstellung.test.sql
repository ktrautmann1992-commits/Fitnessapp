-- Sportarten Stufe 1 · Uhr und Einstellung (20261027100100_sportarten_stufe1.sql, 20261027100200_sportarten_stufe1_rpcs.sql,
-- docs/PLAN-SPORTARTEN-STUFE-1.md 2.2–2.4 und 3):
-- - import_wearable_batch: Gruppe row (Rudergerät) mit Leistung/Schlagzahl, walk mit walk_kind (Name je Art);
--   ungültige Kombinationen werden übersprungen (ohne Werte); erneuter Abgleich füllt nur Lücken,
-- - save_wearable_route: Art der Geh-Einheit aus dem Eintrag, Name je Art, Abstieg/höchster Punkt optional,
-- - save_app_layout: optionales Feld recovery_routine („Erholungs-Routine vorschlagen“, Standard an, fehlt =
--   unverändert), Export, RLS unverändert.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, public.current_consent_version(t), 'android'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data', 'wearable_data']::public.consent_type[]) as t;

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.iso(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
-- Eine Einheit wie wearableSessionImportSchema (Beginn = jetzt minus p_ago, Dauer 1.800 s).
create function pg_temp.sess(p_ext text, p_group text, p_name text, p_ago interval, p_extra jsonb default '{}')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'external_id', p_ext, 'origin', 'samsung_health', 'group', p_group, 'name_de', p_name,
    'started_at', pg_temp.iso(date_trunc('second', now()) - p_ago),
    'finished_at', pg_temp.iso(date_trunc('second', now()) - p_ago + interval '1800 seconds'),
    'performed_on', ((date_trunc('second', now()) - p_ago) at time zone 'Europe/Berlin')::date::text,
    'duration_s', 1800, 'distance_m', 5000, 'kcal', 300, 'heart_rate', null, 'merge_into', null,
    'possible_duplicate_of', null
  ) || p_extra
$$;
create function pg_temp.batch(p_sessions jsonb) returns jsonb language sql as $$
  select jsonb_build_object('provider', 'health_connect', 'granted_types', '["exercise", "distance"]'::jsonb,
    'sessions', p_sessions, 'days', '[]'::jsonb)
$$;
-- Route wie wearableRoutePayloadSchema (5,2 km, 5 Kilometerzeiten).
create function pg_temp.route(p_ext text, p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'external_id', p_ext, 'distance_m', 5200, 'moving_s', 1750, 'elevation_gain_m', 380,
    'polyline', '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 'km_splits', '[340, 335, 338, 341, 330]'::jsonb,
    'elevation_profile', '[[0, 500], [5200, 620]]'::jsonb
  ) || p_changes
$$;
create function pg_temp.log_of(p_ext text) returns uuid language sql stable security definer as $$
  select session_log_id from public.wearable_sessions where external_id = p_ext
$$;
create function pg_temp.layout(p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('dashboard_tiles', '[]'::jsonb, 'tab_bar', '["uebersicht", "today", "mehr"]'::jsonb)
    || p_extra
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
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- import_wearable_batch
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-hike', 'walk', 'Wanderung', interval '1 day', '{"walk_kind": "hike"}'),
    pg_temp.sess('hc-row', 'row', 'Rudern', interval '2 days', '{"avg_power_w": 180, "stroke_rate": 24}'),
    pg_temp.sess('hc-walk', 'walk', 'Spaziergang', interval '3 days')))),
  '{"created": 3, "updated": 0, "merged": 0, "skipped": 0, "days": 0}'::jsonb,
  'Wanderung, Rudern und Spaziergang (ältere Fassung ohne walk_kind) übernommen');
select results_eq(
  $$ select sl.name_de, cl.modality::text, cl.walk_kind::text, cl.avg_power_w::integer, cl.stroke_rate::integer
     from public.session_logs sl join public.cardio_logs cl on cl.session_log_id = sl.id
     where sl.id in (pg_temp.log_of('hc-hike'), pg_temp.log_of('hc-row'), pg_temp.log_of('hc-walk'))
     order by sl.name_de $$,
  $$ values ('Rudern', 'row', null::text, 180, 24), ('Spaziergang', 'walk', null::text, null::integer, null::integer),
       ('Wanderung', 'walk', 'hike', null::integer, null::integer) $$,
  '… Art der Geh-Einheit, Leistung und Schlagzahl gespeichert');
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('x1', 'walk', 'Spaziergang', interval '4 days', '{"walk_kind": "hike"}'),
    pg_temp.sess('x2', 'run', 'Lauf', interval '5 days', '{"walk_kind": "hike"}'),
    pg_temp.sess('x3', 'walk', 'Spaziergang', interval '6 days', '{"avg_power_w": 150}'),
    pg_temp.sess('x4', 'row', 'Rudern', interval '7 days', '{"stroke_rate": 61}'),
    pg_temp.sess('x5', 'walk', 'Wanderung', interval '8 days', '{"walk_kind": "klettersteig"}')))),
  '{"created": 0, "updated": 0, "merged": 0, "skipped": 5, "days": 0}'::jsonb,
  'falscher Name, walk_kind beim Laufen, Watt beim Gehen, Schlagzahl 61, unbekannte Art: übersprungen');
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-row', 'row', 'Rudern', interval '2 days', '{"avg_power_w": 200}')))),
  '{"created": 0, "updated": 1, "merged": 0, "skipped": 0, "days": 0}'::jsonb,
  'erneuter Abgleich derselben Ruder-Einheit ändert (kein Doppel)');
select is((select avg_power_w::integer from public.cardio_logs where session_log_id = pg_temp.log_of('hc-row')),
  180, '… gespeicherte Leistung bleibt (Uhr füllt nur Lücken)');

-- ---------------------------------------------------------------------------------------------------------
-- save_wearable_route
-- ---------------------------------------------------------------------------------------------------------
select is(public.save_wearable_route(pg_temp.route('hc-hike', '{"elevation_loss_m": 360, "max_altitude_m": 880}')),
  'saved', 'Route der Wanderung gespeichert');
select results_eq(
  $$ select t.source::text, t.sport::text, t.walk_kind::text, t.name, t.elevation_loss_m, t.max_altitude_m
     from public.tracked_routes t where t.session_log_id = pg_temp.log_of('hc-hike') $$,
  $$ values ('watch', 'walk', 'hike', 'Wanderung', 360, 880) $$,
  '… Art und Name aus dem Eintrag, Abstieg und höchster Punkt');
select is(public.save_wearable_route(pg_temp.route('hc-walk')), 'saved',
  'Route ohne Abstieg/höchsten Punkt (ältere Fassung) gespeichert');
select results_eq(
  $$ select t.walk_kind::text, t.name, t.elevation_loss_m from public.tracked_routes t
     where t.session_log_id = pg_temp.log_of('hc-walk') $$,
  $$ values (null::text, 'Spaziergang', null::integer) $$, '… Gehen wie bisher');
select is(pg_temp.error_of($$ select public.save_wearable_route(pg_temp.route('hc-hike',
    '{"max_altitude_m": 9001}')) $$),
  '22023: Ungültige Angaben zur Strecke.', 'höchster Punkt über 9.000 m abgelehnt');
select is(public.save_wearable_route(pg_temp.route('hc-row')), 'skipped', 'Rudern: keine Strecke (kein GPS)');

-- ---------------------------------------------------------------------------------------------------------
-- save_app_layout: „Erholungs-Routine vorschlagen“
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.save_app_layout(pg_temp.layout()) $$, 'Anordnung ohne recovery_routine gespeichert');
select is((select recovery_routine from public.app_layout_settings), true, '… Standard an');
select lives_ok($$ select public.save_app_layout(pg_temp.layout('{"recovery_routine": false}')) $$,
  'Erholungs-Routine abschalten');
select is(pg_temp.error_of($$ select public.save_app_layout(pg_temp.layout('{"recovery_routine": "nein"}')) $$),
  '22023: Ungültige Einstellung.', 'recovery_routine nur boolesch');
select lives_ok($$ select public.save_app_layout(pg_temp.layout()) $$,
  'Anordnung erneut ohne recovery_routine gespeichert (ältere App-Fassung)');
select ok(
  (select not recovery_routine from public.app_layout_settings)
  and (public.export_my_data() -> 'data' -> 'app_layout_settings' -> 0 -> 'recovery_routine') = 'false'::jsonb,
  'ohne Feld bleibt die Einstellung (aus); Export enthält recovery_routine');

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.cardio_logs) + (select count(*)::integer from public.tracked_routes)
    + (select count(*)::integer from public.app_layout_settings),
  0, 'B sieht nichts von A (RLS unverändert)');

reset role;
select * from finish();
rollback;
