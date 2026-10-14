import { z } from 'zod';

import { CONTENT_SCHEMA_LIMITS, INGREDIENT_SUBSTITUTION_LIMITS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { stableHash } from '../nutrition/stable-hash';
import { INGREDIENT_ROLES } from './recipe-schema';
import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Austausch-Tabelle `content/substitutions/<id>.json` (docs/PLAN-PHASE-5.md 19.4 „Austausch (N9)“, 19.7 N9, KONZEPT
 * 6.9) – Regel R1 (Schema) und R23 (Prüfregeln, `substitution-checks.ts`). Ein Eintrag sagt: Die Zutat `food_id` mit
 * der Rolle `role` darf durch `substitute_food_id` ersetzt werden; die Masse wird mit `factor` multipliziert, damit
 * die Messgröße der Rolle (19.4, S6) gleich bleibt. `note_de` ist der Hinweis in der App (z. B. „Kürzer braten“).
 *
 * Entsteht offline über die Content-Pipeline (Batch-Art `ingredient-substitutions`, nur Katalog-IDs) als `draft` und
 * wird über `content-review` freigegeben – keine Echtzeit-KI. Ob eine Alternative einer Person angeboten wird,
 * entscheidet erst der Core (`nutrition/substitute.ts`: kompletter Filter, R11, Planband, Haltbarkeit).
 */

function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

const L = INGREDIENT_SUBSTITUTION_LIMITS;

/** Faktor auf die Masse der Original-Zutat (0,2–5, Plan 19.7). */
export const substitutionFactorSchema = z
  .number()
  .finite()
  .min(L.factor.min, `Faktor mindestens ${L.factor.min}.`)
  .max(L.factor.max, `Faktor höchstens ${L.factor.max}.`);

export const ingredientSubstitutionSchema = z
  .strictObject({
    id: contentIdSchema,
    version: z
      .number()
      .int('Ganze Zahl erwartet.')
      .min(CONTENT_SCHEMA_LIMITS.version.min)
      .max(CONTENT_SCHEMA_LIMITS.version.max),
    status: z.enum(CONTENT_STATUSES),
    /** Lebensmittel der Rezept-Zutat (Katalog-ID). */
    food_id: contentIdSchema,
    /** Ersatz (Katalog-ID). */
    substitute_food_id: contentIdSchema,
    /** Faktor auf die Masse: Gramm Ersatz = Gramm Original × Faktor. */
    factor: substitutionFactorSchema,
    /** Rolle der Zutat im Rezept (19.4) – angeboten nur für Zutaten mit genau dieser Rolle. */
    role: z.enum(INGREDIENT_ROLES),
    /** Hinweis in der App (Textregeln R10). */
    note_de: text(5, L.noteMaxChars),
    meta: contentMetaSchema,
  })
  .superRefine((sub, ctx) => {
    if (sub.food_id === sub.substitute_food_id) {
      ctx.addIssue({
        code: 'custom',
        path: ['substitute_food_id'],
        message: 'Ersatz ist dasselbe Lebensmittel.',
      });
    }
  });
export type IngredientSubstitution = z.infer<typeof ingredientSubstitutionSchema>;

/**
 * Feste ID eines Austausch-Eintrags: `tausch-<zutat>-zu-<ersatz>`; zu lang (> 80 Zeichen) → `tausch-<16 Hex>` aus dem
 * Paar. So entsteht je Paar genau eine Datei (doppelte Paare meldet R23 zusätzlich).
 */
export function substitutionContentId(foodId: string, substituteFoodId: string): string {
  const plain = `tausch-${foodId}-zu-${substituteFoodId}`;
  if (plain.length <= 80) return plain;
  const hex = (value: number) => value.toString(16).padStart(8, '0');
  const key = `${foodId}|${substituteFoodId}`;
  return `tausch-${hex(stableHash(key))}${hex(stableHash(`${key.length}|${key}`))}`;
}

/** Messgröße je Rolle (19.4, S6) – für R23 und die Anzeige im Admin. */
export const ROLE_MEASURE_DE = {
  protein: 'Eiweiß (g)',
  carb: 'Kohlenhydrate (g)',
  fat: 'Fett (g)',
  vegetable: 'Masse (g)',
  seasoning: 'keine Nährwertprüfung (Salz nach R11)',
  sweet: 'Süßkraft laut Hinweis (menschliche Prüfung)',
} as const satisfies Record<(typeof INGREDIENT_ROLES)[number], string>;

/** Rollen auf Deutsch (App, Admin, PR-Text). */
export const INGREDIENT_ROLE_LABELS_DE = {
  protein: 'Eiweißquelle',
  carb: 'Kohlenhydrat-Beilage',
  fat: 'Fett',
  vegetable: 'Gemüse',
  seasoning: 'Würze',
  sweet: 'Süße',
} as const satisfies Record<(typeof INGREDIENT_ROLES)[number], string>;
