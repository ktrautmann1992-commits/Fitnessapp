-- Etappe E3 · Gericht per Foto (docs/PLAN-AUSWERTUNG.md Abschnitt 9, 2.7, A-G15/A-G17/A-G18/A-G20): Einwilligung
-- ai_food_photo, Feature-Flag + Beta-Freischaltung (beta_admin), ai_usage (nur Metadaten, RLS: eigene Zeilen lesen,
-- schreiben nur Server), ai_food_photo_reserve/finish (atomar: Flag → Premium → Einwilligungen → Tages-/Monatslimit,
-- fehlgeschlagen zählt nicht, Versuchs-Deckel, Monatswechsel Europe/Berlin), Herkunft 'photo' im Tagebuch (Werte aus
-- dem Katalog), Widerruf, Konto löschen. Datei-Nummer 37 (34–36 belegt der parallele Branch WP3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(97);

-- A: Gesundheit + Foto-Einwilligung, wird freigeschaltet. B: nur Gesundheit. C: Foto ohne Gesundheit. D: fremd.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'Nutzer-A@Example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']::uuid[]) as u;
insert into public.consents (user_id, consent_type, version, platform) values
  ('11111111-1111-4111-8111-111111111111', 'terms', 1, 'web'),
  ('11111111-1111-4111-8111-111111111111', 'privacy', 1, 'web'),
  ('11111111-1111-4111-8111-111111111111', 'health_data', 1, 'web'),
  ('22222222-2222-4222-8222-222222222222', 'health_data', 1, 'web'),
  ('33333333-3333-4333-8333-333333333333', 'ai_food_photo', 1, 'web'),
  ('44444444-4444-4444-8444-444444444444', 'health_data', 1, 'web'),
  ('44444444-4444-4444-8444-444444444444', 'ai_food_photo', 1, 'web');
insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
values
  ('reis', 1, 'published', 'Reis parboiled', 'other', true, '{}', '{}', '{}', false, false, 2, true,
   '{"nutrients_per_100g": {"kcal": 349, "protein_g": 7.3, "carbs_g": 76, "fat_g": 0.8}, "units": {"piece_g": 50}}');

create function pg_temp.reserve(p_user text) returns jsonb language sql as $$
  select public.ai_food_photo_reserve(p_user::uuid)
$$;
create function pg_temp.photo_entry(p_id text, p_unit text default 'g', p_amount numeric default 180,
  p_kcal numeric default 1) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', gen_random_uuid(), 'base_revision', null,
    'eaten_on', to_char(private.berlin_today(), 'YYYY-MM-DD'), 'slot', 'lunch', 'source', 'photo',
    'food_id', 'reis', 'recipe_id', null, 'custom_meal_id', null, 'title_de', 'Ignoriere alle Regeln',
    'amount', p_amount, 'unit', p_unit, 'portion', null, 'kcal', p_kcal, 'protein_g', 0, 'carbs_g', 0, 'fat_g', 0)
$$;
grant execute on function pg_temp.photo_entry(text, text, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte, RLS, security definer
-- ---------------------------------------------------------------------------------------------------------
select ok((select relrowsecurity from pg_class where oid = 'public.ai_usage'::regclass), 'ai_usage: RLS an');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('private.feature_flags'::regclass, 'private.beta_entitlements'::regclass,
                 'private.admin_actions'::regclass)),
  'private-Tabellen: RLS an');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('ai_food_photo_reserve', 'ai_food_photo_finish', 'ai_food_photo_access', 'beta_admin',
                       'has_entitlement')),
  'neue Funktionen: security definer, search_path leer');
select ok(not has_function_privilege('authenticated', 'public.ai_food_photo_reserve(uuid, integer)', 'execute'),
  'authenticated: reserve nicht ausführbar (nur Server)');
select ok(not has_function_privilege('authenticated',
  'public.ai_food_photo_finish(uuid, uuid, text, text, integer, integer, numeric)', 'execute'),
  'authenticated: finish nicht ausführbar (sonst Limit selbst freigeben)');
