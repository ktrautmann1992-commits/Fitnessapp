/**
 * Nährstoff-Timing 2 – Essen rund ums Training (docs/PLAN-NAEHRSTOFF-TIMING.md, Etappe T1).
 * Grenzfälle aus Abschnitt 9: 16/80 Jahre, sehr leicht/schwer, 1 vs. 7 Trainingstage, Ruhetag, zwei Einheiten,
 * frühes Training, ohne Uhrzeit, ohne Gewicht, unter 18, `no_targets`. Regression: Tagessummen unverändert, Pläne ohne
 * Uhrzeit gleich (Strukturtest + Schnappschuss).
 */
import { describe, expect, it } from 'vitest';

import { KCAL_PER_GRAM, MEAL_TIMING_RULES, NUTRIENT_TIMING } from '../constants';
import { addDays } from '../dates';
import {
  buildMealPlanWeek,
  dayWithinPlanBand,
  type MealPlanInput,
  type MealPlanWeek,
  swapMealRecipe,
} from './meal-plan';
import { ing, makeRecipe } from '../content/nutrition-fixtures';
import { N3_FOODS, N3_RECIPES } from './meal-plan-fixtures';
import { toMealPlanPayload } from './meal-plan-payload';
import { parseMealPlanRecord } from './meal-plan-record';
import { parseStoredMealPlanWeek, resolveMealPlanWeek } from './meal-plan-store';
import { needsAutomaticReplan } from './replan';
import type { NutritionSessionInput } from './schemas';
import type { ShoppingListItem } from './shopping-list';
import { nutritionTargetsForWeek, type NutritionWeekTargets } from './targets';
import { inputs, MONDAY, run, seededRandom, session } from './test-helpers';
import { mealRolesForWindows, mealSlotLayout, mealSlotsForDay, trainingWindows } from './timing';
import {
  preMealCarbsGuideG,
  preWorkoutIssues,
  proteinPerMealGuideG,
  slotMacroTargets,
} from './training-meal-targets';
import {
  adaptMealPlanToTraining,
  mealFitsRole,
  resolveMealPlanWeekWithTraining,
  shoppingListChanged,
  shoppingListChanges,
  trainingRoleMismatchDays,
  undoTrainingAdaptation,
} from './training-replan';
import {
  bestPreWorkoutSnack,
  bestProteinSide,
  preTrainingReminderMinutes,
  timingGramsAllowed,
  timingSnackCandidates,
  trainingDayTimeline,
  trainingTimingNotice,
} from './training-timeline';

const SUNDAY_BEFORE = '2026-10-11';
const EPS = 1e-6;
const PROFILE = { diet: 'omnivore' } as const;

function week(overrides: Parameters<typeof inputs>[0] = {}): NutritionWeekTargets {
  return nutritionTargetsForWeek(
    inputs({ today: SUNDAY_BEFORE, mealsPerDay: 4, trainingTime: 'afternoon', ...overrides }),
    MONDAY,
  );
}

function engineInput(
  targets: NutritionWeekTargets,
  extra: Partial<MealPlanInput> = {},
): Omit<MealPlanInput, 'existingPlan' | 'variant'> {
  return {
    targets,
    profile: PROFILE,
    recipes: N3_RECIPES,
    foods: N3_FOODS,
    allowDrafts: true,
    today: SUNDAY_BEFORE,
    ...extra,
  };
}

const timed = (s: NutritionSessionInput, startMinutes: number): NutritionSessionInput => ({
  ...s,
  startMinutes,
});

/** Felder, die sich durch das Timing NIE ändern dürfen (Tagesenergie, Makro-Summen, Schutzgrenzen). */
function daySums(t: NutritionWeekTargets) {
  return t.days.map((d) => ({
    date: d.date,
    mode: d.mode,
    targetKcal: d.targetKcal,
    band: d.band,
    floorKcal: d.floorKcal,
    ceilingKcal: d.ceilingKcal,
    bmrKcal: d.bmrKcal,
    tdeeKcal: d.tdeeKcal,
    trainingKcal: d.trainingKcal,
    proteinG: d.proteinG,
    carbsG: d.carbsG,
    fatG: d.fatG,
    appliedCaps: d.appliedCaps,
    deficitCap: d.deficitCap,
    surplusCap: d.surplusCap,
  }));
}

