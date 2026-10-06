-- Phase 4 Etappe B (docs/PLAN-PHASE-4.md Abschnitte 3.1–3.5, 3.7): Tabellen des Trainingstagebuchs – RLS (nur
-- eigene Zeilen), nur Lesen für Nutzer, Verschiebe-Trigger (W1), Schnappschuss statt Kaskade (B2), archivierte
-- Übungen über eigene Einträge, Startgewichte (W14), Export deckt alle Nutzertabellen ab (W9, H-f).
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c-ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', '{}', 'compound', 'weight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('uebung-a', 'published'), ('uebung-archiv', 'archived')) as v(id, status);
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- Pläne, Einheiten und Übungen von A und B (als Datenbank-Eigentümer).
insert into public.user_plans (id, user_id, template_id, template_title_de, template_version, engine_version,
  match_quality, inputs, start_date, uses_health_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', true),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact', '{}', '2026-10-05', false);
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
values
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 1, 1, '2026-10-05', 'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.'),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 1, 2, '2026-10-08', 'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.'),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 1, 1, '2026-10-05', 'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.');
insert into public.planned_exercises (id, session_id, user_id, order_no, exercise_id, source_exercise_id,
  exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 'uebung-a', 'uebung-a', 'Übung A', 3, 8, 12, 120, 7);

-- Einträge von A (zur Einheit vom Montag, mit archivierter Übung) und B (als Datenbank-Eigentümer).
insert into public.session_logs (id, user_id, planned_session_id, kind, performed_on, status, name_de,
  from_health_plan, last_write_id, client_updated_at, notes)
