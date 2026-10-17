/**
 * Etappe N4 (docs/PLAN-PHASE-5.md 7.4, 8.1, 8.2, 9, 13): Schritt `nutrition_setup` im Testmodus (W21, K7),
 * Widerruf mit Umwandlung (W12, R2-K4), Export, Gerätespeicher älterer Versionen und die Abbildung Zeilen → Engine
 * (K3 Körperdaten-Datum, Unverträglichkeiten nur mit Einwilligung, Rezept nur über den Filter der Person).
 */
import { selectNutritionContent, validateContent } from '@fitnessapp/core';
import { demoNutritionContent } from '@fitnessapp/core/demo-nutrition';
import { describe, expect, it } from 'vitest';

import { deriveOnboardingState, nextEditRoute } from '../state/flow';
import {
  NOW,
  planPersonRows,
  seededBackend,
  TODAY,
  USER_ID,
  testBackend,
  VERSIONS,
} from '../test/fixtures';
import { localDataExport } from './data-export';
import { STORAGE_KEYS } from './kv';
import { answersFromRows } from './mapping';
import {
  computeNutritionWeek,
  mealPlanProfileFromRows,
  nutritionInputsFromRows,
  nutritionWeekStart,
  recipeForPerson,
} from './nutrition-plan';
import { planSave } from './plan-save';
import type { FoodPreferenceRow, StepSave, UserRows } from './types';
import { applyHealthDataRevocation } from './write-ops';

const SETUP = {
  activityLevel: 'light',
  trainingTime: 'evening',
  mealprepSlots: null,
  showEnergyNumbers: true,
} as const;

function demoLibrary() {
  const demo = demoNutritionContent();
  return selectNutritionContent(validateContent(demo.files, { nutritionCatalog: demo.catalog }), {
    allowDrafts: true,
  });
}

function nutritionRows(
  patch: Partial<UserRows> = {},
  consent: 'valid' | 'none' | 'outdated' = 'valid',
): UserRows {
  return {
    ...planPersonRows({ consent, goal: 'fat_loss' }),
    nutritionPrefs: {
      user_id: USER_ID,
      diet_type: 'vegetarian',
      eats_pork: null,
      meals_per_day: 3,
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
              measured_on: '2026-10-01',
              height_cm: 180,
              weight_kg: 80,
              body_fat_pct: null,
              resting_heart_rate_bpm: null,
            },
          ]
        : [],
    ...patch,
  };
}

function prefs(...entries: [string, FoodPreferenceRow['kind']][]): FoodPreferenceRow[] {
  return entries.map(([food_group, kind]) => ({ user_id: USER_ID, food_group, kind }));
}

async function onboardedUntilCooking() {
  const setup = testBackend();
  const { backend } = setup;
  if (backend.signIn.kind !== 'test_mode') throw new Error('Testmodus erwartet');
  await backend.signIn.start();
  await backend.createProfile('1990-05-15');
  await backend.grantConsents(['terms', 'privacy'], VERSIONS);
  const save = async (step: StepSave) => {
    const { rows } = await backend.loadRows();
    return backend.saveStep(step, { answers: answersFromRows(rows), rows, versions: VERSIONS });
  };
  await save({ step: 'sex', sex: 'female', cycleModuleInterest: null });
  await save({ step: 'health_consent', granted: true });
  await save({ step: 'experience', experienceLevel: 'beginner' });
  await save({
    step: 'goal',
    goal: { goalType: 'fat_loss', secondaryGoalType: null, discipline: null, targetDate: null },
  });
  await save({
    step: 'time_budget',
    schedule: { mode: 'flex', slots: [{ kind: 'strength_gym', minutes: 45 }] },
  });
  await save({
    step: 'nutrition',
    nutrition: {
      dietType: 'vegetarian',
      eatsPork: null,
      mealsPerDay: 4,
      foodPreferences: [
        { foodGroup: 'mushrooms', kind: 'dislike' },
        { foodGroup: 'peanuts', kind: 'intolerance' },
        { foodGroup: 'gluten', kind: 'like' },
        { foodGroup: 'gluten', kind: 'intolerance' },
      ],
    },
  });
  const afterCooking = await save({
    step: 'cooking',
    cooking: { cookingMode: 'meal_prep', mealprepDays: 2 },
  });
  return { ...setup, save, afterCooking };
}

