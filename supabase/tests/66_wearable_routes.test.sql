-- Routen der Uhr (Gründer-Entscheidung 23.10.2026, 20261023120100_wearable_routes.sql): Rechte, Einwilligung
-- (wearable_data Fassung 2 + health_data), Aufbau, Strecke mit Herkunft watch an der übernommenen Einheit (Sportart,
-- Beginn, Dauer, Name vom Server), Distanz des Eintrags folgt der Route, erneuter Abgleich ändert (kein Doppel), App kann
-- `watch` nicht über save_tracked_route schreiben, Isolation, von der Person gelöschte Route kommt nicht wieder (außer
-- „Route freigeben“), Zusammenführen hängt die Route um, eigene Strecke ist führend, Export, Widerruf und Trennen
-- löschen die Routen der Uhr (eigene Strecken bleiben), Kaskade beim Löschen der Einheit.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

-- A: alle Einwilligungen (aktuelle Fassungen). B: nur health_data. D: alle (fremde Person). F: wearable_data Fassung 1.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'nutzer-f@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01'),
  ('66666666-6666-4666-8666-666666666666', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, public.current_consent_version(t), 'android'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data', 'wearable_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform) values
  ('22222222-2222-4222-8222-222222222222', 'health_data', public.current_consent_version('health_data'), 'android'),
  ('66666666-6666-4666-8666-666666666666', 'health_data', public.current_consent_version('health_data'), 'android'),
  ('66666666-6666-4666-8666-666666666666', 'wearable_data', 1, 'android');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

create function pg_temp.iso(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
grant execute on function pg_temp.iso(timestamptz) to authenticated;

-- Eine Einheit wie wearableSessionImportSchema (Beginn = jetzt minus p_ago, Dauer 1.800 s, 5 km).
create function pg_temp.sess(p_ext text, p_group text, p_ago interval, p_extra jsonb default '{}')
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'external_id', p_ext,
    'origin', 'samsung_health',
    'group', p_group,
    'name_de', case p_group when 'run' then 'Lauf' when 'swim' then 'Schwimmen' else 'Freie Kraft-Einheit' end,
    'started_at', pg_temp.iso(date_trunc('second', now()) - p_ago),
    'finished_at', pg_temp.iso(date_trunc('second', now()) - p_ago + interval '1800 seconds'),
    'performed_on', ((date_trunc('second', now()) - p_ago) at time zone 'Europe/Berlin')::date::text,
    'duration_s', 1800,
    'distance_m', case when p_group in ('run', 'swim') then 5000 end,
    'kcal', 300,
    'heart_rate', null,
    'merge_into', null,
    'possible_duplicate_of', null
  ) || p_extra
$$;
grant execute on function pg_temp.sess(text, text, interval, jsonb) to authenticated;

create function pg_temp.batch(p_sessions jsonb) returns jsonb language sql as $$
  select jsonb_build_object('provider', 'health_connect', 'granted_types', '["exercise", "distance"]'::jsonb,
    'sessions', p_sessions, 'days', '[]'::jsonb)
$$;
grant execute on function pg_temp.batch(jsonb) to authenticated;

-- Route wie wearableRoutePayloadSchema (5,2 km, 5 Kilometerzeiten).
create function pg_temp.route(p_ext text, p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'external_id', p_ext, 'distance_m', 5200, 'moving_s', 1750, 'elevation_gain_m', 12,
    'polyline', '_p~iF~ps|U_ulLnnqC_mqNvxq`@', 'km_splits', '[340, 335, 338, 341, 330]'::jsonb,
    'elevation_profile', '[[0, 500], [5200, 620]]'::jsonb
  ) || p_changes
$$;
grant execute on function pg_temp.route(text, jsonb) to authenticated;

create function pg_temp.log_of(p_ext text) returns uuid language sql stable security definer as $$
  select session_log_id from public.wearable_sessions where external_id = p_ext
$$;
grant execute on function pg_temp.log_of(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte, Einwilligung, Aufbau
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute')
   from pg_proc p where p.oid = 'public.save_wearable_route(jsonb, boolean)'::regprocedure),
  'save_wearable_route: security definer, search_path leer, anon nicht ausführbar');
