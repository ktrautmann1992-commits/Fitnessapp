/**
 * JSON-Schema für die strukturierte Ausgabe von Gemini (`responseMimeType: "application/json"` +
 * `responseJsonSchema`) aus einem Zod-Schema.
 *
 * Gemini unterstützt laut SDK-Dokumentation (`@google/genai`, `GenerateContentConfig.responseJsonSchema`) nur
 * diese Angaben: `$id`, `$defs`, `$ref`, `$anchor`, `type`, `format`, `title`, `description`, `enum` (Texte und
 * Zahlen), `items`, `prefixItems`, `minItems`, `maxItems`, `minimum`, `maximum`, `anyOf`, `oneOf`, `properties`,
 * `additionalProperties`, `required` und `propertyOrdering`. Alles andere (z. B. Muster, Text-Längen,
 * `exclusiveMinimum`, `uniqueItems`) wird entfernt; `const` wird zu `enum` mit einem Wert. Diese Grenzen prüft
 * danach wieder Zod (Regel Ü1) – eine Antwort, die das JSON-Format einhält, aber Grenzen verletzt, wird so trotzdem
 * abgelehnt (docs/PLAN-PHASE-2.md Abschnitt 4, Schritt 2.3).
 */
import { z } from 'zod';

/** Von Gemini unterstützte Schema-Angaben (alles andere wird entfernt). */
export const SUPPORTED_SCHEMA_KEYWORDS = [
  '$id',
  '$defs',
  '$ref',
  '$anchor',
  'type',
  'format',
  'title',
  'description',
  'enum',
  'items',
  'prefixItems',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'anyOf',
  'oneOf',
  'properties',
  'additionalProperties',
  'required',
  'propertyOrdering',
] as const;

const SUPPORTED = new Set<string>(SUPPORTED_SCHEMA_KEYWORDS);

/** Vorsichtig nur Datums-/Zeitformate; andere `format`-Angaben werden entfernt (Zod prüft sie danach). */
const SUPPORTED_FORMATS = new Set(['date-time', 'date', 'time']);

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

/** `const` → `enum` mit einem Wert (nur Texte und Zahlen; sonst entfernt). */
function constToEnum(node: Record<string, unknown>): Record<string, unknown> {
  if (!('const' in node)) {
    return node;
  }
  const { const: value, ...rest } = node;
  return typeof value === 'string' || typeof value === 'number' ? { ...rest, enum: [value] } : rest;
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
  const node = constToEnum(normalized);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!SUPPORTED.has(key)) {
      continue;
    }
    if (key === 'format' && (typeof value !== 'string' || !SUPPORTED_FORMATS.has(value))) {
      continue;
    }
    // Unter `properties` und `$defs` sind die Schlüssel Namen (z. B. ein Feld „pattern“) – nie entfernen.
    if ((key === 'properties' || key === '$defs') && value !== null && typeof value === 'object') {
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
  // Feste Reihenfolge der Felder wie im Zod-Schema (Gemini-Angabe `propertyOrdering`).
  if (
    result.type === 'object' &&
    result.properties !== null &&
    typeof result.properties === 'object'
  ) {
    const names = Object.keys(result.properties as Record<string, unknown>);
    if (names.length > 0) {
      result.propertyOrdering = names;
    }
  }
  return result;
}

/** Prüft, dass nur unterstützte Angaben übrig sind und `enum` nur Texte/Zahlen enthält. */
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
  for (const key of Object.keys(node)) {
    if (!SUPPORTED.has(key)) {
      problems.push(`${path}: nicht unterstützte Angabe „${key}“.`);
    }
  }
  if (
    Array.isArray(node.enum) &&
    node.enum.some((value) => typeof value !== 'string' && typeof value !== 'number')
  ) {
    problems.push(`${path}: enum nur mit Texten oder Zahlen.`);
  }
  for (const [key, value] of Object.entries(node)) {
    if ((key === 'properties' || key === '$defs') && value !== null && typeof value === 'object') {
      for (const [name, sub] of Object.entries(value as Record<string, unknown>)) {
        problems.push(...findStructuredOutputProblems(sub, `${path}/${key}/${name}`));
      }
    } else if (
      key !== 'enum' &&
      key !== 'required' &&
      key !== 'propertyOrdering' &&
      typeof value === 'object'
    ) {
      problems.push(...findStructuredOutputProblems(value, `${path}/${key}`));
    }
  }
  return problems;
}

/** Zod → JSON-Schema (Draft 2020-12) ohne nicht unterstützte Angaben, bereit für `responseJsonSchema`. */
export function toOutputJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const raw = z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'output' });
  const cleaned = stripUnsupportedKeywords(raw) as Record<string, unknown>;
  if (cleaned.type !== 'object') {
    throw new Error('JSON-Schema für die strukturierte Ausgabe: Wurzel muss ein Objekt sein.');
  }
  const problems = findStructuredOutputProblems(cleaned);
  if (problems.length > 0) {
    throw new Error(`JSON-Schema für die strukturierte Ausgabe ungültig: ${problems.join(' ')}`);
  }
  return cleaned;
}
