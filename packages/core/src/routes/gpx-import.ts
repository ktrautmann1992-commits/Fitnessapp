import { z } from 'zod';

import {
  GPX_IMPORT,
  ROUTE_ELEVATION,
  ROUTE_ELEVATION_PROFILE,
  ROUTE_GPX,
  TRACKED_ROUTE_LIMITS,
} from '../constants';
import { elevationLoss, maxAltitude } from '../hiking/elevation';
import type { ElevationProfilePoint } from './elevation-profile';
import { encodePolyline, type LatLng } from './polyline';
import { simplifyTrack } from './simplify';
import { elevationGain, haversineM, trackDistance, type TrackPoint } from './track';

/**
 * GPX-Datei als gemerkte Strecke einlesen (Sportarten Stufe 1 · Restpunkte Wandern, 27.10.2026): Die Person wählt eine
 * eigene GPX-Datei (z. B. eine Tour aus einem Wanderportal), die App liest sie NUR auf dem Gerät und legt sie als
 * gemerkte Strecke auf diesem Gerät ab (wie „Rundkurs merken“, nie auf dem Server). Gelesen werden Spur- bzw.
 * Routenpunkte (`trkpt`, sonst `rtept`) mit Höhe (`ele`); Zeiten werden nicht übernommen – eine eingelesene Strecke ist
 * ein Weg zum Nachgehen, keine Einheit. Ohne XML-Bibliothek (React Native hat keinen DOM-Parser): feste, begrenzte
 * Muster, Grenzen in GPX_IMPORT, Ergebnis mit Zod geprüft. Rein, deterministisch.
 */

export type GpxImportError =
  /** Datei größer als GPX_IMPORT.maxFileChars bzw. mehr als maxRawPoints Punkte. */
  | 'too_large'
  /** Keine GPX-Datei (kein `<gpx`-Element). */
  | 'not_gpx'
  /** Keine Spur- oder Routenpunkte. */
  | 'no_points'
  /** Weniger als 2 gültige Punkte bzw. unmögliche Sprünge (kaputte Koordinaten). */
  | 'invalid_points'
  /** Strecke kürzer als GPX_IMPORT.minDistanceM. */
  | 'too_short'
  /** Strecke länger als GPX_IMPORT.maxDistanceM. */
  | 'too_long';

/** Ein gelesener Punkt (Höhe null = keine bzw. unplausible Höhe). */
export const gpxImportPointSchema = z.strictObject({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  ele: z.number().min(ROUTE_GPX.elevationM.min).max(ROUTE_GPX.elevationM.max).nullable(),
});
export type GpxImportPoint = z.infer<typeof gpxImportPointSchema>;

export const gpxImportPointsSchema = z
  .array(gpxImportPointSchema)
  .min(GPX_IMPORT.minPoints)
  .max(GPX_IMPORT.maxRawPoints);

