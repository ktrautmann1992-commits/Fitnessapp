import { describe, expect, it } from 'vitest';

import { GOAL_TYPES, SEX_OPTIONS, type GoalType, type Sex } from '../enums';
import type { HealthFlag } from '../health-screening';
import { planSafetyRules } from '../plan/safety';
import { type EligibilityInputs, nutritionEligibility } from './eligibility';
import { surplusCapSchema } from './schemas';

function elig(overrides: Partial<EligibilityInputs> = {}) {
  return nutritionEligibility({
    ageYears: 30,
    sex: 'female',
    goalType: 'fat_loss',
    healthDataConsent: true,
    body: { weightKg: 70, heightCm: 170 },
    healthFlags: [],
    ...overrides,
  });
}

/** Gewicht für einen BMI bei 170 cm. */
const kgForBmi = (bmi: number) => bmi * 1.7 * 1.7;

describe('Sonderfälle je Zeile (4.9)', () => {
  it('Erwachsene ohne Sonderfall: voll, 25 %, Überschuss 0,10, Eiweiß ≤ 2,2', () => {
    expect(elig()).toMatchObject({
      mode: 'full',
      deficitCap: 0.25,
      surplusCap: 0.1,
      proteinMin: 0,
      proteinCap: 2.2,
      recipeExclusions: [],
      notices: [],
      usesHealthData: true,
    });
  });

  it('keine Einwilligung → no_targets, keine Gesundheitsdaten verwendet', () => {
    const e = elig({ healthDataConsent: false, healthFlags: ['pregnancy'] });
    expect(e.mode).toBe('no_targets');
    expect(e.notices).toEqual(['no_health_data_consent', 'body_data_missing']);
    expect(e.usesHealthData).toBe(false);
    // Ohne Einwilligung gibt es keinen Check → Frau: Ausschluss pregnancy_caution (B4)
    expect(e.recipeExclusions).toEqual(['pregnancy_caution']);
    expect(elig({ healthDataConsent: false, sex: 'male' }).recipeExclusions).toEqual([]);
  });

  it('keine Größe/kein Gewicht → no_targets', () => {
    const e = elig({ body: null });
    expect(e.mode).toBe('no_targets');
    expect(e.notices).toEqual(['body_data_missing']);
    expect(e.usesHealthData).toBe(true);
  });

  it('Schwangerschaft → no_targets, Ausschluss pregnancy_caution, Hinweise inkl. Koffein (B5, 16 B (m))', () => {
    const e = elig({ healthFlags: ['pregnancy', 'conservative_plan'] });
    expect(e.mode).toBe('no_targets');
    expect(e.recipeExclusions).toEqual(['pregnancy_caution']);
    expect(e.notices).toEqual([
      'pregnancy_no_targets',
      'pregnancy_check_update',
      'pregnancy_caffeine',
    ]);
    expect(e.usesHealthData).toBe(true);
  });

  it('kein Gesundheits-Check × jedes Geschlecht (B4, W4)', () => {
    const male = elig({ healthFlags: null, sex: 'male' });
    expect(male).toMatchObject({
      mode: 'full',
      deficitCap: 0.15,
      surplusCap: 0.05,
      proteinCap: 1.6,
      recipeExclusions: [],
    });
    expect(male.notices).toContain('health_check_missing');
    for (const sex of ['female', 'diverse', 'unspecified', null] as const) {
      const e = elig({ healthFlags: null, sex });
      expect(e).toMatchObject({
        mode: 'maintenance_only',
        deficitCap: 0,
        surplusCap: 0.05,
        proteinCap: 1.6,
        recipeExclusions: ['pregnancy_caution'],
      });
      expect(e.notices).toContain('health_check_missing');
      // auch bei muscle_gain: Erhalt bis zum Check
      expect(elig({ healthFlags: null, sex, goalType: 'muscle_gain' }).mode).toBe(
        'maintenance_only',
      );
    }
  });

  it('unter 18: Fettverlust/Definition → maintenance_only; nie Defizit; Überschuss ≤ 5 %; Eiweiß ≤ 1,6', () => {
    for (const goalType of GOAL_TYPES) {
      const e = elig({ ageYears: 17, goalType });
      expect(e.deficitCap).toBe(0);
      expect(e.surplusCap).toBe(0.05);
      expect(e.proteinCap).toBe(1.6);
      expect(e.mode).toBe(
        goalType === 'fat_loss' || goalType === 'definition' ? 'maintenance_only' : 'full',
      );
    }
    expect(elig({ ageYears: 16 }).notices).toEqual(['minor_no_deficit', 'bmr_estimate_age']);
    // keine BMI-Erwachsenengrenzen unter 18
    expect(
      elig({
        ageYears: 17,
        goalType: 'muscle_gain',
        body: { weightKg: kgForBmi(16), heightCm: 170 },
      }).notices,
    ).not.toContain('underweight');
  });

  it('ab 18 gelten die Erwachsenenregeln', () => {
    expect(elig({ ageYears: 18 })).toMatchObject({
      mode: 'full',
      deficitCap: 0.25,
      surplusCap: 0.1,
    });
  });

  it('Untergewicht BMI < 18,5 → maintenance_only bei Fettverlust/Definition, < 17 deutlicher Hinweis', () => {
    expect(elig({ body: { weightKg: kgForBmi(18.4), heightCm: 170 } })).toMatchObject({
      mode: 'maintenance_only',
      deficitCap: 0,
      notices: ['underweight'],
    });
    expect(elig({ body: { weightKg: kgForBmi(16.9), heightCm: 170 } }).notices).toEqual([
      'underweight',
      'severe_underweight',
    ]);
    expect(elig({ body: { weightKg: kgForBmi(17), heightCm: 170 } }).notices).toEqual([
      'underweight',
    ]);
    const gain = elig({ goalType: 'muscle_gain', body: { weightKg: kgForBmi(18), heightCm: 170 } });
    expect(gain).toMatchObject({ mode: 'full', deficitCap: 0 });
  });

  it('BMI 18,5 bis < 20 → Defizit ≤ 10 %', () => {
    expect(elig({ body: { weightKg: kgForBmi(18.5), heightCm: 170 } }).deficitCap).toBe(0.1);
    expect(elig({ body: { weightKg: kgForBmi(19.9), heightCm: 170 } }).deficitCap).toBe(0.1);
    expect(elig({ body: { weightKg: kgForBmi(20), heightCm: 170 } }).deficitCap).toBe(0.25);
  });

  it('Medikamente / Arzt-Hinweis → Defizit ≤ 15 %, Eiweiß ≤ 1,6, Hinweis', () => {
    for (const flag of ['medication', 'medical_clearance_recommended'] as const) {
      expect(elig({ healthFlags: [flag, 'conservative_plan'] })).toMatchObject({
        mode: 'full',
        deficitCap: 0.15,
        proteinCap: 1.6,
        notices: ['medical_consult'],
      });
    }
    expect(elig({ healthFlags: ['injury', 'conservative_plan'] }).deficitCap).toBe(0.25);
  });

  it('ab 65 → Defizit ≤ 15 %, Eiweiß 1,2–1,6; über 78 Hinweis bmr_estimate_age', () => {
    expect(elig({ ageYears: 64 })).toMatchObject({
      deficitCap: 0.25,
      proteinMin: 0,
      proteinCap: 2.2,
    });
    expect(elig({ ageYears: 65 })).toMatchObject({
      deficitCap: 0.15,
      proteinMin: 1.2,
      proteinCap: 1.6,
      notices: [],
    });
    expect(elig({ ageYears: 78 }).notices).toEqual([]);
    expect(elig({ ageYears: 79 }).notices).toEqual(['bmr_estimate_age']);
    expect(elig({ ageYears: 100 }).notices).toEqual(['bmr_estimate_age']);
  });
});

