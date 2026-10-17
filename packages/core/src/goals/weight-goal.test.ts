/**
 * Konkretes Abnehmziel (docs/PLAN-ZIELE.md 2.2–2.4, Etappe Z2): Eingabe, Normalisierung, Validierung und Wirkung je
 * Tag. Erwartungen aus dem Plan abgeschrieben.
 */
import { describe, expect, it } from 'vitest';

import { addDays } from '../dates';
import type { NutritionInputsInput } from '../nutrition/schemas';
import { inputs as nutritionInputs } from '../nutrition/test-helpers';
import {
  createWeightGoalSchema,
  evaluateWeightGoalInput,
  WEIGHT_GOAL_ISSUE_MESSAGES,
  type WeightGoalDayInput,
  weightGoalDayAdjustment,
  weightGoalPreStatus,
  weightGoalReached,
} from './weight-goal';
import { weightGoalSchema } from './weight-goal-schema';

const TODAY = '2026-10-12';

function person(overrides: Partial<NutritionInputsInput> = {}): NutritionInputsInput {
  return nutritionInputs({
    today: TODAY,
    birthDate: '1991-09-01',
    sex: 'male',
    goalType: 'fat_loss',
    activityLevel: 'sedentary',
    bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90 }],
    ...overrides,
  });
}

const issues = (result: ReturnType<typeof evaluateWeightGoalInput>) =>
  result.ok ? [] : result.issues.map((i) => i.code);

