import { ageInYears } from '../../age';
import {
  AGE_PLAN_RULES,
  LIVE_ADJUSTMENT,
  PLANNED_LOAD_LIMITS,
  TEMPLATE_DOSAGE_LIMITS,
} from '../../constants';
import { daysBetween } from '../../dates';
import { progressFromLogs } from '../../log/progression';
import type { ExerciseProgress, LoggedSet, ProgressionContext } from '../../log/types';
import { inputFingerprint } from '../fingerprint';
import type { LiveAdjustmentInputs, LiveExerciseEntry } from '../inputs';
import type { AdjustmentProposal } from '../types';
import { tomorrowOf } from '../weeks';
import { countingEntriesFor, dateOf, inRevertCooldown, isEffective } from './common';

/**
 * Zustands-Vorgaben R1 `fast_increase` und R2 `load_reduce` (docs/PLAN-PHASE-4B.md 5.2). Beide beruhen auf dem
 * NEUESTEN zählenden Eintrag der Übung (`basis_session_log_id`); kommt ein neuerer Eintrag an, ist die Vorgabe veraltet
 * (activeStateOverride ignoriert sie). Gratis bleibt unverändert: ohne Vorgabe rechnet progressFromLogs() wie Phase 4.
 */

const EPS = 1e-9;
const same = (a: ExerciseProgress, b: ExerciseProgress) =>
  a.weightKg === b.weightKg &&
  a.targetReps === b.targetReps &&
  a.extraSet === b.extraSet &&
  a.durationS === b.durationS;

function proposal(
  rule: 'fast_increase' | 'load_reduce',
  inputs: LiveAdjustmentInputs,
  exerciseId: string,
  basis: LiveExerciseEntry,
  stateBefore: ExerciseProgress,
  stateAfter: ExerciseProgress,
  explainParams: AdjustmentProposal['explainParams'],
): AdjustmentProposal {
  return {
    rule,
    kind: 'state_override',
    requiresConfirmation: false,
    exerciseId,
    plannedSessionIds: [],
    basisSessionLogId: basis.sessionLogId,
    basisPerformedOn: basis.performedOn,
    stateBefore,
    stateAfter,
    changeBefore: null,
    changeAfter: null,
    explainParams,
    effectiveFrom: tomorrowOf(inputs.today),
    expiresOn: null,
    inputFingerprint: inputFingerprint(rule, {
      exercise: exerciseId,
      basis: basis.sessionLogId,
      after: stateAfter,
    }),
    engineVersion: LIVE_ADJUSTMENT.engineVersion,
    ruleVersion: LIVE_ADJUSTMENT.ruleVersion,
    usesBodyData: false,
    fromHealthPlan: inputs.plan.fromHealthPlan,
  };
}

/** R1 ist ausgeschlossen: vorsichtiger Plan, unter 18, ab 65, Einsteiger im ersten Block (Frage 5). */
export function fastIncreaseExcluded(inputs: LiveAdjustmentInputs): boolean {
  const age = ageInYears(inputs.person.birthDate, inputs.today);
  if (inputs.rules.cautious) return true;
  if (age < AGE_PLAN_RULES.minor.belowAge || age >= AGE_PLAN_RULES.senior.fromAge) return true;
  if (inputs.plan.experienceLevel === 'beginner') {
    // Eingabe kann unsortiert sein (Wächter-Auflage 6): nach Datum sortieren.
    const sorted = [...inputs.plan.sessions].sort((a, b) =>
      a.scheduled_on.localeCompare(b.scheduled_on),
    );
    const upcoming = sorted.filter((s) => s.scheduled_on >= inputs.today);
    const current = upcoming[0] ?? sorted.at(-1);
    if (!current || current.block_no <= 1) return true;
  }
  return false;
}

/**
 * R1 `fast_increase`: im NEUESTEN zählenden Eintrag einer Gewichts- oder Wdh.-Übung erreichen alle geplanten
 * Arbeitssätze reps_max und JEDER Satz hat ein RPE ≤ Ziel − 2 → der Schritt aus nextLoad() gilt schon nach einer
 * Einheit (consecutiveSessionsForStep 1). 10-%-Deckel, Puffer bei großen Sprüngen und W7 bleiben (nextLoad).
 */
