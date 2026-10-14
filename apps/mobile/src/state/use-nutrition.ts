import {
  addManualShoppingItem,
  addRecipeToShoppingList,
  applyIngredientSwap,
  applyMealPrepPlan,
  type DietType,
  type IngredientSwapFailure,
  type MealPlanWeek,
  type MealPrepPlan,
  type MealSlotId,
  mealPlanWithOtherSuggestions,
  refreshedMealPlan,
  removeManualShoppingItem,
  removeRecipeFromShoppingList,
  resolveShoppingList,
  setShoppingItemChecked,
  type ShoppingCategory,
  type StoredShoppingList,
  swapMealRecipe,
  weekHidesEnergyNumbers,
  withShoppingListRange,
} from '@fitnessapp/core';
import { useEffect, useMemo } from 'react';

import {
  computeNutritionWeek,
  nutritionWeekStart,
  type NutritionWeekResult,
  showEnergyNumbers,
} from '@/data/nutrition-plan';
import { useToday } from '@/lib/use-today';

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
  /** „Erneut versuchen“ (Wächter N5a K7). */
  retrySave: () => void;
  /** Heute (Gerätezeit; wechselt um Mitternacht, Wächter N5a K5). */
  today: string;
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
  const today = useToday();
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
  const { persistMealPlan, mealPlanSaveFailed, retryMealPlanSave, mealPlanSaveAttempt } = app;
  const pending = useMemo(() => {
    if (week?.kind !== 'ready' || week.plan === null || week.planState === null) return null;
    if (!week.planState.editable) return null;
    // Einkaufsliste an einen geänderten Plan angepasst (W22) – mit dem Plan im selben Schritt speichern.
    const shoppingList = week.shopping?.action === 'rebuilt' ? week.shopping.list : undefined;
    const planPending = week.planState.action !== 'stored';
    if (!planPending && shoppingList === undefined) return null;
    return {
      plan: planPending ? week.plan : null,
      autoAdjusted: week.planState.action === 'replanned',
      recipesChanged: week.planState.action === 'rebuilt',
      inputsKey: week.planState.inputsKey,
      shoppingList,
    };
  }, [week]);
  useEffect(() => {
    if (pending !== null) {
      void persistMealPlan(pending.plan, {
        autoAdjusted: pending.autoAdjusted,
        recipesChanged: pending.recipesChanged,
        inputsKey: pending.inputsKey,
        shoppingList: pending.shoppingList,
      });
    }
    // `mealPlanSaveAttempt`: „Erneut versuchen“ startet das Speichern neu (K7).
  }, [pending, persistMealPlan, mealPlanSaveAttempt]);

  return {
    saveFailed: mealPlanSaveFailed,
    retrySave: retryMealPlanSave,
    today,
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

export type IngredientSwapOutcome =
  | { kind: 'swapped' }
  | { kind: 'failed'; reason: IngredientSwapFailure | 'consent_required' }
  | { kind: 'save_failed' };

export interface MealPlanActions {
  /** „Rezept tauschen“ (6.3 Nr. 7) – nur Hauptplätze, nie Ergänzungs-Snacks, nie vergangene Tage. */
  swap: (date: string, slot: MealSlotId) => Promise<MealSwapOutcome>;
  /** „Andere Vorschläge“ (Variante + 1 ab heute). */
  otherSuggestions: () => Promise<void>;
  /** „Plan aktualisieren“ (gleiche Variante, neue Ziele ab heute). */
  refresh: () => Promise<void>;
  /** Hinweise „angepasst“ bzw. „neu erstellt“ ausblenden. */
  dismissAdjusted: () => Promise<void>;
  /** Meal-Prep-Wochenplan für diese Woche wählen (19.6) – ersetzt den Plan ab dem Kochtag. */
  chooseMealPrepPlan: (mealPrepPlan: MealPrepPlan) => Promise<'chosen' | 'not_offered'>;
  /**
   * Zutat austauschen (KONZEPT 6.9, Etappe N9): `substituteFoodId` aus der Austausch-Tabelle, `null` = Original. Die
   * Regeln (Filter, R11, Planband, Haltbarkeit) stehen in packages/core (`applyIngredientSwap`); Plan und
   * Einkaufsliste werden im selben Schritt gespeichert (W22).
   */
  swapIngredient: (
    target: { date: string; slot: MealSlotId; index: number },
    substituteFoodId: string | null,
  ) => Promise<IngredientSwapOutcome>;
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
    // Gespeicherte Einkaufsliste der Woche wird bei jeder Plan-Änderung im selben Schritt neu erzeugt (Häkchen über
    // item_key, R2-S4). Ohne gespeicherte Liste gibt es nichts anzupassen.
    const storedList = week.shopping?.action === 'new' ? null : (week.shopping?.list ?? null);
    const save = (next: MealPlanWeek) =>
      saveMealPlan(next, {
        autoAdjusted: false,
        shoppingList:
          storedList === null ? undefined : resolveShoppingList(storedList, next, input).list,
      });
    return {
      swap: async (date, slot) => {
        const result = swapMealRecipe(plan, { date, slot }, input);
        if (!result.ok) return { kind: 'failed', reason: result.reason };
        await save(result.plan);
        const meal = result.plan.days
          .find((d) => d.date === date)
          ?.meals.find((m) => m.slot === slot && !m.isFill);
        return { kind: 'swapped', title: meal?.titleDe ?? '' };
      },
      otherSuggestions: () => save(mealPlanWithOtherSuggestions(plan, input)),
      refresh: () => save(refreshedMealPlan(plan, input)),
      dismissAdjusted: () => saveMealPlan(plan, { autoAdjusted: false, recipesChanged: false }),
      chooseMealPrepPlan: async (mealPrepPlan) => {
        const offer = applyMealPrepPlan(mealPrepPlan, {
          ...input,
          existingPlan: plan,
          variant: plan.variant,
        });
        if (!offer.offered) return 'not_offered';
        await save(offer.plan);
        return 'chosen';
      },
      swapIngredient: async (target, substituteFoodId) => {
        if (!week.planState?.ingredientSwapAllowed) {
          return { kind: 'failed', reason: 'consent_required' };
        }
        const result = applyIngredientSwap(plan, target, substituteFoodId, input, {
          cookStartedOn: week.planState.cookStartedOn,
        });
        if (!result.ok) return { kind: 'failed', reason: result.reason };
        try {
          await save(result.plan);
        } catch {
          return { kind: 'save_failed' };
        }
        return { kind: 'swapped' };
      },
    };
  }, [saveMealPlan, week]);
}

