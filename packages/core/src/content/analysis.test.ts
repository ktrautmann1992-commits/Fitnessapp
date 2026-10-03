import { describe, expect, it } from 'vitest';

import {
  estimateSessionMinutes,
  isPushPullBalanced,
  pushPullSets,
  sessionDurationWindow,
  weeklySetRange,
  weeklySetsByMuscle,
} from './analysis';
import { item, libraryMap, makeTemplate } from './test-fixtures';

const lib = libraryMap();

describe('weeklySetsByMuscle', () => {
  it('Hauptmuskel 1,0 und Nebenmuskel 0,5 je Satz', () => {
    const sets = weeklySetsByMuscle(makeTemplate(), lib);
    expect(sets.quadriceps).toBe(6);
    expect(sets.glutes).toBe(12);
    expect(sets.chest).toBe(6);
    expect(sets.triceps).toBe(4.5); // 6 × 0,5 (Brustdrücken) + 3 × 0,5 (Schulterdrücken)
    expect(sets.upper_back).toBe(7.5); // 6 × 1 (Rudern) + 3 × 0,5 (Latziehen)
    expect(sets.rear_delts).toBe(5);
    expect(sets.forearms).toBe(0);
  });

  it('unbekannte Übungen zählen nicht; leere Vorlage = 0', () => {
    const template = makeTemplate();
    const unknown = {
      ...template,
      sessions: [{ ...template.sessions[0]!, exercises: [item(1, 'gibt-es-nicht', 5)] }],
    };
    expect(Object.values(weeklySetsByMuscle(unknown, lib)).every((v) => v === 0)).toBe(true);
    expect(Object.values(weeklySetsByMuscle({ sessions: [] }, lib)).every((v) => v === 0)).toBe(
      true,
    );
  });
});

describe('weeklySetRange', () => {
  it.each([
    ['muscle_gain', 'beginner', 6, 14],
    ['muscle_gain', 'advanced', 10, 22],
    ['fat_loss', 'beginner', 6, 14],
    ['fat_loss', 'advanced', 8, 20],
    ['general_fitness', 'beginner', 4, 12],
    ['general_fitness', 'advanced', 6, 16],
  ] as const)('%s / %s: %i–%i', (goal_type, experience_level, min, max) => {
    expect(weeklySetRange({ goal_type, experience_level })).toEqual({ min, max });
  });
});

describe('estimateSessionMinutes', () => {
  it('Aufwärmen 8 min + Sätze + Pausen + 60 s Wechsel je Übung', () => {
    // 3 × 10 Wdh. × 4 s = 120 s, 2 Pausen × 120 s = 240 s, Wechsel 60 s, Aufwärmen 480 s → 900 s = 15 min
    expect(
      estimateSessionMinutes({ exercises: [item(1, 'a-b-c', 3, { reps_min: 10, reps_max: 10 })] }),
    ).toBe(15);
  });

  it('Halteübung zählt die Dauer; ein Satz ohne Pause', () => {
    // 1 × 60 s + 0 Pause + 60 s Wechsel + 480 s = 600 s = 10 min
    expect(
      estimateSessionMinutes({
        exercises: [item(1, 'a-b-c', 1, { reps_min: null, reps_max: null, duration_s: 60 })],
      }),
    ).toBe(10);
  });

  it('Supersatz: Pausen der Gruppe je Runde, Runden = größte Satzzahl', () => {
    const a = item(1, 'a-b-c', 3, { reps_min: 10, reps_max: 10, rest_s: 0, superset_group: 'A' });
    const b = item(2, 'd-e-f', 2, { reps_min: 10, reps_max: 10, rest_s: 90, superset_group: 'A' });
    // Arbeit (3 + 2) × 40 s = 200 s, Runden 3 → 2 × (0 + 90) = 180 s, Wechsel 120 s, Aufwärmen 480 s
    // = 980 s ≈ 16 min
    expect(estimateSessionMinutes({ exercises: [a, b] })).toBe(16);
  });

  it('Fixture-Vorlage liegt bei ca. 36 min', () => {
    expect(estimateSessionMinutes(makeTemplate().sessions[0]!)).toBe(36);
  });
});

describe('sessionDurationWindow', () => {
  it('Minuten-Spanne ± 15 %', () => {
    expect(sessionDurationWindow({ minutes_min: 45, minutes_max: 60 })).toEqual({
      min: 38.25,
      max: 69,
    });
  });
});

describe('Drücken/Ziehen', () => {
  it('zählt Sätze horizontal/vertikal drücken bzw. ziehen', () => {
    expect(pushPullSets(makeTemplate(), lib)).toEqual({ push: 9, pull: 9 });
  });

  it('ausgewogen bis 30 % Unterschied (Grenzfälle)', () => {
    expect(isPushPullBalanced({ push: 0, pull: 0 })).toBe(true);
    expect(isPushPullBalanced({ push: 13, pull: 10 })).toBe(true);
    expect(isPushPullBalanced({ push: 10, pull: 13 })).toBe(true);
    expect(isPushPullBalanced({ push: 14, pull: 10 })).toBe(false);
    expect(isPushPullBalanced({ push: 10, pull: 14 })).toBe(false);
    expect(isPushPullBalanced({ push: 3, pull: 0 })).toBe(false);
  });
});
