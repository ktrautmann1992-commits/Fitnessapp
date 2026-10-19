-- Phase 4b Etappe B (docs/PLAN-PHASE-4B.md 4.4–4.7, 4.6 Punkte 1, 2, 6–10; Wächter B1, S2, S3, S-n1, S-n2, K4):
-- Tabellen, CHECKs, RLS und Rechte; Ereignisse nur bei Premium (Outbox in save_session_log, close_missed_sessions,
-- replace_training_slots, Messungen, Ziele); claim_adjustment_events (skip locked, Sperrfrist, Fehlversuche,
-- Ratenbegrenzung: 21. Aufruf → rate_limited), mark_adjustment_events_processed; live_adjustment_status; beta_admin
-- (nur service_role, ohne E-Mail/user_id, Protokoll, lower(), ungültige Eingaben ohne Echo); Widerruf löscht
-- from_health_plan/uses_body_data; Export (K4); append_plan_block: höchstens L Belastungswochen in Folge über die
-- Blockgrenze (S-n1); save_training_plan: offene Vorschläge verfallen. Nummer 48 statt 20 (20–47 belegt).
-- „Heute“ ist fest Mittwoch, 07.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(67);
-- Testphase „alles offen“ (20261019120000_premium_open.sql): Diese Datei prüft den Beta-Weg (Premium nur mit
-- Freischaltung) – dafür hier premium_open aus; der offene Weg steht in 51_premium_open.test.sql.
update private.feature_flags set enabled = false where key = 'premium_open';

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A: Premium, B: gratis, D: ohne Gesundheits-Einwilligung (für append_plan_block/save_training_plan).
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'Nutzer-A@Example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array['11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444']::uuid[]) u;
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;
insert into public.consents (user_id, consent_type, version, platform)
select '44444444-4444-4444-8444-444444444444', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) t;

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
values ('uebung-a', 1, 'published', 'Übung A', 'Exercise A', 'squat', '{quadriceps}', '{}', 'compound', 'bodyweight',
  1, 'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');
insert into public.plan_templates (id, version, status, title_de, description_de, goal_type, experience_level,
  sessions_per_week, minutes_min, minutes_max, location)
values ('vorlage-a', 2, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- Pläne: A aktiv mit Gesundheitsbezug (P1) und ersetzt ohne (P2); B aktiv ohne; D aktiv ohne (Wochen 1–3 Belastung).
insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date, uses_health_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{"experienceLevel": "beginner"}', '2026-09-28', true),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{"experienceLevel": "beginner"}', '2026-09-21', false),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{"experienceLevel": "beginner"}', '2026-09-28', false),
  ('dddddddd-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 'active', null, 'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{"experienceLevel": "beginner"}', '2026-10-05', false);
insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de,
  focus, estimated_minutes, warmup_de, cooldown_de, kind, endurance_modality, effort_target)
