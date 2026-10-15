import { z } from 'zod';

import { CUSTOM_MEAL_LIMITS, FOOD_LOG_LIMITS, KCAL_PER_GRAM } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import { contentIdSchema } from '../content/schemas';
import {
  CUSTOM_MEAL_ENTRY_TITLE,
  finishFoodLogEntry,
  type FoodLogBuild,
  type FoodLogEntry,
  type FoodLogTarget,
  FOOD_LOG_UNITS,
  isValidFoodLogAmount,
  isValidFoodLogPortion,
} from './food-log';
import { computeRecipeFacts } from './recipe-nutrients';
import { gramsPerUnit } from './units';

/**
 * Eigene Gerichte (Etappe E2, docs/PLAN-AUSWERTUNG.md Abschnitt 7, KONZEPT 6.2): Gerichte, die man oft isst („Mein
 * Porridge“), einmal anlegen und dann mit einem Tipp ins Ernährungstagebuch eintragen. Reine Logik ohne UI:
 * Gericht prüfen (Zod, strikt – dieselben Felder und Grenzen wie save_custom_meal), Werte aus Zutaten rechnen
 * (DIESELBE Rechnung wie Rezepte, `computeRecipeFacts`), Tagebuch-Eintrag als Schnappschuss bauen.
 *
 * Zwei Arten (Plan 7): `direct` = Werte je Portion direkt eingegeben (oder ohne Werte, z. B. bei „Kalorienzahlen
 * aus“), genau 1 Portion, keine Zutaten; `ingredients` = 1–30 Zutaten aus dem Katalog + Anzahl Portionen, Werte je
 * Portion berechnet und als Schnappschuss gespeichert (eine später archivierte Zutat ändert sie nicht).
 *
 * Datenschutz (Plan 2.7, E2-Entscheidung „sichere Voreinstellung“): Der Name ist Freitext – nur mit gültiger
 * Einwilligung health_data, beim Widerruf gelöscht, im Export, nie in Logs, Fehlermeldungen, testIDs oder Analytics.
 * Tagebuch-Einträge aus einem Gericht tragen NICHT den Namen, sondern den festen Titel `CUSTOM_MEAL_ENTRY_TITLE` und
 * den Verweis `custom_meal_id`.
 */

const L = CUSTOM_MEAL_LIMITS;
const F = FOOD_LOG_LIMITS;

export const CUSTOM_MEAL_MODES = ['direct', 'ingredients'] as const;
export type CustomMealMode = (typeof CUSTOM_MEAL_MODES)[number];

/** Zeichen in Code-Points zählen – wie char_length() in Postgres. */
function codePoints(text: string): number {
  return [...text].length;
}

const multipleOf = (step: number) => (value: number) =>
  Math.abs(Math.round(value / step) * step - value) < 1e-9;

/**
 * Zeichen, die im Namen NIE vorkommen dürfen (Wächter E2 H1) – als Inhalt einer Zeichenklasse, identisch im CHECK von
 * custom_meals.name_de (db-sync.test.ts): Steuerzeichen (C0/C1), Zero-Width und Richtungsmarken (U+200B–U+200F),
 * Zeilen-/Absatztrenner und Bidi-Steuerung (U+2028–U+202E), unsichtbare Operatoren (U+2060–U+2064), Bidi-Isolates
 * (U+2066–U+2069), BOM (U+FEFF). Ausdrückliche Bereiche statt Klassen wie [[:cntrl:]] – unabhängig von Locale und Engine.
 */
export const CUSTOM_MEAL_NAME_FORBIDDEN_CLASS =
  '\\u0001-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2064\\u2066-\\u2069\\ufeff';
/** Leerraum, der nicht am Anfang oder Ende stehen darf (Leerzeichen, geschütztes Leerzeichen, typografische Leerzeichen). */
export const CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS =
  ' \\u00a0\\u1680\\u2000-\\u200a\\u202f\\u205f\\u3000';

