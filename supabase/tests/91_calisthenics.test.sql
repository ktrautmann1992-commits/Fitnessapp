-- Calisthenics, Schlingentrainer, Lauf-Kraft (docs/PLAN-CALISTHENICS-SCHLINGE.md 6): nur additive Änderungen –
-- neue Enum-Werte, Geräte-Katalog (Barren zu Hause, Ringe, Parallettes, Park), Ziel Calisthenics mit Nebenziel
-- Abnehmen, CHECK der Vorlagen-Ziele, Reise-Geräte. RLS der Nutzertabellen bleibt unverändert (Nutzer B sieht nichts).
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

create temporary table t_today as select (now() at time zone 'Europe/Berlin')::date as d;
grant select on t_today to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Enums und Katalog
-- ---------------------------------------------------------------------------------------------------------
select ok('calisthenics' = any (enum_range(null::public.goal_type)::text[]), 'goal_type kennt calisthenics');
select ok(
  'run_strength' = any (enum_range(null::public.workout_category)::text[]),
  'workout_category kennt run_strength'
);
select ok(
  array['rings', 'outdoor_park'] <@ enum_range(null::public.travel_equipment)::text[],
  'travel_equipment kennt rings und outdoor_park'
);
select results_eq(
  $$ select id || ':' || home_selectable::text from public.equipment
     where id in ('dip_station', 'gymnastic_rings', 'parallettes', 'calisthenics_park', 'suspension_trainer')
     order by sort_order $$,
  array['dip_station:true', 'gymnastic_rings:true', 'parallettes:true', 'calisthenics_park:true',
        'suspension_trainer:true'],
  'Barren, Ringe, Parallettes, Park und Schlingentrainer sind zu Hause wählbar'
);
select is(
  (select category::text from public.equipment where id = 'calisthenics_park'), 'bodyweight',
  'Park zählt als Körpergewicht-Gerät'
);
select ok(
  pg_get_constraintdef(
    (select oid from pg_constraint where conname = 'plan_templates_goal_type_check')
  ) like '%calisthenics%',
  'plan_templates.goal_type erlaubt calisthenics (nur nach Freigabe eingespielt)'
);
select ok(private.goal_pair_allowed('calisthenics', 'fat_loss'), 'Paar Calisthenics → Abnehmen erlaubt');
select ok(not private.goal_pair_allowed('calisthenics', 'muscle_gain'), 'Calisthenics → Muskelaufbau verboten');
select ok(not private.goal_pair_allowed('fat_loss', 'calisthenics'), 'Calisthenics als Nebenziel verboten');
select ok(private.goal_pair_allowed('active_aging', 'fat_loss'), 'bisherige Paare unverändert');

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer A: Ziel, Geräte, Reise-Modus
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
insert into public.profiles (birth_date) values ('1990-01-01');

select lives_ok(
  $$ insert into public.goals (goal_type, secondary_goal_type) values ('calisthenics', 'fat_loss') $$,
  'Ziel Calisthenics mit Nebenziel Abnehmen speicherbar'
);
select throws_ok(
  $$ update public.goals set secondary_goal_type = 'endurance' $$,
  '23514', null, 'Calisthenics → Ausdauer: Paar-CHECK greift'
);
select lives_ok(
  $$ insert into public.user_equipment (equipment_id, location) values
       ('dip_station', 'home'), ('gymnastic_rings', 'home'), ('parallettes', 'home'),
       ('calisthenics_park', 'home'), ('suspension_trainer', 'home') $$,
  'Barren (bisher nur Studio), Ringe, Parallettes, Park und Schlingentrainer zu Hause speicherbar'
);
select throws_ok(
  $$ insert into public.user_equipment (equipment_id, location) values ('cable_station', 'home') $$,
  '23514', 'Dieses Gerät gibt es nur im Studio.', 'Studio-Geräte zu Hause weiterhin abgelehnt'
);
select lives_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d, d + 3, 'outdoor_park' from t_today $$,
  'Reise-Modus mit Calisthenics-Park'
);
select lives_ok(
  $$ insert into public.travel_modes (starts_on, ends_on, equipment) select d + 10, d + 12, 'rings' from t_today $$,
  'Reise-Modus mit Turnringen'
);

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer B sieht nichts von A
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.goals), 0, 'B sieht das Ziel von A nicht');
select is((select count(*)::int from public.user_equipment), 0, 'B sieht die Geräte von A nicht');
select is((select count(*)::int from public.travel_modes), 0, 'B sieht die Reisen von A nicht');

reset role;
select is(
  (select count(*)::int from public.equipment where not home_selectable), 7,
  'Studio-only bleiben 7 Geräte (Barren ist jetzt auch zu Hause wählbar)'
);

select * from finish();
rollback;
