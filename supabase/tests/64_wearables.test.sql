-- Phase 8 · Etappe H2 (docs/PLAN-PHASE-8.md 4–6): Smartwatch über Health Connect. Rechte (auch anon), security
-- definer, Sperr-Reihenfolge, Anmeldung/Profil/Einwilligung (wearable_data UND health_data), Aufbau und Grenzen,
-- Idempotenz über external_id, Zusammenführen nur an eigenen Einträgen, möglicher Doppel-Eintrag (behalten /
-- zusammenführen), Tageswerte, Isolation (Fremdzugriff), Export, Widerruf (Puls und Tageswerte weg, Einträge bleiben),
-- Trennen (behalten/löschen, Puls immer weg), Kaskade beim Konto löschen.
begin;
create extension if not exists pgtap with schema extensions;
select plan(60);

-- A: alle Einwilligungen. B: nur health_data. C: ohne Profil. D: alle (fremde Person). E: nur wearable_data.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-e@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01'),
  ('55555555-5555-4555-8555-555555555555', '1990-01-01');
-- Jeweils die AKTUELLE Fassung (wearable_data seit 23.10.2026 Fassung 2 mit Routen, 66_wearable_routes.test.sql).
insert into public.consents (user_id, consent_type, version, platform)
select u, t, public.current_consent_version(t), 'android'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data', 'wearable_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform) values
  ('22222222-2222-4222-8222-222222222222', 'health_data', public.current_consent_version('health_data'), 'android'),
  ('55555555-5555-4555-8555-555555555555', 'wearable_data', public.current_consent_version('wearable_data'), 'android');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

create function pg_temp.iso(p timestamptz) returns text language sql immutable as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
grant execute on function pg_temp.iso(timestamptz) to authenticated;

-- Eine Einheit wie wearableSessionImportSchema (Beginn = jetzt minus p_ago, Dauer p_dur Sekunden).
create function pg_temp.sess(
  p_ext text, p_group text, p_ago interval, p_dur integer, p_extra jsonb default '{}'
) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'external_id', p_ext,
    'origin', 'samsung_health',
    'group', p_group,
    'name_de', case p_group when 'run' then 'Lauf' when 'walk' then 'Spaziergang' when 'bike' then 'Radfahrt'
      when 'swim' then 'Schwimmen' when 'strength' then 'Freie Kraft-Einheit' else 'Yoga' end,
    'started_at', pg_temp.iso(date_trunc('second', now()) - p_ago),
    'finished_at', pg_temp.iso(date_trunc('second', now()) - p_ago + make_interval(secs => p_dur)),
    'performed_on', ((date_trunc('second', now()) - p_ago) at time zone 'Europe/Berlin')::date::text,
    'duration_s', p_dur,
    'distance_m', case when p_group in ('run', 'walk', 'bike', 'swim') then 5000 end,
    'kcal', 300,
    'heart_rate', null,
    'merge_into', null,
    'possible_duplicate_of', null
  ) || p_extra
$$;
grant execute on function pg_temp.sess(text, text, interval, integer, jsonb) to authenticated;

create function pg_temp.batch(p_sessions jsonb, p_days jsonb default '[]') returns jsonb language sql as $$
  select jsonb_build_object(
    'provider', 'health_connect',
    'granted_types', '["exercise", "heart_rate", "steps", "sleep"]'::jsonb,
    'sessions', p_sessions,
    'days', p_days
  )
$$;
grant execute on function pg_temp.batch(jsonb, jsonb) to authenticated;