const FORBIDDEN = new RegExp(`[\\u0000${CUSTOM_MEAL_NAME_FORBIDDEN_CLASS}]`, 'u');
const FORBIDDEN_INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/gu;
const EDGE_SPACE = new RegExp(
  `^[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]|[${CUSTOM_MEAL_NAME_EDGE_SPACE_CLASS}]$`,
  'u',
);

/**
 * true = gültiger Name: 1–60 Zeichen (Code-Points), keine verbotenen Zeichen, kein Leerraum am Rand – dieselbe Menge
 * wie der CHECK in der Datenbank.
 */
export function isValidCustomMealName(name: string): boolean {
  return (
    codePoints(name) >= 1 &&
    codePoints(name) <= L.nameMaxChars &&
    !FORBIDDEN.test(name) &&
    !EDGE_SPACE.test(name)
  );
}

/**
 * Name aus der Eingabe: unsichtbare Zeichen (Zero-Width, Bidi-Steuerung, BOM) entfernen, Steuerzeichen und Leerraum
 * (auch Zeilenumbrüche) zu einem Leerzeichen zusammenfassen, Rand weg. Das Ergebnis prüft `isValidCustomMealName`.
 */
export function normalizeCustomMealName(input: string): string {
  return (
    input
      .replace(FORBIDDEN_INVISIBLE, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
  );
}

const nameSchema = z.string().refine(isValidCustomMealName, { message: 'Ungültiger Name.' });
const kcalSchema = z.number().int('Ganze kcal erwartet.').min(F.kcal.min).max(F.kcal.max);
const macroSchema = z
  .number()
  .min(F.macroG.min)
  .max(F.macroG.max)
  .refine(multipleOf(0.1), 'Höchstens eine Nachkommastelle.');

/** Zutat: Lebensmittel aus dem Katalog + Menge in g, ml oder Stück (Grenzen wie im Tagebuch). */
export const customMealItemSchema = z
  .strictObject({
    food_id: contentIdSchema,
    amount: z.number().finite(),
    unit: z.enum(FOOD_LOG_UNITS),
  })
  .refine((item) => isValidFoodLogAmount(item.amount, item.unit), { message: 'Ungültige Menge.' });
export type CustomMealItem = z.infer<typeof customMealItemSchema>;

const mealFields = {
  id: z.uuid(),
  name_de: nameSchema,
  mode: z.enum(CUSTOM_MEAL_MODES),
  servings: z.number().int().min(L.servings.min).max(L.servings.max),
  /** Werte JE PORTION (Schnappschuss). Direkt: optional (null = ohne Werte); aus Zutaten: immer gesetzt. */
  kcal: kcalSchema.nullable(),
  protein_g: macroSchema.nullable(),
  carbs_g: macroSchema.nullable(),
  fat_g: macroSchema.nullable(),
  items: z.array(customMealItemSchema).max(L.maxItems),
};

type MealShape = {
  readonly mode: CustomMealMode;
  readonly servings: number;
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
  readonly items: readonly CustomMealItem[];
};

/** Form je Art (wie die CHECKs von custom_meals und die Prüfung in save_custom_meal). */
function refineMeal(value: MealShape, ctx: z.RefinementCtx): void {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const macros = [value.protein_g, value.carbs_g, value.fat_g];
  if (value.mode === 'direct') {
    if (value.items.length !== 0) issue('Direkt angelegt: keine Zutaten.');
    if (value.servings !== 1) issue('Direkt angelegt: genau 1 Portion.');
    if (value.kcal === null && macros.some((m) => m !== null)) {
      issue('Makros nur zusammen mit kcal.');
    }
  } else {
    if (value.items.length < 1) issue('Mindestens eine Zutat.');
    if (value.kcal === null || macros.some((m) => m === null)) issue('Werte fehlen.');
  }
}

/** Ein eigenes Gericht, wie es gespeichert wird (ohne user_id, revision und Zeitstempel). */
export const customMealSchema = z.strictObject(mealFields).superRefine(refineMeal);
export type CustomMeal = z.infer<typeof customMealSchema>;

/**
 * Eingabe an save_custom_meal (Supabase, ab N7 Teil 2): zusätzlich `write_id` (Idempotenz) und `base_revision`
 * (optimistische Sperre, null = neu). NICHT erlaubt: user_id, revision, Zeitstempel (Server).
 */
export const customMealPayloadSchema = z
  .strictObject({
    ...mealFields,
    write_id: z.uuid(),
    base_revision: z.number().int().min(1).nullable(),
  })
  .superRefine(refineMeal);
export type CustomMealPayload = z.infer<typeof customMealPayloadSchema>;

/** Gründe, aus denen der Server ein Gericht ablehnt (ohne Werte, ohne Namen). */
export const CUSTOM_MEAL_REJECT_CODES = ['invalid', 'limit'] as const;
export type CustomMealRejectCode = (typeof CUSTOM_MEAL_REJECT_CODES)[number];

/** Antwort von save_custom_meal – an der Grenze geprüft (Zod), gleiche Form wie bei save_food_log_entries. */
export const customMealSaveResultSchema = z.union([
  // Mit den GESPEICHERTEN Werten je Portion (aus Zutaten rechnet der Server selbst, E2-G2) – die App übernimmt sie.
  z.strictObject({
    result: z.literal('saved'),
    id: z.uuid(),
    revision: z.number().int().min(1),
    kcal: kcalSchema.nullable(),
    protein_g: macroSchema.nullable(),
    carbs_g: macroSchema.nullable(),
    fat_g: macroSchema.nullable(),
  }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.literal('revision'),
    id: z.uuid(),
    revision: z.number().int().min(1),
  }),
  z.strictObject({
    result: z.literal('conflict'),
    reason: z.literal('deleted'),
    id: z.null(),
    revision: z.null(),
  }),
  z.strictObject({ result: z.literal('rejected'), code: z.enum(CUSTOM_MEAL_REJECT_CODES) }),
]);
export type CustomMealSaveResult = z.infer<typeof customMealSaveResultSchema>;

