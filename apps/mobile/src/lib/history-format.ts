import { type BestSet, type DayStatus, formatDuration, type SummaryLog } from '@fitnessapp/core';

import type { SetLogRow } from '@/data/types';
import { t } from '@/i18n';

import { formatDateDe, formatKg } from './format';
import { reserveFromRpe } from './plan-format';

/**
 * Anzeige-Texte für Woche, Verlauf und Eintrag (Etappe D; rein, getestet in history-format.test.ts). Keine Fachlogik:
 * Status, Summen und bester Satz kommen aus packages/core (weekLogSummary, exerciseHistory), hier wird nur formuliert.
 * Zahlen mit Komma, Einheiten für den Bildschirmleser ausgeschrieben (6.5).
 */

export interface A11yText {
  text: string;
  a11y: string;
}

/** Kilometer mit einer Nachkommastelle und Komma, z. B. 5000 m → „5,0“. */
export function kmText(distanceM: number): string {
  return (Math.round(distanceM / 100) / 10).toFixed(1).replace('.', ',');
}

/** Status eines Tages bzw. einer Einheit: Zeichen UND Wort (nie nur Farbe). */
export function dayStatusText(status: DayStatus): string {
  return t.week.status[status];
}

/** Zusammenfassung eines Eintrags im Verlauf: Kraft „12 Sätze“, Ausdauer „30 min · 5,0 km“. */
export function logSummaryText(log: SummaryLog): A11yText {
  if (log.kind === 'endurance') {
    const minutes = Math.floor((log.cardio_duration_s ?? 0) / 60);
    const km =
      log.cardio_distance_m !== null && log.cardio_distance_m > 0
        ? kmText(log.cardio_distance_m)
        : null;
    return { text: t.history.endurance(minutes, km), a11y: t.history.enduranceA11y(minutes, km) };
  }
  const text = t.history.sets(log.done_sets);
  return { text, a11y: text };
}

/** Bester Satz einer Übung an einem Tag (exerciseHistory, keine 1RM-Anzeige). */
export function bestSetText(best: BestSet | null): A11yText {
  if (best === null) return { text: t.history.best.none, a11y: t.history.best.none };
  switch (best.kind) {
    case 'weight': {
      const kg = formatKg(best.weightKg);
      return {
        text: t.history.best.weight(kg, best.reps),
        a11y: t.history.best.weightA11y(kg, best.reps),
      };
    }
    case 'time': {
      const text = t.history.best.time(best.durationS);
      return { text, a11y: text };
    }
    case 'reps': {
      const text = t.history.best.reps(best.reps);
      return { text, a11y: text };
    }
  }
}

/** Ein Satz im Eintrag: „Satz 1: 22,5 kg × 10“, Halten „Satz 1: 30 Sekunden“, sonst Wiederholungen. */
export function setLineText(set: SetLogRow, loadType: string): A11yText {
  let line: A11yText;
  if (set.weight_kg !== null && set.weight_kg > 0) {
    const kg = formatKg(set.weight_kg);
    line = {
      text: t.logEntry.setWeight(set.set_no, kg, set.reps),
      a11y: t.logEntry.setWeightA11y(set.set_no, kg, set.reps),
    };
  } else if (loadType === 'time' || (set.duration_s !== null && set.reps === null)) {
    const text = t.logEntry.setTime(set.set_no, set.duration_s);
    line = { text, a11y: text };
  } else {
    const text = t.logEntry.setReps(set.set_no, set.reps);
    line = { text, a11y: text };
  }
  const extras = [
    set.rpe !== null ? t.plan.reserve(reserveFromRpe(set.rpe)) : null,
    set.done ? null : t.logEntry.setOpen,
  ].filter((value): value is string => value !== null);
  if (extras.length === 0) return line;
  return {
    text: `${line.text} (${extras.join(', ')})`,
    a11y: `${line.a11y}, ${extras.join(', ')}`,
  };
}

/** Dauer der Ausdauer-Einheit: „0:45:00“ → als „45:00“ bzw. „1:05:00“, Bildschirmleser in Stunden/Minuten. */
export function cardioDurationText(durationS: number): A11yText {
  const hours = Math.floor(durationS / 3600);
  const minutes = Math.floor((durationS % 3600) / 60);
  return {
    text: t.logEntry.duration(formatDuration(durationS)),
    a11y: t.logEntry.durationA11y(hours, minutes),
  };
}

/** Belastung 0–10 mit Wort („7 – schwer“). */
export function effortText(value: number): string {
  return t.logEntry.effort(value, t.workout.effortWords[value] ?? '');
}

/** „05.10.2026 bis 11.10.2026“. */
export function weekRangeText(weekStart: string, weekEnd: string): string {
  return t.week.range(formatDateDe(weekStart), formatDateDe(weekEnd));
}
