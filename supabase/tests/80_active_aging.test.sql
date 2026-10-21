-- Fit im Alter · Etappe FA1 (docs/PLAN-FIT-IM-ALTER.md 8.3, Wächter B3): Server-Gegenproben für das Ziel `active_aging`.
-- 1. Enum-Werte (Ziel, Fokus, Muster, Merkmale) und neues Paar Fit im Alter → Abnehmen (goal_pair_allowed, goals-CHECK).
-- 2. Erholungs-Rhythmus des Plans (private.plan_load_weeks): 4 Belastungswochen, auch für Einsteiger (Wächter N1).
-- 3. R1 „schneller steigern“ nie (private.fast_increase_exclusion → 'active_aging'; apply_plan_adjustments →
--    not_allowed), auch wenn nur das AKTUELLE Hauptziel „Fit im Alter“ ist.
-- 4. Schutz-Trigger: Plan mit RPE 7, Bodenübung, Haltezeit über 30 s, Laufen, Anstrengung 4 oder Wettkampf-Art →
--    abgelehnt – auch über save_training_plan; andere Ziele unverändert.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (Berlin). Keine echten Gesundheitsdaten, nur Testwerte.
begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

update private.feature_flags set enabled = false where key = 'premium_open';
update private.feature_flags set enabled = true where key = 'live_adjustment';

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- Übungen: ohne Merkmal, mit Bodenmerkmal, Halteübung (Zeit).
insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de, caution_tags
)
values
  ('ue-stuhl', 1, 'published', 'Aufstehen vom Stuhl', 'Exercise ue-stuhl', 'squat', '{quadriceps}', '{}',
   'compound', 'weight', 1, 'Beschreibung der Übung mit genügend Zeichen.',
   '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}', '{"Ein hilfreicher Tipp."}',
   '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.', '{}'),
  ('ue-boden', 1, 'published', 'Brücke am Boden', 'Exercise ue-boden', 'hip_extension', '{glutes}', '{}',
   'compound', 'bodyweight', 1, 'Beschreibung der Übung mit genügend Zeichen.',
   '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}', '{"Ein hilfreicher Tipp."}',
   '{"Ein typischer Fehler."}', 'Langsam ablegen und ruhig weiteratmen.', '{floor_transfer}'),
  ('ue-halten', 1, 'published', 'Wand-Sitz', 'Exercise ue-halten', 'squat', '{quadriceps}', '{}',
   'compound', 'time', 1, 'Beschreibung der Übung mit genügend Zeichen.',
   '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}', '{"Ein hilfreicher Tipp."}',
   '{"Ein typischer Fehler."}', 'Ruhig weiteratmen, nicht pressen.', '{}');
insert into public.plan_templates (id, version, status, title_de, description_de, goal_type, experience_level,
  sessions_per_week, minutes_min, minutes_max, location)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'general_fitness', 'advanced', 2, 45, 60, 'gym');

