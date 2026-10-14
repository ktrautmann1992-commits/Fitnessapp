/**
 * Etappe N9 – Zutaten-Austausch (docs/PLAN-PHASE-5.md 19.7 N9, KONZEPT 6.9, Prompt D): Auflösen aus der
 * Austausch-Tabelle, kompletter Filter nach dem Tausch (Ernährungsform, Schwein inkl. `eats_pork = null` bei
 * Mischkost, Unverträglichkeit, „mag ich nicht“, Schwangerschaft inkl. Ersatz ohne `heated`), Allergene und Nährwerte
 * neu, Planband (nie über der Obergrenze, S1), Haltbarkeit (B2), Kochtag vorbei, Import-Annahmen (N2d),
 * gespeicherter Plan, Einkaufsliste (W22), Payload. Eigenschaftstest „Austausch liefert nie etwas, das filter.ts
 * ausschließt“ mit eigener Erwartungsregel (`usedFoodViolations`).
 */
import { describe, expect, it } from 'vitest';

import { INGREDIENT_SUBSTITUTION_LIMITS } from '../constants';
import { importAssumptionsFingerprint } from '../content/import-meta';
import { ing, makeRecipe, RECIPE_META } from '../content/nutrition-fixtures';
import type { IngredientRole, Recipe } from '../content/recipe-schema';
import type { IngredientSubstitution } from '../content/substitution-schema';
import { substitutionContentId } from '../content/substitution-schema';
import { DEMO_SUBSTITUTIONS, withDemoRoles } from '../demo-nutrition';
import { addDays, daysBetween } from '../dates';
import { filterRecipe } from './filter';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { expectNeedsHeating, N3_FOODS, N3_RECIPES, usedFoodViolations } from './meal-plan-fixtures';
import { toMealPlanPayload } from './meal-plan-payload';
import {
  mealPlanMatchesRecipes,
  parseStoredMealPlanWeek,
  resolveMealPlanWeek,
} from './meal-plan-store';
import { needsAutomaticReplan } from './replan';
import { computeRecipeFacts } from './recipe-nutrients';
import { scalePortion } from './scale';
import {
  mealPlanProfileSchema,
  type MealPlanProfileInput,
  type NutritionInputsInput,
} from './schemas';
import { buildShoppingList } from './shopping-list';
import { newShoppingList, resolveShoppingList } from './shopping-list-store';
import {
  applyIngredientSwap,
  ingredientSwapOptions,
  ingredientSwapPossible,
  type IngredientSwapTarget,
  recipeVariantForMeal,
} from './substitute';
import { resolveIngredientSwap, resolveIngredientSwaps } from './swap-resolve';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, seededRandom } from './test-helpers';
import type { MealSlotId } from './timing';

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

const SUNDAY_BEFORE = addDays(MONDAY, -1);
const RECIPES = N3_RECIPES.map(withDemoRoles);
const omniPork: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const omniUnknown: MealPlanProfileInput = { diet: 'omnivore' };
const female = { sex: 'female' as const };
const pregnant = {
  sex: 'female' as const,
  healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
} satisfies Partial<NutritionInputsInput>;

function input(
  options: {
    readonly overrides?: Partial<NutritionInputsInput>;
    readonly profile?: MealPlanProfileInput;
    readonly today?: string;
    readonly recipes?: readonly Recipe[];
    readonly table?: readonly IngredientSubstitution[];
    readonly meals?: number;
  } = {},
): PlanInput {
  const today = options.today ?? SUNDAY_BEFORE;
  return {
    targets: nutritionTargetsForWeek(
      inputs({ today, mealsPerDay: options.meals ?? 4, ...options.overrides }),
      MONDAY,
    ),
    profile: options.profile ?? omniPork,
    recipes: options.recipes ?? RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
    substitutions: options.table ?? DEMO_SUBSTITUTIONS,
  };
}

function plan(i: PlanInput, variant = 0): MealPlanWeek {
  return buildMealPlanWeek({ ...i, variant });
}

/** Alle Zutaten mit Rolle in Mahlzeiten ab heute (Ziele für den Austausch). */
function swapTargets(p: MealPlanWeek, i: PlanInput): IngredientSwapTarget[] {
  return p.days.flatMap((day) =>
    day.meals.flatMap((meal) => {
      if (meal.isFill || day.date < i.today) return [];
      const recipe = i.recipes.find((r) => r.id === meal.recipeId);
      return (recipe?.ingredients ?? []).flatMap((ingredient, index) =>
        ingredient.role === undefined
          ? []
          : [{ date: day.date, slot: meal.slot as MealSlotId, index }],
      );
    }),
  );
}

function mealAt(p: MealPlanWeek, date: string, slot: string) {
  return p.days.find((d) => d.date === date)?.meals.find((m) => m.slot === slot && !m.isFill);
}

/** Erste Mahlzeit ab heute mit diesem Rezept. */
function findMeal(p: MealPlanWeek, recipeId: string, from: string) {
  for (const day of p.days) {
    if (day.date < from) continue;
    const meal = day.meals.find((m) => m.recipeId === recipeId && !m.isFill);
    if (meal !== undefined) return { date: day.date, slot: meal.slot as MealSlotId, meal };
  }
  return null;
}

function ingredientIndex(recipeId: string, foodId: string, recipes = RECIPES): number {
  const recipe = recipes.find((r) => r.id === recipeId) as Recipe;
  return recipe.ingredients.findIndex((i) => i.food_id === foodId);
}

/** Rezept mit Rolle „Eiweiß“ an einer Zutat, sonst unverändert (ohne Demo-Erhitzen). */
function withRole(recipe: Recipe, foodId: string): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((x) =>
      x.food_id === foodId ? { ...x, role: 'protein' as const } : x,
    ),
  };
}

const onlyMains = (ids: readonly string[]) =>
  RECIPES.filter((r) => !r.meal_types.includes('main') || ids.includes(r.id));

// ---------------------------------------------------------------------------------------------------------
// Auflösen aus der Tabelle (B2)
// ---------------------------------------------------------------------------------------------------------

