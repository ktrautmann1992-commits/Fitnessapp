/**
 * Etappe N11: Packungsgrößen – Schema mit Plausibilität 1–5.000 g (R1), Prüfregel R24, Auswahl für die App
 * (`selectNutritionContent`) und Freigabe per ID (`planNutritionRelease`, 19.7 N11).
 */
import { describe, expect, it } from 'vitest';

import { DEMO_PACKAGE_SIZES, demoNutritionContent } from '../demo-nutrition';
import type { Food } from './food-schema';
import {
  catalogFor,
  FIXTURE_FOODS,
  FOOD_META,
  foodLookup,
  RECIPE_META,
} from './nutrition-fixtures';
import { selectNutritionContent } from './nutrition-select';
import {
  checkPackageSize,
  checkPackageSizeLibrary,
  packageSizeLookup,
} from './package-size-checks';
import { type PackageSize, packageSizeContentId, packageSizeSchema } from './package-size-schema';
import { planNutritionRelease } from './recipe-release';
import { type NutritionContentFile, validateContent } from './validate';

function pack(overrides: Partial<PackageSize> = {}): PackageSize {
  const foodId = overrides.food_id ?? 'champignons';
  return {
    id: packageSizeContentId(foodId),
    version: 1,
    status: 'draft',
    food_id: foodId,
    package_size_g: 250,
    meta: { ...RECIPE_META },
    ...overrides,
  };
}

const foods = foodLookup();
const rules = (p: PackageSize, lookup: ReadonlyMap<string, Food> = foods) =>
  checkPackageSize(p, lookup).map((i) => `${i.rule}:${i.severity}`);

describe('Schema (R1): Plausibilität 1–5.000 g', () => {
  it('Grenzen 1 und 5.000 g gültig, 0, 5.001 g, Kommazahlen und fremde Felder ungültig', () => {
    expect(packageSizeSchema.safeParse(pack()).success).toBe(true);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: 1 })).success).toBe(true);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: 5000 })).success).toBe(true);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: 0 })).success).toBe(false);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: 5001 })).success).toBe(false);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: 250.5 })).success).toBe(false);
    expect(packageSizeSchema.safeParse(pack({ package_size_g: -5 })).success).toBe(false);
    expect(packageSizeSchema.safeParse({ ...pack(), extra: 1 } as unknown).success).toBe(false);
  });

  it('feste ID je Lebensmittel, höchstens 80 Zeichen', () => {
    expect(packageSizeContentId('champignons')).toBe('packung-champignons');
    const long = packageSizeContentId('a'.repeat(75));
    expect(long).toMatch(/^packung-[0-9a-f]{16}$/);
    expect(packageSizeContentId('a'.repeat(75))).toBe(long);
    expect(packageSizeContentId('b'.repeat(75))).not.toBe(long);
  });
});

describe('R24 – Prüfregeln der Packungsgrößen', () => {
  it('gültiger Entwurf ohne Befund', () => {
    expect(rules(pack())).toEqual([]);
  });

  it('Lebensmittel fehlt, zurückgezogen, nicht katalog-geprüft, freigegeben mit Entwurf-Lebensmittel', () => {
    expect(rules(pack({ food_id: 'gibt-es-nicht' }))).toEqual(['R24:error']);
    const archived = new Map(foods);
    archived.set('champignons', { ...(foods.get('champignons') as Food), status: 'archived' });
    expect(rules(pack(), archived)).toEqual(['R24:error']);
    const unreviewed = new Map(foods);
    unreviewed.set('champignons', {
      ...(foods.get('champignons') as Food),
      meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null },
    });
    expect(rules(pack(), unreviewed)).toEqual(['R24:error']);
    expect(
      rules(
        pack({
          status: 'published',
          meta: { ...RECIPE_META, reviewed_by: 'KT', reviewed_at: '2026-10-14' },
        }),
      ),
    ).toEqual(['R24:error']);
  });

  it('Packung kleiner als ein Stück → rot (Banane 120 g); gleich groß erlaubt', () => {
    expect(rules(pack({ food_id: 'banane', package_size_g: 119 }))).toEqual(['R24:error']);
    expect(rules(pack({ food_id: 'banane', package_size_g: 120 }))).toEqual([]);
    expect(rules(pack({ food_id: 'banane', package_size_g: 1000 }))).toEqual([]);
  });

  it('ID passt zum Lebensmittel (Wächter N11 H6): packung-tofu mit Reis → rot', () => {
    expect(rules(pack({ id: 'packung-tofu', food_id: 'reis', package_size_g: 500 }))).toEqual([
      'R24:error',
    ]);
    expect(rules(pack({ food_id: 'reis', package_size_g: 500 }))).toEqual([]);
    expect(
      checkPackageSize(pack({ id: 'packung-tofu', food_id: 'reis' }), foods)[0]?.message,
    ).toContain('packung-reis');
  });

  it('je Lebensmittel nur ein Eintrag (zurückgezogene zählen nicht)', () => {
    const a = pack();
    const b = pack({ id: 'packung-champignons-zwei', package_size_g: 500 });
    expect(checkPackageSizeLibrary([a, b]).map((i) => i.id)).toEqual(['packung-champignons-zwei']);
    expect(checkPackageSizeLibrary([a, { ...b, status: 'archived' }])).toEqual([]);
    expect(checkPackageSizeLibrary([a, pack({ food_id: 'zwiebel' })])).toEqual([]);
  });

  it('Nachschlagen je Lebensmittel: erster Eintrag nach ID', () => {
    const lookup = packageSizeLookup([
      pack({ id: 'packung-b', package_size_g: 500 }),
      pack({ id: 'packung-a', package_size_g: 250 }),
      pack({ food_id: 'zwiebel', package_size_g: 1000 }),
    ]);
    expect(lookup.get('champignons')).toBe(250);
    expect(lookup.get('zwiebel')).toBe(1000);
    expect(lookup.get('banane')).toBeUndefined();
  });
});

