-- Phase 3 · save_training_plan / append_plan_block (docs/PLAN-PHASE-3.md Abschnitte 8.1, 8.2, 8.4):
-- Login, Profil, nur bekannte Felder, Werte der Angaben, nur freigegebene Inhalte, Datumsrahmen, Fehlermeldungen
-- ohne Zeilen, Gesundheitsbezug bestimmt die Datenbank selbst, atomares Ersetzen (vergangene Einheiten bleiben),
-- Folgeblock nur max + 1, Widerruf löscht ALLE Pläne mit Gesundheitsdaten, veraltete Einwilligungsversion,
-- Aufräumen ersetzter Pläne.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt; der Rollback
-- stellt das Original wieder her). Gestern = 06.10., vorgestern = 05.10., Montag der nächsten Woche = 12.10.
begin;
create extension if not exists pgtap with schema extensions;
select plan(69);

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
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array[
  '11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444'
]::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01');

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, status::public.content_status, 'Übung ' || id, 'Exercise ' || id, 'squat',
  '{quadriceps}', '{}', 'compound', 'bodyweight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('uebung-a', 'published'), ('uebung-alt', 'archived')) as v(id, status);
insert into public.plan_templates (
  id, version, status, title_de, description_de, goal_type, experience_level, sessions_per_week,
  minutes_min, minutes_max, location
)
values
  ('vorlage-a', 2, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.', 'muscle_gain', 'beginner', 3, 45, 60, 'gym'),
  ('vorlage-alt', 1, 'archived', 'Vorlage alt für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.', 'muscle_gain', 'beginner', 3, 45, 60, 'gym');

-- Eingabe wie toSavePlanPayload() (packages/core); Einheiten ab Montag, 12.10. + Versatz in Tagen.
create function pg_temp.session(
  p_day integer, p_block integer default 1, p_exercise text default 'uebung-a', p_rpe numeric default 7,
  p_week integer default 1, p_intro boolean default false
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', p_block, 'week_no', p_week, 'is_intro_week', p_intro, 'is_deload', false, 'kind', 'strength',
    'template_day_index', 1, 'scheduled_on', date '2026-10-12' + p_day,
    'name_de', 'Ganzkörper A', 'focus', 'full_body', 'endurance_modality', null, 'effort_target', null,
    'estimated_minutes', 50,
    'warmup_de', 'Aufwärmen.', 'cooldown_de', 'Ausklingen.',
    'exercises', jsonb_build_array(jsonb_build_object(
      'order_no', 1, 'exercise_id', p_exercise, 'source_exercise_id', p_exercise, 'exercise_name_de', 'Übung A',
      'sets', 3, 'reps_min', 8, 'reps_max', 12, 'duration_s', null, 'rest_s', 120, 'rpe_target', p_rpe,
      'superset_group', null, 'notes_de', null, 'target_weight_kg', null
    ))
  )
$$;
create function pg_temp.payload(
  p_uses boolean, p_notice boolean, p_sessions jsonb default null, p_template text default 'vorlage-a',
  p_version integer default 2, p_start date default '2026-10-07'
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', p_template, 'template_title_de', 'Vorlage A für Tests', 'template_version', p_version,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '["days_added"]'::jsonb,
    'uses_health_data', p_uses, 'medical_notice', p_notice,
    'inputs', '{"goalType": "muscle_gain", "discipline": null, "experienceLevel": "beginner",
                "schedule": {"mode": "fixed", "slots": [
                  {"weekday": 1, "kind": "strength_gym", "minutes": 45},
                  {"weekday": 3, "kind": "strength_home", "minutes": 45},
                  {"weekday": 5, "kind": "endurance", "minutes": 30}]},
                "trainingLocation": "both",
                "homeEquipment": [{"equipmentId": "dumbbells", "weightsKg": [2, 4, 6.25], "barKg": null}]}'::jsonb,
    'start_date', p_start,
    'sessions', coalesce(p_sessions, jsonb_build_array(pg_temp.session(0), pg_temp.session(2)))
  )
$$;
-- Plan mit geänderten Angaben (Pfad unter inputs).
create function pg_temp.with_input(p_path text[], p_value jsonb) returns jsonb language sql as $$
  select jsonb_set(pg_temp.payload(false, false), array['inputs'] || p_path, p_value)
