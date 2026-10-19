import { z } from 'zod';

import { isoDateSchema } from '../age';
import { MEAL_SLOT_TIMES, PRINT_EXPORT } from '../constants';
import type { FoodLookup } from '../content/food-schema';
import type { Recipe } from '../content/recipe-schema';
import { contentReviewMark } from '../content/seed-settings';
import { addDays, isoWeekday } from '../dates';
import { mealsInDayOrder } from '../nutrition/day-view';
import { withoutNutrientAmounts } from '../nutrition/guides';
import type {
  MealPlanSlotKey,
  MealPlanWeek,
  PlannedMeal,
  PlannedMealDay,
} from '../nutrition/meal-plan';
import { weekHidesEnergyNumbers } from '../nutrition/person';
import type { ShoppingList, ShoppingListItem } from '../nutrition/shopping-list';
import type { ShoppingListRecipe } from '../nutrition/shopping-list-store';
import type { NutritionWeekTargets } from '../nutrition/targets';
import type { MealSlotId } from '../nutrition/timing';
import { SHOPPING_CATEGORIES } from '../content/food-schema';
import {
  printData as data,
  printDate as date,
  printLabel as label,
  type PrintBlock,
  type PrintCell,
  type PrintDocument,
  type PrintTableColumn,
  type PrintTableRow,
  type PrintText,
  printText as text,
} from './document';
import type {
  NutritionPrintDocument,
  PrintMealMark,
  PrintMealRow,
  PrintNutrientSource,
} from './nutrition-print-texts';
import { cleanPrintContent } from './print-values';

/**
 * Essensplan und Einkaufsliste → Druck-Dokument (docs/PLAN-PHASE-5.md 11, Etappe N6 – PDF P5, gratis, ohne KI).
 * Reine Funktionen; Ausgabe nur Codes und Daten (B11), die App übersetzt und packages/ui rendert.
 *
 * Datenschutz (11 „Nichts Verräterisches“, wie B1 beim Training):
 * - keine Ziele, keine Gründe, keine Unverträglichkeiten, kein Gewicht, keine Flags, keine Schwangerschaft, kein Alter
 *   – das Modell liest `usesHealthData`, Hinweise und Gründe leerer Plätze bewusst NICHT; leere Plätze heißen neutral
 *   „kein passendes Rezept“; Titel ohne „glutenfrei/laktosefrei“ (feste Codes);
 * - bewusste Ausnahme K4: Ersatz-Hinweise („Laktosefreie Milch statt Vollmilch“) und weggelassene optionale Zutaten
 *   der Rezepte (S3/S4) werden gedruckt – sonst würde falsch eingekauft bzw. gekocht; die App erwähnt das im
 *   Hinweis-Dialog vor dem Erzeugen;
 * - kcal NUR als Tagessumme (16 A Frage 16), nur bei „Kalorienzahlen anzeigen“, nur bei Tagen `complete`, nie in
 *   einer Woche mit Schwangerschaft/Stillzeit (B5, `weekHidesEnergyNumbers`); `below_floor` mit Hinweis statt Zahl;
 *   `no_targets` ohne Summe; keine Nährwerte je Rezept, keine kcal auf der Einkaufsliste;
 * - Arzt-Hinweis und Produkt-Hinweis (Spuren, HFI/Zöliakie) auf jedem Dokument, für alle gleich.
 */

// ---------------------------------------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------------------------------------

const nameSchema = z
  .string()
  .trim()
  .max(PRINT_EXPORT.nameMaxLength)
  .regex(/^[^\p{Cc}\p{Cf}]*$/u, 'Keine Steuer- oder Formatzeichen.');

export const nutritionPlanPrintOptionsSchema = z
  .strictObject({
    /** „Stand“ auf dem Deckblatt. */
    onDate: isoDateSchema,
    /** Name auf dem Deckblatt (11: optional, Standard aus). */
    includeName: z.boolean().default(false),
    name: nameSchema.nullable().default(null),
    /** Einstellung „Kalorienzahlen anzeigen“ (16 B (h)). */
    showEnergyNumbers: z.boolean(),
    /** Beispiel-Rezepte mit Testwerten (Testmodus): Kennzeichnung statt Quellenangabe. */
    testValues: z.boolean().default(false),
  })
  .refine((o) => !o.includeName || (o.name !== null && o.name.length > 0), {
    path: ['name'],
    message: 'Für den Namen auf dem Deckblatt bitte einen Namen angeben.',
  });

export type NutritionPlanPrintOptionsInput = z.input<typeof nutritionPlanPrintOptionsSchema>;
type NutritionPlanPrintOptions = z.output<typeof nutritionPlanPrintOptionsSchema>;

export const shoppingListPrintOptionsSchema = z.strictObject({
  /** „Stand“. */
  onDate: isoDateSchema,
});
export type ShoppingListPrintOptionsInput = z.input<typeof shoppingListPrintOptionsSchema>;

