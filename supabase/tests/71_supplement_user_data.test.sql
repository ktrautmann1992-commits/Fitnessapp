-- Supplement-Check und „Meine Supplements“ (docs/PLAN-PHASE-6.md 7.2–7.4, 11.1, Etappe SU3; Migration
-- 20261021130200): Einwilligung health_data Fassung 2 (Entwurf → veröffentlicht), Schreiben nur mit Fassung 2
-- (mit nur v1 scheitert es), bestehende v1-Daten bleiben lesbar und nach erneuter Zustimmung wieder schreibbar,
-- Flags berechnet die Datenbank (= evaluateSupplementScreening), Stillzeit-Frage nicht bei „männlich“, RLS (fremde
-- Zeilen unsichtbar), kein direktes Schreiben, Koffein nie „Nehme ich“, Löschen ohne Einwilligung, Export, Widerruf.
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test');
insert into public.profiles (user_id, birth_date, sex) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01', 'female'),
  ('22222222-2222-4222-8222-222222222222', '1985-06-01', 'male'),
  ('33333333-3333-4333-8333-333333333333', '1995-03-01', 'female');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
                  '33333333-3333-4333-8333-333333333333']::uuid[]) u
cross join unnest(array['terms', 'privacy']::public.consent_type[]) t;
-- A und B haben die Einwilligung Gesundheitsdaten Fassung 1, C keine.
insert into public.consents (user_id, consent_type, version, platform) values
  ('11111111-1111-4111-8111-111111111111', 'health_data', 1, 'web'),
  ('22222222-2222-4222-8222-222222222222', 'health_data', 1, 'web');

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
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Aufbau
-- ---------------------------------------------------------------------------------------------------------
select is((select published_at from public.consent_documents where consent_type = 'health_data' and version = 2),
  null, 'Fassung 2 liegt als unveröffentlichter Entwurf vor');
select is(public.current_consent_version('health_data'), 1, 'gültig bleibt Fassung 1 (niemand verliert etwas)');
select ok((select body_de like '%Supplement-Check%' and body_de like '%Meine Supplements%'
              and body_de like '%Shops und Partnernetzwerke erhalten keine dieser Angaben.%'
           from public.consent_documents where consent_type = 'health_data' and version = 2),
  'Text Fassung 2 nennt Supplement-Check, „Meine Supplements“ und „keine Weitergabe an Shops“');
select ok((select relrowsecurity from pg_class where oid = 'public.supplement_screening'::regclass),
  'RLS auf supplement_screening aktiv');
select ok((select relrowsecurity from pg_class where oid = 'public.user_supplements'::regclass),
  'RLS auf user_supplements aktiv');
select is(enum_range(null::public.supplement_flag)::text[],
  array['kidney', 'breastfeeding', 'heart_rhythm', 'caffeine_sensitive'], 'Aufzählung supplement_flag = SUPPLEMENT_FLAGS');

set local role anon;
select throws_ok($$ select public.save_supplement_screening('{}') $$, '42501', null, 'anon: kein Supplement-Check');
select throws_ok($$ select public.set_user_supplement('creatine', 'taking') $$, '42501', null,
  'anon: keine Auswahl');
select throws_ok($$ select count(*) from public.supplement_screening $$, '42501', null, 'anon liest nichts');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Nur Fassung 1 gültig: Schreiben scheitert (Info-Modus), Gesundheitsdaten v1 schreibbar wie bisher
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false}') $$),
  '42501: Einwilligung Gesundheitsdaten (Fassung 2) fehlt.', 'nur Fassung 1 → Supplement-Check abgelehnt');
select is(pg_temp.error_of($$ select public.set_user_supplement('creatine', 'taking') $$),
  '42501: Einwilligung Gesundheitsdaten (Fassung 2) fehlt.', 'nur Fassung 1 → „Nehme ich“ abgelehnt');
select lives_ok($$ insert into public.body_metrics (height_cm, weight_kg, measured_on) values (170, 65, '2026-10-01') $$,
  'Fassung 1 gültig: Körperdaten wie bisher speicherbar');
select throws_ok($$ insert into public.supplement_screening (user_id, answers, version)
    values ('11111111-1111-4111-8111-111111111111', '{}', 1) $$, '42501', null, 'kein direktes Schreiben');
reset role;

-- Veröffentlichen (nach der juristischen Prüfung per Migration).
update public.consent_documents set published_at = now() where consent_type = 'health_data' and version = 2;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.current_consent_version('health_data'), 2, 'nach Veröffentlichung gilt Fassung 2');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false}') $$),
  '42501: Einwilligung Gesundheitsdaten (Fassung 2) fehlt.', 'nur v1 erteilt → weiterhin abgelehnt (B1)');
select is((select count(*)::integer from public.body_metrics), 1, 'v1-Daten bleiben lesbar und erhalten');
select throws_ok($$ insert into public.body_metrics (height_cm, weight_kg, measured_on) values (170, 66, '2026-10-02') $$,
  '42501', null, 'mit veralteter Fassung keine neuen Gesundheitsdaten (bestehende Versionsregel)');
-- Erneut zustimmen (Re-Consent).
insert into public.consents (consent_type, version, platform) values ('health_data', 2, 'web');
select lives_ok($$ insert into public.body_metrics (height_cm, weight_kg, measured_on) values (170, 66, '2026-10-02') $$,
  'nach erneuter Zustimmung wieder alles schreibbar');
select is((select count(*)::integer from public.body_metrics), 2, 'kein Datenverlust durch die neue Fassung');