$$;
-- Fehlercode, Meldung und (falls vorhanden) Detail eines Aufrufs.
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
-- Ältere Gesundheits-Checks zurückdatieren (created_at setzt der Trigger auf now() – in einer Transaktion gleich).
create function pg_temp.age_checks(p_user uuid) returns void language sql as $$
  update public.health_screening set created_at = created_at - interval '1 minute' where user_id = p_user
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Zugriff
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select public.save_training_plan(pg_temp.payload(false, false)) $$, '42501', null, 'anon darf nicht speichern');
select throws_ok(
  $$ select public.append_plan_block('aaaaaaaa-0000-4000-8000-000000000001', jsonb_build_array(pg_temp.session(7, 2))) $$,
  '42501', null, 'anon darf keinen Folgeblock anhängen'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.save_training_plan(pg_temp.payload(false, false)) $$, '42501', 'Nicht angemeldet.', 'ohne Nutzer-ID: Fehler');

set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok($$ select public.save_training_plan(pg_temp.payload(false, false)) $$, '42501', 'Profil fehlt.', 'ohne Profil kein Plan');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer A: Einwilligung gültig, noch kein Gesundheits-Check
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select throws_ok($$ select public.save_training_plan(pg_temp.payload(true, false)) $$, '22023', null, 'ohne Check: uses_health_data = true wird abgelehnt');
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false) || '{"user_id": "22222222-2222-4222-8222-222222222222"}') $$,
  '22023', null, 'fremde user_id in der Eingabe wird abgelehnt (nur bekannte Felder)'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false) || '{"safety_rules": {}}') $$,
  '22023', null, 'Sicherheitsregeln in der Eingabe werden abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(jsonb_set(pg_temp.payload(false, false), '{inputs,healthScreening}', '{"flags": []}')) $$,
  '22023', null, 'Gesundheits-Check in den Angaben wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0) || '{"pregnancyNotice": true}'))) $$,
  '22023', null, 'unbekanntes Feld in einer Einheit wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, null, 'vorlage-alt', 1)) $$,
  '22023', null, 'zurückgezogene Vorlage wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, null, 'vorlage-a', 1)) $$,
  '22023', null, 'veraltete Vorlagen-Version wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0, 1, 'uebung-alt')))) $$,
  '22023', null, 'nicht freigegebene Übung wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0, 2)))) $$,
  '22023', null, 'neuer Plan beginnt mit Block 1'
);

-- Angaben: Werte wie savePlanInputsSchema.
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{goalType}', '"Herzprobleme seit 2019"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Freitext in goalType wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}',
       jsonb_build_array(jsonb_build_object('equipmentId', repeat('x', 1000000), 'weightsKg', '[]'::jsonb)))) $$,
  '22023', 'Ungültige Angaben im Plan.', '1-MB-Wert in den Angaben wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{discipline}', '"ultra"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekannte Disziplin wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,minutes}', '241')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Minuten 241 im Zeitplan werden abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,minutes}', '45.5')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Minuten müssen ganzzahlig sein'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,minutes}', '"45"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Minuten als Text werden abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,1,weekday}', '1')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Wochentag doppelt wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots,0,weekday}', '0')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Wochentag 0 wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{schedule,slots}',
       (select jsonb_agg(jsonb_build_object('kind', 'endurance', 'minutes', 30)) from generate_series(1, 8)))) $$,
  '22023', 'Ungültige Angaben im Plan.', 'mehr als 7 Trainingstage werden abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}', '[{"equipmentId": "zauberstab", "weightsKg": [], "barKg": null}]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekanntes Gerät wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}', '[{"equipmentId": "dumbbells", "weightsKg": [], "barKg": null, "note": "x"}]')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Geräte).', 'zusätzliches Feld bei einem Gerät wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.with_input('{homeEquipment}',
       jsonb_build_array(jsonb_build_object('equipmentId', 'dumbbells', 'barKg', null, 'weightsKg', (select jsonb_agg(g) from generate_series(1, 41) g))))) $$,
  '22023', 'Ungültige Angaben im Plan.', '41 Gewichtsstufen werden abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(jsonb_set(pg_temp.payload(false, false), '{inputs}', (pg_temp.payload(false, false) -> 'inputs') - 'discipline')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'fehlendes Feld in den Angaben wird abgelehnt'
);

