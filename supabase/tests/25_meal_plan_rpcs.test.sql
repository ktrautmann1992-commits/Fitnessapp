-- Phase 5 · N7: save_meal_plan (docs/PLAN-PHASE-5.md 7.3, 7.4, 19.7 N9/N10), delete_stored_intolerances und Widerruf:
-- Login/Profil/Ernährungsangaben, nur bekannte Felder, Datumsrahmen, freigegebene Rezepte in passender Version,
-- Weglassen nur optionaler Zutaten (S3), Ersatz nur aus der Ersatzliste (S4), Tausch nur aus der Austausch-Tabelle (S7),
-- erneute Prüfung von Ernährungsform/Schwein/Unverträglichkeit/„mag ich nicht“ (Gruppe und Lebensmittel)/Alkohol,
-- Faktor ≠ 1 bzw. Gesundheitsbezug ohne Einwilligung abgelehnt (S9), uses_health_data setzt der Server, ein Plan je
-- Woche, Fehler ohne Werte, Widerruf und „Unverträglichkeiten löschen“ löschen Pläne mit Gesundheitsbezug.
-- „Heute“ = Mittwoch, 14.10.2026 (Woche ab Montag 12.10.; Montag/Dienstag sind vergangen).
begin;
create extension if not exists pgtap with schema extensions;
select plan(73);

create or replace function private.berlin_today()
returns date
language sql
stable
set search_path = ''
as $$
  select date '2026-10-14'
$$;

-- A: Einwilligung, Körperdaten, Mischkost ohne Schwein. B: OHNE Einwilligung health_data, vegan.
-- C: ohne Profil. D: Einwilligung, vegetarisch, Unverträglichkeit Erdnuss, mag keine Pilze, mag keinen Tofu.
insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'nutzer-b@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'ohne-profil@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'nutzer-d@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'nutzer-e@example.test');
insert into public.profiles (user_id, birth_date) values
  ('11111111-1111-4111-8111-111111111111', '1990-01-01'),
  ('22222222-2222-4222-8222-222222222222', '1990-01-01'),
  ('44444444-4444-4444-8444-444444444444', '1990-01-01'),
  ('55555555-5555-4555-8555-555555555555', '1990-01-01');
insert into public.consents (user_id, consent_type, version, platform)
select u, t, 1, 'web'
from unnest(array['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555']::uuid[]) as u
cross join unnest(array['terms', 'privacy', 'health_data']::public.consent_type[]) as t;
insert into public.consents (user_id, consent_type, version, platform)
select '22222222-2222-4222-8222-222222222222', t, 1, 'web'
from unnest(array['terms', 'privacy']::public.consent_type[]) as t;
insert into public.body_metrics (user_id, weight_kg) values ('11111111-1111-4111-8111-111111111111', 75);
insert into public.nutrition_prefs (user_id, diet_type, eats_pork) values
  ('11111111-1111-4111-8111-111111111111', 'omnivore', false),
  ('22222222-2222-4222-8222-222222222222', 'vegan', null),
  ('44444444-4444-4444-8444-444444444444', 'vegetarian', null),
  ('55555555-5555-4555-8555-555555555555', 'vegetarian', null);
insert into public.food_preferences (user_id, food_group, kind) values
  ('44444444-4444-4444-8444-444444444444', 'peanuts', 'intolerance'),
  ('44444444-4444-4444-8444-444444444444', 'mushrooms', 'dislike'),
  ('55555555-5555-4555-8555-555555555555', 'lactose', 'intolerance');

-- Inhalte (als Eigentümer; das Einspielen testet 23_nutrition_content.test.sql).
insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind,
  pregnancy_caution, alcohol, max_fridge_days, freezable, data)
