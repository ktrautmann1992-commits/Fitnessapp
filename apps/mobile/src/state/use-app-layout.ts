import {
  type AppLayout,
  type NavArea,
  normalizeLayout,
  recoveryRoutineEnabled,
  storedStepGoal,
  toStoredLayout,
} from '@fitnessapp/core';
import { useCallback, useMemo } from 'react';

import { AVAILABLE_AREAS } from '@/lib/app-areas';

import { useApp } from './app-state';

export { AVAILABLE_AREAS };

/**
 * Anordnung der Übersicht und der Menüleiste (Etappe E2): immer die normalisierte Fassung aus packages/core
 * (`normalizeLayout`, Standard ohne gespeicherten Stand). `save` speichert sofort lokal (offline möglich).
 * Schrittziel (22.10.2026): wird mit der Anordnung gespeichert (`step_goal`); `save` behält ein gespeichertes Ziel,
 * `saveStepGoal` behält die Anordnung. Ohne eigenes Ziel gilt der Standard (packages/core `storedStepGoal`).
 */
export function useAppLayout(): {
  layout: AppLayout;
  available: readonly NavArea[];
  save: (layout: AppLayout) => Promise<void>;
  stepGoal: number;
  saveStepGoal: (goal: number) => Promise<void>;
  /** „Erholungs-Routine vorschlagen“ (Sportarten Stufe 1, Standard an). */
  recoveryRoutine: boolean;
  saveRecoveryRoutine: (enabled: boolean) => Promise<void>;
} {
  const app = useApp();
  const stored = app.rows?.appLayout ?? null;
  const layout = useMemo(
    () =>
      normalizeLayout(
        stored === null
          ? null
          : {
              dashboard_tiles: stored.dashboard_tiles,
              tab_bar: stored.tab_bar,
              // Fassung (26.10.2026): ohne → alter Standard wird umgestellt (normalizeLayout).
              layout_version: stored.layout_version ?? null,
            },
        AVAILABLE_AREAS,
      ),
    [stored],
  );
  const ownGoal = stored?.step_goal ?? null;
  const stepGoal = storedStepGoal(stored);
  const { saveAppLayout } = app;
  const save = useCallback(
    (next: AppLayout) => saveAppLayout(toStoredLayout(next, ownGoal)),
    [saveAppLayout, ownGoal],
  );
  const saveStepGoal = useCallback(
    (goal: number) => saveAppLayout(toStoredLayout(layout, goal)),
    [saveAppLayout, layout],
  );
  const recoveryRoutine = recoveryRoutineEnabled(stored);
  const saveRecoveryRoutine = useCallback(
    (enabled: boolean) => saveAppLayout(toStoredLayout(layout, ownGoal, enabled)),
    [saveAppLayout, layout, ownGoal],
  );
  return {
    layout,
    available: AVAILABLE_AREAS,
    save,
    stepGoal,
    saveStepGoal,
    recoveryRoutine,
    saveRecoveryRoutine,
  };
}
