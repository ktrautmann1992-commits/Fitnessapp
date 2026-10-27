import type { z } from 'zod';

import { CONTENT_STATUSES, type ContentStatus } from '../enums';
import type { ExerciseLookup } from './analysis';
import { checkExercise, checkLibraryCoverage, checkPlanTemplate } from './checks';
import { canonicalJson } from './canonical-json';
import { checkTemplateFitsMinimum } from './fit-check';
import { type Food, foodSchema } from './food-schema';
import { checkGuide } from './guide-checks';
import { type Guide, guideSchema } from './guide-schema';
import { checkMealPrepPlan } from './meal-prep-checks';
import { type MealPrepPlan, mealPrepPlanSchema } from './meal-prep-plan-schema';
import { checkPackageSize, checkPackageSizeLibrary } from './package-size-checks';
import { type PackageSize, packageSizeSchema } from './package-size-schema';
import {
  checkFood,
  checkRecipe,
  checkRecipeTrainingTags,
  checkRecipeCoverage,
  type NutritionCatalogContext,
} from './recipe-checks';
import { computeRecipeFacts } from '../nutrition/recipe-nutrients';
import { type Recipe, recipeSchema } from './recipe-schema';
import { type ContentIssue, isBlockingIssue, makeIssue } from './rules';
import { type Exercise, exerciseSchema, type PlanTemplate, planTemplateSchema } from './schemas';
import { checkIngredientSubstitution, checkSubstitutionLibrary } from './substitution-checks';
import { type IngredientSubstitution, ingredientSubstitutionSchema } from './substitution-schema';
import { checkSupplementContent } from './supplement-checks';
import { type SupplementContent, supplementContentSchema } from './supplement-schema';
import { checkWorkout } from '../workouts/checks';
import { type Workout, workoutSchema } from '../workouts/schema';

export { canonicalJson } from './canonical-json';

/**
 * Prüft einen kompletten Inhaltsstand (alle Dateien unter `content/`): Datei-Regeln, Schema (Ü1),
 * Versionen, Übungs- und Vorlagen-Checks. Wird vom Prüfskript `content:validate` (packages/content) und
 * später vom Admin-Bereich genutzt – rein, ohne Dateisystem.
 */

export type ContentFileKind = 'exercise' | 'plan_template';

/**
 * Inhaltsarten der Ernährung (docs/PLAN-PHASE-5.md 5.1–5.3, 19.4). Bewusst getrennt von `ContentFileKind`, solange
 * die Pipeline-Arten (N8) sie nicht kennen; Ordner: `NUTRITION_CONTENT_FOLDERS` (packages/content, N2c).
 */
export type NutritionContentFileKind =
  'food' | 'recipe' | 'meal_prep_plan' | 'guide' | 'ingredient_substitution' | 'package_size';

/** true = Inhaltsart der Ernährung (Regeln R1–R24, Version R15). */
export function isNutritionKind(kind: AnyContentFileKind): kind is NutritionContentFileKind {
  return (
    kind === 'food' ||
    kind === 'recipe' ||
    kind === 'meal_prep_plan' ||
    kind === 'guide' ||
    kind === 'ingredient_substitution' ||
    kind === 'package_size'
  );
}
/** Supplement-Inhalte (docs/PLAN-PHASE-6.md Abschnitt 6, Etappe SU2): `content/supplements/<id>.json`, Regeln SK1–SK7. */
export type SupplementContentFileKind = 'supplement';

/** Workouts (docs/PLAN-WORKOUTS.md): `content/workouts/<id>.json`, Regeln W1–W7. */
export type WorkoutContentFileKind = 'workout';

export type AnyContentFileKind =
  ContentFileKind | NutritionContentFileKind | SupplementContentFileKind | WorkoutContentFileKind;

export interface ContentFile {
  readonly kind: ContentFileKind;
  /** Dateiname ohne Ordner, z. B. `kniebeuge-langhantel.json`. */
  readonly fileName: string;
  /** Geparstes JSON (undefined, wenn `jsonError` gesetzt ist). */
  readonly data?: unknown;
  /** Fehlertext, wenn die Datei kein gültiges JSON ist. */
  readonly jsonError?: string;
  /** Stand derselben Datei im Vergleichsstand (z. B. `main`), falls vorhanden – für die Versionsregel. */
  readonly previous?: unknown;
}

/**
 * Inhaltsdatei der Ernährung (`content/foods|recipes|meal-prep-plans|guides|substitutions|package-sizes/<id>.json`).
 */
export interface NutritionContentFile extends Omit<ContentFile, 'kind'> {
  readonly kind: NutritionContentFileKind;
}