export type GpxParseResult =
  | {
      readonly ok: true;
      /** Name aus der Datei (Spur, Route oder Metadaten), bereinigt; null = keiner. */
      readonly name: string | null;
      readonly points: GpxImportPoint[];
      /** Punkte mit ungültigen Koordinaten, die übersprungen wurden. */
      readonly skipped: number;
    }
  | { readonly ok: false; readonly error: GpxImportError };

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** XML-Text lesbar machen: CDATA, Entitäten, Steuerzeichen, mehrfacher Leerraum. */
export function decodeXmlText(raw: string): string {
  // CDATA-Teile wörtlich, im übrigen Text zuerst Tags entfernen, dann Entitäten auflösen (sonst fiele „&lt;1&gt;“ weg).
  const decoded = raw
    .split(/(<!\[CDATA\[[\s\S]*?\]\]>)/g)
    .map((part) =>
      part.startsWith('<![CDATA[')
        ? part.slice(9, -3)
        : part
            .replace(/<[^>]*>/g, '')
            .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
              if (code.startsWith('#')) {
                const n =
                  code[1] === 'x' || code[1] === 'X'
                    ? Number.parseInt(code.slice(2), 16)
                    : Number.parseInt(code.slice(1), 10);
                return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
              }
              return ENTITIES[code.toLowerCase()] ?? whole;
            }),
    )
    .join('');
  return (
    decoded
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Erster Name: Spur, sonst Route, sonst Metadaten; gekürzt auf GPX_IMPORT.nameMaxLength Zeichen. */
function readName(xml: string): string | null {
  const nameIn = (block: RegExp): string | null => {
    const part = block.exec(xml)?.[0];
    if (!part) return null;
    const m = /<(?:[\w-]+:)?name\s*>([\s\S]*?)<\/(?:[\w-]+:)?name\s*>/i.exec(part);
    if (!m) return null;
    const text = decodeXmlText(m[1] as string);
    return text === '' ? null : [...text].slice(0, GPX_IMPORT.nameMaxLength).join('').trim();
  };
  return (
    nameIn(/<(?:[\w-]+:)?trk\b[\s\S]*?<\/(?:[\w-]+:)?trk\s*>/i) ??
    nameIn(/<(?:[\w-]+:)?rte\b[\s\S]*?<\/(?:[\w-]+:)?rte\s*>/i) ??
    nameIn(/<(?:[\w-]+:)?metadata\b[\s\S]*?<\/(?:[\w-]+:)?metadata\s*>/i)
  );
}

function attribute(attrs: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  const raw = (m?.[1] ?? m?.[2] ?? '').trim();
  return raw === '' ? Number.NaN : Number(raw);
}

function elevationOf(body: string | undefined): number | null {
  if (!body) return null;
  const m = /<(?:[\w-]+:)?ele\s*>\s*([^<]*?)\s*<\/(?:[\w-]+:)?ele\s*>/i.exec(body);
  if (!m) return null;
  const value = Number(m[1]);
  return Number.isFinite(value) &&
    value >= ROUTE_GPX.elevationM.min &&
    value <= ROUTE_GPX.elevationM.max
    ? value
    : null;
}

/** Punkte eines Element-Typs (`trkpt` oder `rtept`); null = mehr als GPX_IMPORT.maxRawPoints. */
function readPoints(
  xml: string,
  tag: 'trkpt' | 'rtept',
): { points: GpxImportPoint[]; skipped: number } | null {
  const re = new RegExp(
    `<(?:[\\w-]+:)?${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}\\s*>)`,
    'gi',
  );
  const points: GpxImportPoint[] = [];
  let skipped = 0;
  let count = 0;
  for (const m of xml.matchAll(re)) {
    count += 1;
    if (count > GPX_IMPORT.maxRawPoints) return null;
    const lat = attribute(m[1] ?? '', 'lat');
    const lng = attribute(m[1] ?? '', 'lon');
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      skipped += 1;
      continue;
    }
    points.push({ lat, lng, ele: elevationOf(m[2]) });
  }
  return { points, skipped };
}

/** GPX-Text lesen (ohne Rechnen). Kommentare werden vorher entfernt. */
export function parseGpx(text: string): GpxParseResult {
  if (text.length > GPX_IMPORT.maxFileChars) return { ok: false, error: 'too_large' };
  const xml = text.replace(/<!--[\s\S]*?-->/g, '');
  if (!/<(?:[\w-]+:)?gpx\b/i.test(xml)) return { ok: false, error: 'not_gpx' };
  const track = readPoints(xml, 'trkpt');
  if (track === null) return { ok: false, error: 'too_large' };
  const read = track.points.length + track.skipped > 0 ? track : readPoints(xml, 'rtept');
  if (read === null) return { ok: false, error: 'too_large' };
  if (read.points.length + read.skipped === 0) return { ok: false, error: 'no_points' };
  const checked = gpxImportPointsSchema.safeParse(read.points);
  if (!checked.success) return { ok: false, error: 'invalid_points' };
  return { ok: true, name: readName(xml), points: checked.data, skipped: read.skipped };
}

/** Eingelesene Strecke, fertig zum Merken. */
export interface GpxImportSummary {
  readonly name: string | null;
  /** Vereinfachte Linie (höchstens GPX_IMPORT.maxStoredPoints Punkte). */
  readonly polyline: string;
  readonly pointCount: number;
  /** Länge in ganzen Metern (aus allen gelesenen Punkten). */
  readonly distanceM: number;
  /** Anstieg, Abstieg, höchster Punkt in ganzen Metern (geglättet wie bei Aufzeichnungen); null = keine Höhen. */
  readonly ascentM: number | null;
  readonly descentM: number | null;
  readonly maxAltitudeM: number | null;
  /** Höhenprofil [Distanz m, Höhe dm] (höchstens ROUTE_ELEVATION_PROFILE.maxPoints); [] = keine Höhen. */
  readonly elevationProfile: ElevationProfilePoint[];
  readonly skipped: number;
}

