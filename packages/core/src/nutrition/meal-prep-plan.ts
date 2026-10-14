import { isoDateSchema } from '../age';
import {
  daysAfterCookDay,
  type MealPrepPlan,
  PREP_WEEKDAYS,
  type StorageMethod,
} from '../content/meal-prep-plan-schema';
import { addDays, daysBetween } from '../dates';
import { recipeTotalMinutes } from '../content/import-rules';
import { type FilteredRecipe, slotFitReasons } from './filter';
import { mealPrepDayUse, mealPrepKeeping } from './meal-prep';
import {
  buildMealPlanWeekDetailed,
  CandidatePool,
  isWeekday,
  type MealPlanInput,
  type MealPlanWeek,
  type PinnedMeal,
  pinKey,
} from './meal-plan';
import type { MealSlotId } from './timing';

/**
 * Meal-Prep-Wochenpläne anwenden (docs/PLAN-PHASE-5.md 19.6, B1, K7, G3) – Pläne sind BESTAND, nicht
 * personenbezogen; angeboten werden sie nur über diese Funktion.
 *
 * 1. Jedes Rezept des Plans läuft durch den KOMPLETTEN Filter (`filter.ts`: Ernährungsform, Schwein inkl. Gelatine
 *    nur bei `eats_pork = true`, Unverträglichkeiten, „mag ich nicht“, Schwangerschaft inkl. `heated`/`no_cook`/
 *    unbestätigter Annahme, Weglassen optionaler Zutaten, Ersatz mit erneutem Filter).
 * 2. Fällt auch nur ein Rezept heraus, wird der Plan nicht angeboten – OHNE Grund (kein Rückschluss auf
 *    Unverträglichkeit oder Schwangerschaft). Kein teilweises Belegen.
 * 3. Plätze über `meal_types` (Frühstück → Frühstück, Hauptgericht → Mittag, Snack → Snack), Mo–Fr; Abendessen
 *    bleibt frei. Fehlt der Platz im Layout der Person → nicht angeboten.
 * 4. Kochtag ist der Sonntag davor (liegt er schon zurück: heute); der Plan ersetzt die Kochtermine aus
 *    `mealprep_days` für diese Woche.
 * 5. Haltbarkeit: `storage_plan` UND R9 mit den tatsächlich verwendeten Zutaten – es gilt die sicherere Angabe
 *    (frisch vor eingefroren vor Kühlschrank).
 * 6. Portionen im Planband (B1); liegt ein Tag auch mit Faktor 0,5 über der Obergrenze → nicht angeboten (G3).
 * 7. Platz-Regeln wie im normalen Plan (`slotFitReasons`, Wächter N3 K1): Wettkampf-Rezepte nie, Zeitlimit werktags
 *    für einen Kochtag bzw. frische Tage an Werktagen – sonst nicht angeboten.
 */

export type MealPrepPlanOffer =
  | { readonly offered: true; readonly plan: MealPlanWeek }
  /** „Passt nicht zu deinen Angaben“ – bewusst ohne Grund (19.6 Nr. 2). */
  | { readonly offered: false };

const SAFETY_ORDER: Readonly<Record<StorageMethod, number>> = { fridge: 0, freeze: 1, fresh: 2 };

/** Platz im Layout der Person für einen Mahlzeiten-Typ (19.6 K7). */
function slotForMealType(
  type: 'breakfast' | 'main' | 'snack',
  layout: readonly MealSlotId[],
): MealSlotId | null {
  if (type === 'breakfast') return layout.includes('breakfast') ? 'breakfast' : null;
  if (type === 'main') {
    if (layout.includes('lunch')) return 'lunch';
    return layout.includes('main') ? 'main' : null;
  }
  if (layout.includes('snack_afternoon')) return 'snack_afternoon';
  return layout.find((slot) => slot.startsWith('snack_')) ?? null;
}

