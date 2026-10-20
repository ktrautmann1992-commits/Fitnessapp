import { type AppLayout, type NavArea, normalizeLayout, toStoredLayout } from '@fitnessapp/core';
import { useCallback, useMemo } from 'react';

import { AVAILABLE_AREAS } from '@/lib/app-areas';

import { useApp } from './app-state';

export { AVAILABLE_AREAS };

/**
 * Anordnung der Übersicht und der Menüleiste (Etappe E2): immer die normalisierte Fassung aus packages/core
 * (`normalizeLayout`, Standard ohne gespeicherten Stand). `save` speichert sofort lokal (offline möglich).
 */
export function useAppLayout(): {
  layout: AppLayout;
  available: readonly NavArea[];
  save: (layout: AppLayout) => Promise<void>;
} {
  const app = useApp();
  const stored = app.rows?.appLayout ?? null;
  const layout = useMemo(
    () =>
      normalizeLayout(
        stored === null
          ? null
          : { dashboard_tiles: stored.dashboard_tiles, tab_bar: stored.tab_bar },
        AVAILABLE_AREAS,
      ),
    [stored],
  );
  const { saveAppLayout } = app;
  const save = useCallback(
    (next: AppLayout) => saveAppLayout(toStoredLayout(next)),
    [saveAppLayout],
  );
  return { layout, available: AVAILABLE_AREAS, save };
}