describe('Eingabe und Normalisierung (Plan 2.2)', () => {
  it('„kg abnehmen“ + „Wochen“ (Standard, F9): Zielgewicht = aktuell − kg, startDate = heute', () => {
    const result = evaluateWeightGoalInput(
      { amount: { mode: 'kg_to_lose', kg: 10 }, time: { mode: 'weeks', weeks: 22 } },
      person(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goal).toEqual({
      targetWeightKg: 80,
      startDate: TODAY,
      targetDate: addDays(TODAY, 154),
      amountMode: 'kg_to_lose',
      timeMode: 'weeks',
    });
    expect(result.rating.level).toBe('yellow');
  });

  it('„Zielgewicht“ + „bis Datum“; kg-Schritte 0,5 und Zielgewicht 0,1 ohne Gleitkomma-Reste', () => {
    const p = person({
      bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90.3 }],
    });
    const byKg = evaluateWeightGoalInput(
      { amount: { mode: 'kg_to_lose', kg: 2.5 }, time: { mode: 'date', date: '2027-01-11' } },
      p,
    );
    expect(byKg.ok && byKg.goal.targetWeightKg).toBe(87.8);
    expect(byKg.ok && byKg.goal.targetDate).toBe('2027-01-11');
    expect(byKg.ok && byKg.goal.timeMode).toBe('date');
    const byTarget = evaluateWeightGoalInput(
      { amount: { mode: 'target_weight', kg: 85.7 }, time: { mode: 'weeks', weeks: 30 } },
      p,
    );
    expect(byTarget.ok && byTarget.goal.targetWeightKg).toBe(85.7);
    expect(byTarget.ok && byTarget.goal.amountMode).toBe('target_weight');
    expect(
      issues(
        evaluateWeightGoalInput(
          { amount: { mode: 'kg_to_lose', kg: 2.3 }, time: { mode: 'weeks', weeks: 30 } },
          p,
        ),
      ),
    ).toEqual(['kg_step']);
    expect(
      issues(
        evaluateWeightGoalInput(
          { amount: { mode: 'target_weight', kg: 85.75 }, time: { mode: 'weeks', weeks: 30 } },
          p,
        ),
      ),
    ).toEqual(['target_step']);
  });

  it('kg ≤ 0, Ziel = aktuelles Gewicht, 0,5 kg / 0,9 kg / 1 kg', () => {
    const at = (amount: { mode: 'kg_to_lose' | 'target_weight'; kg: number }) =>
      issues(evaluateWeightGoalInput({ amount, time: { mode: 'weeks', weeks: 20 } }, person()));
    expect(at({ mode: 'kg_to_lose', kg: 0 })).toEqual(['not_below_current']);
    expect(at({ mode: 'kg_to_lose', kg: -2 })).toEqual(['not_below_current']);
    expect(at({ mode: 'target_weight', kg: 90 })).toEqual(['not_below_current']);
    expect(at({ mode: 'kg_to_lose', kg: 0.5 })).toEqual(['below_min_kg']);
    expect(at({ mode: 'target_weight', kg: 89.1 })).toEqual(['below_min_kg']);
    expect(at({ mode: 'kg_to_lose', kg: 1 })).toEqual([]);
  });

  it('Zeitraum: 3 / 4 / 104 / 105 Wochen; Datum heute, Vergangenheit, heute + 27 / 28 Tage', () => {
    const at = (time: { mode: 'weeks'; weeks: number } | { mode: 'date'; date: string }) =>
      issues(evaluateWeightGoalInput({ amount: { mode: 'kg_to_lose', kg: 5 }, time }, person()));
    expect(at({ mode: 'weeks', weeks: 3 })).toEqual(['period_out_of_range']);
    expect(at({ mode: 'weeks', weeks: 4 })).toEqual([]);
    expect(at({ mode: 'weeks', weeks: 104 })).toEqual([]);
    expect(at({ mode: 'weeks', weeks: 105 })).toEqual(['period_out_of_range']);
    expect(at({ mode: 'date', date: TODAY })).toEqual(['period_out_of_range']);
    expect(at({ mode: 'date', date: '2026-10-01' })).toEqual(['period_out_of_range']);
    expect(at({ mode: 'date', date: addDays(TODAY, 27) })).toEqual(['period_out_of_range']);
    expect(at({ mode: 'date', date: addDays(TODAY, 28) })).toEqual([]);
    expect(at({ mode: 'date', date: addDays(TODAY, 728) })).toEqual([]);
    expect(at({ mode: 'date', date: addDays(TODAY, 729) })).toEqual(['period_out_of_range']);
  });

  it('Datum: 29. Februar (Schaltjahr 2028) und Zeitumstellung (Wochen = ganze Tage / 7)', () => {
    const p = person({
      today: '2028-01-03',
      birthDate: '1991-09-01',
      bodyMetricsRows: [{ measuredOn: '2028-01-01', heightCm: 180, weightKg: 90 }],
    });
    const leap = evaluateWeightGoalInput(
      { amount: { mode: 'kg_to_lose', kg: 4 }, time: { mode: 'date', date: '2028-02-29' } },
      p,
    );
    expect(leap.ok).toBe(true);
    if (leap.ok) {
      expect(leap.goal.targetDate).toBe('2028-02-29');
      expect(leap.rating.weeks).toBeCloseTo(57 / 7, 12);
    }
    // Zeitumstellung 28.03.2027 und 31.10.2027: ganze Tage, keine Stunden-Reste
    const dst = evaluateWeightGoalInput(
      { amount: { mode: 'kg_to_lose', kg: 4 }, time: { mode: 'date', date: '2027-04-05' } },
      person({
        today: '2027-03-08',
        bodyMetricsRows: [{ measuredOn: '2027-03-01', heightCm: 180, weightKg: 90 }],
      }),
    );
    expect(dst.ok && dst.rating.weeks).toBe(4);
    const weeks = evaluateWeightGoalInput(
      { amount: { mode: 'kg_to_lose', kg: 4 }, time: { mode: 'weeks', weeks: 4 } },
      person({
        today: '2027-10-25',
        bodyMetricsRows: [{ measuredOn: '2027-10-20', heightCm: 180, weightKg: 90 }],
      }),
    );
    expect(weeks.ok && weeks.goal.targetDate).toBe('2027-11-22');
  });

  it('gesperrte Option mit eigenem Grund (Einwilligung, Gewicht, Schwangerschaft, unter 18, Check)', () => {
    const goal = {
      amount: { mode: 'kg_to_lose', kg: 5 },
      time: { mode: 'weeks', weeks: 20 },
    } as const;
    expect(issues(evaluateWeightGoalInput(goal, person({ healthDataConsent: false })))).toEqual([
      'no_consent',
    ]);
    expect(issues(evaluateWeightGoalInput(goal, person({ bodyMetricsRows: [] })))).toEqual([
      'body_data_missing',
    ]);
    expect(
      issues(evaluateWeightGoalInput(goal, person({ healthFlags: { flags: ['pregnancy'] } }))),
    ).toEqual(['pregnancy']);
    expect(issues(evaluateWeightGoalInput(goal, person({ birthDate: '2009-10-13' })))).toEqual([
      'minor',
    ]);
    expect(
      issues(evaluateWeightGoalInput(goal, person({ sex: 'diverse', healthFlags: null }))),
    ).toEqual(['health_check_missing']);
    expect(issues(evaluateWeightGoalInput(goal, person({ goalType: 'muscle_gain' })))).toEqual([
      'not_fat_loss',
    ]);
  });

  it('kein Defizit planbar (Beispiel G) → nicht speicherbar', () => {
    const g = person({
      bodyMetricsRows: [
        { measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: 39.3 },
      ],
      healthFlags: { flags: ['medication'] },
    });
    expect(
      issues(
        evaluateWeightGoalInput(
          { amount: { mode: 'kg_to_lose', kg: 10 }, time: { mode: 'weeks', weeks: 30 } },
          g,
        ),
      ),
    ).toEqual(['no_deficit']);
  });

  it('createWeightGoalSchema: Fehler mit Pfad und Text, Erfolg liefert das normalisierte Ziel', () => {
    const schema = createWeightGoalSchema(person());
    const ok = schema.safeParse({
      amount: { mode: 'kg_to_lose', kg: 10 },
      time: { mode: 'weeks', weeks: 26 },
    });
    expect(ok.success && ok.data.targetWeightKg).toBe(80);
    const bad = schema.safeParse({
      amount: { mode: 'target_weight', kg: 50 }, // BMI 15,4 und Zeitraum zu kurz
      time: { mode: 'weeks', weeks: 2 },
    });
    expect(bad.success).toBe(false);
    if (bad.success) return;
    expect(bad.error.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['amount.kg', WEIGHT_GOAL_ISSUE_MESSAGES.target_bmi_too_low],
      ['time', WEIGHT_GOAL_ISSUE_MESSAGES.period_out_of_range],
    ]);
    expect(schema.safeParse({ amount: { mode: 'kg', kg: 1 }, time: {} }).success).toBe(false);
  });

  it('Texte: neutral, „wir planen“, keine Prognose und kein Datum (Plan 6 Nr. 6, S20)', () => {
    for (const text of Object.values(WEIGHT_GOAL_ISSUE_MESSAGES)) {
      expect(text).not.toMatch(/garantiert|wirst .* verlieren|erreichbar am|\b20\d\d\b/i);
    }
  });
});