values
  -- A: verpasste Einheit der Vorwoche (Mi 30.09.) und Ausdauer heute.
  ('a1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 1, 1, '2026-09-30', 'Ganzkörper', 'full_body', 50, 'A.', 'B.', 'strength', null, null),
  ('a1000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, 2, null, '2026-10-07', 'Lauf', null, 30, 'A.', 'B.', 'endurance', 'run', 3),
  ('b1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 1, 1, '2026-09-30', 'Ganzkörper', 'full_body', 50, 'A.', 'B.', 'strength', null, null),
  ('b1000000-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, 2, null, '2026-10-07', 'Lauf', null, 30, 'A.', 'B.', 'endurance', 'run', 3),
  ('d1000000-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 1, 1, 1, '2026-10-05', 'Ganzkörper', 'full_body', 50, 'A.', 'B.', 'strength', null, null),
  ('d1000000-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 1, 2, 1, '2026-10-12', 'Ganzkörper', 'full_body', 50, 'A.', 'B.', 'strength', null, null),
  ('d1000000-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 1, 3, 1, '2026-10-19', 'Ganzkörper', 'full_body', 50, 'A.', 'B.', 'strength', null, null);

create function pg_temp.endurance_log(p_user text, p_planned text, p_write text) returns jsonb language sql as $$
  select jsonb_build_object(
    'id', gen_random_uuid(), 'write_id', p_write, 'base_revision', null, 'planned_session_id', p_planned,
    'planned_date', '2026-10-07', 'kind', 'endurance', 'performed_on', '2026-10-07',
    'started_at', '2026-10-07T17:00:00+02:00', 'finished_at', '2026-10-07T17:30:00+02:00', 'status', 'completed',
    'session_rpe', 7, 'notes', null, 'name_de', 'Lauf', 'is_intro_week', false, 'is_deload', false,
    'source', 'manual', 'client_updated_at', '2026-10-07T17:30:00+02:00', 'exercises', '[]'::jsonb,
    'cardio', '{"modality": "run", "duration_s": 1800, "distance_m": null, "elevation_m": null}'::jsonb)
$$;
create function pg_temp.events(p_user text) returns text language sql as $$
  select coalesce(string_agg(trigger::text, ',' order by trigger::text, id), '')
  from private.adjustment_events where user_id = p_user::uuid
$$;
create function pg_temp.claims(p_user uuid, p_n integer) returns text language plpgsql as $$
declare
  out text := '';
  i integer;
begin
  for i in 1 .. p_n loop
    out := out || case when (public.claim_adjustment_events(p_user, 50) ->> 'rate_limited')::boolean then 'x' else '.' end;
  end loop;
  return out;
end;
$$;
-- Folgeblock-Einheit wie toSavePlanPayload() (Montag 12.10. + Versatz).
create function pg_temp.session(p_day integer, p_block integer, p_week integer default 1,
  p_deload boolean default false)
returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', p_week, 'is_intro_week', false, 'is_deload', p_deload, 'kind', 'strength',
    'template_day_index', 1, 'scheduled_on', date '2026-10-12' + p_day,
    'name_de', 'Ganzkörper A', 'focus', 'full_body', 'endurance_modality', null, 'effort_target', null,
    'estimated_minutes', 50, 'warmup_de', 'Aufwärmen.', 'cooldown_de', 'Ausklingen.',
    'exercises', jsonb_build_array(jsonb_build_object(
      'order_no', 1, 'exercise_id', 'uebung-a', 'source_exercise_id', 'uebung-a', 'exercise_name_de', 'Übung A',
      'sets', case when p_deload then 2 else 3 end, 'reps_min', 8, 'reps_max', 12, 'duration_s', null, 'rest_s', 120,
      'rpe_target', case when p_deload then 5 else 7 end, 'superset_group', null, 'notes_de', null,
      'target_weight_kg', null)))
$$;
create function pg_temp.plan_payload() returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', 'vorlage-a', 'template_title_de', 'Vorlage A für Tests', 'template_version', 2,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '[]'::jsonb, 'uses_health_data', false,
    'medical_notice', false,
    'inputs', '{"goalType": "muscle_gain", "discipline": null, "experienceLevel": "beginner",
                "schedule": {"mode": "fixed", "slots": [{"weekday": 1, "kind": "strength_gym", "minutes": 45}]},
                "trainingLocation": "gym", "homeEquipment": []}'::jsonb,
    'start_date', '2026-10-07', 'sessions', jsonb_build_array(pg_temp.session(2, 1)))
$$;
create function pg_temp.adjustment(p_user uuid, p_plan uuid, p_fp text, p_health boolean, p_body boolean,
  p_status text default 'applied') returns void language sql as $$
  insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status, requires_confirmation,
    change_before, change_after, effective_from, expires_on, engine_version, rule_version, input_fingerprint,
    uses_body_data, from_health_plan, decided_at)
  values (p_user, p_plan, 'session_logged', 'fewer_days', 'proposal', p_status::public.adjustment_status, true,
    '{"days": 3}', '{"days": 2}', '2026-10-08', '2026-10-21', 1, 1, 'fewer_days:' || p_fp, p_body, p_health,
    case when p_status = 'pending_confirmation' then null else now() end)
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role, anon;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte, RLS, CHECKs
-- ---------------------------------------------------------------------------------------------------------
select ok((select bool_and(relrowsecurity) from pg_class
           where oid in ('public.plan_adjustments'::regclass, 'private.adjustment_events'::regclass,
                         'private.live_adjust_hourly_counts'::regclass)),
  'RLS an: plan_adjustments und private Tabellen');
select ok(has_table_privilege('authenticated', 'public.plan_adjustments', 'select')
          and not has_table_privilege('authenticated', 'public.plan_adjustments', 'insert')
          and not has_table_privilege('authenticated', 'public.plan_adjustments', 'update')
          and not has_table_privilege('authenticated', 'public.plan_adjustments', 'delete')
          and not has_table_privilege('anon', 'public.plan_adjustments', 'select'),
  'plan_adjustments: authenticated nur lesen, anon nichts');
select ok(not has_column_privilege('authenticated', 'public.planned_sessions', 'adjustment_id', 'update')
          and not has_column_privilege('authenticated', 'public.planned_exercises', 'adjustment_id', 'update')
          and has_column_privilege('authenticated', 'public.planned_sessions', 'status', 'update'),
  'neue Plan-Spalten für authenticated nicht änderbar (Spalten-Rechte bleiben scheduled_on, status)');
select ok(not has_table_privilege('authenticated', 'private.adjustment_events', 'select')
          and not has_table_privilege('authenticated', 'private.live_adjust_hourly_counts', 'select')
          and not has_table_privilege('anon', 'private.adjustment_events', 'select')
          and has_table_privilege('service_role', 'private.adjustment_events', 'select'),
  'private Tabellen: nur service_role');
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('live_adjustment_status', 'apply_plan_adjustments', 'confirm_plan_adjustment',
                       'revert_plan_adjustment', 'claim_adjustment_events', 'mark_adjustment_events_processed',
                       'beta_admin')),
  'neue Funktionen: security definer, search_path leer');
select ok(not has_function_privilege('authenticated', 'public.claim_adjustment_events(uuid, integer)', 'execute')
          and not has_function_privilege('authenticated', 'public.mark_adjustment_events_processed(bigint[], text)', 'execute')
          and has_function_privilege('service_role', 'public.claim_adjustment_events(uuid, integer)', 'execute')
          and not has_function_privilege('authenticated', 'private.enqueue_adjustment_event(uuid, public.adjustment_trigger, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'private.expire_plan_adjustments()', 'execute'),
  'claim/mark nur service_role; enqueue/expire nicht für authenticated');
select ok(has_function_privilege('authenticated', 'public.live_adjustment_status()', 'execute')
          and not has_function_privilege('anon', 'public.live_adjustment_status()', 'execute'),
  'live_adjustment_status: authenticated ja, anon nein');
select is((select enabled from private.feature_flags where key = 'live_adjustment'), false, 'Flag live_adjustment startet AUS');

select throws_ok($$ select pg_temp.adjustment('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', '00000000000000z1', true, false) $$,
  '23514', null, 'Fingerabdruck nur Hex → CHECK');
select throws_ok($$ insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status, exercise_id,
    state_before, state_after, effective_from, engine_version, rule_version, input_fingerprint, uses_body_data,
    from_health_plan)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'session_logged',
    'load_reduce', 'state_override', 'applied', 'uebung-a',
    '{"weightKg": 20, "targetReps": 8, "extraSet": false, "durationS": null}',
    '{"weightKg": 18, "targetReps": 8, "extraSet": false, "durationS": null, "notiz": "x"}',
    '2026-10-08', 1, 1, 'load_reduce:0000000000000001', false, true) $$,
  '23514', null, 'Zustands-Vorgabe mit fremdem Schlüssel → CHECK');
