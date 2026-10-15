-- Etappe A1b (docs/PLAN-AUSWERTUNG.md 2.6 und 4): freie Einheiten in save_session_log (Migration
-- 20261015140000_free_session_logs.sql) – Feld is_free, Datumsfenster heute bis 14 Tage zurück (15 Tage und Zukunft
-- abgelehnt), keine geplante Einheit, keine Vorgaben/Zustände, Name aus fester Liste, Übung aus der Bibliothek,
-- frei ↔ nicht frei nie umschaltbar, Tageslimit, nie stapeln gilt nur für geplante, fremde Nutzer, anon,
-- recent_exercise_logs ohne freie Einträge, Export enthält is_free. Ältere Fassungen ohne is_free bleiben gültig.
-- „Heute“ ist fest Donnerstag, 15.10.2026: 14 Tage zurück = 01.10., 15 Tage zurück = 30.09.
begin;
create extension if not exists pgtap with schema extensions;
select plan(55);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-15'
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Daten (als Datenbank-Eigentümer): A mit aktivem Plan (SA1 Mo 12.10. Kraft), B fremd, C für das Tageslimit.
-- ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333']::uuid[]) u;
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333']::uuid[]) u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', '{}', 'compound', load::public.load_type, 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('frei-a', 'published', 'weight'), ('frei-b', 'published', 'weight'),
             ('frei-archiv', 'archived', 'weight')) as v(id, status, load);
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-frei', 1, 'published', 'Vorlage für freie Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');
insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date, uses_health_data)
values ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'active', null,
  'vorlage-frei', 'Vorlage für freie Tests', 1, 1, 'exact', '{}', '2026-10-12', false);
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
values ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', 1, 1, 1, '2026-10-12', 'Ganzkörper', 'full_body', 50, 'Aufwärmen.',
  'Ausklingen.');
insert into public.planned_exercises (id, session_id, user_id, order_no, exercise_id, source_exercise_id,
  exercise_name_de, sets, reps_min, reps_max, duration_s, rest_s, rpe_target)
values ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', 1, 'frei-a', 'frei-a', 'Übung frei-a', 3, 8, 12, null, 90, 7);

-- ---------------------------------------------------------------------------------------------------------
-- Eingaben wie freeSessionLogFromInput (packages/core/src/log/free-session.ts)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.free_ex(p_exercise text default 'frei-a', p_name text default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'order_no', 1, 'planned_exercise_id', null, 'exercise_id', p_exercise,
    'exercise_name_de', coalesce(p_name, 'Übung ' || p_exercise), 'load_type', 'weight', 'status', 'done',
    'target_sets', null, 'reps_min', null, 'reps_max', null, 'target_reps', null, 'target_extra_set', null,
    'target_weight_kg', null, 'target_duration_s', null, 'target_rpe', null,
    'state_weight_kg', null, 'state_target_reps', null, 'state_extra_set', null, 'state_duration_s', null,
    'weight_confirmed', false, 'is_return', false,
    'sets', '[{"set_no": 1, "reps": 10, "weight_kg": 30, "duration_s": null, "rpe": null, "done": true}]'::jsonb
  )
$$;
create function pg_temp.free_strength(p_id text, p_write text, p_date date default '2026-10-15',
  p_exercises jsonb default null, p_notes text default 'GEHEIM-NOTIZ')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'planned_session_id', null,
    'planned_date', p_date, 'kind', 'strength', 'performed_on', p_date,
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 6, 'notes', p_notes,
    'name_de', 'Freie Kraft-Einheit', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-15T12:00:00+02:00',
    'exercises', coalesce(p_exercises, jsonb_build_array(pg_temp.free_ex())), 'cardio', null, 'is_free', true
  )
$$;
create function pg_temp.free_run(p_id text, p_write text, p_date date default '2026-10-15',
  p_modality text default 'run', p_name text default 'Lauf')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', null, 'planned_session_id', null,
    'planned_date', p_date, 'kind', 'endurance', 'performed_on', p_date,
    'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 3, 'notes', null,
    'name_de', p_name, 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-15T12:00:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', jsonb_build_object('modality', p_modality, 'duration_s', 1800, 'distance_m', 5000, 'elevation_m', null),
    'is_free', true
  )
$$;
create function pg_temp.error_of(p_sql text) returns text language plpgsql as $$
declare
  code text;
  msg text;
  detail text;
begin
  execute p_sql;
  return 'kein Fehler';
exception when others then
  get stacked diagnostics code = returned_sqlstate, msg = message_text, detail = pg_exception_detail;
  return code || ': ' || msg || coalesce(' / ' || nullif(detail, ''), '');
