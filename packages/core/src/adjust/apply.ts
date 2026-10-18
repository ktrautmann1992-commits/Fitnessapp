import type { ExerciseProgress } from '../log/types';
import type { StoredSession } from '../plan/view';
import type { LiveExerciseEntry, LiveSessionLog } from './inputs';
import { applyPlanChange } from './plan-changes';
import { isEffective, latestCountingSessionLogId } from './rules/common';
import type { PlanChange, StoredAdjustment } from './types';
import { newInvariantViolations } from './invariants';
import { swappedWeeksOf } from './rules/plan-rules';
import { eligiblePlannedSessions, planWeeks } from './weeks';

/**
 * Anwendung der Live-Anpassung in Anzeige und Folgeblock (docs/PLAN-PHASE-4B.md 5.4). Ohne Anpassungen (Gratis) gibt
 * jede Funktion ihre Eingabe unverändert zurück.
 */

const newestFirst = (a: StoredAdjustment, b: StoredAdjustment) =>
  b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/**
 * Zustands-Vorgabe für die Anzeige (progressFromLogs `stateOverride`): nur Status `applied`/`confirmed`, Art
 * `state_override`, gleiche Übung und `basis_session_log_id` = Einheit des NEUESTEN zählenden Eintrags. Kommt ein
 * neuerer Eintrag (zweites Gerät, Warteschlange), ist die Vorgabe veraltet → null (der Server setzt sie später auf
 * `superseded`).
 */
export function activeStateOverride(
  exerciseId: string,
  adjustments: readonly StoredAdjustment[],
  /** latestCountingSessionLogId(exerciseId, entries). */
  basis: string | null,
): ExerciseProgress | null {
  if (basis === null) return null;
  const match = [...adjustments]
    .filter(
      (a) =>
        isEffective(a) &&
        a.kind === 'state_override' &&
        a.exerciseId === exerciseId &&
        a.basisSessionLogId === basis &&
        a.stateAfter !== null,
    )
    .sort(newestFirst)[0];
  return match?.stateAfter ?? null;
}

