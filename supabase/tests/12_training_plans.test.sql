-- Phase 3 · Nutzerpläne (docs/PLAN-PHASE-3.md Abschnitt 8): RLS, nur Lesen für Nutzer, Verschiebe-Regeln,
-- Grenzen, nie stapeln, ein aktiver Plan, archivierte Übungen über eigene Pläne, Löschen mit Plan-Bezug.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt; der Rollback
-- stellt das Original wieder her): Montag dieser Woche 05.10., Sonntag 11.10., Montag der nächsten Woche 12.10.
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;
select is(private.berlin_today(), date '2026-10-07', 'Stichtag fest: Mittwoch, 07.10.2026');

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');

-- Inhalte (als Datenbank-Eigentümer).
insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', '{}', 'compound', 'bodyweight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('uebung-a', 'published'), ('uebung-b', 'published'), ('uebung-alt', 'archived')) as v(id, status);
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- Pläne von A (aktiv) und B (aktiv). Einheiten von A: nächste Woche Mo 12.10. und Mi 14.10., Vorwoche Mo 28.09.,
-- diese Woche Mo 05.10. (verpasst), Mi 07.10. (heute), Do 08.10., Erholungseinheit Fr 16.10.
insert into public.user_plans (id, user_id, template_id, template_title_de, template_version, engine_version,
  match_quality, inputs, start_date)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', current_date),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', current_date);

insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id, plan_id, user_id, 1, 2, idx, day, 'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.'
from (
  select 'a1000000-0000-4000-8000-000000000001'::uuid as id, 'aaaaaaaa-0000-4000-8000-000000000001'::uuid as plan_id,
    '11111111-1111-4111-8111-111111111111'::uuid as user_id, 1 as idx, date '2026-10-12' as day
  union all select 'a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 2, date '2026-10-14'
  union all select 'a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 3, date '2026-09-28'
  union all select 'a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 1, date '2026-10-05'
  union all select 'a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 3, date '2026-10-08'
  union all select 'a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111', 2, date '2026-10-07'
  union all select 'b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
    '22222222-2222-4222-8222-222222222222', 1, date '2026-10-12'
) s;
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, is_deload, template_day_index,
  scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
values ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', 1, 6, true, 3, date '2026-10-16', 'Ganzkörper', 'full_body', 40,
  'Aufwärmen.', 'Ausklingen.');

insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id,
  exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7),
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, 'uebung-alt', 'uebung-alt', 'Übung alt', 3, 8, 12, 120, 7),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7);

