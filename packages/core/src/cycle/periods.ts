import { CYCLE_RULES } from '../constants';
import { addDays, daysBetween } from '../dates';
import type { CycleBleeding, CycleEntry } from './schemas';

/**
 * Ableitungen aus den Tages-Checks (docs/PLAN-PHASE-9.md 3.2) – nur gerechnet, nie gespeichert. Keine Vorhersage,
 * keine Phasen-Namen.
 *
 * - Periodenbeginn: erster Tag mit Blutung „leicht“ oder stärker nach mindestens 5 Tagen ohne Blutung (Schmierblutung
 *   und Tage ohne Eintrag zählen als „ohne“). Der erste Blutungstag der Daten gilt als Beginn.
 * - Periode: zusammenhängende Blutungstage (leicht oder stärker), eine Lücke von höchstens 1 Tag wird überbrückt.
 * - Zykluslänge: Abstand zweier Periodenbeginne; „vollständig“ nur bei Einträgen an ≥ 50 % der Tage dazwischen oder
 *   wenn die Rückfrage „keine Blutung“ die Lücke bestätigt.
 * - Blutung außerhalb einer Periode (auch Schmierblutung): für den Vorschlag W8 gezählt.
 */

export interface CyclePeriod {
  readonly start: string;
  /** Letzter Blutungstag (leicht oder stärker). */
  readonly end: string;
  readonly days: number;
}

export interface CycleSpan {
  /** Periodenbeginn, mit dem dieser Zyklus anfängt. */
  readonly start: string;
  /** Nächster Periodenbeginn (exklusiv); null = laufender Zyklus. */
  readonly nextStart: string | null;
  /** Länge in Tagen (nur abgeschlossene Zyklen). */
  readonly length: number | null;
  /** Genug Einträge für Längen- und Ausbleiben-Regeln? */
  readonly complete: boolean;
  /** Tage mit Blutung „stark“ in diesem Zyklus. */
  readonly heavyDays: number;
  /** Tage mit starken Unterleibsschmerzen in diesem Zyklus. */
  readonly crampsStrongDays: number;
  /** Tage mit Blutung (auch Schmierblutung) außerhalb der Periode. */
  readonly intermenstrualDays: number;
  /** Dauer der Periode, mit der der Zyklus beginnt. */
  readonly periodDays: number;
}

export interface DerivedPeriods {
  readonly periods: readonly CyclePeriod[];
  /** Zyklen in zeitlicher Reihenfolge; der letzte ist der laufende (nextStart null). */
  readonly cycles: readonly CycleSpan[];
  readonly lastPeriodStart: string | null;
  /** Letzter Tag mit Blutung „leicht“ oder stärker. */
  readonly lastBleedingDay: string | null;
}

export interface PeriodConfirmations {
  /** Rückfrage bestätigt: bis zu diesem Tag (einschließlich) gab es keine Blutung. */
  readonly noBleedingConfirmedUntil: string | null;
}

const PERIOD_LEVELS: ReadonlySet<CycleBleeding> = new Set(['light', 'medium', 'heavy']);

/** Zählt der Tag als Periodenblutung (leicht oder stärker)? */
export function isPeriodBleeding(level: CycleBleeding | null | undefined): boolean {
  return level !== null && level !== undefined && PERIOD_LEVELS.has(level);
}

/** Irgendeine Blutung (auch Schmierblutung)? */
export function isAnyBleeding(level: CycleBleeding | null | undefined): boolean {
  return level !== null && level !== undefined && level !== 'none';
}

