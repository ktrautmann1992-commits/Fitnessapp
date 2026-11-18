-- Eigene Workouts (Migrationen 20261118120000_custom_workouts.sql und *_custom_workouts_export.sql,
-- docs/PLAN-EIGENE-WORKOUTS.md): custom_workouts, workout_variants, exercise_dislikes mit RLS (nur Eigenes, anon
-- nichts, Schreiben nur mit Profil), Form-Prüfung der Bauanleitung bzw. Variante, Höchstzahlen, Export nur der eigenen
-- Zeilen, Konto löschen per Kaskade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.exercises (id, version, status, name_de, name_en, movement_pattern, primary_muscles, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de)
values ('uebung-a', 1, 'published', 'Übung A', 'Exercise A', 'squat', '{quadriceps}', 'compound', 'bodyweight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');

-- Gültige Bauanleitung: Aufwärmen, ein Track Beine, Dehnen (3 Übungen).
create temp table def (v jsonb);
insert into def values ('{
  "version": 1,
  "input": {"minutes": 30, "areas": ["legs"], "equipment_ids": [], "favorite_ids": [], "dislike_ids": [], "seed": 1},
  "tracks": [
    {"kind": "warmup", "area": null, "items": [
      {"exercise_id": "marschieren-auf-der-stelle", "reps": null, "duration_s": 40, "sets": 1, "rest_s": 10, "note_de": null}]},
    {"kind": "area", "area": "legs", "items": [
      {"exercise_id": "kniebeuge-stuhl", "reps": 12, "duration_s": null, "sets": 3, "rest_s": 20, "note_de": null}]},
    {"kind": "cooldown", "area": null, "items": [
      {"exercise_id": "oberschenkel-vorderseite-dehnen", "reps": null, "duration_s": 40, "sets": 1, "rest_s": 10, "note_de": null}]}
  ]}');
grant select on def to authenticated;
create temp table variant (v jsonb);
insert into variant values ('{"version": 1, "base_version": 1, "swaps": [{"index": 1, "from": "liegestuetz", "to": "liegestuetz-erhoeht"}]}');
grant select on variant to authenticated;

insert into public.custom_workouts (id, user_id, name, definition)
select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'Workout von B', v from def;
insert into public.workout_variants (user_id, workout_id, definition)
select '22222222-2222-4222-8222-222222222222', 'bauch-blitz', v from variant;
insert into public.exercise_dislikes (user_id, exercise_id)
values ('22222222-2222-4222-8222-222222222222', 'uebung-a');

-- ---------------------------------------------------------------------------------------------------------
-- Struktur
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.custom_workouts'::regclass, 'public.workout_variants'::regclass,
                   'public.exercise_dislikes'::regclass)),
  'RLS auf allen drei Tabellen'
);
select col_is_pk('public', 'workout_variants', array['user_id', 'workout_id'], 'eine Variante je Person und Workout');
select col_is_pk('public', 'exercise_dislikes', array['user_id', 'exercise_id'], 'eine Abneigung je Person und Übung');
select fk_ok('public', 'custom_workouts', 'user_id', 'auth', 'users', 'id', 'custom_workouts → auth.users');
select fk_ok('public', 'exercise_dislikes', 'exercise_id', 'public', 'exercises', 'id', 'exercise_dislikes → exercises');

-- ---------------------------------------------------------------------------------------------------------
-- A sieht und ändert nur Eigenes
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is_empty($$ select 1 from public.custom_workouts $$, 'A sieht keine Workouts von B');
select is_empty($$ select 1 from public.workout_variants $$, 'A sieht keine Varianten von B');
select is_empty($$ select 1 from public.exercise_dislikes $$, 'A sieht keine Abneigungen von B');
select lives_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mein Beine 30', v from def $$,
  'A legt ein eigenes Workout an'
);
select lives_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mein Beine 30 neu', v from def
     on conflict (id) do update set name = excluded.name, definition = excluded.definition $$,
  'A ändert es per Upsert (Warteschlange: gleiche id)'
);
select is((select name from public.custom_workouts), 'Mein Beine 30 neu', 'Name geändert');
select throws_ok(
  $$ insert into public.custom_workouts (id, user_id, name, definition)
     select gen_random_uuid(), '22222222-2222-4222-8222-222222222222', 'Fremd', v from def $$,
  '42501', null, 'A kann kein Workout für B anlegen'
);
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Übernahme', v from def
     on conflict (id) do update set name = excluded.name $$,
  '42501', null, 'A kann das Workout von B nicht per Upsert übernehmen'
);
select lives_ok(
  $$ update public.custom_workouts set name = 'Gekapert' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$,
  'Update auf fremde Zeile trifft nichts'
);
select lives_ok(
  $$ insert into public.workout_variants (workout_id, definition) select 'bauch-blitz', v from variant $$,
  'A speichert eine Variante'
);
select lives_ok(
  $$ insert into public.exercise_dislikes (exercise_id) values ('uebung-a') $$,
  'A setzt „Mag ich nicht“'
);
select throws_ok(
  $$ insert into public.exercise_dislikes (exercise_id) values ('gibt-es-nicht') $$,
  '23503', null, 'nur Übungen der Bibliothek'
);

