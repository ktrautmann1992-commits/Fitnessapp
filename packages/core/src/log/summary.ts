import { SESSION_LOG_LIMITS } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import type {
  PlannedSessionKind,
  PlannedSessionStatus,
  SessionFocus,
  SessionLogStatus,
} from '../enums';
import { type ReschedulableSession, rescheduleSession } from '../plan/reschedule';
import type { LoggedSet } from './types';

/**
 * Woche, Verlauf und Nachholen (docs/PLAN-PHASE-4.md Abschnitt 5.6). Reine Datumsrechnung mit ISO-Datumstexten
 * (keine Uhrzeiten) – Sommerzeit spielt keine Rolle.
 */

// ---------------------------------------------------------------------------------------------------------
// Datumsfenster (W2) – gleiche Regel wie save_session_log und local-rules.ts
// ---------------------------------------------------------------------------------------------------------

/**
 * Darf ein Eintrag mit `performedOn` zu einer Einheit mit Termin `referenceDate` (= coalesce(original_date,
 * scheduled_on)) gespeichert werden? Gleiche ISO-Woche wie der Termin (± 1 Tag Zeitzonen-Toleranz), höchstens
 * 1 Tag in der Zukunft, höchstens 14 Tage zurück.
 */
export function isWithinLogDateWindow(
  performedOn: string,
  referenceDate: string,
  today: string,
): boolean {
  const { weekToleranceDays, futureDays, backdateDays } = SESSION_LOG_LIMITS;
  const weekStart = startOfIsoWeek(referenceDate);
  return (
    performedOn >= addDays(weekStart, -weekToleranceDays) &&
    performedOn <= addDays(weekStart, 6 + weekToleranceDays) &&
    performedOn <= addDays(today, futureDays) &&
    performedOn >= addDays(today, -backdateDays)
  );
}

/**
 * „Heute nachholen“ möglich? Nach den Regeln von rescheduleSession() (noch `planned`, keine Erholungseinheit,
 * gleiche ISO-Woche, Tag frei, 48 h zwischen Krafteinheiten mit gleichen Muskeln) – der früheste erlaubte Tag ab
 * heute muss HEUTE sein – und im Datumsfenster von save_session_log.
 */
export function canCatchUp(
  sessions: readonly ReschedulableSession[],
  sessionId: string,
  today: string,
): boolean {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session || session.scheduled_on === today) return false;
  const result = rescheduleSession(sessions, sessionId, today);
  if (result.kind !== 'moved' || result.date !== today) return false;
  return isWithinLogDateWindow(today, session.original_date ?? session.scheduled_on, today);
}

// ---------------------------------------------------------------------------------------------------------
// Woche
// ---------------------------------------------------------------------------------------------------------

/** Eine geplante Einheit für die Wochenansicht. */
export interface SummarySession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly original_date: string | null;
  readonly status: PlannedSessionStatus | 'completed';
  readonly kind: PlannedSessionKind;
  readonly focus?: SessionFocus | null;
  readonly name_de: string;
  /** Gehört zum aktiven Plan? Altlasten ersetzter Pläne → „entfallen“ (H1). */
  readonly plan_active: boolean;
}

/** Ein Tagebuch-Eintrag (session_logs) mit den Summen, die Woche und Verlauf brauchen. */
export interface SummaryLog {
  readonly id: string;
  readonly planned_session_id: string | null;
  readonly performed_on: string;
  readonly kind: PlannedSessionKind;
  readonly status: SessionLogStatus;
  readonly name_de: string;
  /** Abgehakte Kraft-Sätze. */
  readonly done_sets: number;
  readonly cardio_duration_s: number | null;
  readonly cardio_distance_m: number | null;
}

export type DayStatus = 'done' | 'partial' | 'missed' | 'skipped' | 'planned' | 'dropped' | 'rest';

