import { z } from 'zod';

import { isoDateSchema } from '../age';
import { COUPLE_PORTION_LIMITS, MEAL_SLOT_TIMES } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import type { FilteredRecipe } from './filter';
import {
  buildMealPlanWeekDetailed,
  CandidatePool,
  type MealPlanInput,
  type MealPlanWeek,
  mealTargetKcal,
  pinKey,
  type SharedMealOutcome,
  type SharedMealPlacement,
} from './meal-plan';
import { recipeBlockedOnAnyDay, recipeRatingIndex } from './ratings';
import { type RolePortionFactors, type ScaledPortion, scalePortionByRole } from './scale';
import type { MealSlotId } from './timing';

/**
 * Portionsfaktor beim gemeinsamen Kochen (docs/PLAN-PHASE-5.md 19.7 N13, KONZEPT 6.12, Wächter-Befund S1) – reine
 * Logik in `packages/core`; die Oberfläche („Gemeinsam kochen“, eigene Art.-9-Einwilligung beider Personen) kommt mit
 * dem Partner-Modus (P1, Phase 11).
 *
 * - **Faktor je Person** = Ziel-kcal der Mahlzeit ÷ kcal pro Portion, begrenzt auf 0,6–1,8 (`COUPLE_PORTION_LIMITS`).
 *   Das Ziel kommt aus dem Planband DIESER Person (`nutritionTargetsForWeek` → `clampCalorieTarget`), Anteil des
 *   Platzes × Bandmitte – genau der Startwert des Tagesausgleichs. Ohne Ziele (`no_targets`) oder ohne gültige
 *   `health_data`-Einwilligung: Faktor 1, keine Paar-Skalierung.
 * - **Beilagen getrennt (`sides`):** Alles außer der Beilage (Rolle `carb`) – auch die Eiweißquelle – bekommt für alle
 *   Personen mit Zielen denselben Faktor (der kleinste ihrer Faktoren, G-N13-2); die Beilage gleicht je Person auf ihr Ziel aus
 *   (ebenfalls 0,6–1,8). Rezept ohne Beilage → wie `uniform`. Beilagen in 10-g-Schritten, Eier ganz.
 * - **Keine eigene Schutzgrenze:** Ob der Tag im Planband bleibt, entscheidet der Tagesausgleich (`finishDay`) –
 *   nur über die übrigen Plätze und Ergänzungs-Snacks (0,5–2,0). Läge der Tag dann über der Obergrenze, isst die
 *   Person die Mahlzeit NICHT als geteilte Portion (eigener Vorschlag, S1); unter der Untergrenze Ausgleich oder
 *   `below_floor`. `clampCalorieTarget` bleibt die einzige Stelle mit Schutzgrenzen (Strukturtest K2).
 */

export const COUPLE_PORTION_MODES = ['uniform', 'sides'] as const;
export type CouplePortionMode = (typeof COUPLE_PORTION_MODES)[number];

/** Woher der Faktor kommt: Ziel der Mahlzeit, oder Faktor 1 mangels Ziel/Einwilligung/Energie des Rezepts. */
export type PortionFactorBasis = 'target' | 'no_targets' | 'no_consent' | 'no_kcal';

export interface PortionFactorResult {
  readonly factor: number;
  readonly basis: PortionFactorBasis;
  /** Wurde auf 0,6 bzw. 1,8 begrenzt? */
  readonly clamped: 'min' | 'max' | null;
}

const L = COUPLE_PORTION_LIMITS;

/** Auf 0,01 runden und auf 0,6–1,8 begrenzen. */
function clampCouple(raw: number): { value: number; clamped: 'min' | 'max' | null } {
  const rounded = Math.round(raw * 100) / 100;
  if (rounded < L.factor.min) return { value: L.factor.min, clamped: 'min' };
  if (rounded > L.factor.max) return { value: L.factor.max, clamped: 'max' };
  return { value: rounded, clamped: null };
}

const portionFactorInputSchema = z.strictObject({
  mealTargetKcal: z.number().finite().nonnegative().nullable(),
  kcalPerServing: z.number().finite().nonnegative(),
  healthDataConsent: z.boolean(),
});