values
  ('hafer', 1, 'published', 'Hafer', 'other', false, '{gluten}', '{}', '{}', false, false, 2, true, '{}'),
  ('milch', 1, 'published', 'Milch', 'other', false, '{dairy,lactose}', '{dairy}', '{}', false, false, 2, false,
   '{"substitutes": [{"food_id": "haferdrink", "for_groups": ["dairy", "lactose"]}]}'),
  ('haferdrink', 1, 'published', 'Haferdrink', 'other', false, '{gluten}', '{}', '{}', false, false, 2, false, '{}'),
  ('erdnuss', 1, 'published', 'Erdnuss', 'other', false, '{peanuts}', '{}', '{}', false, false, 2, true, '{}'),
  ('speck', 1, 'published', 'Speck', 'other', false, '{}', '{meat}', '{pork}', false, false, 2, true, '{}'),
  ('haehnchen', 1, 'published', 'Hähnchen', 'other', false, '{poultry}', '{meat}', '{poultry}', false, false, 1, true, '{}'),
  ('tofu', 1, 'published', 'Tofu', 'other', false, '{soy}', '{}', '{}', false, false, 2, true, '{}'),
  ('champignon', 1, 'published', 'Champignon', 'other', false, '{mushrooms}', '{}', '{}', false, false, 2, true, '{}'),
  ('wein', 1, 'published', 'Wein', 'other', false, '{sulphites}', '{}', '{}', false, true, 2, false, '{}'),
  ('alt-lm', 1, 'archived', 'Altes Lebensmittel', 'other', false, '{}', '{}', '{}', false, false, 2, false, '{}');
insert into public.recipes (id, version, status, title_de, meal_types, servings, no_cook, diet, contains_pork, data)
values
  ('porridge', 1, 'published', 'Porridge', '{breakfast}', 1, false, 'vegetarian', false, '{}'),
  ('speck-ei', 1, 'published', 'Speck', '{breakfast}', 1, false, 'omnivore', true, '{}'),
  ('haehnchen-pfanne', 1, 'published', 'Hähnchen-Pfanne', '{main}', 1, false, 'omnivore', false, '{}'),
  ('tofu-bowl', 1, 'published', 'Tofu-Bowl', '{main}', 1, false, 'vegan', false, '{}'),
  ('weinsosse', 1, 'published', 'Weinsoße', '{main}', 1, false, 'vegan', false, '{}'),
  ('muesli', 2, 'published', 'Müsli', '{breakfast}', 1, true, 'vegan', false, '{}'),
  ('alt-rezept', 1, 'archived', 'Altes Rezept', '{main}', 1, false, 'vegan', false, '{}'),
  ('mit-altem-lm', 1, 'published', 'Mit altem Lebensmittel', '{main}', 1, false, 'vegan', false, '{}'),
  ('milchreis', 1, 'published', 'Milchreis mit Soße', '{main}', 1, false, 'vegetarian', false, '{}');
insert into public.recipe_ingredients (recipe_id, position, food_id, amount, unit, optional, scales) values
  ('porridge', 0, 'hafer', 50, 'g', false, true),
  ('porridge', 1, 'milch', 200, 'ml', false, true),
  ('porridge', 2, 'erdnuss', 10, 'g', true, true),
  ('speck-ei', 0, 'speck', 30, 'g', false, true),
  ('haehnchen-pfanne', 0, 'haehnchen', 150, 'g', false, true),
  ('haehnchen-pfanne', 1, 'champignon', 50, 'g', true, true),
  ('tofu-bowl', 0, 'tofu', 150, 'g', false, true),
  ('tofu-bowl', 1, 'champignon', 50, 'g', false, true),
  ('weinsosse', 0, 'hafer', 20, 'g', false, true),
  ('weinsosse', 1, 'wein', 50, 'ml', false, true),
  ('muesli', 0, 'hafer', 60, 'g', false, true),
  ('alt-rezept', 0, 'hafer', 60, 'g', false, true),
  ('mit-altem-lm', 0, 'alt-lm', 60, 'g', false, true),
  -- Wächter N7 S3: dieselbe Zutat zweimal – Milch Pflicht (Index 0) und Milch optional (Index 2).
  ('milchreis', 0, 'milch', 200, 'ml', false, true),
  ('milchreis', 1, 'hafer', 60, 'g', false, true),
  ('milchreis', 2, 'milch', 50, 'ml', true, true);
insert into public.ingredient_substitutions (id, version, status, food_id, substitute_food_id, factor, role, data)
values ('tausch-haehnchen-zu-tofu', 1, 'published', 'haehnchen', 'tofu', 1, 'protein', '{}');
insert into public.meal_prep_plans (id, version, status, title_de, recipe_ids, data)
values ('mp-test', 1, 'published', 'Meal-Prep-Test', '{porridge}', '{}');
insert into public.food_dislikes (user_id, food_id) values ('44444444-4444-4444-8444-444444444444', 'tofu');

