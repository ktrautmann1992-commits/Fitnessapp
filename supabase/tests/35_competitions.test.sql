-- Phase 10 · Etappe WP3 (docs/PLAN-PHASE-10.md Abschnitt 7): Tabelle competitions und ihre Funktionen.
-- - Zugriff: anon nichts, authenticated nur eigene Zeilen lesen, schreiben nur über die Funktionen,
-- - save_competition: Felder strikt, Grenzen (Name, Renntag, Mindestvorlauf, Ziel-/Referenzzeit), ein geplanter
--   Wettkampf je Person, Ändern nur eigener geplanter Wettkämpfe, Datumsregeln nur bei geänderten Feldern,
-- - Plan-Bezug nur mit Einwilligung + Gesundheits-Check, nicht in der Schwangerschaft, unter 18 kein Marathon, keine
--   wirksame Zielzeit mit Arzt-Hinweis, unter 18 oder ab 65; uses_health_data bestimmt der Server,
-- - Export, Widerruf (Plan-Bezug geleert, Wettkampf bleibt), absagen, abschließen mit Ergebnis-Eintrag, löschen,
--   Konto löschen (Kaskade).
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(82);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A: 36 Jahre, Check ohne Flag, Ziel Ausdauer. B: ohne Check. C: ohne Profil. D: Schwangerschaft. E: 17 Jahre.
-- F: Flag (Medikamente). G: 70 Jahre. Alle mit Einwilligung health_data.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-e@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'nutzer-f@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'nutzer-g@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u.id, t, 1, 'web'
from auth.users u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01'),
  ('55555555-5555-4555-8555-555555555555', '2009-06-01'),
  ('66666666-6666-4666-8666-666666666666', '1990-01-01'),
  ('77777777-7777-4777-8777-777777777777', '1956-01-01');
insert into public.health_screening (user_id, medical_notice_acknowledged_at, answers)
select u, now(), jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
  'dizziness', false, 'blood_pressure', false, 'bone_joint', false,
  'medication', u = '66666666-6666-4666-8666-666666666666', 'other_reason', false,
  'pregnancy', u = '44444444-4444-4444-8444-444444444444')
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666',
  '77777777-7777-4777-8777-777777777777']::uuid[]) as u;
insert into public.goals (user_id, goal_type, discipline) values
  ('11111111-1111-4111-8111-111111111111', 'endurance', '10k'),
  ('22222222-2222-4222-8222-222222222222', 'muscle_gain', null);

-- Eingabe wie toSaveCompetitionPayload() (packages/core): 10 km am Sonntag, 10.01.2027, „Ankommen“, ohne Plan-Bezug.
create function pg_temp.comp(p_changes jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'id', null, 'name', 'Stadtlauf Köln', 'discipline', '10k', 'race_date', '2027-01-10', 'goal_kind', 'finish',
    'target_time_s', null, 'reference_discipline', null, 'reference_time_s', null, 'reference_date', null,
    'long_run_weekday', null, 'own_start_weekly_minutes', null, 'start_reference_volume', null,
    'start_reference_session_cap', null, 'start_reference_start_group', null, 'effective_goal', null
  ) || p_changes
$$;
-- Plan-Bezug (Ampel „Ankommen“, Tagebuch-Bezug 120/40 aus einem Fortgeschrittenen-Plan, eigener Start 200).
create function pg_temp.basis(p_changes jsonb default '{}') returns jsonb language sql as $$
  select '{"effective_goal": "finish", "start_reference_volume": 120, "start_reference_session_cap": 40,
           "start_reference_start_group": "advanced", "own_start_weekly_minutes": 200, "long_run_weekday": 7}'::jsonb
    || p_changes
$$;
-- Zielzeit 10 km 50:00 mit Referenz 5 km 24:00 vom 01.09.2026.
create function pg_temp.time_goal() returns jsonb language sql as $$
  select '{"goal_kind": "time", "target_time_s": 3000, "reference_discipline": "5k", "reference_time_s": 1440,
           "reference_date": "2026-09-01"}'::jsonb
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
  select pg_temp.error_of(format('select public.save_competition(%L::jsonb)', p_payload))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;
create function pg_temp.a_id() returns uuid language sql security definer as $$
  select id from public.competitions where user_id = '11111111-1111-4111-8111-111111111111' and status = 'planned'
