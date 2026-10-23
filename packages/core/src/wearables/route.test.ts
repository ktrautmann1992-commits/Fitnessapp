import { describe, expect, it } from 'vitest';

import { TRACKED_ROUTE_LIMITS, WEARABLE_ROUTE } from '../constants';
import { decodePolyline } from '../routes/polyline';
import { offset, START } from '../routes/test-helpers';
import {
  chooseWatchDistance,
  hcLocationsFromNative,
  hcRouteFromRecord,
  type HcRouteLocation,
  releasedWatchRoute,
  summarizeWatchRoute,
  trackPointsFromHc,
  wearableRoutePayload,
  wearableRoutePayloadSchema,
  watchRouteSport,
} from './route';
import { sessionFromHc } from './sessions';

const T0 = Date.parse('2026-10-20T05:30:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Lauf in Kreis-Runden um einen Punkt beim Kölner Dom (keine echten Daten): Radius 240 m (ca. 1,5 km je Runde),
 * `speedMps`, ein Punkt je `stepS` Sekunden, `count` Punkte.
 */
function loop(o: {
  speedMps: number;
  count: number;
  stepS?: number;
  t0?: number;
  altitude?: (i: number) => number | null;
}): HcRouteLocation[] {
  const step = o.stepS ?? 1;
  const t0 = o.t0 ?? T0;
  const radius = 240;
  const out: HcRouteLocation[] = [];
  for (let i = 0; i < o.count; i += 1) {
    const angle = (o.speedMps * step * i) / radius;
    const p = offset(START, radius * Math.sin(angle), radius * (1 - Math.cos(angle)));
    out.push({
      time: iso(t0 + i * step * 1000),
      latitude: p.lat,
      longitude: p.lng,
      altitudeM: o.altitude ? o.altitude(i) : 50 + 10 * Math.sin(i / 120),
      accuracyM: 4,
    });
  }
  return out;
}

const window = (count: number, stepS = 1, t0 = T0) => ({
  startedAt: iso(t0),
  finishedAt: iso(t0 + (count - 1) * stepS * 1000),
});

describe('hcRouteFromRecord / hcLocationsFromNative (Format von react-native-health-connect)', () => {
  const native = [
    { time: iso(T0), latitude: 50.94, longitude: 6.95, altitude: { inMeters: 52 } },
    {
      time: iso(T0 + 1000),
      latitude: 50.9401,
      longitude: 6.95,
      horizontalAccuracy: { inMeters: 4 },
    },
    { time: iso(T0 + 2000), latitude: 95, longitude: 6.95 },
    'kaputt',
  ];

  it('DATA (Text oder Zahl) → Punkte; ungültige fallen weg; Höhe/Genauigkeit in Metern', () => {
    const r = hcRouteFromRecord({ type: 'DATA', route: native });
    expect(r.kind).toBe('points');
    if (r.kind !== 'points') return;
    expect(r.points).toHaveLength(2);
    expect(r.points[0]).toMatchObject({ altitudeM: 52, accuracyM: null });
    expect(r.points[1]).toMatchObject({ altitudeM: null, accuracyM: 4 });
    expect(hcRouteFromRecord({ type: 0, route: native }).kind).toBe('points');
    expect(hcLocationsFromNative(native)).toHaveLength(2);
  });

  it('CONSENT_REQUIRED → Freigabe je Einheit; NO_DATA, leer, fehlend → keine Route', () => {
    expect(hcRouteFromRecord({ type: 'CONSENT_REQUIRED', route: [] })).toEqual({
      kind: 'consent_required',
    });
    expect(hcRouteFromRecord({ type: 2 })).toEqual({ kind: 'consent_required' });
    expect(hcRouteFromRecord({ type: 'NO_DATA', route: [] })).toEqual({ kind: 'none' });
    expect(hcRouteFromRecord({ type: 'DATA', route: [] })).toEqual({ kind: 'none' });
    expect(hcRouteFromRecord(undefined)).toEqual({ kind: 'none' });
    expect(hcLocationsFromNative('x')).toEqual([]);
  });
});

describe('watchRouteSport / trackPointsFromHc', () => {
  it('nur Laufen, Gehen, Rad haben eine Strecke', () => {
    expect(watchRouteSport('run')).toBe('run');
    expect(watchRouteSport('walk')).toBe('walk');
    expect(watchRouteSport('bike')).toBe('bike');
    expect(watchRouteSport('swim')).toBeNull();
    expect(watchRouteSport('strength')).toBeNull();
    expect(watchRouteSport('other')).toBeNull();
  });

  it('ungültige Zeitpunkte fallen weg, sortiert nach Zeit, Höhe fehlt → null', () => {
    const points = trackPointsFromHc([
      { time: iso(T0 + 2000), latitude: 50, longitude: 7 },
      { time: 'kaputt', latitude: 50, longitude: 7 },
      { time: iso(T0), latitude: 50, longitude: 7, altitudeM: 40 },
    ]);
    expect(points.map((p) => p.t)).toEqual([T0, T0 + 2000]);
    expect(points[0]?.altitudeM).toBe(40);
    expect(points[1]?.altitudeM).toBeNull();
  });
});

describe('summarizeWatchRoute', () => {
  it('10 km Lauf: Distanz aus der Route (±1 %), 10 Kilometerzeiten, Höhenmeter, Bewegungszeit ≤ Dauer', () => {
    const count = 3334; // 3 m/s → ca. 10 km
    const r = summarizeWatchRoute(loop({ speedMps: 3, count }), 'run', window(count));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.summary.distanceM).toBeGreaterThan(9900);
    expect(r.summary.distanceM).toBeLessThan(10_100);
    expect(r.summary.kmSplits).toHaveLength(Math.floor(r.summary.distanceM / 1000));
    expect(r.summary.movingS).toBeLessThanOrEqual(count - 1);
    expect(r.summary.elevationGainM).not.toBeNull();
    const payload = wearableRoutePayload('hc-1', r.summary);
    expect(payload).not.toBeNull();
    expect(wearableRoutePayloadSchema.safeParse(payload).success).toBe(true);
  });

  it('Gründer-Test: Route 22,8 km, Health Connect nur 21,8 km → Distanz aus der Route', () => {
    const count = 7610; // 3 m/s → ca. 22,8 km
    const r = summarizeWatchRoute(loop({ speedMps: 3, count }), 'run', window(count), 21_800);
    expect(r.kind).toBe('ok');
    const choice = chooseWatchDistance({
      route: r,
      storedRouteDistanceM: null,
      hcDistanceM: 21_800,
    });
    expect(choice.source).toBe('route');
    expect(choice.distanceM).toBeGreaterThan(22_500);
  });

  it('keine Punkte und 1 Punkt → zu wenige Punkte', () => {
    expect(summarizeWatchRoute([], 'run', window(100))).toEqual({
      kind: 'unusable',
      reason: 'too_few_points',
    });
    expect(summarizeWatchRoute(loop({ speedMps: 3, count: 1 }), 'run', window(100))).toEqual({
      kind: 'unusable',
      reason: 'too_few_points',
    });
    const few = loop({ speedMps: 3, count: WEARABLE_ROUTE.minPoints - 1, stepS: 10 });
    expect(summarizeWatchRoute(few, 'run', window(WEARABLE_ROUTE.minPoints - 1, 10)).kind).toBe(
      'unusable',
    );
  });

  it('GPS-Sprünge werden herausgefiltert (Distanz bleibt)', () => {
    const count = 1200;
    const clean = loop({ speedMps: 3, count });
    const jumpy = clean.map((p, i) =>
      i % 97 === 50
        ? { ...p, latitude: p.latitude + 0.02, longitude: p.longitude + 0.02 } // ca. 2,6 km daneben
        : p,
    );
    const a = summarizeWatchRoute(clean, 'run', window(count));
    const b = summarizeWatchRoute(jumpy, 'run', window(count));
    expect(a.kind).toBe('ok');
    expect(b.kind).toBe('ok');
    if (a.kind !== 'ok' || b.kind !== 'ok') return;
    expect(Math.abs(a.summary.distanceM - b.summary.distanceM)).toBeLessThan(
      a.summary.distanceM * 0.02,
    );
  });

  it('Pause in der Mitte: Bewegungszeit kürzer als die Dauer, Distanz unverändert', () => {
    const run = loop({ speedMps: 3, count: 1200 });
    const stop = run[599] as HcRouteLocation;
    const shift = (p: HcRouteLocation) => ({ ...p, time: iso(Date.parse(p.time) + 300_000) });
    const pause = Array.from({ length: 300 }, (_, i) => ({
      ...stop,
      time: iso(Date.parse(stop.time) + (i + 1) * 1000),
    }));
    const all = [...run.slice(0, 600), ...pause, ...run.slice(600).map(shift)];
    const r = summarizeWatchRoute(all, 'run', {
      startedAt: all[0]?.time as string,
      finishedAt: all.at(-1)?.time as string,
    });
    const plain = summarizeWatchRoute(run, 'run', window(1200));
    expect(r.kind).toBe('ok');
    expect(plain.kind).toBe('ok');
    if (r.kind !== 'ok' || plain.kind !== 'ok') return;
    expect(r.summary.movingS).toBeLessThan(1500 - 200);
    expect(Math.abs(r.summary.distanceM - plain.summary.distanceM)).toBeLessThan(30);
  });

  it('Marathon (42 km): höchstens maxPoints Punkte in der Linie, 42 Kilometerzeiten, Eingabe gültig', () => {
    const count = 12_800; // 3,3 m/s → ca. 42,2 km
    const r = summarizeWatchRoute(loop({ speedMps: 3.3, count }), 'run', window(count));
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.summary.distanceM).toBeGreaterThan(41_700);
    expect(r.summary.kmSplits).toHaveLength(42);
    const payload = wearableRoutePayload('hc-marathon', r.summary);
    expect(payload).not.toBeNull();
    expect(decodePolyline(payload?.polyline ?? '')?.length).toBeLessThanOrEqual(
      TRACKED_ROUTE_LIMITS.maxPoints,
    );
  });

  it('Höhe fehlt: Route gilt, ohne Höhenmeter und ohne Höhenprofil', () => {
    const count = 1000;
    const r = summarizeWatchRoute(
      loop({ speedMps: 3, count, altitude: () => null }),
      'run',
      window(count),
    );
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.summary.elevationGainM).toBeNull();
    expect(wearableRoutePayload('hc-1', r.summary)?.elevation_profile).toBeNull();
  });

  it('Route deckt weniger als die Hälfte der Einheit ab → nicht verwendet', () => {
    const r = summarizeWatchRoute(loop({ speedMps: 3, count: 400 }), 'run', window(1000));
    expect(r).toEqual({ kind: 'unusable', reason: 'coverage' });
  });

  it('Punkte außerhalb der Einheit zählen nicht', () => {
    const count = 1000;
    const inside = loop({ speedMps: 3, count });
    const before = loop({ speedMps: 3, count: 300, t0: T0 - 400_000 });
    const a = summarizeWatchRoute(inside, 'run', window(count));
    const b = summarizeWatchRoute([...before, ...inside], 'run', window(count));
    expect(b).toEqual(a);
  });

  it('zu schnell für Laufen (im Auto) → unplausibel; Schwimmen → keine Sportart', () => {
    const count = 600;
    expect(summarizeWatchRoute(loop({ speedMps: 15, count }), 'run', window(count))).toEqual({
      kind: 'unusable',
      reason: 'implausible',
    });
    expect(summarizeWatchRoute(loop({ speedMps: 1, count }), 'swim', window(count))).toEqual({
      kind: 'unusable',
      reason: 'no_sport',
    });
  });

  it('starke Abweichung zu Health Connect → Distanz laut Health Connect', () => {
    const count = 1000; // ca. 3 km
    const r = summarizeWatchRoute(loop({ speedMps: 3, count }), 'run', window(count), 8000);
    expect(r).toEqual({ kind: 'unusable', reason: 'mismatch' });
    expect(
      chooseWatchDistance({ route: r, storedRouteDistanceM: null, hcDistanceM: 8000 }),
    ).toEqual({ distanceM: 8000, source: 'health_connect' });
  });
});