-- Datumsrahmen.
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(-7)), 'vorlage-a', 2, '2026-10-06')) $$,
  '22023', 'Einheiten liegen außerhalb des erlaubten Zeitraums.', 'Einheit vorgestern wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, null, 'vorlage-a', 2, '2026-10-05')) $$,
  '22023', 'Der Plan-Start liegt außerhalb des erlaubten Zeitraums.', 'Plan-Start vorgestern wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(4)), 'vorlage-a', 2, '2026-10-15')) $$,
  '22023', 'Der Plan-Start liegt außerhalb des erlaubten Zeitraums.', 'Plan-Start in 8 Tagen wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, null, 'vorlage-a', 2, '2026-10-13')) $$,
  '22023', 'Der Plan-Start liegt nach der ersten Einheit.', 'Plan-Start nach der ersten Einheit wird abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0), pg_temp.session(52)))) $$,
  '22023', 'Einheiten liegen außerhalb des erlaubten Zeitraums.', 'Einheit nach heute + 7 × 7 + 7 Tagen wird abgelehnt'
);

-- Werte vor der Spaltenrundung; Fehlermeldungen ohne Zeile.
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0, 1, 'uebung-a', 7.49)))) $$,
  '23514', 'Ungültige Werte im Plan.', 'RPE 7,49 wird abgelehnt (nicht zu 7,5 gerundet)'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0, 1, 'uebung-a', 10)))) $$),
  '23514: Ungültige Werte im Plan.',
  'CHECK-Fehler: Meldung ohne Detail („Failing row contains“ mit user_id/uses_health_data)'
);
select is(
  pg_temp.error_of($$ select public.save_training_plan(pg_temp.payload(false, false, jsonb_build_array(pg_temp.session(0), pg_temp.session(0)))) $$),
  '23505: Ungültige Werte im Plan.',
  'Index-Fehler (zwei Einheiten am selben Tag): Meldung ohne Schlüsselwerte'
);

-- Gestern und heute + 56 Tage sind die Grenzen.
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(false, false,
       jsonb_build_array(pg_temp.session(-6), pg_temp.session(0), pg_temp.session(2), pg_temp.session(51)),
       'vorlage-a', 2, '2026-10-06')) $$,
  'ohne Check: Plan ohne Gesundheitsdaten (Start und Einheit gestern, letzte Einheit heute + 56 Tage)'
);
select results_eq(
  $$ select uses_health_data, medical_notice, status::text, notes::text[] from public.user_plans $$,
  $$ values (false, false, 'active', array['days_added']) $$,
  'Plan ohne Gesundheitsdaten gespeichert'
);
select is((select count(*) from public.planned_sessions), 4::bigint, 'Einheiten angelegt');

-- Gesundheits-Check mit Herz-Frage „ja“ → Flags.
insert into public.health_screening (answers, medical_notice_acknowledged_at)
values ('{"heart_condition": true, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": false, "medication": false, "other_reason": false}', now());

select throws_ok($$ select public.save_training_plan(pg_temp.payload(false, false)) $$, '22023', null, 'uses_health_data = false trotz Check wird abgelehnt');
select throws_ok($$ select public.save_training_plan(pg_temp.payload(true, false)) $$, '22023', null, 'medical_notice muss zum neuesten Check passen');

-- Atomar: Fehler mitten drin (RPE 10) → alter Plan bleibt aktiv.
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(true, true, jsonb_build_array(pg_temp.session(0), pg_temp.session(2, 1, 'uebung-a', 10)))) $$,
  '23514', null, 'ungültige Dosierung bricht alles ab'
);
select results_eq(
  $$ select count(*)::int, bool_and(uses_health_data = false) from public.user_plans where status = 'active' $$,
  $$ values (1, true) $$,
  'alter Plan bleibt nach dem Fehler aktiv'
);

