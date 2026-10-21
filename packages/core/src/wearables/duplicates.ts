import { WEARABLE_DUPLICATE } from '../constants';
import type { EnduranceModality, PlannedSessionKind } from '../enums';
import type { WearableSessionGroup } from './schema';

/**
 * Doppelte Einheit erkennen (W8-9, docs/PLAN-PHASE-8.md 5.2): Dieselbe Uhr-Einheit zweimal verhindert die
 * external_id (Datenbank). Hier geht es um App-Aufzeichnung/Eintrag UND Uhr für dieselbe Einheit:
 * - gleiche Gruppe und Überlappung ≥ 50 % der kürzeren Einheit → zusammenführen (App-Eintrag bleibt führend:
 *   Distanz, Linie, Name; die Uhr ergänzt Puls und kcal),
 * - Überlappung ≥ 20 % (bzw. ≥ 50 % bei anderer Gruppe) → „Möglicher Doppel-Eintrag“, die Person entscheidet,
 * - Eintrag ohne Uhrzeit (nachgetragen): gleiche Gruppe, gleicher Tag, Dauer ±20 % → nur nachfragen.
 * Rein, ohne Speicher.
 */

/** Zeitfenster einer Einheit (ISO). */
export interface TimeWindow {
  readonly startedAt: string;
  readonly finishedAt: string;
}

/** Anteil der Überlappung an der KÜRZEREN Einheit (0–1); 0 bei ungültigen oder leeren Fenstern. */
export function overlapShare(a: TimeWindow, b: TimeWindow): number {
  const a0 = Date.parse(a.startedAt);
  const a1 = Date.parse(a.finishedAt);
  const b0 = Date.parse(b.startedAt);
  const b1 = Date.parse(b.finishedAt);
  if (![a0, a1, b0, b1].every(Number.isFinite) || a1 <= a0 || b1 <= b0) return 0;
  const overlap = Math.min(a1, b1) - Math.max(a0, b0);
  if (overlap <= 0) return 0;
  return overlap / Math.min(a1 - a0, b1 - b0);
}

/** Gruppe eines vorhandenen Tagebuch-Eintrags: Ausdauer-Art bzw. Kraft. */
export function logGroup(
  kind: PlannedSessionKind,
  modality: EnduranceModality | null,
): WearableSessionGroup {
  if (kind === 'endurance' && modality !== null) return modality;
  return 'strength';
}

/** Vorhandener Eintrag (aus dem Tagebuch auf dem Gerät) als Vergleichskandidat. */
export interface DuplicateCandidate {
  readonly id: string;
  readonly group: WearableSessionGroup;
  readonly performedOn: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  /** Dauer laut Eintrag (Ausdauer: cardio duration_s); null = unbekannt. */
  readonly durationS: number | null;
  /** Schon mit einer Uhr-Einheit verknüpft bzw. selbst übernommen → kein Kandidat. */
  readonly linked: boolean;
}

/** Übernommene Einheit (nach mapExerciseType/sessionFromHc). */
export interface DuplicateSubject {
  readonly group: WearableSessionGroup;
  readonly performedOn: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationS: number;
}

export type DuplicateMatch =
  | { readonly kind: 'merge'; readonly logId: string }
  | { readonly kind: 'ask'; readonly logId: string }
  | { readonly kind: 'new' };

/** Bester passender Eintrag für eine Uhr-Einheit (höchste Überlappung, bei Gleichstand die kleinere id). */
export function matchExisting(
  imported: DuplicateSubject,
  existing: readonly DuplicateCandidate[],
): DuplicateMatch {
  const { autoMergeShare, askShare, durationTolerance } = WEARABLE_DUPLICATE;
  let merge: { id: string; share: number } | null = null;
  let ask: { id: string; share: number } | null = null;
  const better = (current: { id: string; share: number } | null, id: string, share: number) =>
    !current || share > current.share || (share === current.share && id < current.id);
  for (const log of existing) {
    if (log.linked) continue;
    const sameGroup = log.group === imported.group;
    if (log.startedAt !== null && log.finishedAt !== null) {
      const share = overlapShare(imported, {
        startedAt: log.startedAt,
        finishedAt: log.finishedAt,
      });
      if (sameGroup && share >= autoMergeShare) {
        if (better(merge, log.id, share)) merge = { id: log.id, share };
      } else if ((sameGroup && share >= askShare) || (!sameGroup && share >= autoMergeShare)) {
        if (better(ask, log.id, share)) ask = { id: log.id, share };
      }
      continue;
    }
    // Ohne Uhrzeit (nachgetragen): nie automatisch, nur nachfragen.
    if (
      sameGroup &&
      log.performedOn === imported.performedOn &&
      log.durationS !== null &&
      log.durationS > 0 &&
      Math.abs(log.durationS - imported.durationS) <= durationTolerance * imported.durationS
    ) {
      if (better(ask, log.id, 0)) ask = { id: log.id, share: 0 };
    }
  }
  if (merge) return { kind: 'merge', logId: merge.id };
  if (ask) return { kind: 'ask', logId: ask.id };
  return { kind: 'new' };
}

/** Minimal benötigte Spalten aus session_logs bzw. cardio_logs. */
export interface CandidateLogRow {
  readonly id: string;
  readonly kind: PlannedSessionKind;
  readonly performed_on: string;
  readonly started_at: string | null;
  readonly finished_at: string | null;
  readonly source: string;
}
export interface CandidateCardioRow {
  readonly session_log_id: string;
  readonly modality: EnduranceModality;
  readonly duration_s: number;
}

/**
 * Tagebuch-Einträge auf dem Gerät → Vergleichskandidaten. Selbst übernommene Einträge (Herkunft health_connect) und
 * schon mit einer Uhr-Einheit verknüpfte (`linkedLogIds`) sind keine Kandidaten. Dauer: Ausdauer aus cardio_logs, sonst
 * aus Beginn/Ende (falls vorhanden).
 */
export function candidatesFromLogRows(
  logs: readonly CandidateLogRow[],
  cardio: readonly CandidateCardioRow[],
  linkedLogIds: ReadonlySet<string>,
): DuplicateCandidate[] {
  const cardioOf = new Map(cardio.map((c) => [c.session_log_id, c] as const));
  return logs.map((log) => {
    const c = cardioOf.get(log.id) ?? null;
    const timed =
      log.started_at !== null && log.finished_at !== null
        ? Math.round((Date.parse(log.finished_at) - Date.parse(log.started_at)) / 1000)
        : null;
    return {
      id: log.id,
      group: logGroup(log.kind, c?.modality ?? null),
      performedOn: log.performed_on,
      startedAt: log.started_at,
      finishedAt: log.finished_at,
      durationS: c ? c.duration_s : timed !== null && Number.isFinite(timed) ? timed : null,
      linked: log.source === 'health_connect' || linkedLogIds.has(log.id),
    };
  });
}
