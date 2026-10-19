import {
  exerciseSchema,
  type Food,
  FORBIDDEN_MEDICAL_TERMS,
  ingredientSubstitutionSchema,
  PACKAGE_SIZE_LIMITS,
  packageSizeSchema,
  planTemplateSchema,
  recipeSchema,
  SUPPLEMENT_CONTENT_IDS,
  supplementContentSchema,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadLibrary } from './files';
import {
  findStructuredOutputProblems,
  stripUnsupportedKeywords,
  SUPPORTED_SCHEMA_KEYWORDS,
  toOutputJsonSchema,
} from './json-schema';
import { CONTENT_KINDS, findKind } from './kinds';
import { EXERCISE_MAX_TOKENS, exerciseKind } from './kinds/exercise';
import {
  ingredientSubstitutionKind,
  SUBSTITUTION_MAX_TOKENS,
} from './kinds/ingredient-substitution';
import { PACKAGE_SIZE_MAX_TOKENS, packageSizeKind } from './kinds/package-size';
import { PLAN_TEMPLATE_MAX_TOKENS, planTemplateKind, templateIdFor } from './kinds/plan-template';
import { recipeKind } from './kinds/recipe';
import { SUPPLEMENT_MAX_TOKENS, supplementKind } from './kinds/supplement';
import { buildBatchRequests } from './requests';
import { REAL_REPO_ROOT } from './test-helpers';

const context = loadLibrary(REAL_REPO_ROOT);
/** Kontext mit dem Beispiel-Katalog (Testwerte) – der echte Katalog entsteht erst mit `foods-import`. */
const nutritionContext = {
  ...context,
  foods: demoNutritionContent()
    .files.filter((file) => file.kind === 'food')
    .map((file) => file.data as Food),
};
const TRAINING_KINDS = [exerciseKind, planTemplateKind];

function allKeys(
  value: unknown,
  keys = new Set<string>(),
  parentIsProperties = false,
): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => allKeys(item, keys));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, sub] of Object.entries(value)) {
      if (!parentIsProperties) {
        keys.add(key);
      }
      allKeys(sub, keys, key === 'properties' && !parentIsProperties);
    }
  }
  return keys;
}

