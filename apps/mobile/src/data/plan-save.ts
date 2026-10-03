import { nextStep, type OnboardingState } from '@fitnessapp/core';

import { deriveOnboardingState, healthConsentStatus } from '../state/flow';
import { applyStepToAnswers, planStepWrites, type ConsentVersions } from './mapping';
import type { ConsentPlatform, OnboardingAnswers, StepSave, UserRows } from './types';
import type { WriteOp } from './write-ops';

export interface PlannedSave {
  ops: WriteOp[];
  answers: OnboardingAnswers;
  /** Nächster Schritt; null = Onboarding fertig. */
  next: ReturnType<typeof nextStep>;
}

/**
 * Plant das Speichern eines Onboarding-Schritts: neue Antworten, nächster Schritt (packages/core) und die
 * Schreib-Vorgänge. Wird von beiden Betriebsarten genutzt.
 */
export function planSave(
  save: StepSave,
  input: {
    userId: string;
    answers: OnboardingAnswers;
    rows: UserRows;
    versions: ConsentVersions;
    platform: ConsentPlatform;
    now: string;
  },
): PlannedSave {
  const answers = applyStepToAnswers(input.answers, save);
  const hasHealthConsent = healthConsentStatus(input.rows, input.versions) === 'valid';
  const before = deriveOnboardingState(input.rows, input.versions);
  const after: OnboardingState = {
    healthDataConsent:
      save.step === 'health_consent' ? save.granted || hasHealthConsent : before.healthDataConsent,
    trainingLocation:
      save.step === 'training_location' ? save.trainingLocation : before.trainingLocation,
  };
  const next = nextStep(save.step, after);
  const ops = planStepWrites(save, {
    userId: input.userId,
    answers,
    nextStep: next,
    now: input.now,
    platform: input.platform,
    versions: input.versions,
    hasHealthConsent,
    reminderIntervalDays: input.rows.reminder?.interval_days,
  });
  return { ops, answers, next };
}
