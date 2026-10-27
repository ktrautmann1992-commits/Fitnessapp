import { z } from 'zod';

import {
  COMPETITION_NUTRITION,
  MEAL_TIMING_RULES,
  NUTRIENT_TIMING,
  NUTRITION_AGE_RULES,
} from '../constants';
import type { ExperienceLevel } from '../enums';
import { EXPERIENCE_LEVELS, TRAINING_TIMES } from '../enums';
import { type GramRange, raceFuelingPlan } from './competition';
import type { FilteredRecipe } from './filter';
import { proteinReferenceWeight } from './macros';
import type { MealPlanInput, PlannedMeal, PlannedMealDay } from './meal-plan';
import { CandidatePool, isCompetitionMealDay } from './meal-plan';
import { recipeBlockedOnAnyDay, recipeRatingIndex } from './ratings';
import type { NutritionDayTargets } from './targets';
import {
  isSnackSlot,
  type MealRole,
  type MealSlot,
  type MealSlotId,
  mealRolesForWindows,
  type TrainingWindow,
  trainingWindows,
} from './timing';
import {
  needsRefuel,
  preWorkoutExcess,
  preWorkoutIssues,
  proteinPerMealGuideG,
  type SlotMacroTarget,
  slotMacroTargets,
  windowIndexForSlot,
} from './training-meal-targets';

/**
 * Zeitplan „Essen rund ums Training“ (docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitt 7, T1): an Trainingstagen eine
 * Zeitleiste mit ECHTEN Gerichten aus dem Essensplan (Rezept + Portion), Zeitfenstern, Begründung („Warum?“), ggf. einer
 * kleinen Beilage bzw. einem Snack aus dem Bestand (Snack-Liste: Rezepte für vor/nach dem Training) und dem Richtwert
 * für unterwegs bei langen Einheiten. Höchstens EIN Timing-Hinweis je Tag (`notice`).
 * Gramm nur mit „Kalorienzahlen anzeigen“, Zielen (nicht `no_targets`), Körpergewicht (Einwilligung) und ab 18 – sonst
 * nur Zeitfenster, Gerichte und allgemeine Hinweise. Ändert nichts am Plan, an der Energie oder an Grenzen.
 */

export type TimelineEntryKind = 'pre_meal' | 'pre_snack' | 'session' | 'post_meal';

/** Begründung („Warum?“) – Text in der App. */
export type TimelineReason =
  | 'pre_meal'
  | 'pre_snack'
  | 'early_snack'
  | 'session_short'
  | 'session_long'
  | 'post_meal'
  | 'post_refuel'
  | 'post_endurance';

/** Ehrlicher Befund zum Gericht (Plan 7: „Passt nichts: das beste Gericht mit ehrlichem Hinweis“). */
export type TimelineMealStatus = 'fits' | 'protein_low' | 'carbs_low' | 'heavy_before';

