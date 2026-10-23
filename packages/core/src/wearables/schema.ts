import { z } from 'zod';

import { isoDateSchema } from '../age';
import { DAILY_METRIC_LIMITS, HEART_RATE_LIMITS, WEARABLE_SYNC } from '../constants';
import { isoDateInTimeZone } from '../dates';
import { type EnduranceModality, WEARABLE_PROVIDERS } from '../enums';

/**
 * Smartwatch-Daten über Health Connect (Phase 8 Etappe 1, docs/PLAN-PHASE-8.md 3, 5, 6): Listen und Eingabe-Schemas
 * des Imports. Dieselben Regeln prüft die Datenbank-Funktion import_wearable_batch (Abgleich in db-sync.test.ts) und
 * der Testmodus der App. Gespeichert werden nur Tageswerte und Summen je Einheit (W8-6) – nie Pulsreihen, nie
 * Schlafphasen. Routen der Uhr (seit 23.10.2026) speichert save_wearable_route als Strecke (wearables/route.ts).
 */

/**
 * Datentypen, die Alpha5 aus Health Connect LIEST (W8-2, W8-3) – je eine Systemberechtigung (READ_*). Die Person kann
 * einzelne abwählen; die App arbeitet mit dem Rest weiter.
 */
export const WEARABLE_DATA_TYPES = [
  'exercise',
  'distance',
  'calories',
  'heart_rate',
  'resting_heart_rate',
  'sleep',
  'steps',
] as const;
export type WearableDataType = (typeof WEARABLE_DATA_TYPES)[number];

/**
 * App, die eine Einheit in Health Connect geschrieben hat (aus `metadata.dataOrigin`, dem Paketnamen). Gespeichert
 * wird nur dieser Schlüssel, nie der Paketname – Anzeige „aus Samsung Health“.
 */
export const WEARABLE_ORIGINS = [
  'samsung_health',
  'google_fit',
  'fitbit',
  'garmin',
  'polar',
  'other',
] as const;
export type WearableOrigin = (typeof WEARABLE_ORIGINS)[number];

/** Bekannte Paketnamen → Herkunft (alles andere: `other`). */
export const WEARABLE_ORIGIN_PACKAGES: Readonly<Record<string, WearableOrigin>> = {
  'com.sec.android.app.shealth': 'samsung_health',
  'com.google.android.apps.fitness': 'google_fit',
  'com.fitbit.FitbitMobile': 'fitbit',
  'com.garmin.android.apps.connectmobile': 'garmin',
  'fi.polar.polarflow': 'polar',
};

export function originFromPackage(packageName: string | null | undefined): WearableOrigin {
  if (!packageName) return 'other';
  return WEARABLE_ORIGIN_PACKAGES[packageName] ?? 'other';
}

/**
 * Sportart-Gruppe einer übernommenen Einheit: die vier Ausdauer-Arten des Tagebuchs, Kraft (freie Kraft-Einheit) und
 * „Sonstige“ (Yoga, Wandern, Tennis … – freie Einheit mit Titel, ohne Übungen). Gruppen entscheiden auch über Doppel.
 */
export const WEARABLE_SESSION_GROUPS = [
  'run',
  'walk',
  'bike',
  'swim',
  'strength',
  'other',
] as const;
export type WearableSessionGroup = (typeof WEARABLE_SESSION_GROUPS)[number];

/** Ausdauer-Art der Gruppe (Tagebuch `cardio_logs.modality`), sonst null. */
export function groupModality(group: WearableSessionGroup): EnduranceModality | null {
  return group === 'strength' || group === 'other' ? null : group;
}

/**
 * Titel einer übernommenen Einheit: nur Buchstaben (inkl. Umlaute), Leerzeichen und Bindestrich, 1–60 Zeichen – der
 * Name kommt aus der Trainingsart (mapExerciseType), nie aus Freitext der Uhr. Gleiche Regel in import_wearable_batch.
 */
export const WEARABLE_NAME_PATTERN = '^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß -]{0,59}$';

const int = (limits: { min: number; max: number }) =>
  z.number().int().min(limits.min).max(limits.max);

const isoDateTime = z.iso.datetime({ offset: true });

/**
 * Puls-Zusammenfassung einer Einheit (W8-6, Tabelle heart_rate_summaries): Ø, Max und Sekunden je Zone 1–5, dazu der
 * verwendete HFmax (geschätzt oder eigener Wert) – nie die Messreihe.
 */
export const heartRateSummarySchema = z
  .object({
    avg_bpm: int(HEART_RATE_LIMITS.sampleBpm),
    max_bpm: int(HEART_RATE_LIMITS.sampleBpm),
    zone_s: z.array(int({ min: 0, max: WEARABLE_SYNC.durationS.max })).length(5),
    hf_max_used: int(HEART_RATE_LIMITS.maxOverrideBpm),
  })
  .strict()
  .refine((s) => s.max_bpm >= s.avg_bpm, { message: 'max_below_avg' });
export type HeartRateSummary = z.infer<typeof heartRateSummarySchema>;

/** Sekunden zwischen zwei ISO-Zeitstempeln (gerundet). */
export function secondsBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 1000);
}

