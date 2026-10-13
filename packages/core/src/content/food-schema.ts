import { z } from 'zod';

import { isoDateSchema } from '../age';
import { CONTENT_SCHEMA_LIMITS, FOOD_SCHEMA_LIMITS, MEAL_PREP_FRIDGE_DAYS } from '../constants';
import { CONTENT_STATUSES } from '../enums';
import { foodGroupSchema } from '../food-groups';
import { contentIdSchema, contentMetaSchema } from './schemas';

/**
 * Lebensmittel-Katalog `content/foods/<id>.json` (docs/PLAN-PHASE-5.md 5.1) – Regel R1 („Schema korrekt“, rot
 * auch bei Entwürfen). Nährwerte und Quell-ID kommen NIE von der KI, sondern maschinell aus der Quelldatenbank
 * (Etappe N2b, Regel R17). Neue Aufzählungen bleiben bis N7 außerhalb von `enums.ts` (S8).
 */

/** Supermarkt-Abteilungen in fester Reihenfolge (Plan 5.5). */
export const SHOPPING_CATEGORIES = [
  'fruit_vegetables',
  'bread_bakery',
  'chilled_dairy_eggs',
  'chilled_plant_based',
  'meat_sausage',
  'fish',
  'pasta_rice_grains',
  'legumes_canned',
  'cereal_breakfast',
  'nuts_seeds_dried_fruit',
  'oils_vinegar_sauces',
  'spices_baking',
  'frozen',
  'drinks',
  'other',
] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const SHOPPING_CATEGORY_LABELS_DE: Readonly<Record<ShoppingCategory, string>> = {
  fruit_vegetables: 'Obst & Gemüse',
  bread_bakery: 'Brot & Backwaren',
  chilled_dairy_eggs: 'Kühlregal: Milchprodukte & Eier',
  chilled_plant_based: 'Kühlregal: vegetarisch/vegan',
  meat_sausage: 'Fleisch & Wurst',
  fish: 'Fisch',
  pasta_rice_grains: 'Nudeln, Reis & Getreide',
  legumes_canned: 'Hülsenfrüchte & Konserven',
  cereal_breakfast: 'Müsli & Frühstück',
  nuts_seeds_dried_fruit: 'Nüsse, Samen & Trockenfrüchte',
  oils_vinegar_sauces: 'Öle, Essig & Saucen',
  spices_baking: 'Gewürze & Backzutaten',
  frozen: 'Tiefkühl',
  drinks: 'Getränke',
  other: 'Sonstiges',
};

/**
 * Tierische Bestandteile (Plan 5.1, S5). Leer = pflanzlich.
 * ACHTUNG: Hier heißt es `'egg'` (Bestandteil), in `FOOD_GROUPS` dagegen `'eggs'` (Allergen-Gruppe) – bewusst
 * getrennt (Wächter N0). Regel R18 prüft, dass `animal: ['egg']` und die Gruppe `eggs` zusammenpassen.
 */
export const ANIMAL_KINDS = [
  'dairy',
  'egg',
  'honey',
  'meat',
  'fish',
  'shellfish',
  'gelatin',
  'animal_rennet',
  'insect',
] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

/** Tierart bei Fleisch (Speck, Schmalz, Wurst brauchen einen Eintrag). `unknown` zählt als Schwein (S5). */
export const MEAT_KINDS = ['pork', 'beef', 'poultry', 'lamb', 'game', 'unknown'] as const;
export type MeatKind = (typeof MEAT_KINDS)[number];

/** Herkunft der Gelatine; fehlt sie, gilt `unknown` = Schwein (S5). */
export const GELATIN_ORIGINS = ['pork', 'beef', 'fish', 'unknown'] as const;
export type GelatinOrigin = (typeof GELATIN_ORIGINS)[number];

/** Quelldatenbanken (Plan 5.1, S13). Welche Hauptquelle gilt, entscheidet die Lizenzklärung vor N2b. */
export const SOURCE_DATABASES = ['bls', 'ch_naehrwertdatenbank', 'usda_fdc'] as const;
export type SourceDatabase = (typeof SOURCE_DATABASES)[number];

