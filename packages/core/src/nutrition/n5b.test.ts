/**
 * Etappe N5b (docs/PLAN-PHASE-5.md 6.5, 6.6, 19.6, Umsetzungsstand N5a/N5b): gespeicherte Einkaufsliste (Häkchen,
 * eigene Einträge, Zeitraum, „Zur Einkaufsliste“, Neuerzeugung bei Neuplanung – W22 App-Logik), Meal-Prep-Kochtag
 * (Übersicht, Auftau-Hinweise, Timer), Wächter N5a K-a (Reste über die Haltbarkeit), K-b (neu erstellt wegen
 * Rezept-Version) und Wächter N3 K1 (`applyMealPrepPlan` mit `slotFitReasons`). Grenzfälle: 1 vs. 8 Mahlzeiten,
 * Sonntag/Samstag, vergangene Liste, 1 und 12 Portionen, Höchstzahlen.
 */
import { describe, expect, it } from 'vitest';

import { RECIPE_SERVINGS_PICKER, SHOPPING_LIST_EXTRAS } from '../constants';
import type { Food } from '../content/food-schema';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { Recipe } from '../content/recipe-schema';
import { DEMO_MEAL_PREP_PLANS } from '../demo-nutrition';
import { addDays, daysBetween } from '../dates';
import { buildMealPlanWeek, type MealPlanInput, type MealPlanWeek } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import {
  parseStoredMealPlanWeek as parseStoredPlanSafe,
  resolveMealPlanWeek,
} from './meal-plan-store';
import { leftoverKeeps } from './meal-prep';
import {
  cookDayAlarms,
  cookDayOverview,
  cookDayProgress,
  defaultMealPrepWeekStart,
  thawHints,
} from './meal-prep-day';
import { applyMealPrepPlan } from './meal-prep-plan';
import { automaticReplan, needsAutomaticReplan } from './replan';
import type { MealPlanProfileInput, NutritionInputsInput } from './schemas';
import {
  addManualShoppingItem,
  buildShoppingList,
  setShoppingItemChecked,
  type ShoppingListItem,
} from './shopping-list';
import {
  addRecipeToShoppingList,
  mealPlanShoppingKey,
  newShoppingList,
  parseStoredShoppingList,
  removeRecipeFromShoppingList,
  resolveShoppingList,
  shoppingListRangeValid,
  type StoredShoppingList,
  withShoppingListRange,
} from './shopping-list-store';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY } from './test-helpers';

const SUNDAY_BEFORE = '2026-10-11';
const WEDNESDAY = '2026-10-14';
const THURSDAY = '2026-10-15';
const SUNDAY = '2026-10-18';
const omni: MealPlanProfileInput = { diet: 'omnivore', eatsPork: true };
const vegetarian: MealPlanProfileInput = { diet: 'vegetarian' };
const vegan: MealPlanProfileInput = { diet: 'vegan' };
const female = { sex: 'female' as const, healthFlags: { flags: [] } };
const pregnantFlags = {
  sex: 'female' as const,
  healthFlags: { flags: ['pregnancy', 'conservative_plan'] },
} satisfies Partial<NutritionInputsInput>;

type PlanInput = Omit<MealPlanInput, 'existingPlan' | 'variant'>;

function input(
  overrides: Partial<NutritionInputsInput> = {},
  profile: MealPlanProfileInput = omni,
  today = SUNDAY_BEFORE,
  recipes: readonly Recipe[] = N3_RECIPES,
): PlanInput {
  return {
    targets: nutritionTargetsForWeek(inputs({ today, mealsPerDay: 4, ...overrides }), MONDAY),
    profile,
    recipes,
    foods: N3_FOODS,
    allowDrafts: true,
    today,
  };
}

const viaStorage = <T>(value: T): unknown => JSON.parse(JSON.stringify(value)) as unknown;
const caution = (food: Food | undefined) => food?.pregnancy_caution === true;
const peanut = (food: Food | undefined) => food?.groups.includes('peanuts') === true;
const open = (list: StoredShoppingList) => list.items.filter((i) => !i.checked);
const byKey = (list: { items: readonly ShoppingListItem[] }, key: string) =>
  list.items.find((i) => i.itemKey === key);

/** Hakt jeden zweiten Plan-Eintrag ab. */
function tickEverySecond(list: StoredShoppingList): StoredShoppingList {
  return list.items
    .filter((i) => !i.isManual)
    .filter((_, index) => index % 2 === 0)
    .reduce((acc, item) => setShoppingItemChecked(acc, item.itemKey, true), list);
}

// ---------------------------------------------------------------------------------------------------------
// K-a, K-b
// ---------------------------------------------------------------------------------------------------------

