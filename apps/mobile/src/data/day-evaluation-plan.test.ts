/**
 * Wächter A2 S1 (G2): „Dein Tag“ und „Gegessen“ nutzen in vergangenen Tagen nur einen GESPEICHERTEN Essensplan – nie
 * einen erst jetzt erzeugten Plan (Regel `evaluationMealPlanUsable` in packages/core, Zustand aus computeNutritionWeek).
 */
import {
  evaluationMealPlanUsable,
  selectNutritionContent,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { applyMealPlanSave } from './meal-plan-rows';
import { computeNutritionWeek, nutritionWeekStart } from './nutrition-plan';
import type { UserRows } from './types';

const WEEK = nutritionWeekStart(TODAY); // Montag 28.09.2026; TODAY = Samstag 03.10.2026
const LAST_WEEK = '2026-09-21';
const LIBRARY = (() => {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
})();

function rows(
  options: { consent?: 'valid' | 'none'; flags?: string[]; diet?: 'vegetarian' | 'omnivore' } = {},
): UserRows {
  const consent = options.consent ?? 'valid';
  const base = planPersonRows({ consent, goal: 'fat_loss', flags: options.flags ?? [] });
  return {
    ...base,
    profile: base.profile ? { ...base.profile, sex: 'female' } : null,
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: options.diet ?? 'vegetarian',
      eats_pork: options.diet === 'omnivore' ? true : null,
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
    bodyMetrics:
      consent === 'valid'
        ? [
            {
              id: 'bm-1',
              user_id: USER_ID,
              measured_on: '2026-09-20',
              height_cm: 170,
              weight_kg: 70,
              body_fat_pct: null,
              resting_heart_rate_bpm: null,
            },
          ]
        : [],
  };
}

function state(data: UserRows, weekStart: string) {
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
  return { ...result, plan: result.plan };
}

function usable(data: UserRows, weekStart: string, date: string) {
  const r = state(data, weekStart);
  return evaluationMealPlanUsable({
    planStored: r.planState?.action === 'stored',
    weekEditable: r.planState?.editable === true,
    date,
    today: TODAY,
  });
}

describe('S1: Essensplan in „Dein Tag“ und für „Gegessen“', () => {
  it('vergangene Woche ohne gespeicherten Plan: Plan wird nur erzeugt (created), nicht verwendet', () => {
    const data = rows();
    expect(state(data, LAST_WEEK).planState?.action).toBe('created');
    expect(usable(data, LAST_WEEK, '2026-09-24')).toBe(false);
  });

  it('laufende Woche, noch nicht gespeichert: vergangene Tage nein, heute ja', () => {
    const data = rows();
    expect(usable(data, WEEK, '2026-09-30')).toBe(false);
    expect(usable(data, WEEK, TODAY)).toBe(true);
  });

  it('gespeicherter Plan: auch vergangene Tage', () => {
    const data = rows();
    const stored = applyMealPlanSave(data, state(data, WEEK).plan, {
      id: 'mp-1',
      userId: USER_ID,
      now: '2026-10-03T10:00:00.000Z',
      autoAdjusted: false,
    });
    expect(state(stored, WEEK).planState?.action).toBe('stored');
    expect(usable(stored, WEEK, '2026-09-30')).toBe(true);
  });
});
