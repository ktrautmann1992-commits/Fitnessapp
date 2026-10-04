import { describe, expect, it } from 'vitest';

import { consent, NOW, profile, rowsWith, VERSIONS } from '../test/fixtures';
import {
  deriveOnboardingState,
  healthConsentStatus,
  isReminderDue,
  lastMeasurementDate,
  resolveEntryRoute,
} from './flow';

const session = { userId: 'u', email: null };
const base = [consent('terms'), consent('privacy')];

describe('resolveEntryRoute', () => {
  it('ohne Sitzung → Willkommen, ohne Profil → Alter, ohne AGB/Datenschutz → Einwilligungen', () => {
    expect(resolveEntryRoute({ session: null, rows: null, versions: VERSIONS })).toBe('/welcome');
    expect(resolveEntryRoute({ session, rows: null, versions: VERSIONS })).toBe('/age');
    expect(resolveEntryRoute({ session, rows: rowsWith(), versions: VERSIONS })).toBe('/consents');
    expect(
      resolveEntryRoute({
        session,
        rows: rowsWith({ consents: [consent('terms')] }),
        versions: VERSIONS,
      }),
    ).toBe('/consents');
  });

  it('neue Textversion der AGB → erneut zu den Einwilligungen', () => {
    expect(
      resolveEntryRoute({
        session,
        rows: rowsWith({ consents: base, profile: profile({ onboarding_completed_at: NOW }) }),
        versions: { ...VERSIONS, terms: 2 },
      }),
    ).toBe('/consents');
  });

  it('Fortsetzen am gespeicherten Schritt; unbekannt → erster Schritt', () => {
    expect(
      resolveEntryRoute({ session, rows: rowsWith({ consents: base }), versions: VERSIONS }),
    ).toBe('/onboarding/sex');
    expect(
      resolveEntryRoute({
        session,
        rows: rowsWith({ consents: base, profile: profile({ onboarding_step: 'goal' }) }),
        versions: VERSIONS,
      }),
    ).toBe('/onboarding/goal');
  });

  it('Gesundheits-Schritt ohne Einwilligung wird übersprungen', () => {
    expect(
      resolveEntryRoute({
        session,
        rows: rowsWith({ consents: base, profile: profile({ onboarding_step: 'body_metrics' }) }),
        versions: VERSIONS,
      }),
    ).toBe('/onboarding/experience');
  });

  it('fertig → Heute', () => {
    expect(
      resolveEntryRoute({
        session,
        rows: rowsWith({ consents: base, profile: profile({ onboarding_completed_at: NOW }) }),
        versions: VERSIONS,
      }),
    ).toBe('/today');
  });
});

describe('Einwilligung health_data', () => {
  it('valid / outdated (needsReconsent) / none / widerrufen', () => {
    expect(healthConsentStatus(rowsWith({ consents: [consent('health_data')] }), VERSIONS)).toBe(
      'valid',
    );
    expect(
      healthConsentStatus(rowsWith({ consents: [consent('health_data')] }), {
        ...VERSIONS,
        health_data: 2,
      }),
    ).toBe('outdated');
    expect(healthConsentStatus(rowsWith(), VERSIONS)).toBe('none');
    expect(
      healthConsentStatus(
        rowsWith({ consents: [consent('health_data', { revoked_at: NOW })] }),
        VERSIONS,
      ),
    ).toBe('none');
  });

  it('Onboarding-Stand: undefined vor der Frage, false danach ohne Einwilligung', () => {
    expect(
      deriveOnboardingState(
        rowsWith({ profile: profile({ onboarding_step: 'health_consent' }) }),
        VERSIONS,
      ),
    ).toEqual({ healthDataConsent: undefined, hasHomeStrength: undefined });
    expect(
      deriveOnboardingState(
        rowsWith({ profile: profile({ onboarding_step: 'experience' }) }),
        VERSIONS,
      ).healthDataConsent,
    ).toBe(false);
    expect(
      deriveOnboardingState(
        rowsWith({
          profile: profile({ onboarding_step: 'sex' }),
          consents: [consent('health_data')],
        }),
        VERSIONS,
      ).healthDataConsent,
    ).toBe(true);
  });
});

describe('Equipment-Schritt nach den Trainingstagen', () => {
  const slot = (kind: 'strength_gym' | 'strength_home' | 'endurance', slot_no = 1) => ({
    user_id: 'u',
    slot_no,
    weekday: null,
    kind,
    minutes: 30,
  });

  it('nur mit mindestens einem Tag „Kraft zu Hause“; ohne Trainingstage noch offen', () => {
    const state = (trainingSlots: ReturnType<typeof slot>[]) =>
      deriveOnboardingState(rowsWith({ trainingSlots }), VERSIONS).hasHomeStrength;
    expect(state([])).toBeUndefined();
    expect(state([slot('strength_gym'), slot('endurance', 2)])).toBe(false);
    expect(state([slot('endurance'), slot('strength_home', 2)])).toBe(true);
  });

  it('alter Stand „Trainingsort“ springt weiter (Equipment bzw. Ernährung)', () => {
    const base = { profile: profile({ onboarding_step: 'training_location' }) };
    expect(
      resolveEntryRoute({
        session: { userId: 'u', email: null },
        rows: rowsWith({
          ...base,
          consents: [consent('terms'), consent('privacy')],
          trainingSlots: [slot('strength_home')],
        }),
        versions: VERSIONS,
      }),
    ).toBe('/onboarding/equipment');
    expect(
      resolveEntryRoute({
        session: { userId: 'u', email: null },
        rows: rowsWith({
          ...base,
          consents: [consent('terms'), consent('privacy')],
          trainingSlots: [slot('endurance')],
        }),
        versions: VERSIONS,
      }),
    ).toBe('/onboarding/nutrition');
  });
});

describe('Mess-Erinnerung', () => {
  it('fällig nur wenn eingeschaltet und Termin erreicht', () => {
    const reminder = { user_id: 'u', enabled: true, interval_days: 28, next_due_on: '2026-10-03' };
    expect(isReminderDue(rowsWith({ reminder }), '2026-10-03')).toBe(true);
    expect(isReminderDue(rowsWith({ reminder }), '2026-10-02')).toBe(false);
    expect(
      isReminderDue(rowsWith({ reminder: { ...reminder, enabled: false } }), '2026-10-05'),
    ).toBe(false);
    expect(
      isReminderDue(rowsWith({ reminder: { ...reminder, next_due_on: null } }), '2026-10-05'),
    ).toBe(false);
  });

  it('letztes Messdatum', () => {
    const m = (measured_on: string) => ({
      id: measured_on,
      user_id: 'u',
      measured_on,
      upper_arm_left_cm: null,
      upper_arm_right_cm: null,
      chest_cm: null,
      shoulders_cm: null,
      waist_cm: 80,
      abdomen_cm: null,
      thigh_left_cm: null,
      thigh_right_cm: null,
      hip_cm: null,
      calf_left_cm: null,
      calf_right_cm: null,
    });
    expect(lastMeasurementDate(rowsWith())).toBeNull();
    expect(
      lastMeasurementDate(rowsWith({ bodyMeasurements: [m('2026-09-01'), m('2026-10-01')] })),
    ).toBe('2026-10-01');
  });
});
