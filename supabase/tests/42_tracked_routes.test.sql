-- Phase 10 · Etappe S1 (docs/PLAN-PHASE-10.md Abschnitte 12 und 13): Tabelle tracked_routes und ihre Funktionen.
-- - Zugriff: anon nichts, authenticated nur eigene Zeilen lesen (kein Partner-Zugriff), schreiben nur über die
--   Funktionen,
-- - save_tracked_route: Felder strikt, Grenzen wie trackedRouteSchema (Name, Notiz, Dauer, Distanz-Plausibilität,
--   Polyline, Punkte ≤ 5.000, Kilometerzeiten), Beginn nicht in der Zukunft, Warteschlange (gleiche id), fremde id,
--   Favoriten-Wiederholung nur auf eigene Favoriten, Tagebuch-Eintrag nur eigener passender, Tageslimit,
-- - Herkunft gps/gpx_import im Tagebuch nur über save_tracked_route (save_session_log lehnt sie sonst ab),
-- - update/delete/delete_all, Löschen von Favorit und Eintrag (Verweise leer), Widerruf health_data (Strecken bleiben),
--   Export, Konto löschen (Kaskade), Fehlermeldungen ohne Werte.
-- Zeiten relativ zu now() (Strecken dürfen nicht in der Zukunft liegen); „heute“ = private.berlin_today().
begin;
create extension if not exists pgtap with schema extensions;
select plan(115);

-- A und B mit Profil und Einwilligungen, C ohne Profil.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;

-- Beginn der Test-Strecken: vor 3 Stunden (UTC, ISO wie toISOString()).
create function pg_temp.start_iso(p_offset interval default interval '0') returns text language sql as $$
  select to_char((now() - interval '3 hours' + p_offset) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS".000Z"')
$$;
create function pg_temp.start_day() returns date language sql as $$
  select ((now() - interval '3 hours') at time zone 'Europe/Berlin')::date
$$;

-- Unabhängiger Polyline-Kodierer (Google-Format, Werte in 1e-5 Grad) – gegen private.polyline_summary.
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
-- p_n Punkte ab dem Kölner Dom, jeweils 0,0001° (ca. 11 m) nach Norden.
create function pg_temp.poly(p_n integer) returns text language sql as $$
  select pg_temp.enc(5094130) || pg_temp.enc(695830) || coalesce(string_agg(pg_temp.enc(10) || pg_temp.enc(0), ''), '')
  from generate_series(2, p_n)
$$;

-- Eingabe wie trackedRouteSchema (packages/core): 5,2 km Laufen in 30 min, 3 Punkte.
create function pg_temp.route(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'name', 'Runde am Rhein', 'sport', 'run', 'started_at', pg_temp.start_iso(),
    'duration_s', 1800, 'moving_s', 1750, 'distance_m', 5200, 'elevation_gain_m', 12,
    'polyline', pg_temp.poly(3), 'km_splits', '[340, 335, 338, 341, 330]'::jsonb, 'difficulty', 'easy',
    'is_favorite', false, 'base_route_id', null, 'note', null, 'session_log_id', null, 'source', 'recorded'
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
  select pg_temp.error_of(format('select public.save_tracked_route(%L::jsonb)', p_payload))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

-- Tagebuch-Einträge (direkt, als Eigentümer): A Lauf/Rad/Kraft vom Tag des Beginns, A Lauf vor 5 Tagen, B Lauf.
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at,
  is_free)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'endurance', pg_temp.start_day(),
   'completed', 'Lauf', gen_random_uuid(), now(), true),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'endurance', pg_temp.start_day(),
   'completed', 'Radfahrt', gen_random_uuid(), now(), true),
  ('a0000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'strength', pg_temp.start_day(),
   'completed', 'Freie Kraft-Einheit', gen_random_uuid(), now(), true),
  ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'endurance',
   pg_temp.start_day() - 5, 'completed', 'Lauf', gen_random_uuid(), now(), true),
  ('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'endurance', pg_temp.start_day(),
   'completed', 'Lauf', gen_random_uuid(), now(), true);
insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'run', 1800, 5200),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'bike', 1800, 15000),
  ('a0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'run', 1800, 5200),
  ('b0000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'run', 1800, 5200);

-- ---------------------------------------------------------------------------------------------------------
-- Polyline lesen (SQL = packages/core decodePolyline)
-- ---------------------------------------------------------------------------------------------------------
select is(private.polyline_summary('_p~iF~ps|U_ulLnnqC_mqNvxq`@'),
  array[3, 38.5, -126.453, 43.252, -120.2]::numeric[], 'Google-Beispiel: 3 Punkte, Rahmen');
-- Von packages/core erzeugt: encodePolyline([{90,180},{-90,-180},{90,180}]) (polyline.test.ts „Extremwerte“).
select is(private.polyline_summary('_cidP_gsia@~fsia@~ngtcA_gsia@_ogtcA'),
  array[3, -90, -180, 90, 180]::numeric[], 'Extremwerte wie packages/core');
select is((private.polyline_summary(pg_temp.poly(5000)))[1], 5000::numeric, 'unabhängiger Kodierer: 5.000 Punkte');
select ok(
  private.polyline_summary('_p~iF ~ps|U') is null and private.polyline_summary('_p~iF~ps|') is null
  and private.polyline_summary('_p~iF') is null and private.polyline_summary('~~~~~~~~?') is null
  and private.polyline_summary('') is null and private.polyline_summary(null) is null
  and private.polyline_summary(pg_temp.enc(9000001) || pg_temp.enc(0)) is null
  and private.polyline_summary(pg_temp.enc(0) || pg_temp.enc(-18000001)) is null
  and private.polyline_summary(repeat('?', 60001)) is null,
  'ungültige Polylines → null (Zeichen, abgeschnitten, ohne Länge, zu viele Gruppen, außerhalb ±90/±180, zu lang)');
select ok(
  private.km_splits_valid('[300, 301]', 2999, 601) and not private.km_splits_valid('[300, 301]', 2999, 600)
  and not private.km_splits_valid('[300]', 2000, 601) and not private.km_splits_valid('[300, 0]', 2000, 601)
  and not private.km_splits_valid('[300, 1.5]', 2000, 601) and not private.km_splits_valid('{"a": 1}', 0, 0)
  and private.km_splits_valid('[]', 999, 0),
  'Kilometerzeiten: Anzahl = Distanz div 1.000, je 1–43.200 ganz, Summe ≤ Bewegungszeit');

-- ---------------------------------------------------------------------------------------------------------
-- Zugriff
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.save_tracked_route('{}'::jsonb) $$, '42501', null, 'anon darf nicht speichern');
select throws_ok($$ select * from public.tracked_routes $$, '42501', null, 'anon liest keine Strecken');
select throws_ok($$ select public.delete_all_tracked_routes() $$, '42501', null, 'anon darf nicht löschen');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select is(pg_temp.save(pg_temp.route()), '42501: Nicht angemeldet.', 'ohne Login abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is(pg_temp.save(pg_temp.route()), '42501: Profil fehlt.', 'ohne Profil abgelehnt');
reset role;
select ok(
  (select relrowsecurity from pg_class where oid = 'public.tracked_routes'::regclass)
  and has_table_privilege('authenticated', 'public.tracked_routes', 'select')
  and not has_table_privilege('authenticated', 'public.tracked_routes', 'insert')
  and not has_table_privilege('authenticated', 'public.tracked_routes', 'update')
  and not has_table_privilege('authenticated', 'public.tracked_routes', 'delete')
  and not has_table_privilege('anon', 'public.tracked_routes', 'select')
  and not has_table_privilege('authenticated', 'private.tracked_route_daily_counts', 'select'),
  'RLS an; authenticated nur lesen, anon nichts, Zähler privat');
select is(
  (select array_agg(polname::text || ' | ' || polcmd::text || ' | ' || pg_get_expr(polqual, polrelid)
     || ' | ' || polroles::regrole[]::text) from pg_policy
   where polrelid = 'public.tracked_routes'::regclass),
  array['Nutzer sehen eigene Strecken | r | (user_id = ( SELECT auth.uid() AS uid)) | {authenticated}'],
  'genau EINE Policy: nur eigene Zeilen lesen (kein Partner-Modus, nichts Öffentliches)');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('save_tracked_route', 'update_tracked_route', 'delete_tracked_route',
                       'delete_all_tracked_routes')),
  'Funktionen: security definer, search_path leer, nur authenticated');
