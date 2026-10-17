import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  FOOD_LOG_DEFAULT_SLOT_MINUTES,
  FOOD_LOG_LIMITS,
  FOOD_LOG_PORTION_CHOICES,
} from '../constants';
import { normalizeFoodText } from '../content/allergen-rules';
import type { Food, FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import { contentIdSchema } from '../content/schemas';
import { addDays, daysBetween } from '../dates';
import { barcodeSchema } from './barcode';
import { MEAL_PLAN_SLOT_KEYS } from './meal-plan-payload';
import type { PlannedMeal } from './meal-plan';
import { computeRecipeFacts, type RecipeNutrients } from './recipe-nutrients';
import { gramsPerUnit } from './units';

/**
 * Ernährungstagebuch (Etappe E1, docs/PLAN-AUSWERTUNG.md Abschnitt 5, KONZEPT 6.1): Was die Person als gegessen
 * einträgt – per Tipp aus dem Essensplan, aus dem Lebensmittel-Katalog, als Rezept, als Schnelleintrag oder aus
 * „Zuletzt“/„Favoriten“. Reine Logik ohne UI: Einträge bauen (Nährwerte immer hier gerechnet, nie in der App),
 * prüfen (Zod, strikt – dieselben Felder und Grenzen wie die Datenbank-Funktion save_food_log_entries), Tagessummen,
 * „Zuletzt gegessen“ und Favoriten.
 *
 * Datenschutz (Plan 2.7, A-G12): Tagebuch-Einträge sind vorsorglich Gesundheitsdaten (Art. 9) – nur mit gültiger
 * Einwilligung health_data, beim Widerruf gelöscht, nie in Logs oder Analytics. Favoriten sind KEIN Gesundheitsdatum
 * (A-G14) und bleiben beim Widerruf. Kein Freitext: Schnelleinträge haben eine Bezeichnung aus fester Liste.
 *
 * Sprache (Plan 2.4): keine Bewertung des Essens hier – nur Summen. Ziele/Zonen kommen erst mit A2.
 */

// ---------------------------------------------------------------------------------------------------------
// Werte-Listen (sync: CHECK-Listen in 20261015130000_food_log.sql, db-sync.test.ts)
// ---------------------------------------------------------------------------------------------------------

/**
 * Herkunft eines Eintrags. `custom_meal` seit Etappe E2 (eigenes Gericht), `photo` seit E3 (Bestandteil aus „Per
 * Foto“ – Form wie `food`, nur in Gramm, Werte aus dem Katalog), `product` seit E4a (Produkt per Barcode-Nummer aus
 * Open Food Facts bzw. eigenes Produkt – Menge in g/ml, Werte rechnet der Server aus dem Zwischenspeicher bzw. dem
 * eigenen Produkt nach, docs/PLAN-E4.md 3.5).
 */
export const FOOD_LOG_SOURCES = [
  'plan_item',
  'food',
  'recipe',
  'quick',
  'custom_meal',
  'photo',
  'product',
] as const;
export type FoodLogSource = (typeof FOOD_LOG_SOURCES)[number];

/** Plätze = Plätze des Essensplans + `other` (frei eingetragen, angezeigt unter „Snack“). */
export const FOOD_LOG_SLOTS = [...MEAL_PLAN_SLOT_KEYS, 'other'] as const;
export type FoodLogSlot = (typeof FOOD_LOG_SLOTS)[number];

/** Einheiten im Tagebuch (Katalog-Lebensmittel): Gramm, Milliliter (nur mit Umrechnung), Stück (nur mit Gewicht). */
export const FOOD_LOG_UNITS = ['g', 'ml', 'piece'] as const;
export type FoodLogUnit = (typeof FOOD_LOG_UNITS)[number];

/**
 * Bezeichnungen des Schnelleintrags (Plan 5 Nr. 4) – feste Auswahlliste, kein Freitext (2.7). Gespeichert wird der
 * deutsche Text als Schnappschuss (wie Rezept-Titel).
 */
export const QUICK_ENTRY_LABELS = [
  'Snack',
  'Auswärts gegessen',
  'Getränk',
  'Süßes',
  'Mahlzeit',
  'Sonstiges',
] as const;
export type QuickEntryLabel = (typeof QUICK_ENTRY_LABELS)[number];

/**
 * Titel eines Tagebuch-Eintrags aus einem eigenen Gericht (Etappe E2): immer dieser feste Text, NIE der Name des
 * Gerichts – das Tagebuch bleibt ohne Freitext (Plan 2.7, Wächter E1). Den Namen zeigt die App über
 * `custom_meal_id` aus den eigenen Gerichten an; ist das Gericht gelöscht, bleibt dieser neutrale Titel (sync: CHECK
 * in 20261015160000_custom_meals.sql).
 */
export const CUSTOM_MEAL_ENTRY_TITLE = 'Eigenes Gericht';

/**
 * Titel eines Tagebuch-Eintrags aus einem EIGENEN Produkt (Etappe E4a, Plan 3.4/3.5): immer dieser feste Text, nie der
 * Name oder die Marke, die die Person eingetippt hat (Freitext) – angezeigt wird der Name über `user_product_id`. Auch
 * nach dem Löschen des eigenen Produkts (beide Verweise leer). Sync: CHECK in 20261017100200_food_log_product.sql.
 */
export const USER_PRODUCT_ENTRY_TITLE = 'Eigenes Produkt';

/** Gruppen im Tagesverlauf (Plan 5): Frühstück, Hauptmahlzeit, Mittag, Abend, Snack. */
export const FOOD_LOG_GROUPS = ['breakfast', 'main', 'lunch', 'dinner', 'snack'] as const;
export type FoodLogGroup = (typeof FOOD_LOG_GROUPS)[number];

/** Plätze, die man beim freien Eintragen wählen kann (Frühstück, Mittag, Abend, Snack). */
export const FOOD_LOG_MANUAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'other'] as const;
export type FoodLogManualSlot = (typeof FOOD_LOG_MANUAL_SLOTS)[number];

/** Gruppe eines Platzes: Zwischenmahlzeiten, Ergänzungs-Snacks und `other` stehen unter „Snack“. */
export function foodLogGroup(slot: FoodLogSlot): FoodLogGroup {
  switch (slot) {
    case 'breakfast':
    case 'main':
    case 'lunch':
    case 'dinner':
      return slot;
    default:
      return 'snack';
  }
}

