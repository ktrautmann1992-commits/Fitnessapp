-- Phase 4 Etappe B (docs/PLAN-PHASE-4.md Abschnitte 3.4, 3.6, 3.7): Server-Funktionen des Trainingstagebuchs –
-- save_session_log (Feldliste, Idempotenz über write_id, Revision/conflict, bestehende id, nie stapeln,
-- Datumsfenster, Art, Übungen, verwaiste Einträge, Fehler ohne Detail), delete_session_log, close_missed_sessions,
-- recent_exercise_logs, revoke_health_data (behalten/löschen, eine Transaktion) und die Neutralisierung bei
-- abgelehnter Neu-Einwilligung (H-c).
-- „Heute“ ist fest Mittwoch, 07.10.2026: Montag dieser Woche 05.10., Sonntag 11.10.
begin;
create extension if not exists pgtap with schema extensions;
select plan(143);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Daten (als Datenbank-Eigentümer)
-- A: aktiver Plan MIT Gesundheitsbezug (SA1 Mo 05.10., SA2 Mi 07.10., SA3 Ausdauer Fr 09.10., SA4 Vorwoche Mo
--    28.09., SA5 nächste Woche) und ersetzter Plan OHNE Gesundheitsbezug (SA6 Di 06.10., SA7 21.09.).
-- B: aktiver Plan mit Gesundheitsbezug (SB1 Mi 07.10., SB2 Mo 05.10., SB3 Di 06.10.).
-- C: aktiver Plan mit Gesundheitsbezug (SC1 Mo 05.10.), ersetzter ohne (SC2 Di 06.10.).
-- D: Einträge für recent_exercise_logs.
-- ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array[
  '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']::uuid[]) u;
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
from (values ('uebung-a', 'published', 'weight'), ('uebung-b', 'published', 'weight'),
             ('uebung-halten', 'published', 'time'), ('uebung-archiv', 'archived', 'weight')) as v(id, status, load);
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date, uses_health_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-09-28', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-09-21', false),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', true),
  ('cccccccc-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', true),
  ('cccccccc-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', false);

insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id::uuid, plan::uuid, usr::uuid, 1, 1, 1, day::date, name, 'full_body', 50, 'Aufwärmen.', 'Ausklingen.'
from (values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-05', 'Ganzkörper sanft'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-07', 'Ganzkörper sanft'),
  ('a1000000-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-09-28', 'Ganzkörper sanft'),
  ('a1000000-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-12', 'Ganzkörper sanft'),
  ('a1000000-0000-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-10-06', 'Oberkörper'),
  ('a1000000-0000-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-09-21', 'Oberkörper'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-07', 'Ganzkörper sanft'),
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-05', 'Ganzkörper sanft'),
  ('b1000000-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-06', 'Ganzkörper sanft'),
  ('c1000000-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', '2026-10-05', 'Ganzkörper sanft'),
  ('c1000000-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', '2026-10-06', 'Oberkörper')
) as v(id, plan, usr, day, name);
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, kind, scheduled_on, name_de,
  endurance_modality, effort_target, estimated_minutes, warmup_de, cooldown_de)
values ('a1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111', 1, 1, 'endurance', '2026-10-09', 'Zügiges Gehen', 'walk', 3, 30,
  'Aufwärmen.', 'Ausklingen.');

insert into public.planned_exercises (id, session_id, user_id, order_no, exercise_id, source_exercise_id,
  exercise_name_de, sets, reps_min, reps_max, duration_s, rest_s, rpe_target)
select id::uuid, session::uuid, usr::uuid, ord, ex, ex, 'Übung ' || ex, 3,
  case when ex = 'uebung-halten' then null else 8 end, case when ex = 'uebung-halten' then null else 12 end,
  case when ex = 'uebung-halten' then 30 end, 90, 7
from (values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, 'uebung-halten'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a'),
  ('a2000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a'),
  ('a2000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 'uebung-a'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 1, 'uebung-a'),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 1, 'uebung-a'),
  ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 1, 'uebung-a'),
  ('c2000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', '33333333-3333-4333-8333-333333333333', 1, 'uebung-a')
) as v(id, session, usr, ord, ex);

-- ---------------------------------------------------------------------------------------------------------
-- Eingaben wie sessionLogPayloadSchema (packages/core/src/log/schemas.ts)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.weight_sets(p_count integer default 3, p_reps integer default 10, p_kg numeric default 20)
returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('set_no', n, 'reps', p_reps, 'weight_kg', p_kg, 'duration_s', null,
    'rpe', 8, 'done', true) order by n)
  from generate_series(1, p_count) n
$$;
create function pg_temp.ex(p_planned text, p_exercise text default 'uebung-a', p_status text default 'done',
  p_order integer default 1)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'order_no', p_order, 'planned_exercise_id', p_planned, 'exercise_id', p_exercise,
    'exercise_name_de', 'Übung ' || p_exercise, 'load_type', 'weight', 'status', p_status,
    'target_sets', 3, 'reps_min', 8, 'reps_max', 12, 'target_reps', 10, 'target_extra_set', false,
    'target_weight_kg', 20, 'target_duration_s', null, 'target_rpe', 7,
    'state_weight_kg', 20, 'state_target_reps', 10, 'state_extra_set', false, 'state_duration_s', null,
    'weight_confirmed', false, 'is_return', false,
    'sets', case when p_status = 'skipped' then '[]'::jsonb else pg_temp.weight_sets() end
  )
$$;
create function pg_temp.hold(p_planned text, p_order integer default 2) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'order_no', p_order, 'planned_exercise_id', p_planned, 'exercise_id', 'uebung-halten',
    'exercise_name_de', 'Übung halten', 'load_type', 'time', 'status', 'done',
    'target_sets', 2, 'reps_min', null, 'reps_max', null, 'target_reps', null, 'target_extra_set', null,
    'target_weight_kg', null, 'target_duration_s', 30, 'target_rpe', 7,
    'state_weight_kg', null, 'state_target_reps', null, 'state_extra_set', false, 'state_duration_s', 30,
    'weight_confirmed', false, 'is_return', false,
    'sets', '[{"set_no": 1, "reps": null, "weight_kg": null, "duration_s": 30, "rpe": null, "done": true},
              {"set_no": 2, "reps": null, "weight_kg": null, "duration_s": 35, "rpe": null, "done": true}]'::jsonb
  )
