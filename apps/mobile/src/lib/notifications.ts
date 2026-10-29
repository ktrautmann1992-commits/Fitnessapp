import {
  daysUntilMeasurement,
  notificationSchedule,
  restEndNotificationAt,
  type RestTimer,
  type ScheduledMeasurement,
  scheduledMeasurementSchema,
} from '@fitnessapp/core';
import { z } from 'zod';

import type { KeyValueStore } from '@/data/kv';
import { readJson, STORAGE_KEYS, writeJson } from '@/data/kv';
import type { ConsentVersions } from '@/data/mapping';
import type { UserRows } from '@/data/types';
import { t } from '@/i18n';
import { healthConsentStatus } from '@/state/flow';

import type {
  NotificationContent,
  NotificationDriver,
  NotificationPermission,
} from './notification-driver';

/**
 * Lokale Benachrichtigungen planen und stornieren (docs/PLAN-PHASE-4B.md Abschnitt 7, Etappe E). WANN etwas kommt,
 * rechnet packages/core (`notificationSchedule`, `restEndNotificationAt`); hier nur die Abläufe:
 *
 * - Geräte-Einstellung (Opt-in, Standard aus) je Art: Mess-Erinnerung und Pausenende. Unabhängig davon bleibt
 *   `measurement_reminders.enabled` (Hinweis auf „Heute“) wie bisher.
 * - Die System-Erlaubnis wird NUR in `enableMeasurement()`/`enableRestEnd()`/`scheduleTestMeasurement()` abgefragt –
 *   also nach einem „Ja“ bzw. Einschalten durch die Person, nie beim App-Start oder im Onboarding (Frage 16).
 *   Alle anderen Abläufe lesen die Erlaubnis nur.
 * - Ohne gültige `health_data`-Einwilligung keine Mess-Erinnerung (Wächter S5); beim Widerruf sofort stornieren.
 * - Abmelden, Konto löschen, Testdaten löschen: alles stornieren und die Geräte-Einstellung zurücksetzen.
 * - Texte fest aus `t.notifications`, nie Werte (DSGVO Art. 9).
 */

export const NOTIFICATION_IDS = {
  measurement: 'alpha5-mess-erinnerung',
  measurementTest: 'alpha5-mess-erinnerung-test',
  restEnd: 'alpha5-pausenende',
  /** Nährstoff-Timing (docs/PLAN-NAEHRSTOFF-TIMING.md 7): „In 1 Stunde: Snack vor dem Training“ (Standard aus). */
  trainingMeal: 'alpha5-snack-vor-training',
} as const;

/** Antippen der Mess-Erinnerung öffnet die Messung (Schritt „Körperumfänge“, danach zurück zu „Heute“). */
export const MEASUREMENT_ROUTE = '/onboarding/body_measurements?edit=1';
/** Erinnerungen an Training, Essen und Trinken (docs/PLAN-ERINNERUNGEN.md): Antippen öffnet den passenden Reiter. */
export const REMINDER_ROUTES = {
  training: '/today',
  meals: '/ernaehrung',
  drink: '/uebersicht',
} as const;
/** Nur diese Pfade darf eine Benachrichtigung öffnen. */
const OPENABLE_ROUTES: readonly string[] = [MEASUREMENT_ROUTE, ...Object.values(REMINDER_ROUTES)];

/** Gemeinsamer Anfang der Kennungen aller Erinnerungen an Training, Essen und Trinken. */
export const REMINDER_ID_PREFIX = 'erinnerung-';

/** Eine fertige Erinnerung zum Planen (Zeitpunkt aus packages/core `plannedReminders`, Text aus der App). */
export interface ReminderNotification {
  readonly id: string;
  readonly atMs: number;
  readonly content: NotificationContent;
}

const scheduledRemindersSchema = z.array(
  z.object({
    id: z.string(),
    atMs: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    route: z.string().nullable(),
    channel: z.string().optional(),
  }),
);

function reminderKey(r: ReminderNotification): string {
  return JSON.stringify([
    r.id,
    r.atMs,
    r.content.title,
    r.content.body,
    r.content.route,
    r.content.channel ?? null,
  ]);
}

/** Test-Knopf (nur Testmodus): Mess-Erinnerung in 2 Minuten. */
export const TEST_MEASUREMENT_DELAY_MS = 2 * 60 * 1000;

/**
 * Geräte-Einstellung (Gerätespeicher, keine Gesundheitsdaten). Unlesbare oder fremde Werte → Standard (safeParse).
 * - `measurement`/`restEnd`: Opt-in je Art.
 * - `measurementAsked`/`restEndAsked`: Angebot bzw. Frage schon beantwortet.
 * - `scheduledMeasurement`: zuletzt geplante Mess-Erinnerung (Termin + Zeitpunkt) – je Termin höchstens eine
 *   Benachrichtigung, egal wann die App startet (Wächter E, M2).
 */
