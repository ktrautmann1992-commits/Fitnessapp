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
  /**
   * Einzelner Schritt aus „Dein Abnehm-Ziel“ bzw. einer Karte auf „Heute“ (Etappe Z5): nach dem Speichern zurück
   * dorthin statt weiter in der Kette von „Angaben ändern“. null = normale Kette.
   */
  returnTo: SingleStepReturn | null;
}

/** Erlaubte Rücksprung-Ziele eines einzeln geöffneten Schritts (`?zurueck=…`, feste Liste – kein freier Pfad). */
export const SINGLE_STEP_RETURNS = { abnehmziel: '/abnehmziel', heute: '/today' } as const;
export type SingleStepReturn = (typeof SINGLE_STEP_RETURNS)[keyof typeof SINGLE_STEP_RETURNS];

export function singleStepReturn(value: string | undefined): SingleStepReturn | null {
  return value !== undefined && Object.hasOwn(SINGLE_STEP_RETURNS, value)
    ? SINGLE_STEP_RETURNS[value as keyof typeof SINGLE_STEP_RETURNS]
    : null;
}

/** Gemeinsame Steuerung eines Onboarding-Schritts: Fortschritt, Zurück, Speichern + Weiter. */
export function useStep(step: OnboardingStep): StepController {
  const app = useApp();
  const router = useRouter();
  const { edit, zurueck } = useLocalSearchParams<{ edit?: string; zurueck?: string }>();
  const editing = edit === '1' && app.rows?.profile?.onboarding_completed_at != null;
  const returnTo = editing ? singleStepReturn(zurueck) : null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const state = app.rows
    ? deriveOnboardingState(app.rows, app.versions, app.backend.supportsNutrition)
    : {
        healthDataConsent: undefined,
        hasHomeStrength: undefined,
        nutritionSetupAvailable: app.backend.supportsNutrition,
      };
  const previous = previousStep(step, state);

  async function submit(save: StepSave) {
    setSaving(true);
    setError(undefined);
    try {
      const route = await app.saveStep(save);
      if (returnTo !== null) {
        router.dismissTo(returnTo as Href);
      } else if (editing) {
        const target = nextEditRoute(
          step,
          save,
          app.backend.supportsNutrition,
          state.healthDataConsent === true,
        );
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
    returnTo,
  };
}
