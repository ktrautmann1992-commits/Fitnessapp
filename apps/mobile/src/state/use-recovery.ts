import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

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
 * (data/recovery.ts → packages/core). Der Status ist gratis; das Angebot „Leichter trainieren“ folgt der Live-Anpassung
 * (KONZEPT 4.1, Premium): im Testmodus der Schalter „Live-Anpassung einschalten“, im Supabase-Modus die Prüfung auf dem
 * Server (`live_adjustment_status`).
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

/** Ergebnis der Server-Prüfung je Konto (einmal je App-Sitzung; Fehler/offline = nicht aktiv). */
let serverStatus: { userId: string; active: boolean } | null = null;

/** Darf die Erholung „Leichter trainieren“ anbieten (Live-Anpassung aktiv)? */
export function useRecoveryOfferAllowed(): boolean {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const local = app.backend.mode === 'local';
  const [active, setActive] = useState<boolean>(() =>
    serverStatus !== null && serverStatus.userId === userId ? serverStatus.active : false,
  );
  useEffect(() => {
    if (local || !userId) return;
    if (serverStatus?.userId === userId) {
      setActive(serverStatus.active);
      return;
    }
    let alive = true;
    void app.backend
      .liveAdjustmentActive()
      .catch(() => false)
      .then((value) => {
        serverStatus = { userId, active: value };
        if (alive) setActive(value);
      });
    return () => {
      alive = false;
    };
  }, [app.backend, local, userId]);
  if (local) return app.liveAdjust.available && app.liveAdjust.simulatePremium;
  return active;
}

/** Wahl „Leichter trainieren“/„Wie geplant“ für diese Einheit heute (nur Arbeitsspeicher). */
export function useRecoveryChoice(today: string, sessionId: string | null): RecoveryChoice | null {
  const app = useApp();
  useSyncExternalStore(subscribeRecoveryChoice, recoveryChoiceSnapshot, recoveryChoiceSnapshot);
  return recoveryChoiceFor(app.session?.userId ?? null, today, sessionId);
}
