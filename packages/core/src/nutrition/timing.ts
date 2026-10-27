import {
  MEAL_SLOT_LAYOUTS,
  MEAL_SLOT_TIMES,
  MEAL_TIMING_RULES,
  NUTRIENT_TIMING,
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
  readonly sessions: readonly (Pick<NutritionSession, 'kind' | 'minutes'> &
    Partial<Pick<NutritionSession, 'startMinutes'>>)[];
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
  // Nährstoff-Timing 2 (Plan Abschnitt 6): Hat eine Einheit des Tages eine eigene Uhrzeit, gelten deren Zeitfenster
  // (auch zwei Einheiten). Ohne eigene Uhrzeit (Altbestand) bleibt alles genau wie bisher.
  if (input.sessions.some((s) => s.startMinutes !== null && s.startMinutes !== undefined)) {
    const windows = trainingWindows(input.sessions, input.trainingTime);
    if ((windows[0]?.start ?? Number.POSITIVE_INFINITY) < NUTRIENT_TIMING.earlyBeforeMinutes) {
      notices.add('early_training');
    }
    return {
      slots: withRoleShares(base, mealRolesForWindows(base, windows)),
      notices: sortNotices(notices),
    };
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
  return { slots: withRoleShares(base, base.map(roleOf)), notices: sortNotices(notices) };
}

/**
 * Rollen setzen und Energieanteile verschieben (`roleShareBonus` je Mahlzeit vor/nach dem Training, die anderen
 * anteilig weniger; Summe bleibt 1). `roles[i]` gehört zu `base[i]`.
 */
function withRoleShares(base: readonly MealSlot[], roles: readonly MealRole[]): MealSlot[] {
  const boosted = (i: number) => roles[i] === 'pre' || roles[i] === 'post';
  const boostedCount = base.filter((_, i) => boosted(i)).length;
  const bonus = MEAL_TIMING_RULES.roleShareBonus * boostedCount;
  const othersShare = base.reduce((sum, s, i) => sum + (boosted(i) ? 0 : s.share), 0);
  const canBoost = boostedCount > 0 && othersShare > bonus;
  const scale = canBoost ? (othersShare - bonus) / othersShare : 1;
  return base.map((slot, i) => ({
    ...slot,
    role: roles[i] ?? null,
    share: !canBoost
      ? slot.share
      : boosted(i)
        ? slot.share + MEAL_TIMING_RULES.roleShareBonus
        : slot.share * scale,
  }));
}

/** Zeitfenster einer Trainingseinheit (Minuten nach Mitternacht). */
export interface TrainingWindow {
  readonly sessionId: string | null;
  readonly kind: NutritionSession['kind'];
  readonly minutes: number;
  readonly start: number;
  readonly end: number;
  /** Ohne eigene Uhrzeit: Start aus „Trainingszeit“ bzw. Standard – die App schreibt „ca.“. */
  readonly approx: boolean;
}

/** Angenommener Start ohne eigene Uhrzeit: „Trainingszeit“, sonst (keine Angabe/„wechselnd“) 17:30. */
export function defaultTrainingStart(trainingTime: TrainingTime | null): number {
  return trainingTime === null || trainingTime === 'varies'
    ? NUTRIENT_TIMING.defaultStartMinutes
    : TRAINING_TIME_START_MINUTES[trainingTime];
}

/**
 * Zeitfenster der Einheiten eines Tages (Plan Abschnitt 6): eigene Uhrzeit, sonst Standard; Einheiten ohne eigene
 * Uhrzeit, die sich mit einer früheren überschneiden würden, beginnen direkt nach deren Ende. Sortiert nach Start.
 */
export function trainingWindows(
  sessions: readonly (Pick<NutritionSession, 'kind' | 'minutes'> &
    Partial<Pick<NutritionSession, 'startMinutes' | 'sessionId'>>)[],
  trainingTime: TrainingTime | null,
): TrainingWindow[] {
  const fallback = defaultTrainingStart(trainingTime);
  const items = sessions.map((s, index) => ({
    s,
    index,
    approx: s.startMinutes === null || s.startMinutes === undefined,
    start: s.startMinutes ?? fallback,
  }));
  items.sort(
    (a, b) => a.start - b.start || Number(a.approx) - Number(b.approx) || a.index - b.index,
  );
  const result: TrainingWindow[] = [];
  for (const item of items) {
    const prevEnd = result.at(-1)?.end ?? Number.NEGATIVE_INFINITY;
    const start = item.approx && item.start < prevEnd ? prevEnd : item.start;
    result.push({
      sessionId: item.s.sessionId ?? null,
      kind: item.s.kind,
      minutes: item.s.minutes,
      start,
      end: start + item.s.minutes,
      approx: item.approx,
    });
  }
  return result.sort((a, b) => a.start - b.start);
}

/**
 * Rollen der Plätze zu gegebenen Zeitfenstern (Plan Abschnitte 2, 3, 6): je Einheit die letzte Hauptmahlzeit 2–4 h
 * vorher („vor dem Training“), der letzte Snack 30–60 min vorher und die erste Mahlzeit bis 2 h nach dem Ende („nach dem
 * Training“) – nie vor dem Ende der vorigen bzw. nach dem Start der nächsten Einheit. Zwei Einheiten: die Mahlzeit
 * dazwischen ist „nach dem Training“ (Auffüll-Mahlzeit). Vorrang: nach > vor > Snack vorher.
 */
export function mealRolesForWindows(
  slots: readonly Pick<MealSlot, 'slot' | 'timeMinutes'>[],
  windows: readonly Pick<TrainingWindow, 'start' | 'end'>[],
): MealRole[] {
  const rules = MEAL_TIMING_RULES;
  const roles: MealRole[] = slots.map(() => null);
  const rank = (role: MealRole) =>
    role === 'post' ? 3 : role === 'pre' ? 2 : role === 'pre_snack' ? 1 : 0;
  const assign = (index: number, role: MealRole) => {
    if (index >= 0 && rank(role) > rank(roles[index] ?? null)) roles[index] = role;
  };
  const lastIndex = (test: (s: Pick<MealSlot, 'slot' | 'timeMinutes'>) => boolean) => {
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      if (test(slots[i] as MealSlot)) return i;
    }
    return -1;
  };
  windows.forEach((w, i) => {
    const prevEnd = windows[i - 1]?.end ?? Number.NEGATIVE_INFINITY;
    const nextStart = windows[i + 1]?.start ?? Number.POSITIVE_INFINITY;
    const before = (s: Pick<MealSlot, 'timeMinutes'>) => w.start - s.timeMinutes;
    assign(
      lastIndex(
        (s) =>
          !isSnackSlot(s.slot) &&
          s.timeMinutes >= prevEnd &&
          before(s) >= rules.preMealMinutes.min &&
          before(s) <= rules.preMealMinutes.max,
      ),
      'pre',
    );
    assign(
      lastIndex(
        (s) =>
          isSnackSlot(s.slot) &&
          s.timeMinutes >= prevEnd &&
          before(s) >= rules.preSnackMinutes.min &&
          before(s) <= rules.preSnackMinutes.max,
      ),
      'pre_snack',
    );
    assign(
      slots.findIndex(
        (s) =>
          s.timeMinutes >= w.end &&
          s.timeMinutes - w.end <= rules.postMealMaxMinutes &&
          s.timeMinutes < nextStart,
      ),
      'post',
    );
  });
  return roles;
}
