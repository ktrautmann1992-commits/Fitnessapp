import {
  type EnduranceActivity,
  enduranceActivities,
  type EnduranceLogInput,
  type EnduranceRouteInput,
  type TrackedRouteRow,
} from '@fitnessapp/core';

import type { PendingTrackedRoute } from './backend';
import { enduranceLogsFromRows, routeInputFromPayload } from './endurance-rows';
import type { UserRows } from './types';

/**
 * Aktivitäten für den Schuh-Kilometerzähler: wie „Meine Läufe“ (activitiesFromRows), dazu ältere Ausdauer-Einträge, die
 * vor dem Tagebuch-Fenster der App liegen (nur online nachgeladen). Jeder Eintrag zählt nur einmal. Rein, getestet.
 */
export function shoeActivities(
  rows: UserRows | null,
  routes: readonly TrackedRouteRow[],
  pending: readonly PendingTrackedRoute[],
  olderLogs: readonly EnduranceLogInput[],
): EnduranceActivity[] {
  const saved = new Set(routes.map((r) => r.id));
  const routeInputs: EnduranceRouteInput[] = [
    ...routes,
    ...pending.filter((p) => !saved.has(p.payload.id)).map((p) => routeInputFromPayload(p.payload)),
  ];
  const logs = rows ? enduranceLogsFromRows(rows) : [];
  const byId = new Map(olderLogs.map((l) => [l.id, l] as const));
  for (const log of logs) byId.set(log.id, log);
  return enduranceActivities(routeInputs, [...byId.values()]);
}
