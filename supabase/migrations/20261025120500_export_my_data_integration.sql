-- Integration 25.10.2026 (Branch claude/integration-1): Rezept-Favoriten (20261025120200_recipe_preferences.sql),
-- Vorratsschrank (20261025120300_pantry_items.sql) und Schuh-Kilometerzähler (20261025120400_shoes.sql) wurden
-- parallel entwickelt; jede dieser Migrationen definiert export_my_data() als Obermenge von
-- 20261021130200_supplement_user_data.sql plus nur die eigenen Tabellen. NUR ADDITIV: Diese letzte Fassung ist die
-- Obermenge aller drei (Grundlage: Fassung aus *_shoes.sql) und exportiert zusätzlich recipe_preferences und
-- pantry_items. jsonb_build_object nimmt höchstens 100 Argumente (= 50 Tabellen): das erste Objekt bleibt bei 50
-- Tabellen, alle neueren Tabellen stehen im zweiten Objekt (|| jsonb_build_object(…)). Zusammen 55 Tabellen.

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
      'app_layout_settings', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.app_layout_settings t where t.user_id = current_user_id),
      -- Phase 8 (Smartwatch, PLAN-PHASE-8 4): Verbindung, übernommene Einheiten, Puls-Zusammenfassungen, Tageswerte.
      'wearable_connections', (select coalesce(jsonb_agg(to_jsonb(t) order by t.provider), '[]'::jsonb) from public.wearable_connections t where t.user_id = current_user_id),
      'wearable_sessions', (select coalesce(jsonb_agg(to_jsonb(t) order by t.started_at, t.session_log_id), '[]'::jsonb) from public.wearable_sessions t where t.user_id = current_user_id),
      'heart_rate_summaries', (select coalesce(jsonb_agg(to_jsonb(t) order by t.session_log_id), '[]'::jsonb) from public.heart_rate_summaries t where t.user_id = current_user_id),
      'daily_metrics', (select coalesce(jsonb_agg(to_jsonb(t) order by t.day, t.provider), '[]'::jsonb) from public.daily_metrics t where t.user_id = current_user_id),
      -- Phase 6 SU3 (Plan 7.3): Supplement-Check und „Meine Supplements“ (Gesundheitsdaten, Art. 9).
      'supplement_screening', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.supplement_screening t where t.user_id = current_user_id),
      'user_supplements', (select coalesce(jsonb_agg(to_jsonb(t) order by t.supplement_id), '[]'::jsonb) from public.user_supplements t where t.user_id = current_user_id)
    -- jsonb_build_object nimmt höchstens 100 Argumente (= 50 Tabellen): weitere Tabellen in einem zweiten Objekt.
    ) || jsonb_build_object(
      -- Rezept-Favoriten (20261025120200_recipe_preferences.sql): „Lieblingsgericht“ und „Nie wieder“ je Rezept.
      'recipe_preferences', (select coalesce(jsonb_agg(to_jsonb(t) order by t.recipe_id), '[]'::jsonb) from public.recipe_preferences t where t.user_id = current_user_id),
      -- Vorratsschrank (20261025120300_pantry_items.sql): Lebensmittel, Menge in Kaufeinheiten, „fast leer“.
      'pantry_items', (select coalesce(jsonb_agg(to_jsonb(t) order by t.food_id), '[]'::jsonb) from public.pantry_items t where t.user_id = current_user_id),
      -- Schuh-Kilometerzähler (20261025120400_shoes.sql): Schuhe, Standard je Sportart, Wahl je Lauf.
      'shoes', (select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at, t.id), '[]'::jsonb) from public.shoes t where t.user_id = current_user_id),
      'shoe_defaults', (select coalesce(jsonb_agg(to_jsonb(t) order by t.sport, t.valid_from), '[]'::jsonb) from public.shoe_defaults t where t.user_id = current_user_id),
      'shoe_assignments', (select coalesce(jsonb_agg(to_jsonb(t) order by t.activity_key), '[]'::jsonb) from public.shoe_assignments t where t.user_id = current_user_id)
    )
  );
end;
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
