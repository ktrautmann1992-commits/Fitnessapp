/**
 * Testdaten für die Workout-Tests (nur in *.test.ts benutzt): eine kleine Bibliothek und ein Workout, das ALLE Regeln
 * erfüllt – jeder Test verändert genau eine Stelle.
 */
import type { Exercise } from '../content/schemas';
import { makeExercise } from '../content/test-fixtures';
import type { Workout, WorkoutContentItem } from './schema';

const published = (overrides: Partial<Exercise>): Exercise =>
  makeExercise({
    status: 'published',
    equipment_ids: [],
    load_type: 'bodyweight',
    difficulty: 1,
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-03',
      expert_reviewed: false,
      reviewed_by: 'Test',
      reviewed_at: '2026-10-04',
      review_note: null,
    },
    ...overrides,
  });

export const WORKOUT_LIBRARY: Exercise[] = [
  published({ id: 'kniebeuge-kg', name_de: 'Kniebeuge' }),
  published({ id: 'liegestuetz-kg', name_de: 'Liegestütz', movement_pattern: 'horizontal_push' }),
  published({
    id: 'unterarmstuetz-kg',
    name_de: 'Unterarmstütz',
    load_type: 'time',
    movement_pattern: 'core_anti_extension',
  }),
  published({
    id: 'split-kg',
    name_de: 'Split-Kniebeuge',
    unilateral: true,
    movement_pattern: 'lunge',
  }),
  published({
    id: 'hampelmann-kg',
    name_de: 'Hampelmann',
    load_type: 'time',
    caution_tags: ['high_impact'],
    movement_pattern: 'conditioning',
  }),
  published({
    id: 'rudern-kh',
    name_de: 'Rudern mit Kurzhantel',
    load_type: 'weight',
    equipment_ids: ['dumbbells'],
    movement_pattern: 'horizontal_pull',
  }),
  published({
    id: 'nordic-kg',
    name_de: 'Nordic Curl',
    difficulty: 3,
    caution_tags: ['high_skill'],
    movement_pattern: 'knee_flexion',
  }),
  makeExercise({ id: 'entwurf-uebung', name_de: 'Entwurf', status: 'draft', equipment_ids: [] }),
];

export const workoutLibraryMap = (exercises: Exercise[] = WORKOUT_LIBRARY) =>
  new Map(exercises.map((e) => [e.id, e] as const));

export function workoutItem(
  exerciseId: string,
  overrides: Partial<WorkoutContentItem> = {},
): WorkoutContentItem {
  return {
    exercise_id: exerciseId,
    reps: 10,
    duration_s: null,
    sets: null,
    rest_s: 15,
    note_de: null,
    ...overrides,
  };
}

/** Zirkel, 2 Sterne, 3 Runden: 10 Kniebeugen, 10 Liegestütz, 30 s Unterarmstütz – geschätzt 7 Minuten. */
export function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 'test-workout',
    version: 1,
    status: 'published',
    title_de: 'Test-Workout',
    summary_de: 'Ein kurzer Zirkel ohne Geräte zum Testen aller Regeln.',
    category: 'full_body',
    difficulty: 2,
    minutes: 7,
    format: 'circuit',
    rounds: 3,
    round_rest_s: 30,
    equipment_ids: [],
    warmup_de: 'Fünf Minuten locker auf der Stelle gehen und die Arme kreisen.',
    cooldown_de: 'Zum Schluss ruhig gehen und durchatmen.',
    exercises: [
      workoutItem('kniebeuge-kg'),
      workoutItem('liegestuetz-kg'),
      workoutItem('unterarmstuetz-kg', { reps: null, duration_s: 30 }),
    ],
    meta: {
      origin: 'claude_session',
      model: 'claude-opus-5-5',
      batch_id: null,
      created_on: '2026-10-20',
      expert_reviewed: false,
      reviewed_by: 'Test',
      reviewed_at: '2026-10-20',
      review_note: null,
    },
    ...overrides,
  };
}
