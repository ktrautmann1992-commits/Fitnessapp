-- „Erholung aus der Uhr“ (Gründer-Freigabe 25.10.2026, docs/PLAN-PHASE-8.md 15; Migrationen
-- 20261025120000_recovery_hrv.sql und 20261025120100_app_layout_recovery.sql): HRV je Tag in daily_metrics (Grenzen,
-- „mindestens ein Wert“), Datentyp „hrv“, import_wearable_batch mit und OHNE hrv_rmssd_ms (ältere App-Fassung),
-- Einwilligung Fassung 3 (Fassung 2 reicht nicht mehr), RLS/Isolation, Export, Widerruf, Trennen, Kaskade, Kachel
-- „recovery“ in save_app_layout.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- A: aktuelle Fassungen. B: wearable_data nur Fassung 2 (alt). D: aktuelle Fassungen (fremde Person).
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, public.current_consent_version(t), 'android'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data', 'wearable_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform) values
  ('22222222-2222-4222-8222-222222222222', 'health_data', public.current_consent_version('health_data'), 'android'),
  ('22222222-2222-4222-8222-222222222222', 'wearable_data', 2, 'android');

create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
grant execute on function pg_temp.as_user(uuid) to authenticated;

-- Abgleich nur mit Tageswerten (wie wearableImportBatchSchema).
create function pg_temp.days(p_days jsonb, p_types jsonb default '["sleep", "resting_heart_rate", "hrv"]')
returns jsonb language sql as $$
  select jsonb_build_object('provider', 'health_connect', 'granted_types', p_types, 'sessions', '[]'::jsonb,
    'days', p_days)
$$;
grant execute on function pg_temp.days(jsonb, jsonb) to authenticated;

create function pg_temp.day(p_ago integer, p_hrv jsonb, p_rest jsonb default 'null', p_sleep jsonb default 'null')
returns jsonb language sql stable as $$
  select jsonb_build_object('day', (private.berlin_today() - p_ago)::text, 'resting_hr_bpm', p_rest,
    'sleep_min', p_sleep, 'steps', null, 'hrv_rmssd_ms', p_hrv)
