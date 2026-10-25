import {
  addDays,
  type LegLoadHint,
  legLoadHints,
  recentSports,
  type SessionLogPayload,
  sessionLogDurationS,
  sportForLog,
  type SportId,
  sportLogDurationS,
  sportName,
  sportSessionLogFromInput,
  type SportEntryResult,
  type SportWeekLog,
  type SportWeekSummary,
  sportWeekSummary,
  startOfIsoWeek,
} from '@fitnessapp/core';

import { parseDecimal } from '../lib/format';
import type { UserRows } from './types';
import { DRAFT_FORMAT, freeDraftKey, type WorkoutDraft } from './workout-draft';

/**
 * Sportarten Stufe 2 (docs/PLAN-SPORTARTEN.md) in der App: Entwurf eines Sportart-Eintrags (gesendet über den
 * normalen Weg submitWorkout → Tagebuch-Warteschlange, offline), Zeilen → Wochen-Summen, zuletzt genutzte Sportarten
 * und Plan-Hinweis. Nur Abbildung – Regeln und Rechnungen in packages/core/src/sports.
 */

/** Sportart-Teil eines Entwurfs, wie getippt (Text, damit halbe Eingaben beim Sichern nicht verloren gehen). */
export interface DraftSport {
  sport: SportId;
  hours: string;
  minutes: string;
  /** Distanz in km mit Komma (nur GPS-Sportarten). */
  distanceKm: string;
}

