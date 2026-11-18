import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CUSTOM_WORKOUT_RULES, GROUP_BARBELL_ONLY_EXERCISE_IDS } from '../constants';
import type { Exercise } from '../content/schemas';
import { EXERCISES } from '../plan/swap-test-helpers';
import { type Workout, workoutSchema } from './schema';
import {
  applyWorkoutVariant,
  mapWorkoutItem,
  replaceWorkoutItem,
  type WorkoutSwapContext,
  workoutSwapCandidates,
  workoutVariantSchema,
  withVariantSwap,
} from './swap';

/** Übungen in Workouts tauschen und persönliche Varianten (docs/PLAN-EIGENE-WORKOUTS.md 2). */

function load(id: string): Workout {
  const url = new URL(`../../../../content/workouts/${id}.json`, import.meta.url);
  return workoutSchema.parse(JSON.parse(readFileSync(url, 'utf8')));
}
const ex = (id: string): Exercise => {
  const found = EXERCISES.get(id);
  if (!found) throw new Error(`Übung fehlt: ${id}`);
  return found;
};

const ALL_GYM = new Set([
  'dumbbells',
  'barbell',
  'power_rack',
  'flat_bench',
  'incline_bench',
  'cable_station',
  'resistance_bands',
  'pull_up_bar',
  'kettlebells',
]);
const ctx = (overrides: Partial<WorkoutSwapContext> = {}): WorkoutSwapContext => ({
  library: EXERCISES,
  available: ALL_GYM,
  dislikes: new Set(),
  excludedCautionTags: [],
  ...overrides,
});

const BB60 = load('barbell-burn-60');

function circuit(
  ...items: [string, { reps?: number | null; duration_s?: number | null }][]
): Workout {
  return workoutSchema.parse({
    ...BB60,
    id: 'test-zirkel',
    format: 'circuit',
    rounds: 3,
    round_rest_s: 60,
    equipment_ids: [...new Set(items.flatMap(([id]) => ex(id).equipment_ids))],
    exercises: items.map(([id, d]) => ({
      exercise_id: id,
      reps: d.reps ?? null,
      duration_s: d.duration_s ?? null,
      sets: null,
      rest_s: 15,
      note_de: null,
    })),
  });
}

describe('workoutSwapCandidates', () => {
  const w = circuit(
    ['goblet-kniebeuge', { reps: 12 }],
    ['liegestuetz', { reps: 10 }],
    ['unterarmstuetz', { duration_s: 30 }],
  );

  it('Rangliste: eigene Alternativen zuerst, dann gleiches Muster mit gemeinsamem Hauptmuskel', () => {
    const list = workoutSwapCandidates(w, 0, ctx());
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(CUSTOM_WORKOUT_RULES.swap.maxCandidates);
    const alternatives = ex('goblet-kniebeuge').alternatives.map((a) => a.alternative_id);
    const firstReasons = list.map((c) => c.reason);
    const lastAlt = firstReasons.lastIndexOf('alternative');
    expect(firstReasons.slice(0, lastAlt + 1).every((r) => r === 'alternative')).toBe(true);
    for (const c of list.filter((c) => c.reason === 'alternative')) {
      expect(alternatives).toContain(c.exercise.id);
    }
    for (const c of list) {
      expect(
        c.exercise.primary_muscles.some((m) =>
          ex('goblet-kniebeuge').primary_muscles.includes(m),
        ) || c.reason === 'alternative',
      ).toBe(true);
      expect(
        Math.abs(c.exercise.difficulty - ex('goblet-kniebeuge').difficulty),
      ).toBeLessThanOrEqual(1);
    }
  });

  it('nie: Übung schon im Workout, „Mag ich nicht“, fehlende Geräte, ausgeschlossene Merkmale', () => {
    const base = workoutSwapCandidates(w, 1, ctx()).map((c) => c.exercise.id);
    const disliked = base[0] as string;
    const without = workoutSwapCandidates(w, 1, ctx({ dislikes: new Set([disliked]) })).map(
      (c) => c.exercise.id,
    );
    expect(without).not.toContain(disliked);
    expect(without).not.toContain('liegestuetz');
    const nothing = workoutSwapCandidates(w, 1, ctx({ available: new Set() }));
    for (const c of nothing)
      expect(
        c.exercise.equipment_ids.filter((e) => !['mat', 'yoga_block', 'step_bench'].includes(e)),
      ).toEqual([]);
    const noFloor = workoutSwapCandidates(w, 1, ctx({ excludedCautionTags: ['floor_transfer'] }));
    for (const c of noFloor) expect(c.exercise.caution_tags).not.toContain('floor_transfer');
    for (const c of workoutSwapCandidates(w, 0, ctx())) {
      expect(['liegestuetz', 'unterarmstuetz', 'goblet-kniebeuge']).not.toContain(c.exercise.id);
    }
  });

  it('Höchst-Schwierigkeit (Level) wird beachtet', () => {
    for (const c of workoutSwapCandidates(w, 1, ctx({ maxDifficulty: 1 }))) {
      expect(c.exercise.difficulty).toBeLessThanOrEqual(1);
    }
  });

  it('Dosierung: Zeit bleibt Zeit, Wiederholungen → Zeitfenster bei Halteübungen, Zeit → Wdh. bei Gewicht', () => {
    const plank = workoutSwapCandidates(w, 2, ctx());
    for (const c of plank) {
      if (c.exercise.load_type === 'weight') expect(c.item.reps).not.toBeNull();
      else expect(c.item.duration_s).toBe(30);
    }
    const item = w.exercises[0]!;
    const toHold = mapWorkoutItem(item, ex('goblet-kniebeuge'), ex('unterarmstuetz'), 'circuit');
    expect(toHold).toMatchObject({ reps: null, duration_s: 40, exercise_id: 'unterarmstuetz' });
    const timed = { ...item, reps: null, duration_s: 45 };
    expect(
      mapWorkoutItem(timed, ex('unterarmstuetz'), ex('goblet-kniebeuge'), 'circuit'),
    ).toMatchObject({ reps: 15, duration_s: null });
    expect(
      mapWorkoutItem(timed, ex('unterarmstuetz'), ex('goblet-kniebeuge'), 'interval'),
    ).toMatchObject({ reps: null, duration_s: 45 });
    expect(
      mapWorkoutItem(item, ex('goblet-kniebeuge'), ex('kniebeuge-koerpergewicht'), 'circuit'),
    ).toMatchObject({ reps: 12, sets: null, rest_s: 15 });
  });

  it('Flow-Routinen (Yoga/Pilates) und unbekannte Positionen: keine Kandidaten', () => {
    expect(workoutSwapCandidates({ ...w, format: 'flow' }, 0, ctx())).toEqual([]);
    expect(workoutSwapCandidates(w, 9, ctx())).toEqual([]);
  });

  it('Barbell Burn: eigene Alternativen der Gruppenübung zuerst, sonst nie andere Gruppenübungen aus der Suche', () => {
    const index = BB60.exercises.findIndex((e) => e.exercise_id === 'langhantelrudern');
    const list = workoutSwapCandidates(BB60, index, ctx());
    expect(list.length).toBeGreaterThan(0);
    for (const c of list.filter((c) => c.reason !== 'alternative')) {
      expect(GROUP_BARBELL_ONLY_EXERCISE_IDS).not.toContain(c.exercise.id);
    }
    // Ergebnis bleibt ein gültiges Workout (Geräte neu berechnet).
    const swapped = replaceWorkoutItem(BB60, index, list[0]!.item, EXERCISES);
    expect(swapped).not.toBeNull();
    expect(workoutSchema.safeParse(swapped).success).toBe(true);
    expect(swapped!.exercises[index]?.exercise_id).toBe(list[0]!.exercise.id);
    expect(
      replaceWorkoutItem(
        BB60,
        index,
        { ...list[0]!.item, exercise_id: BB60.exercises[0]!.exercise_id },
        EXERCISES,
      ),
    ).toBeNull();
  });
});

