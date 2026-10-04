import {
  previousStep,
  progress as stepProgress,
  type OnboardingProgress,
  type OnboardingStep,
} from '@fitnessapp/core';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';

import type { StepSave } from '@/data/types';
import { errorText } from '@/lib/error-text';
import { todayIso } from '@/lib/format';
import { useApp, type AppContextValue } from '@/state/app-state';
import { deriveOnboardingState, nextEditRoute, stepRoute } from '@/state/flow';

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
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1' && app.rows?.profile?.onboarding_completed_at != null;
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
      if (editing) {
        const target = nextEditRoute(step, save);
        // Zurück zum vorhandenen „Heute“ (nicht ein zweites darüberlegen); sonst nächster Schritt.
        if (target === '/today') {
          router.dismissTo('/today');
        } else {
          router.replace(target as Href);
        }
      } else {
        router.replace(route as Href);
      }
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
    goBack: editing
      ? () => (router.canGoBack() ? router.back() : router.replace('/settings'))
      : previous
        ? () => router.replace(stepRoute(previous) as Href)
        : undefined,
    submit,
  };
}
