import { ROUTE_MATCH } from '../constants';
import { decodePolyline, type LatLng } from './polyline';
import type { TrackedRouteRow } from './schema';
import { simplifyTrack } from './simplify';
import { EARTH_RADIUS_M, haversineM } from './track';

/**
 * „Meine Strecken“ – gleiche Strecke wiedererkennen (Vorschlag 24.10.2026, docs/PLAN-PHASE-10.md Nachtrag): feste
 * Regeln, laufen auf dem Gerät, keine KI, nur eigene Läufe. Prüfungen von billig nach teuer: gleiche Person und
 * Sportart → nicht abgelehnt → Distanz ±ROUTE_MATCH.distanceTolerance → Rahmen überlappen → Start und Ende je
 * ≤ startEndMaxM → beide Linien vereinfachen, neu abtasten, diskreter Fréchet-Abstand ≤ frechetMaxM und nicht
 * andersherum gelaufen. Mehrere Treffer → kleinster Abstand; Gleichstand → älteste Strecke, dann id.
 * Koordinaten verlassen das Gerät nicht und werden nie geloggt.
 */

/** Was die Erkennung vom neuen Lauf braucht. */
export type MatchRouteInput = Pick<
  TrackedRouteRow,
  'id' | 'user_id' | 'sport' | 'distance_m' | 'polyline' | 'bbox'
> &
  Partial<Pick<TrackedRouteRow, 'match_rejected_ids'>>;

/** Was die Erkennung von einer gemerkten Strecke braucht. */
export type MatchCandidate = Pick<
  TrackedRouteRow,
  'id' | 'user_id' | 'sport' | 'distance_m' | 'polyline' | 'bbox' | 'is_favorite' | 'started_at'
> &
  Partial<Pick<TrackedRouteRow, 'auto_match'>>;

export interface RouteMatch {
  readonly favoriteId: string;
  /** Größter Abstand entlang des Wegs (diskreter Fréchet-Abstand) in Metern, gerundet. */
  readonly frechetM: number;
}

export interface MatchOptions {
  /** „Andere Strecke wählen“: auch Strecken mit ausgeschaltetem „automatisch zuordnen“. Standard false. */
  readonly includeManualOnly?: boolean;
}

const M_PER_DEG = (Math.PI / 180) * EARTH_RADIUS_M;

/** Distanz höchstens ±ROUTE_MATCH.distanceTolerance von der gemerkten Strecke (wie set_route_match). */
export function matchDistanceOk(distanceM: number, favoriteM: number): boolean {
  if (!(favoriteM > 0) || !(distanceM > 0)) return false;
  return Math.abs(distanceM - favoriteM) <= ROUTE_MATCH.distanceTolerance * favoriteM;
}

function validBbox(b: readonly number[] | null | undefined): b is readonly number[] {
  return Array.isArray(b) && b.length === 4 && b.every((x) => Number.isFinite(Number(x)));
}

/** Rahmen [S, W, N, E] überlappen (um bboxPadM erweitert)? Ungültige Rahmen → true (Prüfung danach entscheidet). */
export function bboxesOverlap(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
  padM: number = ROUTE_MATCH.bboxPadM,
): boolean {
  if (!validBbox(a) || !validBbox(b)) return true;
  const [as, aw, an, ae] = a.map(Number) as [number, number, number, number];
  const [bs, bw, bn, be] = b.map(Number) as [number, number, number, number];
  const padLat = padM / M_PER_DEG;
  const midLat = ((as + an) / 2) * (Math.PI / 180);
  const padLng = padM / (M_PER_DEG * Math.max(0.01, Math.cos(midLat)));
  if (as - padLat > bn || bs - padLat > an) return false;
  // Rahmen über ±180° (West > Ost nie, aber sehr breit): Länge nur prüfen, wenn beide schmal sind.
  if (ae - aw > 180 || be - bw > 180) return true;
  return !(aw - padLng > be || bw - padLng > ae);
}

