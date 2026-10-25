import {
  ageInYears,
  aggregateDailyMetrics,
  averageCadence,
  type CadenceStore,
  DEFAULT_PULSE_ZONE_SETTINGS,
  type PulseZoneSettings,
  pulseZonesFor,
  assignDuplicates,
  candidatesFromLogRows,
  chunkImportBatches,
  daysInRange,
  isoDateInTimeZone,
  sessionFromHc,
  syncWindow,
  type TrackedRouteRow,
  WEARABLE_SYNC,
  type WearableImportResult,
  type WearableRoutePayload,
  type WearableRows,
} from '@fitnessapp/core';

import type { HcAvailability, HealthConnectDriver } from '../lib/health-connect-driver.types';
import type { WearableBackend } from './backend';
import { restingBpmFromRows } from './runner';
import type { UserRows } from './types';

/**
 * Ein Abgleich mit Health Connect (Phase 8, docs/PLAN-PHASE-8.md 7.1): lesen → mit packages/core umrechnen
 * (sessionFromHc, aggregateDailyMetrics, assignDuplicates, chunkImportBatches) → an das Backend (Supabase:
 * verschlüsselte Warteschlange, offline-first). Nur Zusammensetzen, die Regeln liegen in packages/core bzw. auf dem
 * Server. Gelesene Werte nie loggen (Art. 9).
 * Routen (23.10.2026): Ausdauer-Einheiten mit Route bekommen Distanz, Höhenmeter und Kilometerzeiten aus der Route
 * (sessionFromHc) und die Route geht nach den Einheiten an save_wearable_route. Gleiche Linie wie gespeichert → nicht
 * erneut gesendet.
 */

export type WearableSyncOutcome =
  | { readonly kind: 'unavailable'; readonly availability: HcAvailability }
  /** In Health Connect ist nichts (mehr) freigegeben → „Zugriff fehlt“. */
  | { readonly kind: 'permission_missing' }
  | {
      readonly kind: 'imported';
      readonly result: WearableImportResult;
      /** Läufe, für die Health Connect eine Freigabe der Route je Einheit verlangt. */
      readonly routeConsentRequired?: number;
      /** Lauf-Paket 2: Ø Kadenz je Einheit (Health-Connect-id → Schritte/min), nur für dieses Gerät. */
      readonly cadence?: CadenceStore;
    }
  | {
      readonly kind: 'queued';
      readonly routeConsentRequired?: number;
      readonly cadence?: CadenceStore;
    };

export interface WearableSyncInput {
  readonly driver: HealthConnectDriver;
  readonly backend: WearableBackend;
  /** Tagebuch auf dem Gerät (Doppel-Erkennung), Profil (Alter für den HFmax) und Körperdaten (Ruhepuls). */
  readonly rows: Pick<UserRows, 'sessionLogs' | 'cardioLogs' | 'profile'> &
    Partial<Pick<UserRows, 'bodyMetrics'>>;
  /** Lauf-Paket 2: Pulszonen-Einstellung dieses Geräts (eigener HFmax, Ruhepuls einbeziehen); fehlt = Standard. */
  readonly pulseZones?: PulseZoneSettings;
  /** Stand vom Server (letzter Abgleich, schon übernommene Einheiten). */
  readonly wearable: WearableRows;
  readonly now: string;
  readonly today: string;
  /** Gespeicherte Strecken (Routen der Uhr: Distanz bleibt, wenn die Route gerade nicht lesbar ist). */
  readonly trackedRoutes?: readonly Pick<
    TrackedRouteRow,
    'source' | 'wearable_session_log_id' | 'distance_m' | 'polyline'
  >[];
  /**
   * Einmaliges Nachladen der Routen (erster Abgleich mit Routen auf diesem Gerät): Zeitraum wie beim ersten Abgleich
   * (30 Tage), übernommen werden davor aber nur SCHON BEKANNTE Einheiten (ändern) – gelöschte kommen nie zurück.
   */
  readonly routeBackfill?: boolean;
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
  const readWindow = input.routeBackfill ? syncWindow(null, now) : window;
  const raw = await driver.read(readWindow, granted, days);
  const birthDate = rows.profile?.birth_date ?? null;
  // Lauf-Paket 2: Zonen mit eigenem HFmax bzw. nach Herzfrequenz-Reserve (Ruhepuls: Uhr vor Körperdaten).
  const zones = birthDate
    ? pulseZonesFor({
        age: ageInYears(birthDate, today),
        settings: input.pulseZones ?? DEFAULT_PULSE_ZONE_SETTINGS,
        restingBpm: restingBpmFromRows({ bodyMetrics: rows.bodyMetrics ?? [] }, wearable, today),
      })
    : null;
  const cadence: CadenceStore = {};
  // Gespeicherte Routen der Uhr je external_id (über die übernommene Einheit).
  const externalByLog = new Map(wearable.sessions.map((w) => [w.session_log_id, w.external_id]));
  const storedRoutes = new Map<string, { distance_m: number; polyline: string }>();
  for (const t of input.trackedRoutes ?? []) {
    const ext =
      t.source === 'watch' && t.wearable_session_log_id
        ? externalByLog.get(t.wearable_session_log_id)
        : undefined;
    if (ext) storedRoutes.set(ext, t);
  }
  const known = new Set(wearable.sessions.map((s) => s.external_id));
  let skippedOnDevice = 0;
  let routeConsentRequired = 0;
  const routes: WearableRoutePayload[] = [];
  const sessions = raw.sessions.flatMap(({ record, extras }) => {
    // Nachladen: vor dem normalen Zeitraum nur schon übernommene Einheiten.
    if (Date.parse(record.startTime) < Date.parse(window.from) && !known.has(record.id)) return [];
    const stored = storedRoutes.get(record.id);
    const result = sessionFromHc(record, extras, {
      hfMax: zones?.hfMax ?? null,
      zones,
      storedRouteDistanceM: stored?.distance_m ?? null,
    });
    if (result.kind === 'skip') {
      skippedOnDevice += 1;
      return [];
    }
    const sport =
      result.session.group === 'run' ? 'run' : result.session.group === 'walk' ? 'walk' : null;
    const spm = sport
      ? averageCadence({ steps: extras.steps, durationS: result.session.duration_s, sport })
      : null;
    if (spm !== null) cadence[record.id] = spm;
    if (result.routeStatus === 'consent_required') routeConsentRequired += 1;
    if (result.route && result.route.polyline !== stored?.polyline) routes.push(result.route);
    return [result.session];
  });
  const dailies = aggregateDailyMetrics({
    restingHeartRates: raw.restingHeartRates,
    sleepSessions: raw.sleepSessions,
    steps: raw.steps,
    heartRateVariabilities: raw.heartRateVariabilities,
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
  const outcome = await backend.importBatches(
    chunkImportBatches(granted, items, dailies),
    routes.slice(0, WEARABLE_SYNC.maxSessionsPerBatch),
  );
  if (outcome.kind === 'queued') return { ...outcome, routeConsentRequired, cadence };
  return {
    kind: 'imported',
    result: { ...outcome.result, skipped: outcome.result.skipped + skippedOnDevice },
    routeConsentRequired,
    cadence,
  };
}
