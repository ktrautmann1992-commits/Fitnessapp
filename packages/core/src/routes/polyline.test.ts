import { describe, expect, it } from 'vitest';

import { TRACKED_ROUTE_LIMITS } from '../constants';
import { seededRandom } from '../nutrition/test-helpers';
import { boundingBox, decodePolyline, encodePolyline } from './polyline';

describe('encodePolyline / decodePolyline', () => {
  it('Beispiel aus der Google-Beschreibung', () => {
    const points = [
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ];
    expect(encodePolyline(points)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(points);
  });

  it('0, 1, 2 Punkte', () => {
    expect(encodePolyline([])).toBe('');
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline(encodePolyline([{ lat: 50.9413, lng: 6.9583 }]))).toEqual([
      { lat: 50.9413, lng: 6.9583 },
    ]);
    const two = [
      { lat: 50.9413, lng: 6.9583 },
      { lat: 50.9413, lng: 6.9583 },
    ];
    expect(decodePolyline(encodePolyline(two))).toEqual(two);
  });

  it('Rundreise (Eigenschaft): 2.000 Zufallsstrecken, Abweichung höchstens 0,000005°', () => {
    const rand = seededRandom(20261016);
    for (let k = 0; k < 2000; k += 1) {
      const n = 1 + Math.floor(rand() * 30);
      const points = Array.from({ length: n }, () => ({
        lat: (rand() - 0.5) * 180,
        lng: (rand() - 0.5) * 360,
      }));
      const encoded = encodePolyline(points);
      expect(encoded).toMatch(/^[?-~]*$/);
      const decoded = decodePolyline(encoded);
      expect(decoded).toHaveLength(n);
      decoded?.forEach((p, i) => {
        expect(Math.abs(p.lat - (points[i]?.lat ?? 0))).toBeLessThanOrEqual(0.000005 + 1e-12);
        expect(Math.abs(p.lng - (points[i]?.lng ?? 0))).toBeLessThanOrEqual(0.000005 + 1e-12);
      });
      // Erneut kodiert → derselbe Text (stabil).
      expect(encodePolyline(decoded ?? [])).toBe(encoded);
    }
  });

  it(`Extremwerte: höchstens 12 Zeichen je Punkt (→ polylineMaxChars = maxPoints × 12)`, () => {
    const extremes = [
      { lat: 90, lng: 180 },
      { lat: -90, lng: -180 },
      { lat: 90, lng: 180 },
    ];
    const encoded = encodePolyline(extremes);
    expect(encoded.length).toBeLessThanOrEqual(12 * extremes.length);
    expect(decodePolyline(encoded)).toEqual(extremes);
    expect(TRACKED_ROUTE_LIMITS.polylineMaxChars).toBe(TRACKED_ROUTE_LIMITS.maxPoints * 12);
  });

  it('ungültige Eingaben → null (nie ein Fehler)', () => {
    // Zeichen außerhalb 63–126
    expect(decodePolyline('_p~iF ~ps|U')).toBeNull();
    expect(decodePolyline('ä')).toBeNull();
    // abgeschnitten: letzter Wert ohne Abschluss-Gruppe bzw. nur Breite ohne Länge
    expect(decodePolyline('_p~iF~ps|')).toBeNull();
    expect(decodePolyline('_p~iF')).toBeNull();
    // zu viele Fortsetzungs-Gruppen
    expect(decodePolyline('~~~~~~~~?')).toBeNull();
    // Breite außerhalb ±90°
    expect(
      decodePolyline(encodePolyline([{ lat: 90, lng: 0 }]) + encodePolyline([{ lat: 1, lng: 0 }])),
    ).toBeNull();
  });
});

describe('boundingBox', () => {
  it('leer → null; sonst [Süd, West, Nord, Ost]', () => {
    expect(boundingBox([])).toBeNull();
    expect(
      boundingBox([
        { lat: 50, lng: 7 },
        { lat: 51, lng: 6 },
        { lat: 50.5, lng: 8 },
      ]),
    ).toEqual([50, 6, 51, 8]);
  });
});
