/**
 * Zuordnung Zutat → Quell-Eintrag (docs/PLAN-PHASE-5.md 19.3, Etappe N2b).
 *
 * Die Datei `content/food-mapping/alpha5-zuordnung.json` ist ein VORSCHLAG aus einer Claude-Code-Sitzung
 * (Status „unbestaetigt“): Quell-ID bzw. Suchbegriffe, Rohzustand, Name, Aliase, Abteilung, Gruppen, tierische
 * Bestandteile, Haltbarkeit – mit Begründung. Sie enthält NIE Nährwerte (Schema verbietet sie). Die Werte
 * schreibt ausschließlich `foods-import` aus dem Quellauszug in `content/foods/` (einzige Schreibstelle, S3).
 * Menschen korrigieren die Zuordnung per Pull Request in DIESER Datei; die Katalog-Prüfung (R19) bestätigt sie.
 */
import {
  ANIMAL_KINDS,
  contentIdSchema,
  foodGroupSchema,
  foodSubstituteSchema,
  foodUnitsSchema,
  GELATIN_ORIGINS,
  isoDateSchema,
  MEAT_KINDS,
  SHOPPING_CATEGORIES,
  SOURCE_DATABASES,
  SOURCE_FOOD_CATEGORIES,
} from '@fitnessapp/core';
import { z } from 'zod';

/** Zutat-IDs der Gründer-Datei, die als Katalog-ID nicht passen (contentIdSchema: mindestens 3 Zeichen). */
export const ALPHA5_ID_EXCEPTIONS: Readonly<Record<string, string>> = { ei: 'huehnerei' };

/** Ablage der Vorschlagsdatei (relativ zum Repository). */
export const FOOD_MAPPING_PATH = 'content/food-mapping/alpha5-zuordnung.json';

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

export const mappingSourceSchema = z.strictObject({
  db: z.enum(SOURCE_DATABASES),
  version: text(1, 40),
  /** Quell-ID (z. B. BLS-Schlüssel); null = noch nicht festgelegt (Kandidatensuche im Workflow). */
  ref: text(1, 40).nullable(),
  /** Suchbegriffe für die Kandidatensuche (alle Wörter eines Eintrags müssen im Quell-Namen vorkommen). */
  search: z.array(text(2, 80)).min(1).max(6),
  /** Gemeinter Zustand des Lebensmittels in der Quelle (roh, trocken, TK, abgetropft …). */
  state_de: text(2, 120),
  /** Lebensmittelgruppe der Quelle, neutral (R18). Vorschlag, bei R19 zu prüfen. */
  category: z.enum(SOURCE_FOOD_CATEGORIES),
});

export const mappingItemSchema = z.strictObject({
  /** `zutat_id` in alpha5-rezepte.json (Schlüssel für den Rezept-Import in N2c). */
  alpha5_id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  /**
   * ID des Lebensmittels im Katalog. Gleich `alpha5_id`, außer die ID passt nicht zu `contentIdSchema`
   * (z. B. „ei“ ist zu kurz → „huehnerei“); Ausnahmen stehen in `ALPHA5_ID_EXCEPTIONS`.
   */
  food_id: contentIdSchema,
  /** Name in alpha5-rezepte.json (zur Kontrolle). */
  alpha5_name: text(2, 120),
  source: mappingSourceSchema,
  name_de: text(2, 100),
  aliases_de: distinct(text(2, 100), 8),
  shopping_category: z.enum(SHOPPING_CATEGORIES),
  pantry: z.boolean(),
  units: foodUnitsSchema,
  /** Erwartete Allergen-/Unverträglichkeits-Gruppen (wird zur Erwartungsliste, R18; bei R19 bestätigt). */
  groups: distinct(foodGroupSchema, 23),
  animal: distinct(z.enum(ANIMAL_KINDS), ANIMAL_KINDS.length),
  meat_kind: distinct(z.enum(MEAT_KINDS), MEAT_KINDS.length),
  gelatin_origin: z.enum(GELATIN_ORIGINS).optional(),
  pregnancy_caution: z.boolean(),
  alcohol: z.boolean(),
  max_fridge_days: z.number().int().min(0).max(3),
  freezable: z.boolean(),
  substitutes: z.array(foodSubstituteSchema).max(5),
  /** Begründung des Vorschlags (Zuordnung, Gruppen, Haltbarkeit). */
  reason_de: text(10, 600),
});
export type MappingItem = z.infer<typeof mappingItemSchema>;

export const foodMappingSchema = z
  .strictObject({
    format: z.literal('alpha5-food-mapping'),
    version: z.number().int().min(1),
    /** „unbestaetigt“ = KI-Vorschlag; bestätigt wird je Lebensmittel über die Katalog-Prüfung (R19). */
    status: z.enum(['unbestaetigt', 'teilweise_bestaetigt']),
    origin: z.literal('claude_session'),
    model: text(1, 100),
    created_on: isoDateSchema,
    note_de: text(10, 2000),
    items: z.array(mappingItemSchema).min(1),
  })
  .superRefine((file, ctx) => {
    const seen = new Set<string>();
    const seenAlpha5 = new Set<string>();
    file.items.forEach((item, index) => {
      if (seenAlpha5.has(item.alpha5_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'alpha5_id'],
          message: `„${item.alpha5_id}“ doppelt.`,
        });
      }
      seenAlpha5.add(item.alpha5_id);
      const expectedId = ALPHA5_ID_EXCEPTIONS[item.alpha5_id] ?? item.alpha5_id;
      if (item.food_id !== expectedId) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'food_id'],
          message: `Lebensmittel-ID „${item.food_id}“ ≠ Zutat-ID „${item.alpha5_id}“ (Ausnahmen nur über ALPHA5_ID_EXCEPTIONS).`,
        });
      }
      if (seen.has(item.food_id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'food_id'],
          message: `„${item.food_id}“ doppelt.`,
        });
      }
      seen.add(item.food_id);
      if (item.animal.includes('meat') !== item.meat_kind.length > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'meat_kind'],
          message: '„meat_kind“ genau dann, wenn „animal“ „meat“ enthält.',
        });
      }
    });
  });
export type FoodMapping = z.infer<typeof foodMappingSchema>;

/** Liest und prüft die Vorschlagsdatei (verständliche Meldung bei Fehlern). */
export function parseFoodMapping(data: unknown): FoodMapping {
  const parsed = foodMappingSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Zuordnungsdatei ungültig:\n${first.join('\n')}`);
  }
  return parsed.data;
}