select throws_ok($$ insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status,
    change_before, change_after, explain_params, effective_from, engine_version, rule_version, input_fingerprint,
    uses_body_data, from_health_plan)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'session_logged',
    'volume_reduce', 'plan_change', 'applied', '{"sessions": []}', '{"sessions": []}',
    '{"grund": "Knie tut weh"}', '2026-10-08', 1, 1, 'volume_reduce:0000000000000001', false, true) $$,
  '23514', null, 'Erklär-Parameter mit Freitext → CHECK');
select throws_ok($$ insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status,
    change_before, change_after, effective_from, engine_version, rule_version, input_fingerprint,
    uses_body_data, from_health_plan)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'session_logged',
    'volume_reduce', 'plan_change', 'pending_confirmation', '{"sessions": []}', '{"sessions": []}',
    '2026-10-08', 1, 1, 'volume_reduce:0000000000000002', false, true) $$,
  '23514', null, 'pending_confirmation ohne Bestätigungspflicht → CHECK');
select throws_ok($$ insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status,
    state_before, state_after, effective_from, engine_version, rule_version, input_fingerprint, uses_body_data,
    from_health_plan)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'session_logged',
    'load_reduce', 'state_override', 'applied',
    '{"weightKg": 20, "targetReps": 8, "extraSet": false, "durationS": null}',
    '{"weightKg": 18, "targetReps": 8, "extraSet": false, "durationS": null}',
    '2026-10-08', 1, 1, 'load_reduce:0000000000000003', false, true) $$,
  '23514', null, 'Zustands-Vorgabe ohne Übung → CHECK (state_override ⇔ Übung und Vorgabe)');