-- Ersetzen: eine ältere Einheit (01.10., vor gestern) im alten Plan bleibt; ab gestern wird gelöscht – der neue
-- Plan darf gestern belegen, ohne Kollision.
reset role;
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id, user_id, 1, 0, 1, date '2026-10-01', 'Vergangen', 'full_body', 50, 'A.', 'B.'
from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111' and status = 'active';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(true, true,
       jsonb_build_array(pg_temp.session(-6), pg_temp.session(0), pg_temp.session(2)), 'vorlage-a', 2, '2026-10-06')) $$,
  'mit Check und Flag: Plan mit Gesundheitsdaten und Arzt-Hinweis (Einheit gestern trotz altem Plan)'
);
select results_eq(
  $$ select status::text, uses_health_data, medical_notice from public.user_plans order by created_at, status $$,
  $$ values ('active', true, true), ('replaced', false, false) $$,
  'alter Plan ersetzt, neuer aktiv'
);
select results_eq(
  $$ select s.scheduled_on from public.planned_sessions s join public.user_plans p on p.id = s.plan_id
     where p.status = 'replaced' order by 1 $$,
  $$ values (date '2026-10-01') $$,
  'alter Plan: vergangene Einheit bleibt, Einheiten ab gestern entfernt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Folgeblock (letzte Einheit des aktiven Plans: 14.10.)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 1))) $$,
  '22023', null, 'Folgeblock muss block_no = max + 1 haben'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 2, 'uebung-a', 7, 0))) $$,
  '22023', 'Ein Folgeblock hat keine Woche 0 und keine Einstiegswoche.', 'Folgeblock ohne Woche 0'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 2, 'uebung-a', 7, 1, true))) $$,
  '22023', 'Ein Folgeblock hat keine Woche 0 und keine Einstiegswoche.', 'Folgeblock ohne Einstiegswoche'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(1, 2))) $$,
  '22023', 'Einheiten liegen außerhalb des erlaubten Zeitraums.', 'Folgeblock nicht vor der letzten Einheit'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(59, 2))) $$,
  '22023', 'Einheiten liegen außerhalb des erlaubten Zeitraums.', 'Folgeblock höchstens 56 Tage nach der letzten Einheit'
);
select is(
  public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 2), pg_temp.session(9, 2))),
  2, 'Folgeblock 2 angehängt'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(14, 2))) $$,
  '22023', null, 'Block 2 nicht doppelt'
);
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'replaced'), jsonb_build_array(pg_temp.session(14, 2))) $$,
  '42501', null, 'nur an den aktiven Plan'
);

-- B: fremder Plan (echte ID von A).
reset role;
create temporary table a_plan as
select id from public.user_plans where status = 'active' and user_id = '11111111-1111-4111-8111-111111111111';
grant select on a_plan to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select public.append_plan_block((select id from a_plan), jsonb_build_array(pg_temp.session(14, 3))) $$,
  '42501', null, 'B kann an keinen fremden Plan anhängen'
);

-- A: neuer Check OHNE Flag → der Plan mit Arzt-Hinweis passt nicht mehr.
reset role;
select pg_temp.age_checks('11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.health_screening (answers)
values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": false, "medication": false, "other_reason": false}');
select throws_ok(
  $$ select public.append_plan_block((select id from a_plan), jsonb_build_array(pg_temp.session(14, 3))) $$,
  '22023', 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.', 'Folgeblock nach neuem Check ohne Flag abgelehnt'
);
reset role;
select pg_temp.age_checks('11111111-1111-4111-8111-111111111111');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.health_screening (answers, medical_notice_acknowledged_at)
values ('{"heart_condition": true, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": false, "medication": false, "other_reason": false}', now());
select is(
  public.append_plan_block((select id from a_plan), jsonb_build_array(pg_temp.session(14, 3))),
  3, 'wieder Check mit Flag: Folgeblock passt'
);
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data: ALLE Pläne mit Gesundheitsdaten von A werden vollständig gelöscht.
-- ---------------------------------------------------------------------------------------------------------
-- Zusätzlich ein vergangener Tag im Plan mit Gesundheitsdaten (als Eigentümer).
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id, user_id, 1, 1, 1, date '2026-09-07', 'Vergangen', 'full_body', 50, 'A.', 'B.'
from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111' and status = 'active';
-- Ein früherer, ersetzter Plan mit Gesundheitsdaten.
insert into public.user_plans (user_id, status, replaced_at, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date, uses_health_data)
values ('11111111-1111-4111-8111-111111111111', 'replaced', now(), 'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{}', date '2026-08-01', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ update public.consents set revoked_at = now() where consent_type = 'health_data' $$, 'A widerruft health_data');
reset role;
select is(
  (select count(*) from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111' and uses_health_data),
  0::bigint, 'alle Pläne mit Gesundheitsdaten gelöscht (aktiv und ersetzt)'
);
select is(
  (select count(*) from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111' and not uses_health_data),
  1::bigint, 'Plan ohne Gesundheitsdaten bleibt'
);
select results_eq(
  $$ select scheduled_on from public.planned_sessions where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values (date '2026-10-01') $$,
  'alle Einheiten der gelöschten Pläne weg – auch vergangene; nur die des Plans ohne Gesundheitsdaten bleibt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer D: Check ohne Flag, dann mit Flag, dann veraltete Einwilligungsversion
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into public.health_screening (answers)
values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": false, "medication": false, "other_reason": false}');
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(true, true)) $$,
  '22023', 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.', 'D: medical_notice = true ohne Flag wird abgelehnt'
);
select lives_ok($$ select public.save_training_plan(pg_temp.payload(true, false)) $$, 'D: Check ohne Flag → Plan mit Gesundheitsdaten, ohne Arzt-Hinweis');

-- Neuer Check MIT Flag → Folgeblock für den Plan ohne Arzt-Hinweis abgelehnt.
reset role;
select pg_temp.age_checks('44444444-4444-4444-8444-444444444444');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into public.health_screening (answers, medical_notice_acknowledged_at)
values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": true, "pregnancy": false, "medication": false, "other_reason": false}', now());
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 2))) $$,
  '22023', 'Der Plan passt nicht zum aktuellen Gesundheits-Check – bitte neu erstellen.', 'D: Folgeblock nach neuem Check mit Flag abgelehnt'
);
-- Wieder ein Check ohne Flag (neuester).
reset role;
select pg_temp.age_checks('44444444-4444-4444-8444-444444444444');
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
insert into public.health_screening (answers)
values ('{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "pregnancy": false, "medication": false, "other_reason": false}');

