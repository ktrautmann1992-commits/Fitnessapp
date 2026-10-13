import { z } from 'zod';

import { ageInYears, isoDateSchema } from '../age';
import {
  BMI_LIMITS,
  BODY_METRIC_LIMITS,
  KCAL_PER_KG_BODY_WEIGHT,
  NUTRITION_AGE_RULES,
  NUTRITION_MAX_AGE_YEARS,
  WEIGHT_GOAL_AGE_ITERATIONS,
  WEIGHT_GOAL_LIMITS,
  WEIGHT_GOAL_MIN_CAPACITY_KCAL,
  WEIGHT_GOAL_PACE_LEVELS,
  WEIGHT_GOAL_POINTER_MARGIN,
  WEIGHT_GOAL_SCALE_MAX_PACE,
  WEIGHT_OUTDATED_AFTER_DAYS,
} from '../constants';
import { addDays, daysBetween } from '../dates';
import { bodyMassIndex, type DatedValue, latestBodyValues } from '../nutrition/body-data';
import { nutritionEligibility } from '../nutrition/eligibility';
import { dayEnergy } from '../nutrition/energy';
import { applyGoalAdjustment, clampCalorieTarget, dayLimitContext } from '../nutrition/limits';
import {
  type NutritionInputs,
  type NutritionInputsInput,
  nutritionInputsSchema,
} from '../nutrition/schemas';
import { goalEnergyDirection, hasGoal } from './profile';
import { WEIGHT_GOAL_DAYS } from './weight-goal-schema';

/**
 * Erreichbarkeits-Ampel für ein konkretes Abnehmziel (docs/PLAN-ZIELE.md 3.1, Etappe Z2). Reine Funktion, live
 * aufrufbar (offline, bei jeder Eingabe). Sie rechnet KEINE eigenen Grenzen, sondern ruft `dayEnergy`,
 * `nutritionEligibility` und `clampCalorieTarget` auf – wie die Engine (Wächter S1, S6).
 *
 * - Benötigtes Tempo r = (w0 − wZiel) / Wochen / m mit m = (w0 + wZiel) / 2.
 * - Kapazität: Defizit der Standard-Anpassung am Ruhetag nach `clampCalorieTarget` (ungerundet), im strengsten Stand
 *   des Zeitraums: D_C = min(D(heute), D(am Ziel)). Am Ziel: Zielgewicht, BMI-Klasse des Zielgewichts, Alter am
 *   Zieldatum und – bei nutzbarer Körperfett-Messung (≤ 90 Tage) – derselbe Körperfett-Anteil (Wächter N2).
 *   v_C = D_C × 7 / 7700 kg/Woche, C = v_C / m.
 * - D_C ≤ WEIGHT_GOAL_MIN_CAPACITY_KCAL → Zustand `no_deficit` (keine Stufe, kein N).
 * - Stufen mit Toleranz EPS, r und C werden nie gerundet verglichen (Wächter S9).
 * - Sichere Dauer N = ceil(Δ / min(v_C, 0,75 % × m) − EPS), mit dem Alter am Ende von N (höchstens 3 Durchläufe);
 *   N > 104 → kein N und kein Knopf (Wächter S2, S3); Knopf = max(N, 4).
 * - Zeiger x = 1 − min(r / 1,25 %, 1), beidseitig in die Zone der Stufe geklemmt (Wächter S5, K-a).
 * Nur Planungsdauer (F7): kein Datum, keine Gewichtsprognose. Werte nie in Logs/Analytics (Wächter K7).
 */

/** Toleranz für Vergleiche und `ceil` (wie in `nutrition/limits.ts`). */
export const WEIGHT_GOAL_EPS = 1e-9;

export const WEIGHT_GOAL_LEVELS = [
  'green',
  'yellow',
  'orange_calmer',
  'orange_slower',
  'red',
] as const;
export type WeightGoalLevel = (typeof WEIGHT_GOAL_LEVELS)[number];

export const WEIGHT_GOAL_ZONES = ['red', 'orange', 'yellow', 'green'] as const;
export type WeightGoalZone = (typeof WEIGHT_GOAL_ZONES)[number];