-- ---------------------------------------------------------------------------------------------------------
-- Form-Prüfung (zweite Grenze nach Zod)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition) values (gen_random_uuid(), 'Kaputt', '{"version": 1}') $$,
  '23514', 'Ungültiges eigenes Workout.', 'Bauanleitung ohne Tracks abgelehnt'
);
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select gen_random_uuid(), 'Zu viele Sätze', jsonb_set(v, '{tracks,1,items,0,sets}', '7') from def $$,
  '23514', 'Ungültiges eigenes Workout.', 'mehr als 6 Sätze abgelehnt'
);
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select gen_random_uuid(), 'Doppelt', jsonb_set(v, '{tracks,2,items,0,exercise_id}', '"kniebeuge-stuhl"') from def $$,
  '23514', 'Ungültiges eigenes Workout.', 'doppelte Übung abgelehnt'
);
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition)
     select gen_random_uuid(), 'Dauer', jsonb_set(v, '{input,minutes}', '25') from def $$,
  '23514', 'Ungültiges eigenes Workout.', 'Dauer außerhalb 15/20/30/45/60 abgelehnt'
);
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition) select gen_random_uuid(), 'ab', v from def $$,
  '23514', null, 'Name zu kurz'
);
select throws_ok(
  $$ insert into public.workout_variants (workout_id, definition)
     values ('barbell-burn-60', '{"version": 1, "base_version": 1, "swaps": [{"index": 0, "from": "a-b", "to": "a-b"}]}') $$,
  '23514', 'Ungültige Workout-Variante.', 'Tausch gegen sich selbst abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Höchstzahl eigener Workouts (50)
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into public.custom_workouts (id, user_id, name, definition)
select gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'Workout ' || n, v
from def, generate_series(1, 49) n;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ insert into public.custom_workouts (id, name, definition) select gen_random_uuid(), 'Nummer 51', v from def $$,
  '23514', 'Zu viele eigene Workouts.', 'höchstens 50 eigene Workouts'
);
select lives_ok(
  $$ update public.custom_workouts set name = 'Geändert' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$,
  'Ändern geht auch an der Grenze'
);

-- ---------------------------------------------------------------------------------------------------------
-- Ohne Profil, anon
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.exercise_dislikes (exercise_id) values ('uebung-a') $$,
  '42501', null, 'ohne Profil kein Schreiben'
);
reset role;
set local role anon;
select throws_ok($$ select 1 from public.custom_workouts $$, '42501', null, 'anon: kein Zugriff');

-- ---------------------------------------------------------------------------------------------------------
-- Export und Konto löschen
-- ---------------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  jsonb_array_length(public.export_my_data() -> 'data' -> 'custom_workouts'), 50, 'Export: nur die eigenen 50 Workouts'
);
select is(
  (public.export_my_data() -> 'data' -> 'workout_variants' -> 0 ->> 'workout_id'), 'bauch-blitz', 'Export: Variante'
);
select is(
  (public.export_my_data() -> 'data' -> 'exercise_dislikes' -> 0 ->> 'exercise_id'), 'uebung-a', 'Export: Abneigung'
);
select lives_ok($$ select public.delete_my_account() $$, 'A löscht das Konto');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.custom_workouts where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.workout_variants where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.exercise_dislikes where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.custom_workouts where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.workout_variants where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.exercise_dislikes where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (0, 0, 0, 1, 1, 1) $$,
  'Konto löschen: alles von A weg, B unberührt (auch der Name „Workout von B“)'
);

select * from finish();
rollback;
