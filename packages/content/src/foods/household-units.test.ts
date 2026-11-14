/**
 * Freies Eintragen (14.11.2026, docs/PLAN-ESSEN-FREI-EINTRAGEN.md): Die Tabelle der Haushaltsmengen und Suchbegriffe
 * (core `food-household-table.ts`) passt zum echten Katalog in content/foods – jede ID darin gibt es (oder sie wartet
 * auf den Import), und die Suche findet mit dem echten Katalog, was die Gründer erwarten („Käse“ → alle Käse, „Brot“ →
 * alle Brote). Der Katalog selbst wird hier nur gelesen (geschützt, nur foods-import schreibt).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  BREAD_STEM_BY_FOOD,
  FOOD_KEYWORD_GROUPS,
  FOOD_STAND_INS,
  HOUSEHOLD_UNITS_BY_STAND_IN,
  type Food,
  HOUSEHOLD_UNITS_BY_FOOD,
  foodAmountOptions,
  householdUnitsFor,
  searchFoods,
  standInBase,
  withStandIns,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { REAL_REPO_ROOT } from '../pipeline/test-helpers';
import { loadImportMapping } from './foods-import';

const FOODS_DIR = join(REAL_REPO_ROOT, 'content', 'foods');
const foods = readdirSync(FOODS_DIR)
  .filter((f) => f.endsWith('.json') && f !== 'allergen-expectations.json')
  .map((f) => JSON.parse(readFileSync(join(FOODS_DIR, f), 'utf8')) as Food);
const catalogIds = new Set(foods.map((f) => f.id));
const pendingImport = new Set(loadImportMapping(REAL_REPO_ROOT).items.map((item) => item.food_id));
const search = (q: string) => searchFoods(foods, q, { minChars: 2, max: 40 }).map((f) => f.id);

describe('Haushaltsmengen-Tabelle passt zum Katalog', () => {
  it('jede ID der Tabelle gibt es im Katalog (oder sie wartet auf den Import)', () => {
    const standIns = new Set(FOOD_STAND_INS.map((x) => x.id));
    const ids = [
      ...Object.keys(HOUSEHOLD_UNITS_BY_FOOD),
      ...Object.keys(BREAD_STEM_BY_FOOD).filter((id) => !standIns.has(id)),
      ...FOOD_KEYWORD_GROUPS.flatMap((g) => [...(g.ids ?? []), ...(g.excludeIds ?? [])]),
    ];
    const unknown = ids.filter((id) => !catalogIds.has(id) && !pendingImport.has(id));
    expect(unknown).toEqual([]);
  });
  it('jede Art hat Mitglieder im Katalog', () => {
    for (const group of FOOD_KEYWORD_GROUPS) {
      const term = group.terms[0] ?? '';
      expect(search(term).length, group.id).toBeGreaterThan(0);
    }
  });
});

describe('Suche mit dem echten Katalog', () => {
  it('„Käse“ findet Gouda, Mozzarella, Feta, Parmesan – Leberkäse (Wurst) erst danach', () => {
    const hits = search('Käse');
    for (const id of [
      'gouda',
      'gouda-light-scheiben',
      'mozzarella',
      'feta',
      'parmesan',
      'harzer-kaese',
    ]) {
      expect(hits, id).toContain(id);
    }
    expect(hits.indexOf('leberkaese')).toBeGreaterThan(hits.indexOf('gouda'));
    expect(search('kase')).toEqual(hits);
  });
  it('„Brot“ findet Vollkornbrot, Toastbrot, Brötchen, Knäckebrot – nicht Paniermehl', () => {
    const hits = search('Brot');
    for (const id of ['vollkornbrot', 'toastbrot-weizen', 'weizenbroetchen', 'knaeckebrot']) {
      expect(hits, id).toContain(id);
    }
    expect(hits).not.toContain('paniermehl');
  });
  it('„Milch“ findet Milch 1,5 % und Sojadrink; „Gauda“ findet Gouda', () => {
    expect(search('Milch')).toEqual(expect.arrayContaining(['milch-1-5', 'sojadrink-ungesuesst']));
    expect(search('Gauda')).toContain('gouda');
  });
});

describe('Haushaltsmengen mit dem echten Katalog', () => {
  it('JEDES Lebensmittel im Katalog hat mindestens eine Haushaltsmenge (neue Lebensmittel rutschen nicht durch)', () => {
    const without = foods.filter((food) => householdUnitsFor(food).length === 0).map((f) => f.id);
    expect(without).toEqual([]);
  });
  it('Öl → EL, Getränke → Glas, Joghurt → Becher, Nüsse → Handvoll, Haferflocken → EL', () => {
    const first = (id: string) => unitsOf(id)[0];
    expect(first('olivenoel')).toBe('tbsp');
    expect(first('orangensaft')).toBe('glass');
    expect(first('joghurt-1-5')).toBe('cup');
    expect(first('mandeln')).toBe('handful');
    expect(first('haferflocken')).toBe('tbsp');
  });
  const unitsOf = (id: string) => {
    const food = foods.find((f) => f.id === id);
    if (!food) throw new Error(id);
    return householdUnitsFor(food).map((u) => u.unit);
  };
  it('Brot/Käse → Scheibe, Cornflakes → Handvoll, Milch → Glas, Banane → Stück', () => {
    expect(unitsOf('vollkornbrot')[0]).toBe('slice');
    expect(unitsOf('gouda')[0]).toBe('slice');
    expect(unitsOf('cornflakes-ungezuckert')[0]).toBe('handful');
    expect(unitsOf('milch-1-5')[0]).toBe('glass');
    expect(unitsOf('banane')[0]).toBe('piece');
  });
  it('jede Option eines Katalog-Lebensmittels liegt zwischen 0 und 2.000 g je Einheit', () => {
    for (const food of foods) {
      for (const option of foodAmountOptions(food)) {
        expect(option.grams, `${food.id} ${option.unit}`).toBeGreaterThan(0);
        expect(option.grams, `${food.id} ${option.unit}`).toBeLessThanOrEqual(2000);
      }
    }
  });
});

describe('Ersatz für fehlende Alltags-Lebensmittel (echter Katalog)', () => {
  const lookup = withStandIns(new Map(foods.map((f) => [f.id, f])));
  it('jeder Ersatz verweist auf ein Katalog-Lebensmittel; Haushaltsmengen nur für Ersatz-IDs', () => {
    for (const item of FOOD_STAND_INS) {
      expect(catalogIds.has(item.base) || pendingImport.has(item.base), item.id).toBe(true);
    }
    const standIns = new Set(FOOD_STAND_INS.map((x) => x.id));
    expect(Object.keys(HOUSEHOLD_UNITS_BY_STAND_IN).filter((id) => !standIns.has(id))).toEqual([]);
  });
  it('„Emmentaler“, „Mischbrot“, „Birne“ werden unter eigenem Namen gefunden (Werte vom Ersatz)', () => {
    const find = (q: string) =>
      searchFoods(lookup.values(), q, { minChars: 2, max: 40 }).map((f) => f.id);
    expect(find('Emmentaler')[0]).toBe('emmentaler');
    expect(find('Käse')).toContain('emmentaler');
    expect(find('Mischbrot')[0]).toBe('mischbrot');
    expect(find('Birne')[0]).toBe('birne');
    const emmentaler = lookup.get('emmentaler');
    expect(emmentaler && standInBase(emmentaler)?.id).toBe('gouda');
  });
});