$$;
create function pg_temp.log(p_id text, p_planned text, p_planned_date date, p_performed date, p_exercises jsonb,
  p_write text, p_base integer default null, p_kind text default 'strength', p_cardio jsonb default null,
  p_notes text default 'Technik gut')
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'write_id', p_write, 'base_revision', p_base, 'planned_session_id', p_planned,
    'planned_date', p_planned_date, 'kind', p_kind, 'performed_on', p_performed,
    'started_at', '2026-10-05T17:00:00+02:00', 'finished_at', '2026-10-05T18:00:00+02:00',
    'status', 'completed', 'session_rpe', 7, 'notes', p_notes, 'name_de', 'Ganzkörper sanft',
    'is_intro_week', false, 'is_deload', false, 'source', 'manual', 'client_updated_at', '2026-10-05T18:00:00+02:00',
    'exercises', p_exercises, 'cardio', p_cardio
  )
$$;
-- Ein gültiger Eintrag für SA6 (ersetzter Plan ohne Gesundheitsbezug, Di 06.10.), Grundlage der Fehler-Tests.
create function pg_temp.sa6(p_write text default 'f6000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
  select pg_temp.log('a3000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000006', '2026-10-06',
    '2026-10-06', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000006')), p_write,
    p_notes => 'GEHEIM-NOTIZ')
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
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select public.save_session_log('{}'::jsonb) $$, '42501', null, 'anon darf nicht speichern');
select throws_ok($$ select public.revoke_health_data(false) $$, '42501', null, 'anon darf nicht widerrufen');
select throws_ok($$ select public.close_missed_sessions() $$, '42501', null, 'anon darf nicht streichen');
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.save_session_log('{}'::jsonb) $$, '42501', 'Nicht angemeldet.', 'ohne Nutzer-ID: Fehler');
select throws_ok($$ select public.revoke_health_data(false) $$, '42501', 'Nicht angemeldet.', 'Widerruf ohne Nutzer-ID: Fehler');

-- ---------------------------------------------------------------------------------------------------------
-- Erster Eintrag, Idempotenz (R4), Ersetzen mit Revision (W3)
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
create temp table l1 as
select pg_temp.log('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '2026-10-05',
  '2026-10-05', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000001'),
    pg_temp.hold('a2000000-0000-4000-8000-000000000002')), 'f1000000-0000-4000-8000-000000000001') as p;

select is(
  public.save_session_log((select p from l1)),
  '{"result": "ok", "id": "a3000000-0000-4000-8000-000000000001", "revision": 1}'::jsonb,
  'erster Eintrag: ok, id vom Gerät, revision 1'
);
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000001'),
  'completed', 'geplante Einheit ist completed');
select results_eq(
  $$ select from_health_plan, name_de, revision from public.session_logs where id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values (true, 'Ganzkörper sanft'::text, 1) $$,
  'from_health_plan setzt der Server aus dem Plan (mit gültiger Einwilligung)'
);
select results_eq(
  $$ select exercise_id, target_weight_kg, state_weight_kg, target_duration_s from public.exercise_logs
     where session_log_id = 'a3000000-0000-4000-8000-000000000001' order by order_no $$,
  $$ values ('uebung-a'::text, 20.00::numeric, 20.00::numeric, null::smallint),
            ('uebung-halten', null, null, 30::smallint) $$,
  'Übungen mit Vorgabe und Zustand gespeichert'
);
select is((select count(*)::int from public.set_logs), 5, 'Sätze gespeichert (3 + 2)');

select is(
  public.save_session_log((select p from l1)),
  '{"result": "ok", "id": "a3000000-0000-4000-8000-000000000001", "revision": 1}'::jsonb,
  'Antwort verloren, erneut gesendet (gleiche write_id): ok mit aktueller revision'
);
select results_eq(
  $$ select count(*)::int from public.session_logs where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (1) $$, 'erneut gesendet: nichts verdoppelt'
);
select is((select count(*)::int from public.exercise_logs), 2, 'erneut gesendet: Übungen nicht ersetzt');

-- Neue Fassung: andere Geräte-id, base_revision 1 → bestehende id bleibt, revision 2.
select is(
  public.save_session_log(jsonb_set(jsonb_set(jsonb_set(jsonb_set((select p from l1),
    '{id}', '"a3000000-0000-4000-8000-000000000099"'), '{write_id}', '"f1000000-0000-4000-8000-000000000002"'),
    '{base_revision}', '1'), '{notes}', '"Neu"') #- '{exercises,1}'),
  '{"result": "ok", "id": "a3000000-0000-4000-8000-000000000001", "revision": 2}'::jsonb,
  'Ersetzen über planned_session_id: bestehende id, revision 2'
);
select results_eq(
  $$ select (select count(*)::int from public.exercise_logs), (select count(*)::int from public.set_logs),
            (select notes from public.session_logs where id = 'a3000000-0000-4000-8000-000000000001') $$,
  $$ values (1, 3, 'Neu'::text) $$,
  'ganze Einheit ersetzt (Übungen, Sätze, Notiz)'
);
select is(
  public.save_session_log(jsonb_set(jsonb_set((select p from l1), '{write_id}', '"f1000000-0000-4000-8000-000000000003"'),
    '{base_revision}', '1')),
  '{"result": "conflict", "id": "a3000000-0000-4000-8000-000000000001", "revision": 2}'::jsonb,
  'veraltete base_revision → conflict mit aktueller revision'
);
select is(
  public.save_session_log(jsonb_set((select p from l1), '{write_id}', '"f1000000-0000-4000-8000-000000000004"')) ->> 'result',
  'conflict', 'base_revision null bei bestehendem Eintrag → conflict'
);
select is((select notes from public.session_logs where id = 'a3000000-0000-4000-8000-000000000001'), 'Neu',
  'conflict ändert nichts');
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
    'f2000000-0000-4000-8000-000000000001', 5)),
  '{"result": "conflict", "id": null, "revision": null}'::jsonb,
  'base_revision ohne gespeicherten Eintrag (anderswo gelöscht) → conflict'
);

