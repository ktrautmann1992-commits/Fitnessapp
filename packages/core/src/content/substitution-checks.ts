import { INGREDIENT_SUBSTITUTION_LIMITS } from '../constants';
import { needsHeatedFlag } from '../nutrition/recipe-nutrients';
import { type Food, isCatalogReviewed } from './food-schema';
import type { IngredientRole } from './recipe-schema';
import { type ContentIssue, makeIssue } from './rules';
import type { IngredientSubstitution } from './substitution-schema';
import { findNutritionTextRuleHits } from './text-rules';

/**
 * Regel R23 für die Austausch-Tabelle (docs/PLAN-PHASE-5.md 19.7 N9, 19.4 S6):
 * - rot: beide Lebensmittel existieren, sind nicht zurückgezogen und katalog-geprüft (R19); ein freigegebener Eintrag
 *   nur mit freigegebenen Lebensmitteln; kein Alkohol (R12); der Faktor hält die Messgröße der Rolle innerhalb ±10 %
 *   (`INGREDIENT_SUBSTITUTION_LIMITS.roleTolerance`); dasselbe Paar nur einmal (nicht zurückgezogen).
 * - rot (R10): Textregeln für den Hinweis (Heil-/Gesundheitsversprechen, Nährwert-Schlagworte, Marken).
 * - gelb (R23H): Rolle „Süße“ – Süßkraft laut Hinweis, menschlich prüfen; Ersatz muss erhitzt werden, das Original nicht
 *   (z. B. Tofu → Hähnchen) – der Hinweis soll das Durchgaren nennen (Wächter N9 K5). Angeboten wird so ein Tausch
 *   ohnehin nur in gekochten Rezepten an einer ausdrücklich erhitzten Zutat (`swapKeepsHeating`, B1).
 * Würze hat keine Nährwertprüfung; Salz prüft der Core am getauschten Rezept (R11, `substitute.ts`).
 */

type Target = Parameters<typeof makeIssue>[1];

function target(sub: Pick<IngredientSubstitution, 'id' | 'status'>): Target {
  return { kind: 'ingredient_substitution', id: sub.id, status: sub.status };
}

