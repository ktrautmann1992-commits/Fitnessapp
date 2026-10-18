-- Phase 4b Etappe B (docs/PLAN-PHASE-4B.md 4.6 Punkte 3–5, Wächter B2 und S1): apply_plan_adjustments (nur
-- service_role, Premium, Feldliste, Grenzen nachgerechnet, nur zulässige Einheiten, Wochen-Invarianten, Wochen-Deckel,
-- Idempotenz, Fehler ohne Inhalt), confirm_plan_adjustment und revert_plan_adjustment (nur in umgekehrter Reihenfolge,
-- deload_forward nur als Ganzes, Invarianten nach dem Zurückschreiben), „Entwurf vor Tausch → save_session_log ok“.
-- Plan-Nummer 49 statt 21 (Nummern 20–47 belegt).
-- „Heute“ ist fest Mittwoch, 07.10.2026. Plan (Fortgeschritten, L = 4): Wochen 1–4 Belastung, Woche 5 Erholung; je
-- Woche Kraft Mi und Sa (Kniebeuge 4×RPE 8, Curl 3×RPE 8; Erholung 2×RPE 6) und Ausdauer So (40/44/48/52, Erholung 31).
begin;
create extension if not exists pgtap with schema extensions;
select plan(99);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

-- A: Premium (Gesundheits-Plan), B: gratis, C: Premium mit zweitem Plan für Fremd-Prüfungen.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'nutzer-c@example.test');
insert into public.profiles (user_id, birth_date)
select u, '1990-01-01' from unnest(array['11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333']::uuid[]) u;
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333']::uuid[]) u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) t;

insert into public.exercises (
  id, version, status, name_de, name_en, movement_pattern, primary_muscles, equipment_ids, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de
)
select id, 1, 'published', name, 'Exercise ' || id, pattern::public.movement_pattern, '{quadriceps}', '{}',
  mech::public.exercise_mechanics, 'weight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.'
from (values ('ue-kniebeuge', 'Kniebeuge', 'squat', 'compound'),
             ('ue-frontkniebeuge', 'Frontkniebeuge', 'squat', 'compound'),
             ('ue-curl', 'Bizepscurl', 'elbow_flexion', 'isolation'),
             ('ue-rudern', 'Rudern', 'horizontal_pull', 'compound')) v(id, name, pattern, mech);
insert into public.plan_templates (id, version, status, title_de, description_de, goal_type, experience_level,
  sessions_per_week, minutes_min, minutes_max, location)
