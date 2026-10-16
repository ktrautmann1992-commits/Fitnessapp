/**
 * Etappe N5a (docs/PLAN-PHASE-5.md 6.3 Nr. 7, 6.6, 7.3–7.5, 8.2 Nr. 2–3): gespeicherter Essensplan im Testmodus –
 * Speicher-Regeln wie `save_meal_plan` (Datumsrahmen, Einwilligung/Faktor S9), ein Plan je Woche, Gerätespeicher
 * nicht vertrauenswürdig (Zod), Widerruf löscht Pläne mit Gesundheitsbezug, Export, und der Ablauf
 * „neu → gespeichert → Schwangerschaft gesetzt → automatisch neu geplant (W11 App-Logik) → gespeichert“.
 */
import {
  type MealPlanWeek,
  mealPlanWithOtherSuggestions,
  selectNutritionContent,
  swapMealRecipe,
  toSavePlanPayload,
  validateContent,
} from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { planPersonRows, seededBackend, TODAY, USER_ID, VERSIONS } from '../test/fixtures';
import { BackendError } from './backend';
import { localDataExport } from './data-export';
import { upgradeStoredRows } from './legacy-rows';
import { applyMealPlanSave, checkMealPlanSave, storedMealPlanRow } from './meal-plan-rows';
import {
  computeNutritionWeek,
  nutritionWeekStart,
  type NutritionWeekResult,
} from './nutrition-plan';
import type { UserRows } from './types';
import { generatePlanFromRows } from './training-plan';
import { applyHealthDataRevocation } from './write-ops';

const WEEK = nutritionWeekStart(TODAY); // Montag 28.09.2026; TODAY = Samstag 03.10.2026
const NEXT_WEEK = '2026-10-05';

function demoLibrary() {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
}
const LIBRARY = demoLibrary();

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

function week(data: UserRows, today = TODAY, weekStart = WEEK) {
  const result = computeNutritionWeek({
    rows: data,
    versions: VERSIONS,
    today,
    weekStart,
    library: LIBRARY,
    allowDrafts: true,
  });
  if (result.kind !== 'ready' || result.plan === null || result.planState === null) {
    throw new Error('Plan erwartet');
  }
  return result as Extract<NutritionWeekResult, { kind: 'ready' }> & {
    plan: MealPlanWeek;
    planState: NonNullable<Extract<NutritionWeekResult, { kind: 'ready' }>['planState']>;
  };
}

const ctx = { id: 'mp-1', userId: USER_ID, now: '2026-10-03T10:00:00.000Z', autoAdjusted: false };

describe('checkMealPlanSave / applyMealPlanSave (Regeln wie save_meal_plan, Testmodus)', () => {
  it('gültiger Plan der laufenden bzw. nächsten Woche → ok; ein Plan je Woche', () => {
    const data = rows();
    const plan = week(data).plan;
    expect(checkMealPlanSave(plan, { today: TODAY, rows: data, versions: VERSIONS })).toEqual({
      ok: true,
      plan,
    });
    const once = applyMealPlanSave(data, plan, ctx);
    const twice = applyMealPlanSave(once, plan, { ...ctx, id: 'mp-2' });
    expect(twice.mealPlans.map((p) => p.id)).toEqual(['mp-2']);
    const next = week(data, TODAY, NEXT_WEEK).plan;
    expect(checkMealPlanSave(next, { today: TODAY, rows: data, versions: VERSIONS }).ok).toBe(true);
    const both = applyMealPlanSave(twice, next, { ...ctx, id: 'mp-3' });
    expect(both.mealPlans.map((p) => p.week_start)).toEqual([WEEK, NEXT_WEEK]);
    expect(storedMealPlanRow(both, NEXT_WEEK)?.id).toBe('mp-3');
  });

  it('ungültig, fremde Woche, ohne Einwilligung mit Gesundheitsbezug bzw. Faktor ≠ 1 (S9) → abgelehnt', () => {
    const data = rows();
    const plan = week(data).plan;
    const check = (value: unknown, r: UserRows = data, today = TODAY) =>
      checkMealPlanSave(value, { today, rows: r, versions: VERSIONS });
    expect(check({ ...plan, engineVersion: 99 })).toEqual({ ok: false, reason: 'invalid' });
    expect(check(plan, data, '2026-10-12')).toEqual({ ok: false, reason: 'out_of_range' });
    expect(plan.usesHealthData).toBe(true);
    expect(check(plan, rows({ consent: 'none' }))).toEqual({
      ok: false,
      reason: 'consent_required',
    });
    const scaled = { ...plan, usesHealthData: false };
    expect(scaled.days.some((d) => d.meals.some((m) => m.factor !== 1))).toBe(true);
    expect(check(scaled, rows({ consent: 'none' }))).toEqual({
      ok: false,
      reason: 'consent_required',
    });
    // Ohne Einwilligung: Standardportionen (no_targets), kein Gesundheitsbezug → erlaubt.
    const plain = week(rows({ consent: 'none' })).plan;
    expect(plain.usesHealthData).toBe(false);
    expect(check(plain, rows({ consent: 'none' })).ok).toBe(true);
  });
});

