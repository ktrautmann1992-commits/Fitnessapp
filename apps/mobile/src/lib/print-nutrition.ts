import {
  buildNutritionPlanDocument,
  buildShoppingListDocument,
  type NutritionDocumentResult,
  type NutritionLibrary,
  nutritionPlanPrintOptionsSchema,
  type NutritionPlanPrintOptionsInput,
  PRINT_EXPORT,
} from '@fitnessapp/core';
import { renderPrintHtml } from '@fitnessapp/ui/print';

import type { NutritionWeekResult } from '@/data/nutrition-plan';
import { t } from '@/i18n';

import { translatePrintDocument } from './print-document';

/**
 * Essensplan und Einkaufsliste als PDF (docs/PLAN-PHASE-5.md 11, Etappe N6 – PDF P5): verbindet die Woche aus
 * `useNutritionWeek` mit dem Dokumentmodell aus packages/core, der Übersetzung und dem HTML-Renderer aus packages/ui.
 * Keine Fachlogik – die Regeln (Zahlen nur als Tagessumme, nichts Verräterisches) stehen im Core.
 *
 * Datenschutz: Das Ergebnis bleibt im Speicher; es wird nie geloggt, gespeichert oder hochgeladen.
 */

export type NutritionPrintKind = 'nutrition_plan' | 'shopping_list';

/** Einstellungen der Druckansicht (nichts davon wird gespeichert). Name nur beim Essensplan. */
export interface NutritionPrintForm {
  readonly includeName: boolean;
  readonly name: string;
}

export const DEFAULT_NUTRITION_PRINT_FORM: NutritionPrintForm = { includeName: false, name: '' };

type ReadyWeek = Extract<NutritionWeekResult, { kind: 'ready' }>;

export interface NutritionPrintInput {
  readonly kind: NutritionPrintKind;
  readonly week: ReadyWeek;
  readonly library: NutritionLibrary;
  /** Wie in der App (`useNutritionWeek().showNumbers`); der Core prüft Schwangerschaft/Stillzeit zusätzlich. */
  readonly showNumbers: boolean;
  /** Beispiel-Rezepte mit Testwerten (Testmodus). */
  readonly demo: boolean;
  readonly today: string;
  readonly form: NutritionPrintForm;
}

export type NutritionPrintResult =
  | { readonly ok: true; readonly html: string; readonly title: string }
  | { readonly ok: false; readonly error: 'invalid_options'; readonly nameError: string | null }
  | {
      readonly ok: false;
      /** `failed` = Dokument ungültig (Programmierfehler) – nie still weiterdrucken, nie Details loggen. */
      readonly error: 'no_plan' | 'no_meals' | 'recipe_missing' | 'failed';
    };

function planOptions(input: NutritionPrintInput): NutritionPlanPrintOptionsInput {
  return {
    onDate: input.today,
    includeName: input.form.includeName,
    name: input.form.includeName ? input.form.name : null,
    showEnergyNumbers: input.showNumbers,
    testValues: input.demo,
  };
}

/** Verständliche Meldung zum Namen – die Prüfung macht das Zod-Schema aus packages/core. */
export function nutritionNameError(input: NutritionPrintInput): string | null {
  if (input.kind !== 'nutrition_plan') return null;
  const parsed = nutritionPlanPrintOptionsSchema.safeParse(planOptions(input));
  if (parsed.success) return null;
  const issue = parsed.error.issues.find((i) => i.path[0] === 'name');
  if (!issue) return null;
  if (issue.code === 'too_big') return t.printView.nameTooLong(PRINT_EXPORT.nameMaxLength);
  if (issue.code === 'custom') return t.printView.nameMissing;
  return t.printView.nameInvalid;
}

/** Baut das Druck-HTML des Essensplans bzw. der Einkaufsliste der Woche. */
export function buildNutritionPrint(input: NutritionPrintInput): NutritionPrintResult {
  const { week, library } = input;
  if (week.plan === null) return { ok: false, error: 'no_plan' };
  const nameError = nutritionNameError(input);
  if (nameError) return { ok: false, error: 'invalid_options', nameError };

  let result: NutritionDocumentResult;
  if (input.kind === 'nutrition_plan') {
    result = buildNutritionPlanDocument(
      { plan: week.plan, targets: week.targets, recipes: library.recipes, foods: library.foods },
      planOptions(input),
    );
  } else {
    if (week.shopping === null) return { ok: false, error: 'no_plan' };
    result = buildShoppingListDocument(
      { list: week.shopping.list, recipes: library.recipes },
      { onDate: input.today },
    );
  }
  if (!result.ok) {
    return result.error === 'invalid_options'
      ? { ok: false, error: 'invalid_options', nameError: null }
      : { ok: false, error: result.error };
  }
  try {
    const translated = translatePrintDocument(result.document);
    return { ok: true, html: renderPrintHtml(translated), title: translated.title };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** Fehler → deutscher Text für die Druckansicht. */
export function nutritionPrintErrorText(
  result: Extract<NutritionPrintResult, { ok: false }>,
): string {
  switch (result.error) {
    case 'invalid_options':
      return result.nameError ?? t.printView.failed;
    case 'no_plan':
      return t.nutrition.printView.noPlan;
    case 'no_meals':
      return t.nutrition.printView.noMeals;
    case 'recipe_missing':
      return t.nutrition.printView.recipeMissing;
    case 'failed':
      return t.printView.failed;
  }
}

/** Gesundheitsbezug des Dokuments (7.1) → Hinweis-Dialog vor dem Erzeugen (11, K4). */
export function nutritionPrintUsesHealthData(kind: NutritionPrintKind, week: ReadyWeek): boolean {
  if (kind === 'nutrition_plan') return week.plan?.usesHealthData === true;
  return week.shopping?.list.usesHealthData === true || week.plan?.usesHealthData === true;
}
