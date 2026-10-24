import { describe, expect, it } from 'vitest';

import { CARDIO_PLAUSIBILITY_KMH, ROUTE_FILTER, TRACKED_ROUTE_LIMITS } from '../constants';
import { seededRandom } from '../nutrition/test-helpers';
import { decodePolyline, encodePolyline } from './polyline';
import {
  sessionLogFitsRoute,
  summarizeTrack,
  toTrackedRoutePayload,
  trackedRouteDistancePlausible,
  trackedRouteSchema,
  updateTrackedRouteSchema,
  type TrackedRouteDetails,
  type TrackedRoutePayload,
} from './schema';
import { last, line, offset, START, T0 } from './test-helpers';
import { autoPause, filterTrackPoints, trackDistance, type TrackPoint } from './track';

const ID = '0b9c8a52-6f0e-4d39-9a51-2f1f5d0f7a11';
const OTHER_ID = '7d2a0c1e-3b4f-4a5b-8c6d-9e0f1a2b3c4d';

function valid(changes: Partial<TrackedRoutePayload> = {}): TrackedRoutePayload {
  return {
    id: ID,
    name: 'Runde am Rhein',
    sport: 'run',
    started_at: '2026-10-16T07:00:00.000Z',
    duration_s: 1800,
    moving_s: 1750,
    distance_m: 5200,
    elevation_gain_m: 12,
    polyline: encodePolyline([START, offset(START, 1000, 0), offset(START, 1000, 1000)]),
    km_splits: [340, 335, 338, 341, 330],
    difficulty: 'easy',
    is_favorite: true,
    base_route_id: null,
    note: null,
    session_log_id: null,
    source: 'recorded',
    ...changes,
  };
}

const details: TrackedRouteDetails = {
  id: ID,
  name: 'Runde',
  difficulty: null,
  isFavorite: false,
  note: null,
  baseRouteId: null,
  sessionLogId: null,
  source: 'recorded',
};

const ok = (p: unknown) => trackedRouteSchema.safeParse(p).success;