/** Wendet einen Meal-Prep-Wochenplan auf die Woche an (19.6). */
export function applyMealPrepPlan(
  mealPrepPlan: MealPrepPlan,
  input: MealPlanInput,
): MealPrepPlanOffer {
  const today = isoDateSchema.parse(input.today);
  const { targets } = input;
  const weekStart = targets.weekStart;
  if (mealPrepPlan.status === 'archived') return { offered: false };
  if (mealPrepPlan.status === 'draft' && !input.allowDrafts) return { offered: false };

  // Kochtag: Sonntag davor bzw. heute; Tage davor bleiben, wie sie sind.
  const cookOffset = Math.max(-1, daysBetween(weekStart, today));
  const prepDays = PREP_WEEKDAYS.map((weekday) => ({
    weekday,
    dayIndex: daysAfterCookDay(weekday) - 1,
  })).filter((d) => d.dayIndex >= cookOffset);
  if (prepDays.length === 0) return { offered: false };
  const cookDate = addDays(weekStart, cookOffset);

  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
  );
  // Schwangerschafts-Ausschluss, wenn er an irgendeinem Plan-Tag gilt (sichere Richtung).
  const excludePregnancy = prepDays.some(
    (d) => targets.days[d.dayIndex]?.recipeExclusions.includes('pregnancy_caution') === true,
  );
  const layout = (targets.days[0]?.slots ?? []).map((s) => s.slot);
  const maxMinutes = pool.profile.maxPrepMinutesWeekday;

  const assigned: { variant: FilteredRecipe; slot: MealSlotId }[] = [];
  for (const recipeId of mealPrepPlan.recipe_ids) {
    const recipe = input.recipes.find((r) => r.id === recipeId);
    if (recipe === undefined || !recipe.meal_prep.suitable) return { offered: false };
    const result = pool.result(recipe, excludePregnancy);
    if (!result.ok) return { offered: false };
    const taken = new Set(assigned.map((a) => a.slot));
    const slot = recipe.meal_types
      .map((type) => slotForMealType(type, layout))
      .find((s): s is MealSlotId => s !== null && !taken.has(s));
    if (slot === undefined) return { offered: false };
    // Wächter N3 K1: dieselben Platz-Regeln wie im normalen Plan (Meal-Prep-Eignung, Wettkampf nie automatisch,
    // „werktags höchstens X Minuten“, wenn der Kochtag ein Werktag ist) – sonst nicht angeboten.
    const fit = slotFitReasons(recipe, {
      slot,
      mealPrep: true,
      maxMinutes: isWeekday(cookDate) ? maxMinutes : null,
    });
    if (fit.length > 0) return { offered: false };
    assigned.push({ variant: result.value, slot });
  }

  const pins = new Map<string, PinnedMeal>();
  for (const { variant, slot } of assigned) {
    const keeping = mealPrepKeeping(variant, input.foods);
    for (const day of prepDays) {
      const date = addDays(weekStart, day.dayIndex);
      const daysAfter = day.dayIndex - cookOffset;
      const derived = mealPrepDayUse(keeping, daysAfter);
      if (derived === 'cook') {
        pins.set(pinKey(date, slot), {
          variant,
          prepKind: 'cook',
          cookDate,
          storage: null,
          mealPrepPlanId: mealPrepPlan.id,
        });
        continue;
      }
      const entry = mealPrepPlan.storage_plan.find(
        (e) => e.recipe_id === variant.recipe.id && e.weekday === day.weekday,
      );
      let method: StorageMethod = derived;
      if (entry !== undefined && SAFETY_ORDER[entry.method] > SAFETY_ORDER[method]) {
        method = entry.method;
      }
      if (method === 'freeze' && !keeping.freezable) method = 'fresh';
      // Frisch an einem Werktag: Zeitlimit werktags gilt auch hier (K1) – sonst nicht angeboten.
      if (
        method === 'fresh' &&
        maxMinutes !== null &&
        isWeekday(date) &&
        recipeTotalMinutes(variant.recipe) > maxMinutes
      ) {
        return { offered: false };
      }
      pins.set(
        pinKey(date, slot),
        method === 'fresh'
          ? {
              variant,
              prepKind: 'fresh',
              cookDate: date,
              storage: null,
              mealPrepPlanId: mealPrepPlan.id,
            }
          : {
              variant,
              prepKind: 'leftover',
              cookDate,
              storage: method,
              mealPrepPlanId: mealPrepPlan.id,
            },
      );
    }
  }

  const { aboveCeilingDays, plan } = buildMealPlanWeekDetailed(input, {
    pins,
    mealPrepPlanId: mealPrepPlan.id,
  });
  if (aboveCeilingDays.length > 0) return { offered: false };
  return { offered: true, plan };
}

/**
 * Gratis-Plan (19.6 Nr. 3, 19.9): der ERSTE Plan in fester Reihenfolge (nach ID), der für diese Person angeboten
 * wird; sonst keiner („Für deine Angaben gibt es noch keinen passenden Wochenplan“).
 */
export function selectFreeMealPrepPlan(
  plans: readonly MealPrepPlan[],
  input: MealPlanInput,
): { readonly mealPrepPlan: MealPrepPlan; readonly plan: MealPlanWeek } | null {
  const sorted = [...plans].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const mealPrepPlan of sorted) {
    const offer = applyMealPrepPlan(mealPrepPlan, input);
    if (offer.offered) return { mealPrepPlan, plan: offer.plan };
  }
  return null;
}

export interface CookDayStep {
  readonly startMin: number;
  readonly textDe: string;
  /** Minuten bis zum nächsten Schritt (Timer); null beim letzten Schritt. */
  readonly minutesUntilNext: number | null;
}

/** Kochtag-Ablauf mit Startminuten für die Timer (19.6 `cookDaySchedule`), stabil nach Startminute sortiert. */
export function cookDaySchedule(plan: Pick<MealPrepPlan, 'cook_steps'>): CookDayStep[] {
  const steps = plan.cook_steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.start_min - b.step.start_min || a.index - b.index)
    .map(({ step }) => step);
  return steps.map((step, i) => {
    const next = steps[i + 1];
    return {
      startMin: step.start_min,
      textDe: step.text_de,
      minutesUntilNext: next === undefined ? null : next.start_min - step.start_min,
    };
  });
}