/** Gründe, aus denen es kein konkretes Ziel geben kann (Option deaktiviert, Plan 2.3). */
export const WEIGHT_GOAL_BLOCK_REASONS = [
  'not_fat_loss',
  'no_consent',
  'body_data_missing',
  'pregnancy',
  'minor',
  'weight_outdated',
  'underweight',
  'health_check_missing',
] as const;
export type WeightGoalBlockReason = (typeof WEIGHT_GOAL_BLOCK_REASONS)[number];

/** Harte Fehler eines konkreten Ziels (Speichern unmöglich, keine Ampel, Plan 2.3). */
export const WEIGHT_GOAL_INVALID_REASONS = [
  'not_below_current',
  'below_min_kg',
  'target_out_of_range',
  'target_bmi_too_low',
  'period_out_of_range',
] as const;
export type WeightGoalInvalidReason = (typeof WEIGHT_GOAL_INVALID_REASONS)[number];

/** Erlaubte Hinweise zum Ziel (kein Fehler): Ziel-BMI 18,5 bis unter 20 (vorläufig, F8). */
export const WEIGHT_GOAL_INPUT_NOTICES = ['low_target_bmi'] as const;
export type WeightGoalInputNotice = (typeof WEIGHT_GOAL_INPUT_NOTICES)[number];

export interface WeightGoalBody {
  readonly weightKg: number;
  readonly weightMeasuredOn: string;
  readonly heightCm: number;
  readonly bodyFat: DatedValue | null;
}

export type WeightGoalAvailability =
  | { readonly available: true; readonly body: WeightGoalBody }
  | { readonly available: false; readonly reason: WeightGoalBlockReason };

/**
 * Gibt es für diese Person heute ein konkretes Abnehmziel (Plan 2.3)? Reihenfolge der Gründe: Abnehmen als Ziel,
 * Einwilligung, Größe/Gewicht, Schwangerschaft, unter 18, Gewicht älter als 90 Tage, BMI < 18,5, kein Check (nicht
 * männlich). Die Gründe entsprechen den Sonderfällen von `nutritionEligibility` (dort `no_targets`/`maintenance_only`).
 */
export function weightGoalAvailability(rawInputs: NutritionInputsInput): WeightGoalAvailability {
  return availabilityOf(nutritionInputsSchema.parse(rawInputs));
}

function availabilityOf(inputs: NutritionInputs): WeightGoalAvailability {
  const blocked = (reason: WeightGoalBlockReason) => ({ available: false as const, reason });
  if (!hasGoal({ primary: inputs.goalType, secondary: inputs.secondaryGoalType }, 'fat_loss')) {
    return blocked('not_fat_loss');
  }
  if (!inputs.healthDataConsent) return blocked('no_consent');
  const latest = latestBodyValues(inputs.bodyMetricsRows, inputs.today);
  if (latest.weight === null || latest.height === null) return blocked('body_data_missing');
  const flags = inputs.healthFlags?.flags ?? null;
  if (flags?.includes('pregnancy') === true) return blocked('pregnancy');
  if (ageInYears(inputs.birthDate, inputs.today) < NUTRITION_AGE_RULES.minorBelowAge) {
    return blocked('minor');
  }
  if (daysBetween(latest.weight.measuredOn, inputs.today) > WEIGHT_OUTDATED_AFTER_DAYS) {
    return blocked('weight_outdated');
  }
  if (bodyMassIndex(latest.weight.value, latest.height.value) < BMI_LIMITS.underweight) {
    return blocked('underweight');
  }
  if (flags === null && inputs.sex !== 'male') return blocked('health_check_missing');
  return {
    available: true,
    body: {
      weightKg: latest.weight.value,
      weightMeasuredOn: latest.weight.measuredOn,
      heightCm: latest.height.value,
      bodyFat: latest.bodyFat,
    },
  };
}

/** Ist das Zielgewicht bei dieser Größe zulässig (Ziel-BMI ≥ Untergrenze, vorläufig F8)? Mit der NEUESTEN Größe. */
export function isTargetBmiAllowed(targetWeightKg: number, heightCm: number): boolean {
  return (
    bodyMassIndex(targetWeightKg, heightCm) >= WEIGHT_GOAL_LIMITS.minTargetBmi - WEIGHT_GOAL_EPS
  );
}