describe('JSON-Schema aus Zod', () => {
  it('behält nur von Gemini unterstützte Angaben, aber Feldnamen wie „pattern“', () => {
    const schema = z.strictObject({
      pattern: z.string().min(2).max(5).regex(/^a/),
      count: z.number().int().min(1).max(3).multipleOf(1),
      list: z.array(z.string()).min(1).max(4),
      kind: z.enum(['a', 'b']),
      fixed: z.literal(3),
      maybe: z.string().nullable(),
    });
    const result = toOutputJsonSchema(schema);
    const keys = allKeys(result);
    const supported = new Set<string>(SUPPORTED_SCHEMA_KEYWORDS);
    for (const key of keys) {
      expect(supported.has(key), key).toBe(true);
    }
    for (const removed of ['minLength', 'maxLength', 'pattern', 'multipleOf', 'const', '$schema']) {
      expect(keys.has(removed), removed).toBe(false);
    }
    const properties = result.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(properties)).toContain('pattern');
    expect(properties.pattern).toEqual({ type: 'string' });
    // Zahlen- und Listen-Grenzen versteht Gemini – sie bleiben (Zod prüft ohnehin danach).
    expect(properties.count).toMatchObject({ type: 'integer', minimum: 1, maximum: 3 });
    expect(properties.list).toMatchObject({ type: 'array', minItems: 1, maxItems: 4 });
    expect(properties.kind).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(properties.fixed).toEqual({ type: 'number', enum: [3] }); // const → enum
    expect(properties.maybe).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
    expect(result.additionalProperties).toBe(false);
    expect(result.required).toEqual(['pattern', 'count', 'list', 'kind', 'fixed', 'maybe']);
    expect(result.propertyOrdering).toEqual(['pattern', 'count', 'list', 'kind', 'fixed', 'maybe']);
  });

  it('entfernt nicht unterstützte String-Formate, behält unterstützte', () => {
    expect(stripUnsupportedKeywords({ type: 'string', format: 'regex' })).toEqual({
      type: 'string',
    });
    expect(stripUnsupportedKeywords({ type: 'string', format: 'date' })).toEqual({
      type: 'string',
      format: 'date',
    });
  });

  it('meldet nicht unterstützte Angaben und Typ-Listen; optionale Felder sind bei Gemini erlaubt', () => {
    expect(
      findStructuredOutputProblems({
        type: ['string', 'null'],
        pattern: '^a',
        enum: [true],
      }),
    ).toHaveLength(3);
    expect(
      findStructuredOutputProblems(toOutputJsonSchema(z.object({ a: z.string().optional() }))),
    ).toEqual([]);
    expect(() => toOutputJsonSchema(z.array(z.string()) as unknown as z.ZodType)).toThrow(
      /Wurzel muss ein Objekt/,
    );
    // Boolesche Konstante: kein enum (nur Texte/Zahlen) – Zod prüft den Wert danach.
    expect(stripUnsupportedKeywords({ type: 'boolean', const: true })).toEqual({ type: 'boolean' });
  });

  it('Antwort-Schemas aller Arten sind gültig, nutzen Katalog-IDs und feste Matrix-Werte', () => {
    for (const kind of Object.values(CONTENT_KINDS)) {
      const ctx =
        kind === ingredientSubstitutionKind || kind === packageSizeKind || kind === recipeKind
          ? nutritionContext
          : context;
      for (const cell of kind.cells(ctx).slice(0, 5)) {
        const schema = toOutputJsonSchema(kind.outputSchema(cell, ctx));
        expect(findStructuredOutputProblems(schema)).toEqual([]);
        const text = JSON.stringify(schema);
        expect(text).not.toContain('"minLength"');
        expect(text).not.toContain('"other"'); // „Sonstiges“ ist kein Gerät für Inhalte
      }
    }
    const templateCell = planTemplateKind.cells(context)[0]!;
    const templateSchema = JSON.stringify(
      toOutputJsonSchema(planTemplateKind.outputSchema(templateCell, context)),
    );
    expect(templateSchema).toContain('"enum":["muscle_gain"]');
    expect(templateSchema).toContain('"goblet-kniebeuge"');
    const exerciseCell = exerciseKind
      .cells(context)
      .find((cell) => cell.values.movement_pattern === 'squat')!;
    const exerciseJson = JSON.stringify(
      toOutputJsonSchema(exerciseKind.outputSchema(exerciseCell, context)),
    );
    expect(exerciseJson).toContain('"enum":["squat"]');
    // Alternativen nur mit gleichem Bewegungsmuster.
    expect(exerciseJson).toContain('"kniebeuge-langhantel"');
    expect(exerciseJson).not.toContain('"liegestuetz"');
  });
});

