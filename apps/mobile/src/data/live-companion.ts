import {
  DEFAULT_LIVE_SETTINGS,
  type LiveContact,
  type LiveDeviceData,
  liveDeviceDataSchema,
  type LivePushResult,
  livePushResultSchema,
  type LiveSport,
  type LiveStatus,
  liveStartResultSchema,
  liveStatusResultSchema,
} from '@fitnessapp/core';
import type { AppSupabaseClient } from '@fitnessapp/db';

import type { Backend } from './backend';
import type { ProtectedStore } from './protected-store';

/**
 * Live-Begleitung / Notfallkontakt (CLAUDE.md Ausnahme 25.10.2026, docs/PLAN-PHASE-10.md 21.6) – Datenschicht.
 *
 * - Supabase-Modus: Datenbank-Funktionen start_live_session, push_live_position, set_live_status, rotate_live_token
 *   (Migration 20261027170000_live_companion.sql). Gratis (F2), keine Premium-Prüfung.
 * - Testmodus: Demo ohne Server – der Link zeigt die Demo-Begleit-Seite (`/begleitung#t=demo`), es wird nichts
 *   gesendet.
 * - Notfallkontakte und Einstellungen: NUR im verschlüsselten Speicher dieses Geräts (live-store*.ts), nie auf dem
 *   Server, nie in einer Warteschlange. Abmelden, Konto löschen und „Gerätedaten löschen“ leeren ihn (attachLive).
 * Keine Koordinaten in Logs oder Fehlermeldungen.
 */

/** Laufende Begleitung aus Sicht der App (Token nur im Speicher dieses Geräts und im geteilten Link). */
export interface LiveHandle {
  readonly id: string;
  /** Klartext-Token (43 Zeichen) bzw. 'demo' im Testmodus. */
  readonly token: string;
  readonly startedAt: string;
  readonly plannedEndAt: string;
  readonly expiresAt: string;
}

export type LiveErrorCode =
  'active' | 'not_signed_in' | 'invalid' | 'closed' | 'offline' | 'unknown';

export class LiveError extends Error {
  constructor(readonly code: LiveErrorCode) {
    super(code);
    this.name = 'LiveError';
  }
}

export interface LiveStartInput {
  readonly displayName: string;
  readonly sport: LiveSport;
  readonly plannedMinutes: number;
  readonly intervalS: number;
  /** Eine noch offene Begleitung (z. B. auf einem anderen Gerät) beenden und neu starten. */
  readonly replace: boolean;
}

export interface LivePushInput {
  readonly lat: number;
  readonly lon: number;
  readonly accuracyM: number | null;
  readonly recordedAt: string;
}

export interface LiveCompanionBackend {
  readonly mode: 'remote' | 'demo';
  start(input: LiveStartInput): Promise<LiveHandle>;
  push(sessionId: string, position: LivePushInput): Promise<LivePushResult>;
  setStatus(sessionId: string, status: LiveStatus): Promise<void>;
  rotate(sessionId: string): Promise<LiveHandle>;
}

const toHandle = (raw: unknown): LiveHandle => {
  const parsed = liveStartResultSchema.safeParse(raw);
  if (!parsed.success) throw new LiveError('unknown');
  return {
    id: parsed.data.id,
    token: parsed.data.token,
    startedAt: parsed.data.started_at,
    plannedEndAt: parsed.data.planned_end_at,
    expiresAt: parsed.data.expires_at,
  };
};

/** Fehler der Datenbank → Code (ohne Inhalte; nie Koordinaten). */
export function liveErrorFrom(error: { code?: string; message?: string } | null): LiveError {
  switch (error?.code) {
    case '55000':
      return new LiveError('active');
    case '42501':
    case 'PGRST301':
      return new LiveError('not_signed_in');
    case '22023':
      return new LiveError('invalid');
    case undefined:
    case '':
      return new LiveError('offline');
    default:
      return new LiveError('unknown');
  }
}

/** Supabase: nur über die Datenbank-Funktionen (Schreiben direkt in die Tabellen ist gesperrt). */
export function createRemoteLive(options: { client: AppSupabaseClient }): LiveCompanionBackend {
  const { client } = options;
  const call = async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    let result: { data: unknown; error: { code?: string; message?: string } | null };
    try {
      result = (await client.rpc(name as never, args as never)) as typeof result;
    } catch {
      throw new LiveError('offline');
    }
    if (result.error) throw liveErrorFrom(result.error);
    return result.data;
  };
  return {
    mode: 'remote',
    async start(input) {
      return toHandle(
        await call('start_live_session', {
          p_display_name: input.displayName,
          p_sport: input.sport,
          p_planned_minutes: input.plannedMinutes,
          p_update_interval_s: input.intervalS,
          p_replace: input.replace,
        }),
      );
    },
    async push(sessionId, position) {
      const parsed = livePushResultSchema.safeParse(
        await call('push_live_position', {
          p_session_id: sessionId,
          p_lat: position.lat,
          p_lon: position.lon,
          p_accuracy_m: position.accuracyM,
          p_recorded_at: position.recordedAt,
        }),
      );
      if (!parsed.success) throw new LiveError('unknown');
      return parsed.data;
    },
    async setStatus(sessionId, status) {
      const parsed = liveStatusResultSchema.safeParse(
        await call('set_live_status', { p_session_id: sessionId, p_status: status }),
      );
      if (!parsed.success) throw new LiveError('unknown');
    },
    async rotate(sessionId) {
      return toHandle(await call('rotate_live_token', { p_session_id: sessionId }));
    },
  };
}

