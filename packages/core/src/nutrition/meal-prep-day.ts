import { z } from 'zod';

import { isoDateSchema } from '../age';
import type { MealPrepPlan } from '../content/meal-prep-plan-schema';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type { MealPlanWeek } from './meal-plan';
import { type CookDayStep, cookDaySchedule } from './meal-prep-plan';

/**
 * Meal-Prep-Kochtag in der App (docs/PLAN-PHASE-5.md 19.6 „Meal-Prep-Kochtag mit Timern“, KONZEPT 6.7, Etappe N5b):
 * Übersicht des Kochtags aus dem GEWÄHLTEN Plan der Woche, Auftau-Hinweise aus der Aufbewahrung (`storage`, die
 * `applyMealPrepPlan` aus `storage_plan` und R9 festgelegt hat – die sicherere Angabe gilt) und der Ablauf mit Timern.
 *
 * Die Timer rechnen nur mit Zeitstempeln (wie der Pausentimer): Start des Kochtags + Startminute je Schritt. So laufen
 * sie nach Neuladen, im Hintergrund und ohne Netz weiter. Keine Zahlen zu Kalorien (Schalter „Zahlen aus“, S12).
 */

export interface CookDayRecipe {
  readonly recipeId: string;
  readonly titleDe: string;
  /** Mahlzeiten, die aus diesem Kochtag kommen (Kochtag selbst + Reste). */
  readonly mealDates: readonly string[];
  /** Tage aus dem Kühlschrank. */
  readonly fridgeDates: readonly string[];
  /** Tage aus dem Gefrierfach (Portionen am Kochtag einfrieren, am Vorabend auftauen). */
  readonly freezeDates: readonly string[];
  /** Tage, an denen dieses Gericht frisch gekocht wird (Haltbarkeit reicht nicht, kein Einfrieren). */
  readonly freshDates: readonly string[];
}

export interface CookDayOverview {
  readonly mealPrepPlanId: string;
  readonly cookDate: string;
  readonly recipes: readonly CookDayRecipe[];
  readonly steps: readonly CookDayStep[];
}

/**
 * Kochtag des gewählten Meal-Prep-Plans der Woche; null, wenn die Woche diesen Plan nicht (mehr) nutzt – z. B. nach
 * einer automatischen Neuplanung, die die Plan-Rezepte ersetzt hat (19.6 Nr. 2).
 */
export function cookDayOverview(
  plan: MealPlanWeek,
  mealPrepPlan: Pick<MealPrepPlan, 'id' | 'cook_steps'>,
): CookDayOverview | null {
  if (plan.mealPrepPlanId !== mealPrepPlan.id) return null;
  const meals = plan.days.flatMap((day) =>
    day.meals
      .filter((meal) => meal.mealPrepPlanId === mealPrepPlan.id && !meal.isFill)
      .map((meal) => ({ day, meal })),
  );
  const prepared = meals.filter(({ meal }) => meal.prepKind !== 'fresh');
  if (prepared.length === 0) return null;
  const cookDate = prepared.map(({ meal }) => meal.cookDate).reduce((a, b) => (a < b ? a : b));
  const byRecipe = new Map<string, { titleDe: string; entries: typeof meals }>();
  for (const entry of meals) {
    const group = byRecipe.get(entry.meal.recipeId) ?? {
      titleDe: entry.meal.titleDe,
      entries: [],
    };
    group.entries.push(entry);
    byRecipe.set(entry.meal.recipeId, group);
  }
  const recipes = [...byRecipe.entries()]
    .map(([recipeId, { titleDe, entries }]): CookDayRecipe => {
      const fromCookDay = entries.filter(
        ({ meal }) => meal.prepKind !== 'fresh' && meal.cookDate === cookDate,
      );
      return {
        recipeId,
        titleDe,
        mealDates: fromCookDay.map(({ day }) => day.date),
        fridgeDates: fromCookDay
          .filter(({ meal }) => meal.prepKind === 'leftover' && meal.storage === 'fridge')
          .map(({ day }) => day.date),
        freezeDates: fromCookDay
          .filter(({ meal }) => meal.prepKind === 'leftover' && meal.storage === 'freeze')
          .map(({ day }) => day.date),
        freshDates: entries
          .filter(({ meal }) => meal.prepKind === 'fresh')
          .map(({ day }) => day.date),
      };
    })
    .filter((r) => r.mealDates.length > 0 || r.freshDates.length > 0)
    .sort((a, b) => a.titleDe.localeCompare(b.titleDe, 'de') || (a.recipeId < b.recipeId ? -1 : 1));
  return {
    mealPrepPlanId: mealPrepPlan.id,
    cookDate,
    recipes,
    steps: cookDaySchedule(mealPrepPlan),
  };
}

