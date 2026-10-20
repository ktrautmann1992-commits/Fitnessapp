import {
  diaryValuesFromSummary,
  entryDateBlock,
  isoDateInTimeZone,
  plannedEnduranceForRecording,
  type StoredSession,
  type TrackSummary,
} from '@fitnessapp/core';

import { activePlan } from './training-plan';
import type { UserRows } from './types';
import { createFreeDraft, setCardioFields, type WorkoutDraft } from './workout-draft';
import { newEnduranceDraft, startKind } from './workout-session';

/**
 * Automatischer Tagebuch-Eintrag einer Aufzeichnung (Plan S1 „App“, Etappe E4): passt eine HEUTE geplante
 * Ausdauer-Einheit gleicher Art ohne Eintrag → Frage „Zu ‚…‘ zählen?“ (Standard Ja); sonst freie Einheit (A1b). Werte
 * aus der Strecke (diaryValuesFromSummary – passt immer zu sessionLogFitsRoute), Herkunft setzt erst
 * save_tracked_route (gps). Nur Zusammensetzen, Regeln in packages/core. Rein, getestet.
 */

/** Geplante Einheit, zu der die Aufzeichnung zählen kann (nur heute, nur gleiche Art, startbar). */
export function plannedCandidate(
  rows: UserRows,
  summary: TrackSummary,
  today: string,
): StoredSession | null {
  if (!summary.startedAt || isoDateInTimeZone(summary.startedAt) !== today) return null;
  const sessions = activePlan(rows)?.sessions ?? [];
  const logged = new Set(
    rows.sessionLogs.map((l) => l.planned_session_id).filter((id): id is string => id !== null),
  );
  const candidate = plannedEnduranceForRecording(sessions, logged, today, summary.sport);
  return candidate && startKind(rows, candidate, today) === 'today' ? candidate : null;
}

/** Entwurf des Tagebuch-Eintrags (fertig ausgefüllt) oder null (zu kurz bzw. Tag außerhalb des Fensters). */
export function recordingDiaryDraft(
  rows: UserRows,
  summary: TrackSummary,
  options: {
    plannedSessionId: string | null;
    ownerUserId: string;
    today: string;
    now: string;
    newId: () => string;
  },
): WorkoutDraft | null {
  const values = diaryValuesFromSummary(summary);
  if (!values || !summary.startedAt) return null;
  const day = isoDateInTimeZone(summary.startedAt);
  if (entryDateBlock(day, options.today) !== null) return null;
  const base =
    options.plannedSessionId !== null
      ? newEnduranceDraft(rows, options.plannedSessionId, {
          ownerUserId: options.ownerUserId,
          today: options.today,
          now: options.now,
          newId: options.newId,
        })
      : createFreeDraft({
          ownerUserId: options.ownerUserId,
          kind: 'endurance',
          modality: values.modality,
          exercises: [],
          performedOn: day,
          today: options.today,
          now: options.now,
          newId: options.newId,
        });
  if (!base) return null;
  const draft = setCardioFields(
    { ...base, startedAt: summary.startedAt },
    {
      modality: values.modality,
      hours: String(values.hours),
      minutes: String(values.minutes),
      // Meter genau (3 Nachkommastellen), damit die Distanz zur Strecke passt.
      distanceKm: (values.distanceM / 1000).toFixed(3).replace('.', ','),
      elevationM: values.elevationM === null ? '' : String(values.elevationM),
    },
    options.now,
  );
  return draft;
}