-- ---------------------------------------------------------------------------------------------------------
-- Feldliste (= .strict()) und Typen
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ select public.save_session_log(pg_temp.sa6() || '{"from_health_plan": false}') $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'from_health_plan vom Gerät wird abgelehnt (S1)');
select throws_ok($$ select public.save_session_log(pg_temp.sa6() || '{"user_id": "22222222-2222-4222-8222-222222222222"}') $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'user_id vom Gerät wird abgelehnt');
select throws_ok($$ select public.save_session_log(pg_temp.sa6() || '{"revision": 9}') $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'revision vom Gerät wird abgelehnt');
select throws_ok($$ select public.save_session_log(pg_temp.sa6() - 'notes') $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'fehlendes Feld wird abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{is_deload}', '"true"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'falscher JSON-Typ wird abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,reason}', '"pain"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'kein Grund-Feld bei Übungen (S3)');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,heart_rate}', '120')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'keine Herzfrequenz in Sätzen (S2)');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{cardio}', '{"modality": "run", "duration_s": 600, "distance_m": null, "elevation_m": null, "heart_rate": 150}')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Kraft mit Ausdauer bzw. Herzfrequenz wird abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Nie stapeln, Datumsfenster (W2), Art
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
       '2026-10-07', '2026-10-05', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
       'f2000000-0000-4000-8000-000000000002')) $$,
  '23505', 'An diesem Tag ist schon eine Einheit eingetragen.', 'nie zwei geplante Einheiten am selben Tag'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
       '2026-10-07', '2026-10-09', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
       'f2000000-0000-4000-8000-000000000002')) $$,
  '22023', 'Das Datum liegt außerhalb des erlaubten Zeitraums.', 'heute + 2 abgelehnt'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
       '2026-10-07', '2026-10-03', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
       'f2000000-0000-4000-8000-000000000002')) $$,
  '22023', 'Das Datum liegt außerhalb des erlaubten Zeitraums.', 'zwei Tage vor der Woche abgelehnt'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000005',
       '2026-10-12', '2026-10-08', jsonb_build_array(pg_temp.ex(null)), 'f5000000-0000-4000-8000-000000000001')) $$,
  '22023', 'Das Datum liegt außerhalb des erlaubten Zeitraums.', 'Einheit der nächsten Woche nicht vorziehen (Woche − 1 Tag ist Sonntag)'
);
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
    'f2000000-0000-4000-8000-000000000003')) ->> 'result',
  'ok', 'SA2 heute eingetragen'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003',
       '2026-10-09', '2026-10-08', jsonb_build_array(pg_temp.ex(null)), 'f3000000-0000-4000-8000-000000000001')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Art passt nicht (Kraft-Eintrag zu Ausdauer-Einheit)'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003',
       '2026-10-09', '2026-10-08', jsonb_build_array(pg_temp.ex(null)), 'f3000000-0000-4000-8000-000000000001',
       p_kind => 'endurance', p_cardio => '{"modality": "walk", "duration_s": 1800, "distance_m": 5000, "elevation_m": null}')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Ausdauer mit Übungen abgelehnt'
);
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000003',
    '2026-10-09', '2026-10-08', '[]', 'f3000000-0000-4000-8000-000000000001',
    p_kind => 'endurance', p_cardio => '{"modality": "walk", "duration_s": 1800, "distance_m": 5000, "elevation_m": null}')) ->> 'result',
  'ok', 'Ausdauer heute + 1 (Grenze) eingetragen'
);
select results_eq(
  $$ select c.modality::text, c.duration_s, c.distance_m, s.name_de, s.from_health_plan
     from public.cardio_logs c join public.session_logs s on s.id = c.session_log_id $$,
  $$ values ('walk'::text, 1800, 5000, 'Ganzkörper sanft'::text, true) $$,
  'Ausdauer-Eintrag gespeichert (ohne Herzfrequenz)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Übungen
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,exercise_id}', '"gibt-es-nicht"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'unbekannte Übung abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(jsonb_set(pg_temp.sa6(), '{exercises,0,exercise_id}', '"uebung-archiv"'), '{exercises,0,planned_exercise_id}', 'null')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'archivierte Übung ohne eigenen Plan/Eintrag abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,load_type}', '"time"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Belastungsart passt nicht zur Übung');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,planned_exercise_id}', '"a2000000-0000-4000-8000-000000000003"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'geplante Übung einer anderen Einheit abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,status}', '"alternative"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Alternative = dieselbe Übung abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,exercise_id}', '"uebung-b"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'andere Übung nur als Alternative');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,status}', '"skipped"')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', '„nicht gemacht“ mit Sätzen abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets}', '[]')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'gemacht ohne Satz abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,duration_s}', '30')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'Dauer bei Gewichtsübung abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,reps}', 'null')) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'abgehakter Gewichtssatz ohne Wdh. abgelehnt');
select throws_ok($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets}', pg_temp.weight_sets(11))) $$,
  '22023', 'Ungültige Werte im Tagebuch.', 'mehr als 10 Sätze abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- Fehler ohne Zeileninhalt (W10): fester Text, gleicher Fehlercode, keine Notiz, keine Werte
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,reps}', '101')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'CHECK (101 Wdh.): ohne Detail, ohne Notiz und Werte');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{notes}', to_jsonb('GEHEIM-NOTIZ ' || repeat('x', 268)))) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Notiz mit 281 Zeichen: ohne Notiz in der Meldung');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,weight_kg}', '22.555')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Gewicht mit 3 Nachkommastellen abgelehnt');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,rpe}', '7.25')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Satz-RPE nur in 0,5er-Schritten (vor der Rundung geprüft)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,target_rpe}', '7.49')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Ziel-RPE 7,49 wird nicht still zu 7,5');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,sets,0,weight_kg}', '500.5')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Gewicht über 500 kg abgelehnt');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{session_rpe}', '11')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Belastungsempfinden über 10 abgelehnt');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,order_no}', '13')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Übung Nr. 13 abgelehnt');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises}',
    jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000006'), pg_temp.ex(null)))) $$),
  '23505: Ungültige Werte im Tagebuch.', 'doppelte Reihenfolge: ohne Schlüsselwerte');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{id}', '"keine-uuid"')) $$),
  '22P02: Ungültige Werte im Tagebuch.', 'ungültige id ohne Wert in der Meldung');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{performed_on}', '"2026-02-30"')) $$),
  '22008: Ungültige Werte im Tagebuch.', 'ungültiges Datum');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{started_at}', '"gestern abend"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'ungültiger Zeitstempel');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{started_at}', '"2026-10-06T17:00:00+99:00"')) $$),
  '22009: Ungültige Werte im Tagebuch.', 'Zeitzone +99:00: ganze Fehlerklasse 22 ohne Wert in der Meldung (S1)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{client_updated_at}', '"-infinity"')) $$),
  '22023: Ungültige Werte im Tagebuch.', '-infinity abgelehnt (K2)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{finished_at}', '"2026-10-06T18:00:00"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'Zeitstempel ohne Zeitzone abgelehnt (K2)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{performed_on}', '"epoch"')) $$),
  '22023: Ungültige Werte im Tagebuch.', 'Datum „epoch“ abgelehnt (K2)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises}',
    jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000006'), pg_temp.ex('a2000000-0000-4000-8000-000000000006', p_order => 2)))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'geplante Übung zweimal abgelehnt (K5)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises}',
    jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000006'),
      jsonb_set(pg_temp.ex(null, p_order => 2), '{id}', '"a5000000-0000-4000-8000-000000000001"'),
      jsonb_set(pg_temp.ex(null, p_order => 3), '{id}', '"a5000000-0000-4000-8000-000000000001"')))) $$),
  '22023: Ungültige Werte im Tagebuch.', 'doppelte Übungs-ids abgelehnt (K5)');
