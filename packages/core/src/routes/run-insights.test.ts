import { describe, expect, it } from 'vitest';

import { RUN_INSIGHTS } from '../constants';
import {
  averagePaceS,
  distanceTicks,
  elevationStats,
  paceBucket,
  paceColoredRuns,
  paceDeltaText,
  paceRange,
  paceSegments,
  runHighlights,
  splitInsights,
  timeBetween,
} from './run-insights';
import { offset, START } from './test-helpers';
import { haversineM } from './track';

describe('paceSegments', () => {
  it('volle Kilometer plus Rest mit hochgerechneter Pace', () => {
    const segs = paceSegments([300, 330], 2_500, 300 + 330 + 160);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({
      km: 1,
      fromM: 0,
      toM: 1000,
      secondsPerKm: 300,
      partial: false,
    });
    expect(segs[2]).toMatchObject({ km: 3, fromM: 2000, toM: 2500, partial: true });
    expect(segs[2]?.secondsPerKm).toBeCloseTo(320);
  });

  it('unter 1 km: ein Abschnitt mit Ø-Pace', () => {
    const segs = paceSegments([], 800, 240);
    expect(segs).toEqual([{ km: 1, fromM: 0, toM: 800, secondsPerKm: 300, partial: true }]);
  });

  it('Rest unter minPartialM fällt weg', () => {
    expect(paceSegments([300], 1_000 + RUN_INSIGHTS.minPartialM - 1, 330)).toHaveLength(1);
  });

  it('ungültige Zeit: Abschnitt fehlt, Nummern bleiben, kein Rest', () => {
    const segs = paceSegments([300, 0, 310], 3_400, 1_200);
    expect(segs.map((s) => s.km)).toEqual([1, 3]);
    expect(segs[1]?.fromM).toBe(2000);
  });

  it('keine Distanz, keine Zeit (einzelner Punkt) → leer', () => {
    expect(paceSegments([], 0, 0)).toEqual([]);
    expect(paceSegments([], Number.NaN, 10)).toEqual([]);
  });

  it('Pausen: Rest nur, wenn Bewegungszeit übrig bleibt', () => {
    expect(paceSegments([300, 300], 2_500, 600)).toHaveLength(2);
  });
});

describe('averagePaceS / paceRange / paceBucket', () => {
  it('Ø-Pace', () => {
    expect(averagePaceS(5_000, 1_500)).toBe(300);
    expect(averagePaceS(0, 1_500)).toBeNull();
    expect(averagePaceS(5_000, 0)).toBeNull();
  });

  it('Stufen linear von schnell (0) bis langsam (4)', () => {
    const range = { fastest: 300, slowest: 400 };
    expect(paceBucket(300, range)).toBe(0);
    expect(paceBucket(350, range)).toBe(2);
    expect(paceBucket(400, range)).toBe(4);
    expect(paceBucket(999, range)).toBe(4);
    expect(paceBucket(100, range)).toBe(0);
  });

  it('gleiches Tempo → mittlere Stufe', () => {
    expect(paceBucket(300, { fastest: 300, slowest: 301 })).toBe(2);
    expect(paceBucket(Number.NaN, { fastest: 300, slowest: 400 })).toBe(2);
    expect(paceBucket(300, { fastest: 300, slowest: 400 }, 1)).toBe(0);
  });

  it('paceRange leer → null', () => {
    expect(paceRange([])).toBeNull();
  });
});

describe('splitInsights', () => {
  it('Abweichung zur Ø-Pace, schnellster km genau einmal', () => {
    const rows = splitInsights([330, 300, 300, 360], 4_000, 1_290);
    expect(rows.map((r) => r.deltaS)).toEqual([8, -22, -22, 38]);
    expect(rows.filter((r) => r.fastest).map((r) => r.km)).toEqual([2]);
    expect(rows[3]?.share).toBe(1);
    expect(rows[1]?.bucket).toBe(0);
    expect(rows[3]?.bucket).toBe(4);
  });

  it('gleiches Tempo: kein schnellster km, mittlere Stufe', () => {
    const rows = splitInsights([300, 300, 300], 3_000, 900);
    expect(rows.some((r) => r.fastest)).toBe(false);
    expect(rows.every((r) => r.bucket === 2 && r.deltaS === 0)).toBe(true);
  });

  it('ungültige Zeit bleibt als leere Zeile', () => {
    const rows = splitInsights([300, -1], 2_000, 600);
    expect(rows[1]).toMatchObject({ seconds: 0, share: 0, deltaS: null, bucket: null });
  });

  it('ohne Kilometerzeiten → leer; ohne Distanz Ø aus den Zeiten', () => {
    expect(splitInsights([], 800, 240)).toEqual([]);
    expect(splitInsights([300, 320], 0, 0).map((r) => r.deltaS)).toEqual([-10, 10]);
  });
});

describe('paceDeltaText', () => {
  it('Vorzeichen und Format', () => {
    expect(paceDeltaText(-12)).toBe('−0:12');
    expect(paceDeltaText(8)).toBe('+0:08');
    expect(paceDeltaText(75)).toBe('+1:15');
    expect(paceDeltaText(0.2)).toBe('±0:00');
  });
});

