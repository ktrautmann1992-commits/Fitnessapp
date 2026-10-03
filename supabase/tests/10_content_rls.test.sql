-- Inhaltstabellen (Phase 2): anon sieht nichts, authenticated liest nur Freigegebenes, Schreiben nur
-- service_role; admin_users nur eigene Zeile; seed_content für Nutzer gesperrt.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- Testinhalte direkt als Datenbank-Eigentümer anlegen (umgeht RLS).
insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', '{}', 'compound', 'bodyweight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('frei-a', 'published'), ('frei-b', 'published'), ('alt-c', 'archived')) as v(id, status);

insert into public.exercise_alternatives (exercise_id, alternative_id, reason, priority) values
  ('frei-a', 'frei-b', 'easier', 1),
  ('frei-a', 'alt-c', 'other_equipment', 2),
  ('alt-c', 'frei-a', 'harder', 1);

insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
select id, 1, status::public.content_status, 'Vorlage ' || id, 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 1, 45, 60, 'gym'
from (values ('vorlage-frei', 'published'), ('vorlage-alt', 'archived')) as v(id, status);

insert into public.template_sessions (template_id, day_index, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id, 1, 'Ganzkörper', 'full_body', 50, '5 Minuten locker einlaufen.', '5 Minuten locker auslaufen.'
from public.plan_templates;

insert into public.template_exercises (template_id, day_index, order_no, exercise_id, sets, reps_min, reps_max, rest_s, rpe_target)
select id, 1, 1, 'frei-a', 3, 8, 12, 120, 7 from public.plan_templates;

-- ---------------------------------------------------------------------------------------------------------
-- Datenbank-Regeln
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.exercises (
       id, version, status, name_de, name_en, movement_pattern, primary_muscles, mechanics, load_type,
       difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de)
     values ('entwurf-x', 1, 'draft', 'Entwurf', 'Draft', 'squat', '{quadriceps}', 'compound', 'bodyweight', 1,
       'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
       '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass es passt.') $$,
  '23514', null, 'Entwürfe können nicht in der Datenbank liegen'
);
select throws_ok(
  $$ insert into public.exercise_alternatives values ('frei-a', 'frei-a', 'easier', 3) $$,
  '23514', null, 'Alternative darf nicht auf sich selbst zeigen'
);
select throws_ok(
  $$ insert into public.template_exercises (template_id, day_index, order_no, exercise_id, sets, reps_min, reps_max, duration_s, rest_s, rpe_target)
     values ('vorlage-frei', 1, 2, 'frei-b', 3, 8, 12, 30, 120, 7) $$,
  '23514', null, 'Wiederholungen und Dauer schließen sich aus'
);
select throws_ok(
  $$ insert into public.template_exercises (template_id, day_index, order_no, exercise_id, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('vorlage-frei', 1, 2, 'frei-b', 3, 8, 12, 120, 7.3) $$,
  '23514', null, 'RPE nur in 0,5er-Schritten'
);
select throws_ok(
  $$ insert into public.template_exercises (template_id, day_index, order_no, exercise_id, sets, reps_min, reps_max, rest_s, rpe_target)
     values ('vorlage-frei', 1, 2, 'frei-b', 11, 8, 12, 120, 7) $$,
  '23514', null, 'Sätze höchstens 10 (Schema-Grenze)'
);
select throws_ok(
  $$ update public.plan_templates set goal_type = 'endurance' where id = 'vorlage-frei' $$,
  '23514', null, 'nur Ziele der Vorlagen-Matrix'
);

-- ---------------------------------------------------------------------------------------------------------
-- anon: sieht nichts
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select 1 from public.exercises $$, '42501', null, 'anon: exercises gesperrt');
select throws_ok($$ select 1 from public.exercise_alternatives $$, '42501', null, 'anon: exercise_alternatives gesperrt');
select throws_ok($$ select 1 from public.plan_templates $$, '42501', null, 'anon: plan_templates gesperrt');
select throws_ok($$ select 1 from public.template_sessions $$, '42501', null, 'anon: template_sessions gesperrt');
select throws_ok($$ select 1 from public.template_exercises $$, '42501', null, 'anon: template_exercises gesperrt');
select throws_ok($$ select 1 from public.admin_users $$, '42501', null, 'anon: admin_users gesperrt');
select throws_ok(
  $$ select public.seed_content('{"exercises":[],"plan_templates":[]}') $$,
  '42501', null, 'anon: seed_content gesperrt'
);
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- authenticated: nur Freigegebenes lesen, nichts schreiben
-- ---------------------------------------------------------------------------------------------------------
insert into public.admin_users (user_id) values ('11111111-1111-4111-8111-111111111111');

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';

