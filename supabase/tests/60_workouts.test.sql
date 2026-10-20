-- Workout-Bibliothek (docs/PLAN-WORKOUTS.md, Migrationen 20261020150000/…150100): Tabelle workouts (RLS: nur
-- published für authenticated, anon nichts, schreiben nur seed_workouts), seed_workouts (nur service_role, Testphase-
-- Schalter, nur freigegebene Übungen und Katalog-Geräte, Versionen, archivieren statt löschen, idempotent, Prüfer-Namen
-- neutralisiert) und mark_session_log_workout (Herkunft „workout“ nur an eigener freier Kraft-Einheit, idempotent,
-- bleibt beim Ändern, im Export). „Heute“ ist fest Donnerstag, 15.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-15'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) u;
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) u
cross join unnest(array['terms', 'privacy']::public.consent_type[]) t;

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', equipment::text[], 'compound', load::public.load_type, 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('wk-kniebeuge', 'published', 'bodyweight', '{}'), ('wk-stuetz', 'published', 'time', '{}'),
             ('wk-rudern', 'published', 'weight', '{dumbbells}'), ('wk-alt', 'archived', 'bodyweight', '{}'))
  as v(id, status, load, equipment);

-- ---------------------------------------------------------------------------------------------------------
-- Bausteine im Format von content/workouts/*.json (packages/core/src/workouts/schema.ts)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.workout(
  p_id text, p_version integer default 1, p_expert boolean default false, p_status text default 'published',
  p_exercises text[] default array['wk-kniebeuge', 'wk-stuetz'], p_equipment text[] default '{}'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'version', p_version, 'status', p_status, 'title_de', 'Workout ' || p_id,
    'summary_de', 'Kurzbeschreibung mit genug Zeichen.', 'category', 'core', 'difficulty', 2, 'minutes', 10,
    'format', 'circuit', 'rounds', 3, 'round_rest_s', 30, 'equipment_ids', to_jsonb(p_equipment),
    'warmup_de', 'Fünf Minuten locker aufwärmen.', 'cooldown_de', 'Ruhig ausgehen.',
    'exercises', (select jsonb_agg(jsonb_build_object('exercise_id', e, 'reps', 10, 'duration_s', null, 'sets', null,
      'rest_s', 15, 'note_de', null) order by n) from unnest(p_exercises) with ordinality as t(e, n)),
    'meta', jsonb_build_object('origin', 'claude_session', 'model', 'claude-opus-5-5', 'batch_id', null,
      'created_on', '2026-10-20', 'expert_reviewed', p_expert, 'reviewed_by', 'Prüferin GF',
      'reviewed_at', '2026-10-20', 'review_note', 'Interner Vermerk GF')
  )
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
-- Freie Kraft-Einheit wie freeSessionLogFromInput mit „fromWorkout“: Körpergewicht nach Zeit ohne Wiederholungen.
create function pg_temp.workout_log(p_id text, p_write text, p_base integer default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', p_base, 'planned_session_id', null,
    'planned_date', '2026-10-15', 'kind', 'strength', 'performed_on', '2026-10-15',
    'started_at', '2026-10-15T10:00:00+02:00', 'finished_at', '2026-10-15T10:20:00+02:00', 'status', 'completed',
    'session_rpe', 6, 'notes', 'Workout „Bauch-Blitz“ (★★☆☆☆) · 3/3 Runden · 12 Min.',
    'name_de', 'Freie Kraft-Einheit', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-15T10:20:00+02:00',
    'exercises', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'order_no', 1, 'planned_exercise_id', null, 'exercise_id', 'wk-kniebeuge',
      'exercise_name_de', 'Übung wk-kniebeuge', 'load_type', 'bodyweight', 'status', 'done',
      'target_sets', null, 'reps_min', null, 'reps_max', null, 'target_reps', null, 'target_extra_set', null,
      'target_weight_kg', null, 'target_duration_s', null, 'target_rpe', null,
      'state_weight_kg', null, 'state_target_reps', null, 'state_extra_set', null, 'state_duration_s', null,
      'weight_confirmed', false, 'is_return', false,
      'sets', '[{"set_no": 1, "reps": null, "weight_kg": null, "duration_s": null, "rpe": null, "done": true},
                {"set_no": 2, "reps": 10, "weight_kg": null, "duration_s": null, "rpe": null, "done": true}]'::jsonb
    )),
    'cardio', null, 'is_free', true
  )
$$;
grant execute on all functions in schema pg_temp to authenticated, anon, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Tabelle, Rechte, RLS
-- ---------------------------------------------------------------------------------------------------------
select has_table('public', 'workouts', 'Tabelle workouts vorhanden');
select ok((select relrowsecurity from pg_class where oid = 'public.workouts'::regclass), 'RLS auf workouts aktiv');
select is((select attgenerated::text from pg_attribute
           where attrelid = 'public.workouts'::regclass and attname = 'expert_reviewed'), 's',
  'expert_reviewed wird aus data berechnet (nicht beschreibbar)');
select throws_ok($$ insert into public.workouts (id, version, status, title_de, category, difficulty, minutes, format,
    exercise_ids, data) values ('kaputt', 1, 'published', 'Kaputt', 'core', 6, 10, 'circuit', '{a,b}', '{}') $$,
  '23514', null, 'Sterne nur 1–5 (CHECK)');
select throws_ok($$ insert into public.workouts (id, version, status, title_de, category, difficulty, minutes, format,
    exercise_ids, data) values ('entwurf', 1, 'draft', 'Entwurf', 'core', 2, 10, 'circuit', '{a,b}', '{}') $$,
  '23514', null, 'Entwürfe nie in der Datenbank (CHECK)');

set local role anon;
select throws_ok($$ select count(*) from public.workouts $$, '42501', null, 'anon liest keine Workouts');
select throws_ok($$ select public.seed_workouts('{"workouts": []}') $$, '42501', null,
  'anon darf nicht einspielen');
select throws_ok($$ select public.mark_session_log_workout(gen_random_uuid()) $$, '42501', null,
  'anon darf keine Herkunft setzen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.seed_workouts('{"workouts": []}') $$, '42501', null,
  'Nutzer dürfen nicht einspielen');
select throws_ok($$ insert into public.workouts (id, version, status, title_de, category, difficulty, minutes, format,
    exercise_ids, data) values ('nutzer', 1, 'published', 'Nutzer', 'core', 2, 10, 'circuit', '{a,b}', '{}') $$,
  '42501', null, 'Nutzer schreiben keine Workouts');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- seed_workouts
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('bauch-blitz')))) $$),
  '23514: Workout bauch-blitz ist nicht fachlich geprüft.%', 'Standard = Livegang-Regel: nur fachlich geprüft');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('bauch-blitz'))), null) $$),
  '23514:%nicht fachlich geprüft%', 'null zählt als Livegang-Regel');
select is(
  public.seed_workouts(jsonb_build_object('workouts', jsonb_build_array(
    pg_temp.workout('bauch-blitz'),
    pg_temp.workout('rudern-zirkel', p_exercises => array['wk-rudern', 'wk-kniebeuge'],
      p_equipment => array['dumbbells'], p_expert => true)
  )), false),
  '{"workouts": 2, "archived": 0}'::jsonb,
  'Testphase: freigegebene Workouts auch ohne Fachprüfung eingespielt'
);
select is((select array_agg(id || ':' || expert_reviewed order by id) from public.workouts),
  array['bauch-blitz:false', 'rudern-zirkel:true'], 'expert_reviewed aus data');
select is((select exercise_ids from public.workouts where id = 'rudern-zirkel'), array['wk-rudern', 'wk-kniebeuge'],
  'exercise_ids in Reihenfolge');
select is((select equipment_ids from public.workouts where id = 'rudern-zirkel'), array['dumbbells'],
  'equipment_ids aus der Datei');
select is((select (category, difficulty, minutes, format)::text from public.workouts where id = 'bauch-blitz'),
  '(core,2,10,circuit)', 'Filter-Spalten aus der Datei');
select is((select data -> 'meta' ->> 'reviewed_by' from public.workouts where id = 'bauch-blitz'), 'redaktion',
  'Prüfer-Name neutralisiert');
select is((select data -> 'meta' -> 'review_note' from public.workouts where id = 'bauch-blitz'), 'null'::jsonb,
  'Prüfvermerk (Freitext) entfernt');

-- Idempotent: gleicher Stand → Zeile nicht angefasst (xmin bleibt; now() ist in der Transaktion fest).
create temp table seen as select id, xmin::text as row_version from public.workouts;
select public.seed_workouts(jsonb_build_object('workouts', jsonb_build_array(
  pg_temp.workout('bauch-blitz'),
  pg_temp.workout('rudern-zirkel', p_exercises => array['wk-rudern', 'wk-kniebeuge'],
    p_equipment => array['dumbbells'], p_expert => true))), false);
select is((select count(*)::int from public.workouts w join seen s on s.id = w.id and s.row_version = w.xmin::text), 2,
  'erneutes Einspielen ändert nichts');

select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('neu', p_status => 'draft'))), false) $$),
  '22023: Nur freigegebene Inhalte%', 'Entwürfe werden nie eingespielt');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('neu', p_exercises => array['wk-kniebeuge', 'gibt-es-nicht']))), false) $$),
  '23503: Workout neu enthält eine nicht freigegebene Übung.', 'unbekannte Übung abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('neu', p_exercises => array['wk-kniebeuge', 'wk-alt']))), false) $$),
  '23503:%nicht freigegebene Übung%', 'zurückgezogene Übung abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('neu', p_equipment => array['zauberstab']))), false) $$),
  '23503:%Gerät%', 'Gerät außerhalb des Katalogs abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('neu'), pg_temp.workout('neu'))), false) $$),
  '23505:%Doppelte%', 'doppelte ID abgelehnt');
select alike(pg_temp.error_of($$ select public.seed_workouts(jsonb_build_object('workouts',
    jsonb_build_array(pg_temp.workout('bauch-blitz', p_version => 0))), false) $$),
  '23514%', 'Version sinkt nie (bzw. Grenze)');
select alike(pg_temp.error_of($$ select public.seed_workouts('{"workouts": [], "exercises": []}', false) $$),
  '22023:%', 'unbekannte Inhaltsart abgelehnt');

-- Nicht mehr im Paket → archiviert (nie gelöscht).
select is(
  public.seed_workouts(jsonb_build_object('workouts', jsonb_build_array(
    pg_temp.workout('bauch-blitz', p_version => 2))), false),
  '{"workouts": 1, "archived": 1}'::jsonb, 'Fehlendes Workout wird archiviert');
select is((select status::text || ':' || version from public.workouts where id = 'rudern-zirkel'), 'archived:1',
  'archiviert, nicht gelöscht');
select is((select version from public.workouts where id = 'bauch-blitz'), 2, 'neue Version übernommen');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select array_agg(id order by id) from public.workouts), array['bauch-blitz'],
  'Nutzer sehen nur freigegebene Workouts');

-- ---------------------------------------------------------------------------------------------------------
-- Tagebuch: freie Einheit aus dem Timer, Herkunft „workout“
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.save_session_log(pg_temp.workout_log('b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000001')) ->> 'result',
  'ok', 'Workout-Eintrag (Körpergewicht nach Zeit ohne Wdh.) als freie Einheit gespeichert');
select alike(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.workout_log(
    'b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000009'), '{source}', '"workout"')) $$),
  '22023:%', 'neue Einträge nie direkt mit Herkunft „workout“');
select is(public.mark_session_log_workout('b0000000-0000-4000-8000-000000000001'), '{"result": "ok"}'::jsonb,
  'Herkunft „workout“ gesetzt');
select is((select source::text from public.session_logs where id = 'b0000000-0000-4000-8000-000000000001'),
  'workout', 'Eintrag trägt Herkunft „workout“');
select is((select revision from public.session_logs where id = 'b0000000-0000-4000-8000-000000000001'), 1,
  'Revision unverändert');
select is(public.mark_session_log_workout('b0000000-0000-4000-8000-000000000001'), '{"result": "ok"}'::jsonb,
  'idempotent');
select is(
  public.save_session_log(pg_temp.workout_log('b0000000-0000-4000-8000-000000000001',
    'c0000000-0000-4000-8000-000000000002', 1)) ->> 'result',
  'ok', 'erneut gesendete Fassung (Herkunft manual) wird angenommen');
select is((select source::text from public.session_logs where id = 'b0000000-0000-4000-8000-000000000001'),
  'workout', 'Herkunft bleibt beim Ändern');
select is(
  (select count(*)::int from jsonb_array_elements(public.export_my_data() -> 'data' -> 'session_logs') x
   where x ->> 'source' = 'workout'),
  1, 'Export enthält die Herkunft');
select alike(pg_temp.error_of($$ select public.mark_session_log_workout(gen_random_uuid()) $$), '22023:%',
  'unbekannter Eintrag abgelehnt');

-- Ausdauer-Eintrag (frei) ist kein Workout.
select is(public.save_session_log(jsonb_build_object(
    'id', 'b0000000-0000-4000-8000-000000000003', 'write_id', 'c0000000-0000-4000-8000-000000000003',
    'base_revision', null, 'planned_session_id', null, 'planned_date', '2026-10-15', 'kind', 'endurance',
    'performed_on', '2026-10-15', 'started_at', null, 'finished_at', null, 'status', 'completed',
    'session_rpe', 3, 'notes', null, 'name_de', 'Lauf', 'is_intro_week', false, 'is_deload', false,
    'source', 'manual', 'client_updated_at', '2026-10-15T12:00:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('modality', 'run', 'duration_s', 1800, 'distance_m', 5000, 'elevation_m', null),
    'is_free', true)) ->> 'result', 'ok', 'freier Lauf gespeichert');
select alike(pg_temp.error_of($$ select public.mark_session_log_workout('b0000000-0000-4000-8000-000000000003') $$),
  '22023:%', 'Ausdauer-Eintrag wird nie „workout“');

-- Fremder Eintrag: B darf A nicht markieren.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select alike(pg_temp.error_of($$ select public.mark_session_log_workout('b0000000-0000-4000-8000-000000000001') $$),
  '22023:%', 'fremder Eintrag abgelehnt');
reset role;

-- Eintrag einer geplanten Einheit (nicht frei) wird nie „workout“.
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
values ('b0000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'strength', '2026-10-14',
  'completed', 'Ganzkörper', gen_random_uuid(), now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select alike(pg_temp.error_of($$ select public.mark_session_log_workout('b0000000-0000-4000-8000-000000000004') $$),
  '22023:%', 'nicht freier Eintrag abgelehnt');
reset role;

select * from finish();
rollback;
