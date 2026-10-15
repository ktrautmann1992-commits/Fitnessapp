-- Phase 5 · N7: Essenspläne und Einkaufslisten in der Datenbank (docs/PLAN-PHASE-5.md 7.1–7.3, 7.5).
--
-- Nutzerdaten mit RLS (nur eigene Zeilen, CLAUDE.md). Ein Plan bzw. eine Liste mit uses_health_data ist ein
-- Gesundheitsdatum (Art. 9 DSGVO, 7.1): Ziele, Flags, Unverträglichkeiten oder Ersatz/Weglassen/Tausch sind
-- eingeflossen. uses_health_data setzt NUR der Server (save_meal_plan / replace_shopping_list); beim Widerruf von
-- health_data werden solche Pläne und Listen gelöscht (private.consents_after_revoke, inkl. eigener Einträge, K10).
--
-- Bewusst NICHT gespeichert (7.1, Wächter N5a S4): Kalorien-/Makroziele, Planband, Abgleich-Schlüssel (safetyKey),
-- Modus je Tag, leere Plätze mit Gründen, Hinweise – sie verraten Gesundheitsangaben und werden auf dem Gerät aus
-- den aktuellen Angaben neu gerechnet. inputs enthält KEINE Körperdaten, Flags, Unverträglichkeiten, Abneigungen
-- und kein „ohne Schwein“ (K8). Geteilte Mahlzeiten (N13) sind bis P1 nicht speicherbar (keine Spalte).
--
-- Schreiben: meal_plans/meal_plan_items und shopping_lists/shopping_list_items nur über die geprüften Funktionen
-- (20261014120600_meal_plan_rpcs.sql). Direkt erlaubt sind nur: Plan-Merker zurücksetzen (auto_adjusted,
-- recipes_changed), Kochtag-Start (cook_day_started_at), Häkchen (checked) sowie Löschen eigener Pläne/Listen
-- (Recht auf Löschung).

-- ---------------------------------------------------------------------------------------------------------
-- meal_plans: höchstens EIN Plan je Person und Woche (ersetzen = löschen + neu anlegen)
-- ---------------------------------------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Montag der Woche.
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'active' check (status in ('active', 'replaced')),
  -- sync: MEAL_PLAN_ENGINE_VERSION (Obergrenze prüft save_meal_plan)
  engine_version smallint not null check (engine_version between 1 and 1000),
  variant integer not null check (variant between 0 and 10000),
  meal_prep_plan_id text references public.meal_prep_plans (id) on update cascade on delete restrict,
  -- mealPlanPayloadSchema.inputs (ohne Gesundheitsdaten, K8); Felder prüft save_meal_plan.
  inputs jsonb not null check (jsonb_typeof(inputs) = 'object' and octet_length(inputs::text) <= 1000),
  uses_health_data boolean not null,
  -- Automatisch neu geplant (6.6) bzw. wegen neuer Rezept-Version neu erstellt (K-b): Hinweis bis „Verstanden“.
  auto_adjusted boolean not null default false,
  recipes_changed boolean not null default false,
  -- Start des Meal-Prep-Kochtags (Timer, N5b) – nur mit gewähltem Meal-Prep-Plan.
  cook_day_started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (cook_day_started_at is null or meal_prep_plan_id is not null)
);

comment on table public.meal_plans is
  'Essensplan je Woche. SENSIBEL bei uses_health_data (Art. 9, 7.1): nie loggen, beim Widerruf gelöscht. Ohne Ziele/Planband/safetyKey.';

create unique index meal_plans_one_per_week_idx on public.meal_plans (user_id, week_start);