select ok(
  (select position('wearable_consents_locked' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
   from pg_proc p where p.oid = 'public.save_wearable_route(jsonb, boolean)'::regprocedure),
  'Einwilligung gesperrt und geprüft vor der Advisory-Sperre');
select ok(
  (select body_de like '%Routen (GPS-Strecken)%' from public.consent_documents
   where consent_type = 'wearable_data' and version = public.current_consent_version('wearable_data')),
  'wearable_data: aktuelle Fassung nennt die Routen (seit Fassung 2)');
select ok(
  not has_table_privilege('authenticated', 'private.wearable_route_dismissals', 'select'),
  'Merkliste gelöschter Routen: kein Zugriff für authenticated');

set local role authenticated;
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run')) $$, '42501', 'Nicht angemeldet.',
  'ohne Anmeldung abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'nur health_data: abgelehnt');
select pg_temp.as_user('66666666-6666-4666-8666-666666666666');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'wearable_data nur Fassung 1 (ohne Routen): abgelehnt');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-run', 'run', interval '1 day'),
    pg_temp.sess('hc-swim', 'swim', interval '2 days'),
    pg_temp.sess('hc-kraft', 'strength', interval '3 days')))),
  '{"created": 3, "updated": 0, "merged": 0, "skipped": 0, "days": 0}'::jsonb, 'A: drei Einheiten übernommen');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run', '{"route": 1}')) $$, '22023', null,
  'unbekanntes Feld abgelehnt');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run', '{"polyline": "abc"}')) $$, '22023',
  'Ungültige Angaben zur Strecke.', 'ungültige Linie abgelehnt (ohne Koordinaten in der Meldung)');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run', '{"km_splits": [340]}')) $$, '23514',
  'Ungültige Angaben zur Strecke.', 'Kilometerzeiten passen nicht zur Distanz: abgelehnt');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('gibt-es-nicht')) $$, '22023',
  'Diese Einheit von der Uhr wurde nicht gefunden.', 'unbekannte Einheit abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern
-- ---------------------------------------------------------------------------------------------------------
select is(public.save_wearable_route(pg_temp.route('hc-run')), 'saved', 'Route gespeichert');
select is(
  (select t.source::text || '/' || t.sport::text || '/' || t.name || '/' || t.duration_s || '/' || t.distance_m
     || '/' || (t.session_log_id = pg_temp.log_of('hc-run')) || '/' || (t.wearable_session_log_id = t.session_log_id)
   from public.tracked_routes t),
  'watch/run/Lauf/1800/5200/true/true', 'Strecke: Herkunft watch, Sportart/Dauer/Name vom Server, am Eintrag');
select is(
  (select cl.distance_m || '/' || cl.elevation_m || '/' || sl.revision from public.cardio_logs cl
   join public.session_logs sl on sl.id = cl.session_log_id where cl.session_log_id = pg_temp.log_of('hc-run')),
  '5200/12/2', 'Distanz und Höhenmeter des Eintrags = Route, revision + 1');
select is(public.save_wearable_route(pg_temp.route('hc-run', '{"distance_m": 5300}')), 'saved',
  'erneut gespeichert (Abgleich)');
select is((select count(*)::integer || '/' || max(distance_m) from public.tracked_routes), '1/5300',
  'erneuter Abgleich ändert die Route, legt nie eine zweite an');
select is(
  public.save_wearable_route(pg_temp.route('hc-swim')) || '/' || public.save_wearable_route(pg_temp.route('hc-kraft')),
  'skipped/skipped', 'Schwimmen und Kraft: keine Route');
select throws_ok(
  $$ select public.save_tracked_route(jsonb_build_object(
       'id', gen_random_uuid(), 'name', 'Uhr?', 'sport', 'run',
       'started_at', pg_temp.iso(now() - interval '3 hours'), 'duration_s', 1800, 'moving_s', 1750,
       'distance_m', 5200, 'elevation_gain_m', null, 'polyline', '_p~iF~ps|U_ulLnnqC',
       'km_splits', '[340, 335, 338, 341, 330]'::jsonb, 'difficulty', null, 'is_favorite', false,
       'base_route_id', null, 'note', null, 'session_log_id', null, 'source', 'watch')) $$,
  '23514', 'Ungültige Angaben zur Strecke.', 'Herkunft watch nie über save_tracked_route');

