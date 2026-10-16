import {
  BARBELL_ID,
  contentIdSchema,
  exercisePreferenceSchema,
  CUSTOM_MEAL_LIMITS,
  customMealSchema,
  FOOD_LOG_LIMITS,
  foodLogEntrySchema,
  foodLogFavoriteSchema,
  RECIPE_RATING_RULES,
  recipeRatingSchema,
  nutritionSetupColumnsSchema,
  parseMealPlanRecord,
  parseStoredMealPlanWeek,
  parseStoredShoppingList,
  BARBELL_PLATE_MAX_KG,
  scheduleFromLegacyGoals,
  type TrainingLocation,
} from '@fitnessapp/core';

import { toTrainingSlotRows } from './mapping';
import type {
  CustomMealItemRow,
  CustomMealRow,
  ExercisePreferenceRow,
  FoodDislikeRow,
  FoodLogEntryRow,
  FoodLogFavoriteRow,
  RecipeRatingRow,
  GoalsRow,
  MealPlanRow,
  ShoppingListRow,
  NutritionSetupRow,
  UserEquipmentRow,
  UserRows,
} from './types';

/**
 * Schritt nutrition_setup (Etappe N4): vorher gab es ihn nicht; der Gerätespeicher ist nicht vertrauenswürdig – nur
 * ein gültiger Eintrag (Zod, strikt) des eigenen Kontos bleibt, sonst null (Schritt wird erneut gefragt).
 */
function storedNutritionSetup(stored: UserRows): NutritionSetupRow | null {
  const value: unknown = (stored as { nutritionSetup?: unknown }).nutritionSetup;
  if (typeof value !== 'object' || value === null) return null;
  const { user_id: userId, ...rest } = value as Record<string, unknown>;
  const parsed = nutritionSetupColumnsSchema.safeParse(rest);
  const owner = stored.profile?.user_id;
  return parsed.success && typeof userId === 'string' && (owner === undefined || userId === owner)
    ? { ...parsed.data, user_id: userId }
    : null;
}

/**
 * Essenspläne (Etappe N5): vorher gab es keine; der Gerätespeicher ist nicht vertrauenswürdig – nur vollständige Pläne
 * der aktuellen Engine-Version (`parseStoredMealPlanWeek`, Zod strikt) des eigenen Kontos, je Woche höchstens einer.
 * Ein ungültiger Plan wird verworfen und beim Öffnen neu erstellt (sichere Richtung: der neue Plan nutzt die
 * aktuellen Angaben). Supabase-Modus (N7 Teil 2): eine Zeile darf statt des vollständigen Plans nur die Zeilen der
 * Datenbank tragen (`record`, ebenfalls erneut geprüft, `parseMealPlanRecord`).
 */
function storedMealPlans(stored: UserRows): MealPlanRow[] {
  const list: unknown = (stored as { mealPlans?: unknown }).mealPlans;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list.flatMap((item: unknown): MealPlanRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const plan = parseStoredMealPlanWeek(row.plan);
    const record = row.record === undefined ? null : parseMealPlanRecord(row.record);
    const weekStart = plan?.weekStart ?? record?.payload.week_start ?? null;
    if (
      (plan === null && record === null) ||
      weekStart === null ||
      (plan !== null && record !== null && plan.weekStart !== record.payload.week_start) ||
      typeof row.id !== 'string' ||
      typeof row.user_id !== 'string' ||
      (owner !== undefined && row.user_id !== owner) ||
      row.week_start !== weekStart ||
      seen.has(weekStart) ||
      typeof row.created_at !== 'string' ||
      typeof row.auto_adjusted !== 'boolean'
    ) {
      return [];
    }
    seen.add(weekStart);
    return [
      {
        id: row.id,
        user_id: row.user_id,
        week_start: weekStart,
        // Gesundheitsbezug steht im Plan selbst (die Zeile kann ihn nicht abschwächen) – im Supabase-Modus zusätzlich
        // der Wert des Servers (sichere Richtung: ODER).
        uses_health_data:
          plan?.usesHealthData === true ||
          record?.usesHealthData === true ||
          (record !== null && row.uses_health_data === true),
        created_at: row.created_at,
        auto_adjusted: row.auto_adjusted,
        // Vor Etappe N5b gab es beide Felder nicht.
        recipes_changed: row.recipes_changed === true,
        cook_day_started_at: isTimestamp(row.cook_day_started_at) ? row.cook_day_started_at : null,
        plan,
        ...(record === null ? {} : { record }),
      },
    ];
  });
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));
}

