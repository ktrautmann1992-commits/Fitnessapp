import { nextMeasurementDue, startRest, adjustRest } from '@fitnessapp/core';
import * as ExpoNotifications from 'expo-notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryStore, STORAGE_KEYS } from '@/data/kv';
import type { MeasurementReminderRow, UserRows } from '@/data/types';
import { t } from '@/i18n';
import { consent, NOW, profile, rowsWith, USER_ID, VERSIONS } from '@/test/fixtures';

import { notificationDriver as webDriver } from './notification-driver';
import { ANDROID_CHANNEL_ID, notificationDriver } from './notification-driver.native';
import {
  createNotifications,
  MEASUREMENT_ROUTE,
  measurementOfferDays,
  NOTIFICATION_IDS,
  shouldAskRestEndNotification,
  shouldOfferMeasurementNotification,
  TEST_MEASUREMENT_DELAY_MS,
  type NotificationPrefs,
} from './notifications';

/**
 * Etappe E (docs/PLAN-PHASE-4B.md 7 und 10 E): Planen, Stornieren und Neuplanen mit gemocktem expo-notifications –
 * über den echten nativen Treiber (notification-driver.native.ts) und den Ablauf aus lib/notifications.ts.
 */

const fake = vi.hoisted(() => {
  const scheduled = new Map<string, { content: Record<string, unknown>; trigger: unknown }>();
  return {
    scheduled,
    permission: { status: 'undetermined', granted: false } as { status: string; granted: boolean },
    answer: { status: 'granted', granted: true } as { status: string; granted: boolean },
    platform: { OS: 'android' as 'android' | 'ios' },
    lastResponse: null as unknown,
    responseListener: null as ((response: unknown) => void) | null,
  };
});

vi.mock('react-native', () => ({ Platform: fake.platform }));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 6 },
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => null),
  getPermissionsAsync: vi.fn(async () => fake.permission),
  requestPermissionsAsync: vi.fn(async () => {
    fake.permission = fake.answer;
    return fake.answer;
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
  cancelAllScheduledNotificationsAsync: vi.fn(async () => {
    fake.scheduled.clear();
  }),
  getLastNotificationResponse: vi.fn(() => fake.lastResponse),
  clearLastNotificationResponse: vi.fn(() => {
    fake.lastResponse = null;
  }),
  addNotificationResponseReceivedListener: vi.fn((listener: (response: unknown) => void) => {
    fake.responseListener = listener;
    return { remove: () => (fake.responseListener = null) };
  }),
  getExpoPushTokenAsync: vi.fn(),
  getDevicePushTokenAsync: vi.fn(),
}));

const TZ = 'Europe/Berlin';
const nowMs = Date.parse(NOW); // 03.10.2026 12:00 MESZ
const at8 = (date: string, offsetH: number) => Date.parse(`${date}T0${8 - offsetH}:00:00Z`);

function reminder(patch: Partial<MeasurementReminderRow> = {}): MeasurementReminderRow {
  return {
    user_id: USER_ID,
    enabled: true,
    interval_days: 28,
    next_due_on: '2026-10-31',
    ...patch,
  };
}

function rows(patch: Partial<UserRows> = {}): UserRows {
  return rowsWith({
    profile: profile({ onboarding_completed_at: NOW }),
    consents: [consent('terms'), consent('privacy'), consent('health_data')],
    reminder: reminder(),
    ...patch,
  });
}

const revoked = (base: UserRows): UserRows => ({
  ...base,
  consents: [consent('terms'), consent('privacy'), consent('health_data', { revoked_at: NOW })],
});

function setup(
  prefs: Partial<NotificationPrefs> = {},
  permission: 'granted' | 'undetermined' = 'granted',
) {
  const store = createMemoryStore(
    Object.keys(prefs).length ? { [STORAGE_KEYS.notificationPrefs]: JSON.stringify(prefs) } : {},
  );
  fake.permission =
    permission === 'granted'
      ? { status: 'granted', granted: true }
      : { status: 'undetermined', granted: false };
  return { store, n: createNotifications(notificationDriver, store) };
}

