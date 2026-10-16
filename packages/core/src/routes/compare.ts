import { ROUTE_COMPARE } from '../constants';
import type { TrackedRouteRow } from './schema';

/**
 * Zeitvergleich auf einer Favoriten-Strecke (Plan S1, W-G16): NUR eigene Läufe derselben Favoriten-Strecke (die
 * Favoriten-Strecke selbst und Wiederholungen mit base_route_id = Favorit), gleiche Person, gleiche Sportart.
 * Ergebnis in zeitlicher Reihenfolge (nie nach Zeit sortiert – keine Rangliste), Vergleich nur mit dem jeweils
 * VORHERIGEN Lauf, neutrale Text-Codes, keine Bestzeiten, Abzeichen oder Serien.
 */

export type AttemptCompareCode =
  /** Erster Lauf auf dieser Strecke – nichts zu vergleichen. */
  | 'first'
  /** Schneller als beim letzten Mal. */
  | 'faster'
  /** Langsamer als beim letzten Mal. */
  | 'slower'
  /** Unterschied höchstens ROUTE_COMPARE.sameWithinS Sekunden. */
  | 'same'
  /** Distanz weicht zu stark ab (abgebrochen/abgekürzt) – kein Vergleich. */
  | 'not_comparable';

export interface AttemptComparison {
  readonly routeId: string;
  readonly startedAt: string;
  /** Bewegungszeit in Sekunden. */
  readonly movingS: number;
  readonly distanceM: number;
  readonly code: AttemptCompareCode;
  /** Betrag des Unterschieds zum vorherigen vergleichbaren Lauf in Sekunden (0 bei first/not_comparable). */
  readonly diffS: number;
  /** Kilometerzeiten-Unterschied je km zum vorherigen vergleichbaren Lauf (negativ = schneller); [] ohne Vergleich. */
  readonly splitDiffsS: number[];
}

type AttemptRow = Pick<
  TrackedRouteRow,
  | 'id'
  | 'user_id'
  | 'sport'
  | 'started_at'
  | 'moving_s'
  | 'distance_m'
  | 'km_splits'
  | 'base_route_id'
  | 'is_favorite'
>;

function comparableDistance(distanceM: number, favoriteM: number): boolean {
  if (favoriteM <= 0) return distanceM <= 0;
  return Math.abs(distanceM - favoriteM) / favoriteM <= ROUTE_COMPARE.distanceTolerance;
}

/**
 * Läufe einer Favoriten-Strecke vergleichen. `routes` darf beliebige Strecken enthalten – berücksichtigt werden nur die
 * Favoriten-Strecke selbst und ihre Wiederholungen derselben Person und Sportart. Ist `favorite` kein Favorit, gibt es
 * keinen Vergleich ([]).
 */
export function compareAttempts(
  favorite: AttemptRow,
  routes: readonly AttemptRow[],
): AttemptComparison[] {
  if (!favorite.is_favorite) return [];
  const attempts = [favorite, ...routes.filter((r) => r.id !== favorite.id)]
    .filter(
      (r) =>
        r.user_id === favorite.user_id &&
        r.sport === favorite.sport &&
        (r.id === favorite.id || r.base_route_id === favorite.id),
    )
    .sort(
      (a, b) => Date.parse(a.started_at) - Date.parse(b.started_at) || a.id.localeCompare(b.id),
    );
  const result: AttemptComparison[] = [];
  let previous: AttemptRow | null = null;
  for (const a of attempts) {
    const base = {
      routeId: a.id,
      startedAt: a.started_at,
      movingS: a.moving_s,
      distanceM: a.distance_m,
    };
    if (!comparableDistance(a.distance_m, favorite.distance_m)) {
      result.push({ ...base, code: 'not_comparable', diffS: 0, splitDiffsS: [] });
      continue;
    }
    if (previous === null) {
      result.push({ ...base, code: 'first', diffS: 0, splitDiffsS: [] });
    } else {
      const diff = a.moving_s - previous.moving_s;
      const code: AttemptCompareCode =
        Math.abs(diff) <= ROUTE_COMPARE.sameWithinS ? 'same' : diff < 0 ? 'faster' : 'slower';
      const n = Math.min(a.km_splits.length, previous.km_splits.length);
      const prevSplits = previous.km_splits;
      const splitDiffsS = a.km_splits.slice(0, n).map((s, i) => s - (prevSplits[i] as number));
      result.push({ ...base, code, diffS: Math.abs(diff), splitDiffsS });
    }
    previous = a;
  }
  return result;
}

/** Dauer als „m:ss min“ bzw. „h:mm:ss h“ (für die neutralen Texte). */
export function formatCompareDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec} h` : `${m}:${sec} min`;
}

/** Neutraler deutscher Text zum Vergleich (kein Druck, keine Bestzeit, keine Serie). */
export function attemptCompareText(c: Pick<AttemptComparison, 'code' | 'diffS'>): string {
  switch (c.code) {
    case 'first':
      return 'Das erste Mal auf dieser Strecke.';
    case 'faster':
      return `Heute ${formatCompareDuration(c.diffS)} schneller als beim letzten Mal.`;
    case 'slower':
      return `Heute ${formatCompareDuration(c.diffS)} langsamer als beim letzten Mal.`;
    case 'same':
      return 'Heute etwa gleich schnell wie beim letzten Mal.';
    case 'not_comparable':
      return 'Diesmal war die Strecke anders lang – kein Zeitvergleich.';
  }
}
