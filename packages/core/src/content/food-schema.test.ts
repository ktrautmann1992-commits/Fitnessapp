import { describe, expect, it } from 'vitest';

import {
  allergenExceptionsSchema,
  allergenExpectationsSchema,
  foodSchema,
  isCatalogReviewed,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABELS_DE,
  sourceRowKey,
} from './food-schema';
import { FIXTURE_FOODS, FOOD_META, makeFood } from './nutrition-fixtures';

const messages = (data: unknown) => {
  const parsed = foodSchema.safeParse(data);
  return parsed.success ? [] : parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('foodSchema (R1)', () => {
  it('alle Fixtures sind gültig', () => {
    for (const food of FIXTURE_FOODS) {
      expect(messages(food), food.id).toEqual([]);
    }
  });

  it('strikt: unbekannte Felder und fehlende Pflichtfelder sind Fehler', () => {
    expect(messages({ ...makeFood(), extra: 1 }).length).toBeGreaterThan(0);
    const withoutSource: Record<string, unknown> = { ...makeFood() };
    delete withoutSource.source;
    expect(messages(withoutSource).join()).toMatch(/source/);
  });

  it('Nährwerte: Grenzen, Zucker ≤ Kohlenhydrate, gesättigte ≤ Fett, Summe ≤ 100 g', () => {
    const base = makeFood().nutrients_per_100g;
    expect(messages(makeFood({ nutrients_per_100g: { ...base, kcal: 901 } })).length).toBe(1);
    expect(messages(makeFood({ nutrients_per_100g: { ...base, kcal: -1 } })).length).toBe(1);
    expect(messages(makeFood({ nutrients_per_100g: { ...base, sugar_g: 60 } })).join()).toMatch(
      /Zucker/,
    );
    expect(messages(makeFood({ nutrients_per_100g: { ...base, sat_fat_g: 8 } })).join()).toMatch(
      /Fettsäuren/,
    );
    expect(
      messages(makeFood({ nutrients_per_100g: { ...base, protein_g: 40, carbs_g: 60 } })).join(),
    ).toMatch(/mehr als 100 g/);
    // Grenzfall: Öl mit genau 100 g Fett, Salz mit 100 g Salz.
    expect(
      messages(
        makeFood({
          nutrients_per_100g: {
            kcal: 884,
            protein_g: 0,
            carbs_g: 0,
            sugar_g: 0,
            fat_g: 100,
            sat_fat_g: 14,
            fiber_g: 0,
            salt_g: 0,
          },
        }),
      ),
    ).toEqual([]);
  });

  it('Fleisch braucht eine Tierart, Tierart nur bei Fleisch', () => {
    expect(messages(makeFood({ animal: ['meat'], meat_kind: [] })).join()).toMatch(/Tierart/);
    expect(messages(makeFood({ animal: [], meat_kind: ['pork'] })).join()).toMatch(/meat_kind/);
    expect(messages(makeFood({ animal: ['meat'], meat_kind: ['unknown'] }))).toEqual([]);
  });

  it('Gelatine-Herkunft nur bei Gelatine; ohne Herkunft erlaubt (zählt als Schwein)', () => {
    expect(messages(makeFood({ gelatin_origin: 'beef' })).join()).toMatch(/gelatin_origin/);
    expect(messages(makeFood({ animal: ['gelatin'] }))).toEqual([]);
    expect(messages(makeFood({ animal: ['gelatin'], gelatin_origin: 'fish' }))).toEqual([]);
  });

  it('Haltbarkeit 0–3 Tage (S12), ganzzahlig', () => {
    expect(messages(makeFood({ max_fridge_days: 0 }))).toEqual([]);
    expect(messages(makeFood({ max_fridge_days: 4 })).length).toBe(1);
    expect(messages(makeFood({ max_fridge_days: 1.5 })).length).toBe(1);
  });

  it('Ersatzprodukte: nicht sich selbst, nicht doppelt, mindestens eine Gruppe', () => {
    expect(
      messages(makeFood({ substitutes: [{ food_id: 'haferflocken', for_groups: ['gluten'] }] })),
    ).toHaveLength(1);
    expect(
      messages(
        makeFood({
          substitutes: [
            { food_id: 'hirseflocken', for_groups: ['gluten'] },
            { food_id: 'hirseflocken', for_groups: ['gluten'] },
          ],
        }),
      ).join(),
    ).toMatch(/doppelt/);
    expect(
      messages(makeFood({ substitutes: [{ food_id: 'hirseflocken', for_groups: [] }] })),
    ).toHaveLength(1);
  });

  it('unbekannte Gruppe, unbekannte Quell-Kategorie oder Datenbank → Fehler', () => {
    expect(messages(makeFood({ groups: ['egg' as never] })).length).toBe(1);
    expect(
      messages(makeFood({ source: { ...makeFood().source, category: 'cereal' as never } })).length,
    ).toBe(1);
    expect(messages(makeFood({ source: { ...makeFood().source, db: 'ki' as never } })).length).toBe(
      1,
    );
  });

  it('Katalog-Prüfung: Prüfer und Datum nur gemeinsam; Basis-Regeln der Herkunft gelten weiter', () => {
    expect(
      messages(makeFood({ meta: { ...FOOD_META, catalog_reviewed_at: null } })).join(),
    ).toMatch(/Katalog-Prüfer/);
    expect(messages(makeFood({ meta: { ...FOOD_META, model: null } })).join()).toMatch(/Modell/);
  });

  it('freigegeben ohne Prüfer → Fehler', () => {
    expect(messages(makeFood({ status: 'published' })).join()).toMatch(/reviewed_by/);
    expect(
      messages(
        makeFood({
          status: 'published',
          meta: { ...FOOD_META, reviewed_by: 'KT', reviewed_at: '2026-10-11' },
        }),
      ),
    ).toEqual([]);
  });
});

describe('isCatalogReviewed / sourceRowKey', () => {
  it('nur mit Prüfer und Datum', () => {
    expect(isCatalogReviewed(makeFood())).toBe(true);
    expect(
      isCatalogReviewed(
        makeFood({ meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null } }),
      ),
    ).toBe(false);
  });
  it('Schlüssel aus Datenbank, Version und Quell-ID', () => {
    expect(sourceRowKey({ db: 'bls', version: '4.0', ref: 'C133000' })).toBe('bls|4.0|C133000');
  });
});

