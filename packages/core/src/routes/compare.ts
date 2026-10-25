import { ROUTE_COMPARE } from '../constants';
import type { RouteMatchState } from '../enums';
import { paceText, speedText, usesSpeed } from './format';
import type { TrackedRouteRow } from './schema';

/**
 * Zeitvergleich auf einer Favoriten-Strecke (Plan S1, W-G16): NUR eigene Läufe derselben Favoriten-Strecke (die
 * Favoriten-Strecke selbst und Läufe mit base_route_id = Favorit: „Erneut laufen“ (repeat), automatisch erkannt (auto,
 * zählt vorläufig mit – Gründer-Entscheidung 25.10.2026) oder bestätigt (confirmed); nie abgelehnte (rejected)),
 * gleiche Person, gleiche Sportart.
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
  /** Woher der Lauf zur Strecke gehört: die Strecke selbst, „Erneut laufen“, automatisch oder bestätigt. */
  readonly matchKind: AttemptMatchKind;
  /** id des vorherigen vergleichbaren Laufs (null bei first/not_comparable). */
  readonly previousRouteId: string | null;
}

export type AttemptMatchKind = 'favorite' | 'repeat' | 'auto' | 'confirmed';

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
> &
  Partial<Pick<TrackedRouteRow, 'route_match'>>;

/** Gehört der Lauf (base_route_id = Favorit) zur Strecke? Abgelehnte nie; ohne Angabe (ältere Zeilen) = repeat. */
function attemptKind(r: AttemptRow, favoriteId: string): AttemptMatchKind | null {
  if (r.id === favoriteId) return 'favorite';
  if (r.base_route_id !== favoriteId) return null;
  const m: RouteMatchState | null | undefined = r.route_match;
  if (m === 'rejected') return null;
  return m === 'auto' || m === 'confirmed' ? m : 'repeat';
}

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
        attemptKind(r, favorite.id) !== null,
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
      matchKind: attemptKind(a, favorite.id) as AttemptMatchKind,
    };
    if (!comparableDistance(a.distance_m, favorite.distance_m)) {
      result.push({
        ...base,
        code: 'not_comparable',
        diffS: 0,
        splitDiffsS: [],
        previousRouteId: null,
      });
      continue;
    }
    if (previous === null) {
      result.push({ ...base, code: 'first', diffS: 0, splitDiffsS: [], previousRouteId: null });
    } else {
      const diff = a.moving_s - previous.moving_s;
      const code: AttemptCompareCode =
        Math.abs(diff) <= ROUTE_COMPARE.sameWithinS ? 'same' : diff < 0 ? 'faster' : 'slower';
      const n = Math.min(a.km_splits.length, previous.km_splits.length);
      const prevSplits = previous.km_splits;
      const splitDiffsS = a.km_splits.slice(0, n).map((s, i) => s - (prevSplits[i] as number));
      result.push({
        ...base,
        code,
        diffS: Math.abs(diff),
        splitDiffsS,
        previousRouteId: previous.id,
      });
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

/** Punkt im Verlauf einer Strecke (Strecken-Seite, „Verlauf“). */
export interface RouteHistoryPoint {
  readonly routeId: string;
  readonly startedAt: string;
  /** Bewegungszeit in Sekunden. */
  readonly movingS: number;
  readonly distanceM: number;
  /** Ø-Pace in s/km (Laufen, Gehen) – null ohne Distanz. */
  readonly paceS: number | null;
  /** Ø-Geschwindigkeit in km/h (Rad) – null ohne Bewegungszeit. */
  readonly speedKmh: number | null;
  /** Ähnlich lang (±ROUTE_COMPARE.distanceTolerance) – nur diese Punkte gehören in die Linie. */
  readonly comparable: boolean;
  readonly matchKind: AttemptMatchKind;
  readonly code: AttemptCompareCode;
}

/**
 * Verlauf aller Läufe einer Strecke in ZEITLICHER Reihenfolge (W-G16: nie nach Tempo sortiert, kein Feld „best“).
 * Nicht vergleichbare Läufe (anders lang) bleiben markiert statt entfernt (Liste grau, nicht in der Linie).
 */
export function routeHistory(
  favorite: AttemptRow,
  routes: readonly AttemptRow[],
): RouteHistoryPoint[] {
  return compareAttempts(favorite, routes).map((c) => ({
    routeId: c.routeId,
    startedAt: c.startedAt,
    movingS: c.movingS,
    distanceM: c.distanceM,
    paceS: c.distanceM > 0 && c.movingS > 0 ? c.movingS / (c.distanceM / 1000) : null,
    speedKmh: c.movingS > 0 ? c.distanceM / 1000 / (c.movingS / 3600) : null,
    comparable: c.code !== 'not_comparable',
    matchKind: c.matchKind,
    code: c.code,
  }));
}

/** „Ø Pace 5:38 → 5:24 /km“ bzw. beim Rad „Ø 24,1 → 25,3 km/h“ (vorher → heute); null ohne Werte. */
export function attemptPaceText(
  sport: TrackedRouteRow['sport'],
  prev: Pick<TrackedRouteRow, 'moving_s' | 'distance_m'>,
  cur: Pick<TrackedRouteRow, 'moving_s' | 'distance_m'>,
): string | null {
  if (usesSpeed(sport)) {
    const kmh = (r: typeof prev) =>
      r.moving_s > 0 && r.distance_m > 0 ? r.distance_m / 1000 / (r.moving_s / 3600) : null;
    const a = kmh(prev);
    const b = kmh(cur);
    if (a === null || b === null) return null;
    return `Ø ${speedText(a).replace(' km/h', '')} → ${speedText(b)}`;
  }
  const pace = (r: typeof prev) =>
    r.distance_m > 0 && r.moving_s > 0 ? r.moving_s / (r.distance_m / 1000) : null;
  const a = pace(prev);
  const b = pace(cur);
  if (a === null || b === null) return null;
  return `Ø Pace ${paceText(a).replace(' min/km', '')} → ${paceText(b).replace(' min/km', '')} /km`;
}