export interface NutritionPlanPrintInput {
  readonly plan: MealPlanWeek;
  /** Ziele der Woche – nur für `weekHidesEnergyNumbers` (B5); nichts davon wird gedruckt. */
  readonly targets: Pick<NutritionWeekTargets, 'days'>;
  readonly recipes: readonly Recipe[];
  readonly foods: FoodLookup;
}

export interface ShoppingListPrintInput {
  readonly list: ShoppingList & { readonly recipes?: readonly ShoppingListRecipe[] };
  /** Für die Titel der über „Zur Einkaufsliste“ hinzugefügten Rezepte. */
  readonly recipes: readonly Recipe[];
}

export type NutritionDocumentResult =
  | { readonly ok: true; readonly document: PrintDocument }
  | {
      readonly ok: false;
      /** `no_meals` = Plan ohne Mahlzeit; `recipe_missing` = Rezept (in dieser Version) nicht im Bestand. */
      readonly error: 'invalid_options' | 'no_meals' | 'recipe_missing';
    };

// ---------------------------------------------------------------------------------------------------------
// Seitenfluss (Höhen-Schätzung, wie Wächter K2 beim Trainingsplan)
// ---------------------------------------------------------------------------------------------------------

const PAGE_MM = PRINT_EXPORT.layout.pageHeightMm.portrait;
const L = PRINT_EXPORT.layout;
const N = PRINT_EXPORT.nutritionLayout;

const lines = (length: number, perLine: number) => Math.max(1, Math.ceil(length / perLine));

/** Grobe Zeichenzahl eines Textes (für Codes ohne festen Text eine vorsichtige Schätzung je Code). */
function chars(value: PrintText): number {
  switch (value.kind) {
    case 'data':
      return value.value.length;
    case 'date':
      return 10;
    case 'number':
      return 6;
    case 'text':
      switch (value.code) {
        case 'value.amount':
        case 'value.kcal':
        case 'mealplan.portion':
          return 10;
        case 'mealplan.mark':
        case 'mealplan.cell.none':
        case 'mealplan.cell.belowFloor':
          return 12;
        case 'recipe.ingredient': {
          const p = value.params as {
            food: string;
            original: string | null;
            optional: boolean;
            note: string | null;
          };
          return (
            p.food.length +
            (p.original !== null ? p.original.length + 6 : 0) +
            (p.optional ? 11 : 0) +
            (p.note !== null ? p.note.length + 3 : 0)
          );
        }
        case 'shopping.item':
          return (value.params as { label: string }).label.length + 14;
        // Wächter N6 K4: lange feste Texte nach gesetzten Teilen schätzen (Zeichen der deutschen Texte, aufgerundet).
        case 'mealplan.legend': {
          const p = value.params as Record<string, boolean>;
          return (
            50 +
            (p.hasFill ? 65 : 0) +
            (p.hasCook ? 55 : 0) +
            (p.hasLeftover ? 45 : 0) +
            (p.hasBelowFloor ? 120 : 0) +
            (p.hasNoRecipe ? 75 : 0) +
            (p.numbers ? 55 : 0)
          );
        }
        case 'nutrition.howTo': {
          const p = value.params as { document: string; numbers: boolean };
          return p.document === 'shopping_list' ? 230 : 270 + (p.numbers ? 65 : 0);
        }
        case 'nutrition.notice.products':
          return 210;
        default: {
          const strings = Object.values(value.params as Record<string, unknown>).flatMap((v) =>
            typeof v === 'string'
              ? [v]
              : Array.isArray(v)
                ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
                : [],
          );
          return 24 + strings.join(' ').length;
        }
      }
  }
}

const paragraphMm = (value: PrintText, muted = false) =>
  muted
    ? lines(chars(value), N.mutedCharsPerLine) * N.mutedLineMm + L.paragraphGapMm
    : lines(chars(value), N.bodyCharsPerLine) * L.bodyLineMm + L.paragraphGapMm;

const noticeMm = (value: PrintText) =>
  N.noticeBaseMm + lines(chars(value) + 20, N.bodyCharsPerLine) * L.bodyLineMm;

const h2Mm = (value: PrintText) =>
  N.h2Mm + (lines(chars(value), N.h2CharsPerLine) - 1) * N.h2LineMm;

/** Höhe einer Tabellenzeile: höchste Zelle (Zeilen je Zelle nach Zeichen je Zeile der Spalte). */
function rowMm(cells: readonly PrintCell[], perLine: readonly number[]): number {
  const maxLines = Math.max(
    1,
    ...cells.map((cell, i) =>
      cell.reduce((sum, value) => sum + lines(chars(value), perLine[i] ?? 10), 0),
    ),
  );
  return maxLines * L.tableLineMm + L.rowPaddingMm;
}

/** Blöcke mit geschätzter Höhe auf Seiten verteilen; jede neue Seite ist hochkant. */
class PageFlow {
  readonly blocks: PrintBlock[] = [];
  private used: number;

  constructor(firstPageUsedMm: number) {
    this.used = firstPageUsedMm;
  }