/**
 * Vorgeschlagener Platz beim freien Eintragen nach Uhrzeit (Minuten nach Mitternacht, Gerätezeit) – nur Vorbelegung,
 * jederzeit änderbar.
 */
export function defaultFoodLogSlot(minutes: number): FoodLogManualSlot {
  const m = Math.min(Math.max(Math.floor(minutes), 0), 24 * 60 - 1);
  const T = FOOD_LOG_DEFAULT_SLOT_MINUTES;
  if (m < T.breakfastUntil) return 'breakfast';
  if (m < T.lunchUntil) return 'lunch';
  if (m >= T.dinnerFrom && m < T.dinnerUntil) return 'dinner';
  return 'other';
}

// ---------------------------------------------------------------------------------------------------------
// Schemas (Zod, strikt) – Felder = Spalten von food_log_entries bzw. food_log_favorites
// ---------------------------------------------------------------------------------------------------------

const L = FOOD_LOG_LIMITS;

/** Zeichen in Code-Points zählen – wie char_length() in Postgres. */
function codePoints(text: string): number {
  return [...text].length;
}

const multipleOf = (step: number) => (value: number) =>
  Math.abs(Math.round(value / step) * step - value) < 1e-9;

const kcalSchema = z.number().int('Ganze kcal erwartet.').min(L.kcal.min).max(L.kcal.max);
const macroSchema = z
  .number()
  .min(L.macroG.min)
  .max(L.macroG.max)
  .refine(multipleOf(0.1), 'Höchstens eine Nachkommastelle.');
const titleSchema = z
  .string()
  .refine((v) => v.trim() === v && codePoints(v) >= 1 && codePoints(v) <= L.titleMaxChars, {
    message: 'Ungültige Bezeichnung.',
  });

const entryFields = {
  slot: z.enum(FOOD_LOG_SLOTS),
  source: z.enum(FOOD_LOG_SOURCES),
  food_id: contentIdSchema.nullable(),
  recipe_id: contentIdSchema.nullable(),
  /** Verweis auf das eigene Gericht (E2); null bei anderen Herkünften und nach dem Löschen des Gerichts. */
  custom_meal_id: z.uuid().nullable(),
  /**
   * E4a: Nummer des Produkts aus Open Food Facts (normalisiert, Prüfziffer gültig) bzw. Verweis auf ein eigenes Produkt
   * – nur bei Herkunft `product`, sonst null. Fehlen sie (Einträge älterer App-Fassungen), gelten sie als null.
   */
  product_code: barcodeSchema.nullable().default(null),
  user_product_id: z.uuid().nullable().default(null),
  title_de: titleSchema,
  amount: z.number().finite().nullable(),
  unit: z.enum(FOOD_LOG_UNITS).nullable(),
  portion: z.number().finite().nullable(),
  kcal: kcalSchema.nullable(),
  protein_g: macroSchema.nullable(),
  carbs_g: macroSchema.nullable(),
  fat_g: macroSchema.nullable(),
};

type EntryShape = {
  readonly slot?: FoodLogSlot;
  readonly source: FoodLogSource;
  readonly food_id: string | null;
  readonly recipe_id: string | null;
  /** Nur Einträge haben ihn (Favoriten nicht) – fehlt er, gilt null. */
  readonly custom_meal_id?: string | null;
  /** E4a: Produkt-Verweise (fehlen sie, gilt null). */
  readonly product_code?: string | null;
  readonly user_product_id?: string | null;
  readonly title_de: string;
  readonly amount: number | null;
  readonly unit: FoodLogUnit | null;
  readonly portion: number | null;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
};

/** true = Menge passt zur Einheit (g/ml 1–2.000 mit höchstens einer Nachkommastelle, Stück 0,5–20 in ½-Schritten). */
export function isValidFoodLogAmount(amount: number, unit: FoodLogUnit): boolean {
  if (!Number.isFinite(amount)) return false;
  if (unit === 'piece') {
    const P = L.amountPiece;
    return amount >= P.min && amount <= P.max && multipleOf(P.step)(amount);
  }
  return amount >= L.amountMass.min && amount <= L.amountMass.max && multipleOf(0.1)(amount);
}

/** true = Portion 0,25–3 in Viertel-Schritten. */
export function isValidFoodLogPortion(portion: number): boolean {
  return (
    Number.isFinite(portion) &&
    portion >= L.portion.min &&
    portion <= L.portion.max &&
    multipleOf(0.25)(portion)
  );
}

/**
 * Form je Herkunft (wie die CHECKs der Tabelle): Katalog = Lebensmittel + Menge + Einheit; Rezept/Plan-Mahlzeit =
 * Rezept + Portion; Schnelleintrag = Bezeichnung aus der festen Liste, kcal optional, Makros nur mit kcal. Werte
 * sind außer beim Schnelleintrag Pflicht (sie kommen aus Katalog/Rezept/Plan).
 */