describe('Begleitdateien', () => {
  it('Erwartungsliste: Gruppen je food_id, nur bekannte Gruppen, keine Doppelten', () => {
    expect(allergenExpectationsSchema.safeParse({ haferflocken: ['gluten'] }).success).toBe(true);
    expect(allergenExpectationsSchema.safeParse({ haferflocken: ['hafer'] }).success).toBe(false);
    expect(
      allergenExpectationsSchema.safeParse({ haferflocken: ['gluten', 'gluten'] }).success,
    ).toBe(false);
    expect(allergenExpectationsSchema.safeParse({ 'Hafer Flocken': [] }).success).toBe(false);
  });
  it('Ausnahmeliste: Begründung und Quelle Pflicht, keine doppelten Einträge', () => {
    const entry = {
      food_id: 'haferflocken-glutenfrei',
      rule: 'gluten',
      reason: 'Als glutenfrei zertifizierte Haferflocken (< 20 mg/kg).',
      source: 'Herstellerangabe, geprüft am 11.10.2026',
    };
    expect(allergenExceptionsSchema.safeParse([entry]).success).toBe(true);
    expect(allergenExceptionsSchema.safeParse([{ ...entry, reason: 'kurz' }]).success).toBe(false);
    expect(allergenExceptionsSchema.safeParse([{ ...entry, source: '' }]).success).toBe(false);
    expect(allergenExceptionsSchema.safeParse([entry, entry]).success).toBe(false);
    expect(
      allergenExceptionsSchema.safeParse([{ ...entry, rule: 'pregnancy_caution' }]).success,
    ).toBe(true);
    expect(allergenExceptionsSchema.safeParse([{ ...entry, rule: 'egg' }]).success).toBe(false);
  });
});

describe('Supermarkt-Abteilungen (Plan 5.5)', () => {
  it('15 Abteilungen in fester Reihenfolge, jede mit deutschem Namen', () => {
    expect(SHOPPING_CATEGORIES).toHaveLength(15);
    expect(SHOPPING_CATEGORIES[0]).toBe('fruit_vegetables');
    expect(SHOPPING_CATEGORIES.at(-1)).toBe('other');
    expect(Object.keys(SHOPPING_CATEGORY_LABELS_DE)).toEqual([...SHOPPING_CATEGORIES]);
  });
});