-- ---------------------------------------------------------------------------------------------------------
-- meal_plan_items: Mahlzeiten als Schnappschuss (Titel, Faktor, Nährwerte nach Rundung)
-- ---------------------------------------------------------------------------------------------------------
create table public.meal_plan_items (
  plan_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  -- Plätze = SLOT_KEYS in packages/core/src/nutrition/meal-plan-payload.ts (MEAL_PLAN_SLOT_KEYS)
  slot text not null check (
    slot in (
      'main',
      'breakfast',
      'snack_morning',
      'lunch',
      'snack_afternoon',
      'snack_pre_dinner',
      'dinner',
      'snack_late',
      'snack_night',
      'extra_1',
      'extra_2'
    )
  ),
  role text check (role in ('pre', 'post', 'pre_snack')),
  recipe_id text not null references public.recipes (id) on update cascade on delete restrict,
  recipe_version integer not null check (recipe_version between 1 and 1000),
  title_de text not null check (char_length(title_de) between 1 and 100),
  -- sync: PORTION_SCALE_LIMITS
  factor numeric not null check (factor between 0.5 and 2),
  kcal numeric not null check (kcal between 0 and 10000),
  protein_g numeric not null check (protein_g between 0 and 10000),
  carbs_g numeric not null check (carbs_g between 0 and 10000),
  fat_g numeric not null check (fat_g between 0 and 10000),
  -- Ersatzprodukte (S4) [{index, food_id, substitute_food_id}], weggelassene optionale Zutaten (S3)
  -- [{index, food_id}], getauschte Zutaten (N9) [{index, food_id, substitute_food_id}] – je Zutat-Index (Stelle im
  -- Rezept, Wächter N7 S3), damit doppelte Zutaten eindeutig bleiben.
  substitutions jsonb not null default '[]' check (
    jsonb_typeof(substitutions) = 'array' and jsonb_array_length(substitutions) <= 20
  ),
  omitted_optional jsonb not null default '[]' check (
    jsonb_typeof(omitted_optional) = 'array' and jsonb_array_length(omitted_optional) <= 20
  ),
  -- sync: INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal
  ingredient_swaps jsonb not null default '[]' check (
    jsonb_typeof(ingredient_swaps) = 'array' and jsonb_array_length(ingredient_swaps) <= 20
  ),
  is_fill boolean not null,
  prep_kind text not null check (prep_kind in ('cook', 'leftover', 'fresh')),
  cook_date date not null,
  storage text check (storage in ('fridge', 'freeze')),
  meal_prep_plan_id text references public.meal_prep_plans (id) on update cascade on delete restrict,
  day_status text not null check (day_status in ('complete', 'below_floor', 'no_targets')),
  primary key (plan_id, date, slot),
  foreign key (plan_id, user_id) references public.meal_plans (id, user_id) on delete cascade,
  -- Gekocht wird nie nach dem Tag selbst (genauer Rahmen: save_meal_plan).
  check (cook_date <= date)
);

create index meal_plan_items_user_id_idx on public.meal_plan_items (user_id);
create index meal_plan_items_recipe_id_idx on public.meal_plan_items (recipe_id);

-- ---------------------------------------------------------------------------------------------------------
-- shopping_lists: höchstens EINE Liste je Person und Woche
-- ---------------------------------------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  -- Plan der Woche (setzt der Server); wird der Plan ersetzt oder gelöscht, bleibt die Liste (nur der Verweis
  -- wird leer).
  meal_plan_id uuid,
  from_date date not null,
  to_date date not null,
  -- Fingerabdruck des Plans, aus dem die Liste zuletzt erzeugt wurde (mealPlanShoppingKey).
  plan_key text not null check (char_length(plan_key) between 1 and 100),
  -- „Zur Einkaufsliste“ (19.6): [{ recipe_id, servings, diet? }]; sync: SHOPPING_LIST_EXTRAS.recipesMax
  added_recipes jsonb not null default '[]' check (
    jsonb_typeof(added_recipes) = 'array' and jsonb_array_length(added_recipes) <= 20
  ),
  uses_health_data boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (meal_plan_id, user_id) references public.meal_plans (id, user_id)
    on delete set null (meal_plan_id),
  -- Zeitraum innerhalb der Woche Mo–So (shoppingListRangeValid).
  check (from_date >= week_start and to_date <= week_start + 6 and from_date <= to_date)
);

comment on table public.shopping_lists is
  'Einkaufsliste je Woche. SENSIBEL bei uses_health_data (Ersatzprodukte, fehlende Zutaten): beim Widerruf samt eigener Einträge gelöscht (K10).';