describe('leftoverKeeps (Wächter N5a K-a: Kochtag + Haltbarkeit ≥ Tag)', () => {
  const keeping = { fridgeDays: 2, freezable: false };
  const leftover = (cookDate: string, storage: 'fridge' | 'freeze' | null) => ({
    prepKind: 'leftover',
    cookDate,
    storage,
  });

  it('Kühlschrank genau bis zur Haltbarkeit, danach nicht; Kochtag nie am selben oder späteren Tag', () => {
    expect(leftoverKeeps(leftover(MONDAY, 'fridge'), addDays(MONDAY, 1), keeping)).toBe(true);
    expect(leftoverKeeps(leftover(MONDAY, 'fridge'), addDays(MONDAY, 2), keeping)).toBe(true);
    expect(leftoverKeeps(leftover(MONDAY, 'fridge'), addDays(MONDAY, 3), keeping)).toBe(false);
    expect(leftoverKeeps(leftover(MONDAY, 'fridge'), MONDAY, keeping)).toBe(false);
    expect(leftoverKeeps(leftover(THURSDAY, 'fridge'), MONDAY, keeping)).toBe(false);
    expect(
      leftoverKeeps(leftover(MONDAY, 'fridge'), addDays(MONDAY, 1), {
        fridgeDays: 0,
        freezable: true,
      }),
    ).toBe(false);
  });

  it('eingefroren nur bei einfrierbar; ohne Aufbewahrung ungültig; Kochtag/frisch immer', () => {
    expect(leftoverKeeps(leftover(MONDAY, 'freeze'), SUNDAY, keeping)).toBe(false);
    expect(leftoverKeeps(leftover(MONDAY, 'freeze'), SUNDAY, { ...keeping, freezable: true })).toBe(
      true,
    );
    expect(leftoverKeeps(leftover(MONDAY, null), addDays(MONDAY, 1), keeping)).toBe(false);
    expect(
      leftoverKeeps({ prepKind: 'cook', cookDate: MONDAY, storage: null }, MONDAY, keeping),
    ).toBe(true);
    expect(
      leftoverKeeps({ prepKind: 'fresh', cookDate: SUNDAY, storage: null }, MONDAY, keeping),
    ).toBe(true);
  });
});

/** Erster Rest ab `from` (Index des Tages), dessen Rezept 1 Tag im Kühlschrank hält. */
function findLeftover(plan: MealPlanWeek, from: number) {
  for (let d = from; d < 7; d += 1) {
    const day = plan.days[d];
    const meal = day?.meals.findIndex((m) => m.prepKind === 'leftover' && m.storage === 'fridge');
    if (day !== undefined && meal !== undefined && meal >= 0) return { d, m: meal };
  }
  return null;
}