values ('vorlage-a', 1, 'published', 'Vorlage A für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'advanced', 2, 45, 60, 'gym');

create function pg_temp.mk_plan(p_plan uuid, p_user uuid) returns void language plpgsql as $$
declare
  w integer;
  monday date;
  sid uuid;
  deload boolean;
begin
  insert into public.user_plans (id, user_id, status, template_id, template_title_de, template_version,
    engine_version, match_quality, inputs, start_date, uses_health_data)
  values (p_plan, p_user, 'active', 'vorlage-a', 'Vorlage A für Tests', 1, 1, 'exact',
    '{"experienceLevel": "advanced"}', '2026-10-05', true);
  for w in 1 .. 5 loop
    monday := date '2026-10-05' + 7 * (w - 1);
    deload := w = 5;
    for sid, monday in
      select gen_random_uuid(), d from unnest(array[monday + 2, monday + 5]) d
    loop
      insert into public.planned_sessions (id, plan_id, user_id, block_no, week_no, is_intro_week, is_deload,
        template_day_index, scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de, kind)
      values (sid, p_plan, p_user, 1, w, false, deload, case when extract(isodow from monday) = 3 then 1 else 2 end,
        monday, 'Ganzkörper', 'full_body', 50, 'Aufwärmen.', 'Ausklingen.', 'strength');
      insert into public.planned_exercises (session_id, user_id, order_no, exercise_id, source_exercise_id,
        exercise_name_de, sets, reps_min, reps_max, rest_s, rpe_target)
      values
        (sid, p_user, 1, 'ue-kniebeuge', 'ue-kniebeuge', 'Kniebeuge', case when deload then 2 else 4 end, 6, 10, 120,
         case when deload then 6 else 8 end),
        (sid, p_user, 2, 'ue-curl', 'ue-curl', 'Bizepscurl', case when deload then 2 else 3 end, 8, 12, 60,
         case when deload then 6 else 8 end);
    end loop;
    insert into public.planned_sessions (plan_id, user_id, block_no, week_no, is_deload, template_day_index,
      scheduled_on, name_de, focus, estimated_minutes, warmup_de, cooldown_de, kind, endurance_modality, effort_target)
    values (p_plan, p_user, 1, w, deload, null, date '2026-10-05' + 7 * (w - 1) + 6, 'Lauf', null,
      (array[40, 44, 48, 52, 31])[w], 'Einlaufen.', 'Auslaufen.', 'endurance', 'run', 3);
  end loop;
end;
$$;
select pg_temp.mk_plan('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111');
select pg_temp.mk_plan('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222');
select pg_temp.mk_plan('cccccccc-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333');
insert into private.beta_entitlements (user_id, granted_by, expires_at) values
  ('11111111-1111-4111-8111-111111111111', 'gruender-1', now() + interval '30 days'),
  ('33333333-3333-4333-8333-333333333333', 'gruender-1', now() + interval '30 days');

-- Hilfen: Einheit (aktiver Plan, Datum, Art) und Vorschläge in der Form von adjustmentProposalSchema.
create function pg_temp.sid(p_user uuid, p_on date, p_kind text default 'strength') returns uuid language sql as $$
  select ps.id from public.planned_sessions ps join public.user_plans p on p.id = ps.plan_id and p.status = 'active'
  where ps.user_id = p_user and ps.scheduled_on = p_on and ps.kind::text = p_kind
$$;
create function pg_temp.prop(p_rule text, p_fp text, p_ids jsonb, p_before jsonb, p_after jsonb,
  p_from date default '2026-10-14', p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'rule', p_rule,
    'kind', case when p_rule in ('fast_increase', 'load_reduce') then 'state_override'
                 when p_rule = 'fewer_days' then 'proposal' else 'plan_change' end,
    'requiresConfirmation', p_rule = 'fewer_days', 'exerciseId', null, 'plannedSessionIds', p_ids,
    'basisSessionLogId', null, 'basisPerformedOn', null, 'stateBefore', null, 'stateAfter', null,
    'changeBefore', p_before, 'changeAfter', p_after, 'explainParams', '{}'::jsonb, 'effectiveFrom', p_from,
    'expiresOn', null, 'inputFingerprint', p_rule || ':' || p_fp, 'engineVersion', 1, 'ruleVersion', 1,
    'usesBodyData', false, 'fromHealthPlan', true) || p_extra
$$;
create function pg_temp.batch(p_user uuid, p_items jsonb, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object(
    'plan_id', (select p.id from public.user_plans p where p.user_id = p_user and p.status = 'active'),
    'trigger', 'session_logged', 'max_load_weeks', 4, 'adjustments', p_items) || p_extra
$$;
-- volume_reduce der Kraft-Einheiten einer Woche (Sätze −1, 45 statt 50 Minuten).
create function pg_temp.volume_reduce(p_user uuid, p_week integer, p_fp text, p_delta integer default 1)
returns jsonb language sql as $$
  with s as (
    select ps.id, ps.scheduled_on from public.planned_sessions ps
    join public.user_plans p on p.id = ps.plan_id and p.status = 'active'
    where ps.user_id = p_user and ps.kind = 'strength' and ps.week_no = p_week
  )
  select pg_temp.prop('volume_reduce', p_fp,
    (select jsonb_agg(s.id order by s.id::text) from s),
    jsonb_build_object('sessions', (select jsonb_agg(jsonb_build_object('id', s.id, 'estimated_minutes', 50,
      'exercises', (select jsonb_agg(jsonb_build_object('order_no', e.order_no, 'sets', e.sets) order by e.order_no)
                    from public.planned_exercises e where e.session_id = s.id)) order by s.id::text) from s)),
    jsonb_build_object('sessions', (select jsonb_agg(jsonb_build_object('id', s.id, 'estimated_minutes', 45,
      'exercises', (select jsonb_agg(jsonb_build_object('order_no', e.order_no, 'sets', e.sets - p_delta)
                                     order by e.order_no)
                    from public.planned_exercises e where e.session_id = s.id)) order by s.id::text) from s)),
    (select min(s.scheduled_on) from s))
$$;
-- Tausch Kniebeuge → p_to (Stelle 1) in allen Kraft-Einheiten ab p_from.
create function pg_temp.swap(p_user uuid, p_from date, p_fp text, p_to text default 'ue-frontkniebeuge',
  p_name text default 'Frontkniebeuge') returns jsonb language sql as $$
  with s as (
    select ps.id, ps.scheduled_on from public.planned_sessions ps
    join public.user_plans p on p.id = ps.plan_id and p.status = 'active'
    where ps.user_id = p_user and ps.kind = 'strength' and ps.scheduled_on >= p_from
  )
  select pg_temp.prop('stagnation_variation', p_fp,
    (select jsonb_agg(s.id order by s.id::text) from s),
    jsonb_build_object('sessions', (select jsonb_agg(jsonb_build_object('id', s.id, 'exercises', jsonb_build_array(
      jsonb_build_object('order_no', 1, 'exercise_id', 'ue-kniebeuge', 'exercise_name_de', 'Kniebeuge')))
      order by s.id::text) from s)),
    jsonb_build_object('sessions', (select jsonb_agg(jsonb_build_object('id', s.id, 'exercises', jsonb_build_array(
      jsonb_build_object('order_no', 1, 'exercise_id', p_to, 'exercise_name_de', p_name))) order by s.id::text) from s)),
    (select min(s.scheduled_on) from s), jsonb_build_object('exerciseId', 'ue-kniebeuge'))
$$;
-- Tausch-Regel: Woche 2 → Erholung, Wochen 3/4 Ausdauer neu gedeckelt, Woche 5 → Belastung mit der Dosierung von
-- Woche 4. p_d_sets = Sätze der Kniebeuge in Woche 5; p_n_deload = false lässt Woche 2 als Belastungswoche.
create function pg_temp.deload_forward(p_user uuid, p_fp text, p_d_sets integer default 4,
  p_n_deload boolean default true) returns jsonb language plpgsql as $$
declare
  b jsonb := '[]';
  a jsonb := '[]';
  s record;
begin
  for s in
    select ps.* from public.planned_sessions ps join public.user_plans p on p.id = ps.plan_id and p.status = 'active'
    where ps.user_id = p_user and ps.week_no between 2 and 5 order by ps.id::text
  loop
    if s.week_no = 2 and p_n_deload then
      if s.kind = 'strength' then
        b := b || jsonb_build_object('id', s.id, 'is_deload', false, 'estimated_minutes', 50, 'exercises',
          '[{"order_no": 1, "sets": 4, "rpe_target": 8}, {"order_no": 2, "sets": 3, "rpe_target": 8}]'::jsonb);
        a := a || jsonb_build_object('id', s.id, 'is_deload', true, 'estimated_minutes', 30, 'exercises',
          '[{"order_no": 1, "sets": 2, "rpe_target": 6}, {"order_no": 2, "sets": 2, "rpe_target": 6}]'::jsonb);
      else
        b := b || jsonb_build_object('id', s.id, 'is_deload', false, 'estimated_minutes', 44);
        a := a || jsonb_build_object('id', s.id, 'is_deload', true, 'estimated_minutes', 24);
      end if;
    elsif s.week_no in (3, 4) and s.kind = 'endurance' and p_n_deload then
      b := b || jsonb_build_object('id', s.id, 'estimated_minutes', s.estimated_minutes);
      a := a || jsonb_build_object('id', s.id, 'estimated_minutes', s.estimated_minutes - 4);
    elsif s.week_no = 5 then
      if s.kind = 'strength' then
        b := b || jsonb_build_object('id', s.id, 'is_deload', true, 'estimated_minutes', 50, 'exercises',
          '[{"order_no": 1, "sets": 2, "rpe_target": 6}, {"order_no": 2, "sets": 2, "rpe_target": 6}]'::jsonb);
        a := a || jsonb_build_object('id', s.id, 'is_deload', false, 'estimated_minutes', 50, 'exercises',
          jsonb_build_array(jsonb_build_object('order_no', 1, 'sets', p_d_sets, 'rpe_target', 8),
                            '{"order_no": 2, "sets": 3, "rpe_target": 8}'::jsonb));
      else
        b := b || jsonb_build_object('id', s.id, 'is_deload', true, 'estimated_minutes', 31);
        a := a || jsonb_build_object('id', s.id, 'is_deload', false,
                                     'estimated_minutes', case when p_n_deload then 48 else 52 end);
      end if;
    end if;
  end loop;
  return pg_temp.prop('deload_forward', p_fp,
    (select jsonb_agg(x -> 'id' order by x ->> 'id') from jsonb_array_elements(a) x),
    jsonb_build_object('sessions', b), jsonb_build_object('sessions', a),
    case when p_n_deload then date '2026-10-14' else date '2026-11-04' end,
    '{"explainParams": {"week_start": "2026-10-12", "swapped_week_start": "2026-11-02"}}'::jsonb);
end;
$$;
create function pg_temp.apply(p_user uuid, p_items jsonb, p_extra jsonb default '{}') returns text language sql as $$
  select public.apply_plan_adjustments(p_user, pg_temp.batch(p_user, p_items, p_extra)) ->> 'result'
$$;
create function pg_temp.sets(p_user uuid, p_on date, p_order integer default 1) returns integer language sql as $$
  select e.sets::integer from public.planned_exercises e where e.session_id = pg_temp.sid(p_user, p_on)
    and e.order_no = p_order
$$;
create function pg_temp.minutes(p_user uuid, p_on date) returns integer language sql as $$
  select ps.estimated_minutes::integer from public.planned_sessions ps where ps.id = pg_temp.sid(p_user, p_on, 'endurance')
$$;
create function pg_temp.adj(p_user uuid, p_rule text) returns uuid language sql as $$
  select a.id from public.plan_adjustments a where a.user_id = p_user and a.rule::text = p_rule
  order by a.created_at desc limit 1
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'public.apply_plan_adjustments(uuid, jsonb)', 'execute')
          and not has_function_privilege('anon', 'public.apply_plan_adjustments(uuid, jsonb)', 'execute')
          and has_function_privilege('service_role', 'public.apply_plan_adjustments(uuid, jsonb)', 'execute'),
  'apply_plan_adjustments nur service_role');
