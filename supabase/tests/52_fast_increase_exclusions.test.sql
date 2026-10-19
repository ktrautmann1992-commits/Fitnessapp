-- Phase 4b · Nachtrag zu Etappe B (docs/PLAN-PHASE-4B.md 5.2 „Nie bei“, Frage 5; Umsetzungsstand B „Nachtrag
-- R1-Ausschlüsse“): apply_plan_adjustments lehnt R1 `fast_increase` für ausgeschlossene Personen ab – vorsichtiger Plan
-- (Plan ohne Gesundheitsbezug, Plan mit Arzt-Hinweis, aktueller Check mit Flag, ohne Einwilligung, ohne Check), unter 18,
-- ab 65, Einsteiger im ersten Block. Der GANZE Aufruf wird mit `not_allowed` abgelehnt (nichts geschrieben); erlaubte
-- Fälle (genau 18, 64, Einsteiger im zweiten Block) bleiben ok. Gleiche Liste wie fastIncreaseExclusion() in Core.
-- „Heute“ ist fest Mittwoch, 07.10.2026 (Berlin).
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
values ('ue-kniebeuge', 1, 'published', 'Kniebeuge', 'Exercise ue-kniebeuge', 'squat', '{quadriceps}', '{}',
  'compound', 'weight', 1, 'Beschreibung der Übung mit genügend Zeichen.',
  '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}', '{"Ein hilfreicher Tipp."}',
  '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');
insert into public.plan_templates (id, version, status, title_de, description_de, goal_type, experience_level,
  sessions_per_week, minutes_min, minutes_max, location)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'advanced', 2, 45, 60, 'gym');
update private.feature_flags set enabled = true where key = 'live_adjustment';

