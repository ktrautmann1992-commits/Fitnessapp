import type { WorkoutTimerStep } from '@fitnessapp/core';
import { describe, expect, it } from 'vitest';

import {
  clockText,
  doseText,
  passText,
  perSide,
  sideText,
  stepAnnouncement,
  stepTitle,
} from './workout-timer-format';

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
    expect(stepTitle({ kind: 'rest', seconds: 5, after: 'side' }, names)).toBe('Seite wechseln');
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
    // Flow mit Seitenwechsel (Sportarten Stufe 1): Seite wird mit angesagt.
    expect(
      stepAnnouncement({ step: work({ side: 'left' }), remainingS: 30, finished: false }, names),
    ).toBe('Kniebeuge, linke Seite: noch 30 Sekunden');
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

  it('einseitig je Seite (Player): „Linke/Rechte Seite“, Wiederholungen ohne „je Seite“, Seitenwechsel angesagt', () => {
    const left = work({ exerciseId: 'split', side: 'left', seconds: 30, reps: 8, timeBoxed: true });
    expect(sideText(left)).toBe('Linke Seite');
    expect(sideText(work({ exerciseId: 'split', side: 'right' }))).toBe('Rechte Seite');
    expect(sideText(work())).toBeNull();
    expect(sideText(null)).toBeNull();
    expect(perSide(left, names)).toBe(false);
    expect(perSide(work({ exerciseId: 'split' }), names)).toBe(true);
    expect(doseText(left, names)).toBe('8 Wiederholungen');
    expect(
      stepAnnouncement(
        { step: { kind: 'rest', seconds: 5, after: 'side' }, remainingS: 5, finished: false },
        names,
      ),
    ).toBe('Seite wechseln: noch 5 Sekunden');
  });
});