create unique index shopping_lists_one_per_week_idx on public.shopping_lists (user_id, week_start);
create index shopping_lists_meal_plan_id_idx on public.shopping_lists (meal_plan_id);

create table public.shopping_list_items (
  list_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Stabiler Schlüssel `food_id|einheit` bzw. `manual|…` für eigene Einträge.
  item_key text not null check (char_length(item_key) between 1 and 200),
  food_id text references public.foods (id) on update cascade on delete restrict,
  label_de text not null check (char_length(label_de) between 1 and 200),
  amount numeric check (amount between 0 and 1000000),
  unit text check (unit in ('g', 'ml', 'piece')),
  category text not null check (
    category in (
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
  is_pantry boolean not null,
  is_manual boolean not null,
  checked boolean not null default false,
  substitute_for text[] not null default '{}' check (
    cardinality(substitute_for) <= 50 and array_position(substitute_for, null) is null
  ),
  amount_changed boolean not null default false,
  not_in_plan boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (list_id, item_key),
  foreign key (list_id, user_id) references public.shopping_lists (id, user_id) on delete cascade,
  check (is_manual = (item_key like 'manual|%')),
  -- sync: SHOPPING_LIST_ROUNDING.manualLabelMaxChars
  check (not is_manual or char_length(label_de) <= 80)
);

create index shopping_list_items_user_id_idx on public.shopping_list_items (user_id);

-- ---------------------------------------------------------------------------------------------------------
-- Rechte und RLS
-- ---------------------------------------------------------------------------------------------------------
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

revoke all on table public.meal_plans, public.meal_plan_items, public.shopping_lists, public.shopping_list_items
  from anon, authenticated;
grant select, delete on table public.meal_plans to authenticated;
-- Nur die Merker und den Kochtag-Start; alles andere über save_meal_plan.
grant update (auto_adjusted, recipes_changed, cook_day_started_at) on table public.meal_plans to authenticated;
grant select on table public.meal_plan_items to authenticated;
grant select, delete on table public.shopping_lists to authenticated;
-- Abhaken (auch offline über die Warteschlange); alles andere über replace_shopping_list.
grant select on table public.shopping_list_items to authenticated;
grant update (checked) on table public.shopping_list_items to authenticated;
grant all on table public.meal_plans, public.meal_plan_items, public.shopping_lists, public.shopping_list_items
  to service_role;

create policy "Nutzer sehen eigene Essenspläne"
  on public.meal_plans for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer ändern Merker eigener Essenspläne"
  on public.meal_plans for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Essenspläne"
  on public.meal_plans for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Mahlzeiten"
  on public.meal_plan_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Einkaufslisten"
  on public.shopping_lists for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Einkaufslisten"
  on public.shopping_lists for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene Einträge der Einkaufsliste"
  on public.shopping_list_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer haken eigene Einträge ab"
  on public.shopping_list_items for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function private.set_updated_at();
create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- recipe_ratings: Bewertung nach dem Essen (KONZEPT 6.10, 19.7 N10). Je Person und Rezept die letzte Bewertung.
-- Privat: nur eigene Zeilen, keine Aggregation (keine View, keine Funktion), nie Analytics. Der Grund
-- „Unverträglich“ existiert hier NICHT (Art. 9) – nur taste/effort/cost/satiety und nur bei Daumen runter.
-- ---------------------------------------------------------------------------------------------------------
create table public.recipe_ratings (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id text not null references public.recipes (id) on update cascade on delete cascade,
  -- sync: RECIPE_RATING_VALUES / RECIPE_RATING_REASONS in packages/core/src/nutrition/ratings.ts
  value text not null check (value in ('up', 'down')),
  reason text check (reason in ('taste', 'effort', 'cost', 'satiety')),
  rated_on date not null,
  primary key (user_id, recipe_id),
  check (reason is null or value = 'down')
);

comment on table public.recipe_ratings is
  'Privat (19.8 Nr. 4): nur eigene Zeilen, nie angezeigt außer der eigenen Bewertung, nie aggregiert, nie Analytics/Logs.';

-- ---------------------------------------------------------------------------------------------------------
-- food_dislikes: „mag ich nicht“ je Lebensmittel (19.7 N10) – hart wie die Gruppen-Abneigungen. Bewusst OHNE
-- Zeitstempel (Wächter N10 H8: sonst ließe sich ein „Daumen runter“ ohne Grund vom selben Tag auf „Unverträglich“
-- zurückführen) und ohne Grund.
-- ---------------------------------------------------------------------------------------------------------
create table public.food_dislikes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  food_id text not null references public.foods (id) on update cascade on delete cascade,
  primary key (user_id, food_id)
);

comment on table public.food_dislikes is
  '„Mag ich nicht“ je Lebensmittel – ohne Zeitstempel und ohne Grund (Wächter N10 H8). Nur eigene Zeilen.';

create index recipe_ratings_recipe_id_idx on public.recipe_ratings (recipe_id);
create index food_dislikes_food_id_idx on public.food_dislikes (food_id);

alter table public.recipe_ratings enable row level security;
alter table public.food_dislikes enable row level security;

revoke all on table public.recipe_ratings, public.food_dislikes from anon, authenticated;
grant select, insert, update, delete on table public.recipe_ratings to authenticated;
grant select, insert, delete on table public.food_dislikes to authenticated;
grant all on table public.recipe_ratings, public.food_dislikes to service_role;

create policy "Nutzer sehen eigene Bewertungen"
  on public.recipe_ratings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer bewerten selbst (mit Profil)"
  on public.recipe_ratings for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );
create policy "Nutzer ändern eigene Bewertungen"
  on public.recipe_ratings for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Bewertungen"
  on public.recipe_ratings for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Nutzer sehen eigene abgelehnte Lebensmittel"
  on public.food_dislikes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer lehnen Lebensmittel ab (mit Profil)"
  on public.food_dislikes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
  );
create policy "Nutzer lassen Lebensmittel wieder zu"
  on public.food_dislikes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Bewertung: Datum = heute (Europe/Berlin, ±1 Tag für die Gerätezeit) – die 8 Wochen zählen ab dem Bewerten
-- (checkRecipeRatingSave in der App); höchstens RECIPE_RATING_RULES.maxRatings Bewertungen je Person.
create or replace function private.recipe_ratings_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: RECIPE_RATING_RULES.maxRatings
  max_ratings constant integer := 2000;
  today date := private.berlin_today();
begin
  if new.rated_on < today - 1 or new.rated_on > today + 1 then
    raise exception 'Bewertung nur mit dem heutigen Datum.' using errcode = 'check_violation';
  end if;
  -- Nur NEUE Bewertungen zählen (Wächter N7 H4): Beim Upsert (INSERT … ON CONFLICT) feuert dieser Trigger vor der
  -- Konfliktprüfung – eine vorhandene Bewertung lässt sich auch bei erreichter Höchstzahl ändern.
  if tg_op = 'INSERT'
     and not exists (
       select 1 from public.recipe_ratings r where r.user_id = new.user_id and r.recipe_id = new.recipe_id
     )
     and (select count(*) from public.recipe_ratings r where r.user_id = new.user_id) >= max_ratings then
    raise exception 'Zu viele Bewertungen.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function private.recipe_ratings_before_write() from public;

create trigger recipe_ratings_before_write
  before insert or update on public.recipe_ratings
  for each row execute function private.recipe_ratings_before_write();

-- Höchstens RECIPE_RATING_RULES.maxFoodDislikes abgelehnte Lebensmittel je Person (nach dem Einfügen gezählt,
-- damit auch replace_food_dislikes in einer Anweisung abgedeckt ist).
create or replace function private.food_dislikes_after_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- sync: RECIPE_RATING_RULES.maxFoodDislikes
  max_food_dislikes constant integer := 300;
begin
  if exists (
    select 1 from public.food_dislikes d
    where d.user_id in (select n.user_id from new_rows n)
    group by d.user_id
    having count(*) > max_food_dislikes
  ) then
    raise exception 'Zu viele abgelehnte Lebensmittel.' using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

revoke all on function private.food_dislikes_after_insert() from public;

create trigger food_dislikes_after_insert
  after insert on public.food_dislikes
  referencing new table as new_rows
  for each statement execute function private.food_dislikes_after_insert();