-- Person samt Plan, Gesundheits-Check, Einwilligungen, Freischaltung und Basis-Eintrag (Kniebeuge 60 kg × 8, reps_max 10).
-- p_sessions: Kraft-Einheiten als [[Datum, Block], …].
create function pg_temp.person(
  p_n integer, p_birth date, p_level text, p_health boolean, p_notice boolean, p_consent boolean,
  p_screening text, p_sessions jsonb
) returns void language plpgsql as $$
declare
  u uuid := ('51000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid;
  plan_id uuid := ('51100000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid;
  s jsonb;
  k integer := 0;
begin
  insert into auth.users (id, email) values (u, 'r1-' || p_n || '@example.test');
  insert into public.profiles (user_id, birth_date) values (u, p_birth);
  insert into public.consents (user_id, consent_type, version, platform)
  select u, t, 1, 'web'
  from unnest(case when p_consent then array['terms', 'privacy', 'health_data']
                   else array['terms', 'privacy'] end::public.consent_type[]) t;
  if p_screening is not null then
    insert into public.health_screening (user_id, answers, medical_notice_acknowledged_at)
    values (u, jsonb_build_object('heart_condition', false, 'chest_pain_exercise', false, 'chest_pain_rest', false,
      'dizziness', false, 'blood_pressure', false, 'bone_joint', p_screening = 'flag', 'medication', false,
      'other_reason', false), case when p_screening = 'flag' then now() end);
  end if;
  insert into public.user_plans (id, user_id, status, template_id, template_title_de, template_version,
    engine_version, match_quality, inputs, start_date, uses_health_data, medical_notice)
  values (plan_id, u, 'active', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact',
    jsonb_build_object('experienceLevel', p_level), '2026-09-28', p_health, p_notice);
  for s in select value from jsonb_array_elements(p_sessions) loop
    k := k + 1;
    insert into public.planned_sessions (plan_id, user_id, block_no, week_no, is_intro_week, is_deload,
      template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de, kind)
    values (plan_id, u, (s ->> 1)::integer, k, false, false, 1, (s ->> 0)::date, 'Ganzkörper', 'full_body', 50,
      'Aufwärmen.', 'Ausklingen.', 'strength');
  end loop;
  insert into private.beta_entitlements (user_id, granted_by, expires_at)
  values (u, 'gruender-1', now() + interval '30 days');
  insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
  values (('51200000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, u, 'strength', '2026-10-07', 'completed',
    'Ganzkörper', gen_random_uuid(), now());
  insert into public.exercise_logs (session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type, status,
    reps_max, state_weight_kg, state_target_reps, state_extra_set)
  values (('51200000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid, u, 1, 'ue-kniebeuge', 'Kniebeuge', 'weight',
    'done', 10, 60, 8, false);
end;
$$;
create function pg_temp.u(p_n integer) returns uuid language sql as $$
  select ('51000000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
create function pg_temp.plan(p_n integer) returns uuid language sql as $$
  select ('51100000-0000-4000-8000-' || lpad(p_n::text, 12, '0'))::uuid
$$;
-- Zustands-Vorgabe in der Form von adjustmentProposalSchema (fromHealthPlan = Plan).
create function pg_temp.state(p_n integer, p_rule text, p_fp text, p_before jsonb, p_after jsonb) returns jsonb
language sql as $$
  select jsonb_build_object(
    'rule', p_rule, 'kind', 'state_override', 'requiresConfirmation', false, 'exerciseId', 'ue-kniebeuge',
    'plannedSessionIds', '[]'::jsonb,
    'basisSessionLogId', ('51200000-0000-4000-8000-' || lpad(p_n::text, 12, '0')), 'basisPerformedOn', '2026-10-07',
    'stateBefore', p_before, 'stateAfter', p_after, 'changeBefore', null, 'changeAfter', null,
    'explainParams', '{}'::jsonb, 'effectiveFrom', '2026-10-08', 'expiresOn', null,
    'inputFingerprint', p_rule || ':' || p_fp, 'engineVersion', 1, 'ruleVersion', 1, 'usesBodyData', false,
    'fromHealthPlan', (select p.uses_health_data from public.user_plans p where p.id = pg_temp.plan(p_n)))
$$;
create function pg_temp.fast(p_n integer, p_fp text default '00000000000000f1') returns jsonb language sql as $$
  select pg_temp.state(p_n, 'fast_increase', p_fp,
    '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
    '{"weightKg": 65, "targetReps": 6, "extraSet": false, "durationS": null}')
$$;
create function pg_temp.reduce(p_n integer) returns jsonb language sql as $$
  select pg_temp.state(p_n, 'load_reduce', '00000000000000e1',
    '{"weightKg": 60, "targetReps": 8, "extraSet": false, "durationS": null}',
    '{"weightKg": 54, "targetReps": 6, "extraSet": false, "durationS": null}')
$$;
create function pg_temp.apply(p_n integer, p_items jsonb) returns text language sql as $$
  select public.apply_plan_adjustments(pg_temp.u(p_n), jsonb_build_object(
    'plan_id', pg_temp.plan(p_n), 'trigger', 'session_logged',
    'max_load_weeks', private.plan_load_weeks(pg_temp.plan(p_n)), 'adjustments', p_items)) ->> 'result'
$$;
create function pg_temp.reason(p_n integer) returns text language sql as $$
  select private.fast_increase_exclusion(pg_temp.u(p_n), pg_temp.plan(p_n), private.berlin_today())
$$;
create function pg_temp.rows(p_n integer) returns bigint language sql as $$
  select count(*) from public.plan_adjustments a where a.user_id = pg_temp.u(p_n)
$$;

--                    Nr  Geburt        Stufe       Gesundh. Hinweis Einw.  Check   Einheiten [Datum, Block]
select pg_temp.person(1, '1990-01-01', 'advanced', true,  false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(2, '1990-01-01', 'advanced', false, false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(3, '1990-01-01', 'advanced', true,  true,  true,  'flag', '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(4, '1990-01-01', 'advanced', true,  false, true,  'flag', '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(5, '1990-01-01', 'advanced', true,  false, false, 'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(6, '1990-01-01', 'advanced', true,  false, true,  null,   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(7, '2008-10-08', 'advanced', true,  false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(8, '2008-10-07', 'advanced', true,  false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(9, '1961-10-07', 'advanced', true,  false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(10, '1961-10-08', 'advanced', true, false, true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(11, '1990-01-01', 'beginner', true, false, true,  'ok',   '[["2026-10-01", 1], ["2026-10-07", 1], ["2026-10-10", 2]]');
select pg_temp.person(12, '1990-01-01', 'beginner', true, false, true,  'ok',   '[["2026-10-01", 1], ["2026-10-06", 1], ["2026-10-08", 2]]');
select pg_temp.person(13, '1990-01-01', 'beginner', true, false, true,  'ok',   '[["2026-09-30", 1], ["2026-10-03", 1]]');
select pg_temp.person(14, '1990-01-01', 'beginner', true, false, true,  'ok',   '[["2026-09-30", 1], ["2026-10-03", 2]]');
select pg_temp.person(15, '1990-01-01', 'competitive', true, false, true, 'ok', '[["2026-10-07", 1], ["2026-10-10", 1]]');
select pg_temp.person(16, '1990-01-01', 'advanced', true,  true,  true,  'ok',   '[["2026-10-07", 1], ["2026-10-10", 1]]');

-- ---------------------------------------------------------------------------------------------------------
-- Rechte der Hilfsfunktion
-- ---------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'private.fast_increase_exclusion(uuid, uuid, date)', 'execute')
          and not has_function_privilege('anon', 'private.fast_increase_exclusion(uuid, uuid, date)', 'execute')
          and not has_function_privilege('service_role', 'private.fast_increase_exclusion(uuid, uuid, date)', 'execute'),
  'fast_increase_exclusion: weder authenticated, anon noch service_role direkt');

-- ---------------------------------------------------------------------------------------------------------
-- Ausschlussgrund je Fall (Liste = FAST_INCREASE_EXCLUSIONS)
-- ---------------------------------------------------------------------------------------------------------
select results_eq(
  $$ select n, pg_temp.reason(n) from generate_series(1, 16) n order by n $$,
  $$ values (1, null::text), (2, 'cautious_plan'), (3, 'cautious_plan'), (4, 'cautious_plan'), (5, 'cautious_plan'),
            (6, 'cautious_plan'), (7, 'minor'), (8, null), (9, 'senior'), (10, null),
            (11, 'beginner_first_block'), (12, null), (13, 'beginner_first_block'), (14, null), (15, null),
            (16, 'cautious_plan') $$,
  'Grund je Fall: vorsichtig (6 Arten), unter 18, ab 65, Einsteiger im ersten Block; sonst null');
select is(private.fast_increase_exclusion(pg_temp.u(1), pg_temp.plan(2), '2026-10-07'), 'cautious_plan',
  'fremder Plan → ausgeschlossen (sicher)');

-- ---------------------------------------------------------------------------------------------------------
-- apply_plan_adjustments: ausgeschlossen → not_allowed, nichts geschrieben
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.apply(2, jsonb_build_array(pg_temp.fast(2))), 'not_allowed', 'Plan ohne Gesundheitsbezug → not_allowed');
select is(pg_temp.apply(3, jsonb_build_array(pg_temp.fast(3))), 'not_allowed', 'Plan mit Arzt-Hinweis → not_allowed');
select is(pg_temp.apply(16, jsonb_build_array(pg_temp.fast(16))), 'not_allowed',
  'Plan mit Arzt-Hinweis, aktueller Check ohne Flag → not_allowed');
select is(pg_temp.apply(4, jsonb_build_array(pg_temp.fast(4))), 'not_allowed',
  'aktueller Check mit Flag (Plan ohne Hinweis) → not_allowed');
select is(pg_temp.apply(5, jsonb_build_array(pg_temp.fast(5))), 'not_allowed', 'ohne gültige Einwilligung → not_allowed');
select is(pg_temp.apply(6, jsonb_build_array(pg_temp.fast(6))), 'not_allowed', 'ohne Gesundheits-Check → not_allowed');
select is(pg_temp.apply(7, jsonb_build_array(pg_temp.fast(7))), 'not_allowed', '17 Jahre (18. Geburtstag morgen) → not_allowed');
select is(pg_temp.apply(9, jsonb_build_array(pg_temp.fast(9))), 'not_allowed', '65. Geburtstag heute → not_allowed');
select is(pg_temp.apply(11, jsonb_build_array(pg_temp.fast(11))), 'not_allowed',
  'Einsteiger, heutige Einheit im ersten Block → not_allowed');
select is(pg_temp.apply(13, jsonb_build_array(pg_temp.fast(13))), 'not_allowed',
  'Einsteiger, keine kommende Einheit, letzte im ersten Block → not_allowed');
select is((select sum(pg_temp.rows(n)) from unnest(array[2, 3, 4, 5, 6, 7, 9, 11, 13, 16]) n), 0::numeric,
  'ausgeschlossene Fälle: keine Anpassung geschrieben');

-- Ganzer Aufruf abgelehnt: gültiges load_reduce plus fast_increase → nichts geschrieben.
select is(pg_temp.apply(7, jsonb_build_array(pg_temp.reduce(7), pg_temp.fast(7))), 'not_allowed',
  'load_reduce + fast_increase (ausgeschlossen) → ganzer Aufruf not_allowed');
select is(pg_temp.rows(7), 0::bigint, 'auch das load_reduce nicht geschrieben');
select is(pg_temp.apply(7, jsonb_build_array(pg_temp.reduce(7))), 'ok', 'load_reduce allein bleibt erlaubt (17 Jahre)');
select is(pg_temp.apply(7, jsonb_build_array(pg_temp.fast(7, '00000000000000f2'), pg_temp.reduce(7))), 'not_allowed',
  'fast_increase vor einem Duplikat → not_allowed');
select is(pg_temp.rows(7), 1::bigint, 'weiterhin nur das load_reduce');
-- Formfehler bleiben invalid_input (Prüfung der Grundform zuerst).
select is(pg_temp.apply(7, jsonb_build_array(pg_temp.fast(7) - 'usesBodyData')), 'invalid_input',
  'fehlendes Feld → weiterhin invalid_input');
-- Ohne Premium bleibt not_entitled vorn.
delete from private.beta_entitlements where user_id = pg_temp.u(9);
select is(pg_temp.apply(9, jsonb_build_array(pg_temp.fast(9))), 'not_entitled', 'ohne Freischaltung → not_entitled');

-- ---------------------------------------------------------------------------------------------------------
-- Erlaubte Fälle → ok (als service_role wie die Route)
-- ---------------------------------------------------------------------------------------------------------
grant execute on all functions in schema pg_temp to service_role;
set local role service_role;
select is(public.apply_plan_adjustments(pg_temp.u(1), jsonb_build_object('plan_id', pg_temp.plan(1),
  'trigger', 'session_logged', 'max_load_weeks', 4, 'adjustments', jsonb_build_array(pg_temp.fast(1)))) ->> 'result',
  'ok', 'Fortgeschritten, 36 Jahre, Check ohne Flag → ok (service_role)');
reset role;
select is(pg_temp.apply(8, jsonb_build_array(pg_temp.fast(8))), 'ok', '18. Geburtstag heute → ok');
select is(pg_temp.apply(10, jsonb_build_array(pg_temp.fast(10))), 'ok', '64 Jahre (65. Geburtstag morgen) → ok');
select is(pg_temp.apply(12, jsonb_build_array(pg_temp.fast(12))), 'ok',
  'Einsteiger, nächste Einheit im zweiten Block → ok');
select is(pg_temp.apply(14, jsonb_build_array(pg_temp.fast(14))), 'ok',
  'Einsteiger, keine kommende Einheit, letzte im zweiten Block → ok');
select is(pg_temp.apply(15, jsonb_build_array(pg_temp.fast(15))), 'ok', 'Wettkampf-Stufe im ersten Block → ok');
select results_eq(
  $$ select n, a.rule::text, a.status::text from unnest(array[1, 8, 10, 12, 14, 15]) n
     join public.plan_adjustments a on a.user_id = pg_temp.u(n) order by n $$,
  $$ values (1, 'fast_increase', 'applied'), (8, 'fast_increase', 'applied'), (10, 'fast_increase', 'applied'),
            (12, 'fast_increase', 'applied'), (14, 'fast_increase', 'applied'), (15, 'fast_increase', 'applied') $$,
  'erlaubte Fälle: je ein fast_increase geschrieben');
select is(pg_temp.apply(1, jsonb_build_array(pg_temp.fast(1))), 'ok', 'Wiederholung (Duplikat) erlaubt → ok');
select is(public.apply_plan_adjustments(pg_temp.u(1), jsonb_build_object('plan_id', pg_temp.plan(1),
  'trigger', 'session_logged', 'max_load_weeks', 4, 'adjustments', jsonb_build_array(pg_temp.fast(1)))) ->> 'duplicates',
  '1', 'Duplikat gezählt, nicht neu geschrieben');

-- Stichtag zählt: derselbe Fall wird ausgeschlossen, sobald sich der Zustand ändert.
-- (a) neuer Check mit Flag nach Planerstellung → ausgeschlossen
update public.health_screening set created_at = created_at - interval '1 minute' where user_id = pg_temp.u(8);
insert into public.health_screening (user_id, answers, medical_notice_acknowledged_at)
values (pg_temp.u(8), '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false,
  "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": true, "other_reason": false}', now());
select is(pg_temp.apply(8, jsonb_build_array(pg_temp.fast(8, '00000000000000f3'))), 'not_allowed',
  'neuer Check mit Flag → not_allowed');
-- (b) Geburtsdatum im Profil korrigiert → Alter neu am Stichtag.
update public.profiles set birth_date = '1961-10-07' where user_id = pg_temp.u(10);
select is(pg_temp.apply(10, jsonb_build_array(pg_temp.fast(10, '00000000000000f3'))), 'not_allowed',
  'Geburtsdatum korrigiert (heute 65) → not_allowed');
-- (c) Berlin-Stichtag: einen Tag später ist Nr. 7 volljährig.
create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-08'
$$;
select is(pg_temp.reason(7), null, 'am 18. Geburtstag (Berlin) kein Ausschluss mehr');
select is(pg_temp.reason(11), null, 'Einsteiger: ab morgen ist die nächste Einheit (10.10.) im zweiten Block');

select * from finish();
rollback;
