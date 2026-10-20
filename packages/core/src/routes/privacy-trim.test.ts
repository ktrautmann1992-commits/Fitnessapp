import { describe, expect, it } from 'vitest';

import { ROUTE_PRIVACY_TRIM, ROUTE_PRIVACY_TRIM_M } from '../constants';
import type { LatLng } from './polyline';
import { privacyTrim } from './privacy-trim';
import { offset, START } from './test-helpers';
import { haversineM, trackDistance } from './track';

/** Gerade nach Norden mit Punkten alle `step` Meter. */
function straight(lengthM: number, step = 10, from: LatLng = START): LatLng[] {
  const out: LatLng[] = [];
  for (let d = 0; d <= lengthM + 1e-9; d += step) out.push(offset(from, d, 0));
  return out;
}

/** Abstand entlang der Strecke vom Start bis zum nächsten Punkt auf der Strecke (Gerade: Abstand zum Start). */
describe('privacyTrim (Privatzone des Story-Bilds)', () => {
  it('Konstante laut Plan: 200 m, Rest unter 100 m → ohne Linie', () => {
    expect(ROUTE_PRIVACY_TRIM_M).toBe(200);
    expect(ROUTE_PRIVACY_TRIM.minRemainingM).toBe(100);
  });

  it('0, 1 und 2 Punkte (kurz) → null', () => {
    expect(privacyTrim([])).toBeNull();
    expect(privacyTrim([START])).toBeNull();
    expect(privacyTrim([START, offset(START, 300, 0)])).toBeNull();
  });

  it('2 Punkte, 1 km: ein Abschnitt, beide Schnitte interpoliert (< 1 m genau)', () => {
    const end = offset(START, 1_000, 0);
    const trimmed = privacyTrim([START, end]) as LatLng[];
    expect(trimmed).toHaveLength(2);
    expect(haversineM(START, trimmed[0] as LatLng)).toBeCloseTo(200, 0);
    expect(Math.abs(haversineM(START, trimmed[0] as LatLng) - 200)).toBeLessThan(1);
    expect(Math.abs(haversineM(end, trimmed[1] as LatLng) - 200)).toBeLessThan(1);
  });

  it('unter 400 m und genau 400 m → null; 500 m → 100 m bleiben', () => {
    expect(privacyTrim(straight(390))).toBeNull();
    expect(privacyTrim(straight(400))).toBeNull();
    expect(privacyTrim(straight(499))).toBeNull();
    const rest = privacyTrim(straight(500)) as LatLng[];
    expect(rest).not.toBeNull();
    expect(trackDistance(rest)).toBeCloseTo(100, 0);
  });

  it('Eigenschaft: kein Punkt innerhalb der ersten bzw. letzten 200 m (entlang der Strecke)', () => {
    const route = straight(2_345, 7);
    const trimmed = privacyTrim(route) as LatLng[];
    const end = route.at(-1) as LatLng;
    for (const p of trimmed) {
      expect(haversineM(START, p)).toBeGreaterThanOrEqual(200 - 1);
      expect(haversineM(end, p)).toBeGreaterThanOrEqual(200 - 1);
    }
    expect(trackDistance(trimmed)).toBeCloseTo(2_345 - 400, -1);
  });

  it('Rundkurs (Start = Ziel): beide Enden weg – kein Punkt näher als 200 m Weg am Start', () => {
    // Quadrat mit 500 m Seitenlänge, zurück zum Start.
    const corners = [
      START,
      offset(START, 500, 0),
      offset(START, 500, 500),
      offset(START, 0, 500),
      START,
    ];
    const route: LatLng[] = [];
    for (let c = 0; c < corners.length - 1; c += 1) {
      const a = corners[c] as LatLng;
      const b = corners[c + 1] as LatLng;
      for (let k = 0; k < 50; k += 1) {
        route.push({
          lat: a.lat + ((b.lat - a.lat) * k) / 50,
          lng: a.lng + ((b.lng - a.lng) * k) / 50,
        });
      }
    }
    route.push(START);
    const trimmed = privacyTrim(route) as LatLng[];
    // Nach 200 m auf der ersten Seite bzw. 200 m vor Schluss auf der letzten Seite.
    for (const p of trimmed) expect(haversineM(START, p)).toBeGreaterThanOrEqual(200 - 1);
    expect(trackDistance(trimmed)).toBeCloseTo(2_000 - 400, -1);
  });

  it('doppelte Punkte stören nicht', () => {
    const route = straight(1_000, 50).flatMap((p) => [p, p]);
    const trimmed = privacyTrim(route) as LatLng[];
    expect(trackDistance(trimmed)).toBeCloseTo(600, 0);
  });

  it('Datumsgrenze ±180°: Schnitt über die Grenze hinweg korrekt', () => {
    const a = { lat: 10, lng: 179.998 };
    const b = { lat: 10, lng: -179.99 };
    const total = haversineM(a, b);
    expect(total).toBeGreaterThan(1_200);
    const trimmed = privacyTrim([a, b]) as LatLng[];
    expect(trimmed).toHaveLength(2);
    expect(Math.abs(haversineM(a, trimmed[0] as LatLng) - 200)).toBeLessThan(1);
    expect(Math.abs(haversineM(b, trimmed[1] as LatLng) - 200)).toBeLessThan(1);
    for (const p of trimmed) expect(Math.abs(p.lng)).toBeLessThanOrEqual(180);
  });

  it('ungültige Punkte werden ignoriert, ungültige Länge → null', () => {
    const route = [...straight(1_000, 100), { lat: Number.NaN, lng: 0 }, { lat: 95, lng: 0 }];
    expect(trackDistance(privacyTrim(route) as LatLng[])).toBeCloseTo(600, 0);
    expect(privacyTrim(straight(1_000), Number.NaN)).toBeNull();
    expect(privacyTrim(straight(1_000), -1)).toBeNull();
  });

  it('Ergebnis enthält keine Eingabe-Punkte aus den Endbögen und ist deterministisch', () => {
    const route = straight(1_500, 25);
    expect(privacyTrim(route)).toEqual(privacyTrim(route));
    const inner = (privacyTrim(route) as LatLng[]).slice(1, -1);
    for (const p of inner) expect(route).toContainEqual(p);
  });
});
