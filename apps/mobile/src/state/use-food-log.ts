import {
  type DayIntakeView,
  dayIntakeView,
  favoriteFromEntry,
  foodLogDateStatus,
  type FoodLogDateStatus,
  foodLogDay,
  type FoodLogEntry,
  isFavoriteEntry,
  markPlanItemEaten,
  type PlannedMeal,
} from '@fitnessapp/core';
import { useCallback, useMemo } from 'react';

import { newId } from '@/data/create-backend';
import { entryFromRow } from '@/data/food-log-rows';
import type { FoodLogEntryRow, FoodLogFavoriteRow } from '@/data/types';
import { useToday } from '@/lib/use-today';

import { useApp } from './app-state';
import { healthConsentStatus } from './flow';

/**
 * Ernährungstagebuch eines Tages (Etappe E1): Einträge, Summen (aus packages/core), Zustand des Datums und die
 * Aktionen „Gegessen“, Löschen und Stern. Rechnet nichts selbst.
 */
export interface FoodLogDayView {
  /** Ernährungstagebuch in dieser Betriebsart verfügbar (Testmodus; Supabase ab N7 Teil 2). */
  supported: boolean;
  /** Gültige Einwilligung health_data (A-G12) – sonst kein Eintragen. */
  consentValid: boolean;
  dateStatus: FoodLogDateStatus;
  entries: FoodLogEntryRow[];
  favorites: FoodLogFavoriteRow[];
  intake: DayIntakeView;
  /** Eintrag der Plan-Mahlzeit an diesem Tag und Platz (sonst null). */
  planItem: (slot: string) => FoodLogEntryRow | null;
  isFavorite: (entry: FoodLogEntry) => boolean;
}

export function useFoodLogDay(date: string, showNumbers: boolean): FoodLogDayView {
  const app = useApp();
  const today = useToday();
  const rows = app.rows;
  return useMemo(() => {
    const all = rows?.foodLogEntries ?? [];
    const entries = foodLogDay(all, date);
    const favorites = rows?.foodLogFavorites ?? [];
    return {
      supported: app.backend.supportsNutrition,
      consentValid: rows !== null && healthConsentStatus(rows, app.versions) === 'valid',
      dateStatus: foodLogDateStatus(date, today),
      entries,
      favorites,
      intake: dayIntakeView(entries, showNumbers),
      planItem: (slot) => entries.find((e) => e.source === 'plan_item' && e.slot === slot) ?? null,
      isFavorite: (entry) => isFavoriteEntry(favorites, entry),
    };
  }, [app.backend.supportsNutrition, app.versions, date, rows, showNumbers, today]);
}

export interface FoodLogActions {
  /** „Gegessen“ bzw. andere Portion für eine Plan-Mahlzeit (idempotent). */
  markEaten: (
    meal: Pick<PlannedMeal, 'slot' | 'recipeId' | 'titleDe' | 'nutrients'>,
    date: string,
    portion: number,
  ) => Promise<'saved' | 'unchanged' | 'invalid'>;
  save: (entries: readonly FoodLogEntry[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Stern umschalten (Plan-Mahlzeiten haben keinen). */
  toggleFavorite: (entry: FoodLogEntry) => Promise<void>;
}

export function useFoodLogActions(): FoodLogActions {
  const { rows, saveFoodLogEntries, deleteFoodLogEntry, changeFoodLogFavorite } = useApp();
  const markEaten = useCallback<FoodLogActions['markEaten']>(
    async (meal, date, portion) => {
      const entries = (rows?.foodLogEntries ?? []).map(entryFromRow);
      const mark = markPlanItemEaten(entries, meal, date, portion, newId);
      if (mark.kind === 'failed') return 'invalid';
      if (mark.kind === 'unchanged') return 'unchanged';
      await saveFoodLogEntries([mark.entry]);
      return 'saved';
    },
    [rows, saveFoodLogEntries],
  );
  const toggleFavorite = useCallback(
    async (entry: FoodLogEntry) => {
      const favorites = rows?.foodLogFavorites ?? [];
      if (isFavoriteEntry(favorites, entry)) {
        const favorite = favoriteFromEntry(entry);
        if (favorite) await changeFoodLogFavorite({ op: 'remove', favKey: favorite.fav_key });
        return;
      }
      const favorite = favoriteFromEntry(entry);
      if (favorite) await changeFoodLogFavorite({ op: 'set', favorite });
    },
    [changeFoodLogFavorite, rows],
  );
  return useMemo(
    () => ({ markEaten, save: saveFoodLogEntries, remove: deleteFoodLogEntry, toggleFavorite }),
    [deleteFoodLogEntry, markEaten, saveFoodLogEntries, toggleFavorite],
  );
}
