-- Konto löschen (delete_my_account): löscht alle Daten des Aufrufers per Kaskade, fremde Daten bleiben.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

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
insert into public.training_slots (user_id, slot_no, weekday, kind, minutes)
select u, 1, 3, 'endurance', 30
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.nutrition_prefs (user_id, diet_type)
select u, 'vegan'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.food_preferences (user_id, food_group, kind)
select u, 'soy', 'intolerance'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
-- Phase 3: Trainingspläne (Vorlage als Eigentümer, Pläne beider Nutzer).
insert into public.plan_templates (id, version, status, title_de, description_de, goal_type, experience_level,
  sessions_per_week, minutes_min, minutes_max, location)
values ('vorlage-test', 1, 'published', 'Vorlage für Tests', 'Beschreibung der Vorlage mit genügend Zeichen.',
  'muscle_gain', 'beginner', 3, 45, 60, 'gym');
insert into public.user_plans (user_id, template_id, template_title_de, template_version, engine_version,
  match_quality, inputs, start_date, uses_health_data)
select u, 'vorlage-test', 'Vorlage für Tests', 1, 1, 'exact', '{}', current_date, true
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.planned_sessions (plan_id, user_id, block_no, week_no, template_day_index, scheduled_on,
  name_de, focus, estimated_minutes, warmup_de, cooldown_de)
select id, user_id, 1, 1, 1, current_date + 1, 'Ganzkörper', 'full_body', 50, 'A.', 'B.' from public.user_plans;

-- Phase 4: Trainingstagebuch und Startgewichte beider Nutzer.
insert into public.exercises (id, version, status, name_de, name_en, movement_pattern, primary_muscles, mechanics,
  load_type, difficulty, description_de, steps_de, tips_de, common_mistakes_de, safety_note_de)
values ('uebung-a', 1, 'published', 'Übung A', 'Exercise A', 'squat', '{quadriceps}', 'compound', 'weight', 1,
  'Beschreibung der Übung mit genügend Zeichen.', '{"Erster Schritt der Übung.","Zweiter Schritt der Übung."}',
  '{"Ein hilfreicher Tipp."}', '{"Ein typischer Fehler."}', 'Gewicht so wählen, dass die Technik sauber bleibt.');
insert into public.session_logs (user_id, planned_session_id, kind, performed_on, status, name_de, last_write_id,
  client_updated_at, notes)
select user_id, id, 'strength', current_date, 'completed', 'Ganzkörper', gen_random_uuid(), now(), 'Notiz'
from public.planned_sessions;
insert into public.exercise_logs (session_log_id, user_id, order_no, exercise_id, exercise_name_de, load_type, status)
select id, user_id, 1, 'uebung-a', 'Übung A', 'weight', 'done' from public.session_logs;
insert into public.set_logs (exercise_log_id, user_id, set_no, reps, weight_kg, done)
select id, user_id, 1, 10, 20, true from public.exercise_logs;
insert into public.session_logs (user_id, kind, performed_on, status, name_de, last_write_id, client_updated_at)
select u, 'endurance', current_date - 1, 'completed', 'Ausdauer-Einheit', gen_random_uuid(), now()
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.cardio_logs (session_log_id, user_id, modality, duration_s)
select id, user_id, 'run', 1800 from public.session_logs where kind = 'endurance';
insert into public.exercise_start_weights (user_id, exercise_id, weight_kg)
select u, 'uebung-a', 22.5
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;

-- Phase 5 (N7): Ernährung beider Nutzer – Plan mit Mahlzeit, Einkaufsliste mit eigenem Eintrag, Bewertung,
-- „mag ich nicht“ je Lebensmittel, Spalten des Schritts nutrition_setup.
insert into public.foods (id, version, status, name_de, shopping_category, pantry, pregnancy_caution, alcohol,
  max_fridge_days, freezable, data)