describe('Inhaltsarten', () => {
  it('findet Arten über Workflow-Eingabe und internen Namen', () => {
    expect(findKind('exercises')).toBe(exerciseKind);
    expect(findKind('plan_template')).toBe(planTemplateKind);
    expect(findKind('ingredient-substitutions')).toBe(ingredientSubstitutionKind);
    expect(findKind('package-sizes')).toBe(packageSizeKind);
    expect(findKind('package_size')).toBe(packageSizeKind);
    expect(findKind('recipes')).toBe(recipeKind);
    expect(findKind('recipe')).toBe(recipeKind);
    expect(findKind('supplements')).toBe(supplementKind);
    expect(findKind('supplement')).toBe(supplementKind);
    expect(() => findKind('rezepte-live')).toThrow(/Unbekannte Inhaltsart/);
  });

  it('max_tokens fest je Art (24.000 Vorlagen, 12.000 Übungen)', () => {
    expect(PLAN_TEMPLATE_MAX_TOKENS).toBe(24_000);
    expect(EXERCISE_MAX_TOKENS).toBe(12_000);
  });

  it('Matrix: 72 Vorlagen-Zellen (24 im Startbestand vorhanden), 120 Übungs-Zellen', () => {
    const templates = planTemplateKind.cells(context);
    expect(templates).toHaveLength(72);
    expect(templates.filter((cell) => planTemplateKind.isPresent(cell, context))).toHaveLength(24);
    expect(new Set(templates.map((cell) => cell.customId)).size).toBe(72);
    expect(exerciseKind.cells(context)).toHaveLength(120);
    for (const cell of [...templates, ...exerciseKind.cells(context)]) {
      expect(cell.customId).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    }
  });

  it('Vorlagen-IDs folgen dem Startbestand (45–60 min ohne Zusatz)', () => {
    expect(
      templateIdFor({
        goal: 'muscle_gain',
        level: 'beginner',
        days: 3,
        location: 'gym',
        duration: '45-60',
      }),
    ).toBe('muskelaufbau-einsteiger-3t-studio');
    expect(
      templateIdFor({
        goal: 'general_fitness',
        level: 'advanced',
        days: 4,
        location: 'home',
        duration: '30-45',
      }),
    ).toBe('fitness-fortgeschritten-4t-zuhause-30-45min');
  });

  it('Anfrage-Texte: deutsch, Textregeln, verbotene Begriffe, Katalog', () => {
    for (const kind of TRAINING_KINDS) {
      const system = kind.systemPrompt(context);
      expect(system).toContain('keine Behandlung');
      for (const term of FORBIDDEN_MEDICAL_TERMS) {
        expect(system).toContain(term.label);
      }
      expect(system).toContain('dumbbells: Kurzhanteln');
      expect(system).toContain('goblet-kniebeuge');
    }
    const cell = planTemplateKind
      .cells(context)
      .find((c) => c.customId === 'tpl-fat_loss-advanced-4-home-60-75')!;
    const user = planTemplateKind.userPrompt(cell, context);
    expect(user).toContain('Fettverlust');
    expect(user).toContain('60–75 Minuten');
    expect(user).toContain('Wochensätze je Muskelgruppe: 8–20');
  });

  it('Zuhause-Vorlagen erlauben nur Übungen mit Heim-Geräten', () => {
    const cell = planTemplateKind.cells(context).find((c) => c.values.location === 'home')!;
    const schema = planTemplateKind.outputSchema(cell, context);
    const json = JSON.stringify(toOutputJsonSchema(schema));
    expect(json).not.toContain('"kniebeuge-langhantel"'); // braucht power_rack
    expect(json).not.toContain('"latziehen"'); // Latzug-Maschine
    expect(json).toContain('"goblet-kniebeuge"');
  });

  it('Probelauf-Antworten: gültige passen zu Antwort- und Datei-Schema, die ungültige nur zum JSON-Format', () => {
    for (const kind of Object.values(CONTENT_KINDS)) {
      const ctx =
        kind === ingredientSubstitutionKind || kind === packageSizeKind || kind === recipeKind
          ? nutritionContext
          : context;
      const fixtures = kind.dryRunFixtures();
      expect(fixtures.some((f) => f.response.kind === 'refusal')).toBe(true);
      const json = fixtures.filter((f) => f.response.kind === 'json');
      const valid = json.filter(
        (f) =>
          kind.outputSchema(f.cell, ctx).safeParse((f.response as { data: unknown }).data).success,
      );
      expect(valid.length).toBeGreaterThanOrEqual(1);
      expect(json.length - valid.length).toBe(1); // genau eine absichtlich ungültige
      for (const fixture of valid) {
        const output = kind
          .outputSchema(fixture.cell, ctx)
          .parse((fixture.response as { data: unknown }).data);
        const contents = kind.toContents(output, fixture.cell, {
          origin: 'batch',
          model: 'probelauf-ohne-ki',
          batch_id: 'probelauf_x',
          created_on: '2026-10-03',
          expert_reviewed: false,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
        });
        expect(contents.length).toBeGreaterThanOrEqual(1);
        for (const { id, content } of contents) {
          expect(kind.contentSchema.safeParse(content).success).toBe(true);
          expect(ctx.takenIds[kind.kind].has(id)).toBe(false);
          // Feldreihenfolge wie in den Dateien.
          const schema =
            kind.kind === 'exercise'
              ? exerciseSchema
              : kind.kind === 'plan_template'
                ? planTemplateSchema
                : null;
          const keys =
            schema !== null
              ? Object.keys(schema.shape)
              : kind.kind === 'package_size'
                ? Object.keys(packageSizeSchema.shape)
                : kind.kind === 'recipe'
                  ? Object.keys(recipeSchema.shape).filter((key) => key in content)
                  : kind.kind === 'supplement'
                    ? Object.keys(supplementContentSchema.shape)
                    : Object.keys(ingredientSubstitutionSchema.shape);
          expect(Object.keys(content)).toEqual(keys);
        }
      }
    }
  });
});

