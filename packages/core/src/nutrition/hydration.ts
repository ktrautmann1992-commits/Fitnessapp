import { z } from 'zod';

import { HYDRATION } from '../constants';
import { addDays } from '../dates';

/**
 * Trinken-Tracker (Gründer-Freigabe 25.10.2026): Einträge (ml je Tag), Tagesziel als Richtwert und 7-Tage-Verlauf.
 * Feste Regeln, keine KI. Das Ziel ist ein Richtwert (D-A-CH), kein Heilversprechen; bei Herz- oder
 * Nierenerkrankung gibt die App kein Ziel vor (nur notieren). Tabelle hydration_logs (RLS), Eingabe über
 * add_hydration – Felder = hydrationEntrySchema (db-sync.test.ts).
 */

export const hydrationEntrySchema = z.strictObject({
  id: z.uuid(),
  /** Kalendertag (Europe/Berlin), JJJJ-MM-TT. */
  day: z.iso.date(),
  amount_ml: z.number().int().min(HYDRATION.entryMl.min).max(HYDRATION.entryMl.max),
});
export type HydrationEntryPayload = z.infer<typeof hydrationEntrySchema>;

/** Zeile von hydration_logs. */
export interface HydrationEntry extends HydrationEntryPayload {
  readonly user_id: string;
  readonly created_at: string;
}

export interface HydrationGoalInput {
  readonly weightKg: number | null;
  readonly ageYears: number | null;
  /** Bewegungszeit aller Einheiten des Tages in Minuten. */
  readonly trainingMinutes: number;
  /** Tageshöchsttemperatur laut gespeichertem Wetter (°C), null = unbekannt. */
  readonly maxTempC: number | null;
  /** Herz- oder Nierenerkrankung laut Gesundheits-/Supplement-Check → kein Ziel. */
  readonly medicalRestriction: boolean;
}

export type HydrationGoal =
  | {
      readonly kind: 'goal';
      readonly goalMl: number;
      readonly baseMl: number;
      readonly trainingMl: number;
      readonly heatMl: number;
    }
  | { readonly kind: 'no_goal'; readonly reason: 'medical' | 'no_weight' };

const round50 = (ml: number) => Math.round(ml / 50) * 50;

/** Tagesziel für Getränke (gerundet auf 50 ml, im Rahmen HYDRATION.goalMl). */
export function hydrationGoal(input: HydrationGoalInput): HydrationGoal {
  if (input.medicalRestriction) return { kind: 'no_goal', reason: 'medical' };
  if (input.weightKg === null || !(input.weightKg > 0))
    return { kind: 'no_goal', reason: 'no_weight' };
  const age = input.ageYears ?? 30;
  const perKg = [...HYDRATION.mlPerKg].reverse().find((r) => age >= r.fromAge)?.ml ?? 35;
  const baseMl = input.weightKg * perKg * HYDRATION.beverageShare;
  const trainingMl = Math.max(0, input.trainingMinutes) * HYDRATION.mlPerTrainingMin;
  const heatMl =
    input.maxTempC === null
      ? 0
      : ([...HYDRATION.heat].reverse().find((h) => (input.maxTempC as number) >= h.fromC)?.ml ?? 0);
  const total = Math.min(
    HYDRATION.goalMl.max,
    Math.max(HYDRATION.goalMl.min, baseMl + trainingMl + heatMl),
  );
  return {
    kind: 'goal',
    goalMl: round50(total),
    baseMl: round50(baseMl),
    trainingMl: round50(trainingMl),
    heatMl,
  };
}

/** Summe eines Tages in ml. */
export function hydrationTotal(
  entries: readonly Pick<HydrationEntry, 'day' | 'amount_ml'>[],
  day: string,
): number {
  return entries.filter((e) => e.day === day).reduce((sum, e) => sum + e.amount_ml, 0);
}

/** Verlauf der letzten `days` Tage bis `today` (älteste zuerst). */
export function hydrationHistory(
  entries: readonly Pick<HydrationEntry, 'day' | 'amount_ml'>[],
  today: string,
  days: number = HYDRATION.historyDays,
): { day: string; totalMl: number }[] {
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - (days - 1));
    return { day, totalMl: hydrationTotal(entries, day) };
  });
}

/** Anteil am Ziel (0 … 1,5 für den Ring – darüber bleibt der Ring voll, ohne Wertung). */
export function hydrationFraction(totalMl: number, goal: HydrationGoal): number | null {
  if (goal.kind !== 'goal') return null;
  return Math.min(1.5, Math.max(0, totalMl / goal.goalMl));
}

/** Darf an diesem Tag eingetragen werden? (heute bis backfillDays zurück, nicht in der Zukunft). */
export function hydrationDayAllowed(day: string, today: string): boolean {
  return day <= today && day >= addDays(today, -HYDRATION.backfillDays);
}

/** Trainingsminuten eines Tages aus den Einheiten (Bewegungszeit bzw. Dauer in Sekunden). */
export function trainingMinutesOfDay(
  items: readonly { day: string; durationS: number | null }[],
  day: string,
): number {
  const s = items
    .filter((i) => i.day === day)
    .reduce((sum, i) => sum + Math.max(0, i.durationS ?? 0), 0);
  return Math.round(s / 60);
}
