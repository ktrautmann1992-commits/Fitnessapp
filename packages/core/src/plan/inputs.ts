import { z } from 'zod';

import { isoDateSchema } from '../age';
import { TRAINING_LIMITS } from '../constants';
import { equipmentIdSchema } from '../equipment';
import { HEALTH_FLAGS } from '../health-screening';
import {
  enduranceDisciplineSchema,
  experienceLevelSchema,
  goalTypeSchema,
  sexSchema,
  trainingLocationSchema,
  weekdaySchema,
  weightStepKgSchema,
} from '../validation';

/**
 * Eingaben der Plan-Engine (docs/PLAN-PHASE-3.md Abschnitt 5.1), an der Grenze mit Zod geprüft.
 * Körpergewicht, Größe, Körperfett und Umfänge gehen bewusst NICHT ein.
 */

function distinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const homeEquipmentItemSchema = z.strictObject({
  equipmentId: equipmentIdSchema,
  /** Eigene Gewichtsstufen in kg (Kurzhanteln, Kettlebells, Scheiben). */
  weightsKg: z.array(weightStepKgSchema).max(40).default([]),
});

/**
 * Gesundheits-Check: `null` = kein Check vorhanden (keine gültige Einwilligung) → vorsichtige Standardregeln.
 * Sonst die Flags des NEUESTEN Checks (leer = keine Auffälligkeit).
 */
export const planHealthScreeningSchema = z
  .strictObject({
    flags: z.array(z.enum(HEALTH_FLAGS)).refine(distinct, 'Jedes Flag nur einmal.'),
  })
  .nullable();

export const planInputsSchema = z
  .strictObject({
    goalType: goalTypeSchema,
    discipline: enduranceDisciplineSchema.nullable().default(null),
    experienceLevel: experienceLevelSchema,
    sessionsPerWeek: z
      .number()
      .int()
      .min(TRAINING_LIMITS.sessionsPerWeek.min)
      .max(TRAINING_LIMITS.sessionsPerWeek.max),
    minutesPerSession: z
      .number()
      .int()
      .min(TRAINING_LIMITS.minutesPerSession.min)
      .max(TRAINING_LIMITS.minutesPerSession.max),
    preferredDays: z.array(weekdaySchema).max(7).refine(distinct, 'Jeder Wochentag nur einmal.'),
    trainingLocation: trainingLocationSchema,
    homeEquipment: z
      .array(homeEquipmentItemSchema)
      .default([])
      .refine((items) => distinct(items.map((i) => i.equipmentId)), 'Jedes Gerät nur einmal.'),
    birthDate: isoDateSchema,
    sex: sexSchema.nullable().default(null),
    healthScreening: planHealthScreeningSchema,
  })
  .refine((value) => value.discipline === null || value.goalType === 'endurance', {
    path: ['discipline'],
    message: 'Eine Disziplin gibt es nur beim Ziel Ausdauer.',
  });

export type PlanInputs = z.infer<typeof planInputsSchema>;
export type PlanInputsInput = z.input<typeof planInputsSchema>;

/**
 * Abbild der Angaben OHNE Gesundheitsdaten und ohne Geburtsdatum (wird als user_plans.inputs gespeichert und
 * dient zum Erkennen geänderter Angaben). Listen sortiert, damit der Vergleich nicht von der Reihenfolge abhängt.
 */
export interface PlanInputsSnapshot {
  goalType: PlanInputs['goalType'];
  discipline: PlanInputs['discipline'];
  experienceLevel: PlanInputs['experienceLevel'];
  sessionsPerWeek: number;
  minutesPerSession: number;
  preferredDays: number[];
  trainingLocation: PlanInputs['trainingLocation'];
  homeEquipment: { equipmentId: string; weightsKg: number[] }[];
}

export function planInputsSnapshot(inputs: PlanInputs): PlanInputsSnapshot {
  return {
    goalType: inputs.goalType,
    discipline: inputs.discipline,
    experienceLevel: inputs.experienceLevel,
    sessionsPerWeek: inputs.sessionsPerWeek,
    minutesPerSession: inputs.minutesPerSession,
    preferredDays: [...inputs.preferredDays].sort((a, b) => a - b),
    trainingLocation: inputs.trainingLocation,
    homeEquipment: [...inputs.homeEquipment]
      .map((item) => ({
        equipmentId: item.equipmentId,
        weightsKg: [...item.weightsKg].sort((a, b) => a - b),
      }))
      .sort((a, b) => (a.equipmentId < b.equipmentId ? -1 : a.equipmentId > b.equipmentId ? 1 : 0)),
  };
}