select is(
  (select count(*)::integer from pg_proc p where p.pronamespace = 'public'::regnamespace
     and p.proname in ('save_tracked_route', 'update_tracked_route', 'delete_tracked_route',
                       'delete_all_tracked_routes')),
  4, 'vier Schreib-Funktionen');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.save(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000001", "is_favorite": true}')),
  'kein Fehler', 'A speichert eine Favoriten-Strecke');
select results_eq(
  $$ select point_count, bbox, user_id::text, source::text from public.tracked_routes
     where id = 'c0000000-0000-4000-8000-000000000001' $$,
  $$ values (3, array[50.9413, 6.9583, 50.9415, 6.9583]::numeric[], '11111111-1111-4111-8111-111111111111',
             'recorded') $$,
  'Punkte und Rahmen rechnet der Server aus der Polyline; user_id aus auth.uid()');
select is(
  public.save_tracked_route(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000001", "name": "Anders"}')),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'Warteschlange: gleiche id erneut → dieselbe Strecke');
select is((select name from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'),
  'Runde am Rhein', '… unverändert (kein Doppel)');
select is((select count(*)::integer from public.tracked_routes), 1, 'A sieht genau eine Strecke');

select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is((select count(*)::integer from public.tracked_routes), 0, 'B sieht A''s Strecke nicht');
select isnt(
  public.save_tracked_route(pg_temp.route('{"id": "c0000000-0000-4000-8000-000000000001", "is_favorite": true}')),
  'c0000000-0000-4000-8000-000000000001'::uuid, 'fremde id → B bekommt eine neue id (ohne Meldung)');
select is(pg_temp.save(pg_temp.route('{"id": "e0000000-0000-4000-8000-000000000001", "is_favorite": true}')),
  'kein Fehler', 'B speichert eine eigene Favoriten-Strecke');
select is((select count(*)::integer from public.tracked_routes), 2, 'B sieht nur die eigenen Strecken');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select name from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000001'),
  'Runde am Rhein', 'A''s Strecke unverändert');

-- Felder strikt
select is(pg_temp.save(pg_temp.route('{"extra": 1}')), '22023: Unbekanntes Feld in der Eingabe (Strecke).',
  'unbekanntes Feld abgelehnt');
select is(pg_temp.save(pg_temp.route('{"user_id": "22222222-2222-4222-8222-222222222222"}')),
  '22023: Unbekanntes Feld in der Eingabe (Strecke).', 'user_id in der Eingabe abgelehnt');
select is(pg_temp.save(pg_temp.route('{"point_count": 3}')), '22023: Unbekanntes Feld in der Eingabe (Strecke).',
  'point_count in der Eingabe abgelehnt (rechnet der Server)');
select is(pg_temp.save(pg_temp.route() - 'note'), '22023: Ungültige Angaben zur Strecke.', 'fehlendes Feld abgelehnt');
select is(pg_temp.save(pg_temp.route('{"duration_s": "1800"}')), '22023: Ungültige Angaben zur Strecke.',
  'Zahl als Text abgelehnt');
select is(pg_temp.save('[]'::jsonb), '22023: Ungültige Eingabe (Strecke).', 'keine Objekt-Eingabe abgelehnt');

-- Grenzen (= trackedRouteSchema)
select is(pg_temp.save(pg_temp.route('{"name": " Runde"}')), '23514: Ungültige Angaben zur Strecke.',
  'Name mit Leerraum am Rand abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('name', repeat('x', 81)))),
  '23514: Ungültige Angaben zur Strecke.', 'Name 81 Zeichen abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('name', repeat('x', 80)))), 'kein Fehler', 'Name 80 Zeichen ok');
select is(pg_temp.save(pg_temp.route('{"note": ""}')), '23514: Ungültige Angaben zur Strecke.', 'leere Notiz abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('note', repeat('ä', 281)))),
  '23514: Ungültige Angaben zur Strecke.', 'Notiz 281 Zeichen abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('note', repeat('ä', 280)))), 'kein Fehler',
  'Notiz 280 Zeichen ok');
select is(pg_temp.save(pg_temp.route('{"sport": "swim"}')), '23514: Ungültige Angaben zur Strecke.',
  'Schwimmen abgelehnt');
select is(pg_temp.save(pg_temp.route('{"sport": "ski"}')), '22023: Ungültige Angaben zur Strecke.',
  'unbekannte Sportart abgelehnt');
select is(pg_temp.save(pg_temp.route('{"difficulty": "extreme"}')), '22023: Ungültige Angaben zur Strecke.',
  'unbekannte Schwierigkeit abgelehnt');
select is(pg_temp.save(pg_temp.route('{"source": "strava"}')), '22023: Ungültige Angaben zur Strecke.',
  'unbekannte Herkunft abgelehnt');
select is(pg_temp.save(pg_temp.route('{"duration_s": 59, "moving_s": 59, "distance_m": 0, "km_splits": []}')),
  '22023: Ungültige Angaben zur Strecke.', 'Dauer 59 s abgelehnt');
select is(pg_temp.save(pg_temp.route('{"duration_s": 60, "moving_s": 0, "distance_m": 0, "km_splits": []}')),
  'kein Fehler', 'Dauer 60 s ok (Stillstand: 0 m, keine Bewegung)');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('duration_s', 43201, 'started_at',
    pg_temp.start_iso(interval '-12 hours')))),
  '22023: Ungültige Angaben zur Strecke.', 'Dauer 12 h + 1 s abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('duration_s', 43200, 'started_at',
    pg_temp.start_iso(interval '-12 hours')))),
  'kein Fehler', 'Dauer 12 h ok');