/**
 * Defizit der Standard-Anpassung am Ruhetag für einen Stand (Gewicht, Alter), ungerundet:
 * D = Grundbedarf − clampCalorieTarget(Grundbedarf × (1 + Standard-Anpassung)).unroundedKcal. Kann negativ sein
 * (Grundbedarf mit `bmrForNeeds`, Untergrenzen mit `limitNeeds`, Wächter S1). Körperfett: gleicher Anteil, wenn die
 * Messung an `inputs.today` nutzbar ist (Wächter N2).
 */
export function restDayStandardDeficitKcal(
  rawInputs: NutritionInputsInput,
  state: { readonly weightKg: number; readonly ageYears: number },
): number {
  const inputs = nutritionInputsSchema.parse(rawInputs);
  const latest = latestBodyValues(inputs.bodyMetricsRows, inputs.today);
  if (latest.height === null) throw new RangeError('Ohne Größe gibt es keine Kapazität.');
  return deficitFor(inputs, latest.height.value, latest.bodyFat, state);
}

function deficitFor(
  inputs: NutritionInputs,
  heightCm: number,
  bodyFat: DatedValue | null,
  state: { readonly weightKg: number; readonly ageYears: number },
): number {
  const weightKg = z
    .number()
    .min(BODY_METRIC_LIMITS.weightKg.min)
    .max(BODY_METRIC_LIMITS.weightKg.max)
    .parse(state.weightKg);
  const ageYears = Math.min(state.ageYears, NUTRITION_MAX_AGE_YEARS);
  const goals = { primary: inputs.goalType, secondary: inputs.secondaryGoalType };
  const eligibility = nutritionEligibility({
    ageYears,
    sex: inputs.sex,
    goalType: inputs.goalType,
    secondaryGoalType: inputs.secondaryGoalType,
    healthDataConsent: inputs.healthDataConsent,
    body: { weightKg, heightCm },
    healthFlags: inputs.healthDataConsent ? (inputs.healthFlags?.flags ?? null) : null,
  });
  if (eligibility.mode === 'no_targets') return Number.NEGATIVE_INFINITY;
  // Ruhetag; `day = today`, damit die Körperfett-Messung nach ihrem Alter HEUTE zählt (≤ 90 Tage, N2) – auch für
  // den Stand am Ziel (gleicher Prozentwert am Zielgewicht).
  const energy = dayEnergy({
    day: inputs.today,
    weightKg,
    heightCm,
    ageYears,
    sex: inputs.sex,
    bodyFat,
    activityLevel: inputs.activityLevel,
    sessions: [],
  });
  const adjustment = applyGoalAdjustment(goals, inputs.experienceLevel, eligibility.mode);
  const context = dayLimitContext({
    energy,
    eligibility,
    weightKg,
    goalIsSurplus: goalEnergyDirection(goals) === 'surplus',
  });
  const clamped = clampCalorieTarget(energy.baseNeeds * (1 + adjustment), context);
  return energy.baseNeeds - clamped.unroundedKcal;
}

export interface WeightGoalCapacity {
  /** D(heute) in kcal/Tag (ungerundet, kann negativ sein). */
  readonly todayKcal: number;
  /** D(am Ziel) in kcal/Tag. */
  readonly atTargetKcal: number;
  /** D_C = min(heute, am Ziel). */
  readonly kcal: number;
  /** Alter im Stand „am Ziel“ (am Zieldatum). */
  readonly atTargetAgeYears: number;
}

/**
 * Kapazität D_C (Plan 3.1, Wächter S6, N2): Minimum aus „heute“ (w0, Alter heute) und „am Ziel“ (wZiel, Alter am
 * Zieldatum). Wird auch von der Engine genutzt, um ein bestehendes Ziel in `no_deficit` zu erkennen (Wächter K-d);
 * dort mit dem Alter am gerechneten Tag (`ageOn`).
 */
export function weightGoalCapacity(
  rawInputs: NutritionInputsInput,
  rawGoal: { readonly targetWeightKg: number; readonly targetDate: string },
  options?: { readonly ageOn?: string },
): WeightGoalCapacity {
  const inputs = nutritionInputsSchema.parse(rawInputs);
  const goal = feasibilityGoalSchema.parse(rawGoal);
  const latest = latestBodyValues(inputs.bodyMetricsRows, inputs.today);
  if (latest.height === null || latest.weight === null) {
    throw new RangeError('Ohne Größe und Gewicht gibt es keine Kapazität.');
  }
  return capacityOf(
    inputs,
    latest.height.value,
    latest.weight.value,
    latest.bodyFat,
    goal,
    options?.ageOn === undefined ? inputs.today : isoDateSchema.parse(options.ageOn),
  );
}

