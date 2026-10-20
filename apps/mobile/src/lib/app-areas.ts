import type { NavArea } from '@fitnessapp/core';

/**
 * Bereiche, die es in DIESER App-Fassung als Reiter gibt (Bildschirme in `src/app/(tabs)/`, Reihenfolge wie
 * `NAV_AREAS`). „Workouts“ (`/workouts`) baut ein anderer Arbeitszweig – beim Zusammenführen hier und in
 * `(tabs)/_layout.tsx` ergänzen; bis dahin fehlt der Bereich in Standard, Menüleiste und „Mehr“ (`normalizeLayout`).
 */
export const AVAILABLE_AREAS: readonly NavArea[] = [
  'uebersicht',
  'today',
  'ernaehrung',
  'einkaufsliste',
  'fortschritt',
  'mehr',
];