function refineShape(
  value: EntryShape,
  ctx: z.RefinementCtx,
  mode: 'entry' | 'favorite' = 'entry',
): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const values = [value.kcal, value.protein_g, value.carbs_g, value.fat_g];
  // Favoriten aus Katalog/Rezept speichern KEINE Werte (Wächter E1 S1): die rechnet der Core beim Eintragen neu.
  const allValues =
    mode === 'favorite' ? values.every((v) => v === null) : values.every((v) => v !== null);
  if (value.source !== 'custom_meal' && (value.custom_meal_id ?? null) !== null) {
    issue('Verweis nur bei eigenem Gericht.');
  }
  const productCode = value.product_code ?? null;
  const userProductId = value.user_product_id ?? null;
  if (value.source !== 'product' && (productCode !== null || userProductId !== null)) {
    issue('Verweis nur bei Produkt.');
  }
  switch (value.source) {
    case 'food':
    case 'photo':
      // E3: Ein Bestandteil aus „Per Foto“ ist ein Katalog-Lebensmittel in Gramm (nie Favorit).
      if (value.source === 'photo' && (mode === 'favorite' || value.unit !== 'g')) {
        issue('Foto-Eintrag nur in Gramm.');
      }
      if (value.food_id === null || value.recipe_id !== null) issue('Lebensmittel fehlt.');
      if (value.amount === null || value.unit === null || value.portion !== null) {
        issue('Menge und Einheit fehlen.');
      } else if (!isValidFoodLogAmount(value.amount, value.unit)) {
        issue('Ungültige Menge.');
      }
      if (!allValues) issue(mode === 'favorite' ? 'Favorit ohne Werte.' : 'Nährwerte fehlen.');
      break;
    case 'recipe':
    case 'plan_item':
      if (value.recipe_id === null || value.food_id !== null) issue('Rezept fehlt.');
      if (value.portion === null || value.amount !== null || value.unit !== null) {
        issue('Portion fehlt.');
      } else if (!isValidFoodLogPortion(value.portion)) {
        issue('Ungültige Portion.');
      }
      if (!allValues) issue(mode === 'favorite' ? 'Favorit ohne Werte.' : 'Nährwerte fehlen.');
      if (value.source === 'plan_item' && value.slot === 'other') issue('Ungültiger Platz.');
      break;
    case 'quick':
      if (value.food_id !== null || value.recipe_id !== null) issue('Ungültiger Schnelleintrag.');
      if (value.amount !== null || value.unit !== null || value.portion !== null) {
        issue('Ungültiger Schnelleintrag.');
      }
      if (!(QUICK_ENTRY_LABELS as readonly string[]).includes(value.title_de)) {
        issue('Bezeichnung nur aus der Auswahlliste.');
      }
      if (
        value.kcal === null &&
        (value.protein_g !== null || value.carbs_g !== null || value.fat_g !== null)
      ) {
        issue('Makros nur zusammen mit kcal.');
      }
      break;
    case 'custom_meal':
      // Eigenes Gericht (E2): fester Titel statt Name (kein Freitext im Tagebuch), Portion 0,25–3, Werte als
      // Schnappschuss – ohne Werte erlaubt (Gericht „ohne Werte“ bei „Kalorienzahlen aus“), Makros nur mit kcal.
      if (mode === 'favorite') issue('Kein Favorit aus eigenem Gericht.');
      if (value.food_id !== null || value.recipe_id !== null) issue('Ungültiges eigenes Gericht.');
      if (value.portion === null || value.amount !== null || value.unit !== null) {
        issue('Portion fehlt.');
      } else if (!isValidFoodLogPortion(value.portion)) {
        issue('Ungültige Portion.');
      }
      if (value.title_de !== CUSTOM_MEAL_ENTRY_TITLE) issue('Ungültige Bezeichnung.');
      if (
        value.kcal === null &&
        (value.protein_g !== null || value.carbs_g !== null || value.fat_g !== null)
      ) {
        issue('Makros nur zusammen mit kcal.');
      }
      break;
    case 'product':
      // E4a: Produkt aus Open Food Facts (Nummer) ODER eigenes Produkt (Verweis) – nie beides. Nach dem Löschen eines
      // eigenen Produkts sind beide leer (fester Titel). Menge in g bzw. ml, alle Werte (aus Zwischenspeicher bzw.
      // eigenem Produkt; Favoriten ohne Werte).
      if (value.food_id !== null || value.recipe_id !== null) issue('Ungültiges Produkt.');
      if (productCode !== null && userProductId !== null) issue('Ungültiges Produkt.');
      if (mode === 'favorite' && productCode === null && userProductId === null) {
        issue('Favorit ohne Produkt.');
      }
      if (productCode === null && value.title_de !== USER_PRODUCT_ENTRY_TITLE) {
        issue('Ungültige Bezeichnung.');
      }
      if (value.amount === null || value.unit === null || value.portion !== null) {
        issue('Menge und Einheit fehlen.');
      } else if (value.unit === 'piece' || !isValidFoodLogAmount(value.amount, value.unit)) {
        issue('Ungültige Menge.');
      }
      if (!allValues) issue(mode === 'favorite' ? 'Favorit ohne Werte.' : 'Nährwerte fehlen.');
      break;
  }
}

/** Ein Eintrag, wie er gespeichert wird (ohne user_id, revision und Zeitstempel). */
export const foodLogEntrySchema = z
  .strictObject({ id: z.uuid(), eaten_on: isoDateSchema, ...entryFields })
  .superRefine(refineShape);
export type FoodLogEntry = z.infer<typeof foodLogEntrySchema>;

/**
 * Ein Eintrag in der Liste an save_food_log_entries (Supabase, ab N7 Teil 2): zusätzlich `write_id` (Idempotenz) und
 * `base_revision` (optimistische Sperre, null = neu). NICHT erlaubt: user_id, revision, Zeitstempel (Server).
 */
export const foodLogPayloadEntrySchema = z
  .strictObject({
    id: z.uuid(),
    write_id: z.uuid(),
    base_revision: z.number().int().min(1).nullable(),
    eaten_on: isoDateSchema,
    ...entryFields,
  })
  .superRefine(refineShape);
export type FoodLogPayloadEntry = z.infer<typeof foodLogPayloadEntrySchema>;

export const foodLogPayloadSchema = z
  .array(foodLogPayloadEntrySchema)
  .min(1)
  .max(L.maxEntriesPerSave)
  .refine((list) => new Set(list.map((e) => e.id)).size === list.length, 'Eintrag doppelt.');

/** Favorit (Stern): Vorlage ohne Datum und Platz. Nur Katalog, Rezept und Schnelleintrag (keine Plan-Mahlzeit). */
const favoriteFields = {
  food_id: entryFields.food_id,
  recipe_id: entryFields.recipe_id,
  title_de: entryFields.title_de,
  amount: entryFields.amount,
  unit: entryFields.unit,
  portion: entryFields.portion,
  kcal: entryFields.kcal,
  protein_g: entryFields.protein_g,
  carbs_g: entryFields.carbs_g,
  fat_g: entryFields.fat_g,
  // E4a: Produkt-Favoriten (Schlüssel product|<Nummer> bzw. own_product|<id>), nur Verweis + Menge, keine Werte.
  product_code: entryFields.product_code,
  user_product_id: entryFields.user_product_id,
};
export const FOOD_LOG_FAVORITE_SOURCES = ['food', 'recipe', 'quick', 'product'] as const;
export const foodLogFavoriteSchema = z
  .strictObject({
    fav_key: z.string().min(1).max(200),
    source: z.enum(FOOD_LOG_FAVORITE_SOURCES),
    ...favoriteFields,
  })
  .superRefine((value, ctx) => {
    refineShape(value, ctx, 'favorite');
    if (value.fav_key !== foodLogKey(value)) {
      ctx.addIssue({ code: 'custom', message: 'Ungültiger Schlüssel.' });
    }
  });
