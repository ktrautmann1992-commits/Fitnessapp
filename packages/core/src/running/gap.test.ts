import { describe, expect, it } from 'vitest';

import { GAP_MINETTI } from '../constants';
import { paceSegments } from '../routes/run-insights';
import { gradeAdjustedPace, gradeCostFactor, gradePieces, runningEnergyCost } from './gap';

describe('Minetti-Kurve', () => {
  it('Koeffizienten mit Quelle; flach 3,6 J/(kg·m)', () => {
    expect(GAP_MINETTI.coefficients).toEqual([155.4, -30.4, -43.3, 46.3, 19.5, 3.6]);
    expect(runningEnergyCost(0)).toBeCloseTo(3.6, 6);
    expect(gradeCostFactor(0)).toBe(1);
  });

  it('bergauf teurer, leicht bergab günstiger', () => {
    // +10 %: 155,4e-5 − 30,4e-4 − 43,3e-3 + 46,3e-2 + 1,95 + 3,6 = 5,968214.
    expect(runningEnergyCost(0.1)).toBeCloseTo(5.968214, 6);
    expect(gradeCostFactor(0.1)).toBeGreaterThan(1.6);
    expect(gradeCostFactor(-0.1)).toBeLessThan(1);
  });

  it('außerhalb ±45 % begrenzt; ungültig → flach', () => {
    expect(runningEnergyCost(0.9)).toBe(runningEnergyCost(0.45));
    expect(runningEnergyCost(-0.9)).toBe(runningEnergyCost(-0.45));
    expect(runningEnergyCost(Number.NaN)).toBeCloseTo(3.6, 6);
  });
});

describe('gradePieces', () => {
  it('Stücke von mind. 50 m, Rest ins letzte Stück', () => {
    const pieces = gradePieces([
      [0, 1000],
      [20, 1010],
      [60, 1020],
      [130, 1020],
      [150, 1030],
    ]);
    expect(pieces).toEqual([
      { fromM: 0, toM: 60, grade: 2 / 60 },
      { fromM: 60, toM: 150, grade: 1 / 90 },
    ]);
  });

  it('kurzes Profil unter 50 m: ein Stück; leer/ungültig → keine Stücke', () => {
    expect(
      gradePieces([
        [0, 0],
        [30, 30],
      ]),
    ).toEqual([{ fromM: 0, toM: 30, grade: 0.1 }]);
    expect(gradePieces(null)).toEqual([]);
    expect(gradePieces([[0, 0]])).toEqual([]);
    expect(
      gradePieces([
        [0, 0],
        [0, 10],
      ]),
    ).toEqual([]);
  });
});

describe('gradeAdjustedPace', () => {
  const flat = [
    [0, 500],
    [3000, 500],
  ];

  it('flach: GAP = Pace', () => {
    expect(gradeAdjustedPace({ distanceM: 3000, movingS: 900, profile: flat })).toEqual({
      gapS: 300,
      paceS: 300,
      perSegment: [],
    });
  });

  it('bergauf: GAP schneller als die tatsächliche Pace; bergab langsamer', () => {
    const up = gradeAdjustedPace({
      distanceM: 2000,
      movingS: 720,
      profile: [
        [0, 0],
        [2000, 1000], // +100 m auf 2 km = 5 %
      ],
    });
    expect(up!.paceS).toBe(360);
    expect(up!.gapS).toBeLessThan(330);
    const down = gradeAdjustedPace({
      distanceM: 2000,
      movingS: 600,
      profile: [
        [0, 1000],
        [2000, 0],
      ],
    });
    expect(down!.gapS).toBeGreaterThan(300);
  });

  it('je Kilometer: nur der Anstieg wird bereinigt', () => {
    const profile = [
      [0, 0],
      [1000, 0],
      [2000, 800], // km 2: +80 m
    ];
    const segments = paceSegments([300, 360], 2000, 660);
    const r = gradeAdjustedPace({ distanceM: 2000, movingS: 660, profile, segments });
    expect(r!.perSegment[0]).toBe(300);
    expect(r!.perSegment[1]).toBeLessThan(300);
  });

  it('ohne Profil, unter 1 km, ohne Zeit oder kaum Profil → null', () => {
    expect(gradeAdjustedPace({ distanceM: 5000, movingS: 1500, profile: null })).toBeNull();
    expect(gradeAdjustedPace({ distanceM: 900, movingS: 300, profile: flat })).toBeNull();
    expect(gradeAdjustedPace({ distanceM: 3000, movingS: 0, profile: flat })).toBeNull();
    expect(
      gradeAdjustedPace({
        distanceM: 10_000,
        movingS: 3000,
        profile: [
          [0, 0],
          [1000, 100],
        ],
      }),
    ).toBeNull();
  });
});
