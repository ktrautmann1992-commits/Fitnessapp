import { SESSION_LOG_LIMITS } from '../constants';
import { addDays, startOfIsoWeek } from '../dates';
import type { PlannedSessionKind, PlannedSessionStatus } from '../enums';
import { dailyLogLimitReached, entryDateBlock } from './free-session';
import { isWithinLogDateWindow } from './summary';

/**
 * Nachtragen (docs/PLAN-AUSWERTUNG.md 2.6 und 4, Etappe A1b): Welche geplanten Einheiten dürfen an einem Datum
 * nachgetragen werden – mit denselben Regeln wie save_session_log (Datumsfenster W2: ISO-Woche des Termins ± 1 Tag,
 * höchstens 14 Tage zurück; nie stapeln; Tageslimit) und nie in der Zukunft. Eine nachgetragene GEPLANTE Einheit
 * zählt normal für die Progression (sie ist echt trainiert; die Progression ordnet nach performed_on).
 */

export interface BackfillSession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly original_date: string | null;
  readonly status: PlannedSessionStatus | 'completed';
  readonly kind: PlannedSessionKind;
  readonly name_de: string;
  /** Gehört zum aktiven Plan? Einheiten ersetzter Pläne werden nicht angeboten. */
  readonly plan_active: boolean;
}

export interface BackfillLog {
  readonly planned_session_id: string | null;
  readonly performed_on: string;
}

/** Warum der ganze Tag nichts zulässt: Zukunft, älter als 14 Tage, Tageslimit erreicht. */
export type BackfillDayBlock = 'future' | 'too_old' | 'daily_limit';

export type BackfillReason =
  /** Schon eingetragen (Eintrag vorhanden bzw. erledigt). */
  | 'logged'
  /** An diesem Tag ist schon eine andere geplante Einheit eingetragen (nie stapeln). */
  | 'day_taken'
  /** Termin liegt noch vor dir (später als heute) – am geplanten Tag trainieren. */
  | 'upcoming'
  /** Datum passt nicht zur Woche des Termins bzw. ist zu alt (Datumsfenster W2). */
  | 'window';

export interface BackfillOption {
  readonly sessionId: string;
  readonly name_de: string;
  readonly kind: PlannedSessionKind;
  /** Termin (coalesce(original_date, scheduled_on)) – Bezug des Datumsfensters. */
  readonly referenceDate: string;
  readonly scheduledOn: string;
  readonly allowed: boolean;
  readonly reason: BackfillReason | null;
}

export interface BackfillDay {
  readonly date: string;
  readonly block: BackfillDayBlock | null;
  /** Freie Einheit an diesem Tag möglich (ohne Tagesblock immer; nie stapeln gilt nur für geplante). */
  readonly freeAllowed: boolean;
  /** Eine geplante Einheit ist an diesem Tag schon eingetragen. */
  readonly dayTaken: boolean;
  /** Einheiten des aktiven Plans aus den Wochen um das Datum, nach Termin sortiert. */
  readonly options: readonly BackfillOption[];
}

/**
 * Optionen zum Nachtragen an `date`. Angeboten werden Einheiten des aktiven Plans, deren Woche (± 1 Tag) das Datum
 * enthält; gesperrte stehen mit Grund dabei. Ein gesperrter Tag (Zukunft, zu alt, Tageslimit) hat keine Optionen.
 * `createdToday` = heute schon angelegte Einträge (logsCreatedOn bzw. Zähler des Testmodus).
 */
export function backfillOptions(
  sessions: readonly BackfillSession[],
  logs: readonly BackfillLog[],
  date: string,
  today: string,
  options: { readonly createdToday?: number } = {},
): BackfillDay {
  const dateBlock = entryDateBlock(date, today);
  const block: BackfillDayBlock | null =
    dateBlock ?? (dailyLogLimitReached(options.createdToday ?? 0) ? 'daily_limit' : null);
  const dayLogs = logs.filter((l) => l.performed_on === date && l.planned_session_id !== null);
  const dayTaken = dayLogs.length > 0;
  if (block !== null) return { date, block, freeAllowed: false, dayTaken, options: [] };

  const logged = new Set(
    logs.map((l) => l.planned_session_id).filter((id): id is string => id !== null),
  );
  const { weekToleranceDays } = SESSION_LOG_LIMITS;
  const result: BackfillOption[] = [];
  for (const session of sessions) {
    if (!session.plan_active) continue;
    const reference = session.original_date ?? session.scheduled_on;
    const weekStart = startOfIsoWeek(reference);
    if (
      date < addDays(weekStart, -weekToleranceDays) ||
      date > addDays(weekStart, 6 + weekToleranceDays)
    ) {
      continue;
    }
    let reason: BackfillReason | null = null;
    if (logged.has(session.id) || session.status === 'completed') reason = 'logged';
    else if (session.scheduled_on > today) reason = 'upcoming';
    else if (!isWithinLogDateWindow(date, reference, today)) reason = 'window';
    else if (dayLogs.some((l) => l.planned_session_id !== session.id)) reason = 'day_taken';
    result.push({
      sessionId: session.id,
      name_de: session.name_de,
      kind: session.kind,
      referenceDate: reference,
      scheduledOn: session.scheduled_on,
      allowed: reason === null,
      reason,
    });
  }
  result.sort((a, b) =>
    a.scheduledOn !== b.scheduledOn
      ? a.scheduledOn < b.scheduledOn
        ? -1
        : 1
      : a.sessionId < b.sessionId
        ? -1
        : 1,
  );
  return { date, block: null, freeAllowed: true, dayTaken, options: result };
}

/**
 * Tage, an die eine geplante Einheit nachgetragen werden darf (Datumswahl im Trainingsmodus): heute bis 14 Tage
 * zurück, im Datumsfenster des Termins, ohne andere eingetragene geplante Einheit an dem Tag. Neueste zuerst.
 * Liegt der Termin noch vor dir, ist die Liste leer.
 */
export function backfillDates(
  session: BackfillSession,
  logs: readonly (BackfillLog & { readonly id?: string })[],
  today: string,
): string[] {
  if (session.scheduled_on > today) return [];
  const reference = session.original_date ?? session.scheduled_on;
  const dates: string[] = [];
  for (let i = 0; i <= SESSION_LOG_LIMITS.backdateDays; i += 1) {
    const date = addDays(today, -i);
    if (!isWithinLogDateWindow(date, reference, today)) continue;
    const taken = logs.some(
      (l) =>
        l.performed_on === date &&
        l.planned_session_id !== null &&
        l.planned_session_id !== session.id,
    );
    if (!taken) dates.push(date);
  }
  return dates;
}
