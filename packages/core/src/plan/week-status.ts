import { z } from 'zod';

import { LOG_ASSIGNMENT_LIMITS } from '../constants';
import { addDays, isoWeekday, startOfIsoWeek } from '../dates';
import type {
  EnduranceModality,
  LogSource,
  PlannedSessionKind,
  PlannedSessionStatus,
  SessionLogStatus,
  SportId,
} from '../enums';

/**
 * Wochen-Status für die Training-Übersicht (docs/PLAN-AUSWERTUNG.md „Training-Übersicht“, Gründer-Freigabe 23.10.2026):
 * „Heute“ (Wochen-Leiste), „Woche“ (eine Zeile je Tag) und das Tages-Blatt lesen denselben Stand. Rein, ohne Speicher.
 *
 * Grundregeln:
 * 1. Erledigt steht IMMER am tatsächlichen Tag (performed_on). Zählt ein Eintrag für eine geplante Einheit an einem
 *    anderen Tag derselben Woche, zeigt der geplante Tag „vorgezogen“ bzw. „nachgeholt“, der tatsächliche Tag „statt Sa“.
 * 2. Ein Eintrag zählt für eine geplante Einheit, wenn er mit ihr verknüpft ist (planned_session_id – „Training starten“,
 *    „Heute nachholen“, Nachtragen), wenn die Person es für eine freie bzw. Uhr-Einheit bestätigt hat (Zuordnung) oder
 *    – ohne Nachfrage – wenn eine freie bzw. Uhr-Einheit am SELBEN Tag wie eine offene geplante Einheit derselben
 *    Sportart liegt.
 * 3. Nie still über Tage hinweg: Liegt eine freie bzw. Uhr-Einheit an einem Tag ohne geplante Einheit dieser Sportart
 *    und ist an einem anderen Tag derselben Woche eine passende Einheit offen, entsteht eine einmalige Frage
 *    (`questions`). Die Antwort (Ja = Zuordnung, Nein = „zusätzliche Einheit“) speichert die App; änderbar im Tag.
 */

// ---------------------------------------------------------------------------------------------------------
// Eingaben
// ---------------------------------------------------------------------------------------------------------

/** Geplante Einheit (alle Pläne der Person; `plan_active` = gehört zum aktiven Plan). */
export interface WeekStatusSession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly original_date: string | null;
  readonly status: PlannedSessionStatus;
  readonly kind: PlannedSessionKind;
  /** Ausdauer: Art (Laufen, Rad …); null = unbekannt (passt zu jeder Ausdauer). */
  readonly endurance_modality?: EnduranceModality | null;
  readonly name_de: string;
  readonly plan_active: boolean;
  readonly estimated_minutes?: number | null;
  readonly is_deload?: boolean;
}

/** Tagebuch-Eintrag mit den Werten, die die Übersicht zeigt. */
export interface WeekStatusLog {
  readonly id: string;
  readonly planned_session_id: string | null;
  readonly performed_on: string;
  readonly kind: PlannedSessionKind;
  readonly status: SessionLogStatus;
  readonly name_de: string;
  /** Freie Einheit (A1b) bzw. von der Uhr übernommen – nur solche lassen sich zuordnen. */
  readonly is_free?: boolean;
  readonly source?: LogSource;
  /** Ausdauer-Art aus cardio_logs; null/fehlt = unbekannt. */
  readonly modality?: EnduranceModality | null;
  readonly duration_s?: number | null;
  readonly distance_m?: number | null;
  /** Abgehakte Kraft-Sätze. */
  readonly done_sets?: number;
  /** kcal der Einheit (laut Uhr oder geschätzt, sessionCalories) – null/fehlt = keine Zahl. */
  readonly kcal?: number | null;
  readonly started_at?: string | null;
  /** Erst später eingetragen (isBackfilledLog). */
  readonly backfilled?: boolean;
  /**
   * Sportart (Sportarten Stufe 2, sportForLog): zählt nie für eine geplante Einheit (keine Zuordnung, keine Frage) –
   * immer „zusätzliche Einheit“. Fehlt/null = Kraft/Ausdauer wie bisher.
   */
  readonly sport?: SportId | null;
}

