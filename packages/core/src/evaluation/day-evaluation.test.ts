import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { DayItem } from '../log/summary';
import type { FoodLogSlot } from '../nutrition/food-log';
import { nutritionTargetsForWeek, type NutritionDayTargets } from '../nutrition/targets';
import { inputs, MONDAY, seededRandom, session } from '../nutrition/test-helpers';
import {
  dateParamSchema,
  dayEvaluation,
  type DayEvaluationInput,
  evaluationDayTiming,
  evaluationMealPlanUsable,
} from './day-evaluation';

/** „Dein Tag“ (docs/PLAN-AUSWERTUNG.md Abschnitt 6, Etappe A2): Essen + Training zusammengesetzt. */

const TUESDAY = addDays(MONDAY, 1);

function targetsFor(
  overrides: Parameters<typeof inputs>[0] = {},
  date = MONDAY,
): NutritionDayTargets {
  const week = nutritionTargetsForWeek(inputs({ today: TUESDAY, ...overrides }), MONDAY);
  const day = week.days.find((d) => d.date === date);
  if (!day) throw new Error('Tag fehlt');
  return day;
}

function entry(
  kcal: number | null,
  slot: FoodLogSlot = 'other',
  source: 'plan_item' | 'quick' = 'quick',
) {
  return { kcal, protein_g: null, carbs_g: null, fat_g: null, source, slot } as const;
}

function input(overrides: Partial<DayEvaluationInput> = {}): DayEvaluationInput {
  return {
    date: MONDAY,
    today: TUESDAY,
    showNumbers: true,
    targets: targetsFor(),
    foodLog: { available: true, entries: [] },
    mealPlan: null,
    trainingItems: [],
    achievements: new Map(),
    ...overrides,
  };
}

const item = (overrides: Partial<DayItem> = {}): DayItem => ({
  status: 'done',
  sessionId: 's1',
  logId: 'l1',
  name_de: 'Ganzkörper A',
  caughtUpFrom: null,
  free: false,
  backfilled: false,
  ...overrides,
});