select is(pg_temp.save(pg_temp.route('{"duration_s": 1800.5}')), '22023: Ungültige Angaben zur Strecke.',
  'Dauer mit Komma abgelehnt');
select is(pg_temp.save(pg_temp.route('{"moving_s": 1801}')), '23514: Ungültige Angaben zur Strecke.',
  'Bewegung länger als die Dauer abgelehnt');
select is(pg_temp.save(pg_temp.route('{"elevation_gain_m": 10001}')), '22023: Ungültige Angaben zur Strecke.',
  'Höhenmeter über 10.000 abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('duration_s', 3600, 'moving_s', 3600, 'distance_m', 37500,
    'km_splits', (select jsonb_agg(96) from generate_series(1, 37))))),
  'kein Fehler', 'Distanz: 37,5 km in 1 h Laufen ok (Sprung-Schwelle)');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('duration_s', 3600, 'moving_s', 3600, 'distance_m', 37501,
    'km_splits', (select jsonb_agg(96) from generate_series(1, 37))))),
  '23514: Ungültige Angaben zur Strecke.', 'Distanz: 37.501 m in 1 h Laufen abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('sport', 'bike', 'duration_s', 3600, 'moving_s', 3600,
    'distance_m', 70000, 'km_splits', (select jsonb_agg(51) from generate_series(1, 70))))),
  'kein Fehler', 'Bergab-Rad: 70 km in 1 h gespeichert (Warnung zeigt die App, kein Verwerfen)');
select is(pg_temp.save(pg_temp.route('{"km_splits": [340, 335, 338, 341]}')), '23514: Ungültige Angaben zur Strecke.',
  'zu wenige Kilometerzeiten abgelehnt');
select is(pg_temp.save(pg_temp.route('{"km_splits": [340, 335, 338, 341, 0]}')),
  '23514: Ungültige Angaben zur Strecke.', 'Kilometerzeit 0 abgelehnt');
select is(pg_temp.save(pg_temp.route('{"km_splits": [400, 400, 400, 400, 151]}')),
  '23514: Ungültige Angaben zur Strecke.', 'Summe der Kilometerzeiten über der Bewegung abgelehnt');
select is(pg_temp.save(pg_temp.route('{"polyline": "_p~iF ~ps|U"}')), '22023: Ungültige Angaben zur Strecke.',
  'Polyline mit Leerzeichen abgelehnt');
