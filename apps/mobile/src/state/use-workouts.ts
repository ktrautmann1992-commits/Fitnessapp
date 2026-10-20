import type { Workout } from '@fitnessapp/core';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import type { Backend } from '@/data/backend';
import { activeRunStore, type ActiveWorkoutRun } from '@/data/workout-run';

import { useApp } from './app-state';

/**
 * Workout-Bibliothek für die Bildschirme (docs/PLAN-WORKOUTS.md): einmal je Backend laden (nur Inhalte, keine
 * Nutzerdaten), Lade-/Fehlerzustand, erneut versuchen. Eigene Datei statt app-state.tsx – die Bibliothek braucht
 * keinen gemeinsamen Zustand mit dem Rest der App.
 */
export type WorkoutLibraryState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'ready'; readonly workouts: readonly Workout[]; readonly cached: boolean };

const cache = new WeakMap<Backend, Promise<{ workouts: readonly Workout[]; cached: boolean }>>();

export function useWorkoutLibrary(): WorkoutLibraryState & { retry: () => void } {
  const { backend } = useApp();
  const [state, setState] = useState<WorkoutLibraryState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    let pending = cache.get(backend);
    if (!pending) {
      pending = backend.loadWorkoutLibrary();
      cache.set(backend, pending);
    }
    pending.then(
      (result) => {
        if (alive) setState({ kind: 'ready', workouts: result.workouts, cached: result.cached });
      },
      () => {
        // Fehlgeschlagen: beim nächsten Versuch neu laden.
        cache.delete(backend);
        if (alive) setState({ kind: 'error' });
      },
    );
    return () => {
      alive = false;
    };
  }, [backend, attempt]);
  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, retry };
}

/** Das laufende Workout dieser App-Sitzung (nur Arbeitsspeicher). */
export function useActiveWorkoutRun(): ActiveWorkoutRun | null {
  return useSyncExternalStore(activeRunStore.subscribe, activeRunStore.get, activeRunStore.get);
}
