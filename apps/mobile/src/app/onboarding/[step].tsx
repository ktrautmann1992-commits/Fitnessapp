import { isOnboardingStep, isStepApplicable, type OnboardingStep } from '@fitnessapp/core';
import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import type { ComponentType } from 'react';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/app-state';
import { deriveOnboardingState } from '@/state/flow';
import { BodyMeasurementsStep, BodyMetricsStep, HealthScreeningStep } from '@/steps/health-steps';
import { CookingStep, NutritionStep } from '@/steps/nutrition-steps';
import { ExperienceStep, HealthConsentStep, SexStep } from '@/steps/profile-steps';
import { EquipmentStep, GoalStep, TrainingScheduleStep } from '@/steps/training-steps';
import { useStep, type StepController } from '@/steps/use-step';

/** „training_location“ ist seit Etappe B2 nie anwendbar (Ort aus den Trainingstagen abgeleitet). */
type ShownStep = Exclude<OnboardingStep, 'training_location'>;

const STEP_SCREENS: Record<ShownStep, ComponentType<{ ctl: StepController }>> = {
  sex: SexStep,
  health_consent: HealthConsentStep,
  body_metrics: BodyMetricsStep,
  body_measurements: BodyMeasurementsStep,
  health_screening: HealthScreeningStep,
  experience: ExperienceStep,
  goal: GoalStep,
  time_budget: TrainingScheduleStep,
  equipment: EquipmentStep,
  nutrition: NutritionStep,
  cooking: CookingStep,
};

/** Onboarding-Schritte 1–11 (Reihenfolge und Bedingungen aus packages/core/src/onboarding.ts). */
export default function OnboardingStepRoute() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const app = useApp();

  if (app.status.kind === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (app.status.kind === 'error') {
    return (
      <Screen>
        <ErrorState message={t.errors.loadFailed} onRetry={() => void app.reload()} />
      </Screen>
    );
  }
  if (!isOnboardingStep(step) || !app.session || !app.rows?.profile) {
    return <Redirect href="/" />;
  }
  // Nicht anwendbare Schritte (z. B. Körperdaten ohne Einwilligung) gibt es nicht – zurück zum Startpunkt.
  if (
    step === 'training_location' ||
    !isStepApplicable(step, deriveOnboardingState(app.rows, app.versions))
  ) {
    return <Redirect href={app.entryRoute() as Href} />;
  }
  return <StepHost key={step} step={step} />;
}

function StepHost({ step }: { step: ShownStep }) {
  const ctl = useStep(step);
  const StepScreen = STEP_SCREENS[step];
  return <StepScreen ctl={ctl} />;
}
