import {
  activeConsentVersion,
  hasHomeStrength,
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
import type { AuthSession, StepSave, UserRows } from '../data/types';

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
  // Equipment-Schritt nur mit mindestens einem Tag „Kraft zu Hause“; noch keine Trainingstage = offen.
  const slots = rows.trainingSlots;
  return {
    healthDataConsent,
    hasHomeStrength:
      slots.length > 0 ? slots.some((slot) => slot.kind === 'strength_home') : undefined,
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

/**
 * „Angaben ändern“ aus den Einstellungen (docs/PLAN-PHASE-3.md 10.4): dieselben Schritte nacheinander, danach
 * zurück zu „Heute“ (dort „Plan neu erstellen?“). Equipment nur mit „Kraft zu Hause“; der Gesundheits-Check
 * („wiederholen“) führt direkt zurück.
 */
const EDIT_CHAIN = ['experience', 'goal', 'time_budget', 'equipment'] as const;

export function nextEditRoute(
  step: OnboardingStep,
  save: StepSave,
): EntryRoute | `${EntryRoute}?edit=1` {
  const index = (EDIT_CHAIN as readonly string[]).indexOf(step);
  if (index < 0 || index === EDIT_CHAIN.length - 1) return '/today';
  const next = EDIT_CHAIN[index + 1];
  if (next === 'equipment' && !(save.step === 'time_budget' && hasHomeStrength(save.schedule))) {
    return '/today';
  }
  return `${stepRoute(next as OnboardingStep)}?edit=1`;
}