function capacityOf(
  inputs: NutritionInputs,
  heightCm: number,
  weightKg: number,
  bodyFat: DatedValue | null,
  goal: { readonly targetWeightKg: number; readonly targetDate: string },
  ageOn: string = inputs.today,
): WeightGoalCapacity {
  const targetDate = isoDateSchema.parse(goal.targetDate);
  // Stand „heute“: aktuelles Gewicht; das Alter an `ageOn` (die Engine rechnet je Tag d, z. B. 18. Geburtstag in der
  // Woche). Körperfett zählt immer nach seinem Alter an `inputs.today`.
  const ageToday = ageInYears(inputs.birthDate, ageOn);
  const atTargetAgeYears = targetDate > ageOn ? ageInYears(inputs.birthDate, targetDate) : ageToday;
  const todayKcal = deficitFor(inputs, heightCm, bodyFat, { weightKg, ageYears: ageToday });
  const atTargetKcal = deficitFor(inputs, heightCm, bodyFat, {
    weightKg: goal.targetWeightKg,
    ageYears: atTargetAgeYears,
  });
  return {
    todayKcal,
    atTargetKcal,
    kcal: Math.min(todayKcal, atTargetKcal),
    atTargetAgeYears,
  };
}

/** Ist mit dieser Kapazität ein Defizit planbar (D_C > 1 kcal, Wächter S1)? */
export function hasPlannableDeficit(deficitKcal: number): boolean {
  return deficitKcal > WEIGHT_GOAL_MIN_CAPACITY_KCAL;
}

/** Kapazität in kg/Woche (Planungswert 7.700 kcal/kg). */
export function capacityKgPerWeek(deficitKcal: number): number {
  return (deficitKcal * 7) / KCAL_PER_KG_BODY_WEIGHT;
}

/** Stufe aus r und C (Plan 3.1, Tabelle; lückenlos und eindeutig, Vergleiche mit EPS). */
export function weightGoalLevel(requiredPace: number, capacityPace: number): WeightGoalLevel {
  const P = WEIGHT_GOAL_PACE_LEVELS;
  if (requiredPace > P.orange + WEIGHT_GOAL_EPS) return 'red';
  if (requiredPace > capacityPace + WEIGHT_GOAL_EPS) return 'orange_slower';
  if (requiredPace > P.yellow + WEIGHT_GOAL_EPS) return 'orange_calmer';
  if (requiredPace > P.green + WEIGHT_GOAL_EPS) return 'yellow';
  return 'green';
}

/** Zonengrenzen auf der Skala (x von Rot = 0 nach Grün = 1). */
const zoneBoundary = (pace: number) => 1 - pace / WEIGHT_GOAL_SCALE_MAX_PACE;
const ZONE_INTERVALS: Record<WeightGoalZone, readonly [number, number]> = {
  red: [0, zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.orange)],
  orange: [
    zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.orange),
    zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.yellow),
  ],
  yellow: [
    zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.yellow),
    zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.green),
  ],
  green: [zoneBoundary(WEIGHT_GOAL_PACE_LEVELS.green), 1],
};

/** Zone einer Stufe (beide Orange-Stufen → Orange). */
export function zoneOfLevel(level: WeightGoalLevel): WeightGoalZone {
  return level === 'orange_calmer' || level === 'orange_slower' ? 'orange' : level;
}

/** Zone einer Zeigerposition x ∈ [0; 1]: Rot [0; 0,2), Orange [0,2; 0,4), Gelb [0,4; 0,6), Grün [0,6; 1]. */
export function pointerZone(x: number): WeightGoalZone {
  if (x < ZONE_INTERVALS.red[1]) return 'red';
  if (x < ZONE_INTERVALS.orange[1]) return 'orange';
  if (x < ZONE_INTERVALS.yellow[1]) return 'yellow';
  return 'green';
}