describe('trackedRouteSchema (Eingabe von save_tracked_route)', () => {
  it('gültige Eingabe; Name wird getrimmt', () => {
    expect(ok(valid())).toBe(true);
    expect(trackedRouteSchema.parse(valid({ name: '  Runde ' })).name).toBe('Runde');
  });

  it.each([
    ['Name leer', { name: '   ' }],
    ['Name 81 Zeichen', { name: 'x'.repeat(TRACKED_ROUTE_LIMITS.nameMaxLength + 1) }],
    ['Notiz leer', { note: '' }],
    ['Notiz 281 Zeichen', { note: 'ä'.repeat(TRACKED_ROUTE_LIMITS.noteMaxChars + 1) }],
    ['Schwimmen', { sport: 'swim' }],
    ['Schwierigkeit unbekannt', { difficulty: 'extreme' }],
    ['Herkunft unbekannt', { source: 'strava' }],
    ['Dauer 59 s', { duration_s: 59, moving_s: 59 }],
    ['Dauer 12 h + 1 s', { duration_s: 43_201 }],
    ['Dauer mit Komma', { duration_s: 1800.5 }],
    ['Bewegung länger als Dauer', { moving_s: 1801 }],
    ['Bewegung negativ', { moving_s: -1 }],
    ['Distanz negativ', { distance_m: -1 }],
    ['Distanz über 500 km', { distance_m: 500_001 }],
    ['Höhenmeter über 10.000', { elevation_gain_m: 10_001 }],
    ['Kilometerzeiten zu wenige', { km_splits: [340, 335, 338, 341] }],
    ['Kilometerzeiten zu viele', { km_splits: [340, 335, 338, 341, 330, 300] }],
    ['Kilometerzeit 0', { km_splits: [0, 335, 338, 341, 330] }],
    ['Summe der Kilometerzeiten über der Bewegung', { km_splits: [400, 400, 400, 400, 151] }],
    ['Polyline mit Leerzeichen', { polyline: '_p~iF ~ps|U' }],
    ['Polyline leer', { polyline: '' }],
    ['Polyline 1 Punkt', { polyline: encodePolyline([START]) }],
    ['Polyline abgeschnitten', { polyline: '_p~iF~ps|' }],
    ['Polyline zu lang', { polyline: '?'.repeat(TRACKED_ROUTE_LIMITS.polylineMaxChars + 1) }],
    ['Beginn ohne Zeitzone', { started_at: '2026-10-16T07:00:00' }],
    ['Beginn vor 2020', { started_at: '2019-12-31T23:59:59Z' }],
    ['Wiederholung von sich selbst', { base_route_id: ID }],
    ['id kein UUID', { id: 'abc' }],
  ] as const)('abgelehnt: %s', (_, changes) => {
    expect(ok({ ...valid(), ...changes })).toBe(false);
  });

  it('unbekanntes oder fehlendes Feld abgelehnt; Server-Felder (user_id, point_count, bbox) nie in der Eingabe', () => {
    expect(ok({ ...valid(), user_id: OTHER_ID })).toBe(false);
    expect(ok({ ...valid(), point_count: 3 })).toBe(false);
    expect(ok({ ...valid(), bbox: [0, 0, 1, 1] })).toBe(false);
    const missing: Record<string, unknown> = { ...valid() };
    delete missing.note;
    expect(ok(missing)).toBe(false);
  });

  it('Grenzen genau: 80 Zeichen, 280 Zeichen (Code-Points), 60 s, 12 h, 0 m', () => {
    expect(ok(valid({ name: 'x'.repeat(80) }))).toBe(true);
    expect(ok(valid({ note: '🏃'.repeat(280) }))).toBe(true);
    expect(ok(valid({ duration_s: 60, moving_s: 0, distance_m: 0, km_splits: [] }))).toBe(true);
    expect(ok(valid({ duration_s: 43_200 }))).toBe(true);
    expect(ok(valid({ elevation_gain_m: null, difficulty: null }))).toBe(true);
  });

  it(`Punkte: ${TRACKED_ROUTE_LIMITS.maxPoints} ok, ${TRACKED_ROUTE_LIMITS.maxPoints + 1} abgelehnt`, () => {
    const pts = (n: number) => Array.from({ length: n }, (_, i) => offset(START, i, 0));
    expect(ok(valid({ polyline: encodePolyline(pts(TRACKED_ROUTE_LIMITS.maxPoints)) }))).toBe(true);
    expect(ok(valid({ polyline: encodePolyline(pts(TRACKED_ROUTE_LIMITS.maxPoints + 1)) }))).toBe(
      false,
    );
  });

  it('Distanz-Plausibilität: Durchschnitt höchstens jumpFactor × CARDIO_PLAUSIBILITY_KMH über die Dauer', () => {
    for (const sport of ['run', 'bike', 'walk'] as const) {
      const kmh = CARDIO_PLAUSIBILITY_KMH[sport] * ROUTE_FILTER.jumpFactor;
      // In 1 h genau kmh Kilometer erlaubt, 1 m mehr nicht.
      expect(trackedRouteDistancePlausible(sport, kmh * 1000, 3600)).toBe(true);
      expect(trackedRouteDistancePlausible(sport, kmh * 1000 + 1, 3600)).toBe(false);
    }
    // 1 h Laufen mit 40 km: über 37,5 km/h → abgelehnt.
    expect(
      ok(
        valid({
          duration_s: 3600,
          moving_s: 3600,
          distance_m: 40_000,
          km_splits: Array(40).fill(90),
        }),
      ),
    ).toBe(false);
  });
});

describe('updateTrackedRouteSchema', () => {
  it('nur id, Name, Schwierigkeit, Favorit, Notiz', () => {
    expect(
      updateTrackedRouteSchema.safeParse({
        id: ID,
        name: 'X',
        difficulty: 'hard',
        is_favorite: true,
        note: null,
      }).success,
    ).toBe(true);
    expect(
      updateTrackedRouteSchema.safeParse({
        id: ID,
        name: 'X',
        difficulty: 'hard',
        is_favorite: true,
        note: null,
        polyline: 'a',
      }).success,
    ).toBe(false);
  });
});

