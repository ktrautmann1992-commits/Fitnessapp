-- Phase 5 · N7: replace_shopping_list (docs/PLAN-PHASE-5.md 6.5, 7.3, K10) und replace_food_dislikes (19.7 N10):
-- Login/Profil, nur bekannte Felder, Datumsrahmen, Grenzen (eigene Einträge, Rezepte), Gesundheitsbezug sichere
-- Richtung (Angabe der App ODER Plan der Woche ODER zusätzliche Rezepte mit Unverträglichkeiten/Gesundheitsangaben),
-- ohne Einwilligung keine Liste mit Gesundheitsbezug, Ersetzen behält ID, Widerruf löscht Listen mit Gesundheitsbezug
-- samt eigener Einträge, Export enthält alle Ernährungs-Tabellen, fremde Nutzer sehen nichts.
-- „Heute“ = Mittwoch, 14.10.2026.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

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
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select '11111111-1111-4111-8111-111111111111', t, 1, 'web'
from unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform)
select '22222222-2222-4222-8222-222222222222', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) as t;
insert into public.food_preferences (user_id, food_group, kind)
values ('11111111-1111-4111-8111-111111111111', 'peanuts', 'intolerance');

insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, pregnancy_caution,
  alcohol, max_fridge_days, freezable, data)
