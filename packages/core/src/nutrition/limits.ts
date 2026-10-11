import { z } from 'zod';

import {
  ACTIVITY_FACTORS,
  ADJUSTMENT_OFFSET_MAX_KCAL,
  ADJUSTMENT_STEP_MAX_KCAL,
  BODY_METRIC_LIMITS,
  EA_MIN_KCAL_PER_KG_FFM,
  GOAL_ENERGY_ADJUSTMENT,
  KCAL_PER_KG_BODY_WEIGHT,
  MAX_CALORIE_DEFICIT_FRACTION,
  MAX_WEEKLY_WEIGHT_GAIN_FRACTION,
  MAX_WEEKLY_WEIGHT_LOSS_FRACTION,
  MIN_INTAKE_RELATIVE_TO_BMR,
  NUTRITION_ROUNDING,
  PORTION_TOLERANCE,
  SURPLUS_CAP,
} from '../constants';
import type { ExperienceLevel, GoalType } from '../enums';
import { type CalorieCapCode, sortCaps } from './notices';
import { deficitCapSchema, surplusCapSchema } from './schemas';

/**
 * Schutzgrenzen der Ernährung (docs/PLAN-PHASE-5.md 4.6). `clampCalorieTarget` ist die EINZIGE Stelle, an der die
 * Kalorien-Schutzgrenzen aus CLAUDE.md gelten (S10, R2-S5) – auch für 4b-Anpassungen (der Versatz ist Teil des
 * Vorschlags). Kein Parameter, keine Einstellung und kein Testschalter lockert sie: Der Kontext wird mit Zod
 * geprüft (Defizitdeckel höchstens 25 %, Überschussdeckel 5–10 %, Bedarf für Grenzen ≥ Tagesbedarf).
 */

const EPS = 1e-9;
const positive = z.number().positive().finite();
const MIN_ACTIVITY_FACTOR = Math.min(
  ACTIVITY_FACTORS.sedentary,
  ACTIVITY_FACTORS.light,
  ACTIVITY_FACTORS.active,
  ACTIVITY_FACTORS.very_active,
  ACTIVITY_FACTORS.default,
);

/** Kontext eines Tages für die Schutzgrenzen (alle Werte ungerundet). */
export const calorieLimitContextSchema = z
  .strictObject({
    /** max(Mifflin, Katch-McArdle). */
    bmrForFloor: positive,
    /** Grundbedarf ohne Training (bmrForNeeds × Alltagsfaktor) – Basis des Überschussdeckels. */
    baseNeeds: positive,
    /** Tagesbedarf (Katch-basiert, nur Vorschlag und Überschuss-Obergrenze). */
    needs: positive,
    /** TagesbedarfGrenze – Grundlage ALLER Untergrenzen (R2-B1). */
    limitNeeds: positive,
    weightKg: z.number().min(BODY_METRIC_LIMITS.weightKg.min).max(BODY_METRIC_LIMITS.weightKg.max),
    /** Fettfreie Masse für die EA-Untergrenze. */
    ffmKg: positive,
    /** Trainingsenergie BRUTTO, ungedeckelt (R2-K2). */
    trainingGrossKcal: z.number().min(0).finite(),
    /** Trainingsenergie wurde gedeckelt → Tag ohne Defizit (R2-S8). */
    trainingCapped: z.boolean(),
    mode: z.enum(['full', 'maintenance_only']),
    /** Ziel mit Überschuss (`muscle_gain`) – nur im Modus `full` wirksam. */
    goalIsSurplus: z.boolean(),
    deficitCap: deficitCapSchema,
    surplusCap: surplusCapSchema,
  })
  .refine((ctx) => ctx.limitNeeds >= ctx.needs - EPS, {
    message: 'Der Bedarf für Grenzen ist nie kleiner als der Tagesbedarf.',
    path: ['limitNeeds'],
  })
  .refine((ctx) => ctx.limitNeeds >= MIN_ACTIVITY_FACTOR * ctx.bmrForFloor - EPS, {
    message: 'Der Bedarf für Grenzen liegt mindestens beim kleinsten Alltagsfaktor × Grundumsatz.',
    path: ['limitNeeds'],
  });
export type CalorieLimitContext = z.infer<typeof calorieLimitContextSchema>;

/** Wirksamer Defizitdeckel: 0 bei `maintenance_only` und an Tagen mit gedeckelter Trainingsenergie. */
export function effectiveDeficitCap(ctx: CalorieLimitContext): number {
  return ctx.mode === 'maintenance_only' || ctx.trainingCapped ? 0 : ctx.deficitCap;
}