select ok(has_function_privilege('authenticated', 'public.confirm_plan_adjustment(uuid, boolean)', 'execute')
          and has_function_privilege('authenticated', 'public.revert_plan_adjustment(uuid)', 'execute')
          and not has_function_privilege('anon', 'public.confirm_plan_adjustment(uuid, boolean)', 'execute')
          and not has_function_privilege('anon', 'public.revert_plan_adjustment(uuid)', 'execute'),
  'confirm/revert: authenticated ja, anon nein');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ select public.apply_plan_adjustments('11111111-1111-4111-8111-111111111111', '{}') $$,
  '42501', null, 'authenticated: apply verweigert');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Premium (Flag und Freischaltung)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001'))),
  'not_entitled', 'Flag aus → not_entitled');
select is(public.beta_admin('flag_on', 'gruender-1', p_flag => 'live_adjustment') ->> 'result', 'flag_on', 'Flag an');
select is(pg_temp.apply('22222222-2222-4222-8222-222222222222',
  jsonb_build_array(pg_temp.volume_reduce('22222222-2222-4222-8222-222222222222', 2, '0000000000000001'))),
  'not_entitled', 'ohne Freischaltung → not_entitled');
select is((select count(*)::int from public.plan_adjustments), 0, 'not_entitled: keine Zeile');
select is(pg_temp.sets('22222222-2222-4222-8222-222222222222', '2026-10-14'), 4, 'not_entitled: Plan unverändert');
reset role;
update private.beta_entitlements set granted_at = now() - interval '40 days', expires_at = now() - interval '1 day'
where user_id = '33333333-3333-4333-8333-333333333333';
set local role service_role;
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.volume_reduce('33333333-3333-4333-8333-333333333333', 2, '0000000000000001'))),
  'not_entitled', 'abgelaufene Freischaltung → not_entitled');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(public.has_entitlement(), false, 'has_entitlement mit abgelaufener Beta = false');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.has_entitlement(), true, 'has_entitlement mit gültiger Beta = true');
reset role;
update private.beta_entitlements set granted_at = now(), expires_at = now() + interval '30 days'
where user_id = '33333333-3333-4333-8333-333333333333';

-- ---------------------------------------------------------------------------------------------------------
-- Feldliste und Grenzen (fester Code, keine Änderung)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001') || '{"notiz": "x"}')),
  'invalid_input', 'unbekanntes Feld → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001') - 'ruleVersion')),
  'invalid_input', 'fehlendes Feld → invalid_input');
