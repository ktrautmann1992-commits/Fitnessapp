import {
  DEFAULT_REMINDER_SETTINGS,
  type MealPlanWeek,
  type PlannedMeal,
  type ReminderSettings,
} from '@fitnessapp/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';
import type { MealPlanRow, PlannedSessionRow, UserPlanRow, UserRows } from '@/data/types';
import { rowsWith } from '@/test/fixtures';

import { ANDROID_CHANNELS, notificationDriver } from './notification-driver.native';
import { createNotifications, REMINDER_ROUTES } from './notifications';
import { reminderContent, reminderDaysFromRows, reminderNotifications } from './reminders';

/**
 * Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md): Zusammensetzen aus den Zeilen, feste Texte
 * ohne Gesundheitswerte, Planen/Neuplanen/Stornieren über den echten nativen Treiber mit gemocktem expo-notifications.
 */

const fake = vi.hoisted(() => ({
  scheduled: new Map<string, { content: Record<string, unknown>; trigger: unknown }>(),
  permission: { status: 'granted', granted: true } as { status: string; granted: boolean },
  channels: [] as string[],
}));

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6, DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(async (id: string) => {
    fake.channels.push(id);
    return null;
  }),
  getPermissionsAsync: vi.fn(async () => fake.permission),
  requestPermissionsAsync: vi.fn(async () => {
    fake.permission = { status: 'granted', granted: true };
    return fake.permission;
  }),
  scheduleNotificationAsync: vi.fn(
    async (request: { identifier: string; content: Record<string, unknown>; trigger: unknown }) => {
      fake.scheduled.set(request.identifier, {
        content: request.content,
        trigger: request.trigger,
      });
      return request.identifier;
    },
  ),
  cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
    fake.scheduled.delete(id);
  }),
  dismissNotificationAsync: vi.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: vi.fn(async () => fake.scheduled.clear()),
  getLastNotificationResponse: vi.fn(() => null),
  clearLastNotificationResponse: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: () => undefined })),
}));

const TZ = 'Europe/Berlin';
const TODAY = '2026-10-29';
/** Donnerstag, 29.10.2026, 06:00 Ortszeit. */
const NOW_MS = Date.parse('2026-10-29T05:00:00Z');

const plan = (id: string, status: UserPlanRow['status']) => ({ id, status }) as UserPlanRow;

function session(patch: Partial<PlannedSessionRow>): PlannedSessionRow {
  return {
    id: 's1',
    plan_id: 'p1',
    scheduled_on: TODAY,
    name_de: 'Oberkörper A',
    kind: 'strength',
    estimated_minutes: 60,
    start_time: '18:00:00',
    status: 'planned',
    ...patch,
  } as PlannedSessionRow;
}

function mealPlan(days: { date: string; meals: Partial<PlannedMeal>[] }[]): MealPlanRow {
  return {
    id: 'mp1',
    week_start: '2026-10-26',
    plan: { days: days.map((d) => ({ date: d.date, meals: d.meals })) } as unknown as MealPlanWeek,
  } as MealPlanRow;
}

function rows(patch: Partial<UserRows> = {}): UserRows {
  return rowsWith({
    plans: [plan('p1', 'active'), plan('old', 'replaced')],
    plannedSessions: [
      session({}),
      session({ id: 's-old', plan_id: 'old', name_de: 'Alt' }),
      session({ id: 's-done', status: 'completed', scheduled_on: '2026-10-30' }),
      session({ id: 's-free', scheduled_on: '2026-10-31', start_time: null, name_de: 'Lauf' }),
      session({ id: 's-later', scheduled_on: '2026-11-05' }),
    ],
    ...patch,
  });
}

function settings(
  change: Partial<{ [K in keyof ReminderSettings]: Partial<ReminderSettings[K]> }>,
) {
  return {
    training: { ...DEFAULT_REMINDER_SETTINGS.training, ...change.training },
    meals: { ...DEFAULT_REMINDER_SETTINGS.meals, ...change.meals },
    drink: { ...DEFAULT_REMINDER_SETTINGS.drink, ...change.drink },
  };
}

beforeEach(() => {
  fake.scheduled.clear();
  fake.channels.length = 0;
  fake.permission = { status: 'granted', granted: true };
});