describe('Zeitfenster und Rollen (Plan 2, 3, 6)', () => {
  it('eigene Uhrzeit: Mahlzeit 2–4 h vorher, Snack 30–60 min vorher, Mahlzeit bis 2 h danach', () => {
    const slots = mealSlotLayout(4); // Frühstück 7:30, Mittag 12:30, Snack 15:30, Abend 18:30
    const windows = trainingWindows(
      [{ kind: 'strength', minutes: 60, startMinutes: 16 * 60 }],
      null,
    );
    expect(windows).toEqual([
      { sessionId: null, kind: 'strength', minutes: 60, start: 960, end: 1020, approx: false },
    ]);
    expect(mealRolesForWindows(slots, windows)).toEqual([null, 'pre', 'pre_snack', 'post']);
  });

  it('ohne eigene Uhrzeit: Standard aus „Trainingszeit“, sonst 17:30 – immer „ca.“', () => {
    expect(trainingWindows([{ kind: 'strength', minutes: 60 }], 'morning')[0]).toMatchObject({
      start: 570,
      approx: true,
    });
    for (const time of [null, 'varies'] as const) {
      expect(trainingWindows([{ kind: 'strength', minutes: 60 }], time)[0]?.start).toBe(
        NUTRIENT_TIMING.defaultStartMinutes,
      );
    }
  });

  it('zwei Einheiten: zwei Fenster, dazwischen die Auffüll-Mahlzeit (nach dem Training)', () => {
    const slots = mealSlotLayout(5); // 7:30, 10:00, 12:30, 15:30, 18:30
    const windows = trainingWindows(
      [
        { kind: 'endurance', minutes: 60, startMinutes: 8 * 60 + 30 },
        { kind: 'strength', minutes: 60, startMinutes: 16 * 60 + 30 },
      ],
      null,
    );
    const roles = mealRolesForWindows(slots, windows);
    expect(roles).toEqual([null, 'post', 'pre', 'pre_snack', 'post']);
    // Zwei Einheiten ohne eigene Uhrzeit überschneiden sich nie (die zweite beginnt nach der ersten).
    const both = trainingWindows(
      [
        { kind: 'strength', minutes: 60 },
        { kind: 'endurance', minutes: 45 },
      ],
      'evening',
    );
    expect(both.map((w) => [w.start, w.end])).toEqual([
      [1050, 1110],
      [1110, 1155],
    ]);
  });

  it('frühes Training (6:00): kein Frühstück vorher, Frühstück danach; Hinweis early_training', () => {
    const day = mealSlotsForDay({
      mealsPerDay: 4,
      trainingTime: null,
      sessions: [{ kind: 'strength', minutes: 60, startMinutes: 360 }],
    });
    expect(day.slots.map((s) => s.role)).toEqual(['post', null, null, null]);
    expect(day.notices).toContain('early_training');
    expect(day.slots.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
  });

  it('Anteile verschoben (je +5 Punkte vor/nach), Summe bleibt 1', () => {
    const day = mealSlotsForDay({
      mealsPerDay: 4,
      trainingTime: null,
      sessions: [{ kind: 'strength', minutes: 60, startMinutes: 960 }],
    });
    const base = mealSlotLayout(4);
    expect(day.slots[1]?.share).toBeCloseTo(
      (base[1]?.share ?? 0) + MEAL_TIMING_RULES.roleShareBonus,
      9,
    );
    expect(day.slots.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
  });

  it('Altbestand: ohne eigene Uhrzeit genau wie bisher (null und fehlend gleich)', () => {
    for (const trainingTime of [
      'early',
      'morning',
      'midday',
      'afternoon',
      'evening',
      'varies',
      null,
    ] as const) {
      for (const meals of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const a = mealSlotsForDay({
          mealsPerDay: meals,
          trainingTime,
          sessions: [{ kind: 'endurance', minutes: 95 }],
        });
        const b = mealSlotsForDay({
          mealsPerDay: meals,
          trainingTime,
          sessions: [{ kind: 'endurance', minutes: 95, startMinutes: null }],
        });
        expect(b).toEqual(a);
      }
    }
  });
});

describe('Makro-Anteile je Mahlzeit (Plan 1–4)', () => {
  const slots = mealSlotsForDay({
    mealsPerDay: 4,
    trainingTime: null,
    sessions: [{ kind: 'strength', minutes: 60, startMinutes: 960 }],
  }).slots;
  const base = {
    slots,
    targetKcal: 2600,
    proteinG: 140,
    carbsG: 330,
    fatG: 75,
    referenceWeightKg: 80,
    weightKg: 80,
    ageYears: 35,
    windows: trainingWindows([{ kind: 'strength', minutes: 60, startMinutes: 960 }], null),
  };

  it('Summen = Tageswerte (Energie unverändert), KH wandern zu vor/nach, Fett zu den übrigen', () => {
    const t = slotMacroTargets(base);
    const sum = (key: 'kcal' | 'proteinG' | 'carbsG' | 'fatG') => t.reduce((s, x) => s + x[key], 0);
    expect(sum('kcal')).toBeCloseTo(2600, 6);
    expect(sum('proteinG')).toBeCloseTo(140, 6);
    expect(sum('carbsG')).toBeCloseTo(330, 6);
    expect(sum('fatG')).toBeCloseTo(75, 6);
    const share = (i: number) => (slots[i]?.share ?? 0) * 330;
    expect(t[1]?.carbsG).toBeGreaterThan(share(1)); // vor dem Training (Mittag)
    expect(t[3]?.carbsG).toBeGreaterThan(share(3)); // nach dem Training (Abend)
    expect(t[0]?.carbsG).toBeLessThan(share(0)); // Frühstück ohne Rolle
    expect(t[0]?.proteinGuideG).toBeCloseTo(32, 6); // 0,4 g/kg × 80 kg
    expect(t[2]?.proteinGuideG).toBeNull(); // Snack ohne „nach dem Training“
    expect(t[1]?.carbsGuideG).toBeCloseTo(preMealCarbsGuideG(80, 960 - 750), 6);
    expect(t[2]?.carbsGuideG).toBe(NUTRIENT_TIMING.preSnackCarbsG.min);
  });

  it('Ruhetag: alles nach Energieanteil (gleichmäßig)', () => {
    const rest = mealSlotLayout(4);
    const t = slotMacroTargets({ ...base, slots: rest, windows: [] });
    rest.forEach((s, i) => expect(t[i]?.carbsG).toBeCloseTo(s.share * 330, 6));
  });

  it('ab 65 mindestens 25 g, sehr leicht/schwer, Tagesmenge reicht nicht → Richtwerte anteilig', () => {
    expect(proteinPerMealGuideG(50, 80)).toBe(25);
    expect(proteinPerMealGuideG(50, 64)).toBeCloseTo(20, 9);
    expect(proteinPerMealGuideG(150, 80)).toBeCloseTo(60, 9);
    const light = slotMacroTargets({ ...base, referenceWeightKg: 40, weightKg: 40, proteinG: 50 });
    expect(light.reduce((s, x) => s + x.proteinG, 0)).toBeCloseTo(50, 6);
    const short = slotMacroTargets({ ...base, proteinG: 60 }); // 3 × 32 g > 60 g
    expect(short.reduce((s, x) => s + x.proteinG, 0)).toBeCloseTo(60, 6);
    expect(short.every((x) => x.proteinG >= 0 && x.carbsG >= 0 && x.fatG >= 0)).toBe(true);
    const heavy = slotMacroTargets({ ...base, referenceWeightKg: 92, weightKg: 150, carbsG: 500 });
    expect(heavy.reduce((s, x) => s + x.carbsG, 0)).toBeCloseTo(500, 6);
  });

  it('Auffüllen bei zwei Einheiten: 1 g/kg KH nach der ersten (soweit die übrigen abgeben)', () => {
    const two = mealSlotsForDay({
      mealsPerDay: 5,
      trainingTime: null,
      sessions: [
        { kind: 'endurance', minutes: 60, startMinutes: 510 },
        { kind: 'strength', minutes: 60, startMinutes: 990 },
      ],
    }).slots;
    const t = slotMacroTargets({
      ...base,
      slots: two,
      windows: trainingWindows(
        [
          { kind: 'endurance', minutes: 60, startMinutes: 510 },
          { kind: 'strength', minutes: 60, startMinutes: 990 },
        ],
        null,
      ),
    });
    expect(t[1]?.role).toBe('post');
    expect(t[1]?.carbsGuideG).toBe(80);
    expect(t.reduce((s, x) => s + x.carbsG, 0)).toBeCloseTo(330, 6);
  });

  it('Verträglichkeit vor dem Training nach Nährwerten (nicht verboten, nur Befund)', () => {
    expect(preWorkoutIssues('pre', { kcal: 600, fat_g: 25, fiber_g: 4 })).toEqual(['fat']);
    expect(preWorkoutIssues('pre_snack', { kcal: 300, fat_g: 2, fiber_g: null })).toEqual(['kcal']);
    expect(preWorkoutIssues('post', { kcal: 900, fat_g: 60, fiber_g: 20 })).toEqual([]);
    expect(KCAL_PER_GRAM.fat).toBe(9);
  });
});

describe('Tagesziele: Energie und Schutzgrenzen unverändert (Strukturtest)', () => {
  const cases: {
    name: string;
    overrides: Parameters<typeof inputs>[0];
  }[] = [
    { name: 'Erwachsen 80 kg', overrides: {} },
    { name: '16 Jahre', overrides: { birthDate: '2010-01-01' } },
    { name: '80 Jahre', overrides: { birthDate: '1946-01-01' } },
    {
      name: 'sehr leicht',
      overrides: { bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 160, weightKg: 42 }] },
    },
    {
      name: 'sehr schwer',
      overrides: { bodyMetricsRows: [{ measuredOn: '2026-10-01', heightCm: 175, weightKg: 160 }] },
    },
    { name: 'ohne Einwilligung (kein Gewicht)', overrides: { healthDataConsent: false } },
    {
      name: 'Schwangerschaft (no_targets)',
      overrides: { sex: 'female', healthFlags: { flags: ['pregnancy'] } },
    },
    { name: 'Abnehmen', overrides: { goalType: 'fat_loss' } },
  ];

  for (const c of cases) {
    it(
      `${c.name}: 1 vs. 7 Trainingstage, mit/ohne Uhrzeit, gleiche Tagessummen`,
      { timeout: 30_000 },
      () => {
        for (const days of [1, 7]) {
          const plain = Array.from({ length: days }, (_, i) =>
            i % 2 === 0 ? session(addDays(MONDAY, i)) : run(addDays(MONDAY, i), 100),
          );
          const withTime = plain.map((s, i) => timed(s, [360, 960, 1110, 720][i % 4] as number));
          const a = week({ ...c.overrides, sessions: plain });
          const b = week({ ...c.overrides, sessions: withTime });
          expect(daySums(b)).toEqual(daySums(a));
          expect(a.days.every((d) => d.trainingTiming === undefined)).toBe(true);
          b.days.slice(0, days).forEach((d) => {
            expect(d.trainingTiming).toBeDefined();
            const targets = d.trainingTiming?.mealTargets ?? null;
            if (targets === null) return;
            expect(d.ageYears).toBeGreaterThanOrEqual(18);
            expect(targets.reduce((s, x) => s + x.kcal, 0)).toBeCloseTo(d.targetKcal ?? 0, 6);
            expect(targets.reduce((s, x) => s + x.proteinG, 0)).toBeCloseTo(d.proteinG ?? 0, 6);
            expect(targets.reduce((s, x) => s + x.carbsG, 0)).toBeCloseTo(d.carbsG ?? 0, 6);
            expect(targets.reduce((s, x) => s + x.fatG, 0)).toBeCloseTo(d.fatG ?? 0, 6);
          });
        }
      },
    );
  }

  it('keine Gramm je Mahlzeit: unter 18, no_targets, ohne Körpergewicht', () => {
    const s = [timed(session(MONDAY), 960)];
    expect(
      week({ birthDate: '2010-01-01', sessions: s }).days[0]?.trainingTiming?.mealTargets,
    ).toBeNull();
    expect(
      week({ sex: 'female', healthFlags: { flags: ['pregnancy'] }, sessions: s }).days[0]
        ?.trainingTiming?.mealTargets,
    ).toBeNull();
    expect(
      week({ healthDataConsent: false, sessions: s }).days[0]?.trainingTiming?.mealTargets,
    ).toBeNull();
    expect(week({ sessions: s }).days[0]?.trainingTiming?.mealTargets).not.toBeNull();
  });

  it('Eigenschaftstest: 200 zufällige Fälle – Tagessummen identisch', { timeout: 60_000 }, () => {
    const rnd = seededRandom(20261027);
    for (let i = 0; i < 200; i += 1) {
      const weight = 40 + Math.floor(rnd() * 120);
      const age = 16 + Math.floor(rnd() * 70);
      const days = 1 + Math.floor(rnd() * 7);
      const plain = Array.from({ length: days }, (_, d) =>
        rnd() < 0.5
          ? session(addDays(MONDAY, d))
          : run(addDays(MONDAY, d), 20 + Math.floor(rnd() * 160)),
      );
      const withTime = plain.map((s) => timed(s, Math.floor(rnd() * 1440)));
      const overrides = {
        birthDate: `${2026 - age}-03-01`,
        mealsPerDay: 1 + Math.floor(rnd() * 8),
        bodyMetricsRows: [
          { measuredOn: '2026-10-01', heightCm: 150 + Math.floor(rnd() * 50), weightKg: weight },
        ],
      };
      expect(daySums(week({ ...overrides, sessions: withTime })), `Fall ${i}`).toEqual(
        daySums(week({ ...overrides, sessions: plain })),
      );
    }
  });
});

