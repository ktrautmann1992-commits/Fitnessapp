import {
  previousStep,
  progress as stepProgress,
  type OnboardingProgress,
  type OnboardingStep,
} from '@fitnessapp/core';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import type { StepSave } from '@/data/types';
import { errorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import { useApp, type AppContextValue } from '@/state/app-state';
import { deriveOnboardingState, stepRoute } from '@/state/flow';

export interface StepController {
  app: AppContextValue;
  step: OnboardingStep;
  progress: OnboardingProgress;
  today: string;
  saving: boolean;
  error: string | undefined;
  setError: (message: string | undefined) => void;
  goBack: (() => void) | undefined;
  submit: (save: StepSave) => Promise<void>;
}

/** Gemeinsame Steuerung eines Onboarding-Schritts: Fortschritt, Zurück, Speichern + Weiter. */
export function useStep(step: OnboardingStep): StepController {
  const app = useApp();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const state = app.rows
    ? deriveOnboardingState(app.rows, app.versions)
    : { healthDataConsent: undefined, hasHomeStrength: undefined };
  const previous = previousStep(step, state);

  async function submit(save: StepSave) {
    setSaving(true);
    setError(undefined);
    try {
      const route = await app.saveStep(save);
      router.replace(route as Href);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  }

  return {
    app,
    step,
    progress: stepProgress(step, state),
    today: todayIso(),
    saving,
    error,
    setError,
    goBack: previous ? () => router.replace(stepRoute(previous) as Href) : undefined,
    submit,
  };
}