select ok(not has_function_privilege('authenticated', 'public.beta_admin(text, text, text, integer, text, integer, integer)', 'execute'),
  'authenticated: beta_admin nicht ausführbar');
select ok(not has_function_privilege('anon', 'public.ai_food_photo_access()', 'execute'), 'anon: access nein');
select ok(not has_function_privilege('anon', 'public.has_entitlement(text)', 'execute'), 'anon: has_entitlement nein');
select ok(has_function_privilege('service_role', 'public.ai_food_photo_reserve(uuid, integer)', 'execute'),
  'service_role: reserve ja');
select ok(not has_table_privilege('authenticated', 'public.ai_usage', 'insert')
          and not has_table_privilege('authenticated', 'public.ai_usage', 'update')
          and not has_table_privilege('authenticated', 'public.ai_usage', 'delete')
          and has_table_privilege('authenticated', 'public.ai_usage', 'select'),
  'authenticated: ai_usage nur lesen');
select ok(not has_table_privilege('anon', 'public.ai_usage', 'select'), 'anon: ai_usage nicht lesbar');
select ok(not has_table_privilege('authenticated', 'private.beta_entitlements', 'select')
          and not has_table_privilege('authenticated', 'private.feature_flags', 'select')
          and not has_table_privilege('authenticated', 'private.admin_actions', 'select'),
  'authenticated: private-Tabellen nicht lesbar');
-- Sperr-Reihenfolge wie save_food_log_entries (Wächter N7 S2).
select ok(
  (select position('for share' in p.prosrc) between 1 and position('has_valid_consent_for' in p.prosrc)
          and position('has_valid_consent_for' in p.prosrc) < position('pg_advisory_xact_lock' in p.prosrc)
          and position('pg_advisory_xact_lock' in p.prosrc) < position('ai_food_photo_usage' in p.prosrc)
          and position('ai_food_photo_usage' in p.prosrc) < position('insert into public.ai_usage' in p.prosrc)
   from pg_proc p where p.proname = 'ai_food_photo_reserve'),
  'reserve: Einwilligung FOR SHARE → prüfen → Advisory-Sperre → zählen → schreiben');
select ok(
  not exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'ai_usage'
                and column_name not in ('id', 'user_id', 'feature', 'status', 'model', 'input_tokens',
                                        'output_tokens', 'cost_eur', 'created_at', 'finished_at')),
  'ai_usage: nur Metadaten-Spalten (keine Inhalte)');

-- ---------------------------------------------------------------------------------------------------------
-- Einwilligungstext
-- ---------------------------------------------------------------------------------------------------------
select is(public.current_consent_version('ai_food_photo'), 1, 'ai_food_photo: Text Version 1 veröffentlicht');
select ok(
  (select body_de like '%Derzeit Testversion%' and body_de like '%an keinen KI-Anbieter übermittelt%'
          and body_de like '%fragen dich erneut%' and body_de like '%speichern das Foto nicht%'
          and body_de like '%Schätzung%' and body_de like '%Widerruf%'
          and body_de not like '%nicht zum Training%' and body_de not like '%in der EU%'
   from public.consent_documents where consent_type = 'ai_food_photo' and version = 1),
  'Text v1 (Wächter E3 M3): Testversion ohne Übermittlung, neue Frage vor echter KI, keine Zusagen zum Anbieter');

-- ---------------------------------------------------------------------------------------------------------
-- Flag und Freischaltung (beta_admin, nur service_role)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'), '{"result": "flag_off"}'::jsonb,
  'Flag aus (Standard) → flag_off, keine Reservierung');
select is(public.beta_admin('flag_on', 'gruender-1'), '{"result": "flag_on"}'::jsonb, 'Flag an');
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'), '{"result": "no_entitlement"}'::jsonb,
  'ohne Freischaltung → no_entitlement');
select is(public.beta_admin('grant', 'gruender-1', 'unbekannt@example.test'), '{"result": "not_found"}'::jsonb,
  'unbekannte E-Mail → not_found (ohne Echo)');
select is(public.beta_admin('grant', 'gruender-1', E'a@b.de\n::set-output'), '{"result": "invalid_input"}'::jsonb,
  'E-Mail mit Zeilenumbruch → invalid_input');
