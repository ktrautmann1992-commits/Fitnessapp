-- Etappe B2 (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitte 4.1–4.3): training_slots + replace_training_slots,
-- Übernahme des alten Zeitbudgets, entfernte goals-Spalten, Langhantel (Altwerte > 25 kg, bar_kg).
begin;
create extension if not exists pgtap with schema extensions;
select plan(50);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, 1, 'web'
from unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select has_table('public', 'training_slots', 'Tabelle training_slots existiert');
select hasnt_column('public', 'goals', 'sessions_per_week', 'goals.sessions_per_week entfernt');
select hasnt_column('public', 'goals', 'minutes_per_session', 'goals.minutes_per_session entfernt');
select hasnt_column('public', 'goals', 'preferred_days', 'goals.preferred_days entfernt');
select has_column('public', 'goals', 'training_location', 'goals.training_location bleibt (abgeleitet)');
select has_column('public', 'user_equipment', 'bar_kg', 'user_equipment.bar_kg existiert');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.training_slots'::regclass),
  'RLS auf training_slots aktiv'
);
select ok(
  not has_table_privilege('authenticated', 'public.training_slots', 'insert')
  and not has_table_privilege('authenticated', 'public.training_slots', 'update')
  and not has_table_privilege('authenticated', 'public.training_slots', 'delete')
  and has_table_privilege('authenticated', 'public.training_slots', 'select'),
  'authenticated darf training_slots nur lesen'
);
select ok(
  not has_function_privilege('anon', 'public.replace_training_slots(jsonb)', 'execute'),
  'anon darf replace_training_slots nicht ausführen'
);

-- ---------------------------------------------------------------------------------------------------------
-- Übernahme aus goals (dieselbe Funktion wie in der Migration) und Langhantel-Altwerte
-- ---------------------------------------------------------------------------------------------------------
select results_eq(
  $$ select slot_no, weekday, kind::text, minutes
     from private.legacy_time_budget_slots(2::smallint, 45::smallint, '{4,1}'::smallint[], 'home') $$,
  $$ values (1::smallint, 1::smallint, 'strength_home', 45::smallint), (2::smallint, 4::smallint, 'strength_home', 45::smallint) $$,
  'Übernahme: Anzahl Wunsch-Tage = Tage pro Woche → feste Tage, zu Hause → Kraft zu Hause'
);
select results_eq(
  $$ select slot_no, weekday, kind::text, minutes
     from private.legacy_time_budget_slots(3::smallint, 60::smallint, '{1}'::smallint[], 'both') $$,
  $$ values (1::smallint, null::smallint, 'strength_gym', 60::smallint), (2::smallint, null::smallint, 'strength_gym', 60::smallint),
            (3::smallint, null::smallint, 'strength_gym', 60::smallint) $$,
  'Übernahme: sonst „Tag egal“ (Wunsch-Tage entfallen), beides → Kraft im Studio'
);
select is(
  (select count(*)::int from private.legacy_time_budget_slots(7::smallint, 240::smallint, '{1,2,3,4,5,6,7}', null)
   where weekday is not null and kind = 'strength_gym'),
  7, 'Übernahme: 7 Tage fest, ohne Ort → Kraft im Studio'
);
select is_empty(
  $$ select 1 from private.legacy_time_budget_slots(null, 60::smallint, '{}', 'gym') $$,
  'Übernahme: ohne Tage pro Woche nichts'
);
select is_empty(
  $$ select 1 from private.legacy_time_budget_slots(3::smallint, null, '{}', 'gym') $$,
  'Übernahme: ohne Minuten nichts'
);
select is(
  private.barbell_plates_only('{40,1.25,25,27.5,2.5}'::numeric[]),
  '{1.25,2.5,25}'::numeric[],
  'Langhantel-Altwerte über 25 kg werden entfernt, 25 bleibt'
);
select ok(
  not has_function_privilege('authenticated', 'private.legacy_time_budget_slots(smallint, smallint, smallint[], public.training_location)', 'execute')
  and not has_function_privilege('authenticated', 'private.barbell_plates_only(numeric[])', 'execute'),
  'Übernahme-Funktionen sind für Nutzer nicht ausführbar'
);

-- ---------------------------------------------------------------------------------------------------------
-- replace_training_slots: Login, Profil, Regeln
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":30}]') $$,
  '42501', null, 'anon: abgelehnt'
);
select throws_ok($$ select 1 from public.training_slots $$, '42501', null, 'anon: kein Lesezugriff');

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":30}]') $$,
  '42501', 'Nicht angemeldet.', 'ohne Nutzer-ID: abgelehnt'
);

set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":30}]') $$,
  '42501', 'Profil fehlt.', 'ohne Profil: abgelehnt'
);

-- Nutzer B speichert eigene Tage (dürfen von A nie berührt werden).
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":2,"kind":"strength_gym","minutes":60}]') $$,
  'B: eigene Trainingstage speichern'
);