describe('Supplemente (Phase 6 SU2)', () => {
  const META = {
    origin: 'batch',
    model: 'gemini-3.8-flash',
    batch_id: 'batch_x',
    created_on: '2026-10-19',
    expert_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  };

  it('eine Zelle je bekanntem Supplement; Startbestand ist vollständig vorhanden', () => {
    const cells = supplementKind.cells(context);
    expect(cells.map((cell) => cell.targetId)).toEqual([...SUPPLEMENT_CONTENT_IDS]);
    expect(cells.every((cell) => supplementKind.isPresent(cell, context))).toBe(true);
    expect(SUPPLEMENT_MAX_TOKENS).toBe(6_000);
    // Zurückgezogene zählen nicht als vorhanden.
    const archived = context.supplements.map((entry) => ({
      ...entry,
      status: 'archived' as const,
    }));
    expect(supplementKind.isPresent(cells[0]!, { ...context, supplements: archived })).toBe(false);
  });

  it('Antwort nur mit Texten; Stufe, Kategorie und Angaben kommen aus dem Core, Quellen leer', () => {
    const creatine = supplementKind.cells(context).find((c) => c.targetId === 'creatine')!;
    const bcaa = supplementKind.cells(context).find((c) => c.targetId === 'bcaa')!;
    const caffeine = supplementKind.cells(context).find((c) => c.targetId === 'caffeine')!;
    expect(
      Object.keys(toOutputJsonSchema(supplementKind.outputSchema(creatine, context))),
    ).toContain('properties');
    const [created] = supplementKind.toContents(
      {
        name_de: 'Kreatin',
        summary_de: 'Kreatin bildet dein Körper selbst.',
        how_to_de: 'Rühre {dose} ein.',
      },
      creatine,
      META,
    );
    expect(created!.content).toMatchObject({
      id: 'creatine',
      status: 'draft',
      evidence_level: 'a',
      category: 'sport',
      claim_ids: ['creatine_performance'],
      sources: [],
      not_recommended_reason_de: null,
    });
    const [notRecommended] = supplementKind.toContents(
      {
        name_de: 'BCAA',
        summary_de: 'BCAA sind Aminosäuren aus Eiweiß.',
        not_recommended_reason_de: 'Für eine Empfehlung reicht die Studienlage nicht aus.',
      },
      bcaa,
      META,
    );
    expect(notRecommended!.content).toMatchObject({
      evidence_level: 'c',
      how_to_de: null,
      claim_ids: [],
    });
    const [caffeineEntry] = supplementKind.toContents(
      {
        name_de: 'Koffein',
        summary_de: 'Koffein steckt in Kaffee und Tee.',
        how_to_de: 'Prüfe die Packung.',
      },
      caffeine,
      META,
    );
    expect(caffeineEntry!.content).toMatchObject({ evidence_level: null, claim_ids: [] });
    for (const entry of [created, notRecommended, caffeineEntry]) {
      expect(supplementContentSchema.safeParse(entry!.content).success).toBe(true);
    }
    // Stufe C antwortet ohne Anwendung, die Startliste ohne Grund.
    expect(
      supplementKind.outputSchema(bcaa, context).safeParse({
        name_de: 'BCAA',
        summary_de: 'BCAA sind Aminosäuren aus Eiweiß.',
        how_to_de: 'Nimm sie zum Essen.',
      }).success,
    ).toBe(false);
  });

  it('Anfrage-Text: keine Wirkung, keine Zahlen, Platzhalter, verbotene Wörter, Koffein neutral', () => {
    const system = supplementKind.systemPrompt(context);
    expect(system).toContain('VO (EG) 1924/2006');
    expect(system).toContain('KEINE Ziffern');
    expect(system).toContain('Booster');
    expect(system).toContain('Koffein: nur neutrale Sicherheits-Info');
    const cells = supplementKind.cells(context);
    const creatinePrompt = supplementKind.userPrompt(
      cells.find((c) => c.targetId === 'creatine')!,
      context,
    );
    expect(creatinePrompt).toContain('{dose}, {gain}');
    expect(creatinePrompt).toContain('NICHT wiederholen');
    const bcaaPrompt = supplementKind.userPrompt(
      cells.find((c) => c.targetId === 'bcaa')!,
      context,
    );
    expect(bcaaPrompt).toContain('Erlaubte Platzhalter: keine');
    expect(bcaaPrompt).toContain('schreibe keine Wirkung');
  });
});