const sync = (n: ReturnType<typeof setup>['n'], current: UserRows | null, now = nowMs) =>
  n.syncMeasurement({ rows: current, versions: VERSIONS, nowMs: now, timeZone: TZ });

const measurement = () => fake.scheduled.get(NOTIFICATION_IDS.measurement);
const restEnd = () => fake.scheduled.get(NOTIFICATION_IDS.restEnd);
const dateOf = (entry: { trigger: unknown } | undefined) =>
  (entry?.trigger as { date?: number } | undefined)?.date;

beforeEach(() => {
  fake.scheduled.clear();
  fake.answer = { status: 'granted', granted: true };
  fake.platform.OS = 'android';
  fake.lastResponse = null;
  fake.responseListener = null;
  vi.mocked(ExpoNotifications.requestPermissionsAsync).mockClear();
  vi.mocked(ExpoNotifications.scheduleNotificationAsync).mockClear();
  vi.mocked(ExpoNotifications.getExpoPushTokenAsync).mockClear();
  vi.mocked(ExpoNotifications.getDevicePushTokenAsync).mockClear();
});

describe('Mess-Erinnerung planen, stornieren, neu planen', () => {
  it('App-Start: plant am Fälligkeitstag um 08:00 Ortszeit, fester Text ohne Werte, Antippen öffnet die Messung', async () => {
    const { n } = setup({ measurement: true });
    await expect(sync(n, rows())).resolves.toBe(at8('2026-10-31', 1));
    const entry = measurement();
    expect(dateOf(entry)).toBe(at8('2026-10-31', 1));
    expect(entry?.trigger).toMatchObject({ type: 'date', channelId: ANDROID_CHANNEL_ID });
    // Android-Kanal „Erinnerungen“ wird vor dem ersten Planen angelegt (einmal je App-Start).
    expect(ExpoNotifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ANDROID_CHANNEL_ID,
      expect.objectContaining({ name: 'Erinnerungen' }),
    );
    expect(entry?.content).toMatchObject({
      title: 'Alpha5: Zeit für dein Mess-Update',
      body: null,
      data: { route: MEASUREMENT_ROUTE },
    });
  });

  it('Text enthält nie Werte (keine Ziffern, keine Maße, kein Datum)', async () => {
    const { n } = setup({ measurement: true, restEnd: true });
    await sync(n, rows({ reminder: reminder({ interval_days: 90, next_due_on: '2026-12-31' }) }));
    await n.updateRestEnd({ timer: startRest(90, nowMs), appActive: false, nowMs });
    for (const entry of [measurement(), restEnd()]) {
      const text = `${String(entry?.content.title)} ${String(entry?.content.body ?? '')}`;
      // Einzige Ziffer: die 5 im Markennamen „Alpha5“.
      expect(text.replaceAll('Alpha5', '')).not.toMatch(/\d/);
      expect(text).not.toMatch(/cm|kg|%/i);
    }
    expect(t.notifications.measurementTitle).toBe('Alpha5: Zeit für dein Mess-Update');
    expect(t.notifications.restEndTitle).toBe('Pause vorbei – nächster Satz');
  });

  it('Messung gespeichert → neuer Termin (nextMeasurementDue) ersetzt den alten', async () => {
    const { n } = setup({ measurement: true });
    await sync(n, rows());
    const due = nextMeasurementDue('2026-10-03', 28);
    await sync(n, rows({ reminder: reminder({ next_due_on: due }) }));
    expect(fake.scheduled.size).toBe(1);
    expect(dateOf(measurement())).toBe(at8(due, 1));
  });

  it('Abstand geändert (7 bzw. 90 Tage) → neu geplant', async () => {
    const { n } = setup({ measurement: true });
    await sync(
      n,
      rows({
        reminder: reminder({ interval_days: 7, next_due_on: nextMeasurementDue('2026-10-03', 7) }),
      }),
    );
    expect(dateOf(measurement())).toBe(at8('2026-10-10', 2));
    await sync(
      n,
      rows({
        reminder: reminder({
          interval_days: 90,
          next_due_on: nextMeasurementDue('2026-10-03', 90),
        }),
      }),
    );
    expect(dateOf(measurement())).toBe(at8('2027-01-01', 1));
  });

  it('Mess-Erinnerung ausgeschaltet (enabled = false) → storniert', async () => {
    const { n } = setup({ measurement: true });
    await sync(n, rows());
    expect(measurement()).toBeDefined();
    await expect(sync(n, rows({ reminder: reminder({ enabled: false }) }))).resolves.toBeNull();
    expect(measurement()).toBeUndefined();
  });

  it('Benachrichtigung in den Einstellungen ausgeschaltet → storniert, enabled bleibt', async () => {
    const { n, store } = setup({ measurement: true });
    await sync(n, rows());
    await n.disableMeasurement();
    expect(measurement()).toBeUndefined();
    await sync(n, rows());
    expect(measurement()).toBeUndefined();
    expect(JSON.parse(store.dump()[STORAGE_KEYS.notificationPrefs] ?? '{}')).toMatchObject({
      measurement: false,
    });
  });

  it('ohne gültige health_data-Einwilligung wird nichts geplant (S5)', async () => {
    const { n } = setup({ measurement: true });
    await expect(sync(n, revoked(rows()))).resolves.toBeNull();
    await expect(
      sync(n, rows({ consents: [consent('terms'), consent('privacy')] })),
    ).resolves.toBeNull();
    // Einwilligung zu einer älteren Textfassung
    await expect(
      n.syncMeasurement({
        rows: rows(),
        versions: { ...VERSIONS, health_data: 2 },
        nowMs,
        timeZone: TZ,
      }),
    ).resolves.toBeNull();
    expect(measurement()).toBeUndefined();
  });

  it('Widerruf health_data storniert sofort; erneute Einwilligung plant beim nächsten Start wieder', async () => {
    const { n } = setup({ measurement: true });
    await sync(n, rows());
    expect(measurement()).toBeDefined();
    // Ablauf in app-state.revokeHealthData: zuerst stornieren …
    await n.cancelMeasurement();
    expect(measurement()).toBeUndefined();
    // … und nach dem Neuladen bleibt es storniert (enabled bleibt unverändert true).
    const afterRevoke = revoked(rows());
    expect(afterRevoke.reminder?.enabled).toBe(true);
    await sync(n, afterRevoke);
    expect(measurement()).toBeUndefined();
    // Nächster Start mit neuer Einwilligung (neue Instanz = neuer App-Start, gleicher Gerätespeicher).
    const restarted = createNotifications(notificationDriver, setup({ measurement: true }).store);
    await restarted.syncMeasurement({ rows: rows(), versions: VERSIONS, nowMs, timeZone: TZ });
    expect(dateOf(measurement())).toBe(at8('2026-10-31', 1));
  });

  it('Abmelden bzw. Konto löschen → alles storniert, Geräte-Einstellung zurückgesetzt', async () => {
    const { n, store } = setup({ measurement: true, restEnd: true, measurementAsked: true });
    await sync(n, rows());
    await n.updateRestEnd({ timer: startRest(90, nowMs), appActive: false, nowMs });
    expect(fake.scheduled.size).toBe(2);
    await n.reset();
    expect(fake.scheduled.size).toBe(0);
    expect(store.dump()[STORAGE_KEYS.notificationPrefs]).toBeUndefined();
    await sync(n, rows());
    expect(fake.scheduled.size).toBe(0);
  });

  it('Opt-in aus (Standard) oder keine Erlaubnis → nichts geplant', async () => {
    await expect(sync(setup().n, rows())).resolves.toBeNull();
    await expect(sync(setup({ measurement: true }, 'undetermined').n, rows())).resolves.toBeNull();
    expect(fake.scheduled.size).toBe(0);
  });

  it('je Termin höchstens eine Erinnerung – Kaltstart nach der Zustellung plant nicht nach (M2)', async () => {
    const { n, store } = setup({ measurement: true });
    const due = rows({ reminder: reminder({ next_due_on: '2026-10-03' }) });
    const early = Date.parse('2026-10-03T05:00:00Z'); // 07:00 MESZ
    await expect(sync(n, due, early)).resolves.toBe(at8('2026-10-03', 2));
    expect(JSON.parse(store.dump()[STORAGE_KEYS.notificationPrefs] ?? '{}')).toMatchObject({
      scheduledMeasurement: { dueOn: '2026-10-03', atMs: at8('2026-10-03', 2) },
    });
    // Zugestellt um 08:00; Neustart um 12:00 (neue Instanz, gleicher Gerätespeicher) → keine zweite.
    fake.scheduled.clear();
    const restarted = createNotifications(notificationDriver, store);
    await expect(
      restarted.syncMeasurement({ rows: due, versions: VERSIONS, nowMs, timeZone: TZ }),
    ).resolves.toBeNull();
    expect(measurement()).toBeUndefined();
    // Neue Messung → neuer Termin wird wieder geplant.
    await sync(restarted, rows({ reminder: reminder({ next_due_on: '2026-10-31' }) }));
    expect(dateOf(measurement())).toBe(at8('2026-10-31', 1));
  });

  it('kaputte Geräte-Einstellung → Standard (aus), nichts geplant', async () => {
    const store = createMemoryStore({ [STORAGE_KEYS.notificationPrefs]: '{"measurement":"ja"' });
    fake.permission = { status: 'granted', granted: true };
    const n = createNotifications(notificationDriver, store);
    await expect(n.loadPrefs()).resolves.toEqual({
      measurement: false,
      restEnd: false,
      measurementAsked: false,
      restEndAsked: false,
      scheduledMeasurement: null,
    });
    const odd = createNotifications(
      notificationDriver,
      createMemoryStore({
        [STORAGE_KEYS.notificationPrefs]: JSON.stringify({
          measurement: true,
          scheduledMeasurement: { dueOn: 'kaputt' },
        }),
      }),
    );
    await expect(odd.loadPrefs()).resolves.toMatchObject({
      measurement: true,
      scheduledMeasurement: null,
    });
  });

  it('heute fällig, 08:00 vorbei → einmalig am nächsten Morgen', async () => {
    const { n } = setup({ measurement: true });
    await sync(n, rows({ reminder: reminder({ next_due_on: '2026-10-03' }) }));
    expect(dateOf(measurement())).toBe(at8('2026-10-04', 2));
  });

  it('Test-Knopf: Mess-Erinnerung in 2 Minuten (eigene Kennung), nur mit Einwilligung und Erlaubnis', async () => {
    const { n } = setup({ measurement: true });
    await expect(
      n.scheduleTestMeasurement({ rows: rows(), versions: VERSIONS, nowMs }),
    ).resolves.toBe('scheduled');
    expect(dateOf(fake.scheduled.get(NOTIFICATION_IDS.measurementTest))).toBe(
      nowMs + TEST_MEASUREMENT_DELAY_MS,
    );
    await expect(
      n.scheduleTestMeasurement({ rows: revoked(rows()), versions: VERSIONS, nowMs }),
    ).resolves.toBe('needs_consent');
    await expect(
      setup().n.scheduleTestMeasurement({ rows: rows(), versions: VERSIONS, nowMs }),
    ).resolves.toBe('needs_permission');
    // Widerruf storniert auch die Test-Erinnerung.
    await n.cancelMeasurement();
    expect(fake.scheduled.get(NOTIFICATION_IDS.measurementTest)).toBeUndefined();
  });
});

