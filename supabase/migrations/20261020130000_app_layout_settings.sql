-- Übersicht und Menüleiste anpassen · Etappe E2 (docs/PLAN-EINKAUFEN-AUSDAUER.md 4, Gründer-Entscheidung EA-G2 vom
-- 20.10.2026; Bereich „Workouts“ als wählbarer Menü-Knopf, Gründer-Wunsch vom 20.10.2026). Eine Zeile je Person mit
-- der Reihenfolge/Sichtbarkeit der Kacheln und den Knöpfen der Menüleiste. KEIN Gesundheitsdatum: bleibt beim
-- Widerruf, steht im Export, Konto löschen per Kaskade. Lesen per RLS nur die eigene Zeile; Schreiben nur über
-- save_app_layout (security definer, search_path = '', REVOKE public/anon) – Prüfung = storedAppLayoutSchema und die
-- Regeln aus packages/core/src/layout.ts (ID-Listen und Grenzen per db-sync.test.ts gespiegelt).
-- Export als Obermenge der neuesten Fassung (20261020120000_shopping_product_links.sql).

create table public.app_layout_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- [{ "id": <Kachel>, "visible": <bool> }, …] (sync: APP_LAYOUT.storedTilesMax)
  dashboard_tiles jsonb not null check (
    jsonb_typeof(dashboard_tiles) = 'array' and jsonb_array_length(dashboard_tiles) <= 20
  ),
  -- [<Bereich>, …] von links nach rechts (sync: APP_LAYOUT.tabsMin/tabsMax)
  tab_bar jsonb not null check (
    jsonb_typeof(tab_bar) = 'array' and jsonb_array_length(tab_bar) between 3 and 6
  ),
  updated_at timestamptz not null default now()
);

comment on table public.app_layout_settings is
  'Anordnung der Übersicht (Kacheln) und der Menüleiste je Person (E2). Kein Gesundheitsdatum. Schreiben nur über '
  'save_app_layout.';

alter table public.app_layout_settings enable row level security;
revoke all on table public.app_layout_settings from public, anon, authenticated;
grant select on table public.app_layout_settings to authenticated;
grant all on table public.app_layout_settings to service_role;

create policy "Nutzer sehen die eigene Anordnung"
  on public.app_layout_settings for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------------------