-- Eingabe wie toMealPlanPayload() (packages/core/src/nutrition/meal-plan-payload.ts).
create function pg_temp.item(
  p_date text, p_recipe text, p_slot text default 'breakfast', p_factor numeric default 1,
  p_status text default 'complete', p_subs jsonb default '[]', p_omitted jsonb default '[]',
  p_swaps jsonb default '[]', p_version integer default 1, p_cook text default null, p_prep_plan text default null
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'date', p_date, 'slot', p_slot, 'role', null, 'recipe_id', p_recipe, 'recipe_version', p_version,
    'title_de', 'Gericht', 'factor', p_factor, 'kcal', 400.5, 'protein_g', 20, 'carbs_g', 50, 'fat_g', 10,
    'substitutions', p_subs, 'omitted_optional', p_omitted, 'ingredient_swaps', p_swaps, 'is_fill', false,
    'prep_kind', 'fresh', 'cook_date', coalesce(p_cook, p_date), 'storage', null, 'meal_prep_plan_id', p_prep_plan,
    'day_status', p_status
  )
$$;
create function pg_temp.plan(p_items jsonb, p_week text default '2026-10-12', p_prep_plan text default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'week_start', p_week, 'engine_version', 1, 'variant', 0, 'meal_prep_plan_id', p_prep_plan,
    'inputs', jsonb_build_object('diet', 'omnivore', 'meals_per_day', 3, 'cooking_mode', 'daily',
      'mealprep_days', null, 'mealprep_slots', 'lunch'),
    'items', p_items
  )
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Rechte
-- ---------------------------------------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.save_meal_plan(jsonb, boolean, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.delete_stored_intolerances()', 'execute')
  and (select prosecdef from pg_proc where oid = 'public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure)
  and (select proconfig from pg_proc where oid = 'public.save_meal_plan(jsonb, boolean, boolean)'::regprocedure)
    = array['search_path=""'],
  'save_meal_plan: security definer mit leerem search_path, nur authenticated'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge')))) $$,
  '42501', 'Nicht angemeldet.', 'ohne Login abgelehnt'
);
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge')))) $$,
  '42501', 'Profil fehlt.', 'ohne Profil abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- A: gültiger Plan mit Faktor ≠ 1 (Einwilligung vorhanden)
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 'porridge', p_factor => 1.25, p_omitted => '[{"index": 2, "food_id": "erdnuss"}]'),
       pg_temp.item('2026-10-14', 'haehnchen-pfanne', 'lunch'),
       pg_temp.item('2026-10-15', 'haehnchen-pfanne', 'lunch', p_swaps => '[{"index": 0, "food_id": "haehnchen", "substitute_food_id": "tofu"}]'),
       pg_temp.item('2026-10-12', 'alt-rezept', 'lunch')
     )), true) $$,
  'A speichert einen Plan (vergangener Tag mit archiviertem Rezept bleibt erlaubt)'
);
select results_eq(
  $$ select week_start, uses_health_data, auto_adjusted, recipes_changed, status from public.meal_plans $$,
  $$ values (date '2026-10-12', true, true, false, 'active') $$,
  'A: Plan gespeichert, uses_health_data vom Server, Merker übernommen'
);
select results_eq(
  $$ select date, slot, factor, omitted_optional, ingredient_swaps from public.meal_plan_items order by date, slot $$,
  $$ values (date '2026-10-12', 'lunch', 1::numeric, '[]'::jsonb, '[]'::jsonb),
            (date '2026-10-14', 'breakfast', 1.25, '[{"index": 2, "food_id": "erdnuss"}]'::jsonb, '[]'::jsonb),
            (date '2026-10-14', 'lunch', 1, '[]'::jsonb, '[]'::jsonb),
            (date '2026-10-15', 'lunch', 1, '[]'::jsonb,
             '[{"index": 0, "food_id": "haehnchen", "substitute_food_id": "tofu"}]'::jsonb) $$,
  'A: Mahlzeiten als Schnappschuss (Änderungen je Zutat-Index, S3)'
);
select is(
  (select inputs from public.meal_plans),
  '{"diet": "omnivore", "meals_per_day": 3, "cooking_mode": "daily", "mealprep_days": null, "mealprep_slots": "lunch"}'::jsonb,
  'A: Angaben ohne Gesundheitsdaten (K8)'
);
-- Ersetzen: weiterhin genau ein Plan je Woche.
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-16', 'muesli', p_version => 2)))) $$,
  'A ersetzt den Plan der Woche'
);
select results_eq(
  $$ select (select count(*)::int from public.meal_plans), (select count(*)::int from public.meal_plan_items),
            (select bool_and(not auto_adjusted) from public.meal_plans) $$,
  $$ values (1, 1, true) $$, 'A: ein Plan je Woche, alte Mahlzeiten ersetzt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-19', 'muesli', p_version => 2)),
       '2026-10-19')) $$,
  'A speichert die nächste Woche'
);
select is((select count(*)::int from public.meal_plans), 2, 'A: laufende und nächste Woche');