select is(pg_temp.save(pg_temp.route('{"polyline": "_p~iF~ps|"}')), '22023: Ungültige Angaben zur Strecke.',
  'abgeschnittene Polyline abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('polyline', pg_temp.poly(1)))),
  '22023: Ungültige Angaben zur Strecke.', 'Polyline mit 1 Punkt abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('polyline', pg_temp.poly(2)))), 'kein Fehler',
  'Polyline mit 2 Punkten ok');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('polyline', pg_temp.poly(5000)))), 'kein Fehler',
  '5.000 Punkte ok');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('polyline', pg_temp.poly(5001)))),
  '22023: Ungültige Angaben zur Strecke.', '5.001 Punkte abgelehnt');
select is(pg_temp.save(pg_temp.route(jsonb_build_object('started_at', pg_temp.start_iso(interval '3 hours')))),
  '22023: Ungültige Angaben zur Strecke.', 'Beginn jetzt (Ende 30 min in der Zukunft) abgelehnt');
select is(pg_temp.save(pg_temp.route('{"started_at": "2026-10-16T07:00:00"}')),
  '22023: Ungültige Angaben zur Strecke.', 'Beginn ohne Zeitzone abgelehnt');
select is(pg_temp.save(pg_temp.route('{"started_at": "2019-12-31T23:00:00Z"}')),
  '23514: Ungültige Angaben zur Strecke.', 'Beginn vor 2020 abgelehnt');

-- Favoriten-Wiederholung (nur eigene Favoriten derselben Sportart)
select is(pg_temp.save(pg_temp.route(
    '{"id": "c0000000-0000-4000-8000-000000000002", "base_route_id": "c0000000-0000-4000-8000-000000000001"}')),
  'kein Fehler', 'Wiederholung der eigenen Favoriten-Strecke ok');
select is(pg_temp.save(pg_temp.route('{"base_route_id": "c0000000-0000-4000-8000-000000000002"}')),
  '22023: Die Favoriten-Strecke wurde nicht gefunden.', 'Wiederholung einer Nicht-Favoriten-Strecke abgelehnt');
select is(pg_temp.save(pg_temp.route(
    '{"sport": "bike", "base_route_id": "c0000000-0000-4000-8000-000000000001"}')),
  '22023: Die Favoriten-Strecke wurde nicht gefunden.', 'Wiederholung mit anderer Sportart abgelehnt');
select is(pg_temp.save(pg_temp.route('{"base_route_id": "e0000000-0000-4000-8000-000000000001"}')),
  '22023: Die Favoriten-Strecke wurde nicht gefunden.', 'Wiederholung einer FREMDEN Favoriten-Strecke abgelehnt');
select is(pg_temp.save(pg_temp.route(
    '{"id": "c0000000-0000-4000-8000-0000000000ff", "base_route_id": "c0000000-0000-4000-8000-0000000000ff"}')),
  '22023: Die Favoriten-Strecke wurde nicht gefunden.', 'Wiederholung von sich selbst abgelehnt');

-- Tagebuch-Eintrag (nur eigener Ausdauer-Eintrag derselben Art vom Tag des Beginns, nur einmal)
select is(pg_temp.save(pg_temp.route('{"session_log_id": "b0000000-0000-4000-8000-000000000001"}')),
  '22023: Dieser Eintrag passt nicht zur Strecke.', 'fremder Eintrag abgelehnt');
select is(pg_temp.save(pg_temp.route('{"session_log_id": "a0000000-0000-4000-8000-000000000003"}')),
  '22023: Dieser Eintrag passt nicht zur Strecke.', 'Kraft-Eintrag abgelehnt');
select is(pg_temp.save(pg_temp.route('{"session_log_id": "a0000000-0000-4000-8000-000000000002"}')),
  '22023: Dieser Eintrag passt nicht zur Strecke.', 'Eintrag anderer Ausdauer-Art (Rad) abgelehnt');
select is(pg_temp.save(pg_temp.route('{"session_log_id": "a0000000-0000-4000-8000-000000000004"}')),
  '22023: Dieser Eintrag passt nicht zur Strecke.', 'Eintrag von einem anderen Tag abgelehnt');
select is(pg_temp.save(pg_temp.route(
    '{"id": "c0000000-0000-4000-8000-000000000003", "session_log_id": "a0000000-0000-4000-8000-000000000001"}')),
  'kein Fehler', 'eigener passender Eintrag ok');
select is((select source::text from public.session_logs where id = 'a0000000-0000-4000-8000-000000000001'), 'gps',
  'Herkunft des Eintrags = gps (setzt nur der Server)');
