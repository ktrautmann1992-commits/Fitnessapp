-- Etappe E4 (docs/PLAN-EINKAUFEN-AUSDAUER.md 6): Höhenprofil je Strecke, NUR ADDITIV.
-- - private.elevation_profile_valid = elevationProfileSchema (2–300 Stützpunkte, ganze Zahlen, Bereiche, Distanz nie
--   fallend),
-- - save_tracked_route nimmt elevation_profile OPTIONAL an (fehlt → null, ältere App-Fassungen), prüft es per CHECK,
-- - CHECK gilt auch für service_role, Export enthält die Spalte, Pflichtfelder bleiben Pflicht.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) t;

create function pg_temp.route(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Runde mit Höhen', 'sport', 'run',
    'started_at', to_char((now() - interval '3 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
    'duration_s', 1800, 'moving_s', 1750, 'distance_m', 5200, 'elevation_gain_m', 12,
    'polyline', '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 'km_splits', '[340, 335, 338, 341, 330]'::jsonb,
    'difficulty', null, 'is_favorite', false, 'base_route_id', null, 'note', null, 'session_log_id', null,
    'source', 'recorded'
  ) || p_changes
$$;
create function pg_temp.save(p_payload jsonb) returns text language plpgsql as $$
declare
  code text;
  msg text;
begin
  perform public.save_tracked_route(p_payload);
  return 'kein Fehler';
exception when others then
  get stacked diagnostics code = returned_sqlstate, msg = message_text;
  return code || ': ' || msg;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Prüffunktion (= elevationProfileSchema)
-- ---------------------------------------------------------------------------------------------------------
select ok(private.elevation_profile_valid('[[0, 100], [15, 120]]'), '2 Stützpunkte gültig');
select ok(private.elevation_profile_valid(
  (select jsonb_agg(jsonb_build_array(g * 10, -10000 + g)) from generate_series(1, 300) g)),
  '300 Stützpunkte, Höhe ab −10.000 dm gültig');
select ok(not private.elevation_profile_valid(
  (select jsonb_agg(jsonb_build_array(g, 0)) from generate_series(1, 301) g)), '301 Stützpunkte ungültig');
select ok(not private.elevation_profile_valid('[[0, 100]]') and not private.elevation_profile_valid('[]')
  and not private.elevation_profile_valid(null), 'weniger als 2 bzw. null ungültig');
select ok(not private.elevation_profile_valid('[[10, 0], [5, 0]]'), 'fallende Distanz ungültig');
select ok(not private.elevation_profile_valid('[[0, 0.5], [5, 0]]')
  and not private.elevation_profile_valid('[[0.5, 0], [5, 0]]'), 'Kommazahlen ungültig');
select ok(not private.elevation_profile_valid('[[0, 100001], [5, 0]]')
  and not private.elevation_profile_valid('[[0, -10001], [5, 0]]')
  and not private.elevation_profile_valid('[[0, 0], [500001, 0]]')
  and not private.elevation_profile_valid('[[-1, 0], [5, 0]]'), 'Bereiche (Höhe, Distanz) geprüft');
select ok(not private.elevation_profile_valid('[[0, 0, 1], [5, 0]]')
  and not private.elevation_profile_valid('[["0", 0], [5, 0]]')
  and not private.elevation_profile_valid('{"a": 1}')
  and not private.elevation_profile_valid('[1, 2]'), 'Form: genau 2 Zahlen je Stützpunkt, Liste');

-- ---------------------------------------------------------------------------------------------------------
-- save_tracked_route
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is(pg_temp.save(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000001"}')), 'kein Fehler',
  'ohne Feld elevation_profile (ältere App) ok');
select is((select elevation_profile from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'),
  null::jsonb, '… Profil leer');
select is(pg_temp.save(pg_temp.route(
  '{"id": "c0000000-0000-4000-8000-000000000002", "elevation_profile": null}')), 'kein Fehler',
  'elevation_profile null ok');
select is(pg_temp.save(pg_temp.route(
  '{"id": "c0000000-0000-4000-8000-000000000003", "elevation_profile": [[0, 512], [2600, 530], [5200, 498]]}')),
  'kein Fehler', 'gültiges Profil ok');
select is((select elevation_profile from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000003'),
  '[[0, 512], [2600, 530], [5200, 498]]'::jsonb, '… gespeichert wie gesendet');
select is(pg_temp.save(pg_temp.route('{"elevation_profile": [[10, 0], [5, 0]]}')),
  '23514: Ungültige Angaben zur Strecke.', 'ungültiges Profil abgelehnt (ohne Werte in der Meldung)');
select is(pg_temp.save(pg_temp.route('{"elevation_profile": "[[0, 1], [5, 2]]"}')),
  '22023: Ungültige Angaben zur Strecke.', 'Profil als Text abgelehnt');
select is(pg_temp.save(pg_temp.route('{"hoehen": [[0, 1], [5, 2]]}')),
  '22023: Unbekanntes Feld in der Eingabe (Strecke).', 'andere unbekannte Felder weiter abgelehnt');
select is(pg_temp.save(pg_temp.route() - 'note'),
  '22023: Ungültige Angaben zur Strecke.', 'Pflichtfelder bleiben Pflicht');
select ok((public.export_my_data() -> 'data' -> 'tracked_routes') @> jsonb_build_array(jsonb_build_object(
    'id', 'c0000000-0000-4000-8000-000000000003',
    'elevation_profile', '[[0, 512], [2600, 530], [5200, 498]]'::jsonb)),
  'Export enthält das Höhenprofil');

reset role;
select throws_ok($$ update public.tracked_routes set elevation_profile = '[[0, 1]]'
    where id = 'c0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'CHECK gilt auch für service_role');

select * from finish();
rollback;
