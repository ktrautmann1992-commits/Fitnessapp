import { z } from 'zod';

import { isoDateSchema } from '../age';
import { MEAL_SLOT_TIMES, RECIPE_SCHEMA_LIMITS, RECIPE_SERVINGS_PICKER } from '../constants';
import {
  SHOPPING_CATEGORIES,
  SOURCE_DATABASES,
  type ShoppingCategory,
  type SourceDatabase,
} from '../content/food-schema';
import type { MealPlanSlotKey } from '../nutrition/meal-plan';
import type { ShoppingUnit } from '../nutrition/shopping-list';
import type { MealSlotId } from '../nutrition/timing';
import { RECIPE_UNITS, type RecipeUnit } from '../nutrition/units';
import { printDataValueSchema } from './print-values';

/**
 * Text-Codes der Ernährungs-Dokumente (docs/PLAN-PHASE-5.md 11, Etappe N6 – PDF P5): Essensplan und Einkaufsliste.
 * Wie beim Trainingsplan nur Codes und Daten (B11), die App übersetzt sie.
 *
 * Datenschutz (11 „Nichts Verräterisches“, K4): Kein Code kennt Ziele, Gründe, Unverträglichkeiten, Flags,
 * Schwangerschaft, Gewicht oder Alter. Die einzigen personenbezogenen Spuren sind die bewusst gedruckten Ersatz- und
 * Weglass-Hinweise der Rezepte (K4) und der optionale Name.
 */

export const NUTRITION_PRINT_DOCUMENTS = ['nutrition_plan', 'shopping_list'] as const;
export type NutritionPrintDocument = (typeof NUTRITION_PRINT_DOCUMENTS)[number];

/** Nährwert-Quelle für die Namensnennung im PDF-Fuß (S13, CC BY 4.0). */
export interface PrintNutrientSource {
  readonly db: SourceDatabase;
  readonly version: string;
  readonly license: string;
}

/** Zeilen der Wochenübersicht: Mahlzeiten-Plätze; beide Ergänzungs-Snacks teilen eine Zeile. */
export type PrintMealRow = MealSlotId | 'extra';

export const PRINT_MEAL_MARKS = ['fill', 'leftover', 'cook'] as const;
export type PrintMealMark = (typeof PRINT_MEAL_MARKS)[number];

type Empty = Record<string, never>;