/**
 * Einkaufslisten (Etappe N5b): vorher gab es keine; nur gültige Listen (`parseStoredShoppingList`, Zod strikt) des
 * eigenen Kontos, je Woche höchstens eine. Gesundheitsbezug steht in der Liste selbst.
 */
function storedShoppingLists(stored: UserRows): ShoppingListRow[] {
  const list: unknown = (stored as { shoppingLists?: unknown }).shoppingLists;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list.flatMap((item: unknown): ShoppingListRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    const parsed = parseStoredShoppingList(row.list);
    if (
      parsed === null ||
      typeof row.id !== 'string' ||
      typeof row.user_id !== 'string' ||
      (owner !== undefined && row.user_id !== owner) ||
      row.week_start !== parsed.weekStart ||
      seen.has(parsed.weekStart) ||
      !isTimestamp(row.created_at) ||
      !isTimestamp(row.updated_at)
    ) {
      return [];
    }
    seen.add(parsed.weekStart);
    return [
      {
        id: row.id,
        user_id: row.user_id,
        week_start: parsed.weekStart,
        uses_health_data: parsed.usesHealthData,
        created_at: row.created_at,
        updated_at: row.updated_at,
        list: parsed,
      },
    ];
  });
}

function storedPreferences(stored: UserRows): ExercisePreferenceRow[] {
  const list: unknown = (stored as { exercisePreferences?: unknown }).exercisePreferences;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  return list.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { user_id: userId, ...rest } = item as Record<string, unknown>;
    const parsed = exercisePreferenceSchema.safeParse(rest);
    return parsed.success && typeof userId === 'string' && (owner === undefined || userId === owner)
      ? [{ ...parsed.data, user_id: userId }]
      : [];
  });
}

/**
 * Bewertungen (Etappe N10): vorher gab es keine; der Gerätespeicher ist nicht vertrauenswürdig – nur gültige Einträge
 * (Zod, strikt: Gründe ohne „Unverträglich“, Grund nur bei Daumen runter) des eigenen Kontos, je Rezept höchstens einer,
 * höchstens `RECIPE_RATING_RULES.maxRatings`.
 */
function storedRecipeRatings(stored: UserRows): RecipeRatingRow[] {
  const list: unknown = (stored as { recipeRatings?: unknown }).recipeRatings;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list
    .flatMap((item: unknown): RecipeRatingRow[] => {
      if (typeof item !== 'object' || item === null) return [];
      const row = item as Record<string, unknown>;
      const keys = Object.keys(row).sort().join(',');
      if (keys !== 'rated_on,reason,recipe_id,user_id,value') return [];
      const parsed = recipeRatingSchema.safeParse({
        recipeId: row.recipe_id,
        value: row.value,
        reason: row.reason,
        ratedOn: row.rated_on,
      });
      const userId = row.user_id;
      if (
        !parsed.success ||
        typeof userId !== 'string' ||
        (owner !== undefined && userId !== owner) ||
        seen.has(parsed.data.recipeId)
      ) {
        return [];
      }
      seen.add(parsed.data.recipeId);
      return [
        {
          user_id: userId,
          recipe_id: parsed.data.recipeId,
          value: parsed.data.value,
          reason: parsed.data.reason,
          rated_on: parsed.data.ratedOn,
        },
      ];
    })
    .slice(0, RECIPE_RATING_RULES.maxRatings);
}

/** „Mag ich nicht“ je Lebensmittel (Etappe N10): nur gültige IDs des eigenen Kontos, je Lebensmittel einmal. */
function storedFoodDislikes(stored: UserRows): FoodDislikeRow[] {
  const list: unknown = (stored as { foodDislikes?: unknown }).foodDislikes;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list
    .flatMap((item: unknown): FoodDislikeRow[] => {
      if (typeof item !== 'object' || item === null) return [];
      const row = item as Record<string, unknown>;
      const id = contentIdSchema.safeParse(row.food_id);
      const userId = row.user_id;
      if (
        Object.keys(row).length !== 2 ||
        !id.success ||
        typeof userId !== 'string' ||
        (owner !== undefined && userId !== owner) ||
        seen.has(id.data)
      ) {
        return [];
      }
      seen.add(id.data);
      return [{ user_id: userId, food_id: id.data }];
    })
    .slice(0, RECIPE_RATING_RULES.maxFoodDislikes);
}