$$;
grant execute on function pg_temp.a_id() to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Zugriff
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.save_competition(pg_temp.comp()) $$, '42501', null, 'anon darf nicht speichern');
select throws_ok($$ select * from public.competitions $$, '42501', null, 'anon liest keine Wettkämpfe');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select is(pg_temp.save(pg_temp.comp()), '42501: Nicht angemeldet.', 'ohne Login abgelehnt');
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is(pg_temp.save(pg_temp.comp()), '42501: Profil fehlt.', 'ohne Profil abgelehnt');
reset role;
select ok(
  (select relrowsecurity from pg_class where oid = 'public.competitions'::regclass)
  and has_table_privilege('authenticated', 'public.competitions', 'select')
  and not has_table_privilege('authenticated', 'public.competitions', 'insert')
  and not has_table_privilege('authenticated', 'public.competitions', 'update')
  and not has_table_privilege('authenticated', 'public.competitions', 'delete')
  and not has_table_privilege('anon', 'public.competitions', 'select'),
  'RLS an; authenticated nur lesen, anon nichts');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""']
     and not has_function_privilege('anon', p.oid, 'execute')
     and has_function_privilege('authenticated', p.oid, 'execute'))
   from pg_proc p
   where p.oid in ('public.save_competition(jsonb)'::regprocedure, 'public.cancel_competition(uuid)'::regprocedure,
     'public.complete_competition(uuid, uuid)'::regprocedure, 'public.delete_competition(uuid)'::regprocedure)),
  'Funktionen: security definer, search_path leer, nur authenticated');
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select throws_ok($$ insert into public.competitions (name, discipline, distance_m, race_date)
                    values ('Direkt', '10k', 10000, '2027-01-10') $$,
  '42501', null, 'authenticated schreibt nicht direkt');

-- ---------------------------------------------------------------------------------------------------------
-- Speichern: Felder und Grenzen
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'A legt einen Wettkampf an (ohne Plan-Bezug)');
select results_eq(
  $$ select name, distance_m, status::text, uses_health_data, user_id::text from public.competitions $$,
  $$ values ('Stadtlauf Köln', 10000.0::numeric, 'planned', false, '11111111-1111-4111-8111-111111111111') $$,
  'Distanz aus der Disziplin, geplant, ohne Gesundheitsbezug');
select is((select target_date from public.goals), '2027-01-10'::date, 'Zieldatum des Ausdauer-Ziels mitgeführt');
select is(pg_temp.save(pg_temp.comp()), '23505: Es gibt schon einen geplanten Wettkampf.',
  'höchstens ein geplanter Wettkampf (W-G9)');
select is(pg_temp.save(pg_temp.comp('{"foo": 1}')), '22023: Unbekanntes Feld in der Eingabe (Wettkampf).',
  'unbekanntes Feld abgelehnt');
select is(pg_temp.save(pg_temp.comp() - 'long_run_weekday'), '22023: Ungültige Angaben zum Wettkampf.',
  'fehlendes Feld abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'name', ' Köln'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Name mit Leerzeichen am Rand abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'name', repeat('x', 81)))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Name über 80 Zeichen abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'name', repeat('ö', 80)))),
  'kein Fehler', 'Name mit 80 Zeichen erlaubt (Ändern behält die id)');
select is((select count(*)::int from public.competitions), 1, 'Ändern legt keinen zweiten an');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2026-10-07'))),
  '22023: Der Renntag liegt außerhalb des erlaubten Zeitraums.', 'Renntag heute abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2027-10-07'))),
  '22023: Der Renntag liegt außerhalb des erlaubten Zeitraums.', 'Renntag in 365 Tagen abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2027-10-06'))),
  'kein Fehler', 'Renntag in 52 Wochen erlaubt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2026-11-17'))),
  '22023: Bis zum Renntag ist zu wenig Zeit.', '10 km: 41 Tage abgelehnt (lockerste Spalte 6 Wochen)');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2026-11-18'))),
  'kein Fehler', '10 km: genau 6 Wochen erlaubt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'discipline', 'half_marathon', 'race_date', '2026-11-18'))),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Distanz geändert: Mindestvorlauf neu geprüft (Halbmarathon 10 Wochen)');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2027-1-10'))),
  '22023: Ungültige Angaben zum Wettkampf.', 'Datum nur als JJJJ-MM-TT');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'discipline', 'cycling'))),
  '22023: Ungültige Angaben zum Wettkampf.', 'Disziplin ohne Wettkampfplan abgelehnt (W-G2)');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'long_run_weekday', 8))),
  '22023: Ungültige Angaben zum Wettkampf.', 'Wunsch-Tag nur 1–7');
