import { AGING_FLAGS } from '../aging-screening';
import { z } from 'zod';

import { isoDateSchema } from '../age';
import { BARBELL_PLATE_MAX_KG, EQUIPMENT_LIMITS } from '../constants';
import type { TrainingLocation } from '../enums';
import { BARBELL_ID, equipmentIdSchema } from '../equipment';
import { isAllowedGoalPair } from '../goals/profile';
import { HEALTH_FLAGS } from '../health-screening';
import {
  deriveTrainingLocation,
  trainingScheduleSchema,
  type TrainingSchedule,
} from '../training-schedule';
import {
  barbellBarKgSchema,
  enduranceDisciplineSchema,
  experienceLevelSchema,
  goalTypeSchema,
  sexSchema,
  weightStepKgSchema,
} from '../validation';

/**
 * Eingaben der Plan-Engine (docs/PLAN-PHASE-3.md Abschnitt 5.1, Etappe B3: docs/PLAN-PHASE-3-ERWEITERUNG.md 5.1),
 * an der Grenze mit Zod geprüft.
 * Körpergewicht, Größe, Körperfett und Umfänge gehen bewusst NICHT ein.
 */

function distinct<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const homeEquipmentItemSchema = z
  .strictObject({
    equipmentId: equipmentIdSchema,
    /** Eigene Gewichtsstufen in kg (Kurzhanteln je Hantel, Kettlebells je Kugel, Langhantel-Scheiben je Paar). */
    weightsKg: z.array(weightStepKgSchema).max(EQUIPMENT_LIMITS.maxWeightSteps).default([]),
    /** Nur Langhantel: Stange in kg (null = Standard BARBELL_DEFAULT_BAR_KG). */
    barKg: barbellBarKgSchema.nullable().default(null),
  })
  .refine((item) => item.barKg === null || item.equipmentId === BARBELL_ID, {
    path: ['barKg'],
    message: 'Eine Stange gibt es nur bei der Langhantel.',
  })
  .refine(
    (item) =>
      item.equipmentId !== BARBELL_ID || item.weightsKg.every((kg) => kg <= BARBELL_PLATE_MAX_KG),
    { path: ['weightsKg'], message: 'Hantelscheiben höchstens 25 kg.' },
  );

/**
 * Gesundheits-Check: `null` = kein Check vorhanden (keine gültige Einwilligung) → vorsichtige Standardregeln.
 * Sonst die Flags des NEUESTEN Checks (leer = keine Auffälligkeit).
 */
export const planHealthScreeningSchema = z
  .strictObject({
    flags: z.array(z.enum(HEALTH_FLAGS)).refine(distinct, 'Jedes Flag nur einmal.'),
  })
  .nullable();

/**
 * Zusatzfragen „Fit im Alter“ (docs/PLAN-FIT-IM-ALTER.md 8.2): fehlt = gelten nicht; `null` = gelten, aber
 * übersprungen (vorsichtig); sonst die Flags. Gesundheitsdatum – nie im Schnappschuss (planInputsSnapshot).
 */
export const planAgingScreeningSchema = z
  .strictObject({
    flags: z.array(z.enum(AGING_FLAGS)).refine(distinct, 'Jedes Flag nur einmal.'),
  })
  .nullable();

/**
 * Angaben (Engine-Version 2, Erweiterungsplan 5.1): `schedule` (Trainingstage mit Art und Dauer, fest oder
 * „Tage egal“) ersetzt Tage pro Woche, eine Dauer und Wunsch-Tage; der Trainingsort wird daraus abgeleitet.
 */
