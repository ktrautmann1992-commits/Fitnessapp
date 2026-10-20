import { storedAppLayoutSchema } from '@fitnessapp/core';

import type { AppLayoutRow } from './types';

/**
 * Anordnung aus der Datenbank (`app_layout_settings`, Etappe E2) – Zod an der Grenze; ungültig → null (= Standard).
 * Bekannte IDs und Regeln setzt erst `normalizeLayout` beim Anzeigen durch.
 */
export function appLayoutRowFromDb(row: unknown): AppLayoutRow | null {
  if (typeof row !== 'object' || row === null) return null;
  const value = row as Record<string, unknown>;
  const parsed = storedAppLayoutSchema.safeParse({
    dashboard_tiles: value.dashboard_tiles,
    tab_bar: value.tab_bar,
  });
  if (!parsed.success || typeof value.user_id !== 'string') return null;
  return { user_id: value.user_id, ...parsed.data };
}