describe('Schritt nutrition_setup im Testmodus (8.1, R2-S3, W21)', () => {
  it('Testmodus: nach „cooking“ folgt nutrition_setup, erst danach ist das Onboarding fertig', async () => {
    const { save, afterCooking } = await onboardedUntilCooking();
    expect(afterCooking.profile?.onboarding_step).toBe('nutrition_setup');
    expect(afterCooking.profile?.onboarding_completed_at).toBeNull();
    const done = await save({
      step: 'nutrition_setup',
      setup: { ...SETUP, mealprepSlots: 'lunch_dinner' },
    });
    expect(done.profile?.onboarding_completed_at).toBe(NOW);
    expect(done.nutritionSetup).toEqual({
      user_id: done.profile?.user_id,
      activity_level: 'light',
      training_time: 'evening',
      mealprep_slots: 'lunch_dinner',
      show_energy_numbers: true,
    });
    expect(answersFromRows(done).nutritionSetup).toEqual({
      activityLevel: 'light',
      trainingTime: 'evening',
      mealprepSlots: 'lunch_dinner',
      showEnergyNumbers: true,
    });
  });

  it('Supabase-Modus (nutritionSetupAvailable false): „cooking“ beendet das Onboarding, kein Schreibvorgang', () => {
    const rows = planPersonRows();
    const answers = {
      ...answersFromRows(rows),
      nutrition: { dietType: 'omnivore' as const, mealsPerDay: 3, foodPreferences: [] },
    };
    const base = {
      userId: USER_ID,
      answers,
      rows,
      versions: VERSIONS,
      platform: 'web' as const,
      now: NOW,
    };
    const supabase = planSave(
      { step: 'cooking', cooking: { cookingMode: 'daily' } },
      { ...base, nutritionSetupAvailable: false },
    );
    expect(supabase.next).toBeNull();
    expect(supabase.ops.some((op) => op.kind === 'upsert_nutrition_setup')).toBe(false);
    const testMode = planSave(
      { step: 'cooking', cooking: { cookingMode: 'daily' } },
      { ...base, nutritionSetupAvailable: true },
    );
    expect(testMode.next).toBe('nutrition_setup');
    expect(deriveOnboardingState(rows, VERSIONS, false).nutritionSetupAvailable).toBe(false);
    expect(deriveOnboardingState(rows, VERSIONS, true).nutritionSetupAvailable).toBe(true);
  });

  it('K5: Ändern nach dem Onboarding (Schalter „Kalorienzahlen“) setzt onboarding_completed_at nicht neu', async () => {
    const rows = nutritionRows();
    const completed = {
      ...rows,
      profile: {
        ...(rows.profile as NonNullable<UserRows['profile']>),
        onboarding_completed_at: '2026-09-01T08:00:00.000Z',
      },
    };
    const { backend } = seededBackend(completed);
    const next = await backend.saveStep(
      { step: 'nutrition_setup', setup: { ...SETUP, showEnergyNumbers: false } },
      { answers: answersFromRows(completed), rows: completed, versions: VERSIONS },
    );
    expect(next.nutritionSetup?.show_energy_numbers).toBe(false);
    expect(next.profile?.onboarding_completed_at).toBe('2026-09-01T08:00:00.000Z');
  });

  it('ungültige Werte (K7: Alltagsaktivität fehlt/unbekannt) werden wie in der Datenbank abgelehnt', async () => {
    const { backend } = await onboardedUntilCooking();
    const { rows } = await backend.loadRows();
    const bad = {
      step: 'nutrition_setup',
      setup: { ...SETUP, activityLevel: 'gemuetlich' },
    } as unknown as StepSave;
    await expect(
      backend.saveStep(bad, { answers: answersFromRows(rows), rows, versions: VERSIONS }),
    ).rejects.toBeDefined();
    expect((await backend.loadRows()).rows.nutritionSetup).toBeNull();
  });

  it('„Ernährung ändern“: nutrition → cooking → nutrition_setup → Ernährung; ohne Speicherort zurück zu „Heute“', () => {
    const save = { step: 'nutrition_setup', setup: SETUP } as const;
    expect(nextEditRoute('nutrition', save, true)).toBe('/onboarding/cooking?edit=1');
    expect(nextEditRoute('cooking', save, true)).toBe('/onboarding/nutrition_setup?edit=1');
    expect(nextEditRoute('nutrition_setup', save, true)).toBe('/ernaehrung');
    expect(nextEditRoute('cooking', save, false)).toBe('/today');
  });
});

