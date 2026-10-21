import { z } from 'zod';

import { SUPPLEMENT_IDS, type RatedSupplementId } from '../supplement-ids';
import type { RatedSupplementResult, SupplementRecommendations } from './eligibility';

/**
 * Zeitplan (docs/PLAN-PHASE-6.md 3.5, Etappe SU6 nutzt ihn auf „Heute“): Zeitpunkte je Tag für die Supplemente, die die
 * Person unter „Meine Supplements“ gewählt hat („Nehme ich“). Gratis, rechnet auf dem Gerät. KOFFEIN kommt nie vor
 * (B2.3). Eine Zeile gibt es nur, solange die aktuelle Einordnung sie erlaubt – kommt ein Sperr-Flag hinzu,
 * verschwindet die Zeile sofort.
 */

export const SUPPLEMENT_TIMINGS = [
  'before_training',
  'after_training',
  'before_sleep',
  'daily_with_meal',
] as const;
export type SupplementTiming = (typeof SUPPLEMENT_TIMINGS)[number];

export const scheduleDaySchema = z.strictObject({
  date: z.iso.date(),
  /** Mindestens eine geplante Einheit an diesem Tag. */
  hasTraining: z.boolean(),
});
export type ScheduleDay = z.infer<typeof scheduleDaySchema>;

const trainingWeekSchema = z
  .array(scheduleDaySchema)
  .max(7)
  .refine((days) => new Set(days.map((day) => day.date)).size === days.length, {
    message: 'Jeder Tag nur einmal.',
  });

const chosenSchema = z
  .array(z.enum(SUPPLEMENT_IDS))
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Supplement doppelt.' });

export interface ScheduleEntry {
  readonly supplementId: RatedSupplementId;
  readonly timing: SupplementTiming;
}

export interface ScheduleDayResult {
  readonly date: string;
  readonly entries: readonly ScheduleEntry[];
}

/**
 * Darf ein gewähltes Supplement im Zeitplan stehen? Nur bei „passt zu dir“ – Vitamin D ist nie „passt“ (SU-G15) und
 * steht deshalb auch als „Zur Info“ im Zeitplan, wenn die Person es gewählt hat (allgemeiner Richtwert, täglich zu einer
 * Mahlzeit). „ab 18“ und „Nicht für dich“ nie.
 */
export function supplementScheduleAllowed(item: RatedSupplementResult): boolean {
  if (item.status === 'recommended') return true;
  return item.id === 'vitamin_d' && item.status === 'info_only';
}

/**
 * Allgemeiner Zeitpunkt je Supplement (Plan 3.5): Kreatin (Uhrzeit egal, täglich), Vitamin D (mit einer fetthaltigen
 * Mahlzeit) und Omega-3 täglich zu einer Mahlzeit; Proteinpulver nach dem Training (an Ruhetagen deckt das Essen den
 * Bedarf). Koffein bekommt nie einen Zeitpunkt (B2.3).
 */
export function supplementTiming(id: RatedSupplementId): SupplementTiming {
  return id === 'protein_powder' ? 'after_training' : 'daily_with_meal';
}

/**
 * Zeitpunkte je Tag: Kreatin, Vitamin D und Omega-3 täglich zu einer Mahlzeit (auch an Ruhetagen); Proteinpulver nur
 * an Trainingstagen nach dem Training (an Ruhetagen deckt das Essen den Bedarf, Plan 3.5/3.7). Reihenfolge wie
 * RATED_SUPPLEMENT_IDS.
 * @param recommendation Ergebnis von `recommendSupplements` (aktueller Stand)
 * @param trainingWeek Tage mit/ohne Einheit (höchstens 7, jedes Datum einmal)
 * @param chosen „Nehme ich“ – Koffein wird ignoriert
 */
export function supplementSchedule(
  recommendation: SupplementRecommendations,
  trainingWeek: readonly ScheduleDay[],
  chosen: readonly (typeof SUPPLEMENT_IDS)[number][],
): ScheduleDayResult[] {
  const days = trainingWeekSchema.parse(trainingWeek);
  const picked = new Set(chosenSchema.parse(chosen));
  const active = recommendation.items.filter(
    (item) => picked.has(item.id) && supplementScheduleAllowed(item),
  );
  return days.map((day) => ({
    date: day.date,
    entries: active.flatMap((item): ScheduleEntry[] => {
      const timing = supplementTiming(item.id);
      if (timing === 'after_training') {
        return day.hasTraining ? [{ supplementId: item.id, timing }] : [];
      }
      return [{ supplementId: item.id, timing }];
    }),
  }));
}
