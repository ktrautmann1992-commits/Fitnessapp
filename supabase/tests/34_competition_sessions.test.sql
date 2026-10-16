-- Phase 10 · Etappe WP3 (docs/PLAN-PHASE-10.md Abschnitt 7): Einheiten des Wettkampfplans in planned_sessions.
-- - Pläne ohne Wettkampf: Eingabe ohne neue Felder speichert wie bisher, Anstrengung ohne Art weiter höchstens 4,
-- - neue Felder: Art + Phase + Schritte zusammen, nur Ausdauer, Schritte strikt (Struktur, Summe = Dauer, Größe),
--   Anstrengung 1–8 und über 4 nur bei harter Art, harte Art in einer Erholungswoche nur im Tapering, Distanz 100–60.000,
-- - je Person (private.insert_plan_sessions): nur mit Gesundheits-Check, nicht in der Schwangerschaft, unter 18 kein
--   Marathon und höchstens 7, ab 65 höchstens 6, Arzt-Hinweis ohne harte Abschnitte, harte Einheiten je Woche
--   (Einsteiger/vorsichtig 1, sonst 2) – auch über append_plan_block,
-- - Verschieben einer Wettkampf-Einheit als authenticated (CHECK mit Funktion) und Export der neuen Spalten.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(56);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A: 36 Jahre, Check ohne Flag (Level je Test in den Angaben). Y: 17 Jahre. S: 70 Jahre. F: Flag (Medikamente).
-- P: Schwangerschaft. N: ohne Gesundheits-Check (Einwilligung ja). Alle mit Einwilligung health_data.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-y@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-s@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-f@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-p@example.test'),
  ('66666666-6666-4666-8666-666666666666', 'nutzer-n@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u.id, t, 1, 'web'
from auth.users u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '2009-06-01'),
  ('33333333-3333-4333-8333-333333333333', '1956-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01'),
  ('55555555-5555-4555-8555-555555555555', '1990-01-01'),
  ('66666666-6666-4666-8666-666666666666', '1990-01-01');
insert into public.health_screening (user_id, medical_notice_acknowledged_at, answers)
select u, now(), jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
  'dizziness', false, 'blood_pressure', false, 'bone_joint', false,
  'medication', u = '44444444-4444-4444-8444-444444444444', 'other_reason', false,
  'pregnancy', u = '55555555-5555-4555-8555-555555555555')
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555']::uuid[]) as u;

-- Einheiten wie toSavePlanSession() (packages/core); Tage ab Montag, 12.10. + Versatz.
create function pg_temp.easy(p_day integer, p_block integer default 1) returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Lockerer Dauerlauf',
    'focus', null, 'endurance_modality', 'run', 'effort_target', 4, 'estimated_minutes', 30,
    'warmup_de', '5 Minuten zügig gehen.', 'cooldown_de', '5 Minuten locker auslaufen.',
    'exercises', '[]'::jsonb
  )
$$;
-- Wettkampf-Einheit: Schritte 10 min locker (3), Hauptteil (p_work_s Sekunden, Anstrengung p_effort), Rest locker.
create function pg_temp.steps(p_minutes integer, p_effort integer, p_work_s integer default 600) returns jsonb
language sql as $$
  select jsonb_build_array(
    jsonb_build_object('part', 'warmup', 'kind', 'easy', 'seconds', 600, 'effort', 3),
    jsonb_build_object('part', 'main', 'kind', 'work', 'seconds', p_work_s, 'effort', p_effort),
    jsonb_build_object('part', 'cooldown', 'kind', 'easy', 'seconds', p_minutes * 60 - 600 - p_work_s, 'effort', 3)
  )
$$;
create function pg_temp.workout(
  p_day integer, p_type text, p_effort integer, p_phase text default 'build', p_deload boolean default false,
  p_block integer default 1, p_minutes integer default 40, p_steps jsonb default null, p_week integer default 1
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', p_week, 'is_intro_week', false, 'is_deload', p_deload, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Tempolauf',
    'focus', null, 'endurance_modality', 'run', 'effort_target', p_effort, 'estimated_minutes', p_minutes,
    'warmup_de', '10 Minuten locker einlaufen.', 'cooldown_de', '5 Minuten locker auslaufen.',
    'exercises', '[]'::jsonb,
    'workout_type', p_type, 'training_phase', p_phase,
    'workout_steps', coalesce(p_steps, pg_temp.steps(p_minutes, case when p_effort > 4 then p_effort else 4 end)),
    'target_distance_m', null
  )