  get remaining(): number {
    return PAGE_MM - this.used;
  }

  get atTop(): boolean {
    return this.used === 0;
  }

  newPage(): void {
    this.blocks.push({ type: 'pageBreak', orientation: 'portrait' });
    this.used = 0;
  }

  /** Block anhängen; passt er nicht mehr, vorher neue Seite (mit Fortsetzungs-Überschrift). */
  add(block: PrintBlock, mm: number, continuation?: () => readonly [PrintBlock, number]): void {
    if (!this.atTop && mm > this.remaining) {
      this.newPage();
      if (continuation) {
        const [heading, headingMm] = continuation();
        this.push(heading, headingMm);
      }
    }
    this.push(block, mm);
  }

  push(block: PrintBlock, mm: number): void {
    this.blocks.push(block);
    this.used += mm;
  }
}

/**
 * Tabelle zeilenweise auf Seiten verteilen: so viele Zeilen wie passen, Rest auf Folgeseiten (mit
 * Fortsetzungs-Überschrift und wiederholter Kopfzeile).
 */
function flowTable(
  flow: PageFlow,
  make: (rows: PrintTableRow[], first: boolean) => PrintBlock,
  rows: readonly PrintTableRow[],
  heights: readonly number[],
  headMm: number,
  continuation: (() => readonly [PrintBlock, number]) | null,
): void {
  const next = () => {
    flow.newPage();
    if (continuation) {
      const [heading, mm] = continuation();
      flow.push(heading, mm);
    }
  };
  let index = 0;
  let first = true;
  while (index < rows.length) {
    if (!flow.atTop && headMm + (heights[index] ?? 0) > flow.remaining) next();
    const part: PrintTableRow[] = [];
    let used = headMm;
    while (index < rows.length) {
      const h = heights[index] ?? 0;
      if (part.length > 0 && used + h > flow.remaining) break;
      part.push(rows[index] as PrintTableRow);
      used += h;
      index += 1;
    }
    flow.push(make(part, first), used);
    first = false;
    if (index < rows.length) next();
  }
}

// ---------------------------------------------------------------------------------------------------------
// Gemeinsame Bausteine
// ---------------------------------------------------------------------------------------------------------

const content = (value: string): PrintText => data(cleanPrintContent(value));
const short = (value: string) => cleanPrintContent(value).slice(0, 200);

/** Arzt-Hinweis – auf jedem Dokument, für alle gleich. */
const MEDICAL: PrintBlock = {
  type: 'notice',
  title: label('nutrition.notice.title'),
  text: label('nutrition.notice.medical'),
};
const PRODUCTS: PrintBlock = {
  type: 'paragraph',
  muted: true,
  text: label('nutrition.notice.products'),
};
const TEST_VALUES: PrintBlock = {
  type: 'notice',
  title: label('nutrition.notice.title'),
  text: label('nutrition.notice.testValues'),
};

/** Höhe eines Blocks (nur für die festen Blöcke oben). */
function blockMm(block: PrintBlock): number {
  switch (block.type) {
    case 'notice':
      return noticeMm(block.text);
    case 'paragraph':
      return paragraphMm(block.text, block.muted === true);
    case 'heading':
      return block.level === 1 ? N.h1Mm : block.level === 2 ? h2Mm(block.text) : N.h3Mm;
    case 'keyValue':
      return block.items.length * L.bodyLineMm + 4;
    default:
      return 0;
  }
}

function footer(
  document: NutritionPrintDocument,
  sources: readonly PrintNutrientSource[],
  testValues: boolean,
): PrintText {
  return text('nutrition.doc.footer', { document, sources, testValues });
}

/** Nährwert-Quellen der verwendeten Lebensmittel (S13), eindeutig und sortiert. */
function nutrientSources(plan: MealPlanWeek, foods: FoodLookup): PrintNutrientSource[] {
  const found = new Map<string, PrintNutrientSource>();
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients) {
        const source = foods.get(ingredient.foodId)?.source;
        if (!source) continue;
        const entry = {
          db: source.db,
          version: short(source.version).slice(0, 40),
          license: short(source.license),
        };
        found.set(`${entry.db}|${entry.version}|${entry.license}`, entry);
      }
    }
  }
  return [...found.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, v]) => v)
    .slice(0, 6);
}

// ---------------------------------------------------------------------------------------------------------
// Essensplan: Wochenübersicht
// ---------------------------------------------------------------------------------------------------------

const isExtra = (slot: MealPlanSlotKey): slot is 'extra_1' | 'extra_2' =>
  slot === 'extra_1' || slot === 'extra_2';

function mealCell(meal: PlannedMeal, inExtraRow: boolean): PrintText[] {
  const marks: PrintMealMark[] = [];
  if (meal.isFill && !inExtraRow) marks.push('fill');
  if (meal.prepKind === 'cook') marks.push('cook');
  if (meal.prepKind === 'leftover') marks.push('leftover');
  return [
    content(meal.titleDe),
    text('mealplan.portion', { factor: meal.factor }),
    ...marks.map((mark) => text('mealplan.mark', { mark })),
  ];
}

