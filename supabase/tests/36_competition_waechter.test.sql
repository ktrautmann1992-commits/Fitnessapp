-- Phase 10 · Etappe WP3 · Wächter-Prüfung (scratchpad waechter-wp3.md, Angriffstests 98/99 übernommen):
-- - H1: Schritte passen zur Art (locker ≤ 4, Steigerungen ≤ 20 s × höchstens 6), „hart“ auch über die Schritte
--   (Wochenzahl, Erholungswoche nur im Tapering),
-- - M1: Level für die Wochenzahl = das strengere aus Profil und Angaben des Plans,
-- - M2: Wettkampf-Einheiten nur mit eigenem GEPLANTEN Wettkampf mit Plan-Bezug; Disziplin (unter 18 kein Marathon,
--   Distanz-Deckel des langen Laufs) aus dem Wettkampf; Sperre der Wettkampf-Zeile nach der Einwilligung,
-- - Gegenproben aus den Angriffstests: direkte Änderungen und fremde Wettkämpfe bleiben gesperrt.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (private.berlin_today() innerhalb der Transaktion ersetzt).
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A: 36 Jahre mit geplantem Halbmarathon (Plan-Bezug). Y: 17 Jahre. Z: 36 Jahre, Check, ohne Wettkampf.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-y@example.test'),
  ('77777777-7777-4777-8777-777777777777', 'nutzer-z@example.test');
insert into public.consents (user_id, consent_type, version, platform)
select u.id, t, 1, 'web'
from auth.users u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '2009-06-01'),
  ('77777777-7777-4777-8777-777777777777', '1990-01-01');
insert into public.health_screening (user_id, medical_notice_acknowledged_at, answers)
select u.id, now(), '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false,
  "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false,
  "pregnancy": false}'
from auth.users u;
insert into public.competitions (user_id, name, discipline, distance_m, race_date, effective_goal, uses_health_data)
values ('11111111-1111-4111-8111-111111111111', 'Halbmarathon', 'half_marathon', 21097.5, '2027-04-11', 'finish', true);

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
-- Steigerungen wie die Engine: 10 min locker, 6 × (20 s zügig + 60 s locker), Rest locker.
create function pg_temp.strides(p_minutes integer, p_effort integer default 7, p_work_s integer default 20,
  p_count integer default 6) returns jsonb
language sql as $$
  select jsonb_build_array(jsonb_build_object('part', 'warmup', 'kind', 'easy', 'seconds', 600, 'effort', 3))
    || (select jsonb_agg(x) from generate_series(1, p_count) g,
          lateral (values (jsonb_build_object('part', 'main', 'kind', 'work', 'seconds', p_work_s, 'effort', p_effort)),
                          (jsonb_build_object('part', 'main', 'kind', 'easy', 'seconds', 60, 'effort', 3))) v(x))
    || jsonb_build_array(jsonb_build_object('part', 'cooldown', 'kind', 'easy',
         'seconds', p_minutes * 60 - 600 - p_count * (p_work_s + 60), 'effort', 3))
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
-- H1: Schritte passen zur Art (Angriff 98 W6/W7)
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'tempo', 7), pg_temp.workout(1, 'easy', 4, 'build', false, 1, 50, pg_temp.steps(50, 8, 1800)),
    pg_temp.workout(3, 'intervals', 8)))),
  '23514: Ungültige Werte im Plan.', 'W6: „locker“ mit 30 min Anstrengung 8 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'long', 4, 'build', false, 1, 50, pg_temp.steps(50, 5, 1800))))),
  '23514: Ungültige Werte im Plan.', 'W6: langer Lauf mit Abschnitt über 4 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'recovery', 4, 'build', false, 1, 50, pg_temp.steps(50, 6, 1800))))),
  '23514: Ungültige Werte im Plan.', 'W6: Erholungslauf mit Abschnitt über 4 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'strides', 4, 'build', false, 1, 50, pg_temp.strides(50, 7, 60))))),
  '23514: Ungültige Werte im Plan.', 'W6: Steigerungen mit 60-s-Abschnitten abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'strides', 4, 'build', false, 1, 50, pg_temp.strides(50, 7, 20, 7))))),
  '23514: Ungültige Werte im Plan.', 'W6: mehr als 6 Steigerungen abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'strides', 4, 'build', false, 1, 50,
      jsonb_set(pg_temp.strides(50, 7), '{1,kind}', '"easy"'))))),
  '23514: Ungültige Werte im Plan.', 'W6: zügiger Abschnitt nur als Belastung (work)');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'tempo', 7), pg_temp.workout(2, 'strides', 4, 'build', false, 1, 50, pg_temp.strides(50)),
    pg_temp.workout(4, 'intervals', 8)))),
  'kein Fehler', 'Steigerungen (6 × 20 s) zählen nicht als harte Einheit: Tempo + Intervalle + Steigerungen');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'easy', 4, 'recovery', true, 1, 50, pg_temp.steps(50, 8, 1800))))),
  '23514: Ungültige Werte im Plan.', 'W7: Erholungswoche, „locker“ mit 30 min Anstrengung 8 abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(
    pg_temp.workout(0, 'easy', 4, 'recovery', true, 1, 50, pg_temp.steps(50, 4, 1800))))),
  'kein Fehler', 'W7: Erholungswoche locker bis 4 erlaubt');
