import { type Food, isCatalogReviewed, type SourceFoodCategory } from './food-schema';
import type { NutritionCatalogContext } from './recipe-checks';
import type { ContentIssue, ContentRuleId } from './rules';
import {
  type ContentValidationResult,
  type NutritionContentFile,
  validateContent,
} from './validate';

/**
 * Menschliche Katalog-Prüfung der Lebensmittel (R19, docs/PLAN-PHASE-5.md 5.1.1 d, R2-K6). Rein, ohne Dateisystem –
 * genutzt vom Workflow `content-review` (Art „katalog“) und vom Redaktionsbereich (Checkliste, Wächter N2d K6: eine
 * Quelle für Admin und Workflow).
 *
 * „Katalog geprüft“ setzt am Lebensmittel NUR `meta.catalog_reviewed_by/at` und gibt es frei (`status` = published,
 * `meta.reviewed_by/at`) – ohne Freigabe bliebe jedes Rezept damit gesperrt (Freigabe-Grund „Lebensmittel nicht
 * freigegeben“, Seed wartet). Nährwerte, Quelle, Gruppen und alle anderen Felder bleiben unverändert (die CI-Prüfung
 * `sources-integrity` lässt auf diesem Weg nur diese Felder zu). Version bleibt (nur Status/Meta).
 *
 * Gesetzt wird das nur für Lebensmittel, die im Stand NACH der Prüfung keinen roten Befund haben. Der Workflow öffnet
 * nur einen Pull Request – wirksam erst mit dem Merge durch einen Menschen.
 */

/** Checkliste der Katalog-Prüfung (R19, 5.1.1 d) – Redaktionsbereich und Pull-Request-Text. */
export const CATALOG_CHECKLIST: readonly string[] = [
  'Quell-ID passt zum Produkt (Bezeichnung in der Quelle vergleichen).',
  'Gruppen vollständig (Allergene/Unverträglichkeiten = Erwartungsliste).',
  'Tierische Bestandteile und Tierart (Fleischart, Gelatine-Herkunft).',
  'Schwangerschafts-Hinweis (z. B. Rohmilch, Rohwurst, Räucherfisch, Leber).',
  'Ersatzprodukte: nur für Gruppen, die das Ersatzprodukt wirklich nicht enthält.',
  'Haltbarkeit im Kühlschrank (Tage) und einfrierbar.',
  'Salz bei Aufschnitt und verarbeiteter Ware: Die Quelle ist oft ungesalzenes, gegartes Fleisch – Handelsware hat 1,5–2,5 g Salz je 100 g.',
  'Zeilen mit Lesart oder 🟡 im Gegencheck des Imports (Bericht von foods-import) zuerst ansehen.',
];

/**
 * Quell-Lebensmittelgruppen, bei denen das Salz besonders zu prüfen ist (Checkliste: „Salz bei Aufschnitt und
 * verarbeiteter Ware“). Quelle: Erfahrung aus Import-Lauf 1 (docs/PLAN-PHASE-5.md 5.1.1 d) – die Quelle führt oft
 * ungesalzenes, gegartes Fleisch bzw. unbehandelten Fisch/Tofu, die Handelsware ist gesalzen oder geräuchert.
 */
export const CATALOG_SALT_CHECK_CATEGORIES: readonly SourceFoodCategory[] = [
  'sausage_meat_products',
  'meat_beef_veal',
  'meat_pork',
  'meat_lamb',
  'meat_poultry',
  'meat_game',
  'offal',
  'fish',
  'crustaceans_molluscs',
  'soy_products',
  'composite_dishes',
];

/** true = beim Lebensmittel das Salz ausdrücklich prüfen (verarbeitete Ware möglich). */
export function catalogSaltCheck(food: Pick<Food, 'source'>): boolean {
  return CATALOG_SALT_CHECK_CATEGORIES.includes(food.source.category);
}

export interface CatalogReviewOptions {
  /** Prüfer (Name oder Kürzel). */
  readonly reviewer: string;
  /** Datum der Prüfung (ISO, Europe/Berlin). */
  readonly date: string;
}

/**
 * Stand des Lebensmittels NACH „Katalog geprüft“: Katalog-Prüfung und Freigabe. Ein schon freigegebenes Lebensmittel
 * behält seinen Prüfvermerk (`reviewed_by/at`). Alle anderen Felder bleiben gleich.
 */
export function catalogReviewedFood(food: Food, options: CatalogReviewOptions): Food {
  const published = food.status === 'published';
  return {
    ...food,
    status: 'published',
    meta: {
      ...food.meta,
      reviewed_by:
        published && food.meta.reviewed_by !== null ? food.meta.reviewed_by : options.reviewer,
      reviewed_at:
        published && food.meta.reviewed_at !== null ? food.meta.reviewed_at : options.date,
      catalog_reviewed_by: options.reviewer,
      catalog_reviewed_at: options.date,
    },
  };
}

export type CatalogReviewBlocker =
  /** Schon katalog-geprüft und freigegeben – nichts zu tun. */
  | { readonly kind: 'already_reviewed' }
  /** Zurückgezogen – bleibt so (erst über einen eigenen Weg wieder auf Entwurf). */
  | { readonly kind: 'archived' }
  /** Rote Befunde im Stand nach der Prüfung (z. B. R17 Nährwert ≠ Quelle, R18 Pflichtgruppe fehlt). */
  | {
      readonly kind: 'red_issues';
      readonly rules: readonly ContentRuleId[];
      readonly messages: readonly string[];
    };

