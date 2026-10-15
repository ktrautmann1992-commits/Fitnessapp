-- Phase 5 · N7: Ernährungs-Inhalte (docs/PLAN-PHASE-5.md 7.2, 19.4, 19.5): RLS (anon nichts, authenticated nur
-- „published“, niemand außer service_role schreibt), seed_nutrition_content (nur freigegeben UND fachlich geprüft,
-- Verweise nur ins eigene Paket, Versionen sinken nie, archivieren statt löschen, idempotent, Inhaltsdatei unverändert
-- in data – Wächter N2d K9) und abgeleitete Spalten (Ernährungsform, Allergene inkl. optionaler Zutaten, Schwein).
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'nutzer-a@example.test');

-- ---------------------------------------------------------------------------------------------------------
-- Bausteine im Format der Inhaltsdateien (packages/core/src/content)
-- ---------------------------------------------------------------------------------------------------------
create function pg_temp.meta(p_expert boolean default true)
returns jsonb language sql as $$
  select jsonb_build_object(
    'origin', 'manual', 'model', null, 'batch_id', null, 'created_on', '2026-10-01',
    'expert_reviewed', p_expert, 'reviewed_by', 'GF', 'reviewed_at', '2026-10-02',
    'review_note', 'Hinweis der Prüferin GF'
  )
$$;

create function pg_temp.food(
  p_id text, p_groups text[] default '{}', p_animal text[] default '{}', p_meat text[] default '{}',
  p_gelatin text default null, p_version integer default 1, p_catalog boolean default true,
  p_expert boolean default true, p_status text default 'published'
)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'version', p_version, 'status', p_status, 'name_de', 'Lebensmittel ' || p_id, 'aliases_de', '[]'::jsonb,
    'shopping_category', 'other', 'pantry', false,
    'nutrients_per_100g', jsonb_build_object('kcal', 100, 'protein_g', 1, 'carbs_g', 1, 'sugar_g', null, 'fat_g', 1,
      'sat_fat_g', null, 'fiber_g', null, 'salt_g', 0),
    'units', '{}'::jsonb, 'groups', to_jsonb(p_groups), 'animal', to_jsonb(p_animal), 'meat_kind', to_jsonb(p_meat),
    'gelatin_origin', p_gelatin, 'pregnancy_caution', false, 'alcohol', false, 'max_fridge_days', 2,
    'freezable', true, 'substitutes', '[]'::jsonb,
    'source', jsonb_build_object('db', 'bls', 'version', '4.0', 'ref', 'X1', 'name', 'Quelle', 'category', 'other',
      'license', 'CC BY 4.0', 'retrieved_at', '2026-10-01'),
    'meta', pg_temp.meta(p_expert) || jsonb_build_object(
      'catalog_reviewed_by', case when p_catalog then 'GF' end,
      'catalog_reviewed_at', case when p_catalog then '2026-10-02' end)
  )) || jsonb_build_object('meta', pg_temp.meta(p_expert) || jsonb_build_object(
      'catalog_reviewed_by', case when p_catalog then to_jsonb('GF'::text) else 'null'::jsonb end,
      'catalog_reviewed_at', case when p_catalog then to_jsonb('2026-10-02'::text) else 'null'::jsonb end))
$$;

create function pg_temp.recipe(
  p_id text, p_ingredients jsonb, p_version integer default 1, p_expert boolean default true
)
returns jsonb language sql as $$
  select jsonb_build_object(
    'id', p_id, 'version', p_version, 'status', 'published', 'title_de', 'Rezept ' || p_id,
    'description_de', 'Beschreibung mit genug Zeichen.', 'meal_types', '["main"]'::jsonb, 'training_tags', '[]'::jsonb,
    'servings', 2, 'ingredients', p_ingredients, 'steps_de', '["Alles gut verrühren."]'::jsonb,
    'categories', '["schnell"]'::jsonb, 'prep_minutes', 5, 'cook_minutes', 0, 'no_cook', true,
    'meal_prep', jsonb_build_object('suitable', false, 'fridge_days', 0, 'freezable', false),
    'equipment_de', '[]'::jsonb,
    'declared_per_serving', jsonb_build_object('kcal', 300, 'protein_g', 10, 'carbs_g', 40, 'fat_g', 8),
    'declared_diet', 'vegetarian', 'declared_allergens', '[]'::jsonb, 'contains_pork', false,
    'declared_pregnancy_caution', false,
    'meta', pg_temp.meta(p_expert) || jsonb_build_object(
      'import_assumptions', jsonb_build_array(jsonb_build_object('field', 'heated', 'ingredient_index', 0)),
      'import_assumptions_confirmed_by', 'GF')
  )
