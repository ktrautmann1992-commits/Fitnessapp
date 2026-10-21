import { addDays } from '../dates';
import type { CycleEntry, CycleEntryPayload } from './schemas';

/** Ein Eintrag (Testhilfe). */
export function entry(date: string, payload: CycleEntryPayload): CycleEntry {
  return { date, payload };
}

/** Tägliche Einträge von `from` für `days` Tage; `bleedingDays` = Tag-Indizes mit Blutung `level`. */
export function dailyEntries(
  from: string,
  days: number,
  options: {
    bleeding?: (index: number) => CycleEntryPayload['bleeding'];
    extra?: (index: number) => Partial<CycleEntryPayload>;
  } = {},
): CycleEntry[] {
  const result: CycleEntry[] = [];
  for (let i = 0; i < days; i += 1) {
    result.push({
      date: addDays(from, i),
      payload: { bleeding: options.bleeding?.(i) ?? 'none', ...(options.extra?.(i) ?? {}) },
    });
  }
  return result;
}

/** Regelmäßige Zyklen: Periode `periodDays` lang alle `cycleLength` Tage, ab `from`, `cycles` Zyklen + Rest. */
export function regularCycles(
  from: string,
  cycleLength: number,
  periodDays: number,
  totalDays: number,
  level: CycleEntryPayload['bleeding'] = 'medium',
): CycleEntry[] {
  return dailyEntries(from, totalDays, {
    bleeding: (i) => (i % cycleLength < periodDays ? level : 'none'),
  });
}
