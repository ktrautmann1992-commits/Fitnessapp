import {
  freeSessionNutritionSessions,
  addDays,
  applyMealPrepPlan,
  type MealPrepPlan,
  experienceLevelSchema,
  type MealPlanInput,
  mealPlanHasRatedDownRecipes,
  mealPlanWeekEditable,
  type ReplanReason,
  resolveMealPlanRecord,
  resolveMealPlanWeek,
  type UnavailableMeal,
  resolveShoppingList,
  type ShoppingListResolution,
  stableHash,
  type DietType,
  type FilteredRecipe,
  ingredientSwapOptions,
  type IngredientSwapOptions,
  ingredientSwapPossible,
  type MealSlotId,
  recipeForPersonWithDiets,
  recipeVariantForMeal,
  intoleranceAccess,
  type IntoleranceAccess,
  type LeftoverMealHint,
  leftoverMealHints,
  leftoverPlanningInput,
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

import { todayIso } from '../lib/format';
import { healthConsentStatus } from '../state/flow';
import { type ConsentVersions, weightGoalFromRow } from './mapping';
import { storedMealPlanRow, storedShoppingListRow } from './meal-plan-rows';
import { dislikedFoodsFromRows, ratingsFromRows } from './rating-rows';
import { healthScreeningForPlan } from './training-plan';
import type { UserRows } from './types';

/**
 * Ernährung in der App (docs/PLAN-PHASE-5.md 8, Etappe N4): Angaben aus den Zeilen → Ernährungs-Engine
 * (packages/core: `nutritionTargetsForWeek` → `clampCalorieTarget`, `buildMealPlanWeek`). Nur Abbildung und
 * Zusammensetzen – alle Regeln, Grenzen und Filter stehen in packages/core (u. a. `nutrition/person.ts`). Rein und
 * getestet (nutrition-n4.test.ts).
 *
 * Gesundheitsdaten (Körperdaten, Flags, Unverträglichkeiten) fließen NUR mit gültiger Einwilligung ein. Die Ziele
 * werden nie gespeichert (7.1). Der Essensplan einer Woche wird ab Etappe N5 gespeichert (Tauschen, „Andere
 * Vorschläge“, vergangene Tage fest); beim Öffnen gilt immer `resolveMealPlanWeek` (6.6): passt der gespeicherte Plan
 * nicht mehr zu Modus, Deckeln, Planband oder Filter, wird ab heute automatisch neu geplant – angezeigt wird nie ein
 * Plan, der den aktuellen Angaben widerspricht. Nie loggen.
 */

/** Woche Mo–So, in der `date` liegt. */
export function nutritionWeekStart(date: string): string {
  return startOfIsoWeek(date);
}

function sessionsForWeek(rows: UserRows, weekStart: string): NutritionSessionInput[] {
  const weekEnd = addDays(weekStart, 6);
  const planStatus = new Map(rows.plans.map((plan) => [plan.id, plan.status]));
  // Freie Einheiten (Etappe A1b, A-G7): ihre Trainingsenergie zählt fürs Tagesziel (nur erhöhend, Deckel bleibt).
  const weekLogs = rows.sessionLogs.filter(
    (l) => l.is_free === true && l.performed_on >= weekStart && l.performed_on <= weekEnd,
  );
  const logOfExercise = new Map(rows.exerciseLogs.map((e) => [e.id, e.session_log_id] as const));
  const doneSets = new Map<string, number>();
  for (const set of rows.setLogs) {
    const logId = logOfExercise.get(set.exercise_log_id);
    if (logId !== undefined && set.done) doneSets.set(logId, (doneSets.get(logId) ?? 0) + 1);
  }
  const free: NutritionSessionInput[] = freeSessionNutritionSessions(weekLogs, {
    cardio: rows.cardioLogs,
    doneSets,
  });
  return [...planSessionsForWeek(rows, weekStart, weekEnd, planStatus), ...free];
}

function planSessionsForWeek(
  rows: UserRows,
  weekStart: string,
  weekEnd: string,
  planStatus: ReadonlyMap<string, UserRows['plans'][number]['status']>,
): NutritionSessionInput[] {
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
  const secondary = rows.goals.secondary_goal_type ?? null;
  return {
    today,
    birthDate: profile.birth_date,
    sex: profile.sex,
    goalType: rows.goals.goal_type,
    // Nebenziel und Wunschgewicht (Etappe Z3; Auswahl in der App ab Z4). Ältere Stände ohne Spalte: kein Nebenziel.
    secondaryGoalType: secondary,
    experienceLevel: level.data,
    discipline:
      rows.goals.goal_type === 'endurance' || secondary === 'endurance'
        ? rows.goals.discipline
        : null,
    healthDataConsent: consent,
    // Nur mit gültiger Einwilligung und nur gültig (weightGoalFromRow, Wächter Z2 K-5) – sonst „ohne festes Ziel“.
    weightGoal: consent ? weightGoalFromRow(rows.weightGoal) : null,
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
      // „Mag ich nicht“ je Lebensmittel (Etappe N10) – kein Gesundheitsdatum, hart wie die Gruppen-Abneigungen.
      dislikedFoods: dislikedFoodsFromRows(rows),
    },
  };
}

