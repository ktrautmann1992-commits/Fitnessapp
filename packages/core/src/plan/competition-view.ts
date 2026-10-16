import { COMPETITION_PERIODIZATION, COMPETITION_START_LOOKBACK_DAYS } from '../constants';
import { addDays, daysBetween, startOfIsoWeek } from '../dates';
import type {
  CompetitionDiscipline,
  CompetitionPhase,
  CompetitionReference,
  CompetitionStatus,
} from './competition-schema';
import {
  type PaceProfile,
  type PaceSpan,
  paceTargets,
  type WorkoutType,
  isHardWorkoutType,
} from './intensity';
import type { EnduranceStartGroup } from './safety';
import { competitionStartReference, type CompetitionStartReference } from './competition';
import type { PreviousSession } from './schedule';

/**
 * Anzeige eines Wettkampfs in der App (docs/PLAN-PHASE-10.md Abschnitt 8, Etappe WP4): Countdown, Rennwoche, Woche im
 * Plan („Aufbau · Woche 6 von 14“), Erholung nach dem Rennen, Pace je Einheit. Reine Funktionen, das Datum wird
 * übergeben (Europe/Berlin); die App formuliert nur die Texte.
 */

/** Was „Heute“, Kalender und „Mein Wettkampf“ zum Wettkampf zeigen. */
export type CompetitionCountdown =
  /** Renntag liegt in der Zukunft; `raceWeek` = dieselbe Kalenderwoche („Nichts Neues ausprobieren“). */
  | { readonly kind: 'upcoming'; readonly daysLeft: number; readonly raceWeek: boolean }
  /** Heute ist Renntag. */
  | { readonly kind: 'race_day' }
  /** Renntag vorbei, noch geplant: Ergebnis eintragen oder abschließen. */
  | { readonly kind: 'awaiting_result'; readonly daysSince: number }
  /** Erledigt – `recovery` = noch in der Erholung nach dem Rennen. */
  | { readonly kind: 'done'; readonly hasResult: boolean; readonly recovery: boolean }
  | { readonly kind: 'cancelled' };

export interface CompetitionCountdownInput {
  readonly status: CompetitionStatus;
  readonly discipline: CompetitionDiscipline;
  readonly raceDate: string;
  readonly resultSessionLogId: string | null;
}

/**
 * Letzter Tag der „Erholung nach dem Rennen“: Rest der Rennwoche plus die Erholungswochen des Makrozyklus
 * (COMPETITION_PERIODIZATION.recoveryWeeks: 5 km/10 km/Halbmarathon 1, Marathon 2). Gleiche Wochen wie der Plan.
 */
export function postRaceRecoveryEnd(discipline: CompetitionDiscipline, raceDate: string): string {
  const weeks = COMPETITION_PERIODIZATION.recoveryWeeks[discipline];
  return addDays(startOfIsoWeek(raceDate), 7 * (1 + weeks) - 1);
}

/** Liegt `today` in der Kalenderwoche des Renntags (vor oder am Renntag)? */
export function isRaceWeek(raceDate: string, today: string): boolean {
  return today <= raceDate && startOfIsoWeek(today) === startOfIsoWeek(raceDate);
}

export function competitionCountdown(
  c: CompetitionCountdownInput,
  today: string,
): CompetitionCountdown {
  if (c.status === 'cancelled') return { kind: 'cancelled' };
  if (c.status === 'done') {
    return {
      kind: 'done',
      hasResult: c.resultSessionLogId !== null,
      recovery: today >= c.raceDate && today <= postRaceRecoveryEnd(c.discipline, c.raceDate),
    };
  }
  if (c.raceDate === today) return { kind: 'race_day' };
  if (c.raceDate < today)
    return { kind: 'awaiting_result', daysSince: daysBetween(c.raceDate, today) };
  return {
    kind: 'upcoming',
    daysLeft: daysBetween(today, c.raceDate),
    raceWeek: isRaceWeek(c.raceDate, today),
  };
}

/**
 * Welcher Wettkampf angezeigt wird (W-G9: höchstens ein geplanter): der geplante; sonst der zuletzt erledigte, solange
 * die Erholung nach dem Rennen läuft (Frage nach dem nächsten Ziel). Sonst null (Einladung „Wettkampf eintragen“).
 */
export function competitionToShow<
  T extends {
    readonly status: CompetitionStatus;
    readonly discipline: CompetitionDiscipline;
    readonly race_date: string;
  },
>(competitions: readonly T[], today: string): T | null {
  const planned = competitions.find((c) => c.status === 'planned');
  if (planned) return planned;
  const done = competitions
    .filter(
      (c) =>
        c.status === 'done' &&
        today >= c.race_date &&
        today <= postRaceRecoveryEnd(c.discipline, c.race_date),
    )
    .sort((a, b) => b.race_date.localeCompare(a.race_date));
  return done[0] ?? null;
}

