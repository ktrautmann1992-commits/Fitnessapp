import {
  DATA_EXPORT_FORMAT_VERSION,
  type DataExportTable,
  type MealPlanWeek,
  type PendingDbExportTable,
  type WearableRows,
} from '@fitnessapp/core';

import type { MealPlanRow, UserRows } from './types';

/**
 * Testmodus: Datenexport aus dem Gerätespeicher in DERSELBEN Form wie export_my_data() (docs/PLAN-PHASE-4.md 3.7) –
 * gleiche Tabellen-Schlüssel (der Typ erzwingt alle aus DATA_EXPORT_TABLES und PENDING_DB_EXPORT_TABLES), Zeilen wie
 * gespeichert. Danach prüft
 * buildDataExportFile() (packages/core) beide Wege gleich. Nur Abbildung.
 */
export function localDataExport(
  rows: UserRows,
  userId: string,
  exportedAt: string,
  /** Testmodus: Gericht per Foto (E3) – Metadaten wie ai_usage (liegen außerhalb von UserRows im Gerätespeicher). */
  extra: {
    aiUsage?: readonly unknown[];
    /** Testmodus: Zähler der Produktabfrage (E4a) – Stunde und Anzahl, ohne Nummern. */
    productLookups?: readonly { hour_start: string; lookups: number }[];
    /** Testmodus: Anpassungen der Live-Anpassung (geschützter Speicher, Etappe 4b D; 4.7). */
    planAdjustments?: readonly unknown[];
    /** Testmodus: eigene Strecken (Etappe E4, Spalten wie tracked_routes). */
    trackedRoutes?: readonly { started_at: string; created_at: string }[];
    /** Testmodus: Smartwatch-Daten (Phase 8, Spalten wie die vier Tabellen). */
    wearables?: WearableRows;
    /** Testmodus: Supplement-Check und „Meine Supplements“ (Phase 6 SU3/SU4, Spalten wie die Tabellen). */
    supplementScreening?: readonly unknown[];
    userSupplements?: readonly unknown[];
  } = {},
): {
  format_version: number;
  exported_at: string;
  user_id: string;
  data: Record<DataExportTable | PendingDbExportTable, unknown[]>;
} {
  const one = <T>(row: T | null): T[] => (row === null ? [] : [row]);
  const data: Record<DataExportTable | PendingDbExportTable, unknown[]> = {
    profiles: one(rows.profile),
    consents: [...rows.consents].sort((a, b) => a.granted_at.localeCompare(b.granted_at)),
    body_metrics: rows.bodyMetrics,
    body_measurements: rows.bodyMeasurements,
    measurement_reminders: one(rows.reminder),
    health_screening: rows.healthScreenings,
    goals: one(rows.goals),
    user_equipment: rows.userEquipment,
    training_slots: rows.trainingSlots,
    // Testmodus (Etappe N4): Antworten des Schritts nutrition_setup als Spalten von nutrition_prefs – genau so, wie
    // export_my_data() sie ab Etappe N7 liefert (docs/PLAN-PHASE-5.md 7.3).
    nutrition_prefs: nutritionPrefsExport(rows),
    food_preferences: rows.foodPreferences,
    // Im Testmodus gibt es keine Redaktions-Rechte.
    admin_users: [],
    user_plans: rows.plans,
    planned_sessions: rows.plannedSessions,
    planned_exercises: rows.plannedExercises,
    session_logs: [...rows.sessionLogs].sort((a, b) =>
      a.performed_on.localeCompare(b.performed_on),
    ),
    exercise_logs: rows.exerciseLogs,
    set_logs: rows.setLogs,
    cardio_logs: rows.cardioLogs,
    exercise_start_weights: rows.startWeights,
    // Essenspläne (Etappe N5) – Spalten wie meal_plans/meal_plan_items (Datenbank seit N7, 20261014120500_meal_plans.sql).
    // Testmodus: Jede Zeile hat den vollständigen Plan (nur der Supabase-Modus kennt Zeilen ohne ihn – dort exportiert der
    // Server, export_my_data).
    meal_plans: localMealPlans(rows).map(({ row, plan }) => ({
      id: row.id,
      user_id: row.user_id,
      week_start: row.week_start,
      status: 'active',
      engine_version: plan.engineVersion,
      variant: plan.variant,
      uses_health_data: row.uses_health_data,
      meal_prep_plan_id: plan.mealPrepPlanId,
      created_at: row.created_at,
      auto_adjusted: row.auto_adjusted,
      recipes_changed: row.recipes_changed,
      cook_day_started_at: row.cook_day_started_at,
      // Testmodus: Gespeichert ist der ganze Schnappschuss (u. a. Planband je Tag, Abgleich-Schlüssel mit Modus und
      // Ausschlüssen, Zutaten in Gramm, leere Plätze, Hinweise) – Art. 15 verlangt alles Gespeicherte (Wächter N5a S4).
      // Ab N7 speichert die Datenbank weder Planband noch Abgleich-Schlüssel.
      plan_snapshot: plan,
    })),
    meal_plan_items: localMealPlans(rows).flatMap(({ row, plan }) =>
      plan.days.flatMap((day) =>
        day.meals.map((meal) => ({
          plan_id: row.id,
          user_id: row.user_id,
          date: day.date,
          slot: meal.slot,
          role: meal.role,
          recipe_id: meal.recipeId,
          recipe_version: meal.recipeVersion,
          title_de: meal.titleDe,
          factor: meal.factor,
          kcal: meal.nutrients.kcal,
          protein_g: meal.nutrients.protein_g,
          carbs_g: meal.nutrients.carbs_g,
          fat_g: meal.nutrients.fat_g,
          substitutions: meal.substitutions.map((s) => ({
            index: s.index,
            food_id: s.foodId,
            substitute_food_id: s.substituteFoodId,
          })),
          omitted_optional: meal.omittedOptional.map((o) => ({
            index: o.index,
            food_id: o.foodId,
          })),
          // Zutaten-Austausch (Etappe N9): Spalte wie `ingredient_swaps` der Payload.
          ingredient_swaps: (meal.ingredientSwaps ?? []).map((x) => ({
            index: x.index,
            food_id: x.foodId,
            substitute_food_id: x.substituteFoodId,
          })),
          is_fill: meal.isFill,
          prep_kind: meal.prepKind,
          cook_date: meal.cookDate,
          storage: meal.storage,
          meal_prep_plan_id: meal.mealPrepPlanId,
          day_status: day.status,
        })),
      ),
    ),
    // Einkaufslisten (Etappe N5b) – Spalten wie shopping_lists/shopping_list_items aus docs/PLAN-PHASE-5.md 7.2 (N7),
    // dazu Zeitraum-Schlüssel, „Zur Einkaufsliste“-Rezepte und Markierungen (Art. 15: alles Gespeicherte).
    shopping_lists: rows.shoppingLists.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      meal_plan_id: rows.mealPlans.find((p) => p.week_start === row.week_start)?.id ?? null,
      week_start: row.week_start,
      from_date: row.list.from,
      to_date: row.list.to,
      uses_health_data: row.uses_health_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
      plan_key: row.list.planKey,
      added_recipes: row.list.recipes.map((r) => ({
        recipe_id: r.recipeId,
        servings: r.servings,
      })),
    })),
    shopping_list_items: rows.shoppingLists.flatMap((row) =>
      row.list.items.map((item) => ({
        list_id: row.id,
        user_id: row.user_id,
        item_key: item.itemKey,
        food_id: item.foodId,
        label_de: item.labelDe,
        amount: item.amount,
        unit: item.unit,
        category: item.category,
        is_pantry: item.isPantry,
        is_manual: item.isManual,
        checked: item.checked,
        substitute_for: item.substituteFor,
        amount_changed: item.amountChanged,
        not_in_plan: item.notInPlan,
        updated_at: row.updated_at,
      })),
    ),
    // Bewertungen nach dem Essen und „mag ich nicht“ je Lebensmittel (Etappe N10) – Spalten wie recipe_ratings/
    // food_dislikes aus docs/PLAN-PHASE-5.md 19.4 (N7). Ohne Grund „Unverträglich“ (wird nie gespeichert).
    recipe_ratings: rows.recipeRatings,
    food_dislikes: rows.foodDislikes,
    // Ernährungstagebuch und Favoriten (Etappe E1) – Spalten wie food_log_entries/food_log_favorites.
    food_log_entries: [...rows.foodLogEntries].sort(
      (a, b) => a.eaten_on.localeCompare(b.eaten_on) || a.created_at.localeCompare(b.created_at),
    ),
    food_log_favorites: [...rows.foodLogFavorites].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
    // Eigene Gerichte und Zutaten (Etappe E2) – Spalten wie custom_meals/custom_meal_items.
    custom_meals: [...rows.customMeals].sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    ),
    custom_meal_items: [...rows.customMealItems].sort(
      (a, b) => a.meal_id.localeCompare(b.meal_id) || a.order_no - b.order_no,
    ),
    // Wettkämpfe (Phase 10 WP3) – Spalten wie competitions, sortiert wie export_my_data() (Renntag, Anlage).
    competitions: [...rows.competitions].sort(
      (a, b) => a.race_date.localeCompare(b.race_date) || a.created_at.localeCompare(b.created_at),
    ),
    // Gericht per Foto (Etappe E3): nur Metadaten je Auswertung; im Testmodus gibt es keine Beta-Freischaltung.
    ai_usage: [...(extra.aiUsage ?? [])],
    beta_entitlements: [],
    admin_actions: [],
    // Strecken (Etappe E4) – Spalten wie tracked_routes, sortiert wie export_my_data() (Beginn, Anlage).
    tracked_routes: [...(extra.trackedRoutes ?? [])].sort(
      (a, b) =>
        a.started_at.localeCompare(b.started_at) || a.created_at.localeCompare(b.created_at),
    ),
    // Etappe E4a: eigene Produkte (Spalten wie user_food_products) und die Zähler der Produktabfrage (Stunde, Anzahl –
    // ohne Nummern, wie private.my_food_product_lookup_counts()). Der Zwischenspeicher gehört niemandem.
    user_food_products: [...rows.userFoodProducts].sort(
      (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
    ),
    food_product_lookup_counts: [...(extra.productLookups ?? [])]
      .map((c) => ({ hour_start: c.hour_start, lookups: c.lookups }))
      .sort((a, b) => a.hour_start.localeCompare(b.hour_start)),
    // Wunschgewicht (Etappe Z3) – Spalten wie weight_goals.
    weight_goals: one(rows.weightGoal),
    // Live-Anpassung (4b, 4.7): Anpassungen aus dem geschützten Speicher (Etappe D); Ereignisse und Zähler der
    // Ratenbegrenzung gibt es nur auf dem Server (Etappe B) – im Testmodus leer.
    plan_adjustments: [...(extra.planAdjustments ?? [])],
    adjustment_events: [],
    live_adjust_hourly_counts: [],
    // Einkaufen E1: gelernte Zuordnungen Strichcode → Lebensmittel (Spalten wie shopping_product_links).
    shopping_product_links: [...rows.shoppingProductLinks].sort(
      (a, b) => a.updated_at.localeCompare(b.updated_at) || a.code.localeCompare(b.code),
    ),
    // Etappe E2: Anordnung der Übersicht und der Menüleiste (Spalten wie app_layout_settings).
    app_layout_settings: one(rows.appLayout),
    // Smartwatch (Phase 8) – Spalten und Sortierung wie export_my_data().
    wearable_connections: one(extra.wearables?.connection ?? null),
    wearable_sessions: [...(extra.wearables?.sessions ?? [])].sort(
      (a, b) =>
        a.started_at.localeCompare(b.started_at) ||
        a.session_log_id.localeCompare(b.session_log_id),
    ),
    heart_rate_summaries: [...(extra.wearables?.heartRates ?? [])].sort((a, b) =>
      a.session_log_id.localeCompare(b.session_log_id),
    ),
    daily_metrics: [...(extra.wearables?.dailyMetrics ?? [])].sort((a, b) =>
      a.day.localeCompare(b.day),
    ),
    // Phase 6 SU3/SU4: Supplement-Check und „Meine Supplements“ (Gesundheitsdaten, Testmodus aus dem Gerätespeicher).
    supplement_screening: [...(extra.supplementScreening ?? [])],
    user_supplements: [...(extra.userSupplements ?? [])],
    // Rezept-Favoriten (25.10.2026): Herz und „Nie wieder“ je Rezept – Spalten wie recipe_preferences.
    recipe_preferences: [...rows.recipePreferences].sort((a, b) =>
      a.recipe_id.localeCompare(b.recipe_id),
    ),
    // Übungs-Präferenzen (Etappe T2) – in export_my_data() erst mit Etappe T3 (PENDING_DB_EXPORT_TABLES).
    exercise_preferences: rows.exercisePreferences,
  };
  return {
    format_version: DATA_EXPORT_FORMAT_VERSION,
    exported_at: exportedAt,
    user_id: userId,
    data,
  };
}

function nutritionPrefsExport(rows: UserRows): unknown[] {
  const setup = rows.nutritionSetup;
  if (rows.nutritionPrefs === null) {
    return setup === null ? [] : [setup];
  }
  if (setup === null) return [rows.nutritionPrefs];
  return [
    {
      ...rows.nutritionPrefs,
      activity_level: setup.activity_level,
      training_time: setup.training_time,
      mealprep_slots: setup.mealprep_slots,
      show_energy_numbers: setup.show_energy_numbers,
    },
  ];
}

/** Pläne mit vollständigem Plan (Testmodus: alle). */
function localMealPlans(rows: UserRows): { row: MealPlanRow; plan: MealPlanWeek }[] {
  return rows.mealPlans.flatMap((row) => (row.plan === null ? [] : [{ row, plan: row.plan }]));
}
