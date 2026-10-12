/**
 * Etappe N4 (docs/PLAN-PHASE-5.md 7.4, 8.1, 8.2, W12, R2-K4, K7, K11): reine Funktionen für die App – Umwandlung der
 * Unverträglichkeiten beim Widerruf, Antworten des Schritts `nutrition_setup`, Anzeige-Logik („nächste Mahlzeit“,
 * Kochtag, „Trainingstag ca. … kcal“, „Enthält: …“ inkl. Kokos) und der Beispiel-Bestand mit Testwerten.
 */
import { describe, expect, it } from 'vitest';

import { MEAL_SLOT_TIMES, NEXT_MEAL_GRACE_MINUTES } from '../constants';
import { makeFood } from '../content/nutrition-fixtures';
import { selectNutritionContent } from '../content/nutrition-select';
import { validateContent } from '../content/validate';
import { demoNutritionContent } from '../demo-nutrition';
import { nutritionStepSchema } from '../validation';
import {
  cookDayMeals,
  foodContainsCoconut,
  mealsInDayOrder,
  nextMealOfDay,
  recipeContains,
  weekEnergySummary,
} from './day-view';
import { buildMealPlanWeek, type PlannedMeal } from './meal-plan';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { type FoodPreferenceEntry, intoleranceGroupsForConversion } from './revocation';
import { tastePreferencesAfterConversion } from './revocation';
import {
  intoleranceAccess,
  measuredOnForEngine,
  weekExcludesPregnancyCaution,
  weekHidesEnergyNumbers,
} from './person';
import { nutritionSetupColumns, nutritionSetupStepSchema } from './schemas';
import { nutritionTargetsForWeek } from './targets';
import { inputs, MONDAY, session } from './test-helpers';

describe('Widerruf: Unverträglichkeiten → „mag ich nicht“ (7.4, W12, K9)', () => {
  const prefs: FoodPreferenceEntry[] = [
    { foodGroup: 'gluten', kind: 'intolerance' },
    { foodGroup: 'peanuts', kind: 'intolerance' },
    { foodGroup: 'peanuts', kind: 'like' },
    { foodGroup: 'mushrooms', kind: 'dislike' },
    { foodGroup: 'fish', kind: 'like' },
    { foodGroup: 'gluten', kind: 'dislike' },
  ];

  it('liest nur Gruppen-IDs der Unverträglichkeiten, eindeutig, Reihenfolge wie FOOD_GROUPS', () => {
    expect(
      intoleranceGroupsForConversion([
        { foodGroup: 'peanuts', kind: 'intolerance' },
        { foodGroup: 'gluten', kind: 'intolerance' },
        { foodGroup: 'gluten', kind: 'intolerance' },
        { foodGroup: 'fish', kind: 'like' },
      ]),
    ).toEqual(['gluten', 'peanuts']);
    expect(intoleranceGroupsForConversion([])).toEqual([]);
  });

  it('„mag ich“ derselben Gruppe wird ersetzt, „mag ich nicht“ bleibt einmal, andere Vorlieben bleiben', () => {
    const groups = intoleranceGroupsForConversion(prefs);
    const after = tastePreferencesAfterConversion(prefs, groups);
    expect(after).toEqual([
      { foodGroup: 'mushrooms', kind: 'dislike' },
      { foodGroup: 'fish', kind: 'like' },
      { foodGroup: 'gluten', kind: 'dislike' },
      { foodGroup: 'peanuts', kind: 'dislike' },
    ]);
    // Keine Unverträglichkeit mehr, kein „mag ich“ + „mag ich nicht“ derselben Gruppe (like_xor_dislike).
    expect(after.some((p) => p.kind === 'intolerance')).toBe(false);
    expect(
      nutritionStepSchema.safeParse({
        dietType: 'omnivore',
        mealsPerDay: 3,
        foodPreferences: after,
      }).success,
    ).toBe(true);
  });

  it('ohne Zustimmung (keine Gruppen): nur Unverträglichkeiten fallen weg, nichts kommt dazu (R2-K4)', () => {
    expect(tastePreferencesAfterConversion(prefs, [])).toEqual([
      { foodGroup: 'peanuts', kind: 'like' },
      { foodGroup: 'mushrooms', kind: 'dislike' },
      { foodGroup: 'fish', kind: 'like' },
      { foodGroup: 'gluten', kind: 'dislike' },
    ]);
  });

  it('unbekannte Gruppe wird abgelehnt (Zod an der Grenze)', () => {
    expect(() =>
      tastePreferencesAfterConversion(prefs, ['erdbeeren' as unknown as 'gluten']),
    ).toThrow();
  });
});

