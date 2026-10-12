import {
  addDays,
  buildMealPlanWeek,
  experienceLevelSchema,
  type FilteredRecipe,
  filterRecipe,
  intoleranceAccess,
  type IntoleranceAccess,
  type IntoleranceBlockReason,
  mealPlanProfileSchema,
  measuredOnForEngine,
  weekExcludesPregnancyCaution,
  type PlannedMeal,
  foodGroupSchema,
  type FoodGroupId,
  type MealPlanProfileInput,
  type MealPlanWeek,
  type NutritionInputsInput,
  type NutritionLibrary,
  type NutritionSessionInput,
  nutritionTargetsForWeek,
  type NutritionWeekTargets,
  startOfIsoWeek,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import type { ConsentVersions } from './mapping';
import { healthScreeningForPlan } from './training-plan';
import type { UserRows } from './types';

/**
 * Ernährung in der App (docs/PLAN-PHASE-5.md 8, Etappe N4): Angaben aus den Zeilen → Ernährungs-Engine
 * (packages/core: `nutritionTargetsForWeek` → `clampCalorieTarget`, `buildMealPlanWeek`). Nur Abbildung und
 * Zusammensetzen – alle Regeln, Grenzen und Filter stehen in packages/core (u. a. `nutrition/person.ts`). Rein und
 * getestet (nutrition-n4.test.ts).
 *
 * Gesundheitsdaten (Körperdaten, Flags, Unverträglichkeiten) fließen NUR mit gültiger Einwilligung ein. Die Ziele
 * werden nie gespeichert (7.1); der Essensplan wird in N4 bei jedem Öffnen deterministisch neu berechnet (Speichern,
 * Tauschen und Einkaufsliste folgen mit N5) – damit passt er immer zum aktuellen Modus (6.6). Nie loggen.
 */

/** Woche Mo–So, in der `date` liegt. */
export function nutritionWeekStart(date: string): string {
  return startOfIsoWeek(date);
}

function sessionsForWeek(rows: UserRows, weekStart: string): NutritionSessionInput[] {
  const weekEnd = addDays(weekStart, 6);
  const planStatus = new Map(rows.plans.map((plan) => [plan.id, plan.status]));
  return rows.plannedSessions.flatMap((s): NutritionSessionInput[] => {
    const status = planStatus.get(s.plan_id);
    if (status === undefined || s.scheduled_on < weekStart || s.scheduled_on > weekEnd) return [];
    return [
      {
        sessionId: s.id,
        planId: s.plan_id,
        planStatus: status,
        scheduledOn: s.scheduled_on,
        kind: s.kind,
        enduranceModality: s.endurance_modality,
        effortTarget: s.effort_target,
        minutes: s.estimated_minutes,
        isDeload: s.is_deload,
        status: s.status,
      },
    ];
  });
}

/**
 * Eingaben der Engine; null = Angaben unvollständig (Profil, Ziel oder Erfahrung fehlt). Körperdaten-Datum nach der
 * Regel aus core (`measuredOnForEngine`, Wächter N1 K3).
 */
export function nutritionInputsFromRows(
  rows: UserRows,
  versions: ConsentVersions,
  today: string,
  weekStart: string,
): NutritionInputsInput | null {
  const profile = rows.profile;
  const level = experienceLevelSchema.safeParse(profile?.experience_level);
  if (!profile || !level.success || !rows.goals) return null;
  const consent = healthConsentStatus(rows, versions) === 'valid';
  return {
    today,
    birthDate: profile.birth_date,
    sex: profile.sex,
    goalType: rows.goals.goal_type,
    experienceLevel: level.data,
    discipline: rows.goals.goal_type === 'endurance' ? rows.goals.discipline : null,
    healthDataConsent: consent,
    bodyMetricsRows: consent
      ? rows.bodyMetrics
          .filter((r) => r.height_cm !== null || r.weight_kg !== null || r.body_fat_pct !== null)
          .map((r) => ({
            measuredOn: measuredOnForEngine(r.measured_on, today),
            heightCm: r.height_cm,
            weightKg: r.weight_kg,
            bodyFatPct: r.body_fat_pct,
          }))
      : [],
    healthFlags: healthScreeningForPlan(rows, versions),
    activityLevel: rows.nutritionSetup?.activity_level ?? null,
    trainingTime: rows.nutritionSetup?.training_time ?? null,
    mealsPerDay: rows.nutritionPrefs?.meals_per_day ?? 3,
    sessions: sessionsForWeek(rows, weekStart),
  };
}

function groupsOf(rows: UserRows, kind: 'like' | 'dislike' | 'intolerance'): FoodGroupId[] {
  const groups = new Set<FoodGroupId>();
  for (const row of rows.foodPreferences) {
    const group = foodGroupSchema.safeParse(row.food_group);
    if (row.kind === kind && group.success) groups.add(group.data);
  }
  return [...groups];
}

/** Unverträglichkeiten nach der Regel aus core (`intoleranceAccess`, Art. 9, Wächter N4 B1). */
export function intoleranceAccessFromRows(
  rows: UserRows,
  versions: ConsentVersions,
): IntoleranceAccess {
  return intoleranceAccess({
    consent: healthConsentStatus(rows, versions),
    storedIntolerances: rows.foodPreferences
      .filter((row) => row.kind === 'intolerance')
      .map((row) => row.food_group),
  });
}

export type MealPlanProfileResult =
  /** Ernährungsform fehlt (Onboarding-Schritt „Ernährung“ nicht beantwortet). */
  | { kind: 'incomplete' }
  /** Gespeicherte Unverträglichkeiten ohne gültige Einwilligung – kein Plan, keine Rezeptansicht (B1). */
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  | { kind: 'ok'; profile: MealPlanProfileInput };

/** Vorlieben für den Essensplan. Meal-Prep-Plätze aus `nutrition_setup` (Standard „Mittag“). */
export function mealPlanProfileFromRows(
  rows: UserRows,
  versions: ConsentVersions,
): MealPlanProfileResult {
  const prefs = rows.nutritionPrefs;
  if (!prefs) return { kind: 'incomplete' };
  const access = intoleranceAccessFromRows(rows, versions);
  if (access.kind === 'blocked') return { kind: 'blocked', reason: access.reason };
  const mealPrep = prefs.cooking_mode === 'meal_prep' && prefs.mealprep_days !== null;
  return {
    kind: 'ok',
    profile: {
      diet: prefs.diet_type,
      eatsPork: prefs.diet_type === 'omnivore' ? prefs.eats_pork : null,
      cookingMode: mealPrep ? 'meal_prep' : 'daily',
      mealprepDays: mealPrep ? prefs.mealprep_days : null,
      mealprepSlots: rows.nutritionSetup?.mealprep_slots ?? 'lunch',
      likes: groupsOf(rows, 'like'),
      dislikes: groupsOf(rows, 'dislike'),
      intolerances: [...access.intolerances],
    },
  };
}

export type NutritionWeekResult =
  | {
      kind: 'ready';
      targets: NutritionWeekTargets;
      /** null = kein Bestand (keine Rezepte) – Ziele werden trotzdem gezeigt. */
      plan: MealPlanWeek | null;
    }
  /** Angaben unvollständig (Ziel, Erfahrung oder Ernährungsform fehlt). */
  | { kind: 'incomplete' }
  /**
   * Gespeicherte Unverträglichkeiten, aber Einwilligung nicht gültig (z. B. neue Fassung): kein Plan, keine Ziele –
   * Hinweis „Einwilligung bestätigen“ bzw. „erteilen oder löschen“ (Wächter N4 B1, NK1/NK2).
   */
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  /** Die Engine hat die Eingaben abgelehnt (Zod) – nie still weiterrechnen. */
  | { kind: 'error' };

/** Ziele und Essensplan der Woche ab `weekStart`. */
export function computeNutritionWeek(input: {
  rows: UserRows;
  versions: ConsentVersions;
  today: string;
  weekStart: string;
  library: NutritionLibrary | null;
  /** Nur Testmodus: Entwürfe (gekennzeichnet) erlaubt. */
  allowDrafts: boolean;
}): NutritionWeekResult {
  const inputs = nutritionInputsFromRows(input.rows, input.versions, input.today, input.weekStart);
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (!inputs || profile.kind === 'incomplete') return { kind: 'incomplete' };
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  try {
    const targets = nutritionTargetsForWeek(inputs, input.weekStart);
    const plan =
      input.library && input.library.recipes.length > 0
        ? buildMealPlanWeek({
            targets,
            profile: profile.profile,
            recipes: input.library.recipes,
            foods: input.library.foods,
            allowDrafts: input.allowDrafts,
            today: input.today,
          })
        : null;
    return { kind: 'ready', targets, plan };
  } catch {
    // Bewusst ohne Details: keine Gesundheitsdaten in Logs oder Fehlermeldungen.
    return { kind: 'error' };
  }
}

/** „Kalorienzahlen anzeigen“ (Standard an, Frage 16 B (h)). */
export function showEnergyNumbers(rows: UserRows | null): boolean {
  return rows?.nutritionSetup?.show_energy_numbers ?? true;
}

export type RecipeForPerson =
  | { kind: 'not_found' }
  /** Unverträglichkeiten ohne gültige Einwilligung (B1) – keine Rezeptansicht. */
  | { kind: 'blocked'; reason: IntoleranceBlockReason }
  /** Besteht den Filter für diese Person nicht (Ernährungsform, Schwein, Ausschlüsse, Schwangerschaft) – ohne Grund. */
  | { kind: 'not_for_you' }
  | {
      kind: 'ok';
      variant: FilteredRecipe;
      /** Die Mahlzeit aus dem Essensplan (Portion, skalierte Zutaten), wenn das Rezept von dort geöffnet wurde. */
      plannedMeal: PlannedMeal | null;
    };

/**
 * Rezept für die Rezeptansicht (8.2 Nr. 4): Der Bestand ist nicht personenbezogen und wird NIE direkt angezeigt –
 * jedes Rezept läuft durch denselben Filter wie der Essensplan (`filterRecipe`, inkl. Weglassen optionaler Zutaten und
 * Ersatz-Zutaten). Schwangerschafts-Ausschluss, sobald er an irgendeinem Tag der Woche gilt (sichere Richtung).
 */
export function recipeForPerson(input: {
  recipeId: string;
  library: NutritionLibrary;
  rows: UserRows;
  versions: ConsentVersions;
  week: Extract<NutritionWeekResult, { kind: 'ready' }>;
  allowDrafts: boolean;
  /** Geöffnet aus dem Essensplan: Tag und Platz. */
  from: { date: string; slot: string } | null;
}): RecipeForPerson {
  const recipe = input.library.recipes.find((r) => r.id === input.recipeId);
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  if (!recipe) return { kind: 'not_found' };
  if (profile.kind !== 'ok') return { kind: 'not_for_you' };
  const result = filterRecipe(recipe, input.library.foods, {
    profile: mealPlanProfileSchema.parse(profile.profile),
    excludePregnancyCaution: weekExcludesPregnancyCaution(input.week.targets),
    allowDrafts: input.allowDrafts,
  });
  if (!result.ok) return { kind: 'not_for_you' };
  const meal =
    input.from === null
      ? undefined
      : input.week.plan?.days
          .find((d) => d.date === input.from?.date)
          ?.meals.find((m) => m.slot === input.from?.slot && m.recipeId === recipe.id);
  return { kind: 'ok', variant: result.value, plannedMeal: meal ?? null };
}
