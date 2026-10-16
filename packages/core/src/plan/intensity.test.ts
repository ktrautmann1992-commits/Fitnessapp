import { describe, expect, it } from 'vitest';

import {
  distanceHint,
  enduranceOverloadThreshold,
  goalTimePlausible,
  hardEffortCapFor,
  hardSeconds,
  hardWorkoutLimits,
  isEnduranceOverload,
  isHardWorkoutType,
  paceTargets,
  predictedTimeS,
  riegelTime,
  weeklyHardBudgetSeconds,
  type WorkoutStep,
  workoutStepsSchema,
} from './intensity';
import { planSafetyRules } from './safety';

/** Referenz 10 km in 50:00 (Erwartungswerte unabhängig mit T₂ = T₁ × (D₂/D₁)^1,06 gerechnet). */
const ref10k = { discipline: '10k', timeS: 3000, date: '2026-10-01' } as const;

const rules = (
  overrides: {
    level?: 'beginner' | 'advanced' | 'competitive';
    birthDate?: string;
    flags?: ('injury' | 'pregnancy')[] | null;
  } = {},
) =>
  planSafetyRules(
    {
      experienceLevel: overrides.level ?? 'advanced',
      birthDate: overrides.birthDate ?? '1990-01-01',
      healthScreening: overrides.flags === null ? null : { flags: overrides.flags ?? [] },
    },
    '2026-10-16',
  );

describe('Riegel (Riegel 1981) und Pace-Richtwerte', () => {
  it('Beispielwerte: 10 km 50:00 → Halbmarathon 1:50:19, 5 km 25:00 → 10 km 52:07', () => {
    expect(Math.round(riegelTime(3000, 10000, 21097.5))).toBe(6619);
    expect(Math.round(riegelTime(1500, 5000, 10000))).toBe(3127);
    expect(Math.round(predictedTimeS(ref10k, 'marathon'))).toBe(13801);
    expect(riegelTime(3000, 10000, 10000)).toBe(3000);
    expect(() => riegelTime(0, 10000, 5000)).toThrow(RangeError);
    expect(() => riegelTime(3000, -1, 5000)).toThrow(RangeError);
  });

  it('Spannen je Art: locker 10 km + 60–90 s, Intervalle 5-km-Tempo + 0–10 s, Renntempo; ohne Referenz null', () => {
    const profile = { reference: ref10k, discipline: 'half_marathon' } as const;
    expect(paceTargets(profile, 'easy')).toEqual({ fastSPerKm: 360, slowSPerKm: 390 });
    expect(paceTargets(profile, 'long')).toEqual({ fastSPerKm: 360, slowSPerKm: 390 });
    expect(paceTargets(profile, 'recovery')).toEqual({ fastSPerKm: 390, slowSPerKm: 420 });
    expect(paceTargets(profile, 'tempo')).toEqual({ fastSPerKm: 310, slowSPerKm: 325 });
    expect(paceTargets(profile, 'intervals')).toEqual({ fastSPerKm: 288, slowSPerKm: 298 });
    expect(paceTargets(profile, 'race_pace')).toEqual({ fastSPerKm: 314, slowSPerKm: 319 });
    expect(paceTargets(profile, 'fartlek')).toBeNull();
    expect(paceTargets(profile, 'strides')).toBeNull();
    for (const type of ['easy', 'long', 'tempo', 'intervals', 'race_pace'] as const) {
      expect(paceTargets(null, type), type).toBeNull();
    }
  });

  it('Distanz-Richtwert: Dauer ÷ langsames Ende, abgerundet auf 0,5 km, 0,1–60 km, ohne Pace null', () => {
    expect(distanceHint(60, { fastSPerKm: 360, slowSPerKm: 390 })).toBe(9000);
    expect(distanceHint(65, { fastSPerKm: 360, slowSPerKm: 390 })).toBe(10000);
    expect(distanceHint(1, { fastSPerKm: 360, slowSPerKm: 390 })).toBeNull();
    expect(distanceHint(600, { fastSPerKm: 100, slowSPerKm: 100 })).toBe(60000);
    expect(distanceHint(60, null)).toBeNull();
    expect(distanceHint(0, { fastSPerKm: 360, slowSPerKm: 390 })).toBeNull();
  });

  it('Zielzeit-Plausibilität: höchstens 5 % schneller als die Vorhersage; ohne Referenz nie', () => {
    // Halbmarathon-Vorhersage 6619,2 s → Grenze 6288,2 s.
    expect(goalTimePlausible(ref10k, 'half_marathon', 6289)).toBe(true);
    expect(goalTimePlausible(ref10k, 'half_marathon', 6288)).toBe(false);
    expect(goalTimePlausible(ref10k, 'half_marathon', 8000)).toBe(true);
    expect(goalTimePlausible(null, 'half_marathon', 8000)).toBe(false);
    expect(goalTimePlausible(ref10k, '10k', null)).toBe(false);
  });
});