-- Person mit Plan (Ziel und Stufe in den Angaben), Gesundheits-Check ohne Flag, Einwilligungen, Freischaltung und
-- Basis-Eintrag (Stuhl 20 kg × 8, reps_max 10) wie in 52_fast_increase_exclusions.test.sql.
create function pg_temp.person(p_n integer, p_goal text, p_level text, p_current_goal text) returns void
language plpgsql as $$
declare
  u uuid := ('80000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid;
  plan_id uuid := ('80100000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid;
begin
  insert into auth.users (id, email) values (u, 'alter-' || p_n || '@example.test');
  insert into public.profiles (user_id, birth_date) values (u, '1980-01-01');
  insert into public.consents (user_id, consent_type, version, platform)
  select u, t, 1, 'web' from unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;
  insert into public.health_screening (user_id, answers)
  values (u, jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
    'dizziness', false, 'blood_pressure', false, 'bone_joint', false, 'medication', false, 'other_reason', false));
  if p_current_goal is not null then
    insert into public.goals (user_id, goal_type) values (u, p_current_goal::public.goal_type);
  end if;
  insert into public.user_plans (id, user_id, status, template_id, template_title_de, template_version,
    engine_version, match_quality, inputs, start_date, uses_health_data, medical_notice)
  values (plan_id, u, 'active', 'vorlage-a', 'Vorlage A für Tests', 1, 3, 'fallback',
    jsonb_build_object('goalType', p_goal, 'experienceLevel', p_level), '2026-09-28', true, false);
  insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, is_intro_week, is_deload,
    template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de, kind)
  values (('80200000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, plan_id, u, 2, 1, false, false, 1,
    '2026-10-07', 'Ganzkörper', 'full_body', 30, 'Aufwärmen.', 'Ausklingen.', 'strength');
  insert into private.beta_entitlements (user_id, granted_by, expires_at)
  values (u, 'gruender-1', now() + interval '30 days');
  insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
  values (('80300000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, u, 'strength', '2026-10-07', 'completed',
    'Ganzkörper', gen_random_uuid(), now());
  insert into public.exercise_logs (session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type, status,
    reps_max, state_weight_kg, state_target_reps, state_extra_set)
  values (('80300000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, u, 1, 'ue-stuhl', 'Aufstehen vom Stuhl',
    'weight', 'done', 10, 20, 8, false);
end;
$$;
create function pg_temp.u(p_n integer) returns uuid language sql as $$
  select ('80000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.plan(p_n integer) returns uuid language sql as $$
  select ('80100000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.sess(p_n integer) returns uuid language sql as $$
  select ('80200000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
-- Übung in die Kraft-Einheit der Person einfügen.
create function pg_temp.add_exercise(p_n integer, p_order integer, p_exercise text, p_rpe numeric,
  p_duration integer default null) returns void language sql as $$
  insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id,
    exercise_name_de, sets, reps_min, reps_max, duration_s, rest_s, rpe_target)
  values (pg_temp.sess(p_n), pg_temp.u(p_n), p_order, p_exercise, p_exercise, 'Übung im Test', 2,
    case when p_duration is null then 8 end, case when p_duration is null then 12 end, p_duration, 90, p_rpe)
$$;
-- Ausdauer-Einheit in den Plan der Person einfügen.
create function pg_temp.add_endurance(p_n integer, p_day date, p_modality text, p_effort integer) returns void
language sql as $$
  insert into public.planned_sessions (plan_id, user_id, block_no, week_no, is_intro_week, is_deload,
    template_day_index, scheduled_on, name_de, focus, endurance_modality, effort_target, estimated_minutes,
    warmup_de, cooldown_de, kind)
  values (pg_temp.plan(p_n), pg_temp.u(p_n), 2, 1, false, false, null, p_day, 'Zügig gehen', null,
    p_modality::public.endurance_modality, p_effort, 20, 'Langsam losgehen.', 'Locker auslaufen.', 'endurance')
$$;
create function pg_temp.fast(p_n integer) returns jsonb language sql as $$
  select jsonb_build_object(
    'rule', 'fast_increase', 'kind', 'state_override', 'requiresConfirmation', false, 'exerciseId', 'ue-stuhl',
    'plannedSessionIds', '[]'::jsonb,
    'basisSessionLogId', ('80300000-0000-4000-8000-' || lpad(p_n::text, 12, '0')), 'basisPerformedOn', '2026-10-07',
    'stateBefore', '{"weightKg": 20, "targetReps": 10, "extraSet": false, "durationS": null}'::jsonb,
    'stateAfter', '{"weightKg": 22, "targetReps": 6, "extraSet": false, "durationS": null}'::jsonb,
    'changeBefore', null, 'changeAfter', null, 'explainParams', '{}'::jsonb, 'effectiveFrom', '2026-10-08',
    'expiresOn', null, 'inputFingerprint', 'fast_increase:00000000000000f1', 'engineVersion', 1, 'ruleVersion', 1,
    'usesBodyData', false, 'fromHealthPlan', true)
$$;
create function pg_temp.apply(p_n integer) returns text language sql as $$
  select public.apply_plan_adjustments(pg_temp.u(p_n), jsonb_build_object(
    'plan_id', pg_temp.plan(p_n), 'trigger', 'session_logged',
    'max_load_weeks', private.plan_load_weeks(pg_temp.plan(p_n)), 'adjustments', jsonb_build_array(pg_temp.fast(p_n))))
    ->> 'result'
$$;

--                    Nr  Ziel des Plans     Stufe       aktuelles Hauptziel
select pg_temp.person(1, 'active_aging',    'advanced', 'active_aging');
select pg_temp.person(2, 'general_fitness', 'advanced', 'general_fitness');
select pg_temp.person(3, 'general_fitness', 'advanced', 'active_aging');
select pg_temp.person(4, 'active_aging',    'beginner', null);
select pg_temp.person(5, 'general_fitness', 'beginner', null);

-- ---------------------------------------------------------------------------------------------------------
-- 1. Enum-Werte und Paar
-- ---------------------------------------------------------------------------------------------------------
select ok('active_aging' = any (enum_range(null::public.goal_type)::text[]), 'goal_type kennt active_aging');
select ok('balance' = any (enum_range(null::public.session_focus)::text[]), 'session_focus kennt balance (Variante B)');
select ok('balance' = any (enum_range(null::public.movement_pattern)::text[]), 'movement_pattern kennt balance');
select ok(
  enum_range(null::public.caution_tag)::text[] @> array['floor_transfer', 'spinal_flexion', 'loaded_flexion',
    'trunk_rotation', 'deep_hip_flexion', 'hip_cross_midline'],
  'caution_tag kennt die sechs neuen Merkmale'
);
select ok(not ('balance' = any (enum_range(null::public.planned_session_kind)::text[])),
  'keine neue Einheit-Art (Variante B)');
select ok(private.goal_pair_allowed('active_aging', 'fat_loss'), 'Fit im Alter → Abnehmen erlaubt (FA-G6)');
select ok(
  not private.goal_pair_allowed('active_aging', 'muscle_gain')
  and not private.goal_pair_allowed('active_aging', 'endurance')
  and not private.goal_pair_allowed('fat_loss', 'active_aging'),
  'andere Paare mit Fit im Alter verboten'
);
select lives_ok(
  $$ update public.goals set secondary_goal_type = 'fat_loss' where user_id = pg_temp.u(1) $$,
  'goals: Fit im Alter + Abnehmen speicherbar'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'endurance' where user_id = pg_temp.u(1) $$,
  '23514', null, 'goals: Fit im Alter + Ausdauer → CHECK'
);
update public.goals set goal_type = 'muscle_gain' where user_id = pg_temp.u(1);
select is(
  (select secondary_goal_type from public.goals where user_id = pg_temp.u(1)), 'fat_loss'::public.goal_type,
  'Autoclear: unverändertes, weiter erlaubtes Nebenziel bleibt (Muskelaufbau → Abnehmen)'
);
update public.goals set goal_type = 'active_aging' where user_id = pg_temp.u(1);
select is(
  (select secondary_goal_type from public.goals where user_id = pg_temp.u(1)), 'fat_loss'::public.goal_type,
  'zurück zu Fit im Alter: Abnehmen bleibt erlaubt'
);

-- ---------------------------------------------------------------------------------------------------------
-- 2. Erholungs-Rhythmus
-- ---------------------------------------------------------------------------------------------------------
select is(private.plan_load_weeks(pg_temp.plan(4)), 4, 'Fit im Alter, Einsteiger: Erholung nach 4 Wochen');
select is(private.plan_load_weeks(pg_temp.plan(5)), 5, 'andere Ziele, Einsteiger: unverändert 5 Wochen');
select is(private.plan_load_weeks(pg_temp.plan(1)), 4, 'Fit im Alter, aktiv: 4 Wochen');

-- ---------------------------------------------------------------------------------------------------------
-- 3. R1 nie
-- ---------------------------------------------------------------------------------------------------------
select is(private.fast_increase_exclusion(pg_temp.u(1), pg_temp.plan(1), '2026-10-07'), 'active_aging',
  'Plan mit Ziel Fit im Alter → active_aging');
select is(private.fast_increase_exclusion(pg_temp.u(3), pg_temp.plan(3), '2026-10-07'), 'active_aging',
  'aktuelles Hauptziel Fit im Alter (Plan noch anders) → active_aging');
select is(private.fast_increase_exclusion(pg_temp.u(2), pg_temp.plan(2), '2026-10-07'), null::text,
  '44-Jähriger, Allgemeine Fitness, aktiv → kein Ausschluss (unverändert)');
select is(pg_temp.apply(1), 'not_allowed', 'apply_plan_adjustments: R1 bei Fit im Alter → not_allowed');
select is(pg_temp.apply(3), 'not_allowed', 'apply_plan_adjustments: R1 bei aktuellem Ziel Fit im Alter → not_allowed');
select is((select count(*) from public.plan_adjustments a where a.user_id in (pg_temp.u(1), pg_temp.u(3))), 0::bigint,
  'nichts geschrieben');
select is(pg_temp.apply(2), 'ok', 'Gegenprobe: R1 bei Allgemeiner Fitness bleibt erlaubt');

-- ---------------------------------------------------------------------------------------------------------
-- 4. Schutz-Trigger
-- ---------------------------------------------------------------------------------------------------------
select lives_ok($$ select pg_temp.add_exercise(1, 1, 'ue-stuhl', 6) $$, 'RPE 6 bei Fit im Alter → erlaubt');
select throws_ok($$ select pg_temp.add_exercise(1, 2, 'ue-stuhl', 7) $$, '23514',
  'Diese Übung passt nicht zum Ziel „Fit im Alter“.', 'RPE 7 bei Fit im Alter → abgelehnt');
select throws_ok($$ select pg_temp.add_exercise(1, 2, 'ue-stuhl', 6.5) $$, '23514', null,
  'RPE 6,5 bei Fit im Alter → abgelehnt');
select throws_ok($$ select pg_temp.add_exercise(1, 2, 'ue-boden', 5) $$, '23514', null,
  'Bodenübung (floor_transfer) bei Fit im Alter → abgelehnt');
select throws_ok($$ select pg_temp.add_exercise(1, 2, 'ue-halten', 6, 45) $$, '23514', null,
  'Halteübung 45 s bei Fit im Alter → abgelehnt');
select lives_ok($$ select pg_temp.add_exercise(1, 2, 'ue-halten', 6, 30) $$, 'Halteübung 30 s → erlaubt');
select throws_ok(
  $$ update public.planned_exercises set rpe_target = 7 where session_id = pg_temp.sess(1) and order_no = 1 $$,
  '23514', null, 'nachträglich RPE 7 (z. B. Anpassung) → abgelehnt'
);
select throws_ok(
  $$ update public.planned_exercises set exercise_id = 'ue-boden' where session_id = pg_temp.sess(1) and order_no = 1 $$,
  '23514', null, 'Tausch auf eine Bodenübung → abgelehnt'
);
select lives_ok($$ select pg_temp.add_exercise(2, 1, 'ue-boden', 8) $$,
  'Gegenprobe Allgemeine Fitness: RPE 8 und Bodenübung → unverändert erlaubt');
select lives_ok($$ select pg_temp.add_exercise(2, 2, 'ue-halten', 8, 60) $$,
  'Gegenprobe Allgemeine Fitness: Halteübung 60 s → unverändert erlaubt');
select lives_ok($$ select pg_temp.add_endurance(1, '2026-10-08', 'walk', 3) $$, 'Gehen mit Anstrengung 3 → erlaubt');
select throws_ok($$ select pg_temp.add_endurance(1, '2026-10-09', 'walk', 4) $$, '23514',
  'Diese Einheit passt nicht zum Ziel „Fit im Alter“.', 'Anstrengung 4 → abgelehnt');
select throws_ok($$ select pg_temp.add_endurance(1, '2026-10-09', 'run', 3) $$, '23514', null,
  'Laufen bei Fit im Alter → abgelehnt (nur Gehen, Rad, Schwimmen)');
select lives_ok($$ select pg_temp.add_endurance(2, '2026-10-08', 'run', 4) $$,
  'Gegenprobe Allgemeine Fitness: Laufen mit Anstrengung 4 → erlaubt');

-- save_training_plan (als Nutzer, Weg der App): derselbe Schutz über insert_plan_sessions.
create function pg_temp.endurance_payload(p_modality text, p_effort integer) returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 3, 'match_quality', 'exact', 'notes', '[]'::jsonb,
    'uses_health_data', true, 'medical_notice', false,
    'inputs', jsonb_build_object(
      'goalType', 'active_aging', 'discipline', null, 'experienceLevel', 'beginner',
      'schedule', '{"mode": "flex", "slots": [{"kind": "endurance", "minutes": 20}]}'::jsonb,
      'trainingLocation', null, 'homeEquipment', '[]'::jsonb),
    'start_date', '2026-10-07',
    'sessions', jsonb_build_array(jsonb_build_object(
      'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
      'template_day_index', null, 'scheduled_on', '2026-10-12', 'name_de', 'Zügig gehen',
      'focus', null, 'endurance_modality', p_modality, 'effort_target', p_effort, 'estimated_minutes', 20,
      'warmup_de', '5 Minuten langsam gehen.', 'cooldown_de', '5 Minuten locker gehen.',
      'exercises', '[]'::jsonb)))
$$;
grant execute on all functions in schema pg_temp to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"80000000-0000-4000-8000-000000000004","role":"authenticated"}';
select throws_ok($$ select public.save_training_plan(pg_temp.endurance_payload('walk', 4)) $$, '23514',
  'Ungültige Werte im Plan.', 'save_training_plan: Fit-im-Alter-Plan mit Anstrengung 4 → abgelehnt');
select throws_ok($$ select public.save_training_plan(pg_temp.endurance_payload('run', 3)) $$, '23514',
  'Ungültige Werte im Plan.', 'save_training_plan: Fit-im-Alter-Plan mit Laufen → abgelehnt');
select lives_ok($$ select public.save_training_plan(pg_temp.endurance_payload('walk', 3)) $$,
  'save_training_plan: Fit-im-Alter-Plan mit Gehen/Anstrengung 3 → gespeichert');
reset role;

-- Rechte: Schutz-Funktionen nicht direkt aufrufbar.
select ok(
  not has_function_privilege('authenticated', 'private.is_active_aging_plan(uuid)', 'execute')
  and not has_function_privilege('anon', 'private.is_active_aging_plan(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.planned_exercise_active_aging_guard()', 'execute')
  and not has_function_privilege('authenticated', 'private.planned_session_active_aging_guard()', 'execute'),
  'Schutz-Funktionen: kein Recht für anon/authenticated'
);

select * from finish();
rollback;
