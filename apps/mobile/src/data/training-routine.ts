import {
  displayModesOn,
  type PlanLibrary,
  type PlanSafetyRules,
  type SessionRoutine,
  sessionRoutine,
  type StoredSession,
  type TrainingModesState,
} from '@fitnessapp/core';

import type { SessionDisplay } from './exercise-swap';

/**
 * Aufwärmen & Dehnen für eine ANGEZEIGTE Einheit (docs/PLAN-TRAINING-MODI.md 5) – nur Zusammensetzen: Bibliothek
 * (Testmodus auch Entwürfe, Supabase nur freigegebene), Regeln des Plans (Untergrenze), Geräte am Ort bzw. auf
 * Reisen und der Schon-Modus am Tag der Einheit. Die Auswahl selbst trifft sessionRoutine() in packages/core.
 */
export function routineFor(input: {
  shown: Pick<StoredSession, 'kind' | 'exercises' | 'scheduled_on'>;
  display: Pick<SessionDisplay, 'swapRules' | 'context'> | null;
  library: PlanLibrary | null;
  rules: PlanSafetyRules | null;
  modes: TrainingModesState | null;
}): SessionRoutine | null {
  const { shown, display, library, rules } = input;
  if (shown.kind !== 'strength' || !library || !rules) return null;
  const modes = displayModesOn(input.modes, shown.scheduled_on);
  const profile = modes.travel
    ? { available: modes.travel.available }
    : (display?.context.profile ?? null);
  return sessionRoutine(shown, {
    library: library.exercises,
    lookup: library.displayExercises ?? library.exercises,
    rules: display?.swapRules ?? rules,
    profile,
    pain: modes.pain ?? null,
  });
}