describe('Essensplan: Altbestand unverändert, mit Uhrzeit im Band', () => {
  const sessions = [session(MONDAY), run(addDays(MONDAY, 2), 100), session(addDays(MONDAY, 4))];

  it('ohne Uhrzeit: Plan byte-gleich (Schnappschuss) – und gleich mit startMinutes: null', () => {
    const a = buildMealPlanWeek({ ...engineInput(week({ sessions })), variant: 0 });
    const b = buildMealPlanWeek({
      ...engineInput(week({ sessions: sessions.map((s) => ({ ...s, startMinutes: null })) })),
      variant: 0,
    });
    expect(b).toEqual(a);
    expect(
      a.days.map((d) => ({
        date: d.date,
        status: d.status,
        meals: d.meals.map((m) => `${m.slot}:${m.role ?? '-'}:${m.recipeId}:${m.factor}`),
      })),
    ).toMatchSnapshot();
  });

  it('mit Uhrzeit: jeder Tag im Planband (gleiche Garantie wie immer), Rollen passend', () => {
    for (const start of [360, 960, 1110]) {
      const targets = week({ sessions: sessions.map((s) => timed(s, start)) });
      const plan = buildMealPlanWeek({ ...engineInput(targets), variant: 0 });
      plan.days.forEach((day, i) => {
        expect(dayWithinPlanBand(day, targets.days[i]?.band ?? null), day.date).toBe(true);
        const slots = targets.days[i]?.slots ?? [];
        day.meals
          .filter((m) => !m.isFill)
          .forEach((m) => expect(m.role).toBe(slots.find((s) => s.slot === m.slot)?.role ?? null));
      });
      expect(needsAutomaticReplan(plan, engineInput(targets)).needed).toBe(false);
    }
  });
});

