import { describe, expect, it } from 'vitest';

import type { Food } from './food-schema';
import { selectNutritionContent } from './nutrition-select';
import {
  catalogFor,
  FIXTURE_FOODS,
  FIXTURE_RECIPES,
  FOOD_META,
  makeRecipe,
  RECIPE_META,
} from './nutrition-fixtures';
import type { Recipe } from './recipe-schema';
import { type NutritionContentFile, validateContent } from './validate';

const reviewedMeta = { reviewed_by: 'KT', reviewed_at: '2026-10-11' } as const;

function files(foods: readonly Food[], recipes: readonly Recipe[]): NutritionContentFile[] {
  return [
    ...foods.map((data): NutritionContentFile => ({
      kind: 'food',
      fileName: `${data.id}.json`,
      data,
    })),
    ...recipes.map((data): NutritionContentFile => ({
      kind: 'recipe',
      fileName: `${data.id}.json`,
      data,
    })),
  ];
}

function select(
  foods: readonly Food[],
  recipes: readonly Recipe[],
  allowDrafts: boolean,
  catalogFoods: readonly Food[] = foods,
) {
  const result = validateContent(files(foods, recipes), {
    nutritionCatalog: catalogFor(catalogFoods),
  });
  return selectNutritionContent(result, { allowDrafts });
}

const ids = (recipes: readonly { id: string }[]) => recipes.map((r) => r.id);

describe('selectNutritionContent (W24, R2-S6)', () => {
  it('geprüfter Entwurf ohne roten Befund → im Testmodus drin, gekennzeichnet', () => {
    const library = select(FIXTURE_FOODS, FIXTURE_RECIPES, true);
    expect(ids(library.recipes)).toEqual([...ids(FIXTURE_RECIPES)].sort());
    expect(library.foods.size).toBe(FIXTURE_FOODS.length);
    expect(library.containsDrafts).toBe(true);
    expect(library.excluded).toEqual([]);
  });

  it('allowDrafts: false → nur published (Entwürfe fallen mit Grund heraus)', () => {
    const library = select(FIXTURE_FOODS, FIXTURE_RECIPES, false);
    expect(library.recipes).toEqual([]);
    expect(library.foods.size).toBe(0);
    expect(library.containsDrafts).toBe(false);
    expect(library.excluded.every((e) => e.reason === 'draft_not_allowed')).toBe(true);
  });

  it('live: freigegebenes Rezept mit freigegebenen, geprüften Lebensmitteln → drin, ohne Entwurfs-Kennzeichnung', () => {
    const foods = FIXTURE_FOODS.map((f): Food => ({
      ...f,
      status: 'published',
      meta: { ...f.meta, ...reviewedMeta },
    }));
    const recipe = {
      ...FIXTURE_RECIPES[0],
      status: 'published',
      meta: { ...RECIPE_META, ...reviewedMeta },
    } as Recipe;
    const library = select(foods, [recipe], false);
    expect(ids(library.recipes)).toEqual([recipe.id]);
    expect(library.containsDrafts).toBe(false);
  });

  it('Entwurf mit nicht katalog-geprüftem Lebensmittel → nicht im Testmodus-Bestand', () => {
    const foods = FIXTURE_FOODS.map((f) =>
      f.id === 'banane'
        ? { ...f, meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null } }
        : f,
    );
    const library = select(foods, FIXTURE_RECIPES, true);
    expect(ids(library.recipes)).not.toContain('porridge-banane');
    expect(library.foods.has('banane')).toBe(false);
    expect(library.excluded).toEqual(
      expect.arrayContaining([
        { kind: 'food', id: 'banane', reason: 'not_catalog_reviewed' },
        { kind: 'recipe', id: 'porridge-banane', reason: 'red_issue' },
      ]),
    );
  });

  it('Lebensmittel mit rotem Befund (z. B. Nährwert ≠ Quelle) → Lebensmittel und Rezepte damit fallen heraus', () => {
    const catalogFoods = FIXTURE_FOODS;
    const foods = FIXTURE_FOODS.map((f) =>
      f.id === 'zwiebel' ? { ...f, nutrients_per_100g: { ...f.nutrients_per_100g, kcal: 41 } } : f,
    );
    const library = select(foods, FIXTURE_RECIPES, true, catalogFoods);
    expect(library.foods.has('zwiebel')).toBe(false);
    expect(library.excluded).toEqual(
      expect.arrayContaining([
        { kind: 'food', id: 'zwiebel', reason: 'red_issue' },
        {
          kind: 'recipe',
          id: 'spaghetti-tomatensauce',
          reason: 'food_unavailable',
          foodIds: ['zwiebel'],
        },
      ]),
    );
  });

  it('Entwurf mit rotem Befund → nicht drin; gelber Befund schadet nicht', () => {
    const red = makeRecipe({ id: 'porridge-falsch', declared_diet: 'vegan' });
    const library = select(FIXTURE_FOODS, [...FIXTURE_RECIPES, red], true);
    expect(ids(library.recipes)).not.toContain('porridge-falsch');
    expect(library.excluded).toContainEqual({
      kind: 'recipe',
      id: 'porridge-falsch',
      reason: 'red_issue',
    });
    // R16 (gelb) gibt es bei so wenigen Rezepten immer – trotzdem sind alle anderen drin.
    expect(library.recipes).toHaveLength(FIXTURE_RECIPES.length);
  });

  it('ohne Begleitdaten des Katalogs (Quellauszug, Erwartungsliste) ist nichts nutzbar', () => {
    const result = validateContent(files(FIXTURE_FOODS, FIXTURE_RECIPES));
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.recipes).toEqual([]);
    expect(library.foods.size).toBe(0);
  });

  it('archiviert und Probelauf nie; Reihenfolge nach ID', () => {
    const archived = { ...makeRecipe({ id: 'porridge-alt' }), status: 'archived' as const };
    const dryRun = makeRecipe({ id: 'probelauf-porridge' });
    const library = select(FIXTURE_FOODS, [dryRun, archived, ...FIXTURE_RECIPES], true);
    expect(ids(library.recipes)).not.toContain('porridge-alt');
    expect(ids(library.recipes)).not.toContain('probelauf-porridge');
    expect(library.excluded).toEqual(
      expect.arrayContaining([
        { kind: 'recipe', id: 'porridge-alt', reason: 'archived' },
        { kind: 'recipe', id: 'probelauf-porridge', reason: 'dry_run' },
      ]),
    );
    expect(ids(library.recipes)).toEqual([...ids(library.recipes)].sort());
  });
});
