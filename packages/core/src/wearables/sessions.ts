import { WEARABLE_SYNC } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { type DuplicateCandidate, matchExisting } from './duplicates';
import { mapExerciseType } from './exercise-types';
import {
  type HeartRateSample,
  type HeartRateZones,
  hrZones,
  summarizeHeartRate,
} from './heart-rate';
import {
  chooseWatchDistance,
  type HcRouteRead,
  summarizeWatchRoute,
  type WatchDistanceSource,
  type WearableRoutePayload,
  wearableRoutePayload,
  watchRouteSport,
} from './route';
import {
  type DailyMetricImport,
  groupModality,
  originFromPackage,
  secondsBetween,
  type WearableDataType,
  type WearableImportBatch,
  type WearableSessionImport,
} from './schema';

/**
 * Health-Connect-Trainingseinheit → Import-Datensatz (docs/PLAN-PHASE-8.md 5.1). Der freie Titel aus Samsung Health
 * wird bewusst NICHT übernommen (Freitext; Name kommt aus der Trainingsart). Rein.
 */

/** ExerciseSessionRecord, wie die App ihn aus Health Connect liest (nur die gebrauchten Felder). */
export interface HcExerciseSessionInput {
  /** metadata.id */
  readonly id: string;
  readonly exerciseType: number;
  readonly startTime: string;
  readonly endTime: string;
  /** metadata.dataOrigin (Paketname der schreibenden App). */
  readonly dataOrigin?: string | null;
}

/** Werte im Zeitraum der Einheit (Aggregat-Abfragen bzw. Puls-Messwerte); fehlend = nicht freigegeben/keine Daten. */
export interface HcSessionExtras {
  /** Summe Distance im Zeitraum (m). */
  readonly distanceM?: number | null;
  /** Summe TotalCaloriesBurned im Zeitraum (kcal). */
  readonly kcal?: number | null;
  readonly heartRateSamples?: readonly HeartRateSample[];
  /** Route (GPS) der Einheit (nur Ausdauer mit Strecke; fehlt = nicht gelesen). */
  readonly route?: HcRouteRead;
  /**
   * Summe Steps im Zeitraum (Lauf-Paket 2: Kadenz, nur Laufen/Gehen; fehlt = nicht gelesen). Wird nicht gespeichert –
   * die App rechnet daraus die Ø Kadenz (averageCadence) und merkt sie nur auf dem Gerät.
   */
  readonly steps?: number | null;
}

/**
 * Stand der Route einer Uhr-Einheit nach dem Abgleich:
 * - `route`: Route gelesen und plausibel (Distanz daraus, wird gespeichert),
 * - `stored_route`: früher gespeicherte Route gilt weiter,
 * - `consent_required`: Health Connect will eine Freigabe für diese Einheit („Route freigeben“),
 * - `unusable`: Route da, aber unplausibel (Distanz laut Health Connect),
 * - `none`: keine Route (Laufband, GPS aus, nicht erlaubt, Lesefehler),
 * - `not_applicable`: keine Sportart mit Strecke (Schwimmen, Kraft, Sonstige).
 */
export type WatchRouteStatus =
  'route' | 'stored_route' | 'consent_required' | 'unusable' | 'none' | 'not_applicable';

export type SessionSkipReason = 'too_short' | 'too_long' | 'invalid';

export type SessionFromHcResult =
  | {
      readonly kind: 'ok';
      readonly session: Omit<WearableSessionImport, 'merge_into' | 'possible_duplicate_of'>;
      /** Route zum Speichern (save_wearable_route) oder null. */
      readonly route: WearableRoutePayload | null;
      readonly routeStatus: WatchRouteStatus;
      /** Herkunft der Distanz (null = keine Distanz). */
      readonly distanceSource: WatchDistanceSource | null;
    }
  | { readonly kind: 'skip'; readonly reason: SessionSkipReason };

const iso = (value: string): string | null => {
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

const roundIn = (value: number | null | undefined, limits: { min: number; max: number }) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= limits.min && rounded <= limits.max ? rounded : null;
};

/**
 * Eine Einheit übernehmen: Dauer 1 min–12 h (sonst überspringen, Zähler „nicht übernommen“), Tag = Beginn in
 * Europe/Berlin, Distanz nur bei Ausdauer, Puls-Zusammenfassung nur mit `hfMax` (aus Alter bzw. eigenem Wert).
 * Distanz (23.10.2026): aus der Route, wenn plausibel (summarizeWatchRoute), sonst aus der früher gespeicherten Route
 * (`storedRouteDistanceM`), sonst laut Health Connect (chooseWatchDistance).
 */
