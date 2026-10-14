-- Phase 5 · N7: Ernährungs-Inhalte in der Datenbank (docs/PLAN-PHASE-5.md 7.2, 19.4).
--
-- Inhaltstabellen OHNE Nutzerdaten – Muster wie public.exercises (Phase 2):
-- - Die Wahrheit liegt im Repository (content/foods, content/recipes, content/substitutions, content/package-sizes,
--   content/meal-prep-plans, content/guides). Hier stehen nur FREIGEGEBENE (und später zurückgezogene) Inhalte –
--   Entwürfe nie (CHECK status <> 'draft').
-- - Schreiben ausschließlich über public.seed_nutrition_content() (service_role, Workflow content-seed).
-- - RLS: anon sieht nichts, authenticated liest nur „published“.
-- - Spalte „data“ = die geprüfte Inhaltsdatei UNVERÄNDERT bis auf die Namen der Prüfenden (Wächter N7 H8: werden
--   beim Einspielen zu „redaktion“; Wächter N2d K9: Zutaten, Schritte, Tipp, Zeiten, Geräte,
--   meta.import_assumptions* reisen ohne Umformung). Die App prüft sie an der Grenze erneut mit den Zod-Schemas aus
--   packages/core (validateContent/selectNutritionContent, allowDrafts nie true). Die übrigen Spalten sind daraus
--   abgeleitet und dienen den Server-Prüfungen (save_meal_plan, 7.3) und Fremdschlüsseln.
-- Werte-Listen = packages/core (FOOD_GROUPS, SHOPPING_CATEGORIES, ANIMAL_KINDS, MEAT_KINDS, GELATIN_ORIGINS,
-- MEAL_TYPES, RECIPE_CATEGORIES, INGREDIENT_ROLES, RECIPE_UNITS); Abgleich in packages/core/src/db-sync.test.ts.

-- ---------------------------------------------------------------------------------------------------------
-- foods: Lebensmittel-Katalog (Plan 5.1)
-- ---------------------------------------------------------------------------------------------------------
create table public.foods (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  name_de text not null check (char_length(name_de) between 2 and 100),
  shopping_category text not null check (
    shopping_category in (
      'fruit_vegetables',
      'bread_bakery',
      'chilled_dairy_eggs',
      'chilled_plant_based',
      'meat_sausage',
      'fish',
      'pasta_rice_grains',
      'legumes_canned',
      'cereal_breakfast',
      'nuts_seeds_dried_fruit',
      'oils_vinegar_sauces',
      'spices_baking',
      'frozen',
      'drinks',
      'other'
    )
  ),
  pantry boolean not null,
  -- Lebensmittel-Gruppen (FOOD_GROUPS, 14 EU-Hauptallergene + weitere).
  groups text[] not null default '{}' check (
    groups <@ array[
      'gluten',
      'dairy',
      'lactose',
      'eggs',
      'fish',
      'shellfish',
      'poultry',
      'beef',
      'lamb',
      'legumes',
      'soy',
      'peanuts',
      'tree_nuts',
      'sesame',
      'celery',
      'mustard',
      'lupin',
      'sulphites',
      'fructose',
      'histamine',
      'mushrooms',
      'onion_garlic',
      'spicy'
    ]::text[]
    and array_position(groups, null) is null
    and private.has_distinct_elements(groups)
  ),
  -- Tierische Bestandteile (ANIMAL_KINDS): leer = vegan.
  animal text[] not null default '{}' check (
    animal <@ array[
      'dairy',
      'egg',
      'honey',
      'meat',
      'fish',
      'shellfish',
      'gelatin',
      'animal_rennet',
      'insect'
    ]::text[]
    and array_position(animal, null) is null
    and private.has_distinct_elements(animal)
  ),
  -- Tierart bei Fleisch (MEAT_KINDS); unknown zählt als Schwein (S5).
  meat_kind text[] not null default '{}' check (
    meat_kind <@ array['pork', 'beef', 'poultry', 'lamb', 'game', 'unknown']::text[]
    and array_position(meat_kind, null) is null
    and private.has_distinct_elements(meat_kind)
  ),
  -- Herkunft der Gelatine (GELATIN_ORIGINS); fehlt sie, gilt Schwein (S5).
  gelatin_origin text check (gelatin_origin in ('pork', 'beef', 'fish', 'unknown')),
  pregnancy_caution boolean not null,
  alcohol boolean not null,
  -- sync: MEAL_PREP_FRIDGE_DAYS.max
  max_fridge_days smallint not null check (max_fridge_days between 0 and 3),
  freezable boolean not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (('meat' = any (animal)) = (cardinality(meat_kind) > 0)),
  check (gelatin_origin is null or 'gelatin' = any (animal))
);