describe('Verschieben: Mahlzeiten wandern mit (Plan 6)', () => {
  const monday = timed(session(MONDAY), 960);
  const before = week({ sessions: [monday] });
  const plan = buildMealPlanWeek({ ...engineInput(before), variant: 0 });
  const moved = week({ sessions: [{ ...monday, scheduledOn: addDays(MONDAY, 2) }] });
  // Leichte Gerichte für vor dem Training kommen erst NACH dem Speichern in den Bestand – so ist sicher, dass das
  // gespeicherte Mittagessen am Mittwoch nicht schon passt (Testwerte).
  const light = (id: string, grams: number) =>
    makeRecipe({
      id,
      title_de: `Reis mit Hähnchen leicht ${grams}`,
      description_de: 'Reis mit Hähnchenbrust und Paprika, ohne Öl – leicht vor dem Training.',
      meal_types: ['main'],
      training_tags: ['vor_training'],
      categories: ['pre-workout'],
      ingredients: [
        ing('reis', grams, 'g'),
        ing('haehnchenbrust', 120, 'g', { heated: true }),
        ing('paprika', 1, 'piece'),
        ing('salz', 1, 'pinch', { scales: false }),
      ],
      steps_de: ['Reis kochen.', 'Hähnchen und Paprika ohne Öl garen, mit Reis servieren.'],
      prep_minutes: 10,
      cook_minutes: 20,
      meal_prep: { suitable: false, fridge_days: 0, freezable: false },
      equipment_de: ['Topf', 'Pfanne'],
      declared_diet: 'omnivore',
      declared_allergens: ['poultry'],
    });
  const LIGHT = [light('reis-haehnchen-leicht-a', 100), light('reis-haehnchen-leicht-b', 110)];
  const movedInput = engineInput(moved, { recipes: [...N3_RECIPES, ...LIGHT] });

  it('alter Tag Ruhetag, neuer Tag Trainingstag – nur diese Tage, im Band, Gründe training_changed', () => {
    expect(trainingRoleMismatchDays(plan, moved.days, SUNDAY_BEFORE)).toEqual([
      MONDAY,
      addDays(MONDAY, 2),
    ]);
    const result = adaptMealPlanToTraining(plan, movedInput);
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.dates).toEqual([MONDAY, addDays(MONDAY, 2)]);
    result.plan.days.forEach((day, i) => {
      expect(dayWithinPlanBand(day, moved.days[i]?.band ?? null)).toBe(true);
      if (![MONDAY, addDays(MONDAY, 2)].includes(day.date)) expect(day).toEqual(plan.days[i]);
    });
    expect(result.plan.days[0]?.meals.every((m) => m.role === null)).toBe(true);
    expect(result.plan.days[2]?.meals.some((m) => m.role === 'pre')).toBe(true);
    // Das unpassende Mittagessen (vor dem Training) wurde gegen ein leichtes Gericht getauscht.
    expect(result.changes).toContainEqual(
      expect.objectContaining({ date: addDays(MONDAY, 2), slot: 'lunch', role: 'pre' }),
    );
    const lunch = result.plan.days[2]?.meals.find((m) => m.slot === 'lunch');
    expect(LIGHT.map((r) => r.id)).toContain(lunch?.recipeId);
    if (lunch !== undefined) expect(mealFitsRole('pre', lunch.nutrients, null)).toBe(true);
    expect(lunch?.chosen).toBeUndefined();
    const resolved = resolveMealPlanWeekWithTraining(plan, movedInput);
    expect(resolved.action).toBe('replanned');
    if (resolved.action === 'replanned') expect(resolved.reasons).toEqual(['training_changed']);
    expect(resolved.training?.dates).toEqual(result.dates);
  });

  it('gegessene Mahlzeit: Rezept und Portion bleiben genau', () => {
    const wednesday = plan.days[2];
    const meal = wednesday?.meals.find((m) => m.slot === 'lunch');
    expect(meal).toBeDefined();
    if (wednesday === undefined || meal === undefined) return;
    const result = adaptMealPlanToTraining(plan, movedInput, {
      eaten: new Set([`${wednesday.date}|${meal.slot}`]),
    });
    const after = result?.plan.days[2]?.meals.find((m) => m.slot === meal.slot);
    expect(after?.recipeId).toBe(meal.recipeId);
    expect(after?.factor).toBe(meal.factor);
    expect(result?.changes.some((c) => c.date === wednesday.date && c.slot === meal.slot)).toBe(
      false,
    );
  });

  it('selbst gewählt bleibt (nur Vorschlag), Rückgängig holt die vorigen Gerichte als selbst gewählt zurück', () => {
    const chosenPlan: MealPlanWeek = {
      ...plan,
      days: plan.days.map((d, i) =>
        i === 2
          ? { ...d, meals: d.meals.map((m) => (m.isFill ? m : { ...m, chosen: true as const })) }
          : d,
      ),
    };
    const result = adaptMealPlanToTraining(chosenPlan, movedInput);
    expect(result?.changes.filter((c) => c.date === addDays(MONDAY, 2))).toEqual([]);
    expect(result?.suggestions).toContainEqual(
      expect.objectContaining({ date: addDays(MONDAY, 2), slot: 'lunch', role: 'pre' }),
    );
    // Rückgängig nach einer Anpassung mit Tausch.
    const swapped = adaptMealPlanToTraining(plan, movedInput);
    expect(swapped?.changes.length).toBeGreaterThan(0);
    if (swapped === null) return;
    const undone = undoTrainingAdaptation(plan, swapped, movedInput);
    expect(undone).not.toBeNull();
    for (const c of swapped.changes) {
      const meal = undone?.days
        .find((d) => d.date === c.date)
        ?.meals.find((m) => m.slot === c.slot);
      expect(meal?.recipeId).toBe(c.fromRecipeId);
      expect(meal?.chosen).toBe(true);
    }
  });

  it('„Rezept tauschen“ markiert selbst gewählt; gespeichert und wieder gelesen (Gerät und Server)', () => {
    // Erster Platz am Montag, für den es eine Alternative gibt.
    const slots = ['breakfast', 'lunch', 'snack_afternoon', 'dinner'] as const;
    const tries = slots.map((slot) => ({
      slot,
      swap: swapMealRecipe(plan, { date: MONDAY, slot }, engineInput(before)),
    }));
    const hit = tries.find((x) => x.swap.ok);
    expect(hit).toBeDefined();
    if (hit === undefined || !hit.swap.ok) return;
    const swap = hit.swap;
    const swappedSlot = hit.slot;
    const lunch = swap.plan.days[0]?.meals.find((m) => m.slot === swappedSlot);
    expect(lunch?.chosen).toBe(true);
    expect(parseStoredMealPlanWeek(JSON.parse(JSON.stringify(swap.plan)))).toEqual(swap.plan);
    const payload = toMealPlanPayload(swap.plan, {
      diet: 'omnivore',
      meals_per_day: 4,
      cooking_mode: 'daily',
      mealprep_days: null,
      mealprep_slots: 'lunch',
    });
    const item = payload.items.find((x) => x.date === MONDAY && x.slot === swappedSlot);
    expect(item?.user_chosen).toBe(true);
    expect(payload.items.filter((x) => 'user_chosen' in x)).toHaveLength(1);
    const record = parseMealPlanRecord({ usesHealthData: true, payload });
    expect(record).not.toBeNull();
    // Ohne selbst gewählte Gerichte: Payload ohne das Feld (byte-gleich wie vorher).
    const plain = toMealPlanPayload(plan, payload.inputs);
    expect(plain.items.some((x) => 'user_chosen' in x)).toBe(false);
  });

  it('ohne Rollen-Änderung (ohne Uhrzeit, ohne Trainingszeit) gilt resolveMealPlanWeek wie bisher', () => {
    const noTime = week({ trainingTime: null, sessions: [session(MONDAY)] });
    const stored = buildMealPlanWeek({ ...engineInput(noTime), variant: 0 });
    const movedNoTime = week({ trainingTime: null, sessions: [session(addDays(MONDAY, 2))] });
    expect(adaptMealPlanToTraining(stored, engineInput(movedNoTime))).toBeNull();
    const a = resolveMealPlanWeekWithTraining(stored, engineInput(movedNoTime));
    const b = resolveMealPlanWeek(stored, engineInput(movedNoTime));
    expect({ ...a, training: undefined }).toEqual({ ...b, training: undefined });
    expect(a.training).toBeNull();
  });

  it('mealFitsRole: nach dem Training höchstens 15 % unter dem Eiweiß-Richtwert', () => {
    const target = {
      slot: 'dinner' as const,
      role: 'post' as const,
      kcal: 800,
      proteinG: 40,
      carbsG: 80,
      fatG: 25,
      proteinGuideG: 32,
      carbsGuideG: null,
    };
    const n = {
      kcal: 700,
      protein_g: 27.3,
      carbs_g: 80,
      fat_g: 20,
      sugar_g: null,
      sat_fat_g: null,
      fiber_g: null,
      salt_g: 1,
    };
    expect(mealFitsRole('post', n, target)).toBe(true);
    expect(mealFitsRole('post', { ...n, protein_g: 27 }, target)).toBe(false);
    expect(mealFitsRole('post', { ...n, protein_g: 5 }, null)).toBe(true);
    expect(mealFitsRole(null, { ...n, fat_g: 90 }, null)).toBe(true);
  });
});

