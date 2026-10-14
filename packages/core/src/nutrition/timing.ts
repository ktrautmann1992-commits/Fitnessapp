import {
  MEAL_SLOT_LAYOUTS,
  MEAL_SLOT_TIMES,
  MEAL_TIMING_RULES,
  NUTRITION_LIMITS,
  TRAINING_TIME_START_MINUTES,
} from '../constants';
import { type NutritionNoticeCode, sortNotices } from './notices';
import type { TrainingTime } from '../enums';
import type { NutritionSession } from './schemas';

/**
 * Mahlzeiten-Timing (docs/PLAN-PHASE-5.md 4.8): Plätze je `meals_per_day`, Zuordnung vor/nach dem Training und
 * Hinweis bei langen Einheiten. Geplante Einheiten haben keine Uhrzeit – maßgeblich ist die Angabe „Trainingszeit“.
 */

export type MealSlotId = keyof typeof MEAL_SLOT_TIMES;
export type MealRole = 'pre' | 'post' | 'pre_snack' | null;

export interface MealSlot {
  readonly slot: MealSlotId;
  /** Energieanteil am Tag (Summe aller Plätze = 1). */
  readonly share: number;
  readonly role: MealRole;
  /** Standard-Uhrzeit in Minuten nach Mitternacht. */
  readonly timeMinutes: number;
}

export interface DayTiming {
  readonly slots: readonly MealSlot[];
  readonly notices: readonly NutritionNoticeCode[];
}

export function isSnackSlot(slot: MealSlotId): boolean {
  return slot.startsWith('snack_');
}

/** Plätze und Grundanteile für 1–8 Mahlzeiten. */
export function mealSlotLayout(mealsPerDay: number): MealSlot[] {
  const count = Math.min(
    Math.max(Math.round(mealsPerDay), NUTRITION_LIMITS.mealsPerDay.min),
    NUTRITION_LIMITS.mealsPerDay.max,
  ) as keyof typeof MEAL_SLOT_LAYOUTS;
  return MEAL_SLOT_LAYOUTS[count].map(([slot, share]) => ({
    slot,
    share,
    role: null,
    timeMinutes: MEAL_SLOT_TIMES[slot],
  }));
}

/** Plätze eines Tages mit Rolle vor/nach dem Training und Hinweisen. */
export function mealSlotsForDay(input: {
  readonly mealsPerDay: number;
  readonly trainingTime: TrainingTime | null;
  /** Gezählte Einheiten des Tages (sessionsForDay). */
  readonly sessions: readonly Pick<NutritionSession, 'kind' | 'minutes'>[];
}): DayTiming {
  const base = mealSlotLayout(input.mealsPerDay);
  const notices = new Set<NutritionNoticeCode>();
  if (
    input.sessions.some(
      (s) => s.kind === 'endurance' && s.minutes >= MEAL_TIMING_RULES.longSessionMinutes,
    )
  ) {
    notices.add('long_session_fueling');
  }
  if (
    input.sessions.length === 0 ||
    input.trainingTime === null ||
    input.trainingTime === 'varies'
  ) {
    return { slots: base, notices: sortNotices(notices) };
  }
  if (input.trainingTime === 'early') notices.add('early_training');

  const start = TRAINING_TIME_START_MINUTES[input.trainingTime];
  const end = start + input.sessions.reduce((sum, s) => sum + s.minutes, 0);
  const rules = MEAL_TIMING_RULES;
  const before = (slot: MealSlot) => start - slot.timeMinutes;
  const pre = base
    .filter(
      (s) =>
        !isSnackSlot(s.slot) &&
        before(s) >= rules.preMealMinutes.min &&
        before(s) <= rules.preMealMinutes.max,
    )
    .at(-1);
  const preSnack = base
    .filter(
      (s) =>
        isSnackSlot(s.slot) &&
        before(s) >= rules.preSnackMinutes.min &&
        before(s) <= rules.preSnackMinutes.max,
    )
    .at(-1);
  const post = base.find(
    (s) => s.timeMinutes >= end && s.timeMinutes - end <= rules.postMealMaxMinutes,
  );

  const roleOf = (slot: MealSlot): MealRole =>
    slot === post ? 'post' : slot === pre ? 'pre' : slot === preSnack ? 'pre_snack' : null;
  const boosted = base.filter((s) => s === pre || s === post);
  const others = base.filter((s) => s !== pre && s !== post);
  const bonus = rules.roleShareBonus * boosted.length;
  const othersShare = others.reduce((sum, s) => sum + s.share, 0);
  const canBoost = boosted.length > 0 && othersShare > bonus;
  const scale = canBoost ? (othersShare - bonus) / othersShare : 1;
  const slots = base.map((slot) => ({
    ...slot,
    role: roleOf(slot),
    share: !canBoost
      ? slot.share
      : slot === pre || slot === post
        ? slot.share + rules.roleShareBonus
        : slot.share * scale,
  }));
  return { slots, notices: sortNotices(notices) };
}