/** Zeilen der Übersicht: alle Plätze der Woche in Tagesreihenfolge, Ergänzungen zusammen am Ende. */
function weekRows(plan: MealPlanWeek): PrintMealRow[] {
  const seen = new Map<MealSlotId, number>();
  let order = 0;
  for (const day of plan.days) {
    for (const slot of [...day.meals.map((m) => m.slot), ...day.emptySlots.map((e) => e.slot)]) {
      if (isExtra(slot) || seen.has(slot)) continue;
      seen.set(slot, order);
      order += 1;
    }
  }
  const rows: PrintMealRow[] = [...seen.keys()].sort(
    (a, b) => MEAL_SLOT_TIMES[a] - MEAL_SLOT_TIMES[b] || (seen.get(a) ?? 0) - (seen.get(b) ?? 0),
  );
  if (plan.days.some((day) => day.meals.some((m) => isExtra(m.slot)))) rows.push('extra');
  return rows;
}

function weekCell(day: PlannedMealDay, row: PrintMealRow): PrintCell {
  if (row === 'extra') {
    const extras = mealsInDayOrder(day).filter((m) => isExtra(m.slot));
    return extras.length === 0
      ? [label('mealplan.cell.none')]
      : extras.flatMap((meal) => mealCell(meal, true));
  }
  const meal = day.meals.find((m) => m.slot === row);
  if (meal) return mealCell(meal, false);
  // Leerer Platz: neutral, ohne Grund (kein Rückschluss auf Unverträglichkeiten oder Schwangerschaft).
  if (day.emptySlots.some((e) => e.slot === row)) return [label('mealplan.cell.noRecipe')];
  return [label('mealplan.cell.none')];
}

function dayTotalCell(day: PlannedMealDay, numbers: boolean): PrintCell {
  if (day.status === 'below_floor') return [label('mealplan.cell.belowFloor')];
  if (numbers && day.status === 'complete') {
    return [text('value.kcal', { kcal: Math.max(0, Math.round(day.totals.kcal)) })];
  }
  return [];
}

function weekOverview(flow: PageFlow, plan: MealPlanWeek, numbers: boolean): void {
  const days = plan.days;
  const columns: PrintTableColumn[] = [
    { header: label('mealplan.col.slot'), role: 'label' },
    ...days.map((day) => ({
      header: text('mealplan.col.day', { date: day.date }),
      role: 'value' as const,
    })),
  ];
  const rows: PrintTableRow[] = weekRows(plan).map((row) => ({
    header: [text('mealplan.slot', { slot: row })],
    cells: days.map((day) => weekCell(day, row)),
  }));
  const totals = days.map((day) => dayTotalCell(day, numbers));
  if (totals.some((cell) => cell.length > 0)) {
    rows.push({ header: [text('mealplan.row.day', { numbers })], cells: totals });
  }
  const perLine = Array.from({ length: columns.length }, () => N.weekCellCharsPerLine);
  const heights = rows.map((row) => rowMm([row.header, ...row.cells], perLine));
  const headMm = N.h2Mm + rowMm([[label('mealplan.col.slot')]], perLine) + 2;
  const heading = (continued: boolean) => text('mealplan.week.heading', { continued });
  flowTable(
    flow,
    (part, first) => ({
      type: 'table',
      caption: heading(!first),
      captionLevel: 2,
      columns,
      rows: part,
    }),
    rows,
    heights,
    headMm,
    // Folgeseiten: Tabellen-Titel „Wochenübersicht (Fortsetzung)“ samt Kopfzeile.
    null,
  );
  const meals = days.flatMap((day) => day.meals);
  const legend = text('mealplan.legend', {
    numbers: numbers && days.some((d) => d.status === 'complete'),
    hasFill: meals.some((m) => m.isFill),
    hasLeftover: meals.some((m) => m.prepKind === 'leftover'),
    hasCook: meals.some((m) => m.prepKind === 'cook'),
    hasBelowFloor: days.some((d) => d.status === 'below_floor'),
    hasNoRecipe: days.some((d) => d.emptySlots.length > 0),
  });
  flow.add({ type: 'paragraph', muted: true, text: legend }, paragraphMm(legend, true) + 12);
}

// ---------------------------------------------------------------------------------------------------------
// Essensplan: Rezepte
// ---------------------------------------------------------------------------------------------------------

interface RecipeUse {
  readonly date: string;
  readonly meal: PlannedMeal;
}

interface RecipeGroup {
  readonly key: string;
  readonly recipe: Recipe;
  readonly uses: RecipeUse[];
}

/** Gleiches Rezept mit gleichen Zutaten (Ersatz/Weglassen) = ein Rezept-Abschnitt. */
function recipeKey(meal: PlannedMeal): string {
  return JSON.stringify([
    meal.recipeId,
    meal.recipeVersion,
    meal.ingredients.map((i) => [i.index, i.foodId, i.originalFoodId, i.unit, i.optional]),
    meal.omittedOptional.map((o) => o.index),
  ]);
}