/** Eingaben der Plan-Engine für Tauschen, „Andere Vorschläge“ und „Plan aktualisieren“ (Etappe N5). */
export type MealPlanEngineInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

/** Zustand des gespeicherten Essensplans der Woche (Etappe N5). */
export interface MealPlanState {
  /**
   * `stored` = gespeicherter Plan; `created` = noch keiner; `replanned` = automatisch neu geplant (6.6); `rebuilt` =
   * neu erstellt, weil der gespeicherte Plan nicht mehr zu den Rezepten passte (K-b).
   */
  action: 'stored' | 'created' | 'replanned' | 'rebuilt';
  reasons: readonly ReplanReason[];
  /** Knopf „Plan aktualisieren“ (Tagesziel ab heute ≥ 5 % geändert, ohne Sicherheitsbezug). */
  updateSuggested: boolean;
  /**
   * Gespeicherter Plan einer noch nicht begonnenen Woche enthält ein mit Daumen runter abgelehntes Rezept (Etappe N10,
   * Wächter S1) – Hinweis mit „Plan aktualisieren“, keine automatische Neuplanung (Regel: `mealPlanHasRatedDownRecipes`).
   */
  ratedDownSuggested: boolean;
  /** Hinweis „Dein Plan wurde an deine neuen Angaben angepasst.“ zeigen. */
  autoAdjusted: boolean;
  /** Hinweis „Rezepte wurden überarbeitet – Plan neu erstellt, auch vergangene Tage“ zeigen (K-b). */
  recipesChanged: boolean;
  /** Laufende oder nächste Woche – nur diese wird gespeichert und kann getauscht werden. */
  editable: boolean;
  /**
   * Zutaten-Austausch erlaubt (Etappe N9): änderbare Woche UND gültige Einwilligung zu Gesundheitsdaten – ein Plan mit
   * Tausch ist ein Gesundheitsdatum (Wächter N9 S5, wie Ersatzprodukte).
   */
  ingredientSwapAllowed: boolean;
  /** Tag, an dem der Kochtag-Timer gestartet wurde (Gerätezeit) – an diesem Kochtag kein Tausch mehr (K1). */
  cookStartedOn: string | null;
  input: MealPlanEngineInput;
  /**
   * Fingerabdruck der Angaben (Ziele, Vorlieben, Bestand) – nur im Arbeitsspeicher, nie gespeichert oder geloggt.
   * Schützt vor einer Speicher-Schleife: Je Woche und Fingerabdruck wird höchstens einmal automatisch gespeichert.
   */
  inputsKey: string;
}