select ok(private.workout_is_hard('easy', '[{"part": "main", "kind": "work", "seconds": 21, "effort": 6}]')
  and not private.workout_is_hard('strides', '[{"part": "main", "kind": "work", "seconds": 20, "effort": 8}]')
  and private.workout_is_hard('fartlek', '[{"part": "main", "kind": "work", "seconds": 600, "effort": 3}]')
  and not private.workout_is_hard('easy', '"x"'),
  'workout_is_hard: harte Art oder Abschnitt ab 6 länger als 20 s, nie ein Fehler');

-- ---------------------------------------------------------------------------------------------------------
-- M2: nur mit eigenem geplanten Wettkampf mit Plan-Bezug, Disziplin aus dem Wettkampf (Angriff 99 W2/W4)
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7)), true, false,
    pg_temp.inputs('advanced', '10k'))),
  '23514: Der Plan passt nicht zum geplanten Wettkampf.', 'Disziplin des Plans ≠ Disziplin des Wettkampfs abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4, 'build', false, 1, 121)))),
  '23514: Die Einheit ist für diese Distanz zu lang.', 'Halbmarathon: Einheit über 120 min abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4, 'build', false, 1, 120)))),
  'kein Fehler', 'Halbmarathon: langer Lauf 120 min erlaubt');
select ok(
  (select position('from public.competitions c' in p.prosrc) > 0
     and position('for share' in substr(p.prosrc, position('from public.competitions c' in p.prosrc))) > 0
   from pg_proc p where p.oid = 'private.insert_plan_sessions(uuid, uuid, jsonb, integer, date, date)'::regprocedure),
  'insert_plan_sessions sperrt die Wettkampf-Zeile (FOR SHARE)');
select pg_temp.as_user('77777777-7777-4777-8777-777777777777');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'intervals', 8)), true, false,
    pg_temp.inputs('advanced', null))),
  '23514: Für den Wettkampfplan fehlt der geplante Wettkampf.', 'W2: Wettkampf-Einheiten ohne Wettkampf abgelehnt');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.easy(0)), true, false, pg_temp.inputs('advanced', null))),
  'kein Fehler', 'ohne Wettkampf: Grundlagen-Plan wie bisher');