$$;

create function pg_temp.ing(p_food text, p_optional boolean default false)
returns jsonb language sql as $$
  select jsonb_build_object('food_id', p_food, 'amount', 50, 'unit', 'g', 'optional', p_optional, 'scales', true,
    'role', 'carb')
$$;

-- Vollständiges Paket: Hafer (Gluten), Milch (Milch/Laktose, vegetarisch), Erdnuss optional, Gelatine ohne Herkunft.
create function pg_temp.package(p_extra jsonb default '{}')
returns jsonb language sql as $$
  select jsonb_build_object(
    'foods', jsonb_build_array(
      pg_temp.food('hafer', '{gluten}'),
      pg_temp.food('milch', '{dairy,lactose}', '{dairy}'),
      pg_temp.food('erdnuss', '{peanuts}'),
      pg_temp.food('gelatine', '{}', '{gelatin}')
    ),
    'recipes', jsonb_build_array(
      pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('milch'),
        pg_temp.ing('erdnuss', true))),
      pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine')))
    ),
    'ingredient_substitutions', jsonb_build_array(jsonb_build_object(
      'id', 'tausch-milch-zu-hafer', 'version', 1, 'status', 'published', 'food_id', 'milch',
      'substitute_food_id', 'hafer', 'factor', 1, 'role', 'carb', 'note_de', 'Hinweis zum Tausch.',
      'meta', pg_temp.meta())),
    'package_sizes', jsonb_build_array(jsonb_build_object(
      'id', 'packung-hafer', 'version', 1, 'status', 'published', 'food_id', 'hafer', 'package_size_g', 500,
      'meta', pg_temp.meta(false))),
    'meal_prep_plans', jsonb_build_array(jsonb_build_object(
      'id', 'mp-woche', 'version', 1, 'status', 'published', 'title_de', 'Meal-Prep-Woche',
      'recipe_ids', '["porridge"]'::jsonb, 'meta', pg_temp.meta())),
    'guides', jsonb_build_array(jsonb_build_object(
      'id', 'ratgeber-test', 'version', 1, 'status', 'published', 'title_de', 'Ratgeber', 'meta', pg_temp.meta()))
  ) || p_extra
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur, Rechte, RLS
-- ---------------------------------------------------------------------------------------------------------
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.foods'::regclass, 'public.recipes'::regclass, 'public.recipe_ingredients'::regclass,
     'public.ingredient_substitutions'::regclass, 'public.food_package_sizes'::regclass,
     'public.meal_prep_plans'::regclass, 'public.guides'::regclass)),
  'RLS auf allen sieben Inhaltstabellen'
);
select ok(
  not has_function_privilege('authenticated', 'public.seed_nutrition_content(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.seed_nutrition_content(jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.seed_nutrition_content(jsonb)', 'execute'),
  'seed_nutrition_content nur für service_role'
);
select ok(
  not has_table_privilege('authenticated', 'public.foods', 'insert')
  and not has_table_privilege('authenticated', 'public.recipes', 'update')
  and not has_table_privilege('authenticated', 'public.recipe_ingredients', 'delete')
  and not has_table_privilege('anon', 'public.foods', 'select')
  and not has_table_privilege('anon', 'public.guides', 'select'),
  'authenticated schreibt nichts, anon liest nichts'
);

-- ---------------------------------------------------------------------------------------------------------
-- Einspielen (service_role)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select is(
  public.seed_nutrition_content(pg_temp.package()) - 'archived',
  '{"foods": 4, "recipes": 2, "ingredient_substitutions": 1, "package_sizes": 1, "meal_prep_plans": 1, "guides": 1}'::jsonb,
  'Paket eingespielt: Anzahl je Art'
);
select is(
  (select data - 'meta' from public.recipes where id = 'porridge'),
  (pg_temp.package() -> 'recipes' -> 0) - 'meta',
  'K9: Rezept-Datei unverändert in data (außer Prüfer-Namen)'
);
select is(
  (select data -> 'meta' -> 'import_assumptions' from public.recipes where id = 'porridge'),
  jsonb_build_array(jsonb_build_object('field', 'heated', 'ingredient_index', 0)),
  'K9: Import-Annahmen vor und nach dem Seed gleich'
);
select is((select data - 'meta' from public.foods where id = 'milch'),
  pg_temp.food('milch', '{dairy,lactose}', '{dairy}') - 'meta',
  'Lebensmittel-Datei unverändert in data (außer Prüfer-Namen)');
