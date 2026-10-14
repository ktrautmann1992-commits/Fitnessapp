import { z } from 'zod';

import { isoDateSchema } from '../age';
import {
  ACTIVITY_FACTORS,
  BODY_METRIC_LIMITS,
  NUTRITION_MAX_AGE_YEARS,
  BODY_FAT_MAX_AGE_DAYS,
  JANMAHASATIAN_FFM,
  KATCH_MCARDLE,
  MIFFLIN_ST_JEOR,
  TRAINING_KCAL_DAY_MAX,
  TRAINING_MET,
} from '../constants';
import { daysBetween } from '../dates';
import type { ActivityLevel, Sex } from '../enums';
import { bodyMassIndex, type DatedValue } from './body-data';
import { sexSchema } from '../validation';
import { activityLevelSchema, type NutritionSession, nutritionSessionSchema } from './schemas';

/**
 * Energiebedarf (docs/PLAN-PHASE-5.md 4.3, 4.4). Alle Werte werden UNGERUNDET weitergerechnet (K1); gerundet wird
 * nur die Ausgabe, und zwar gerichtet (limits.ts).
 */

export interface MifflinInputs {
  readonly weightKg: number;
  readonly heightCm: number;
  readonly ageYears: number;
  /** null = keine Angabe (Mittelwert, −78). */
  readonly sex: Sex | null;
}

const mifflinInputsSchema = z.strictObject({
  weightKg: z.number().min(BODY_METRIC_LIMITS.weightKg.min).max(BODY_METRIC_LIMITS.weightKg.max),
  heightCm: z.number().min(BODY_METRIC_LIMITS.heightCm.min).max(BODY_METRIC_LIMITS.heightCm.max),
  ageYears: z.number().int().min(0).max(NUTRITION_MAX_AGE_YEARS),
  sex: sexSchema.nullable(),
});

/**
 * Grundumsatz nach Mifflin-St Jeor (kcal/Tag).
 * `purpose: 'needs'` (Vorschlag): divers/keine Angabe = Mittelwert (−78).
 * `purpose: 'limits'` (Schutzgrenzen): divers/keine Angabe = männlicher Offset (+5) – höherer Wert, sichere Richtung
 * (Wächter N1, S1).
 */
export function bmrMifflinStJeor(
  input: MifflinInputs,
  purpose: 'needs' | 'limits' = 'needs',
): number {
  const { weightKg, heightCm, ageYears, sex } = mifflinInputsSchema.parse({
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    ageYears: input.ageYears,
    sex: input.sex,
  });
  const f = MIFFLIN_ST_JEOR;
  const offset =
    purpose === 'limits' && sex !== 'male' && sex !== 'female'
      ? f.limitsSexOffsetUnknown
      : f.sexOffset[sex ?? 'unspecified'];
  return f.kgFactor * weightKg + f.cmFactor * heightCm - f.ageFactor * ageYears + offset;
}

/** Grundumsatz nach Katch-McArdle aus der fettfreien Masse (kcal/Tag). */
export function bmrKatchMcArdle(fatFreeMassKg: number): number {
  return KATCH_MCARDLE.intercept + KATCH_MCARDLE.ffmFactor * fatFreeMassKg;
}

/** Fettfreie Masse aus Gewicht und Körperfett in %. */
export function fatFreeMassFromBodyFat(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100);
}

/**
 * Geschätzte fettfreie Masse ohne Messung nach Janmahasatian 2005 (nur für die EA-Untergrenze, Plan 4.6 Nr. 4).
 * Divers/keine Angabe: `purpose: 'mean'` = Mittelwert der Formeln für Männer und Frauen; `purpose: 'limits'` = Formel
 * für Männer (höhere FFM → höhere, vorsichtigere EA-Untergrenze; Wächter N1, S1).
 */
export function estimateFatFreeMass(
  input: {
    readonly weightKg: number;
    readonly heightCm: number;
    readonly sex: Sex | null;
  },
  purpose: 'mean' | 'limits' = 'mean',
): number {
  if (purpose === 'limits' && input.sex !== 'female') {
    return estimateFatFreeMass({ ...input, sex: 'male' });
  }
  const bmi = bodyMassIndex(input.weightKg, input.heightCm);
  const formula = (c: { readonly a: number; readonly b: number }) =>
    (JANMAHASATIAN_FFM.numerator * input.weightKg) / (c.a + c.b * bmi);
  if (input.sex === 'male') return formula(JANMAHASATIAN_FFM.male);
  if (input.sex === 'female') return formula(JANMAHASATIAN_FFM.female);
  return (formula(JANMAHASATIAN_FFM.male) + formula(JANMAHASATIAN_FFM.female)) / 2;
}

/**
 * Darf die Körperfett-Messung an `onDate` genutzt werden (höchstens BODY_FAT_MAX_AGE_DAYS Tage alt)?
 * Ein Messdatum nach `onDate` (z. B. Eintrag für morgen) wird an diesem Tag noch nicht genutzt.
 */
