import {
  ageInYears,
  aggregateDailyMetrics,
  assignDuplicates,
  candidatesFromLogRows,
  chunkImportBatches,
  daysInRange,
  isoDateInTimeZone,
  maxHeartRate,
  sessionFromHc,
  syncWindow,
  type WearableImportResult,
  type WearableRows,
} from '@fitnessapp/core';

import type { HcAvailability, HealthConnectDriver } from '../lib/health-connect-driver.types';
import type { WearableBackend } from './backend';
import type { UserRows } from './types';

/**
 * Ein Abgleich mit Health Connect (Phase 8, docs/PLAN-PHASE-8.md 7.1): lesen → mit packages/core umrechnen
 * (sessionFromHc, aggregateDailyMetrics, assignDuplicates, chunkImportBatches) → an das Backend (Supabase:
 * verschlüsselte Warteschlange, offline-first). Nur Zusammensetzen, die Regeln liegen in packages/core bzw. auf dem
 * Server. Gelesene Werte nie loggen (Art. 9).
 */

export type WearableSyncOutcome =
  | { readonly kind: 'unavailable'; readonly availability: HcAvailability }
  /** In Health Connect ist nichts (mehr) freigegeben → „Zugriff fehlt“. */
  | { readonly kind: 'permission_missing' }
  | { readonly kind: 'imported'; readonly result: WearableImportResult }
  | { readonly kind: 'queued' };

export interface WearableSyncInput {
  readonly driver: HealthConnectDriver;
  readonly backend: WearableBackend;
  /** Tagebuch auf dem Gerät (Doppel-Erkennung) und Profil (Alter für den HFmax). */
  readonly rows: Pick<UserRows, 'sessionLogs' | 'cardioLogs' | 'profile'>;
  /** Stand vom Server (letzter Abgleich, schon übernommene Einheiten). */
  readonly wearable: WearableRows;
  readonly now: string;
  readonly today: string;
}

export async function runWearableSync(input: WearableSyncInput): Promise<WearableSyncOutcome> {
  const { driver, backend, rows, wearable, now, today } = input;
  const availability = await driver.availability();
  if (availability !== 'available') return { kind: 'unavailable', availability };
  const granted = await driver.grantedTypes();
  if (granted.length === 0) {
    // Rechte in Health Connect entzogen → Stand „Zugriff fehlt“ melden (offline egal, keine Fehlerschleife).
    await backend.connect([]).catch(() => undefined);
    return { kind: 'permission_missing' };
  }
  const window = syncWindow(wearable.connection?.last_sync_at ?? null, now);
  const days = daysInRange(isoDateInTimeZone(window.from), today);
  const raw = await driver.read(window, granted, days);
  const birthDate = rows.profile?.birth_date ?? null;
  const hfMax = birthDate ? maxHeartRate(ageInYears(birthDate, today)) : null;
  let skippedOnDevice = 0;
  const sessions = raw.sessions.flatMap(({ record, extras }) => {
    const result = sessionFromHc(record, extras, { hfMax });
    if (result.kind === 'skip') {
      skippedOnDevice += 1;
      return [];
    }
    return [result.session];
  });
  const dailies = aggregateDailyMetrics({
    restingHeartRates: raw.restingHeartRates,
    sleepSessions: raw.sleepSessions,
    steps: raw.steps,
    from: days[0] ?? today,
    to: today,
  });
  const candidates = candidatesFromLogRows(
    rows.sessionLogs,
    rows.cardioLogs,
    new Set(wearable.sessions.map((s) => s.session_log_id)),
  );
  const items = assignDuplicates(
    sessions,
    candidates,
    new Set(wearable.sessions.map((s) => s.external_id)),
  );
  const outcome = await backend.importBatches(chunkImportBatches(granted, items, dailies));
  if (outcome.kind === 'queued') return outcome;
  return {
    kind: 'imported',
    result: { ...outcome.result, skipped: outcome.result.skipped + skippedOnDevice },
  };
}