describe('Eigenschaftsraster Sonderfälle (W14): strengste Regel gewinnt immer', () => {
  const FLAG_SETS: (readonly HealthFlag[] | null)[] = [
    null,
    [],
    ['injury', 'conservative_plan'],
    ['medication', 'conservative_plan'],
    ['medical_clearance_recommended', 'conservative_plan'],
    ['pregnancy', 'conservative_plan'],
    ['pregnancy', 'medication', 'medical_clearance_recommended', 'injury', 'conservative_plan'],
  ];
  const AGES = [16, 17, 18, 64, 65, 100];
  const BMIS = [16.9, 17, 18.4, 18.5, 19.9, 20, 30];
  const SEXES: (Sex | null)[] = [...SEX_OPTIONS, null];

  it('jede Kombination: erwarteter Modus, Deckel als Minimum aller zutreffenden Regeln, surplusCap gesetzt (W26)', () => {
    let count = 0;
    for (const flags of FLAG_SETS) {
      for (const ageYears of AGES) {
        for (const bmi of BMIS) {
          for (const goalType of GOAL_TYPES) {
            for (const sex of SEXES) {
              for (const consent of [true, false]) {
                count += 1;
                const e = elig({
                  ageYears,
                  sex,
                  goalType: goalType as GoalType,
                  healthDataConsent: consent,
                  healthFlags: flags,
                  body: { weightKg: kgForBmi(bmi), heightCm: 170 },
                });
                // Unabhängige Erwartung aus der Tabelle 4.9
                const f = consent ? flags : null;
                const pregnancy = f?.includes('pregnancy') ?? false;
                const noCheck = f === null;
                const minor = ageYears < 18;
                const deficitGoal = goalType === 'fat_loss' || goalType === 'definition';
                const expectNoTargets = !consent || pregnancy;
                const expectMaintenance =
                  !expectNoTargets &&
                  ((noCheck && sex !== 'male') ||
                    (minor && deficitGoal) ||
                    (!minor && bmi < 18.5 && deficitGoal));
                expect(e.mode).toBe(
                  expectNoTargets ? 'no_targets' : expectMaintenance ? 'maintenance_only' : 'full',
                );
                expect(() => surplusCapSchema.parse(e.surplusCap)).not.toThrow();
                expect(e.deficitCap).toBeGreaterThanOrEqual(0);
                expect(e.deficitCap).toBeLessThanOrEqual(0.25);
                if (expectNoTargets) continue;
                const caps = [0.25];
                if (noCheck) caps.push(0.15);
                if (f?.includes('medication') || f?.includes('medical_clearance_recommended'))
                  caps.push(0.15);
                if (ageYears >= 65) caps.push(0.15);
                if (!minor && bmi >= 18.5 && bmi < 20) caps.push(0.1);
                if (minor || expectMaintenance || (!minor && bmi < 18.5)) caps.push(0);
                expect(e.deficitCap).toBe(Math.min(...caps));
                expect(e.surplusCap).toBe(minor || noCheck ? 0.05 : 0.1);
                const proteinCaps = [2.2];
                if (
                  minor ||
                  noCheck ||
                  f?.includes('medication') ||
                  f?.includes('medical_clearance_recommended') ||
                  ageYears >= 65
                ) {
                  proteinCaps.push(1.6);
                }
                expect(e.proteinCap).toBe(Math.min(...proteinCaps));
                expect(e.proteinMin).toBe(ageYears >= 65 ? 1.2 : 0);
                expect(e.recipeExclusions).toEqual(
                  noCheck && sex !== 'male' ? ['pregnancy_caution'] : [],
                );
              }
            }
          }
        }
      }
    }
    expect(count).toBe(7 * 6 * 7 * GOAL_TYPES.length * 5 * 2);
  });

  it('W26: Erwachsener mit fat_loss ohne Sonderfall → 0,10; unter 18 bzw. ohne Check → 0,05', () => {
    expect(elig({ goalType: 'fat_loss' }).surplusCap).toBe(0.1);
    expect(elig({ ageYears: 17 }).surplusCap).toBe(0.05);
    expect(elig({ healthFlags: null, sex: 'male' }).surplusCap).toBe(0.05);
  });
});

