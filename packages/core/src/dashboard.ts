import { isoDateSchema } from './age';
import { addDays, startOfIsoWeek } from './dates';
import type { PlannedSessionStatus } from './enums';
import {
  type FollowUpState,
  nextPlannedSession,
  type PlanUpdateOffer,
  sessionOn,
  type StoredSession,
} from './plan/view';

/**
 * Datenaufbereitung für die Übersicht (Startseite mit Kacheln, docs/PLAN-DASHBOARD.md 2.4). Reine Funktionen, die
 * App bildet nur ab. Kein Wunschgewicht, kein Fortschritt zum Ziel, keine Prognose (docs/PLAN-ZIELE.md F13).
 */

/** Mindestangaben einer gespeicherten Einheit (planned_sessions) für die Wochenzahlen. */
export interface DashboardSession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly status: PlannedSessionStatus;
}

export type TrainingToday<T extends StoredSession> =
  /** Kein aktiver Plan. */
  | { readonly kind: 'no_plan' }
  /** Heute steht eine Einheit an (offen oder schon erledigt). */
  | { readonly kind: 'session'; readonly session: T; readonly done: boolean }
  /** Ruhetag; `next` = nächste geplante Einheit nach heute (null = keine mehr im Plan). */
  | { readonly kind: 'rest'; readonly next: T | null };

/**
 * „Training heute“: dieselben Regeln wie „Heute“ (`sessionOn`/`nextPlannedSession` aus plan/view.ts) – gestrichene
 * Einheiten zählen nicht, eine offene Einheit geht einer erledigten am selben Tag vor.
 */
export function trainingToday<T extends StoredSession>(
  sessions: readonly T[] | null,
  today: string,
): TrainingToday<T> {
  isoDateSchema.parse(today);
  if (sessions === null) return { kind: 'no_plan' };
  const session = sessionOn(sessions, today);
  if (session) return { kind: 'session', session, done: session.status === 'completed' };
  return { kind: 'rest', next: nextPlannedSession(sessions, today) };
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

/** Hinweis „Plan neu erstellen?“ wie auf „Heute“: abgelaufen geht vor strenger, strenger vor normalem Angebot. */
export type PlanNotice =
  | { readonly kind: 'none' }
  /** Angaben bzw. Vorlage geändert; `versionOnly` = nur eine neue Version der Vorlage. */
  | { readonly kind: 'offer'; readonly versionOnly: boolean }
  /** Strengere Sicherheitsregeln – deutlich anbieten, nicht direkt starten. */
  | { readonly kind: 'stricter' }
  /** Plan abgelaufen (Folgeblock vorbei). */
  | { readonly kind: 'ended' };

export function planNotice(offer: PlanUpdateOffer | null, followUp: FollowUpState): PlanNotice {
  if (followUp === 'ended') return { kind: 'ended' };
  if (!offer?.offer) return { kind: 'none' };
  if (offer.stricter) return { kind: 'stricter' };
  return {
    kind: 'offer',
    versionOnly: offer.reasons.length === 1 && offer.reasons[0] === 'template_version',
  };
}

export type TrainingAttentionReason =
  | 'plan_ended'
  | 'plan_stricter'
  | 'plan_offer'
  | 'draft'
  | 'workout_problem'
  | 'plan_message'
  | 'reconsent'
  | 'foreign_data'
  | 'session_expired'
  | 'competition_mismatch'
  | 'weight_goal';

export interface TrainingAttentionFlags {
  readonly planNotice: PlanNotice;
  readonly drafts: number;
  /** Art der letzten Trainings-Rückmeldung (null = keine). */
  readonly workoutMessage:
    'saved' | 'queued' | 'orphaned' | 'conflict' | 'rejected' | 'invalid' | null;
  readonly planMessage: boolean;
  readonly reconsent: boolean;
  readonly foreignData: boolean;
  readonly sessionExpired: boolean;
  readonly competitionMismatch: boolean;
  readonly weightGoalCard: boolean;
}

/**
 * Was „Heute“ (Reiter Training) gerade zeigt und die Übersicht melden muss („Im Training wartet etwas auf dich“).
 * Reihenfolge = Wichtigkeit. Positive Rückmeldungen („gespeichert“, „wird gesendet“) zählen nicht.
 */
export function trainingAttentionReasons(flags: TrainingAttentionFlags): TrainingAttentionReason[] {
  const reasons: TrainingAttentionReason[] = [];
  if (flags.planNotice.kind === 'ended') reasons.push('plan_ended');
  if (flags.planNotice.kind === 'stricter') reasons.push('plan_stricter');
  if (flags.reconsent) reasons.push('reconsent');
  if (flags.foreignData) reasons.push('foreign_data');
  if (flags.sessionExpired) reasons.push('session_expired');
  if (
    flags.workoutMessage === 'conflict' ||
    flags.workoutMessage === 'rejected' ||
    flags.workoutMessage === 'invalid'
  ) {
    reasons.push('workout_problem');
  }
  if (flags.drafts > 0) reasons.push('draft');
  if (flags.planMessage) reasons.push('plan_message');
  if (flags.competitionMismatch) reasons.push('competition_mismatch');
  if (flags.planNotice.kind === 'offer') reasons.push('plan_offer');
  if (flags.weightGoalCard) reasons.push('weight_goal');
  return reasons;
}
