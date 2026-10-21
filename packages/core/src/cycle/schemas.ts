import { z } from 'zod';

import { isoDateSchema } from '../age';
import { CYCLE_RULES } from '../constants';
import { addDays } from '../dates';

/**
 * Zyklus-Modul (docs/PLAN-PHASE-9.md 3.2, 6.1, ZY1): Aufzählungen und Zod-Schemas.
 *
 * Die Aufzählungen gibt es bewusst NICHT als Postgres-Enum (Plan 6.1): Status, Blutung und Beschwerden stehen nur
 * innerhalb der verschlüsselten Daten, nie im Klartext. Die Server-Funktionen prüfen dieselben Listen
 * (supabase/migrations/20261021140100_cycle_rpcs.sql, db-sync.test.ts).
 */

/** Status (einmal, jederzeit änderbar). `pregnant` pausiert das Modul (Plan 3.2). */
export const CYCLE_STATUSES = [
  'natural',
  'hormonal_contraception',
  'perimenopause',
  'postmenopause',
  'breastfeeding',
  'pregnant',
  'unspecified',
] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

/** Blutung am Tag: keine · Schmierblutung · leicht · mittel · stark. */
export const CYCLE_BLEEDING_LEVELS = ['none', 'spotting', 'light', 'medium', 'heavy'] as const;
export type CycleBleeding = (typeof CYCLE_BLEEDING_LEVELS)[number];

/** Feste Liste der Beschwerden (Enum, damit Regeln und Texte prüfbar bleiben). Kein Freitext (ZY-G6). */
export const CYCLE_SYMPTOMS = [
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'digestion',
  'nausea',
  'fatigue',
  'low_mood',
  'hot_flushes',
  'sleep_problems',
] as const;
export type CycleSymptom = (typeof CYCLE_SYMPTOMS)[number];

/** Stärke einer Beschwerde. */
export const CYCLE_SYMPTOM_INTENSITIES = ['mild', 'strong'] as const;
export type CycleSymptomIntensity = (typeof CYCLE_SYMPTOM_INTENSITIES)[number];

/** Einmalige Frage beim Einschalten (nur bei `natural`): „Wann war deine letzte Periode?“ */
export const CYCLE_LAST_PERIOD_ANSWERS = [
  'under_1_month',
  '1_to_3_months',
  'over_3_months',
  'unknown',
] as const;
export type CycleLastPeriodAnswer = (typeof CYCLE_LAST_PERIOD_ANSWERS)[number];

/** Energie und Schlaf: 1 (sehr wenig/schlecht) bis 5 (sehr viel/sehr gut). */
export const CYCLE_SCALE = { min: 1, max: 5 } as const;

const scaleSchema = z.number().int().min(CYCLE_SCALE.min).max(CYCLE_SCALE.max);

/** Beschwerden: je Code „leicht“ oder „stark“; nicht genannte Beschwerden = keine. */
export const cycleSymptomsSchema = z.partialRecord(
  z.enum(CYCLE_SYMPTOMS),
  z.enum(CYCLE_SYMPTOM_INTENSITIES),
);
export type CycleSymptoms = z.infer<typeof cycleSymptomsSchema>;

/**
 * Inhalt eines Tages-Checks – genau das, was verschlüsselt gespeichert wird (`p_payload` von save_cycle_entry).
 * Alle Felder optional, aber mindestens eines muss gefüllt sein (sonst kein Eintrag).
 */
export const cycleEntryPayloadSchema = z
  .strictObject({
    bleeding: z.enum(CYCLE_BLEEDING_LEVELS).nullable().optional(),
    energy: scaleSchema.nullable().optional(),
    symptoms: cycleSymptomsSchema.optional(),
    sleep: scaleSchema.nullable().optional(),
  })
  .refine(hasAnyValue, { message: 'Bitte mindestens eine Angabe machen.' });
export type CycleEntryPayload = z.infer<typeof cycleEntryPayloadSchema>;

/** Ein Tages-Check mit Datum (je Kalendertag höchstens einer). */
export const cycleEntrySchema = z.strictObject({
  date: isoDateSchema,
  payload: cycleEntryPayloadSchema,
});
export type CycleEntry = z.infer<typeof cycleEntrySchema>;