select is(public.beta_admin('grant', 'gruender 1; drop', 'nutzer-a@example.test'),
  '{"result": "invalid_input"}'::jsonb, 'ungültiger GitHub-Name → invalid_input');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-a@example.test', 181),
  '{"result": "invalid_input"}'::jsonb, '181 Tage → invalid_input');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-a@example.test', 90) ->> 'result', 'granted',
  'Freischaltung (E-Mail ohne Groß-/Kleinschreibung)');
select ok(public.beta_admin('grant', 'gruender-1', 'nutzer-a@example.test', 90)::text !~ '(nutzer|1111|@)',
  'Antwort ohne E-Mail und ohne user_id');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-c@example.test', 30) ->> 'result', 'granted',
  'Freischaltung C');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-d@example.test', 30) ->> 'result', 'granted',
  'Freischaltung D');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-b@example.test', 30) ->> 'result', 'granted',
  'Freischaltung B');
reset role;
select is((select count(*) from private.admin_actions where action = 'beta_grant' and actor = 'gruender-1'), 5::bigint,
  'Protokoll: jede Freischaltung mit GitHub-Namen');

-- ---------------------------------------------------------------------------------------------------------
-- Einwilligungen
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'), '{"result": "no_consent"}'::jsonb,
  'A ohne Foto-Einwilligung → no_consent');
select is(pg_temp.reserve('22222222-2222-4222-8222-222222222222'), '{"result": "no_consent"}'::jsonb,
  'B ohne Foto-Einwilligung → no_consent');
select is(pg_temp.reserve('33333333-3333-4333-8333-333333333333'), '{"result": "no_consent"}'::jsonb,
  'C mit Foto-, ohne Gesundheits-Einwilligung → no_consent');
reset role;
select is((select count(*) from public.ai_usage), 0::bigint, 'abgelehnt → keine Zeile in ai_usage');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.consents (consent_type, version, platform) values ('ai_food_photo', 1, 'web');
select is(public.ai_food_photo_access(),
  '{"active": true, "reason": "ok", "daily_limit": null, "monthly_limit": null}'::jsonb,
  'access: A aktiv (Standard-Limits)');
select ok(public.has_entitlement(), 'has_entitlement: A ja');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Reservieren und abschließen
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
create temp table res as select pg_temp.reserve('11111111-1111-4111-8111-111111111111') as r;
select is((select r - 'id' from res),
  '{"result": "reserved", "remaining_month": 29, "remaining_today": 7}'::jsonb, 'erste Reservierung');
select is(public.ai_food_photo_finish((select (r ->> 'id')::uuid from res), '44444444-4444-4444-8444-444444444444',
  'succeeded', 'attrappe', 1, 1, 0), '{"result": "not_found"}'::jsonb, 'finish fremder Person → not_found');
select throws_ok(
  format($$ select public.ai_food_photo_finish(%L, %L, 'reserved', null, null, null, null) $$,
         (select r ->> 'id' from res), '11111111-1111-4111-8111-111111111111'),
  '22023', 'Ungültiger Status.', 'finish: Status nur succeeded/failed');
select throws_ok(
  format($$ select public.ai_food_photo_finish(%L, %L, 'succeeded', 'Gemini <b>', 1, 1, 0) $$,
         (select r ->> 'id' from res), '11111111-1111-4111-8111-111111111111'),
  '23514', 'Ungültige Werte.', 'finish: Modellname nur [a-z0-9.-], Fehler ohne Werte');
select is(public.ai_food_photo_finish((select (r ->> 'id')::uuid from res), '11111111-1111-4111-8111-111111111111',
  'succeeded', 'gemini-3.5-flash-lite', 1200, 180, 0.00081), '{"result": "ok"}'::jsonb, 'finish succeeded');
select is(public.ai_food_photo_finish((select (r ->> 'id')::uuid from res), '11111111-1111-4111-8111-111111111111',
  'failed', 'gemini-3.5-flash-lite', 1, 1, 0), '{"result": "not_found"}'::jsonb,
  'zweiter Abschluss → not_found (Limit nicht zurückholbar)');
