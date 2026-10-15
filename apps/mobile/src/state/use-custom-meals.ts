import {
  type CustomMeal,
  entryFromCustomMeal,
  type FoodLogBuild,
  type FoodLogSlot,
  orderCustomMeals,
} from '@fitnessapp/core';
import { useCallback, useMemo } from 'react';

import { newId } from '@/data/create-backend';
import { customMealsFromRows } from '@/data/custom-meal-rows';

import { useApp } from './app-state';

/**
 * Eigene Gerichte (Etappe E2): Liste (zuletzt eingetragen zuerst, sonst alphabetisch – packages/core) und Aktionen
 * Speichern, Löschen, Eintragen. Rechnet nichts selbst: Werte und Einträge baut packages/core
 * (`buildCustomMeal`, `entryFromCustomMeal`).
 */
export function useCustomMeals(): CustomMeal[] {
  const rows = useApp().rows;
  return useMemo(
    () => (rows ? orderCustomMeals(customMealsFromRows(rows), rows.foodLogEntries) : []),
    [rows],
  );
}

export interface CustomMealActions {
  save: (meal: CustomMeal) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Tagebuch-Eintrag aus dem Gericht bauen (Schnappschuss) – speichert noch nicht. */
  entry: (meal: CustomMeal, portion: number, date: string, slot: FoodLogSlot) => FoodLogBuild;
}

export function useCustomMealActions(): CustomMealActions {
  const { saveCustomMeal, deleteCustomMeal } = useApp();
  const entry = useCallback<CustomMealActions['entry']>(
    (meal, portion, date, slot) => entryFromCustomMeal(meal, portion, { id: newId(), date, slot }),
    [],
  );
  return useMemo(
    () => ({ save: saveCustomMeal, remove: deleteCustomMeal, entry }),
    [deleteCustomMeal, entry, saveCustomMeal],
  );
}
