/**
 * Etappe N9 – Zutaten-Austausch in der App (Testmodus; docs/PLAN-PHASE-5.md 19.7 N9, KONZEPT 6.9): Angebot nur in
 * änderbaren Wochen und nur sichere Alternativen, Speichern über die Regeln von `save_meal_plan`, gespeicherter Plan
 * bleibt beim nächsten Öffnen stehen (keine Neuplanung), Rezeptansicht mit neu berechneten Allergenen, Einkaufsliste
 * aus dem geänderten Plan, Export mit `ingredient_swaps`. Die Regeln selbst testet packages/core (n9-substitute.test).
 */
import {
  applyIngredientSwap,
  mealPlanProfileSchema,
  type MealPlanWeek,
  type MealSlotId,
  newShoppingList,
  recipeVariantForMeal,
  resolveShoppingList,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { localDataExport } from './data-export';
import { applyMealPlanSave, checkMealPlanSave } from './meal-plan-rows';
import {
  canSwapIngredient,
  computeNutritionWeek,
  ingredientSwapView,
  type NutritionWeekResult,
  recipeForPerson,
} from './nutrition-plan';
import type { UserRows } from './types';

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();
const NEXT_WEEK = '2026-10-05'; // TODAY = Samstag 03.10.2026
const PAST_WEEK = '2026-09-21';

function rows(diet: 'vegetarian' | 'omnivore' | 'vegan', flags: string[] = []): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss', flags });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: diet,
      eats_pork: diet === 'omnivore' ? true : null,
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
    },
    nutritionSetup: {
      user_id: USER_ID,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch',
      show_energy_numbers: true,
    },
    bodyMetrics: [
      {
        id: 'bm-1',
        user_id: USER_ID,
        measured_on: '2026-09-20',
        height_cm: 170,
        weight_kg: 70,
        body_fat_pct: null,
        resting_heart_rate_bpm: null,
      },
    ],
  };
}

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }> & {
  plan: MealPlanWeek;
  planState: NonNullable<Extract<NutritionWeekResult, { kind: 'ready' }>['planState']>;
};

function week(data: UserRows, weekStart = NEXT_WEEK): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null || result.planState === null) {
    throw new Error('Plan erwartet');
  }
  return result as Ready;
}

/** Erste austauschbare Zutat mit mindestens einer Alternative. */
function firstSwappable(ready: Ready) {
  for (const day of ready.plan.days) {
    for (const meal of day.meals) {
      if (meal.isFill) continue;
      for (const ingredient of meal.ingredients) {
        const target = { date: day.date, slot: meal.slot, index: ingredient.index };
        if (!canSwapIngredient(ready, target)) continue;
        const view = ingredientSwapView(ready, target);
        if (view.ok && view.options.length > 0) return { target, meal, view };
      }
    }
  }
  return null;
}

const ctx = { id: 'mp-1', userId: USER_ID, now: '2026-10-03T10:00:00.000Z', autoAdjusted: false };

