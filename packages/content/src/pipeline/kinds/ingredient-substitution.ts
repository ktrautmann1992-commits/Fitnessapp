/**
 * Inhaltsart „Austausch-Tabelle“ (content/substitutions, docs/PLAN-PHASE-5.md 19.4 „Austausch (N9)“, 19.7 N9,
 * KONZEPT 6.9). Eine Anfrage je Lebensmittel des Katalogs (katalog-geprüft, nicht zurückgezogen); das Modell schlägt
 * bis zu 4 Alternativen vor – Structured Output NUR mit Katalog-IDs, Rollen aus 19.4, Faktor 0,2–5. Jede Alternative
 * wird eine eigene Datei `tausch-<zutat>-zu-<ersatz>.json` mit Status `draft`. Danach prüft content:validate R23
 * (Messgröße der Rolle ±10 %, kein Alkohol, Katalog-Prüfung, Hinweis-Text R10); freigegeben wird über content-review
 * (Art „ids“). Keine Echtzeit-KI: Ob eine Alternative einer Person angeboten wird, entscheidet die App mit festen
 * Regeln (`nutrition/substitute.ts`).
 */
import {
  type Food,
  FORBIDDEN_BRANDS,
  INGREDIENT_ROLE_LABELS_DE,
  INGREDIENT_ROLES,
  INGREDIENT_SUBSTITUTION_LIMITS,
  ingredientSubstitutionSchema,
  ROLE_MEASURE_DE,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABELS_DE,
  type ShoppingCategory,
  stableHash,
  substitutionContentId,
  substitutionFactorSchema,
} from '@fitnessapp/core';
import { z } from 'zod';

import { MODEL_FLASH_LITE } from '../config';

import { countsAsPresent } from './present';
import { OUTPUT_FORMAT_TEXT, ROLE_TEXT } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/** max_tokens je Anfrage (kurze Antwort mit bis zu 4 Einträgen, inkl. Denken). */
export const SUBSTITUTION_MAX_TOKENS = 8_000;
/** Höchstens so viele Alternativen je Lebensmittel und Anfrage. PRODUKTENTSCHEIDUNG. */
export const SUBSTITUTIONS_PER_REQUEST = 4;

/** Feldreihenfolge der Dateien (wie ingredientSubstitutionSchema). */
const FIELD_ORDER = [
  'id',
  'version',
  'status',
  'food_id',
  'substitute_food_id',
  'factor',
  'role',
  'note_de',
  'meta',
] as const;

function customIdFor(foodId: string): string {
  const plain = `sub-${foodId}`;
  return plain.length <= 64 ? plain : `sub-${stableHash(foodId).toString(16)}`;
}

function cellFor(food: Pick<Food, 'id' | 'name_de' | 'shopping_category'>): GenerationCell {
  return {
    customId: customIdFor(food.id),
    targetId: null,
    label: `${food.name_de} (${SHOPPING_CATEGORY_LABELS_DE[food.shopping_category]})`,
    values: { abteilung: food.shopping_category, food_id: food.id },
  };
}

function foodIdOf(cell: GenerationCell): string {
  const id = cell.values.food_id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`Zelle ${cell.customId} ohne Lebensmittel.`);
  }
  return id;
}

/** Mögliche Ersatz-IDs: katalog-geprüfte Lebensmittel ohne Alkohol, nicht das Original. */
function substituteIds(context: LibraryContext, foodId: string): string[] {
  return context.foods
    .filter((food) => food.id !== foodId && !food.alcohol)
    .map((food) => food.id)
    .sort();
}