-- Fehlgeschlagen zählt nicht.
create temp table res2 as select pg_temp.reserve('11111111-1111-4111-8111-111111111111') as r;
select is((select r ->> 'remaining_month' from res2), '28', 'zweite Reservierung zählt (während sie läuft)');
select is(public.ai_food_photo_finish((select (r ->> 'id')::uuid from res2), '11111111-1111-4111-8111-111111111111',
  'failed', 'attrappe', 0, 0, 0), '{"result": "ok"}'::jsonb, 'finish failed');
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'remaining_month', '28',
  'fehlgeschlagener Aufruf zählt nicht gegen das Limit');
reset role;
select is(
  (select array_agg(status order by status) from public.ai_usage where user_id = '11111111-1111-4111-8111-111111111111'),
  array['failed', 'reserved', 'succeeded'], 'ai_usage: Zeilen mit Status');

-- RLS: eigene Zeilen lesen, fremde nicht; nicht schreiben.
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is((select count(*) from public.ai_usage), 0::bigint, 'D sieht keine Zeilen von A');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*) from public.ai_usage), 3::bigint, 'A sieht eigene Zeilen');
select throws_ok($$ insert into public.ai_usage (user_id, feature) values (auth.uid(), 'food_photo') $$, '42501',
  null, 'A darf nicht selbst einfügen');
select throws_ok($$ update public.ai_usage set status = 'failed' $$, '42501', null,
  'A darf eigene Nutzung nicht auf failed setzen');
select throws_ok($$ delete from public.ai_usage $$, '42501', null, 'A darf Nutzung nicht löschen');
select throws_ok($$ select public.ai_food_photo_reserve(auth.uid()) $$, '42501', null,
  'A darf nicht selbst reservieren');
select throws_ok($$ select * from private.beta_entitlements $$, '42501', null, 'A liest keine Freischaltungen');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Limits (Kalendermonat/-tag Europe/Berlin)
-- ---------------------------------------------------------------------------------------------------------
delete from public.ai_usage;
-- Monatswechsel: 40 Fotos in der letzten Minute des Vormonats (Berlin) zählen nicht.
insert into public.ai_usage (user_id, feature, status, created_at, finished_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded',
       (date_trunc('month', now() at time zone 'Europe/Berlin') - interval '1 minute') at time zone 'Europe/Berlin',
       now()
from generate_series(1, 40);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'remaining_month', '29',
  'Vormonat (23:59 Berlin) zählt nicht – neuer Monat beginnt um Mitternacht Berlin');
reset role;
-- … und die erste Minute des Monats (00:01 Berlin = 22:01 bzw. 23:01 UTC am Vortag) zählt schon zum neuen Monat.
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, created_at, finished_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded',
       (date_trunc('month', now() at time zone 'Europe/Berlin') + interval '1 minute') at time zone 'Europe/Berlin',
       now()
from generate_series(1, 30);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'scope', 'month',
  '00:01 Berlin am Monatsersten zählt zum neuen Monat (nicht UTC)');
reset role;
-- Reservierung ohne Abschluss zählt weiter, auch nach Stunden (fail closed, Wächter E3 M4).
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, created_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'reserved',
       greatest(now() - interval '3 hours', private.berlin_today()::timestamp at time zone 'Europe/Berlin')
from generate_series(1, 7);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'remaining_today', '0',
  'Reservierungen ohne Abschluss zählen weiter gegen das Tageslimit (fail closed)');
reset role;
-- Tageslimit 8.
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, finished_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded', now() from generate_series(1, 7);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') - 'id',
  '{"result": "reserved", "remaining_month": 22, "remaining_today": 0}'::jsonb, 'achtes Foto des Tages geht');
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'),
  jsonb_build_object('result', 'limit', 'scope', 'day',
                     'available_from', to_char(private.berlin_today() + 1, 'YYYY-MM-DD')),
  'neuntes Foto → Tageslimit, ab morgen wieder');
