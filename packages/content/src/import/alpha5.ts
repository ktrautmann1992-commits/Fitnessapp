/**
 * Rezept-Import der Gründer-Datei `packages/content/seed/alpha5-rezepte.json` (docs/PLAN-PHASE-5.md 19.2, Etappe
 * N2c, Prompt B Schritt 4). Rein, ohne Dateisystem – Ablauf mit Dateien und Pull Request in `alpha5-run.ts`.
 *
 * - Eingabe strikt geprüft (`alpha5FileSchema`): unbekannte Felder, fehlende Pflichtfelder, doppelte IDs, unbekannte
 *   `zutat_id`, unbekannte Kategorie oder Abschnitt, Meal-Prep-Plan mit unbekanntem Rezept → `Alpha5InputError`,
 *   NICHTS wird geschrieben.
 * - Ausgabe nur `content/recipes/`, `content/meal-prep-plans/`, `content/guides/` – alles `status: draft`,
 *   `meta.origin: manual`, `meta.source_file: alpha5-rezepte.json@<version>`. NIE `content/foods/` (S3): Nährwerte
 *   kommen nur aus dem Katalog (N2b); die Werte der Datei sind nur Gegencheck.
 * - App-Auswahl (Gründer-Entscheidung 24.10.2026, `content/rezeptbuch-app-auswahl.json`, `app-selection.ts`): nur die
 *   ausgewählten Rezepte (etwa die Hälfte) und Meal-Prep-Pläne kommen in die App, der Rest bleibt nur im Buch.
 * - Idempotent über die IDs, menschliche Korrekturen bleiben (`meta.import_hash`, S5), `published`/`archived` werden
 *   nie überschrieben (R15), fehlende IDs nie gelöscht.
 */
import { createHash } from 'node:crypto';

import {
  CARB_LOADING_NOTICE_DE,
  canonicalJson,
  computeRecipeFacts,
  contentIdSchema,
  criteriaCategories,
  deriveStoragePlan,
  type DietType,
  estimateCookMinutes,
  findHeatingStep,
  type Food,
  type Guide,
  type ImportAssumption,
  ingredientNameWords,
  isoDateSchema,
  type MealPrepPlan,
  MEAL_PREP_FRIDGE_DAYS,
  type MealType,
  mentionsCarbLoading,
  needsHeatedFlag,
  proposeIngredientRole,
  RECIPE_CATEGORIES,
  type Recipe,
  type RecipeCategoryId,
  type RecipeIngredient,
  type RecipeUnit,
  type TrainingTag,
} from '@fitnessapp/core';
import { z } from 'zod';

import { alpha5Deviations, type Deviation, hasNoReference } from '../foods/import-source';
import { ALPHA5_ID_EXCEPTIONS } from '../foods/mapping';
import type { AppSelection } from './app-selection';
import { IMPORT_TOLERANCE_NOTE_DE } from './deviations';

export const ALPHA5_FILE_NAME = 'alpha5-rezepte.json';
export const RECIPES_DIR = 'content/recipes';
export const MEAL_PREP_PLANS_DIR = 'content/meal-prep-plans';
export const GUIDES_DIR = 'content/guides';

// ---------------------------------------------------------------------------------------------------------
// Eingabe-Schema (strikt)
// ---------------------------------------------------------------------------------------------------------

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'ID: nur a–z, 0–9 und Bindestriche.');
const str = z.string().min(1);
const per100 = z.strictObject({
  kcal: z.number().min(0),
  eiweiss_g: z.number().min(0),
  kohlenhydrate_g: z.number().min(0),
  fett_g: z.number().min(0),
});

/** Ernährungsformen der Datei („passt für“, nur Gegencheck). */
export const ALPHA5_DIETS = ['vegan', 'vegetarisch', 'fleisch', 'ohne-schwein'] as const;

/**
 * Abschnitte der Datei → Mahlzeit und Trainings-Angabe (Plan 19.2, Tabelle „Abbildung“ in N2a). Wettkampf-
 * Abschnitte werden importiert, aber nur über Suche/Ratgeber genutzt (Kategorie „wettkampf“, 19.6).
 */
export const ALPHA5_SECTIONS: Readonly<
  Record<
    string,
    { readonly mealTypes: readonly MealType[]; readonly training: readonly TrainingTag[] }
  >
> = {
  Frühstück: { mealTypes: ['breakfast'], training: [] },
  Mittagessen: { mealTypes: ['main'], training: [] },
  Abendessen: { mealTypes: ['main'], training: [] },
  Hauptgericht: { mealTypes: ['main'], training: [] },
  Snack: { mealTypes: ['snack'], training: [] },
  '60–90 Min. vorher': { mealTypes: ['snack'], training: ['vor_training'] },
  '30 Min. vorher': { mealTypes: ['snack'], training: ['vor_training'] },
  'Vor langen Einheiten': { mealTypes: ['snack'], training: ['vor_training'] },
  'Während der Einheit': { mealTypes: ['snack'], training: ['waehrend'] },
  'Direkt danach': { mealTypes: ['snack'], training: ['nach_training'] },
  'Bis 2 Stunden danach': { mealTypes: ['snack'], training: ['nach_training'] },
  'Nach der Einheit': { mealTypes: ['snack'], training: ['nach_training'] },
  'Ohne Backen': { mealTypes: ['snack'], training: [] },
  'Aus dem Ofen oder der Mikrowelle': { mealTypes: ['snack'], training: [] },
  Gefroren: { mealTypes: ['snack'], training: [] },
  'Carb-Loading (2 Tage vorher)': { mealTypes: ['main'], training: [] },
  'Renntag-Frühstück (3 Std. vorher)': { mealTypes: ['breakfast'], training: ['vor_training'] },
  'Am Vorabend': { mealTypes: ['main'], training: [] },
  'Im Rennen': { mealTypes: ['snack'], training: ['waehrend'] },
  'Nach dem Ziel': { mealTypes: ['snack'], training: ['nach_training'] },
  // Fassung 1.1: Fitness-Fast-Food, Heißluftfritteuse, Sommer-Eis.
  'Pizza & Flammkuchen': { mealTypes: ['main'], training: [] },
  'Burger & Hot Dog': { mealTypes: ['main'], training: [] },
  Klassiker: { mealTypes: ['main'], training: [] },
  Hauptgerichte: { mealTypes: ['main'], training: [] },
  'Beilagen & Gemüse': { mealTypes: ['main'], training: [] },
  'Snacks & Süßes': { mealTypes: ['snack'], training: [] },
  'Protein-Eis mit Mandeldrink': { mealTypes: ['snack'], training: [] },
  'Frozen Joghurt': { mealTypes: ['snack'], training: [] },
  'Sorbet & Erfrischung': { mealTypes: ['snack'], training: [] },
};

