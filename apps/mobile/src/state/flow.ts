import {
  activeConsentVersion,
  hasValidConsent,
  isMeasurementDue,
  missingRequiredConsents,
  needsReconsent,
  ONBOARDING_STEPS,
  type OnboardingState,
  type OnboardingStep,
  resumeStep,
} from '@fitnessapp/core';

import { consentRecordsFromRows, type ConsentVersions } from '../data/mapping';
import type { AuthSession, UserRows } from '../data/types';

/**
 * Ablaufsteuerung der App (welcher Bildschirm als Nächstes). Reine Funktionen auf Basis der Regeln aus
 * packages/core (onboarding.ts, consent.ts) – getestet in flow.test.ts.
 */

export type HealthConsentStatus =
  /** gültig in der aktuellen Version */
  | 'valid'
  /** erteilt, aber für eine ältere Textversion → neu einwilligen (needsReconsent) */
  | 'outdated'
  /** nie erteilt oder widerrufen */
  | 'none';

export function healthConsentStatus(
  rows: UserRows,
  versions: ConsentVersions,
): HealthConsentStatus {
  const records = consentRecordsFromRows(rows.consents);
  if (hasValidConsent(records, 'health_data', versions.health_data)) {
    return 'valid';
  }
  const active = activeConsentVersion(records, 'health_data');
  if (active !== null && needsReconsent(active, versions.health_data)) {
    return 'outdated';
  }
  return 'none';
}

/**
 * Stand für die Onboarding-Logik in packages/core: Einwilligung health_data
 * - true: gültig,
 * - false: bewusst ohne Einwilligung weiter (Profil steht hinter dem Einwilligungs-Schritt) oder widerrufen,
 * - undefined: noch nicht gefragt.
 */
export function deriveOnboardingState(rows: UserRows, versions: ConsentVersions): OnboardingState {
  const status = healthConsentStatus(rows, versions);
  const saved = rows.profile?.onboarding_step;
  const pastConsentStep =
    rows.profile?.onboarding_completed_at != null ||
    (saved != null &&
      ONBOARDING_STEPS.indexOf(saved as OnboardingStep) >
        ONBOARDING_STEPS.indexOf('health_consent'));
  const healthDataConsent = status === 'valid' ? true : pastConsentStep ? false : undefined;
  return {
    healthDataConsent,
    trainingLocation: rows.goals?.training_location ?? undefined,
  };
}

export type EntryRoute =
  '/welcome' | '/age' | '/consents' | '/done' | '/today' | `/onboarding/${OnboardingStep}`;

export function stepRoute(step: OnboardingStep): EntryRoute {
  return `/onboarding/${step}`;
}

/** Bildschirm beim Start bzw. nach jeder Anmeldung. */
export function resolveEntryRoute(input: {
  session: AuthSession | null;
  rows: UserRows | null;
  versions: ConsentVersions;
}): EntryRoute {
  const { session, rows, versions } = input;
  if (!session) {
    return '/welcome';
  }
  if (!rows?.profile) {
    return '/age';
  }
  if (missingRequiredConsents(consentRecordsFromRows(rows.consents), versions).length > 0) {
    return '/consents';
  }
  if (rows.profile.onboarding_completed_at == null) {
    const step = resumeStep(rows.profile.onboarding_step, deriveOnboardingState(rows, versions));
    return step === null ? '/done' : stepRoute(step);
  }
  return '/today';
}

/** Ist die Mess-Erinnerung heute fällig? */
export function isReminderDue(rows: UserRows, today: string): boolean {
  const reminder = rows.reminder;
  return Boolean(
    reminder?.enabled && reminder.next_due_on && isMeasurementDue(reminder.next_due_on, today),
  );
}

/** Datum der letzten Körperumfang-Messung (für nextMeasurementDue), null = noch keine. */
export function lastMeasurementDate(rows: UserRows): string | null {
  const dates = rows.bodyMeasurements.map((row) => row.measured_on).sort();
  return dates.at(-1) ?? null;
}
