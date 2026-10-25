/**
 * openrouteservice (HeiGIT gGmbH, Heidelberg; Server in Deutschland) – Rundkurs über `options.round_trip`
 * (length, points, seed) der Directions-API v2, Antwort als GeoJSON mit Höhe (`elevation: true` → ascent) und
 * Untergrund (`extra_info: ["surface"]`). Doku: https://openrouteservice.org/dev/#/api-docs/v2/directions
 *
 * Datenschutz: An ORS gehen NUR der gerundete Startpunkt, die Länge, der Zufallswert und das Profil – keine Nutzer-ID,
 * kein Token, keine IP-Adresse der Person (die Anfrage kommt vom Server). Der Schlüssel steht im Header, nie in der
 * Adresse. Antwort an der Grenze mit Zod geprüft. Fehler nur als feste Codes, nie Koordinaten.
 */
import {
  LOOP_ROUTE,
  type LatLng,
  type LoopCandidate,
  type LoopSurface,
  type LoopSurfaceShares,
  loopRequestLengthM,
} from '@fitnessapp/core';
import { z } from 'zod';

export const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

/** Profil je Untergrund-Wunsch: Waldwege → „foot-hiking“ (bevorzugt Pfade), sonst „foot-walking“. */
export function orsProfile(surface: LoopSurface): 'foot-walking' | 'foot-hiking' {
  return surface === 'unpaved' ? 'foot-hiking' : 'foot-walking';
}

/** Körper der Anfrage an ORS (nur Zahlen, keine Personendaten). */
export function orsRoundTripBody(input: {
  start: LatLng;
  distanceKm: number;
  seed: number;
}): Record<string, unknown> {
  return {
    coordinates: [[input.start.lng, input.start.lat]],
    options: {
      round_trip: {
        length: loopRequestLengthM(input.distanceKm),
        points: LOOP_ROUTE.roundTripPoints,
        seed: input.seed,
      },
    },
    elevation: true,
    extra_info: ['surface'],
    instructions: false,
  };
}

/**
 * ORS-Untergrund-Codes (extra_info „surface“, openrouteservice-Doku „Extra Info – Surface“): 0 unbekannt, 1 befestigt,
 * 2 unbefestigt, 3 Asphalt, 4 Beton, 5 Kopfsteinpflaster, 6 Metall, 7 Holz, 8 verdichteter Schotter, 9 feiner Schotter,
 * 10 Schotter, 11 Erde, 12 Boden, 13 Eis, 14 Pflaster, 15 Sand, 16 Holzschnitzel, 17 Gras, 18 Rasengitter.
 */
const PAVED = new Set([1, 3, 4, 5, 6, 7, 14, 18]);
const UNPAVED = new Set([2, 8, 9, 10, 11, 12, 15, 16, 17]);

const coordinate = z.tuple([z.number(), z.number()]).rest(z.number());

const orsFeatureSchema = z.object({
  geometry: z.object({
    type: z.literal('LineString'),
    coordinates: z.array(coordinate).min(2).max(100_000),
  }),
  properties: z.object({
    summary: z.object({ distance: z.number().nonnegative() }).partial().optional(),
    ascent: z.number().nonnegative().optional(),
    extras: z
      .object({
        surface: z
          .object({
            summary: z.array(z.object({ value: z.number(), distance: z.number().nonnegative() })),
          })
          .optional(),
      })
      .optional(),
  }),
});

const orsResponseSchema = z.object({ features: z.array(orsFeatureSchema).min(1) });

/** Untergrund-Anteile aus der ORS-Zusammenfassung; null ohne Angaben. */
export function surfaceShares(
  summary: readonly { value: number; distance: number }[] | undefined,
): LoopSurfaceShares | null {
  if (!summary || summary.length === 0) return null;
  let paved = 0;
  let unpaved = 0;
  let unknown = 0;
  for (const s of summary) {
    if (PAVED.has(s.value)) paved += s.distance;
    else if (UNPAVED.has(s.value)) unpaved += s.distance;
    else unknown += s.distance;
  }
  const total = paved + unpaved + unknown;
  if (!(total > 0)) return null;
  const r = (n: number) => Math.round((n / total) * 100) / 100;
  return { paved: r(paved), unpaved: r(unpaved), unknown: r(unknown) };
}

/** ORS-Antwort → Runde; null, wenn die Antwort nicht passt. */
export function parseOrsRoundTrip(json: unknown, id: string): LoopCandidate | null {
  const parsed = orsResponseSchema.safeParse(json);
  if (!parsed.success) return null;
  const feature = parsed.data.features[0];
  if (!feature) return null;
  const points = feature.geometry.coordinates
    .map(([lng, lat]) => ({ lat, lng }))
    .filter((p) => Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  if (points.length < 2) return null;
  return {
    id,
    points,
    distanceM: feature.properties.summary?.distance ?? null,
    ascentM: feature.properties.ascent ?? null,
    surface: surfaceShares(feature.properties.extras?.surface?.summary),
  };
}

export type OrsResult =
  | { readonly kind: 'ok'; readonly candidate: LoopCandidate }
  | { readonly kind: 'no_route' }
  | { readonly kind: 'rate_limited' }
  | { readonly kind: 'failed' };

export function createOrsClient(options: { apiKey: string; fetchFn?: typeof fetch }) {
  const fetchFn = options.fetchFn ?? fetch;
  return async (input: {
    start: LatLng;
    distanceKm: number;
    surface: LoopSurface;
    seed: number;
  }): Promise<OrsResult> => {
    let response: Response;
    try {
      response = await fetchFn(`${ORS_BASE_URL}/${orsProfile(input.surface)}/geojson`, {
        method: 'POST',
        headers: {
          Authorization: options.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/geo+json, application/json',
        },
        body: JSON.stringify(orsRoundTripBody(input)),
        signal: AbortSignal.timeout(LOOP_ROUTE.timeoutMs.provider),
      });
    } catch {
      return { kind: 'failed' };
    }
    if (response.status === 429) return { kind: 'rate_limited' };
    // 400/404 = keine Route von diesem Punkt (z. B. mitten im See, kein Weg in der Nähe).
    if (response.status === 400 || response.status === 404) return { kind: 'no_route' };
    if (!response.ok) return { kind: 'failed' };
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return { kind: 'failed' };
    }
    const candidate = parseOrsRoundTrip(json, `ors-${input.seed}`);
    return candidate ? { kind: 'ok', candidate } : { kind: 'failed' };
  };
}
