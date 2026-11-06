import { z } from 'zod';

import { isoDateSchema } from '../age';
import { AGE_CHECK_TIME_ZONE, SESSION_START_TIME } from '../constants';
import { isoWeekday, wallClockInTimeZone } from '../dates';

/**
 * Uhrzeit einer geplanten Einheit (docs/PLAN-NAEHRSTOFF-TIMING.md Abschnitt 6, Etappe T0/T1). In der Datenbank als
 * `planned_sessions.start_time` („HH:MM“, ganze Minuten), in der Ernährungs-Engine als Minuten nach Mitternacht.
 * Die Uhrzeit hängt an der Einheit: Verschieben (anderer Tag) nimmt sie mit.
 */

/** „HH:MM“ (00:00–23:59) – dieselbe Form wie die Prüfung in private.insert_plan_sessions (db-sync.test.ts). */
export const SESSION_START_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export const sessionStartTimeTextSchema = z
  .string()
  .regex(SESSION_START_TIME_PATTERN, 'Bitte eine Uhrzeit wie 18:30 angeben.');

/** Minuten nach Mitternacht (0–1439). */
export const sessionStartMinutesSchema = z
  .number()
  .int()
  .min(SESSION_START_TIME.minMinutes)
  .max(SESSION_START_TIME.maxMinutes);

/** „18:30“ → 1110. Postgres liefert `time` als „18:30:00“ – Sekunden (immer 0, CHECK) werden ignoriert. */
export function startTimeToMinutes(text: string | null | undefined): number | null {
  if (text === null || text === undefined) return null;
  const short = /^\d{2}:\d{2}:00$/.test(text) ? text.slice(0, 5) : text;
  const parsed = sessionStartTimeTextSchema.safeParse(short);
  if (!parsed.success) return null;
  const [h, m] = parsed.data.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

/** 1110 → „18:30“. */
export function minutesToStartTime(minutes: number): string {
  const value = sessionStartMinutesSchema.parse(minutes);
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Uhrzeit-Text für die Anzeige („18:30“) aus Minuten; über Mitternacht hinaus wird auf 23:59 begrenzt. */
export function clockLabel(minutes: number): string {
  return minutesToStartTime(
    Math.min(Math.max(Math.round(minutes), 0), SESSION_START_TIME.maxMinutes),
  );
}

/**
 * Essen nach dem Training (Gründer-Wunsch 06.11.2026, docs/PLAN-NAEHRSTOFF-TIMING.md 6a): tatsächlicher Beginn einer
 * ERLEDIGTEN Einheit in Minuten nach Mitternacht (Europe/Berlin, Sommerzeit inklusive) für die Ernährungs-Engine.
 * Reihenfolge: Beginn laut Tagebuch (`session_logs.started_at`, auch Smartwatch-Übernahmen) – nur, wenn er auf den Tag
 * der Einheit fällt (Beginn am Vortag kurz vor Mitternacht o. Ä. zählt nicht als Uhrzeit dieses Tages); sonst die
 * geplante Uhrzeit (`planned_sessions.start_time`); sonst null (Engine wie bisher mit „Trainingszeit“).
 * Ergebnis innerhalb SESSION_START_TIME (00:00–23:59). Ändert nur Zeitfenster/Rollen – nie Energie oder Grenzen.
 */
export function completedSessionStartMinutes(
  input: {
    /** Kalendertag der Einheit (geplant: `scheduled_on`, frei: `performed_on`). */
    readonly day: string;
    readonly startedAt?: string | null;
    readonly plannedStartTime?: string | null;
  },
  timeZone: string = AGE_CHECK_TIME_ZONE,
): number | null {
  if (input.startedAt !== null && input.startedAt !== undefined) {
    try {
      const wall = wallClockInTimeZone(input.startedAt, timeZone);
      if (wall.date === input.day) {
        return Math.min(
          Math.max(wall.minutes, SESSION_START_TIME.minMinutes),
          SESSION_START_TIME.maxMinutes,
        );
      }
    } catch {
      // Unlesbarer Zeitstempel: wie ohne Beginn.
    }
  }
  return startTimeToMinutes(input.plannedStartTime);
}

/**
 * Auswahl in der App: Uhrzeit um `deltaMinutes` verschieben (Schritte `SESSION_START_TIME.stepMinutes`), innerhalb
 * 00:00–23:55 – nie über Mitternacht.
 */
export function stepStartMinutes(current: number, deltaMinutes: number): number {
  const step = SESSION_START_TIME.stepMinutes;
  const base = Math.round(sessionStartMinutesSchema.parse(current) / step) * step;
  const max = Math.floor(SESSION_START_TIME.maxMinutes / step) * step;
  return Math.min(Math.max(base + deltaMinutes, SESSION_START_TIME.minMinutes), max);
}

/** Anfrage „Uhrzeit der Einheit ändern“ (App → Server, Update von planned_sessions.start_time). */
export const sessionStartTimeRequestSchema = z.strictObject({
  sessionId: z.string().min(1).max(100),
  /** null = eigene Uhrzeit entfernen (dann wieder Standard aus „Trainingszeit“, „ca.“). */
  startTime: sessionStartTimeTextSchema.nullable(),
});
export type SessionStartTimeRequest = z.infer<typeof sessionStartTimeRequestSchema>;

/** Bisherige Einheit mit Uhrzeit (aus planned_sessions). */
export interface SessionWithStartTime {
  readonly scheduled_on: string;
  readonly kind: string;
  readonly status: string;
  readonly start_time: string | null;
}

/**
 * Neuer Plan bzw. Folgeblock (save_training_plan / append_plan_block): Uhrzeiten der bisherigen Einheiten übernehmen –
 * je Wochentag und Art die zuletzt geplante eigene Uhrzeit (gestrichene zählen nicht). Einheiten ohne Vorbild bleiben
 * ohne Uhrzeit (Standard „ca.“). Ändert nichts an Tagen, Dauer oder Inhalt.
 */
export function carryOverSessionStartTimes<
  T extends { readonly scheduled_on: string; readonly kind: string },
>(
  sessions: readonly T[],
  previous: readonly SessionWithStartTime[],
): (T & { start_time?: string })[] {
  const byKey = new Map<string, { date: string; time: string }>();
  for (const p of previous) {
    if (p.status === 'skipped') continue;
    const minutes = startTimeToMinutes(p.start_time);
    if (minutes === null) continue;
    const date = isoDateSchema.parse(p.scheduled_on);
    const key = `${isoWeekday(date)}|${p.kind}`;
    const known = byKey.get(key);
    if (known === undefined || known.date < date) {
      byKey.set(key, { date, time: minutesToStartTime(minutes) });
    }
  }
  return sessions.map((s) => {
    const hit = byKey.get(`${isoWeekday(isoDateSchema.parse(s.scheduled_on))}|${s.kind}`);
    return hit === undefined ? { ...s } : { ...s, start_time: hit.time };
  });
}