-- Isolation
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*)::integer from public.tracked_routes), 0, 'D sieht die Route von A nicht');
select throws_ok($$ select public.save_wearable_route(pg_temp.route('hc-run')) $$, '22023',
  'Diese Einheit von der Uhr wurde nicht gefunden.', 'D kann keine Route an die Einheit von A hängen');

-- ---------------------------------------------------------------------------------------------------------
-- Gelöschte Route, Zusammenführen, eigene Strecke führend
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.delete_tracked_route((select id from public.tracked_routes)) $$,
  'A löscht die Route');
select is(public.save_wearable_route(pg_temp.route('hc-run')), 'skipped',
  'gelöschte Route kommt beim Abgleich nicht wieder');
select is((select count(*)::integer from public.tracked_routes), 0, 'keine Route nach dem Abgleich');
select is(public.save_wearable_route(pg_temp.route('hc-run'), true), 'saved', '„Route freigeben“ legt sie wieder an');

-- Eigener Eintrag X (ohne Uhrzeit) + Uhr-Einheit mit möglichem Doppel → Zusammenführen hängt die Route an X.
reset role;
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, is_free, last_write_id,
  client_updated_at)
values ('a0000000-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111', 'endurance',
  ((date_trunc('second', now()) - interval '4 days') at time zone 'Europe/Berlin')::date, 'completed', 'Lauf', true,
  gen_random_uuid(), now());
insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m) values
  ('a0000000-0000-4000-8000-0000000000a1', '11111111-1111-4111-8111-111111111111', 'run', 1800, 5100);
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-dup', 'run', interval '4 days',
      '{"possible_duplicate_of": "a0000000-0000-4000-8000-0000000000a1"}')))) $$, 'Einheit mit möglichem Doppel');
select lives_ok($$ select public.save_wearable_route(pg_temp.route('hc-dup')) $$, 'Route der Doppel-Einheit');
select lives_ok($$ select public.resolve_wearable_duplicate(pg_temp.log_of('hc-dup'), true) $$, 'zusammengeführt');
select is(
  (select (session_log_id = 'a0000000-0000-4000-8000-0000000000a1')::text || '/' ||
          (wearable_session_log_id = 'a0000000-0000-4000-8000-0000000000a1')::text
   from public.tracked_routes where source = 'watch' and distance_m = 5200
     and wearable_session_log_id = 'a0000000-0000-4000-8000-0000000000a1'),
  'true/true', 'Route folgt dem führenden Eintrag');

-- ---------------------------------------------------------------------------------------------------------
-- Export, Widerruf, Trennen, Kaskade
-- ---------------------------------------------------------------------------------------------------------
select is(
  (select count(*)::integer from jsonb_array_elements(public.export_my_data() -> 'data' -> 'tracked_routes') e
   where e ->> 'source' = 'watch' and e ? 'wearable_session_log_id'),
  2, 'Export: Routen der Uhr mit Verknüpfung');
update public.consents set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111' and consent_type = 'wearable_data';
select is((select count(*)::integer from public.tracked_routes where source = 'watch'), 0,
  'Widerruf wearable_data: alle Routen der Uhr gelöscht (Einträge bleiben)');

select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select lives_ok($$ select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('d-run', 'run', interval '1 day'), pg_temp.sess('d-run2', 'run', interval '2 days')))) $$,
  'D übernimmt zwei Läufe');
select is(
  public.save_wearable_route(pg_temp.route('d-run')) || '/' || public.save_wearable_route(pg_temp.route('d-run2')),
  'saved/saved', 'D: beide Routen gespeichert');
reset role;
delete from public.session_logs where id = pg_temp.log_of('d-run2');
select is(
  (select count(*)::integer from public.tracked_routes where user_id = '44444444-4444-4444-8444-444444444444')
  || '/' || (select count(*) from private.wearable_route_dismissals),
  '1/0', 'Eintrag gelöscht → seine Route geht mit (nichts gemerkt)');
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(public.disconnect_wearable('health_connect', false), 0, 'D trennt („behalten“)');
select is(
  (select count(*) from public.tracked_routes) || '/' || (select count(*) from public.wearable_sessions),
  '0/1', 'Trennen „behalten“: Routen der Uhr weg, Einheit bleibt');

select * from finish();
rollback;
