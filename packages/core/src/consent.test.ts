import { describe, expect, it } from 'vitest';

import {
  activeConsentVersion,
  type ConsentRecord,
  consentRecordSchema,
  CURRENT_CONSENT_VERSIONS,
  foodPreferenceRequiresHealthConsent,
  hasValidConsent,
  missingRequiredConsents,
  needsReconsent,
} from './consent';

const granted = (
  consentType: ConsentRecord['consentType'],
  version: number,
  revokedAt: string | null = null,
): ConsentRecord => ({
  consentType,
  version,
  grantedAt: '2026-10-03T10:00:00+00:00',
  revokedAt,
});

describe('needsReconsent', () => {
  it('fragt, wenn noch nie zugestimmt wurde', () => {
    expect(needsReconsent(null, 1)).toBe(true);
    expect(needsReconsent(undefined, 1)).toBe(true);
  });

  it('fragt erneut bei neuer Textversion', () => {
    expect(needsReconsent(1, 2)).toBe(true);
  });

  it('fragt nicht, wenn die aktuelle Version erteilt ist', () => {
    expect(needsReconsent(2, 2)).toBe(false);
  });

  it('fragt nicht, wenn es (noch) keinen Text gibt', () => {
    expect(needsReconsent(null, null)).toBe(false);
  });

  it('fragt nicht, wenn die App veraltet ist (Datenbank kennt schon eine neuere Version)', () => {
    expect(needsReconsent(3, 2)).toBe(false);
  });
});

describe('activeConsentVersion / hasValidConsent', () => {
  it('ignoriert widerrufene Einwilligungen und andere Arten', () => {
    const records = [granted('health_data', 1, '2026-10-04T10:00:00+00:00'), granted('terms', 1)];
    expect(activeConsentVersion(records, 'health_data')).toBeNull();
    expect(hasValidConsent(records, 'health_data')).toBe(false);
    expect(hasValidConsent(records, 'terms')).toBe(true);
  });

  it('nimmt die höchste aktive Version', () => {
    const records = [granted('health_data', 1), granted('health_data', 2)];
    expect(activeConsentVersion(records, 'health_data')).toBe(2);
  });

  it('gültig nur in genau der aktuellen Version (wie die Datenbank)', () => {
    expect(hasValidConsent([granted('health_data', 1)], 'health_data', 2)).toBe(false);
    expect(hasValidConsent([granted('health_data', 2)], 'health_data', 2)).toBe(true);
  });

  it('cycle_data ist in Phase 1 nie gültig (kein Text)', () => {
    expect(CURRENT_CONSENT_VERSIONS.cycle_data).toBeNull();
    expect(hasValidConsent([granted('cycle_data', 1)], 'cycle_data')).toBe(false);
  });
});

describe('missingRequiredConsents', () => {
  it('listet fehlende Pflicht-Einwilligungen', () => {
    expect(missingRequiredConsents([])).toEqual(['terms', 'privacy']);
    expect(missingRequiredConsents([granted('terms', 1)])).toEqual(['privacy']);
    expect(missingRequiredConsents([granted('terms', 1), granted('privacy', 1)])).toEqual([]);
  });

  it('health_data ist keine Pflicht', () => {
    expect(missingRequiredConsents([granted('terms', 1), granted('privacy', 1)])).not.toContain(
      'health_data',
    );
  });

  it('neue AGB-Version → erneut fragen', () => {
    const versions = { ...CURRENT_CONSENT_VERSIONS, terms: 2 };
    expect(missingRequiredConsents([granted('terms', 1), granted('privacy', 1)], versions)).toEqual(
      ['terms'],
    );
  });
});

describe('Sonstiges', () => {
  it('nur Unverträglichkeiten brauchen die Gesundheits-Einwilligung', () => {
    expect(foodPreferenceRequiresHealthConsent('intolerance')).toBe(true);
    expect(foodPreferenceRequiresHealthConsent('like')).toBe(false);
    expect(foodPreferenceRequiresHealthConsent('dislike')).toBe(false);
  });

  it('prüft Datensätze aus der Datenbank', () => {
    expect(consentRecordSchema.safeParse(granted('privacy', 1)).success).toBe(true);
    expect(consentRecordSchema.safeParse({ ...granted('privacy', 1), version: 0 }).success).toBe(
      false,
    );
    expect(
      consentRecordSchema.safeParse({ ...granted('privacy', 1), consentType: 'marketing' }).success,
    ).toBe(false);
  });
});
