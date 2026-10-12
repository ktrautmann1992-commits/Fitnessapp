import { describe, expect, it } from 'vitest';

import {
  checkMealPrepPlan,
  deriveStoragePlan,
  findDayMentions,
  recipesNamedIn,
  storageMethodFor,
} from './meal-prep-checks';
import { daysAfterCookDay, type MealPrepPlan, mealPrepPlanSchema } from './meal-prep-plan-schema';
import { makeRecipe, RECIPE_META } from './nutrition-fixtures';
import type { Recipe } from './recipe-schema';

const curry = makeRecipe({
  id: 'curry-mit-reis',
  title_de: 'Süßkartoffel-Curry mit Reis',
  meal_types: ['main'],
  meal_prep: { suitable: true, fridge_days: 1, freezable: true },
});
const oats = makeRecipe({
  id: 'baked-oats',
  title_de: 'Apfel-Zimt-Baked-Oats',
  meal_prep: { suitable: true, fridge_days: 3, freezable: false },
});
const sticks = makeRecipe({
  id: 'gemuesesticks',
  title_de: 'Gemüsesticks mit Dip',
  meal_types: ['snack'],
  meal_prep: { suitable: true, fridge_days: 2, freezable: false },
});

function lookup(...recipes: Recipe[]): Map<string, Recipe> {
  return new Map(recipes.map((r) => [r.id, r]));
}

function makePlan(overrides: Partial<MealPrepPlan> = {}): MealPrepPlan {
  const recipes = [curry, oats];
  return {
    id: 'vegan',
    version: 1,
    status: 'draft',
    title_de: 'Vegane Power-Woche',
    description_de: 'Ein Kochtag für Montag bis Freitag.',
    recipe_ids: recipes.map((r) => r.id),
    cook_steps: [
      { start_min: 0, text_de: 'Ofen vorheizen.' },
      { start_min: 15, text_de: 'Reis aufsetzen.' },
    ],
    storage_plan: deriveStoragePlan(recipes),
    storage_de: ['Alles abgedeckt in den Kühlschrank stellen.'],
    meta: { ...RECIPE_META, origin: 'manual', model: null },
    ...overrides,
  };
}

describe('Aufbewahrung nach R9 (S10)', () => {
  it('Kochtag Sonntag: Montag = 1 Tag, Freitag = 5 Tage', () => {
    expect(daysAfterCookDay('mon')).toBe(1);
    expect(daysAfterCookDay('fri')).toBe(5);
  });

  it('Kühlschrank bis zur Grenze, danach einfrieren bzw. frisch', () => {
    expect(storageMethodFor(curry, 1)).toBe('fridge');
    expect(storageMethodFor(curry, 2)).toBe('freeze');
    expect(storageMethodFor(oats, 3)).toBe('fridge');
    expect(storageMethodFor(oats, 4)).toBe('fresh');
    const notSuitable = makeRecipe({
      meal_prep: { suitable: false, fridge_days: 0, freezable: false },
    });
    expect(storageMethodFor(notSuitable, 1)).toBe('fresh');
  });

  it('hergeleiteter Plan deckt Mo–Fr je Rezept ab und besteht R20', () => {
    const plan = makePlan();
    expect(plan.storage_plan).toHaveLength(10);
    expect(plan.storage_plan.filter((e) => e.recipe_id === 'curry-mit-reis')).toEqual([
      { recipe_id: 'curry-mit-reis', weekday: 'mon', method: 'fridge' },
      { recipe_id: 'curry-mit-reis', weekday: 'tue', method: 'freeze' },
      { recipe_id: 'curry-mit-reis', weekday: 'wed', method: 'freeze' },
      { recipe_id: 'curry-mit-reis', weekday: 'thu', method: 'freeze' },
      { recipe_id: 'curry-mit-reis', weekday: 'fri', method: 'freeze' },
    ]);
    expect(mealPrepPlanSchema.safeParse(plan).success).toBe(true);
    expect(checkMealPrepPlan(plan, lookup(curry, oats))).toEqual([]);
  });
});

