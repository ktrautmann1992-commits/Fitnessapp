import { RECIPE_EXTENSION_LIMITS } from '../constants';
import type { RecipeUnit } from '../nutrition/units';
import { normalizeFoodText } from './allergen-rules';
import type { Food } from './food-schema';
import type { IngredientRole, Recipe, RecipeCategoryId } from './recipe-schema';

/**
 * Fachregeln für den Import der Gründer-Datei (docs/PLAN-PHASE-5.md 19.2/19.4, Etappe N2c). Rein und
 * deterministisch; aufgerufen vom Import-Skript `content:import-alpha5` (packages/content) und – für R22 – von den
 * Prüfregeln. Alles, was die Sicherheit betrifft, geht in die SICHERE Richtung:
 * - `heated` ist `false` (→ `pregnancy_caution`), außer ein Zubereitungsschritt erhitzt genau diese Zutat
 *   eindeutig (Verb aus der Wortliste + Zutatenname im selben Schritt). Jede `true`-Annahme wird bei der Freigabe
 *   bestätigt (S4).
 * - Rollen der Zutaten sind nur ein Vorschlag (S6).
 */

/**
 * Wortliste „erhitzt“ (Plan 19.2: braten, kochen, backen, garen, dünsten, anbraten, köcheln, überbacken) in den
 * üblichen Formen der Zubereitungsschritte (Infinitiv, Imperativ „du“, 3. Person, Partizip), normalisiert wie
 * `normalizeFoodText` (ä → ae …). „kochend“ (kochendes Wasser) zählt bewusst NICHT – es erhitzt die Zutat nicht
 * eindeutig.
 */
export const HEAT_VERB_FORMS: readonly string[] = [
  // braten / anbraten
  'braten',
  'brate',
  'braet',
  'braetst',
  'bratet',
  'gebraten',
  'anbraten',
  'angebraten',
  'anbraet',
  // kochen
  'kochen',
  'koche',
  'kocht',
  'gekocht',
  'aufkochen',
  'aufgekocht',
  // backen / überbacken
  'backen',
  'backe',
  'baeckt',
  'backt',
  'gebacken',
  'ueberbacken',
  'ueberbacke',
  'ueberbaeckt',
  // garen
  'garen',
  'gare',
  'gart',
  'gegart',
  // dünsten / andünsten
  'duensten',
  'duenste',
  'duenstet',
  'geduenstet',
  'anduensten',
  'angeduenstet',
  // köcheln
  'koecheln',
  'koechle',
  'koechel',
  'koechelt',
  'gekoechelt',
];

const HEAT_VERBS = new Set(HEAT_VERB_FORMS);

/** Endungen, mit denen ein Zutatenname im Schritt noch als „derselbe“ gilt (Ei → Eier, Zwiebel → Zwiebeln). */
const NAME_SUFFIXES = ['', 'e', 'n', 'en', 'er', 'ern', 's', 'es'] as const;
/** Mindestlänge eines Kopfworts im Schritt, das als Anfang des Zutatennamens zählt („Lachs“ → „Lachsfilet“). */
const MIN_HEAD_WORD = 4;
/** Kurze Namen (z. B. „Ei“) nur mit diesen Endungen – sonst wäre „ein“ ein Treffer für „Ei“. */
const SHORT_NAME_SUFFIXES = ['', 'er', 'ern'] as const;

/** Füllwörter, die in Zutatennamen vorkommen, aber nichts benennen. */
const NAME_STOP_WORDS = new Set([
  'und',
  'mit',
  'ohne',
  'oder',
  'im',
  'in',
  'aus',
  'vom',
  'von',
  'der',
  'die',
  'das',
  'natur',
  'frisch',
  'tk',
  'trocken',
  'getrocknet',
  'abgetropft',
  'gekocht',
  'roh',
  'dose',
  'glas',
  'eigenen',
  'saft',
]);

function words(value: string): string[] {
  return normalizeFoodText(value)
    .split(/[\s-]+/)
    .filter((word) => word.length > 0);
}

/**
 * Namens-Wörter einer Zutat für den Abgleich mit den Schritten: alle Wörter der Namen (ohne Klammerzusätze und
 * Füllwörter). Beispiel: „Hähnchenbrust (roh)“ → „haehnchenbrust“; „Ei“ → „ei“.
 */
export function ingredientNameWords(names: readonly string[]): string[] {
  const result = new Set<string>();
  for (const name of names) {
    for (const word of words(name.replace(/\([^)]*\)/g, ' '))) {
      if (!NAME_STOP_WORDS.has(word) && !/^\d+$/.test(word)) {
        result.add(word);
      }
    }
  }
  return [...result].sort();
}

/**
 * Hinweise auf NICHT durchgegarte Zubereitung (Wächter N2c, B1): „erhitzt“ ist nicht „durchgegart“. Nennt ein Schritt
 * mit der Zutat eines dieser Muster, bleibt `heated` `false` (sichere Richtung, BfR: Ei und Fisch in der
 * Schwangerschaft nur durchgegart). Normalisiert wie `normalizeFoodText`; `=wort` = nur als ganzes Wort.
 */
