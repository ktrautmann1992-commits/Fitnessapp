import {
  clampPlannedMinutes,
  isLiveOpenStatus,
  LIVE_STATUSES,
  liveLinkUrl,
  LIVE_PAGE_PATH,
  type LiveSport,
  type LiveStatus,
  noSignOfLifeAt,
  roundLivePosition,
  shouldPushPosition,
  TRACKED_ROUTE_SPORTS,
} from '@fitnessapp/core';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

import type { Backend } from '@/data/backend';
import { type LiveHandle, LiveError, liveFor, onLiveCleared } from '@/data/live-companion';
import { t } from '@/i18n';

import { notificationDriver } from './notification-driver';
import { recordingSession } from './recording-session';

/**
 * Live-Begleitung – Steuerung (docs/PLAN-PHASE-10.md 21.2/21.6). Lebt außerhalb der Bildschirme wie die Aufzeichnung:
 * - Start NUR auf ausdrücklichen Tipp während einer laufenden Aufzeichnung (CLAUDE.md); jederzeit mit einem Tipp
 *   beendbar („Beenden“/„Angekommen“).
 * - Positionen kommen aus der bestehenden Aufzeichnung (Vordergrund-Dienst, W-G13) – KEINE neue Berechtigung, keine
 *   zusätzliche Hintergrund-Ortung. Gesendet wird nur die jeweils neueste Position, gedrosselt (shouldPushPosition).
 *   Fehler beim Senden bremsen die Aufzeichnung nie.
 * - Pause der Aufzeichnung → „pausiert“; Aufzeichnung gespeichert/verworfen → Begleitung endet automatisch.
 * - „Kein Lebenszeichen“-Erinnerung nur als LOKALE Benachrichtigung an die Person selbst (F6).
 * Keine Koordinaten in Logs.
 */

const REMINDER_ID = 'alpha5-live-no-sign-of-life';
/** Neuer Versuch, eine Begleitung auf dem Server zu schließen (z. B. nach Funkloch). */
const CLOSE_RETRY_MS = 30_000;

export interface LiveCompanionState {
  readonly handle: LiveHandle;
  readonly mode: 'remote' | 'demo';
  /** Link für die Kontakte (Token im Fragment). */
  readonly url: string;
  readonly sport: LiveSport;
  readonly displayName: string;
  /** Ausgewählte Notfallkontakte (nur ids; die Kontakte liegen im Gerätespeicher). */
  readonly contactIds: readonly string[];
  readonly plannedMinutes: number;
  readonly intervalS: number;
  readonly noSignOfLifeMin: number | null;
  readonly recordingId: string;
  readonly status: LiveStatus;
  /** Status auf dem Server angekommen? (false = wird nachgereicht) */
  readonly synced: boolean;
  /** Zeitpunkt von „Mir geht's gut“ (ms). */
  readonly ackAt: number | null;
  /** Letzte Übertragung fehlgeschlagen (z. B. Funkloch) – Hinweis im Banner. */
  readonly offline: boolean;
}

const persistedSchema = z.strictObject({
  v: z.literal(1),
  handle: z.strictObject({
    id: z.string().min(1),
    token: z.string().min(1),
    startedAt: z.string(),
    plannedEndAt: z.string(),
    expiresAt: z.string(),
  }),
  mode: z.enum(['remote', 'demo']),
  url: z.string(),
  sport: z.enum(TRACKED_ROUTE_SPORTS),
  displayName: z.string(),
  contactIds: z.array(z.string()).max(3),
  plannedMinutes: z.number(),
  intervalS: z.number(),
  noSignOfLifeMin: z.number().nullable(),
  recordingId: z.string(),
  status: z.enum(LIVE_STATUSES),
  synced: z.boolean(),
  ackAt: z.number().nullable(),
});

class LiveCompanionStore {
  private value: LiveCompanionState | null = null;
  private listeners = new Set<() => void>();
  private backend: Backend | null = null;
  private lastSent: { lat: number; lng: number; sentAt: number } | null = null;
  private pushing = false;
  private unsubscribe: (() => void) | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;

