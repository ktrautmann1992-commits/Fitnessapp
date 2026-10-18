import { LIVE_ADJUSTMENT } from '../../constants';
import type { Exercise } from '../../content/schemas';
import { daysBetween } from '../../dates';
import type { EquipmentLocation } from '../../enums';
import { progressFromLogs } from '../../log/progression';
import type { ExerciseProgress, ProgressionContext } from '../../log/types';
import { isExerciseFeasible } from '../../plan/equipment-profile';
import { isExerciseAllowed } from '../../plan/safety';
import type { StoredSession } from '../../plan/view';
import { inputFingerprint } from '../fingerprint';
import type { LiveAdjustmentEnvironment, LiveAdjustmentInputs } from '../inputs';
import { swapChange } from '../plan-changes';
import type { AdjustmentProposal, PlanChange, StoredAdjustment } from '../types';
import type { PlanWeek } from '../weeks';
import { countingEntriesFor, inRevertCooldown, isEffective } from './common';
import {
  deloadForwardProposal,
  type PlanContext,
  type RuleOutcome,
  tryDeloadForward,
  violationsAfter,
} from './plan-rules';

/**
 * R4 Stillstand (docs/PLAN-PHASE-4B.md 5.2): ≥ 3 zählende Einträge über ≥ 21 Tage ohne Schritt (Zustand unverändert,
 * nextLoad() bleibt bei „keep“). `no_heavier_weight`, `stronger_band` und `harder_variant` sind kein Stillstand (eigene
 * Hinweise, Variante hat Vorrang). Wirkung: Tausch auf eine gleichwertige Alternative (höchstens 1 je Übung und Block),
 * sonst Erholungswoche vorziehen (Tausch-Regel), sonst Hinweis.
 */

const same = (a: ExerciseProgress | null, b: ExerciseProgress | null) =>
  a !== null &&
  b !== null &&
  a.weightKg === b.weightKg &&
  a.targetReps === b.targetReps &&
  a.extraSet === b.extraSet &&
  a.durationS === b.durationS;

/** Steht die Übung still? Liefert den ältesten Eintrag des Stillstands (null = kein Stillstand). */
export function stagnationStart(
  inputs: LiveAdjustmentInputs,
  exerciseId: string,
  ctx: ProgressionContext,
): { first: string; latest: string; entries: number } | null {
  const S = LIVE_ADJUSTMENT.stagnation;
  const counting = countingEntriesFor(exerciseId, inputs.exerciseEntries);
  const latest = counting.at(-1);
  if (!latest || latest.state === null) return null;
  let start = counting.length - 1;
  while (start > 0 && same(counting[start - 1]?.state ?? null, latest.state)) start -= 1;
  const run = counting.slice(start);
  const first = run[0] as (typeof run)[number];
  if (run.length < S.minEntries || daysBetween(first.performedOn, latest.performedOn) < S.minDays) {
    return null;
  }
  const result = progressFromLogs(exerciseId, inputs.exerciseEntries, ctx, { today: inputs.today });
  if (result.step?.kind !== 'keep' || result.hint !== null || result.selfChosenWeight) return null;
  return { first: first.performedOn, latest: latest.performedOn, entries: run.length };
}

/** Wurde die Übung (als Ausgangs- oder neue Übung) in diesem Block schon getauscht? */
function swappedInBlock(
  adjustments: readonly StoredAdjustment[],
  exerciseId: string,
  blockIds: ReadonlySet<string>,
): boolean {
  const mentions = (c: StoredAdjustment['changeBefore']) =>
    c !== null &&
    'sessions' in c &&
    (c as PlanChange).sessions.some(
      (s) => blockIds.has(s.id) && (s.exercises ?? []).some((e) => e.exercise_id === exerciseId),
    );
  return adjustments.some(
    (a) =>
      a.rule === 'stagnation_variation' &&
      (isEffective(a) || a.status === 'reverted') &&
      (mentions(a.changeBefore) || mentions(a.changeAfter)),
  );
}

/**
 * Alternative mit gleichem Bewegungsmuster, nach den AKTUELLEN Sicherheitsregeln erlaubt, an jedem betroffenen Ort
 * machbar, nicht schwerer (`difficulty`), gleiche Art (Halten ↔ Wiederholungen nie) und noch nicht in den Einheiten –
 * bevorzugt nach `priority` (vorsichtig: leichtere zuerst), wie findSubstitute()/allowedAlternatives().
 */