describe('Persönliche Variante', () => {
  const w = circuit(['goblet-kniebeuge', { reps: 12 }], ['liegestuetz', { reps: 10 }]);

  it('Tausch speichern, anwenden, zurücktauschen = Original wiederherstellen', () => {
    const v1 = withVariantSwap(w, null, 1, 'liegestuetz-erhoeht');
    expect(workoutVariantSchema.safeParse(v1).success).toBe(true);
    const applied = applyWorkoutVariant(w, v1, EXERCISES);
    expect(applied.applied).toBe(1);
    expect(applied.swappedIndexes).toEqual([1]);
    expect(applied.workout.exercises[1]?.exercise_id).toBe('liegestuetz-erhoeht');
    expect(applied.workout.exercises[1]?.reps).toBe(10);
    // Gleiche Position erneut tauschen: ersetzt den Tausch (von = Original).
    const v2 = withVariantSwap(w, v1, 1, 'diamant-liegestuetz');
    expect(v2?.swaps).toEqual([{ index: 1, from: 'liegestuetz', to: 'diamant-liegestuetz' }]);
    // Zurück zur Original-Übung → keine Variante mehr.
    expect(withVariantSwap(w, v2, 1, 'liegestuetz')).toBeNull();
  });

  it('neue Fassung des Workouts: passt eine Position nicht mehr, entfällt nur dieser Tausch', () => {
    const both = withVariantSwap(
      w,
      withVariantSwap(w, null, 0, 'kniebeuge-koerpergewicht'),
      1,
      'liegestuetz-erhoeht',
    );
    const changed: Workout = {
      ...w,
      version: 2,
      exercises: [w.exercises[0]!, { ...w.exercises[1]!, exercise_id: 'diamant-liegestuetz' }],
    };
    const applied = applyWorkoutVariant(changed, both, EXERCISES);
    expect(applied.applied).toBe(1);
    expect(applied.skipped).toBe(1);
    expect(applied.workout.exercises.map((e) => e.exercise_id)).toEqual([
      'kniebeuge-koerpergewicht',
      'diamant-liegestuetz',
    ]);
  });

  it('ohne Variante bzw. bei Flow: unverändert', () => {
    expect(applyWorkoutVariant(w, null, EXERCISES).workout).toBe(w);
    const v = withVariantSwap(w, null, 0, 'kniebeuge-koerpergewicht');
    expect(applyWorkoutVariant({ ...w, format: 'flow' }, v, EXERCISES).applied).toBe(0);
  });

  it('Schema: je Position ein Tausch, jede Übung einmal, nie gegen sich selbst', () => {
    const ok = { version: 1, base_version: 1, swaps: [{ index: 0, from: 'a-b', to: 'c-d' }] };
    expect(workoutVariantSchema.safeParse(ok).success).toBe(true);
    expect(
      workoutVariantSchema.safeParse({
        ...ok,
        swaps: [...ok.swaps, { index: 0, from: 'a-b', to: 'e-f' }],
      }).success,
    ).toBe(false);
    expect(
      workoutVariantSchema.safeParse({ ...ok, swaps: [{ index: 0, from: 'a-b', to: 'a-b' }] })
        .success,
    ).toBe(false);
    expect(workoutVariantSchema.safeParse({ ...ok, swaps: [] }).success).toBe(false);
    expect(workoutVariantSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
});