export interface ThawHint {
  /** Tag, an dem die eingefrorene Portion gegessen wird. */
  readonly forDate: string;
  readonly slot: string;
  readonly recipeId: string;
  readonly titleDe: string;
}

/**
 * Auftau-Hinweise für `date` (19.6 Nr. 6): Portionen, die MORGEN aus dem Gefrierfach kommen – „Heute Abend in den
 * Kühlschrank legen“. Nur eingefrorene Reste; leer, wenn morgen nichts aufgetaut werden muss.
 */
export function thawHints(plan: MealPlanWeek, date: string): ThawHint[] {
  const tomorrow = addDays(isoDateSchema.parse(date), 1);
  const day = plan.days.find((d) => d.date === tomorrow);
  if (day === undefined) return [];
  return day.meals
    .filter((meal) => meal.prepKind === 'leftover' && meal.storage === 'freeze')
    .map((meal) => ({
      forDate: tomorrow,
      slot: meal.slot,
      recipeId: meal.recipeId,
      titleDe: meal.titleDe,
    }));
}

// ---------------------------------------------------------------------------------------------------------
// Timer des Kochtags (Zeitstempel)
// ---------------------------------------------------------------------------------------------------------

export interface CookDayProgress {
  /** Vergangene Sekunden seit dem Start (nie negativ). */
  readonly elapsedS: number;
  /** Aktueller Schritt (Index in `steps`); −1 = erster Schritt beginnt erst später. */
  readonly currentIndex: number;
  /** Nächster Schritt; null nach dem letzten. */
  readonly nextIndex: number | null;
  /** Sekunden bis zum nächsten Schritt; null nach dem letzten. */
  readonly secondsToNext: number | null;
  /** Alle Schritte haben begonnen. */
  readonly allStarted: boolean;
}

const timestampSchema = z.number().int().min(0).max(8.64e15);

/** Fortschritt aus Start-Zeitstempel und jetzt (ms) – rein, dadurch unabhängig von Hintergrund und Neuladen. */
export function cookDayProgress(
  steps: readonly Pick<CookDayStep, 'startMin'>[],
  startedAtMs: number,
  nowMs: number,
): CookDayProgress {
  const start = timestampSchema.parse(startedAtMs);
  const now = timestampSchema.parse(nowMs);
  const elapsedS = Math.max(0, Math.floor((now - start) / 1000));
  let currentIndex = -1;
  steps.forEach((step, index) => {
    if (step.startMin * 60 <= elapsedS) currentIndex = index;
  });
  const nextIndex = currentIndex + 1 < steps.length ? currentIndex + 1 : null;
  const next = nextIndex === null ? undefined : steps[nextIndex];
  return {
    elapsedS,
    currentIndex,
    nextIndex,
    secondsToNext: next === undefined ? null : next.startMin * 60 - elapsedS,
    allStarted: nextIndex === null,
  };
}

export interface CookDayAlarm {
  readonly index: number;
  /** Zeitpunkt (ms) des Schritt-Beginns. */
  readonly atMs: number;
  readonly textDe: string;
}

/**
 * Zeitpunkte für lokale Benachrichtigungen (19.6): je Schritt, der nach `nowMs` beginnt. Schritte, die schon begonnen
 * haben, bekommen keine Benachrichtigung mehr.
 */
export function cookDayAlarms(
  steps: readonly Pick<CookDayStep, 'startMin' | 'textDe'>[],
  startedAtMs: number,
  nowMs: number,
): CookDayAlarm[] {
  const start = timestampSchema.parse(startedAtMs);
  const now = timestampSchema.parse(nowMs);
  return steps.flatMap((step, index) => {
    const atMs = start + step.startMin * 60_000;
    return atMs > now ? [{ index, atMs, textDe: step.textDe }] : [];
  });
}

/**
 * Woche, für die ein Meal-Prep-Plan vorgeschlagen wird: Montag bis Freitag die laufende Woche (Kochtag heute, falls
 * der Sonntag schon vorbei ist), ab Samstag die nächste – `applyMealPrepPlan` bietet die laufende Woche ab Samstag
 * nicht mehr an (Umsetzungsstand N3).
 */
export function defaultMealPrepWeekStart(today: string): string {
  const date = isoDateSchema.parse(today);
  const monday = startOfIsoWeek(date);
  return isoWeekday(date) >= 6 ? addDays(monday, 7) : monday;
}
