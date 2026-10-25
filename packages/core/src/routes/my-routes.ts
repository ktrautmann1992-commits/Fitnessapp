import { type AttemptComparison, compareAttempts } from './compare';
import type { TrackedRouteRow } from './schema';

/**
 * „Meine Strecken“ – Übersichten für die App (25.10.2026): Kacheln auf „Ausdauer“, Hinweis auf neue automatische
 * Treffer, Zuordnung eines einzelnen Laufs. Reine Zusammenfassungen über compareAttempts (W-G16: nur eigene Läufe,
 * zeitliche Reihenfolge, keine Bestzeit, keine Rangliste).
 */

type Row = Pick<
  TrackedRouteRow,
  | 'id'
  | 'user_id'
  | 'name'
  | 'sport'
  | 'started_at'
  | 'moving_s'
  | 'distance_m'
  | 'km_splits'
  | 'base_route_id'
  | 'is_favorite'
  | 'route_match'
  | 'source'
>;

export interface MyRouteTile<T extends Row = Row> {
  readonly favorite: T;
  /** Alle Läufe dieser Strecke inkl. der Strecke selbst (auch nicht vergleichbare). */
  readonly runs: number;
  /** Neuester Lauf (zeitlich) und sein neutraler Vergleich. */
  readonly last: AttemptComparison;
}

/**
 * Kacheln „Meine Strecken“: alle eigenen Favoriten, Reihenfolge = zuletzt gelaufen zuerst (nie nach Tempo),
 * Gleichstand nach Name.
 */
export function myRouteTiles<T extends Row>(
  userId: string,
  routes: readonly T[],
): MyRouteTile<T>[] {
  const own = routes.filter((r) => r.user_id === userId);
  const tiles: MyRouteTile<T>[] = [];
  for (const favorite of own.filter((r) => r.is_favorite)) {
    const attempts = compareAttempts(favorite, own);
    const last = attempts.at(-1);
    if (last) tiles.push({ favorite, runs: attempts.length, last });
  }
  return tiles.sort(
    (a, b) =>
      Date.parse(b.last.startedAt) - Date.parse(a.last.startedAt) ||
      a.favorite.name.localeCompare(b.favorite.name, 'de'),
  );
}

export interface RouteMatchInfo<T extends Row = Row> {
  readonly favorite: T;
  /** Eintrag dieses Laufs im Vergleich (nth = Position in zeitlicher Reihenfolge, ab 1). */
  readonly entry: AttemptComparison;
  readonly nth: number;
  /** Vorheriger vergleichbarer Lauf (für „… schneller als am 17.10.“), sonst null. */
  readonly previous: T | null;
}

/**
 * Zuordnung eines Laufs zu „seiner“ Strecke: bei einem Lauf mit Verweis die gemerkte Strecke, bei einer „Meinen
 * Strecke“ sie selbst. null ohne (sichtbare) Zuordnung – z. B. Favorit zurückgenommen oder abgelehnt.
 */
export function routeMatchInfo<T extends Row>(
  route: T,
  routes: readonly T[],
): RouteMatchInfo<T> | null {
  const favoriteId = route.is_favorite ? route.id : route.base_route_id;
  if (!favoriteId || route.route_match === 'rejected') return null;
  const favorite = routes.find((r) => r.id === favoriteId && r.user_id === route.user_id);
  if (!favorite) return null;
  const attempts = compareAttempts(favorite, routes);
  const index = attempts.findIndex((c) => c.routeId === route.id);
  if (index < 0) return null;
  const entry = attempts[index] as AttemptComparison;
  const previous = entry.previousRouteId
    ? (routes.find((r) => r.id === entry.previousRouteId) ?? null)
    : null;
  return { favorite, entry, nth: index + 1, previous };
}

/**
 * Neueste automatische Zuordnung ohne Antwort (Hinweis „passt vermutlich zu …“ auf Ausdauer) – nur zu einer noch
 * gemerkten Strecke; null, wenn es keine gibt.
 */
export function latestAutoMatch<T extends Row>(
  userId: string,
  routes: readonly T[],
): { route: T; favorite: T } | null {
  const own = routes.filter((r) => r.user_id === userId);
  const auto = own
    .filter((r) => r.route_match === 'auto' && r.base_route_id !== null)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at));
  for (const route of auto) {
    const favorite = own.find((f) => f.id === route.base_route_id && f.is_favorite);
    if (favorite) return { route, favorite };
  }
  return null;
}