reset role;
insert into public.consent_documents (consent_type, version, title_de, body_de, published_at)
values ('health_data', 2, 'Einwilligung Gesundheitsdaten', 'ENTWURF Version 2', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok(
  $$ select public.append_plan_block((select id from public.user_plans where status = 'active'), jsonb_build_array(pg_temp.session(7, 2))) $$,
  '22023', null, 'veraltete Einwilligung: kein Folgeblock für den Plan mit Gesundheitsdaten'
);
select throws_ok($$ select public.save_training_plan(pg_temp.payload(true, false)) $$, '22023', null, 'veraltete Einwilligung: Plan mit Gesundheitsdaten abgelehnt');
select lives_ok($$ select public.save_training_plan(pg_temp.payload(false, false)) $$, 'veraltete Einwilligung: Plan nach Regeln ohne Check wird angenommen');
select results_eq(
  $$ select uses_health_data from public.user_plans where status = 'active' $$,
  $$ values (false) $$,
  'aktiver Plan von D ohne Gesundheitsdaten'
);

-- ---------------------------------------------------------------------------------------------------------
-- Aufräumen ersetzter Pläne (Nutzer B): höchstens 20 ersetzte Pläne ohne Einheiten; Pläne mit vergangenen
-- Einheiten bleiben als Verlauf.
-- ---------------------------------------------------------------------------------------------------------
reset role;
insert into public.user_plans (id, user_id, status, replaced_at, template_id, template_title_de, template_version, engine_version, match_quality, inputs, start_date)
values ('bbbbbbbb-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 'replaced', now() - interval '30 days',
  'vorlage-a', 'Vorlage A für Tests', 2, 1, 'exact', '{}', date '2026-09-01');
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de)
values ('bbbbbbbb-0000-4000-8000-000000000009', '22222222-2222-4222-8222-222222222222', 1, 0, 1, date '2026-09-01', 'Vergangen', 'full_body', 50, 'A.', 'B.');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ do $d$ begin
       for i in 1..23 loop
         perform public.save_training_plan(pg_temp.payload(false, false));
       end loop;
     end $d$ $$,
  'B erzeugt 23 Pläne nacheinander'
);
select results_eq(
  $$ select status::text, count(*)::int from public.user_plans group by status order by status $$,
  $$ values ('active', 1), ('replaced', 21) $$,
  'B: 1 aktiver Plan, 20 ersetzte ohne Einheiten + 1 ersetzter mit vergangener Einheit'
);
select is(
  (select count(*) from public.user_plans where id = 'bbbbbbbb-0000-4000-8000-000000000009'),
  1::bigint, 'ersetzter Plan mit vergangener Einheit bleibt'
);
reset role;

select * from finish();
rollback;
