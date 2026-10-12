import { describe, expect, it } from 'vitest';

import { CONTENT_BUNDLE } from '../generated/content-files';
import { type NutritionBundle, nutritionLibraryFromBundle } from './local-backend';

const guide = {
  id: 'unterwegs',
  version: 1,
  status: 'draft',
  title_de: 'Unterwegs essen',
  sections: [{ heading_de: 'Grundregeln', body_de: ['Gemüse oder Salat dazu.'] }],
  meta: {
    origin: 'manual',
    model: null,
    batch_id: null,
    created_on: '2026-10-11',
    expert_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  },
};

const recipe = { id: 'test-rezept', status: 'draft' };

describe('Ernährungs-Bestand aus dem Bündel (W24, Bündel-Teil)', () => {
  it('Bündel hat Ernährungs-Inhalte und Katalog-Texte (heute leer, bis foods-import/alpha5-import gelaufen sind)', () => {
    expect(Array.isArray(CONTENT_BUNDLE.nutritionFiles)).toBe(true);
    expect(Array.isArray(CONTENT_BUNDLE.nutritionCatalog.extracts)).toBe(true);
    const library = nutritionLibraryFromBundle(CONTENT_BUNDLE);
    expect(library.recipes.length).toBeLessThanOrEqual(CONTENT_BUNDLE.nutritionFiles.length);
  });

  it('Ratgeber-Entwurf ohne roten Befund ist im Testmodus drin und gekennzeichnet', () => {
    const library = nutritionLibraryFromBundle({
      nutritionFiles: [{ kind: 'guide', fileName: 'unterwegs.json', data: guide }],
      nutritionCatalog: { extracts: [], expectations: null, exceptions: null },
    });
    expect(library.guides.map((g) => g.id)).toEqual(['unterwegs']);
    expect(library.containsDrafts).toBe(true);
  });

  it('Rezept mit fehlendem Lebensmittel bzw. ungültigem Schema → nicht im Bestand', () => {
    const library = nutritionLibraryFromBundle({
      nutritionFiles: [{ kind: 'recipe', fileName: 'test-rezept.json', data: recipe }],
      nutritionCatalog: { extracts: [], expectations: null, exceptions: null },
    });
    expect(library.recipes).toEqual([]);
  });

  it('Quelle außerhalb der Allowlist → Begleitdaten verworfen, Lebensmittel und Rezepte draußen (sichere Richtung)', () => {
    const library = nutritionLibraryFromBundle(
      bundle({ extracts: [{ db: 'fremd', version: '1', csv: EXTRACT }] }),
    );
    expect(library.guides).toHaveLength(1);
    expect(library.foods.size).toBe(0);
    expect(library.recipes).toEqual([]);
    expect(library.excluded).toContainEqual({
      kind: 'food',
      id: 'haferflocken',
      reason: 'red_issue',
    });
  });
});

// W24 über den echten Bündel-Pfad: Quellauszug im BLS-4.0-Format (Allowlist), Erwartungsliste, Lebensmittel, Rezept.
// ACHTUNG: TESTWERTE, keine BLS-Daten.
const HEADER = [
  'BLS-Schlüssel',
  'Bezeichnung',
  'ENERCC [kcal/100g]',
  'PROT625 [g/100g]',
  'CHO [g/100g]',
  'SUGAR [g/100g]',
  'FAT [g/100g]',
  'FASAT [g/100g]',
  'FIBT [g/100g]',
  'NACL [g/100g]',
].join(',');
const EXTRACT = `${HEADER}\nT0001,Haferflocken,370,13.5,58.7,0.7,7,1.2,10,0.01\n`;

const meta = guide.meta;
function food(reviewed: boolean) {
  return {
    id: 'haferflocken',
    version: 1,
    status: 'draft',
    name_de: 'Haferflocken',
    aliases_de: [],
    shopping_category: 'cereal_breakfast',
    pantry: true,
    nutrients_per_100g: {
      kcal: 370,
      protein_g: 13.5,
      carbs_g: 58.7,
      sugar_g: 0.7,
      fat_g: 7,
      sat_fat_g: 1.2,
      fiber_g: 10,
      salt_g: 0.01,
    },
    units: {},
    groups: ['gluten'],
    animal: [],
    meat_kind: [],
    pregnancy_caution: false,
    alcohol: false,
    max_fridge_days: 3,
    freezable: true,
    substitutes: [],
    source: {
      db: 'bls',
      version: '4.0',
      ref: 'T0001',
      name: 'Haferflocken',
      category: 'cereal_products',
      license: 'CC BY 4.0',
      retrieved_at: '2026-10-11',
    },
    meta: {
      ...meta,
      origin: 'claude_session',
      model: 'test',
      catalog_reviewed_by: reviewed ? 'KT' : null,
      catalog_reviewed_at: reviewed ? '2026-10-11' : null,
    },
  };
}

