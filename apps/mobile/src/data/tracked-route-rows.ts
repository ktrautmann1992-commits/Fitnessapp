import {
  boundingBox,
  decodePolyline,
  sessionLogFitsRoute,
  TRACKED_ROUTE_LIMITS,
  type TrackedRoutePayload,
  type TrackedRouteRow,
  trackedRouteSchema,
  type UpdateTrackedRoutePayload,
  updateTrackedRouteSchema,
} from '@fitnessapp/core';

import type { UserRows } from './types';

/**
 * Strecken im TESTMODUS (Etappe E4): dieselben Regeln wie save_tracked_route / update_tracked_route /
 * delete_tracked_route (Migrationen 20261016220200 und 20261020210000) – Felder strikt (Zod), Beginn nicht in der
 * Zukunft, Warteschlange (gleiche id → unverändert), Favoriten-Wiederholung nur auf eigene Favoriten derselben
 * Sportart, Tagebuch-Eintrag nur eigener passender Ausdauer-Eintrag ohne Strecke (Herkunft → gps, revision + 1),
 * Tageslimit. Rein, ohne Speicher; Fehler ohne Werte (keine Koordinaten).
 */

export type RouteRejectReason = 'invalid' | 'base_route' | 'session_log' | 'daily_limit';

export interface RouteCounter {
  day: string;
  created: number;
}

export type RouteSaveResult =
  | { kind: 'repeat' }
  | { kind: 'reject'; reason: RouteRejectReason }
  | { kind: 'write'; routes: TrackedRouteRow[]; rows: UserRows; counter: RouteCounter };

export function applyTrackedRouteSave(
  input: unknown,
  state: {
    routes: readonly TrackedRouteRow[];
    rows: UserRows;
    counter: RouteCounter | null;
  },
  context: { userId: string; now: string; today: string; newId: () => string },
): RouteSaveResult {
  const parsed = trackedRouteSchema.safeParse(input);
  if (!parsed.success) return { kind: 'reject', reason: 'invalid' };
  const r: TrackedRoutePayload = parsed.data;
  const now = Date.parse(context.now);
  if (
    Date.parse(r.started_at) + r.duration_s * 1000 >
    now + TRACKED_ROUTE_LIMITS.clockSkewS * 1000
  ) {
    return { kind: 'reject', reason: 'invalid' };
  }
  const own = state.routes.filter((x) => x.user_id === context.userId);
  if (own.some((x) => x.id === r.id)) return { kind: 'repeat' };
  const id = state.routes.some((x) => x.id === r.id) ? context.newId() : r.id;
  if (
    r.base_route_id !== null &&
    !own.some((x) => x.id === r.base_route_id && x.is_favorite && x.sport === r.sport)
  ) {
    return { kind: 'reject', reason: 'base_route' };
  }
  let rows = state.rows;
  if (r.session_log_id !== null) {
    const log = rows.sessionLogs.find(
      (l) => l.id === r.session_log_id && l.user_id === context.userId && l.kind === 'endurance',
    );
    const cardio = rows.cardioLogs.find((c) => c.session_log_id === r.session_log_id);
    if (
      !log ||
      !cardio ||
      cardio.modality !== r.sport ||
      own.some((x) => x.session_log_id === r.session_log_id) ||
      !sessionLogFitsRoute(
        {
          kind: log.kind,
          modality: cardio.modality,
          performedOn: log.performed_on,
          durationS: cardio.duration_s,
          distanceM: cardio.distance_m,
        },
        r,
      )
    ) {
      return { kind: 'reject', reason: 'session_log' };
    }
    rows = {
      ...rows,
      // E-Bike: der verknüpfte Rad-Eintrag übernimmt die Angabe der Strecke (wie save_tracked_route).
      cardioLogs: rows.cardioLogs.map((c) =>
        c.session_log_id === r.session_log_id && c.modality === 'bike'
          ? { ...c, e_bike: r.e_bike === true }
          : c,
      ),
      sessionLogs: rows.sessionLogs.map((l) =>
        l.id === r.session_log_id
          ? {
              ...l,
              source: r.source === 'recorded' ? 'gps' : 'gpx_import',
              revision: l.revision + 1,
              updated_at: context.now,
            }
          : l,
      ),
    };
  }
  const points = decodePolyline(r.polyline);
  const bbox = points ? boundingBox(points) : null;
  if (!points || !bbox) return { kind: 'reject', reason: 'invalid' };
  const created = (state.counter?.day === context.today ? state.counter.created : 0) + 1;
  if (created > TRACKED_ROUTE_LIMITS.maxSavesPerDay) {
    return { kind: 'reject', reason: 'daily_limit' };
  }
  const row: TrackedRouteRow = {
    id,
    user_id: context.userId,
    name: r.name,
    sport: r.sport,
    started_at: r.started_at,
    duration_s: r.duration_s,
    moving_s: r.moving_s,
    distance_m: r.distance_m,
    elevation_gain_m: r.elevation_gain_m,
    polyline: r.polyline,
    point_count: points.length,
    bbox: [...bbox],
    km_splits: [...r.km_splits],
    difficulty: r.difficulty,
    is_favorite: r.is_favorite,
    base_route_id: r.base_route_id,
    note: r.note,
    session_log_id: r.session_log_id,
    source: r.source,
    elevation_profile: r.elevation_profile ? r.elevation_profile.map((p) => [...p]) : null,
    wearable_session_log_id: null,
    e_bike: r.sport === 'bike' && r.e_bike === true,
    created_at: context.now,
    updated_at: context.now,
  };
  return {
    kind: 'write',
    routes: [...state.routes, row],
    rows,
    counter: { day: context.today, created },
  };
}

