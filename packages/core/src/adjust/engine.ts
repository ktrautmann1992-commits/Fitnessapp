import { LIVE_ADJUSTMENT } from '../constants';
import { startOfIsoWeek } from '../dates';
import type { LiveAdjustmentEnvironment, LiveAdjustmentInputs } from './inputs';
import { newInvariantViolations } from './invariants';
import { applyPlanChange } from './plan-changes';
import { dateOf } from './rules/common';
import { fewerDays } from './rules/fewer-days';
import {
  highLoadEndurance,
  highLoadStrength,
  planContext,
  swappedWeeksOf,
  tryVolumeReduce,
} from './rules/plan-rules';
import { stagnation } from './rules/stagnation';
import { fastIncrease, loadReduce } from './rules/state-rules';
import type {
  ActiveAdjustmentRule,
  AdjustmentHint,
  AdjustmentProposal,
  LiveAdjustmentResult,
  PlanChange,
} from './types';

/**
 * Regel-Engine der Live-Anpassung (docs/PLAN-PHASE-4B.md 5.3). Rein und deterministisch: gleiche Eingaben → gleiche
 * Vorschläge und gleiche Fingerabdrücke. KEINE KI. Ohne Premium (`entitled = false`) entsteht nichts – Gratis behält
 * genau die Progression aus Phase 4.
 *
 * Reihenfolge und Konflikte:
 * - je Übung höchstens eine Zustands-Vorgabe: R2 (`load_reduce`) vor R1 (`fast_increase`), Senken schlägt Steigern;
 * - je Woche höchstens eine Plan-Änderung je Art; `deload_forward` schlägt `volume_reduce` und `endurance_reduce` derselben
 *   Woche (beide würden dieselben Einheiten ändern);
 * - zum Schluss prüft checkWeekInvariants() den Plan NACH allen Plan-Änderungen; hält eine Invariante nicht, fällt zuerst
 *   `deload_forward` weg (Fallback `volume_reduce`, sonst Hinweis), dann die übrigen Plan-Änderungen;
 * - höchstens LIVE_ADJUSTMENT.maxAutomaticPerWeek automatische Änderungen je Kalenderwoche (inkl. schon gespeicherter),
 *   darüber nur Hinweise; Vorschläge (R5) zählen nicht;
 * - ein Fingerabdruck, den es für diese Regel schon gibt, wird nie erneut vorgeschlagen (Idempotenz).
 */

/** Vorrang automatischer Änderungen beim Wochen-Deckel (Sicherheit zuerst). */
const PRIORITY: readonly ActiveAdjustmentRule[] = [
  'load_reduce',
  'deload_forward',
  'volume_reduce',
  'endurance_reduce',
  'stagnation_variation',
  'fast_increase',
  'fewer_days',
];

const byPriority = (a: AdjustmentProposal, b: AdjustmentProposal) =>
  PRIORITY.indexOf(a.rule) - PRIORITY.indexOf(b.rule) ||
  (a.exerciseId ?? '').localeCompare(b.exerciseId ?? '') ||
  a.inputFingerprint.localeCompare(b.inputFingerprint);

const sessionIdsOf = (p: AdjustmentProposal) => new Set(p.plannedSessionIds);
const overlaps = (a: AdjustmentProposal, b: AdjustmentProposal) =>
  a.plannedSessionIds.some((id) => sessionIdsOf(b).has(id));