/** Portionsfaktor je Person (19.7 N13): Ziel ÷ kcal je Portion, 0,6–1,8; sonst Faktor 1 mit Grund. */
export function couplePortionFactor(
  input: z.input<typeof portionFactorInputSchema>,
): PortionFactorResult {
  const {
    mealTargetKcal: target,
    kcalPerServing,
    healthDataConsent,
  } = portionFactorInputSchema.parse(input);
  if (!healthDataConsent) return { factor: 1, basis: 'no_consent', clamped: null };
  if (target === null) return { factor: 1, basis: 'no_targets', clamped: null };
  if (kcalPerServing <= 0) return { factor: 1, basis: 'no_kcal', clamped: null };
  const { value, clamped } = clampCouple(target / kcalPerServing);
  return { factor: value, basis: 'target', clamped };
}

/** Eine Person an einem geteilten Gericht. */
export interface SharedPortionPerson {
  /** Interner Schlüssel (z. B. „a“, „b“) – keine Namen, keine Körperdaten. */
  readonly key: string;
  /** Das Rezept nach dem Filter DIESER Person (Ersatzprodukte, weggelassene optionale Zutaten). */
  readonly variant: FilteredRecipe;
  /** Ziel-kcal der Mahlzeit aus IHREN Tageszielen (`mealTargetKcal`); null = keine Ziele. */
  readonly mealTargetKcal: number | null;
  readonly healthDataConsent: boolean;
}

export interface SharedPortion {
  readonly key: string;
  /** Portionsfaktor der Person (0,6–1,8 bzw. 1). */
  readonly factor: number;
  readonly basis: PortionFactorBasis;
  readonly clamped: 'min' | 'max' | null;
  /** `uniform`: alles mit dem Faktor; `sides`: Beilage getrennt; `no_side`: `sides` gewünscht, Rezept ohne Beilage. */
  readonly scaling: 'uniform' | 'sides' | 'no_side';
  readonly factors: RolePortionFactors;
  readonly portion: ScaledPortion;
}

/** kcal je Portion (Faktor 1) getrennt nach Beilage, übrigen skalierenden und nicht skalierenden Zutaten. */
function kcalParts(
  variant: FilteredRecipe,
  foods: FoodLookup,
): { side: number; main: number; fixed: number } {
  const omitted = new Set(variant.omitted);
  const subs = new Map(variant.substitutions.map((s) => [s.index, s.substituteFoodId]));
  const swaps = new Map(variant.swaps.map((s) => [s.index, s.substituteFoodId]));
  const parts = { side: 0, main: 0, fixed: 0 };
  variant.recipe.ingredients.forEach((ingredient, index) => {
    if (ingredient.optional || omitted.has(index)) return;
    const foodId = swaps.get(index) ?? subs.get(index) ?? ingredient.food_id;
    const grams = variant.facts.gramsPerServing[index] ?? 0;
    const kcal = (grams * (foods.get(foodId)?.nutrients_per_100g.kcal ?? 0)) / 100;
    if (!ingredient.scales) parts.fixed += kcal;
    else if (ingredient.role === 'carb') parts.side += kcal;
    else parts.main += kcal;
  });
  return parts;
}

const SIDE_ROUNDING = { stepG: L.sideStepG, fromG: L.sideStepFromG } as const;

/**
 * Portionen aller Personen an EINEM geteilten Gericht (19.7 N13). Personen ohne Ziel/Einwilligung bekommen genau die
 * Standardportion (Faktor 1, ohne Beilagen-Rundung). Deterministisch und unabhängig von der Reihenfolge der Personen.
 */
