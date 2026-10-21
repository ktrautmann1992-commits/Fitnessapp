import {
  addDays,
  type DailyMetricRow,
  type WearableOrigin,
  WEARABLE_ORIGINS,
} from '@fitnessapp/core';

import { t } from '@/i18n';

import { formatDateDe } from './format';

/**
 * Anzeige der Smartwatch-Daten (Phase 8). Nur Formatieren, keine Regeln. Rein, getestet (wearable-format.test.ts).
 */

const W = t.wearables;

/** Zeitpunkt in Gerätezeit, z. B. „21.10.2026, 13:05“. */
export function dateTimeText(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}, ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Ganze Zahl mit Tausenderpunkt („8.123“). */
export function thousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function originLabel(origin: string): string {
  return (WEARABLE_ORIGINS as readonly string[]).includes(origin)
    ? W.origins[origin as WearableOrigin]
    : W.origins.other;
}

/** Eine Zeile Tageswerte („Schritte · Schlaf · Ruhepuls“), leer = keine Werte. */
export function dailyParts(
  row: Pick<DailyMetricRow, 'steps' | 'sleep_min' | 'resting_hr_bpm'>,
): string {
  const parts: string[] = [];
  if (row.steps !== null) parts.push(W.steps(thousands(row.steps)));
  if (row.sleep_min !== null)
    parts.push(W.sleep(Math.floor(row.sleep_min / 60), row.sleep_min % 60));
  if (row.resting_hr_bpm !== null) parts.push(W.restingHr(row.resting_hr_bpm));
  return parts.join(' · ');
}

/** Tageswerte der letzten 7 Tage bis `today` (neueste zuerst), Datum als „21.10.2026“. */
export function recentDailyLines(
  rows: readonly DailyMetricRow[],
  today: string,
): { day: string; text: string }[] {
  const from = addDays(today, -6);
  return rows
    .filter((r) => r.day >= from && r.day <= today)
    .sort((a, b) => b.day.localeCompare(a.day))
    .map((r) => ({ day: r.day, text: W.dailyRow(formatDateDe(r.day), dailyParts(r)) }))
    .filter((line) => line.text.length > 0);
}

/** Sekunden je Zone → ganze Minuten (gerundet). */
export function zoneMinutes(zoneS: readonly number[]): number[] {
  return zoneS.map((s) => Math.round(Math.max(0, s) / 60));
}
