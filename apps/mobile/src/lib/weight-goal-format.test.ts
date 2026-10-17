import {
  evaluateWeightGoalInput,
  type NutritionInputsInput,
  type WeightGoalRated,
} from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  dateDraftFromWeeks,
  draftFromWeightGoal,
  EMPTY_WEIGHT_GOAL_DRAFT,
  feasibilityView,
  pacePercentText,
  parseWeightGoalDraft,
  stepWeeks,
  weeksText,
} from './weight-goal-format';

/** Beispiel A (docs/PLAN-ZIELE.md 3.3): Mann, 35 J., 180 cm, 90 kg, Alltagsfaktor 1,45, Check ohne Befund. */
const TODAY = '2026-10-12';
const A: NutritionInputsInput = {
  today: TODAY,
  birthDate: '1991-09-01',
  sex: 'male',
  goalType: 'fat_loss',
  secondaryGoalType: null,
  experienceLevel: 'beginner',
  discipline: null,
  healthDataConsent: true,
  weightGoal: null,
  bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: null }],
  healthFlags: { flags: [] },
  activityLevel: null,
  trainingTime: null,
  mealsPerDay: 3,
  sessions: [],
};

function rate(kg: number, weeks: number): WeightGoalRated {
  const result = evaluateWeightGoalInput(
    { amount: { mode: 'kg_to_lose', kg }, time: { mode: 'weeks', weeks } },
    A,
  );
  if (!result.ok) throw new Error('erwartet ein gültiges Ziel');
  return result.rating;
}

describe('Ampel-Texte (Plan 3.1, Wächter S4, S20, K8)', () => {
  it('Beispiel A, 10 kg in 12 Wochen: Orange „langsamer“, etwa 22 Wochen, Knopf 22', () => {
    const view = feasibilityView(rate(10, 12));
    expect(view.level).toBe('orange_slower');
    expect(view.zone).toBe('orange');
    expect(view.title).toBe('Sehr ehrgeizig – wir planen etwas langsamer');
    expect(view.text).toBe('Sicher planbar sind für dich etwa 22 Wochen.');
    expect(view.detail).toBe('Benötigt etwa 1 % deines Gewichts pro Woche.');
    expect(view.a11y).toBe(
      'Erreichbarkeit: sehr ehrgeizig. Benötigt etwa 1 % deines Gewichts pro Woche. Sicher planbar sind etwa 22 Wochen.',
    );
    expect(view.applyWeeks).toBe(22);
    // Zeiger in der Orange-Zone [20; 40).
    expect(view.percent).toBeGreaterThanOrEqual(20);
    expect(view.percent).toBeLessThan(40);
  });

  it('nach „Zeitraum übernehmen“ (22 Wochen): Gelb, kein Knopf, kein N', () => {
    const view = feasibilityView(rate(10, 22));
    expect(view.level).toBe('yellow');
    expect(view.title).toBe('Ehrgeizig, aber machbar');
    expect(view.applyWeeks).toBeNull();
    expect(view.a11y).toBe(
      'Erreichbarkeit: ehrgeizig. Benötigt etwa 0,5 % deines Gewichts pro Woche.',
    );
    expect(view.percent).toBeGreaterThanOrEqual(40);
    expect(view.percent).toBeLessThan(60);
  });

  it('Grün (26 Wochen) und Rot (6 Wochen)', () => {
    expect(feasibilityView(rate(10, 26)).title).toBe('Gut erreichbar');
    const red = feasibilityView(rate(10, 6));
    expect(red.level).toBe('red');
    expect(red.text).toBe(
      'Mehr als etwa 1 % deines Körpergewichts pro Woche planen wir nicht. Sicher planbar sind etwa 22 Wochen.',
    );
    expect(red.percent).toBeLessThan(20);
  });

  it('keine Prognose-Wörter, kein Datum (Wächter S20)', () => {
    for (const weeks of [6, 12, 21, 22, 26]) {
      const view = feasibilityView(rate(10, weeks));
      for (const text of [view.title, view.text, view.detail, view.a11y]) {
        expect(text).not.toMatch(/erreicht am|garantiert|wirst|\d{1,2}\.\d{1,2}\.\d{4}|kcal/);
      }
    }
  });

  it('Wochen ab 27 zusätzlich in Monaten, Prozent mit Komma', () => {
    expect(weeksText(1)).toBe('1 Woche');
    expect(weeksText(26)).toBe('26 Wochen');
    expect(weeksText(27)).toBe('27 Wochen (etwa 6 Monate)');
    expect(weeksText(35)).toBe('35 Wochen (etwa 8 Monate)');
    expect(pacePercentText(0.0098)).toBe('1');
    expect(pacePercentText(0.00535)).toBe('0,5');
    expect(pacePercentText(0.01961)).toBe('2');
  });
});