reset role;
-- Versuchs-Deckel 16 (auch fehlgeschlagene).
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, finished_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'failed', now() from generate_series(1, 16);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'scope', 'day',
  '16 fehlgeschlagene Versuche heute → gesperrt bis morgen');
reset role;
-- Monatslimit 30, letztes Foto des Monats.
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, created_at, finished_at)
select '11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded',
       greatest(date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin',
                now() - interval '1 day'), now()
from generate_series(1, 29);
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'remaining_month', '0',
  'letztes (30.) Foto des Monats geht');
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'),
  jsonb_build_object('result', 'limit', 'scope', 'month', 'available_from',
    to_char((date_trunc('month', private.berlin_today()) + interval '1 month')::date, 'YYYY-MM-DD')),
  '31. Foto → Monatslimit, ab dem 1. des Folgemonats');
reset role;
-- Datensparsamkeit: Zeilen älter als 400 Tage werden beim Reservieren gelöscht.
delete from public.ai_usage;
insert into public.ai_usage (user_id, feature, status, created_at, finished_at)
values ('11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded', now() - interval '401 days', now()),
       ('11111111-1111-4111-8111-111111111111', 'food_photo', 'succeeded', now() - interval '399 days', now());
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111') ->> 'result', 'reserved', 'Reservierung räumt auf');
reset role;
select is((select count(*) from public.ai_usage where created_at < now() - interval '400 days'), 0::bigint,
  'ai_usage: Zeilen älter als 400 Tage gelöscht');
select is((select count(*) from public.ai_usage), 2::bigint, 'jüngere Zeilen bleiben');

-- ---------------------------------------------------------------------------------------------------------
-- Herkunft 'photo' im Tagebuch: Werte und Titel aus dem Katalog, nur Gramm
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.save_food_log_entries(jsonb_build_array(pg_temp.photo_entry('00000000-0000-4000-8000-000000000001'))) -> 0
    ->> 'result', 'saved', 'Foto-Bestandteil gespeichert');
select results_eq(
  $$ select source, title_de, amount, unit, kcal, protein_g, carbs_g, fat_g from public.food_log_entries
     where id = '00000000-0000-4000-8000-000000000001' $$,
  $$ values ('photo'::text, 'Reis parboiled'::text, 180::numeric, 'g'::text, 628, 13.1::numeric, 136.8::numeric,
            1.4::numeric) $$,
  'Titel und Werte aus dem Katalog (nicht vom Gerät, nicht von der KI)');
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.photo_entry('00000000-0000-4000-8000-000000000002', 'piece', 2))) -> 0,
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Foto-Bestandteil nur in Gramm');
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.photo_entry('00000000-0000-4000-8000-000000000003', 'g', 180, 99999))) -> 0,
  '{"result": "rejected", "code": "invalid"}'::jsonb, 'Gerätewerte außerhalb der Grenzen → abgelehnt');
-- Ändern der Menge rechnet neu aus dem Katalog.
select is(
  public.save_food_log_entries(jsonb_build_array(
    pg_temp.photo_entry('00000000-0000-4000-8000-000000000001', 'g', 90) || '{"base_revision": 1}')) -> 0
    ->> 'result', 'saved', 'Menge ändern');
select is((select kcal from public.food_log_entries where id = '00000000-0000-4000-8000-000000000001'), 314,
  'neue Menge: Werte neu aus dem Katalog');
reset role;
select throws_ok(
  $$ insert into public.food_log_entries (user_id, eaten_on, slot, source, food_id, title_de, amount, unit, kcal,
       protein_g, carbs_g, fat_g, last_write_id)
     values ('11111111-1111-4111-8111-111111111111', current_date, 'lunch', 'photo', 'reis', 'Reis', 1, 'piece', 1, 0,
             0, 0, gen_random_uuid()) $$,
  '23514', null, 'CHECK: photo nur mit Einheit g');
