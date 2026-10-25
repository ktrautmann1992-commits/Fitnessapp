import {
  type EnduranceActivity,
  type EnduranceLogInput,
  type ShoeData,
  type ShoeMileage,
  shoeHistoryStart,
  shoeMileage,
} from '@fitnessapp/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { shoeActivities } from '@/data/shoe-rows';
import { type ShoeLoadResult, shoeBackendFor } from '@/data/shoes';
import { berlinTodayIso } from '@/lib/format';
import { useApp } from '@/state/app-state';
import { useTrackedRoutes } from '@/state/use-tracked-routes';

/**
 * Schuhe des angemeldeten Kontos (docs/PLAN-PHASE-10.md 22): Stand laden (Supabase bzw. Testmodus, offline aus dem
 * Gerätespeicher), Kilometer je Schuh aus allen Läufen (Strecken + Einträge + ältere Einträge) und Speichern. Der
 * zuletzt geladene Stand bleibt im Arbeitsspeicher; nach dem Speichern laden alle offenen Ansichten neu.
 */
export type ShoesState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'error' }
  | { kind: 'ready'; result: ShoeLoadResult };

let memory: { userId: string; result: ShoeLoadResult } | null = null;
const listeners = new Set<() => void>();

export interface UseShoes {
  readonly state: ShoesState;
  readonly data: ShoeData | null;
  /** Alle Aktivitäten (ohne Doppelzählung) inkl. älterer Einträge. */
  readonly activities: readonly EnduranceActivity[];
  readonly mileage: readonly ShoeMileage[];
  readonly reload: () => Promise<void>;
  /** Speichern: `saved` bzw. `queued` (offline). Wirft bei Ablehnung. */
  readonly save: (data: ShoeData) => Promise<'saved' | 'queued'>;
  readonly deleteAll: () => Promise<void>;
}

export function useShoes(): UseShoes {
  const app = useApp();
  const userId = app.session?.userId ?? null;
  const shoes = shoeBackendFor(app.backend);
  const { state: routeState } = useTrackedRoutes();
  const [state, setState] = useState<ShoesState>(() =>
    shoes === null
      ? { kind: 'unavailable' }
      : memory && memory.userId === userId
        ? { kind: 'ready', result: memory.result }
        : { kind: 'loading' },
  );

  const reload = useCallback(async () => {
    if (!userId || !shoes) return;
    try {
      // Ältere Einträge nur, wenn es Schuhe gibt (ab dem ersten Schuh-Tag; bekannt aus dem letzten Stand).
      const known =
        memory && memory.userId === userId ? shoeHistoryStart(memory.result.data) : null;
      const first = await shoes.load(known);
      const from = shoeHistoryStart(first.data);
      const result =
        from === null || first.offline || from === known ? first : await shoes.load(from);
      memory = { userId, result };
      setState({ kind: 'ready', result });
    } catch {
      setState((current) => (current.kind === 'ready' ? current : { kind: 'error' }));
    }
  }, [shoes, userId]);

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

  const routes = routeState.kind === 'ready' ? routeState.result : null;
  const result = state.kind === 'ready' ? state.result : null;
  const olderLogs: readonly EnduranceLogInput[] = result?.olderLogs ?? NO_LOGS;
  const activities = useMemo(
    () => shoeActivities(app.rows, routes?.routes ?? [], routes?.pending ?? [], olderLogs),
    [app.rows, routes, olderLogs],
  );
  const data = result?.data ?? null;
  const mileage = useMemo(
    () => (data ? shoeMileage(data, activities, berlinTodayIso()) : []),
    [data, activities],
  );

  const save = useCallback(
    async (next: ShoeData) => {
      if (!shoes || !userId) throw new Error('shoes_unavailable');
      const outcome = await shoes.save(next);
      const updated: ShoeLoadResult = {
        data: next,
        olderLogs: memory?.result.olderLogs ?? [],
        offline: outcome === 'queued',
        pending: outcome === 'queued',
      };
      memory = { userId, result: updated };
      setState({ kind: 'ready', result: updated });
      for (const listener of listeners) if (outcome === 'saved') listener();
      return outcome;
    },
    [shoes, userId],
  );

  const deleteAll = useCallback(async () => {
    if (!shoes) return;
    await shoes.deleteAll();
    memory = null;
    for (const listener of listeners) listener();
  }, [shoes]);

  return { state, data, activities, mileage, reload, save, deleteAll };
}

const NO_LOGS: readonly EnduranceLogInput[] = [];
