import { z } from 'zod';

import { isoDateSchema } from '../age';
import { RECIPE_SERVINGS_PICKER, SHOPPING_LIST_EXTRAS, SHOPPING_LIST_ROUNDING } from '../constants';
import { SHOPPING_CATEGORIES } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import { addDays } from '../dates';
import { foodAllowedForPerson } from './filter';
import { CandidatePool, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { weekExcludesPregnancyCaution } from './person';
import { type ScaledIngredient, scaleRecipeForServings } from './scale';
import { mealPlanProfileSchema, weekStartSchema } from './schemas';
import {
  buildShoppingList,
  mergeShoppingList,
  type ShoppingList,
  type ShoppingListItem,
} from './shopping-list';
import { stableHash } from './stable-hash';

/**
 * Gespeicherte Einkaufsliste einer Woche (docs/PLAN-PHASE-5.md 6.5, 6.6, 7.2, 8.2 Nr. 5, 19.6, Etappe N5b) – reine
 * Regeln, die App speichert nur:
 *
 * - Die Liste gehört zu einer Woche (Mo–So) und einem Zeitraum darin (Standard: die ganze Woche). Die Einträge aus
 *   dem Plan werden IMMER aus dem aktuellen Plan neu erzeugt; aus dem Gerätespeicher kommen nur Häkchen (über
 *   `item_key`), Markierungen, eigene Einträge, abgehakte „nicht mehr im Plan“-Einträge, der Zeitraum und die
 *   über „Zur Einkaufsliste“ hinzugefügten Rezepte. Ein veränderter Speicher kann so keine Plan-Zutat unterschieben.
 * - `resolveShoppingList`: Hat sich der Plan geändert (automatische Neuplanung, Tauschen, „Andere Vorschläge“, neue
 *   Rezept-Version), wird die Liste wie bei der automatischen Neuplanung ab `max(Beginn, heute)` neu erzeugt (R2-S4,
 *   W22): Häkchen bleiben, weggefallene offene Einträge verschwinden, weggefallene abgehakte bleiben mit „nicht mehr
 *   im Plan“, eigene Einträge bleiben. Angezeigt wird immer das Ergebnis.
 * - „Zur Einkaufsliste“ (Rezeptansicht, 19.6): Rezept + Portionen (1–12). Jedes Rezept läuft bei JEDEM Auflösen
 *   erneut durch den Filter der Person (Ernährungsform, Schwein, Unverträglichkeiten, „mag ich nicht“,
 *   Schwangerschaft) – fällt es heraus, verschwindet es (offene Einträge weg, abgehakte „nicht mehr im Plan“).
 *
 * Gesundheitsdaten (7.1, K10): Eine Liste aus einem Plan mit Gesundheitsbezug – oder mit Rezepten, die mit
 * Unverträglichkeiten bzw. Gesundheitsangaben (Flags wie Schwangerschaft) gefiltert wurden – ist selbst ein Gesundheitsdatum
 * (Ersatzprodukte und fehlende Zutaten lassen auf Unverträglichkeiten schließen). Beim Widerruf wird sie samt
 * eigener Einträge gelöscht. Nie loggen.
 */

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

export interface ShoppingListRecipe {
  readonly recipeId: string;
  readonly servings: number;
}

export interface StoredShoppingList extends ShoppingList {
  readonly weekStart: string;
  /** Fingerabdruck des Plans, aus dem die Liste zuletzt erzeugt wurde (`mealPlanShoppingKey`). */
  readonly planKey: string;
  /** Über „Zur Einkaufsliste“ hinzugefügte Rezepte (19.6). */
  readonly recipes: readonly ShoppingListRecipe[];
}

/**
 * Fingerabdruck der Einkaufs-relevanten Teile eines Plans: Kochtag und Zutaten jeder Mahlzeit. Unabhängig von der
 * Reihenfolge der Schlüssel (Zod liefert Objekte in Schema-Reihenfolge).
 */
export function mealPlanShoppingKey(plan: MealPlanWeek): string {
  const parts = plan.days.map((day) =>
    [
      day.date,
      ...day.meals.map(
        (meal) =>
          `${meal.slot}:${meal.recipeId}@${meal.recipeVersion}:${meal.cookDate}:${meal.ingredients
            .map((i) => `${i.foodId}/${i.amount}/${i.unit}/${i.grams}`)
            .join(',')}`,
      ),
    ].join('|'),
  );
  return `${plan.weekStart}:${stableHash([plan.weekStart, ...parts].join('#')).toString(36)}`;
}

const R = SHOPPING_LIST_ROUNDING;

const itemSchema = z.strictObject({
  itemKey: z.string().min(1).max(200),
  foodId: contentIdSchema.nullable(),
  labelDe: z.string().min(1).max(200),
  amount: z.number().finite().min(0).max(1_000_000).nullable(),
  unit: z.enum(['g', 'ml', 'piece']).nullable(),
  category: z.enum(SHOPPING_CATEGORIES),
  isPantry: z.boolean(),
  isManual: z.boolean(),
  checked: z.boolean(),
  substituteFor: z.array(contentIdSchema).max(50),
  amountChanged: z.boolean(),
  notInPlan: z.boolean(),
}) satisfies z.ZodType<ShoppingListItem>;

const servingsSchema = z
  .number()
  .int('Ganze Portionen.')
  .min(RECIPE_SERVINGS_PICKER.min)
  .max(RECIPE_SERVINGS_PICKER.max);

const recipeEntrySchema = z.strictObject({ recipeId: contentIdSchema, servings: servingsSchema });

/** Gespeicherte Liste (Gerätespeicher bzw. ab N7 `shopping_lists`/`shopping_list_items`), strikt. */
export const storedShoppingListSchema = z
  .strictObject({
    weekStart: weekStartSchema,
    from: isoDateSchema,
    to: isoDateSchema,
    usesHealthData: z.boolean(),
    planKey: z.string().min(1).max(100),
    recipes: z.array(recipeEntrySchema).max(SHOPPING_LIST_EXTRAS.recipesMax),
    items: z.array(itemSchema).max(SHOPPING_LIST_EXTRAS.itemsMax),
  })
  .superRefine((list, ctx) => {
    // Zod verfeinert auch nach Fehlern in Feldern weiter – nie werfen (Gerätespeicher).
    if (!Array.isArray(list.items) || !Array.isArray(list.recipes)) return;
    if (!shoppingListRangeValid(list.weekStart, list)) {
      ctx.addIssue({ code: 'custom', path: ['from'], message: 'Zeitraum außerhalb der Woche.' });
    }
    const keys = new Set<string>();
    list.items.forEach((item, index) => {
      if (typeof item !== 'object' || item === null || typeof item.itemKey !== 'string') return;
      if (keys.has(item.itemKey)) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'Doppelter Eintrag.' });
      }
      keys.add(item.itemKey);
      if (item.isManual !== item.itemKey.startsWith('manual|')) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'Falscher Schlüssel.' });
      }
      if (item.isManual && String(item.labelDe).length > R.manualLabelMaxChars) {
        ctx.addIssue({ code: 'custom', path: ['items', index], message: 'Eintrag zu lang.' });
      }
    });
    if (list.items.filter((item) => item?.isManual === true).length > R.manualItemsMax) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Zu viele eigene Einträge.' });
    }
    if (new Set(list.recipes.map((r) => r?.recipeId)).size !== list.recipes.length) {
      ctx.addIssue({ code: 'custom', path: ['recipes'], message: 'Doppeltes Rezept.' });
    }
  });

