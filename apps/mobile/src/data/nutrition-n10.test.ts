/**
 * Etappe N10 – Bewertung nach dem Essen in der App (Testmodus; docs/PLAN-PHASE-5.md 19.7 N10, KONZEPT 6.10):
 * Speichern im Gerätespeicher mit denselben Regeln wie die künftigen Tabellen, „Unverträglich“ landet NIE im
 * Gerätespeicher, in Meldungen oder Logs, „mag ich nicht“ je Lebensmittel wirkt im Essensplan, Bewertungen ändern den
 * gespeicherten Plan nicht (keine Neuplanung), Export und Löschung. Die Regeln selbst testet packages/core
 * (n10-ratings.test).
 */
import {
  addFoodDislikes,
  foodDislikeChoices,
  type MealPlanWeek,
  recipeRatingFromChoice,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { localDataExport } from './data-export';
import { STORAGE_KEYS } from './kv';
import { upgradeStoredRows } from './legacy-rows';
import { applyMealPlanSave } from './meal-plan-rows';
import { computeNutritionWeek, type NutritionWeekResult } from './nutrition-plan';
import { checkRecipeRatingSave, ratingForRecipe } from './rating-rows';
import type { UserRows } from './types';

const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();
const WEEK = '2026-09-28'; // TODAY = Samstag 03.10.2026 → laufende Woche

function rows(): UserRows {
  const base = planPersonRows({ consent: 'valid', goal: 'fat_loss' });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'omnivore',
      eats_pork: true,
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

type Ready = Extract<NutritionWeekResult, { kind: 'ready' }> & { plan: MealPlanWeek };

function week(data: UserRows, weekStart = WEEK): Ready {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today: TODAY,
    weekStart,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null) throw new Error('Plan erwartet');
  return result as Ready;
}

/** Mahlzeit von heute (bewertbar). */
function todaysMeal(plan: MealPlanWeek) {
  const meal = plan.days.find((d) => d.date === TODAY)?.meals.find((m) => !m.isFill);
  if (meal === undefined) throw new Error('Mahlzeit erwartet');
  return meal;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Bewertung im Testmodus (Etappe N10)', () => {
  it('„Unverträglich“: gespeichert wird nur Daumen runter ohne Grund – nichts davon im Gerätespeicher, nichts geloggt', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const data = rows();
    const meal = todaysMeal(week(data).plan);
    const { backend, store } = seededBackend(data);
    const decision = recipeRatingFromChoice({
      recipeId: meal.recipeId,
      value: 'down',
      choice: 'intolerant',
      ratedOn: TODAY,
    });
    expect(decision.offerFoodDislikes).toBe(true);
    let next = await backend.saveRecipeRating(
      { recipeId: meal.recipeId, rating: decision.rating },
      data,
    );
    expect(ratingForRecipe(next, meal.recipeId)).toEqual({
      recipeId: meal.recipeId,
      value: 'down',
      reason: null,
      ratedOn: TODAY,
    });
    // Dialog: nichts vorausgewählt – ohne Auswahl wird nichts gespeichert.
    const choices = foodDislikeChoices(meal.ingredients, LIBRARY.foods, []);
    expect(choices.length).toBeGreaterThan(0);
    expect(addFoodDislikes([], [])).toEqual({ ok: false, reason: 'nothing_selected' });
    const first = choices[0]?.foodId as string;
    const update = addFoodDislikes([], [first]);
    if (!update.ok) throw new Error('Auswahl erwartet');
    next = await backend.saveFoodDislikes(update.dislikes, next);
    expect(next.foodDislikes).toEqual([{ user_id: USER_ID, food_id: first }]);

    const raw = store.dump()[STORAGE_KEYS.localDb] ?? '';
    expect(raw).not.toMatch(/intoler|unvertr/i);
    const stored = JSON.parse(raw) as { rows: UserRows };
    expect(stored.rows.recipeRatings).toEqual([
      { user_id: USER_ID, recipe_id: meal.recipeId, value: 'down', reason: null, rated_on: TODAY },
    ]);
    // Export: Bewertungen und Abneigungen ohne Gesundheitsgrund.
    const exported = JSON.stringify(localDataExport(next, USER_ID, '2026-10-03T12:00:00.000Z'));
    expect(exported).not.toMatch(/intoler|unvertr/i);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });

  it('Gerätespeicher lässt keinen Gesundheitsgrund herein (manipulierte Zeile wird verworfen)', () => {
    const data = rows();
    const upgraded = upgradeStoredRows({
      ...data,
      recipeRatings: [
        {
          user_id: USER_ID,
          recipe_id: 'a-a',
          value: 'down',
          reason: 'intolerant',
          rated_on: TODAY,
        },
        { user_id: USER_ID, recipe_id: 'b-b', value: 'down', reason: 'taste', rated_on: TODAY },
        { user_id: USER_ID, recipe_id: 'b-b', value: 'up', reason: null, rated_on: TODAY },
        { user_id: 'fremd', recipe_id: 'c-c', value: 'up', reason: null, rated_on: TODAY },
        {
          user_id: USER_ID,
          recipe_id: 'd-d',
          value: 'up',
          reason: null,
          rated_on: TODAY,
          note: 'Bauchweh',
        },
      ] as unknown as UserRows['recipeRatings'],
      foodDislikes: [
        { user_id: USER_ID, food_id: 'banane' },
        { user_id: USER_ID, food_id: 'banane' },
        { user_id: USER_ID, food_id: 'Kein Slug' },
        { user_id: USER_ID, food_id: 'reis', grund: 'allergie' },
      ] as unknown as UserRows['foodDislikes'],
    });
    expect(upgraded.recipeRatings.map((r) => r.recipe_id)).toEqual(['b-b']);
    expect(upgraded.foodDislikes).toEqual([{ user_id: USER_ID, food_id: 'banane' }]);
    // Ältere Stände ohne die Felder.
    const old: Partial<UserRows> = { ...data };
    delete old.recipeRatings;
    delete old.foodDislikes;
    const legacy = upgradeStoredRows(old as UserRows);
    expect(legacy.recipeRatings).toEqual([]);
    expect(legacy.foodDislikes).toEqual([]);
  });

  it('nur mit dem heutigen Datum; Zurücknehmen und „Alle löschen“', async () => {
    const data = rows();
    expect(
      checkRecipeRatingSave(
        data,
        {
          recipeId: 'a-a',
          rating: { recipeId: 'a-a', value: 'up', reason: null, ratedOn: '2026-10-01' },
        },
        TODAY,
      ),
    ).toEqual({ ok: false, reason: 'date' });
    expect(
      checkRecipeRatingSave(
        data,
        { recipeId: 'a-a', rating: { recipeId: 'b-b', value: 'up', reason: null, ratedOn: TODAY } },
        TODAY,
      ),
    ).toEqual({ ok: false, reason: 'invalid' });
    const { backend } = seededBackend(data);
    let next = await backend.saveRecipeRating(
      { recipeId: 'a-a', rating: { recipeId: 'a-a', value: 'up', reason: null, ratedOn: TODAY } },
      data,
    );
    next = await backend.saveRecipeRating(
      {
        recipeId: 'b-b',
        rating: { recipeId: 'b-b', value: 'down', reason: 'cost', ratedOn: TODAY },
      },
      next,
    );
    expect(next.recipeRatings).toHaveLength(2);
    next = await backend.saveRecipeRating({ recipeId: 'a-a', rating: null }, next);
    expect(next.recipeRatings.map((r) => r.recipe_id)).toEqual(['b-b']);
    next = await backend.deleteRecipeRatings(next);
    expect(next.recipeRatings).toEqual([]);
    await expect(
      backend.saveRecipeRating(
        {
          recipeId: 'a-a',
          rating: { recipeId: 'a-a', value: 'up', reason: null, ratedOn: '2026-09-01' },
        },
        next,
      ),
    ).rejects.toThrow();
    await expect(backend.saveFoodDislikes(['a-a', 'a-a'], next)).rejects.toThrow();
  });

  it('Daumen runter ändert den gespeicherten Plan nicht; neu geplante Wochen lassen das Rezept weg', () => {
    const data = rows();
    const ready = week(data);
    const meal = todaysMeal(ready.plan);
    const saved = applyMealPlanSave(data, ready.plan, {
      id: 'mp-1',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    const rated: UserRows = {
      ...saved,
      recipeRatings: [
        {
          user_id: USER_ID,
          recipe_id: meal.recipeId,
          value: 'down',
          reason: 'taste',
          rated_on: TODAY,
        },
      ],
    };
    const after = week(rated);
    expect(after.planState?.action).toBe('stored');
    expect(after.plan).toEqual(ready.plan);
    // Ohne gespeicherten Plan (bzw. „Andere Vorschläge“): ab heute nicht mehr vorgeschlagen.
    const fresh = week({ ...data, recipeRatings: rated.recipeRatings });
    for (const day of fresh.plan.days.filter((d) => d.date >= TODAY)) {
      expect(day.meals.some((m) => m.recipeId === meal.recipeId)).toBe(false);
    }
  });

  it('„mag ich nicht“ je Lebensmittel: gespeicherter Plan mit dem Lebensmittel wird ab heute neu geplant', () => {
    const data = rows();
    const ready = week(data);
    const food = todaysMeal(ready.plan).ingredients[0]?.foodId as string;
    const saved = applyMealPlanSave(data, ready.plan, {
      id: 'mp-1',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    const after = week({ ...saved, foodDislikes: [{ user_id: USER_ID, food_id: food }] });
    expect(after.planState?.action).toBe('replanned');
    for (const day of after.plan.days.filter((d) => d.date >= TODAY)) {
      for (const m of day.meals) expect(m.ingredients.some((i) => i.foodId === food)).toBe(false);
    }
    // Kein Gesundheitsdatum: der Plan wird dadurch nicht zum Gesundheitsplan.
    const noHealth = week({ ...data, foodDislikes: [{ user_id: USER_ID, food_id: food }] });
    expect(noHealth.plan.usesHealthData).toBe(ready.plan.usesHealthData);
  });

  it('S1: gespeicherter Plan der NÄCHSTEN Woche mit abgelehntem Rezept → Hinweis „Plan aktualisieren“; laufende Woche nie', () => {
    const data = rows();
    const nextWeek = '2026-10-05';
    const next = week(data, nextWeek);
    const recipeId = next.plan.days[2]?.meals.find((m) => !m.isFill)?.recipeId as string;
    let saved = applyMealPlanSave(data, next.plan, {
      id: 'mp-next',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    const current = week(data);
    saved = applyMealPlanSave(saved, current.plan, {
      id: 'mp-now',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    expect(week(saved, nextWeek).planState?.ratedDownSuggested).toBe(false);
    const currentId = todaysMeal(current.plan).recipeId;
    const rated: UserRows = {
      ...saved,
      recipeRatings: [recipeId, currentId]
        .filter((id, i, all) => all.indexOf(id) === i)
        .map((id) => ({
          user_id: USER_ID,
          recipe_id: id,
          value: 'down' as const,
          reason: null,
          rated_on: TODAY,
        })),
    };
    const after = week(rated, nextWeek);
    expect(after.planState?.action).toBe('stored');
    expect(after.planState?.ratedDownSuggested).toBe(true);
    // Keine automatische Neuplanung: der Plan bleibt, bis „Plan aktualisieren“ gewählt wird.
    expect(after.plan).toEqual(next.plan);
    // Laufende Woche: nie ein Hinweis (K7).
    expect(week(rated).planState?.ratedDownSuggested).toBe(false);
  });
});
