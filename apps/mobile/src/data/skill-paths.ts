import {
  ageInYears,
  displayModesOn,
  equipmentIdSchema,
  equipmentProfile,
  type ExerciseLogEntry,
  experienceLevelSchema,
  isStrengthKind,
  locationOfKind,
  type LoggedSet,
  type PlanLibrary,
  type PlanSafetyRules,
  type SkillGateContext,
  type SkillStepHint,
  skillStepHint,
  type TrainingModesState,
} from '@fitnessapp/core';

import { logEntriesFromRows, logRowsOf } from './log-rows';
import type { UserRows } from './types';
import type { WorkoutDraft } from './workout-draft';

/**
 * Skill-Pfade in der App (docs/PLAN-CALISTHENICS-SCHLINGE.md 2.5) – nur Abbildung der Zeilen auf den Kontext von
 * packages/core (skillPathViews, skillStepHint). Rein und getestet (skill-paths.test.ts).
 * - Level und Alter aus dem Profil, Regeln des Plans bzw. aus den Angaben (app.safetyRules), Schon-Modus von heute.
 * - Geräte: trainiert die Person (auch) im Studio, gilt das Studio; sonst die Heim-Geräte (inkl. Park).
 * - Tagebuch: alle geladenen Einträge (Supabase: die letzten Wochen + recent_exercise_logs).
 */
export function skillGateContextFromRows(input: {
  rows: UserRows;
  library: PlanLibrary;
  rules: PlanSafetyRules;
  modes: TrainingModesState | null;
  today: string;
}): SkillGateContext | null {
  const { rows, library, rules, today } = input;
  const birthDate = rows.profile?.birth_date;
  const level = experienceLevelSchema.safeParse(rows.profile?.experience_level);
  if (!birthDate || !level.success) return null;
  const strengthKinds = rows.trainingSlots.filter((s) => isStrengthKind(s.kind));
  const trainsAtGym = strengthKinds.some((s) => locationOfKind(s.kind) === 'gym');
  const profile = trainsAtGym
    ? equipmentProfile('gym', [])
    : equipmentProfile(
        'home',
        rows.userEquipment
          .filter((row) => row.location === 'home')
          .flatMap((row) => {
            const id = equipmentIdSchema.safeParse(row.equipment_id);
            return id.success ? [{ equipmentId: id.data, weightsKg: [...row.weights_kg] }] : [];
          }),
      );
  return {
    library: library.exercises,
    experienceLevel: level.data,
    age: ageInYears(birthDate, today),
    rules,
    pain: displayModesOn(input.modes, today).pain ?? null,
    profile,
    logs: logEntriesFromRows(logRowsOf(rows)),
    today,
  };
}

/**
 * Laufende Einheit als vorläufiger Tagebuch-Eintrag einer Übung (für „Nächste Stufe freigeschaltet“ schon während des
 * Trainings). null, wenn kein Satz abgehakt ist, die Übung ausgelassen wurde oder die Einheit nicht zählt.
 */
export function draftSkillEntry(
  draft: Pick<WorkoutDraft, 'performedOn' | 'isIntroWeek' | 'isDeload' | 'isFree' | 'updatedAt'>,
  exercise: { exerciseId: string; skipped: boolean; sets: readonly LoggedSet[] },
): ExerciseLogEntry | null {
  const done = exercise.sets.filter((s) => s.done);
  if (exercise.skipped || done.length === 0) return null;
  return {
    exerciseId: exercise.exerciseId,
    performedOn: draft.performedOn,
    loggedAt: draft.updatedAt,
    status: 'done',
    loadType: done[0]?.durationS !== null ? 'time' : 'bodyweight',
    isIntroWeek: draft.isIntroWeek,
    isDeload: draft.isDeload,
    isFree: draft.isFree === true,
    targetSets: null,
    targetWeightKg: null,
    targetReps: null,
    targetExtraSet: null,
    targetRpe: null,
    state: null,
    weightConfirmed: false,
    sets: [...exercise.sets],
  };
}

/**
 * Hinweise je Übung des Entwurfs: Tagebuch + laufende Einheit; ohne Kontext (Bibliothek/Profil fehlt) nichts.
 * Bearbeitet die Person einen gespeicherten Eintrag (`editing`), gibt es keinen Hinweis.
 */
export function skillHintsForDraft(
  draft: Pick<
    WorkoutDraft,
    'performedOn' | 'isIntroWeek' | 'isDeload' | 'isFree' | 'updatedAt' | 'editing' | 'exercises'
  >,
  ctx: SkillGateContext | null,
): (SkillStepHint | null)[] {
  return draft.exercises.map((exercise) => {
    if (!ctx || draft.editing) return null;
    const exerciseId = exercise.alternative?.exerciseId ?? exercise.planned.exerciseId;
    const entry = draftSkillEntry(draft, {
      exerciseId,
      skipped: exercise.skipped,
      sets: exercise.sets,
    });
    if (!entry) return null;
    return skillStepHint(exerciseId, { ...ctx, logs: [...ctx.logs, entry] });
  });
}