export type FoodLogFavorite = z.infer<typeof foodLogFavoriteSchema>;

/**
 * Schlüssel für „Zuletzt“ und Favoriten (sync: CHECK fav_key in food_log_favorites): Lebensmittel und Rezepte je
 * Inhalt (die zuletzt gewählte Menge/Portion gilt), Schnelleinträge je Bezeichnung und kcal. Plan-Mahlzeiten wie
 * Rezepte.
 */
export function foodLogKey(
  entry: Pick<
    EntryShape,
    | 'source'
    | 'food_id'
    | 'recipe_id'
    | 'custom_meal_id'
    | 'title_de'
    | 'kcal'
    | 'product_code'
    | 'user_product_id'
  >,
): string {
  switch (entry.source) {
    case 'food':
    case 'photo':
      // Foto-Bestandteile sind Katalog-Lebensmittel: gleicher Schlüssel wie „food“ (Zuletzt, Favoriten).
      return `food|${entry.food_id ?? ''}`;
    case 'recipe':
    case 'plan_item':
      return `recipe|${entry.recipe_id ?? ''}`;
    case 'quick':
      return `quick|${entry.title_de}|${entry.kcal === null ? '' : String(entry.kcal)}`;
    case 'custom_meal':
      // Je Gericht (nie der Name im Schlüssel); ein gelöschtes Gericht hat keinen Schlüssel-Inhalt.
      return `custom|${entry.custom_meal_id ?? ''}`;
    case 'product':
      // E4a: je Nummer bzw. je eigenem Produkt (nie Name oder Marke im Schlüssel; sync: CHECK fav_key).
      return (entry.product_code ?? null) !== null
        ? `product|${entry.product_code ?? ''}`
        : `own_product|${entry.user_product_id ?? ''}`;
  }
}

// ---------------------------------------------------------------------------------------------------------
// Datumsfenster (Plan 5: Nachtragen bis 14 Tage, nie in die Zukunft)
// ---------------------------------------------------------------------------------------------------------

export type FoodLogDateStatus = 'ok' | 'future' | 'too_old';

/** Darf an `date` eingetragen bzw. geändert werden? (Gerätezeit; der Server lässt 1 Tag Zeitzonen-Toleranz zu.) */
export function foodLogDateStatus(date: string, today: string): FoodLogDateStatus {
  const diff = daysBetween(date, today);
  if (diff < 0) return 'future';
  if (diff > L.backdateDays) return 'too_old';
  return 'ok';
}

/** Wählbare Tage zum Eintragen: heute und bis zu 14 Tage zurück (neueste zuerst). */
export function foodLogSelectableDates(today: string): string[] {
  return Array.from({ length: L.backdateDays + 1 }, (_, i) => addDays(today, -i));
}

// ---------------------------------------------------------------------------------------------------------
// Einträge bauen – Nährwerte immer hier (Katalog bzw. Plan-Schnappschuss), gerundet wie gespeichert
// ---------------------------------------------------------------------------------------------------------

export type FoodLogBuildError = 'portion' | 'amount' | 'unit' | 'too_much' | 'invalid';
export type FoodLogBuild =
  { ok: true; entry: FoodLogEntry } | { ok: false; reason: FoodLogBuildError };

export interface FoodLogTarget {
  readonly id: string;
  readonly date: string;
  readonly slot: FoodLogSlot;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function nutrientValues(
  n: Pick<RecipeNutrients, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
  factor: number,
) {
  return {
    kcal: Math.round(n.kcal * factor),
    protein_g: round1(n.protein_g * factor),
    carbs_g: round1(n.carbs_g * factor),
    fat_g: round1(n.fat_g * factor),
  };
}

/**
 * Letzter Schritt jedes Bauens: Obergrenzen (`too_much`) und Schema. Auch für `entryFromCustomMeal` (custom-meal.ts).
 */
export function finishFoodLogEntry(entry: FoodLogEntry): FoodLogBuild {
  if (
    (entry.kcal !== null && entry.kcal > L.kcal.max) ||
    [entry.protein_g, entry.carbs_g, entry.fat_g].some((v) => v !== null && v > L.macroG.max)
  ) {
    return { ok: false, reason: 'too_much' };
  }
  const parsed = foodLogEntrySchema.safeParse(entry);
  return parsed.success ? { ok: true, entry: parsed.data } : { ok: false, reason: 'invalid' };
}

/**
 * „Gegessen“ bei einer Mahlzeit des Essensplans (Plan 5 Nr. 1): Werte = Plan-Schnappschuss (Portion, Ersatz, Tausch
 * schon eingerechnet) × gewählte Portion (½ … 2). Der Eintrag bleibt, auch wenn der Plan später ersetzt wird.
 */
export function entryFromPlanItem(
  meal: Pick<PlannedMeal, 'slot' | 'recipeId' | 'titleDe' | 'nutrients'>,
  portion: number,
  target: Omit<FoodLogTarget, 'slot'>,
): FoodLogBuild {
  if (!isValidFoodLogPortion(portion)) return { ok: false, reason: 'portion' };
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: meal.slot,
    source: 'plan_item',
    food_id: null,
    recipe_id: meal.recipeId,
    custom_meal_id: null,
    product_code: null,
    user_product_id: null,
    title_de: meal.titleDe,
    amount: null,
    unit: null,
    portion,
    ...nutrientValues(meal.nutrients, portion),
  });
}

/** Einheiten, in denen sich ein Lebensmittel eintragen lässt (Stück nur mit Gewicht je Stück, ml nur mit Umrechnung). */
export function foodLogUnitsFor(food: Pick<Food, 'units'>): FoodLogUnit[] {
  return FOOD_LOG_UNITS.filter((unit) => gramsPerUnit(unit, food.units) !== null);
}