export interface TimelineValues {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export interface TimelineMeal {
  readonly slot: MealSlotId;
  readonly recipeId: string;
  readonly titleDe: string;
  readonly factor: number;
  /** null = ohne Gramm (siehe oben). */
  readonly values: TimelineValues | null;
  readonly status: TimelineMealStatus;
  readonly chosen: boolean;
}

/** Snack bzw. Beilage aus dem Bestand (eine Portion). */
export interface TimelineExtra {
  readonly recipeId: string;
  readonly titleDe: string;
  readonly values: TimelineValues | null;
}

export interface TimelineFueling {
  /** Kohlenhydrate je Stunde; null = nur allgemein (unter 18, ohne Gramm) bzw. nichts nötig. */
  readonly carbsGPerHour: GramRange | null;
  readonly drinkMlPerHour: GramRange;
  /** Über 150 min nur Fortgeschrittene 60–90 g/h – „vorher testen“. */
  readonly testFirst: boolean;
}

export interface TimelineEntry {
  readonly key: string;
  readonly kind: TimelineEntryKind;
  /** Zeitfenster in Minuten nach Mitternacht. */
  readonly fromMinutes: number;
  readonly toMinutes: number;
  /** Ohne eigene Uhrzeit der Einheit („ca.“). */
  readonly approx: boolean;
  readonly reason: TimelineReason;
  readonly meal: TimelineMeal | null;
  /** Optionaler Snack (vor dem Training ohne Snack-Platz) bzw. Beilage (zu wenig Eiweiß). */
  readonly extra: TimelineExtra | null;
  readonly extraKind: 'snack' | 'side' | null;
  /** Nur bei `session`. */
  readonly session: {
    readonly sessionId: string | null;
    readonly kind: TrainingWindow['kind'];
    readonly minutes: number;
    readonly fueling: TimelineFueling | null;
  } | null;
}

export type TrainingTimingNoticeCode =
  | 'timing_protein_low_post'
  | 'timing_heavy_before'
  | 'timing_carbs_low'
  | 'timing_meal_protein_low'
  | 'timing_early_training'
  | 'timing_long_session';

export interface TrainingTimingNotice {
  readonly code: TrainingTimingNoticeCode;
  readonly slot: MealSlotId | null;
  readonly titleDe: string | null;
  /** Vorschlag zum Ergänzen („z. B. Joghurt dazu“) aus dem Bestand; null ohne passenden. */
  readonly extraTitleDe: string | null;
}

export interface TrainingDayTimeline {
  readonly date: string;
  /** Mindestens eine Einheit ohne eigene Uhrzeit („ca.“). */
  readonly approx: boolean;
  readonly grams: boolean;
  readonly entries: readonly TimelineEntry[];
}

export const trainingTimelineOptionsSchema = z.strictObject({
  trainingTime: z.enum(TRAINING_TIMES).nullable(),
  /** Körperdaten nur mit gültiger Einwilligung, sonst null (dann keine Gramm). */
  body: z
    .strictObject({
      weightKg: z.number().positive().max(500),
      heightCm: z.number().positive().max(300),
    })
    .nullable(),
  showNumbers: z.boolean(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).nullable(),
});
export type TrainingTimelineOptions = z.input<typeof trainingTimelineOptionsSchema>;

const T = NUTRIENT_TIMING;

/** Gramm erlaubt (Plan 8)? „Kalorienzahlen“, Ziele, Körpergewicht und ab 18. */
export function timingGramsAllowed(
  day: Pick<NutritionDayTargets, 'mode' | 'ageYears' | 'targetKcal'>,
  options: Pick<TrainingTimelineOptions, 'showNumbers' | 'body'>,
): boolean {
  return (
    options.showNumbers &&
    options.body !== null &&
    day.mode !== 'no_targets' &&
    day.targetKcal !== null &&
    day.ageYears >= NUTRITION_AGE_RULES.minorBelowAge
  );
}

const round = (value: number) => Math.round(value);
function valuesOf(n: Pick<PlannedMeal['nutrients'], 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>) {
  return {
    kcal: round(n.kcal),
    proteinG: round(n.protein_g),
    carbsG: round(n.carbs_g),
    fatG: round(n.fat_g),
  };
}

/** Plätze des Tages mit den Rollen zu den Zeitfenstern (auch ohne eigene Uhrzeit, für die Anzeige). */
function slotsWithRoles(day: NutritionDayTargets, windows: readonly TrainingWindow[]): MealSlot[] {
  if (day.trainingTiming !== undefined) return [...day.slots];
  const roles = mealRolesForWindows(day.slots, windows);
  return day.slots.map((s, i) => ({ ...s, role: roles[i] ?? null }));
}

/** Makro-Anteile je Platz (für Richtwerte); null ohne Gramm. */
function macroTargetsFor(
  day: NutritionDayTargets,
  slots: readonly MealSlot[],
  windows: readonly TrainingWindow[],
  body: { weightKg: number; heightCm: number },
): SlotMacroTarget[] | null {
  if (day.trainingTiming?.mealTargets) return [...day.trainingTiming.mealTargets];
  if (day.targetKcal === null || day.proteinG === null || day.carbsG === null || day.fatG === null)
    return null;
  return slotMacroTargets({
    slots,
    targetKcal: day.targetKcal,
    proteinG: day.proteinG,
    carbsG: day.carbsG,
    fatG: day.fatG,
    referenceWeightKg: proteinReferenceWeight(body.weightKg, body.heightCm),
    weightKg: body.weightKg,
    ageYears: day.ageYears,
    windows,
  });
}

function mealStatus(
  meal: PlannedMeal,
  role: MealRole,
  target: SlotMacroTarget | null,
): TimelineMealStatus {
  if (preWorkoutIssues(role, meal.nutrients).length > 0) return 'heavy_before';
  const tol = 1 - T.dishTolerance;
  if (target?.proteinGuideG != null && role === 'post') {
    if (meal.nutrients.protein_g < target.proteinGuideG * tol) return 'protein_low';
  }
  if (target?.carbsGuideG != null && meal.nutrients.carbs_g < target.carbsGuideG * tol) {
    return 'carbs_low';
  }
  return 'fits';
}

/** Snack für 30–60 min vorher: keine Grenzen überschritten, KH nah an 15–30 g, „vor dem Training“ bevorzugt. */
export function bestPreWorkoutSnack(candidates: readonly FilteredRecipe[]): FilteredRecipe | null {
  let best: { c: FilteredRecipe; score: number } | null = null;
  for (const c of candidates) {
    const per = c.facts.perServing;
    if (preWorkoutIssues('pre_snack', per).length > 0 || per.carbs_g < T.preSnackCarbsG.min / 2) {
      continue;
    }
    const mid = (T.preSnackCarbsG.min + T.preSnackCarbsG.max) / 2;
    const tagged =
      c.recipe.training_tags.includes('vor_training') ||
      (c.recipe.categories ?? []).includes('pre-workout');
    const score =
      -Math.abs(per.carbs_g - mid) - 10 * preWorkoutExcess('pre_snack', per) + (tagged ? 5 : 0);
    if (
      best === null ||
      score > best.score ||
      (score === best.score && c.recipe.id < best.c.recipe.id)
    ) {
      best = { c, score };
    }
  }
  return best?.c ?? null;
}

/** Kleine Beilage gegen fehlendes Eiweiß (`gapG`): höchstens `sideMaxKcal`, Eiweiß möglichst nah an der Lücke. */
export function bestProteinSide(
  candidates: readonly FilteredRecipe[],
  gapG: number,
  excludeIds: ReadonlySet<string> = new Set(),
): FilteredRecipe | null {
  let best: { c: FilteredRecipe; score: number } | null = null;
  for (const c of candidates) {
    const per = c.facts.perServing;
    if (excludeIds.has(c.recipe.id) || per.kcal > T.sideMaxKcal || per.kcal <= 0) continue;
    if ((4 * per.protein_g) / per.kcal < 0.25) continue;
    const score = -Math.abs(per.protein_g - gapG) - per.kcal / 100;
    if (
      best === null ||
      score > best.score ||
      (score === best.score && c.recipe.id < best.c.recipe.id)
    ) {
      best = { c, score };
    }
  }
  return best?.c ?? null;
}

/**
 * Snacks/Beilagen aus dem Bestand für die Person (alle Filter: Ernährungsform, Unverträglichkeiten, Allergien,
 * „mag ich nicht“, Schwangerschaft) – nur Snack-Rezepte ohne Kochen, nicht mit Daumen runter/„Nie wieder“.
 */
export function timingSnackCandidates(
  input: Pick<
    MealPlanInput,
    | 'recipes'
    | 'foods'
    | 'profile'
    | 'allowDrafts'
    | 'redRecipeIds'
    | 'substitutions'
    | 'ratings'
    | 'recipePreferences'
  >,
  day: Pick<NutritionDayTargets, 'date' | 'recipeExclusions'>,
): FilteredRecipe[] {
  const ratings = recipeRatingIndex(input.ratings, input.recipePreferences);
  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    input.substitutions,
    ratings,
  );
  return pool
    .allowed(day.recipeExclusions.includes('pregnancy_caution'))
    .filter(
      (c) =>
        c.recipe.meal_types.includes('snack') &&
        c.recipe.no_cook &&
        !(c.recipe.categories ?? []).includes('wettkampf') &&
        !recipeBlockedOnAnyDay(ratings, c.recipe.id, [day.date]),
    );
}

