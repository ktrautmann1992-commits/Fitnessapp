import { z } from 'zod';

import rawMapping from '../../../../content/food-mapping/auswaerts-zuordnung.json';
import { isoDateSchema } from '../age';
import {
  ANIMAL_KINDS,
  foodSubstituteSchema,
  foodUnitsSchema,
  GELATIN_ORIGINS,
  MEAT_KINDS,
  SHOPPING_CATEGORIES,
  SOURCE_DATABASES,
  SOURCE_FOOD_CATEGORIES,
} from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import { foodGroupSchema } from '../food-groups';
import {
  EATING_OUT_CATEGORIES,
  EATING_OUT_PORTION_KINDS,
  type EatingOutDishDef,
  type EatingOutMissingFood,
} from './eating-out-table';

/**
 * Zuordnungsdatei „Auswärts essen“ `content/food-mapping/auswaerts-zuordnung.json` (Gründer-Entscheidung G-AV2,
 * 26.10.2026, docs/PLAN-AUSWAERTS-VORRAT.md): die EINE Quelle, aus welchen Katalog-Lebensmitteln (Gramm je normaler
 * Portion) ein Gericht besteht – mit Begründung je Gericht (`source_de`). Sie enthält NIE Nährwerte (das Schema
 * kennt keine Felder dafür); gerechnet wird in `eating-out.ts` aus dem Lebensmittel-Katalog.
 *
 * Abschnitt `foods`: Lebensmittel, die der Katalog für die Gerichte noch braucht – gleiche Angaben wie
 * `alpha5-zuordnung.json` (Quell-ID bzw. Suchbegriffe, Name, Gruppen, tierische Bestandteile …). Der Workflow
 * `foods-import` liest sie mit (Modus „kandidaten“ für Quell-ID null, Modus „import“ schreibt `content/foods/`);
 * von Hand wird nie ein Lebensmittel oder Quellauszug geschrieben (docs/PLAN-PHASE-5.md 5.1.1).
 *
 * Geprüft wird die Datei dreifach: hier beim Laden (ungültig → keine Gerichte, nie erfundene Werte), in
 * `content:validate` (blockierend: Schema, unbekannte Lebensmittel-IDs; Hinweis: „wartet auf Import“) und in den
 * Unit-Tests. ENTWURF – VOR LIVEGANG FACHLICH PRÜFEN.
 */

export const EATING_OUT_MAPPING_FORMAT = 'alpha5-auswaerts-zuordnung';
/** Ablage relativ zum Repository (für content:validate und foods-import). */
export const EATING_OUT_MAPPING_PATH = 'content/food-mapping/auswaerts-zuordnung.json';
/** Pflicht-Kennzeichen, solange die Datei Entwurf ist (Gründer-Vorgabe). */
export const EATING_OUT_REVIEW_MARK = 'VOR LIVEGANG FACHLICH PRÜFEN';
/** Höchstmenge einer Zutat je normaler Portion (g bzw. ml ≈ g). */
export const EATING_OUT_MAX_GRAMS = 600;

const text = (min: number, max: number) =>
  z
    .string()
    .min(min)
    .max(max)
    .refine((v) => v === v.trim(), 'Kein Leerzeichen am Anfang oder Ende.');

const distinct = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.');

/** Quelle eines noch zu importierenden Lebensmittels (wie `mappingSourceSchema` in packages/content). */
export const eatingOutFoodSourceSchema = z.strictObject({
  db: z.enum(SOURCE_DATABASES),
  version: text(1, 40),
  /** Quell-ID (z. B. BLS-Schlüssel); null = noch offen (Kandidatensuche im Workflow foods-import). */
  ref: text(1, 40).nullable(),
  search: z.array(text(2, 80)).min(1).max(6),
  state_de: text(2, 120),
  category: z.enum(SOURCE_FOOD_CATEGORIES),
});

/** Lebensmittel für den Katalog (ohne Nährwerte – die schreibt nur foods-import aus dem Quellauszug). */
export const eatingOutFoodSchema = z
  .strictObject({
    food_id: contentIdSchema,
    name_de: text(2, 100),
    source: eatingOutFoodSourceSchema,
    aliases_de: distinct(text(2, 100), 8),
    shopping_category: z.enum(SHOPPING_CATEGORIES),
    pantry: z.boolean(),
    units: foodUnitsSchema,
    groups: distinct(foodGroupSchema, 23),
    animal: distinct(z.enum(ANIMAL_KINDS), ANIMAL_KINDS.length),
    meat_kind: distinct(z.enum(MEAT_KINDS), MEAT_KINDS.length),
    gelatin_origin: z.enum(GELATIN_ORIGINS).optional(),
    pregnancy_caution: z.boolean(),
    alcohol: z.boolean(),
    max_fridge_days: z.number().int().min(0).max(3),
    freezable: z.boolean(),
    substitutes: z.array(foodSubstituteSchema).max(5),
    reason_de: text(10, 600),
  })
  .refine((food) => food.animal.includes('meat') === food.meat_kind.length > 0, {
    message: '„meat_kind“ genau dann, wenn „animal“ „meat“ enthält.',
    path: ['meat_kind'],
  });
export type EatingOutFoodMapping = z.infer<typeof eatingOutFoodSchema>;

export const eatingOutDishItemSchema = z.strictObject({
  food_id: contentIdSchema,
  /** Gramm (Getränke: ml ≈ g) je NORMALER Portion, Rohgewicht wie in Rezepten. */
  g: z.number().positive().max(EATING_OUT_MAX_GRAMS),
});

