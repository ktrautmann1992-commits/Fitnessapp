import { describe, expect, it } from 'vitest';

import { LOAD_PROGRESSION, SESSION_ACHIEVEMENT } from '../constants';
import { seededRandom } from '../nutrition/test-helpers';
import {
  type AchievementExerciseInput,
  achievementLevel,
  achievementWeightFloorKg,
  sessionAchievement,
  type SessionAchievementInput,
} from './achievement';

/** „Trainingsziel erreicht“ (docs/PLAN-AUSWERTUNG.md 2.5, A-G11, Etappe A2). */

function set(
  reps: number | null,
  weightKg: number | null = null,
  done = true,
  durationS: number | null = null,
) {
  return { done, reps, weightKg, durationS };
}

function exercise(overrides: Partial<AchievementExerciseInput> = {}): AchievementExerciseInput {
  return {
    status: 'done',
    loadType: 'weight',
    targetSets: 3,
    repsMin: 8,
    targetReps: 10,
    targetWeightKg: 50,
    targetDurationS: null,
    incrementKind: 'barbell',
    steps: [],
    sets: [set(10, 50), set(10, 50), set(10, 50)],
    ...overrides,
  };
}

function strength(
  exercises: AchievementExerciseInput[],
  extra: Partial<SessionAchievementInput> = {},
) {
  return sessionAchievement({
    kind: 'strength',
    isFree: false,
    easyWeek: null,
    exercises,
    ...extra,
  } as SessionAchievementInput);
}

function endurance(
  overrides: Partial<Extract<SessionAchievementInput, { kind: 'endurance' }>> = {},
) {
  return sessionAchievement({
    kind: 'endurance',
    isFree: false,
    easyWeek: null,
    plannedMinutes: 30,
    effortTarget: 3,
    durationS: 30 * 60,
    distanceM: 5000,
    sessionRpe: 3,
    ...overrides,
  });
}

describe('Stufen (2.5): ≥ 90 % erreicht, 60–89 % größtenteils, 1–59 % teilweise', () => {
  it.each([
    [100, 'reached'],
    [90, 'reached'],
    [89, 'mostly'],
    [60, 'mostly'],
    [59, 'partly'],
    [1, 'partly'],
    [0, 'none'],
    [null, 'done'],
  ] as const)('%s %% → %s', (percent, level) => {
    expect(achievementLevel(percent)).toBe(level);
  });

  it('Schwellen kommen aus constants.ts', () => {
    expect(SESSION_ACHIEVEMENT.reachedMinPercent).toBe(90);
    expect(SESSION_ACHIEVEMENT.mostlyMinPercent).toBe(60);
  });
});

