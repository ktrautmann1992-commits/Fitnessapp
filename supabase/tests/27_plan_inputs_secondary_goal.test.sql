-- Ziele · Etappe Z1 (docs/PLAN-ZIELE.md 5.1, Wächter B1 und N3): optionales Nebenziel `secondaryGoalType` in den
-- Angaben eines Plans und die feste Paarliste private.goal_pair_allowed (= GOAL_PAIR_RULES in packages/core).
-- Fehlender Schlüssel und JSON-null werden getrennt geprüft. „Heute“ ist fest Mittwoch, 07.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-07'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01');

-- Ausdauer-Einheit wie toSavePlanSession() (packages/core); Tage ab Montag, 12.10. + Versatz.
create function pg_temp.endurance(p_day integer) returns jsonb language sql as $$
  select jsonb_build_object(
    'block_no', 1, 'week_no', 1, 'is_intro_week', false, 'is_deload', false, 'kind', 'endurance',
    'template_day_index', null, 'scheduled_on', date '2026-10-12' + p_day, 'name_de', 'Lockerer Dauerlauf',
    'focus', null, 'endurance_modality', 'run', 'effort_target', 4, 'estimated_minutes', 30,
    'warmup_de', '5 Minuten zügig gehen.', 'cooldown_de', '5 Minuten locker auslaufen bzw. gehen, leicht dehnen.',
    'exercises', '[]'::jsonb
  )
$$;
-- Angaben wie heute (ohne Schlüssel secondaryGoalType).
create function pg_temp.inputs(p_goal text default 'endurance') returns jsonb language sql as $$
  select jsonb_build_object(
    'goalType', p_goal, 'discipline', null, 'experienceLevel', 'beginner',
    'schedule', '{"mode": "flex", "slots": [{"kind": "endurance", "minutes": 30}]}'::jsonb,
    'trainingLocation', null, 'homeEquipment', '[]'::jsonb
  )
$$;
create function pg_temp.with_secondary(p_goal text, p_secondary jsonb) returns jsonb language sql as $$
  select pg_temp.inputs(p_goal) || jsonb_build_object('secondaryGoalType', p_secondary)
$$;
create function pg_temp.payload(p_inputs jsonb) returns jsonb language sql as $$
  select jsonb_build_object(
    'template_id', null, 'template_title_de', null, 'template_version', null,
    'engine_version', 2, 'match_quality', 'exact', 'notes', '["endurance_basic_only"]'::jsonb,
    'uses_health_data', false, 'medical_notice', false,
    'inputs', p_inputs, 'start_date', '2026-10-07', 'sessions', jsonb_build_array(pg_temp.endurance(0))
  )
$$;
grant execute on all functions in schema pg_temp to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- 1. private.goal_pair_allowed: genau die Paare aus GOAL_PAIR_RULES (10, seit Fit im Alter FA1 11)
-- ---------------------------------------------------------------------------------------------------------
select has_function('private', 'goal_pair_allowed', array['goal_type', 'goal_type'], 'goal_pair_allowed vorhanden');
select results_eq(
  $$ select p::text || '>' || s::text
     from unnest(enum_range(null::public.goal_type)) p, unnest(enum_range(null::public.goal_type)) s
     where private.goal_pair_allowed(p, s)
     order by 1 $$,
  $$ values ('active_aging>fat_loss'), ('calisthenics>fat_loss'), ('definition>endurance'), ('endurance>definition'), ('endurance>fat_loss'),
            ('endurance>muscle_gain'), ('fat_loss>endurance'), ('fat_loss>muscle_gain'), ('general_fitness>endurance'),
            ('general_fitness>fat_loss'), ('muscle_gain>endurance'), ('muscle_gain>fat_loss') $$,
  'genau die 12 erlaubten Paare (seit FA1: active_aging > fat_loss; Calisthenics: calisthenics > fat_loss)'
);
select is(
  (select count(*)::int from unnest(enum_range(null::public.goal_type)) g where private.goal_pair_allowed(g, g)),
  0, 'kein Ziel doppelt'
);
select ok(not private.goal_pair_allowed('definition', 'fat_loss'), 'Definition + Abnehmen verboten');
select ok(not private.goal_pair_allowed('definition', 'muscle_gain'), 'Definition + Muskelaufbau verboten');
select ok(not private.goal_pair_allowed('fat_loss', 'general_fitness'), 'Fitness als Nebenziel verboten');
select ok(
  not private.goal_pair_allowed('fat_loss', 'definition'), 'Abnehmen + Definition (doppelt) verboten'
);