select is(pg_temp.save(pg_temp.route('{"session_log_id": "a0000000-0000-4000-8000-000000000001"}')),
  '22023: Dieser Eintrag passt nicht zur Strecke.', 'zweite Strecke für denselben Eintrag abgelehnt');
select is(pg_temp.save(pg_temp.route(
    '{"sport": "bike", "source": "gpx_import", "session_log_id": "a0000000-0000-4000-8000-000000000002"}')),
  'kein Fehler', 'GPX-Strecke mit Rad-Eintrag ok');
select is((select source::text from public.session_logs where id = 'a0000000-0000-4000-8000-000000000002'),
  'gpx_import', 'Herkunft des Eintrags = gpx_import');

-- ---------------------------------------------------------------------------------------------------------
-- Herkunft im Tagebuch nur über save_tracked_route (WP3 Präzisierung 8)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.free_run(p_id text, p_source text, p_write text default null) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', coalesce(p_write, gen_random_uuid()::text), 'base_revision', null,
    'planned_session_id', null, 'planned_date', private.berlin_today(), 'kind', 'endurance',
    'performed_on', private.berlin_today(), 'started_at', null, 'finished_at', null, 'status', 'completed',
    'session_rpe', 4, 'notes', null, 'name_de', 'Lauf', 'is_intro_week', false, 'is_deload', false,
    'source', p_source, 'client_updated_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'exercises', '[]'::jsonb,
    'cardio', '{"modality": "run", "duration_s": 1800, "distance_m": 5000, "elevation_m": null}'::jsonb,
    'is_free', true
  )
$$;
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'gps'))),
  '22023: Ungültige Werte im Tagebuch.', 'neuer Eintrag mit Herkunft gps abgelehnt (nur über eine Strecke)');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'gpx_import'))),
  '22023: Ungültige Werte im Tagebuch.', 'neuer Eintrag mit Herkunft gpx_import abgelehnt');
select is(public.save_session_log(pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'manual')) ->> 'result',
  'ok', 'neuer Eintrag „manual“ wie bisher');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'gps') || '{"base_revision": 1}')),
  '22023: Ungültige Werte im Tagebuch.', 'Wechsel manual → gps beim Ändern abgelehnt');
reset role;
update public.session_logs set source = 'gps' where id = 'd0000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.save_session_log(pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'manual')
    || '{"base_revision": 1}') ->> 'result', 'ok', 'Ändern eines gps-Eintrags mit „manual“ (heutige App) ok …');
select is((select source::text from public.session_logs where id = 'd0000000-0000-4000-8000-000000000001'), 'gps',
  '… und die Herkunft gps bleibt');
select is(public.save_session_log(pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'gps')
    || '{"base_revision": 2}') ->> 'result', 'ok', 'Ändern mit der gespeicherten Herkunft gps ok');
select is(pg_temp.error_of(format('select public.save_session_log(%L::jsonb)',
    pg_temp.free_run('d0000000-0000-4000-8000-000000000001', 'gpx_import') || '{"base_revision": 3}')),
  '22023: Ungültige Werte im Tagebuch.', 'Wechsel gps → gpx_import abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Ändern
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.update_tracked_route(jsonb_build_object('id', 'c0000000-0000-4000-8000-000000000002',
    'name', 'Rheinrunde', 'difficulty', 'hard', 'is_favorite', true, 'note', 'windig')) $$,
  'eigene Strecke ändern (Name, Schwierigkeit, Favorit, Notiz)');
select results_eq(
  $$ select name, difficulty::text, is_favorite, note from public.tracked_routes
     where id = 'c0000000-0000-4000-8000-000000000002' $$,
  $$ values ('Rheinrunde', 'hard', true, 'windig') $$, '… geändert');
select is(pg_temp.error_of($$ select public.update_tracked_route(jsonb_build_object('id',
    'c0000000-0000-4000-8000-000000000002', 'name', 'X', 'difficulty', null, 'is_favorite', true, 'note', null,
    'polyline', '??')) $$),
  '22023: Unbekanntes Feld in der Eingabe (Strecke).', 'Linie nicht änderbar (unbekanntes Feld)');
