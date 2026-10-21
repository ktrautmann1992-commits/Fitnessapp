/**
 * Fit im Alter · Ernährung (docs/PLAN-FIT-IM-ALTER.md 11, FA-G6): Abnehm-Tempo höchstens 0,5 % Körpergewicht je Woche
 * beim Ziel „Fit im Alter“ (auch mit Nebenziel Abnehmen). Die Grenze lockert nie die allgemeine 1-%-Grenze.
 */
import { describe, expect, it } from 'vitest';

import { nutritionEligibility } from './eligibility';
import { type CalorieLimitContext, calorieLimitContextSchema, dayFloorKcal } from './limits';

const elig = (goalType: 'active_aging' | 'fat_loss' | 'general_fitness', ageYears = 70) =>
  nutritionEligibility({
    ageYears,
    sex: 'female',
    goalType,
    secondaryGoalType: goalType === 'active_aging' ? 'fat_loss' : null,
    healthDataConsent: true,
    body: { weightKg: 80, heightCm: 165 },
    healthFlags: [],
  });

function ctx(overrides: Partial<CalorieLimitContext> = {}): CalorieLimitContext {
  return {
    bmrForFloor: 1300,
    baseNeeds: 2000,
    needs: 2000,
    limitNeeds: 2200,
    weightKg: 80,
    ffmKg: 50,
    trainingGrossKcal: 0,
    trainingCapped: false,
    mode: 'full',
    goalIsSurplus: false,
    deficitCap: 0.25,
    surplusCap: 0.1,
    ...overrides,
  };
}

describe('Abnehm-Tempo bei „Fit im Alter“', () => {
  it('Eignung setzt 0,5 %/Woche nur beim Ziel Fit im Alter', () => {
    expect(elig('active_aging').weeklyLossMaxFraction).toBe(0.005);
    expect(elig('active_aging', 55).weeklyLossMaxFraction).toBe(0.005);
    expect(elig('fat_loss').weeklyLossMaxFraction).toBeUndefined();
    expect(elig('general_fitness').weeklyLossMaxFraction).toBeUndefined();
  });

  it('Untergrenze „Tempo“ = Bedarf − 0,5 % × Gewicht × 7700 / 7 (statt 1 %)', () => {
    const normal = dayFloorKcal(ctx()).parts.weeklyLoss;
    const aging = dayFloorKcal(ctx({ weeklyLossMaxFraction: 0.005 })).parts.weeklyLoss;
    expect(normal).toBeCloseTo(2200 - (0.01 * 80 * 7700) / 7, 9);
    expect(aging).toBeCloseTo(2200 - (0.005 * 80 * 7700) / 7, 9);
    expect(aging).toBeGreaterThan(normal);
  });

  it('nie lockerer als 1 %: größere Werte werden abgelehnt', () => {
    expect(calorieLimitContextSchema.safeParse(ctx({ weeklyLossMaxFraction: 0.02 })).success).toBe(
      false,
    );
    expect(calorieLimitContextSchema.safeParse(ctx({ weeklyLossMaxFraction: 0 })).success).toBe(
      false,
    );
  });

  it.each([40, 150])('Grenzfall %i kg: Untergrenze nie unter Grundumsatz', (weightKg) => {
    const floor = dayFloorKcal(ctx({ weightKg, weeklyLossMaxFraction: 0.005 }));
    expect(floor.kcal).toBeGreaterThanOrEqual(1300);
  });
});