function oats(declaredAllergens: string[] = ['gluten']) {
  return {
    id: 'haferbrei',
    version: 1,
    status: 'draft',
    title_de: 'Haferbrei',
    description_de: 'Haferflocken mit Wasser, schnell gemacht.',
    meal_types: ['breakfast'],
    training_tags: [],
    servings: 1,
    ingredients: [
      { food_id: 'haferflocken', amount: 60, unit: 'g', optional: false, scales: true },
    ],
    steps_de: ['Haferflocken mit Wasser aufkochen.'],
    prep_minutes: 2,
    cook_minutes: 3,
    no_cook: false,
    meal_prep: { suitable: true, fridge_days: 3, freezable: true },
    equipment_de: ['Topf'],
    declared_per_serving: { kcal: 222, protein_g: 8.1, carbs_g: 35.2, fat_g: 4.2 },
    declared_diet: 'vegan',
    declared_allergens: declaredAllergens,
    contains_pork: false,
    declared_pregnancy_caution: false,
    meta,
  };
}

const plan = (recipeIds: string[]) => ({
  id: 'woche',
  version: 1,
  status: 'draft',
  title_de: 'Test-Woche',
  description_de: 'Ein Kochtag für die Woche.',
  recipe_ids: recipeIds,
  cook_steps: [{ start_min: 0, text_de: 'Hafer kochen.' }],
  storage_plan: recipeIds.flatMap((id) =>
    ['mon', 'tue', 'wed', 'thu', 'fri'].map((weekday, i) => ({
      recipe_id: id,
      weekday,
      method: i < 3 ? 'fridge' : 'freeze',
    })),
  ),
  storage_de: [],
  meta,
});

function bundle(
  options: {
    reviewed?: boolean;
    recipe?: unknown;
    planRecipes?: string[];
    extracts?: { db: string; version: string; csv: string | null }[];
  } = {},
): NutritionBundle {
  return {
    nutritionFiles: [
      { kind: 'food', fileName: 'haferflocken.json', data: food(options.reviewed ?? true) },
      { kind: 'recipe', fileName: 'haferbrei.json', data: options.recipe ?? oats() },
      {
        kind: 'meal_prep_plan',
        fileName: 'woche.json',
        data: plan(options.planRecipes ?? ['haferbrei']),
      },
      { kind: 'guide', fileName: 'unterwegs.json', data: guide },
    ],
    nutritionCatalog: {
      extracts: options.extracts ?? [{ db: 'bls', version: '4.0', csv: EXTRACT }],
      expectations: JSON.stringify({ haferflocken: ['gluten'] }),
      exceptions: null,
    },
  };
}

describe('W24 über nutritionLibraryFromBundle (Wächter N2c, S3)', () => {
  it('geprüftes Lebensmittel + Rezept-Entwurf ohne roten Befund → drin, gekennzeichnet; Plan mit allen Rezepten drin', () => {
    const library = nutritionLibraryFromBundle(bundle());
    expect([...library.foods.keys()]).toEqual(['haferflocken']);
    expect(library.recipes.map((r) => r.id)).toEqual(['haferbrei']);
    expect(library.mealPrepPlans.map((p) => p.id)).toEqual(['woche']);
    expect(library.containsDrafts).toBe(true);
  });

  it('Lebensmittel nicht katalog-geprüft → Lebensmittel und Rezept draußen', () => {
    const library = nutritionLibraryFromBundle(bundle({ reviewed: false }));
    expect(library.recipes).toEqual([]);
    expect(library.excluded).toContainEqual({
      kind: 'food',
      id: 'haferflocken',
      reason: 'not_catalog_reviewed',
    });
  });

  it('Rezept mit rotem Befund (R7: Allergen nicht deklariert) → draußen, Plan dann auch', () => {
    const library = nutritionLibraryFromBundle(bundle({ recipe: oats([]) }));
    expect(library.recipes).toEqual([]);
    expect(library.excluded).toContainEqual({
      kind: 'recipe',
      id: 'haferbrei',
      reason: 'red_issue',
    });
    expect(library.mealPrepPlans).toEqual([]);
  });

  it('Plan mit fehlendem Rezept → draußen', () => {
    const library = nutritionLibraryFromBundle(bundle({ planRecipes: ['haferbrei', 'fehlt'] }));
    expect(library.recipes.map((r) => r.id)).toEqual(['haferbrei']);
    expect(library.mealPrepPlans).toEqual([]);
  });
});