describe('Kraft', () => {
  it('alle Sätze erfüllt → 100 % „Ziel erreicht“, je Übung 3/3', () => {
    const r = strength([exercise()]);
    expect(r).toMatchObject({ percent: 100, level: 'reached' });
    expect(r.exercises[0]).toMatchObject({
      fulfilledSets: 3,
      targetSets: 3,
      doneSets: 3,
      percent: 100,
    });
  });

  it('2 von 3 Sätzen → 66 % „Größtenteils“ (Handy-Test 6)', () => {
    const r = strength([exercise({ sets: [set(10, 50), set(10, 50), set(10, 50, false)] })]);
    expect(r).toMatchObject({ percent: 66, level: 'mostly' });
  });

  it('nach oben gekappt: mehr Sätze als Vorgabe bringen keine Extra-Punkte', () => {
    const r = strength([exercise({ sets: Array.from({ length: 5 }, () => set(12, 60)) })]);
    expect(r.percent).toBe(100);
    expect(r.exercises[0]?.fulfilledSets).toBe(3);
  });

  it('Wdh. genau reps_min zählt, eine weniger nicht', () => {
    expect(strength([exercise({ sets: [set(8, 50), set(8, 50), set(8, 50)] })]).percent).toBe(100);
    expect(strength([exercise({ sets: [set(7, 50), set(8, 50), set(8, 50)] })]).percent).toBe(66);
  });

  it('ohne reps_min gilt target_reps', () => {
    const e = exercise({
      repsMin: null,
      targetReps: 10,
      sets: [set(9, 50), set(10, 50), set(10, 50)],
    });
    expect(strength([e]).percent).toBe(66);
  });

  it('Gewicht: eine Stufe darunter zählt noch, zwei nicht (Langhantel 2,5 kg)', () => {
    const floor = 50 - LOAD_PROGRESSION.barbellIncrementKg;
    expect(
      strength([exercise({ sets: [set(10, floor), set(10, floor), set(10, floor)] })]).percent,
    ).toBe(100);
    expect(
      strength([exercise({ sets: [set(10, floor - 0.5), set(10, 50), set(10, 50)] })]).percent,
    ).toBe(66);
  });

  it('Gewicht ohne Eintrag bei Gewichtsvorgabe zählt nicht', () => {
    expect(strength([exercise({ sets: [set(10, null), set(10, 50), set(10, 50)] })]).percent).toBe(
      66,
    );
  });

  it('eigene Kurzhantel-Stufen: nächstkleinere Stufe zählt', () => {
    const e = exercise({
      incrementKind: 'free_weight',
      steps: [8, 10, 12.5],
      targetWeightKg: 12.5,
      sets: [set(10, 10), set(10, 10), set(10, 8)],
    });
    expect(strength([e]).percent).toBe(66);
  });

  it('Gewichtsstufe unter der Vorgabe (achievementWeightFloorKg)', () => {
    expect(achievementWeightFloorKg(50, 'barbell')).toBe(47.5);
    expect(achievementWeightFloorKg(50, 'machine')).toBe(47.5);
    expect(achievementWeightFloorKg(10, 'free_weight')).toBe(8);
    expect(achievementWeightFloorKg(10, 'free_weight', [6, 8, 10])).toBe(8);
    expect(achievementWeightFloorKg(6, 'free_weight', [6, 8, 10])).toBe(6);
    expect(achievementWeightFloorKg(10, 'none')).toBe(10);
    expect(achievementWeightFloorKg(10, null)).toBe(10);
    expect(achievementWeightFloorKg(1, 'barbell')).toBe(0);
  });

  it('Halteübung: Dauer ≥ 90 % der Vorgabe', () => {
    const hold = (d: number) =>
      exercise({
        loadType: 'time',
        targetSets: 1,
        repsMin: null,
        targetReps: null,
        targetWeightKg: null,
        targetDurationS: 30,
        incrementKind: 'none',
        sets: [set(null, null, true, d)],
      });
    expect(strength([hold(27)]).percent).toBe(100);
    expect(strength([hold(26)]).percent).toBe(0);
  });

  it('Körpergewicht/Band: nur Wdh., kein Gewicht', () => {
    const e = exercise({
      loadType: 'bodyweight',
      targetWeightKg: null,
      incrementKind: 'none',
      sets: [set(8), set(8), set(5)],
    });
    expect(strength([e]).percent).toBe(66);
  });

  it('ausgelassene Übung = 0 (auch mit eingetragenen Sätzen), Mittel über alle geplanten Übungen', () => {
    const r = strength([exercise(), exercise({ status: 'skipped', sets: [] })]);
    expect(r).toMatchObject({ percent: 50, level: 'partly' });
    const skippedWithSets = strength([exercise({ status: 'skipped' })]);
    expect(skippedWithSets).toMatchObject({ percent: 0, level: 'none' });
  });

  it('Alternative wird gegen ihre eigene gespeicherte Vorgabe gerechnet', () => {
    const alt = exercise({
      status: 'alternative',
      targetWeightKg: 20,
      sets: [set(10, 20), set(10, 20), set(10, 20)],
    });
    expect(strength([alt]).percent).toBe(100);
  });

  it('nicht abgehakte Sätze zählen nie', () => {
    expect(
      strength([exercise({ sets: [set(10, 50, false), set(10, 50, false), set(10, 50, false)] })])
        .percent,
    ).toBe(0);
  });

  it('ohne Vorgabe (Kalibrierung ohne Satzvorgabe): nur „gemacht“, kein Prozentwert', () => {
    const r = strength([exercise({ targetSets: null })]);
    expect(r).toMatchObject({ percent: null, level: 'done' });
    expect(r.exercises[0]).toMatchObject({ doneSets: 3, targetSets: null, percent: null });
  });

  it('gemischt: nur Übungen mit Vorgabe zählen fürs Mittel', () => {
    const r = strength([exercise(), exercise({ targetSets: null, sets: [] })]);
    expect(r.percent).toBe(100);
  });

  it('freie Einheit: „gemacht“, keine Vorgabe je Übung', () => {
    const r = strength([exercise({ targetSets: null, targetWeightKg: null })], { isFree: true });
    expect(r).toMatchObject({ percent: null, level: 'done' });
    expect(r.exercises[0]?.percent).toBeNull();
  });

  it('Erholungswoche: gleiche Rechnung, nur gekennzeichnet', () => {
    const normal = strength([exercise({ sets: [set(10, 50), set(10, 50)] })]);
    const easy = strength([exercise({ sets: [set(10, 50), set(10, 50)] })], {
      easyWeek: 'recovery',
    });
    expect(easy.percent).toBe(normal.percent);
    expect(easy.easyWeek).toBe('recovery');
  });

  it('12 Übungen und 1 Satz: Rundung abwärts (89,9 % ist nicht „erreicht“)', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      exercise({ targetSets: 1, sets: [set(i === 0 ? 0 : 10, 50)] }),
    );
    expect(strength(many)).toMatchObject({ percent: 91, level: 'reached' });
    const ten = Array.from({ length: 10 }, (_, i) =>
      exercise({ targetSets: 1, sets: [set(i === 0 ? 0 : 10, 50)] }),
    );
    expect(strength(ten)).toMatchObject({ percent: 90, level: 'reached' });
    const nine = Array.from({ length: 9 }, (_, i) =>
      exercise({ targetSets: 1, sets: [set(i === 0 ? 0 : 10, 50)] }),
    );
    expect(strength(nine)).toMatchObject({ percent: 88, level: 'mostly' });
  });

  it('ungültige Eingaben werden abgelehnt (Zod)', () => {
    expect(() => strength([exercise({ targetSets: -1 })])).toThrow();
    expect(() => strength([exercise({ sets: [set(Number.NaN, 50)] })])).toThrow();
  });
});