/** Richtwert unterwegs (Plan 5): nur geplante Ausdauer ab 90 min. */
export function sessionFueling(
  window: Pick<TrainingWindow, 'kind' | 'minutes'>,
  level: ExperienceLevel | null,
  generalOnly: boolean,
): TimelineFueling | null {
  if (window.kind !== 'endurance' || window.minutes < T.longSessionMinutes) return null;
  const plan = raceFuelingPlan(Math.round(window.minutes), level ?? 'beginner', {
    generalOnly,
    weightKg: null,
  });
  return {
    carbsGPerHour: plan.carbsGPerHour,
    drinkMlPerHour: plan.drinkMlPerHour ?? COMPETITION_NUTRITION.drinkMlPerHour,
    testFirst: plan.notices.includes('test_in_long_run') && plan.stage === 'high',
  };
}

/**
 * Zeitleiste eines Tages; null an Ruhetagen und an Wettkampftagen (dort gilt die Wettkampf-Ernährung mit eigener
 * Zeitleiste).
 */
export function trainingDayTimeline(
  day: NutritionDayTargets,
  plannedDay: PlannedMealDay | null,
  rawOptions: TrainingTimelineOptions,
  snackCandidates: readonly FilteredRecipe[] = [],
): TrainingDayTimeline | null {
  const options = trainingTimelineOptionsSchema.parse(rawOptions);
  if (day.sessions.length === 0 || isCompetitionMealDay(day)) return null;
  const windows =
    day.trainingTiming?.windows ?? trainingWindows(day.sessions, options.trainingTime);
  const slots = slotsWithRoles(day, windows);
  const grams = timingGramsAllowed(day, options);
  const targets =
    grams && options.body !== null ? macroTargetsFor(day, slots, windows, options.body) : null;
  const targetOf = (slot: MealSlotId) => targets?.find((t) => t.slot === slot) ?? null;
  const mealOf = (slot: MealSlotId) =>
    plannedDay?.meals.find((m) => m.slot === slot && !m.isFill) ?? null;
  const timelineMeal = (slot: MealSlot): TimelineMeal | null => {
    const meal = mealOf(slot.slot);
    if (meal === null) return null;
    return {
      slot: slot.slot,
      recipeId: meal.recipeId,
      titleDe: meal.titleDe,
      factor: meal.factor,
      values: grams ? valuesOf(meal.nutrients) : null,
      status: mealStatus(meal, slot.role, targetOf(slot.slot)),
      chosen: meal.chosen === true,
    };
  };
  const extraOf = (c: FilteredRecipe | null): TimelineExtra | null =>
    c === null
      ? null
      : {
          recipeId: c.recipe.id,
          titleDe: c.recipe.title_de,
          values: grams ? valuesOf(c.facts.perServing) : null,
        };
  const usedIds = new Set(plannedDay?.meals.map((m) => m.recipeId) ?? []);
  const snackPool = snackCandidates.filter((c) => !usedIds.has(c.recipe.id));
  const generalOnly = !grams;

  const entries: TimelineEntry[] = [];
  windows.forEach((w, index) => {
    const own = (role: MealRole) =>
      slots.find((s) => s.role === role && windowIndexForSlot(s, windows) === index) ?? null;
    const preSlot = own('pre');
    if (preSlot !== null) {
      entries.push({
        key: `${index}-pre`,
        kind: 'pre_meal',
        fromMinutes: w.start - MEAL_TIMING_RULES.preMealMinutes.max,
        toMinutes: w.start - MEAL_TIMING_RULES.preMealMinutes.min,
        approx: w.approx,
        reason: 'pre_meal',
        meal: timelineMeal(preSlot),
        extra: null,
        extraKind: null,
        session: null,
      });
    }
    const snackSlot = own('pre_snack');
    const early = w.start < T.earlyBeforeMinutes && preSlot === null;
    if (snackSlot !== null || preSlot === null || index === 0) {
      const meal = snackSlot === null ? null : timelineMeal(snackSlot);
      const snack = meal === null ? bestPreWorkoutSnack(snackPool) : null;
      if (meal !== null || snack !== null) {
        entries.push({
          key: `${index}-snack`,
          kind: 'pre_snack',
          fromMinutes: w.start - MEAL_TIMING_RULES.preSnackMinutes.max,
          toMinutes: w.start - MEAL_TIMING_RULES.preSnackMinutes.min,
          approx: w.approx,
          reason: early ? 'early_snack' : 'pre_snack',
          meal,
          extra: extraOf(snack),
          extraKind: snack === null ? null : 'snack',
          session: null,
        });
      }
    }
    entries.push({
      key: `${index}-session`,
      kind: 'session',
      fromMinutes: w.start,
      toMinutes: w.end,
      approx: w.approx,
      reason:
        w.minutes >= T.longSessionMinutes && w.kind === 'endurance'
          ? 'session_long'
          : 'session_short',
      meal: null,
      extra: null,
      extraKind: null,
      session: {
        sessionId: w.sessionId,
        kind: w.kind,
        minutes: w.minutes,
        fueling: sessionFueling(w, options.experienceLevel, generalOnly),
      },
    });
    const postSlot = own('post');
    const postMeal = postSlot === null ? null : timelineMeal(postSlot);
    const target = postSlot === null ? null : targetOf(postSlot.slot);
    const gap =
      postMeal !== null && postMeal.values !== null && target?.proteinGuideG != null
        ? target.proteinGuideG - postMeal.values.proteinG
        : 0;
    // Keine Mahlzeit bis 2 h danach eingeplant: eiweißreicher Snack aus dem Bestand als Vorschlag.
    const side =
      postMeal === null
        ? bestProteinSide(snackPool, target?.proteinGuideG ?? 20)
        : postMeal.status === 'protein_low' && gap >= T.sideMinGapG
          ? bestProteinSide(snackPool, gap)
          : null;
    entries.push({
      key: `${index}-post`,
      kind: 'post_meal',
      fromMinutes: w.end,
      toMinutes: w.end + T.postWithinMinutes,
      approx: w.approx,
      reason: needsRefuel(windows, index)
        ? 'post_refuel'
        : w.kind === 'endurance' && w.minutes >= T.postEnduranceCarbFromMinutes
          ? 'post_endurance'
          : 'post_meal',
      meal: postMeal,
      extra: extraOf(side),
      extraKind: side === null ? null : postMeal === null ? 'snack' : 'side',
      session: null,
    });
  });
  return {
    date: day.date,
    approx: windows.some((w) => w.approx),
    grams,
    entries,
  };
}