export interface NutritionPrintTextParams {
  'nutrition.doc.title': { document: NutritionPrintDocument };
  /** Fußzeile jeder Seite; beim Essensplan mit Namensnennung der Nährwert-Quellen (S13). */
  'nutrition.doc.footer': {
    document: NutritionPrintDocument;
    sources: readonly PrintNutrientSource[];
    /** Beispiel-Rezepte mit Testwerten (Testmodus) – statt einer Quelle „Testwerte“. */
    testValues: boolean;
  };
  'nutrition.cover.heading': { document: NutritionPrintDocument };
  'nutrition.label.week': Empty;
  'nutrition.label.range': Empty;
  /** Anleitung; `numbers` = Tagessummen werden gedruckt. */
  'nutrition.howTo': { document: NutritionPrintDocument; numbers: boolean };
  'nutrition.notice.title': Empty;
  /** „Alpha5 ersetzt keine ärztliche oder ernährungsfachliche Beratung.“ – auf jedem Dokument, für alle gleich. */
  'nutrition.notice.medical': Empty;
  /** Spuren + HFI/Zöliakie (5.1.2) – für alle gleich. */
  'nutrition.notice.products': Empty;
  'nutrition.notice.testValues': Empty;
  /** 16 B (i): Entwürfe – Allergen-Angaben noch nicht freigegeben. */
  'nutrition.notice.draftAllergens': Empty;
  'mealplan.week.heading': { continued: boolean };
  'mealplan.col.slot': Empty;
  'mealplan.col.day': { date: string };
  'mealplan.slot': { slot: PrintMealRow };
  'mealplan.portion': { factor: number };
  'mealplan.mark': { mark: PrintMealMark };
  'mealplan.cell.none': Empty;
  /** Platz ohne Rezept – bewusst OHNE Grund (kein Rückschluss auf Unverträglichkeiten). */
  'mealplan.cell.noRecipe': Empty;
  'mealplan.row.day': { numbers: boolean };
  /** `below_floor`: Hinweis statt Zahl (6.3). */
  'mealplan.cell.belowFloor': Empty;
  'value.kcal': { kcal: number };
  'mealplan.legend': {
    numbers: boolean;
    hasFill: boolean;
    hasLeftover: boolean;
    hasCook: boolean;
    hasBelowFloor: boolean;
    hasNoRecipe: boolean;
  };
  'recipe.continued': { recipe: string };
  'recipe.label.inPlan': Empty;
  'recipe.inPlan': { uses: readonly { date: string; slot: MealPlanSlotKey }[] };
  'recipe.label.time': Empty;
  'recipe.time': { prep: number; cook: number };
  'recipe.mark.aiDraft': Empty;
  'recipe.ingredients': Empty;
  'recipe.col.ingredient': Empty;
  /** Spalte je Portionsgröße mit den Wochentagen, an denen sie gilt. */
  'recipe.col.portion': { factor: number; weekdays: readonly number[] };
  /** Zutat; `original` = Ersatzprodukt statt … (K4, bewusst gedruckt). */
  'recipe.ingredient': {
    food: string;
    original: string | null;
    optional: boolean;
    note: string | null;
  };
  'value.amount': { amount: number; unit: RecipeUnit };
  /** Weggelassene optionale Zutaten (S3) – wie der Ersatz-Hinweis bewusst gedruckt (K4). */
  'recipe.omitted': { foods: readonly string[] };
  'recipe.steps': Empty;
  'recipe.equipment': { items: readonly string[] };
  'recipe.storage': { fridgeDays: number; freezable: boolean };
  'shopping.category': { category: ShoppingCategory };
  'shopping.pantry': Empty;
  /** Eintrag der Einkaufsliste – Einkaufsmenge, nie kcal. */
  'shopping.item': {
    amount: number | null;
    unit: ShoppingUnit | null;
    label: string;
    manual: boolean;
    /** Lebensmittel für die Einkaufs-Einheit (`shoppingBuyHint`), eigene Einträge null. */
    foodId?: string | null;
  };
  'shopping.recipes': { recipes: readonly { title: string; servings: number }[] };
  'shopping.empty': Empty;
}

const empty = z.strictObject({});
const docSchema = z.enum(NUTRITION_PRINT_DOCUMENTS);
const slotIds = Object.keys(MEAL_SLOT_TIMES) as MealSlotId[];
const slotKeySchema = z.enum(['extra_1', 'extra_2', ...slotIds] as [
  MealPlanSlotKey,
  ...MealPlanSlotKey[],
]);
const factorSchema = z.number().finite().min(0).max(20);
const weekdaysSchema = z.array(z.number().int().min(1).max(7)).max(7);
const shortData = printDataValueSchema.max(200);

