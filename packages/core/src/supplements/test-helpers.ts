import type { SupplementInputs } from './inputs';

/**
 * Ausgedachte Grund-Person für Tests (nur Tests und Beispiele): 30 Jahre, weiblich, Einwilligung v2, beide Checks ohne
 * Auffälligkeiten, 70 kg, Muskelaufbau, morgens, Mischkost.
 */
export const TEST_TODAY = '2026-10-19';

export function supplementTestInputs(overrides: Partial<SupplementInputs> = {}): SupplementInputs {
  return {
    birthDate: '1996-05-01',
    today: TEST_TODAY,
    sex: 'female',
    healthConsentVersion: 2,
    healthFlags: [],
    supplementFlags: [],
    weightKg: 70,
    goalType: 'muscle_gain',
    secondaryGoalType: null,
    experienceLevel: 'advanced',
    hasIntervalSessions: false,
    dietType: 'omnivore',
    avoidsFish: false,
    avoidsDairy: false,
    trainingTime: 'morning',
    proteinGap: null,
    hasNutritionTargets: true,
    hasCompetition: false,
    ...overrides,
  };
}

/** Ohne Einwilligung v2: Gesundheitsdaten müssen `null` sein. */
export function withoutConsent(
  overrides: Partial<SupplementInputs> = {},
  version: number | null = null,
): SupplementInputs {
  return supplementTestInputs({
    healthConsentVersion: version,
    healthFlags: null,
    supplementFlags: null,
    weightKg: null,
    proteinGap: null,
    ...overrides,
  });
}
