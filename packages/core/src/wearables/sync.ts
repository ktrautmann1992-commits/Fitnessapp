import { WEARABLE_SYNC } from '../constants';
import { addDays } from '../dates';

/**
 * Zeitpunkt und Zeitraum des Abgleichs (W8-7, W8-8, docs/PLAN-PHASE-8.md 7.1). Rein.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Lese-Zeitraum: erster Abgleich die letzten 30 Tage; danach ab dem letzten erfolgreichen Abgleich minus 48 h
 * (Samsung schreibt teils verzögert), nie weiter zurück als 30 Tage (Grenze von Health Connect ohne
 * Zusatzberechtigung) und nie nach `now`.
 */
export function syncWindow(lastSyncAt: string | null, now: string): { from: string; to: string } {
  const nowMs = Date.parse(now);
  const earliest = nowMs - WEARABLE_SYNC.firstSyncDays * DAY_MS;
  const last = lastSyncAt === null ? Number.NaN : Date.parse(lastSyncAt);
  const from = Number.isFinite(last)
    ? Math.min(nowMs, Math.max(earliest, last - WEARABLE_SYNC.overlapHours * HOUR_MS))
    : earliest;
  return { from: new Date(from).toISOString(), to: new Date(nowMs).toISOString() };
}

/**
 * Automatischer Abgleich (App-Start, Rückkehr in den Vordergrund) nur, wenn der letzte VERSUCH mindestens 15 min her
 * ist. Uhr zurückgestellt (letzter Versuch in der Zukunft) → abgleichen.
 */
export function shouldAutoSync(lastAttemptAt: string | null, now: string): boolean {
  if (lastAttemptAt === null) return true;
  const last = Date.parse(lastAttemptAt);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(last) || last > nowMs) return true;
  return nowMs - last >= WEARABLE_SYNC.autoMinIntervalMin * 60 * 1000;
}

/** Kalendertage (JJJJ-MM-TT) von `fromDay` bis `toDay` (beide eingeschlossen) – für die Schritte je Tag. */
export function daysInRange(fromDay: string, toDay: string): string[] {
  const days: string[] = [];
  for (
    let d = fromDay;
    d <= toDay && days.length < WEARABLE_SYNC.maxDaysPerBatch;
    d = addDays(d, 1)
  ) {
    days.push(d);
  }
  return days;
}