/** Lebensmittel aus dem Katalog mit Menge (Plan 5 Nr. 2) – Umrechnung über die Einheiten des Katalogs. */
export function entryFromFood(
  food: Pick<Food, 'id' | 'name_de' | 'units' | 'nutrients_per_100g'>,
  amount: number,
  unit: FoodLogUnit,
  target: FoodLogTarget,
): FoodLogBuild {
  const perUnit = gramsPerUnit(unit, food.units);
  if (perUnit === null) return { ok: false, reason: 'unit' };
  if (!isValidFoodLogAmount(amount, unit)) return { ok: false, reason: 'amount' };
  const grams = amount * perUnit;
  if (grams > L.gramsMax) return { ok: false, reason: 'amount' };
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'food',
    food_id: food.id,
    recipe_id: null,
    custom_meal_id: null,
    product_code: null,
    user_product_id: null,
    title_de: food.name_de,
    amount,
    unit,
    portion: null,
    ...nutrientValues(food.nutrients_per_100g, grams / 100),
  });
}

/** Rezept mit Portionen (Plan 5 Nr. 3): Werte je Portion aus Zutaten und Katalog (`computeRecipeFacts`). */
export function entryFromRecipe(
  recipe: Pick<Recipe, 'id' | 'title_de' | 'ingredients' | 'servings' | 'no_cook' | 'steps_de'>,
  foods: FoodLookup,
  servings: number,
  target: FoodLogTarget,
): FoodLogBuild {
  if (!isValidFoodLogPortion(servings)) return { ok: false, reason: 'portion' };
  let perServing: RecipeNutrients;
  try {
    perServing = computeRecipeFacts(recipe, foods).perServing;
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'recipe',
    food_id: null,
    recipe_id: recipe.id,
    custom_meal_id: null,
    product_code: null,
    user_product_id: null,
    title_de: recipe.title_de,
    amount: null,
    unit: null,
    portion: servings,
    ...nutrientValues(perServing, servings),
  });
}

export interface QuickEntryInput {
  readonly label: QuickEntryLabel;
  /** null = ohne Wert (z. B. bei „Kalorienzahlen aus“) – zählt nur als „gegessen“. */
  readonly kcal: number | null;
  readonly protein_g?: number | null;
  readonly carbs_g?: number | null;
  readonly fat_g?: number | null;
}

/** Schnelleintrag (Plan 5 Nr. 4): Bezeichnung aus der Liste, kcal optional, Makros optional (nur mit kcal). */
export function quickEntry(input: QuickEntryInput, target: FoodLogTarget): FoodLogBuild {
  const macro = (v: number | null | undefined) =>
    v === undefined || v === null ? null : round1(v);
  if (input.kcal !== null && (!Number.isFinite(input.kcal) || input.kcal > L.kcal.max)) {
    return { ok: false, reason: input.kcal > L.kcal.max ? 'too_much' : 'invalid' };
  }
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'quick',
    food_id: null,
    recipe_id: null,
    custom_meal_id: null,
    product_code: null,
    user_product_id: null,
    title_de: input.label,
    amount: null,
    unit: null,
    portion: null,
    kcal: input.kcal === null ? null : Math.round(input.kcal),
    protein_g: macro(input.protein_g),
    carbs_g: macro(input.carbs_g),
    fat_g: macro(input.fat_g),
  });
}

/**
 * Neuer Eintrag aus einer Vorlage („Zuletzt“ bzw. Favorit): gleiche Werte, neues Datum, neuer Platz, neue id. Eine
 * Plan-Mahlzeit als Vorlage wird zum Rezept-Eintrag mit denselben Werten (die Portion bezog sich auf den Plan) – sie
 * erscheint deshalb nicht unter „Zuletzt“ (`recentEntries`).
 */
export function entryFromTemplate(
  template: Omit<EntryShape, 'slot'> & { readonly source: Exclude<FoodLogSource, 'plan_item'> },
  target: FoodLogTarget,
): FoodLogBuild {
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    // Ein Foto-Bestandteil als Vorlage („Zuletzt“) wird ein normaler Katalog-Eintrag – ohne neues Foto keine Herkunft
    // „photo“.
    source: template.source === 'photo' ? 'food' : template.source,
    food_id: template.food_id,
    recipe_id: template.recipe_id,
    custom_meal_id: template.custom_meal_id ?? null,
    product_code: template.product_code ?? null,
    user_product_id: template.user_product_id ?? null,
    title_de: template.title_de,
    amount: template.amount,
    unit: template.unit,
    portion: template.portion,
    kcal: template.kcal,
    protein_g: template.protein_g,
    carbs_g: template.carbs_g,
    fat_g: template.fat_g,
  });
}

/**
 * Bearbeiten (Plan 5): Menge bzw. Portion ändern – die Werte werden aus dem Schnappschuss des Eintrags
 * verhältnisgleich neu gerechnet (archivierte Lebensmittel/Rezepte bleiben änderbar). Einheit bleibt.
 */
export function rescaleEntry(
  entry: FoodLogEntry,
  change: { readonly portion: number } | { readonly amount: number },
  /**
   * Umrechnung des Lebensmittels (Katalog) – Pflicht bei Stück/ml, damit die 2.000-g-Grenze wie beim Neu-Eintragen
   * gilt (Wächter E1 H6). Fehlt sie (Lebensmittel nicht im Bestand), ist eine neue Menge in Stück/ml nicht prüfbar
   * und wird abgelehnt (`unit`, vorsichtig).
   */
  food?: Pick<Food, 'units'> | null,
): FoodLogBuild {
  if ('portion' in change) {
    if (entry.portion === null) return { ok: false, reason: 'invalid' };
    if (!isValidFoodLogPortion(change.portion)) return { ok: false, reason: 'portion' };
    return finishFoodLogEntry({
      ...entry,
      portion: change.portion,
      ...scaled(entry, change.portion / entry.portion),
    });
  }
  if (entry.amount === null || entry.unit === null) return { ok: false, reason: 'invalid' };
  if (!isValidFoodLogAmount(change.amount, entry.unit)) return { ok: false, reason: 'amount' };
  const factor = change.amount / entry.amount;
  const perUnit = entry.unit === 'g' ? 1 : food ? gramsPerUnit(entry.unit, food.units) : null;
  if (perUnit === null) return { ok: false, reason: 'unit' };
  if (change.amount * perUnit > L.gramsMax) return { ok: false, reason: 'amount' };
  return finishFoodLogEntry({ ...entry, amount: change.amount, ...scaled(entry, factor) });
}

