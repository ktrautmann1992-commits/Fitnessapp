import { z } from 'zod';

import { isoDateSchema } from '../age';
import { BODY_METRIC_LIMITS, WEIGHT_GOAL_LIMITS } from '../constants';
import { daysBetween } from '../dates';

/**
 * Gespeichertes (normalisiertes) Abnehmziel (docs/PLAN-ZIELE.md 2.2, Etappe Z2). Reine Zod-Schemas ohne Abhängigkeit
 * zur Ernährungs-Engine, damit `nutritionInputsSchema` sie ohne Import-Kreis nutzen kann.
 * Gesundheitsdatum (Art. 9 DSGVO): nur mit `health_data`-Einwilligung; nie in Logs, Analytics oder Crash-Reports
 * (Wächter K7). Ein Startgewicht wird NICHT gespeichert (Wächter K9); jedes Speichern setzt `startDate = heute`
 * (Wächter S15).
 */

export const WEIGHT_GOAL_AMOUNT_MODES = ['kg_to_lose', 'target_weight'] as const;
export type WeightGoalAmountMode = (typeof WEIGHT_GOAL_AMOUNT_MODES)[number];

export const WEIGHT_GOAL_TIME_MODES = ['weeks', 'date'] as const;
export type WeightGoalTimeMode = (typeof WEIGHT_GOAL_TIME_MODES)[number];

/** Zeitraum in Tagen (4–104 Wochen = 28–728 Tage, gleiche Regel wie der künftige Datums-CHECK, Plan 5.2). */
export const WEIGHT_GOAL_DAYS = {
  min: WEIGHT_GOAL_LIMITS.weeks.min * 7,
  max: WEIGHT_GOAL_LIMITS.weeks.max * 7,
} as const;

/** Ist `value` ein Vielfaches von `step` (robust gegen Gleitkomma-Reste)? */
export function isMultipleOf(value: number, step: number): boolean {
  const quotient = value / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-6;
}

/** Normalisiertes Abnehmziel wie die künftige Tabelle `weight_goals` (Plan 5.2). */
export const weightGoalSchema = z
  .strictObject({
    targetWeightKg: z
      .number()
      .min(BODY_METRIC_LIMITS.weightKg.min)
      .max(BODY_METRIC_LIMITS.weightKg.max)
      .refine((kg) => isMultipleOf(kg, WEIGHT_GOAL_LIMITS.targetStep), {
        message: 'Das Zielgewicht hat höchstens eine Nachkommastelle.',
      }),
    startDate: isoDateSchema,
    targetDate: isoDateSchema,
    amountMode: z.enum(WEIGHT_GOAL_AMOUNT_MODES),
    timeMode: z.enum(WEIGHT_GOAL_TIME_MODES),
  })
  .refine(
    (goal) => {
      const days = daysBetween(goal.startDate, goal.targetDate);
      return days >= WEIGHT_GOAL_DAYS.min && days <= WEIGHT_GOAL_DAYS.max;
    },
    { path: ['targetDate'], message: 'Bitte einen Zeitraum zwischen 4 Wochen und 2 Jahren.' },
  );
export type WeightGoal = z.output<typeof weightGoalSchema>;
export type WeightGoalInput = z.input<typeof weightGoalSchema>;