describe('Austausch-Tabelle (Etappe N9)', () => {
  it('eine Zelle je katalog-geprüftem Lebensmittel; Antwort nur mit Katalog-IDs, Rollen, Faktor 0,2–5', () => {
    const cells = ingredientSubstitutionKind.cells(nutritionContext);
    expect(cells.length).toBe(nutritionContext.foods.length);
    for (const cell of cells) expect(cell.customId).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    const tofu = cells.find((c) => c.values.food_id === 'tofu')!;
    const json = JSON.stringify(
      toOutputJsonSchema(ingredientSubstitutionKind.outputSchema(tofu, nutritionContext)),
    );
    expect(json).toContain('"haehnchenbrust"');
    expect(json).not.toContain('"tofu"'); // nie das Original selbst
    expect(json).toContain('"protein"');
    const schema = ingredientSubstitutionKind.outputSchema(tofu, nutritionContext);
    const entry = {
      substitute_food_id: 'haehnchenbrust',
      role: 'protein',
      note_de: 'Gut durchgaren.',
    };
    expect(schema.safeParse({ substitutions: [{ ...entry, factor: 0.57 }] }).success).toBe(true);
    expect(schema.safeParse({ substitutions: [{ ...entry, factor: 6 }] }).success).toBe(false);
    expect(
      schema.safeParse({ substitutions: [{ ...entry, substitute_food_id: 'erfunden' }] }).success,
    ).toBe(false);
    expect(SUBSTITUTION_MAX_TOKENS).toBe(8_000);
  });

  it('Anfrage-Text: Katalog mit Nährwerten, Rollen, Faktor-Regel, keine Heilversprechen, keine Marken', () => {
    const system = ingredientSubstitutionKind.systemPrompt(nutritionContext);
    expect(system).toContain('tofu: Tofu natur');
    expect(system).toContain('Eiweiß 13 g');
    expect(system).toContain('±10 %');
    expect(system).toContain('Keine Gesundheits-, Nährwert- oder Heilversprechen');
    expect(system).toContain('Keine Marken');
    const cell = ingredientSubstitutionKind
      .cells(nutritionContext)
      .find((c) => c.values.food_id === 'tofu')!;
    const user = ingredientSubstitutionKind.userPrompt(cell, {
      ...nutritionContext,
      substitutions: demoNutritionContent()
        .files.filter((f) => f.kind === 'ingredient_substitution')
        .map((f) => ingredientSubstitutionSchema.parse(f.data)),
    });
    expect(user).toContain('haehnchenbrust (protein)');
  });

  it('übersprungen, wenn es für das Lebensmittel schon einen Eintrag gibt', () => {
    const subs = demoNutritionContent()
      .files.filter((f) => f.kind === 'ingredient_substitution')
      .map((f) => ingredientSubstitutionSchema.parse(f.data));
    const ctx = { ...nutritionContext, substitutions: subs };
    const tofu = ingredientSubstitutionKind.cells(ctx).find((c) => c.values.food_id === 'tofu')!;
    const banane = ingredientSubstitutionKind
      .cells(ctx)
      .find((c) => c.values.food_id === 'banane')!;
    expect(ingredientSubstitutionKind.isPresent(tofu, ctx)).toBe(true);
    expect(ingredientSubstitutionKind.isPresent(banane, ctx)).toBe(false);
  });
});