-- Eigener (manueller) Ausdauer-Eintrag von A mit Uhrzeit, 3 Tage zurück (für das Zusammenführen).
insert into public.session_logs (id, user_id, kind, performed_on, started_at, finished_at, status, name_de,
  is_free, last_write_id, client_updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'endurance',
   ((date_trunc('second', now()) - interval '3 days') at time zone 'Europe/Berlin')::date,
   date_trunc('second', now()) - interval '3 days', date_trunc('second', now()) - interval '3 days' + interval '40 minutes',
   'completed', 'Lauf', true, gen_random_uuid(), now()),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'endurance',
   ((date_trunc('second', now()) - interval '5 days') at time zone 'Europe/Berlin')::date,
   date_trunc('second', now()) - interval '5 days', date_trunc('second', now()) - interval '5 days' + interval '40 minutes',
   'completed', 'Lauf', true, gen_random_uuid(), now()),
  ('d0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'endurance',
   ((date_trunc('second', now()) - interval '3 days') at time zone 'Europe/Berlin')::date,
   date_trunc('second', now()) - interval '3 days', date_trunc('second', now()) - interval '3 days' + interval '40 minutes',
   'completed', 'Lauf', true, gen_random_uuid(), now());
insert into public.cardio_logs (session_log_id, user_id, modality, duration_s, distance_m) values
  ('a0000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'run', 2400, 6000),
  ('a0000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'run', 2400, 6000),
  ('d0000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'run', 2400, 6000);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.wearable_connections'::regclass,
    'public.wearable_sessions'::regclass, 'public.heart_rate_summaries'::regclass, 'public.daily_metrics'::regclass)),
  'RLS an auf allen vier Tabellen');
select ok(
  (select bool_and(has_table_privilege('authenticated', t, 'select')
     and not has_table_privilege('authenticated', t, 'insert')
     and not has_table_privilege('authenticated', t, 'update')
     and not has_table_privilege('authenticated', t, 'delete')
     and not has_table_privilege('anon', t, 'select'))
   from unnest(array['public.wearable_connections', 'public.wearable_sessions', 'public.heart_rate_summaries',
     'public.daily_metrics']) t),
  'authenticated: nur lesen; anon: nichts');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute'))
   from pg_proc p where p.oid in (
     'public.connect_wearable(public.wearable_provider, jsonb)'::regprocedure,
     'public.import_wearable_batch(jsonb)'::regprocedure,
     'public.resolve_wearable_duplicate(uuid, boolean)'::regprocedure,
     'public.disconnect_wearable(public.wearable_provider, boolean)'::regprocedure)),
  'Funktionen: security definer, search_path leer, anon nicht ausführbar');
select ok(
  (select position('wearable_consents_locked' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
   from pg_proc p where p.oid = 'public.import_wearable_batch(jsonb)'::regprocedure)
  and (select position('for share' in p.prosrc) < position('has_valid_consent' in p.prosrc)
   from pg_proc p where p.oid = 'private.wearable_consents_locked(uuid)'::regprocedure),
  'Import: Einwilligung FOR SHARE → prüfen → Advisory-Sperre');
select is((select count(*)::integer from public.consent_documents where consent_type = 'wearable_data'), 3,
  'Einwilligungstexte wearable_data Version 1–3 (Routen 23.10.2026, HRV/Erholung 25.10.2026)');

-- ---------------------------------------------------------------------------------------------------------
-- Anmeldung, Profil, Einwilligung, Aufbau
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]')) $$, '42501', 'Nicht angemeldet.',
  'ohne Anmeldung abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]')) $$, '42501', 'Profil fehlt.',
  'ohne Profil abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'nur health_data: abgelehnt');
select throws_ok($$ select public.connect_wearable('health_connect', '["exercise"]') $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'connect ohne wearable_data abgelehnt');
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'nur wearable_data ohne health_data: abgelehnt');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]') || '{"extra": 1}') $$, '22023',
  null, 'unbekanntes Feld abgelehnt');
select throws_ok(
  $$ select public.import_wearable_batch(pg_temp.batch(
       (select jsonb_agg(pg_temp.sess('x' || n, 'run', interval '1 day', 600)) from generate_series(1, 501) n))) $$,
  '22023', 'Ungültiger Abgleich.', 'mehr als 500 Einheiten abgelehnt');
