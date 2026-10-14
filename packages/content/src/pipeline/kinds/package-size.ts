/**
 * Inhaltsart „Packungsgrößen“ (content/package-sizes, docs/PLAN-PHASE-5.md 19.4 „Packungsgrößen (N11)“, 19.7 N11,
 * KONZEPT 6.11). Eine Anfrage je Lebensmittel des Katalogs (katalog-geprüft, nicht zurückgezogen, ohne Alkohol); das
 * Modell schlägt die kleinste übliche Kaufeinheit im DACH-Handel in Gramm vor (z. B. Brokkoli 500 g, Quark 500 g) –
 * Structured Output mit ganzen Gramm, danach Zod mit der Plausibilität 1–5.000 g. Jede Antwort wird eine Datei
 * `packung-<lebensmittel>.json` mit Status `draft`; content:validate prüft R24, freigegeben wird über content-review
 * (Art „ids“). Keine Echtzeit-KI: Die App nutzt nur freigegebene Werte (Resteplanung N13/N14).
 */
import {
  type Food,
  FORBIDDEN_BRANDS,
  PACKAGE_SIZE_LIMITS,
  packageSizeContentId,
  packageSizeGramsSchema,
  packageSizeSchema,
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABELS_DE,
  type ShoppingCategory,
  stableHash,
} from '@fitnessapp/core';
import { z } from 'zod';

import { countsAsPresent } from './present';
import { OUTPUT_FORMAT_TEXT, ROLE_TEXT } from './prompt-rules';
import type { ContentKindDefinition, GenerationCell, LibraryContext } from './types';

/** max_tokens je Anfrage (eine Zahl, inkl. Denken). */
export const PACKAGE_SIZE_MAX_TOKENS = 4_000;

/** Feldreihenfolge der Dateien (wie packageSizeSchema). */
const FIELD_ORDER = ['id', 'version', 'status', 'food_id', 'package_size_g', 'meta'] as const;

function customIdFor(foodId: string): string {
  const plain = `pack-${foodId}`;
  return plain.length <= 64 ? plain : `pack-${stableHash(foodId).toString(16)}`;
}

function cellFor(food: Pick<Food, 'id' | 'name_de' | 'shopping_category'>): GenerationCell {
  return {
    customId: customIdFor(food.id),
    targetId: packageSizeContentId(food.id),
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

/** Zod-Schema der Modell-Antwort: ganze Gramm (1–5.000) oder null = keine sinnvolle Angabe. */
export function packageSizeOutputSchema() {
  return z.strictObject({ package_size_g: packageSizeGramsSchema.nullable() });
}

function fmt(value: number): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

function systemPrompt(): string {
  const brands = FORBIDDEN_BRANDS.map((rule) => rule.label).join(', ');
  const { min, max } = PACKAGE_SIZE_LIMITS.grams;
  return [
    ROLE_TEXT,
    '',
    'Aufgabe: Nenne für EIN Lebensmittel die übliche Packungsgröße im Supermarkt in Deutschland, Österreich und der Schweiz – genauer: die kleinste übliche Kaufeinheit in Gramm (z. B. Brokkoli 500 g, Magerquark 500 g, Haferflocken 500 g, Eier 10 Stück ≈ 600 g). Die App rechnet damit später aus, was nach dem Kochen übrig bleibt.',
    '',
    'Regeln:',
    `- package_size_g: ganze Gramm, ${fmt(min)}–${fmt(max)}. Bei Flüssigkeiten das Gewicht der Packung (1 l Milch ≈ 1.030 g). Bei Ware, die meist einzeln verkauft wird (z. B. eine Paprika, eine Zwiebel), das Gewicht eines Stücks bzw. der üblichen Einheit (Netz, Schale).`,
    '- Nimm die Größe, die die meisten Haushalte kaufen – keine Großpackung, keine Probiergröße.',
    '- Gibt es keine sinnvolle Angabe (z. B. Wasser aus der Leitung, Eiswürfel), antworte mit null.',
    `- Keine Marken- oder Herstellernamen (z. B. ${brands}); es geht nur um die Produktart.`,
    '',
    OUTPUT_FORMAT_TEXT,
  ].join('\n');
}

function userPrompt(cell: GenerationCell, context: LibraryContext): string {
  const foodId = foodIdOf(cell);
  const food = context.foods.find((f) => f.id === foodId);
  if (food === undefined) {
    return `Lebensmittel: ${foodId}`;
  }
  const piece =
    food.units.piece_g === undefined ? '' : ` · ein Stück ≈ ${fmt(food.units.piece_g)} g`;
  const aliases = food.aliases_de.length > 0 ? ` (auch: ${food.aliases_de.join(', ')})` : '';
  return [
    `Lebensmittel: ${food.id} – ${food.name_de}${aliases}`,
    `Abteilung: ${SHOPPING_CATEGORY_LABELS_DE[food.shopping_category]}${piece}`,
    'Wie viel Gramm hat die übliche Packung bzw. kleinste übliche Kaufeinheit?',
  ].join('\n');
}

function toContents(
  output: unknown,
  cell: GenerationCell,
  meta: Record<string, unknown>,
): { id: string; content: Record<string, unknown> }[] {
  const data = output as { package_size_g: number | null };
  if (data.package_size_g === null) return [];
  const foodId = foodIdOf(cell);
  const id = packageSizeContentId(foodId);
  const merged: Record<string, unknown> = {
    id,
    version: 1,
    status: 'draft',
    food_id: foodId,
    package_size_g: data.package_size_g,
    meta,
  };
  return [{ id, content: Object.fromEntries(FIELD_ORDER.map((key) => [key, merged[key]])) }];
}

/**
 * Feste Beispiel-Antworten für den Probelauf (ohne KI): eine gültige, eine ungültige (über 5.000 g), eine Ablehnung.
 * Die IDs stammen aus dem Beispiel-Katalog; fehlen sie im echten Katalog, meldet content:validate R24 rot –
 * Probelauf-Entwürfe werden ohnehin nie freigegeben.
 */
function dryRunFixtures() {
  return [
    {
      cell: cellFor({
        id: 'tofu',
        name_de: 'Tofu natur',
        shopping_category: 'chilled_plant_based',
      }),
      response: { kind: 'json' as const, data: { package_size_g: 200 } },
    },
    {
      // Absichtlich ungültig: mehr als 5.000 g (prüft Zod).
      cell: cellFor({ id: 'reis', name_de: 'Reis', shopping_category: 'pasta_rice_grains' }),
      response: { kind: 'json' as const, data: { package_size_g: 9000 } },
    },
    {
      cell: cellFor({ id: 'banane', name_de: 'Banane', shopping_category: 'fruit_vegetables' }),
      response: { kind: 'refusal' as const },
    },
  ];
}

const CATEGORY_KEYS: readonly ShoppingCategory[] = SHOPPING_CATEGORIES;

export const packageSizeKind: ContentKindDefinition = {
  kind: 'package_size',
  inputName: 'package-sizes',
  labelDe: 'Packungsgrößen',
  folder: 'package-sizes',
  contentSchema: packageSizeSchema,
  maxTokens: PACKAGE_SIZE_MAX_TOKENS,
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
    context.packageSizes.some((p) => countsAsPresent(p) && p.food_id === cell.values.food_id),
  systemPrompt,
  userPrompt,
  outputSchema: packageSizeOutputSchema,
  toContents,
  dryRunFixtures,
};