-- Wächter N7 H8: keine Namen bzw. Kürzel der Prüfenden in den für Nutzer lesbaren Dateien.
select results_eq(
  $$ select data -> 'meta' ->> 'reviewed_by', data -> 'meta' ->> 'import_assumptions_confirmed_by',
            data -> 'meta' -> 'review_note', data -> 'meta' ->> 'expert_reviewed', data -> 'meta' ->> 'reviewed_at'
     from public.recipes where id = 'porridge' $$,
  $$ values ('redaktion', 'redaktion', 'null'::jsonb, 'true', '2026-10-02') $$,
  'H8: Prüfer-Namen ersetzt, Prüfvermerk und Datum bleiben'
);
select is_empty(
  $$ select id from (
       select id, data from public.foods union all select id, data from public.recipes
       union all select id, data from public.ingredient_substitutions union all select id, data from public.food_package_sizes
       union all select id, data from public.meal_prep_plans union all select id, data from public.guides
     ) as d where data::text like '%"GF"%' or data::text like '%Hinweis der Prüferin%' $$,
  'H8: nirgends der Name „GF“ oder die Prüfnotiz in data'
);
select is((select data -> 'meta' ->> 'catalog_reviewed_by' from public.foods where id = 'milch'), 'redaktion',
  'H8: Katalog-Prüfer ersetzt');
select results_eq(
  $$ select diet::text, allergens, contains_pork from public.recipes order by id $$,
  $$ values ('vegetarian', '{dairy,gluten,lactose,peanuts}'::text[], false),
            ('omnivore', '{}'::text[], true) $$,
  'abgeleitet: Ernährungsform, Allergene inkl. optionaler Zutat (S3), Gelatine ohne Herkunft = Schwein (S5)'
);
select results_eq(
  $$ select position::int, food_id, optional from public.recipe_ingredients where recipe_id = 'porridge' order by position $$,
  $$ values (0, 'hafer', false), (1, 'milch', false), (2, 'erdnuss', true) $$,
  'Zutaten mit Index wie in der App (0-basiert)'
);
select is((select package_size_g from public.food_package_sizes where food_id = 'hafer'), 500, 'Packungsgröße');
select is((select recipe_ids from public.meal_prep_plans where id = 'mp-woche'), '{porridge}'::text[], 'Meal-Prep-Plan');
select results_eq(
  $$ select food_id, substitute_food_id, factor, role from public.ingredient_substitutions $$,
  $$ values ('milch', 'hafer', 1::numeric, 'carb') $$,
  'Austausch-Eintrag mit abgeleiteten Spalten'
);
-- Idempotent: zweimal dasselbe ändert nichts.
create temporary table seed_stand on commit drop as
  select id, updated_at, data from public.recipes union all select id, updated_at, data from public.foods;
select is(
  public.seed_nutrition_content(pg_temp.package()) -> 'archived',
  '{"foods": 0, "recipes": 0, "guides": 0, "package_sizes": 0, "meal_prep_plans": 0, "ingredient_substitutions": 0}'::jsonb,
  'zweiter Lauf: nichts archiviert'
);
select is_empty(
  $$ select id, updated_at, data from public.recipes union all select id, updated_at, data from public.foods
     except select * from seed_stand $$,
  'zweiter Lauf: keine Zeile verändert (idempotent)'
);