function recipeGroups(
  plan: MealPlanWeek,
  recipes: readonly Recipe[],
): RecipeGroup[] | 'recipe_missing' {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const groups = new Map<string, RecipeGroup>();
  for (const day of plan.days) {
    for (const meal of mealsInDayOrder(day)) {
      const recipe = byId.get(meal.recipeId);
      if (!recipe || recipe.version !== meal.recipeVersion) return 'recipe_missing';
      const key = recipeKey(meal);
      const group = groups.get(key);
      if (group) group.uses.push({ date: day.date, meal });
      else groups.set(key, { key, recipe, uses: [{ date: day.date, meal }] });
    }
  }
  return [...groups.values()];
}

interface Portion {
  readonly factor: number;
  readonly weekdays: number[];
  readonly amounts: ReadonlyMap<number, PlannedMeal['ingredients'][number]>;
}

/** Portionsgrößen eines Rezepts in der Woche (Faktor + Mengen), je mit den Wochentagen. */
function portionsOf(group: RecipeGroup): Portion[] {
  const portions = new Map<string, Portion>();
  for (const use of group.uses) {
    // Gleiche Mengen und gleicher angezeigter Faktor (2 Nachkommastellen) = eine Spalte.
    const key = JSON.stringify([
      Math.round(use.meal.factor * 100),
      use.meal.ingredients.map((i) => [i.index, i.amount]),
    ]);
    const weekday = isoWeekday(use.date);
    const existing = portions.get(key);
    if (existing) {
      if (!existing.weekdays.includes(weekday)) existing.weekdays.push(weekday);
    } else {
      portions.set(key, {
        factor: use.meal.factor,
        weekdays: [weekday],
        amounts: new Map(use.meal.ingredients.map((i) => [i.index, i])),
      });
    }
  }
  return [...portions.values()]
    .map((p) => ({ ...p, weekdays: [...p.weekdays].sort((a, b) => a - b) }))
    .sort((a, b) => a.factor - b.factor || (a.weekdays[0] ?? 0) - (b.weekdays[0] ?? 0));
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function recipeSection(flow: PageFlow, group: RecipeGroup, foods: FoodLookup): void {
  const { recipe } = group;
  const first = group.uses[0] as RecipeUse;
  const foodName = (id: string) => short(foods.get(id)?.name_de ?? id);
  const title = content(recipe.title_de);
  const continuation = (): readonly [PrintBlock, number] => {
    const heading = text('recipe.continued', { recipe: short(recipe.title_de) });
    return [{ type: 'heading', level: 2, text: heading }, h2Mm(heading)];
  };

  // Kopf: Titel, Plan-Tage, Zeit, Beschreibung, Kennzeichnungen.
  const head: [PrintBlock, number][] = [];
  const titleBlock: PrintBlock = { type: 'heading', level: 2, text: title };
  head.push([titleBlock, h2Mm(title)]);
  head.push([
    {
      type: 'keyValue',
      items: [
        {
          label: label('recipe.label.inPlan'),
          value: text('recipe.inPlan', {
            uses: group.uses.map((u) => ({ date: u.date, slot: u.meal.slot })),
          }),
        },
        {
          label: label('recipe.label.time'),
          value: text('recipe.time', { prep: recipe.prep_minutes, cook: recipe.cook_minutes }),
        },
      ],
    },
    2 * L.bodyLineMm + 4 + Math.floor(group.uses.length / 3) * L.bodyLineMm,
  ]);
  // Wächter N6 S1: Sätze mit kcal- oder Makro-Mengen fallen IMMER weg (keine Nährwerte je Rezept; die Menge gilt
  // für das Grundrezept, nicht für „× 1,5“) – dieselbe Erkennung wie im Ratgeber.
  const shownDescription = withoutNutrientAmounts(recipe.description_de);
  if (shownDescription !== null) {
    const description: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: content(shownDescription),
    };
    head.push([description, blockMm(description)]);
  }
  // Kennzeichen wie in der App (contentReviewMark, Wächter Testphase M1): KI-Entwurf bzw. Testphase (freigegeben, ohne
  // Fachprüfung – auch von Hand erfasste alpha5-Rezepte). Andere Entwürfe: Allergen-Hinweis unten.
  const reviewMark = contentReviewMark(recipe);
  if (reviewMark === 'ai_draft' || reviewMark === 'testphase') {
    const mark: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: label(reviewMark === 'ai_draft' ? 'recipe.mark.aiDraft' : 'recipe.mark.testphase'),
    };
    head.push([mark, blockMm(mark)]);
  }
  // Allergen-Hinweis (16 B (i)); Testphase wie in der App auch ohne Entwurf (Wächter M2, sichere Variante).
  const isDraft = first.meal.recipeStatus === 'draft' || recipe.status === 'draft';
  if (isDraft || reviewMark === 'testphase') {
    const warning: PrintBlock = {
      type: 'notice',
      title: label('nutrition.notice.title'),
      text: label(
        isDraft ? 'nutrition.notice.draftAllergens' : 'nutrition.notice.testphaseAllergens',
      ),
    };
    head.push([warning, blockMm(warning)]);
  }

  // Zutaten: je Portionsgröße eine Spalte (höchstens N.maxPortionColumns je Tabelle).
  const portions = portionsOf(group);
  const indexes = first.meal.ingredients.map((i) => i.index);
  const tables = chunk(portions, N.maxPortionColumns).map((part) => {
    const labelShare = 2.2 / (2.2 + 1.2 * part.length);
    const labelChars = Math.max(
      12,
      Math.floor((N.contentWidthMm * labelShare - 2.4) / N.tableCharMm),
    );
    const valueChars = Math.max(
      6,
      Math.floor((N.contentWidthMm * (1 - labelShare)) / part.length / N.tableCharMm - 1),
    );
    const perLine = [labelChars, ...part.map(() => valueChars)];
    const columns: PrintTableColumn[] = [
      { header: label('recipe.col.ingredient'), role: 'label' },
      ...part.map((portion) => ({
        header: text('recipe.col.portion', {
          factor: portion.factor,
          weekdays: portion.weekdays,
        }),
        role: 'value' as const,
      })),
    ];
    const rows: PrintTableRow[] = indexes.map((index) => {
      const ingredient = first.meal.ingredients.find((i) => i.index === index);
      const note = recipe.ingredients[index]?.note_de;
      return {
        header: [
          text('recipe.ingredient', {
            food: foodName(ingredient?.foodId ?? ''),
            original:
              ingredient?.originalFoodId != null ? foodName(ingredient.originalFoodId) : null,
            optional: ingredient?.optional ?? false,
            note: note ? short(note) : null,
          }),
        ],
        cells: part.map((portion) => {
          const scaled = portion.amounts.get(index);
          return scaled ? [text('value.amount', { amount: scaled.amount, unit: scaled.unit })] : [];
        }),
      };
    });
    const heights = rows.map((row) => rowMm([row.header, ...row.cells], perLine));
    const headMm =
      N.h3Mm +
      rowMm(
        columns.map((c) => [c.header]),
        perLine,
      );
    return { columns, rows, heights, headMm };
  });

  // Ganz auf die aktuelle Seite, wenn es passt; sonst neue Seite (halbe bis ganze Seite je Rezept).
  const stepsMm = recipe.steps_de.map(
    (step) => lines(step.length + 4, N.stepCharsPerLine) * L.bodyLineMm + N.stepGapMm,
  );
  const tailMm =
    N.h3Mm +
    stepsMm.reduce((a, b) => a + b, 0) +
    tables.reduce((sum, t) => sum + t.headMm + t.heights.reduce((a, b) => a + b, 0), 0);
  const headMm = head.reduce((sum, [, mm]) => sum + mm, 0);
  if (!flow.atTop && headMm + tailMm > flow.remaining) flow.newPage();
  // Kopf nie allein am Seitenende: mindestens Kopf + Tabellen-Kopf + erste Zutat.
  const firstTable = tables[0];
  const minimum = headMm + (firstTable ? firstTable.headMm + (firstTable.heights[0] ?? 0) : 0);
  if (!flow.atTop && minimum > flow.remaining) flow.newPage();
  for (const [block, mm] of head) flow.add(block, mm, continuation);

  tables.forEach((table) => {
    flowTable(
      flow,
      (rows) => ({
        type: 'table',
        caption: label('recipe.ingredients'),
        captionLevel: 3,
        columns: table.columns,
        rows,
      }),
      table.rows,
      table.heights,
      table.headMm,
      continuation,
    );
  });

  const omitted = first.meal.omittedOptional.map((o) => foodName(o.foodId));
  if (omitted.length > 0) {
    const block: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: text('recipe.omitted', { foods: omitted }),
    };
    flow.add(block, blockMm(block), continuation);
  }
  if (recipe.equipment_de.length > 0) {
    const block: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: text('recipe.equipment', { items: recipe.equipment_de.map(short) }),
    };
    flow.add(block, blockMm(block), continuation);
  }

  // Schritte: Überschrift nie allein am Seitenende; Schritte seitenweise (Nummerierung läuft weiter).
  let index = 0;
  let headingDone = false;
  while (index < recipe.steps_de.length) {
    const firstStep = stepsMm[index] ?? 0;
    const needed = (headingDone ? 0 : N.h3Mm) + firstStep;
    if (!flow.atTop && needed > flow.remaining) {
      flow.newPage();
      const [heading, mm] = continuation();
      flow.push(heading, mm);
    }
    if (!headingDone) {
      flow.push({ type: 'heading', level: 3, text: label('recipe.steps') }, N.h3Mm);
      headingDone = true;
    }
    const items: PrintText[] = [];
    let used = 0;
    const start = index + 1;
    while (index < recipe.steps_de.length) {
      const h = stepsMm[index] ?? 0;
      if (items.length > 0 && used + h > flow.remaining) break;
      items.push(content(recipe.steps_de[index] as string));
      used += h;
      index += 1;
    }
    flow.push({ type: 'steps', start, items }, used);
    if (index < recipe.steps_de.length) {
      flow.newPage();
      const [heading, mm] = continuation();
      flow.push(heading, mm);
    }
  }

  const prep = recipe.meal_prep;
  if (prep.suitable && (prep.fridge_days > 0 || prep.freezable)) {
    const block: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: text('recipe.storage', {
        fridgeDays: Math.min(30, Math.max(0, prep.fridge_days)),
        freezable: prep.freezable,
      }),
    };
    flow.add(block, blockMm(block), continuation);
  }
}

