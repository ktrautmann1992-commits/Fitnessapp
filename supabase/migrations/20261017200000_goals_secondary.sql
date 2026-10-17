-- Ziele · Etappe Z3 (docs/PLAN-ZIELE.md 5.1 Teil Z3 und 6 Nr. 2, Wächter K4): Haupt- und optionales Nebenziel in
-- public.goals. Nur additiv: eine neue, leere Spalte, kein Datenumbau – wer heute ein Ziel hat, behält es.
-- 1. goals.secondary_goal_type (null = kein Nebenziel) mit Paar-CHECK über private.goal_pair_allowed (Etappe Z1,
--    = GOAL_COMBINATIONS in packages/core; Ausführungsrecht für authenticated/service_role seit Z1, Wächter Z1 S-2).
-- 2. Disziplin-CHECK: Disziplin nur, wenn Ausdauer Haupt- ODER Nebenziel ist (= createGoalStepSchema).
-- 3. profiles.onboarding_step: neuer Schritt 'weight_goal' direkt nach 'goal' (= ONBOARDING_STEPS, letzte Fassung zählt,
--    db-sync.test.ts). Der Schritt bleibt in der App bis Etappe Z4 abgeschaltet (WEIGHT_GOAL_STEP_ENABLED = false).
-- Kein Gesundheitsdatum (wie bisher goals): keine Einwilligung nötig, RLS unverändert (Policies gelten für die Zeile).

-- ---------------------------------------------------------------------------------------------------------
-- 1. Nebenziel
-- ---------------------------------------------------------------------------------------------------------
alter table public.goals add column secondary_goal_type public.goal_type;

comment on column public.goals.secondary_goal_type is
  'Nebenziel (docs/PLAN-ZIELE.md 4); null = kein Nebenziel. Nur erlaubte Paare (private.goal_pair_allowed).';

alter table public.goals add constraint goals_secondary_goal_pair_check check (
  secondary_goal_type is null or private.goal_pair_allowed(goal_type, secondary_goal_type)
);

-- ---------------------------------------------------------------------------------------------------------
-- 2. Disziplin: der bisherige CHECK war unbenannt (inline, Postgres-Name goals_check). Er wird über seine Bedingung
-- gesucht und ersetzt – so hängt die Migration nicht am automatisch vergebenen Namen.
-- ---------------------------------------------------------------------------------------------------------
do $$
declare
  old_name text;
begin
  for old_name in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.goals'::regclass
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%discipline IS NULL%'
      and pg_catalog.pg_get_constraintdef(c.oid) not like '%secondary_goal_type%'
  loop
    execute format('alter table public.goals drop constraint %I', old_name);
  end loop;
end;
$$;

-- Ausdrücklich ohne `'endurance' in (goal_type, secondary_goal_type)`: Bei Nebenziel null wäre das Ergebnis NULL, und
-- ein CHECK mit NULL gilt als erfüllt.
alter table public.goals add constraint goals_discipline_check check (
  discipline is null or goal_type = 'endurance' or secondary_goal_type is not distinct from 'endurance'
);

-- ---------------------------------------------------------------------------------------------------------
-- 3. Onboarding-Schritt 'weight_goal' (Liste = ONBOARDING_STEPS in packages/core/src/onboarding.ts)
-- ---------------------------------------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_onboarding_step_check;

alter table public.profiles add constraint profiles_onboarding_step_check check (
  onboarding_step in (
    'sex',
    'health_consent',
    'body_metrics',
    'body_measurements',
    'health_screening',
    'experience',
    'goal',
    'weight_goal',
    'time_budget',
    'training_location',
    'equipment',
    'nutrition',
    'cooking',
    'nutrition_setup'
  )
);
