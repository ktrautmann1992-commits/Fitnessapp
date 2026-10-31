import {
  type DrinkProgress,
  MEAL_SLOT_TIMES,
  type MealSlotId,
  type PlannedReminder,
  plannedReminders,
  reminderDates,
  type ReminderDay,
  type ReminderSettings,
  startTimeToMinutes,
} from '@fitnessapp/core';

import type { UserRows } from '@/data/types';
import { t } from '@/i18n';

import type { NotificationContent } from './notification-driver';
import { REMINDER_ID_PREFIX, REMINDER_ROUTES, type ReminderNotification } from './notifications';

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md): nur Zusammensetzen – aus den Zeilen der App
 * die Tage für packages/core (`plannedReminders`) bauen und die festen deutschen Texte anhängen. WANN etwas kommt,
 * rechnet packages/core. Texte ohne Gesundheitswerte (nur Uhrzeit, Name der Einheit bzw. Gericht).
 */

const R = t.reminders;

const isMealSlot = (slot: string): slot is MealSlotId => slot in MEAL_SLOT_TIMES;

/** Tage ab `today` (7) mit offenen geplanten Einheiten des aktiven Plans und den Mahlzeiten des Essensplans. */
export function reminderDaysFromRows(rows: UserRows, today: string): ReminderDay[] {
  const active = new Set(rows.plans.filter((p) => p.status === 'active').map((p) => p.id));
  const plannedDays = new Map(
    rows.mealPlans.flatMap((row) => row.plan?.days ?? []).map((d) => [d.date, d] as const),
  );
  return reminderDates(today).map((date) => {
    const sessions = rows.plannedSessions
      .filter((s) => active.has(s.plan_id) && s.scheduled_on === date && s.status === 'planned')
      .map((s) => ({
        id: s.id,
        nameDe: s.name_de,
        kind: s.kind,
        minutes: Math.min(Math.max(Math.round(s.estimated_minutes), 1), 24 * 60),
        startMinutes: startTimeToMinutes(s.start_time),
      }));
    const plannedDay = plannedDays.get(date);
    const meals = plannedDay
      ? plannedDay.meals.flatMap((m) =>
          !m.isFill && isMealSlot(m.slot)
            ? [{ slot: m.slot, titleDe: m.titleDe.trim() === '' ? null : m.titleDe }]
            : [],
        )
      : null;
    return { date, sessions, meals: meals && meals.length > 0 ? meals : null };
  });
}

/** Fester Text je Erinnerung (Titel, Text, Reiter beim Antippen, Android-Kanal). */
export function reminderContent(r: PlannedReminder): NotificationContent {
  const N = R.notify;
  switch (r.kind) {
    case 'training':
      return {
        title:
          r.startMinutes === null
            ? N.trainingToday(r.count)
            : N.trainingAt(r.startMinutes, r.approx),
        body: r.sessionNameDe.trim() === '' ? null : r.sessionNameDe,
        route: REMINDER_ROUTES.training,
        channel: 'training',
      };
    case 'meal': {
      if (r.slot === null) {
        const before = r.role === 'pre_snack';
        return {
          title: before ? N.snackBefore : N.afterTraining,
          body:
            before && r.sessionStartMinutes !== null
              ? N.snackBeforeBody(r.sessionStartMinutes)
              : before
                ? null
                : N.afterTrainingBody,
          route: REMINDER_ROUTES.meals,
          channel: 'meals',
        };
      }
      const title =
        r.role === 'pre' || r.role === 'pre_snack'
          ? N.mealPre(r.slot)
          : r.role === 'post'
            ? N.mealPost(r.slot)
            : N.mealTitle(r.slot);
      return { title, body: r.titleDe, route: REMINDER_ROUTES.meals, channel: 'meals' };
    }
    case 'drink':
      return { title: N.drink, body: null, route: REMINDER_ROUTES.drink, channel: 'drink' };
  }
}

/** Alles für das Planen: Zeitpunkte aus packages/core, Kennung mit festem Anfang, Text. */
export function reminderNotifications(input: {
  rows: UserRows | null;
  settings: ReminderSettings;
  today: string;
  nowMs: number;
  timeZone: string;
  /** Trink-Tracker heute (Menge und Ziel wie auf der Karte „Trinken“); Ziel erreicht → restliche Trink-Erinnerungen entfallen. */
  drinkProgress?: DrinkProgress | null;
}): ReminderNotification[] {
  const { settings } = input;
  if (!settings.training.enabled && !settings.meals.enabled && !settings.drink.enabled) return [];
  const rows = input.rows;
  const days = rows
    ? reminderDaysFromRows(rows, input.today)
    : reminderDates(input.today).map((date) => ({ date, sessions: [], meals: null }));
  return plannedReminders({
    days,
    settings,
    trainingTime: rows?.nutritionSetup?.training_time ?? null,
    drinkProgress: input.drinkProgress ?? null,
    nowMs: input.nowMs,
    timeZone: input.timeZone,
  }).map((r) => ({
    id: `${REMINDER_ID_PREFIX}${r.id}`,
    atMs: r.atMs,
    content: reminderContent(r),
  }));
}