const notificationPrefsSchema = z.object({
  measurement: z.boolean().catch(false),
  restEnd: z.boolean().catch(false),
  measurementAsked: z.boolean().catch(false),
  restEndAsked: z.boolean().catch(false),
  scheduledMeasurement: scheduledMeasurementSchema.nullable().catch(null),
});

export type NotificationPrefs = Readonly<z.infer<typeof notificationPrefsSchema>>;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  measurement: false,
  restEnd: false,
  measurementAsked: false,
  restEndAsked: false,
  scheduledMeasurement: null,
};

export type EnableResult = NotificationPermission | 'unsupported';
export type TestResult = 'scheduled' | 'unsupported' | 'needs_permission' | 'needs_consent';

export interface MeasurementSyncInput {
  readonly rows: UserRows | null;
  readonly versions: ConsentVersions;
  readonly nowMs: number;
  readonly timeZone: string;
}

export interface RestEndInput {
  /** Laufende Pause (null = keine bzw. übersprungen). */
  readonly timer: RestTimer | null;
  /** App im Vordergrund → nie planen (die Pausen-Leiste ist sichtbar). */
  readonly appActive: boolean;
  readonly nowMs: number;
}

export interface Notifications {
  readonly supported: boolean;
  loadPrefs(): Promise<NotificationPrefs>;
  permission(): Promise<NotificationPermission>;
  /** Planen bzw. stornieren nach aktuellem Stand (App-Start, Messung gespeichert, Abstand/Schalter geändert, Widerruf). */
  syncMeasurement(input: MeasurementSyncInput): Promise<number | null>;
  /** Sofort stornieren (Widerruf `health_data`). */
  cancelMeasurement(): Promise<void>;
  enableMeasurement(): Promise<EnableResult>;
  disableMeasurement(): Promise<void>;
  declineMeasurementOffer(): Promise<void>;
  /** Pausenende: im Hintergrund planen, sonst (Vordergrund, übersprungen, vorbei) stornieren. */
  updateRestEnd(input: RestEndInput): Promise<number | null>;
  enableRestEnd(): Promise<EnableResult>;
  disableRestEnd(): Promise<void>;
  declineRestEndOffer(): Promise<void>;
  /**
   * Nährstoff-Timing: Erinnerung vor dem Training eingeschaltet (Tipp der Person) – fragt ggf. nach der Erlaubnis.
   * Die Einstellung selbst (Standard aus) liegt in lib/training-meal-prefs.ts.
   */
  allowTrainingMeal(): Promise<EnableResult>;
  /** Erinnerung planen (Zeitpunkt in ms) bzw. stornieren (null). Fester Text ohne Werte, nur bei Erlaubnis. */
  syncTrainingMeal(atMs: number | null): Promise<void>;
  /**
   * Erinnerungen an Training, Essen und Trinken eingeschaltet (Tipp der Person) – fragt ggf. nach der Erlaubnis. Die
   * Einstellung selbst liegt in lib/reminder-prefs.ts.
   */
  allowReminders(): Promise<EnableResult>;
  /**
   * Erinnerungen ersetzen: Weggefallene stornieren, Neue bzw. Geänderte planen, Gleiche unverändert lassen. Ohne
   * Erlaubnis werden alle storniert. Ergebnis = Anzahl geplanter Erinnerungen.
   */
  syncReminders(items: readonly ReminderNotification[]): Promise<number>;
  /** Abmelden, Konto löschen, Testdaten löschen. */
  reset(): Promise<void>;
  /** Versteckter Test-Knopf (nur Testmodus): Mess-Erinnerung in 2 Minuten. */
  scheduleTestMeasurement(input: Omit<MeasurementSyncInput, 'timeZone'>): Promise<TestResult>;
  /** Antippen einer Benachrichtigung → erlaubter App-Pfad. */
  onOpen(listener: (route: string) => void): () => void;
}

/** Hält Abläufe in Reihenfolge (z. B. Planen nach dem Laden, dann Stornieren nach dem Widerruf). */
function serial() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