describe('R20 (rot)', () => {
  const rules = (plan: MealPrepPlan, recipes = lookup(curry, oats, sticks)) =>
    checkMealPrepPlan(plan, recipes).map((i) => `${i.rule}:${i.path ?? ''}`);

  it('Rezept fehlt oder ist nicht Meal-Prep-geeignet', () => {
    const notSuitable = makeRecipe({ id: 'porridge-banane' });
    const plan = makePlan({
      recipe_ids: ['curry-mit-reis', 'gibt-es-nicht', 'porridge-banane'],
      storage_plan: deriveStoragePlan([curry, notSuitable]),
    });
    const issues = rules(plan, lookup(curry, oats, notSuitable));
    expect(issues).toContain('R20:recipe_ids.1');
    expect(issues).toContain('R20:recipe_ids.2');
    // Für das fehlende Rezept fehlt auch die Aufbewahrung.
    expect(issues.filter((i) => i === 'R20:storage_plan')).toHaveLength(5);
  });

  it('freigegebener Plan nur mit freigegebenen Rezepten', () => {
    const plan = makePlan({
      status: 'published',
      meta: { ...RECIPE_META, reviewed_by: 'KT', reviewed_at: '2026-10-11' },
    });
    expect(rules(plan)).toEqual(['R20:recipe_ids.0', 'R20:recipe_ids.1']);
  });

  it('Startminuten fallen → rot; gleiche Minute erlaubt', () => {
    expect(
      rules(
        makePlan({
          cook_steps: [
            { start_min: 10, text_de: 'Schneiden.' },
            { start_min: 10, text_de: 'Kochen.' },
            { start_min: 5, text_de: 'Würzen.' },
          ],
        }),
      ),
    ).toEqual(['R20:cook_steps.2.start_min']);
  });

  it('Kühlschrank länger als R9, Einfrieren ohne „freezable“, doppelt, fremdes Rezept, Lücke', () => {
    const base = deriveStoragePlan([curry, oats]);
    const storage = base.map((e) =>
      e.recipe_id === 'curry-mit-reis' && e.weekday === 'wed'
        ? { ...e, method: 'fridge' as const }
        : e.recipe_id === 'baked-oats' && e.weekday === 'fri'
          ? { ...e, method: 'freeze' as const }
          : e,
    );
    const plan = makePlan({
      storage_plan: [
        ...storage.filter((e) => !(e.recipe_id === 'baked-oats' && e.weekday === 'thu')),
        { recipe_id: 'curry-mit-reis', weekday: 'mon', method: 'fridge' },
        { recipe_id: 'gemuesesticks', weekday: 'mon', method: 'fridge' },
      ],
    });
    const issues = checkMealPrepPlan(plan, lookup(curry, oats, sticks));
    const text = issues.map((i) => i.message).join('\n');
    expect(text).toMatch(/am Mittwoch aus dem Kühlschrank: 3 Tage nach dem Kochtag/);
    expect(text).toMatch(/„baked-oats“ ist nicht einfrierbar/);
    expect(text).toMatch(/„curry-mit-reis“ am Montag doppelt/);
    expect(text).toMatch(/„gemuesesticks“, das nicht im Plan ist/);
    expect(text).toMatch(/„baked-oats“ am Donnerstag fehlt/);
    expect(issues.every((i) => i.rule === 'R20' && i.severity === 'error')).toBe(true);
  });
});

describe('R20 Wortregel „N Tage“ (S10)', () => {
  it('findet einzelne Zahlen und Spannen', () => {
    expect(findDayMentions('hält 3–4 Tage, Riegel 5 Tage, Rest 1 Tag.')).toEqual([
      { match: '3–4 Tage', maxDays: 4 },
      { match: '5 Tage', maxDays: 5 },
      { match: '1 Tag', maxDays: 1 },
    ]);
    expect(findDayMentions('innerhalb von 2 Stunden bei max. 5 °C')).toEqual([]);
  });

  it('nennt den Text ein Rezept, gilt dessen Grenze', () => {
    expect(recipesNamedIn('Curry mit Reis hält 3–4 Tage.', [curry, oats]).map((r) => r.id)).toEqual(
      ['curry-mit-reis'],
    );
    expect(recipesNamedIn('Alles gut verschließen.', [curry, oats])).toEqual([]);
  });

  it('Grenze ist die kürzeste Haltbarkeit des Plans – auch wenn der Text ein länger haltbares Rezept nennt (K4)', () => {
    const plan = makePlan({
      storage_de: [
        'Curry mit Reis hält höchstens 3–4 Tage.',
        'Baked Oats halten 3 Tage.',
        'Alles 1 Tag.',
      ],
    });
    const issues = checkMealPrepPlan(plan, lookup(curry, oats));
    expect(issues.map((i) => [i.rule, i.path])).toEqual([
      ['R20', 'storage_de.0'],
      ['R20', 'storage_de.1'],
      ['R20H', 'storage_de.2'],
    ]);
    expect(issues[1]?.message).toContain('genannt: „baked-oats“');
  });

  it('ohne genanntes Rezept gilt die kürzeste Grenze des Plans (sichere Richtung)', () => {
    const plan = makePlan({
      cook_steps: [{ start_min: 0, text_de: 'Alles hält 2 Tage im Kühlschrank.' }],
    });
    const issues = checkMealPrepPlan(plan, lookup(curry, oats));
    expect(issues.map((i) => [i.rule, i.path])).toEqual([['R20', 'cook_steps.0.text_de']]);
  });
});

describe('Schema Meal-Prep-Plan (R1)', () => {
  it('Grenzen: 1–6 Rezepte, Startminute 0–240, Freigabe nur mit Prüfer', () => {
    expect(mealPrepPlanSchema.safeParse(makePlan({ recipe_ids: [] })).success).toBe(false);
    expect(
      mealPrepPlanSchema.safeParse(
        makePlan({ recipe_ids: ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff', 'ggg'] }),
      ).success,
    ).toBe(false);
    expect(
      mealPrepPlanSchema.safeParse(
        makePlan({ cook_steps: [{ start_min: 241, text_de: 'Zu spät.' }] }),
      ).success,
    ).toBe(false);
    expect(mealPrepPlanSchema.safeParse(makePlan({ status: 'published' })).success).toBe(false);
    expect(
      mealPrepPlanSchema.safeParse(
        makePlan({ meta: { ...RECIPE_META, import_hash: 'abc' } as MealPrepPlan['meta'] }),
      ).success,
    ).toBe(false);
  });
});
