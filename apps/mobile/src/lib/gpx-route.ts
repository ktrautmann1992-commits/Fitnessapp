import { hikingTimeEstimate, type TrackedRouteSport, type WalkKind } from '@fitnessapp/core';

import { t } from '@/i18n';

import type { SavedLoop } from './loop-store.types';

/**
 * GPX-Import (Sportarten Stufe 1 · Wandern): Auswahl „Wofür ist die Strecke?“ und Gehzeit-Text einer gemerkten Strecke.
 * Rechnen in packages/core (hikingTimeEstimate, DIN 33466/DAV).
 */
export type GpxPurpose = 'hike' | 'mountain_hike' | 'walk' | 'run' | 'bike';
export const GPX_PURPOSES: readonly GpxPurpose[] = ['hike', 'mountain_hike', 'walk', 'run', 'bike'];

/** Auswahl → Sportart + Art der Geh-Einheit (Gehen = null wie in der Datenbank). */
export function purposeToSport(purpose: GpxPurpose): {
  readonly sport: TrackedRouteSport;
  readonly walkKind: WalkKind | null;
} {
  if (purpose === 'run' || purpose === 'bike') return { sport: purpose, walkKind: null };
  return { sport: 'walk', walkKind: purpose === 'walk' ? null : purpose };
}

/** Gehzeit-Text für eine gemerkte Strecke; null = nicht berechenbar (zu kurz). */
export function savedRouteTimeText(
  route: Pick<SavedLoop, 'distance_m' | 'ascent_m'> & { readonly descent_m?: number | null },
): string | null {
  const estimate = hikingTimeEstimate({
    distanceM: route.distance_m,
    gainM: route.ascent_m,
    lossM: route.descent_m ?? null,
  });
  return estimate ? t.endurance.hiking.timeValue(estimate.minutes) : null;
}
