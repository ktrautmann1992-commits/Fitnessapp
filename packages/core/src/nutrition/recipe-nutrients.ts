import {
  addOptionalNutrient,
  type Food,
  type FoodLookup,
  OPTIONAL_NUTRIENT_KEYS,
  type OptionalNutrientKey,
  REQUIRED_NUTRIENT_KEYS,
} from '../content/food-schema';
import type { RecipeMeta } from '../content/import-meta';
import type { Recipe } from '../content/recipe-schema';
import type { DietType } from '../enums';
import { FOOD_GROUP_IDS, type FoodGroupId } from '../food-groups';
import { toGrams } from './units';

/**
 * Nährwerte, Ernährungsform, Allergene, Schwein, Alkohol und Schwangerschafts-Vorsicht eines Rezepts – berechnet
 * AUS DEN ZUTATEN und dem Katalog (docs/PLAN-PHASE-5.md 5.2, 4.1 `recipe-nutrients.ts`). Die deklarierten Angaben
 * des Rezepts werden hier nie gelesen; sie dienen nur der Gegenprüfung (R3, R6–R8, R13).
 *
 * - Optionale Zutaten (S3) zählen für Ernährungsform, Allergene, Schwein, Alkohol und `pregnancy_caution` IMMER
 *   mit (das Rezept „enthält“ sie), außer der Filter hat sie ausdrücklich weggelassen (`omitted`).
 *   Nährwerte werden immer OHNE optionale Zutaten berechnet.
 * - Unbestätigte Import-Annahmen „erhitzt“ (`meta.import_assumptions` ohne `import_assumptions_confirmed_by`)
 *   gelten für `pregnancy_caution` wie `heated: false` (Wächter N2c, B1).
 * - Ersatz-Zutaten (S4): `substitutions` ersetzt das Lebensmittel einer Zutat vollständig (Menge und Einheit
 *   bleiben, `heated` bleibt) – alle Werte werden mit dem Ersatzprodukt neu berechnet.
 */

/**
 * Nährwerte einer Menge (Rezept, Portion, Tag). Pflichtwerte sind immer Zahlen; Zucker, gesättigte Fettsäuren und
 * Ballaststoffe sind `null` („unbekannt“), sobald eine gezählte Zutat dafür keinen Wert in der Quelle hat
 * (`addOptionalNutrient`) – nie eine stille Untergrenze.
 */
export type RecipeNutrients = {
  -readonly [K in (typeof REQUIRED_NUTRIENT_KEYS)[number]]: number;
} & { -readonly [K in OptionalNutrientKey]: number | null };

/** Beitrag einer Zutat (Gramm × Wert je 100 g); 0 g tragen immer 0 bei, auch ohne Wert. */
export function nutrientAmount(grams: number, per100g: number | null): number | null {
  if (grams === 0) {
    return 0;
  }
  return per100g === null ? null : (grams * per100g) / 100;
}

/** Addiert die Nährwerte von `grams` Gramm eines Lebensmittels zu `target`. */
export function addFoodNutrients(target: RecipeNutrients, food: Food, grams: number): void {
  const n = food.nutrients_per_100g;
  for (const key of REQUIRED_NUTRIENT_KEYS) {
    target[key] += (grams * n[key]) / 100;
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    target[key] = addOptionalNutrient(target[key], nutrientAmount(grams, n[key]));
  }
}

/** Teilt alle Werte durch `divisor` (z. B. Portionen); `null` bleibt `null`. */
export function divideNutrients(source: RecipeNutrients, divisor: number): RecipeNutrients {
  const result = zeroNutrients();
  for (const key of REQUIRED_NUTRIENT_KEYS) {
    result[key] = source[key] / divisor;
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    const value = source[key];
    result[key] = value === null ? null : value / divisor;
  }
  return result;
}

export function zeroNutrients(): RecipeNutrients {
  return {
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    sugar_g: 0,
    fat_g: 0,
    sat_fat_g: 0,
    fiber_g: 0,
    salt_g: 0,
  };
}

/** Addiert `add` zu `target` (z. B. Tagessumme); unbekannte ergänzende Werte bleiben unbekannt. */
export function addNutrients(target: RecipeNutrients, add: RecipeNutrients): void {
  for (const key of REQUIRED_NUTRIENT_KEYS) {
    target[key] += add[key];
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    target[key] = addOptionalNutrient(target[key], add[key]);
  }
}

/** Tierische Bestandteile, die ein Lebensmittel NICHT vegetarisch machen (R6, Plan 6.1). */
const NOT_VEGETARIAN = ['meat', 'fish', 'shellfish', 'gelatin', 'animal_rennet', 'insect'] as const;

