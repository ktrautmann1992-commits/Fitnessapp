import { autoMatchRoutes, type TrackedRouteRow } from '@fitnessapp/core';

import type { Backend } from './backend';

/**
 * „Meine Strecken“ (25.10.2026): Erkennung auf dem Gerät nach Speichern bzw. Abgleich mit der Uhr. Die Regeln liegen
 * in packages/core (autoMatchRoutes); hier nur Zusammensetzen: Vorschläge als set_route_match(…, 'auto') senden.
 * Läuft still im Hintergrund – Fehler (offline, Server lehnt ab) werden nicht angezeigt; dieselbe Zuordnung wird in
 * dieser Sitzung nach einem Fehler nicht erneut versucht. Keine Koordinaten in Logs.
 */

const failed = new Set<string>();

/** Vorschläge senden → Anzahl neu zugeordneter Läufe. */
export async function applyAutoMatches(
  backend: Pick<Backend, 'setRouteMatch'>,
  userId: string,
  routes: readonly TrackedRouteRow[],
): Promise<number> {
  let changed = 0;
  for (const p of autoMatchRoutes(userId, routes)) {
    const key = `${p.routeId}>${p.favoriteId}`;
    if (failed.has(key)) continue;
    try {
      const outcome = await backend.setRouteMatch(p.routeId, p.favoriteId, 'auto');
      if (outcome === 'auto') changed += 1;
      else failed.add(key);
    } catch {
      failed.add(key);
    }
  }
  return changed;
}

/** Nur für Tests: Merkliste leeren. */
export function resetAutoMatchFailures(): void {
  failed.clear();
}
