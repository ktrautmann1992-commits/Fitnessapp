import {
  elevationFromProfile,
  type EnduranceRouteInput,
  isoDateInTimeZone,
  type RouteDifficulty,
  type TrackedRouteRow,
  type WalkKind,
} from '@fitnessapp/core';

import type { PendingTrackedRoute, TrackedRoutesResult } from './backend';
import { routeInputFromPayload } from './endurance-rows';
import type { UserRows } from './types';

/**
 * Lauf-Auswertung (`/ausdauer/[id]`) und Tagebuch-Eintrag (`/log/[id]`) teilen sich dieselbe Darstellung
 * (components/route-insights.tsx, 28.10.2026). Hier nur das Zusammensetzen der Zahlen einer Strecke (gespeichert oder
 * wartend) und die Suche „gehört zu diesem Eintrag eine aufgezeichnete Strecke?“. Keine Regeln. Rein, getestet.
 */

/** Gespeicherte bzw. noch wartende Strecke (genau eines von beiden ist gesetzt). */
export interface RouteRef {
  readonly saved: TrackedRouteRow | null;
  readonly pending: PendingTrackedRoute | null;
}

/** Strecke nach id (gespeichert vor wartend); null wenn unbekannt. */
export function routeById(result: TrackedRoutesResult | null, id: string | null): RouteRef | null {
  if (!result || !id) return null;
  const saved = result.routes.find((r) => r.id === id) ?? null;
  if (saved) return { saved, pending: null };
  const pending = result.pending.find((p) => p.payload.id === id) ?? null;
  return pending ? { saved: null, pending } : null;
}

/**
 * Mit dem Tagebuch-Eintrag verknüpfte Strecke (tracked_routes.session_log_id; Aufzeichnung in der App bzw. Uhr-Lauf
 * mit Route). Gespeicherte Strecke vor wartender; bei mehreren die neueste (Liste kommt neueste zuerst). null = kein
 * GPS (manuell eingetragen, Uhr ohne Route) → schlichte Eintrags-Seite.
 */
export function routeForLog(result: TrackedRoutesResult | null, logId: string): RouteRef | null {
  if (!result || logId === '') return null;
  const saved = result.routes.find((r) => r.session_log_id === logId) ?? null;
  if (saved) return { saved, pending: null };
  const known = new Set(result.routes.map((r) => r.id));
  const pending =
    result.pending.find((p) => p.payload.session_log_id === logId && !known.has(p.payload.id)) ??
    null;
  return pending ? { saved: null, pending } : null;
}

/** Was die Auswertung einer Strecke anzeigt (verknüpfter Eintrag führend bei E-Bike und Art der Geh-Einheit). */
export interface RouteFacts {
  readonly info: EnduranceRouteInput;
  readonly polyline: string | null;
  readonly kmSplits: readonly number[];
  readonly profile: TrackedRouteRow['elevation_profile'];
  readonly note: string | null;
  readonly difficulty: RouteDifficulty | null;
  /** Kalendertag des Starts (Europe/Berlin). */
  readonly day: string;
  /** Lauf der Uhr (Herkunft `watch`). */
  readonly watch: boolean;
  readonly eBike: boolean;
  /** Nur beim Gehen gesetzt. */
  readonly walkKind: WalkKind | null;
  readonly sacGrade: number | null;
  readonly lossM: number | null;
  readonly maxAltM: number | null;
  /** Anstieg für die Gehzeit: gespeichert bzw. aus dem Höhenprofil. */
  readonly gainM: number | null;
}

export function routeFacts(rows: UserRows, ref: RouteRef): RouteFacts {
  const { saved, pending } = ref;
  const payload = pending?.payload ?? null;
  const info: EnduranceRouteInput = saved ?? routeInputFromPayload(payload!);
  const profile = saved?.elevation_profile ?? payload?.elevation_profile ?? null;
  const logId = info.session_log_id;
  const linkedCardio = logId
    ? (rows.cardioLogs.find((c) => c.session_log_id === logId) ?? null)
    : null;
  const eBike =
    info.sport === 'bike' &&
    (linkedCardio ? linkedCardio.e_bike === true : (saved?.e_bike ?? info.e_bike) === true);
  const walkKind: WalkKind | null =
    info.sport === 'walk'
      ? ((linkedCardio ? linkedCardio.walk_kind : (saved?.walk_kind ?? payload?.walk_kind)) ??
        'walk')
      : null;
  // Abstieg/höchster Punkt: gespeichert (Aufzeichnung ab Etappe W) bzw. aus dem Höhenprofil (ältere Strecken).
  const fromProfile = elevationFromProfile(profile);
  return {
    info,
    polyline: saved?.polyline ?? payload?.polyline ?? null,
    kmSplits: saved?.km_splits ?? payload?.km_splits ?? [],
    profile,
    note: saved?.note ?? payload?.note ?? null,
    difficulty: saved?.difficulty ?? payload?.difficulty ?? null,
    day: isoDateInTimeZone(info.started_at),
    watch: saved?.source === 'watch',
    eBike,
    walkKind,
    sacGrade: saved?.sac_grade ?? payload?.sac_grade ?? null,
    lossM: saved?.elevation_loss_m ?? payload?.elevation_loss_m ?? fromProfile?.lossM ?? null,
    maxAltM: saved?.max_altitude_m ?? payload?.max_altitude_m ?? fromProfile?.maxM ?? null,
    gainM: info.elevation_gain_m ?? fromProfile?.gainM ?? null,
  };
}