  get(): LiveCompanionState | null {
    return this.value;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Neue Begleitung übernehmen (nach erfolgreichem Start) bzw. wiederhergestellte. */
  attach(backend: Backend, value: LiveCompanionState): void {
    this.detach();
    this.backend = backend;
    this.value = value;
    this.lastSent = null;
    this.notify();
    void this.persist();
    if (!isLiveOpenStatus(value.status)) {
      // Abgeschlossen, aber noch nicht beim Server angekommen (z. B. nach Neustart): nachreichen.
      void this.syncStatus();
      return;
    }
    this.unsubscribe = recordingSession.subscribe(() => this.onRecording());
    void this.scheduleReminder();
    this.onRecording();
  }

  update(change: (state: LiveCompanionState) => LiveCompanionState): void {
    if (!this.value) return;
    this.value = change(this.value);
    this.notify();
    void this.persist();
  }

  /** Status setzen (Server + lokal). Abschließen löscht die Position auf dem Server sofort. */
  async setStatus(status: LiveStatus): Promise<void> {
    const current = this.value;
    if (!current || !isLiveOpenStatus(current.status)) return;
    const closing = !isLiveOpenStatus(status);
    this.update((s) => ({ ...s, status, synced: false }));
    if (closing) {
      this.stopListening();
      await this.cancelReminder();
    }
    await this.syncStatus();
  }

  /** Status zum Server schicken; scheitert es, später erneut (Abschluss geht nie verloren). */
  private async syncStatus(): Promise<void> {
    const current = this.value;
    const live = this.backend ? liveFor(this.backend)?.live : null;
    if (!current || current.synced || !live) return;
    try {
      await live.setStatus(current.handle.id, current.status);
      this.update((s) => ({ ...s, synced: true, offline: false }));
    } catch (error) {
      // Schon abgeschlossen/abgelaufen bzw. nicht mehr angemeldet: nichts mehr zu tun.
      if (error instanceof LiveError && error.code !== 'offline' && error.code !== 'unknown') {
        this.update((s) => ({ ...s, synced: true }));
      } else {
        this.update((s) => ({ ...s, offline: true }));
        this.scheduleRetry();
      }
    }
    if (this.value && this.value.synced && !isLiveOpenStatus(this.value.status)) {
      await this.clear();
    }
  }

  private scheduleRetry(): void {
    if (this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      void this.syncStatus();
    }, CLOSE_RETRY_MS);
  }

  /** Neuen Link erzeugen (altes Token sofort ungültig). */
  async rotate(): Promise<string> {
    const current = this.value;
    const attachment = this.backend ? liveFor(this.backend) : null;
    if (!current || !attachment || !isLiveOpenStatus(current.status)) throw new LiveError('closed');
    const handle = await attachment.live.rotate(current.handle.id);
    const url = liveUrlFor(attachment.webUrl, handle.token);
    this.update((s) => ({ ...s, handle, url }));
    return url;
  }

  /** „Mir geht's gut“: Erinnerung erst wieder nach weiteren Minuten. */
  acknowledge(now: number): void {
    this.update((s) => ({ ...s, ackAt: now }));
    void this.scheduleReminder();
  }