/** Hat der Eintrag mindestens eine Angabe? */
export function hasAnyValue(payload: {
  bleeding?: CycleBleeding | null | undefined;
  energy?: number | null | undefined;
  symptoms?: CycleSymptoms | undefined;
  sleep?: number | null | undefined;
}): boolean {
  return (
    (payload.bleeding !== null && payload.bleeding !== undefined) ||
    (payload.energy !== null && payload.energy !== undefined) ||
    (payload.sleep !== null && payload.sleep !== undefined) ||
    Object.keys(payload.symptoms ?? {}).length > 0
  );
}

/**
 * Datum eines Tages-Checks: nie in der Zukunft, höchstens CYCLE_RULES.backfillDays zurück (gleiche Regel wie
 * save_cycle_entry; der Server rechnet mit dem Kalendertag Europe/Berlin).
 */
export function createCycleEntryDateSchema(today: string) {
  const earliest = addDays(today, -CYCLE_RULES.backfillDays);
  return isoDateSchema
    .refine((date) => date <= today, 'Einträge in der Zukunft sind nicht möglich.')
    .refine(
      (date) => date >= earliest,
      `Nachtragen geht bis ${CYCLE_RULES.backfillDays} Tage zurück.`,
    );
}

/** Uhrzeit „HH:MM“ (Erinnerung). */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Uhrzeit als HH:MM.');

/** Codes, deren „Weggetippt am“ gespeichert wird (Warnungen und einmalige Hinweise). */
export const CYCLE_DISMISSIBLE_CODES = [
  'W1',
  'W1b',
  'W1c',
  'W2',
  'W3',
  'W3_hormonal',
  'W4',
  'W4_hormonal',
  'W5',
  'W6',
  'W8',
  'mood_support',
  'lighter_often',
  'iron',
] as const;
export type CycleDismissibleCode = (typeof CYCLE_DISMISSIBLE_CODES)[number];

/**
 * Einstellungen des Moduls – liegen ebenfalls nur verschlüsselt (`cycle_settings`), auch die Hinweis-Zustände
 * (weggetippt am …), denn sie sind selbst Zyklusdaten (Plan S6).
 */
export const cycleSettingsSchema = z.strictObject({
  status: z.enum(CYCLE_STATUSES).nullable(),
  /** Antwort auf „Letzte Periode“ beim Einschalten (nur bei `natural`). */
  lastPeriodAtStart: z.enum(CYCLE_LAST_PERIOD_ANSWERS).nullable(),
  /** Kalendertag, an dem das Modul (zuletzt) eingerichtet wurde – Bezug der Einschalt-Antwort. */
  enabledOn: isoDateSchema.nullable(),
  /** Pausiert: Tages-Check und Angebote aus, Daten und Einwilligung bleiben. */
  paused: z.boolean(),
  /** Schlaf erfassen (Standard aus, ZY-G5). */
  sleepTracking: z.boolean(),
  /** Neutrale lokale Erinnerung (Standard aus, ZY-G7). */
  reminder: z.strictObject({ enabled: z.boolean(), time: timeSchema }),
  /** Rückfrage nach 45 Tagen bestätigt: bis zu diesem Tag gab es keine Blutung (Tage gelten als erfasst). */
  noBleedingConfirmedUntil: isoDateSchema.nullable(),
  /** Weggetippte Karten: Code → Kalendertag. */
  dismissed: z.partialRecord(z.enum(CYCLE_DISMISSIBLE_CODES), isoDateSchema),
});
export type CycleSettings = z.infer<typeof cycleSettingsSchema>;

/** Standard beim ersten Einschalten (alles Optionale aus). */
export function defaultCycleSettings(): CycleSettings {
  return {
    status: null,
    lastPeriodAtStart: null,
    enabledOn: null,
    paused: false,
    sleepTracking: false,
    reminder: { enabled: false, time: '19:00' },
    noBleedingConfirmedUntil: null,
    dismissed: {},
  };
}

/** Feste Fehlercodes der Server-Funktionen (Plan 6.3a) – ohne Eingabewerte. */
export const CYCLE_ERROR_CODES = [
  'cycle_consent_missing',
  'cycle_consent_outdated',
  'cycle_payload_invalid',
  'cycle_rate_limited',
  'cycle_module_closed',
] as const;
export type CycleErrorCode = (typeof CYCLE_ERROR_CODES)[number];
