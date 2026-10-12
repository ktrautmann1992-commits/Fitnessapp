import { useEffect, useMemo } from 'react';

import {
  computeNutritionWeek,
  nutritionWeekStart,
  type NutritionWeekResult,
  showEnergyNumbers,
} from '@/data/nutrition-plan';
import { todayIso } from '@/lib/format';

import { type NutritionLibraryState, useApp } from './app-state';

export interface NutritionView {
  /** Laden des Bestands (Rezepte). */
  library: NutritionLibraryState;
  /** Ziele und Essensplan der Woche; null = noch nicht berechenbar (Laden/kein Konto). */
  week: NutritionWeekResult | null;
  showNumbers: boolean;
  /** Schritt `nutrition_setup` noch nicht beantwortet (bestehende Testerinnen, 8.1). */
  setupMissing: boolean;
}

/**
 * Ernährung der Woche, in der `date` liegt (Etappe N4): lädt den Bestand bei Bedarf und rechnet Ziele und Essensplan
 * bei jeder Änderung der Angaben neu (deterministisch, nichts gespeichert – passt so immer zum aktuellen Modus, 6.6).
 */
export function useNutritionWeek(date?: string): NutritionView {
  const app = useApp();
  const { ensureNutritionLibrary, nutritionLibrary, rows, versions, backend } = app;
  const today = todayIso();
  const weekStart = nutritionWeekStart(date ?? today);

  useEffect(() => {
    void ensureNutritionLibrary();
  }, [ensureNutritionLibrary]);

  const library = nutritionLibrary.kind === 'ready' ? nutritionLibrary.result.library : null;
  const week = useMemo(
    () =>
      rows && backend.supportsNutrition
        ? computeNutritionWeek({
            rows,
            versions,
            today,
            weekStart,
            library,
            allowDrafts: backend.mode === 'local',
          })
        : null,
    [backend, library, rows, today, versions, weekStart],
  );
  return {
    library: nutritionLibrary,
    week,
    showNumbers: showEnergyNumbers(rows),
    setupMissing: backend.supportsNutrition && rows !== null && rows.nutritionSetup === null,
  };
}