select is(public.apply_plan_adjustments('11111111-1111-4111-8111-111111111111',
  pg_temp.batch('11111111-1111-4111-8111-111111111111', '[]') || '{"extra": 1}') ->> 'result',
  'invalid_input', 'unbekanntes Feld im Aufruf → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', '[]', '{"max_load_weeks": 5}'),
  'invalid_input', 'max_load_weeks ≠ Plan (Fortgeschritten: 4) → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  (select jsonb_agg(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, lpad(n::text, 16, '0')))
   from generate_series(1, 21) n)),
  'invalid_input', '21 Anpassungen in einem Aufruf → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.prop('calorie_adjust', '0000000000000001', '[]', null, null)
                    || '{"kind": "plan_change"}')),
  'invalid_input', 'reservierte Regel calorie_adjust → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001')
                    || '{"effectiveFrom": "2026-10-07"}')),
  'invalid_input', 'effective_from heute → invalid_input (S1)');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001')
                    || '{"fromHealthPlan": false}')),
  'invalid_input', 'from_health_plan setzt der Server (falscher Wert → invalid_input)');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001', 2))),
  'invalid_input', 'volume_reduce −2 Sätze → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 1, '0000000000000001')
                    || '{"effectiveFrom": "2026-10-08"}')),
  'not_eligible', 'Einheit von heute (Woche 1, Mi 07.10.) → not_eligible (S1)');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.swap('11111111-1111-4111-8111-111111111111', '2026-10-10', '0000000000000001',
                                 'ue-curl', 'Bizepscurl'))),
  'invalid_input', 'Tausch auf eine Übung ohne gleiches Muster/Alternative → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.swap('11111111-1111-4111-8111-111111111111', '2026-10-10', '0000000000000001',
                                 'ue-frontkniebeuge', 'Falscher Name'))),
  'invalid_input', 'Tausch mit fremdem Namen → invalid_input');
-- Vorher passt nicht zum Plan.
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(jsonb_set(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001'),
                              '{changeBefore,sessions,0,exercises,0,sets}', '5'))),
  'plan_changed', 'change_before ≠ Plan → plan_changed');
select is(public.apply_plan_adjustments('11111111-1111-4111-8111-111111111111',
  pg_temp.batch('11111111-1111-4111-8111-111111111111', '[]')
  || '{"plan_id": "cccccccc-0000-4000-8000-000000000001"}') ->> 'result',
  'plan_changed', 'fremder Plan → plan_changed');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('33333333-3333-4333-8333-333333333333', 2, '0000000000000001'))),
  'not_eligible', 'fremde Einheiten → not_eligible');
select is((select count(*)::int from public.plan_adjustments), 0, 'abgelehnte Aufrufe: keine Zeile');
select is(pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-14'), 4, 'abgelehnte Aufrufe: Plan unverändert');

-- ---------------------------------------------------------------------------------------------------------
-- Gültige Plan-Änderung, Idempotenz
-- ---------------------------------------------------------------------------------------------------------
select is(public.apply_plan_adjustments('11111111-1111-4111-8111-111111111111',
  pg_temp.batch('11111111-1111-4111-8111-111111111111',
    jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 2, '0000000000000001')))),
  '{"result": "ok", "applied": 1, "duplicates": 0}', 'volume_reduce Woche 2 → ok');
select results_eq(
  $$ select pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-14', 1),
            pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-14', 2),
            pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-17', 1),
            pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-21', 1) $$,
  $$ values (3, 2, 3, 4) $$, 'Sätze −1 nur in Woche 2');
select ok((select bool_and(ps.adjustment_id = pg_temp.adj('11111111-1111-4111-8111-111111111111', 'volume_reduce'))
           from public.planned_sessions ps
           where ps.id in (pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-14'),
                           pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-17'))),
  'Einheiten tragen adjustment_id');
select results_eq(
  $$ select status::text, kind::text, trigger::text, from_health_plan, uses_body_data, cardinality(planned_session_ids)
     from public.plan_adjustments where user_id = '11111111-1111-4111-8111-111111111111' $$,
  $$ values ('applied', 'plan_change', 'session_logged', true, false, 2) $$, 'Zeile: applied, Gesundheits-Plan');
select is(public.apply_plan_adjustments('11111111-1111-4111-8111-111111111111',
  pg_temp.batch('11111111-1111-4111-8111-111111111111',
    jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 3, '0000000000000001')))),
  '{"result": "ok", "applied": 0, "duplicates": 1}', 'gleicher Fingerabdruck → ok ohne Änderung');
select is(pg_temp.sets('11111111-1111-4111-8111-111111111111', '2026-10-21'), 4, 'Duplikat: Woche 3 unverändert');

-- ---------------------------------------------------------------------------------------------------------
-- Wochen-Invarianten (Wächter B2)
-- ---------------------------------------------------------------------------------------------------------
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.deload_forward('33333333-3333-4333-8333-333333333333', '00000000000000f1', 4, false))),
  'invariant_violation', 'Woche 5 Belastung ohne vorgezogene Erholung (5 Belastungswochen) → invariant_violation');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.deload_forward('33333333-3333-4333-8333-333333333333', '00000000000000f2', 5))),
  'invariant_violation', 'getauschte Woche mit 1 Satz mehr als die Vorwoche → invariant_violation');
select results_eq(
  $$ select (select count(*)::int from public.plan_adjustments where user_id = '33333333-3333-4333-8333-333333333333'),
            pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-11-04'),
            (select count(*)::int from public.planned_sessions where user_id = '33333333-3333-4333-8333-333333333333' and is_deload) $$,
  $$ values (0, 2, 3) $$, 'invariant_violation: keine Änderung');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.deload_forward('33333333-3333-4333-8333-333333333333', '00000000000000f3'))),
  'ok', 'Tausch-Regel nach Plan (Woche 2 Erholung, Woche 5 mit Dosierung von Woche 4) → ok');