/** Zod-Schema der Modell-Antwort (Katalog-IDs als erlaubte Werte; ohne Katalog: ID-Format, R23 prüft danach). */
export function substitutionOutputSchema(cell: GenerationCell, context: LibraryContext) {
  const ids = substituteIds(context, foodIdOf(cell));
  const S = ingredientSubstitutionSchema.shape;
  return z.strictObject({
    substitutions: z
      .array(
        z.strictObject({
          substitute_food_id: ids.length > 0 ? z.enum(ids as [string, ...string[]]) : S.food_id,
          role: z.enum(INGREDIENT_ROLES),
          factor: substitutionFactorSchema,
          note_de: S.note_de,
        }),
      )
      .max(SUBSTITUTIONS_PER_REQUEST),
  });
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

function catalogLine(food: Food): string {
  const n = food.nutrients_per_100g;
  return `- ${food.id}: ${food.name_de} | Eiweiß ${fmt(n.protein_g)} g, Kohlenhydrate ${fmt(n.carbs_g)} g, Fett ${fmt(n.fat_g)} g je 100 g | Gruppen: ${food.groups.join(', ') || 'keine'}`;
}

function systemPrompt(context: LibraryContext): string {
  const brands = FORBIDDEN_BRANDS.map((rule) => rule.label).join(', ');
  const tolerance = INGREDIENT_SUBSTITUTION_LIMITS.roleTolerance * 100;
  const { min, max } = INGREDIENT_SUBSTITUTION_LIMITS.factor;
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Schlage für EIN Lebensmittel aus dem Katalog bis zu vier Alternativen vor, die eine Person in einem Rezept stattdessen verwenden kann (Zutaten-Austausch). Die App bietet eine Alternative später nur an, wenn sie zu Ernährungsform, Unverträglichkeiten und Schwangerschaft der Person passt – das prüft sie selbst.',
    '',
    'Regeln:',
    '- substitute_food_id: nur IDs aus dem Katalog unten (im Schema vorgegeben). Kein Alkohol.',
    `- role: Rolle der Zutat im Rezept – ${INGREDIENT_ROLES.map((r) => `${r} = ${INGREDIENT_ROLE_LABELS_DE[r]} (Messgröße: ${ROLE_MEASURE_DE[r]})`).join('; ')}.`,
    `- factor (${fmt(min)}–${fmt(max)}): Gramm Ersatz = Gramm Original × Faktor. Der Faktor hält die Messgröße der Rolle gleich (höchstens ±${fmt(tolerance)} %): Eiweiß = Eiweiß-Original ÷ Eiweiß-Ersatz je 100 g, entsprechend Kohlenhydrate und Fett; Gemüse = 1 (gleiche Masse). Rechne mit den Werten aus dem Katalog.`,
    '- Nur sinnvolle, alltagsübliche Alternativen aus derselben Verwendung (z. B. Tofu statt Hähnchen in der Pfanne), keine exotischen Kombinationen.',
    '- note_de: ein kurzer Hinweis zur Zubereitung (5–200 Zeichen), z. B. „Hähnchen gut durchgaren.“ Keine Gesundheits-, Nährwert- oder Heilversprechen, keine Aussagen über Krankheiten.',
    `- Keine Marken- oder Herstellernamen (z. B. ${brands}).`,
    '- Kein Text am Anfang oder Ende mit Leerzeichen; keine Emojis, kein Markdown.',
    '- Gibt es keine sinnvolle Alternative, antworte mit einer leeren Liste.',
    '',
    'Katalog (ID: Name | Nährwerte je 100 g | Gruppen):',
    context.foods.map(catalogLine).join('\n') || '- (noch keine Lebensmittel)',
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell, context: LibraryContext): string {
  const foodId = foodIdOf(cell);
  const food = context.foods.find((f) => f.id === foodId);
  const existing = context.substitutions
    .filter((s) => s.food_id === foodId && s.status !== 'archived')
    .map((s) => `${s.substitute_food_id} (${s.role})`)
    .join(', ');
  return [
    `Lebensmittel: ${foodId}${food === undefined ? '' : ` – ${food.name_de}`}`,
    `Schon vorhandene Alternativen: ${existing || 'keine'}.`,
    'Schlage bis zu vier weitere Alternativen vor (keine, die es schon gibt).',
  ].join('\n');
}

function toContents(
  output: unknown,
  cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> }[] {
  const data = output as {
    substitutions: { substitute_food_id: string; role: string; factor: number; note_de: string }[];
  };
  const foodId = foodIdOf(cell);
  return data.substitutions.map((entry) => {
    const id = substitutionContentId(foodId, entry.substitute_food_id);
    const merged: Record<string, unknown> = {
      ...entry,
      id,
      version: 1,
      status: 'draft',
      food_id: foodId,
      meta,
    };
    return { id, content: Object.fromEntries(FIELD_ORDER.map((key) => [key, merged[key]])) };
  });
}

/**
 * Feste Beispiel-Antworten für den Probelauf (ohne KI): eine gültige mit zwei Alternativen, eine ungültige (Faktor
 * außerhalb 0,2–5), eine Ablehnung. Die IDs stammen aus dem Beispiel-Katalog; fehlen sie im echten Katalog, meldet
 * content:validate R23 rot – Probelauf-Entwürfe werden ohnehin nie freigegeben.
 */
function dryRunFixtures() {
  const tofu = cellFor({
    id: 'tofu',
    name_de: 'Tofu natur',
    shopping_category: 'chilled_plant_based',
  });
  const reis = cellFor({ id: 'reis', name_de: 'Reis', shopping_category: 'pasta_rice_grains' });
  const banane = cellFor({
    id: 'banane',
    name_de: 'Banane',
    shopping_category: 'fruit_vegetables',
  });
  return [
    {
      cell: tofu,
      response: {
        kind: 'json' as const,
        data: {
          substitutions: [
            {
              substitute_food_id: 'haehnchenbrust',
              role: 'protein',
              factor: 0.57,
              note_de: 'Probelauf: Hähnchen gut durchgaren.',
            },
            {
              substitute_food_id: 'huehnerei',
              role: 'protein',
              factor: 1.04,
              note_de: 'Probelauf: Eier verquirlen und mitbraten.',
            },
          ],
        },
      },
    },
    {
      // Absichtlich ungültig: Faktor außerhalb 0,2–5 (prüft Zod).
      cell: reis,
      response: {
        kind: 'json' as const,
        data: {
          substitutions: [
            {
              substitute_food_id: 'spaghetti',
              role: 'carb',
              factor: 9,
              note_de: 'Zu viel Faktor.',
            },
          ],
        },
      },
    },
    { cell: banane, response: { kind: 'refusal' as const } },
  ];
}

const CATEGORY_KEYS: readonly ShoppingCategory[] = SHOPPING_CATEGORIES;

export const ingredientSubstitutionKind: ContentKindDefinition = {
  kind: 'ingredient_substitution',
  inputName: 'ingredient-substitutions',
  labelDe: 'Austausch-Einträge',
  folder: 'substitutions',
  contentSchema: ingredientSubstitutionSchema,
  // Standard: eng begrenzt: Katalog-IDs, Rolle, Faktor; R23 prüft danach (Gründer-Vorgabe 15.10.2026, docs/PLAN-PHASE-5.md N8).
  defaultModel: MODEL_FLASH_LITE,
  defaultEffort: 'low',
  maxTokens: SUBSTITUTION_MAX_TOKENS,
  dimensions: [
    {
      key: 'abteilung',
      labelDe: 'Abteilung',
      values: CATEGORY_KEYS.map((value) => ({ value, aliases: [] })),
    },
  ],
  cells: (context) =>
    [...context.foods]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .filter((food) => !food.alcohol)
      .map(cellFor),
  // Übersprungen, sobald es für das Lebensmittel schon einen (nicht zurückgezogenen) Eintrag gibt – Probelauf-Inhalte
  // zählen nicht (Wächter N11 S3).
  isPresent: (cell, context) =>
    context.substitutions.some((s) => countsAsPresent(s) && s.food_id === cell.values.food_id),
  systemPrompt,
  userPrompt,
  outputSchema: substitutionOutputSchema,
  toContents,
  dryRunFixtures,
};