export type GpxImportResult =
  | ({ readonly ok: true } & GpxImportSummary)
  | { readonly ok: false; readonly error: GpxImportError };

/** Höhenprofil entlang der Distanz (Glättung wie elevationProfile, ohne Zeiten). */
export function gpxElevationProfile(points: readonly GpxImportPoint[]): ElevationProfilePoint[] {
  const P = ROUTE_ELEVATION_PROFILE;
  const half = Math.floor(ROUTE_ELEVATION.smoothingWindow / 2);
  const cumulative = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumulative.push(
      (cumulative[i - 1] as number) +
        haversineM(points[i - 1] as GpxImportPoint, points[i] as GpxImportPoint),
    );
  }
  const alts: { h: number; i: number }[] = [];
  points.forEach((p, i) => {
    if (p.ele !== null) alts.push({ h: p.ele, i });
  });
  const raw: [number, number][] = [];
  alts.forEach((a, k) => {
    const from = Math.max(0, k - half);
    const to = Math.min(alts.length - 1, k + half);
    let sum = 0;
    for (let j = from; j <= to; j += 1) sum += (alts[j] as { h: number }).h;
    const dm = Math.round((sum / (to - from + 1)) * 10);
    if (dm >= P.heightDm.min && dm <= P.heightDm.max) raw.push([cumulative[a.i] as number, dm]);
  });
  if (raw.length < 2) return [];
  const picked =
    raw.length <= P.maxPoints
      ? raw
      : Array.from(
          { length: P.maxPoints },
          (_, k) => raw[Math.round((k * (raw.length - 1)) / (P.maxPoints - 1))] as [number, number],
        );
  return picked.map(([d, h]) => [
    Math.min(TRACKED_ROUTE_LIMITS.distanceM.max, Math.max(0, Math.round(d))),
    h,
  ]);
}

const inRange = (value: number | null, range: { min: number; max: number }): number | null =>
  value !== null && value >= range.min && value <= range.max ? value : null;

/** Gelesene Punkte zusammenfassen: Distanz, Höhen, Profil, vereinfachte Linie. */
export function summarizeGpxPoints(
  points: readonly GpxImportPoint[],
  name: string | null,
  skipped = 0,
): GpxImportResult {
  if (points.length < GPX_IMPORT.minPoints) return { ok: false, error: 'invalid_points' };
  for (let i = 1; i < points.length; i += 1) {
    if (haversineM(points[i - 1] as LatLng, points[i] as LatLng) > GPX_IMPORT.maxGapM) {
      return { ok: false, error: 'invalid_points' };
    }
  }
  const distanceM = Math.floor(trackDistance(points));
  if (distanceM < GPX_IMPORT.minDistanceM) return { ok: false, error: 'too_short' };
  if (distanceM > GPX_IMPORT.maxDistanceM) return { ok: false, error: 'too_long' };
  // Ohne Sportart rechnen die Höhen-Funktionen ohne Bewegungs-Erkennung (keine Zeiten nötig).
  const track: TrackPoint[] = points.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    t: i * 1000,
    altitudeM: p.ele,
  }));
  const L = TRACKED_ROUTE_LIMITS;
  const simplified = simplifyTrack(points, GPX_IMPORT.maxStoredPoints);
  return {
    ok: true,
    name,
    polyline: encodePolyline(simplified),
    pointCount: simplified.length,
    distanceM,
    ascentM: inRange(elevationGain(track).gainM, L.elevationGainM),
    descentM: inRange(elevationLoss(track), L.elevationLossM),
    maxAltitudeM: inRange(maxAltitude(track), L.maxAltitudeM),
    elevationProfile: gpxElevationProfile(points),
    skipped,
  };
}

/** GPX-Text → gemerkte Strecke (lesen + zusammenfassen). */
export function importGpx(text: string): GpxImportResult {
  const parsed = parseGpx(text);
  if (!parsed.ok) return parsed;
  return summarizeGpxPoints(parsed.points, parsed.name, parsed.skipped);
}