describe('Zeitleiste „Essen rund ums Training“ (Plan 7)', () => {
  const body = { weightKg: 80, heightCm: 180 };
  const options = {
    trainingTime: 'afternoon' as const,
    body,
    showNumbers: true,
    experienceLevel: 'beginner' as const,
  };
  const targets = week({ sessions: [timed(session(MONDAY), 960), run(addDays(MONDAY, 2), 120)] });
  const plan = buildMealPlanWeek({ ...engineInput(targets), variant: 0 });
  const snacks = timingSnackCandidates(engineInput(targets), targets.days[0] as never);

  it('Ruhetag: keine Zeitleiste', () => {
    expect(trainingDayTimeline(targets.days[1] as never, plan.days[1] ?? null, options)).toBeNull();
  });

  it('Trainingstag mit Uhrzeit: echte Gerichte mit Portion, Werte, Begründung', () => {
    const t = trainingDayTimeline(targets.days[0] as never, plan.days[0] ?? null, options, snacks);
    expect(t?.approx).toBe(false);
    expect(t?.grams).toBe(true);
    expect(t?.entries.map((e) => e.kind)).toEqual([
      'pre_meal',
      'pre_snack',
      'session',
      'post_meal',
    ]);
    const pre = t?.entries[0];
    expect(pre?.fromMinutes).toBe(960 - 240);
    expect(pre?.toMinutes).toBe(960 - 120);
    expect(pre?.meal?.titleDe.length).toBeGreaterThan(0);
    expect(pre?.meal?.values?.kcal).toBeGreaterThan(0);
    expect(t?.entries[3]?.fromMinutes).toBe(1020);
    expect(t?.entries[3]?.toMinutes).toBe(1020 + 120);
    expect(preTrainingReminderMinutes(t ?? null)).toBe(960 - 60 - 60);
  });

  it('ohne Uhrzeit: „ca.“; lange Einheit: Richtwert unterwegs und Trinken', () => {
    const t = trainingDayTimeline(targets.days[2] as never, plan.days[2] ?? null, options, snacks);
    expect(t?.approx).toBe(true);
    const s = t?.entries.find((e) => e.kind === 'session');
    expect(s?.reason).toBe('session_long');
    expect(s?.session?.fueling?.carbsGPerHour).toEqual({ min: 0, max: 30 });
    expect(s?.session?.fueling?.drinkMlPerHour).toEqual({ min: 400, max: 800 });
  });

  it('keine Gramm: Kalorienzahlen aus, unter 18, ohne Körperdaten, no_targets', () => {
    const day = targets.days[0] as never;
    for (const o of [
      { ...options, showNumbers: false },
      { ...options, body: null },
    ]) {
      const t = trainingDayTimeline(day, plan.days[0] ?? null, o, snacks);
      expect(t?.grams).toBe(false);
      expect(t?.entries.every((e) => e.meal === null || e.meal.values === null)).toBe(true);
      expect(t?.entries.every((e) => e.extra === null || e.extra.values === null)).toBe(true);
      expect(t?.entries.find((e) => e.kind === 'session')?.session?.fueling).toBeNull();
    }
    const minor = week({ birthDate: '2010-01-01', sessions: [timed(session(MONDAY), 960)] });
    expect(timingGramsAllowed(minor.days[0] as never, options)).toBe(false);
    const pregnant = week({
      sex: 'female',
      healthFlags: { flags: ['pregnancy'] },
      sessions: [run(MONDAY, 120)],
    });
    expect(timingGramsAllowed(pregnant.days[0] as never, options)).toBe(false);
    const t = trainingDayTimeline(pregnant.days[0] as never, null, options, snacks);
    expect(
      t?.entries.find((e) => e.kind === 'session')?.session?.fueling?.carbsGPerHour,
    ).toBeNull();
  });

  it('zwei Einheiten: zwei Fenster, Auffüllen dazwischen', () => {
    const two = week({
      mealsPerDay: 5,
      sessions: [timed(run(MONDAY, 60), 510), timed(session(MONDAY), 990)],
    });
    const t = trainingDayTimeline(two.days[0] as never, null, options, snacks);
    expect(t?.entries.filter((e) => e.kind === 'session')).toHaveLength(2);
    expect(t?.entries.find((e) => e.kind === 'post_meal')?.reason).toBe('post_refuel');
  });

  it('frühes Training: Snack vorher oder Frühstück direkt danach', () => {
    const early = week({ sessions: [timed(session(MONDAY), 360)] });
    const t = trainingDayTimeline(early.days[0] as never, null, options, snacks);
    expect(t?.entries[0]?.reason).toBe('early_snack');
    const notice = trainingTimingNotice(early.days[0] as never, null, t ?? null, options, snacks);
    expect(notice?.code).toBe('timing_early_training');
  });

  it('Snack und Beilage aus dem Bestand: Snack vorher ohne Fett-Überschreitung, Beilage mit Eiweiß', () => {
    const snack = bestPreWorkoutSnack(snacks);
    expect(snack).not.toBeNull();
    if (snack !== null) expect(preWorkoutIssues('pre_snack', snack.facts.perServing)).toEqual([]);
    const side = bestProteinSide(snacks, 15);
    if (side !== null) {
      expect(side.facts.perServing.kcal).toBeLessThanOrEqual(NUTRIENT_TIMING.sideMaxKcal);
    }
    // Filter gelten: vegan → keine tierischen Snacks.
    const vegan = timingSnackCandidates(
      engineInput(targets, { profile: { diet: 'vegan' } }),
      targets.days[0] as never,
    );
    expect(vegan.every((c) => c.facts.diet === 'vegan')).toBe(true);
  });

  it('höchstens ein Hinweis je Tag', () => {
    const t = trainingDayTimeline(targets.days[0] as never, plan.days[0] ?? null, options, snacks);
    const notice = trainingTimingNotice(
      targets.days[0] as never,
      plan.days[0] ?? null,
      t,
      options,
      snacks,
    );
    expect(notice === null || typeof notice.code === 'string').toBe(true);
  });
});

