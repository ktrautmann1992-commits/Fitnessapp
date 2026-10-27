import { useMemo, useSyncExternalStore } from 'react';

import {
  type RecoveryChoice,
  recoveryChoiceFor,
  recoveryChoiceSnapshot,
  subscribeRecoveryChoice,
} from '@/data/recovery-choice';
import { recoveryOptionsFromRows, recoveryState, type RecoveryState } from '@/data/recovery';
import { useApp } from '@/state/app-state';
import { useWearables, wearableConsentsValid, wearableDriver } from '@/state/use-wearables';

/**
 * „Erholung aus der Uhr“ (25.10.2026): Zustand für Übersicht, „Heute“ und Smartwatch-Seite. Rechnet nichts selbst
 * (data/recovery.ts → packages/core). Status und Angebot „Leichter trainieren“ sind gratis (Gründer-Entscheidung
 * 26.10.2026, keine Premium-Prüfung; die Live-Anpassung KONZEPT 4.1 bleibt Premium).
 */
export function useRecovery(today: string): RecoveryState {
  const app = useApp();
  const { state } = useWearables();
  const rows = app.rows;
  return useMemo(() => {
    if (!rows) return { kind: 'loading' } as const;
    const result = state.kind === 'ready' ? state.result.rows : null;
    return recoveryState({
      loading: state.kind === 'loading',
      connection: result?.connection ?? null,
      dailyMetrics: result?.dailyMetrics ?? [],
      unsupported: wearableDriver(app.backend.mode).kind === 'none',
      consentsValid: wearableConsentsValid(app),
      options: recoveryOptionsFromRows(rows, app.versions, today),
      today,
    });
  }, [app, state, rows, today]);
}

/** Wahl „Leichter trainieren“/„Wie geplant“ für diese Einheit heute (nur Arbeitsspeicher). */
export function useRecoveryChoice(today: string, sessionId: string | null): RecoveryChoice | null {
  const app = useApp();
  useSyncExternalStore(subscribeRecoveryChoice, recoveryChoiceSnapshot, recoveryChoiceSnapshot);
  return recoveryChoiceFor(app.session?.userId ?? null, today, sessionId);
}