export function isBodyFatUsable(bodyFat: DatedValue | null, onDate: string): boolean {
  if (bodyFat === null) return false;
  const age = daysBetween(bodyFat.measuredOn, onDate);
  return age >= 0 && age <= BODY_FAT_MAX_AGE_DAYS;
}

/** Alltagsfaktor ohne Sport; ohne Angabe 1,45 (Hinweis `activity_level_default`). */
export function activityFactor(level: ActivityLevel | null): number {
  return level === null ? ACTIVITY_FACTORS.default : ACTIVITY_FACTORS[level];
}

/** MET-Wert einer Einheit (lückenlos für `effort_target` 1–4 und fehlend, Plan 4.4, S11b). */
export function metForSession(
  session: Pick<NutritionSession, 'kind' | 'enduranceModality' | 'effortTarget'>,
): number {
  if (session.kind === 'strength') return TRAINING_MET.strength;
  if (session.enduranceModality === null) return TRAINING_MET.unknownEndurance;
  const table = TRAINING_MET.endurance[session.enduranceModality];
  if (session.effortTarget === null) return table.fallback;
  return session.effortTarget <= TRAINING_MET.lowEffortMax ? table.low : table.high;
}

/**
 * Welche Einheiten zählen an Tag `day` (Plan 4.4, S11a, R2-K3)?
 * - vergangene Tage: nur `completed` – aus dem aktiven UND aus ersetzten Plänen,
 * - heute: alle `completed` jeder Planversion plus `planned` des aktiven Plans,
 * - künftige Tage: nur `planned` des aktiven Plans.
 * `skipped` zählt nie. Jede Einheit höchstens einmal (Schlüssel `sessionId`).
 */
export function sessionsForDay(
  rawSessions: readonly NutritionSession[],
  rawDay: string,
  rawToday: string,
): NutritionSession[] {
  const sessions = z.array(nutritionSessionSchema).parse(rawSessions);
  const day = isoDateSchema.parse(rawDay);
  const today = isoDateSchema.parse(rawToday);
  const seen = new Set<string>();
  const result: NutritionSession[] = [];
  for (const session of sessions) {
    if (session.scheduledOn !== day || seen.has(session.sessionId)) continue;
    const completed = session.status === 'completed';
    const plannedActive = session.status === 'planned' && session.planStatus === 'active';
    const counts =
      day < today ? completed : day === today ? completed || plannedActive : plannedActive;
    if (counts) {
      seen.add(session.sessionId);
      result.push(session);
    }
  }
  return result;
}

export interface TrainingEnergy {
  /** Netto (MET − 1) × kg × h, gedeckelt auf TRAINING_KCAL_DAY_MAX – geht in Bedarf und Grenzen ein. */
  readonly netKcal: number;
  /** Netto ungedeckelt (nur zur Prüfung). */
  readonly netUncappedKcal: number;
  /** Brutto MET × kg × h, UNGEDECKELT – nur für die EA-Untergrenze (R2-K2, R2-S8). */
  readonly grossKcal: number;
  /** Greift der Deckel? Dann plant der Tag ohne Defizit (R2-S8). */
  readonly capped: boolean;
  /** Summe der Minuten aller gezählten Einheiten. */
  readonly minutes: number;
}

/** Trainingsenergie der gezählten Einheiten eines Tages. */
const trainingSessionsSchema = z.array(
  nutritionSessionSchema.pick({
    kind: true,
    enduranceModality: true,
    effortTarget: true,
    minutes: true,
  }),
);

export function trainingEnergy(
  rawSessions: readonly Pick<
    NutritionSession,
    'kind' | 'enduranceModality' | 'effortTarget' | 'minutes'
  >[],
  rawWeightKg: number,
): TrainingEnergy {
  const sessions = trainingSessionsSchema.parse(
    rawSessions.map((s) => ({
      kind: s.kind,
      enduranceModality: s.enduranceModality,
      effortTarget: s.effortTarget,
      minutes: s.minutes,
    })),
  );
  const weightKg = z
    .number()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max)
    .parse(rawWeightKg);
  let net = 0;
  let gross = 0;
  let minutes = 0;
  for (const session of sessions) {
    const met = metForSession(session);
    const hours = session.minutes / 60;
    net += (met - 1) * weightKg * hours;
    gross += met * weightKg * hours;
    minutes += session.minutes;
  }
  const capped = net > TRAINING_KCAL_DAY_MAX;
  return {
    netKcal: capped ? TRAINING_KCAL_DAY_MAX : net,
    netUncappedKcal: net,
    grossKcal: gross,
    capped,
    minutes,
  };
}

const datedValueSchema = z.strictObject({ value: z.number().finite(), measuredOn: isoDateSchema });

