import { isoWeekday, type NutritionPrintTextParams } from '@fitnessapp/core';

import { t } from '@/i18n';

import {
  formatAmount,
  formatKcal,
  formatNumberDe,
  nutrientSourcesText,
  shoppingCategoryLabel,
  shoppingItemText,
  slotLabel,
} from './nutrition-format';

/**
 * Texte der Ernährungs-Dokumente (docs/PLAN-PHASE-5.md 11, Etappe N6 – PDF P5): Code → fertiger Text. Nur
 * Formulierung, keine Fachlogik (Teil von print-document.ts). Keine Gründe, kein Gewicht, keine Unverträglichkeiten.
 */

const p = t.nutrition.print;
const r = t.nutrition.recipe;
const WEEKDAYS = t.steps.trainingSchedule.weekdays;

const weekday = (date: string) => WEEKDAYS[isoWeekday(date) - 1] ?? '';
const dayMonth = (date: string) => {
  const [, month, day] = date.split('-');
  return `${day}.${month}.`;
};

type Translators = {
  readonly [K in keyof NutritionPrintTextParams]: (params: NutritionPrintTextParams[K]) => string;
};

export const NUTRITION_PRINT_TEXTS: Translators = {
  'nutrition.doc.title': ({ document }) => p.docTitle[document],
  'nutrition.doc.footer': ({ document, sources, testValues }) => {
    if (document === 'shopping_list') return p.footer;
    const origin = testValues ? p.footerTestValues : (nutrientSourcesText(sources) ?? '');
    return origin ? `${p.footer} ${origin}` : p.footer;
  },
  'nutrition.cover.heading': ({ document }) => p.coverHeading[document],
  'nutrition.label.week': () => p.labelWeek,
  'nutrition.label.range': () => p.labelRange,
  'nutrition.howTo': ({ document, numbers }) =>
    document === 'shopping_list'
      ? p.howToList
      : numbers
        ? `${p.howToPlan} ${p.howToNumbers}`
        : p.howToPlan,
  'nutrition.notice.title': () => p.noticeTitle,
  'nutrition.notice.medical': () => t.nutrition.disclaimer,
  'nutrition.notice.products': () => `${r.traces} ${t.nutrition.hfiCoeliac}`,
  'nutrition.notice.testValues': () => p.testValues,
  'nutrition.notice.draftAllergens': () => p.draftAllergens,
  'mealplan.week.heading': ({ continued }) => (continued ? p.weekHeadingContinued : p.weekHeading),
  'mealplan.col.slot': () => p.colSlot,
  'mealplan.col.day': ({ date }) => `${weekday(date)} ${dayMonth(date)}`,
  'mealplan.slot': ({ slot }) => (slot === 'extra' ? p.extraRow : slotLabel(slot)),
  'mealplan.portion': ({ factor }) => p.portion(formatNumberDe(factor)),
  'mealplan.mark': ({ mark }) => p.marks[mark],
  'mealplan.cell.none': () => p.none,
  'mealplan.cell.noRecipe': () => p.noRecipe,
  'mealplan.row.day': ({ numbers }) => (numbers ? p.rowTotal : p.rowNote),
  'mealplan.cell.belowFloor': () => p.belowFloor,
  'value.kcal': ({ kcal }) => p.kcal(formatKcal(kcal)),
  'mealplan.legend': ({ numbers, hasFill, hasLeftover, hasCook, hasBelowFloor, hasNoRecipe }) =>
    [
      p.legendPortion,
      hasFill ? p.legendFill : '',
      hasCook ? p.legendCook : '',
      hasLeftover ? p.legendLeftover : '',
      hasBelowFloor ? p.legendBelowFloor : '',
      hasNoRecipe ? p.legendNoRecipe : '',
      numbers ? p.legendNumbers : '',
    ]
      .filter((v) => v !== '')
      .join(' '),
  'recipe.continued': ({ recipe }) => p.recipeContinued(recipe),
  'recipe.label.inPlan': () => p.labelInPlan,
  'recipe.inPlan': ({ uses }) =>
    uses.map((u) => p.use(weekday(u.date), slotLabel(u.slot))).join(', '),
  'recipe.label.time': () => p.labelTime,
  'recipe.time': ({ prep, cook }) => r.times(prep, cook),
  'recipe.mark.aiDraft': () => r.aiDraft,
  'recipe.ingredients': () => r.ingredients,
  'recipe.col.ingredient': () => p.colIngredient,
  'recipe.col.portion': ({ factor, weekdays }) =>
    p.colPortion(formatNumberDe(factor), weekdays.map((d) => WEEKDAYS[d - 1] ?? '').join(', ')),
  'recipe.ingredient': ({ food, original, optional, note }) =>
    `${original !== null ? r.instead(original, food) : food}${optional ? ` ${r.optional}` : ''}${
      note ? ` – ${note}` : ''
    }`,
  'value.amount': ({ amount, unit }) => formatAmount(amount, unit),
  'recipe.omitted': ({ foods }) => p.omitted(foods.join(', ')),
  'recipe.steps': () => r.steps,
  'recipe.equipment': ({ items }) => r.equipment(items.join(', ')),
  'recipe.storage': ({ fridgeDays, freezable }) =>
    [fridgeDays > 0 ? r.mealPrepFridge(fridgeDays) : '', freezable ? r.mealPrepFreezable : '']
      .filter((v) => v !== '')
      .join(' '),
  'shopping.category': ({ category }) => shoppingCategoryLabel(category),
  'shopping.pantry': () => t.nutrition.shopping.pantry,
  'shopping.item': ({ amount, unit, label, manual, foodId }) =>
    shoppingItemText({ amount, unit, labelDe: label, isManual: manual, foodId: foodId ?? null }),
  'shopping.recipes': ({ recipes }) =>
    p.addedRecipes(
      recipes.map((x) => t.nutrition.shopping.recipeLine(x.title, x.servings)).join(', '),
    ),
  'shopping.empty': () => t.nutrition.shopping.empty,
};
