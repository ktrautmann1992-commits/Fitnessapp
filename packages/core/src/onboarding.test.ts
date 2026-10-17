import { describe, expect, it } from 'vitest';

import {
  applicableSteps,
  firstStep,
  formatProgressDe,
  HEALTH_DATA_STEPS,
  isOnboardingStep,
  isStepApplicable,
  isStepSkippable,
  nextStep,
  ONBOARDING_STEPS,
  type OnboardingState,
  previousStep,
  progress,
  resumeStep,
  WEIGHT_GOAL_STEP_ENABLED,
} from './onboarding';

const full: OnboardingState = { healthDataConsent: true, hasHomeStrength: true };
const noConsentGym: OnboardingState = { healthDataConsent: false, hasHomeStrength: false };
/**
 * Alle Schritte außer dem seit Etappe B2 nie anwendbaren Trainingsort, dem Schritt `nutrition_setup`, der nur mit
 * `nutritionSetupAvailable: true` (Testmodus bis N7) anwendbar ist, und dem bis Etappe Z4 abgeschalteten `weight_goal`.
 */
const ALL_SHOWN = ONBOARDING_STEPS.filter(
  (step) => step !== 'training_location' && step !== 'nutrition_setup' && step !== 'weight_goal',
);
/** Testmodus (lokales Backend): Speicherort für `nutrition_setup` vorhanden (R2-S3). */
const fullTestMode: OnboardingState = { ...full, nutritionSetupAvailable: true };

describe('Schritt-Reihenfolge', () => {
  it('enthält keinen Wearable-Schritt (Frage 8)', () => {
    expect(ONBOARDING_STEPS).not.toContain('wearable');
  });

  it('Körperumfänge kommen direkt nach den Körperdaten und sind überspringbar', () => {
    expect(ONBOARDING_STEPS.indexOf('body_measurements')).toBe(
      ONBOARDING_STEPS.indexOf('body_metrics') + 1,
    );
    expect(isStepSkippable('body_measurements')).toBe(true);
    expect(isStepSkippable('body_metrics')).toBe(false);
  });

  it('mit Einwilligung und Kraft zu Hause: alle 11 gezeigten Schritte', () => {
    expect(applicableSteps(full)).toEqual(ALL_SHOWN);
    expect(applicableSteps(full)).toHaveLength(11);
  });

  it('Trainingsort ist nie anwendbar (aus den Trainingstagen abgeleitet), bleibt aber in der Liste', () => {
    expect(ONBOARDING_STEPS).toContain('training_location');
    for (const state of [full, noConsentGym, {}]) {
      expect(isStepApplicable('training_location', state)).toBe(false);
    }
  });

  it('ohne Einwilligung: keine Körperdaten, keine Umfänge, kein Gesundheits-Check', () => {
    const steps = applicableSteps({ healthDataConsent: false, hasHomeStrength: true });
    expect(steps).not.toContain('body_metrics');
    expect(steps).not.toContain('body_measurements');
    expect(steps).not.toContain('health_screening');
    expect(steps).toContain('health_consent');
    expect(steps).toHaveLength(8);
  });

  it('kein Tag „Kraft zu Hause“: kein Equipment-Schritt', () => {
    expect(applicableSteps({ healthDataConsent: true, hasHomeStrength: false })).not.toContain(
      'equipment',
    );
  });

  it('kürzester Ablauf (ohne Einwilligung, ohne Kraft zu Hause): 7 Schritte', () => {
    expect(applicableSteps(noConsentGym)).toEqual([
      'sex',
      'health_consent',
      'experience',
      'goal',
      'time_budget',
      'nutrition',
      'cooking',
    ]);
  });

  it('noch unbeantwortete Fragen zählen die abhängigen Schritte mit', () => {
    expect(applicableSteps({})).toHaveLength(11);
  });
});

describe('nextStep / previousStep', () => {
  it('geht linear durch den vollen Ablauf', () => {
    let step = firstStep(full);
    const visited = [step];
    for (;;) {
      const next = nextStep(step, full);
      if (next === null) break;
      visited.push(next);
      step = next;
    }
    expect(visited).toEqual(ALL_SHOWN);
  });

  it('überspringt Gesundheits-Schritte ohne Einwilligung', () => {
    expect(nextStep('health_consent', noConsentGym)).toBe('experience');
    expect(previousStep('experience', noConsentGym)).toBe('health_consent');
  });

  it('überspringt Trainingsort immer und Equipment ohne Kraft zu Hause', () => {
    expect(nextStep('time_budget', noConsentGym)).toBe('nutrition');
    expect(previousStep('nutrition', noConsentGym)).toBe('time_budget');
    expect(nextStep('time_budget', full)).toBe('equipment');
    expect(previousStep('equipment', full)).toBe('time_budget');
    expect(nextStep('time_budget', {})).toBe('equipment');
  });

  it('Rand: vor dem ersten und nach dem letzten Schritt gibt es nichts', () => {
    expect(previousStep('sex', full)).toBeNull();
    expect(nextStep('cooking', full)).toBeNull();
  });

  it('Körperdaten → Umfänge → Gesundheits-Check', () => {
    expect(nextStep('body_metrics', full)).toBe('body_measurements');
    expect(nextStep('body_measurements', full)).toBe('health_screening');
    expect(previousStep('health_screening', full)).toBe('body_measurements');
  });
});