/**
 * Tags der Datei, die zu Feldern werden (ohne Groß-/Kleinschreibung); alle anderen werden `tags_de`.
 * „ohne Kochen“ → `no_cook`, „Meal-Prep“ → `meal_prep.suitable`, „vor/nach dem Training“ → `training_tags`.
 */
const FIELD_TAGS: Readonly<Record<string, TrainingTag | 'no_cook' | 'meal_prep'>> = {
  'ohne kochen': 'no_cook',
  'meal-prep': 'meal_prep',
  'vor dem training': 'vor_training',
  'nach dem training': 'nach_training',
};

/** Tags der Datei, die einer Themen-Kategorie entsprechen (zusätzlich zur `kategorie`). */
const TAG_CATEGORIES: Readonly<Record<string, RecipeCategoryId>> = {
  ausdauer: 'cardio',
  wettkampf: 'wettkampf',
  dessert: 'protein-dessert',
  'spar-küche': 'spar-kueche',
  'fitness-fast-food': 'fitness-fast-food',
  heißluftfritteuse: 'heissluftfritteuse',
  'sommer-eis': 'sommer-eis',
  'low carb': 'low-carb',
};

export const alpha5FileSchema = z
  .strictObject({
    format: z.literal('alpha5-rezepte'),
    version: z.string().regex(/^[0-9A-Za-z.-]{1,20}$/, 'Version: z. B. „1.0“.'),
    stand: isoDateSchema,
    hinweise: z.array(z.string()),
    kategorien: z.array(
      z.strictObject({ id: slug, name: str, typ: z.enum(['ernaehrungsform', 'thema']) }),
    ),
    ernaehrungsformen: z.array(z.strictObject({ id: z.enum(ALPHA5_DIETS), name: str })),
    abteilungen: z.array(str),
    /**
     * Zutatenlexikon des Rezeptbuchs (ab Fassung 1.1). Nur für das PDF – wird NICHT importiert: Nährwerte kommen
     * ausschließlich aus der Quelle über `foods-import` (S3).
     */
    zutatenlexikon: z.array(z.unknown()).optional(),
    zutaten: z.array(
      z.strictObject({
        id: slug,
        name: str,
        abteilung: str,
        pro_100g: per100,
        preis_eur_kg_schaetzung: z.number().min(0).optional(),
      }),
    ),
    rezepte: z.array(
      z.strictObject({
        id: contentIdSchema,
        name: str,
        beschreibung: str,
        kategorie: slug,
        abschnitt: str,
        ernaehrungsformen: z.array(z.enum(ALPHA5_DIETS)).min(1),
        zeit_min: z.number().int().min(1),
        portionen: z.number().int().min(1),
        tags: z.array(str),
        zutaten: z
          .array(z.strictObject({ zutat_id: slug, menge_g: z.number().min(0), anzeige: str }))
          .min(1),
        zubereitung: z.array(str).min(1),
        tipp: str,
        naehrwerte_pro_portion: per100,
        status: z.literal('draft'),
        meal_prep_plan: slug.optional(),
        kosten_eur_pro_portion: z.number().min(0).optional(),
      }),
    ),
    meal_prep_plaene: z.array(
      z.strictObject({
        id: contentIdSchema,
        ernaehrungsform: z.enum(ALPHA5_DIETS),
        titel: str,
        beschreibung: str,
        rezepte: z.array(slug).min(1),
        kochtag: z.array(z.strictObject({ min: z.number().int().min(0), schritt: str })).min(1),
        aufbewahrung: z.array(str),
        abendessen_hinweis: str,
      }),
    ),
    ratgeber: z.strictObject({
      wettkampf: z.array(z.strictObject({ titel: str, text: str })).min(1),
      // Ab Fassung 1.1: Tipps zu den Kapiteln Sommer-Eis und Heißluftfritteuse.
      eismaschine: z
        .array(z.strictObject({ titel: str, text: str }))
        .min(1)
        .optional(),
      heissluftfritteuse: z
        .array(z.strictObject({ titel: str, text: str }))
        .min(1)
        .optional(),
      unterwegs: z.strictObject({
        einleitung: str,
        grundregeln: z.array(str).min(1),
        orte: z.array(
          z.strictObject({
            ort: str,
            gut: z.array(str),
            lieber_seltener: z.array(str),
            trick: str,
          }),
        ),
      }),
    }),
  })
  .superRefine((file, ctx) => {
    const duplicates = (ids: readonly string[], path: string, what: string) => {
      const seen = new Set<string>();
      ids.forEach((id, index) => {
        if (seen.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: [path, index, 'id'],
            message: `${what} „${id}“ doppelt.`,
          });
        }
        seen.add(id);
      });
    };
    duplicates(
      file.zutaten.map((z) => z.id),
      'zutaten',
      'Zutat',
    );
    duplicates(
      file.rezepte.map((r) => r.id),
      'rezepte',
      'Rezept',
    );
    duplicates(
      file.meal_prep_plaene.map((p) => p.id),
      'meal_prep_plaene',
      'Meal-Prep-Plan',
    );
    duplicates(
      file.kategorien.map((k) => k.id),
      'kategorien',
      'Kategorie',
    );
    const ingredients = new Set(file.zutaten.map((z) => z.id));
    const categories = new Set(file.kategorien.map((k) => k.id));
    const recipes = new Set(file.rezepte.map((r) => r.id));
    const plans = new Set(file.meal_prep_plaene.map((p) => p.id));
    const departments = new Set(file.abteilungen);
    file.zutaten.forEach((zutat, index) => {
      if (!departments.has(zutat.abteilung)) {
        ctx.addIssue({
          code: 'custom',
          path: ['zutaten', index, 'abteilung'],
          message: `Unbekannte Abteilung „${zutat.abteilung}“.`,
        });
      }
    });
    file.kategorien.forEach((kategorie, index) => {
      const known =
        kategorie.typ === 'ernaehrungsform'
          ? (ALPHA5_DIETS as readonly string[]).includes(kategorie.id)
          : RECIPE_CATEGORIES.some((c) => c.id === kategorie.id);
      if (!known) {
        ctx.addIssue({
          code: 'custom',
          path: ['kategorien', index, 'id'],
          message: `Unbekannte Kategorie „${kategorie.id}“ (${kategorie.typ}) – erst in RECIPE_CATEGORIES aufnehmen.`,
        });
      }
    });
    file.rezepte.forEach((rezept, index) => {
      if (!categories.has(rezept.kategorie)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rezepte', index, 'kategorie'],
          message: `Unbekannte Kategorie „${rezept.kategorie}“.`,
        });
      }
      if (ALPHA5_SECTIONS[rezept.abschnitt] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['rezepte', index, 'abschnitt'],
          message: `Unbekannter Abschnitt „${rezept.abschnitt}“ – Zuordnung in ALPHA5_SECTIONS ergänzen.`,
        });
      }
      if (rezept.meal_prep_plan !== undefined && !plans.has(rezept.meal_prep_plan)) {
        ctx.addIssue({
          code: 'custom',
          path: ['rezepte', index, 'meal_prep_plan'],
          message: `Unbekannter Meal-Prep-Plan „${rezept.meal_prep_plan}“.`,
        });
      }
      rezept.zutaten.forEach((zutat, j) => {
        if (!ingredients.has(zutat.zutat_id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['rezepte', index, 'zutaten', j, 'zutat_id'],
            message: `Unbekannte Zutat „${zutat.zutat_id}“.`,
          });
        } else if (zutat.menge_g === 0 && parseZeroAmount(zutat.anzeige) === null) {
          ctx.addIssue({
            code: 'custom',
            path: ['rezepte', index, 'zutaten', j, 'anzeige'],
            message: `Menge 0 g und Anzeige „${zutat.anzeige}“ nicht umwandelbar (erlaubt: Prise, Messerspitze, nach Geschmack, TL, EL, ml, Stück-Angaben).`,
          });
        }
      });
    });
    file.meal_prep_plaene.forEach((plan, index) => {
      plan.rezepte.forEach((id, j) => {
        if (!recipes.has(id)) {
          ctx.addIssue({
            code: 'custom',
            path: ['meal_prep_plaene', index, 'rezepte', j],
            message: `Meal-Prep-Plan nennt unbekanntes Rezept „${id}“.`,
          });
        }
      });
    });
  });
