import { describe, expect, it } from 'vitest';

import { ROUTE_ELEVATION_PROFILE, TRACKED_ROUTE_LIMITS } from '../constants';
import {
  elevationProfile,
  elevationProfileOfSegments,
  elevationProfileSchema,
  elevationRange,
} from './elevation-profile';
import { summarizeRecording, summarizeTrack, toTrackedRoutePayload } from './schema';
import { last, line, offset, T0 } from './test-helpers';
import type { TrackPoint } from './track';

const hill = (i: number) => 50 + 20 * Math.sin(i / 60);

describe('elevationProfile', () => {
  it('0, 1 und 2 Punkte; ohne Höhen → leer', () => {
    expect(elevationProfile([], 'run')).toEqual([]);
    expect(elevationProfile(line({ speedMps: 3, count: 1, altitude: () => 10 }), 'run')).toEqual(
      [],
    );
    const two = elevationProfile(
      line({ speedMps: 3, count: 2, stepS: 5, altitude: () => 10 }),
      'run',
    );
    expect(two).toEqual([
      [0, 100],
      [15, 100],
    ]);
    expect(elevationProfile(line({ speedMps: 3, count: 600 }), 'run')).toEqual([]);
  });

  it('Höhen nur teilweise: nur Punkte mit Höhe, Distanz trotzdem entlang der ganzen Strecke', () => {
    const pts = line({ speedMps: 3, count: 600, altitude: (i) => (i % 2 === 0 ? 100 : null) });
    const profile = elevationProfile(pts, 'run');
    expect(profile.length).toBe(300);
    expect(profile[0]).toEqual([0, 1000]);
    // Letzter Punkt mit Höhe ist Index 598 → ca. 598 × 3 m.
    expect((profile.at(-1) as number[])[0]).toBeGreaterThan(1780);
    expect(profile.every(([, h]) => h === 1000)).toBe(true);
  });

  it(`höchstens ${ROUTE_ELEVATION_PROFILE.maxPoints} Stützpunkte, Anfang und Ende bleiben, Distanz nie fallend`, () => {
    const pts = line({ speedMps: 3, count: 5_000, altitude: hill });
    const profile = elevationProfile(pts, 'run');
    expect(profile).toHaveLength(ROUTE_ELEVATION_PROFILE.maxPoints);
    expect((profile[0] as number[])[0]).toBe(0);
    expect((profile.at(-1) as number[])[0]).toBeCloseTo(4_999 * 3, -1);
    profile.forEach((p, i) => {
      if (i > 0) expect(p[0]).toBeGreaterThanOrEqual((profile[i - 1] as number[])[0] as number);
    });
    expect(elevationProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('12 h mit 1 Punkt/s (43.200 Punkte): unter 2 s, gültig', () => {
    const pts = line({ speedMps: 2.5, count: 43_200, altitude: hill });
    const start = Date.now();
    const profile = elevationProfile(pts, 'run');
    expect(Date.now() - start).toBeLessThan(2_000);
    expect(profile.length).toBe(ROUTE_ELEVATION_PROFILE.maxPoints);
    expect(elevationProfileSchema.safeParse(profile).success).toBe(true);
  });

  it('Glättung wie elevationGain: Rauschen ±1 m bleibt im Rahmen', () => {
    const pts = line({ speedMps: 3, count: 200, altitude: (i) => 100 + (i % 2 === 0 ? 1 : -1) });
    const profile = elevationProfile(pts, 'run');
    for (const [, h] of profile) expect(Math.abs(h - 1000)).toBeLessThanOrEqual(10);
  });

  it('Stillstand zählt keine Distanz (Pause in Bewegung)', () => {
    const a = line({ speedMps: 3, count: 100, altitude: () => 20 });
    const end = last(a);
    const standing: TrackPoint[] = Array.from({ length: 120 }, (_, i) => ({
      ...offset(end, (i % 2) * 0.5, 0),
      t: end.t + (i + 1) * 1000,
      accuracyM: 3,
      altitudeM: 20,
    }));
    const b = line({
      speedMps: 3,
      count: 100,
      start: end,
      t0: end.t + 121_000,
      altitude: () => 20,
    });
    const profile = elevationProfile([...a, ...standing, ...b], 'run');
    expect((profile.at(-1) as number[])[0]).toBeLessThan(700);
  });

  it('Höhen außerhalb −1.000 … 10.000 m fallen weg', () => {
    const pts = line({ speedMps: 3, count: 20, altitude: (i) => (i < 10 ? 20_000 : 5) });
    const profile = elevationProfile(pts, 'run');
    expect(profile.every(([, h]) => h <= ROUTE_ELEVATION_PROFILE.heightDm.max)).toBe(true);
  });

  it('mehrere Teilstücke: Distanz läuft weiter', () => {
    const a = line({ speedMps: 3, count: 50, altitude: () => 10 });
    const b = line({
      speedMps: 3,
      count: 50,
      start: offset(last(a), 5_000, 0),
      t0: last(a).t + 600_000,
      altitude: () => 30,
    });
    const profile = elevationProfileOfSegments([a, b], 'run');
    const lastDistance = (profile.at(-1) as number[])[0] as number;
    // 2 × 49 × 3 m, ohne die 5 km Lücke dazwischen.
    expect(lastDistance).toBeGreaterThan(280);
    expect(lastDistance).toBeLessThan(310);
  });

  it('Schema: 1 Punkt, 301 Punkte, fallende Distanz, Kommazahlen und Bereich abgelehnt', () => {
    expect(elevationProfileSchema.safeParse([[0, 0]]).success).toBe(false);
    expect(
      elevationProfileSchema.safeParse(Array.from({ length: 301 }, (_, i) => [i, 0])).success,
    ).toBe(false);
    expect(
      elevationProfileSchema.safeParse([
        [10, 0],
        [5, 0],
      ]).success,
    ).toBe(false);
    expect(
      elevationProfileSchema.safeParse([
        [0, 0.5],
        [5, 0],
      ]).success,
    ).toBe(false);
    expect(
      elevationProfileSchema.safeParse([
        [0, ROUTE_ELEVATION_PROFILE.heightDm.max + 1],
        [5, 0],
      ]).success,
    ).toBe(false);
    expect(
      elevationProfileSchema.safeParse([
        [0, 0],
        [TRACKED_ROUTE_LIMITS.distanceM.max + 1, 0],
      ]).success,
    ).toBe(false);
  });

  it('elevationRange: tiefster und höchster Punkt in Metern', () => {
    expect(elevationRange(null)).toBeNull();
    expect(elevationRange([[0, 5]])).toBeNull();
    expect(
      elevationRange([
        [0, 105],
        [10, -20],
        [20, 400],
      ]),
    ).toEqual({ minM: -2, maxM: 40 });
  });

  it('summarizeTrack liefert das Profil, toTrackedRoutePayload sendet es (ohne Höhen null)', () => {
    const withAlt = summarizeTrack(line({ speedMps: 3, count: 400, altitude: hill }), 'run');
    expect(withAlt.elevationProfile.length).toBeGreaterThan(2);
    const details = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Runde',
      difficulty: null,
      isFavorite: false,
      note: null,
      baseRouteId: null,
      sessionLogId: null,
      source: 'recorded' as const,
    };
    expect(toTrackedRoutePayload(withAlt, details)?.elevation_profile).toEqual(
      withAlt.elevationProfile,
    );
    const without = summarizeTrack(line({ speedMps: 3, count: 400 }), 'run');
    expect(toTrackedRoutePayload(without, details)?.elevation_profile).toBeNull();
  });

  it('summarizeRecording mit einem Teilstück = summarizeTrack (deterministisch)', () => {
    const pts = line({ speedMps: 3, count: 900, altitude: hill, t0: T0 });
    expect(summarizeRecording([pts], 'run')).toEqual(summarizeTrack(pts, 'run'));
  });
});