describe('progress', () => {
  it('Schritt 1 von 11 und 11 von 11 im vollen Ablauf', () => {
    expect(progress('sex', full)).toEqual({ current: 1, total: 11, fraction: 1 / 11 });
    expect(progress('cooking', full)).toEqual({ current: 11, total: 11, fraction: 1 });
  });

  it('zählt im kürzesten Ablauf nur anwendbare Schritte', () => {
    expect(progress('experience', noConsentGym)).toEqual({ current: 3, total: 7, fraction: 3 / 7 });
  });

  it('ein nicht anwendbarer Schritt zählt wie der nächste anwendbare', () => {
    expect(progress('equipment', noConsentGym)).toEqual(progress('nutrition', noConsentGym));
  });

  it('formatiert „Schritt X von Y“', () => {
    expect(formatProgressDe(progress('goal', full))).toBe('Schritt 7 von 11');
  });
});

describe('resumeStep', () => {
  it('startet bei leerem oder unbekanntem Wert vorne', () => {
    expect(resumeStep(null, full)).toBe('sex');
    expect(resumeStep(undefined, full)).toBe('sex');
    expect(resumeStep('wearable', full)).toBe('sex');
  });

  it('setzt am gespeicherten Schritt fort', () => {
    expect(resumeStep('goal', full)).toBe('goal');
  });

  it('springt weiter, wenn der gespeicherte Schritt nicht mehr passt', () => {
    expect(resumeStep('equipment', noConsentGym)).toBe('nutrition');
    expect(resumeStep('body_metrics', noConsentGym)).toBe('experience');
    // Alter Stand vor Etappe B2: „Trainingsort“ gespeichert → weiter beim nächsten anwendbaren Schritt.
    expect(resumeStep('training_location', full)).toBe('equipment');
    expect(resumeStep('training_location', noConsentGym)).toBe('nutrition');
  });

  it('erkennt Schritt-IDs', () => {
    expect(isOnboardingStep('cooking')).toBe(true);
    expect(isOnboardingStep('welcome')).toBe(false);
    expect(isOnboardingStep(3)).toBe(false);
  });
});

describe('Schritt nutrition_setup (docs/PLAN-PHASE-5.md 8.1, R2-S3, W21)', () => {
  it('steht direkt nach „cooking“ in ONBOARDING_STEPS (CHECK-Liste, W16)', () => {
    expect(ONBOARDING_STEPS.indexOf('nutrition_setup')).toBe(
      ONBOARDING_STEPS.indexOf('cooking') + 1,
    );
    expect(ONBOARDING_STEPS.at(-1)).toBe('nutrition_setup');
  });

  it('Supabase-Modus (nicht gesetzt bzw. false): nicht anwendbar, Liste ohne den Schritt, Ende nach „cooking“', () => {
    for (const state of [full, noConsentGym, {}, { ...full, nutritionSetupAvailable: false }]) {
      expect(isStepApplicable('nutrition_setup', state)).toBe(false);
      expect(applicableSteps(state)).not.toContain('nutrition_setup');
      expect(nextStep('cooking', state)).toBeNull();
    }
  });

  it('Supabase-Modus: gespeicherter Schritt nutrition_setup → resumeStep springt weiter (fertig)', () => {
    expect(resumeStep('nutrition_setup', full)).toBeNull();
    expect(resumeStep('nutrition_setup', {})).toBeNull();
  });

  it('Testmodus (true): anwendbar, letzter Schritt nach „cooking“, Fortschritt zählt ihn mit', () => {
    expect(isStepApplicable('nutrition_setup', fullTestMode)).toBe(true);
    expect(applicableSteps(fullTestMode)).toEqual([...ALL_SHOWN, 'nutrition_setup']);
    expect(nextStep('cooking', fullTestMode)).toBe('nutrition_setup');
    expect(nextStep('nutrition_setup', fullTestMode)).toBeNull();
    expect(previousStep('nutrition_setup', fullTestMode)).toBe('cooking');
    expect(resumeStep('nutrition_setup', fullTestMode)).toBe('nutrition_setup');
    expect(progress('nutrition_setup', fullTestMode)).toEqual({
      current: 12,
      total: 12,
      fraction: 1,
    });
    // Auch ohne Einwilligung (kein Gesundheitsdatum): Schritt bleibt anwendbar.
    expect(
      isStepApplicable('nutrition_setup', { ...noConsentGym, nutritionSetupAvailable: true }),
    ).toBe(true);
  });
});

describe('Schritt weight_goal (docs/PLAN-ZIELE.md 6 Nr. 2, Etappe Z3, Wächter K4)', () => {
  it('steht direkt nach „goal“ und gehört zu den Gesundheitsdaten-Schritten', () => {
    expect(ONBOARDING_STEPS.indexOf('weight_goal')).toBe(ONBOARDING_STEPS.indexOf('goal') + 1);
    expect(HEALTH_DATA_STEPS).toContain('weight_goal');
  });

  it('bis Etappe Z4 abgeschaltet: nie anwendbar, auch mit Abnehmen und Einwilligung', () => {
    expect(WEIGHT_GOAL_STEP_ENABLED).toBe(false);
    for (const state of [
      full,
      fullTestMode,
      {},
      { ...full, losesWeight: true },
      { ...fullTestMode, losesWeight: true },
    ]) {
      expect(isStepApplicable('weight_goal', state)).toBe(false);
      expect(applicableSteps(state)).not.toContain('weight_goal');
      expect(nextStep('goal', state)).toBe('time_budget');
      expect(previousStep('time_budget', state)).toBe('goal');
    }
  });

  it('gespeicherter Schritt weight_goal (alter bzw. künftiger Stand) → resumeStep geht beim nächsten weiter', () => {
    expect(resumeStep('weight_goal', full)).toBe('time_budget');
    expect(progress('weight_goal', full)).toEqual(progress('time_budget', full));
  });
});
