import { describe, expect, it } from 'vitest';

import {
  CARDIO_PLAUSIBILITY_KMH,
  ROUTE_AUTO_PAUSE_KMH,
  ROUTE_ELEVATION,
  ROUTE_FILTER,
} from '../constants';
import { seededRandom } from '../nutrition/test-helpers';
import { last, line, offset, START, T0 } from './test-helpers';
import {
  autoPause,
  elevationGain,
  filterTrackPoints,
  haversineM,
  hasSpeedWarning,
  jumpLimitMps,
  kmSplits,
  movingDistance,
  trackDistance,
  type TrackPoint,
} from './track';

describe('haversineM / trackDistance', () => {
  it('0 und 1 Punkt → 0 m', () => {
    expect(trackDistance([])).toBe(0);
    expect(trackDistance([START])).toBe(0);
  });

  it('2 Punkte: 1° Breite ≈ 111,195 km (mittlerer Erdradius)', () => {
    expect(
      trackDistance([
        { lat: 0, lng: 0 },
        { lat: 1, lng: 0 },
      ]),
    ).toBeCloseTo(111_195, -1);
  });

  it('gleicher Punkt → 0, Abstand ist symmetrisch, antipodal ≈ halber Erdumfang', () => {
    expect(haversineM(START, START)).toBe(0);
    const b = offset(START, 300, 400);
    expect(haversineM(START, b)).toBeCloseTo(haversineM(b, START), 9);
    expect(haversineM(START, b)).toBeCloseTo(500, 0);
    expect(haversineM({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(20_015_115, -2);
  });
});

describe('filterTrackPoints', () => {
  it('0 Punkte → leer; 1 Punkt bleibt; 2 Punkte bleiben', () => {
    expect(filterTrackPoints([], 'run').points).toEqual([]);
    const one = line({ speedMps: 3, count: 1 });
    expect(filterTrackPoints(one, 'run').points).toEqual(one);
    const two = line({ speedMps: 3, count: 2, stepS: 5 });
    expect(filterTrackPoints(two, 'run').points).toEqual(two);
  });

  it(`Genauigkeit über ${ROUTE_FILTER.maxAccuracyM} m fällt raus, genau ${ROUTE_FILTER.maxAccuracyM} m und unbekannt bleiben`, () => {
    const pts = line({ speedMps: 3, count: 4, stepS: 5 });
    const input: TrackPoint[] = [
      { ...(pts[0] as TrackPoint), accuracyM: ROUTE_FILTER.maxAccuracyM },
      { ...(pts[1] as TrackPoint), accuracyM: ROUTE_FILTER.maxAccuracyM + 0.1 },
      { ...(pts[2] as TrackPoint), accuracyM: null },
      { ...(pts[3] as TrackPoint), accuracyM: Number.NaN },
    ];
    const r = filterTrackPoints(input, 'run');
    expect(r.points).toEqual([input[0], input[2]]);
    expect(r.dropped.inaccurate).toBe(2);
  });

  it('ungültige Koordinaten (NaN, Breite 91, Länge −181, Zeit unendlich) fallen raus', () => {
    const [a] = line({ speedMps: 3, count: 1 }) as [TrackPoint];
    const r = filterTrackPoints(
      [
        { ...a, lat: Number.NaN },
        { ...a, lat: 91 },
        { ...a, lng: -181 },
        { ...a, t: Number.POSITIVE_INFINITY },
        a,
      ],
      'run',
    );
    expect(r.points).toEqual([a]);
    expect(r.dropped.invalid).toBe(4);
  });

  it('doppelte Zeitstempel: nur der erste Punkt bleibt', () => {
    const pts = line({ speedMps: 3, count: 3, stepS: 5 });
    const dup = { ...(pts[1] as TrackPoint), lat: (pts[1] as TrackPoint).lat + 0.0001 };
    const r = filterTrackPoints([pts[0], pts[1], dup, pts[2]] as TrackPoint[], 'run');
    expect(r.points).toEqual(pts);
    expect(r.dropped.timeNotIncreasing).toBe(1);
  });

  it('Zeit rückwärts fällt raus (danach geht es normal weiter)', () => {
    const pts = line({ speedMps: 3, count: 4, stepS: 5 });
    const back = { ...(pts[3] as TrackPoint), t: (pts[0] as TrackPoint).t - 1000 };
    const r = filterTrackPoints([pts[0], pts[1], back, pts[2], pts[3]] as TrackPoint[], 'run');
    expect(r.points).toEqual(pts);
    expect(r.dropped.timeNotIncreasing).toBe(1);
  });

  it('Stillstand: 10 min am selben Ort (mit Rauschen unter 1 m) → ein Punkt, Distanz 0', () => {
    const rand = seededRandom(7);
    const still: TrackPoint[] = Array.from({ length: 600 }, (_, i) => ({
      ...offset(START, rand() - 0.5, rand() - 0.5),
      t: T0 + i * 1000,
      accuracyM: 4,
    }));
    const r = filterTrackPoints(still, 'run');
    expect(r.points).toHaveLength(1);
    expect(r.dropped.stationary).toBe(599);
    expect(trackDistance(r.points)).toBe(0);
    expect(movingDistance(r.points, 'run')).toBe(0);
  });

  it('GPS-Sprung: ein Punkt 2 km daneben fällt raus, die Strecke danach bleibt', () => {
    const pts = line({ speedMps: 3.5, count: 60, stepS: 1 });
    const jumped = pts.map((p, i) => (i === 30 ? { ...p, ...offset(p, 0, 2000) } : p));
    const r = filterTrackPoints(jumped, 'run');
    expect(r.dropped.jump).toBe(1);
    expect(r.points).toHaveLength(59);
    expect(trackDistance(r.points)).toBeCloseTo(59 * 3.5, 0);
  });

  it('Sprung-Schwelle = jumpFactor × CARDIO_PLAUSIBILITY_KMH; knapp darunter bleibt, knapp darüber fällt raus', () => {
    for (const sport of ['run', 'bike', 'walk'] as const) {
      const limit = jumpLimitMps(sport);
      expect(limit * 3.6).toBeCloseTo(CARDIO_PLAUSIBILITY_KMH[sport] * ROUTE_FILTER.jumpFactor, 9);
      const below = line({ speedMps: limit * 0.99, count: 3, stepS: 10 });
      expect(filterTrackPoints(below, sport).points).toHaveLength(3);
      const above = line({ speedMps: limit * 1.01, count: 3, stepS: 10 });
      expect(filterTrackPoints(above, sport).points).toHaveLength(1);
    }
  });

  it('Eingabe bleibt unverändert; Filter ist idempotent', () => {
    const rand = seededRandom(11);
    const pts: TrackPoint[] = Array.from({ length: 500 }, (_, i) => ({
      ...offset(START, i * 3 + (rand() - 0.5) * 40, (rand() - 0.5) * 40),
      t: T0 + Math.round(i * 1000 + (rand() - 0.2) * 1500),
      accuracyM: rand() * 40,
    }));
    const copy = JSON.stringify(pts);
    const once = filterTrackPoints(pts, 'run').points;
    expect(JSON.stringify(pts)).toBe(copy);
    expect(filterTrackPoints(once, 'run').points).toEqual(once);
  });
});

describe('autoPause', () => {
  it('weniger als 2 Punkte → keine Abschnitte', () => {
    expect(autoPause([], 'run')).toEqual({ moving: [], movingS: 0, pausedS: 0 });
    expect(autoPause(line({ speedMps: 3, count: 1 }), 'run').moving).toEqual([]);
  });

  it('Laufen 3,5 m/s → Bewegung; 2 min Stehen → Pause', () => {
    const a = line({ speedMps: 3.5, count: 61, stepS: 1 });
    const stop = { ...last(a), t: last(a).t + 120_000 };
    const b = line({ speedMps: 3.5, count: 61, stepS: 1, start: last(a), t0: stop.t + 1000 }).slice(
      1,
    );
    const pts = filterTrackPoints([...a, stop, ...b], 'run').points;
    const r = autoPause(pts, 'run');
    // Stehen: vom letzten Punkt vor dem Halt bis zum ersten Punkt danach (120 s + 2 s Anlauf).
    expect(r.pausedS).toBeCloseTo(122, 6);
    expect(r.movingS).toBeCloseTo(60 + 59, 6);
  });

  it(`Schwelle je Sportart (ROUTE_AUTO_PAUSE_KMH): knapp darunter Pause, ab der Schwelle Bewegung`, () => {
    for (const sport of ['run', 'bike', 'walk'] as const) {
      const v = ROUTE_AUTO_PAUSE_KMH[sport] / 3.6;
      expect(autoPause(line({ speedMps: v * 0.98, count: 2, stepS: 60 }), sport).moving).toEqual([
        false,
      ]);
      expect(autoPause(line({ speedMps: v * 1.02, count: 2, stepS: 60 }), sport).moving).toEqual([
        true,
      ]);
    }
  });

  it('Funkloch 5 min: Lücke mit Lauftempo zählt als Bewegung samt Distanz der geraden Linie', () => {
    const a = line({ speedMps: 3.5, count: 121, stepS: 1 });
    // 5 min ohne Punkt, danach 1.050 m weiter (3,5 m/s).
    const b = line({
      speedMps: 3.5,
      count: 121,
      stepS: 1,
      start: offset(last(a), 1050, 0),
      t0: last(a).t + 300_000,
    });
    const pts = filterTrackPoints([...a, ...b], 'run').points;
    expect(pts).toHaveLength(242);
    const r = autoPause(pts, 'run');
    expect(r.pausedS).toBe(0);
    expect(r.movingS).toBeCloseTo(120 + 300 + 120, 6);
    expect(movingDistance(pts, 'run')).toBeCloseTo(420 + 1050 + 420, 0);
    expect(kmSplits(pts, 'run')).toHaveLength(1);
  });

  it('Funkloch, in dem man stand (5 min, 20 m weiter) → Pause, keine Distanz', () => {
    const a = line({ speedMps: 3.5, count: 61, stepS: 1 });
    const b = line({
      speedMps: 3.5,
      count: 61,
      stepS: 1,
      start: offset(last(a), 20, 0),
      t0: last(a).t + 300_000,
    });
    const pts = filterTrackPoints([...a, ...b], 'run').points;
    const r = autoPause(pts, 'run');
    expect(r.pausedS).toBeCloseTo(300, 6);
    expect(movingDistance(pts, 'run')).toBeCloseTo(420, 0);
  });
});

describe('elevationGain', () => {
  it('weniger als 2 Punkte mit Höhe → null, Hinweis immer gesetzt', () => {
    expect(elevationGain([])).toEqual({ gainM: null, note: 'gps_elevation_inaccurate' });
    expect(elevationGain(line({ speedMps: 3, count: 10 }))).toEqual({
      gainM: null,
      note: 'gps_elevation_inaccurate',
    });
    const one = line({ speedMps: 3, count: 10, altitude: (i) => (i === 3 ? 100 : null) });
    expect(elevationGain(one).gainM).toBeNull();
  });

  it(`flach mit GPS-Rauschen (±${ROUTE_ELEVATION.thresholdM / 2} m) → 0 Höhenmeter`, () => {
    const rand = seededRandom(3);
    const pts = line({
      speedMps: 3,
      count: 2000,
      altitude: () => 50 + (rand() - 0.5) * ROUTE_ELEVATION.thresholdM,
    });
    expect(elevationGain(pts).gainM).toBe(0);
  });

  it('gleichmäßiger Anstieg um 100 m → ca. 100 Höhenmeter; bergab zählt nicht', () => {
    const up = line({ speedMps: 3, count: 1001, altitude: (i) => 100 + i * 0.1 });
    expect(elevationGain(up).gainM).toBeGreaterThanOrEqual(98);
    expect(elevationGain(up).gainM).toBeLessThanOrEqual(100);
    const down = line({ speedMps: 3, count: 1001, altitude: (i) => 200 - i * 0.1 });
    expect(elevationGain(down).gainM).toBe(0);
  });

  it('zweimal 50 m hoch und runter → ca. 100 Höhenmeter', () => {
    const wave = line({
      speedMps: 3,
      count: 2001,
      altitude: (i) => 100 + 25 * (1 - Math.cos((i / 1000) * 2 * Math.PI)),
    });
    const g = elevationGain(wave).gainM as number;
    expect(g).toBeGreaterThan(90);
    expect(g).toBeLessThanOrEqual(100);
  });
});

describe('kmSplits', () => {
  // 3 m/s, Punkte jede Sekunde: 0,99 km = 330 s, 1,01 km ≈ 336,7 s.
  it('0,99 km → keine Kilometerzeit', () => {
    const pts = line({ speedMps: 3, count: 331 });
    expect(movingDistance(pts, 'run')).toBeCloseTo(990, 6);
    expect(kmSplits(pts, 'run')).toEqual([]);
  });

  it('1,01 km → genau eine Kilometerzeit (333 s)', () => {
    const pts = line({ speedMps: 3, count: 338 });
    expect(movingDistance(pts, 'run')).toBeGreaterThan(1010);
    expect(kmSplits(pts, 'run')).toEqual([333]);
  });

  it('0, 1, 2 Punkte → keine Kilometerzeit', () => {
    expect(kmSplits([], 'run')).toEqual([]);
    expect(kmSplits(line({ speedMps: 3, count: 1 }), 'run')).toEqual([]);
    expect(kmSplits(line({ speedMps: 3, count: 2, stepS: 100 }), 'run')).toEqual([]);
  });

  it('ein langer Abschnitt über mehrere Kilometer-Grenzen (Funkloch) → je km eine Zeit', () => {
    const pts = line({ speedMps: 4, count: 2, stepS: 1000 });
    expect(kmSplits(pts, 'run')).toEqual([250, 250, 250, 250]);
  });

  it('Pause zählt nicht in die Kilometerzeit', () => {
    const a = line({ speedMps: 2.5, count: 201 });
    const stop = { ...last(a), t: last(a).t + 300_000 };
    const b = line({ speedMps: 2.5, count: 300, start: last(a), t0: stop.t + 1000 }).slice(1);
    const pts = filterTrackPoints([...a, stop, ...b], 'run').points;
    expect(kmSplits(pts, 'run')).toEqual([400]);
  });

  it('Summe der Kilometerzeiten nie über der gerundeten Bewegungszeit (Zufallsstrecken)', () => {
    const rand = seededRandom(99);
    for (let k = 0; k < 30; k += 1) {
      const pts: TrackPoint[] = [];
      let pos: { lat: number; lng: number } = { ...START };
      let t = T0;
      for (let i = 0; i < 1500; i += 1) {
        pos = offset(pos, (rand() - 0.2) * 8, (rand() - 0.5) * 8);
        t += 1000 + Math.floor(rand() * 3000);
        pts.push({ ...pos, t, accuracyM: rand() * 35 });
      }
      const f = filterTrackPoints(pts, 'run').points;
      const splits = kmSplits(f, 'run');
      const moving = Math.round(autoPause(f, 'run').movingS);
      expect(splits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(moving);
      expect(splits).toHaveLength(Math.floor(movingDistance(f, 'run') / 1000));
      for (const s of splits) expect(s).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('hasSpeedWarning', () => {
  it('Bergab-Rad mit 70 km/h → Warnung, kein Punkt verworfen', () => {
    const pts = line({ speedMps: 70 / 3.6, count: 61 });
    const f = filterTrackPoints(pts, 'bike');
    expect(f.points).toHaveLength(61);
    expect(hasSpeedWarning(f.points, 'bike')).toBe(true);
  });

  it('Rad mit 50 km/h, Laufen mit 15 km/h → keine Warnung', () => {
    expect(hasSpeedWarning(line({ speedMps: 50 / 3.6, count: 120 }), 'bike')).toBe(false);
    expect(hasSpeedWarning(line({ speedMps: 15 / 3.6, count: 120 }), 'run')).toBe(false);
  });

  it('kurze Spitze unter 10 s → keine Warnung; 10 s am Stück → Warnung', () => {
    const slow = line({ speedMps: 4, count: 60 });
    const fast = line({ speedMps: 30 / 3.6, count: 6, start: last(slow), t0: last(slow).t + 1000 });
    const after = line({ speedMps: 4, count: 60, start: last(fast), t0: last(fast).t + 1000 });
    expect(hasSpeedWarning([...slow, ...fast, ...after], 'run')).toBe(false);
    const long = line({
      speedMps: 30 / 3.6,
      count: 12,
      start: last(slow),
      t0: last(slow).t + 1000,
    });
    expect(hasSpeedWarning([...slow, ...long], 'run')).toBe(true);
  });

  it('0, 1, 2 Punkte → keine Warnung (zu kurz für das Fenster)', () => {
    expect(hasSpeedWarning([], 'bike')).toBe(false);
    expect(hasSpeedWarning(line({ speedMps: 30, count: 1 }), 'bike')).toBe(false);
    expect(hasSpeedWarning(line({ speedMps: 30, count: 2, stepS: 5 }), 'bike')).toBe(false);
  });
});
