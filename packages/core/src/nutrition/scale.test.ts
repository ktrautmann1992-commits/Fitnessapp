import { describe, expect, it } from 'vitest';

import { ing, makeRecipe } from '../content/nutrition-fixtures';
import type { Recipe } from '../content/recipe-schema';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { balancePortions, scalePortion, scaleRecipeForServings } from './scale';
import { stableHash, stableHashKey, stableUnit } from './stable-hash';

function recipe(id: string): Recipe {
  return N3_RECIPES.find((r) => r.id === id) as Recipe;
}
const plain = (r: Recipe) => ({ recipe: r, omitted: [], substitutions: [] });

describe('scalePortion (6.2)', () => {
  it('Faktor 0,5–2,0; Grundrezept ÷ Portionen; scales: false bleibt; Nährwerte nach der Rundung', () => {
    const spaghetti = recipe('spaghetti-tomatensauce'); // 2 Portionen
    const one = scalePortion(plain(spaghetti), 1, N3_FOODS);
    expect(one.ingredients.find((i) => i.foodId === 'spaghetti')?.amount).toBe(100);
    // Salz: 1 Prise für 2 Portionen, skaliert nicht → ½ Prise → gerundet 1 (nie 0).
    expect(one.ingredients.find((i) => i.foodId === 'salz')?.amount).toBe(1);
    const double = scalePortion(plain(spaghetti), 2, N3_FOODS);
    expect(double.ingredients.find((i) => i.foodId === 'spaghetti')?.amount).toBe(200);
    expect(double.ingredients.find((i) => i.foodId === 'salz')?.amount).toBe(1);
    // kcal aus gerundeten Mengen: 200 g Spaghetti = 718 kcal.
    const spaghettiKcal = (200 * 359) / 100;
    expect(double.nutrients.kcal).toBeGreaterThan(spaghettiKcal);
    expect(() => scalePortion(plain(spaghetti), 0.49, N3_FOODS)).toThrow();
    expect(() => scalePortion(plain(spaghetti), 2.01, N3_FOODS)).toThrow();
  });

  it('Eier nur ganz, nie 0; optionale Zutaten ohne Nährwerte, weggelassene fehlen', () => {
    const omelett = recipe('omelett-champignons'); // 3 Eier
    expect(scalePortion(plain(omelett), 0.5, N3_FOODS).ingredients[0]?.amount).toBe(2);
    const tiny = makeRecipe({
      id: 'ein-ei',
      servings: 4,
      ingredients: [ing('huehnerei', 1, 'piece')],
    });
    expect(scalePortion(plain(tiny), 0.5, N3_FOODS).ingredients[0]?.amount).toBe(1);
    const porridge = recipe('porridge-banane');
    const withPeanuts = scalePortion(plain(porridge), 1, N3_FOODS);
    const without = scalePortion(
      { recipe: porridge, omitted: [4], substitutions: [] },
      1,
      N3_FOODS,
    );
    expect(withPeanuts.nutrients.kcal).toBe(without.nutrients.kcal);
    expect(without.ingredients.map((i) => i.foodId)).not.toContain('erdnuesse');
  });

  it('Ersatzprodukt mit Original-Hinweis', () => {
    const porridge = recipe('porridge-banane');
    const p = scalePortion(
      {
        recipe: porridge,
        omitted: [],
        substitutions: [{ index: 1, foodId: 'vollmilch', substituteFoodId: 'haferdrink' }],
      },
      1,
      N3_FOODS,
    );
    expect(p.ingredients[1]).toMatchObject({ foodId: 'haferdrink', originalFoodId: 'vollmilch' });
  });
});

describe('scaleRecipeForServings (19.6 Portionswähler)', () => {
  it('1 und 12 Portionen, 5-Portionen-Rezept, Eier ganz, Nährwerte je Portion nach der Rundung', () => {
    const five = makeRecipe({
      id: 'fuenf',
      servings: 5,
      ingredients: [
        ing('haferflocken', 250, 'g'),
        ing('huehnerei', 3, 'piece'),
        ing('salz', 1, 'pinch', { scales: false }),
      ],
    });
    const one = scaleRecipeForServings(five, 1, N3_FOODS);
    expect(one.ingredients.map((i) => i.amount)).toEqual([50, 1, 1]);
    const twelve = scaleRecipeForServings(five, 12, N3_FOODS);
    expect(twelve.ingredients.map((i) => i.amount)).toEqual([600, 7, 1]);
    expect(twelve.perServing.kcal).toBeCloseTo(twelve.total.kcal / 12, 6);
    expect(() => scaleRecipeForServings(five, 0, N3_FOODS)).toThrow();
    expect(() => scaleRecipeForServings(five, 13, N3_FOODS)).toThrow();
  });
});

describe('balancePortions (B1)', () => {
  const drafts = [
    { variant: plain(recipe('tofu-paprika')), baseFactor: 1 },
    { variant: plain(recipe('banane-pur')), baseFactor: 1 },
  ];

  it('trifft das Band (Zielpunkt Mitte) mit gerundeten Mengen', () => {
    const r = balancePortions(drafts, { min: 900, max: 1000 }, N3_FOODS);
    expect(r.status).toBe('in_band');
    expect(r.totalKcal).toBeGreaterThanOrEqual(900);
    expect(r.totalKcal).toBeLessThanOrEqual(1000);
  });

  it('unerreichbar: unten alle Faktoren 2,0 (below), oben alle 0,5 (above)', () => {
    const below = balancePortions(drafts, { min: 5000, max: 6000 }, N3_FOODS);
    expect(below.status).toBe('below');
    expect(below.portions.every((p) => p.factor === 2)).toBe(true);
    const above = balancePortions(drafts, { min: 100, max: 200 }, N3_FOODS);
    expect(above.status).toBe('above');
    expect(above.portions.every((p) => p.factor === 0.5)).toBe(true);
  });

  it('feste Portion bleibt fest', () => {
    const r = balancePortions(
      [
        { ...drafts[0], fixedFactor: 1.5 } as (typeof drafts)[number] & { fixedFactor: number },
        drafts[1] as (typeof drafts)[number],
      ],
      { min: 1100, max: 1300 },
      N3_FOODS,
    );
    expect(r.portions[0]?.factor).toBe(1.5);
  });

  it('schmales Band (20 kcal) wird trotz Rundungssprüngen getroffen oder ehrlich gemeldet', () => {
    for (let min = 700; min < 1400; min += 37) {
      const r = balancePortions(drafts, { min, max: min + 20 }, N3_FOODS);
      if (r.status === 'in_band') {
        expect(r.totalKcal).toBeGreaterThanOrEqual(min);
        expect(r.totalKcal).toBeLessThanOrEqual(min + 20);
      } else {
        // Nie still unter der Untergrenze als „im Band“.
        expect(r.status === 'above' ? r.totalKcal > min + 20 : r.totalKcal < min).toBe(true);
      }
    }
  });
});

describe('stableHash (FNV-1a)', () => {
  it('bekannte Werte, deterministisch, [0; 1)', () => {
    expect(stableHash('')).toBe(0x811c9dc5);
    expect(stableHash('a')).toBe(0xe40c292c);
    expect(stableHashKey('2026-10-12', 'lunch', 'tofu', 0)).toBe(
      stableHash('2026-10-12|lunch|tofu|0'),
    );
    const u = stableUnit('x');
    expect(u).toBeGreaterThanOrEqual(0);
    expect(u).toBeLessThan(1);
  });
});