values
  ('a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'a1000000-0000-4000-8000-000000000001', 'strength', '2026-10-05', 'completed', 'Ganzkörper', true, gen_random_uuid(), now(), 'Notiz A'),
  ('b3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'b1000000-0000-4000-8000-000000000001', 'strength', '2026-10-05', 'completed', 'Ganzkörper', false, gen_random_uuid(), now(), 'Notiz B');
insert into public.exercise_logs (id, session_log_id, user_id, order_no, planned_exercise_id, exercise_id,
  exercise_name_de, load_type, status, target_weight_kg, state_weight_kg, state_target_reps, state_extra_set)
values
  ('a4000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'a2000000-0000-4000-8000-000000000001', 'uebung-a', 'Übung A', 'weight', 'done', 20, 20, 10, false),
  ('a4000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, null, 'uebung-archiv', 'Übung Archiv', 'weight', 'done', null, null, null, null),
  ('b4000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 'b2000000-0000-4000-8000-000000000001', 'uebung-a', 'Übung A', 'weight', 'done', 30, 30, 10, false);
insert into public.set_logs (exercise_log_id, user_id, set_no, reps, weight_kg, rpe, done)
values
  ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 10, 20, 8, true),
  ('a4000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 1, 8, 12.5, null, true),
  ('b4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 10, 30, 8, true);

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
-- Struktur
-- ---------------------------------------------------------------------------------------------------------
select has_table('public', t, 'Tabelle ' || t)
from unnest(array['session_logs', 'exercise_logs', 'set_logs', 'cardio_logs', 'exercise_start_weights']) t;
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname in ('session_logs', 'exercise_logs', 'set_logs', 'cardio_logs',
     'exercise_start_weights') and c.relrowsecurity),
  5, 'RLS auf allen fünf Tagebuch-Tabellen'
);
select has_column('public', 'exercise_logs', 'target_extra_set', 'exercise_logs.target_extra_set (Etappe A C3)');
select col_is_null('public', 'exercise_logs', 'target_extra_set', 'target_extra_set nullable');
select col_not_null('public', 'exercise_logs', 'is_return', 'is_return not null');
select col_default_is('public', 'exercise_logs', 'is_return', 'false', 'is_return default false');
select is(
  (select array_agg(e) from unnest(enum_range(null::public.planned_session_status)::text[]) e),
  array['planned', 'skipped', 'completed'], 'planned_session_status kennt completed'
);
select is(
  (select confdeltype from pg_constraint where conname = 'session_logs_planned_session_id_user_id_fkey'),
  'n'::"char", 'session_logs → planned_sessions: on delete set null'
);
select is(
  (select confdelsetcols::int2[] = array[(select attnum from pg_attribute
     where attrelid = 'public.session_logs'::regclass and attname = 'planned_session_id')]
   from pg_constraint where conname = 'session_logs_planned_session_id_user_id_fkey'),
  true, 'set null NUR für planned_session_id (B2)'
);

-- ---------------------------------------------------------------------------------------------------------
-- RLS: A sieht nur eigene Zeilen; Schreiben nur über Funktionen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select results_eq($$ select id from public.session_logs $$,
  $$ values ('a3000000-0000-4000-8000-000000000001'::uuid) $$, 'A sieht nur den eigenen Eintrag');
select is((select count(*)::int from public.exercise_logs), 2, 'A sieht nur eigene Übungs-Einträge');
select is((select count(*)::int from public.set_logs), 2, 'A sieht nur eigene Sätze');
select is_empty($$ select 1 from public.set_logs where user_id = '22222222-2222-4222-8222-222222222222' $$, 'fremde Sätze unsichtbar');

select throws_ok(
  $$ insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
     values (gen_random_uuid(), '11111111-1111-4111-8111-111111111111', 'strength', '2026-10-07', 'completed', 'X', gen_random_uuid(), now()) $$,
  '42501', null, 'direktes Anlegen eines Eintrags scheitert'
);
select throws_ok($$ update public.session_logs set notes = 'geändert' $$, '42501', null, 'direktes Ändern scheitert');
select throws_ok($$ delete from public.session_logs $$, '42501', null, 'direktes Löschen scheitert');
select throws_ok($$ update public.exercise_logs set target_weight_kg = 100 $$, '42501', null, 'Vorgabe direkt ändern scheitert');
select throws_ok(
  $$ insert into public.set_logs (exercise_log_id, user_id, set_no, done)
     values ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, true) $$,
  '42501', null, 'Satz direkt anlegen scheitert'
);
select throws_ok(
  $$ insert into public.cardio_logs (session_log_id, user_id, modality, duration_s)
     values ('a3000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'run', 600) $$,
  '42501', null, 'Ausdauer direkt anlegen scheitert'
);

-- W1: planned → completed per PostgREST scheitert; planned → skipped geht weiter.
select throws_ok(
  $$ update public.planned_sessions set status = 'completed' where id = 'a1000000-0000-4000-8000-000000000002' $$,
  '23514', 'Nur Datum und Status einer Einheit sind änderbar.', 'planned → completed direkt scheitert (W1)'
);
select lives_ok(
  $$ update public.planned_sessions set status = 'skipped' where id = 'a1000000-0000-4000-8000-000000000002' $$,
  'planned → skipped geht weiter'
);

-- Archivierte Übung aus eigenem Eintrag ist lesbar – für B nicht.
select is((select count(*)::int from public.exercises where id = 'uebung-archiv'), 1,
  'A liest archivierte Übung aus eigenem Eintrag');

-- ---------------------------------------------------------------------------------------------------------
-- Startgewichte (W14): direkt per PostgREST, eigene Zeilen, Profil-Pflicht, CHECK 0,5–500
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.exercise_start_weights (exercise_id, weight_kg) values ('uebung-a', 22.5) $$,
  'A legt eigenes Startgewicht an'
);
select is((select user_id from public.exercise_start_weights), '11111111-1111-4111-8111-111111111111'::uuid,
  'user_id aus dem Login');
select lives_ok(
  $$ update public.exercise_start_weights set weight_kg = 25 where exercise_id = 'uebung-a' $$,
  'A ändert eigenes Startgewicht'
);
select throws_ok(
  $$ update public.exercise_start_weights set weight_kg = 0.4 where exercise_id = 'uebung-a' $$,
  '23514', null, 'Startgewicht unter 0,5 kg abgelehnt'
);
select throws_ok(
  $$ insert into public.exercise_start_weights (exercise_id, weight_kg) values ('uebung-archiv', 500.5) $$,
  '23514', null, 'Startgewicht über 500 kg abgelehnt'
);
select lives_ok(
  $$ insert into public.exercise_start_weights (exercise_id, weight_kg) values ('uebung-archiv', 500) $$,
  'Startgewicht 500 kg (Grenze) erlaubt'
);
select throws_ok(
  $$ insert into public.exercise_start_weights (user_id, exercise_id, weight_kg)
     values ('22222222-2222-4222-8222-222222222222', 'uebung-a', 20) $$,
  '42501', null, 'Startgewicht für fremdes Konto abgelehnt'
);
select throws_ok(
  $$ insert into public.exercise_start_weights (exercise_id, weight_kg) values ('gibt-es-nicht', 20) $$,
  '42501', null, 'Startgewicht für unbekannte Übung abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Export (W9, H-f): Schlüssel = alle public-Tabellen mit Fremdschlüssel auf auth.users; nur eigene Zeilen
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select public.export_my_data() $$, 'A exportiert (security invoker, alle Leserechte vorhanden)');
select is(
  (select array_agg(k order by k) from jsonb_object_keys(public.export_my_data() -> 'data') k),
  (select array_agg(distinct c.conrelid::regclass::text order by c.conrelid::regclass::text)
   from pg_constraint c
   where c.contype = 'f' and c.confrelid = 'auth.users'::regclass
     and c.connamespace = 'public'::regnamespace)::text[],
  'Export enthält genau alle Tabellen mit Fremdschlüssel auf auth.users'
);
select is_empty(
  $$ select c.relname::text from pg_catalog.pg_class c
     join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id' and not a.attisdropped
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
     except select jsonb_object_keys(public.export_my_data() -> 'data') $$,
  'Export enthält auch jede public-Tabelle mit Spalte user_id (K3; waitlist hat keine und ist bewusst nicht dabei)'
);
select ok(
  (select bool_and(jsonb_typeof(v) = 'array') from jsonb_each(public.export_my_data() -> 'data') e(k, v)),
  'jeder Export-Eintrag ist eine Liste'
);
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'session_logs'), 1, 'Export: eigener Eintrag');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'set_logs'), 2, 'Export: eigene Sätze');
select is(jsonb_array_length(public.export_my_data() -> 'data' -> 'exercise_start_weights'), 2, 'Export: Startgewichte');
select ok(
  position('Notiz B' in public.export_my_data()::text) = 0
    and position('22222222-2222-4222-8222-222222222222' in public.export_my_data()::text) = 0,
  'Export enthält nichts von B'
);

