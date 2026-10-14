/**
 * Etappe N9: Austausch-Tabelle – Schema (R1), Prüfregel R23/R23H, Textregeln R10, Auswahl für die App
 * (`selectNutritionContent`) und Freigabe per ID (`planNutritionRelease`, 19.7 N9).
 */
import { describe, expect, it } from 'vitest';

import { DEMO_SUBSTITUTIONS, demoNutritionContent } from '../demo-nutrition';
import type { Food } from './food-schema';
import {
  catalogFor,
  FIXTURE_FOODS,
  FOOD_META,
  foodLookup,
  makeFood,
  RECIPE_META,
} from './nutrition-fixtures';
import { selectNutritionContent } from './nutrition-select';
import { planNutritionRelease } from './recipe-release';
import { checkIngredientSubstitution, checkSubstitutionLibrary } from './substitution-checks';
import {
  type IngredientSubstitution,
  ingredientSubstitutionSchema,
  substitutionContentId,
} from './substitution-schema';
import { type NutritionContentFile, validateContent } from './validate';

function sub(overrides: Partial<IngredientSubstitution> = {}): IngredientSubstitution {
  return {
    id: substitutionContentId('tofu', 'haehnchenbrust'),
    version: 1,
    status: 'draft',
    food_id: 'tofu',
    substitute_food_id: 'haehnchenbrust',
    factor: 0.57,
    role: 'protein',
    note_de: 'Hähnchen gut durchgaren.',
    meta: { ...RECIPE_META },
    ...overrides,
  };
}

const foods = foodLookup();
const rules = (s: IngredientSubstitution, lookup: ReadonlyMap<string, Food> = foods) =>
  checkIngredientSubstitution(s, lookup).map((i) => `${i.rule}:${i.severity}`);
/** Nur rote Befunde (gelbe Hinweise R23H stehen zusätzlich, z. B. Tofu → Hähnchen). */
const red = (s: IngredientSubstitution, lookup: ReadonlyMap<string, Food> = foods) =>
  rules(s, lookup).filter((r) => r.endsWith(':error'));

describe('Schema (R1)', () => {
  it('gültiger Eintrag; Faktor 0,2–5; Ersatz ≠ Original; Hinweis 5–200 Zeichen', () => {
    expect(ingredientSubstitutionSchema.safeParse(sub()).success).toBe(true);
    expect(ingredientSubstitutionSchema.safeParse(sub({ factor: 0.2 })).success).toBe(true);
    expect(ingredientSubstitutionSchema.safeParse(sub({ factor: 5 })).success).toBe(true);
    expect(ingredientSubstitutionSchema.safeParse(sub({ factor: 0.19 })).success).toBe(false);
    expect(ingredientSubstitutionSchema.safeParse(sub({ factor: 5.01 })).success).toBe(false);
    expect(
      ingredientSubstitutionSchema.safeParse(sub({ substitute_food_id: 'tofu' })).success,
    ).toBe(false);
    expect(ingredientSubstitutionSchema.safeParse(sub({ note_de: 'kurz' })).success).toBe(false);
    expect(ingredientSubstitutionSchema.safeParse(sub({ note_de: 'x'.repeat(201) })).success).toBe(
      false,
    );
    expect(
      ingredientSubstitutionSchema.safeParse({ ...sub(), extra: true } as unknown).success,
    ).toBe(false);
  });

  it('feste ID je Paar, höchstens 80 Zeichen', () => {
    expect(substitutionContentId('tofu', 'haehnchenbrust')).toBe('tausch-tofu-zu-haehnchenbrust');
    const long = substitutionContentId('a'.repeat(41), 'b'.repeat(41));
    expect(long).toMatch(/^tausch-[0-9a-f]{16}$/);
    expect(substitutionContentId('a'.repeat(41), 'b'.repeat(41))).toBe(long);
    expect(substitutionContentId('b'.repeat(41), 'a'.repeat(41))).not.toBe(long);
  });
});

