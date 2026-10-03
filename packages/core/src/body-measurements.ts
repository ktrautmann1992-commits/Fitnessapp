import { z } from 'zod';

import { isoDateSchema } from './age';
import { BODY_MEASUREMENT_LIMITS, MEASUREMENT_REMINDER_INTERVAL_DAYS } from './constants';
import { addDays, createMeasuredOnSchema } from './dates';

type LimitKey = keyof typeof BODY_MEASUREMENT_LIMITS;

export interface MeasurementSite {
  /** Feldname im Code (camelCase). */
  readonly id: string;
  /** Spaltenname in `body_measurements`. */
  readonly column: string;
  readonly nameDe: string;
  /** Kurze Mess-Anleitung für die App. */
  readonly instructionDe: string;
  readonly limitKey: LimitKey;
}

const ARM = 'Arm locker hängen lassen, an der dicksten Stelle des Oberarms waagerecht messen.';
const THIGH =
  'Aufrecht stehen, Gewicht auf beiden Beinen, an der dicksten Stelle knapp unter dem Gesäß messen.';
const CALF = 'Aufrecht stehen, an der dicksten Stelle der Wade waagerecht messen.';

/**
 * Messstellen für den optionalen Onboarding-Schritt „Körperumfänge“ (Reihenfolge = Anzeige von oben nach unten).
 * Spalten und Grenzen müssen zu supabase/migrations/20261003120350_body_measurements.sql passen (db-sync.test.ts).
 * Allgemein: morgens nüchtern messen, Maßband anliegend, aber nicht einschnürend, immer an derselben Stelle.
 */
export const MEASUREMENT_SITES = [
  {
    id: 'shouldersCm',
    column: 'shoulders_cm',
    nameDe: 'Schultern',
    instructionDe:
      'Arme locker hängen lassen, Maßband waagerecht um die breiteste Stelle der Schultern führen.',
    limitKey: 'shouldersCm',
  },
  {
    id: 'chestCm',
    column: 'chest_cm',
    nameDe: 'Brust',
    instructionDe: 'Normal ausatmen, auf Höhe der Brustwarzen waagerecht messen.',
    limitKey: 'chestCm',
  },
  {
    id: 'upperArmLeftCm',
    column: 'upper_arm_left_cm',
    nameDe: 'Oberarm links',
    instructionDe: ARM,
    limitKey: 'upperArmCm',
  },
  {
    id: 'upperArmRightCm',
    column: 'upper_arm_right_cm',
    nameDe: 'Oberarm rechts',
    instructionDe: ARM,
    limitKey: 'upperArmCm',
  },
  {
    id: 'waistCm',
    column: 'waist_cm',
    nameDe: 'Taille',
    instructionDe:
      'Normal ausatmen, an der schmalsten Stelle zwischen unterster Rippe und Hüftknochen messen.',
    limitKey: 'waistCm',
  },
  {
    id: 'abdomenCm',
    column: 'abdomen_cm',
    nameDe: 'Bauch',
    instructionDe:
      'Normal ausatmen, Bauch nicht einziehen, auf Höhe des Bauchnabels waagerecht messen.',
    limitKey: 'abdomenCm',
  },
  {
    id: 'hipCm',
    column: 'hip_cm',
    nameDe: 'Hüfte',
    instructionDe: 'Füße zusammen, an der breitesten Stelle des Gesäßes waagerecht messen.',
    limitKey: 'hipCm',
  },
  {
    id: 'thighLeftCm',
    column: 'thigh_left_cm',
    nameDe: 'Oberschenkel links',
    instructionDe: THIGH,
    limitKey: 'thighCm',
  },
  {
    id: 'thighRightCm',
    column: 'thigh_right_cm',
    nameDe: 'Oberschenkel rechts',
    instructionDe: THIGH,
    limitKey: 'thighCm',
  },
  {
    id: 'calfLeftCm',
    column: 'calf_left_cm',
    nameDe: 'Wade links',
    instructionDe: CALF,
    limitKey: 'calfCm',
  },
  {
    id: 'calfRightCm',
    column: 'calf_right_cm',
    nameDe: 'Wade rechts',
    instructionDe: CALF,
    limitKey: 'calfCm',
  },
] as const satisfies readonly MeasurementSite[];

export type MeasurementSiteId = (typeof MEASUREMENT_SITES)[number]['id'];

function circumference(limitKey: LimitKey, nameDe: string) {
  const { min, max } = BODY_MEASUREMENT_LIMITS[limitKey];
  return z
    .number({ error: `${nameDe}: bitte eine Zahl in cm eingeben.` })
    .min(min, `${nameDe}: mindestens ${min} cm.`)
    .max(max, `${nameDe}: höchstens ${max} cm.`)
    .nullable()
    .optional();
}

const siteShape = Object.fromEntries(
  MEASUREMENT_SITES.map((site) => [site.id, circumference(site.limitKey, site.nameDe)]),
) as Record<MeasurementSiteId, ReturnType<typeof circumference>>;

/**
 * Eingabe „Körperumfänge“: alle Stellen optional, aber mindestens eine muss ausgefüllt sein
 * (gleiche Regel wie die CHECK-Bedingung in der Datenbank). Der Schritt selbst ist überspringbar.
 * Messdatum optional (Standard heute), höchstens 1 Tag in der Zukunft.
 */
export function createBodyMeasurementsInputSchema(today: string) {
  return z
    .strictObject({ measuredOn: createMeasuredOnSchema(today).optional(), ...siteShape })
    .refine((value) => MEASUREMENT_SITES.some((site) => value[site.id] != null), {
      message: 'Bitte mindestens einen Umfang eintragen – oder den Schritt überspringen.',
    });
}

export type BodyMeasurementsInput = z.infer<ReturnType<typeof createBodyMeasurementsInputSchema>>;

/** Abstand der Mess-Erinnerung in Tagen (7–90, Standard 28). */
export const measurementReminderIntervalSchema = z
  .number()
  .int('Bitte ganze Tage angeben.')
  .min(MEASUREMENT_REMINDER_INTERVAL_DAYS.min, 'Mindestens alle 7 Tage.')
  .max(MEASUREMENT_REMINDER_INTERVAL_DAYS.max, 'Höchstens alle 90 Tage.');

/**
 * Datum der nächsten fälligen Messung: letzte Messung + Intervall (kalendarisch, ohne Zeitzonen).
 * Wirft bei ungültigem Datum oder Intervall außerhalb von 7–90 Tagen.
 */
export function nextMeasurementDue(
  lastDate: string,
  intervalDays: number = MEASUREMENT_REMINDER_INTERVAL_DAYS.default,
): string {
  return addDays(lastDate, measurementReminderIntervalSchema.parse(intervalDays));
}

/** true, wenn an `today` (ISO-Datum) eine Messung fällig oder überfällig ist. */
export function isMeasurementDue(nextDueOn: string, today: string): boolean {
  return isoDateSchema.parse(today) >= isoDateSchema.parse(nextDueOn);
}