/** „Phase · Woche X von N“ (Plan 8, Plan-Ansicht). */
export interface CompetitionPlanWeek {
  /** Phase dieser Woche aus den gespeicherten Einheiten (training_phase); null = keine Einheit mit Phase. */
  readonly phase: CompetitionPhase | null;
  /**
   * Woche im Wettkampfplan: Beginnt der Plan nicht montags, ist die angebrochene Startwoche Woche 0 (Einstiegswoche,
   * wie periodization.ts); sonst zählt die erste Woche als 1. Nach der Rennwoche null (Erholung nach dem Rennen).
   */
  readonly weekNo: number | null;
  /** Woche des Renntags in derselben Zählung (= „von N“). */
  readonly totalWeeks: number;
  /** Diese Woche ist die Rennwoche. */
  readonly raceWeek: boolean;
}

/**
 * Woche des Wettkampfplans für `date` (meist heute bzw. der gewählte Tag). `sessions` = Einheiten des aktiven Plans
 * (gespeicherte Phase je Einheit, WP3). null = Datum vor dem Planstart oder Plan ohne Wettkampf-Einheiten.
 */
export function competitionPlanWeek(
  sessions: readonly {
    readonly scheduled_on: string;
    readonly training_phase?: CompetitionPhase | null;
  }[],
  planStart: string,
  raceDate: string,
  date: string,
): CompetitionPlanWeek | null {
  if (date < planStart || !sessions.some((s) => s.training_phase)) return null;
  const startMonday = startOfIsoWeek(planStart);
  const partial = planStart !== startMonday;
  const offset = partial ? 0 : 1;
  const index = daysBetween(startMonday, startOfIsoWeek(date)) / 7;
  const raceIndex = daysBetween(startMonday, startOfIsoWeek(raceDate)) / 7;
  const week = startOfIsoWeek(date);
  const phase =
    sessions.find((s) => startOfIsoWeek(s.scheduled_on) === week && s.training_phase)
      ?.training_phase ?? null;
  return {
    phase,
    weekNo: index > raceIndex ? null : index + offset,
    totalWeeks: raceIndex + offset,
    raceWeek: index === raceIndex,
  };
}

/** Basis der Pace-Richtwerte aus dem Wettkampf (W-G6: nur mit eigener Referenzzeit). */
export function competitionPaceProfile(competition: {
  readonly discipline: CompetitionDiscipline;
  readonly reference: CompetitionReference | null;
}): PaceProfile | null {
  return competition.reference === null
    ? null
    : { reference: competition.reference, discipline: competition.discipline };
}

/** Was eine Wettkampf-Einheit zusätzlich zeigt: Pace-Spanne und Distanz-Richtwert (beides optional). */
export interface SessionPaceInfo {
  readonly pace: PaceSpan | null;
  /** Gespeicherter Richtwert (target_distance_m, nur durchgehende Läufe mit Referenzzeit). */
  readonly distanceM: number | null;
  /** Harte Art (für die Anzeige „zügig“/„hart“ mit Wort). */
  readonly hard: boolean;
}

/**
 * Pace und Distanz-Richtwert einer ANGEZEIGTEN Einheit (nach prepareSessionForDisplay): nur Laufen (wer wegen der
 * aktuellen Regeln geht, bekommt keine Lauf-Pace), nur mit Art und Referenzzeit (paceTargets), Distanz nur als
 * gespeicherter Richtwert und nur, solange die Einheit gelaufen wird.
 */
export function sessionPaceInfo(
  session: {
    readonly kind: string;
    readonly endurance_modality: string | null;
    readonly workout_type?: WorkoutType | null;
    readonly target_distance_m?: number | null;
  },
  profile: PaceProfile | null,
): SessionPaceInfo {
  const type = session.workout_type ?? null;
  const running = session.kind === 'endurance' && session.endurance_modality === 'run';
  if (type === null || !running)
    return { pace: null, distanceM: null, hard: isHardWorkoutType(type) };
  return {
    pace: paceTargets(profile, type),
    distanceM: session.target_distance_m ?? null,
    hard: isHardWorkoutType(type),
  };
}

/**
 * Bezug aus dem Tagebuch für den Start eines Wettkampfplans (Plan 3.2: „Tagebuch-Einträge der letzten 4 Wochen“):
 * nur Einheiten der letzten `days` Tage VOR heute, je Einheit min(geplant, eingetragen) – so zählt nie eine künftige
 * oder nur geplante Woche (COMPETITION_START_LOOKBACK_DAYS). null = kein Bezug (Startumfang der Gruppe).
 */
export function recentCompetitionStartReference(
  previous: readonly PreviousSession[],
  previousStartGroup: EnduranceStartGroup,
  loggedMinutes: ReadonlyMap<string, number>,
  today: string,
): CompetitionStartReference | null {
  const from = addDays(today, -COMPETITION_START_LOOKBACK_DAYS);
  const recent = previous.filter((s) => s.scheduled_on < today && s.scheduled_on >= from);
  if (recent.length === 0) return null;
  return competitionStartReference(recent, previousStartGroup, loggedMinutes);
}