export interface CalorieFloor {
  /** Maximum aller Untergrenzen (ungerundet). */
  readonly kcal: number;
  readonly parts: {
    /** 1. nie unter dem Grundumsatz (max(Mifflin, Katch)). */
    readonly bmr: number;
    /** 2. höchstens Defizitdeckel unter TagesbedarfGrenze. */
    readonly deficit: number;
    /** 3. höchstens ~1 % Körpergewicht pro Woche. */
    readonly weeklyLoss: number;
    /** 4. Energieverfügbarkeit ≥ 30 kcal/kg FFM (nie höher als TagesbedarfGrenze). */
    readonly energyAvailability: number;
  };
}

/** Untergrenze je Tag (Plan 4.6 Nr. 1–4). Alle Untergrenzen rechnen mit TagesbedarfGrenze (R2-B1). */
export function dayFloorKcal(context: CalorieLimitContext): CalorieFloor {
  const ctx = calorieLimitContextSchema.parse(context);
  const bmr = ctx.bmrForFloor * MIN_INTAKE_RELATIVE_TO_BMR;
  const deficit = ctx.limitNeeds * (1 - effectiveDeficitCap(ctx));
  const weeklyLoss =
    ctx.limitNeeds - (MAX_WEEKLY_WEIGHT_LOSS_FRACTION * ctx.weightKg * KCAL_PER_KG_BODY_WEIGHT) / 7;
  const energyAvailability = Math.min(
    ctx.limitNeeds,
    EA_MIN_KCAL_PER_KG_FFM * ctx.ffmKg + ctx.trainingGrossKcal,
  );
  return {
    kcal: Math.max(bmr, deficit, weeklyLoss, energyAvailability),
    parts: { bmr, deficit, weeklyLoss, energyAvailability },
  };
}

/**
 * Obergrenze je Tag (Plan 4.6, H3) – gilt in JEDEM Modus und für jedes Ziel, damit auch ein positiver 4b-Versatz
 * keinen Überschussdeckel umgeht. Nie unter der Untergrenze (die Untergrenze gewinnt immer).
 */
export function dayCeilingKcal(context: CalorieLimitContext): number {
  const ctx = calorieLimitContextSchema.parse(context);
  const floor = dayFloorKcal(ctx).kcal;
  if (ctx.goalIsSurplus && ctx.mode === 'full') {
    const gain = Math.min(
      ctx.surplusCap * ctx.baseNeeds,
      (MAX_WEEKLY_WEIGHT_GAIN_FRACTION * ctx.weightKg * KCAL_PER_KG_BODY_WEIGHT) / 7,
    );
    return Math.max(floor, ctx.needs + gain);
  }
  return Math.max(floor, ctx.limitNeeds * (1 + Math.min(SURPLUS_CAP.default, ctx.surplusCap)));
}

const ROUND = NUTRITION_ROUNDING.kcal;

/** Auf ein Vielfaches von `step` runden (kaufmännisch / auf / ab), robust gegen Gleitkomma-Reste. */
export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}
export function ceilTo(value: number, step: number): number {
  return Math.ceil(value / step - EPS) * step;
}
export function floorTo(value: number, step: number): number {
  return Math.floor(value / step + EPS) * step;
}

/**
 * Gerichtete Rundung (Plan 4.6.2, B2): kaufmännisch auf `step`, aber nie aus [min, max] heraus – Vergleich gegen die
 * UNGERUNDETEN Grenzen. Liegt kein Vielfaches von `step` im Bereich, gewinnt die Sicherheit: `ceil` der Untergrenze.
 */
export function roundWithin(value: number, min: number, max: number, step: number): number {
  const result = roundWithinUnchecked(value, min, max, step);
  // Nie unter der ungerundeten Untergrenze – auch nicht um Gleitkomma-Reste (Wächter N1, K5).
  return result < min ? result + step : result;
}

function roundWithinUnchecked(value: number, min: number, max: number, step: number): number {
  const rounded = roundTo(value, step);
  if (rounded >= min && rounded <= max + EPS) return rounded;
  if (rounded < min) return ceilTo(Math.max(value, min), step);
  const down = floorTo(Math.min(value, max), step);
  return down >= min ? down : ceilTo(min, step);
}

export interface ClampedCalorieTarget {
  /** Gerundetes Tagesziel (≥ Untergrenze; ≤ Obergrenze, außer beide liegen < 10 kcal auseinander). */
  readonly targetKcal: number;
  /** Ziel nach der Begrenzung, vor der Rundung. */
  readonly unroundedKcal: number;
  /** Untergrenze/Obergrenze ungerundet. */
  readonly floorKcal: number;
  readonly ceilingKcal: number;
  /** Planband für den ausgelieferten Essensplan (4.6.1), ungerundet, nur intern. */
  readonly band: { readonly min: number; readonly max: number };
  /** Greifende Grenzen. */
  readonly appliedCaps: readonly CalorieCapCode[];
}