/** Inhaltsdatei eines Supplements (`content/supplements/<id>.json`). */
export interface SupplementContentFile extends Omit<ContentFile, 'kind'> {
  readonly kind: SupplementContentFileKind;
}

/** Inhaltsdatei eines Workouts (`content/workouts/<id>.json`). */
export interface WorkoutContentFile extends Omit<ContentFile, 'kind'> {
  readonly kind: WorkoutContentFileKind;
}

export interface ContentValidationOptions {
  /** Begleitdaten des Lebensmittel-Katalogs (R17, R18). Fehlen sie, sind alle Lebensmittel rot. */
  readonly nutritionCatalog?: NutritionCatalogContext;
}

export interface ContentValidationResult {
  /** Übungen mit gültigem Schema (bei doppelter ID nur die erste). */
  readonly exercises: readonly Exercise[];
  /** Plan-Vorlagen mit gültigem Schema (bei doppelter ID nur die erste). */
  readonly templates: readonly PlanTemplate[];
  /** Lebensmittel mit gültigem Schema (bei doppelter ID nur das erste). */
  readonly foods: readonly Food[];
  /** Rezepte mit gültigem Schema (bei doppelter ID nur das erste). */
  readonly recipes: readonly Recipe[];
  /** Meal-Prep-Wochenpläne mit gültigem Schema (19.4). */
  readonly mealPrepPlans: readonly MealPrepPlan[];
  /** Ratgeber mit gültigem Schema (19.4). */
  readonly guides: readonly Guide[];
  /** Austausch-Tabelle mit gültigem Schema (19.7 N9). */
  readonly substitutions: readonly IngredientSubstitution[];
  /** Packungsgrößen mit gültigem Schema (19.7 N11). */
  readonly packageSizes: readonly PackageSize[];
  /** Supplement-Inhalte mit gültigem Schema (Phase 6, SU2) – nur geprüft, eingespielt erst ab SU3. */
  readonly supplements: readonly SupplementContent[];
  /** Workouts mit gültigem Schema (docs/PLAN-WORKOUTS.md). */
  readonly workouts: readonly Workout[];
  /** Alle Befunde (rot und gelb). */
  readonly issues: readonly ContentIssue[];
  /** Befunde, die das Prüfskript fehlschlagen lassen (siehe isBlockingIssue). */
  readonly blocking: readonly ContentIssue[];
}

function readStatus(data: unknown): ContentStatus | null {
  const status = (data as { status?: unknown } | null)?.status;
  return CONTENT_STATUSES.includes(status as ContentStatus) ? (status as ContentStatus) : null;
}

function readId(data: unknown, fallback: string): string {
  const id = (data as { id?: unknown } | null)?.id;
  return typeof id === 'string' && id.length > 0 ? id : fallback;
}

/** Fachlicher Inhalt ohne Status, Version und Herkunft/Prüfvermerk. */
function contentBody(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return canonicalJson(value);
  }
  const ignored = new Set(['status', 'version', 'meta']);
  const rest = Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([key]) => !ignored.has(key)),
  );
  return canonicalJson(rest);
}

/**
 * Versionsregel (Plan Abschnitt 5, Punkt 6): War der Inhalt im Vergleichsstand freigegeben und hat sich der
 * fachliche Inhalt geändert, muss `version` steigen. Eine Version darf nie sinken.
 */
export function checkVersionChange(
  kind: AnyContentFileKind,
  previous: unknown,
  current: Pick<Exercise, 'id' | 'status' | 'version'>,
): ContentIssue[] {
  const rule = isNutritionKind(kind) ? 'R15' : 'VERSION';
  if (previous === null || typeof previous !== 'object') {
    return [];
  }
  const prevVersion = (previous as { version?: unknown }).version;
  if (typeof prevVersion !== 'number') {
    return [];
  }
  const target = { kind, id: current.id, status: current.status };
  if (current.version < prevVersion) {
    return [
      makeIssue(
        rule,
        target,
        `Version ${current.version} ist kleiner als vorher (${prevVersion}).`,
        'version',
      ),
    ];
  }
  if (
    readStatus(previous) === 'published' &&
    current.version === prevVersion &&
    contentBody(previous) !== contentBody(current)
  ) {
    return [
      makeIssue(
        rule,
        target,
        `Freigegebener Inhalt wurde geändert – bitte „version“ auf ${prevVersion + 1} erhöhen.`,
        'version',
      ),
    ];
  }
  return [];
}

type AnyContentFile =
  ContentFile | NutritionContentFile | SupplementContentFile | WorkoutContentFile;