export function fastIncrease(
  inputs: LiveAdjustmentInputs,
  exerciseId: string,
  ctx: ProgressionContext,
): AdjustmentProposal | null {
  if (ctx.loadType !== 'weight' && ctx.loadType !== 'bodyweight') return null;
  if (ctx.repsMax === null || fastIncreaseExcluded(inputs)) return null;
  const counting = countingEntriesFor(exerciseId, inputs.exerciseEntries);
  const latest = counting.at(-1);
  if (!latest || latest.state === null) return null;
  const planned = Math.max(1, latest.targetSets ?? latest.sets.length);
  const work = latest.sets.filter((s) => s.done);
  if (work.length < planned || latest.sets.length === 0) return null;
  const rpeTarget = latest.targetRpe ?? ctx.rpeTarget;
  const allRpe = latest.sets.every(
    (s) => s.rpe !== null && s.rpe <= rpeTarget - LIVE_ADJUSTMENT.fastIncrease.rpeBelowTarget + EPS,
  );
  if (!allRpe) return null;
  if (!work.every((s) => (s.reps ?? 0) >= (ctx.repsMax as number))) return null;
  const options = { today: inputs.today };
  const normal = progressFromLogs(exerciseId, inputs.exerciseEntries, ctx, options);
  const fast = progressFromLogs(exerciseId, inputs.exerciseEntries, ctx, {
    ...options,
    consecutiveSessionsForStep: LIVE_ADJUSTMENT.fastIncrease.consecutiveSessionsForStep,
  });
  if (fast.source !== 'logs' || fast.step === null || same(fast.progress, normal.progress)) {
    return null;
  }
  if (!['increase_weight', 'add_rep', 'add_set'].includes(fast.step.kind)) return null;
  return proposal('fast_increase', inputs, exerciseId, latest, normal.progress, fast.progress, {
    weight_before: normal.progress.weightKg ?? 0,
    weight_after: fast.progress.weightKg ?? 0,
    exercise_id: exerciseId,
  });
}

/**
 * „Deutlich verfehlt“ (R2): in mindestens der Hälfte der Arbeitssätze Wdh. < reps_min, Halteübung < 80 % der Dauer
 * oder RPE ≥ Ziel + 1,5 bei Wdh. unter dem Ziel. Nicht eingetragene (fehlende) Sätze zählen als verfehlt.
 */
export function clearlyMissed(entry: LiveExerciseEntry, ctx: ProgressionContext): boolean {
  const planned = Math.max(1, entry.targetSets ?? entry.sets.length, entry.sets.length);
  const rpeTarget = entry.targetRpe ?? ctx.rpeTarget;
  const targetReps = entry.targetReps ?? entry.state?.targetReps ?? ctx.repsMin;
  const targetDuration = entry.state?.durationS ?? ctx.durationS;
  const missedSet = (s: LoggedSet) => {
    if (!s.done) return true;
    if (ctx.loadType === 'time') {
      return (
        targetDuration !== null &&
        (s.durationS ?? 0) < targetDuration * LIVE_ADJUSTMENT.loadReduce.holdShare - EPS
      );
    }
    const reps = s.reps ?? 0;
    if (ctx.repsMin !== null && reps < ctx.repsMin) return true;
    return (
      s.rpe !== null &&
      s.rpe >= rpeTarget + LIVE_ADJUSTMENT.loadReduce.rpeAboveTarget - EPS &&
      targetReps !== null &&
      reps < targetReps
    );
  };
  const missed = entry.sets.filter(missedSet).length + (planned - entry.sets.length);
  return missed >= planned * LIVE_ADJUSTMENT.loadReduce.missedShare - EPS;
}