describe('dateParamSchema (Route tag/[date])', () => {
  it('gültige Kalendertage', () => {
    expect(dateParamSchema.safeParse('2026-10-15').success).toBe(true);
    expect(dateParamSchema.safeParse('2028-02-29').success).toBe(true);
  });
  it.each(['2026-02-30', '2026-13-01', '15.10.2026', '', '2026-10-15T00:00', 'heute'])(
    'ungültig: %s',
    (value) => {
      expect(dateParamSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe('Zeitpunkt', () => {
  it('vergangen, heute, künftig', () => {
    expect(evaluationDayTiming('2026-10-14', '2026-10-15')).toBe('past');
    expect(evaluationDayTiming('2026-10-15', '2026-10-15')).toBe('today');
    expect(evaluationDayTiming('2026-10-16', '2026-10-15')).toBe('future');
  });
});

describe('Essen', () => {
  it('vergangener Tag unter der Untergrenze: rot + „Laut deinen Einträgen …“', () => {
    const r = dayEvaluation(input({ foodLog: { available: true, entries: [entry(300)] } }));
    expect(r.food.intake.kind === 'bar' && r.food.intake.zone).toBe('below_floor');
    expect(r.notices).toContain('check_entries');
  });

  it('heute gleiche Menge: neutral, kein Hinweis „fehlt etwas?“', () => {
    const r = dayEvaluation(
      input({ today: MONDAY, foodLog: { available: true, entries: [entry(300)] } }),
    );
    expect(r.food.intake.kind === 'bar' && r.food.intake.zone).toBe('open');
    expect(r.notices).not.toContain('check_entries');
  });

  it('keine Einträge: grau (no_entries), nie 0 kcal', () => {
    const r = dayEvaluation(input());
    expect(r.food.intake.kind).toBe('no_entries');
    expect(r.food.entryCount).toBe(0);
  });

  it('nur Einträge ohne kcal: kein Balken (no_entries), Anzahl ohne Wert', () => {
    const r = dayEvaluation(
      input({ foodLog: { available: true, entries: [entry(null), entry(null)] } }),
    );
    expect(r.food.intake.kind).toBe('no_entries');
    expect(r.food).toMatchObject({ entryCount: 2, entriesWithoutValue: 2 });
  });

  it('Einträge mit und ohne kcal: Balken aus den Werten, Hinweis-Zahl ohne Wert', () => {
    const r = dayEvaluation(
      input({ foodLog: { available: true, entries: [entry(2000), entry(null)] } }),
    );
    expect(r.food.intake.kind).toBe('bar');
    expect(r.food.entriesWithoutValue).toBe(1);
  });

  it('künftiger Tag: Vorschau (nur Ziel)', () => {
    const r = dayEvaluation(input({ today: '2026-10-11', date: MONDAY }));
    expect(r.timing).toBe('future');
    expect(r.food.intake.kind).toBe('future');
  });

  it('Mahlzeiten „3 von 4“: nur Plan-Mahlzeiten des Tages zählen, je Platz einmal', () => {
    const r = dayEvaluation(
      input({
        mealPlan: { slots: ['breakfast', 'lunch', 'dinner', 'snack_afternoon'], belowFloor: false },
        foodLog: {
          available: true,
          entries: [
            entry(400, 'breakfast', 'plan_item'),
            entry(600, 'lunch', 'plan_item'),
            entry(500, 'dinner', 'plan_item'),
            entry(200, 'other'),
            entry(100, 'extra_1', 'plan_item'),
          ],
        },
      }),
    );
    expect(r.food.meals).toEqual({ planned: 4, eaten: 3 });
  });

  it('kein Essensplan: keine Mahlzeiten-Zahl, Balken geht trotzdem', () => {
    const r = dayEvaluation(input({ foodLog: { available: true, entries: [entry(2000)] } }));
    expect(r.food.meals).toBeNull();
    expect(r.food.intake.kind).toBe('bar');
  });

  it('Plan-Tag below_floor: Balken normal + bestehender Hinweis', () => {
    const r = dayEvaluation(
      input({
        mealPlan: { slots: ['breakfast'], belowFloor: true },
        foodLog: { available: true, entries: [entry(2000)] },
      }),
    );
    expect(r.food.intake.kind).toBe('bar');
    expect(r.notices).toContain('plan_below_floor');
  });

  it('Trainingstag: neutraler Hinweis (nur mit Zahlen)', () => {
    const targets = targetsFor({ sessions: [session(MONDAY, { status: 'completed' })] });
    expect(dayEvaluation(input({ targets })).notices).toContain('training_day');
    expect(dayEvaluation(input({ targets, showNumbers: false })).notices).not.toContain(
      'training_day',
    );
    expect(dayEvaluation(input()).notices).not.toContain('training_day');
  });

  it('Carb-Loading-Tag (W1): „Heute mehr Kohlenhydrate – so geplant“ nur mit Zahlen und Tagesziel', () => {
    // Halbmarathon am Mittwoch (Einsteiger, 165 min): Montag Carb-Loading, Dienstag Vorabend.
    const race = {
      competitions: [
        {
          id: 'c1',
          status: 'planned' as const,
          discipline: 'half_marathon' as const,
          raceDate: addDays(MONDAY, 2),
        },
      ],
    };
    const targets = targetsFor(race);
    expect(targets.competition?.kind).toBe('carb_loading');
    expect(dayEvaluation(input({ targets })).notices).toContain('carb_loading_day');
    expect(dayEvaluation(input({ targets, showNumbers: false })).notices).not.toContain(
      'carb_loading_day',
    );
    const noConsent = targetsFor({ ...race, healthDataConsent: false });
    expect(dayEvaluation(input({ targets: noConsent })).notices).not.toContain('carb_loading_day');
    expect(dayEvaluation(input()).notices).not.toContain('carb_loading_day');
  });

  it('ohne Einwilligung bzw. Tagebuch nicht verfügbar: Einträge werden ignoriert', () => {
    const r = dayEvaluation(input({ foodLog: { available: false, entries: [entry(2000)] } }));
    expect(r.food).toMatchObject({ available: false, entryCount: 0 });
    expect(r.food.intake.kind).toBe('no_entries');
  });

  it('keine Ziele berechenbar: no_target', () => {
    const r = dayEvaluation(
      input({ targets: null, foodLog: { available: true, entries: [entry(2000)] } }),
    );
    expect(r.food.intake.kind).toBe('no_target');
  });

  it('ohne Körperdaten: no_target + Einladung (body_data_missing)', () => {
    const r = dayEvaluation(input({ targets: targetsFor({ bodyMetricsRows: [] }) }));
    expect(r.food.intake.kind).toBe('no_target');
    expect(r.food.targetNotices).toContain('body_data_missing');
  });

  it('Tagesziele eines anderen Tages werden abgelehnt', () => {
    expect(() => dayEvaluation(input({ targets: targetsFor({}, TUESDAY) }))).toThrow(RangeError);
  });
});

describe('Zahlen aus und Schwangerschaft (2.3)', () => {
  it('Zahlen aus: hidden, keine Hinweise mit Bezug zu Kalorien, Mahlzeiten-Liste bleibt', () => {
    const r = dayEvaluation(
      input({
        showNumbers: false,
        mealPlan: { slots: ['breakfast', 'lunch'], belowFloor: true },
        foodLog: { available: true, entries: [entry(300, 'breakfast', 'plan_item'), entry(null)] },
      }),
    );
    expect(r.food.intake).toEqual({ kind: 'hidden' });
    expect(r.notices).toEqual([]);
    expect(r.food.meals).toEqual({ planned: 2, eaten: 1 });
    expect(r.food.entriesWithoutValue).toBe(0);
  });

  it('Schwangerschaft: auch bei eingeschaltetem Schalter keine Zahlen, Hinweis bleibt', () => {
    const targets = targetsFor({ sex: 'female', healthFlags: { flags: ['pregnancy'] } });
    const r = dayEvaluation(
      input({ targets, foodLog: { available: true, entries: [entry(1500)] } }),
    );
    expect(r.showNumbers).toBe(false);
    expect(r.food.intake).toEqual({ kind: 'hidden' });
    expect(r.food.targetNotices).toEqual(['pregnancy_no_targets']);
  });

  it('Eigenschaft (c) für das Gesamtergebnis: ohne Zahlen keine kcal-Zahl im Essensteil', () => {
    const rand = seededRandom(7);
    for (let i = 0; i < 300; i += 1) {
      const entries = Array.from({ length: Math.floor(rand() * 10) }, () =>
        entry(rand() < 0.2 ? null : Math.round(rand() * 3000)),
      );
      const r = dayEvaluation(
        input({
          showNumbers: false,
          today: rand() < 0.5 ? MONDAY : TUESDAY,
          foodLog: { available: true, entries },
        }),
      );
      // Erlaubt sind nur Anzahlen (Einträge, Mahlzeiten) – keine Energie-Werte.
      const { intake, entriesWithoutValue, targetNotices } = r.food;
      expect(intake).toEqual({ kind: 'hidden' });
      expect(entriesWithoutValue).toBe(0);
      expect(JSON.stringify({ intake, targetNotices, notices: r.notices })).not.toMatch(/\d/);
    }
  }, 60_000);
});

describe('Training', () => {
  it('eingetragene Einheit bekommt den Erfüllungsgrad, offene nicht', () => {
    const r = dayEvaluation(
      input({
        trainingItems: [item(), item({ status: 'planned', logId: null, sessionId: 's2' })],
        achievements: new Map([
          [
            'l1',
            {
              kind: 'strength',
              isFree: false,
              easyWeek: null,
              exercises: [
                {
                  status: 'done',
                  loadType: 'bodyweight',
                  targetSets: 3,
                  repsMin: 8,
                  targetReps: 8,
                  targetWeightKg: null,
                  targetDurationS: null,
                  incrementKind: 'none',
                  steps: [],
                  sets: [
                    { done: true, reps: 8, weightKg: null, durationS: null },
                    { done: true, reps: 8, weightKg: null, durationS: null },
                    { done: false, reps: null, weightKg: null, durationS: null },
                  ],
                },
              ],
            },
          ],
        ]),
      }),
    );
    expect(r.training.items[0]?.achievement).toMatchObject({ percent: 66, level: 'mostly' });
    expect(r.training.items[1]?.achievement).toBeNull();
  });

  it('Training bleibt bei „Zahlen aus“ vollständig', () => {
    const r = dayEvaluation(
      input({ showNumbers: false, trainingItems: [item({ logId: null, status: 'missed' })] }),
    );
    expect(r.training.items).toHaveLength(1);
  });
});

describe('Wächter A2: S1, H3, H5', () => {
  it('S1: Essensplan nur gespeichert – oder laufende Woche ab heute', () => {
    const base = { date: '2026-10-11', today: '2026-10-12' };
    expect(evaluationMealPlanUsable({ ...base, planStored: true, weekEditable: false })).toBe(true);
    expect(evaluationMealPlanUsable({ ...base, planStored: false, weekEditable: false })).toBe(
      false,
    );
    // Vergangener Tag der laufenden Woche, Plan noch nicht gespeichert → nein.
    expect(evaluationMealPlanUsable({ ...base, planStored: false, weekEditable: true })).toBe(
      false,
    );
    for (const date of ['2026-10-12', '2026-10-13']) {
      expect(
        evaluationMealPlanUsable({
          date,
          today: '2026-10-12',
          planStored: false,
          weekEditable: true,
        }),
      ).toBe(true);
      expect(
        evaluationMealPlanUsable({
          date,
          today: '2026-10-12',
          planStored: false,
          weekEditable: false,
        }),
      ).toBe(false);
    }
  });

  it('H3: „Du kannst es nachtragen“ nur im Nachtrage-Fenster (14 Tage), danach nur „Laut deinen Einträgen.“', () => {
    const at = (today: string) =>
      dayEvaluation(input({ today, foodLog: { available: true, entries: [entry(300)] } })).notices;
    expect(at(addDays(MONDAY, 14))).toContain('check_entries');
    expect(at(addDays(MONDAY, 14))).not.toContain('entries_basis');
    expect(at(addDays(MONDAY, 15))).toContain('entries_basis');
    expect(at(addDays(MONDAY, 15))).not.toContain('check_entries');
  });

  it('H5: künftiger Tag ohne Abhak-Zahl', () => {
    const r = dayEvaluation(
      input({
        today: '2026-10-11',
        mealPlan: { slots: ['breakfast', 'lunch'], belowFloor: false },
      }),
    );
    expect(r.timing).toBe('future');
    expect(r.food.meals).toBeNull();
  });
});
