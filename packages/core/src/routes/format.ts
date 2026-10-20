import type { EnduranceModality } from '../enums';
import { formatDuration, paceSecondsPerKm, speedKmh } from '../log/cardio';

/**
 * Anzeige-Werte einer Strecke (Etappe E4): Pace bzw. Geschwindigkeit, Distanz, Kilometerzeiten als Balken. Deutsch
 * (Komma), rein und deterministisch. Pace für Laufen und Gehen, km/h fürs Rad (Plan S1 „Pace bzw. km/h“).
 */

const comma = (text: string) => text.replace('.', ',');

/** „5:23 min/km“; „–“ ohne Wert. */
export function paceText(secondsPerKm: number | null): string {
  return secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0
    ? '–'
    : `${formatDuration(secondsPerKm)} min/km`;
}

/** „12,3 km/h“; „–“ ohne Wert. */
export function speedText(kmh: number | null): string {
  return kmh === null || !Number.isFinite(kmh) || kmh < 0 ? '–' : `${comma(kmh.toFixed(1))} km/h`;
}

/** Distanz in km mit zwei Nachkommastellen („5,23 km“; 0 m → „0,00 km“). */
export function distanceText(distanceM: number): string {
  const m = Number.isFinite(distanceM) && distanceM > 0 ? distanceM : 0;
  return `${comma((Math.floor(m / 10) / 100).toFixed(2))} km`;
}

/** Dauer „h:mm:ss“ bzw. „mm:ss“ (wie im Tagebuch). */
export function durationText(seconds: number): string {
  return formatDuration(seconds);
}

/** Rad = km/h, sonst Pace. */
export function usesSpeed(sport: EnduranceModality): boolean {
  return sport === 'bike';
}

/** Ø-Pace bzw. Ø-Geschwindigkeit über die Bewegungszeit als Text. */
export function averagePaceOrSpeedText(
  sport: EnduranceModality,
  movingS: number,
  distanceM: number | null,
): string {
  return usesSpeed(sport)
    ? speedText(speedKmh(movingS, distanceM))
    : paceText(paceSecondsPerKm(movingS, distanceM));
}

export interface SplitBar {
  /** Kilometer (1, 2, …). */
  readonly km: number;
  readonly seconds: number;
  /** Balkenlänge 0–1: der langsamste Kilometer = 1 (100 %). */
  readonly share: number;
}

/**
 * Kilometerzeiten als Balken (Plan E4 `splitBars`): langsamster Kilometer = 100 %. Leer ohne Zeiten; ungültige
 * Werte (nicht endlich, ≤ 0) ergeben einen leeren Balken (share 0), die Nummerierung bleibt.
 */
export function splitBars(kmSplits: readonly number[]): SplitBar[] {
  const ok = (s: number) => Number.isFinite(s) && s > 0;
  const max = Math.max(0, ...kmSplits.filter(ok));
  return kmSplits.map((s, i) => ({
    km: i + 1,
    seconds: ok(s) ? s : 0,
    share: ok(s) && max > 0 ? s / max : 0,
  }));
}