/**
 * Ernährungstagebuch (Etappe E1): vorher gab es keins; der Gerätespeicher ist nicht vertrauenswürdig – nur gültige
 * Einträge (Zod, strikt: `foodLogEntrySchema` plus Server-Felder) des eigenen Kontos, je id einer.
 */
function storedFoodLogEntries(stored: UserRows): FoodLogEntryRow[] {
  const list: unknown = (stored as { foodLogEntries?: unknown }).foodLogEntries;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list.flatMap((item: unknown): FoodLogEntryRow[] => {
    if (typeof item !== 'object' || item === null) return [];
    const {
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...rest
    } = item as Record<string, unknown>;
    // Vor Etappe E2 gab es custom_meal_id nicht (= kein Verweis).
    const parsed = foodLogEntrySchema.safeParse({ custom_meal_id: null, ...rest });
    if (
      !parsed.success ||
      typeof userId !== 'string' ||
      (owner !== undefined && userId !== owner) ||
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      typeof lastWriteId !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string' ||
      seen.has(parsed.data.id)
    ) {
      return [];
    }
    seen.add(parsed.data.id);
    return [
      {
        ...parsed.data,
        user_id: userId,
        revision,
        last_write_id: lastWriteId,
        created_at: createdAt,
        updated_at: updatedAt,
      },
    ];
  });
}

/** Favoriten des Tagebuchs (Etappe E1): nur gültige des eigenen Kontos, je Schlüssel einer, höchstens 100. */
function storedFoodLogFavorites(stored: UserRows): FoodLogFavoriteRow[] {
  const list: unknown = (stored as { foodLogFavorites?: unknown }).foodLogFavorites;
  if (!Array.isArray(list)) return [];
  const owner = stored.profile?.user_id;
  const seen = new Set<string>();
  return list
    .flatMap((item: unknown): FoodLogFavoriteRow[] => {
      if (typeof item !== 'object' || item === null) return [];
      const { user_id: userId, created_at: createdAt, ...rest } = item as Record<string, unknown>;
      const parsed = foodLogFavoriteSchema.safeParse(rest);
      if (
        !parsed.success ||
        typeof userId !== 'string' ||
        (owner !== undefined && userId !== owner) ||
        typeof createdAt !== 'string' ||
        seen.has(parsed.data.fav_key)
      ) {
        return [];
      }
      seen.add(parsed.data.fav_key);
      return [{ ...parsed.data, user_id: userId, created_at: createdAt }];
    })
    .slice(0, FOOD_LOG_LIMITS.maxFavorites);
}

/**
 * Eigene Gerichte (Etappe E2): vorher gab es keine; der Gerätespeicher ist nicht vertrauenswürdig – nur gültige
 * Gerichte (Zod, strikt: `customMealSchema` mit ihren Zutaten) des eigenen Kontos, je id eines, höchstens 100. Zutaten
 * nur zu einem gültigen Gericht. Tagebuch-Verweise auf ein verworfenes Gericht werden leer (wie on delete set null).
 */
function storedCustomMeals(
  stored: UserRows,
  entries: FoodLogEntryRow[],
): Pick<UserRows, 'customMeals' | 'customMealItems' | 'foodLogEntries'> {
  const list: unknown = (stored as { customMeals?: unknown }).customMeals;
  const itemList: unknown = (stored as { customMealItems?: unknown }).customMealItems;
  const owner = stored.profile?.user_id;
  const items = Array.isArray(itemList) ? itemList : [];
  const meals: CustomMealRow[] = [];
  const mealItems: CustomMealItemRow[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(list) ? list : []) {
    if (meals.length >= CUSTOM_MEAL_LIMITS.maxMeals) break;
    if (typeof item !== 'object' || item === null) continue;
    const {
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
      ...rest
    } = item as Record<string, unknown>;
    const own = items
      .filter(
        (i: unknown): i is Record<string, unknown> =>
          typeof i === 'object' && i !== null && (i as { meal_id?: unknown }).meal_id === rest.id,
      )
      .sort((a, b) => Number(a.order_no) - Number(b.order_no));
    const parsed = customMealSchema.safeParse({
      ...rest,
      items: own.map((i) => ({ food_id: i.food_id, amount: i.amount, unit: i.unit })),
    });
    if (
      !parsed.success ||
      typeof userId !== 'string' ||
      (owner !== undefined && userId !== owner) ||
      own.some((i, index) => i.user_id !== userId || i.order_no !== index + 1) ||
      typeof revision !== 'number' ||
      !Number.isInteger(revision) ||
      revision < 1 ||
      typeof lastWriteId !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string' ||
      seen.has(parsed.data.id)
    ) {
      continue;
    }
    seen.add(parsed.data.id);
    const { items: mealItemValues, ...fields } = parsed.data;
    meals.push({
      ...fields,
      user_id: userId,
      revision,
      last_write_id: lastWriteId,
      created_at: createdAt,
      updated_at: updatedAt,
    });
    mealItemValues.forEach((value, index) =>
      mealItems.push({ ...value, meal_id: parsed.data.id, user_id: userId, order_no: index + 1 }),
    );
  }
  return {
    customMeals: meals,
    customMealItems: mealItems,
    foodLogEntries: entries.map((e) =>
      e.custom_meal_id !== null && !seen.has(e.custom_meal_id) ? { ...e, custom_meal_id: null } : e,
    ),
  };
}

