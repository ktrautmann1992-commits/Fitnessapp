import { describe, expect, it } from 'vitest';

import { COMPETITION_DISTANCE_M, COMPETITION_NUTRITION, RACE_PACE_PLAN } from '../constants';
import { raceFuelingPlan } from '../nutrition/competition';
import {
  gradeTimeFactor,
  type RacePacePlan,
  racePaceCheckpoint,
  racePaceDistanceM,
  racePacePlan,
  racePaceSplitEveryM,
} from './race-pace';

function plan(input: Parameters<typeof racePacePlan>[0]): RacePacePlan {
  const result = racePacePlan(input);
  if (!result.ok) throw new Error(result.error);
  return result.plan;
}

const sum = (p: RacePacePlan) => p.splits.reduce((s, x) => s + x.timeS, 0);

describe('racePacePlan – Distanzen', () => {
  it('5 km in 25:00: 5 Abschnitte je 5:00/km, Summe = Zielzeit', () => {
    const p = plan({ distanceM: 5000, targetTimeS: 1500 });
    expect(p.splits).toHaveLength(5);
    expect(p.splits.every((s) => s.timeS === 300 && s.paceSPerKm === 300)).toBe(true);
    expect(p.splits.at(-1)?.elapsedS).toBe(1500);
    expect(p.averagePaceSPerKm).toBe(300);
    expect(p.splitEveryM).toBe(1000);
  });

  it('10 km in 50:00 gleichmäßig', () => {
    const p = plan({ distanceM: 10000, targetTimeS: 3000 });
    expect(p.splits).toHaveLength(10);
    expect(sum(p)).toBe(3000);
    expect(new Set(p.splits.map((s) => s.paceSPerKm))).toEqual(new Set([300]));
  });

  it('Halbmarathon 1:59:59: 21 km + 97,5 m Rest, Summe exakt, Uhrzeit steigt', () => {
    const p = plan({ distanceM: COMPETITION_DISTANCE_M.half_marathon, targetTimeS: 7199 });
    expect(p.splits).toHaveLength(22);
    expect(p.splits.at(-1)?.distanceM).toBeCloseTo(97.5, 5);
    expect(sum(p)).toBe(7199);
    for (let i = 1; i < p.splits.length; i += 1) {
      expect(p.splits[i]!.elapsedS).toBeGreaterThan(p.splits[i - 1]!.elapsedS);
    }
    // Tempo ohne Rundungs-Sprünge: gleichmäßig = überall gleich (auch der kurze Rest).
    expect(new Set(p.splits.map((s) => s.paceSPerKm))).toEqual(new Set([341]));
    // Rundung je Abschnitt höchstens 1 s neben dem Durchschnitt.
    for (const s of p.splits.slice(0, -1))
      expect(Math.abs(s.timeS - 7199 / 21.0975)).toBeLessThan(1);
  });

  it('Marathon: je 5 km, letzter Abschnitt 2,195 km', () => {
    const p = plan({ distanceM: COMPETITION_DISTANCE_M.marathon, targetTimeS: 4 * 3600 });
    expect(p.splitEveryM).toBe(5000);
    expect(p.splits).toHaveLength(9);
    expect(p.splits.at(-1)?.distanceM).toBeCloseTo(2195, 5);
    expect(sum(p)).toBe(4 * 3600);
    expect(p.splits[0]?.paceSPerKm).toBe(341); // 4:00:00 / 42,195 km = 5:41/km
  });

  it('Abschnittslänge: bis 25 km je km, darüber je 5 km', () => {
    expect(racePaceSplitEveryM(25000)).toBe(1000);
    expect(racePaceSplitEveryM(25001)).toBe(5000);
  });

  it('Triathlon-Laufteil: Sprint 5 km, Olympisch 10 km; Rad ohne Laufteil', () => {
    expect(racePaceDistanceM('triathlon_sprint')).toBe(5000);
    expect(racePaceDistanceM('triathlon_olympic')).toBe(10000);
    expect(racePaceDistanceM('cycling')).toBeNull();
    expect(racePaceDistanceM('half_marathon')).toBe(21097.5);
    const p = plan({ distanceM: 10000, targetTimeS: 3300, discipline: 'triathlon_olympic' });
    expect(p.splits).toHaveLength(10);
    expect(p.plausibility).toBe('unknown');
  });
});

describe('racePacePlan – Strategie', () => {
  it('negativ: zweite Hälfte etwa 2 % schneller, Summe bleibt', () => {
    const p = plan({ distanceM: 10000, targetTimeS: 3000, strategy: 'negative' });
    expect(sum(p)).toBe(3000);
    const first = p.splits.slice(0, 5).reduce((s, x) => s + x.timeS, 0);
    const second = p.splits.slice(5).reduce((s, x) => s + x.timeS, 0);
    expect(second).toBeLessThan(first);
    expect((first - second) / first).toBeCloseTo(RACE_PACE_PLAN.negativeSplitShare, 2);
    expect(p.strategy).toBe('negative');
  });
});