export function sessionFromHc(
  record: HcExerciseSessionInput,
  extras: HcSessionExtras,
  options: {
    hfMax: number | null;
    /** Lauf-Paket 2: eigene Zonen-Grenzen (z. B. Herzfrequenz-Reserve); fehlt = % von `hfMax`. */
    zones?: HeartRateZones | null;
    storedRouteDistanceM?: number | null;
  },
): SessionFromHcResult {
  const startedAt = iso(record.startTime);
  const finishedAt = iso(record.endTime);
  if (
    !startedAt ||
    !finishedAt ||
    !record.id ||
    record.id.length > WEARABLE_SYNC.externalIdMaxLength
  ) {
    return { kind: 'skip', reason: 'invalid' };
  }
  const duration = secondsBetween(startedAt, finishedAt);
  if (duration < WEARABLE_SYNC.durationS.min) return { kind: 'skip', reason: 'too_short' };
  if (duration > WEARABLE_SYNC.durationS.max) return { kind: 'skip', reason: 'too_long' };
  const mapped = mapExerciseType(record.exerciseType);
  const endurance = groupModality(mapped.group) !== null;
  const hcDistance = roundIn(extras.distanceM, WEARABLE_SYNC.distanceM);
  const routeRead = endurance ? extras.route : undefined;
  const routeOutcome =
    routeRead?.kind === 'points'
      ? summarizeWatchRoute(routeRead.points, mapped.group, { startedAt, finishedAt }, hcDistance)
      : null;
  const routePayload =
    routeOutcome?.kind === 'ok' ? wearableRoutePayload(record.id, routeOutcome.summary) : null;
  const stored =
    endurance && options.storedRouteDistanceM != null
      ? roundIn(options.storedRouteDistanceM, WEARABLE_SYNC.distanceM)
      : null;
  const distance = endurance
    ? chooseWatchDistance({
        route: routePayload ? routeOutcome : null,
        storedRouteDistanceM: stored,
        hcDistanceM: hcDistance,
      })
    : { distanceM: null, source: null };
  const routeStatus: WatchRouteStatus =
    !endurance || watchRouteSport(mapped.group) === null
      ? 'not_applicable'
      : routePayload
        ? 'route'
        : distance.source === 'stored_route'
          ? 'stored_route'
          : routeRead?.kind === 'consent_required'
            ? 'consent_required'
            : routeOutcome?.kind === 'unusable' || (routeOutcome?.kind === 'ok' && !routePayload)
              ? 'unusable'
              : 'none';
  const heartRate =
    options.hfMax !== null && extras.heartRateSamples && extras.heartRateSamples.length > 0
      ? summarizeHeartRate(extras.heartRateSamples, options.zones ?? hrZones(options.hfMax), {
          from: startedAt,
          to: finishedAt,
        })
      : null;
  return {
    kind: 'ok',
    session: {
      external_id: record.id,
      origin: originFromPackage(record.dataOrigin),
      group: mapped.group,
      name_de: mapped.nameDe,
      // Sportarten Stufe 1: Wandern/Schneeschuhwandern → walk_kind (nur dann gesendet; Gehen bleibt ohne Feld).
      ...(mapped.walkKind ? { walk_kind: mapped.walkKind } : {}),
      started_at: startedAt,
      finished_at: finishedAt,
      performed_on: isoDateInTimeZone(startedAt),
      duration_s: duration,
      distance_m: distance.distanceM,
      kcal: roundIn(extras.kcal, WEARABLE_SYNC.kcal),
      heart_rate: heartRate,
    },
    route: routePayload,
    routeStatus,
    distanceSource: distance.source,
  };
}

/**
 * Doppel-Prüfung für einen ganzen Abgleich (W8-9): Einheiten, die schon übernommen sind (`knownExternalIds`), ändert
 * der Server über die external_id – sie bekommen keine Verknüpfung. Sonst matchExisting gegen die Einträge auf dem
 * Gerät; ein Eintrag wird höchstens EINER Uhr-Einheit zugeordnet (danach gilt er als verknüpft).
 */
export function assignDuplicates(
  sessions: readonly Omit<WearableSessionImport, 'merge_into' | 'possible_duplicate_of'>[],
  candidates: readonly DuplicateCandidate[],
  knownExternalIds: ReadonlySet<string>,
): WearableSessionImport[] {
  const linked = new Set(candidates.filter((c) => c.linked).map((c) => c.id));
  return [...sessions]
    .sort(
      (a, b) =>
        a.started_at.localeCompare(b.started_at) || a.external_id.localeCompare(b.external_id),
    )
    .map((s) => {
      if (knownExternalIds.has(s.external_id)) {
        return { ...s, merge_into: null, possible_duplicate_of: null };
      }
      const match = matchExisting(
        {
          group: s.group,
          performedOn: s.performed_on,
          startedAt: s.started_at,
          finishedAt: s.finished_at,
          durationS: s.duration_s,
        },
        candidates.map((c) => (linked.has(c.id) ? { ...c, linked: true } : c)),
      );
      if (match.kind === 'new') return { ...s, merge_into: null, possible_duplicate_of: null };
      linked.add(match.logId);
      return match.kind === 'merge'
        ? { ...s, merge_into: match.logId, possible_duplicate_of: null }
        : { ...s, merge_into: null, possible_duplicate_of: match.logId };
    });
}

/**
 * Einen Abgleich in Aufrufe von import_wearable_batch aufteilen (höchstens 500 Einheiten bzw. 62 Tage je Aufruf).
 * Leerer Abgleich → genau ein Aufruf (meldet die freigegebenen Datentypen und den Zeitpunkt).
 */
export function chunkImportBatches(
  grantedTypes: readonly WearableDataType[],
  sessions: readonly WearableSessionImport[],
  days: readonly DailyMetricImport[],
): WearableImportBatch[] {
  const batches: WearableImportBatch[] = [];
  const count = Math.max(
    1,
    Math.ceil(sessions.length / WEARABLE_SYNC.maxSessionsPerBatch),
    Math.ceil(days.length / WEARABLE_SYNC.maxDaysPerBatch),
  );
  for (let i = 0; i < count; i += 1) {
    batches.push({
      provider: 'health_connect',
      granted_types: [...grantedTypes],
      sessions: sessions.slice(
        i * WEARABLE_SYNC.maxSessionsPerBatch,
        (i + 1) * WEARABLE_SYNC.maxSessionsPerBatch,
      ),
      days: days.slice(i * WEARABLE_SYNC.maxDaysPerBatch, (i + 1) * WEARABLE_SYNC.maxDaysPerBatch),
    });
  }
  return batches;
}
