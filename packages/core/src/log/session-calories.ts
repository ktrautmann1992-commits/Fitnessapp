import { z } from 'zod';

import { BODY_METRIC_LIMITS, SESSION_KCAL, SESSION_RPE_LIMITS, WEARABLE_SYNC } from '../constants';
import {
  ENDURANCE_MODALITIES,
  type EnduranceModality,
  PLANNED_SESSION_KINDS,
  SPORT_IDS,
} from '../enums';
import type { LogSource, PlannedSessionKind, SportId } from '../enums';
import { metForSession } from '../nutrition/energy';
import { sportMet } from '../sports/catalogue';
import { sportForLog, sportLogDurationS } from '../sports/log';

/**
 * kcal je Einheit („kcal verbrannt“ an jeder Einheit; docs/KONZEPT.md Abschnitt 5, Konstanten SESSION_KCAL):
 * - Hat die Uhr einen Wert geliefert (Health Connect `TotalCaloriesBurned` im Zeitraum der Einheit), gilt er – Quelle
 *   `watch`, in der App „laut Uhr“.
 * - Sonst Schätzung brutto MET × kg × Stunden mit den MET-Werten der Ernährung (`metForSession`, TRAINING_MET) –
 *   Quelle `estimate`, in der App „geschätzt aus Dauer, Intensität und Gewicht“. Ohne Körpergewicht (keine
 *   Einwilligung Gesundheitsdaten oder nichts eingetragen) gibt es KEINE Zahl, nur den Grund.
 * Gerundet auf 5 kcal, gedeckelt auf SESSION_KCAL.maxKcal. Rein, ohne Speicher- oder Netzzugriff, nie loggen.
 */

const kindSchema = z.enum(PLANNED_SESSION_KINDS);

export const sessionCaloriesInputSchema = z.strictObject({
  kind: kindSchema,
  /** Sportart einer Ausdauer-Einheit; null = unbekannt (höchster lockerer MET-Wert, TRAINING_MET.unknownEndurance). */
  enduranceModality: z.enum(ENDURANCE_MODALITIES).nullable(),
  /** E-Bike (TRAINING_MET.eBike, niedriger als normales Rad); nur bei Sportart Rad wirksam. Fehlt = false. */
  eBike: z.boolean().default(false),
  /** Geplante Intensität 1–4 (`effort_target`); null = unbekannt (höherer Wert). */
  effortTarget: z.number().int().min(1).max(4).nullable(),
  /** Dauer in Sekunden (bei Strecken die Bewegungszeit); null = unbekannt. */
  durationS: z.number().finite().min(0).nullable(),
  /** Pausen in Sekunden, die noch in `durationS` stecken (werden abgezogen). */
  pausedS: z.number().finite().min(0).default(0),
  /** Körpergewicht in kg – nur mit gültiger Einwilligung Gesundheitsdaten übergeben; sonst null. */
  bodyWeightKg: z
    .number()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max)
    .nullable(),
  /**
   * Sportart (Sportarten Stufe 2): MET aus SPORT_CATALOGUE je Anstrengung `effort` (sportMet) statt Kraft/Ausdauer.
   * Fehlt = keine Sportart.
   */
  sport: z.enum(SPORT_IDS).nullable().default(null),
  /** Anstrengung 0–10 der Einheit (session_rpe) – nur bei Sportart genutzt; null = keine Angabe (hoher MET-Wert). */
  effort: z
    .number()
    .int()
    .min(SESSION_RPE_LIMITS.min)
    .max(SESSION_RPE_LIMITS.max)
    .nullable()
    .default(null),
  /** kcal der Uhr; null = keine Messung. 0 gilt als „keine Messung“. */
  measuredKcal: z
    .number()
    .finite()
    .min(WEARABLE_SYNC.kcal.min)
    .max(WEARABLE_SYNC.kcal.max)
    .nullable(),
});

export type SessionCaloriesInput = z.input<typeof sessionCaloriesInputSchema>;

/** Warum keine Zahl: kein Körpergewicht (Einwilligung/Eintrag fehlt) bzw. keine plausible Dauer. */
export type SessionCaloriesMissingReason = 'no_weight' | 'no_duration';

export type SessionCalories =
  | { readonly kcal: number; readonly source: 'watch'; readonly reason: null }
  | {
      readonly kcal: number;
      readonly source: 'estimate';
      readonly reason: null;
      /** Genutzter MET-Wert (nur zur Prüfung). */
      readonly met: number;
    }
  | { readonly kcal: null; readonly source: null; readonly reason: SessionCaloriesMissingReason };

/** Auf SESSION_KCAL.roundToKcal runden, mindestens ein Schritt, höchstens SESSION_KCAL.maxKcal. */
function roundKcal(value: number): number {
  const step = SESSION_KCAL.roundToKcal;
  const rounded = Math.max(step, Math.round(value / step) * step);
  return Math.min(rounded, SESSION_KCAL.maxKcal);
}

export function sessionCalories(raw: SessionCaloriesInput): SessionCalories {
  const input = sessionCaloriesInputSchema.parse(raw);
  if (input.measuredKcal !== null && input.measuredKcal > 0) {
    return { kcal: roundKcal(input.measuredKcal), source: 'watch', reason: null };
  }
  const durationS = input.durationS === null ? null : Math.max(0, input.durationS - input.pausedS);
  if (
    durationS === null ||
    durationS < SESSION_KCAL.minDurationS ||
    durationS > SESSION_KCAL.maxDurationS
  ) {
    return { kcal: null, source: null, reason: 'no_duration' };
  }
  if (input.bodyWeightKg === null) return { kcal: null, source: null, reason: 'no_weight' };
  const met =
    input.sport !== null
      ? sportMet(input.sport, input.effort)
      : metForSession({
          kind: input.kind,
          enduranceModality: input.kind === 'endurance' ? input.enduranceModality : null,
          effortTarget: input.effortTarget,
          eBike: input.eBike,
        });
  const kcal = met * input.bodyWeightKg * (durationS / 3600);
  return { kcal: roundKcal(kcal), source: 'estimate', reason: null, met };
}