-- Rechte (Wächter Z1 S-2, K-2): goal_pair_allowed für authenticated/service_role (CHECK ab Z3), nie für anon;
-- assert_plan_inputs nur im definer-Kontext von save_training_plan.
select ok(
  has_function_privilege('authenticated', 'private.goal_pair_allowed(public.goal_type, public.goal_type)', 'execute'),
  'authenticated darf goal_pair_allowed ausführen (CHECK-Bedingung ab Z3)'
);
select ok(
  has_function_privilege('service_role', 'private.goal_pair_allowed(public.goal_type, public.goal_type)', 'execute'),
  'service_role darf goal_pair_allowed ausführen'
);
select ok(
  not has_function_privilege('anon', 'private.goal_pair_allowed(public.goal_type, public.goal_type)', 'execute'),
  'anon darf goal_pair_allowed nicht ausführen'
);
select ok(
  not has_function_privilege('authenticated', 'private.assert_plan_inputs(jsonb)', 'execute')
  and not has_function_privilege('anon', 'private.assert_plan_inputs(jsonb)', 'execute'),
  'assert_plan_inputs nicht direkt aufrufbar (nur über save_training_plan)'
);

-- ---------------------------------------------------------------------------------------------------------
-- 2. private.assert_plan_inputs: fehlend, JSON-null, erlaubt, ungültig
-- ---------------------------------------------------------------------------------------------------------
select lives_ok(
  $$ select private.assert_plan_inputs(pg_temp.inputs()) $$,
  'Angaben OHNE Schlüssel secondaryGoalType (wie bisher) bleiben gültig'
);
select lives_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('endurance', 'null'::jsonb)) $$,
  'secondaryGoalType als JSON-null = kein Nebenziel'
);
select lives_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '"muscle_gain"')) $$,
  'erlaubtes Paar Abnehmen → Muskelaufbau'
);
select lives_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('endurance', '"definition"')) $$,
  'erlaubtes Paar Ausdauer → Definition'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '"kraft"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekannter Text (kein Enum-Wert) → kontrollierter Fehler, kein 22P02'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '""')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'leerer Text wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('definition', '"fat_loss"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'verbotenes Paar Definition → Abnehmen'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '"general_fitness"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Fitness als Nebenziel wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('muscle_gain', '"muscle_gain"')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'doppeltes Ziel wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '3')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Zahl statt Text wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', '["muscle_gain"]')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Liste statt Text wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.with_secondary('fat_loss', 'true')) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Wahrheitswert statt Text wird abgelehnt'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.inputs() || '{"tertiaryGoalType": "fat_loss"}'::jsonb) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Angaben).', 'andere unbekannte Schlüssel bleiben verboten'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.inputs() - 'discipline') $$,
  '22023', 'Ungültige Angaben im Plan.', 'Pflichtschlüssel bleiben Pflicht'
);
select throws_ok(
  $$ select private.assert_plan_inputs(pg_temp.inputs() - 'goalType' || '{"secondaryGoalType": "fat_loss"}'::jsonb) $$,
  '22023', 'Ungültige Angaben im Plan.', 'Nebenziel ersetzt das Hauptziel nicht'
);

-- ---------------------------------------------------------------------------------------------------------
-- 3. save_training_plan (als Nutzer): alte und neue Payloads
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

select is(
  (select array_agg(private.goal_pair_allowed(p, s) order by p, s)
   from (values ('fat_loss'::public.goal_type, 'muscle_gain'::public.goal_type),
                ('definition'::public.goal_type, 'fat_loss'::public.goal_type)) v(p, s)),
  array[true, false],
  'als authenticated ausführbar (wie in einer CHECK-Bedingung)'
);

select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(pg_temp.inputs())) $$,
  'Payload ohne Nebenziel (wie bisher) wird gespeichert'
);
select ok(
  (select not (inputs ? 'secondaryGoalType') from public.user_plans where status = 'active'),
  'gespeicherte Angaben ohne Schlüssel bleiben ohne Schlüssel'
);
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(pg_temp.with_secondary('endurance', 'null'::jsonb))) $$,
  'Payload mit JSON-null als Nebenziel wird gespeichert'
);
select is(
  (select jsonb_typeof(inputs -> 'secondaryGoalType') from public.user_plans where status = 'active'),
  'null', 'JSON-null bleibt gespeichert (gleichbedeutend mit „kein Nebenziel“)'
);
select lives_ok(
  $$ select public.save_training_plan(pg_temp.payload(pg_temp.with_secondary('endurance', '"muscle_gain"'))) $$,
  'Payload mit erlaubtem Nebenziel wird gespeichert'
);
select is(
  (select inputs ->> 'secondaryGoalType' from public.user_plans where status = 'active'),
  'muscle_gain', 'Nebenziel steht im Schnappschuss'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(pg_temp.with_secondary('definition', '"muscle_gain"'))) $$,
  '22023', 'Ungültige Angaben im Plan.', 'verbotenes Paar wird beim Speichern abgelehnt'
);
select throws_ok(
  $$ select public.save_training_plan(pg_temp.payload(pg_temp.with_secondary('endurance', '"ausdauer"'))) $$,
  '22023', 'Ungültige Angaben im Plan.', 'unbekannter Text wird beim Speichern kontrolliert abgelehnt'
);
select is(
  (select count(*)::int from public.user_plans),
  3, 'abgelehnte Payloads speichern nichts'
);

select * from finish();
rollback;
