import {
  FREE_SESSION,
  SESSION_LOG_LIMITS,
  SESSION_RPE_LIMITS,
  SPORT_CATALOGUE,
} from '../constants';
import type { LogSource, PlannedSessionKind, SportId } from '../enums';
import { type CardioInputError, cardioLogFromInput } from '../log/cardio';
import { entryDateBlock, freeSessionPayloadIssue } from '../log/free-session';
import { codePointLength, type SessionLogPayload, sessionLogPayloadSchema } from '../log/schemas';
import { sportFromWearableTitle } from '../wearables/exercise-types';
import { isSportId, sportName } from './catalogue';

/**
 * Sportart-Einträge (Sportarten Stufe 2, docs/PLAN-SPORTARTEN.md): freie Einheit der Art „strength“ OHNE Übungen und
 * ohne Ausdauer, mit Sportart, Dauer, Anstrengung (session_rpe 0–10) und – nur bei GPS-Sportarten – Distanz. Name =
 * Name der Sportart (feste Liste). Gleiche Regeln in save_session_log (Migration 20261025130100) und im Testmodus.
 * Von der Uhr übernommene „Sonstige“ (import_wearable_batch) haben keine Spalte `sport` – ihre Sportart kommt aus dem
 * Titel (sportFromWearableTitle). Rein, ohne Speicher- oder Netzzugriff, nie loggen.
 */

/** Was die Sportart-Rechnungen von einem Tagebuch-Eintrag brauchen (session_logs). */
export interface SportLogLike {
  readonly kind: PlannedSessionKind;
  readonly name_de: string;
  readonly source?: LogSource;
  readonly is_free?: boolean;
  readonly sport?: SportId | null;
  readonly sport_duration_s?: number | null;
  readonly sport_distance_m?: number | null;
  readonly started_at?: string | null;
  readonly finished_at?: string | null;
}

/**
 * Sportart eines Eintrags: Spalte `sport`; sonst eine von der Uhr übernommene „Sonstige“ (Herkunft health_connect,
 * Art strength, nicht „Freie Kraft-Einheit“) → Sportart aus dem Titel; sonst null (Kraft/Ausdauer wie bisher).
 */
export function sportForLog(log: SportLogLike): SportId | null {
  if (log.sport != null && isSportId(log.sport)) return log.sport;
  if (
    log.source === 'health_connect' &&
    log.kind === 'strength' &&
    log.name_de !== FREE_SESSION.names.strength
  ) {
    return sportFromWearableTitle(log.name_de);
  }
  return null;
}