describe('gespeichertes Ziel (weightGoalSchema, Plan 5.2)', () => {
  it('Zeitraum 28–728 Tage ab startDate, Zielgewicht 30–300 kg mit 0,1 kg', () => {
    const goal = {
      targetWeightKg: 80,
      startDate: TODAY,
      targetDate: addDays(TODAY, 28),
      amountMode: 'kg_to_lose',
      timeMode: 'weeks',
    } as const;
    expect(weightGoalSchema.safeParse(goal).success).toBe(true);
    expect(weightGoalSchema.safeParse({ ...goal, targetDate: addDays(TODAY, 27) }).success).toBe(
      false,
    );
    expect(weightGoalSchema.safeParse({ ...goal, targetDate: addDays(TODAY, 728) }).success).toBe(
      true,
    );
    expect(weightGoalSchema.safeParse({ ...goal, targetDate: addDays(TODAY, 729) }).success).toBe(
      false,
    );
    expect(weightGoalSchema.safeParse({ ...goal, targetWeightKg: 29.9 }).success).toBe(false);
    expect(weightGoalSchema.safeParse({ ...goal, targetWeightKg: 300 }).success).toBe(true);
    expect(weightGoalSchema.safeParse({ ...goal, targetWeightKg: 80.05 }).success).toBe(false);
    // Startdatum nie vor WEIGHT_GOAL_START_DATE_MIN (= CHECK weight_goals.start_date, Wächter Z3 N1).
    const early = { ...goal, startDate: '2025-12-31', targetDate: '2026-02-01' };
    expect(weightGoalSchema.safeParse(early).success).toBe(false);
    expect(weightGoalSchema.safeParse({ ...early, startDate: '2026-01-01' }).success).toBe(true);
    // Ungültige Datumsangaben (z. B. aus einer Datenbank- oder Gerätezeile): Fehler, nie eine Ausnahme (Etappe Z3).
    expect(weightGoalSchema.safeParse({ ...goal, startDate: '03.10.2026' }).success).toBe(false);
    expect(weightGoalSchema.safeParse({ ...goal, targetDate: '2026-02-30' }).success).toBe(false);
    expect(weightGoalSchema.safeParse({ ...goal, startWeightKg: 90 }).success).toBe(false);
  });
});

