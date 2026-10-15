import type {
  DayEvaluation,
  DayEvaluationWithoutNumbers,
  IntakeTone,
  WeekEvaluation,
  WeekFoodWithNumbers,
  WeekFoodWithoutNumbers,
  WeekTraining,
} from '@fitnessapp/core';

import { t } from '../i18n';
import { kmText } from './history-format';
import { formatKcal } from './nutrition-format';
import { dayLabel } from './plan-format';

/**
 * Formulierung der Wochenauswertung (Etappe A3): kleine Tagesbalken, Zeilen für Essen und Training aus dem Ergebnis von
 * `weekEvaluation()` (packages/core). Keine Grenzen, keine Regeln – nur Anzeige. Rein, getestet.
 */

export interface WeekDayView {
  readonly date: string;
  /** Kurztext mit Zeichen (Farbe nie allein). */
  readonly short: string;
  /** Farbe des Füllstands; null = kein Balken (ohne Zahlen, nichts eingetragen, künftig, kein Ziel). */
  readonly tone: IntakeTone | null;
  /** Füllstand und Zielmarke in Prozent der Skala des Tages; null ohne Balken. */
  readonly fillPct: number | null;
  readonly targetPct: number | null;
  readonly a11y: string;
}

const pct = (value: number, max: number) =>
  max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));

/** Ein Tag der Woche als kleiner Balken mit Kurztext – gleiche Zone wie „Dein Tag“. */
export function weekDayView(day: DayEvaluation | DayEvaluationWithoutNumbers): WeekDayView {
  const s = t.weekEval.dayShort;
  const intake = day.food.intake;
  let short: string;
  let tone: IntakeTone | null = null;
  let fillPct: number | null = null;
  let targetPct: number | null = null;
  if (!day.food.available) short = s.unavailable;
  else if (day.timing === 'future') short = s.future;
  else if (intake.kind === 'hidden') {
    // Ohne Zahlen: nur Anzahlen, keine Farbe, keine Bewertung (2.3).
    const meals = day.food.meals;
    short =
      meals !== null
        ? t.weekEval.dayShortMeals(meals.eaten, meals.planned)
        : day.food.entryCount > 0
          ? s.hidden_entries
          : s.hidden_none;
  } else if (intake.kind === 'bar') {
    short = s[intake.zone];
    tone = intake.tone;
    fillPct = pct(intake.eatenKcal, intake.scale.maxKcal);
    targetPct = pct(intake.targetKcal, intake.scale.maxKcal);
  } else if (intake.kind === 'no_entries') {
    short = day.food.entryCount > 0 ? s.no_values : s.no_entries;
  } else if (intake.kind === 'no_target') short = s.no_target;
  else short = s.future;
  return {
    date: day.date,
    short,
    tone,
    fillPct,
    targetPct,
    a11y: t.weekEval.dayA11y(dayLabel(day.date), short.replace(/^[^\p{L}\d]+\s*/u, '')),
  };
}

const ZONE_ORDER = [
  'in_range',
  'below_target',
  'above_target',
  'below_floor',
  'well_above',
] as const;

/** Zeilen des Essensteils mit Zahlen: „An 5 Tagen eingetragen.“, „Davon …“, Durchschnitt. */
export function weekFoodLines(food: WeekFoodWithNumbers): {
  readonly entryDays: string;
  readonly zones: string | null;
  readonly average: { readonly text: string; readonly a11y: string } | null;
} {
  const parts = ZONE_ORDER.filter((zone) => food.zoneCounts[zone] > 0).map((zone) =>
    t.weekEval.zoneCount[zone](food.zoneCounts[zone]),
  );
  if (food.withoutValueDays > 0)
    parts.push(t.weekEval.zoneCount.without_value(food.withoutValueDays));
  const average =
    food.average === null
      ? null
      : (() => {
          const eaten = formatKcal(Math.round(food.average.eatenKcal));
          const target = formatKcal(Math.round(food.average.targetKcal));
          return {
            text: t.weekEval.average(eaten, target),
            a11y: t.weekEval.averageA11y(eaten, target),
          };
        })();
  return {
    entryDays: t.weekEval.entryDays(food.entryDays),
    zones: parts.length === 0 ? null : t.weekEval.zoneSummary(parts),
    average,
  };
}

/** Zeilen des Essensteils ohne Zahlen: nur Anzahlen. */
export function weekFoodLinesWithoutNumbers(food: WeekFoodWithoutNumbers): readonly string[] {
  return [
    t.weekEval.entryDays(food.entryDays),
    ...(food.meals === null ? [] : [t.weekEval.meals(food.meals.eaten, food.meals.planned)]),
  ];
}

export interface TrainingLine {
  readonly text: string;
  readonly a11y: string;
}

/** Summen des Trainings: Einheiten, Kraft-Sätze, Ausdauer-Minuten, Strecke (nur was in der Woche vorkommt). */
export function weekTrainingLines(training: WeekTraining): readonly TrainingLine[] {
  const lines: TrainingLine[] = [];
  const sessions = t.weekEval.sessions(training.sessions.done, training.sessions.planned);
  lines.push({ text: sessions, a11y: sessions });
  if (training.strengthSets.planned > 0 || training.strengthSets.fulfilled > 0) {
    const { fulfilled, planned } = training.strengthSets;
    lines.push({
      text: t.weekEval.sets(fulfilled, planned),
      a11y: t.weekEval.setsA11y(fulfilled, planned),
    });
  }
  if (training.enduranceMinutes.planned > 0 || training.enduranceMinutes.done > 0) {
    const { done, planned } = training.enduranceMinutes;
    lines.push({
      text: t.weekEval.minutes(done, planned),
      a11y: t.weekEval.minutesA11y(done, planned),
    });
  }
  if (training.distanceM > 0) {
    const km = kmText(training.distanceM);
    lines.push({ text: t.weekEval.km(km), a11y: t.weekEval.kmA11y(km) });
  }
  return lines;
}

/** Freie Einheiten: „2 freie Einheiten · 4 Sätze · 30 min · 5,0 km“. */
export function weekFreeLine(training: WeekTraining): string | null {
  const f = training.freeTotals;
  if (f.sessions === 0) return null;
  return [
    t.weekEval.freeSummary(f.sessions),
    f.strengthSets > 0 ? t.weekEval.freeSets(f.strengthSets) : null,
    f.enduranceMinutes > 0 ? t.weekEval.freeMinutes(f.enduranceMinutes) : null,
    f.distanceM > 0 ? `${kmText(f.distanceM)} km` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** Hat die Woche überhaupt Training (geplant oder eingetragen)? */
export function weekHasTraining(evaluation: Pick<WeekEvaluation, 'training'>): boolean {
  return evaluation.training.items.length > 0 || evaluation.training.free.length > 0;
}