export interface DayItem {
  readonly status: Exclude<DayStatus, 'rest'>;
  readonly sessionId: string | null;
  readonly logId: string | null;
  readonly name_de: string;
  /** Nachgeholt: ursprünglicher Termin (H2 – der Eintrag steht am tatsächlichen Datum). */
  readonly caughtUpFrom: string | null;
}

export interface SummaryDay {
  readonly date: string;
  /** Wichtigster Status des Tages (Einträge vor offenen Einheiten), ohne alles: „rest“. */
  readonly status: DayStatus;
  readonly items: readonly DayItem[];
}

export interface WeekSummary {
  readonly weekStart: string;
  readonly days: readonly SummaryDay[];
  readonly sessionsDone: number;
  readonly sessionsPlanned: number;
  readonly strengthSets: number;
  readonly enduranceMinutes: number;
  /** Kilometer, auf 0,1 gerundet. */
  readonly enduranceKm: number;
}

const STATUS_ORDER: readonly Exclude<DayStatus, 'rest'>[] = [
  'done',
  'partial',
  'missed',
  'planned',
  'skipped',
  'dropped',
];

/**
 * Wochenübersicht Mo–So: je Tag Einträge (am tatsächlichen Datum) und Einheiten ohne Eintrag (verpasst = vorbei,
 * ohne Eintrag; gestrichen; geplant; „entfallen“ = noch geplante Einheit eines ersetzten Plans). Summen: Einträge,
 * geplante Einheiten des aktiven Plans, Kraft-Sätze, Ausdauer-Minuten und -Kilometer.
 */