  /** Aufzeichnung hat sich geändert: Status spiegeln, ggf. neueste Position senden. */
  private onRecording(): void {
    const current = this.value;
    if (!current || !isLiveOpenStatus(current.status)) return;
    const recording = recordingSession.get();
    if (!recording || recording.state.id !== current.recordingId) {
      // Gespeichert oder verworfen → Begleitung endet automatisch.
      void this.setStatus('ended');
      return;
    }
    const wanted: LiveStatus = recording.state.status === 'recording' ? 'active' : 'paused';
    if (wanted !== current.status) {
      this.update((s) => ({ ...s, status: wanted, synced: false }));
      void this.syncStatus();
    }
    if (wanted !== 'active') return;
    const segment = recording.state.segments.at(-1);
    const point = segment?.points.at(-1);
    if (!point) return;
    const now = Date.now();
    if (
      this.pushing ||
      !shouldPushPosition({
        last: this.lastSent,
        next: point,
        now,
        intervalS: current.intervalS,
      })
    ) {
      return;
    }
    const rounded = roundLivePosition({
      lat: point.lat,
      lng: point.lng,
      accuracyM: point.accuracyM,
    });
    const live = this.backend ? liveFor(this.backend)?.live : null;
    if (!rounded || !live) return;
    this.pushing = true;
    // Demo-Aufzeichnung läuft im Zeitraffer in der Vergangenheit – dort zählt „jetzt“.
    const recordedAt = new Date(
      current.mode === 'demo' ? now : Math.min(point.t, now),
    ).toISOString();
    void live
      .push(current.handle.id, {
        lat: rounded.lat,
        lon: rounded.lon,
        accuracyM: rounded.accuracyM,
        recordedAt,
      })
      .then((result) => {
        this.lastSent = { lat: point.lat, lng: point.lng, sentAt: now };
        if (this.value?.offline) this.update((s) => ({ ...s, offline: false }));
        if (result === 'closed') {
          // Auf dem Server abgelaufen (12 h) oder anderswo beendet.
          this.update((s) => ({ ...s, status: 'ended', synced: true }));
          this.stopListening();
          void this.cancelReminder().then(() => this.clear());
        }
      })
      .catch(() => {
        // Funkloch: beim nächsten Punkt erneut (nur die neueste Position, keine Historie).
        if (this.value && !this.value.offline) this.update((s) => ({ ...s, offline: true }));
      })
      .finally(() => {
        this.pushing = false;
      });
  }

  private async scheduleReminder(): Promise<void> {
    const current = this.value;
    if (!current || !notificationDriver.supported) return;
    const at = noSignOfLifeAt({
      startedAt: current.handle.startedAt,
      plannedMinutes: current.plannedMinutes,
      graceMin: current.noSignOfLifeMin,
      acknowledgedAt: current.ackAt,
    });
    try {
      await notificationDriver.cancel(REMINDER_ID);
      if (at === null || (await notificationDriver.permission()) !== 'granted') return;
      await notificationDriver.schedule(
        REMINDER_ID,
        { title: t.live.reminder.title, body: t.live.reminder.body, route: null },
        Math.max(at, Date.now() + 1000),
      );
    } catch {
      // Ohne Erinnerung weiter (Hinweis steht zusätzlich in der App).
    }
  }

  private async cancelReminder(): Promise<void> {
    try {
      await notificationDriver.cancel(REMINDER_ID);
    } catch {
      // nichts zu tun
    }
  }

