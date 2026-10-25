-- Wetter je Lauf (Migration 20261025130000_route_weather.sql): Spalte weather mit CHECK (Form wie
-- routeWeatherSchema, Wertebereiche ROUTE_WEATHER), set_route_weather nur für eigene Strecken (fremd/anon abgelehnt),
-- null löscht, RLS unverändert, Export enthält weather.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');

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
create function pg_temp.mk(p_id uuid, p_user uuid) returns void language plpgsql as $$
declare
  s numeric[] := private.polyline_summary(pg_temp.poly3());
begin
  insert into public.tracked_routes (id, user_id, name, sport, started_at, duration_s, moving_s, distance_m, polyline,
    point_count, bbox, km_splits, source)
  values (p_id, p_user, 'Lauf', 'run', now() - interval '1 day', 1800, 1800, 5000, pg_temp.poly3(), s[1]::integer,
    s[2:5], '[300, 300, 300, 300, 300]'::jsonb, 'recorded');
end;
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
create function pg_temp.w(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('hour', '2026-10-24T16:00:00Z', 'temp_c', 12.4, 'feels_c', 9.4, 'wind_kmh', 18.2,
    'precip_mm', 0.3, 'humidity_pct', 84, 'code', 61, 'source', 'forecast') || p_changes
$$;
create function pg_temp.weather_of(p_id uuid) returns jsonb language sql security definer as $$
  select t.weather from public.tracked_routes t where t.id = p_id
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

select pg_temp.mk('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');
select pg_temp.mk('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');

select has_column('public', 'tracked_routes', 'weather', 'Spalte weather');
select is(pg_temp.weather_of('a0000000-0000-4000-8000-000000000001'), null, 'neu: kein Wetter');
select ok(private.route_weather_valid(pg_temp.w()), 'gültiges Wetter');
select ok(private.route_weather_valid(pg_temp.w('{"feels_c": null, "wind_kmh": null, "code": null}')),
  'Nebenwerte dürfen fehlen (null)');
select ok(not private.route_weather_valid(pg_temp.w('{"temp_c": 61}')), 'Temperatur über 60 abgelehnt');
select ok(not private.route_weather_valid(pg_temp.w('{"code": 100}')), 'Wettercode über 99 abgelehnt');
select ok(not private.route_weather_valid(pg_temp.w('{"lat": 50.9}')), 'zusätzliche Felder (z. B. Position) abgelehnt');
select ok(not private.route_weather_valid(pg_temp.w() - 'source'), 'fehlendes Feld abgelehnt');
select ok(not private.route_weather_valid('[1]'::jsonb), 'kein Objekt abgelehnt');
select throws_ok(
  $$ update public.tracked_routes set weather = '{"temp_c": 1}'::jsonb
     where id = 'a0000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'CHECK greift auch ohne Funktion');

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.set_route_weather('a0000000-0000-4000-8000-000000000001', pg_temp.w()) $$,
  'A speichert Wetter zur eigenen Strecke');
select is(pg_temp.weather_of('a0000000-0000-4000-8000-000000000001') ->> 'temp_c', '12.4', 'gespeichert');
select is(pg_temp.error_of($$ select public.set_route_weather('a0000000-0000-4000-8000-000000000001',
  pg_temp.w('{"humidity_pct": 120}')) $$), '22023: Ungültige Angaben zum Wetter.', 'ungültig abgelehnt');
select is(pg_temp.error_of($$ select public.set_route_weather('b0000000-0000-4000-8000-000000000001', pg_temp.w()) $$),
  '42501: Strecke nicht gefunden.', 'fremde Strecke abgelehnt');
select ok(
  (select bool_and(t ? 'weather') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') t),
  'Export enthält weather');
select lives_ok($$ select public.set_route_weather('a0000000-0000-4000-8000-000000000001', null) $$, 'null löscht');
reset role;
set local role anon;
select throws_ok($$ select public.set_route_weather('a0000000-0000-4000-8000-000000000001', null) $$,
  '42501', null, 'anon: kein Zugriff');
reset role;

select * from finish();
rollback;