describe('Widerruf mit Umwandlung (7.4, S17, W12, R2-K4)', () => {
  it('mit Zustimmung: Unverträglichkeiten werden „mag ich nicht“, „mag ich“ derselben Gruppe ersetzt – atomar', async () => {
    const { backend, store } = await onboardedUntilCooking();
    const before = (await backend.loadRows()).rows;
    expect(before.foodPreferences.filter((p) => p.kind === 'intolerance')).toHaveLength(2);
    await backend.revokeHealthData(false, { rows: before });
    const { rows } = await backend.loadRows();
    expect(rows.foodPreferences.some((p) => p.kind === 'intolerance')).toBe(false);
    expect(rows.foodPreferences.map((p) => `${p.food_group}:${p.kind}`).sort()).toEqual([
      'gluten:dislike',
      'mushrooms:dislike',
      'peanuts:dislike',
    ]);
    // Ein einziger Gerätespeicher-Stand: kein Zwischenstand ohne Ausschluss, keine „ausstehenden“ Daten.
    const stored = JSON.parse(store.dump()[STORAGE_KEYS.localDb] ?? '{}') as {
      rows: UserRows;
    };
    expect(Object.keys(stored)).not.toContain('pendingRevocationConversion');
    expect(stored.rows.foodPreferences).toEqual(rows.foodPreferences);
  });

  it('ohne Zustimmung: nichts eingelesen, nichts behalten – nur die bisherigen Abneigungen/Vorlieben bleiben', async () => {
    const { backend, store } = await onboardedUntilCooking();
    await backend.revokeHealthData(false, null);
    const { rows } = await backend.loadRows();
    expect(rows.foodPreferences.map((p) => `${p.food_group}:${p.kind}`).sort()).toEqual([
      'gluten:like',
      'mushrooms:dislike',
    ]);
    // Weder im Gerätespeicher noch irgendwo sonst bleibt eine Spur der Unverträglichkeiten.
    const dump = JSON.stringify(store.dump());
    expect(dump).not.toContain('intolerance');
    expect(dump).not.toContain('peanuts');
  });

  it('K3: ungültige Alt-Einträge im Gerätespeicher lassen den Widerruf nicht scheitern (werden verworfen)', async () => {
    const rows = nutritionRows({
      foodPreferences: [
        ...prefs(['peanuts', 'intolerance'], ['fish', 'like']),
        { user_id: USER_ID, food_group: 'erdbeeren', kind: 'like' },
      ],
    });
    const { backend } = seededBackend(rows);
    await backend.revokeHealthData(false, { rows });
    const after = (await backend.loadRows()).rows;
    expect(after.foodPreferences.map((p) => `${p.food_group}:${p.kind}`).sort()).toEqual([
      'fish:like',
      'peanuts:dislike',
    ]);
    const { backend: other } = seededBackend(rows);
    await other.revokeHealthData(true, null);
    expect(
      (await other.loadRows()).rows.foodPreferences.some((p) => p.kind === 'intolerance'),
    ).toBe(false);
  });

  it('applyHealthDataRevocation: Gruppen aus der Umwandlung, Schritt nutrition_setup bleibt (kein Gesundheitsdatum)', () => {
    const rows = nutritionRows({
      foodPreferences: prefs(['fish', 'like'], ['fish', 'intolerance'], ['soy', 'intolerance']),
    });
    const next = applyHealthDataRevocation(rows, { dislikeGroups: ['fish', 'soy'] });
    expect(next.foodPreferences).toEqual(prefs(['fish', 'dislike'], ['soy', 'dislike']));
    expect(next.nutritionSetup).toEqual(rows.nutritionSetup);
    expect(next.bodyMetrics).toEqual([]);
    expect(applyHealthDataRevocation(rows).foodPreferences).toEqual(prefs(['fish', 'like']));
  });
});

