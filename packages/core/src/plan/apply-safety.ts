import { REST_RANGES_S } from '../constants';
import type { Exercise } from '../content/schemas';
import { clampRpe, type PlannedExerciseDraft } from './adapt';
import { type EquipmentProfile, findSubstitute } from './equipment-profile';
import { isExerciseAllowed, type PlanSafetyRules } from './safety';

/**
 * Strengere Sicherheitsregeln wirken sofort (docs/PLAN-PHASE-3.md Abschnitt 5.4): beim Anzeigen jeder Einheit
 * und beim Erzeugen jedes Folgeblocks. RPE-Deckel sinkt; ausgeschlossene Übungen werden ersetzt – oder, wenn kein
 * Ersatz möglich ist (z. B. offline ohne Geräte-Profil), ausgeblendet.
 */
export interface ApplySafetyResult<T extends { exercises: readonly PlannedExerciseDraft[] }> {
  readonly session: T;
  /** IDs ausgeblendeter Übungen → Hinweis „Übung ausgelassen, bitte Plan neu erstellen“. */
  readonly hidden: readonly string[];
  /** IDs ersetzter Übungen. */
  readonly replaced: readonly string[];
}

export function applyCurrentSafetyRules<T extends { exercises: readonly PlannedExerciseDraft[] }>(
  session: T,
  rules: Pick<PlanSafetyRules, 'rpeMax' | 'excludedCautionTags' | 'cautious'>,
  ctx: {
    readonly library: ReadonlyMap<string, Exercise>;
    readonly profile?: Pick<EquipmentProfile, 'available'>;
  },
): ApplySafetyResult<T> {
  const hidden: string[] = [];
  const replaced: string[] = [];
  const used = new Set(session.exercises.map((e) => e.exercise_id));
  const exercises: PlannedExerciseDraft[] = [];
  for (const item of session.exercises) {
    const exercise = ctx.library.get(item.exercise_id);
    let next: PlannedExerciseDraft = {
      ...item,
      rpe_target: clampRpe(item.rpe_target, rules.rpeMax),
    };
    if (!exercise) {
      // Unbekannte Übung (z. B. Bibliothek nicht geladen): Merkmale nicht prüfbar → sicherheitshalber ausblenden.
      hidden.push(item.exercise_id);
      continue;
    }
    if (!isExerciseAllowed(exercise, rules)) {
      const substitute = ctx.profile
        ? findSubstitute(exercise, {
            library: ctx.library,
            profile: ctx.profile,
            rules,
            exclude: new Set([...used].filter((id) => id !== item.exercise_id)),
          })
        : null;
      if (!substitute) {
        hidden.push(item.exercise_id);
        continue;
      }
      used.add(substitute.exercise.id);
      replaced.push(item.exercise_id);
      const chosen = substitute.exercise;
      const range = REST_RANGES_S[chosen.mechanics];
      const changedPattern =
        chosen.movement_pattern !== exercise.movement_pattern ||
        chosen.mechanics !== exercise.mechanics;
      next = {
        ...next,
        exercise_id: chosen.id,
        exercise_name_de: chosen.name_de,
        rest_s: changedPattern
          ? Math.min(range.max, Math.max(range.min, next.rest_s))
          : next.rest_s,
      };
    }
    exercises.push(next);
  }
  return {
    session: { ...session, exercises: exercises.map((e, i) => ({ ...e, order_no: i + 1 })) },
    hidden,
    replaced,
  };
}
