import { isoDateSchema } from './age';
import { addDays, startOfIsoWeek } from './dates';
import type { PlannedSessionStatus } from './enums';

/**
 * Datenaufbereitung für die Übersicht (Startseite mit Kacheln, docs/PLAN-DASHBOARD.md 2.4). Reine Funktionen, die
 * App bildet nur ab. Kein Wunschgewicht, kein Fortschritt zum Ziel, keine Prognose (docs/PLAN-ZIELE.md F13).
 */

/** Mindestangaben einer gespeicherten Einheit (planned_sessions). */
export interface DashboardSession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly status: PlannedSessionStatus;
}

export type TrainingToday<T extends DashboardSession> =
  /** Kein aktiver Plan. */
  | { readonly kind: 'no_plan' }
  /** Heute steht eine Einheit an (offen oder schon erledigt). */
  | { readonly kind: 'session'; readonly session: T; readonly done: boolean }
  /** Ruhetag; `next` = nächste geplante Einheit nach heute (null = keine mehr im Plan). */
  | { readonly kind: 'rest'; readonly next: T | null };

/**
 * „Training heute“: gleiche Regel wie „Heute“ (sessionOn/nextPlannedSession in plan/view.ts) – gestrichene Einheiten
 * zählen nicht, eine offene Einheit geht einer erledigten am selben Tag vor.
 */
export function trainingToday<T extends DashboardSession>(
  sessions: readonly T[] | null,
  today: string,
): TrainingToday<T> {
  isoDateSchema.parse(today);
  if (sessions === null) return { kind: 'no_plan' };
  const onDay = sessions.filter((s) => s.scheduled_on === today && s.status !== 'skipped');
  const session = onDay.find((s) => s.status === 'planned') ?? onDay[0];
  if (session) return { kind: 'session', session, done: session.status === 'completed' };
  const next =
    [...sessions]
      .filter((s) => s.status === 'planned' && s.scheduled_on > today)
      .sort((a, b) => a.scheduled_on.localeCompare(b.scheduled_on))[0] ?? null;
  return { kind: 'rest', next };
}

export interface WeekTrainingProgress {
  /** Montag der Woche (ISO). */
  readonly weekStart: string;
  /** Einheiten dieser Woche ohne gestrichene. */
  readonly planned: number;
  readonly completed: number;
  /** Noch offene Einheiten ab heute. */
  readonly open: number;
}

/** Wochenzahlen Mo–So der Woche von `today` (gestrichene Einheiten zählen nicht mit). */
export function weekTrainingProgress(
  sessions: readonly DashboardSession[],
  today: string,
): WeekTrainingProgress {
  const weekStart = startOfIsoWeek(isoDateSchema.parse(today));
  const weekEnd = addDays(weekStart, 6);
  const inWeek = sessions.filter(
    (s) => s.scheduled_on >= weekStart && s.scheduled_on <= weekEnd && s.status !== 'skipped',
  );
  return {
    weekStart,
    planned: inWeek.length,
    completed: inWeek.filter((s) => s.status === 'completed').length,
    open: inWeek.filter((s) => s.status === 'planned' && s.scheduled_on >= today).length,
  };
}

/** Mindestangaben einer Körperdaten-Messung (body_metrics). */
export interface BodyWeightEntry {
  readonly measured_on: string;
  readonly weight_kg: number | null;
}

/**
 * Letztes eingetragenes Gewicht (jüngstes Messdatum mit Gewicht; gleicher Tag → der spätere Eintrag). Nur aufrufen,
 * wenn die Einwilligung Gesundheitsdaten gültig ist – das prüft die App vorher. null = noch kein Gewicht.
 */
export function latestBodyWeight(
  entries: readonly BodyWeightEntry[],
): { readonly weightKg: number; readonly measuredOn: string } | null {
  let latest: { weightKg: number; measuredOn: string } | null = null;
  for (const entry of entries) {
    if (entry.weight_kg === null || !Number.isFinite(entry.weight_kg) || entry.weight_kg <= 0) {
      continue;
    }
    if (latest === null || entry.measured_on >= latest.measuredOn) {
      latest = { weightKg: entry.weight_kg, measuredOn: entry.measured_on };
    }
  }
  return latest;
}