/** Liste aus dem Gerätespeicher; null = ungültig (dann gilt sie als nicht vorhanden). */
export function parseStoredShoppingList(value: unknown): StoredShoppingList | null {
  const parsed = storedShoppingListSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Zeitraum innerhalb der Woche Mo–So (der Sonntag vor der Woche zählt beim Einkauf zum Montag, 6.5). */
export function shoppingListRangeValid(
  weekStart: string,
  range: { readonly from: string; readonly to: string },
): boolean {
  // Auch mit ungültigen Werten aus dem Gerätespeicher aufrufbar (Zod verfeinert nach Formatfehlern weiter).
  if (![weekStart, range.from, range.to].every((d) => isoDateSchema.safeParse(d).success)) {
    return false;
  }
  const end = addDays(weekStart, 6);
  return range.from >= weekStart && range.to <= end && range.from <= range.to;
}

/**
 * Hinzugefügte Rezepte erneut filtern (Person, aktuelle Woche) und skalieren. Was den Filter nicht mehr besteht
 * oder nicht mehr im Bestand ist, fällt weg.
 */
function recipeExtras(
  recipes: readonly ShoppingListRecipe[],
  input: PlanInput,
): { kept: ShoppingListRecipe[]; extras: (readonly ScaledIngredient[])[] } {
  const pool = new CandidatePool(
    input.recipes,
    input.foods,
    input.profile,
    input.allowDrafts,
    input.redRecipeIds,
  );
  const exclude = weekExcludesPregnancyCaution(input.targets);
  const kept: ShoppingListRecipe[] = [];
  const extras: (readonly ScaledIngredient[])[] = [];
  for (const entry of recipes) {
    const recipe = input.recipes.find((r) => r.id === entry.recipeId);
    const result = recipe === undefined ? null : pool.result(recipe, exclude);
    if (result === null || !result.ok) continue;
    kept.push(entry);
    extras.push(scaleRecipeForServings(result.value, entry.servings, input.foods).ingredients);
  }
  return { kept, extras };
}

/** Gesundheitsbezug der Liste (7.1, K10) – sichere Richtung. */
function listUsesHealthData(
  plan: MealPlanWeek,
  recipes: readonly ShoppingListRecipe[],
  input: PlanInput,
): boolean {
  if (plan.usesHealthData) return true;
  if (recipes.length === 0) return false;
  // Unverträglichkeiten bzw. Flags (z. B. Schwangerschaft) haben den Filter der Rezepte bestimmt.
  return (input.profile.intolerances?.length ?? 0) > 0 || input.targets.usesHealthData;
}

function compose(
  base: Pick<StoredShoppingList, 'items'>,
  plan: MealPlanWeek,
  input: PlanInput,
  options: {
    readonly range: { readonly from: string; readonly to: string };
    readonly recipes: readonly ShoppingListRecipe[];
    readonly planChanged: boolean;
    /** Zeitraum geändert: Was nicht mehr im Zeitraum liegt, fällt ganz weg (auch abgehakt). */
    readonly dropRemoved?: boolean;
  },
): StoredShoppingList {
  const { kept, extras } = recipeExtras(options.recipes, input);
  const fresh = buildShoppingList(plan, input.foods, options.range, extras);
  const recipesDropped = kept.length !== options.recipes.length;
  let merged = mergeShoppingList(base, fresh, {
    planChanged: options.planChanged || recipesDropped,
  });
  if (options.dropRemoved === true) {
    const freshKeys = new Set(fresh.items.map((item) => item.itemKey));
    const wasNotInPlan = new Set(base.items.filter((i) => i.notInPlan).map((i) => i.itemKey));
    merged = {
      ...merged,
      items: merged.items.filter(
        (item) =>
          item.isManual ||
          freshKeys.has(item.itemKey) ||
          (item.notInPlan && wasNotInPlan.has(item.itemKey)),
      ),
    };
  }
  // Wächter N5b K1: Schon vorher „nicht mehr im Plan“ stehende Einträge kommen nur aus dem Gerätespeicher – sie
  // bleiben nur, wenn das Lebensmittel für die Person (heute) erlaubt ist. Frisch weggefallene, abgehakte Einträge
  // bleiben nach R2-S4 immer mit „nicht mehr im Plan“ stehen.
  const stale = new Set(base.items.filter((i) => i.notInPlan && !i.isManual).map((i) => i.itemKey));
  if (stale.size > 0) {
    const ctx = {
      profile: mealPlanProfileSchema.parse(input.profile),
      excludePregnancyCaution: weekExcludesPregnancyCaution(input.targets),
      allowDrafts: input.allowDrafts,
    };
    merged = {
      ...merged,
      items: merged.items.filter(
        (item) =>
          !(item.notInPlan && stale.has(item.itemKey)) ||
          (item.foodId !== null && foodAllowedForPerson(input.foods.get(item.foodId), ctx)),
      ),
    };
  }
  return {
    ...merged,
    usesHealthData: listUsesHealthData(plan, kept, input),
    weekStart: plan.weekStart,
    planKey: mealPlanShoppingKey(plan),
    recipes: kept,
  };
}

/** Neue Liste für die Woche des Plans (Standard: die ganze Woche, 6.5). */
export function newShoppingList(
  plan: MealPlanWeek,
  input: PlanInput,
  range?: { readonly from: string; readonly to: string },
): StoredShoppingList {
  const r = range ?? { from: plan.weekStart, to: addDays(plan.weekStart, 6) };
  if (!shoppingListRangeValid(plan.weekStart, r)) {
    throw new RangeError('Der Zeitraum liegt nicht in dieser Woche.');
  }
  return compose({ items: [] }, plan, input, { range: r, recipes: [], planChanged: false });
}

/** Tiefer Vergleich unabhängig von der Reihenfolge der Schlüssel. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

export type ShoppingListResolution =
  /** Noch keine (gültige) Liste dieser Woche – frisch erzeugt, noch nicht gespeichert. */
  | { readonly action: 'new'; readonly list: StoredShoppingList }
  /** Gespeicherte Liste passt unverändert. */
  | { readonly action: 'stored'; readonly list: StoredShoppingList }
  /**
   * Neu erzeugt (Plan geändert, Rezept fällt heraus oder Gerätespeicher passte nicht) – Häkchen über `item_key`
   * erhalten. `planChanged`: wegen eines geänderten Plans (W22) – dann zeigt die App „Einkaufsliste angepasst“.
   */
  | {
      readonly action: 'rebuilt';
      readonly list: StoredShoppingList;
      readonly planChanged: boolean;
    };

/**
 * Liste der Woche beim Öffnen (6.5, 6.6, R2-S4, W22): Angezeigt wird immer das Ergebnis – nie eine Liste, die zu einem
 * alten Plan gehört. Plan geändert und heute ≤ Ende → ab `max(Beginn, heute)` neu (wie `automaticReplan`); sonst
 * derselbe Zeitraum.
 */
export function resolveShoppingList(
  stored: StoredShoppingList | null,
  plan: MealPlanWeek,
  input: PlanInput,
): ShoppingListResolution {
  if (stored === null || stored.weekStart !== plan.weekStart) {
    return { action: 'new', list: newShoppingList(plan, input) };
  }
  const today = isoDateSchema.parse(input.today);
  const planChanged = stored.planKey !== mealPlanShoppingKey(plan);
  const from =
    planChanged && today <= stored.to && stored.from < today && today >= plan.weekStart
      ? today
      : stored.from;
  const list = compose(stored, plan, input, {
    range: { from, to: stored.to },
    recipes: stored.recipes,
    planChanged,
  });
  if (!planChanged && sameValue(list, stored)) return { action: 'stored', list: stored };
  return { action: 'rebuilt', list, planChanged };
}

/** „Zeitraum wählen“ (8.2 Nr. 5): innerhalb der Woche; Häkchen bleiben, was außerhalb liegt, fällt weg. */
export function withShoppingListRange(
  list: StoredShoppingList,
  range: { readonly from: string; readonly to: string },
  plan: MealPlanWeek,
  input: PlanInput,
): StoredShoppingList {
  const parsed = z.strictObject({ from: isoDateSchema, to: isoDateSchema }).parse(range);
  if (!shoppingListRangeValid(list.weekStart, parsed) || list.weekStart !== plan.weekStart) {
    throw new RangeError('Der Zeitraum liegt nicht in dieser Woche.');
  }
  return compose(list, plan, input, {
    range: parsed,
    recipes: list.recipes,
    planChanged: false,
    dropRemoved: true,
  });
}

export type AddRecipeResult =
  | { readonly ok: true; readonly list: StoredShoppingList }
  /** `not_for_you`: besteht den Filter der Person nicht (ohne Grund); `too_many`: Höchstzahl erreicht. */
  | { readonly ok: false; readonly reason: 'not_found' | 'not_for_you' | 'too_many' };

/**
 * „Zur Einkaufsliste“ aus der Rezeptansicht (19.6): Rezept mit Portionen (1–12). Steht das Rezept schon auf der
 * Liste, gilt die neue Portionenzahl. Nur Rezepte, die den Filter der Person bestehen.
 */
export function addRecipeToShoppingList(
  list: StoredShoppingList,
  entry: ShoppingListRecipe,
  plan: MealPlanWeek,
  input: PlanInput,
): AddRecipeResult {
  const parsed = recipeEntrySchema.parse(entry);
  const recipe = input.recipes.find((r) => r.id === parsed.recipeId);
  if (recipe === undefined) return { ok: false, reason: 'not_found' };
  const { kept } = recipeExtras([parsed], input);
  if (kept.length === 0) return { ok: false, reason: 'not_for_you' };
  const others = list.recipes.filter((r) => r.recipeId !== parsed.recipeId);
  if (others.length >= SHOPPING_LIST_EXTRAS.recipesMax) return { ok: false, reason: 'too_many' };
  return {
    ok: true,
    list: compose(list, plan, input, {
      range: { from: list.from, to: list.to },
      recipes: [...others, parsed],
      planChanged: true,
    }),
  };
}

/** Hinzugefügtes Rezept wieder entfernen: offene Einträge weg, abgehakte „nicht mehr im Plan“. */
export function removeRecipeFromShoppingList(
  list: StoredShoppingList,
  recipeId: string,
  plan: MealPlanWeek,
  input: PlanInput,
): StoredShoppingList {
  return compose(list, plan, input, {
    range: { from: list.from, to: list.to },
    recipes: list.recipes.filter((r) => r.recipeId !== recipeId),
    planChanged: true,
  });
}