describe('E-Bike an der Strecke (23.10.2026)', () => {
  it('trackedRouteSchema: e_bike optional, nur beim Rad', () => {
    expect(ok(valid({ sport: 'bike', e_bike: true }))).toBe(true);
    expect(ok(valid({ sport: 'bike', e_bike: false }))).toBe(true);
    expect(ok(valid({ sport: 'bike' }))).toBe(true);
    expect(ok(valid({ sport: 'run', e_bike: true }))).toBe(false);
    expect(ok(valid({ sport: 'walk', e_bike: true }))).toBe(false);
    expect(ok(valid({ sport: 'run', e_bike: false }))).toBe(true);
    expect(ok({ ...valid({ sport: 'bike' }), e_bike: 1 })).toBe(false);
  });

  it('updateTrackedRouteSchema: e_bike darf fehlen oder boolesch sein', () => {
    const base = { id: ID, name: 'X', difficulty: null, is_favorite: false, note: null };
    expect(updateTrackedRouteSchema.safeParse(base).success).toBe(true);
    expect(updateTrackedRouteSchema.safeParse({ ...base, e_bike: true }).success).toBe(true);
    expect(updateTrackedRouteSchema.safeParse({ ...base, e_bike: null }).success).toBe(false);
  });

  it('toTrackedRoutePayload: E-Bike nur beim Rad und nur, wenn gewählt', () => {
    const s = summarizeTrack(line({ speedMps: 6, count: 40, stepS: 10 }), 'bike');
    expect(toTrackedRoutePayload(s, { ...details, eBike: true })?.e_bike).toBe(true);
    expect(toTrackedRoutePayload(s, details)).not.toHaveProperty('e_bike');
    const run = summarizeTrack(line({ speedMps: 3, count: 40, stepS: 10 }), 'run');
    expect(toTrackedRoutePayload(run, { ...details, eBike: true })).not.toHaveProperty('e_bike');
  });
});