describe('R23 – Prüfregeln der Austausch-Tabelle', () => {
  it('Beispiel-Tabelle: kein roter Befund; gelb (R23H) bei Süße und bei Ersatz, der durchgegart werden muss (K5)', () => {
    const heat = ['huehnerei', 'haehnchenbrust', 'lachs', 'hackfleisch-gemischt'];
    for (const s of DEMO_SUBSTITUTIONS) {
      const found = rules(s);
      expect(found.filter((r) => r.endsWith(':error'))).toEqual([]);
      const needsHeatOnlyNow = heat.includes(s.substitute_food_id) && !heat.includes(s.food_id);
      expect(found.includes('R23H:warning')).toBe(s.role === 'sweet' || needsHeatOnlyNow);
    }
    expect(rules(sub())).toEqual(['R23H:warning']); // Tofu → Hähnchen: Durchgaren nennen
  });

  it('Lebensmittel fehlt, zurückgezogen, nicht katalog-geprüft, freigegeben mit Entwurf-Lebensmittel', () => {
    expect(rules(sub({ substitute_food_id: 'gibt-es-nicht' }))).toContain('R23:error');
    const archived = new Map(foods);
    archived.set('tofu', { ...(foods.get('tofu') as Food), status: 'archived' });
    expect(rules(sub(), archived)).toContain('R23:error');
    const unreviewed = new Map(foods);
    unreviewed.set('tofu', {
      ...(foods.get('tofu') as Food),
      meta: { ...FOOD_META, catalog_reviewed_by: null, catalog_reviewed_at: null },
    });
    expect(rules(sub(), unreviewed)).toContain('R23:error');
    // Freigegeben nur mit freigegebenen Lebensmitteln (die Fixtures sind Entwürfe).
    expect(
      rules(
        sub({
          status: 'published',
          meta: { ...RECIPE_META, reviewed_by: 'KT', reviewed_at: '2026-10-14' },
        }),
      ),
    ).toContain('R23:error');
  });

  it('Alkohol nie (R12)', () => {
    const withWine = new Map(foods);
    withWine.set('rotwein', makeFood({ id: 'rotwein', name_de: 'Rotwein', alcohol: true }));
    expect(rules(sub({ substitute_food_id: 'rotwein' }), withWine)).toContain('R23:error');
  });

  it('Messgröße der Rolle ±10 %: Eiweiß, Kohlenhydrate, Fett, Gemüse = Masse; Würze ohne Prüfung', () => {
    // Tofu 13 g, Hähnchen 23 g Eiweiß je 100 g → Faktor 0,565 genau.
    expect(red(sub({ factor: 0.51 }))).toEqual([]);
    expect(red(sub({ factor: 0.62 }))).toEqual([]);
    expect(red(sub({ factor: 0.5 }))).toContain('R23:error');
    expect(red(sub({ factor: 0.63 }))).toContain('R23:error');
    expect(
      red(sub({ food_id: 'reis', substitute_food_id: 'spaghetti', role: 'carb', factor: 1.1 })),
    ).toEqual([]);
    expect(
      red(sub({ food_id: 'reis', substitute_food_id: 'spaghetti', role: 'carb', factor: 1.3 })),
    ).toContain('R23:error');
    expect(
      red(
        sub({
          food_id: 'paprika',
          substitute_food_id: 'champignons',
          role: 'vegetable',
          factor: 1.1,
        }),
      ),
    ).toEqual([]);
    expect(
      red(
        sub({
          food_id: 'paprika',
          substitute_food_id: 'champignons',
          role: 'vegetable',
          factor: 1.2,
        }),
      ),
    ).toContain('R23:error');
    expect(
      red(
        sub({ food_id: 'olivenoel', substitute_food_id: 'erdnuesse', role: 'fat', factor: 2.04 }),
      ),
    ).toEqual([]);
    // Original ohne Eiweiß → Rolle passt nicht.
    expect(
      red(sub({ food_id: 'olivenoel', substitute_food_id: 'tofu', role: 'protein', factor: 1 })),
    ).toContain('R23:error');
    expect(
      red(sub({ food_id: 'salz', substitute_food_id: 'zucker', role: 'seasoning', factor: 5 })),
    ).toEqual([]);
  });

  it('Hinweis-Text: Marken und Heilversprechen rot (R10)', () => {
    expect(red(sub({ note_de: 'Stärkt das Immunsystem.' }))).toContain('R10:error');
    expect(red(sub({ note_de: 'Gut durchgaren und warm essen.' }))).toEqual([]);
  });

  it('dasselbe Paar nur einmal (zurückgezogene zählen nicht)', () => {
    const a = sub();
    const b = sub({ id: 'tausch-zweit', factor: 0.6 });
    expect(checkSubstitutionLibrary([a, b]).map((i) => i.id)).toEqual(['tausch-zweit']);
    expect(checkSubstitutionLibrary([a, { ...b, status: 'archived' }])).toEqual([]);
    expect(checkSubstitutionLibrary([a, { ...b, role: 'fat' }])).toEqual([]);
  });
});