describe('Pausenende', () => {
  const timer = startRest(90, nowMs);

  it('App in den Hintergrund während der Pause → geplant zum Endzeitpunkt', async () => {
    const { n } = setup({ restEnd: true });
    await expect(n.updateRestEnd({ timer, appActive: false, nowMs: nowMs + 10_000 })).resolves.toBe(
      nowMs + 90_000,
    );
    expect(restEnd()?.content).toMatchObject({ title: 'Pause vorbei – nächster Satz', data: {} });
  });

  it('zurück im Vordergrund → storniert, schon zugestellte Meldung weggeräumt (N6)', async () => {
    const { n } = setup({ restEnd: true });
    await n.updateRestEnd({ timer, appActive: false, nowMs });
    vi.mocked(ExpoNotifications.dismissNotificationAsync).mockClear();
    await n.updateRestEnd({ timer, appActive: true, nowMs: nowMs + 20_000 });
    expect(restEnd()).toBeUndefined();
    expect(ExpoNotifications.dismissNotificationAsync).toHaveBeenCalledWith(
      NOTIFICATION_IDS.restEnd,
    );
  });

  it('Pause übersprungen → storniert', async () => {
    const { n } = setup({ restEnd: true });
    await n.updateRestEnd({ timer, appActive: false, nowMs });
    await n.updateRestEnd({ timer: null, appActive: false, nowMs });
    expect(restEnd()).toBeUndefined();
  });

  it('±15 s → neu geplant', async () => {
    const { n } = setup({ restEnd: true });
    await n.updateRestEnd({ timer, appActive: false, nowMs });
    await n.updateRestEnd({ timer: adjustRest(timer, 15), appActive: false, nowMs });
    expect(dateOf(restEnd())).toBe(nowMs + 105_000);
    await n.updateRestEnd({ timer: adjustRest(timer, -15), appActive: false, nowMs });
    expect(dateOf(restEnd())).toBe(nowMs + 75_000);
    expect(fake.scheduled.size).toBe(1);
  });

  it('Pause schon vorbei → nichts geplant', async () => {
    const { n } = setup({ restEnd: true });
    await expect(
      n.updateRestEnd({ timer, appActive: false, nowMs: nowMs + 90_000 }),
    ).resolves.toBeNull();
    expect(restEnd()).toBeUndefined();
  });

  it('ohne Opt-in oder ohne Erlaubnis → nichts geplant', async () => {
    await setup().n.updateRestEnd({ timer, appActive: false, nowMs });
    await setup({ restEnd: true }, 'undetermined').n.updateRestEnd({
      timer,
      appActive: false,
      nowMs,
    });
    expect(restEnd()).toBeUndefined();
  });
});