export type ShoppingActionOutcome =
  | { kind: 'ok' }
  | { kind: 'invalid'; message: string }
  | { kind: 'failed'; reason: 'not_found' | 'not_for_you' | 'too_many' | 'save_failed' };

export interface ShoppingListActions {
  list: StoredShoppingList;
  /** Abhaken (geht ohne Netz – Testmodus: Gerätespeicher). */
  toggle: (itemKey: string, checked: boolean) => Promise<ShoppingActionOutcome>;
  addManual: (labelDe: string, category: ShoppingCategory) => Promise<ShoppingActionOutcome>;
  removeManual: (itemKey: string) => Promise<ShoppingActionOutcome>;
  setRange: (from: string, to: string) => Promise<ShoppingActionOutcome>;
  /**
   * „Zur Einkaufsliste“ aus der Rezeptansicht (19.6). `diet`: erweiterte Ernährungsform eines Suchtreffers (K3/G4,
   * Etappe N5c) – die Einträge sind dann gekennzeichnet.
   */
  addRecipe: (
    recipeId: string,
    servings: number,
    diet?: DietType | null,
  ) => Promise<ShoppingActionOutcome>;
  removeRecipe: (recipeId: string) => Promise<ShoppingActionOutcome>;
  /** Liste speichern, wie sie ist (z. B. „Zur Einkaufsliste“ aus dem Meal-Prep-Plan legt sie an). */
  ensureSaved: () => Promise<ShoppingActionOutcome>;
}

/**
 * Änderungen an der Einkaufsliste der Woche (Etappe N5b). Regeln aus packages/core (shopping-list.ts,
 * shopping-list-store.ts); hier wird nur gespeichert. Ausgangspunkt ist immer die aufgelöste Liste (passt zum
 * aktuellen Plan). Null = kein Plan bzw. Woche nicht änderbar.
 */
export function useShoppingListActions(
  week: NutritionWeekResult | null,
): ShoppingListActions | null {
  const { saveShoppingList } = useApp();
  return useMemo(() => {
    if (week?.kind !== 'ready' || week.plan === null || week.planState === null) return null;
    if (!week.planState.editable || week.shopping === null) return null;
    const plan = week.plan;
    const input = week.planState.input;
    const list = week.shopping.list;
    const store = async (next: StoredShoppingList): Promise<ShoppingActionOutcome> => {
      try {
        await saveShoppingList(next);
        return { kind: 'ok' };
      } catch {
        return { kind: 'failed', reason: 'save_failed' };
      }
    };
    const guarded = async (change: () => StoredShoppingList): Promise<ShoppingActionOutcome> => {
      let next: StoredShoppingList;
      try {
        next = change();
      } catch (error) {
        return { kind: 'invalid', message: validationMessage(error) };
      }
      return store(next);
    };
    return {
      list,
      toggle: (itemKey, checked) => guarded(() => setShoppingItemChecked(list, itemKey, checked)),
      addManual: (labelDe, category) =>
        guarded(() => addManualShoppingItem(list, { labelDe, category })),
      removeManual: (itemKey) => guarded(() => removeManualShoppingItem(list, itemKey)),
      setRange: (from, to) => guarded(() => withShoppingListRange(list, { from, to }, plan, input)),
      addRecipe: async (recipeId, servings, diet) => {
        const result = addRecipeToShoppingList(
          list,
          { recipeId, servings, ...(diet ? { diet } : {}) },
          plan,
          input,
        );
        if (!result.ok) return { kind: 'failed', reason: result.reason };
        return store(result.list);
      },
      removeRecipe: (recipeId) =>
        guarded(() => removeRecipeFromShoppingList(list, recipeId, plan, input)),
      ensureSaved: () => store(list),
    };
  }, [saveShoppingList, week]);
}

/** Erste Meldung eines Zod- bzw. Bereichsfehlers aus packages/core (deutsche Texte), sonst allgemein. */
function validationMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: readonly { message?: unknown }[] }).issues;
    const first = issues[0]?.message;
    if (typeof first === 'string' && first.length > 0) return first;
  }
  if (error instanceof RangeError && error.message.length > 0) return error.message;
  return '';
}
