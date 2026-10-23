-- Phase 5: Rezept-Kategorien der Alpha5-Datei Fassung 1.1 (23.10.2026) – vier neue Kapitel.
-- Liste = RECIPE_CATEGORIES in packages/core/src/content/recipe-schema.ts (Gleichlauf prüft db-sync.test.ts).
-- Der alte CHECK aus *_nutrition_content.sql hat keinen eigenen Namen; er wird über seine Definition gefunden.

do $$
declare
  old_name text;
  dropped integer := 0;
begin
  for old_name in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid = 'public.recipes'::regclass
      and c.contype = 'c'
      and pg_catalog.pg_get_constraintdef(c.oid) like '%spar-kueche%'
  loop
    execute format('alter table public.recipes drop constraint %I', old_name);
    dropped := dropped + 1;
  end loop;
  -- Genau ein alter Kategorien-CHECK erwartet – sonst lieber abbrechen als still weitermachen.
  if dropped <> 1 then
    raise exception 'Erwartet genau einen alten Kategorien-CHECK auf recipes, gefunden: %', dropped;
  end if;
end;
$$;

alter table public.recipes add constraint recipes_categories_check check (
  categories <@ array[
    'schnell',
    'pre-workout',
    'post-workout',
    'cardio',
    'wettkampf',
    'meal-prep',
    'protein-dessert',
    'spar-kueche',
    'fitness-fast-food',
    'heissluftfritteuse',
    'sommer-eis',
    'low-carb'
  ]::text[]
  and array_position(categories, null) is null
  and private.has_distinct_elements(categories)
);