/** Einträge nach Datum sortiert, je Tag höchstens einer (der letzte gewinnt). */
export function normalizeEntries(entries: readonly CycleEntry[]): CycleEntry[] {
  const byDate = new Map<string, CycleEntry>();
  for (const entry of entries) byDate.set(entry.date, entry);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Perioden aus den Einträgen (Beginn nach ≥ 5 Tagen ohne Blutung, Lücke ≤ 1 Tag überbrückt). */
export function derivePeriodList(entries: readonly CycleEntry[]): CyclePeriod[] {
  const bleedingDays = normalizeEntries(entries)
    .filter((e) => isPeriodBleeding(e.payload.bleeding))
    .map((e) => e.date);
  const periods: CyclePeriod[] = [];
  let current: { start: string; end: string } | null = null;
  for (const day of bleedingDays) {
    if (current === null) {
      current = { start: day, end: day };
      continue;
    }
    const gap = daysBetween(current.end, day) - 1;
    if (gap <= CYCLE_RULES.periodGapBridgeDays) {
      current = { start: current.start, end: day };
    } else if (gap >= CYCLE_RULES.periodStartMinDryDays) {
      periods.push(toPeriod(current));
      current = { start: day, end: day };
    }
    // Lücke von 2–4 Tagen: weder Teil der Periode noch neuer Beginn (Blutung außerhalb der Periode, W8).
  }
  if (current !== null) periods.push(toPeriod(current));
  return periods;
}

function toPeriod(span: { start: string; end: string }): CyclePeriod {
  return { start: span.start, end: span.end, days: daysBetween(span.start, span.end) + 1 };
}

/**
 * Perioden, Zyklen und Kennzahlen je Zyklus. `today` begrenzt den laufenden Zyklus (Vollständigkeit bis heute).
 */
export function derivePeriods(
  entries: readonly CycleEntry[],
  confirmations: PeriodConfirmations,
  today: string,
): DerivedPeriods {
  const sorted = normalizeEntries(entries).filter((e) => e.date <= today);
  const periods = derivePeriodList(sorted);
  const cycles: CycleSpan[] = periods.map((period, index) => {
    const next = periods[index + 1] ?? null;
    const until = next ? addDays(next.start, -1) : today;
    const inCycle = sorted.filter((e) => e.date >= period.start && e.date <= until);
    return {
      start: period.start,
      nextStart: next?.start ?? null,
      length: next ? daysBetween(period.start, next.start) : null,
      complete: isRangeComplete(sorted, period.start, until, confirmations),
      heavyDays: inCycle.filter((e) => e.payload.bleeding === 'heavy').length,
      crampsStrongDays: inCycle.filter((e) => e.payload.symptoms?.cramps === 'strong').length,
      intermenstrualDays: inCycle.filter(
        (e) => isAnyBleeding(e.payload.bleeding) && (e.date < period.start || e.date > period.end),
      ).length,
      periodDays: period.days,
    };
  });
  const lastBleeding = [...sorted].reverse().find((e) => isPeriodBleeding(e.payload.bleeding));
  return {
    periods,
    cycles,
    lastPeriodStart: periods.at(-1)?.start ?? null,
    lastBleedingDay: lastBleeding?.date ?? null,
  };
}

/**
 * Genug Daten im Zeitraum [from, to]? Einträge an ≥ 50 % der Tage – oder die Rückfrage hat „keine Blutung“ bis
 * mindestens `to` bestätigt (bestätigte Tage zählen als erfasst).
 */
export function isRangeComplete(
  sortedEntries: readonly CycleEntry[],
  from: string,
  to: string,
  confirmations: PeriodConfirmations,
): boolean {
  const total = daysBetween(from, to) + 1;
  if (total <= 0) return false;
  const confirmed = confirmations.noBleedingConfirmedUntil;
  if (confirmed !== null && confirmed >= to) return true;
  const covered = sortedEntries.filter((e) => e.date >= from && e.date <= to).length;
  return covered / total >= CYCLE_RULES.completenessMinShare;
}

/**
 * „Tag X seit Periodenbeginn“ (nur im Zyklus-Bildschirm): 1 = Tag des Beginns. null ohne erfassten Beginn. Keine
 * Phasen-Namen, keine Prognose.
 */
export function dayOfCycle(lastPeriodStart: string | null, today: string): number | null {
  if (lastPeriodStart === null || lastPeriodStart > today) return null;
  return daysBetween(lastPeriodStart, today) + 1;
}

/**
 * Rückfrage „Hattest du seit X Tagen keine Blutung?“ (nur Status natürlich): nach ≥ 45 Tagen ohne Blutung seit der
 * letzten Periode (bzw. seit dem Einschalten), solange die Rückfrage diese Tage noch nicht bestätigt hat.
 * Ergebnis: Anzahl der Tage oder null (keine Rückfrage).
 */
export function longGapQuestionDays(input: {
  readonly lastBleedingDay: string | null;
  readonly enabledOn: string | null;
  readonly noBleedingConfirmedUntil: string | null;
  readonly today: string;
}): number | null {
  const since = input.lastBleedingDay ?? input.enabledOn;
  if (since === null) return null;
  const days = daysBetween(since, input.today);
  if (days < CYCLE_RULES.longGapQuestionDays) return null;
  const confirmed = input.noBleedingConfirmedUntil;
  // Schon bestätigt: erst nach weiteren 45 Tagen wieder fragen.
  if (confirmed !== null && daysBetween(confirmed, input.today) < CYCLE_RULES.longGapQuestionDays) {
    return null;
  }
  return days;
}
