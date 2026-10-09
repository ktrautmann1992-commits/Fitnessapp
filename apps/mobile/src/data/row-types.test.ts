import type * as core from '@fitnessapp/core';
import { describe, expectTypeOf, it } from 'vitest';

import type {
  CardioLogRow,
  ExerciseLogRow,
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
});
