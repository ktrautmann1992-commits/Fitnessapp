import {
  boundingBox,
  decodePolyline,
  FREE_SESSION,
  type TrackedRouteRow,
  type TrackedRouteSport,
  wearableRoutePayloadSchema,
} from '@fitnessapp/core';

import type { UserRows } from './types';
import type { LocalWearableStore } from './wearable-rows';

/**
 * Routen der Uhr im TESTMODUS (23.10.2026): dieselben Regeln wie save_wearable_route und die Trigger aus
 * 20261023120100_wearable_routes.sql – auf den Zeilen im Gerätespeicher. Rein, ohne Speicher; Fehler ohne Koordinaten.
 */

/** Von der Person gelöschte Uhr-Routen (= private.wearable_route_dismissals). */
export interface RouteDismissal {
  user_id: string;
  session_log_id: string;
}

export type WearableRouteSaveResult =
  | {
      kind: 'saved' | 'skipped';
      routes: TrackedRouteRow[];
      rows: UserRows;
      dismissals: RouteDismissal[];
    }
  | { kind: 'reject'; reason: 'invalid' | 'not_found' };

const NAMES: Readonly<Record<TrackedRouteSport, string>> = {
  run: FREE_SESSION.names.endurance.run,
  walk: FREE_SESSION.names.endurance.walk,
  bike: FREE_SESSION.names.endurance.bike,
};

const isRouteSport = (m: string | null | undefined): m is TrackedRouteSport =>
  m === 'run' || m === 'walk' || m === 'bike';

/** save_wearable_route im Testmodus. Einwilligungen prüft der Aufrufer (wie der Server: sonst consent_required). */
export function applyWearableRouteSave(
  input: unknown,
  explicit: boolean,
  state: {
    routes: readonly TrackedRouteRow[];
    rows: UserRows;
    wearables: LocalWearableStore;
    dismissals: readonly RouteDismissal[];
  },
  ctx: { userId: string; now: string; newId: () => string },
): WearableRouteSaveResult {
  const parsed = wearableRoutePayloadSchema.safeParse(input);
  if (!parsed.success) return { kind: 'reject', reason: 'invalid' };
  const r = parsed.data;
  const ws = state.wearables.sessions.find(
    (w) =>
      w.user_id === ctx.userId &&
      w.provider === 'health_connect' &&
      w.external_id === r.external_id &&
      state.rows.sessionLogs.some((l) => l.id === w.session_log_id),
  );
  if (!ws) return { kind: 'reject', reason: 'not_found' };
  const logId = ws.session_log_id;
  const modality = state.rows.cardioLogs.find((c) => c.session_log_id === logId)?.modality;
  const unchanged = {
    routes: [...state.routes],
    rows: state.rows,
    dismissals: [...state.dismissals],
  };
  if (!isRouteSport(modality)) return { kind: 'skipped', ...unchanged };
  if (state.routes.some((t) => t.session_log_id === logId && t.source !== 'watch')) {
    return {
      kind: 'skipped',
      ...unchanged,
      routes: state.routes.filter((t) => t.wearable_session_log_id !== logId),
    };
  }
  let dismissals = [...state.dismissals];
  if (dismissals.some((d) => d.session_log_id === logId)) {
    if (!explicit) return { kind: 'skipped', ...unchanged };
    dismissals = dismissals.filter((d) => d.session_log_id !== logId);
  }
  const points = decodePolyline(r.polyline);
  const bbox = points ? boundingBox(points) : null;
  if (!points || !bbox) return { kind: 'reject', reason: 'invalid' };
  const durationS = Math.round((Date.parse(ws.finished_at) - Date.parse(ws.started_at)) / 1000);
  const existing = state.routes.find(
    (t) => t.user_id === ctx.userId && t.wearable_session_log_id === logId,
  );
  const geometry = {
    sport: modality,
    started_at: ws.started_at,
    duration_s: durationS,
    moving_s: r.moving_s,
    distance_m: r.distance_m,
    elevation_gain_m: r.elevation_gain_m,
    polyline: r.polyline,
    point_count: points.length,
    bbox: [...bbox],
    km_splits: [...r.km_splits],
    elevation_profile: r.elevation_profile ? r.elevation_profile.map((p) => [...p]) : null,
    session_log_id: logId,
    updated_at: ctx.now,
  };
  const routes: TrackedRouteRow[] = existing
    ? state.routes.map((t) => (t === existing ? { ...t, ...geometry } : t))
    : [
        ...state.routes,
        {
          ...geometry,
          id: ctx.newId(),
          user_id: ctx.userId,
          name: NAMES[modality],
          difficulty: null,
          is_favorite: false,
          base_route_id: null,
          note: null,
          source: 'watch',
          wearable_session_log_id: logId,
          // Health Connect kennt kein E-Bike → normales Rad (wie der Standard der Spalte).
          e_bike: false,
          route_match: null,
          match_rejected_ids: [],
          auto_match: true,
          weather: null,
          created_at: ctx.now,
        },
      ];
  let rows = state.rows;
  if (!ws.merged) {
    const cardio = rows.cardioLogs.find((c) => c.session_log_id === logId);
    const elevation = r.elevation_gain_m ?? cardio?.elevation_m ?? null;
    if (cardio && (cardio.distance_m !== r.distance_m || cardio.elevation_m !== elevation)) {
      rows = {
        ...rows,
        cardioLogs: rows.cardioLogs.map((c) =>
          c === cardio ? { ...c, distance_m: r.distance_m, elevation_m: elevation } : c,
        ),
        sessionLogs: rows.sessionLogs.map((l) =>
          l.id === logId
            ? {
                ...l,
                revision: l.revision + 1,
                last_write_id: ctx.newId(),
                client_updated_at: ctx.now,
                updated_at: ctx.now,
              }
            : l,
        ),
      };
    }
  }
  return { kind: 'saved', routes, rows, dismissals };
}