// ---------------------------------------------------------------------------------------------------------
// Dokumente
// ---------------------------------------------------------------------------------------------------------

/**
 * Essensplan der Woche als Druck-Dokument (11): Deckblatt (Logo, „Dein Essensplan“, Woche, optional Name, Arzt-
 * Hinweis), Wochenübersicht Mo–So × Mahlzeiten (Rezept + Portion; Tagessumme nur nach den Regeln oben), danach je
 * Rezept eine halbe bis ganze Seite (Zutaten je Portionsgröße, Schritte, Haltbarkeit). Hochkant.
 */
export function buildNutritionPlanDocument(
  input: NutritionPlanPrintInput,
  rawOptions: NutritionPlanPrintOptionsInput,
): NutritionDocumentResult {
  const parsed = nutritionPlanPrintOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) return { ok: false, error: 'invalid_options' };
  const options: NutritionPlanPrintOptions = parsed.data;
  const { plan } = input;
  if (plan.days.every((day) => day.meals.length === 0)) return { ok: false, error: 'no_meals' };
  const groups = recipeGroups(plan, input.recipes);
  if (groups === 'recipe_missing') return { ok: false, error: 'recipe_missing' };

  // B5/16 B (h): Zahlen nur mit „Kalorienzahlen anzeigen“ und nie in einer Woche mit Schwangerschaft/Stillzeit.
  const numbers = options.showEnergyNumbers && !weekHidesEnergyNumbers(input.targets);
  const weekEnd = addDays(plan.weekStart, 6);
  const isDraftGroup = (g: (typeof groups)[number]) =>
    g.recipe.status === 'draft' || g.uses.some((u) => u.meal.recipeStatus === 'draft');
  const hasDraft = groups.some(isDraftGroup);
  // Testphase (freigegeben ohne Fachprüfung): eigener Allergen-Hinweis auf dem Deckblatt (Wächter M2).
  const hasTestphase = groups.some(
    (g) => !isDraftGroup(g) && contentReviewMark(g.recipe) === 'testphase',
  );

  const items: { label: PrintText; value: PrintText }[] = [];
  if (options.includeName && options.name) {
    items.push({ label: label('cover.label.name'), value: data(options.name) });
  }
  items.push(
    {
      label: label('nutrition.label.week'),
      value: text('value.dateRange', { from: plan.weekStart, to: weekEnd }),
    },
    { label: label('cover.label.asOf'), value: date(options.onDate) },
  );
  const cover: PrintBlock[] = [
    {
      type: 'heading',
      level: 1,
      text: text('nutrition.cover.heading', { document: 'nutrition_plan' }),
    },
    { type: 'keyValue', items },
    MEDICAL,
    ...(options.testValues ? [TEST_VALUES] : []),
    ...(hasDraft
      ? [
          {
            type: 'notice',
            title: label('nutrition.notice.title'),
            text: label('nutrition.notice.draftAllergens'),
          } as const,
        ]
      : []),
    ...(hasTestphase
      ? [
          {
            type: 'notice',
            title: label('nutrition.notice.title'),
            text: label('nutrition.notice.testphaseAllergens'),
          } as const,
        ]
      : []),
    {
      type: 'paragraph',
      text: text('nutrition.howTo', { document: 'nutrition_plan', numbers }),
    },
    PRODUCTS,
  ];
  const flow = new PageFlow(N.brandMm);
  for (const block of cover) flow.push(block, blockMm(block));

  flow.newPage();
  weekOverview(flow, plan, numbers);

  flow.newPage();
  for (const group of groups) recipeSection(flow, group, input.foods);

  const sources = options.testValues ? [] : nutrientSources(plan, input.foods);
  return {
    ok: true,
    document: {
      meta: {
        kind: 'nutrition_plan',
        title: text('nutrition.doc.title', { document: 'nutrition_plan' }),
        fileName: `alpha5-essensplan-${plan.weekStart}`,
        footer: footer('nutrition_plan', sources, options.testValues),
        createdOn: options.onDate,
      },
      sections: flow.blocks,
    },
  };
}