describe('Einkaufsliste nach dem Verschieben', () => {
  const item = (key: string, amount: number | null, extra: Partial<ShoppingListItem> = {}) =>
    ({
      itemKey: key,
      foodId: key,
      labelDe: key,
      amount,
      unit: 'g',
      category: 'other',
      isPantry: false,
      isManual: false,
      checked: false,
      substituteFor: [],
      amountChanged: false,
      notInPlan: false,
      ...extra,
    }) as ShoppingListItem;

  it('neu, entfernt, geänderte Menge; eigene Einträge zählen nicht', () => {
    const before = {
      items: [
        item('reis', 200),
        item('lachs', 300),
        item('milch', 500),
        item('m', null, { isManual: true }),
      ],
    };
    const after = {
      items: [
        item('reis', 300),
        item('lachs', 300, { checked: true, notInPlan: true }),
        item('quark', 250),
      ],
    };
    const changes = shoppingListChanges(before, after);
    expect(changes).toEqual({ added: ['quark'], removed: ['lachs', 'milch'], changed: ['reis'] });
    expect(shoppingListChanged(changes)).toBe(true);
    expect(shoppingListChanged(shoppingListChanges(before, before))).toBe(false);
    expect(shoppingListChanges(null, null)).toEqual({ added: [], removed: [], changed: [] });
  });
});

describe('Zufall bleibt aus', () => {
  it('gleiche Eingaben → gleiche Zeitleiste', () => {
    const targets = week({ sessions: [timed(session(MONDAY), 960)] });
    const plan = buildMealPlanWeek({ ...engineInput(targets), variant: 0 });
    const options = {
      trainingTime: null,
      body: { weightKg: 80, heightCm: 180 },
      showNumbers: true,
      experienceLevel: null,
    };
    expect(trainingDayTimeline(targets.days[0] as never, plan.days[0] ?? null, options)).toEqual(
      trainingDayTimeline(targets.days[0] as never, plan.days[0] ?? null, options),
    );
    expect(EPS).toBeGreaterThan(0);
  });
});