// ---------------------------------------------------------------------------------------------------------
// Werte aus Zutaten (gleiche Rechnung wie Rezepte)
// ---------------------------------------------------------------------------------------------------------

export interface CustomMealValues {
  readonly kcal: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
}

export type CustomMealNutrientsError = 'missing_food' | 'unit' | 'amount' | 'too_much' | 'items';
export type CustomMealNutrients =
  | { ok: true; perServing: CustomMealValues }
  | { ok: false; reason: CustomMealNutrientsError; index: number | null };

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Werte JE PORTION aus Zutaten und Katalog (Plan 7: „gleiche Rechnung wie recipe-nutrients.ts“) – die Zutaten
 * werden als nicht optionale Rezept-Zutaten an `computeRecipeFacts` gegeben (Gramm über die Einheiten des Katalogs,
 * Summe ÷ Portionen), gerundet wie gespeichert (kcal ganz, Makros eine Nachkommastelle). Fehler: Lebensmittel fehlt im
 * Bestand (z. B. archiviert), Einheit nicht umrechenbar (Stück ohne Gewicht, ml ohne Umrechnung), Menge außerhalb der
 * Grenzen bzw. umgerechnet über 2.000 g, Werte je Portion über 3.000 kcal bzw. 750 g (`too_much`).
 */