-- Ziel- und Referenzzeit
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal())),
  'kein Fehler', 'Zielzeit mit Referenzzeit gespeichert');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'goal_kind', 'time', 'target_time_s', 3000))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Zielzeit ohne Referenzzeit abgelehnt (W-G6)');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'target_time_s', 3000))),
  '23514: Ungültige Angaben zum Wettkampf.', '„Ankommen“ mit Zielzeit abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"target_time_s": 1500}')),
  '23514: Ungültige Angaben zum Wettkampf.', 'unplausible Zielzeit (10 km in 25 min) abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"reference_time_s": 700}')),
  '23514: Ungültige Angaben zum Wettkampf.', 'unplausible Referenzzeit abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"reference_date": null}')),
  '23514: Ungültige Angaben zum Wettkampf.', 'Referenz unvollständig abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"reference_date": "2026-10-08"}')),
  '22023: Die Referenzzeit ist zu alt oder liegt in der Zukunft.', 'Referenzzeit in der Zukunft abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"reference_date": "2026-04-06"}')),
  '22023: Die Referenzzeit ist zu alt oder liegt in der Zukunft.', 'Referenzzeit 184 Tage alt abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.time_goal() || '{"reference_date": "2026-04-07"}')),
  'kein Fehler', 'Referenzzeit 183 Tage alt erlaubt');
-- Fremde Zeilen
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'name', 'Übernommen'))),
  '42501: Wettkampf nicht gefunden.', 'B ändert den Wettkampf von A nicht');
select is_empty($$ select 1 from public.competitions $$, 'B sieht den Wettkampf von A nicht');
-- Zeit vergeht: Datumsregeln nur, wenn sich Renntag/Disziplin/Referenz ändern.
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
reset role;
create or replace function private.berlin_today() returns date language sql stable set search_path = '' as $$
  select date '2026-12-15'
$$;
set local role authenticated;
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'name', 'Neuer Name'))
    || pg_temp.time_goal() || '{"reference_date": "2026-04-07"}'),
  'kein Fehler', 'nur der Name geändert: alte Referenz und kurzer Vorlauf bleiben gültig');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id(), 'race_date', '2027-01-11'))),
  '22023: Bis zum Renntag ist zu wenig Zeit.', 'Renntag geändert: Mindestvorlauf neu geprüft');
reset role;
create or replace function private.berlin_today() returns date language sql stable set search_path = '' as $$
  select date '2026-10-07'
$$;
set local role authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Plan-Bezug (nur mit Einwilligung und Gesundheits-Check, Tabelle 3.3)
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis())), 'kein Fehler',
  'A speichert den Plan-Bezug');
select results_eq(
  $$ select uses_health_data, effective_goal::text, start_reference_volume::int, start_reference_session_cap::int,
       start_reference_start_group::text, own_start_weekly_minutes::int, long_run_weekday::int from public.competitions $$,
  $$ values (true, 'finish', 120, 40, 'advanced', 200, 7) $$,
  'Plan-Bezug gespeichert, uses_health_data vom Server gesetzt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"effective_goal": "time"}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'wirksame Zielzeit nur beim Ziel „Zielzeit“');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"effective_goal": null}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Bezug ohne wirksames Ziel abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"start_reference_session_cap": 130}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'längste Einheit länger als die Woche abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"start_reference_volume": 5, "start_reference_session_cap": null}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Bezug unter 10 Minuten abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"start_reference_volume": null, "start_reference_session_cap": null}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'Startgruppe ohne Bezug abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis('{"own_start_weekly_minutes": 1681}'))),
  '23514: Ungültige Angaben zum Wettkampf.', 'eigener Startumfang über 1.680 min abgelehnt');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.save(pg_temp.comp(pg_temp.basis())), '42501: Ein Wettkampfplan braucht den Gesundheits-Check.',
  'B ohne Gesundheits-Check: kein Plan-Bezug');
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'B ohne Check: Wettkampf (Countdown) speicherbar');
select is((select target_date from public.goals), null, 'Ziel Muskelaufbau: kein Zieldatum mitgeführt');
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(pg_temp.save(pg_temp.comp(pg_temp.basis())), '22023: In der Schwangerschaft gibt es keinen Wettkampfplan.',
  'Schwangerschaft: kein Plan-Bezug');
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'Schwangerschaft: Wettkampf ohne Plan speicherbar');
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select is(pg_temp.save(pg_temp.comp(pg_temp.basis() || '{"discipline": "marathon", "race_date": "2027-06-06"}')),
  '22023: Für diese Distanz gibt es noch keinen Wettkampfplan.', 'unter 18: kein Marathon-Plan (W-G4)');
