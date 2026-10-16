import type * as core from '@fitnessapp/core';
import type { Tables } from '@fitnessapp/db';
import { describe, expectTypeOf, it } from 'vitest';

import type {
  CardioLogRow,
  CompetitionRow,
  CustomMealItemRow,
  CustomMealRow,
  ExerciseLogRow,
  FoodLogEntryRow,
  FoodLogFavoriteRow,
  PlannedExerciseRow,
  PlannedSessionRow,
  SessionLogRow,
  SetLogRow,
  StartWeightRow,
} from './types';

/**
 * Etappe A0 (docs/PLAN-PHASE-4B.md 5.1): Die Zeilen-Abbildung liegt in packages/core mit eigenen Zeilen-Typen. Die
 * App leitet ihre Zeilen-Typen aus den generierten Datenbank-Typen ab. Beide müssen GLEICH bleiben – sonst
 * schlägt schon die Typprüfung (pnpm turbo typecheck) fehl, nicht erst ein Laufzeit-Test.
 */
describe('Zeilen-Typen: packages/core = Datenbank', () => {
  it('Tagebuch-Zeilen', () => {
    expectTypeOf<core.SessionLogRow>().toEqualTypeOf<SessionLogRow>();
    expectTypeOf<core.ExerciseLogRow>().toEqualTypeOf<ExerciseLogRow>();
    expectTypeOf<core.SetLogRow>().toEqualTypeOf<SetLogRow>();
    expectTypeOf<core.CardioLogRow>().toEqualTypeOf<CardioLogRow>();
    expectTypeOf<core.StartWeightRow>().toEqualTypeOf<StartWeightRow>();
  });

  it('Plan-Zeilen', () => {
    expectTypeOf<core.PlannedSessionRow>().toEqualTypeOf<PlannedSessionRow>();
    expectTypeOf<core.PlannedExerciseRow>().toEqualTypeOf<PlannedExerciseRow>();
  });

  it('Ernährungstagebuch (E1): gleiche Spalten wie die Datenbank, Werte-Listen enger', () => {
    expectTypeOf<keyof FoodLogEntryRow>().toEqualTypeOf<keyof Tables<'food_log_entries'>>();
    expectTypeOf<keyof FoodLogFavoriteRow>().toEqualTypeOf<keyof Tables<'food_log_favorites'>>();
    expectTypeOf<FoodLogEntryRow>().toExtend<Tables<'food_log_entries'>>();
    expectTypeOf<FoodLogFavoriteRow>().toExtend<Tables<'food_log_favorites'>>();
  });

  it('Wettkampf (Phase 10 WP3): core = Datenbank', () => {
    expectTypeOf<core.CompetitionRow>().toEqualTypeOf<CompetitionRow>();
  });

  it('Strecken (Phase 10 S1): gleiche Spalten wie die Datenbank, Werte-Listen enger', () => {
    expectTypeOf<keyof core.TrackedRouteRow>().toEqualTypeOf<keyof Tables<'tracked_routes'>>();
    expectTypeOf<core.TrackedRouteRow>().toExtend<Tables<'tracked_routes'>>();
  });

  it('Eigene Gerichte (E2): gleiche Spalten wie die Datenbank, Werte-Listen enger', () => {
    expectTypeOf<keyof CustomMealRow>().toEqualTypeOf<keyof Tables<'custom_meals'>>();
    expectTypeOf<keyof CustomMealItemRow>().toEqualTypeOf<keyof Tables<'custom_meal_items'>>();
    expectTypeOf<CustomMealRow>().toExtend<Tables<'custom_meals'>>();
    expectTypeOf<CustomMealItemRow>().toExtend<Tables<'custom_meal_items'>>();
  });
});