describe('Export und Gerätespeicher (Etappe N4)', () => {
  it('Export: Antworten von nutrition_setup als Spalten von nutrition_prefs (wie export_my_data ab N7)', () => {
    const rows = nutritionRows();
    const file = localDataExport(rows, USER_ID, NOW);
    expect(file.data.nutrition_prefs).toEqual([
      {
        ...rows.nutritionPrefs,
        activity_level: 'light',
        training_time: 'evening',
        mealprep_slots: 'lunch',
        show_energy_numbers: true,
      },
    ]);
  });

  it('Gerätespeicher: ungültiger oder fremder Eintrag nutrition_setup → null (Schritt wird erneut gefragt)', async () => {
    const valid = nutritionRows();
    const invalid = {
      ...valid,
      nutritionSetup: { ...valid.nutritionSetup, activity_level: 'gemuetlich' },
    } as unknown as UserRows;
    expect((await seededBackend(invalid).backend.loadRows()).rows.nutritionSetup).toBeNull();
    const foreign = {
      ...valid,
      nutritionSetup: { ...valid.nutritionSetup, user_id: 'jemand-anderes' },
    } as UserRows;
    expect((await seededBackend(foreign).backend.loadRows()).rows.nutritionSetup).toBeNull();
    const old = { ...valid } as Partial<UserRows>;
    delete old.nutritionSetup;
    expect(
      (await seededBackend(old as UserRows).backend.loadRows()).rows.nutritionSetup,
    ).toBeNull();
    expect((await seededBackend(valid).backend.loadRows()).rows.nutritionSetup).toEqual(
      valid.nutritionSetup,
    );
  });

  it('Bestand im Testmodus: ohne Rezepte im Bündel nur auf Wunsch Beispiel-Rezepte (gekennzeichnet)', async () => {
    const { backend } = seededBackend(nutritionRows());
    expect(backend.supportsNutrition).toBe(true);
    const plain = await backend.loadNutritionLibrary({ demo: false });
    expect(plain?.demo).toBe(false);
    if (plain?.demoAvailable) {
      expect(plain.library.recipes).toEqual([]);
      const demo = await backend.loadNutritionLibrary({ demo: true });
      expect(demo?.demo).toBe(true);
      expect(demo?.library.recipes.length).toBeGreaterThan(0);
      expect(demo?.library.recipes.every((r) => r.status === 'draft')).toBe(true);
    }
  });
});

