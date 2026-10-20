-- Testphase (Gründer-Entscheidung 19.10.2026, Migration 20261019140000): seed_nutrition_content mit
-- p_require_expert_review – Standard und null = Livegang-Regel (nur fachlich geprüft), false = auch ungeprüfte
-- freigegebene Inhalte; Katalog-Prüfung, Prüfvermerk, nur published, Verweise und Rechte bleiben. Spalte expert_reviewed
-- aus data, nicht beschreibbar; RLS unverändert (Nutzer lesen nur published, auch die neue Spalte).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

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

-- Paket, in dem Rezept, Lebensmittel, Austausch, Meal-Prep-Plan und Ratgeber NICHT fachlich geprüft sind.
create function pg_temp.unreviewed_package()
returns jsonb language sql as $$
  select pg_temp.package(jsonb_build_object(
    'foods', jsonb_build_array(
      pg_temp.food('hafer', '{gluten}', p_expert => false),
      pg_temp.food('milch', '{dairy,lactose}', '{dairy}'),
      pg_temp.food('erdnuss', '{peanuts}'),
      pg_temp.food('gelatine', '{}', '{gelatin}')
    ),
    'recipes', jsonb_build_array(
      pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('milch'),
        pg_temp.ing('erdnuss', true)), p_expert => false),
      pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine')))
    ),
    'ingredient_substitutions', jsonb_build_array(jsonb_set(pg_temp.package() -> 'ingredient_substitutions' -> 0,
      '{meta,expert_reviewed}', 'false')),
    'meal_prep_plans', jsonb_build_array(jsonb_set(pg_temp.package() -> 'meal_prep_plans' -> 0,
      '{meta,expert_reviewed}', 'false')),
    'guides', jsonb_build_array(jsonb_set(pg_temp.package() -> 'guides' -> 0, '{meta,expert_reviewed}', 'false'))
  ))
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Struktur und Rechte
-- ---------------------------------------------------------------------------------------------------------
select has_function('public', 'seed_nutrition_content', array['jsonb', 'boolean'], 'neue Signatur (jsonb, boolean)');
select hasnt_function('public', 'seed_nutrition_content', array['jsonb'], 'alte Signatur entfernt (kein mehrdeutiger Aufruf)');
select ok(
  not has_function_privilege('authenticated', 'public.seed_nutrition_content(jsonb, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.seed_nutrition_content(jsonb, boolean)', 'execute')
  and not has_function_privilege('public', 'public.seed_nutrition_content(jsonb, boolean)', 'execute')
  and has_function_privilege('service_role', 'public.seed_nutrition_content(jsonb, boolean)', 'execute'),
  'weiter nur service_role'
);
select ok(
  (select bool_and(a.attgenerated = 's' and a.attnotnull) from pg_attribute a
   where a.attname = 'expert_reviewed' and a.attrelid in ('public.foods'::regclass, 'public.recipes'::regclass,
     'public.ingredient_substitutions'::regclass, 'public.meal_prep_plans'::regclass, 'public.guides'::regclass))
  and (select count(*) from pg_attribute a where a.attname = 'expert_reviewed' and not a.attisdropped
       and a.attrelid in ('public.foods'::regclass, 'public.recipes'::regclass,
         'public.ingredient_substitutions'::regclass, 'public.meal_prep_plans'::regclass,
         'public.guides'::regclass)) = 5,
  'expert_reviewed: berechnete Spalte (aus data) auf fünf Inhaltstabellen'
);
select ok(
  (select bool_and(c.relrowsecurity) from pg_class c
   where c.oid in ('public.foods'::regclass, 'public.recipes'::regclass, 'public.ingredient_substitutions'::regclass,
     'public.meal_prep_plans'::regclass, 'public.guides'::regclass)),
  'RLS weiter an'
);

-- ---------------------------------------------------------------------------------------------------------
-- Livegang-Regel (Standard, true, null)
-- ---------------------------------------------------------------------------------------------------------
set local role service_role;
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.unreviewed_package()) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.',
  'Standard (ohne Parameter): ungeprüftes Lebensmittel abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.unreviewed_package(), true) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.', 'true: abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.unreviewed_package(), null) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.', 'null zählt als true: abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer')), p_expert => false))))) $$,
  '23514', 'Inhalt porridge ist nicht fachlich geprüft.', 'Standard: ungeprüftes Rezept abgelehnt'
);
select is((select count(*)::int from public.recipes), 0, 'abgelehnt: nichts eingespielt');