/** Verbindung weg (Trennen, Widerruf): alle Routen der Uhr der Person weg, Merkliste leer. */
export function withoutWatchRoutes(
  routes: readonly TrackedRouteRow[],
  dismissals: readonly RouteDismissal[],
  userId: string,
): { routes: TrackedRouteRow[]; dismissals: RouteDismissal[] } {
  return {
    routes: routes.filter((t) => !(t.user_id === userId && t.source === 'watch')),
    dismissals: dismissals.filter((d) => d.user_id !== userId),
  };
}

/** Uhr-Route von der Person gelöscht (Uhr-Einheit besteht weiter) → merken. */
export function dismissWatchRoutes(
  removed: readonly TrackedRouteRow[],
  dismissals: readonly RouteDismissal[],
): RouteDismissal[] {
  const next = [...dismissals];
  for (const t of removed) {
    const logId = t.wearable_session_log_id;
    if (t.source !== 'watch' || !logId || next.some((d) => d.session_log_id === logId)) continue;
    next.push({ user_id: t.user_id, session_log_id: logId });
  }
  return next;
}

/**
 * Uhr-Einheit wechselt den Eintrag (Zusammenführen): Route folgt; hat der neue Eintrag schon eine eigene Strecke, geht
 * die Uhr-Route (App führend).
 */
export function followWatchRoute(
  routes: readonly TrackedRouteRow[],
  fromLogId: string,
  toLogId: string,
  userId: string,
): TrackedRouteRow[] {
  const isMoved = (t: TrackedRouteRow) =>
    t.user_id === userId && t.source === 'watch' && t.wearable_session_log_id === fromLogId;
  if (routes.some((t) => t.session_log_id === toLogId && t.source !== 'watch')) {
    return routes.filter((t) => !isMoved(t));
  }
  return routes.map((t) =>
    isMoved(t) ? { ...t, session_log_id: toLogId, wearable_session_log_id: toLogId } : t,
  );
}

/**
 * Ältere gespeicherte Zeilen ohne Spalten: Uhr-Verknüpfung null, E-Bike false (vor 23.10.2026); Zuordnung zu „Meinen
 * Strecken“ (vor 25.10.2026): Verweis vorhanden → repeat, sonst offen; keine Ablehnungen; automatisch zuordnen an.
 */
export function normalizeRouteRow(row: TrackedRouteRow): TrackedRouteRow {
  if (
    row.wearable_session_log_id !== undefined &&
    typeof row.e_bike === 'boolean' &&
    row.route_match !== undefined &&
    Array.isArray(row.match_rejected_ids) &&
    typeof row.auto_match === 'boolean' &&
    row.weather !== undefined
  ) {
    return row;
  }
  return {
    ...row,
    wearable_session_log_id: row.wearable_session_log_id ?? null,
    e_bike: row.e_bike === true,
    route_match: row.route_match ?? (row.base_route_id ? 'repeat' : null),
    match_rejected_ids: Array.isArray(row.match_rejected_ids) ? row.match_rejected_ids : [],
    auto_match: row.auto_match !== false,
    weather: row.weather ?? null,
  };
}