select throws_ok($$ insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status,
    planned_session_ids, change_before, change_after, effective_from, engine_version, rule_version, input_fingerprint,
    uses_body_data, from_health_plan)
  select '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', 'session_logged',
    'volume_reduce', 'plan_change', 'applied', array(select gen_random_uuid() from generate_series(1, 43)),
    '{"sessions": []}', '{"sessions": []}', '2026-10-08', 1, 1, 'volume_reduce:0000000000000004', false, true $$,
  '23514', null, 'mehr als 42 Einheiten → CHECK');
select throws_ok($$ select pg_temp.adjustment('11111111-1111-4111-8111-111111111111', 'bbbbbbbb-0000-4000-8000-000000000001', '0000000000000001', false, false) $$,
  '23503', null, 'Anpassung zu fremdem Plan → Fremdschlüssel (plan_id, user_id)');

-- ---------------------------------------------------------------------------------------------------------
-- live_adjustment_status
-- ---------------------------------------------------------------------------------------------------------
insert into private.beta_entitlements (user_id, granted_by, expires_at)
values ('11111111-1111-4111-8111-111111111111', 'gruender-1', now() + interval '30 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.live_adjustment_status(), '{"active": false, "reason": "flag_off"}', 'Flag aus → flag_off');
reset role;
update private.feature_flags set enabled = true where key = 'live_adjustment';
set local role authenticated;
select is(public.live_adjustment_status(), '{"active": true, "reason": "ok"}', 'Premium → ok');
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(public.live_adjustment_status(), '{"active": false, "reason": "no_entitlement"}', 'gratis → no_entitlement');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Ereignisse nur bei Premium (Wächter S2), genau eines je Auslöser
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is(public.save_session_log(pg_temp.endurance_log('22222222-2222-4222-8222-222222222222',
  'b1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001')) ->> 'result', 'ok',
  'gratis: Training gespeichert');
select is(public.close_missed_sessions(), 1, 'gratis: verpasste Einheit geschlossen');
select lives_ok($$ select public.replace_training_slots('[{"slot_no": 1, "weekday": 1, "kind": "strength_gym", "minutes": 45}]') $$,
  'gratis: Trainingstage gespeichert');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.save_session_log(pg_temp.endurance_log('11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002')) ->> 'result', 'ok',
  'Premium: Training gespeichert');
