import { z } from 'zod';

import { LIVE_COMPANION } from '../constants';
import { TRACKED_ROUTE_SPORTS, type TrackedRouteSport } from '../enums';

/**
 * Live-Begleitung / Notfallkontakt (CLAUDE.md Ausnahme 25.10.2026, docs/PLAN-PHASE-10.md 21): Zod-Schemas an den
 * Grenzen – Notfallkontakte (nur auf dem Gerät), Antworten der Datenbank-Funktionen (Migration
 * *_live_companion.sql) und der Begleit-Seite (/api/begleitung). Keine Gesundheitsdaten, keine Pace, keine Spur.
 */

const L = LIVE_COMPANION;

/**
 * Sportarten der Begleitung = Aufzeichnungs-Sportarten (Laufen, Rad inkl. E-Bike, Gehen inkl. Wandern). Mehr verrät
 * die Begleit-Seite nicht (z. B. nicht „E-Bike“ oder die genaue GPS-Sportart).
 */
export const LIVE_SPORTS = TRACKED_ROUTE_SPORTS;
export type LiveSport = TrackedRouteSport;

/** Zustände einer Sitzung (Spalte live_sessions.status). */
export const LIVE_STATUSES = ['active', 'paused', 'arrived', 'ended'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

/** Offene Sitzung: Position wird gesendet und angezeigt. */
export const LIVE_OPEN_STATUSES = ['active', 'paused'] as const satisfies readonly LiveStatus[];
/** Abgeschlossen: Position gelöscht, Seite zeigt höchstens noch 2 h den Status ohne Karte. */
export const LIVE_CLOSED_STATUSES = ['arrived', 'ended'] as const satisfies readonly LiveStatus[];

export const isLiveOpenStatus = (status: LiveStatus): boolean =>
  (LIVE_OPEN_STATUSES as readonly LiveStatus[]).includes(status);

/** Link-Token: 32 Bytes base64url ohne Auffüllung (43 Zeichen, 256 Bit). */
export const liveTokenSchema = z
  .string()
  .regex(new RegExp(`^[A-Za-z0-9_-]{${L.tokenChars}}$`), 'Ungültiges Token.');

/** Anzeigename für die Begleit-Seite: 1–30 Zeichen, ohne Steuerzeichen, ohne Rand-Leerzeichen. */
export const liveDisplayNameSchema = z
  .string()
  .trim()
  .min(1, 'Bitte einen Namen eingeben.')
  .max(L.displayNameMax, `Höchstens ${L.displayNameMax} Zeichen.`)
  // eslint-disable-next-line no-control-regex -- Steuerzeichen bewusst ausschließen
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Ungültige Zeichen.');

/** Telefonnummer im internationalen Format (E.164, z. B. +491711234567). */
export const livePhoneSchema = z.e164('Bitte eine gültige Telefonnummer eingeben.');

/** Notfallkontakt – NUR auf dem Gerät gespeichert (verschlüsselt), nie auf dem Server (CLAUDE.md, F1). */
export const liveContactSchema = z
  .strictObject({
    id: z.string().min(1).max(64),
    name: z
      .string()
      .trim()
      .min(1, 'Bitte einen Namen eingeben.')
      .max(L.contactNameMax, `Höchstens ${L.contactNameMax} Zeichen.`),
    phone: livePhoneSchema.nullable(),
    email: z.email('Bitte eine gültige E-Mail-Adresse eingeben.').max(254).nullable(),
    /** Standard-Kontakt (vorausgewählt beim Teilen und im SOS-Blatt). */
    isDefault: z.boolean(),
  })
  .refine((c) => c.phone !== null || c.email !== null, {
    message: 'Bitte Telefonnummer oder E-Mail-Adresse eingeben.',
    path: ['phone'],
  });

export type LiveContact = z.infer<typeof liveContactSchema>;

/** Liste der Kontakte: höchstens 3, höchstens einer als Standard, ids eindeutig. */
export const liveContactsSchema = z
  .array(liveContactSchema)
  .max(L.maxContacts, `Höchstens ${L.maxContacts} Notfallkontakte.`)
  .refine((list) => list.filter((c) => c.isDefault).length <= 1, 'Nur ein Standard-Kontakt.')
  .refine((list) => new Set(list.map((c) => c.id)).size === list.length, 'Doppelte Kontakte.');

/** Einstellungen der Live-Begleitung auf dem Gerät (zusammen mit den Kontakten verschlüsselt gespeichert). */
export const liveSettingsSchema = z.strictObject({
  /** Anzeigename; null = Vorname aus dem Profil (F8). */
  displayName: liveDisplayNameSchema.nullable(),
  /** Eigener Text vor dem Link; null = Standardtext. */
  message: z.string().trim().min(1).max(L.messageMax).nullable(),
  /** Positions-Update alle … s. */
  intervalS: z.literal(L.pushIntervalChoicesS),
  /** „Kein Lebenszeichen“-Erinnerung an die Person selbst (lokal); null = aus. */
  noSignOfLifeMin: z.literal(L.noSignOfLifeChoicesMin).nullable(),
});

export type LiveSettings = z.infer<typeof liveSettingsSchema>;

export const DEFAULT_LIVE_SETTINGS: LiveSettings = {
  displayName: null,
  message: null,
  intervalS: L.pushIntervalS,
  noSignOfLifeMin: L.noSignOfLifeGraceMin,
};

/** Gespeicherter Stand auf dem Gerät (Kontakte + Einstellungen). */
export const liveDeviceDataSchema = z.strictObject({
  v: z.literal(1),
  contacts: liveContactsSchema,
  settings: liveSettingsSchema,
});

export type LiveDeviceData = z.infer<typeof liveDeviceDataSchema>;

const isoTime = z.iso.datetime({ offset: true });

/** Antwort von start_live_session / rotate_live_token: Token im Klartext EINMAL (nie gespeichert außer im Link). */
export const liveStartResultSchema = z.strictObject({
  id: z.uuid(),
  token: liveTokenSchema,
  started_at: isoTime,
  planned_end_at: isoTime,
  expires_at: isoTime,
});

export type LiveStartResult = z.infer<typeof liveStartResultSchema>;

/** Antwort von set_live_status. */
export const liveStatusResultSchema = z.strictObject({
  id: z.uuid(),
  status: z.enum(LIVE_STATUSES),
  expires_at: isoTime,
});

/** Antwort von push_live_position. */
export const LIVE_PUSH_RESULTS = ['ok', 'throttled', 'older', 'closed'] as const;
export type LivePushResult = (typeof LIVE_PUSH_RESULTS)[number];
export const livePushResultSchema = z.enum(LIVE_PUSH_RESULTS);

const lat = z.number().finite().min(-90).max(90);
const lon = z.number().finite().min(-180).max(180);

/** Letzte Position, wie sie der Kontakt sieht (keine Spur, keine Pace, keine Gesundheitswerte). */
export const livePositionSchema = z.strictObject({
  lat,
  lon,
  accuracy_m: z.number().int().min(0).max(L.accuracyMaxM).nullable(),
  recorded_at: isoTime,
});

export type LivePosition = z.infer<typeof livePositionSchema>;

const viewBase = {
  display_name: z.string().min(1).max(L.displayNameMax),
  sport: z.enum(LIVE_SPORTS),
  started_at: isoTime,
  /** Uhrzeit des Servers – „zuletzt aktualisiert vor …“ ohne falsch gehende Uhr des Kontakts. */
  server_time: isoTime,
};

/**
 * Antwort der Begleit-Seite (get_live_view über /api/begleitung). „invalid“ steht für falsches, abgelaufenes und
 * unbekanntes Token gleichermaßen (Tokens lassen sich nicht ausprobieren). Offene Sitzungen mit Position (oder noch
 * keiner), abgeschlossene IMMER ohne Koordinaten.
 */
export const liveViewSchema = z.discriminatedUnion('state', [
  z.strictObject({
    state: z.enum(LIVE_OPEN_STATUSES),
    ...viewBase,
    position: livePositionSchema.nullable(),
  }),
  z.strictObject({
    state: z.enum(LIVE_CLOSED_STATUSES),
    ...viewBase,
    ended_at: isoTime,
  }),
  z.strictObject({ state: z.literal('invalid') }),
  z.strictObject({ state: z.literal('rate_limited') }),
]);

export type LiveView = z.infer<typeof liveViewSchema>;
export type LiveOpenView = Extract<LiveView, { state: 'active' | 'paused' }>;
export type LiveClosedView = Extract<LiveView, { state: 'arrived' | 'ended' }>;