describe('Schritt nutrition_setup (8.1, K7)', () => {
  it('Alltagsaktivität ist Pflicht (keine stille Annahme 1,45)', () => {
    expect(
      nutritionSetupStepSchema.safeParse({ trainingTime: 'evening', showEnergyNumbers: true })
        .success,
    ).toBe(false);
    expect(
      nutritionSetupStepSchema.safeParse({
        activityLevel: 'light',
        trainingTime: 'varies',
        showEnergyNumbers: false,
      }).success,
    ).toBe(true);
  });

  it('Trainingszeit ist Pflicht (Antwort „unterschiedlich“ möglich), unbekannte Werte rot', () => {
    expect(
      nutritionSetupStepSchema.safeParse({ activityLevel: 'light', showEnergyNumbers: true })
        .success,
    ).toBe(false);
    expect(
      nutritionSetupStepSchema.safeParse({
        activityLevel: 'gemuetlich',
        trainingTime: 'evening',
        showEnergyNumbers: true,
      }).success,
    ).toBe(false);
  });

  it('Spalten wie in N7; ohne Meal-Prep Standard „Mittag“', () => {
    expect(
      nutritionSetupColumns({
        activityLevel: 'very_active',
        trainingTime: 'early',
        mealprepSlots: 'lunch_dinner',
        showEnergyNumbers: true,
      }),
    ).toEqual({
      activity_level: 'very_active',
      training_time: 'early',
      mealprep_slots: 'lunch_dinner',
      show_energy_numbers: true,
    });
    expect(
      nutritionSetupColumns({
        activityLevel: 'sedentary',
        trainingTime: 'morning',
        showEnergyNumbers: false,
      }).mealprep_slots,
    ).toBe('lunch');
  });
});

function meal(slot: PlannedMeal['slot'], extra: Partial<PlannedMeal> = {}): PlannedMeal {
  return {
    slot,
    role: null,
    recipeId: `r-${slot}`,
    recipeVersion: 1,
    titleDe: slot,
    recipeStatus: 'draft',
    factor: 1,
    ingredients: [],
    nutrients: {
      kcal: 0,
      protein_g: 0,
      carbs_g: 0,
      sugar_g: 0,
      fat_g: 0,
      sat_fat_g: 0,
      fiber_g: 0,
      salt_g: 0,
    },
    optionalKcal: 0,
    substitutions: [],
    omittedOptional: [],
    prepKind: 'fresh',
    cookDate: MONDAY,
    storage: null,
    isFill: false,
    fixed: false,
    mealPrepPlanId: null,
    ...extra,
  };
}

describe('Anzeige „Heute“ (8.2 Nr. 1)', () => {
  const day = {
    meals: [
      meal('dinner'),
      meal('extra_1', { isFill: true }),
      meal('breakfast'),
      meal('lunch', { prepKind: 'cook' }),
      meal('snack_afternoon'),
    ],
  };

  it('Mahlzeiten in zeitlicher Reihenfolge, Ergänzungen am Ende', () => {
    expect(mealsInDayOrder(day).map((m) => m.slot)).toEqual([
      'breakfast',
      'lunch',
      'snack_afternoon',
      'dinner',
      'extra_1',
    ]);
  });

  it('nächste Mahlzeit: bis NEXT_MEAL_GRACE_MINUTES nach der Uhrzeit noch „nächste“, danach die folgende', () => {
    expect(nextMealOfDay(day, 0)?.slot).toBe('breakfast');
    const lastMoment = MEAL_SLOT_TIMES.breakfast + NEXT_MEAL_GRACE_MINUTES - 1;
    expect(nextMealOfDay(day, lastMoment)?.slot).toBe('breakfast');
    expect(nextMealOfDay(day, lastMoment + 1)?.slot).toBe('lunch');
    expect(nextMealOfDay(day, MEAL_SLOT_TIMES.dinner + NEXT_MEAL_GRACE_MINUTES)?.slot).toBe(
      'extra_1',
    );
    expect(nextMealOfDay({ meals: [meal('breakfast'), meal('dinner')] }, 24 * 60)).toBeNull();
    expect(nextMealOfDay({ meals: [] }, 600)).toBeNull();
    expect(() => nextMealOfDay(day, -1)).toThrow();
    expect(() => nextMealOfDay(day, 1.5)).toThrow();
  });

  it('Kochtag: nur Mahlzeiten mit prepKind „cook“', () => {
    expect(cookDayMeals(day).map((m) => m.slot)).toEqual(['lunch']);
    expect(cookDayMeals({ meals: [meal('lunch', { prepKind: 'leftover' })] })).toEqual([]);
  });
});