export function createNotifications(
  driver: NotificationDriver,
  store: KeyValueStore,
): Notifications {
  const queue = serial();

  async function loadPrefs(): Promise<NotificationPrefs> {
    const stored = await readJson<unknown>(store, STORAGE_KEYS.notificationPrefs).catch(() => null);
    const parsed = notificationPrefsSchema.safeParse({
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(stored !== null && typeof stored === 'object' ? stored : {}),
    });
    return parsed.success ? parsed.data : DEFAULT_NOTIFICATION_PREFS;
  }

  async function savePrefs(change: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const next = { ...(await loadPrefs()), ...change };
    await writeJson(store, STORAGE_KEYS.notificationPrefs, next);
    return next;
  }

  async function canDeliver(
    kind: 'measurement' | 'restEnd',
    prefs?: NotificationPrefs,
  ): Promise<boolean> {
    if (!driver.supported) return false;
    if (!(prefs ?? (await loadPrefs()))[kind]) return false;
    return (await driver.permission()) === 'granted';
  }

  const consentValid = (rows: UserRows, versions: ConsentVersions) =>
    healthConsentStatus(rows, versions) === 'valid';

  function syncMeasurementNow(input: MeasurementSyncInput): Promise<number | null> {
    return queue(async () => {
      if (!driver.supported) return null;
      const rows = input.rows;
      const prefs = await loadPrefs();
      const dueOn = rows?.reminder?.next_due_on ?? null;
      const atMs =
        rows && (await canDeliver('measurement', prefs))
          ? notificationSchedule(
              rows.reminder ? { enabled: rows.reminder.enabled, next_due_on: dueOn } : null,
              input.nowMs,
              input.timeZone,
              consentValid(rows, input.versions),
              prefs.scheduledMeasurement,
            )
          : null;
      if (atMs === null || dueOn === null) {
        await driver.cancel(NOTIFICATION_IDS.measurement);
        return null;
      }
      await driver.schedule(
        NOTIFICATION_IDS.measurement,
        { title: t.notifications.measurementTitle, body: null, route: MEASUREMENT_ROUTE },
        atMs,
      );
      const scheduled: ScheduledMeasurement = { dueOn, atMs };
      await savePrefs({ scheduledMeasurement: scheduled });
      return atMs;
    });
  }

  const cancelMeasurement = () =>
    queue(async () => {
      if (!driver.supported) return;
      await driver.cancel(NOTIFICATION_IDS.measurement);
      await driver.cancel(NOTIFICATION_IDS.measurementTest);
    });

  async function enable(kind: 'measurement' | 'restEnd'): Promise<EnableResult> {
    if (!driver.supported) return 'unsupported';
    const asked = kind === 'measurement' ? 'measurementAsked' : 'restEndAsked';
    // Nur hier fragt das System nach – nach einer Nutzer-Aktion.
    const current = await driver.permission();
    const permission = current === 'granted' ? current : await driver.requestPermission();
    await savePrefs({ [kind]: permission === 'granted', [asked]: true });
    return permission;
  }

  return {
    supported: driver.supported,
    loadPrefs,
    permission: () => (driver.supported ? driver.permission() : Promise.resolve('denied')),
    syncMeasurement: syncMeasurementNow,
    cancelMeasurement,
    enableMeasurement: () => enable('measurement'),
    disableMeasurement: async () => {
      await savePrefs({ measurement: false, measurementAsked: true });
      await cancelMeasurement();
    },
    declineMeasurementOffer: async () => {
      await savePrefs({ measurementAsked: true });
    },
    updateRestEnd: (input) =>
      queue(async () => {
        if (!driver.supported) return null;
        const atMs =
          input.timer && !input.appActive && (await canDeliver('restEnd'))
            ? restEndNotificationAt(input.timer, input.nowMs)
            : null;
        if (atMs === null) {
          await driver.cancel(NOTIFICATION_IDS.restEnd);
          // Zurück in der App: eine schon zugestellte „Pause vorbei“-Meldung wegräumen (Wächter E, N6).
          if (input.appActive) await driver.dismiss(NOTIFICATION_IDS.restEnd);
          return null;
        }
        await driver.schedule(
          NOTIFICATION_IDS.restEnd,
          { title: t.notifications.restEndTitle, body: null, route: null },
          atMs,
        );
        return atMs;
      }),
    enableRestEnd: () => enable('restEnd'),
    disableRestEnd: async () => {
      await savePrefs({ restEnd: false, restEndAsked: true });
      await queue(async () => {
        if (driver.supported) await driver.cancel(NOTIFICATION_IDS.restEnd);
      });
    },
    declineRestEndOffer: async () => {
      await savePrefs({ restEndAsked: true });
    },
    allowTrainingMeal: async () => {
      if (!driver.supported) return 'unsupported';
      // Nur hier fragt das System nach – nach dem Tipp auf „Erinnerung vor dem Training“.
      const current = await driver.permission();
      return current === 'granted' ? current : driver.requestPermission();
    },
    syncTrainingMeal: (atMs) =>
      queue(async () => {
        if (!driver.supported) return;
        if (atMs === null || (await driver.permission()) !== 'granted') {
          await driver.cancel(NOTIFICATION_IDS.trainingMeal);
          return;
        }
        await driver.schedule(
          NOTIFICATION_IDS.trainingMeal,
          { title: t.trainingMeals.reminder.notificationTitle, body: null, route: null },
          atMs,
        );
      }),
    allowReminders: async () => {
      if (!driver.supported) return 'unsupported';
      // Nur hier fragt das System nach – nach dem Einschalten einer Erinnerung in den Einstellungen.
      const current = await driver.permission();
      return current === 'granted' ? current : driver.requestPermission();
    },
    syncReminders: (items) =>
      queue(async () => {
        if (!driver.supported) return 0;
        const stored = scheduledRemindersSchema.safeParse(
          await readJson<unknown>(store, STORAGE_KEYS.reminderScheduled).catch(() => null),
        );
        const before = stored.success ? stored.data : [];
        const next = (await driver.permission()) === 'granted' ? items : [];
        const keep = new Set(
          before.map((b) =>
            reminderKey({
              id: b.id,
              atMs: b.atMs,
              content: {
                title: b.title,
                body: b.body,
                route: b.route,
                ...(b.channel ? { channel: b.channel as NotificationContent['channel'] } : {}),
              },
            }),
          ),
        );
        const nextIds = new Set(next.map((r) => r.id));
        for (const b of before) {
          if (!nextIds.has(b.id)) await driver.cancel(b.id);
        }
        for (const r of next) {
          if (!r.id.startsWith(REMINDER_ID_PREFIX)) continue;
          if (!keep.has(reminderKey(r))) await driver.schedule(r.id, r.content, r.atMs);
        }
        await writeJson(
          store,
          STORAGE_KEYS.reminderScheduled,
          next.map((r) => ({ id: r.id, atMs: r.atMs, ...r.content })),
        );
        return next.length;
      }),
    reset: () =>
      queue(async () => {
        if (driver.supported) await driver.cancelAll();
        await store.removeItem(STORAGE_KEYS.notificationPrefs);
        await store.removeItem(STORAGE_KEYS.reminderPrefs);
        await store.removeItem(STORAGE_KEYS.reminderScheduled);
      }),
    scheduleTestMeasurement: (input) =>
      queue(async () => {
        if (!driver.supported) return 'unsupported';
        if (!input.rows || !consentValid(input.rows, input.versions)) return 'needs_consent';
        if (!(await canDeliver('measurement'))) return 'needs_permission';
        await driver.schedule(
          NOTIFICATION_IDS.measurementTest,
          { title: t.notifications.measurementTitle, body: null, route: MEASUREMENT_ROUTE },
          input.nowMs + TEST_MEASUREMENT_DELAY_MS,
        );
        return 'scheduled';
      }),
    onOpen: (listener) =>
      driver.onOpen((route) => {
        if (OPENABLE_ROUTES.includes(route)) listener(route);
      }),
  };
}