select results_eq(
  $$ select pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-10-14'),
            pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-11-04'),
            pg_temp.minutes('33333333-3333-4333-8333-333333333333', '2026-10-18'),
            pg_temp.minutes('33333333-3333-4333-8333-333333333333', '2026-11-08'),
            (select string_agg(distinct week_no::text, ',') from public.planned_sessions
             where user_id = '33333333-3333-4333-8333-333333333333' and is_deload) $$,
  $$ values (2, 4, 24, 48, '2') $$, 'Tausch geschrieben: Woche 2 Erholung, Woche 5 Belastung');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.volume_reduce('33333333-3333-4333-8333-333333333333', 3, '00000000000000f4'))),
  'ok', 'danach volume_reduce Woche 3 → ok');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.volume_reduce('33333333-3333-4333-8333-333333333333', 4, '00000000000000f5'))),
  'invariant_violation', 'volume_reduce Woche D − 1 hebt die getauschte Woche D über die Vorwoche → invariant_violation');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.swap('33333333-3333-4333-8333-333333333333', '2026-10-10', '00000000000000f6'))),
  'ok', 'Tausch → ok (3. automatische Änderung dieser Woche)');
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.volume_reduce('33333333-3333-4333-8333-333333333333', 4, '00000000000000f8'))),
  'weekly_limit', '4. automatische Änderung derselben Woche → weekly_limit');

-- ---------------------------------------------------------------------------------------------------------
-- Rückgängig (umgekehrte Reihenfolge, deload_forward als Ganzes)
-- ---------------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('33333333-3333-4333-8333-333333333333', 'deload_forward')) ->> 'result',
  'not_revertible', 'Tausch-Regel zurück, solange neuere Änderungen in denselben Wochen gelten → not_revertible');
select is(public.revert_plan_adjustment(pg_temp.adj('11111111-1111-4111-8111-111111111111', 'volume_reduce')) ->> 'result',
  'not_found', 'fremde Anpassung → not_found');
select is(public.revert_plan_adjustment(
  (select id from public.plan_adjustments where rule = 'volume_reduce'
   and planned_session_ids @> array[pg_temp.sid('33333333-3333-4333-8333-333333333333', '2026-10-21')])) ->> 'result',
  'not_revertible', 'Woche 3 zurück, solange der neuere Tausch dieselben Wochen trifft → not_revertible');
select is(public.revert_plan_adjustment(pg_temp.adj('33333333-3333-4333-8333-333333333333', 'stagnation_variation')) ->> 'result',
  'reverted', 'neueste Änderung (Tausch) zurück → reverted');
select is(public.revert_plan_adjustment(
  (select id from public.plan_adjustments where rule = 'volume_reduce'
   and planned_session_ids @> array[pg_temp.sid('33333333-3333-4333-8333-333333333333', '2026-10-21')])) ->> 'result',
  'reverted', 'dann Woche 3 → reverted');
select is(public.revert_plan_adjustment(pg_temp.adj('33333333-3333-4333-8333-333333333333', 'deload_forward')) ->> 'result',
  'reverted', 'dann die Tausch-Regel als Ganzes → reverted');
select results_eq(
  $$ select pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-10-14'),
            pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-10-21'),
            pg_temp.sets('33333333-3333-4333-8333-333333333333', '2026-11-04'),
            pg_temp.minutes('33333333-3333-4333-8333-333333333333', '2026-10-25'),
            (select string_agg(distinct week_no::text, ',') from public.planned_sessions
             where user_id = '33333333-3333-4333-8333-333333333333' and is_deload),
            (select count(*)::int from public.planned_sessions
             where user_id = '33333333-3333-4333-8333-333333333333' and adjustment_id is not null) $$,
  $$ values (4, 4, 2, 48, '5', 0) $$, 'Plan wieder wie vorher, Kennzeichen entfernt');
select is(public.revert_plan_adjustment(pg_temp.adj('33333333-3333-4333-8333-333333333333', 'deload_forward')) ->> 'result',
  'not_revertible', 'zweites Rückgängig → not_revertible');
select results_eq(
  $$ select status::text, decided_at is not null from public.plan_adjustments
     where user_id = '33333333-3333-4333-8333-333333333333' order by created_at $$,
  $$ values ('reverted', true), ('reverted', true), ('reverted', true) $$, 'Status reverted mit Zeitpunkt');
reset role;

-- Zweiter deload_forward im selben Block (auch nach Rücknahme) → invariant_violation.
set local role service_role;
select is(pg_temp.apply('33333333-3333-4333-8333-333333333333',
  jsonb_build_array(pg_temp.deload_forward('33333333-3333-4333-8333-333333333333', '00000000000000f7'))),
  'invariant_violation', 'zweiter deload_forward im Block → invariant_violation');
reset role;

-- Rückgängig, das einen neuen Verstoß erzeugt (Vorher-Minuten über der 10-%-Grenze) → invariant_violation.
insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status, planned_session_ids,
  change_before, change_after, effective_from, engine_version, rule_version, input_fingerprint, uses_body_data,
  from_health_plan)
select '33333333-3333-4333-8333-333333333333', 'cccccccc-0000-4000-8000-000000000001', 'session_logged',
  'endurance_reduce', 'plan_change', 'applied', array[ps.id],
  jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object('id', ps.id, 'estimated_minutes', 60))),
  jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object('id', ps.id, 'estimated_minutes', 48))),
  '2026-10-25', 1, 1, 'endurance_reduce:00000000000000e1', false, true
from public.planned_sessions ps where ps.id = pg_temp.sid('33333333-3333-4333-8333-333333333333', '2026-10-25', 'endurance');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('33333333-3333-4333-8333-333333333333', 'endurance_reduce')) ->> 'result',
  'invariant_violation', 'Rückgängig mit neuem Invarianten-Verstoß → invariant_violation');
select is(pg_temp.minutes('33333333-3333-4333-8333-333333333333', '2026-10-25'), 48, '… ohne Änderung');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Tausch (R4): heutige Einheit bleibt, Entwurf von heute lässt sich speichern; danach nicht mehr rückgängig
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.swap('11111111-1111-4111-8111-111111111111', '2026-10-07', '00000000000000a2')
                    || '{"effectiveFrom": "2026-10-08"}')),
  'not_eligible', 'Tausch mit der Einheit von heute → not_eligible');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.swap('11111111-1111-4111-8111-111111111111', '2026-10-10', '00000000000000a2'))),
  'ok', 'Tausch ab morgen → ok');