export const NOT_FULLY_COOKED_PATTERNS: readonly string[] = [
  'glasig',
  '=rosa',
  '=medium',
  '=blutig',
  'halbgar',
  'spiegelei',
  'wachsweich',
  'weich gekocht',
  'weichgekocht',
  'weich kochen',
  'pochier',
  'eiweiss fest',
  'eiweiss gestockt',
  'eigelb fluessig',
  'fluessiges eigelb',
  'fluessigem eigelb',
  'carpaccio',
  'tatar',
  'sushi',
  'ceviche',
  'nur kurz',
  'kurz anbraten',
  'kurz angebraten',
  'kurz braten',
  'kurz brate',
  '=roh',
  '=rohe',
  '=rohen',
];

/** Mindest-Kochzeit, ab der ein gekochtes Ei als hart gilt (Minuten). PRODUKTENTSCHEIDUNG, Fachprüfung. */
export const EGG_HARD_MIN_MINUTES = 9;

/** Treffer eines Musters aus `NOT_FULLY_COOKED_PATTERNS` im Schritt (oder `null`). */
export function notFullyCookedHint(step: string): string | null {
  const text = ` ${words(step).join(' ')} `;
  for (const pattern of NOT_FULLY_COOKED_PATTERNS) {
    const whole = pattern.startsWith('=');
    const needle = whole ? ` ${pattern.slice(1)} ` : pattern;
    if (text.includes(needle)) {
      return whole ? pattern.slice(1) : pattern;
    }
  }
  return null;
}

/** Kleinste Minutenangabe im Schritt („6,5 Minuten“ → 6,5; „6–8 Min.“ → 6); `null` = keine. */
export function smallestMinutes(step: string): number | null {
  let result: number | null = null;
  for (const hit of step.matchAll(
    /(\d+(?:[.,]\d+)?)(?:\s*[–-]\s*\d+(?:[.,]\d+)?)?\s*(?:Minuten|Min\.?)(?![a-zäöü])/gu,
  )) {
    const value = Number((hit[1] ?? '').replace(',', '.'));
    result = result === null ? value : Math.min(result, value);
  }
  return result;
}

export interface HeatingOptions {
  /**
   * true = die Zutat ist ein Ei (Gruppe `eggs` bzw. `animal: egg`): `heated` nur bei „hart“ im Schritt oder einer
   * Kochzeit ab `EGG_HARD_MIN_MINUTES` Minuten (kleinste Angabe im Schritt).
   */
  readonly egg?: boolean;
}

/**
 * Index des ersten Zubereitungsschritts, der eine Zutat EINDEUTIG DURCHGART: Der Schritt enthält ein Verb aus
 * `HEAT_VERB_FORMS` und eines der Namens-Wörter (genau, mit Plural-/Beugungsendung oder als Kopfwort ab 4 Buchstaben,
 * z. B. „Lachs“ für „Lachsfilet“). Nennt IRGENDEIN Schritt mit der Zutat ein Muster aus
 * `NOT_FULLY_COOKED_PATTERNS` (glasig, Spiegelei, wachsweich …), gilt die Zutat als nicht durchgegart. Bei Eiern
 * zusätzlich „hart“ oder ≥ 9 Minuten. `null` → `heated: false` (sichere Richtung, Plan 19.2, Wächter N2c B1).
 */
export function findHeatingStep(
  steps: readonly string[],
  nameWords: readonly string[],
  options: HeatingOptions = {},
): number | null {
  if (nameWords.length === 0) {
    return null;
  }
  const variants = new Set(
    nameWords.flatMap((word) =>
      (word.length < 3 ? SHORT_NAME_SUFFIXES : NAME_SUFFIXES).map((s) => `${word}${s}`),
    ),
  );
  const longNames = nameWords.filter((word) => word.length >= MIN_HEAD_WORD);
  const names = (word: string) =>
    variants.has(word) ||
    // Kopfwort des Namens: „Lachs“ im Schritt für „Lachsfilet“, „Hähnchen“ für „Hähnchenbrust“.
    (word.length >= MIN_HEAD_WORD && longNames.some((name) => name.startsWith(word)));
  const mentioning = steps
    .map((step, index) => ({ step, index, stepWords: words(step) }))
    .filter(({ stepWords }) => stepWords.some(names));
  if (mentioning.some(({ step }) => notFullyCookedHint(step) !== null)) {
    return null;
  }
  for (const { step, index, stepWords } of mentioning) {
    if (!stepWords.some((word) => HEAT_VERBS.has(word))) {
      continue;
    }
    if (options.egg === true) {
      const hard = stepWords.some((word) => /^(hart(e[mnrs]?)?|hartgekocht\w*)$/u.test(word));
      const minutes = smallestMinutes(step);
      if (!hard && (minutes === null || minutes < EGG_HARD_MIN_MINUTES)) {
        continue;
      }
    }
    return index;
  }
  return null;
}

/** true = der Schritt enthält ein Verb aus `HEAT_VERB_FORMS` (die Zubereitung erhitzt etwas). */
export function stepHeats(step: string): boolean {
  return words(step).some((word) => HEAT_VERBS.has(word));
}

