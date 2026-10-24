/**
 * Kaufeinheiten (core `SHOPPING_BUY_UNITS`, docs/PLAN-EINKAUFEN-AUSDAUER.md 3): JEDES Lebensmittel in content/foods
 * (freigegeben und Entwurf) hat einen Eintrag, jede ID der Tabelle gibt es im Katalog. Ein neues Lebensmittel ohne
 * Kaufeinheit lässt CI scheitern – sonst stünde es als „1 Packung …“ (Ersatz) auf der Liste.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { SHOPPING_BUY_UNITS, SHOPPING_SAME_PRODUCT, shoppingPurchase } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';

const FOODS_DIR = join(REAL_REPO_ROOT, 'content', 'foods');

interface FoodFile {
  id: string;
  status: string;
  name_de: string;
  shopping_category: string;
  pantry: boolean;
}

const read = (id: string) =>
  JSON.parse(readFileSync(join(FOODS_DIR, `${id}.json`), 'utf8')) as FoodFile;

const catalogIds = readdirSync(FOODS_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'allergen-expectations.json')
  .map((f) => f.slice(0, -'.json'.length))
  .sort();

describe('Kaufeinheiten decken den ganzen Lebensmittel-Katalog ab', () => {
  it('Katalog ist nicht leer', () => {
    expect(catalogIds.length).toBeGreaterThan(150);
  });

  it.each(catalogIds)('%s hat eine Kaufeinheit (kein „1 Packung …“-Ersatz)', (id) => {
    expect(Object.hasOwn(SHOPPING_BUY_UNITS, id), `SHOPPING_BUY_UNITS.${id} fehlt`).toBe(true);
    const food = read(id);
    expect(food.id).toBe(id);
    const purchase = shoppingPurchase({
      foodId: id,
      labelDe: food.name_de,
      amount: 300,
      unit: 'g',
    });
    expect(purchase?.kind).not.toBe('fallback');
    // Nie „300 g …“ als das, was gekauft wird.
    expect(purchase?.text).not.toMatch(/^\d[\d.,]* ?(g|kg|ml|l) /u);
  });

  it.each(Object.keys(SHOPPING_BUY_UNITS))('%s gibt es im Katalog', (id) => {
    expect(existsSync(join(FOODS_DIR, `${id}.json`)), `content/foods/${id}.json fehlt`).toBe(true);
  });

  it('lose Stücke, Bund, Kopf, Knolle, Topf nur bei Obst/Gemüse bzw. Brot', () => {
    for (const [id, def] of Object.entries(SHOPPING_BUY_UNITS)) {
      if (def.kind !== 'loose' && def.kind !== 'piece') continue;
      expect(['fruit_vegetables', 'bread_bakery'], id).toContain(read(id).shopping_category);
    }
  });
});

describe('Gleiches Produkt im Laden (SHOPPING_SAME_PRODUCT) passt zum Katalog', () => {
  it.each(Object.entries(SHOPPING_SAME_PRODUCT))('%s → %s', (from, to) => {
    expect(existsSync(join(FOODS_DIR, `${from}.json`))).toBe(true);
    expect(existsSync(join(FOODS_DIR, `${to}.json`))).toBe(true);
    // Ein freigegebenes Lebensmittel wird nie auf einen Entwurf umgelenkt (der fehlt im Bestand der App).
    if (read(from).status === 'published') expect(read(to).status).toBe('published');
    expect(read(from).shopping_category).toBe(read(to).shopping_category);
    expect(SHOPPING_BUY_UNITS[from]).toEqual(SHOPPING_BUY_UNITS[to]);
  });

  it('keine Kette (Ziel ist selbst kein Synonym)', () => {
    for (const to of Object.values(SHOPPING_SAME_PRODUCT)) {
      expect(Object.hasOwn(SHOPPING_SAME_PRODUCT, to), to).toBe(false);
    }
  });
});