export type NutritionWeekResult =
  | {
      kind: 'ready';
      targets: NutritionWeekTargets;
      /** null = kein Bestand (keine Rezepte) – Ziele werden trotzdem gezeigt. */
      plan: MealPlanWeek | null;
      /** null = kein Bestand. */
      planState: MealPlanState | null;
      /**
       * Einkaufsliste der Woche (Etappe N5b) nach `resolveShoppingList`: `new` = noch keine gespeichert (erst bei der
       * ersten Änderung), `rebuilt` = an den geänderten Plan angepasst (wird mit dem Plan gespeichert). null = kein
       * Plan.
       */
      shopping: ShoppingListResolution | null;
      /**
       * Hinweise „Nutzt deinen Rest“ (Etappe N14, `leftoverMealHints`) – nur Lebensmittel und Anbruchstag, keine Mengen
       * oder Packungszahlen (G-N13-4/N11-G3 offen). Leer ohne Plan oder ohne Packungsgrößen. Nie gespeichert.
       */
      leftoverHints: readonly LeftoverMealHint[];
      /**
       * Supabase-Modus (Etappe N7 Teil 2, Wächter N7 H9): Mahlzeiten vergangener Tage, deren Rezept nicht mehr
       * verfügbar ist (archiviert = für Nutzer nicht lesbar) – Anzeige „Rezept nicht mehr verfügbar“. Sonst leer.
       */
      unavailableMeals: readonly UnavailableMeal[];
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

/**
 * Resteplanung (Etappe N14) ist eine Zusatzfunktion: Ein Fehler darin (z. B. eine ungültige Packungsgröße) darf nie
 * die ganze Ernährungsansicht sperren (Wächter N14 H2) – dann gibt es keinen Reste-Score bzw. keine Hinweise. Ohne
 * `allowDrafts` nur freigegebene Packungsgrößen (H1, Regel in core `usablePackageSizes`).
 */
export function safeLeftoverPlanningInput(
  library: Pick<NutritionLibrary, 'packageSizes'>,
  allowDrafts: boolean,
): MealPlanInput['leftovers'] {
  try {
    return leftoverPlanningInput(library.packageSizes, { allowDrafts });
  } catch {
    return undefined;
  }
}

export function safeLeftoverMealHints(
  plan: MealPlanWeek,
  library: Pick<NutritionLibrary, 'packageSizes' | 'foods'>,
  allowDrafts: boolean,
): readonly LeftoverMealHint[] {
  try {
    return leftoverMealHints(plan, library.foods, library.packageSizes, { allowDrafts });
  } catch {
    return [];
  }
}

/**
 * Ziele und Essensplan der Woche ab `weekStart`. Mit Bestand: gespeicherter Plan der Woche nach `resolveMealPlanWeek`
 * (neu / gespeichert / automatisch neu geplant, 6.6) – das Speichern übernimmt die App (`useNutritionWeek`).
 */
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
    if (!input.library || input.library.recipes.length === 0) {
      return {
        kind: 'ready',
        targets,
        plan: null,
        planState: null,
        shopping: null,
        leftoverHints: [],
        unavailableMeals: [],
      };
    }
    const engineInput: MealPlanEngineInput = {
      targets,
      profile: profile.profile,
      recipes: input.library.recipes,
      foods: input.library.foods,
      allowDrafts: input.allowDrafts,
      today: input.today,
      // Austausch-Tabelle (Etappe N9): ohne sie gilt eine getauschte Mahlzeit als nicht mehr passend (sichere Richtung).
      substitutions: input.library.substitutions,
      // Bewertungen nach dem Essen (Etappe N10): nur Vorschläge/Reihenfolge, nie Filter, Energie oder Grenzen.
      ratings: ratingsFromRows(input.rows),
      // Resteplanung (Etappe N14, Premium mit Phase 7 – Testphase offen, 19.9): Reste-Score aus den Packungsgrößen (N11),
      // NUR Reihenfolge der Vorschläge. Ohne Packungsgrößen fehlt das Feld → Plan genau wie vorher.
      leftovers: safeLeftoverPlanningInput(input.library, input.allowDrafts),
    };
    const row = storedMealPlanRow(input.rows, input.weekStart);
    // Ohne gültige Einwilligung wird ein gespeicherter Plan mit Gesundheitsbezug weder angezeigt noch weiterverwendet
    // (Art. 9; Wächter N5a S1): Er wird durch einen neuen Plan ohne Gesundheitsdaten ersetzt – auch die vergangenen
    // Tage dieser Woche (sichere Richtung; ein Widerruf löscht ihn ohnehin).
    const usable =
      row !== null &&
      (!row.uses_health_data || healthConsentStatus(input.rows, input.versions) === 'valid')
        ? row
        : null;
    // Supabase-Modus (Etappe N7 Teil 2, G-N7-1): Ohne vollständigen Plan auf dem Gerät wird er aus den Zeilen der
    // Datenbank und dem Bestand neu gebaut (Planband/Abgleich aus den aktuellen Zielen) und danach wie jeder
    // gespeicherte Plan geprüft (6.6, Wächter N7 H5).
    const resolved =
      usable !== null && usable.plan === null && usable.record !== undefined
        ? resolveMealPlanRecord(usable.record, engineInput)
        : { ...resolveMealPlanWeek(usable?.plan ?? null, engineInput), unavailable: [] };
    const editable = mealPlanWeekEditable(input.weekStart, input.today);
    // Einkaufsliste wie der Plan (Art. 9): ohne gültige Einwilligung keine Liste mit Gesundheitsbezug weiterverwenden.
    const listRow = storedShoppingListRow(input.rows, input.weekStart);
    const usableList =
      listRow !== null &&
      (!listRow.uses_health_data || healthConsentStatus(input.rows, input.versions) === 'valid')
        ? listRow.list
        : null;
    const shopping = resolveShoppingList(usableList, resolved.plan, engineInput);
    const planState: MealPlanState = {
      action: resolved.action,
      reasons: resolved.action === 'replanned' ? resolved.reasons : [],
      updateSuggested: resolved.action === 'stored' && resolved.updateSuggested,
      ratedDownSuggested:
        editable &&
        resolved.action === 'stored' &&
        mealPlanHasRatedDownRecipes(resolved.plan, engineInput.ratings, input.today),
      // Nur in änderbaren Wochen (dort gibt es „Verstanden“; Wächter N5a K1).
      autoAdjusted:
        editable &&
        (resolved.action === 'replanned' ||
          (resolved.action === 'stored' && usable?.auto_adjusted === true)),
      recipesChanged:
        editable &&
        (resolved.action === 'rebuilt' ||
          (resolved.action === 'stored' && usable?.recipes_changed === true)),
      editable,
      ingredientSwapAllowed:
        editable && healthConsentStatus(input.rows, input.versions) === 'valid',
      cookStartedOn:
        usable?.cook_day_started_at != null &&
        Number.isFinite(Date.parse(usable.cook_day_started_at))
          ? todayIso(new Date(Date.parse(usable.cook_day_started_at)))
          : null,
      input: engineInput,
      inputsKey: String(
        stableHash(
          JSON.stringify([
            targets,
            profile.profile,
            input.library.recipes.map((r) => `${r.id}@${r.version}`),
            input.library.substitutions.map((x) => `${x.id}@${x.version}`),
            input.library.packageSizes.map((x) => `${x.id}@${x.version}`),
            engineInput.ratings,
            input.allowDrafts,
            input.today,
          ]),
        ),
      ),
    };
    return {
      kind: 'ready',
      targets,
      plan: resolved.plan,
      planState,
      shopping,
      leftoverHints: safeLeftoverMealHints(resolved.plan, input.library, input.allowDrafts),
      unavailableMeals: resolved.unavailable,
    };
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
      /**
       * Nur über die erweiterte Ernährungsform der Suche gefunden (19.6 K3/G4, Etappe N5c): Kennzeichnung „passt nicht
       * zu deiner Ernährungsform: …“; null = passt zur Profil-Ernährungsform.
       */
      outsideProfileDiet: DietType | null;
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
  /**
   * Geöffnet aus der Rezeptsuche mit erweiterter Ernährungsform (K3, Etappe N5c). Erweitert NUR die Ernährungsform –
   * alle anderen Ausschlüsse gelten unverändert (dieselbe Regel wie die Suche, `recipeForPersonWithDiets`).
   */
  extraDiet?: DietType | null;
}): RecipeForPerson {
  const recipe = input.library.recipes.find((r) => r.id === input.recipeId);
  const profile = mealPlanProfileFromRows(input.rows, input.versions);
  if (profile.kind === 'blocked') return { kind: 'blocked', reason: profile.reason };
  if (!recipe) return { kind: 'not_found' };
  if (profile.kind !== 'ok') return { kind: 'not_for_you' };
  const ctx = {
    foods: input.library.foods,
    profile: mealPlanProfileSchema.parse(profile.profile),
    excludePregnancyCaution: weekExcludesPregnancyCaution(input.week.targets),
    allowDrafts: input.allowDrafts,
  };
  const meal =
    input.from === null
      ? undefined
      : input.week.plan?.days
          .find((d) => d.date === input.from?.date)
          ?.meals.find((m) => m.slot === input.from?.slot && m.recipeId === recipe.id);
  // Getauschte Zutaten (Etappe N9): Filter, Allergene und Haltbarkeit mit dem, was tatsächlich gekocht wird.
  if (meal?.ingredientSwaps !== undefined && meal.ingredientSwaps.length > 0) {
    const swapped = recipeVariantForMeal(
      recipe,
      meal,
      ctx,
      input.library.foods,
      input.library.substitutions,
    );
    return swapped === null
      ? { kind: 'not_for_you' }
      : { kind: 'ok', variant: swapped, plannedMeal: meal, outsideProfileDiet: null };
  }
  const hit = recipeForPersonWithDiets(
    recipe,
    ctx,
    // Aus dem Essensplan geöffnet: nie erweitert (G4).
    input.from === null && input.extraDiet ? [input.extraDiet] : [],
  );
  if (hit === null) return { kind: 'not_for_you' };
  return {
    kind: 'ok',
    variant: hit.variant,
    plannedMeal: meal ?? null,
    outsideProfileDiet: hit.outsideProfileDiet,
  };
}