set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_training_slots('[
       {"slot_no":1,"weekday":1,"kind":"endurance","minutes":30},
       {"slot_no":2,"weekday":3,"kind":"strength_gym","minutes":60},
       {"slot_no":3,"weekday":6,"kind":"strength_home","minutes":90}]') $$,
  'A: feste Tage gemischt (Mo Laufen 30, Mi Studio 60, Sa Zuhause 90)'
);
select results_eq(
  $$ select slot_no, weekday, kind::text, minutes from public.training_slots order by slot_no $$,
  $$ values (1::smallint, 1::smallint, 'endurance', 30::smallint), (2::smallint, 3::smallint, 'strength_gym', 60::smallint),
            (3::smallint, 6::smallint, 'strength_home', 90::smallint) $$,
  'A sieht nur die eigenen drei Tage'
);
select lives_ok(
  $$ select public.replace_training_slots('[
       {"slot_no":1,"weekday":null,"kind":"strength_gym","minutes":45},
       {"slot_no":2,"weekday":null,"kind":"endurance","minutes":30}]') $$,
  'A: „Tage egal“ ersetzt die festen Tage'
);
select is((select count(*)::int from public.training_slots where weekday is null), 2, 'jetzt 2 Einträge ohne Tag');
select lives_ok(
  $$ select public.replace_training_slots((
       select jsonb_agg(jsonb_build_object('slot_no', d, 'weekday', d, 'kind', 'endurance', 'minutes', 240))
       from generate_series(1, 7) as d)) $$,
  '7 Tage mit 240 Minuten (Obergrenzen)'
);
select lives_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":7,"kind":"strength_home","minutes":10}]') $$,
  '1 Tag mit 10 Minuten (Untergrenzen)'
);

-- Abgelehnt – und der vorherige Stand bleibt (atomar).
select throws_ok($$ select public.replace_training_slots('[]') $$, '22023', 'Ungültige Trainingstage.', '0 Einträge');
select throws_ok(
  $$ select public.replace_training_slots((
       select jsonb_agg(jsonb_build_object('slot_no', d, 'weekday', null, 'kind', 'endurance', 'minutes', 30))
       from generate_series(1, 8) as d)) $$,
  '22023', null, '8 Einträge'
);
select throws_ok(
  $$ select public.replace_training_slots('{"slot_no":1}') $$, '22023', null, 'kein Array'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":9}]') $$,
  '22023', null, '9 Minuten'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":241}]') $$,
  '22023', null, '241 Minuten'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":45.5}]') $$,
  '22023', null, '45,5 Minuten'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":8,"kind":"endurance","minutes":30}]') $$,
  '22023', null, 'Wochentag 8'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"yoga","minutes":30}]') $$,
  '22023', null, 'unbekannte Art'
);
select throws_ok(
  $$ select public.replace_training_slots('[
       {"slot_no":1,"weekday":1,"kind":"endurance","minutes":30},
       {"slot_no":2,"weekday":null,"kind":"endurance","minutes":30}]') $$,
  '22023', null, 'gemischter Modus'
);
select throws_ok(
  $$ select public.replace_training_slots('[
       {"slot_no":1,"weekday":2,"kind":"endurance","minutes":30},
       {"slot_no":2,"weekday":2,"kind":"strength_gym","minutes":30}]') $$,
  '22023', null, 'Wochentag doppelt'
);
select throws_ok(
  $$ select public.replace_training_slots('[
       {"slot_no":1,"weekday":null,"kind":"endurance","minutes":30},
       {"slot_no":3,"weekday":null,"kind":"endurance","minutes":30}]') $$,
  '22023', null, 'Lücke in slot_no'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"weekday":1,"kind":"endurance","minutes":30,"user_id":"22222222-2222-4222-8222-222222222222"}]') $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Trainingstag).', 'unbekanntes Feld (user_id) abgelehnt'
);
select throws_ok(
  $$ select public.replace_training_slots('[{"slot_no":1,"kind":"endurance","minutes":30}]') $$,
  '22023', null, 'fehlendes Feld weekday'
);
select results_eq(
  $$ select slot_no, weekday, minutes from public.training_slots $$,
  $$ values (1::smallint, 7::smallint, 10::smallint) $$,
  'nach den Fehlern unverändert der letzte gültige Stand'
);

-- Gleichzeitige Aufrufe: die Funktion sperrt zuerst die eigene Profil-Zeile (laufen nacheinander).
select ok(
  pg_get_functiondef('public.replace_training_slots(jsonb)'::regprocedure)
    ~ 'from public\.profiles p where p\.user_id = current_user_id for update',
  'replace_training_slots sperrt die Profil-Zeile vor dem Ersetzen'
);

-- Kein direkter Schreibzugriff.
select throws_ok(
  $$ insert into public.training_slots (slot_no, weekday, kind, minutes) values (2, 2, 'endurance', 30) $$,
  '42501', null, 'kein direktes Insert'
);
select throws_ok(
  $$ update public.training_slots set minutes = 20 $$, '42501', null, 'kein direktes Update'
);
select throws_ok($$ delete from public.training_slots $$, '42501', null, 'kein direktes Delete');

-- Widerruf von health_data löscht die Trainingstage NICHT (kein Gesundheitsdatum).
select lives_ok(
  $$ update public.consents set revoked_at = now() where consent_type = 'health_data' $$,
  'A widerruft health_data'
);
select is((select count(*)::int from public.training_slots), 1, 'Trainingstage bleiben nach dem Widerruf');

-- Langhantel über replace_user_equipment mit Stange.
select lives_ok(
  $$ select public.replace_user_equipment('home', '[{"equipment_id":"barbell","weights_kg":[1.25,2.5,5,10],"bar_kg":15}]') $$,
  'Langhantel mit Stange 15 kg und Scheiben speichern'
);
select is(
  (select bar_kg from public.user_equipment where equipment_id = 'barbell'), 15.00::numeric(4, 2),
  'Stange übernommen'
);

reset role;
select is(
  (select count(*)::int from public.training_slots where user_id = '22222222-2222-4222-8222-222222222222'),
  1, 'B: eigene Trainingstage unverändert'
);

select * from finish();
rollback;