describe('Riegel nur bis Faktor 4 (Wächter M3)', () => {
  const ref5k = { discipline: '5k', timeS: 20 * 60, date: '2026-10-01' } as const;
  it('5 km → Marathon (Faktor 8,4): keine Zielzeit-Plausibilität, kein Renntempo; 5 km → 10 km weiter', () => {
    // Riegel sagt 3:11:48 voraus – selbst 3:20 gilt nicht als plausibel, weil die Hochrechnung zu unsicher ist.
    expect(goalTimePlausible(ref5k, 'marathon', 200 * 60)).toBe(false);
    expect(goalTimePlausible(ref5k, 'marathon', 185 * 60)).toBe(false);
    const marathon = { reference: ref5k, discipline: 'marathon' } as const;
    expect(paceTargets(marathon, 'race_pace')).toBeNull();
    expect(paceTargets(marathon, 'easy')).not.toBeNull(); // Basis 10 km: Faktor 2
    expect(paceTargets(marathon, 'intervals')).not.toBeNull();
    // Halbmarathon aus 5 km: Faktor 4,22 > 4 → kein Renntempo; aus 10 km (2,1) schon.
    expect(paceTargets({ reference: ref5k, discipline: 'half_marathon' }, 'race_pace')).toBeNull();
    expect(
      paceTargets({ reference: ref10k, discipline: 'half_marathon' }, 'race_pace'),
    ).not.toBeNull();
    // Marathon aus 10 km: Faktor 4,22 → ebenfalls nicht; umgekehrt (Marathon-Referenz → 5 km) auch nicht.
    expect(goalTimePlausible(ref10k, 'marathon', 300 * 60)).toBe(false);
    const refMarathon = { discipline: 'marathon', timeS: 4 * 3600, date: '2026-10-01' } as const;
    expect(paceTargets({ reference: refMarathon, discipline: 'marathon' }, 'intervals')).toBeNull();
    expect(
      paceTargets({ reference: refMarathon, discipline: 'marathon' }, 'race_pace'),
    ).not.toBeNull();
  });
});

describe('Harte Einheiten je Personengruppe (Tabelle 3.3)', () => {
  it('Flag, Schwangerschaft, ohne Check, ab 65 (nur Gehen): keine; unter 18: ≤ 7 und 1/Woche; Einsteiger 1; sonst 2 und ≤ 8', () => {
    const blocked = { allowed: false, effortCap: 0, perWeek: 0 };
    expect(hardWorkoutLimits(rules({ flags: ['injury'] }), 'advanced')).toMatchObject(blocked);
    expect(hardWorkoutLimits(rules({ flags: ['pregnancy'] }), 'advanced')).toMatchObject(blocked);
    expect(hardWorkoutLimits(rules({ flags: null }), 'advanced')).toMatchObject(blocked);
    expect(hardWorkoutLimits(rules({ birthDate: '1955-01-01' }), 'competitive')).toMatchObject(
      blocked,
    );
    expect(hardWorkoutLimits(rules({ birthDate: '2009-01-01' }), 'competitive')).toEqual({
      allowed: true,
      effortCap: 7,
      perWeek: 1,
      countWorkOnly: true,
    });
    expect(hardWorkoutLimits(rules({ level: 'beginner' }), 'beginner')).toEqual({
      allowed: true,
      effortCap: 8,
      perWeek: 1,
      countWorkOnly: true,
    });
    expect(hardWorkoutLimits(rules(), 'competitive')).toEqual({
      allowed: true,
      effortCap: 8,
      perWeek: 2,
      countWorkOnly: false,
    });
    expect(hardEffortCapFor(rules({ flags: ['injury'] }))).toBe(0);
    expect(hardEffortCapFor(rules({ birthDate: '2010-06-01' }))).toBe(7);
  });

  it('harte Arten: Fahrtspiel, Tempo, Intervalle, Renntempo – nicht locker/lang/Erholung/Steigerungen', () => {
    expect(
      ['fartlek', 'tempo', 'intervals', 'race_pace'].every((t) => isHardWorkoutType(t as never)),
    ).toBe(true);
    for (const t of ['easy', 'long', 'recovery', 'strides', null, undefined] as const) {
      expect(isHardWorkoutType(t)).toBe(false);
    }
  });
});

