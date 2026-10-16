/**
 * Etappe N7 Teil 2, Wächter H1: `save_meal_plan` rechnet die Nährwerte jeder Plan-Mahlzeit selbst nach
 * (`private.meal_plan_item_nutrients`, Spiegel von `scalePortion`). Dieser Test rechnet die Fälle aus
 * `supabase/tests/33_n7_teil2_retention_kcal_check.test.sql` (Zeilen „-- core H1 <Fall>: …“) mit dem Core und
 * verlangt dieselben Werte – Core = SQL. Die Fixture hier und im pgTAP-Test sind gleich aufgebaut.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE } from '../constants';
import type { Food } from '../content/food-schema';
import { ing, makeFood, makeRecipe, RECIPE_META } from '../content/nutrition-fixtures';
import type { IngredientSubstitution } from '../content/substitution-schema';
import { scalePortion } from './scale';
import { resolveIngredientSwap } from './swap-resolve';

const SQL_TEST = join(
  import.meta.dirname,
  '../../../../supabase/tests/33_n7_teil2_retention_kcal_check.test.sql',
);

function food(
  id: string,
  [kcal, protein_g, carbs_g, fat_g]: [number, number, number, number],
  extra: Partial<Food> = {},
): Food {
  return makeFood({
    id,
    status: 'published',
    nutrients_per_100g: {
      kcal,
      protein_g,
      carbs_g,
      sugar_g: 0,
      fat_g,
      sat_fat_g: 0,
      fiber_g: 0,
      salt_g: 0,
    },
    units: {},
    groups: [],
    animal: [],
    ...extra,
  });
}

/** Gleiche Fixture wie im pgTAP-Test 33 (Abschnitt „H1“). */
const FOODS = new Map<string, Food>(
  [
    food('hafer', [370, 13.5, 58.7, 7], { units: { tbsp_g: 10 } }),
    food('milch', [64, 3.3, 4.8, 3.6], { units: { ml_to_g: 1.03 } }),
    food('haferdrink', [46, 0.4, 7.4, 1.4], { units: { ml_to_g: 1.02 } }),
    food('ei', [137, 12.6, 0.6, 9.3], {
      units: { piece_g: 58 },
      groups: ['eggs'],
      animal: ['egg'],
    }),
    food('salz', [0, 0, 0, 0]),
    food('nuss', [600, 25, 10, 50]),
    food('haehnchen', [105, 23.5, 0, 1.2], { animal: ['meat'] }),
    food('tofu', [124, 13.4, 1.4, 7.4]),
  ].map((f) => [f.id, f]),
);

const BOWL = makeRecipe({
  id: 'bowl',
  status: 'published',
  servings: 2,
  ingredients: [
    ing('hafer', 75, 'g'),
    ing('milch', 250, 'ml'),
    ing('ei', 1, 'piece'),
    ing('salz', 1, 'pinch', { scales: false }),
    ing('nuss', 15, 'g', { optional: true }),
    ing('haehnchen', 125, 'g', { role: 'protein', heated: true }),
    ing('hafer', 1, 'tbsp'),
  ],
});

function swapEntry(substitute: string, factor: number): IngredientSubstitution {
  return {
    id: `haehnchen-zu-${substitute}`,
    version: 1,
    status: 'published',
    food_id: 'haehnchen',
    substitute_food_id: substitute,
    factor,
    role: 'protein',
    note_de: 'Testeintrag für den Tausch.',
    meta: { ...RECIPE_META },
  };
}
const TABLE = [swapEntry('tofu', 1.1), swapEntry('ei', 0.8)];

interface Case {
  readonly factor: number;
  readonly omitted: readonly number[];
  readonly substitutions: readonly { index: number; substituteFoodId: string }[];
  readonly swapTo: string | null;
}

/** Die Fälle aus pgTAP 33 (gleiche Namen). */
const CASES: Record<string, Case> = {
  c1: { factor: 1.35, omitted: [], substitutions: [], swapTo: null },
  c2: {
    factor: 0.5,
    omitted: [4],
    substitutions: [{ index: 1, substituteFoodId: 'haferdrink' }],
    swapTo: 'tofu',
  },
  c3: { factor: 2, omitted: [], substitutions: [], swapTo: 'ei' },
  c4: { factor: 1, omitted: [], substitutions: [], swapTo: null },
  c5: { factor: 0.73, omitted: [4], substitutions: [], swapTo: null },
};

const round1 = (value: number) => Math.round(value * 10) / 10;

function coreValues(c: Case): [number, number, number, number] {
  const swaps =
    c.swapTo === null
      ? []
      : [
          resolveIngredientSwap(
            BOWL,
            { index: 5, foodId: 'haehnchen', substituteFoodId: c.swapTo },
            TABLE,
            FOODS,
          ),
        ];
  if (swaps.some((s) => s === null)) throw new Error('Tausch erwartet');
  const portion = scalePortion(
    {
      recipe: BOWL,
      omitted: c.omitted,
      substitutions: c.substitutions.map((s) => ({
        index: s.index,
        foodId: BOWL.ingredients[s.index]?.food_id ?? '',
        substituteFoodId: s.substituteFoodId,
      })),
      swaps: swaps.filter((s) => s !== null),
    },
    c.factor,
    FOODS,
  );
  const n = portion.nutrients;
  return [round1(n.kcal), round1(n.protein_g), round1(n.carbs_g), round1(n.fat_g)];
}

describe('Server-Nährwerte je Plan-Mahlzeit = scalePortion (Wächter N7 Teil 2 H1)', () => {
  it('pgTAP 33 erwartet für jeden Fall genau die Werte des Core', () => {
    const sql = readFileSync(SQL_TEST, 'utf8');
    const found = [...sql.matchAll(/-- core H1 (c\d+): \[([^\]]+)\]/g)];
    expect(found.map((m) => m[1]).sort()).toEqual(Object.keys(CASES).sort());
    for (const [, name, values] of found) {
      const expected = (values ?? '').split(',').map((v) => Number(v.trim()));
      expect(coreValues(CASES[name ?? ''] as Case), name).toEqual(expected);
    }
  });

  it('Spielraum nur für Rundungsreste der Payload (0,1-Schritte)', () => {
    expect(MEAL_PLAN_ITEM_NUTRIENT_TOLERANCE).toEqual({ kcal: 1, macroG: 0.1 });
  });

  it('Werte für die Fixture (Ausgabe zum Nachtragen in pgTAP)', () => {
    for (const [name, c] of Object.entries(CASES)) {
      // eslint-disable-next-line no-console
      if (process.env.PRINT_H1 === '1') console.log(name, JSON.stringify(coreValues(c)));
      expect(coreValues(c).every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
    }
  });
});