describe('reminderDaysFromRows', () => {
  it('7 Tage, nur offene Einheiten des aktiven Plans, Uhrzeit aus start_time', () => {
    const days = reminderDaysFromRows(rows(), TODAY);
    expect(days.map((d) => d.date)).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(days[0]?.sessions).toEqual([
      { id: 's1', nameDe: 'Oberkörper A', kind: 'strength', minutes: 60, startMinutes: 18 * 60 },
    ]);
    expect(days[1]?.sessions).toEqual([]);
    expect(days[2]?.sessions[0]).toMatchObject({ id: 's-free', startMinutes: null });
    expect(days.every((d) => d.meals === null)).toBe(true);
  });

  it('Mahlzeiten aus dem gespeicherten Essensplan (ohne Auffüller und Zusatzplätze)', () => {
    const days = reminderDaysFromRows(
      rows({
        mealPlans: [
          mealPlan([
            {
              date: '2026-10-30',
              meals: [
                { slot: 'breakfast', titleDe: 'Haferbrei', isFill: false },
                { slot: 'lunch', titleDe: 'Hähnchen-Reis-Bowl', isFill: false },
                { slot: 'extra_1' as PlannedMeal['slot'], titleDe: 'Extra', isFill: false },
                { slot: 'dinner', titleDe: 'Füller', isFill: true },
              ],
            },
          ]),
        ],
      }),
      TODAY,
    );
    expect(days[0]?.meals).toBeNull();
    expect(days[1]?.meals).toEqual([
      { slot: 'breakfast', titleDe: 'Haferbrei' },
      { slot: 'lunch', titleDe: 'Hähnchen-Reis-Bowl' },
    ]);
  });
});

describe('Texte', () => {
  it('kurz, Deutsch, ohne Werte; Reiter und Android-Kanal je Art', () => {
    const list = reminderNotifications({
      rows: rows({
        mealPlans: [
          mealPlan([{ date: TODAY, meals: [{ slot: 'lunch', titleDe: 'Hähnchen-Reis-Bowl' }] }]),
        ],
      }),
      settings: settings({
        training: { enabled: true, leadMinutes: 60 },
        meals: { enabled: true },
        drink: { enabled: true, fromMinutes: 10 * 60, toMinutes: 10 * 60 + 30, everyMinutes: 60 },
      }),
      today: TODAY,
      nowMs: NOW_MS,
      timeZone: TZ,
    });
    const today = list.filter((r) => r.id.includes(TODAY));
    expect(today.map((r) => [r.id, r.content.title, r.content.body, r.content.channel])).toEqual([
      ['erinnerung-d-2026-10-29-600', 'Zeit für ein Glas Wasser', null, 'drink'],
      ['erinnerung-m-2026-10-29-lunch', 'Zeit fürs Mittagessen', 'Hähnchen-Reis-Bowl', 'meals'],
      // Snack-Hinweis (17:00) entfällt neben der Trainings-Erinnerung zur selben Zeit.
      ['erinnerung-t-2026-10-29-s1', 'Training um 18:00 Uhr', 'Oberkörper A', 'training'],
      [
        'erinnerung-m-2026-10-29-nach-s1',
        'Nach dem Training: Zeit zum Essen',
        'Eiweiß und Kohlenhydrate helfen bei der Erholung.',
        'meals',
      ],
    ]);
    expect(today.map((r) => r.content.route)).toEqual([
      REMINDER_ROUTES.drink,
      REMINDER_ROUTES.meals,
      REMINDER_ROUTES.training,
      REMINDER_ROUTES.meals,
    ]);
    // Einheit ohne Uhrzeit am Samstag: morgens um 8 „Heute steht Training an“.
    const saturday = list.find((r) => r.id === 'erinnerung-t-2026-10-31-tag');
    expect(saturday?.content).toMatchObject({ title: 'Heute steht Training an', body: 'Lauf' });
  });

  it('Mahlzeit vor/nach dem Training mit Rolle', () => {
    const base = {
      id: 'x',
      date: TODAY,
      minutes: 750,
      atMs: 0,
      titleDe: null,
      sessionStartMinutes: 900,
    };
    expect(reminderContent({ ...base, kind: 'meal', slot: 'lunch', role: 'pre' }).title).toBe(
      'Mittagessen vor dem Training',
    );
    expect(reminderContent({ ...base, kind: 'meal', slot: 'dinner', role: 'post' }).title).toBe(
      'Abendessen nach dem Training',
    );
    expect(
      reminderContent({ ...base, kind: 'meal', slot: 'snack_afternoon', role: null }).title,
    ).toBe('Zeit für deinen Snack');
  });

  it('alles aus → nichts', () => {
    expect(
      reminderNotifications({
        rows: rows(),
        settings: DEFAULT_REMINDER_SETTINGS,
        today: TODAY,
        nowMs: NOW_MS,
        timeZone: TZ,
      }),
    ).toEqual([]);
  });
});