/** Ernährungsform eines Lebensmittels: vegan ohne jedes `animal[]`, Honig/Milch/Ei = vegetarisch (R6). */
export function foodDiet(food: Pick<Food, 'animal'>): DietType {
  if (food.animal.length === 0) {
    return 'vegan';
  }
  return food.animal.some((kind) => (NOT_VEGETARIAN as readonly string[]).includes(kind))
    ? 'omnivore'
    : 'vegetarian';
}

const DIET_RANK: Readonly<Record<DietType, number>> = { vegan: 0, vegetarian: 1, omnivore: 2 };

/** Strengere von zwei Ernährungsformen aus Sicht des Rezepts (omnivor schlägt vegetarisch schlägt vegan). */
function combineDiet(a: DietType, b: DietType): DietType {
  return DIET_RANK[a] >= DIET_RANK[b] ? a : b;
}

/** true = Ernährungsform des Rezepts passt zur gewünschten (vegan ⊂ vegetarisch ⊂ omnivor, Plan 6.1). */
export function dietAllows(wanted: DietType, recipeDiet: DietType): boolean {
  return DIET_RANK[recipeDiet] <= DIET_RANK[wanted];
}

/**
 * true = das Lebensmittel zählt als Schwein (R8, S5): Fleisch vom Schwein oder unbekannter Tierart, oder Gelatine
 * vom Schwein bzw. ohne/unbekannter Herkunft.
 */
export function foodContainsPork(
  food: Pick<Food, 'meat_kind' | 'animal' | 'gelatin_origin'>,
): boolean {
  if (food.meat_kind.includes('pork') || food.meat_kind.includes('unknown')) {
    return true;
  }
  if (food.animal.includes('gelatin')) {
    return (
      food.gelatin_origin === undefined ||
      food.gelatin_origin === 'pork' ||
      food.gelatin_origin === 'unknown'
    );
  }
  return false;
}

/**
 * true = die Zutat braucht im Rezept die Angabe `heated` (R2-S2): Gruppen `eggs`, `fish`, `shellfish`, tierische
 * Bestandteile Ei/Fisch/Krebs-/Weichtiere/Fleisch oder Rohmilch (Milch mit `pregnancy_caution`).
 */
export function needsHeatedFlag(
  food: Pick<Food, 'groups' | 'animal' | 'pregnancy_caution'>,
): boolean {
  const heatGroups: readonly FoodGroupId[] = ['eggs', 'fish', 'shellfish'];
  if (food.groups.some((group) => heatGroups.includes(group))) {
    return true;
  }
  if (food.animal.some((kind) => kind === 'egg' || kind === 'fish' || kind === 'shellfish')) {
    return true;
  }
  if (food.animal.includes('meat')) {
    return true;
  }
  return food.animal.includes('dairy') && food.pregnancy_caution;
}

export type PregnancyReason =
  | { readonly kind: 'food_flag'; readonly index: number; readonly foodId: string }
  | { readonly kind: 'not_heated'; readonly index: number; readonly foodId: string }
  | { readonly kind: 'no_cook'; readonly index: number; readonly foodId: string }
  /** `heated: true` nur als unbestätigte Import-Annahme – gilt wie nicht erhitzt (Wächter N2c, B1). */
  | { readonly kind: 'unconfirmed_heated'; readonly index: number; readonly foodId: string };

export interface RecipeFacts {
  /** Summe der nicht optionalen, nicht weggelassenen Zutaten. */
  readonly total: RecipeNutrients;
  /** `total` / `servings`. */
  readonly perServing: RecipeNutrients;
  /** Gramm je Portion je Zutat (null = Lebensmittel fehlt oder Einheit nicht umrechenbar). */
  readonly gramsPerServing: readonly (number | null)[];
  readonly diet: DietType;
  /** Alle Gruppen der Zutaten (inkl. optionaler), in der Reihenfolge von FOOD_GROUPS. */
  readonly allergens: readonly FoodGroupId[];
  readonly containsPork: boolean;
  readonly alcohol: boolean;
  readonly pregnancyCaution: boolean;
  readonly pregnancyReasons: readonly PregnancyReason[];
  /** Kleinste Haltbarkeit der Zutaten im Kühlschrank (S12); null = keine Zutat bekannt. */
  readonly maxFridgeDays: number | null;
  /** Indizes der Zutaten, deren Lebensmittel im Katalog fehlt (R2). */
  readonly missingFoods: readonly number[];
  /** Indizes der Zutaten, deren Einheit nicht in Gramm umrechenbar ist (R2). */
  readonly unconvertible: readonly number[];
  /** Indizes der Zutaten ohne die Pflichtangabe `heated` (R2-S2). Zählen als ungegart. */
  readonly missingHeated: readonly number[];
  /** true = Nährwerte vollständig (keine fehlenden Lebensmittel/Einheiten bei nicht optionalen Zutaten). */
  readonly nutrientsComplete: boolean;
}

