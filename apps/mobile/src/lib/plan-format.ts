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
 * (10 − RPE) erklärt (in der kompakten Liste kurz „2–3 in Reserve“), Wochentage ausgeschrieben.
 */

const WEEKDAYS = t.steps.trainingSchedule.weekdaysLong;
const WEEKDAYS_SHORT = t.steps.trainingSchedule.weekdays;

/** „Donnerstag, 08.10.“ */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${WEEKDAYS[isoWeekday(date) - 1] ?? ''}, ${day}.${month}.`;
}

const MONTHS = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

/** „Dienstag, 20. Oktober“ (Kopf der Übersicht). */
export function longDayLabel(date: string): string {
  const [, month, day] = date.split('-');
  return `${weekdayName(date)}, ${Number(day)}. ${MONTHS[Number(month) - 1] ?? ''}`;
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

/** Pause kurz für die Übungsliste: „45 s“, „1:00“, „1:30“. */
export function restShort(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Pause für Bildschirmleser: „45 Sekunden“, „90 Sekunden“, „1 Minute“, „2 Minuten“. */
export function restSpoken(seconds: number): string {
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
  }
  return `${seconds} Sekunden`;
}

/**
 * Eine Übung in der kompakten Liste (Entwurf B, 26.10.2026): Zahlen getrennt statt fertiger Sätze, damit die Zeile
 * „3 × 10 · 1:30 Pause · 2–3 in Reserve“ und das Gewicht bzw. „Gewicht selbst finden“ einzeln gesetzt werden können.
 */
export interface ExerciseSummary {
  /** Zahl der Sätze (für „16 Sätze“ im Kopf der Einheit). */
  sets: number;
  /** „3 × 10“, „3 × 8–12“ bzw. „3 × 30 s“. */
  dose: string;
  /** „1:30 Pause“. */
  rest: string;
  /** „2–3 in Reserve“; null = kein RPE-Ziel. */
  reserve: string | null;
  /** „40 kg“, „6 kg je Hantel“; null = kein Gewicht vorgegeben. */
  weight: string | null;
  /** Gewicht fehlt: selbst finden bzw. leichteste Stufe nehmen; null = nichts zu finden. */
  findWeight: 'find' | 'lightest' | null;
  /** Weitere Hinweise (Progression, Wiedereinstieg, Vorschlag aus Startgewicht). */
  notes: string[];
  /** Ganze Wörter für Bildschirmleser („3 Sätze à 10 Wiederholungen, Pause 90 Sekunden, …“). */
  a11y: string;
}

/** Baut Zeile und Ansage aus den Einzelwerten (gemeinsam für Plan-Dosierung und berechnete Vorgabe). */
export function buildSummary(values: {
  sets: number;
  reps: string | null;
  holdSeconds: number | null;
  restSeconds: number;
  reserve: string | null;
  weight: string | null;
  findWeight: 'find' | 'lightest' | null;
  notes?: string[];
}): ExerciseSummary {
  const L = t.plan.list;
  const setsSpoken = L.a11y.sets(values.sets);
  const dose =
    values.holdSeconds !== null
      ? L.hold(values.sets, values.holdSeconds)
      : L.dose(values.sets, values.reps ?? '');
  const spoken = [
    values.holdSeconds !== null
      ? L.a11y.hold(setsSpoken, values.holdSeconds)
      : L.a11y.reps(setsSpoken, values.reps ?? ''),
    L.a11y.rest(restSpoken(values.restSeconds)),
    values.reserve !== null ? L.a11y.reserve(values.reserve) : null,
    values.weight !== null
      ? L.a11y.weight(values.weight)
      : values.findWeight === 'lightest'
        ? L.chooseLightest
        : values.findWeight === 'find'
          ? L.findWeight
          : null,
  ].filter((v): v is string => v !== null);
  return {
    sets: values.sets,
    dose,
    rest: L.rest(restShort(values.restSeconds)),
    reserve: values.reserve !== null ? L.reserve(values.reserve) : null,
    weight: values.weight,
    findWeight: values.weight !== null ? null : values.findWeight,
    notes: values.notes ?? [],
    a11y: spoken.join(', '),
  };
}

/**
 * Übung aus dem Plan (ohne berechnete Vorgabe, z. B. vergangene Tage oder ohne Bibliothek). `loadType` aus der
 * Bibliothek: nur Gewichtsübungen bekommen „Gewicht selbst finden“; unbekannt (Bibliothek nicht geladen) → wie bisher
 * bei allen Übungen mit Wiederholungen.
 */
export function exerciseSummary(
  exercise: ExerciseLike,
  loadType: 'weight' | 'bodyweight' | 'band' | 'time' | null = null,
): ExerciseSummary {
  const weighted = loadType === null ? exercise.duration_s === null : loadType === 'weight';
  return buildSummary({
    sets: exercise.sets,
    reps:
      exercise.duration_s !== null
        ? null
        : repsRange(exercise.reps_min ?? 0, exercise.reps_max ?? exercise.reps_min ?? 0),
    holdSeconds: exercise.duration_s,
    restSeconds: exercise.rest_s,
    reserve: reserveFromRpe(exercise.rpe_target),
    weight:
      exercise.target_weight_kg !== null
        ? t.workout.weightKg(formatKg(exercise.target_weight_kg))
        : null,
    findWeight: weighted ? 'find' : null,
  });
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
