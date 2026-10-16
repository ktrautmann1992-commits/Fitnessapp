import { ROUTE_GPX } from '../constants';
import type { TrackedRouteSport } from '../enums';
import type { LatLng } from './polyline';

/**
 * GPX-Export einer eigenen Strecke (Plan S1, KONZEPT 10.1 „GPX-Export für die Uhr“): GPX 1.1
 * (www.topografix.com/GPX/1/1), eine Spur mit einem Segment. Alle Texte sauber escaped (&, <, >, ", ' und
 * Steuerzeichen, die XML 1.0 nicht erlaubt, werden entfernt). Kein Teilen-Dialog nach außen – die Datei gehört der
 * Person (Speichern wie der Datenexport).
 */

export interface GpxPoint extends LatLng {
  /** Höhe in Metern (optional). */
  readonly ele?: number | null;
  /** Zeitpunkt (ISO 8601, optional – gespeicherte Strecken haben keine Zeiten je Punkt). */
  readonly time?: string | null;
}

export interface GpxInput {
  readonly name: string;
  readonly sport: TrackedRouteSport;
  /** Beginn (ISO 8601) für die Metadaten; null = ohne Zeit. */
  readonly startedAt: string | null;
  readonly note?: string | null;
  readonly points: readonly GpxPoint[];
}

/** Kennzeichnung der Sportart im GPX (`<type>`, frei wählbar; üblich wie bei Strava/Garmin). */
const GPX_TYPE: Record<TrackedRouteSport, string> = {
  run: 'running',
  bike: 'cycling',
  walk: 'walking',
};

/** Text für XML escapen; Zeichen, die XML 1.0 nicht erlaubt (z. B. U+0000–U+0008), werden entfernt. */
export function escapeXml(text: string): string {
  return (
    text
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
      .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  );
}

/**
 * Zahl fest formatiert (toFixed, nie Exponent-Schreibweise), ohne überflüssige Nullen. Nur für endliche Werte im
 * gültigen Bereich aufrufen (Wächter S1 N4).
 */
function num(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return trimmed === '-0' ? '0' : trimmed;
}

/** Punkt exportierbar? Breite −90…90, Länge −180…180, endlich (Wächter S1 N4: sonst übersprungen). */
function validPoint(p: GpxPoint): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

function validElevation(ele: number | null | undefined): ele is number {
  return (
    ele != null &&
    Number.isFinite(ele) &&
    ele >= ROUTE_GPX.elevationM.min &&
    ele <= ROUTE_GPX.elevationM.max
  );
}

/** GPX 1.1 als Text (UTF-8). */
export function toGpx(input: GpxInput): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Alpha5" xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    '  <metadata>',
    `    <name>${escapeXml(input.name)}</name>`,
  ];
  if (input.startedAt) lines.push(`    <time>${escapeXml(input.startedAt)}</time>`);
  lines.push('  </metadata>', '  <trk>', `    <name>${escapeXml(input.name)}</name>`);
  if (input.note) lines.push(`    <desc>${escapeXml(input.note)}</desc>`);
  lines.push(`    <type>${GPX_TYPE[input.sport]}</type>`, '    <trkseg>');
  for (const p of input.points) {
    if (!validPoint(p)) continue;
    const children: string[] = [];
    if (validElevation(p.ele))
      children.push(`<ele>${num(p.ele, ROUTE_GPX.elevationDecimals)}</ele>`);
    if (p.time) children.push(`<time>${escapeXml(p.time)}</time>`);
    const attrs = `lat="${num(p.lat, ROUTE_GPX.coordinateDecimals)}" lon="${num(p.lng, ROUTE_GPX.coordinateDecimals)}"`;
    lines.push(
      children.length === 0
        ? `      <trkpt ${attrs}/>`
        : `      <trkpt ${attrs}>${children.join('')}</trkpt>`,
    );
  }
  lines.push('    </trkseg>', '  </trk>', '</gpx>', '');
  return lines.join('\n');
}

/** Dateiname ohne Namen der Strecke (kein Ort im Dateinamen), z. B. „alpha5-strecke-2026-10-16.gpx“. */
export function gpxFileName(day: string): string {
  return `alpha5-strecke-${day}.gpx`;
}
