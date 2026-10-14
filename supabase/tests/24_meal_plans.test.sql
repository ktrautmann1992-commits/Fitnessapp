-- Phase 5 · N7: Nutzertabellen der Ernährung (docs/PLAN-PHASE-5.md 7.2, 19.4, 19.7 N10): RLS (fremde Nutzer sehen
-- und ändern nichts, anon nichts), Spaltenrechte (nur Merker, Kochtag-Start und Häkchen direkt änderbar), CHECKs,
-- recipe_ratings (Grund nur bei Daumen runter und ohne „Unverträglich“, eine Bewertung je Rezept, Datum = heute,
-- keine Aggregation) und food_dislikes (ohne Zeitstempel, höchstens 300). „Heute“ = Mittwoch, 14.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(65);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-14'
$$;

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.nutrition_prefs (user_id, diet_type) values ('11111111-1111-4111-8111-111111111111', 'omnivore');

insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, pregnancy_caution,
  alcohol, max_fridge_days, freezable, data)
select 'lm-' || n, 1, 'published', 'Lebensmittel ' || n, 'other', false, '{}', false, false, 2, true, '{}'
from generate_series(1, 302) as n;
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('porridge', 1, 'published', 'Porridge', '{breakfast}', 1, false, 'vegan', false, '{}'),
       ('alt-rezept', 1, 'archived', 'Altes Rezept', '{main}', 1, false, 'vegan', false, '{}');
insert into public.meal_prep_plans (id, version, status, title_de, recipe_ids, data)
values ('mp-test', 1, 'published', 'Meal-Prep-Test', '{porridge}', '{}');

-- Daten beider Nutzer als Eigentümer (die Funktionen testet 25_meal_plan_rpcs.test.sql).
insert into public.meal_plans (id, user_id, week_start, engine_version, variant, meal_prep_plan_id, inputs,
  uses_health_data)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-12', 1, 0, 'mp-test', '{}', true),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-12', 1, 0, null, '{}', false);
insert into public.meal_plan_items (plan_id, user_id, date, slot, recipe_id, recipe_version, title_de, factor, kcal,
  protein_g, carbs_g, fat_g, is_fill, prep_kind, cook_date, day_status)
values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-14', 'breakfast',
   'porridge', 1, 'Porridge', 1.2, 420, 15, 60, 10, false, 'fresh', '2026-10-14', 'complete'),
  ('b1000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-14', 'breakfast',
   'porridge', 1, 'Porridge', 1, 350, 12, 50, 8, false, 'fresh', '2026-10-14', 'no_targets');
insert into public.shopping_lists (id, user_id, week_start, meal_plan_id, from_date, to_date, plan_key,
  uses_health_data)
values
  ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-10-12',
   'a1000000-0000-4000-8000-000000000001', '2026-10-12', '2026-10-18', 'k-a', true),
  ('b2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '2026-10-12', null,
   '2026-10-12', '2026-10-18', 'k-b', false);
insert into public.shopping_list_items (list_id, user_id, item_key, food_id, label_de, amount, unit, category,
  is_pantry, is_manual)
values
  ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'lm-1|g', 'lm-1', 'Hafer', 100,
   'g', 'other', false, false),
  ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'manual|x', null, 'Kerzen', null,
   null, 'other', false, true),
  ('b2000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'lm-2|g', 'lm-2', 'Milch', 200,
   'g', 'other', false, false);
insert into public.recipe_ratings (user_id, recipe_id, value, reason, rated_on)
values ('22222222-2222-4222-8222-222222222222', 'porridge', 'down', 'taste', '2026-10-14');
insert into public.food_dislikes (user_id, food_id)
values ('22222222-2222-4222-8222-222222222222', 'lm-5');

