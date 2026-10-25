import {
  displayModesOn,
  planRunStrength,
  type PlanLibrary,
  type PlanSafetyRules,
  type RunStrengthAssignment,
  type RunStrengthSessionInput,
  type RunStrengthUnit,
  runStrengthOn,
  runStrengthUnit,
  type TrainingModesState,
  type Workout,
} from '@fitnessapp/core';

/**
 * Lauf-Kraft & Lauf-ABC an einem Lauftag (docs/PLAN-CALISTHENICS-SCHLINGE.md 4) – nur Zusammensetzen: Zuordnung der
 * Woche (planRunStrength), Einheit aus der Workout-Bibliothek (Testmodus auch Entwürfe, Supabase nur freigegebene),
 * Regeln des Plans, Reise-Geräte und Schon-Modus am Tag. Die Regeln selbst stehen in packages/core.
 */
export interface RunStrengthForDay {
  readonly assignment: RunStrengthAssignment;
  readonly unit: RunStrengthUnit;
}

export function runStrengthFor(input: {
  date: string;
  sessions: readonly RunStrengthSessionInput[];
  library: PlanLibrary | null;
  workouts: readonly Workout[] | null;
  rules: PlanSafetyRules | null;
  modes: TrainingModesState | null;
}): RunStrengthForDay | null {
  const { date, sessions, library, workouts, rules } = input;
  if (!library || !workouts || !rules) return null;
  const assignment = runStrengthOn(planRunStrength(sessions, { rules }), date);
  if (!assignment) return null;
  const modes = displayModesOn(input.modes, date);
  const unit = runStrengthUnit(
    workouts.find((w) => w.id === assignment.workoutId),
    {
      library: library.exercises,
      rules,
      profile: modes.travel ? { available: modes.travel.available } : null,
      pain: modes.pain ?? null,
    },
  );
  return unit ? { assignment, unit } : null;
}
