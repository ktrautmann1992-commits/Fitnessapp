import {
  decodePolyline,
  type EnduranceActivity,
  enduranceActivities,
  type EnduranceLogInput,
  type EnduranceRouteInput,
  type TrackedRoutePayload,
  type TrackedRouteRow,
} from '@fitnessapp/core';

import type { PendingTrackedRoute } from './backend';
import type { UserRows } from './types';

/**
 * Ausdauer in der App (Etappe E4/E5): Tagebuch-Zeilen und Strecken auf die Eingaben von enduranceActivities()
 * (packages/core) abbilden. Nur Zusammensetzen, keine Regeln. Rein, getestet.
 */

/** Ausdauer-Einträge des Tagebuchs (mit Ausdauer-Teil). */
export function enduranceLogsFromRows(rows: UserRows): EnduranceLogInput[] {
  const cardio = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c] as const));
  return rows.sessionLogs.flatMap((log) => {
    const c = cardio.get(log.id);
    if (log.kind !== 'endurance' || !c) return [];
    return [
      {
        id: log.id,
        name_de: log.name_de,
        performed_on: log.performed_on,
        started_at: log.started_at,
        modality: c.modality,
        duration_s: c.duration_s,
        distance_m: c.distance_m,
        elevation_m: c.elevation_m,
      },
    ];
  });
}

/** Wartende Strecke wie eine gespeicherte anzeigen (Zahlen aus der Eingabe). */
export function routeInputFromPayload(payload: TrackedRoutePayload): EnduranceRouteInput {
  return {
    id: payload.id,
    name: payload.name,
    sport: payload.sport,
    started_at: payload.started_at,
    duration_s: payload.duration_s,
    moving_s: payload.moving_s,
    distance_m: payload.distance_m,
    elevation_gain_m: payload.elevation_gain_m,
    session_log_id: payload.session_log_id,
    is_favorite: payload.is_favorite,
  };
}

/** Alle Aktivitäten (gespeicherte + wartende Strecken + Einträge ohne GPS), neueste zuerst, ohne Doppelzählung. */
export function activitiesFromRows(
  rows: UserRows | null,
  routes: readonly TrackedRouteRow[],
  pending: readonly PendingTrackedRoute[],
): EnduranceActivity[] {
  const saved = new Set(routes.map((r) => r.id));
  const inputs: EnduranceRouteInput[] = [
    ...routes,
    ...pending.filter((p) => !saved.has(p.payload.id)).map((p) => routeInputFromPayload(p.payload)),
  ];
  return enduranceActivities(inputs, rows ? enduranceLogsFromRows(rows) : []);
}

const pointsCache = new Map<string, { lat: number; lng: number }[]>();

/**
 * Linie einer Strecke (gespeichert oder wartend); [] wenn nicht lesbar. Gleiche Polyline → dasselbe Array (die Karte
 * lädt bei neuem Rendern nicht neu). Kleiner Zwischenspeicher im Arbeitsspeicher.
 */
export function routePoints(polyline: string): { lat: number; lng: number }[] {
  const cached = pointsCache.get(polyline);
  if (cached) return cached;
  const points = decodePolyline(polyline) ?? [];
  if (pointsCache.size > 200) pointsCache.clear();
  pointsCache.set(polyline, points);
  return points;
}