/**
 * Darf die App kcal an Einheiten zeigen (wie die Ernährung)? `hidden` bei „Kalorienzahlen anzeigen“ aus bzw.
 * Schwangerschaft/Stillzeit (keine Energie-Zahlen, B5); `needs_consent` ohne gültige Einwilligung Gesundheitsdaten
 * (dann darf das Gewicht nicht genutzt werden); sonst `show`.
 */
export type SessionCaloriesVisibility = 'show' | 'hidden' | 'needs_consent';

const visibilitySchema = z.strictObject({
  showEnergyNumbers: z.boolean(),
  pregnancy: z.boolean(),
  healthConsent: z.enum(['valid', 'outdated', 'none']),
});

export function sessionCaloriesVisibility(raw: {
  readonly showEnergyNumbers: boolean;
  readonly pregnancy: boolean;
  readonly healthConsent: 'valid' | 'outdated' | 'none';
}): SessionCaloriesVisibility {
  const input = visibilitySchema.parse(raw);
  if (!input.showEnergyNumbers || input.pregnancy) return 'hidden';
  return input.healthConsent === 'valid' ? 'show' : 'needs_consent';
}

/** Tagebuch-Eintrag → Eingaben (ohne Gewicht/Uhr): Art, Sportart, Intensität des Plans, Dauer. */
export interface SessionCaloriesLogInput {
  readonly log: {
    readonly kind: PlannedSessionKind;
    readonly started_at: string | null;
    readonly finished_at: string | null;
    /** Sportarten Stufe 2 (fehlt bei älteren Aufrufern = keine Sportart). */
    readonly name_de?: string;
    readonly source?: LogSource;
    readonly session_rpe?: number | null;
    readonly sport?: SportId | null;
    readonly sport_duration_s?: number | null;
  };
  readonly cardio: {
    readonly modality: EnduranceModality;
    readonly duration_s: number;
    /** E-Bike (cardio_logs.e_bike); fehlt bei älteren Zeilen = false. */
    readonly e_bike?: boolean;
  } | null;
  readonly planned: {
    readonly endurance_modality: EnduranceModality | null;
    readonly effort_target: number | null;
    readonly estimated_minutes: number;
  } | null;
}

/**
 * Dauer eines Eintrags: Ausdauer = erfasste Dauer; Kraft = Ende − Beginn (enthält Satzpausen – die stecken im MET-Wert
 * für Krafttraining schon drin); ohne Zeiten die geplanten Minuten; sonst null.
 */
export function sessionLogDurationS(input: SessionCaloriesLogInput): number | null {
  if (input.cardio) return input.cardio.duration_s;
  if (
    input.log.name_de !== undefined &&
    sportForLog({ ...input.log, name_de: input.log.name_de })
  ) {
    return sportLogDurationS(input.log);
  }
  const { started_at: started, finished_at: finished } = input.log;
  if (started !== null && finished !== null) {
    const ms = Date.parse(finished) - Date.parse(started);
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 1000);
  }
  return input.planned ? input.planned.estimated_minutes * 60 : null;
}

/** Eingaben aus einem Tagebuch-Eintrag – ohne Gewicht und Uhr-Wert (die kommen aus der App). */
export function sessionCaloriesInputForLog(
  input: SessionCaloriesLogInput,
): Omit<SessionCaloriesInput, 'bodyWeightKg' | 'measuredKcal'> {
  const sport =
    input.log.name_de !== undefined && input.cardio === null
      ? sportForLog({ ...input.log, name_de: input.log.name_de })
      : null;
  return {
    kind: input.log.kind,
    enduranceModality: input.cardio?.modality ?? input.planned?.endurance_modality ?? null,
    effortTarget: input.planned?.effort_target ?? null,
    durationS: sessionLogDurationS(input),
    eBike: input.cardio?.modality === 'bike' && input.cardio.e_bike === true,
    ...(sport === null ? {} : { sport, effort: input.log.session_rpe ?? null }),
  };
}

export function sessionCaloriesForLog(
  input: SessionCaloriesLogInput & {
    readonly bodyWeightKg: number | null;
    readonly measuredKcal: number | null;
  },
): SessionCalories {
  return sessionCalories({
    ...sessionCaloriesInputForLog(input),
    bodyWeightKg: input.bodyWeightKg,
    measuredKcal: input.measuredKcal,
  });
}

/** Summe eines Tages (nur Einheiten mit Zahl); null, wenn keine Einheit eine Zahl hat. Quelle „watch“ nur, wenn alle. */
export function sessionCaloriesTotal(
  items: readonly SessionCalories[],
): { readonly kcal: number; readonly allFromWatch: boolean } | null {
  const known = items.filter(
    (i): i is Extract<SessionCalories, { kcal: number }> => i.kcal !== null,
  );
  if (known.length === 0) return null;
  return {
    kcal: known.reduce((sum, i) => sum + i.kcal, 0),
    allFromWatch: known.every((i) => i.source === 'watch'),
  };
}
