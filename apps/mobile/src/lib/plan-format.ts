import {
  ENDURANCE_TEXTS_DE,
  enduranceVariantOf,
  isoWeekday,
  type PlanSafetyRules,
  type StoredSession,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatKg } from './format';

/**
 * Anzeige-Texte des Trainingsplans (rein, ohne React Native – getestet in plan-format.test.ts). Keine Fachlogik:
 * Werte kommen aus packages/core, hier wird nur formuliert. RPE wird immer als „Wiederholungen in Reserve“
 * (10 − RPE) erklärt, Wochentage ausgeschrieben.
 */

const WEEKDAYS = t.steps.trainingSchedule.weekdaysLong;
const WEEKDAYS_SHORT = t.steps.trainingSchedule.weekdays;

/** „Donnerstag, 08.10.“ */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${WEEKDAYS[isoWeekday(date) - 1] ?? ''}, ${day}.${month}.`;
}

/** „Donnerstag“ */
export function weekdayName(date: string): string {
  return WEEKDAYS[isoWeekday(date) - 1] ?? '';
}

/** „Do“ */
export function weekdayShort(date: string): string {
  return WEEKDAYS_SHORT[isoWeekday(date) - 1] ?? '';
}

/** Wiederholungen: „8–12“ bzw. „10“. */
export function repsRange(min: number, max: number): string {
  return min === max ? String(min) : `${min}–${max}`;
}

/** Pause: „45 Sekunden“, „1 Minute“, „2:30 Minuten“. */
export function restText(seconds: number): string {
  if (seconds < 60) return `${seconds} Sekunden`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (rest === 0) return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
  return `${minutes}:${String(rest).padStart(2, '0')} Minuten`;
}

/** Wiederholungen in Reserve aus dem RPE-Ziel: RPE 7 → „3“, RPE 7,5 → „2–3“. */
export function reserveFromRpe(rpe: number): string {
  const reserve = 10 - rpe;
  return Number.isInteger(reserve)
    ? String(reserve)
    : `${Math.floor(reserve)}–${Math.ceil(reserve)}`;
}

type ExerciseLike = StoredSession['exercises'][number];

/** Zeilen einer Übung: Dosierung, Pause, Reserve, Gewicht. */
export function exerciseLines(exercise: ExerciseLike): string[] {
  const dosage =
    exercise.duration_s !== null
      ? t.plan.setsHold(exercise.sets, exercise.duration_s)
      : t.plan.setsReps(
          exercise.sets,
          repsRange(exercise.reps_min ?? 0, exercise.reps_max ?? exercise.reps_min ?? 0),
        );
  return [
    dosage,
    t.plan.rest(restText(exercise.rest_s)),
    t.plan.reserve(reserveFromRpe(exercise.rpe_target)),
    exercise.target_weight_kg !== null
      ? t.plan.targetWeight(formatKg(exercise.target_weight_kg))
      : t.plan.startWeight,
  ];
}

/** Ausdauer: Dauer, Anstrengung mit Gesprächstest, ggf. Geh-Lauf-Muster und Ausweich-Möglichkeiten. */
export function enduranceLines(
  session: Pick<
    StoredSession,
    | 'kind'
    | 'name_de'
    | 'endurance_modality'
    | 'effort_target'
    | 'estimated_minutes'
    | 'warmup_de'
    | 'cooldown_de'
  >,
  rules: Pick<PlanSafetyRules, 'pregnancyNotice'> | null,
): string[] {
  const lines = [t.plan.enduranceDuration(session.estimated_minutes)];
  if (session.effort_target !== null)
    lines.push(ENDURANCE_TEXTS_DE.talkTest(session.effort_target));
  if (enduranceVariantOf(session) === 'walk_run') lines.push(ENDURANCE_TEXTS_DE.walkRunPattern);
  lines.push(
    rules?.pregnancyNotice
      ? ENDURANCE_TEXTS_DE.alternativesPregnancy
      : ENDURANCE_TEXTS_DE.alternatives,
  );
  return lines;
}
