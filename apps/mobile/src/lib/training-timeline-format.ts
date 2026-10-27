import {
  clockLabel,
  type ShoppingListChanges,
  type TimelineEntry,
  type TimelineExtra,
  type TimelineMeal,
  type TrainingAdaptation,
  type TrainingTimingNotice,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { portionText } from './food-log-format';

/**
 * Anzeige der Zeitleiste „Essen rund ums Training“ (Nährstoff-Timing 2, Abschnitt 7) – nur Texte, keine Regeln (die
 * stehen in packages/core `trainingDayTimeline`). Gramm erscheinen nur, wenn core sie liefert (`values` ≠ null).
 * Rein und getestet (training-timeline-format.test.ts).
 */
const T = t.trainingMeals;

/** Portion auf Viertel gerundet: „1 Portion“, „1½ Portionen“, „¾ Portion“. */
export function portionLabel(factor: number): string {
  return portionText(Math.max(0.25, Math.round(factor * 4) / 4));
}

/** Zeitfenster: vorher/Snack/Training „14:00–16:00“, nachher „bis 21:00“; ohne eigene Uhrzeit mit „ca.“. */
export function entryWindow(
  entry: Pick<TimelineEntry, 'kind' | 'fromMinutes' | 'toMinutes' | 'approx'>,
): string {
  const to = clockLabel(entry.toMinutes);
  if (entry.kind === 'post_meal') return T.clock(T.until(to), entry.approx);
  return T.clock(T.range(clockLabel(entry.fromMinutes), to), entry.approx);
}

/** „Hähnchen-Reis-Pfanne, 1 Portion“. */
export function mealLine(meal: Pick<TimelineMeal, 'titleDe' | 'factor'>): string {
  return T.mealLine(meal.titleDe, portionLabel(meal.factor));
}

/** „ca. 75 g KH · 35 g Eiweiß“ bzw. null (ohne Gramm). */
export function valuesLine(
  source: Pick<TimelineMeal | TimelineExtra, 'values'> | null,
): string | null {
  const v = source?.values ?? null;
  return v === null ? null : T.values(v.carbsG, v.proteinG);
}

/** Snack bzw. Beilage aus dem Bestand. */
export function extraLine(entry: Pick<TimelineEntry, 'extra' | 'extraKind'>): string | null {
  if (entry.extra === null) return null;
  return entry.extraKind === 'side'
    ? T.sideLine(entry.extra.titleDe)
    : T.snackLine(entry.extra.titleDe);
}

/** „Kraft, 60 min“. */
export function sessionLine(entry: Pick<TimelineEntry, 'session'>): string | null {
  const s = entry.session;
  if (s === null) return null;
  return T.sessionLine(T.sessionKind[s.kind], Math.round(s.minutes));
}

/** Richtwert unterwegs (ab 90 min) – Gramm nur, wenn core sie liefert. */
export function fuelingLines(entry: Pick<TimelineEntry, 'session'>): string[] {
  const f = entry.session?.fueling ?? null;
  if (f === null) return [];
  return [
    f.carbsGPerHour === null
      ? T.fuelingGeneral
      : T.fuelingGrams(f.carbsGPerHour.min, f.carbsGPerHour.max),
    T.fuelingDrink(f.drinkMlPerHour.min, f.drinkMlPerHour.max),
    ...(f.testFirst ? [T.fuelingTest] : []),
  ];
}

/** Ansage einer Zeile für Bildschirmleser (Zeit, Art, Gericht, Werte). */
export function entryA11y(entry: TimelineEntry): string {
  return [
    entryWindow(entry),
    T.kindTitle(entry.kind),
    entry.meal !== null ? mealLine(entry.meal) : null,
    sessionLine(entry),
    valuesLine(entry.meal),
    entry.meal !== null ? T.status(entry.meal.status) : null,
    extraLine(entry),
  ]
    .filter((x): x is string => x !== null && x !== '')
    .join(', ');
}

/** Text des (einzigen) Timing-Hinweises des Tages. */
export function timingNoticeText(notice: TrainingTimingNotice, showNumbers: boolean): string {
  return T.notice(notice.code, notice.titleDe, notice.extraTitleDe, showNumbers);
}

/** Zeilen der Rückmeldung „Mahlzeiten an dein Training angepasst“ (Tausche, Einkaufsliste). */
export function adjustmentLines(
  adaptation: Pick<TrainingAdaptation, 'changes'>,
  shopping: ShoppingListChanges | null,
): string[] {
  const lines: string[] = [T.adjusted.text];
  if (adaptation.changes.length === 0) lines.push(T.adjusted.onlyPortions);
  else {
    lines.push(T.adjusted.changes(adaptation.changes.length));
    adaptation.changes.forEach((c) => lines.push(T.adjusted.change(c.fromTitleDe, c.toTitleDe)));
  }
  if (shopping !== null) {
    const detail = T.adjusted.shoppingDetail(
      shopping.added.length,
      shopping.removed.length,
      shopping.changed.length,
    );
    if (detail !== '') {
      lines.push(`${T.adjusted.shopping} ${detail}. ${T.adjusted.checkedKept}`);
    }
  }
  return lines;
}

/** Uhrzeit der Einheit für den Training-Reiter: „18:30“ bzw. „ca. 17:30 (Standard)“. */
export function sessionTimeText(minutes: number, approx: boolean): string {
  return T.time.value(clockLabel(minutes), approx);
}
