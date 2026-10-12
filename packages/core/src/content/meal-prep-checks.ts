import { normalizeFoodText } from './allergen-rules';
import {
  daysAfterCookDay,
  type MealPrepPlan,
  PREP_WEEKDAY_LABELS_DE,
  PREP_WEEKDAYS,
  type StorageMethod,
  type StoragePlanEntry,
} from './meal-prep-plan-schema';
import type { Recipe } from './recipe-schema';
import { type ContentIssue, makeIssue } from './rules';

/**
 * Regel R20 (docs/PLAN-PHASE-5.md 19.4, S10) und die Herleitung des Aufbewahrungsplans aus R9. Rein, ohne
 * Dateisystem; aufgerufen von `validateContent` bzw. vom Import-Skript.
 */

type RecipeForStorage = Pick<Recipe, 'id' | 'meal_prep'>;

/**
 * Aufbewahrung an einem Tag nach R9 (sichere Richtung): Kühlschrank nur, solange der Tag höchstens
 * `fridge_days` nach dem Kochtag liegt; danach eingefroren, wenn das Rezept einfrierbar ist, sonst frisch kochen.
 */
export function storageMethodFor(recipe: RecipeForStorage, daysAfterCook: number): StorageMethod {
  if (daysAfterCook <= recipe.meal_prep.fridge_days) {
    return 'fridge';
  }
  return recipe.meal_prep.freezable ? 'freeze' : 'fresh';
}

/** Aufbewahrungsplan Mo–Fr für alle Rezepte eines Plans, hergeleitet aus R9 (Import, 19.2). */
export function deriveStoragePlan(recipes: readonly RecipeForStorage[]): StoragePlanEntry[] {
  return recipes.flatMap((recipe) =>
    PREP_WEEKDAYS.map((weekday) => ({
      recipe_id: recipe.id,
      weekday,
      method: storageMethodFor(recipe, daysAfterCookDay(weekday)),
    })),
  );
}

/** „3 Tage“, „3–4 Tage“, „1 Tag“ in Freitext (S10). Liefert die größte genannte Zahl je Fundstelle. */
export function findDayMentions(text: string): { match: string; maxDays: number }[] {
  const result: { match: string; maxDays: number }[] = [];
  const pattern = /(\d+)(?:\s*(?:[–-]|bis)\s*(\d+))?\s*Tage?n?\b/gu;
  for (const hit of text.matchAll(pattern)) {
    const first = Number(hit[1]);
    const second = hit[2] === undefined ? first : Number(hit[2]);
    result.push({ match: hit[0], maxDays: Math.max(first, second) });
  }
  return result;
}

/**
 * Rezepte, die ein Text nennt: ein Wort des Textes (≥ 4 Buchstaben) ist ein Wort des Rezepttitels oder dessen
 * Anfang bzw. Ende (z. B. „Curry“ in „Süßkartoffel-Erdnuss-Curry …“, „Riegel“ in „Schoko-Haferriegel“).
 */
export function recipesNamedIn<T extends Pick<Recipe, 'id' | 'title_de'>>(
  text: string,
  recipes: readonly T[],
): T[] {
  const textWords = normalizeFoodText(text)
    .split(/[\s-]+/)
    .filter((w) => w.length >= 4);
  return recipes.filter((recipe) => {
    const titleWords = normalizeFoodText(recipe.title_de)
      .split(/[\s-]+/)
      .filter((w) => w.length >= 4);
    return textWords.some((word) =>
      titleWords.some((t) => t === word || t.startsWith(word) || t.endsWith(word)),
    );
  });
}

/**
 * R20 (rot) und R20H (gelb): Rezepte existieren und sind `meal_prep.suitable` (freigegebener Plan nur mit
 * freigegebenen Rezepten), Startminuten aufsteigend, `storage_plan` deckt Mo–Fr für jedes Rezept genau einmal ab
 * und hält R9 ein (`fridge` nur bis `fridge_days` nach dem Kochtag, `freeze` nur bei `freezable`), Wortregel auf
 * `storage_de[]` und `cook_steps[].text_de`: „N Tage“ gelb, rot wenn länger als die kürzeste R9-Grenze der Plan-Rezepte
 * (sichere Richtung, Wächter N2c K4; die genannten Rezepte stehen in der Meldung).
 */
