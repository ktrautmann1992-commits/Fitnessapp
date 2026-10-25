import { ENDURANCE_EFFORT, LEG_LOAD_HINT, SPORT_CATALOGUE } from '../constants';
import { addDays } from '../dates';
import type {
  EnduranceModality,
  PlannedSessionKind,
  PlannedSessionStatus,
  SessionFocus,
  SportId,
} from '../enums';
import { isHardWorkoutType, type WorkoutType } from '../plan/intensity';
import { effectiveEffort } from './load';

/**
 * Plan-Hinweis nach Sport mit hoher Beinbelastung (docs/PLAN-SPORTARTEN.md 6, LEG_LOAD_HINT): War gestern z. B.
 * Fußball (≥ 30 min, Anstrengung ≥ 5), bekommt eine HEUTE bzw. am Folgetag geplante harte Bein- oder Intervall-Einheit
 * einen sanften Vorschlag („locker angehen oder einen Tag schieben“). Nur Hinweis – der Plan ändert sich nicht, kein
 * Eintrag in plan_adjustments (die Live-Anpassung bleibt unberührt; „harte Einheit“ nutzt dieselbe Einteilung wie die
 * Live-Anpassung: HARD_WORKOUT_TYPES bzw. Anstrengung über ENDURANCE_EFFORT.easyMax). Rein.
 */

export interface LegLoadSportLog {
  readonly id: string;
  readonly performed_on: string;
  readonly sport: SportId | null;
  readonly durationS: number | null;
  /** Anstrengung 0–10 (session_rpe); null = übliche der Sportart. */
  readonly effort: number | null;
}

export interface LegLoadSession {
  readonly id: string;
  readonly scheduled_on: string;
  readonly status: PlannedSessionStatus;
  readonly kind: PlannedSessionKind;
  readonly focus: SessionFocus | null;
  readonly endurance_modality: EnduranceModality | null;
  readonly effort_target: number | null;
  readonly workout_type?: WorkoutType | null;
  /** Gehört zum aktiven Plan (fehlt = ja). */
  readonly plan_active?: boolean;
}

/** Warum die Einheit „hart für die Beine“ ist. */
export type LegLoadHintReason = 'strength_legs' | 'hard_endurance';

export interface LegLoadHint {
  readonly sessionId: string;
  readonly sessionDate: string;
  readonly reason: LegLoadHintReason;
  readonly sport: SportId;
  /** Tag der Sportart (Vortag der Einheit). */
  readonly sportDate: string;
  readonly sportLogId: string;
}

/** Ist eine geplante Einheit hart für die Beine? Kraft mit Bein-/Ganzkörper-Fokus bzw. harte Ausdauer (nicht Schwimmen). */
export function hardLegSessionReason(session: LegLoadSession): LegLoadHintReason | null {
  if (session.kind === 'strength') {
    return session.focus !== null &&
      (LEG_LOAD_HINT.strengthFocus as readonly string[]).includes(session.focus)
      ? 'strength_legs'
      : null;
  }
  if (session.endurance_modality === 'swim') return null;
  if (isHardWorkoutType(session.workout_type ?? null)) return 'hard_endurance';
  return session.effort_target !== null && session.effort_target > ENDURANCE_EFFORT.easyMax
    ? 'hard_endurance'
    : null;
}

/** Zählt dieser Sport-Eintrag als hohe Beinbelastung (LEG_LOAD_HINT)? */
export function isHighLegLoadLog(log: LegLoadSportLog): boolean {
  if (log.sport === null || SPORT_CATALOGUE[log.sport].legLoad !== 'high') return false;
  if (log.durationS === null || log.durationS < LEG_LOAD_HINT.minMinutes * 60) return false;
  return effectiveEffort({ effort: log.effort, sport: log.sport }) >= LEG_LOAD_HINT.minEffort;
}

/**
 * Hinweise für offene, harte Bein-Einheiten ab heute, deren Vortag eine Sportart mit hoher Beinbelastung hat. Je
 * Einheit höchstens ein Hinweis (der belastendste Eintrag: längste Dauer, dann id).
 */
export function legLoadHints(input: {
  readonly logs: readonly LegLoadSportLog[];
  readonly sessions: readonly LegLoadSession[];
  readonly today: string;
}): LegLoadHint[] {
  const heavy = input.logs.filter(isHighLegLoadLog);
  if (heavy.length === 0) return [];
  return input.sessions
    .filter(
      (s) => s.status === 'planned' && s.plan_active !== false && s.scheduled_on >= input.today,
    )
    .flatMap((session): LegLoadHint[] => {
      const reason = hardLegSessionReason(session);
      if (reason === null) return [];
      const dayBefore = addDays(session.scheduled_on, -1);
      const log = heavy
        .filter((l) => l.performed_on === dayBefore)
        .sort((a, b) => (b.durationS ?? 0) - (a.durationS ?? 0) || (a.id < b.id ? -1 : 1))[0];
      if (!log || log.sport === null) return [];
      return [
        {
          sessionId: session.id,
          sessionDate: session.scheduled_on,
          reason,
          sport: log.sport,
          sportDate: log.performed_on,
          sportLogId: log.id,
        },
      ];
    })
    .sort((a, b) =>
      a.sessionDate < b.sessionDate
        ? -1
        : a.sessionDate > b.sessionDate
          ? 1
          : a.sessionId < b.sessionId
            ? -1
            : 1,
    );
}