-- ---------------------------------------------------------------------------------------------------------
-- Grenzen und Eindeutigkeit (als Eigentümer)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 10) $$,
  '23514', null, 'RPE 10 wird abgelehnt (nie Maximaltests)'
);
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 7, 8, 12, 120, 7) $$,
  '23514', null, '7 Sätze werden abgelehnt'
);
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 2, 2, 120, 7) $$,
  '23514', null, '2 Wiederholungen werden abgelehnt'
);
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 9, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7) $$,
  '23514', null, 'order_no 9 (= 9. Übung) wird abgelehnt'
);
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'uebung-b', 'uebung-b', 'Übung B', 3, 8, 12, 120, 7) $$,
  '23505', null, 'doppelte order_no wird abgelehnt'
);
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('b1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7) $$,
  '23503', null, 'Übung an Einheit einer anderen Person hängen scheitert (Fremdschlüssel)'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
     values ('bbbbbbbb-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 1, 1, current_date + 30, 'Test', 'full_body', 50, 'A.', 'B.') $$,
  '23503', null, 'Einheit an Plan einer anderen Person hängen scheitert (Fremdschlüssel)'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 2, 2, date '2026-10-12', 'Test', 'full_body', 50, 'A.', 'B.') $$,
  '23505', null, 'zwei Einheiten am selben Tag werden abgelehnt (nie stapeln)'
);
select throws_ok(
  $$ insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
     values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 7, 2, current_date + 40, 'Test', 'full_body', 50, 'A.', 'B.') $$,
  '23514', null, 'week_no 7 wird abgelehnt (0–6)'
);
select throws_ok(
  $$ insert into public.user_plans (user_id, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date)
     values ('11111111-1111-4111-8111-111111111111', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', current_date) $$,
  '23505', null, 'nur ein aktiver Plan je Person'
);
select throws_ok(
  $$ insert into public.user_plans (user_id, status, replaced_at, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date, medical_notice)
     values ('11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', current_date, true) $$,
  '23514', null, 'Arzt-Hinweis ohne Gesundheitsdaten wird abgelehnt'
);
select throws_ok(
  $$ insert into public.user_plans (user_id, status, replaced_at, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date)
     values ('11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{"healthScreening": {"flags": []}}', current_date) $$,
  '23514', null, 'Gesundheits-Check in inputs wird abgelehnt'
);
select throws_ok(
  $$ insert into public.user_plans (user_id, status, replaced_at, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date)
     values ('11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', jsonb_build_object('goalType', repeat('x', 5000)), current_date) $$,
  '23514', null, 'inputs über 4096 Bytes werden abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Als Nutzer A
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is((select count(*) from public.user_plans), 1::bigint, 'A sieht nur den eigenen Plan');
select is((select count(*) from public.planned_sessions), 7::bigint, 'A sieht nur eigene Einheiten');
select is((select count(*) from public.planned_exercises), 2::bigint, 'A sieht nur eigene Übungen');
select is(
  (select count(*) from public.exercises where id = 'uebung-alt'), 1::bigint,
  'archivierte Übung ist über den eigenen Plan lesbar'
);

select throws_ok(
  $$ insert into public.user_plans (template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date)
     values ('vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', current_date) $$,
  '42501', null, 'A darf user_plans nicht direkt anlegen'
);
select throws_ok(
  $$ update public.user_plans set uses_health_data = true $$,
  '42501', null, 'A darf user_plans nicht ändern'
);
select throws_ok($$ delete from public.user_plans $$, '42501', null, 'A darf user_plans nicht löschen');
select throws_ok(
  $$ update public.planned_exercises set rpe_target = 9 $$,
  '42501', null, 'A darf planned_exercises nicht ändern'
);
select throws_ok($$ delete from public.planned_exercises $$, '42501', null, 'A darf planned_exercises nicht löschen');
select throws_ok(
  $$ insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id, exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7) $$,
  '42501', null, 'A darf planned_exercises nicht anlegen'
);
select throws_ok($$ delete from public.planned_sessions $$, '42501', null, 'A darf Einheiten nicht löschen');
select throws_ok(
  $$ update public.planned_sessions set name_de = 'Anders' where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '42501', null, 'A darf nur Datum und Status ändern'
);

-- Verschieben in der nächsten Woche: Mo → Di (erstes Verschieben setzt original_date), Di → So (bleibt).
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-13' where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'Verschieben innerhalb derselben Woche'
);
select is(
  (select original_date from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000001'),
  date '2026-10-12', 'erstes Verschieben setzt original_date'
);
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-18' where id = 'a1000000-0000-4000-8000-000000000001' $$,
  'erneutes Verschieben'
);
select is(
  (select original_date from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000001'),
  date '2026-10-12', 'original_date bleibt beim zweiten Verschieben'
);
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-19' where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'nie in die Folgewoche (geprüft gegen das ursprüngliche Datum)'
);
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-18' where id = 'a1000000-0000-4000-8000-000000000002' $$,
  '23505', null, 'nie zwei Einheiten am selben Tag'
);