describe('Gerätespeicher (upgradeStoredRows, 7.5)', () => {
  it('nur gültige Pläne des eigenen Kontos, je Woche einer; Gesundheitsbezug aus dem Plan', () => {
    const data = rows();
    const plan = week(data).plan;
    const valid = {
      id: 'mp-1',
      user_id: USER_ID,
      week_start: WEEK,
      uses_health_data: false,
      created_at: '2026-10-03T10:00:00.000Z',
      auto_adjusted: true,
      plan: JSON.parse(JSON.stringify(plan)) as unknown,
    };
    const stored = {
      ...data,
      mealPlans: [
        valid,
        { ...valid, id: 'doppelt' },
        { ...valid, id: 'fremd', user_id: 'someone-else', week_start: NEXT_WEEK },
        { ...valid, id: 'kaputt', week_start: NEXT_WEEK, plan: { weekStart: NEXT_WEEK } },
        'Unsinn',
      ],
    } as unknown as UserRows;
    const upgraded = upgradeStoredRows(stored);
    expect(upgraded.mealPlans).toHaveLength(1);
    expect(upgraded.mealPlans[0]).toMatchObject({
      id: 'mp-1',
      auto_adjusted: true,
      uses_health_data: true,
    });
    expect(upgraded.mealPlans[0]?.plan).toEqual(plan);
    // Ältere Stände ohne Essenspläne.
    const withoutPlans: Partial<UserRows> = { ...data };
    delete withoutPlans.mealPlans;
    expect(upgradeStoredRows(withoutPlans as UserRows).mealPlans).toEqual([]);
  });
});

describe('Widerruf und Export (7.3, 7.4)', () => {
  it('Widerruf health_data löscht Essenspläne mit Gesundheitsbezug, andere bleiben', () => {
    const data = rows();
    const health = week(data).plan;
    const plain = week(rows({ consent: 'none' }), TODAY, NEXT_WEEK).plan;
    let stored = applyMealPlanSave(data, health, ctx);
    stored = applyMealPlanSave(stored, plain, { ...ctx, id: 'mp-2' });
    const revoked = applyHealthDataRevocation(stored);
    expect(revoked.mealPlans.map((p) => p.id)).toEqual(['mp-2']);
  });

  it('Gespeicherte Unverträglichkeiten löschen → Essenspläne mit Gesundheitsbezug mit (Wächter N3 K5)', async () => {
    const data = rows();
    const health = week(data).plan;
    const stored = applyMealPlanSave(data, health, ctx);
    const { backend } = seededBackend(stored);
    await backend.deleteStoredIntolerances();
    expect((await backend.loadRows()).rows.mealPlans).toEqual([]);
  });

  it('Export enthält meal_plans und meal_plan_items (Spalten wie 7.2)', () => {
    const data = rows();
    const plan = week(data).plan;
    const stored = applyMealPlanSave(data, plan, ctx);
    const file = localDataExport(stored, USER_ID, ctx.now);
    expect(file.data.meal_plans).toEqual([
      expect.objectContaining({
        id: 'mp-1',
        week_start: WEEK,
        uses_health_data: true,
        variant: 0,
        status: 'active',
      }),
    ]);
    // Wächter N5a S4: vollständig – der ganze gespeicherte Schnappschuss und der Hinweis-Zustand.
    const exported = (
      file.data.meal_plans as { plan_snapshot: unknown; auto_adjusted: boolean }[]
    )[0];
    expect(exported?.plan_snapshot).toEqual(plan);
    expect(exported?.auto_adjusted).toBe(false);
    const items = file.data.meal_plan_items as { plan_id: string; date: string }[];
    expect(items).toHaveLength(plan.days.reduce((n, d) => n + d.meals.length, 0));
    expect(items.every((i) => i.plan_id === 'mp-1')).toBe(true);
  });
});