const idSchema = z.string().min(1).max(LOG_ASSIGNMENT_LIMITS.idMaxLength);

/**
 * Antwort auf die Frage „Soll dieser Lauf dafür zählen?“ bzw. Änderung im Tag: `sessionId` = zählt für diese geplante
 * Einheit, null = „zusätzliche Einheit“ (nie wieder fragen, nie automatisch zuordnen). Nur im Gerätespeicher.
 */
export const logAssignmentSchema = z.strictObject({
  ownerUserId: idSchema,
  logId: idSchema,
  sessionId: idSchema.nullable(),
  decidedAt: z.iso.datetime({ offset: true }),
});
export type LogAssignment = z.infer<typeof logAssignmentSchema>;

// ---------------------------------------------------------------------------------------------------------
// Ergebnis
// ---------------------------------------------------------------------------------------------------------

/** Wie ein Eintrag zu seiner geplanten Einheit kam. */
export type FulfilMode = 'linked' | 'assigned' | 'same_day';
/** Tatsächlicher Tag gegenüber dem geplanten: gleich, früher („vorgezogen“), später („nachgeholt“). */
export type DayShift = 'same' | 'early' | 'late';

export interface WeekFulfilment {
  readonly sessionId: string;
  /** Tag, an dem die Einheit geplant war (scheduled_on). */
  readonly plannedOn: string;
  readonly name_de: string;
  readonly mode: FulfilMode;
  readonly shift: DayShift;
}

/** Andere geplante Einheit derselben Woche, für die ein freier Eintrag zählen könnte („Zuordnung ändern“). */
export interface WeekAlternative {
  readonly sessionId: string;
  readonly date: string;
  readonly name_de: string;
}

/** Erledigter Eintrag am tatsächlichen Tag. */
export interface WeekEntry {
  /** null = erledigte Einheit ohne Eintrag auf dem Gerät (z. B. älter als der geladene Zeitraum). */
  readonly logId: string | null;
  readonly name_de: string;
  readonly kind: PlannedSessionKind;
  readonly modality: EnduranceModality | null;
  readonly partial: boolean;
  readonly free: boolean;
  readonly fromWatch: boolean;
  readonly backfilled: boolean;
  readonly durationS: number | null;
  readonly distanceM: number | null;
  readonly doneSets: number;
  readonly kcal: number | null;
  readonly startedAt: string | null;
  /** Tatsächliches Datum. */
  readonly performedOn: string;
  /** Tag, an dem der Eintrag in DIESER Woche steht (nur an der Wochengrenze ≠ performedOn, Wächter A3 S1). */
  readonly shownOn: string;
  readonly fulfils: WeekFulfilment | null;
  /** Freier Eintrag: Zuordnung im Tag änderbar. */
  readonly changeable: boolean;
  /** Freier Eintrag: passende offene Einheiten dieser Woche (ohne die schon zugeordnete). */
  readonly alternatives: readonly WeekAlternative[];
  /** Sportart (Sportarten Stufe 2); fehlt/null = Kraft/Ausdauer. */
  readonly sport?: SportId | null;
}

/** Geplante Einheit, die noch offen ist. */
export interface WeekOpenSession {
  readonly sessionId: string;
  readonly name_de: string;
  readonly kind: PlannedSessionKind;
  readonly modality: EnduranceModality | null;
  readonly estimatedMinutes: number | null;
  readonly isDeload: boolean;
  /** Vorbei und nicht erledigt. */
  readonly missed: boolean;
  /** Im Kalender hierher verschoben: ursprünglicher Tag. */
  readonly movedFrom: string | null;
}