function fmt(value: number, digits = 2): string {
  return value.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

/** Nährwert der Messgröße je 100 g (null = Rolle ohne Nährwert-Messgröße). */
const ROLE_NUTRIENT: Readonly<
  Record<IngredientRole, 'protein_g' | 'carbs_g' | 'fat_g' | 'mass' | null>
> = {
  protein: 'protein_g',
  carb: 'carbs_g',
  fat: 'fat_g',
  vegetable: 'mass',
  seasoning: null,
  sweet: null,
};

const ROLE_WORD_DE: Readonly<Record<'protein_g' | 'carbs_g' | 'fat_g' | 'mass', string>> = {
  protein_g: 'Eiweiß',
  carbs_g: 'Kohlenhydrate',
  fat_g: 'Fett',
  mass: 'Masse',
};

/**
 * Verhältnis „Messgröße Ersatz × Faktor ÷ Messgröße Original“ (1 = gleich). null = Rolle ohne Nährwert-Messgröße
 * (Würze, Süße) oder Original ohne diese Messgröße (dann passt die Rolle nicht).
 */
export function substitutionRoleRatio(
  sub: Pick<IngredientSubstitution, 'role' | 'factor'>,
  food: Pick<Food, 'nutrients_per_100g'>,
  substitute: Pick<Food, 'nutrients_per_100g'>,
): number | null {
  const key = ROLE_NUTRIENT[sub.role];
  if (key === null) return null;
  if (key === 'mass') return sub.factor;
  const original = food.nutrients_per_100g[key];
  if (original <= 0) return null;
  return (substitute.nutrients_per_100g[key] * sub.factor) / original;
}

/** Faktor, der die Messgröße genau hält (für die Meldung); null = nicht bestimmbar. */
function idealFactor(
  role: IngredientRole,
  food: Pick<Food, 'nutrients_per_100g'>,
  substitute: Pick<Food, 'nutrients_per_100g'>,
): number | null {
  const key = ROLE_NUTRIENT[role];
  if (key === null) return null;
  if (key === 'mass') return 1;
  const value = substitute.nutrients_per_100g[key];
  return value > 0 ? food.nutrients_per_100g[key] / value : null;
}

/** Prüft einen Austausch-Eintrag gegen den Katalog (R23, R10, R23H). */
export function checkIngredientSubstitution(
  sub: IngredientSubstitution,
  foods: ReadonlyMap<string, Food>,
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const t = target(sub);
  const pairs: [string, 'food_id' | 'substitute_food_id'][] = [
    [sub.food_id, 'food_id'],
    [sub.substitute_food_id, 'substitute_food_id'],
  ];
  const resolved: Food[] = [];
  for (const [id, path] of pairs) {
    const food = foods.get(id);
    if (food === undefined) {
      issues.push(makeIssue('R23', t, `Lebensmittel „${id}“ fehlt im Katalog.`, path));
      continue;
    }
    if (food.status === 'archived') {
      issues.push(makeIssue('R23', t, `Lebensmittel „${id}“ ist zurückgezogen.`, path));
      continue;
    }
    if (!isCatalogReviewed(food)) {
      issues.push(
        makeIssue('R23', t, `Lebensmittel „${id}“ ist noch nicht katalog-geprüft (R19).`, path),
      );
    }
    if (sub.status === 'published' && food.status !== 'published') {
      issues.push(
        makeIssue(
          'R23',
          t,
          `Freigegebener Austausch nutzt das nicht freigegebene Lebensmittel „${id}“.`,
          path,
        ),
      );
    }
    if (food.alcohol) {
      issues.push(makeIssue('R23', t, `„${id}“ enthält Alkohol – nicht erlaubt (R12).`, path));
    }
    resolved.push(food);
  }

  const [food, substitute] = resolved;
  if (resolved.length === 2 && food !== undefined && substitute !== undefined) {
    const ratio = substitutionRoleRatio(sub, food, substitute);
    const key = ROLE_NUTRIENT[sub.role];
    const tolerance = INGREDIENT_SUBSTITUTION_LIMITS.roleTolerance;
    if (key !== null && ratio === null) {
      issues.push(
        makeIssue(
          'R23',
          t,
          `„${food.name_de}“ enthält kein ${ROLE_WORD_DE[key]} – die Rolle passt nicht.`,
          'role',
        ),
      );
    } else if (key !== null && ratio !== null && Math.abs(ratio - 1) > tolerance + 1e-9) {
      const ideal = idealFactor(sub.role, food, substitute);
      issues.push(
        makeIssue(
          'R23',
          t,
          `Faktor ${fmt(sub.factor)} ergibt ${fmt(ratio * 100, 0)} % der ${ROLE_WORD_DE[key]}-Menge (erlaubt ${fmt((1 - tolerance) * 100, 0)}–${fmt((1 + tolerance) * 100, 0)} %)${ideal === null ? '' : ` – passend wäre etwa ${fmt(ideal)}`}.`,
          'factor',
        ),
      );
    }
  }
  if (
    food !== undefined &&
    substitute !== undefined &&
    needsHeatedFlag(substitute) &&
    !needsHeatedFlag(food)
  ) {
    issues.push(
      makeIssue(
        'R23H',
        t,
        `„${substitute.name_de}“ muss durchgegart werden, „${food.name_de}“ nicht – der Hinweis soll das Durchgaren nennen.`,
        'note_de',
      ),
    );
  }
  if (sub.role === 'sweet') {
    issues.push(
      makeIssue(
        'R23H',
        t,
        'Süße: Süßkraft laut Hinweis – bitte bei der Freigabe menschlich prüfen.',
        'note_de',
      ),
    );
  }

  for (const hit of findNutritionTextRuleHits(sub.note_de)) {
    const what =
      hit.kind === 'brand'
        ? `Markenname „${hit.match}“ – nur Produktarten, keine Marken`
        : hit.kind === 'health_claim'
          ? `„${hit.match}“ (${hit.label}) – keine Gesundheits- oder Nährwertversprechen`
          : `„${hit.match}“ (${hit.label}) – keine Heilversprechen oder medizinischen Aussagen`;
    issues.push(makeIssue('R10', t, `Hinweis enthält ${what}.`, 'note_de'));
  }
  return issues;
}

/** Dasselbe Paar (Zutat → Ersatz, gleiche Rolle) nur einmal unter den nicht zurückgezogenen Einträgen (R23). */
export function checkSubstitutionLibrary(
  substitutions: readonly IngredientSubstitution[],
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const seen = new Map<string, string>();
  for (const sub of [...substitutions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (sub.status === 'archived') continue;
    const key = `${sub.food_id}|${sub.substitute_food_id}|${sub.role}`;
    const first = seen.get(key);
    if (first !== undefined) {
      issues.push(
        makeIssue(
          'R23',
          target(sub),
          `Dasselbe Paar „${sub.food_id}“ → „${sub.substitute_food_id}“ gibt es schon („${first}“).`,
          'substitute_food_id',
        ),
      );
      continue;
    }
    seen.set(key, sub.id);
  }
  return issues;
}