export function customMealNutrients(
  meal: { readonly items: readonly CustomMealItem[]; readonly servings: number },
  foods: FoodLookup,
): CustomMealNutrients {
  if (meal.items.length < 1 || meal.items.length > L.maxItems) {
    return { ok: false, reason: 'items', index: null };
  }
  if (
    !Number.isInteger(meal.servings) ||
    meal.servings < L.servings.min ||
    meal.servings > L.servings.max
  ) {
    return { ok: false, reason: 'items', index: null };
  }
  for (const [index, item] of meal.items.entries()) {
    if (!isValidFoodLogAmount(item.amount, item.unit))
      return { ok: false, reason: 'amount', index };
    const food = foods.get(item.food_id);
    if (food === undefined) return { ok: false, reason: 'missing_food', index };
    const perUnit = gramsPerUnit(item.unit, food.units);
    if (perUnit === null) return { ok: false, reason: 'unit', index };
    if (item.amount * perUnit > F.gramsMax) return { ok: false, reason: 'amount', index };
  }
  const facts = computeRecipeFacts(
    {
      ingredients: meal.items.map((item) => ({
        food_id: item.food_id,
        amount: item.amount,
        unit: item.unit,
        optional: false,
        scales: true,
      })),
      servings: meal.servings,
      no_cook: false,
      steps_de: [],
    },
    foods,
  );
  // Doppelte Sicherung: dieselben Fehler wie oben aus der Rezept-Rechnung.
  if (facts.missingFoods.length > 0) {
    return { ok: false, reason: 'missing_food', index: facts.missingFoods[0] ?? null };
  }
  if (facts.unconvertible.length > 0) {
    return { ok: false, reason: 'unit', index: facts.unconvertible[0] ?? null };
  }
  const n = facts.perServing;
  const perServing = {
    kcal: Math.round(n.kcal),
    protein_g: round1(n.protein_g),
    carbs_g: round1(n.carbs_g),
    fat_g: round1(n.fat_g),
  };
  if (
    perServing.kcal > F.kcal.max ||
    [perServing.protein_g, perServing.carbs_g, perServing.fat_g].some((v) => v > F.macroG.max)
  ) {
    return { ok: false, reason: 'too_much', index: null };
  }
  return { ok: true, perServing };
}

// ---------------------------------------------------------------------------------------------------------
// Gericht bauen (Anlegen und Ändern)
// ---------------------------------------------------------------------------------------------------------

export type CustomMealInput =
  | {
      readonly id: string;
      readonly name: string;
      readonly mode: 'direct';
      /** null = ohne Werte (bei „Kalorienzahlen aus“ der einzige direkte Weg). */
      readonly values: {
        readonly kcal: number;
        readonly protein_g: number | null;
        readonly carbs_g: number | null;
        readonly fat_g: number | null;
      } | null;
    }
  | {
      readonly id: string;
      readonly name: string;
      readonly mode: 'ingredients';
      readonly servings: number;
      readonly items: readonly CustomMealItem[];
    };

export type CustomMealBuildError =
  'name' | 'values' | 'servings' | CustomMealNutrientsError | 'invalid';
export type CustomMealBuild =
  | { ok: true; meal: CustomMeal }
  | { ok: false; reason: CustomMealBuildError; index: number | null };

/**
 * Gericht aus der Eingabe bauen: Name normalisiert (`normalizeCustomMealName`) und geprüft; direkt = Werte wie
 * eingegeben (kcal ganz, Makros auf eine Nachkommastelle gerundet); aus Zutaten = Werte per `customMealNutrients`.
 */
export function buildCustomMeal(input: CustomMealInput, foods: FoodLookup): CustomMealBuild {
  const name = normalizeCustomMealName(input.name);
  if (!isValidCustomMealName(name)) return { ok: false, reason: 'name', index: null };
  let meal: CustomMeal;
  if (input.mode === 'direct') {
    const v = input.values;
    const macro = (m: number | null) => (m === null ? null : round1(m));
    if (
      v !== null &&
      (!Number.isInteger(v.kcal) ||
        v.kcal < F.kcal.min ||
        v.kcal > F.kcal.max ||
        [v.protein_g, v.carbs_g, v.fat_g].some(
          (m) => m !== null && (!Number.isFinite(m) || m < F.macroG.min || m > F.macroG.max),
        ))
    ) {
      return { ok: false, reason: 'values', index: null };
    }
    meal = {
      id: input.id,
      name_de: name,
      mode: 'direct',
      servings: 1,
      kcal: v === null ? null : v.kcal,
      protein_g: v === null ? null : macro(v.protein_g),
      carbs_g: v === null ? null : macro(v.carbs_g),
      fat_g: v === null ? null : macro(v.fat_g),
      items: [],
    };
  } else {
    if (
      !Number.isInteger(input.servings) ||
      input.servings < L.servings.min ||
      input.servings > L.servings.max
    ) {
      return { ok: false, reason: 'servings', index: null };
    }
    const nutrients = customMealNutrients(input, foods);
    if (!nutrients.ok) return { ok: false, reason: nutrients.reason, index: nutrients.index };
    meal = {
      id: input.id,
      name_de: name,
      mode: 'ingredients',
      servings: input.servings,
      ...nutrients.perServing,
      items: input.items.map((item) => ({ ...item })),
    };
  }
  const parsed = customMealSchema.safeParse(meal);
  return parsed.success
    ? { ok: true, meal: parsed.data }
    : { ok: false, reason: 'invalid', index: null };
}

