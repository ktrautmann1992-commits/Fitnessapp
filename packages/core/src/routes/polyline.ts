import { TRACKED_ROUTE_LIMITS } from '../constants';

/**
 * Komprimierte Linie (Google „Encoded Polyline Algorithm Format“, Genauigkeit
 * TRACKED_ROUTE_LIMITS.polylinePrecision = 5 Nachkommastellen ≈ 1 m). Die Datenbank prüft dasselbe Format
 * (private.polyline_summary, Abgleich in db-sync.test.ts). Nur ASCII-Zeichen 63–126.
 * Quelle: Google Maps Platform, „Encoded Polyline Algorithm Format“
 * (developers.google.com/maps/documentation/utilities/polylinealgorithm).
 */

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

const FACTOR = 10 ** TRACKED_ROUTE_LIMITS.polylinePrecision;

function encodeValue(value: number): string {
  // Zickzack: Vorzeichen ins unterste Bit (auf ganzen Zahlen, ohne 32-Bit-Grenze von `<<`).
  let v = value < 0 ? -2 * value - 1 : 2 * value;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v % 0x20)) + 63);
    v = Math.floor(v / 0x20);
  }
  return out + String.fromCharCode(v + 63);
}

/** Punkte zu einer Polyline (Koordinaten auf 5 Nachkommastellen gerundet). */
export function encodePolyline(points: readonly LatLng[]): string {
  let prevLat = 0;
  let prevLng = 0;
  let out = '';
  for (const p of points) {
    const lat = Math.round(p.lat * FACTOR);
    const lng = Math.round(p.lng * FACTOR);
    out += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
    prevLat = lat;
    prevLng = lng;
  }
  return out;
}

/**
 * Polyline zu Punkten. null bei ungültiger Eingabe (Zeichen außerhalb 63–126, abgeschnittener Wert, ungerade Zahl
 * von Werten, Koordinate außerhalb −90…90 bzw. −180…180) – nie ein Fehler.
 */
export function decodePolyline(encoded: string): LatLng[] | null {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const readValue = (): number | null => {
    let result = 0;
    let factor = 1;
    for (;;) {
      if (index >= encoded.length) return null;
      const b = encoded.charCodeAt(index) - 63;
      index += 1;
      if (b < 0 || b > 63) return null;
      result += (b % 0x20) * factor;
      factor *= 0x20;
      // Mehr als 7 Gruppen (35 Bit) sind nie eine gültige Koordinaten-Änderung.
      if (factor > 0x20 ** 7) return null;
      if (b < 0x20) break;
    }
    return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
  };
  while (index < encoded.length) {
    const dLat = readValue();
    if (dLat === null) return null;
    const dLng = readValue();
    if (dLng === null) return null;
    lat += dLat;
    lng += dLng;
    if (Math.abs(lat) > 90 * FACTOR || Math.abs(lng) > 180 * FACTOR) return null;
    points.push({ lat: lat / FACTOR, lng: lng / FACTOR });
  }
  return points;
}

/** Begrenzungsrahmen [Süd, West, Nord, Ost] in Grad; null ohne Punkte. */
export function boundingBox(
  points: readonly LatLng[],
): readonly [number, number, number, number] | null {
  if (points.length === 0) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.lat);
    north = Math.max(north, p.lat);
    west = Math.min(west, p.lng);
    east = Math.max(east, p.lng);
  }
  return [south, west, north, east];
}