export interface RecipeFactsOptions {
  /** Ersatz je Zutat-Index → `food_id` des Ersatzprodukts (S4). */
  readonly substitutions?: ReadonlyMap<number, string>;
  /** Weggelassene OPTIONALE Zutaten (S3). Nicht optionale Zutaten können nicht weggelassen werden. */
  readonly omitted?: ReadonlySet<number>;
}

/** Berechnet alle Angaben eines Rezepts aus Zutaten und Katalog. */
export function computeRecipeFacts(
  recipe: Pick<Recipe, 'ingredients' | 'servings' | 'no_cook'> & {
    readonly meta?: Pick<RecipeMeta, 'import_assumptions' | 'import_assumptions_confirmed_by'>;
  },
  foods: FoodLookup,
  options: RecipeFactsOptions = {},
): RecipeFacts {
  options.omitted?.forEach((index) => {
    if (recipe.ingredients[index]?.optional !== true) {
      throw new Error(`Zutat ${index} ist nicht optional und kann nicht weggelassen werden.`);
    }
  });
  options.substitutions?.forEach((_, index) => {
    if (recipe.ingredients[index] === undefined) {
      throw new Error(`Ersatz für unbekannte Zutat ${index}.`);
    }
  });

  // Unbestätigte Import-Annahmen „erhitzt“ zählen für die Schwangerschaft wie `heated: false` (sichere Richtung).
  const confirmed =
    recipe.meta?.import_assumptions_confirmed_by !== undefined &&
    recipe.meta.import_assumptions_confirmed_by !== null;
  const unconfirmedHeated = new Set(
    confirmed
      ? []
      : (recipe.meta?.import_assumptions ?? [])
          .filter((a) => a.field === 'heated')
          .map((a) => a.ingredient_index),
  );
  const total = zeroNutrients();
  const gramsPerServing: (number | null)[] = [];
  const groups = new Set<FoodGroupId>();
  const pregnancyReasons: PregnancyReason[] = [];
  const missingFoods: number[] = [];
  const unconvertible: number[] = [];
  const missingHeated: number[] = [];
  let diet: DietType = 'vegan';
  let containsPork = false;
  let alcohol = false;
  let maxFridgeDays: number | null = null;
  let nutrientsComplete = true;

  recipe.ingredients.forEach((ingredient, index) => {
    if (options.omitted?.has(index) === true) {
      gramsPerServing.push(0);
      return;
    }
    const foodId = options.substitutions?.get(index) ?? ingredient.food_id;
    const food = foods.get(foodId);
    if (food === undefined) {
      missingFoods.push(index);
      gramsPerServing.push(null);
      if (!ingredient.optional) {
        nutrientsComplete = false;
      }
      return;
    }

    // Enthält: zählt auch für optionale Zutaten (S3).
    food.groups.forEach((group) => groups.add(group));
    diet = combineDiet(diet, foodDiet(food));
    containsPork ||= foodContainsPork(food);
    alcohol ||= food.alcohol;
    maxFridgeDays =
      maxFridgeDays === null ? food.max_fridge_days : Math.min(maxFridgeDays, food.max_fridge_days);

    if (food.pregnancy_caution) {
      pregnancyReasons.push({ kind: 'food_flag', index, foodId });
    }
    if (needsHeatedFlag(food)) {
      if (ingredient.heated === undefined) {
        missingHeated.push(index);
      }
      if (recipe.no_cook) {
        pregnancyReasons.push({ kind: 'no_cook', index, foodId });
      } else if (ingredient.heated !== true) {
        pregnancyReasons.push({ kind: 'not_heated', index, foodId });
      } else if (unconfirmedHeated.has(index)) {
        pregnancyReasons.push({ kind: 'unconfirmed_heated', index, foodId });
      }
    }

    const grams = toGrams(ingredient.amount, ingredient.unit, food.units);
    if (grams === null) {
      unconvertible.push(index);
      gramsPerServing.push(null);
      if (!ingredient.optional) {
        nutrientsComplete = false;
      }
      return;
    }
    gramsPerServing.push(grams / recipe.servings);
    if (ingredient.optional) {
      return;
    }
    addFoodNutrients(total, food, grams);
  });

  const perServing = divideNutrients(total, recipe.servings);

  return {
    total,
    perServing,
    gramsPerServing,
    diet,
    allergens: FOOD_GROUP_IDS.filter((group) => groups.has(group)),
    containsPork,
    alcohol,
    pregnancyCaution: pregnancyReasons.length > 0,
    pregnancyReasons,
    maxFridgeDays,
    missingFoods,
    unconvertible,
    missingHeated,
    nutrientsComplete,
  };
}
