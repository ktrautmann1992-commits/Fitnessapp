import { isoDateSchema } from '../age';
import { NUTRIENT_TIMING, PORTION_SCALE_LIMITS } from '../constants';
import { type FilteredRecipe, mealTypeForSlot } from './filter';
import {
  assembleWeek,
  CandidatePool,
  type DayContext,
  finishDay,
  fixedMealSelection,
  type MealPlanInput,
  type MealPlanWeek,
  type PlannedMeal,
  type PlannedMealDay,
  rankSlotCandidates,
  repairOrphanLeftovers,
  type SelectedMeal,
  variantForMeal,
  WeekState,
} from './meal-plan';
import {
  mealPlanMatchesRecipes,
  type MealPlanResolution,
  resolveMealPlanWeek,
} from './meal-plan-store';
import { recipeRatingIndex } from './ratings';
import { needsAutomaticReplan } from './replan';
import { scalePortion } from './scale';
import type { ShoppingList } from './shopping-list';
import type { NutritionDayTargets } from './targets';
import type { MealRole, MealSlotId } from './timing';
import { preWorkoutIssues, type SlotMacroTarget } from './training-meal-targets';

/**
 * Nährstoff-Timing 2 (docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitt 6, T1): Die Mahlzeiten wandern mit dem Training.
 * Ändern sich die Rollen vor/nach dem Training an einem Tag ab heute (Einheit verschoben, Uhrzeit geändert, „Tag
 * tauschen“), plant diese Datei NUR diese Tage neu:
 * - Gerichte, die nicht mehr zur Rolle passen, werden gegen passende getauscht (Entscheidung 9), alle anderen bleiben;
 * - NIE automatisch geändert: als gegessen eingetragene Mahlzeiten (Portion bleibt fest), selbst gewählte bzw.
 *   getauschte Gerichte (`chosen`, Zutaten-Tausch), Meal-Prep/Reste und geteilte Mahlzeiten – dort höchstens ein
 *   Vorschlag („Für vor dem Training wäre X besser“);
 * - danach wird der Tag mit den Regeln des Essensplans ausgeglichen (`finishDay`: Planband aus den neuen Tageszielen,
 *   alle Schutzgrenzen wie immer – die Grenzen selbst rechnet nur `clampCalorieTarget`).
 * „Rückgängig“ (`undoTrainingAdaptation`): die vorigen Gerichte kommen als „selbst gewählt“ zurück.
 * Ohne Rollen-Änderung (Altbestand ohne Uhrzeit und ohne „Trainingszeit“) bleibt alles wie bisher (`resolveMealPlanWeek`).
 */

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

export interface TrainingMealProtection {
  /** Als gegessen eingetragene Plan-Mahlzeiten (Ernährungstagebuch, Quelle Plan) als `datum|platz`. */
  readonly eaten: ReadonlySet<string>;
}

export const NO_TRAINING_PROTECTION: TrainingMealProtection = { eaten: new Set() };

export interface TrainingMealChange {
  readonly date: string;
  readonly slot: MealSlotId;
  readonly role: MealRole;
  readonly fromRecipeId: string;
  readonly fromTitleDe: string;
  readonly toRecipeId: string;
  readonly toTitleDe: string;
}

/** Vorschlag statt Tausch (selbst gewählt): „Für vor dem Training wäre X besser – tauschen?“ */
export interface TrainingMealSuggestion {
  readonly date: string;
  readonly slot: MealSlotId;
  readonly role: MealRole;
  readonly currentTitleDe: string;
  readonly betterRecipeId: string;
  readonly betterTitleDe: string;
}

export interface TrainingAdaptation {
  readonly plan: MealPlanWeek;
  /** Neu ausgeglichene Tage (ab heute). */
  readonly dates: readonly string[];
  readonly changes: readonly TrainingMealChange[];
  readonly suggestions: readonly TrainingMealSuggestion[];
}

const slotKey = (date: string, slot: string) => `${date}|${slot}`;

/** Tage ab heute, an denen die gespeicherten Rollen nicht mehr zu den Tageszielen passen (gleiche Plätze). */
export function trainingRoleMismatchDays(
  plan: MealPlanWeek,
  targets: readonly NutritionDayTargets[],
  today: string,
): string[] {
  const day0 = isoDateSchema.parse(today);
  return plan.days.flatMap((day) => {
    if (day.date < day0) return [];
    const t = targets.find((d) => d.date === day.date);
    if (t === undefined) return [];
    const mismatch = day.meals.some((m) => {
      if (m.isFill) return false;
      const slot = t.slots.find((s) => s.slot === m.slot);
      return slot !== undefined && slot.role !== m.role;
    });
    return mismatch ? [day.date] : [];
  });
}

