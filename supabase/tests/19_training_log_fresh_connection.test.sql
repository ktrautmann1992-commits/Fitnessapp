-- Phase 4 Etappe B, Wächter Runde 2 (N1): save_session_log OHNE planned_session_id als ERSTER Aufruf einer frischen
-- Verbindung. Eigene Datei, weil pg_prove jede Datei in einer eigenen Verbindung ausführt: PL/pgSQL plant Ausdrücke
-- je Verbindung erst beim ersten Lauf – ein Zugriff auf eine nicht zugewiesene Record-Variable (55000) fiele in
-- 18_training_log_rpcs nicht auf, weil dort vorher verknüpfte Einträge gespeichert werden.
-- In dieser Datei darf VOR den Tests unten kein anderer Aufruf von save_session_log stehen.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

insert into auth.users (id, email) values ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values ('11111111-1111-4111-8111-111111111111', '1990-01-01');
insert into public.exercises (id, version, status, name_de, name_en, movement_pattern, primary_muscles, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de)
values ('uebung-a', 1, 'published', 'Übung A', 'Exercise A', 'squat', '{quadriceps}', 'compound', 'weight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');

create function pg_temp.log(p_id text, p_planned text, p_write text) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'planned_session_id', p_planned,
    'planned_date', '2026-10-06', 'kind', 'strength', 'performed_on', '2026-10-06',
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', null, 'notes', null,
    'name_de', 'Kraft-Einheit', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-06T18:00:00+02:00',
    'exercises', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'order_no', 1, 'planned_exercise_id', null, 'exercise_id', 'uebung-a',
      'exercise_name_de', 'Übung A', 'load_type', 'weight', 'status', 'done', 'target_sets', null, 'reps_min', null,
      'reps_max', null, 'target_reps', null, 'target_extra_set', null, 'target_weight_kg', null,
      'target_duration_s', null, 'target_rpe', null, 'state_weight_kg', null, 'state_target_reps', null,
      'state_extra_set', null, 'state_duration_s', null, 'weight_confirmed', false, 'is_return', false,
      'sets', '[{"set_no": 1, "reps": 10, "weight_kg": 20, "duration_s": null, "rpe": null, "done": true}]'::jsonb)),
    'cardio', null
  )
$$;
grant execute on all functions in schema pg_temp to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000001', null, 'f1000000-0000-4000-8000-000000000001')),
  '{"result": "ok", "id": "a3000000-0000-4000-8000-000000000001", "revision": 1}'::jsonb,
  'erster Aufruf der Verbindung ohne planned_session_id: ok (kein 55000)'
);
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'deadbeef-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002')) ->> 'result',
  'orphaned', 'erfundene Einheit: orphaned'
);
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000001', 1) ->> 'result', 'ok',
  'Löschen eines Eintrags ohne Einheit');
select is((select count(*)::int from public.session_logs), 1, 'ein Eintrag bleibt');

select * from finish();
rollback;