-- save_app_layout(p_layout jsonb): genau { dashboard_tiles, tab_bar } wie storedAppLayoutSchema, nur bekannte IDs,
-- jede höchstens einmal; Menüleiste: „uebersicht“ zuerst, „mehr“ zuletzt, 3–6 Knöpfe. Ersetzt die eigene Zeile.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.save_app_layout(p_layout jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- sync: DASHBOARD_TILES, NAV_AREAS, APP_LAYOUT in packages/core (db-sync.test.ts)
  tile_ids constant text[] := array['training', 'workouts', 'nutrition', 'body', 'progress', 'endurance', 'shortcuts'];
  area_ids constant text[] := array[
    'uebersicht', 'today', 'workouts', 'ernaehrung', 'einkaufsliste', 'fortschritt', 'mehr'
  ];
  tabs_min constant integer := 3;
  tabs_max constant integer := 6;
  tiles_max constant integer := 20;
  current_user_id uuid := auth.uid();
  tiles jsonb;
  tabs jsonb;
  entry jsonb;
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.profiles p where p.user_id = current_user_id) then
    raise exception 'Profil fehlt.' using errcode = 'insufficient_privilege';
  end if;
  if jsonb_typeof(p_layout) is distinct from 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_layout) k)
        is distinct from array['dashboard_tiles', 'tab_bar'] then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  tiles := p_layout -> 'dashboard_tiles';
  tabs := p_layout -> 'tab_bar';
  if jsonb_typeof(tiles) is distinct from 'array' or jsonb_array_length(tiles) > tiles_max
     or jsonb_typeof(tabs) is distinct from 'array'
     or jsonb_array_length(tabs) not between tabs_min and tabs_max then
    raise exception 'Ungültige Anordnung.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tiles) loop
    if jsonb_typeof(entry) is distinct from 'object'
       or (select array_agg(k order by k) from jsonb_object_keys(entry) k) is distinct from array['id', 'visible']
       or jsonb_typeof(entry -> 'id') is distinct from 'string'
       or jsonb_typeof(entry -> 'visible') is distinct from 'boolean'
       or not ((entry ->> 'id') = any (tile_ids)) then
      raise exception 'Ungültige Kachel.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e ->> 'id') from jsonb_array_elements(tiles) e) <> jsonb_array_length(tiles) then
    raise exception 'Kachel doppelt.' using errcode = 'invalid_parameter_value';
  end if;
  for entry in select value from jsonb_array_elements(tabs) loop
    if jsonb_typeof(entry) is distinct from 'string' or not ((entry #>> '{}') = any (area_ids)) then
      raise exception 'Ungültiger Bereich.' using errcode = 'invalid_parameter_value';
    end if;
  end loop;
  if (select count(distinct e #>> '{}') from jsonb_array_elements(tabs) e) <> jsonb_array_length(tabs)
     or tabs ->> 0 is distinct from 'uebersicht'
     or tabs ->> (jsonb_array_length(tabs) - 1) is distinct from 'mehr' then
    raise exception 'Ungültige Menüleiste.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.app_layout_settings (user_id, dashboard_tiles, tab_bar, updated_at)
  values (current_user_id, tiles, tabs, now())
  on conflict (user_id) do update
    set dashboard_tiles = excluded.dashboard_tiles, tab_bar = excluded.tab_bar, updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_app_layout(jsonb) from public, anon;
grant execute on function public.save_app_layout(jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Datenexport (Obermenge der neuesten Fassung): zusätzlich app_layout_settings.
-- ---------------------------------------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Nicht angemeldet.' using errcode = 'insufficient_privilege';
  end if;
  return jsonb_build_object(
    'format_version', 1,
    'exported_at', now(),
    'user_id', current_user_id,
    'data', jsonb_build_object(
      'profiles', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id = current_user_id),
      'consents', (select coalesce(jsonb_agg(to_jsonb(t) order by t.granted_at), '[]'::jsonb) from public.consents t where t.user_id = current_user_id),
      'body_metrics', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_metrics t where t.user_id = current_user_id),
      'body_measurements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.body_measurements t where t.user_id = current_user_id),
      'measurement_reminders', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.measurement_reminders t where t.user_id = current_user_id),
      'health_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.health_screening t where t.user_id = current_user_id),
      'goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id = current_user_id),
      'user_equipment', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_equipment t where t.user_id = current_user_id),
      'training_slots', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.training_slots t where t.user_id = current_user_id),
      'nutrition_prefs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.nutrition_prefs t where t.user_id = current_user_id),
      'food_preferences', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_preferences t where t.user_id = current_user_id),
      'admin_users', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.admin_users t where t.user_id = current_user_id),
      'user_plans', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.user_plans t where t.user_id = current_user_id),
      'planned_sessions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_sessions t where t.user_id = current_user_id),
      'planned_exercises', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.planned_exercises t where t.user_id = current_user_id),
      'session_logs', (select coalesce(jsonb_agg(to_jsonb(t) order by t.performed_on), '[]'::jsonb) from public.session_logs t where t.user_id = current_user_id),
      'exercise_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_logs t where t.user_id = current_user_id),
      'set_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.set_logs t where t.user_id = current_user_id),
      'cardio_logs', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.cardio_logs t where t.user_id = current_user_id),
      'exercise_start_weights', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.exercise_start_weights t where t.user_id = current_user_id),
      'meal_plans', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.meal_plans t where t.user_id = current_user_id),
      'meal_plan_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.date, t.slot), '[]'::jsonb) from public.meal_plan_items t where t.user_id = current_user_id),
      'shopping_lists', (select coalesce(jsonb_agg(to_jsonb(t) order by t.week_start), '[]'::jsonb) from public.shopping_lists t where t.user_id = current_user_id),
      'shopping_list_items', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.shopping_list_items t where t.user_id = current_user_id),
      'recipe_ratings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.recipe_ratings t where t.user_id = current_user_id),
      'food_dislikes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.food_dislikes t where t.user_id = current_user_id),
      'food_log_entries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.eaten_on, t.created_at), '[]'::jsonb) from public.food_log_entries t where t.user_id = current_user_id),
      'food_log_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.food_log_favorites t where t.user_id = current_user_id),
      'custom_meals', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.custom_meals t where t.user_id = current_user_id),
      'custom_meal_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.meal_id, t.order_no), '[]'::jsonb) from public.custom_meal_items t where t.user_id = current_user_id),
      'competitions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.race_date, t.created_at), '[]'::jsonb) from public.competitions t where t.user_id = current_user_id),
      -- Etappe E3: KI-Nutzung (nur Metadaten) und die eigene Beta-Freischaltung (private Tabelle, ohne granted_by).
      'ai_usage', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.ai_usage t where t.user_id = current_user_id),
      'beta_entitlements', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from private.my_beta_entitlements() t),
      -- Wächter E3 N4: Protokoll der eigenen Freischaltungen/Entzüge (ohne Admin-Identität `actor`).
      'admin_actions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_admin_actions() t),
      -- Phase 10 S1: eigene Strecken (vereinfachte Linie, Kilometerzeiten; GPX je Strecke erzeugt die App).
      'tracked_routes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.created_at), '[]'::jsonb) from public.tracked_routes t where t.user_id = current_user_id),
      -- Etappe E4a: eigene Produkte und die eigenen Abfrage-Zähler (Stunde, Anzahl – ohne Nummern). Der gemeinsame
      -- Zwischenspeicher food_products gehört niemandem und kommt nicht in den Export.
      'user_food_products', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.user_food_products t where t.user_id = current_user_id),
      'food_product_lookup_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_food_product_lookup_counts() t),
      -- Ziele Z3: Wunschgewicht (Gesundheitsdatum; das Nebenziel steht als Spalte in goals).
      'weight_goals', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.weight_goals t where t.user_id = current_user_id),
      -- Phase 4b Etappe B (PLAN-PHASE-4B 4.7): Plan-Anpassungen, offene Ereignisse der Live-Anpassung (Auslöser und
      -- Zeitpunkte, ohne Verweise) und die eigenen Zähler der Ratenbegrenzung (private Tabellen, Art. 15). Die eigene
      -- Beta-Freischaltung steht seit E3 unter beta_entitlements.
      'plan_adjustments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.plan_adjustments t where t.user_id = current_user_id),
      'adjustment_events', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from private.my_adjustment_events() t),
      'live_adjust_hourly_counts', (select coalesce(jsonb_agg(to_jsonb(t) order by t.hour_start), '[]'::jsonb) from private.my_live_adjust_hourly_counts() t),
      -- Einkaufen E1 (PLAN-EINKAUFEN-AUSDAUER 3): gelernte Zuordnungen Strichcode → Lebensmittel.
      'shopping_product_links', (select coalesce(jsonb_agg(to_jsonb(t) order by t.updated_at, t.code), '[]'::jsonb) from public.shopping_product_links t where t.user_id = current_user_id),
      -- Etappe E2 (PLAN-EINKAUFEN-AUSDAUER 4): Anordnung der Übersicht und der Menüleiste.
      'app_layout_settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_layout_settings t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