select is(public.save_session_log(pg_temp.endurance_log('11111111-1111-4111-8111-111111111111',
  'a1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002')) ->> 'result', 'ok',
  'Premium: dieselbe Fassung erneut (idempotent)');
select is(public.close_missed_sessions(), 1, 'Premium: verpasste Einheit geschlossen');
select lives_ok($$ select public.replace_training_slots('[{"slot_no": 1, "weekday": 1, "kind": "strength_gym", "minutes": 45}]') $$,
  'Premium: Trainingstage gespeichert');
reset role;
insert into public.body_metrics (user_id, weight_kg) values
  ('11111111-1111-4111-8111-111111111111', 80), ('22222222-2222-4222-8222-222222222222', 70);
insert into public.goals (user_id, goal_type) values
  ('11111111-1111-4111-8111-111111111111', 'muscle_gain'), ('22222222-2222-4222-8222-222222222222', 'muscle_gain');
update public.goals set goal_type = 'general_fitness';
select is(pg_temp.events('22222222-2222-4222-8222-222222222222'), '', 'gratis: keine einzige Ereignis-Zeile');
select is(pg_temp.events('11111111-1111-4111-8111-111111111111'),
  'goal_changed,measurement_updated,session_logged,session_missed,slots_changed',
  'Premium: genau ein Ereignis je Auslöser');
select ok(not exists (
  select 1 from information_schema.columns
  where table_schema = 'private' and table_name = 'adjustment_events'
    and column_name not in ('id', 'user_id', 'trigger', 'ref_id', 'created_at', 'claimed_at', 'attempts',
                            'last_error_code')),
  'Ereignisse ohne Werte (nur Verweise und Zeitpunkte)');
update private.feature_flags set enabled = false where key = 'live_adjustment';
insert into public.body_measurements (user_id, waist_cm) values ('11111111-1111-4111-8111-111111111111', 80);
select is((select count(*)::int from private.adjustment_events where user_id = '11111111-1111-4111-8111-111111111111'),
  5, 'Flag aus: auch Premium erzeugt kein Ereignis');
update private.feature_flags set enabled = true where key = 'live_adjustment';

-- ---------------------------------------------------------------------------------------------------------
-- claim / mark (nur service_role), Ratenbegrenzung (Wächter S3)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.claim_adjustment_events(null, 50) $$, '42501', null, 'authenticated: claim verweigert');
reset role;
set local role service_role;
select is(jsonb_array_length(public.claim_adjustment_events(null, 2) -> 'events'), 2, 'Sweep holt 2 Ereignisse');
select is(jsonb_array_length(public.claim_adjustment_events(null, 50) -> 'events'), 3,
  'zweiter Lauf: übernommene Ereignisse gesperrt (Sperrfrist) – nur die übrigen 3');
select is(jsonb_array_length(public.claim_adjustment_events(null, 50) -> 'events'), 0, 'dritter Lauf: nichts offen');
select is((select count(*)::int from private.live_adjust_hourly_counts), 0, 'Sweep zählt nicht zur Ratenbegrenzung');
select is(public.mark_adjustment_events_processed(
  (select array_agg(id) from private.adjustment_events where trigger in ('session_logged', 'session_missed'))), 2,
  'verarbeitet → gelöscht');
select is(public.mark_adjustment_events_processed(
  (select array_agg(id) from private.adjustment_events where trigger = 'goal_changed'), 'compute_failed'), 1,
  'Fehlercode → bleibt');
