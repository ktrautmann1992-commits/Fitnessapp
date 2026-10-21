import { WEARABLE_SYNC } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { type DuplicateCandidate, matchExisting } from './duplicates';
import { mapExerciseType } from './exercise-types';
import { type HeartRateSample, hrZones, summarizeHeartRate } from './heart-rate';
import {
  groupModality,
  originFromPackage,
  secondsBetween,
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
}

export type SessionSkipReason = 'too_short' | 'too_long' | 'invalid';

export type SessionFromHcResult =
  | {
      readonly kind: 'ok';
      readonly session: Omit<WearableSessionImport, 'merge_into' | 'possible_duplicate_of'>;
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
 */
export function sessionFromHc(
  record: HcExerciseSessionInput,
  extras: HcSessionExtras,
  options: { hfMax: number | null },
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
  const heartRate =
    options.hfMax !== null && extras.heartRateSamples && extras.heartRateSamples.length > 0
      ? summarizeHeartRate(extras.heartRateSamples, hrZones(options.hfMax), {
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
      started_at: startedAt,
      finished_at: finishedAt,
      performed_on: isoDateInTimeZone(startedAt),
      duration_s: duration,
      distance_m: endurance ? roundIn(extras.distanceM, WEARABLE_SYNC.distanceM) : null,
      kcal: roundIn(extras.kcal, WEARABLE_SYNC.kcal),
      heart_rate: heartRate,
    },
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