select results_eq(
  $$ select (select exercise_id from public.planned_exercises where order_no = 1
             and session_id = pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-07')),
            (select exercise_id from public.planned_exercises where order_no = 1
             and session_id = pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-10')),
            (select exercise_name_de from public.planned_exercises where order_no = 1
             and session_id = pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-11-07')) $$,
  $$ values ('ue-kniebeuge', 'ue-frontkniebeuge', 'Frontkniebeuge') $$,
  'heute unverändert, ab morgen getauscht');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.save_session_log(jsonb_build_object(
    'id', 'a3000000-0000-4000-8000-000000000001', 'write_id', 'a4000000-0000-4000-8000-000000000001',
    'base_revision', null, 'planned_session_id', pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-07'),
    'planned_date', '2026-10-07', 'kind', 'strength', 'performed_on', '2026-10-07',
    'started_at', '2026-10-07T17:00:00+02:00', 'finished_at', '2026-10-07T18:00:00+02:00',
    'status', 'completed', 'session_rpe', 9, 'notes', null, 'name_de', 'Ganzkörper',
    'is_intro_week', false, 'is_deload', false, 'source', 'manual', 'client_updated_at', '2026-10-07T18:00:00+02:00',
    'exercises', jsonb_build_array(jsonb_build_object(
      'id', 'a5000000-0000-4000-8000-000000000001', 'order_no', 1,
      'planned_exercise_id', (select id from public.planned_exercises where order_no = 1
                              and session_id = pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-07')),
      'exercise_id', 'ue-kniebeuge', 'exercise_name_de', 'Kniebeuge', 'load_type', 'weight', 'status', 'done',
      'target_sets', 4, 'reps_min', 6, 'reps_max', 10, 'target_reps', 8, 'target_extra_set', false,
      'target_weight_kg', 60, 'target_duration_s', null, 'target_rpe', 8, 'state_weight_kg', 60,
      'state_target_reps', 8, 'state_extra_set', false, 'state_duration_s', null, 'weight_confirmed', false,
      'is_return', false,
      'sets', '[{"set_no": 1, "reps": 8, "weight_kg": 60, "duration_s": null, "rpe": 9, "done": true}]'::jsonb)),
    'cardio', null)) ->> 'result',
  'ok', 'Entwurf vor Tausch → save_session_log weiterhin ok (S1)');
reset role;
-- Eintrag zu einer getauschten Einheit (zweites Gerät) → Rückgängig nicht mehr möglich.
insert into public.session_logs (id, user_id, planned_session_id, kind, performed_on, status, name_de, last_write_id,
  client_updated_at)
values ('a3000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
  pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-10'), 'strength', '2026-10-10', 'completed',
  'Ganzkörper', gen_random_uuid(), now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('11111111-1111-4111-8111-111111111111', 'stagnation_variation')) ->> 'result',
  'not_revertible', 'Einheit mit Eintrag → Rückgängig nicht mehr möglich');
reset role;
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 1, '00000000000000a3')
    || jsonb_build_object(
      'plannedSessionIds', jsonb_build_array(pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-10')),
      'effectiveFrom', '2026-10-10',
      'changeBefore', jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object(
        'id', pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-10'), 'estimated_minutes', 50,
        'exercises', '[{"order_no": 2, "sets": 3}]'::jsonb))),
      'changeAfter', jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object(
        'id', pg_temp.sid('11111111-1111-4111-8111-111111111111', '2026-10-10'), 'estimated_minutes', 45,
        'exercises', '[{"order_no": 2, "sets": 2}]'::jsonb)))))),
  'not_eligible', 'Einheit mit Eintrag (zweites Gerät) → not_eligible');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Zustands-Vorgaben (R1/R2): Grenzen, überholt, Rückgängig
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.state(p_rule text, p_fp text, p_before jsonb, p_after jsonb, p_basis text default 'a3000000-0000-4000-8000-000000000001')
returns jsonb language sql as $$
  select pg_temp.prop(p_rule, p_fp, '[]', null, null, '2026-10-08') || jsonb_build_object(
    'exerciseId', 'ue-kniebeuge', 'basisSessionLogId', p_basis, 'basisPerformedOn', '2026-10-07',
    'stateBefore', p_before, 'stateAfter', p_after)
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role;
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('load_reduce', '00000000000000b1',
  '{"weightKg": 60, "targetReps": 8, "extraSet": false, "durationS": null}',
  '{"weightKg": 48, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'invalid_input', 'load_reduce −20 % → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('load_reduce', '00000000000000b2',
  '{"weightKg": 70, "targetReps": 8, "extraSet": false, "durationS": null}',
  '{"weightKg": 63, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'invalid_input', 'load_reduce mit Vorher ≠ gespeichertem Zustand → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b3',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  '{"weightKg": 67.5, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'invalid_input', 'fast_increase +12,5 % → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b4',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  'a3000000-0000-4000-8000-0000000000ff'))),
  'invalid_input', 'unbekannter Basis-Eintrag → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b8',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  '{"weightKg": 62.5, "targetReps": 6, "extraSet": true, "durationS": null}'))),
  'invalid_input', 'fast_increase: Gewicht hoch UND Zusatzsatz (zwei Schritte) → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b9',
  '{"weightKg": 60, "targetReps": 8, "extraSet": false, "durationS": null}',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}'))),
  'invalid_input', 'fast_increase: +2 Wiederholungen → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000ba',
  '{"weightKg": 60, "targetReps": 12, "extraSet": false, "durationS": null}',
  '{"weightKg": 60, "targetReps": 13, "extraSet": false, "durationS": null}'))),
  'invalid_input', 'fast_increase: Wiederholungen über reps_max + Puffer des Basis-Eintrags → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111',
  jsonb_build_array(pg_temp.volume_reduce('11111111-1111-4111-8111-111111111111', 3, '00000000000000a4'))),
  'ok', '3. automatische Änderung dieser Woche → ok');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b5',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  '{"weightKg": 65, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'weekly_limit', 'gültiges fast_increase, aber schon 3 automatische Änderungen diese Woche → weekly_limit');