select is(pg_temp.save(pg_temp.comp(pg_temp.time_goal() || pg_temp.basis('{"effective_goal": "time"}'))),
  '22023: Eine Zielzeit ist hier nicht möglich.', 'unter 18: keine wirksame Zielzeit');
select is(pg_temp.save(pg_temp.comp(pg_temp.time_goal() || pg_temp.basis())), 'kein Fehler',
  'unter 18: Zielzeit gewünscht, wirksam „Ankommen“');
select pg_temp.as_user('66666666-6666-4666-8666-666666666666');
select is(pg_temp.save(pg_temp.comp(pg_temp.time_goal() || pg_temp.basis('{"effective_goal": "time"}'))),
  '22023: Eine Zielzeit ist hier nicht möglich.', 'Arzt-Hinweis: nur „Ankommen“');
select pg_temp.as_user('77777777-7777-4777-8777-777777777777');
select is(pg_temp.save(pg_temp.comp(pg_temp.time_goal() || pg_temp.basis('{"effective_goal": "time"}'))),
  '22023: Eine Zielzeit ist hier nicht möglich.', 'ab 65: nur „Ankommen“');

-- ---------------------------------------------------------------------------------------------------------
-- Export und Widerruf
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'competitions'), 1, 'Export: eigener Wettkampf');
select ok(position('22222222-2222-4222-8222-222222222222' in (public.export_my_data() -> 'data' -> 'competitions')::text) = 0
  and (public.export_my_data() -> 'data' -> 'competitions' -> 0) ?& array['start_reference_start_group', 'effective_goal'],
  'Export: mit Plan-Bezug, nichts von anderen');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
select results_eq(
  $$ select name, uses_health_data, effective_goal::text, start_reference_volume::int, start_reference_start_group::text,
       own_start_weekly_minutes::int, long_run_weekday::int, status::text from public.competitions $$,
  $$ values ('Stadtlauf Köln', false, null::text, null::int, null::text, null::int, 7, 'planned') $$,
  'Widerruf: Plan-Bezug geleert, Wettkampf und Wunsch-Tag bleiben');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', pg_temp.a_id()) || pg_temp.basis())),
  '42501: Ein Wettkampfplan braucht den Gesundheits-Check.', 'nach dem Widerruf kein Plan-Bezug mehr');

-- ---------------------------------------------------------------------------------------------------------
-- Absagen, abschließen, löschen
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.error_of(format('select public.cancel_competition(%L)', pg_temp.a_id())),
  '42501: Wettkampf nicht gefunden.', 'B sagt den Wettkampf von A nicht ab');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
create temporary table a_first on commit drop as select pg_temp.a_id() as id;
grant select on a_first to authenticated;
select is(pg_temp.error_of(format('select public.cancel_competition(%L)', (select id from a_first))), 'kein Fehler',
  'A sagt ab');
select results_eq($$ select status::text from public.competitions $$, $$ values ('cancelled') $$, 'Stand abgesagt');
select is(pg_temp.error_of(format('select public.cancel_competition(%L)', (select id from a_first))),
  '22023: Nur geplante Wettkämpfe lassen sich absagen.', 'zweimal absagen abgelehnt');