describe('syncReminders', () => {
  const plannedFor = (s: ReminderSettings, current = rows()) =>
    reminderNotifications({
      rows: current,
      settings: s,
      today: TODAY,
      nowMs: NOW_MS,
      timeZone: TZ,
    });

  it('plant, verschiebt mit der Einheit, storniert Weggefallenes; eigener Android-Kanal je Art', async () => {
    const store = createMemoryStore();
    const n = createNotifications(notificationDriver, store);
    const on = settings({ training: { enabled: true, leadMinutes: 30 } });
    // Heute 17:30 und Samstag 08:00 (Einheit ohne Uhrzeit).
    expect(await n.syncReminders(plannedFor(on))).toBe(2);
    const first = fake.scheduled.get('erinnerung-t-2026-10-29-s1');
    expect(first?.trigger).toMatchObject({
      date: Date.parse('2026-10-29T16:30:00Z'),
      channelId: ANDROID_CHANNELS.training.id,
    });
    expect(first?.content).toMatchObject({
      title: 'Training um 18:00 Uhr',
      data: { route: '/today' },
    });
    expect(fake.channels).toContain(ANDROID_CHANNELS.training.id);

    // Einheit auf 19:30 verschoben → dieselbe Kennung, neuer Zeitpunkt.
    const moved = rows({ plannedSessions: [session({ start_time: '19:30' })] });
    await n.syncReminders(plannedFor(on, moved));
    expect(
      (fake.scheduled.get('erinnerung-t-2026-10-29-s1')?.trigger as { date: number }).date,
    ).toBe(Date.parse('2026-10-29T18:00:00Z'));

    // Einheiten gelöscht → storniert, gemerkte Liste leer.
    await n.syncReminders(plannedFor(on, rows({ plannedSessions: [] })));
    expect(fake.scheduled.size).toBe(0);
    expect(JSON.parse((await store.getItem(STORAGE_KEYS.reminderScheduled)) ?? 'null')).toEqual([]);
  });

  it('unverändert → nichts neu geplant; fremde Benachrichtigungen bleiben', async () => {
    const n = createNotifications(notificationDriver, createMemoryStore());
    const on = settings({ drink: { enabled: true } });
    fake.scheduled.set('alpha5-mess-erinnerung', { content: {}, trigger: {} });
    await n.syncReminders(plannedFor(on));
    const count = fake.scheduled.size;
    const { scheduleNotificationAsync } = await import('expo-notifications');
    vi.mocked(scheduleNotificationAsync).mockClear();
    await n.syncReminders(plannedFor(on));
    expect(scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(fake.scheduled.size).toBe(count);
    expect(fake.scheduled.has('alpha5-mess-erinnerung')).toBe(true);
  });

  it('ohne Erlaubnis: nichts planen, alles stornieren – fragt nie von selbst', async () => {
    const n = createNotifications(notificationDriver, createMemoryStore());
    const on = settings({ meals: { enabled: true } });
    await n.syncReminders(plannedFor(on));
    expect(fake.scheduled.size).toBeGreaterThan(0);
    fake.permission = { status: 'denied', granted: false };
    const { requestPermissionsAsync } = await import('expo-notifications');
    vi.mocked(requestPermissionsAsync).mockClear();
    expect(await n.syncReminders(plannedFor(on))).toBe(0);
    expect(fake.scheduled.size).toBe(0);
    expect(requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('allowReminders fragt nach (nur nach dem Einschalten); reset entfernt alles', async () => {
    fake.permission = { status: 'undetermined', granted: false };
    const store = createMemoryStore({ [STORAGE_KEYS.reminderPrefs]: '{}' });
    const n = createNotifications(notificationDriver, store);
    expect(await n.allowReminders()).toBe('granted');
    await n.syncReminders(plannedFor(settings({ drink: { enabled: true } })));
    await n.reset();
    expect(fake.scheduled.size).toBe(0);
    expect(await store.getItem(STORAGE_KEYS.reminderPrefs)).toBeNull();
    expect(await store.getItem(STORAGE_KEYS.reminderScheduled)).toBeNull();
  });
});
