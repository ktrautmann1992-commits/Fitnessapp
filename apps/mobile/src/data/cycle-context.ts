import {
  activePlan,
  addDays,
  ageInYears,
  startOfIsoWeek,
  type PlannedTodayState,
  type StoredSession,
} from '@fitnessapp/core';

import type { OnboardingAnswers, UserRows } from './types';

/**
 * Was das Zyklus-Modul aus den übrigen Daten liest (nur lesend, nie schreibend – Plan 6.5): heutige Einheit (für das
 * Angebot „Heute leichter?“), Renntag, Einheiten je Woche und Ziel Fettverlust (W1b/W1c), Alter (Längen unter 18),
 * Flag `pregnancy` aus dem Gesundheits-Check (pausiert das Modul) und Ernährungsform (Eisen-Hinweis).
 * Zyklusdaten fließen nie zurück in Plan, Ernährung, Kalorien oder Readiness.
 */
export interface CycleContext {
  readonly todaySession: StoredSession | null;
  readonly planned: PlannedTodayState;
  readonly raceDay: boolean;
  readonly sessionsPerWeek: number;
  readonly fatLossGoal: boolean;
  readonly ageYears: number | null;
  readonly pregnancyFlag: boolean;
}

export function cycleContext(
  rows: UserRows,
  answers: OnboardingAnswers,
  today: string,
  /** Offene Entwürfe (Einheit schon begonnen). */
  draftSessionIds: readonly string[] = [],
): CycleContext {
  const plan = activePlan(rows);
  const sessions = plan?.sessions ?? [];
  const todaySession =
    sessions.find((s) => s.scheduled_on === today && s.status === 'planned') ?? null;
  const logged = new Set(
    rows.sessionLogs.map((log) => log.planned_session_id).filter((id): id is string => id !== null),
  );
  const planned: PlannedTodayState =
    todaySession === null
      ? 'none'
      : logged.has(todaySession.id) || draftSessionIds.includes(todaySession.id)
        ? 'started'
        : 'planned';
  const weekStart = startOfIsoWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const sessionsPerWeek = sessions.filter(
    (s) => s.scheduled_on >= weekStart && s.scheduled_on <= weekEnd,
  ).length;
  const goal = answers.goal;
  let age: number | null;
  try {
    age = answers.birthDate ? ageInYears(answers.birthDate, today) : null;
  } catch {
    age = null;
  }
  return {
    todaySession,
    planned,
    raceDay: rows.competitions.some((c) => c.race_date === today && c.status === 'planned'),
    sessionsPerWeek,
    fatLossGoal: goal?.goalType === 'fat_loss' || goal?.secondaryGoalType === 'fat_loss',
    ageYears: age,
    pregnancyFlag: answers.healthScreening?.flags.includes('pregnancy') ?? false,
  };
}