const dayEnergyInputsSchema = z.strictObject({
  day: isoDateSchema,
  weightKg: z.number().min(BODY_METRIC_LIMITS.weightKg.min).max(BODY_METRIC_LIMITS.weightKg.max),
  heightCm: z.number().min(BODY_METRIC_LIMITS.heightCm.min).max(BODY_METRIC_LIMITS.heightCm.max),
  ageYears: z.number().int().min(0).max(NUTRITION_MAX_AGE_YEARS),
  sex: sexSchema.nullable(),
  bodyFat: datedValueSchema
    .extend({
      value: z
        .number()
        .min(BODY_METRIC_LIMITS.bodyFatPct.min)
        .max(BODY_METRIC_LIMITS.bodyFatPct.max),
    })
    .nullable(),
  activityLevel: activityLevelSchema.nullable(),
  sessions: z.array(nutritionSessionSchema),
});

export interface DayEnergyInputs {
  readonly day: string;
  readonly weightKg: number;
  readonly heightCm: number;
  readonly ageYears: number;
  readonly sex: Sex | null;
  readonly bodyFat: DatedValue | null;
  readonly activityLevel: ActivityLevel | null;
  /** Bereits nach `sessionsForDay` gefilterte Einheiten. */
  readonly sessions: readonly NutritionSession[];
}

export interface DayEnergy {
  /** Mifflin für den Vorschlag (divers/keine Angabe −78). */
  readonly bmrMifflin: number;
  /** Mifflin für die Grenzen (divers/keine Angabe +5, S1). */
  readonly bmrMifflinForLimits: number;
  /** null, wenn kein Körperfett ≤ 90 Tage vorliegt. */
  readonly bmrKatch: number | null;
  /** Katch-McArdle, wenn zulässig, sonst Mifflin → NUR für den Vorschlag (B3). */
  readonly bmrForNeeds: number;
  /** max(Mifflin für Grenzen, Katch-McArdle) → Grundlage ALLER Schutzgrenzen (B3, R2-B1, S1). */
  readonly bmrForFloor: number;
  readonly activityFactor: number;
  /** Grundbedarf = bmrForNeeds × Alltagsfaktor (ohne Training) – Basis der Zielanpassung (S2). */
  readonly baseNeeds: number;
  /** Tagesbedarf = Grundbedarf + Trainingsenergie (nur Vorschlag). */
  readonly needs: number;
  /** TagesbedarfGrenze = bmrForFloor × Alltagsfaktor + Trainingsenergie (R2-B1). */
  readonly limitNeeds: number;
  readonly training: TrainingEnergy;
  /** Fettfreie Masse für die EA-Untergrenze: max(gemessen ≤ 90 Tage, Janmahasatian; divers = Männer-Formel). */
  readonly ffmForEnergyAvailability: number;
}

/** Grundumsatz für den Vorschlag (Katch-McArdle nur mit Körperfett ≤ 90 Tage). */
export function bmrForNeeds(mifflin: number, katch: number | null): number {
  return katch ?? mifflin;
}

/** Grundumsatz für alle Schutzgrenzen: max(Mifflin, Katch-McArdle). */
export function bmrForFloor(mifflin: number, katch: number | null): number {
  return katch === null ? mifflin : Math.max(mifflin, katch);
}

/** Tagesbedarf (nur Vorschlag): bmrForNeeds × Alltagsfaktor + Trainingsenergie. */
export function dailyEnergy(bmrNeeds: number, factor: number, trainingKcal: number): number {
  return bmrNeeds * factor + trainingKcal;
}

/** TagesbedarfGrenze (Grundlage aller Untergrenzen): bmrForFloor × Alltagsfaktor + Trainingsenergie. */
export function dailyEnergyForLimits(
  bmrFloor: number,
  factor: number,
  trainingKcal: number,
): number {
  return bmrFloor * factor + trainingKcal;
}

/** Alle Energiegrößen eines Tages. */
export function dayEnergy(rawInput: DayEnergyInputs): DayEnergy {
  const input = dayEnergyInputsSchema.parse(rawInput);
  const mifflin = bmrMifflinStJeor(input);
  const mifflinForLimits = bmrMifflinStJeor(input, 'limits');
  const bodyFatUsable = isBodyFatUsable(input.bodyFat, input.day);
  const measuredFfm =
    bodyFatUsable && input.bodyFat !== null
      ? fatFreeMassFromBodyFat(input.weightKg, input.bodyFat.value)
      : null;
  const katch = measuredFfm === null ? null : bmrKatchMcArdle(measuredFfm);
  const factor = activityFactor(input.activityLevel);
  const training = trainingEnergy(input.sessions, input.weightKg);
  const needsBmr = bmrForNeeds(mifflin, katch);
  const floorBmr = bmrForFloor(mifflinForLimits, katch);
  const estimatedFfm = estimateFatFreeMass(input, 'limits');
  return {
    bmrMifflin: mifflin,
    bmrMifflinForLimits: mifflinForLimits,
    bmrKatch: katch,
    bmrForNeeds: needsBmr,
    bmrForFloor: floorBmr,
    activityFactor: factor,
    baseNeeds: needsBmr * factor,
    needs: dailyEnergy(needsBmr, factor, training.netKcal),
    limitNeeds: dailyEnergyForLimits(floorBmr, factor, training.netKcal),
    training,
    ffmForEnergyAvailability:
      measuredFfm === null ? estimatedFfm : Math.max(measuredFfm, estimatedFfm),
  };
}