function files(subs: readonly IngredientSubstitution[]): NutritionContentFile[] {
  return [
    ...FIXTURE_FOODS.map((food): NutritionContentFile => ({
      kind: 'food',
      fileName: `${food.id}.json`,
      data: food,
    })),
    ...subs.map((s): NutritionContentFile => ({
      kind: 'ingredient_substitution',
      fileName: `${s.id}.json`,
      data: s,
    })),
  ];
}

describe('validateContent, Auswahl und Freigabe', () => {
  it('validateContent: Schemafehler R1, Dateiname = ID, Ergebnis `substitutions`', () => {
    const result = validateContent(
      [
        ...files([sub()]),
        { kind: 'ingredient_substitution', fileName: 'kaputt.json', data: { id: 'kaputt' } },
        { kind: 'ingredient_substitution', fileName: 'falsch.json', data: sub({ id: 'richtig' }) },
      ],
      { nutritionCatalog: catalogFor() },
    );
    expect(result.substitutions.map((s) => s.id)).toEqual([sub().id, 'richtig']);
    expect(result.issues.some((i) => i.rule === 'R1' && i.kind === 'ingredient_substitution')).toBe(
      true,
    );
    expect(result.issues.some((i) => i.rule === 'DATEI' && i.id === 'richtig')).toBe(true);
  });

  it('Beispiel-Bestand: alle Austausch-Einträge ohne roten Befund und in der Auswahl', () => {
    const demo = demoNutritionContent();
    const result = validateContent(demo.files, { nutritionCatalog: demo.catalog });
    expect(
      result.issues.filter((i) => i.kind === 'ingredient_substitution' && i.severity === 'error'),
    ).toEqual([]);
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.substitutions.map((s) => s.id)).toEqual(
      [...DEMO_SUBSTITUTIONS.map((s) => s.id)].sort(),
    );
    // Live (nur freigegeben): Entwürfe nicht.
    expect(selectNutritionContent(result, { allowDrafts: false }).substitutions).toEqual([]);
  });

  it('Auswahl nur mit beiden Lebensmitteln; roter Befund schließt aus', () => {
    const withoutChicken = files([sub()]).filter((f) => f.fileName !== 'haehnchenbrust.json');
    const result = validateContent(withoutChicken, { nutritionCatalog: catalogFor() });
    const library = selectNutritionContent(result, { allowDrafts: true });
    expect(library.substitutions).toEqual([]);
    expect(library.excluded).toContainEqual(
      expect.objectContaining({ kind: 'ingredient_substitution', reason: 'red_issue' }),
    );
  });

  it('Freigabe per ID: nur ohne roten Befund danach (Lebensmittel noch Entwurf → übersprungen)', () => {
    const options = {
      reviewer: 'KT',
      date: '2026-10-14',
      expertReviewed: false,
      confirmAssumptions: false,
    };
    const draftFoods = planNutritionRelease(files([sub()]), catalogFor(), [sub().id], options);
    expect(draftFoods.decisions).toHaveLength(1);
    expect(draftFoods.decisions[0]?.kind).toBe('ingredient_substitution');
    expect(draftFoods.decisions[0]?.blockers).toContainEqual(
      expect.objectContaining({ kind: 'red_issues', rules: ['R23'] }),
    );
    const published = FIXTURE_FOODS.map((f) => ({
      ...f,
      status: 'published' as const,
      meta: { ...f.meta, reviewed_by: 'KT', reviewed_at: '2026-10-14' },
    }));
    const released = planNutritionRelease(
      [
        ...published.map((food): NutritionContentFile => ({
          kind: 'food',
          fileName: `${food.id}.json`,
          data: food,
        })),
        { kind: 'ingredient_substitution', fileName: `${sub().id}.json`, data: sub() },
      ],
      catalogFor(published),
      [sub().id],
      options,
    );
    expect(released.decisions[0]?.blockers).toEqual([]);
    expect(released.decisions[0]?.released).toMatchObject({
      status: 'published',
      meta: { reviewed_by: 'KT', reviewed_at: '2026-10-14' },
    });
  });
});