-- Abgelehnte Pakete (je eine Regel); nichts wird eingespielt (eine Transaktion).
select throws_ok(
  $$ select public.seed_nutrition_content('{"foods": []}') $$, '22023', null, 'unvollständiges Paket abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package('{"rezepte": []}')) $$, '22023', 'Unbekannte Inhaltsart.',
  'unbekannte Inhaltsart abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('guides',
       jsonb_build_array(jsonb_set(pg_temp.package() -> 'guides' -> 0, '{status}', '"draft"'))))) $$,
  '22023', 'Nur freigegebene Inhalte dürfen eingespielt werden: ratgeber-test', 'Entwurf abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('foods', jsonb_build_array(
       pg_temp.food('hafer', '{gluten}', p_expert => false), pg_temp.food('milch', '{dairy,lactose}', '{dairy}'),
       pg_temp.food('erdnuss', '{peanuts}'), pg_temp.food('gelatine', '{}', '{gelatin}'))))) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.',
  'Gründer-Entscheidung 6: Lebensmittel ohne Fachprüfung abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('foods', jsonb_build_array(
       pg_temp.food('hafer', '{gluten}', p_catalog => false), pg_temp.food('milch', '{dairy,lactose}', '{dairy}'),
       pg_temp.food('erdnuss', '{peanuts}'), pg_temp.food('gelatine', '{}', '{gelatin}'))))) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.',
  'R19: Lebensmittel ohne Katalog-Prüfung abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer')), p_expert => false))))) $$,
  '23514', 'Inhalt porridge ist nicht fachlich geprüft.', 'Rezept ohne Fachprüfung abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('package_sizes', jsonb_build_array(
       jsonb_set(pg_temp.package() -> 'package_sizes' -> 0, '{meta,reviewed_by}', 'null'))))) $$,
  '23514', 'Packungsgröße packung-hafer ohne Prüfvermerk.', 'Packungsgröße ohne Prüfvermerk abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('unbekannt'))),
       pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine'))))))) $$,
  '23503', 'Rezept porridge verwendet ein nicht freigegebenes Lebensmittel.', 'Zutat außerhalb des Pakets abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('ingredient_substitutions',
       jsonb_build_array(jsonb_set(pg_temp.package() -> 'ingredient_substitutions' -> 0, '{substitute_food_id}',
       '"tofu"'))))) $$,
  '23503', 'Austausch tausch-milch-zu-hafer verweist auf ein nicht freigegebenes Lebensmittel.',
  'Austausch auf unbekanntes Lebensmittel abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('meal_prep_plans', jsonb_build_array(
       jsonb_set(pg_temp.package() -> 'meal_prep_plans' -> 0, '{recipe_ids}', '["porridge", "fehlt"]'))))) $$,
  '23503', 'Meal-Prep-Plan mp-woche enthält ein nicht freigegebenes Rezept.', 'Meal-Prep-Plan mit fremdem Rezept abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'))),
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'))))))) $$,
  '23505', 'Doppelte Inhalts-ID.', 'doppelte ID abgelehnt'
);
select is((select version from public.recipes where id = 'porridge'), 1, 'abgelehnte Pakete haben nichts verändert');

-- Neue Version: Rezept porridge v2 (ohne Erdnuss), danach sinkt die Version nie.
select lives_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('milch')), 2),
       pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine'))))))) $$,
  'neue Version eingespielt'
);
select results_eq(
  $$ select version, allergens from public.recipes where id = 'porridge' $$,
  $$ values (2, '{dairy,gluten,lactose}'::text[]) $$,
  'neue Version: Allergene neu abgeleitet'
);
select is((select count(*)::int from public.recipe_ingredients where recipe_id = 'porridge'), 2, 'Zutaten ersetzt');
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package()) $$,
  '23514', 'Version von porridge ist kleiner als in der Datenbank.', 'Version sinkt nie'
);

-- Archivieren statt löschen: ohne Wackelpudding und Gelatine, ohne Ratgeber.
select is(
  public.seed_nutrition_content(jsonb_build_object(
    'foods', jsonb_build_array(pg_temp.food('hafer', '{gluten}'), pg_temp.food('milch', '{dairy,lactose}', '{dairy}'),
      pg_temp.food('erdnuss', '{peanuts}')),
    'recipes', jsonb_build_array(pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('milch')), 2)),
    'ingredient_substitutions', pg_temp.package() -> 'ingredient_substitutions',
    'package_sizes', pg_temp.package() -> 'package_sizes',
    'meal_prep_plans', pg_temp.package() -> 'meal_prep_plans',
    'guides', '[]'::jsonb
  )) -> 'archived',
  '{"foods": 1, "recipes": 1, "guides": 1, "package_sizes": 0, "meal_prep_plans": 0, "ingredient_substitutions": 0}'::jsonb,
  'nicht mehr Freigegebenes wird archiviert'
);
select results_eq(
  $$ select id, status::text from public.recipes order by id $$,
  $$ values ('porridge', 'published'), ('wackelpudding', 'archived') $$,
  'archiviert statt gelöscht'
);