select throws_ok(
  $$ select public.import_wearable_batch(jsonb_set(pg_temp.batch('[]'), '{granted_types}', '["exercise", "location"]')) $$,
  '22023', 'Ungültiger Abgleich.', 'unbekannter Datentyp abgelehnt (keine Strecken/kein Standort)');
select throws_ok(
  $$ select public.import_wearable_batch(jsonb_set(pg_temp.batch('[]'), '{granted_types}', '["steps", "steps"]')) $$,
  '22023', 'Ungültiger Abgleich.', 'doppelter Datentyp abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Import: neu, Puls, Tageswerte
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-run', 'run', interval '1 day', 1800,
      '{"heart_rate": {"avg_bpm": 145, "max_bpm": 172, "zone_s": [60, 300, 900, 400, 40], "hf_max_used": 186}}'),
    pg_temp.sess('hc-kraft', 'strength', interval '2 days', 3000),
    pg_temp.sess('hc-yoga', 'other', interval '2 days 3 hours', 1200)
  ), jsonb_build_array(
    jsonb_build_object('day', (private.berlin_today() - 1)::text, 'resting_hr_bpm', 54, 'sleep_min', 420, 'steps', 9000),
    jsonb_build_object('day', private.berlin_today()::text, 'resting_hr_bpm', null, 'sleep_min', null, 'steps', 3000)
  ))),
  '{"created": 3, "updated": 0, "merged": 0, "skipped": 0, "days": 2}'::jsonb,
  'A: drei Einheiten und zwei Tage übernommen');
select is(
  (select array_agg(sl.kind::text || '/' || coalesce(cl.modality::text, '-') || '/' || sl.name_de order by sl.name_de)
   from public.session_logs sl
   left join public.cardio_logs cl on cl.session_log_id = sl.id
   where sl.source = 'health_connect'),
  array['strength/-/Freie Kraft-Einheit', 'endurance/run/Lauf', 'strength/-/Yoga'],
  'freie Einträge mit Herkunft health_connect; Ausdauer mit cardio_logs');
select ok((select bool_and(is_free and status = 'completed' and planned_session_id is null and not from_health_plan)
           from public.session_logs where source = 'health_connect'),
  'übernommene Einträge: frei, erledigt, ohne Plan- und Gesundheitsbezug');
select is((select cl.distance_m from public.cardio_logs cl join public.wearable_sessions ws
             on ws.session_log_id = cl.session_log_id where ws.external_id = 'hc-run'), 5000, 'Distanz übernommen');
select is((select zone_s from public.heart_rate_summaries), array[60, 300, 900, 400, 40],
  'Puls: nur Zusammenfassung (Zonen in Sekunden)');
select is((select array[resting_hr_bpm::integer, sleep_min::integer, steps] from public.daily_metrics
           where day = private.berlin_today() - 1), array[54, 420, 9000], 'Tageswerte gespeichert');
select is(
  (select status::text || ':' || array_to_string(granted_types, ',') || ':' || last_sync_count
   from public.wearable_connections),
  'connected:exercise,heart_rate,sleep,steps:3', 'Verbindung mit Datentypen und letztem Abgleich');

-- Idempotenz: derselbe Abgleich noch einmal → nichts neu.
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-run', 'run', interval '1 day', 1800),
    pg_temp.sess('hc-kraft', 'strength', interval '2 days', 3000),
    pg_temp.sess('hc-yoga', 'other', interval '2 days 3 hours', 1200)
  ), jsonb_build_array(
    jsonb_build_object('day', (private.berlin_today() - 1)::text, 'resting_hr_bpm', null, 'sleep_min', null, 'steps', 9500)
  ))),
  '{"created": 0, "updated": 3, "merged": 0, "skipped": 0, "days": 1}'::jsonb,
  'erneuter Abgleich: ändert, legt nie neu an');
select is((select count(*)::integer from public.session_logs where source = 'health_connect'), 3,
  'weiter genau drei übernommene Einträge');