/**
 * Nur den Namen ändern – Werte und Zutaten bleiben (Schnappschuss). Für Gerichte, deren Zutaten nicht mehr im Bestand
 * sind (archiviert): Neu rechnen geht dann nicht, umbenennen schon.
 */
export function renameCustomMeal(meal: CustomMeal, name: string): CustomMealBuild {
  const normalized = normalizeCustomMealName(name);
  if (!isValidCustomMealName(normalized)) return { ok: false, reason: 'name', index: null };
  const parsed = customMealSchema.safeParse({ ...meal, name_de: normalized });
  return parsed.success
    ? { ok: true, meal: parsed.data }
    : { ok: false, reason: 'invalid', index: null };
}

/** Sind alle Zutaten im Bestand (neu rechenbar)? Direkt angelegte Gerichte immer. */
export function customMealComputable(meal: Pick<CustomMeal, 'items'>, foods: FoodLookup): boolean {
  return meal.items.every((item) => foods.has(item.food_id));
}

/**
 * Plausibilität direkter Werte (Plan 7): Eiweiß, Kohlenhydrate und Fett ergeben grob die kcal (Atwater,
 * `KCAL_PER_GRAM`). Sind alle drei angegeben und weicht die kcal-Angabe um mehr als 20 % davon ab, fragt die App nach
 * – keine Sperre. Fehlen einzelne Makros, lässt sich nur „zu viel“ erkennen: Ergeben schon die angegebenen Makros mehr
 * als die kcal + 20 %, wird ebenfalls nachgefragt. Ohne kcal keine Rückfrage.
 */
export function customMealValuesNeedConfirmation(values: {
  readonly kcal: number | null;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
}): boolean {
  const { kcal, protein_g: p, carbs_g: c, fat_g: f } = values;
  if (kcal === null || (p === null && c === null && f === null)) return false;
  const fromMacros =
    KCAL_PER_GRAM.protein * (p ?? 0) +
    KCAL_PER_GRAM.carbs * (c ?? 0) +
    KCAL_PER_GRAM.fat * (f ?? 0);
  const tolerance = L.macroKcalTolerance * kcal;
  if (p === null || c === null || f === null) return fromMacros - kcal > tolerance;
  return Math.abs(fromMacros - kcal) > tolerance;
}

export const CUSTOM_MEAL_VALUE_FIELDS = ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const;
export type CustomMealValueField = (typeof CUSTOM_MEAL_VALUE_FIELDS)[number];

/**
 * Eingabefelder „Werte direkt“ prüfen (Wächter E2 H4/H5 – die Grenzen stehen nur in constants.ts): je Feld der Fehler,
 * leeres Objekt = gültig. Eingabe: Zahl, `null` (leer) oder `NaN` (keine Zahl). kcal ist Pflicht (ganz, 0–3.000),
 * Makros optional (0–750 g, eine Nachkommastelle).
 */
export function checkCustomMealDirectValues(
  values: Readonly<Record<CustomMealValueField, number | null>>,
): Partial<Record<CustomMealValueField, 'invalid'>> {
  const errors: Partial<Record<CustomMealValueField, 'invalid'>> = {};
  if (!kcalSchema.safeParse(values.kcal).success) errors.kcal = 'invalid';
  for (const key of ['protein_g', 'carbs_g', 'fat_g'] as const) {
    const value = values[key];
    if (value !== null && !macroSchema.safeParse(value).success) errors[key] = 'invalid';
  }
  return errors;
}