-- Kochtag-Start bleibt nur beim selben Meal-Prep-Plan.
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-15', 'porridge', 'lunch', p_omitted => '[{"index": 2, "food_id": "erdnuss"}]', p_cook => '2026-10-11',
         p_prep_plan => 'mp-test')), p_prep_plan => 'mp-test')) $$,
  'A wählt einen Meal-Prep-Plan (Kochtag Sonntag davor)'
);
update public.meal_plans set cook_day_started_at = '2026-10-11 09:00+02' where week_start = '2026-10-12';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-16', 'porridge', 'lunch', p_omitted => '[{"index": 2, "food_id": "erdnuss"}]', p_cook => '2026-10-11',
         p_prep_plan => 'mp-test')), p_prep_plan => 'mp-test')) $$,
  'A ersetzt den Plan mit demselben Meal-Prep-Plan'
);
select isnt((select cook_day_started_at from public.meal_plans where week_start = '2026-10-12'), null,
  'Kochtag-Start bleibt beim selben Meal-Prep-Plan');
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-16', 'muesli', p_version => 2)))) $$,
  'A ersetzt den Plan ohne Meal-Prep-Plan'
);
select is((select cook_day_started_at from public.meal_plans where week_start = '2026-10-12'), null,
  'Kochtag-Start entfällt ohne Meal-Prep-Plan');

-- ---------------------------------------------------------------------------------------------------------
-- Form und Datumsrahmen
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan('[]') || '{"uses_health_data": false}') $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Essensplan).', 'uses_health_data kommt nie vom Client'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'muesli', p_version => 2)
       || '{"shared": true}'))) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Mahlzeit).', 'geteilte Mahlzeit bis P1 nicht speicherbar (N13)'
);
select throws_ok(
  $$ select public.save_meal_plan(jsonb_set(pg_temp.plan('[]'), '{inputs,intolerances}', '["peanuts"]')) $$,
  '22023', 'Unbekanntes Feld in der Eingabe (Angaben).', 'Unverträglichkeiten nie in den Angaben (K8)'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'muesli', p_version => 2)
       - 'day_status'))) $$,
  '22023', 'Ungültige Mahlzeit.', 'fehlendes Feld abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(jsonb_set(pg_temp.plan('[]'), '{engine_version}', '2')) $$,
  '22023', 'Ungültiger Essensplan.', 'unbekannte Engine-Version abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan('[]', '2026-10-26')) $$,
  '22023', 'Woche außerhalb des Rahmens.', 'übernächste Woche abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan('[]', '2026-10-05')) $$,
  '22023', 'Woche außerhalb des Rahmens.', 'vergangene Woche abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan('[]', '2026-10-13')) $$,
  '22023', 'Woche außerhalb des Rahmens.', 'Woche beginnt am Montag'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-19', 'muesli', p_version => 2)))) $$,
  '22023', 'Datum passt nicht zur Woche.', 'Mahlzeit außerhalb der Woche abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 'muesli', p_version => 2, p_cook => '2026-10-10')))) $$,
  '22023', 'Datum passt nicht zur Woche.', 'Kochtag vor dem Sonntag der Woche abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan((select jsonb_agg(pg_temp.item('2026-10-14', 'muesli',
       'breakfast', p_version => 2)) from generate_series(1, 71)))) $$,
  '22023', 'Zu viele Mahlzeiten.', 'höchstens 70 Mahlzeiten'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 'muesli', p_version => 2), pg_temp.item('2026-10-14', 'muesli', p_version => 2)))) $$,
  '23505', 'Ungültige Werte im Essensplan.', 'Platz doppelt belegt – Fehler ohne Werte'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'muesli', p_factor => 2.5,
       p_version => 2)))) $$,
  '23514', 'Ungültige Werte im Essensplan.', 'Faktor über 2 – Fehler ohne Werte'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(jsonb_set(pg_temp.item('2026-10-14', 'muesli',
       p_version => 2), '{date}', '"14.10.2026"')))) $$,
  '22008', 'Ungültige Werte im Essensplan.', 'ungültiges Datum – Fehler ohne Werte'
);
select is(
  (select count(*)::int from public.meal_plans where week_start = '2026-10-12'), 1,
  'abgelehnte Aufrufe ändern nichts (eine Transaktion)'
);