select is((select count(*)::integer from public.heart_rate_summaries), 1,
  'Puls bleibt, wenn der erneute Abgleich keinen Puls mitbringt');
select is((select array[resting_hr_bpm::integer, sleep_min::integer, steps] from public.daily_metrics
           where day = private.berlin_today() - 1), array[54, 420, 9500],
  'Tageswerte: fehlende Werte behalten den gespeicherten Wert');

-- Ungültige Einheiten/Tage werden übersprungen (ohne Werte), der Rest übernommen.
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('bad-dauer', 'run', interval '1 day', 1800, '{"duration_s": 1799}'),
    pg_temp.sess('bad-alt', 'run', interval '70 days', 1800),
    pg_temp.sess('bad-zukunft', 'run', interval '-1 hour', 1800),
    pg_temp.sess('bad-name', 'run', interval '1 day', 1800, '{"name_de": "Mein Lauf"}'),
    pg_temp.sess('bad-name2', 'other', interval '1 day', 1800, '{"name_de": "Yoga <b>"}'),
    pg_temp.sess('bad-distanz', 'strength', interval '1 day', 1800, '{"distance_m": 100}'),
    pg_temp.sess('bad-kurz', 'run', interval '1 day', 59),
    pg_temp.sess('bad-tag', 'run', interval '1 day', 1800, jsonb_build_object('performed_on', '2020-01-01')),
    pg_temp.sess('bad-puls', 'run', interval '1 day', 1800,
      '{"heart_rate": {"avg_bpm": 145, "max_bpm": 140, "zone_s": [0, 0, 0, 0, 0], "hf_max_used": 186}}'),
    pg_temp.sess('bad-zonen', 'run', interval '1 day', 600,
      '{"heart_rate": {"avg_bpm": 145, "max_bpm": 150, "zone_s": [600, 1, 0, 0, 0], "hf_max_used": 186}}'),
    pg_temp.sess('bad-feld', 'run', interval '1 day', 1800, '{"route": "abc"}'),
    pg_temp.sess('ok-bike', 'bike', interval '6 hours', 1800)
  ), jsonb_build_array(
    jsonb_build_object('day', (private.berlin_today() - 1)::text, 'resting_hr_bpm', 150, 'sleep_min', null, 'steps', null),
    jsonb_build_object('day', (private.berlin_today() - 90)::text, 'resting_hr_bpm', 50, 'sleep_min', null, 'steps', null),
    jsonb_build_object('day', private.berlin_today()::text, 'resting_hr_bpm', null, 'sleep_min', null, 'steps', null)
  ))),
  '{"created": 1, "updated": 0, "merged": 0, "skipped": 14, "days": 0}'::jsonb,
  'Grenzen: ungültige Einheiten und Tage übersprungen');

-- ---------------------------------------------------------------------------------------------------------
-- Zusammenführen (App führend) und möglicher Doppel-Eintrag
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-merge', 'run', interval '3 days' - interval '1 minute', 2340, jsonb_build_object(
      'merge_into', 'a0000000-0000-4000-8000-000000000001',
      'heart_rate', '{"avg_bpm": 150, "max_bpm": 180, "zone_s": [0, 0, 1200, 1000, 100], "hf_max_used": 186}'::jsonb)),
    pg_temp.sess('hc-fremd', 'run', interval '3 days', 2400, jsonb_build_object(
      'merge_into', 'd0000000-0000-4000-8000-000000000001')),
    pg_temp.sess('hc-dup-fremd', 'walk', interval '4 days', 2400, jsonb_build_object(
      'possible_duplicate_of', 'd0000000-0000-4000-8000-000000000001'))
  ))),
  '{"created": 2, "updated": 0, "merged": 1, "skipped": 0, "days": 0}'::jsonb,
  'Zusammenführen nur an eigenen Einträgen; fremder Verweis → neue Einheit');
