-- Etappe B3 (docs/PLAN-PHASE-3-ERWEITERUNG.md Abschnitt 4.4): Einheiten mit Art (Kraft/Ausdauer), Pläne ohne
-- Vorlage nur mit Ausdauer, Angaben-Format der Engine-Version 2 mit verschachtelter Prüfung von `schedule`.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

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
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
values ('uebung-a', 1, 'published', 'Übung uebung-a', 'Exercise a', 'squat', '{quadriceps}', '{}', 'compound',
  'bodyweight', 1, 'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values ('vorlage-a', 2, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- Einheiten wie toSavePlanSession() (packages/core); Tage ab Montag, 12.10. + Versatz.
create function pg_temp.strength(p_day integer, p_block integer default 1) returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'strength',
    'template_day_index', 1, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Ganzkörper A',
    'focus', 'full_body', 'endurance_modality', null, 'effort_target', null, 'estimated_minutes', 50,
    'warmup_de', 'Aufwärmen.', 'cooldown_de', 'Ausklingen.',
    'exercises', jsonb_build_array(jsonb_build_object(
      'order_no', 1, 'exercise_id', 'uebung-a', 'source_exercise_id', 'uebung-a', 'exercise_name_de', 'Übung A',
      'sets', 3, 'reps_min', 8, 'reps_max', 12, 'duration_s', null, 'rest_s', 120, 'rpe_target', 7,
      'superset_group', null, 'notes_de', null, 'target_weight_kg', null
    ))
  )
$$;
create function pg_temp.endurance(p_day integer, p_block integer default 1, p_minutes integer default 30)
returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Lockerer Dauerlauf',
    'focus', null, 'endurance_modality', 'run', 'effort_target', 4, 'estimated_minutes', p_minutes,
    'warmup_de', '5 Minuten zügig gehen.', 'cooldown_de', '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
    'exercises', '[]'::jsonb
  )
$$;
create function pg_temp.inputs() returns jsonb language sql as $$
  select '{"goalType": "endurance", "discipline": "10k", "experienceLevel": "beginner",
           "schedule": {"mode": "flex", "slots": [{"kind": "endurance", "minutes": 30}, {"kind": "endurance", "minutes": 30}]},
           "trainingLocation": null,
           "homeEquipment": [{"equipmentId": "barbell", "weightsKg": [1.25, 2.5], "barKg": 15}]}'::jsonb
$$;
create function pg_temp.payload(p_sessions jsonb, p_template text default null, p_inputs jsonb default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', p_template,
    'template_title_de', case when p_template is null then null else 'Vorlage A für Tests' end,
    'template_version', case when p_template is null then null else 2 end,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '["endurance_basic_only", "endurance_volume_ramped"]'::jsonb,
    'uses_health_data', false, 'medical_notice', false,
    'inputs', coalesce(p_inputs, pg_temp.inputs()), 'start_date', '2026-10-07', 'sessions', p_sessions
  )
$$;
create function pg_temp.with_input(p_path text[], p_value jsonb) returns jsonb language sql as $$
  select pg_temp.payload(jsonb_build_array(pg_temp.endurance(0)), null, jsonb_set(pg_temp.inputs(), p_path, p_value))
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
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur
-- ---------------------------------------------------------------------------------------------------------
select has_column('public', 'planned_sessions', 'kind', 'planned_sessions.kind');
select has_column('public', 'planned_sessions', 'endurance_modality', 'planned_sessions.endurance_modality');
select has_column('public', 'planned_sessions', 'effort_target', 'planned_sessions.effort_target');
select col_is_null('public', 'planned_sessions', 'focus', 'focus nullable (Ausdauer)');
select col_is_null('public', 'user_plans', 'template_id', 'template_id nullable (reiner Ausdauer-Plan)');
select is(
  (select array_agg(e order by e) from unnest(enum_range(null::public.plan_note)::text[]) e
   where e in ('endurance_days_capped', 'endurance_volume_ramped', 'endurance_walk', 'rest_day_added',
               'week_total_capped', 'endurance_basic_only')),
  array['endurance_basic_only', 'endurance_days_capped', 'endurance_volume_ramped', 'endurance_walk',
        'rest_day_added', 'week_total_capped'],
  'neue Hinweis-Codes vorhanden'
);

-- ---------------------------------------------------------------------------------------------------------
-- Reiner Ausdauer-Plan (ohne Vorlage)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(pg_temp.endurance(0), pg_temp.endurance(3)))) $$,
  'reiner Ausdauer-Plan ohne Vorlage wird gespeichert'
);
select is(
  (select count(*)::int from public.planned_sessions where kind = 'endurance' and endurance_modality = 'run'
     and effort_target = 4 and focus is null and template_day_index is null),
  2, 'Ausdauer-Einheiten mit Modalität und Anstrengung, ohne Schwerpunkt'
);
select is_empty($$ select 1 from public.planned_exercises $$, 'Ausdauer-Einheiten haben keine Übungen');
select is(
  (select template_id from public.user_plans where status = 'active'), null::text, 'Plan ohne Vorlage'
);
select is(
  (select inputs -> 'schedule' ->> 'mode' from public.user_plans where status = 'active'), 'flex',
  'Angaben im neuen Format gespeichert'
);