function scaled(entry: FoodLogEntry, factor: number) {
  const s = (v: number | null) => (v === null ? null : round1(v * factor));
  return {
    kcal: entry.kcal === null ? null : Math.round(entry.kcal * factor),
    protein_g: s(entry.protein_g),
    carbs_g: s(entry.carbs_g),
    fat_g: s(entry.fat_g),
  };
}

/** Platz und Tag ändern (Nachtragen in einen anderen Platz). */
export function moveEntry(entry: FoodLogEntry, slot: FoodLogSlot, date: string): FoodLogBuild {
  if (entry.source === 'plan_item' && (slot !== entry.slot || date !== entry.eaten_on)) {
    // Eine Plan-Mahlzeit gehört zu ihrem Tag und Platz.
    return { ok: false, reason: 'invalid' };
  }
  return finishFoodLogEntry({ ...entry, slot, eaten_on: date });
}

/** Plausibilitäts-Rückfrage „Stimmt die Menge?“ ab 1.500 kcal je Eintrag – keine Sperre. */
export function needsFoodLogConfirmation(entry: Pick<FoodLogEntry, 'kcal'>): boolean {
  return entry.kcal !== null && entry.kcal >= L.plausibleKcal;
}

// ---------------------------------------------------------------------------------------------------------
// Plan-Mahlzeit „Gegessen“: höchstens ein Eintrag je Tag und Platz (idempotent)
// ---------------------------------------------------------------------------------------------------------

/** Schon abgehakte Plan-Mahlzeit an diesem Tag und Platz (sonst null). */
export function planItemEntry<T extends Pick<FoodLogEntry, 'source' | 'eaten_on' | 'slot'>>(
  entries: readonly T[],
  date: string,
  slot: FoodLogSlot,
): T | null {
  return (
    entries.find((e) => e.source === 'plan_item' && e.eaten_on === date && e.slot === slot) ?? null
  );
}

export type PlanItemMark =
  | { kind: 'new'; entry: FoodLogEntry }
  | { kind: 'changed'; entry: FoodLogEntry }
  | { kind: 'unchanged'; entry: FoodLogEntry }
  | { kind: 'failed'; reason: FoodLogBuildError };

/**
 * „Gegessen“ tippen: neu, Portion geändert oder unverändert (doppelt tippen ändert nichts). Ein vorhandener Eintrag
 * behält seine id und seinen Schnappschuss-Titel; die Werte kommen aus der aktuellen Plan-Mahlzeit.
 */
export function markPlanItemEaten(
  entries: readonly FoodLogEntry[],
  meal: Pick<PlannedMeal, 'slot' | 'recipeId' | 'titleDe' | 'nutrients'>,
  date: string,
  portion: number,
  newId: () => string,
): PlanItemMark {
  const existing = planItemEntry(entries, date, meal.slot);
  const built = entryFromPlanItem(meal, portion, { id: existing?.id ?? newId(), date });
  if (!built.ok) return { kind: 'failed', reason: built.reason };
  if (existing === null) return { kind: 'new', entry: built.entry };
  if (existing.recipe_id === built.entry.recipe_id && existing.portion === portion) {
    return { kind: 'unchanged', entry: existing };
  }
  return { kind: 'changed', entry: built.entry };
}

// ---------------------------------------------------------------------------------------------------------
// Tag: Liste und Summen
// ---------------------------------------------------------------------------------------------------------

