import { describe, expect, it } from 'vitest';

import { equipmentProfile } from '../plan/equipment-profile';
import { generateTrainingPlan } from '../plan/generate';
import { person } from '../plan/test-library';
import { progressionContextsForPlan } from './contexts';
import { adjustLibrary, stored } from './test-helpers';

/** progressionContextsForPlan (Etappe D): eine Zusammenstellung der Kontexte für App und Server. */
describe('progressionContextsForPlan', () => {
  const result = generateTrainingPlan(
    person({ experienceLevel: 'advanced', sessionsPerWeek: 3 }),
    adjustLibrary,
    '2026-10-05',
  );
  if (!result.ok) throw new Error('Plan fehlt');
  const sessions = stored(result.plan.sessions);
  const profiles = new Map([
    ['gym', equipmentProfile('gym', [])],
    ['home', equipmentProfile('home', [])],
  ] as const);

  it('je Kraft-Übung des Plans ein Kontext aus der nächsten geplanten Einheit (Wdh.-Bereich, Vorlagen-Sätze)', () => {
    const contexts = progressionContextsForPlan({
      sessions,
      today: '2026-10-14',
      library: adjustLibrary.exercises,
      profiles,
      weeklySetMax: null,
    });
    const ids = new Set(
      sessions
        .filter((s) => s.kind === 'strength')
        .flatMap((s) => s.exercises.map((e) => e.exercise_id)),
    );
    expect(Object.keys(contexts).sort()).toEqual([...ids].sort());
    const next = sessions.find((s) => s.kind === 'strength' && s.scheduled_on >= '2026-10-14');
    const first = next?.exercises[0];
    if (!first) throw new Error('Übung fehlt');
    const ctx = contexts[first.exercise_id];
    expect(ctx).toMatchObject({ repsMin: first.reps_min, repsMax: first.reps_max });
    expect(ctx?.templateSets).toBeGreaterThanOrEqual(first.sets);
    // Ohne Obergrenze der Vorlage nie Zusatzsatz; Studio ohne eigene Stufen.
    expect(ctx?.allowExtraSet).toBe(false);
    expect(ctx?.steps).toEqual([]);
  });

  it('ohne kommende Einheit: die zuletzt geplante; unbekannte Übungen fehlen', () => {
    const last = sessions.at(-1)?.scheduled_on as string;
    const contexts = progressionContextsForPlan({
      sessions: sessions.map((s, i) =>
        i === 0 ? { ...s, exercises: [{ ...s.exercises[0]!, exercise_id: 'gibt-es-nicht' }] } : s,
      ),
      today: '2027-12-31',
      library: adjustLibrary.exercises,
      profiles,
      weeklySetMax: 30,
    });
    expect(contexts['gibt-es-nicht']).toBeUndefined();
    expect(Object.keys(contexts).length).toBeGreaterThan(0);
    expect(last < '2027-12-31').toBe(true);
  });

  it('leerer Plan → keine Kontexte', () => {
    expect(
      progressionContextsForPlan({
        sessions: [],
        today: '2026-10-14',
        library: adjustLibrary.exercises,
        profiles,
        weeklySetMax: null,
      }),
    ).toEqual({});
  });
});