/** Längen-Unterschied b − a in −180…180 (Sprung über die Datumsgrenze). */
function lngDelta(a: number, b: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function wrapLng(lng: number): number {
  if (lng > 180) return lng - 360;
  if (lng < -180) return lng + 360;
  return lng;
}

/**
 * Linie alle `stepM` Meter neu abtasten (erster und letzter Punkt bleiben). Ergibt das mehr als `maxPoints` Punkte,
 * wird der Abstand vergrößert (Länge / (maxPoints − 1)). Weniger als 2 Punkte → unverändert.
 */
export function resampleTrack(
  points: readonly LatLng[],
  stepM: number = ROUTE_MATCH.resampleM,
  maxPoints: number = ROUTE_MATCH.maxPoints,
): LatLng[] {
  if (points.length < 2) return points.map((p) => ({ lat: p.lat, lng: p.lng }));
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = haversineM(points[i - 1] as LatLng, points[i] as LatLng);
    seg.push(d);
    total += d;
  }
  const first = points[0] as LatLng;
  const lastPoint = points.at(-1) as LatLng;
  if (total === 0) return [{ ...first }, { ...lastPoint }];
  const step = Math.max(stepM, total / Math.max(1, maxPoints - 1));
  const out: LatLng[] = [{ lat: first.lat, lng: first.lng }];
  let next = step;
  let walked = 0;
  for (let i = 1; i < points.length && out.length < maxPoints - 1; i += 1) {
    const a = points[i - 1] as LatLng;
    const b = points[i] as LatLng;
    const d = seg[i - 1] as number;
    while (d > 0 && next <= walked + d && next < total - 0.5 && out.length < maxPoints - 1) {
      const f = (next - walked) / d;
      out.push({
        lat: a.lat + (b.lat - a.lat) * f,
        lng: wrapLng(a.lng + lngDelta(a.lng, b.lng) * f),
      });
      next += step;
    }
    walked += d;
  }
  out.push({ lat: lastPoint.lat, lng: lastPoint.lng });
  return out;
}

/**
 * Diskreter Fréchet-Abstand in Metern (Eiter & Mannila 1994): der kleinste „Leinen-Abstand“, mit dem zwei Personen
 * beide Linien vom Anfang bis zum Ende ablaufen können, ohne zurückzugehen. O(n·m) Zeit, O(m) Speicher. Leere
 * Linie → Infinity.
 */