select throws_ok(
  $$ insert into public.food_log_entries (user_id, eaten_on, slot, source, food_id, title_de, amount, unit, kcal,
       protein_g, carbs_g, fat_g, last_write_id)
     values ('11111111-1111-4111-8111-111111111111', current_date, 'lunch', 'photo', null, 'Reis', 10, 'g', 1, 0,
             0, 0, gen_random_uuid()) $$,
  '23514', null, 'CHECK: photo nur mit Lebensmittel');

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
update public.consents set revoked_at = now() where consent_type = 'ai_food_photo' and revoked_at is null;
reset role;
set local role service_role;
select is(pg_temp.reserve('11111111-1111-4111-8111-111111111111'), '{"result": "no_consent"}'::jsonb,
  'Widerruf ai_food_photo → keine Auswertung mehr');
reset role;
select is((select count(*) from public.food_log_entries where user_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint, 'Widerruf ai_food_photo: Tagebuch bleibt (gehört zu health_data)');
select is((select count(*) from public.ai_usage where user_id = '11111111-1111-4111-8111-111111111111'), 2::bigint,
  'Widerruf ai_food_photo: Metadaten bleiben (Kontingent, keine Inhalte – Gründer-Frage E3-G2)');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
update public.consents set revoked_at = now() where consent_type = 'health_data' and revoked_at is null;
reset role;
select is((select count(*) from public.food_log_entries where user_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint, 'Widerruf health_data löscht auch Foto-Einträge');

-- ---------------------------------------------------------------------------------------------------------
-- Ablauf der Freischaltung, Entziehen, Status
-- ---------------------------------------------------------------------------------------------------------
update private.beta_entitlements set granted_at = now() - interval '31 days', expires_at = now() - interval '1 day'
where user_id = '44444444-4444-4444-8444-444444444444';
set local role service_role;
select is(pg_temp.reserve('44444444-4444-4444-8444-444444444444'), '{"result": "no_entitlement"}'::jsonb,
  'abgelaufene Freischaltung → no_entitlement');
select is(public.beta_admin('revoke', 'gruender-1', 'nutzer-c@example.test'), '{"result": "revoked"}'::jsonb,
  'Entziehen');
select is(pg_temp.reserve('33333333-3333-4333-8333-333333333333'), '{"result": "no_entitlement"}'::jsonb,
  'entzogen → no_entitlement');
select ok(
  (select s ? 'photos_this_month' and s ? 'cost_eur_this_month' and s::text !~ '(@|1111)'
   from (select public.beta_admin('status', 'gruender-1') as s) x),
  'status: nur Zahlen (Kostenübersicht ohne Personenbezug)');
select is(public.beta_admin('flag_off', 'gruender-1'), '{"result": "flag_off"}'::jsonb, 'Flag aus');
select is(pg_temp.reserve('22222222-2222-4222-8222-222222222222'), '{"result": "flag_off"}'::jsonb,
  'Flag aus wirkt sofort (Notbremse)');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(public.ai_food_photo_access(), '{"active": false, "reason": "flag_off"}'::jsonb, 'access: Flag aus');
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select ok(not public.has_entitlement(), 'has_entitlement: entzogen');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Wächter E3 M3: echter Anbieter nur mit Einwilligungsfassung ≥ 2; N6: Limits je Person
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select public.beta_admin('flag_on', 'gruender-1') is not null as flag_on \gset
select public.beta_admin('grant', 'gruender-1', 'nutzer-d@example.test', 30) is not null as grant_d \gset
select is(public.ai_food_photo_reserve('44444444-4444-4444-8444-444444444444', 2), '{"result": "not_configured"}'::jsonb,
  'Mindest-Fassung 2 ohne veröffentlichten Text v2 → not_configured (Gemini mit v1 nie aktivierbar)');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-d@example.test', 30, 'ai_food_photo', 301),
  '{"result": "invalid_input"}'::jsonb, 'Monatslimit 301 → invalid_input');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-d@example.test', 30, 'ai_food_photo', 2, 1) ->> 'result',
  'granted', 'Freischaltung D mit Monatslimit 2 und Tageslimit 1');
