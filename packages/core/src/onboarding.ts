import { z } from 'zod';

import type { TrainingLocation } from './enums';

/**
 * Onboarding-Ablauf nach der Anmeldung (docs/PLAN-PHASE-1.md Abschnitt 3, ohne Wearable-Schritt – Frage 8).
 *
 * Vor diesen Schritten liegen Willkommen → Alter → Konto anlegen → Grund-Einwilligungen (PRE_ACCOUNT_STEPS);
 * sie zählen nicht zum Fortschritt, weil vor dem Konto nichts gespeichert wird.
 *
 * Die Liste steht identisch als CHECK-Bedingung von profiles.onboarding_step in der Datenbank
 * (geprüft in db-sync.test.ts).
 */
export const ONBOARDING_STEPS = [
  'sex',
  'health_consent',
  'body_metrics',
  'body_measurements',
  'health_screening',
  'experience',
  'goal',
  'time_budget',
  'training_location',
  'equipment',
  'nutrition',
  'cooking',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStepSchema = z.enum(ONBOARDING_STEPS);

/**
 * Bildschirme vor dem Onboarding (ohne Fortschrittsanzeige), in dieser Reihenfolge:
 * 1. welcome, 2. age – Geburtsdatum nur lokal prüfen (createBirthDateSchema), unter 16 Stopp, nichts speichern,
 * 3. account – Login per E-Mail-Code; DIREKT danach das Profil mit dem Geburtsdatum anlegen
 *    (profiles-Zeile; die Datenbank prüft das Mindestalter erneut),
 * 4. base_consents – erst jetzt AGB/Datenschutz speichern: Die Datenbank lässt Einwilligungen und alle
 *    weiteren Nutzerdaten nur zu, wenn ein Profil existiert.
 */
export const PRE_ACCOUNT_STEPS = ['welcome', 'age', 'account', 'base_consents'] as const;
export type PreAccountStep = (typeof PRE_ACCOUNT_STEPS)[number];

/** Schritte, die man mit „Überspringen“ auslassen darf (Erweiterungsbeschluss: Körperumfänge). */
export const SKIPPABLE_STEPS = ['body_measurements'] as const satisfies readonly OnboardingStep[];

/** Schritte, die Gesundheitsdaten speichern und deshalb die Einwilligung health_data brauchen. */
export const HEALTH_DATA_STEPS = [
  'body_metrics',
  'body_measurements',
  'health_screening',
] as const satisfies readonly OnboardingStep[];

/**
 * Bisherige Antworten, die den Ablauf beeinflussen. `undefined` = noch nicht beantwortet; dann wird der
 * abhängige Schritt vorsichtshalber mitgezählt (die Gesamtzahl kann später kleiner werden).
 */
export interface OnboardingState {
  /** Einwilligung health_data erteilt? Ohne sie: keine Körperdaten, keine Umfänge, kein Gesundheits-Check. */
  healthDataConsent?: boolean | undefined;
  /** Trainingsort. Equipment-Schritt nur bei „home“ oder „both“. */
  trainingLocation?: TrainingLocation | undefined;
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return onboardingStepSchema.safeParse(value).success;
}

export function isStepSkippable(step: OnboardingStep): boolean {
  return (SKIPPABLE_STEPS as readonly OnboardingStep[]).includes(step);
}

/** Wird dieser Schritt bei diesem Stand gezeigt? */
export function isStepApplicable(step: OnboardingStep, state: OnboardingState): boolean {
  if ((HEALTH_DATA_STEPS as readonly OnboardingStep[]).includes(step)) {
    return state.healthDataConsent !== false;
  }
  if (step === 'equipment') {
    return state.trainingLocation !== 'gym';
  }
  return true;
}

/** Alle Schritte, die bei diesem Stand gezeigt werden, in Reihenfolge. */
export function applicableSteps(state: OnboardingState): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((step) => isStepApplicable(step, state));
}

export function firstStep(state: OnboardingState): OnboardingStep {
  // „sex“ ist immer anwendbar.
  return applicableSteps(state)[0] ?? 'sex';
}

/** Nächster anwendbarer Schritt; null = Onboarding fertig (Bildschirm „Fertig“). */
export function nextStep(step: OnboardingStep, state: OnboardingState): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS.slice(index + 1).find((s) => isStepApplicable(s, state)) ?? null;
}

/** Vorheriger anwendbarer Schritt; null = erster Schritt (zurück führt aus dem Onboarding heraus). */
export function previousStep(step: OnboardingStep, state: OnboardingState): OnboardingStep | null {
  const index = ONBOARDING_STEPS.indexOf(step);
  return (
    ONBOARDING_STEPS.slice(0, index)
      .reverse()
      .find((s) => isStepApplicable(s, state)) ?? null
  );
}

/**
 * Schritt, an dem nach einer Unterbrechung weitergemacht wird (profiles.onboarding_step).
 * Unbekannter/leerer Wert → erster Schritt. Ist der gespeicherte Schritt inzwischen nicht mehr anwendbar
 * (z. B. Equipment, aber Ort jetzt „Studio“), geht es beim nächsten anwendbaren weiter; null = fertig.
 */
export function resumeStep(
  saved: string | null | undefined,
  state: OnboardingState,
): OnboardingStep | null {
  if (!isOnboardingStep(saved)) {
    return firstStep(state);
  }
  return isStepApplicable(saved, state) ? saved : nextStep(saved, state);
}

export interface OnboardingProgress {
  /** 1-basiert: „Schritt current von total“. */
  current: number;
  total: number;
  /** Anteil für den Fortschrittsbalken (0 < fraction ≤ 1). */
  fraction: number;
}

/**
 * Fortschritt für die Anzeige „Schritt X von Y“. Ein nicht anwendbarer Schritt zählt wie der nächste
 * anwendbare; danach (fertig) ist der Fortschritt vollständig.
 */
export function progress(step: OnboardingStep, state: OnboardingState): OnboardingProgress {
  const steps = applicableSteps(state);
  const total = steps.length;
  const resolved = isStepApplicable(step, state) ? step : nextStep(step, state);
  const current = resolved === null ? total : steps.indexOf(resolved) + 1;
  return { current, total, fraction: current / total };
}

/** Text für die Fortschrittsanzeige, z. B. „Schritt 4 von 12“. */
export function formatProgressDe({ current, total }: OnboardingProgress): string {
  return `Schritt ${current} von ${total}`;
}