/** goals-Felder des Gerätespeichers aus App-Versionen vor Etappe B2. */
interface LegacyGoalsFields {
  sessions_per_week?: number | null;
  minutes_per_session?: number | null;
  preferred_days?: number[] | null;
}

/**
 * Auf dem Gerät gespeicherte Zeilen älterer App-Versionen (vor Etappe B2) auf das neue Format bringen – der
 * Gerätespeicher des Testmodus und der Offline-Zwischenspeicher des Supabase-Modus – dieselben Regeln wie die
 * Migration 20261005120000_training_slots.sql (Erweiterungsplan 4.2/4.3):
 * - altes Zeitbudget in goals → Trainingstage (scheduleFromLegacyGoals), die alten Felder entfallen,
 * - Langhantel: Werte über 25 kg (früher wohl Gesamtgewichte) entfernen, bar_kg ergänzen (leer = 20 kg).
 * Rein und getestet (legacy-rows.test.ts); bereits neue Stände bleiben unverändert.
 */
export function upgradeStoredRows(stored: UserRows): UserRows {
  const rows: UserRows = {
    ...stored,
    trainingSlots: stored.trainingSlots ?? [],
    // Vor Etappe C gab es keine Pläne im Gerätespeicher.
    plans: stored.plans ?? [],
    plannedSessions: stored.plannedSessions ?? [],
    plannedExercises: stored.plannedExercises ?? [],
    // Vor Phase 4 Etappe C gab es kein Tagebuch.
    sessionLogs: stored.sessionLogs ?? [],
    exerciseLogs: stored.exerciseLogs ?? [],
    setLogs: stored.setLogs ?? [],
    cardioLogs: stored.cardioLogs ?? [],
    startWeights: stored.startWeights ?? [],
    // Vor Etappe T2 gab es keine Übungs-Präferenzen; der Gerätespeicher ist nicht vertrauenswürdig – nur gültige
    // Einträge (Zod, strikt) des eigenen Kontos bleiben (docs/PLAN-UEBUNGEN-GLOSSAR-TAUSCH.md 9).
    exercisePreferences: storedPreferences(stored),
    nutritionSetup: storedNutritionSetup(stored),
    mealPlans: storedMealPlans(stored),
    shoppingLists: storedShoppingLists(stored),
    recipeRatings: storedRecipeRatings(stored),
    foodDislikes: storedFoodDislikes(stored),
    foodLogFavorites: storedFoodLogFavorites(stored),
    ...storedCustomMeals(stored, storedFoodLogEntries(stored)),
  };
  const goals = stored.goals as (GoalsRow & LegacyGoalsFields) | null;
  if (
    goals &&
    ('sessions_per_week' in goals || 'minutes_per_session' in goals || 'preferred_days' in goals)
  ) {
    const { sessions_per_week, minutes_per_session, preferred_days, ...current } = goals;
    rows.goals = current;
    const schedule = scheduleFromLegacyGoals({
      sessions_per_week,
      minutes_per_session,
      preferred_days,
      training_location: current.training_location as TrainingLocation | null,
    });
    if (schedule && rows.trainingSlots.length === 0) {
      rows.trainingSlots = toTrainingSlotRows(current.user_id, schedule);
    }
  }
  rows.userEquipment = stored.userEquipment.map((row): UserEquipmentRow => ({
    ...row,
    bar_kg: row.bar_kg ?? null,
    weights_kg:
      row.equipment_id === BARBELL_ID
        ? row.weights_kg.filter((kg) => kg <= BARBELL_PLATE_MAX_KG)
        : row.weights_kg,
  }));
  return rows;
}
