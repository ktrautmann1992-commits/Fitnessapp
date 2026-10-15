-- Phase 5 · N7: Ernährungs-Inhalte einspielen – public.seed_nutrition_content(p_content jsonb)
-- (docs/PLAN-PHASE-5.md 7.3, 19.4, 19.5; Muster public.seed_content aus Phase 2).
--
-- Präzisierung N7: eigene Funktion statt seed_content zu ersetzen – die bestehende Funktion (Übungen, Vorlagen)
-- bleibt unverändert, der Workflow content-seed ruft beide nacheinander auf (jede für sich eine Transaktion).
--
-- Aufruf nur durch service_role (Workflow content-seed) – NICHT durch Nutzer.
-- - Eine Transaktion, idempotent (unveränderte Zeilen werden nicht angefasst), nie zwei Läufe gleichzeitig.
-- - Nur freigegebene Inhalte (status 'published'). Was bisher freigegeben war und nicht mehr mitkommt, wird auf
--   'archived' gesetzt (archivieren statt löschen – gespeicherte Essenspläne verweisen darauf).
-- - Livegang nur fachlich geprüft (Gründer-Entscheidung 6, 19.5 K10): Lebensmittel, Rezepte, Austausch-Einträge,
--   Meal-Prep-Pläne und Ratgeber brauchen meta.expert_reviewed = true, Lebensmittel zusätzlich die Katalog-Prüfung
--   (meta.catalog_reviewed_by, R19). Packungsgrößen brauchen den Prüfvermerk meta.reviewed_by.
-- - Verweise nur auf Inhalte DESSELBEN Pakets (= freigegeben): Zutaten, Austausch und Packungsgrößen auf Lebensmittel,
--   Meal-Prep-Pläne auf Rezepte. Versionen sinken nie.
-- - data = Inhaltsdatei unverändert (Wächter N2d K9) bis auf die Namen der Prüfenden (Wächter N7 H8,
--   private.content_without_reviewer_names); abgeleitete Spalten berechnet die Funktion selbst.
--
-- p_content = { "foods": [...], "recipes": [...], "ingredient_substitutions": [...], "package_sizes": [...],
--   "meal_prep_plans": [...], "guides": [...] } im Format der Dateien unter content/ (packages/core/src/content).
-- Rückgabe: Anzahl eingespielter und archivierter Inhalte je Art. Fehlermeldungen enthalten nur Inhalts-IDs.

-- ---------------------------------------------------------------------------------------------------------
-- Hilfsfunktionen (nur innerhalb der security-definer-Funktionen bzw. dieser Funktion; nicht über die API)
-- ---------------------------------------------------------------------------------------------------------

-- Ernährungsform eines Lebensmittels wie foodDiet() in packages/core/src/nutrition/recipe-nutrients.ts:
-- vegan ohne tierischen Bestandteil; Fleisch, Fisch, Krebs-/Weichtiere, Gelatine, tierisches Lab, Insekten = nicht
-- vegetarisch; sonst (Milch, Ei, Honig) vegetarisch.
create or replace function private.food_diet(p_animal text[])
returns public.diet_type
language sql
immutable
set search_path = ''
as $$
  select case
    when p_animal && array['meat', 'fish', 'shellfish', 'gelatin', 'animal_rennet', 'insect']::text[]
      then 'omnivore'
    when cardinality(p_animal) > 0 then 'vegetarian'
    else 'vegan'
  end::public.diet_type
$$;

revoke all on function private.food_diet(text[]) from public;
-- service_role: für seed_nutrition_content (security invoker).
grant execute on function private.food_diet(text[]) to service_role;

