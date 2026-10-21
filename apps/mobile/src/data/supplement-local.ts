import {
  createSupplementScreeningAnswersSchema,
  evaluateSupplementScreening,
  hasSupplementConsent,
  RATED_SUPPLEMENT_IDS,
  type RatedSupplementId,
  type StoredSupplementScreening,
  SUPPLEMENT_SCREENING_VERSION,
  type SupplementScreeningAnswers,
  type SupplementUserData,
  USER_SUPPLEMENT_STATUSES,
  type UserSupplementStatus,
} from '@fitnessapp/core';

import { healthConsentStatus } from '../state/flow';
import { BackendError } from './backend';
import type { ConsentVersions } from './mapping';
import type { UserRows } from './types';

/**
 * TESTMODUS: Supplement-Check und „Meine Supplements“ im Gerätespeicher (docs/PLAN-PHASE-6.md 8.3) mit denselben
 * Regeln wie die Datenbank (save_supplement_screening, set_user_supplement, delete_my_supplement_data, Widerruf):
 * Schreiben nur mit gültiger Einwilligung health_data in Fassung ≥ 2, Antworten strikt (Stillzeit nicht bei
 * „männlich“), Flags rechnet der Speicherort selbst, Koffein nie wählbar, Löschen geht immer. Rein und getestet
 * (supplement-local.test.ts). Fehler ohne Werte.
 */

export interface LocalSupplementChoice {
  readonly supplementId: RatedSupplementId;
  readonly status: UserSupplementStatus;
  readonly updatedAt: string;
}

export interface LocalSupplementRecord {
  readonly userId: string;
  readonly screening: StoredSupplementScreening | null;
  readonly choices: readonly LocalSupplementChoice[];
}

function recordOf(
  records: readonly LocalSupplementRecord[],
  userId: string,
): LocalSupplementRecord {
  return (
    records.find((record) => record.userId === userId) ?? { userId, screening: null, choices: [] }
  );
}

function replaceRecord(
  records: readonly LocalSupplementRecord[],
  record: LocalSupplementRecord,
): LocalSupplementRecord[] {
  const others = records.filter((r) => r.userId !== record.userId);
  return record.screening === null && record.choices.length === 0 ? others : [...others, record];
}

export function localSupplementUserData(
  records: readonly LocalSupplementRecord[],
  userId: string,
): SupplementUserData {
  const record = recordOf(records, userId);
  return {
    screening: record.screening,
    choices: record.choices.map(({ supplementId, status }) => ({ supplementId, status })),
  };
}

/** Wie private.require_supplement_consent: gültig UND mindestens Fassung 2. */
function requireSupplementConsent(rows: UserRows, versions: ConsentVersions): void {
  if (
    healthConsentStatus(rows, versions) !== 'valid' ||
    !hasSupplementConsent(versions.health_data)
  ) {
    throw new BackendError('consent_required', { sensitive: true });
  }
}

export function applySupplementScreening(
  records: readonly LocalSupplementRecord[],
  input: {
    readonly rows: UserRows;
    readonly versions: ConsentVersions;
    readonly userId: string;
    readonly answers: SupplementScreeningAnswers;
    readonly now: string;
  },
): LocalSupplementRecord[] {
  requireSupplementConsent(input.rows, input.versions);
  const parsed = createSupplementScreeningAnswersSchema(input.rows.profile?.sex ?? null).safeParse(
    input.answers,
  );
  if (!parsed.success) throw new BackendError('unknown', { sensitive: true });
  const record = recordOf(records, input.userId);
  return replaceRecord(records, {
    ...record,
    screening: {
      answers: parsed.data,
      flags: evaluateSupplementScreening(parsed.data),
      version: SUPPLEMENT_SCREENING_VERSION,
      updatedAt: input.now,
    },
  });
}

export function applyUserSupplement(
  records: readonly LocalSupplementRecord[],
  input: {
    readonly rows: UserRows;
    readonly versions: ConsentVersions;
    readonly userId: string;
    readonly id: string;
    readonly status: string | null;
    readonly now: string;
  },
): LocalSupplementRecord[] {
  if (!(RATED_SUPPLEMENT_IDS as readonly string[]).includes(input.id)) {
    throw new BackendError('unknown', { sensitive: true });
  }
  const id = input.id as RatedSupplementId;
  const record = recordOf(records, input.userId);
  const others = record.choices.filter((choice) => choice.supplementId !== id);
  if (input.status === null) {
    return replaceRecord(records, { ...record, choices: others });
  }
  if (!(USER_SUPPLEMENT_STATUSES as readonly string[]).includes(input.status)) {
    throw new BackendError('unknown', { sensitive: true });
  }
  requireSupplementConsent(input.rows, input.versions);
  const choice: LocalSupplementChoice = {
    supplementId: id,
    status: input.status as UserSupplementStatus,
    updatedAt: input.now,
  };
  // Reihenfolge wie RATED_SUPPLEMENT_IDS (wie „order by supplement_id“ im Export).
  const choices = [...others, choice].sort(
    (a, b) =>
      RATED_SUPPLEMENT_IDS.indexOf(a.supplementId) - RATED_SUPPLEMENT_IDS.indexOf(b.supplementId),
  );
  return replaceRecord(records, { ...record, choices });
}

/** Löschen (Recht auf Löschung, Widerruf health_data): alles dieses Kontos weg. */
export function withoutSupplementData(
  records: readonly LocalSupplementRecord[],
  userId: string,
): LocalSupplementRecord[] {
  return records.filter((record) => record.userId !== userId);
}

/** Zeilen für den Export – Spalten wie supplement_screening und user_supplements. */
export function localSupplementExport(
  records: readonly LocalSupplementRecord[],
  userId: string,
): { supplementScreening: unknown[]; userSupplements: unknown[] } {
  const record = recordOf(records, userId);
  return {
    supplementScreening:
      record.screening === null
        ? []
        : [
            {
              user_id: userId,
              answers: record.screening.answers,
              flags: record.screening.flags,
              version: record.screening.version,
              updated_at: record.screening.updatedAt,
            },
          ],
    userSupplements: record.choices.map((choice) => ({
      user_id: userId,
      supplement_id: choice.supplementId,
      status: choice.status,
      updated_at: choice.updatedAt,
    })),
  };
}

/**
 * Testschalter „Einwilligung nur Fassung 1“ (Plan 8.3): die aktive Einwilligung health_data wird zu Fassung 1 – wie
 * eine Person, die vor SU3 zugestimmt hat. Ohne aktive Einwilligung unverändert. Nichts wird gelöscht.
 */
export function rowsWithOldHealthConsent(rows: UserRows): UserRows {
  return {
    ...rows,
    consents: rows.consents.map((c) =>
      c.consent_type === 'health_data' && c.revoked_at === null ? { ...c, version: 1 } : c,
    ),
  };
}