export function checkMealPrepPlan(
  plan: MealPrepPlan,
  recipes: ReadonlyMap<string, Recipe>,
): ContentIssue[] {
  const target = { kind: 'meal_prep_plan' as const, id: plan.id, status: plan.status };
  const issues: ContentIssue[] = [];
  const planRecipes: Recipe[] = [];

  plan.recipe_ids.forEach((id, index) => {
    const recipe = recipes.get(id);
    const path = `recipe_ids.${index}`;
    if (recipe === undefined) {
      issues.push(makeIssue('R20', target, `Rezept „${id}“ existiert nicht.`, path));
      return;
    }
    planRecipes.push(recipe);
    if (!recipe.meal_prep.suitable) {
      issues.push(
        makeIssue('R20', target, `Rezept „${id}“ ist nicht für Meal-Prep geeignet.`, path),
      );
    }
    if (plan.status === 'published' && recipe.status !== 'published') {
      issues.push(
        makeIssue(
          'R20',
          target,
          `Freigegebener Plan nutzt das nicht freigegebene Rezept „${id}“.`,
          path,
        ),
      );
    }
  });

  plan.cook_steps.forEach((step, index) => {
    const before = plan.cook_steps[index - 1];
    if (before !== undefined && step.start_min < before.start_min) {
      issues.push(
        makeIssue(
          'R20',
          target,
          `Kochschritt ${index + 1} beginnt bei Minute ${step.start_min}, vor dem vorherigen (${before.start_min}).`,
          `cook_steps.${index}.start_min`,
        ),
      );
    }
  });

  const seen = new Map<string, number>();
  plan.storage_plan.forEach((entry, index) => {
    const path = `storage_plan.${index}`;
    if (!plan.recipe_ids.includes(entry.recipe_id)) {
      issues.push(
        makeIssue(
          'R20',
          target,
          `Aufbewahrung nennt „${entry.recipe_id}“, das nicht im Plan ist.`,
          path,
        ),
      );
      return;
    }
    const key = `${entry.recipe_id}|${entry.weekday}`;
    if (seen.has(key)) {
      issues.push(
        makeIssue(
          'R20',
          target,
          `Aufbewahrung für „${entry.recipe_id}“ am ${PREP_WEEKDAY_LABELS_DE[entry.weekday]} doppelt.`,
          path,
        ),
      );
      return;
    }
    seen.set(key, index);
    const recipe = recipes.get(entry.recipe_id);
    if (recipe === undefined) {
      return;
    }
    const days = daysAfterCookDay(entry.weekday);
    if (entry.method === 'fridge' && days > recipe.meal_prep.fridge_days) {
      issues.push(
        makeIssue(
          'R20',
          target,
          `„${recipe.id}“ am ${PREP_WEEKDAY_LABELS_DE[entry.weekday]} aus dem Kühlschrank: ${days} Tage nach dem Kochtag, das Rezept hält dort nur ${recipe.meal_prep.fridge_days} (R9) – einfrieren oder frisch kochen.`,
          `${path}.method`,
        ),
      );
    }
    if (entry.method === 'freeze' && !recipe.meal_prep.freezable) {
      issues.push(
        makeIssue(
          'R20',
          target,
          `„${recipe.id}“ ist nicht einfrierbar – am ${PREP_WEEKDAY_LABELS_DE[entry.weekday]} frisch kochen.`,
          `${path}.method`,
        ),
      );
    }
  });
  for (const id of plan.recipe_ids) {
    for (const weekday of PREP_WEEKDAYS) {
      if (!seen.has(`${id}|${weekday}`)) {
        issues.push(
          makeIssue(
            'R20',
            target,
            `Aufbewahrung für „${id}“ am ${PREP_WEEKDAY_LABELS_DE[weekday]} fehlt.`,
            'storage_plan',
          ),
        );
      }
    }
  }

  const texts: [string, string][] = [
    ...plan.storage_de.map((t, i): [string, string] => [`storage_de.${i}`, t]),
    ...plan.cook_steps.map((s, i): [string, string] => [`cook_steps.${i}.text_de`, s.text_de]),
  ];
  for (const [path, value] of texts) {
    const mentions = findDayMentions(value);
    if (mentions.length === 0) {
      continue;
    }
    // Grenze = kürzeste Haltbarkeit ALLER Plan-Rezepte (Wächter N2c, K4): Die Zuordnung „welches Rezept nennt der
    // Text“ ist unsicher („Reis“, „Bowl“) – solange Frage 19.12 (b) offen ist, gilt die sichere Richtung. Genannte
    // Rezepte stehen nur in der Meldung.
    const named = recipesNamedIn(value, planRecipes);
    const limit =
      planRecipes.length === 0
        ? 0
        : Math.min(...planRecipes.map((recipe) => recipe.meal_prep.fridge_days));
    const who =
      named.length > 0
        ? `Plan; genannt: ${named.map((r) => `„${r.id}“`).join(', ')}`
        : 'die Plan-Rezepte';
    for (const mention of mentions) {
      if (mention.maxDays > limit) {
        issues.push(
          makeIssue(
            'R20',
            target,
            `„${mention.match}“ ist länger als die Haltbarkeit im Kühlschrank (R9: ${limit} Tag${limit === 1 ? '' : 'e'} für ${who}) – Text anpassen (Frage 19.12 (b)).`,
            path,
          ),
        );
      } else {
        issues.push(
          makeIssue(
            'R20H',
            target,
            `Haltbarkeitsangabe „${mention.match}“ – bitte fachlich prüfen (R9: ${limit} für ${who}).`,
            path,
          ),
        );
      }
    }
  }
  return issues;
}