/**
 * Zutaten-Austausch (KONZEPT 6.9, Etappe N9): Kann an dieser Zutat einer geplanten Mahlzeit „Austauschen“ erscheinen?
 * Nur in änderbaren Wochen (laufende/nächste), ab heute, nicht für vorgekochte Portionen und nur für Zutaten mit
 * Rolle, nur mit gültiger Einwilligung zu Gesundheitsdaten (ein Plan mit Tausch ist ein Gesundheitsdatum, Wächter N9 S5)
 * – die Regeln stehen in packages/core (`ingredientSwapPossible`).
 */
export function canSwapIngredient(
  week: Extract<NutritionWeekResult, { kind: 'ready' }>,
  target: { date: string; slot: string; index: number },
): boolean {
  if (week.plan === null || week.planState === null || !week.planState.ingredientSwapAllowed) {
    return false;
  }
  return ingredientSwapPossible(
    week.plan,
    { ...target, slot: target.slot as MealSlotId },
    week.planState.input,
    { cookStartedOn: week.planState.cookStartedOn },
  );
}

/**
 * Alternativen für eine Zutat (Dialog „Austauschen“): nur sichere Alternativen aus der Austausch-Tabelle, jede mit dem
 * fertig durchgerechneten Plan (`ingredientSwapOptions` in packages/core). Nicht angebotene erscheinen ohne Grund.
 */