-- ---------------------------------------------------------------------------------------------------------
-- Rezepte und Zutaten-Änderungen
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'alt-rezept', 'lunch')))) $$,
  '22023', 'Rezept nicht freigegeben oder veraltet.', 'ab heute nur freigegebene Rezepte'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'muesli')))) $$,
  '22023', 'Rezept nicht freigegeben oder veraltet.', 'ab heute nur die aktuelle Rezept-Version'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-12', 'muesli', p_version => 3)))) $$,
  '22023', 'Rezept nicht freigegeben oder veraltet.', 'vergangene Tage: Version höchstens die aktuelle'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'gibt-es-nicht')))) $$,
  '22023', 'Rezept nicht freigegeben oder veraltet.', 'unbekanntes Rezept abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_omitted => '[{"index": 1, "food_id": "milch"}]')))) $$,
  '22023', 'Nur optionale Zutaten können weggelassen werden.', 'S3: nicht optionale Zutat nicht weglassbar'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_omitted => '[{"index": 2, "food_id": "erdnuss"}]', p_subs => '[{"index": 1, "food_id": "milch", "substitute_food_id": "tofu"}]')))) $$,
  '22023', 'Ersatzprodukt nicht erlaubt.', 'S4: Ersatz nur aus der Ersatzliste des Lebensmittels'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_omitted => '[{"index": 2, "food_id": "erdnuss"}]', p_swaps => '[{"index": 1, "food_id": "milch", "substitute_food_id": "haferdrink"}]')))) $$,
  '22023', 'Zutaten-Tausch nicht erlaubt.', 'S7: Tausch nur aus der freigegebenen Austausch-Tabelle'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_omitted => '[{"index": 2, "food_id": "erdnuss"}]', p_subs => '[{"index": 2, "food_id": "erdnuss", "substitute_food_id": "haferdrink"}]')))) $$,
  '22023', null, 'Ersatz einer nicht passenden Zutat bzw. doppelte Änderung abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'speck-ei')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.', 'Schwein ohne eats_pork abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'weinsosse', 'lunch')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.', 'Alkohol abgelehnt (R12)'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'mit-altem-lm', 'lunch')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.',
  'zurückgezogenes Lebensmittel ab heute abgelehnt'
);

-- ---------------------------------------------------------------------------------------------------------
-- B: ohne Einwilligung health_data, vegan
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_status => 'no_targets', p_omitted => '[{"index": 2, "food_id": "erdnuss"}]')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.', 'vegan: Milch abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge',
       p_status => 'no_targets', p_omitted => '[{"index": 2, "food_id": "erdnuss"}]',
       p_subs => '[{"index": 1, "food_id": "milch", "substitute_food_id": "haferdrink"}]')))) $$,
  'vegan mit Ersatzprodukt (S4) und weggelassener Zutat (S3), ohne Ziele: gespeichert'
);
select is(
  (select uses_health_data from public.meal_plans), false,
  'ohne Einwilligung: Ersatz aus Abneigung/Ernährungsform ist kein Gesundheitsbezug'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'tofu-bowl', 'lunch',
       p_factor => 1.1, p_status => 'no_targets')))) $$,
  '42501', 'Für diesen Essensplan fehlt die Einwilligung.', 'S9: Faktor ≠ 1 ohne Einwilligung abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'tofu-bowl', 'lunch')))) $$,
  '42501', 'Für diesen Essensplan fehlt die Einwilligung.', 'Ziele (Status complete) ohne Einwilligung abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'haehnchen-pfanne', 'lunch',
       p_status => 'no_targets', p_omitted => '[{"index": 1, "food_id": "champignon"}]',
       p_swaps => '[{"index": 0, "food_id": "haehnchen", "substitute_food_id": "tofu"}]')))) $$,
  '42501', 'Für diesen Essensplan fehlt die Einwilligung.', 'N9: Tausch ohne Einwilligung abgelehnt (Gesundheitsbezug)'
);
select is((select count(*)::int from public.meal_plans), 1, 'B sieht nur den eigenen Plan');