/**
 * Name, Schwierigkeit, Favorit, Notiz und (optional) E-Bike einer EIGENEN Strecke ändern (update_tracked_route).
 * E-Bike fehlt = unverändert; `true` nur beim Rad (sonst 'invalid', wie der CHECK der Datenbank).
 */
export function applyTrackedRouteUpdate(
  input: unknown,
  routes: readonly TrackedRouteRow[],
  context: { userId: string; now: string },
): TrackedRouteRow[] | 'invalid' | 'not_found' {
  const parsed = updateTrackedRouteSchema.safeParse(input);
  if (!parsed.success) return 'invalid';
  const u: UpdateTrackedRoutePayload = parsed.data;
  const own = routes.find((x) => x.id === u.id && x.user_id === context.userId);
  if (!own) return 'not_found';
  if (u.e_bike === true && own.sport !== 'bike') return 'invalid';
  return routes.map((x) =>
    x.id === u.id
      ? {
          ...x,
          name: u.name,
          difficulty: u.difficulty,
          is_favorite: u.is_favorite,
          note: u.note,
          e_bike: u.e_bike ?? x.e_bike === true,
          updated_at: context.now,
        }
      : x,
  );
}

/**
 * E-Bike der Strecke → verknüpfter EIGENER Rad-Eintrag (wie update_tracked_route: nur bei Änderung, Revision + 1).
 * Unverändert, wenn die Strecke keinen Eintrag hat oder der Eintrag schon dieselbe Angabe trägt.
 */
export function routeEBikeToLog(
  rows: UserRows,
  route: Pick<TrackedRouteRow, 'session_log_id' | 'e_bike'>,
  now: string,
): UserRows {
  const logId = route.session_log_id;
  const eBike = route.e_bike === true;
  const cardio = logId ? rows.cardioLogs.find((c) => c.session_log_id === logId) : undefined;
  if (!logId || !cardio || cardio.modality !== 'bike' || (cardio.e_bike === true) === eBike) {
    return rows;
  }
  return {
    ...rows,
    cardioLogs: rows.cardioLogs.map((c) => (c === cardio ? { ...c, e_bike: eBike } : c)),
    sessionLogs: rows.sessionLogs.map((l) =>
      l.id === logId ? { ...l, revision: l.revision + 1, updated_at: now } : l,
    ),
  };
}

/** Eintrag gespeichert → verknüpfte Rad-Strecken übernehmen dessen E-Bike-Angabe (wie save_session_log). */
export function logEBikeToRoutes(
  routes: readonly TrackedRouteRow[],
  rows: Pick<UserRows, 'cardioLogs'>,
): TrackedRouteRow[] {
  const byLog = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c.e_bike === true] as const));
  return routes.map((r) => {
    if (r.sport !== 'bike' || r.session_log_id === null || !byLog.has(r.session_log_id)) return r;
    const eBike = byLog.get(r.session_log_id) === true;
    return (r.e_bike === true) === eBike ? r : { ...r, e_bike: eBike };
  });
}

/**
 * Strecke löschen: Wiederholungen behalten ihre Zeiten (Verweis leer, wie `on delete set null`); der Tagebuch-Eintrag
 * bleibt (Herkunft gps, Gründer-Frage S1-G1).
 */
export function applyTrackedRouteDelete(
  routes: readonly TrackedRouteRow[],
  id: string,
  userId: string,
): TrackedRouteRow[] | 'not_found' {
  if (!routes.some((x) => x.id === id && x.user_id === userId)) return 'not_found';
  return routes
    .filter((x) => x.id !== id)
    .map((x) => (x.base_route_id === id ? { ...x, base_route_id: null } : x));
}

/**
 * Tagebuch-Eintrag gelöscht → Verweis der Strecke leer (on delete set null). Route einer Uhr-Einheit: die Einheit geht
 * mit dem Eintrag (Kaskade), ihre Route ebenso (20261023120100_wearable_routes.sql).
 */
export function detachRouteLogs(
  routes: readonly TrackedRouteRow[],
  existingLogIds: ReadonlySet<string>,
): TrackedRouteRow[] {
  return routes
    .filter(
      (x) =>
        x.source !== 'watch' ||
        (x.wearable_session_log_id != null && existingLogIds.has(x.wearable_session_log_id)),
    )
    .map((x) =>
      x.session_log_id !== null && !existingLogIds.has(x.session_log_id)
        ? { ...x, session_log_id: null }
        : x,
    );
}