describe('Formular (Plan 2.2)', () => {
  it('leer bzw. teilweise → noch keine Bewertung', () => {
    expect(parseWeightGoalDraft(EMPTY_WEIGHT_GOAL_DRAFT)).toEqual({ kind: 'partial' });
    expect(parseWeightGoalDraft({ ...EMPTY_WEIGHT_GOAL_DRAFT, amountText: '10' })).toEqual({
      kind: 'partial',
    });
    expect(
      parseWeightGoalDraft({
        ...EMPTY_WEIGHT_GOAL_DRAFT,
        timeMode: 'date',
        amountText: '10',
        date: { day: '', month: '', year: '' },
      }),
    ).toEqual({ kind: 'partial' });
  });

  it('kg + Wochen bzw. Zielgewicht + Datum → Eingabe; Komma als Dezimaltrenner', () => {
    expect(
      parseWeightGoalDraft({ ...EMPTY_WEIGHT_GOAL_DRAFT, amountText: '10,5', weeksText: '12' }),
    ).toEqual({
      kind: 'input',
      input: { amount: { mode: 'kg_to_lose', kg: 10.5 }, time: { mode: 'weeks', weeks: 12 } },
    });
    expect(
      parseWeightGoalDraft({
        amountMode: 'target_weight',
        amountText: '79,9',
        timeMode: 'date',
        weeksText: '',
        date: { day: '1', month: '3', year: '2027' },
      }),
    ).toEqual({
      kind: 'input',
      input: {
        amount: { mode: 'target_weight', kg: 79.9 },
        time: { mode: 'date', date: '2027-03-01' },
      },
    });
  });

  it('unlesbare Eingaben → Fehler je Feld (Zahl, Datum, 30. Februar)', () => {
    expect(
      parseWeightGoalDraft({ ...EMPTY_WEIGHT_GOAL_DRAFT, amountText: '1,2,3', weeksText: '12' }),
    ).toMatchObject({ kind: 'unreadable', errors: { 'amount.kg': 'Bitte eine Zahl eingeben.' } });
    expect(
      parseWeightGoalDraft({
        ...EMPTY_WEIGHT_GOAL_DRAFT,
        amountText: '5',
        timeMode: 'date',
        date: { day: '30', month: '02', year: '2027' },
      }),
    ).toMatchObject({ kind: 'unreadable', errors: { time: expect.any(String) } });
    expect(
      parseWeightGoalDraft({
        ...EMPTY_WEIGHT_GOAL_DRAFT,
        amountText: '5',
        timeMode: 'date',
        date: { day: '1', month: '', year: '2027' },
      }),
    ).toMatchObject({ kind: 'unreadable' });
  });

  it('Bearbeiten: „kg abnehmen“ = aktuelles Gewicht − Ziel (nur 0,5-kg-Schritte), Wochen ab heute', () => {
    const goal = {
      targetWeightKg: 80,
      startDate: '2026-10-01',
      targetDate: '2027-03-01',
      amountMode: 'kg_to_lose' as const,
      timeMode: 'weeks' as const,
    };
    expect(draftFromWeightGoal(goal, 90, TODAY)).toMatchObject({
      amountMode: 'kg_to_lose',
      amountText: '10',
      timeMode: 'weeks',
      weeksText: '20',
    });
    // 89,7 − 80 = 9,7 → kein 0,5-Schritt → Zielgewicht.
    expect(draftFromWeightGoal(goal, 89.7, TODAY)).toMatchObject({
      amountMode: 'target_weight',
      amountText: '80',
    });
    // Datum vorbei → Wochen (mindestens 4), Datum-Modus nur mit Datum in der Zukunft.
    expect(
      draftFromWeightGoal({ ...goal, timeMode: 'date', targetDate: '2026-10-01' }, 90, TODAY),
    ).toMatchObject({ timeMode: 'weeks', weeksText: '4' });
    expect(draftFromWeightGoal({ ...goal, timeMode: 'date' }, 90, TODAY)).toMatchObject({
      timeMode: 'date',
      date: { day: '01', month: '03', year: '2027' },
    });
  });

  it('Wochen-Stepper bleibt in 4–104; Datum aus Wochen', () => {
    expect(stepWeeks('', 1)).toBe('4');
    expect(stepWeeks('4', -1)).toBe('4');
    expect(stepWeeks('12', 1)).toBe('13');
    expect(stepWeeks('104', 1)).toBe('104');
    expect(stepWeeks('300', -1)).toBe('104');
    expect(dateDraftFromWeeks('12', TODAY)).toEqual({ day: '04', month: '01', year: '2027' });
    expect(dateDraftFromWeeks('', TODAY)).toEqual({ day: '', month: '', year: '' });
  });
});