/**
 * Passt die Mahlzeit zur Rolle (bei ihrer Portion)? Vor dem Training: keine Überschreitung der Fett-/Ballaststoff-
 * Grenzen; nach dem Training (nur mit Richtwert): Eiweiß höchstens ±15 % unter dem Richtwert. Ohne Rolle immer.
 */
export function mealFitsRole(
  role: MealRole,
  portion: PlannedMeal['nutrients'],
  target: SlotMacroTarget | null,
): boolean {
  if (role === 'pre' || role === 'pre_snack') return preWorkoutIssues(role, portion).length === 0;
  if (role === 'post' && target?.proteinGuideG != null) {
    return portion.protein_g >= target.proteinGuideG * (1 - NUTRIENT_TIMING.dishTolerance);
  }
  return true;
}

/** Wird die Mahlzeit nie automatisch getauscht (gegessen, selbst gewählt, Tausch, Meal-Prep, Reste, geteilt)? */
export function mealProtected(
  date: string,
  meal: PlannedMeal,
  protection: TrainingMealProtection,
): boolean {
  return (
    protection.eaten.has(slotKey(date, meal.slot)) ||
    meal.chosen === true ||
    meal.shared === true ||
    (meal.ingredientSwaps?.length ?? 0) > 0 ||
    meal.mealPrepPlanId !== null ||
    meal.prepKind !== 'fresh' ||
    meal.fixed
  );
}

/**
 * Passt den gespeicherten Plan an geänderte Rollen an (Regeln oben). null = nichts zu tun oder nicht sicher möglich
 * (andere Plätze, Rezept besteht den Filter nicht mehr, Tag läge über der Obergrenze) – dann gilt `resolveMealPlanWeek`
 * wie bisher.
 */