-- Ohne Anmeldung kein Export; anon darf die Funktion nicht aufrufen.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.export_my_data() $$, '42501', 'Nicht angemeldet.', 'Export ohne Login abgelehnt');
set local role anon;
select throws_ok($$ select public.export_my_data() $$, '42501', null, 'anon darf nicht exportieren');
select throws_ok($$ select * from public.session_logs $$, '42501', null, 'anon liest keine Einträge');
select throws_ok($$ select * from public.exercise_start_weights $$, '42501', null, 'anon liest keine Startgewichte');

-- ---------------------------------------------------------------------------------------------------------
-- B sieht nichts von A; C (ohne Profil) darf kein Startgewicht anlegen
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select results_eq($$ select id from public.session_logs $$,
  $$ values ('b3000000-0000-4000-8000-000000000001'::uuid) $$, 'B sieht nur den eigenen Eintrag');
select is_empty($$ select 1 from public.exercise_start_weights $$, 'B sieht keine fremden Startgewichte');
select is_empty($$ select 1 from public.exercises where id = 'uebung-archiv' $$, 'B liest die archivierte Übung von A nicht');
select lives_ok(
  $$ delete from public.exercise_start_weights where user_id = '11111111-1111-4111-8111-111111111111' $$,
  'B: Löschen fremder Startgewichte bleibt ohne Wirkung'
);
select throws_ok(
  $$ update public.exercise_logs set status = 'skipped' $$, '42501', null, 'B ändert keine Einträge'
);
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.exercise_start_weights (exercise_id, weight_kg) values ('uebung-a', 20) $$,
  '42501', null, 'ohne Profil: kein Startgewicht'
);

-- ---------------------------------------------------------------------------------------------------------
-- Schnappschuss statt Kaskade (B2): Plan löschen → Verweise null, user_id und Eintrag bleiben
-- ---------------------------------------------------------------------------------------------------------
reset role;
select is((select count(*)::int from public.exercise_start_weights where user_id = '11111111-1111-4111-8111-111111111111'), 2,
  'Startgewichte von A unverändert');
delete from public.user_plans where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select results_eq(
  $$ select user_id, planned_session_id, name_de, notes from public.session_logs where id = 'a3000000-0000-4000-8000-000000000001' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, null::uuid, 'Ganzkörper'::text, 'Notiz A'::text) $$,
  'nach Plan-Löschung: Eintrag bleibt, user_id erhalten, nur Verweis null'
);
select results_eq(
  $$ select user_id, planned_exercise_id, target_weight_kg from public.exercise_logs where id = 'a4000000-0000-4000-8000-000000000001' $$,
  $$ values ('11111111-1111-4111-8111-111111111111'::uuid, null::uuid, 20.00::numeric) $$,
  'Übungs-Eintrag: user_id erhalten, planned_exercise_id null, Schnappschuss bleibt'
);
select is((select count(*)::int from public.set_logs where user_id = '11111111-1111-4111-8111-111111111111'), 2,
  'Sätze bleiben');

-- CHECKs der Tabellen (als Eigentümer, unabhängig von den Funktionen).
select throws_ok(
  $$ insert into public.set_logs (exercise_log_id, user_id, set_no, rpe, done)
     values ('a4000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, 7.3, true) $$,
  '23514', null, 'Satz-RPE nur in 0,5er-Schritten'
);
select throws_ok(
  $$ insert into public.set_logs (exercise_log_id, user_id, set_no, done)
     values ('a4000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 2, true) $$,
  '23503', null, 'Satz zu fremdem Übungs-Eintrag unmöglich (gemeinsamer Fremdschlüssel)'
);
select throws_ok(
  $$ update public.exercise_logs set state_weight_kg = 20, state_extra_set = null
     where id = 'a4000000-0000-4000-8000-000000000002' $$,
  '23514', null, 'Zustand ganz oder gar nicht'
);
select throws_ok(
  $$ update public.session_logs set notes = repeat('x', 281) where id = 'a3000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Notiz höchstens 280 Zeichen'
);
select lives_ok(
  $$ update public.session_logs set notes = repeat('😀', 280) where id = 'a3000000-0000-4000-8000-000000000001' $$,
  'Notiz mit 280 Emojis (Code-Points) erlaubt'
);

select * from finish();
rollback;