-- ---------------------------------------------------------------------------------------------------------
-- Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.meal_plans'::regclass, 'public.meal_plan_items'::regclass,
     'public.shopping_lists'::regclass, 'public.shopping_list_items'::regclass,
     'public.recipe_ratings'::regclass, 'public.food_dislikes'::regclass)),
  'RLS auf allen sechs Nutzertabellen der Ernährung'
);
select hasnt_column('public', 'food_dislikes', 'created_at', 'food_dislikes ohne created_at (Wächter N10 H8)');
select is(
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
   where table_schema = 'public' and table_name = 'food_dislikes'),
  '{food_id,user_id}'::text[], 'food_dislikes: nur Nutzer und Lebensmittel (kein Zeitstempel, kein Grund)'
);
select hasnt_column('public', 'meal_plans', 'band', 'meal_plans speichert kein Planband (Wächter N5a S4)');
select hasnt_column('public', 'meal_plans', 'safety_key', 'meal_plans speichert keinen Abgleich-Schlüssel');
select hasnt_column('public', 'meal_plan_items', 'shared', 'geteilte Mahlzeiten bis P1 nicht speicherbar');
select ok(
  not has_table_privilege('authenticated', 'public.meal_plans', 'insert')
  and not has_table_privilege('authenticated', 'public.meal_plan_items', 'insert')
  and not has_table_privilege('authenticated', 'public.meal_plan_items', 'update')
  and not has_table_privilege('authenticated', 'public.shopping_lists', 'insert')
  and not has_table_privilege('authenticated', 'public.shopping_list_items', 'insert')
  and not has_column_privilege('authenticated', 'public.meal_plans', 'uses_health_data', 'update')
  and not has_column_privilege('authenticated', 'public.shopping_list_items', 'label_de', 'update')
  and has_column_privilege('authenticated', 'public.shopping_list_items', 'checked', 'update'),
  'Schreiben nur über die Funktionen; direkt nur Merker, Kochtag-Start und Häkchen'
);
select is_empty(
  $$ select viewname from pg_views where schemaname = 'public' $$,
  'keine Views im Schema public (keine Aggregation von Bewertungen)'
);

-- ---------------------------------------------------------------------------------------------------------
-- A sieht und ändert nur Eigenes
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select id from public.meal_plans $$, $$ values ('a1000000-0000-4000-8000-000000000001'::uuid) $$,
  'A sieht nur den eigenen Plan');
select is((select count(*)::int from public.meal_plan_items), 1, 'A sieht nur eigene Mahlzeiten');
select results_eq($$ select id from public.shopping_lists $$, $$ values ('a2000000-0000-4000-8000-000000000001'::uuid) $$,
  'A sieht nur die eigene Liste');
select is((select count(*)::int from public.shopping_list_items), 2, 'A sieht nur eigene Einträge');
select is_empty($$ select 1 from public.recipe_ratings $$, 'A sieht keine Bewertungen von B');
select is_empty($$ select 1 from public.food_dislikes $$, 'A sieht keine Abneigungen von B');

select throws_ok(
  $$ insert into public.meal_plans (user_id, week_start, engine_version, variant, inputs, uses_health_data)
     values ('11111111-1111-4111-8111-111111111111', '2026-10-19', 1, 0, '{}', false) $$,
  '42501', null, 'A legt keinen Plan direkt an (nur save_meal_plan)'
);
select throws_ok(
  $$ update public.meal_plans set uses_health_data = false $$,
  '42501', null, 'A ändert uses_health_data nicht (setzt nur der Server)'
);
select throws_ok(
  $$ update public.meal_plan_items set factor = 2 $$, '42501', null, 'A ändert keine Mahlzeiten direkt'
);
select lives_ok(
  $$ update public.meal_plans set auto_adjusted = false, recipes_changed = false,
       cook_day_started_at = '2026-10-11 09:00+02' $$,
  'A setzt Merker und Kochtag-Start'
);
select lives_ok(
  $$ update public.shopping_list_items set checked = true where item_key = 'lm-1|g' $$, 'A hakt ab'
);
select throws_ok(
  $$ update public.shopping_list_items set label_de = 'Anders' $$, '42501', null, 'A ändert keine Beschriftung direkt'
);
select throws_ok(
  $$ insert into public.shopping_list_items (list_id, user_id, item_key, label_de, category, is_pantry, is_manual)
     values ('a2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'manual|y', 'Neu',
       'other', false, true) $$,
  '42501', null, 'A legt Einträge nur über replace_shopping_list an'
);
-- Fremde Zeilen: Änderungen und Löschen bleiben ohne Wirkung (RLS).
update public.meal_plans set auto_adjusted = true where id = 'b1000000-0000-4000-8000-000000000001';
update public.shopping_list_items set checked = true where list_id = 'b2000000-0000-4000-8000-000000000001';
delete from public.meal_plans where id = 'b1000000-0000-4000-8000-000000000001';
delete from public.shopping_lists where id = 'b2000000-0000-4000-8000-000000000001';
delete from public.recipe_ratings where user_id = '22222222-2222-4222-8222-222222222222';
delete from public.food_dislikes where user_id = '22222222-2222-4222-8222-222222222222';
select throws_ok(
  $$ insert into public.recipe_ratings (user_id, recipe_id, value, rated_on)
     values ('22222222-2222-4222-8222-222222222222', 'porridge', 'up', '2026-10-14') $$,
  '42501', null, 'A bewertet nicht im Namen von B'
);
select throws_ok(
  $$ insert into public.food_dislikes (user_id, food_id) values ('22222222-2222-4222-8222-222222222222', 'lm-1') $$,
  '42501', null, 'A lehnt nicht im Namen von B ab'
);