-- ---------------------------------------------------------------------------------------------------------
-- Supplement-Check (A, weiblich, Fassung 2)
-- ---------------------------------------------------------------------------------------------------------
select is(public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false}'),
  '{"flags": []}'::jsonb, 'alles „nein“ → keine Flags');
select is(public.save_supplement_screening(
    '{"caffeine_sensitive": true, "kidney": true, "breastfeeding": true, "heart_rhythm": true, "protein_self_check": "rather_not"}'),
  '{"flags": ["kidney", "breastfeeding", "heart_rhythm", "caffeine_sensitive"]}'::jsonb,
  'Flags in fester Reihenfolge (SUPPLEMENT_FLAGS), ersetzt den alten Check');
select is((select count(*)::integer from public.supplement_screening), 1, 'eine Zeile je Person');
select is((select answers ->> 'protein_self_check' from public.supplement_screening), 'rather_not',
  'Eiweiß-Selbsteinschätzung gespeichert (setzt kein Flag)');
select is((select version::integer from public.supplement_screening), 1, 'Fassung der Fragen = 1');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "heart_rhythm": false, "caffeine_sensitive": false}') $$),
  '23514: Der Supplement-Check ist unvollständig.', 'weiblich: Stillzeit-Frage ist Pflicht');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false}') $$),
  '23514: Der Supplement-Check ist unvollständig.', 'fehlende Frage → abgelehnt');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false, "niere": true}') $$),
  '23514: Ungültige Antworten im Supplement-Check.', 'unbekannte Frage → abgelehnt');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": "nein", "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false}') $$),
  '23514: Ungültige Antworten im Supplement-Check.', 'nur ja/nein (Wahrheitswert)');
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": false, "protein_self_check": "vielleicht"}') $$),
  '23514: Ungültige Antworten im Supplement-Check.', 'Eiweiß-Selbsteinschätzung nur mostly_yes/rather_not');
select throws_ok($$ update public.supplement_screening set flags = '{}' $$, '42501', null,
  'Flags nicht direkt änderbar');

-- „Meine Supplements“
select lives_ok($$ select public.set_user_supplement('creatine', 'taking') $$, '„Nehme ich“ gespeichert');
select lives_ok($$ select public.set_user_supplement('creatine', 'not_for_me') $$, 'Auswahl geändert');
select lives_ok($$ select public.set_user_supplement('omega3', 'taking') $$, 'zweites Supplement');
select results_eq($$ select supplement_id::text, status::text from public.user_supplements order by supplement_id $$,
  $$ values ('creatine', 'not_for_me'), ('omega3', 'taking') $$, 'eine Zeile je Supplement, letzte Wahl gilt');
select is(pg_temp.error_of($$ select public.set_user_supplement('caffeine', 'taking') $$),
  '22023: Unbekanntes Supplement.', 'Koffein nie „Nehme ich“ (B2.3)');
select is(pg_temp.error_of($$ select public.set_user_supplement('bcaa', 'taking') $$),
  '22023: Unbekanntes Supplement.', 'Liste „Nicht empfohlen“ nie „Nehme ich“');
select is(pg_temp.error_of($$ select public.set_user_supplement('creatine', 'daily') $$),
  '22023: Ungültige Auswahl.', 'nur taking/not_for_me');
select lives_ok($$ select public.set_user_supplement('omega3', null) $$, 'NULL entfernt die Auswahl');
select is((select count(*)::integer from public.user_supplements), 1, 'Auswahl entfernt');

-- Export
select ok((select (d -> 'data' ? 'supplement_screening') and jsonb_array_length(d -> 'data' -> 'supplement_screening') = 1
             and jsonb_array_length(d -> 'data' -> 'user_supplements') = 1
           from (select public.export_my_data() as d) x),
  'Export enthält Supplement-Check und „Meine Supplements“');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- B (männlich): Stillzeit-Frage nicht gestellt; RLS
-- ---------------------------------------------------------------------------------------------------------
insert into public.consents (user_id, consent_type, version, platform)
values ('22222222-2222-4222-8222-222222222222', 'health_data', 2, 'web');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(pg_temp.error_of($$ select public.save_supplement_screening(
    '{"kidney": false, "breastfeeding": false, "heart_rhythm": false, "caffeine_sensitive": true}') $$),
  '23514: Ungültige Antworten im Supplement-Check.', 'männlich: Stillzeit-Frage darf nicht beantwortet sein');
select is(public.save_supplement_screening('{"kidney": false, "heart_rhythm": false, "caffeine_sensitive": true}'),
  '{"flags": ["caffeine_sensitive"]}'::jsonb, 'männlich ohne Stillzeit-Frage gespeichert');
select results_eq($$ select user_id::text from public.supplement_screening $$,
  $$ values ('22222222-2222-4222-8222-222222222222') $$, 'RLS: nur der eigene Check sichtbar');
select is_empty($$ select 1 from public.user_supplements $$, 'RLS: fremde Auswahl unsichtbar');
reset role;

-- C ohne Einwilligung: Löschen geht immer.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.delete_my_supplement_data() $$, 'Löschen geht ohne Einwilligung');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data (A) löscht Check und Auswahl; B bleibt unberührt
-- ---------------------------------------------------------------------------------------------------------
update public.consents set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111' and consent_type = 'health_data' and revoked_at is null;
select is((select count(*)::integer from public.supplement_screening
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Widerruf löscht den Supplement-Check');
select is((select count(*)::integer from public.user_supplements
           where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'Widerruf löscht „Meine Supplements“');
select is((select count(*)::integer from public.supplement_screening
           where user_id = '22222222-2222-4222-8222-222222222222'), 1, 'andere Person unberührt');

select * from finish();
rollback;