export function ingredientSwapView(
  week: Extract<NutritionWeekResult, { kind: 'ready' }>,
  target: { date: string; slot: string; index: number },
): IngredientSwapOptions | { ok: false; reason: 'not_editable' | 'consent_required' } {
  if (week.plan === null || week.planState === null || !week.planState.editable) {
    return { ok: false, reason: 'not_editable' };
  }
  if (!week.planState.ingredientSwapAllowed) return { ok: false, reason: 'consent_required' };
  return ingredientSwapOptions(
    week.plan,
    { ...target, slot: target.slot as MealSlotId },
    week.planState.input,
    { cookStartedOn: week.planState.cookStartedOn },
  );
}

export interface MealPrepOffer {
  plan: MealPrepPlan;
  /** Für diese Person und Woche angeboten (19.6); sonst ausgegraut „Passt nicht zu deinen Angaben“ – ohne Grund. */
  offered: boolean;
  /** Vorschau der Woche mit diesem Plan (nur wenn angeboten) – für Aufbewahrung und Kochtag. */
  preview: MealPlanWeek | null;
  /** Ist der gewählte Plan dieser Woche. */
  chosen: boolean;
}

/**
 * Meal-Prep-Wochenpläne für die Woche (19.6, Etappe N5b): Jeder Plan läuft durch `applyMealPrepPlan` (kompletter Filter
 * der Person, Plätze, Haltbarkeit, Planband) – mit dem gespeicherten Plan der Woche als Grundlage (vergangene Tage
 * bleiben). Feste Reihenfolge nach ID. Nur Zusammensetzen; die Regeln stehen in packages/core.
 */
export function mealPrepOffers(
  week: Extract<NutritionWeekResult, { kind: 'ready' }>,
  plans: readonly MealPrepPlan[],
): MealPrepOffer[] {
  if (week.plan === null || week.planState === null) return [];
  const base = week.plan;
  const input = week.planState.input;
  return [...plans]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((plan) => {
      let offer: ReturnType<typeof applyMealPrepPlan>;
      try {
        offer = applyMealPrepPlan(plan, { ...input, existingPlan: base, variant: base.variant });
      } catch {
        offer = { offered: false };
      }
      return {
        plan,
        offered: offer.offered || base.mealPrepPlanId === plan.id,
        // Gewählt: die gespeicherte Woche selbst (sie kann nach dem Kochtag nicht mehr neu angewandt werden).
        preview: base.mealPrepPlanId === plan.id ? base : offer.offered ? offer.plan : null,
        chosen: base.mealPrepPlanId === plan.id,
      };
    });
}