reset role;
select results_eq(
  $$ select auto_adjusted, (select count(*)::int from public.meal_plan_items i where i.plan_id = p.id)
     from public.meal_plans p where p.user_id = '22222222-2222-4222-8222-222222222222' $$,
  $$ values (false, 1) $$, 'B: Plan unverändert (A konnte nichts ändern oder löschen)'
);
select is(
  (select count(*)::int from public.shopping_list_items where user_id = '22222222-2222-4222-8222-222222222222' and not checked),
  1, 'B: Häkchen unverändert'
);
select results_eq(
  $$ select (select count(*)::int from public.recipe_ratings where user_id = '22222222-2222-4222-8222-222222222222'),
            (select count(*)::int from public.food_dislikes where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (1, 1) $$, 'B: Bewertung und Abneigung unverändert'
);
select ok(
  (select checked from public.shopping_list_items where item_key = 'lm-1|g'), 'A: eigenes Häkchen gesetzt'
);

-- ---------------------------------------------------------------------------------------------------------
-- CHECK-Bedingungen (als Eigentümer)
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ update public.meal_plans set meal_prep_plan_id = null where id = 'a1000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Kochtag-Start nur mit Meal-Prep-Plan'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, week_start, engine_version, variant, inputs, uses_health_data)
     values ('11111111-1111-4111-8111-111111111111', '2026-10-13', 1, 0, '{}', false) $$,
  '23514', null, 'Woche beginnt am Montag'
);
select throws_ok(
  $$ insert into public.meal_plans (user_id, week_start, engine_version, variant, inputs, uses_health_data)
     values ('11111111-1111-4111-8111-111111111111', '2026-10-12', 1, 0, '{}', false) $$,
  '23505', null, 'höchstens ein Plan je Woche'
);
select throws_ok(
  $$ update public.meal_plan_items set factor = 2.1 $$, '23514', null, 'Faktor höchstens 2 (PORTION_SCALE_LIMITS)'
);
select throws_ok(
  $$ update public.meal_plan_items set factor = 0.4 $$, '23514', null, 'Faktor mindestens 0,5'
);
select throws_ok(
  $$ update public.meal_plan_items set slot = 'brunch' $$, '23514', null, 'unbekannter Platz abgelehnt'
);
select throws_ok(
  $$ update public.meal_plan_items set day_status = 'unknown' $$, '23514', null, 'unbekannter Tagesstatus abgelehnt'
);
select throws_ok(
  $$ update public.meal_plan_items set cook_date = '2026-10-15' $$, '23514', null, 'Kochtag nie nach dem Tag'
);
select throws_ok(
  $$ update public.shopping_lists set to_date = '2026-10-19' where id = 'a2000000-0000-4000-8000-000000000001' $$,
  '23514', null, 'Zeitraum der Liste innerhalb der Woche'
);
select throws_ok(
  $$ update public.shopping_list_items set item_key = 'lm-1|piece' where item_key = 'manual|x' $$,
  '23514', null, 'eigener Eintrag nur mit Schlüssel manual|…'
);
select throws_ok(
  $$ update public.shopping_list_items set label_de = repeat('x', 81) where item_key = 'manual|x' $$,
  '23514', null, 'eigener Eintrag höchstens 80 Zeichen'
);
select throws_ok(
  $$ update public.nutrition_prefs set activity_level = 'light' $$, '23514', null,
  'nutrition_setup: Alltag nur zusammen mit Trainingszeit'
);
select lives_ok(
  $$ update public.nutrition_prefs set activity_level = 'light', training_time = 'varies', show_energy_numbers = false,
       mealprep_slots = 'lunch_dinner' $$,
  'nutrition_setup: Spalten speicherbar (N7, R2-S3)'
);