export function adaptMealPlanToTraining(
  plan: MealPlanWeek,
  input: PlanInput,
  protection: TrainingMealProtection = NO_TRAINING_PROTECTION,
  options: { readonly forceDates?: readonly string[] } = {},
): TrainingAdaptation | null {
  const today = isoDateSchema.parse(input.today);
  if (plan.weekStart !== input.targets.weekStart) return null;
  const dates = [
    ...new Set([
      ...trainingRoleMismatchDays(plan, input.targets.days, today),
      ...(options.forceDates ?? []).filter((d) => d >= today),
    ]),
  ].sort();
  if (dates.length === 0) return null;

  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
    input.substitutions,
    recipeRatingIndex(input.ratings, input.recipePreferences),
  );
  const state = new WeekState();
  const refilter = (m: PlannedMeal, excludePregnancy: boolean): FilteredRecipe | null => {
    const recipe = input.recipes.find((r) => r.id === m.recipeId && r.version === m.recipeVersion);
    const r =
      recipe === undefined ? null : pool.result(recipe, excludePregnancy, m.ingredientSwaps);
    return r !== null && r.ok ? variantForMeal(r.value, m, input.foods) : null;
  };
  plan.days.forEach((d, i) =>
    d.meals.forEach((m) => {
      const v = refilter(m, false);
      if (v !== null) state.record(v, i, input.foods, m.prepKind !== 'leftover');
    }),
  );
  const inWeek = new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)));
  const changes: TrainingMealChange[] = [];
  const suggestions: TrainingMealSuggestion[] = [];
  const days: PlannedMealDay[] = [...plan.days];

  for (const date of dates) {
    const dayIndex = plan.days.findIndex((d) => d.date === date);
    const day = plan.days[dayIndex];
    const dayTargets = input.targets.days.find((d) => d.date === date);
    if (day === undefined || dayTargets === undefined) return null;
    const ctx: DayContext = {
      targets: dayTargets,
      dayIndex,
      weekStart: plan.weekStart,
      variant: plan.variant,
      pool,
      state,
    };
    const exclude = dayTargets.recipeExclusions.includes('pregnancy_caution');
    const mealTarget = (slot: MealSlotId) =>
      dayTargets.trainingTiming?.mealTargets?.find((t) => t.slot === slot) ?? null;
    const selected: SelectedMeal[] = [];
    for (const meal of day.meals) {
      if (meal.isFill) continue;
      const info = dayTargets.slots.find((s) => s.slot === meal.slot);
      if (info === undefined) return null;
      const variant = refilter(meal, exclude);
      if (variant === null) return null;
      const slot = info.slot;
      const role = info.role;
      const eaten = protection.eaten.has(slotKey(date, slot));
      const keep = (v: FilteredRecipe, extra: Partial<SelectedMeal> = {}): SelectedMeal => ({
        slot,
        role,
        share: info.share,
        variant: v,
        prepKind: meal.prepKind,
        cookDate: meal.cookDate,
        storage: meal.storage,
        mealPrepPlanId: meal.mealPrepPlanId,
        pinned: meal.mealPrepPlanId !== null,
        ...fixedMealSelection(meal),
        // Gegessen: Portion bleibt genau, wie eingetragen (nie automatisch ändern).
        ...(eaten ? { fixedFactor: meal.factor } : {}),
        ...extra,
      });
      const fits = mealFitsRole(role, meal.nutrients, mealTarget(slot));
      if (fits) {
        selected.push(keep(variant));
        continue;
      }
      // Passende Kandidaten bei der voraussichtlichen Portion (Anteil × Bandmitte); zuerst Rezepte, die in dieser Woche
      // noch nicht vorkommen, sonst innerhalb der Wiederholungsgrenzen und nicht schon an diesem Tag.
      const band = dayTargets.band;
      const fitsAt = (c: FilteredRecipe) => {
        const kcal = c.facts.perServing.kcal;
        const factor =
          band === null || kcal <= 0
            ? 1
            : Math.min(
                Math.max((info.share * (band.min + band.max)) / 2 / kcal, PORTION_SCALE_LIMITS.min),
                PORTION_SCALE_LIMITS.max,
              );
        return mealFitsRole(role, scalePortion(c, factor, input.foods).nutrients, mealTarget(slot));
      };
      const today = new Set(day.meals.map((m) => m.recipeId));
      const fitting =
        rankSlotCandidates(ctx, slot, role, info.share, inWeek).find(fitsAt) ??
        rankSlotCandidates(ctx, slot, role, info.share, today).find(
          (c) => state.withinRepeatLimits(c.recipe.id, mealTypeForSlot(slot), dayIndex) && fitsAt(c),
        );
      if (mealProtected(date, meal, protection)) {
        selected.push(keep(variant));
        if (!eaten && fitting !== undefined && meal.chosen === true) {
          suggestions.push({
            date,
            slot,
            role,
            currentTitleDe: meal.titleDe,
            betterRecipeId: fitting.recipe.id,
            betterTitleDe: fitting.recipe.title_de,
          });
        }
        continue;
      }
      if (fitting === undefined) {
        // Nichts Passenderes: das bisherige Gericht bleibt (ehrlicher Hinweis in der Zeitleiste).
        selected.push(keep(variant));
        continue;
      }
      inWeek.add(fitting.recipe.id);
      selected.push({
        slot,
        role,
        share: info.share,
        variant: fitting,
        prepKind: 'fresh',
        cookDate: date,
        storage: null,
        mealPrepPlanId: null,
        pinned: false,
      });
      changes.push({
        date,
        slot,
        role,
        fromRecipeId: meal.recipeId,
        fromTitleDe: meal.titleDe,
        toRecipeId: fitting.recipe.id,
        toTitleDe: fitting.recipe.title_de,
      });
    }
    const slotOrder = new Map(dayTargets.slots.map((s, i) => [s.slot, i]));
    selected.sort((a, b) => (slotOrder.get(a.slot) ?? 0) - (slotOrder.get(b.slot) ?? 0));
    const keptNotices = day.notices.filter(
      (n) => n === 'meal_prep_fresh_days' || n === 'recipe_repeated',
    );
    const finished = finishDay(ctx, selected, day.emptySlots, keptNotices, { allowDrop: false });
    if (finished.aboveCeiling) return null;
    days[dayIndex] = finished.day;
  }

  return {
    plan: assembleWeek(repairOrphanLeftovers(days, plan.weekStart), {
      weekStart: plan.weekStart,
      variant: plan.variant,
      usesHealthData: plan.usesHealthData,
      mealPrepPlanId: plan.mealPrepPlanId,
    }),
    dates,
    changes,
    suggestions,
  };
}