comment on table public.foods is
  'Lebensmittel-Katalog (nur freigegeben/zurückgezogen). data = Inhaltsdatei unverändert. Schreiben nur seed_nutrition_content().';

-- ---------------------------------------------------------------------------------------------------------
-- recipes: Rezepte (Plan 5.2, 19.4). Nährwerte, Schwangerschafts-Vorsicht und alles Weitere berechnet die App mit
-- packages/core aus data + foods (wie im Testmodus). diet/allergens/contains_pork leitet seed_nutrition_content() aus
-- den Zutaten ab (inkl. optionaler Zutaten, S3) – nur zur Übersicht; save_meal_plan prüft je Zutat.
-- ---------------------------------------------------------------------------------------------------------
create table public.recipes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  title_de text not null check (char_length(title_de) between 3 and 100),
  meal_types text[] not null check (
    cardinality(meal_types) between 1 and 3
    and meal_types <@ array['breakfast', 'main', 'snack']::text[]
    and array_position(meal_types, null) is null
    and private.has_distinct_elements(meal_types)
  ),
  -- Themen-Kategorien (RECIPE_CATEGORIES, 19.4) – Präzisierung N7: Liste an der Zeile statt n:m-Tabelle.
  categories text[] not null default '{}' check (
    categories <@ array[
      'schnell',
      'pre-workout',
      'post-workout',
      'cardio',
      'wettkampf',
      'meal-prep',
      'protein-dessert',
      'spar-kueche'
    ]::text[]
    and array_position(categories, null) is null
    and private.has_distinct_elements(categories)
  ),
  servings smallint not null check (servings between 1 and 8),
  no_cook boolean not null,
  diet public.diet_type not null,
  allergens text[] not null default '{}' check (
    array_position(allergens, null) is null and private.has_distinct_elements(allergens)
  ),
  contains_pork boolean not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.recipes is
  'Rezepte (nur freigegeben/zurückgezogen). data = Inhaltsdatei unverändert. Schreiben nur seed_nutrition_content().';

-- Zutaten je Rezept (abgeleitet aus data.ingredients, Reihenfolge = Index im Rezept, 0-basiert wie in der App).
create table public.recipe_ingredients (
  recipe_id text not null references public.recipes (id) on update cascade on delete cascade,
  -- sync: RECIPE_SCHEMA_LIMITS.ingredients.max (Index 0 … max − 1)
  position smallint not null check (position between 0 and 19),
  food_id text not null references public.foods (id) on update cascade on delete restrict,
  -- sync: RECIPE_SCHEMA_LIMITS.amount
  amount numeric not null check (amount between 0.1 and 5000),
  unit text not null check (unit in ('g', 'ml', 'piece', 'tbsp', 'tsp', 'pinch')),
  optional boolean not null,
  scales boolean not null,
  role text check (role in ('protein', 'carb', 'fat', 'vegetable', 'seasoning', 'sweet')),
  primary key (recipe_id, position)
);

create index recipe_ingredients_food_id_idx on public.recipe_ingredients (food_id);