reset role;
update public.plan_adjustments set created_at = created_at - interval '7 days'
where user_id = '11111111-1111-4111-8111-111111111111';
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('load_reduce', '00000000000000b6',
  '{"weightKg": 60, "targetReps": 8, "extraSet": false, "durationS": null}',
  '{"weightKg": 54, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'ok', 'load_reduce −10 % → ok');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.state('fast_increase', '00000000000000b7',
  '{"weightKg": 60, "targetReps": 10, "extraSet": false, "durationS": null}',
  '{"weightKg": 65, "targetReps": 6, "extraSet": false, "durationS": null}'))),
  'ok', 'fast_increase +8,3 % → ok');
select results_eq(
  $$ select rule::text, status::text from public.plan_adjustments
     where user_id = '11111111-1111-4111-8111-111111111111' and kind = 'state_override' order by created_at $$,
  $$ values ('load_reduce', 'superseded'), ('fast_increase', 'applied') $$,
  'ältere Zustands-Vorgabe derselben Übung → superseded');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('11111111-1111-4111-8111-111111111111', 'load_reduce')) ->> 'result',
  'not_revertible', 'überholte Vorgabe → not_revertible');
reset role;
-- Neuerer zählender Eintrag der Übung → Rückgängig nicht mehr möglich.
insert into public.session_logs (id, user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
values ('a3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 'strength', '2026-10-08',
  'completed', 'Ganzkörper', gen_random_uuid(), now());
insert into public.exercise_logs (session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type, status)
values ('a3000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', 1, 'ue-kniebeuge',
  'Kniebeuge', 'weight', 'done');
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('11111111-1111-4111-8111-111111111111', 'fast_increase')) ->> 'result',
  'not_revertible', 'neuerer zählender Eintrag → Zustands-Vorgabe nicht mehr rückgängig');
reset role;
delete from public.session_logs where id = 'a3000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.revert_plan_adjustment(pg_temp.adj('11111111-1111-4111-8111-111111111111', 'fast_increase')) ->> 'result',
  'reverted', 'ohne neueren Eintrag → reverted');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- Vorschlag weniger Trainingstage (R5): Bestätigen, Ablehnen, Ablauf
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.fewer(p_fp text, p_expires date default '2026-10-21') returns jsonb language sql as $$
  select pg_temp.prop('fewer_days', p_fp, '[]', '{"days": 2}', '{"days": 1, "drop_weekday": 6}', '2026-10-08',
    jsonb_build_object('expiresOn', p_expires))
$$;
grant execute on all functions in schema pg_temp to authenticated, service_role;
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.fewer('00000000000000c1', '2026-10-30'))),
  'invalid_input', 'Vorschlag mit Ablauf nach mehr als 14 Tagen → invalid_input');
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(
  pg_temp.fewer('00000000000000c1'), pg_temp.fewer('00000000000000c2'), pg_temp.fewer('00000000000000c3'),
  pg_temp.fewer('00000000000000c4'))),
  'ok', 'Vorschläge (zählen nicht zum Wochen-Deckel) → ok');
select is((select count(*)::int from public.plan_adjustments where rule = 'fewer_days' and status = 'pending_confirmation'
           and requires_confirmation and expires_on = '2026-10-21'), 4, 'Status pending_confirmation');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c1'), false) ->> 'result',
  'declined', 'Ablehnen → declined');
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c1'), true) ->> 'result',
  'not_pending', 'nochmal → not_pending');
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c2'), true) ->> 'result',
  'confirmed', 'Annehmen (ohne Premium-Prüfung) → confirmed');
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c3'), true) ->> 'result',
  'not_found', 'fremder Vorschlag → not_found');
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.revert_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c3')) ->> 'result',
  'not_revertible', 'Vorschlag lässt sich nicht „rückgängig“ machen');
reset role;
-- Planwechsel: neuer Plan, dann Bestätigen (Umsetzungsstand D Nr. 2) – binnen 60 Minuten ja, danach abgelaufen.
update public.user_plans set status = 'replaced', replaced_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c3'), true) ->> 'result',
  'confirmed', 'gerade ersetzter Plan: Annehmen binnen 60 Minuten → confirmed');
reset role;
update public.user_plans set replaced_at = now() - interval '2 hours' where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is(public.confirm_plan_adjustment(
  (select id from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c4'), true) ->> 'result',
  'expired', 'nach 2 Stunden → expired');
reset role;
-- Ablauf über expire_plan_adjustments (expires_on < heute).
update public.user_plans set status = 'active', replaced_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000001';
set local role service_role;
select is(pg_temp.apply('11111111-1111-4111-8111-111111111111', jsonb_build_array(pg_temp.fewer('00000000000000c5', '2026-10-08'))),
  'ok', 'weiterer Vorschlag');
reset role;
create or replace function private.berlin_today() returns date language sql stable set search_path = '' as $$
  select date '2026-10-10'
$$;
select is((private.expire_plan_adjustments() ->> 'expired')::int, 1, 'expire_plan_adjustments: abgelaufener Vorschlag');
select is((select status::text from public.plan_adjustments where input_fingerprint = 'fewer_days:00000000000000c5'),
  'expired', 'Status expired');

-- ---------------------------------------------------------------------------------------------------------
-- Wächter B Auflage 1: Schritte nur bei lockeren Arten, Distanz-Richtwert nie höher. E: Plan mit Arzt-Hinweis, zwei
-- Wettkampf-Einheiten (Do 15.10. Intervalle, Do 22.10. locker) mit Distanz 5.000 m.
-- ---------------------------------------------------------------------------------------------------------
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'nutzer-e@example.test');
insert into public.profiles (user_id, birth_date) values ('55555555-5555-4555-8555-555555555555', '1990-01-01');
select pg_temp.mk_plan('eeeeeeee-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555');
update public.user_plans set medical_notice = true where id = 'eeeeeeee-0000-4000-8000-000000000001';
insert into private.beta_entitlements (user_id, granted_by, expires_at)
values ('55555555-5555-4555-8555-555555555555', 'gruender-1', now() + interval '30 days');
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, scheduled_on, name_de, estimated_minutes,
  warmup_de, cooldown_de, kind, endurance_modality, effort_target, workout_type, training_phase, workout_steps,
  target_distance_m)