/**
 * Lebensmittelgruppe der Quelle, neutral (Plan 5.1.3 „Quell-Lebensmittelgruppe“). Der Import (N2b) übersetzt die
 * Gruppe der Hauptquelle (beim BLS die Hauptgruppe aus dem ersten Zeichen des BLS-Schlüssels, sonst die Kategorie
 * der Quelle) mit einer zitierten Zuordnungstabelle in diese Werte; Regel R18 leitet daraus Pflichtgruppen ab
 * (`SOURCE_CATEGORY_RULES` in `allergen-rules.ts`).
 */
export const SOURCE_FOOD_CATEGORIES = [
  'bread_bakery',
  'cereal_products',
  'pastries_sweets',
  'fruit',
  'vegetables',
  'potatoes_starch',
  'mushrooms',
  'legumes',
  'soy_products',
  'nuts_seeds',
  'dairy',
  'eggs',
  'fats_oils',
  'fish',
  'crustaceans_molluscs',
  'meat_beef_veal',
  'meat_pork',
  'meat_lamb',
  'meat_poultry',
  'meat_game',
  'offal',
  'sausage_meat_products',
  'spices_sauces',
  'sugar_sweets',
  'beverages',
  'alcoholic_beverages',
  'composite_dishes',
  'other',
] as const;
export type SourceFoodCategory = (typeof SOURCE_FOOD_CATEGORIES)[number];

/** Text ohne Leerraum am Anfang/Ende, Länge in Zeichen. */
function text(min: number, max: number) {
  return z
    .string()
    .min(min, `Mindestens ${min} Zeichen.`)
    .max(max, `Höchstens ${max} Zeichen.`)
    .refine((value) => value === value.trim(), 'Kein Leerzeichen am Anfang oder Ende.');
}

function distinct<T extends z.ZodType>(item: T, max: number, min = 0) {
  return z
    .array(item)
    .min(min)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Doppelte Einträge.');
}

const L = FOOD_SCHEMA_LIMITS;
const grams = z.number().finite().min(L.gramsPer100g.min).max(L.gramsPer100g.max);
const positiveIn = (limits: { min: number; max: number }) =>
  z.number().finite().min(limits.min).max(limits.max);

/**
 * Pflicht-Nährwerte: ohne Zahlenwert in der Quelle wird die Zeile NICHT übernommen (nie geraten). Energie, Makros
 * und Salz tragen Energie-Planband, Makro-Ziele und die Salz-Grenze (R11).
 */
export const REQUIRED_NUTRIENT_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'salt_g'] as const;

/**
 * Ergänzende Nährwerte (Import-Lauf 1, PR #47, docs/PLAN-PHASE-5.md N2b): Nennt die Quelle hier keinen Zahlenwert
 * („-“ oder leer = nicht bestimmt), steht `null` – NIE eine Schätzung, auch nicht 0. Summen über Zutaten werden
 * dann ebenfalls `null` („unbekannt“), siehe `addOptionalNutrient`.
 * Davon getrennt: „<LOD“/„<LOQ“/„TR“ (gemessen, unter Nachweis-/Bestimmungsgrenze) ist KEIN fehlender Wert – der
 * Import liest es seit der Gründer-Entscheidung vom 13.10.2026 als 0 (`source-rows.ts`), auch bei Pflichtwerten.
 */
export const OPTIONAL_NUTRIENT_KEYS = ['sugar_g', 'sat_fat_g', 'fiber_g'] as const;
export type OptionalNutrientKey = (typeof OPTIONAL_NUTRIENT_KEYS)[number];

/**
 * Energieliefernde Bestandteile, die NUR die Atwater-Prüfung R4 braucht (LMIV Anhang XIV): organische Säuren,
 * Alkohol und mehrwertige Alkohole (Polyole, in den Kohlenhydraten enthalten). Fehlt die Spalte in der Quelle,
 * fehlt das Feld; nennt die Quelle keinen Zahlenwert, steht `null`. Keine Verwendung im Essensplan.
 */