/** Höhe eines Listen-Eintrags (zweispaltig). */
const itemMm = (cell: PrintCell) =>
  cell.reduce((sum, value) => sum + lines(chars(value), N.checklistCharsPerLine), 0) *
    N.checklistLineMm +
  N.checklistItemPadMm;

/** Kästchen-Liste zweispaltig auf Seiten verteilen (vorsichtig: halbe Summe + höchster Eintrag je Spalte). */
function flowChecklist(
  flow: PageFlow,
  caption: PrintText,
  entries: readonly { text: PrintCell; checked: boolean }[],
): void {
  const heights = entries.map((e) => itemMm(e.text));
  const columnMm = (part: readonly number[]) =>
    part.reduce((a, b) => a + b, 0) / 2 + Math.max(0, ...part);
  let index = 0;
  while (index < entries.length) {
    if (!flow.atTop && N.h3Mm + (heights[index] ?? 0) * 2 > flow.remaining) flow.newPage();
    const part: { text: PrintCell; checked: boolean }[] = [];
    const partHeights: number[] = [];
    while (index < entries.length) {
      const next = [...partHeights, heights[index] ?? 0];
      if (part.length > 0 && N.h3Mm + columnMm(next) > flow.remaining) break;
      part.push(entries[index] as { text: PrintCell; checked: boolean });
      partHeights.push(heights[index] ?? 0);
      index += 1;
    }
    flow.push(
      { type: 'checklist', caption, captionLevel: 3, columns: 2, items: part },
      N.h3Mm + columnMm(partHeights) + 2,
    );
    if (index < entries.length) flow.newPage();
  }
}