$$;
grant execute on function pg_temp.day(integer, jsonb, jsonb, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Aufbau
-- ---------------------------------------------------------------------------------------------------------
select is(
  (select version from public.consent_documents where consent_type = 'wearable_data' and published_at is not null
   order by version desc limit 1),
  3, 'wearable_data: Fassung 3 veröffentlicht');
select ok(
  (select body_de like '%Herzfrequenzvariabilität (HRV)%' and body_de like '%„Erholung“%'
     and body_de like '%keine Bewertung deiner Gesundheit%'
   from public.consent_documents where consent_type = 'wearable_data' and version = 3),
  'Fassung 3 nennt HRV, die Erholung und „keine Bewertung deiner Gesundheit“');
select is(public.current_consent_version('wearable_data'), 3, 'aktuelle Fassung = 3');
select col_type_is('public', 'daily_metrics', 'hrv_rmssd_ms', 'smallint', 'Spalte hrv_rmssd_ms (smallint)');
select col_is_null('public', 'daily_metrics', 'hrv_rmssd_ms', 'HRV darf fehlen');
select ok((select relrowsecurity from pg_class where oid = 'public.daily_metrics'::regclass), 'RLS weiter an');
select ok(
  (select has_table_privilege('authenticated', 'public.daily_metrics', 'select')
     and not has_table_privilege('authenticated', 'public.daily_metrics', 'insert')
     and not has_table_privilege('authenticated', 'public.daily_metrics', 'update')
     and not has_table_privilege('anon', 'public.daily_metrics', 'select')),
  'authenticated nur lesen, anon nichts');

-- CHECKs direkt (als Eigentümer): HRV 5–300, HRV allein reicht als „ein Wert“.
select throws_ok(
  $$ insert into public.daily_metrics (user_id, day, provider, hrv_rmssd_ms)
     values ('11111111-1111-4111-8111-111111111111', '2026-01-01', 'health_connect', 4) $$,
  '23514', null, 'HRV unter 5 ms abgelehnt');
select throws_ok(
  $$ insert into public.daily_metrics (user_id, day, provider, hrv_rmssd_ms)
     values ('11111111-1111-4111-8111-111111111111', '2026-01-01', 'health_connect', 301) $$,
  '23514', null, 'HRV über 300 ms abgelehnt');
select throws_ok(
  $$ insert into public.daily_metrics (user_id, day, provider)
     values ('11111111-1111-4111-8111-111111111111', '2026-01-01', 'health_connect') $$,
  '23514', null, 'Tag ganz ohne Wert abgelehnt');
select throws_ok(
  $$ insert into public.wearable_connections (user_id, provider, status, granted_types)
     values ('11111111-1111-4111-8111-111111111111', 'health_connect', 'connected', '{hrv,puls}') $$,
  '23514', null, 'unbekannter Datentyp abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Import
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select throws_ok($$ select public.import_wearable_batch(pg_temp.days('[]')) $$, '42501',
  'Einwilligung Smartwatch-Daten fehlt.', 'nur Fassung 2: kein Abgleich (neue Fassung nötig)');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select lives_ok($$ select public.connect_wearable('health_connect', '["sleep", "resting_heart_rate", "hrv"]') $$,
  'Verbinden mit Datentyp „hrv“');
select is(
  public.import_wearable_batch(pg_temp.days(jsonb_build_array(
    pg_temp.day(0, '42', '58', '310'),
    pg_temp.day(1, '61'),
    pg_temp.day(6, '61.5'),
    pg_temp.day(2, '4'),
    pg_temp.day(3, '301'),
    pg_temp.day(4, '"60"'),
    pg_temp.day(5, 'null')))),
  '{"created": 0, "updated": 0, "merged": 0, "skipped": 5, "days": 2}'::jsonb,
  'HRV 5–300 ms (ganze Zahl) übernommen; außerhalb, Kommazahl, Text, ganz leer übersprungen');
select is(
  (select array_agg(hrv_rmssd_ms::integer order by day desc) from public.daily_metrics),
  array[42, 61], 'HRV je Tag gespeichert');
select is((select granted_types from public.wearable_connections), array['hrv', 'resting_heart_rate', 'sleep'],
  'freigegebene Datentypen mit „hrv“');

-- Ältere App-Fassung (Tage OHNE hrv_rmssd_ms) wird weiter angenommen; gespeicherte HRV bleibt.
select is(
  public.import_wearable_batch(jsonb_build_object('provider', 'health_connect',
    'granted_types', '["sleep", "resting_heart_rate"]'::jsonb, 'sessions', '[]'::jsonb,
    'days', jsonb_build_array(jsonb_build_object('day', private.berlin_today()::text, 'resting_hr_bpm', 60,
      'sleep_min', 330, 'steps', 4000)))) ->> 'days',
  '1', 'Tag ohne hrv_rmssd_ms: angenommen');
select is(
  (select array[resting_hr_bpm::integer, sleep_min::integer, steps, hrv_rmssd_ms::integer]
   from public.daily_metrics where day = private.berlin_today()),
  array[60, 330, 4000, 42], 'fehlendes HRV-Feld behält den gespeicherten Wert');
select is(
  public.import_wearable_batch(pg_temp.days(jsonb_build_array(pg_temp.day(0, '45')))) ->> 'days',
  '1', 'HRV allein aktualisiert den Tag');
select is((select hrv_rmssd_ms::integer from public.daily_metrics where day = private.berlin_today()), 45,
  'neuer HRV-Wert ersetzt den alten');
select throws_ok(
  $$ select public.import_wearable_batch(pg_temp.days('[]', '["hrv", "hrv"]')) $$, '22023',
  'Ungültiger Abgleich.', 'doppelter Datentyp abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Isolation, Export, Widerruf, Kachel
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is((select count(*)::integer from public.daily_metrics), 0, 'D sieht keine HRV von A');

select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(
  (select (d -> 'daily_metrics' -> 0) ? 'hrv_rmssd_ms' from (select public.export_my_data() -> 'data' as d) x),
  true, 'Export enthält hrv_rmssd_ms');
select lives_ok(
  $$ select public.save_app_layout('{"dashboard_tiles": [{"id": "recovery", "visible": true},
       {"id": "steps", "visible": false}], "tab_bar": ["uebersicht", "today", "mehr"]}') $$,
  'Kachel „recovery“ speicherbar');
select throws_ok(
  $$ select public.save_app_layout('{"dashboard_tiles": [{"id": "erholung", "visible": true}],
       "tab_bar": ["uebersicht", "today", "mehr"]}') $$,
  '22023', 'Ungültige Kachel.', 'unbekannte Kachel weiter abgelehnt');

reset role;
update public.consents set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111' and consent_type = 'wearable_data';
select is((select count(*)::integer from public.daily_metrics
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Widerruf: HRV-Tageswerte gelöscht');

-- Kaskade beim Konto löschen (D mit HRV).
set local role authenticated;
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(
  public.import_wearable_batch(pg_temp.days(jsonb_build_array(pg_temp.day(0, '50')))) ->> 'days', '1',
  'D übernimmt HRV');
reset role;
delete from auth.users where id = '44444444-4444-4444-8444-444444444444';
select is((select count(*)::integer from public.daily_metrics
           where user_id = '44444444-4444-4444-8444-444444444444'), 0, 'Konto löschen: HRV weg');

select * from finish();
rollback;