-- ---------------------------------------------------------------------------------------------------------
-- recipe_ratings und food_dislikes als Nutzer A
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, reason, rated_on)
     values ('porridge', 'down', 'effort', '2026-10-14') $$,
  'A bewertet mit Daumen runter und Grund'
);
select throws_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, rated_on) values ('porridge', 'up', '2026-10-14') $$,
  '23505', null, 'eine Bewertung je Rezept (die App ersetzt per Upsert)'
);
select lives_ok(
  $$ update public.recipe_ratings set value = 'up', reason = null where recipe_id = 'porridge' $$,
  'A ersetzt die Bewertung'
);
select throws_ok(
  $$ update public.recipe_ratings set reason = 'taste' where recipe_id = 'porridge' $$,
  '23514', null, 'Grund nur bei Daumen runter'
);
select throws_ok(
  $$ update public.recipe_ratings set value = 'down', reason = 'intolerant' where recipe_id = 'porridge' $$,
  '23514', null, 'Grund „Unverträglich“ wird nie gespeichert (Art. 9)'
);
select throws_ok(
  $$ update public.recipe_ratings set rated_on = '2026-09-01' where recipe_id = 'porridge' $$,
  '23514', 'Bewertung nur mit dem heutigen Datum.', 'Bewertung nicht rückdatierbar'
);
select lives_ok(
  $$ update public.recipe_ratings set rated_on = '2026-10-13' where recipe_id = 'porridge' $$,
  'Gerätezeit ±1 Tag erlaubt'
);
select throws_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, rated_on) values ('gibt-es-nicht', 'up', '2026-10-14') $$,
  '23503', null, 'nur bekannte Rezepte'
);
select lives_ok(
  $$ insert into public.food_dislikes (food_id) select 'lm-' || n from generate_series(1, 300) as n $$,
  'A lehnt 300 Lebensmittel ab'
);
select throws_ok(
  $$ insert into public.food_dislikes (food_id) values ('lm-301') $$,
  '23514', 'Zu viele abgelehnte Lebensmittel.', 'höchstens 300 abgelehnte Lebensmittel'
);
select throws_ok(
  $$ update public.food_dislikes set food_id = 'lm-302' where food_id = 'lm-1' $$,
  '42501', null, 'abgelehnte Lebensmittel werden nicht geändert, nur ersetzt'
);
select lives_ok($$ delete from public.food_dislikes where food_id = 'lm-1' $$, 'A lässt ein Lebensmittel wieder zu');
select is((select count(*)::int from public.food_dislikes), 299, 'A: 299 abgelehnte Lebensmittel');

-- Wächter N7 H4: Bei erreichter Höchstzahl (2.000) lässt sich eine vorhandene Bewertung per Upsert ändern, eine neue
-- nicht anlegen.
reset role;
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
select 'rz-' || n, 1, 'published', 'Rezept ' || n, '{main}', 1, false, 'vegan', false, '{}'
from generate_series(1, 2000) as n;
insert into public.recipe_ratings (user_id, recipe_id, value, rated_on)
select '22222222-2222-4222-8222-222222222222', 'rz-' || n, 'up', '2026-10-14' from generate_series(1, 1999) as n;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::int from public.recipe_ratings), 2000, 'B hat 2.000 Bewertungen (Höchstzahl)');
select lives_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, reason, rated_on) values ('rz-1', 'down', 'cost', '2026-10-14')
     on conflict (user_id, recipe_id) do update set value = excluded.value, reason = excluded.reason,
       rated_on = excluded.rated_on $$,
  'H4: vorhandene Bewertung per Upsert änderbar trotz Höchstzahl'
);
select is((select value from public.recipe_ratings where recipe_id = 'rz-1'), 'down', 'H4: Änderung gespeichert');
select throws_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, rated_on) values ('rz-2000', 'up', '2026-10-14') $$,
  '23514', 'Zu viele Bewertungen.', 'H4: neue Bewertung über der Höchstzahl abgelehnt'
);
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';

-- Ohne Profil keine Bewertung und keine Abneigung.
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ insert into public.recipe_ratings (recipe_id, value, rated_on) values ('porridge', 'up', '2026-10-14') $$,
  '42501', null, 'ohne Profil: keine Bewertung'
);
select throws_ok(
  $$ insert into public.food_dislikes (food_id) values ('lm-1') $$, '42501', null, 'ohne Profil: keine Abneigung'
);

-- ---------------------------------------------------------------------------------------------------------
-- anon: kein Zugriff
-- ---------------------------------------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select 1 from public.meal_plans $$, '42501', null, 'anon: kein Zugriff auf meal_plans');
select throws_ok($$ select 1 from public.meal_plan_items $$, '42501', null, 'anon: kein Zugriff auf meal_plan_items');
select throws_ok($$ select 1 from public.shopping_lists $$, '42501', null, 'anon: kein Zugriff auf shopping_lists');
select throws_ok($$ select 1 from public.shopping_list_items $$, '42501', null, 'anon: kein Zugriff auf shopping_list_items');
select throws_ok($$ select 1 from public.recipe_ratings $$, '42501', null, 'anon: kein Zugriff auf recipe_ratings');
select throws_ok($$ select 1 from public.food_dislikes $$, '42501', null, 'anon: kein Zugriff auf food_dislikes');

select * from finish();
rollback;
