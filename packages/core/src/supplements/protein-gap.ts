import { z } from 'zod';

import { SUPPLEMENT_RULES } from '../constants';
import type { ProteinSelfCheckAnswer } from './screening';

/**
 * Eiweiß-Lücke aus einer GRATIS-Quelle (docs/PLAN-PHASE-6.md 3.7, Wächter S7): Tagebuch-Schnitt der letzten 7 Tage
 * (mindestens 4 Tage mit Einträgen) oder Selbsteinschätzung. Ohne diese Daten gibt es keine Lücke (`null`) und
 * Proteinpulver bleibt „Zur Info“. Vegan allein ist nie ein Grund.
 */

export interface ProteinGap {
  /** true = gegessenes Eiweiß liegt meist unter dem Ziel. */
  readonly gap: boolean;
  readonly source: 'log' | 'self_check';
}

const { windowDays, minDaysWithEntries, minShare } = SUPPLEMENT_RULES.proteinPowder.gap;

/** Ein Tag aus dem Ernährungstagebuch: Eiweiß in g, `null` = an diesem Tag nichts eingetragen. */
export const proteinLogDaySchema = z.strictObject({
  date: z.iso.date(),
  proteinG: z.number().finite().min(0).max(1000).nullable(),
});
export type ProteinLogDay = z.infer<typeof proteinLogDaySchema>;

const proteinLogSchema = z
  .array(proteinLogDaySchema)
  .max(windowDays)
  .refine((days) => new Set(days.map((day) => day.date)).size === days.length, {
    message: 'Jeder Tag nur einmal.',
  });

/**
 * Lücke aus dem Tagebuch: Schnitt über die Tage MIT Einträgen (`proteinG` nicht `null`, auch 0 g zählt als Eintrag)
 * unter `minShare` (90 %) des Eiweißziels. Weniger als `minDaysWithEntries` (4) Tage mit Einträgen → `null`
 * (zu wenig Daten). Mehr als 7 Tage oder doppelte Tage → Fehler (der Aufrufer wählt die letzten 7 Tage).
 * @param last7Days Tage der letzten Woche (höchstens 7, jedes Datum einmal)
 * @param targetProteinG Eiweißziel des Tages in g (> 0)
 */
export function proteinGapFromLog(
  last7Days: readonly ProteinLogDay[],
  targetProteinG: number,
): ProteinGap | null {
  const days = proteinLogSchema.parse(last7Days);
  const target = z.number().finite().positive().parse(targetProteinG);
  const logged = days.flatMap((day) => (day.proteinG === null ? [] : [day.proteinG]));
  if (logged.length < minDaysWithEntries) {
    return null;
  }
  const average = logged.reduce((sum, value) => sum + value, 0) / logged.length;
  return { gap: average < minShare * target, source: 'log' };
}

/** Lücke aus der Selbsteinschätzung: „eher nicht“ = Lücke; keine Antwort → `null`. */
export function proteinGapFromSelfCheck(
  answer: ProteinSelfCheckAnswer | null | undefined,
): ProteinGap | null {
  if (answer === null || answer === undefined) {
    return null;
  }
  return { gap: answer === 'rather_not', source: 'self_check' };
}

/**
 * Eine Lücke für die Einordnung: Das Tagebuch (gemessen) geht vor, sonst die Selbsteinschätzung, sonst `null`.
 */
export function resolveProteinGap(
  fromLog: ProteinGap | null,
  fromSelfCheck: ProteinGap | null,
): ProteinGap | null {
  return fromLog ?? fromSelfCheck;
}