select is(pg_temp.error_of($$ select public.save_session_log(jsonb_set(pg_temp.sa6(), '{exercises,0,state_extra_set}', 'null')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Zustand unvollständig');
select is(pg_temp.error_of($$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000003',
    '2026-10-09', '2026-10-08', '[]', 'f7000000-0000-4000-8000-000000000001', 1, 'endurance',
    '{"modality": "walk", "duration_s": 59, "distance_m": null, "elevation_m": null}')) $$),
  '23514: Ungültige Werte im Tagebuch.', 'Ausdauer unter 1 Minute');
select is_empty($$ select 1 from public.session_logs where id = 'a3000000-0000-4000-8000-000000000006' $$,
  'abgelehnte Einträge hinterlassen nichts');

-- ---------------------------------------------------------------------------------------------------------
-- Plan ohne Gesundheitsbezug: Alternative und zusätzliche Halteübung; Zeit gekappt; Notiz mit 280 Emojis
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.save_session_log(jsonb_set(jsonb_set(jsonb_set(jsonb_set(pg_temp.sa6(), '{exercises}', jsonb_build_array(
      pg_temp.ex('a2000000-0000-4000-8000-000000000006', 'uebung-b', 'alternative'), pg_temp.hold(null))),
    '{client_updated_at}', '"2030-01-01T00:00:00Z"'), '{notes}', to_jsonb(repeat('😀', 280))), '{name_de}', '"Oberkörper"')),
  '{"result": "ok", "id": "a3000000-0000-4000-8000-000000000006", "revision": 1}'::jsonb,
  'Alternative und zusätzliche Halteübung gespeichert'
);
select results_eq(
  $$ select status::text, exercise_id, planned_exercise_id, target_weight_kg from public.exercise_logs
     where session_log_id = 'a3000000-0000-4000-8000-000000000006' order by order_no $$,
  $$ values ('alternative'::text, 'uebung-b'::text, 'a2000000-0000-4000-8000-000000000006'::uuid, 20.00::numeric),
            ('done', 'uebung-halten', null, null) $$,
  'Alternative: tatsächliche Übung + Verweis auf die geplante, eigene Vorgabe'
);
select results_eq(
  $$ select from_health_plan, name_de, client_updated_at <= now(), char_length(notes)
     from public.session_logs where id = 'a3000000-0000-4000-8000-000000000006' $$,
  $$ values (false, 'Oberkörper'::text, true, 280) $$,
  'ohne Gesundheitsbezug: Name bleibt; Zeit in der Zukunft auf now() gekappt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Verwaiste Einträge (B4, H-a): erfundene oder fremde Einheit = gleich behandelt
-- ---------------------------------------------------------------------------------------------------------
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000004', 'deadbeef-0000-4000-8000-000000000001',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
    'f4000000-0000-4000-8000-000000000001')),
  '{"result": "orphaned", "id": "a3000000-0000-4000-8000-000000000004", "revision": 1}'::jsonb,
  'erfundene Einheit: gespeichert als orphaned'
);
select results_eq(
  $$ select s.planned_session_id, s.name_de, s.from_health_plan, e.planned_exercise_id, e.target_sets, e.target_weight_kg,
            e.target_rpe, e.state_weight_kg, e.state_extra_set, (select count(*)::int from public.set_logs x where x.exercise_log_id = e.id)
     from public.session_logs s join public.exercise_logs e on e.session_log_id = s.id
     where s.id = 'a3000000-0000-4000-8000-000000000004' $$,
  $$ values (null::uuid, 'Kraft-Einheit'::text, false, null::uuid, null::smallint, null::numeric, null::numeric,
             null::numeric, null::boolean, 3) $$,
  'verwaist: ohne Verweis, neutraler Name, ohne Vorgabe und Zustand, Ist-Werte bleiben'
);
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000003',
    '2026-10-06', '2026-10-06', jsonb_build_array(pg_temp.ex('b2000000-0000-4000-8000-000000000003')),
    'f8000000-0000-4000-8000-000000000001')),
  '{"result": "orphaned", "id": "a3000000-0000-4000-8000-000000000008", "revision": 1}'::jsonb,
  'fremde Einheit: gleiche Antwort wie erfundene (H-a)'
);
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000004', 'deadbeef-0000-4000-8000-000000000001',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000003')),
    'f4000000-0000-4000-8000-000000000001')) ->> 'result',
  'orphaned', 'verwaist erneut gesendet: orphaned'
);
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000009', 'deadbeef-0000-4000-8000-000000000002',
       '2026-09-21', '2026-10-07', jsonb_build_array(pg_temp.ex(null)), 'f9000000-0000-4000-8000-000000000001')) $$,
  '22023', 'Das Datum liegt außerhalb des erlaubten Zeitraums.', 'verwaist: Datumsfenster gegen das mitgesendete Datum'
);

-- ---------------------------------------------------------------------------------------------------------
-- close_missed_sessions (nur aktiver Plan, nur nach Wochenende, nur planned) und skipped → completed (W8)
-- ---------------------------------------------------------------------------------------------------------
select is(public.close_missed_sessions(), 1, 'eine verpasste Einheit aus der Vorwoche gestrichen');
select is(public.close_missed_sessions(), 0, 'idempotent');
reset role;
select results_eq(
  $$ select id, status::text from public.planned_sessions where user_id = '11111111-1111-4111-8111-111111111111' order by id $$,
  $$ values ('a1000000-0000-4000-8000-000000000001'::uuid, 'completed'::text),
            ('a1000000-0000-4000-8000-000000000002', 'completed'), ('a1000000-0000-4000-8000-000000000003', 'completed'),
            ('a1000000-0000-4000-8000-000000000004', 'skipped'), ('a1000000-0000-4000-8000-000000000005', 'planned'),
            ('a1000000-0000-4000-8000-000000000006', 'completed'), ('a1000000-0000-4000-8000-000000000007', 'planned') $$,
  'nur SA4 gestrichen; ersetzter Plan (SA7), laufende und nächste Woche unberührt'
);
select is((select status::text from public.planned_sessions where id = 'b1000000-0000-4000-8000-000000000003'),
  'planned', 'fremde Einheit bleibt trotz verwaistem Eintrag unberührt');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000004',
    '2026-09-28', '2026-10-04', jsonb_build_array(pg_temp.ex('a2000000-0000-4000-8000-000000000004')),
    'fa000000-0000-4000-8000-000000000001')) ->> 'result',
  'ok', 'gestrichene Einheit nachgetragen (Sonntag, Woche + 0)'
);
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000004'),
  'completed', 'skipped → completed');