/** Hier geplante Einheit, die an einem anderen Tag erledigt wurde. */
export interface WeekDoneElsewhere {
  readonly sessionId: string;
  readonly name_de: string;
  readonly kind: PlannedSessionKind;
  readonly modality: EnduranceModality | null;
  readonly doneOn: string;
  readonly shift: Exclude<DayShift, 'same'>;
  readonly mode: FulfilMode;
}

export interface WeekSessionRef {
  readonly sessionId: string;
  readonly name_de: string;
}

export type WeekDayState = 'done' | 'planned' | 'missed' | 'moved' | 'skipped' | 'rest';

export interface WeekStatusDay {
  readonly date: string;
  /** 1 = Montag … 7 = Sonntag. */
  readonly weekday: number;
  readonly isToday: boolean;
  readonly isPast: boolean;
  /** Wichtigster Zustand: erledigt vor geplant vor verpasst vor „woanders erledigt“ vor gestrichen vor Ruhetag. */
  readonly state: WeekDayState;
  readonly entries: readonly WeekEntry[];
  readonly open: readonly WeekOpenSession[];
  readonly doneElsewhere: readonly WeekDoneElsewhere[];
  /** Im Kalender von hier weg verschoben (noch offen oder erledigt). */
  readonly movedAway: readonly (WeekSessionRef & { readonly to: string })[];
  readonly skipped: readonly WeekSessionRef[];
  /** Noch geplante Einheiten eines ersetzten Plans („entfällt – früherer Plan“). */
  readonly dropped: readonly WeekSessionRef[];
}

/** Einmalige Frage „Soll diese Einheit für ‚…‘ am Samstag zählen?“. */
export interface CrossDayQuestion {
  readonly logId: string;
  readonly logDate: string;
  readonly logName: string;
  readonly kind: PlannedSessionKind;
  readonly modality: EnduranceModality | null;
  readonly durationS: number | null;
  readonly distanceM: number | null;
  readonly startedAt: string | null;
  readonly fromWatch: boolean;
  readonly sessionId: string;
  readonly sessionDate: string;
  readonly sessionName: string;
  readonly shift: Exclude<DayShift, 'same'>;
}

export interface WeekStatusSummary {
  /** Erledigte geplante Einheiten des aktiven Plans. */
  readonly sessionsDone: number;
  /** Geplante Einheiten des aktiven Plans (ohne gestrichene). */
  readonly sessionsPlanned: number;
  /** Erledigte Einträge, die für keine geplante Einheit zählen. */
  readonly extraUnits: number;
  /** Kilometer, auf 0,1 gerundet. */
  readonly distanceKm: number;
  readonly enduranceMinutes: number;
  readonly strengthSets: number;
  /** Summe der bekannten kcal; null, wenn kein Eintrag eine Zahl hat. */
  readonly kcal: number | null;
}

export interface WeekStatus {
  readonly weekStart: string;
  readonly days: readonly WeekStatusDay[];
  readonly summary: WeekStatusSummary;
  readonly questions: readonly CrossDayQuestion[];
}

// ---------------------------------------------------------------------------------------------------------
// Sportart
// ---------------------------------------------------------------------------------------------------------

/** Passen Eintrag und Einheit zusammen? Kraft zu Kraft; Ausdauer gleicher Art (unbekannte Art passt zu jeder). */
export function sameSportFamily(
  a: { readonly kind: PlannedSessionKind; readonly modality: EnduranceModality | null },
  b: { readonly kind: PlannedSessionKind; readonly modality: EnduranceModality | null },
): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'strength') return true;
  return a.modality === null || b.modality === null || a.modality === b.modality;
}

const sessionSport = (s: WeekStatusSession) => ({
  kind: s.kind,
  modality: s.kind === 'endurance' ? (s.endurance_modality ?? null) : null,
});
const logSport = (l: WeekStatusLog) => ({
  kind: l.kind,
  modality: l.kind === 'endurance' ? (l.modality ?? null) : null,
});