describe('Packungsgrößen (Etappe N11)', () => {
  it('eine Zelle je katalog-geprüftem Lebensmittel ohne Alkohol; Antwort ganze Gramm 1–5.000 oder null', () => {
    const cells = packageSizeKind.cells(nutritionContext);
    expect(cells.length).toBe(nutritionContext.foods.filter((f) => !f.alcohol).length);
    for (const cell of cells) expect(cell.customId).toMatch(/^[a-zA-Z0-9_-]{1,64}$/);
    const tofu = cells.find((c) => c.values.food_id === 'tofu')!;
    expect(tofu.targetId).toBe('packung-tofu');
    const schema = packageSizeKind.outputSchema(tofu, nutritionContext);
    const { min, max } = PACKAGE_SIZE_LIMITS.grams;
    expect(schema.safeParse({ package_size_g: 200 }).success).toBe(true);
    expect(schema.safeParse({ package_size_g: min }).success).toBe(true);
    expect(schema.safeParse({ package_size_g: max }).success).toBe(true);
    expect(schema.safeParse({ package_size_g: null }).success).toBe(true);
    expect(schema.safeParse({ package_size_g: 0 }).success).toBe(false);
    expect(schema.safeParse({ package_size_g: max + 1 }).success).toBe(false);
    expect(schema.safeParse({ package_size_g: 200.5 }).success).toBe(false);
    expect(JSON.stringify(toOutputJsonSchema(schema))).toContain('"integer"');
    expect(PACKAGE_SIZE_MAX_TOKENS).toBe(4_000);
  });

  it('Antwort → Datei: Entwurf `packung-<id>`; null = keine Datei (no_content)', () => {
    const tofu = packageSizeKind.cells(nutritionContext).find((c) => c.values.food_id === 'tofu')!;
    const meta = { origin: 'batch', model: 'x', batch_id: 'b', created_on: '2026-10-14' };
    const [file] = packageSizeKind.toContents({ package_size_g: 200 }, tofu, meta);
    expect(file?.id).toBe('packung-tofu');
    expect(file?.content).toMatchObject({ status: 'draft', food_id: 'tofu', package_size_g: 200 });
    expect(packageSizeKind.toContents({ package_size_g: null }, tofu, meta)).toEqual([]);
  });

  it('Anfrage-Text: Handelsgröße DACH, ganze Gramm, keine Marken; übersprungen, wenn es schon einen Eintrag gibt', () => {
    const system = packageSizeKind.systemPrompt(nutritionContext);
    expect(system).toContain('kleinste übliche Kaufeinheit');
    expect(system).toContain('ganze Gramm, 1–5.000');
    expect(system).toContain('Keine Marken');
    const banane = packageSizeKind
      .cells(nutritionContext)
      .find((c) => c.values.food_id === 'banane')!;
    expect(packageSizeKind.userPrompt(banane, nutritionContext)).toContain('ein Stück ≈');
    const existing = packageSizeSchema.parse({
      id: 'packung-banane',
      version: 1,
      status: 'draft',
      food_id: 'banane',
      package_size_g: 1000,
      meta: {
        origin: 'batch',
        model: 'x',
        batch_id: 'b',
        created_on: '2026-10-14',
        expert_reviewed: false,
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      },
    });
    const ctx = { ...nutritionContext, packageSizes: [existing] };
    expect(packageSizeKind.isPresent(banane, ctx)).toBe(true);
    expect(
      packageSizeKind.isPresent(banane, {
        ...ctx,
        packageSizes: [{ ...existing, status: 'archived' }],
      }),
    ).toBe(false);
    // Probelauf-Inhalte zählen nicht als vorhanden (Wächter N11 S3) – weder Packungen noch Austausch.
    const dryRun = { ...existing, meta: { ...existing.meta, model: 'probelauf-ohne-ki' } };
    expect(packageSizeKind.isPresent(banane, { ...ctx, packageSizes: [dryRun] })).toBe(false);
    const tofu = ingredientSubstitutionKind
      .cells(nutritionContext)
      .find((c) => c.values.food_id === 'tofu')!;
    const sub = ingredientSubstitutionSchema.parse({
      id: 'tausch-tofu-zu-haehnchenbrust',
      version: 1,
      status: 'draft',
      food_id: 'tofu',
      substitute_food_id: 'haehnchenbrust',
      factor: 0.57,
      role: 'protein',
      note_de: 'Probelauf: Hähnchen gut durchgaren.',
      meta: { ...existing.meta, batch_id: 'probelauf_x' },
    });
    expect(ingredientSubstitutionKind.isPresent(tofu, { ...ctx, substitutions: [sub] })).toBe(
      false,
    );
    expect(
      ingredientSubstitutionKind.isPresent(tofu, {
        ...ctx,
        substitutions: [{ ...sub, meta: { ...existing.meta } }],
      }),
    ).toBe(true);
  });
});

describe('Anfragen für die Gemini Batch API', () => {
  it('baut je Zelle eine Anfrage mit System-Text, JSON-Schema, Höchstzahl Token und Denktiefe', () => {
    const cells = planTemplateKind.cells(context).slice(0, 3);
    const requests = buildBatchRequests(planTemplateKind, cells, context, {
      model: 'gemini-3.8-flash',
      effort: 'high',
    });
    expect(requests.map((r) => r.customId)).toEqual(cells.map((c) => c.customId));
    for (const request of requests) {
      expect(request.maxOutputTokens).toBe(24_000);
      expect(request.effort).toBe('high');
      expect(request.responseJsonSchema.type).toBe('object');
      expect(findStructuredOutputProblems(request.responseJsonSchema)).toEqual([]);
      expect(request.systemInstruction).toBe(requests[0]!.systemInstruction);
    }
  });

  it('lehnt doppelte oder ungültige custom_ids ab', () => {
    const cell = planTemplateKind.cells(context)[0]!;
    expect(() =>
      buildBatchRequests(planTemplateKind, [cell, cell], context, { model: 'm', effort: 'high' }),
    ).toThrow(/doppelte custom_id/);
    expect(() =>
      buildBatchRequests(planTemplateKind, [{ ...cell, customId: 'mit leerzeichen' }], context, {
        model: 'm',
        effort: 'high',
      }),
    ).toThrow(/custom_id/);
  });
});