select is(
  (select array[ws.merged::text, sl.source::text, cl.distance_m::text, ws.kcal::text]
   from public.wearable_sessions ws
   join public.session_logs sl on sl.id = ws.session_log_id
   join public.cardio_logs cl on cl.session_log_id = sl.id
   where ws.external_id = 'hc-merge'),
  array['true', 'manual', '6000', '300'],
  'App-Eintrag bleibt führend (Herkunft, Distanz), Uhr ergänzt kcal');
select is((select max_bpm::integer from public.heart_rate_summaries
           where session_log_id = 'a0000000-0000-4000-8000-000000000001'), 180, 'Uhr ergänzt den Puls');
select ok((select duplicate_of is null from public.wearable_sessions where external_id = 'hc-dup-fremd'),
  'Doppel-Hinweis nie auf fremde Einträge');
select is(
  public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-merge2', 'run', interval '3 days', 2400, jsonb_build_object(
      'merge_into', 'a0000000-0000-4000-8000-000000000001'))))) ->> 'created',
  '1', 'schon verknüpfter Eintrag nimmt keine zweite Uhr-Einheit auf');

-- Möglicher Doppel-Eintrag: behalten bzw. zusammenführen.
select lives_ok($$ select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('hc-dup1', 'run', interval '5 days' + interval '30 minutes', 2400, jsonb_build_object(
      'possible_duplicate_of', 'a0000000-0000-4000-8000-000000000002',
      'heart_rate', '{"avg_bpm": 140, "max_bpm": 170, "zone_s": [0, 600, 600, 0, 0], "hf_max_used": 186}'::jsonb)),
    pg_temp.sess('hc-dup2', 'run', interval '5 days' + interval '35 minutes', 2400, jsonb_build_object(
      'possible_duplicate_of', 'a0000000-0000-4000-8000-000000000002'))))) $$,
  'zwei Uhr-Einheiten mit Doppel-Hinweis');
select is((select count(*)::integer from public.wearable_sessions
           where duplicate_of = 'a0000000-0000-4000-8000-000000000002'), 2, 'Hinweis gespeichert');
select lives_ok(
  $$ select public.resolve_wearable_duplicate(
       (select session_log_id from public.wearable_sessions where external_id = 'hc-dup2'), false) $$,
  'beide behalten');
select ok((select duplicate_of is null from public.wearable_sessions where external_id = 'hc-dup2'),
  'Hinweis weg, Eintrag bleibt');
select lives_ok(
  $$ select public.resolve_wearable_duplicate(
       (select session_log_id from public.wearable_sessions where external_id = 'hc-dup1'), true) $$,
  'zusammenführen');
select is(
  (select array[ws.session_log_id::text, ws.merged::text, h.max_bpm::text]
   from public.wearable_sessions ws join public.heart_rate_summaries h on h.session_log_id = ws.session_log_id
   where ws.external_id = 'hc-dup1'),
  array['a0000000-0000-4000-8000-000000000002', 'true', '170'],
  'Uhr-Einheit und Puls gehören jetzt zum eigenen Eintrag');
select is((select count(*)::integer from public.session_logs where source = 'health_connect'), 8,
  'der übernommene Doppel-Eintrag ist gelöscht');
select throws_ok(
  $$ select public.resolve_wearable_duplicate(
       (select session_log_id from public.wearable_sessions where external_id = 'hc-dup2'), true) $$,
  '22023', 'Kein möglicher Doppel-Eintrag.', 'ohne Hinweis nichts zu entscheiden');

-- ---------------------------------------------------------------------------------------------------------
-- Isolation (Fremdzugriff)
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(
  (select count(*)::integer from public.wearable_sessions) + (select count(*)::integer from public.heart_rate_summaries)
  + (select count(*)::integer from public.daily_metrics) + (select count(*)::integer from public.wearable_connections),
  0, 'D sieht nichts von A');
select throws_ok(
  $$ select public.resolve_wearable_duplicate(
       (select ws.session_log_id from public.wearable_sessions ws limit 1), false) $$,
  '22023', 'Kein möglicher Doppel-Eintrag.', 'D kann nichts von A entscheiden');