export type Alpha5File = z.infer<typeof alpha5FileSchema>;
type Alpha5Recipe = Alpha5File['rezepte'][number];

/** Eingabe ungültig – es wird nichts geschrieben. */
export class Alpha5InputError extends Error {
  constructor(
    readonly problems: readonly string[],
    fileName: string = ALPHA5_FILE_NAME,
  ) {
    super(
      [
        `${fileName} ist ungültig – Import abgebrochen, nichts geschrieben:`,
        ...problems.slice(0, 30).map((p) => `- ${p}`),
        ...(problems.length > 30 ? [`- … und ${problems.length - 30} weitere`] : []),
      ].join('\n'),
    );
    this.name = 'Alpha5InputError';
  }
}

/** Prüft die Datei; wirft `Alpha5InputError` mit verständlichen Meldungen. */
export function parseAlpha5File(data: unknown): Alpha5File {
  const parsed = alpha5FileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Alpha5InputError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || '(Datei)'}: ${issue.message}`),
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------------------------------------
// Mengen
// ---------------------------------------------------------------------------------------------------------

const FRACTIONS: Readonly<Record<string, number>> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };

/** Zahl am Anfang: „2“, „1,5“, „½“, „1 ½“, „1/3“; bei Spannen „1–2“ die erste Zahl. */
function leadingNumber(text: string): number | null {
  const match = /^(\d+(?:[.,]\d+)?)?\s*([½¼¾]|\d+\/\d+)?/u.exec(text.trim());
  if (match === null || (match[1] === undefined && match[2] === undefined)) {
    return null;
  }
  let value = match[1] === undefined ? 0 : Number(match[1].replace(',', '.'));
  const fraction = match[2];
  if (fraction !== undefined) {
    if (fraction.includes('/')) {
      const [a, b] = fraction.split('/').map(Number);
      value = match[1] === undefined ? (a ?? 0) / (b ?? 1) : value + (a ?? 0) / (b ?? 1);
    } else {
      value += FRACTIONS[fraction] ?? 0;
    }
  }
  return Math.round(value * 1000) / 1000;
}

export interface ZeroAmount {
  readonly amount: number;
  readonly unit: RecipeUnit;
  readonly scales: boolean;
}

/**
 * Zutaten mit `menge_g: 0` (Plan N2a-Tabelle): Prise/Messerspitze → `pinch` 1; „nach Geschmack“ → `pinch` 1,
 * `scales: false` (Schema verlangt Menge > 0); TL/EL/ml → `tsp`/`tbsp`/`ml` (Umrechnung über den Katalog, sonst
 * R2); Stück-Angaben (Blätter, Eiswürfel) → `piece`. „100 ml + 50 ml“ wird addiert. null = nicht umwandelbar.
 */
export function parseZeroAmount(display: string): ZeroAmount | null {
  const text = display.trim();
  if (/nach geschmack/iu.test(text)) {
    return { amount: 1, unit: 'pinch', scales: false };
  }
  if (/prise|messerspitze/iu.test(text)) {
    const n = leadingNumber(text);
    return { amount: n !== null && n > 0 ? n : 1, unit: 'pinch', scales: true };
  }
  const parts = text.split('+').map((part) => part.trim());
  let total = 0;
  let unit: RecipeUnit | null = null;
  for (const part of parts) {
    const n = leadingNumber(part);
    const rest = part.replace(/^[\d.,½¼¾/\s–-]+/u, '');
    const partUnit: RecipeUnit | null = /^TL\b/u.test(rest)
      ? 'tsp'
      : /^EL\b/u.test(rest)
        ? 'tbsp'
        : /^ml\b/u.test(rest)
          ? 'ml'
          : /^(Blätter|Blatt|Eiswürfel|Stück|Stk\.?)/u.test(rest)
            ? 'piece'
            : null;
    if (n === null || n <= 0 || partUnit === null || (unit !== null && unit !== partUnit)) {
      return null;
    }
    unit = partUnit;
    total += n;
  }
  return unit === null ? null : { amount: Math.round(total * 1000) / 1000, unit, scales: true };
}

// ---------------------------------------------------------------------------------------------------------
// Umwandlung
// ---------------------------------------------------------------------------------------------------------

/** Katalog-ID einer Zutat der Datei („ei“ → „huehnerei“, Umsetzungsstand N2b). */
export function foodIdFor(zutatId: string): string {
  return ALPHA5_ID_EXCEPTIONS[zutatId] ?? zutatId;
}

function declaredDiet(diets: readonly string[]): DietType {
  return diets.includes('vegan')
    ? 'vegan'
    : diets.includes('vegetarisch')
      ? 'vegetarian'
      : 'omnivore';
}

export interface BuildContext {
  readonly file: Alpha5File;
  /** Katalog (schema-gültige Lebensmittel aus `content/foods/`). */
  readonly foods: ReadonlyMap<string, Food>;
}

export interface BuiltRecipe {
  /**
   * Rezept (`version` 1, ohne `meta.import_hash` – setzt `planWrite`). Fehlen Lebensmittel im Katalog
   * (`missing`), ist es nur für die Strukturprüfung im Bericht gedacht und wird NICHT geschrieben.
   */
  readonly recipe: Recipe;
  /** Katalog-IDs, die im Katalog fehlen. */
  readonly missing: readonly string[];
  readonly assumptions: readonly ImportAssumption[];
  /** Zutaten mit `heated: false` als Vorgabe (sichere Richtung, Bericht). */
  readonly heatedFalse: readonly string[];
  readonly zeroAmounts: readonly { zutat: string; anzeige: string; unit: RecipeUnit }[];
}

/**
 * Baut ein Rezept. Geschrieben wird es nur, wenn alle Lebensmittel im Katalog sind (`missing` leer); sonst fehlen
 * die aus dem Katalog berechneten Angaben (Allergene, `heated`, Rolle) und es dient nur der Strukturprüfung.
 */
export function buildRecipe(rezept: Alpha5Recipe, ctx: BuildContext): BuiltRecipe {
  const missing = [
    ...new Set(rezept.zutaten.map((z) => foodIdFor(z.zutat_id)).filter((id) => !ctx.foods.has(id))),
  ];
  const names = new Map(ctx.file.zutaten.map((z) => [z.id, z.name]));
  const section = ALPHA5_SECTIONS[rezept.abschnitt] ?? { mealTypes: ['main'], training: [] };

  const tagFields = new Set<string>();
  const tagsDe: string[] = [];
  const seenTags = new Set<string>();
  const tagCategories = new Set<RecipeCategoryId>();
  for (const tag of rezept.tags) {
    const key = tag.toLocaleLowerCase('de-DE');
    const field = FIELD_TAGS[key];
    const category = TAG_CATEGORIES[key];
    if (category !== undefined) {
      tagCategories.add(category);
    }
    if (field !== undefined) {
      tagFields.add(field);
    } else if (!seenTags.has(key)) {
      seenTags.add(key);
      tagsDe.push(tag);
    }
  }
  const noCook = tagFields.has('no_cook');
  const trainingTags = new Set<TrainingTag>(section.training);
  if (tagFields.has('vor_training')) trainingTags.add('vor_training');
  if (tagFields.has('nach_training')) trainingTags.add('nach_training');

  const assumptions: ImportAssumption[] = [];
  const heatedFalse: string[] = [];
  const zeroAmounts: BuiltRecipe['zeroAmounts'][number][] = [];
  const ingredients: RecipeIngredient[] = rezept.zutaten.map((zutat, index) => {
    const foodId = foodIdFor(zutat.zutat_id);
    const food = ctx.foods.get(foodId);
    let amount = zutat.menge_g;
    let unit: RecipeUnit = 'g';
    let scales = true;
    if (zutat.menge_g === 0) {
      const parsed = parseZeroAmount(zutat.anzeige) as ZeroAmount;
      amount = parsed.amount;
      unit = parsed.unit;
      scales = parsed.scales;
      zeroAmounts.push({ zutat: zutat.zutat_id, anzeige: zutat.anzeige, unit });
    }
    let heated: boolean | undefined;
    if (food !== undefined && needsHeatedFlag(food)) {
      heated = false;
      if (!noCook) {
        const words = ingredientNameWords([
          names.get(zutat.zutat_id) ?? zutat.zutat_id,
          food.name_de,
          ...food.aliases_de,
        ]);
        const step = findHeatingStep(rezept.zubereitung, words, {
          egg: food.groups.includes('eggs') || food.animal.includes('egg'),
        });
        if (step !== null) {
          heated = true;
          assumptions.push({
            ingredient_index: index,
            food_id: foodId,
            field: 'heated',
            value: true,
            reason_de: `Schritt ${step + 1} gart die Zutat durch: „${truncate(rezept.zubereitung[step] ?? '', 200)}“`,
          });
        }
      }
      if (heated === false) {
        heatedFalse.push(foodId);
      }
    }
    return {
      food_id: foodId,
      amount,
      unit,
      optional: false,
      display_de: zutat.anzeige,
      scales,
      ...(heated === undefined ? {} : { heated }),
      ...(food === undefined ? {} : { role: proposeIngredientRole(food, unit) }),
    };
  });

  const totalMinutes = rezept.zeit_min;
  const cookMinutes = estimateCookMinutes(rezept.zubereitung, totalMinutes, noCook);
  const draft = {
    ingredients,
    servings: rezept.portionen,
    no_cook: noCook,
    steps_de: [...rezept.zubereitung],
    // Unbestätigte Annahmen „erhitzt“ zählen für die Schwangerschaft wie false (Wächter N2c, B1).
    meta: { import_assumptions: assumptions, import_assumptions_confirmed_by: null },
  };
  const facts = computeRecipeFacts(draft, ctx.foods);
  const suitable = tagFields.has('meal_prep') || rezept.meal_prep_plan !== undefined;
  const mealPrep = {
    suitable,
    fridge_days: suitable ? Math.min(MEAL_PREP_FRIDGE_DAYS.max, facts.maxFridgeDays ?? 0) : 0,
    freezable: suitable && ingredients.every((i) => ctx.foods.get(i.food_id)?.freezable === true),
  };

  const partial = {
    total_minutes: totalMinutes,
    prep_minutes: totalMinutes - cookMinutes,
    cook_minutes: cookMinutes,
    training_tags: [...trainingTags],
    meal_prep: mealPrep,
  };
  const categories = new Set<RecipeCategoryId>([
    ...(RECIPE_CATEGORIES.some((c) => c.id === rezept.kategorie)
      ? [rezept.kategorie as RecipeCategoryId]
      : []),
    ...tagCategories,
    ...criteriaCategories(partial),
  ]);

  const recipe: Recipe = {
    id: rezept.id,
    version: 1,
    status: 'draft',
    title_de: rezept.name,
    description_de: rezept.beschreibung,
    section_de: rezept.abschnitt,
    categories: RECIPE_CATEGORIES.map((c) => c.id).filter((id) => categories.has(id)),
    meal_types: [...section.mealTypes],
    training_tags: (['vor_training', 'waehrend', 'nach_training'] as const).filter((t) =>
      trainingTags.has(t),
    ),
    servings: rezept.portionen,
    ingredients,
    steps_de: [...rezept.zubereitung],
    tip_de: rezept.tipp,
    ...(tagsDe.length > 0 ? { tags_de: tagsDe } : {}),
    ...(rezept.meal_prep_plan === undefined ? {} : { meal_prep_plan_id: rezept.meal_prep_plan }),
    total_minutes: totalMinutes,
    prep_minutes: partial.prep_minutes,
    cook_minutes: cookMinutes,
    no_cook: noCook,
    meal_prep: mealPrep,
    equipment_de: [],
    declared_per_serving: {
      kcal: rezept.naehrwerte_pro_portion.kcal,
      protein_g: rezept.naehrwerte_pro_portion.eiweiss_g,
      carbs_g: rezept.naehrwerte_pro_portion.kohlenhydrate_g,
      fat_g: rezept.naehrwerte_pro_portion.fett_g,
    },
    declared_diet: declaredDiet(rezept.ernaehrungsformen),
    // Deklarierte Allergene und Schwangerschafts-Vorsicht = BERECHNET (Plan 19.2, S4): R7/R13 sind für
    // importierte Rezepte bewusst ohne eigene Gegenprobe – abgesichert über R18, Erwartungsliste, R19 und die
    // Fachprüfung.
    declared_allergens: [...facts.allergens],
    contains_pork: !rezept.ernaehrungsformen.includes('ohne-schwein'),
    declared_pregnancy_caution: facts.pregnancyCaution,
    ...(rezept.kosten_eur_pro_portion === undefined
      ? {}
      : {
          cost_estimate: {
            eur_per_serving: rezept.kosten_eur_pro_portion,
            as_of: ctx.file.stand,
            basis: 'estimate' as const,
          },
        }),
    meta: {
      ...importMeta(ctx.file),
      import_assumptions: assumptions,
      import_assumptions_confirmed_by: null,
    },
  };
  return { recipe, missing, assumptions, heatedFalse, zeroAmounts };
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

function importMeta(file: Alpha5File) {
  return {
    origin: 'manual' as const,
    model: null,
    batch_id: null,
    created_on: file.stand,
    expert_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    source_file: `${ALPHA5_FILE_NAME}@${file.version}`,
  };
}

export function buildMealPrepPlan(
  plan: Alpha5File['meal_prep_plaene'][number],
  file: Alpha5File,
  recipes: ReadonlyMap<string, Recipe>,
): MealPrepPlan | { missing: string[] } {
  const missing = plan.rezepte.filter((id) => !recipes.has(id));
  if (missing.length > 0) {
    return { missing };
  }
  return {
    id: plan.id,
    version: 1,
    status: 'draft',
    title_de: plan.titel,
    description_de: plan.beschreibung,
    recipe_ids: [...plan.rezepte],
    cook_steps: plan.kochtag.map((step) => ({ start_min: step.min, text_de: step.schritt })),
    // Aus R9 hergeleitet (sichere Richtung); die Freitexte der Datei prüft R20 (Frage 19.12 (b)).
    storage_plan: deriveStoragePlan(plan.rezepte.map((id) => recipes.get(id) as Recipe)),
    storage_de: [...plan.aufbewahrung],
    dinner_hint_de: plan.abendessen_hinweis,
    meta: importMeta(file),
  };
}

/** Titel der Ratgeber (KONZEPT 6.8). */
export const GUIDE_TITLES = {
  wettkampf: 'Wettkampf-Ernährung',
  unterwegs: 'Unterwegs essen',
  eismaschine: 'Eis selbst machen',
  heissluftfritteuse: 'Kochen mit der Heißluftfritteuse',
} as const;

/** Ratgeber aus Abschnitten „Titel + Text“ (Eismaschine, Heißluftfritteuse; ab Fassung 1.1). */
function tipsGuide(
  file: Alpha5File,
  id: 'eismaschine' | 'heissluftfritteuse',
  tips: readonly { titel: string; text: string }[] | undefined,
): Guide[] {
  if (tips === undefined) {
    return [];
  }
  return [
    {
      id,
      version: 1,
      status: 'draft',
      title_de: GUIDE_TITLES[id],
      sections: tips.map((tip) => ({ heading_de: tip.titel, body_de: [tip.text] })),
      meta: importMeta(file),
    },
  ];
}

export function buildGuides(file: Alpha5File): Guide[] {
  const { wettkampf, unterwegs, eismaschine, heissluftfritteuse } = file.ratgeber;
  return [
    {
      id: 'unterwegs',
      version: 1,
      status: 'draft',
      title_de: GUIDE_TITLES.unterwegs,
      intro_de: unterwegs.einleitung,
      sections: [{ heading_de: 'Grundregeln', body_de: [...unterwegs.grundregeln] }],
      places: unterwegs.orte.map((ort) => ({
        name_de: ort.ort,
        good_de: [...ort.gut],
        less_often_de: [...ort.lieber_seltener],
        tip_de: ort.trick,
      })),
      meta: importMeta(file),
    },
    {
      id: 'wettkampf',
      version: 1,
      status: 'draft',
      title_de: GUIDE_TITLES.wettkampf,
      sections: wettkampf.map((section) => ({
        heading_de: section.titel,
        body_de: [section.text],
        // Fester Hinweis beim Carb-Loading (R21, KONZEPT 6.8).
        ...(mentionsCarbLoading(section.titel) || mentionsCarbLoading(section.text)
          ? { notice_de: CARB_LOADING_NOTICE_DE }
          : {}),
      })),
      meta: importMeta(file),
    },
    ...tipsGuide(file, 'eismaschine', eismaschine),
    ...tipsGuide(file, 'heissluftfritteuse', heissluftfritteuse),
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Schreiben planen: Hash, Versionen, Schutz menschlicher Korrekturen
// ---------------------------------------------------------------------------------------------------------

type ImportedKind = 'recipe' | 'meal_prep_plan' | 'guide';

const DIRS: Readonly<Record<ImportedKind, string>> = {
  recipe: RECIPES_DIR,
  meal_prep_plan: MEAL_PREP_PLANS_DIR,
  guide: GUIDES_DIR,
};

interface WithMeta {
  version: number;
  status: string;
  meta: Record<string, unknown>;
}

function withoutHash(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  const record = value as { meta?: unknown };
  const meta =
    record.meta !== null && typeof record.meta === 'object'
      ? Object.fromEntries(
          Object.entries(record.meta as Record<string, unknown>).filter(
            ([key]) => key !== 'import_hash',
          ),
        )
      : record.meta;
  return { ...record, meta };
}

/** SHA-256 der Import-Ausgabe ohne `meta.import_hash` (Plan 19.2, S5). */
export function importHash(value: unknown): string {
  return createHash('sha256')
    .update(canonicalJson(withoutHash(value)))
    .digest('hex');
}

/** Setzt `version` und `meta.import_hash` (Hash über alles andere). Schlüsselreihenfolge bleibt fest. */
function finalize<T extends WithMeta>(content: T, version: number): T {
  const withVersion = { ...content, version, meta: { ...content.meta } };
  delete withVersion.meta.import_hash;
  return {
    ...withVersion,
    meta: { ...withVersion.meta, import_hash: importHash(withVersion) },
  } as T;
}

/** Oberste Felder, in denen sich zwei Stände unterscheiden (ohne `version` und `meta.import_hash`). */
function changedFields(before: unknown, after: unknown): string[] {
  const a = withoutHash(before) as Record<string, unknown>;
  const b = withoutHash(after) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].sort();
  return keys.filter(
    (key) => key !== 'version' && canonicalJson(a?.[key]) !== canonicalJson(b?.[key]),
  );
}

export type WriteAction = 'new' | 'updated';

export interface PlannedWrite {
  readonly kind: ImportedKind;
  readonly id: string;
  readonly path: string;
  readonly action: WriteAction;
  readonly content: WithMeta;
}

export interface Skipped {
  readonly kind: ImportedKind;
  readonly id: string;
  readonly reason: string;
}

export interface ExistingFiles {
  /** Geparste vorhandene Dateien je Art und ID (undefined = nicht lesbar → gilt als von Hand geändert). */
  readonly recipe: ReadonlyMap<string, unknown>;
  readonly meal_prep_plan: ReadonlyMap<string, unknown>;
  readonly guide: ReadonlyMap<string, unknown>;
}

function planWrite(
  kind: ImportedKind,
  built: WithMeta & { id: string },
  existing: unknown,
  writes: PlannedWrite[],
  skipped: Skipped[],
  handEdited: Skipped[],
): 'new' | 'updated' | 'unchanged' | 'skipped' {
  const path = `${DIRS[kind]}/${built.id}.json`;
  if (existing === undefined) {
    writes.push({ kind, id: built.id, path, action: 'new', content: finalize(built, 1) });
    return 'new';
  }
  const record = existing as Partial<WithMeta> | null;
  const status = record?.status;
  if (status !== 'draft') {
    skipped.push({
      kind,
      id: built.id,
      reason: `vorhandene Datei ist „${typeof status === 'string' ? status : 'unbekannt'}“ – wird nie überschrieben (R15)`,
    });
    return 'skipped';
  }
  const recorded = record?.meta?.import_hash;
  if (typeof recorded !== 'string' || recorded !== importHash(existing)) {
    const fields = changedFields(existing, built);
    handEdited.push({
      kind,
      id: built.id,
      reason:
        fields.length === 0
          ? 'von Hand geändert, nicht überschrieben (neue Dateifassung inhaltlich gleich)'
          : `von Hand geändert, nicht überschrieben – Unterschied zur neuen Dateifassung in: ${fields.join(', ')}`,
    });
    return 'skipped';
  }
  const version = typeof record?.version === 'number' ? record.version : 1;
  const same = finalize(built, version);
  if (same.meta.import_hash === recorded) {
    return 'unchanged';
  }
  writes.push({
    kind,
    id: built.id,
    path,
    action: 'updated',
    content: finalize(built, version + 1),
  });
  return 'updated';
}

// ---------------------------------------------------------------------------------------------------------
// Ablauf (rein)
// ---------------------------------------------------------------------------------------------------------

export interface RecipeDeviation extends Deviation {
  readonly scope: 'recipe' | 'ingredient';
}

export interface Alpha5ImportReport {
  readonly version: string;
  readonly stand: string;
  readonly counts: {
    readonly recipes: number;
    readonly ingredients: number;
    readonly mealPrepPlans: number;
    readonly guides: number;
  };
  /** true = Lebensmittel-Katalog leer – nichts geschrieben (erst `foods-import`). */
  readonly catalogMissing: boolean;
  /** Zutaten der Datei, die im Katalog fehlen (Katalog-ID). */
  readonly missingFoods: readonly string[];
  readonly built: {
    readonly recipes: number;
    readonly mealPrepPlans: number;
    readonly guides: number;
  };
  readonly written: { readonly new: number; readonly updated: number; readonly unchanged: number };
  readonly notImported: readonly Skipped[];
  readonly protectedFiles: readonly Skipped[];
  readonly handEdited: readonly Skipped[];
  /** Vorhandene importierte Dateien, deren ID in der Datei fehlt – nicht gelöscht. */
  readonly removedIds: readonly { kind: ImportedKind; id: string }[];
  readonly deviations: readonly RecipeDeviation[];
  /** Rezepte, deren Nährwerte nicht vollständig berechenbar sind (Einheit nicht umrechenbar). */
  readonly notComputable: readonly string[];
  readonly dietMismatches: readonly { id: string; file: DietType; computed: DietType }[];
  readonly porkMismatches: readonly { id: string; file: boolean; computed: boolean }[];
  readonly heatedAssumptions: readonly { id: string; assumption: ImportAssumption }[];
  /** Anzahl Zutaten mit `heated: false` als Vorgabe. */
  readonly heatedFalseCount: number;
  /** Umgewandelte Mengen `menge_g: 0` je Einheit. */
  readonly zeroAmounts: Readonly<Record<RecipeUnit, number>>;
  /** Abdeckung laut Datei (K9, nur Rezepte der App): Rezepte nur „mit Fleisch“, Anteil vegetarisch/vegan. */
  readonly fileCoverage: { readonly meatOnly: number; readonly vegetarianShare: number };
  /** App-Auswahl (Gründer 24.10.2026); null = keine Auswahl-Datei, alle Rezepte der Datei. */
  readonly selection: AppSelectionReport | null;
}

export interface AppSelectionReport {
  readonly entschieden: string;
  readonly quelle: string;
  /** Fassung der Gründer-Datei weicht von `quelle` ab (neue Rezepte sind dann nur im Buch, bis neu entschieden). */
  readonly versionMismatch: boolean;
  /** Rezepte in der App (ausgewählt). */
  readonly inApp: number;
  /** Rezepte nur im Buch. */
  readonly bookOnly: number;
  readonly plansInApp: readonly string[];
  readonly plansBookOnly: readonly string[];
  /** Schon vorhandene importierte Dateien, die jetzt nur im Buch sind – nie gelöscht (R15). */
  readonly repoOutside: readonly { kind: ImportedKind; id: string; status: string }[];
}

export interface Alpha5ImportInput {
  /** Geparster Inhalt von alpha5-rezepte.json (wird hier strikt geprüft). */
  readonly data: unknown;
  readonly foods: ReadonlyMap<string, Food>;
  readonly existing: ExistingFiles;
  /**
   * App-Auswahl (`content/rezeptbuch-app-auswahl.json`, schon mit `parseAppSelection` geprüft): nur diese Rezepte
   * und Meal-Prep-Pläne werden gebaut und geschrieben. Fehlt sie, gilt die ganze Datei.
   */
  readonly selection?: AppSelection;
}

export interface Alpha5ImportOutput {
  readonly writes: readonly PlannedWrite[];
  readonly report: Alpha5ImportReport;
  /** Alle gebauten Inhalte (auch nicht geschriebene) – für die Prüfung im Bericht. */
  readonly built: {
    readonly recipes: readonly Recipe[];
    readonly mealPrepPlans: readonly MealPrepPlan[];
    readonly guides: readonly Guide[];
    /** Rezepte mit fehlenden Lebensmitteln – nur Strukturprüfung (Schema, Textregeln), nie geschrieben. */
    readonly structureOnly: readonly Recipe[];
  };
}

/** Führt den Import rein aus. Wirft `Alpha5InputError` bei ungültiger Datei (dann wird nichts geschrieben). */
export function importAlpha5(input: Alpha5ImportInput): Alpha5ImportOutput {
  const file = parseAlpha5File(input.data);
  const catalogMissing = input.foods.size === 0;
  const ctx: BuildContext = { file, foods: input.foods };

  const writes: PlannedWrite[] = [];
  const notImported: Skipped[] = [];
  const protectedFiles: Skipped[] = [];
  const handEdited: Skipped[] = [];
  const written = { new: 0, updated: 0, unchanged: 0 };
  const count = (result: ReturnType<typeof planWrite>) => {
    if (result !== 'skipped') written[result] += 1;
  };

  const recipes = new Map<string, Recipe>();
  const structureOnly: Recipe[] = [];
  const deviations: RecipeDeviation[] = [];
  const notComputable: string[] = [];
  const dietMismatches: Alpha5ImportReport['dietMismatches'][number][] = [];
  const porkMismatches: Alpha5ImportReport['porkMismatches'][number][] = [];
  const heatedAssumptions: Alpha5ImportReport['heatedAssumptions'][number][] = [];
  let heatedFalseCount = 0;
  const zeroAmounts: Record<RecipeUnit, number> = {
    g: 0,
    ml: 0,
    piece: 0,
    tbsp: 0,
    tsp: 0,
    pinch: 0,
  };

  const selectedIds =
    input.selection === undefined ? null : new Set<string>(input.selection.rezepte);
  const selectedPlans =
    input.selection === undefined ? null : new Set<string>(input.selection.meal_prep_plaene);
  const appRecipes = file.rezepte.filter((r) => selectedIds === null || selectedIds.has(r.id));
  for (const rezept of appRecipes) {
    const built = buildRecipe(rezept, ctx);
    for (const zutat of rezept.zutaten) {
      if (zutat.menge_g === 0) {
        const parsed = parseZeroAmount(zutat.anzeige);
        if (parsed !== null) zeroAmounts[parsed.unit] += 1;
      }
    }
    if (built.missing.length > 0) {
      structureOnly.push(built.recipe);
      notImported.push({
        kind: 'recipe',
        id: rezept.id,
        reason: `Zutat fehlt im Katalog: ${built.missing.join(', ')}`,
      });
      continue;
    }
    const { recipe } = built;
    recipes.set(recipe.id, recipe);
    heatedAssumptions.push(
      ...built.assumptions.map((assumption) => ({ id: recipe.id, assumption })),
    );
    heatedFalseCount += built.heatedFalse.length;

    const facts = computeRecipeFacts(recipe, input.foods);
    if (facts.nutrientsComplete) {
      deviations.push(
        ...alpha5Deviations(recipe.id, rezept.naehrwerte_pro_portion, facts.perServing).map(
          (d) => ({ ...d, scope: 'recipe' as const }),
        ),
      );
    } else {
      notComputable.push(recipe.id);
    }
    if (recipe.declared_diet !== facts.diet) {
      dietMismatches.push({ id: recipe.id, file: recipe.declared_diet, computed: facts.diet });
    }
    if (recipe.contains_pork !== facts.containsPork) {
      porkMismatches.push({
        id: recipe.id,
        file: recipe.contains_pork,
        computed: facts.containsPork,
      });
    }
  }

  const missingFoods = [
    ...new Set(file.zutaten.map((z) => foodIdFor(z.id)).filter((id) => !input.foods.has(id))),
  ].sort();
  for (const zutat of file.zutaten) {
    const food = input.foods.get(foodIdFor(zutat.id));
    // Gründer-Datei ohne Vergleichswert (alle vier Werte 0, z. B. Pfeffer): kein Gegencheck möglich.
    if (food !== undefined && !hasNoReference(zutat.pro_100g)) {
      deviations.push(
        ...alpha5Deviations(food.id, zutat.pro_100g, food.nutrients_per_100g).map((d) => ({
          ...d,
          scope: 'ingredient' as const,
        })),
      );
    }
  }

  const plans: MealPrepPlan[] = [];
  for (const plan of file.meal_prep_plaene) {
    if (selectedPlans !== null && !selectedPlans.has(plan.id)) continue;
    const built = buildMealPrepPlan(plan, file, recipes);
    if ('missing' in built) {
      notImported.push({
        kind: 'meal_prep_plan',
        id: plan.id,
        reason: `Rezept nicht importiert: ${built.missing.join(', ')}`,
      });
      continue;
    }
    plans.push(built);
  }
  const guides = buildGuides(file);

  if (!catalogMissing) {
    for (const recipe of recipes.values()) {
      count(
        planWrite(
          'recipe',
          recipe,
          input.existing.recipe.get(recipe.id),
          writes,
          protectedFiles,
          handEdited,
        ),
      );
    }
    for (const plan of plans) {
      count(
        planWrite(
          'meal_prep_plan',
          plan,
          input.existing.meal_prep_plan.get(plan.id),
          writes,
          protectedFiles,
          handEdited,
        ),
      );
    }
    for (const guide of guides) {
      count(
        planWrite(
          'guide',
          guide,
          input.existing.guide.get(guide.id),
          writes,
          protectedFiles,
          handEdited,
        ),
      );
    }
  }

  const importedIds: Record<ImportedKind, Set<string>> = {
    recipe: new Set(file.rezepte.map((r) => r.id)),
    meal_prep_plan: new Set(file.meal_prep_plaene.map((p) => p.id)),
    guide: new Set(guides.map((g) => g.id)),
  };
  const removedIds: { kind: ImportedKind; id: string }[] = [];
  for (const kind of ['recipe', 'meal_prep_plan', 'guide'] as const) {
    for (const [id, data] of input.existing[kind]) {
      const source = (data as { meta?: { source_file?: unknown } } | null)?.meta?.source_file;
      if (
        typeof source === 'string' &&
        source.startsWith(`${ALPHA5_FILE_NAME}@`) &&
        !importedIds[kind].has(id)
      ) {
        removedIds.push({ kind, id });
      }
    }
  }

  // Nur im Buch, aber schon im Repository (früherer Import): nie gelöscht, nur gemeldet (R15).
  const repoOutside: { kind: ImportedKind; id: string; status: string }[] = [];
  if (input.selection !== undefined) {
    const outside: Record<'recipe' | 'meal_prep_plan', Set<string>> = {
      recipe: new Set(
        file.rezepte.map((r) => r.id).filter((id) => !(selectedIds as Set<string>).has(id)),
      ),
      meal_prep_plan: new Set(
        file.meal_prep_plaene
          .map((p) => p.id)
          .filter((id) => !(selectedPlans as Set<string>).has(id)),
      ),
    };
    for (const kind of ['recipe', 'meal_prep_plan'] as const) {
      for (const [id, data] of input.existing[kind]) {
        if (!outside[kind].has(id)) continue;
        const status = (data as { status?: unknown } | null)?.status;
        repoOutside.push({ kind, id, status: typeof status === 'string' ? status : 'unbekannt' });
      }
    }
    repoOutside.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  }

  // „Nur mit Fleisch“ = weder vegetarisch noch ohne Schwein geeignet (K9: 5.4 sah höchstens 5 vor).
  const meatOnly = appRecipes.filter(
    (r) => r.ernaehrungsformen.length === 1 && r.ernaehrungsformen[0] === 'fleisch',
  );
  const vegetarianShare =
    appRecipes.length === 0
      ? 0
      : appRecipes.filter(
          (r) =>
            r.ernaehrungsformen.includes('vegetarisch') || r.ernaehrungsformen.includes('vegan'),
        ).length / appRecipes.length;

  return {
    writes,
    built: { recipes: [...recipes.values()], mealPrepPlans: plans, guides, structureOnly },
    report: {
      version: file.version,
      stand: file.stand,
      counts: {
        recipes: file.rezepte.length,
        ingredients: file.zutaten.length,
        mealPrepPlans: file.meal_prep_plaene.length,
        guides: Object.keys(file.ratgeber).length,
      },
      catalogMissing,
      missingFoods,
      built: { recipes: recipes.size, mealPrepPlans: plans.length, guides: guides.length },
      written,
      notImported,
      protectedFiles,
      handEdited,
      removedIds,
      deviations,
      notComputable,
      dietMismatches,
      porkMismatches,
      heatedAssumptions,
      heatedFalseCount,
      zeroAmounts,
      fileCoverage: { meatOnly: meatOnly.length, vegetarianShare },
      selection:
        input.selection === undefined
          ? null
          : {
              entschieden: input.selection.entschieden,
              quelle: input.selection.quelle,
              versionMismatch: input.selection.quelle !== `${ALPHA5_FILE_NAME}@${file.version}`,
              inApp: appRecipes.length,
              bookOnly: file.rezepte.length - appRecipes.length,
              plansInApp: file.meal_prep_plaene
                .map((p) => p.id)
                .filter((id) => (selectedPlans as Set<string>).has(id)),
              plansBookOnly: file.meal_prep_plaene
                .map((p) => p.id)
                .filter((id) => !(selectedPlans as Set<string>).has(id)),
              repoOutside,
            },
    },
  };
}

export const ALPHA5_TOLERANCE_NOTE = IMPORT_TOLERANCE_NOTE_DE;