/** Einträge eines Tages in Gruppen-Reihenfolge (Frühstück … Snack), innerhalb nach Erstellung. */
export function foodLogDay<T extends FoodLogEntry & { readonly created_at: string }>(
  entries: readonly T[],
  date: string,
): T[] {
  const order = new Map(FOOD_LOG_GROUPS.map((g, i) => [g, i]));
  return entries
    .filter((e) => e.eaten_on === date)
    .sort(
      (a, b) =>
        (order.get(foodLogGroup(a.slot)) ?? 0) - (order.get(foodLogGroup(b.slot)) ?? 0) ||
        a.created_at.localeCompare(b.created_at) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
}

export interface DayIntake {
  /** Alle Einträge des Tages (auch ohne kcal). */
  readonly count: number;
  /** Einträge ohne kcal (Schnelleintrag ohne Wert) – gezählt, aber nicht summiert. */
  readonly withoutValue: number;
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  /** false = mindestens ein Eintrag mit kcal, aber ohne Makros (Schnelleintrag) – die Makro-Summe ist unvollständig. */
  readonly macrosComplete: boolean;
}

/** Summen eines Tages (Plan 5 `dayIntake`). Leere Liste = 0 Einträge (die App zeigt „noch nichts eingetragen“). */
export function dayIntake(
  entries: readonly Pick<FoodLogEntry, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>[],
): DayIntake {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let withoutValue = 0;
  let macrosComplete = true;
  for (const e of entries) {
    if (e.kcal === null) {
      withoutValue += 1;
      continue;
    }
    kcal += e.kcal;
    if (e.protein_g === null || e.carbs_g === null || e.fat_g === null) macrosComplete = false;
    protein += e.protein_g ?? 0;
    carbs += e.carbs_g ?? 0;
    fat += e.fat_g ?? 0;
  }
  return {
    count: entries.length,
    withoutValue,
    kcal,
    protein_g: round1(protein),
    carbs_g: round1(carbs),
    fat_g: round1(fat),
    macrosComplete,
  };
}

/**
 * Anzeige der Tagessumme (Plan 5 „Kalorienzahlen aus“, 2.3): mit Zahlen die Summen, ohne Zahlen NUR die Anzahl –
 * der Typ enthält dann keine kcal (Schwangerschaft/Stillzeit und „Zahlen aus“ gleich behandelt).
 */
export type DayIntakeView =
  ({ readonly kind: 'numbers' } & DayIntake) | { readonly kind: 'count'; readonly count: number };

export function dayIntakeView(
  entries: readonly Pick<FoodLogEntry, 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>[],
  showNumbers: boolean,
): DayIntakeView {
  if (!showNumbers) return { kind: 'count', count: entries.length };
  return { kind: 'numbers', ...dayIntake(entries) };
}

/** Darf an diesem Tag noch so viele Einträge dazukommen? (höchstens 40 je Tag) */
export function canAddFoodLogEntries(
  entries: readonly Pick<FoodLogEntry, 'eaten_on'>[],
  date: string,
  count = 1,
): boolean {
  return entries.filter((e) => e.eaten_on === date).length + count <= L.maxEntriesPerDay;
}

// ---------------------------------------------------------------------------------------------------------
// „Zuletzt gegessen“ und Favoriten (Plan 5 Nr. 5)
// ---------------------------------------------------------------------------------------------------------

type Timed = FoodLogEntry & { readonly created_at: string; readonly updated_at?: string };

const lastUse = (e: Timed) => e.updated_at ?? e.created_at;

/**
 * Die letzten `n` (Standard 20) VERSCHIEDENEN Einträge, neueste zuerst; je Schlüssel (`foodLogKey`) der zuletzt
 * benutzte. Plan-Mahlzeiten nicht (sie sind im Essensplan einen Tipp entfernt).
 */
export function recentEntries<T extends Timed>(
  entries: readonly T[],
  n: number = L.recentCount,
): T[] {
  const sorted = [...entries]
    // Plan-Mahlzeiten nicht; eigene Gerichte nur, solange es das Gericht gibt (gelöscht = Verweis null).
    .filter((e) => e.source !== 'plan_item')
    .filter((e) => e.source !== 'custom_meal' || e.custom_meal_id !== null)
    // E4a: eigene Produkte nur, solange es das Produkt gibt (gelöscht = beide Verweise leer).
    .filter((e) => e.source !== 'product' || e.product_code !== null || e.user_product_id !== null)
    .sort(
      (a, b) =>
        lastUse(b).localeCompare(lastUse(a)) ||
        b.eaten_on.localeCompare(a.eaten_on) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  const limit = Math.max(0, Math.floor(n));
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of sorted) {
    if (result.length >= limit) break;
    const key = foodLogKey(entry);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

/** Favorit aus einem Eintrag (Stern); Plan-Mahlzeiten haben keinen Stern (null). */
export function favoriteFromEntry(entry: FoodLogEntry): FoodLogFavorite | null {
  // Plan-Mahlzeiten und eigene Gerichte haben keinen Stern (sie sind im Plan bzw. unter „Eigene Gerichte“).
  if (entry.source === 'plan_item' || entry.source === 'custom_meal') return null;
  const parsed = foodLogFavoriteSchema.safeParse({
    fav_key: foodLogKey(entry),
    // Foto-Bestandteil → Favorit aus dem Katalog (gleicher Schlüssel food|id).
    source: entry.source === 'photo' ? 'food' : entry.source,
    food_id: entry.food_id,
    recipe_id: entry.recipe_id,
    title_de: entry.title_de,
    amount: entry.amount,
    unit: entry.unit,
    portion: entry.portion,
    // E4a: Produkt-Favorit = Verweis (Nummer bzw. eigenes Produkt) + Menge, keine Werte; den Titel setzt der Server.
    product_code: entry.product_code,
    user_product_id: entry.user_product_id,
    // Katalog/Rezept: nur Verweis + Menge/Portion, keine Werte (S1); Schnelleintrag: Bezeichnung + kcal.
    kcal: entry.source === 'quick' ? entry.kcal : null,
    protein_g: entry.source === 'quick' ? entry.protein_g : null,
    carbs_g: entry.source === 'quick' ? entry.carbs_g : null,
    fat_g: entry.source === 'quick' ? entry.fat_g : null,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Neuer Eintrag aus einem Favoriten: Katalog und Rezept werden mit der gespeicherten Menge bzw. Portion AUS DEM
 * BESTAND neu gerechnet (Favoriten speichern keine Werte, Wächter E1 S1); fehlt der Inhalt im Bestand (z. B.
 * archiviert), ist der Favorit nicht eintragbar (`unit`/`invalid`). Schnelleintrag: gleiche Bezeichnung und Werte.
 */
export function entryFromFavorite(
  favorite: FoodLogFavorite,
  library: { readonly foods: FoodLookup; readonly recipes: readonly Recipe[] },
  target: FoodLogTarget,
): FoodLogBuild {
  switch (favorite.source) {
    case 'food': {
      const food = favorite.food_id === null ? undefined : library.foods.get(favorite.food_id);
      if (!food || favorite.amount === null || favorite.unit === null) {
        return { ok: false, reason: 'invalid' };
      }
      return entryFromFood(food, favorite.amount, favorite.unit, target);
    }
    case 'recipe': {
      const recipe = library.recipes.find((r) => r.id === favorite.recipe_id);
      if (!recipe || favorite.portion === null) return { ok: false, reason: 'invalid' };
      return entryFromRecipe(recipe, library.foods, favorite.portion, target);
    }
    case 'quick':
      return entryFromTemplate(favorite, target);
    case 'product':
      // E4a: Produkt-Favoriten speichern keine Werte – die App öffnet die Produktansicht (neu abfragen bzw. eigenes
      // Produkt) und trägt von dort ein (`entryFromProduct`/`entryFromUserProduct`).
      return { ok: false, reason: 'invalid' };
  }
}

/** Ist der Favorit mit dem aktuellen Bestand eintragbar? (Katalog/Rezept vorhanden) */
export function favoriteAvailable(
  favorite: FoodLogFavorite,
  library: { readonly foods: FoodLookup; readonly recipes: readonly Recipe[] },
): boolean {
  if (favorite.source === 'food')
    return favorite.food_id !== null && library.foods.has(favorite.food_id);
  if (favorite.source === 'recipe') return library.recipes.some((r) => r.id === favorite.recipe_id);
  // E4a: Produkt-Favoriten gehen über die Produktansicht (immer anzeigbar).
  return true;
}

/** Ist dieser Eintrag ein Favorit? */
export function isFavoriteEntry(
  favorites: readonly Pick<FoodLogFavorite, 'fav_key'>[],
  entry: FoodLogEntry,
): boolean {
  const key = foodLogKey(entry);
  return (
    entry.source !== 'plan_item' &&
    entry.source !== 'custom_meal' &&
    favorites.some((f) => f.fav_key === key)
  );
}

/**
 * Favoriten setzen bzw. ersetzen (gleicher Schlüssel = neue Menge/Portion) – höchstens `maxFavorites`. Rückgabe null
 * = Obergrenze erreicht.
 */
export function upsertFavorite<T extends FoodLogFavorite>(
  favorites: readonly T[],
  favorite: T,
): T[] | null {
  const rest = favorites.filter((f) => f.fav_key !== favorite.fav_key);
  if (rest.length >= L.maxFavorites) return null;
  return [...rest, favorite];
}

/** Favoriten-Reihenfolge: zuletzt gegessen zuerst, nie gegessene danach alphabetisch. */
export function orderFavorites<T extends FoodLogFavorite>(
  favorites: readonly T[],
  entries: readonly Timed[],
): T[] {
  const last = new Map<string, string>();
  for (const e of entries) {
    const key = foodLogKey(e);
    const use = lastUse(e);
    if ((last.get(key) ?? '') < use) last.set(key, use);
  }
  return [...favorites].sort(
    (a, b) =>
      (last.get(b.fav_key) ?? '').localeCompare(last.get(a.fav_key) ?? '') ||
      a.title_de.localeCompare(b.title_de, 'de') ||
      (a.fav_key < b.fav_key ? -1 : a.fav_key > b.fav_key ? 1 : 0),
  );
}

// ---------------------------------------------------------------------------------------------------------
// Suche im Katalog und in den Rezepten (Plan 5 Nr. 2/3)
// ---------------------------------------------------------------------------------------------------------

/** Suchbegriff: 2–60 Zeichen. */
export const FOOD_LOG_SEARCH = { minChars: 2, maxChars: 60, maxHits: 20 } as const;

export interface FoodLogSearchResult {
  readonly foods: Food[];
  readonly recipes: Recipe[];
}

/**
 * Lebensmittel (Name und Suchbegriffe) und Rezepte (Titel) nach Namen – gleiche Normalisierung wie die Zutaten-Suche
 * (`normalizeFoodText`). Treffer am Wortanfang zuerst, dann alphabetisch. Ohne Profil-Filter: Das Tagebuch hält fest,
 * was gegessen wurde, es empfiehlt nichts.
 */
export function searchFoodLogCatalog(
  library: { readonly foods: FoodLookup; readonly recipes: readonly Recipe[] },
  query: string,
): FoodLogSearchResult {
  const q = normalizeFoodText(query.slice(0, FOOD_LOG_SEARCH.maxChars)).trim();
  if (q.length < FOOD_LOG_SEARCH.minChars) return { foods: [], recipes: [] };
  const rank = (names: readonly string[]): number | null => {
    let best: number | null = null;
    for (const name of names) {
      const n = normalizeFoodText(name);
      const at = n.indexOf(q);
      if (at < 0) continue;
      const score = at === 0 ? 0 : n[at - 1] === ' ' || n[at - 1] === '-' ? 1 : 2;
      best = best === null ? score : Math.min(best, score);
    }
    return best;
  };
  const byRank = <T>(items: readonly { item: T; score: number; name: string }[]) =>
    [...items]
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'de'))
      .slice(0, FOOD_LOG_SEARCH.maxHits)
      .map((x) => x.item);
  const foods: { item: Food; score: number; name: string }[] = [];
  for (const food of library.foods.values()) {
    const score = rank([food.name_de, ...food.aliases_de]);
    if (score !== null) foods.push({ item: food, score, name: food.name_de });
  }
  const recipes: { item: Recipe; score: number; name: string }[] = [];
  for (const recipe of library.recipes) {
    const score = rank([recipe.title_de]);
    if (score !== null) recipes.push({ item: recipe, score, name: recipe.title_de });
  }
  return { foods: byRank(foods), recipes: byRank(recipes) };
}

/** Standard-Portionen der Plan-Mahlzeit (für die Auswahl in der App). */
export const PLAN_ITEM_PORTIONS: readonly number[] = FOOD_LOG_PORTION_CHOICES;

// ---------------------------------------------------------------------------------------------------------
// Antwort von save_food_log_entries je Eintrag (Wächter E1 S2/H1) – an der Grenze geprüft (Zod)
// ---------------------------------------------------------------------------------------------------------

/** Gründe, aus denen der Server einen einzelnen Eintrag ablehnt (die übrigen Einträge des Aufrufs gelten). */
export const FOOD_LOG_REJECT_CODES = [
  'invalid',
  'out_of_range',
  'day_full',
  // E4a: Produkt aus Open Food Facts nicht (mehr) im Zwischenspeicher bzw. gesperrt – „Produkt neu abrufen“.
  'product_unavailable',
] as const;
export type FoodLogRejectCode = (typeof FOOD_LOG_REJECT_CODES)[number];

/**
 * - `saved`: gespeichert (auch: dieselbe Fassung erneut gesendet). `id` = gespeicherte id (kann neu sein).
 * - `conflict` + `reason: 'revision'`: auf einem anderen Gerät geändert – `id`/`revision` des Server-Stands.
 * - `conflict` + `reason: 'deleted'`: Eintrag gibt es auf dem Server nicht mehr – `id` und `revision` sind null.
 * - `conflict` + `reason: 'plan_item_exists'`: diese Plan-Mahlzeit ist schon eingetragen (anderes Gerät) – `id` =
 *   der vorhandene Eintrag.
 * - `rejected`: dieser Eintrag ist ungültig, außerhalb des Fensters oder der Tag ist voll – nichts gespeichert.
 */
export const foodLogSaveResultSchema = z.union([
  z.strictObject({ result: z.literal('saved'), id: z.uuid(), revision: z.number().int().min(1) }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.enum(['revision', 'plan_item_exists']),
    id: z.uuid(),
    revision: z.number().int().min(1),
  }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.literal('deleted'),
    id: z.null(),
    revision: z.null(),
  }),
  z.strictObject({ result: z.literal('rejected'), code: z.enum(FOOD_LOG_REJECT_CODES) }),
]);
export type FoodLogSaveResult = z.infer<typeof foodLogSaveResultSchema>;

/** Antwort-Liste in derselben Reihenfolge wie die Eingabe. */
export const foodLogSaveResponseSchema = z
  .array(foodLogSaveResultSchema)
  .min(1)
  .max(L.maxEntriesPerSave);
