import { describe, expect, it } from 'vitest';

import { ROUTE_PROGRESS } from '../constants';
import {
  progressTrend,
  progressValue,
  progressVolume,
  runProgress,
  similarDistance,
} from './progress';

type A = Parameters<typeof runProgress>[0];

function act(
  key: string,
  day: string,
  distanceM: number | null,
  movingS: number,
  more: Partial<A> = {},
): A {
  return {
    key,
    sport: 'run',
    day,
    startedAt: `${day}T07:00:00Z`,
    movingS,
    distanceM,
    elevationM: 30,
    ...more,
  };
}

describe('progressValue / similarDistance', () => {
  it('Pace in s/km, Rad km/h; ohne Distanz null', () => {
    expect(progressValue('run', 1800, 5000)).toBe(360);
    expect(progressValue('bike', 3600, 25_000)).toBe(25);
    expect(progressValue('run', 1800, null)).toBeNull();
    expect(progressValue('run', 0, 5000)).toBeNull();
  });

  it('±20 %: 5 km passt zu 4–6 km, nicht zu 6,1 km', () => {
    expect(similarDistance(5000, 6000)).toBe(true);
    expect(similarDistance(5000, 4000)).toBe(true);
    expect(similarDistance(5000, 6100)).toBe(false);
    expect(similarDistance(0, 0)).toBe(false);
  });
});

describe('runProgress', () => {
  const history = [
    act('a', '2026-09-20', 5000, 1850), // älter als 4 Wochen – nur „letztes Mal“-Kandidat, nicht im Ø
    act('b', '2026-10-01', 5200, 1820), // 350 s/km
    act('c', '2026-10-08', 4800, 1680), // 350 s/km
    act('d', '2026-10-15', 10_000, 3300), // zu lang
    act('e', '2026-10-18', 5000, 1750, { sport: 'bike' }), // andere Sportart
    act('f', '2026-10-20', 5100, 1734), // 340 s/km
  ];

  it('Ø der letzten 4 Wochen (nur ähnlich lang, gleiche Sportart, davor) und letztes Mal', () => {
    const run = act('now', '2026-10-25', 5000, 1650); // 330 s/km
    const p = runProgress(run, [...history, run]);
    expect(p?.similarCount).toBe(3);
    expect(p?.average).toBeCloseTo((350 + 350 + 340) / 3, 5);
    expect(p?.vsAverage?.code).toBe('faster');
    expect(p?.vsAverage?.amount).toBeCloseTo(16.67, 1);
    expect(p?.last).toMatchObject({ key: 'f', day: '2026-10-20' });
    expect(p?.vsLast).toEqual({ code: 'faster', amount: 10 });
  });

  it('etwa gleich innerhalb von 3 s/km; langsamer', () => {
    const same = runProgress(act('x', '2026-10-25', 5100, 1745), history);
    expect(same?.vsLast?.code).toBe('same');
    const slow = runProgress(act('y', '2026-10-25', 5100, 1900), history);
    expect(slow?.vsLast?.code).toBe('slower');
  });

  it('nur eine vergleichbare Einheit: kein Durchschnitt, aber letztes Mal', () => {
    const p = runProgress(act('x', '2026-10-25', 5000, 1700), [act('b', '2026-10-01', 5200, 1820)]);
    expect(p?.average).toBeNull();
    expect(p?.vsAverage).toBeNull();
    expect(p?.last?.key).toBe('b');
  });

  it('erste Einheit: nichts zu vergleichen; ohne Distanz: null', () => {
    const p = runProgress(act('x', '2026-10-25', 5000, 1700), []);
    expect(p).toMatchObject({ similarCount: 0, average: null, last: null, vsLast: null });
    expect(runProgress(act('x', '2026-10-25', null, 1700), history)).toBeNull();
  });

  it('Rad: schneller = mehr km/h, gleich bis 0,3 km/h', () => {
    const rides = [
      act('r1', '2026-10-10', 20_000, 3600, { sport: 'bike' }),
      act('r2', '2026-10-17', 20_000, 3600, { sport: 'bike' }),
    ];
    const p = runProgress(act('r3', '2026-10-24', 20_000, 3200, { sport: 'bike' }), rides);
    expect(p?.vsAverage?.code).toBe('faster');
    expect(p?.vsAverage?.amount).toBeCloseTo(2.5, 5);
    const same = runProgress(act('r4', '2026-10-24', 20_100, 3600, { sport: 'bike' }), rides);
    expect(same?.vsLast?.code).toBe('same');
  });

  it('Höhenmeter-Hinweis nur bei deutlich mehr (≥ 40 m und ≥ 30 %)', () => {
    const hilly = runProgress(act('h', '2026-10-25', 5000, 1800, { elevationM: 150 }), history);
    expect(hilly?.elevationExtraM).toBe(120);
    const flat = runProgress(act('h', '2026-10-25', 5000, 1800, { elevationM: 60 }), history);
    expect(flat?.elevationExtraM).toBeNull();
    const none = runProgress(act('h', '2026-10-25', 5000, 1800, { elevationM: null }), history);
    expect(none?.elevationExtraM).toBeNull();
  });
});

describe('progressTrend / progressVolume', () => {
  it(`${ROUTE_PROGRESS.trendWeeks} Wochen in zeitlicher Reihenfolge, Lücken null, distanzgewichtet`, () => {
    const acts = [
      act('a', '2026-10-19', 5000, 1800),
      act('b', '2026-10-21', 10_000, 3300),
      act('c', '2026-10-06', 5000, 1750),
      act('bike', '2026-10-20', 20_000, 3000, { sport: 'bike' }),
    ];
    const trend = progressTrend(acts, { sport: 'run', today: '2026-10-25' });
    expect(trend).toHaveLength(ROUTE_PROGRESS.trendWeeks);
    expect(trend.at(-1)).toMatchObject({ weekStart: '2026-10-19', distanceM: 15_000, count: 2 });
    expect(trend.at(-1)?.value).toBeCloseTo(5100 / 15, 5);
    expect(trend.at(-2)?.value).toBeNull();
    expect(trend.at(-3)?.value).toBe(350);
    const similar = progressTrend(acts, { sport: 'run', today: '2026-10-25', similarToM: 5000 });
    expect(similar.at(-1)?.count).toBe(1);
  });

  it('Umfang Woche/Monat je Sportart', () => {
    const acts = [
      act('a', '2026-10-19', 5000, 1800),
      act('b', '2026-10-02', 8000, 3000),
      act('c', '2026-09-30', 5000, 1800),
      act('d', '2026-10-20', 20_000, 3000, { sport: 'bike' }),
    ];
    expect(progressVolume(acts, { sport: 'run', today: '2026-10-25' })).toEqual({
      weekM: 5000,
      monthM: 13_000,
    });
  });
});