describe('racePacePlan – Höhenprofil', () => {
  // 10 km: erste Hälfte 50 m bergauf (1 %), zweite Hälfte zurück.
  const hill: [number, number][] = [
    [0, 1000],
    [5000, 1500],
    [10000, 1000],
  ];

  it('bergauf langsamer, bergab schneller (aber weniger Gewinn), Summe bleibt', () => {
    const p = plan({ distanceM: 10000, targetTimeS: 3000, elevationProfile: hill });
    expect(p.elevationUsed).toBe(true);
    expect(sum(p)).toBe(3000);
    const up = p.splits[0]!.timeS;
    const down = p.splits[9]!.timeS;
    expect(up).toBeGreaterThan(down);
    expect(p.splits[0]!.climbM).toBe(10);
    expect(p.splits[9]!.descentM).toBe(10);
    // Verhältnis bergauf/bergab = (1 + 3 %) / (1 − 1,5 %).
    expect(up / down).toBeCloseTo(1.03 / 0.985, 2);
  });

  it('Steigungs-Faktor: 0 → 1, gekappt bei 15 %, Gefälle nur bis 5 %', () => {
    expect(gradeTimeFactor(0)).toBe(1);
    expect(gradeTimeFactor(0.3)).toBeCloseTo(gradeTimeFactor(0.15), 10);
    expect(gradeTimeFactor(-0.2)).toBeCloseTo(gradeTimeFactor(-0.05), 10);
    expect(gradeTimeFactor(-0.05)).toBeCloseTo(1 - 0.075, 10);
    expect(gradeTimeFactor(Number.NaN)).toBe(1);
  });

  it('Strecke 5 % länger → gestreckt (Hinweis), 20 % länger → flach mit Hinweis', () => {
    const scaled = plan({
      distanceM: 10000,
      targetTimeS: 3000,
      elevationProfile: [
        [0, 1000],
        [10500, 1000],
      ],
    });
    expect(scaled.notices).toContain('course_scaled');
    expect(scaled.elevationUsed).toBe(true);
    const mismatch = plan({
      distanceM: 10000,
      targetTimeS: 3000,
      elevationProfile: [
        [0, 1000],
        [12000, 2000],
      ],
    });
    expect(mismatch.notices).toContain('course_mismatch');
    expect(mismatch.elevationUsed).toBe(false);
    expect(new Set(mismatch.splits.map((s) => s.timeS))).toEqual(new Set([300]));
  });

  it('flaches Profil = gleichmäßig', () => {
    const p = plan({
      distanceM: 5000,
      targetTimeS: 1500,
      elevationProfile: [
        [0, 500],
        [5000, 500],
      ],
    });
    expect(p.splits.every((s) => s.timeS === 300)).toBe(true);
    expect(p.splits.every((s) => s.climbM === 0 && s.descentM === 0)).toBe(true);
  });
});

describe('racePacePlan – Verpflegung (wie Wettkampf-Ernährung)', () => {
  it('unter 60 min keine Punkte', () => {
    const p = plan({
      distanceM: 10000,
      targetTimeS: 50 * 60,
      fueling: { level: 'advanced', generalOnly: false },
    });
    expect(p.fuelPoints).toEqual([]);
    expect(p.fuelingStage).toBe('none');
  });

  it('Halbmarathon 1:50: alle 30 min, Mengen aus raceFuelingPlan', () => {
    const minutes = 110;
    const p = plan({
      distanceM: COMPETITION_DISTANCE_M.half_marathon,
      targetTimeS: minutes * 60,
      fueling: { level: 'beginner', generalOnly: false },
    });
    const expected = raceFuelingPlan(minutes, 'beginner', { generalOnly: false });
    expect(p.fuelingStage).toBe(expected.stage);
    expect(p.carbsGPerHour).toEqual(expected.carbsGPerHour);
    expect(p.fuelPoints.map((f) => f.minute)).toEqual([30, 60, 90]);
    // 30 min bei 5:13/km ≈ 5,75 km → auf 100 m gerundet.
    expect(p.fuelPoints[0]!.distanceM).toBe(5800);
    expect(p.fuelPoints[0]!.carbsG).toEqual(expected.steps.find((s) => s.kind === 'fuel')!.carbsG);
    const withFuel = p.splits.filter((s) => s.fuel.length > 0).map((s) => s.index);
    expect(withFuel).toEqual([6, 12, 18]);
  });

  it('Marathon Einsteiger 4:30: mittlere Stufe; Fortgeschritten: hohe Stufe', () => {
    const beginner = plan({
      distanceM: COMPETITION_DISTANCE_M.marathon,
      targetTimeS: 270 * 60,
      fueling: { level: 'beginner', generalOnly: false },
    });
    expect(beginner.carbsGPerHour).toEqual(COMPETITION_NUTRITION.fueling.moderateGPerHour);
    expect(beginner.fuelPoints).toHaveLength(8);
    const advanced = plan({
      distanceM: COMPETITION_DISTANCE_M.marathon,
      targetTimeS: 270 * 60,
      fueling: { level: 'advanced', generalOnly: false },
    });
    expect(advanced.carbsGPerHour).toEqual(COMPETITION_NUTRITION.fueling.highGPerHour);
  });

  it('nur allgemein (unter 18): Punkte ohne Gramm', () => {
    const p = plan({
      distanceM: COMPETITION_DISTANCE_M.half_marathon,
      targetTimeS: 120 * 60,
      fueling: { level: 'beginner', generalOnly: true },
    });
    expect(p.fuelingStage).toBe('general');
    expect(p.fuelPoints).toEqual([]);
    expect(p.carbsGPerHour).toBeNull();
  });
});