export const eatingOutDishSchema = z
  .strictObject({
    id: contentIdSchema.refine((id) => id.startsWith('auswaerts-'), 'ID beginnt mit „auswaerts-“.'),
    name_de: text(3, 80),
    category: z.enum(EATING_OUT_CATEGORIES),
    portion: z.enum(EATING_OUT_PORTION_KINDS),
    basis_de: text(2, 60),
    items: z.array(eatingOutDishItemSchema).min(1).max(20),
    /** Begründung der Portion/Zusammensetzung (Pflicht – ohne Quelle keine Zuordnung). */
    source_de: text(10, 400),
    note_de: text(5, 400).optional(),
    status: z.enum(['draft', 'released']),
    reviewed_by: text(2, 80).optional(),
    reviewed_at: isoDateSchema.optional(),
  })
  .superRefine((dish, ctx) => {
    if (dish.status === 'released' && (!dish.reviewed_by || !dish.reviewed_at)) {
      ctx.addIssue({
        code: 'custom',
        path: ['status'],
        message: 'Freigegeben nur mit „reviewed_by“ und „reviewed_at“.',
      });
    }
    const seen = new Set<string>();
    dish.items.forEach((item, index) => {
      if (seen.has(item.food_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'food_id'],
          message: `„${item.food_id}“ doppelt – Mengen zusammenfassen.`,
        });
      }
      seen.add(item.food_id);
    });
  });
export type EatingOutDishMapping = z.infer<typeof eatingOutDishSchema>;

export const eatingOutMappingSchema = z
  .strictObject({
    format: z.literal(EATING_OUT_MAPPING_FORMAT),
    version: z.number().int().min(1),
    status: z.enum(['entwurf', 'teilweise_freigegeben']),
    fachpruefung_de: z.literal(EATING_OUT_REVIEW_MARK),
    origin: z.literal('claude_session'),
    model: text(1, 100),
    created_on: isoDateSchema,
    note_de: text(10, 2000),
    foods: z.array(eatingOutFoodSchema).max(200),
    dishes: z.array(eatingOutDishSchema).min(1).max(200),
  })
  .superRefine((file, ctx) => {
    const dishIds = new Set<string>();
    file.dishes.forEach((dish, index) => {
      if (dishIds.has(dish.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['dishes', index, 'id'],
          message: `„${dish.id}“ doppelt.`,
        });
      }
      dishIds.add(dish.id);
    });
    const foodIds = new Set<string>();
    file.foods.forEach((food, index) => {
      if (foodIds.has(food.food_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['foods', index, 'food_id'],
          message: `„${food.food_id}“ doppelt.`,
        });
      }
      foodIds.add(food.food_id);
    });
  });
export type EatingOutMapping = z.infer<typeof eatingOutMappingSchema>;

export type EatingOutMappingParse =
  | { readonly ok: true; readonly mapping: EatingOutMapping }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Zuordnungsdatei prüfen (verständliche Meldungen, höchstens 20). Wirft nie. */
export function parseEatingOutMapping(data: unknown): EatingOutMappingParse {
  const parsed = eatingOutMappingSchema.safeParse(data);
  if (parsed.success) return { ok: true, mapping: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues
      .slice(0, 20)
      .map((issue) => `${issue.path.join('.') || '(Datei)'}: ${issue.message}`),
  };
}

/** Gerichte der Zuordnung in der Form der Rechnung (`[Katalog-ID, Gramm]`). */
export function eatingOutDishesFromMapping(
  mapping: Pick<EatingOutMapping, 'dishes'>,
): EatingOutDishDef[] {
  return mapping.dishes.map((dish) => ({
    id: dish.id,
    name_de: dish.name_de,
    category: dish.category,
    portion: dish.portion,
    basis_de: dish.basis_de,
    items: dish.items.map((item) => [item.food_id, item.g] as const),
    source_de: dish.source_de,
    ...(dish.note_de === undefined ? {} : { note_de: dish.note_de }),
    status: dish.status,
    ...(dish.reviewed_by === undefined ? {} : { reviewed_by: dish.reviewed_by }),
    ...(dish.reviewed_at === undefined ? {} : { reviewed_at: dish.reviewed_at }),
  }));
}

/** Noch zu importierende Lebensmittel der Zuordnung (für Inhaltsstand und Hinweise). */
export function eatingOutPendingFoodsFromMapping(
  mapping: Pick<EatingOutMapping, 'foods'>,
): EatingOutMissingFood[] {
  return mapping.foods.map((food) => ({
    food_id: food.food_id,
    name_de: food.name_de,
    search_de: food.source.search,
    source_ref: food.source.ref,
  }));
}

const loaded = parseEatingOutMapping(rawMapping);

/**
 * Fehler beim Laden der eingecheckten Zuordnung (leer = gültig). Ungültig → keine Gerichte (Reiter zeigt den
 * Leer-Zustand) statt falscher Werte; content:validate blockiert eine solche Datei ohnehin.
 */
export const EATING_OUT_MAPPING_ERRORS: readonly string[] = loaded.ok ? [] : loaded.errors;

/** Alle Gerichte (Entwürfe und freigegebene) aus der Zuordnungsdatei. */
export const EATING_OUT_DISHES: readonly EatingOutDishDef[] = loaded.ok
  ? eatingOutDishesFromMapping(loaded.mapping)
  : [];

/** Lebensmittel, die die Gerichte brauchen und die über `foods-import` in den Katalog kommen sollen. */
export const EATING_OUT_PENDING_FOODS: readonly EatingOutMissingFood[] = loaded.ok
  ? eatingOutPendingFoodsFromMapping(loaded.mapping)
  : [];