select results_eq(
  $$ select trigger::text, last_error_code, claimed_at is null from private.adjustment_events order by trigger $$,
  $$ values ('goal_changed', 'compute_failed', true), ('measurement_updated', null::text, false),
            ('slots_changed', null::text, false) $$,
  'Fehlercode gesetzt, Sperrfrist aufgehoben');
select throws_ok($$ select public.mark_adjustment_events_processed(array[1::bigint], 'Knie tut weh') $$, '22023', null,
  'Fehlercode nur als fester Code (kein Inhalt)');
update private.adjustment_events set attempts = 5, claimed_at = null where trigger = 'slots_changed';
select is((select string_agg(e ->> 'trigger', ',') from jsonb_array_elements(public.claim_adjustment_events(
  '11111111-1111-4111-8111-111111111111', 50) -> 'events') e), 'goal_changed',
  'Person: nur eigene offene Ereignisse; ab 5 Fehlversuchen bleibt ein Ereignis stehen');
select is(pg_temp.claims('11111111-1111-4111-8111-111111111111', 20), '...................x',
  '20 Aufrufe je Stunde, der 21. → rate_limited');
select is(public.claim_adjustment_events('22222222-2222-4222-8222-222222222222', 50) ->> 'rate_limited', 'false',
  'Zähler je Person');
select is((select count from private.live_adjust_hourly_counts
           where user_id = '11111111-1111-4111-8111-111111111111'), 21::smallint, 'geteilter Zähler steht bei 21');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- beta_admin (Wächter B1, S-n2)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.beta_admin('status', 'gruender-1', p_flag => 'live_adjustment') $$, '42501', null,
  'authenticated: beta_admin verweigert');
reset role;
set local role service_role;
select is(public.beta_admin('flag_off', 'gruender-1', p_flag => 'live_adjustment'), '{"result": "flag_off"}',
  'Flag live_adjustment aus');
select is(public.beta_admin('flag_on', 'gruender-2', p_flag => 'live_adjustment'), '{"result": "flag_on"}',
  'Flag live_adjustment an');
select is(public.beta_admin('grant', 'gruender-1', 'nutzer-a@example.test', 181, 'live_adjustment') ->> 'result',
  'invalid_input', 'tage > 180 → invalid_input');
select is(public.beta_admin('grant', 'gruender 1', 'nutzer-a@example.test', 30, 'live_adjustment'),
  '{"result": "invalid_input"}', 'ungültiger p_actor → invalid_input ohne Echo');
select is(public.beta_admin('grant', 'gruender-1', E'nutzer-a@example.test\n::set-output', 30, 'live_adjustment'),
  '{"result": "invalid_input"}', 'E-Mail mit Zeilenumbruch → invalid_input ohne Echo');
select is(public.beta_admin('grant', 'gruender-1', 'NUTZER-B@example.TEST', 30, 'live_adjustment') ->> 'result',
  'granted', 'Freischalten: E-Mail-Vergleich mit lower()');
select ok((select bool_and(not (v::text ~ '@|[0-9a-f]{8}-[0-9a-f]{4}'))
           from (select public.beta_admin('grant', 'gruender-1', 'nutzer-b@example.test', 30, 'live_adjustment') v
                 union all select public.beta_admin('status', 'gruender-1', p_flag => 'live_adjustment')
                 union all select public.beta_admin('revoke', 'gruender-1', 'nutzer-b@example.test', p_flag => 'live_adjustment')
                 union all select public.beta_admin('grant', 'gruender-1', 'unbekannt@example.test', 30, 'live_adjustment')) x),
  'Antworten ohne E-Mail und ohne user_id');
select is((select array_agg(k order by k) from jsonb_object_keys(
  public.beta_admin('status', 'gruender-1', p_flag => 'live_adjustment')) k),
  array['active_grants', 'adjustments_7d', 'failed_events', 'flag', 'flag_enabled', 'open_events', 'result'],
  'Status: nur Kennzahlen');
