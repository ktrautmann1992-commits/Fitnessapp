import { exerciseSchema, FORBIDDEN_MEDICAL_TERMS, planTemplateSchema } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { loadLibrary } from './files';
import {
  findStructuredOutputProblems,
  stripUnsupportedKeywords,
  toOutputJsonSchema,
  UNSUPPORTED_SCHEMA_KEYWORDS,
} from './json-schema';
import { CONTENT_KINDS, findKind } from './kinds';
import { EXERCISE_MAX_TOKENS, exerciseKind } from './kinds/exercise';
import { PLAN_TEMPLATE_MAX_TOKENS, planTemplateKind, templateIdFor } from './kinds/plan-template';
import { buildBatchRequests } from './requests';
import { REAL_REPO_ROOT } from './test-helpers';

const context = loadLibrary(REAL_REPO_ROOT);

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
  it('entfernt nicht unterstützte Angaben, behält aber Feldnamen wie „pattern“', () => {
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
    for (const keyword of UNSUPPORTED_SCHEMA_KEYWORDS) {
      expect(keys.has(keyword), keyword).toBe(false);
    }
    const properties = result.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(properties)).toContain('pattern');
    expect(properties.kind).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(properties.fixed?.const).toBe(3);
    expect(properties.maybe).toEqual({ anyOf: [{ type: 'string' }, { type: 'null' }] });
    expect(result.additionalProperties).toBe(false);
    expect(result.required).toEqual(['pattern', 'count', 'list', 'kind', 'fixed', 'maybe']);
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

  it('meldet offene Objekte und optionale Felder', () => {
    expect(
      findStructuredOutputProblems({
        type: 'object',
        properties: { a: { type: 'string' } },
        required: [],
      }),
    ).toHaveLength(2);
    expect(() => toOutputJsonSchema(z.object({ a: z.string().optional() }))).toThrow(
      /Structured Outputs/,
    );
  });

  it('Antwort-Schemas beider Arten sind gültig, nutzen Katalog-IDs und feste Matrix-Werte', () => {
    for (const kind of Object.values(CONTENT_KINDS)) {
      for (const cell of kind.cells(context).slice(0, 5)) {
        const schema = toOutputJsonSchema(kind.outputSchema(cell, context));
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
    expect(templateSchema).toContain('"const":"muscle_gain"');
    expect(templateSchema).toContain('"goblet-kniebeuge"');
    const exerciseCell = exerciseKind
      .cells(context)
      .find((cell) => cell.values.movement_pattern === 'squat')!;
    const exerciseJson = JSON.stringify(
      toOutputJsonSchema(exerciseKind.outputSchema(exerciseCell, context)),
    );
    expect(exerciseJson).toContain('"const":"squat"');
    // Alternativen nur mit gleichem Bewegungsmuster.
    expect(exerciseJson).toContain('"kniebeuge-langhantel"');
    expect(exerciseJson).not.toContain('"liegestuetz"');
  });
});

describe('Inhaltsarten', () => {
  it('findet Arten über Workflow-Eingabe und internen Namen', () => {
    expect(findKind('exercises')).toBe(exerciseKind);
    expect(findKind('plan_template')).toBe(planTemplateKind);
    expect(() => findKind('recipes')).toThrow(/Unbekannte Inhaltsart/);
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
    for (const kind of Object.values(CONTENT_KINDS)) {
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
      const fixtures = kind.dryRunFixtures();
      expect(fixtures.some((f) => f.response.kind === 'refusal')).toBe(true);
      const json = fixtures.filter((f) => f.response.kind === 'json');
      const valid = json.filter(
        (f) =>
          kind.outputSchema(f.cell, context).safeParse((f.response as { data: unknown }).data)
            .success,
      );
      expect(valid.length).toBeGreaterThanOrEqual(1);
      expect(json.length - valid.length).toBe(1); // genau eine absichtlich ungültige
      for (const fixture of valid) {
        const output = kind
          .outputSchema(fixture.cell, context)
          .parse((fixture.response as { data: unknown }).data);
        const { id, content } = kind.toContent(output, fixture.cell, {
          origin: 'batch',
          model: 'probelauf-ohne-ki',
          batch_id: 'probelauf_x',
          created_on: '2026-10-03',
          expert_reviewed: false,
          reviewed_by: null,
          reviewed_at: null,
          review_note: null,
        });
        expect(kind.contentSchema.safeParse(content).success).toBe(true);
        expect(context.takenIds[kind.kind].has(id)).toBe(false);
        // Feldreihenfolge wie in den Dateien.
        const schema = kind.kind === 'exercise' ? exerciseSchema : planTemplateSchema;
        expect(Object.keys(content)).toEqual(Object.keys(schema.shape));
      }
    }
  });
});

describe('Anfragen für die Batch-API', () => {
  it('baut je Zelle eine Anfrage mit Modell, max_tokens, Structured Outputs und Denktiefe – ohne fallbacks', () => {
    const cells = planTemplateKind.cells(context).slice(0, 3);
    const requests = buildBatchRequests(planTemplateKind, cells, context, {
      model: 'claude-opus-5-5',
      effort: 'high',
    });
    expect(requests.map((r) => r.custom_id)).toEqual(cells.map((c) => c.customId));
    for (const request of requests) {
      expect(request.params.model).toBe('claude-opus-5-5');
      expect(request.params.max_tokens).toBe(24_000);
      expect(request.params.output_config?.effort).toBe('high');
      expect(request.params.output_config?.format?.type).toBe('json_schema');
      expect(request.params).not.toHaveProperty('fallbacks');
      expect(request.params).not.toHaveProperty('thinking'); // Opus 5.5 denkt immer adaptiv
      expect(request.params.system).toBe(requests[0]!.params.system);
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