select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(pg_temp.strength(0)))) $$,
  '22023', 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.', 'ohne Vorlage keine Kraft-Einheit'
);
select throws_ok(
  $$ select public.save_training_plan(jsonb_set(pg_temp.payload(jsonb_build_array(pg_temp.endurance(0))),
       '{template_title_de}', '"Vorlage A für Tests"')) $$,
  '22023', 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.', 'Vorlage: alle drei Angaben oder keine'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.endurance(0), '{exercises}', pg_temp.strength(0) -> 'exercises')))) $$,
  '22023', 'Ungültige Übungen.', 'Ausdauer-Einheit mit Übungen wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.strength(0), '{exercises}', '[]')), 'vorlage-a')) $$,
  '22023', 'Ungültige Übungen.', 'Kraft-Einheit ohne Übungen wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.strength(0), '{focus}', 'null')), 'vorlage-a')) $$,
  '23514', 'Ungültige Werte im Plan.', 'Kraft-Einheit ohne Schwerpunkt wird abgelehnt (ohne Detail)'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.endurance(0), '{effort_target}', 'null')))) $$,
  '23514', 'Ungültige Werte im Plan.', 'Ausdauer ohne Anstrengung wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.endurance(0), '{effort_target}', '5')))) $$,
  '23514', 'Ungültige Werte im Plan.', 'Anstrengung 5 wird abgelehnt (Phase 3 nur locker, ≤ 4)'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(pg_temp.endurance(0, 1, 241)))) $$,
  '23514', 'Ungültige Werte im Plan.', 'Ausdauer über 240 Minuten wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment,0,weightsKg}', '[2.5, 27.5]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Langhantel-Scheibe 27,5 kg in den Angaben wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(pg_temp.endurance(0, 1, 9)))) $$,
  '23514', 'Ungültige Werte im Plan.', 'Ausdauer unter 10 Minuten wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.endurance(0), '{endurance_modality}', '"rudern"')))) $$,
  '22P02', 'Ungültige Werte im Plan.', 'unbekannte Modalität wird abgelehnt'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(
       jsonb_set(pg_temp.strength(0), '{focus}', 'null')), 'vorlage-a')) $$),
  '23514: Ungültige Werte im Plan.', 'Fehlermeldung ohne Detail (keine Zeilenwerte)'
);
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(
       jsonb_build_array(pg_temp.strength(0), pg_temp.endurance(1), pg_temp.strength(2)), 'vorlage-a',
       jsonb_set(pg_temp.inputs(), '{trainingLocation}', '"gym"'))) $$,
  'gemischter Plan mit Vorlage: Kraft und Ausdauer'
);

-- Folgeblock: Plan ohne Vorlage nimmt keine Kraft-Einheit an.
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(jsonb_build_array(pg_temp.endurance(0)))) $$,
  'wieder reiner Ausdauer-Plan'
);
select throws_ok(
  format($$ select public.append_plan_block(%L, jsonb_build_array(pg_temp.strength(14, 2))) $$,
    (select id from public.user_plans where status = 'active')),
  '22023', 'Ohne Vorlage sind nur Ausdauer-Einheiten möglich.', 'Folgeblock ohne Vorlage: keine Kraft-Einheit'
);
select lives_ok(
  format($$ select public.append_plan_block(%L, jsonb_build_array(pg_temp.endurance(14, 2, 33))) $$,
    (select id from public.user_plans where status = 'active')),
  'Folgeblock ohne Vorlage: Ausdauer-Einheit angehängt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Angaben: verschachtelte Prüfung (private.assert_plan_inputs)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,note}', '"x"')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Trainingstag).', 'falscher Schlüssel in slots[] wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,weekday}', '1')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Trainingstag).', 'weekday bei „Tage egal“ wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,extra}', '1')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Zeitplan).', 'zusätzlicher Schlüssel in schedule wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,mode}', '"fixed"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'fester Modus ohne Wochentage wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,kind}', '"yoga"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekannte Trainingsart wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots}', '[]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'leerer Zeitplan wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{sessionsPerWeek}', '3')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Angaben).', 'altes Feld sessionsPerWeek wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment,0,barKg}', '26')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Stange 26 kg wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}',
       '[{"equipmentId": "dumbbells", "weightsKg": [], "barKg": 20}]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Stange nur bei der Langhantel'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}',
       '[{"equipmentId": "dumbbells", "weightsKg": []}]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'fehlendes barKg wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{trainingLocation}', '"garten"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekannter Ort wird abgelehnt (null erlaubt)'
);
select lives_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule}',
       '{"mode": "fixed", "slots": [{"weekday": 1, "kind": "endurance", "minutes": 10},
                                    {"weekday": 7, "kind": "endurance", "minutes": 240}]}')) $$,
  'feste Tage mit 10 und 240 Minuten'
);

reset role;
select is(
  (select count(*)::int from public.planned_sessions where user_id = '22222222-2222-4222-8222-222222222222'),
  0, 'B unberührt'
);

select * from finish();
rollback;