/**
 * Höchstens EIN Timing-Hinweis je Tag (Plan 7) für die Hinweis-Zeile. Vorrang: zu wenig Eiweiß nach dem Training →
 * schwer vor dem Training → zu wenig KH → eiweißarme Hauptmahlzeit (auch an Ruhetagen, nur mit Gramm) → frühes
 * Training → lange Einheit. Ohne Befund null.
 */
export function trainingTimingNotice(
  day: NutritionDayTargets,
  plannedDay: PlannedMealDay | null,
  timeline: TrainingDayTimeline | null,
  rawOptions: TrainingTimelineOptions,
  snackCandidates: readonly FilteredRecipe[] = [],
): TrainingTimingNotice | null {
  const options = trainingTimelineOptionsSchema.parse(rawOptions);
  const find = (status: TimelineMealStatus) =>
    timeline?.entries.find((e) => e.meal?.status === status) ?? null;
  const post = timeline?.entries.find(
    (e) => e.kind === 'post_meal' && e.meal?.status === 'protein_low',
  );
  if (post?.meal) {
    return {
      code: 'timing_protein_low_post',
      slot: post.meal.slot,
      titleDe: post.meal.titleDe,
      extraTitleDe: post.extra?.titleDe ?? null,
    };
  }
  const heavy = find('heavy_before');
  if (heavy?.meal) {
    return {
      code: 'timing_heavy_before',
      slot: heavy.meal.slot,
      titleDe: heavy.meal.titleDe,
      extraTitleDe: null,
    };
  }
  const carbs = find('carbs_low');
  if (carbs?.meal) {
    return {
      code: 'timing_carbs_low',
      slot: carbs.meal.slot,
      titleDe: carbs.meal.titleDe,
      extraTitleDe: null,
    };
  }
  // Eiweiß gleichmäßig (Plan 1): Hauptmahlzeit deutlich unter dem Richtwert – auch an Ruhetagen.
  if (timingGramsAllowed(day, options) && options.body !== null && plannedDay !== null) {
    const guide = proteinPerMealGuideG(
      proteinReferenceWeight(options.body.weightKg, options.body.heightCm),
      day.ageYears,
    );
    const low = plannedDay.meals.find(
      (m) =>
        !m.isFill &&
        !isSnackSlot(m.slot as MealSlotId) &&
        !m.slot.startsWith('extra') &&
        m.nutrients.protein_g < guide * (1 - T.dishTolerance),
    );
    if (low !== undefined) {
      const used = new Set(plannedDay.meals.map((m) => m.recipeId));
      const side = bestProteinSide(snackCandidates, guide - low.nutrients.protein_g, used);
      return {
        code: 'timing_meal_protein_low',
        slot: low.slot as MealSlotId,
        titleDe: low.titleDe,
        extraTitleDe: side?.recipe.title_de ?? null,
      };
    }
  }
  if (timeline !== null) {
    const first = timeline.entries.find((e) => e.kind === 'session');
    if (first !== undefined && first.fromMinutes < T.earlyBeforeMinutes) {
      return { code: 'timing_early_training', slot: null, titleDe: null, extraTitleDe: null };
    }
    if (timeline.entries.some((e) => e.session?.fueling != null)) {
      return { code: 'timing_long_session', slot: null, titleDe: null, extraTitleDe: null };
    }
  }
  return null;
}

/** Erinnerung „In 1 Stunde: Snack vor dem Training“ (lokal, Standard aus – Entscheidung 8): Zeitpunkt in Minuten. */
export function preTrainingReminderMinutes(timeline: TrainingDayTimeline | null): number | null {
  const snack = timeline?.entries.find((e) => e.kind === 'pre_snack');
  if (snack === undefined) return null;
  const at = snack.fromMinutes - 60;
  return at >= 0 ? at : null;
}
