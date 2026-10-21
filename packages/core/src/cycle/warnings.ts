import { CYCLE_RULES } from '../constants';
import { addDays, daysBetween } from '../dates';
import { derivePeriods, isAnyBleeding, isRangeComplete, normalizeEntries } from './periods';
import type { CycleDismissibleCode, CycleEntry, CycleSettings, CycleStatus } from './schemas';

/**
 * Warnsignale mit Arzt-Hinweis (docs/PLAN-PHASE-9.md 3.4) – nur Codes, nie Text (Texte: texts-de.ts). Karten im
 * Zyklus-Bildschirm, nie als Benachrichtigung. Warnungen W1/W2 nur bei ausreichenden Daten; nie eine Entwarnung.
 * Flag `cycle_warnings` aus → leere Liste (die App zeigt dann den statischen Ratgeber).
 * Nichts davon ändert Kalorien oder Plan (ZY-G12).
 */
export const CYCLE_WARNING_CODES = [
  'W1',
  'W1b',
  'W1c',
  'W2',
  'W3',
  'W3_hormonal',
  'W4',
  'W4_hormonal',
  'W5',
  'W6',
  'W8',
  'mood_support',
] as const satisfies readonly CycleDismissibleCode[];
export type CycleWarningCode = (typeof CYCLE_WARNING_CODES)[number];

export interface CycleWarningInput {
  readonly today: string;
  readonly status: CycleStatus | null;
  /** Alter in vollendeten Jahren (Längen-Grenzen unter 18). */
  readonly ageYears: number | null;
  readonly entries: readonly CycleEntry[];
  readonly settings: Pick<
    CycleSettings,
    'lastPeriodAtStart' | 'enabledOn' | 'noBleedingConfirmedUntil' | 'dismissed'
  >;
  /** Ziel Fettverlust (Haupt- oder Nebenziel). */
  readonly fatLossGoal: boolean;
  /** Geplante Einheiten je Woche (Kraft + Ausdauer). */
  readonly sessionsPerWeek: number;
  /** Flag `cycle_warnings` (Standard an). */
  readonly warningsEnabled: boolean;
}

const MISSED_PERIOD_STATUSES: ReadonlySet<CycleStatus> = new Set(['natural']);
const LOW_ENERGY_ONLY_STATUSES: ReadonlySet<CycleStatus> = new Set([
  'hormonal_contraception',
  'breastfeeding',
  'unspecified',
]);
/** W3/W4/W5: alle außer schwanger (pausiert) und nach den Wechseljahren (dort gilt W6 für jede Blutung). */
const BLEEDING_WARNING_STATUSES: ReadonlySet<CycleStatus> = new Set([
  'natural',
  'hormonal_contraception',
  'perimenopause',
  'breastfeeding',
  'unspecified',
]);

/** Alle zutreffenden Warnungen (vor dem Ausblenden weggetippter Karten). */
export function activeCycleWarnings(input: CycleWarningInput): CycleWarningCode[] {
  const { status, today } = input;
  if (!input.warningsEnabled || status === null || status === 'pregnant') return [];
  const windowStart = addDays(today, -CYCLE_RULES.analysisWindowDays);
  const entries = normalizeEntries(input.entries).filter(
    (e) => e.date >= windowStart && e.date <= today,
  );
  const confirmations = { noBleedingConfirmedUntil: input.settings.noBleedingConfirmedUntil };
  const derived = derivePeriods(entries, confirmations, today);
  const codes: CycleWarningCode[] = [];

  const lowEnergy = lowEnergyDays(entries, today) >= CYCLE_RULES.lowEnergy.minDays;
  const muchTraining =
    input.fatLossGoal || input.sessionsPerWeek >= CYCLE_RULES.manySessionsPerWeek;

  // W1 / W1b – Periode bleibt ≥ 90 Tage aus (nur natürlicher Zyklus, nur mit ausreichenden Daten).
  if (MISSED_PERIOD_STATUSES.has(status) && missedPeriod(input, entries, derived.lastPeriodStart)) {
    codes.push('W1');
    if (muchTraining || lowEnergy) codes.push('W1b');
  }
  // W1c – viel Training und oft wenig Energie, ohne Ausbleiben-Kriterium (Pille verdeckt das Ausbleiben).
  if (LOW_ENERGY_ONLY_STATUSES.has(status) && lowEnergy && muchTraining) codes.push('W1c');

  // W2 – Zykluslänge auffällig in 2 der letzten 3 vollständigen Zyklen (nur natürlicher Zyklus).
  if (status === 'natural') {
    const range =
      input.ageYears !== null && input.ageYears < CYCLE_RULES.cycleLength.adultFromAge
        ? CYCLE_RULES.cycleLength.under18
        : CYCLE_RULES.cycleLength.adult;
    const lengths = derived.cycles
      .filter((c) => c.length !== null && c.complete)
      .slice(-CYCLE_RULES.cycleLength.windowCycles)
      .map((c) => c.length as number);
    const outOfRange = lengths.filter((l) => l < range.min || l > range.max).length;
    if (outOfRange >= CYCLE_RULES.cycleLength.minOutOfRange) codes.push('W2');
  }

  const recentFrom = addDays(today, -CYCLE_RULES.recentPeriodDays);
  const recentCycles = derived.cycles.filter((c) => c.start >= recentFrom);
  const hormonal = status === 'hormonal_contraception';

  if (BLEEDING_WARNING_STATUSES.has(status)) {
    // W3 – Periode länger als 8 Tage.
    if (recentCycles.some((c) => c.periodDays > CYCLE_RULES.longPeriodDays)) {
      codes.push(hormonal ? 'W3_hormonal' : 'W3');
    }
    // W4 – „stark“ an ≥ 3 Tagen eines Zyklus oder in 2 Zyklen nacheinander.
    const heavyMany = recentCycles.some((c) => c.heavyDays >= CYCLE_RULES.heavyDaysPerCycle);
    const heavyConsecutive = consecutive(recentCycles, (c) => c.heavyDays >= 1);
    if (heavyMany || heavyConsecutive) codes.push(hormonal ? 'W4_hormonal' : 'W4');
    // W5 – starke Unterleibsschmerzen an ≥ 2 Tagen in 2 Zyklen nacheinander.
    if (
      consecutive(recentCycles, (c) => c.crampsStrongDays >= CYCLE_RULES.crampsStrongDaysPerCycle)
    ) {
      codes.push('W5');
    }
  }

  // W6 – jede Blutung (auch Schmierblutung) nach den Wechseljahren.
  if (status === 'postmenopause') {
    const from = addDays(today, -CYCLE_RULES.postmenopauseBleedingWindowDays);
    if (entries.some((e) => e.date >= from && isAnyBleeding(e.payload.bleeding))) codes.push('W6');
  }

  // W8 (Vorschlag zur Fachprüfung) – Blutung außerhalb der Periode in 2 Zyklen nacheinander.
  if (status === 'natural' && consecutive(recentCycles, (c) => c.intermenstrualDays >= 1)) {
    codes.push('W8');
  }

  // Stimmung gedrückt – stark an ≥ 3 von 7 Tagen: seelischer Teil von W7 als Karte (alle Status).
  const moodFrom = addDays(today, -(CYCLE_RULES.lowMood.windowDays - 1));
  const lowMoodDays = entries.filter(
    (e) => e.date >= moodFrom && e.payload.symptoms?.low_mood === 'strong',
  ).length;
  if (lowMoodDays >= CYCLE_RULES.lowMood.minDays) codes.push('mood_support');

  return codes;
}