describe('Zeilen → Ernährungs-Engine (nutrition-plan.ts)', () => {
  const weekStart = nutritionWeekStart(TODAY);

  it('unvollständig (kein Ziel bzw. keine Ernährungsform) → incomplete', () => {
    expect(
      nutritionInputsFromRows({ ...nutritionRows(), goals: null }, VERSIONS, TODAY, weekStart),
    ).toBeNull();
    expect(
      computeNutritionWeek({
        rows: { ...nutritionRows(), nutritionPrefs: null },
        versions: VERSIONS,
        today: TODAY,
        weekStart,
        library: null,
        allowDrafts: true,
      }),
    ).toEqual({ kind: 'incomplete' });
  });

  it('Alltag und Trainingszeit aus nutrition_setup (K7); ohne Einwilligung keine Körperdaten und keine Flags', () => {
    const inputs = nutritionInputsFromRows(nutritionRows(), VERSIONS, TODAY, weekStart);
    expect(inputs).toMatchObject({
      activityLevel: 'light',
      trainingTime: 'evening',
      mealsPerDay: 3,
    });
    expect(inputs?.bodyMetricsRows).toHaveLength(1);
    const noConsent = nutritionInputsFromRows(
      nutritionRows({}, 'none'),
      VERSIONS,
      TODAY,
      weekStart,
    );
    expect(noConsent).toMatchObject({
      healthDataConsent: false,
      bodyMetricsRows: [],
      healthFlags: null,
    });
  });

  it('K3: Messdatum morgen (Zeitzone) zählt als heute – sonst wäre das Gewicht für die Engine unsichtbar', () => {
    const rows = nutritionRows();
    const tomorrow = '2026-10-04';
    const inputs = nutritionInputsFromRows(
      {
        ...rows,
        bodyMetrics: [
          { ...(rows.bodyMetrics[0] as UserRows['bodyMetrics'][number]), measured_on: tomorrow },
        ],
      },
      VERSIONS,
      TODAY,
      weekStart,
    );
    expect(inputs?.bodyMetricsRows).toEqual([
      { measuredOn: TODAY, heightCm: 180, weightKg: 80, bodyFatPct: null },
    ]);
  });

  it('Unverträglichkeiten nur mit gültiger Einwilligung; Meal-Prep-Plätze aus nutrition_setup', () => {
    const foodPreferences = prefs(
      ['peanuts', 'intolerance'],
      ['mushrooms', 'dislike'],
      ['fish', 'like'],
    );
    expect(mealPlanProfileFromRows(nutritionRows({ foodPreferences }), VERSIONS)).toMatchObject({
      kind: 'ok',
      profile: {
        diet: 'vegetarian',
        intolerances: ['peanuts'],
        dislikes: ['mushrooms'],
        likes: ['fish'],
        mealprepSlots: 'lunch',
      },
    });
    // B1: gespeicherte Unverträglichkeit ohne gültige Einwilligung → gesperrt statt still ignoriert.
    expect(
      mealPlanProfileFromRows(nutritionRows({ foodPreferences }, 'outdated'), VERSIONS),
    ).toEqual({ kind: 'blocked', reason: 'consent_outdated' });
    expect(mealPlanProfileFromRows(nutritionRows({ foodPreferences }, 'none'), VERSIONS)).toEqual({
      kind: 'blocked',
      reason: 'consent_missing',
    });
    const withoutIntolerance = prefs(['mushrooms', 'dislike']);
    expect(
      mealPlanProfileFromRows(
        nutritionRows({ foodPreferences: withoutIntolerance }, 'none'),
        VERSIONS,
      ),
    ).toMatchObject({ kind: 'ok', profile: { intolerances: [] } });
  });

  it('Woche mit Beispiel-Bestand: Ziele + Plan, nie ein ausgeschlossenes Rezept (Pilze „mag ich nicht“, vegetarisch)', () => {
    const library = demoLibrary();
    const rows = nutritionRows({ foodPreferences: prefs(['mushrooms', 'dislike']) });
    const week = computeNutritionWeek({
      rows,
      versions: VERSIONS,
      today: TODAY,
      weekStart,
      library,
      allowDrafts: true,
    });
    expect(week.kind).toBe('ready');
    if (week.kind !== 'ready' || week.plan === null) throw new Error('Plan erwartet');
    for (const day of week.plan.days) {
      for (const meal of day.meals) {
        for (const ingredient of meal.ingredients) {
          const food = library.foods.get(ingredient.foodId);
          expect(food?.groups).not.toContain('mushrooms');
          expect(
            food?.animal.some((a) => ['meat', 'fish', 'shellfish', 'gelatin'].includes(a)),
          ).toBe(false);
        }
      }
    }
  });

  it('Rezeptansicht nur über den Filter der Person: unbekannt, passt nicht (ohne Grund), passt', () => {
    const library = demoLibrary();
    const rows = nutritionRows({ foodPreferences: prefs(['mushrooms', 'dislike']) });
    const week = computeNutritionWeek({
      rows,
      versions: VERSIONS,
      today: TODAY,
      weekStart,
      library,
      allowDrafts: true,
    });
    if (week.kind !== 'ready') throw new Error('Woche erwartet');
    const base = { library, rows, versions: VERSIONS, week, allowDrafts: true, from: null };
    expect(recipeForPerson({ ...base, recipeId: 'gibt-es-nicht' }).kind).toBe('not_found');
    expect(recipeForPerson({ ...base, recipeId: 'hack-spaghetti' }).kind).toBe('not_for_you');
    const meal = week.plan?.days[0]?.meals[0];
    if (!meal) throw new Error('Mahlzeit erwartet');
    const fromPlan = recipeForPerson({
      ...base,
      recipeId: meal.recipeId,
      from: { date: week.plan?.days[0]?.date ?? '', slot: meal.slot },
    });
    expect(fromPlan.kind).toBe('ok');
    if (fromPlan.kind === 'ok') expect(fromPlan.plannedMeal?.factor).toBe(meal.factor);
  });
});

