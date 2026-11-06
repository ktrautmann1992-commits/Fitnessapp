import { describe, expect, it } from 'vitest';

import { planPersonRows, TODAY, VERSIONS } from '../test/fixtures';
import { postWorkoutMealFromWeek } from './post-workout-meal';

/**
 * Karte „Nach dem Training“ (06.11.2026): Abbildung der Zeilen – die Entscheidung selbst ist in packages/core
 * getestet (post-workout.test.ts, mit echtem Essensplan). Hier: ohne berechenbare Woche nie eine Karte, nie ein Fehler.
 */
describe('postWorkoutMealFromWeek', () => {
  const base = {
    rows: planPersonRows(),
    versions: VERSIONS,
    today: TODAY,
    nowMinutes: 12 * 60,
    showNumbers: true,
  };

  it('ohne Woche, unvollständig bzw. gesperrt → null', () => {
    expect(postWorkoutMealFromWeek({ ...base, week: null })).toBeNull();
    expect(postWorkoutMealFromWeek({ ...base, week: { kind: 'incomplete' } })).toBeNull();
  });

  it('Fehler in der Berechnung sperren nie die Ansicht → null', () => {
    const broken = { kind: 'ready', targets: null } as unknown as Parameters<
      typeof postWorkoutMealFromWeek
    >[0]['week'];
    expect(postWorkoutMealFromWeek({ ...base, week: broken })).toBeNull();
  });
});