function shiftOf(actual: string, planned: string): DayShift {
  return actual === planned ? 'same' : actual < planned ? 'early' : 'late';
}

const dayDistance = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;

const byDateThenId = (
  a: { performed_on: string; id: string },
  b: { performed_on: string; id: string },
) =>
  a.performed_on !== b.performed_on
    ? a.performed_on < b.performed_on
      ? -1
      : 1
    : a.id < b.id
      ? -1
      : a.id > b.id
        ? 1
        : 0;

// ---------------------------------------------------------------------------------------------------------
// Wochen-Status
// ---------------------------------------------------------------------------------------------------------

export function weekStatus(input: {
  readonly sessions: readonly WeekStatusSession[];
  readonly logs: readonly WeekStatusLog[];
  /** Antworten der Person (letzte je Eintrag gilt). */
  readonly assignments?: readonly Pick<LogAssignment, 'logId' | 'sessionId'>[];
  /** Ein Tag der gewünschten Woche. */
  readonly weekOf: string;
  readonly today: string;
}): WeekStatus {
  const { sessions, logs, today } = input;
  const weekStart = startOfIsoWeek(input.weekOf);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
  const decisions = new Map<string, string | null>();
  for (const a of input.assignments ?? []) decisions.set(a.logId, a.sessionId);

  const isFree = (l: WeekStatusLog) => l.is_free === true && l.planned_session_id === null;
  // Sportarten (Stufe 2) haben keine geplanten Einheiten – nie zuordnen, nie fragen.
  const isAssignable = (l: WeekStatusLog) => isFree(l) && (l.sport ?? null) === null;
  // Ein Eintrag gehört zur Woche des Termins seiner Einheit, sonst zur Woche seines Datums (wie weekLogSummary).
  const weekLogs = logs
    .filter((l) => {
      const session = l.planned_session_id ? sessionById.get(l.planned_session_id) : undefined;
      return inWeek(session ? (session.original_date ?? session.scheduled_on) : l.performed_on);
    })
    .sort(byDateThenId);

  const fulfilled = new Map<string, { logId: string; mode: FulfilMode }>();
  const logFulfils = new Map<string, string>();
  const assign = (log: WeekStatusLog, session: WeekStatusSession, mode: FulfilMode) => {
    fulfilled.set(session.id, { logId: log.id, mode });
    logFulfils.set(log.id, session.id);
  };
  const isOpenCandidate = (s: WeekStatusSession) =>
    s.plan_active && s.status === 'planned' && inWeek(s.scheduled_on) && !fulfilled.has(s.id);

  // 1. Verknüpfte Einträge (planned_session_id).
  for (const log of weekLogs) {
    if (log.planned_session_id === null) continue;
    const session = sessionById.get(log.planned_session_id);
    if (session && !fulfilled.has(session.id)) assign(log, session, 'linked');
  }
  // 2. Bestätigte Zuordnungen freier Einträge (nur gleiche Woche, gleiche Sportart, noch offen).
  for (const log of weekLogs) {
    if (!isAssignable(log) || !inWeek(log.performed_on)) continue;
    const target = decisions.get(log.id);
    if (target === undefined || target === null) continue;
    const session = sessionById.get(target);
    if (
      session &&
      isOpenCandidate(session) &&
      sameSportFamily(logSport(log), sessionSport(session))
    ) {
      assign(log, session, 'assigned');
    }
  }
  // 3. Gleicher Tag, gleiche Sportart, ohne Antwort → zählt ohne Nachfrage.
  for (const log of weekLogs) {
    if (!isAssignable(log) || logFulfils.has(log.id) || decisions.has(log.id)) continue;
    const session = sessions
      .filter(
        (s) =>
          s.scheduled_on === log.performed_on &&
          isOpenCandidate(s) &&
          sameSportFamily(logSport(log), sessionSport(s)),
      )
      .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
    if (session) assign(log, session, 'same_day');
  }
  // 4. Andere Tage: nie still – einmal fragen.
  const questions: CrossDayQuestion[] = [];
  const asked = new Set<string>();
  for (const log of weekLogs) {
    if (!isAssignable(log) || logFulfils.has(log.id) || decisions.has(log.id)) continue;
    if (!inWeek(log.performed_on)) continue;
    const sport = logSport(log);
    // Am Tag selbst ist eine Einheit dieser Sportart geplant (erledigt oder schon zugeordnet) → keine Frage.
    const dayHasKind = sessions.some(
      (s) =>
        s.scheduled_on === log.performed_on &&
        s.status !== 'skipped' &&
        s.plan_active &&
        sameSportFamily(sport, sessionSport(s)),
    );
    if (dayHasKind) continue;
    const candidate = sessions
      .filter(
        (s) =>
          s.scheduled_on !== log.performed_on &&
          isOpenCandidate(s) &&
          !asked.has(s.id) &&
          sameSportFamily(sport, sessionSport(s)),
      )
      .sort((a, b) => {
        const d = dayDistance(a.scheduled_on, log.performed_on);
        const e = dayDistance(b.scheduled_on, log.performed_on);
        if (d !== e) return d - e;
        return a.scheduled_on !== b.scheduled_on
          ? a.scheduled_on < b.scheduled_on
            ? -1
            : 1
          : a.id < b.id
            ? -1
            : 1;
      })[0];
    if (!candidate) continue;
    asked.add(candidate.id);
    questions.push({
      logId: log.id,
      logDate: log.performed_on,
      logName: log.name_de,
      kind: log.kind,
      modality: sport.modality,
      durationS: log.duration_s ?? null,
      distanceM: log.distance_m ?? null,
      startedAt: log.started_at ?? null,
      fromWatch: log.source === 'health_connect',
      sessionId: candidate.id,
      sessionDate: candidate.scheduled_on,
      sessionName: candidate.name_de,
      shift: candidate.scheduled_on < log.performed_on ? 'late' : 'early',
    });
  }

  // Einträge je Tag.
  const entriesByDay = new Map<string, WeekEntry[]>();
  const pushEntry = (entry: WeekEntry) =>
    entriesByDay.set(entry.shownOn, [...(entriesByDay.get(entry.shownOn) ?? []), entry]);
  const alternativesFor = (log: WeekStatusLog, current: string | null): WeekAlternative[] =>
    sessions
      .filter(
        (s) =>
          s.id !== current &&
          s.plan_active &&
          s.status === 'planned' &&
          inWeek(s.scheduled_on) &&
          !fulfilled.has(s.id) &&
          sameSportFamily(logSport(log), sessionSport(s)),
      )
      .sort((a, b) =>
        a.scheduled_on < b.scheduled_on ? -1 : a.scheduled_on > b.scheduled_on ? 1 : 0,
      )
      .map((s) => ({ sessionId: s.id, date: s.scheduled_on, name_de: s.name_de }));

  for (const log of weekLogs) {
    const session = log.planned_session_id ? sessionById.get(log.planned_session_id) : undefined;
    const reference = session ? (session.original_date ?? session.scheduled_on) : null;
    const shownOn = inWeek(log.performed_on)
      ? log.performed_on
      : session && inWeek(session.scheduled_on)
        ? session.scheduled_on
        : (reference ?? log.performed_on);
    const fulfilsId = logFulfils.get(log.id) ?? null;
    const target = fulfilsId ? sessionById.get(fulfilsId) : undefined;
    const mode = fulfilsId ? fulfilled.get(fulfilsId)?.mode : undefined;
    const free = isFree(log);
    pushEntry({
      logId: log.id,
      name_de: log.name_de,
      kind: log.kind,
      modality: logSport(log).modality,
      partial: log.status === 'partial',
      free,
      fromWatch: log.source === 'health_connect',
      backfilled: log.backfilled === true,
      durationS: log.duration_s ?? null,
      distanceM: log.distance_m ?? null,
      doneSets: log.done_sets ?? 0,
      kcal: log.kcal ?? null,
      startedAt: log.started_at ?? null,
      performedOn: log.performed_on,
      shownOn,
      fulfils:
        target && mode
          ? {
              sessionId: target.id,
              plannedOn: target.scheduled_on,
              name_de: target.name_de,
              mode,
              // An der Wochengrenze steht der Eintrag am Termin – dort gilt er als „gleicher Tag“.
              shift: shiftOf(shownOn, target.scheduled_on),
            }
          : null,
      changeable: isAssignable(log) && inWeek(log.performed_on),
      alternatives:
        isAssignable(log) && inWeek(log.performed_on) ? alternativesFor(log, fulfilsId) : [],
      sport: log.sport ?? null,
    });
  }
  // Erledigte Einheiten ohne Eintrag auf dem Gerät (älterer Zeitraum, alter Plan) – am Termin.
  const loggedIds = new Set(logs.map((l) => l.planned_session_id).filter((id) => id !== null));
  for (const s of sessions) {
    if (s.status !== 'completed' || !inWeek(s.scheduled_on) || loggedIds.has(s.id)) continue;
    fulfilled.set(s.id, { logId: '', mode: 'linked' });
    pushEntry({
      logId: null,
      name_de: s.name_de,
      kind: s.kind,
      modality: sessionSport(s).modality,
      partial: false,
      free: false,
      fromWatch: false,
      backfilled: false,
      durationS: null,
      distanceM: null,
      doneSets: 0,
      kcal: null,
      startedAt: null,
      performedOn: s.scheduled_on,
      shownOn: s.scheduled_on,
      fulfils: {
        sessionId: s.id,
        plannedOn: s.scheduled_on,
        name_de: s.name_de,
        mode: 'linked',
        shift: 'same',
      },
      changeable: false,
      alternatives: [],
    });
  }

  const allEntries = [...entriesByDay.values()].flat();
  const entryOfSession = new Map(
    allEntries.flatMap((e) => (e.fulfils ? [[e.fulfils.sessionId, e] as const] : [])),
  );

  const days: WeekStatusDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(weekStart, index);
    const here = sessions.filter((s) => s.scheduled_on === date);
    const open: WeekOpenSession[] = here
      .filter((s) => s.plan_active && s.status === 'planned' && !fulfilled.has(s.id))
      .map((s) => ({
        sessionId: s.id,
        name_de: s.name_de,
        kind: s.kind,
        modality: sessionSport(s).modality,
        estimatedMinutes: s.estimated_minutes ?? null,
        isDeload: s.is_deload === true,
        missed: date < today,
        movedFrom: s.original_date !== null && s.original_date !== date ? s.original_date : null,
      }));
    const doneElsewhere: WeekDoneElsewhere[] = here.flatMap((s) => {
      const entry = entryOfSession.get(s.id);
      if (!entry || entry.shownOn === date || !entry.fulfils) return [];
      const shift = entry.fulfils.shift;
      if (shift === 'same') return [];
      return [
        {
          sessionId: s.id,
          name_de: s.name_de,
          kind: s.kind,
          modality: sessionSport(s).modality,
          doneOn: entry.shownOn,
          shift,
          mode: entry.fulfils.mode,
        },
      ];
    });
    const entries = entriesByDay.get(date) ?? [];
    const state: WeekDayState =
      entries.length > 0
        ? 'done'
        : open.some((o) => !o.missed)
          ? 'planned'
          : open.length > 0
            ? 'missed'
            : doneElsewhere.length > 0
              ? 'moved'
              : here.some((s) => s.status === 'skipped')
                ? 'skipped'
                : 'rest';
    days.push({
      date,
      weekday: isoWeekday(date),
      isToday: date === today,
      isPast: date < today,
      state,
      entries,
      open,
      doneElsewhere,
      movedAway: sessions
        .filter(
          (s) =>
            s.original_date === date &&
            s.scheduled_on !== date &&
            s.status !== 'skipped' &&
            s.plan_active,
        )
        .map((s) => ({ sessionId: s.id, name_de: s.name_de, to: s.scheduled_on })),
      skipped: here
        .filter((s) => s.status === 'skipped' && !fulfilled.has(s.id))
        .map((s) => ({ sessionId: s.id, name_de: s.name_de })),
      dropped: here
        .filter((s) => !s.plan_active && s.status === 'planned')
        .map((s) => ({ sessionId: s.id, name_de: s.name_de })),
    });
  }

  const counted = sessions.filter(
    (s) =>
      s.plan_active && inWeek(s.scheduled_on) && (s.status !== 'skipped' || fulfilled.has(s.id)),
  );
  const countedIds = new Set(counted.map((s) => s.id));
  const sessionsDone = counted.filter((s) => fulfilled.has(s.id)).length;
  const extraUnits = allEntries.filter(
    (e) => !e.fulfils || !countedIds.has(e.fulfils.sessionId),
  ).length;
  const distanceM = allEntries.reduce((sum, e) => sum + (e.distanceM ?? 0), 0);
  const kcalKnown = allEntries.filter((e) => e.kcal !== null && e.kcal > 0);
  return {
    weekStart,
    days,
    summary: {
      sessionsDone,
      sessionsPlanned: counted.length,
      extraUnits,
      distanceKm: Math.round(distanceM / 100) / 10,
      enduranceMinutes: allEntries
        .filter((e) => e.kind === 'endurance')
        .reduce((sum, e) => sum + Math.floor((e.durationS ?? 0) / 60), 0),
      strengthSets: allEntries.reduce((sum, e) => sum + e.doneSets, 0),
      kcal: kcalKnown.length > 0 ? kcalKnown.reduce((sum, e) => sum + (e.kcal ?? 0), 0) : null,
    },
    questions,
  };
}