values
  ('eeeeeeee-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 1, 2, '2026-10-15', 'Intervalle', 40,
   'Einlaufen.', 'Auslaufen.', 'endurance', 'run', 8, 'intervals', 'build',
   '[{"part": "warmup", "kind": "easy", "seconds": 600, "effort": 3}, {"part": "main", "kind": "work", "seconds": 1200, "effort": 8},
     {"part": "cooldown", "kind": "easy", "seconds": 600, "effort": 3}]', 5000),
  ('eeeeeeee-0000-4000-8000-000000000001', '55555555-5555-4555-8555-555555555555', 1, 3, '2026-10-22', 'Locker', 40,
   'Einlaufen.', 'Auslaufen.', 'endurance', 'run', 3, 'easy', 'build',
   '[{"part": "main", "kind": "easy", "seconds": 2400, "effort": 3}]', 5000);
create function pg_temp.endurance_change(p_on date, p_after jsonb, p_fp text) returns jsonb language sql as $$
  select pg_temp.prop('endurance_reduce', p_fp, jsonb_build_array(ps.id),
    jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object('id', ps.id, 'estimated_minutes', 40,
      'workout_steps', ps.workout_steps, 'target_distance_m', 5000))),
    jsonb_build_object('sessions', jsonb_build_array(jsonb_build_object('id', ps.id) || p_after)), p_on)
  from public.planned_sessions ps
  where ps.user_id = '55555555-5555-4555-8555-555555555555' and ps.scheduled_on = p_on and ps.workout_type is not null
$$;
grant execute on all functions in schema pg_temp to service_role;
set local role service_role;
select is(pg_temp.apply('55555555-5555-4555-8555-555555555555', jsonb_build_array(pg_temp.endurance_change('2026-10-15',
  '{"estimated_minutes": 34, "target_distance_m": 20000, "workout_steps": [{"part": "main", "kind": "work", "seconds": 2040, "effort": 10}]}',
  '00000000000000e2'))),
  'invalid_input', 'Intervall-Einheit: neue Schritte (Anstrengung 10) und Distanz 5.000 → 20.000 m → abgelehnt');
select is(pg_temp.apply('55555555-5555-4555-8555-555555555555', jsonb_build_array(pg_temp.endurance_change('2026-10-15',
  '{"estimated_minutes": 34, "target_distance_m": null, "workout_steps": [{"part": "main", "kind": "work", "seconds": 2040, "effort": 10}]}',
  '00000000000000e5'))),
  'invalid_input', 'Intervall-Einheit: neue Schritte ohne Distanz → abgelehnt (Schritte nur bei lockeren Arten)');
select is(pg_temp.apply('55555555-5555-4555-8555-555555555555', jsonb_build_array(pg_temp.endurance_change('2026-10-22',
  '{"estimated_minutes": 34, "target_distance_m": 20000, "workout_steps": [{"part": "main", "kind": "easy", "seconds": 2040, "effort": 3}]}',
  '00000000000000e3'))),
  'invalid_input', 'lockere Einheit: Distanz-Richtwert höher → abgelehnt');
select is(pg_temp.apply('55555555-5555-4555-8555-555555555555', jsonb_build_array(pg_temp.endurance_change('2026-10-22',
  '{"estimated_minutes": 34, "target_distance_m": null, "workout_steps": [{"part": "main", "kind": "easy", "seconds": 2040, "effort": 3}]}',
  '00000000000000e4'))),
  'ok', 'lockere Einheit: kürzer, Schritte neu, Distanz entfällt → ok (wie easyWorkout in Core)');
select results_eq(
  $$ select estimated_minutes::int, target_distance_m, workout_steps -> 0 ->> 'effort' from public.planned_sessions
     where user_id = '55555555-5555-4555-8555-555555555555' and workout_type is not null order by scheduled_on $$,
  $$ values (40, 5000, '3'), (34, null::integer, '3') $$, 'Intervall-Einheit unverändert, lockere gekürzt');
reset role;

-- ---------------------------------------------------------------------------------------------------------
-- authenticated kann nicht schreiben (Tabelle und neue Plan-Spalten)
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok($$ update public.plan_adjustments set status = 'applied' $$, '42501', null,
  'authenticated: plan_adjustments nicht änderbar');
select throws_ok($$ delete from public.plan_adjustments $$, '42501', null, 'authenticated: nicht löschbar');
select throws_ok($$ update public.planned_sessions set adjustment_id = null $$, '42501', null,
  'authenticated: planned_sessions.adjustment_id nicht änderbar');
select throws_ok($$ update public.planned_exercises set sets = 6 $$, '42501', null,
  'authenticated: planned_exercises nicht änderbar');
select ok(exists (select 1 from public.plan_adjustments)
          and not exists (select 1 from public.plan_adjustments where user_id <> '11111111-1111-4111-8111-111111111111'),
  'authenticated sieht nur eigene Anpassungen (fremde von C unsichtbar)');
reset role;

select * from finish();
rollback;