-- Diese Woche (heute = Mi 07.10.).
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-06' where id = 'a1000000-0000-4000-8000-000000000005' $$,
  '23514', null, 'nie vor heute (Do → Di, gleiche Woche, Tag frei)'
);
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-06' where id = 'a1000000-0000-4000-8000-000000000006' $$,
  '23514', null, 'Mi → Di derselben Woche wird abgelehnt'
);
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-11' where id = 'a1000000-0000-4000-8000-000000000005' $$,
  'Sonntag ist die Grenze: Do → So erlaubt'
);
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-12' where id = 'a1000000-0000-4000-8000-000000000005' $$,
  '23514', null, 'Montag danach wird abgelehnt'
);
select throws_ok(
  $$ update public.planned_sessions set status = 'skipped' where id = 'a1000000-0000-4000-8000-000000000003' $$,
  '23514', null, 'Einheit einer vergangenen Woche bleibt unverändert'
);
select lives_ok(
  $$ update public.planned_sessions set status = 'skipped' where id = 'a1000000-0000-4000-8000-000000000006' $$,
  'Einheit von heute streichen'
);
select throws_ok(
  $$ update public.planned_sessions set status = 'planned' where id = 'a1000000-0000-4000-8000-000000000006' $$,
  '23514', null, 'gestrichen → geplant geht nicht'
);
-- Alter Termin in der Vergangenheit (Montag dieser Woche), neuer Termin heute (nach dem Streichen frei).
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-07' where id = 'a1000000-0000-4000-8000-000000000004' $$,
  'verpasste Einheit vom Montag auf heute verschieben'
);
select is(
  (select original_date from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000004'),
  date '2026-10-05', 'original_date = verpasster Montag'
);

-- Erholungswoche: nur streichen, nie verschieben.
select throws_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-15' where id = 'a1000000-0000-4000-8000-000000000007' $$,
  '23514', 'Einheiten der Erholungswoche lassen sich nur streichen, nicht verschieben.',
  'Erholungseinheit lässt sich nicht verschieben'
);
select lives_ok(
  $$ update public.planned_sessions set status = 'skipped' where id = 'a1000000-0000-4000-8000-000000000007' $$,
  'Erholungseinheit streichen'
);

-- Fremde Einheit: RLS – keine Zeile betroffen.
update public.planned_sessions set status = 'skipped' where id = 'b1000000-0000-4000-8000-000000000001';
reset role;
select is(
  (select status::text from public.planned_sessions where id = 'b1000000-0000-4000-8000-000000000001'),
  'planned', 'A kann Einheiten von B nicht ändern'
);

-- Einheit eines ersetzten Plans ist nicht mehr änderbar.
update public.user_plans set status = 'replaced', replaced_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*) from public.exercises where id = 'uebung-alt'), 0::bigint, 'B sieht die archivierte Übung von A nicht');
select throws_ok(
  $$ update public.planned_sessions set status = 'skipped' where id = 'b1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Einheit eines ersetzten Plans ist nicht änderbar'
);

-- anon sieht nichts.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select count(*) from public.user_plans $$, '42501', null, 'anon: keine Pläne');

-- Inhalte mit Plan-Bezug lassen sich nicht löschen.
reset role;
select throws_ok($$ delete from public.exercises where id = 'uebung-a' $$, '23503', null, 'Übung mit Plan-Bezug nicht löschbar');
select throws_ok($$ delete from public.plan_templates where id = 'vorlage-a' $$, '23503', null, 'Vorlage mit Plan-Bezug nicht löschbar');

-- content-seed archiviert eine Übung, die in einem Nutzerplan steht (leeres Paket = alles archivieren).
create function pg_temp.seed_empty() returns jsonb language plpgsql as $$
declare result jsonb;
begin
  set local role service_role;
  result := public.seed_content('{"exercises": [], "plan_templates": []}');
  reset role;
  return result;
end;
$$;
select is(
  (pg_temp.seed_empty() ->> 'archived_exercises')::int, 2,
  'seed_content archiviert die Übungen – auch die im Nutzerplan'
);
select is((select status::text from public.exercises where id = 'uebung-a'), 'archived', 'uebung-a ist archiviert');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq(
  $$ select id from public.exercises order by id $$,
  array['uebung-a', 'uebung-alt'],
  'A liest archivierte Übungen nur über den eigenen Plan (uebung-b ohne Plan-Bezug unsichtbar)'
);
reset role;

select * from finish();
rollback;
