import {
  explainAdjustment,
  type FewerDaysChange,
  type PlanChange,
  renderExplanation,
  startOfIsoWeek,
} from '@fitnessapp/core';

import type { LocalAdjustment } from '@/data/live-adjust';
import { t } from '@/i18n';

import { formatDateDe, formatKg, todayIso } from './format';

/**
 * Anzeige der Live-Anpassung (Phase 4b, Etappe D, docs/PLAN-PHASE-4B.md 8.1 Punkt 2): Erklärsatz aus den festen
 * Bausteinen (`t.adjust.explain`, KEINE KI), vorher → nachher, Gruppen nach Wochen. Nur Darstellung – welche Regel
 * gilt und ob „Rückgängig“ erlaubt ist, entscheidet packages/core.
 */

const shortDate = (iso: string) => formatDateDe(iso).slice(0, 6);

/** Kalendertag eines Zeitstempels in der Zeitzone des Geräts (nicht UTC – Wächter D N7). */
export function localDateOf(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp.slice(0, 10) : todayIso(date);
}

/** Erklärsatz (Übungsnamen nur aus der Bibliothek bzw. dem Plan). */
export function adjustmentExplanation(
  adjustment: LocalAdjustment,
  names: ReadonlyMap<string, string>,
): string {
  const { key, params } = explainAdjustment(adjustment);
  return renderExplanation(t.adjust.explain[key], params, names);
}

/** Vorher → nachher in kurzen Zeilen (nur Zahlen und Namen). */
export function adjustmentBeforeAfter(
  adjustment: LocalAdjustment,
  names: ReadonlyMap<string, string>,
): string[] {
  const a = t.adjust;
  if (adjustment.kind === 'state_override') {
    const before = adjustment.stateBefore;
    const after = adjustment.stateAfter;
    if (!before || !after) return [];
    const lines: string[] = [];
    if (before.weightKg !== null && after.weightKg !== null && before.weightKg !== after.weightKg) {
      lines.push(a.beforeAfterWeight(formatKg(before.weightKg), formatKg(after.weightKg)));
    }
    if (
      before.targetReps !== null &&
      after.targetReps !== null &&
      before.targetReps !== after.targetReps
    ) {
      lines.push(a.beforeAfterReps(before.targetReps, after.targetReps));
    }
    if (
      before.durationS !== null &&
      after.durationS !== null &&
      before.durationS !== after.durationS
    ) {
      lines.push(a.beforeAfterHold(before.durationS, after.durationS));
    }
    return lines;
  }
  if (adjustment.kind === 'proposal') {
    const before = adjustment.changeBefore as FewerDaysChange | null;
    const after = adjustment.changeAfter as FewerDaysChange | null;
    return before && after ? [a.beforeAfterDays(before.days, after.days)] : [];
  }
  const before = adjustment.changeBefore as PlanChange | null;
  const after = adjustment.changeAfter as PlanChange | null;
  if (!before || !after) return [];
  if (adjustment.rule === 'deload_forward') {
    const week = adjustment.explainParams.week_start;
    const swapped = adjustment.explainParams.swapped_week_start;
    return typeof week === 'string' && typeof swapped === 'string'
      ? [a.beforeAfterDeload(shortDate(week), shortDate(swapped))]
      : [];
  }
  if (adjustment.rule === 'stagnation_variation') {
    const from = adjustment.explainParams.exercise_id;
    const to = adjustment.explainParams.new_exercise_id;
    return typeof from === 'string' && typeof to === 'string'
      ? [a.beforeAfterExercise(names.get(from) ?? from, names.get(to) ?? to)]
      : [];
  }
  if (adjustment.rule === 'endurance_reduce') {
    // Je Einheit (Wächter D N6), gleiche Paare nur einmal.
    const byId = new Map(before.sessions.map((s) => [s.id, s.estimated_minutes] as const));
    const pairs = new Set(
      after.sessions.flatMap((s) => {
        const from = byId.get(s.id);
        return from !== undefined && s.estimated_minutes !== undefined
          ? [a.beforeAfterMinutes(from, s.estimated_minutes)]
          : [];
      }),
    );
    return [...pairs];
  }
  const reduction = adjustment.explainParams.sets_reduction;
  return [a.setsPerExercise(typeof reduction === 'number' ? reduction : 1)];
}

export interface AdjustmentWeekGroup {
  /** Montag der Woche, in der die Anpassung entstand. */
  readonly monday: string;
  readonly label: string;
  readonly items: readonly LocalAdjustment[];
}

/** Liste nach Wochen (neueste zuerst), je Woche neueste zuerst. */
export function groupAdjustmentsByWeek(
  adjustments: readonly LocalAdjustment[],
): AdjustmentWeekGroup[] {
  const sorted = [...adjustments].sort(
    (x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id),
  );
  const groups = new Map<string, LocalAdjustment[]>();
  for (const adjustment of sorted) {
    const monday = startOfIsoWeek(localDateOf(adjustment.createdAt));
    groups.set(monday, [...(groups.get(monday) ?? []), adjustment]);
  }
  return [...groups.entries()].map(([monday, items]) => ({
    monday,
    label: t.adjust.weekOf(formatDateDe(monday)),
    items,
  }));
}

/** Kennzeichen-Zeilen für eine Einheit („Heute“/Trainingsmodus): je Anpassung eine kurze Zeile. */
export function sessionAdjustmentLines(
  adjustments: readonly LocalAdjustment[],
  names: ReadonlyMap<string, string>,
): { text: string; accessibilityLabel: string }[] {
  return adjustments.map((adjustment) => {
    if (adjustment.kind === 'state_override' && adjustment.exerciseId) {
      const name = names.get(adjustment.exerciseId) ?? adjustment.exerciseId;
      const before = adjustment.stateBefore?.weightKg ?? null;
      const after = adjustment.stateAfter?.weightKg ?? null;
      if (before !== null && after !== null && before !== after) {
        return {
          text: t.adjust.exerciseWeight(name, formatKg(before), formatKg(after)),
          accessibilityLabel: `${name}: ${t.adjust.weightA11y(formatKg(before), formatKg(after))}`,
        };
      }
      const holdChanged =
        adjustment.stateBefore?.durationS !== adjustment.stateAfter?.durationS &&
        adjustment.stateAfter?.durationS !== null;
      const text =
        adjustment.rule === 'fast_increase'
          ? t.adjust.exerciseFaster(name)
          : holdChanged
            ? t.adjust.exerciseHold(name)
            : t.adjust.exerciseReps(name);
      return { text, accessibilityLabel: text };
    }
    const text = t.adjust.ruleTitles[adjustment.rule];
    return { text, accessibilityLabel: text };
  });
}