describe('Wirkung je Tag (Plan 2.4)', () => {
  const goal = {
    targetWeightKg: 80,
    startDate: TODAY,
    targetDate: addDays(TODAY, 70),
    amountMode: 'kg_to_lose',
    timeMode: 'weeks',
  } as const;
  const base: WeightGoalDayInput = {
    goal,
    date: TODAY,
    today: TODAY,
    birthDate: '1991-09-01',
    mode: 'full',
    losesWeight: true,
    standardAdjustment: -0.2,
    baseNeeds: 2689.75,
    latestWeightKg: 90,
    latestWeightMeasuredOn: '2026-10-10',
    heightCm: 180,
    bodyMetricsRows: [{ measuredOn: '2026-10-10', heightCm: 180, weightKg: 90, bodyFatPct: null }],
    noDeficit: false,
  };
  /** Ergebnis eines Tages ab `startDate` (nie `null`). */
  const day = (input: Partial<WeightGoalDayInput>) => {
    const result = weightGoalDayAdjustment({ ...base, ...input });
    if (result === null) throw new Error('erwartet ein Ergebnis');
    return result;
  };

  it('Anpassung = max(Standard, −v_r × 7700 / 7 / Grundbedarf)', () => {
    // 10 kg in 10 Wochen = 1 kg/Woche → 1.100 kcal > 20 % → Standard
    expect(day({})).toEqual({ status: 'active', adjustment: -0.2, slowerThanRequired: true });
    // 30 Wochen: 10/30 kg/Woche → 366,67 kcal/Tag
    const slow = day({ goal: { ...goal, targetDate: addDays(TODAY, 210) } });
    expect(slow.adjustment).toBeCloseTo((-(10 / 30) * 1100) / 2689.75, 12);
    expect(slow.slowerThanRequired).toBe(false);
  });

  it('Restwochen ab dem Ankertag max(Messtag, startDate), höchstens Tag d (Wächter Z2 S-1): ohne neue Messung konstantes Tempo', () => {
    const long = { ...goal, targetDate: addDays(TODAY, 210) };
    const first = day({ goal: long }).adjustment;
    for (let i = 1; i <= 60; i += 1) {
      expect(day({ goal: long, date: addDays(TODAY, i) }).adjustment).toBe(first);
    }
    // neue Messung nach dem Start: Anker = Messtag
    const later = day({
      goal: long,
      date: addDays(TODAY, 70),
      latestWeightKg: 86,
      latestWeightMeasuredOn: addDays(TODAY, 70),
    });
    expect(later.adjustment).toBeCloseTo((-(6 / 20) * 1100) / 2689.75, 12);
    // Messtag nach Tag d (vergangener Tag der Woche): Anker = d
    const past = day({
      goal: long,
      date: addDays(TODAY, 7),
      latestWeightKg: 86,
      latestWeightMeasuredOn: addDays(TODAY, 10),
    });
    expect(past.adjustment).toBeCloseTo((-(6 / (203 / 7)) * 1100) / 2689.75, 12);
  });

  it('Messung am Tag vor dem Zieldatum: restWochen = 1/7 (kein Teilen durch 0), Anpassung = Standard; am Zieldatum: abgelaufen', () => {
    const before = addDays(goal.targetDate, -1);
    const dayBefore = day({ date: before, latestWeightMeasuredOn: before, latestWeightKg: 85 });
    expect(dayBefore.status).toBe('active');
    expect(dayBefore.adjustment).toBe(-0.2);
    expect(Number.isFinite(dayBefore.adjustment)).toBe(true);
    expect(day({ date: goal.targetDate })).toEqual({
      status: 'date_passed',
      adjustment: -0.2,
      slowerThanRequired: false,
    });
  });

  it('kein Aufholen: letzte Woche vor dem Datum, 5 kg Rest (frisch gemessen) → Anpassung = Standard-Anpassung, nicht mehr', () => {
    for (let i = 1; i <= 7; i += 1) {
      const date = addDays(goal.targetDate, -i);
      const r = day({ date, latestWeightKg: 85, latestWeightMeasuredOn: date });
      expect(r.adjustment).toBe(-0.2);
      expect(r.slowerThanRequired).toBe(true);
    }
  });

  it('Ziel-BMI zur Laufzeit nach dem Alter am Zieldatum (F8): 69 J. → Grenze 20, 70 J. → Grenze 22', () => {
    // 180 cm, Ziel 68 kg ≈ BMI 20,99; Zieldatum = heute + 70 Tage (21.12.2026)
    const g = { ...goal, targetWeightKg: 68 };
    expect(weightGoalDayAdjustment({ ...base, goal: g, birthDate: '1956-12-22' })?.status).not.toBe(
      'invalid',
    );
    expect(weightGoalDayAdjustment({ ...base, goal: g, birthDate: '1956-12-21' })?.status).toBe(
      'invalid',
    );
  });

  it('geboren am 29.02.: 70. Geburtstag im Nicht-Schaltjahr erst am 01.03. – Grenze 22 ab dem Zieldatum 01.03. (Z3 N5)', () => {
    const pre = (targetDate: string, date = '2026-01-05') =>
      weightGoalPreStatus({
        goal: { targetWeightKg: 68, startDate: '2026-01-05', targetDate }, // 180 cm: BMI ≈ 20,99
        date,
        birthDate: '1956-02-29',
        losesWeight: true,
        heightCm: 180,
        mode: 'full',
      });
    expect(pre('2026-02-28')).toBe('ok'); // noch 69 → Grenze 20
    expect(pre('2026-03-01')).toBe('invalid'); // 70 → Grenze 22
    // Abgelaufenes Ziel (Tag d nach dem Zieldatum): Alter am Tag d, nie eine Ausnahme (Z3 N1).
    expect(pre('2026-02-28', '2026-03-02')).toBe('invalid');
    expect(() => pre('2026-02-28', '2027-06-01')).not.toThrow();
  });

  it('Tage vor startDate: kein Ziel (Wächter Z2 K-1)', () => {
    expect(weightGoalDayAdjustment({ ...base, date: addDays(TODAY, -1) })).toBeNull();
    expect(
      weightGoalDayAdjustment({ ...base, date: addDays(TODAY, -1), losesWeight: false }),
    ).toBeNull();
  });

  it('Gewichtsfolge 80,1 → 79,9 → 80,2 bei Ziel 80,0: ab 79,9 durchgehend „erreicht“ (Wächter S8)', () => {
    const rows = [
      { measuredOn: '2026-10-13', heightCm: null, weightKg: 80.1, bodyFatPct: null },
      { measuredOn: '2026-10-15', heightCm: null, weightKg: 79.9, bodyFatPct: null },
      { measuredOn: '2026-10-17', heightCm: null, weightKg: 80.2, bodyFatPct: null },
    ];
    const today = '2026-10-20';
    const status = (date: string, latest: number) =>
      day({ today, date, latestWeightKg: latest, bodyMetricsRows: rows });
    expect(status('2026-10-14', 80.1).status).toBe('active');
    expect(status('2026-10-15', 79.9)).toEqual({
      status: 'reached',
      adjustment: 0,
      slowerThanRequired: false,
    });
    expect(status('2026-10-17', 80.2).status).toBe('reached');
    expect(status('2026-10-25', 80.2).status).toBe('reached');
    // Messungen VOR startDate zählen nicht
    expect(weightGoalReached({ ...goal, startDate: '2026-10-16' }, rows, '2026-10-20', today)).toBe(
      false,
    );
    // Messungen nach `today` zählen nicht (auch nicht für künftige Tage)
    expect(weightGoalReached(goal, rows, '2026-10-25', '2026-10-14')).toBe(false);
  });

  it('Größe nachträglich geändert → Ziel-BMI unzulässig → ignoriert (Standard), Status `invalid` (S14) – auch im Modus Erhalt (K-3)', () => {
    // 80 kg bei 210 cm: BMI 18,1
    expect(day({ heightCm: 210 })).toEqual({
      status: 'invalid',
      adjustment: -0.2,
      slowerThanRequired: false,
    });
    expect(day({ losesWeight: false }).status).toBe('invalid');
    expect(day({ heightCm: 210, mode: 'maintenance_only', standardAdjustment: 0 }).status).toBe(
      'invalid',
    );
  });

  it('neuestes Gewicht ≤ Ziel, aber vor startDate gemessen → unzulässig, nie ein Überschuss', () => {
    const r = day({ latestWeightKg: 79 });
    expect(r.status).toBe('invalid');
    expect(r.adjustment).toBeLessThanOrEqual(0);
  });

  it('`no_deficit` zur Laufzeit → Standard-Anpassung (Untergrenzen danach in clampCalorieTarget), Modus Erhalt → ruht', () => {
    expect(day({ noDeficit: true })).toEqual({
      status: 'no_deficit',
      adjustment: -0.2,
      slowerThanRequired: false,
    });
    expect(day({ mode: 'maintenance_only', standardAdjustment: 0 })).toEqual({
      status: 'paused',
      adjustment: 0,
      slowerThanRequired: false,
    });
  });

  it('Eigenschaft: Anpassung immer in [Standard; 0] – für jedes Rest-Gewicht, jeden Tag, jeden Messtag und jede Standard-Anpassung', () => {
    for (const standard of [-0.2, -0.15, -0.1]) {
      for (const latest of [79, 80.05, 80.5, 85, 100, 200]) {
        for (const measuredOffset of [-30, 0, 20, 69]) {
          for (let d = -3; d <= 80; d += 1) {
            const r = weightGoalDayAdjustment({
              ...base,
              standardAdjustment: standard,
              latestWeightKg: latest,
              latestWeightMeasuredOn: addDays(TODAY, measuredOffset),
              date: addDays(TODAY, d),
            });
            if (d < 0) {
              expect(r).toBeNull();
              continue;
            }
            expect(r!.adjustment).toBeGreaterThanOrEqual(standard);
            expect(r!.adjustment).toBeLessThanOrEqual(0);
          }
        }
      }
    }
  });
});