export function sharedMealPortions(
  persons: readonly SharedPortionPerson[],
  foods: FoodLookup,
  mode: CouplePortionMode,
): SharedPortion[] {
  z.enum(COUPLE_PORTION_MODES).parse(mode);
  if (persons.length > L.maxPersons) {
    throw new RangeError(`Höchstens ${L.maxPersons} Personen je Gericht.`);
  }
  const base = persons.map((person) => ({
    person,
    result: couplePortionFactor({
      mealTargetKcal: person.mealTargetKcal,
      kcalPerServing: person.variant.facts.perServing.kcal,
      healthDataConsent: person.healthDataConsent,
    }),
    parts: kcalParts(person.variant, foods),
  }));
  const targeted = base.filter((b) => b.result.basis === 'target');
  // Gemeinsamer Faktor für alles außer der Beilage: der KLEINSTE Faktor der Personen mit Zielen (sichere
  // Voreinstellung, Wächter N13 G-N13-2): niemand bekommt mehr Hauptkomponente als sein eigenes Ziel; wer mehr
  // braucht, gleicht über die Beilage und die übrigen Mahlzeiten aus. Reihenfolge egal.
  const mainShared = targeted.length === 0 ? 1 : Math.min(...targeted.map((b) => b.result.factor));

  return base.map(({ person, result, parts }): SharedPortion => {
    const common = { key: person.key, basis: result.basis, clamped: result.clamped };
    if (result.basis !== 'target') {
      const factors = { portion: 1, main: 1, side: 1, sideRounding: null };
      return {
        ...common,
        factor: 1,
        scaling: 'uniform',
        factors,
        portion: scalePortionByRole(person.variant, factors, foods),
      };
    }
    const f = result.factor;
    if (mode === 'uniform' || parts.side <= 0) {
      const factors = { portion: f, main: f, side: f, sideRounding: SIDE_ROUNDING };
      return {
        ...common,
        factor: f,
        scaling: mode === 'uniform' ? 'uniform' : 'no_side',
        factors,
        portion: scalePortionByRole(person.variant, factors, foods),
      };
    }
    const target = person.mealTargetKcal as number;
    const side = clampCouple((target - mainShared * parts.main - parts.fixed) / parts.side).value;
    const factors = { portion: f, main: mainShared, side, sideRounding: SIDE_ROUNDING };
    return {
      ...common,
      factor: f,
      scaling: 'sides',
      factors,
      portion: scalePortionByRole(person.variant, factors, foods),
    };
  });
}

/** Gesamtmenge zum Kochen: Summe der Portionen je Zutat (gleiches Lebensmittel und gleiche Einheit). */
export interface CookingAmount {
  readonly index: number;
  readonly foodId: string;
  readonly unit: ScaledPortion['ingredients'][number]['unit'];
  readonly amount: number;
  readonly grams: number;
}