select is(pg_temp.save(pg_temp.comp(jsonb_build_object('id', (select id from a_first)))),
  '22023: Nur geplante Wettkämpfe lassen sich ändern.', 'abgesagten Wettkampf nicht ändern');
select is(pg_temp.error_of(format('select public.complete_competition(%L, null)', (select id from a_first))),
  '22023: Ein abgesagter Wettkampf lässt sich nicht abschließen.', 'abgesagten Wettkampf nicht abschließen');
select is(pg_temp.save(pg_temp.comp()), 'kein Fehler', 'nach dem Absagen ein neuer geplanter Wettkampf');
select is(pg_temp.error_of(format('select public.complete_competition(%L, null)', pg_temp.a_id())),
  '22023: Der Wettkampf liegt noch in der Zukunft.', 'vor dem Renntag nicht abschließen');
-- Renntag ist vorbei; Einträge als Datenbank-Admin (Renntag, anderer Tag, fremder Eintrag).
reset role;
create or replace function private.berlin_today() returns date language sql stable set search_path = '' as $$
  select date '2027-01-11'
$$;
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at, is_free)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'endurance', '2027-01-10',
   'completed', 'Wettkampf', gen_random_uuid(), now(), true),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'endurance', '2027-01-09',
   'completed', 'Lauf', gen_random_uuid(), now(), true),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'endurance', '2027-01-10',
   'completed', 'Lauf', gen_random_uuid(), now(), true);
set local role authenticated;
select is(pg_temp.error_of(format('select public.complete_competition(%L, %L)', pg_temp.a_id(),
    'a1000000-0000-4000-8000-000000000002')),
  '22023: Dieser Eintrag passt nicht zum Wettkampf.', 'Ergebnis nur ein Eintrag vom Renntag');
select is(pg_temp.error_of(format('select public.complete_competition(%L, %L)', pg_temp.a_id(),
    'b1000000-0000-4000-8000-000000000001')),
  '22023: Dieser Eintrag passt nicht zum Wettkampf.', 'Ergebnis nie ein fremder Eintrag');
create temporary table a_second on commit drop as select pg_temp.a_id() as id;
grant select on a_second to authenticated;
select is(pg_temp.error_of(format('select public.complete_competition(%L, %L)', (select id from a_second),
    'a1000000-0000-4000-8000-000000000001')), 'kein Fehler', 'A schließt mit dem Ergebnis-Eintrag ab');
select results_eq($$ select status::text, result_session_log_id::text from public.competitions where id = (select id from a_second) $$,
  $$ values ('done', 'a1000000-0000-4000-8000-000000000001') $$, 'Stand erledigt, Verweis auf den Eintrag');
reset role;
delete from public.session_logs where id = 'a1000000-0000-4000-8000-000000000001';
select results_eq($$ select status::text, result_session_log_id from public.competitions where id = (select id from a_second) $$,
  $$ values ('done', null::uuid) $$, 'Eintrag gelöscht: Wettkampf bleibt erledigt, Verweis leer');
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date)
                    values ('11111111-1111-4111-8111-111111111111', 'Falsch', '10k', 5000, '2027-01-10') $$,
  '23514', null, 'CHECK: Distanz passt zur Disziplin');
select throws_ok($$ insert into public.competitions (user_id, name, discipline, distance_m, race_date, uses_health_data)
                    values ('11111111-1111-4111-8111-111111111111', 'Falsch', '10k', 10000, '2027-01-10', true) $$,
  '23514', null, 'CHECK: Gesundheitsbezug nur mit Plan-Bezug');
set local role authenticated;
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.error_of(format('select public.delete_competition(%L)', (select id from a_second))),
  '42501: Wettkampf nicht gefunden.', 'B löscht den Wettkampf von A nicht');
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.error_of(format('select public.delete_competition(%L)', (select id from a_second))), 'kein Fehler',
  'A löscht einen Wettkampf');
select is((select count(*)::int from public.competitions), 1, 'A: nur der abgesagte bleibt');

-- Konto löschen: Kaskade
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select public.delete_my_account() $$, 'B löscht das Konto');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.competitions where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.competitions where user_id = '11111111-1111-4111-8111-111111111111') $$,
  $$ values (0, 1) $$, 'Konto löschen: Wettkämpfe von B weg, A unberührt');

select * from finish();
rollback;