select results_eq($$ select id from public.exercises order by id $$, array['frei-a', 'frei-b'],
  'nur freigegebene Übungen sichtbar');
select results_eq(
  $$ select exercise_id || '→' || alternative_id from public.exercise_alternatives $$,
  array['frei-a→frei-b'],
  'Alternativen nur, wenn beide Übungen freigegeben sind'
);
select results_eq($$ select id from public.plan_templates $$, array['vorlage-frei'],
  'nur freigegebene Vorlagen sichtbar');
select results_eq($$ select template_id from public.template_sessions $$, array['vorlage-frei'],
  'Einheiten nur von freigegebenen Vorlagen');
select results_eq($$ select template_id from public.template_exercises $$, array['vorlage-frei'],
  'Übungen nur von freigegebenen Vorlagen');

select throws_ok(
  $$ insert into public.exercises (id, version, status, name_de, name_en, movement_pattern, primary_muscles,
       mechanics, load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de)
     select 'neu-x', 1, 'published', name_de, name_en, movement_pattern, primary_muscles, mechanics, load_type,
       difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
     from public.exercises where id = 'frei-a' $$,
  '42501', null, 'Nutzer können keine Übungen anlegen'
);
select throws_ok($$ update public.exercises set name_de = 'Gehackt' $$, '42501', null,
  'Nutzer können Übungen nicht ändern');
select throws_ok($$ delete from public.exercises $$, '42501', null, 'Nutzer können Übungen nicht löschen');
select throws_ok($$ insert into public.exercise_alternatives values ('frei-b', 'frei-a', 'harder', 1) $$,
  '42501', null, 'Nutzer können keine Alternativen anlegen');
select throws_ok($$ update public.plan_templates set title_de = 'Gehackt!' $$, '42501', null,
  'Nutzer können Vorlagen nicht ändern');
select throws_ok($$ delete from public.template_sessions $$, '42501', null,
  'Nutzer können Einheiten nicht löschen');
select throws_ok($$ update public.template_exercises set sets = 6 $$, '42501', null,
  'Nutzer können Vorlagen-Übungen nicht ändern');
select throws_ok(
  $$ select public.seed_content('{"exercises":[],"plan_templates":[]}') $$,
  '42501', null, 'authenticated: seed_content gesperrt'
);

-- admin_users: B ist kein Admin und sieht keine fremde Zeile; Eintragen verboten.
select is_empty($$ select 1 from public.admin_users $$, 'B sieht keine Admin-Zeile von A');
select throws_ok(
  $$ insert into public.admin_users (user_id) values ('22222222-2222-4222-8222-222222222222') $$,
  '42501', null, 'B kann sich nicht selbst als Admin eintragen'
);
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select role::text from public.admin_users $$, array['content_admin'],
  'A sieht die eigene Admin-Zeile');
select throws_ok($$ delete from public.admin_users $$, '42501', null, 'A kann die Rolle nicht selbst löschen');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- service_role: liest alles (Seed/Workflows)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is((select count(*)::int from public.exercises), 3, 'service_role sieht alle Übungen');
select is((select count(*)::int from public.exercise_alternatives), 3, 'service_role sieht alle Alternativen');
select is((select count(*)::int from public.plan_templates), 2, 'service_role sieht alle Vorlagen');
select is((select count(*)::int from public.admin_users), 1, 'service_role sieht admin_users');
reset role;

-- Funktion: fester search_path, nicht öffentlich ausführbar
select is(
  (select proconfig from pg_proc where oid = 'public.seed_content(jsonb)'::regprocedure),
  array['search_path=""'], 'seed_content mit leerem search_path'
);
select ok(
  not has_function_privilege('authenticated', 'public.seed_content(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.seed_content(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.seed_content(jsonb)', 'execute'),
  'seed_content nur für service_role ausführbar'
);

select * from finish();
rollback;