describe('Ausdauer', () => {
  it('Dauer / geplante Minuten', () => {
    expect(endurance()).toMatchObject({ percent: 100, level: 'reached' });
    expect(endurance({ durationS: 27 * 60 })).toMatchObject({ percent: 90, level: 'reached' });
    expect(endurance({ durationS: 26 * 60 + 59 })).toMatchObject({ percent: 89, level: 'mostly' });
    expect(endurance({ durationS: 18 * 60 })).toMatchObject({ percent: 60, level: 'mostly' });
    expect(endurance({ durationS: 10 * 60 })).toMatchObject({ percent: 33, level: 'partly' });
    expect(endurance({ durationS: 60 })).toMatchObject({ percent: 3, level: 'partly' });
  });

  it('mehr als 110 %: neutraler Hinweis, Wert gekappt', () => {
    expect(endurance({ durationS: 33 * 60 }).hints).toEqual([]);
    const longer = endurance({ durationS: 33 * 60 + 1 });
    expect(longer).toMatchObject({ percent: 100, level: 'reached' });
    expect(longer.hints).toEqual(['longer_than_planned']);
  });

  it('Anstrengung mehr als 2 über der Vorgabe: Hinweis, kein „nicht erreicht“', () => {
    expect(endurance({ sessionRpe: 5 }).hints).toEqual([]);
    const harder = endurance({ sessionRpe: 6 });
    expect(harder.hints).toEqual(['effort_above_plan']);
    expect(harder.level).toBe('reached');
    expect(endurance({ sessionRpe: null }).hints).toEqual([]);
    expect(endurance({ effortTarget: null, sessionRpe: 9 }).hints).toEqual([]);
  });

  it('Distanz nur angezeigt; ohne Vorgabe bzw. frei „gemacht“', () => {
    expect(endurance().endurance).toEqual({ minutes: 30, plannedMinutes: 30, distanceM: 5000 });
    expect(endurance({ plannedMinutes: null })).toMatchObject({ percent: null, level: 'done' });
    expect(endurance({ plannedMinutes: 0 })).toMatchObject({ percent: null, level: 'done' });
    const free = endurance({ isFree: true, plannedMinutes: null, effortTarget: null });
    expect(free).toMatchObject({ percent: null, level: 'done', hints: [] });
  });

  it('1 Minute und 12 Stunden', () => {
    expect(endurance({ durationS: 60, plannedMinutes: 1 })).toMatchObject({ percent: 100 });
    const long = endurance({ durationS: 12 * 3600, plannedMinutes: 60 });
    expect(long).toMatchObject({ percent: 100, hints: ['longer_than_planned'] });
    expect(long.endurance?.minutes).toBe(720);
  });
});

describe('Eigenschaft: Erfüllungsgrad immer 0–100, Stufe passt zum Wert, abgehakte Sätze nie mehr als eingetragen', () => {
  it('2.000 zufällige Einheiten', () => {
    const rand = seededRandom(424242);
    for (let i = 0; i < 2000; i += 1) {
      const exercises = Array.from({ length: 1 + Math.floor(rand() * 12) }, () =>
        exercise({
          status: rand() < 0.1 ? 'skipped' : rand() < 0.1 ? 'alternative' : 'done',
          targetSets: rand() < 0.1 ? null : 1 + Math.floor(rand() * 6),
          targetWeightKg: rand() < 0.3 ? null : Math.round(rand() * 100),
          sets: Array.from({ length: Math.floor(rand() * 8) }, () =>
            set(Math.floor(rand() * 15), Math.round(rand() * 110), rand() < 0.85),
          ),
        }),
      );
      const r = strength(exercises);
      if (r.percent !== null) {
        expect(r.percent).toBeGreaterThanOrEqual(0);
        expect(r.percent).toBeLessThanOrEqual(100);
      }
      expect(r.level).toBe(achievementLevel(r.percent));
      for (const e of r.exercises) {
        if (e.targetSets !== null) expect(e.fulfilledSets).toBeLessThanOrEqual(e.targetSets);
        expect(e.fulfilledSets).toBeLessThanOrEqual(e.doneSets);
      }
    }
  }, 60_000);
});