export function discreteFrechetM(a: readonly LatLng[], b: readonly LatLng[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return Infinity;
  let prev = new Float64Array(m);
  let cur = new Float64Array(m);
  for (let i = 0; i < n; i += 1) {
    const p = a[i] as LatLng;
    for (let j = 0; j < m; j += 1) {
      const d = haversineM(p, b[j] as LatLng);
      if (i === 0 && j === 0) cur[j] = d;
      else if (i === 0) cur[j] = Math.max(cur[j - 1] as number, d);
      else if (j === 0) cur[j] = Math.max(prev[0] as number, d);
      else {
        const best = Math.min(prev[j] as number, prev[j - 1] as number, cur[j - 1] as number);
        cur[j] = Math.max(best, d);
      }
    }
    [prev, cur] = [cur, prev];
  }
  return prev[m - 1] as number;
}

/** Linie für den Vergleich: dekodieren, vereinfachen, neu abtasten (höchstens ROUTE_MATCH.maxPoints). */
function prepared(polyline: string, cache?: Map<string, LatLng[] | null>): LatLng[] | null {
  const hit = cache?.get(polyline);
  if (hit !== undefined) return hit;
  const decoded = decodePolyline(polyline);
  const result = decoded && decoded.length >= 2 ? resampleTrack(simplifyTrack(decoded)) : null;
  cache?.set(polyline, result);
  return result;
}

/** Index des Punkts im Anfangsstück (bis startEndMaxM entlang der Linie), der `target` am nächsten liegt. */
function nearestInHead(line: readonly LatLng[], target: LatLng): number {
  let best = 0;
  let bestD = haversineM(line[0] as LatLng, target);
  let walked = 0;
  for (let i = 1; i < line.length; i += 1) {
    walked += haversineM(line[i - 1] as LatLng, line[i] as LatLng);
    if (walked > ROUTE_MATCH.startEndMaxM) break;
    const d = haversineM(line[i] as LatLng, target);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  }
  return best;
}

/** Überstehende Anfangs- und Endstücke (je höchstens startEndMaxM) beider Linien abschneiden. */
function alignEnds(a: readonly LatLng[], b: readonly LatLng[]): [LatLng[], LatLng[]] {
  const sa = nearestInHead(a, b[0] as LatLng);
  const sb = nearestInHead(b, a[0] as LatLng);
  const ra = [...a].reverse();
  const rb = [...b].reverse();
  const ea = a.length - nearestInHead(ra, b.at(-1) as LatLng);
  const eb = b.length - nearestInHead(rb, a.at(-1) as LatLng);
  const ta = a.slice(sa, Math.max(sa + 1, ea));
  const tb = b.slice(sb, Math.max(sb + 1, eb));
  return [ta, tb];
}

/** Fréchet-Abstand zweier Linien, oder null, wenn Start/Ende zu weit auseinander oder andersherum gelaufen. */
function lineDistance(a: readonly LatLng[], b: readonly LatLng[]): number | null {
  const M = ROUTE_MATCH;
  const a0 = a[0] as LatLng;
  const a1 = a.at(-1) as LatLng;
  const b0 = b[0] as LatLng;
  const b1 = b.at(-1) as LatLng;
  if (haversineM(a0, b0) > M.startEndMaxM || haversineM(a1, b1) > M.startEndMaxM) return null;
  // Verspäteter GPS-Start bzw. früheres Stoppen (bis startEndMaxM): die überstehenden Stücke am Anfang und Ende
  // abschneiden, damit sie nicht als Linien-Abstand zählen (Fréchet koppelt sonst Start an Start).
  const [ta, tb] = alignEnds(a, b);
  const forward = discreteFrechetM(ta, tb);
  if (forward > M.frechetMaxM) return null;
  // Andersherum gelaufen (Rundkurs in Gegenrichtung) = eigene Strecke: passt die umgedrehte Linie deutlich besser,
  // ist es kein Treffer. Hin und zurück auf demselben Weg bleibt gleich (beide Richtungen etwa gleich gut).
  const reversed = discreteFrechetM(ta, [...tb].reverse());
  if (reversed + M.directionMarginM < forward) return null;
  return forward;
}

/**
 * Gemerkte Strecke (Favorit), zu der `route` passt – oder null. Berücksichtigt nur eigene Favoriten derselben
 * Sportart (nicht `route` selbst), nicht abgelehnte, und ohne `includeManualOnly` nur solche mit „automatisch
 * zuordnen“ (auto_match fehlt = an).
 */
export function matchRoute(
  route: MatchRouteInput,
  candidates: readonly MatchCandidate[],
  options: MatchOptions = {},
  cache?: Map<string, LatLng[] | null>,
): RouteMatch | null {
  return rankMatches(route, candidates, options, cache)[0] ?? null;
}

/** Alle passenden Favoriten, bester zuerst (kleinster Abstand, dann älteste Strecke, dann id). */
export function rankMatches(
  route: MatchRouteInput,
  candidates: readonly MatchCandidate[],
  options: MatchOptions = {},
  cache: Map<string, LatLng[] | null> = new Map(),
): RouteMatch[] {
  const rejected = new Set(route.match_rejected_ids ?? []);
  const pre = candidates.filter(
    (c) =>
      c.is_favorite &&
      c.id !== route.id &&
      c.user_id === route.user_id &&
      c.sport === route.sport &&
      (options.includeManualOnly === true || c.auto_match !== false) &&
      !rejected.has(c.id) &&
      matchDistanceOk(route.distance_m, c.distance_m) &&
      bboxesOverlap(route.bbox, c.bbox),
  );
  if (pre.length === 0) return [];
  const line = prepared(route.polyline, cache);
  if (!line) return [];
  const hits: { c: MatchCandidate; d: number }[] = [];
  for (const c of pre) {
    const other = prepared(c.polyline, cache);
    if (!other) continue;
    const d = lineDistance(line, other);
    if (d !== null) hits.push({ c, d: Math.round(d) });
  }
  hits.sort(
    (x, y) =>
      x.d - y.d ||
      Date.parse(x.c.started_at) - Date.parse(y.c.started_at) ||
      x.c.id.localeCompare(y.c.id),
  );
  return hits.map((h) => ({ favoriteId: h.c.id, frechetM: h.d }));
}

/**
 * Favoriten, die die Person bei „Andere Strecke wählen“ auswählen darf (gleiche Regeln wie set_route_match: eigene
 * Favoriten derselben Sportart, Distanz ±10 %, nicht der Lauf selbst). Passende Linien zuerst (wie rankMatches),
 * dann die übrigen nach Name.
 */
export function routeChoices<T extends MatchCandidate & Pick<TrackedRouteRow, 'name'>>(
  route: MatchRouteInput,
  candidates: readonly T[],
): T[] {
  const eligible = candidates.filter(
    (c) =>
      c.is_favorite &&
      c.id !== route.id &&
      c.user_id === route.user_id &&
      c.sport === route.sport &&
      matchDistanceOk(route.distance_m, c.distance_m),
  );
  const ranked = rankMatches({ ...route, match_rejected_ids: [] }, eligible, {
    includeManualOnly: true,
  });
  const order = new Map(ranked.map((r, i) => [r.favoriteId, i] as const));
  return [...eligible].sort((a, b) => {
    const ia = order.get(a.id) ?? Infinity;
    const ib = order.get(b.id) ?? Infinity;
    if (ia !== ib) return ia - ib;
    return a.name.localeCompare(b.name, 'de') || a.id.localeCompare(b.id);
  });
}

export type AutoMatchRow = MatchRouteInput &
  MatchCandidate &
  Pick<TrackedRouteRow, 'route_match' | 'base_route_id'>;

export interface AutoMatchProposal {
  readonly routeId: string;
  readonly favoriteId: string;
  readonly frechetM: number;
}

/**
 * Ein Durchgang der Erkennung (nach Speichern bzw. Abgleich mit der Uhr): alle eigenen, noch nicht zugeordneten
 * Läufe (route_match null, ohne base_route_id, selbst kein Favorit) gegen die Favoriten mit „automatisch zuordnen“.
 * Neueste zuerst, höchstens ROUTE_MATCH.maxAutoPerPass Vorschläge; die App sendet sie als set_route_match(…, 'auto').
 */
export function autoMatchRoutes(
  userId: string,
  routes: readonly AutoMatchRow[],
): AutoMatchProposal[] {
  const own = routes.filter((r) => r.user_id === userId);
  const favorites = own.filter((r) => r.is_favorite && r.auto_match !== false);
  if (favorites.length === 0) return [];
  const open = own
    .filter((r) => !r.is_favorite && r.route_match == null && r.base_route_id == null)
    .sort(
      (a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || a.id.localeCompare(b.id),
    );
  const cache = new Map<string, LatLng[] | null>();
  const out: AutoMatchProposal[] = [];
  for (const r of open) {
    if (out.length >= ROUTE_MATCH.maxAutoPerPass) break;
    const hit = matchRoute(r, favorites, {}, cache);
    if (hit) out.push({ routeId: r.id, ...hit });
  }
  return out;
}