end;
$$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Spalte und Tabellen-Regel
-- ---------------------------------------------------------------------------------------------------------
select has_column('public', 'session_logs', 'is_free', 'session_logs.is_free vorhanden');
select col_not_null('public', 'session_logs', 'is_free', 'is_free ist not null');
select col_default_is('public', 'session_logs', 'is_free', 'false', 'is_free: Standard false (bestehende Einträge)');
select throws_ok(
  $$ insert into public.session_logs (user_id, planned_session_id, kind, performed_on, status, name_de, last_write_id,
       client_updated_at, is_free)
     values ('11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'strength', '2026-10-12',
       'completed', 'Freie Kraft-Einheit', gen_random_uuid(), now(), true) $$,
  '23514', null, 'Tabelle: freie Einheit nie mit geplanter Einheit (CHECK)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text)) $$,
  '42501', null, 'anon darf keine freie Einheit speichern');
select throws_ok($$ select public.recent_exercise_logs(2) $$, '42501', null, 'anon: recent_exercise_logs gesperrt');
select throws_ok($$ select count(*) from public.session_logs $$, '42501', null, 'anon liest keine Einträge');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ insert into public.session_logs (user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at, is_free)
     values ('11111111-1111-4111-8111-111111111111', 'strength', '2026-10-15', 'completed', 'Freie Kraft-Einheit',
       gen_random_uuid(), now(), true) $$,
  '42501', null, 'authenticated schreibt nicht direkt (nur über save_session_log)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Freie Einheit speichern
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.save_session_log(pg_temp.free_strength('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001')),
  '{"result": "ok", "id": "f0000000-0000-4000-8000-000000000001", "revision": 1}'::jsonb,
  'freie Kraft-Einheit heute: ok'
);
select results_eq(
  $$ select is_free, planned_session_id, name_de, is_intro_week, is_deload from public.session_logs
     where id = 'f0000000-0000-4000-8000-000000000001' $$,
  $$ values (true, null::uuid, 'Freie Kraft-Einheit'::text, false, false) $$,
  'gespeichert als frei, ohne geplante Einheit, Name aus der festen Liste'
);
select results_eq(
  $$ select exercise_id, planned_exercise_id, target_weight_kg, state_weight_kg, status::text from public.exercise_logs
     where session_log_id = 'f0000000-0000-4000-8000-000000000001' $$,
  $$ values ('frei-a'::text, null::uuid, null::numeric, null::numeric, 'done'::text) $$,
  'Übung ohne Planbezug, Vorgaben und Zustand'
);
select is(
  public.save_session_log(pg_temp.free_strength('f0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001')),
  '{"result": "ok", "id": "f0000000-0000-4000-8000-000000000001", "revision": 1}'::jsonb,
  'gleiche write_id erneut: ok, nichts doppelt'
);
select is((select count(*)::int from public.session_logs where user_id = '11111111-1111-4111-8111-111111111111'), 1,
  'erneut gesendet: ein Eintrag');

select is(
  public.save_session_log(pg_temp.free_run('f0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', '2026-10-01')) ->> 'result',
  'ok', 'freie Ausdauer genau 14 Tage zurück (01.10.): ok'
);
select results_eq(
  $$ select l.is_free, l.name_de, c.modality::text, c.duration_s from public.session_logs l
     join public.cardio_logs c on c.session_log_id = l.id where l.id = 'f0000000-0000-4000-8000-000000000002' $$,
  $$ values (true, 'Lauf'::text, 'run'::text, 1800) $$,
  'Ausdauer frei: Art, Dauer, Name'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_run(gen_random_uuid()::text, gen_random_uuid()::text, '2026-09-30')) $$),
  '22023: Das Datum liegt außerhalb des erlaubten Zeitraums.', '15 Tage zurück (30.09.): abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_run(gen_random_uuid()::text, gen_random_uuid()::text, '2026-10-16')) $$),
  '22023: Das Datum liegt außerhalb des erlaubten Zeitraums.', 'morgen (16.10.): abgelehnt – frei nie in der Zukunft'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_run(gen_random_uuid()::text,
    gen_random_uuid()::text, '2026-10-14'), '{planned_date}', '"2026-10-12"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'planned_date ≠ performed_on: abgelehnt'
);

