import { describe, expect, it } from 'vitest';

import { hasUnconfirmedImportAssumptions, recipeMetaSchema } from './import-meta';
import { deriveStoragePlan } from './meal-prep-checks';
import type { MealPrepPlan } from './meal-prep-plan-schema';
import {
  catalogFor,
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  ing,
  makeRecipe,
  RECIPE_META,
} from './nutrition-fixtures';
import { selectNutritionContent } from './nutrition-select';
import { RECIPE_CATEGORIES, type Recipe, recipeSchema } from './recipe-schema';
import { type NutritionContentFile, validateContent } from './validate';

/**
 * Etappe N2c (docs/PLAN-PHASE-5.md 19.4): neue Rezeptfelder, Meal-Prep-Pläne und Ratgeber in `validateContent`
 * und `selectNutritionContent`.
 */

const HASH = 'a'.repeat(64);
const reviewed = { reviewed_by: 'KT', reviewed_at: '2026-10-11' } as const;

function importedRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return makeRecipe({
    section_de: 'Frühstück',
    categories: ['schnell', 'pre-workout'],
    total_minutes: 8,
    cost_estimate: { eur_per_serving: 1.17, as_of: '2026-10-11', basis: 'estimate' },
    meta: {
      ...RECIPE_META,
      origin: 'manual',
      model: null,
      source_file: 'alpha5-rezepte.json@1.0',
      import_hash: HASH,
      import_assumptions: [],
      import_assumptions_confirmed_by: null,
    },
    ...overrides,
  });
}