describe('paceColoredRuns', () => {
  const line = Array.from({ length: 21 }, (_, i) => offset(START, i * 100, 0));

  it('färbt nach Abschnitt, Nachbarstücke teilen den Grenzpunkt', () => {
    const segs = paceSegments([300, 400], 2_000, 700);
    const runs = paceColoredRuns(line, segs);
    expect(runs.map((r) => r.bucket)).toEqual([0, 4]);
    expect(runs[0]?.points.at(-1)).toEqual(runs[1]?.points[0]);
    expect(runs.map((r) => [r.from, r.to])).toEqual([
      [0, 10],
      [10, 20],
    ]);
    expect(runs.reduce((n, r) => n + r.points.length, 0)).toBe(line.length + 1);
  });

  it('streckt die Linie auf die Bewegungsdistanz', () => {
    // Linie 2 km, gelaufen 4 km: die erste Linienhälfte gehört zu km 1–2.
    const segs = paceSegments([300, 300, 400, 400], 4_000, 1_400);
    const runs = paceColoredRuns(line, segs);
    expect(runs).toHaveLength(2);
    expect(haversineM(START, runs[1]?.points[0] as { lat: number; lng: number })).toBeCloseTo(
      1_000,
      -1,
    );
  });

  it('ohne Abschnitte ein Stück ohne Stufe, unter 2 Punkten leer', () => {
    expect(paceColoredRuns(line, [])).toEqual([
      { bucket: null, points: line, from: 0, to: line.length - 1 },
    ]);
    expect(paceColoredRuns([START], paceSegments([300], 1_000, 300))).toEqual([]);
  });

  it('gleiches Tempo → ein Stück', () => {
    const runs = paceColoredRuns(line, paceSegments([300, 300], 2_000, 600));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.bucket).toBe(2);
  });
});

describe('distanceTicks', () => {
  it('ganze Kilometer, bei langen Strecken größere Schritte', () => {
    expect(distanceTicks(5_582)).toEqual([1000, 2000, 3000, 4000, 5000]);
    expect(distanceTicks(12_300)).toEqual([2000, 4000, 6000, 8000, 10_000, 12_000]);
    expect(distanceTicks(42_195)).toEqual([10_000, 20_000, 30_000, 40_000]);
    expect(distanceTicks(950)).toEqual([]);
    expect(distanceTicks(Number.NaN)).toEqual([]);
  });
});

describe('timeBetween', () => {
  const segs = paceSegments([300, 400], 2_000, 700);
  it('anteilig über Abschnitte', () => {
    expect(timeBetween(segs, 0, 1_000)).toBe(300);
    expect(timeBetween(segs, 500, 1_500)).toBe(350);
  });
  it('nicht abgedeckt → null', () => {
    expect(timeBetween(segs, 0, 3_000)).toBeNull();
    expect(timeBetween(segs, 10, 10)).toBeNull();
  });
});

describe('elevationStats', () => {
  it('größter Anstieg mit Hysterese, höchster Punkt', () => {
    // 50 → 60 (kleine Delle 1 m) → 52 → 70 → 65
    const profile = [
      [0, 500],
      [200, 560],
      [300, 550],
      [400, 600],
      [600, 520],
      [800, 700],
      [1000, 650],
    ];
    const stats = elevationStats(profile);
    expect(stats).toMatchObject({ minM: 50, maxM: 70, highestAtM: 800 });
    expect(stats?.biggestClimb).toEqual({ fromM: 600, toM: 800, gainM: 18 });
  });

  it('nur bergab → kein Anstieg', () => {
    expect(
      elevationStats([
        [0, 600],
        [500, 500],
      ])?.biggestClimb,
    ).toBeNull();
  });

  it('fehlendes/zu kurzes Profil → null', () => {
    expect(elevationStats(null)).toBeNull();
    expect(elevationStats([[0, 500]])).toBeNull();
    expect(elevationStats([[0], [1]])).toBeNull();
  });

  it('flach → Anstieg 0 wird nicht gemeldet', () => {
    expect(
      elevationStats([
        [0, 500],
        [1000, 500],
      ])?.biggestClimb,
    ).toBeNull();
  });
});

describe('runHighlights', () => {
  const hill = [
    [0, 500],
    [1500, 510],
    [3000, 700],
    [4000, 600],
    [5000, 520],
  ];

  it('abwechslungsreicher Lauf: schnellster km, negativer Split, Anstieg, höchster Punkt', () => {
    const h = runHighlights({
      kmSplits: [360, 330, 345, 380, 300],
      distanceM: 5_000,
      movingS: 1_715,
      elevationProfile: hill,
    });
    expect(h.map((x) => x.kind)).toEqual([
      'fastest_km',
      'negative_split',
      'biggest_climb',
      'highest_point',
    ]);
    expect(h[0]).toEqual({ kind: 'fastest_km', km: 5, seconds: 300 });
    expect(h[1]).toMatchObject({ kind: 'negative_split', diffS: 10 });
    expect(h[2]).toMatchObject({ gainM: 20 });
    expect(h[3]).toEqual({ kind: 'highest_point', heightM: 70, atM: 3000 });
  });

  it('gleichmäßiges Tempo ohne Höhen', () => {
    const h = runHighlights({
      kmSplits: [300, 300, 300],
      distanceM: 3_000,
      movingS: 900,
      elevationProfile: null,
    });
    expect(h).toEqual([{ kind: 'even_pace', spreadS: 0 }]);
  });

  it('unter 1 km bzw. ein einzelner Punkt: nichts', () => {
    expect(
      runHighlights({ kmSplits: [], distanceM: 700, movingS: 200, elevationProfile: null }),
    ).toEqual([]);
    expect(
      runHighlights({ kmSplits: [], distanceM: 0, movingS: 0, elevationProfile: [[0, 500]] }),
    ).toEqual([]);
  });

  it('langsamere zweite Hälfte → kein negativer Split', () => {
    const h = runHighlights({
      kmSplits: [300, 320, 360, 380],
      distanceM: 4_000,
      movingS: 1_360,
      elevationProfile: null,
    });
    expect(h.map((x) => x.kind)).toEqual(['fastest_km']);
  });
});