function files(entries: readonly PackageSize[], catalog: readonly Food[] = FIXTURE_FOODS) {
  return [
    ...catalog.map((food): NutritionContentFile => ({
      kind: 'food',
      fileName: `${food.id}.json`,
      data: food,
    })),
    ...entries.map((entry): NutritionContentFile => ({
      kind: 'package_size',
      fileName: `${entry.id}.json`,
      data: entry,
    })),
  ];
}

describe('validateContent, Auswahl und Freigabe', () => {
  it('validateContent: Schemafehler R1 (5.001 g), Dateiname = ID, Ergebnis `packageSizes`', () => {
    const result = validateContent(
      [
        ...files([pack()]),
        {
          kind: 'package_size',
          fileName: 'packung-zwiebel.json',
          data: pack({ food_id: 'zwiebel', package_size_g: 5001 }),
        },
        { kind: 'package_size', fileName: 'falsch.json', data: pack({ id: 'packung-richtig' }) },
      ],
      { nutritionCatalog: catalogFor() },
    );
    expect(result.packageSizes.map((p) => p.id)).toEqual([
      'packung-champignons',
      'packung-richtig',
    ]);
    expect(
      result.issues.some(
        (i) => i.rule === 'R1' && i.kind === 'package_size' && i.id === 'packung-zwiebel',
      ),
    ).toBe(true);
    expect(result.issues.some((i) => i.rule === 'DATEI' && i.id === 'packung-richtig')).toBe(true);
    // Zweiter Eintrag zu „champignons“ → R24.
    expect(
      result.issues.some(
        (i) => i.rule === 'R24' && i.id === 'packung-richtig' && i.severity === 'error',
      ),
    ).toBe(true);
  });

  it('Beispiel-Bestand: alle Packungsgrößen ohne roten Befund und in der Auswahl', () => {
    const demo = demoNutritionContent();
    const result = validateContent(demo.files, { nutritionCatalog: demo.catalog });
    expect(result.issues.filter((i) => i.kind === 'package_size')).toEqual([]);
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.packageSizes.map((p) => p.id)).toEqual(
      DEMO_PACKAGE_SIZES.map((p) => p.id).sort(),
    );
  });

  it('Auswahl: Entwurf im Testmodus, live nur freigegeben; nur mit ausgewähltem Lebensmittel', () => {
    const result = validateContent(files([pack()]), { nutritionCatalog: catalogFor() });
    expect(
      selectNutritionContent(result, { allowDrafts: true }).packageSizes.map((p) => p.id),
    ).toEqual(['packung-champignons']);
    expect(selectNutritionContent(result, { allowDrafts: false }).packageSizes).toEqual([]);
    const withoutFood = validateContent(
      files(
        [pack()],
        FIXTURE_FOODS.filter((f) => f.id !== 'champignons'),
      ),
      { nutritionCatalog: catalogFor(FIXTURE_FOODS.filter((f) => f.id !== 'champignons')) },
    );
    const library = selectNutritionContent(withoutFood, { allowDrafts: true });
    expect(library.packageSizes).toEqual([]);
    expect(library.excluded).toContainEqual(
      expect.objectContaining({ kind: 'package_size', reason: 'red_issue' }),
    );
  });

  it('Freigabe per ID: nur ohne roten Befund danach (Lebensmittel noch Entwurf → übersprungen)', () => {
    const options = {
      reviewer: 'KT',
      date: '2026-10-14',
      expertReviewed: false,
      confirmAssumptions: false,
    };
    const draftFoods = planNutritionRelease(files([pack()]), catalogFor(), [pack().id], options);
    expect(draftFoods.decisions).toHaveLength(1);
    expect(draftFoods.decisions[0]?.kind).toBe('package_size');
    expect(draftFoods.decisions[0]?.blockers).toContainEqual(
      expect.objectContaining({ kind: 'red_issues', rules: ['R24'] }),
    );
    const published = FIXTURE_FOODS.map((f) => ({
      ...f,
      status: 'published' as const,
      meta: { ...f.meta, reviewed_by: 'KT', reviewed_at: '2026-10-14' },
    }));
    const released = planNutritionRelease(
      files([pack()], published),
      catalogFor(published),
      [pack().id],
      options,
    );
    expect(released.decisions[0]?.blockers).toEqual([]);
    expect(released.decisions[0]?.released).toMatchObject({
      status: 'published',
      package_size_g: 250,
      meta: { reviewed_by: 'KT', reviewed_at: '2026-10-14' },
    });
    // Lebensmittel-ID ist keine Packungsgröße.
    expect(
      planNutritionRelease(files([pack()]), catalogFor(), ['champignons'], options).foodIds,
    ).toEqual(['champignons']);
  }, 30_000); // volle validateContent-Läufe; unter Last (turbo parallel) über 5 s (Wächter N11 B1)
});