-- Planbezug, Vorgaben, Name, Kennzeichen
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text, '2026-10-12'), '{planned_session_id}', '"a1000000-0000-4000-8000-000000000001"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei MIT planned_session_id: abgelehnt'
);
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000001'),
  'planned', 'geplante Einheit bleibt unverändert');
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text, '2026-10-12'), '{planned_session_id}', '"a1000000-0000-4000-8000-000000000099"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit erfundener planned_session_id: abgelehnt (nicht „verwaist“)'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(pg_temp.free_ex(), '{target_weight_kg}', '20')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit target_weight_kg: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(pg_temp.free_ex(), '{target_reps}', '10')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit target_reps: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(jsonb_set(pg_temp.free_ex(), '{state_weight_kg}', '20'),
      '{state_extra_set}', 'false')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit Progressions-Zustand: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(pg_temp.free_ex(), '{planned_exercise_id}',
      '"a2000000-0000-4000-8000-000000000001"')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit planned_exercise_id: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(pg_temp.free_ex(), '{status}', '"alternative"')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit Status „alternative“: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(jsonb_set(pg_temp.free_ex(), '{is_return}', 'true')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei mit Wiedereinstieg: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(pg_temp.free_ex('frei-a', 'Meine Lieblingsübung')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'Übungsname nicht aus der Bibliothek: abgelehnt (kein Freitext)'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_strength(gen_random_uuid()::text, gen_random_uuid()::text,
    p_exercises => jsonb_build_array(pg_temp.free_ex('frei-archiv')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'archivierte Übung: nicht für freie Einheiten'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text), '{name_de}', '"Mein Training"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'Name nicht aus der festen Liste: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_run(gen_random_uuid()::text, gen_random_uuid()::text,
    p_modality => 'bike', p_name => 'Lauf')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'Ausdauer-Name passt nicht zur Art: abgelehnt'
);
select is(
  public.save_session_log(pg_temp.free_run('f0000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003',
    p_modality => 'bike', p_name => 'Radfahrt')) ->> 'result',
  'ok', 'Rad mit Name „Radfahrt“: ok'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text), '{is_deload}', 'true')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei in der Erholungswoche gekennzeichnet: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text), '{is_intro_week}', 'true')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'frei als Einstiegswoche gekennzeichnet: abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text), '{is_free}', '"ja"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'is_free kein boolean: abgelehnt'
);
select ok(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(gen_random_uuid()::text,
    gen_random_uuid()::text), '{name_de}', '"Mein Training"')) $$) not like '%GEHEIM%',
  'Fehler ohne Notiz-Inhalt'
);

-- Ältere Fassung ohne is_free: wie bisher (verwaist bzw. ohne Planbezug), is_free = false.
select is(
  public.save_session_log(pg_temp.free_strength('f0000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004',
    '2026-10-13') - 'is_free') ->> 'result',
  'ok', 'Fassung ohne is_free (vor A1b): gültig'
);
select results_eq(
  $$ select is_free, name_de from public.session_logs where id = 'f0000000-0000-4000-8000-000000000004' $$,
  $$ values (false, 'Kraft-Einheit'::text) $$, 'ohne is_free: nicht frei, neutraler Name (wie bisher)'
);

-- Frei ↔ nicht frei nie umschaltbar
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(jsonb_set(pg_temp.free_strength(
    'f0000000-0000-4000-8000-000000000004', gen_random_uuid()::text, '2026-10-13'), '{base_revision}', '1'), '{notes}', '"neu"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'nicht freier Eintrag wird nicht zur freien Einheit'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.free_strength(
    'f0000000-0000-4000-8000-000000000001', gen_random_uuid()::text), '{base_revision}', '1') - 'is_free') $$),
  '22023: Ungültige Werte im Tagebuch.', 'freie Einheit wird nicht zum nicht freien Eintrag'
);
select is(
  public.save_session_log(jsonb_set(jsonb_set(pg_temp.free_strength('f0000000-0000-4000-8000-000000000001',
    'e0000000-0000-4000-8000-000000000005'), '{base_revision}', '1'), '{session_rpe}', '8')),
  '{"result": "ok", "id": "f0000000-0000-4000-8000-000000000001", "revision": 2}'::jsonb,
  'freie Einheit ändern (Revision 1 → 2): ok'
);

