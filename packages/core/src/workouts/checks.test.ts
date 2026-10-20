import { describe, expect, it } from 'vitest';

import { validateContent } from '../content/validate';
import { checkWorkout } from './checks';
import { makeWorkout, WORKOUT_LIBRARY, workoutItem, workoutLibraryMap } from './test-fixtures';

const rules = (workout = makeWorkout()) =>
  checkWorkout(workout, workoutLibraryMap()).map((issue) => issue.rule);

describe('checkWorkout (W2–W7)', () => {
  it('Muster-Workout ohne Befund', () => {
    expect(checkWorkout(makeWorkout(), workoutLibraryMap())).toEqual([]);
  });

  it('W2: unbekannte Übung; freigegeben nur mit freigegebenen Übungen', () => {
    expect(
      rules(
        makeWorkout({ exercises: [workoutItem('gibt-es-nicht'), workoutItem('kniebeuge-kg')] }),
      ),
    ).toContain('W2');
    const withDraft = makeWorkout({
      exercises: [workoutItem('entwurf-uebung'), workoutItem('kniebeuge-kg')],
    });
    expect(rules(withDraft)).toContain('W2');
    expect(rules({ ...withDraft, status: 'draft' })).not.toContain('W2');
  });

  it('W3: Geräte = Vereinigung der Übungsgeräte, nur Katalog-Geräte', () => {
    const exercises = [workoutItem('rudern-kh'), workoutItem('kniebeuge-kg')];
    expect(rules(makeWorkout({ exercises, minutes: 5 }))).toContain('W3');
    expect(
      rules(makeWorkout({ exercises, equipment_ids: ['dumbbells'], minutes: 5 })),
    ).not.toContain('W3');
    expect(rules(makeWorkout({ equipment_ids: ['dumbbells'] }))).toContain('W3');
    const unknown = checkWorkout(
      makeWorkout({ equipment_ids: ['zauberstab'] }),
      workoutLibraryMap(),
    );
    expect(unknown.map((i) => i.message).join(' ')).toContain('gibt es nicht im Katalog');
  });

  it('W4: Zeitübung nach Sekunden, Gewicht nach Wiederholungen', () => {
    expect(
      rules(
        makeWorkout({ exercises: [workoutItem('unterarmstuetz-kg'), workoutItem('kniebeuge-kg')] }),
      ),
    ).toContain('W4');
    expect(
      rules(
        makeWorkout({
          equipment_ids: ['dumbbells'],
          exercises: [
            workoutItem('rudern-kh', { reps: null, duration_s: 30 }),
            workoutItem('kniebeuge-kg'),
          ],
        }),
      ),
    ).toContain('W4');
  });

  it('W5: 1–2 Sterne nur leichte Übungen ohne high_skill, 1 Stern ohne Sprünge', () => {
    const hard = makeWorkout({
      exercises: [workoutItem('nordic-kg', { reps: 5 }), workoutItem('kniebeuge-kg')],
    });
    const found = checkWorkout(hard, workoutLibraryMap()).filter((i) => i.rule === 'W5');
    expect(found.map((i) => i.message).join(' ')).toMatch(/zu schwer.*high_skill/);
    expect(rules({ ...hard, difficulty: 3 })).not.toContain('W5');

    const jumps = makeWorkout({
      difficulty: 1,
      exercises: [
        workoutItem('hampelmann-kg', { reps: null, duration_s: 30 }),
        workoutItem('kniebeuge-kg'),
      ],
    });
    expect(rules(jumps)).toContain('W5');
    expect(rules({ ...jumps, difficulty: 2 })).not.toContain('W5');
  });

  it('W5: Pausen bei 1–2 Sternen mindestens 10 s (letzte Übung im Zirkel ausgenommen)', () => {
    const noRest = makeWorkout({
      exercises: [
        workoutItem('kniebeuge-kg', { rest_s: 0 }),
        workoutItem('liegestuetz-kg'),
        workoutItem('unterarmstuetz-kg', { reps: null, duration_s: 30, rest_s: 0 }),
      ],
    });
    const found = checkWorkout(noRest, workoutLibraryMap()).filter((i) => i.rule === 'W5');
    expect(found.map((i) => i.path)).toEqual(['exercises.0.rest_s']);
    expect(rules({ ...noRest, difficulty: 3 })).not.toContain('W5');
    expect(rules(makeWorkout({ round_rest_s: 0, minutes: 6 }))).toContain('W5');
    expect(rules(makeWorkout({ round_rest_s: 0, rounds: 1, minutes: 2 }))).not.toContain('W5');
  });

  it('W5 bei Sätze × Wdh.: Pause zwischen Sätzen zählt auch bei der letzten Übung', () => {
    const workout = makeWorkout({
      format: 'sets_reps',
      rounds: 1,
      round_rest_s: 0,
      minutes: 3,
      exercises: [
        workoutItem('kniebeuge-kg', { sets: 2, rest_s: 30 }),
        workoutItem('liegestuetz-kg', { sets: 2, rest_s: 5 }),
      ],
    });
    expect(rules(workout)).toContain('W5');
    expect(
      rules({
        ...workout,
        exercises: [
          workoutItem('kniebeuge-kg', { sets: 2, rest_s: 30 }),
          workoutItem('liegestuetz-kg', { sets: 1, rest_s: 0 }),
        ],
      }),
    ).not.toContain('W5');
  });

  it('W6 (gelb): Dauer passt zur Schätzung (±20 %, mindestens ±2 Min.)', () => {
    expect(rules(makeWorkout({ minutes: 9 }))).not.toContain('W6');
    expect(rules(makeWorkout({ minutes: 10 }))).toContain('W6');
    const issue = checkWorkout(makeWorkout({ minutes: 20 }), workoutLibraryMap()).find(
      (i) => i.rule === 'W6',
    );
    expect(issue?.severity).toBe('warning');
    expect(issue?.message).toContain('geschätzt etwa 7 Min.');
  });

  it('W7: Textregeln (Gesundheitsversprechen, Marken)', () => {
    expect(
      rules(makeWorkout({ summary_de: 'Kurbelt die Fettverbrennung an – ganz ohne Geräte.' })),
    ).toContain('W7');
    expect(
      rules(makeWorkout({ warmup_de: 'Fünf Minuten mit dem TRX-Band locker aufwärmen.' })),
    ).toContain('W7');
  });

  it('validateContent: W1 blockiert immer, rote Befunde nur bei freigegebenen Workouts', () => {
    const exerciseFiles = WORKOUT_LIBRARY.map((e) => ({
      kind: 'exercise' as const,
      fileName: `${e.id}.json`,
      data: e,
    }));
    const broken = validateContent([
      ...exerciseFiles,
      { kind: 'workout', fileName: 'kaputt.json', data: { id: 'kaputt' } },
    ]);
    expect(broken.blocking.some((i) => i.rule === 'W1')).toBe(true);

    const draft = makeWorkout({
      status: 'draft',
      exercises: [workoutItem('fehlt'), workoutItem('kniebeuge-kg')],
    });
    const draftResult = validateContent([
      ...exerciseFiles,
      { kind: 'workout', fileName: 'test-workout.json', data: draft },
    ]);
    expect(draftResult.workouts).toHaveLength(1);
    expect(draftResult.issues.some((i) => i.rule === 'W2')).toBe(true);
    expect(draftResult.blocking.filter((i) => i.kind === 'workout')).toEqual([]);

    const published = validateContent([
      ...exerciseFiles,
      { kind: 'workout', fileName: 'test-workout.json', data: { ...draft, status: 'published' } },
    ]);
    expect(published.blocking.some((i) => i.rule === 'W2')).toBe(true);
  });
});