/**
 * Zeigerposition (Wächter S5, K-a): x = 1 − min(r / 1,25 %, 1), dann beidseitig in die Zone der Stufe geklemmt:
 * min(max(x, links + 0,01), rechts − 0,01), bei Grün rechts bis 1. Zeiger-Zone und Stufe sind so immer gleich.
 */
export function weightGoalPointer(
  requiredPace: number,
  level: WeightGoalLevel,
): { readonly raw: number; readonly display: number } {
  const raw = 1 - Math.min(Math.max(requiredPace, 0) / WEIGHT_GOAL_SCALE_MAX_PACE, 1);
  const zone = zoneOfLevel(level);
  const [left, right] = ZONE_INTERVALS[zone];
  const upper = zone === 'green' ? 1 : right - WEIGHT_GOAL_POINTER_MARGIN;
  return { raw, display: Math.min(Math.max(raw, left + WEIGHT_GOAL_POINTER_MARGIN), upper) };
}

export interface WeightGoalRated {
  readonly state: 'rated';
  readonly level: WeightGoalLevel;
  readonly zone: WeightGoalZone;
  /** r: benötigtes Tempo als Anteil des mittleren Gewichts pro Woche (ungerundet). */
  readonly requiredPace: number;
  /** C: Kapazität als Anteil des mittleren Gewichts pro Woche (ungerundet). */
  readonly capacityPace: number;
  /** v_C in kg/Woche. */
  readonly capacityKgPerWeek: number;
  readonly capacity: WeightGoalCapacity;
  readonly kgToLose: number;
  readonly meanWeightKg: number;
  /** Gewünschter Zeitraum in Wochen (ganze Tage / 7). */
  readonly weeks: number;
  /**
   * Sichere Dauer N in Wochen; null, wenn sie über 104 Wochen liegt oder mit dem Alter am Ende von N kein Defizit mehr
   * planbar ist (dann „Über 2 Jahre – wir empfehlen ‚ohne festes Ziel‘“, Wächter S2).
   */
  readonly safeWeeks: number | null;
  /** N > 104 Wochen bzw. kein N planbar. */
  readonly safeWeeksOverMax: boolean;
  /** Knopf „Zeitraum auf N Wochen setzen“ = max(N, 4) – nur bei Orange und Rot und wenn N ≤ 104. */
  readonly suggestedWeeks: number | null;
  readonly pointer: { readonly raw: number; readonly display: number };
  readonly notices: readonly WeightGoalInputNotice[];
}

export type WeightGoalFeasibility =
  | { readonly state: 'unavailable'; readonly reason: WeightGoalBlockReason }
  | { readonly state: 'invalid'; readonly reasons: readonly WeightGoalInvalidReason[] }
  | { readonly state: 'no_deficit'; readonly capacity: WeightGoalCapacity }
  | WeightGoalRated;

/** Zielgewicht und Zieldatum (weitere Felder eines gespeicherten Ziels werden ignoriert). */
const feasibilityGoalSchema = z.object({
  targetWeightKg: z.number().finite(),
  targetDate: isoDateSchema,
});

/** Harte Fehler zu Menge und Zeitraum (Plan 2.3) mit der neuesten Größe und dem neuesten Gewicht. */
export function weightGoalInvalidReasons(
  body: Pick<WeightGoalBody, 'weightKg' | 'heightCm'>,
  goal: { readonly targetWeightKg: number; readonly days: number },
): WeightGoalInvalidReason[] {
  const reasons: WeightGoalInvalidReason[] = [];
  const kg = body.weightKg - goal.targetWeightKg;
  if (kg <= WEIGHT_GOAL_EPS) reasons.push('not_below_current');
  else if (kg < WEIGHT_GOAL_LIMITS.minKg - WEIGHT_GOAL_EPS) reasons.push('below_min_kg');
  if (
    goal.targetWeightKg < BODY_METRIC_LIMITS.weightKg.min ||
    goal.targetWeightKg > BODY_METRIC_LIMITS.weightKg.max
  ) {
    reasons.push('target_out_of_range');
  } else if (!isTargetBmiAllowed(goal.targetWeightKg, body.heightCm)) {
    reasons.push('target_bmi_too_low');
  }
  if (goal.days < WEIGHT_GOAL_DAYS.min || goal.days > WEIGHT_GOAL_DAYS.max) {
    reasons.push('period_out_of_range');
  }
  return reasons;
}