export function sharedCookingAmounts(portions: readonly ScaledPortion[]): CookingAmount[] {
  const sums = new Map<string, CookingAmount>();
  for (const portion of portions) {
    for (const i of portion.ingredients) {
      const key = `${i.index}|${i.foodId}|${i.unit}`;
      const before = sums.get(key);
      sums.set(key, {
        index: i.index,
        foodId: i.foodId,
        unit: i.unit,
        amount: Number(((before?.amount ?? 0) + i.amount).toFixed(6)),
        grams: Number(((before?.grams ?? 0) + i.grams).toFixed(6)),
      });
    }
  }
  return [...sums.values()].sort(
    (a, b) => a.index - b.index || (a.foodId < b.foodId ? -1 : a.foodId > b.foodId ? 1 : 0),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Wochen mit geteilten Mahlzeiten
// ---------------------------------------------------------------------------------------------------------

const MEAL_SLOT_IDS = Object.keys(MEAL_SLOT_TIMES) as [MealSlotId, ...MealSlotId[]];

export const sharedMealsRequestSchema = z.strictObject({
  mode: z.enum(COUPLE_PORTION_MODES),
  persons: z
    .array(
      z.strictObject({
        key: z.string().regex(/^[a-z0-9_-]{1,40}$/, 'Schlüssel: 1–40 Zeichen a–z, 0–9, _ oder -.'),
        healthDataConsent: z.boolean(),
      }),
    )
    .min(1)
    .max(L.maxPersons)
    .refine((p) => new Set(p.map((x) => x.key)).size === p.length, 'Jede Person nur einmal.'),
  meals: z
    .array(
      z.strictObject({
        date: isoDateSchema,
        slot: z.enum(MEAL_SLOT_IDS),
        recipeId: contentIdSchema,
      }),
    )
    .max(7 * MEAL_SLOT_IDS.length)
    .refine(
      (m) => new Set(m.map((x) => pinKey(x.date, x.slot))).size === m.length,
      'Je Tag und Platz höchstens ein geteiltes Gericht.',
    ),
});

export interface SharedMealsPerson {
  readonly key: string;
  /** Wie `buildMealPlanWeek` – Ziele aus `nutritionTargetsForWeek` DIESER Person. */
  readonly input: MealPlanInput;
  /** Gültige `health_data`-Einwilligung (ohne: Faktor 1, keine Paar-Skalierung). */
  readonly healthDataConsent: boolean;
}

export interface SharedMealsRequest {
  readonly mode: CouplePortionMode;
  readonly persons: readonly SharedMealsPerson[];
  readonly meals: readonly {
    readonly date: string;
    readonly slot: MealSlotId;
    readonly recipeId: string;
  }[];
}

export interface SharedMealPortionInfo {
  readonly key: string;
  readonly factor: number;
  readonly basis: PortionFactorBasis;
  readonly scaling: SharedPortion['scaling'];
  readonly mainFactor: number;
  readonly sideFactor: number;
}

export interface SharedMealsResult {
  readonly persons: readonly {
    readonly key: string;
    readonly plan: MealPlanWeek;
    readonly outcomes: readonly SharedMealOutcome[];
  }[];
  /** Je geteiltem Gericht die Portionen der Personen, die es wirklich teilen (nur intern, keine Ziele/Körperdaten). */
  readonly meals: readonly {
    readonly date: string;
    readonly slot: MealSlotId;
    readonly recipeId: string;
    readonly portions: readonly SharedMealPortionInfo[];
  }[];
}

/**
 * Wochen mehrerer Personen mit geteilten Mahlzeiten (19.7 N13, Logik für P1). Je Gericht: Filter, Daumen runter und
 * Platz je Person; Portionen nur unter den Personen, die es teilen; jede Woche über `buildMealPlanWeekDetailed` mit dem
 * Tagesausgleich der Person. Entfällt das Teilen für eine Person (z. B. Obergrenze), werden die Portionen der übrigen
 * neu berechnet (Beilagen-Modus) – so lange, bis sich nichts mehr ändert. Deterministisch.
 */
export function planSharedMeals(request: SharedMealsRequest): SharedMealsResult {
  const parsed = sharedMealsRequestSchema.parse({
    mode: request.mode,
    persons: request.persons.map((p) => ({ key: p.key, healthDataConsent: p.healthDataConsent })),
    meals: request.meals.map((m) => ({ date: m.date, slot: m.slot, recipeId: m.recipeId })),
  });
  const weekStart = request.persons[0]?.input.targets.weekStart;
  if (request.persons.some((p) => p.input.targets.weekStart !== weekStart)) {
    throw new Error('Alle Personen müssen dieselbe Woche planen.');
  }
  // Ohne Einwilligung dürfen keine Ziele aus Körperdaten/Flags hineinkommen (Wächter N13 S3).
  const mismatch = request.persons.find(
    (p) => !p.healthDataConsent && p.input.targets.usesHealthData,
  );
  if (mismatch !== undefined) {
    throw new Error(
      `Person „${mismatch.key}“: ohne Einwilligung keine Ziele aus Gesundheitsdaten (Einwilligung und Ziele passen nicht zusammen).`,
    );
  }
  const foods = request.persons[0]?.input.foods ?? new Map();
  if (request.persons.some((p) => p.input.foods !== foods)) {
    throw new Error('Alle Personen brauchen denselben Lebensmittel-Katalog.');
  }
  const persons = request.persons.map((p) => ({
    ...p,
    today: isoDateSchema.parse(p.input.today),
    pool: new CandidatePool(
      p.input.recipes,
      p.input.foods,
      p.input.profile,
      p.input.allowDrafts,
      p.input.redRecipeIds,
      p.input.substitutions,
      recipeRatingIndex(p.input.ratings, p.input.recipePreferences),
    ),
  }));
  const meals = parsed.meals;

  /** Rezept nach dem Filter der Person an diesem Tag; null = kann nicht teilen (Grund liefert die Woche). */
  const variantFor = (
    person: (typeof persons)[number],
    meal: (typeof meals)[number],
  ): { variant: FilteredRecipe; target: number | null } | null => {
    const day = person.input.targets.days.find((d) => d.date === meal.date);
    if (day === undefined || meal.date < person.today) return null;
    if (!day.slots.some((s) => s.slot === meal.slot)) return null;
    const recipe = person.input.recipes.find((r) => r.id === meal.recipeId);
    if (recipe === undefined) return null;
    const r = person.pool.result(recipe, day.recipeExclusions.includes('pregnancy_caution'));
    if (!r.ok || recipeBlockedOnAnyDay(person.pool.ratings, recipe.id, [meal.date])) return null;
    return { variant: r.value, target: mealTargetKcal(day, meal.slot) };
  };

  // Wer teilt welches Gericht (anfangs alle, die können). Wer in der Woche nicht teilen kann (Obergrenze, Platz
  // belegt), fällt heraus; sein Grund bleibt in `dropped`, die Woche wird ohne diese Mahlzeit geplant.
  const sharing = meals.map(
    (meal) => new Set(persons.filter((p) => variantFor(p, meal) !== null).map((p) => p.key)),
  );
  const dropped = new Map<string, SharedMealOutcome[]>(persons.map((p) => [p.key, []]));
  const ONE: RolePortionFactors = { portion: 1, main: 1, side: 1, sideRounding: null };
  type Built = ReturnType<typeof buildMealPlanWeekDetailed>;
  const built = new Map<string, { signature: string; result: Built }>();
  let portionsByMeal: SharedPortion[][] = [];

  const maxRounds = meals.length * persons.length + 1;
  for (let round = 0; round <= maxRounds; round += 1) {
    portionsByMeal = meals.map((meal, m) =>
      sharedMealPortions(
        persons.flatMap((p): SharedPortionPerson[] => {
          if (!(sharing[m] as Set<string>).has(p.key)) return [];
          const v = variantFor(p, meal);
          return v === null
            ? []
            : [
                {
                  key: p.key,
                  variant: v.variant,
                  mealTargetKcal: v.target,
                  healthDataConsent: p.healthDataConsent,
                },
              ];
        }),
        foods,
        parsed.mode,
      ),
    );
    let changed = false;
    for (const person of persons) {
      const droppedKeys = new Set(
        (dropped.get(person.key) ?? []).map((o) => pinKey(o.date, o.slot)),
      );
      // Geteilt wird, wer im Kreis ist; wer gar nicht teilen kann, bekommt die Mahlzeit trotzdem übergeben (Faktor 1,
      // wird nie verwendet), damit die Woche den Grund nennt.
      const placements: SharedMealPlacement[] = meals.flatMap((meal, m) => {
        if (droppedKeys.has(pinKey(meal.date, meal.slot))) return [];
        const portion = portionsByMeal[m]?.find((x) => x.key === person.key);
        return [
          {
            date: meal.date,
            slot: meal.slot,
            recipeId: meal.recipeId,
            factors: portion?.factors ?? ONE,
          },
        ];
      });
      const signature = JSON.stringify(placements);
      const before = built.get(person.key);
      const result =
        before !== undefined && before.signature === signature
          ? before.result
          : buildMealPlanWeekDetailed(person.input, { shared: placements });
      built.set(person.key, { signature, result });
      meals.forEach((meal, m) => {
        const set = sharing[m] as Set<string>;
        const outcome = result.sharedOutcomes.find(
          (o) => o.date === meal.date && o.slot === meal.slot,
        );
        if (set.has(person.key) && outcome !== undefined && !outcome.shared) {
          set.delete(person.key);
          dropped.get(person.key)?.push(outcome);
          changed = true;
        }
      });
    }
    if (!changed) break;
  }

  return {
    persons: persons.map((p) => {
      const result = (built.get(p.key) as { result: Built }).result;
      const outcomes = [...result.sharedOutcomes, ...(dropped.get(p.key) ?? [])].sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0,
      );
      return { key: p.key, plan: result.plan, outcomes };
    }),
    meals: meals.map((meal, m) => ({
      date: meal.date,
      slot: meal.slot,
      recipeId: meal.recipeId,
      portions: (portionsByMeal[m] ?? [])
        .filter((x) => (sharing[m] as Set<string>).has(x.key))
        .map((x) => ({
          key: x.key,
          factor: x.factor,
          basis: x.basis,
          scaling: x.scaling,
          mainFactor: x.factors.main,
          sideFactor: x.factors.side,
        })),
    })),
  };
}