$$;
create function pg_temp.inputs(p_level text default 'advanced', p_discipline text default 'half_marathon')
returns jsonb language sql as $$
  select jsonb_build_object('goalType', 'endurance', 'discipline', p_discipline, 'experienceLevel', p_level,
    'schedule', '{"mode": "flex", "slots": [{"kind": "endurance", "minutes": 40}, {"kind": "endurance", "minutes": 40}, {"kind": "endurance", "minutes": 40}]}'::jsonb,
    'trainingLocation', null, 'homeEquipment', '[]'::jsonb)
$$;
create function pg_temp.payload(
  p_sessions jsonb, p_uses boolean default true, p_notice boolean default false, p_inputs jsonb default null
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '[]'::jsonb,
    'uses_health_data', p_uses, 'medical_notice', p_notice,
    'inputs', coalesce(p_inputs, pg_temp.inputs()), 'start_date', '2026-10-07', 'sessions', p_sessions
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
create function pg_temp.save(p_payload jsonb) returns text language sql as $$
  select pg_temp.error_of(format('select public.save_training_plan(%L::jsonb)', p_payload))
$$;
create function pg_temp.as_user(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true)
$$;

set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');

-- ---------------------------------------------------------------------------------------------------------
-- Pläne ohne Wettkampf: unverändert
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0), pg_temp.easy(2)))), 'kein Fehler',
  'Plan ohne neue Felder speichert wie bisher');
select results_eq(
  $$ select count(*)::int, bool_and(workout_type is null and training_phase is null and workout_steps is null
       and target_distance_m is null) from public.planned_sessions $$,
  $$ values (2, true) $$, 'ohne Wettkampf: neue Spalten leer');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.easy(0) || '{"workout_type": null, "training_phase": null, "workout_steps": null, "target_distance_m": null}'))),
  'kein Fehler', 'neue Felder ausdrücklich null: wie bisher');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0) || '{"effort_target": 5}'))),
  '23514: Ungültige Werte im Plan.', 'ohne Art weiter höchstens Anstrengung 4');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0) || '{"effort_target": 9}'))),
  '23514: Ungültige Werte im Plan.', 'Anstrengung 9 nie (CHECK 1–8)');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0) || '{"foo": 1}'))),
  '22023: Unbekanntes Feld in der Eingabe (Einheit).', 'weiter keine unbekannten Felder');

-- ---------------------------------------------------------------------------------------------------------
-- Wettkampf-Einheiten: Struktur (CHECK)
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'easy', 4, 'base'), pg_temp.workout(2, 'tempo', 7), pg_temp.workout(5, 'intervals', 8, 'peak')))),
  'kein Fehler', 'Fortgeschritten: locker + Tempo 7 + Intervalle 8 in einer Woche');
select results_eq(
  $$ select workout_type::text, training_phase::text, effort_target::int, jsonb_array_length(workout_steps)
     from public.planned_sessions ps join public.user_plans p on p.id = ps.plan_id
     where p.status = 'active' order by scheduled_on $$,
  $$ values ('easy', 'base', 4, 3), ('tempo', 'build', 7, 3), ('intervals', 'peak', 8, 3) $$,
  'Art, Phase, Anstrengung und Schritte gespeichert');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 5)))),
  '23514: Ungültige Werte im Plan.', 'über 4 nur bei harter Art (locker mit 5)');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'strides', 6)))),
  '23514: Ungültige Werte im Plan.', 'Steigerungen sind keine harte Art – Ziel höchstens 4');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'strides', 4, 'base', false, 1, 40,
    pg_temp.steps(40, 7, 120))))), 'kein Fehler', 'Steigerungen: Ziel 4, Abschnitte 7');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', true)))),
  '23514: Ungültige Werte im Plan.', 'harte Art in einer Erholungswoche (Aufbau) abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'race_pace', 6, 'taper', true)))),
  'kein Fehler', 'harte Art im Tapering (is_deload) erlaubt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7) - 'training_phase'))),
  '23514: Ungültige Werte im Plan.', 'Art ohne Phase abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7) || '{"workout_steps": null}'))),
  '23514: Ungültige Werte im Plan.', 'Art ohne Schritte abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0) || '{"training_phase": "base"}'))),
  '23514: Ungültige Werte im Plan.', 'Phase ohne Art abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0) || '{"target_distance_m": 5000}'))),
  '23514: Ungültige Werte im Plan.', 'Distanz ohne Art abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4) || '{"target_distance_m": 99}'))),
  '23514: Ungültige Werte im Plan.', 'Distanz unter 100 m abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4) || '{"target_distance_m": 60001}'))),
  '23514: Ungültige Werte im Plan.', 'Distanz über 60 km abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4) || '{"target_distance_m": 7500}'))),
  'kein Fehler', 'Distanz-Richtwert 7,5 km gespeichert');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4) || '{"target_distance_m": 7500.5}'))),
  '22P02: Ungültige Werte im Plan.', 'Distanz nur ganze Meter');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'sprint', 4)))),
  '22P02: Ungültige Werte im Plan.', 'unbekannte Art abgelehnt');