export interface CatalogReviewDecision {
  readonly original: Food;
  readonly reviewed: Food;
  /** Leer = wird gesetzt. */
  readonly blockers: readonly CatalogReviewBlocker[];
}

/** Kurztext eines Grundes (Pull-Request-Text). */
export function catalogReviewBlockerText(blocker: CatalogReviewBlocker): string {
  switch (blocker.kind) {
    case 'already_reviewed':
      return 'schon katalog-geprüft und freigegeben';
    case 'archived':
      return 'zurückgezogen (bleibt so)';
    case 'red_issues':
      return `rote Befunde: ${blocker.messages.join(' · ')}`;
  }
}

/** Stichwort in den IDs: alle Lebensmittel aus Rezept-Entwürfen. */
export const CATALOG_RECIPES_KEYWORD = 'rezepte';

/**
 * IDs aller Lebensmittel, die in Rezept-Entwürfen vorkommen (auch optionale Zutaten), plus deren Ersatzprodukte
 * (transitiv – sonst wartet das Lebensmittel beim Einspielen auf sein Ersatzprodukt). Nur Lebensmittel, die es im
 * Katalog gibt; sortiert.
 */
export function foodIdsInRecipeDrafts(result: ContentValidationResult): string[] {
  const foods = new Map(result.foods.map((food) => [food.id, food]));
  const ids = new Set<string>();
  const queue = result.recipes
    .filter((recipe) => recipe.status === 'draft')
    .flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.food_id));
  while (queue.length > 0) {
    const id = queue.pop()!;
    const food = foods.get(id);
    if (food === undefined || ids.has(id)) continue;
    ids.add(id);
    queue.push(...food.substitutes.map((substitute) => substitute.food_id));
  }
  return [...ids].sort();
}

export interface CatalogReviewPlan {
  /** Je ausgewähltem Lebensmittel (Reihenfolge der Eingabe). */
  readonly decisions: readonly CatalogReviewDecision[];
  /** IDs, zu denen es kein (schemagültiges) Lebensmittel gibt. */
  readonly unknownIds: readonly string[];
}

function withData(
  files: readonly NutritionContentFile[],
  reviewed: ReadonlyMap<string, Food>,
): NutritionContentFile[] {
  return files.map((file) => {
    const id = (file.data as { id?: unknown } | undefined)?.id;
    const food = file.kind === 'food' && typeof id === 'string' ? reviewed.get(id) : undefined;
    return food === undefined ? file : { ...file, data: food };
  });
}

function redIssuesOf(issues: readonly ContentIssue[], id: string): ContentIssue[] {
  return issues.filter(
    (issue) => issue.kind === 'food' && issue.id === id && issue.severity === 'error',
  );
}

/**
 * Plant „Katalog geprüft“ für die IDs: Alle in Frage kommenden Lebensmittel werden probehalber geprüft und
 * freigegeben und zusammen mit allen anderen Ernährungs-Inhalten geprüft (`validateContent`, dieselben Regeln wie
 * content:validate). Lebensmittel mit rotem Befund fallen heraus; danach wird erneut geprüft, bis sich nichts mehr
 * ändert (sichere Richtung: lieber eins zu wenig als eins mit rotem Befund).
 */
export function planCatalogReview(
  files: readonly NutritionContentFile[],
  catalog: NutritionCatalogContext | undefined,
  ids: readonly string[],
  options: CatalogReviewOptions,
  before: ContentValidationResult = validateContent(files, validationOptions(catalog)),
): CatalogReviewPlan {
  const foods = new Map(before.foods.map((food) => [food.id, food]));
  const unknownIds = ids.filter((id) => !foods.has(id));
  const selected = [...new Set(ids)].filter((id) => foods.has(id)).map((id) => foods.get(id)!);
  const fixed = new Map<string, CatalogReviewBlocker[]>();
  for (const food of selected) {
    if (food.status === 'archived') fixed.set(food.id, [{ kind: 'archived' }]);
    else if (food.status === 'published' && isCatalogReviewed(food)) {
      fixed.set(food.id, [{ kind: 'already_reviewed' }]);
    }
  }
  let candidates = selected.filter((food) => !fixed.has(food.id));
  const red = new Map<string, ContentIssue[]>();
  for (;;) {
    const reviewed = new Map(
      candidates.map((food) => [food.id, catalogReviewedFood(food, options)]),
    );
    const after = validateContent(withData(files, reviewed), validationOptions(catalog));
    const failing = candidates.filter((food) => redIssuesOf(after.issues, food.id).length > 0);
    for (const food of failing) red.set(food.id, redIssuesOf(after.issues, food.id));
    if (failing.length === 0) break;
    candidates = candidates.filter((food) => !failing.includes(food));
  }
  const decisions = selected.map((food): CatalogReviewDecision => {
    const issues = red.get(food.id);
    const blockers: CatalogReviewBlocker[] =
      fixed.get(food.id) ??
      (issues === undefined
        ? []
        : [
            {
              kind: 'red_issues',
              rules: [...new Set(issues.map((issue) => issue.rule))],
              messages: issues.map((issue) => `${issue.rule}: ${issue.message}`),
            },
          ]);
    return {
      original: food,
      reviewed: blockers.length === 0 ? catalogReviewedFood(food, options) : food,
      blockers,
    };
  });
  return { decisions, unknownIds };
}

function validationOptions(catalog: NutritionCatalogContext | undefined) {
  return catalog === undefined ? {} : { nutritionCatalog: catalog };
}
