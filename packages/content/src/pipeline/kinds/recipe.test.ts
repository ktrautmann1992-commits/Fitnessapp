/**
 * Inhaltsart „Rezept“ (docs/PLAN-PHASE-5.md N8): Matrix, Katalog-IDs, feste Matrix-Werte, Prompt-Regeln
 * (Health-Claims, Allergene, keine Heilversprechen), Antwort → Entwurf. Ohne Netz, mit dem Beispiel-Katalog.
 */
import {
  type Food,
  FOOD_GROUPS,
  HEALTH_CLAIM_TERMS,
  RECIPE_CHECK_LIMITS,
  recipeSchema,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { loadLibrary } from '../files';
import { toOutputJsonSchema } from '../json-schema';
import { buildBatchRequests } from '../requests';
import { matchesSelection, parseSelection } from '../selection';
import { REAL_REPO_ROOT } from '../test-helpers';
import { RECIPE_MAX_TOKENS, recipeKind, recipeOutputSchema, recipeRotationOffset } from './recipe';
import type { GenerationCell, LibraryContext } from './types';

const base = loadLibrary(REAL_REPO_ROOT);
const demoFoods = demoNutritionContent()
  .files.filter((file) => file.kind === 'food')
  .map((file) => file.data as Food);
const banane = demoFoods.find((food) => food.id === 'banane')!;
/** Beispiel-Katalog plus ein alkoholisches Lebensmittel (darf nie Zutat werden, R12). */
const context: LibraryContext = {
  ...base,
  foods: [...demoFoods, { ...banane, id: 'rotwein', name_de: 'Rotwein', alcohol: true }],
};
const meta = {
  origin: 'batch',
  model: 'gemini-3.8-flash',
  batch_id: 'batches/abc123',
  created_on: '2026-10-15',
  expert_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  review_note: null,
};

function cell(id: string): GenerationCell {
  return recipeKind.cells(context).find((c) => c.customId === id)!;
}

const validFixture = recipeKind.dryRunFixtures()[0]!;
const validData = (validFixture.response as { data: Record<string, unknown> }).data;

describe('Rezepte (Etappe N8): Matrix und Auswahl', () => {
  it('45 Zellen: Mahlzeit × Ernährungsform × Schwerpunkt, gültige custom_ids, nie übersprungen', () => {
    const cells = recipeKind.cells(context);
    expect(cells).toHaveLength(3 * 3 * 5);
    expect(new Set(cells.map((c) => c.customId)).size).toBe(45);
    for (const c of cells) {
      expect(c.customId).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
      expect(c.targetId).toBeNull();
      expect(recipeKind.isPresent(c, context)).toBe(false);
    }
    expect(recipeKind.maxTokens).toBe(RECIPE_MAX_TOKENS);
  });

  it('Reihenfolge abwechselnd und deterministisch rotiert nach vorhandenen KI-Rezepten (Wächter N8 H5)', () => {
    const first = recipeKind.cells({ ...context, recipes: [] });
    // Die ersten 9 Zellen decken jede Mahlzeit × Ernährungsform ab.
    expect(
      new Set(first.slice(0, 9).map((c) => `${c.values.mahlzeit}-${c.values.ernaehrung}`)).size,
    ).toBe(9);
    expect(recipeRotationOffset({ ...context, recipes: [] })).toBe(0);
    const recipe = demoNutritionContent().files.find((file) => file.kind === 'recipe')!
      .data as LibraryContext['recipes'][number];
    const batchRecipe = (id: string, extra: Partial<typeof recipe.meta> = {}) => ({
      ...recipe,
      id,
      meta: {
        ...recipe.meta,
        origin: 'batch' as const,
        model: 'gemini-3.8-flash',
        batch_id: 'batches/x',
        ...extra,
      },
    });
    const withThree = {
      ...context,
      recipes: [
        batchRecipe('a'),
        batchRecipe('b'),
        batchRecipe('c'),
        { ...batchRecipe('d'), status: 'archived' as const }, // zurückgezogen: zählt nicht
        batchRecipe('probelauf-x', { model: 'probelauf-ohne-ki' }), // Probelauf: zählt nicht
        recipe, // kein Batch-Rezept: zählt nicht
      ],
    };
    expect(recipeRotationOffset(withThree)).toBe(3);
    const rotated = recipeKind.cells(withThree);
    expect(rotated.map((c) => c.customId)).toEqual([
      ...first.slice(3).map((c) => c.customId),
      ...first.slice(0, 3).map((c) => c.customId),
    ]);
    // Deterministisch: gleicher Stand → gleiche Reihenfolge.
    expect(recipeKind.cells(withThree)).toEqual(rotated);
    expect(recipeKind.selectionNote?.(withThree)).toContain('Start bei Zelle 4 von 45');
  });

  it('Auswahl mit deutschen Aliasen', () => {
    const selection = parseSelection(recipeKind, 'fruehstueck vegan kalt');
    const cells = recipeKind.cells(context).filter((c) => matchesSelection(c, selection));
    expect(cells.map((c) => c.customId)).toEqual(['rz-breakfast-vegan-ohne_kochen']);
    expect(() => parseSelection(recipeKind, 'pizza')).toThrow(/„pizza“ ist unbekannt/);
  });

  it('ohne katalog-geprüfte Lebensmittel nicht möglich (R19) – mit Katalog schon', () => {
    expect(recipeKind.unavailableReason?.({ ...context, foods: [] })).toMatch(/katalog-geprüften/);
    expect(recipeKind.unavailableReason?.(context)).toBeNull();
  });
});

describe('Rezepte: Antwort-Schema', () => {
  it('Zutaten NUR aus dem Katalog, ohne Alkohol; feste Matrix-Werte im JSON-Schema', () => {
    const c = cell('rz-breakfast-vegan-ohne_kochen');
    const json = JSON.stringify(toOutputJsonSchema(recipeOutputSchema(c, context)));
    expect(json).toContain('"haferflocken"');
    expect(json).toContain('"banane"');
    expect(json).not.toContain('"rotwein"');
    expect(json).toContain('"declared_diet":{"type":"string","enum":["vegan"]}');
    expect(json).toContain('"no_cook":{"type":"boolean"}'); // boolesche Konstante: Zod prüft danach
    expect(json).toContain('"missing_foods_de"');
  });

  it('gültige Probelauf-Antwort passt; Mahlzeit, Schwerpunkt und Ernährungsform sind fest je custom_id', () => {
    const c = validFixture.cell;
    const schema = recipeOutputSchema(c, context);
    expect(schema.safeParse(validData).success).toBe(true);
    const wrongMeal = schema.safeParse({ ...validData, meal_types: ['snack'] });
    expect(wrongMeal.success).toBe(false);
    expect(JSON.stringify(wrongMeal.error?.issues)).toContain('breakfast');
    expect(schema.safeParse({ ...validData, no_cook: false }).success).toBe(false);
    expect(schema.safeParse({ ...validData, declared_diet: 'vegetarian' }).success).toBe(false);
    expect(
      schema.safeParse({
        ...validData,
        ingredients: [{ ...(validData.ingredients as object[])[0], food_id: 'rotwein' }],
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        ...validData,
        ingredients: [{ ...(validData.ingredients as object[])[0], heated: true }],
      }).success,
    ).toBe(false); // ohne Kochen: nichts erhitzt
  });

  it('Schwerpunkte „schnell“ (≤ 10 Minuten) und „nach dem Training“', () => {
    const quick = recipeOutputSchema(cell('rz-breakfast-vegan-schnell'), context);
    expect(quick.safeParse({ ...validData, prep_minutes: 5, cook_minutes: 0 }).success).toBe(true);
    expect(
      quick.safeParse({ ...validData, no_cook: false, prep_minutes: 8, cook_minutes: 5 }).success,
    ).toBe(false);
    const post = recipeOutputSchema(cell('rz-breakfast-vegan-nach_training'), context);
    expect(post.safeParse(validData).success).toBe(false);
    expect(post.safeParse({ ...validData, training_tags: ['nach_training'] }).success).toBe(true);
  });

  it('ohne Katalog (Probelauf in leerem Repository): nur ID-Format, Prüfung danach über R2', () => {
    const schema = recipeOutputSchema(validFixture.cell, { ...context, foods: [] });
    expect(schema.safeParse(validData).success).toBe(true);
  });
});

describe('Rezepte: Anfrage-Texte', () => {
  const system = recipeKind.systemPrompt(context);

  it('Health-Claims, keine Heilversprechen, keine Marken, kein Alkohol', () => {
    for (const term of HEALTH_CLAIM_TERMS) {
      expect(system).toContain(term.label);
    }
    expect(system).toContain('Keine Heilversprechen');
    expect(system).toContain('Health-Claims-Verordnung');
    expect(system).toContain('Keine Marken- oder Herstellernamen');
    expect(system).toContain('Kein Alkohol');
  });

  it('Allergene, Ernährungsform, Schwein, Schwangerschaft, Erhitzen, Meal-Prep, Mengen-Grenzen', () => {
    for (const group of FOOD_GROUPS) {
      expect(system).toContain(`${group.id} = ${group.nameDe}`);
    }
    expect(system).toContain('declared_allergens: ALLE Gruppen');
    expect(system).toContain('declared_pregnancy_caution');
    expect(system).toContain('contains_pork');
    expect(system).toContain('heated: true');
    expect(RECIPE_CHECK_LIMITS.perServing.saltMaxG).toBe(2.5);
    expect(system).toContain('Salz höchstens 2,5 g');
    expect(system).toContain('missing_foods_de');
  });

  it('Katalog mit Nährwerten, Einheiten und Eigenschaften – ohne Alkohol', () => {
    expect(system).toMatch(/- huehnerei: .*piece \(1 Stück = 60 g\).*tierisch: egg/);
    expect(system).toMatch(/- haehnchenbrust: .*Fleischart: poultry/);
    expect(system).not.toContain('rotwein');
  });

  it('Anfrage je Zelle: Mahlzeit, Ernährungsform, Schwerpunkt, vorhandene Rezepte', () => {
    const recipes = demoNutritionContent()
      .files.filter((file) => file.kind === 'recipe')
      .map((file) => file.data as LibraryContext['recipes'][number]);
    const user = recipeKind.userPrompt(cell('rz-breakfast-vegan-alltag'), { ...context, recipes });
    expect(user).toContain('Mahlzeit: breakfast');
    expect(user).toContain('Ernährungsform: vegan');
    expect(user).toContain('Schwerpunkt: Alltag');
    const veganBreakfast = recipes.filter(
      (r) => r.meal_types.includes('breakfast') && r.declared_diet === 'vegan',
    );
    expect(veganBreakfast.length).toBeGreaterThan(0);
    for (const recipe of veganBreakfast) {
      expect(user).toContain(recipe.id);
    }
  });

  it('Batch-Anfragen enthalten nur Inhalts-Prompts (keine Nutzerdaten-Felder)', () => {
    const requests = buildBatchRequests(
      recipeKind,
      recipeKind.cells(context).slice(0, 2),
      context,
      {
        model: 'gemini-3.8-flash',
        effort: 'high',
      },
    );
    for (const request of requests) {
      expect(Object.keys(request).sort()).toEqual([
        'customId',
        'effort',
        'maxOutputTokens',
        'responseJsonSchema',
        'systemInstruction',
        'userText',
      ]);
      expect(request.maxOutputTokens).toBe(RECIPE_MAX_TOKENS);
    }
  });
});

describe('Rezepte: Antwort → Entwurf', () => {
  it('Entwurf mit Version 1, Herkunft, Feldreihenfolge wie recipeSchema, gültig', () => {
    const output = recipeOutputSchema(validFixture.cell, context).parse(validData);
    const [file] = recipeKind.toContents(output, validFixture.cell, meta);
    expect(file!.id).toBe('probelauf-haferflocken-banane');
    expect(file!.content.status).toBe('draft');
    expect(file!.content.version).toBe(1);
    expect(file!.content).not.toHaveProperty('missing_foods_de');
    expect(Object.keys(file!.content)).toEqual(
      Object.keys(recipeSchema.shape).filter((key) => key in file!.content),
    );
    expect(recipeSchema.safeParse(file!.content).success).toBe(true);
    expect((file!.content.meta as Record<string, unknown>).review_note).toBeNull();
    const ingredient = (file!.content.ingredients as Record<string, unknown>[])[1]!;
    expect(Object.keys(ingredient)).toEqual([
      'food_id',
      'amount',
      'unit',
      'optional',
      'note_de',
      'scales',
      'heated',
      'role',
    ]);
  });

  it('fehlende Lebensmittel: nur als Prüfnotiz, nie als Zutat', () => {
    const output = recipeOutputSchema(validFixture.cell, context).parse({
      ...validData,
      missing_foods_de: ['Chiasamen', 'Mandelmus'],
    });
    const [file] = recipeKind.toContents(output, validFixture.cell, {
      ...meta,
      review_note: 'Probelauf – Beispiel ohne KI, nicht freigeben.',
    });
    expect((file!.content.meta as Record<string, unknown>).review_note).toBe(
      'Probelauf – Beispiel ohne KI, nicht freigeben. KI-Vorschlag fehlender Lebensmittel (nicht im Katalog, nicht verwendet): Chiasamen, Mandelmus.',
    );
    expect(JSON.stringify(file!.content.ingredients)).not.toContain('Chiasamen');
    expect(recipeSchema.safeParse(file!.content).success).toBe(true);
  });
});
