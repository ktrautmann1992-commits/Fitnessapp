import { LIVE_COMPANION } from '../constants';
import { haversineM } from '../routes/track';
import { isLiveOpenStatus, LIVE_STATUSES, type LiveStatus } from './schema';

/**
 * Live-Begleitung: Zeitgrenzen und Zustände (docs/PLAN-PHASE-10.md 21.4/21.5). Dieselben Regeln prüft die Datenbank
 * (Migration *_live_companion.sql, Abgleich in live-db-sync.test.ts) – die App nutzt sie für Anzeige und Drosselung.
 * Zeiten als Millisekunden (Date.now()) bzw. ISO-Text.
 */

const L = LIVE_COMPANION;
const H = 3_600_000;
const MIN = 60_000;

const ms = (value: string | number): number =>
  typeof value === 'number' ? value : Date.parse(value);

/** Spätestes Ende einer Sitzung: Start + 12 h (CLAUDE.md). */
export function liveSessionHardEnd(startedAt: string | number): number {
  return ms(startedAt) + L.sessionMaxH * H;
}

/**
 * Ablauf des Links (Spalte expires_at): offen = Start + 12 h; nach Ende/„Angekommen“ = Ende + 2 h, aber nie nach
 * Start + 12 h (das Frühere, Plan 21.4).
 */
export function liveSessionExpiry(input: {
  startedAt: string | number;
  endedAt: string | number | null;
}): number {
  const hard = liveSessionHardEnd(input.startedAt);
  if (input.endedAt === null) return hard;
  return Math.min(ms(input.endedAt) + L.linkGraceH * H, hard);
}

/** Geplantes Ende (für „bis ca. 19:45“): Start + geplante Minuten, auf 5–720 min begrenzt. */
export function livePlannedEnd(startedAt: string | number, plannedMinutes: number | null): number {
  const minutes = clampPlannedMinutes(plannedMinutes);
  return ms(startedAt) + minutes * MIN;
}

/** Geplante Dauer begrenzen (ganze Minuten, 5–720; ungültig/fehlend = 60). */
export function clampPlannedMinutes(value: number | null | undefined): number {
  const P = L.plannedMinutes;
  if (value === null || value === undefined || !Number.isFinite(value)) return P.default;
  return Math.min(P.max, Math.max(P.min, Math.round(value)));
}

/** Zustand aus Sicht der Begleit-Seite bzw. App: abgelaufen schlägt alles. */
export type LivePhase = LiveStatus | 'expired';

export function livePhase(input: {
  status: LiveStatus;
  startedAt: string | number;
  endedAt: string | number | null;
  now: number;
}): LivePhase {
  const expiry = liveSessionExpiry({
    startedAt: input.startedAt,
    endedAt: isLiveOpenStatus(input.status) ? null : (input.endedAt ?? input.now),
  });
  return input.now >= expiry ? 'expired' : input.status;
}

/** Erlaubte Wechsel (set_live_status): active ↔ paused, offen → arrived/ended. Abgeschlossen bleibt abgeschlossen. */
export function canChangeLiveStatus(from: LiveStatus, to: LiveStatus): boolean {
  return isLiveOpenStatus(from) && (LIVE_STATUSES as readonly string[]).includes(to);
}

export interface LivePushPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Soll eine neue Position gesendet werden? Nie öfter als das gewählte Intervall (15/30/60 s, mindestens die
 * Server-Bremse von 10 s); dann nur bei ≥ 20 m Bewegung oder als Herzschlag nach 60 s (Plan 21.2 Punkt 4).
 * `last` = zuletzt GESENDETE Position (null = noch keine → sofort senden).
 */
export function shouldPushPosition(input: {
  last: (LivePushPoint & { readonly sentAt: number }) | null;
  next: LivePushPoint;
  now: number;
  intervalS?: number;
}): boolean {
  if (!isValidLatLng(input.next)) return false;
  if (input.last === null) return true;
  const elapsedS = (input.now - input.last.sentAt) / 1000;
  const interval = Math.max(L.serverMinGapS, input.intervalS ?? L.pushIntervalS);
  if (elapsedS < interval) return false;
  if (elapsedS >= Math.max(interval, L.heartbeatS)) return true;
  return haversineM(input.last, input.next) >= L.minMoveM;
}

function isValidLatLng(p: LivePushPoint): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/** Position für den Server: 5 Nachkommastellen (≈ 1 m), Genauigkeit ganzzahlig 0–5000 m (sonst null). */
export function roundLivePosition(input: {
  lat: number;
  lng: number;
  accuracyM: number | null | undefined;
}): { lat: number; lon: number; accuracyM: number | null } | null {
  if (!isValidLatLng(input)) return null;
  const f = 10 ** L.coordDecimals;
  const acc = input.accuracyM;
  return {
    lat: Math.round(input.lat * f) / f,
    lon: Math.round(input.lng * f) / f,
    accuracyM:
      acc === null || acc === undefined || !Number.isFinite(acc) || acc < 0
        ? null
        : Math.min(L.accuracyMaxM, Math.round(acc)),
  };
}

export type LiveStaleness = 'fresh' | 'stale' | 'very_stale';

/** Wie alt ist die letzte Position? ab 3 min „alt“ (Warnung), ab 15 min „sehr alt“. Uhr des Servers verwenden. */
export function positionStaleness(recordedAt: string | number, now: number): LiveStaleness {
  const ageS = Math.max(0, (now - ms(recordedAt)) / 1000);
  if (ageS >= L.veryStaleS) return 'very_stale';
  if (ageS >= L.staleWarnS) return 'stale';
  return 'fresh';
}

/**
 * „Kein Lebenszeichen“-Erinnerung (NUR lokal an die Person selbst, F6): fällig, wenn die Aufzeichnung die geplante
 * Dauer um `graceMin` überschreitet. Nach „Mir geht's gut“ (`acknowledgedAt`) erst wieder nach weiteren `graceMin`.
 */
export function noSignOfLifeDue(input: {
  startedAt: string | number;
  plannedMinutes: number | null;
  graceMin: number | null;
  now: number;
  acknowledgedAt?: number | null;
}): boolean {
  if (input.graceMin === null || input.graceMin <= 0) return false;
  const due = noSignOfLifeAt(input);
  return due !== null && input.now >= due;
}

/** Zeitpunkt der nächsten „Kein Lebenszeichen“-Erinnerung (ms) bzw. null (aus). */
export function noSignOfLifeAt(input: {
  startedAt: string | number;
  plannedMinutes: number | null;
  graceMin: number | null;
  acknowledgedAt?: number | null;
}): number | null {
  if (input.graceMin === null || input.graceMin <= 0) return null;
  const first = livePlannedEnd(input.startedAt, input.plannedMinutes) + input.graceMin * MIN;
  const ack = input.acknowledgedAt ?? null;
  return ack === null ? first : Math.max(first, ack + input.graceMin * MIN);
}