describe('summarizeTrack + toTrackedRoutePayload', () => {
  it('0 Punkte → zu kurz, nichts zu speichern', () => {
    const s = summarizeTrack([], 'run');
    expect(s).toMatchObject({
      tooShort: true,
      startedAt: null,
      distanceM: 0,
      durationS: 0,
      kmSplits: [],
      polyline: '',
      pointCount: 0,
      bbox: null,
    });
    expect(toTrackedRoutePayload(s, details)).toBeNull();
  });

  it('1 Punkt → zu kurz', () => {
    const s = summarizeTrack(line({ speedMps: 3, count: 1 }), 'run');
    expect(s.tooShort).toBe(true);
    expect(s.pointCount).toBe(1);
    expect(toTrackedRoutePayload(s, details)).toBeNull();
  });

  it('2 Punkte, 30 s → zu kurz (unter 1 min); 2 Punkte, 60 s → speicherbar', () => {
    expect(summarizeTrack(line({ speedMps: 3, count: 2, stepS: 30 }), 'run').tooShort).toBe(true);
    const s = summarizeTrack(line({ speedMps: 3, count: 2, stepS: 60 }), 'run');
    expect(s.tooShort).toBe(false);
    const p = toTrackedRoutePayload(s, details);
    expect(p).toMatchObject({ duration_s: 60, moving_s: 60, km_splits: [] });
    // 180 m, wegen Gleitkomma-Rechnung abgerundet auf 179 oder 180.
    expect(p?.distance_m).toBeGreaterThanOrEqual(179);
    expect(p?.distance_m).toBeLessThanOrEqual(180);
    expect(decodePolyline(p?.polyline ?? '')).toHaveLength(2);
  });

  it('Stillstand 10 min → Distanz 0, keine Bewegung', () => {
    const still: TrackPoint[] = Array.from({ length: 600 }, (_, i) => ({
      ...START,
      t: T0 + i * 1000,
      accuracyM: 3,
    }));
    const s = summarizeTrack(still, 'walk');
    expect(s.distanceM).toBe(0);
    expect(s.movingS).toBe(0);
    expect(s.tooShort).toBe(true);
  });

  it('12 h Gehen (Punkt alle 5 s) → speicherbar, Dauer genau 12 h', () => {
    const pts = line({ speedMps: 1.2, count: 12 * 720 + 1, stepS: 5 });
    const s = summarizeTrack(pts, 'walk');
    expect(s.durationS).toBe(43_200);
    expect(s.movingS).toBe(43_200);
    expect(Math.abs(s.distanceM - Math.floor(trackDistance(pts)))).toBeLessThanOrEqual(1);
    expect(s.kmSplits).toHaveLength(51);
    // Gerade Linie → 2 Punkte nach dem Vereinfachen.
    expect(s.pointCount).toBe(2);
    expect(toTrackedRoutePayload(s, details)).not.toBeNull();
  });

  it('12 h + 5 s → nicht speicherbar (Grenze wie cardio_logs)', () => {
    const s = summarizeTrack(line({ speedMps: 1.2, count: 12 * 720 + 2, stepS: 5 }), 'walk');
    expect(s.durationS).toBe(43_205);
    expect(toTrackedRoutePayload(s, details)).toBeNull();
  });

  it('Bergab-Rad 70 km/h → Warnung, trotzdem speicherbar', () => {
    const s = summarizeTrack(line({ speedMps: 70 / 3.6, count: 181 }), 'bike');
    expect(s.speedWarning).toBe(true);
    expect(Math.abs(s.distanceM - 3500)).toBeLessThanOrEqual(1);
    expect(toTrackedRoutePayload(s, { ...details, source: 'recorded' })).not.toBeNull();
  });

  it('100.000 Rohpunkte (ca. 28 h bei 1 Hz, gekappt auf 11 h) → unter 3 s, höchstens 5.000 Punkte, gültig', () => {
    const rand = seededRandom(100_000);
    const raw: TrackPoint[] = [];
    let pos: { lat: number; lng: number } = { ...START };
    let heading = 0;
    for (let i = 0; i < 100_000; i += 1) {
      heading += (rand() - 0.5) * 0.3;
      pos = offset(pos, Math.cos(heading) * 2.8, Math.sin(heading) * 2.8);
      const noisy = offset(pos, (rand() - 0.5) * 8, (rand() - 0.5) * 8);
      raw.push({
        ...noisy,
        // 0,4 s Abstand → 100.000 Punkte in ca. 11 h.
        t: T0 + i * 400,
        accuracyM: 3 + rand() * 30,
        altitudeM: 50 + Math.sin(i / 3000) * 40 + (rand() - 0.5) * 6,
      });
      if (i === 50_000) raw.push({ ...offset(pos, 3000, 0), t: T0 + i * 400 + 200, accuracyM: 5 });
    }
    const started = performance.now();
    const s = summarizeTrack(raw, 'run');
    const ms = performance.now() - started;
    expect(ms).toBeLessThan(3000);
    expect(s.pointCount).toBeLessThanOrEqual(TRACKED_ROUTE_LIMITS.maxPoints);
    expect(s.polyline.length).toBeLessThanOrEqual(TRACKED_ROUTE_LIMITS.polylineMaxChars);
    expect(s.durationS).toBeLessThanOrEqual(TRACKED_ROUTE_LIMITS.durationS.max);
    expect(toTrackedRoutePayload(s, details)).not.toBeNull();
  });

  it('Eigenschaft: Zufallsaufzeichnungen ergeben immer eine gültige Eingabe oder null – nie eine ungültige', () => {
    const rand = seededRandom(424242);
    let saved = 0;
    for (let k = 0; k < 60; k += 1) {
      const sport = (['run', 'bike', 'walk'] as const)[k % 3] as 'run' | 'bike' | 'walk';
      const speed = { run: 3.2, bike: 8, walk: 1.3 }[sport];
      const raw: TrackPoint[] = [];
      let pos: { lat: number; lng: number } = { ...START };
      let t = T0;
      const n = Math.floor(rand() * 3000);
      for (let i = 0; i < n; i += 1) {
        const r = rand();
        // Mischung aus Bewegung, Stillstand, Sprüngen, Funklöchern, doppelten und rückwärts laufenden Zeiten.
        if (r < 0.7) pos = offset(pos, (rand() - 0.3) * speed * 2, (rand() - 0.5) * speed * 2);
        if (r > 0.98) {
          raw.push({ ...offset(pos, 5000, 0), t, accuracyM: 4 });
        }
        t += r < 0.02 ? -2000 : r < 0.04 ? 0 : r < 0.05 ? 300_000 : 1000;
        raw.push({
          ...pos,
          t,
          accuracyM: rand() * 40,
          altitudeM: rand() < 0.1 ? null : 100 + rand() * 5,
        });
      }
      const s = summarizeTrack(raw, sport);
      const f = filterTrackPoints(raw, sport).points;
      expect(s.movingS).toBeLessThanOrEqual(s.durationS);
      expect(s.distanceM).toBeLessThanOrEqual(Math.floor(trackDistance(f)));
      expect(s.kmSplits.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(s.movingS);
      expect(Math.round(autoPause(f, sport).movingS)).toBeGreaterThanOrEqual(s.movingS);
      expect(decodePolyline(s.polyline)?.length ?? 0).toBe(s.pointCount);
      const p = toTrackedRoutePayload(s, { ...details, isFavorite: rand() < 0.5 });
      if (p !== null) {
        saved += 1;
        expect(trackedRouteSchema.safeParse(p).success).toBe(true);
      } else {
        // Nur zu kurz oder zu lang darf scheitern.
        expect(s.tooShort || s.durationS > TRACKED_ROUTE_LIMITS.durationS.max).toBe(true);
      }
    }
    expect(saved).toBeGreaterThan(20);
  });

  it('Höhenmeter über der Grenze werden weggelassen statt die Strecke abzulehnen; leere Notiz → null', () => {
    const s = summarizeTrack(line({ speedMps: 3.5, count: 400 }), 'run');
    const p = toTrackedRoutePayload({ ...s, elevationGainM: 10_001 }, { ...details, note: '  ' });
    expect(p?.elevation_gain_m).toBeNull();
    expect(p?.note).toBeNull();
    expect(last(s.points).t - (s.points[0]?.t ?? 0)).toBe(399_000);
  });
});

describe('sessionLogFitsRoute (Wächter S1 M3, Variante a)', () => {
  const route = {
    sport: 'run' as const,
    // 22:30 UTC = 00:30 in Berlin am 17.10. → Tag des Beginns 2026-10-17.
    started_at: '2026-10-16T22:30:00Z',
    duration_s: 1800,
    moving_s: 1700,
    distance_m: 5000,
  };
  const log = {
    kind: 'endurance' as const,
    modality: 'run',
    performedOn: '2026-10-17',
    durationS: 1800,
    distanceM: 5000,
  };
  it('passt: gleiche Art, Tag des Beginns (Berlin) und +1, Distanz/Dauer im Rahmen', () => {
    expect(sessionLogFitsRoute(log, route)).toBe(true);
    expect(sessionLogFitsRoute({ ...log, performedOn: '2026-10-18' }, route)).toBe(true);
    expect(sessionLogFitsRoute({ ...log, distanceM: 5500, durationS: 1400 }, route)).toBe(true);
    expect(sessionLogFitsRoute({ ...log, distanceM: 4900, durationS: 2100 }, route)).toBe(true);
  });
  it.each([
    ['Tag −1', { performedOn: '2026-10-16' }],
    ['Tag +2', { performedOn: '2026-10-19' }],
    ['andere Art', { modality: 'bike' }],
    ['Kraft', { kind: 'strength' as const, modality: null }],
    ['Distanz 11 % daneben', { distanceM: 5501 }],
    ['Distanz fehlt', { distanceM: null }],
    ['Dauer zu kurz', { durationS: 1399 }],
    ['Dauer zu lang', { durationS: 2101 }],
  ] as const)('passt nicht: %s', (_, changes) => {
    expect(sessionLogFitsRoute({ ...log, ...changes }, route)).toBe(false);
  });
  it('kurze Strecke: mindestens 100 m Spielraum', () => {
    const short = { ...route, distance_m: 300 };
    expect(sessionLogFitsRoute({ ...log, distanceM: 400 }, short)).toBe(true);
    expect(sessionLogFitsRoute({ ...log, distanceM: 401 }, short)).toBe(false);
  });
});