describe('Abgleich gespeicherter Pläne um Kochtag/Haltbarkeit (K-a)', () => {
  it('veränderter Gerätespeicher: Rest über die Kühlschrank-Haltbarkeit → ab heute neu geplant, nie angezeigt', () => {
    let tested = 0;
    for (const mealprepDays of [1, 2, 3]) {
      const profile: MealPlanProfileInput = {
        ...omni,
        cookingMode: 'meal_prep',
        mealprepDays,
      };
      const data = input(female, profile, WEDNESDAY);
      const plan = buildMealPlanWeek(input(female, profile));
      const hit = findLeftover(plan, 2);
      if (hit === null) continue;
      tested += 1;
      // Kochtag 10 Tage früher (Speicher manipuliert) – Zutaten und Nährwerte stimmen weiter.
      const tampered = structuredClone(plan) as MealPlanWeek;
      const meal = tampered.days[hit.d]?.meals[hit.m] as { cookDate: string };
      meal.cookDate = addDays(plan.days[hit.d]?.date as string, -10);
      const check = needsAutomaticReplan(tampered, data);
      expect(check.reasons).toContain('leftover_expired');
      const result = resolveMealPlanWeek(tampered, data);
      expect(result.action).toBe('replanned');
      for (const day of result.plan.days.filter((x) => x.date >= WEDNESDAY)) {
        for (const m of day.meals) {
          if (m.prepKind !== 'leftover') continue;
          expect(daysBetween(m.cookDate, day.date)).toBeGreaterThanOrEqual(1);
          if (m.storage === 'fridge')
            expect(daysBetween(m.cookDate, day.date)).toBeLessThanOrEqual(3);
        }
      }
      // Kein erneutes Neuplanen beim nächsten Öffnen (keine Schleife).
      expect(resolveMealPlanWeek(result.plan, data).action).toBe('stored');
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('frische Pläne mit 1–7 Kochtagen und 1/4/8 Mahlzeiten brauchen nie eine Neuplanung wegen Resten', () => {
    for (const mealprepDays of [1, 2, 3, 4, 5, 6, 7]) {
      for (const mealsPerDay of [1, 4, 8]) {
        for (const today of [SUNDAY_BEFORE, THURSDAY]) {
          const data = input(
            { ...female, mealsPerDay },
            {
              ...vegetarian,
              cookingMode: 'meal_prep',
              mealprepDays,
              mealprepSlots: 'lunch_dinner',
            },
            today,
          );
          const plan = buildMealPlanWeek(data);
          expect(needsAutomaticReplan(plan, data).reasons).not.toContain('leftover_expired');
        }
      }
    }
    // Einzeln < 1 s; in CI unter Parallel-Last über der 5-s-Standardgrenze (14.10.2026).
  }, 60_000);

  it('Rest „eingefroren“ bei nicht einfrierbarem Gericht → leftover_expired', () => {
    let tested = 0;
    for (const profile of [omni, vegetarian, vegan]) {
      for (const mealprepDays of [1, 2, 3]) {
        const prep: MealPlanProfileInput = { ...profile, cookingMode: 'meal_prep', mealprepDays };
        const plan = buildMealPlanWeek(input(female, prep));
        plan.days.forEach((day, d) => {
          day.meals.forEach((meal, m) => {
            const recipe = N3_RECIPES.find((r) => r.id === meal.recipeId);
            if (
              meal.prepKind !== 'leftover' ||
              recipe === undefined ||
              recipe.meal_prep.freezable
            ) {
              return;
            }
            tested += 1;
            const tampered = structuredClone(plan) as MealPlanWeek;
            (tampered.days[d]?.meals[m] as { storage: string }).storage = 'freeze';
            expect(needsAutomaticReplan(tampered, input(female, prep)).reasons).toContain(
              'leftover_expired',
            );
          });
        });
      }
    }
    expect(tested).toBeGreaterThan(0);
  });
});

describe('Neu erstellt wegen Rezept-Version (K-b)', () => {
  it('Version eines Rezepts der Woche geändert → „rebuilt“ (Hinweis), sonst „created“ bzw. „stored“', () => {
    const data = input(female, omni, THURSDAY);
    const stored = buildMealPlanWeek(input(female));
    expect(resolveMealPlanWeek(stored, data).action).toBe('stored');
    expect(resolveMealPlanWeek(null, data).action).toBe('created');
    const usedId = stored.days[0]?.meals[0]?.recipeId as string;
    const recipes = N3_RECIPES.map((r) => (r.id === usedId ? { ...r, version: r.version + 1 } : r));
    const result = resolveMealPlanWeek(stored, { ...data, recipes });
    expect(result.action).toBe('rebuilt');
    expect(
      result.plan.days
        .flatMap((d) => d.meals)
        .every((m) => m.recipeId !== usedId || m.recipeVersion === 2),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------
// N3 K1: applyMealPrepPlan mit slotFitReasons
// ---------------------------------------------------------------------------------------------------------

describe('applyMealPrepPlan mit Platz-Regeln (Wächter N3 K1)', () => {
  const pasta = DEMO_MEAL_PREP_PLANS.find((p) => p.id === 'demo-pasta-woche');
  if (pasta === undefined) throw new Error('Plan fehlt');

  it('ohne Zeitlimit angeboten (Kochtag Sonntag)', () => {
    expect(applyMealPrepPlan(pasta, input(female, vegetarian)).offered).toBe(true);
  });

  it('Wettkampf-Rezept im Plan → nicht angeboten', () => {
    const recipes = N3_RECIPES.map((r) =>
      r.id === 'spaghetti-tomatensauce' ? { ...r, categories: ['wettkampf' as const] } : r,
    );
    expect(
      applyMealPrepPlan(pasta, input(female, vegetarian, SUNDAY_BEFORE, recipes)).offered,
    ).toBe(false);
  });

  it('Zeitlimit werktags: Kochtag Sonntag zählt nicht, Kochtag Mittwoch (heute) schon', () => {
    const limited: MealPlanProfileInput = { ...vegetarian, maxPrepMinutesWeekday: 10 };
    // Spaghetti dauert 25 Minuten.
    expect(applyMealPrepPlan(pasta, input(female, limited)).offered).toBe(true);
    expect(applyMealPrepPlan(pasta, input(female, limited, WEDNESDAY)).offered).toBe(false);
    expect(
      applyMealPrepPlan(
        pasta,
        input(female, { ...vegetarian, maxPrepMinutesWeekday: 30 }, WEDNESDAY),
      ).offered,
    ).toBe(true);
  });

  it('frisch gekochte Tage an Werktagen halten das Zeitlimit ein (sonst nicht angeboten)', () => {
    const curry = DEMO_MEAL_PREP_PLANS.find((p) => p.id === 'demo-vegane-woche');
    if (curry === undefined) throw new Error('Plan fehlt');
    const quick = makeRecipe({
      id: 'tofu-paprika-frisch',
      title_de: 'Tofu mit Paprika frisch',
      description_de: 'Tofu mit Paprika, gut vorzubereiten, aber nicht einfrierbar.',
      meal_types: ['main'],
      training_tags: [],
      ingredients: [ing('tofu', 150, 'g'), ing('paprika', 1, 'piece')],
      steps_de: ['Tofu und Paprika anbraten.'],
      prep_minutes: 10,
      cook_minutes: 20,
      meal_prep: { suitable: true, fridge_days: 1, freezable: false },
      equipment_de: ['Pfanne'],
      declared_per_serving: { kcal: 300, protein_g: 25, carbs_g: 10, fat_g: 15 },
      declared_diet: 'vegan',
      declared_allergens: ['soy'],
    });
    const plan = { ...curry, recipe_ids: ['haferdrink-oats', quick.id, 'paprika-sticks'] };
    const recipes = [...N3_RECIPES, quick];
    // Ab Dienstag frisch (1 Tag Kühlschrank, nicht einfrierbar) – 30 Minuten an Werktagen.
    expect(
      applyMealPrepPlan(
        plan,
        input(female, { ...vegan, maxPrepMinutesWeekday: 20 }, SUNDAY_BEFORE, recipes),
      ).offered,
    ).toBe(false);
    expect(
      applyMealPrepPlan(
        plan,
        input(female, { ...vegan, maxPrepMinutesWeekday: 30 }, SUNDAY_BEFORE, recipes),
      ).offered,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Einkaufsliste
// ---------------------------------------------------------------------------------------------------------

describe('Einkaufsliste speichern und auflösen (6.5)', () => {
  it('neue Liste = ganze Woche wie buildShoppingList; Rundweg über den Speicher → unverändert', () => {
    for (const mealsPerDay of [1, 4, 8]) {
      const data = input({ ...female, mealsPerDay });
      const plan = buildMealPlanWeek(data);
      const list = newShoppingList(plan, data);
      expect(list.items).toEqual(buildShoppingList(plan, N3_FOODS).items);
      expect(list.from).toBe(MONDAY);
      expect(list.to).toBe(SUNDAY);
      expect(list.usesHealthData).toBe(plan.usesHealthData);
      const parsed = parseStoredShoppingList(viaStorage(list));
      expect(parsed).toEqual(list);
      const result = resolveShoppingList(parsed, parseStoredPlan(plan), data);
      expect(result.action).toBe('stored');
    }
  });

  it('kein Plan-Schlüssel-Unterschied durch Schlüssel-Reihenfolge (Zod/JSON)', () => {
    const plan = buildMealPlanWeek(input(female));
    expect(mealPlanShoppingKey(parseStoredPlan(plan))).toBe(mealPlanShoppingKey(plan));
  });

  it('ungültige Speicherstände gelten als nicht vorhanden', () => {
    const data = input(female);
    const plan = buildMealPlanWeek(data);
    const list = viaStorage(
      addManualShoppingItem(newShoppingList(plan, data), { labelDe: 'Kaffee' }),
    ) as Record<string, unknown>;
    expect(parseStoredShoppingList(list)).not.toBeNull();
    expect(parseStoredShoppingList(null)).toBeNull();
    expect(parseStoredShoppingList({ ...list, extra: 1 })).toBeNull();
    expect(parseStoredShoppingList({ ...list, weekStart: '2026-10-13' })).toBeNull();
    expect(parseStoredShoppingList({ ...list, from: '2026-10-10' })).toBeNull();
    expect(parseStoredShoppingList({ ...list, to: '2026-10-19' })).toBeNull();
    expect(parseStoredShoppingList({ ...list, from: THURSDAY, to: WEDNESDAY })).toBeNull();
    expect(
      parseStoredShoppingList({ ...list, recipes: [{ recipeId: 'banane-pur', servings: 13 }] }),
    ).toBeNull();
    expect(
      parseStoredShoppingList({
        ...list,
        recipes: [
          { recipeId: 'banane-pur', servings: 1 },
          { recipeId: 'banane-pur', servings: 2 },
        ],
      }),
    ).toBeNull();
    const items = list.items as ShoppingListItem[];
    expect(parseStoredShoppingList({ ...list, items: [...items, items[0]] })).toBeNull();
    const manual = items.find((i) => i.isManual) as ShoppingListItem;
    expect(
      parseStoredShoppingList({ ...list, items: [{ ...manual, isManual: false }] }),
    ).toBeNull();
    expect(
      parseStoredShoppingList({ ...list, items: [{ ...manual, labelDe: 'x'.repeat(81) }] }),
    ).toBeNull();
  });

  it('veränderter Speicher (Menge, unterschobene offene Zutat) → neu erzeugt aus dem Plan, Häkchen bleiben', () => {
    const data = input(female, vegan);
    const plan = buildMealPlanWeek(data);
    const list = tickEverySecond(newShoppingList(plan, data));
    const first = list.items[0] as ShoppingListItem;
    const tampered: StoredShoppingList = {
      ...list,
      items: [
        { ...first, amount: (first.amount ?? 0) + 999 },
        ...list.items.slice(1),
        {
          ...first,
          itemKey: 'salami|g',
          foodId: 'salami',
          labelDe: 'Salami',
          checked: false,
        },
      ],
    };
    const result = resolveShoppingList(tampered, plan, data);
    expect(result.action).toBe('rebuilt');
    expect(byKey(result.list, 'salami|g')).toBeUndefined();
    expect(byKey(result.list, first.itemKey)?.amount).toBe(first.amount);
    expect(result.list.items.filter((i) => i.checked).map((i) => i.itemKey)).toEqual(
      list.items.filter((i) => i.checked).map((i) => i.itemKey),
    );
  });
});

/** Plan wie aus dem Gerätespeicher (Zod), damit Schlüssel-Reihenfolgen abweichen. */
function parseStoredPlan(plan: MealPlanWeek): MealPlanWeek {
  return JSON.parse(JSON.stringify(plan)) as MealPlanWeek;
}

describe('Neuerzeugung bei Neuplanung (R2-S4, W22 App-Logik)', () => {
  it('Schwangerschaft am Donnerstag: kein offener Eintrag mit Schwangerschafts-Risiko, Häkchen und eigene Einträge bleiben', () => {
    const before = input(female, omni);
    const plan = buildMealPlanWeek(before);
    let list = tickEverySecond(newShoppingList(plan, before));
    list = addManualShoppingItem(list, { labelDe: 'Spülmittel', category: 'other' });
    // Ein Rezept mit Schwangerschafts-Risiko über „Zur Einkaufsliste“.
    const added = addRecipeToShoppingList(
      list,
      { recipeId: 'brot-raeucherlachs', servings: 2 },
      plan,
      before,
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    list = setShoppingItemChecked(added.list, 'manual|spülmittel', true);
    const cautionBefore = list.items.filter((i) => caution(N3_FOODS.get(i.foodId ?? '')));
    expect(cautionBefore.length).toBeGreaterThan(0);

    const pregnant = input(pregnantFlags, omni, THURSDAY);
    const replanned = automaticReplan(plan, null, pregnant).plan;
    const result = resolveShoppingList(
      parseStoredShoppingList(viaStorage(list)),
      replanned,
      pregnant,
    );
    expect(result.action).toBe('rebuilt');
    if (result.action !== 'rebuilt') return;
    expect(result.planChanged).toBe(true);
    const next = result.list;
    expect(next.from).toBe(THURSDAY);
    expect(next.to).toBe(SUNDAY);
    expect(next.recipes).toEqual([]);
    expect(open(next).filter((i) => caution(N3_FOODS.get(i.foodId ?? '')))).toEqual([]);
    // Abgehakte, weggefallene Einträge bleiben mit „nicht mehr im Plan“; offene weggefallene sind weg.
    for (const item of list.items) {
      const now = byKey(next, item.itemKey);
      if (item.isManual) {
        expect(now).toEqual(item);
      } else if (now === undefined) {
        expect(item.checked).toBe(false);
      } else if (item.checked) {
        expect(now.checked).toBe(true);
      }
    }
    expect(next.items.some((i) => i.notInPlan && i.checked)).toBe(true);
    expect(next.items.every((i) => !i.notInPlan || i.checked)).toBe(true);
    // Beim nächsten Öffnen fallen abgehakte „nicht mehr im Plan“-Einträge weg, die jetzt ausgeschlossen sind
    // (Wächter N5b K1: sie stammen dann nur noch aus dem Gerätespeicher); danach bleibt die Liste (keine Schleife).
    const second = resolveShoppingList(next, replanned, pregnant);
    expect(
      second.list.items.filter((i) => i.notInPlan && caution(N3_FOODS.get(i.foodId ?? ''))),
    ).toEqual([]);
    expect(second.list.items.filter((i) => i.isManual)).toEqual(
      next.items.filter((i) => i.isManual),
    );
    expect(resolveShoppingList(second.list, replanned, pregnant).action).toBe('stored');
  });

  it('K1: abgehakter „nicht mehr im Plan“-Eintrag aus dem Speicher bleibt nur, wenn das Lebensmittel erlaubt ist', () => {
    const data = input(female, vegan);
    const plan = buildMealPlanWeek(data);
    const list = newShoppingList(plan, data);
    const template = list.items[0] as ShoppingListItem;
    const stale = (foodId: string): ShoppingListItem => ({
      ...template,
      itemKey: `${foodId}|g`,
      foodId,
      labelDe: foodId,
      checked: true,
      notInPlan: true,
    });
    const tampered: StoredShoppingList = {
      ...list,
      items: [...list.items, stale('hackfleisch-gemischt'), stale('reis'), stale('gibt-es-nicht')],
    };
    const result = resolveShoppingList(tampered, plan, data);
    expect(byKey(result.list, 'hackfleisch-gemischt|g')).toBeUndefined();
    expect(byKey(result.list, 'gibt-es-nicht|g')).toBeUndefined();
    if (!list.items.some((i) => i.itemKey === 'reis|g')) {
      expect(byKey(result.list, 'reis|g')).toMatchObject({ checked: true, notInPlan: true });
    }
  });

  it('vegan + neue Erdnuss-Unverträglichkeit: kein offener Erdnuss-Eintrag, hinzugefügtes Erdnuss-Rezept fällt weg', () => {
    const before = input(female, vegan);
    const plan = buildMealPlanWeek(before);
    const added = addRecipeToShoppingList(
      newShoppingList(plan, before),
      { recipeId: 'erdnuss-banane', servings: 3 },
      plan,
      before,
    );
    if (!added.ok) throw new Error('erwartet');
    expect(open(added.list).some((i) => peanut(N3_FOODS.get(i.foodId ?? '')))).toBe(true);
    const list = setShoppingItemChecked(added.list, 'banane|piece', true);
    const after = input(female, { ...vegan, intolerances: ['peanuts'] }, THURSDAY);
    const replanned = resolveMealPlanWeek(plan, after);
    expect(replanned.action).toBe('replanned');
    const result = resolveShoppingList(list, replanned.plan, after);
    expect(open(result.list).some((i) => peanut(N3_FOODS.get(i.foodId ?? '')))).toBe(false);
    expect(result.list.recipes).toEqual([]);
    expect(result.list.usesHealthData).toBe(true);
  });

  it('Tauschen/„Andere Vorschläge“ (Plan geändert) und vergangene Liste: Zeitraum bleibt, wenn heute nach dem Ende liegt', () => {
    const data = input(female);
    const plan = buildMealPlanWeek(data);
    const list = withShoppingListRange(
      newShoppingList(plan, data),
      { from: MONDAY, to: WEDNESDAY },
      plan,
      data,
    );
    const changed = buildMealPlanWeek({
      ...input(female, omni, THURSDAY),
      existingPlan: plan,
      variant: 1,
    });
    const result = resolveShoppingList(list, changed, input(female, omni, THURSDAY));
    expect(result.list.from).toBe(MONDAY);
    expect(result.list.to).toBe(WEDNESDAY);
    // Nächste Woche, heute davor: Beginn bleibt.
    const sameWeek = resolveShoppingList(list, changed, input(female, omni, SUNDAY_BEFORE));
    expect(sameWeek.list.from).toBe(MONDAY);
  });

  it('Liste einer anderen Woche gilt als nicht vorhanden', () => {
    const data = input(female);
    const plan = buildMealPlanWeek(data);
    const list = {
      ...newShoppingList(plan, data),
      weekStart: '2026-10-19',
      from: '2026-10-19',
      to: '2026-10-25',
    };
    expect(resolveShoppingList(list, plan, data).action).toBe('new');
  });
});

describe('Zeitraum (8.2 Nr. 5)', () => {
  it('Teil-Zeitraum: nur Einkäufe darin, Häkchen bleiben; außerhalb der Woche abgelehnt', () => {
    const data = input(female);
    const plan = buildMealPlanWeek(data);
    const whole = tickEverySecond(newShoppingList(plan, data));
    const part = withShoppingListRange(whole, { from: THURSDAY, to: SUNDAY }, plan, data);
    expect(part.items.filter((i) => !i.isManual).map((i) => ({ ...i, checked: false }))).toEqual(
      buildShoppingList(plan, N3_FOODS, { from: THURSDAY, to: SUNDAY }).items,
    );
    for (const item of part.items) {
      expect(item.checked).toBe(byKey(whole, item.itemKey)?.checked ?? false);
      expect(item.notInPlan).toBe(false);
    }
    const single = withShoppingListRange(whole, { from: SUNDAY, to: SUNDAY }, plan, data);
    expect(single.from).toBe(SUNDAY);
    expect(() =>
      withShoppingListRange(whole, { from: SUNDAY_BEFORE, to: SUNDAY }, plan, data),
    ).toThrow();
    expect(() =>
      withShoppingListRange(whole, { from: THURSDAY, to: WEDNESDAY }, plan, data),
    ).toThrow();
    expect(() =>
      withShoppingListRange(whole, { from: MONDAY, to: '2026-10-19' }, plan, data),
    ).toThrow();
    expect(shoppingListRangeValid(MONDAY, { from: MONDAY, to: SUNDAY })).toBe(true);
    expect(() => newShoppingList(plan, data, { from: SUNDAY_BEFORE, to: SUNDAY })).toThrow();
  });
});

describe('„Zur Einkaufsliste“ aus der Rezeptansicht (19.6)', () => {
  const data = input(female, vegetarian);
  const plan = buildMealPlanWeek(data);
  const base = newShoppingList(plan, data);

  it('1 und 12 Portionen; Mengen mit dem Plan zusammengezählt; erneut = neue Portionenzahl; entfernen', () => {
    const one = addRecipeToShoppingList(
      base,
      { recipeId: 'porridge-banane', servings: 1 },
      plan,
      data,
    );
    const twelve = addRecipeToShoppingList(
      base,
      { recipeId: 'porridge-banane', servings: 12 },
      plan,
      data,
    );
    if (!one.ok || !twelve.ok) throw new Error('erwartet');
    const oats = (l: StoredShoppingList) => byKey(l, 'haferflocken|g')?.amount ?? 0;
    expect(oats(one.list)).toBeGreaterThanOrEqual(oats(base));
    expect(oats(twelve.list)).toBeGreaterThan(oats(one.list));
    expect(one.list.recipes).toEqual([{ recipeId: 'porridge-banane', servings: 1 }]);
    const again = addRecipeToShoppingList(
      one.list,
      { recipeId: 'porridge-banane', servings: 12 },
      plan,
      data,
    );
    if (!again.ok) throw new Error('erwartet');
    expect(again.list.recipes).toEqual([{ recipeId: 'porridge-banane', servings: 12 }]);
    expect(oats(again.list)).toBe(oats(twelve.list));
    const removed = removeRecipeFromShoppingList(again.list, 'porridge-banane', plan, data);
    expect(removed.recipes).toEqual([]);
    expect(oats(removed)).toBe(oats(base));
    expect(() =>
      addRecipeToShoppingList(
        base,
        { recipeId: 'porridge-banane', servings: RECIPE_SERVINGS_PICKER.max + 1 },
        plan,
        data,
      ),
    ).toThrow();
    expect(() =>
      addRecipeToShoppingList(base, { recipeId: 'porridge-banane', servings: 0 }, plan, data),
    ).toThrow();
  });

  it('nur Rezepte, die den Filter der Person bestehen (ohne Grund); unbekannte; Höchstzahl', () => {
    expect(
      addRecipeToShoppingList(base, { recipeId: 'hack-spaghetti', servings: 2 }, plan, data),
    ).toEqual({
      ok: false,
      reason: 'not_for_you',
    });
    expect(
      addRecipeToShoppingList(base, { recipeId: 'gibt-es-nicht', servings: 2 }, plan, data),
    ).toEqual({
      ok: false,
      reason: 'not_found',
    });
    const pregnant = input(pregnantFlags, vegetarian);
    expect(
      addRecipeToShoppingList(
        base,
        { recipeId: 'mascarponecreme-roh', servings: 2 },
        plan,
        pregnant,
      ),
    ).toEqual({ ok: false, reason: 'not_for_you' });
    const full: StoredShoppingList = {
      ...base,
      recipes: Array.from({ length: SHOPPING_LIST_EXTRAS.recipesMax }, (_, i) => ({
        recipeId: `rezept-${i}`,
        servings: 1,
      })),
    };
    expect(
      addRecipeToShoppingList(full, { recipeId: 'banane-pur', servings: 1 }, plan, data),
    ).toEqual({
      ok: false,
      reason: 'too_many',
    });
  });

  it('Gesundheitsbezug: mit Unverträglichkeit gefiltertes Rezept → Liste ist Gesundheitsdatum', () => {
    const noConsent = input({ ...female, healthDataConsent: false }, vegetarian);
    const p = buildMealPlanWeek(noConsent);
    expect(p.usesHealthData).toBe(false);
    const plain = addRecipeToShoppingList(
      newShoppingList(p, noConsent),
      { recipeId: 'banane-pur', servings: 1 },
      p,
      noConsent,
    );
    if (!plain.ok) throw new Error('erwartet');
    expect(plain.list.usesHealthData).toBe(false);
    const withIntolerance = {
      ...noConsent,
      profile: { ...vegetarian, intolerances: ['peanuts' as const] },
    };
    const marked = addRecipeToShoppingList(
      newShoppingList(p, withIntolerance),
      { recipeId: 'banane-pur', servings: 1 },
      p,
      withIntolerance,
    );
    if (!marked.ok) throw new Error('erwartet');
    expect(marked.list.usesHealthData).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Meal-Prep-Kochtag
// ---------------------------------------------------------------------------------------------------------

describe('Meal-Prep-Kochtag (19.6): Übersicht, Auftau-Hinweise, Timer', () => {
  const pasta = DEMO_MEAL_PREP_PLANS.find((p) => p.id === 'demo-pasta-woche');
  if (pasta === undefined) throw new Error('Plan fehlt');

  it('Kochtag am Sonntag davor: Rezepte mit Kühlschrank-/Gefrier-Tagen, Haltbarkeit eingehalten', () => {
    const offer = applyMealPrepPlan(pasta, input(female, vegetarian));
    if (!offer.offered) throw new Error('erwartet');
    const overview = cookDayOverview(offer.plan, pasta);
    expect(overview).not.toBeNull();
    if (overview === null) return;
    expect(overview.cookDate).toBe(SUNDAY_BEFORE);
    expect(overview.steps.map((s) => s.startMin)).toEqual([0, 5, 10, 20, 30]);
    const spaghetti = overview.recipes.find((r) => r.recipeId === 'spaghetti-tomatensauce');
    expect(spaghetti).toBeDefined();
    expect(spaghetti?.mealDates).toHaveLength(5);
    expect(spaghetti?.freezeDates.length).toBeGreaterThan(0);
    for (const recipe of overview.recipes) {
      for (const date of recipe.fridgeDates) {
        expect(daysBetween(overview.cookDate, date)).toBeLessThanOrEqual(3);
      }
    }
    // Auftau-Hinweis am Vorabend des ersten Gefrier-Tages.
    const firstFreeze = spaghetti?.freezeDates[0] as string;
    const hints = thawHints(offer.plan, addDays(firstFreeze, -1));
    expect(hints.map((h) => h.recipeId)).toContain('spaghetti-tomatensauce');
    expect(hints.every((h) => h.forDate === firstFreeze)).toBe(true);
    expect(thawHints(offer.plan, SUNDAY)).toEqual([]);
  });

  it('Kochtag heute (Mittwoch): nur Mittwoch–Freitag; Plan ohne Meal-Prep-Plan → keine Übersicht', () => {
    const offer = applyMealPrepPlan(pasta, input(female, vegetarian, WEDNESDAY));
    if (!offer.offered) throw new Error('erwartet');
    const overview = cookDayOverview(offer.plan, pasta);
    expect(overview?.cookDate).toBe(WEDNESDAY);
    expect(cookDayOverview(buildMealPlanWeek(input(female, vegetarian)), pasta)).toBeNull();
    expect(cookDayOverview(offer.plan, { ...pasta, id: 'anderer-plan' })).toBeNull();
  });

  it('Samstag/Sonntag schlägt die nächste Woche vor, Montag–Freitag die laufende', () => {
    expect(defaultMealPrepWeekStart(MONDAY)).toBe(MONDAY);
    expect(defaultMealPrepWeekStart('2026-10-16')).toBe(MONDAY);
    expect(defaultMealPrepWeekStart('2026-10-17')).toBe('2026-10-19');
    expect(defaultMealPrepWeekStart(SUNDAY)).toBe('2026-10-19');
    expect(applyMealPrepPlan(pasta, input(female, vegetarian, '2026-10-17')).offered).toBe(false);
  });

  it('Timer aus Zeitstempeln: vor, genau an und nach den Schritt-Grenzen; Benachrichtigungen nur für spätere Schritte', () => {
    const steps = [
      { startMin: 2, textDe: 'A' },
      { startMin: 5, textDe: 'B' },
      { startMin: 30, textDe: 'C' },
    ];
    const t0 = Date.parse('2026-10-11T10:00:00Z');
    expect(cookDayProgress(steps, t0, t0)).toEqual({
      elapsedS: 0,
      currentIndex: -1,
      nextIndex: 0,
      secondsToNext: 120,
      allStarted: false,
    });
    expect(cookDayProgress(steps, t0, t0 + 120_000).currentIndex).toBe(0);
    expect(cookDayProgress(steps, t0, t0 + 299_999)).toMatchObject({
      currentIndex: 0,
      secondsToNext: 1,
    });
    expect(cookDayProgress(steps, t0, t0 + 300_000)).toMatchObject({
      currentIndex: 1,
      nextIndex: 2,
    });
    expect(cookDayProgress(steps, t0, t0 + 10 * 3_600_000)).toMatchObject({
      currentIndex: 2,
      nextIndex: null,
      secondsToNext: null,
      allStarted: true,
    });
    // Uhr zurückgestellt: nie negativ.
    expect(cookDayProgress(steps, t0, t0 - 60_000).elapsedS).toBe(0);
    expect(() => cookDayProgress(steps, -1, t0)).toThrow();
    expect(() => cookDayProgress(steps, t0, Number.NaN)).toThrow();
    expect(cookDayAlarms(steps, t0, t0 + 200_000).map((a) => a.index)).toEqual([1, 2]);
    expect(cookDayAlarms(steps, t0, t0 + 200_000)[0]?.atMs).toBe(t0 + 300_000);
    expect(cookDayAlarms(steps, t0, t0 + 3_600_000)).toEqual([]);
    expect(cookDayProgress([], t0, t0)).toMatchObject({
      currentIndex: -1,
      nextIndex: null,
      allStarted: true,
    });
  });
});

describe('Gerätespeicher mit kaputten Datumswerten wirft nie (Zod verfeinert nach Formatfehlern weiter)', () => {
  it('Liste und Plan mit weekStart „x“ → null statt Fehler', () => {
    const data = input(female);
    const plan = buildMealPlanWeek(data);
    const list = viaStorage(newShoppingList(plan, data)) as Record<string, unknown>;
    expect(parseStoredShoppingList({ ...list, weekStart: 'x' })).toBeNull();
    expect(parseStoredShoppingList({ ...list, from: 'gestern' })).toBeNull();
    expect(shoppingListRangeValid('x', { from: MONDAY, to: SUNDAY })).toBe(false);
    expect(parseStoredShoppingList({ ...list, items: [1, null, { itemKey: 5 }] })).toBeNull();
    expect(parseStoredShoppingList({ ...list, items: 'x', recipes: [null] })).toBeNull();
    expect(parseStoredShoppingList('x')).toBeNull();
    expect(parseStoredPlanSafe({ ...(viaStorage(plan) as object), weekStart: 'x' })).toBeNull();
  });
});
