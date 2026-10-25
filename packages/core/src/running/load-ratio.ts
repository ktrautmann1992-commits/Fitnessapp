import { LOAD_RATIO, MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION } from '../constants';
import { addDays, daysBetween } from '../dates';
import { sessionTrainingLoad, type TrainingLoadInput } from '../sports/load';

/**
 * Belastungs-Ampel (Lauf-Paket 2, docs/PLAN-LAUF-PAKET-2.md 3): akute (7 Tage) zu chronischer (28 Tage ÷ 4) Belastung
 * aus den Belastungspunkten der Einheiten (SPORT_LOAD, Session-RPE – dieselbe Zahl wie „Sportarten diese Woche“),
 * dazu die 10-%-Regel für die Lauf-Kilometer. Nur Orientierung, keine medizinische Aussage. Rein.
 */

export interface LoadRatioLog extends TrainingLoadInput {
  /** Tag der Einheit (JJJJ-MM-TT). */
  readonly performed_on: string;
}

export interface RunVolumeEntry {
  readonly day: string;
  readonly distanceM: number | null;
}

export type LoadLevel = 'green' | 'yellow' | 'red';

export type LoadRatioResult =
  | {
      readonly kind: 'insufficient';
      /** Warum keine Ampel: zu kurzes Tagebuch bzw. zu wenig Belastung in den letzten 4 Wochen. */
      readonly reason: 'too_little_history' | 'too_little_load';
    }
  | {
      readonly kind: 'ok';
      readonly level: LoadLevel;
      /** Verhältnis akut : chronisch, auf 2 Stellen gerundet. */
      readonly ratio: number;
      /** Belastungspunkte der letzten 7 Tage. */
      readonly acuteLoad: number;
      /** Wochen-Mittel der letzten 28 Tage (gerundet). */
      readonly chronicWeeklyLoad: number;
      /** true = deutlich weniger als gewohnt (Erholung). */
      readonly low: boolean;
      /** Lauf-km der letzten 7 Tage vs. der 7 Tage davor (null ohne Vergleich). */
      readonly volume: RunVolumeChange | null;
      /** true = die 10-%-Regel hat Grün zu Gelb gemacht. */
      readonly volumeRaised: boolean;
    };

export interface RunVolumeChange {
  readonly currentKm: number;
  readonly previousKm: number;
  /** Steigerung als Anteil (0,25 = +25 %), gerundet auf 2 Stellen. */
  readonly increase: number;
  /** Über MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION. */
  readonly aboveRule: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Summe der Belastungspunkte von `from` bis `to` (einschließlich). */
function loadBetween(logs: readonly LoadRatioLog[], from: string, to: string): number {
  return logs
    .filter((l) => l.performed_on >= from && l.performed_on <= to)
    .reduce((sum, l) => sum + (sessionTrainingLoad(l) ?? 0), 0);
}

/**
 * Lauf-Kilometer der letzten 7 Tage (bis einschließlich `today`) gegenüber den 7 Tagen davor. Ohne Vorwoche
 * (unter LOAD_RATIO.volumeMinPreviousKm) → null: Von fast null aus ist jede Steigerung „über 10 %“.
 */
export function runVolumeChange(
  runs: readonly RunVolumeEntry[],
  today: string,
): RunVolumeChange | null {
  const sum = (from: string, to: string) =>
    runs
      .filter((r) => r.day >= from && r.day <= to)
      .reduce(
        (s, r) => s + (r.distanceM !== null && Number.isFinite(r.distanceM) ? r.distanceM : 0),
        0,
      ) / 1000;
  const days = LOAD_RATIO.acuteDays;
  const currentKm = sum(addDays(today, -(days - 1)), today);
  const previousKm = sum(addDays(today, -(2 * days - 1)), addDays(today, -days));
  if (previousKm < LOAD_RATIO.volumeMinPreviousKm) return null;
  const increase = (currentKm - previousKm) / previousKm;
  return {
    currentKm: Math.round(currentKm * 10) / 10,
    previousKm: Math.round(previousKm * 10) / 10,
    increase: round2(increase),
    aboveRule: increase > MAX_WEEKLY_ENDURANCE_VOLUME_INCREASE_FRACTION + 1e-9,
  };
}

/**
 * Ampel: Tagebuch kürzer als LOAD_RATIO.minHistoryDays (erste Einheit) bzw. Wochen-Mittel unter
 * minChronicWeeklyLoad → „zu wenig Daten“. Sonst Verhältnis akut : chronisch: bis greenMax grün, bis yellowMax gelb,
 * darüber rot; grün wird gelb, wenn die Lauf-Kilometer mehr als 10 % gestiegen sind.
 */
export function loadRatio(input: {
  readonly logs: readonly LoadRatioLog[];
  readonly runs: readonly RunVolumeEntry[];
  readonly today: string;
}): LoadRatioResult {
  const { today } = input;
  const past = input.logs.filter((l) => l.performed_on <= today);
  const first = past.reduce<string | null>(
    (min, l) => (min === null || l.performed_on < min ? l.performed_on : min),
    null,
  );
  if (first === null || daysBetween(first, today) + 1 < LOAD_RATIO.minHistoryDays) {
    return { kind: 'insufficient', reason: 'too_little_history' };
  }
  const acute = loadBetween(past, addDays(today, -(LOAD_RATIO.acuteDays - 1)), today);
  const chronicTotal = loadBetween(past, addDays(today, -(LOAD_RATIO.chronicDays - 1)), today);
  const chronicWeekly = chronicTotal / (LOAD_RATIO.chronicDays / LOAD_RATIO.acuteDays);
  if (chronicWeekly < LOAD_RATIO.minChronicWeeklyLoad) {
    return { kind: 'insufficient', reason: 'too_little_load' };
  }
  const ratio = acute / chronicWeekly;
  const base: LoadLevel =
    ratio > LOAD_RATIO.yellowMax ? 'red' : ratio > LOAD_RATIO.greenMax ? 'yellow' : 'green';
  const volume = runVolumeChange(input.runs, today);
  const volumeRaised = base === 'green' && volume?.aboveRule === true;
  return {
    kind: 'ok',
    level: volumeRaised ? 'yellow' : base,
    ratio: round2(ratio),
    acuteLoad: acute,
    chronicWeeklyLoad: Math.round(chronicWeekly),
    low: ratio < LOAD_RATIO.lowBelow,
    volume,
    volumeRaised,
  };
}