/**
 * Eine übernommene Einheit (Eingabe von import_wearable_batch). Felder:
 * - `external_id`: Health-Connect-`metadata.id` – derselbe Datensatz ändert beim nächsten Abgleich, legt nie neu an,
 * - `duration_s` = Ende − Beginn (gerundet), 1 min–12 h (CARDIO_LOG_LIMITS), `performed_on` = Tag des Beginns in
 *   Europe/Berlin (wie enduranceTotals),
 * - `distance_m` nur bei Ausdauer, `kcal` (TotalCaloriesBurned im Zeitraum der Einheit) optional,
 * - `merge_into`: eigener Eintrag, in den die Uhr-Einheit eingeht (App führend, W8-9),
 * - `possible_duplicate_of`: eigener Eintrag, der vielleicht dieselbe Einheit ist – die Person entscheidet.
 */
export const wearableSessionImportSchema = z
  .object({
    external_id: z.string().min(1).max(WEARABLE_SYNC.externalIdMaxLength),
    origin: z.enum(WEARABLE_ORIGINS),
    group: z.enum(WEARABLE_SESSION_GROUPS),
    name_de: z
      .string()
      .min(1)
      .max(WEARABLE_SYNC.nameMaxLength)
      .regex(new RegExp(WEARABLE_NAME_PATTERN)),
    started_at: isoDateTime,
    finished_at: isoDateTime,
    performed_on: isoDateSchema,
    duration_s: int(WEARABLE_SYNC.durationS),
    distance_m: int(WEARABLE_SYNC.distanceM).nullable(),
    kcal: int(WEARABLE_SYNC.kcal).nullable(),
    heart_rate: heartRateSummarySchema.nullable(),
    merge_into: z.uuid().nullable(),
    possible_duplicate_of: z.uuid().nullable(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (secondsBetween(s.started_at, s.finished_at) !== s.duration_s) {
      ctx.addIssue({ code: 'custom', message: 'duration_mismatch', path: ['duration_s'] });
    }
    if (isoDateInTimeZone(s.started_at) !== s.performed_on) {
      ctx.addIssue({ code: 'custom', message: 'day_mismatch', path: ['performed_on'] });
    }
    if (groupModality(s.group) === null && s.distance_m !== null) {
      ctx.addIssue({ code: 'custom', message: 'distance_without_endurance', path: ['distance_m'] });
    }
    if (s.heart_rate && s.heart_rate.zone_s.reduce((a, b) => a + b, 0) > s.duration_s) {
      ctx.addIssue({ code: 'custom', message: 'zones_too_long', path: ['heart_rate'] });
    }
    if (s.merge_into !== null && s.possible_duplicate_of !== null) {
      ctx.addIssue({ code: 'custom', message: 'merge_and_duplicate', path: ['merge_into'] });
    }
  });
export type WearableSessionImport = z.infer<typeof wearableSessionImportSchema>;

/** Tageswerte (Tabelle daily_metrics): Ruhepuls, Schlafdauer (Aufwachtag), Schritte – mindestens einer. */
export const dailyMetricImportSchema = z
  .object({
    day: isoDateSchema,
    resting_hr_bpm: int(DAILY_METRIC_LIMITS.restingHrBpm).nullable(),
    sleep_min: int(DAILY_METRIC_LIMITS.sleepMin).nullable(),
    steps: int(DAILY_METRIC_LIMITS.steps).nullable(),
  })
  .strict()
  .refine((d) => d.resting_hr_bpm !== null || d.sleep_min !== null || d.steps !== null, {
    message: 'empty_day',
  });
export type DailyMetricImport = z.infer<typeof dailyMetricImportSchema>;

/** Ein Abgleich (ein Aufruf von import_wearable_batch). */
export const wearableImportBatchSchema = z
  .object({
    provider: z.enum(WEARABLE_PROVIDERS),
    granted_types: z.array(z.enum(WEARABLE_DATA_TYPES)).max(WEARABLE_DATA_TYPES.length),
    sessions: z.array(wearableSessionImportSchema).max(WEARABLE_SYNC.maxSessionsPerBatch),
    days: z.array(dailyMetricImportSchema).max(WEARABLE_SYNC.maxDaysPerBatch),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (new Set(b.granted_types).size !== b.granted_types.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate_type', path: ['granted_types'] });
    }
    if (new Set(b.sessions.map((s) => s.external_id)).size !== b.sessions.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate_session', path: ['sessions'] });
    }
    if (new Set(b.days.map((d) => d.day)).size !== b.days.length) {
      ctx.addIssue({ code: 'custom', message: 'duplicate_day', path: ['days'] });
    }
  });
export type WearableImportBatch = z.infer<typeof wearableImportBatchSchema>;

/** Antwort von import_wearable_batch (Anzahl je Ergebnis, ohne Werte). */
export const wearableImportResultSchema = z
  .object({
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    merged: z.number().int().min(0),
    skipped: z.number().int().min(0),
    days: z.number().int().min(0),
  })
  .strict();
export type WearableImportResult = z.infer<typeof wearableImportResultSchema>;