describe('80/20-Zählung (Seiler 2010, Plan 3.4)', () => {
  const steps: WorkoutStep[] = [
    { part: 'warmup', kind: 'easy', seconds: 600, effort: 3 },
    { part: 'main', kind: 'work', seconds: 180, effort: 8 },
    { part: 'main', kind: 'rest', seconds: 120, effort: 3 },
    { part: 'main', kind: 'work', seconds: 180, effort: 8 },
    { part: 'cooldown', kind: 'easy', seconds: 300, effort: 3 },
  ];
  it('Einsteiger/vorsichtig: nur harte Abschnitte; sonst der Hauptteil inkl. Trabpausen', () => {
    expect(hardSeconds(steps, true)).toBe(360);
    expect(hardSeconds(steps, false)).toBe(480);
    expect(hardSeconds([{ part: 'main', kind: 'easy', seconds: 600, effort: 4 }], false)).toBe(0);
    // Anstrengung 5 zählt nicht, 6 schon.
    expect(hardSeconds([{ part: 'main', kind: 'work', seconds: 60, effort: 5 }], true)).toBe(0);
    expect(hardSeconds([{ part: 'main', kind: 'work', seconds: 60, effort: 6 }], true)).toBe(60);
  });

  it('Budget = floor(20 % der Wochenminuten) Minuten', () => {
    expect(weeklyHardBudgetSeconds(140)).toBe(28 * 60);
    expect(weeklyHardBudgetSeconds(99)).toBe(19 * 60);
    expect(weeklyHardBudgetSeconds(0)).toBe(0);
  });

  it('Schritte an der Grenze (Zod): 1–40 Schritte, 10 s bis 4 h, Anstrengung 0–10, keine Zusatzfelder', () => {
    expect(workoutStepsSchema.safeParse(steps).success).toBe(true);
    expect(workoutStepsSchema.safeParse([]).success).toBe(false);
    expect(workoutStepsSchema.safeParse(Array.from({ length: 41 }, () => steps[0])).success).toBe(
      false,
    );
    expect(workoutStepsSchema.safeParse([{ ...steps[0], seconds: 9 }]).success).toBe(false);
    expect(workoutStepsSchema.safeParse([{ ...steps[0], seconds: 4 * 3600 + 1 }]).success).toBe(
      false,
    );
    expect(workoutStepsSchema.safeParse([{ ...steps[0], effort: 11 }]).success).toBe(false);
    expect(workoutStepsSchema.safeParse([{ ...steps[0], pace: 300 }]).success).toBe(false);
  });
});

describe('4b endurance_reduce – neue Fassung mit Abstand zum Ziel (Risiko 7)', () => {
  it('lockere Ziele wie bisher 7; Tempo (7) und Intervalle (8) ab 9', () => {
    for (const target of [null, 1, 2, 3, 4]) expect(enduranceOverloadThreshold(target)).toBe(7);
    // Harte Ziele vorsichtiger (Wächter N4): Ziel + 2, höchstens 9.
    expect(enduranceOverloadThreshold(6)).toBe(8);
    expect(enduranceOverloadThreshold(7)).toBe(9);
    expect(enduranceOverloadThreshold(8)).toBe(9);
    expect(isEnduranceOverload(4, 7)).toBe(true);
    expect(isEnduranceOverload(4, 6)).toBe(false);
    expect(isEnduranceOverload(8, 8)).toBe(false);
    expect(isEnduranceOverload(8, 9)).toBe(true);
  });
});