export function weekLogSummary(
  sessions: readonly SummarySession[],
  logs: readonly SummaryLog[],
  weekStartInput: string,
  today: string,
): WeekSummary {
  const weekStart = startOfIsoWeek(weekStartInput);
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const sessionById = new Map(sessions.map((s) => [s.id, s] as const));
  const weekLogs = logs.filter((l) => inWeek(l.performed_on));
  const loggedSessionIds = new Set(
    logs.map((l) => l.planned_session_id).filter((id): id is string => id !== null),
  );
  const items = new Map<string, DayItem[]>();
  const push = (date: string, item: DayItem) => items.set(date, [...(items.get(date) ?? []), item]);

  for (const log of weekLogs) {
    const session = log.planned_session_id ? sessionById.get(log.planned_session_id) : undefined;
    const reference = session ? (session.original_date ?? session.scheduled_on) : null;
    push(log.performed_on, {
      status: log.status === 'completed' ? 'done' : 'partial',
      sessionId: log.planned_session_id,
      logId: log.id,
      name_de: log.name_de,
      caughtUpFrom: reference !== null && reference !== log.performed_on ? reference : null,
    });
  }
  for (const session of sessions) {
    if (!inWeek(session.scheduled_on) || loggedSessionIds.has(session.id)) continue;
    let status: DayItem['status'];
    if (session.status === 'completed') status = 'done';
    else if (session.status === 'skipped') status = 'skipped';
    else if (!session.plan_active) status = 'dropped';
    else status = session.scheduled_on < today ? 'missed' : 'planned';
    push(session.scheduled_on, {
      status,
      sessionId: session.id,
      logId: null,
      name_de: session.name_de,
      caughtUpFrom: null,
    });
  }

  const days: SummaryDay[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const dayItems = [...(items.get(date) ?? [])].sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    );
    days.push({ date, status: dayItems[0]?.status ?? 'rest', items: dayItems });
  }
  const cardio = weekLogs.filter((l) => l.kind === 'endurance');
  const distanceM = cardio.reduce((sum, l) => sum + (l.cardio_distance_m ?? 0), 0);
  return {
    weekStart,
    days,
    sessionsDone: weekLogs.length,
    sessionsPlanned: sessions.filter(
      (s) =>
        s.plan_active &&
        inWeek(s.original_date ?? s.scheduled_on) &&
        (s.status !== 'skipped' || loggedSessionIds.has(s.id)),
    ).length,
    strengthSets: weekLogs
      .filter((l) => l.kind === 'strength')
      .reduce((sum, l) => sum + l.done_sets, 0),
    enduranceMinutes: cardio.reduce(
      (sum, l) => sum + Math.floor((l.cardio_duration_s ?? 0) / 60),
      0,
    ),
    enduranceKm: Math.round(distanceM / 100) / 10,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Verlauf
// ---------------------------------------------------------------------------------------------------------

export interface HistoryWeek<T extends Pick<SummaryLog, 'performed_on'>> {
  readonly weekStart: string;
  readonly logs: readonly T[];
}

/** Einträge nach ISO-Wochen, neueste zuerst; höchstens `limit` Einträge (nachladen je 20). */
export function historyByWeek<T extends Pick<SummaryLog, 'performed_on'> & { id: string }>(
  logs: readonly T[],
  options: { readonly limit?: number } = {},
): HistoryWeek<T>[] {
  const sorted = [...logs]
    .sort((a, b) =>
      a.performed_on !== b.performed_on
        ? a.performed_on < b.performed_on
          ? 1
          : -1
        : a.id < b.id
          ? 1
          : -1,
    )
    .slice(0, options.limit ?? logs.length);
  const weeks: { weekStart: string; logs: T[] }[] = [];
  for (const log of sorted) {
    const weekStart = startOfIsoWeek(log.performed_on);
    const last = weeks.at(-1);
    if (last && last.weekStart === weekStart) last.logs.push(log);
    else weeks.push({ weekStart, logs: [log] });
  }
  return weeks;
}

/** Bester Satz eines Tages je Übung (keine 1RM-Anzeige). */
export type BestSet =
  | { readonly kind: 'weight'; readonly weightKg: number; readonly reps: number }
  | { readonly kind: 'time'; readonly durationS: number }
  | { readonly kind: 'reps'; readonly reps: number };

export interface ExerciseHistoryEntry {
  readonly performedOn: string;
  readonly best: BestSet | null;
  readonly sets: number;
}

/**
 * Verlauf je Übung, neueste zuerst: je Eintrag der beste abgehakte Satz („Gewicht × Wiederholungen“ – schwerstes
 * Gewicht, bei Gleichstand mehr Wdh.; Halteübung: längste Dauer; sonst meiste Wdh.).
 */
export function exerciseHistory(
  exerciseId: string,
  entries: readonly {
    readonly exerciseId: string;
    readonly performedOn: string;
    readonly status: string;
    readonly sets: readonly LoggedSet[];
  }[],
): ExerciseHistoryEntry[] {
  return entries
    .filter((e) => e.exerciseId === exerciseId && e.status !== 'skipped')
    .map((e) => {
      const done = e.sets.filter((s) => s.done);
      let best: BestSet | null = null;
      for (const s of done) {
        if (s.weightKg !== null && s.weightKg > 0 && s.reps !== null) {
          if (
            best === null ||
            best.kind !== 'weight' ||
            s.weightKg > best.weightKg ||
            (s.weightKg === best.weightKg && s.reps > best.reps)
          ) {
            best = { kind: 'weight', weightKg: s.weightKg, reps: s.reps };
          }
        } else if (best?.kind !== 'weight' && s.durationS !== null && s.durationS > 0) {
          if (best === null || (best.kind === 'time' && s.durationS > best.durationS)) {
            best = { kind: 'time', durationS: s.durationS };
          }
        } else if (best === null || (best.kind === 'reps' && (s.reps ?? 0) > best.reps)) {
          if (s.reps !== null) best = { kind: 'reps', reps: s.reps };
        }
      }
      return { performedOn: e.performedOn, best, sets: done.length };
    })
    .sort((a, b) => (a.performedOn < b.performedOn ? 1 : a.performedOn > b.performedOn ? -1 : 0));
}

// ---------------------------------------------------------------------------------------------------------
// Etappe D: Blättern in der Woche, Ändern eines Eintrags
// ---------------------------------------------------------------------------------------------------------

/** Erste und letzte Woche (je Montag), zwischen denen die Wochenansicht blättern darf. */
export interface WeekBounds {
  readonly first: string;
  readonly last: string;
}

/**
 * Grenzen fürs Blättern: von der frühesten Woche mit Eintrag oder Einheit bis zur spätesten Woche mit einer Einheit,
 * mindestens die laufende Woche. `earliest` = ab hier liegt das Tagebuch vollständig auf dem Gerät (Supabase: die
 * letzten LOG_CACHE_WEEKS Wochen) – davor wird nicht geblättert (ältere Einträge zeigt der Verlauf nach dem
 * Nachladen).
 */
export function summaryWeekBounds(
  sessions: readonly Pick<SummarySession, 'scheduled_on'>[],
  logs: readonly Pick<SummaryLog, 'performed_on'>[],
  today: string,
  options: { readonly earliest?: string | null } = {},
): WeekBounds {
  const current = startOfIsoWeek(today);
  const dates = [...sessions.map((s) => s.scheduled_on), ...logs.map((l) => l.performed_on)];
  let first = current;
  let last = current;
  for (const date of dates) {
    const week = startOfIsoWeek(date);
    if (week < first) first = week;
    if (week > last) last = week;
  }
  // Nie hinter die laufende Woche klemmen (sonst ließe sich „heute“ nicht anzeigen).
  const earliest = options.earliest ? startOfIsoWeek(options.earliest) : null;
  if (earliest !== null && first < earliest) first = earliest < current ? earliest : current;
  return { first, last };
}

export interface WeekPager {
  /** Montag der angezeigten Woche (in die Grenzen geklemmt). */
  readonly weekStart: string;
  /** Montag der Vorwoche bzw. null am Anfang. */
  readonly previous: string | null;
  /** Montag der Folgewoche bzw. null am Ende. */
  readonly next: string | null;
}

/** Vor- und Folgewoche innerhalb der Grenzen; die gewünschte Woche wird in die Grenzen geklemmt. */
export function weekPager(week: string, bounds: WeekBounds): WeekPager {
  let weekStart = startOfIsoWeek(week);
  if (weekStart < bounds.first) weekStart = bounds.first;
  if (weekStart > bounds.last) weekStart = bounds.last;
  const previous = addDays(weekStart, -7);
  const next = addDays(weekStart, 7);
  return {
    weekStart,
    previous: previous >= bounds.first ? previous : null,
    next: next <= bounds.last ? next : null,
  };
}

/**
 * Darf ein gespeicherter Eintrag geändert werden? Nur mit (noch) bekannter geplanter Einheit (verwaiste Einträge bzw.
 * Einheiten ersetzter Pläne nicht – der Schnappschuss der Vorgabe lässt sich ohne Einheit nicht neu aufbauen) und nur
 * im Datumsfenster von save_session_log (W2: gleiche ISO-Woche ± 1 Tag, höchstens 14 Tage zurück) – sonst lehnte der
 * Server die neue Fassung ab. Löschen ist davon unabhängig (delete_session_log, nur online).
 */
export type LogEditability = 'editable' | 'unlinked' | 'too_old';

export function logEditability(
  log: Pick<SummaryLog, 'planned_session_id' | 'performed_on'>,
  session: Pick<SummarySession, 'id' | 'scheduled_on' | 'original_date'> | null,
  today: string,
): LogEditability {
  if (
    log.planned_session_id === null ||
    session === null ||
    session.id !== log.planned_session_id
  ) {
    return 'unlinked';
  }
  return isWithinLogDateWindow(
    log.performed_on,
    session.original_date ?? session.scheduled_on,
    today,
  )
    ? 'editable'
    : 'too_old';
}