select lives_ok($$ select public.save_competition(jsonb_build_object('id', null, 'name', 'Lauf', 'discipline', 'half_marathon',
    'race_date', '2027-04-11', 'goal_kind', 'finish', 'target_time_s', null, 'reference_discipline', null,
    'reference_time_s', null, 'reference_date', null, 'long_run_weekday', null, 'own_start_weekly_minutes', null,
    'start_reference_volume', null, 'start_reference_session_cap', null, 'start_reference_start_group', null,
    'effective_goal', null)) $$, 'Z speichert einen Wettkampf ohne Plan-Bezug');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7)))),
  '23514: Für den Wettkampfplan fehlt der geplante Wettkampf.', 'Wettkampf ohne Plan-Bezug reicht nicht');
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
select lives_ok($$ select public.save_competition(jsonb_build_object('id', null, 'name', 'M', 'discipline', 'marathon',
    'race_date', '2027-06-06', 'goal_kind', 'finish', 'target_time_s', null, 'reference_discipline', null,
    'reference_time_s', null, 'reference_date', null, 'long_run_weekday', null, 'own_start_weekly_minutes', null,
    'start_reference_volume', null, 'start_reference_session_cap', null, 'start_reference_start_group', null,
    'effective_goal', null)) $$, 'W4: Minderjährige speichert Marathon-Wettkampf ohne Plan-Bezug');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'long', 4, 'build', false, 1, 180)), true, false,
    pg_temp.inputs('advanced', 'half_marathon'))),
  '23514: Für den Wettkampfplan fehlt der geplante Wettkampf.', 'W4: Plan „Halbmarathon“ gegen Marathon-Wettkampf abgelehnt');

-- ---------------------------------------------------------------------------------------------------------
-- M1: strengeres Level aus Profil und Angaben (Angriff 99 W1)
-- ---------------------------------------------------------------------------------------------------------
reset role;
update public.profiles set experience_level = 'beginner' where user_id = '11111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7), pg_temp.workout(3, 'intervals', 8)),
    true, false, pg_temp.inputs('competitive'))),
  '23514: Zu viele harte Einheiten in einer Woche.', 'W1: Profil Einsteiger, Angaben Leistungssport → höchstens 1 harte');
select is(pg_temp.save(pg_temp.payload(jsonb_build_array(pg_temp.workout(0, 'tempo', 7)), true, false,
    pg_temp.inputs('competitive'))),
  'kein Fehler', 'W1: eine harte Einheit erlaubt');

-- N4: Leerraum am Rand wie String.prototype.trim() (geschütztes Leerzeichen, BOM, Tabulator)
select is(pg_temp.error_of(format('select public.save_competition(%L::jsonb)', jsonb_build_object('id', null,
    'name', E'\u00a0Lauf', 'discipline', '10k', 'race_date', '2027-01-10', 'goal_kind', 'finish', 'target_time_s', null,
    'reference_discipline', null, 'reference_time_s', null, 'reference_date', null, 'long_run_weekday', null,
    'own_start_weekly_minutes', null, 'start_reference_volume', null, 'start_reference_session_cap', null,
    'start_reference_start_group', null, 'effective_goal', null))),
  '23514: Ungültige Angaben zum Wettkampf.', 'N4: geschütztes Leerzeichen am Anfang abgelehnt');
select is(pg_temp.error_of(format('select public.save_competition(%L::jsonb)', jsonb_build_object('id', null,
    'name', E'Lauf\ufeff', 'discipline', '10k', 'race_date', '2027-01-10', 'goal_kind', 'finish', 'target_time_s', null,
    'reference_discipline', null, 'reference_time_s', null, 'reference_date', null, 'long_run_weekday', null,
    'own_start_weekly_minutes', null, 'start_reference_volume', null, 'start_reference_session_cap', null,
    'start_reference_start_group', null, 'effective_goal', null))),
  '23514: Ungültige Angaben zum Wettkampf.', 'N4: BOM am Ende abgelehnt');

-- Direkte Änderungen und fremde Wettkämpfe (Angriff 99 W3/W5)
select throws_ok($$ update public.planned_sessions set effort_target = 8 $$, '42501', null,
  'W3: effort_target nicht direkt änderbar');
reset role;
create temporary table foreign_competition on commit drop as
  select id from public.competitions where user_id = '22222222-2222-4222-8222-222222222222';
grant select on foreign_competition to authenticated;
set local role authenticated;
select is(pg_temp.error_of(format('select public.delete_competition(%L)', (select id from foreign_competition))),
  '42501: Wettkampf nicht gefunden.', 'W5: fremden Wettkampf löschen abgelehnt');

select * from finish();
rollback;
