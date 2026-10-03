import { z } from 'zod';

import {
  CONSENT_PLATFORMS,
  CONSENT_TYPES,
  type ConsentType,
  type FoodPreferenceKind,
} from './enums';

/**
 * Einwilligungen (DSGVO Art. 7 und 9), docs/PLAN-PHASE-1.md Abschnitt 5.
 * Die Datenbank ist maßgeblich (public.current_consent_version / public.has_valid_consent); diese Funktionen
 * spiegeln die Regeln für die App, z. B. um vor dem Speichern erneut um Zustimmung zu bitten.
 */

export const consentTypeSchema = z.enum(CONSENT_TYPES);
export const consentPlatformSchema = z.enum(CONSENT_PLATFORMS);

/**
 * Aktuelle Textversion je Einwilligungsart (= höchste veröffentlichte Version in consent_documents).
 * null = es gibt noch keinen Text (cycle_data kommt mit dem Zyklus-Modul in Phase 9).
 * Bei einem neuen Text: neue Version per Migration einfügen UND hier hochzählen (db-sync.test.ts prüft das).
 */
export const CURRENT_CONSENT_VERSIONS: Readonly<Record<ConsentType, number | null>> = {
  terms: 1,
  privacy: 1,
  health_data: 1,
  cycle_data: null,
};

/** Ohne diese Einwilligungen ist keine Nutzung möglich (Onboarding-Schritt „Grund-Einwilligungen“). */
export const REQUIRED_CONSENT_TYPES = [
  'terms',
  'privacy',
] as const satisfies readonly ConsentType[];

/** Eine Zeile aus `consents`, wie die App sie liest. */
export const consentRecordSchema = z.object({
  consentType: consentTypeSchema,
  version: z.number().int().min(1),
  grantedAt: z.iso.datetime({ offset: true }),
  revokedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type ConsentRecord = z.infer<typeof consentRecordSchema>;

/**
 * Muss erneut gefragt werden? Ja, wenn es eine aktuelle Version gibt und der Nutzer nicht (mehr) oder nur
 * einer älteren Version zugestimmt hat.
 * @param grantedVersion höchste aktive (nicht widerrufene) Version des Nutzers, null/undefined = keine
 * @param currentVersion aktuelle Textversion, null = es gibt keinen Text
 */
export function needsReconsent(
  grantedVersion: number | null | undefined,
  currentVersion: number | null,
): boolean {
  if (currentVersion === null) {
    return false;
  }
  if (grantedVersion === null || grantedVersion === undefined) {
    return true;
  }
  return grantedVersion < currentVersion;
}

/** Höchste aktive (nicht widerrufene) Version einer Einwilligungsart, null = keine aktive Einwilligung. */
export function activeConsentVersion(
  records: readonly ConsentRecord[],
  type: ConsentType,
): number | null {
  let highest: number | null = null;
  for (const record of records) {
    if (record.consentType === type && record.revokedAt === null) {
      highest = highest === null ? record.version : Math.max(highest, record.version);
    }
  }
  return highest;
}

/**
 * Gültige Einwilligung = aktiv und genau in der aktuellen Version (wie public.has_valid_consent).
 */
export function hasValidConsent(
  records: readonly ConsentRecord[],
  type: ConsentType,
  currentVersion: number | null = CURRENT_CONSENT_VERSIONS[type],
): boolean {
  if (currentVersion === null) {
    return false;
  }
  return records.some(
    (record) =>
      record.consentType === type && record.revokedAt === null && record.version === currentVersion,
  );
}

/** Pflicht-Einwilligungen, denen (in der aktuellen Version) noch zugestimmt werden muss. */
export function missingRequiredConsents(
  records: readonly ConsentRecord[],
  currentVersions: Readonly<Record<ConsentType, number | null>> = CURRENT_CONSENT_VERSIONS,
): ConsentType[] {
  return REQUIRED_CONSENT_TYPES.filter((type) =>
    needsReconsent(activeConsentVersion(records, type), currentVersions[type]),
  );
}

/**
 * Braucht diese Art von Lebensmittel-Vorliebe die Einwilligung health_data?
 * Unverträglichkeiten sind Gesundheitsdaten, „mag“/„mag nicht“ nicht.
 */
export function foodPreferenceRequiresHealthConsent(kind: FoodPreferenceKind): boolean {
  return kind === 'intolerance';
}
