import type { CustomWorkoutDefinition, WorkoutVariant } from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type MyWorkoutsData,
  MyWorkoutsError,
  type MyWorkoutsLoad,
  type MyWorkoutsSaveResult,
  myWorkoutsBackendFor,
} from '@/data/my-workouts';
import { dislikedExerciseIds } from '@/data/my-workouts-view';
import { useApp } from '@/state/app-state';

/**
 * Eigene Workouts, Varianten und „Mag ich nicht“ des angemeldeten Kontos (docs/PLAN-EIGENE-WORKOUTS.md 4): laden
 * (offline der zuletzt geladene Stand plus wartende Änderungen), speichern, löschen. Der Stand bleibt im
 * Arbeitsspeicher; nach jeder Änderung laden alle offenen Ansichten neu.
 */
export type MyWorkoutsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly load: MyWorkoutsLoad };

let memory: { userId: string; load: MyWorkoutsLoad } | null = null;
const listeners = new Set<() => void>();

export interface UseMyWorkouts {
  readonly state: MyWorkoutsState;
  /** Geladener Stand (null = noch nicht da). */
  readonly data: MyWorkoutsData | null;
  /** „Mag ich nicht“ aus eigener Liste und Übungs-Präferenzen. */
  readonly dislikes: ReadonlySet<string>;
  readonly reload: () => Promise<void>;
  readonly saveCustom: (change: {
    id: string;
    name: string;
    definition: CustomWorkoutDefinition;
  }) => Promise<MyWorkoutsSaveResult>;
  readonly deleteCustom: (id: string) => Promise<MyWorkoutsSaveResult>;
  readonly saveVariant: (
    workoutId: string,
    variant: WorkoutVariant | null,
  ) => Promise<MyWorkoutsSaveResult>;
  readonly setDislikes: (
    ids: readonly string[],
    disliked: boolean,
  ) => Promise<MyWorkoutsSaveResult>;
}

export function useMyWorkouts(): UseMyWorkouts {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const mine = myWorkoutsBackendFor(app.backend);
  const [state, setState] = useState<MyWorkoutsState>(() =>
    mine === null
      ? { kind: 'unsupported' }
      : memory && memory.userId === userId
        ? { kind: 'ready', load: memory.load }
        : { kind: 'loading' },
  );

  const reload = useCallback(async () => {
    if (!userId || !mine) return;
    try {
      const load = await mine.load();
      memory = { userId, load };
      setState({ kind: 'ready', load });
    } catch {
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [mine, userId]);

  useEffect(() => {
    const listener = () => void reload();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [reload]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const after = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    const result = await work();
    for (const listener of listeners) listener();
    return result;
  }, []);
  const need = useCallback(() => {
    if (!mine) throw new MyWorkoutsError('unknown');
    return mine;
  }, [mine]);

  const data = state.kind === 'ready' ? state.load.data : null;
  const exercisePreferences = app.rows?.exercisePreferences ?? null;
  const dislikes = useMemo(
    () => dislikedExerciseIds(data, exercisePreferences ? { exercisePreferences } : null),
    [data, exercisePreferences],
  );

  return {
    state,
    data,
    dislikes,
    reload,
    saveCustom: (change) => after(() => need().saveCustom(change)),
    deleteCustom: (id) => after(() => need().deleteCustom(id)),
    saveVariant: (workoutId, variant) => after(() => need().saveVariant(workoutId, variant)),
    setDislikes: (ids, disliked) => after(() => need().setDislikes(ids, disliked)),
  };
}