/** Wendet alle wirksamen Plan-Änderungen an (Testmodus der App rechnet wie apply_plan_adjustments; ältere zuerst). */
export function applyAdjustmentsToPlan<S extends StoredSession>(
  sessions: readonly S[],
  adjustments: readonly StoredAdjustment[],
): S[] {
  return [...adjustments]
    .filter((a) => isEffective(a) && a.kind === 'plan_change' && a.changeAfter !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .reduce<S[]>((acc, a) => applyPlanChange(acc, a.changeAfter as PlanChange), [...sessions]);
}

/**
 * Vor baseSessionsFromBlock(): vorübergehende Kraft-Änderungen (`volume_reduce`, `deload_forward` an Wochen, die jetzt
 * Erholungswoche sind) auf `change_before` zurücksetzen (nur Sätze/RPE), damit der Folgeblock keine reduzierten Sätze
 * erbt. Bewusst NICHT zurückgesetzt (Plan 5.2 Punkt 5 und 5.4):
 * - `is_deload` und die Ausdauer-Minuten (`endurance_reduce`, Neu-Deckelung): Der 10-%-Bezug des Folgeblocks ist die
 *   TATSÄCHLICH geplante letzte Belastungswoche – eher vorsichtiger;
 * - die getauschte Woche D (jetzt Belastungswoche mit der Dosierung von D − 1 – das ist schon eine Belastungs-Dosierung);
 * - der Tausch aus R4 (`stagnation_variation`, bewusst für den Block dauerhaft).
 * `trailingLoadWeeks()` für `carriedLoadWeeks` immer VOR dieser Funktion aus dem tatsächlichen Plan zählen.
 */
export function restoreTemporaryChanges<S extends StoredSession>(
  sessions: readonly S[],
  adjustments: readonly StoredAdjustment[],
): S[] {
  const relevant = [...adjustments]
    .filter(
      (a) =>
        isEffective(a) &&
        (a.rule === 'volume_reduce' || a.rule === 'deload_forward') &&
        a.changeBefore !== null &&
        'sessions' in a.changeBefore,
    )
    // Neueste zuerst zurücksetzen, damit am Ende der älteste Vorher-Stand gilt.
    .sort(newestFirst);
  let out = [...sessions];
  for (const a of relevant) {
    const before = a.changeBefore as PlanChange;
    const current = new Map(out.map((s) => [s.id, s] as const));
    const restore: PlanChange = {
      sessions: before.sessions
        .filter((c) => {
          const s = current.get(c.id);
          return (
            s !== undefined && s.kind === 'strength' && (a.rule === 'volume_reduce' || s.is_deload)
          );
        })
        .map((c) => ({
          id: c.id,
          ...(c.exercises
            ? {
                exercises: c.exercises.map((e) => ({
                  order_no: e.order_no,
                  ...(e.sets === undefined ? {} : { sets: e.sets }),
                  ...(e.rpe_target === undefined ? {} : { rpe_target: e.rpe_target }),
                })),
              }
            : {}),
        })),
    };
    out = applyPlanChange(out, restore);
  }
  return out;
}

/** Kennzeichen „angepasst“ je Einheit bzw. Übung (Anzeige, PDF neutral ohne Grund). */
export function adjustmentMarks(
  session: Pick<StoredSession, 'id'>,
  adjustments: readonly StoredAdjustment[],
): {
  readonly adjusted: boolean;
  readonly orderNos: readonly number[];
  readonly ids: readonly string[];
} {
  const hits = adjustments.filter(
    (a) => isEffective(a) && a.kind === 'plan_change' && a.plannedSessionIds.includes(session.id),
  );
  const orderNos = new Set<number>();
  for (const a of hits) {
    const change = a.changeAfter as PlanChange | null;
    for (const s of change?.sessions ?? []) {
      if (s.id !== session.id) continue;
      for (const e of s.exercises ?? []) orderNos.add(e.order_no);
    }
  }
  return {
    adjusted: hits.length > 0,
    orderNos: [...orderNos].sort((x, y) => x - y),
    ids: hits.map((a) => a.id).sort(),
  };
}

/** Steht in den Einheiten noch genau der Nachher-Stand dieser Anpassung (keine neuere Änderung darüber)? */
function stillAsAfter(sessions: readonly StoredSession[], change: PlanChange): boolean {
  const byId = new Map(sessions.map((s) => [s.id, s] as const));
  return change.sessions.every((c) => {
    const s = byId.get(c.id);
    if (!s) return false;
    if (c.is_deload !== undefined && s.is_deload !== c.is_deload) return false;
    if (c.estimated_minutes !== undefined && s.estimated_minutes !== c.estimated_minutes)
      return false;
    if (
      c.workout_steps !== undefined &&
      JSON.stringify(s.workout_steps ?? null) !== JSON.stringify(c.workout_steps)
    ) {
      return false;
    }
    return (c.exercises ?? []).every((ec) => {
      const e = s.exercises.find((x) => x.order_no === ec.order_no);
      return (
        e !== undefined &&
        (ec.sets === undefined || e.sets === ec.sets) &&
        (ec.rpe_target === undefined || e.rpe_target === ec.rpe_target) &&
        (ec.exercise_id === undefined || e.exercise_id === ec.exercise_id)
      );
    });
  });
}

/**
 * Darf die Anpassung zurückgenommen werden (Plan 4.6 Punkt 5)? Nur `applied` ohne Bestätigungspflicht.
 * Zustands-Vorgabe: solange kein neuerer zählender Eintrag der Übung existiert. Plan-Änderung (auch `deload_forward`
 * als Ganzes):
 * - alle betroffenen Einheiten noch `planned`, ab morgen und ohne Eintrag;
 * - KEINE neuere wirksame Plan-Änderung in denselben Wochen (Wächter-Auflage 1: nur in umgekehrter Reihenfolge
 *   zurücknehmen) – geprüft über `adjustments` und zusätzlich am Plan selbst (Einheiten stehen noch auf `change_after`);
 * - der Plan NACH dem Zurückschreiben erzeugt keinen neuen Verstoß der Wochen-Invarianten (ab der ersten betroffenen
 *   Woche; `maxLoadWeeks` des Plans, ohne Angabe nur die übrigen Invarianten).
 */
export function canRevert(
  adjustment: StoredAdjustment,
  state: {
    readonly sessions: readonly StoredSession[];
    readonly sessionLogs: readonly Pick<LiveSessionLog, 'plannedSessionId'>[];
    readonly entries: readonly LiveExerciseEntry[];
    readonly today: string;
    /** Alle Anpassungen des Plans (für „neuere Änderung in denselben Wochen“). */
    readonly adjustments?: readonly StoredAdjustment[];
    readonly maxLoadWeeks?: number;
    readonly planStart?: string;
  },
): boolean {
  if (adjustment.status !== 'applied' || adjustment.requiresConfirmation) return false;
  if (adjustment.kind === 'state_override') {
    return (
      adjustment.exerciseId !== null &&
      latestCountingSessionLogId(adjustment.exerciseId, state.entries) ===
        adjustment.basisSessionLogId
    );
  }
  if (adjustment.kind !== 'plan_change' || adjustment.changeBefore === null) return false;
  const eligible = new Set(
    eligiblePlannedSessions(state.sessions, state.sessionLogs, state.today).map((s) => s.id),
  );
  if (!adjustment.plannedSessionIds.every((id) => eligible.has(id))) return false;
  if (!stillAsAfter(state.sessions, adjustment.changeAfter as PlanChange)) return false;
  const weeks = planWeeks(state.sessions);
  const weekOf = new Map(
    weeks.flatMap((w) => w.sessions.map((s) => [s.id, `${w.blockNo}:${w.weekNo}`] as const)),
  );
  const ownWeeks = new Set(adjustment.plannedSessionIds.map((id) => weekOf.get(id)));
  const newer = (state.adjustments ?? []).some(
    (a) =>
      a.id !== adjustment.id &&
      a.kind === 'plan_change' &&
      isEffective(a) &&
      a.createdAt > adjustment.createdAt &&
      a.plannedSessionIds.some((id) => ownWeeks.has(weekOf.get(id))),
  );
  if (newer) return false;
  const reverted = applyPlanChange(state.sessions, adjustment.changeBefore as PlanChange);
  const first = weeks.find((w) => ownWeeks.has(`${w.blockNo}:${w.weekNo}`));
  const others = (state.adjustments ?? []).filter((a) => a.id !== adjustment.id);
  const options = {
    maxLoadWeeks: state.maxLoadWeeks ?? Number.MAX_SAFE_INTEGER,
    ...(state.planStart === undefined ? {} : { planStart: state.planStart }),
    ...(first ? { fromMonday: first.monday } : {}),
  };
  return (
    newInvariantViolations(
      state.sessions,
      reverted,
      { ...options, swappedWeeks: swappedWeeksOf(others, weeks) },
      { ...options, swappedWeeks: swappedWeeksOf(state.adjustments ?? [], weeks) },
    ).length === 0
  );
}