describe('chooseWatchDistance', () => {
  it('Route → gespeicherte Route → Health Connect → keine', () => {
    expect(
      chooseWatchDistance({ route: null, storedRouteDistanceM: 5100, hcDistanceM: 4900 }),
    ).toEqual({ distanceM: 5100, source: 'stored_route' });
    expect(
      chooseWatchDistance({ route: null, storedRouteDistanceM: null, hcDistanceM: 4900 }),
    ).toEqual({ distanceM: 4900, source: 'health_connect' });
    expect(
      chooseWatchDistance({ route: null, storedRouteDistanceM: null, hcDistanceM: null }),
    ).toEqual({ distanceM: null, source: null });
  });
});

describe('wearableRoutePayloadSchema', () => {
  it('Kilometerzeiten müssen zur Distanz passen und dürfen die Bewegungszeit nicht übersteigen', () => {
    const base = {
      external_id: 'hc-1',
      distance_m: 2100,
      moving_s: 700,
      elevation_gain_m: null,
      polyline: '_p~iF~ps|U_ulLnnqC',
      km_splits: [330, 340],
      elevation_profile: null,
    };
    expect(wearableRoutePayloadSchema.safeParse(base).success).toBe(true);
    expect(wearableRoutePayloadSchema.safeParse({ ...base, km_splits: [330] }).success).toBe(false);
    expect(wearableRoutePayloadSchema.safeParse({ ...base, km_splits: [400, 400] }).success).toBe(
      false,
    );
    expect(wearableRoutePayloadSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(wearableRoutePayloadSchema.safeParse({ ...base, polyline: '_p~iF~ps|U' }).success).toBe(
      false,
    );
  });
});

describe('sessionFromHc mit Route (23.10.2026)', () => {
  const count = 2000; // ca. 6 km in 33 min
  const record = {
    id: 'hc-run',
    exerciseType: 56,
    startTime: iso(T0),
    endTime: iso(T0 + (count - 1) * 1000),
    dataOrigin: 'com.sec.android.app.shealth',
  };
  const points = loop({ speedMps: 3, count });

  it('Route da → Distanz aus der Route, Route zum Speichern', () => {
    const r = sessionFromHc(
      record,
      { distanceM: 5700, route: { kind: 'points', points } },
      { hfMax: null },
    );
    expect(r.kind).toBe('ok');
    if (r.kind !== 'ok') return;
    expect(r.routeStatus).toBe('route');
    expect(r.distanceSource).toBe('route');
    expect(r.route?.external_id).toBe('hc-run');
    expect(r.session.distance_m).toBe(r.route?.distance_m);
    expect(r.session.distance_m).not.toBe(5700);
  });

  it('Freigabe je Einheit nötig: ohne gespeicherte Route laut Health Connect, mit gespeicherter Route diese', () => {
    const consent = { kind: 'consent_required' } as const;
    const a = sessionFromHc(record, { distanceM: 5700, route: consent }, { hfMax: null });
    expect(a.kind === 'ok' && [a.routeStatus, a.session.distance_m, a.route]).toEqual([
      'consent_required',
      5700,
      null,
    ]);
    const b = sessionFromHc(
      record,
      { distanceM: 5700, route: consent },
      { hfMax: null, storedRouteDistanceM: 5980 },
    );
    expect(b.kind === 'ok' && [b.routeStatus, b.session.distance_m, b.distanceSource]).toEqual([
      'stored_route',
      5980,
      'stored_route',
    ]);
  });

  it('keine Route bzw. unbrauchbare Route → laut Health Connect', () => {
    const none = sessionFromHc(
      record,
      { distanceM: 5700, route: { kind: 'none' } },
      { hfMax: null },
    );
    expect(none.kind === 'ok' && [none.routeStatus, none.session.distance_m]).toEqual([
      'none',
      5700,
    ]);
    const few = sessionFromHc(
      record,
      { distanceM: 5700, route: { kind: 'points', points: points.slice(0, 3) } },
      { hfMax: null },
    );
    expect(few.kind === 'ok' && [few.routeStatus, few.session.distance_m]).toEqual([
      'unusable',
      5700,
    ]);
  });

  it('Kraft mit Route: keine Distanz, keine Route', () => {
    const r = sessionFromHc(
      { ...record, exerciseType: 70 },
      { distanceM: 5700, route: { kind: 'points', points } },
      { hfMax: null, storedRouteDistanceM: 5000 },
    );
    expect(r.kind === 'ok' && [r.routeStatus, r.session.distance_m, r.route]).toEqual([
      'not_applicable',
      null,
      null,
    ]);
  });
});

describe('releasedWatchRoute („Route freigeben“)', () => {
  const count = 1500;
  const session = {
    externalId: 'hc-1',
    group: 'run' as const,
    startedAt: iso(T0),
    finishedAt: iso(T0 + (count - 1) * 1000),
    currentDistanceM: 4300,
  };
  it('Punkte → Eingabe für save_wearable_route; keine Route, abgelehnt, unbrauchbar', () => {
    const ok = releasedWatchRoute(
      { kind: 'points', points: loop({ speedMps: 3, count }) },
      session,
    );
    expect(ok.kind).toBe('ok');
    expect(ok.kind === 'ok' && ok.payload.external_id).toBe('hc-1');
    expect(releasedWatchRoute({ kind: 'none' }, session)).toEqual({ kind: 'none' });
    expect(releasedWatchRoute({ kind: 'not_granted' }, session)).toEqual({ kind: 'denied' });
    expect(releasedWatchRoute({ kind: 'error' }, session)).toEqual({ kind: 'denied' });
    expect(
      releasedWatchRoute({ kind: 'points', points: loop({ speedMps: 3, count: 3 }) }, session),
    ).toEqual({ kind: 'unusable' });
  });
});