/**
 * Testmodus: Demo ohne Server. Gleiche Regeln wie die Datenbank für Zustände (abgeschlossen bleibt abgeschlossen),
 * nichts verlässt das Gerät.
 */
export function createDemoLive(options: {
  newId: () => string;
  now: () => number;
}): LiveCompanionBackend {
  const closed = new Set<string>();
  const handle = (id: string): LiveHandle => {
    const started = options.now();
    return {
      id,
      token: 'demo',
      startedAt: new Date(started).toISOString(),
      plannedEndAt: new Date(started).toISOString(),
      expiresAt: new Date(started + 12 * 3_600_000).toISOString(),
    };
  };
  return {
    mode: 'demo',
    async start(input) {
      const h = handle(options.newId());
      return {
        ...h,
        plannedEndAt: new Date(
          Date.parse(h.startedAt) + input.plannedMinutes * 60_000,
        ).toISOString(),
      };
    },
    async push(sessionId) {
      return closed.has(sessionId) ? 'closed' : 'ok';
    },
    async setStatus(sessionId, status) {
      if (closed.has(sessionId) && (status === 'active' || status === 'paused')) {
        throw new LiveError('closed');
      }
      if (status === 'arrived' || status === 'ended') closed.add(sessionId);
    },
    async rotate(sessionId) {
      if (closed.has(sessionId)) throw new LiveError('closed');
      return handle(sessionId);
    },
  };
}

// --- Notfallkontakte und Einstellungen (nur dieses Gerät) -----------------------------------------------------------

export const EMPTY_LIVE_DEVICE_DATA: LiveDeviceData = {
  v: 1,
  contacts: [],
  settings: DEFAULT_LIVE_SETTINGS,
};

/** Kontakte + Einstellungen lesen; kaputt/fehlt → leer (nie Fehler). */
export async function readLiveDeviceData(store: ProtectedStore): Promise<LiveDeviceData> {
  let text: string | null;
  try {
    text = await store.read();
  } catch {
    return EMPTY_LIVE_DEVICE_DATA;
  }
  if (!text) return EMPTY_LIVE_DEVICE_DATA;
  try {
    const parsed = liveDeviceDataSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : EMPTY_LIVE_DEVICE_DATA;
  } catch {
    return EMPTY_LIVE_DEVICE_DATA;
  }
}

/** Speichern (Zod an der Grenze); ungültig → Fehler „invalid“. */
export async function writeLiveDeviceData(
  store: ProtectedStore,
  data: LiveDeviceData,
): Promise<void> {
  const parsed = liveDeviceDataSchema.safeParse(data);
  if (!parsed.success) throw new LiveError('invalid');
  await store.write(JSON.stringify(parsed.data));
}

/** Standard-Kontakt (bzw. der erste). */
export function defaultContact(contacts: readonly LiveContact[]): LiveContact | null {
  return contacts.find((c) => c.isDefault) ?? contacts[0] ?? null;
}

/**
 * Adresse der Begleit-Seite: EXPO_PUBLIC_WEB_URL (Vercel-Projekt „Web“), sonst die Produktionsadresse der Website.
 * Bis zur eigenen Kurz-Domain (F9) ist das die Vercel-Domain.
 */
export const DEFAULT_LIVE_WEB_URL = 'https://fitnessapp-web-eight.vercel.app';

// --- Anbindung an das Backend ---------------------------------------------------------------------------------------

export interface LiveAttachment {
  readonly live: LiveCompanionBackend;
  readonly contactsStore: ProtectedStore;
  readonly sessionStore: ProtectedStore;
  /** Basis-Adresse der Begleit-Seite (apps/web). */
  readonly webUrl: string;
}

const registry = new WeakMap<Backend, LiveAttachment>();
const clearListeners = new Set<() => Promise<void> | void>();

/** Live-Begleitung zu einem Backend (null = nicht verbunden, z. B. in Tests). */
export function liveFor(backend: Backend): LiveAttachment | null {
  return registry.get(backend) ?? null;
}

/** Wird beim Abmelden/Konto löschen/Gerätedaten löschen aufgerufen (laufende Begleitung beenden). */
export function onLiveCleared(listener: () => Promise<void> | void): () => void {
  clearListeners.add(listener);
  return () => clearListeners.delete(listener);
}

/**
 * Abmelden, Konto löschen und „Gerätedaten löschen“: laufende Begleitung beenden (Position sofort weg) und Kontakte
 * sowie Einstellungen auf dem Gerät löschen.
 */
export function attachLive(backend: Backend, attachment: LiveAttachment): Backend {
  registry.set(backend, attachment);
  const clear = async () => {
    for (const listener of clearListeners) await Promise.resolve(listener()).catch(() => undefined);
    await attachment.contactsStore.clear().catch(() => undefined);
    await attachment.sessionStore.clear().catch(() => undefined);
  };
  const signOut = backend.signOut.bind(backend);
  backend.signOut = async () => {
    await clear();
    await signOut();
  };
  const deleteAccount = backend.deleteAccount.bind(backend);
  backend.deleteAccount = async () => {
    await deleteAccount();
    await clear();
  };
  const clearDeviceData = backend.clearDeviceData.bind(backend);
  backend.clearDeviceData = async () => {
    await clear();
    await clearDeviceData();
  };
  return backend;
}