/** Gesenkter Zustand nach R2 (roher Wert, ortsunabhängig – die Anzeige rundet auf die Stufe des Orts ab). */
export function reducedState(state: ExerciseProgress, ctx: ProgressionContext): ExerciseProgress {
  const repsMin = ctx.repsMin;
  let weightKg = state.weightKg;
  if (ctx.loadType === 'weight' && state.weightKg !== null) {
    // −10 % (auf 0,25 kg AUFgerundet, also nie mehr als −10 %), nie unter die kleinste eigene Stufe bzw. 0,5 kg.
    const reduced = Math.ceil(state.weightKg * LIVE_ADJUSTMENT.loadReduce.factor * 4 - EPS) / 4;
    const smallest = ctx.steps && ctx.steps.length > 0 ? Math.min(...ctx.steps) : null;
    const floor = Math.max(PLANNED_LOAD_LIMITS.targetWeightKg.min, smallest ?? 0);
    weightKg = Math.min(state.weightKg, Math.max(reduced, floor));
  }
  let durationS = state.durationS;
  if (ctx.loadType === 'time' && state.durationS !== null) {
    durationS = Math.min(
      state.durationS,
      Math.max(
        LIVE_ADJUSTMENT.loadReduce.holdMinS,
        TEMPLATE_DOSAGE_LIMITS.durationS.min,
        Math.floor(state.durationS * LIVE_ADJUSTMENT.loadReduce.factor),
      ),
    );
  }
  return {
    weightKg,
    targetReps: ctx.loadType === 'time' ? state.targetReps : (repsMin ?? state.targetReps),
    extraSet: false,
    durationS,
  };
}

/**
 * R2 `load_reduce`: die zwei neuesten zählenden Einträge mit GLEICHEM Zustand beide deutlich verfehlt → Gewicht × 0,9
 * (Halteübung Dauer × 0,9, ≥ 10 s), Wdh. = reps_min, kein Zusatzsatz. Nicht, wenn die Person schon selbst leichter
 * trainiert hat (Vorrang des eigenen Gewichts, Phase 4 Frage 5), und je Übung höchstens alle 14 Tage.
 */
export function loadReduce(
  inputs: LiveAdjustmentInputs,
  exerciseId: string,
  ctx: ProgressionContext,
): AdjustmentProposal | null {
  const counting = countingEntriesFor(exerciseId, inputs.exerciseEntries);
  const [previous, latest] = counting.slice(-LIVE_ADJUSTMENT.loadReduce.entries);
  if (!previous || !latest || latest.state === null || previous.state === null) return null;
  if (!same(previous.state, latest.state)) return null;
  if (!clearlyMissed(previous, ctx) || !clearlyMissed(latest, ctx)) return null;
  const normal = progressFromLogs(exerciseId, inputs.exerciseEntries, ctx, { today: inputs.today });
  if (normal.selfChosenWeight) return null;
  // Selbst leichter trainiert (auch ohne einheitliche Sätze): Vorrang der Person.
  const shown = latest.targetWeightKg;
  if (
    ctx.loadType === 'weight' &&
    shown !== null &&
    latest.sets.some((s) => s.done && s.weightKg !== null && s.weightKg < shown - EPS)
  ) {
    return null;
  }
  const recent = inputs.adjustments.some(
    (a) =>
      a.rule === 'load_reduce' &&
      a.exerciseId === exerciseId &&
      (isEffective(a) || a.status === 'superseded') &&
      daysBetween(dateOf(a.createdAt), inputs.today) < LIVE_ADJUSTMENT.loadReduce.cooldownDays,
  );
  if (recent) return null;
  if (
    inRevertCooldown(
      inputs.adjustments,
      'load_reduce',
      inputs.today,
      (a) => a.exerciseId === exerciseId,
    )
  ) {
    return null;
  }
  const after = reducedState(latest.state, ctx);
  if (same(after, latest.state)) return null;
  return proposal('load_reduce', inputs, exerciseId, latest, latest.state, after, {
    weight_before: latest.state.weightKg ?? 0,
    weight_after: after.weightKg ?? 0,
    exercise_id: exerciseId,
  });
}