reset role;
delete from public.ai_usage where user_id = '44444444-4444-4444-8444-444444444444';
set local role service_role;
select is(public.ai_food_photo_reserve('44444444-4444-4444-8444-444444444444') - 'id',
  '{"result": "reserved", "remaining_month": 1, "remaining_today": 0}'::jsonb, 'eigenes Limit: erstes Foto');
select is(public.ai_food_photo_reserve('44444444-4444-4444-8444-444444444444') ->> 'scope', 'day',
  'eigenes Tageslimit 1 greift');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(public.ai_food_photo_access(),
  '{"active": true, "reason": "ok", "monthly_limit": 2, "daily_limit": 1}'::jsonb, 'access: eigene Limits für die Anzeige');
reset role;
-- Wiederherstellen für die folgenden Prüfungen (Flag aus, D: Freischaltung abgelaufen).
set local role service_role;
select public.beta_admin('flag_off', 'gruender-1') is not null as flag_off \gset
reset role;
delete from public.ai_usage where user_id = '44444444-4444-4444-8444-444444444444';
update private.beta_entitlements set granted_at = now() - interval '31 days', expires_at = now() - interval '1 day'
where user_id = '44444444-4444-4444-8444-444444444444';

-- ---------------------------------------------------------------------------------------------------------
-- Export (Art. 15): alle bisherigen Bereiche bleiben, dazu ai_usage und die eigene Beta-Freischaltung
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
create temp table export_keys as
select jsonb_object_keys(public.export_my_data() -> 'data') as k;
reset role;
select ok(
  (select array_agg(k) from export_keys) @> array[
    'profiles', 'consents', 'body_metrics', 'body_measurements', 'measurement_reminders', 'health_screening',
    'goals', 'user_equipment', 'training_slots', 'nutrition_prefs', 'food_preferences', 'admin_users', 'user_plans',
    'planned_sessions', 'planned_exercises', 'session_logs', 'exercise_logs', 'set_logs', 'cardio_logs',
    'exercise_start_weights', 'meal_plans', 'meal_plan_items', 'shopping_lists', 'shopping_list_items',
    'recipe_ratings', 'food_dislikes', 'food_log_entries', 'food_log_favorites', 'custom_meals', 'custom_meal_items',
    'competitions', 'ai_usage', 'beta_entitlements', 'admin_actions'],
  'Export: alle bisherigen Bereiche (inkl. competitions aus WP3) plus ai_usage, beta_entitlements, admin_actions');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'ai_usage'), 2, 'Export: eigene ai_usage-Zeilen');
select ok(
  (select e ? 'expires_at' and not e ? 'granted_by' and not e ? 'user_id'
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'beta_entitlements') e),
  'Export: eigene Freischaltung ohne granted_by');
select ok(
  (select count(*) > 0 and bool_and(e ? 'action' and not e ? 'actor' and not e ? 'target_user_id')
   from jsonb_array_elements(public.export_my_data() -> 'data' -> 'admin_actions') e),
  'Export (N4): eigenes Freischalt-Protokoll ohne Admin-Identität');
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'ai_usage'), 0, 'Export: keine fremden Zeilen');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Konto löschen (Kaskade); Protokoll bleibt ohne Personenbezug
-- ---------------------------------------------------------------------------------------------------------
insert into public.ai_usage (user_id, feature, status, finished_at)
values ('22222222-2222-4222-8222-222222222222', 'food_photo', 'succeeded', now());
delete from auth.users where id = '22222222-2222-4222-8222-222222222222';
select is((select count(*) from public.ai_usage where user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint,
  'Konto löschen: ai_usage weg');
select is((select count(*) from private.beta_entitlements where user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint, 'Konto löschen: Freischaltung weg');
select ok(
  (select count(*) > 0 and bool_and(target_user_id is null) from private.admin_actions a
   where a.action = 'beta_grant' and a.expires_at <= now() + interval '31 days' and a.target_user_id is distinct from
     '11111111-1111-4111-8111-111111111111' and a.target_user_id is distinct from '33333333-3333-4333-8333-333333333333'
     and a.target_user_id is distinct from '44444444-4444-4444-8444-444444444444'),
  'Konto löschen: Protokoll bleibt, Verweis leer');

select * from finish();
rollback;