describe('Rezept-Schema: Erweiterungen 19.4', () => {
  it('importiertes Rezept mit allen neuen Feldern ist gültig', () => {
    const recipe = importedRecipe({
      ingredients: [
        ing('haferflocken', 60, 'g', { role: 'carb' }),
        ing('vollmilch', 250, 'ml', { role: 'protein' }),
      ],
    });
    expect(recipeSchema.safeParse(recipe).success).toBe(true);
    expect(RECIPE_CATEGORIES).toHaveLength(8);
  });

  it('Grenzen: Gesamtzeit 1–360, Vorbereitung + Kochzeit ≤ Gesamtzeit, Abschnitt ≤ 40 Zeichen', () => {
    expect(recipeSchema.safeParse(importedRecipe({ total_minutes: 0 })).success).toBe(false);
    expect(recipeSchema.safeParse(importedRecipe({ total_minutes: 361 })).success).toBe(false);
    expect(recipeSchema.safeParse(importedRecipe({ total_minutes: 7 })).success).toBe(false);
    expect(recipeSchema.safeParse(importedRecipe({ total_minutes: 360 })).success).toBe(true);
    expect(recipeSchema.safeParse(importedRecipe({ section_de: 'x'.repeat(41) })).success).toBe(
      false,
    );
  });

  it('Kategorien nur aus der Liste, ohne Doppel; Rolle nur aus der Liste', () => {
    const bad = { ...importedRecipe(), categories: ['vegan'] };
    expect(recipeSchema.safeParse(bad).success).toBe(false);
    expect(
      recipeSchema.safeParse(importedRecipe({ categories: ['schnell', 'schnell'] })).success,
    ).toBe(false);
    const badRole = importedRecipe();
    const parsed = recipeSchema.safeParse({
      ...badRole,
      ingredients: [{ ...badRole.ingredients[0], role: 'beilage' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('Kostenschätzung immer „estimate“ mit Stand', () => {
    const recipe = importedRecipe();
    expect(
      recipeSchema.safeParse({
        ...recipe,
        cost_estimate: { eur_per_serving: 1.2, as_of: '2026-10-11', basis: 'price' },
      }).success,
    ).toBe(false);
    expect(
      recipeSchema.safeParse({ ...recipe, cost_estimate: { eur_per_serving: 1.2 } }).success,
    ).toBe(false);
  });

  it('Import-Annahme „erhitzt“ passt zur Zutat; Freigabe nur mit bestätigten Annahmen', () => {
    const assumption = {
      ingredient_index: 0,
      food_id: 'haferflocken',
      field: 'heated' as const,
      value: true as const,
      reason_de: 'Schritt 1 erhitzt die Zutat („aufkochen“).',
    };
    const notHeated = importedRecipe({
      meta: { ...importedRecipe().meta, import_assumptions: [assumption] },
    });
    expect(recipeSchema.safeParse(notHeated).success).toBe(false);

    const heated = importedRecipe({
      ingredients: [ing('haferflocken', 60, 'g', { heated: true })],
      meta: { ...importedRecipe().meta, import_assumptions: [assumption] },
    });
    expect(recipeSchema.safeParse(heated).success).toBe(true);
    expect(hasUnconfirmedImportAssumptions(heated.meta)).toBe(true);

    const published = {
      ...heated,
      status: 'published' as const,
      meta: { ...heated.meta, ...reviewed },
    };
    expect(recipeSchema.safeParse(published).success).toBe(false);
    const confirmed = {
      ...published,
      meta: { ...published.meta, import_assumptions_confirmed_by: 'KT' },
    };
    expect(recipeSchema.safeParse(confirmed).success).toBe(true);
    expect(hasUnconfirmedImportAssumptions(confirmed.meta)).toBe(false);
  });

  it('Import-Annahme muss zu einer vorhandenen Zutat mit gleicher food_id passen (Wächter N2c, K1)', () => {
    const base = importedRecipe({ ingredients: [ing('haferflocken', 60, 'g', { heated: true })] });
    const assumption = {
      ingredient_index: 0,
      food_id: 'haferflocken',
      field: 'heated' as const,
      value: true as const,
      reason_de: 'Schritt 1 gart die Zutat durch.',
    };
    const withAssumption = (a: typeof assumption) => ({
      ...base,
      meta: { ...base.meta, import_assumptions: [a] },
    });
    expect(recipeSchema.safeParse(withAssumption(assumption)).success).toBe(true);
    expect(
      recipeSchema.safeParse(withAssumption({ ...assumption, ingredient_index: 5 })).success,
    ).toBe(false);
    expect(
      recipeSchema.safeParse(withAssumption({ ...assumption, food_id: 'vollmilch' })).success,
    ).toBe(false);
  });

  it('Meta: Prüfung der Basisfelder gilt weiter, Hash nur als SHA-256', () => {
    expect(
      recipeMetaSchema.safeParse({ ...importedRecipe().meta, reviewed_by: 'KT' }).success,
    ).toBe(false);
    expect(recipeMetaSchema.safeParse({ ...importedRecipe().meta, import_hash: 'x' }).success).toBe(
      false,
    );
    // Alte Rezepte ohne Import-Felder bleiben gültig.
    expect(recipeMetaSchema.safeParse(RECIPE_META).success).toBe(true);
  });
});

const mealPrep = FIXTURE_RECIPES.filter((r) => r.meal_prep.suitable);

function planFor(recipes: readonly Recipe[], overrides: Partial<MealPrepPlan> = {}): MealPrepPlan {
  return {
    id: 'woche-test',
    version: 1,
    status: 'draft',
    title_de: 'Test-Woche',
    description_de: 'Ein Kochtag für die ganze Woche.',
    recipe_ids: recipes.map((r) => r.id),
    cook_steps: [{ start_min: 0, text_de: 'Reis aufsetzen.' }],
    storage_plan: deriveStoragePlan(recipes),
    storage_de: [],
    meta: { ...RECIPE_META, origin: 'manual', model: null },
    ...overrides,
  };
}

function files(extra: NutritionContentFile[]): NutritionContentFile[] {
  return [
    ...FIXTURE_FOODS.map((data): NutritionContentFile => ({
      kind: 'food',
      fileName: `${data.id}.json`,
      data,
    })),
    ...FIXTURE_RECIPES.map((data): NutritionContentFile => ({
      kind: 'recipe',
      fileName: `${data.id}.json`,
      data,
    })),
    ...extra,
  ];
}

const guide = {
  id: 'unterwegs',
  version: 1,
  status: 'draft',
  title_de: 'Unterwegs essen',
  sections: [{ heading_de: 'Grundregeln', body_de: ['Gemüse oder Salat dazu.'] }],
  meta: { ...RECIPE_META, origin: 'manual', model: null },
};

describe('validateContent mit Meal-Prep-Plänen und Ratgebern', () => {
  it('gültige Dateien landen im Ergebnis, R20/R21 ohne Befund', () => {
    const plan = planFor(mealPrep);
    const result = validateContent(
      files([
        { kind: 'meal_prep_plan', fileName: 'woche-test.json', data: plan },
        { kind: 'guide', fileName: 'unterwegs.json', data: guide },
      ]),
      { nutritionCatalog: catalogFor() },
    );
    expect(result.mealPrepPlans.map((p) => p.id)).toEqual(['woche-test']);
    expect(result.guides.map((g) => g.id)).toEqual(['unterwegs']);
    expect(result.issues.filter((i) => i.kind === 'meal_prep_plan' || i.kind === 'guide')).toEqual(
      [],
    );
    expect(result.blocking).toEqual([]);
  });

  it('Schemafehler → R1 (blockiert auch bei Entwürfen); Dateiname ≠ ID → DATEI', () => {
    const result = validateContent([
      { kind: 'guide', fileName: 'unterwegs.json', data: { ...guide, sections: [] } },
      { kind: 'meal_prep_plan', fileName: 'falsch.json', data: planFor(mealPrep) },
    ]);
    expect(result.blocking.map((i) => [i.rule, i.kind])).toEqual([
      ['R1', 'guide'],
      ['DATEI', 'meal_prep_plan'],
    ]);
  });

  it('Versionsregel R15 auch für Pläne und Ratgeber', () => {
    const published = { ...guide, status: 'published', meta: { ...guide.meta, ...reviewed } };
    const changed = { ...published, title_de: 'Unterwegs gut essen' };
    const result = validateContent([
      { kind: 'guide', fileName: 'unterwegs.json', data: changed, previous: published },
    ]);
    expect(result.blocking.map((i) => i.rule)).toEqual(['R15']);
  });
});

describe('selectNutritionContent mit Plänen und Ratgebern (W24)', () => {
  it('Plan nur, wenn alle Rezepte ausgewählt sind; Ratgeber im Testmodus', () => {
    const ok = planFor(mealPrep);
    const missing = planFor(mealPrep, { id: 'woche-fehlt', recipe_ids: ['gibt-es-nicht'] });
    const result = validateContent(
      files([
        { kind: 'meal_prep_plan', fileName: 'woche-test.json', data: ok },
        { kind: 'meal_prep_plan', fileName: 'woche-fehlt.json', data: missing },
        { kind: 'guide', fileName: 'unterwegs.json', data: guide },
      ]),
      { nutritionCatalog: catalogFor() },
    );
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.mealPrepPlans.map((p) => p.id)).toEqual(['woche-test']);
    expect(library.guides.map((g) => g.id)).toEqual(['unterwegs']);
    // Der Plan mit unbekanntem Rezept hat einen roten Befund (R20) und fällt deshalb heraus.
    expect(library.excluded).toContainEqual({
      kind: 'meal_prep_plan',
      id: 'woche-fehlt',
      reason: 'red_issue',
    });
    expect(library.containsDrafts).toBe(true);
  });

  it('Rezept des Plans ausgeschlossen → Plan „recipe_unavailable“; live nur published', () => {
    const plan = planFor(mealPrep);
    const result = validateContent(
      files([{ kind: 'meal_prep_plan', fileName: 'woche-test.json', data: plan }]),
      // Ohne Katalog-Begleitdaten sind alle Lebensmittel rot → kein Rezept ausgewählt.
    );
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.mealPrepPlans).toEqual([]);
    expect(library.excluded).toContainEqual({
      kind: 'meal_prep_plan',
      id: 'woche-test',
      reason: 'recipe_unavailable',
      recipeIds: mealPrep.map((r) => r.id),
    });
    const live = selectNutritionContent(
      validateContent(files([{ kind: 'guide', fileName: 'unterwegs.json', data: guide }])),
      { allowDrafts: false },
    );
    expect(live.guides).toEqual([]);
    expect(live.excluded).toContainEqual({
      kind: 'guide',
      id: 'unterwegs',
      reason: 'draft_not_allowed',
    });
  });
});
