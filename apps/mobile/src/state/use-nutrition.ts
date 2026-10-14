import {
  type MealSlotId,
  mealPlanWithOtherSuggestions,
  refreshedMealPlan,
  swapMealRecipe,
  weekHidesEnergyNumbers,
} from '@fitnessapp/core';
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
  /** Das automatische Speichern des Essensplans ist gescheitert (Etappe N5). */
  saveFailed: boolean;
}

/**
 * Ernährung der Woche, in der `date` liegt (Etappe N4/N5): lädt den Bestand bei Bedarf, rechnet die Ziele bei jeder
 * Änderung der Angaben neu und löst den gespeicherten Essensplan auf (`resolveMealPlanWeek`, 6.6). Ein neu erstellter
 * oder automatisch neu geplanter Plan der laufenden bzw. nächsten Woche wird danach gespeichert – angezeigt wird schon
 * vorher der richtige Plan. Läuft bei jedem Öffnen von „Heute“ und „Ernährung“.
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
  const { persistMealPlan, mealPlanSaveFailed } = app;
  const pending = useMemo(
    () =>
      week?.kind === 'ready' &&
      week.plan !== null &&
      week.planState !== null &&
      week.planState.editable &&
      week.planState.action !== 'stored'
        ? {
            plan: week.plan,
            autoAdjusted: week.planState.action === 'replanned',
            inputsKey: week.planState.inputsKey,
          }
        : null,
    [week],
  );
  useEffect(() => {
    if (pending !== null) {
      void persistMealPlan(pending.plan, {
        autoAdjusted: pending.autoAdjusted,
        inputsKey: pending.inputsKey,
      });
    }
  }, [pending, persistMealPlan]);

  return {
    saveFailed: mealPlanSaveFailed,
    library: nutritionLibrary,
    week,
    // Schwangerschaft/Stillzeit an einem Tag der Woche → nirgends Energie-Zahlen, auch nicht an vergangenen Tagen
    // eines gespeicherten Plans (B5, Wächter N4 K1).
    showNumbers:
      showEnergyNumbers(rows) && !(week?.kind === 'ready' && weekHidesEnergyNumbers(week.targets)),
    setupMissing: backend.supportsNutrition && rows !== null && rows.nutritionSetup === null,
  };
}

export type MealSwapOutcome =
  | { kind: 'swapped'; title: string }
  | { kind: 'failed'; reason: 'no_alternative' | 'past_day' | 'not_found' | 'replan_needed' };

export interface MealPlanActions {
  /** „Rezept tauschen“ (6.3 Nr. 7) – nur Hauptplätze, nie Ergänzungs-Snacks, nie vergangene Tage. */
  swap: (date: string, slot: MealSlotId) => Promise<MealSwapOutcome>;
  /** „Andere Vorschläge“ (Variante + 1 ab heute). */
  otherSuggestions: () => Promise<void>;
  /** „Plan aktualisieren“ (gleiche Variante, neue Ziele ab heute). */
  refresh: () => Promise<void>;
  /** Hinweis „angepasst“ ausblenden. */
  dismissAdjusted: () => Promise<void>;
}

/**
 * Änderungen am gespeicherten Essensplan (Etappe N5). Die Regeln stehen in packages/core (`swapMealRecipe`,
 * `mealPlanWithOtherSuggestions`, `refreshedMealPlan`); hier wird nur gespeichert. Null = Woche nicht änderbar bzw.
 * kein Plan.
 */
export function useMealPlanActions(week: NutritionWeekResult | null): MealPlanActions | null {
  const { saveMealPlan } = useApp();
  return useMemo(() => {
    if (week?.kind !== 'ready' || week.plan === null || week.planState === null) return null;
    if (!week.planState.editable) return null;
    const plan = week.plan;
    const input = week.planState.input;
    return {
      swap: async (date, slot) => {
        const result = swapMealRecipe(plan, { date, slot }, input);
        if (!result.ok) return { kind: 'failed', reason: result.reason };
        await saveMealPlan(result.plan, { autoAdjusted: false });
        const meal = result.plan.days
          .find((d) => d.date === date)
          ?.meals.find((m) => m.slot === slot && !m.isFill);
        return { kind: 'swapped', title: meal?.titleDe ?? '' };
      },
      otherSuggestions: () =>
        saveMealPlan(mealPlanWithOtherSuggestions(plan, input), { autoAdjusted: false }),
      refresh: () => saveMealPlan(refreshedMealPlan(plan, input), { autoAdjusted: false }),
      dismissAdjusted: () => saveMealPlan(plan, { autoAdjusted: false }),
    };
  }, [saveMealPlan, week]);
}