describe('Zutaten-Austausch im Testmodus (Etappe N9)', () => {
  it('Tausch → speichern → beim nächsten Öffnen gespeichert (keine Neuplanung), Rezept mit neuen Allergenen', () => {
    const data = rows('omnivore');
    const ready = week(data);
    const found = firstSwappable(ready);
    expect(found).not.toBeNull();
    if (found === null) return;
    const option = found.view.options[0]!;
    const check = checkMealPlanSave(option.plan, { today: TODAY, rows: data, versions: VERSIONS });
    expect(check.ok).toBe(true);
    const saved = applyMealPlanSave(data, option.plan, ctx);
    const again = week(saved);
    expect(again.planState.action).toBe('stored');
    const meal = again.plan.days
      .find((d) => d.date === found.target.date)
      ?.meals.find((m) => m.slot === found.target.slot && !m.isFill);
    expect(meal?.ingredientSwaps).toEqual([
      {
        index: found.target.index,
        foodId: expect.any(String),
        substituteFoodId: option.substituteFoodId,
      },
    ]);
    const opened = recipeForPerson({
      recipeId: found.meal.recipeId,
      library: LIBRARY,
      rows: saved,
      versions: VERSIONS,
      week: again,
      allowDrafts: true,
      from: { date: found.target.date, slot: found.target.slot },
    });
    expect(opened.kind).toBe('ok');
    if (opened.kind !== 'ok') return;
    expect(opened.variant.swaps.map((s) => s.substituteFoodId)).toEqual([option.substituteFoodId]);
    const substitute = LIBRARY.foods.get(option.substituteFoodId as string);
    for (const group of substitute?.groups ?? []) {
      expect(opened.variant.facts.allergens).toContain(group);
    }
    // Export (Art. 15): Austausch-Einträge je Mahlzeit.
    const exported = localDataExport(saved, USER_ID, ctx.now);
    expect(
      (exported.data.meal_plan_items as { ingredient_swaps: unknown[] }[]).some(
        (item) => item.ingredient_swaps.length === 1,
      ),
    ).toBe(true);
  });

  it('Einkaufsliste wird mit dem geänderten Plan neu erzeugt (W22)', () => {
    const data = rows('omnivore');
    const ready = week(data);
    const found = firstSwappable(ready);
    if (found === null) throw new Error('Austausch erwartet');
    const option = found.view.options[0]!;
    const list = newShoppingList(ready.plan, ready.planState.input);
    const resolved = resolveShoppingList(list, option.plan, ready.planState.input);
    expect(resolved.action).toBe('rebuilt');
    expect(resolved.list.items.some((i) => i.foodId === option.substituteFoodId)).toBe(true);
  });

  it('vegetarisch: nie Fleisch/Fisch; vegan: nie Ei – auch nicht als Alternative', () => {
    for (const diet of ['vegetarian', 'vegan'] as const) {
      const ready = week(rows(diet));
      for (const day of ready.plan.days) {
        for (const meal of day.meals.filter((m) => !m.isFill)) {
          for (const ingredient of meal.ingredients) {
            const view = ingredientSwapView(ready, {
              date: day.date,
              slot: meal.slot,
              index: ingredient.index,
            });
            if (!view.ok) continue;
            for (const option of view.options) {
              const food = LIBRARY.foods.get(option.foodId);
              const animal = food?.animal ?? [];
              if (diet === 'vegan') expect(animal).toEqual([]);
              expect(animal.some((a) => a === 'meat' || a === 'fish')).toBe(false);
            }
          }
        }
      }
    }
  });

  it('Schwangerschaft: jede angebotene Alternative besteht den Filter mit Schwangerschafts-Ausschluss', () => {
    const data = rows('omnivore', ['pregnancy', 'conservative_plan']);
    const ready = week(data);
    let checked = 0;
    for (const day of ready.plan.days) {
      for (const meal of day.meals.filter((m) => !m.isFill)) {
        for (const ingredient of meal.ingredients) {
          const view = ingredientSwapView(ready, {
            date: day.date,
            slot: meal.slot,
            index: ingredient.index,
          });
          if (!view.ok) continue;
          for (const option of view.options) {
            const swapped = option.plan.days
              .find((d) => d.date === day.date)
              ?.meals.find((m) => m.slot === meal.slot && !m.isFill);
            const recipe = LIBRARY.recipes.find((r) => r.id === meal.recipeId);
            if (swapped === undefined || recipe === undefined) continue;
            checked += 1;
            expect(
              recipeVariantForMeal(
                recipe,
                swapped,
                {
                  profile: mealPlanProfileSchema.parse({ diet: 'omnivore', eatsPork: true }),
                  excludePregnancyCaution: true,
                  allowDrafts: true,
                },
                LIBRARY.foods,
                LIBRARY.substitutions,
              ),
            ).not.toBeNull();
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('ohne gültige Einwilligung zu Gesundheitsdaten kein Austausch (Plan mit Tausch = Gesundheitsdatum, S5)', () => {
    const base = rows('omnivore');
    const ready = week(base);
    const found = firstSwappable(ready);
    if (found === null) throw new Error('Austausch erwartet');
    expect(found.view.options[0]!.plan.usesHealthData).toBe(true);
    const noConsent = week({ ...base, consents: [] });
    expect(noConsent.planState.ingredientSwapAllowed).toBe(false);
    expect(canSwapIngredient(noConsent, found.target)).toBe(false);
    expect(ingredientSwapView(noConsent, found.target)).toEqual({
      ok: false,
      reason: 'consent_required',
    });
  });

  it('vergangene Woche nicht änderbar; ohne Rolle kein Knopf', () => {
    const past = week(rows('omnivore'), PAST_WEEK);
    const meal = past.plan.days[0]?.meals[0];
    if (meal === undefined) return;
    const target = { date: past.plan.days[0]!.date, slot: meal.slot, index: 0 };
    expect(canSwapIngredient(past, target)).toBe(false);
    expect(ingredientSwapView(past, target)).toEqual({ ok: false, reason: 'not_editable' });
  });

  it('veralteter Speicher: Austausch-Eintrag fehlt in der Tabelle → Plan neu erstellt, nie angezeigt', () => {
    const data = rows('omnivore');
    const ready = week(data);
    const found = firstSwappable(ready);
    if (found === null) throw new Error('Austausch erwartet');
    const saved = applyMealPlanSave(data, found.view.options[0]!.plan, ctx);
    const without = computeNutritionWeek({
      rows: saved,
      versions: VERSIONS,
      today: TODAY,
      weekStart: NEXT_WEEK,
      library: { ...LIBRARY, substitutions: [] },
      allowDrafts: true,
    });
    expect(without.kind === 'ready' && without.planState?.action).toBe('rebuilt');
    expect(
      without.kind === 'ready' &&
        without.plan?.days.some((d) => d.meals.some((m) => (m.ingredientSwaps ?? []).length > 0)),
    ).toBe(false);
  });

  it('Aktion wie die App: applyIngredientSwap mit dem Plan-Input der Woche', () => {
    const ready = week(rows('omnivore'));
    const found = firstSwappable(ready);
    if (found === null) throw new Error('Austausch erwartet');
    const result = applyIngredientSwap(
      ready.plan,
      { ...found.target, slot: found.target.slot as MealSlotId },
      found.view.options[0]!.substituteFoodId,
      ready.planState.input,
    );
    expect(result.ok).toBe(true);
  });
});