-- ---------------------------------------------------------------------------------------------------------
-- Testphase (false): ungeprüfte freigegebene Inhalte kommen mit, alle anderen Regeln bleiben
-- ---------------------------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('foods', jsonb_build_array(
       pg_temp.food('hafer', '{gluten}', p_catalog => false, p_expert => false),
       pg_temp.food('milch', '{dairy,lactose}', '{dairy}'), pg_temp.food('erdnuss', '{peanuts}'),
       pg_temp.food('gelatine', '{}', '{gelatin}')))), false) $$,
  '23514', 'Lebensmittel hafer ist nicht fachlich bzw. im Katalog geprüft.',
  'Testphase: Katalog-Prüfung (R19) bleibt Pflicht'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('guides',
       jsonb_build_array(jsonb_set(pg_temp.package() -> 'guides' -> 0, '{status}', '"draft"')))), false) $$,
  '22023', 'Nur freigegebene Inhalte dürfen eingespielt werden: ratgeber-test', 'Testphase: Entwürfe abgelehnt'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('package_sizes', jsonb_build_array(
       jsonb_set(pg_temp.package() -> 'package_sizes' -> 0, '{meta,reviewed_by}', 'null')))), false) $$,
  '23514', 'Packungsgröße packung-hafer ohne Prüfvermerk.', 'Testphase: Packungsgröße braucht Prüfvermerk'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('recipes', jsonb_build_array(
       pg_temp.recipe('porridge', jsonb_build_array(pg_temp.ing('hafer'), pg_temp.ing('unbekannt')), p_expert => false),
       pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine')))))), false) $$,
  '23503', 'Rezept porridge verwendet ein nicht freigegebenes Lebensmittel.', 'Testphase: Verweise nur ins Paket'
);
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.package(jsonb_build_object('guides',
       jsonb_build_array(pg_temp.package() -> 'guides' -> 0 #- '{meta,expert_reviewed}'))), false) $$,
  '23514', 'Inhalt ratgeber-test ohne Angabe „fachlich geprüft“.',
  'Testphase: fehlende Angabe expert_reviewed abgelehnt'
);
select is(
  public.seed_nutrition_content(pg_temp.unreviewed_package(), false) - 'archived',
  '{"foods": 4, "recipes": 2, "ingredient_substitutions": 1, "package_sizes": 1, "meal_prep_plans": 1, "guides": 1}'::jsonb,
  'Testphase: ungeprüfte freigegebene Inhalte eingespielt'
);
select results_eq(
  $$ select id, expert_reviewed, data -> 'meta' -> 'expert_reviewed' from public.recipes order by id $$,
  $$ values ('porridge', false, 'false'::jsonb), ('wackelpudding', true, 'true'::jsonb) $$,
  'expert_reviewed je Inhalt in Spalte und data übertragen'
);
select results_eq(
  $$ select (select expert_reviewed from public.foods where id = 'hafer'),
            (select expert_reviewed from public.foods where id = 'milch'),
            (select expert_reviewed from public.ingredient_substitutions where id = 'tausch-milch-zu-hafer'),
            (select expert_reviewed from public.meal_prep_plans where id = 'mp-woche'),
            (select expert_reviewed from public.guides where id = 'ratgeber-test') $$,
  $$ values (false, true, false, false, false) $$,
  'expert_reviewed: Lebensmittel, Austausch, Meal-Prep-Plan, Ratgeber'
);
select is(
  (select data from public.recipes where id = 'porridge') - 'meta',
  (pg_temp.unreviewed_package() -> 'recipes' -> 0) - 'meta',
  'Testphase: Datei unverändert in data (K9)'
);
select is(
  public.seed_nutrition_content(pg_temp.unreviewed_package(), false) -> 'archived',
  '{"foods": 0, "recipes": 0, "guides": 0, "package_sizes": 0, "meal_prep_plans": 0, "ingredient_substitutions": 0}'::jsonb,
  'Testphase: zweiter Lauf idempotent'
);

-- Zurück zur Livegang-Regel: Paket nur mit Geprüftem → Ungeprüftes wird archiviert (nicht gelöscht).
select is(
  public.seed_nutrition_content(jsonb_build_object(
    'foods', jsonb_build_array(pg_temp.food('milch', '{dairy,lactose}', '{dairy}'), pg_temp.food('erdnuss', '{peanuts}'),
      pg_temp.food('gelatine', '{}', '{gelatin}')),
    'recipes', jsonb_build_array(pg_temp.recipe('wackelpudding', jsonb_build_array(pg_temp.ing('gelatine')))),
    'ingredient_substitutions', '[]'::jsonb, 'package_sizes', '[]'::jsonb, 'meal_prep_plans', '[]'::jsonb,
    'guides', '[]'::jsonb
  )) -> 'archived',
  '{"foods": 1, "recipes": 1, "guides": 1, "package_sizes": 1, "meal_prep_plans": 1, "ingredient_substitutions": 1}'::jsonb,
  'Livegang-Regel danach: Ungeprüftes archiviert'
);
select is_empty(
  $$ select id from public.recipes where status = 'published' and not expert_reviewed
     union all select id from public.foods where status = 'published' and not expert_reviewed
     union all select id from public.guides where status = 'published' and not expert_reviewed $$,
  'Livegang-Prüfabfrage: nichts Ungeprüftes mehr freigegeben'
);

-- ---------------------------------------------------------------------------------------------------------
-- Nutzer: Lesen wie bisher (nur published), Spalte nicht beschreibbar, Seed nicht aufrufbar
-- ---------------------------------------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select results_eq($$ select id, expert_reviewed from public.recipes $$, $$ values ('wackelpudding', true) $$,
  'authenticated: nur freigegebene Rezepte (mit Spalte expert_reviewed)');
select throws_ok(
  $$ select public.seed_nutrition_content(pg_temp.unreviewed_package(), false) $$, '42501', null,
  'authenticated: Testphase-Seed nicht aufrufbar'
);
reset role;
select throws_ok(
  $$ update public.recipes set expert_reviewed = true where id = 'porridge' $$, '428C9', null,
  'Spalte expert_reviewed nur aus data (nicht direkt setzbar, auch nicht als Eigentümer)'
);

select * from finish();
rollback;