/** Parameter-Schemas der Ernährungs-Codes (Teil von PARAM_SCHEMAS in document.ts). */
export const NUTRITION_PARAM_SCHEMAS = {
  'nutrition.doc.title': z.strictObject({ document: docSchema }),
  'nutrition.doc.footer': z.strictObject({
    document: docSchema,
    sources: z
      .array(
        z.strictObject({
          db: z.enum(SOURCE_DATABASES),
          version: printDataValueSchema.max(40),
          license: printDataValueSchema.max(200),
        }),
      )
      .max(SOURCE_DATABASES.length * 2),
    testValues: z.boolean(),
  }),
  'nutrition.cover.heading': z.strictObject({ document: docSchema }),
  'nutrition.label.week': empty,
  'nutrition.label.range': empty,
  'nutrition.howTo': z.strictObject({ document: docSchema, numbers: z.boolean() }),
  'nutrition.notice.title': empty,
  'nutrition.notice.medical': empty,
  'nutrition.notice.products': empty,
  'nutrition.notice.testValues': empty,
  'nutrition.notice.draftAllergens': empty,
  'mealplan.week.heading': z.strictObject({ continued: z.boolean() }),
  'mealplan.col.slot': empty,
  'mealplan.col.day': z.strictObject({ date: isoDateSchema }),
  'mealplan.slot': z.strictObject({
    slot: z.enum(['extra', ...slotIds] as [PrintMealRow, ...PrintMealRow[]]),
  }),
  'mealplan.portion': z.strictObject({ factor: factorSchema }),
  'mealplan.mark': z.strictObject({ mark: z.enum(PRINT_MEAL_MARKS) }),
  'mealplan.cell.none': empty,
  'mealplan.cell.noRecipe': empty,
  'mealplan.row.day': z.strictObject({ numbers: z.boolean() }),
  'mealplan.cell.belowFloor': empty,
  'value.kcal': z.strictObject({ kcal: z.number().int().min(0).max(20_000) }),
  'mealplan.legend': z.strictObject({
    numbers: z.boolean(),
    hasFill: z.boolean(),
    hasLeftover: z.boolean(),
    hasCook: z.boolean(),
    hasBelowFloor: z.boolean(),
    hasNoRecipe: z.boolean(),
  }),
  'recipe.continued': z.strictObject({ recipe: shortData }),
  'recipe.label.inPlan': empty,
  'recipe.inPlan': z.strictObject({
    uses: z
      .array(z.strictObject({ date: isoDateSchema, slot: slotKeySchema }))
      .min(1)
      .max(7 * 10),
  }),
  'recipe.label.time': empty,
  'recipe.time': z.strictObject({
    prep: z.number().int().min(0).max(RECIPE_SCHEMA_LIMITS.prepMinutes.max),
    cook: z.number().int().min(0).max(RECIPE_SCHEMA_LIMITS.cookMinutes.max),
  }),
  'recipe.mark.aiDraft': empty,
  'recipe.ingredients': empty,
  'recipe.col.ingredient': empty,
  'recipe.col.portion': z.strictObject({ factor: factorSchema, weekdays: weekdaysSchema }),
  'recipe.ingredient': z.strictObject({
    food: shortData,
    original: shortData.nullable(),
    optional: z.boolean(),
    note: shortData.nullable(),
  }),
  'value.amount': z.strictObject({
    amount: z.number().finite().min(0).max(1_000_000),
    unit: z.enum(RECIPE_UNITS),
  }),
  'recipe.omitted': z.strictObject({
    foods: z.array(shortData).min(1).max(RECIPE_SCHEMA_LIMITS.ingredients.max),
  }),
  'recipe.steps': empty,
  'recipe.equipment': z.strictObject({
    items: z.array(shortData).min(1).max(RECIPE_SCHEMA_LIMITS.equipment),
  }),
  'recipe.storage': z.strictObject({
    fridgeDays: z.number().int().min(0).max(30),
    freezable: z.boolean(),
  }),
  'shopping.category': z.strictObject({ category: z.enum(SHOPPING_CATEGORIES) }),
  'shopping.pantry': empty,
  'shopping.item': z.strictObject({
    amount: z.number().finite().min(0).max(1_000_000).nullable(),
    unit: z.enum(['g', 'ml', 'piece']).nullable(),
    label: shortData,
    manual: z.boolean(),
    foodId: z.string().max(100).nullable().optional(),
  }),
  'shopping.recipes': z.strictObject({
    recipes: z
      .array(
        z.strictObject({
          title: shortData,
          servings: z
            .number()
            .int()
            .min(RECIPE_SERVINGS_PICKER.min)
            .max(RECIPE_SERVINGS_PICKER.max),
        }),
      )
      .min(1)
      .max(100),
  }),
  'shopping.empty': empty,
} satisfies {
  [K in keyof NutritionPrintTextParams]: z.ZodType<NutritionPrintTextParams[K]>;
};
