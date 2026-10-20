import type { WorkoutTimerStep } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import { clockText, doseText, passText, stepAnnouncement, stepTitle } from './workout-timer-format';

const names = new Map([
  ['kniebeuge', { name_de: 'Kniebeuge', unilateral: false }],
  ['split', { name_de: 'Split-Kniebeuge', unilateral: true }],
]);
const work = (
  overrides: Partial<Extract<WorkoutTimerStep, { kind: 'work' }>> = {},
): Extract<WorkoutTimerStep, { kind: 'work' }> => ({
  kind: 'work',
  itemIndex: 0,
  exerciseId: 'kniebeuge',
  pass: 1,
  passes: 3,
  round: 1,
  seconds: 40,
  reps: null,
  ...overrides,
});

describe('Workout-Timer: Anzeige-Texte', () => {
  it('Uhr mm:ss', () => {
    expect(clockText(0)).toBe('0:00');
    expect(clockText(45)).toBe('0:45');
    expect(clockText(605)).toBe('10:05');
    expect(clockText(-3)).toBe('0:00');
  });

  it('Überschrift je Schritt', () => {
    expect(stepTitle({ kind: 'prepare', seconds: 5 }, names)).toBe('Gleich geht’s los');
    expect(stepTitle({ kind: 'rest', seconds: 20, after: 'exercise' }, names)).toBe('Pause');
    expect(stepTitle({ kind: 'rest', seconds: 60, after: 'round' }, names)).toBe('Rundenpause');
    expect(stepTitle({ kind: 'rest', seconds: 60, after: 'set' }, names)).toBe('Satzpause');
    expect(stepTitle(work(), names)).toBe('Kniebeuge');
    expect(stepTitle(work({ exerciseId: 'unbekannt' }), names)).toBe('unbekannt');
    expect(stepTitle(null, names)).toBe('');
  });

  it('Runde bzw. Satz', () => {
    expect(passText(work({ pass: 2, round: 2 }), { round: 2, rounds: 3 })).toBe('Runde 2 von 3');
    expect(passText(work({ pass: 2 }), { round: 1, rounds: 1 })).toBe('Satz 2 von 3');
    expect(passText(null, { round: 1, rounds: 1 })).toBe('Runde 1 von 1');
  });

  it('Dosierung und Ansage (einseitig: je Seite)', () => {
    expect(doseText(work(), names)).toBe('40 s');
    expect(doseText(work({ exerciseId: 'split', seconds: null, reps: 8 }), names)).toBe(
      '8 Wiederholungen je Seite',
    );
    expect(stepAnnouncement({ step: work(), remainingS: 40, finished: false }, names)).toBe(
      'Kniebeuge: noch 40 Sekunden',
    );
    expect(
      stepAnnouncement(
        { step: work({ seconds: null, reps: 10 }), remainingS: null, finished: false },
        names,
      ),
    ).toBe('Kniebeuge: 10 Wiederholungen');
    expect(stepAnnouncement({ step: null, remainingS: null, finished: true }, names)).toBe(
      'Geschafft!',
    );
  });
});