export const ENERGY_EXTRA_KEYS = ['organic_acids_g', 'alcohol_g', 'polyols_g'] as const;
export type EnergyExtraKey = (typeof ENERGY_EXTRA_KEYS)[number];

/**
 * Summe zweier ergänzender Nährwerte: unbekannt (`null`) bleibt unbekannt – eine Summe mit einer fehlenden Zutat
 * wäre eine stille Schätzung (Untergrenze) und wird deshalb nie als Zahl ausgegeben.
 */
export function addOptionalNutrient(sum: number | null, add: number | null): number | null {
  return sum === null || add === null ? null : sum + add;
}

const optionalGrams = grams.nullable();

/** Nährwerte je 100 g (Plan 5.1). Stimmen mit dem Quellauszug überein (Regel R17). */
export const nutrientsPer100gSchema = z
  .strictObject({
    kcal: z.number().finite().min(L.kcalPer100g.min).max(L.kcalPer100g.max),
    protein_g: grams,
    carbs_g: grams,
    sugar_g: optionalGrams,
    fat_g: grams,
    sat_fat_g: optionalGrams,
    fiber_g: optionalGrams,
    salt_g: grams,
    organic_acids_g: optionalGrams.optional(),
    alcohol_g: optionalGrams.optional(),
    polyols_g: optionalGrams.optional(),
  })
  .superRefine((n, ctx) => {
    if (n.sugar_g !== null && n.sugar_g > n.carbs_g) {
      ctx.addIssue({
        code: 'custom',
        path: ['sugar_g'],
        message: 'Zucker größer als Kohlenhydrate.',
      });
    }
    if (n.sat_fat_g !== null && n.sat_fat_g > n.fat_g) {
      ctx.addIssue({
        code: 'custom',
        path: ['sat_fat_g'],
        message: 'Gesättigte Fettsäuren größer als Fett.',
      });
    }
    // Obergrenzen-Prüfung: fehlende Ballaststoffe zählen hier nicht mit (die Summe wird dadurch nur kleiner).
    const sum = n.protein_g + n.carbs_g + n.fat_g + (n.fiber_g ?? 0);
    if (sum > 100 + L.macroSumToleranceG) {
      ctx.addIssue({
        code: 'custom',
        path: ['protein_g'],
        message: `Eiweiß + Kohlenhydrate + Fett + Ballaststoffe = ${sum} g – mehr als 100 g je 100 g.`,
      });
    }
  });
export type NutrientsPer100g = z.infer<typeof nutrientsPer100gSchema>;

/** Umrechnung in Gramm (Plan 5.1, `units.ts`). */
export const foodUnitsSchema = z.strictObject({
  piece_g: positiveIn(L.pieceG).optional(),
  tbsp_g: positiveIn(L.tbspG).optional(),
  tsp_g: positiveIn(L.tspG).optional(),
  ml_to_g: positiveIn(L.mlToG).optional(),
});

/** Ersatzprodukt (S4): `for_groups` nennt nur Gruppen, die das Ersatzprodukt WIRKLICH nicht enthält (R18). */
export const foodSubstituteSchema = z.strictObject({
  food_id: contentIdSchema,
  for_groups: distinct(foodGroupSchema, 23, 1),
});
export type FoodSubstitute = z.infer<typeof foodSubstituteSchema>;

/** Herkunft der Nährwerte (Plan 5.1, B6a, S13) – vom Import geschrieben, nie von Hand oder per KI. */
export const foodSourceSchema = z.strictObject({
  db: z.enum(SOURCE_DATABASES),
  version: text(1, 40),
  /** Quell-ID (z. B. BLS-Schlüssel). */
  ref: text(1, 40),
  /** Bezeichnung des Lebensmittels in der Quelle (R18 prüft sie mit, Plan 5.1.3). */
  name: text(2, 200),
  /** Lebensmittelgruppe der Quelle, neutral übersetzt (R18). */
  category: z.enum(SOURCE_FOOD_CATEGORIES),
  license: text(2, 200),
  retrieved_at: isoDateSchema,
});
export type FoodSource = z.infer<typeof foodSourceSchema>;