-- ---------------------------------------------------------------------------------------------------------
-- delete_session_log (R4)
-- ---------------------------------------------------------------------------------------------------------
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000002', 2),
  '{"result": "conflict", "id": "a3000000-0000-4000-8000-000000000002", "revision": 1}'::jsonb,
  'Löschen mit falscher base_revision → conflict');
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000002', 1) ->> 'result', 'ok', 'Löschen mit passender base_revision');
select is_empty($$ select 1 from public.exercise_logs where session_log_id = 'a3000000-0000-4000-8000-000000000002' $$,
  'Löschen: Übungen per Kaskade weg');
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000002'),
  'planned', 'Woche läuft: Einheit wieder planned');
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000010', 1) ->> 'result', 'ok', 'Eintrag der Vorwoche gelöscht');
select is((select status::text from public.planned_sessions where id = 'a1000000-0000-4000-8000-000000000004'),
  'skipped', 'Woche vorbei: Einheit wieder skipped');
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000002', 1) ->> 'result', 'ok', 'schon gelöscht: ok (idempotent)');

-- ---------------------------------------------------------------------------------------------------------
-- B: fremde Einträge unberührt; vergebene id → neue id vom Server
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(public.delete_session_log('a3000000-0000-4000-8000-000000000001', 2) ->> 'result', 'ok',
  'B: Löschen eines fremden Eintrags meldet nichts Unterscheidbares');
select isnt(
  public.save_session_log(pg_temp.log('a3000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('b2000000-0000-4000-8000-000000000001')),
    'fb000000-0000-4000-8000-000000000001')) ->> 'id',
  'a3000000-0000-4000-8000-000000000001', 'B: vergebene id → der Server vergibt eine neue'
);
select is(
  public.save_session_log(pg_temp.log('b3000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002',
    '2026-10-05', '2026-10-05', jsonb_build_array(pg_temp.ex('b2000000-0000-4000-8000-000000000002')),
    'fb000000-0000-4000-8000-000000000002')) ->> 'result',
  'ok', 'B: zweiter Eintrag aus dem Gesundheits-Plan'
);
reset role;
select results_eq(
  $$ select notes, revision from public.session_logs where id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values ('Neu'::text, 2) $$, 'Eintrag von A unverändert'
);

-- ---------------------------------------------------------------------------------------------------------
-- recent_exercise_logs (W4, R1): Einträge von D direkt angelegt
-- uebung-a: zählend 14.09., 21.09., 28.09.; Wiedereinstieg 30.09.; Erholungswoche 05.10. (neuester)
-- uebung-halten: nur Einstiegswoche 07.09. und 08.09.; uebung-b: nur „nicht gemacht“
-- ---------------------------------------------------------------------------------------------------------
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, is_intro_week, is_deload,
  last_write_id, client_updated_at)