values
  ('hafer', 1, 'published', 'Hafer', 'pasta_rice_grains', false, '{gluten}', false, false, 2, true, '{}'),
  ('tofu', 1, 'published', 'Tofu', 'chilled_plant_based', false, '{soy}', false, false, 2, true, '{}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values ('muesli', 1, 'published', 'Müsli', '{breakfast}', 1, true, 'vegan', false, '{}'),
       ('alt-rezept', 1, 'archived', 'Altes Rezept', '{main}', 1, false, 'vegan', false, '{}');

-- Eingabe wie toShoppingListPayload() (packages/core/src/nutrition/shopping-list-payload.ts).
create function pg_temp.entry(p_key text, p_food text default null, p_checked boolean default false,
  p_label text default 'Eintrag')
returns jsonb language sql as $$
  select jsonb_build_object(
    'item_key', p_key, 'food_id', p_food, 'label_de', p_label, 'amount', case when p_food is null then null else 100 end,
    'unit', case when p_food is null then null else 'g' end, 'category', 'other', 'is_pantry', false,
    'is_manual', p_key like 'manual|%', 'checked', p_checked, 'substitute_for', '[]'::jsonb,
    'amount_changed', false, 'not_in_plan', false
  )
$$;
create function pg_temp.list(p_items jsonb, p_recipes jsonb default '[]', p_uses boolean default false,
  p_week text default '2026-10-12', p_from text default '2026-10-12', p_to text default '2026-10-18')
returns jsonb language sql as $$
  select jsonb_build_object(
    'week_start', p_week, 'from_date', p_from, 'to_date', p_to, 'uses_health_data', p_uses, 'plan_key', 'k1',
    'recipes', p_recipes, 'items', p_items
  )
$$;

select ok(
  has_function_privilege('authenticated', 'public.replace_shopping_list(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.replace_shopping_list(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.replace_food_dislikes(jsonb)', 'execute')
  and (select prosecdef from pg_proc where oid = 'public.replace_shopping_list(jsonb)'::regprocedure)
  and not (select prosecdef from pg_proc where oid = 'public.replace_food_dislikes(jsonb)'::regprocedure),
  'Rechte: replace_shopping_list security definer, replace_food_dislikes security invoker, beide nicht für anon'
);

-- ---------------------------------------------------------------------------------------------------------
-- B (ohne Einwilligung): Liste ohne Gesundheitsbezug
-- ---------------------------------------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select lives_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(
       pg_temp.entry('hafer|g', 'hafer'), pg_temp.entry('manual|kerzen', p_label => 'Kerzen')))) $$,
  'B speichert eine Liste mit eigenem Eintrag'
);
select results_eq(
  $$ select uses_health_data, meal_plan_id is null, from_date, to_date from public.shopping_lists $$,
  $$ values (false, true, date '2026-10-12', date '2026-10-18') $$,
  'B: Liste ohne Gesundheitsbezug, ohne Plan der Woche'
);
create temporary table b_list on commit drop as select id, created_at from public.shopping_lists;
select lives_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(
       pg_temp.entry('hafer|g', 'hafer', true), pg_temp.entry('manual|kerzen', p_label => 'Kerzen')),
       p_from => '2026-10-14')) $$,
  'B ersetzt die Liste (Häkchen, Zeitraum)'
);
select results_eq(
  $$ select l.id, l.created_at, l.from_date from public.shopping_lists l $$,
  $$ select id, created_at, date '2026-10-14' from b_list $$,
  'Ersetzen behält ID und Anlagedatum (höchstens eine Liste je Woche)'
);
select results_eq(
  $$ select item_key, checked from public.shopping_list_items order by item_key $$,
  $$ values ('hafer|g', true), ('manual|kerzen', false) $$,
  'Einträge ersetzt'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', p_uses => true)) $$,
  '42501', 'Für diese Einkaufsliste fehlt die Einwilligung.', 'ohne Einwilligung keine Liste mit Gesundheitsbezug'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]') || '{"user_id": "11111111-1111-4111-8111-111111111111"}') $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Einkaufsliste).', 'unbekanntes Feld abgelehnt'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', p_week => '2026-10-26', p_from => '2026-10-26',
       p_to => '2026-10-27')) $$,
  '22023', 'Woche außerhalb des Rahmens.', 'übernächste Woche abgelehnt'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', p_to => '2026-10-19')) $$,
  '23514', 'Ungültige Werte in der Einkaufsliste.', 'Zeitraum außerhalb der Woche – Fehler ohne Werte'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(pg_temp.entry('manual|x', 'hafer') ||
       '{"is_manual": false}'))) $$,
  '23514', 'Ungültige Werte in der Einkaufsliste.', 'Schlüssel manual|… nur für eigene Einträge'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list((select jsonb_agg(pg_temp.entry('manual|' || n))
       from generate_series(1, 101) as n))) $$,
  '22023', 'Zu viele eigene Einträge.', 'höchstens 100 eigene Einträge'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(pg_temp.entry('x|g', 'gibt-es-nicht')))) $$,
  '23503', 'Ungültige Werte in der Einkaufsliste.', 'unbekanntes Lebensmittel – Fehler ohne Werte'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', '[{"recipe_id": "alt-rezept", "servings": 2, "diet": null}]')) $$,
  '22023', 'Rezept nicht freigegeben.', '„Zur Einkaufsliste“ nur mit freigegebenen Rezepten'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', '[{"recipe_id": "muesli", "servings": 13, "diet": null}]')) $$,
  '22023', 'Ungültiges Rezept in der Einkaufsliste.', 'höchstens 12 Portionen'
);
-- Wächter N7 H1: Größen früh begrenzt.
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(jsonb_set(pg_temp.entry('hafer|g', 'hafer'),
       '{substitute_for}', (select jsonb_agg('hafer'::text) from generate_series(1, 51)))))) $$,
  '22023', 'Ungültiger Eintrag.', 'H1: höchstens 50 Ersatz-Verweise je Eintrag'
);
select throws_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(pg_temp.entry('manual|gross',
       p_label => repeat('x', 2100000))))) $$,
  '22023', 'Einkaufsliste zu groß.', 'H1: Einkaufsliste über 2 MiB abgelehnt, bevor geprüft wird'
);
select lives_ok(
  $$ select public.replace_shopping_list(pg_temp.list('[]', '[{"recipe_id": "muesli", "servings": 2, "diet": "vegetarian"}]')) $$,
  'B: Rezept aus der Suche mit erweiterter Ernährungsform'
);
select is((select uses_health_data from public.shopping_lists), false,
  'ohne Einwilligung und Unverträglichkeiten: kein Gesundheitsbezug');
select lives_ok(
  $$ update public.shopping_list_items set checked = true $$, 'B hakt ab (direkt, Spalte checked)'
);

-- ---------------------------------------------------------------------------------------------------------
-- A (Einwilligung, Unverträglichkeit): Gesundheitsbezug in sicherer Richtung, Plan der Woche verknüpft
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is_empty($$ select 1 from public.shopping_lists $$, 'A sieht die Liste von B nicht');
select lives_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(pg_temp.entry('manual|a', p_label => 'Eigenes')),
       '[{"recipe_id": "muesli", "servings": 1, "diet": null}]')) $$,
  'A speichert eine Liste mit zusätzlichem Rezept'
);
select is((select uses_health_data from public.shopping_lists), true,
  'zusätzliche Rezepte mit Unverträglichkeiten gefiltert → Gesundheitsbezug (K10)');
