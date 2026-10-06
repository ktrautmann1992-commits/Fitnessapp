import type { WorkoutItem } from '@fitnessapp/core';

import { type DraftTarget, draftTargetFrom } from '@/data/workout-draft';
import { t } from '@/i18n';

import { formatKg } from './format';
import { repsRange, reserveFromRpe, restText } from './plan-format';

/**
 * Anzeige-Texte des Trainingsmodus (rein, getestet in workout-format.test.ts). Keine Fachlogik: Vorgabe und Hinweis
 * kommen aus packages/core (über den Entwurf), hier wird nur formuliert.
 */

/** „je Hantel“ bzw. „je Kugel“ bei Kurzhanteln/Kettlebells (Gewicht gilt je Stück). */
export function perPieceText(target: Pick<DraftTarget, 'perPiece'>): string | null {
  if (target.perPiece === 'kettlebell') return t.workout.perKettlebell;
  if (target.perPiece === 'dumbbell') return t.workout.perDumbbell;
  return null;
}

/** Gewicht mit Einheit, z. B. „22,5 kg je Hantel“. */
export function weightText(weightKg: number, perPiece: string | null): string {
  const kg = t.workout.weightKg(formatKg(weightKg));
  return perPiece ? `${kg} ${perPiece}` : kg;
}

/** Vorgabe einer Übung: „3 × 10 mit 22,5 kg je Hantel“, „3 × 30 Sekunden halten“, „3 × 8–12“. */
export function targetText(target: DraftTarget): string {
  const perPiece = perPieceText(target);
  const tg = target.targets;
  const sets = tg.target_sets ?? 1;
  if (target.loadType === 'time' && tg.target_duration_s !== null) {
    return t.workout.targetHold(sets, tg.target_duration_s);
  }
  const reps =
    tg.target_reps !== null
      ? String(tg.target_reps)
      : repsRange(tg.reps_min ?? 0, tg.reps_max ?? tg.reps_min ?? 0);
  const weight =
    target.loadType === 'weight' && tg.target_weight_kg !== null
      ? weightText(tg.target_weight_kg, perPiece)
      : null;
  return t.workout.target(sets, reps, weight);
}

/** Zusätzliche Zeilen: Startgewicht finden, Ziel-Reserve, Wiedereinstieg, Hinweis der Progression. */
export function targetNotes(target: DraftTarget): string[] {
  const lines: string[] = [];
  const tg = target.targets;
  if (target.loadType === 'weight' && tg.target_weight_kg === null) {
    lines.push(target.chooseLightest ? t.workout.chooseLightest : t.workout.findStartWeight);
  } else if (target.source === 'start_weight') {
    lines.push(t.workout.fromStartWeight);
  }
  if (tg.is_return) lines.push(t.workout.returnAfterPause);
  if (tg.target_rpe !== null) lines.push(t.workout.rpeTarget(reserveFromRpe(tg.target_rpe)));
  const hint = hintText(target);
  if (hint) lines.push(hint);
  return lines;
}

/**
 * Hinweis der Progression als fester Satz. `harder_variant` NUR mit Variantenname (progressHintForDisplay, Pflicht-
 * punkt der UI-Etappe) – ohne Namen kein Hinweis.
 */
export function hintText(target: Pick<DraftTarget, 'hint' | 'harderVariantName'>): string | null {
  switch (target.hint) {
    case 'harder_variant':
      return target.harderVariantName
        ? t.workout.hint.harder_variant(target.harderVariantName)
        : null;
    case 'stronger_band':
      return t.workout.hint.stronger_band;
    case 'no_heavier_weight':
      return t.workout.hint.no_heavier_weight;
    case 'confirm_weight':
      return t.workout.hint.confirm_weight;
    default:
      return null;
  }
}

/** Zeilen für „Heute“: berechnete Vorgabe, Hinweise und Pause (null = Übung nicht prüfbar → Plan-Dosierung). */
export function workoutTargetLines(item: WorkoutItem): string[] | null {
  if (!item.plan) return null;
  const target = draftTargetFrom(item.plan, item.shown);
  return [targetText(target), ...targetNotes(target), t.plan.rest(restText(item.shown.rest_s))];
}