values
  ('d3000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-14', 'completed', 'Kraft-Einheit', false, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-21', 'completed', 'Kraft-Einheit', false, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-28', 'completed', 'Kraft-Einheit', false, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'strength', '2026-10-05', 'completed', 'Kraft-Einheit', false, true, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000005', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-07', 'completed', 'Kraft-Einheit', true, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000006', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-08', 'completed', 'Kraft-Einheit', true, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000007', '44444444-4444-4444-8444-444444444444', 'strength', '2026-10-06', 'partial', 'Kraft-Einheit', false, false, gen_random_uuid(), now()),
  ('d3000000-0000-4000-8000-000000000008', '44444444-4444-4444-8444-444444444444', 'strength', '2026-09-30', 'completed', 'Kraft-Einheit', false, false, gen_random_uuid(), now());
insert into public.exercise_logs (id, session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type, status, is_return)
values
  ('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 1, 'uebung-a', 'Übung A', 'weight', 'done', false),
  ('d4000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 1, 'uebung-a', 'Übung A', 'weight', 'done', false),
  ('d4000000-0000-4000-8000-000000000003', 'd3000000-0000-4000-8000-000000000003', '44444444-4444-4444-8444-444444444444', 1, 'uebung-a', 'Übung A', 'weight', 'done', false),
  ('d4000000-0000-4000-8000-000000000004', 'd3000000-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 1, 'uebung-a', 'Übung A', 'weight', 'done', false),
  ('d4000000-0000-4000-8000-000000000005', 'd3000000-0000-4000-8000-000000000005', '44444444-4444-4444-8444-444444444444', 1, 'uebung-halten', 'Halten', 'time', 'done', false),
  ('d4000000-0000-4000-8000-000000000006', 'd3000000-0000-4000-8000-000000000006', '44444444-4444-4444-8444-444444444444', 1, 'uebung-halten', 'Halten', 'time', 'done', false),
  ('d4000000-0000-4000-8000-000000000007', 'd3000000-0000-4000-8000-000000000007', '44444444-4444-4444-8444-444444444444', 1, 'uebung-b', 'Übung B', 'weight', 'skipped', false),
  ('d4000000-0000-4000-8000-000000000008', 'd3000000-0000-4000-8000-000000000008', '44444444-4444-4444-8444-444444444444', 1, 'uebung-a', 'Übung A', 'weight', 'done', true);
insert into public.set_logs (exercise_log_id, user_id, set_no, reps, weight_kg, duration_s, done)
select el.id, el.user_id, 1, case when el.load_type = 'weight' then 10 end, case when el.load_type = 'weight' then 20 end,
  case when el.load_type = 'time' then 30 end, true
from public.exercise_logs el where el.user_id = '44444444-4444-4444-8444-444444444444' and el.status <> 'skipped';

set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(
  (select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.recent_exercise_logs() -> 'exercise_logs') x),
  array['d4000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000003',
        'd4000000-0000-4000-8000-000000000004', 'd4000000-0000-4000-8000-000000000006'],
  'je Übung: zwei neueste zählende + neuester überhaupt; ohne zählenden der neueste Einstiegswochen-Eintrag'
);
select results_eq(
  $$ select jsonb_array_length(r -> 'session_logs'), jsonb_array_length(r -> 'set_logs')
     from (select public.recent_exercise_logs() r) t $$,
  $$ values (4, 4) $$, 'passende Einheiten und Sätze dazu'
);
select is(
  (select array_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(public.recent_exercise_logs(1) -> 'exercise_logs') x),
  array['d4000000-0000-4000-8000-000000000003', 'd4000000-0000-4000-8000-000000000004',
        'd4000000-0000-4000-8000-000000000006'],
  'p_per_exercise = 1'
);
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select ok(position('d4000000' in public.recent_exercise_logs()::text) = 0, 'A sieht nichts von D (RLS)');
-- S5: vergebene Übungs-id → der Server nennt die neue in der Antwort.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select results_eq(
  $$ select r ->> 'result', jsonb_object_keys(r -> 'exercise_ids'),
            (r -> 'exercise_ids' ->> 'd4000000-0000-4000-8000-000000000001') <> 'd4000000-0000-4000-8000-000000000001'
     from (select public.save_session_log(pg_temp.log('d3000000-0000-4000-8000-000000000020', null, '2026-10-07', '2026-10-07',
       jsonb_build_array(jsonb_set(pg_temp.ex(null), '{id}', '"d4000000-0000-4000-8000-000000000001"')),
       'fd000000-0000-4000-8000-000000000020')) r) t $$,
  $$ values ('ok'::text, 'd4000000-0000-4000-8000-000000000001'::text, true) $$,
  'vergebene Übungs-id: neue id in exercise_ids'
);
select ok(
  not (public.save_session_log(pg_temp.log('d3000000-0000-4000-8000-000000000021', null, '2026-10-06', '2026-10-06',
    jsonb_build_array(pg_temp.ex(null)), 'fd000000-0000-4000-8000-000000000021')) ? 'exercise_ids'),
  'ohne neu vergebene ids kein Feld exercise_ids'
);
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data, „Tagebuch behalten“ (S1, Wächter B1): A
-- ---------------------------------------------------------------------------------------------------------
select throws_ok($$ select public.revoke_health_data(null) $$, '22023', 'Ungültige Eingabe.', 'Widerruf ohne Wahl abgelehnt');
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft und behält das Tagebuch');
reset role;
select results_eq(
  $$ select id, planned_session_id, name_de, from_health_plan, notes from public.session_logs
     where user_id = '11111111-1111-4111-8111-111111111111' and id in ('a3000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000003')
     order by id $$,
  $$ values ('a3000000-0000-4000-8000-000000000001'::uuid, null::uuid, 'Kraft-Einheit'::text, false, 'Neu'::text),
            ('a3000000-0000-4000-8000-000000000003', null, 'Ausdauer-Einheit', false, 'Technik gut') $$,
  'Einträge aus dem Gesundheits-Plan: ohne Varianten-Name und Verweis, Notiz bleibt'
);
select is(
  (select count(*)::int from public.exercise_logs e join public.session_logs s on s.id = e.session_log_id
   where s.id = 'a3000000-0000-4000-8000-000000000001'
     and num_nonnulls(e.target_sets, e.reps_min, e.reps_max, e.target_reps, e.target_extra_set, e.target_weight_kg,
       e.target_duration_s, e.target_rpe, e.state_weight_kg, e.state_target_reps, e.state_extra_set, e.state_duration_s) = 0),
  1, 'keine Vorgabe und kein Zustand mehr'
);
select results_eq(
  $$ select count(*)::int, sum(st.weight_kg) from public.set_logs st join public.exercise_logs e on e.id = st.exercise_log_id
     where e.session_log_id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values (3, 60.00::numeric) $$, 'Ist-Werte bleiben'
);
select is((select duration_s from public.cardio_logs where session_log_id = 'a3000000-0000-4000-8000-000000000003'), 1800,
  'Ausdauer-Ist-Werte bleiben');
select results_eq(
  $$ select s.name_de, s.planned_session_id, e.target_weight_kg from public.session_logs s
     join public.exercise_logs e on e.session_log_id = s.id and e.order_no = 1
     where s.id = 'a3000000-0000-4000-8000-000000000006' $$,
  $$ values ('Oberkörper'::text, 'a1000000-0000-4000-8000-000000000006'::uuid, 20.00::numeric) $$,
  'Eintrag aus Plan ohne Gesundheitsbezug unverändert'
);
select results_eq(
  $$ select (select count(*)::int from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.consents where user_id = '11111111-1111-4111-8111-111111111111'
               and consent_type = 'health_data' and revoked_at is null) $$,
  $$ values (1, 0) $$, 'Gesundheits-Plan gelöscht, Einwilligung widerrufen'
);
select results_eq(
  $$ select count(*)::int, bool_and(from_health_plan) from public.session_logs where user_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values (2, true) $$, 'Einträge von B unberührt'
);
-- Zweites Gerät sendet danach eine Fassung mit Vorgaben (Restrisiko R3): wird verwaist und ohne Vorgaben gespeichert.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(
  public.save_session_log(jsonb_set(jsonb_set((select p from l1), '{write_id}', '"f1000000-0000-4000-8000-000000000009"'),
    '{base_revision}', '2')),
  '{"result": "orphaned", "id": "a3000000-0000-4000-8000-000000000001", "revision": 3}'::jsonb,
  'nach Widerruf gesendete Fassung: orphaned, gleiche id'
);
select is(
  (select count(*)::int from public.exercise_logs where session_log_id = 'a3000000-0000-4000-8000-000000000001'
     and num_nonnulls(target_weight_kg, state_weight_kg, target_duration_s, state_duration_s) > 0),
  0, 'und ohne Vorgaben gespeichert'
);

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf mit „auch löschen“ (R3): C – eine Transaktion, Abbruch lässt alles unverändert
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(
  public.save_session_log(pg_temp.log('c3000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
    '2026-10-05', '2026-10-05', jsonb_build_array(pg_temp.ex('c2000000-0000-4000-8000-000000000001')),
    'fc000000-0000-4000-8000-000000000001')) ->> 'result', 'ok', 'C: Eintrag aus Gesundheits-Plan');
select is(
  public.save_session_log(pg_temp.log('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
    '2026-10-06', '2026-10-06', jsonb_build_array(pg_temp.ex('c2000000-0000-4000-8000-000000000002')),
    'fc000000-0000-4000-8000-000000000002')) ->> 'result', 'ok', 'C: Eintrag aus Plan ohne Gesundheitsbezug');

reset role;
create function pg_temp.fail_revoke() returns trigger language plpgsql as $$
begin
  raise exception 'Testabbruch' using errcode = 'P0001';
end;
$$;
create trigger test_fail_revoke before update on public.consents
  for each row when (old.user_id = '33333333-3333-4333-8333-333333333333') execute function pg_temp.fail_revoke();
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.revoke_health_data(true) $$, 'P0001', 'Testabbruch', 'Widerruf bricht ab');
select results_eq(
  $$ select count(*)::int from public.session_logs $$, $$ values (2) $$, 'Abbruch: Einträge von C unverändert'
);
reset role;
drop trigger test_fail_revoke on public.consents;
select is((select count(*)::int from public.consents where user_id = '33333333-3333-4333-8333-333333333333'
  and consent_type = 'health_data' and revoked_at is null), 1, 'Abbruch: Einwilligung weiter aktiv');

set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select lives_ok($$ select public.revoke_health_data(true) $$, 'C widerruft und löscht Einträge aus Gesundheits-Plänen');
reset role;
select results_eq(
  $$ select id, name_de, from_health_plan from public.session_logs where user_id = '33333333-3333-4333-8333-333333333333' $$,
  $$ values ('c3000000-0000-4000-8000-000000000002'::uuid, 'Ganzkörper sanft'::text, false) $$,
  'nur der Eintrag aus dem Gesundheits-Plan ist gelöscht'
);
select is_empty(
  $$ select 1 from public.exercise_logs e left join public.session_logs s on s.id = e.session_log_id where s.id is null $$,
  'Kaskade: keine verwaisten Übungen'
);
select results_eq(
  $$ select (select count(*)::int from public.session_logs where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.session_logs where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (5, 2) $$, 'Einträge von A und B unberührt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Abgelehnte Neu-Einwilligung (H-c): B – neue Textfassung health_data ohne Zustimmung
-- ---------------------------------------------------------------------------------------------------------
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at)
values ('health_data', 2, 'Einwilligung Gesundheitsdaten', 'Version 2', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(
  public.save_session_log(pg_temp.log('b3000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000003',
    '2026-10-06', '2026-10-06', jsonb_build_array(pg_temp.ex('b2000000-0000-4000-8000-000000000003')),
    'fb000000-0000-4000-8000-000000000003')) ->> 'result', 'ok', 'B: Eintrag ohne gültige Einwilligung');
select results_eq(
  $$ select s.planned_session_id, s.name_de, s.from_health_plan, e.target_weight_kg, e.state_weight_kg
     from public.session_logs s join public.exercise_logs e on e.session_log_id = s.id
     where s.id = 'b3000000-0000-4000-8000-000000000003' $$,
  $$ values ('b1000000-0000-4000-8000-000000000003'::uuid, 'Kraft-Einheit'::text, false, null::numeric, null::numeric) $$,
  'ohne gültige Einwilligung: Verweis bleibt, aber ohne Vorgaben aus dem Gesundheits-Plan'
);
create function pg_temp.endurance_plan(p_day date default '2026-10-07') returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null, 'engine_version', 2,
    'match_quality', 'exact', 'notes', '[]'::jsonb, 'uses_health_data', false, 'medical_notice', false,
    'inputs', '{"goalType": "endurance", "discipline": "10k", "experienceLevel": "beginner",
                "schedule": {"mode": "flex", "slots": [{"kind": "endurance", "minutes": 30}]},
                "trainingLocation": null, "homeEquipment": []}'::jsonb,
    'start_date', '2026-10-07',
    'sessions', jsonb_build_array(jsonb_build_object(
      'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
      'template_day_index', null, 'scheduled_on', p_day, 'name_de', 'Lockerer Dauerlauf',
      'focus', null, 'endurance_modality', 'run', 'effort_target', 4, 'estimated_minutes', 30,
      'warmup_de', 'Aufwärmen.', 'cooldown_de', 'Ausklingen.', 'exercises', '[]'::jsonb))
  )
$$;
grant execute on function pg_temp.endurance_plan(date) to authenticated;
select lives_ok($$ select public.save_training_plan(pg_temp.endurance_plan()) $$,
  'B speichert Plan ohne Check – auch heute, obwohl die erledigte Einheit SB1 heute liegt');
select results_eq(
  $$ select count(*)::int, bool_or(from_health_plan), array_agg(distinct name_de) from public.session_logs $$,
  $$ values (3, false, array['Kraft-Einheit']::text[]) $$,
  'H-c: alle Einträge von B neutralisiert, keiner gelöscht'
);
select is(
  (select count(*)::int from public.exercise_logs where num_nonnulls(target_weight_kg, state_weight_kg) > 0),
  0, 'H-c: keine Vorgaben und kein Zustand mehr'
);
select results_eq(
  $$ select status::text from public.planned_sessions where id = 'b1000000-0000-4000-8000-000000000001' $$,
  $$ values ('completed'::text) $$, 'erledigte Einheit des ersetzten Plans bleibt als Verlauf'
);

-- ---------------------------------------------------------------------------------------------------------
-- Höchstens 10 neue Einträge je Kalendertag (C, K1): gezählt werden Erstellungen
-- ---------------------------------------------------------------------------------------------------------
reset role;
select is((select created from private.session_log_daily_counts
  where user_id = '33333333-3333-4333-8333-333333333333' and day = '2026-10-07'), 2,
  'Zähler: zwei Erstellungen von C (auch der gelöschte Eintrag zählt)');
update private.session_log_daily_counts set created = 10
where user_id = '33333333-3333-4333-8333-333333333333' and day = '2026-10-07';
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ select public.save_session_log(pg_temp.log('c3000000-0000-4000-8000-000000000011', null, '2026-10-07', '2026-10-07',
       jsonb_build_array(pg_temp.ex(null)), 'fc000000-0000-4000-8000-000000000011')) $$,
  '54000', 'Heute wurden schon zu viele Trainings gespeichert.', '11. neuer Eintrag am selben Tag abgelehnt'
);
select is(
  public.save_session_log(jsonb_set(jsonb_set(pg_temp.log('c3000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002',
    '2026-10-06', '2026-10-06', jsonb_build_array(pg_temp.ex('c2000000-0000-4000-8000-000000000002')),
    'fc000000-0000-4000-8000-000000000012'), '{base_revision}', '1'), '{notes}', '"geändert"')) ->> 'revision',
  '2', 'Ändern bestehender Einträge bleibt möglich'
);
select throws_ok($$ select * from private.session_log_daily_counts $$, '42501', null, 'Zähler nicht lesbar für Nutzer');

-- ---------------------------------------------------------------------------------------------------------
-- Wächter B1: delete_session_log setzt nur auf planned zurück, wenn der Plan aktiv ist, die Woche läuft und der
-- Tag frei ist (E, Plan ohne Gesundheitsbezug: E1 Mi 07.10., E2 Fr 09.10., E3 Do 08.10.)
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'nutzer-e@example.test');
insert into public.profiles (user_id, birth_date) values ('55555555-5555-4555-8555-555555555555', '1990-01-01');
insert into public.user_plans (id, user_id, status, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date)
values ('eeeeeeee-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 'active', 'vorlage-a',
  'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05');
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id::uuid, 'eeeeeeee-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 1, 1, 1, day::date,
  'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.'