export interface CreateSportDraftInput {
  ownerUserId: string;
  sport: DraftSport;
  performedOn: string;
  today: string;
  /** Anstrengung 0–10 bzw. null. */
  effort: number | null;
  notes: string;
  now: string;
  newId: () => string;
  /** GPS-Aufzeichnung: Beginn/Ende. */
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** Neuer Entwurf eines Sportart-Eintrags: freie Einheit „strength“ ohne Übungen, Name = Sportart. */
export function createSportDraft(
  input: CreateSportDraftInput,
): WorkoutDraft & { sport: DraftSport } {
  const logId = input.newId();
  return {
    format: DRAFT_FORMAT,
    ownerUserId: input.ownerUserId,
    key: freeDraftKey(logId),
    state: 'open',
    rejectReason: null,
    fromHealthPlan: false,
    editing: false,
    logId,
    baseRevision: null,
    serverRevision: null,
    plannedSessionId: null,
    plannedDate: input.performedOn,
    kind: 'strength',
    nameDe: sportName(input.sport.sport),
    isIntroWeek: false,
    isDeload: false,
    performedOn: input.performedOn,
    startedAt: input.startedAt ?? null,
    sessionRpe: input.effort,
    notes: input.notes,
    exercises: [],
    cardio: null,
    isFree: true,
    backfill: input.performedOn !== input.today,
    ...(input.finishedAt ? { finishedAt: input.finishedAt } : {}),
    sport: input.sport,
    updatedAt: input.now,
  };
}

/** Entwurf → geprüfter Eintrag (sportSessionLogFromInput). */
export function sportDraftResult(
  draft: WorkoutDraft & { sport: DraftSport },
  options: { writeId: string; now: string; today: string },
): SportEntryResult {
  return sportSessionLogFromInput({
    id: draft.logId,
    writeId: options.writeId,
    baseRevision: draft.baseRevision,
    sport: draft.sport.sport,
    performedOn: draft.performedOn,
    today: options.today,
    hours: parseDecimal(draft.sport.hours),
    minutes: parseDecimal(draft.sport.minutes),
    distanceKm: parseDecimal(draft.sport.distanceKm),
    effort: draft.sessionRpe,
    notes: draft.notes,
    now: options.now,
    startedAt: draft.startedAt,
    finishedAt: draft.finishedAt ?? null,
  });
}

/**
 * Für draftToPayload: gültiger Eintrag oder einer, den das Schema ablehnt (isValidPayload) – so wird nie eine
 * ungeprüfte Fassung gesendet.
 */
export function sportDraftPayload(
  draft: WorkoutDraft & { sport: DraftSport },
  options: { writeId: string; now: string; today?: string },
): SessionLogPayload {
  const result = sportDraftResult(draft, { ...options, today: options.today ?? draft.performedOn });
  if (result.ok) return result.payload;
  return {
    id: draft.logId,
    write_id: options.writeId,
    base_revision: draft.baseRevision,
    planned_session_id: null,
    planned_date: draft.performedOn,
    kind: 'strength',
    performed_on: draft.performedOn,
    started_at: null,
    finished_at: null,
    status: 'completed',
    session_rpe: null,
    notes: null,
    name_de: '',
    is_intro_week: false,
    is_deload: false,
    source: 'manual',
    client_updated_at: options.now,
    exercises: [],
    cardio: null,
    is_free: true,
    sport: null,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Zeilen → Woche, zuletzt genutzt, Plan-Hinweis
// ---------------------------------------------------------------------------------------------------------

type LogRowsInput = Pick<UserRows, 'sessionLogs' | 'cardioLogs' | 'plannedSessions'>;

/** Einträge der Woche als Eingabe für sportWeekSummary (Dauer, Distanz, Anstrengung, kcal je Eintrag). */
export function sportWeekLogsFromRows(
  rows: LogRowsInput,
  kcalOf: (logId: string) => number | null,
): SportWeekLog[] {
  const cardioByLog = new Map(rows.cardioLogs.map((c) => [c.session_log_id, c] as const));
  const plannedById = new Map(rows.plannedSessions.map((p) => [p.id, p] as const));
  return rows.sessionLogs.map((log) => {
    const cardio = cardioByLog.get(log.id) ?? null;
    const sport = cardio ? null : sportForLog(log);
    const planned = log.planned_session_id
      ? (plannedById.get(log.planned_session_id) ?? null)
      : null;
    const durationS = sport
      ? sportLogDurationS(log)
      : sessionLogDurationS({ log, cardio, planned });
    return {
      id: log.id,
      performed_on: log.performed_on,
      sport,
      durationS,
      distanceM: sport ? (log.sport_distance_m ?? null) : (cardio?.distance_m ?? null),
      effort: log.session_rpe,
      kcal: kcalOf(log.id),
    };
  });
}

/** Wochen-Summen je Sportart (ein Tag der Woche). */
export function sportWeekFromRows(
  rows: LogRowsInput,
  weekOf: string,
  kcalOf: (logId: string) => number | null,
): SportWeekSummary {
  const weekStart = startOfIsoWeek(weekOf);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = {
    ...rows,
    sessionLogs: rows.sessionLogs.filter(
      (l) => l.performed_on >= weekStart && l.performed_on <= weekEnd,
    ),
  };
  return sportWeekSummary({ logs: sportWeekLogsFromRows(inWeek, kcalOf), weekOf });
}

/** Zuletzt genutzte Sportarten (Tagebuch auf dem Gerät). */
export function recentSportsFromRows(
  rows: Pick<UserRows, 'sessionLogs'>,
  options: { onlyGps?: boolean; limit?: number } = {},
): SportId[] {
  return recentSports(
    rows.sessionLogs.map((l) => ({
      sport: sportForLog(l),
      performed_on: l.performed_on,
      created_at: l.created_at,
    })),
    options,
  );
}

/** Plan-Hinweise nach Sport mit hoher Beinbelastung (nur aktiver Plan, ab heute). */
export function legLoadHintsFromRows(
  rows: Pick<UserRows, 'sessionLogs' | 'plannedSessions' | 'plans'>,
  today: string,
): LegLoadHint[] {
  const activePlanIds = new Set(rows.plans.filter((p) => p.status === 'active').map((p) => p.id));
  const since = addDays(today, -1);
  return legLoadHints({
    today,
    logs: rows.sessionLogs
      .filter((l) => l.performed_on >= since)
      .map((l) => ({
        id: l.id,
        performed_on: l.performed_on,
        sport: sportForLog(l),
        durationS: sportLogDurationS(l),
        effort: l.session_rpe,
      })),
    sessions: rows.plannedSessions.map((s) => ({
      ...s,
      plan_active: activePlanIds.has(s.plan_id),
    })),
  });
}