/**
 * Herkunft/Prüfung wie bei allen Inhalten plus Katalog-Prüfung (R19): `catalog_reviewed_by/at` setzt nur der
 * Workflow `content-review` mit der Option „Katalog geprüft“ (R2-K6, Prüfung in CI ab N2b).
 */
export const foodMetaSchema = z
  .strictObject({
    ...contentMetaSchema.shape,
    catalog_reviewed_by: text(1, 100).nullable(),
    catalog_reviewed_at: isoDateSchema.nullable(),
  })
  .superRefine((meta, ctx) => {
    const base = contentMetaSchema.safeParse({
      origin: meta.origin,
      model: meta.model,
      batch_id: meta.batch_id,
      created_on: meta.created_on,
      expert_reviewed: meta.expert_reviewed,
      reviewed_by: meta.reviewed_by,
      reviewed_at: meta.reviewed_at,
      review_note: meta.review_note,
    });
    if (!base.success) {
      for (const issue of base.error.issues) {
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      }
    }
    if ((meta.catalog_reviewed_by === null) !== (meta.catalog_reviewed_at === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['catalog_reviewed_at'],
        message: 'Katalog-Prüfer und Prüfdatum nur gemeinsam angeben.',
      });
    }
  });
export type FoodMeta = z.infer<typeof foodMetaSchema>;

/** true = Lebensmittel hat die menschliche Katalog-Prüfung (R19). */
export function isCatalogReviewed(food: { meta: FoodMeta }): boolean {
  return food.meta.catalog_reviewed_by !== null && food.meta.catalog_reviewed_at !== null;
}

export const foodSchema = z
  .strictObject({
    id: contentIdSchema,
    version: z
      .number()
      .int('Ganze Zahl erwartet.')
      .min(CONTENT_SCHEMA_LIMITS.version.min)
      .max(CONTENT_SCHEMA_LIMITS.version.max),
    status: z.enum(CONTENT_STATUSES),
    name_de: text(2, 100),
    name_de_plural: text(2, 100).optional(),
    aliases_de: distinct(text(2, 100), L.aliases),
    shopping_category: z.enum(SHOPPING_CATEGORIES),
    pantry: z.boolean(),
    nutrients_per_100g: nutrientsPer100gSchema,
    units: foodUnitsSchema,
    groups: distinct(foodGroupSchema, 23),
    animal: distinct(z.enum(ANIMAL_KINDS), ANIMAL_KINDS.length),
    meat_kind: distinct(z.enum(MEAT_KINDS), MEAT_KINDS.length),
    gelatin_origin: z.enum(GELATIN_ORIGINS).optional(),
    pregnancy_caution: z.boolean(),
    alcohol: z.boolean(),
    max_fridge_days: z.number().int('Ganze Zahl erwartet.').min(0).max(MEAL_PREP_FRIDGE_DAYS.max),
    freezable: z.boolean(),
    substitutes: z.array(foodSubstituteSchema).max(L.substitutes),
    source: foodSourceSchema,
    meta: foodMetaSchema,
  })
  .superRefine((food, ctx) => {
    const hasMeat = food.animal.includes('meat');
    if (hasMeat !== food.meat_kind.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['meat_kind'],
        message: hasMeat
          ? 'Fleisch ohne Tierart: „meat_kind“ angeben (unbekannt = „unknown“).'
          : '„meat_kind“ nur bei tierischem Bestandteil „meat“.',
      });
    }
    if (food.gelatin_origin !== undefined && !food.animal.includes('gelatin')) {
      ctx.addIssue({
        code: 'custom',
        path: ['gelatin_origin'],
        message: '„gelatin_origin“ nur bei tierischem Bestandteil „gelatin“.',
      });
    }
    const substituteIds = food.substitutes.map((s) => s.food_id);
    if (substituteIds.includes(food.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['substitutes'],
        message: 'Ein Lebensmittel kann nicht sein eigener Ersatz sein.',
      });
    }
    if (new Set(substituteIds).size !== substituteIds.length) {
      ctx.addIssue({ code: 'custom', path: ['substitutes'], message: 'Ersatzprodukt doppelt.' });
    }
    if (food.status === 'published' && food.meta.reviewed_by === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['meta', 'reviewed_by'],
        message: 'Freigegeben ohne Prüfer: bitte „reviewed_by“ und „reviewed_at“ eintragen.',
      });
    }
  });
