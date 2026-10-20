import type { NavArea } from '@fitnessapp/core';

/**
 * Bereiche, die es in DIESER App-Fassung als Reiter gibt (Bildschirme in `src/app/(tabs)/`, Reihenfolge wie
 * `NAV_AREAS`). Ein neuer Bereich kommt hier und in `(tabs)/_layout.tsx` dazu; fehlt er hier, fehlt er auch in
 * Standard, Menüleiste und „Mehr“ (`normalizeLayout`).
 */
export const AVAILABLE_AREAS: readonly NavArea[] = [
  'uebersicht',
  'today',
  'workouts',
  'ernaehrung',
  'einkaufsliste',
  'fortschritt',
  'mehr',
];
