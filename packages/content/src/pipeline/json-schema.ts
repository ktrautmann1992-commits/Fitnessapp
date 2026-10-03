/**
 * JSON-Schema für Structured Outputs (`output_config.format`) aus einem Zod-Schema.
 *
 * Structured Outputs unterstützen nicht alle Schema-Angaben: Zahlen-Grenzen (minimum, maximum, multipleOf),
 * Text-Grenzen (minLength, maxLength), Muster (pattern) und Listen-Grenzen (minItems, maxItems, uniqueItems)
 * werden entfernt. Diese Grenzen prüft danach wieder Zod (Regel Ü1) – eine Antwort, die das JSON-Format
 * einhält, aber Grenzen verletzt, wird so trotzdem abgelehnt (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 2.3).
 */
import { z } from 'zod';

/** Schlüssel, die vor dem Absenden entfernt werden. */
export const UNSUPPORTED_SCHEMA_KEYWORDS = [
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'default',
] as const;

/** Unterstützte String-Formate; andere `format`-Angaben werden entfernt. */
const SUPPORTED_FORMATS = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'uri',
  'ipv4',
  'ipv6',
  'uuid',
]);

const REMOVED = new Set<string>(UNSUPPORTED_SCHEMA_KEYWORDS);

/**
 * `type: ["string", "null"]` (Typ-Liste) → `anyOf: [{type: "string", …}, {type: "null"}]` – Typ-Listen
 * gehören nicht zu den dokumentierten Angaben, `anyOf` schon.
 */
function normalizeTypeList(node: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(node.type)) {
    return node;
  }
  const { type, ...rest } = node;
  const types = type as string[];
  return {
    anyOf: types.map((single) =>
      single === 'null' ? { type: 'null' } : { type: single, ...rest },
    ),
  };
}

/** Entfernt nicht unterstützte Angaben rekursiv (gibt eine Kopie zurück). */
export function stripUnsupportedKeywords(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(stripUnsupportedKeywords);
  }
  if (schema === null || typeof schema !== 'object') {
    return schema;
  }
  const normalized = normalizeTypeList(schema as Record<string, unknown>);
  if (normalized !== schema) {
    return stripUnsupportedKeywords(normalized);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema as Record<string, unknown>)) {
    if (REMOVED.has(key)) {
      continue;
    }
    if (key === 'format' && typeof value === 'string' && !SUPPORTED_FORMATS.has(value)) {
      continue;
    }
    // Unter `properties` sind die Schlüssel Feldnamen (z. B. ein Feld „pattern“) – nie entfernen.
    if (key === 'properties' && value !== null && typeof value === 'object') {
      result[key] = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([name, sub]) => [
          name,
          stripUnsupportedKeywords(sub),
        ]),
      );
      continue;
    }
    result[key] = stripUnsupportedKeywords(value);
  }
  return result;
}

/** Prüft, dass jedes Objekt `additionalProperties: false` hat und alle Felder Pflicht sind. */
export function findStructuredOutputProblems(schema: unknown, path = '#'): string[] {
  if (Array.isArray(schema)) {
    return schema.flatMap((item, index) => findStructuredOutputProblems(item, `${path}/${index}`));
  }
  if (schema === null || typeof schema !== 'object') {
    return [];
  }
  const node = schema as Record<string, unknown>;
  const problems: string[] = [];
  if (Array.isArray(node.type)) {
    problems.push(`${path}: Typ-Liste statt anyOf.`);
  }
  if (node.type === 'object') {
    if (node.additionalProperties !== false) {
      problems.push(`${path}: additionalProperties muss false sein.`);
    }
    const properties = Object.keys((node.properties as Record<string, unknown>) ?? {});
    const required = new Set((node.required as string[] | undefined) ?? []);
    const optional = properties.filter((name) => !required.has(name));
    if (optional.length > 0) {
      problems.push(`${path}: Felder müssen Pflicht sein: ${optional.join(', ')}.`);
    }
  }
  for (const key of UNSUPPORTED_SCHEMA_KEYWORDS) {
    if (key in node && key !== '$schema') {
      problems.push(`${path}: nicht unterstützte Angabe „${key}“.`);
    }
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'properties' && value !== null && typeof value === 'object') {
      for (const [name, sub] of Object.entries(value as Record<string, unknown>)) {
        problems.push(...findStructuredOutputProblems(sub, `${path}/properties/${name}`));
      }
    } else if (typeof value === 'object') {
      problems.push(...findStructuredOutputProblems(value, `${path}/${key}`));
    }
  }
  return problems;
}

/** Zod → JSON-Schema (Draft 2020-12) ohne nicht unterstützte Angaben, bereit für `output_config.format`. */
export function toOutputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' });
  const cleaned = stripUnsupportedKeywords(raw) as Record<string, unknown>;
  const problems = findStructuredOutputProblems(cleaned);
  if (problems.length > 0) {
    throw new Error(`JSON-Schema für Structured Outputs ungültig: ${problems.join(' ')}`);
  }
  return cleaned;
}