-- Schritte
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    pg_temp.steps(41, 7))))), '23514: Ungültige Werte im Plan.', 'Schritte: Summe ≠ Dauer abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    jsonb_set(pg_temp.steps(40, 7), '{0,foo}', '1'))))), '23514: Ungültige Werte im Plan.',
  'Schritte: unbekannter Schlüssel abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    pg_temp.steps(40, 7) #- '{0,effort}')))), '23514: Ungültige Werte im Plan.', 'Schritte: fehlender Schlüssel abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    jsonb_set(pg_temp.steps(40, 7), '{0,part}', '"sprint"'))))), '23514: Ungültige Werte im Plan.',
  'Schritte: unbekannter Teil abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    jsonb_set(pg_temp.steps(40, 7), '{1,effort}', '7.5'))))), '23514: Ungültige Werte im Plan.',
  'Schritte: Anstrengung nur ganzzahlig');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    jsonb_set(pg_temp.steps(40, 7), '{1,effort}', '11'))))), '23514: Ungültige Werte im Plan.',
  'Schritte: Anstrengung höchstens 10');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    jsonb_set(jsonb_set(pg_temp.steps(40, 7), '{1,seconds}', '9'), '{2,seconds}', '1791'))))),
  '23514: Ungültige Werte im Plan.', 'Schritte: mindestens 10 Sekunden');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4, 'base', false, 1, 41,
    (select jsonb_agg(jsonb_build_object('part', 'main', 'kind', 'easy', 'seconds', 60, 'effort', 3)) from generate_series(1, 41)))))),
  '23514: Ungültige Werte im Plan.', 'Schritte: höchstens 40');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4, 'base', false, 1, 40,
    (select jsonb_agg(jsonb_build_object('part', 'main', 'kind', 'easy', 'seconds', 60, 'effort', 3)) from generate_series(1, 40)))))),
  'kein Fehler', 'Schritte: 40 erlaubt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7) || '{"workout_steps": {"part": "main"}}'))),
  '23514: Ungültige Werte im Plan.', 'Schritte: nur als Liste');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    jsonb_set(pg_temp.workout(0, 'tempo', 7), '{exercises}', '[]') || '{"kind": "strength", "focus": "full_body", "template_day_index": 1, "endurance_modality": null, "effort_target": null}'))),
  '22023: Ohne Vorlage sind nur Ausdauer-Einheiten möglich.', 'Kraft ohne Vorlage weiter abgelehnt');
select ok(not private.workout_steps_valid('[{"part": "main", "kind": "work", "seconds": 600, "effort": 3}]', null)
  and not private.workout_steps_valid(null, 10) and not private.workout_steps_valid('"x"', 10)
  and private.workout_steps_valid('[{"part": "main", "kind": "work", "seconds": 600, "effort": 3}]', 10),
  'workout_steps_valid: nie ein Fehler, nur true/false');

-- ---------------------------------------------------------------------------------------------------------
-- Regeln je Person
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(3, 'intervals', 8),
    pg_temp.workout(5, 'race_pace', 6, 'peak')))),
  '23514: Zu viele harte Einheiten in einer Woche.', 'Fortgeschritten: höchstens 2 harte Einheiten je Woche');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(3, 'fartlek', 6)),
    true, false, pg_temp.inputs('beginner'))),
  '23514: Zu viele harte Einheiten in einer Woche.', 'Einsteiger: höchstens 1 harte Einheit je Woche');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(7, 'fartlek', 6)),
    true, false, pg_temp.inputs('beginner'))),
  'kein Fehler', 'Einsteiger: je eine harte Einheit in zwei Wochen');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7)), false, false)),
  '22023: Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.',
  'Plan-Gesundheitsbezug weiter vom Server bestimmt');