function schemaIssues(file: AnyContentFile, error: z.ZodError): ContentIssue[] {
  const target = {
    kind: file.kind,
    id: readId(file.data, file.fileName),
    status: readStatus(file.data),
  };
  const rule =
    file.kind === 'supplement'
      ? 'SK1'
      : file.kind === 'workout'
        ? 'W1'
        : isNutritionKind(file.kind)
          ? 'R1'
          : 'Ü1';
  return error.issues.map((issue) =>
    makeIssue(
      rule,
      target,
      issue.message,
      issue.path.length > 0 ? issue.path.join('.') : undefined,
    ),
  );
}

/** Modell-Kennung der Beispiel-Inhalte aus dem Probelauf ohne KI (content-generate, Option „Probelauf“). */
export const DRY_RUN_MODEL_ID = 'probelauf-ohne-ki';
/** ID-Präfix der Beispiel-Übungen aus dem Probelauf. */
export const DRY_RUN_ID_PREFIX = 'probelauf-';
/** Präfix der Batch-Nummer eines Probelaufs (statt einer echten Batch-ID). */
export const DRY_RUN_BATCH_PREFIX = 'probelauf_';

/** true = Inhalt stammt aus einem Probelauf (Modell, ID-Präfix oder Batch-Nummer). */
export function isDryRunContent(content: Pick<Exercise, 'id' | 'meta'>): boolean {
  return (
    content.meta.model === DRY_RUN_MODEL_ID ||
    content.id.startsWith(DRY_RUN_ID_PREFIX) ||
    (content.meta.batch_id?.startsWith(DRY_RUN_BATCH_PREFIX) ?? false)
  );
}

/**
 * Regel PROBELAUF (rot): Probelauf-Inhalte sind Beispiele zum Testen der Pipeline und dürfen nie freigegeben
 * werden – weder per content-review noch von Hand. Entwürfe und zurückgezogene Probelauf-Inhalte sind erlaubt.
 */
export function checkDryRunNotPublished(
  kind: AnyContentFileKind,
  content: Pick<Exercise, 'id' | 'status' | 'meta'>,
): ContentIssue[] {
  if (content.status !== 'published' || !isDryRunContent(content)) {
    return [];
  }
  return [
    makeIssue(
      'PROBELAUF',
      { kind, id: content.id, status: content.status },
      'Probelauf-Inhalt (ohne KI, nur zum Testen) darf nie freigegeben werden – bitte löschen oder auf „draft“/„archived“ setzen.',
      'status',
    ),
  ];
}

const SCHEMAS = {
  exercise: exerciseSchema,
  plan_template: planTemplateSchema,
  food: foodSchema,
  recipe: recipeSchema,
  meal_prep_plan: mealPrepPlanSchema,
  guide: guideSchema,
  ingredient_substitution: ingredientSubstitutionSchema,
  package_size: packageSizeSchema,
  supplement: supplementContentSchema,
  workout: workoutSchema,
} as const;

/**
 * Prüft alle Inhaltsdateien gemeinsam. Lebensmittel und Rezepte (Phase 5) werden mit R1–R19 und R22 geprüft,
 * Meal-Prep-Pläne mit R20, Ratgeber mit R21, die Austausch-Tabelle mit R23, Packungsgrößen mit R24; die
 * Begleitdaten (Quellauszug, Erwartungs- und Ausnahmeliste) kommen über `options.nutritionCatalog`.
 */