values ('hafer', 1, 'published', 'Hafer', 'other', false, false, false, 2, true, '{}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('muesli', 1, 'published', 'Müsli', '{breakfast}', 1, true, 'vegan', false, '{}');
update public.nutrition_prefs set activity_level = 'light', training_time = 'evening';
insert into public.meal_plans (user_id, week_start, engine_version, variant, inputs, uses_health_data)
select u, date_trunc('week', current_date)::date, 1, 0, '{}', true
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.meal_plan_items (plan_id, user_id, date, slot, recipe_id, recipe_version, title_de, factor, kcal,
  protein_g, carbs_g, fat_g, is_fill, prep_kind, cook_date, day_status)
select id, user_id, week_start, 'breakfast', 'muesli', 1, 'Müsli', 1, 300, 10, 50, 5, false, 'fresh', week_start,
  'complete'
from public.meal_plans;
insert into public.shopping_lists (user_id, week_start, from_date, to_date, plan_key, uses_health_data)
select user_id, week_start, week_start, week_start + 6, 'k', true from public.meal_plans;
insert into public.shopping_list_items (list_id, user_id, item_key, label_de, category, is_pantry, is_manual)
select id, user_id, 'manual|x', 'Eigenes', 'other', false, true from public.shopping_lists;
insert into public.recipe_ratings (user_id, recipe_id, value, rated_on)
select u, 'muesli', 'up', current_date
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into public.food_dislikes (user_id, food_id)
select u, 'hafer'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;

-- Phase 4b Etappe B: Live-Anpassung beider Nutzer – Anpassung, Kennzeichen an der Einheit, Beta-Freischaltung,
-- offenes Ereignis, Zähler der Ratenbegrenzung und ein Protokoll-Eintrag (target_user_id → null).
insert into public.plan_adjustments (user_id, plan_id, trigger, rule, kind, status, exercise_id, basis_session_log_id,
  state_before, state_after, effective_from, engine_version, rule_version, input_fingerprint, uses_body_data,
  from_health_plan)
select p.user_id, p.id, 'session_logged', 'load_reduce', 'state_override', 'applied', 'uebung-a', null,
  '{"weightKg": 20, "targetReps": 8, "extraSet": false, "durationS": null}',
  '{"weightKg": 18, "targetReps": 8, "extraSet": false, "durationS": null}',
  current_date + 1, 1, 1, 'load_reduce:00000000000000aa', false, true
from public.user_plans p;
update public.planned_sessions ps set adjustment_id = a.id from public.plan_adjustments a where a.user_id = ps.user_id;
insert into private.beta_entitlements (user_id, granted_by, expires_at)
select u, 'gruender-1', now() + interval '30 days'
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into private.adjustment_events (user_id, trigger, ref_id)
select u, 'session_logged', gen_random_uuid()
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into private.live_adjust_hourly_counts (user_id, hour_start, count)
select u, date_trunc('hour', now()), 3
from unnest(array['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']::uuid[]) as u;
insert into private.admin_actions (action, actor, target_user_id)
values ('beta_grant', 'gruender-1', '11111111-1111-4111-8111-111111111111');

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
select is_empty($$ select 1 from public.training_slots where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: training_slots leer');
select is_empty($$ select 1 from public.nutrition_prefs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: nutrition_prefs leer');
select is_empty($$ select 1 from public.food_preferences where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: food_preferences leer');

select is_empty($$ select 1 from public.user_plans where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: user_plans leer');

select is_empty($$ select 1 from public.session_logs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: session_logs leer');
select is_empty($$ select 1 from public.exercise_logs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: exercise_logs leer');
select is_empty($$ select 1 from public.set_logs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: set_logs leer');
select is_empty($$ select 1 from public.cardio_logs where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: cardio_logs leer');
select is_empty($$ select 1 from public.exercise_start_weights where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: exercise_start_weights leer');
select is_empty($$ select 1 from public.meal_plans where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: meal_plans leer');
select is_empty($$ select 1 from public.meal_plan_items where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: meal_plan_items leer');
select is_empty($$ select 1 from public.shopping_lists where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: shopping_lists leer');
select is_empty($$ select 1 from public.shopping_list_items where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: shopping_list_items leer');
select is_empty($$ select 1 from public.recipe_ratings where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: recipe_ratings leer');
select is_empty($$ select 1 from public.food_dislikes where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: food_dislikes leer');

select is_empty($$ select 1 from public.plan_adjustments where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: plan_adjustments leer');
select is_empty($$ select 1 from private.beta_entitlements where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: beta_entitlements leer');
select is_empty($$ select 1 from private.adjustment_events where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: adjustment_events leer');
select is_empty($$ select 1 from private.live_adjust_hourly_counts where user_id = '11111111-1111-4111-8111-111111111111' $$, 'A: live_adjust_hourly_counts leer');
select results_eq(
  $$ select count(*)::int, count(target_user_id)::int from private.admin_actions where actor = 'gruender-1' $$,
  $$ values (1, 0) $$,
  'admin_actions: Protokoll bleibt, ohne Personenbezug (target_user_id = null)'
);

-- B ist unberührt.
select is(
  (select count(*) from public.planned_sessions where user_id = '22222222-2222-4222-8222-222222222222'),
  1::bigint, 'B: Trainingsplan unverändert'
);
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

select results_eq(
  $$ select (select count(*)::int from public.session_logs where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.set_logs where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.exercise_start_weights where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (2, 1, 1) $$,
  'B: Tagebuch und Startgewicht unverändert'
);

select results_eq(
  $$ select (select count(*)::int from public.meal_plan_items where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.shopping_list_items where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.recipe_ratings where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.food_dislikes where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (1, 1, 1, 1) $$,
  'B: Ernährung unverändert'
);
select results_eq(
  $$ select (select count(*)::int from public.plan_adjustments where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.planned_sessions where user_id = '22222222-2222-4222-8222-222222222222' and adjustment_id is not null),
            (select count(*)::int from private.beta_entitlements where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from private.adjustment_events where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from private.live_adjust_hourly_counts where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (1, 1, 1, 1, 1) $$,
  'B: Live-Anpassung unverändert'
);
select ok(
  exists (select 1 from public.foods where id = 'hafer') and exists (select 1 from public.recipes where id = 'muesli'),
  'Ernährungs-Inhalte bleiben erhalten'
);

-- Kataloge bleiben erhalten.
select is((select count(*) from public.equipment), 23::bigint, 'Geräte-Katalog bleibt erhalten');

select * from finish();
rollback;
