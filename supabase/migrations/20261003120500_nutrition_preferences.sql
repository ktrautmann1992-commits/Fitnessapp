-- Phase 1 · Ernährung: Ernährungsform und Kochmodus (nutrition_prefs), Vorlieben/Unverträglichkeiten
-- (food_preferences). Grenzwerte = packages/core/src/constants.ts, Lebensmittel-Gruppen = FOOD_GROUPS in
-- packages/core/src/food-groups.ts (Verknüpfung mit einer Lebensmittel-Tabelle folgt in Phase 5).

-- ---------------------------------------------------------------------------------------------------------
-- nutrition_prefs: eine Zeile pro Nutzer. Kochmodus kommt erst im Folgeschritt, daher optional.
-- ---------------------------------------------------------------------------------------------------------
create table public.nutrition_prefs (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  diet_type public.diet_type not null,
  -- Nur bei omnivorer Ernährung sinnvoll; vegetarisch/vegan schließt Schwein aus.
  eats_pork boolean,
  meals_per_day smallint check (meals_per_day between 1 and 8),
  cooking_mode public.cooking_mode,
  -- Meal-Prep-Tage pro Woche: nur beim Kochmodus meal_prep, dann 1–7.
  mealprep_days smallint check (mealprep_days between 1 and 7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (diet_type = 'omnivore' or eats_pork is distinct from true),
  check (coalesce(cooking_mode = 'meal_prep', false) = (mealprep_days is not null))
);

alter table public.nutrition_prefs enable row level security;

revoke all on table public.nutrition_prefs from anon, authenticated;
grant select, insert, update, delete on table public.nutrition_prefs to authenticated;
grant all on table public.nutrition_prefs to service_role;

create policy "Nutzer sehen eigene Ernährungsangaben"
  on public.nutrition_prefs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer legen eigene Ernährungsangaben an"
  on public.nutrition_prefs for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.user_id = (select auth.uid())));
create policy "Nutzer ändern eigene Ernährungsangaben"
  on public.nutrition_prefs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Nutzer löschen eigene Ernährungsangaben"
  on public.nutrition_prefs for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger nutrition_prefs_set_updated_at
  before update on public.nutrition_prefs
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------------------
-- food_preferences: mag / mag nicht / Unverträglichkeit je Lebensmittel-Gruppe.
-- Unverträglichkeiten sind Gesundheitsdaten → nur mit Einwilligung health_data, Löschung beim Widerruf.
-- ---------------------------------------------------------------------------------------------------------
create table public.food_preferences (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Liste muss FOOD_GROUPS in packages/core/src/food-groups.ts entsprechen (Test prüft das).
  food_group text not null check (
    food_group in (
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
    )
  ),
  kind public.food_preference_kind not null,
  created_at timestamptz not null default now(),
  primary key (user_id, food_group, kind)
);

comment on table public.food_preferences is
  'kind = intolerance ist SENSIBEL (Art. 9 DSGVO): nur mit Einwilligung health_data, Löschung beim Widerruf.';

-- „mag“ und „mag nicht“ schließen sich je Gruppe aus.
create unique index food_preferences_like_xor_dislike_idx
  on public.food_preferences (user_id, food_group)
  where kind in ('like', 'dislike');

alter table public.food_preferences enable row level security;

revoke all on table public.food_preferences from anon, authenticated;
grant select, insert, update, delete on table public.food_preferences to authenticated;
grant all on table public.food_preferences to service_role;

create policy "Nutzer sehen eigene Lebensmittel-Vorlieben"
  on public.food_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Nutzer speichern Vorlieben (Unverträglichkeit nur mit Einw.)"
  on public.food_preferences for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.user_id = (select auth.uid()))
    and (kind <> 'intolerance' or public.has_valid_consent('health_data'))
  );
create policy "Nutzer ändern Vorlieben (Unverträglichkeit nur mit Einw.)"
  on public.food_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (kind <> 'intolerance' or public.has_valid_consent('health_data'))
  );
create policy "Nutzer löschen eigene Lebensmittel-Vorlieben"
  on public.food_preferences for delete to authenticated
  using (user_id = (select auth.uid()));