describe('Ablauf im Testmodus: neu → gespeichert → Schwangerschaft → automatisch angepasst (W11)', () => {
  it('Plan wird gespeichert, bleibt stabil, und passt sich nach „schwanger“ ab heute an', async () => {
    // Mittwoch der Woche: Mo/Di sind vergangen.
    const wednesday = '2026-09-30';
    const { backend } = seededBackend(rows(), wednesday);
    const first = week((await backend.loadRows()).rows, wednesday);
    expect(first.planState.action).toBe('created');
    expect(first.planState.editable).toBe(true);
    const saved = await backend.saveMealPlan(first.plan, { autoAdjusted: false }, rows());
    expect(saved.mealPlans).toHaveLength(1);
    const again = week((await backend.loadRows()).rows, wednesday);
    expect(again.planState).toMatchObject({
      action: 'stored',
      autoAdjusted: false,
      updateSuggested: false,
    });
    expect(again.plan).toEqual(first.plan);

    // Gesundheits-Check: schwanger (Flag im Gerätespeicher wie nach dem Schritt).
    const loaded = (await backend.loadRows()).rows;
    const pregnant: UserRows = {
      ...loaded,
      healthScreenings: rows({ flags: ['pregnancy', 'conservative_plan'] }).healthScreenings,
    };
    const replanned = week(pregnant, wednesday);
    expect(replanned.planState.action).toBe('replanned');
    expect(replanned.planState.autoAdjusted).toBe(true);
    expect(replanned.plan.days.slice(0, 2)).toEqual(first.plan.days.slice(0, 2));
    const foods = LIBRARY.foods;
    for (const day of replanned.plan.days.slice(2)) {
      expect(day.status).toBe('no_targets');
      for (const meal of day.meals) {
        expect(meal.ingredients.some((i) => foods.get(i.foodId)?.pregnancy_caution === true)).toBe(
          false,
        );
      }
    }
  });

  it('Tauschen und „Andere Vorschläge“ werden gespeichert; vergangene Wochen nicht änderbar', async () => {
    const omnivore = rows({ diet: 'omnivore' });
    const { backend } = seededBackend(omnivore);
    const current = week((await backend.loadRows()).rows);
    await backend.saveMealPlan(current.plan, { autoAdjusted: false }, omnivore);
    // Erste tauschbare Mahlzeit ab heute (der Beispiel-Bestand ist klein: oft kommt jedes passende Rezept schon in
    // der Woche vor → „kein anderes passendes Rezept“).
    const attempts = current.plan.days
      .filter((d) => d.date >= TODAY)
      .flatMap((d) =>
        d.meals
          .filter((m) => !m.isFill)
          .map((m) => ({
            date: d.date,
            meal: m,
            result: swapMealRecipe(
              current.plan,
              { date: d.date, slot: m.slot as 'breakfast' },
              current.planState.input,
            ),
          })),
      );
    for (const attempt of attempts) {
      if (!attempt.result.ok) expect(attempt.result.reason).toBe('no_alternative');
    }
    const found = attempts.find((a) => a.result.ok);
    if (!found || !found.result.ok) throw new Error('tauschbare Mahlzeit erwartet');
    const swapped = found.result;
    const newMeal = swapped.plan.days
      .find((d) => d.date === found.date)
      ?.meals.find((m) => m.slot === found.meal.slot && !m.isFill);
    expect(newMeal?.recipeId).not.toBe(found.meal.recipeId);
    const after = await backend.saveMealPlan(swapped.plan, { autoAdjusted: false }, omnivore);
    expect(storedMealPlanRow(after, WEEK)?.plan).toEqual(swapped.plan);
    // Der getauschte Plan bleibt beim nächsten Öffnen so (keine automatische Neuplanung).
    expect(week(after).planState.action).toBe('stored');
    expect(week(after).plan).toEqual(swapped.plan);
    const other = mealPlanWithOtherSuggestions(current.plan, current.planState.input);
    const afterOther = await backend.saveMealPlan(other, { autoAdjusted: false }, omnivore);
    expect(storedMealPlanRow(afterOther, WEEK)?.plan?.variant).toBe(1);

    // Woche davor: nicht änderbar, nicht speicherbar.
    const previous = week(rows(), TODAY, '2026-09-21');
    expect(previous.planState.editable).toBe(false);
    await expect(
      backend.saveMealPlan(previous.plan, { autoAdjusted: false }, rows()),
    ).rejects.toBeInstanceOf(BackendError);
  });
});

