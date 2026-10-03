import { describe, expect, it } from 'vitest';

import {
  applicableSteps,
  firstStep,
  formatProgressDe,
  isOnboardingStep,
  isStepSkippable,
  nextStep,
  ONBOARDING_STEPS,
  type OnboardingState,
  previousStep,
  progress,
  resumeStep,
} from './onboarding';

const full: OnboardingState = { healthDataConsent: true, trainingLocation: 'both' };
const noConsentGym: OnboardingState = { healthDataConsent: false, trainingLocation: 'gym' };

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

  it('mit Einwilligung und Zuhause/beides: alle 12 Schritte', () => {
    expect(applicableSteps(full)).toEqual([...ONBOARDING_STEPS]);
    expect(applicableSteps({ healthDataConsent: true, trainingLocation: 'home' })).toHaveLength(12);
  });

  it('ohne Einwilligung: keine Körperdaten, keine Umfänge, kein Gesundheits-Check', () => {
    const steps = applicableSteps({ healthDataConsent: false, trainingLocation: 'home' });
    expect(steps).not.toContain('body_metrics');
    expect(steps).not.toContain('body_measurements');
    expect(steps).not.toContain('health_screening');
    expect(steps).toContain('health_consent');
    expect(steps).toHaveLength(9);
  });

  it('nur Studio: kein Equipment-Schritt', () => {
    expect(applicableSteps({ healthDataConsent: true, trainingLocation: 'gym' })).not.toContain(
      'equipment',
    );
  });

  it('kürzester Ablauf (ohne Einwilligung, nur Studio): 8 Schritte', () => {
    expect(applicableSteps(noConsentGym)).toEqual([
      'sex',
      'health_consent',
      'experience',
      'goal',
      'time_budget',
      'training_location',
      'nutrition',
      'cooking',
    ]);
  });

  it('noch unbeantwortete Fragen zählen die abhängigen Schritte mit', () => {
    expect(applicableSteps({})).toHaveLength(12);
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
    expect(visited).toEqual([...ONBOARDING_STEPS]);
  });

  it('überspringt Gesundheits-Schritte ohne Einwilligung', () => {
    expect(nextStep('health_consent', noConsentGym)).toBe('experience');
    expect(previousStep('experience', noConsentGym)).toBe('health_consent');
  });

  it('überspringt Equipment bei „nur Studio“', () => {
    expect(nextStep('training_location', noConsentGym)).toBe('nutrition');
    expect(previousStep('nutrition', noConsentGym)).toBe('training_location');
    expect(nextStep('training_location', full)).toBe('equipment');
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
  it('Schritt 1 von 12 und 12 von 12 im vollen Ablauf', () => {
    expect(progress('sex', full)).toEqual({ current: 1, total: 12, fraction: 1 / 12 });
    expect(progress('cooking', full)).toEqual({ current: 12, total: 12, fraction: 1 });
  });

  it('zählt im kürzesten Ablauf nur anwendbare Schritte', () => {
    expect(progress('experience', noConsentGym)).toEqual({ current: 3, total: 8, fraction: 3 / 8 });
  });

  it('ein nicht anwendbarer Schritt zählt wie der nächste anwendbare', () => {
    expect(progress('equipment', noConsentGym)).toEqual(progress('nutrition', noConsentGym));
  });

  it('formatiert „Schritt X von Y“', () => {
    expect(formatProgressDe(progress('goal', full))).toBe('Schritt 7 von 12');
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
  });

  it('erkennt Schritt-IDs', () => {
    expect(isOnboardingStep('cooking')).toBe(true);
    expect(isOnboardingStep('welcome')).toBe(false);
    expect(isOnboardingStep(3)).toBe(false);
  });
});