from (values ('e1000000-0000-4000-8000-000000000001', '2026-10-07'), ('e1000000-0000-4000-8000-000000000002', '2026-10-09'),
             ('e1000000-0000-4000-8000-000000000003', '2026-10-08')) v(id, day);
insert into public.planned_exercises (id, session_id, user_id, order_no, exercise_id, source_exercise_id,
  exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
select ('e2' || substr(id, 3))::uuid, id::uuid, '55555555-5555-4555-8555-555555555555', 1, 'uebung-a', 'uebung-a',
  'Übung A', 3, 8, 12, 90, 7
from (values ('e1000000-0000-4000-8000-000000000001'), ('e1000000-0000-4000-8000-000000000003')) v(id);
set local role authenticated;
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
-- Fall a: E1 eingetragen, E2 auf denselben Tag verschoben, dann E1-Eintrag löschen.
select is(
  public.save_session_log(pg_temp.log('e3000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
    '2026-10-07', '2026-10-07', jsonb_build_array(pg_temp.ex('e2000000-0000-4000-8000-000000000001')),
    'fe000000-0000-4000-8000-000000000001')) ->> 'result', 'ok', 'E: Mittwoch eingetragen');
select lives_ok(
  $$ update public.planned_sessions set scheduled_on = '2026-10-07' where id = 'e1000000-0000-4000-8000-000000000002' $$,
  'E verschiebt Freitag auf den erledigten Mittwoch'
);
select is(public.delete_session_log('e3000000-0000-4000-8000-000000000001', 1) ->> 'result', 'ok',
  'Fall a: Löschen gelingt trotz anderer geplanter Einheit am Tag');
select is((select status::text from public.planned_sessions where id = 'e1000000-0000-4000-8000-000000000001'),
  'skipped', 'Fall a: Tag belegt → skipped statt planned');
-- Fall b: E3 eingetragen, neuer Plan, Eintrag löschen, dann wieder ein Plan mit Einheit an diesem Tag.
select is(
  public.save_session_log(pg_temp.log('e3000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
    '2026-10-08', '2026-10-07', jsonb_build_array(pg_temp.ex('e2000000-0000-4000-8000-000000000003')),
    'fe000000-0000-4000-8000-000000000003')) ->> 'result', 'ok', 'E: Donnerstag am Mittwoch vorgezogen');
select lives_ok($$ select public.save_training_plan(pg_temp.endurance_plan('2026-10-10')) $$, 'E: neuer Plan');
select is(public.delete_session_log('e3000000-0000-4000-8000-000000000003', 1) ->> 'result', 'ok',
  'Fall b: Eintrag des ersetzten Plans gelöscht');
select is((select status::text from public.planned_sessions where id = 'e1000000-0000-4000-8000-000000000003'),
  'skipped', 'Fall b: Plan nicht aktiv → skipped');
select lives_ok($$ select public.save_training_plan(pg_temp.endurance_plan('2026-10-08')) $$,
  'Fall b: Plan mit Einheit an diesem Tag weiter speicherbar');
reset role;
select is((select created from private.session_log_daily_counts
  where user_id = '55555555-5555-4555-8555-555555555555' and day = '2026-10-07'), 2,
  'K1: Löschen setzt den Tageszähler nicht zurück');

-- ---------------------------------------------------------------------------------------------------------
-- Wächter B2: direkter Widerruf (update consents) – ein Eintrag, der während des Löschens der Pläne entsteht
-- (nachgestellt per Trigger), wird danach noch neutralisiert (F)
-- ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values ('66666666-6666-4666-8666-666666666666', 'nutzer-f@example.test');
insert into public.profiles (user_id, birth_date) values ('66666666-6666-4666-8666-666666666666', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
values ('66666666-6666-4666-8666-666666666666', 'health_data', 2, 'web');
insert into public.user_plans (id, user_id, status, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date, uses_health_data)
values ('ffffffff-0000-4000-8000-000000000001', '66666666-6666-4666-8666-666666666666', 'active', 'vorlage-a',
  'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', true);
create function pg_temp.race_log() returns trigger language plpgsql as $$
begin
  insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, from_health_plan,
    last_write_id, client_updated_at)
  values ('f3000000-0000-4000-8000-000000000001', old.user_id, 'strength', '2026-10-07', 'completed',
    'Ganzkörper sanft', true, gen_random_uuid(), now());
  insert into public.exercise_logs (session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type,
    status, target_weight_kg, state_weight_kg, state_extra_set)
  values ('f3000000-0000-4000-8000-000000000001', old.user_id, 1, 'uebung-a', 'Übung A', 'weight', 'done', 20, 20, false);
  return old;
end;
$$;
create trigger test_race_log after delete on public.user_plans
  for each row when (old.user_id = '66666666-6666-4666-8666-666666666666') execute function pg_temp.race_log();
set local role authenticated;
set local request.jwt.claims = '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}';
select lives_ok(
  $$ update public.consents set revoked_at = now() where consent_type = 'health_data' and revoked_at is null $$,
  'F widerruft direkt (ohne revoke_health_data)'
);
reset role;
drop trigger test_race_log on public.user_plans;
select results_eq(
  $$ select s.name_de, s.from_health_plan, e.target_weight_kg, e.state_weight_kg
     from public.session_logs s join public.exercise_logs e on e.session_log_id = s.id
     where s.id = 'f3000000-0000-4000-8000-000000000001' $$,
  $$ values ('Kraft-Einheit'::text, false, null::numeric, null::numeric) $$,
  'B2: während des Löschens entstandener Eintrag ist danach neutralisiert'
);

-- ---------------------------------------------------------------------------------------------------------
-- Wächter S3: dieselbe write_id nach Ablauf des Datumsfensters → weiter ok (Antwort ging verloren)
-- ---------------------------------------------------------------------------------------------------------
create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-30'
$$;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.save_session_log(pg_temp.sa6()) ->> 'result', 'ok', 'gleiche write_id nach 24 Tagen: ok');
select throws_ok(
  $$ select public.save_session_log(jsonb_set(jsonb_set(pg_temp.sa6('f6000000-0000-4000-8000-000000000099'),
       '{base_revision}', '1'), '{id}', '"a3000000-0000-4000-8000-000000000006"')) $$,
  '22023', 'Das Datum liegt außerhalb des erlaubten Zeitraums.', 'neue Fassung nach Ablauf des Fensters abgelehnt'
);
reset role;

select * from finish();
rollback;
