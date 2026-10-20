import { describe, expect, it } from 'vitest';

import {
  CATALOG_CHECKLIST,
  CATALOG_RECIPES_KEYWORD,
  catalogReviewBlockerText,
  catalogReviewedFood,
  catalogSaltCheck,
  foodIdsInRecipeDrafts,
  planCatalogReview,
} from './catalog-review';
import type { Food } from './food-schema';
import { catalogFor, FIXTURE_FOODS, FIXTURE_RECIPES } from './nutrition-fixtures';
import type { Recipe } from './recipe-schema';
import { type NutritionContentFile, validateContent } from './validate';

const OPTIONS = { reviewer: 'KT', date: '2026-10-20' };

/** Lebensmittel im Entwurf ohne Katalog-Prüfung (Stand nach foods-import). */
const DRAFT_FOODS: Food[] = FIXTURE_FOODS.map((food) => ({
  ...food,
  status: 'draft',
  meta: { ...food.meta, catalog_reviewed_by: null, catalog_reviewed_at: null },
}));

function files(foods: readonly Food[], recipes: readonly Recipe[] = []): NutritionContentFile[] {
  return [
    ...foods.map((food) => ({ kind: 'food' as const, fileName: `${food.id}.json`, data: food })),
    ...recipes.map((r) => ({ kind: 'recipe' as const, fileName: `${r.id}.json`, data: r })),
  ];
}

function food(id: string, foods: readonly Food[] = DRAFT_FOODS): Food {
  const found = foods.find((f) => f.id === id);
  if (found === undefined) throw new Error(`Fixture ${id} fehlt`);
  return found;
}