export type Food = z.infer<typeof foodSchema>;

/** Nachschlagen von Lebensmitteln nach ID. */
export type FoodLookup = ReadonlyMap<string, Food>;

// ---------------------------------------------------------------------------------------------------------
// Begleitdateien des Katalogs (Plan 5.1.1 b/c): Quellauszug, Erwartungsliste, Ausnahmeliste
// ---------------------------------------------------------------------------------------------------------

/**
 * Eine Zeile des Quellauszugs nach dem Einlesen (Regel R17). Das Einlesen von `extract.csv` (Spalten der Quelle,
 * Einheitenumrechnung z. B. USDA Natrium → Salz) kommt mit dem Import in N2b; der Vergleich hier ist rein.
 */
export const sourceNutrientRowSchema = z.strictObject({
  db: z.enum(SOURCE_DATABASES),
  version: text(1, 40),
  ref: text(1, 40),
  name: text(2, 200),
  nutrients_per_100g: nutrientsPer100gSchema,
});
export type SourceNutrientRow = z.infer<typeof sourceNutrientRowSchema>;

/** Schlüssel einer Quellzeile: Datenbank, Version und Quell-ID. */
export function sourceRowKey(source: Pick<FoodSource, 'db' | 'version' | 'ref'>): string {
  return `${source.db}|${source.version}|${source.ref}`;
}

/**
 * Erwartungsliste `content/foods/allergen-expectations.json` (R2-S1): Gruppen je `food_id`, bei der Katalog-
 * Prüfung (R19) von Menschen bestätigt. Pflichtgruppen dürfen am Lebensmittel nicht fehlen; zusätzliche erlaubt.
 */
export const allergenExpectationsSchema = z.record(contentIdSchema, distinct(foodGroupSchema, 23));
export type AllergenExpectations = z.infer<typeof allergenExpectationsSchema>;

/** Regeln, für die eine Ausnahme möglich ist (Gruppen und Zusatzregeln aus `allergen-rules.ts`). */
export const ALLERGEN_EXTRA_RULES = [
  'pork',
  'meat',
  'gelatin',
  'mixed_mince',
  'pregnancy_caution',
  'alcohol',
  // Gruppe/Wort ⇒ tierischer Bestandteil (Wächter N2a, B1): sonst wäre Lachs ohne `animal` „vegan“.
  'animal_egg',
  'animal_fish',
  'animal_shellfish',
  'animal_dairy',
  'animal_honey',
  'animal_rennet',
  'animal_insect',
] as const;
export type AllergenExtraRule = (typeof ALLERGEN_EXTRA_RULES)[number];

/**
 * Eingecheckte Ausnahmeliste (Plan 5.1.1 c, 5.1.3): hebt eine Pflichtregel für ein Lebensmittel auf – nur mit
 * Begründung UND Quelle (z. B. „glutenfrei“ laut Hersteller-/Quellangabe, „ungeschwefelt“).
 */
export const allergenExceptionSchema = z.strictObject({
  food_id: contentIdSchema,
  rule: z.union([foodGroupSchema, z.enum(ALLERGEN_EXTRA_RULES)]),
  reason: text(10, 300),
  source: text(5, 300),
});
export type AllergenException = z.infer<typeof allergenExceptionSchema>;
export const allergenExceptionsSchema = z
  .array(allergenExceptionSchema)
  .refine(
    (list) => new Set(list.map((e) => `${e.food_id}|${e.rule}`)).size === list.length,
    'Ausnahme doppelt.',
  );