/** Geplante Einheiten, die an diesem Tag als erledigt bzw. woanders erledigt gelten (für Start-Knöpfe). */
export function fulfilledSessionIds(status: WeekStatus): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const day of status.days) {
    for (const entry of day.entries) if (entry.fulfils) ids.add(entry.fulfils.sessionId);
  }
  return ids;
}

// ---------------------------------------------------------------------------------------------------------
// Gespeicherte Antworten (Gerätespeicher)
// ---------------------------------------------------------------------------------------------------------

/** Gespeicherte Antworten lesen: Zod je Eintrag, nur das eigene Konto; kaputter Speicher → leer. */
export function parseStoredLogAssignments(
  raw: string | null,
  ownerUserId: string,
): LogAssignment[] {
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const parsed = logAssignmentSchema.safeParse(item);
    return parsed.success && parsed.data.ownerUserId === ownerUserId ? [parsed.data] : [];
  });
}

/** Antwort setzen bzw. ersetzen (je Konto und Eintrag eine); über dem Deckel fallen die ältesten weg. */
export function upsertLogAssignment(
  list: readonly LogAssignment[],
  assignment: LogAssignment,
): LogAssignment[] {
  const parsed = logAssignmentSchema.parse(assignment);
  const next = [
    ...list.filter((a) => !(a.ownerUserId === parsed.ownerUserId && a.logId === parsed.logId)),
    parsed,
  ];
  if (next.length <= LOG_ASSIGNMENT_LIMITS.maxEntries) return next;
  const sorted = [...next].sort((a, b) => (a.decidedAt < b.decidedAt ? -1 : 1));
  const drop = new Set(sorted.slice(0, next.length - LOG_ASSIGNMENT_LIMITS.maxEntries));
  return next.filter((a) => !drop.has(a));
}