select is(public.disconnect_wearable('health_connect', true), 0, 'D trennt: löscht nichts von A');
select is((select count(*)::integer from public.session_logs where id = 'd0000000-0000-4000-8000-000000000001'), 1,
  'Ds eigener Eintrag unverändert');
select lives_ok($$ select public.connect_wearable('health_connect', '[]') $$, 'D verbindet ohne Rechte');
select is((select status::text from public.wearable_connections), 'permission_missing', '„Zugriff fehlt“');
select lives_ok($$ select public.connect_wearable('health_connect', '["steps"]') $$, 'D gibt Schritte frei');
select is((select status::text from public.wearable_connections), 'connected', 'verbunden');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is((select count(*)::integer from public.wearable_connections), 1, 'A sieht nur die eigene Verbindung');

-- ---------------------------------------------------------------------------------------------------------
-- Export, Widerruf, Trennen
-- ---------------------------------------------------------------------------------------------------------
select is(
  (select array[jsonb_array_length(d -> 'wearable_connections'), jsonb_array_length(d -> 'wearable_sessions'),
                jsonb_array_length(d -> 'heart_rate_summaries'), jsonb_array_length(d -> 'daily_metrics')]
   from (select public.export_my_data() -> 'data' as d) x),
  array[1, 10, 3, 2], 'Export: alle vier Tabellen');
update public.consents set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111' and consent_type = 'wearable_data';
select is(
  (select count(*)::integer from public.heart_rate_summaries) + (select count(*)::integer from public.daily_metrics)
  + (select count(*)::integer from public.wearable_connections),
  0, 'Widerruf wearable_data: Puls, Tageswerte und Verbindung gelöscht');
select is((select count(*)::integer from public.wearable_sessions), 10,
  'Widerruf: übernommene Einheiten bleiben (normale Einträge ohne Puls)');
select throws_ok($$ select public.import_wearable_batch(pg_temp.batch('[]')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'nach dem Widerruf kein Abgleich');
select is(public.disconnect_wearable('health_connect', false), 0, 'Trennen „behalten“ geht ohne Einwilligung');
select is((select count(*)::integer from public.wearable_sessions), 10, '„behalten“: Einheiten bleiben');
select is(public.disconnect_wearable('health_connect', true), 8, 'Trennen „löschen“: eigene Uhr-Einträge gelöscht');
select is(
  (select array[(select count(*)::integer from public.wearable_sessions),
                (select count(*)::integer from public.session_logs where source = 'health_connect'),
                (select count(*)::integer from public.session_logs where id in (
                   'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'))]),
  array[0, 0, 2], '„löschen“: zusammengeführte App-Einträge bleiben, nur ohne Verknüpfung');

-- Widerruf health_data löscht ebenfalls Puls und Tageswerte (D).
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select lives_ok($$ select public.import_wearable_batch(pg_temp.batch(jsonb_build_array(
    pg_temp.sess('d-run', 'run', interval '1 day', 1800,
      '{"heart_rate": {"avg_bpm": 145, "max_bpm": 172, "zone_s": [0, 0, 0, 0, 0], "hf_max_used": 186}}')),
    jsonb_build_array(jsonb_build_object('day', private.berlin_today()::text, 'resting_hr_bpm', 50,
      'sleep_min', null, 'steps', null)))) $$, 'D übernimmt');
select lives_ok($$ select public.revoke_health_data(false) $$, 'D widerruft health_data');
select is(
  (select count(*)::integer from public.heart_rate_summaries) + (select count(*)::integer from public.daily_metrics)
  + (select count(*)::integer from public.wearable_connections),
  0, 'Widerruf health_data: Puls, Tageswerte und Verbindung gelöscht');

-- Kaskade beim Konto löschen
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.wearable_sessions
           where user_id = '44444444-4444-4444-8444-444444444444'), 0, 'Konto löschen: alles weg');

select * from finish();
rollback;