select results_eq(
  $$ select (s ->> 'flag_enabled')::boolean, (s ->> 'active_grants')::int, (s ->> 'open_events')::int,
            (s ->> 'failed_events')::int
     from (select public.beta_admin('status', 'gruender-1', p_flag => 'live_adjustment') s) x $$,
  $$ values (true, 1, 2, 1) $$, 'Status-Zahlen: Flag, Freischaltungen, offene Ereignisse, Fehlversuche ≥ 5');
reset role;
select results_eq(
  $$ select action, actor, flag_key from private.admin_actions where flag_key = 'live_adjustment' order by id $$,
  $$ values ('flag_off', 'gruender-1', 'live_adjustment'), ('flag_on', 'gruender-2', 'live_adjustment') $$,
  'Protokoll in admin_actions mit GitHub-Namen');

-- ---------------------------------------------------------------------------------------------------------
-- Export (Wächter K4) und Widerruf health_data
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.adjustment('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000001', '00000000000000a1', true, false);
select pg_temp.adjustment('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', '00000000000000a2', false, true);
select pg_temp.adjustment('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', '00000000000000a3', false, false);
select pg_temp.adjustment('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-0000-4000-8000-000000000001', '00000000000000b1', false, false);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq(
  $$ select jsonb_array_length(d -> 'plan_adjustments'), jsonb_array_length(d -> 'adjustment_events'),
            jsonb_array_length(d -> 'beta_entitlements'), jsonb_array_length(d -> 'live_adjust_hourly_counts')
     from (select public.export_my_data() -> 'data' d) x $$,
  $$ values (3, 3, 1, 1) $$, 'Export: eigene Anpassungen, offene Ereignisse, Beta-Freischaltung, Zähler (K4)');
select is((select array_agg(k order by k) from jsonb_object_keys(
  public.export_my_data() -> 'data' -> 'adjustment_events' -> 0) k),
  array['attempts', 'created_at', 'trigger'], 'Ereignisse im Export ohne Verweise');
select is((select count(*)::int from public.plan_adjustments), 3, 'nur eigene Anpassungen lesbar (RLS)');
reset role;
update public.consents set revoked_at = now()
where user_id = '11111111-1111-4111-8111-111111111111' and consent_type = 'health_data';
select results_eq(
  $$ select input_fingerprint from public.plan_adjustments order by input_fingerprint $$,
  $$ values ('fewer_days:00000000000000a3'), ('fewer_days:00000000000000b1') $$,
  'Widerruf: from_health_plan/uses_body_data gelöscht, übrige Anpassungen (und fremde) bleiben');
select is(pg_temp.events('11111111-1111-4111-8111-111111111111'), 'slots_changed',
  'Widerruf: Ereignisse zu Messungen und Zielen gelöscht');

-- ---------------------------------------------------------------------------------------------------------
-- save_training_plan: offene Vorschläge verfallen (Ausnahme: weniger Trainingstage des gerade ersetzten Plans)
-- ---------------------------------------------------------------------------------------------------------
select pg_temp.adjustment('44444444-4444-4444-8444-444444444444', 'dddddddd-0000-4000-8000-000000000001', '00000000000000d1', false, false, 'pending_confirmation');
insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version,
  engine_version, match_quality, inputs, start_date)
values ('dddddddd-0000-4000-8000-000000000002', '44444444-4444-4444-8444-444444444444', 'replaced', now() - interval '1 day',
  'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{"experienceLevel": "beginner"}', '2026-09-01');
select pg_temp.adjustment('44444444-4444-4444-8444-444444444444', 'dddddddd-0000-4000-8000-000000000002', '00000000000000d2', false, false, 'pending_confirmation');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select lives_ok($$ select public.save_training_plan(pg_temp.plan_payload()) $$, 'neuer Plan gespeichert');
reset role;
select results_eq(
  $$ select input_fingerprint, status::text from public.plan_adjustments
     where user_id = '44444444-4444-4444-8444-444444444444' order by input_fingerprint $$,
  $$ values ('fewer_days:00000000000000d1', 'pending_confirmation'), ('fewer_days:00000000000000d2', 'expired') $$,
  'Planwechsel: Vorschlag eines älteren Plans verfällt, „weniger Tage“ des gerade ersetzten bleibt kurz offen');