export const planInputsSchema = z
  .strictObject({
    goalType: goalTypeSchema,
    /** Nebenziel (docs/PLAN-ZIELE.md 4.6): optional, Standard `null` (Wächter B1). */
    secondaryGoalType: goalTypeSchema.nullable().default(null),
    discipline: enduranceDisciplineSchema.nullable().default(null),
    experienceLevel: experienceLevelSchema,
    schedule: trainingScheduleSchema,
    homeEquipment: z
      .array(homeEquipmentItemSchema)
      .default([])
      .refine((items) => distinct(items.map((i) => i.equipmentId)), 'Jedes Gerät nur einmal.'),
    birthDate: isoDateSchema,
    sex: sexSchema.nullable().default(null),
    healthScreening: planHealthScreeningSchema,
    agingScreening: planAgingScreeningSchema.optional(),
    /**
     * Sportarten Stufe 1 · Etappe R (Gründer-Entscheidung 27.10.2026 „Rudern kann man zuhause und im Studio“):
     * ausdrückliche Angabe „Im Studio auch rudern (Rudergerät)“ = Zeile `rowing_machine` mit Ort `gym` in
     * user_equipment. Optional (fehlt = aus): Angaben und Schnappschuss ohne diese Angabe bleiben byte-gleich. Nicht im
     * Schnappschuss (user_plans.inputs, private.assert_plan_inputs) – der Folgeblock liest sie aus den aktuellen Geräten.
     */
    gymRowing: z.boolean().optional(),
  })
  .refine((value) => isAllowedGoalPair(value.goalType, value.secondaryGoalType), {
    path: ['secondaryGoalType'],
    message: 'Diese Kombination von Zielen ist nicht möglich.',
  })
  .refine(
    (value) =>
      value.discipline === null ||
      value.goalType === 'endurance' ||
      value.secondaryGoalType === 'endurance',
    {
      path: ['discipline'],
      message: 'Eine Disziplin gibt es nur beim Ziel Ausdauer.',
    },
  );

export type PlanInputs = z.infer<typeof planInputsSchema>;
export type PlanInputsInput = z.input<typeof planInputsSchema>;

/**
 * Abbild der Angaben OHNE Gesundheitsdaten und ohne Geburtsdatum (wird als user_plans.inputs gespeichert und
 * dient zum Erkennen geänderter Angaben). Listen sortiert, damit der Vergleich nicht von der Reihenfolge abhängt.
 * `trainingLocation` ist abgeleitet (deriveTrainingLocation; null = nur Ausdauer).
 */
export interface PlanInputsSnapshot {
  goalType: PlanInputs['goalType'];
  /**
   * Nebenziel – NUR vorhanden, wenn gesetzt (docs/PLAN-ZIELE.md 4.6, Wächter B1): Ohne Nebenziel bleibt der
   * Schnappschuss (und damit der Payload von save_training_plan) byte-gleich zu vorher; alte Pläne ohne den
   * Schlüssel lösen kein Angebot „Plan neu erstellen?“ aus. Fehlend und `null` bedeuten „kein Nebenziel“.
   */
  secondaryGoalType?: NonNullable<PlanInputs['secondaryGoalType']>;
  discipline: PlanInputs['discipline'];
  experienceLevel: PlanInputs['experienceLevel'];
  schedule: TrainingSchedule;
  trainingLocation: TrainingLocation | null;
  homeEquipment: { equipmentId: string; weightsKg: number[]; barKg: number | null }[];
}

/** `{ secondaryGoalType }` nur bei gesetztem Nebenziel, sonst `{}` (Schlüssel fehlt, Wächter B1). */
export function secondaryGoalEntry(
  secondary: PlanInputs['secondaryGoalType'] | undefined,
): Pick<PlanInputsSnapshot, 'secondaryGoalType'> {
  return secondary == null ? {} : { secondaryGoalType: secondary };
}

export function planInputsSnapshot(inputs: PlanInputs): PlanInputsSnapshot {
  const schedule = trainingScheduleSchema.parse(inputs.schedule);
  return {
    goalType: inputs.goalType,
    ...secondaryGoalEntry(inputs.secondaryGoalType),
    discipline: inputs.discipline,
    experienceLevel: inputs.experienceLevel,
    schedule:
      schedule.mode === 'fixed'
        ? {
            mode: 'fixed',
            slots: schedule.slots.map((s) => ({
              weekday: s.weekday,
              kind: s.kind,
              minutes: s.minutes,
            })),
          }
        : {
            mode: 'flex',
            slots: schedule.slots.map((s) => ({ kind: s.kind, minutes: s.minutes })),
          },
    trainingLocation: deriveTrainingLocation(schedule),
    homeEquipment: [...inputs.homeEquipment]
      .map((item) => ({
        equipmentId: item.equipmentId,
        weightsKg: [...item.weightsKg].sort((a, b) => a - b),
        barKg: item.barKg,
      }))
      .sort((a, b) => (a.equipmentId < b.equipmentId ? -1 : a.equipmentId > b.equipmentId ? 1 : 0)),
  };
}