reset role;
insert into public.nutrition_prefs (user_id, diet_type) values ('11111111-1111-4111-8111-111111111111', 'vegan');
insert into public.recipe_ingredients values ('muesli', 0, 'hafer', 50, 'g', false, true, null);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(jsonb_build_object('week_start', '2026-10-12', 'engine_version', 1, 'variant', 0,
       'meal_prep_plan_id', null, 'inputs', jsonb_build_object('diet', 'vegan', 'meals_per_day', 3,
       'cooking_mode', 'daily', 'mealprep_days', null, 'mealprep_slots', 'lunch'),
       'items', jsonb_build_array(jsonb_build_object('date', '2026-10-14', 'slot', 'breakfast', 'role', null,
         'recipe_id', 'muesli', 'recipe_version', 1, 'title_de', 'Müsli', 'factor', 1.2, 'kcal', 300, 'protein_g', 10,
         'carbs_g', 50, 'fat_g', 5, 'substitutions', '[]'::jsonb, 'omitted_optional', '[]'::jsonb,
         'ingredient_swaps', '[]'::jsonb, 'is_fill', false, 'prep_kind', 'fresh', 'cook_date', '2026-10-14',
         'storage', null, 'meal_prep_plan_id', null, 'day_status', 'complete')))) $$,
  'A speichert den Plan der Woche'
);
select is(
  (select l.meal_plan_id from public.shopping_lists l), (select p.id from public.meal_plans p),
  'die Liste zeigt auf den neuen Plan der Woche'
);
select lives_ok(
  $$ select public.replace_shopping_list(pg_temp.list(jsonb_build_array(pg_temp.entry('hafer|g', 'hafer'),
       pg_temp.entry('manual|a', p_label => 'Eigenes')))) $$,
  'A ersetzt die Liste ohne zusätzliche Rezepte'
);
select is((select uses_health_data from public.shopping_lists), true,
  'Plan der Woche mit Gesundheitsbezug → Liste mit Gesundheitsbezug');

-- „mag ich nicht“ je Lebensmittel ersetzen.
select lives_ok($$ select public.replace_food_dislikes('["tofu", "hafer"]') $$, 'A lehnt zwei Lebensmittel ab');
select lives_ok($$ select public.replace_food_dislikes('["tofu"]') $$, 'A ersetzt die Liste');
select results_eq($$ select food_id from public.food_dislikes $$, $$ values ('tofu') $$, 'A: nur noch Tofu');
select throws_ok($$ select public.replace_food_dislikes('["tofu", "tofu"]') $$, '22023', 'Lebensmittel doppelt.',
  'keine Doppelten');
select throws_ok($$ select public.replace_food_dislikes('["gibt-es-nicht"]') $$, '23503',
  'Unbekanntes Lebensmittel oder zu viele Einträge.', 'unbekanntes Lebensmittel – Fehler ohne Werte');
select throws_ok($$ select public.replace_food_dislikes('{"tofu": true}') $$, '22023', 'Ungültige Liste.',
  'nur eine Liste von IDs');

-- Export enthält die Ernährungs-Tabellen mit den eigenen Zeilen.
select results_eq(
  $$ select jsonb_array_length(d -> 'meal_plans'), jsonb_array_length(d -> 'meal_plan_items'),
            jsonb_array_length(d -> 'shopping_lists'), jsonb_array_length(d -> 'shopping_list_items'),
            jsonb_array_length(d -> 'recipe_ratings'), jsonb_array_length(d -> 'food_dislikes'),
            d -> 'nutrition_prefs' -> 0 ? 'show_energy_numbers'
     from (select public.export_my_data() -> 'data' as d) as e $$,
  $$ values (1, 1, 1, 2, 0, 1, true) $$,
  'Export: Ernährungs-Tabellen und neue nutrition_prefs-Spalten (Art. 15)'
);

-- Widerruf: Liste mit Gesundheitsbezug samt eigener Einträge gelöscht (K10); B unberührt.
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.shopping_lists where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.shopping_list_items where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.shopping_lists where user_id = '22222222-2222-4222-8222-222222222222') $$,
  $$ values (0, 0, 1) $$,
  'Widerruf: Liste von A samt eigener Einträge gelöscht, Liste von B bleibt'
);

select * from finish();
rollback;
