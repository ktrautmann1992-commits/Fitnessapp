-- Testphase (Gründer-Entscheidung 19.10.2026, docs/PLAN-PHASE-5.md „Nachtrag Testphase“): Ernährungs-Inhalte auch
-- OHNE fachliche Prüfung einspielbar – nur, wenn content-seed das ausdrücklich verlangt (content/einspiel-regeln.json
-- „nur_fachlich_geprueft“: false). Additiv und umkehrbar:
-- 1. seed_nutrition_content bekommt den Parameter p_require_expert_review (Standard true = Livegang-Regel wie bisher;
--    null zählt als true). Ein Aufruf nur mit p_content verhält sich exakt wie vorher. Alles andere bleibt gleich:
--    nur 'published', Katalog-Prüfung der Lebensmittel (R19), Prüfvermerk der Packungsgrößen, Verweise nur ins eigene
--    Paket, Versionen sinken nie, archivieren statt löschen, idempotent, data = Datei (ohne Prüfer-Namen).
--    Neu (auch in der Testphase): meta.expert_reviewed muss ein Wahrheitswert sein.
-- 2. Spalte expert_reviewed (aus data.meta.expert_reviewed berechnet, nicht beschreibbar) auf foods, recipes,
--    ingredient_substitutions, meal_prep_plans und guides – damit vor dem Livegang eine Abfrage zeigt, ob noch
--    Ungeprüftes freigegeben ist. RLS und Rechte unverändert (Lesen wie bisher nur „published“, Schreiben nur der Seed).
-- Zurück zur Livegang-Regel: content/einspiel-regeln.json auf true – die Datenbank braucht dafür keine Änderung.

-- ---------------------------------------------------------------------------------------------------------
-- 1. Spalte expert_reviewed (berechnet aus data)
-- ---------------------------------------------------------------------------------------------------------
alter table public.foods
  add column expert_reviewed boolean not null
  generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored;
alter table public.recipes
  add column expert_reviewed boolean not null
  generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored;
alter table public.ingredient_substitutions
  add column expert_reviewed boolean not null
  generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored;
alter table public.meal_prep_plans
  add column expert_reviewed boolean not null
  generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored;
alter table public.guides
  add column expert_reviewed boolean not null
  generated always as (coalesce(data -> 'meta' -> 'expert_reviewed' = 'true'::jsonb, false)) stored;

comment on column public.recipes.expert_reviewed is
  'Fachlich geprüft (data.meta.expert_reviewed). false nur in der Testphase (Gründer 19.10.2026) – vor dem Livegang 0 Zeilen mit status = published und false.';

-- ---------------------------------------------------------------------------------------------------------
-- 2. seed_nutrition_content mit Schalter p_require_expert_review (alte Signatur entfernen – sonst wäre der Aufruf
--    über PostgREST mit nur p_content mehrdeutig)
-- ---------------------------------------------------------------------------------------------------------
drop function public.seed_nutrition_content(jsonb);

create function public.seed_nutrition_content(p_content jsonb, p_require_expert_review boolean default true)
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

  -- Fachprüfung vor dem Livegang (Gründer-Entscheidung 6): ohne „fachlich geprüft“ kein Einspielen – außer in der
  -- Testphase (p_require_expert_review = false, Gründer-Entscheidung 19.10.2026). null zählt als true (sichere Richtung).
  -- Die Katalog-Prüfung der Lebensmittel (R19) gilt IMMER.
  select x ->> 'id' into bad
  from jsonb_array_elements(p_content -> 'foods') as x
  where (coalesce(p_require_expert_review, true)
      and (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb)
    or jsonb_typeof(x -> 'meta' -> 'catalog_reviewed_by') is distinct from 'string'
  limit 1;
  if bad is not null then
    raise exception 'Lebensmittel % ist nicht fachlich bzw. im Katalog geprüft.', bad
      using errcode = 'check_violation';
  end if;
  -- Auch in der Testphase muss der Prüfvermerk ein echter Wahrheitswert sein (true/false, nie fehlend).
  select x ->> 'id' into bad
  from unnest(kinds) as k, jsonb_array_elements(p_content -> k) as x
  where k <> 'package_sizes' and jsonb_typeof(x -> 'meta' -> 'expert_reviewed') is distinct from 'boolean'
  limit 1;
  if bad is not null then
    raise exception 'Inhalt % ohne Angabe „fachlich geprüft“.', bad using errcode = 'check_violation';
  end if;
  select x ->> 'id' into bad
  from unnest(array['recipes', 'ingredient_substitutions', 'meal_prep_plans', 'guides']) as k,
    jsonb_array_elements(p_content -> k) as x
  where coalesce(p_require_expert_review, true)
    and (x -> 'meta' -> 'expert_reviewed') is distinct from 'true'::jsonb
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

revoke all on function public.seed_nutrition_content(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.seed_nutrition_content(jsonb, boolean) to service_role;