select is(pg_temp.error_of($$ select public.update_tracked_route(jsonb_build_object('id',
    'c0000000-0000-4000-8000-000000000002', 'name', '', 'difficulty', null, 'is_favorite', true, 'note', null)) $$),
  '22023: Ungültige Angaben zur Strecke.', 'leerer Name abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.error_of($$ select public.update_tracked_route(jsonb_build_object('id',
    'c0000000-0000-4000-8000-000000000002', 'name', 'Fremd', 'difficulty', null, 'is_favorite', false, 'note', null)) $$),
  '42501: Strecke nicht gefunden.', 'fremde Strecke ändern abgelehnt');
select is(pg_temp.error_of($$ select public.delete_tracked_route('c0000000-0000-4000-8000-000000000001') $$),
  '42501: Strecke nicht gefunden.', 'fremde Strecke löschen abgelehnt');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select name from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000002'), 'Rheinrunde',
  'A''s Strecke unverändert nach B''s Versuchen');

-- ---------------------------------------------------------------------------------------------------------
-- Löschen: Favorit (Wiederholung behält Zeiten), Eintrag (Strecke bleibt)
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.delete_tracked_route('c0000000-0000-4000-8000-000000000001') $$,
  'eigene Favoriten-Strecke löschen');
select results_eq(
  $$ select base_route_id, moving_s from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000002' $$,
  $$ values (null::uuid, 1750) $$, 'Wiederholung bleibt, Verweis leer');
select is(public.delete_session_log('a0000000-0000-4000-8000-000000000001', 1) ->> 'result', 'ok',
  'verknüpften Tagebuch-Eintrag löschen');
select is((select session_log_id from public.tracked_routes where id = 'c0000000-0000-4000-8000-000000000003'),
  null::uuid, 'Strecke bleibt, Verweis auf den Eintrag leer');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data: Strecken bleiben (W-G15), verknüpfte Einträge wie bisher
-- ---------------------------------------------------------------------------------------------------------
create temp table routes_before as select count(*)::integer as n from public.tracked_routes;
reset role;
select is((select count(*)::integer from public.tracked_routes where user_id = '11111111-1111-4111-8111-111111111111'),
  (select n from routes_before), 'vor dem Widerruf');
set local role authenticated;
select public.revoke_health_data(true);
reset role;
select is((select count(*)::integer from public.tracked_routes where user_id = '11111111-1111-4111-8111-111111111111'),
  (select n from routes_before), 'nach dem Widerruf: alle Strecken bleiben');
select is((select session_log_id from public.tracked_routes
           where session_log_id = 'a0000000-0000-4000-8000-000000000002'),
  'a0000000-0000-4000-8000-000000000002'::uuid, 'Verknüpfung zum Eintrag bleibt');

-- ---------------------------------------------------------------------------------------------------------
-- Export (Art. 15): alle bisherigen Bereiche + tracked_routes, nur eigene Zeilen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
create temp table export_a as select public.export_my_data() as e;
reset role;
select ok(
  (select array_agg(k) from jsonb_object_keys((select e -> 'data' from export_a)) k) @> array[
    'profiles', 'consents', 'body_metrics', 'body_measurements', 'measurement_reminders', 'health_screening',
    'goals', 'user_equipment', 'training_slots', 'nutrition_prefs', 'food_preferences', 'admin_users', 'user_plans',
    'planned_sessions', 'planned_exercises', 'session_logs', 'exercise_logs', 'set_logs', 'cardio_logs',
    'exercise_start_weights', 'meal_plans', 'meal_plan_items', 'shopping_lists', 'shopping_list_items',
    'recipe_ratings', 'food_dislikes', 'food_log_entries', 'food_log_favorites', 'custom_meals', 'custom_meal_items',
    'competitions', 'ai_usage', 'beta_entitlements', 'admin_actions', 'tracked_routes'],
  'Export: alle bisherigen Bereiche plus tracked_routes');
select is(jsonb_array_length((select e -> 'data' -> 'tracked_routes' from export_a)),
  (select count(*)::integer from public.tracked_routes where user_id = '11111111-1111-4111-8111-111111111111'),
  'Export: alle eigenen Strecken');