describe('Katalog-Prüfung (R19, R2-K6)', () => {
  it('Checkliste enthält alle Punkte aus 5.1.1 (d)', () => {
    const text = CATALOG_CHECKLIST.join(' ');
    for (const word of [
      'Quell-ID',
      'Gruppen',
      'Tierart',
      'Schwangerschaft',
      'Ersatzprodukte',
      'Kühlschrank',
      'Salz',
      'Lesart',
    ]) {
      expect(text).toContain(word);
    }
    expect(CATALOG_RECIPES_KEYWORD).toBe('rezepte');
  });

  it('catalogReviewedFood setzt nur Katalog-Prüfung, Status und Prüfvermerk – alles andere bleibt', () => {
    const before = food('haferflocken');
    const after = catalogReviewedFood(before, OPTIONS);
    expect(after.status).toBe('published');
    expect(after.version).toBe(before.version);
    expect(after.meta.catalog_reviewed_by).toBe('KT');
    expect(after.meta.catalog_reviewed_at).toBe('2026-10-20');
    expect(after.meta.reviewed_by).toBe('KT');
    expect(after.meta.reviewed_at).toBe('2026-10-20');
    expect(after.meta.expert_reviewed).toBe(before.meta.expert_reviewed);
    expect({ ...after, status: before.status, meta: before.meta }).toEqual(before);
  });

  it('schon freigegeben: vorhandener Prüfvermerk bleibt, nur Katalog-Prüfung kommt dazu', () => {
    const published: Food = {
      ...food('haferflocken'),
      status: 'published',
      meta: { ...food('haferflocken').meta, reviewed_by: 'AB', reviewed_at: '2026-10-01' },
    };
    const after = catalogReviewedFood(published, OPTIONS);
    expect(after.meta.reviewed_by).toBe('AB');
    expect(after.meta.reviewed_at).toBe('2026-10-01');
    expect(after.meta.catalog_reviewed_by).toBe('KT');
  });

  it('Entwürfe ohne roten Befund → werden gesetzt, Ergebnis ist ohne roten Befund', () => {
    const plan = planCatalogReview(
      files(DRAFT_FOODS),
      catalogFor(DRAFT_FOODS),
      DRAFT_FOODS.map((f) => f.id),
      OPTIONS,
    );
    expect(plan.unknownIds).toEqual([]);
    expect(plan.decisions.every((d) => d.blockers.length === 0)).toBe(true);
    const after = validateContent(files(plan.decisions.map((d) => d.reviewed)), {
      nutritionCatalog: catalogFor(DRAFT_FOODS),
    });
    expect(after.issues.filter((i) => i.kind === 'food' && i.severity === 'error')).toEqual([]);
  });

  it('roter Befund (Nährwert ≠ Quelle, R17) → übersprungen mit Grund, die anderen werden gesetzt', () => {
    const catalog = catalogFor(DRAFT_FOODS);
    const broken = DRAFT_FOODS.map((f) =>
      f.id === 'haferflocken'
        ? {
            ...f,
            nutrients_per_100g: { ...f.nutrients_per_100g, kcal: f.nutrients_per_100g.kcal + 50 },
          }
        : f,
    );
    const plan = planCatalogReview(files(broken), catalog, ['haferflocken', 'banane'], OPTIONS);
    const oats = plan.decisions.find((d) => d.original.id === 'haferflocken')!;
    const banana = plan.decisions.find((d) => d.original.id === 'banane')!;
    expect(oats.blockers.map((b) => b.kind)).toEqual(['red_issues']);
    expect(oats.reviewed).toBe(oats.original);
    expect(catalogReviewBlockerText(oats.blockers[0]!)).toContain('R17');
    expect(banana.blockers).toEqual([]);
    expect(banana.reviewed.meta.catalog_reviewed_by).toBe('KT');
  });

  it('schon geprüft und freigegeben → nichts zu tun; zurückgezogen → bleibt; unbekannte ID gemeldet', () => {
    const foods = DRAFT_FOODS.map((f) =>
      f.id === 'banane'
        ? catalogReviewedFood(f, { reviewer: 'AB', date: '2026-10-01' })
        : f.id === 'haferflocken'
          ? { ...f, status: 'archived' as const }
          : f,
    );
    const plan = planCatalogReview(
      files(foods),
      catalogFor(foods),
      ['banane', 'haferflocken', 'gibt-es-nicht'],
      OPTIONS,
    );
    expect(plan.unknownIds).toEqual(['gibt-es-nicht']);
    expect(plan.decisions.map((d) => [d.original.id, d.blockers[0]?.kind])).toEqual([
      ['banane', 'already_reviewed'],
      ['haferflocken', 'archived'],
    ]);
    expect(catalogReviewBlockerText({ kind: 'already_reviewed' })).toContain('schon');
    expect(catalogReviewBlockerText({ kind: 'archived' })).toContain('zurückgezogen');
  });

  it('leere Auswahl → keine Entscheidungen', () => {
    const plan = planCatalogReview(files(DRAFT_FOODS), catalogFor(DRAFT_FOODS), [], OPTIONS);
    expect(plan.decisions).toEqual([]);
  });

  it('foodIdsInRecipeDrafts: Zutaten aller Rezept-Entwürfe plus Ersatzprodukte, ohne freigegebene Rezepte', () => {
    const [first, second] = FIXTURE_RECIPES;
    const draft: Recipe = { ...first!, status: 'draft' };
    const published: Recipe = { ...second!, status: 'published' };
    const result = validateContent(files(DRAFT_FOODS, [draft, published]), {
      nutritionCatalog: catalogFor(DRAFT_FOODS),
    });
    const ids = foodIdsInRecipeDrafts(result);
    const expected = new Set(draft.ingredients.map((i) => i.food_id));
    for (const id of [...expected]) {
      for (const s of food(id).substitutes) expected.add(s.food_id);
    }
    expect(ids).toEqual([...expected].filter((id) => DRAFT_FOODS.some((f) => f.id === id)).sort());
    const onlyPublished = published.ingredients
      .map((i) => i.food_id)
      .filter((id) => !expected.has(id));
    for (const id of onlyPublished) expect(ids).not.toContain(id);
  });

  it('foodIdsInRecipeDrafts: Ersatzprodukte transitiv (Banane → Vollmilch → laktosefrei/Haferdrink)', () => {
    const chain: Food[] = DRAFT_FOODS.map((f) =>
      f.id === 'banane'
        ? { ...f, substitutes: [{ food_id: 'vollmilch', for_groups: ['fructose'] }] }
        : f,
    );
    const recipe: Recipe = {
      ...FIXTURE_RECIPES[0]!,
      status: 'draft',
      ingredients: [{ ...FIXTURE_RECIPES[0]!.ingredients[0]!, food_id: 'banane' }],
    };
    const result = validateContent(files(chain, [recipe]), {});
    expect(foodIdsInRecipeDrafts(result)).toEqual(
      ['banane', 'haferdrink', 'milch-laktosefrei', 'vollmilch'].sort(),
    );
  });

  it('Salz-Hinweis nur bei verarbeiteter Ware (Wurst/Fleisch/Fisch/Tofu/Fertiggerichte)', () => {
    const base = food('haferflocken');
    expect(catalogSaltCheck(base)).toBe(false);
    expect(
      catalogSaltCheck({ source: { ...base.source, category: 'sausage_meat_products' } }),
    ).toBe(true);
    expect(catalogSaltCheck({ source: { ...base.source, category: 'meat_poultry' } })).toBe(true);
    expect(catalogSaltCheck({ source: { ...base.source, category: 'fruit' } })).toBe(false);
  });
});