describe('Erlaubnis nur nach Nutzer-Aktion (Frage 16)', () => {
  it('Planen, Stornieren, Neuplanen, Abmelden fragen NIE nach der Erlaubnis', async () => {
    for (const prefs of [{}, { measurement: true, restEnd: true }]) {
      const { n } = setup(prefs, 'undetermined');
      await sync(n, rows());
      await sync(n, null);
      await sync(n, revoked(rows()));
      await n.cancelMeasurement();
      await n.updateRestEnd({ timer: startRest(60, nowMs), appActive: false, nowMs });
      await n.updateRestEnd({ timer: null, appActive: true, nowMs });
      await n.loadPrefs();
      await n.permission();
      await n.declineMeasurementOffer();
      await n.declineRestEndOffer();
      await n.disableMeasurement();
      await n.disableRestEnd();
      await n.reset();
    }
    expect(ExpoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('nie ein Push-Token', async () => {
    const { n } = setup({ measurement: true });
    await n.enableMeasurement();
    await sync(n, rows());
    expect(ExpoNotifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(ExpoNotifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it('„Ja“ fragt das System; Ablehnen ist folgenlos (nichts geplant, nur „schon gefragt“)', async () => {
    fake.answer = { status: 'denied', granted: false };
    const { n } = setup({}, 'undetermined');
    await expect(n.enableMeasurement()).resolves.toBe('denied');
    expect(ExpoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await expect(n.loadPrefs()).resolves.toMatchObject({
      measurement: false,
      measurementAsked: true,
    });
    await sync(n, rows());
    expect(fake.scheduled.size).toBe(0);
  });

  it('„Ja“ mit Erlaubnis → eingeschaltet; schon erlaubt → keine zweite Abfrage', async () => {
    const { n } = setup({}, 'undetermined');
    await expect(n.enableRestEnd()).resolves.toBe('granted');
    await expect(n.enableMeasurement()).resolves.toBe('granted');
    expect(ExpoNotifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    await expect(n.loadPrefs()).resolves.toMatchObject({ measurement: true, restEnd: true });
  });
});

describe('Antippen', () => {
  it('Kaltstart und laufende App: nur erlaubte Pfade', () => {
    const { n } = setup();
    const opened: string[] = [];
    fake.lastResponse = {
      notification: { request: { content: { data: { route: MEASUREMENT_ROUTE } } } },
    };
    const stop = n.onOpen((route) => opened.push(route));
    expect(opened).toEqual([MEASUREMENT_ROUTE]);
    fake.responseListener?.({
      notification: { request: { content: { data: { route: '/konto' } } } },
    });
    fake.responseListener?.({ notification: { request: { content: { data: {} } } } });
    expect(opened).toEqual([MEASUREMENT_ROUTE]);
    stop();
    expect(fake.responseListener).toBeNull();
  });
});

describe('Browser (Web-Treiber)', () => {
  it('keine Benachrichtigungen: alles No-op, keine Erlaubnis-Abfrage', async () => {
    const n = createNotifications(webDriver, createMemoryStore());
    expect(n.supported).toBe(false);
    await expect(
      n.syncMeasurement({ rows: rows(), versions: VERSIONS, nowMs, timeZone: TZ }),
    ).resolves.toBeNull();
    await expect(n.enableMeasurement()).resolves.toBe('unsupported');
    await expect(
      n.updateRestEnd({ timer: startRest(90, nowMs), appActive: false, nowMs }),
    ).resolves.toBeNull();
    expect(ExpoNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(ExpoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('Angebote (einmalig)', () => {
  const base = {
    supported: true,
    prefs: {
      measurement: false,
      restEnd: false,
      measurementAsked: false,
      restEndAsked: false,
      scheduledMeasurement: null,
    },
    today: '2026-10-03',
  };

  it('Mess-Angebot erst nach der ersten Messung und nach dem Onboarding', () => {
    const measured = rows({
      bodyMeasurements: [
        { user_id: USER_ID, measured_on: '2026-10-03' } as UserRows['bodyMeasurements'][number],
      ],
    });
    expect(
      shouldOfferMeasurementNotification({ ...base, rows: measured, versions: VERSIONS }),
    ).toBe(true);
    // keine Messung
    expect(shouldOfferMeasurementNotification({ ...base, rows: rows(), versions: VERSIONS })).toBe(
      false,
    );
    // noch im Onboarding
    expect(
      shouldOfferMeasurementNotification({
        ...base,
        rows: { ...measured, profile: profile({ onboarding_completed_at: null }) },
        versions: VERSIONS,
      }),
    ).toBe(false);
    // schon gefragt, Browser, ohne Einwilligung, Erinnerung aus
    expect(
      shouldOfferMeasurementNotification({
        ...base,
        prefs: { ...base.prefs, measurementAsked: true },
        rows: measured,
        versions: VERSIONS,
      }),
    ).toBe(false);
    expect(
      shouldOfferMeasurementNotification({
        ...base,
        supported: false,
        rows: measured,
        versions: VERSIONS,
      }),
    ).toBe(false);
    expect(
      shouldOfferMeasurementNotification({ ...base, rows: revoked(measured), versions: VERSIONS }),
    ).toBe(false);
    expect(
      shouldOfferMeasurementNotification({
        ...base,
        rows: { ...measured, reminder: reminder({ enabled: false }) },
        versions: VERSIONS,
      }),
    ).toBe(false);
  });

  it('„in N Tagen“ aus dem echten Termin; ohne künftigen Termin kein Angebot (N6)', () => {
    const measured = rows({
      bodyMeasurements: [
        { user_id: USER_ID, measured_on: '2026-10-03' } as UserRows['bodyMeasurements'][number],
      ],
      reminder: reminder({ interval_days: 28, next_due_on: '2026-10-20' }),
    });
    expect(measurementOfferDays(measured, '2026-10-03')).toBe(17);
    expect(measurementOfferDays(measured, '2026-10-20')).toBeNull();
    expect(
      shouldOfferMeasurementNotification({
        ...base,
        today: '2026-10-21',
        rows: measured,
        versions: VERSIONS,
      }),
    ).toBe(false);
    expect(t.notifications.offerText(17)).toBe(
      'Sollen wir dich in 17 Tagen per Benachrichtigung ans nächste Messen erinnern?',
    );
    expect(t.notifications.offerText(1)).toContain('morgen');
  });

  it('Pausenende-Frage nur einmal und nur in der App', () => {
    expect(shouldAskRestEndNotification(base)).toBe(true);
    expect(
      shouldAskRestEndNotification({ ...base, prefs: { ...base.prefs, restEndAsked: true } }),
    ).toBe(false);
    expect(shouldAskRestEndNotification({ ...base, supported: false })).toBe(false);
  });
});