/**
 * Kochzeit aus den Schritten schätzen (Plan 19.2/19.4: maßgeblich ist `total_minutes`, die Aufteilung ist nur eine
 * Anzeige-Hilfe): Summe der Minuten („8 Minuten“, „8–10 Min.“ → obere Zahl) in Schritten, die erhitzen, höchstens
 * Gesamtzeit − 1 (mindestens 1 Minute Vorbereitung). Ohne Kochen 0.
 */
export function estimateCookMinutes(
  steps: readonly string[],
  totalMinutes: number,
  noCook: boolean,
): number {
  if (noCook || totalMinutes <= 1) {
    return 0;
  }
  let total = 0;
  for (const step of steps) {
    if (!stepHeats(step)) {
      continue;
    }
    for (const hit of step.matchAll(
      /(\d+)(?:\s*[–-]\s*(\d+))?\s*(?:Minuten|Min\.?)(?![a-zäöü])/gu,
    )) {
      total += Number(hit[2] ?? hit[1]);
    }
  }
  return Math.min(total, totalMinutes - 1);
}

/**
 * Vorschlag für die Rolle einer Zutat (19.4, S6) aus Katalogwerten – nur ein Vorschlag, bestätigt bei der
 * Freigabe. Reihenfolge: Prise → Würze; ≥ 50 g Zucker je 100 g → Süße; Gewürze/Backzutaten → Würze;
 * Obst & Gemüse (auch TK unter 100 kcal) → Gemüse; sonst nach Energieanteil (Eiweiß ≥ 30 % und ≥ 8 g → Eiweiß,
 * Fett ≥ 60 % → Fett, Kohlenhydrate ≥ 50 % → Kohlenhydrate, sonst der größte Anteil). PRODUKTENTSCHEIDUNG.
 */
export function proposeIngredientRole(
  food: Pick<Food, 'shopping_category' | 'nutrients_per_100g'>,
  unit: RecipeUnit,
): IngredientRole {
  const n = food.nutrients_per_100g;
  if (unit === 'pinch') {
    return 'seasoning';
  }
  if (n.sugar_g >= 50) {
    return 'sweet';
  }
  if (food.shopping_category === 'spices_baking') {
    return 'seasoning';
  }
  if (
    food.shopping_category === 'fruit_vegetables' ||
    (food.shopping_category === 'frozen' && n.kcal < 100)
  ) {
    return 'vegetable';
  }
  const protein = 4 * n.protein_g;
  const carbs = 4 * n.carbs_g;
  const fat = 9 * n.fat_g;
  const total = protein + carbs + fat;
  if (total === 0) {
    return 'seasoning';
  }
  if (protein / total >= 0.3 && n.protein_g >= 8) {
    return 'protein';
  }
  if (fat / total >= 0.6) {
    return 'fat';
  }
  if (carbs / total >= 0.5) {
    return 'carb';
  }
  const largest = Math.max(protein, carbs, fat);
  return largest === protein ? 'protein' : largest === fat ? 'fat' : 'carb';
}

/** Kategorien, die sich aus festen Merkmalen ergeben (Regel R22). */
export const CRITERIA_CATEGORIES = ['schnell', 'pre-workout', 'post-workout', 'meal-prep'] as const;
export type CriteriaCategory = (typeof CRITERIA_CATEGORIES)[number];

/** Gesamtzeit eines Rezepts: `total_minutes`, sonst Vorbereitung + Kochzeit. */
export function recipeTotalMinutes(
  recipe: Pick<Recipe, 'total_minutes' | 'prep_minutes' | 'cook_minutes'>,
): number {
  return recipe.total_minutes ?? recipe.prep_minutes + recipe.cook_minutes;
}

/**
 * Kategorien, die laut Merkmalen passen (R22): „schnell“ ⇔ Gesamtzeit ≤ 10 Min., „pre-workout“ ⇔ Trainings-Angabe
 * „vor dem Training“, „post-workout“ ⇔ „nach dem Training“, „meal-prep“ ⇔ für Meal-Prep geeignet.
 */
export function criteriaCategories(
  recipe: Pick<
    Recipe,
    'total_minutes' | 'prep_minutes' | 'cook_minutes' | 'training_tags' | 'meal_prep'
  >,
): Set<CriteriaCategory> {
  const result = new Set<CriteriaCategory>();
  if (recipeTotalMinutes(recipe) <= RECIPE_EXTENSION_LIMITS.quickMaxMinutes) {
    result.add('schnell');
  }
  if (recipe.training_tags.includes('vor_training')) {
    result.add('pre-workout');
  }
  if (recipe.training_tags.includes('nach_training')) {
    result.add('post-workout');
  }
  if (recipe.meal_prep.suitable) {
    result.add('meal-prep');
  }
  return result;
}

/** true = Kategorie ergibt sich aus Merkmalen (R22), sonst wird sie nur von Hand bzw. aus der Datei vergeben. */
export function isCriteriaCategory(id: RecipeCategoryId): id is CriteriaCategory {
  return (CRITERIA_CATEGORIES as readonly string[]).includes(id);
}
