import {
  enduranceStoryCard,
  isoDateInTimeZone,
  type StoryCard,
  type StoryOptions,
  strengthStoryCard,
  type TrackedRouteRow,
} from '@fitnessapp/core';

import type { PendingTrackedRoute } from './backend';
import { routePoints } from './endurance-rows';
import type { UserRows } from './types';

/**
 * Story-Bild (Etappe E6): gespeicherte Strecke bzw. Tagebuch-Eintrag → Eingabe der Positivliste in packages/core
 * (enduranceStoryCard / strengthStoryCard). Hier wird NUR ausgewählt, was die Positivliste erlaubt – keine Notiz, kein
 * Puls, kein Körpergewicht. Ein mit einer Strecke verknüpfter Eintrag nutzt die Linie der Strecke. Rein, getestet.
 */

export function storyForRoute(
  routeId: string,
  routes: readonly TrackedRouteRow[],
  pending: readonly PendingTrackedRoute[],
  options: StoryOptions,
): StoryCard | null {
  const saved = routes.find((r) => r.id === routeId);
  const queued = pending.find((p) => p.payload.id === routeId)?.payload;
  const r = saved ?? queued;
  if (!r) return null;
  return enduranceStoryCard(
    {
      sport: r.sport,
      startedAt: r.started_at,
      day: isoDateInTimeZone(r.started_at),
      durationS: r.duration_s,
      movingS: r.moving_s,
      distanceM: r.distance_m,
      elevationM: r.elevation_gain_m,
      points: routePoints(r.polyline),
    },
    options,
  );
}

export function storyForLog(
  logId: string,
  rows: UserRows,
  routes: readonly TrackedRouteRow[],
  options: StoryOptions,
): StoryCard | null {
  const log = rows.sessionLogs.find((l) => l.id === logId);
  if (!log) return null;
  if (log.kind === 'endurance') {
    const linked = routes.find((r) => r.session_log_id === log.id);
    if (linked) return storyForRoute(linked.id, routes, [], options);
    const cardio = rows.cardioLogs.find((c) => c.session_log_id === log.id);
    if (!cardio) return null;
    return enduranceStoryCard(
      {
        sport: cardio.modality,
        startedAt: null,
        day: log.performed_on,
        durationS: cardio.duration_s,
        movingS: cardio.duration_s,
        distanceM: cardio.distance_m,
        elevationM: cardio.elevation_m,
        points: null,
      },
      options,
    );
  }
  const exercises = rows.exerciseLogs
    .filter((e) => e.session_log_id === log.id)
    .sort((a, b) => a.order_no - b.order_no)
    .map((e) => ({
      nameDe: e.exercise_name_de,
      loadType: e.load_type,
      skipped: e.status === 'skipped',
      sets: rows.setLogs
        .filter((s) => s.exercise_log_id === e.id)
        .sort((a, b) => a.set_no - b.set_no)
        .map((s) => ({ reps: s.reps, weightKg: s.weight_kg, done: s.done })),
    }));
  return strengthStoryCard(
    {
      nameDe: log.name_de,
      performedOn: log.performed_on,
      startedAt: log.started_at,
      finishedAt: log.finished_at,
      exercises,
    },
    options,
  );
}