-- Schwein wie foodContainsPork() in packages/core: Fleisch vom Schwein oder unbekannter Tierart, oder Gelatine vom
-- Schwein bzw. ohne/unbekannter Herkunft (S5).
create or replace function private.food_contains_pork(p_meat_kind text[], p_animal text[], p_gelatin_origin text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_meat_kind && array['pork', 'unknown']::text[]
    or ('gelatin' = any (p_animal) and (p_gelatin_origin is null or p_gelatin_origin in ('pork', 'unknown')))
$$;

revoke all on function private.food_contains_pork(text[], text[], text) from public;
-- service_role: für seed_nutrition_content (security invoker).
grant execute on function private.food_contains_pork(text[], text[], text) to service_role;

-- Passt die Ernährungsform? (vegan ⊂ vegetarisch ⊂ omnivor, wie dietAllows() in packages/core)
create or replace function private.diet_allows(p_wanted public.diet_type, p_food public.diet_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_wanted
    when 'omnivore' then true
    when 'vegetarian' then p_food in ('vegetarian', 'vegan')
    else p_food = 'vegan'
  end
$$;

revoke all on function private.diet_allows(public.diet_type, public.diet_type) from public;
-- service_role: für seed_nutrition_content (security invoker).
grant execute on function private.diet_allows(public.diet_type, public.diet_type) to service_role;

-- Text-Array aus einem JSON-Array (fehlend/null → leer).
create or replace function private.jsonb_text_array(p_value jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'array' then array(select jsonb_array_elements_text(p_value))
    else '{}'::text[]
  end
$$;

revoke all on function private.jsonb_text_array(jsonb) from public;
-- service_role: für seed_nutrition_content (security invoker).
grant execute on function private.jsonb_text_array(jsonb) to service_role;

-- Inhaltsdatei ohne Namen von Prüfenden (Wächter N7 H8): `data` ist für jede angemeldete Person lesbar. Namen bzw.
-- Kürzel in meta.reviewed_by, meta.catalog_reviewed_by, meta.import_assumptions_confirmed_by und
-- cost_estimate.reviewed_by werden durch den neutralen Wert 'redaktion' ersetzt (gesetzt bleibt gesetzt, null bleibt
-- null – die Zod-Schemas der App und „freigegeben braucht Prüfer“ gelten weiter); meta.review_note (Freitext) wird
-- null. Alles andere – auch meta.import_assumptions* und der Fingerabdruck (K9) – bleibt unverändert. Die
-- Original-Dateien mit Namen liegen im Repository.
create or replace function private.content_without_reviewer_names(p_doc jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_doc -> 'meta') = 'object' then
    jsonb_set(
      case when jsonb_typeof(p_doc -> 'cost_estimate' -> 'reviewed_by') = 'string'
        then jsonb_set(p_doc, '{cost_estimate,reviewed_by}', '"redaktion"') else p_doc end,
      '{meta}',
      (
        select coalesce(jsonb_object_agg(
          k,
          case
            when k in ('reviewed_by', 'catalog_reviewed_by', 'import_assumptions_confirmed_by')
              and jsonb_typeof(v) = 'string' then '"redaktion"'::jsonb
            when k = 'review_note' then 'null'::jsonb
            else v
          end
        ), '{}'::jsonb)
        from jsonb_each(p_doc -> 'meta') as m(k, v)
      )
    )
  else p_doc end
$$;

revoke all on function private.content_without_reviewer_names(jsonb) from public;
-- service_role: für seed_nutrition_content (security invoker).
grant execute on function private.content_without_reviewer_names(jsonb) to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- seed_nutrition_content
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.seed_nutrition_content(p_content jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  kinds constant text[] := array[
    'foods', 'recipes', 'ingredient_substitutions', 'package_sizes', 'meal_prep_plans', 'guides'
  ];
  kind text;
  food_ids text[];
  recipe_ids text[];
  substitution_ids text[];
  package_ids text[];
  prep_plan_ids text[];
  guide_ids text[];
  bad text;
  archived jsonb := '{}'::jsonb;
  n integer;
begin
  if jsonb_typeof(p_content) is distinct from 'object' then
    raise exception 'Ungültige Inhalte: erwartet ein Objekt mit %.', array_to_string(kinds, ', ')
      using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from jsonb_object_keys(p_content) as k where not k = any (kinds)) then
    raise exception 'Unbekannte Inhaltsart.' using errcode = 'invalid_parameter_value';
  end if;
  foreach kind in array kinds loop
    if jsonb_typeof(p_content -> kind) is distinct from 'array' then
      raise exception 'Ungültige Inhalte: „%“ fehlt oder ist keine Liste.', kind
        using errcode = 'invalid_parameter_value';
    end if;
  end loop;

  -- Nie zwei Einspiel-Vorgänge gleichzeitig.
  perform pg_advisory_xact_lock(hashtext('public.seed_nutrition_content'));

  -- -------------------------------------------------------------------------------------------------------
  -- Eingaben prüfen
  -- -------------------------------------------------------------------------------------------------------
  select coalesce(x ->> 'id', '(ohne ID)') into bad
  from unnest(kinds) as k, jsonb_array_elements(p_content -> k) as x
  where jsonb_typeof(x) is distinct from 'object' or x ->> 'status' is distinct from 'published'
  limit 1;
  if bad is not null then
    raise exception 'Nur freigegebene Inhalte dürfen eingespielt werden: %', bad
      using errcode = 'invalid_parameter_value';
  end if;

  food_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'foods') as x);
  recipe_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'recipes') as x);
  substitution_ids := array(
    select x ->> 'id' from jsonb_array_elements(p_content -> 'ingredient_substitutions') as x
  );
  package_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'package_sizes') as x);
  prep_plan_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'meal_prep_plans') as x);
  guide_ids := array(select x ->> 'id' from jsonb_array_elements(p_content -> 'guides') as x);
  if array_position(food_ids || recipe_ids || substitution_ids || package_ids || prep_plan_ids || guide_ids, null)
       is not null then
    raise exception 'Inhalt ohne ID.' using errcode = 'invalid_parameter_value';
  end if;
  if not private.has_distinct_elements(food_ids)
    or not private.has_distinct_elements(recipe_ids)
    or not private.has_distinct_elements(substitution_ids)
    or not private.has_distinct_elements(package_ids)
    or not private.has_distinct_elements(prep_plan_ids)
    or not private.has_distinct_elements(guide_ids) then
    raise exception 'Doppelte Inhalts-ID.' using errcode = 'unique_violation';
  end if;

  -- Fachprüfung vor dem Livegang (Gründer-Entscheidung 6): ohne „fachlich geprüft“ kein Einspielen.
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'foods') as x
  where (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb
    or jsonb_typeof(x -> 'meta' -> 'catalog_reviewed_by') is distinct from 'string'
  limit 1;
  if bad is not null then
    raise exception 'Lebensmittel % ist nicht fachlich bzw. im Katalog geprüft.', bad
      using errcode = 'check_violation';
  end if;
  select x ->> 'id' into bad
  from unnest(array['recipes', 'ingredient_substitutions', 'meal_prep_plans', 'guides']) as k,
    jsonb_array_elements(p_content -> k) as x
  where (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb
  limit 1;
  if bad is not null then
    raise exception 'Inhalt % ist nicht fachlich geprüft.', bad using errcode = 'check_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'package_sizes') as x
  where jsonb_typeof(x -> 'meta' -> 'reviewed_by') is distinct from 'string'
  limit 1;
  if bad is not null then
    raise exception 'Packungsgröße % ohne Prüfvermerk.', bad using errcode = 'check_violation';
  end if;

  -- Verweise nur auf Inhalte desselben Pakets (= freigegeben).
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'recipes') as x
  left join lateral jsonb_array_elements(
    case when jsonb_typeof(x -> 'ingredients') = 'array' then x -> 'ingredients' else '[]'::jsonb end
  ) as i on true
  where jsonb_typeof(x -> 'ingredients') is distinct from 'array'
    or jsonb_array_length(x -> 'ingredients') = 0
    or not coalesce(i ->> 'food_id' = any (food_ids), false)
  limit 1;
  if bad is not null then
    raise exception 'Rezept % verwendet ein nicht freigegebenes Lebensmittel.', bad
      using errcode = 'foreign_key_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'ingredient_substitutions') as x
  where not coalesce(x ->> 'food_id' = any (food_ids), false)
    or not coalesce(x ->> 'substitute_food_id' = any (food_ids), false)
  limit 1;
  if bad is not null then
    raise exception 'Austausch % verweist auf ein nicht freigegebenes Lebensmittel.', bad
      using errcode = 'foreign_key_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'package_sizes') as x
  where not coalesce(x ->> 'food_id' = any (food_ids), false)
  limit 1;
  if bad is not null then
    raise exception 'Packungsgröße % verweist auf ein nicht freigegebenes Lebensmittel.', bad
      using errcode = 'foreign_key_violation';
  end if;
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'meal_prep_plans') as x
  where not (private.jsonb_text_array(x -> 'recipe_ids') <@ recipe_ids)
    or cardinality(private.jsonb_text_array(x -> 'recipe_ids')) = 0
  limit 1;
  if bad is not null then
    raise exception 'Meal-Prep-Plan % enthält ein nicht freigegebenes Rezept.', bad
      using errcode = 'foreign_key_violation';
  end if;

  -- Versionen sinken nie.
  select x ->> 'id' into bad
  from (
    select x, 'foods' as k from jsonb_array_elements(p_content -> 'foods') as x
    union all select x, 'recipes' from jsonb_array_elements(p_content -> 'recipes') as x
    union all select x, 'ingredient_substitutions' from jsonb_array_elements(p_content -> 'ingredient_substitutions') as x
    union all select x, 'package_sizes' from jsonb_array_elements(p_content -> 'package_sizes') as x
    union all select x, 'meal_prep_plans' from jsonb_array_elements(p_content -> 'meal_prep_plans') as x
    union all select x, 'guides' from jsonb_array_elements(p_content -> 'guides') as x
  ) as items
  where (x ->> 'version')::integer < coalesce(
    case k
      when 'foods' then (select o.version from public.foods o where o.id = x ->> 'id')
      when 'recipes' then (select o.version from public.recipes o where o.id = x ->> 'id')
      when 'ingredient_substitutions' then (select o.version from public.ingredient_substitutions o where o.id = x ->> 'id')
      when 'package_sizes' then (select o.version from public.food_package_sizes o where o.id = x ->> 'id')
      when 'meal_prep_plans' then (select o.version from public.meal_prep_plans o where o.id = x ->> 'id')
      else (select o.version from public.guides o where o.id = x ->> 'id')
    end,
    0
  )
  limit 1;
  if bad is not null then
    raise exception 'Version von % ist kleiner als in der Datenbank.', bad
      using errcode = 'check_violation';
  end if;

  -- -------------------------------------------------------------------------------------------------------
  -- Lebensmittel
  -- -------------------------------------------------------------------------------------------------------
  insert into public.foods as cur (
    id, version, status, name_de, shopping_category, pantry, groups, animal, meat_kind, gelatin_origin,
    pregnancy_caution, alcohol, max_fridge_days, freezable, data
  )
  select
    x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'name_de',
    x ->> 'shopping_category', (x ->> 'pantry')::boolean, private.jsonb_text_array(x -> 'groups'),
    private.jsonb_text_array(x -> 'animal'), private.jsonb_text_array(x -> 'meat_kind'), x ->> 'gelatin_origin',
    (x ->> 'pregnancy_caution')::boolean, (x ->> 'alcohol')::boolean, (x ->> 'max_fridge_days')::smallint,
    (x ->> 'freezable')::boolean, private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'foods') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        name_de = excluded.name_de,
        shopping_category = excluded.shopping_category,
        pantry = excluded.pantry,
        groups = excluded.groups,
        animal = excluded.animal,
        meat_kind = excluded.meat_kind,
        gelatin_origin = excluded.gelatin_origin,
        pregnancy_caution = excluded.pregnancy_caution,
        alcohol = excluded.alcohol,
        max_fridge_days = excluded.max_fridge_days,
        freezable = excluded.freezable,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  -- -------------------------------------------------------------------------------------------------------
  -- Rezepte (abgeleitete Spalten aus den Zutaten, inkl. optionaler – S3) und Zutaten
  -- -------------------------------------------------------------------------------------------------------
  insert into public.recipes as cur (
    id, version, status, title_de, meal_types, categories, servings, no_cook, diet, allergens, contains_pork, data
  )
  select
    x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'title_de',
    private.jsonb_text_array(x -> 'meal_types'), private.jsonb_text_array(x -> 'categories'),
    (x ->> 'servings')::smallint, (x ->> 'no_cook')::boolean,
    case
      when bool_or(private.food_diet(f.animal) = 'omnivore') then 'omnivore'
      when bool_or(private.food_diet(f.animal) = 'vegetarian') then 'vegetarian'
      else 'vegan'
    end::public.diet_type,
    array(
      select distinct g
      from jsonb_array_elements(x -> 'ingredients') as i2
      join public.foods f2 on f2.id = i2 ->> 'food_id'
      cross join lateral unnest(f2.groups) as g
      order by g
    ),
    coalesce(bool_or(private.food_contains_pork(f.meat_kind, f.animal, f.gelatin_origin)), false),
    private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'recipes') as x
  cross join lateral jsonb_array_elements(x -> 'ingredients') as i
  join public.foods f on f.id = i ->> 'food_id'
  group by x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        title_de = excluded.title_de,
        meal_types = excluded.meal_types,
        categories = excluded.categories,
        servings = excluded.servings,
        no_cook = excluded.no_cook,
        diet = excluded.diet,
        allergens = excluded.allergens,
        contains_pork = excluded.contains_pork,
        data = excluded.data
    where (cur.version, cur.status, cur.data, cur.diet, cur.allergens, cur.contains_pork)
      is distinct from
      (excluded.version, excluded.status, excluded.data, excluded.diet, excluded.allergens, excluded.contains_pork);

  -- Zutaten der eingespielten Rezepte komplett ersetzen (stabile Schlüssel → gleicher Stand).
  delete from public.recipe_ingredients where recipe_id = any (recipe_ids);
  insert into public.recipe_ingredients (recipe_id, position, food_id, amount, unit, optional, scales, role)
  select x ->> 'id', (i.ord - 1)::smallint, i.v ->> 'food_id', (i.v ->> 'amount')::numeric, i.v ->> 'unit',
    (i.v ->> 'optional')::boolean, (i.v ->> 'scales')::boolean, i.v ->> 'role'
  from jsonb_array_elements(p_content -> 'recipes') as x
  cross join lateral jsonb_array_elements(x -> 'ingredients') with ordinality as i(v, ord);

  -- -------------------------------------------------------------------------------------------------------
  -- Austausch-Tabelle, Packungsgrößen, Meal-Prep-Pläne, Ratgeber
  -- -------------------------------------------------------------------------------------------------------
  insert into public.ingredient_substitutions as cur (
    id, version, status, food_id, substitute_food_id, factor, role, data
  )
  select x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'food_id',
    x ->> 'substitute_food_id', (x ->> 'factor')::numeric, x ->> 'role', private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'ingredient_substitutions') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        food_id = excluded.food_id,
        substitute_food_id = excluded.substitute_food_id,
        factor = excluded.factor,
        role = excluded.role,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  insert into public.food_package_sizes as cur (id, version, status, food_id, package_size_g, data)
  select x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'food_id',
    (x ->> 'package_size_g')::integer, private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'package_sizes') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        food_id = excluded.food_id,
        package_size_g = excluded.package_size_g,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  insert into public.meal_prep_plans as cur (id, version, status, title_de, recipe_ids, data)
  select x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'title_de',
    private.jsonb_text_array(x -> 'recipe_ids'), private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'meal_prep_plans') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        title_de = excluded.title_de,
        recipe_ids = excluded.recipe_ids,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  insert into public.guides as cur (id, version, status, title_de, data)
  select x ->> 'id', (x ->> 'version')::integer, (x ->> 'status')::public.content_status, x ->> 'title_de',
    private.content_without_reviewer_names(x)
  from jsonb_array_elements(p_content -> 'guides') as x
  on conflict (id) do update
    set version = excluded.version,
        status = excluded.status,
        title_de = excluded.title_de,
        data = excluded.data
    where (cur.version, cur.status, cur.data) is distinct from (excluded.version, excluded.status, excluded.data);

  -- -------------------------------------------------------------------------------------------------------
  -- Nicht mehr Freigegebenes zurückziehen (archivieren statt löschen)
  -- -------------------------------------------------------------------------------------------------------
  update public.meal_prep_plans set status = 'archived'
  where status = 'published' and not (id = any (prep_plan_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('meal_prep_plans', n);
  update public.guides set status = 'archived' where status = 'published' and not (id = any (guide_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('guides', n);
  update public.ingredient_substitutions set status = 'archived'
  where status = 'published' and not (id = any (substitution_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('ingredient_substitutions', n);
  update public.food_package_sizes set status = 'archived'
  where status = 'published' and not (id = any (package_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('package_sizes', n);
  update public.recipes set status = 'archived' where status = 'published' and not (id = any (recipe_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('recipes', n);
  update public.foods set status = 'archived' where status = 'published' and not (id = any (food_ids));
  get diagnostics n = row_count;
  archived := archived || jsonb_build_object('foods', n);

  return jsonb_build_object(
    'foods', cardinality(food_ids),
    'recipes', cardinality(recipe_ids),
    'ingredient_substitutions', cardinality(substitution_ids),
    'package_sizes', cardinality(package_ids),
    'meal_prep_plans', cardinality(prep_plan_ids),
    'guides', cardinality(guide_ids),
    'archived', archived
  );
end;
$$;

revoke all on function public.seed_nutrition_content(jsonb) from public, anon, authenticated;
grant execute on function public.seed_nutrition_content(jsonb) to service_role;