  private stopListening(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private detach(): void {
    this.stopListening();
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }

  /** Lokalen Stand löschen (nach Abschluss oder Abmelden). */
  async clear(): Promise<void> {
    const backend = this.backend;
    this.detach();
    this.value = null;
    this.lastSent = null;
    this.notify();
    await this.cancelReminder();
    const store = backend ? liveFor(backend)?.sessionStore : null;
    await store?.clear().catch(() => undefined);
  }

  private async persist(): Promise<void> {
    const store = this.backend ? liveFor(this.backend)?.sessionStore : null;
    const v = this.value;
    if (!store || !v) return;
    try {
      await store.write(
        JSON.stringify({
          v: 1,
          handle: v.handle,
          mode: v.mode,
          url: v.url,
          sport: v.sport,
          displayName: v.displayName,
          contactIds: v.contactIds,
          plannedMinutes: v.plannedMinutes,
          intervalS: v.intervalS,
          noSignOfLifeMin: v.noSignOfLifeMin,
          recordingId: v.recordingId,
          status: v.status,
          synced: v.synced,
          ackAt: v.ackAt,
        }),
      );
    } catch {
      // Speicher gerade nicht beschreibbar – nächster Versuch bei der nächsten Änderung.
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

export const liveCompanion = new LiveCompanionStore();

// Abmelden/Konto löschen/Gerätedaten löschen: laufende Begleitung beenden (data/live-companion.ts → attachLive).
onLiveCleared(async () => {
  await liveCompanion.setStatus('ended').catch(() => undefined);
  await liveCompanion.clear();
});

/**
 * Erlaubnis für die „Kein Lebenszeichen“-Erinnerung – NUR nach dem ausdrücklichen Tipp „Starten“ der Live-Begleitung
 * mit eingeschalteter Erinnerung (nie beim App-Start oder im Onboarding).
 */
export async function askReminderPermission(): Promise<void> {
  if (!notificationDriver.supported) return;
  try {
    if ((await notificationDriver.permission()) === 'undetermined') {
      await notificationDriver.requestPermission();
    }
  } catch {
    // Ohne Erlaubnis bleibt der Hinweis in der App.
  }
}

/** Link zur Begleit-Seite (Testmodus: Demo-Seite). */
export function liveUrlFor(webUrl: string, token: string): string {
  if (token === 'demo') return `${webUrl.replace(/\/+$/, '')}${LIVE_PAGE_PATH}#t=demo`;
  const url = liveLinkUrl(webUrl, token);
  if (!url) throw new LiveError('unknown');
  return url;
}

/** Begleitung starten (nur während einer laufenden Aufzeichnung dieses Kontos). */
export async function startLiveCompanion(input: {
  backend: Backend;
  sport: LiveSport;
  displayName: string;
  contactIds: readonly string[];
  plannedMinutes: number;
  intervalS: number;
  noSignOfLifeMin: number | null;
  replace: boolean;
}): Promise<LiveCompanionState> {
  const attachment = liveFor(input.backend);
  const recording = recordingSession.get();
  if (!attachment || !recording || recording.state.status === 'stopped') {
    throw new LiveError('closed');
  }
  const plannedMinutes = clampPlannedMinutes(input.plannedMinutes);
  const handle = await attachment.live.start({
    displayName: input.displayName.trim(),
    sport: input.sport,
    plannedMinutes,
    intervalS: input.intervalS,
    replace: input.replace,
  });
  const state: LiveCompanionState = {
    handle,
    mode: attachment.live.mode,
    url: liveUrlFor(attachment.webUrl, handle.token),
    sport: input.sport,
    displayName: input.displayName.trim(),
    contactIds: [...input.contactIds],
    plannedMinutes,
    intervalS: input.intervalS,
    noSignOfLifeMin: input.noSignOfLifeMin,
    recordingId: recording.state.id,
    status: 'active',
    synced: true,
    ackAt: null,
    offline: false,
  };
  liveCompanion.attach(input.backend, state);
  return state;
}

/**
 * Nach einem Neustart der App: gesicherte Begleitung übernehmen, wenn ihre Aufzeichnung noch läuft – sonst sofort
 * beenden (lieber „beendet“ als ein vergessener geteilter Standort).
 */
export async function restoreLiveCompanion(backend: Backend): Promise<void> {
  if (liveCompanion.get()) return;
  const store = liveFor(backend)?.sessionStore;
  if (!store) return;
  let parsed: z.infer<typeof persistedSchema> | null;
  try {
    const text = await store.read();
    const result = text ? persistedSchema.safeParse(JSON.parse(text)) : null;
    parsed = result?.success ? result.data : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    await store.clear().catch(() => undefined);
    return;
  }
  if (liveCompanion.get()) return;
  // attach() gleicht mit der Aufzeichnung ab: läuft sie nicht mehr, endet die Begleitung sofort; ein noch nicht
  // gesendeter Abschluss wird nachgereicht.
  liveCompanion.attach(backend, { ...parsed, offline: false });
}

/** Aktuelle Begleitung (für Bildschirme). */
export function useLiveCompanion(): LiveCompanionState | null {
  return useSyncExternalStore(
    liveCompanion.subscribe,
    () => liveCompanion.get(),
    () => liveCompanion.get(),
  );
}