/**
 * „Rückgängig“: die Gerichte vor der Anpassung kommen zurück – als „selbst gewählt“ (werden danach nicht wieder
 * automatisch getauscht). Portionen werden für die aktuellen Tagesziele neu ausgeglichen. null = nicht möglich.
 */
export function undoTrainingAdaptation(
  previous: MealPlanWeek,
  adaptation: Pick<TrainingAdaptation, 'changes' | 'dates'>,
  input: PlanInput,
  protection: TrainingMealProtection = NO_TRAINING_PROTECTION,
): MealPlanWeek | null {
  const changed = new Set(adaptation.changes.map((c) => slotKey(c.date, c.slot)));
  const marked: MealPlanWeek = {
    ...previous,
    days: previous.days.map((day) => ({
      ...day,
      meals: day.meals.map((m) =>
        changed.has(slotKey(day.date, m.slot)) ? { ...m, chosen: true as const } : m,
      ),
    })),
  };
  const result = adaptMealPlanToTraining(marked, input, protection, {
    forceDates: adaptation.dates,
  });
  return result === null ? null : result.plan;
}

/** Ergebnis wie `resolveMealPlanWeek`, dazu die Anpassung ans Training (sonst null). */
export type TrainingMealPlanResolution = MealPlanResolution & {
  readonly training: TrainingAdaptation | null;
};

/**
 * Gespeicherten Plan auflösen (6.6) – zuerst Anpassung ans Training (oben). Bleibt danach noch etwas zu tun (anderer
 * Grund für die automatische Neuplanung), gilt wie bisher `resolveMealPlanWeek` (sichere Richtung).
 */
export function resolveMealPlanWeekWithTraining(
  stored: MealPlanWeek | null,
  input: PlanInput,
  protection: TrainingMealProtection = NO_TRAINING_PROTECTION,
): TrainingMealPlanResolution {
  if (
    stored !== null &&
    stored.weekStart === input.targets.weekStart &&
    mealPlanMatchesRecipes(stored, input.recipes, input.foods, input.substitutions)
  ) {
    const adaptation = adaptMealPlanToTraining(stored, input, protection);
    if (adaptation !== null && !needsAutomaticReplan(adaptation.plan, input).needed) {
      return {
        action: 'replanned',
        plan: adaptation.plan,
        reasons: ['training_changed'],
        training: adaptation,
      };
    }
  }
  return { ...resolveMealPlanWeek(stored, input), training: null };
}

/** Einkaufsliste nach einer Anpassung ans Training (Plan 6: „Einkaufsliste angepasst“, Abgehaktes bleibt abgehakt). */
export interface ShoppingListChanges {
  /** Neu auf der Liste (Bezeichnungen, sortiert). */
  readonly added: readonly string[];
  /** Nicht mehr nötig (entfernt bzw. abgehakt und „nicht mehr im Plan“). */
  readonly removed: readonly string[];
  /** Andere Menge. */
  readonly changed: readonly string[];
}

/** Unterschied zweier Einkaufslisten (eigene Einträge zählen nicht). */
export function shoppingListChanges(
  before: Pick<ShoppingList, 'items'> | null,
  after: Pick<ShoppingList, 'items'> | null,
): ShoppingListChanges {
  const planItems = (list: Pick<ShoppingList, 'items'> | null) =>
    new Map((list?.items ?? []).filter((i) => !i.isManual).map((i) => [i.itemKey, i]));
  const old = planItems(before);
  const next = planItems(after);
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const [key, item] of next) {
    const prev = old.get(key);
    if (item.notInPlan) {
      if (prev !== undefined && !prev.notInPlan) removed.push(item.labelDe);
    } else if (prev === undefined || prev.notInPlan) added.push(item.labelDe);
    else if (prev.amount !== item.amount || prev.unit !== item.unit) changed.push(item.labelDe);
  }
  for (const [key, item] of old) {
    if (!next.has(key) && !item.notInPlan) removed.push(item.labelDe);
  }
  const sort = (list: string[]) => [...new Set(list)].sort((a, b) => a.localeCompare(b, 'de'));
  return { added: sort(added), removed: sort(removed), changed: sort(changed) };
}

/** Hat sich die Liste geändert? */
export function shoppingListChanged(changes: ShoppingListChanges): boolean {
  return changes.added.length + changes.removed.length + changes.changed.length > 0;
}