describe('Kurz-Zusammenfassung der Woche („Fertig“, 8.1)', () => {
  it('Trainingstage höher als Ruhetage; Zahlen unverändert aus den Tageszielen', () => {
    const week = nutritionTargetsForWeek(
      inputs({
        sessions: [
          session(MONDAY, { minutes: 60 }),
          session('2026-10-14', { kind: 'endurance', enduranceModality: 'run', minutes: 90 }),
        ],
      }),
      MONDAY,
    );
    const summary = weekEnergySummary(week);
    expect(summary.hasDaysWithoutTargets).toBe(false);
    expect(summary.trainingDay).not.toBeNull();
    expect(summary.restDay).not.toBeNull();
    expect(summary.trainingDay?.min).toBeGreaterThan(summary.restDay?.max ?? Infinity);
    const targets = week.days.map((d) => d.targetKcal);
    expect(targets).toContain(summary.trainingDay?.max);
    expect(targets).toContain(summary.restDay?.min);
  });

  it('1 vs. 7 Trainingstage: ohne Ruhetag bzw. ohne Trainingstag → null', () => {
    const none = weekEnergySummary(nutritionTargetsForWeek(inputs(), MONDAY));
    expect(none.trainingDay).toBeNull();
    expect(none.restDay).not.toBeNull();
    const seven = weekEnergySummary(
      nutritionTargetsForWeek(
        inputs({
          sessions: Array.from({ length: 7 }, (_, i) =>
            session(`2026-10-${String(12 + i).padStart(2, '0')}`, { minutes: 45 }),
          ),
        }),
        MONDAY,
      ),
    );
    expect(seven.restDay).toBeNull();
    expect(seven.trainingDay).not.toBeNull();
  });

  it('ohne Zahlen (Schwangerschaft bzw. ohne Einwilligung): keine Werte', () => {
    const pregnant = weekEnergySummary(
      nutritionTargetsForWeek(
        inputs({ sex: 'female', healthFlags: { flags: ['pregnancy'] } }),
        MONDAY,
      ),
    );
    expect(pregnant).toEqual({ trainingDay: null, restDay: null, hasDaysWithoutTargets: true });
    const noConsent = weekEnergySummary(
      nutritionTargetsForWeek(inputs({ healthDataConsent: false }), MONDAY),
    );
    expect(noConsent.restDay).toBeNull();
  });
});

describe('„Enthält: …“ und Kokos (8.2 Nr. 4, K11)', () => {
  it('Kokos über Wortteile (Name, Alias, Quelle) – nicht über freie Teilzeichenketten', () => {
    expect(foodContainsCoconut(makeFood({ name_de: 'Kokosmilch' }))).toBe(true);
    expect(foodContainsCoconut(makeFood({ name_de: 'Kokosraspeln' }))).toBe(true);
    expect(foodContainsCoconut(makeFood({ name_de: 'Haferflocken' }))).toBe(false);
  });

  it('Gruppen aus den berechneten Angaben, Kokos aus den verwendeten Lebensmitteln', () => {
    const coconutMilk = N3_FOODS.get('kokosmilch');
    expect(coconutMilk).toBeDefined();
    const result = recipeContains({ allergens: ['gluten', 'peanuts'] }, [
      N3_FOODS.get('haferflocken') as NonNullable<typeof coconutMilk>,
      coconutMilk as NonNullable<typeof coconutMilk>,
    ]);
    expect(result).toEqual({ groups: ['gluten', 'peanuts'], coconut: true });
    // Kokos ist keine Schalenfrucht.
    expect(coconutMilk?.groups).not.toContain('tree_nuts');
  });
});

