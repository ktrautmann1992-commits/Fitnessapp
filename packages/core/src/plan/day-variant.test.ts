import { describe, expect, it } from 'vitest';

import { LIGHTER_DAY } from '../constants';
import type { Exercise } from '../content/schemas';
import { applyCurrentSafetyRules } from './apply-safety';
import type { PlannedExerciseDraft } from './adapt';
import {
  combineDayOffers,
  lighterExercise,
  lighterMinutes,
  lighterSessionVariant,
  type DayVariantSession,
} from './day-variant';

function exercise(sets: number, rpe: number, id = 'kniebeuge'): PlannedExerciseDraft {
  return {
    order_no: 1,
    exercise_id: id,
    source_exercise_id: id,
    exercise_name_de: id,
    sets,
    reps_min: 8,
    reps_max: 12,
    duration_s: null,
    rest_s: 90,
    rpe_target: rpe,
    superset_group: null,
    notes_de: null,
    target_weight_kg: 40,
  };
}

const strength = (exercises: PlannedExerciseDraft[], minutes = 45) => ({
  kind: 'strength' as const,
  exercises,
  estimated_minutes: minutes,
});

describe('„Heute leichter“ (Plan 3.3)', () => {
  it('Kraft: 1 Satz weniger, RPE −1, gleiche Gewichte', () => {
    const result = lighterSessionVariant(strength([exercise(3, 8), exercise(4, 7.5, 'rudern')]));
    expect(result.exercises.map((e) => [e.sets, e.rpe_target, e.target_weight_kg])).toEqual([
      [2, 7, 40],
      [3, 6.5, 40],
    ]);
    expect(result.estimated_minutes).toBe(36);
  });

  it('Übung mit 1 Satz bleibt bei 1, RPE 5 bleibt 5 (Halteübung, Körpergewicht)', () => {
    const hold = {
      ...exercise(1, 5, 'unterarmstuetz'),
      reps_min: null,
      reps_max: null,
      duration_s: 30,
    };
    expect(lighterExercise(hold)).toMatchObject({ sets: 1, rpe_target: 5, duration_s: 30 });
    expect(lighterExercise(exercise(2, 5.5))).toMatchObject({ sets: 1, rpe_target: 5 });
  });

  it('Ausdauer: Dauer × 0,8, mindestens 10 min, nie mehr als geplant', () => {
    expect(lighterMinutes(50)).toBe(40);
    expect(lighterMinutes(12)).toBe(10);
    expect(lighterMinutes(10)).toBe(10);
    expect(lighterMinutes(8)).toBe(8);
  });

  it('harte Ausdauer wird locker (ohne Schritte), lockere bleibt locker', () => {
    const hard: DayVariantSession = {
      kind: 'endurance',
      exercises: [],
      estimated_minutes: 45,
      effort_target: 7,
      workout_type: 'intervals',
      workout_steps: [],
    };
    expect(lighterSessionVariant(hard)).toMatchObject({
      estimated_minutes: 36,
      effort_target: 4,
      workout_type: 'easy',
      workout_steps: null,
    });
    const easy: DayVariantSession = {
      kind: 'endurance',
      exercises: [],
      estimated_minutes: 30,
      effort_target: 3,
      workout_type: 'long',
    };
    expect(lighterSessionVariant(easy)).toMatchObject({
      estimated_minutes: 24,
      effort_target: 3,
      workout_type: 'long',
    });
    // ohne Anstrengung/Art (Phase-3-Ausdauer)
    expect(
      lighterSessionVariant({ kind: 'endurance', exercises: [], estimated_minutes: 20 }),
    ).toEqual({ kind: 'endurance', exercises: [], estimated_minutes: 16 });
  });

  it('1 vs. 7 Einheiten je Woche: jede Einheit für sich, unabhängig von der Woche', () => {
    const one = lighterSessionVariant(strength([exercise(3, 8)]));
    const seven = Array.from({ length: 7 }, () =>
      lighterSessionVariant(strength([exercise(3, 8)])),
    );
    for (const s of seven) expect(s).toEqual(one);
  });

  it('Eigenschaft: leichter ≤ geplant (Sätze, RPE, Minuten), besteht danach die Sicherheitsregeln', () => {
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const library = new Map<string, Exercise>([
      ['kniebeuge', { id: 'kniebeuge', caution_tags: [] } as unknown as Exercise],
    ]);
    for (let run = 0; run < 300; run += 1) {
      const planned = strength(
        Array.from({ length: 1 + Math.floor(random() * 6) }, () =>
          exercise(1 + Math.floor(random() * 6), 5 + Math.floor(random() * 9) / 2),
        ),
        10 + Math.floor(random() * 110),
      );
      const lighter = lighterSessionVariant(planned);
      expect(lighter.estimated_minutes).toBeLessThanOrEqual(planned.estimated_minutes);
      lighter.exercises.forEach((e, i) => {
        const p = planned.exercises[i] as PlannedExerciseDraft;
        expect(e.sets).toBeLessThanOrEqual(p.sets);
        expect(e.sets).toBeGreaterThanOrEqual(LIGHTER_DAY.minSets);
        expect(e.rpe_target).toBeLessThanOrEqual(p.rpe_target);
        expect(e.rpe_target).toBeGreaterThanOrEqual(LIGHTER_DAY.minRpe);
      });
      // Vorsichtiger Plan: Sicherheitsregeln laufen danach und bleiben streng (RPE-Deckel 6).
      const safe = applyCurrentSafetyRules(
        lighter,
        {
          rpeMax: 6,
          excludedCautionTags: [],
          cautious: true,
        },
        { library },
      );
      for (const e of safe.session.exercises) expect(e.rpe_target).toBeLessThanOrEqual(6);
    }
  });
});

describe('combineDayOffers (Rangfolge mit Phase 8)', () => {
  it('Zyklus + Readiness „leichter“ → nur eine Stufe', () => {
    expect(combineDayOffers(['lighter', 'lighter'])).toBe('lighter');
  });
  it('Ruhetag schlägt leichter, Verschieben schlägt leichter', () => {
    expect(combineDayOffers(['lighter', 'rest'])).toBe('rest');
    expect(combineDayOffers(['move', 'lighter'])).toBe('move');
    expect(combineDayOffers(['move', 'rest'])).toBe('rest');
  });
  it('ohne Angebot → wie geplant', () => {
    expect(combineDayOffers([])).toBe('as_planned');
    expect(combineDayOffers(['as_planned'])).toBe('as_planned');
  });
});