-- ---------------------------------------------------------------------------------------------------------
-- Lesen als Nutzer: nur „published“, Zutaten nur zu freigegebenen Rezepten
-- ---------------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select id from public.recipes $$, $$ values ('porridge') $$, 'authenticated: nur freigegebene Rezepte');
select results_eq($$ select id from public.foods order by id $$, $$ values ('erdnuss'), ('hafer'), ('milch') $$,
  'authenticated: nur freigegebene Lebensmittel');
select is_empty($$ select 1 from public.recipe_ingredients where recipe_id = 'wackelpudding' $$,
  'authenticated: keine Zutaten archivierter Rezepte');
select is((select count(*)::int from public.recipe_ingredients), 2, 'authenticated: Zutaten freigegebener Rezepte');
select is_empty($$ select 1 from public.guides $$, 'authenticated: archivierter Ratgeber unsichtbar');
select is((select count(*)::int from public.ingredient_substitutions), 1, 'authenticated: Austausch-Tabelle');
select is((select count(*)::int from public.food_package_sizes), 1, 'authenticated: Packungsgrößen');
select is((select count(*)::int from public.meal_prep_plans), 1, 'authenticated: Meal-Prep-Pläne');
select throws_ok(
  $$ insert into public.foods (id, version, status, name_de, shopping_category, pantry, pregnancy_caution, alcohol,
       max_fridge_days, freezable, data)
     values ('neu', 1, 'published', 'Neu', 'other', false, false, false, 1, false, '{}') $$,
  '42501', null, 'authenticated: kein Einfügen'
);
select throws_ok($$ update public.recipes set title_de = 'Geändert' $$, '42501', null, 'authenticated: kein Ändern');
select throws_ok($$ delete from public.recipe_ingredients $$, '42501', null, 'authenticated: kein Löschen');
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package()) $$, '42501', null,
  'authenticated: seed_nutrition_content nicht aufrufbar'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select throws_ok($$ select 1 from public.foods $$, '42501', null, 'anon: kein Zugriff auf foods');
select throws_ok($$ select 1 from public.recipes $$, '42501', null, 'anon: kein Zugriff auf recipes');
select throws_ok($$ select 1 from public.recipe_ingredients $$, '42501', null, 'anon: kein Zugriff auf recipe_ingredients');
select throws_ok($$ select 1 from public.ingredient_substitutions $$, '42501', null, 'anon: kein Zugriff auf ingredient_substitutions');
select throws_ok($$ select 1 from public.food_package_sizes $$, '42501', null, 'anon: kein Zugriff auf food_package_sizes');
select throws_ok($$ select 1 from public.meal_prep_plans $$, '42501', null, 'anon: kein Zugriff auf meal_prep_plans');
select throws_ok($$ select 1 from public.guides $$, '42501', null, 'anon: kein Zugriff auf guides');

-- ---------------------------------------------------------------------------------------------------------
-- CHECK-Bedingungen (als Eigentümer)
-- ---------------------------------------------------------------------------------------------------------
reset role;
select throws_ok(
  $$ insert into public.foods (id, version, status, name_de, shopping_category, pantry, pregnancy_caution, alcohol,
       max_fridge_days, freezable, data)
     values ('entwurf', 1, 'draft', 'Entwurf', 'other', false, false, false, 1, false, '{}') $$,
  '23514', null, 'Entwürfe nie in der Datenbank'
);
select throws_ok(
  $$ insert into public.foods (id, version, status, name_de, shopping_category, pantry, groups, pregnancy_caution,
       alcohol, max_fridge_days, freezable, data)
     values ('falsch', 1, 'published', 'Falsch', 'other', false, '{nuts}', false, false, 1, false, '{}') $$,
  '23514', null, 'unbekannte Lebensmittel-Gruppe abgelehnt'
);
select throws_ok(
  $$ insert into public.foods (id, version, status, name_de, shopping_category, pantry, animal, pregnancy_caution,
       alcohol, max_fridge_days, freezable, data)
     values ('fleisch', 1, 'published', 'Fleisch', 'other', false, '{meat}', false, false, 1, false, '{}') $$,
  '23514', null, 'Fleisch ohne Tierart abgelehnt'
);

select * from finish();
rollback;
