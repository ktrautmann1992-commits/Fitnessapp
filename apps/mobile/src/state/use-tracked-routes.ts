import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import type { TrackedRoutesResult } from '@/data/backend';
import { applyAutoMatches } from '@/data/route-match';
import { useApp } from '@/state/app-state';

/**
 * Strecken des angemeldeten Kontos (Etappe E4): geladen über das Backend (Supabase bzw. Testmodus). Der zuletzt
 * geladene Stand bleibt im Arbeitsspeicher (kein Flackern beim Wechsel zwischen Liste und Auswertung); jede Seite lädt
 * neu, sobald sie wieder sichtbar wird, und nach Speichern/Löschen (forgetTrackedRoutes) auch die schon offenen.
 */
export type TrackedRoutesState =
  { kind: 'loading' } | { kind: 'ready'; result: TrackedRoutesResult } | { kind: 'error' };

let memory: { userId: string; result: TrackedRoutesResult } | null = null;
const listeners = new Set<() => void>();

export function useTrackedRoutes(): { state: TrackedRoutesState; reload: () => Promise<void> } {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const backend = app.backend;
  const [state, setState] = useState<TrackedRoutesState>(() =>
    memory && memory.userId === userId
      ? { kind: 'ready', result: memory.result }
      : { kind: 'loading' },
  );
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      let result = await backend.loadTrackedRoutes();
      // „Meine Strecken“: neue Läufe (App, Uhr) gleich auf dem Gerät erkennen – vorläufig zugeordnet (auto).
      if (!result.offline && (await applyAutoMatches(backend, userId, result.routes)) > 0) {
        result = await backend.loadTrackedRoutes();
      }
      memory = { userId, result };
      setState({ kind: 'ready', result });
    } catch {
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [backend, userId]);
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
  return { state, reload };
}

/** Nach Speichern/Löschen: Zwischenstand verwerfen und alle offenen Ansichten neu laden. */
export function forgetTrackedRoutes(): void {
  memory = null;
  for (const listener of listeners) listener();
}