/**
 * Ampel für ein konkretes Ziel ab heute (`inputs.today`): Zielgewicht und Zieldatum. Ohne Einwilligung, Gewicht oder
 * Größe usw. → `unavailable`; unzulässiges Ziel → `invalid` (keine Stufe); kein Defizit planbar → `no_deficit`.
 */
export function weightGoalFeasibility(
  rawInputs: NutritionInputsInput,
  rawGoal: { readonly targetWeightKg: number; readonly targetDate: string },
): WeightGoalFeasibility {
  const inputs = nutritionInputsSchema.parse(rawInputs);
  const goal = feasibilityGoalSchema.parse(rawGoal);
  const availability = availabilityOf(inputs);
  if (!availability.available) return { state: 'unavailable', reason: availability.reason };
  const { body } = availability;
  const days = daysBetween(inputs.today, goal.targetDate);
  const reasons = weightGoalInvalidReasons(body, { targetWeightKg: goal.targetWeightKg, days });
  if (reasons.length > 0) return { state: 'invalid', reasons };

  const w0 = body.weightKg;
  const wZiel = goal.targetWeightKg;
  const capacity = capacityOf(inputs, body.heightCm, w0, body.bodyFat, goal);
  if (!hasPlannableDeficit(capacity.kcal)) return { state: 'no_deficit', capacity };

  const kgToLose = w0 - wZiel;
  const meanWeightKg = (w0 + wZiel) / 2;
  const weeks = days / 7;
  const requiredPace = kgToLose / weeks / meanWeightKg;
  const vC = capacityKgPerWeek(capacity.kcal);
  const capacityPace = vC / meanWeightKg;
  const level = weightGoalLevel(requiredPace, capacityPace);

  // Sichere Dauer N (Wächter S2, S3): mit min(v_C, 0,75 % × m), dann mit dem Alter am Ende von N (N steigt nur).
  let deficitForN = capacity.kcal;
  let ageUsed = capacity.atTargetAgeYears;
  const safeWeeksFor = (deficitKcal: number) =>
    Math.ceil(
      kgToLose /
        Math.min(capacityKgPerWeek(deficitKcal), WEIGHT_GOAL_PACE_LEVELS.yellow * meanWeightKg) -
        WEIGHT_GOAL_EPS,
    );
  let safeWeeks: number | null = safeWeeksFor(deficitForN);
  for (let i = 0; i < WEIGHT_GOAL_AGE_ITERATIONS && safeWeeks !== null; i += 1) {
    if (safeWeeks > WEIGHT_GOAL_LIMITS.weeks.max) break;
    const end = addDays(inputs.today, safeWeeks * 7);
    if (end <= goal.targetDate) break;
    const ageEnd = ageInYears(inputs.birthDate, end);
    if (ageEnd <= ageUsed) break;
    ageUsed = ageEnd;
    deficitForN = Math.min(
      deficitForN,
      deficitFor(inputs, body.heightCm, body.bodyFat, { weightKg: wZiel, ageYears: ageEnd }),
    );
    safeWeeks = !hasPlannableDeficit(deficitForN)
      ? null
      : Math.max(safeWeeks, safeWeeksFor(deficitForN));
  }
  const safeWeeksOverMax = safeWeeks === null || safeWeeks > WEIGHT_GOAL_LIMITS.weeks.max;
  const showsButton = level !== 'green' && level !== 'yellow';
  const notices: WeightGoalInputNotice[] =
    bodyMassIndex(wZiel, body.heightCm) < WEIGHT_GOAL_LIMITS.lowTargetBmiNotice - WEIGHT_GOAL_EPS
      ? ['low_target_bmi']
      : [];
  return {
    state: 'rated',
    level,
    zone: zoneOfLevel(level),
    requiredPace,
    capacityPace,
    capacityKgPerWeek: vC,
    capacity,
    kgToLose,
    meanWeightKg,
    weeks,
    safeWeeks: safeWeeksOverMax ? null : safeWeeks,
    safeWeeksOverMax,
    suggestedWeeks:
      showsButton && !safeWeeksOverMax && safeWeeks !== null
        ? Math.max(safeWeeks, WEIGHT_GOAL_LIMITS.weeks.min)
        : null,
    pointer: weightGoalPointer(requiredPace, level),
    notices,
  };
}