describe('Wächter N5a S1: ungültige Einwilligung mitten in der Woche', () => {
  it('gespeicherter Plan mit Gesundheitsbezug wird ohne gültige Einwilligung nicht weiterverwendet – Speichern klappt', async () => {
    const wednesday = '2026-09-30';
    const withConsent = rows();
    const stored = applyMealPlanSave(withConsent, week(withConsent, wednesday).plan, ctx);
    expect(stored.mealPlans[0]?.uses_health_data).toBe(true);
    // Neue Fassung der Einwilligung (veraltet, kein Widerruf): Plan bleibt im Speicher, wird aber nicht verwendet.
    const outdated: UserRows = {
      ...stored,
      consents: stored.consents.map((c) =>
        c.consent_type === 'health_data' ? { ...c, version: 0 } : c,
      ),
      bodyMetrics: [],
    };
    const result = week(outdated, wednesday);
    expect(result.planState.action).toBe('created');
    expect(result.plan.usesHealthData).toBe(false);
    expect(result.plan.days.every((d) => d.meals.every((m) => m.factor === 1))).toBe(true);
    const { backend } = seededBackend(outdated, wednesday);
    const saved = await backend.saveMealPlan(result.plan, { autoAdjusted: false }, outdated);
    expect(saved.mealPlans.map((p) => p.uses_health_data)).toEqual([false]);
  });
});

describe('Wächter N5a S3: Schreibvorgänge im Testmodus nacheinander', () => {
  it('Essensplan und Trainingsplan gleichzeitig gespeichert → beide bleiben erhalten', async () => {
    const data = rows();
    const { backend } = seededBackend(data);
    const library = await backend.loadPlanLibrary({ allowCached: false });
    if (!library) throw new Error('Bibliothek fehlt');
    const training = generatePlanFromRows(data, VERSIONS, library, TODAY);
    if (!training.ok) throw new Error(training.error);
    const meal = week(data).plan;
    await Promise.all([
      backend.savePlan(toSavePlanPayload(training.plan), data),
      backend.saveMealPlan(meal, { autoAdjusted: false }, data),
      backend.saveReminder({ enabled: true, intervalDays: 14 }, null, data),
    ]);
    const { rows: after } = await backend.loadRows();
    expect(after.plans).toHaveLength(1);
    expect(after.mealPlans).toHaveLength(1);
    expect(after.reminder).not.toBeNull();
  });
});