-- ---------------------------------------------------------------------------------------------------------
-- append_plan_block: höchstens L Belastungswochen in Folge über die Blockgrenze (S-n1; Plan ohne Gesundheits-Check
-- → vorsichtig, L = 4)
-- ---------------------------------------------------------------------------------------------------------
update public.user_plans set status = 'replaced', replaced_at = now() where user_id = '44444444-4444-4444-8444-444444444444' and status = 'active';
update public.user_plans set status = 'active', replaced_at = null where id = 'dddddddd-0000-4000-8000-000000000001';
-- Der Planwechsel oben hat die geplanten Einheiten ab gestern entfernt – Wochen 2 und 3 wieder anlegen.
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de,
  focus, estimated_minutes, warmup_de, cooldown_de)
select 'dddddddd-0000-4000-8000-000000000001', '44444444-4444-4444-8444-444444444444', 1, w, 1,
  date '2026-10-05' + 7 * (w - 1), 'Ganzkörper', 'full_body', 50, 'A.', 'B.'
from generate_series(2, 3) w;
select is(private.plan_load_weeks('dddddddd-0000-4000-8000-000000000001'), 4,
  'L = 4 (Einsteiger ohne Gesundheits-Check → vorsichtig)');
select is(private.plan_load_weeks('aaaaaaaa-0000-4000-8000-000000000002'), 4,
  'Einsteiger-Plan ohne Gesundheitsbezug → 4');
update public.user_plans set uses_health_data = true where id = 'dddddddd-0000-4000-8000-000000000002';
select is(private.plan_load_weeks('dddddddd-0000-4000-8000-000000000002'), 5,
  'Einsteiger mit Gesundheits-Check ohne Auffälligkeit → 5');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select is(public.append_plan_block('dddddddd-0000-4000-8000-000000000001', jsonb_build_array(pg_temp.session(14, 2))),
  2, 'Folgeblock: 4. Belastungswoche in Folge → gültig');
select throws_ok($$ select public.append_plan_block('dddddddd-0000-4000-8000-000000000001',
  jsonb_build_array(pg_temp.session(21, 3))) $$, '23514',
  'Der Folgeblock hat zu viele Belastungswochen ohne Erholungswoche.',
  'Folgeblock mit 5. Belastungswoche in Folge → abgelehnt');
select is(public.append_plan_block('dddddddd-0000-4000-8000-000000000001',
  jsonb_build_array(pg_temp.session(21, 3, 1, true), pg_temp.session(28, 3, 2))),
  3, 'Folgeblock, der mit der Erholungswoche beginnt → gültig');
reset role;
-- Erster Block mit Woche 0 + L Belastungswochen ist gültig (Woche 0 zählt nicht).
select is(jsonb_array_length(private.week_invariant_violations(
  (select jsonb_agg(jsonb_build_object('block_no', 1, 'week_no', w, 'scheduled_on', date '2026-10-04' + 7 * w,
     'is_deload', w = 5, 'is_intro_week', w = 1, 'kind', 'strength', 'estimated_minutes', 45,
     'exercises', jsonb_build_array(jsonb_build_object('exercise_id', 'uebung-a', 'sets',
       case when w = 5 then 2 else 3 end, 'rpe_target', case when w = 5 then 5 else 7 end))))
   from generate_series(0, 5) w),
  '{"maxLoadWeeks": 4}')), 0, 'Woche 0 + L Belastungswochen + Erholungswoche: keine Verstöße (S-n1)');

select * from finish();
rollback;