/**
 * Warnungen für die Anzeige: weggetippte Karten bleiben 30 Tage aus und erscheinen bei Fortbestehen erneut.
 */
export function cycleWarnings(input: CycleWarningInput): CycleWarningCode[] {
  return activeCycleWarnings(input).filter(
    (code) => !isDismissed(input.settings.dismissed[code], input.today),
  );
}

/** Weggetippt und noch keine 30 Tage her? */
export function isDismissed(dismissedOn: string | undefined, today: string): boolean {
  return (
    dismissedOn !== undefined && daysBetween(dismissedOn, today) < CYCLE_RULES.warningRepeatDays
  );
}

/** Tage mit Energie ≤ 2 in den letzten 14 Tagen (einschließlich heute). */
export function lowEnergyDays(entries: readonly CycleEntry[], today: string): number {
  const from = addDays(today, -(CYCLE_RULES.lowEnergy.windowDays - 1));
  return entries.filter(
    (e) =>
      e.date >= from &&
      e.date <= today &&
      e.payload.energy !== null &&
      e.payload.energy !== undefined &&
      e.payload.energy <= CYCLE_RULES.lowEnergy.maxEnergy,
  ).length;
}

/**
 * W1: ≥ 90 Tage seit dem letzten erfassten Periodenbeginn mit vollständigen Daten – oder die Einschalt-Antwort
 * „mehr als 3 Monate“, solange seit dem Einschalten keine Periode erfasst ist. Ohne Periodenbeginn zählt bei
 * „weniger als 1 Monat“ der Tag des Einschaltens als Bezug (sonst schweigt die App).
 */
function missedPeriod(
  input: CycleWarningInput,
  entries: readonly CycleEntry[],
  lastPeriodStart: string | null,
): boolean {
  const { enabledOn, lastPeriodAtStart, noBleedingConfirmedUntil } = input.settings;
  const periodSinceEnabled =
    lastPeriodStart !== null && (enabledOn === null || lastPeriodStart >= enabledOn);
  if (!periodSinceEnabled && lastPeriodAtStart === 'over_3_months') return true;
  const reference =
    lastPeriodStart ?? (lastPeriodAtStart === 'under_1_month' ? enabledOn : null) ?? null;
  if (reference === null) return false;
  if (daysBetween(reference, input.today) < CYCLE_RULES.amenorrheaDays) return false;
  return isRangeComplete(entries, reference, input.today, { noBleedingConfirmedUntil });
}

/** Zwei aufeinanderfolgende Zyklen (in der Liste) erfüllen die Bedingung. */
function consecutive<T>(cycles: readonly T[], predicate: (cycle: T) => boolean): boolean {
  for (let i = 1; i < cycles.length; i += 1) {
    if (predicate(cycles[i - 1] as T) && predicate(cycles[i] as T)) return true;
  }
  return false;
}