-- ---------------------------------------------------------------------------------------------------------
-- D: vegetarisch, Unverträglichkeit Erdnuss, mag keine Pilze, mag keinen Tofu
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'porridge')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.',
  'Unverträglichkeit: optionale Erdnuss ohne Weglassen abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'haehnchen-pfanne', 'lunch',
       p_omitted => '[{"index": 1, "food_id": "champignon"}]')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.', 'vegetarisch: Hähnchen abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'haehnchen-pfanne', 'lunch',
       p_swaps => '[{"index": 0, "food_id": "haehnchen", "substitute_food_id": "tofu"}]', p_omitted => '[{"index": 1, "food_id": "champignon"}]')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.',
  'Tausch auf ein Lebensmittel mit „mag ich nicht“ abgelehnt (N10)'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'tofu-bowl', 'lunch')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.',
  '„mag ich nicht“ (Gruppe Pilze und Lebensmittel Tofu) abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(
       pg_temp.item('2026-10-14', 'porridge', p_omitted => '[{"index": 2, "food_id": "erdnuss"}]'),
       pg_temp.item('2026-10-13', 'tofu-bowl', 'lunch')))) $$,
  'D: Erdnuss weggelassen; vergangener Tag wird nicht erneut gefiltert'
);
select is((select uses_health_data from public.meal_plans), true, 'D: Unverträglichkeit → uses_health_data');

-- ---------------------------------------------------------------------------------------------------------
-- E: Laktose-Unverträglichkeit, Rezept mit Milch zweimal (Wächter N7 S3: Änderungen je Zutat-Index)
-- ---------------------------------------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}';
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"index": 0, "food_id": "milch", "substitute_food_id": "haferdrink"}]',
       p_omitted => '[{"index": 2, "food_id": "milch"}]')))) $$,
  'S3: Milch an Index 0 ersetzt, dieselbe Milch an Index 2 (optional) weggelassen → gespeichert'
);
select is(
  (select omitted_optional || substitutions from public.meal_plan_items i
   where i.user_id = '55555555-5555-4555-8555-555555555555'),
  '[{"index": 2, "food_id": "milch"}, {"index": 0, "food_id": "milch", "substitute_food_id": "haferdrink"}]'::jsonb,
  'S3: gespeichert je Index'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"index": 0, "food_id": "milch", "substitute_food_id": "haferdrink"}]')))) $$,
  '22023', 'Der Essensplan passt nicht zu deinen Angaben – bitte neu erstellen.',
  'S3: nur eine von zwei Milch-Stellen geändert → Laktose an Index 2 bleibt → abgelehnt'
);
select lives_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"index": 0, "food_id": "milch", "substitute_food_id": "haferdrink"},
                   {"index": 2, "food_id": "milch", "substitute_food_id": "haferdrink"}]')))) $$,
  'S3: dasselbe Ersatz-Paar an beiden Stellen (wie der Core es erzeugt) → gespeichert'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"index": 1, "food_id": "milch", "substitute_food_id": "haferdrink"}]',
       p_omitted => '[{"index": 2, "food_id": "milch"}]')))) $$,
  '22023', 'Zutat passt nicht zum Rezept.', 'S3: Index zeigt auf eine andere Zutat → abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_omitted => '[{"index": 0, "food_id": "milch"}, {"index": 2, "food_id": "milch"}]')))) $$,
  '22023', 'Nur optionale Zutaten können weggelassen werden.', 'S3: Pflicht-Milch (Index 0) nicht weglassbar'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"index": 2, "food_id": "milch", "substitute_food_id": "haferdrink"}]',
       p_omitted => '[{"index": 2, "food_id": "milch"}]')))) $$,
  '22023', 'Zutat mehrfach geändert.', 'S3: dieselbe Stelle ersetzt und weggelassen → abgelehnt'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_subs => '[{"food_id": "milch", "substitute_food_id": "haferdrink"}]')))) $$,
  '22023', 'Ungültiger Ersatz.', 'S3: Ersatz ohne Index abgelehnt'
);
-- Wächter N7 H1: Größen früh begrenzt.
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch',
       p_omitted => (select jsonb_agg(jsonb_build_object('index', 2, 'food_id', 'milch')) from generate_series(1, 21)))))) $$,
  '22023', 'Zu viele Zutaten-Änderungen.', 'H1: höchstens 20 Änderungen je Mahlzeit'
);
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-14', 'milchreis', 'lunch')
       || jsonb_build_object('title_de', repeat('x', 300000))))) $$,
  '22023', 'Essensplan zu groß.', 'H1: Essensplan über 256 KiB abgelehnt, bevor geprüft wird'
);