/** Zeitzone des Geräts („Ortszeit“, Frage 9); Fallback Europe/Berlin. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
  } catch {
    return 'Europe/Berlin';
  }
}

/**
 * Einmaliges Angebot „Sollen wir dich in N Tagen erinnern?“ (Frage 16): nach der ersten gespeicherten Messung, aber
 * nie im Onboarding (dort liegt die erste Messung oft) – deshalb erst, wenn das Onboarding abgeschlossen ist (Karte
 * auf „Heute“ bzw. der Übersicht). Nur in der App, mit gültiger Einwilligung und eingeschalteter Mess-Erinnerung.
 */
export function shouldOfferMeasurementNotification(input: {
  readonly supported: boolean;
  readonly prefs: NotificationPrefs;
  readonly rows: UserRows | null;
  readonly versions: ConsentVersions;
  /** Heute (ISO), für „in N Tagen“ aus dem echten Termin. */
  readonly today: string;
}): boolean {
  const { rows } = input;
  return Boolean(
    measurementOfferDays(rows, input.today) !== null &&
    input.supported &&
    !input.prefs.measurement &&
    !input.prefs.measurementAsked &&
    rows?.profile?.onboarding_completed_at != null &&
    rows.bodyMeasurements.length > 0 &&
    rows.reminder?.enabled &&
    healthConsentStatus(rows, input.versions) === 'valid',
  );
}

/** „Sollen wir dich in N Tagen erinnern?“ – N aus dem echten Termin (`next_due_on`), null ohne künftigen Termin. */
export function measurementOfferDays(rows: UserRows | null, today: string): number | null {
  return daysUntilMeasurement(rows?.reminder?.next_due_on ?? null, today);
}

/** Einmalige Frage beim ersten Start des Trainingsmodus (nur in der App). */
export function shouldAskRestEndNotification(input: {
  readonly supported: boolean;
  readonly prefs: NotificationPrefs;
}): boolean {
  return input.supported && !input.prefs.restEnd && !input.prefs.restEndAsked;
}