const itemText = (item: ShoppingListItem): PrintCell => [
  text('shopping.item', {
    amount: item.amount,
    unit: item.unit,
    label: short(item.labelDe),
    manual: item.isManual,
  }),
];

/**
 * Einkaufsliste als Druck-Dokument (11): nach Abteilungen, zwei Spalten, Kästchen (abgehakte mit Haken), Vorrat am
 * Ende, keine kcal, keine Gründe. Abgehakte Einträge, die nicht mehr im Plan sind (R2-S4), entfallen. Hochkant.
 */
export function buildShoppingListDocument(
  input: ShoppingListPrintInput,
  rawOptions: ShoppingListPrintOptionsInput,
): NutritionDocumentResult {
  const parsed = shoppingListPrintOptionsSchema.safeParse(rawOptions);
  if (!parsed.success) return { ok: false, error: 'invalid_options' };
  const options = parsed.data;
  const { list } = input;
  const items = list.items.filter((item) => !item.notInPlan);
  const entry = (item: ShoppingListItem) => ({ text: itemText(item), checked: item.checked });

  const flow = new PageFlow(N.brandMm);
  const top: PrintBlock[] = [
    {
      type: 'heading',
      level: 1,
      text: text('nutrition.cover.heading', { document: 'shopping_list' }),
    },
    {
      type: 'keyValue',
      items: [
        {
          label: label('nutrition.label.range'),
          value: text('value.dateRange', { from: list.from, to: list.to }),
        },
        { label: label('cover.label.asOf'), value: date(options.onDate) },
      ],
    },
    {
      type: 'paragraph',
      text: text('nutrition.howTo', { document: 'shopping_list', numbers: false }),
    },
  ];
  for (const block of top) flow.push(block, blockMm(block));

  const regular = items.filter((i) => !i.isPantry);
  if (items.length === 0) {
    const empty: PrintBlock = { type: 'paragraph', text: label('shopping.empty') };
    flow.push(empty, blockMm(empty));
  }
  for (const category of SHOPPING_CATEGORIES) {
    const inCategory = regular.filter((i) => i.category === category);
    if (inCategory.length === 0) continue;
    flowChecklist(flow, text('shopping.category', { category }), inCategory.map(entry));
  }
  const pantry = items.filter((i) => i.isPantry);
  if (pantry.length > 0) flowChecklist(flow, label('shopping.pantry'), pantry.map(entry));

  const titles = new Map(input.recipes.map((r) => [r.id, r.title_de]));
  const added = (list.recipes ?? []).flatMap((r) => {
    const title = titles.get(r.recipeId);
    return title ? [{ title: short(title), servings: r.servings }] : [];
  });
  if (added.length > 0) {
    const block: PrintBlock = {
      type: 'paragraph',
      muted: true,
      text: text('shopping.recipes', { recipes: added.slice(0, 100) }),
    };
    flow.add(block, blockMm(block));
  }
  flow.add(MEDICAL, blockMm(MEDICAL));
  flow.add(PRODUCTS, blockMm(PRODUCTS));

  return {
    ok: true,
    document: {
      meta: {
        kind: 'shopping_list',
        title: text('nutrition.doc.title', { document: 'shopping_list' }),
        fileName: `alpha5-einkaufsliste-${list.from}`,
        footer: footer('shopping_list', [], false),
        createdOn: options.onDate,
      },
      sections: flow.blocks,
    },
  };
}