describe('Abgleich mit planSafetyRules (B4): vorsichtig in Training UND Ernährung', () => {
  const cases: { name: string; age: number; flags: HealthFlag[] | null; sex: Sex }[] = [
    { name: 'kein Check', age: 30, flags: null, sex: 'male' },
    { name: 'Schwangerschaft', age: 30, flags: ['pregnancy', 'conservative_plan'], sex: 'female' },
    { name: 'Medikamente', age: 30, flags: ['medication', 'conservative_plan'], sex: 'male' },
    {
      name: 'Arzt-Hinweis',
      age: 30,
      flags: ['medical_clearance_recommended', 'conservative_plan'],
      sex: 'male',
    },
    { name: 'unter 18', age: 16, flags: [], sex: 'male' },
    { name: 'ab 65', age: 65, flags: [], sex: 'male' },
  ];
  const birthFor = (age: number) => `${2026 - age}-01-01`;

  for (const c of cases) {
    it(c.name, () => {
      const training = planSafetyRules(
        {
          experienceLevel: 'advanced',
          birthDate: birthFor(c.age),
          healthScreening: c.flags === null ? null : { flags: c.flags },
        },
        '2026-10-12',
      );
      expect(training.enduranceStartGroup).toBe('cautious');
      const e = elig({ ageYears: c.age, sex: c.sex, healthFlags: c.flags, goalType: 'fat_loss' });
      const nutritionCautious =
        e.mode !== 'full' || e.deficitCap < 0.25 || e.surplusCap < 0.1 || e.proteinCap < 2.2;
      expect(nutritionCautious).toBe(true);
    });
  }

  it('ohne Sonderfall ist keines von beiden vorsichtig', () => {
    const training = planSafetyRules(
      { experienceLevel: 'advanced', birthDate: '1990-01-01', healthScreening: { flags: [] } },
      '2026-10-12',
    );
    expect(training.cautious).toBe(false);
    expect(elig({ sex: 'male' })).toMatchObject({
      mode: 'full',
      deficitCap: 0.25,
      surplusCap: 0.1,
      proteinCap: 2.2,
    });
  });
});

describe('Zod an der Grenze (Wächter N1, K1)', () => {
  it('ungültige Eingaben werden abgelehnt statt still „voll“ zu rechnen', () => {
    expect(() => elig({ ageYears: Number.NaN })).toThrow();
    expect(() => elig({ body: { weightKg: 70, heightCm: 0 } })).toThrow();
    expect(() => elig({ ageYears: 121 })).toThrow();
  });
});