/**
 * EINZIGE Stelle mit Kalorien-Schutzgrenzen (Plan 4.6, S10, R2-S5): Vorschlag (inkl. 4b-Versatz) → auf
 * [Untergrenze, Obergrenze] begrenzen → gerichtet runden. Die strengste Grenze gewinnt.
 */
export function clampCalorieTarget(
  proposedKcal: number,
  context: CalorieLimitContext,
): ClampedCalorieTarget {
  const proposed = z.number().finite().parse(proposedKcal);
  const ctx = calorieLimitContextSchema.parse(context);
  const floor = dayFloorKcal(ctx);
  const ceiling = dayCeilingKcal(ctx);
  const unrounded = Math.min(Math.max(proposed, floor.kcal), ceiling);
  const target = roundWithin(unrounded, floor.kcal, ceiling, ROUND);

  const caps = new Set<CalorieCapCode>();
  if (ctx.trainingCapped) caps.add('training_energy_capped');
  if (proposed < floor.kcal - EPS) {
    const binds = (value: number) => value >= floor.kcal - EPS;
    const effDeficit = effectiveDeficitCap(ctx);
    if (binds(floor.parts.bmr)) caps.add('bmr_floor');
    // An Tagen mit gedeckelter Trainingsenergie steht schon `training_energy_capped` in der Liste.
    if (binds(floor.parts.deficit) && !ctx.trainingCapped) {
      caps.add('deficit_cap');
      if (effDeficit < MAX_CALORIE_DEFICIT_FRACTION) caps.add('special_case_cap');
    }
    if (binds(floor.parts.weeklyLoss)) caps.add('weekly_loss_cap');
    if (binds(floor.parts.energyAvailability)) caps.add('energy_availability_cap');
  }
  if (proposed > ceiling + EPS) {
    caps.add('gain_cap');
    if (ctx.surplusCap < SURPLUS_CAP.default) caps.add('special_case_cap');
  }
  return {
    targetKcal: target,
    unroundedKcal: unrounded,
    floorKcal: floor.kcal,
    ceilingKcal: ceiling,
    band: planBand(target, floor.kcal, ceiling),
    appliedCaps: sortCaps(caps),
  };
}

/**
 * Planband (Plan 4.6.1, B1): Die Tagessumme des ausgelieferten Essensplans muss darin liegen.
 * [max(Untergrenze, Ziel × 0,9); min(Ziel × 1,1, Obergrenze)] – nie leer, weil Untergrenze ≤ Ziel ≤ Obergrenze
 * (bzw. Ziel = ceil10(Untergrenze), wenn beide < 10 kcal auseinander liegen).
 */
export function planBand(
  targetKcal: number,
  floorKcal: number,
  ceilingKcal: number,
): { min: number; max: number } {
  const min = Math.max(floorKcal, targetKcal * (1 - PORTION_TOLERANCE));
  const max = Math.max(min, Math.min(targetKcal * (1 + PORTION_TOLERANCE), ceilingKcal));
  return { min, max };
}

/**
 * Zielanpassung je Ziel (Plan 4.5) als Anteil des Grundbedarfs ohne Training. Bei `maintenance_only` immer 0.
 */
export function applyGoalAdjustment(
  goal: GoalType,
  level: ExperienceLevel,
  mode: 'full' | 'maintenance_only',
): number {
  if (mode === 'maintenance_only') return 0;
  if (goal === 'muscle_gain') return GOAL_ENERGY_ADJUSTMENT.muscle_gain[level];
  return GOAL_ENERGY_ADJUSTMENT[goal];
}

const offsetSchema = z.number().finite();

/**
 * Für Phase 4b (Plan 4.6, R2-S5): begrenzt NUR die Schrittweite (≤ ADJUSTMENT_STEP_MAX_KCAL je Anpassung) und die
 * Summe des Versatzes (±ADJUSTMENT_OFFSET_MAX_KCAL). Kennt bewusst KEINE Schutzgrenzen und keinen Kontext – diese
 * gelten ausschließlich in `nutritionTargetsForWeek` → `clampCalorieTarget`.
 */
export function clampCalorieAdjustment(
  currentOffsetKcal: number,
  proposedOffsetKcal: number,
): number {
  const current = offsetSchema.parse(currentOffsetKcal);
  const proposed = offsetSchema.parse(proposedOffsetKcal);
  const step = Math.min(
    Math.max(proposed - current, -ADJUSTMENT_STEP_MAX_KCAL),
    ADJUSTMENT_STEP_MAX_KCAL,
  );
  return Math.min(
    Math.max(current + step, -ADJUSTMENT_OFFSET_MAX_KCAL),
    ADJUSTMENT_OFFSET_MAX_KCAL,
  );
}
