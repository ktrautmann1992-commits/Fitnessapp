-- Konto löschen (delete_my_account): löscht alle Daten des Aufrufers per Kaskade, fremde Daten bleiben.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');

-- Beide Nutzer bekommen Daten in allen Tabellen (als Datenbank-Admin angelegt, Einwilligung vorhanden).
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array[
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222'
]::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;

insert into public.profiles (user_id, birth_date)
select u, '1990-01-01'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.body_metrics (user_id, weight_kg)
select u, 75
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.body_measurements (user_id, waist_cm)
select u, 82
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.measurement_reminders (user_id)
select u
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.health_screening (user_id, answers)
select u, '{"heart_condition": false, "chest_pain_exercise": false, "chest_pain_rest": false, "dizziness": false, "blood_pressure": false, "bone_joint": false, "medication": false, "other_reason": false}'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.goals (user_id, goal_type)
select u, 'general_fitness'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.user_equipment (user_id, equipment_id, location)
select u, 'pull_up_bar', 'home'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.nutrition_prefs (user_id, diet_type)
select u, 'vegan'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.food_preferences (user_id, food_group, kind)
select u, 'soy', 'intolerance'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;

-- Ohne Anmeldung (authenticated ohne Nutzer-ID) passiert nichts.
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok($$ select public.delete_my_account() $$, '42501', 'Nicht angemeldet.', 'ohne Nutzer-ID: Fehler');

-- Nutzer A löscht sein Konto.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.delete_my_account() $$, 'A löscht das eigene Konto');

reset role;
select is_empty(
  $$ select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111' $$,
  'A ist aus auth.users gelöscht'
);
select is_empty($$ select 1 from public.profiles where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: profiles leer');
select is_empty($$ select 1 from public.consents where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: consents leer');
select is_empty($$ select 1 from public.body_metrics where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: body_metrics leer');
select is_empty($$ select 1 from public.body_measurements where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: body_measurements leer');
select is_empty($$ select 1 from public.measurement_reminders where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: measurement_reminders leer');
select is_empty($$ select 1 from public.health_screening where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: health_screening leer');
select is_empty($$ select 1 from public.goals where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: goals leer');
select is_empty($$ select 1 from public.user_equipment where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: user_equipment leer');
select is_empty($$ select 1 from public.nutrition_prefs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: nutrition_prefs leer');
select is_empty($$ select 1 from public.food_preferences where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: food_preferences leer');

-- B ist unberührt.
select is(
  (select count(*) from auth.users where id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'B existiert weiter'
);
select is(
  (select count(*) from public.consents where user_id = '22222222-2222-4222-8222-222222222222'),
  3::bigint, 'B: Einwilligungen unverändert'
);
select is(
  (select count(*) from public.body_metrics where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'B: Körperdaten unverändert'
);
select is(
  (select count(*) from public.body_measurements where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'B: Körperumfänge unverändert'
);
select is(
  (select count(*) from public.food_preferences where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'B: Vorlieben unverändert'
);

-- Kataloge bleiben erhalten.
select is((select count(*) from public.equipment), 11::bigint, 'Geräte-Katalog bleibt erhalten');

select * from finish();
rollback;