-- ---------------------------------------------------------------------------------------------------------
-- ingredient_substitutions: Austausch-Tabelle (19.4/19.7 N9, Regel R23)
-- ---------------------------------------------------------------------------------------------------------
create table public.ingredient_substitutions (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  food_id text not null references public.foods (id) on update cascade on delete restrict,
  substitute_food_id text not null references public.foods (id) on update cascade on delete restrict,
  -- sync: INGREDIENT_SUBSTITUTION_LIMITS.factor
  factor numeric not null check (factor between 0.2 and 5),
  role text not null check (role in ('protein', 'carb', 'fat', 'vegetable', 'seasoning', 'sweet')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (food_id, substitute_food_id),
  check (food_id <> substitute_food_id)
);

create index ingredient_substitutions_substitute_idx on public.ingredient_substitutions (substitute_food_id);

-- ---------------------------------------------------------------------------------------------------------
-- food_package_sizes: Packungsgrößen (19.7 N11, Regel R24) – Präzisierung N7: eigene Inhaltstabelle mit eigenem
-- Prüfvermerk (data.meta) statt Spalte an foods; content/foods bleibt allein foods-import vorbehalten (S3).
-- ---------------------------------------------------------------------------------------------------------
create table public.food_package_sizes (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  food_id text not null unique references public.foods (id) on update cascade on delete restrict,
  -- sync: PACKAGE_SIZE_LIMITS.grams
  package_size_g integer not null check (package_size_g between 1 and 5000),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- meal_prep_plans: Meal-Prep-Wochenpläne (19.4, Regel R20) – Präzisierung N7: eine Tabelle, Schritte und
-- Aufbewahrung in data (statt vier Tabellen); recipe_ids für die Fremdschlüssel-Prüfung im Seed.
-- ---------------------------------------------------------------------------------------------------------
create table public.meal_prep_plans (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  title_de text not null check (char_length(title_de) between 3 and 100),
  recipe_ids text[] not null check (
    cardinality(recipe_ids) between 1 and 6
    and array_position(recipe_ids, null) is null
    and private.has_distinct_elements(recipe_ids)
  ),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- guides: Ratgeber (19.4, Regel R21), Abschnitte in data
-- ---------------------------------------------------------------------------------------------------------
create table public.guides (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  version integer not null check (version between 1 and 1000),
  status public.content_status not null check (status <> 'draft'),
  title_de text not null check (char_length(title_de) between 3 and 100),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS (alle Inhaltstabellen gleich): anon nichts, authenticated liest nur „published“,
-- service_role schreibt (seed_nutrition_content).
-- ---------------------------------------------------------------------------------------------------------
alter table public.foods enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.ingredient_substitutions enable row level security;
alter table public.food_package_sizes enable row level security;
alter table public.meal_prep_plans enable row level security;
alter table public.guides enable row level security;

revoke all on table public.foods, public.recipes, public.recipe_ingredients, public.ingredient_substitutions,
  public.food_package_sizes, public.meal_prep_plans, public.guides
  from anon, authenticated;
grant select on table public.foods, public.recipes, public.recipe_ingredients, public.ingredient_substitutions,
  public.food_package_sizes, public.meal_prep_plans, public.guides
  to authenticated;
grant all on table public.foods, public.recipes, public.recipe_ingredients, public.ingredient_substitutions,
  public.food_package_sizes, public.meal_prep_plans, public.guides
  to service_role;

create policy "Freigegebene Lebensmittel sind für angemeldete Nutzer lesbar"
  on public.foods for select to authenticated
  using (status = 'published');
create policy "Freigegebene Rezepte sind für angemeldete Nutzer lesbar"
  on public.recipes for select to authenticated
  using (status = 'published');
-- Zutaten nur zu freigegebenen Rezepten (die Unterabfrage läuft selbst unter der RLS von recipes).
create policy "Zutaten freigegebener Rezepte sind für angemeldete Nutzer lesbar"
  on public.recipe_ingredients for select to authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_id and r.status = 'published'));
create policy "Freigegebene Austausch-Einträge sind für angemeldete Nutzer lesbar"
  on public.ingredient_substitutions for select to authenticated
  using (status = 'published');
create policy "Freigegebene Packungsgrößen sind für angemeldete Nutzer lesbar"
  on public.food_package_sizes for select to authenticated
  using (status = 'published');
create policy "Freigegebene Meal-Prep-Pläne sind für angemeldete Nutzer lesbar"
  on public.meal_prep_plans for select to authenticated
  using (status = 'published');
create policy "Freigegebene Ratgeber sind für angemeldete Nutzer lesbar"
  on public.guides for select to authenticated
  using (status = 'published');

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function private.set_updated_at();
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function private.set_updated_at();
create trigger ingredient_substitutions_set_updated_at
  before update on public.ingredient_substitutions
  for each row execute function private.set_updated_at();
create trigger food_package_sizes_set_updated_at
  before update on public.food_package_sizes
  for each row execute function private.set_updated_at();
create trigger meal_prep_plans_set_updated_at
  before update on public.meal_prep_plans
  for each row execute function private.set_updated_at();
create trigger guides_set_updated_at
  before update on public.guides
  for each row execute function private.set_updated_at();