export function computeLiveAdjustments(
  rawInputs: LiveAdjustmentInputs,
  env: LiveAdjustmentEnvironment,
): LiveAdjustmentResult {
  if (!rawInputs.entitled) return { proposals: [], hints: [] };
  // Einheiten nach Datum (und ID) sortieren – Eingaben aus Zeilen kommen in beliebiger Reihenfolge (Wächter-Auflage 6).
  const inputs: LiveAdjustmentInputs = {
    ...rawInputs,
    plan: {
      ...rawInputs.plan,
      sessions: [...rawInputs.plan.sessions].sort(
        (a, b) => a.scheduled_on.localeCompare(b.scheduled_on) || a.id.localeCompare(b.id),
      ),
    },
  };
  const ctx = planContext(inputs);
  const proposals: AdjustmentProposal[] = [];
  const hints: AdjustmentHint[] = [];
  const add = (o: { proposal: AdjustmentProposal | null; hint: AdjustmentHint | null }) => {
    if (o.proposal) proposals.push(o.proposal);
    if (o.hint) hints.push(o.hint);
  };

  // Zustands-Vorgaben je Übung (R2 vor R1).
  const exerciseIds = Object.keys(inputs.contexts).sort();
  for (const id of exerciseIds) {
    const progression = inputs.contexts[id];
    if (!progression) continue;
    const reduce = loadReduce(inputs, id, progression);
    if (reduce) {
      proposals.push(reduce);
      continue;
    }
    const fast = fastIncrease(inputs, id, progression);
    if (fast) proposals.push(fast);
  }

  // Plan-Änderungen.
  add(highLoadStrength(inputs, ctx, env));
  add(highLoadEndurance(inputs, ctx));
  for (const id of exerciseIds) {
    const progression = inputs.contexts[id];
    if (progression) add(stagnation(inputs, ctx, env, id, progression));
  }
  add(fewerDays(inputs, ctx));

  // Konflikte: höchstens ein deload_forward; er schlägt Änderungen derselben Einheiten.
  let planChanges = proposals.filter((p) => p.kind === 'plan_change').sort(byPriority);
  const forward = planChanges.find((p) => p.rule === 'deload_forward');
  planChanges = planChanges.filter(
    (p) =>
      p === forward ||
      (p.rule !== 'deload_forward' &&
        !(
          forward &&
          (p.rule === 'volume_reduce' || p.rule === 'endurance_reduce') &&
          overlaps(p, forward)
        )),
  );
  // Je Art und Woche nur eine: gleiche Regel mit überlappenden Einheiten → nur die erste.
  planChanges = planChanges.filter(
    (p, i) => !planChanges.slice(0, i).some((q) => q.rule === p.rule && overlaps(p, q)),
  );

  // Höchstens LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment Einheiten je Anpassung (planned_session_ids), sonst Hinweis.
  planChanges = planChanges.filter((p) => {
    if (p.plannedSessionIds.length <= LIVE_ADJUSTMENT.maxPlannedSessionsPerAdjustment) return true;
    hints.push({ code: 'rest_this_week', rule: p.rule, exerciseId: p.exerciseId });
    return false;
  });

  // Schlussprüfung der Invarianten über alle Plan-Änderungen zusammen.
  const check = (list: readonly AdjustmentProposal[]) => {
    let sessions = [...inputs.plan.sessions];
    for (const p of list) sessions = applyPlanChange(sessions, p.changeAfter as PlanChange);
    const existing = swappedWeeksOf(inputs.adjustments, ctx.weeks);
    const swapped = [
      ...existing,
      ...list
        .filter((p) => p.rule === 'deload_forward')
        .flatMap((p) => {
          const w = ctx.weeks.find((x) => x.monday === p.explainParams.swapped_week_start);
          return w ? [{ blockNo: w.blockNo, weekNo: w.weekNo }] : [];
        }),
    ];
    const first = list
      .map((p) => p.effectiveFrom)
      .sort()
      .at(0);
    const options = {
      maxLoadWeeks: ctx.maxLoadWeeks,
      planStart: inputs.plan.startDate,
      fromMonday: first ? startOfIsoWeek(first) : startOfIsoWeek(inputs.today),
    };
    // Nur neu entstehende Verstöße (vorher/nachher), Wächter-Auflage 5.
    return newInvariantViolations(
      inputs.plan.sessions,
      sessions,
      { ...options, swappedWeeks: swapped },
      { ...options, swappedWeeks: existing },
    );
  };
  if (planChanges.length > 0 && check(planChanges).length > 0) {
    const fwd = planChanges.find((p) => p.rule === 'deload_forward');
    if (fwd) {
      planChanges = planChanges.filter((p) => p !== fwd);
      hints.push({ code: 'rest_this_week', rule: 'deload_forward', exerciseId: fwd.exerciseId });
      if (!planChanges.some((p) => p.rule === 'volume_reduce')) {
        const fallback = tryVolumeReduce(inputs, ctx, env, []);
        if (fallback) planChanges.push(fallback);
      }
    }
    for (const rule of ['endurance_reduce', 'volume_reduce', 'stagnation_variation'] as const) {
      if (check(planChanges).length === 0) break;
      const dropped = planChanges.filter((p) => p.rule === rule);
      planChanges = planChanges.filter((p) => p.rule !== rule);
      for (const p of dropped)
        hints.push({ code: 'rest_this_week', rule, exerciseId: p.exerciseId });
    }
  }

  // Idempotenz: vorhandene Fingerabdrücke nie erneut.
  const known = new Set(inputs.adjustments.map((a) => `${a.rule}|${a.inputFingerprint}`));
  const fresh = [...proposals.filter((p) => p.kind !== 'plan_change'), ...planChanges].filter(
    (p) => !known.has(`${p.rule}|${p.inputFingerprint}`),
  );

  // Wochen-Deckel automatischer Änderungen.
  const week = startOfIsoWeek(inputs.today);
  const already = inputs.adjustments.filter(
    (a) => !a.requiresConfirmation && startOfIsoWeek(dateOf(a.createdAt)) === week,
  ).length;
  let budget = Math.max(0, LIVE_ADJUSTMENT.maxAutomaticPerWeek - already);
  const result: AdjustmentProposal[] = [];
  for (const p of [...fresh].sort(byPriority)) {
    if (p.requiresConfirmation) {
      result.push(p);
      continue;
    }
    if (budget > 0) {
      result.push(p);
      budget -= 1;
    } else {
      hints.push({ code: 'weekly_limit_reached', rule: p.rule, exerciseId: p.exerciseId });
    }
  }
  let final = result.slice(0, LIVE_ADJUSTMENT.maxPerBatch);
  // Teilmenge nach dem Deckel noch einmal prüfen (sicher: im Zweifel keine Plan-Änderung, nur Hinweise).
  const finalChanges = final.filter((p) => p.kind === 'plan_change');
  if (finalChanges.length > 0 && check(finalChanges).length > 0) {
    for (const p of finalChanges) {
      hints.push({ code: 'rest_this_week', rule: p.rule, exerciseId: p.exerciseId });
    }
    final = final.filter((p) => p.kind !== 'plan_change');
  }
  return { proposals: final, hints: dedupeHints(hints) };
}

function dedupeHints(hints: readonly AdjustmentHint[]): AdjustmentHint[] {
  const seen = new Set<string>();
  return hints.filter((h) => {
    const key = `${h.code}|${h.rule}|${h.exerciseId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