select ok(
  (select bool_and(r ->> 'user_id' = '11111111-1111-4111-8111-111111111111'
     and r ? 'polyline' and r ? 'km_splits' and r ? 'bbox')
   from jsonb_array_elements((select e -> 'data' -> 'tracked_routes' from export_a)) r),
  'Export: nur eigene Zeilen, mit Linie, Rahmen und Kilometerzeiten');

-- ---------------------------------------------------------------------------------------------------------
-- Tageslimit (TRACKED_ROUTE_LIMITS.maxSavesPerDay = 20)
-- ---------------------------------------------------------------------------------------------------------
select is((select created from private.tracked_route_daily_counts
           where user_id = '11111111-1111-4111-8111-111111111111' and day = private.berlin_today()),
  (select count(*)::integer from public.tracked_routes where user_id = '11111111-1111-4111-8111-111111111111') + 1,
  'Zähler zählt Erstellungen (auch gelöschte), nicht die Wiederholung derselben id');
set local role authenticated;
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(
  (select count(*)::integer from generate_series(1, 18) g where pg_temp.save(pg_temp.route()) = 'kein Fehler'),
  18, 'B: Strecken 2 bis 20 heute ok');
select is(pg_temp.save(pg_temp.route()), '54000: Heute wurden schon zu viele Strecken gespeichert.',
  'B: 21. Strecke heute abgelehnt');
select is(pg_temp.save(pg_temp.route()), '54000: Heute wurden schon zu viele Strecken gespeichert.',
  '… auch weiterhin');

-- ---------------------------------------------------------------------------------------------------------
-- Direkt schreiben verboten; CHECK greift auch für service_role
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ insert into public.tracked_routes (name, sport, started_at, duration_s, moving_s, distance_m,
    polyline, point_count, bbox, source)
    values ('X', 'run', now() - interval '1 hour', 600, 600, 1000, '??', 1, '{0,0,0,0}', 'recorded') $$,
  '42501', null, 'authenticated darf nicht direkt einfügen');
select throws_ok($$ delete from public.tracked_routes $$, '42501', null, 'authenticated darf nicht direkt löschen');
reset role;
select throws_ok($$ insert into public.tracked_routes (user_id, name, sport, started_at, duration_s, moving_s,
    distance_m, polyline, point_count, bbox, source)
    values ('11111111-1111-4111-8111-111111111111', 'X', 'run', now() - interval '1 hour', 600, 600, 900,
      '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 2, '{38.5,-126.453,43.252,-120.2}', 'recorded') $$,
  '23514', null, 'CHECK: Anzahl der Punkte muss zur Polyline passen (auch ohne Funktion)');
select throws_ok($$ insert into public.tracked_routes (user_id, name, sport, started_at, duration_s, moving_s,
    distance_m, polyline, point_count, bbox, source, session_log_id)
    values ('11111111-1111-4111-8111-111111111111', 'X', 'run', now() - interval '1 hour', 600, 600, 900,
      '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 3, '{38.5,-126.453,43.252,-120.2}', 'recorded',
      'b0000000-0000-4000-8000-000000000001') $$,
  '23503', null, 'Fremdschlüssel: nur EIGENE Einträge (zusammengesetzt mit user_id)');

-- ---------------------------------------------------------------------------------------------------------
-- delete_all_tracked_routes und Konto löschen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
create temp table a_count as select count(*)::integer as n from public.tracked_routes;
select is(public.delete_all_tracked_routes(), (select n from a_count), 'A löscht alle eigenen Strecken (Anzahl)');
select is((select count(*)::integer from public.tracked_routes), 0, 'A hat keine Strecken mehr');
select is(public.delete_all_tracked_routes(), 0, 'erneut: 0');
reset role;
select is((select count(*)::integer from public.tracked_routes where user_id = '22222222-2222-4222-8222-222222222222'),
  20, 'B''s Strecken unberührt');
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is((select count(*)::integer from public.tracked_routes where user_id = '22222222-2222-4222-8222-222222222222'),
  0, 'Konto löschen: Strecken per Kaskade weg');
select is((select count(*)::integer from private.tracked_route_daily_counts
           where user_id = '22222222-2222-4222-8222-222222222222'),
  0, 'Konto löschen: Zähler per Kaskade weg');

select * from finish();
rollback;