-- Folgeblock: Zählung über den ganzen Plan (Woche des Folgeblocks), Regeln auch in append_plan_block.
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(3, 'intervals', 8)))),
  'kein Fehler', 'Plan mit 2 harten Einheiten in Woche 1');
select is(pg_temp.error_of(format('select public.append_plan_block(%L, %L::jsonb)',
    (select id from public.user_plans where status = 'active'),
    jsonb_build_array(pg_temp.workout(7, 'tempo', 7, 'peak', false, 2), pg_temp.workout(9, 'intervals', 8, 'peak', false, 2),
      pg_temp.workout(11, 'race_pace', 6, 'peak', false, 2)))),
  '23514: Zu viele harte Einheiten in einer Woche.', 'Folgeblock: höchstens 2 harte Einheiten je Woche');
select is(pg_temp.error_of(format('select public.append_plan_block(%L, %L::jsonb)',
    (select id from public.user_plans where status = 'active'),
    jsonb_build_array(pg_temp.workout(7, 'tempo', 7, 'peak', false, 2), pg_temp.workout(9, 'easy', 4, 'peak', false, 2)))),
  'kein Fehler', 'Folgeblock mit Wettkampf-Einheiten');
-- Verschieben einer Wettkampf-Einheit als authenticated (CHECK mit private.workout_steps_valid läuft mit).
with moved as (
  update public.planned_sessions set scheduled_on = scheduled_on + 1
  where workout_type = 'easy' and block_no = 2
  returning 1
)
select is(count(*)::int, 1, 'Wettkampf-Einheit verschieben (authenticated, Spalten-Recht + CHECK)') from moved;
select ok((public.export_my_data() -> 'data' -> 'planned_sessions' -> 0) ?& array['workout_type', 'training_phase',
    'workout_steps', 'target_distance_m'], 'Export enthält die neuen Spalten');

-- Unter 18
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'intervals', 8)))),
  '23514: Die geplante Anstrengung ist zu hoch.', 'unter 18: Anstrengung 8 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    pg_temp.steps(40, 7))))), 'kein Fehler', 'unter 18: Anstrengung 7 erlaubt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7, 'build', false, 1, 40,
    pg_temp.steps(40, 8))))), '23514: Die geplante Anstrengung ist zu hoch.', 'unter 18: Abschnitt mit 8 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(3, 'fartlek', 6)))),
  '23514: Zu viele harte Einheiten in einer Woche.', 'unter 18 (vorsichtig): höchstens 1 harte Einheit je Woche');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4)), true, false,
    pg_temp.inputs('advanced', 'marathon'))),
  '23514: Für diese Distanz gibt es noch keinen Wettkampfplan.', 'unter 18: kein Marathon-Wettkampfplan');

-- Ab 65
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7)))),
  '23514: Die geplante Anstrengung ist zu hoch.', 'ab 65: Anstrengung 7 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'fartlek', 6)))),
  'kein Fehler', 'ab 65: „zügig“ bis 6 erlaubt');

-- Arzt-Hinweis
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'fartlek', 6)), true, true)),
  '23514: Mit dem Hinweis aus dem Gesundheits-Check sind keine harten Einheiten möglich.',
  'Arzt-Hinweis: keine harte Art');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'strides', 4, 'base', false, 1, 40,
    pg_temp.steps(40, 7, 120))), true, true)),
  '23514: Mit dem Hinweis aus dem Gesundheits-Check sind keine harten Einheiten möglich.',
  'Arzt-Hinweis: keine Steigerungen (Abschnitt ab 6)');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4, 'base')), true, true)),
  'kein Fehler', 'Arzt-Hinweis: lockerer Wettkampfplan („Ankommen“) erlaubt');

-- Schwangerschaft, ohne Check
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4, 'base')), true, true)),
  '23514: In der Schwangerschaft gibt es keinen Wettkampfplan.', 'Schwangerschaft: kein Wettkampfplan');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0)), true, true)),
  'kein Fehler', 'Schwangerschaft: Grundlagen-Plan weiter möglich');
select pg_temp.as_user('66666666-6666-4666-8666-666666666666');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'easy', 4, 'base')), false, false)),
  '23514: Ein Wettkampfplan braucht den Gesundheits-Check.', 'ohne Gesundheits-Check: kein Wettkampfplan');

select * from finish();
rollback;