describe('racePacePlan – Plausibilität und Grenzen', () => {
  const reference = { discipline: '10k' as const, timeS: 50 * 60, date: '2026-09-01' };

  it('Zielzeit passend zur Referenz → plausibel, mit Vorhersage', () => {
    const p = plan({
      distanceM: COMPETITION_DISTANCE_M.half_marathon,
      targetTimeS: 7 * 60 * 21 + 60,
      discipline: 'half_marathon',
      reference,
    });
    expect(p.plausibility).toBe('plausible');
    expect(p.predictedTimeS).toBeGreaterThan(6600);
    expect(p.notices).not.toContain('target_not_plausible');
  });

  it('unrealistische Zielzeit (wie Ampel) → Hinweis, Plan trotzdem rechenbar', () => {
    const p = plan({
      distanceM: COMPETITION_DISTANCE_M.half_marathon,
      targetTimeS: 90 * 60,
      discipline: 'half_marathon',
      reference,
    });
    expect(p.plausibility).toBe('not_plausible');
    expect(p.notices).toContain('target_not_plausible');
  });

  it('Referenz zu weit weg (5 km → Marathon) → unknown', () => {
    const p = plan({
      distanceM: COMPETITION_DISTANCE_M.marathon,
      targetTimeS: 4 * 3600,
      discipline: 'marathon',
      reference: { discipline: '5k', timeS: 25 * 60, date: '2026-09-01' },
    });
    expect(p.plausibility).toBe('unknown');
    expect(p.predictedTimeS).toBeNull();
  });

  it('Tempo außerhalb 2:30–15:00 min/km und ungültige Eingaben → Fehler', () => {
    expect(racePacePlan({ distanceM: 10000, targetTimeS: 1200 })).toEqual({
      ok: false,
      error: 'pace_out_of_range',
    });
    expect(racePacePlan({ distanceM: 5000, targetTimeS: 5000 })).toEqual({
      ok: false,
      error: 'pace_out_of_range',
    });
    expect(racePacePlan({ distanceM: 500, targetTimeS: 200 })).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
    expect(racePacePlan({ distanceM: 5000, targetTimeS: -1 })).toEqual({
      ok: false,
      error: 'invalid_inputs',
    });
  });

  it('Grenzfälle Tempo: genau 2:30 und 15:00 min/km gehen', () => {
    expect(racePacePlan({ distanceM: 10000, targetTimeS: 1500 }).ok).toBe(true);
    expect(racePacePlan({ distanceM: 10000, targetTimeS: 9000 }).ok).toBe(true);
  });
});

describe('racePaceCheckpoint (für Sprach-Ansagen)', () => {
  const p = plan({
    distanceM: 10000,
    targetTimeS: 3000,
    fueling: { level: 'advanced', generalOnly: false },
  });

  it('im Plan, vor und hinter dem Plan', () => {
    expect(racePaceCheckpoint(p, 2000, 600)).toMatchObject({
      targetElapsedS: 600,
      deltaS: 0,
      status: 'on_target',
      splitIndex: 3,
      splitPaceSPerKm: 300,
      remainingM: 8000,
    });
    expect(racePaceCheckpoint(p, 2000, 640).status).toBe('behind');
    expect(racePaceCheckpoint(p, 2000, 560)).toMatchObject({ status: 'ahead', deltaS: -40 });
    expect(racePaceCheckpoint(p, 2500, 760).targetElapsedS).toBe(750);
  });

  it('Grenzen: negativ/NaN = Start, über dem Ziel = Ziel', () => {
    expect(racePaceCheckpoint(p, -5, Number.NaN)).toMatchObject({
      distanceM: 0,
      targetElapsedS: 0,
      deltaS: 0,
      splitIndex: 1,
    });
    expect(racePaceCheckpoint(p, 12000, 3000)).toMatchObject({
      distanceM: 10000,
      targetElapsedS: 3000,
      remainingM: 0,
      splitIndex: 10,
    });
  });

  it('nächster Verpflegungspunkt (50 min → keiner)', () => {
    expect(racePaceCheckpoint(p, 1000, 300).nextFuel).toBeNull();
    const long = plan({
      distanceM: 21097.5,
      targetTimeS: 110 * 60,
      fueling: { level: 'beginner', generalOnly: false },
    });
    expect(racePaceCheckpoint(long, 1000, 300).nextFuel?.minute).toBe(30);
    expect(racePaceCheckpoint(long, 6000, 1800).nextFuel?.minute).toBe(60);
  });
});
