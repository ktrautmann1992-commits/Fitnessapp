/** Einkaufs-Einheiten (core `SHOPPING_BUY_UNITS`): jede ID gibt es im Katalog, nur frisches Obst/Gemüse, kein Vorrat. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SHOPPING_BUY_UNITS, SHOPPING_SAME_PRODUCT } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';

describe('Einkaufs-Einheiten passen zum Lebensmittel-Katalog', () => {
  it.each(Object.keys(SHOPPING_BUY_UNITS))('%s', (id) => {
    const path = join(REAL_REPO_ROOT, 'content', 'foods', `${id}.json`);
    expect(existsSync(path), `content/foods/${id}.json fehlt`).toBe(true);
    const food = JSON.parse(readFileSync(path, 'utf8')) as {
      shopping_category: string;
      pantry: boolean;
    };
    expect(food.shopping_category).toBe('fruit_vegetables');
    expect(food.pantry).toBe(false);
  });
});

describe('Gleiches Produkt im Laden (SHOPPING_SAME_PRODUCT) passt zum Katalog', () => {
  const read = (id: string) =>
    JSON.parse(readFileSync(join(REAL_REPO_ROOT, 'content', 'foods', `${id}.json`), 'utf8')) as {
      shopping_category: string;
      status: string;
    };
  it.each(Object.entries(SHOPPING_SAME_PRODUCT))('%s → %s', (from, to) => {
    expect(existsSync(join(REAL_REPO_ROOT, 'content', 'foods', `${from}.json`))).toBe(true);
    expect(existsSync(join(REAL_REPO_ROOT, 'content', 'foods', `${to}.json`))).toBe(true);
    expect(read(to).status).toBe('published');
    expect(read(from).shopping_category).toBe(read(to).shopping_category);
  });
});