set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}';
-- „Gespeicherte Unverträglichkeiten löschen“ löscht im selben Schritt Pläne mit Gesundheitsbezug.
select lives_ok($$ select public.delete_stored_intolerances() $$, 'D löscht die Unverträglichkeiten');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.food_preferences where user_id = '44444444-4444-4444-8444-444444444444' and kind = 'intolerance'),
            (select count(*)::int from public.food_preferences where user_id = '44444444-4444-4444-8444-444444444444' and kind = 'dislike'),
            (select count(*)::int from public.meal_plans where user_id = '44444444-4444-4444-8444-444444444444') $$,
  $$ values (0, 1, 0) $$,
  'D: Unverträglichkeiten und Plan mit Gesundheitsbezug gelöscht, „mag ich nicht“ bleibt'
);

-- ---------------------------------------------------------------------------------------------------------
-- Widerruf health_data (7.4): A verliert Pläne mit Gesundheitsbezug; B (ohne Bezug) bleibt
-- ---------------------------------------------------------------------------------------------------------
insert into public.recipe_ratings (user_id, recipe_id, value, rated_on)
values ('11111111-1111-4111-8111-111111111111', 'porridge', 'up', '2026-10-14');
insert into public.food_dislikes (user_id, food_id) values ('11111111-1111-4111-8111-111111111111', 'wein');
select is(
  (select count(*)::int from public.meal_plans where user_id = '11111111-1111-4111-8111-111111111111' and uses_health_data),
  2, 'A: zwei Pläne mit Gesundheitsbezug vor dem Widerruf'
);
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select lives_ok($$ select public.revoke_health_data(false) $$, 'A widerruft health_data');
reset role;
select results_eq(
  $$ select (select count(*)::int from public.meal_plans where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.meal_plan_items where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.recipe_ratings where user_id = '11111111-1111-4111-8111-111111111111'),
            (select count(*)::int from public.food_dislikes where user_id = '11111111-1111-4111-8111-111111111111') $$,
  $$ values (0, 0, 1, 1) $$,
  'Widerruf: Pläne und Mahlzeiten mit Gesundheitsbezug gelöscht; Bewertung und Abneigung bleiben'
);
select is(
  (select count(*)::int from public.meal_plans where user_id = '22222222-2222-4222-8222-222222222222'), 1,
  'Widerruf von A berührt B nicht'
);
-- Nach dem Widerruf: Faktor ≠ 1 wieder abgelehnt.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan(jsonb_build_array(pg_temp.item('2026-10-16', 'muesli', p_factor => 1.2,
       p_version => 2, p_status => 'no_targets')))) $$,
  '42501', 'Für diesen Essensplan fehlt die Einwilligung.', 'nach dem Widerruf: Faktor ≠ 1 abgelehnt'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok(
  $$ select public.save_meal_plan(pg_temp.plan('[]')) $$, '42501', null, 'anon: save_meal_plan nicht aufrufbar'
);

select * from finish();
rollback;