-- Nie stapeln gilt nur für geplante: geplante Einheit + zwei freie am selben Tag (12.10.).
select is(
  public.save_session_log(jsonb_build_object(
    'id', 'f0000000-0000-4000-8000-000000000010', 'write_id', gen_random_uuid(), 'base_revision', null,
    'planned_session_id', 'a1000000-0000-4000-8000-000000000001', 'planned_date', '2026-10-12', 'kind', 'strength',
    'performed_on', '2026-10-12', 'started_at', null, 'finished_at', null, 'status', 'completed', 'session_rpe', 7,
    'notes', null, 'name_de', 'Ganzkörper', 'is_intro_week', false, 'is_deload', false, 'source', 'manual',
    'client_updated_at', '2026-10-15T09:00:00+02:00', 'is_free', false,
    'exercises', jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid(), 'order_no', 1, 'planned_exercise_id', 'a2000000-0000-4000-8000-000000000001',
      'exercise_id', 'frei-a', 'exercise_name_de', 'Übung frei-a', 'load_type', 'weight', 'status', 'done',
      'target_sets', 3, 'reps_min', 8, 'reps_max', 12, 'target_reps', 10, 'target_extra_set', false,
      'target_weight_kg', 20, 'target_duration_s', null, 'target_rpe', 7,
      'state_weight_kg', 20, 'state_target_reps', 10, 'state_extra_set', false, 'state_duration_s', null,
      'weight_confirmed', false, 'is_return', false,
      'sets', '[{"set_no": 1, "reps": 10, "weight_kg": 20, "duration_s": null, "rpe": 8, "done": true}]'::jsonb)),
    'cardio', null)) ->> 'result',
  'ok', 'geplante Einheit am 12.10. nachgetragen (3 Tage zurück): ok'
);
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000001'),
  'completed', 'nachgetragene geplante Einheit ist erledigt');
select is(
  public.save_session_log(pg_temp.free_strength('f0000000-0000-4000-8000-000000000011', gen_random_uuid()::text,
    '2026-10-12', p_exercises => jsonb_build_array(pg_temp.free_ex('frei-b')))) ->> 'result',
  'ok', 'freie Einheit am Tag einer eingetragenen geplanten: ok (nie stapeln gilt nur für geplante)'
);
select is(
  public.save_session_log(pg_temp.free_run('f0000000-0000-4000-8000-000000000012', gen_random_uuid()::text,
    '2026-10-12')) ->> 'result',
  'ok', 'zweite freie Einheit am selben Tag: ok'
);

-- ---------------------------------------------------------------------------------------------------------
-- recent_exercise_logs ohne freie Einträge; Export enthält is_free
-- ---------------------------------------------------------------------------------------------------------
select is(
  (select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.recent_exercise_logs(2) -> 'session_logs') x),
  array['f0000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000010'],
  'recent_exercise_logs: nur nicht freie Einträge (freie Kraft-Einheiten fehlen)'
);
select ok(
  not exists (select 1 from jsonb_array_elements(public.recent_exercise_logs(10) -> 'session_logs') x
              where (x ->> 'is_free')::boolean),
  'recent_exercise_logs(10): kein freier Eintrag'
);
select is(
  (select count(*)::int from jsonb_array_elements(public.export_my_data() -> 'data' -> 'session_logs') x
   where x ? 'is_free'),
  (select count(*)::int from public.session_logs where user_id = '11111111-1111-4111-8111-111111111111'),
  'Export: jeder Eintrag enthält is_free'
);
select is(
  (select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.export_my_data() -> 'data' -> 'session_logs') x
   where (x ->> 'is_free')::boolean),
  array['f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002',
        'f0000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000011',
        'f0000000-0000-4000-8000-000000000012'],
  'Export: freie Einträge mit is_free = true'
);

-- ---------------------------------------------------------------------------------------------------------
-- Fremde Nutzer
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.session_logs), 0, 'B sieht keine Einträge von A (RLS)');
select is(
  jsonb_array_length(public.recent_exercise_logs(2) -> 'session_logs'), 0, 'B: recent_exercise_logs leer'
);
select isnt(
  public.save_session_log(pg_temp.free_strength('f0000000-0000-4000-8000-000000000001', gen_random_uuid()::text)) ->> 'id',
  'f0000000-0000-4000-8000-000000000001', 'B mit der id von A: neue id, A unberührt'
);
reset role;
select results_eq(
  $$ select user_id, revision, session_rpe from public.session_logs where id = 'f0000000-0000-4000-8000-000000000001' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, 2, 8::smallint) $$,
  'Eintrag von A unverändert (Revision 2 von A, B schreibt nie fremde Zeilen)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Tageslimit gilt auch für freie Einheiten (10 neue Einträge je Tag)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(
  (select count(*)::int from generate_series(1, 10) n
   where public.save_session_log(pg_temp.free_run(gen_random_uuid()::text, gen_random_uuid()::text)) ->> 'result' = 'ok'),
  10, 'C: 10 freie Einheiten an einem Tag: ok'
);
select is(
  pg_temp.error_of($$ select public.save_session_log(pg_temp.free_run(gen_random_uuid()::text, gen_random_uuid()::text)) $$),
  '54000: Heute wurden schon zu viele Trainings gespeichert.', 'C: die elfte freie Einheit: Tageslimit'
);

select * from finish();
rollback;