/** Dauer eines Sportart-Eintrags: erfasste Dauer, sonst Ende − Beginn (Uhr); null ohne beides. */
export function sportLogDurationS(
  log: Pick<SportLogLike, 'sport_duration_s' | 'started_at' | 'finished_at'>,
): number | null {
  if (log.sport_duration_s != null && log.sport_duration_s > 0) return log.sport_duration_s;
  if (log.started_at && log.finished_at) {
    const ms = Date.parse(log.finished_at) - Date.parse(log.started_at);
    if (Number.isFinite(ms) && ms > 0) return Math.round(ms / 1000);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Eingabe → Eintrag
// ---------------------------------------------------------------------------------------------------------

/** Eingabe „Sportart eintragen“. Zahlen schon gelesen (Komma → Punkt macht die App); null = leer, NaN = unlesbar. */
export interface SportEntryInput {
  readonly id: string;
  readonly writeId: string;
  /** Revision der zuletzt bestätigten Fassung (Ändern); fehlt = neu. */
  readonly baseRevision?: number | null;
  readonly sport: SportId;
  readonly performedOn: string;
  /** Heute (Europe/Berlin). */
  readonly today: string;
  readonly hours: number | null;
  readonly minutes: number | null;
  /** Nur GPS-Sportarten; sonst muss es null sein. */
  readonly distanceKm: number | null;
  /** Anstrengung 0–10 bzw. null. */
  readonly effort: number | null;
  readonly notes: string;
  /** Jetzt (ISO-Zeitstempel mit Zeitzone). */
  readonly now: string;
  /** GPS-Aufzeichnung: Beginn und Ende (sonst null – beim Nachtragen gibt es keine sinnvolle Uhrzeit). */
  readonly startedAt?: string | null;
  readonly finishedAt?: string | null;
}

export type SportEntryError =
  | 'date_future'
  | 'date_too_old'
  | 'duration_missing'
  | 'duration_invalid'
  | 'duration_range'
  | 'distance_invalid'
  | 'distance_range'
  | 'distance_not_allowed'
  | 'effort_invalid'
  | 'notes_too_long'
  | 'invalid';

export type SportEntryResult =
  | { readonly ok: true; readonly payload: SessionLogPayload }
  | { readonly ok: false; readonly errors: readonly SportEntryError[] };

const DURATION_ERRORS: readonly CardioInputError[] = [
  'duration_missing',
  'duration_invalid',
  'duration_range',
];

/**
 * Eingabe prüfen und in den Eintrag für save_session_log umwandeln: Datum heute bis SESSION_LOG_LIMITS.backdateDays
 * zurück, Dauer 1 min–12 h (SPORT_LOG_LIMITS = CARDIO_LOG_LIMITS), Distanz nur bei GPS-Sportarten, Anstrengung 0–10,
 * Notiz ≤ 280 Zeichen. Ergebnis ist immer Zod-gültig und erfüllt freeSessionPayloadIssue().
 */
export function sportSessionLogFromInput(input: SportEntryInput): SportEntryResult {
  const errors = new Set<SportEntryError>();
  if (!isSportId(input.sport)) return { ok: false, errors: ['invalid'] };
  const block = entryDateBlock(input.performedOn, input.today);
  if (block === 'future') errors.add('date_future');
  if (block === 'too_old') errors.add('date_too_old');
  if (codePointLength(input.notes.trim()) > SESSION_LOG_LIMITS.notesMaxChars) {
    errors.add('notes_too_long');
  }
  const gps = SPORT_CATALOGUE[input.sport].gps;
  if (!gps && input.distanceKm !== null) errors.add('distance_not_allowed');
  const effort = input.effort;
  if (
    effort !== null &&
    (!Number.isInteger(effort) ||
      effort < SESSION_RPE_LIMITS.min ||
      effort > SESSION_RPE_LIMITS.max)
  ) {
    errors.add('effort_invalid');
  }
  // Dauer und Distanz mit denselben Regeln wie ein Ausdauer-Eintrag (gleiche Grenzen).
  const parsed = cardioLogFromInput({
    modality: 'run',
    hours: input.hours,
    minutes: input.minutes,
    distanceKm: gps ? input.distanceKm : null,
    elevationM: null,
  });
  if (!parsed.ok) {
    const { duration, distance } = parsed.errors;
    if (duration && DURATION_ERRORS.includes(duration)) errors.add(duration as SportEntryError);
    if (distance === 'distance_invalid' || distance === 'distance_range') errors.add(distance);
  }
  if (errors.size > 0 || !parsed.ok) {
    return { ok: false, errors: errors.size > 0 ? [...errors] : ['invalid'] };
  }
  const notes = input.notes.trim();
  const payload: SessionLogPayload = {
    id: input.id,
    write_id: input.writeId,
    base_revision: input.baseRevision ?? null,
    planned_session_id: null,
    planned_date: input.performedOn,
    kind: 'strength',
    performed_on: input.performedOn,
    started_at: input.startedAt ?? null,
    finished_at: input.finishedAt ?? null,
    status: 'completed',
    session_rpe: effort,
    notes: notes === '' ? null : notes,
    name_de: sportName(input.sport),
    is_intro_week: false,
    is_deload: false,
    source: 'manual',
    client_updated_at: input.now,
    exercises: [],
    cardio: null,
    is_free: true,
    sport: {
      sport: input.sport,
      duration_s: parsed.cardio.duration_s,
      distance_m: gps ? parsed.cardio.distance_m : null,
    },
  };
  if (
    !sessionLogPayloadSchema.safeParse(payload).success ||
    freeSessionPayloadIssue(payload, input.today) !== null
  ) {
    return { ok: false, errors: ['invalid'] };
  }
  return { ok: true, payload };
}
