import { hasHomeStrength, nextStep, type OnboardingState } from '@fitnessapp/core';

import { deriveOnboardingState, healthConsentStatus } from '../state/flow';
import { applyStepToAnswers, losesWeight, planStepWrites, type ConsentVersions } from './mapping';
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
    /** Speicherort für `nutrition_setup` (Testmodus ja, Supabase erst ab N7 – R2-S3). */
    nutritionSetupAvailable: boolean;
  },
): PlannedSave {
  const answers = applyStepToAnswers(input.answers, save);
  const hasHealthConsent = healthConsentStatus(input.rows, input.versions) === 'valid';
  const before = deriveOnboardingState(input.rows, input.versions, input.nutritionSetupAvailable);
  const after: OnboardingState = {
    nutritionSetupAvailable: input.nutritionSetupAvailable,
    healthDataConsent:
      save.step === 'health_consent' ? save.granted || hasHealthConsent : before.healthDataConsent,
    hasHomeStrength:
      save.step === 'time_budget' ? hasHomeStrength(save.schedule) : before.hasHomeStrength,
    losesWeight: save.step === 'goal' ? losesWeight(save.goal) : before.losesWeight,
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
    onboardingCompleted: input.rows.profile?.onboarding_completed_at != null,
  });
  return { ops, answers, next };
}