export function stagnationAlternative(
  original: Exercise,
  sessions: readonly StoredSession[],
  inputs: LiveAdjustmentInputs,
  env: LiveAdjustmentEnvironment,
): Exercise | null {
  const locations = new Set<EquipmentLocation>();
  for (const s of sessions) {
    const loc = inputs.sessionLocations?.[s.id];
    if (loc) locations.add(loc);
    else for (const l of env.profiles.keys()) locations.add(l);
  }
  const inSessions = new Set(sessions.flatMap((s) => s.exercises.map((e) => e.exercise_id)));
  const sorted = [...original.alternatives].sort((a, b) => {
    if (inputs.rules.cautious) {
      const ea = a.reason === 'easier' ? 0 : 1;
      const eb = b.reason === 'easier' ? 0 : 1;
      if (ea !== eb) return ea - eb;
    }
    return a.priority - b.priority || (a.alternative_id < b.alternative_id ? -1 : 1);
  });
  for (const alt of sorted) {
    const c = env.library.get(alt.alternative_id);
    if (
      c &&
      c.id !== original.id &&
      !inSessions.has(c.id) &&
      c.movement_pattern === original.movement_pattern &&
      (c.load_type === 'time') === (original.load_type === 'time') &&
      c.difficulty <= original.difficulty &&
      isExerciseAllowed(c, inputs.rules) &&
      [...locations].every((l) => {
        const profile = env.profiles.get(l);
        return profile !== undefined && isExerciseFeasible(c, profile);
      })
    ) {
      return c;
    }
  }
  return null;
}

export function stagnation(
  inputs: LiveAdjustmentInputs,
  ctx: PlanContext,
  env: LiveAdjustmentEnvironment,
  exerciseId: string,
  progression: ProgressionContext,
): RuleOutcome {
  const original = env.library.get(exerciseId);
  if (!original) return { proposal: null, hint: null };
  const stalled = stagnationStart(inputs, exerciseId, progression);
  if (!stalled) return { proposal: null, hint: null };
  if (
    inRevertCooldown(
      inputs.adjustments,
      'stagnation_variation',
      inputs.today,
      (a) => a.exerciseId === exerciseId,
    )
  ) {
    return { proposal: null, hint: null };
  }
  // Künftige Einheiten des laufenden Blocks mit dieser Übung (nur zulässige, S1).
  const current = ctx.k >= 0 ? (ctx.weeks[ctx.k] as PlanWeek<StoredSession>) : null;
  const blockNo =
    current?.blockNo ??
    [...inputs.plan.sessions]
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))
      .find((s) => s.scheduled_on > inputs.today)?.block_no;
  if (blockNo === undefined) return { proposal: null, hint: null };
  const blockIds = new Set(ctx.sessions.filter((s) => s.block_no === blockNo).map((s) => s.id));
  const affected = ctx.sessions.filter(
    (s) =>
      s.block_no === blockNo &&
      ctx.eligible.has(s.id) &&
      s.exercises.some((e) => e.exercise_id === exerciseId),
  );
  if (affected.length === 0) return { proposal: null, hint: null };
  const basis = countingEntriesFor(exerciseId, inputs.exerciseEntries).at(-1);
  const basisLog = basis
    ? (inputs.sessionLogs.find((l) => l.id === basis.sessionLogId) ?? null)
    : null;

  if (!swappedInBlock(inputs.adjustments, exerciseId, blockIds)) {
    const replacement = stagnationAlternative(original, affected, inputs, env);
    if (replacement) {
      const pair = swapChange(affected, exerciseId, replacement);
      const first = ctx.weeks.findIndex((w) => w.sessions.some((s) => s.id === affected[0]?.id));
      if (violationsAfter(inputs, ctx, pair, Math.max(0, first)).length === 0) {
        const ids = [...new Set(pair.after.sessions.map((s) => s.id))].sort();
        const proposal: AdjustmentProposal = {
          rule: 'stagnation_variation',
          kind: 'plan_change',
          requiresConfirmation: false,
          exerciseId,
          plannedSessionIds: ids,
          basisSessionLogId: basis?.sessionLogId ?? null,
          basisPerformedOn: basis?.performedOn ?? null,
          stateBefore: null,
          stateAfter: null,
          changeBefore: pair.before,
          changeAfter: pair.after,
          explainParams: {
            exercise_id: exerciseId,
            new_exercise_id: replacement.id,
            days: daysBetween(stalled.first, stalled.latest),
          },
          effectiveFrom: affected.map((s) => s.scheduled_on).sort()[0] ?? inputs.today,
          expiresOn: null,
          inputFingerprint: fingerprintOf(inputs, exerciseId, blockNo, basis?.sessionLogId ?? null),
          engineVersion: LIVE_ADJUSTMENT.engineVersion,
          ruleVersion: LIVE_ADJUSTMENT.ruleVersion,
          usesBodyData: false,
          fromHealthPlan: inputs.plan.fromHealthPlan,
        };
        return { proposal, hint: null };
      }
    }
  }
  const swap = tryDeloadForward(inputs, ctx);
  if (swap) {
    return {
      proposal: deloadForwardProposal(inputs, ctx, swap, 'stagnation', exerciseId, basisLog),
      hint: null,
    };
  }
  return {
    proposal: null,
    hint: { code: 'rest_this_week', rule: 'stagnation_variation', exerciseId },
  };
}

function fingerprintOf(
  inputs: LiveAdjustmentInputs,
  exerciseId: string,
  blockNo: number,
  basis: string | null,
): string {
  return inputFingerprint('stagnation_variation', {
    plan: inputs.plan.id,
    exercise: exerciseId,
    block: blockNo,
    basis,
  });
}