describe('Rezeptansicht: nie ein ausgeschlossenes Rezept, auch per Deep-Link (Wächter N4 S2, B1)', () => {
  const weekStart = nutritionWeekStart(TODAY);
  const library = demoLibrary();

  function check(rows: UserRows, recipeId: string) {
    const week = computeNutritionWeek({
      rows,
      versions: VERSIONS,
      today: TODAY,
      weekStart,
      library,
      allowDrafts: true,
    });
    if (week.kind === 'blocked') return 'blocked';
    if (week.kind !== 'ready') throw new Error(`Woche: ${week.kind}`);
    return recipeForPerson({
      recipeId,
      library,
      rows,
      versions: VERSIONS,
      week,
      allowDrafts: true,
      from: null,
    }).kind;
  }

  const omnivore = (patch: Partial<UserRows> = {}, consent: 'valid' | 'outdated' = 'valid') => {
    const rows = nutritionRows(patch, consent);
    return {
      ...rows,
      nutritionPrefs: {
        ...(rows.nutritionPrefs as NonNullable<UserRows['nutritionPrefs']>),
        diet_type: 'omnivore' as const,
        eats_pork: null,
      },
    };
  };

  it('Unverträglichkeit (Erdnuss) schließt aus; ohne sie passt das Rezept', () => {
    expect(check(omnivore(), 'erdnuss-banane')).toBe('ok');
    expect(
      check(omnivore({ foodPreferences: prefs(['peanuts', 'intolerance']) }), 'erdnuss-banane'),
    ).toBe('not_for_you');
    expect(
      check(omnivore({ foodPreferences: prefs(['peanuts', 'intolerance']) }), 'tofu-erdnuss-curry'),
    ).toBe('not_for_you');
  });

  it('„mag ich nicht“ schließt hart aus (Pilze)', () => {
    expect(check(omnivore(), 'omelett-champignons')).toBe('ok');
    expect(
      check(omnivore({ foodPreferences: prefs(['mushrooms', 'dislike']) }), 'omelett-champignons'),
    ).toBe('not_for_you');
  });

  it('Schwein nur bei eats_pork = true (null bei Mischkost = nein, W10)', () => {
    expect(check(omnivore(), 'salami-brot')).toBe('not_for_you');
    const pork = omnivore();
    expect(
      check(
        {
          ...pork,
          nutritionPrefs: {
            ...(pork.nutritionPrefs as NonNullable<UserRows['nutritionPrefs']>),
            eats_pork: true,
          },
        },
        'salami-brot',
      ),
    ).toBe('ok');
  });

  it('Schwangerschaft per Deep-Link: ungegart bzw. nur angenommen erhitzt → ausgeschlossen', () => {
    const pregnant = omnivore({
      profile: { ...(nutritionRows().profile as NonNullable<UserRows['profile']>), sex: 'female' },
      healthScreenings: [
        {
          id: 'hs-p',
          user_id: USER_ID,
          answers: {},
          flags: ['pregnancy'],
          medical_notice_acknowledged_at: NOW,
          created_at: NOW,
        },
      ],
    });
    expect(check(pregnant, 'lachs-reis-annahme')).toBe('not_for_you');
    expect(check(pregnant, 'salami-brot')).toBe('not_for_you');
    expect(check(omnivore(), 'lachs-reis-annahme')).toBe('ok');
  });

  it('B1: veraltete Einwilligung + gespeicherte Erdnuss-Unverträglichkeit → weder Plan noch Rezept', () => {
    const rows = omnivore({ foodPreferences: prefs(['peanuts', 'intolerance']) }, 'outdated');
    expect(check(rows, 'erdnuss-banane')).toBe('blocked');
    const week = computeNutritionWeek({
      rows,
      versions: VERSIONS,
      today: TODAY,
      weekStart,
      library,
      allowDrafts: true,
    });
    expect(week).toEqual({ kind: 'blocked', reason: 'consent_outdated' });
  });
});

describe('Gespeicherte Unverträglichkeiten löschen (Recht auf Löschung, Wächter N4 NK2)', () => {
  it('Testmodus: geht ohne Einwilligung, danach ist die Sperre weg und der Plan berechenbar', async () => {
    const rows = nutritionRows(
      { foodPreferences: prefs(['peanuts', 'intolerance'], ['mushrooms', 'dislike']) },
      'none',
    );
    expect(mealPlanProfileFromRows(rows, VERSIONS)).toEqual({
      kind: 'blocked',
      reason: 'consent_missing',
    });
    const { backend, store } = seededBackend(rows);
    await backend.deleteStoredIntolerances();
    const after = (await backend.loadRows()).rows;
    expect(after.foodPreferences).toEqual(prefs(['mushrooms', 'dislike']));
    expect(mealPlanProfileFromRows(after, VERSIONS).kind).toBe('ok');
    expect(JSON.stringify(store.dump())).not.toContain('intolerance');
  });
});