describe('resolveIngredientSwap – Menge, Einheit, heated aus der Tabelle (B2)', () => {
  const tofuRecipe = RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe;
  const tofu = ingredientIndex('tofu-paprika', 'tofu');
  const paprika = ingredientIndex('tofu-paprika', 'paprika');

  it('Gramm × Faktor; Ei in ganzen Stück; gebratener Tofu (heated: true) → Ersatz erhitzt', () => {
    const chicken = resolveIngredientSwap(
      tofuRecipe,
      { index: tofu, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' },
      DEMO_SUBSTITUTIONS,
      N3_FOODS,
    );
    expect(chicken).toMatchObject({ amount: 114, unit: 'g', heated: true });
    const egg = resolveIngredientSwap(
      tofuRecipe,
      { index: tofu, foodId: 'tofu', substituteFoodId: 'huehnerei' },
      DEMO_SUBSTITUTIONS,
      N3_FOODS,
    );
    // 200 g × 1,04 = 208 g Ei ÷ 60 g je Stück
    expect(egg?.unit).toBe('piece');
    expect(egg?.amount).toBeCloseTo(208 / 60, 5);
    expect(egg?.heated).toBe(true);
  });

  it('B1 (Wächter N9): Ersatz, der erhitzt werden muss, nie in Rezepten ohne Kochen oder an nicht erhitzter Zutat', () => {
    const ref = { index: tofu, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' };
    // Regressionsfall aus der Wächter-Prüfung (scratchpad/demo/raw.ts): kalter Tofu-Salat, Mischkost, nicht schwanger.
    const salad = makeRecipe({
      id: 'tofu-salat',
      title_de: 'Tofu-Salat',
      description_de: 'Kalter Salat mit Tofu und Paprika.',
      meal_types: ['main'],
      training_tags: [],
      ingredients: [ing('tofu', 200, 'g', { role: 'protein' }), ing('paprika', 1, 'piece')],
      steps_de: ['Tofu würfeln, Paprika schneiden, mischen.'],
      prep_minutes: 5,
      cook_minutes: 0,
      no_cook: true,
      meal_prep: { suitable: false, fridge_days: 0, freezable: false },
      equipment_de: ['Messer'],
      declared_diet: 'vegan',
      declared_allergens: ['soy', 'legumes'],
    });
    const rawRef = { index: 0, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' };
    expect(resolveIngredientSwaps(salad, [rawRef], DEMO_SUBSTITUTIONS, N3_FOODS)).toBeNull();
    expect(
      resolveIngredientSwaps(
        salad,
        [{ ...rawRef, substituteFoodId: 'huehnerei' }],
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ),
    ).toBeNull();
    // Tofu ohne Angabe „heated“ (Fixture ohne Demo-Erhitzen) und ausdrücklich ungegart: ebenfalls kein Tausch.
    const unheated = withRole(N3_RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe, 'tofu');
    expect(resolveIngredientSwap(unheated, ref, DEMO_SUBSTITUTIONS, N3_FOODS)).toBeNull();
    const raw = {
      ...unheated,
      ingredients: unheated.ingredients.map((x, i) => (i === tofu ? { ...x, heated: false } : x)),
    };
    expect(resolveIngredientSwap(raw, ref, DEMO_SUBSTITUTIONS, N3_FOODS)).toBeNull();
    // Pflanzlicher Ersatz bleibt erlaubt (braucht kein Erhitzen).
    expect(
      resolveIngredientSwap(
        salad,
        { index: 1, foodId: 'paprika', substituteFoodId: 'champignons' },
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ),
    ).toBeNull(); // Paprika hat im Salat keine Rolle
    // Im ganzen Plan: kalter Salat wird nie mit Hähnchen angeboten (nicht schwanger).
    const i = input({ recipes: [...RECIPES.filter((r) => !r.meal_types.includes('main')), salad] });
    const p = plan(i);
    const f = findMeal(p, 'tofu-salat', MONDAY);
    expect(f).not.toBeNull();
    if (f === null) return;
    const options = ingredientSwapOptions(p, { date: f.date, slot: f.slot, index: 0 }, i);
    expect(options.ok && options.options).toEqual([]);
    expect(
      applyIngredientSwap(p, { date: f.date, slot: f.slot, index: 0 }, 'haehnchenbrust', i),
    ).toEqual({
      ok: false,
      reason: 'excluded',
    });
  });

  it('Stück ohne Stückgewicht beim Ersatz → Gramm (Paprika 1 Stück = 150 g → Champignons 150 g)', () => {
    const swap = resolveIngredientSwap(
      tofuRecipe,
      { index: paprika, foodId: 'paprika', substituteFoodId: 'champignons' },
      DEMO_SUBSTITUTIONS,
      N3_FOODS,
    );
    expect(swap).toMatchObject({ amount: 150, unit: 'g' });
  });

  it('erhitztes Original bleibt erhitzt (Hähnchen → Lachs)', () => {
    const recipe = RECIPES.find((r) => r.id === 'haehnchen-reis') as Recipe;
    const swap = resolveIngredientSwap(
      recipe,
      {
        index: ingredientIndex('haehnchen-reis', 'haehnchenbrust'),
        foodId: 'haehnchenbrust',
        substituteFoodId: 'lachs',
      },
      DEMO_SUBSTITUTIONS,
      N3_FOODS,
    );
    expect(swap?.heated).toBe(true);
  });

  it('ungültig: falsches Lebensmittel, keine Rolle, andere Rolle, nicht in der Tabelle, zurückgezogen', () => {
    const ref = { index: tofu, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' };
    expect(
      resolveIngredientSwap(
        tofuRecipe,
        { ...ref, foodId: 'paprika' },
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ),
    ).toBeNull();
    const noRole = N3_RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe;
    expect(resolveIngredientSwap(noRole, ref, DEMO_SUBSTITUTIONS, N3_FOODS)).toBeNull();
    const otherRole = DEMO_SUBSTITUTIONS.map((s) =>
      s.food_id === 'tofu' ? { ...s, role: 'fat' as IngredientRole } : s,
    );
    expect(resolveIngredientSwap(tofuRecipe, ref, otherRole, N3_FOODS)).toBeNull();
    expect(resolveIngredientSwap(tofuRecipe, ref, [], N3_FOODS)).toBeNull();
    const archived = DEMO_SUBSTITUTIONS.map((s) => ({ ...s, status: 'archived' as const }));
    expect(resolveIngredientSwap(tofuRecipe, ref, archived, N3_FOODS)).toBeNull();
  });

  it('Liste: doppelte Zutat, zu viele Einträge → ungültig', () => {
    const ref = { index: tofu, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' };
    expect(resolveIngredientSwaps(tofuRecipe, [ref, ref], DEMO_SUBSTITUTIONS, N3_FOODS)).toBeNull();
    expect(
      resolveIngredientSwaps(
        tofuRecipe,
        Array.from({ length: INGREDIENT_SUBSTITUTION_LIMITS.swapsPerMeal + 1 }, () => ref),
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ),
    ).toBeNull();
    expect(resolveIngredientSwaps(tofuRecipe, [], DEMO_SUBSTITUTIONS, N3_FOODS)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Filter nach dem Tausch, Allergene und Nährwerte neu
// ---------------------------------------------------------------------------------------------------------

describe('Filter nach dem Tausch (S4/B2), Allergene und Nährwerte neu', () => {
  const tofuRecipe = RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe;
  const tofu = ingredientIndex('tofu-paprika', 'tofu');
  const swapTo = (substituteFoodId: string) =>
    resolveIngredientSwaps(
      tofuRecipe,
      [{ index: tofu, foodId: 'tofu', substituteFoodId }],
      DEMO_SUBSTITUTIONS,
      N3_FOODS,
    ) ?? [];
  const ctx = (profile: MealPlanProfileInput, excludePregnancyCaution = false) => ({
    profile: mealPlanProfileSchema.parse(profile),
    excludePregnancyCaution,
    allowDrafts: true,
  });

  it('gebratener Tofu → Ei: erhitzt, kein pregnancy_caution; ungegartes Ei (B2) im Filter → pregnancy_caution', () => {
    const facts = computeRecipeFacts(tofuRecipe, N3_FOODS, {
      swaps: new Map(
        swapTo('huehnerei').map((s) => [
          s.index,
          { food_id: s.substituteFoodId, amount: s.amount, unit: s.unit, heated: s.heated },
        ]),
      ),
    });
    expect(facts.pregnancyCaution).toBe(false);
    expect(filterRecipe(tofuRecipe, N3_FOODS, ctx(omniPork, true), swapTo('huehnerei')).ok).toBe(
      true,
    );
    // Verteidigung in der Tiefe: Käme ein ungegartes Ei doch bis zum Filter, schließt die Schwangerschaft es aus.
    const rawEgg = swapTo('huehnerei').map((x) => ({ ...x, heated: false }));
    expect(filterRecipe(tofuRecipe, N3_FOODS, ctx(omniPork, true), rawEgg).ok).toBe(false);
  });

  it('Allergene werden neu berechnet (Soja raus, Ei bzw. Geflügel rein)', () => {
    const egg = filterRecipe(tofuRecipe, N3_FOODS, ctx(omniPork), swapTo('huehnerei'));
    const chicken = filterRecipe(tofuRecipe, N3_FOODS, ctx(omniPork), swapTo('haehnchenbrust'));
    expect(egg.ok && egg.value.facts.allergens).toEqual(['eggs']);
    expect(chicken.ok && chicken.value.facts.allergens).toEqual(['poultry']);
    expect(chicken.ok && chicken.value.facts.diet).toBe('omnivore');
  });

  it('Ernährungsform, Unverträglichkeit und „mag ich nicht“ gelten für den Ersatz', () => {
    expect(filterRecipe(tofuRecipe, N3_FOODS, ctx({ diet: 'vegan' }), swapTo('huehnerei')).ok).toBe(
      false,
    );
    expect(
      filterRecipe(tofuRecipe, N3_FOODS, ctx({ diet: 'vegetarian' }), swapTo('haehnchenbrust')).ok,
    ).toBe(false);
    expect(
      filterRecipe(
        tofuRecipe,
        N3_FOODS,
        ctx({ diet: 'omnivore', intolerances: ['eggs'] }),
        swapTo('huehnerei'),
      ).ok,
    ).toBe(false);
    expect(
      filterRecipe(
        tofuRecipe,
        N3_FOODS,
        ctx({ diet: 'omnivore', dislikes: ['poultry'] }),
        swapTo('haehnchenbrust'),
      ).ok,
    ).toBe(false);
  });

  it('Schwein: Hack nur bei eats_pork = true (null bei Mischkost = nein, G2)', () => {
    const recipe = RECIPES.find((r) => r.id === 'haehnchen-reis') as Recipe;
    const swaps =
      resolveIngredientSwaps(
        recipe,
        [
          {
            index: ingredientIndex('haehnchen-reis', 'haehnchenbrust'),
            foodId: 'haehnchenbrust',
            substituteFoodId: 'hackfleisch-gemischt',
          },
        ],
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ) ?? [];
    expect(filterRecipe(recipe, N3_FOODS, ctx(omniUnknown), swaps).ok).toBe(false);
    expect(
      filterRecipe(recipe, N3_FOODS, ctx({ diet: 'omnivore', eatsPork: false }), swaps).ok,
    ).toBe(false);
    expect(filterRecipe(recipe, N3_FOODS, ctx(omniPork), swaps).ok).toBe(true);
  });

  it('Nährwerte der Mahlzeit nach der Rundung aus dem Ersatz (scalePortion)', () => {
    const swaps = swapTo('haehnchenbrust');
    const portion = scalePortion(
      { recipe: tofuRecipe, omitted: [], substitutions: [], swaps },
      1,
      N3_FOODS,
    );
    const chicken = portion.ingredients.find((x) => x.index === tofu);
    expect(chicken).toMatchObject({
      foodId: 'haehnchenbrust',
      originalFoodId: 'tofu',
      swapped: true,
      amount: 115,
      grams: 115,
    });
    const other = portion.ingredients.find((x) => x.index !== tofu);
    expect(other).not.toHaveProperty('swapped');
    // 115 g Hähnchen (110 kcal/100 g) + 150 g Paprika (37) + 75 g Reis (350) + 10 g Öl (884)
    expect(portion.nutrients.kcal).toBeCloseTo(126.5 + 55.5 + 262.5 + 88.4, 5);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Austausch im Plan
// ---------------------------------------------------------------------------------------------------------

describe('Austausch im Plan: Angebot, Tag, Einkaufsliste, Speicher', () => {
  const i = input({ recipes: onlyMains(['tofu-paprika']) });
  const p = plan(i);
  const found = findMeal(p, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
  const target = {
    date: found.date,
    slot: found.slot,
    index: ingredientIndex('tofu-paprika', 'tofu'),
  };

  it('Angebot nach Namen, nur sichere Alternativen; Original zuerst nach einem Tausch', () => {
    const options = ingredientSwapOptions(p, target, i);
    expect(options.ok).toBe(true);
    if (!options.ok) return;
    expect(options.role).toBe('protein');
    expect(options.swapped).toBe(false);
    expect(options.options.map((o) => o.substituteFoodId)).toEqual(['huehnerei', 'haehnchenbrust']);
    const swapped = options.options[1]?.plan as MealPlanWeek;
    const again = ingredientSwapOptions(swapped, target, i);
    expect(again.ok && again.options.map((o) => o.substituteFoodId)).toEqual([null, 'huehnerei']);
    expect(again.ok && again.swapped).toBe(true);
  });

  it('Tag danach im Planband, Nährwerte und Summe neu; Zurücknehmen ergibt den alten Plan', () => {
    const result = applyIngredientSwap(p, target, 'haehnchenbrust', i);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const day = result.plan.days.find((d) => d.date === target.date);
    const meal = mealAt(result.plan, target.date, target.slot);
    expect(meal?.ingredientSwaps).toEqual([
      { index: target.index, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' },
    ]);
    expect(meal?.ingredients.some((x) => x.foodId === 'tofu')).toBe(false);
    expect(day?.status === 'complete' || day?.status === 'below_floor').toBe(true);
    const kcal = day?.meals.reduce((sum, m) => sum + m.nutrients.kcal, 0) ?? 0;
    expect(kcal).toBeCloseTo(day?.totals.kcal ?? -1, 6);
    if (day?.status === 'complete' && day.band !== null) {
      expect(kcal).toBeGreaterThanOrEqual(day.band.min);
      expect(kcal).toBeLessThanOrEqual(day.band.max);
    }
    // Andere Tage unverändert.
    result.plan.days
      .filter((d) => d.date !== target.date)
      .forEach((d) => expect(d).toEqual(p.days.find((x) => x.date === d.date)));
    const back = applyIngredientSwap(result.plan, target, null, i);
    expect(back.ok && mealAt(back.plan, target.date, target.slot)).toEqual(
      mealAt(p, target.date, target.slot),
    );
    expect(applyIngredientSwap(p, target, null, i)).toEqual({ ok: false, reason: 'not_offered' });
    expect(applyIngredientSwap(p, target, 'lachs', i)).toEqual({
      ok: false,
      reason: 'not_offered',
    });
  });

  it('gespeicherter Plan: Rundweg gültig, ohne neue Planung; Tabelle fehlt oder Speicher verändert → neu', () => {
    const result = applyIngredientSwap(p, target, 'haehnchenbrust', i);
    if (!result.ok) throw new Error('Tausch erwartet');
    const stored = parseStoredMealPlanWeek(JSON.parse(JSON.stringify(result.plan)));
    expect(stored).not.toBeNull();
    expect(
      mealPlanMatchesRecipes(stored as MealPlanWeek, i.recipes, i.foods, DEMO_SUBSTITUTIONS),
    ).toBe(true);
    expect(resolveMealPlanWeek(stored, i).action).toBe('stored');
    expect(needsAutomaticReplan(stored as MealPlanWeek, i).needed).toBe(false);
    // Ohne Tabelle (oder Eintrag zurückgezogen) passt die Mahlzeit nicht mehr → neu erstellt.
    expect(mealPlanMatchesRecipes(stored as MealPlanWeek, i.recipes, i.foods, [])).toBe(false);
    expect(resolveMealPlanWeek(stored, { ...i, substitutions: [] }).action).toBe('rebuilt');
    // Menge im Speicher verändert → nicht verwendet.
    const tampered = JSON.parse(JSON.stringify(result.plan)) as MealPlanWeek;
    const tm = tampered.days
      .find((d) => d.date === target.date)
      ?.meals.find((m) => m.slot === target.slot) as unknown as {
      ingredients: { grams: number }[];
    };
    (tm.ingredients[target.index] as { grams: number }).grams += 50;
    expect(mealPlanMatchesRecipes(tampered, i.recipes, i.foods, DEMO_SUBSTITUTIONS)).toBe(false);
    // Unbekannter Ersatz im Speicher → nicht verwendet.
    const foreign = JSON.parse(JSON.stringify(result.plan)) as MealPlanWeek;
    const fm = foreign.days
      .find((d) => d.date === target.date)
      ?.meals.find((m) => m.slot === target.slot) as unknown as {
      ingredientSwaps: { substituteFoodId: string }[];
    };
    (fm.ingredientSwaps[0] as { substituteFoodId: string }).substituteFoodId = 'salami';
    expect(mealPlanMatchesRecipes(foreign, i.recipes, i.foods, DEMO_SUBSTITUTIONS)).toBe(false);
  });

  it('neue Unverträglichkeit später: Ei-Tausch fällt durch → automatische Neuplanung ohne Ei', () => {
    const iFemale = input({ recipes: onlyMains(['tofu-paprika']), overrides: female });
    const pf = plan(iFemale);
    const f = findMeal(pf, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
    const t = { date: f.date, slot: f.slot, index: target.index };
    const egg = applyIngredientSwap(pf, t, 'huehnerei', iFemale);
    if (!egg.ok) throw new Error('Tausch erwartet');
    const later = { ...iFemale, profile: { ...omniPork, intolerances: ['eggs' as const] } };
    const check = needsAutomaticReplan(egg.plan, later);
    expect(check.reasons).toContain('recipe_excluded');
    const resolved = resolveMealPlanWeek(egg.plan, later);
    expect(resolved.action).toBe('replanned');
    expect(
      resolved.plan.days.some((d) =>
        d.meals.some((m) => m.ingredients.some((x) => x.foodId === 'huehnerei')),
      ),
    ).toBe(false);
  });

  it('S5: ein Plan mit Tausch ist ein Gesundheitsdatum (usesHealthData), auch die Einkaufsliste', () => {
    // Ohne Einwilligung bzw. Körperdaten: Plan ohne Gesundheitsbezug (Modus ohne Ziele).
    const iNo = input({
      recipes: onlyMains(['tofu-paprika']),
      overrides: { healthDataConsent: false, bodyMetricsRows: [] },
    });
    const pNo = plan(iNo);
    expect(pNo.usesHealthData).toBe(false);
    const f = findMeal(pNo, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
    const t = { date: f.date, slot: f.slot, index: target.index };
    const result = applyIngredientSwap(pNo, t, 'haehnchenbrust', iNo);
    if (!result.ok) throw new Error('Tausch erwartet');
    expect(result.plan.usesHealthData).toBe(true);
    expect(
      resolveShoppingList(newShoppingList(pNo, iNo), result.plan, iNo).list.usesHealthData,
    ).toBe(true);
    const back = applyIngredientSwap(result.plan, t, null, iNo);
    // Zurückgenommen: Der Gesundheitsbezug bleibt am gespeicherten Plan (sichere Richtung, wie N5a S1).
    expect(back.ok && back.plan.usesHealthData).toBe(true);
  });

  it('Einkaufsliste: neu aus dem Plan (W22), Ersatz statt Original', () => {
    const result = applyIngredientSwap(p, target, 'haehnchenbrust', i);
    if (!result.ok) throw new Error('Tausch erwartet');
    const before = buildShoppingList(p, i.foods, { from: target.date, to: target.date });
    const after = buildShoppingList(result.plan, i.foods, { from: target.date, to: target.date });
    expect(before.items.some((x) => x.foodId === 'tofu')).toBe(true);
    expect(after.items.some((x) => x.foodId === 'tofu')).toBe(false);
    expect(after.items.find((x) => x.foodId === 'haehnchenbrust')?.substituteFor).toEqual(['tofu']);
    const stored = newShoppingList(p, i);
    const resolved = resolveShoppingList(stored, result.plan, i);
    expect(resolved.action).toBe('rebuilt');
    expect(resolved.list.items.some((x) => x.foodId === 'haehnchenbrust')).toBe(true);
  });

  it('Payload nennt die getauschten Zutaten (S7), ohne Mengen', () => {
    const result = applyIngredientSwap(p, target, 'haehnchenbrust', i);
    if (!result.ok) throw new Error('Tausch erwartet');
    const payload = toMealPlanPayload(result.plan, {
      diet: 'omnivore',
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
      mealprep_slots: 'lunch',
    });
    const item = payload.items.find((x) => x.date === target.date && x.slot === target.slot);
    expect(item?.ingredient_swaps).toEqual([
      { food_id: 'tofu', substitute_food_id: 'haehnchenbrust' },
    ]);
    expect(
      payload.items.filter((x) => x !== item).every((x) => x.ingredient_swaps.length === 0),
    ).toBe(true);
  });

  it('nicht möglich: vergangener Tag, Zutat ohne Rolle, unbekannte Zutat, Ergänzungs-Snack', () => {
    const later = input({ recipes: onlyMains(['tofu-paprika']), today: addDays(MONDAY, 6) });
    const past = p.days.find((d) => d.date < later.today && d.meals.length > 0);
    const pastMeal = past?.meals.find((m) => !m.isFill);
    if (past !== undefined && pastMeal !== undefined) {
      expect(
        applyIngredientSwap(
          p,
          { date: past.date, slot: pastMeal.slot as MealSlotId, index: 0 },
          'tofu',
          later,
        ),
      ).toEqual({ ok: false, reason: 'past_day' });
    }
    const noRoleRecipes = i.recipes.map((r) =>
      r.id === 'tofu-paprika' ? (N3_RECIPES.find((x) => x.id === r.id) as Recipe) : r,
    );
    expect(ingredientSwapOptions(p, target, { ...i, recipes: noRoleRecipes })).toEqual({
      ok: false,
      reason: 'no_role',
    });
    expect(ingredientSwapPossible(p, target, { ...i, recipes: noRoleRecipes })).toBe(false);
    expect(ingredientSwapPossible(p, target, i)).toBe(true);
    expect(ingredientSwapOptions(p, { ...target, index: 40 }, i)).toEqual({
      ok: false,
      reason: 'not_found',
    });
    const fill = p.days.flatMap((d) => d.meals.filter((m) => m.isFill).map((m) => ({ d, m })))[0];
    if (fill !== undefined) {
      expect(
        ingredientSwapOptions(
          p,
          { date: fill.d.date, slot: fill.m.slot as MealSlotId, index: 0 },
          i,
        ),
      ).toEqual({ ok: false, reason: 'not_found' });
    }
  });

  it('Modus no_targets (Schwangerschaft): Faktor bleibt 1, nur erhitzte Alternativen (gebratener Tofu)', () => {
    const ip = input({ recipes: onlyMains(['tofu-paprika']), overrides: pregnant });
    const pp = plan(ip);
    const f = findMeal(pp, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
    const options = ingredientSwapOptions(
      pp,
      { date: f.date, slot: f.slot, index: target.index },
      ip,
    );
    expect(options.ok).toBe(true);
    if (!options.ok) return;
    // Tofu wird gebraten (heated: true) → Ersatz ebenfalls erhitzt, auch in der Schwangerschaft angeboten.
    expect(options.options.map((o) => o.substituteFoodId).sort()).toEqual([
      'haehnchenbrust',
      'huehnerei',
    ]);
    for (const option of options.options) {
      for (const d of option.plan.days) for (const m of d.meals) expect(m.factor).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// Haltbarkeit und Kochtag (B2)
// ---------------------------------------------------------------------------------------------------------

/** Meal-Prep-Gericht: Tofu hält 2 Tage, Hähnchen 1 Tag. */
function tofuBox(freezable: boolean): Recipe {
  return makeRecipe({
    id: 'tofu-box',
    title_de: 'Tofu-Box mit Paprika',
    description_de: 'Gebratener Tofu mit Paprika und Reis, gut vorzubereiten.',
    meal_types: ['main'],
    training_tags: [],
    servings: 1,
    ingredients: [
      ing('tofu', 150, 'g', { role: 'protein', heated: true }),
      ing('paprika', 1, 'piece', { role: 'vegetable' }),
      ing('reis', 60, 'g', { role: 'carb' }),
    ],
    steps_de: ['Reis kochen.', 'Tofu und Paprika braten.'],
    prep_minutes: 10,
    cook_minutes: 20,
    meal_prep: { suitable: true, fridge_days: 3, freezable },
    equipment_de: ['Pfanne'],
    declared_per_serving: { kcal: 450, protein_g: 26, carbs_g: 57, fat_g: 12 },
    declared_diet: 'vegan',
    declared_allergens: ['soy', 'legumes'],
  });
}

/** Wie `tofuBox`, aber ohne Reis (Reis hält nur 1 Tag) – damit Tofu (2 Tage) die Haltbarkeit bestimmt. */
function tofuBoxNoRice(freezable: boolean): Recipe {
  const recipe = tofuBox(freezable);
  return { ...recipe, ingredients: recipe.ingredients.filter((x) => x.food_id !== 'reis') };
}

describe('Haltbarkeit nach dem Tausch (B2) und Kochtag vorbei', () => {
  const mealPrep: MealPlanProfileInput = {
    diet: 'omnivore',
    eatsPork: true,
    cookingMode: 'meal_prep',
    mealprepDays: 1,
  };

  for (const freezable of [true, false]) {
    it(`Tausch Tofu → Hähnchen im Meal-Prep-Plan → ab Tag 2 ${freezable ? 'eingefroren' : 'frisch gekocht'}`, () => {
      const box = tofuBoxNoRice(freezable);
      const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), box];
      const i = input({ profile: mealPrep, recipes });
      const p = plan(i);
      const leftovers = p.days.flatMap((d) =>
        d.meals
          .filter((m) => m.recipeId === box.id && m.prepKind === 'leftover')
          .map((m) => ({ d, m })),
      );
      // Vorher: Tofu hält 2 Tage → Mo/Di aus dem Kühlschrank.
      expect(leftovers.filter((x) => x.m.storage === 'fridge').map((x) => x.d.date)).toEqual([
        MONDAY,
        addDays(MONDAY, 1),
      ]);
      const first = leftovers[0] as (typeof leftovers)[number];
      const target = { date: first.d.date, slot: first.m.slot as MealSlotId, index: 0 };
      const result = applyIngredientSwap(p, target, 'haehnchenbrust', i);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.affectedDates.length).toBe(leftovers.length);
      const after = result.plan.days.flatMap((d) =>
        d.meals
          .filter((m) => m.recipeId === box.id && m.cookDate === first.m.cookDate)
          .map((m) => ({ d, m })),
      );
      for (const { d, m } of after) {
        const days = daysBetween(first.m.cookDate, d.date);
        expect(m.ingredientSwaps).toEqual([
          { index: 0, foodId: 'tofu', substituteFoodId: 'haehnchenbrust' },
        ]);
        if (days <= 1) expect(m.storage).toBe('fridge');
        else expect(m.storage).toBe('freeze');
      }
      const tuesday = result.plan.days[1]?.meals.find((m) => m.recipeId === box.id);
      if (freezable) {
        expect(tuesday).toMatchObject({ prepKind: 'leftover', storage: 'freeze' });
      } else {
        // Nicht einfrierbar: Dienstag wird frisch gekocht (mit dem Tausch), Hinweis dazu.
        expect(tuesday).toMatchObject({
          prepKind: 'fresh',
          storage: null,
          cookDate: addDays(MONDAY, 1),
        });
        expect(result.plan.days[1]?.notices).toContain('meal_prep_fresh_days');
      }
      // Kein Rest länger im Kühlschrank als die neue Haltbarkeit (R9).
      expect(needsAutomaticReplan(result.plan, i).reasons).not.toContain('leftover_expired');
    });
  }

  it('Tofu → Hähnchen (nicht einfrierbar) → Original → Dienstag wieder Tofu (Wächter N9 Runde 2)', () => {
    const box = tofuBoxNoRice(false);
    const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), box];
    const i = input({ profile: mealPrep, recipes });
    const p = plan(i);
    const first = p.days[0]?.meals.find((m) => m.recipeId === box.id) as { slot: string };
    const target = { date: MONDAY, slot: first.slot as MealSlotId, index: 0 };
    const swapped = applyIngredientSwap(p, target, 'haehnchenbrust', i);
    if (!swapped.ok) throw new Error('Tausch erwartet');
    const tuesday = (pl: MealPlanWeek) => pl.days[1]?.meals.find((m) => m.recipeId === box.id);
    expect(tuesday(swapped.plan)).toMatchObject({ prepKind: 'fresh' });
    expect(tuesday(swapped.plan)?.ingredientSwaps).toHaveLength(1);
    const back = applyIngredientSwap(swapped.plan, target, null, i);
    if (!back.ok) throw new Error('Zurücknehmen erwartet');
    expect(back.affectedDates).toContain(addDays(MONDAY, 1));
    for (const day of back.plan.days) {
      for (const m of day.meals.filter((x) => x.recipeId === box.id)) {
        expect(m.ingredientSwaps).toBeUndefined();
        expect(m.ingredients.find((x) => x.index === 0)?.foodId).toBe('tofu');
      }
    }
  });

  it('filterRecipe lehnt einen direkt übergebenen, ungeprüften Tausch ab (B1, Verteidigung in der Tiefe)', () => {
    const box = tofuBoxNoRice(true);
    const unheated = {
      ...box,
      ingredients: box.ingredients.map((x, n) => (n === 0 ? { ...x, heated: undefined } : x)),
    };
    const swap = {
      index: 0,
      foodId: 'tofu',
      substituteFoodId: 'haehnchenbrust',
      amount: 85,
      unit: 'g' as const,
      heated: true,
      substitutionId: 'x',
    };
    const ctx = {
      profile: mealPlanProfileSchema.parse(omniPork),
      excludePregnancyCaution: false,
      allowDrafts: true,
    };
    expect(filterRecipe(unheated, N3_FOODS, ctx, [swap]).ok).toBe(false);
    expect(filterRecipe(box, N3_FOODS, ctx, [swap]).ok).toBe(true);
    expect(filterRecipe(unheated, N3_FOODS, ctx).ok).toBe(true);
  });

  it('S1: dieselbe Aufbewahrungs-Regel wie applyMealPrepPlan – eingefroren + nicht einfrierbarer Ersatz → frisch; Zeitlimit werktags', () => {
    const box = tofuBoxNoRice(true);
    const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), box];
    const i = input({ profile: mealPrep, recipes });
    const p = plan(i);
    const frozen = p.days.flatMap((d) =>
      d.meals.filter((m) => m.recipeId === box.id && m.storage === 'freeze').map((m) => ({ d, m })),
    );
    expect(frozen.length).toBeGreaterThan(0);
    const first = p.days[0]?.meals.find((m) => m.recipeId === box.id) as { slot: string };
    const target = { date: MONDAY, slot: first.slot as MealSlotId, index: 0 };
    // Ei ist nicht einfrierbar: Tage, die vorher eingefroren waren, werden frisch gekocht (nie „Kühlschrank“).
    const egg = applyIngredientSwap(p, target, 'huehnerei', i);
    expect(egg.ok).toBe(true);
    if (!egg.ok) return;
    for (const { d } of frozen) {
      const after = egg.plan.days
        .find((x) => x.date === d.date)
        ?.meals.find((m) => m.recipeId === box.id);
      expect(after).toMatchObject({ prepKind: 'fresh', storage: null, cookDate: d.date });
    }
    // Werktags höchstens 20 Minuten (Rezept: 30) → frisch kochen geht nicht → kein Tausch (wie applyMealPrepPlan, K1).
    const limited: PlanInput = { ...i, profile: { ...mealPrep, maxPrepMinutesWeekday: 20 } };
    expect(applyIngredientSwap(p, target, 'huehnerei', limited)).toEqual({
      ok: false,
      reason: 'prep_time',
    });
  });

  it('K1: Kochtag-Timer gestartet → am Kochtag kein Tausch mehr', () => {
    const box = tofuBoxNoRice(true);
    const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), box];
    const i = input({ profile: mealPrep, recipes });
    const p = plan(i);
    const first = p.days[0]?.meals.find((m) => m.recipeId === box.id) as {
      slot: string;
      cookDate: string;
    };
    const target = { date: MONDAY, slot: first.slot as MealSlotId, index: 0 };
    expect(ingredientSwapPossible(p, target, i)).toBe(true);
    const started = { cookStartedOn: first.cookDate };
    expect(ingredientSwapPossible(p, target, i, started)).toBe(false);
    expect(ingredientSwapOptions(p, target, i, started)).toEqual({
      ok: false,
      reason: 'already_cooked',
    });
    expect(applyIngredientSwap(p, target, 'haehnchenbrust', i, started)).toEqual({
      ok: false,
      reason: 'already_cooked',
    });
    // Ein anderer Tag als Start ändert nichts.
    expect(ingredientSwapPossible(p, target, i, { cookStartedOn: addDays(MONDAY, 3) })).toBe(true);
  });

  it('Kochtag vorbei → kein Tausch für vorgekochte Portionen', () => {
    const box = tofuBoxNoRice(true);
    const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), box];
    const p = plan(input({ profile: mealPrep, recipes }));
    const monday = p.days[0]?.meals.find((m) => m.recipeId === box.id) as { slot: string };
    const later = input({ profile: mealPrep, recipes, today: MONDAY });
    const target = { date: MONDAY, slot: monday.slot as MealSlotId, index: 0 };
    expect(ingredientSwapOptions(p, target, later)).toEqual({
      ok: false,
      reason: 'already_cooked',
    });
    expect(applyIngredientSwap(p, target, 'haehnchenbrust', later)).toEqual({
      ok: false,
      reason: 'already_cooked',
    });
    expect(ingredientSwapPossible(p, target, later)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Import-Annahmen (N2d) bleiben sicher
// ---------------------------------------------------------------------------------------------------------

describe('Import-Annahmen und Fingerabdruck (N2d) beim Tausch', () => {
  const base = makeRecipe({
    id: 'lachs-haehnchen-bowl',
    title_de: 'Lachs-Hähnchen-Bowl',
    description_de: 'Lachs und Hähnchen gebraten mit Reis.',
    meal_types: ['main'],
    training_tags: [],
    servings: 1,
    ingredients: [
      ing('lachs', 80, 'g', { heated: true, role: 'protein' }),
      ing('haehnchenbrust', 80, 'g', { heated: true, role: 'protein' }),
      ing('reis', 60, 'g', { role: 'carb' }),
    ],
    steps_de: ['Reis kochen.', 'Lachs und Hähnchen braten.'],
    declared_diet: 'omnivore',
    declared_allergens: ['fish', 'poultry'],
  });
  const assumptions = [
    {
      ingredient_index: 0,
      food_id: 'lachs',
      field: 'heated' as const,
      value: true as const,
      reason_de: 'Lachs wird laut Schritt gebraten.',
    },
    {
      ingredient_index: 1,
      food_id: 'haehnchenbrust',
      field: 'heated' as const,
      value: true as const,
      reason_de: 'Hähnchen wird laut Schritt gebraten.',
    },
  ];
  const confirmed: Recipe = {
    ...base,
    meta: {
      ...RECIPE_META,
      import_assumptions: assumptions,
      import_assumptions_confirmed_by: 'KT',
      import_assumptions_fingerprint: importAssumptionsFingerprint(base),
    },
  };
  // Von Hand gesetzter Tausch (ohne Tabelle): prüft die zweite Schutzschicht in computeRecipeFacts.
  const map = new Map([
    [0, { food_id: 'haehnchenbrust', amount: 70, unit: 'g' as const, heated: true }],
  ]);

  it('B1: an einer Zutat mit Import-Annahme „erhitzt“ wird nie ein Ersatz angeboten, der erhitzt werden muss', () => {
    expect(
      resolveIngredientSwaps(
        confirmed,
        [{ index: 0, foodId: 'lachs', substituteFoodId: 'haehnchenbrust' }],
        DEMO_SUBSTITUTIONS,
        N3_FOODS,
      ),
    ).toBeNull();
  });

  it('bestätigte Annahme an der getauschten Zutat gilt nicht für den Ersatz (unbestätigt → Schwangerschaft)', () => {
    expect(computeRecipeFacts(confirmed, N3_FOODS).pregnancyCaution).toBe(false);
    const facts = computeRecipeFacts(confirmed, N3_FOODS, { swaps: map });
    expect(facts.pregnancyReasons).toEqual([
      { kind: 'unconfirmed_heated', index: 0, foodId: 'haehnchenbrust' },
    ]);
  });

  it('offene Annahmen bleiben offen (alle Zutaten), der Fingerabdruck wird am Original gebildet', () => {
    const open: Recipe = { ...base, meta: { ...RECIPE_META, import_assumptions: assumptions } };
    const facts = computeRecipeFacts(open, N3_FOODS, { swaps: map });
    expect(facts.pregnancyReasons.map((r) => r.kind)).toEqual([
      'unconfirmed_heated',
      'unconfirmed_heated',
    ]);
    // Der Tausch ändert das Rezept nicht (nur die Mahlzeit) – der Fingerabdruck bleibt gültig.
    expect(importAssumptionsFingerprint(confirmed)).toBe(
      confirmed.meta.import_assumptions_fingerprint,
    );
  });

  it('im Plan: der Tausch Lachs → Hähnchen wird nie angeboten (auch nicht Nicht-Schwangeren)', () => {
    const recipes = [...RECIPES.filter((r) => !r.meal_types.includes('main')), confirmed];
    const ip = input({ recipes });
    const pp = plan(ip);
    const f = findMeal(pp, confirmed.id, MONDAY);
    expect(f).not.toBeNull();
    if (f === null) return;
    const options = ingredientSwapOptions(pp, { date: f.date, slot: f.slot, index: 0 }, ip);
    expect(options.ok && options.options).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Obergrenze (S1)
// ---------------------------------------------------------------------------------------------------------

describe('Obergrenze (S1): kein Tausch über der Obergrenze', () => {
  it('Paprika → Erdnüsse (gleiche Masse) sprengt den Tag → nicht angeboten', () => {
    const heavy: IngredientSubstitution = {
      id: substitutionContentId('paprika', 'erdnuesse'),
      version: 1,
      status: 'draft',
      food_id: 'paprika',
      substitute_food_id: 'erdnuesse',
      factor: 4,
      role: 'vegetable',
      note_de: 'Nur für diesen Test.',
      meta: { ...RECIPE_META },
    };
    const i = input({
      recipes: onlyMains(['tofu-paprika']),
      table: [heavy],
      overrides: {
        ...female,
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 160, weightKg: 50 }],
      },
    });
    const p = plan(i);
    const f = findMeal(p, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
    const result = applyIngredientSwap(
      p,
      { date: f.date, slot: f.slot, index: ingredientIndex('tofu-paprika', 'paprika') },
      'erdnuesse',
      i,
    );
    expect(result.ok ? 'ok' : result.reason).toBe('above_ceiling');
  });
});

// ---------------------------------------------------------------------------------------------------------
// Eigenschaftstests (DoD 19.7 N9)
// ---------------------------------------------------------------------------------------------------------

describe('Eigenschaft: Austausch liefert nie etwas, das filter.ts ausschließt – und nie über der Obergrenze', () => {
  const diets = ['vegan', 'vegetarian', 'omnivore'] as const;
  const groups = [
    'eggs',
    'poultry',
    'fish',
    'soy',
    'gluten',
    'mushrooms',
    'peanuts',
    'beef',
  ] as const;
  const rand = seededRandom(9009);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

  const cases = Array.from({ length: 48 }, (_, n) => {
    const diet = diets[n % 3] as (typeof diets)[number];
    const eatsPork = diet === 'omnivore' ? pick([true, false, null] as const) : null;
    const intolerances = rand() < 0.4 ? [pick(groups)] : [];
    const dislikes = rand() < 0.4 ? [pick(groups)] : [];
    const isPregnant = n % 4 === 3;
    const meals = pick([1, 3, 4, 6]);
    const weight = pick([45, 60, 80, 120]);
    // Wächter N9 S4: Meal-Prep-Profile und „heute“ mitten in der Woche (vergangene Tage wirklich prüfen).
    const mealPrepDays = n % 3 === 1 ? pick([1, 2, 3, 5]) : null;
    const midWeek = n % 2 === 1;
    return {
      diet,
      eatsPork,
      intolerances,
      dislikes,
      isPregnant,
      meals,
      weight,
      mealPrepDays,
      midWeek,
    };
  });

  let offered = 0;
  let swappedPregnancyFree = 0;
  let pastDaysChecked = 0;
  let mealPrepOffered = 0;
  it.each(cases.map((c, n) => [n, c] as const))('Profil %i', (_n, c) => {
    const profile: MealPlanProfileInput = {
      diet: c.diet,
      eatsPork: c.eatsPork,
      intolerances: c.intolerances,
      dislikes: c.dislikes.filter((g) => !c.intolerances.includes(g)),
      ...(c.mealPrepDays === null
        ? {}
        : { cookingMode: 'meal_prep' as const, mealprepDays: c.mealPrepDays }),
    };
    const built = input({
      profile,
      meals: c.meals,
      overrides: {
        ...(c.isPregnant ? pregnant : female),
        bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 170, weightKg: c.weight }],
      },
    });
    const p = plan(built);
    // Mitten in der Woche: Plan von Sonntag, getauscht wird am Mittwoch.
    const i: PlanInput = c.midWeek ? { ...built, today: addDays(MONDAY, 2) } : built;
    const parsed = mealPlanProfileSchema.parse(profile);
    for (const target of swapTargets(p, i)) {
      const options = ingredientSwapOptions(p, target, i);
      if (!options.ok) continue;
      for (const option of options.options) {
        offered += 1;
        if (c.isPregnant) swappedPregnancyFree += 1;
        const meal = mealAt(option.plan, target.date, target.slot);
        expect(meal).toBeDefined();
        if (meal === undefined) continue;
        const recipe = i.recipes.find((r) => r.id === meal.recipeId) as Recipe;
        const used = meal.ingredients.map((x) => ({ index: x.index, foodId: x.foodId }));
        // Unabhängige Erwartungsregel – nicht filter.ts selbst (Wächter N3 S5c).
        const recipeForOracle = withSwappedHeated(recipe, meal.ingredientSwaps ?? []);
        expect(usedFoodViolations(recipeForOracle, used, parsed, c.isPregnant, N3_FOODS)).toEqual(
          [],
        );
        // Wächter N9 B1, unabhängig: Ersatz, der erhitzt werden muss, nur in gekochten Rezepten an einer ausdrücklich
        // erhitzten Zutat ohne Import-Annahme – für ALLE Personen.
        for (const ref of meal.ingredientSwaps ?? []) {
          const substitute = N3_FOODS.get(ref.substituteFoodId);
          if (substitute !== undefined && expectNeedsHeating(substitute)) {
            expect(recipe.no_cook).toBe(false);
            expect(recipe.ingredients[ref.index]?.heated).toBe(true);
            expect(
              (recipe.meta.import_assumptions ?? []).some((a) => a.ingredient_index === ref.index),
            ).toBe(false);
          }
        }
        if (meal.prepKind !== 'fresh' || meal.mealPrepPlanId !== null) mealPrepOffered += 1;
        for (const day of option.plan.days) {
          const total = day.meals.reduce((sum, m) => sum + m.nutrients.kcal + m.optionalKcal, 0);
          if (day.band !== null) {
            expect(total).toBeLessThanOrEqual(day.band.max + 1e-6);
            if (day.status === 'complete') {
              expect(day.totals.kcal).toBeGreaterThanOrEqual(day.band.min - 1e-6);
            } else {
              expect(day.status).toBe('below_floor');
              expect(day.notices).toContain('day_below_floor');
            }
          }
          for (const m of day.meals) {
            expect(m.factor).toBeGreaterThanOrEqual(0.5);
            expect(m.factor).toBeLessThanOrEqual(2);
            if (day.status === 'no_targets') expect(m.factor).toBe(1);
          }
        }
        // Vergangene Tage nie geändert.
        option.plan.days
          .filter((d) => d.date < i.today)
          .forEach((d) => {
            pastDaysChecked += 1;
            expect(d).toEqual(p.days.find((x) => x.date === d.date));
          });
      }
    }
  });

  it('der Eigenschaftstest prüft wirklich Angebote (auch in der Schwangerschaft)', () => {
    expect(offered).toBeGreaterThan(50);
    expect(swappedPregnancyFree).toBeGreaterThan(0);
    expect(pastDaysChecked).toBeGreaterThan(20);
    expect(mealPrepOffered).toBeGreaterThan(0);
  });
});

/**
 * Rezept wie nach dem Tausch, UNABHÄNGIG aus dem Plan (19.7 N9 B2) geschrieben: Hatte das Original kein `heated`,
 * gilt der Ersatz als ungegart (`heated: false`), sonst bleibt der Wert.
 */
function withSwappedHeated(
  recipe: Recipe,
  refs: readonly { index: number; foodId: string; substituteFoodId: string }[],
): Recipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((x, index) => {
      const ref = refs.find((y) => y.index === index);
      return ref === undefined
        ? x
        : {
            ...x,
            food_id: ref.substituteFoodId,
            heated: x.heated === undefined ? false : x.heated,
          };
    }),
  };
}

describe('Rezeptansicht einer getauschten Mahlzeit (recipeVariantForMeal)', () => {
  const recipe = RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe;
  const index = ingredientIndex('tofu-paprika', 'tofu');
  const meal = { ingredientSwaps: [{ index, foodId: 'tofu', substituteFoodId: 'huehnerei' }] };
  const ctx = (excludePregnancyCaution: boolean) => ({
    profile: mealPlanProfileSchema.parse(omniPork),
    excludePregnancyCaution,
    allowDrafts: true,
  });

  it('„Enthält“ und Ernährungsform aus dem Tausch; ohne Tabelle oder ohne erhitzte Zutat null', () => {
    const variant = recipeVariantForMeal(recipe, meal, ctx(false), N3_FOODS, DEMO_SUBSTITUTIONS);
    expect(variant?.facts.allergens).toEqual(['eggs']);
    expect(variant?.facts.diet).toBe('vegetarian');
    expect(variant?.swaps.map((s) => s.substituteFoodId)).toEqual(['huehnerei']);
    expect(recipeVariantForMeal(recipe, meal, ctx(false), N3_FOODS, [])).toBeNull();
    // Gebratener Tofu → Ei erhitzt: auch in der Schwangerschaft passend.
    expect(
      recipeVariantForMeal(recipe, meal, ctx(true), N3_FOODS, DEMO_SUBSTITUTIONS),
    ).not.toBeNull();
    // Tofu ohne „heated“: kein Tausch (B1) → null.
    const unheated = withRole(N3_RECIPES.find((r) => r.id === 'tofu-paprika') as Recipe, 'tofu');
    expect(
      recipeVariantForMeal(unheated, meal, ctx(false), N3_FOODS, DEMO_SUBSTITUTIONS),
    ).toBeNull();
    // Ohne Tausch: wie der normale Filter.
    expect(
      recipeVariantForMeal(recipe, {}, ctx(false), N3_FOODS, DEMO_SUBSTITUTIONS)?.facts.allergens,
    ).toEqual(['legumes', 'soy']);
  });
});

describe('Wächter N9 S2/S3: Untergrenze – sichere Voreinstellung bis zur Gründer-Entscheidung', () => {
  /** Kalorienarmer Ersatz: Reis → Paprika-Masse (nur für diesen Test, Rolle Kohlenhydrat ohne R23-Prüfung). */
  const light: IngredientSubstitution = {
    id: substitutionContentId('reis', 'paprika'),
    version: 1,
    status: 'draft',
    food_id: 'reis',
    substitute_food_id: 'paprika',
    factor: 1,
    role: 'carb',
    note_de: 'Nur für diesen Test.',
    meta: { ...RECIPE_META },
  };
  const table = [...DEMO_SUBSTITUTIONS, light];
  const i = input({ recipes: onlyMains(['tofu-paprika']), table, meals: 1 });
  const p = plan(i);
  const f = findMeal(p, 'tofu-paprika', MONDAY) as NonNullable<ReturnType<typeof findMeal>>;
  const target = { date: f.date, slot: f.slot, index: ingredientIndex('tofu-paprika', 'reis') };

  it('Ersatz, der einen vollständigen Tag unter die Untergrenze drückt, meldet alle betroffenen Tage', () => {
    const day = p.days.find((d) => d.date === f.date);
    expect(day?.status).toBe('complete');
    const result = applyIngredientSwap(p, target, 'paprika', i);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.belowFloorDates).toEqual([f.date]);
    expect(result.plan.days.find((d) => d.date === f.date)?.status).toBe('below_floor');
  });

  it('ausgeblendet, solange es eine Alternative gibt, die den Tag hält; sonst mit Hinweis angezeigt', () => {
    const options = ingredientSwapOptions(p, target, i);
    expect(options.ok).toBe(true);
    if (!options.ok) return;
    const ids = options.options.map((o) => o.substituteFoodId);
    expect(ids).toContain('spaghetti');
    expect(ids).not.toContain('paprika');
    const only = ingredientSwapOptions(p, target, { ...i, substitutions: [light] });
    expect(only.ok && only.options.map((o) => o.substituteFoodId)).toEqual(['paprika']);
    expect(only.ok && only.options[0]?.belowFloorDates).toEqual([f.date]);
  });
});

describe('Wächter N9 K2: Rezeptansicht mit den bei der Mahlzeit weggelassenen optionalen Zutaten', () => {
  it('weggelassene optionale Zutat zählt nicht bei „Enthält“', () => {
    const recipe = withRole(
      RECIPES.find((r) => r.id === 'spaghetti-tomatensauce') as Recipe,
      'nichts',
    );
    const parmesan = recipe.ingredients.findIndex((x) => x.food_id === 'parmesan');
    const ctx = {
      profile: mealPlanProfileSchema.parse(omniPork),
      excludePregnancyCaution: false,
      allowDrafts: true,
    };
    const full = recipeVariantForMeal(recipe, {}, ctx, N3_FOODS, DEMO_SUBSTITUTIONS);
    expect(full?.facts.allergens).toContain('dairy');
    const without = recipeVariantForMeal(
      recipe,
      { omittedOptional: [{ index: parmesan, foodId: 'parmesan' }] },
      ctx,
      N3_FOODS,
      DEMO_SUBSTITUTIONS,
    );
    expect(without?.omitted).toEqual([parmesan]);
    expect(without?.facts.allergens).not.toContain('dairy');
  });
});