describe('Beispiel-Bestand mit Testwerten (@fitnessapp/core/demo-nutrition)', () => {
  it('ist über dieselben Regeln auswählbar: alle Lebensmittel, Rezepte ohne roten Befund, nur Entwürfe', () => {
    const demo = demoNutritionContent();
    const library = selectNutritionContent(
      validateContent(demo.files, { nutritionCatalog: demo.catalog }),
      { allowDrafts: true },
    );
    // Rote Befunde (z. B. absichtliche Grenzfälle der N3-Fixtures) fallen wie im echten Bestand heraus.
    expect(library.excluded.every((e) => e.kind === 'recipe' && e.reason === 'red_issue')).toBe(
      true,
    );
    expect(library.recipes.length + library.excluded.length).toBe(N3_RECIPES.length);
    expect(library.recipes.length).toBeGreaterThanOrEqual(15);
    expect(library.foods.size).toBe(N3_FOODS.size);
    expect(library.containsDrafts).toBe(true);
    expect(library.recipes.every((r) => r.status === 'draft')).toBe(true);
  });

  it('ohne Testmodus (allowDrafts: false) bleibt nichts übrig', () => {
    const demo = demoNutritionContent();
    const library = selectNutritionContent(
      validateContent(demo.files, { nutritionCatalog: demo.catalog }),
      { allowDrafts: false },
    );
    expect(library.recipes).toEqual([]);
    expect(library.foods.size).toBe(0);
  });

  it('liefert einen Essensplan mit 3 Mahlzeiten (Grundlage der E2E-Tests)', () => {
    const demo = demoNutritionContent();
    const library = selectNutritionContent(
      validateContent(demo.files, { nutritionCatalog: demo.catalog }),
      { allowDrafts: true },
    );
    const targets = nutritionTargetsForWeek(inputs({ mealsPerDay: 3 }), MONDAY);
    const plan = buildMealPlanWeek({
      targets,
      profile: { diet: 'vegetarian', dislikes: ['mushrooms'] },
      recipes: library.recipes,
      foods: library.foods,
      allowDrafts: true,
      today: MONDAY,
    });
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0]?.meals.length).toBeGreaterThanOrEqual(3);
    expect(plan.notices).toContain('drafts_used');
  });
});

describe('Regeln der Person (Wächter N4 S4/B1/K1/K3)', () => {
  it('K3: Messdatum nach heute zählt als heute, frühere bleiben', () => {
    expect(measuredOnForEngine('2026-10-13', '2026-10-12')).toBe('2026-10-12');
    expect(measuredOnForEngine('2026-10-01', '2026-10-12')).toBe('2026-10-01');
    expect(() => measuredOnForEngine('kein-datum', '2026-10-12')).toThrow();
  });

  it('B1: Unverträglichkeiten nur mit gültiger Einwilligung – gespeichert, aber nicht gültig → gesperrt', () => {
    expect(
      intoleranceAccess({ consent: 'valid', storedIntolerances: ['peanuts', 'gluten'] }),
    ).toEqual({ kind: 'ok', intolerances: ['gluten', 'peanuts'] });
    expect(intoleranceAccess({ consent: 'outdated', storedIntolerances: ['peanuts'] })).toEqual({
      kind: 'blocked',
      reason: 'consent_outdated',
    });
    // NK1/NK2: widerrufen bzw. nie erteilt → eigener Grund (Einwilligung erteilen oder löschen).
    expect(intoleranceAccess({ consent: 'none', storedIntolerances: ['peanuts'] })).toEqual({
      kind: 'blocked',
      reason: 'consent_missing',
    });
    expect(intoleranceAccess({ consent: 'outdated', storedIntolerances: [] })).toEqual({
      kind: 'ok',
      intolerances: [],
    });
    // Unbekannte Gruppe allein sperrt nicht und wird nie verwendet.
    expect(intoleranceAccess({ consent: 'valid', storedIntolerances: ['erdbeeren'] })).toEqual({
      kind: 'ok',
      intolerances: [],
    });
  });

  it('Schwangerschaft: Ausschluss und keine Zahlen für die ganze Woche, ohne Einwilligung Zahlen je Rezept sichtbar', () => {
    const pregnant = nutritionTargetsForWeek(
      inputs({ sex: 'female', healthFlags: { flags: ['pregnancy'] } }),
      MONDAY,
    );
    expect(weekExcludesPregnancyCaution(pregnant)).toBe(true);
    expect(weekHidesEnergyNumbers(pregnant)).toBe(true);
    const male = nutritionTargetsForWeek(inputs(), MONDAY);
    expect(weekExcludesPregnancyCaution(male)).toBe(false);
    expect(weekHidesEnergyNumbers(male)).toBe(false);
    const noConsent = nutritionTargetsForWeek(inputs({ healthDataConsent: false }), MONDAY);
    expect(weekHidesEnergyNumbers(noConsent)).toBe(false);
  });

  it('K3: Umwandlung verwirft ungültige Alt-Einträge statt abzubrechen', () => {
    const broken = [
      { foodGroup: 'erdbeeren', kind: 'like' },
      { foodGroup: 'fish', kind: 'intolerance' },
      { foodGroup: 'soy', kind: 'gemocht' },
    ] as unknown as FoodPreferenceEntry[];
    expect(intoleranceGroupsForConversion(broken)).toEqual(['fish']);
    expect(tastePreferencesAfterConversion(broken, ['fish'])).toEqual([
      { foodGroup: 'fish', kind: 'dislike' },
    ]);
  });
});