/** Darf noch ein Gericht dazukommen? (höchstens 100) */
export function canAddCustomMeal(meals: readonly unknown[]): boolean {
  return meals.length < L.maxMeals;
}

// ---------------------------------------------------------------------------------------------------------
// Ins Tagebuch eintragen (Schnappschuss)
// ---------------------------------------------------------------------------------------------------------

/**
 * Tagebuch-Eintrag aus einem eigenen Gericht (Plan 7): Werte je Portion × gewählte Portion (0,25–3), als Schnappschuss
 * – ein späteres Ändern oder Löschen des Gerichts ändert eingetragene Tage nicht. Titel ist IMMER
 * `CUSTOM_MEAL_ENTRY_TITLE` (kein Freitext im Tagebuch), der Name kommt in der Anzeige über `custom_meal_id`. Ein
 * Gericht ohne Werte ergibt einen Eintrag ohne Werte (zählt nur als „gegessen“).
 */
export function entryFromCustomMeal(
  meal: Pick<CustomMeal, 'id' | 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g'>,
  portion: number,
  target: FoodLogTarget,
): FoodLogBuild {
  if (!isValidFoodLogPortion(portion)) return { ok: false, reason: 'portion' };
  const macro = (m: number | null) => (m === null ? null : round1(m * portion));
  const withValues = meal.kcal !== null;
  return finishFoodLogEntry({
    id: target.id,
    eaten_on: target.date,
    slot: target.slot,
    source: 'custom_meal',
    food_id: null,
    recipe_id: null,
    custom_meal_id: meal.id,
    title_de: CUSTOM_MEAL_ENTRY_TITLE,
    amount: null,
    unit: null,
    portion,
    kcal: meal.kcal === null ? null : Math.round(meal.kcal * portion),
    protein_g: withValues ? macro(meal.protein_g) : null,
    carbs_g: withValues ? macro(meal.carbs_g) : null,
    fat_g: withValues ? macro(meal.fat_g) : null,
  });
}

/**
 * Anzeigetitel eines Tagebuch-Eintrags: bei eigenen Gerichten der aktuelle Name des Gerichts (nur auf dem Bildschirm,
 * nie in Logs oder testIDs), sonst bzw. nach dem Löschen des Gerichts der gespeicherte Titel („Eigenes Gericht“).
 */
export function foodLogDisplayTitle(
  entry: Pick<FoodLogEntry, 'source' | 'custom_meal_id' | 'title_de'>,
  meals: readonly Pick<CustomMeal, 'id' | 'name_de'>[],
): string {
  if (entry.source !== 'custom_meal' || entry.custom_meal_id === null) return entry.title_de;
  return meals.find((m) => m.id === entry.custom_meal_id)?.name_de ?? entry.title_de;
}

/** Reihenfolge der Liste: zuletzt eingetragen zuerst, nie eingetragene danach alphabetisch. */
export function orderCustomMeals<T extends Pick<CustomMeal, 'id' | 'name_de'>>(
  meals: readonly T[],
  entries: readonly (Pick<FoodLogEntry, 'source' | 'custom_meal_id'> & {
    readonly created_at: string;
    readonly updated_at?: string;
  })[],
): T[] {
  const last = new Map<string, string>();
  for (const e of entries) {
    if (e.source !== 'custom_meal' || e.custom_meal_id === null) continue;
    const use = e.updated_at ?? e.created_at;
    if ((last.get(e.custom_meal_id) ?? '') < use) last.set(e.custom_meal_id, use);
  }
  return [...meals].sort(
    (a, b) =>
      (last.get(b.id) ?? '').localeCompare(last.get(a.id) ?? '') ||
      a.name_de.localeCompare(b.name_de, 'de') ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