export function validateContent(
  files: readonly AnyContentFile[],
  options: ContentValidationOptions = {},
): ContentValidationResult {
  const issues: ContentIssue[] = [];
  const exercises: Exercise[] = [];
  const templates: PlanTemplate[] = [];
  const foods: Food[] = [];
  const recipes: Recipe[] = [];
  const mealPrepPlans: MealPrepPlan[] = [];
  const guides: Guide[] = [];
  const substitutions: IngredientSubstitution[] = [];
  const packageSizes: PackageSize[] = [];
  const supplements: SupplementContent[] = [];
  const workouts: Workout[] = [];
  const seenIds = new Map<string, string>();

  for (const file of files) {
    const fileTarget = { kind: file.kind, id: file.fileName, status: null };
    if (file.jsonError !== undefined) {
      issues.push(makeIssue('DATEI', fileTarget, `Kein gültiges JSON: ${file.jsonError}`));
      continue;
    }
    const parsed = SCHEMAS[file.kind].safeParse(file.data);
    if (!parsed.success) {
      issues.push(...schemaIssues(file, parsed.error));
      continue;
    }
    const content = parsed.data;
    const target = { kind: file.kind, id: content.id, status: content.status };
    if (file.fileName !== `${content.id}.json`) {
      issues.push(
        makeIssue(
          'DATEI',
          target,
          `Dateiname „${file.fileName}“ passt nicht zur ID – erwartet „${content.id}.json“.`,
        ),
      );
    }
    const key = `${file.kind}:${content.id}`;
    const firstFile = seenIds.get(key);
    if (firstFile !== undefined) {
      issues.push(
        makeIssue(
          file.kind === 'supplement' ? 'SK2' : 'DATEI',
          target,
          `ID „${content.id}“ ist doppelt (auch in „${firstFile}“).`,
          file.kind === 'supplement' ? 'id' : undefined,
        ),
      );
      continue;
    }
    seenIds.set(key, file.fileName);
    issues.push(...checkVersionChange(file.kind, file.previous, content));
    issues.push(...checkDryRunNotPublished(file.kind, content));
    if (file.kind === 'exercise') {
      exercises.push(content as Exercise);
    } else if (file.kind === 'plan_template') {
      templates.push(content as PlanTemplate);
    } else if (file.kind === 'food') {
      foods.push(content as Food);
    } else if (file.kind === 'recipe') {
      recipes.push(content as Recipe);
    } else if (file.kind === 'meal_prep_plan') {
      mealPrepPlans.push(content as MealPrepPlan);
    } else if (file.kind === 'ingredient_substitution') {
      substitutions.push(content as IngredientSubstitution);
    } else if (file.kind === 'package_size') {
      packageSizes.push(content as PackageSize);
    } else if (file.kind === 'supplement') {
      supplements.push(content as SupplementContent);
    } else if (file.kind === 'workout') {
      workouts.push(content as Workout);
    } else {
      guides.push(content as Guide);
    }
  }

  const library: ExerciseLookup = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  for (const exercise of exercises) {
    issues.push(...checkExercise(exercise, library));
  }
  issues.push(...checkLibraryCoverage(exercises));
  for (const template of templates) {
    issues.push(...checkPlanTemplate(template, library));
    issues.push(...checkTemplateFitsMinimum(template, library));
  }

  const foodLookup = new Map(foods.map((food) => [food.id, food]));
  const catalog = options.nutritionCatalog ?? {};
  for (const food of foods) {
    issues.push(...checkFood(food, foodLookup, catalog));
  }
  issues.push(...catalogFileIssues(catalog, foodLookup));
  for (const recipe of recipes) {
    issues.push(...checkRecipe(recipe, foodLookup));
    // Nährstoff-Timing T3 (R22T, gelb): Trainings-Markierung passt zu den Nährwerten je Portion.
    issues.push(...checkRecipeTrainingTags(recipe, computeRecipeFacts(recipe, foodLookup)));
  }
  issues.push(...checkRecipeCoverage(recipes, foodLookup));
  const recipeLookup = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  for (const plan of mealPrepPlans) {
    issues.push(...checkMealPrepPlan(plan, recipeLookup));
  }
  for (const guide of guides) {
    issues.push(...checkGuide(guide));
  }
  for (const substitution of substitutions) {
    issues.push(...checkIngredientSubstitution(substitution, foodLookup));
  }
  issues.push(...checkSubstitutionLibrary(substitutions));
  for (const entry of packageSizes) {
    issues.push(...checkPackageSize(entry, foodLookup));
  }
  issues.push(...checkPackageSizeLibrary(packageSizes));
  for (const supplement of supplements) {
    issues.push(...checkSupplementContent(supplement));
  }
  for (const workout of workouts) {
    issues.push(...checkWorkout(workout, library));
  }

  return {
    exercises,
    templates,
    foods,
    recipes,
    mealPrepPlans,
    guides,
    substitutions,
    packageSizes,
    supplements,
    workouts,
    issues,
    blocking: issues.filter(isBlockingIssue),
  };
}

/** Erwartungs- und Ausnahmeliste nennen nur Lebensmittel, die es gibt (R18). */
function catalogFileIssues(
  catalog: NutritionCatalogContext,
  foods: ReadonlyMap<string, Food>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  for (const id of Object.keys(catalog.expectations ?? {}).sort()) {
    if (!foods.has(id)) {
      issues.push(
        makeIssue(
          'R18',
          { kind: 'food', id, status: null },
          'Erwartungsliste nennt ein Lebensmittel, das es im Katalog nicht gibt.',
        ),
      );
    }
  }
  for (const exception of catalog.exceptions ?? []) {
    if (!foods.has(exception.food_id)) {
      issues.push(
        makeIssue(
          'R18',
          { kind: 'food', id: exception.food_id, status: null },
          `Ausnahmeliste („${exception.rule}“) nennt ein Lebensmittel, das es im Katalog nicht gibt.`,
        ),
      );
    }
  }
  return issues;
}
